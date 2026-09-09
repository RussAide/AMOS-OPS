import type { CypressCapabilityLevel } from "./cypress-launch-command";

export const CYPRESS_S7_PREVIEW_SCENARIOS = [
  "continuum_outcomes_only",
  "validated_value_case",
  "unsupported_savings_claim_blocked",
  "executive_trend_referral_declines",
  "executive_trend_low_census",
  "executive_trend_rate_drift",
] as const;

export type CypressS7PreviewScenario =
  (typeof CYPRESS_S7_PREVIEW_SCENARIOS)[number];

export type CypressS7Outcome =
  | "CONTINUUM_TRACKING_ACTIVE"
  | "VALUE_EVIDENCE_READY"
  | "VALUE_CLAIM_BLOCKED"
  | "EXECUTIVE_DECISION_CASE_CREATED";

export type CypressS7ContinuumPhase = "BEFORE_ADOLBI" | "DURING_ADOLBI" | "OUTCOME";

export interface CypressS7ContinuumSnapshot {
  readonly phase: CypressS7ContinuumPhase;
  readonly cwopEpisodes: number | null;
  readonly placementBreakdowns: number | null;
  readonly hospitalOrEdEpisodes: number | null;
  readonly lawEnforcementOrTransportEvents: number | null;
  readonly placementSearches: number | null;
  readonly dailyRate: number | null;
  readonly supervisionLevel: string | null;
  readonly staffingAndSupports: readonly string[];
  readonly crisisEvents: number | null;
  readonly stabilityDays: number | null;
  readonly hospitalReturns: number | null;
  readonly placementMaintained: boolean | null;
  readonly safeReturn: boolean | null;
  readonly stepDownSuccess: boolean | null;
  readonly renewedCwopEpisodes: number | null;
  readonly evidenceRefs: readonly string[];
}

export type CypressS7ValueSourceType =
  | "PARTNER_COST_DATA"
  | "CLAIMS"
  | "ENCOUNTER"
  | "UTILIZATION_HISTORY"
  | "DOCUMENTED_ALTERNATIVE_USE";

export interface CypressS7ValueEvidenceSource {
  readonly sourceId: string;
  readonly sourceType: CypressS7ValueSourceType;
  readonly validated: boolean;
  readonly baselineCost: number | null;
  readonly continuumCost: number | null;
  readonly evidenceRefs: readonly string[];
}

export interface CypressS7ValueMeasurement {
  readonly strategicHypothesis: string;
  readonly dollarClaimRequested: boolean;
  readonly dollarClaimAllowed: boolean;
  readonly estimatedAvoidedCost: number | null;
  readonly sourceSupported: boolean;
  readonly sourceRefs: readonly string[];
  readonly payerGuarantee: false;
  readonly unilateralBillingAllowed: false;
  readonly reason: string;
}

export interface CypressS7NegotiationCase {
  readonly ready: boolean;
  readonly aggregateOnly: true;
  readonly requiredEvidence: readonly string[];
  readonly performanceMeasures: readonly string[];
  readonly reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP";
  readonly nextDecision: string;
}

export type CypressS7ExecutiveTrigger =
  | "REPEATED_TARGET_POPULATION_DECLINES"
  | "LOW_CENSUS"
  | "RATE_DRIFT";

export interface CypressS7ExecutiveDecisionCase {
  readonly created: boolean;
  readonly caseId: string | null;
  readonly trigger: CypressS7ExecutiveTrigger | null;
  readonly reservedAuthority: "GOVERNING_BODY_OR_OWNERSHIP";
  readonly observation: string;
  readonly evidenceRefs: readonly string[];
  readonly decisionQuestion: string | null;
  readonly unsupportedNarrativeAlert: false;
}

export interface CypressS7Exception {
  readonly code: string;
  readonly severity: "EVIDENCE" | "CONTROL" | "EXECUTIVE";
  readonly disposition: "BLOCK" | "REVIEW" | "CARRY_FORWARD";
  readonly summary: string;
}

export interface CypressS7AuditEvent {
  readonly eventId: string;
  readonly eventType:
    | "CWOP_BASELINE_EVALUATED"
    | "CWOP_RESOURCE_PROFILE_EVALUATED"
    | "CWOP_AUTHORIZED_ECONOMICS_EVALUATED"
    | "CWOP_STABILIZATION_PERFORMANCE_EVALUATED"
    | "CWOP_VALUE_EVIDENCE_EVALUATED"
    | "CWOP_EXECUTIVE_TREND_EVALUATED"
    | "CWOP_NEGOTIATION_CASE_EVALUATED";
  readonly status: "PASS" | "BLOCKED" | "REVIEW_REQUIRED";
  readonly detail: string;
}

export interface CypressS7PreviewResult {
  readonly sprint: "Cypress Doctrine Sprint 01";
  readonly stage: "S7";
  readonly environment: "SYNTHETIC_PREVIEW";
  readonly noPhi: true;
  readonly scenario: CypressS7PreviewScenario;
  readonly testCaseId: string;
  readonly capabilityLevels: readonly CypressCapabilityLevel[];
  readonly licensedCapacity: 10;
  readonly futureCapacity: 16;
  readonly rateFloor: 450;
  readonly rateTarget: 550;
  readonly rateEnhanced: 650;
  readonly continuum: readonly CypressS7ContinuumSnapshot[];
  readonly valueSources: readonly CypressS7ValueEvidenceSource[];
  readonly valueMeasurement: CypressS7ValueMeasurement;
  readonly negotiationCase: CypressS7NegotiationCase;
  readonly executiveDecisionCase: CypressS7ExecutiveDecisionCase;
  readonly outcome: CypressS7Outcome;
  readonly exceptions: readonly CypressS7Exception[];
  readonly audit: readonly CypressS7AuditEvent[];
  readonly executiveVisibility: readonly string[];
  readonly title: string;
  readonly summary: string;
  readonly exactNextAction: string;
  readonly s8Authorized: false;
  readonly productionPromotion: "NOT_AUTHORIZED";
}

export interface CypressS7Status {
  readonly sprint: "Cypress Doctrine Sprint 01";
  readonly stage: "S7";
  readonly capability: "CWOP Continuum Intelligence";
  readonly previewAvailable: true;
  readonly previewEnvironment: "SYNTHETIC_PREVIEW";
  readonly noPhi: true;
  readonly s6Accepted: true;
  readonly s8Authorized: false;
  readonly productionPromotion: "NOT_AUTHORIZED";
  readonly message: string;
}
