import { MAX_FREEZE_TOKENS } from '../streak/streak';
import { MAX_DAILY_MISS_PENALTY, MOMENTUM_DELTA, clampMomentum } from '../momentum/momentum';
import { awardXp } from '../xp/award';
import {
  compareEvents,
  type DayClosedPayload,
  type DomainEvent,
  type HabitCompletedPayload,
  type RewardRedeemedPayload,
  type StreakRepairedPayload,
} from './types';
import {
  emptyDailyTotal,
  emptyHabitProgress,
  emptyState,
  selectMomentumState,
  type ProgressionState,
} from './state';

/**
 * The reducer. Spec §8.2.
 *
 * Pure, deterministic and total: the same log always folds to the same state,
 * on any device, in any timezone, at any point in the future. That property is
 * what makes import work (§8.3.4) and what lets the level curve be retuned
 * years from now without corrupting anyone's history.
 *
 * ---------------------------------------------------------------------------
 * Two paths, on purpose
 * ---------------------------------------------------------------------------
 *
 * `applyEvent` is immutable and used on the hot path — one event per tap.
 * Cloning the state's three containers costs microseconds there, and buys
 * React reference equality for free.
 *
 * `reduceEvents` folds a whole log and uses a single mutable draft instead.
 * Cloning per event would make replay O(n^2) in the number of days and
 * habits: at 50k events that measured ~16 seconds, against a <1s budget.
 * Since rebuilds run on every import and every undo, that is the difference
 * between the app feeling solid and stalling at the exact moment a user is
 * most anxious about their data.
 *
 * The draft is never observable: it starts as a private `emptyState()` (or a
 * clone) and is only returned once folding is complete. Entries inside the
 * containers are *replaced*, never mutated in place, so a clone made by
 * `applyEvent` can never be corrupted through a shared nested object.
 */

export function applyEvent(state: ProgressionState, event: DomainEvent): ProgressionState {
  const draft = cloneState(state);
  applyEventInto(draft, event);
  return draft;
}

/**
 * Full replay, and the only correct way to apply an undo.
 *
 * Two passes: the first collects voided events, the second folds. `undo` is
 * therefore modelled as "this never happened" rather than as a negative
 * award, which keeps XP monotonic (spec §5.1, constraint 3) and means an
 * undone completion leaves no trace in the daily cap either.
 */
export function reduceEvents(events: Iterable<DomainEvent>): ProgressionState {
  const ordered = [...events].sort(compareEvents);

  const voided = new Set<string>();
  for (const event of ordered) {
    if (event.type === 'habit.uncompleted') voided.add(event.payload.targetEventId);
  }

  const draft = emptyState();
  for (const event of ordered) {
    if (voided.has(event.id)) {
      // Still counted, so `eventCount` matches the log and staleness checks work.
      draft.eventCount += 1;
      continue;
    }
    applyEventInto(draft, event);
  }
  return draft;
}

function cloneState(state: ProgressionState): ProgressionState {
  return {
    ...state,
    attributeXp: { ...state.attributeXp },
    daily: { ...state.daily },
    habits: { ...state.habits },
  };
}

// ---------------------------------------------------------------------------

function applyEventInto(draft: ProgressionState, event: DomainEvent): void {
  switch (event.type) {
    case 'habit.completed':
      habitCompleted(draft, event.payload, event.localDate);
      break;
    case 'ritual.completed':
      // Member habits emit their own completions and carry the XP. A ritual
      // is worth momentum on top, because finishing a whole chain is the
      // behaviour worth reinforcing (spec §4.2).
      draft.momentum = clampMomentum(draft.momentum + MOMENTUM_DELTA.ritualCompleted);
      break;
    case 'negative.logged':
      // Zero XP, zero penalty. The cost is paid in momentum, where it
      // recovers (spec §5.2). Subtracting XP drives the what-the-hell effect.
      draft.momentum = clampMomentum(draft.momentum + MOMENTUM_DELTA.negativeLogged);
      break;
    case 'day.closed':
      dayClosed(draft, event.payload, event.occurredAt);
      break;
    case 'streak.repaired':
      streakRepaired(draft, event.payload);
      break;
    case 'reward.redeemed':
      rewardRedeemed(draft, event.payload);
      break;
    case 'habit.uncompleted':
      // Handled by voiding during a full replay — see `reduceEvents`. Folding
      // it incrementally would need the daily-cap context as it stood at the
      // time, which is gone.
      break;
  }

  draft.eventCount += 1;
}

function habitCompleted(
  draft: ProgressionState,
  payload: HabitCompletedPayload,
  localDate: string,
): void {
  const habit = draft.habits[payload.habitId] ?? emptyHabitProgress();
  const day = draft.daily[localDate] ?? emptyDailyTotal();

  const award = awardXp(payload.difficulty, {
    streak: habit.streak,
    plannedAhead: payload.plannedAhead,
    inWindow: payload.inWindow,
    hasEvidence: payload.hasEvidence,
    momentumState: selectMomentumState(draft),
    rawSoFarToday: day.rawXp,
  });

  draft.xpTotal += award.banked;
  draft.gold += award.gold;
  draft.momentum = clampMomentum(draft.momentum + MOMENTUM_DELTA.itemCompleted);

  for (const attribute of payload.attributes) {
    // Awarded in full to each tagged attribute: attributes are a lens on the
    // same actions, not a competing budget (spec §5.3).
    draft.attributeXp[attribute] += award.banked;
  }

  /**
   * Optimistic in-day streak bump. Only for habits owed today, and never for
   * weekly habits, which streak in weeks. `day.closed` overwrites this with
   * the rollover's authoritative value, so replay converges either way.
   */
  const advances = payload.scheduledToday && !payload.weeklyStreak;
  const streak = advances ? habit.streak + 1 : habit.streak;

  if (advances && streak % 7 === 0 && draft.freezeTokens < MAX_FREEZE_TOKENS) {
    draft.freezeTokens += 1;
  }

  draft.daily[localDate] = {
    ...day,
    rawXp: day.rawXp + award.raw,
    bankedXp: day.bankedXp + award.banked,
    gold: day.gold + award.gold,
    completed: day.completed + 1,
  };

  draft.habits[payload.habitId] = {
    ...habit,
    streak,
    longestStreak: Math.max(habit.longestStreak, streak),
    totalCompletions: habit.totalCompletions + 1,
    lastCompletedOn: localDate,
    brokenAt: advances ? null : habit.brokenAt,
  };
}

function dayClosed(draft: ProgressionState, payload: DayClosedPayload, occurredAt: number): void {
  // Misses are aggregated and floored before anything else, so a day where
  // nine items were missed costs the same as one where three were. Over-
  // scheduling is a planning mistake, not a moral failure (spec §5.6).
  const missPenalty = Math.max(
    MAX_DAILY_MISS_PENALTY,
    payload.missedCount * MOMENTUM_DELTA.itemMissed,
  );
  const emptyPenalty = payload.wasEmpty ? MOMENTUM_DELTA.emptyDay : 0;

  draft.momentum = clampMomentum(draft.momentum + missPenalty + emptyPenalty);

  for (const outcome of payload.streakOutcomes) {
    const previous = draft.habits[outcome.habitId] ?? emptyHabitProgress();

    if (outcome.freezeConsumed) draft.freezeTokens = Math.max(0, draft.freezeTokens - 1);
    if (outcome.freezeEarned && draft.freezeTokens < MAX_FREEZE_TOKENS) draft.freezeTokens += 1;

    draft.habits[outcome.habitId] = {
      ...previous,
      // The rollover resolved the schedule; its answer wins over the
      // optimistic in-day value.
      streak: outcome.streak,
      longestStreak: Math.max(previous.longestStreak, outcome.longestStreak),
      brokenAt: outcome.broke ? occurredAt : previous.brokenAt,
    };
  }

  const day = draft.daily[payload.date] ?? emptyDailyTotal();
  draft.daily[payload.date] = { ...day, missed: day.missed + payload.missedCount };
}

function streakRepaired(draft: ProgressionState, payload: StreakRepairedPayload): void {
  const habit = draft.habits[payload.habitId] ?? emptyHabitProgress();

  draft.gold = Math.max(0, draft.gold - payload.goldSpent);
  draft.habits[payload.habitId] = {
    ...habit,
    streak: payload.restoredTo,
    longestStreak: Math.max(habit.longestStreak, payload.restoredTo),
    brokenAt: null,
  };
}

function rewardRedeemed(draft: ProgressionState, payload: RewardRedeemedPayload): void {
  draft.gold = Math.max(0, draft.gold - payload.goldSpent);
}
