import { ATTRIBUTES, DIFFICULTIES, type Attribute, type Difficulty, type Weekday } from '@/domain/types';
import { BASE_XP } from '@/domain/xp/constants';
import type { ChipOption } from '@/ui/primitives';
import { attributeColors } from '@/ui/tokens';

/**
 * Human-facing labels for the habit form.
 *
 * Difficulty labels carry their XP value, because the number is the honest
 * explanation of what the choice does. Hiding it would invite people to pick
 * Hard for everything and then wonder why the economy feels meaningless.
 */

export const ATTRIBUTE_LABELS: Record<Attribute, string> = {
  vitality: 'Vitality',
  focus: 'Focus',
  discipline: 'Discipline',
  spirit: 'Spirit',
  bond: 'Bond',
};

export const ATTRIBUTE_BLURBS: Record<Attribute, string> = {
  vitality: 'Body, health, sleep, food',
  focus: 'Deep work, learning, output',
  discipline: 'Order, money, chores, resisting',
  spirit: 'Calm, reflection, presence',
  bond: 'Relationships and contribution',
};

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  trivial: 'Trivial',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  epic: 'Epic',
};

export const DIFFICULTY_BLURBS: Record<Difficulty, string> = {
  trivial: 'Under 2 minutes, no resistance',
  easy: 'Under 10 minutes',
  medium: '10–30 minutes, or some resistance',
  hard: '30–90 minutes, or real resistance',
  epic: 'Rare. 90+ minutes, or a big push',
};

export const attributeOptions: ChipOption<Attribute>[] = ATTRIBUTES.map((attribute) => ({
  value: attribute,
  label: ATTRIBUTE_LABELS[attribute],
  color: attributeColors[attribute],
}));

export const difficultyOptions: ChipOption<Difficulty>[] = DIFFICULTIES.map((difficulty) => ({
  value: difficulty,
  label: `${DIFFICULTY_LABELS[difficulty]} · ${BASE_XP[difficulty]}`,
}));

/** Monday-first for display, though the underlying values are JS 0=Sunday. */
export const weekdayOptions: ChipOption<string>[] = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
];

export function toWeekdays(values: string[]): Weekday[] {
  return values
    .map((v) => Number(v))
    .filter((n): n is Weekday => Number.isInteger(n) && n >= 0 && n <= 6)
    .sort((a, b) => a - b);
}

export const UNIT_OPTIONS: ChipOption<string>[] = [
  { value: 'count', label: 'times' },
  { value: 'minutes', label: 'minutes' },
  { value: 'pages', label: 'pages' },
  { value: 'km', label: 'km' },
  { value: 'glasses', label: 'glasses' },
  { value: 'reps', label: 'reps' },
];

/** Cue suggestions. Anchoring to an existing routine beats a clock time. */
export const CUE_SUGGESTIONS = [
  'after I brew coffee',
  'after I brush my teeth',
  'when I sit at my desk',
  'after lunch',
  'when I get home',
  'before I get into bed',
];
