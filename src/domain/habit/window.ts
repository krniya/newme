import type { MinuteOfDay, TimeWindow } from './definition';

/**
 * Time-window arithmetic. Spec §3.3, §5.2.
 *
 * A window that wraps past midnight (`end < start`) is legitimate and common:
 * "wind down between 22:30 and 00:30" is a real intention, and rejecting it
 * would make the app unable to express most evening routines.
 *
 * These functions decide the `inWindow` multiplier, so an off-by-one here
 * quietly changes what people's actions are worth.
 */

export const MINUTES_PER_DAY = 1440;

export function isValidMinute(minute: number): boolean {
  return Number.isInteger(minute) && minute >= 0 && minute < MINUTES_PER_DAY;
}

/** A window wraps when it ends on the following calendar day. */
export function wrapsMidnight(window: TimeWindow): boolean {
  return window.end < window.start;
}

/**
 * Inclusive of both ends. A habit done exactly at the boundary counts —
 * denying the bonus for finishing on the stroke of the deadline would be
 * pedantry the user experiences as the app being wrong.
 */
export function isWithinWindow(minute: MinuteOfDay, window: TimeWindow): boolean {
  if (!isValidMinute(minute)) return false;

  return wrapsMidnight(window)
    ? minute >= window.start || minute <= window.end
    : minute >= window.start && minute <= window.end;
}

export function windowLength(window: TimeWindow): number {
  return wrapsMidnight(window)
    ? MINUTES_PER_DAY - window.start + window.end
    : window.end - window.start;
}

/** `540` → `"09:00"`. */
export function formatMinute(minute: MinuteOfDay): string {
  const safe = ((Math.trunc(minute) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hours = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** `"09:00"` → `540`, or null if unparseable. */
export function parseMinute(value: string): MinuteOfDay | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;

  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 23 || mins > 59) return null;

  return hours * 60 + mins;
}

export function formatWindow(window: TimeWindow): string {
  return `${formatMinute(window.start)}–${formatMinute(window.end)}`;
}

/** The minute-of-day an instant falls on, in the device's local timezone. */
export function minuteOfDay(at: Date): MinuteOfDay {
  return at.getHours() * 60 + at.getMinutes();
}
