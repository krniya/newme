import { describe, expect, it } from 'vitest';
import type { Schedule } from '../types';
import { emptyDraft, hasIntention, isActive, type HabitDefinition, type HabitDraft } from './definition';
import {
  formatMinute,
  formatWindow,
  isWithinWindow,
  minuteOfDay,
  parseMinute,
  windowLength,
  wrapsMidnight,
} from './window';
import { normalizeDraft, validateHabit, validateSchedule } from './validate';
import {
  parseAttributes,
  parseSchedule,
  parseWindow,
  serializeAttributes,
  serializeSchedule,
} from './serialize';

const draft = (over: Partial<HabitDraft> = {}): HabitDraft => ({
  ...emptyDraft(),
  title: 'Run',
  attributes: ['vitality'],
  ...over,
});

describe('time windows', () => {
  it('recognises a normal window', () => {
    const morning = { start: 420, end: 540 }; // 07:00–09:00
    expect(wrapsMidnight(morning)).toBe(false);
    expect(isWithinWindow(480, morning)).toBe(true);
    expect(isWithinWindow(400, morning)).toBe(false);
    expect(windowLength(morning)).toBe(120);
  });

  /**
   * Wind-down and sleep habits routinely span midnight. Rejecting these would
   * make the app unable to express most evening routines, and the `inWindow`
   * multiplier would silently never fire for them.
   */
  it('handles a window that wraps past midnight', () => {
    const windDown = { start: 1350, end: 30 }; // 22:30–00:30
    expect(wrapsMidnight(windDown)).toBe(true);
    expect(isWithinWindow(1380, windDown)).toBe(true); // 23:00
    expect(isWithinWindow(10, windDown)).toBe(true); // 00:10
    expect(isWithinWindow(600, windDown)).toBe(false); // 10:00
    expect(windowLength(windDown)).toBe(120);
  });

  it('counts the boundaries as inside', () => {
    const window = { start: 420, end: 540 };
    expect(isWithinWindow(420, window)).toBe(true);
    expect(isWithinWindow(540, window)).toBe(true);
  });

  it('rejects impossible minutes rather than guessing', () => {
    expect(isWithinWindow(-1, { start: 0, end: 100 })).toBe(false);
    expect(isWithinWindow(1440, { start: 0, end: 100 })).toBe(false);
    expect(isWithinWindow(1.5, { start: 0, end: 100 })).toBe(false);
  });

  it('formats and parses clock times', () => {
    expect(formatMinute(540)).toBe('09:00');
    expect(formatMinute(0)).toBe('00:00');
    expect(formatMinute(1439)).toBe('23:59');
    expect(parseMinute('09:00')).toBe(540);
    expect(parseMinute('9:05')).toBe(545);
    expect(parseMinute('23:59')).toBe(1439);
    expect(formatWindow({ start: 420, end: 540 })).toBe('07:00–09:00');
  });

  it('rejects unparseable times', () => {
    expect(parseMinute('24:00')).toBeNull();
    expect(parseMinute('09:60')).toBeNull();
    expect(parseMinute('nine')).toBeNull();
    expect(parseMinute('')).toBeNull();
  });

  it('reads the minute-of-day from a local Date', () => {
    expect(minuteOfDay(new Date(2026, 8, 2, 7, 30))).toBe(450);
  });
});

describe('validation', () => {
  it('accepts a reasonable habit', () => {
    const result = validateHabit(draft());
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('requires a name and an area', () => {
    const result = validateHabit(draft({ title: '   ', attributes: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.map((e) => e.field)).toEqual(expect.arrayContaining(['title', 'attributes']));
  });

  it('caps attributes at two', () => {
    const result = validateHabit(draft({ attributes: ['vitality', 'focus', 'spirit'] }));
    expect(result.valid).toBe(false);
  });

  it('rejects a duplicated attribute', () => {
    expect(validateHabit(draft({ attributes: ['focus', 'focus'] })).valid).toBe(false);
  });

  it('rejects a non-positive target', () => {
    expect(validateHabit(draft({ target: { value: 0, unit: 'count' } })).valid).toBe(false);
    expect(validateHabit(draft({ target: { value: -3, unit: 'count' } })).valid).toBe(false);
  });

  it('rejects a zero-length window but allows a wrapping one', () => {
    expect(validateHabit(draft({ window: { start: 540, end: 540 } })).valid).toBe(false);
    expect(validateHabit(draft({ window: { start: 1350, end: 30 } })).valid).toBe(true);
  });

  it('will not let a one-off task repeat', () => {
    const result = validateHabit(
      draft({ kind: 'task', schedule: { type: 'weekdays', days: [1] } }),
    );
    expect(result.valid).toBe(false);
  });

  it('will not schedule a habit you are trying to cut down', () => {
    const result = validateHabit(
      draft({ polarity: 'negative', schedule: { type: 'weekdays', days: [1] } }),
    );
    expect(result.valid).toBe(false);
  });

  /**
   * The core split: a missing cue weakens a habit but must never block
   * saving it. Refusing the save trades a small research gain for the much
   * larger cost of the habit never being created (spec §3.1).
   */
  it('warns about a missing cue without blocking the save', () => {
    const result = validateHabit(draft({ cue: null }));
    expect(result.valid).toBe(true);
    expect(result.warnings.map((w) => w.field)).toContain('cue');
  });

  it('stops warning once a cue is given', () => {
    const result = validateHabit(draft({ cue: 'after I brew coffee' }));
    expect(result.warnings.map((w) => w.field)).not.toContain('cue');
  });

  it('warns about an over-ambitious start', () => {
    const result = validateHabit(
      draft({ difficulty: 'hard', schedule: { type: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] } }),
    );
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe('schedule validation', () => {
  it('requires at least one weekday', () => {
    expect(validateSchedule({ type: 'weekdays', days: [] })).toHaveLength(1);
  });

  it('bounds times-per-week to 1..7', () => {
    expect(validateSchedule({ type: 'times_per_week', times: 0 })).toHaveLength(1);
    expect(validateSchedule({ type: 'times_per_week', times: 8 })).toHaveLength(1);
    expect(validateSchedule({ type: 'times_per_week', times: 3 })).toHaveLength(0);
  });

  it('requires a sane interval and a real anchor date', () => {
    expect(validateSchedule({ type: 'every_n_days', n: 0, anchor: '2026-09-02' })).toHaveLength(1);
    expect(validateSchedule({ type: 'every_n_days', n: 3, anchor: '2026-02-31' })).toHaveLength(1);
    expect(validateSchedule({ type: 'every_n_days', n: 3, anchor: '2026-09-02' })).toHaveLength(0);
  });
});

describe('normalisation', () => {
  it('trims text and drops empties to null', () => {
    const result = normalizeDraft(draft({ title: '  Run  ', cue: '   ', place: ' park ' }));
    expect(result.title).toBe('Run');
    expect(result.cue).toBeNull();
    expect(result.place).toBe('park');
  });

  it('de-duplicates attributes and defaults a blank unit', () => {
    const result = normalizeDraft(
      draft({ attributes: ['focus', 'focus'], target: { value: 2, unit: '  ' } }),
    );
    expect(result.attributes).toEqual(['focus']);
    expect(result.target.unit).toBe('count');
  });
});

describe('serialisation round-trips', () => {
  const schedules: Schedule[] = [
    { type: 'weekdays', days: [1, 3, 5] },
    { type: 'times_per_week', times: 3 },
    { type: 'every_n_days', n: 4, anchor: '2026-09-02' },
    { type: 'none' },
  ];

  it.each(schedules)('round-trips %j', (schedule) => {
    const { scheduleType, scheduleConfig } = serializeSchedule(schedule);
    expect(parseSchedule(scheduleType, scheduleConfig)).toEqual(schedule);
  });

  it('round-trips attributes', () => {
    expect(parseAttributes(serializeAttributes(['focus', 'bond']))).toEqual(['focus', 'bond']);
  });
});

/**
 * With no backend, a row that throws on read is unrecoverable by the user —
 * no support team, no remote migration. Every parser degrades instead.
 */
describe('corrupt data degrades instead of crashing', () => {
  it.each([
    ['truncated json', 'weekdays', '{"days":[1,2'],
    ['wrong shape', 'weekdays', '[]'],
    ['empty', 'weekdays', ''],
    ['nonsense days', 'weekdays', '{"days":["monday"]}'],
    ['out-of-range days', 'weekdays', '{"days":[9,12]}'],
    ['unknown type', 'fortnightly', '{}'],
    ['bad interval', 'every_n_days', '{"n":0,"anchor":"2026-09-02"}'],
    ['bad anchor', 'every_n_days', '{"n":3,"anchor":"nope"}'],
  ])('%s falls back to unscheduled', (_label, type, config) => {
    expect(parseSchedule(type, config)).toEqual({ type: 'none' });
  });

  it('keeps the valid days from a partly corrupt list', () => {
    expect(parseSchedule('weekdays', '{"days":[1,99,3]}')).toEqual({ type: 'weekdays', days: [1, 3] });
  });

  it('drops unknown attributes rather than throwing', () => {
    expect(parseAttributes('["focus","wisdom",7]')).toEqual(['focus']);
    expect(parseAttributes('not json')).toEqual([]);
    expect(parseAttributes('{}')).toEqual([]);
  });

  it('treats an incoherent window as absent', () => {
    expect(parseWindow(null, 540)).toBeNull();
    expect(parseWindow(540, null)).toBeNull();
    expect(parseWindow(540, 540)).toBeNull();
    expect(parseWindow(-5, 540)).toBeNull();
    expect(parseWindow(420, 540)).toEqual({ start: 420, end: 540 });
  });
});

describe('definition helpers', () => {
  const base: HabitDefinition = {
    id: 'h1',
    title: 'Run',
    kind: 'daily',
    polarity: 'positive',
    difficulty: 'medium',
    attributes: ['vitality'],
    cue: null,
    window: null,
    place: null,
    target: { value: 1, unit: 'count' },
    schedule: { type: 'none' },
    dueDate: null,
    ritualId: null,
    ritualOrder: null,
    archivedAt: null,
    createdAt: 0,
    updatedAt: 0,
    deletedAt: null,
  };

  it('treats archived and deleted habits as inactive', () => {
    expect(isActive(base)).toBe(true);
    expect(isActive({ ...base, archivedAt: 1 })).toBe(false);
    expect(isActive({ ...base, deletedAt: 1 })).toBe(false);
  });

  it('detects whether an intention has been set', () => {
    expect(hasIntention(base)).toBe(false);
    expect(hasIntention({ ...base, cue: '   ' })).toBe(false);
    expect(hasIntention({ ...base, cue: 'after coffee' })).toBe(true);
  });

  it('starts a new habit deliberately small', () => {
    const fresh = emptyDraft();
    expect(fresh.difficulty).toBe('easy');
    expect(fresh.target.value).toBe(1);
  });
});
