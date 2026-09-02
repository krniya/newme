import { ATTRIBUTES, type Attribute, type LocalDate, type LevelProgress, type MomentumState, type Tier } from '../types';
import { MOMENTUM_START, momentumState } from '../momentum/momentum';
import {
  attributeLevelFromXp,
  levelProgress,
  tierForLevel,
  totalXpForAttributeLevel,
} from '../xp/curve';

/**
 * The projection: everything `reduceEvents` accumulates. Spec §8.2.
 *
 * Only *irreducible* values live here. Level, tier, attribute levels and
 * momentum band are all pure functions of these numbers, so they are computed
 * by the selectors below rather than stored — two sources for one truth is
 * how a level bar ends up disagreeing with the level number beside it.
 */

export interface DailyTotal {
  rawXp: number;
  bankedXp: number;
  gold: number;
  completed: number;
  missed: number;
}

export interface HabitProgress {
  streak: number;
  longestStreak: number;
  totalCompletions: number;
  lastCompletedOn: LocalDate | null;
  /** When the streak broke — the 48h repair window opens here. */
  brokenAt: number | null;
}

export interface ProgressionState {
  xpTotal: number;
  gold: number;
  momentum: number;
  freezeTokens: number;
  attributeXp: Record<Attribute, number>;
  daily: Record<LocalDate, DailyTotal>;
  habits: Record<string, HabitProgress>;
  /** Number of events folded, for cheap staleness checks against the log. */
  eventCount: number;
}

export function emptyDailyTotal(): DailyTotal {
  return { rawXp: 0, bankedXp: 0, gold: 0, completed: 0, missed: 0 };
}

export function emptyHabitProgress(): HabitProgress {
  return { streak: 0, longestStreak: 0, totalCompletions: 0, lastCompletedOn: null, brokenAt: null };
}

export function emptyState(): ProgressionState {
  return {
    xpTotal: 0,
    gold: 0,
    momentum: MOMENTUM_START,
    freezeTokens: 0,
    attributeXp: { vitality: 0, focus: 0, discipline: 0, spirit: 0, bond: 0 },
    daily: {},
    habits: {},
    eventCount: 0,
  };
}

// ---------------------------------------------------------------------------
// Selectors — derived, never stored
// ---------------------------------------------------------------------------

export function selectLevel(state: ProgressionState): LevelProgress {
  return levelProgress(state.xpTotal);
}

export function selectTier(state: ProgressionState): Tier {
  return tierForLevel(levelProgress(state.xpTotal).level);
}

export function selectMomentumState(state: ProgressionState): MomentumState {
  return momentumState(state.momentum);
}

export interface AttributeProgress {
  attribute: Attribute;
  xp: number;
  level: number;
  fraction: number;
}

export function selectAttributes(state: ProgressionState): AttributeProgress[] {
  return ATTRIBUTES.map((attribute) => {
    const xp = state.attributeXp[attribute];
    const level = attributeLevelFromXp(xp);
    const floor = totalXpForAttributeLevel(level);
    const ceiling = totalXpForAttributeLevel(level + 1);
    return {
      attribute,
      xp,
      level,
      fraction: ceiling > floor ? (xp - floor) / (ceiling - floor) : 0,
    };
  });
}

/**
 * The attribute tinting the UI, or null when the character is balanced.
 *
 * "Balanced" is deliberately generous: a lead of less than 20% over the runner
 * up counts as no lead at all, which is what earns the prismatic accent
 * (spec §5.5). The art rewards balance without any rule enforcing it.
 */
export function selectDominantAttribute(state: ProgressionState): Attribute | null {
  const ranked = [...ATTRIBUTES].sort((a, b) => state.attributeXp[b] - state.attributeXp[a]);
  const top = ranked[0]!;
  const second = ranked[1]!;

  const topXp = state.attributeXp[top];
  const secondXp = state.attributeXp[second];

  if (topXp === 0) return null;
  return topXp > secondXp * 1.2 ? top : null;
}

export function selectDaily(state: ProgressionState, date: LocalDate): DailyTotal {
  return state.daily[date] ?? emptyDailyTotal();
}

export function selectHabit(state: ProgressionState, habitId: string): HabitProgress {
  return state.habits[habitId] ?? emptyHabitProgress();
}
