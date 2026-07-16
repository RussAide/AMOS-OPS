import type {
  M41cTrrPackageInput,
  M41cTrrPackageResult,
} from "@contracts/m41c/pathways";
import { M41C_DEMO_BOUNDARY } from "@contracts/m41c/shared";
import { verifyM41cSignedValidationRecord } from "./clinical-governance";
import {
  assertM41cSyntheticIdentifier,
  buildM41cHumanGate,
} from "./pathway-orchestrator";

export const M41C_TRR_SYNTHETIC_PROFILE_ID =
  "M41C-INSTRUMENT-TRR-CANS" as const;
export const M41C_TRR_GOVERNANCE_ARTIFACT_ID = "M41C-PATHWAY-TRR-DEMO" as const;
export const M41C_TRR_GOVERNANCE_ARTIFACT_VERSION =
  "synthetic-workflow-1.0" as const;
export const M41C_TRR_SOURCE_ID = "M41C-SRC-TRR-CANS-METADATA" as const;
const TRR_COMPETENCY_IDS = Object.freeze([
  "M41C-COMP-TRR-REVIEW",
  "M41C-COMP-LOC-HUMAN-REVIEW",
]);

/**
 * Builds a metadata-only Texas Resilience and Recovery review package. This
 * service never stores instrument wording or assigns a level of care.
 */
export function buildM41cTrrPackage(
  input: M41cTrrPackageInput,
): M41cTrrPackageResult {
  assertM41cSyntheticIdentifier(input.packageId);
  assertM41cSyntheticIdentifier(input.subjectId);
  assertM41cSyntheticIdentifier(input.episodeId);
  assertM41cSyntheticIdentifier(input.assessment.assessmentId);
  if (input.assessment.profileId !== M41C_TRR_SYNTHETIC_PROFILE_ID) {
    throw new Error("M41C_TRR_PROFILE_REQUIRED");
  }
  if (!Number.isFinite(Date.parse(input.authorizationReviewDueAt))) {
    throw new Error("M41C_TRR_REAUTH_TIME_INVALID");
  }
  if (!Number.isFinite(Date.parse(input.occurredAt))) {
    throw new Error("M41C_TRR_REVIEW_TIME_INVALID");
  }
  if (
    !Number.isFinite(Date.parse(input.assessment.completedAt)) ||
    Date.parse(input.assessment.completedAt) > Date.parse(input.occurredAt)
  ) {
    throw new Error("M41C_TRR_ASSESSMENT_TIME_INVALID");
  }
  if (
    Date.parse(input.authorizationReviewDueAt) <= Date.parse(input.occurredAt)
  ) {
    throw new Error("M41C_TRR_REAUTH_TIME_INVALID");
  }
  if (
    input.signedValidation.artifactId !== M41C_TRR_GOVERNANCE_ARTIFACT_ID ||
    input.signedValidation.artifactKind !== "pathway" ||
    input.signedValidation.artifactVersion !==
      M41C_TRR_GOVERNANCE_ARTIFACT_VERSION ||
    !input.signedValidation.sourceIds.includes(M41C_TRR_SOURCE_ID) ||
    verifyM41cSignedValidationRecord(input.signedValidation).length > 0
  ) {
    throw new Error("M41C_TRR_SIGNED_VALIDATION_REQUIRED");
  }
  if (
    !input.competencyGate.passedForSyntheticDemo ||
    input.competencyGate.productionUseAuthorized !== false ||
    !input.competencyGate.staffId.startsWith("SYNTH-HUMAN-") ||
    TRR_COMPETENCY_IDS.some(
      (requirementId) =>
        !input.competencyGate.requirementIds.includes(requirementId) ||
        !input.competencyGate.satisfiedRequirementIds.includes(requirementId),
    )
  ) {
    throw new Error("M41C_TRR_COMPETENCY_GATE_REQUIRED");
  }
  for (const signal of input.assessment.signals) {
    if (
      signal.synthetic !== true ||
      !signal.code.startsWith("SYNTH-") ||
      signal.assessmentId !== input.assessment.assessmentId ||
      !Number.isFinite(Date.parse(signal.recordedAt)) ||
      Date.parse(signal.recordedAt) > Date.parse(input.occurredAt)
    ) {
      throw new Error("M41C_TRR_SYNTHETIC_SIGNAL_INVALID");
    }
  }
  if (input.recoveryPlanId) assertM41cSyntheticIdentifier(input.recoveryPlanId);
  input.serviceHistoryIds.forEach((id) => assertM41cSyntheticIdentifier(id));
  input.outcomeRecordIds.forEach((id) => assertM41cSyntheticIdentifier(id));
  if (
    input.humanDecision &&
    Date.parse(input.humanDecision.decidedAt) < Date.parse(input.occurredAt)
  ) {
    throw new Error("M41C_TRR_HUMAN_DECISION_BEFORE_REVIEW");
  }

  const humanGate = buildM41cHumanGate({
    gateId: `${input.packageId}-LOC-HUMAN-GATE`,
    accountableRoles: [
      "clinical-director",
      "treatment-director",
      "clinical-supervisor",
    ],
    competencyIds: TRR_COMPETENCY_IDS,
    decision: input.humanDecision,
  });
  const complete =
    input.uniformAssessmentComplete &&
    input.assessment.missingInputs.length === 0;
  const reviewReady =
    complete &&
    input.recoveryPlanId !== null &&
    input.serviceHistoryIds.length > 0 &&
    input.outcomeRecordIds.length > 0;
  const candidates = complete
    ? ["SYNTH-TRR-QUALIFIED-HUMAN-SERVICE-PACKAGE-REVIEW"]
    : [];

  return Object.freeze({
    packageId: input.packageId,
    profileId: input.assessment.profileId,
    profileVersion: input.assessment.profileVersion,
    uniformAssessmentStatus: complete ? "complete" : "incomplete",
    levelOfCareReview: !complete
      ? "not_evaluated"
      : humanGate.status === "approved" || humanGate.status === "modified"
        ? "human_reviewed_for_demo"
        : "qualified_human_review_required",
    servicePackageCandidates: Object.freeze(candidates),
    recoveryPlanStatus: input.recoveryPlanId ? "linked" : "required",
    utilizationReviewStatus: reviewReady
      ? "ready_for_human_review"
      : "incomplete",
    reauthorizationReviewDueAt: input.authorizationReviewDueAt,
    serviceHistoryIds: Object.freeze([...input.serviceHistoryIds]),
    outcomeRecordIds: Object.freeze([...input.outcomeRecordIds]),
    cmbhsReconciliationRequired: true,
    humanGate,
    prohibitedActions: M41C_DEMO_BOUNDARY.prohibitedActions,
    productionRows: 0,
    liveWrites: 0,
  });
}
