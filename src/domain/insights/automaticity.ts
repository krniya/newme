/**
 * The automaticity meter. Spec §10.4.
 *
 * After roughly day 60 this replaces the streak counter as the headline
 * metric on a habit (spec §3.6). A habit at day 70 with 85% adherence is won,
 * even if the streak broke twice — and saying so is the whole point: it
 * defuses the all-or-nothing thinking that streak counters encourage.
 *
 * Grounded in Lally et al. (UCL), who found automaticity plateaus at a median
 * of ~66 days.
 */

export const AUTOMATICITY_PLATEAU_DAYS = 66;

export const AUTOMATICITY_WEIGHTS = {
  adherence: 0.5,
  tenure: 0.3,
  timing: 0.2,
} as const;

/** Timing spread at or beyond this many hours scores zero for consistency. */
export const TIMING_SPREAD_CAP_HOURS = 4;

export interface AutomaticityInput {
  /** Completions ÷ scheduled occurrences over the last 28 days, 0–1. */
  adherence28: number;
  /** Days since the habit was created. */
  daysSinceStart: number;
  /** Hour-of-day (0–24, fractional) for recent completions. */
  completionHours: number[];
}

/**
 * Population standard deviation, in hours, of time-of-day.
 *
 * Computed on the unit circle rather than on raw hours, because a habit done
 * at 23:50 and 00:10 is extremely consistent but has a naive stdev of ~12
 * hours. Midnight-spanning habits are common (wind-down routines), so the
 * naive version would systematically punish exactly the users being most
 * consistent.
 */
export function circularSpreadHours(hours: number[]): number {
  if (hours.length < 2) return 0;

  let sumSin = 0;
  let sumCos = 0;
  for (const h of hours) {
    const angle = (h / 24) * 2 * Math.PI;
    sumSin += Math.sin(angle);
    sumCos += Math.cos(angle);
  }

  const meanResultant = Math.sqrt(sumSin ** 2 + sumCos ** 2) / hours.length;
  if (meanResultant >= 1) return 0;

  // Circular standard deviation, converted from radians back to hours.
  const circularStdRadians = Math.sqrt(-2 * Math.log(Math.max(meanResultant, 1e-12)));
  return (circularStdRadians / (2 * Math.PI)) * 24;
}

export function timingConsistency(hours: number[]): number {
  // Fewer than two completions tells us nothing about regularity. Scoring
  // that as perfect consistency would hand a brand-new habit a fifth of the
  // automaticity meter for free, which is exactly backwards.
  if (hours.length < 2) return 0;

  const spread = Math.min(circularSpreadHours(hours), TIMING_SPREAD_CAP_HOURS);
  return 1 - spread / TIMING_SPREAD_CAP_HOURS;
}

/** 0–100. */
export function automaticity(input: AutomaticityInput): number {
  const adherence = clamp01(input.adherence28);
  const tenure = clamp01(input.daysSinceStart / AUTOMATICITY_PLATEAU_DAYS);
  const timing = clamp01(timingConsistency(input.completionHours));

  const score =
    AUTOMATICITY_WEIGHTS.adherence * adherence +
    AUTOMATICITY_WEIGHTS.tenure * tenure +
    AUTOMATICITY_WEIGHTS.timing * timing;

  return Math.round(clamp01(score) * 100);
}

/**
 * Once a habit is this automatic, the UI stops leading with the streak and
 * starts leading with identity ("you have been someone who runs, for four
 * months"). Spec §3.6, Internalisation phase.
 */
export const INTERNALISED_THRESHOLD = 70;

export function isInternalised(score: number): boolean {
  return score >= INTERNALISED_THRESHOLD;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
