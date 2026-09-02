import type { Attribute, Difficulty, LocalDate } from '../types';

/**
 * The event log. Spec §8.2.
 *
 * Progression state — XP, level, gold, attributes, streaks, momentum — is
 * never stored as the source of truth. This log is, and everything else is a
 * rebuildable projection of it.
 *
 * ---------------------------------------------------------------------------
 * The central design decision: what an event stores
 * ---------------------------------------------------------------------------
 *
 * An event records **the facts of the moment**, never the reward it produced.
 * `habit.completed` says "a medium-difficulty Vitality habit was done, inside
 * its window, planned the night before". It does not say "+28 XP".
 *
 * That is what makes rule changes retroactive (spec §8.2, point 3): retune
 * LEVEL_CURVE_E or the multiplier table, replay, and every user's history
 * stays internally consistent. Had the award been baked into the payload, the
 * curve would be frozen the day it shipped — and with no server, a bad
 * balance decision could never be undone.
 *
 * But note what *is* snapshotted: `difficulty` and `attributes`. Those live
 * on the mutable habit definition, and re-reading them at replay time would
 * mean editing a habit from Easy to Epic retroactively inflated a year of
 * history. What you did last March was an easy thing, and it stays one.
 *
 * ---------------------------------------------------------------------------
 * Why replay never touches habit definitions
 * ---------------------------------------------------------------------------
 *
 * Streaks depend on which days a habit was *scheduled*, which lives on the
 * mutable definition too. Rather than resolve schedules during replay, the
 * daily rollover job interprets them once — at the moment it has the answer —
 * and records its conclusions in `day.closed`. Replay then applies those
 * conclusions as fact.
 *
 * The payoff is that `reduceEvents` is a pure function of the log alone. An
 * imported backup replays correctly even if the habits it references have
 * since been edited, archived or deleted (spec §8.3.4).
 */

export type EventType =
  | 'habit.completed'
  | 'habit.uncompleted'
  | 'ritual.completed'
  | 'negative.logged'
  | 'day.closed'
  | 'streak.repaired'
  | 'reward.redeemed';

interface EventEnvelope<T extends EventType, P> {
  /** UUIDv7 — time-sortable, and collision-free when merging two devices. */
  id: string;
  type: T;
  /** Habit, ritual or reward id, denormalised for indexed lookup. */
  subjectId: string | null;
  /** The calendar day this belongs to, in the user's tz at write time. */
  localDate: LocalDate;
  occurredAt: number;
  payload: P;
}

// ---------------------------------------------------------------------------

export interface HabitCompletedPayload {
  habitId: string;
  /** Snapshotted at completion: what this was worth *then*. */
  difficulty: Difficulty;
  attributes: Attribute[];
  /** In the day plan before the day began — the 1.15x pre-commitment bonus. */
  plannedAhead: boolean;
  inWindow: boolean;
  hasEvidence: boolean;
  /** For quantitative habits; 1 for a plain tick. */
  quantity: number;
  /**
   * Whether the habit was owed on this date, decided by the caller which can
   * see the schedule. Drives the optimistic in-day streak bump; `day.closed`
   * later overwrites it with the authoritative value.
   */
  scheduledToday: boolean;
  /** Weekly habits streak in weeks, so a completion must not bump them daily. */
  weeklyStreak: boolean;
}

export interface HabitUncompletedPayload {
  habitId: string;
  /** The `habit.completed` event this voids. */
  targetEventId: string;
}

export interface RitualCompletedPayload {
  ritualId: string;
  /** Recorded for insight queries; the member habits emit their own events. */
  habitIds: string[];
}

export interface NegativeLoggedPayload {
  habitId: string;
}

export interface StreakOutcome {
  habitId: string;
  /** Authoritative streak after this day, from the rollover's resolveStreak. */
  streak: number;
  longestStreak: number;
  /** A freeze token was spent to survive a miss on this day. */
  freezeConsumed: boolean;
  /** A 7-day milestone was crossed, earning a token. */
  freezeEarned: boolean;
  broke: boolean;
}

/**
 * Emitted once per day by the rollover job. Carries everything that required
 * reading habit definitions, so replay never has to.
 */
export interface DayClosedPayload {
  date: LocalDate;
  missedCount: number;
  /** No activity at all that day. */
  wasEmpty: boolean;
  streakOutcomes: StreakOutcome[];
}

export interface StreakRepairedPayload {
  habitId: string;
  goldSpent: number;
  restoredTo: number;
}

export interface RewardRedeemedPayload {
  rewardId: string;
  goldSpent: number;
}

// ---------------------------------------------------------------------------

export type HabitCompletedEvent = EventEnvelope<'habit.completed', HabitCompletedPayload>;
export type HabitUncompletedEvent = EventEnvelope<'habit.uncompleted', HabitUncompletedPayload>;
export type RitualCompletedEvent = EventEnvelope<'ritual.completed', RitualCompletedPayload>;
export type NegativeLoggedEvent = EventEnvelope<'negative.logged', NegativeLoggedPayload>;
export type DayClosedEvent = EventEnvelope<'day.closed', DayClosedPayload>;
export type StreakRepairedEvent = EventEnvelope<'streak.repaired', StreakRepairedPayload>;
export type RewardRedeemedEvent = EventEnvelope<'reward.redeemed', RewardRedeemedPayload>;

export type DomainEvent =
  | HabitCompletedEvent
  | HabitUncompletedEvent
  | RitualCompletedEvent
  | NegativeLoggedEvent
  | DayClosedEvent
  | StreakRepairedEvent
  | RewardRedeemedEvent;

/**
 * Events that cannot be folded incrementally, because they change the meaning
 * of an event already applied. Undo is the only one: reversing an award needs
 * the daily-cap context as it stood at the time, which is gone. The caller
 * rebuilds instead — cheap (§ replay benchmark) and provably correct.
 */
export function requiresRebuild(event: DomainEvent): boolean {
  return event.type === 'habit.uncompleted';
}

/** Total ordering. UUIDv7 breaks ties for events sharing a millisecond. */
export function compareEvents(a: DomainEvent, b: DomainEvent): number {
  if (a.occurredAt !== b.occurredAt) return a.occurredAt - b.occurredAt;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
