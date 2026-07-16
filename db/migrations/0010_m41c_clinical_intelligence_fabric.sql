CREATE TABLE IF NOT EXISTS `m41c_scenario_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `scenario_id` text NOT NULL,
  `milestone` text NOT NULL DEFAULT 'M4.1C' CHECK (`milestone` = 'M4.1C'),
  `status` text NOT NULL CHECK (`status` IN ('running','passed','failed','reset')),
  `started_at` text NOT NULL,
  `completed_at` text,
  `assertions_passed` integer NOT NULL DEFAULT 0 CHECK (`assertions_passed` >= 0),
  `assertions_failed` integer NOT NULL DEFAULT 0 CHECK (`assertions_failed` >= 0),
  `evidence_json` text NOT NULL DEFAULT '{}',
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `production_rows` integer NOT NULL DEFAULT 0 CHECK (`production_rows` = 0),
  `live_writes` integer NOT NULL DEFAULT 0 CHECK (`live_writes` = 0),
  `is_current` integer NOT NULL DEFAULT 1 CHECK (`is_current` IN (0,1)),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `m41c_scenario_runs_current_idx`
  ON `m41c_scenario_runs` (`scenario_id`) WHERE `is_current` = 1;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_governance_decisions` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `subject_type` text NOT NULL CHECK (`subject_type` IN ('source','instrument_profile','pathway','knowledge_pack')),
  `subject_id` text NOT NULL,
  `subject_version` text NOT NULL,
  `decision_type` text NOT NULL CHECK (`decision_type` IN ('approve_demo','reject','exception','supersede','emergency_withdraw')),
  `decision_status` text NOT NULL CHECK (`decision_status` IN ('pending','signed','withdrawn')),
  `approver_roles_json` text NOT NULL DEFAULT '[]',
  `signatures_json` text NOT NULL DEFAULT '[]',
  `rationale` text NOT NULL,
  `effective_at` text NOT NULL,
  `review_due_at` text NOT NULL,
  `correlation_id` text NOT NULL,
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `m41c_governance_subject_idx`
  ON `m41c_governance_decisions` (`subject_type`,`subject_id`,`subject_version`,`created_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_knowledge_versions` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `knowledge_id` text NOT NULL,
  `version` text NOT NULL,
  `activation_state` text NOT NULL CHECK (`activation_state` IN ('draft','validation_pending','quarantined','demo_approved')),
  `source_id` text NOT NULL,
  `owner_role` text NOT NULL,
  `population_json` text NOT NULL,
  `license_state` text NOT NULL CHECK (`license_state` IN ('not_required','metadata_only','license_validation_pending','licensed_demo','restricted')),
  `effective_at` text,
  `review_due_at` text NOT NULL,
  `content_hash` text,
  `validation_json` text NOT NULL DEFAULT '{}',
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `created_at` text NOT NULL,
  UNIQUE (`knowledge_id`,`version`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_instrument_profiles` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `profile_key` text NOT NULL,
  `profile_version` text NOT NULL,
  `program` text NOT NULL,
  `activation_state` text NOT NULL CHECK (`activation_state` IN ('draft','validation_pending','quarantined','demo_approved')),
  `source_id` text NOT NULL,
  `license_state` text NOT NULL CHECK (`license_state` IN ('not_required','metadata_only','license_validation_pending','licensed_demo','restricted')),
  `content_hash` text,
  `qualification_ids_json` text NOT NULL DEFAULT '[]',
  `reassessment_cadence` text NOT NULL,
  `external_mappings_json` text NOT NULL DEFAULT '[]',
  `validation_json` text NOT NULL DEFAULT '{}',
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `created_at` text NOT NULL,
  UNIQUE (`profile_key`,`profile_version`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `m41c_instrument_program_state_idx`
  ON `m41c_instrument_profiles` (`program`,`activation_state`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_quarantine_entries` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `artifact_type` text NOT NULL,
  `artifact_id` text NOT NULL,
  `source_path` text NOT NULL,
  `reason_codes_json` text NOT NULL,
  `enforcement` text NOT NULL CHECK (`enforcement` IN ('non_executable','read_only_label')),
  `production_use_blocked` integer NOT NULL DEFAULT 1 CHECK (`production_use_blocked` = 1),
  `demo_recommendation_blocked` integer NOT NULL DEFAULT 1 CHECK (`demo_recommendation_blocked` = 1),
  `reviewed_by_role` text NOT NULL,
  `reviewed_at` text NOT NULL,
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  UNIQUE (`artifact_type`,`artifact_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_pathway_definitions` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `pathway_key` text NOT NULL,
  `pathway_version` text NOT NULL,
  `activation_state` text NOT NULL CHECK (`activation_state` IN ('draft','validation_pending','quarantined','demo_approved')),
  `source_ids_json` text NOT NULL DEFAULT '[]',
  `required_approver_roles_json` text NOT NULL DEFAULT '[]',
  `required_competency_ids_json` text NOT NULL DEFAULT '[]',
  `steps_json` text NOT NULL,
  `validation_record_id` text,
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `created_at` text NOT NULL,
  UNIQUE (`pathway_key`,`pathway_version`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_longitudinal_events` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `episode_id` text NOT NULL,
  `subject_id` text NOT NULL CHECK (`subject_id` LIKE 'SYNTH-%'),
  `sequence` integer NOT NULL CHECK (`sequence` > 0),
  `event_type` text NOT NULL,
  `stage` text NOT NULL,
  `source_ids_json` text NOT NULL DEFAULT '[]',
  `payload_json` text NOT NULL,
  `correlation_id` text NOT NULL,
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `occurred_at` text NOT NULL,
  UNIQUE (`episode_id`,`sequence`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `m41c_longitudinal_episode_idx`
  ON `m41c_longitudinal_events` (`episode_id`,`occurred_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_recommendations` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `episode_id` text NOT NULL,
  `pathway_id` text NOT NULL,
  `pathway_version` text NOT NULL,
  `source_ids_json` text NOT NULL DEFAULT '[]',
  `recommendation_json` text NOT NULL,
  `human_gate_json` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('proposed','approved_for_demo','modified_for_demo','rejected')),
  `production_action_blocked` integer NOT NULL DEFAULT 1 CHECK (`production_action_blocked` = 1),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_external_projections` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `episode_id` text NOT NULL,
  `target_system` text NOT NULL CHECK (`target_system` IN ('CMBHS_SIMULATOR','FHIR_R4_INTERNAL')),
  `resource_type` text NOT NULL,
  `mapping_version` text NOT NULL,
  `direction` text NOT NULL CHECK (`direction` IN ('internal_projection','reconciliation_read')),
  `payload_json` text NOT NULL,
  `reconciliation_status` text NOT NULL,
  `external_write_blocked` integer NOT NULL DEFAULT 1 CHECK (`external_write_blocked` = 1),
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_competency_bindings` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `actor_id` text NOT NULL CHECK (`actor_id` LIKE 'SYNTH-%'),
  `actor_role` text NOT NULL,
  `competency_id` text NOT NULL,
  `subject_type` text NOT NULL CHECK (`subject_type` IN ('instrument_profile','pathway')),
  `subject_id` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('current','expired','supervised_only','missing')),
  `valid_from` text,
  `expires_at` text,
  `supervisor_role` text,
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  UNIQUE (`actor_id`,`competency_id`,`subject_id`)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_monitoring_signals` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `pathway_id` text NOT NULL,
  `signal_type` text NOT NULL,
  `cadence` text NOT NULL CHECK (`cadence` IN ('daily','weekly','monthly','quarterly','annual')),
  `numerator` integer NOT NULL CHECK (`numerator` >= 0),
  `denominator` integer NOT NULL CHECK (`denominator` > 0),
  `threshold_json` text NOT NULL,
  `status` text NOT NULL CHECK (`status` IN ('within_limit','review_required','withdrawal_required')),
  `workplan_item_id` text,
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `measured_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41c_audit_events` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41c_scenario_runs`(`id`) ON DELETE RESTRICT,
  `aggregate_id` text NOT NULL,
  `sequence` integer NOT NULL CHECK (`sequence` > 0),
  `event_type` text NOT NULL,
  `actor_id` text NOT NULL,
  `actor_role` text NOT NULL,
  `entity_type` text NOT NULL,
  `entity_id` text NOT NULL,
  `source_ids_json` text NOT NULL DEFAULT '[]',
  `before_json` text,
  `after_json` text,
  `rationale` text,
  `correlation_id` text NOT NULL,
  `evidence_class` text NOT NULL DEFAULT 'synthetic_clinical_demo' CHECK (`evidence_class` = 'synthetic_clinical_demo'),
  `occurred_at` text NOT NULL,
  UNIQUE (`aggregate_id`,`sequence`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `m41c_audit_correlation_idx`
  ON `m41c_audit_events` (`correlation_id`,`occurred_at`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41c_scenario_runs_no_delete`
BEFORE DELETE ON `m41c_scenario_runs`
BEGIN SELECT RAISE(ABORT, 'M41C_SCENARIO_HISTORY_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41c_scenario_runs_controlled_update`
BEFORE UPDATE ON `m41c_scenario_runs`
WHEN NOT (
  OLD.`is_current` = 1 AND NEW.`is_current` = 0 AND
  OLD.`id` = NEW.`id` AND OLD.`scenario_id` = NEW.`scenario_id` AND
  OLD.`milestone` = NEW.`milestone` AND OLD.`status` = NEW.`status` AND
  OLD.`started_at` = NEW.`started_at` AND OLD.`completed_at` IS NEW.`completed_at` AND
  OLD.`assertions_passed` = NEW.`assertions_passed` AND OLD.`assertions_failed` = NEW.`assertions_failed` AND
  OLD.`evidence_json` = NEW.`evidence_json` AND OLD.`evidence_class` = NEW.`evidence_class` AND
  OLD.`production_rows` = NEW.`production_rows` AND OLD.`live_writes` = NEW.`live_writes` AND
  OLD.`created_at` = NEW.`created_at`
)
BEGIN SELECT RAISE(ABORT, 'M41C_SCENARIO_HISTORY_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41c_governance_decisions_no_update`
BEFORE UPDATE ON `m41c_governance_decisions`
BEGIN SELECT RAISE(ABORT, 'M41C_GOVERNANCE_DECISION_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41c_governance_decisions_no_delete`
BEFORE DELETE ON `m41c_governance_decisions`
BEGIN SELECT RAISE(ABORT, 'M41C_GOVERNANCE_DECISION_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41c_longitudinal_events_no_update`
BEFORE UPDATE ON `m41c_longitudinal_events`
BEGIN SELECT RAISE(ABORT, 'M41C_LONGITUDINAL_EVENT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41c_longitudinal_events_no_delete`
BEFORE DELETE ON `m41c_longitudinal_events`
BEGIN SELECT RAISE(ABORT, 'M41C_LONGITUDINAL_EVENT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41c_audit_events_no_update`
BEFORE UPDATE ON `m41c_audit_events`
BEGIN SELECT RAISE(ABORT, 'M41C_AUDIT_EVENT_IMMUTABLE'); END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41c_audit_events_no_delete`
BEFORE DELETE ON `m41c_audit_events`
BEGIN SELECT RAISE(ABORT, 'M41C_AUDIT_EVENT_IMMUTABLE'); END;
