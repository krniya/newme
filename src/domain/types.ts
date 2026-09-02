/**
 * Shared domain vocabulary.
 *
 * This file — and everything else under `src/domain` — is pure TypeScript.
 * No React, no React Native, no database, no I/O. See spec §7.4.
 */

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------

export const DIFFICULTIES = ['trivial', 'easy', 'medium', 'hard', 'epic'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const ATTRIBUTES = ['vitality', 'focus', 'discipline', 'spirit', 'bond'] as const;
export type Attribute = (typeof ATTRIBUTES)[number];

export type HabitKind = 'habit' | 'daily' | 'task';
export type Polarity = 'positive' | 'negative';

/** A calendar day in the user's own timezone, `YYYY-MM-DD`. Never a timestamp. */
export type LocalDate = string;

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/** Day-of-week numbers follow JS convention: 0 = Sunday … 6 = Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type Schedule =
  /** Specific days of the week. Misses on these days break a streak. */
  | { type: 'weekdays'; days: Weekday[] }
  /** N completions per ISO week, any days. Streaks are counted in weeks. */
  | { type: 'times_per_week'; times: number }
  /** Every N days from an anchor date. */
  | { type: 'every_n_days'; n: number; anchor: LocalDate }
  /** Unscheduled — always available, never breaks a streak. */
  | { type: 'none' };

export type ScheduleType = Schedule['type'];

// ---------------------------------------------------------------------------
// Progression
// ---------------------------------------------------------------------------

export type MomentumState = 'flow' | 'steady' | 'fading' | 'dormant';

/** Avatar tier, 1–7 (Ember … Mythic). See spec §5.5. */
export type Tier = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface LevelProgress {
  level: number;
  /** XP accumulated inside the current level. */
  xpIntoLevel: number;
  /** XP needed to span the current level, i.e. `total(L+1) - total(L)`. */
  xpForLevel: number;
  /** 0–1. Exposed so the UI never re-derives it and drifts. */
  fraction: number;
}
