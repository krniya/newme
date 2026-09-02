import { describe, expect, it } from 'vitest';
import { levelFromXp, totalXpForLevel, xpForNextLevel } from './curve';

/**
 * GOLDEN FILE — spec §5.4.
 *
 * These numbers are the progression curve. Changing LEVEL_CURVE_K or
 * LEVEL_CURVE_E changes every user's level, retroactively, because levels are
 * re-derived from the event log rather than stored. This test exists so that
 * such a change can never happen by accident: it will always surface as an
 * explicit diff in review.
 *
 * If you are here because this test failed and you *meant* to retune the
 * curve: update the table, and note the change in the spec's §5.4 table too.
 */
const GOLDEN: readonly (readonly [level: number, cumulative: number, toNext: number])[] = [
  [1, 0, 24],
  [2, 24, 45],
  [3, 69, 71],
  [4, 140, 97],
  [5, 237, 127],
  [10, 1191, 294],
  [15, 3036, 487],
  [20, 5889, 701],
  [25, 9843, 930],
  [30, 14975, 1173],
  [40, 29027, 1696],
  [50, 48499, 2260],
  [75, 123245, 3813],
  [100, 238858, 5530],
];

describe('level curve (golden)', () => {
  it.each(GOLDEN)('level %i sits at %i XP and costs %i to advance', (level, cumulative, toNext) => {
    expect(totalXpForLevel(level)).toBe(cumulative);
    expect(xpForNextLevel(level)).toBe(toNext);
  });

  it('pins the headline pacing claims from the spec', () => {
    // ~80 XP/day early, ramping to ~140/day as streak multipliers grow.
    expect(totalXpForLevel(10)).toBeLessThan(80 * 21); // level 10 inside 3 weeks
    expect(totalXpForLevel(50)).toBeGreaterThan(120 * 300); // level 50 takes ~a year
    expect(totalXpForLevel(100)).toBeGreaterThan(140 * 365 * 3); // level 100 is multi-year
  });
});

describe('levelFromXp', () => {
  it('is the exact inverse of totalXpForLevel at every boundary', () => {
    // The closed-form inverse is off by one at boundaries because the forward
    // function rounds; level 10 at exactly 1191 XP is the canonical case.
    for (let level = 1; level <= 200; level++) {
      const floorXp = totalXpForLevel(level);
      expect(levelFromXp(floorXp)).toBe(level);
      if (level > 1) expect(levelFromXp(floorXp - 1)).toBe(level - 1);
      expect(levelFromXp(floorXp + 1)).toBe(level);
    }
  });

  it('pins the level-10 boundary that the naive closed form gets wrong', () => {
    expect(levelFromXp(1190)).toBe(9);
    expect(levelFromXp(1191)).toBe(10);
  });

  it('never returns below level 1', () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(-500)).toBe(1);
    expect(levelFromXp(Number.NaN)).toBe(1);
  });

  it('increases monotonically across a long sweep', () => {
    let previous = 1;
    for (let xp = 0; xp <= 250_000; xp += 137) {
      const level = levelFromXp(xp);
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });
});
