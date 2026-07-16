import type Database from "better-sqlite3";
import {
  assertPhase3Synthetic,
  stablePhase3Id,
  type Phase3AuditEvent,
  type Phase3IntegratedResult,
  type Phase3ModuleResult,
  type Phase3ScenarioRun,
  type Phase3SupportLink,
  type Phase3WorkItem,
} from "@contracts/phase3/shared";
import { ensurePhase3ControlSchema } from "./runtime-schema";

type SqliteDatabase = Database.Database;
type Row = Record<string, unknown>;

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export class Phase3ControlStore {
  constructor(private readonly db: SqliteDatabase) {}

  saveSupportLink(link: Phase3SupportLink, supportCaseId: string): void {
    assertPhase3Synthetic({ id: link.id, evidenceClass: link.evidenceClass });
    const existing = this.db
      .prepare("SELECT * FROM phase3_support_links WHERE id = ?")
      .get(link.id) as Row | undefined;
    if (existing) {
      const staticFields = {
        support_case_id: supportCaseId,
        domain: link.domain,
        source_division: link.sourceDivision,
        source_type: link.sourceType,
        source_id: link.sourceId,
        target_type: link.targetType,
        target_id: link.targetId,
        relation: link.relation,
        evidence_class: link.evidenceClass,
        created_at: link.createdAt,
      };
      if (
        Object.entries(staticFields).some(
          ([field, expected]) => existing[field] !== expected,
        )
      )
        throw new Error(`PHASE3_SUPPORT_LINK_DRIFT:${link.id}`);
      return;
    }
    this.db.prepare(`INSERT OR IGNORE INTO phase3_support_links
      (id,support_case_id,domain,source_division,source_type,source_id,target_type,target_id,relation,evidence_class,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(link.id, supportCaseId, link.domain, link.sourceDivision, link.sourceType, link.sourceId,
        link.targetType, link.targetId, link.relation, link.evidenceClass, link.createdAt);
  }

  saveWorkItem(item: Phase3WorkItem): void {
    assertPhase3Synthetic({ id: item.id, evidenceClass: item.evidenceClass });
    const existing = this.db
      .prepare("SELECT * FROM phase3_work_items WHERE id = ?")
      .get(item.id) as Row | undefined;
    if (existing) {
      const staticFields = {
        support_case_id: item.supportCaseId,
        domain: item.domain,
        title: item.title,
        source_type: item.sourceType,
        source_id: item.sourceId,
        priority: item.priority,
        assigned_role: item.assignedRole,
        due_at: item.dueAt,
        evidence_class: item.evidenceClass,
        created_at: item.createdAt,
      };
      if (
        Object.entries(staticFields).some(
          ([field, expected]) => existing[field] !== expected,
        )
      )
        throw new Error(`PHASE3_WORK_ITEM_DRIFT:${item.id}`);
    }
    this.db.prepare(`INSERT INTO phase3_work_items
      (id,support_case_id,domain,title,source_type,source_id,status,priority,assigned_role,assigned_to,due_at,
       completed_at,evidence_ids_json,evidence_class,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id) DO UPDATE SET
        status=excluded.status, assigned_to=excluded.assigned_to, completed_at=excluded.completed_at,
        evidence_ids_json=excluded.evidence_ids_json, updated_at=excluded.updated_at`)
      .run(item.id, item.supportCaseId, item.domain, item.title, item.sourceType, item.sourceId, item.status,
        item.priority, item.assignedRole, item.assignedTo ?? null, item.dueAt, item.completedAt ?? null,
        JSON.stringify(item.evidenceIds), item.evidenceClass, item.createdAt, item.updatedAt);
  }

  appendAudit(event: Phase3AuditEvent, supportCaseId: string): void {
    assertPhase3Synthetic({ id: event.id, evidenceClass: event.evidenceClass });
    const existing = this.db
      .prepare("SELECT * FROM phase3_audit_events WHERE id = ?")
      .get(event.id) as Row | undefined;
    if (existing) {
      const expected = {
        support_case_id: supportCaseId,
        domain: event.domain,
        action: event.action,
        entity_type: event.entityType,
        entity_id: event.entityId,
        actor_id: event.actorId,
        actor_role: event.actorRole,
        reason: event.reason,
        correlation_id: event.correlationId,
        before_json: event.before ? JSON.stringify(event.before) : null,
        after_json: event.after ? JSON.stringify(event.after) : null,
        changed_fields_json: JSON.stringify(event.changedFields),
        evidence_class: event.evidenceClass,
        occurred_at: event.occurredAt,
      };
      if (
        Object.entries(expected).some(
          ([field, value]) => existing[field] !== value,
        )
      )
        throw new Error(`PHASE3_AUDIT_EVENT_DRIFT:${event.id}`);
      return;
    }
    this.db.prepare(`INSERT OR IGNORE INTO phase3_audit_events
      (id,support_case_id,domain,action,entity_type,entity_id,actor_id,actor_role,reason,correlation_id,
       before_json,after_json,changed_fields_json,evidence_class,occurred_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(event.id, supportCaseId, event.domain, event.action, event.entityType, event.entityId,
        event.actorId, event.actorRole, event.reason, event.correlationId,
        event.before ? JSON.stringify(event.before) : null,
        event.after ? JSON.stringify(event.after) : null,
        JSON.stringify(event.changedFields), event.evidenceClass, event.occurredAt);
  }

  saveModuleSnapshot(result: Phase3ModuleResult, supportCaseId: string): void {
    const aggregateId = `SYNTH-${result.milestone.replace(".", "")}-MODULE`;
    const prior = this.db
      .prepare(
        `SELECT COALESCE(MAX(aggregate_version), 0) AS version
         FROM phase3_module_snapshots
         WHERE milestone = ? AND aggregate_type = 'milestone_result' AND aggregate_id = ?`,
      )
      .get(result.milestone, aggregateId) as { version: number };
    const aggregateVersion = Number(prior.version) + 1;
    const snapshotId = stablePhase3Id(
      "SYNTH-P3-SNAPSHOT",
      supportCaseId,
      result.milestone,
      `v${aggregateVersion}`,
    );
    assertPhase3Synthetic({ id: snapshotId, evidenceClass: result.evidenceClass });
    const transaction = this.db.transaction(() => {
      this.db.prepare(`UPDATE phase3_module_snapshots SET is_current=0
        WHERE milestone=? AND aggregate_type='milestone_result' AND aggregate_id=? AND is_current=1`)
        .run(result.milestone, aggregateId);
      this.db.prepare(`INSERT INTO phase3_module_snapshots
        (id,support_case_id,milestone,aggregate_type,aggregate_id,aggregate_version,payload_json,evidence_class,is_current,created_at)
        VALUES (?,?,?,'milestone_result',?,?,?,'synthetic_demo',1,'2026-07-14T18:00:00.000Z')`)
        .run(
          snapshotId,
          supportCaseId,
          result.milestone,
          aggregateId,
          aggregateVersion,
          JSON.stringify(result),
        );
    });
    transaction();
  }

  recordScenario(run: Phase3ScenarioRun): void {
    assertPhase3Synthetic({ id: run.id, evidenceClass: "synthetic_demo" });
    const prior = this.db
      .prepare(
        "SELECT COUNT(*) AS count FROM phase3_scenario_runs WHERE support_case_id = ? AND milestone = ?",
      )
      .get(run.supportCaseId, run.milestone) as { count: number };
    const persistedRunId = `${run.id}-V${Number(prior.count) + 1}`;
    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          "UPDATE phase3_scenario_runs SET is_current = 0 WHERE support_case_id = ? AND milestone = ? AND is_current = 1",
        )
        .run(run.supportCaseId, run.milestone);
      this.db.prepare(`INSERT INTO phase3_scenario_runs
        (id,milestone,scenario_type,status,support_case_id,started_at,completed_at,assertions_passed,assertions_failed,evidence_json,is_current)
        VALUES (?,?,?,?,?,?,?,?,?,?,1)`)
        .run(persistedRunId, run.milestone, run.scenarioType, run.status, run.supportCaseId, run.startedAt,
          run.completedAt ?? null, run.assertionsPassed, run.assertionsFailed, JSON.stringify(run.evidence));
    });
    transaction();
  }

  persistIntegratedResult(result: Phase3IntegratedResult): void {
    assertPhase3Synthetic({ id: result.supportCaseId, evidenceClass: result.evidenceClass });
    ensurePhase3ControlSchema(this.db);
    const supportCase = this.db
      .prepare("SELECT id FROM phase3_support_cases WHERE id = ?")
      .get(result.supportCaseId);
    if (!supportCase)
      throw new Error(`PHASE3_SUPPORT_CASE_NOT_INITIALIZED:${result.supportCaseId}`);
    const transaction = this.db.transaction(() => {
      for (const link of result.supportLinks) this.saveSupportLink(link, result.supportCaseId);
      for (const item of result.workItems) this.saveWorkItem(item);
      for (const module of Object.values(result.moduleResults)) this.saveModuleSnapshot(module, result.supportCaseId);
      for (const event of result.auditEvents) this.appendAudit(event, result.supportCaseId);
      this.recordScenario(result.scenarioRun);
      this.db.prepare(`UPDATE phase3_support_cases
        SET status=?, version=version+1, updated_at=? WHERE id=?`)
        .run(result.exitGate ? "completed" : "active", result.scenarioRun.completedAt ?? result.scenarioRun.startedAt, result.supportCaseId);
    });
    transaction();
  }

  overview(supportCaseId = "SYNTH-PHASE3-SUPPORT-001") {
    const supportCase = this.db.prepare("SELECT * FROM phase3_support_cases WHERE id=?").get(supportCaseId) as Row | undefined;
    if (!supportCase) return { initialized: false, supportCase: null, links: [], workItems: [], auditEvents: [], snapshots: [], scenarios: [], demoControl: null };
    const links = this.db.prepare("SELECT * FROM phase3_support_links WHERE support_case_id=? ORDER BY domain,created_at").all(supportCaseId) as Row[];
    const workItems = (this.db.prepare("SELECT * FROM phase3_work_items WHERE support_case_id=? ORDER BY domain,due_at").all(supportCaseId) as Row[])
      .map((row) => ({ ...row, evidenceIds: parseJson(row.evidence_ids_json, [] as string[]) }));
    const auditEvents = (this.db.prepare("SELECT * FROM phase3_audit_events WHERE support_case_id=? ORDER BY occurred_at DESC").all(supportCaseId) as Row[])
      .map((row) => ({ ...row, before: parseJson(row.before_json, undefined), after: parseJson(row.after_json, undefined), changedFields: parseJson(row.changed_fields_json, [] as string[]) }));
    const snapshots = (this.db.prepare("SELECT * FROM phase3_module_snapshots WHERE support_case_id=? AND is_current=1 ORDER BY milestone").all(supportCaseId) as Row[])
      .map((row) => ({ ...row, payload: parseJson(row.payload_json, {}) }));
    const scenarios = (this.db.prepare("SELECT * FROM phase3_scenario_runs WHERE support_case_id=? AND is_current=1 ORDER BY milestone,started_at").all(supportCaseId) as Row[])
      .map((row) => ({ ...row, evidence: parseJson(row.evidence_json, {}) }));
    const demoControl = this.db.prepare("SELECT * FROM phase3_demo_controls WHERE environment_id='AMOS-OPS-PHASE3-EVALUATION'").get() as Row | undefined;
    const safeDemoControl = demoControl
      ? Object.fromEntries(
          Object.entries(demoControl).filter(([field]) => field !== "reset_token"),
        )
      : null;
    return { initialized: true, supportCase, links, workItems, auditEvents, snapshots, scenarios, demoControl: safeDemoControl };
  }
}
