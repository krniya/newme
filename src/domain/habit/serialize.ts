import type { Attribute, Schedule, ScheduleType, Weekday } from '../types';
import { ATTRIBUTES } from '../types';
import { isLocalDate } from '../time/localDate';
import type { TimeWindow } from './definition';
import { isValidMinute } from './window';

/**
 * Storage serialisation for the structured fields on a habit row.
 *
 * Every parser here is **total**: given any input at all, including corrupt
 * or truncated JSON, it returns something usable rather than throwing.
 *
 * That is not defensive-programming reflex. With no backend, a row that
 * crashes the app on read is unrecoverable by the user — there is no support
 * team, no server-side migration, no way to repair it remotely. A habit whose
 * schedule failed to parse should degrade to "unscheduled" and stay visible
 * and editable, not take the whole Habits screen down with it.
 */

export function serializeSchedule(schedule: Schedule): {
  scheduleType: ScheduleType;
  scheduleConfig: string;
} {
  switch (schedule.type) {
    case 'weekdays':
      return { scheduleType: 'weekdays', scheduleConfig: JSON.stringify({ days: schedule.days }) };
    case 'times_per_week':
      return {
        scheduleType: 'times_per_week',
        scheduleConfig: JSON.stringify({ times: schedule.times }),
      };
    case 'every_n_days':
      return {
        scheduleType: 'every_n_days',
        scheduleConfig: JSON.stringify({ n: schedule.n, anchor: schedule.anchor }),
      };
    case 'none':
      return { scheduleType: 'none', scheduleConfig: '{}' };
  }
}

const UNSCHEDULED: Schedule = { type: 'none' };

export function parseSchedule(type: string, config: string): Schedule {
  const raw = safeJson(config);

  switch (type) {
    case 'weekdays': {
      const days = Array.isArray(raw?.days)
        ? raw.days.filter((d): d is Weekday => Number.isInteger(d) && d >= 0 && d <= 6)
        : [];
      return days.length > 0 ? { type: 'weekdays', days: [...new Set(days)] } : UNSCHEDULED;
    }

    case 'times_per_week': {
      const times = Number(raw?.times);
      return Number.isInteger(times) && times >= 1 && times <= 7
        ? { type: 'times_per_week', times }
        : UNSCHEDULED;
    }

    case 'every_n_days': {
      const n = Number(raw?.n);
      const anchor = typeof raw?.anchor === 'string' ? raw.anchor : '';
      return Number.isInteger(n) && n >= 1 && isLocalDate(anchor)
        ? { type: 'every_n_days', n, anchor }
        : UNSCHEDULED;
    }

    default:
      return UNSCHEDULED;
  }
}

export function serializeAttributes(attributes: Attribute[]): string {
  return JSON.stringify(attributes);
}

export function parseAttributes(json: string): Attribute[] {
  const raw = safeJsonArray(json);
  const valid = raw.filter((value): value is Attribute =>
    typeof value === 'string' && (ATTRIBUTES as readonly string[]).includes(value),
  );
  return [...new Set(valid)].slice(0, 2);
}

/** Windows are stored as two nullable integer columns rather than JSON. */
export function parseWindow(start: number | null, end: number | null): TimeWindow | null {
  if (start === null || end === null) return null;
  if (!isValidMinute(start) || !isValidMinute(end)) return null;
  if (start === end) return null;
  return { start, end };
}

function safeJson(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function safeJsonArray(value: string): unknown[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
