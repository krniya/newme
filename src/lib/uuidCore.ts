/**
 * UUIDv7 assembly. Spec §8.3.4, §9.
 *
 * v7 rather than v4 because event ids double as a tiebreaker in the total
 * ordering (`compareEvents`) and as the dedupe key when merging two devices
 * on import. A time-sortable id means the log is roughly ordered by id alone,
 * and that a merge sorts correctly even if two devices' clocks disagree
 * slightly.
 *
 * Layout (RFC 9562):
 *   48 bits  unix_ts_ms
 *    4 bits  version (7)
 *   12 bits  rand_a       <- used here as a monotonic counter
 *    2 bits  variant (0b10)
 *   62 bits  rand_b
 *
 * The 12-bit rand_a is spent on a per-millisecond sequence instead of random
 * bits. Completing a ritual emits several events inside the same millisecond,
 * and with random rand_a their relative order would be arbitrary — stable
 * across replays, but not matching the order they actually happened in. The
 * counter makes intra-millisecond ordering *correct*, not merely
 * deterministic. It costs nothing: 4096 events per millisecond is far beyond
 * anything this app can produce.
 */

export interface UuidV7Deps {
  /** Milliseconds since the epoch. */
  now: () => number;
  /** Cryptographically random bytes. */
  random: (byteLength: number) => Uint8Array;
}

const MAX_SEQUENCE = 0xfff;

export function createUuidV7(deps: UuidV7Deps): () => string {
  let lastMs = -1;
  let sequence = 0;

  return function uuidv7(): string {
    const ms = deps.now();

    if (ms > lastMs) {
      lastMs = ms;
      sequence = 0;
    } else {
      /**
       * Same millisecond, or the clock has gone backwards (NTP correction,
       * user changing the time, DST on a misconfigured device). Both cases
       * are handled identically: hold `lastMs` and advance the sequence.
       *
       * Treating them the same is the point. Resetting the sequence on a
       * backwards clock would re-emit ids already written — and duplicates
       * are silently dropped by the dedupe-on-import path (§8.3.4), so the
       * symptom would be events vanishing from a restored backup, long after
       * the cause.
       */
      sequence += 1;
      if (sequence > MAX_SEQUENCE) {
        // 4096 ids in one millisecond. Borrow the next millisecond rather
        // than wrap and collide.
        lastMs += 1;
        sequence = 0;
      }
    }

    return formatUuidV7(lastMs, sequence, deps.random(8));
  };
}

/** Pure assembly, exposed for tests. `randomB` must be at least 8 bytes. */
export function formatUuidV7(ms: number, sequence: number, randomB: Uint8Array): string {
  const bytes = new Uint8Array(16);

  // 48-bit big-endian timestamp.
  bytes[0] = Math.floor(ms / 2 ** 40) & 0xff;
  bytes[1] = Math.floor(ms / 2 ** 32) & 0xff;
  bytes[2] = Math.floor(ms / 2 ** 24) & 0xff;
  bytes[3] = Math.floor(ms / 2 ** 16) & 0xff;
  bytes[4] = Math.floor(ms / 2 ** 8) & 0xff;
  bytes[5] = ms & 0xff;

  // Version 7 in the high nibble, then the 12-bit sequence.
  const seq = sequence & MAX_SEQUENCE;
  bytes[6] = 0x70 | ((seq >> 8) & 0x0f);
  bytes[7] = seq & 0xff;

  // Variant 0b10 in the top two bits, then 62 bits of randomness.
  bytes[8] = 0x80 | ((randomB[0] ?? 0) & 0x3f);
  for (let i = 1; i < 8; i++) bytes[8 + i] = randomB[i] ?? 0;

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV7(value: string): boolean {
  return UUID_PATTERN.test(value);
}

/** The embedded timestamp, for debugging and for ordering an imported log. */
export function timestampOfUuidV7(uuid: string): number {
  const hex = uuid.replace(/-/g, '').slice(0, 12);
  return Number.parseInt(hex, 16);
}
