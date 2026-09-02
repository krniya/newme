import type { LevelProgress, Tier } from '../types';
import {
  ATTR_CURVE_K,
  LEVEL_CURVE_E,
  LEVEL_CURVE_K,
  MAX_LEVEL,
  TIER_MIN_LEVEL,
  TIER_NAMES,
} from './constants';

/**
 * The level curve. Spec §5.4.
 *
 *   totalXpForLevel(L) = round(K * (L^E - 1))
 *
 * K = 6, E = 2.3 puts level 10 at ~2 weeks, level 50 at ~13 months and
 * level 100 at ~4.7 years of consistent use.
 */

function curve(level: number, k: number): number {
  if (level <= 1) return 0;
  return Math.round(k * (Math.pow(level, LEVEL_CURVE_E) - 1));
}

/** Cumulative XP required to *reach* `level`. Level 1 costs nothing. */
export function totalXpForLevel(level: number): number {
  return curve(level, LEVEL_CURVE_K);
}

/** XP required to span `level`, i.e. to get from `level` to `level + 1`. */
export function xpForNextLevel(level: number): number {
  return totalXpForLevel(level + 1) - totalXpForLevel(level);
}

/**
 * Invert the curve.
 *
 * The closed form `(xp / K + 1) ^ (1 / E)` is only an approximation, because
 * `totalXpForLevel` rounds. At exact level boundaries floating point lands a
 * hair under the integer and floors to the wrong level — level 10 sits at
 * exactly 1191 XP but the closed form yields 9.99966. So we seed with the
 * closed form and then walk, which costs at most a step or two and is exact
 * by construction.
 */
export function levelFromXp(xpTotal: number): number {
  if (!Number.isFinite(xpTotal) || xpTotal <= 0) return 1;

  let level = Math.floor(Math.pow(xpTotal / LEVEL_CURVE_K + 1, 1 / LEVEL_CURVE_E));
  if (!Number.isFinite(level) || level < 1) level = 1;

  while (level < MAX_LEVEL && totalXpForLevel(level + 1) <= xpTotal) level++;
  while (level > 1 && totalXpForLevel(level) > xpTotal) level--;

  return level;
}

/** Everything the UI needs to draw a level bar, derived once. */
export function levelProgress(xpTotal: number): LevelProgress {
  const level = levelFromXp(xpTotal);
  const floorXp = totalXpForLevel(level);
  const xpForLevel = xpForNextLevel(level);
  const xpIntoLevel = Math.max(0, xpTotal - floorXp);

  return {
    level,
    xpIntoLevel,
    xpForLevel,
    fraction: xpForLevel > 0 ? Math.min(1, xpIntoLevel / xpForLevel) : 0,
  };
}

// --- Attributes ------------------------------------------------------------

export function totalXpForAttributeLevel(level: number): number {
  return curve(level, ATTR_CURVE_K);
}

export function attributeLevelFromXp(xpTotal: number): number {
  if (!Number.isFinite(xpTotal) || xpTotal <= 0) return 1;

  let level = Math.floor(Math.pow(xpTotal / ATTR_CURVE_K + 1, 1 / LEVEL_CURVE_E));
  if (!Number.isFinite(level) || level < 1) level = 1;

  while (level < MAX_LEVEL && totalXpForAttributeLevel(level + 1) <= xpTotal) level++;
  while (level > 1 && totalXpForAttributeLevel(level) > xpTotal) level--;

  return level;
}

// --- Tiers -----------------------------------------------------------------

/** Avatar tier for a level, 1–7. Spec §5.5. */
export function tierForLevel(level: number): Tier {
  let tier = 1;
  for (let i = 0; i < TIER_MIN_LEVEL.length; i++) {
    if (level >= (TIER_MIN_LEVEL[i] as number)) tier = i + 1;
  }
  return tier as Tier;
}

export function tierName(tier: Tier): string {
  return TIER_NAMES[tier - 1] ?? TIER_NAMES[0];
}

/** The level at which the next tier unlocks, or `null` at the final tier. */
export function nextTierLevel(level: number): number | null {
  for (const min of TIER_MIN_LEVEL) {
    if (level < min) return min;
  }
  return null;
}
