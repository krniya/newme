import { describe, expect, it } from 'vitest';
import type { Attribute, Difficulty } from '../types';
import { addDays } from '../time/localDate';
import { reduceEvents } from './reducer';
import { selectLevel } from './state';
import type { DomainEvent, StreakOutcome } from './types';
import { makeCompleted, makeDayClosed, makeNegative, makeRitual } from './testFactory';

/**
 * Replay performance. Spec §8.2.
 *
 * `rebuildProjections()` runs on every schema bump, on every import, and
 * after every undo. If it is slow, the app stutters at exactly the moments a
 * user is most anxious about their data — restoring a backup, or undoing a
 * mistap. The budget is <1s for roughly three years of heavy use.
 *
 * This doubles as a determinism check at scale: the same generated log must
 * fold to the same state twice.
 */

/**
 * A realistic difficulty mix. Sampling uniformly would make every fifth habit
 * Epic, which no real habit list looks like — it inflates a simulated year by
 * roughly ten levels and would make the pacing assertion below meaningless.
 * Cumulative weights: trivial .15, easy .55, medium .85, hard .97, epic 1.0.
 */
const DIFFICULTY_MIX: readonly (readonly [Difficulty, number])[] = [
  ['trivial', 0.15],
  ['easy', 0.55],
  ['medium', 0.85],
  ['hard', 0.97],
  ['epic', 1.0],
];

function pickDifficulty(roll: number): Difficulty {
  for (const [difficulty, ceiling] of DIFFICULTY_MIX) {
    if (roll < ceiling) return difficulty;
  }
  return 'easy';
}

const ATTRS: Attribute[] = ['vitality', 'focus', 'discipline', 'spirit', 'bond'];

/** Seeded LCG, so the benchmark measures the reducer and not the generator. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function generateLog(days: number, habitsPerDay: number): DomainEvent[] {
  const rand = lcg(42);
  const events: DomainEvent[] = [];
  let date = '2024-01-01';
  let n = 0;

  for (let d = 0; d < days; d++) {
    const outcomes: StreakOutcome[] = [];

    for (let h = 0; h < habitsPerDay; h++) {
      const habitId = `h${h}`;
      const skip = rand() < 0.15; // a realistic ~85% adherence
      if (skip) continue;

      events.push(
        makeCompleted({
          id: `e${n++}`,
          habitId,
          localDate: date,
          minute: d * 1440 + h * 30,
          difficulty: pickDifficulty(rand()),
          attributes: [ATTRS[Math.floor(rand() * ATTRS.length)]!],
          plannedAhead: rand() < 0.6,
          inWindow: rand() < 0.7,
          scheduledToday: true,
        }),
      );

      outcomes.push({
        habitId,
        streak: d + 1,
        longestStreak: d + 1,
        freezeConsumed: false,
        freezeEarned: false,
        broke: false,
      });
    }

    if (d % 7 === 3) {
      events.push(makeRitual({ id: `e${n++}`, localDate: date, minute: d * 1440 + 5 }));
    }
    if (rand() < 0.1) {
      events.push(makeNegative({ id: `e${n++}`, localDate: date, minute: d * 1440 + 900 }));
    }

    events.push(
      makeDayClosed({
        id: `e${n++}`,
        date,
        minute: d * 1440 + 1439,
        missedCount: habitsPerDay - outcomes.length,
        wasEmpty: outcomes.length === 0,
        streakOutcomes: outcomes,
      }),
    );

    date = addDays(date, 1);
  }

  return events;
}

describe('replay performance', () => {
  it('folds ~3 years of heavy use in under a second', () => {
    // 1095 days x 12 habits ~= 12k completions plus rituals and day closures.
    const log = generateLog(1095, 12);
    expect(log.length).toBeGreaterThan(11_000);

    const started = performance.now();
    const state = reduceEvents(log);
    const elapsed = performance.now() - started;

    expect(state.eventCount).toBe(log.length);
    expect(selectLevel(state).level).toBeGreaterThan(1);
    expect(elapsed).toBeLessThan(1000);
  });

  it('folds a 50k-event log within budget', () => {
    const log = generateLog(1095, 50);
    expect(log.length).toBeGreaterThan(45_000);

    const started = performance.now();
    const state = reduceEvents(log);
    const elapsed = performance.now() - started;

    expect(state.eventCount).toBe(log.length);
    expect(elapsed).toBeLessThan(1000);
  });

  it('stays deterministic at scale', () => {
    const log = generateLog(365, 8);
    expect(reduceEvents(log)).toEqual(reduceEvents(log));
  });

  it('produces a plausible character after a year of real use', () => {
    // 6 habits a day at ~85% adherence is a realistic committed user.
    const state = reduceEvents(generateLog(365, 6));
    const level = selectLevel(state).level;

    // Spec §5.4 pacing: level 50 at ~13 months. A year of moderate use should
    // land in the 30s or 40s — high enough to feel earned, short of the
    // headline claim, which assumes more habits and longer streaks.
    expect(level).toBeGreaterThan(25);
    expect(level).toBeLessThan(55);
  });
});
