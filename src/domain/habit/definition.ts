import type {
  Attribute,
  Difficulty,
  HabitKind,
  LocalDate,
  Polarity,
  Schedule,
} from '../types';

/**
 * The habit definition. Spec §4.1, §9.
 *
 * Mutable and user-authored, unlike events. Two fields exist purely to serve
 * the merge-on-import path (§8.3.4): `updatedAt` decides which version of a
 * definition wins, and `deletedAt` is a tombstone so a merge cannot resurrect
 * a habit the user deleted on another device.
 */

/** Minutes from midnight, 0–1439. */
export type MinuteOfDay = number;

/**
 * The declared time window for a habit.
 *
 * `end` may be *less than* `start`, meaning the window spans midnight — which
 * wind-down and sleep habits routinely do. Treating that as invalid would
 * make the app unable to express "between 22:30 and 00:30", which is a real
 * and common intention.
 */
export interface TimeWindow {
  start: MinuteOfDay;
  end: MinuteOfDay;
}

export interface HabitTarget {
  value: number;
  /** 'count' | 'minutes' | 'km' | 'pages' | 'glasses' | free text. */
  unit: string;
}

export interface HabitDefinition {
  id: string;
  title: string;
  kind: HabitKind;
  polarity: Polarity;
  difficulty: Difficulty;
  /** 1–2 attributes. See spec §5.3. */
  attributes: Attribute[];

  // Implementation intention (spec §3.3).
  cue: string | null;
  window: TimeWindow | null;
  place: string | null;

  target: HabitTarget;
  schedule: Schedule;

  /** Tasks only. */
  dueDate: LocalDate | null;

  ritualId: string | null;
  ritualOrder: number | null;

  archivedAt: number | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

/** The editable subset — what a create or edit form produces. */
export type HabitDraft = Pick<
  HabitDefinition,
  | 'title'
  | 'kind'
  | 'polarity'
  | 'difficulty'
  | 'attributes'
  | 'cue'
  | 'window'
  | 'place'
  | 'target'
  | 'schedule'
  | 'dueDate'
  | 'ritualId'
  | 'ritualOrder'
>;

export const DEFAULT_UNITS = [
  'count',
  'minutes',
  'pages',
  'km',
  'glasses',
  'reps',
] as const;

/**
 * A new habit starts deliberately small: Easy, once, unscheduled.
 *
 * Tiny-habit ramp (spec §3.2) — the commitment scales only once the behaviour
 * is automatic. Defaulting to anything more ambitious is how a user ends up
 * with fifteen habits on day one and none by day four (§14).
 */
export function emptyDraft(): HabitDraft {
  return {
    title: '',
    kind: 'daily',
    polarity: 'positive',
    difficulty: 'easy',
    attributes: [],
    cue: null,
    window: null,
    place: null,
    target: { value: 1, unit: 'count' },
    schedule: { type: 'weekdays', days: [0, 1, 2, 3, 4, 5, 6] },
    dueDate: null,
    ritualId: null,
    ritualOrder: null,
  };
}

export function isArchived(habit: HabitDefinition): boolean {
  return habit.archivedAt !== null;
}

export function isDeleted(habit: HabitDefinition): boolean {
  return habit.deletedAt !== null;
}

export function isActive(habit: HabitDefinition): boolean {
  return !isArchived(habit) && !isDeleted(habit);
}

/**
 * Whether the habit carries a full implementation intention.
 *
 * Drives the nudge on the habit detail screen. Anchored habits measurably
 * outperform time-only ones (spec §3.1), so the app asks again later rather
 * than blocking creation up front.
 */
export function hasIntention(habit: HabitDefinition): boolean {
  return habit.cue !== null && habit.cue.trim().length > 0;
}
