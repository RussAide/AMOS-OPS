import type Database from "better-sqlite3";
import { sqlite } from "../../queries/connection";
import { seedPhase2ControlScenario } from "../phase2/runtime-schema";
import type { UserRole } from "@/constants/roles";

type RuntimeSchemaDatabase = Pick<Database.Database, "exec" | "prepare">;

export const PHASE3_DEMO_ENVIRONMENT_ID = "AMOS-OPS-PHASE3-EVALUATION" as const;
export const PHASE3_DEMO_ENVIRONMENT_LABEL =
  "DEMO - NOT FOR CARE DELIVERY" as const;
export const PHASE3_DEMO_FIXED_AS_OF = "2026-07-14T18:30:00.000Z";

export interface Phase3DemoControlState {
  id: string;
  environmentId: typeof PHASE3_DEMO_ENVIRONMENT_ID;
  environmentLabel: typeof PHASE3_DEMO_ENVIRONMENT_LABEL;
  dataStoreLabel: string;
  resetToken: string;
  killSwitchEnabled: boolean;
  productionWritesBlocked: boolean;
  dataExpiresAt: string;
  accessReviewedAt: string;
  accessReviewedBy: string;
  lastResetAt: string | null;
  updatedAt: string;
}

export function ensurePhase3ControlSchema(
  db: RuntimeSchemaDatabase = sqlite,
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS phase3_support_cases (
      id TEXT PRIMARY KEY NOT NULL,
      source_episode_id TEXT NOT NULL REFERENCES phase2_care_episodes(id) ON DELETE RESTRICT,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','closed')),
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (source_episode_id,evidence_class)
    );
    CREATE TABLE IF NOT EXISTS phase3_support_links (
      id TEXT PRIMARY KEY NOT NULL,
      support_case_id TEXT NOT NULL REFERENCES phase3_support_cases(id) ON DELETE RESTRICT,
      domain TEXT NOT NULL CHECK (domain IN ('COMPLIANCE','REVENUE','WORKFORCE','GAD')),
      source_division TEXT NOT NULL CHECK (source_division IN ('BHC','GRO','EO','GAD')),
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      relation TEXT NOT NULL CHECK (relation IN ('enables','assures','funds','staffs','maintains')),
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      created_at TEXT NOT NULL,
      UNIQUE (domain,source_type,source_id,target_type,target_id,relation)
    );
    CREATE TABLE IF NOT EXISTS phase3_work_items (
      id TEXT PRIMARY KEY NOT NULL,
      support_case_id TEXT NOT NULL REFERENCES phase3_support_cases(id) ON DELETE RESTRICT,
      domain TEXT NOT NULL CHECK (domain IN ('COMPLIANCE','REVENUE','WORKFORCE','GAD')),
      title TEXT NOT NULL,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending','in_progress','awaiting_review','completed','cancelled')),
      priority TEXT NOT NULL CHECK (priority IN ('routine','urgent','critical')),
      assigned_role TEXT NOT NULL,
      assigned_to TEXT,
      due_at TEXT NOT NULL,
      completed_at TEXT,
      evidence_ids_json TEXT NOT NULL DEFAULT '[]',
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS phase3_audit_events (
      id TEXT PRIMARY KEY NOT NULL,
      support_case_id TEXT NOT NULL REFERENCES phase3_support_cases(id) ON DELETE RESTRICT,
      domain TEXT NOT NULL CHECK (domain IN ('COMPLIANCE','REVENUE','WORKFORCE','GAD')),
      action TEXT NOT NULL CHECK (action IN ('access','change','approval','disclosure','export','administrative_action','routing','gate_decision','scenario')),
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      reason TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      before_json TEXT,
      after_json TEXT,
      changed_fields_json TEXT NOT NULL DEFAULT '[]',
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      occurred_at TEXT NOT NULL
    );
    CREATE TRIGGER IF NOT EXISTS phase3_audit_events_no_update BEFORE UPDATE ON phase3_audit_events
      BEGIN SELECT RAISE(ABORT, 'PHASE3_AUDIT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS phase3_audit_events_no_delete BEFORE DELETE ON phase3_audit_events
      BEGIN SELECT RAISE(ABORT, 'PHASE3_AUDIT_IMMUTABLE'); END;
    CREATE TABLE IF NOT EXISTS phase3_module_snapshots (
      id TEXT PRIMARY KEY NOT NULL,
      support_case_id TEXT NOT NULL REFERENCES phase3_support_cases(id) ON DELETE RESTRICT,
      milestone TEXT NOT NULL CHECK (milestone IN ('M3.1','M3.2','M3.3','M3.4')),
      aggregate_type TEXT NOT NULL,
      aggregate_id TEXT NOT NULL,
      aggregate_version INTEGER NOT NULL,
      payload_json TEXT NOT NULL,
      evidence_class TEXT NOT NULL CHECK (evidence_class IN ('synthetic_demo','production')),
      is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1)),
      created_at TEXT NOT NULL,
      UNIQUE (milestone,aggregate_type,aggregate_id,aggregate_version)
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_phase3_snapshot_current
      ON phase3_module_snapshots (milestone,aggregate_type,aggregate_id) WHERE is_current = 1;
    CREATE TRIGGER IF NOT EXISTS phase3_module_snapshots_no_update_payload
      BEFORE UPDATE OF payload_json,aggregate_version,evidence_class,created_at ON phase3_module_snapshots
      BEGIN SELECT RAISE(ABORT, 'PHASE3_SNAPSHOT_IMMUTABLE'); END;
    CREATE TRIGGER IF NOT EXISTS phase3_module_snapshots_no_delete BEFORE DELETE ON phase3_module_snapshots
      BEGIN SELECT RAISE(ABORT, 'PHASE3_SNAPSHOT_IMMUTABLE'); END;
    CREATE TABLE IF NOT EXISTS phase3_scenario_runs (
      id TEXT PRIMARY KEY NOT NULL,
      milestone TEXT NOT NULL CHECK (milestone IN ('M3.1','M3.2','M3.3','M3.4','PHASE3_EXIT')),
      scenario_type TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('not_started','running','passed','failed')),
      support_case_id TEXT NOT NULL REFERENCES phase3_support_cases(id) ON DELETE RESTRICT,
      started_at TEXT NOT NULL,
      completed_at TEXT,
      assertions_passed INTEGER NOT NULL DEFAULT 0,
      assertions_failed INTEGER NOT NULL DEFAULT 0,
      evidence_json TEXT NOT NULL DEFAULT '{}',
      is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1))
    );
    CREATE TABLE IF NOT EXISTS phase3_demo_controls (
      id TEXT PRIMARY KEY NOT NULL,
      environment_id TEXT NOT NULL UNIQUE,
      environment_label TEXT NOT NULL,
      data_store_label TEXT NOT NULL,
      reset_token TEXT NOT NULL,
      kill_switch_enabled INTEGER NOT NULL DEFAULT 0 CHECK (kill_switch_enabled IN (0,1)),
      production_writes_blocked INTEGER NOT NULL DEFAULT 1 CHECK (production_writes_blocked IN (0,1)),
      data_expires_at TEXT NOT NULL,
      access_reviewed_at TEXT NOT NULL,
      access_reviewed_by TEXT NOT NULL,
      last_reset_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_phase3_work_queue ON phase3_work_items (domain,status,due_at,priority);
    CREATE INDEX IF NOT EXISTS idx_phase3_audit_entity ON phase3_audit_events (domain,entity_type,entity_id,occurred_at);
    CREATE INDEX IF NOT EXISTS idx_phase3_scenario_status ON phase3_scenario_runs (milestone,status,started_at);
  `);

  const scenarioColumns = new Set(
    (
      db.prepare("PRAGMA table_info(phase3_scenario_runs)").all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
  if (!scenarioColumns.has("is_current")) {
    db.exec(
      "ALTER TABLE phase3_scenario_runs ADD COLUMN is_current INTEGER NOT NULL DEFAULT 1 CHECK (is_current IN (0,1))",
    );
  }
  db.exec(
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_phase3_scenario_current ON phase3_scenario_runs (support_case_id,milestone) WHERE is_current = 1",
  );

  const columns = new Set(
    (
      db.prepare("PRAGMA table_info(phase3_demo_controls)").all() as Array<{
        name: string;
      }>
    ).map((column) => column.name),
  );
  const additiveColumns = [
    [
      "environment_label",
      "TEXT NOT NULL DEFAULT 'DEMO - NOT FOR CARE DELIVERY'",
    ],
    ["data_store_label", "TEXT NOT NULL DEFAULT 'phase3-synthetic-sqlite'"],
    ["access_reviewed_at", "TEXT NOT NULL DEFAULT '2026-07-14T13:00:00.000Z'"],
    ["access_reviewed_by", "TEXT NOT NULL DEFAULT 'SYNTH-MANAGING-DIRECTOR'"],
    ["last_reset_at", "TEXT"],
  ] as const;
  for (const [name, definition] of additiveColumns) {
    if (!columns.has(name))
      db.exec(
        `ALTER TABLE phase3_demo_controls ADD COLUMN ${name} ${definition}`,
      );
  }
}

export function seedPhase3ControlScenario(
  db: RuntimeSchemaDatabase = sqlite,
): void {
  seedPhase2ControlScenario(db);
  ensurePhase3ControlSchema(db);
  db.exec(`
    INSERT OR IGNORE INTO phase3_support_cases
      (id,source_episode_id,evidence_class,status,version,created_at,updated_at)
    VALUES
      ('SYNTH-PHASE3-SUPPORT-001','SYNTH-PHASE2-EPISODE-001','synthetic_demo','active',1,'2026-07-14T13:00:00.000Z','2026-07-14T13:00:00.000Z');
    INSERT OR IGNORE INTO phase3_demo_controls
      (id,environment_id,environment_label,data_store_label,reset_token,kill_switch_enabled,production_writes_blocked,data_expires_at,access_reviewed_at,access_reviewed_by,last_reset_at,updated_at)
    VALUES
      ('SYNTH-PHASE3-DEMO-CONTROL','AMOS-OPS-PHASE3-EVALUATION','DEMO - NOT FOR CARE DELIVERY','phase3-synthetic-sqlite','PHASE3-RESET-20260714',0,1,'2027-01-14T00:00:00.000Z','2026-07-14T13:00:00.000Z','SYNTH-MANAGING-DIRECTOR',NULL,'2026-07-14T13:00:00.000Z');
    INSERT OR IGNORE INTO phase3_support_links
      (id,support_case_id,domain,source_division,source_type,source_id,target_type,target_id,relation,evidence_class,created_at)
    VALUES
      ('SYNTH-P3-LINK-COMPLIANCE','SYNTH-PHASE3-SUPPORT-001','COMPLIANCE','BHC','ccmg_case','M21-CASE-EXISTING-001','m31_mock_survey','SYNTH-M31-SURVEY-001','assures','synthetic_demo','2026-07-14T13:00:00.000Z'),
      ('SYNTH-P3-LINK-REVENUE','SYNTH-PHASE3-SUPPORT-001','REVENUE','BHC','phase2_claim_handoff','M22-CLAIM-HANDOFF-0024','m32_claim_cycle','SYNTH-M32-CLAIM-T1017-001','funds','synthetic_demo','2026-07-14T13:00:00.000Z'),
      ('SYNTH-P3-LINK-WORKFORCE','SYNTH-PHASE3-SUPPORT-001','WORKFORCE','GRO','phase2_shift_staffing_evaluation','SYNTH-M24-SHIFT-00062','m33_workforce_record','SYNTH-M33-WORKFORCE-T1','staffs','synthetic_demo','2026-07-14T13:00:00.000Z'),
      ('SYNTH-P3-LINK-GAD','SYNTH-PHASE3-SUPPORT-001','GAD','GRO','phase2_gro_placement','SYNTH-M24-PLACEMENT-00001','m34_facility_stage','SYNTH-M34-STAGE-1','maintains','synthetic_demo','2026-07-14T13:00:00.000Z');
    INSERT OR IGNORE INTO phase3_work_items
      (id,support_case_id,domain,title,source_type,source_id,status,priority,assigned_role,assigned_to,due_at,evidence_ids_json,evidence_class,created_at,updated_at)
    VALUES
      ('SYNTH-P3-WORK-M31','SYNTH-PHASE3-SUPPORT-001','COMPLIANCE','Close routed chart-audit finding','ccmg_case','M21-CASE-EXISTING-001','in_progress','urgent','hr-compliance-officer','SYNTH-HR-COMPLIANCE-OFFICER','2026-07-18T17:00:00.000Z','[]','synthetic_demo','2026-07-14T13:00:00.000Z','2026-07-14T13:00:00.000Z'),
      ('SYNTH-P3-WORK-M32','SYNTH-PHASE3-SUPPORT-001','REVENUE','Complete T1017 and H2017 claim cycles','phase2_claim_handoff','M22-CLAIM-HANDOFF-0024','in_progress','urgent','revenue-cycle-manager','SYNTH-REVENUE-MANAGER','2026-07-18T17:00:00.000Z','[]','synthetic_demo','2026-07-14T13:00:00.000Z','2026-07-14T13:00:00.000Z'),
      ('SYNTH-P3-WORK-M33','SYNTH-PHASE3-SUPPORT-001','WORKFORCE','Release qualified representative staff to duty','phase2_shift_staffing_evaluation','SYNTH-M24-SHIFT-00062','in_progress','urgent','hr-director','SYNTH-HR-DIRECTOR','2026-07-18T17:00:00.000Z','[]','synthetic_demo','2026-07-14T13:00:00.000Z','2026-07-14T13:00:00.000Z'),
      ('SYNTH-P3-WORK-M34','SYNTH-PHASE3-SUPPORT-001','GAD','Verify campus facilities and support services','phase2_gro_placement','SYNTH-M24-PLACEMENT-00001','in_progress','urgent','facilities-manager','SYNTH-FACILITIES-MANAGER','2026-07-18T17:00:00.000Z','[]','synthetic_demo','2026-07-14T13:00:00.000Z','2026-07-14T13:00:00.000Z');
    INSERT OR IGNORE INTO phase3_audit_events
      (id,support_case_id,domain,action,entity_type,entity_id,actor_id,actor_role,reason,correlation_id,changed_fields_json,evidence_class,occurred_at)
    VALUES
      ('SYNTH-P3-AUDIT-INITIAL','SYNTH-PHASE3-SUPPORT-001','COMPLIANCE','scenario','phase3_support_case','SYNTH-PHASE3-SUPPORT-001','SYNTH-MANAGING-DIRECTOR','managing-director','Standing sprint authorization initialized the Phase 3 synthetic support case.','SYNTH-PHASE2-EPISODE-001','[]','synthetic_demo','2026-07-14T13:00:00.000Z');
  `);
}

export function resetPhase3ControlScenario(
  db: RuntimeSchemaDatabase = sqlite,
  actorId = "SYNTH-SYSTEM-SCENARIO",
  actorRole: UserRole | "system" = "system",
  resetAt = PHASE3_DEMO_FIXED_AS_OF,
): void {
  ensurePhase3ControlSchema(db);
  db.exec(`
    UPDATE phase3_scenario_runs SET is_current = 0 WHERE is_current = 1;
    UPDATE phase3_module_snapshots SET is_current = 0 WHERE is_current = 1;
  `);
  db.prepare(
    `UPDATE phase3_work_items
       SET status = 'in_progress', completed_at = NULL, evidence_ids_json = '[]', updated_at = ?
     WHERE support_case_id = 'SYNTH-PHASE3-SUPPORT-001'`,
  ).run(resetAt);
  db.prepare(
    `UPDATE phase3_support_cases
       SET status = 'active', version = version + 1, updated_at = ?
     WHERE id = 'SYNTH-PHASE3-SUPPORT-001'`,
  ).run(resetAt);
  const sequence =
    Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_audit_events WHERE entity_type = 'phase3_demo_reset'",
          )
          .get() as { count: number }
      ).count,
    ) + 1;
  db.prepare(
    "UPDATE phase3_demo_controls SET last_reset_at = ?, updated_at = ? WHERE environment_id = ?",
  ).run(resetAt, resetAt, PHASE3_DEMO_ENVIRONMENT_ID);
  db.prepare(
    `INSERT INTO phase3_audit_events
      (id,support_case_id,domain,action,entity_type,entity_id,actor_id,actor_role,reason,correlation_id,before_json,after_json,changed_fields_json,evidence_class,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    `SYNTH-P3-AUDIT-RESET-${String(sequence).padStart(4, "0")}`,
    "SYNTH-PHASE3-SUPPORT-001",
    "COMPLIANCE",
    "administrative_action",
    "phase3_demo_reset",
    "SYNTH-PHASE3-DEMO-CONTROL",
    actorId,
    actorRole,
    "Reset active synthetic Phase 3 evaluation progress without deleting immutable evidence.",
    PHASE3_DEMO_ENVIRONMENT_ID,
    null,
    JSON.stringify({ lastResetAt: resetAt }),
    JSON.stringify(["lastResetAt"]),
    "synthetic_demo",
    resetAt,
  );
}

export function getPhase3DemoControlState(
  db: RuntimeSchemaDatabase = sqlite,
): Phase3DemoControlState {
  const row = db
    .prepare("SELECT * FROM phase3_demo_controls WHERE environment_id = ?")
    .get(PHASE3_DEMO_ENVIRONMENT_ID) as Record<string, unknown> | undefined;
  if (!row) throw new Error("PHASE3_DEMO_CONTROL_MISSING");
  return Object.freeze({
    id: String(row.id),
    environmentId: PHASE3_DEMO_ENVIRONMENT_ID,
    environmentLabel: PHASE3_DEMO_ENVIRONMENT_LABEL,
    dataStoreLabel: String(row.data_store_label),
    resetToken: String(row.reset_token),
    killSwitchEnabled: Number(row.kill_switch_enabled) === 1,
    productionWritesBlocked: Number(row.production_writes_blocked) === 1,
    dataExpiresAt: String(row.data_expires_at),
    accessReviewedAt: String(row.access_reviewed_at),
    accessReviewedBy: String(row.access_reviewed_by),
    lastResetAt:
      typeof row.last_reset_at === "string" ? row.last_reset_at : null,
    updatedAt: String(row.updated_at),
  });
}

function assertIsoTimestamp(value: string, code: string): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(code);
  return timestamp;
}

function assertCurrentAccessReview(
  control: Phase3DemoControlState,
  asOf: string,
): void {
  if (!control.accessReviewedAt || !control.accessReviewedBy)
    throw new Error("PHASE3_ACCESS_REVIEW_MISSING");
  const reviewedAt = assertIsoTimestamp(
    control.accessReviewedAt,
    "PHASE3_INVALID_ACCESS_REVIEW",
  );
  const evaluatedAt = assertIsoTimestamp(asOf, "PHASE3_INVALID_CONTROL_AS_OF");
  const reviewAge = evaluatedAt - reviewedAt;
  if (reviewAge < 0 || reviewAge > 90 * 86_400_000)
    throw new Error("PHASE3_ACCESS_REVIEW_STALE");
}

export function assertPhase3DemoControlActive(
  db: RuntimeSchemaDatabase = sqlite,
  asOf = PHASE3_DEMO_FIXED_AS_OF,
): Phase3DemoControlState {
  const control = getPhase3DemoControlState(db);
  if (!control.productionWritesBlocked)
    throw new Error("PHASE3_PRODUCTION_WRITE_BLOCK_DISABLED");
  if (control.killSwitchEnabled)
    throw new Error("PHASE3_DEMO_KILL_SWITCH_ACTIVE");
  if (
    assertIsoTimestamp(
      control.dataExpiresAt,
      "PHASE3_INVALID_DATA_EXPIRATION",
    ) <= assertIsoTimestamp(asOf, "PHASE3_INVALID_CONTROL_AS_OF")
  )
    throw new Error("PHASE3_DEMO_DATA_EXPIRED");
  assertCurrentAccessReview(control, asOf);
  return control;
}

export function assertPhase3DemoResetAllowed(
  db: RuntimeSchemaDatabase = sqlite,
  asOf = PHASE3_DEMO_FIXED_AS_OF,
): Phase3DemoControlState {
  const control = getPhase3DemoControlState(db);
  if (!control.productionWritesBlocked)
    throw new Error("PHASE3_PRODUCTION_WRITE_BLOCK_DISABLED");
  assertCurrentAccessReview(control, asOf);
  return control;
}

export function setPhase3KillSwitch(
  enabled: boolean,
  actorId: string,
  actorRole: UserRole,
  db: RuntimeSchemaDatabase = sqlite,
  updatedAt = PHASE3_DEMO_FIXED_AS_OF,
): Phase3DemoControlState {
  const control = getPhase3DemoControlState(db);
  if (!control.productionWritesBlocked)
    throw new Error("PHASE3_PRODUCTION_WRITE_BLOCK_DISABLED");
  const sequence =
    Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_audit_events WHERE entity_type = 'phase3_demo_control'",
          )
          .get() as { count: number }
      ).count,
    ) + 1;
  db.prepare(
    "UPDATE phase3_demo_controls SET kill_switch_enabled = ?, updated_at = ? WHERE environment_id = ?",
  ).run(enabled ? 1 : 0, updatedAt, PHASE3_DEMO_ENVIRONMENT_ID);
  db.prepare(
    `INSERT INTO phase3_audit_events
      (id,support_case_id,domain,action,entity_type,entity_id,actor_id,actor_role,reason,correlation_id,before_json,after_json,changed_fields_json,evidence_class,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    `SYNTH-P3-AUDIT-KILL-${String(sequence).padStart(4, "0")}`,
    "SYNTH-PHASE3-SUPPORT-001",
    "COMPLIANCE",
    "administrative_action",
    "phase3_demo_control",
    control.id,
    actorId,
    actorRole,
    `Set the synthetic Phase 3 kill switch to ${enabled ? "enabled" : "disabled"}.`,
    PHASE3_DEMO_ENVIRONMENT_ID,
    JSON.stringify({ killSwitchEnabled: control.killSwitchEnabled }),
    JSON.stringify({ killSwitchEnabled: enabled }),
    JSON.stringify(["killSwitchEnabled"]),
    "synthetic_demo",
    updatedAt,
  );
  return getPhase3DemoControlState(db);
}

export function recordPhase3AccessReview(
  actorId: string,
  actorRole: UserRole,
  db: RuntimeSchemaDatabase = sqlite,
  reviewedAt = PHASE3_DEMO_FIXED_AS_OF,
): Phase3DemoControlState {
  const control = getPhase3DemoControlState(db);
  if (!control.productionWritesBlocked)
    throw new Error("PHASE3_PRODUCTION_WRITE_BLOCK_DISABLED");
  const sequence =
    Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_audit_events WHERE entity_type = 'phase3_demo_access_review'",
          )
          .get() as { count: number }
      ).count,
    ) + 1;
  db.prepare(
    "UPDATE phase3_demo_controls SET access_reviewed_at = ?, access_reviewed_by = ?, updated_at = ? WHERE environment_id = ?",
  ).run(reviewedAt, actorId, reviewedAt, PHASE3_DEMO_ENVIRONMENT_ID);
  db.prepare(
    `INSERT INTO phase3_audit_events
      (id,support_case_id,domain,action,entity_type,entity_id,actor_id,actor_role,reason,correlation_id,before_json,after_json,changed_fields_json,evidence_class,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    `SYNTH-P3-AUDIT-ACCESS-REVIEW-${String(sequence).padStart(4, "0")}`,
    "SYNTH-PHASE3-SUPPORT-001",
    "COMPLIANCE",
    "administrative_action",
    "phase3_demo_access_review",
    control.id,
    actorId,
    actorRole,
    "Reviewed authorized Phase 3 synthetic evaluation personas.",
    PHASE3_DEMO_ENVIRONMENT_ID,
    JSON.stringify({ accessReviewedAt: control.accessReviewedAt }),
    JSON.stringify({ accessReviewedAt: reviewedAt, accessReviewedBy: actorId }),
    JSON.stringify(["accessReviewedAt", "accessReviewedBy"]),
    "synthetic_demo",
    reviewedAt,
  );
  return getPhase3DemoControlState(db);
}

export function recordPhase3DemoAction(
  action: "integrated_run" | "component_evaluation",
  entityId: string,
  actorId: string,
  actorRole: UserRole,
  db: RuntimeSchemaDatabase = sqlite,
  occurredAt = PHASE3_DEMO_FIXED_AS_OF,
): void {
  assertPhase3DemoControlActive(db, occurredAt);
  const sequence =
    Number(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM phase3_audit_events WHERE entity_type = 'phase3_demo_action'",
          )
          .get() as { count: number }
      ).count,
    ) + 1;
  db.prepare(
    `INSERT INTO phase3_audit_events
      (id,support_case_id,domain,action,entity_type,entity_id,actor_id,actor_role,reason,correlation_id,before_json,after_json,changed_fields_json,evidence_class,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    `SYNTH-P3-AUDIT-DEMO-ACTION-${String(sequence).padStart(4, "0")}`,
    "SYNTH-PHASE3-SUPPORT-001",
    "COMPLIANCE",
    "scenario",
    "phase3_demo_action",
    entityId,
    actorId,
    actorRole,
    `Executed authorized synthetic Phase 3 ${action.replace(/_/g, " ")}.`,
    PHASE3_DEMO_ENVIRONMENT_ID,
    null,
    JSON.stringify({ action, entityId }),
    JSON.stringify(["action", "entityId"]),
    "synthetic_demo",
    occurredAt,
  );
}
