import { describe, expect, it } from "vitest";
import { assertM33SyntheticWrite } from "../../contracts/phase3/m33";
import {
  calculateM33AnnualTrainingHours,
  calculateM33CredentialingDays,
  classifyM33Expiration,
  reconcileM33AnnualTraining,
  runM33SyntheticSuite,
  validateM33CanonicalWorkforce,
} from "../services/m33";

describe("M3.3 deterministic and production-write boundaries", () => {
  it("is byte-for-byte deterministic across fresh runs", () => {
    expect(runM33SyntheticSuite()).toEqual(runM33SyntheticSuite());
  });

  it("blocks every production-class or non-synthetic write", () => {
    expect(() =>
      assertM33SyntheticWrite({
        id: "SYNTH-M33-LIVE-ATTEMPT",
        evidenceClass: "production",
      }),
    ).toThrowError("M33_PRODUCTION_WRITE_BLOCKED");
    expect(() =>
      assertM33SyntheticWrite({
        id: "EMPLOYEE-001",
        evidenceClass: "synthetic_demo",
      }),
    ).toThrowError("M33_NON_SYNTHETIC_ID_BLOCKED");
    expect(() =>
      assertM33SyntheticWrite({
        id: "SYNTH-M33-ALLOWED",
        evidenceClass: "synthetic_demo",
      }),
    ).not.toThrow();

    expect(runM33SyntheticSuite().snapshot.writeBoundary).toMatchObject({
      mode: "evaluation_only",
      productionWritesBlocked: true,
      liveConnectorMutationsBlocked: true,
      allowedEvidenceClass: "synthetic_demo",
    });
  });

  it("rejects role-tier and supervisor hierarchy drift from the canonical registry", () => {
    const workforce = runM33SyntheticSuite().snapshot.workforce;
    expect(() => validateM33CanonicalWorkforce(workforce)).not.toThrow();
    expect(() => validateM33CanonicalWorkforce(workforce.map((record) => (
      record.tier === "T1" ? { ...record, role: "therapist" as const } : record
    )))).toThrowError("M33_ROLE_TIER_MISMATCH:SYNTH-M33-WORKFORCE-T1");
    expect(() => validateM33CanonicalWorkforce(workforce.map((record) => (
      record.tier === "T2"
        ? { ...record, supervisorId: "SYNTH-M33-WORKFORCE-T3" }
        : record
    )))).toThrowError("M33_SUPERVISOR_HIERARCHY_MISMATCH:SYNTH-M33-WORKFORCE-T2");
  });

  it("classifies exact expiration boundaries without time drift", () => {
    const reference = "2026-07-14T13:00:00.000Z";

    expect(
      classifyM33Expiration(reference, "2026-10-13T13:00:00.000Z"),
    ).toEqual({
      daysRemaining: 91,
      threshold: "outside_window",
    });
    expect(
      classifyM33Expiration(reference, "2026-10-12T13:00:00.000Z"),
    ).toEqual({ daysRemaining: 90, threshold: 90 });
    expect(
      classifyM33Expiration(reference, "2026-09-12T13:00:00.000Z"),
    ).toEqual({ daysRemaining: 60, threshold: 60 });
    expect(
      classifyM33Expiration(reference, "2026-08-13T13:00:00.000Z"),
    ).toEqual({ daysRemaining: 30, threshold: 30 });
    expect(
      classifyM33Expiration(reference, "2026-07-13T13:00:00.000Z"),
    ).toEqual({ daysRemaining: -1, threshold: "expired" });
    expect(() => classifyM33Expiration("not-a-date", reference)).toThrowError(
      "M33_INVALID_EXPIRATION_DATE",
    );
  });

  it("enforces the credentialing and annual-training calculation definitions", () => {
    const { snapshot } = runM33SyntheticSuite();

    expect(
      calculateM33CredentialingDays(
        "2026-06-01T14:00:00.000Z",
        "2026-06-30T14:00:00.000Z",
      ),
    ).toBe(29);
    expect(() =>
      calculateM33CredentialingDays(
        "2026-06-30T14:00:00.000Z",
        "2026-06-01T14:00:00.000Z",
      ),
    ).toThrowError("PHASE3_INVALID_DATE_RANGE");
    expect(
      calculateM33AnnualTrainingHours(
        snapshot.trainingEntries,
        "SYNTH-M33-WORKFORCE-T1",
        2026,
      ),
    ).toBe(42);
    const reconciliation = reconcileM33AnnualTraining(
      snapshot.trainingEntries,
      "SYNTH-M33-WORKFORCE-T1",
      2026,
    );
    expect(reconciliation).toMatchObject({
      completedHours: 42,
      includedEntryIds: [
        "SYNTH-M33-TRAINING-T1-1",
        "SYNTH-M33-TRAINING-T1-2",
        "SYNTH-M33-TRAINING-T1-3",
      ],
    });
    expect(
      reconciliation.excludedEntries.map((entry) => entry.reason),
    ).toEqual([
      "duplicate_credit_key",
      "void",
      "future",
      "out_of_period",
      "non_applicable",
      "unverified",
    ]);
    expect(
      calculateM33AnnualTrainingHours(
        snapshot.trainingEntries,
        "SYNTH-M33-WORKFORCE-T1",
        2025,
      ),
    ).toBe(10);
    expect(
      calculateM33AnnualTrainingHours(
        snapshot.trainingEntries.slice(0, 2),
        "SYNTH-M33-WORKFORCE-T1",
        2026,
      ),
    ).toBe(32);
  });
});
