import type { UserRole } from "../../src/constants/roles";
import type { M41cAuditEvent, M41cHumanGate } from "./shared";

export const M41C_FHIR_ALIGNED_RESOURCE_TYPES = [
  "Patient",
  "EpisodeOfCare",
  "Questionnaire",
  "CarePlan",
  "Observation",
  "Measure",
  "PlanDefinition",
  "ServiceRequest",
  "Task",
  "Consent",
  "Provenance",
  "DetectedIssue",
] as const;
export type M41cFhirAlignedResourceType =
  (typeof M41C_FHIR_ALIGNED_RESOURCE_TYPES)[number];

/** Internal, synthetic, FHIR-aligned projection; not a claim of certification. */
export interface M41cFhirAlignedResource {
  resourceType: M41cFhirAlignedResourceType;
  id: string;
  meta: {
    profile: readonly string[];
    versionId: string;
    lastUpdated: string;
    security: readonly string[];
  };
  subjectReference: string | null;
  episodeReference: string | null;
  status: string;
  sourceRecordIds: readonly string[];
  data: Readonly<Record<string, unknown>>;
  syntheticOnly: true;
}

export interface M41cFhirAlignedBundle {
  bundleId: string;
  type: "collection";
  generatedAt: string;
  resources: readonly M41cFhirAlignedResource[];
  provenanceResourceId: string;
  externalTransmissionAvailable: false;
  certificationClaimed: false;
  syntheticOnly: true;
}

export interface M41cCmbhsSnapshot {
  snapshotId: string;
  subjectId: string;
  episodeId: string;
  capturedAt: string;
  sourceVersion: string;
  fields: Readonly<Record<string, string | number | boolean | null>>;
  syntheticOnly: true;
}

export interface M41cCmbhsReconciliationInput {
  reconciliationId: string;
  localSnapshot: M41cCmbhsSnapshot;
  externalSnapshot: M41cCmbhsSnapshot | null;
  expectedFieldNames: readonly string[];
  actorId: string;
  actorRole: UserRole;
  occurredAt: string;
  externalServiceAvailable: boolean;
}

export interface M41cCmbhsDifference {
  fieldName: string;
  localValue: string | number | boolean | null | undefined;
  externalValue: string | number | boolean | null | undefined;
  state: "match" | "mismatch" | "missing_local" | "missing_external";
  humanReviewRequired: boolean;
}

export interface M41cCmbhsReconciliationResult {
  reconciliationId: string;
  mode: "read_and_reconcile_simulator";
  status: "reconciled" | "differences_pending" | "outage";
  differences: readonly M41cCmbhsDifference[];
  humanGate: M41cHumanGate;
  auditEvents: readonly M41cAuditEvent[];
  externalWriteAttempted: false;
  externalWriteSucceeded: false;
  liveWrites: 0;
  productionRows: 0;
}

export interface M41cMappingMonitorResult {
  valid: boolean;
  errors: readonly string[];
  resourceCount: number;
  provenancePresent: boolean;
  externalWritesBlocked: boolean;
}

export interface M41cClinicalMonitoringInput {
  monitorId: string;
  evaluatedAt: string;
  sourceExpiryCount: number;
  versionMismatchCount: number;
  permissionDenialCount: number;
  safetyEscalationCount: number;
  safetyEscalationAcknowledgedCount: number;
  alertsIssued: number;
  alertsActionable: number;
  overrideCount: number;
  overridesReviewed: number;
  pathwayStepExpected: number;
  pathwayStepCompleted: number;
  outcomeReviewExpected: number;
  outcomeReviewCompleted: number;
  unintendedEffectCount: number;
  unintendedEffectsReviewed: number;
  mappingErrorCount: number;
  subgroupCompletionRates: Readonly<Record<string, number>>;
}

export type M41cClinicalMonitoringSignalKind =
  | "source_expiry"
  | "version_mismatch"
  | "permission_control"
  | "safety_follow_through"
  | "alert_fatigue"
  | "override_review"
  | "pathway_fidelity"
  | "outcome_review"
  | "unintended_effects"
  | "mapping_quality"
  | "disparity_review";

export interface M41cClinicalMonitoringSignal {
  id: string;
  kind: M41cClinicalMonitoringSignalKind;
  severity: "information" | "review" | "urgent";
  summary: string;
  humanReviewRequired: boolean;
}

export interface M41cClinicalMonitoringResult {
  monitorId: string;
  evaluatedAt: string;
  signals: readonly M41cClinicalMonitoringSignal[];
  alertPrecision: number;
  pathwayFidelity: number;
  safetyAcknowledgementRate: number;
  overrideReviewRate: number;
  outcomeReviewRate: number;
  unintendedEffectReviewRate: number;
  maximumSubgroupGap: number;
  humanGate: M41cHumanGate;
  auditEvents: readonly M41cAuditEvent[];
  productionRows: 0;
  liveWrites: 0;
}
