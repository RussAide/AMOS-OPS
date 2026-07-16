import type { M41bCadence } from "../m41b";
import type { UserRole } from "../../src/constants/roles";
import type {
  M41cCompetencyGateResult,
  M41cSignedValidationRecord,
} from "./governance";
import type {
  M41cActivationState,
  M41cAuditEvent,
  M41cClinicalRecommendation,
  M41cHumanGate,
  M41cLongitudinalReference,
  M41cProhibitedAction,
} from "./shared";

/**
 * M4.1C stores pathway metadata and synthetic stand-ins only. It deliberately
 * contains no proprietary instrument wording, response anchors, or scoring
 * algorithms.
 */
export const M41C_PATHWAY_STAGES = [
  "assessment",
  "needs_and_strengths",
  "formulation",
  "goals",
  "interventions",
  "staff_and_services",
  "outcomes",
  "review",
  "transition",
  "aftercare",
] as const;
export type M41cPathwayStage = (typeof M41C_PATHWAY_STAGES)[number];

export const M41C_CONTINUUM_STAGES = [
  "prevention",
  "intake",
  "outpatient",
  "mhtcm",
  "mhrs",
  "gro",
  "crisis",
  "emergency",
  "inpatient",
  "step_down",
  "aftercare",
  "family",
  "school",
  "community",
] as const;
export type M41cContinuumStage = (typeof M41C_CONTINUUM_STAGES)[number];

export const M41C_SAFETY_STATES = [
  "routine",
  "incomplete",
  "positive",
  "escalating",
] as const;
export type M41cSafetyState = (typeof M41C_SAFETY_STATES)[number];

export const M41C_YOUTH_PATHWAY_DOMAINS = [
  "depression",
  "anxiety",
  "trauma",
  "substance_use",
  "disruptive_behavior",
  "cross_cutting",
] as const;
export type M41cYouthPathwayDomain =
  (typeof M41C_YOUTH_PATHWAY_DOMAINS)[number];

export interface M41cPathwayStepDefinition {
  id: string;
  stage: M41cPathwayStage;
  title: string;
  requiredInputs: readonly string[];
  outputKinds: readonly string[];
  requiredHumanRoles: readonly UserRole[];
  stopOnMissingInput: boolean;
  prohibitedAutonomousActions: readonly M41cProhibitedAction[];
}

export interface M41cMeasurementSchedule {
  baselineRequired: boolean;
  reviewCadence: M41bCadence;
  reassessmentTriggers: readonly string[];
  responseReviewRequired: boolean;
  nonresponseReviewRequired: boolean;
}

export interface M41cPathwayDefinition {
  id: string;
  version: string;
  title: string;
  domain:
    | M41cYouthPathwayDomain
    | "trr"
    | "suicide_crisis"
    | "medication_physical_health";
  activationState: M41cActivationState;
  syntheticOnly: true;
  sourceIds: readonly string[];
  instrumentProfileIds: readonly string[];
  population: readonly string[];
  settings: readonly string[];
  exclusions: readonly string[];
  steps: readonly M41cPathwayStepDefinition[];
  measurementSchedule: M41cMeasurementSchedule;
  humanGateTemplate: M41cHumanGate;
  limitations: readonly string[];
}

export interface M41cSyntheticClinicalSignal {
  code: string;
  dimension: "need" | "strength" | "safety" | "function" | "health";
  state: "routine" | "watch" | "actionable" | "urgent" | "unknown";
  assessmentId: string;
  recordedAt: string;
  synthetic: true;
}

export interface M41cSyntheticAssessmentReference {
  assessmentId: string;
  profileId: string;
  profileVersion: string;
  completedAt: string;
  signals: readonly M41cSyntheticClinicalSignal[];
  missingInputs: readonly string[];
  contentIsSyntheticStandIn: true;
}

export interface M41cNamedHumanDecision {
  decidedBy: string;
  decidedByRole: UserRole;
  decidedAt: string;
  disposition: "approved" | "modified" | "rejected";
  rationale: string;
  overrideReason: string | null;
  qualificationIds: readonly string[];
}

export interface M41cPathwayRunInput {
  runId: string;
  correlationId: string;
  subjectId: string;
  episodeId: string;
  pathway: M41cPathwayDefinition;
  assessment: M41cSyntheticAssessmentReference;
  actorId: string;
  actorRole: UserRole;
  occurredAt: string;
  signedValidation: M41cSignedValidationRecord;
  competencyGate: M41cCompetencyGateResult;
  humanDecision?: M41cNamedHumanDecision;
}

export interface M41cPathwayStageResult {
  id: string;
  stage: M41cPathwayStage;
  status:
    "complete" | "pending_human_review" | "blocked_missing_input" | "rejected";
  inputIds: readonly string[];
  outputIds: readonly string[];
  explanation: string;
  humanGateId: string;
}

export interface M41cPathwayRunResult {
  runId: string;
  correlationId: string;
  status:
    | "awaiting_human_review"
    | "approved_for_demo"
    | "modified_for_demo"
    | "rejected"
    | "blocked_incomplete";
  stages: readonly M41cPathwayStageResult[];
  recommendation: M41cClinicalRecommendation | null;
  longitudinalReference: M41cLongitudinalReference;
  auditEvents: readonly M41cAuditEvent[];
  blockedActions: readonly M41cProhibitedAction[];
  productionRows: 0;
  liveWrites: 0;
}

export interface M41cTrrPackageInput {
  packageId: string;
  subjectId: string;
  episodeId: string;
  assessment: M41cSyntheticAssessmentReference;
  uniformAssessmentComplete: boolean;
  recoveryPlanId: string | null;
  authorizationReviewDueAt: string;
  serviceHistoryIds: readonly string[];
  outcomeRecordIds: readonly string[];
  signedValidation: M41cSignedValidationRecord;
  competencyGate: M41cCompetencyGateResult;
  humanDecision?: M41cNamedHumanDecision;
  occurredAt: string;
}

export interface M41cTrrPackageResult {
  packageId: string;
  profileId: string;
  profileVersion: string;
  uniformAssessmentStatus: "complete" | "incomplete";
  levelOfCareReview:
    | "not_evaluated"
    | "qualified_human_review_required"
    | "human_reviewed_for_demo";
  servicePackageCandidates: readonly string[];
  recoveryPlanStatus: "linked" | "required";
  utilizationReviewStatus: "ready_for_human_review" | "incomplete";
  reauthorizationReviewDueAt: string;
  serviceHistoryIds: readonly string[];
  outcomeRecordIds: readonly string[];
  cmbhsReconciliationRequired: true;
  humanGate: M41cHumanGate;
  prohibitedActions: readonly M41cProhibitedAction[];
  productionRows: 0;
  liveWrites: 0;
}

export interface M41cSuicideCrisisInput {
  pathwayRunId: string;
  subjectId: string;
  episodeId: string;
  safetyState: M41cSafetyState;
  screeningProfileId: string;
  screeningCompletedAt: string | null;
  bssaCompletedBy: string | null;
  bssaCompletedByRole: UserRole | null;
  licensedDispositionBy: string | null;
  licensedDispositionByRole: UserRole | null;
  safetyPlanId: string | null;
  guardianContactStatus:
    "documented" | "attempted" | "not_applicable" | "missing";
  crisisHandoffId: string | null;
  followUpDueAt: string | null;
  humanDecision?: M41cNamedHumanDecision;
  occurredAt: string;
}

export type M41cSafetyStep =
  | "validated_screen_metadata"
  | "positive_result_escalation"
  | "qualified_bssa"
  | "licensed_disposition"
  | "safety_plan"
  | "guardian_contact"
  | "crisis_handoff"
  | "follow_up"
  | "supervisory_review";

export interface M41cSafetyStepResult {
  step: M41cSafetyStep;
  status: "complete" | "required" | "blocked" | "not_applicable";
  evidenceId: string | null;
}

export interface M41cSuicideCrisisResult {
  pathwayRunId: string;
  safetyState: M41cSafetyState;
  disposition:
    | "routine_monitoring"
    | "stop_incomplete"
    | "immediate_human_escalation"
    | "crisis_handoff_active";
  steps: readonly M41cSafetyStepResult[];
  humanGate: M41cHumanGate;
  auditEvents: readonly M41cAuditEvent[];
  prohibitedActions: readonly M41cProhibitedAction[];
  productionRows: 0;
  liveWrites: 0;
}

export interface M41cYouthPathwayPack {
  id: string;
  version: string;
  domain: M41cYouthPathwayDomain;
  activationState: "demo_approved";
  sourceIds: readonly string[];
  instrumentMetadataIds: readonly string[];
  schedule: M41cMeasurementSchedule;
  comorbidityReviewDomains: readonly M41cYouthPathwayDomain[];
  responseSignals: readonly string[];
  nonresponseSignals: readonly string[];
  boundaries: readonly string[];
  requiredHumanRoles: readonly UserRole[];
  syntheticOnly: true;
}

export interface M41cYouthPathwayReview {
  packId: string;
  domain: M41cYouthPathwayDomain;
  status:
    | "routine_measurement"
    | "response_review"
    | "nonresponse_review"
    | "comorbidity_review"
    | "blocked_incomplete";
  nextCadence: M41bCadence;
  requiredReviews: readonly string[];
  humanGate: M41cHumanGate;
  prohibitedActions: readonly M41cProhibitedAction[];
}

export interface M41cMedicationHealthInput {
  reviewId: string;
  subjectId: string;
  episodeId: string;
  medicationReconciliationComplete: boolean;
  allergyReviewComplete: boolean;
  monitoringDue: boolean;
  labReviewDue: boolean;
  refusalRecorded: boolean;
  adverseEventState: "none" | "suspected" | "urgent";
  physicalHealthFollowUpDue: boolean;
  transitionMedicationListVerified: boolean;
  reviewerId: string;
  reviewerRole: UserRole;
  humanDecision?: M41cNamedHumanDecision;
  occurredAt: string;
}

export interface M41cMedicationHealthResult {
  reviewId: string;
  status:
    "routine" | "incomplete" | "human_safety_review" | "urgent_escalation";
  tasks: readonly {
    id: string;
    kind:
      | "reconciliation"
      | "allergy_review"
      | "monitoring"
      | "lab_review"
      | "refusal_review"
      | "adverse_event_escalation"
      | "physical_health_follow_up"
      | "transition_verification";
    status: "complete" | "due" | "urgent";
    cadence: M41bCadence;
  }[];
  humanGate: M41cHumanGate;
  auditEvents: readonly M41cAuditEvent[];
  prohibitedActions: readonly M41cProhibitedAction[];
  productionRows: 0;
  liveWrites: 0;
}

export interface M41cContinuumEventInput {
  id: string;
  stage: M41cContinuumStage;
  occurredAt: string;
  serviceId: string | null;
  sourceRecordIds: readonly string[];
  transitionReason: string | null;
  aftercareLinkId: string | null;
}

export interface M41cContinuumEpisodeInput {
  episodeId: string;
  subjectId: string;
  openedAt: string;
  events: readonly M41cContinuumEventInput[];
  humanDecision?: M41cNamedHumanDecision;
}

export interface M41cContinuumEpisodeResult {
  episodeId: string;
  subjectId: string;
  stagesRepresented: readonly M41cContinuumStage[];
  events: readonly M41cContinuumEventInput[];
  longitudinalReference: M41cLongitudinalReference;
  transitionGate: M41cHumanGate;
  continuityWarnings: readonly string[];
  productionRows: 0;
  liveWrites: 0;
}

export type M41cControlledClinicalAction =
  | M41cProhibitedAction
  | "live_write"
  | "level_of_care_assignment"
  | "discharge"
  | "clinical_disclosure";

export interface M41cBlockedActionResult {
  requestedAction: M41cControlledClinicalAction;
  mappedProhibitedAction: M41cProhibitedAction;
  blocked: true;
  reason: string;
  auditEvent: M41cAuditEvent;
  productionRows: 0;
  liveWrites: 0;
}

export interface M41cSyntheticScenario {
  id: string;
  kind:
    | "routine"
    | "incomplete"
    | "positive_safety"
    | "escalating"
    | "conflict"
    | "reassessment"
    | "loc_review"
    | "transition"
    | "outage"
    | "override"
    | "recovery";
  subjectId: string;
  expectedControl: string;
  syntheticOnly: true;
}
