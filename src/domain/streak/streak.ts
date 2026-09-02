import type { LocalDate, Schedule } from '../types';
import { eachDay, isoWeekKey } from '../time/localDate';
import { isScheduledOn, isWeeklySchedule, weeklyTarget } from '../scheduling/schedule';

/**
 * Streak resolution. Spec §10.3.
 *
 * This is the single most bug-prone piece of code in any habit app, so it is
 * written as one pure, idempotent function over an explicit date range.
 * Running it twice for the same range must produce the same answer — the
 * caller can therefore re-run it on every app foreground without bookkeeping.
 *
 * Rules, in order:
 *   - Unscheduled days can never break a streak.
 *   - A missed scheduled day consumes a freeze token if one is held.
 *   - While momentum is Dormant, streaks are frozen entirely (spec §5.6).
 *   - Weekly habits are evaluated per ISO week, not per day.
 */

/** Earned one per completed 7-day streak, held to a maximum of 3. */
export const FREEZE_EARN_INTERVAL = 7;
export const MAX_FREEZE_TOKENS = 3;

/** A broken streak can be repaired with gold for this long. Spec §5.7. */
export const REPAIR_WINDOW_HOURS = 48;

export interface StreakInput {
  schedule: Schedule;
  /** Dates on which the habit was completed. Order irrelevant. */
  completions: Iterable<LocalDate>;
  /** Inclusive range to evaluate. Normally `lastEvaluated+1 .. yesterday`. */
  from: LocalDate;
  to: LocalDate;
  /** Streak carried in from the previous evaluation. */
  streak: number;
  freezeTokens: number;
  /** Dates on which momentum was Dormant, during which streaks are frozen. */
  dormantDates?: Iterable<LocalDate>;
}

export interface StreakResult {
  streak: number;
  longestSeen: number;
  freezeTokens: number;
  freezesConsumed: LocalDate[];
  /** Dates where the streak actually broke — the repair window starts here. */
  breaks: { date: LocalDate; lostStreak: number }[];
}

export function resolveStreak(input: StreakInput): StreakResult {
  return isWeeklySchedule(input.schedule) ? resolveWeekly(input) : resolveDaily(input);
}

function resolveDaily(input: StreakInput): StreakResult {
  const done = new Set(input.completions);
  const dormant = new Set(input.dormantDates ?? []);

  let streak = Math.max(0, input.streak);
  let longestSeen = streak;
  let tokens = Math.max(0, input.freezeTokens);
  const freezesConsumed: LocalDate[] = [];
  const breaks: StreakResult['breaks'] = [];

  for (const date of eachDay(input.from, input.to)) {
    if (!isScheduledOn(input.schedule, date)) continue;

    if (done.has(date)) {
      streak++;
      longestSeen = Math.max(longestSeen, streak);
      if (streak % FREEZE_EARN_INTERVAL === 0 && tokens < MAX_FREEZE_TOKENS) tokens++;
      continue;
    }

    // A collapse should not also cost every streak the user has built.
    if (dormant.has(date)) continue;

    if (tokens > 0) {
      tokens--;
      freezesConsumed.push(date);
      continue;
    }

    if (streak > 0) breaks.push({ date, lostStreak: streak });
    streak = 0;
  }

  return { streak, longestSeen, freezeTokens: tokens, freezesConsumed, breaks };
}

function resolveWeekly(input: StreakInput): StreakResult {
  const target = weeklyTarget(input.schedule);
  const dormant = new Set(input.dormantDates ?? []);

  const perWeek = new Map<string, number>();
  for (const date of input.completions) {
    const key = isoWeekKey(date);
    perWeek.set(key, (perWeek.get(key) ?? 0) + 1);
  }

  // Only whole weeks inside the range are judged; a week still in progress
  // has not been failed yet.
  const weekKeys: string[] = [];
  const dormantWeeks = new Set<string>();
  for (const date of eachDay(input.from, input.to)) {
    const key = isoWeekKey(date);
    if (weekKeys[weekKeys.length - 1] !== key) weekKeys.push(key);
    if (dormant.has(date)) dormantWeeks.add(key);
  }

  let streak = Math.max(0, input.streak);
  let longestSeen = streak;
  let tokens = Math.max(0, input.freezeTokens);
  const freezesConsumed: LocalDate[] = [];
  const breaks: StreakResult['breaks'] = [];

  for (const key of weekKeys) {
    const met = (perWeek.get(key) ?? 0) >= target;

    if (met) {
      streak++;
      longestSeen = Math.max(longestSeen, streak);
      if (streak % FREEZE_EARN_INTERVAL === 0 && tokens < MAX_FREEZE_TOKENS) tokens++;
      continue;
    }

    if (dormantWeeks.has(key)) continue;

    if (tokens > 0) {
      tokens--;
      freezesConsumed.push(key as LocalDate);
      continue;
    }

    if (streak > 0) breaks.push({ date: key as LocalDate, lostStreak: streak });
    streak = 0;
  }

  return { streak, longestSeen, freezeTokens: tokens, freezesConsumed, breaks };
}

/** Gold cost to repair a broken streak: `50 * ceil(streak / 10)`. Spec §5.7. */
export function repairCost(lostStreak: number): number {
  return 50 * Math.max(1, Math.ceil(lostStreak / 10));
}

export function canRepair(brokenAtMs: number, nowMs: number): boolean {
  const elapsedHours = (nowMs - brokenAtMs) / 3_600_000;
  return elapsedHours >= 0 && elapsedHours <= REPAIR_WINDOW_HOURS;
}
