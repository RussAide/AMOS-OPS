import { describe, expect, it } from "vitest";
import { M22DomainError } from "@contracts/mhtcm";
import {
  M22_SCENARIO_ACTORS,
  M22_SCENARIO_DOCUMENTATION,
  M22_SCENARIO_IDS,
  runM22RepresentativeScenario,
  seedM22CaseThroughEncounter,
} from "../services/mhtcm";

describe("M2.2 T1017 billing and amendment gates", () => {
  it("hands off only the exact signed current revision after a READY decision", () => {
    const result = runM22RepresentativeScenario();
    expect(result.billingDecision.result).toMatchObject({
      decision: "READY",
      billingReady: true,
      reasonCodes: [],
      encounter: {
        procedureCode: "T1017",
        calculatedUnits: 2,
        normalizedModifiers: ["HA", "TF"],
      },
    });
    expect(result.claimHandoff).toMatchObject({
      encounterRevision: 4,
      status: "ready_for_revenue",
      units: 2,
    });
    expect(result.snapshot.authorization?.usedUnits).toBe(2);
  });

  it("keeps every note version and never overwrites the signed original", () => {
    const encounter = runM22RepresentativeScenario().snapshot.encounters[0];
    expect(
      encounter.revisions.map((revision) => [
        revision.version,
        revision.previousVersion,
        revision.kind,
      ]),
    ).toEqual([
      [1, null, "original"],
      [2, 1, "original"],
      [3, 2, "amendment"],
      [4, 3, "amendment"],
    ]);
    expect(encounter.revisions[1].signedAt).toBe("2026-07-10T10:45:00.000Z");
    expect(encounter.revisions[1].documentation.progress).not.toBe(
      encounter.revisions[3].documentation.progress,
    );
    expect(encounter.revisions[3].signedAt).toBe("2026-07-11T09:05:00.000Z");
  });

  it("fails closed when the current encounter revision is unsigned", () => {
    const engine = seedM22CaseThroughEncounter();
    engine.createEncounter(M22_SCENARIO_ACTORS.caseManager, {
      id: "SYNTH-M22-ENC-UNSIGNED-001",
      caseId: M22_SCENARIO_IDS.caseId,
      providerId: M22_SCENARIO_ACTORS.caseManager.id,
      function: "care_coordination",
      level: "routine",
      modifiers: ["HA", "TF"],
      serviceDate: "2026-07-12",
      startTime: "10:00",
      endTime: "10:30",
      declaredUnits: 2,
      deliveryMode: "in_person",
      setting: "individual",
      continuousContact: true,
      personPresentAwakeParticipating: true,
      collateralContact: false,
      personOrLarPresentForCollateral: false,
      emergentTreatment: false,
      duplicatesAnotherServiceOrDischargeActivity: false,
      documentation: M22_SCENARIO_DOCUMENTATION,
      authoredAt: "2026-07-12T10:35:00.000Z",
      reason: "Create an unsigned negative-path record.",
    });
    const decision = engine.evaluateEncounter(
      M22_SCENARIO_ACTORS.qa,
      "SYNTH-M22-ENC-UNSIGNED-001",
      "2026-07-31T10:00:00.000Z",
    );
    expect(decision.result.billingReady).toBe(false);
    expect(decision.result.reasonCodes).toContain("DOCUMENTATION_INCOMPLETE");
    expect(() =>
      engine.createClaimHandoff(
        M22_SCENARIO_ACTORS.caseManager,
        "SYNTH-M22-ENC-UNSIGNED-001",
        "2026-07-31T10:05:00.000Z",
      ),
    ).toThrowError(M22DomainError);
    expect(
      engine.repository.listClaimHandoffs(M22_SCENARIO_IDS.caseId),
    ).toHaveLength(0);
  });

  it("retains intake in the lifecycle while denying separate T1017 billing", () => {
    const engine = seedM22CaseThroughEncounter();
    engine.createEncounter(M22_SCENARIO_ACTORS.caseManager, {
      id: "SYNTH-M22-ENC-INTAKE-001",
      caseId: M22_SCENARIO_IDS.caseId,
      providerId: M22_SCENARIO_ACTORS.caseManager.id,
      function: "intake_screening",
      level: "routine",
      modifiers: ["HA", "TF"],
      serviceDate: "2026-07-13",
      startTime: "10:00",
      endTime: "10:30",
      declaredUnits: 2,
      deliveryMode: "in_person",
      setting: "individual",
      continuousContact: true,
      personPresentAwakeParticipating: true,
      collateralContact: false,
      personOrLarPresentForCollateral: false,
      emergentTreatment: false,
      duplicatesAnotherServiceOrDischargeActivity: false,
      documentation: M22_SCENARIO_DOCUMENTATION,
      authoredAt: "2026-07-13T10:35:00.000Z",
      reason: "Prove taxonomy inclusion does not imply billability.",
    });
    engine.signEncounter(
      M22_SCENARIO_ACTORS.caseManager,
      "SYNTH-M22-ENC-INTAKE-001",
      1,
      "2026-07-13T10:40:00.000Z",
      "Sign controlled negative-path record.",
    );
    const decision = engine.evaluateEncounter(
      M22_SCENARIO_ACTORS.qa,
      "SYNTH-M22-ENC-INTAKE-001",
      "2026-07-31T10:00:00.000Z",
    );
    expect(decision.result.reasonCodes).toContain(
      "MHTCM_FUNCTION_NOT_SEPARATELY_BILLABLE",
    );
  });
});
