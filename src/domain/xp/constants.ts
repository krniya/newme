import type { Difficulty } from '../types';

/**
 * Every tunable number in the progression system lives here, and nowhere else.
 * Spec §5.2–§5.4.
 *
 * Changing any of these changes every user's history, because levels are
 * re-derived from the event log rather than stored (spec §8.2). The golden
 * table test in `goldenLevelTable.test.ts` exists so that a change always
 * shows up as a deliberate, reviewable diff.
 */

// --- Level curve -----------------------------------------------------------

/** Cumulative XP to reach level L is `LEVEL_CURVE_K * (L^LEVEL_CURVE_E - 1)`. */
export const LEVEL_CURVE_K = 6;
export const LEVEL_CURVE_E = 2.3;

/** Attributes receive only a share of total XP, so their curve is flatter. */
export const ATTR_CURVE_K = 2.5;

/** Hard ceiling. Level 100 is ~4.7 years of consistent use. */
export const MAX_LEVEL = 999;

// --- Base XP ---------------------------------------------------------------

export const BASE_XP: Record<Difficulty, number> = {
  trivial: 5,
  easy: 10,
  medium: 20,
  hard: 35,
  epic: 60,
};

// --- Multipliers -----------------------------------------------------------

/** Streak bonus is `1 + min(streak, STREAK_CAP_DAYS) * STREAK_STEP` -> max 1.60. */
export const STREAK_STEP = 0.02;
export const STREAK_CAP_DAYS = 30;

/** Item was in the day plan before the day began. Pre-commitment is the
 *  highest-leverage single behaviour in the app, so it pays the most. */
export const MULT_PLANNED_AHEAD = 1.15;
/** Completed inside the habit's declared time window. */
export const MULT_IN_WINDOW = 1.1;
/** Timer ran, photo attached, or auto-completed from Health. */
export const MULT_EVIDENCE = 1.1;
/** Momentum is in the Flow band. */
export const MULT_FLOW = 1.1;

/** Ceiling on the stacked ordinary multipliers. */
export const MAX_MULTIPLIER = 2.0;

/**
 * Rescue Mode (spec §5.6). Applied *after* MAX_MULTIPLIER, deliberately
 * exempt from it: the entire point is an outsized reward for the one action
 * that pulls a user out of a collapse.
 */
export const MULT_RESCUE = 3.0;

// --- Daily soft cap --------------------------------------------------------

/**
 * Anti-grind bands, applied to the running daily total of *raw* XP.
 * Ordered, contiguous, and the last band must be unbounded.
 */
export const DAILY_CAP_BANDS: readonly { readonly upTo: number; readonly rate: number }[] = [
  { upTo: 150, rate: 1.0 },
  { upTo: 300, rate: 0.5 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.1 },
];

// --- Gold ------------------------------------------------------------------

/** Gold is banked XP divided by this. Real completions are the only source. */
export const GOLD_DIVISOR = 5;

// --- Avatar tiers (spec §5.5) ---------------------------------------------

export const TIER_MIN_LEVEL = [1, 10, 20, 30, 40, 55, 75] as const;

export const TIER_NAMES = [
  'Ember',
  'Kindled',
  'Forged',
  'Tempered',
  'Ascendant',
  'Luminary',
  'Mythic',
] as const;
