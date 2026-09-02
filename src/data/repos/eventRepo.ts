import { asc, count, eq, gte, lte, and } from 'drizzle-orm';
import type { LocalDate } from '@/domain/types';
import type { DomainEvent, EventType } from '@/domain/events/types';
import { db } from '../db/client';
import { events, type EventRow, type NewEventRow } from '../db/schema';
import { uuidv7 } from '@/lib/uuid';

/**
 * The event log's only writer. Spec §8.2.
 *
 * Append-only by contract: there is no update and no delete. Correcting
 * something means appending a compensating event (`habit.uncompleted`), which
 * is what keeps the log a faithful record of what actually happened and what
 * makes merge-on-import conflict-free.
 *
 * Nothing here computes XP. The reducer does that, from the log.
 */

/** An event ready to append — id and ordering are assigned here. */
export type DraftEvent = Omit<DomainEvent, 'id' | 'occurredAt'> & { occurredAt?: number };

function toRow(event: DomainEvent, origin: 'local' | 'imported'): NewEventRow {
  return {
    id: event.id,
    type: event.type,
    subjectId: event.subjectId,
    payload: JSON.stringify(event.payload),
    localDate: event.localDate,
    occurredAt: event.occurredAt,
    origin,
  };
}

function fromRow(row: EventRow): DomainEvent {
  return {
    id: row.id,
    type: row.type as EventType,
    subjectId: row.subjectId,
    localDate: row.localDate,
    occurredAt: row.occurredAt,
    payload: JSON.parse(row.payload),
  } as DomainEvent;
}

/** Append one event, assigning its id and timestamp. Returns what was stored. */
export async function append(draft: DraftEvent): Promise<DomainEvent> {
  const event = {
    ...draft,
    id: uuidv7(),
    occurredAt: draft.occurredAt ?? Date.now(),
  } as DomainEvent;

  await db.insert(events).values(toRow(event, 'local'));
  return event;
}

/**
 * Append many events atomically — a ritual completing five habits must not
 * half-land if the app is killed mid-write.
 */
export async function appendAll(drafts: DraftEvent[]): Promise<DomainEvent[]> {
  if (drafts.length === 0) return [];

  const now = Date.now();
  const built = drafts.map(
    (draft) => ({ ...draft, id: uuidv7(), occurredAt: draft.occurredAt ?? now }) as DomainEvent,
  );

  await db.insert(events).values(built.map((event) => toRow(event, 'local')));
  return built;
}

/**
 * Insert events that came from a backup file, ignoring ones already present.
 *
 * Dedupe by primary key is what makes import idempotent: re-importing the
 * same `.newme` file twice changes nothing the second time (spec §8.3.4).
 */
export async function insertImported(imported: DomainEvent[]): Promise<number> {
  if (imported.length === 0) return 0;

  const result = await db
    .insert(events)
    .values(imported.map((event) => toRow(event, 'imported')))
    .onConflictDoNothing();

  return result.changes ?? 0;
}

/** The whole log, in replay order. Used by `rebuildProjections`. */
export async function listAll(): Promise<DomainEvent[]> {
  const rows = await db.select().from(events).orderBy(asc(events.occurredAt), asc(events.id));
  return rows.map(fromRow);
}

export async function listByDate(date: LocalDate): Promise<DomainEvent[]> {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.localDate, date))
    .orderBy(asc(events.occurredAt), asc(events.id));
  return rows.map(fromRow);
}

export async function listBetween(from: LocalDate, to: LocalDate): Promise<DomainEvent[]> {
  const rows = await db
    .select()
    .from(events)
    .where(and(gte(events.localDate, from), lte(events.localDate, to)))
    .orderBy(asc(events.occurredAt), asc(events.id));
  return rows.map(fromRow);
}

export async function listBySubject(subjectId: string): Promise<DomainEvent[]> {
  const rows = await db
    .select()
    .from(events)
    .where(eq(events.subjectId, subjectId))
    .orderBy(asc(events.occurredAt), asc(events.id));
  return rows.map(fromRow);
}

export async function countAll(): Promise<number> {
  const [row] = await db.select({ value: count() }).from(events);
  return row?.value ?? 0;
}
