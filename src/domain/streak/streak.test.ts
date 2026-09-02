import { describe, expect, it } from 'vitest';
import type { Schedule } from '../types';
import { canRepair, repairCost, resolveStreak } from './streak';

const everyDay: Schedule = { type: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] };
const weekdaysOnly: Schedule = { type: 'weekdays', days: [1, 2, 3, 4, 5] };
const threeAWeek: Schedule = { type: 'times_per_week', times: 3 };

describe('daily streaks', () => {
  it('counts consecutive scheduled completions', () => {
    const result = resolveStreak({
      schedule: everyDay,
      completions: ['2026-09-01', '2026-09-02', '2026-09-03'],
      from: '2026-09-01',
      to: '2026-09-03',
      streak: 0,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(3);
    expect(result.breaks).toEqual([]);
  });

  it('breaks on a missed scheduled day when no freeze is held', () => {
    const result = resolveStreak({
      schedule: everyDay,
      completions: ['2026-09-01', '2026-09-03'],
      from: '2026-09-01',
      to: '2026-09-03',
      streak: 0,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(1);
    expect(result.breaks).toEqual([{ date: '2026-09-02', lostStreak: 1 }]);
  });

  /** The core reason flexible scheduling exists: an unscheduled day is not a miss. */
  it('never breaks on a day the habit was not scheduled', () => {
    const result = resolveStreak({
      schedule: weekdaysOnly,
      // Fri 4th, then Mon 7th. The weekend is skipped, not failed.
      completions: ['2026-09-04', '2026-09-07'],
      from: '2026-09-04',
      to: '2026-09-07',
      streak: 10,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(12);
    expect(result.breaks).toEqual([]);
  });

  it('spends a freeze token to survive a miss', () => {
    const result = resolveStreak({
      schedule: everyDay,
      completions: ['2026-09-01', '2026-09-03'],
      from: '2026-09-01',
      to: '2026-09-03',
      streak: 10, // deliberately not near a multiple of 7, so no token is earned
      freezeTokens: 1,
    });
    expect(result.streak).toBe(12);
    expect(result.freezeTokens).toBe(0);
    expect(result.freezesConsumed).toEqual(['2026-09-02']);
    expect(result.breaks).toEqual([]);
  });

  it('can spend a token earned earlier in the same evaluation', () => {
    // Crossing day 21 earns a freeze, which the very next miss then spends.
    // Worth pinning: it means a user who has just hit a 7-day milestone is
    // protected immediately, not from the next evaluation onwards.
    const result = resolveStreak({
      schedule: everyDay,
      completions: ['2026-09-01', '2026-09-03'],
      from: '2026-09-01',
      to: '2026-09-03',
      streak: 20,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(22);
    expect(result.freezesConsumed).toEqual(['2026-09-02']);
    expect(result.freezeTokens).toBe(0);
    expect(result.breaks).toEqual([]);
  });

  it('earns a freeze every 7 days, holding at most 3', () => {
    const completions = Array.from({ length: 28 }, (_, i) =>
      `2026-09-${String(i + 1).padStart(2, '0')}`,
    );
    const result = resolveStreak({
      schedule: everyDay,
      completions,
      from: '2026-09-01',
      to: '2026-09-28',
      streak: 0,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(28);
    expect(result.freezeTokens).toBe(3); // 4 earned, capped at 3
  });

  /** Spec §5.6 step 4: a collapse must not cascade into losing every streak. */
  it('freezes streaks entirely while momentum is Dormant', () => {
    const result = resolveStreak({
      schedule: everyDay,
      completions: ['2026-09-01'],
      from: '2026-09-01',
      to: '2026-09-05',
      streak: 40,
      freezeTokens: 0,
      dormantDates: ['2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'],
    });
    expect(result.streak).toBe(41);
    expect(result.breaks).toEqual([]);
    expect(result.freezeTokens).toBe(0); // dormancy is free, it costs no tokens
  });

  it('records what was lost, so the repair offer can name a real number', () => {
    const result = resolveStreak({
      schedule: everyDay,
      completions: [],
      from: '2026-09-02',
      to: '2026-09-02',
      streak: 31,
      freezeTokens: 0,
    });
    expect(result.breaks).toEqual([{ date: '2026-09-02', lostStreak: 31 }]);
    expect(result.longestSeen).toBe(31);
  });

  it('is idempotent — re-running the same range changes nothing', () => {
    const input = {
      schedule: everyDay,
      completions: ['2026-09-01', '2026-09-02'],
      from: '2026-09-01' as const,
      to: '2026-09-02' as const,
      streak: 5,
      freezeTokens: 1,
    };
    expect(resolveStreak(input)).toEqual(resolveStreak(input));
  });

  it('does nothing for a reversed range', () => {
    const result = resolveStreak({
      schedule: everyDay,
      completions: [],
      from: '2026-09-05',
      to: '2026-09-01',
      streak: 9,
      freezeTokens: 2,
    });
    expect(result.streak).toBe(9);
    expect(result.freezeTokens).toBe(2);
  });
});

describe('weekly streaks', () => {
  it('counts a week as met once the target is reached, on any days', () => {
    const result = resolveStreak({
      schedule: threeAWeek,
      // Mon/Wed/Fri of the week beginning 31 Aug 2026.
      completions: ['2026-08-31', '2026-09-02', '2026-09-04'],
      from: '2026-08-31',
      to: '2026-09-06',
      streak: 0,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(1);
    expect(result.breaks).toEqual([]);
  });

  it('breaks when a week falls short of its target', () => {
    const result = resolveStreak({
      schedule: threeAWeek,
      completions: ['2026-08-31', '2026-09-02'], // only 2 of 3
      from: '2026-08-31',
      to: '2026-09-06',
      streak: 4,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(0);
    expect(result.breaks).toHaveLength(1);
  });

  it('counts across several weeks', () => {
    const result = resolveStreak({
      schedule: threeAWeek,
      completions: [
        '2026-08-31', '2026-09-02', '2026-09-04',
        '2026-09-07', '2026-09-09', '2026-09-11',
      ],
      from: '2026-08-31',
      to: '2026-09-13',
      streak: 0,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(2);
  });

  it('does not punish a weekend-heavy pattern', () => {
    const result = resolveStreak({
      schedule: threeAWeek,
      completions: ['2026-09-04', '2026-09-05', '2026-09-06'], // Fri, Sat, Sun
      from: '2026-08-31',
      to: '2026-09-06',
      streak: 0,
      freezeTokens: 0,
    });
    expect(result.streak).toBe(1);
  });
});

describe('repair', () => {
  it('scales cost with the size of what was lost', () => {
    expect(repairCost(1)).toBe(50);
    expect(repairCost(10)).toBe(50);
    expect(repairCost(11)).toBe(100);
    expect(repairCost(31)).toBe(200);
  });

  it('stays open for 48 hours and then closes', () => {
    const brokenAt = Date.UTC(2026, 8, 2, 12, 0);
    expect(canRepair(brokenAt, brokenAt + 1_000)).toBe(true);
    expect(canRepair(brokenAt, brokenAt + 47 * 3_600_000)).toBe(true);
    expect(canRepair(brokenAt, brokenAt + 49 * 3_600_000)).toBe(false);
  });
});
