import type { CansAssessmentVersion, CansPlanLineage } from "./cans-routing";
import type { CcmgAuditEvent } from "./audit";
import type { CcmgEvidenceClass, CcmgReferralIntake, IntakeReadinessEvaluation } from "./intake";

export const CCMG_QUEUE_IDS = ["intake", "qa", "cans", "medication_management", "mhtcm", "mhrs"] as const;
export type CcmgQueueId = (typeof CCMG_QUEUE_IDS)[number];
export type WorkflowStatus = "pending" | "in_progress" | "blocked" | "awaiting_approval" | "completed" | "cancelled";
export type WorkflowPriority = "routine" | "urgent" | "critical";
export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";
export type HandoffStatus = "initiated" | "accepted" | "rejected" | "returned" | "completed";

export interface CcmgWorkItem {
  id: string;
  caseId: string;
  referralId: string;
  youthDisplayLabel: string;
  queueId: CcmgQueueId;
  title: string;
  status: WorkflowStatus;
  priority: WorkflowPriority;
  assignedDivision: "BHC" | "GRO";
  assignedDepartment: "CCMG" | "MHTCM" | "MHRS" | "GRO";
  assignedRole: string;
  assignedTo: string | null;
  dueAt: string;
  escalationLevel: "none" | "supervisor" | "director" | "executive";
  escalatedAt: string | null;
  escalationReason: string | null;
  approvalStatus: ApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  approvalRationale: string | null;
  exceptionCode: string | null;
  exceptionReason: string | null;
  exceptionStatus: "none" | "open" | "resolved" | "waived";
  sourceType: string;
  sourceId: string;
  evidenceClass: CcmgEvidenceClass;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CcmgHandoff {
  id: string;
  caseId: string;
  referralId: string;
  workItemId: string;
  fromDivision: "BHC" | "GRO";
  fromDepartment: "CCMG" | "MHTCM" | "MHRS" | "GRO";
  toDivision: "BHC" | "GRO";
  toDepartment: "CCMG" | "MHTCM" | "MHRS" | "GRO";
  status: HandoffStatus;
  reason: string;
  payload: Readonly<Record<string, unknown>>;
  initiatedBy: string;
  initiatedAt: string;
  dueAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  evidenceClass: CcmgEvidenceClass;
  version: number;
}

export interface OversightQueueItem {
  id: string;
  caseId: string;
  referralId: string;
  youthDisplayLabel: string;
  title: string;
  status: WorkflowStatus;
  priority: WorkflowPriority;
  assignedDepartment: CcmgWorkItem["assignedDepartment"];
  assignedRole: string;
  assignedTo: string | null;
  dueAt: string;
  overdue: boolean;
  approvalStatus: ApprovalStatus;
  exceptionCode: string | null;
  updatedAt: string;
}

export interface OversightQueueSummary {
  id: CcmgQueueId;
  label: string;
  visible: boolean;
  total: number;
  overdue: number;
  urgent: number;
  awaitingApproval: number;
  blocked: number;
  items: readonly OversightQueueItem[];
}

export interface OversightDashboardResponse {
  generatedAt: string;
  evidenceClass: CcmgEvidenceClass;
  actor: { id: string; role: string; visibleQueueIds: readonly CcmgQueueId[] };
  metrics: {
    totalReferrals: number;
    openReferrals: number;
    urgentReferrals: number;
    heldReferrals: number;
    overdueWorkItems: number;
    pendingApprovals: number;
    openExceptions: number;
    activeHandoffs: number;
    authorizationsPending: number;
    cansDue: number;
    highAcuityCases: number;
    backlogWorkItems: number;
    qaFindings: number;
    serviceCoordinationItems: number;
  };
  queues: readonly OversightQueueSummary[];
  audit: { accessEventId: string; loggedAt: string };
}

export interface ReferralDetailResponse {
  referral: Pick<CcmgReferralIntake,
    | "id"
    | "caseId"
    | "evidenceClass"
    | "youthId"
    | "youthDisplayLabel"
    | "referralSourceDivision"
    | "referredAt"
    | "referralReason"
    | "urgency"
    | "status"
    | "holdReason"
    | "rejectionReason"
    | "createdAt"
    | "updatedAt"
    | "version"
  >;
  gates: {
    intake: CcmgReferralIntake["intake"];
    eligibility: CcmgReferralIntake["eligibility"];
    payerAuthorization: CcmgReferralIntake["payerAuthorization"];
    consent: CcmgReferralIntake["consent"];
    cans: CcmgReferralIntake["cans"];
    capacity: CcmgReferralIntake["capacity"];
    readiness: IntakeReadinessEvaluation;
  };
  workflow: {
    assignments: readonly CcmgWorkItem[];
    approvals: readonly CcmgWorkItem[];
    exceptions: readonly CcmgWorkItem[];
    handoffs: readonly CcmgHandoff[];
  };
  cansLineage: {
    versions: readonly CansAssessmentVersion[];
    routes: readonly CansPlanLineage[];
  };
  audit: { accessEventId: string; events: readonly CcmgAuditEvent[] };
}

const LEADERSHIP_ROLES = new Set([
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "clinical-director",
  "ccmg-program-director",
]);

export function visibleQueueIdsForRole(role: string): readonly CcmgQueueId[] {
  if (LEADERSHIP_ROLES.has(role)) return CCMG_QUEUE_IDS;
  switch (role) {
    case "treatment-director": return ["qa", "cans", "mhtcm"];
    case "intake-coordinator": return ["intake", "cans"];
    case "clinical-supervisor": return ["intake", "qa", "cans", "medication_management", "mhtcm", "mhrs"];
    case "chart-auditor": return ["qa"];
    case "nurse": return ["medication_management"];
    case "mhtcm-supervisor":
    case "case-manager": return ["cans", "mhtcm"];
    case "mhrs-supervisor": return ["cans", "mhrs"];
    case "therapist": return ["mhrs"];
    case "qmhp-cs": return ["intake", "cans"];
    case "revenue-cycle-manager":
    case "gro-administrator":
    case "program-director": return ["intake"];
    default: return [];
  }
}

export function isValidWorkflowTransition(from: WorkflowStatus, to: WorkflowStatus): boolean {
  const allowed: Readonly<Record<WorkflowStatus, readonly WorkflowStatus[]>> = {
    pending: ["in_progress", "blocked", "cancelled"],
    in_progress: ["blocked", "awaiting_approval", "completed", "cancelled"],
    blocked: ["in_progress", "cancelled"],
    awaiting_approval: ["in_progress", "completed", "blocked"],
    completed: [],
    cancelled: [],
  };
  return allowed[from].includes(to);
}
