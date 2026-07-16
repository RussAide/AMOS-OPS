import { describe, expect, it } from "vitest";
import type { M41cCmbhsSnapshot } from "@contracts/m41c/mappings";
import {
  attemptM41cCmbhsWrite,
  projectM41cFhirAlignedBundle,
  reconcileM41cCmbhsSnapshots,
  validateM41cFhirAlignedBundle,
} from "../services/m41c/cmbhs-fhir-mapping";

const NOW = "2026-11-15T08:00:00.000Z";
const local: M41cCmbhsSnapshot = {
  snapshotId: "SYNTH-CMBHS-LOCAL-001",
  subjectId: "SYNTH-YOUTH-001",
  episodeId: "SYNTH-EPISODE-001",
  capturedAt: NOW,
  sourceVersion: "synthetic-1",
  fields: {
    assessmentStatus: "complete",
    recoveryPlanStatus: "linked",
    reviewSequence: 2,
  },
  syntheticOnly: true,
};

function reconciliationInput() {
  return {
    reconciliationId: "SYNTH-CMBHS-RECONCILIATION-001",
    localSnapshot: local,
    externalSnapshot: { ...local, snapshotId: "SYNTH-CMBHS-EXTERNAL-001" },
    expectedFieldNames: [
      "assessmentStatus",
      "recoveryPlanStatus",
      "reviewSequence",
    ],
    actorId: "SYNTH-HUMAN-CHART-AUDITOR-001",
    actorRole: "chart-auditor" as const,
    occurredAt: NOW,
    externalServiceAvailable: true,
  };
}

describe("M4.1C FHIR-aligned projection and CMBHS read/reconcile simulator", () => {
  it("creates a provenance-bearing internal FHIR-aligned collection with no transmission", () => {
    const bundle = projectM41cFhirAlignedBundle({
      bundleId: "SYNTH-FHIR-BUNDLE-001",
      subjectId: "SYNTH-YOUTH-001",
      episodeId: "SYNTH-EPISODE-001",
      generatedAt: NOW,
      versionId: "synthetic-1",
      consentState: "active",
      sourceRecordIds: ["SYNTH-SOURCE-001"],
      questionnaireIds: ["SYNTH-QUESTIONNAIRE-001"],
      assessmentIds: ["SYNTH-ASSESSMENT-001"],
      carePlanIds: ["SYNTH-CARE-PLAN-001"],
      measureIds: ["SYNTH-MEASURE-001"],
      planDefinitionIds: ["SYNTH-PLAN-DEFINITION-001"],
      serviceRequestIds: ["SYNTH-SERVICE-REQUEST-001"],
      taskIds: ["SYNTH-TASK-001"],
      detectedIssueIds: ["SYNTH-DETECTED-ISSUE-001"],
    });
    expect(bundle.externalTransmissionAvailable).toBe(false);
    expect(bundle.certificationClaimed).toBe(false);
    expect(bundle.resources.map((resource) => resource.resourceType)).toEqual(
      expect.arrayContaining([
        "Patient",
        "EpisodeOfCare",
        "Questionnaire",
        "Observation",
        "CarePlan",
        "Measure",
        "PlanDefinition",
        "ServiceRequest",
        "Task",
        "Consent",
        "DetectedIssue",
        "Provenance",
      ]),
    );
    expect(validateM41cFhirAlignedBundle(bundle)).toMatchObject({
      valid: true,
      provenancePresent: true,
      externalWritesBlocked: true,
    });
    const missingMeasure = {
      ...bundle,
      resources: bundle.resources.filter(
        (resource) => resource.resourceType !== "Measure",
      ),
    };
    expect(validateM41cFhirAlignedBundle(missingMeasure)).toMatchObject({
      valid: false,
      errors: ["Required FHIR-aligned Measure resource is missing."],
    });

    const provenance = bundle.resources.find(
      (resource) => resource.resourceType === "Provenance",
    )!;
    const incompleteProvenance = {
      ...bundle,
      resources: bundle.resources.map((resource) =>
        resource.resourceType === "Provenance"
          ? { ...provenance, data: { ...provenance.data, targetIds: [] } }
          : resource,
      ),
    };
    expect(
      validateM41cFhirAlignedBundle(incompleteProvenance).errors,
    ).toContain("Provenance does not cover every projected resource.");

    const wrongReference = {
      ...bundle,
      resources: bundle.resources.map((resource) =>
        resource.resourceType === "CarePlan"
          ? { ...resource, subjectReference: "Patient/SYNTH-WRONG-SUBJECT" }
          : resource,
      ),
    };
    expect(validateM41cFhirAlignedBundle(wrongReference).errors).toContain(
      "Resource CarePlan/SYNTH-CARE-PLAN-001 has inconsistent subject reference.",
    );
  });

  it("blocks projection when consent is missing, expired, or revoked", () => {
    for (const consentState of ["missing", "expired", "revoked"] as const) {
      expect(() =>
        projectM41cFhirAlignedBundle({
          bundleId: `SYNTH-FHIR-CONSENT-${consentState.toUpperCase()}`,
          subjectId: "SYNTH-YOUTH-001",
          episodeId: "SYNTH-EPISODE-001",
          generatedAt: NOW,
          versionId: "synthetic-1",
          consentState,
          sourceRecordIds: ["SYNTH-SOURCE-001"],
          questionnaireIds: ["SYNTH-QUESTIONNAIRE-001"],
          assessmentIds: ["SYNTH-ASSESSMENT-001"],
          carePlanIds: ["SYNTH-CARE-PLAN-001"],
          measureIds: ["SYNTH-MEASURE-001"],
          planDefinitionIds: ["SYNTH-PLAN-DEFINITION-001"],
          serviceRequestIds: [],
          taskIds: ["SYNTH-TASK-001"],
          detectedIssueIds: [],
        }),
      ).toThrow("M41C_FHIR_CONSENT_DENIED");
    }
  });

  it("reconciles matching snapshots without attempting an external write", () => {
    const result = reconcileM41cCmbhsSnapshots(reconciliationInput());
    expect(result).toMatchObject({
      mode: "read_and_reconcile_simulator",
      status: "reconciled",
      externalWriteAttempted: false,
      externalWriteSucceeded: false,
      liveWrites: 0,
      productionRows: 0,
    });
    expect(
      result.differences.every((difference) => difference.state === "match"),
    ).toBe(true);
  });

  it("surfaces conflicts for named human review", () => {
    const result = reconcileM41cCmbhsSnapshots({
      ...reconciliationInput(),
      externalSnapshot: {
        ...local,
        snapshotId: "SYNTH-CMBHS-EXTERNAL-CONFLICT",
        fields: { ...local.fields, reviewSequence: 3 },
      },
    });
    expect(result.status).toBe("differences_pending");
    expect(
      result.differences.find((item) => item.fieldName === "reviewSequence"),
    ).toMatchObject({
      state: "mismatch",
      humanReviewRequired: true,
    });
    expect(result.humanGate.required).toBe(true);
  });

  it("handles outage and recovery deterministically without live writes", () => {
    const outage = reconcileM41cCmbhsSnapshots({
      ...reconciliationInput(),
      externalServiceAvailable: false,
      externalSnapshot: null,
    });
    expect(outage.status).toBe("outage");
    expect(
      outage.differences.every((item) => item.state === "missing_external"),
    ).toBe(true);
    const recovered = reconcileM41cCmbhsSnapshots({
      ...reconciliationInput(),
      reconciliationId: "SYNTH-CMBHS-RECONCILIATION-RECOVERY",
    });
    expect(recovered.status).toBe("reconciled");
    expect(outage.liveWrites + recovered.liveWrites).toBe(0);
  });

  it("blocks the CMBHS write surface unconditionally", () => {
    const blocked = attemptM41cCmbhsWrite({
      actorId: "SYNTH-HUMAN-CHART-AUDITOR-001",
      actorRole: "chart-auditor",
      reconciliationId: "SYNTH-CMBHS-RECONCILIATION-001",
      occurredAt: NOW,
    });
    expect(blocked).toMatchObject({
      requestedAction: "cmbhs_write",
      mappedProhibitedAction: "cmbhs_write",
      blocked: true,
      liveWrites: 0,
      productionRows: 0,
    });
  });

  it("rejects cross-subject snapshot reconciliation", () => {
    expect(() =>
      reconcileM41cCmbhsSnapshots({
        ...reconciliationInput(),
        externalSnapshot: {
          ...local,
          snapshotId: "SYNTH-CMBHS-EXTERNAL-WRONG-SUBJECT",
          subjectId: "SYNTH-YOUTH-OTHER",
        },
      }),
    ).toThrow("M41C_CMBHS_SNAPSHOT_IDENTITY_MISMATCH");
  });

  it("rejects non-synthetic snapshots, actors, and unauthorized reviewers", () => {
    expect(() =>
      reconcileM41cCmbhsSnapshots({
        ...reconciliationInput(),
        localSnapshot: { ...local, syntheticOnly: false as true },
      }),
    ).toThrow("M41C_CMBHS_SYNTHETIC_SNAPSHOT_REQUIRED");
    expect(() =>
      reconcileM41cCmbhsSnapshots({
        ...reconciliationInput(),
        actorId: "REAL-CHART-AUDITOR",
      }),
    ).toThrow("M41C_SYNTHETIC_IDENTIFIER_REQUIRED");
    expect(() =>
      reconcileM41cCmbhsSnapshots({
        ...reconciliationInput(),
        actorRole: "billing-specialist",
      }),
    ).toThrow("M41C_CMBHS_RECONCILIATION_ROLE_DENIED");
  });
});
