import type { Attribute, Difficulty, LocalDate } from '../types';
import type {
  DayClosedEvent,
  HabitCompletedEvent,
  HabitUncompletedEvent,
  NegativeLoggedEvent,
  RewardRedeemedEvent,
  RitualCompletedEvent,
  StreakOutcome,
  StreakRepairedEvent,
} from './types';

/**
 * Event builders for tests and the dev seed.
 *
 * Kept in `src/domain` deliberately: it is pure, and the purity test covers
 * it. `minute` exists so a test can order events without hand-writing
 * timestamps — the reducer sorts by `occurredAt`, and events sharing a
 * millisecond would otherwise fall back to id ordering and make tests depend
 * on how they happen to be named.
 */

const DAY: LocalDate = '2026-09-02';
const BASE = Date.UTC(2026, 8, 2, 8, 0, 0);

const at = (minute: number) => BASE + minute * 60_000;

export function makeCompleted(over: {
  id?: string;
  habitId?: string;
  difficulty?: Difficulty;
  attributes?: Attribute[];
  plannedAhead?: boolean;
  inWindow?: boolean;
  hasEvidence?: boolean;
  quantity?: number;
  scheduledToday?: boolean;
  weeklyStreak?: boolean;
  localDate?: LocalDate;
  minute?: number;
}): HabitCompletedEvent {
  const habitId = over.habitId ?? 'h1';
  return {
    id: over.id ?? 'evt-completed',
    type: 'habit.completed',
    subjectId: habitId,
    localDate: over.localDate ?? DAY,
    occurredAt: at(over.minute ?? 0),
    payload: {
      habitId,
      difficulty: over.difficulty ?? 'easy',
      attributes: over.attributes ?? ['focus'],
      plannedAhead: over.plannedAhead ?? false,
      inWindow: over.inWindow ?? false,
      hasEvidence: over.hasEvidence ?? false,
      quantity: over.quantity ?? 1,
      scheduledToday: over.scheduledToday ?? false,
      weeklyStreak: over.weeklyStreak ?? false,
    },
  };
}

export function makeUncompleted(over: {
  id?: string;
  habitId?: string;
  targetEventId: string;
  minute?: number;
}): HabitUncompletedEvent {
  const habitId = over.habitId ?? 'h1';
  return {
    id: over.id ?? 'evt-uncompleted',
    type: 'habit.uncompleted',
    subjectId: habitId,
    localDate: DAY,
    occurredAt: at(over.minute ?? 0),
    payload: { habitId, targetEventId: over.targetEventId },
  };
}

export function makeRitual(over: {
  id?: string;
  ritualId?: string;
  habitIds?: string[];
  localDate?: LocalDate;
  minute?: number;
}): RitualCompletedEvent {
  const ritualId = over.ritualId ?? 'r1';
  return {
    id: over.id ?? 'evt-ritual',
    type: 'ritual.completed',
    subjectId: ritualId,
    localDate: over.localDate ?? DAY,
    occurredAt: at(over.minute ?? 0),
    payload: { ritualId, habitIds: over.habitIds ?? [] },
  };
}

export function makeNegative(over: {
  id?: string;
  habitId?: string;
  localDate?: LocalDate;
  minute?: number;
}): NegativeLoggedEvent {
  const habitId = over.habitId ?? 'n1';
  return {
    id: over.id ?? 'evt-negative',
    type: 'negative.logged',
    subjectId: habitId,
    localDate: over.localDate ?? DAY,
    occurredAt: at(over.minute ?? 0),
    payload: { habitId },
  };
}

export function makeDayClosed(over: {
  id?: string;
  date?: LocalDate;
  missedCount?: number;
  wasEmpty?: boolean;
  streakOutcomes?: StreakOutcome[];
  minute?: number;
}): DayClosedEvent {
  const date = over.date ?? DAY;
  return {
    id: over.id ?? 'evt-day-closed',
    type: 'day.closed',
    subjectId: null,
    localDate: date,
    occurredAt: at(over.minute ?? 0),
    payload: {
      date,
      missedCount: over.missedCount ?? 0,
      wasEmpty: over.wasEmpty ?? false,
      streakOutcomes: over.streakOutcomes ?? [],
    },
  };
}

export function makeRepaired(over: {
  id?: string;
  habitId?: string;
  goldSpent?: number;
  restoredTo?: number;
  minute?: number;
}): StreakRepairedEvent {
  const habitId = over.habitId ?? 'h1';
  return {
    id: over.id ?? 'evt-repaired',
    type: 'streak.repaired',
    subjectId: habitId,
    localDate: DAY,
    occurredAt: at(over.minute ?? 0),
    payload: { habitId, goldSpent: over.goldSpent ?? 50, restoredTo: over.restoredTo ?? 10 },
  };
}

export function makeReward(over: {
  id?: string;
  rewardId?: string;
  goldSpent?: number;
  minute?: number;
}): RewardRedeemedEvent {
  const rewardId = over.rewardId ?? 'rw1';
  return {
    id: over.id ?? 'evt-reward',
    type: 'reward.redeemed',
    subjectId: rewardId,
    localDate: DAY,
    occurredAt: at(over.minute ?? 0),
    payload: { rewardId, goldSpent: over.goldSpent ?? 100 },
  };
}
