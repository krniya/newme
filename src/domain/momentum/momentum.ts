import type { MomentumState } from '../types';

/**
 * Momentum — the anti-HP system. Spec §5.6.
 *
 * Habitica damages your avatar when you miss a Daily, which compounds a bad
 * week into a dead character and is its most-cited reason for quitting.
 * Momentum decays instead, and hitting the floor triggers *help* rather than
 * punishment (see `isRescueMode`).
 */

export const MOMENTUM_MIN = 0;
export const MOMENTUM_MAX = 100;
export const MOMENTUM_START = 60;

export const MOMENTUM_DELTA = {
  itemCompleted: 3,
  ritualCompleted: 8,
  itemMissed: -6,
  emptyDay: -10,
  negativeLogged: -2,
  recoveryQuest: 15,
} as const;

/** A single day can only cost this much, no matter how many items were missed. */
export const MAX_DAILY_MISS_PENALTY = -18;

export type MomentumEvent = keyof typeof MOMENTUM_DELTA;

export const MOMENTUM_BANDS: readonly { readonly min: number; readonly state: MomentumState }[] = [
  { min: 80, state: 'flow' },
  { min: 50, state: 'steady' },
  { min: 25, state: 'fading' },
  { min: 0, state: 'dormant' },
];

export function clampMomentum(value: number): number {
  return Math.max(MOMENTUM_MIN, Math.min(MOMENTUM_MAX, Math.round(value)));
}

export function momentumState(momentum: number): MomentumState {
  const value = clampMomentum(momentum);
  for (const band of MOMENTUM_BANDS) {
    if (value >= band.min) return band.state;
  }
  return 'dormant';
}

/**
 * Apply one day's worth of momentum events at once.
 *
 * Misses are aggregated and floored at MAX_DAILY_MISS_PENALTY before anything
 * else is applied, so a day where you overcommitted and missed nine items
 * costs the same as a day where you missed three. Over-scheduling is a
 * planning mistake; it should not read as a moral failure.
 */
export function applyDayMomentum(
  current: number,
  counts: Partial<Record<MomentumEvent, number>>,
): number {
  const missPenalty = Math.max(
    MAX_DAILY_MISS_PENALTY,
    (counts.itemMissed ?? 0) * MOMENTUM_DELTA.itemMissed,
  );

  let next = clampMomentum(current) + missPenalty;

  next += (counts.itemCompleted ?? 0) * MOMENTUM_DELTA.itemCompleted;
  next += (counts.ritualCompleted ?? 0) * MOMENTUM_DELTA.ritualCompleted;
  next += (counts.emptyDay ?? 0) * MOMENTUM_DELTA.emptyDay;
  next += (counts.negativeLogged ?? 0) * MOMENTUM_DELTA.negativeLogged;
  next += (counts.recoveryQuest ?? 0) * MOMENTUM_DELTA.recoveryQuest;

  return clampMomentum(next);
}

/** Rescue Mode: hide everything but one easy habit, worth triple. Spec §5.6. */
export function isRescueMode(momentum: number): boolean {
  return momentumState(momentum) === 'dormant';
}

/** Fading and Dormant both surface a Recovery Quest. */
export function needsRecoveryQuest(momentum: number): boolean {
  const state = momentumState(momentum);
  return state === 'fading' || state === 'dormant';
}

/**
 * While Dormant, streaks are frozen rather than broken, so a collapse cannot
 * cascade into losing everything at once (spec §5.6, step 4).
 */
export function streaksFrozen(momentum: number): boolean {
  return isRescueMode(momentum);
}
