import { reduceEvents } from '@/domain/events/reducer';
import { selectLevel, type ProgressionState } from '@/domain/events/state';
import { db } from '../db/client';
import { countAll, listAll } from '../repos/eventRepo';
import { writeProjections } from './writeProjections';

/**
 * Rebuild every projection from the event log. Spec §8.2.
 *
 * Runs on schema bump, after an import, and after an undo. It is the reason
 * corruption is survivable without a server: if a derived number is ever
 * wrong, the fix is to recompute it from the log rather than to file a
 * support ticket nobody can answer.
 *
 * Everything happens inside one transaction, so a crash mid-rebuild leaves
 * the previous projections intact rather than a half-truncated character.
 */

export interface RebuildResult {
  state: ProgressionState;
  eventCount: number;
  level: number;
  xpTotal: number;
  durationMs: number;
}

export async function rebuildProjections(): Promise<RebuildResult> {
  const started = Date.now();

  const log = await listAll();
  const state = reduceEvents(log);

  await db.transaction(async (tx) => {
    await writeProjections(tx, state, started);
  });

  return {
    state,
    eventCount: state.eventCount,
    level: selectLevel(state).level,
    xpTotal: state.xpTotal,
    durationMs: Date.now() - started,
  };
}

/** Persist the current in-memory state without re-reading the log. */
export async function saveProjections(state: ProgressionState): Promise<void> {
  await db.transaction(async (tx) => {
    await writeProjections(tx, state, Date.now());
  });
}

/**
 * Cheap staleness check: does the stored character reflect the whole log?
 *
 * Compares counts rather than recomputing, so it is safe on every launch. A
 * mismatch means a write landed without its projection update — always
 * recoverable by rebuilding.
 */
export async function projectionsAreStale(state: ProgressionState | null): Promise<boolean> {
  if (state === null) return true;
  return (await countAll()) !== state.eventCount;
}

export { CHARACTER_ROW_ID } from './writeProjections';
