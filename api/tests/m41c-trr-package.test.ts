import { describe, expect, it } from "vitest";
import type {
  M41cNamedHumanDecision,
  M41cSyntheticAssessmentReference,
} from "@contracts/m41c/pathways";
import { createM41cSignedValidationRecord } from "../services/m41c/clinical-governance";
import {
  createSyntheticM41cCompetencyRegistry,
  evaluateM41cCompetencyGate,
} from "../services/m41c/competency-registry";
import {
  buildM41cTrrPackage,
  M41C_TRR_GOVERNANCE_ARTIFACT_ID,
  M41C_TRR_GOVERNANCE_ARTIFACT_VERSION,
  M41C_TRR_SOURCE_ID,
  M41C_TRR_SYNTHETIC_PROFILE_ID,
} from "../services/m41c/trr-package";

const NOW = "2026-11-15T08:00:00.000Z";
const assessment: M41cSyntheticAssessmentReference = {
  assessmentId: "SYNTH-TRR-ASSESSMENT-001",
  profileId: M41C_TRR_SYNTHETIC_PROFILE_ID,
  profileVersion: "synthetic-metadata-1.0",
  completedAt: NOW,
  signals: [
    {
      code: "SYNTH-TRR-NEED-A",
      dimension: "need",
      state: "actionable",
      assessmentId: "SYNTH-TRR-ASSESSMENT-001",
      recordedAt: NOW,
      synthetic: true,
    },
    {
      code: "SYNTH-TRR-STRENGTH-A",
      dimension: "strength",
      state: "routine",
      assessmentId: "SYNTH-TRR-ASSESSMENT-001",
      recordedAt: NOW,
      synthetic: true,
    },
  ],
  missingInputs: [],
  contentIsSyntheticStandIn: true,
};
const decision: M41cNamedHumanDecision = {
  decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR-001",
  decidedByRole: "clinical-director",
  decidedAt: "2026-11-15T08:10:00.000Z",
  disposition: "approved",
  rationale: "Reviewed the synthetic TRR package for demonstration only.",
  overrideReason: null,
  qualificationIds: ["M41C-COMP-TRR-REVIEW", "M41C-COMP-LOC-HUMAN-REVIEW"],
};

const competencyGate = evaluateM41cCompetencyGate(
  createSyntheticM41cCompetencyRegistry(),
  {
    staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    staffRole: "clinical-director",
    requirementIds: ["M41C-COMP-TRR-REVIEW", "M41C-COMP-LOC-HUMAN-REVIEW"],
  },
);

const signedValidation = createM41cSignedValidationRecord({
  artifactId: M41C_TRR_GOVERNANCE_ARTIFACT_ID,
  artifactKind: "pathway",
  artifactVersion: M41C_TRR_GOVERNANCE_ARTIFACT_VERSION,
  checks: [
    {
      checkId: "SYNTH-TRR-PACKAGE-VALIDATION",
      label: "Synthetic TRR workflow package validation",
      passed: true,
      evidenceIds: ["SYNTH-EVIDENCE-TRR-PACKAGE-VALIDATION"],
      notes: ["Nonbinding human-review workflow only"],
    },
  ],
  competencyGate,
  sourceIds: [M41C_TRR_SOURCE_ID, "M41C-SRC-CONTROLLING-DOCTRINE"],
  signatures: [
    {
      signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
      signedByRole: "clinical-director",
      signedAt: "2026-11-15T07:55:00.000Z",
      attestation: "The synthetic TRR workflow passed governed review.",
    },
    {
      signedBy: "SYNTH-HUMAN-BHC-DIRECTOR",
      signedByRole: "bhc-director",
      signedAt: "2026-11-15T07:56:00.000Z",
      attestation: "The workflow is approved only for synthetic evaluation.",
    },
  ],
  recordedAt: "2026-11-15T07:57:00.000Z",
});

function input() {
  return {
    packageId: "SYNTH-TRR-PACKAGE-001",
    subjectId: "SYNTH-YOUTH-001",
    episodeId: "SYNTH-EPISODE-001",
    assessment,
    uniformAssessmentComplete: true,
    recoveryPlanId: "SYNTH-RECOVERY-PLAN-001",
    authorizationReviewDueAt: "2026-11-22T08:00:00.000Z",
    serviceHistoryIds: ["SYNTH-SERVICE-001"],
    outcomeRecordIds: ["SYNTH-OUTCOME-001"],
    signedValidation,
    competencyGate,
    occurredAt: NOW,
  };
}

describe("M4.1C governed synthetic TRR package", () => {
  it("prepares a nonbinding LOC and service-package review with CMBHS reconciliation", () => {
    const result = buildM41cTrrPackage(input());
    expect(result).toMatchObject({
      profileId: "M41C-INSTRUMENT-TRR-CANS",
      uniformAssessmentStatus: "complete",
      levelOfCareReview: "qualified_human_review_required",
      recoveryPlanStatus: "linked",
      utilizationReviewStatus: "ready_for_human_review",
      cmbhsReconciliationRequired: true,
      productionRows: 0,
      liveWrites: 0,
    });
    expect(result.servicePackageCandidates).toEqual([
      "SYNTH-TRR-QUALIFIED-HUMAN-SERVICE-PACKAGE-REVIEW",
    ]);
    expect(result.prohibitedActions).toContain(
      "autonomous_level_of_care_assignment",
    );
    expect(result.prohibitedActions).toContain("cmbhs_write");
  });

  it("records only a human-reviewed demo status after a named qualified decision", () => {
    const result = buildM41cTrrPackage({ ...input(), humanDecision: decision });
    expect(result.levelOfCareReview).toBe("human_reviewed_for_demo");
    expect(result.humanGate).toMatchObject({
      status: "approved",
      decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR-001",
    });
  });

  it("stops an incomplete package before LOC or service-package review", () => {
    const result = buildM41cTrrPackage({
      ...input(),
      uniformAssessmentComplete: false,
      recoveryPlanId: null,
    });
    expect(result.uniformAssessmentStatus).toBe("incomplete");
    expect(result.levelOfCareReview).toBe("not_evaluated");
    expect(result.servicePackageCandidates).toEqual([]);
    expect(result.utilizationReviewStatus).toBe("incomplete");
  });

  it("keeps TRR distinct from DFPS and generic CANS profiles", () => {
    for (const profileId of ["M41C-INSTRUMENT-DFPS-CANS-3", "GENERIC-CANS"]) {
      expect(() =>
        buildM41cTrrPackage({
          ...input(),
          assessment: { ...assessment, profileId },
        }),
      ).toThrow("M41C_TRR_PROFILE_REQUIRED");
    }
  });

  it("requires the exact signed TRR workflow and competency gate", () => {
    expect(() =>
      buildM41cTrrPackage({
        ...input(),
        signedValidation: {
          ...signedValidation,
          artifactVersion: "tampered-version",
        },
      }),
    ).toThrow("M41C_TRR_SIGNED_VALIDATION_REQUIRED");

    const unrelatedGate = evaluateM41cCompetencyGate(
      createSyntheticM41cCompetencyRegistry(),
      {
        staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        staffRole: "clinical-director",
        requirementIds: ["M41C-COMP-GOVERNANCE-APPROVER"],
      },
    );
    expect(() =>
      buildM41cTrrPackage({ ...input(), competencyGate: unrelatedGate }),
    ).toThrow("M41C_TRR_COMPETENCY_GATE_REQUIRED");
  });

  it("rejects non-synthetic package lineage and invalid chronology", () => {
    expect(() =>
      buildM41cTrrPackage({
        ...input(),
        serviceHistoryIds: ["REAL-SERVICE-001"],
      }),
    ).toThrow("M41C_SYNTHETIC_IDENTIFIER_REQUIRED");
    expect(() =>
      buildM41cTrrPackage({
        ...input(),
        assessment: {
          ...assessment,
          completedAt: "2026-11-16T08:00:00.000Z",
        },
      }),
    ).toThrow("M41C_TRR_ASSESSMENT_TIME_INVALID");
  });
});
