import type { RoleTier } from "../../src/constants/access-control";
import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";

export const M41B_CADENCES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
] as const;
export type M41bCadence = (typeof M41B_CADENCES)[number];

export const M41B_MATERIAL_DOMAINS = [
  "clinical",
  "supervisory",
  "financial",
  "regulatory",
  "personnel",
  "legal",
  "operational",
] as const;
export type M41bMaterialDomain = (typeof M41B_MATERIAL_DOMAINS)[number];

export const M41B_SOURCE_STATES = [
  "current",
  "stale",
  "missing",
  "contradictory",
  "suppressed",
] as const;
export type M41bSourceState = (typeof M41B_SOURCE_STATES)[number];

export type M41bSourceSensitivity =
  | "internal"
  | "clinical"
  | "sud"
  | "personnel"
  | "finance"
  | "legal";

export interface M41bRoleContext {
  userId: string;
  role: UserRole;
  tier: RoleTier;
  division: DivisionId;
  department: string;
  caseloadIds: readonly string[];
  delegatedActions: readonly string[];
  supervisorRoles: readonly UserRole[];
  evidenceClass: "synthetic_demo";
}

export interface M41bGovernedSource {
  id: string;
  title: string;
  sourceSystem: string;
  sourceType:
    | "policy"
    | "workflow"
    | "dashboard_alert"
    | "meeting_action"
    | "audit_finding"
    | "exception"
    | "commitment"
    | "performance_record";
  version: string;
  ownerRole: UserRole;
  effectiveAt: string;
  reviewedAt: string;
  refreshedAt: string | null;
  expiresAt: string | null;
  applicableLimits: readonly string[];
  missingEvidence: readonly string[];
  state: M41bSourceState;
  confidence: number | null;
  uncertainty: string | null;
  sensitivity: M41bSourceSensitivity;
  divisions: readonly DivisionId[];
  minimumTier: RoleTier;
  cadences: readonly M41bCadence[];
  materialDomain: M41bMaterialDomain;
  recordIds: readonly string[];
  evidenceClass: "synthetic_demo";
}

export interface M41bSourceCitation {
  sourceId: string;
  title: string;
  version: string;
  ownerRole: UserRole;
  effectiveAt: string;
  refreshedAt: string | null;
  state: M41bSourceState;
  applicableLimits: readonly string[];
  missingEvidence: readonly string[];
  confidence: number | null;
  uncertainty: string | null;
  recordIds: readonly string[];
}

export type M41bWorkplanStatus =
  | "proposed"
  | "pending_approval"
  | "approved"
  | "in_progress"
  | "evidence_pending"
  | "completed"
  | "escalated"
  | "refused";

export interface M41bWorkplanItem {
  id: string;
  naturalKey: string;
  cadence: M41bCadence;
  title: string;
  objective: string;
  priority: "critical" | "high" | "medium" | "low";
  ownerId: string;
  ownerRole: UserRole;
  division: DivisionId;
  materialDomain: M41bMaterialDomain;
  workflowKey: string;
  dueAt: string;
  dependencyIds: readonly string[];
  sourceIds: readonly string[];
  recommendationId: string | null;
  status: M41bWorkplanStatus;
  humanApprovalRequired: boolean;
  approvalId: string | null;
  evidenceRequirements: readonly string[];
  completionEvidenceIds: readonly string[];
  closedAt: string | null;
  evidenceClass: "synthetic_demo";
}

export interface M41bCadenceBrief {
  cadence: M41bCadence;
  title: string;
  purpose: string;
  generatedAt: string;
  items: readonly M41bWorkplanItem[];
  sourceStates: readonly M41bSourceState[];
  limitations: readonly string[];
}

export interface M41bWorkplan {
  milestone: "M4.1B";
  environmentId: "AMOS-OPS-M4.1B-EVALUATION";
  environmentLabel: string;
  generatedAt: string;
  roleContext: M41bRoleContext;
  briefs: Readonly<Record<M41bCadence, M41bCadenceBrief>>;
  productionActionsBlocked: true;
  evidenceClass: "synthetic_demo";
}

export const M41B_GUIDANCE_INTENTS = [
  "explain_priority",
  "answer_question",
  "explain_next_step",
  "launch_workflow",
  "create_task",
  "escalate",
  "route_supervisor",
] as const;
export type M41bGuidanceIntent = (typeof M41B_GUIDANCE_INTENTS)[number];

export interface M41bGuidanceRequest {
  requestId: string;
  prompt: string;
  intent: M41bGuidanceIntent;
  roleContext: M41bRoleContext;
  sourceIds?: readonly string[];
  workplanItemId?: string;
  requestedDivision?: DivisionId;
  requestedDomain?: M41bMaterialDomain;
  createdAt: string;
}

export interface M41bHumanGate {
  required: boolean;
  materialDomain: M41bMaterialDomain;
  accountableRoles: readonly UserRole[];
  disposition: "not_required" | "pending" | "approved" | "modified" | "rejected";
  decisionId: string | null;
}

export interface M41bGuidanceResponse {
  responseId: string;
  requestId: string;
  answer: string;
  nextSteps: readonly string[];
  citations: readonly M41bSourceCitation[];
  confidence: number | null;
  uncertainty: string | null;
  applicableLimits: readonly string[];
  missingEvidence: readonly string[];
  recommendationId: string | null;
  workflowLaunch: { workflowKey: string; blockedPendingApproval: boolean } | null;
  humanGate: M41bHumanGate;
  escalation: { required: boolean; routeTo: readonly UserRole[]; reason: string | null };
  refused: boolean;
  refusalCode: string | null;
  evidenceClass: "synthetic_demo";
}

export interface M41bRecommendation {
  id: string;
  requestId: string;
  summary: string;
  sourceIds: readonly string[];
  materialDomain: M41bMaterialDomain;
  createdByRole: UserRole;
  createdAt: string;
  status: "proposed" | "approved" | "modified" | "rejected";
  humanDecisionId: string | null;
  downstreamTaskId: string | null;
  evidenceClass: "synthetic_demo";
}

export interface M41bHumanDecision {
  id: string;
  recommendationId: string;
  disposition: "approve" | "modify" | "reject" | "override";
  rationale: string;
  decidedBy: string;
  decidedByRole: UserRole;
  decidedAt: string;
  overrideReason: string | null;
  evidenceClass: "synthetic_demo";
}

export interface M41bCompletionEvidence {
  id: string;
  taskId: string;
  evidenceRef: string;
  summary: string;
  recordedBy: string;
  recordedAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M41bAuditEvent {
  id: string;
  eventType:
    | "prompt_received"
    | "source_retrieved"
    | "guidance_issued"
    | "guidance_refused"
    | "human_disposition_recorded"
    | "task_created"
    | "task_escalated"
    | "completion_evidence_added"
    | "task_completed"
    | "evaluation_reset";
  actorId: string;
  actorRole: UserRole;
  entityType:
    | "guidance"
    | "recommendation"
    | "decision"
    | "workplan_item"
    | "evidence"
    | "evaluation";
  entityId: string;
  correlationId: string;
  sourceIds: readonly string[];
  before: Readonly<Record<string, unknown>> | null;
  after: Readonly<Record<string, unknown>> | null;
  occurredAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M41bScenarioResult {
  milestone: "M4.1B";
  scenarioId: string;
  startedAt: string;
  completedAt: string;
  workplans: readonly M41bWorkplan[];
  requests: readonly M41bGuidanceRequest[];
  guidance: readonly M41bGuidanceResponse[];
  recommendations: readonly M41bRecommendation[];
  decisions: readonly M41bHumanDecision[];
  completionEvidence: readonly M41bCompletionEvidence[];
  auditEvents: readonly M41bAuditEvent[];
  silentClosureControl: {
    attemptId: string;
    taskId: string;
    evidenceCount: 0;
    blocked: boolean;
    observedCode: string;
  };
  criteria: readonly { criterionId: string; passed: boolean; summary: string; evidenceIds: readonly string[] }[];
  exitGate: boolean;
  productionActionsBlocked: true;
  evidenceClass: "synthetic_demo";
}

export const M41B_EVALUATION_AS_OF = "2026-10-15T08:00:00.000Z";
export const M41B_ENVIRONMENT_LABEL =
  "SYNTHETIC PROTOTYPE — CONTROLLED TIME-SHIFT — NO REAL DATA";
