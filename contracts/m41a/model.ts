import type { UserRole } from "../../src/constants/roles";

export const M41A_SCOPE_IDS = ["ENTERPRISE", "BHC", "GRO", "EO", "GAD"] as const;
export type M41aScopeId = (typeof M41A_SCOPE_IDS)[number];
export type M41aDivisionScope = Exclude<M41aScopeId, "ENTERPRISE">;

export const M41A_DATA_QUALITY_STATES = [
  "current",
  "stale",
  "missing",
  "contradictory",
  "suppressed",
] as const;
export type M41aDataQualityState =
  (typeof M41A_DATA_QUALITY_STATES)[number];

export const M41A_METRIC_CATEGORIES = [
  "census",
  "revenue",
  "profit_center_performance",
  "compliance",
  "strategic_initiatives",
  "utilization",
  "outcomes",
  "service_timeliness",
  "operational_risk",
  "cost",
  "workforce",
  "facilities",
  "procurement",
  "support_performance",
] as const;
export type M41aMetricCategory = (typeof M41A_METRIC_CATEGORIES)[number];

export const M41A_METRIC_UNITS = [
  "count",
  "currency",
  "percent",
  "days",
  "status",
] as const;
export type M41aMetricUnit = (typeof M41A_METRIC_UNITS)[number];

export type M41aComparison = "gte" | "lte";
export type M41aMetricStatus = "on_target" | "off_target" | "not_measured";
export type M41aSensitivity =
  | "aggregate"
  | "youth"
  | "staff"
  | "finance"
  | "sud";
export type M41aDrillDepth = 1 | 2 | 3;

export interface M41aOwner {
  roleId: UserRole;
  roleLabel: string;
  division: M41aDivisionScope;
}

export interface M41aTarget {
  value: number;
  comparison: M41aComparison;
  label: string;
}

export interface M41aMetricDefinition {
  id: string;
  name: string;
  category: M41aMetricCategory;
  scopeIds: readonly M41aScopeId[];
  description: string;
  formula: string;
  unit: M41aMetricUnit;
  precision: number;
  sourceSystem: string;
  sourceFields: readonly string[];
  owner: M41aOwner;
  refreshCadence: "daily" | "weekly" | "monthly" | "quarterly";
  staleAfterHours: number;
  target: M41aTarget;
  alertThreshold: number;
  drillDownLabel: string;
  maximumDrillDepth: 3;
  sensitivity: M41aSensitivity;
  mgmaKpiId?: string;
}

export interface M41aSourceReport {
  id: string;
  scope: M41aScopeId;
  metricId: string;
  periodStart: string;
  periodEnd: string;
  value: number;
  numerator: number;
  denominator: number;
  sourceRecordIds: readonly string[];
  sourceReference: string;
  ownerRole: UserRole;
  version: number;
  refreshedAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M41aReconciliation {
  dashboardValue: number | null;
  sourceReportValue: number | null;
  delta: number | null;
  reconciled: boolean;
  reasonCode:
    | "MATCHED"
    | "STALE_SOURCE"
    | "MISSING_SOURCE"
    | "CONTRADICTORY_SOURCE"
    | "SUPPRESSED";
}

export interface M41aMetricSnapshot {
  id: string;
  definition: M41aMetricDefinition;
  scope: M41aScopeId;
  periodStart: string;
  periodEnd: string;
  value: number | null;
  displayValue: string;
  variance: number | null;
  status: M41aMetricStatus;
  dataQualityState: M41aDataQualityState;
  dataQualityReasons: readonly string[];
  measuredAt: string | null;
  refreshTime: string | null;
  sourceReportId: string | null;
  sourceRecordIds: readonly string[];
  reconciliation: M41aReconciliation;
  maximumAuthorizedDrillDepth: 0 | 1 | 2 | 3;
  evidenceClass: "synthetic_demo";
}

export interface M41aDashboardAccess {
  actorRole: UserRole;
  requestedScope: M41aScopeId;
  authorizedScopes: readonly M41aScopeId[];
  aggregateFinanceVisible: boolean;
  sensitiveDetailSuppressed: readonly M41aSensitivity[];
  decisionActionsAllowed: boolean;
}

export interface M41aDashboard {
  milestone: "M4.1A";
  environmentId: "AMOS-OPS-M4.1A-EVALUATION";
  environmentLabel: string;
  evidenceClass: "synthetic_demo";
  scope: M41aScopeId;
  scopeLabel: string;
  scopeType: "enterprise" | "profit_center" | "corporate_office";
  asOf: string;
  periodStart: string;
  periodEnd: string;
  metrics: readonly M41aMetricSnapshot[];
  stageCensus: readonly {
    stageId: "STAGE_1" | "STAGE_2" | "STAGE_3";
    label: string;
    census: number;
    capacity: number;
    sourceRecordIds: readonly string[];
  }[];
  openAlertCount: number;
  access: M41aDashboardAccess;
}

export interface M41aDrillNode {
  nodeId: string;
  parentId: string | null;
  depth: M41aDrillDepth;
  label: string;
  displayValue: string;
  routeLabel: string;
  terminal: boolean;
  sensitivity: M41aSensitivity;
  dataQualityState: M41aDataQualityState;
  sourceRecordId: string | null;
  detail: Readonly<Record<string, string | number | boolean | null>>;
}

export interface M41aDrilldownResponse {
  scope: M41aScopeId;
  metricId: string;
  depth: M41aDrillDepth;
  clickCount: M41aDrillDepth;
  maximumClicks: 3;
  parentId: string | null;
  breadcrumb: readonly string[];
  nodes: readonly M41aDrillNode[];
  terminal: boolean;
  suppressedCount: number;
  evidenceClass: "synthetic_demo";
}

export const M41A_ALERT_STATUSES = [
  "open",
  "acknowledged",
  "assigned",
  "decided",
  "evidence_pending",
  "resolved",
] as const;
export type M41aAlertStatus = (typeof M41A_ALERT_STATUSES)[number];
export type M41aDecisionDisposition =
  | "approve_action"
  | "modify_action"
  | "defer"
  | "reject"
  | "delegate";

export interface M41aThresholdAlert {
  id: string;
  naturalKey: string;
  metricId: string;
  scope: M41aScopeId;
  status: M41aAlertStatus;
  severity: "advisory" | "urgent" | "critical";
  title: string;
  threshold: number;
  observedValue: number | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  assignedAt: string | null;
  assignedTo: string | null;
  decisionId: string | null;
  followUpEvidenceIds: readonly string[];
  resolvedAt: string | null;
  evidenceClass: "synthetic_demo";
}

export interface M41aDecisionRecord {
  id: string;
  alertId: string;
  disposition: M41aDecisionDisposition;
  rationale: string;
  decidedBy: string;
  decidedByRole: UserRole;
  decidedAt: string;
  humanApproved: true;
  evidenceClass: "synthetic_demo";
}

export interface M41aFollowUpEvidence {
  id: string;
  alertId: string;
  evidenceRef: string;
  summary: string;
  recordedBy: string;
  recordedAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M41aAuditEvent {
  id: string;
  action:
    | "alert_triggered"
    | "alert_acknowledged"
    | "alert_assigned"
    | "decision_recorded"
    | "follow_up_evidence_added"
    | "alert_resolved"
    | "evaluation_reset";
  entityType: "alert" | "decision" | "follow_up_evidence" | "evaluation";
  entityId: string;
  actorId: string;
  actorRole: UserRole | "system";
  occurredAt: string;
  before: Readonly<Record<string, unknown>> | null;
  after: Readonly<Record<string, unknown>> | null;
  correlationId: string;
  evidenceClass: "synthetic_demo";
}

export interface M41aCriterionResult {
  criterionId:
    | "M4.1A-01"
    | "M4.1A-02"
    | "M4.1A-03"
    | "M4.1A-04"
    | "M4.1A-05"
    | "M4.1A-06"
    | "M4.1A-07"
    | "M4.1A-08";
  passed: boolean;
  summary: string;
  evidenceIds: readonly string[];
}

export interface M41aScenarioResult {
  milestone: "M4.1A";
  scenarioId: string;
  runId: string;
  startedAt: string;
  completedAt: string;
  evidenceClass: "synthetic_demo";
  criteria: readonly M41aCriterionResult[];
  dashboards: Readonly<Record<M41aScopeId, M41aDashboard>>;
  alerts: readonly M41aThresholdAlert[];
  decisions: readonly M41aDecisionRecord[];
  followUpEvidence: readonly M41aFollowUpEvidence[];
  auditEvents: readonly M41aAuditEvent[];
  exitGate: boolean;
}
