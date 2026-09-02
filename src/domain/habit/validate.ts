import { ATTRIBUTES, DIFFICULTIES, type Schedule } from '../types';
import { isLocalDate } from '../time/localDate';
import type { HabitDraft } from './definition';
import { isValidMinute } from './window';

/**
 * Habit validation. Spec §4.1.
 *
 * Errors block saving; warnings do not. The split matters: with no backend
 * there is nobody to clean up bad data later, so anything that would corrupt
 * scheduling or replay is a hard error. But a habit missing its cue is merely
 * *weaker*, not broken, and refusing to save it would trade a small research
 * benefit for the much larger cost of the user not adding the habit at all
 * (spec §3.1 — maximise ability).
 */

export const MAX_TITLE_LENGTH = 80;
export const MAX_TEXT_LENGTH = 120;
export const MAX_ATTRIBUTES = 2;

export interface ValidationIssue {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  /** Surfaced as gentle nudges, never as blockers. */
  warnings: ValidationIssue[];
}

export function validateHabit(draft: HabitDraft): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const title = draft.title.trim();
  if (title.length === 0) {
    errors.push({ field: 'title', message: 'Give it a name.' });
  } else if (title.length > MAX_TITLE_LENGTH) {
    errors.push({ field: 'title', message: `Keep it under ${MAX_TITLE_LENGTH} characters.` });
  }

  if (!DIFFICULTIES.includes(draft.difficulty)) {
    errors.push({ field: 'difficulty', message: 'Pick a difficulty.' });
  }

  // Attributes
  if (draft.attributes.length === 0) {
    errors.push({ field: 'attributes', message: 'Pick at least one area this builds.' });
  } else if (draft.attributes.length > MAX_ATTRIBUTES) {
    errors.push({ field: 'attributes', message: `Pick at most ${MAX_ATTRIBUTES}.` });
  } else if (new Set(draft.attributes).size !== draft.attributes.length) {
    errors.push({ field: 'attributes', message: 'That area is already selected.' });
  } else if (draft.attributes.some((a) => !ATTRIBUTES.includes(a))) {
    errors.push({ field: 'attributes', message: 'Unknown area.' });
  }

  // Target
  if (!Number.isFinite(draft.target.value) || draft.target.value <= 0) {
    errors.push({ field: 'target', message: 'The target has to be more than zero.' });
  }
  if (draft.target.unit.trim().length === 0) {
    errors.push({ field: 'target', message: 'Pick a unit.' });
  }

  // Window
  if (draft.window) {
    if (!isValidMinute(draft.window.start) || !isValidMinute(draft.window.end)) {
      errors.push({ field: 'window', message: 'That is not a valid time.' });
    } else if (draft.window.start === draft.window.end) {
      errors.push({ field: 'window', message: 'The window needs some room in it.' });
    }
  }

  if (draft.cue !== null && draft.cue.length > MAX_TEXT_LENGTH) {
    errors.push({ field: 'cue', message: `Keep it under ${MAX_TEXT_LENGTH} characters.` });
  }
  if (draft.place !== null && draft.place.length > MAX_TEXT_LENGTH) {
    errors.push({ field: 'place', message: `Keep it under ${MAX_TEXT_LENGTH} characters.` });
  }

  errors.push(...validateSchedule(draft.schedule));

  // Tasks
  if (draft.kind === 'task') {
    if (draft.dueDate !== null && !isLocalDate(draft.dueDate)) {
      errors.push({ field: 'dueDate', message: 'That is not a valid date.' });
    }
    if (draft.schedule.type !== 'none') {
      errors.push({ field: 'schedule', message: 'A one-off task does not repeat.' });
    }
  }

  // Negative habits are logged, never scheduled — you do not plan to slip.
  if (draft.polarity === 'negative' && draft.schedule.type !== 'none') {
    errors.push({ field: 'schedule', message: 'A habit you are cutting down does not get a schedule.' });
  }

  // --- Warnings ---------------------------------------------------------

  if (draft.cue === null || draft.cue.trim().length === 0) {
    warnings.push({
      field: 'cue',
      message: 'Habits anchored to something you already do stick far better.',
    });
  }

  if (draft.polarity === 'positive' && draft.difficulty === 'epic') {
    warnings.push({
      field: 'difficulty',
      message: 'Epic is for rare, exceptional things. Most daily habits are Easy or Medium.',
    });
  }

  if (draft.schedule.type === 'weekdays' && draft.schedule.days.length === 7 && draft.difficulty === 'hard') {
    warnings.push({
      field: 'schedule',
      message: 'Every day, and hard. Consider a few days a week to start.',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateSchedule(schedule: Schedule): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  switch (schedule.type) {
    case 'weekdays':
      if (schedule.days.length === 0) {
        issues.push({ field: 'schedule', message: 'Pick at least one day.' });
      } else if (schedule.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) {
        issues.push({ field: 'schedule', message: 'That is not a day of the week.' });
      } else if (new Set(schedule.days).size !== schedule.days.length) {
        issues.push({ field: 'schedule', message: 'That day is already selected.' });
      }
      break;

    case 'times_per_week':
      if (!Number.isInteger(schedule.times) || schedule.times < 1 || schedule.times > 7) {
        issues.push({ field: 'schedule', message: 'Choose between 1 and 7 times a week.' });
      }
      break;

    case 'every_n_days':
      if (!Number.isInteger(schedule.n) || schedule.n < 1) {
        issues.push({ field: 'schedule', message: 'The interval has to be at least one day.' });
      }
      if (!isLocalDate(schedule.anchor)) {
        issues.push({ field: 'schedule', message: 'The start date is not valid.' });
      }
      break;

    case 'none':
      break;
  }

  return issues;
}

/** Trim and normalise before persisting, so equality checks behave. */
export function normalizeDraft(draft: HabitDraft): HabitDraft {
  const clean = (value: string | null): string | null => {
    if (value === null) return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  };

  return {
    ...draft,
    title: draft.title.trim(),
    cue: clean(draft.cue),
    place: clean(draft.place),
    target: { ...draft.target, unit: draft.target.unit.trim() || 'count' },
    attributes: [...new Set(draft.attributes)],
  };
}
