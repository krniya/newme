import type { LocalDate, Weekday } from '../types';

/**
 * Calendar arithmetic on `YYYY-MM-DD` strings.
 *
 * Every function here does its maths in UTC on a date-only value. That is
 * deliberate: it makes day arithmetic completely immune to DST transitions
 * and to the device's timezone. A user who flies from Delhi to London must
 * not silently gain or lose a day of streak (spec §9, §10.3).
 *
 * The single place the real timezone matters is `localDateOf`, which converts
 * an instant into the calendar day it belongs to.
 */

const MS_PER_DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Configurable day boundary: a completion at 01:00 counts for the previous day. */
export const DEFAULT_DAY_START_HOUR = 4;

const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));

export function isLocalDate(value: string): value is LocalDate {
  if (!ISO_DATE.test(value)) return false;
  // Reject impossible dates like 2026-02-31 that the regex would let through.
  return toUtc(value as LocalDate) !== null;
}

function toUtc(date: LocalDate): Date | null {
  const year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  const dt = new Date(Date.UTC(year, month - 1, day));
  // Date.UTC rolls overflow forward (Feb 31 -> Mar 3); catch that here.
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
    return null;
  }
  return dt;
}

function mustUtc(date: LocalDate): Date {
  const dt = toUtc(date);
  if (dt === null) throw new RangeError(`Not a valid calendar date: "${date}"`);
  return dt;
}

function fromUtc(dt: Date): LocalDate {
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/**
 * The calendar day an instant belongs to, in the device's local timezone,
 * honouring the configurable day-start hour.
 *
 * This is the one function in the domain that reads ambient timezone state,
 * and it does so through the supplied `Date` only.
 */
export function localDateOf(at: Date, dayStartHour: number = DEFAULT_DAY_START_HOUR): LocalDate {
  const shifted = new Date(at.getTime() - dayStartHour * 3_600_000);
  return `${shifted.getFullYear()}-${pad(shifted.getMonth() + 1)}-${pad(shifted.getDate())}`;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtc(new Date(mustUtc(date).getTime() + days * MS_PER_DAY));
}

/** Whole days from `a` to `b`; negative when `b` precedes `a`. */
export function daysBetween(a: LocalDate, b: LocalDate): number {
  return Math.round((mustUtc(b).getTime() - mustUtc(a).getTime()) / MS_PER_DAY);
}

export function compareDates(a: LocalDate, b: LocalDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 0 = Sunday … 6 = Saturday. */
export function weekdayOf(date: LocalDate): Weekday {
  return mustUtc(date).getUTCDay() as Weekday;
}

/** Inclusive range of calendar days. Returns `[]` if `to` precedes `from`. */
export function eachDay(from: LocalDate, to: LocalDate): LocalDate[] {
  const span = daysBetween(from, to);
  if (span < 0) return [];
  const out: LocalDate[] = [];
  for (let i = 0; i <= span; i++) out.push(addDays(from, i));
  return out;
}

/**
 * ISO-8601 week key, e.g. `2026-W36`. Weeks start Monday, and week 1 is the
 * week containing the first Thursday of the year — which is why this cannot
 * be done with naive division.
 */
export function isoWeekKey(date: LocalDate): string {
  const dt = mustUtc(date);
  // Shift to the Thursday of this week; its year is the ISO week-year.
  const day = dt.getUTCDay() === 0 ? 7 : dt.getUTCDay(); // Monday=1 … Sunday=7
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const isoYear = dt.getUTCFullYear();
  const jan1 = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((dt.getTime() - jan1) / MS_PER_DAY + 1) / 7);
  return `${isoYear}-W${pad(week)}`;
}

/** The Monday that starts the ISO week containing `date`. */
export function startOfIsoWeek(date: LocalDate): LocalDate {
  const day = weekdayOf(date);
  const backTo = day === 0 ? 6 : day - 1; // Sunday belongs to the week that began 6 days ago
  return addDays(date, -backTo);
}
