import { DAILY_CAP_BANDS } from './constants';

/**
 * The daily soft cap. Spec §5.2.
 *
 * Bands apply to the running total of *raw* XP earned today, so the rule a
 * user can hold in their head is simply "after 150 XP today, further XP is
 * worth half". A single award can straddle several bands, so it is split
 * across them rather than being placed wholly in one.
 *
 * This is deliberately a soft cap, not a hard stop: grinding always earns
 * something, it just stops being efficient. A hard zero would make the app
 * feel broken at exactly the moment a user is being unusually productive.
 */
export function applyDailyCap(rawSoFarToday: number, raw: number): number {
  if (raw <= 0) return 0;

  let cursor = Math.max(0, rawSoFarToday);
  let remaining = raw;
  let banked = 0;

  for (const band of DAILY_CAP_BANDS) {
    if (remaining <= 0) break;
    if (cursor >= band.upTo) continue;

    const room = band.upTo - cursor;
    const take = Math.min(remaining, room);

    banked += take * band.rate;
    cursor += take;
    remaining -= take;
  }

  return Math.round(banked);
}

/**
 * Which band the next point of XP falls into, for the "raw / banked" readout
 * on the Today screen. The cap must always be visible — a silent nerf reads
 * as a bug, and erodes trust in every other number in the app.
 */
export function currentCapRate(rawSoFarToday: number): number {
  for (const band of DAILY_CAP_BANDS) {
    if (rawSoFarToday < band.upTo) return band.rate;
  }
  return DAILY_CAP_BANDS[DAILY_CAP_BANDS.length - 1]?.rate ?? 1;
}
