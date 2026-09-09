import type { CypressCapabilityLevel } from "./cypress-launch-command";
import type { IntakeReadinessEvaluation } from "../ccmg/intake";

export const CYPRESS_S5_PREVIEW_SCENARIOS = [
  "high_acuity_accept",
  "target_population_decline_review",
  "below_floor_rate_blocked",
  "capacity_full_hold",
  "evidence_gap_hold",
] as const;

export type CypressS5PreviewScenario =
  (typeof CYPRESS_S5_PREVIEW_SCENARIOS)[number];

export type CypressS5Acuity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type CypressS5Supervision = "STANDARD" | "ONE_TO_ONE" | "TWO_TO_ONE" | "CONSTANT";
export type CypressS5RateTier = "FLOOR" | "TARGET" | "ENHANCED" | "NONE";
export type CypressS5Disposition =
  | "ACCEPT"
  | "HOLD"
  | "DECLINE_ALLOWED"
  | "DECLINE_REVIEW_REQUIRED";
export type CypressS5Outcome =
  | "ACCEPT_AUTHORIZED"
  | "HOLD_CONTROL"
  | "DECLINE_ALLOWED"
  | "DECLINE_REVIEW_REQUIRED";
export type CypressS5DeclineClass =
  | "NONE"
  | "PROTECTED_OPERATIONAL"
  | "CONVENIENCE_OR_BIAS";

export interface CypressS5AcuityProfile {
  readonly acuity: CypressS5Acuity;
  readonly supervision: CypressS5Supervision;
  readonly behavioralRisk: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  readonly clinicalSupportIntensity: "STANDARD" | "ELEVATED" | "ENHANCED";
  readonly staffingIntensity: "STANDARD" | "ELEVATED" | "ENHANCED";
  readonly estimatedResourceCostPerDay: number;
  readonly evidenceRefs: readonly string[];
}

export interface CypressS5RateControl {
  readonly floor: 450;
  readonly target: 550;
  readonly enhanced: 650;
  readonly proposedDailyRate: number;
  readonly recommendedTier: CypressS5RateTier;
  readonly recommendedDailyRate: 450 | 550 | 650 | null;
  readonly payerGuarantee: false;
  readonly rateEvidence: readonly string[];
}

export interface CypressS5DecisionException {
  readonly code: string;
  readonly severity: "CONTROL" | "EVIDENCE" | "AUTHORITY";
  readonly disposition: "BLOCK" | "REVIEW" | "CARRY_FORWARD";
  readonly summary: string;
}

export interface CypressS5AuditEvent {
  readonly eventId: string;
  readonly eventType:
    | "REFERRAL_READINESS_EVALUATED"
    | "ACUITY_PROFILE_RESOLVED"
    | "RATE_CONTROL_APPLIED"
    | "PLACEMENT_DISPOSITION_REVIEWED";
  readonly status: "PASS" | "BLOCKED" | "REVIEW_REQUIRED";
  readonly detail: string;
}

export interface CypressS5PreviewResult {
  readonly sprint: "Cypress Doctrine Sprint 01";
  readonly stage: "S5";
  readonly environment: "SYNTHETIC_PREVIEW";
  readonly noPhi: true;
  readonly scenario: CypressS5PreviewScenario;
  readonly testCaseId: string;
  readonly capabilityLevels: readonly CypressCapabilityLevel[];
  readonly licensedCapacity: 10;
  readonly currentCensus: number;
  readonly availableBeds: number;
  readonly futureCapacity: 16;
  readonly referralReadiness: IntakeReadinessEvaluation;
  readonly acuityProfile: CypressS5AcuityProfile;
  readonly rateControl: CypressS5RateControl;
  readonly requestedDecision: "ACCEPT" | "DECLINE";
  readonly declineReasonCode: string | null;
  readonly declineClass: CypressS5DeclineClass;
  readonly disposition: CypressS5Disposition;
  readonly outcome: CypressS5Outcome;
  readonly exceptions: readonly CypressS5DecisionException[];
  readonly audit: readonly CypressS5AuditEvent[];
  readonly executiveVisibility: readonly string[];
  readonly title: string;
  readonly summary: string;
  readonly exactNextAction: string;
  readonly productionPromotion: "NOT_AUTHORIZED";
}

export interface CypressS5Status {
  readonly sprint: "Cypress Doctrine Sprint 01";
  readonly stage: "S5";
  readonly capability: "Referral / Acuity / Rate";
  readonly previewAvailable: true;
  readonly previewEnvironment: "SYNTHETIC_PREVIEW";
  readonly noPhi: true;
  readonly s4Accepted: true;
  readonly productionPromotion: "NOT_AUTHORIZED";
  readonly message: string;
}
