import type Database from "better-sqlite3";
import { sqlite } from "../../queries/connection";

export type M41bRuntimeDatabase = Pick<Database.Database, "exec" | "prepare">;

export function ensureM41bRuntimeSchema(db: M41bRuntimeDatabase = sqlite): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS m41b_scenario_runs (
      id TEXT PRIMARY KEY NOT NULL,
      scenario_id TEXT NOT NULL,
      milestone TEXT NOT NULL DEFAULT 'M4.1B' CHECK (milestone = 'M4.1B'),
      status TEXT NOT NULL CHECK (status IN ('running','passed','failed','reset')),
      started_at TEXT NOT NULL,
      completed_at TEXT,
      assertions_passed INTEGER NOT NULL DEFAULT 0,
      assertions_failed INTEGER NOT NULL DEFAULT 0,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      evidence_class TEXT NOT NULL DEFAULT 'synthetic_demo' CHECK (evidence_class = 'synthetic_demo'),
      is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
      created_at TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS m41b_scenario_runs_current_idx
      ON m41b_scenario_runs (scenario_id) WHERE is_current = 1;
    CREATE TABLE IF NOT EXISTS m41b_workplan_snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL REFERENCES m41b_scenario_runs(id) ON DELETE RESTRICT,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      tier TEXT NOT NULL CHECK (tier IN ('T1','T2','T3','T4')),
      division TEXT NOT NULL CHECK (division IN ('eo','gad','bhc','gro')),
      snapshot_version INTEGER NOT NULL CHECK (snapshot_version > 0),
      payload_json TEXT NOT NULL,
      source_ids_json TEXT NOT NULL DEFAULT '[]',
      evidence_class TEXT NOT NULL DEFAULT 'synthetic_demo' CHECK (evidence_class = 'synthetic_demo'),
      is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
      created_at TEXT NOT NULL,
      UNIQUE (user_id,snapshot_version)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS m41b_workplan_snapshots_current_idx
      ON m41b_workplan_snapshots (user_id) WHERE is_current = 1;
    CREATE INDEX IF NOT EXISTS m41b_workplan_role_division_idx
      ON m41b_workplan_snapshots (role,division,created_at);
    CREATE TABLE IF NOT EXISTS m41b_interaction_events (
      id TEXT PRIMARY KEY NOT NULL,
      run_id TEXT NOT NULL REFERENCES m41b_scenario_runs(id) ON DELETE RESTRICT,
      aggregate_id TEXT NOT NULL,
      aggregate_type TEXT NOT NULL CHECK (aggregate_type IN ('guidance','recommendation','decision','workplan_item','evidence','evaluation')),
      sequence INTEGER NOT NULL CHECK (sequence > 0),
      event_type TEXT NOT NULL CHECK (event_type IN ('prompt_received','source_retrieved','guidance_issued','guidance_refused','human_disposition_recorded','task_created','task_escalated','completion_evidence_added','task_completed','evaluation_reset')),
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      division TEXT NOT NULL CHECK (division IN ('eo','gad','bhc','gro')),
      payload_json TEXT NOT NULL,
      source_ids_json TEXT NOT NULL DEFAULT '[]',
      correlation_id TEXT NOT NULL,
      evidence_class TEXT NOT NULL DEFAULT 'synthetic_demo' CHECK (evidence_class = 'synthetic_demo'),
      occurred_at TEXT NOT NULL,
      UNIQUE (aggregate_id,sequence)
    );
    CREATE INDEX IF NOT EXISTS m41b_interaction_events_correlation_idx
      ON m41b_interaction_events (correlation_id,occurred_at);
    CREATE TRIGGER IF NOT EXISTS m41b_scenario_runs_no_delete BEFORE DELETE ON m41b_scenario_runs
      BEGIN SELECT RAISE(ABORT, 'M41B_SCENARIO_HISTORY_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS m41b_scenario_runs_controlled_update BEFORE UPDATE ON m41b_scenario_runs
      WHEN NOT (
        OLD.is_current = 1 AND NEW.is_current = 0 AND OLD.id = NEW.id AND
        OLD.scenario_id = NEW.scenario_id AND OLD.milestone = NEW.milestone AND
        OLD.status = NEW.status AND OLD.started_at = NEW.started_at AND
        OLD.completed_at IS NEW.completed_at AND OLD.assertions_passed = NEW.assertions_passed AND
        OLD.assertions_failed = NEW.assertions_failed AND OLD.evidence_json = NEW.evidence_json AND
        OLD.evidence_class = NEW.evidence_class AND OLD.created_at = NEW.created_at
      ) BEGIN SELECT RAISE(ABORT, 'M41B_SCENARIO_HISTORY_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS m41b_workplan_snapshots_no_delete BEFORE DELETE ON m41b_workplan_snapshots
      BEGIN SELECT RAISE(ABORT, 'M41B_WORKPLAN_SNAPSHOT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS m41b_workplan_snapshots_controlled_update BEFORE UPDATE ON m41b_workplan_snapshots
      WHEN NOT (
        OLD.is_current = 1 AND NEW.is_current = 0 AND OLD.id = NEW.id AND OLD.run_id = NEW.run_id AND
        OLD.user_id = NEW.user_id AND OLD.role = NEW.role AND OLD.tier = NEW.tier AND
        OLD.division = NEW.division AND OLD.snapshot_version = NEW.snapshot_version AND
        OLD.payload_json = NEW.payload_json AND OLD.source_ids_json = NEW.source_ids_json AND
        OLD.evidence_class = NEW.evidence_class AND OLD.created_at = NEW.created_at
      ) BEGIN SELECT RAISE(ABORT, 'M41B_WORKPLAN_SNAPSHOT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS m41b_interaction_events_no_update BEFORE UPDATE ON m41b_interaction_events
      BEGIN SELECT RAISE(ABORT, 'M41B_INTERACTION_EVENT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS m41b_interaction_events_no_delete BEFORE DELETE ON m41b_interaction_events
      BEGIN SELECT RAISE(ABORT, 'M41B_INTERACTION_EVENT_IMMUTABLE'); END;
  `);
}

