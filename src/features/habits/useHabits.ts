import { useMemo } from 'react';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import type { HabitDefinition } from '@/domain/habit/definition';
import { activeHabitsQuery, rowToHabit } from '@/data/repos/habitRepo';

/**
 * Live list of active habits, straight from SQLite.
 *
 * `useLiveQuery` re-runs on any write to the table, so creating a habit
 * updates the list with no store, no cache invalidation and no refetch. That
 * is the whole reason `enableChangeListener` is on in the db client: the UI
 * reads from the database rather than from a duplicate in memory, which is
 * what keeps a check-off feeling instant (spec §7.3).
 */
export function useActiveHabits(): { habits: HabitDefinition[]; loading: boolean } {
  const { data, error } = useLiveQuery(activeHabitsQuery);

  const habits = useMemo(() => (data ?? []).map(rowToHabit), [data]);

  if (error) {
    // A malformed row degrades to "unscheduled" rather than throwing
    // (see serialize.ts), so an error here means the query itself failed.
    console.warn('[habits] live query failed', error);
  }

  return { habits, loading: data === undefined };
}
