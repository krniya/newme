import { describe, expect, it } from 'vitest';
import type { Schedule } from '../types';
import {
  isAvailableOn,
  isScheduledOn,
  isWeeklySchedule,
  scheduledCountBetween,
  weeklyTarget,
} from './schedule';

// 2026-08-31 is a Monday; 2026-09-05 a Saturday; 2026-09-06 a Sunday.
const weekdays: Schedule = { type: 'weekdays', days: [1, 2, 3, 4, 5] };
const everyThird: Schedule = { type: 'every_n_days', n: 3, anchor: '2026-09-01' };
const threeAWeek: Schedule = { type: 'times_per_week', times: 3 };
const unscheduled: Schedule = { type: 'none' };

describe('weekday schedules', () => {
  it('is owed on its listed days only', () => {
    expect(isScheduledOn(weekdays, '2026-09-02')).toBe(true); // Wednesday
    expect(isScheduledOn(weekdays, '2026-09-05')).toBe(false); // Saturday
    expect(isScheduledOn(weekdays, '2026-09-06')).toBe(false); // Sunday
  });
});

describe('every-N-days schedules', () => {
  it('lands on the anchor and every Nth day after', () => {
    expect(isScheduledOn(everyThird, '2026-09-01')).toBe(true);
    expect(isScheduledOn(everyThird, '2026-09-02')).toBe(false);
    expect(isScheduledOn(everyThird, '2026-09-04')).toBe(true);
    expect(isScheduledOn(everyThird, '2026-09-07')).toBe(true);
  });

  it('is never owed before its anchor', () => {
    expect(isScheduledOn(everyThird, '2026-08-29')).toBe(false);
  });

  it('treats a zero or negative interval as never scheduled, not as a crash', () => {
    expect(isScheduledOn({ type: 'every_n_days', n: 0, anchor: '2026-09-01' }, '2026-09-01')).toBe(false);
  });
});

describe('the scheduled / available distinction', () => {
  /**
   * Spec §10.5. Conflating these is how habit apps break streaks on days the
   * user was never expected to act.
   */
  it('makes a 3x-per-week habit available daily but owed on no day', () => {
    for (const date of ['2026-08-31', '2026-09-02', '2026-09-06']) {
      expect(isScheduledOn(threeAWeek, date)).toBe(false);
      expect(isAvailableOn(threeAWeek, date)).toBe(true);
    }
  });

  it('makes an unscheduled habit always available, never owed', () => {
    expect(isScheduledOn(unscheduled, '2026-09-02')).toBe(false);
    expect(isAvailableOn(unscheduled, '2026-09-02')).toBe(true);
  });

  it('keeps availability and obligation aligned for day-specific schedules', () => {
    expect(isAvailableOn(weekdays, '2026-09-05')).toBe(false);
    expect(isAvailableOn(weekdays, '2026-09-02')).toBe(true);
  });
});

describe('weekly helpers', () => {
  it('identifies weekly schedules and their targets', () => {
    expect(isWeeklySchedule(threeAWeek)).toBe(true);
    expect(isWeeklySchedule(weekdays)).toBe(false);
    expect(weeklyTarget(threeAWeek)).toBe(3);
    expect(weeklyTarget(weekdays)).toBe(0);
  });

  it('treats a zero target as at least one, so a habit is never trivially met', () => {
    expect(weeklyTarget({ type: 'times_per_week', times: 0 })).toBe(1);
  });
});

describe('adherence denominators', () => {
  it('counts scheduled weekdays in a range', () => {
    // Mon 31 Aug to Sun 6 Sep contains 5 weekdays.
    expect(scheduledCountBetween(weekdays, '2026-08-31', '2026-09-06')).toBe(5);
  });

  it('prorates weekly targets, since adherence is a ratio not a day count', () => {
    expect(scheduledCountBetween(threeAWeek, '2026-08-31', '2026-09-06')).toBe(3);
    expect(scheduledCountBetween(threeAWeek, '2026-08-31', '2026-09-13')).toBe(6);
  });

  it('returns nothing for a reversed range', () => {
    expect(scheduledCountBetween(weekdays, '2026-09-06', '2026-08-31')).toBe(0);
  });
});
