import { describe, expect, it } from 'vitest';
import {
  attributeLevelFromXp,
  levelProgress,
  nextTierLevel,
  tierForLevel,
  tierName,
  totalXpForAttributeLevel,
  totalXpForLevel,
} from './curve';

describe('levelProgress', () => {
  it('reports zero progress at a level floor', () => {
    const p = levelProgress(totalXpForLevel(20));
    expect(p.level).toBe(20);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.fraction).toBe(0);
    expect(p.xpForLevel).toBe(701);
  });

  it('reports partial progress inside a level', () => {
    const p = levelProgress(totalXpForLevel(20) + 350);
    expect(p.level).toBe(20);
    expect(p.xpIntoLevel).toBe(350);
    expect(p.fraction).toBeCloseTo(350 / 701, 5);
  });

  it('keeps fraction within 0..1 for every level up to 150', () => {
    for (let level = 1; level <= 150; level++) {
      const justBeforeNext = totalXpForLevel(level + 1) - 1;
      const p = levelProgress(justBeforeNext);
      expect(p.level).toBe(level);
      expect(p.fraction).toBeGreaterThanOrEqual(0);
      expect(p.fraction).toBeLessThan(1);
    }
  });

  it('starts a fresh character at level 1 with nothing banked', () => {
    const p = levelProgress(0);
    expect(p.level).toBe(1);
    expect(p.xpIntoLevel).toBe(0);
    expect(p.xpForLevel).toBe(24);
  });
});

describe('attribute curve', () => {
  it('is flatter than the character curve, since attributes get a share of XP', () => {
    for (const level of [5, 10, 20, 40]) {
      expect(totalXpForAttributeLevel(level)).toBeLessThan(totalXpForLevel(level));
    }
  });

  it('inverts exactly at every boundary', () => {
    for (let level = 1; level <= 100; level++) {
      const floorXp = totalXpForAttributeLevel(level);
      expect(attributeLevelFromXp(floorXp)).toBe(level);
      if (level > 1) expect(attributeLevelFromXp(floorXp - 1)).toBe(level - 1);
    }
  });
});

describe('avatar tiers', () => {
  it.each([
    [1, 1, 'Ember'],
    [9, 1, 'Ember'],
    [10, 2, 'Kindled'],
    [19, 2, 'Kindled'],
    [20, 3, 'Forged'],
    [30, 4, 'Tempered'],
    [40, 5, 'Ascendant'],
    [54, 5, 'Ascendant'],
    [55, 6, 'Luminary'],
    [75, 7, 'Mythic'],
    [200, 7, 'Mythic'],
  ])('level %i is tier %i (%s)', (level, tier, name) => {
    expect(tierForLevel(level)).toBe(tier);
    expect(tierName(tierForLevel(level))).toBe(name);
  });

  it('points at the next tier threshold, and at nothing past the last', () => {
    expect(nextTierLevel(1)).toBe(10);
    expect(nextTierLevel(23)).toBe(30);
    expect(nextTierLevel(74)).toBe(75);
    expect(nextTierLevel(75)).toBeNull();
  });

  it('never decreases as level rises', () => {
    let previous = 1;
    for (let level = 1; level <= 200; level++) {
      const tier = tierForLevel(level);
      expect(tier).toBeGreaterThanOrEqual(previous);
      previous = tier;
    }
  });
});
