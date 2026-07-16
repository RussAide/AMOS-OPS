import type { UserRole } from "@/constants/roles";

export const PHASE3_DOMAINS = [
  "COMPLIANCE",
  "REVENUE",
  "WORKFORCE",
  "GAD",
] as const;
export type Phase3Domain = (typeof PHASE3_DOMAINS)[number];

export const PHASE3_MILESTONES = ["M3.1", "M3.2", "M3.3", "M3.4"] as const;
export type Phase3Milestone = (typeof PHASE3_MILESTONES)[number];

export const PHASE3_CRITERIA = [
  "M3.1-01",
  "M3.1-02",
  "M3.1-03",
  "M3.1-04",
  "M3.1-05",
  "M3.1-06",
  "M3.1-07",
  "M3.2-01",
  "M3.2-02",
  "M3.2-03",
  "M3.2-04",
  "M3.2-05",
  "M3.2-06",
  "M3.2-07",
  "M3.2-08",
  "M3.3-01",
  "M3.3-02",
  "M3.3-03",
  "M3.3-04",
  "M3.3-05",
  "M3.3-06",
  "M3.3-07",
  "M3.3-08",
  "M3.4-01",
  "M3.4-02",
  "M3.4-03",
  "M3.4-04",
  "M3.4-05",
  "M3.4-06",
  "M3.4-07",
  "M3.4-08",
] as const;
export type Phase3Criterion = (typeof PHASE3_CRITERIA)[number];

export const PHASE3_DEMO_CONTROL_ROLES = [
  "super-admin",
  "managing-director",
  "administrator",
  "hr-director",
  "hr-compliance-officer",
  "revenue-cycle-manager",
  "facilities-manager",
] as const satisfies readonly UserRole[];

export type Phase3DemoControlRole =
  (typeof PHASE3_DEMO_CONTROL_ROLES)[number];

export function mayControlPhase3Demo(
  role: string | null | undefined,
): role is Phase3DemoControlRole {
  return PHASE3_DEMO_CONTROL_ROLES.some((candidate) => candidate === role);
}

export const PHASE3_DX1_APPLICABLE_CONTROLS = [
  "DX1-ISOLATED-ENVIRONMENT",
  "DX1-ADDITIVE-CONTROLS",
  "DX1-PERSISTENT-BANNER",
  "DX1-SYNTHETIC-PROVENANCE",
  "DX1-ROLE-PERSONAS",
  "DX1-FEATURE-INVENTORY",
  "DX1-DETERMINISTIC-SCENARIOS",
  "DX1-PRODUCTION-ACTIONS-BLOCKED",
  "DX1-MICROSOFT-MUTATIONS-BLOCKED",
  "DX1-SEPARATE-AUDIT-EVIDENCE",
  "DX1-RESET-KILL-EXPIRATION-ACCESS-REVIEW",
  "DX1-PARITY-DEVIATION-REGISTER",
] as const;

export type Phase3Dx1ApplicableControl =
  (typeof PHASE3_DX1_APPLICABLE_CONTROLS)[number];

export type Phase3EvidenceClass = "synthetic_demo" | "production";
export type Phase3WorkStatus =
  "pending" | "in_progress" | "awaiting_review" | "completed" | "cancelled";
export type Phase3Priority = "routine" | "urgent" | "critical";

export interface Phase3CriterionResult {
  criterionId: Phase3Criterion;
  passed: boolean;
  summary: string;
  evidence: Readonly<Record<string, unknown>>;
}

export interface Phase3ModuleResult {
  milestone: Phase3Milestone;
  domain: Phase3Domain;
  evidenceClass: "synthetic_demo";
  passed: boolean;
  criteria: readonly Phase3CriterionResult[];
  snapshot: Readonly<object>;
  auditEvents: readonly Phase3AuditEvent[];
}

export interface Phase3SupportLink {
  id: string;
  domain: Phase3Domain;
  sourceDivision: "BHC" | "GRO" | "EO" | "GAD";
  sourceType: string;
  sourceId: string;
  targetType: string;
  targetId: string;
  relation: "enables" | "assures" | "funds" | "staffs" | "maintains";
  evidenceClass: "synthetic_demo";
  createdAt: string;
}

export interface Phase3WorkItem {
  id: string;
  supportCaseId: string;
  domain: Phase3Domain;
  title: string;
  sourceType: string;
  sourceId: string;
  status: Phase3WorkStatus;
  priority: Phase3Priority;
  assignedRole: UserRole;
  assignedTo?: string;
  dueAt: string;
  completedAt?: string;
  evidenceIds: readonly string[];
  evidenceClass: "synthetic_demo";
  createdAt: string;
  updatedAt: string;
}

export type Phase3AuditAction =
  | "access"
  | "change"
  | "approval"
  | "disclosure"
  | "export"
  | "administrative_action"
  | "routing"
  | "gate_decision"
  | "scenario";

export interface Phase3AuditEvent {
  id: string;
  domain: Phase3Domain;
  action: Phase3AuditAction;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: UserRole | "system";
  reason: string;
  correlationId: string;
  before?: Readonly<Record<string, unknown>>;
  after?: Readonly<Record<string, unknown>>;
  changedFields: readonly string[];
  evidenceClass: "synthetic_demo";
  occurredAt: string;
}

export interface Phase3ScenarioRun {
  id: string;
  milestone: Phase3Milestone | "PHASE3_EXIT";
  scenarioType: string;
  status: "not_started" | "running" | "passed" | "failed";
  supportCaseId: string;
  startedAt: string;
  completedAt?: string;
  assertionsPassed: number;
  assertionsFailed: number;
  evidence: Readonly<Record<string, unknown>>;
}

export interface Phase3Dx1ControlResult {
  id: Phase3Dx1ApplicableControl;
  passed: boolean;
  evidence: readonly string[];
}

export interface Phase3FeatureScenario {
  scenarioId: string;
  milestone: Phase3Milestone;
  criterionId: Phase3Criterion;
  summary: string;
  expectedResult: "pass";
  actualResult: "pass" | "fail";
  evidenceIds: readonly string[];
}

export interface Phase3ParityDeviation {
  item: string;
  disposition: "parity" | "controlled_deviation" | "deferred_by_sequence";
  rationale: string;
}

export interface Phase3Dx1Result {
  controlId: "DX.1-P3";
  evidenceClass: "synthetic_demo";
  passed: boolean;
  environmentId: "AMOS-OPS-PHASE3-EVALUATION";
  environmentLabel: "DEMO - NOT FOR CARE DELIVERY";
  applicableControls: readonly Phase3Dx1ControlResult[];
  deferredControls: readonly Phase3ParityDeviation[];
  featureScenarios: readonly Phase3FeatureScenario[];
  authorizedControlRoles: readonly Phase3DemoControlRole[];
  deniedRepresentativeRole: UserRole;
  dataProvenance: readonly string[];
  parityDeviationRegister: readonly Phase3ParityDeviation[];
  runtimeControls: Readonly<{
    productionWritesBlocked: boolean;
    microsoftMutationsBlocked: boolean;
    separateAuditEvidence: boolean;
    deterministicResetTested: boolean;
    killSwitchTested: boolean;
    dataExpirationTested: boolean;
    accessReviewCurrent: boolean;
  }>;
}

export interface Phase3IntegratedResult {
  milestone: "PHASE3_EXIT";
  evidenceClass: "synthetic_demo";
  supportCaseId: string;
  sourceEpisodeId: string;
  criteria: Readonly<Record<Phase3Criterion, boolean>>;
  failedCriteria: readonly Phase3Criterion[];
  supportLinks: readonly Phase3SupportLink[];
  workItems: readonly Phase3WorkItem[];
  moduleResults: Readonly<Record<Phase3Milestone, Phase3ModuleResult>>;
  auditEvents: readonly Phase3AuditEvent[];
  productionActionsBlocked: readonly string[];
  dx1: Phase3Dx1Result;
  exitGate: boolean;
  scenarioRun: Phase3ScenarioRun;
}

export function stablePhase3Id(
  prefix: string,
  ...parts: readonly string[]
): string {
  const input = parts.join("|");
  let hash = 2_166_136_261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }
  return `${prefix}-${(hash >>> 0).toString(16).padStart(8, "0").toUpperCase()}`;
}

export function assertPhase3Synthetic(value: {
  id: string;
  evidenceClass: Phase3EvidenceClass;
}): void {
  if (
    value.evidenceClass !== "synthetic_demo" ||
    typeof value.id !== "string" ||
    !value.id.startsWith("SYNTH-")
  ) {
    throw new Error("PHASE3_SYNTHETIC_BOUNDARY_VIOLATION");
  }
}

export function phase3DaysBetween(
  startedAt: string,
  completedAt: string,
): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(completedAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start)
    throw new Error("PHASE3_INVALID_DATE_RANGE");
  return Math.ceil((end - start) / 86_400_000);
}

export function changedPhase3Fields(
  before: Readonly<Record<string, unknown>> | undefined,
  after: Readonly<Record<string, unknown>> | undefined,
): string[] {
  const fields = new Set([
    ...Object.keys(before ?? {}),
    ...Object.keys(after ?? {}),
  ]);
  return [...fields]
    .filter(
      (field) =>
        JSON.stringify(before?.[field]) !== JSON.stringify(after?.[field]),
    )
    .sort();
}

export function assertCompleteModuleResult(result: Phase3ModuleResult): void {
  if (result.evidenceClass !== "synthetic_demo")
    throw new Error("PHASE3_NON_SYNTHETIC_MODULE_RESULT");
  if (
    !result.passed ||
    result.criteria.length === 0 ||
    result.criteria.some((criterion) => !criterion.passed)
  ) {
    throw new Error(`PHASE3_MODULE_INCOMPLETE:${result.milestone}`);
  }
}
