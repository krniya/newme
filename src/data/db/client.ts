import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import * as schema from './schema';

export const DATABASE_NAME = 'newme.db';

/**
 * The one and only datastore (spec §1.5).
 *
 * `enableChangeListener` is what powers Drizzle's `useLiveQuery`, so the UI
 * re-renders straight from SQLite rather than from a duplicated in-memory
 * store. That is the mechanism behind the one-tap check-off feeling instant
 * (spec §6.2): the write is local and the read is reactive, with nothing
 * asynchronous in between.
 */
export const sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

export const db = drizzle(sqlite, { schema });

export type Database = typeof db;

/**
 * WAL journaling and a foreign-key check, applied once at startup.
 * WAL matters here because snapshots (spec §8.3.2) read the database while
 * the UI is still writing to it.
 */
export function configurePragmas(): void {
  sqlite.execSync('PRAGMA journal_mode = WAL;');
  sqlite.execSync('PRAGMA foreign_keys = ON;');
}

export { schema };
