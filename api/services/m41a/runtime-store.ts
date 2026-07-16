import { createHash } from "node:crypto";
import type { UserRole } from "@/constants/roles";
import {
  assertM41aScopeAuthorized,
  buildM41aDashboardAccess,
  type M41aAuditEvent,
  type M41aDashboard,
  type M41aDecisionDisposition,
  type M41aDecisionRecord,
  type M41aDrilldownResponse,
  type M41aFollowUpEvidence,
  type M41aScopeId,
  type M41aThresholdAlert,
} from "@contracts/m41a";
import { sqlite } from "../../queries/connection";
import {
  buildM41aDrilldown,
  projectM41aDashboard,
  runM41aScenario,
  type M41aOperationalScenarioResult,
} from "./engine";
import { buildM41aSourceBundle, M41A_AS_OF } from "./source-adapters";
import {
  assertM41aRuntimeActive,
  assertM41aRuntimeResetAllowed,
  type M41aRuntimeControlContext,
} from "./runtime-control";
import {
  ensureM41aRuntimeSchema,
  type M41aRuntimeDatabase,
} from "./runtime-schema";

interface ScenarioRow {
  id: string;
  scenario_id: string;
  evidence_json: string;
}

interface SnapshotRow {
  payload_json: string;
}

interface EventRow {
  id: string;
  aggregate_id: string;
  aggregate_type: M41aAuditEvent["entityType"];
  sequence: number;
  event_type: M41aAuditEvent["action"];
  scope: M41aScopeId;
  metric_id: string | null;
  actor_id: string;
  actor_role: UserRole | "system";
  payload_json: string;
  correlation_id: string;
  occurred_at: string;
}

interface StoredEvidence {
  initialAlerts: readonly M41aThresholdAlert[];
}

export interface M41aAlertListResult {
  alerts: readonly M41aThresholdAlert[];
  decisions: readonly M41aDecisionRecord[];
  followUpEvidence: readonly M41aFollowUpEvidence[];
}

interface BaseMutationInput {
  role: UserRole;
  scope: M41aScopeId;
  alertId: string;
  actorId: string;
  occurredAt?: string;
  expectedSequence?: number;
}

export interface AssignM41aAlertInput extends BaseMutationInput {
  assignedTo: string;
}

export interface RecordM41aDecisionInput extends BaseMutationInput {
  disposition: M41aDecisionDisposition;
  rationale: string;
}

export interface AddM41aFollowUpEvidenceInput extends BaseMutationInput {
  evidenceRef: string;
  summary: string;
}

function currentRun(db: M41aRuntimeDatabase): ScenarioRow {
  const row = db
    .prepare(
      "SELECT id,scenario_id,evidence_json FROM m41a_scenario_runs WHERE is_current=1",
    )
    .get() as ScenarioRow | undefined;
  if (!row) throw new Error("M41A_RUNTIME_NOT_INITIALIZED");
  return row;
}

function controlledActor(actorId: string, role: UserRole): string {
  if (actorId.startsWith("SYNTH-")) return actorId;
  return `SYNTH-M41A-${role.toUpperCase().replace(/-/g, "_")}`;
}

function eventPayload(row: EventRow): {
  before: Readonly<Record<string, unknown>> | null;
  after: Readonly<Record<string, unknown>> | null;
  entityId?: string;
} {
  return JSON.parse(row.payload_json) as {
    before: Readonly<Record<string, unknown>> | null;
    after: Readonly<Record<string, unknown>> | null;
    entityId?: string;
  };
}

function runtimeEvents(
  runId: string,
  db: M41aRuntimeDatabase,
): readonly EventRow[] {
  return db
    .prepare(
      `SELECT id,aggregate_id,aggregate_type,sequence,event_type,scope,metric_id,
              actor_id,actor_role,payload_json,correlation_id,occurred_at
       FROM m41a_decision_events
       WHERE aggregate_id LIKE ?
       ORDER BY occurred_at,aggregate_id,sequence`,
    )
    .all(`${runId}:%`) as EventRow[];
}

function allCurrentAlerts(db: M41aRuntimeDatabase): M41aThresholdAlert[] {
  const run = currentRun(db);
  const evidence = JSON.parse(run.evidence_json) as StoredEvidence;
  const byId = new Map(
    evidence.initialAlerts.map((item) => [
      item.id,
      { ...item, followUpEvidenceIds: [...item.followUpEvidenceIds] },
    ]),
  );
  for (const row of runtimeEvents(run.id, db)) {
    const alert = byId.get(row.correlation_id);
    if (!alert) continue;
    const payload = eventPayload(row);
    if (
      row.event_type === "alert_triggered" ||
      row.event_type === "alert_acknowledged" ||
      row.event_type === "alert_assigned" ||
      row.event_type === "alert_resolved"
    ) {
      Object.assign(alert, payload.after ?? {});
    } else if (row.event_type === "decision_recorded") {
      const decision = payload.after as unknown as M41aDecisionRecord;
      alert.status = "decided";
      alert.decisionId = decision.id;
    } else if (row.event_type === "follow_up_evidence_added") {
      const followUp = payload.after as unknown as M41aFollowUpEvidence;
      alert.status = "evidence_pending";
      if (!alert.followUpEvidenceIds.includes(followUp.id))
        alert.followUpEvidenceIds.push(followUp.id);
    }
  }
  return [...byId.values()];
}

function assertDecisionAccess(role: UserRole, scope: M41aScopeId): void {
  assertM41aScopeAuthorized(role, scope);
  if (!buildM41aDashboardAccess(role, scope).decisionActionsAllowed)
    throw new Error(`M41A_DECISION_ACCESS_DENIED:${role}:${scope}`);
}

function alertForMutation(
  input: BaseMutationInput,
  db: M41aRuntimeDatabase,
): M41aThresholdAlert {
  assertDecisionAccess(input.role, input.scope);
  const alert = allCurrentAlerts(db).find((item) => item.id === input.alertId);
  if (!alert) throw new Error(`M41A_ALERT_NOT_FOUND:${input.alertId}`);
  if (alert.scope !== input.scope)
    throw new Error(
      `M41A_ALERT_SCOPE_MISMATCH:${input.alertId}:${input.scope}`,
    );
  return alert;
}

function appendEvent(
  input: BaseMutationInput,
  eventType: M41aAuditEvent["action"],
  aggregateType: M41aAuditEvent["entityType"],
  entityId: string,
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
  occurredAt: string,
  db: M41aRuntimeDatabase,
): number {
  const run = currentRun(db);
  const aggregateId = `${run.id}:${input.alertId}`;
  const current = db
    .prepare(
      "SELECT COALESCE(MAX(sequence),0) AS sequence FROM m41a_decision_events WHERE aggregate_id=?",
    )
    .get(aggregateId) as { sequence: number };
  if (
    input.expectedSequence !== undefined &&
    input.expectedSequence !== current.sequence
  )
    throw new Error(
      `M41A_EVENT_SEQUENCE_CONFLICT:${input.alertId}:${input.expectedSequence}:${current.sequence}`,
    );
  const sequence = current.sequence + 1;
  const entityKey = createHash("sha256")
    .update(entityId)
    .digest("hex")
    .slice(0, 12);
  const id = `${aggregateId}:${entityKey}:${String(sequence).padStart(3, "0")}`;
  db.prepare(
    `INSERT INTO m41a_decision_events
      (id,aggregate_id,aggregate_type,sequence,event_type,scope,metric_id,actor_id,
       actor_role,payload_json,correlation_id,evidence_class,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,'synthetic_demo',?)`,
  ).run(
    id,
    aggregateId,
    aggregateType,
    sequence,
    eventType,
    input.scope,
    alertForMetric(input.alertId, db)?.metricId ?? null,
    controlledActor(input.actorId, input.role),
    input.role,
    JSON.stringify({ entityId, before, after }),
    input.alertId,
    occurredAt,
  );
  return sequence;
}

function alertForMetric(
  alertId: string,
  db: M41aRuntimeDatabase,
): M41aThresholdAlert | undefined {
  return allCurrentAlerts(db).find((item) => item.id === alertId);
}

export function initializeM41aRuntime(
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aOperationalScenarioResult {
  assertM41aRuntimeActive(db, control);
  ensureM41aRuntimeSchema(db);
  const scenario = runM41aScenario();
  const existing = db
    .prepare("SELECT id FROM m41a_scenario_runs WHERE is_current=1")
    .get() as { id: string } | undefined;
  if (existing) return Object.freeze({ ...scenario, runId: existing.id });
  const count = (
    db.prepare("SELECT COUNT(*) AS count FROM m41a_scenario_runs").get() as {
      count: number;
    }
  ).count;
  const version = count + 1;
  const runId =
    version === 1
      ? scenario.runId
      : `${scenario.runId}-V${String(version).padStart(3, "0")}`;
  const storedEvidence = {
    initialAlerts: scenario.initialAlerts,
    criteria: scenario.criteria,
    decisions: scenario.decisions,
    followUpEvidence: scenario.followUpEvidence,
    drilldownEvidence: scenario.drilldownEvidence,
    accessEvaluations: scenario.accessEvaluations,
    dataQualityScenarios: scenario.dataQualityScenarios,
    sourceRegister: scenario.sourceRegister,
    reconciliations: scenario.reconciliations,
    productionActionsBlocked: true,
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO m41a_scenario_runs
        (id,scenario_id,milestone,status,started_at,completed_at,assertions_passed,
         assertions_failed,evidence_json,evidence_class,is_current,created_at)
       VALUES (?,?,'M4.1A',?,?,?,?,?,?,'synthetic_demo',1,?)`,
    ).run(
      runId,
      scenario.scenarioId,
      scenario.exitGate ? "passed" : "failed",
      scenario.startedAt,
      scenario.completedAt,
      scenario.criteria.filter((item) => item.passed).length,
      scenario.criteria.filter((item) => !item.passed).length,
      JSON.stringify(storedEvidence),
      scenario.completedAt,
    );
    for (const [scope, dashboard] of Object.entries(
      scenario.dashboards,
    ) as Array<[M41aScopeId, M41aDashboard]>) {
      const previous = db
        .prepare(
          "SELECT COALESCE(MAX(snapshot_version),0) AS version FROM m41a_dashboard_snapshots WHERE scope=?",
        )
        .get(scope) as { version: number };
      const snapshotVersion = previous.version + 1;
      const sourceHashes = dashboard.metrics
        .map((item) => item.sourceReportId)
        .filter((id): id is string => id !== null)
        .map((id) => createHash("sha256").update(id).digest("hex"));
      db.prepare(
        `INSERT INTO m41a_dashboard_snapshots
          (id,run_id,scope,snapshot_version,payload_json,source_hashes_json,
           reconciliation_status,evidence_class,is_current,created_at)
         VALUES (?,?,?,?,?,?,?,'synthetic_demo',1,?)`,
      ).run(
        `${dashboard.scope}-${runId}-SNAPSHOT-${snapshotVersion}`,
        runId,
        scope,
        snapshotVersion,
        JSON.stringify(dashboard),
        JSON.stringify(sourceHashes),
        dashboard.metrics.every((item) => item.reconciliation.reconciled)
          ? "reconciled"
          : "exception",
        scenario.completedAt,
      );
    }
    const sequences = new Map<string, number>();
    const alertById = new Map(
      scenario.initialAlerts.map((item) => [item.id, item]),
    );
    for (const event of scenario.auditEvents) {
      const aggregateId = `${runId}:${event.correlationId}`;
      const sequence = (sequences.get(aggregateId) ?? 0) + 1;
      sequences.set(aggregateId, sequence);
      const alert = alertById.get(event.correlationId);
      db.prepare(
        `INSERT INTO m41a_decision_events
          (id,aggregate_id,aggregate_type,sequence,event_type,scope,metric_id,
           actor_id,actor_role,payload_json,correlation_id,evidence_class,occurred_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,'synthetic_demo',?)`,
      ).run(
        `${event.id}:${runId}`,
        aggregateId,
        event.entityType,
        sequence,
        event.action,
        alert?.scope ?? "ENTERPRISE",
        alert?.metricId ?? null,
        event.actorId,
        event.actorRole,
        JSON.stringify({
          entityId: event.entityId,
          before: event.before,
          after: event.after,
        }),
        event.correlationId,
        event.occurredAt,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return Object.freeze({ ...scenario, runId });
}

export function getM41aDashboard(
  role: UserRole,
  scope: M41aScopeId,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aDashboard {
  assertM41aRuntimeActive(db, control);
  ensureM41aRuntimeSchema(db);
  assertM41aScopeAuthorized(role, scope);
  const row = db
    .prepare(
      "SELECT payload_json FROM m41a_dashboard_snapshots WHERE scope=? AND is_current=1",
    )
    .get(scope) as SnapshotRow | undefined;
  if (!row) throw new Error(`M41A_DASHBOARD_NOT_INITIALIZED:${scope}`);
  const projected = projectM41aDashboard(
    JSON.parse(row.payload_json) as M41aDashboard,
    role,
  );
  const visibleMetrics = new Set(
    projected.metrics
      .filter((item) => item.dataQualityState !== "suppressed")
      .map((item) => item.definition.id),
  );
  const openAlertCount = allCurrentAlerts(db).filter(
    (item) =>
      item.scope === scope &&
      item.status !== "resolved" &&
      visibleMetrics.has(item.metricId),
  ).length;
  return Object.freeze({ ...projected, openAlertCount });
}

export function getM41aDrilldown(
  role: UserRole,
  scope: M41aScopeId,
  metricId: string,
  depth: 1 | 2 | 3,
  parentId: string | null = null,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aDrilldownResponse {
  const dashboard = getM41aDashboard(role, scope, db, control);
  return buildM41aDrilldown(
    dashboard,
    buildM41aSourceBundle(),
    metricId,
    depth,
    parentId,
  );
}

export function listM41aAlerts(
  role: UserRole,
  scope: M41aScopeId,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aAlertListResult {
  const dashboard = getM41aDashboard(role, scope, db, control);
  const visibleMetrics = new Set(
    dashboard.metrics
      .filter((item) => item.dataQualityState !== "suppressed")
      .map((item) => item.definition.id),
  );
  const alerts = Object.freeze(
    allCurrentAlerts(db)
      .filter(
        (item) => item.scope === scope && visibleMetrics.has(item.metricId),
      )
      .map((item) => Object.freeze({ ...item })),
  );
  const visibleAlertIds = new Set(alerts.map((item) => item.id));
  const run = currentRun(db);
  const decisions = new Map<string, M41aDecisionRecord>();
  const followUpEvidence = new Map<string, M41aFollowUpEvidence>();
  for (const row of runtimeEvents(run.id, db)) {
    if (!visibleAlertIds.has(row.correlation_id)) continue;
    const payload = eventPayload(row).after;
    if (row.event_type === "decision_recorded" && payload) {
      const decision = payload as unknown as M41aDecisionRecord;
      decisions.set(decision.id, Object.freeze({ ...decision }));
    }
    if (row.event_type === "follow_up_evidence_added" && payload) {
      const evidence = payload as unknown as M41aFollowUpEvidence;
      followUpEvidence.set(evidence.id, Object.freeze({ ...evidence }));
    }
  }
  return Object.freeze({
    alerts,
    decisions: Object.freeze([...decisions.values()]),
    followUpEvidence: Object.freeze([...followUpEvidence.values()]),
  });
}

export function acknowledgeM41aAlert(
  input: BaseMutationInput,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aThresholdAlert {
  assertM41aRuntimeActive(db, control);
  const before = alertForMutation(input, db);
  if (before.status !== "open")
    throw new Error(
      `M41A_INVALID_ALERT_TRANSITION:${before.status}:acknowledged`,
    );
  const occurredAt = input.occurredAt ?? "2026-10-14T12:10:00.000Z";
  const after: M41aThresholdAlert = {
    ...before,
    status: "acknowledged",
    acknowledgedAt: occurredAt,
    acknowledgedBy: controlledActor(input.actorId, input.role),
  };
  appendEvent(
    input,
    "alert_acknowledged",
    "alert",
    after.id,
    before as unknown as Readonly<Record<string, unknown>>,
    after as unknown as Readonly<Record<string, unknown>>,
    occurredAt,
    db,
  );
  return Object.freeze(after);
}

export function assignM41aAlert(
  input: AssignM41aAlertInput,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aThresholdAlert {
  assertM41aRuntimeActive(db, control);
  const before = alertForMutation(input, db);
  if (before.status !== "acknowledged")
    throw new Error(`M41A_INVALID_ALERT_TRANSITION:${before.status}:assigned`);
  const occurredAt = input.occurredAt ?? "2026-10-14T12:11:00.000Z";
  const after: M41aThresholdAlert = {
    ...before,
    status: "assigned",
    assignedAt: occurredAt,
    assignedTo: input.assignedTo.startsWith("SYNTH-")
      ? input.assignedTo
      : "SYNTH-M41A-ASSIGNEE",
  };
  appendEvent(
    input,
    "alert_assigned",
    "alert",
    after.id,
    before as unknown as Readonly<Record<string, unknown>>,
    after as unknown as Readonly<Record<string, unknown>>,
    occurredAt,
    db,
  );
  return Object.freeze(after);
}

export function recordM41aDecision(
  input: RecordM41aDecisionInput,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aDecisionRecord {
  assertM41aRuntimeActive(db, control);
  if (input.rationale.trim().length === 0)
    throw new Error("M41A_DECISION_RATIONALE_REQUIRED");
  const before = alertForMutation(input, db);
  if (before.status !== "assigned")
    throw new Error(`M41A_INVALID_ALERT_TRANSITION:${before.status}:decided`);
  const occurredAt = input.occurredAt ?? "2026-10-14T12:12:00.000Z";
  const decision: M41aDecisionRecord = Object.freeze({
    id: `SYNTH-M41A-DECISION-${input.alertId}-${occurredAt.replace(/\D/g, "")}`,
    alertId: input.alertId,
    disposition: input.disposition,
    rationale: input.rationale,
    decidedBy: controlledActor(input.actorId, input.role),
    decidedByRole: input.role,
    decidedAt: occurredAt,
    humanApproved: true,
    evidenceClass: "synthetic_demo",
  });
  appendEvent(
    input,
    "decision_recorded",
    "decision",
    decision.id,
    before as unknown as Readonly<Record<string, unknown>>,
    decision as unknown as Readonly<Record<string, unknown>>,
    occurredAt,
    db,
  );
  return decision;
}

export function addM41aFollowUpEvidence(
  input: AddM41aFollowUpEvidenceInput,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aFollowUpEvidence {
  assertM41aRuntimeActive(db, control);
  if (input.evidenceRef.trim().length === 0)
    throw new Error("M41A_EVIDENCE_REFERENCE_REQUIRED");
  if (input.summary.trim().length === 0)
    throw new Error("M41A_EVIDENCE_SUMMARY_REQUIRED");
  const before = alertForMutation(input, db);
  if (before.status !== "decided" && before.status !== "evidence_pending")
    throw new Error(
      `M41A_INVALID_ALERT_TRANSITION:${before.status}:evidence_pending`,
    );
  const occurredAt = input.occurredAt ?? "2026-10-14T12:13:00.000Z";
  const evidence: M41aFollowUpEvidence = Object.freeze({
    id: `SYNTH-M41A-EVIDENCE-${input.alertId}-${occurredAt.replace(/\D/g, "")}`,
    alertId: input.alertId,
    evidenceRef: input.evidenceRef.startsWith("SYNTH-")
      ? input.evidenceRef
      : "SYNTH-M41A-FOLLOW-UP",
    summary: input.summary,
    recordedBy: controlledActor(input.actorId, input.role),
    recordedAt: occurredAt,
    evidenceClass: "synthetic_demo",
  });
  appendEvent(
    input,
    "follow_up_evidence_added",
    "follow_up_evidence",
    evidence.id,
    before as unknown as Readonly<Record<string, unknown>>,
    evidence as unknown as Readonly<Record<string, unknown>>,
    occurredAt,
    db,
  );
  return evidence;
}

export function resolveM41aAlert(
  input: BaseMutationInput,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): M41aThresholdAlert {
  assertM41aRuntimeActive(db, control);
  const before = alertForMutation(input, db);
  if (
    before.status !== "evidence_pending" ||
    before.followUpEvidenceIds.length === 0
  )
    throw new Error(`M41A_INVALID_ALERT_TRANSITION:${before.status}:resolved`);
  const occurredAt = input.occurredAt ?? "2026-10-14T12:14:00.000Z";
  const after: M41aThresholdAlert = {
    ...before,
    status: "resolved",
    resolvedAt: occurredAt,
  };
  appendEvent(
    input,
    "alert_resolved",
    "alert",
    after.id,
    before as unknown as Readonly<Record<string, unknown>>,
    after as unknown as Readonly<Record<string, unknown>>,
    occurredAt,
    db,
  );
  return Object.freeze(after);
}

export function listM41aAuditEvents(
  role: UserRole,
  scope: M41aScopeId,
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): readonly M41aAuditEvent[] {
  assertM41aRuntimeActive(db, control);
  assertM41aScopeAuthorized(role, scope);
  const run = currentRun(db);
  return Object.freeze(
    runtimeEvents(run.id, db)
      .filter((row) => row.scope === scope)
      .map((row) => {
        const payload = eventPayload(row);
        return Object.freeze({
          id: row.id,
          action: row.event_type,
          entityType: row.aggregate_type,
          entityId: payload.entityId ?? row.aggregate_id,
          actorId: row.actor_id,
          actorRole: row.actor_role,
          occurredAt: row.occurred_at,
          before: payload.before,
          after: payload.after,
          correlationId: row.correlation_id,
          evidenceClass: "synthetic_demo" as const,
        });
      }),
  );
}

export function resetM41aEvaluation(
  input: { role: UserRole; actorId: string; occurredAt?: string },
  db: M41aRuntimeDatabase = sqlite,
  control?: M41aRuntimeControlContext,
): {
  resetAt: string;
  resetRunId: string;
  historyPreserved: true;
  productionActionsBlocked: true;
} {
  assertM41aRuntimeResetAllowed(db, control);
  ensureM41aRuntimeSchema(db);
  assertDecisionAccess(input.role, "ENTERPRISE");
  const run = currentRun(db);
  const occurredAt = input.occurredAt ?? "2026-10-14T12:15:00.000Z";
  const aggregateId = `${run.id}:EVALUATION`;
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      "UPDATE m41a_dashboard_snapshots SET is_current=0 WHERE run_id=? AND is_current=1",
    ).run(run.id);
    db.prepare(
      "UPDATE m41a_scenario_runs SET is_current=0 WHERE id=? AND is_current=1",
    ).run(run.id);
    db.prepare(
      `INSERT INTO m41a_decision_events
        (id,aggregate_id,aggregate_type,sequence,event_type,scope,metric_id,actor_id,
         actor_role,payload_json,correlation_id,evidence_class,occurred_at)
       VALUES (?,?,'evaluation',1,'evaluation_reset','ENTERPRISE',NULL,?,?,?,?,
               'synthetic_demo',?)`,
    ).run(
      `${aggregateId}:001`,
      aggregateId,
      controlledActor(input.actorId, input.role),
      input.role,
      JSON.stringify({
        entityId: run.id,
        before: { runId: run.id, isCurrent: true },
        after: { runId: run.id, isCurrent: false },
      }),
      run.id,
      occurredAt,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return Object.freeze({
    resetAt: occurredAt,
    resetRunId: run.id,
    historyPreserved: true,
    productionActionsBlocked: true,
  });
}

export const M41A_RUNTIME_AS_OF = M41A_AS_OF;
