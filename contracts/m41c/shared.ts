import type { M41bCadence, M41bRoleContext } from "../m41b";
import type { DivisionId } from "../../src/constants/organization";
import type { UserRole } from "../../src/constants/roles";

export const M41C_MILESTONE = "M4.1C" as const;
export const M41C_ENVIRONMENT_ID =
  "AMOS-OPS-M4.1C-CLINICAL-EVALUATION" as const;
export const M41C_ENVIRONMENT_LABEL =
  "SYNTHETIC CLINICAL PROTOTYPE — NO REAL DATA — NO PRODUCTION CLINICAL ACTION" as const;
export const M41C_EVALUATION_AS_OF = "2026-11-15T08:00:00.000Z" as const;
export const M41C_EVIDENCE_CLASS = "synthetic_clinical_demo" as const;
export type M41cEvidenceClass = typeof M41C_EVIDENCE_CLASS;

export const M41C_ACTIVATION_STATES = [
  "draft",
  "validation_pending",
  "quarantined",
  "demo_approved",
] as const;
export type M41cActivationState = (typeof M41C_ACTIVATION_STATES)[number];

export const M41C_SOURCE_STATES = [
  "current",
  "stale",
  "expired",
  "withdrawn",
  "unavailable",
] as const;
export type M41cSourceState = (typeof M41C_SOURCE_STATES)[number];

export const M41C_LICENSE_STATES = [
  "not_required",
  "metadata_only",
  "license_validation_pending",
  "licensed_demo",
  "restricted",
] as const;
export type M41cLicenseState = (typeof M41C_LICENSE_STATES)[number];

export const M41C_EVIDENCE_GRADES = [
  "official_authority",
  "clinical_practice_guideline",
  "validated_instrument_metadata",
  "organizational_governance",
  "synthetic_test_standin",
  "unvalidated",
] as const;
export type M41cEvidenceGrade = (typeof M41C_EVIDENCE_GRADES)[number];

export const M41C_PROHIBITED_ACTIONS = [
  "production_care_update",
  "diagnosis",
  "autonomous_level_of_care_assignment",
  "prescribing",
  "medication_authorization",
  "autonomous_discharge",
  "claims_submission",
  "external_disclosure",
  "cmbhs_write",
] as const;
export type M41cProhibitedAction = (typeof M41C_PROHIBITED_ACTIONS)[number];

export const M41C_CONSENT_STATES = [
  "active",
  "not_required",
  "missing",
  "expired",
  "revoked",
] as const;
export type M41cConsentState = (typeof M41C_CONSENT_STATES)[number];

export type M41cHumanGateStatus =
  "pending" | "approved" | "modified" | "rejected" | "withdrawn";

export interface M41cPopulationScope {
  population: readonly string[];
  minimumAge: number | null;
  maximumAge: number | null;
  settings: readonly string[];
  programs: readonly string[];
  exclusions: readonly string[];
  languages: readonly string[];
}

export interface M41cContentBinding {
  contentAvailable: boolean;
  contentHash: string | null;
  exactWordingValidated: boolean;
  responseOptionsValidated: boolean;
  scoringLogicValidated: boolean;
  proprietaryContentStored: false;
}

export interface M41cClinicalSource {
  id: string;
  title: string;
  publisher: string;
  sourceType:
    | "law_or_regulation"
    | "state_program_authority"
    | "official_toolkit"
    | "interoperability_standard"
    | "clinical_guideline"
    | "instrument_metadata"
    | "organizational_control"
    | "synthetic_test_definition";
  canonicalUrl: string | null;
  version: string;
  effectiveAt: string | null;
  reviewedAt: string;
  reviewDueAt: string;
  state: M41cSourceState;
  evidenceGrade: M41cEvidenceGrade;
  ownerRole: UserRole;
  licenseState: M41cLicenseState;
  populationScope: M41cPopulationScope;
  limitations: readonly string[];
  missingEvidence: readonly string[];
  contentBinding: M41cContentBinding;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cClinicalRoleContext extends M41bRoleContext {
  clinicalPermissions: readonly string[];
  qualificationIds: readonly string[];
  certificationIds: readonly string[];
  minimumNecessaryPurpose: string;
  consentState: M41cConsentState;
  part2AccessPermitted: boolean;
}

export interface M41cHumanGate {
  gateId: string;
  domain: "clinical";
  required: true;
  accountableRoles: readonly UserRole[];
  qualifiedRoleRequired: boolean;
  competencyIdsRequired: readonly string[];
  status: M41cHumanGateStatus;
  decidedBy: string | null;
  decidedByRole: UserRole | null;
  decidedAt: string | null;
  rationale: string | null;
  overrideReason: string | null;
}

export interface M41cClinicalCitation {
  sourceId: string;
  title: string;
  publisher: string;
  version: string;
  canonicalUrl: string | null;
  effectiveAt: string | null;
  reviewedAt: string;
  sourceState: M41cSourceState;
  licenseState: M41cLicenseState;
  evidenceGrade: M41cEvidenceGrade;
  limitations: readonly string[];
  missingEvidence: readonly string[];
}

export interface M41cClinicalRecommendation {
  id: string;
  subjectId: string;
  pathwayId: string;
  pathwayVersion: string;
  summary: string;
  rationale: readonly string[];
  sourceIds: readonly string[];
  citations: readonly M41cClinicalCitation[];
  missingEvidence: readonly string[];
  uncertainty: string | null;
  confidence: number | null;
  requiredHumanApprover: readonly UserRole[];
  humanGate: M41cHumanGate;
  workplanCadences: readonly M41bCadence[];
  workplanItemIds: readonly string[];
  prohibitedActions: readonly M41cProhibitedAction[];
  status: "proposed" | "approved_for_demo" | "modified_for_demo" | "rejected";
  createdAt: string;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cLongitudinalReference {
  episodeId: string;
  subjectId: string;
  assessmentIds: readonly string[];
  formulationIds: readonly string[];
  goalIds: readonly string[];
  interventionIds: readonly string[];
  serviceIds: readonly string[];
  outcomeIds: readonly string[];
  transitionIds: readonly string[];
  aftercareIds: readonly string[];
}

export interface M41cAuditEvent {
  id: string;
  eventType:
    | "governance_decision"
    | "source_registered"
    | "instrument_validated"
    | "logic_quarantined"
    | "pathway_evaluated"
    | "safety_escalated"
    | "access_evaluated"
    | "guidance_requested"
    | "recommendation_issued"
    | "human_disposition"
    | "override_recorded"
    | "workplan_created"
    | "mapping_projected"
    | "external_write_blocked"
    | "competency_verified"
    | "monitoring_signal";
  actorId: string;
  actorRole: UserRole;
  entityType:
    | "source"
    | "instrument_profile"
    | "pathway"
    | "episode"
    | "recommendation"
    | "human_gate"
    | "workplan_item"
    | "mapping"
    | "competency"
    | "monitoring";
  entityId: string;
  correlationId: string;
  sourceIds: readonly string[];
  before: Readonly<Record<string, unknown>> | null;
  after: Readonly<Record<string, unknown>> | null;
  rationale: string | null;
  occurredAt: string;
  immutable: true;
  evidenceClass: M41cEvidenceClass;
}

export interface M41cDemoBoundary {
  environmentId: typeof M41C_ENVIRONMENT_ID;
  label: typeof M41C_ENVIRONMENT_LABEL;
  syntheticDataOnly: true;
  productionActivationAvailable: false;
  liveClinicalDecisionAvailable: false;
  externalWritesAvailable: false;
  prohibitedActions: readonly M41cProhibitedAction[];
}

export interface M41cCriterionResult {
  criterionId: `M4.1C-${
    | "01"
    | "02"
    | "03"
    | "04"
    | "05"
    | "06"
    | "07"
    | "08"
    | "09"
    | "10"
    | "11"
    | "12"
    | "13"
    | "14"
    | "15"
    | "16"
    | "17"
    | "18"}`;
  passed: boolean;
  summary: string;
  evidenceIds: readonly string[];
}

export interface M41cIntegratedScenarioResult {
  milestone: typeof M41C_MILESTONE;
  scenarioId: string;
  startedAt: string;
  completedAt: string;
  environment: M41cDemoBoundary;
  representedDivisions: readonly DivisionId[];
  representedCadences: readonly M41bCadence[];
  recommendationIds: readonly string[];
  auditEventIds: readonly string[];
  criteria: readonly M41cCriterionResult[];
  exitGate: boolean;
  productionRows: 0;
  liveWrites: 0;
  evidenceClass: M41cEvidenceClass;
}

export const M41C_DEMO_BOUNDARY: M41cDemoBoundary = Object.freeze({
  environmentId: M41C_ENVIRONMENT_ID,
  label: M41C_ENVIRONMENT_LABEL,
  syntheticDataOnly: true,
  productionActivationAvailable: false,
  liveClinicalDecisionAvailable: false,
  externalWritesAvailable: false,
  prohibitedActions: Object.freeze([...M41C_PROHIBITED_ACTIONS]),
});
