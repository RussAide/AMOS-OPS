import type { Phase3AuditEvent, Phase3ModuleResult } from "./shared";
import type { RoleTier } from "@/constants/access-control";
import type { UserRole } from "@/constants/roles";

export const M31_CRITERIA = [
  "M3.1-01",
  "M3.1-02",
  "M3.1-03",
  "M3.1-04",
  "M3.1-05",
  "M3.1-06",
  "M3.1-07",
] as const;

export type M31Criterion = (typeof M31_CRITERIA)[number];
export type M31Division = "BHC" | "GRO" | "EO" | "GAD";
export type M31AlertWindow = 90 | 60 | 30;
export type M31AlertStatus =
  "assigned" | "acknowledged" | "escalated" | "closed";
export type M31AuditCategory =
  "chart" | "personnel" | "facility" | "billing" | "privacy" | "operational";
export type M31FindingSeverity = "low" | "moderate" | "high" | "critical";

export interface M31SyntheticWriteRequest {
  environment: "evaluation" | "production";
  evidenceClass: "synthetic_demo" | "production";
  entityId: string;
  operation: "create" | "update" | "approve" | "export" | "close";
}

export interface M31ComplianceAlert {
  id: string;
  calendarEventId: string;
  windowDays: M31AlertWindow;
  status: M31AlertStatus;
  assignedRole: UserRole;
  assignedTo: string;
  triggeredAt: string;
  acknowledgedAt?: string;
  escalatedAt?: string;
  escalationRole?: UserRole;
  closedAt?: string;
  closureEvidenceIds: readonly string[];
  evidenceClass: "synthetic_demo";
}

export interface M31ComplianceCalendarEvent {
  id: string;
  title: string;
  division: M31Division;
  controlOwnerRole: UserRole;
  dueAt: string;
  alertIds: readonly string[];
  status: "open" | "closed";
  closedAt?: string;
  closureEvidenceIds: readonly string[];
  evidenceClass: "synthetic_demo";
}

export interface M31AuditControl {
  id: string;
  prompt: string;
  responseType: "yes_no" | "score" | "text" | "evidence";
  required: boolean;
}

export interface M31AuditTemplate {
  id: string;
  category: M31AuditCategory;
  name: string;
  version: number;
  configurable: true;
  controlOwnerRole: UserRole;
  controls: readonly M31AuditControl[];
  activeFrom: string;
  evidenceClass: "synthetic_demo";
}

export interface M31FindingRoute {
  division: M31Division;
  severity: M31FindingSeverity;
  responsibleRole: UserRole;
  responsibleTier: RoleTier;
  dueAt: string;
  escalationPath: readonly UserRole[];
  escalationTiers: readonly RoleTier[];
}

export interface M31AuditFinding extends M31FindingRoute {
  id: string;
  auditId: string;
  templateId: string;
  controlId: string;
  summary: string;
  repeatCount: number;
  status: "open" | "in_remediation" | "verified" | "closed";
  capId?: string;
  evidenceClass: "synthetic_demo";
}

export interface M31CapTask {
  id: string;
  title: string;
  assignedRole: UserRole;
  dueAt: string;
  status: "completed";
  completedAt: string;
  evidenceIds: readonly string[];
}

export interface M31ApprovalRecord {
  actorId: string;
  actorRole: UserRole;
  outcome: "verified" | "effective" | "approved";
  reason: string;
  occurredAt: string;
}

export interface M31CorrectiveActionPlan {
  id: string;
  findingId: string;
  ownerId: string;
  ownerRole: UserRole;
  status:
    "tasks_in_progress" | "verification" | "effectiveness_review" | "closed";
  rootCauseMethod: "five_whys" | "fishbone";
  rootCause: string;
  tasks: readonly M31CapTask[];
  evidenceIds: readonly string[];
  verification?: M31ApprovalRecord;
  effectivenessReview?: M31ApprovalRecord;
  closureApproval?: M31ApprovalRecord;
  closedAt?: string;
  evidenceClass: "synthetic_demo";
}

export interface M31SurveyEvidenceRequest {
  id: string;
  description: string;
  assignedRole: UserRole;
  dueAt: string;
  status: "fulfilled";
  evidenceIds: readonly string[];
}

export interface M31SurveyInterview {
  id: string;
  participantRole: UserRole;
  scheduledAt: string;
  completedAt: string;
  evidenceId: string;
}

export interface M31SurveySample {
  id: string;
  population: string;
  sampleSize: number;
  selectedRecordIds: readonly string[];
  selectionMethod: "deterministic_stratified";
}

export interface M31MockSurvey {
  id: string;
  division: M31Division;
  authority: string;
  status: "completed";
  plannedAt: string;
  startedAt: string;
  completedAt: string;
  evidenceRequests: readonly M31SurveyEvidenceRequest[];
  interviews: readonly M31SurveyInterview[];
  samples: readonly M31SurveySample[];
  deficiencyFindingIds: readonly string[];
  readinessScore: number;
  readinessBand: "ready" | "needs_attention" | "not_ready";
  reportEvidenceId: string;
  evidenceClass: "synthetic_demo";
}

export interface M31RiskView {
  scope: "enterprise" | "division";
  division?: M31Division;
  asOf: string;
  overdueControls: number;
  repeatFindings: number;
  openCaps: number;
  priorRiskScore: number;
  riskTrend: "improving" | "stable" | "increasing";
  riskScore: number;
  sourceRecordIds: readonly string[];
}

export interface M31Snapshot extends Readonly<Record<string, unknown>> {
  fixedAsOf: string;
  calendarEvents: readonly M31ComplianceCalendarEvent[];
  alerts: readonly M31ComplianceAlert[];
  auditTemplates: readonly M31AuditTemplate[];
  findings: readonly M31AuditFinding[];
  correctiveActionPlans: readonly M31CorrectiveActionPlan[];
  mockSurveys: readonly M31MockSurvey[];
  riskViews: readonly M31RiskView[];
  productionWritesBlocked: readonly string[];
}

export type M31ModuleResult = Phase3ModuleResult & {
  milestone: "M3.1";
  domain: "COMPLIANCE";
  snapshot: M31Snapshot;
  auditEvents: readonly Phase3AuditEvent[];
};
