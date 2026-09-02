import { describe, expect, it } from 'vitest';
import { awardForNegative, awardXp, streakMultiplier, type AwardContext } from './award';
import { applyDailyCap, currentCapRate } from './dailyCap';
import { BASE_XP, MAX_MULTIPLIER } from './constants';

const plain: AwardContext = {
  streak: 0,
  plannedAhead: false,
  inWindow: false,
  hasEvidence: false,
  momentumState: 'steady',
  rawSoFarToday: 0,
};

const ctx = (over: Partial<AwardContext> = {}): AwardContext => ({ ...plain, ...over });

describe('base XP', () => {
  it.each([
    ['trivial', 5],
    ['easy', 10],
    ['medium', 20],
    ['hard', 35],
    ['epic', 60],
  ] as const)('%s is worth %i with no bonuses', (difficulty, expected) => {
    const award = awardXp(difficulty, ctx());
    expect(award.raw).toBe(expected);
    expect(award.banked).toBe(expected);
    expect(award.multiplier).toBe(1);
  });
});

describe('streak multiplier', () => {
  it('grows 2% per day and caps at 1.6 after 30 days', () => {
    expect(streakMultiplier(0)).toBe(1);
    expect(streakMultiplier(1)).toBeCloseTo(1.02, 10);
    expect(streakMultiplier(30)).toBeCloseTo(1.6, 10);
    expect(streakMultiplier(365)).toBeCloseTo(1.6, 10);
  });

  it('plateaus deliberately, so streak pressure stops escalating', () => {
    // Spec §5.7: the cap is what stops a 300-day streak feeling irreplaceable.
    expect(streakMultiplier(31)).toBe(streakMultiplier(30));
  });

  it('treats a negative streak as zero rather than penalising', () => {
    expect(streakMultiplier(-5)).toBe(1);
  });
});

describe('stacked multipliers', () => {
  it('multiplies planned-ahead, in-window and evidence bonuses together', () => {
    const award = awardXp('medium', ctx({ plannedAhead: true, inWindow: true, hasEvidence: true }));
    // 20 * 1.15 * 1.10 * 1.10 = 27.83
    expect(award.multiplier).toBeCloseTo(1.15 * 1.1 * 1.1, 10);
    expect(award.raw).toBe(28);
  });

  it('clamps ordinary multipliers at 2.0', () => {
    const award = awardXp('epic', ctx({
      streak: 30,
      plannedAhead: true,
      inWindow: true,
      hasEvidence: true,
      momentumState: 'flow',
    }));
    // 1.6 * 1.15 * 1.1 * 1.1 * 1.1 = 2.45 -> clamped
    expect(award.multiplier).toBe(MAX_MULTIPLIER);
    expect(award.raw).toBe(BASE_XP.epic * 2);
  });

  it('explains itself, so the toast can show why the number is what it is', () => {
    const award = awardXp('easy', ctx({ streak: 10, plannedAhead: true }));
    expect(award.breakdown.map((b) => b.label)).toEqual(['10-day streak', 'Planned ahead']);
  });
});

describe('Rescue Mode', () => {
  it('pays triple and is exempt from the ordinary clamp', () => {
    const award = awardXp('easy', ctx({ momentumState: 'dormant' }));
    expect(award.multiplier).toBe(3);
    expect(award.raw).toBe(30);
  });

  it('stacks on top of an already-clamped multiplier', () => {
    const award = awardXp('easy', ctx({
      streak: 30,
      plannedAhead: true,
      inWindow: true,
      hasEvidence: true,
      momentumState: 'dormant',
    }));
    // Ordinary bonuses clamp to 2.0, then Rescue triples it.
    expect(award.multiplier).toBeCloseTo(6, 10);
  });

  it('does not also grant the flow bonus, since the states are exclusive', () => {
    const flow = awardXp('easy', ctx({ momentumState: 'flow' }));
    expect(flow.multiplier).toBeCloseTo(1.1, 10);
  });
});

describe('daily soft cap', () => {
  it('pays in full below 150 raw XP', () => {
    expect(applyDailyCap(0, 100)).toBe(100);
    expect(applyDailyCap(100, 50)).toBe(50);
  });

  it('halves XP between 150 and 300', () => {
    expect(applyDailyCap(150, 100)).toBe(50);
    expect(applyDailyCap(200, 100)).toBe(50);
  });

  it('pays a tenth beyond 300', () => {
    expect(applyDailyCap(300, 100)).toBe(10);
    expect(applyDailyCap(1000, 100)).toBe(10);
  });

  it('splits a single award across band boundaries', () => {
    // 100 raw starting at 100 -> 50 at full rate, 50 at half rate = 75.
    expect(applyDailyCap(100, 100)).toBe(75);
    // 400 raw from zero -> 150 + (150 * .5) + (100 * .1) = 235.
    expect(applyDailyCap(0, 400)).toBe(235);
  });

  it('is never a hard stop — grinding always earns something', () => {
    expect(applyDailyCap(10_000, 60)).toBeGreaterThan(0);
  });

  it('reports the current rate so the UI can show raw vs banked', () => {
    expect(currentCapRate(0)).toBe(1);
    expect(currentCapRate(149)).toBe(1);
    expect(currentCapRate(150)).toBe(0.5);
    expect(currentCapRate(300)).toBe(0.1);
  });

  it('ignores non-positive awards', () => {
    expect(applyDailyCap(0, 0)).toBe(0);
    expect(applyDailyCap(0, -20)).toBe(0);
  });
});

describe('gold', () => {
  it('is banked XP over 5, so the cap reduces gold too', () => {
    expect(awardXp('medium', ctx()).gold).toBe(4);
    expect(awardXp('medium', ctx({ rawSoFarToday: 400 })).gold).toBe(0);
  });
});

describe('negative habits', () => {
  it('cost nothing — progress is monotonic by design (spec §5.1)', () => {
    const award = awardForNegative();
    expect(award.raw).toBe(0);
    expect(award.banked).toBe(0);
    expect(award.gold).toBe(0);
  });
});

describe('invariants', () => {
  it('never awards negative XP or gold, across a wide sweep of inputs', () => {
    const states = ['flow', 'steady', 'fading', 'dormant'] as const;
    for (const difficulty of ['trivial', 'easy', 'medium', 'hard', 'epic'] as const) {
      for (const streak of [0, 1, 7, 30, 400]) {
        for (const state of states) {
          for (const soFar of [0, 149, 150, 299, 300, 5000]) {
            const award = awardXp(difficulty, ctx({ streak, momentumState: state, rawSoFarToday: soFar }));
            expect(award.raw).toBeGreaterThan(0);
            expect(award.banked).toBeGreaterThanOrEqual(0);
            expect(award.gold).toBeGreaterThanOrEqual(0);
            expect(award.banked).toBeLessThanOrEqual(award.raw);
          }
        }
      }
    }
  });
});
