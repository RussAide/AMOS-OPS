CREATE TABLE IF NOT EXISTS `m41a_scenario_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `scenario_id` text NOT NULL,
  `milestone` text NOT NULL DEFAULT 'M4.1A' CHECK (`milestone` = 'M4.1A'),
  `status` text NOT NULL CHECK (`status` IN ('running','passed','failed','reset')),
  `started_at` text NOT NULL,
  `completed_at` text,
  `assertions_passed` integer NOT NULL DEFAULT 0,
  `assertions_failed` integer NOT NULL DEFAULT 0,
  `evidence_json` text NOT NULL DEFAULT '{}',
  `evidence_class` text NOT NULL DEFAULT 'synthetic_demo' CHECK (`evidence_class` = 'synthetic_demo'),
  `is_current` integer NOT NULL DEFAULT 1 CHECK (`is_current` IN (0,1)),
  `created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `m41a_scenario_runs_current_idx`
  ON `m41a_scenario_runs` (`scenario_id`) WHERE `is_current` = 1;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41a_dashboard_snapshots` (
  `id` text PRIMARY KEY NOT NULL,
  `run_id` text NOT NULL REFERENCES `m41a_scenario_runs`(`id`) ON DELETE RESTRICT,
  `scope` text NOT NULL CHECK (`scope` IN ('ENTERPRISE','BHC','GRO','EO','GAD')),
  `snapshot_version` integer NOT NULL,
  `payload_json` text NOT NULL,
  `source_hashes_json` text NOT NULL DEFAULT '[]',
  `reconciliation_status` text NOT NULL CHECK (`reconciliation_status` IN ('reconciled','exception')),
  `evidence_class` text NOT NULL DEFAULT 'synthetic_demo' CHECK (`evidence_class` = 'synthetic_demo'),
  `is_current` integer NOT NULL DEFAULT 1 CHECK (`is_current` IN (0,1)),
  `created_at` text NOT NULL,
  UNIQUE (`scope`,`snapshot_version`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `m41a_dashboard_snapshots_current_idx`
  ON `m41a_dashboard_snapshots` (`scope`) WHERE `is_current` = 1;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `m41a_decision_events` (
  `id` text PRIMARY KEY NOT NULL,
  `aggregate_id` text NOT NULL,
  `aggregate_type` text NOT NULL CHECK (`aggregate_type` IN ('alert','decision','follow_up_evidence','evaluation')),
  `sequence` integer NOT NULL CHECK (`sequence` > 0),
  `event_type` text NOT NULL CHECK (`event_type` IN ('alert_triggered','alert_acknowledged','alert_assigned','decision_recorded','follow_up_evidence_added','alert_resolved','evaluation_reset')),
  `scope` text NOT NULL CHECK (`scope` IN ('ENTERPRISE','BHC','GRO','EO','GAD')),
  `metric_id` text,
  `actor_id` text NOT NULL,
  `actor_role` text NOT NULL,
  `payload_json` text NOT NULL,
  `correlation_id` text NOT NULL,
  `evidence_class` text NOT NULL DEFAULT 'synthetic_demo' CHECK (`evidence_class` = 'synthetic_demo'),
  `occurred_at` text NOT NULL,
  UNIQUE (`aggregate_id`,`sequence`)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `m41a_decision_events_scope_metric_idx`
  ON `m41a_decision_events` (`scope`,`metric_id`,`occurred_at`);
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41a_scenario_runs_no_delete`
BEFORE DELETE ON `m41a_scenario_runs`
BEGIN
  SELECT RAISE(ABORT, 'M41A_SCENARIO_HISTORY_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41a_scenario_runs_controlled_update`
BEFORE UPDATE ON `m41a_scenario_runs`
WHEN NOT (
  OLD.`is_current` = 1 AND NEW.`is_current` = 0 AND
  OLD.`id` = NEW.`id` AND OLD.`scenario_id` = NEW.`scenario_id` AND
  OLD.`milestone` = NEW.`milestone` AND OLD.`status` = NEW.`status` AND
  OLD.`started_at` = NEW.`started_at` AND OLD.`completed_at` IS NEW.`completed_at` AND
  OLD.`assertions_passed` = NEW.`assertions_passed` AND
  OLD.`assertions_failed` = NEW.`assertions_failed` AND
  OLD.`evidence_json` = NEW.`evidence_json` AND
  OLD.`evidence_class` = NEW.`evidence_class` AND OLD.`created_at` = NEW.`created_at`
)
BEGIN
  SELECT RAISE(ABORT, 'M41A_SCENARIO_HISTORY_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41a_dashboard_snapshots_no_delete`
BEFORE DELETE ON `m41a_dashboard_snapshots`
BEGIN
  SELECT RAISE(ABORT, 'M41A_DASHBOARD_SNAPSHOT_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41a_dashboard_snapshots_controlled_update`
BEFORE UPDATE ON `m41a_dashboard_snapshots`
WHEN NOT (
  OLD.`is_current` = 1 AND NEW.`is_current` = 0 AND
  OLD.`id` = NEW.`id` AND OLD.`run_id` = NEW.`run_id` AND
  OLD.`scope` = NEW.`scope` AND OLD.`snapshot_version` = NEW.`snapshot_version` AND
  OLD.`payload_json` = NEW.`payload_json` AND OLD.`source_hashes_json` = NEW.`source_hashes_json` AND
  OLD.`reconciliation_status` = NEW.`reconciliation_status` AND
  OLD.`evidence_class` = NEW.`evidence_class` AND OLD.`created_at` = NEW.`created_at`
)
BEGIN
  SELECT RAISE(ABORT, 'M41A_DASHBOARD_SNAPSHOT_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41a_decision_events_no_update`
BEFORE UPDATE ON `m41a_decision_events`
BEGIN
  SELECT RAISE(ABORT, 'M41A_DECISION_EVENT_IMMUTABLE');
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `m41a_decision_events_no_delete`
BEFORE DELETE ON `m41a_decision_events`
BEGIN
  SELECT RAISE(ABORT, 'M41A_DECISION_EVENT_IMMUTABLE');
END;
