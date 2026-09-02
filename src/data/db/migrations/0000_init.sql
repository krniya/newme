CREATE TABLE `attribute_state` (
	`attribute` text PRIMARY KEY NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `backup_log` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`mode` text,
	`file_name` text,
	`event_count` integer,
	`bytes` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `character_state` (
	`id` integer PRIMARY KEY NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`momentum` integer DEFAULT 60 NOT NULL,
	`freeze_tokens` integer DEFAULT 0 NOT NULL,
	`tier` integer DEFAULT 1 NOT NULL,
	`equipped` text DEFAULT '{}' NOT NULL,
	`rebuilt_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_totals` (
	`local_date` text PRIMARY KEY NOT NULL,
	`raw_xp` integer DEFAULT 0 NOT NULL,
	`banked_xp` integer DEFAULT 0 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`completed` integer DEFAULT 0 NOT NULL,
	`missed` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`subject_id` text,
	`payload` text DEFAULT '{}' NOT NULL,
	`local_date` text NOT NULL,
	`occurred_at` integer NOT NULL,
	`origin` text DEFAULT 'local' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_events_date` ON `events` (`local_date`);--> statement-breakpoint
CREATE INDEX `idx_events_subject` ON `events` (`subject_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `habit_stats` (
	`habit_id` text PRIMARY KEY NOT NULL,
	`current_streak` integer DEFAULT 0 NOT NULL,
	`longest_streak` integer DEFAULT 0 NOT NULL,
	`last_completed_on` text,
	`total_completions` integer DEFAULT 0 NOT NULL,
	`adherence_28d` real DEFAULT 0 NOT NULL,
	`automaticity` real DEFAULT 0 NOT NULL,
	`broken_at` integer,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`kind` text NOT NULL,
	`polarity` text DEFAULT 'positive' NOT NULL,
	`difficulty` text DEFAULT 'easy' NOT NULL,
	`attributes` text DEFAULT '[]' NOT NULL,
	`cue` text,
	`window_start` integer,
	`window_end` integer,
	`place` text,
	`target_value` real DEFAULT 1 NOT NULL,
	`target_unit` text DEFAULT 'count' NOT NULL,
	`ramp_schedule` text,
	`schedule_type` text DEFAULT 'none' NOT NULL,
	`schedule_config` text DEFAULT '{}' NOT NULL,
	`ritual_id` text,
	`ritual_order` integer,
	`health_source` text,
	`health_threshold` real,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`ritual_id`) REFERENCES `rituals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_habits_ritual` ON `habits` (`ritual_id`);--> statement-breakpoint
CREATE TABLE `plan_items` (
	`id` text PRIMARY KEY NOT NULL,
	`local_date` text NOT NULL,
	`habit_id` text,
	`ritual_id` text,
	`start_minute` integer,
	`duration_min` integer,
	`planned_ahead` integer DEFAULT false NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`habit_id`) REFERENCES `habits`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`ritual_id`) REFERENCES `rituals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_plan_date` ON `plan_items` (`local_date`);--> statement-breakpoint
CREATE TABLE `rewards` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`cost` integer NOT NULL,
	`redeemed_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `rituals` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`icon` text,
	`start_time` integer,
	`active_days` text DEFAULT '[0,1,2,3,4,5,6]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
