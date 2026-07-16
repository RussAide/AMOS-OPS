import type {
  M41cYouthPathwayDomain,
  M41cYouthPathwayPack,
  M41cYouthPathwayReview,
} from "@contracts/m41c/pathways";
import type {
  M41cCompetencyGateResult,
  M41cSignedValidationRecord,
} from "@contracts/m41c/governance";
import { M41C_DEMO_BOUNDARY } from "@contracts/m41c/shared";
import { verifyM41cSignedValidationRecord } from "./clinical-governance";
import { buildM41cHumanGate } from "./pathway-orchestrator";

const COMMON_BOUNDARIES = Object.freeze([
  "Metadata and synthetic signals only; no proprietary item wording or scoring is stored.",
  "The pack cannot diagnose, prescribe, assign level of care, discharge, bill, disclose, or write externally.",
  "Positive, worsening, conflicting, or incomplete evidence is routed to a named qualified human.",
]);

function pack(
  domain: M41cYouthPathwayDomain,
  reviewCadence: M41cYouthPathwayPack["schedule"]["reviewCadence"],
  comorbidityReviewDomains: readonly M41cYouthPathwayDomain[],
): M41cYouthPathwayPack {
  const code = domain.toUpperCase().replace(/_/g, "-");
  return Object.freeze({
    id: `M41C-PATHWAY-${code}`,
    version: "synthetic-metadata-1.0",
    domain,
    activationState: "demo_approved",
    sourceIds: Object.freeze([
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN",
    ]),
    instrumentMetadataIds: Object.freeze([
      "SYNTH-M41C-INSTRUMENT-STANDIN",
    ]),
    schedule: Object.freeze({
      baselineRequired: true,
      reviewCadence,
      reassessmentTriggers: Object.freeze([
        "worsening synthetic measure state",
        "new safety signal",
        "transition between continuum settings",
        "nonresponse at governed review",
      ]),
      responseReviewRequired: true,
      nonresponseReviewRequired: true,
    }),
    comorbidityReviewDomains: Object.freeze([...comorbidityReviewDomains]),
    responseSignals: Object.freeze([
      "SYNTH-MEASURE-IMPROVING",
      "SYNTH-GOAL-PROGRESS-DOCUMENTED",
    ]),
    nonresponseSignals: Object.freeze([
      "SYNTH-MEASURE-NOT-IMPROVING",
      "SYNTH-FUNCTION-NOT-IMPROVING",
    ]),
    boundaries: COMMON_BOUNDARIES,
    requiredHumanRoles: Object.freeze([
      "clinical-director",
      "clinical-supervisor",
      "therapist",
      "qmhp-cs",
    ] as const),
    syntheticOnly: true,
  });
}

export const M41C_YOUTH_PATHWAY_PACKS: readonly M41cYouthPathwayPack[] =
  Object.freeze([
    pack("depression", "weekly", ["anxiety", "trauma", "substance_use"]),
    pack("anxiety", "weekly", ["depression", "trauma"]),
    pack("trauma", "weekly", ["depression", "anxiety", "substance_use"]),
    pack("substance_use", "weekly", ["depression", "trauma"]),
    pack("disruptive_behavior", "weekly", ["trauma", "cross_cutting"]),
    pack("cross_cutting", "monthly", [
      "depression",
      "anxiety",
      "trauma",
      "substance_use",
      "disruptive_behavior",
    ]),
  ]);

export function getM41cYouthPathwayPack(
  domain: M41cYouthPathwayDomain,
): M41cYouthPathwayPack {
  const found = M41C_YOUTH_PATHWAY_PACKS.find(
    (candidate) => candidate.domain === domain,
  );
  if (!found) throw new Error("M41C_YOUTH_PATHWAY_PACK_NOT_FOUND");
  return found;
}

export function evaluateM41cYouthPathwayPack(input: {
  domain: M41cYouthPathwayDomain;
  evidenceComplete: boolean;
  observedSignals: readonly string[];
  activeComorbidityDomains: readonly M41cYouthPathwayDomain[];
  signedValidation: M41cSignedValidationRecord;
  competencyGate: M41cCompetencyGateResult;
}): M41cYouthPathwayReview {
  const selected = getM41cYouthPathwayPack(input.domain);
  if (
    input.signedValidation.artifactId !== selected.id ||
    input.signedValidation.artifactKind !== "pathway" ||
    input.signedValidation.artifactVersion !== selected.version ||
    verifyM41cSignedValidationRecord(input.signedValidation).length > 0
  ) {
    throw new Error("M41C_YOUTH_PATHWAY_SIGNED_VALIDATION_REQUIRED");
  }
  if (
    !selected.sourceIds.every((sourceId) =>
      input.signedValidation.sourceIds.includes(sourceId),
    )
  ) {
    throw new Error("M41C_YOUTH_PATHWAY_VALIDATION_SOURCE_MISMATCH");
  }
  if (
    !input.competencyGate.passedForSyntheticDemo ||
    !input.competencyGate.satisfiedRequirementIds.includes(
      "M41C-COMP-PATHWAY",
    )
  ) {
    throw new Error("M41C_YOUTH_PATHWAY_COMPETENCY_GATE_REQUIRED");
  }
  const hasNonresponse = input.observedSignals.some((signal) =>
    selected.nonresponseSignals.includes(signal),
  );
  const hasResponse = input.observedSignals.some((signal) =>
    selected.responseSignals.includes(signal),
  );
  const comorbid = input.activeComorbidityDomains.filter((domain) =>
    selected.comorbidityReviewDomains.includes(domain),
  );
  const status = !input.evidenceComplete
    ? "blocked_incomplete"
    : comorbid.length > 0
      ? "comorbidity_review"
      : hasNonresponse
        ? "nonresponse_review"
        : hasResponse
          ? "response_review"
          : "routine_measurement";
  const requiredReviews = [
    ...(hasResponse ? ["qualified human response review"] : []),
    ...(hasNonresponse ? ["qualified human nonresponse review"] : []),
    ...comorbid.map((domain) => `comorbidity review: ${domain}`),
    ...(!input.evidenceComplete ? ["complete missing governed evidence"] : []),
  ];

  return Object.freeze({
    packId: selected.id,
    domain: selected.domain,
    status,
    nextCadence: selected.schedule.reviewCadence,
    requiredReviews: Object.freeze(requiredReviews),
    humanGate: buildM41cHumanGate({
      gateId: `${selected.id}-HUMAN-REVIEW-GATE`,
      accountableRoles: selected.requiredHumanRoles,
      competencyIds: ["M41C-COMP-PATHWAY"],
    }),
    prohibitedActions: M41C_DEMO_BOUNDARY.prohibitedActions,
  });
}
