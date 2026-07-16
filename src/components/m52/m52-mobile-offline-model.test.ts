import { describe, expect, it } from "vitest";
import { M52_APPROVED_WORKFLOW_IDS } from "@contracts/m52/shared";
import {
  M52_APPROVED_OFFLINE_WORKFLOWS,
  M52_MEDICATION_PASS_STEPS,
  M52_MEDICATION_PASS_TARGET_SECONDS,
  advanceM52MedicationPass,
  applyM52MedicationTimingEvidence,
  applyM52ReconciliationEvidence,
  buildM52ExperienceModel,
  captureM52MedicationAttestation,
  completeM52Reconnect,
  createM52MedicationPassScenario,
  currentM52MedicationPassStep,
  m52ApprovedWorkflowSetIsExact,
  m52CurrentStepIsVerified,
  m52MedicationPassCompletedUnderTarget,
  m52MedicationPassHasNoBypassedControls,
  m52ScriptedMedicationPassUnderTarget,
  requestM52ConflictReview,
  runM52MedicationPassScenario,
  setM52ConnectionMode,
  updateM52MedicationOutcome,
  verifyM52MedicationPassControl,
  type M52MedicationPassScenario,
} from "./m52-mobile-offline-model";

function verifyCurrentGate(
  initial: M52MedicationPassScenario,
): M52MedicationPassScenario {
  let scenario = initial;
  const step = currentM52MedicationPassStep(scenario);
  for (const control of step?.controls ?? [])
    scenario = verifyM52MedicationPassControl(scenario, control.id);
  return scenario;
}

describe("M5.2 tablet medication-pass and offline experience model", () => {
  it("presents exactly the four frozen offline-first workflows", () => {
    expect(M52_APPROVED_OFFLINE_WORKFLOWS.map((workflow) => workflow.id)).toEqual(
      M52_APPROVED_WORKFLOW_IDS,
    );
    expect(m52ApprovedWorkflowSetIsExact()).toBe(true);
    expect(M52_APPROVED_OFFLINE_WORKFLOWS).toHaveLength(4);
    expect(M52_APPROVED_OFFLINE_WORKFLOWS[1].description).toContain(
      "safety rounds",
    );
    expect(
      M52_APPROVED_OFFLINE_WORKFLOWS.some(
        (workflow) => workflow.id === ("safety_round" as string),
      ),
    ).toBe(false);
  });

  it("completes the scripted medication pass in 4:13 without claiming measured evidence", () => {
    const result = runM52MedicationPassScenario();

    expect(result.complete).toBe(true);
    expect(result.scriptedElapsedSeconds).toBe(253);
    expect(result.scriptedElapsedSeconds).toBeLessThan(
      M52_MEDICATION_PASS_TARGET_SECONDS,
    );
    expect(result.measuredElapsedSeconds).toBeNull();
    expect(result.completedStepIds).toHaveLength(M52_MEDICATION_PASS_STEPS.length);
    expect(m52ScriptedMedicationPassUnderTarget(result)).toBe(true);
    expect(m52MedicationPassCompletedUnderTarget(result)).toBe(false);
    expect(m52MedicationPassHasNoBypassedControls(result)).toBe(true);
    expect(result.outcome).toBe("administered");
    expect(result.administrationNote).toContain("Synthetic administration");
    expect(result.attestation).toMatchObject({
      signerRole: "Synthetic GRO medication nurse",
      deviceSequence: "SYNTH-M52-DEVICE-SEQ-0001",
    });
    expect(result.syncState).toBe("queued");
    expect(result.queuedRecordCount).toBe(1);
  });

  it("blocks every step until its verification controls are present", () => {
    const initial = createM52MedicationPassScenario();
    expect(m52CurrentStepIsVerified(initial)).toBe(false);
    expect(m52MedicationPassHasNoBypassedControls(initial)).toBe(false);
    expect(() => advanceM52MedicationPass(initial)).toThrow(
      /verification controls.+must pass/i,
    );

    const firstControl = M52_MEDICATION_PASS_STEPS[0].controls[0];
    const partiallyVerified = verifyM52MedicationPassControl(
      initial,
      firstControl.id,
    );
    expect(m52CurrentStepIsVerified(partiallyVerified)).toBe(false);
    expect(() => advanceM52MedicationPass(partiallyVerified)).toThrow();
    const verified = verifyM52MedicationPassControl(
      partiallyVerified,
      M52_MEDICATION_PASS_STEPS[0].controls[1].id,
    );
    expect(m52CurrentStepIsVerified(verified)).toBe(true);
    const advanced = advanceM52MedicationPass(verified);
    expect(advanced.completedStepIds).toEqual(["identity"]);
    expect(advanced.verifiedControlIds).toEqual([
      "session-scope",
      "two-identifiers",
    ]);
    expect(m52MedicationPassHasNoBypassedControls(advanced)).toBe(false);
  });

  it("requires a structured outcome, exception detail, note, and attestation", () => {
    let scenario = createM52MedicationPassScenario();
    while (currentM52MedicationPassStep(scenario)?.id !== "outcome") {
      scenario = verifyCurrentGate(scenario);
      scenario = advanceM52MedicationPass(scenario);
    }

    scenario = updateM52MedicationOutcome(scenario, { outcome: "refused" });
    expect(() =>
      verifyM52MedicationPassControl(scenario, "observed-outcome"),
    ).toThrow(
      /structured inputs/i,
    );
    scenario = updateM52MedicationOutcome(scenario, {
      administrationNote: "Fictional refusal observed.",
    });
    expect(() =>
      verifyM52MedicationPassControl(scenario, "observed-outcome"),
    ).toThrow(
      /structured inputs/i,
    );
    scenario = updateM52MedicationOutcome(scenario, {
      exceptionReason: "Synthetic youth declined the demo dose.",
    });
    scenario = advanceM52MedicationPass(verifyCurrentGate(scenario));
    expect(currentM52MedicationPassStep(scenario)?.id).toBe("attestation");
    expect(() =>
      verifyM52MedicationPassControl(scenario, "review-complete"),
    ).toThrow(
      /structured inputs/i,
    );
    scenario = captureM52MedicationAttestation(scenario);
    scenario = advanceM52MedicationPass(verifyCurrentGate(scenario));
    expect(scenario.complete).toBe(true);
    expect(m52MedicationPassHasNoBypassedControls(scenario)).toBe(true);
  });

  it("rejects incomplete, duplicate, missing, unknown, and unattested control sets", () => {
    const completed = runM52MedicationPassScenario();
    expect(
      m52MedicationPassHasNoBypassedControls({ ...completed, complete: false }),
    ).toBe(false);
    expect(
      m52MedicationPassHasNoBypassedControls({
        ...completed,
        completedStepIds: [...completed.completedStepIds, "identity"],
      }),
    ).toBe(false);
    expect(
      m52MedicationPassHasNoBypassedControls({
        ...completed,
        verifiedControlIds: completed.verifiedControlIds.slice(1),
      }),
    ).toBe(false);
    expect(
      m52MedicationPassHasNoBypassedControls({
        ...completed,
        verifiedControlIds: [
          ...completed.verifiedControlIds.slice(0, -1),
          "unknown-control",
        ],
      }),
    ).toBe(false);
    expect(
      m52MedicationPassHasNoBypassedControls({
        ...completed,
        attestation: null,
      }),
    ).toBe(false);
  });

  it("does not permit mutation during reconnect, conflict, or restricted states", () => {
    for (const mode of ["reconnecting", "conflict", "restricted"] as const) {
      const scenario = createM52MedicationPassScenario(mode);
      expect(() =>
        verifyM52MedicationPassControl(scenario, "session-scope"),
      ).toThrow();
      expect(() => advanceM52MedicationPass(scenario)).toThrow();
    }
  });

  it("keeps reconnect pending until canonical reconciliation evidence is supplied", () => {
    const queued = runM52MedicationPassScenario();
    const reconnecting = setM52ConnectionMode(queued, "reconnecting");
    expect(reconnecting.syncState).toBe("syncing");
    expect(reconnecting.queuedRecordCount).toBe(1);

    const locallyValidated = completeM52Reconnect(reconnecting);
    expect(locallyValidated.connectionMode).toBe("online");
    expect(locallyValidated.syncState).toBe("queued");
    expect(locallyValidated.queuedRecordCount).toBe(1);
    expect(locallyValidated.reconciliationEvidence).toBeNull();

    const reconciled = applyM52ReconciliationEvidence(locallyValidated, {
      evidenceId: "SYNTH-M52-RECON-EVIDENCE-001",
      source: "integrated-scenario",
      verified: true,
      zeroDataLoss: true,
      dataLossCount: 0,
      duplicateCount: 0,
      queueRemaining: 0,
      auditChainValid: true,
    });
    expect(reconciled.syncState).toBe("synced");
    expect(reconciled.queuedRecordCount).toBe(0);
    expect(reconciled.completedStepIds).toEqual(queued.completedStepIds);
    expect(reconciled.verifiedControlIds).toEqual(queued.verifiedControlIds);
  });

  it("can stage a governed review request without locally resolving the conflict", () => {
    const queued = runM52MedicationPassScenario();
    const conflict = setM52ConnectionMode(queued, "conflict");
    expect(conflict.syncState).toBe("conflict");
    expect(conflict.queuedRecordCount).toBe(1);

    const reviewed = requestM52ConflictReview(conflict);
    expect(reviewed.conflictResolution).toBe("governed-review-requested");
    expect(reviewed.connectionMode).toBe("conflict");
    expect(reviewed.syncState).toBe("conflict");
    expect(reviewed.queuedRecordCount).toBe(1);
    expect(reviewed.completedStepIds).toEqual(queued.completedStepIds);
  });

  it("separates scripted duration from supplied timing evidence", () => {
    const scripted = runM52MedicationPassScenario();
    expect(scripted.measuredElapsedSeconds).toBeNull();
    expect(m52MedicationPassCompletedUnderTarget(scripted)).toBe(false);

    const evidenced = applyM52MedicationTimingEvidence(scripted, {
      evidenceId: "SYNTH-M52-TIMING-EVIDENCE-001",
      measuredElapsedSeconds: 271,
      source: "authorized-field-evaluation",
    });
    expect(evidenced.scriptedElapsedSeconds).toBe(253);
    expect(evidenced.measuredElapsedSeconds).toBe(271);
    expect(m52MedicationPassCompletedUnderTarget(evidenced)).toBe(true);
  });

  it("does not fabricate timing, reconciliation, or field-validation evidence", () => {
    const evidence = buildM52ExperienceModel();

    expect(evidence.exactApprovedWorkflowSet).toBe(true);
    expect(evidence.medicationPass).toMatchObject({
      scriptedElapsedSeconds: 253,
      scriptedFormattedElapsed: "4:13",
      scriptedUnderFiveMinutes: true,
      measuredElapsedSeconds: null,
      timingEvidenceSupplied: false,
      completedUnderFiveMinutes: false,
      noVerificationControlBypassed: true,
      verificationGateCount: 11,
      outcome: "administered",
      administrationNoteCaptured: true,
      attestationCaptured: true,
    });
    expect(evidence.reconnect).toMatchObject({
      evidenceSupplied: false,
      dataLossCount: null,
      zeroDataLoss: null,
      passed: false,
      syncState: "queued",
    });
    expect(evidence.fieldUsability).toMatchObject({
      responsiveTabletLayout: true,
      minimumTouchTargetPixels: 48,
      touchTargetsPassed: true,
      keyboardOperable: true,
      screenReaderSemantics: true,
      batteryIndicatorVisible: true,
      validationEvidenceSupplied: false,
      passed: false,
    });
    expect(evidence.fieldUsability.representativeAuthorizedRoleProfiles).toHaveLength(
      4,
    );
    expect(evidence.boundary).toMatchObject({
      evidenceClass: "SYNTHETIC_PROTOTYPE",
      productionRows: 0,
      realPeople: 0,
      realMedicationAdministrations: 0,
      liveExternalCalls: 0,
      deployments: 0,
      githubPushes: 0,
      usesProductionData: false,
    });
  });

  it("reports pass only when independent evidence receipts are supplied", () => {
    const evidence = buildM52ExperienceModel({
      timingEvidence: {
        evidenceId: "SYNTH-M52-TIME-RECEIPT-001",
        measuredElapsedSeconds: 271,
        source: "authorized-field-evaluation",
      },
      reconciliationEvidence: {
        evidenceId: "SYNTH-M52-RECON-RECEIPT-001",
        source: "integrated-scenario",
        verified: true,
        zeroDataLoss: true,
        dataLossCount: 0,
        duplicateCount: 0,
        queueRemaining: 0,
        auditChainValid: true,
      },
      fieldValidationEvidence: {
        evidenceId: "SYNTH-M52-FIELD-RECEIPT-001",
        source: "authorized-field-evaluation",
        representativeAuthorizedRoleCount: 4,
        minimumObservedTouchTargetPixels: 48,
        keyboardOperable: true,
        screenReaderSemantics: true,
        tabletPortraitPassed: true,
        tabletLandscapePassed: true,
        batteryBehaviorPassed: true,
        networkBehaviorPassed: true,
      },
    });
    expect(evidence.medicationPass.completedUnderFiveMinutes).toBe(true);
    expect(evidence.reconnect).toMatchObject({
      evidenceSupplied: true,
      dataLossCount: 0,
      zeroDataLoss: true,
      passed: true,
    });
    expect(evidence.fieldUsability).toMatchObject({
      validationEvidenceSupplied: true,
      passed: true,
    });
  });
});
