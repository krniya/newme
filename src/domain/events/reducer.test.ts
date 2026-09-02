import { describe, expect, it } from 'vitest';
import { applyEvent, reduceEvents } from './reducer';
import { emptyState, selectAttributes, selectDominantAttribute, selectLevel } from './state';
import { compareEvents, requiresRebuild, type DomainEvent } from './types';
import { makeCompleted, makeDayClosed, makeNegative, makeRepaired, makeReward, makeRitual, makeUncompleted } from './testFactory';

describe('habit.completed', () => {
  it('awards XP, gold, attribute XP and momentum', () => {
    const state = reduceEvents([
      makeCompleted({ difficulty: 'medium', attributes: ['focus'] }),
    ]);

    expect(state.xpTotal).toBe(20);
    expect(state.gold).toBe(4);
    expect(state.attributeXp.focus).toBe(20);
    expect(state.momentum).toBe(63);
    expect(state.eventCount).toBe(1);
  });

  it('credits every tagged attribute in full — they are a lens, not a budget', () => {
    const state = reduceEvents([
      makeCompleted({ difficulty: 'hard', attributes: ['vitality', 'spirit'] }),
    ]);

    expect(state.xpTotal).toBe(35);
    expect(state.attributeXp.vitality).toBe(35);
    expect(state.attributeXp.spirit).toBe(35);
  });

  it('applies the daily cap across a long day', () => {
    /**
     * Ten epic habits. Two mechanics interact here, and the interaction is
     * the point of the test:
     *
     *   - Momentum rises +3 per completion, so it crosses 80 into Flow on the
     *     8th. The last three then earn the 1.1x Flow bonus: 66 raw, not 60.
     *     Hence 7*60 + 3*66 = 618 raw, not a flat 600.
     *   - The daily cap bites at the same time, so those richer awards are
     *     landing in the 10% band and bank ~7 each.
     *
     * Net: a very productive day is rewarded, but with sharply diminishing
     * returns rather than a hard stop (spec §5.2).
     */
    const events = Array.from({ length: 10 }, (_, i) =>
      makeCompleted({ id: `e${i}`, habitId: `h${i}`, difficulty: 'epic', minute: i }),
    );
    const state = reduceEvents(events);

    expect(state.daily['2026-09-02']!.rawXp).toBe(618);
    expect(state.xpTotal).toBe(258);
    expect(state.momentum).toBe(90);
  });

  it('keeps the cap honest: banked never exceeds raw, over any single day', () => {
    for (const count of [1, 5, 12, 40]) {
      const state = reduceEvents(
        Array.from({ length: count }, (_, i) =>
          makeCompleted({ id: `e${i}`, habitId: `h${i}`, difficulty: 'hard', minute: i }),
        ),
      );
      const day = state.daily['2026-09-02']!;
      expect(day.bankedXp).toBeLessThanOrEqual(day.rawXp);
      expect(state.xpTotal).toBe(day.bankedXp);
    }
  });

  it('compounds the streak multiplier as a run builds', () => {
    const events = Array.from({ length: 3 }, (_, i) =>
      makeCompleted({ id: `e${i}`, difficulty: 'easy', minute: i, scheduledToday: true }),
    );
    const state = reduceEvents(events);

    // 10 + round(10*1.02) + round(10*1.04) = 10 + 10 + 10 = 30, streak 3.
    expect(state.habits.h1!.streak).toBe(3);
    expect(state.habits.h1!.totalCompletions).toBe(3);
    expect(state.xpTotal).toBe(30);
  });

  it('does not advance the streak for an unscheduled completion', () => {
    const state = reduceEvents([makeCompleted({ scheduledToday: false })]);
    expect(state.habits.h1!.streak).toBe(0);
    expect(state.habits.h1!.totalCompletions).toBe(1);
  });

  it('does not advance a weekly habit daily — those streak in weeks', () => {
    const state = reduceEvents([
      makeCompleted({ id: 'a', minute: 0, scheduledToday: true, weeklyStreak: true }),
      makeCompleted({ id: 'b', minute: 1, scheduledToday: true, weeklyStreak: true }),
    ]);
    expect(state.habits.h1!.streak).toBe(0);
    expect(state.habits.h1!.totalCompletions).toBe(2);
  });

  it('earns a freeze token every seventh day', () => {
    const events = Array.from({ length: 7 }, (_, i) =>
      makeCompleted({ id: `e${i}`, minute: i, scheduledToday: true }),
    );
    expect(reduceEvents(events).freezeTokens).toBe(1);
  });

  it('snapshots difficulty, so editing a habit cannot inflate old history', () => {
    // Both events name the same habit; the second was genuinely harder.
    const state = reduceEvents([
      makeCompleted({ id: 'a', minute: 0, difficulty: 'trivial' }),
      makeCompleted({ id: 'b', minute: 1, difficulty: 'epic' }),
    ]);
    expect(state.xpTotal).toBe(5 + 60);
  });
});

describe('Rescue Mode through the reducer', () => {
  it('pays triple once momentum has collapsed', () => {
    const state = reduceEvents([
      // Drive momentum to the floor: 60 - 18 - 10 = 32, then again to 4.
      makeDayClosed({ id: 'd1', date: '2026-09-01', minute: 0, missedCount: 9, wasEmpty: true }),
      makeDayClosed({ id: 'd2', date: '2026-09-02', minute: 1, missedCount: 9, wasEmpty: true }),
      makeCompleted({ id: 'c', minute: 2, difficulty: 'easy' }),
    ]);

    // 10 base * 3.0 Rescue = 30.
    expect(state.xpTotal).toBe(30);
  });
});

describe('day.closed', () => {
  it('floors the miss penalty however many were missed', () => {
    const three = reduceEvents([makeDayClosed({ missedCount: 3 })]);
    const nine = reduceEvents([makeDayClosed({ missedCount: 9 })]);
    expect(three.momentum).toBe(42);
    expect(nine.momentum).toBe(42);
  });

  it('overwrites the optimistic in-day streak with the rollover verdict', () => {
    const state = reduceEvents([
      makeCompleted({ id: 'a', minute: 0, scheduledToday: true }),
      makeDayClosed({
        id: 'b',
        minute: 1,
        streakOutcomes: [
          { habitId: 'h1', streak: 12, longestStreak: 12, freezeConsumed: false, freezeEarned: false, broke: false },
        ],
      }),
    ]);
    expect(state.habits.h1!.streak).toBe(12);
  });

  it('records a break so the repair window can open', () => {
    const state = reduceEvents([
      makeDayClosed({
        streakOutcomes: [
          { habitId: 'h1', streak: 0, longestStreak: 31, freezeConsumed: false, freezeEarned: false, broke: true },
        ],
      }),
    ]);
    expect(state.habits.h1!.streak).toBe(0);
    expect(state.habits.h1!.longestStreak).toBe(31);
    expect(state.habits.h1!.brokenAt).not.toBeNull();
  });

  it('spends a freeze token when the rollover used one', () => {
    const state = reduceEvents([
      ...Array.from({ length: 7 }, (_, i) =>
        makeCompleted({ id: `e${i}`, minute: i, scheduledToday: true }),
      ),
      makeDayClosed({
        id: 'close',
        minute: 10,
        streakOutcomes: [
          { habitId: 'h1', streak: 8, longestStreak: 8, freezeConsumed: true, freezeEarned: false, broke: false },
        ],
      }),
    ]);
    expect(state.freezeTokens).toBe(0);
  });
});

describe('negative habits and rituals', () => {
  it('charges a negative habit to momentum and never to XP', () => {
    const state = reduceEvents([
      makeCompleted({ id: 'a', minute: 0, difficulty: 'medium' }),
      makeNegative({ id: 'b', minute: 1 }),
    ]);
    expect(state.xpTotal).toBe(20);
    expect(state.momentum).toBe(61); // +3 then -2
  });

  it('pays momentum for finishing a whole ritual', () => {
    const state = reduceEvents([makeRitual({})]);
    expect(state.momentum).toBe(68);
    expect(state.xpTotal).toBe(0); // member habits carry the XP
  });
});

describe('gold spending', () => {
  it('deducts a streak repair and restores the streak', () => {
    const state = reduceEvents([
      ...Array.from({ length: 20 }, (_, i) =>
        makeCompleted({ id: `e${i}`, minute: i, difficulty: 'medium' }),
      ),
      makeRepaired({ id: 'r', minute: 30, goldSpent: 100, restoredTo: 31 }),
    ]);
    expect(state.habits.h1!.streak).toBe(31);
    expect(state.habits.h1!.brokenAt).toBeNull();
    expect(state.gold).toBeGreaterThanOrEqual(0);
  });

  it('never lets gold go negative', () => {
    const state = reduceEvents([makeReward({ goldSpent: 9999 })]);
    expect(state.gold).toBe(0);
  });
});

describe('undo', () => {
  it('erases a completion entirely rather than subtracting XP', () => {
    const done = makeCompleted({ id: 'target', difficulty: 'epic' });
    const state = reduceEvents([done, makeUncompleted({ id: 'undo', minute: 1, targetEventId: 'target' })]);

    expect(state.xpTotal).toBe(0);
    expect(state.gold).toBe(0);
    expect(state.attributeXp.focus).toBe(0);
    expect(state.habits.h1).toBeUndefined();
  });

  /** The undone completion must not linger in the daily cap either. */
  it('frees the daily-cap headroom the undone completion had used', () => {
    const big = makeCompleted({ id: 'big', difficulty: 'epic', minute: 0 });
    const withBig = reduceEvents([big, makeCompleted({ id: 'after', minute: 1, difficulty: 'epic' })]);
    const undone = reduceEvents([
      big,
      makeUncompleted({ id: 'u', minute: 2, targetEventId: 'big' }),
      makeCompleted({ id: 'after', minute: 1, difficulty: 'epic' }),
    ]);

    expect(withBig.daily['2026-09-02']!.rawXp).toBe(120);
    expect(undone.daily['2026-09-02']!.rawXp).toBe(60);
  });

  it('is flagged as needing a rebuild rather than an incremental fold', () => {
    expect(requiresRebuild(makeUncompleted({ targetEventId: 'x' }))).toBe(true);
    expect(requiresRebuild(makeCompleted({}))).toBe(false);
  });

  it('still counts toward eventCount, so staleness checks stay honest', () => {
    const state = reduceEvents([
      makeCompleted({ id: 'target' }),
      makeUncompleted({ id: 'undo', minute: 1, targetEventId: 'target' }),
    ]);
    expect(state.eventCount).toBe(2);
  });
});

describe('replay guarantees', () => {
  const log: DomainEvent[] = [
    makeCompleted({ id: 'a', minute: 0, difficulty: 'medium', attributes: ['focus'], scheduledToday: true }),
    makeCompleted({ id: 'b', minute: 1, habitId: 'h2', difficulty: 'hard', attributes: ['vitality'] }),
    makeRitual({ id: 'c', minute: 2 }),
    makeNegative({ id: 'd', minute: 3 }),
    makeDayClosed({ id: 'e', minute: 4, missedCount: 2 }),
  ];

  it('is deterministic — the same log always folds to the same state', () => {
    expect(reduceEvents(log)).toEqual(reduceEvents(log));
  });

  it('is order-independent at the input, because it sorts first', () => {
    const shuffled = [log[3]!, log[0]!, log[4]!, log[2]!, log[1]!];
    expect(reduceEvents(shuffled)).toEqual(reduceEvents(log));
  });

  it('matches an incremental fold, so the hot path and rebuild agree', () => {
    let incremental = emptyState();
    for (const event of [...log].sort(compareEvents)) {
      incremental = applyEvent(incremental, event);
    }
    expect(incremental).toEqual(reduceEvents(log));
  });

  it('never mutates the state it was given', () => {
    const before = emptyState();
    const snapshot = structuredClone(before);
    applyEvent(before, log[0]!);
    expect(before).toEqual(snapshot);
  });

  it('folds an empty log to a pristine character', () => {
    const state = reduceEvents([]);
    expect(state).toEqual(emptyState());
    expect(selectLevel(state).level).toBe(1);
  });
});

describe('selectors', () => {
  it('reports the dominant attribute only when the lead is real', () => {
    const focused = reduceEvents([
      makeCompleted({ id: 'a', minute: 0, difficulty: 'epic', attributes: ['focus'] }),
      makeCompleted({ id: 'b', minute: 1, difficulty: 'trivial', attributes: ['bond'] }),
    ]);
    expect(selectDominantAttribute(focused)).toBe('focus');
  });

  it('calls a near-tie balanced, which is what earns the prismatic accent', () => {
    const balanced = reduceEvents([
      makeCompleted({ id: 'a', minute: 0, difficulty: 'medium', attributes: ['focus'] }),
      makeCompleted({ id: 'b', minute: 1, difficulty: 'medium', attributes: ['bond'] }),
    ]);
    expect(selectDominantAttribute(balanced)).toBeNull();
  });

  it('reports nothing for a character who has done nothing', () => {
    expect(selectDominantAttribute(emptyState())).toBeNull();
  });

  it('derives all five attribute tracks', () => {
    const attributes = selectAttributes(reduceEvents([makeCompleted({ attributes: ['spirit'] })]));
    expect(attributes).toHaveLength(5);
    expect(attributes.find((a) => a.attribute === 'spirit')!.xp).toBe(10);
  });
});
