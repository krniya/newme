import { and, asc, eq, isNull } from 'drizzle-orm';
import type { HabitDefinition, HabitDraft } from '@/domain/habit/definition';
import { normalizeDraft } from '@/domain/habit/validate';
import {
  parseAttributes,
  parseSchedule,
  parseWindow,
  serializeAttributes,
  serializeSchedule,
} from '@/domain/habit/serialize';
import type { Difficulty, HabitKind, LocalDate, Polarity } from '@/domain/types';
import { db } from '../db/client';
import { habits, type HabitRow } from '../db/schema';
import { uuidv7 } from '@/lib/uuid';

/**
 * Habit definitions. Spec §4.1, §9.
 *
 * Unlike the event log, definitions are mutable — but two conventions from
 * the discarded sync design are kept, because merge-on-import needs them
 * (spec §8.3.4):
 *
 *   - every write stamps `updatedAt`, which decides who wins a merge;
 *   - deletes are tombstones, so a merge cannot resurrect a habit the user
 *     deleted on another device.
 *
 * Nothing here validates. Callers validate with `validateHabit` first; this
 * layer only persists.
 */

export function rowToHabit(row: HabitRow): HabitDefinition {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind as HabitKind,
    polarity: row.polarity as Polarity,
    difficulty: row.difficulty as Difficulty,
    attributes: parseAttributes(row.attributes),
    cue: row.cue,
    window: parseWindow(row.windowStart, row.windowEnd),
    place: row.place,
    target: { value: row.targetValue, unit: row.targetUnit },
    schedule: parseSchedule(row.scheduleType, row.scheduleConfig),
    dueDate: (row.dueDate as LocalDate | null) ?? null,
    ritualId: row.ritualId,
    ritualOrder: row.ritualOrder,
    archivedAt: row.archivedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}

function draftToColumns(draft: HabitDraft) {
  const clean = normalizeDraft(draft);
  const { scheduleType, scheduleConfig } = serializeSchedule(clean.schedule);

  return {
    title: clean.title,
    kind: clean.kind,
    polarity: clean.polarity,
    difficulty: clean.difficulty,
    attributes: serializeAttributes(clean.attributes),
    cue: clean.cue,
    windowStart: clean.window?.start ?? null,
    windowEnd: clean.window?.end ?? null,
    place: clean.place,
    targetValue: clean.target.value,
    targetUnit: clean.target.unit,
    scheduleType,
    scheduleConfig,
    dueDate: clean.dueDate,
    ritualId: clean.ritualId,
    ritualOrder: clean.ritualOrder,
  };
}

export async function create(draft: HabitDraft): Promise<HabitDefinition> {
  const now = Date.now();
  const row = {
    id: uuidv7(),
    ...draftToColumns(draft),
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  await db.insert(habits).values(row);
  return rowToHabit(row as HabitRow);
}

export async function update(id: string, draft: HabitDraft): Promise<void> {
  await db
    .update(habits)
    .set({ ...draftToColumns(draft), updatedAt: Date.now() })
    .where(eq(habits.id, id));
}

/**
 * Archiving keeps every past completion meaningful while removing the habit
 * from Today. It is the right answer for "I stopped doing this" — deleting
 * would be the wrong one, since the events remain in the log either way and
 * the user would be left with history referencing a habit with no name.
 */
export async function archive(id: string): Promise<void> {
  const now = Date.now();
  await db.update(habits).set({ archivedAt: now, updatedAt: now }).where(eq(habits.id, id));
}

export async function unarchive(id: string): Promise<void> {
  await db.update(habits).set({ archivedAt: null, updatedAt: Date.now() }).where(eq(habits.id, id));
}

/** Tombstone, never a hard delete — see the module note. */
export async function remove(id: string): Promise<void> {
  const now = Date.now();
  await db.update(habits).set({ deletedAt: now, updatedAt: now }).where(eq(habits.id, id));
}

export async function restore(id: string): Promise<void> {
  await db.update(habits).set({ deletedAt: null, updatedAt: Date.now() }).where(eq(habits.id, id));
}

export async function findById(id: string): Promise<HabitDefinition | null> {
  const [row] = await db.select().from(habits).where(eq(habits.id, id)).limit(1);
  return row ? rowToHabit(row) : null;
}

/** Active habits: not archived, not deleted. What Today and Habits show. */
export async function listActive(): Promise<HabitDefinition[]> {
  const rows = await db
    .select()
    .from(habits)
    .where(and(isNull(habits.deletedAt), isNull(habits.archivedAt)))
    .orderBy(asc(habits.ritualOrder), asc(habits.createdAt));
  return rows.map(rowToHabit);
}

export async function listArchived(): Promise<HabitDefinition[]> {
  const rows = await db
    .select()
    .from(habits)
    .where(isNull(habits.deletedAt))
    .orderBy(asc(habits.createdAt));
  return rows.filter((row) => row.archivedAt !== null).map(rowToHabit);
}

/** Everything except tombstones — used by the backup export in M5. */
export async function listAll(): Promise<HabitDefinition[]> {
  const rows = await db.select().from(habits).orderBy(asc(habits.createdAt));
  return rows.map(rowToHabit);
}

/** Live-query source for the Habits screen. Drizzle's `useLiveQuery` wants
 *  the query builder itself, not an awaited result. */
export const activeHabitsQuery = db
  .select()
  .from(habits)
  .where(and(isNull(habits.deletedAt), isNull(habits.archivedAt)))
  .orderBy(asc(habits.ritualOrder), asc(habits.createdAt));
