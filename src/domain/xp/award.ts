import type { Difficulty, MomentumState } from '../types';
import {
  BASE_XP,
  GOLD_DIVISOR,
  MAX_MULTIPLIER,
  MULT_EVIDENCE,
  MULT_FLOW,
  MULT_IN_WINDOW,
  MULT_PLANNED_AHEAD,
  MULT_RESCUE,
  STREAK_CAP_DAYS,
  STREAK_STEP,
} from './constants';
import { applyDailyCap } from './dailyCap';

export interface AwardContext {
  /** Current streak on this habit, in days (or weeks for weekly habits). */
  streak: number;
  /** The item was in the day plan before the day started. */
  plannedAhead: boolean;
  /** Completed inside the habit's declared time window. */
  inWindow: boolean;
  /** Timer ran, photo attached, or auto-completed from Health. */
  hasEvidence: boolean;
  momentumState: MomentumState;
  /** Running total of raw XP already earned today, for the soft cap. */
  rawSoFarToday: number;
}

export interface Award {
  /** XP before the daily cap — what the user "earned". */
  raw: number;
  /** XP after the daily cap — what actually reaches the level bar. */
  banked: number;
  gold: number;
  /** The stacked multiplier, exposed so the UI can explain the number. */
  multiplier: number;
  /** Human-readable reasons, for the completion toast. */
  breakdown: { label: string; factor: number }[];
}

export const NO_AWARD: Award = { raw: 0, banked: 0, gold: 0, multiplier: 0, breakdown: [] };

export function streakMultiplier(streak: number): number {
  const capped = Math.min(Math.max(0, streak), STREAK_CAP_DAYS);
  return 1 + capped * STREAK_STEP;
}

/**
 * Compute the reward for completing a habit. Spec §5.2.
 *
 * Note the ordering: ordinary multipliers stack and are then clamped to
 * MAX_MULTIPLIER, and only afterwards is the Rescue Mode bonus applied. The
 * clamp exists to stop bonuses compounding without limit; Rescue Mode is
 * exempt on purpose, because an outsized reward for the single action that
 * ends a collapse is the entire mechanic (spec §5.6).
 */
export function awardXp(difficulty: Difficulty, ctx: AwardContext): Award {
  const base = BASE_XP[difficulty];
  const breakdown: { label: string; factor: number }[] = [];

  let multiplier = 1;

  const streakFactor = streakMultiplier(ctx.streak);
  if (streakFactor > 1) {
    multiplier *= streakFactor;
    breakdown.push({ label: `${Math.min(ctx.streak, STREAK_CAP_DAYS)}-day streak`, factor: streakFactor });
  }
  if (ctx.plannedAhead) {
    multiplier *= MULT_PLANNED_AHEAD;
    breakdown.push({ label: 'Planned ahead', factor: MULT_PLANNED_AHEAD });
  }
  if (ctx.inWindow) {
    multiplier *= MULT_IN_WINDOW;
    breakdown.push({ label: 'On time', factor: MULT_IN_WINDOW });
  }
  if (ctx.hasEvidence) {
    multiplier *= MULT_EVIDENCE;
    breakdown.push({ label: 'Evidence', factor: MULT_EVIDENCE });
  }
  if (ctx.momentumState === 'flow') {
    multiplier *= MULT_FLOW;
    breakdown.push({ label: 'In flow', factor: MULT_FLOW });
  }

  multiplier = Math.min(multiplier, MAX_MULTIPLIER);

  if (ctx.momentumState === 'dormant') {
    multiplier *= MULT_RESCUE;
    breakdown.push({ label: 'Back on the board', factor: MULT_RESCUE });
  }

  const raw = Math.round(base * multiplier);
  const banked = applyDailyCap(ctx.rawSoFarToday, raw);

  return { raw, banked, gold: Math.round(banked / GOLD_DIVISOR), multiplier, breakdown };
}

/**
 * Logging a negative habit. Spec §5.2.
 *
 * Zero XP and zero penalty, always. Progress in this app is monotonic — only
 * its rate changes (spec §5.1, constraint 3). Subtracting XP for a slip is
 * the mechanic that drives the what-the-hell effect and, in Habitica's case,
 * drives users away entirely. The cost of a negative habit is paid in
 * Momentum instead, where it is recoverable.
 */
export function awardForNegative(): Award {
  return NO_AWARD;
}
