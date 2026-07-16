import { sqlite } from "../../queries/connection";

interface RuntimeSchemaDatabase {
  exec(sql: string): unknown;
}

export function ensurePhase2ControlSchema(db: RuntimeSchemaDatabase = sqlite): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phase2_care_episodes (
      id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL UNIQUE, referral_id TEXT NOT NULL UNIQUE,
      youth_id TEXT NOT NULL, youth_display_label TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','discharging','discharged','closed')),
      cans_assessment_id TEXT, cans_version INTEGER, mhtcm_plan_id TEXT, mhrs_plan_id TEXT,
      gro_placement_id TEXT, version INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS phase2_care_links (
      id TEXT PRIMARY KEY NOT NULL, episode_id TEXT NOT NULL REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      case_id TEXT NOT NULL, source_domain TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      source_version INTEGER NOT NULL, target_domain TEXT NOT NULL, target_type TEXT NOT NULL,
      target_id TEXT NOT NULL, target_version INTEGER NOT NULL, relation TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')), created_at TEXT NOT NULL,
      UNIQUE (source_domain,source_type,source_id,source_version,target_domain,target_type,target_id,target_version,relation)
    );
    CREATE TABLE IF NOT EXISTS phase2_work_items (
      id TEXT PRIMARY KEY NOT NULL, episode_id TEXT NOT NULL REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      domain TEXT NOT NULL, title TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      status TEXT NOT NULL, priority TEXT NOT NULL, assigned_role TEXT NOT NULL, assigned_to TEXT,
      due_at TEXT NOT NULL, escalation_level TEXT NOT NULL DEFAULT 'none', escalated_at TEXT,
      escalation_reason TEXT, exception_code TEXT, exception_reason TEXT, version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS phase2_alerts (
      id TEXT PRIMARY KEY NOT NULL, episode_id TEXT NOT NULL REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      domain TEXT NOT NULL, alert_type TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      title TEXT NOT NULL, status TEXT NOT NULL, priority TEXT NOT NULL, due_at TEXT NOT NULL,
      assigned_role TEXT NOT NULL, assigned_to TEXT, escalation_level TEXT NOT NULL DEFAULT 'none',
      acknowledged_at TEXT, resolved_at TEXT, created_at TEXT NOT NULL,
      UNIQUE (domain,alert_type,source_type,source_id,due_at)
    );
    CREATE TABLE IF NOT EXISTS phase2_handoffs (
      id TEXT PRIMARY KEY NOT NULL, episode_id TEXT NOT NULL REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      from_domain TEXT NOT NULL, to_domain TEXT NOT NULL, status TEXT NOT NULL, reason TEXT NOT NULL,
      payload_json TEXT NOT NULL DEFAULT '{}', initiated_by TEXT NOT NULL, initiated_at TEXT NOT NULL,
      due_at TEXT NOT NULL, accepted_by TEXT, accepted_at TEXT, completed_at TEXT,
      version INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS phase2_audit_events (
      id TEXT PRIMARY KEY NOT NULL, episode_id TEXT REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      domain TEXT NOT NULL, event_type TEXT NOT NULL, action TEXT NOT NULL, entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL, actor_id TEXT NOT NULL, actor_role TEXT NOT NULL, reason TEXT NOT NULL,
      before_json TEXT, after_json TEXT, changed_fields_json TEXT NOT NULL DEFAULT '[]',
      correlation_id TEXT NOT NULL, evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      occurred_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS phase2_audit_events_no_update BEFORE UPDATE ON phase2_audit_events
      BEGIN SELECT RAISE(ABORT, 'PHASE2_AUDIT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS phase2_audit_events_no_delete BEFORE DELETE ON phase2_audit_events
      BEGIN SELECT RAISE(ABORT, 'PHASE2_AUDIT_IMMUTABLE'); END;
    CREATE TABLE IF NOT EXISTS phase2_claim_handoffs (
      id TEXT PRIMARY KEY NOT NULL, episode_id TEXT NOT NULL REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      program TEXT NOT NULL, encounter_id TEXT NOT NULL, procedure_code TEXT NOT NULL, status TEXT NOT NULL,
      findings_json TEXT NOT NULL DEFAULT '[]', evaluator_version TEXT NOT NULL, decided_at TEXT NOT NULL,
      handed_off_at TEXT, correlation_id TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      UNIQUE (program,encounter_id)
    );
    CREATE TABLE IF NOT EXISTS phase2_program_snapshots (
      id TEXT PRIMARY KEY NOT NULL, episode_id TEXT NOT NULL REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      domain TEXT NOT NULL, aggregate_type TEXT NOT NULL, aggregate_id TEXT NOT NULL,
      aggregate_version INTEGER NOT NULL, payload_json TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      is_current INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
      UNIQUE (domain,aggregate_type,aggregate_id,aggregate_version)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_phase2_snapshot_current
      ON phase2_program_snapshots (domain,aggregate_type,aggregate_id) WHERE is_current = 1;
    CREATE TRIGGER IF NOT EXISTS phase2_program_snapshots_no_update_payload
      BEFORE UPDATE OF payload_json,aggregate_version,evidence_class,created_at ON phase2_program_snapshots
      BEGIN SELECT RAISE(ABORT, 'PHASE2_SNAPSHOT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS phase2_program_snapshots_no_delete BEFORE DELETE ON phase2_program_snapshots
      BEGIN SELECT RAISE(ABORT, 'PHASE2_SNAPSHOT_IMMUTABLE'); END;
    CREATE TABLE IF NOT EXISTS phase2_scenario_runs (
      id TEXT PRIMARY KEY NOT NULL, milestone TEXT NOT NULL, scenario_type TEXT NOT NULL, status TEXT NOT NULL,
      episode_id TEXT NOT NULL REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      started_at TEXT NOT NULL, completed_at TEXT, assertions_passed INTEGER NOT NULL DEFAULT 0,
      assertions_failed INTEGER NOT NULL DEFAULT 0, evidence_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS idx_phase2_work_queue ON phase2_work_items (domain,status,due_at,priority);
    CREATE INDEX IF NOT EXISTS idx_phase2_alert_queue ON phase2_alerts (domain,status,due_at,priority);
    CREATE INDEX IF NOT EXISTS idx_phase2_handoff_queue ON phase2_handoffs (to_domain,status,due_at);
    CREATE INDEX IF NOT EXISTS idx_phase2_audit_entity ON phase2_audit_events (domain,entity_type,entity_id,occurred_at);
  `);
}

export function seedPhase2ControlScenario(db: RuntimeSchemaDatabase = sqlite): void {
  ensurePhase2ControlSchema(db);
  db.exec(`
    INSERT OR IGNORE INTO phase2_care_episodes
      (id,case_id,referral_id,youth_id,youth_display_label,evidence_class,status,cans_assessment_id,cans_version,version,created_at,updated_at)
    VALUES
      ('SYNTH-PHASE2-EPISODE-001','M21-CASE-EXISTING-001','M21-REF-EXISTING-001','SYNTH-YOUTH-EXISTING-001','Synthetic Youth Existing-01','synthetic_demo','active','M21-CANS-EXISTING-V2',2,1,'2026-07-14T12:00:00.000Z','2026-07-14T12:00:00.000Z');
    INSERT OR IGNORE INTO phase2_care_links
      (id,episode_id,case_id,source_domain,source_type,source_id,source_version,target_domain,target_type,target_id,target_version,relation,evidence_class,created_at)
    VALUES
      ('SYNTH-LINK-M22-001','SYNTH-PHASE2-EPISODE-001','M21-CASE-EXISTING-001','SHARED','cans_assessment','M21-CANS-EXISTING-V2',2,'MHTCM','case_plan','SYNTH-MHTCM-PLAN-001',1,'derived_from','synthetic_demo','2026-07-14T12:00:00.000Z'),
      ('SYNTH-LINK-M23-001','SYNTH-PHASE2-EPISODE-001','M21-CASE-EXISTING-001','SHARED','cans_assessment','M21-CANS-EXISTING-V2',2,'MHRS','service_plan','SYNTH-MHRS-PLAN-001',1,'derived_from','synthetic_demo','2026-07-14T12:00:00.000Z'),
      ('SYNTH-LINK-M24-001','SYNTH-PHASE2-EPISODE-001','M21-CASE-EXISTING-001','SHARED','referral','M21-REF-EXISTING-001',3,'GRO','placement','SYNTH-GRO-PLACEMENT-001',1,'coordinates_with','synthetic_demo','2026-07-14T12:00:00.000Z');
    INSERT OR IGNORE INTO phase2_work_items
      (id,episode_id,domain,title,source_type,source_id,status,priority,assigned_role,assigned_to,due_at,escalation_level,version,created_at,updated_at)
    VALUES
      ('SYNTH-PHASE2-WORK-M22','SYNTH-PHASE2-EPISODE-001','MHTCM','Manage six-function MHTCM lifecycle','case_plan','SYNTH-MHTCM-PLAN-001','in_progress','urgent','case-manager','SYNTH-CASE-MANAGER','2026-07-15T17:00:00.000Z','none',1,'2026-07-14T12:00:00.000Z','2026-07-14T12:00:00.000Z'),
      ('SYNTH-PHASE2-WORK-M23','SYNTH-PHASE2-EPISODE-001','MHRS','Deliver governed MHRS services','service_plan','SYNTH-MHRS-PLAN-001','in_progress','urgent','therapist','SYNTH-MHRS-SPECIALIST','2026-07-15T17:00:00.000Z','none',1,'2026-07-14T12:00:00.000Z','2026-07-14T12:00:00.000Z'),
      ('SYNTH-PHASE2-WORK-M24','SYNTH-PHASE2-EPISODE-001','GRO','Execute residential operations scenario','placement','SYNTH-GRO-PLACEMENT-001','in_progress','urgent','shift-supervisor','SYNTH-SHIFT-SUPERVISOR','2026-07-15T17:00:00.000Z','none',1,'2026-07-14T12:00:00.000Z','2026-07-14T12:00:00.000Z');
    INSERT OR IGNORE INTO phase2_audit_events
      (id,episode_id,domain,event_type,action,entity_type,entity_id,actor_id,actor_role,reason,changed_fields_json,correlation_id,evidence_class,occurred_at)
    VALUES
      ('SYNTH-PHASE2-AUDIT-001','SYNTH-PHASE2-EPISODE-001','SHARED','scenario','phase2_sprint_initialized','care_episode','SYNTH-PHASE2-EPISODE-001','SYNTH-MANAGING-DIRECTOR','managing-director','Standing authorization initialized the integrated synthetic sprint.','[]','M21-CASE-EXISTING-001','synthetic_demo','2026-07-14T12:00:00.000Z');
    INSERT OR IGNORE INTO phase2_claim_handoffs
      (id,episode_id,program,encounter_id,procedure_code,status,findings_json,evaluator_version,decided_at,handed_off_at,correlation_id,evidence_class)
    VALUES
      ('M22-CLAIM-HANDOFF-0024','SYNTH-PHASE2-EPISODE-001','MHTCM','SYNTH-M22-ENC-001','T1017','ready_for_revenue','[]','M22-BILLING-0022','2026-07-31T12:05:00.000Z','2026-07-31T12:05:00.000Z','M22-CLAIM-HANDOFF-0024','synthetic_demo'),
      ('M23-CLAIM-0002','SYNTH-PHASE2-EPISODE-001','MHRS','SYNTH-M23-ENC-002','H2017','ready_for_revenue','[]','2026.07.14','2026-07-10T11:45:00.000Z','2026-07-10T11:45:00.000Z','M23-CORR-M23-CASE-0002','synthetic_demo');
  `);
}
