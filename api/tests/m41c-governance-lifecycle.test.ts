import { describe, expect, it } from "vitest";
import type {
  M41cSignedValidationRecord,
  M41cValidationCheck,
} from "@contracts/m41c/governance";
import {
  applyM41cGovernanceAction,
  assertM41cProductionActivationUnavailable,
  createM41cGovernanceRecord,
  createM41cSignedValidationRecord,
  createSyntheticM41cClinicalGovernanceCouncil,
  verifyM41cSignedValidationRecord,
} from "../services/m41c/clinical-governance";
import {
  createSyntheticM41cCompetencyRegistry,
  evaluateM41cCompetencyGate,
} from "../services/m41c/competency-registry";

const checks: readonly M41cValidationCheck[] = Object.freeze([
  Object.freeze({
    checkId: "SYNTH-PREACTIVATION",
    label: "Synthetic pre-activation boundary validation",
    passed: true,
    evidenceIds: Object.freeze(["SYNTH-M41C-EVIDENCE-VALIDATION-001"]),
    notes: Object.freeze(["Synthetic demo only"]),
  }),
]);

function competencyGate() {
  return evaluateM41cCompetencyGate(createSyntheticM41cCompetencyRegistry(), {
    staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    staffRole: "clinical-director",
    requirementIds: Object.freeze(["M41C-COMP-GOVERNANCE-APPROVER"]),
  });
}

function signedValidation(artifactId: string, version = "SYNTH-1.0") {
  return createM41cSignedValidationRecord({
    artifactId,
    artifactKind: "instrument",
    artifactVersion: version,
    checks,
    competencyGate: competencyGate(),
    sourceIds: Object.freeze([
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN",
    ]),
    signatures: Object.freeze([
      Object.freeze({
        signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        signedByRole: "clinical-director" as const,
        signedAt: "2026-11-15T08:01:00.000Z",
        attestation:
          "I reviewed the synthetic validation evidence and approve demo-only evaluation.",
      }),
      Object.freeze({
        signedBy: "SYNTH-HUMAN-BHC-DIRECTOR",
        signedByRole: "bhc-director" as const,
        signedAt: "2026-11-15T08:02:00.000Z",
        attestation:
          "I independently reviewed the synthetic validation evidence and approve demo-only evaluation.",
      }),
    ]),
    recordedAt: "2026-11-15T08:03:00.000Z",
  });
}

function pendingRecord() {
  const record = createM41cGovernanceRecord({
    artifactId: "SYNTH-M41C-GOV-INSTRUMENT-STANDIN",
    artifactKind: "instrument",
    title: "Synthetic instrument stand-in",
    version: "SYNTH-1.0",
    ownerRole: "clinical-director",
    sourceIds: Object.freeze([
      "M41C-SRC-CONTROLLING-DOCTRINE",
      "M41C-SRC-SYNTHETIC-INSTRUMENT-STANDIN",
    ]),
  });
  return applyM41cGovernanceAction(record, {
    action: "submit_for_validation",
    decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    decidedByRole: "clinical-director",
    decidedAt: "2026-11-15T08:00:00.000Z",
    rationale: "Submit the bounded synthetic stand-in for council validation.",
  });
}

function approvedRecord() {
  const pending = pendingRecord();
  return applyM41cGovernanceAction(pending, {
    action: "approve_demo",
    decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
    decidedByRole: "clinical-director",
    decidedAt: "2026-11-15T08:04:00.000Z",
    rationale:
      "All synthetic checks, signatures, sources, and competency gates passed.",
    validationRecord: signedValidation(pending.artifactId, pending.version),
  });
}

describe("M4.1C clinical governance lifecycle", () => {
  it("operates a deterministic council with no production activation authority", () => {
    const first = createSyntheticM41cClinicalGovernanceCouncil();
    const second = createSyntheticM41cClinicalGovernanceCouncil();
    expect(second).toEqual(first);
    expect(first.requiredApprovalRoles).toEqual([
      "clinical-director",
      "bhc-director",
    ]);
    expect(first.members.filter((member) => member.voting)).toHaveLength(3);
    expect(first.productionActivationAuthority).toBe(false);
  });

  it("requires pending validation, competency, two accountable signatures, and a human decision", () => {
    const pending = pendingRecord();
    expect(pending.activationState).toBe("validation_pending");
    expect(() =>
      applyM41cGovernanceAction(pending, {
        action: "approve_demo",
        decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        decidedByRole: "clinical-director",
        decidedAt: "2026-11-15T08:04:00.000Z",
        rationale: "Approval without a signed validation record is denied.",
      }),
    ).toThrow("M41C_SIGNED_VALIDATION_REQUIRED");

    const approved = approvedRecord();
    expect(approved).toMatchObject({
      activationState: "demo_approved",
      lifecycleState: "demo_approved",
      productionActivationAvailable: false,
    });
    expect(approved.validationRecord?.productionActivationAuthorized).toBe(
      false,
    );
    expect(approved.decisions.map((decision) => decision.action)).toEqual([
      "submit_for_validation",
      "approve_demo",
    ]);
    expect(
      verifyM41cSignedValidationRecord(approved.validationRecord!),
    ).toEqual([]);
  });

  it("denies model-only decisions and signatures", () => {
    const record = createM41cGovernanceRecord({
      artifactId: "SYNTH-M41C-GOV-MODEL-DENIAL",
      artifactKind: "instrument",
      title: "Model denial test",
      version: "SYNTH-1.0",
      ownerRole: "clinical-director",
      sourceIds: Object.freeze(["M41C-SRC-CONTROLLING-DOCTRINE"]),
    });
    expect(() =>
      applyM41cGovernanceAction(record, {
        action: "submit_for_validation",
        decidedBy: "MODEL-CLINICAL-DIRECTOR",
        decidedByRole: "clinical-director",
        decidedAt: "2026-11-15T08:00:00.000Z",
        rationale: "A model cannot submit or approve clinical governance.",
      }),
    ).toThrow("M41C_MODEL_ONLY_GOVERNANCE_DECISION_DENIED");

    expect(() =>
      createM41cSignedValidationRecord({
        artifactId: record.artifactId,
        artifactKind: record.artifactKind,
        artifactVersion: record.version,
        checks,
        competencyGate: competencyGate(),
        sourceIds: record.sourceIds,
        signatures: Object.freeze([
          Object.freeze({
            signedBy: "MODEL-CLINICAL-DIRECTOR",
            signedByRole: "clinical-director" as const,
            signedAt: "2026-11-15T08:01:00.000Z",
            attestation: "Model-only attestation",
          }),
        ]),
      }),
    ).toThrow("M41C_MODEL_ONLY_VALIDATION_SIGNATURE_DENIED");
  });

  it("rejects tampered, duplicate, out-of-scope, or non-synthetic signatures", () => {
    const valid = signedValidation("SYNTH-M41C-GOV-INSTRUMENT-STANDIN");
    const first = valid.signatures[0];
    const tampered = {
      ...valid,
      validationId: "SYNTH-TAMPERED-VALIDATION-ID",
      signatures: [
        {
          ...first,
          signatureId: "SYNTH-TAMPERED-SIGNATURE-ID",
          attestation: "",
          synthetic: false,
          signedAt: "not-a-time",
        },
        valid.signatures[1],
      ],
    } as unknown as M41cSignedValidationRecord;
    expect(verifyM41cSignedValidationRecord(tampered)).toEqual(
      expect.arrayContaining([
        "M41C_VALIDATION_ID_INVALID",
        `M41C_VALIDATION_SIGNATURE_BOUNDARY_INVALID:${tampered.signatures[0].signatureId}`,
        `M41C_VALIDATION_ATTESTATION_REQUIRED:${tampered.signatures[0].signatureId}`,
        `M41C_VALIDATION_SIGNATURE_TIME_INVALID:${tampered.signatures[0].signatureId}`,
        `M41C_VALIDATION_SIGNATURE_ID_INVALID:${tampered.signatures[0].signatureId}`,
      ]),
    );

    expect(() =>
      createM41cSignedValidationRecord({
        artifactId: "SYNTH-M41C-DUPLICATE-SIGNER",
        artifactKind: "instrument",
        artifactVersion: "SYNTH-1.0",
        checks,
        competencyGate: competencyGate(),
        sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
        signatures: [
          {
            signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
            signedByRole: "clinical-director",
            signedAt: "2026-11-15T08:01:00.000Z",
            attestation: "First signature.",
          },
          {
            signedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
            signedByRole: "clinical-director",
            signedAt: "2026-11-15T08:02:00.000Z",
            attestation: "Duplicate signature.",
          },
        ],
      }),
    ).toThrow("M41C_DUPLICATE_VALIDATION_SIGNER");
  });

  it("supports emergency withdrawal and makes the withdrawal terminal", () => {
    const approved = approvedRecord();
    const withdrawn = applyM41cGovernanceAction(approved, {
      action: "emergency_withdraw",
      decidedBy: "SYNTH-HUMAN-BHC-DIRECTOR",
      decidedByRole: "bhc-director",
      decidedAt: "2026-11-15T09:00:00.000Z",
      rationale:
        "Withdraw immediately while a synthetic safety defect is reviewed.",
      emergencyReason: "SYNTHETIC_SAFETY_DEFECT",
    });
    expect(withdrawn).toMatchObject({
      activationState: "quarantined",
      lifecycleState: "emergency_withdrawn",
      withdrawnAt: "2026-11-15T09:00:00.000Z",
    });
    expect(() =>
      applyM41cGovernanceAction(withdrawn, {
        action: "return_to_draft",
        decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        decidedByRole: "clinical-director",
        decidedAt: "2026-11-15T09:01:00.000Z",
        rationale: "Terminal state cannot be silently reopened.",
      }),
    ).toThrow("M41C_GOVERNANCE_TERMINAL_STATE");
  });

  it("requires a named successor and preserves supersession lineage", () => {
    const approved = approvedRecord();
    expect(() =>
      applyM41cGovernanceAction(approved, {
        action: "supersede",
        decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        decidedByRole: "clinical-director",
        decidedAt: "2026-11-15T10:00:00.000Z",
        rationale: "A named successor is required.",
      }),
    ).toThrow("M41C_SUCCESSOR_ARTIFACT_REQUIRED");
    const superseded = applyM41cGovernanceAction(approved, {
      action: "supersede",
      decidedBy: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
      decidedByRole: "clinical-director",
      decidedAt: "2026-11-15T10:01:00.000Z",
      rationale: "Replace the validated stand-in with a new synthetic version.",
      successorArtifactId: "SYNTH-M41C-GOV-INSTRUMENT-STANDIN-V2",
    });
    expect(superseded).toMatchObject({
      lifecycleState: "superseded",
      activationState: "quarantined",
      supersededBy: "SYNTH-M41C-GOV-INSTRUMENT-STANDIN-V2",
    });
  });

  it("exposes no production activation path", () => {
    expect(assertM41cProductionActivationUnavailable).toThrow(
      "M41C_PRODUCTION_ACTIVATION_UNAVAILABLE",
    );
  });
});
