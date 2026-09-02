import type { LocalDate, Schedule } from '../types';
import { addDays, daysBetween, weekdayOf } from '../time/localDate';

/**
 * Schedule resolution. Spec §10.5.
 *
 * Two distinct questions, deliberately kept apart:
 *
 *   isScheduledOn  — "was this owed today?"  Drives streaks and misses.
 *   isAvailableOn  — "may this be done today?"  Drives what the Today screen shows.
 *
 * Conflating them is how habit apps end up breaking streaks on days the user
 * was never expected to do anything.
 */

export function isScheduledOn(schedule: Schedule, date: LocalDate): boolean {
  switch (schedule.type) {
    case 'weekdays':
      return schedule.days.includes(weekdayOf(date));

    case 'every_n_days': {
      if (schedule.n <= 0) return false;
      const delta = daysBetween(schedule.anchor, date);
      return delta >= 0 && delta % schedule.n === 0;
    }

    // A "3x per week" habit is owed on no particular day, so no single day
    // can be a miss. Its streak is evaluated per ISO week instead.
    case 'times_per_week':
      return false;

    case 'none':
      return false;
  }
}

export function isAvailableOn(schedule: Schedule, date: LocalDate): boolean {
  switch (schedule.type) {
    case 'weekdays':
    case 'every_n_days':
      return isScheduledOn(schedule, date);
    case 'times_per_week':
    case 'none':
      return true;
  }
}

/** Weekly habits are streaked in weeks; everything else in days. */
export function isWeeklySchedule(schedule: Schedule): boolean {
  return schedule.type === 'times_per_week';
}

/** How many completions a week must contain to count as met. */
export function weeklyTarget(schedule: Schedule): number {
  return schedule.type === 'times_per_week' ? Math.max(1, schedule.times) : 0;
}

/** Scheduled occurrences in an inclusive date range — the denominator for adherence. */
export function scheduledCountBetween(
  schedule: Schedule,
  from: LocalDate,
  to: LocalDate,
): number {
  const span = daysBetween(from, to);
  if (span < 0) return 0;

  if (schedule.type === 'times_per_week') {
    // Fractional weeks are fine here: adherence is a ratio, not a count of days.
    return (weeklyTarget(schedule) * (span + 1)) / 7;
  }

  let count = 0;
  for (let i = 0; i <= span; i++) {
    if (isScheduledOn(schedule, addDays(from, i))) count++;
  }
  return count;
}
