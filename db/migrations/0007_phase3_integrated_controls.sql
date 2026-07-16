-- Phase 3 shared control plane for M3.1, M3.2, M3.3, and M3.4.
-- Corporate Office support remains linked to the accepted synthetic Phase 2 episode.

CREATE TABLE `phase3_support_cases` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `source_episode_id` TEXT NOT NULL REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `status` TEXT NOT NULL DEFAULT 'active' CHECK (`status` IN ('active','completed','closed')),
  `version` INTEGER NOT NULL DEFAULT 1 CHECK (`version` > 0),
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase3_support_episode` ON `phase3_support_cases` (`source_episode_id`,`evidence_class`);
--> statement-breakpoint

CREATE TABLE `phase3_support_links` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `support_case_id` TEXT NOT NULL REFERENCES `phase3_support_cases`(`id`) ON DELETE RESTRICT,
  `domain` TEXT NOT NULL CHECK (`domain` IN ('COMPLIANCE','REVENUE','WORKFORCE','GAD')),
  `source_division` TEXT NOT NULL CHECK (`source_division` IN ('BHC','GRO','EO','GAD')),
  `source_type` TEXT NOT NULL,
  `source_id` TEXT NOT NULL,
  `target_type` TEXT NOT NULL,
  `target_id` TEXT NOT NULL,
  `relation` TEXT NOT NULL CHECK (`relation` IN ('enables','assures','funds','staffs','maintains')),
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase3_support_link` ON `phase3_support_links` (`domain`,`source_type`,`source_id`,`target_type`,`target_id`,`relation`);
--> statement-breakpoint

CREATE TABLE `phase3_work_items` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `support_case_id` TEXT NOT NULL REFERENCES `phase3_support_cases`(`id`) ON DELETE RESTRICT,
  `domain` TEXT NOT NULL CHECK (`domain` IN ('COMPLIANCE','REVENUE','WORKFORCE','GAD')),
  `title` TEXT NOT NULL,
  `source_type` TEXT NOT NULL,
  `source_id` TEXT NOT NULL,
  `status` TEXT NOT NULL CHECK (`status` IN ('pending','in_progress','awaiting_review','completed','cancelled')),
  `priority` TEXT NOT NULL CHECK (`priority` IN ('routine','urgent','critical')),
  `assigned_role` TEXT NOT NULL,
  `assigned_to` TEXT,
  `due_at` TEXT NOT NULL,
  `completed_at` TEXT,
  `evidence_ids_json` TEXT NOT NULL DEFAULT '[]',
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_phase3_work_queue` ON `phase3_work_items` (`domain`,`status`,`due_at`,`priority`);
--> statement-breakpoint

CREATE TABLE `phase3_audit_events` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `support_case_id` TEXT NOT NULL REFERENCES `phase3_support_cases`(`id`) ON DELETE RESTRICT,
  `domain` TEXT NOT NULL CHECK (`domain` IN ('COMPLIANCE','REVENUE','WORKFORCE','GAD')),
  `action` TEXT NOT NULL CHECK (`action` IN ('access','change','approval','disclosure','export','administrative_action','routing','gate_decision','scenario')),
  `entity_type` TEXT NOT NULL,
  `entity_id` TEXT NOT NULL,
  `actor_id` TEXT NOT NULL,
  `actor_role` TEXT NOT NULL,
  `reason` TEXT NOT NULL,
  `correlation_id` TEXT NOT NULL,
  `before_json` TEXT,
  `after_json` TEXT,
  `changed_fields_json` TEXT NOT NULL DEFAULT '[]',
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `occurred_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_phase3_audit_entity` ON `phase3_audit_events` (`domain`,`entity_type`,`entity_id`,`occurred_at`);
--> statement-breakpoint
CREATE TRIGGER `phase3_audit_events_no_update` BEFORE UPDATE ON `phase3_audit_events`
BEGIN SELECT RAISE(ABORT, 'PHASE3_AUDIT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER `phase3_audit_events_no_delete` BEFORE DELETE ON `phase3_audit_events`
BEGIN SELECT RAISE(ABORT, 'PHASE3_AUDIT_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE `phase3_module_snapshots` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `support_case_id` TEXT NOT NULL REFERENCES `phase3_support_cases`(`id`) ON DELETE RESTRICT,
  `milestone` TEXT NOT NULL CHECK (`milestone` IN ('M3.1','M3.2','M3.3','M3.4')),
  `aggregate_type` TEXT NOT NULL,
  `aggregate_id` TEXT NOT NULL,
  `aggregate_version` INTEGER NOT NULL CHECK (`aggregate_version` > 0),
  `payload_json` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `is_current` INTEGER NOT NULL DEFAULT 1 CHECK (`is_current` IN (0,1)),
  `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase3_snapshot_version` ON `phase3_module_snapshots` (`milestone`,`aggregate_type`,`aggregate_id`,`aggregate_version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase3_snapshot_current` ON `phase3_module_snapshots` (`milestone`,`aggregate_type`,`aggregate_id`) WHERE `is_current` = 1;
--> statement-breakpoint
CREATE TRIGGER `phase3_module_snapshots_no_update_payload`
BEFORE UPDATE OF `payload_json`, `aggregate_version`, `evidence_class`, `created_at` ON `phase3_module_snapshots`
BEGIN SELECT RAISE(ABORT, 'PHASE3_SNAPSHOT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER `phase3_module_snapshots_no_delete` BEFORE DELETE ON `phase3_module_snapshots`
BEGIN SELECT RAISE(ABORT, 'PHASE3_SNAPSHOT_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE `phase3_scenario_runs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `milestone` TEXT NOT NULL CHECK (`milestone` IN ('M3.1','M3.2','M3.3','M3.4','PHASE3_EXIT')),
  `scenario_type` TEXT NOT NULL,
  `status` TEXT NOT NULL CHECK (`status` IN ('not_started','running','passed','failed')),
  `support_case_id` TEXT NOT NULL REFERENCES `phase3_support_cases`(`id`) ON DELETE RESTRICT,
  `started_at` TEXT NOT NULL,
  `completed_at` TEXT,
  `assertions_passed` INTEGER NOT NULL DEFAULT 0 CHECK (`assertions_passed` >= 0),
  `assertions_failed` INTEGER NOT NULL DEFAULT 0 CHECK (`assertions_failed` >= 0),
  `evidence_json` TEXT NOT NULL DEFAULT '{}',
  `is_current` INTEGER NOT NULL DEFAULT 1 CHECK (`is_current` IN (0,1))
);
--> statement-breakpoint
CREATE INDEX `idx_phase3_scenario_status` ON `phase3_scenario_runs` (`milestone`,`status`,`started_at`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase3_scenario_current` ON `phase3_scenario_runs` (`support_case_id`,`milestone`) WHERE `is_current` = 1;
--> statement-breakpoint

CREATE TABLE `phase3_demo_controls` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `environment_id` TEXT NOT NULL UNIQUE,
  `environment_label` TEXT NOT NULL,
  `data_store_label` TEXT NOT NULL,
  `reset_token` TEXT NOT NULL,
  `kill_switch_enabled` INTEGER NOT NULL DEFAULT 0 CHECK (`kill_switch_enabled` IN (0,1)),
  `production_writes_blocked` INTEGER NOT NULL DEFAULT 1 CHECK (`production_writes_blocked` IN (0,1)),
  `data_expires_at` TEXT NOT NULL,
  `access_reviewed_at` TEXT NOT NULL,
  `access_reviewed_by` TEXT NOT NULL,
  `last_reset_at` TEXT,
  `updated_at` TEXT NOT NULL
);
