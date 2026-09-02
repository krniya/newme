import { describe, expect, it } from 'vitest';
import {
  addDays,
  compareDates,
  daysBetween,
  eachDay,
  isLocalDate,
  isoWeekKey,
  localDateOf,
  startOfIsoWeek,
  weekdayOf,
} from './localDate';

describe('validation', () => {
  it('accepts real calendar dates', () => {
    expect(isLocalDate('2026-09-02')).toBe(true);
    expect(isLocalDate('2024-02-29')).toBe(true); // leap year
  });

  it('rejects malformed and impossible dates', () => {
    expect(isLocalDate('2026-9-2')).toBe(false);
    expect(isLocalDate('not-a-date')).toBe(false);
    expect(isLocalDate('2026-02-31')).toBe(false);
    expect(isLocalDate('2025-02-29')).toBe(false); // not a leap year
    expect(isLocalDate('2026-13-01')).toBe(false);
  });
});

describe('day arithmetic', () => {
  it('adds and subtracts days across month and year boundaries', () => {
    expect(addDays('2026-09-02', 1)).toBe('2026-09-03');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
  });

  it('measures spans in whole days', () => {
    expect(daysBetween('2026-09-02', '2026-09-09')).toBe(7);
    expect(daysBetween('2026-09-09', '2026-09-02')).toBe(-7);
    expect(daysBetween('2026-09-02', '2026-09-02')).toBe(0);
  });

  /**
   * The DST case is why every function here works in UTC. In a timezone that
   * springs forward, a naive local-time +24h lands on the same calendar day
   * and silently eats a day of streak.
   */
  it('is immune to DST transitions', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29'); // EU spring forward
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25'); // EU fall back
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31);
    expect(daysBetween('2026-10-01', '2026-11-01')).toBe(31);
  });

  it('enumerates inclusive ranges, and nothing for a reversed range', () => {
    expect(eachDay('2026-09-01', '2026-09-04')).toEqual([
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
    ]);
    expect(eachDay('2026-09-01', '2026-09-01')).toEqual(['2026-09-01']);
    expect(eachDay('2026-09-04', '2026-09-01')).toEqual([]);
  });

  it('orders dates lexicographically, which ISO format guarantees', () => {
    expect(compareDates('2026-09-02', '2026-09-03')).toBe(-1);
    expect(compareDates('2026-09-03', '2026-09-02')).toBe(1);
    expect(compareDates('2026-09-02', '2026-09-02')).toBe(0);
  });

  it('throws on an invalid date rather than silently producing garbage', () => {
    expect(() => addDays('2026-02-31', 1)).toThrow(RangeError);
  });
});

describe('weekdays', () => {
  it('uses JS convention, 0 = Sunday', () => {
    expect(weekdayOf('2026-09-02')).toBe(3); // a Wednesday
    expect(weekdayOf('2026-09-06')).toBe(0); // Sunday
    expect(weekdayOf('2026-09-05')).toBe(6); // Saturday
  });
});

describe('ISO weeks', () => {
  it('groups Monday through Sunday into one key', () => {
    // 2026-08-31 is a Monday; the week runs to Sunday 2026-09-06.
    const week = isoWeekKey('2026-08-31');
    expect(isoWeekKey('2026-09-02')).toBe(week);
    expect(isoWeekKey('2026-09-06')).toBe(week);
    expect(isoWeekKey('2026-09-07')).not.toBe(week);
  });

  it('handles the year boundary, where ISO weeks belong to the other year', () => {
    // 2027-01-01 is a Friday, so it falls in the last ISO week of 2026.
    expect(isoWeekKey('2027-01-01')).toBe('2026-W53');
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
  });

  it('finds the Monday that starts a week, including from a Sunday', () => {
    expect(startOfIsoWeek('2026-09-02')).toBe('2026-08-31'); // Wed -> Mon
    expect(startOfIsoWeek('2026-08-31')).toBe('2026-08-31'); // Mon -> itself
    expect(startOfIsoWeek('2026-09-06')).toBe('2026-08-31'); // Sun -> same week's Mon
  });
});

describe('day boundary', () => {
  /**
   * Spec §9: the day starts at 04:00 by default, so a 01:00 completion counts
   * toward the previous day. Someone finishing a wind-down routine at half
   * past midnight has not skipped a day.
   */
  it('assigns after-midnight completions to the previous day', () => {
    const lateNight = new Date(2026, 8, 3, 1, 30); // 3 Sep, 01:30 local
    expect(localDateOf(lateNight, 4)).toBe('2026-09-02');
  });

  it('starts the new day once the boundary passes', () => {
    expect(localDateOf(new Date(2026, 8, 3, 4, 0), 4)).toBe('2026-09-03');
    expect(localDateOf(new Date(2026, 8, 3, 3, 59), 4)).toBe('2026-09-02');
  });

  it('behaves like plain midnight when the boundary is zero', () => {
    expect(localDateOf(new Date(2026, 8, 3, 0, 5), 0)).toBe('2026-09-03');
  });
});
