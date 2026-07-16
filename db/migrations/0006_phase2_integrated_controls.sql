-- Phase 2 shared control plane for M2.2, M2.3, and M2.4.
-- All sprint evidence is synthetic_demo; production rows are prohibited by the scenario boundary.

CREATE TABLE `phase2_care_episodes` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `case_id` TEXT NOT NULL UNIQUE,
  `referral_id` TEXT NOT NULL UNIQUE,
  `youth_id` TEXT NOT NULL,
  `youth_display_label` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `status` TEXT NOT NULL DEFAULT 'active' CHECK (`status` IN ('active','discharging','discharged','closed')),
  `cans_assessment_id` TEXT,
  `cans_version` INTEGER CHECK (`cans_version` IS NULL OR `cans_version` > 0),
  `mhtcm_plan_id` TEXT,
  `mhrs_plan_id` TEXT,
  `gro_placement_id` TEXT,
  `version` INTEGER NOT NULL DEFAULT 1 CHECK (`version` > 0),
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_phase2_episode_mode_status` ON `phase2_care_episodes` (`evidence_class`,`status`,`updated_at`);
--> statement-breakpoint

CREATE TABLE `phase2_care_links` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `episode_id` TEXT NOT NULL REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `case_id` TEXT NOT NULL,
  `source_domain` TEXT NOT NULL CHECK (`source_domain` IN ('SHARED','MHTCM','MHRS','GRO')),
  `source_type` TEXT NOT NULL,
  `source_id` TEXT NOT NULL,
  `source_version` INTEGER NOT NULL CHECK (`source_version` > 0),
  `target_domain` TEXT NOT NULL CHECK (`target_domain` IN ('SHARED','MHTCM','MHRS','GRO')),
  `target_type` TEXT NOT NULL,
  `target_id` TEXT NOT NULL,
  `target_version` INTEGER NOT NULL CHECK (`target_version` > 0),
  `relation` TEXT NOT NULL CHECK (`relation` IN ('derived_from','fulfills','coordinates_with','transitions_to','read_only_reference')),
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase2_care_link_unique` ON `phase2_care_links` (`source_domain`,`source_type`,`source_id`,`source_version`,`target_domain`,`target_type`,`target_id`,`target_version`,`relation`);
--> statement-breakpoint

CREATE TABLE `phase2_work_items` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `episode_id` TEXT NOT NULL REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `domain` TEXT NOT NULL CHECK (`domain` IN ('SHARED','MHTCM','MHRS','GRO')),
  `title` TEXT NOT NULL,
  `source_type` TEXT NOT NULL,
  `source_id` TEXT NOT NULL,
  `status` TEXT NOT NULL CHECK (`status` IN ('pending','in_progress','blocked','awaiting_approval','completed','cancelled')),
  `priority` TEXT NOT NULL CHECK (`priority` IN ('routine','urgent','critical')),
  `assigned_role` TEXT NOT NULL,
  `assigned_to` TEXT,
  `due_at` TEXT NOT NULL,
  `escalation_level` TEXT NOT NULL DEFAULT 'none' CHECK (`escalation_level` IN ('none','supervisor','director','executive')),
  `escalated_at` TEXT,
  `escalation_reason` TEXT,
  `exception_code` TEXT,
  `exception_reason` TEXT,
  `version` INTEGER NOT NULL DEFAULT 1 CHECK (`version` > 0),
  `created_at` TEXT NOT NULL,
  `updated_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_phase2_work_queue` ON `phase2_work_items` (`domain`,`status`,`due_at`,`priority`);
--> statement-breakpoint

CREATE TABLE `phase2_alerts` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `episode_id` TEXT NOT NULL REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `domain` TEXT NOT NULL CHECK (`domain` IN ('SHARED','MHTCM','MHRS','GRO')),
  `alert_type` TEXT NOT NULL,
  `source_type` TEXT NOT NULL,
  `source_id` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `status` TEXT NOT NULL CHECK (`status` IN ('open','acknowledged','resolved','expired')),
  `priority` TEXT NOT NULL CHECK (`priority` IN ('routine','urgent','critical')),
  `due_at` TEXT NOT NULL,
  `assigned_role` TEXT NOT NULL,
  `assigned_to` TEXT,
  `escalation_level` TEXT NOT NULL DEFAULT 'none' CHECK (`escalation_level` IN ('none','supervisor','director','executive')),
  `acknowledged_at` TEXT,
  `resolved_at` TEXT,
  `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase2_alert_source` ON `phase2_alerts` (`domain`,`alert_type`,`source_type`,`source_id`,`due_at`);
--> statement-breakpoint
CREATE INDEX `idx_phase2_alert_queue` ON `phase2_alerts` (`domain`,`status`,`due_at`,`priority`);
--> statement-breakpoint

CREATE TABLE `phase2_handoffs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `episode_id` TEXT NOT NULL REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `from_domain` TEXT NOT NULL CHECK (`from_domain` IN ('SHARED','MHTCM','MHRS','GRO')),
  `to_domain` TEXT NOT NULL CHECK (`to_domain` IN ('SHARED','MHTCM','MHRS','GRO')),
  `status` TEXT NOT NULL CHECK (`status` IN ('initiated','accepted','rejected','returned','completed')),
  `reason` TEXT NOT NULL,
  `payload_json` TEXT NOT NULL DEFAULT '{}',
  `initiated_by` TEXT NOT NULL,
  `initiated_at` TEXT NOT NULL,
  `due_at` TEXT NOT NULL,
  `accepted_by` TEXT,
  `accepted_at` TEXT,
  `completed_at` TEXT,
  `version` INTEGER NOT NULL DEFAULT 1 CHECK (`version` > 0)
);
--> statement-breakpoint
CREATE INDEX `idx_phase2_handoff_queue` ON `phase2_handoffs` (`to_domain`,`status`,`due_at`);
--> statement-breakpoint

CREATE TABLE `phase2_audit_events` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `episode_id` TEXT REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `domain` TEXT NOT NULL CHECK (`domain` IN ('SHARED','MHTCM','MHRS','GRO')),
  `event_type` TEXT NOT NULL CHECK (`event_type` IN ('access','assignment','approval','handoff','material_change','gate_decision','scenario')),
  `action` TEXT NOT NULL,
  `entity_type` TEXT NOT NULL,
  `entity_id` TEXT NOT NULL,
  `actor_id` TEXT NOT NULL,
  `actor_role` TEXT NOT NULL,
  `reason` TEXT NOT NULL,
  `before_json` TEXT,
  `after_json` TEXT,
  `changed_fields_json` TEXT NOT NULL DEFAULT '[]',
  `correlation_id` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `occurred_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_phase2_audit_entity` ON `phase2_audit_events` (`domain`,`entity_type`,`entity_id`,`occurred_at`);
--> statement-breakpoint
CREATE TRIGGER `phase2_audit_events_no_update` BEFORE UPDATE ON `phase2_audit_events`
BEGIN SELECT RAISE(ABORT, 'PHASE2_AUDIT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER `phase2_audit_events_no_delete` BEFORE DELETE ON `phase2_audit_events`
BEGIN SELECT RAISE(ABORT, 'PHASE2_AUDIT_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE `phase2_claim_handoffs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `episode_id` TEXT NOT NULL REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `program` TEXT NOT NULL CHECK (`program` IN ('MHTCM','MHRS')),
  `encounter_id` TEXT NOT NULL,
  `procedure_code` TEXT NOT NULL CHECK (`procedure_code` IN ('T1017','H2014','H2017')),
  `status` TEXT NOT NULL CHECK (`status` IN ('blocked','ready','handed_off','returned')),
  `findings_json` TEXT NOT NULL DEFAULT '[]',
  `evaluator_version` TEXT NOT NULL,
  `decided_at` TEXT NOT NULL,
  `handed_off_at` TEXT,
  `correlation_id` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase2_claim_encounter` ON `phase2_claim_handoffs` (`program`,`encounter_id`);
--> statement-breakpoint

CREATE TABLE `phase2_program_snapshots` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `episode_id` TEXT NOT NULL REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `domain` TEXT NOT NULL CHECK (`domain` IN ('SHARED','MHTCM','MHRS','GRO')),
  `aggregate_type` TEXT NOT NULL,
  `aggregate_id` TEXT NOT NULL,
  `aggregate_version` INTEGER NOT NULL CHECK (`aggregate_version` > 0),
  `payload_json` TEXT NOT NULL,
  `evidence_class` TEXT NOT NULL CHECK (`evidence_class` IN ('synthetic_demo','production')),
  `is_current` INTEGER NOT NULL DEFAULT 1 CHECK (`is_current` IN (0,1)),
  `created_at` TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase2_snapshot_version` ON `phase2_program_snapshots` (`domain`,`aggregate_type`,`aggregate_id`,`aggregate_version`);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_phase2_snapshot_current` ON `phase2_program_snapshots` (`domain`,`aggregate_type`,`aggregate_id`) WHERE `is_current` = 1;
--> statement-breakpoint
CREATE TRIGGER `phase2_program_snapshots_no_update_payload`
BEFORE UPDATE OF `payload_json`, `aggregate_version`, `evidence_class`, `created_at` ON `phase2_program_snapshots`
BEGIN SELECT RAISE(ABORT, 'PHASE2_SNAPSHOT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER `phase2_program_snapshots_no_delete` BEFORE DELETE ON `phase2_program_snapshots`
BEGIN SELECT RAISE(ABORT, 'PHASE2_SNAPSHOT_IMMUTABLE'); END;
--> statement-breakpoint

CREATE TABLE `phase2_scenario_runs` (
  `id` TEXT PRIMARY KEY NOT NULL,
  `milestone` TEXT NOT NULL CHECK (`milestone` IN ('M2.2','M2.3','M2.4','PHASE2_EXIT')),
  `scenario_type` TEXT NOT NULL,
  `status` TEXT NOT NULL CHECK (`status` IN ('not_started','running','passed','failed')),
  `episode_id` TEXT NOT NULL REFERENCES `phase2_care_episodes`(`id`) ON DELETE RESTRICT,
  `started_at` TEXT NOT NULL,
  `completed_at` TEXT,
  `assertions_passed` INTEGER NOT NULL DEFAULT 0 CHECK (`assertions_passed` >= 0),
  `assertions_failed` INTEGER NOT NULL DEFAULT 0 CHECK (`assertions_failed` >= 0),
  `evidence_json` TEXT NOT NULL DEFAULT '{}'
);
--> statement-breakpoint
CREATE INDEX `idx_phase2_scenario_status` ON `phase2_scenario_runs` (`milestone`,`status`,`started_at`);
