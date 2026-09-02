import { describe, expect, it } from 'vitest';
import {
  AUTOMATICITY_PLATEAU_DAYS,
  automaticity,
  circularSpreadHours,
  isInternalised,
  timingConsistency,
} from './automaticity';

describe('timing consistency', () => {
  it('scores a perfectly regular habit at 1', () => {
    expect(timingConsistency([7, 7, 7, 7])).toBe(1);
  });

  it('scores a scattered habit near 0', () => {
    expect(timingConsistency([2, 9, 14, 21])).toBeLessThan(0.35);
  });

  /**
   * The midnight case. A habit done at 23:50 and 00:10 is twenty minutes
   * apart, but a naive standard deviation calls it twelve hours. Wind-down
   * routines land here constantly, so getting this wrong would punish
   * precisely the most consistent users.
   */
  it('treats times either side of midnight as close together', () => {
    expect(circularSpreadHours([23.83, 0.17, 23.9, 0.1])).toBeLessThan(1);
    expect(timingConsistency([23.83, 0.17, 23.9, 0.1])).toBeGreaterThan(0.75);
  });

  it('does not claim consistency it cannot know from one data point', () => {
    expect(circularSpreadHours([9])).toBe(0);
    expect(circularSpreadHours([])).toBe(0);
  });
});

describe('automaticity score', () => {
  it('is near zero for a brand-new, unreliable habit', () => {
    expect(automaticity({ adherence28: 0, daysSinceStart: 0, completionHours: [] })).toBeLessThan(25);
  });

  it('reaches 100 for a long-held, perfectly regular habit', () => {
    expect(
      automaticity({
        adherence28: 1,
        daysSinceStart: 120,
        completionHours: [7, 7, 7, 7, 7],
      }),
    ).toBe(100);
  });

  it('plateaus tenure at 66 days, per the Lally finding', () => {
    const at66 = automaticity({ adherence28: 0.8, daysSinceStart: 66, completionHours: [7, 7] });
    const at400 = automaticity({ adherence28: 0.8, daysSinceStart: 400, completionHours: [7, 7] });
    expect(at66).toBe(at400);
    expect(AUTOMATICITY_PLATEAU_DAYS).toBe(66);
  });

  /**
   * The claim that justifies replacing the streak counter (spec §3.6): a
   * habit held for ten weeks at 85% adherence is won, even though its streak
   * has certainly broken more than once.
   */
  it('rates a broken-streak-but-consistent habit as internalised', () => {
    const score = automaticity({
      adherence28: 0.85,
      daysSinceStart: 70,
      completionHours: [6.5, 7, 7.5, 6.75, 7.25],
    });
    expect(score).toBeGreaterThanOrEqual(70);
    expect(isInternalised(score)).toBe(true);
  });

  it('stays inside 0..100 for hostile inputs', () => {
    expect(automaticity({ adherence28: 5, daysSinceStart: 1e9, completionHours: [1] })).toBe(80);
    expect(automaticity({ adherence28: -3, daysSinceStart: -50, completionHours: [] })).toBe(0);
    expect(
      automaticity({ adherence28: Number.NaN, daysSinceStart: Number.NaN, completionHours: [] }),
    ).toBe(0);
  });

  it('withholds the timing component until there is evidence for it', () => {
    // One completion says nothing about regularity, so the timing fifth of
    // the score stays unearned — an out-of-range adherence and tenure can
    // therefore reach 80 at most, not 100.
    const noEvidence = automaticity({ adherence28: 1, daysSinceStart: 200, completionHours: [9] });
    const withEvidence = automaticity({
      adherence28: 1,
      daysSinceStart: 200,
      completionHours: [9, 9, 9],
    });
    expect(noEvidence).toBe(80);
    expect(withEvidence).toBe(100);
  });

  it('rises monotonically with adherence, all else equal', () => {
    let previous = -1;
    for (const adherence of [0, 0.25, 0.5, 0.75, 1]) {
      const score = automaticity({ adherence28: adherence, daysSinceStart: 30, completionHours: [8, 8] });
      expect(score).toBeGreaterThan(previous);
      previous = score;
    }
  });
});
