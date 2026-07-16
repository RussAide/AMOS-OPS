import { describe, expect, it } from "vitest";
import {
  assertM41cCompetencyGatePassed,
  createSyntheticM41cCompetencyRegistry,
  evaluateM41cCompetencyGate,
  recordM41cCompetencyAttestation,
} from "../services/m41c/competency-registry";

describe("M4.1C pathway and instrument competency gates", () => {
  it("keeps TRR CANS and DFPS CANS 3.0 certification requirements distinct", () => {
    const registry = createSyntheticM41cCompetencyRegistry();
    const trr = registry.requirements.find(
      (requirement) =>
        requirement.requirementId === "M41C-COMP-TRR-CANS-CERTIFICATION",
    );
    const dfps = registry.requirements.find(
      (requirement) =>
        requirement.requirementId === "M41C-COMP-DFPS-CANS-3-CERTIFICATION",
    );
    expect(trr?.certificationType).toBe("TRR_CANS_CURRENT");
    expect(dfps?.certificationType).toBe("DFPS_CANS_3_CURRENT");
    expect(trr?.instrumentProfileIds).toEqual(["M41C-INSTRUMENT-TRR-CANS"]);
    expect(dfps?.instrumentProfileIds).toEqual(["M41C-INSTRUMENT-DFPS-CANS-3"]);
    expect(trr?.requirementId).not.toBe(dfps?.requirementId);
    expect(registry.productionCredentialingAvailable).toBe(false);
  });

  it("passes only current, role-matched, evidenced synthetic competency", () => {
    const gate = evaluateM41cCompetencyGate(
      createSyntheticM41cCompetencyRegistry(),
      {
        staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        staffRole: "clinical-director",
        requirementIds: Object.freeze([
          "M41C-COMP-GOVERNANCE-APPROVER",
          "M41C-COMP-SYNTHETIC-INSTRUMENT-USER",
        ]),
      },
    );
    expect(gate).toMatchObject({
      passedForSyntheticDemo: true,
      productionUseAuthorized: false,
      missingRequirementIds: [],
      expiredRequirementIds: [],
      roleMismatchRequirementIds: [],
    });
    expect(() => assertM41cCompetencyGatePassed(gate)).not.toThrow();
  });

  it("reports missing, expired, and role-mismatched requirements separately", () => {
    const registry = createSyntheticM41cCompetencyRegistry();
    const missing = evaluateM41cCompetencyGate(registry, {
      staffId: "SYNTH-HUMAN-NOT-TRAINED",
      staffRole: "clinical-director",
      requirementIds: Object.freeze(["M41C-COMP-GOVERNANCE-APPROVER"]),
    });
    const expired = evaluateM41cCompetencyGate(registry, {
      staffId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
      staffRole: "clinical-director",
      requirementIds: Object.freeze(["M41C-COMP-SYNTHETIC-INSTRUMENT-USER"]),
      evaluatedAt: "2027-06-01T00:00:00.000Z",
    });
    const roleMismatch = evaluateM41cCompetencyGate(registry, {
      staffId: "SYNTH-HUMAN-BILLER",
      staffRole: "billing-specialist",
      requirementIds: Object.freeze(["M41C-COMP-GOVERNANCE-APPROVER"]),
    });
    expect(missing.missingRequirementIds).toEqual([
      "M41C-COMP-GOVERNANCE-APPROVER",
    ]);
    expect(expired.expiredRequirementIds).toEqual([
      "M41C-COMP-SYNTHETIC-INSTRUMENT-USER",
    ]);
    expect(roleMismatch.roleMismatchRequirementIds).toEqual([
      "M41C-COMP-GOVERNANCE-APPROVER",
    ]);
    expect(() => assertM41cCompetencyGatePassed(missing)).toThrow(
      "M41C_COMPETENCY_GATE_NOT_SATISFIED",
    );
  });

  it("requires external certification evidence for governed CANS requirements", () => {
    const registry = createSyntheticM41cCompetencyRegistry();
    const input = {
      requirementId: "M41C-COMP-TRR-CANS-CERTIFICATION",
      staffId: "SYNTH-HUMAN-QMHP-001",
      staffRole: "qmhp-cs" as const,
      completedAt: "2026-11-01T09:00:00.000Z",
      expiresAt: "2027-11-01T09:00:00.000Z",
      evidenceIds: Object.freeze(["SYNTH-CERT-EVIDENCE-001"]),
      attestedBy: "SYNTH-HUMAN-TRAINING-COORDINATOR",
      attestedByRole: "training-coordinator" as const,
      attestedAt: "2026-11-01T09:05:00.000Z",
    };
    expect(() => recordM41cCompetencyAttestation(registry, input)).toThrow(
      "M41C_EXTERNAL_CERTIFICATION_EVIDENCE_REQUIRED",
    );
    const updated = recordM41cCompetencyAttestation(registry, {
      ...input,
      externalCertificationId: "SYNTH-EXTERNAL-CERT-TRR-001",
    });
    const gate = evaluateM41cCompetencyGate(updated, {
      staffId: input.staffId,
      staffRole: input.staffRole,
      requirementIds: Object.freeze([input.requirementId]),
    });
    expect(gate.passedForSyntheticDemo).toBe(true);
    expect(gate.productionUseAuthorized).toBe(false);
  });

  it("requires supervised-use evidence and a human training attestor", () => {
    const registry = createSyntheticM41cCompetencyRegistry();
    const base = {
      requirementId: "M41C-COMP-SYNTHETIC-INSTRUMENT-USER",
      staffId: "SYNTH-HUMAN-QMHP-002",
      staffRole: "qmhp-cs" as const,
      completedAt: "2026-11-01T09:00:00.000Z",
      expiresAt: "2027-05-01T09:00:00.000Z",
      evidenceIds: Object.freeze(["SYNTH-DEMO-TRAINING-002"]),
      attestedBy: "SYNTH-HUMAN-TRAINING-COORDINATOR",
      attestedByRole: "training-coordinator" as const,
      attestedAt: "2026-11-01T09:05:00.000Z",
    };
    expect(() => recordM41cCompetencyAttestation(registry, base)).toThrow(
      "M41C_SUPERVISED_USE_EVIDENCE_REQUIRED",
    );
    expect(() =>
      recordM41cCompetencyAttestation(registry, {
        ...base,
        supervisedBy: "SYNTH-HUMAN-CLINICAL-SUPERVISOR",
        attestedBy: "MODEL-TRAINER",
      }),
    ).toThrow("M41C_MODEL_ONLY_COMPETENCY_ATTESTATION_DENIED");
  });
});
