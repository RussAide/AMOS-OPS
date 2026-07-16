import type { UserRole } from "@/constants/roles";
import {
  buildM41bRoleContext,
  canApproveM41b,
  type M41bAuditEvent,
  type M41bCadence,
  type M41bCompletionEvidence,
  type M41bGuidanceRequest,
  type M41bGuidanceResponse,
  type M41bHumanDecision,
  type M41bRecommendation,
  type M41bWorkplanItem,
} from "@contracts/m41b";
import { m41bDeterministicId } from "./assistant-engine";

const NON_HUMAN_ACTOR_PATTERN =
  /^(?:ai|amos|assistant|model|system)(?:$|[-_:])/i;

export interface M41bPromptContextSnapshot {
  requestId: string;
  prompt: string;
  intent: M41bGuidanceRequest["intent"];
  actorId: string;
  actorRole: UserRole;
  tier: M41bGuidanceRequest["roleContext"]["tier"];
  division: M41bGuidanceRequest["roleContext"]["division"];
  department: string;
  caseloadIds: readonly string[];
  delegatedActions: readonly string[];
  workplanItemId: string | null;
  requestedDivision: M41bGuidanceRequest["requestedDivision"] | null;
  requestedDomain: M41bGuidanceRequest["requestedDomain"] | null;
  createdAt: string;
}

export interface M41bOverrideTrace {
  decisionId: string;
  reason: string;
  actorId: string;
  actorRole: UserRole;
  occurredAt: string;
}

export interface M41bGuidanceLineage {
  lineageId: string;
  correlationId: string;
  promptContext: M41bPromptContextSnapshot;
  request: M41bGuidanceRequest;
  response: M41bGuidanceResponse;
  sourceIds: readonly string[];
  recommendation: M41bRecommendation | null;
  decision: M41bHumanDecision | null;
  override: M41bOverrideTrace | null;
  task: M41bWorkplanItem | null;
  completionEvidence: readonly M41bCompletionEvidence[];
  auditEvents: readonly M41bAuditEvent[];
  evidenceClass: "synthetic_demo";
}

export interface M41bHumanDispositionInput {
  disposition: M41bHumanDecision["disposition"];
  rationale: string;
  decidedBy: string;
  decidedByRole: UserRole;
  decidedAt: string;
  overrideReason?: string | null;
  modifiedSummary?: string;
}

export interface M41bApprovedTaskInput {
  dueAt: string;
  createdAt: string;
  createdBy: string;
  createdByRole: UserRole;
  ownerId?: string;
  ownerRole?: UserRole;
  title?: string;
  objective?: string;
  cadence?: M41bCadence;
  priority?: M41bWorkplanItem["priority"];
  workflowKey?: string;
  dependencyIds?: readonly string[];
  evidenceRequirements?: readonly string[];
}

export interface M41bTaskEscalationInput {
  reason: string;
  escalatedBy: string;
  escalatedByRole: UserRole;
  escalatedAt: string;
}

export interface M41bCompletionEvidenceInput {
  evidenceRef: string;
  summary: string;
  recordedBy: string;
  recordedByRole: UserRole;
  recordedAt: string;
}

export interface M41bTaskCompletionInput {
  closedBy: string;
  closedByRole: UserRole;
  closedAt: string;
  closureRationale: string;
}

export interface M41bLineageVerification {
  valid: boolean;
  errors: readonly string[];
  lineageId: string;
  correlationId: string;
  sourceCount: number;
  auditEventCount: number;
  hasRecommendation: boolean;
  hasHumanDisposition: boolean;
  hasOverride: boolean;
  hasTask: boolean;
  evidenceCount: number;
  taskCompleted: boolean;
}

export type M41bLineageStage =
  | "prompt"
  | "context"
  | "source"
  | "recommendation"
  | "human_disposition"
  | "override"
  | "task"
  | "evidence"
  | "audit";

export interface M41bLineageTraceEntry {
  stage: M41bLineageStage;
  entityId: string;
  status: string;
  occurredAt: string | null;
  sourceIds: readonly string[];
}

function unique<T>(items: readonly T[]): readonly T[] {
  return Object.freeze([...new Set(items)]);
}

function assertTime(value: string, code: string): void {
  if (!Number.isFinite(Date.parse(value))) throw new Error(code);
}

function assertNotBefore(value: string, floor: string, code: string): void {
  assertTime(value, code);
  assertTime(floor, code);
  if (Date.parse(value) < Date.parse(floor)) throw new Error(code);
}

function assertHumanActor(actorId: string, role: UserRole, code: string): void {
  const normalized = actorId.trim();
  if (!normalized || NON_HUMAN_ACTOR_PATTERN.test(normalized))
    throw new Error(code);
  buildM41bRoleContext(role, normalized);
}

function freezeLineage(lineage: M41bGuidanceLineage): M41bGuidanceLineage {
  return Object.freeze({
    ...lineage,
    sourceIds: Object.freeze([...lineage.sourceIds]),
    completionEvidence: Object.freeze([...lineage.completionEvidence]),
    auditEvents: Object.freeze([...lineage.auditEvents]),
  });
}

function auditEvent(
  lineage: Pick<M41bGuidanceLineage, "correlationId" | "auditEvents">,
  input: Omit<M41bAuditEvent, "id" | "correlationId" | "evidenceClass">,
): M41bAuditEvent {
  const sequence = lineage.auditEvents.length + 1;
  return Object.freeze({
    ...input,
    id: m41bDeterministicId(
      "M41B-AUDIT",
      lineage.correlationId,
      String(sequence),
      input.eventType,
      input.entityId,
    ),
    correlationId: lineage.correlationId,
    sourceIds: Object.freeze([...input.sourceIds]),
    before: input.before ? Object.freeze({ ...input.before }) : null,
    after: input.after ? Object.freeze({ ...input.after }) : null,
    evidenceClass: "synthetic_demo",
  });
}

function promptSnapshot(
  request: M41bGuidanceRequest,
): M41bPromptContextSnapshot {
  return Object.freeze({
    requestId: request.requestId,
    prompt: request.prompt,
    intent: request.intent,
    actorId: request.roleContext.userId,
    actorRole: request.roleContext.role,
    tier: request.roleContext.tier,
    division: request.roleContext.division,
    department: request.roleContext.department,
    caseloadIds: Object.freeze([...request.roleContext.caseloadIds]),
    delegatedActions: Object.freeze([...request.roleContext.delegatedActions]),
    workplanItemId: request.workplanItemId ?? null,
    requestedDivision: request.requestedDivision ?? null,
    requestedDomain: request.requestedDomain ?? null,
    createdAt: request.createdAt,
  });
}

/** Starts the immutable prompt/context/source/recommendation audit chain. */
export function startM41bGuidanceLineage(
  request: M41bGuidanceRequest,
  response: M41bGuidanceResponse,
): M41bGuidanceLineage {
  if (response.requestId !== request.requestId)
    throw new Error("M41B_LINEAGE_REQUEST_RESPONSE_MISMATCH");
  if (response.citations.length === 0)
    throw new Error("M41B_LINEAGE_MATERIAL_CITATION_REQUIRED");
  if (response.evidenceClass !== "synthetic_demo")
    throw new Error("M41B_LINEAGE_DATA_BOUNDARY_VIOLATION");

  const sourceIds = unique(
    response.citations.map((citation) => citation.sourceId),
  );
  const correlationId = m41bDeterministicId(
    "M41B-CORRELATION",
    request.requestId,
  );
  const lineageId = m41bDeterministicId("M41B-LINEAGE", request.requestId);
  const recommendation = response.recommendationId
    ? Object.freeze({
        id: response.recommendationId,
        requestId: request.requestId,
        summary: response.answer,
        sourceIds,
        materialDomain: response.humanGate.materialDomain,
        createdByRole: request.roleContext.role,
        createdAt: request.createdAt,
        status: "proposed" as const,
        humanDecisionId: null,
        downstreamTaskId: null,
        evidenceClass: "synthetic_demo" as const,
      })
    : null;
  if (!response.refused && (!response.humanGate.required || !recommendation))
    throw new Error("M41B_LINEAGE_HUMAN_GATE_REQUIRED");
  if (response.refused && recommendation)
    throw new Error("M41B_LINEAGE_REFUSAL_RECOMMENDATION_FORBIDDEN");

  let lineage = freezeLineage({
    lineageId,
    correlationId,
    promptContext: promptSnapshot(request),
    request: Object.freeze({ ...request }),
    response,
    sourceIds,
    recommendation,
    decision: null,
    override: null,
    task: null,
    completionEvidence: Object.freeze([]),
    auditEvents: Object.freeze([]),
    evidenceClass: "synthetic_demo",
  });

  const prompt = auditEvent(lineage, {
    eventType: "prompt_received",
    actorId: request.roleContext.userId,
    actorRole: request.roleContext.role,
    entityType: "guidance",
    entityId: response.responseId,
    sourceIds: Object.freeze([]),
    before: null,
    after: {
      requestId: request.requestId,
      intent: request.intent,
      division: request.roleContext.division,
      requestedDivision: request.requestedDivision ?? null,
      requestedDomain: request.requestedDomain ?? null,
      workplanItemId: request.workplanItemId ?? null,
    },
    occurredAt: request.createdAt,
  });
  lineage = freezeLineage({ ...lineage, auditEvents: [prompt] });

  for (const citation of response.citations) {
    const retrieved = auditEvent(lineage, {
      eventType: "source_retrieved",
      actorId: request.roleContext.userId,
      actorRole: request.roleContext.role,
      entityType: "guidance",
      entityId: response.responseId,
      sourceIds: Object.freeze([citation.sourceId]),
      before: null,
      after: {
        sourceId: citation.sourceId,
        version: citation.version,
        ownerRole: citation.ownerRole,
        effectiveAt: citation.effectiveAt,
        refreshedAt: citation.refreshedAt,
        freshnessState: citation.state,
        confidence: citation.confidence,
        uncertainty: citation.uncertainty,
        applicableLimits: citation.applicableLimits,
        missingEvidence: citation.missingEvidence,
        recordIds: citation.recordIds,
      },
      occurredAt: request.createdAt,
    });
    lineage = freezeLineage({
      ...lineage,
      auditEvents: [...lineage.auditEvents, retrieved],
    });
  }

  const issued = auditEvent(lineage, {
    eventType: response.refused ? "guidance_refused" : "guidance_issued",
    actorId: request.roleContext.userId,
    actorRole: request.roleContext.role,
    entityType: recommendation ? "recommendation" : "guidance",
    entityId: recommendation?.id ?? response.responseId,
    sourceIds,
    before: null,
    after: {
      responseId: response.responseId,
      recommendationId: recommendation?.id ?? null,
      refused: response.refused,
      refusalCode: response.refusalCode,
      humanGateRequired: response.humanGate.required,
      humanGateDisposition: response.humanGate.disposition,
      workflowBlockedPendingApproval:
        response.workflowLaunch?.blockedPendingApproval ?? null,
    },
    occurredAt: request.createdAt,
  });
  return freezeLineage({
    ...lineage,
    auditEvents: [...lineage.auditEvents, issued],
  });
}

/** Alias used by integration callers that treat lineage construction as a builder. */
export const buildM41bGuidanceLineage = startM41bGuidanceLineage;

function dispositionStatus(
  disposition: M41bHumanDecision["disposition"],
): M41bRecommendation["status"] {
  if (disposition === "reject") return "rejected";
  if (disposition === "modify") return "modified";
  return "approved";
}

function gateDisposition(
  disposition: M41bHumanDecision["disposition"],
): M41bGuidanceResponse["humanGate"]["disposition"] {
  if (disposition === "reject") return "rejected";
  if (disposition === "modify") return "modified";
  return "approved";
}

/** Records one accountable human disposition; retries cannot replace history. */
export function recordM41bHumanDisposition(
  lineage: M41bGuidanceLineage,
  input: M41bHumanDispositionInput,
): M41bGuidanceLineage {
  const recommendation = lineage.recommendation;
  if (!recommendation)
    throw new Error("M41B_DISPOSITION_RECOMMENDATION_REQUIRED");
  if (lineage.decision) throw new Error("M41B_DISPOSITION_ALREADY_RECORDED");
  assertHumanActor(
    input.decidedBy,
    input.decidedByRole,
    "M41B_MODEL_ONLY_DISPOSITION_DENIED",
  );
  const approverContext = buildM41bRoleContext(
    input.decidedByRole,
    input.decidedBy,
  );
  const targetDivision =
    lineage.request.requestedDivision ?? lineage.request.roleContext.division;
  if (!canApproveM41b(input.decidedByRole, recommendation.materialDomain))
    throw new Error(
      `M41B_ACCOUNTABLE_HUMAN_REQUIRED:${recommendation.materialDomain}:${input.decidedByRole}`,
    );
  if (
    approverContext.tier !== "T1" &&
    approverContext.division !== targetDivision
  )
    throw new Error(
      `M41B_CROSS_DIVISION_DISPOSITION_DENIED:${approverContext.division}:${targetDivision}`,
    );
  if (!input.rationale.trim())
    throw new Error("M41B_DISPOSITION_RATIONALE_REQUIRED");
  assertNotBefore(
    input.decidedAt,
    recommendation.createdAt,
    "M41B_DISPOSITION_TIME_INVALID",
  );
  if (input.disposition === "override" && !input.overrideReason?.trim())
    throw new Error("M41B_OVERRIDE_REASON_REQUIRED");
  if (input.disposition !== "override" && input.overrideReason?.trim())
    throw new Error("M41B_OVERRIDE_REASON_WITHOUT_OVERRIDE");
  if (input.disposition === "modify" && !input.modifiedSummary?.trim())
    throw new Error("M41B_MODIFIED_SUMMARY_REQUIRED");

  const decision: M41bHumanDecision = Object.freeze({
    id: m41bDeterministicId(
      "M41B-DECISION",
      recommendation.id,
      input.disposition,
      input.decidedBy,
    ),
    recommendationId: recommendation.id,
    disposition: input.disposition,
    rationale: input.rationale.trim(),
    decidedBy: input.decidedBy,
    decidedByRole: input.decidedByRole,
    decidedAt: input.decidedAt,
    overrideReason:
      input.disposition === "override"
        ? (input.overrideReason?.trim() ?? null)
        : null,
    evidenceClass: "synthetic_demo",
  });
  const updatedRecommendation: M41bRecommendation = Object.freeze({
    ...recommendation,
    summary:
      input.disposition === "modify"
        ? (input.modifiedSummary?.trim() ?? recommendation.summary)
        : recommendation.summary,
    status: dispositionStatus(input.disposition),
    humanDecisionId: decision.id,
  });
  const updatedResponse: M41bGuidanceResponse = Object.freeze({
    ...lineage.response,
    humanGate: Object.freeze({
      ...lineage.response.humanGate,
      disposition: gateDisposition(input.disposition),
      decisionId: decision.id,
    }),
  });
  const override: M41bOverrideTrace | null =
    input.disposition === "override"
      ? Object.freeze({
          decisionId: decision.id,
          reason: decision.overrideReason ?? "",
          actorId: decision.decidedBy,
          actorRole: decision.decidedByRole,
          occurredAt: decision.decidedAt,
        })
      : null;
  const event = auditEvent(lineage, {
    eventType: "human_disposition_recorded",
    actorId: decision.decidedBy,
    actorRole: decision.decidedByRole,
    entityType: "decision",
    entityId: decision.id,
    sourceIds: updatedRecommendation.sourceIds,
    before: {
      recommendationStatus: recommendation.status,
      humanDecisionId: recommendation.humanDecisionId,
    },
    after: {
      recommendationId: recommendation.id,
      recommendationStatus: updatedRecommendation.status,
      disposition: decision.disposition,
      rationale: decision.rationale,
      overrideReason: decision.overrideReason,
    },
    occurredAt: decision.decidedAt,
  });
  return freezeLineage({
    ...lineage,
    response: updatedResponse,
    recommendation: updatedRecommendation,
    decision,
    override,
    auditEvents: [...lineage.auditEvents, event],
  });
}

export function recordM41bHumanOverride(
  lineage: M41bGuidanceLineage,
  input: Omit<M41bHumanDispositionInput, "disposition"> & {
    overrideReason: string;
  },
): M41bGuidanceLineage {
  return recordM41bHumanDisposition(lineage, {
    ...input,
    disposition: "override",
  });
}

function creatorMayCreateTask(
  lineage: M41bGuidanceLineage,
  creatorRole: UserRole,
): boolean {
  const domain = lineage.recommendation?.materialDomain;
  if (!domain) return false;
  if (canApproveM41b(creatorRole, domain)) return true;
  if (creatorRole !== lineage.request.roleContext.role) return false;
  return buildM41bRoleContext(
    creatorRole,
    lineage.request.roleContext.userId,
  ).delegatedActions.includes("create_owned_task");
}

/** Materializes an approved recommendation; it cannot create a pre-approval task. */
export function createM41bApprovedTask(
  lineage: M41bGuidanceLineage,
  input: M41bApprovedTaskInput,
): M41bGuidanceLineage {
  const recommendation = lineage.recommendation;
  const decision = lineage.decision;
  if (!recommendation || !decision)
    throw new Error("M41B_TASK_HUMAN_DISPOSITION_REQUIRED");
  if (lineage.task || recommendation.downstreamTaskId)
    throw new Error("M41B_TASK_ALREADY_CREATED");
  if (decision.disposition === "reject")
    throw new Error("M41B_REJECTED_RECOMMENDATION_TASK_DENIED");
  assertHumanActor(
    input.createdBy,
    input.createdByRole,
    "M41B_MODEL_ONLY_TASK_DENIED",
  );
  if (!creatorMayCreateTask(lineage, input.createdByRole))
    throw new Error(`M41B_TASK_CREATOR_NOT_AUTHORIZED:${input.createdByRole}`);
  assertNotBefore(
    input.createdAt,
    decision.decidedAt,
    "M41B_TASK_TIME_INVALID",
  );
  assertNotBefore(input.dueAt, input.createdAt, "M41B_TASK_DUE_TIME_INVALID");

  const ownerRole = input.ownerRole ?? lineage.request.roleContext.role;
  const ownerContext = buildM41bRoleContext(ownerRole, input.ownerId);
  if (!ownerContext.userId.trim()) throw new Error("M41B_TASK_OWNER_REQUIRED");
  const creatorContext = buildM41bRoleContext(
    input.createdByRole,
    input.createdBy,
  );
  const ownerCrossesDivision =
    ownerContext.division !== lineage.request.roleContext.division;
  if (
    ownerCrossesDivision &&
    !(
      creatorContext.tier === "T1" &&
      creatorContext.delegatedActions.includes("route_cross_division") &&
      lineage.request.requestedDivision === ownerContext.division
    )
  )
    throw new Error("M41B_TASK_CROSS_DIVISION_DENIED");

  const evidenceRequirements = unique(
    (
      input.evidenceRequirements ?? [
        "Document completion evidence",
        "Accountable human closure verification",
      ]
    )
      .map((requirement) => requirement.trim())
      .filter(Boolean),
  );
  if (evidenceRequirements.length === 0)
    throw new Error("M41B_TASK_EVIDENCE_REQUIREMENT_REQUIRED");

  const taskId = m41bDeterministicId("M41B-TASK", recommendation.id);
  const task: M41bWorkplanItem = Object.freeze({
    id: taskId,
    naturalKey: `recommendation:${recommendation.id}`,
    cadence: input.cadence ?? "daily",
    title:
      input.title?.trim() || `Approved ${recommendation.materialDomain} action`,
    objective: input.objective?.trim() || recommendation.summary,
    priority: input.priority ?? "high",
    ownerId: ownerContext.userId,
    ownerRole,
    division: ownerContext.division,
    materialDomain: recommendation.materialDomain,
    workflowKey:
      input.workflowKey?.trim() ||
      lineage.response.workflowLaunch?.workflowKey ||
      `m41b-${recommendation.materialDomain}-${ownerContext.division}-approved-action`,
    dueAt: input.dueAt,
    dependencyIds: unique(input.dependencyIds ?? []),
    sourceIds: Object.freeze([...recommendation.sourceIds]),
    recommendationId: recommendation.id,
    status: "approved",
    humanApprovalRequired: true,
    approvalId: decision.id,
    evidenceRequirements,
    completionEvidenceIds: Object.freeze([]),
    closedAt: null,
    evidenceClass: "synthetic_demo",
  });
  const updatedRecommendation: M41bRecommendation = Object.freeze({
    ...recommendation,
    downstreamTaskId: task.id,
  });
  const event = auditEvent(lineage, {
    eventType: "task_created",
    actorId: input.createdBy,
    actorRole: input.createdByRole,
    entityType: "workplan_item",
    entityId: task.id,
    sourceIds: task.sourceIds,
    before: null,
    after: {
      recommendationId: recommendation.id,
      humanDecisionId: decision.id,
      ownerId: task.ownerId,
      ownerRole: task.ownerRole,
      division: task.division,
      dueAt: task.dueAt,
      status: task.status,
      evidenceRequirements: task.evidenceRequirements,
    },
    occurredAt: input.createdAt,
  });
  return freezeLineage({
    ...lineage,
    recommendation: updatedRecommendation,
    task,
    auditEvents: [...lineage.auditEvents, event],
  });
}

function actorMayManageTask(
  lineage: M41bGuidanceLineage,
  actorRole: UserRole,
): boolean {
  if (!lineage.task || !lineage.recommendation) return false;
  const actorContext = buildM41bRoleContext(actorRole);
  return (
    actorRole === lineage.task.ownerRole ||
    lineage.request.roleContext.supervisorRoles.includes(actorRole) ||
    (canApproveM41b(actorRole, lineage.recommendation.materialDomain) &&
      (actorContext.tier === "T1" ||
        actorContext.division === lineage.task.division))
  );
}

export function escalateM41bLineageTask(
  lineage: M41bGuidanceLineage,
  input: M41bTaskEscalationInput,
): M41bGuidanceLineage {
  const task = lineage.task;
  if (!task) throw new Error("M41B_ESCALATION_TASK_REQUIRED");
  if (task.status === "completed" || task.status === "refused")
    throw new Error("M41B_ESCALATION_CLOSED_TASK_DENIED");
  assertHumanActor(
    input.escalatedBy,
    input.escalatedByRole,
    "M41B_MODEL_ONLY_ESCALATION_DENIED",
  );
  if (!actorMayManageTask(lineage, input.escalatedByRole))
    throw new Error(
      `M41B_TASK_ESCALATION_NOT_AUTHORIZED:${input.escalatedByRole}`,
    );
  if (!input.reason.trim()) throw new Error("M41B_ESCALATION_REASON_REQUIRED");
  assertNotBefore(
    input.escalatedAt,
    lineage.decision?.decidedAt ?? lineage.request.createdAt,
    "M41B_ESCALATION_TIME_INVALID",
  );

  const escalatedTask: M41bWorkplanItem = Object.freeze({
    ...task,
    status: "escalated",
  });
  const event = auditEvent(lineage, {
    eventType: "task_escalated",
    actorId: input.escalatedBy,
    actorRole: input.escalatedByRole,
    entityType: "workplan_item",
    entityId: task.id,
    sourceIds: task.sourceIds,
    before: { status: task.status },
    after: { status: escalatedTask.status, reason: input.reason.trim() },
    occurredAt: input.escalatedAt,
  });
  return freezeLineage({
    ...lineage,
    task: escalatedTask,
    auditEvents: [...lineage.auditEvents, event],
  });
}

export function addM41bCompletionEvidence(
  lineage: M41bGuidanceLineage,
  input: M41bCompletionEvidenceInput,
): M41bGuidanceLineage {
  const task = lineage.task;
  if (!task) throw new Error("M41B_COMPLETION_EVIDENCE_TASK_REQUIRED");
  if (task.status === "completed")
    throw new Error("M41B_COMPLETION_EVIDENCE_CLOSED_TASK_DENIED");
  assertHumanActor(
    input.recordedBy,
    input.recordedByRole,
    "M41B_MODEL_ONLY_EVIDENCE_DENIED",
  );
  if (!actorMayManageTask(lineage, input.recordedByRole))
    throw new Error(
      `M41B_EVIDENCE_ACTOR_NOT_AUTHORIZED:${input.recordedByRole}`,
    );
  if (!input.evidenceRef.trim() || !input.summary.trim())
    throw new Error("M41B_COMPLETION_EVIDENCE_DETAIL_REQUIRED");
  assertNotBefore(
    input.recordedAt,
    lineage.decision?.decidedAt ?? lineage.request.createdAt,
    "M41B_COMPLETION_EVIDENCE_TIME_INVALID",
  );

  const evidence: M41bCompletionEvidence = Object.freeze({
    id: m41bDeterministicId(
      "M41B-EVIDENCE",
      task.id,
      input.evidenceRef,
      String(lineage.completionEvidence.length + 1),
    ),
    taskId: task.id,
    evidenceRef: input.evidenceRef.trim(),
    summary: input.summary.trim(),
    recordedBy: input.recordedBy,
    recordedAt: input.recordedAt,
    evidenceClass: "synthetic_demo",
  });
  if (lineage.completionEvidence.some((item) => item.id === evidence.id))
    throw new Error("M41B_COMPLETION_EVIDENCE_DUPLICATE");
  const updatedTask: M41bWorkplanItem = Object.freeze({
    ...task,
    status: "evidence_pending",
    completionEvidenceIds: Object.freeze([
      ...task.completionEvidenceIds,
      evidence.id,
    ]),
  });
  const event = auditEvent(lineage, {
    eventType: "completion_evidence_added",
    actorId: input.recordedBy,
    actorRole: input.recordedByRole,
    entityType: "evidence",
    entityId: evidence.id,
    sourceIds: task.sourceIds,
    before: {
      taskStatus: task.status,
      completionEvidenceIds: task.completionEvidenceIds,
    },
    after: {
      taskId: task.id,
      taskStatus: updatedTask.status,
      evidenceRef: evidence.evidenceRef,
      completionEvidenceIds: updatedTask.completionEvidenceIds,
    },
    occurredAt: input.recordedAt,
  });
  return freezeLineage({
    ...lineage,
    task: updatedTask,
    completionEvidence: [...lineage.completionEvidence, evidence],
    auditEvents: [...lineage.auditEvents, event],
  });
}

/** Prevents silent closure by requiring evidence and an accountable human. */
export function completeM41bLineageTask(
  lineage: M41bGuidanceLineage,
  input: M41bTaskCompletionInput,
): M41bGuidanceLineage {
  const task = lineage.task;
  const recommendation = lineage.recommendation;
  if (!task || !recommendation)
    throw new Error("M41B_TASK_COMPLETION_CHAIN_REQUIRED");
  if (task.status === "completed")
    throw new Error("M41B_TASK_ALREADY_COMPLETED");
  if (lineage.completionEvidence.length === 0)
    throw new Error("M41B_TASK_COMPLETION_EVIDENCE_REQUIRED");
  assertHumanActor(
    input.closedBy,
    input.closedByRole,
    "M41B_MODEL_ONLY_TASK_CLOSURE_DENIED",
  );
  const closerContext = buildM41bRoleContext(
    input.closedByRole,
    input.closedBy,
  );
  if (!canApproveM41b(input.closedByRole, recommendation.materialDomain))
    throw new Error(
      `M41B_ACCOUNTABLE_CLOSURE_REQUIRED:${recommendation.materialDomain}:${input.closedByRole}`,
    );
  if (closerContext.tier !== "T1" && closerContext.division !== task.division)
    throw new Error(
      `M41B_CROSS_DIVISION_CLOSURE_DENIED:${closerContext.division}:${task.division}`,
    );
  if (!input.closureRationale.trim())
    throw new Error("M41B_TASK_CLOSURE_RATIONALE_REQUIRED");
  const evidenceTimes = lineage.completionEvidence
    .map((evidence) => evidence.recordedAt)
    .sort();
  const latestEvidenceAt = evidenceTimes[evidenceTimes.length - 1];
  assertNotBefore(
    input.closedAt,
    latestEvidenceAt ??
      lineage.decision?.decidedAt ??
      lineage.request.createdAt,
    "M41B_TASK_CLOSURE_TIME_INVALID",
  );

  const completedTask: M41bWorkplanItem = Object.freeze({
    ...task,
    status: "completed",
    closedAt: input.closedAt,
  });
  const event = auditEvent(lineage, {
    eventType: "task_completed",
    actorId: input.closedBy,
    actorRole: input.closedByRole,
    entityType: "workplan_item",
    entityId: task.id,
    sourceIds: task.sourceIds,
    before: { status: task.status, closedAt: task.closedAt },
    after: {
      status: completedTask.status,
      closedAt: completedTask.closedAt,
      closureRationale: input.closureRationale.trim(),
      completionEvidenceIds: completedTask.completionEvidenceIds,
    },
    occurredAt: input.closedAt,
  });
  return freezeLineage({
    ...lineage,
    task: completedTask,
    auditEvents: [...lineage.auditEvents, event],
  });
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value) => right.includes(value)) &&
    right.every((value) => left.includes(value))
  );
}

/** Verifies relationship integrity without mutating or repairing history. */
export function verifyM41bGuidanceLineage(
  lineage: M41bGuidanceLineage,
): M41bLineageVerification {
  const errors: string[] = [];
  const citationIds = unique(
    lineage.response.citations.map((citation) => citation.sourceId),
  );
  if (lineage.request.requestId !== lineage.response.requestId)
    errors.push("request_response_mismatch");
  if (lineage.promptContext.requestId !== lineage.request.requestId)
    errors.push("prompt_context_mismatch");
  if (!sameSet(lineage.sourceIds, citationIds))
    errors.push("citation_source_drift");
  if (lineage.response.citations.length === 0) errors.push("citation_missing");
  if (!lineage.response.refused && !lineage.response.humanGate.required)
    errors.push("human_gate_missing");
  if (!lineage.response.refused && !lineage.recommendation)
    errors.push("recommendation_missing");
  if (lineage.response.refused && lineage.recommendation)
    errors.push("refusal_has_recommendation");
  if (
    lineage.recommendation &&
    (!sameSet(lineage.recommendation.sourceIds, lineage.sourceIds) ||
      lineage.recommendation.requestId !== lineage.request.requestId)
  )
    errors.push("recommendation_link_broken");
  if (
    lineage.decision &&
    (!lineage.recommendation ||
      lineage.decision.recommendationId !== lineage.recommendation.id ||
      lineage.recommendation.humanDecisionId !== lineage.decision.id ||
      lineage.response.humanGate.decisionId !== lineage.decision.id)
  )
    errors.push("human_disposition_link_broken");
  if (lineage.decision?.disposition === "override" && !lineage.override?.reason)
    errors.push("override_reason_missing");
  if (lineage.override && lineage.override.decisionId !== lineage.decision?.id)
    errors.push("override_link_broken");
  if (
    lineage.task &&
    (!lineage.recommendation ||
      !lineage.decision ||
      lineage.task.recommendationId !== lineage.recommendation.id ||
      lineage.task.approvalId !== lineage.decision.id ||
      lineage.recommendation.downstreamTaskId !== lineage.task.id ||
      !sameSet(lineage.task.sourceIds, lineage.sourceIds))
  )
    errors.push("task_link_broken");
  if (
    lineage.completionEvidence.some(
      (evidence) =>
        !lineage.task ||
        evidence.taskId !== lineage.task.id ||
        !lineage.task.completionEvidenceIds.includes(evidence.id),
    )
  )
    errors.push("completion_evidence_link_broken");
  if (
    lineage.task?.status === "completed" &&
    (lineage.completionEvidence.length === 0 ||
      !lineage.auditEvents.some(
        (event) =>
          event.eventType === "task_completed" &&
          event.entityId === lineage.task?.id,
      ))
  )
    errors.push("silent_task_closure");
  if (
    !lineage.auditEvents.some(
      (event) =>
        event.eventType === "prompt_received" &&
        event.entityId === lineage.response.responseId,
    )
  )
    errors.push("prompt_audit_missing");
  for (const sourceId of lineage.sourceIds)
    if (
      !lineage.auditEvents.some(
        (event) =>
          event.eventType === "source_retrieved" &&
          event.sourceIds.includes(sourceId),
      )
    )
      errors.push(`source_audit_missing:${sourceId}`);
  const eventIds = lineage.auditEvents.map((event) => event.id);
  if (new Set(eventIds).size !== eventIds.length)
    errors.push("duplicate_audit_event_id");
  if (
    lineage.auditEvents.some(
      (event) =>
        event.correlationId !== lineage.correlationId ||
        event.evidenceClass !== "synthetic_demo",
    )
  )
    errors.push("audit_boundary_or_correlation_broken");
  if (lineage.evidenceClass !== "synthetic_demo")
    errors.push("lineage_data_boundary_broken");

  return Object.freeze({
    valid: errors.length === 0,
    errors: Object.freeze(errors),
    lineageId: lineage.lineageId,
    correlationId: lineage.correlationId,
    sourceCount: lineage.sourceIds.length,
    auditEventCount: lineage.auditEvents.length,
    hasRecommendation: lineage.recommendation !== null,
    hasHumanDisposition: lineage.decision !== null,
    hasOverride: lineage.override !== null,
    hasTask: lineage.task !== null,
    evidenceCount: lineage.completionEvidence.length,
    taskCompleted: lineage.task?.status === "completed",
  });
}

export function assertM41bGuidanceLineage(lineage: M41bGuidanceLineage): void {
  const verification = verifyM41bGuidanceLineage(lineage);
  if (!verification.valid)
    throw new Error(`M41B_LINEAGE_INVALID:${verification.errors.join(",")}`);
}

/** Returns an ordered, display-safe view of every governed lineage stage. */
export function buildM41bLineageTrace(
  lineage: M41bGuidanceLineage,
): readonly M41bLineageTraceEntry[] {
  const entries: M41bLineageTraceEntry[] = [
    {
      stage: "prompt",
      entityId: lineage.request.requestId,
      status: lineage.request.intent,
      occurredAt: lineage.request.createdAt,
      sourceIds: Object.freeze([]),
    },
    {
      stage: "context",
      entityId: lineage.promptContext.actorId,
      status: `${lineage.promptContext.actorRole}:${lineage.promptContext.division}:${lineage.promptContext.tier}`,
      occurredAt: lineage.promptContext.createdAt,
      sourceIds: Object.freeze([]),
    },
    ...lineage.response.citations.map((citation) => ({
      stage: "source" as const,
      entityId: citation.sourceId,
      status: `${citation.state}:v${citation.version}`,
      occurredAt: citation.refreshedAt,
      sourceIds: Object.freeze([citation.sourceId]),
    })),
  ];
  if (lineage.recommendation)
    entries.push({
      stage: "recommendation",
      entityId: lineage.recommendation.id,
      status: lineage.recommendation.status,
      occurredAt: lineage.recommendation.createdAt,
      sourceIds: lineage.recommendation.sourceIds,
    });
  if (lineage.decision)
    entries.push({
      stage: "human_disposition",
      entityId: lineage.decision.id,
      status: lineage.decision.disposition,
      occurredAt: lineage.decision.decidedAt,
      sourceIds: lineage.sourceIds,
    });
  if (lineage.override)
    entries.push({
      stage: "override",
      entityId: lineage.override.decisionId,
      status: lineage.override.reason,
      occurredAt: lineage.override.occurredAt,
      sourceIds: lineage.sourceIds,
    });
  if (lineage.task)
    entries.push({
      stage: "task",
      entityId: lineage.task.id,
      status: lineage.task.status,
      occurredAt: lineage.task.closedAt,
      sourceIds: lineage.task.sourceIds,
    });
  for (const evidence of lineage.completionEvidence)
    entries.push({
      stage: "evidence",
      entityId: evidence.id,
      status: evidence.summary,
      occurredAt: evidence.recordedAt,
      sourceIds: lineage.task?.sourceIds ?? lineage.sourceIds,
    });
  for (const event of lineage.auditEvents)
    entries.push({
      stage: "audit",
      entityId: event.id,
      status: event.eventType,
      occurredAt: event.occurredAt,
      sourceIds: event.sourceIds,
    });
  return Object.freeze(entries.map((entry) => Object.freeze(entry)));
}
