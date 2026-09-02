import { describe, expect, it } from 'vitest';
import { createUuidV7, formatUuidV7, isUuidV7, timestampOfUuidV7 } from './uuidCore';

const fixedRandom = (n: number) => new Uint8Array(n).fill(0xab);

function generator(clock: { ms: number }) {
  return createUuidV7({ now: () => clock.ms, random: fixedRandom });
}

describe('format', () => {
  it('produces a well-formed v7 uuid', () => {
    const id = formatUuidV7(Date.UTC(2026, 8, 2, 12, 0, 0), 0, fixedRandom(8));
    expect(isUuidV7(id)).toBe(true);
    expect(id).toHaveLength(36);
  });

  it('embeds the timestamp in the leading 48 bits', () => {
    const ms = Date.UTC(2026, 8, 2, 12, 34, 56);
    expect(timestampOfUuidV7(formatUuidV7(ms, 0, fixedRandom(8)))).toBe(ms);
  });

  it('sets the version and variant bits', () => {
    const id = formatUuidV7(1_700_000_000_000, 5, fixedRandom(8));
    expect(id[14]).toBe('7'); // version nibble
    expect(['8', '9', 'a', 'b']).toContain(id[19]); // variant nibble
  });
});

describe('ordering', () => {
  it('sorts lexicographically in the order ids were created', () => {
    const clock = { ms: 1_700_000_000_000 };
    const next = generator(clock);

    const ids: string[] = [];
    for (let i = 0; i < 50; i++) {
      ids.push(next());
      if (i % 3 === 0) clock.ms += 1;
    }

    expect([...ids].sort()).toEqual(ids);
  });

  /**
   * The reason rand_a holds a counter rather than random bits: a ritual
   * completing five habits emits five events inside one millisecond, and
   * their order has to be the order they happened.
   */
  it('orders correctly within a single millisecond', () => {
    const clock = { ms: 1_700_000_000_000 };
    const next = generator(clock);
    const burst = Array.from({ length: 200 }, () => next());

    expect(new Set(burst).size).toBe(200);
    expect([...burst].sort()).toEqual(burst);
  });
});

describe('clock hazards', () => {
  it('never emits a duplicate when the clock jumps backwards', () => {
    const clock = { ms: 1_700_000_000_000 };
    const next = generator(clock);

    const before = Array.from({ length: 5 }, () => next());
    clock.ms -= 10_000; // NTP correction, or the user changing the time
    const after = Array.from({ length: 5 }, () => next());

    const all = [...before, ...after];
    expect(new Set(all).size).toBe(10);
    // Still monotonic, because a backwards clock is clamped to the last value.
    expect([...all].sort()).toEqual(all);
  });

  it('rolls into the next millisecond rather than exhausting the counter', () => {
    const clock = { ms: 1_700_000_000_000 };
    const next = generator(clock);
    const many = Array.from({ length: 5000 }, () => next());

    expect(new Set(many).size).toBe(5000);
    expect([...many].sort()).toEqual(many);
  });
});

describe('validation', () => {
  it('rejects a v4 uuid', () => {
    expect(isUuidV7('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isUuidV7('not-a-uuid')).toBe(false);
    expect(isUuidV7('')).toBe(false);
  });
});
