import type { UserRole } from "@/constants/roles";
import {
  ALL_ROLES,
} from "@/constants/roles";
import {
  M41B_CADENCES,
  M41B_EVALUATION_AS_OF,
  M41B_SOURCE_REGISTER,
  buildM41bRoleContext,
  canApproveM41b,
  canViewM41bSource,
  m41bAccountableRoles,
  m41bSourceById,
  type M41bAuditEvent,
  type M41bCadence,
  type M41bCompletionEvidence,
  type M41bGuidanceIntent,
  type M41bGuidanceRequest,
  type M41bGuidanceResponse,
  type M41bHumanDecision,
  type M41bMaterialDomain,
  type M41bRecommendation,
  type M41bRoleContext,
  type M41bWorkplan,
  type M41bWorkplanItem,
} from "@contracts/m41b";
import { sqlite } from "../../queries/connection";
import { buildM41bGuidance, m41bDeterministicId } from "./assistant-engine";
import {
  buildM41bWorkplan,
  convertApprovedM41bRecommendationToWorkplanItem,
  selectM41bSourcesForContext,
  transitionM41bWorkplanItem,
} from "./workplan-engine";
import {
  assertM41bRuntimeActive,
  assertM41bRuntimeResetAllowed,
  type M41bRuntimeControlContext,
} from "./runtime-control";
import {
  ensureM41bRuntimeSchema,
  type M41bRuntimeDatabase,
} from "./runtime-schema";

interface RunRow {
  id: string;
  scenario_id: string;
  evidence_json: string;
}

interface SnapshotRow {
  user_id: string;
  role: UserRole;
  division: M41bWorkplanItem["division"];
  payload_json: string;
}

interface InteractionRow {
  id: string;
  aggregate_id: string;
  aggregate_type: M41bAuditEvent["entityType"] | "evaluation";
  sequence: number;
  event_type: M41bAuditEvent["eventType"] | "evaluation_reset";
  actor_id: string;
  actor_role: UserRole;
  payload_json: string;
  source_ids_json: string;
  correlation_id: string;
  occurred_at: string;
}

interface InteractionPayload {
  auditEvent?: M41bAuditEvent;
  request?: M41bGuidanceRequest;
  response?: M41bGuidanceResponse;
  recommendation?: M41bRecommendation;
  decision?: M41bHumanDecision;
  task?: M41bWorkplanItem;
  evidence?: M41bCompletionEvidence;
  reset?: Readonly<Record<string, unknown>>;
}

export interface M41bRuntimeSummary {
  runId: string;
  scenarioId: string;
  roleCount: number;
  cadenceCount: number;
  productionActionsBlocked: true;
  evidenceClass: "synthetic_demo";
}

export interface AskM41bInput {
  role: UserRole;
  actorId: string;
  requestId: string;
  prompt: string;
  intent: M41bGuidanceIntent;
  sourceIds?: readonly string[];
  workplanItemId?: string;
  requestedDivision?: M41bWorkplanItem["division"];
  requestedDomain?: M41bMaterialDomain;
}

export interface M41bGuidanceResult {
  response: M41bGuidanceResponse;
  recommendation: M41bRecommendation | null;
}

export interface RecordM41bDispositionInput {
  role: UserRole;
  actorId: string;
  recommendationId: string;
  disposition: M41bHumanDecision["disposition"];
  rationale: string;
  overrideReason?: string | null;
  modifiedSummary?: string | null;
}

export interface M41bDispositionResult {
  recommendation: M41bRecommendation;
  decision: M41bHumanDecision;
  task: M41bWorkplanItem | null;
}

export interface AddM41bEvidenceInput {
  role: UserRole;
  actorId: string;
  taskId: string;
  evidenceRef: string;
  summary: string;
}

export interface M41bTaskMutationInput {
  role: UserRole;
  actorId: string;
  taskId: string;
}

export interface M41bAuditLineageResult {
  workplan: M41bWorkplan;
  sources: ReturnType<typeof selectM41bSourcesForContext>;
  requests: readonly M41bGuidanceRequest[];
  guidance: readonly M41bGuidanceResponse[];
  recommendations: readonly M41bRecommendation[];
  decisions: readonly M41bHumanDecision[];
  completionEvidence: readonly M41bCompletionEvidence[];
  auditEvents: readonly M41bAuditEvent[];
  productionActionsBlocked: true;
  evidenceClass: "synthetic_demo";
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function unique<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(values)]);
}

function allItems(workplan: M41bWorkplan): readonly M41bWorkplanItem[] {
  return M41B_CADENCES.flatMap((cadence) => workplan.briefs[cadence].items);
}

export function controlledM41bUserId(role: UserRole): string {
  return `SYNTH-M41B-${role.toUpperCase().replace(/-/g, "_")}`;
}

function controlledContext(role: UserRole): M41bRoleContext {
  return buildM41bRoleContext(role, controlledM41bUserId(role));
}

function currentRun(db: M41bRuntimeDatabase): RunRow {
  const row = db
    .prepare(
      "SELECT id,scenario_id,evidence_json FROM m41b_scenario_runs WHERE is_current=1",
    )
    .get() as RunRow | undefined;
  if (!row) throw new Error("M41B_RUNTIME_NOT_INITIALIZED");
  return row;
}

function currentSnapshot(userId: string, db: M41bRuntimeDatabase): SnapshotRow {
  const row = db
    .prepare(
      `SELECT user_id,role,division,payload_json
       FROM m41b_workplan_snapshots WHERE user_id=? AND is_current=1`,
    )
    .get(userId) as SnapshotRow | undefined;
  if (!row) throw new Error(`M41B_WORKPLAN_NOT_INITIALIZED:${userId}`);
  return row;
}

function interactionRows(db: M41bRuntimeDatabase): readonly InteractionRow[] {
  const run = currentRun(db);
  return db
    .prepare(
      `SELECT id,aggregate_id,aggregate_type,sequence,event_type,actor_id,actor_role,
              payload_json,source_ids_json,correlation_id,occurred_at
       FROM m41b_interaction_events WHERE run_id=?
       ORDER BY occurred_at,aggregate_id,sequence`,
    )
    .all(run.id) as InteractionRow[];
}

function nextRuntimeTimestamp(db: M41bRuntimeDatabase): string {
  const count = (
    db
      .prepare(
        "SELECT COUNT(*) AS count FROM m41b_interaction_events WHERE run_id=?",
      )
      .get(currentRun(db).id) as { count: number }
  ).count;
  return new Date(Date.parse(M41B_EVALUATION_AS_OF) + (count + 1) * 1_000).toISOString();
}

function auditEvent(
  eventType: M41bAuditEvent["eventType"],
  actor: M41bRoleContext,
  entityType: M41bAuditEvent["entityType"],
  entityId: string,
  correlationId: string,
  sourceIds: readonly string[],
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
  occurredAt: string,
): M41bAuditEvent {
  return Object.freeze({
    id: m41bDeterministicId(
      "M41B-AUDIT",
      correlationId,
      eventType,
      entityId,
      occurredAt,
    ),
    eventType,
    actorId: actor.userId,
    actorRole: actor.role,
    entityType,
    entityId,
    correlationId,
    sourceIds: Object.freeze([...sourceIds]),
    before,
    after,
    occurredAt,
    evidenceClass: "synthetic_demo",
  });
}

function appendInteraction(
  event: M41bAuditEvent,
  payload: Omit<InteractionPayload, "auditEvent">,
  db: M41bRuntimeDatabase,
): void {
  const run = currentRun(db);
  const aggregateId = `${run.id}:${event.correlationId}`;
  const current = db
    .prepare(
      "SELECT COALESCE(MAX(sequence),0) AS sequence FROM m41b_interaction_events WHERE aggregate_id=?",
    )
    .get(aggregateId) as { sequence: number };
  const sequence = current.sequence + 1;
  db.prepare(
    `INSERT INTO m41b_interaction_events
     (id,run_id,aggregate_id,aggregate_type,sequence,event_type,actor_id,actor_role,
       division,payload_json,source_ids_json,correlation_id,evidence_class,occurred_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'synthetic_demo',?)`,
  ).run(
    `${event.id}-${String(sequence).padStart(3, "0")}`,
    run.id,
    aggregateId,
    event.entityType,
    sequence,
    event.eventType,
    event.actorId,
    event.actorRole,
    controlledContext(event.actorRole).division,
    JSON.stringify({ auditEvent: event, ...payload }),
    JSON.stringify(event.sourceIds),
    event.correlationId,
    event.occurredAt,
  );
}

function saveWorkplanSnapshot(
  workplan: M41bWorkplan,
  db: M41bRuntimeDatabase,
): void {
  const userId = workplan.roleContext.userId;
  const previous = db
    .prepare(
      "SELECT COALESCE(MAX(snapshot_version),0) AS version FROM m41b_workplan_snapshots WHERE user_id=?",
    )
    .get(userId) as { version: number };
  const version = previous.version + 1;
  db.prepare(
    "UPDATE m41b_workplan_snapshots SET is_current=0 WHERE user_id=? AND is_current=1",
  ).run(userId);
  const sourceIds = unique(allItems(workplan).flatMap((item) => item.sourceIds));
  const run = currentRun(db);
  db.prepare(
    `INSERT INTO m41b_workplan_snapshots
      (id,run_id,user_id,role,tier,division,snapshot_version,payload_json,
       source_ids_json,evidence_class,is_current,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,'synthetic_demo',1,?)`,
  ).run(
    `${run.id}:${userId}:SNAPSHOT-${String(version).padStart(3, "0")}`,
    run.id,
    userId,
    workplan.roleContext.role,
    workplan.roleContext.tier,
    workplan.roleContext.division,
    version,
    JSON.stringify(workplan),
    JSON.stringify(sourceIds),
    workplan.generatedAt,
  );
}

function updateWorkplanItem(
  workplan: M41bWorkplan,
  updated: M41bWorkplanItem,
): M41bWorkplan {
  const items = allItems(workplan).map((item) =>
    item.id === updated.id ? updated : item,
  );
  if (!items.some((item) => item.id === updated.id))
    throw new Error(`M41B_TASK_NOT_FOUND:${updated.id}`);
  return buildM41bWorkplan(workplan.roleContext, {
    asOf: workplan.generatedAt,
    existingItems: items,
  });
}

function workplanForUser(userId: string, db: M41bRuntimeDatabase): M41bWorkplan {
  return parseJson(
    currentSnapshot(userId, db).payload_json,
    null as unknown as M41bWorkplan,
  );
}

function visiblePayloads(
  role: UserRole,
  db: M41bRuntimeDatabase,
): readonly InteractionPayload[] {
  const context = controlledContext(role);
  return interactionRows(db)
    .map((row) => ({
      row,
      payload: parseJson(row.payload_json, {} as InteractionPayload),
    }))
    .filter(({ row, payload }) => {
      const sourceIds = unique([
        ...parseJson<string[]>(row.source_ids_json, []),
        ...(payload.request?.sourceIds ?? []),
        ...(payload.response?.citations.map((citation) => citation.sourceId) ??
          []),
        ...(payload.recommendation?.sourceIds ?? []),
        ...(payload.task?.sourceIds ?? []),
        ...(payload.auditEvent?.sourceIds ?? []),
      ]);
      const sourcesAllowed = sourceIds.every((sourceId) => {
        try {
          return canViewM41bSource(context.role, m41bSourceById(sourceId));
        } catch {
          return false;
        }
      });
      if (!sourcesAllowed) return false;

      if (context.tier === "T1") return true;
      if (row.actor_id === context.userId) return true;
      if (payload.task?.ownerId === context.userId) return true;

      const actorContext = controlledContext(row.actor_role);
      if (
        actorContext.division === context.division &&
        actorContext.supervisorRoles.includes(context.role)
      )
        return true;

      const targetDivision =
        payload.task?.division ??
        payload.request?.requestedDivision ??
        actorContext.division;
      const domain =
        payload.task?.materialDomain ??
        payload.recommendation?.materialDomain ??
        payload.response?.humanGate.materialDomain ??
        payload.request?.requestedDomain;
      return (
        targetDivision === context.division &&
        Boolean(domain && canApproveM41b(context.role, domain))
      );
    })
    .map(({ payload }) => payload);
}

function latestRecords<T extends { id: string }>(records: readonly T[]): readonly T[] {
  const byId = new Map<string, T>();
  for (const record of records) byId.set(record.id, record);
  return Object.freeze([...byId.values()]);
}

function latestBy<T>(
  records: readonly T[],
  keyFor: (record: T) => string,
): readonly T[] {
  const byId = new Map<string, T>();
  for (const record of records) byId.set(keyFor(record), record);
  return Object.freeze([...byId.values()]);
}

function latestRecommendations(
  role: UserRole,
  db: M41bRuntimeDatabase,
): readonly M41bRecommendation[] {
  return latestRecords(
    visiblePayloads(role, db).flatMap((payload) =>
      payload.recommendation ? [payload.recommendation] : [],
    ),
  );
}

function requestForRecommendation(
  recommendation: M41bRecommendation,
  db: M41bRuntimeDatabase,
): M41bGuidanceRequest {
  const request = interactionRows(db)
    .map((row) => parseJson(row.payload_json, {} as InteractionPayload).request)
    .find((candidate) => candidate?.requestId === recommendation.requestId);
  if (!request)
    throw new Error(`M41B_GUIDANCE_REQUEST_NOT_FOUND:${recommendation.requestId}`);
  return request;
}

function taskLocation(
  taskId: string,
  db: M41bRuntimeDatabase,
): { workplan: M41bWorkplan; task: M41bWorkplanItem } {
  const snapshots = db
    .prepare(
      "SELECT user_id,role,division,payload_json FROM m41b_workplan_snapshots WHERE is_current=1",
    )
    .all() as SnapshotRow[];
  for (const row of snapshots) {
    const workplan = parseJson(row.payload_json, null as unknown as M41bWorkplan);
    const task = allItems(workplan).find((item) => item.id === taskId);
    if (task) return { workplan, task };
  }
  throw new Error(`M41B_TASK_NOT_FOUND:${taskId}`);
}

function assertTaskAccess(
  actor: M41bRoleContext,
  workplan: M41bWorkplan,
  task: M41bWorkplanItem,
): void {
  if (actor.userId === task.ownerId) return;
  if (actor.tier === "T1") return;
  if (
    actor.division === workplan.roleContext.division &&
    canApproveM41b(actor.role, task.materialDomain)
  )
    return;
  throw new Error(`M41B_TASK_ACCESS_DENIED:${actor.role}:${task.id}`);
}

function assertSyntheticEvidenceRef(value: string): void {
  if (!/^SYNTH-[A-Z0-9][A-Z0-9._:-]*$/i.test(value.trim()))
    throw new Error("M41B_SYNTHETIC_EVIDENCE_REFERENCE_REQUIRED");
}

export function initializeM41bRuntime(
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bRuntimeSummary {
  assertM41bRuntimeActive(db, control);
  ensureM41bRuntimeSchema(db);
  const existing = db
    .prepare(
      "SELECT id,scenario_id,evidence_json FROM m41b_scenario_runs WHERE is_current=1",
    )
    .get() as RunRow | undefined;
  if (existing)
    return Object.freeze({
      runId: existing.id,
      scenarioId: existing.scenario_id,
      roleCount: ALL_ROLES.length,
      cadenceCount: M41B_CADENCES.length,
      productionActionsBlocked: true,
      evidenceClass: "synthetic_demo",
    });

  const prior = (
    db.prepare("SELECT COUNT(*) AS count FROM m41b_scenario_runs").get() as {
      count: number;
    }
  ).count;
  const runVersion = prior + 1;
  const runId = `SYNTH-M41B-RUN-${String(runVersion).padStart(3, "0")}`;
  const scenarioId = "SYNTH-M41B-OPERATIONAL-RUNTIME";
  const evidence = {
    roleCoverage: [...ALL_ROLES],
    cadences: [...M41B_CADENCES],
    sourceIds: M41B_SOURCE_REGISTER.map((source) => source.id),
    productionActionsBlocked: true,
  };
  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `INSERT INTO m41b_scenario_runs
        (id,scenario_id,milestone,status,started_at,completed_at,assertions_passed,
         assertions_failed,evidence_json,evidence_class,is_current,created_at)
       VALUES (?,?,'M4.1B','passed',?,?,2,0,?,'synthetic_demo',1,?)`,
    ).run(
      runId,
      scenarioId,
      M41B_EVALUATION_AS_OF,
      M41B_EVALUATION_AS_OF,
      JSON.stringify(evidence),
      M41B_EVALUATION_AS_OF,
    );
    for (const role of ALL_ROLES) {
      const context = controlledContext(role);
      saveWorkplanSnapshot(buildM41bWorkplan(context), db);
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return Object.freeze({
    runId,
    scenarioId,
    roleCount: ALL_ROLES.length,
    cadenceCount: M41B_CADENCES.length,
    productionActionsBlocked: true,
    evidenceClass: "synthetic_demo",
  });
}

export function getM41bWorkplan(
  role: UserRole,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bWorkplan {
  assertM41bRuntimeActive(db, control);
  ensureM41bRuntimeSchema(db);
  initializeM41bRuntime(db, control);
  return workplanForUser(controlledM41bUserId(role), db);
}

export function getM41bCadenceBrief(
  role: UserRole,
  cadence: M41bCadence,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
) {
  return getM41bWorkplan(role, db, control).briefs[cadence];
}

export function askM41b(
  input: AskM41bInput,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bGuidanceResult {
  assertM41bRuntimeActive(db, control);
  ensureM41bRuntimeSchema(db);
  initializeM41bRuntime(db, control);
  const context = controlledContext(input.role);
  const workplan = getM41bWorkplan(input.role, db, control);
  const linkedItem = input.workplanItemId
    ? allItems(workplan).find((item) => item.id === input.workplanItemId)
    : undefined;
  if (input.workplanItemId && !linkedItem)
    throw new Error(`M41B_WORKPLAN_ITEM_NOT_FOUND:${input.workplanItemId}`);
  if (
    linkedItem &&
    input.sourceIds?.some((sourceId) => !linkedItem.sourceIds.includes(sourceId))
  )
    throw new Error(`M41B_WORKPLAN_SOURCE_SCOPE_MISMATCH:${linkedItem.id}`);
  const occurredAt = nextRuntimeTimestamp(db);
  const request: M41bGuidanceRequest = Object.freeze({
    requestId: input.requestId,
    prompt: input.prompt,
    intent: input.intent,
    roleContext: context,
    sourceIds: Object.freeze([
      ...(input.sourceIds ?? linkedItem?.sourceIds ?? []),
    ]),
    workplanItemId: linkedItem?.id,
    requestedDivision: input.requestedDivision,
    requestedDomain: input.requestedDomain ?? linkedItem?.materialDomain,
    createdAt: occurredAt,
  });
  const response = buildM41bGuidance(request);
  const recommendation: M41bRecommendation | null = response.recommendationId
    ? Object.freeze({
        id: response.recommendationId,
        requestId: request.requestId,
        summary: response.answer,
        sourceIds: Object.freeze(
          response.citations.map((citation) => citation.sourceId),
        ),
        materialDomain: response.humanGate.materialDomain,
        createdByRole: input.role,
        createdAt: occurredAt,
        status: "proposed",
        humanDecisionId: null,
        downstreamTaskId: null,
        evidenceClass: "synthetic_demo",
      })
    : null;

  db.exec("BEGIN IMMEDIATE");
  try {
    const promptEvent = auditEvent(
      "prompt_received",
      context,
      "guidance",
      request.requestId,
      request.requestId,
      request.sourceIds ?? [],
      null,
      { intent: request.intent, workplanItemId: request.workplanItemId ?? null },
      occurredAt,
    );
    appendInteraction(promptEvent, { request }, db);
    const sourceTime = nextRuntimeTimestamp(db);
    const sourceEvent = auditEvent(
      "source_retrieved",
      context,
      "guidance",
      response.responseId,
      request.requestId,
      response.citations.map((citation) => citation.sourceId),
      null,
      {
        sourceStates: response.citations.map((citation) => citation.state),
        missingEvidence: response.missingEvidence,
      },
      sourceTime,
    );
    appendInteraction(sourceEvent, { request, response }, db);
    const responseTime = nextRuntimeTimestamp(db);
    const responseEvent = auditEvent(
      response.refused ? "guidance_refused" : "guidance_issued",
      context,
      "guidance",
      response.responseId,
      request.requestId,
      response.citations.map((citation) => citation.sourceId),
      null,
      {
        recommendationId: response.recommendationId,
        refused: response.refused,
        refusalCode: response.refusalCode,
      },
      responseTime,
    );
    appendInteraction(
      responseEvent,
      { request, response, ...(recommendation ? { recommendation } : {}) },
      db,
    );
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return Object.freeze({ response, recommendation });
}

export function recordM41bHumanDisposition(
  input: RecordM41bDispositionInput,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bDispositionResult {
  assertM41bRuntimeActive(db, control);
  ensureM41bRuntimeSchema(db);
  initializeM41bRuntime(db, control);
  const actor = controlledContext(input.role);
  const recommendation = latestRecommendations(input.role, db).find(
    (candidate) => candidate.id === input.recommendationId,
  );
  if (!recommendation)
    throw new Error(`M41B_RECOMMENDATION_NOT_FOUND:${input.recommendationId}`);
  if (recommendation.status !== "proposed")
    throw new Error(`M41B_RECOMMENDATION_ALREADY_DISPOSITIONED:${recommendation.id}`);
  if (!canApproveM41b(input.role, recommendation.materialDomain))
    throw new Error(
      `M41B_HUMAN_APPROVAL_ACCESS_DENIED:${input.role}:${recommendation.materialDomain}`,
    );
  if (input.rationale.trim().length < 8)
    throw new Error("M41B_DISPOSITION_RATIONALE_REQUIRED");
  if (input.disposition === "override" && !input.overrideReason?.trim())
    throw new Error("M41B_OVERRIDE_REASON_REQUIRED");
  if (input.disposition !== "override" && input.overrideReason?.trim())
    throw new Error("M41B_OVERRIDE_REASON_WITHOUT_OVERRIDE");
  if (input.disposition === "modify" && !input.modifiedSummary?.trim())
    throw new Error("M41B_MODIFIED_SUMMARY_REQUIRED");
  if (input.disposition !== "modify" && input.modifiedSummary?.trim())
    throw new Error("M41B_MODIFIED_SUMMARY_WITHOUT_MODIFY");

  const request = requestForRecommendation(recommendation, db);
  const taskOwnerContext =
    request.requestedDivision &&
    request.requestedDivision !== request.roleContext.division &&
    actor.division === request.requestedDivision
      ? actor
      : request.roleContext;
  const occurredAt = nextRuntimeTimestamp(db);
  const decisionId = m41bDeterministicId(
    "M41B-DECISION",
    recommendation.id,
    input.role,
    input.disposition,
  );
  const decision: M41bHumanDecision = Object.freeze({
    id: decisionId,
    recommendationId: recommendation.id,
    disposition: input.disposition,
    rationale: input.rationale.trim(),
    decidedBy: actor.userId,
    decidedByRole: input.role,
    decidedAt: occurredAt,
    overrideReason:
      input.disposition === "override"
        ? (input.overrideReason?.trim() ?? null)
        : null,
    evidenceClass: "synthetic_demo",
  });
  const accepted = input.disposition !== "reject";
  const taskId = accepted
    ? m41bDeterministicId(
        "SYNTH-M41B-TASK",
        recommendation.id,
        taskOwnerContext.userId,
      )
    : null;
  const updatedRecommendation: M41bRecommendation = Object.freeze({
    ...recommendation,
    summary:
      input.disposition === "modify"
        ? (input.modifiedSummary?.trim() ?? recommendation.summary)
        : recommendation.summary,
    status:
      input.disposition === "reject"
        ? "rejected"
        : input.disposition === "modify"
          ? "modified"
          : "approved",
    humanDecisionId: decision.id,
    downstreamTaskId: taskId,
  });
  const task = accepted
    ? convertApprovedM41bRecommendationToWorkplanItem(
        updatedRecommendation,
        taskOwnerContext,
      )
    : null;

  db.exec("BEGIN IMMEDIATE");
  try {
    if (task) {
      const ownerWorkplan = workplanForUser(taskOwnerContext.userId, db);
      const updatedWorkplan = buildM41bWorkplan(taskOwnerContext, {
        asOf: ownerWorkplan.generatedAt,
        existingItems: allItems(ownerWorkplan),
        approvedRecommendations: [updatedRecommendation],
      });
      saveWorkplanSnapshot(updatedWorkplan, db);
    }
    const dispositionEvent = auditEvent(
      "human_disposition_recorded",
      actor,
      "decision",
      decision.id,
      recommendation.requestId,
      recommendation.sourceIds,
      { recommendation },
      { recommendation: updatedRecommendation, decision },
      occurredAt,
    );
    appendInteraction(
      dispositionEvent,
      {
        request,
        recommendation: updatedRecommendation,
        decision,
        ...(task ? { task } : {}),
      },
      db,
    );
    if (task) {
      const taskTime = nextRuntimeTimestamp(db);
      const taskEvent = auditEvent(
        "task_created",
        actor,
        "workplan_item",
        task.id,
        recommendation.requestId,
        task.sourceIds,
        null,
        { task },
        taskTime,
      );
      appendInteraction(
        taskEvent,
        { request, recommendation: updatedRecommendation, decision, task },
        db,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return Object.freeze({
    recommendation: updatedRecommendation,
    decision,
    task,
  });
}

export function addM41bCompletionEvidence(
  input: AddM41bEvidenceInput,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bCompletionEvidence {
  assertM41bRuntimeActive(db, control);
  ensureM41bRuntimeSchema(db);
  initializeM41bRuntime(db, control);
  assertSyntheticEvidenceRef(input.evidenceRef);
  if (input.summary.trim().length < 8)
    throw new Error("M41B_COMPLETION_EVIDENCE_SUMMARY_REQUIRED");
  const actor = controlledContext(input.role);
  const located = taskLocation(input.taskId, db);
  assertTaskAccess(actor, located.workplan, located.task);
  if (["completed", "refused"].includes(located.task.status))
    throw new Error(`M41B_TASK_TERMINAL:${located.task.id}:${located.task.status}`);
  if (located.task.status === "pending_approval" || located.task.status === "proposed")
    throw new Error(`M41B_TASK_APPROVAL_REQUIRED:${located.task.id}`);
  const occurredAt = nextRuntimeTimestamp(db);
  const evidence: M41bCompletionEvidence = Object.freeze({
    id: m41bDeterministicId(
      "SYNTH-M41B-EVIDENCE",
      located.task.id,
      input.evidenceRef,
    ),
    taskId: located.task.id,
    evidenceRef: input.evidenceRef.trim(),
    summary: input.summary.trim(),
    recordedBy: actor.userId,
    recordedAt: occurredAt,
    evidenceClass: "synthetic_demo",
  });
  let working = located.task;
  if (working.status === "approved" || working.status === "escalated")
    working = transitionM41bWorkplanItem(working, { status: "in_progress" });
  if (working.status === "in_progress")
    working = transitionM41bWorkplanItem(working, {
      status: "evidence_pending",
      completionEvidenceIds: unique([
        ...working.completionEvidenceIds,
        evidence.id,
      ]),
    });
  else
    working = transitionM41bWorkplanItem(working, {
      status: working.status,
      completionEvidenceIds: unique([
        ...working.completionEvidenceIds,
        evidence.id,
      ]),
    });
  const updatedWorkplan = updateWorkplanItem(located.workplan, working);

  db.exec("BEGIN IMMEDIATE");
  try {
    saveWorkplanSnapshot(updatedWorkplan, db);
    const event = auditEvent(
      "completion_evidence_added",
      actor,
      "evidence",
      evidence.id,
      located.task.recommendationId ?? located.task.id,
      located.task.sourceIds,
      { task: located.task },
      { task: working, evidence },
      occurredAt,
    );
    appendInteraction(event, { task: working, evidence }, db);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return evidence;
}

export function completeM41bTask(
  input: M41bTaskMutationInput,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bWorkplanItem {
  assertM41bRuntimeActive(db, control);
  ensureM41bRuntimeSchema(db);
  initializeM41bRuntime(db, control);
  const actor = controlledContext(input.role);
  const located = taskLocation(input.taskId, db);
  assertTaskAccess(actor, located.workplan, located.task);
  if (located.task.status !== "evidence_pending")
    throw new Error(`M41B_TASK_EVIDENCE_PENDING_REQUIRED:${located.task.id}`);
  if (!located.task.completionEvidenceIds.length)
    throw new Error(`M41B_SILENT_CLOSURE_DENIED:EVIDENCE_REQUIRED:${located.task.id}`);
  const occurredAt = nextRuntimeTimestamp(db);
  const completed = transitionM41bWorkplanItem(located.task, {
    status: "completed",
    closedAt: occurredAt,
  });
  const updatedWorkplan = updateWorkplanItem(located.workplan, completed);
  db.exec("BEGIN IMMEDIATE");
  try {
    saveWorkplanSnapshot(updatedWorkplan, db);
    const event = auditEvent(
      "task_completed",
      actor,
      "workplan_item",
      completed.id,
      completed.recommendationId ?? completed.id,
      completed.sourceIds,
      { task: located.task },
      { task: completed },
      occurredAt,
    );
    appendInteraction(event, { task: completed }, db);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return completed;
}

export function escalateM41bTask(
  input: M41bTaskMutationInput,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bWorkplanItem {
  assertM41bRuntimeActive(db, control);
  ensureM41bRuntimeSchema(db);
  initializeM41bRuntime(db, control);
  const actor = controlledContext(input.role);
  const located = taskLocation(input.taskId, db);
  assertTaskAccess(actor, located.workplan, located.task);
  if (["completed", "refused"].includes(located.task.status))
    throw new Error(`M41B_TASK_TERMINAL:${located.task.id}:${located.task.status}`);
  const occurredAt = nextRuntimeTimestamp(db);
  const escalated = transitionM41bWorkplanItem(located.task, {
    status: "escalated",
  });
  const updatedWorkplan = updateWorkplanItem(located.workplan, escalated);
  db.exec("BEGIN IMMEDIATE");
  try {
    saveWorkplanSnapshot(updatedWorkplan, db);
    const event = auditEvent(
      "task_escalated",
      actor,
      "workplan_item",
      escalated.id,
      escalated.recommendationId ?? escalated.id,
      escalated.sourceIds,
      { task: located.task },
      { task: escalated, routeTo: m41bAccountableRoles(escalated.materialDomain) },
      occurredAt,
    );
    appendInteraction(event, { task: escalated }, db);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return escalated;
}

export function getM41bAuditLineage(
  role: UserRole,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bAuditLineageResult {
  const workplan = getM41bWorkplan(role, db, control);
  const payloads = visiblePayloads(role, db);
  return Object.freeze({
    workplan,
    sources: selectM41bSourcesForContext(workplan.roleContext),
    requests: latestBy(
      payloads.flatMap((payload) => (payload.request ? [payload.request] : [])),
      (request) => request.requestId,
    ),
    guidance: latestBy(
      payloads.flatMap((payload) => (payload.response ? [payload.response] : [])),
      (response) => response.responseId,
    ),
    recommendations: latestRecords(
      payloads.flatMap((payload) =>
        payload.recommendation ? [payload.recommendation] : [],
      ),
    ),
    decisions: latestRecords(
      payloads.flatMap((payload) => (payload.decision ? [payload.decision] : [])),
    ),
    completionEvidence: latestRecords(
      payloads.flatMap((payload) => (payload.evidence ? [payload.evidence] : [])),
    ),
    auditEvents: latestRecords(
      payloads.flatMap((payload) =>
        payload.auditEvent ? [payload.auditEvent] : [],
      ),
    ),
    productionActionsBlocked: true,
    evidenceClass: "synthetic_demo",
  });
}

export function resetM41bEvaluation(
  role: UserRole,
  db: M41bRuntimeDatabase = sqlite,
  control?: M41bRuntimeControlContext,
): M41bRuntimeSummary {
  const state = assertM41bRuntimeResetAllowed(db, control);
  ensureM41bRuntimeSchema(db);
  const actor = controlledContext(role);
  if (actor.tier !== "T1")
    throw new Error(`M41B_RESET_ACCESS_DENIED:${role}`);
  const run = currentRun(db);
  const occurredAt = nextRuntimeTimestamp(db);
  const resetEvent = auditEvent(
    "evaluation_reset",
    actor,
    "evaluation",
    run.id,
    run.id,
    [],
    null,
    { reset: true, controlUpdatedAt: state.updatedAt },
    occurredAt,
  );
  db.exec("BEGIN IMMEDIATE");
  try {
    appendInteraction(
      resetEvent,
      { reset: { controlUpdatedAt: state.updatedAt, resetAt: occurredAt } },
      db,
    );
    db.prepare(
      "UPDATE m41b_workplan_snapshots SET is_current=0 WHERE is_current=1",
    ).run();
    db.prepare("UPDATE m41b_scenario_runs SET is_current=0 WHERE is_current=1").run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return initializeM41bRuntime(db, control);
}
