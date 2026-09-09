import type { CypressCapabilityLevel } from "./cypress-launch-command";

export const CYPRESS_S6_PREVIEW_SCENARIOS = [
  "administrator_ready",
  "administrator_benchmark_exception",
  "workforce_clearance_gap",
  "hospitalization_return",
  "automatic_discharge_blocked",
  "justified_discharge_after_review",
] as const;

export type CypressS6PreviewScenario =
  (typeof CYPRESS_S6_PREVIEW_SCENARIOS)[number];

export type CypressS6BenchmarkState =
  | "MEETS"
  | "MISSED"
  | "PENDING_EVIDENCE";

export type CypressS6Outcome =
  | "ADMIN_WORKFORCE_READY"
  | "ADMIN_CORRECTIVE_ACTION_REQUIRED"
  | "WORKFORCE_RELEASE_HELD"
  | "RETURN_SUPPORTED"
  | "DISCHARGE_BLOCKED"
  | "JUSTIFIED_DISCHARGE_ALLOWED";

export type CypressS6ContinuityStepId =
  | "CRISIS_EVENT"
  | "STABILIZE"
  | "REASSESS"
  | "MODIFY_SUPPORTS"
  | "RETURN_CAPABILITY_REVIEW"
  | "RETURN_OR_JUSTIFIED_DISCHARGE";

export interface CypressS6AdministratorBenchmark {
  readonly id:
    | "ON_SITE_LEADERSHIP"
    | "REFERRAL_RESPONSIVENESS"
    | "STAFFING_READINESS"
    | "HIGH_ACUITY_EXECUTION"
    | "COMPLIANCE_REPORTING";
  readonly label: string;
  readonly owner: "GRO_ADMINISTRATOR";
  readonly benchmark: string;
  readonly actual: string;
  readonly state: CypressS6BenchmarkState;
  readonly evidenceRefs: readonly string[];
}

export interface CypressS6CorrectiveActionStep {
  readonly id:
    | "EVIDENCE_ASSEMBLED"
    | "MANAGEMENT_REVIEW"
    | "CORRECTIVE_ACTION"
    | "FOLLOW_UP"
    | "CLOSE_OR_ESCALATE";
  readonly state: "COMPLETE" | "PENDING" | "NOT_REACHED";
  readonly evidenceRefs: readonly string[];
}

export interface CypressS6WorkforceCompetency {
  readonly id:
    | "RAPPORT"
    | "DE_ESCALATION"
    | "RESILIENCE"
    | "SUPERVISION_DISCIPLINE"
    | "DOCUMENTATION"
    | "CRISIS_JUDGMENT"
    | "RELIABILITY"
    | "TEAMWORK";
  readonly verified: boolean;
  readonly evidenceRefs: readonly string[];
}

export interface CypressS6WorkforceControl {
  readonly foundation: "M3.3_WORKFORCE";
  readonly recruitmentToReleaseGatesPassed: boolean;
  readonly credentialRequirementTypesCovered: number;
  readonly annualTrainingCompliant: boolean;
  readonly personnelAccessControlled: boolean;
  readonly clearanceReady: boolean;
  readonly releaseToDutyAllowed: boolean;
  readonly competencies: readonly CypressS6WorkforceCompetency[];
}

export interface CypressS6StaffingControl {
  readonly foundation: "M2.4_GRO_STAFFING";
  readonly evaluatedCensus: number;
  readonly qualifiedPresentStaff: number;
  readonly compliant: boolean;
  readonly requiredAdditionalCapacityUnits: number;
  readonly reasonCodes: readonly string[];
}

export interface CypressS6ContinuityStep {
  readonly id: CypressS6ContinuityStepId;
  readonly state: "COMPLETE" | "BLOCKED" | "NOT_REACHED";
  readonly detail: string;
  readonly evidenceRefs: readonly string[];
}

export interface CypressS6PlacementContinuity {
  readonly doctrine:
    "CRISIS_STABILIZE_REASSESS_MODIFY_RETURN_REVIEW_RETURN_OR_JUSTIFY";
  readonly steps: readonly CypressS6ContinuityStep[];
  readonly supportChanges: readonly string[];
  readonly safeReturn: boolean | null;
  readonly requestedDisposition: "NONE" | "RETURN" | "DISCHARGE";
  readonly automaticDischargeAllowed: false;
  readonly underlyingPlacementStatus: "ACTIVE" | "LEAVE" | "DISCHARGED" | "NOT_APPLICABLE";
  readonly executiveFlags: readonly string[];
}

export interface CypressS6Exception {
  readonly code: string;
  readonly severity: "CONTROL" | "WORKFORCE" | "STABILITY" | "EXECUTIVE";
  readonly disposition: "BLOCK" | "CORRECT" | "REVIEW" | "CARRY_FORWARD";
  readonly summary: string;
}

export interface CypressS6AuditEvent {
  readonly eventId: string;
  readonly eventType:
    | "ADMINISTRATOR_BENCHMARK_EVALUATED"
    | "WORKFORCE_READINESS_EVALUATED"
    | "STAFFING_READINESS_EVALUATED"
    | "PLACEMENT_CONTINUITY_EVALUATED"
    | "CORRECTIVE_ACTION_ROUTED";
  readonly status: "PASS" | "BLOCKED" | "REVIEW_REQUIRED";
  readonly detail: string;
}

export interface CypressS6PreviewResult {
  readonly sprint: "Cypress Doctrine Sprint 01";
  readonly stage: "S6";
  readonly environment: "SYNTHETIC_PREVIEW";
  readonly noPhi: true;
  readonly scenario: CypressS6PreviewScenario;
  readonly testCaseId: string;
  readonly capabilityLevels: readonly CypressCapabilityLevel[];
  readonly administratorSubject: "ROLE:GRO_ADMINISTRATOR";
  readonly licensedCapacity: 10;
  readonly futureCapacity: 16;
  readonly administratorBenchmarks: readonly CypressS6AdministratorBenchmark[];
  readonly correctiveAction: readonly CypressS6CorrectiveActionStep[];
  readonly workforce: CypressS6WorkforceControl;
  readonly staffing: CypressS6StaffingControl;
  readonly placementContinuity: CypressS6PlacementContinuity;
  readonly outcome: CypressS6Outcome;
  readonly exceptions: readonly CypressS6Exception[];
  readonly audit: readonly CypressS6AuditEvent[];
  readonly executiveVisibility: readonly string[];
  readonly title: string;
  readonly summary: string;
  readonly exactNextAction: string;
  readonly productionPromotion: "NOT_AUTHORIZED";
}

export interface CypressS6Status {
  readonly sprint: "Cypress Doctrine Sprint 01";
  readonly stage: "S6";
  readonly capability: "Administrator / Workforce / Placement Stability";
  readonly previewAvailable: true;
  readonly previewEnvironment: "SYNTHETIC_PREVIEW";
  readonly noPhi: true;
  readonly s5Accepted: true;
  readonly productionPromotion: "NOT_AUTHORIZED";
  readonly message: string;
}
