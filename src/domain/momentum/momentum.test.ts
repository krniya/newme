import { describe, expect, it } from 'vitest';
import {
  MAX_DAILY_MISS_PENALTY,
  MOMENTUM_START,
  applyDayMomentum,
  clampMomentum,
  isRescueMode,
  momentumState,
  needsRecoveryQuest,
  streaksFrozen,
} from './momentum';

describe('bands', () => {
  it.each([
    [100, 'flow'],
    [80, 'flow'],
    [79, 'steady'],
    [50, 'steady'],
    [49, 'fading'],
    [25, 'fading'],
    [24, 'dormant'],
    [0, 'dormant'],
  ] as const)('%i is %s', (value, state) => {
    expect(momentumState(value)).toBe(state);
  });

  it('starts a new character in Steady, with room to fall and to climb', () => {
    expect(momentumState(MOMENTUM_START)).toBe('steady');
  });
});

describe('clamping', () => {
  it('holds momentum within 0..100', () => {
    expect(clampMomentum(150)).toBe(100);
    expect(clampMomentum(-40)).toBe(0);
    expect(clampMomentum(63.6)).toBe(64);
  });
});

describe('daily application', () => {
  it('rewards completions and rituals', () => {
    expect(applyDayMomentum(60, { itemCompleted: 3 })).toBe(69);
    expect(applyDayMomentum(60, { ritualCompleted: 1 })).toBe(68);
  });

  /**
   * Spec §5.6: over-scheduling is a planning mistake, not a moral failure.
   * Nine misses must not cost three times what three misses cost.
   */
  it('floors the daily miss penalty regardless of how many were missed', () => {
    expect(applyDayMomentum(60, { itemMissed: 3 })).toBe(60 - 18);
    expect(applyDayMomentum(60, { itemMissed: 9 })).toBe(60 - 18);
    expect(applyDayMomentum(60, { itemMissed: 100 })).toBe(60 + MAX_DAILY_MISS_PENALTY);
  });

  it('lets completions offset misses on the same day', () => {
    // -12 for two misses, +9 for three completions.
    expect(applyDayMomentum(60, { itemMissed: 2, itemCompleted: 3 })).toBe(57);
  });

  it('costs a day of total silence', () => {
    expect(applyDayMomentum(60, { emptyDay: 1 })).toBe(50);
  });

  it('charges a negative habit to momentum, never to XP', () => {
    expect(applyDayMomentum(60, { negativeLogged: 2 })).toBe(56);
  });

  it('pays a Recovery Quest enough to leave Dormant in one step', () => {
    const after = applyDayMomentum(10, { recoveryQuest: 1, itemCompleted: 1 });
    expect(after).toBe(28);
    expect(momentumState(after)).toBe('fading');
  });

  it('cannot be driven below zero or above 100', () => {
    expect(applyDayMomentum(2, { itemMissed: 5 })).toBe(0);
    expect(applyDayMomentum(98, { itemCompleted: 10 })).toBe(100);
  });

  it('does nothing on a day with no events', () => {
    expect(applyDayMomentum(72, {})).toBe(72);
  });
});

describe('rescue', () => {
  it('engages only in the Dormant band', () => {
    expect(isRescueMode(10)).toBe(true);
    expect(isRescueMode(25)).toBe(false);
  });

  it('offers a Recovery Quest while Fading, before things collapse', () => {
    expect(needsRecoveryQuest(30)).toBe(true);
    expect(needsRecoveryQuest(10)).toBe(true);
    expect(needsRecoveryQuest(60)).toBe(false);
  });

  it('freezes streaks while Dormant', () => {
    expect(streaksFrozen(5)).toBe(true);
    expect(streaksFrozen(40)).toBe(false);
  });

  /**
   * The behavioural claim the whole mechanic rests on: a bad week must be
   * recoverable in one action, or the user quits instead of returning.
   */
  it('lets one easy completion start the climb back from the floor', () => {
    let momentum = 0;
    momentum = applyDayMomentum(momentum, { recoveryQuest: 1 });
    expect(momentum).toBe(15);
    momentum = applyDayMomentum(momentum, { itemCompleted: 4, ritualCompleted: 1 });
    expect(momentumState(momentum)).toBe('fading');
    momentum = applyDayMomentum(momentum, { itemCompleted: 5, ritualCompleted: 1 });
    expect(momentumState(momentum)).toBe('steady');
  });
});
