import { ATTRIBUTES } from '@/domain/types';
import { selectLevel, selectTier, type ProgressionState } from '@/domain/events/state';
import { attributeLevelFromXp } from '@/domain/xp/curve';
import { attributeState, characterState, dailyTotals, habitStats } from '../db/schema';
import type { Database } from '../db/client';

export const CHARACTER_ROW_ID = 1;

/** Anything with the same shape as `db` — the real client or a transaction. */
type Writer = Database | Parameters<Parameters<Database['transaction']>[0]>[0];

/**
 * Write a folded `ProgressionState` into the projection tables.
 *
 * Shared by the full rebuild and the incremental save path so there is
 * exactly one definition of how derived state is persisted. Two copies of
 * this logic is how a rebuilt character ends up disagreeing with a live one.
 *
 * Callers supply the transaction; this function never opens its own.
 */
export async function writeProjections(
  tx: Writer,
  state: ProgressionState,
  at: number,
): Promise<void> {
  await tx.delete(characterState);
  await tx.delete(attributeState);
  await tx.delete(habitStats);
  await tx.delete(dailyTotals);

  const level = selectLevel(state);

  await tx.insert(characterState).values({
    id: CHARACTER_ROW_ID,
    xpTotal: state.xpTotal,
    level: level.level,
    gold: state.gold,
    momentum: state.momentum,
    freezeTokens: state.freezeTokens,
    tier: selectTier(state),
    equipped: '{}',
    rebuiltAt: at,
  });

  await tx.insert(attributeState).values(
    ATTRIBUTES.map((attribute) => ({
      attribute,
      xpTotal: state.attributeXp[attribute],
      level: attributeLevelFromXp(state.attributeXp[attribute]),
    })),
  );

  const habitRows = Object.entries(state.habits).map(([habitId, progress]) => ({
    habitId,
    currentStreak: progress.streak,
    longestStreak: progress.longestStreak,
    lastCompletedOn: progress.lastCompletedOn,
    totalCompletions: progress.totalCompletions,
    // Adherence and automaticity need habit definitions and schedules, which
    // replay deliberately never reads. Computed by the stats pass in M3.
    adherence28: 0,
    automaticity: 0,
    brokenAt: progress.brokenAt,
  }));
  if (habitRows.length > 0) await tx.insert(habitStats).values(habitRows);

  const dailyRows = Object.entries(state.daily).map(([localDate, totals]) => ({
    localDate,
    rawXp: totals.rawXp,
    bankedXp: totals.bankedXp,
    gold: totals.gold,
    completed: totals.completed,
    missed: totals.missed,
  }));
  if (dailyRows.length > 0) await tx.insert(dailyTotals).values(dailyRows);
}
