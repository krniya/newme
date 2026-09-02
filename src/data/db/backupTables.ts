/**
 * The allow-list of tables that go into a backup. Spec §9.
 *
 * Deliberately an allow-list rather than "every table minus a few". A table
 * added in two years' time is then a conscious decision — either it belongs
 * in the user's backup or it does not — instead of being silently swept in
 * (a leak) or silently left out (data loss on restore).
 *
 * Projections are excluded because they are rebuilt on import, which is what
 * guarantees a backup can never contain XP or streak numbers that disagree
 * with its own event history (spec §8.2).
 */
export const BACKUP_TABLES = [
  'rituals',
  'habits',
  'rewards',
  'events',
  'plan_items',
  'settings',
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

/** Rebuilt from `events` on import, so never written to a backup file. */
export const PROJECTION_TABLES = [
  'character_state',
  'attribute_state',
  'habit_stats',
  'daily_totals',
] as const;

/** Device-local bookkeeping that must not travel between devices. */
export const DEVICE_LOCAL_TABLES = ['backup_log'] as const;
