import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Local SQLite schema. Spec §9.
 *
 * This is the only datastore — there is no backend (spec §1.5). Two
 * consequences shape everything below:
 *
 *   1. No `user_id` anywhere. One device, one implicit user.
 *   2. The migration chain is a permanent public contract, because importing
 *      a two-year-old backup replays it (spec §8.3.4). Never edit a shipped
 *      migration; only append.
 *
 * Tables fall into three groups:
 *   definitions — mutable, authored by the user, merged by `updatedAt`
 *   events      — append-only, the source of truth for all progression
 *   projections — derived, rebuildable, never exported
 */

// ---------------------------------------------------------------------------
// Definitions
// ---------------------------------------------------------------------------

export const rituals = sqliteTable('rituals', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  icon: text('icon'),
  /** Minutes from midnight. */
  startTime: integer('start_time'),
  /** JSON array of weekdays, 0 = Sunday. */
  activeDays: text('active_days').notNull().default('[0,1,2,3,4,5,6]'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

export const habits = sqliteTable(
  'habits',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    /** 'habit' | 'daily' | 'task' */
    kind: text('kind').notNull(),
    /** 'positive' | 'negative' */
    polarity: text('polarity').notNull().default('positive'),
    /** trivial | easy | medium | hard | epic */
    difficulty: text('difficulty').notNull().default('easy'),
    /** JSON array of 1–2 attribute names. */
    attributes: text('attributes').notNull().default('[]'),

    // Implementation intention (spec §3.3). Required by the creation flow:
    // 20 extra seconds that materially improve adherence.
    cue: text('cue'),
    windowStart: integer('window_start'),
    windowEnd: integer('window_end'),
    place: text('place'),

    // Dose
    targetValue: real('target_value').notNull().default(1),
    targetUnit: text('target_unit').notNull().default('count'),
    rampSchedule: text('ramp_schedule'),

    // Scheduling
    scheduleType: text('schedule_type').notNull().default('none'),
    /** JSON, shape depends on scheduleType. See domain `Schedule`. */
    scheduleConfig: text('schedule_config').notNull().default('{}'),

    /** Tasks only: the day a one-off is due. `YYYY-MM-DD`. */
    dueDate: text('due_date'),

    ritualId: text('ritual_id').references(() => rituals.id),
    ritualOrder: integer('ritual_order'),

    // Health auto-completion (v2)
    healthSource: text('health_source'),
    healthThreshold: real('health_threshold'),

    archivedAt: integer('archived_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (t) => [index('idx_habits_ritual').on(t.ritualId)],
);

export const rewards = sqliteTable('rewards', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  cost: integer('cost').notNull(),
  redeemedCount: integer('redeemed_count').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

// ---------------------------------------------------------------------------
// Event log — append-only, the source of truth (spec §8.2)
// ---------------------------------------------------------------------------

export const events = sqliteTable(
  'events',
  {
    /** UUIDv7: time-sortable, and collision-free when merging two devices. */
    id: text('id').primaryKey(),
    type: text('type').notNull(),
    subjectId: text('subject_id'),
    /** JSON: value, evidence, and the multipliers actually applied. */
    payload: text('payload').notNull().default('{}'),
    /** The calendar day this belongs to, in the user's tz at write time. */
    localDate: text('local_date').notNull(),
    occurredAt: integer('occurred_at').notNull(),
    /** 'local' | 'imported' — provenance only, never affects replay. */
    origin: text('origin').notNull().default('local'),
  },
  (t) => [
    index('idx_events_date').on(t.localDate),
    index('idx_events_subject').on(t.subjectId, t.occurredAt),
  ],
);

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export const planItems = sqliteTable(
  'plan_items',
  {
    id: text('id').primaryKey(),
    localDate: text('local_date').notNull(),
    habitId: text('habit_id').references(() => habits.id),
    ritualId: text('ritual_id').references(() => rituals.id),
    startMinute: integer('start_minute'),
    durationMin: integer('duration_min'),
    /** Set when planned before the day began — drives the 1.15x multiplier. */
    plannedAhead: integer('planned_ahead', { mode: 'boolean' }).notNull().default(false),
    /** open | done | skipped | pushed */
    status: text('status').notNull().default('open'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (t) => [index('idx_plan_date').on(t.localDate)],
);

// ---------------------------------------------------------------------------
// Projections — derived from `events`, excluded from backups
// ---------------------------------------------------------------------------

export const characterState = sqliteTable('character_state', {
  /** Singleton row, always id = 1. */
  id: integer('id').primaryKey(),
  xpTotal: integer('xp_total').notNull().default(0),
  level: integer('level').notNull().default(1),
  gold: integer('gold').notNull().default(0),
  momentum: integer('momentum').notNull().default(60),
  freezeTokens: integer('freeze_tokens').notNull().default(0),
  tier: integer('tier').notNull().default(1),
  equipped: text('equipped').notNull().default('{}'),
  rebuiltAt: integer('rebuilt_at').notNull(),
});

export const attributeState = sqliteTable('attribute_state', {
  attribute: text('attribute').primaryKey(),
  xpTotal: integer('xp_total').notNull().default(0),
  level: integer('level').notNull().default(1),
});

export const habitStats = sqliteTable('habit_stats', {
  habitId: text('habit_id')
    .primaryKey()
    .references(() => habits.id),
  currentStreak: integer('current_streak').notNull().default(0),
  longestStreak: integer('longest_streak').notNull().default(0),
  lastCompletedOn: text('last_completed_on'),
  totalCompletions: integer('total_completions').notNull().default(0),
  adherence28: real('adherence_28d').notNull().default(0),
  /** 0–100, see domain `automaticity`. Replaces the streak as the headline
   *  metric once a habit matures (spec §3.6). */
  automaticity: real('automaticity').notNull().default(0),
  /** When the streak broke — the 48h repair window starts here. */
  brokenAt: integer('broken_at'),
});

export const dailyTotals = sqliteTable('daily_totals', {
  localDate: text('local_date').primaryKey(),
  rawXp: integer('raw_xp').notNull().default(0),
  bankedXp: integer('banked_xp').notNull().default(0),
  gold: integer('gold').notNull().default(0),
  completed: integer('completed').notNull().default(0),
  missed: integer('missed').notNull().default(0),
});

// ---------------------------------------------------------------------------
// Device-local bookkeeping — never exported
// ---------------------------------------------------------------------------

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const backupLog = sqliteTable('backup_log', {
  id: text('id').primaryKey(),
  /** snapshot | export | import */
  kind: text('kind').notNull(),
  /** restore | merge — imports only. */
  mode: text('mode'),
  fileName: text('file_name'),
  eventCount: integer('event_count'),
  bytes: integer('bytes'),
  createdAt: integer('created_at').notNull(),
});

// ---------------------------------------------------------------------------

export type HabitRow = typeof habits.$inferSelect;
export type NewHabitRow = typeof habits.$inferInsert;
export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
export type PlanItemRow = typeof planItems.$inferSelect;
export type CharacterStateRow = typeof characterState.$inferSelect;
export type HabitStatsRow = typeof habitStats.$inferSelect;
