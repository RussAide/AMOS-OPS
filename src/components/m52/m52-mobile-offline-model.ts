import {
  M52_APPROVED_WORKFLOW_IDS,
  createM52PrototypeBoundary,
  type M52ApprovedWorkflowId,
} from "@contracts/m52/shared";

export const M52_SYNTHETIC_BOUNDARY = {
  label: "Synthetic prototype",
  realDataUsed: false,
  liveWrites: 0,
  liveNotifications: 0,
  description:
    "Fictional youth, medication, staff, device, and workflow records only. No live clinical system or Microsoft tenant is contacted.",
} as const;

export const M52_MEDICATION_PASS_TARGET_SECONDS = 5 * 60;

export type M52ConnectionMode =
  | "online"
  | "offline"
  | "reconnecting"
  | "conflict"
  | "restricted";

export type M52SyncState =
  | "current"
  | "queued"
  | "syncing"
  | "synced"
  | "conflict"
  | "restricted";

export interface M52VerificationControl {
  id: string;
  label: string;
  evidence: string;
}

export interface M52MedicationPassStep {
  id: string;
  label: string;
  instruction: string;
  simulatedSeconds: number;
  controls: readonly M52VerificationControl[];
}

export const M52_MEDICATION_PASS_STEPS: readonly M52MedicationPassStep[] = [
  {
    id: "identity",
    label: "Confirm identity",
    instruction:
      "Match the synthetic wristband token and profile photo before opening the order.",
    simulatedSeconds: 41,
    controls: [
      {
        id: "session-scope",
        label: "Authorized nurse scope",
        evidence: "Synthetic role projection and device session are valid.",
      },
      {
        id: "two-identifiers",
        label: "Two identifiers matched",
        evidence: "Demo wristband token and fictional record identifier agree.",
      },
    ],
  },
  {
    id: "order",
    label: "Validate order",
    instruction:
      "Open the signed cache receipt and confirm the active order and administration window.",
    simulatedSeconds: 45,
    controls: [
      {
        id: "signed-order-cache",
        label: "Signed cache receipt valid",
        evidence: "The approved order snapshot has not expired or changed.",
      },
      {
        id: "administration-window",
        label: "Administration window valid",
        evidence: "The fictional dose is due within the displayed demo window.",
      },
    ],
  },
  {
    id: "medication",
    label: "Match medication",
    instruction:
      "Scan the fictional package and complete all five-right and safety checks.",
    simulatedSeconds: 58,
    controls: [
      {
        id: "right-medication",
        label: "Medication matched",
        evidence: "Demo package MED-A matches the selected synthetic order.",
      },
      {
        id: "right-dose-route-time",
        label: "Dose, route, and time matched",
        evidence: "All displayed administration attributes agree.",
      },
      {
        id: "allergy-interaction-check",
        label: "Safety checks current",
        evidence: "The signed offline safety snapshot reports no demo exception.",
      },
    ],
  },
  {
    id: "outcome",
    label: "Observe and record",
    instruction:
      "Record the fictional administration outcome; exceptions remain available without losing prior checks.",
    simulatedSeconds: 61,
    controls: [
      {
        id: "observed-outcome",
        label: "Outcome observed",
        evidence: "The synthetic dose outcome is explicitly selected.",
      },
      {
        id: "exception-path",
        label: "Exception path available",
        evidence: "Refused, held, and not-given outcomes require a reason.",
      },
    ],
  },
  {
    id: "attestation",
    label: "Attest and queue",
    instruction:
      "Review the complete record, attest locally, and place the encrypted entry in the governed sync queue.",
    simulatedSeconds: 48,
    controls: [
      {
        id: "review-complete",
        label: "Final review complete",
        evidence: "Identity, order, medication, and outcome evidence is present.",
      },
      {
        id: "local-attestation",
        label: "Local attestation captured",
        evidence: "Synthetic signer, device, sequence, and timestamp are bound.",
      },
    ],
  },
] as const;

export const M52_APPROVED_OFFLINE_WORKFLOWS = [
  {
    id: "gro_tablet_medication_pass",
    label: "GRO tablet medication pass",
    description:
      "View the assigned MAR cache; verify youth, medication, time, route, dose, and authorization; record the outcome and queue an immutable event.",
    mode: "Guided write with governed queue",
    restrictions:
      "No medication-order change, first-dose activation, e-prescribing, inventory reconciliation, or controlled-substance waste/witness action.",
  },
  {
    id: "gro_shift_safety_handoff",
    label: "GRO shift safety and handoff",
    description:
      "Record assigned observations, safety rounds, ADL/behavior notes, checklist completion, and handoff drafts.",
    mode: "Checklist + draft + acknowledgement",
    restrictions:
      "Emergency or crisis activity follows approved emergency and supervisory procedures; this queue never implies an alert was delivered.",
  },
  {
    id: "bhc_field_case_management_contact",
    label: "BHC field case-management contact",
    description:
      "View the minimum assigned caseload; capture a contact note, service task, care-coordination update, and follow-up date.",
    mode: "Minimum-necessary case note + follow-up",
    restrictions:
      "No diagnosis, clinical algorithm, score, level-of-care decision, treatment-plan approval, referral acceptance, or discharge finalization.",
  },
  {
    id: "enterprise_task_structured_form",
    label: "Assigned enterprise task and structured form",
    description:
      "View assigned work; complete an approved checklist or form draft; attach an offline note; queue completion.",
    mode: "Assigned task + structured draft",
    restrictions:
      "No administrative configuration, document publication, retention or destruction, billing, claims, payments, or external notifications.",
  },
] as const satisfies readonly {
  id: M52ApprovedWorkflowId;
  label: string;
  description: string;
  mode: string;
  restrictions: string;
}[];

export const M52_DOCUMENTED_OFFLINE_RESTRICTIONS = [
  "Offline capability never expands the signed-in user's online authorization.",
  "Identity, role, permission, device-trust, connector-mode, and administrative changes are prohibited.",
  "Clinical orders, algorithms, scores, level-of-care decisions, approvals, legal signatures, and external notifications are prohibited.",
  "A conflict is never hidden, silently overwritten, or resolved by discarding either version.",
] as const;

export const M52_CONNECTION_PRESENTATION: Readonly<
  Record<
    M52ConnectionMode,
    { label: string; detail: string; syncState: M52SyncState }
  >
> = {
  online: {
    label: "Online",
    detail: "Current governed service is reachable.",
    syncState: "current",
  },
  offline: {
    label: "Offline",
    detail: "Approved workflow data is available from the encrypted demo cache.",
    syncState: "queued",
  },
  reconnecting: {
    label: "Reconnecting",
    detail: "Queued records are being validated before any sync is accepted.",
    syncState: "syncing",
  },
  conflict: {
    label: "Conflict review",
    detail: "A newer server version was detected; silent overwrite is prohibited.",
    syncState: "conflict",
  },
  restricted: {
    label: "Restricted",
    detail: "The signed-in role cannot open or change this workflow.",
    syncState: "restricted",
  },
};

export interface M52MedicationPassScenario {
  scenarioId: "SYNTH-M52-MEDPASS-001";
  syntheticYouthLabel: "Synthetic Youth MP-204";
  syntheticMedicationLabel: "Demo Medication A · 10 mg · oral";
  connectionMode: M52ConnectionMode;
  syncState: M52SyncState;
  stageIndex: number;
  completedStepIds: readonly string[];
  verifiedControlIds: readonly string[];
  scriptedElapsedSeconds: number;
  measuredElapsedSeconds: number | null;
  timingEvidenceId: string | null;
  outcome: "administered" | "refused" | "held" | null;
  exceptionReason: string | null;
  administrationNote: string | null;
  attestation: Readonly<{
    signerRole: "Synthetic GRO medication nurse";
    attestedAt: "2026-07-15T15:04:05.000Z";
    deviceSequence: "SYNTH-M52-DEVICE-SEQ-0001";
  }> | null;
  complete: boolean;
  queuedRecordCount: number;
  conflictResolution: "none" | "governed-review-requested";
  reconciliationEvidence: M52ReconciliationEvidence | null;
}

export interface M52MedicationTimingEvidence {
  evidenceId: string;
  measuredElapsedSeconds: number;
  source: "integrated-scenario" | "authorized-field-evaluation";
}

export interface M52ReconciliationEvidence {
  evidenceId: string;
  source: "integrated-scenario" | "api-receipt";
  verified: true;
  zeroDataLoss: boolean;
  dataLossCount: number;
  duplicateCount: number;
  queueRemaining: number;
  auditChainValid: boolean;
}

export interface M52FieldValidationEvidence {
  evidenceId: string;
  source: "authorized-field-evaluation" | "integrated-scenario";
  representativeAuthorizedRoleCount: number;
  minimumObservedTouchTargetPixels: number;
  keyboardOperable: boolean;
  screenReaderSemantics: boolean;
  tabletPortraitPassed: boolean;
  tabletLandscapePassed: boolean;
  batteryBehaviorPassed: boolean;
  networkBehaviorPassed: boolean;
}

export type M52MedicationOutcomeUpdate = Partial<
  Pick<
    M52MedicationPassScenario,
    "outcome" | "exceptionReason" | "administrationNote"
  >
>;

export function createM52MedicationPassScenario(
  connectionMode: M52ConnectionMode = "offline",
): M52MedicationPassScenario {
  return {
    scenarioId: "SYNTH-M52-MEDPASS-001",
    syntheticYouthLabel: "Synthetic Youth MP-204",
    syntheticMedicationLabel: "Demo Medication A · 10 mg · oral",
    connectionMode,
    syncState:
      connectionMode === "online"
        ? "current"
        : M52_CONNECTION_PRESENTATION[connectionMode].syncState,
    stageIndex: 0,
    completedStepIds: [],
    verifiedControlIds: [],
    scriptedElapsedSeconds: 0,
    measuredElapsedSeconds: null,
    timingEvidenceId: null,
    outcome: null,
    exceptionReason: null,
    administrationNote: null,
    attestation: null,
    complete: false,
    queuedRecordCount: 0,
    conflictResolution: "none",
    reconciliationEvidence: null,
  };
}

export function currentM52MedicationPassStep(
  scenario: M52MedicationPassScenario,
): M52MedicationPassStep | null {
  return M52_MEDICATION_PASS_STEPS[scenario.stageIndex] ?? null;
}

export function m52CurrentStepIsVerified(
  scenario: M52MedicationPassScenario,
): boolean {
  const step = currentM52MedicationPassStep(scenario);
  return (
    step !== null &&
    step.controls.every((control) =>
      scenario.verifiedControlIds.includes(control.id),
    )
  );
}

function assertWorkflowAvailable(scenario: M52MedicationPassScenario): void {
  if (scenario.connectionMode === "restricted")
    throw new Error("The synthetic role is restricted from this workflow.");
  if (scenario.connectionMode === "conflict")
    throw new Error("Resolve the governed version conflict before continuing.");
  if (scenario.connectionMode === "reconnecting")
    throw new Error("Wait for reconnect validation before continuing.");
}

export function m52CurrentStepPrerequisitesMet(
  scenario: M52MedicationPassScenario,
): boolean {
  const step = currentM52MedicationPassStep(scenario);
  if (!step) return false;
  if (step.id === "outcome")
    return (
      scenario.outcome !== null &&
      Boolean(scenario.administrationNote?.trim()) &&
      (scenario.outcome === "administered" ||
        Boolean(scenario.exceptionReason?.trim()))
    );
  if (step.id === "attestation") return scenario.attestation !== null;
  return true;
}

export function updateM52MedicationOutcome(
  scenario: M52MedicationPassScenario,
  update: M52MedicationOutcomeUpdate,
): M52MedicationPassScenario {
  assertWorkflowAvailable(scenario);
  if (currentM52MedicationPassStep(scenario)?.id !== "outcome")
    throw new Error("The structured outcome is available only at the outcome step.");
  const nextOutcome = update.outcome ?? scenario.outcome;
  return {
    ...scenario,
    outcome: nextOutcome,
    exceptionReason:
      nextOutcome === "administered"
        ? null
        : update.exceptionReason === undefined
          ? scenario.exceptionReason
          : update.exceptionReason,
    administrationNote:
      update.administrationNote === undefined
        ? scenario.administrationNote
        : update.administrationNote,
  };
}

export function captureM52MedicationAttestation(
  scenario: M52MedicationPassScenario,
): M52MedicationPassScenario {
  assertWorkflowAvailable(scenario);
  if (currentM52MedicationPassStep(scenario)?.id !== "attestation")
    throw new Error("Attestation is available only at the final review step.");
  return {
    ...scenario,
    attestation: Object.freeze({
      signerRole: "Synthetic GRO medication nurse",
      attestedAt: "2026-07-15T15:04:05.000Z",
      deviceSequence: "SYNTH-M52-DEVICE-SEQ-0001",
    }),
  };
}

export function verifyM52MedicationPassControl(
  scenario: M52MedicationPassScenario,
  controlId: string,
): M52MedicationPassScenario {
  assertWorkflowAvailable(scenario);
  const step = currentM52MedicationPassStep(scenario);
  if (!step || scenario.complete) return scenario;
  if (!m52CurrentStepPrerequisitesMet(scenario))
    throw new Error(
      `Structured inputs for ${step.label} must be complete before verification can run.`,
    );
  if (!step.controls.some((control) => control.id === controlId))
    throw new Error(
      `Control ${controlId} is not part of the current ${step.label} gate.`,
    );
  return {
    ...scenario,
    verifiedControlIds: [
      ...new Set([
        ...scenario.verifiedControlIds,
        controlId,
      ]),
    ],
  };
}

export function advanceM52MedicationPass(
  scenario: M52MedicationPassScenario,
): M52MedicationPassScenario {
  assertWorkflowAvailable(scenario);
  const step = currentM52MedicationPassStep(scenario);
  if (!step || scenario.complete) return scenario;
  if (!m52CurrentStepIsVerified(scenario))
    throw new Error(
      `Verification controls for ${step.label} must pass before the workflow can advance.`,
    );

  const finalStep = scenario.stageIndex === M52_MEDICATION_PASS_STEPS.length - 1;
  const nextQueuedCount = finalStep ? 1 : scenario.queuedRecordCount;
  return {
    ...scenario,
    stageIndex: finalStep ? scenario.stageIndex : scenario.stageIndex + 1,
    completedStepIds: [...scenario.completedStepIds, step.id],
    scriptedElapsedSeconds:
      scenario.scriptedElapsedSeconds + step.simulatedSeconds,
    complete: finalStep,
    queuedRecordCount: nextQueuedCount,
    syncState: nextQueuedCount > 0 ? "queued" : "current",
  };
}

export function setM52ConnectionMode(
  scenario: M52MedicationPassScenario,
  connectionMode: M52ConnectionMode,
): M52MedicationPassScenario {
  const nextSyncState =
    connectionMode === "online"
      ? scenario.reconciliationEvidence?.verified &&
        scenario.reconciliationEvidence.queueRemaining === 0
        ? "synced"
        : scenario.queuedRecordCount > 0
          ? "queued"
          : "current"
      : M52_CONNECTION_PRESENTATION[connectionMode].syncState;
  return {
    ...scenario,
    connectionMode,
    syncState: nextSyncState,
  };
}

export function completeM52Reconnect(
  scenario: M52MedicationPassScenario,
): M52MedicationPassScenario {
  if (scenario.connectionMode !== "reconnecting") return scenario;
  return {
    ...scenario,
    connectionMode: "online",
    syncState: scenario.queuedRecordCount > 0 ? "queued" : "current",
  };
}

export function applyM52ReconciliationEvidence(
  scenario: M52MedicationPassScenario,
  evidence: M52ReconciliationEvidence,
): M52MedicationPassScenario {
  if (!scenario.complete || scenario.queuedRecordCount === 0)
    throw new Error(
      "A completed pending medication event is required before reconciliation evidence can be applied.",
    );
  if (!evidence.evidenceId.trim())
    throw new Error("Reconciliation evidence requires a stable evidence identifier.");
  if (evidence.dataLossCount < 0 || evidence.queueRemaining < 0)
    throw new Error("Reconciliation counts cannot be negative.");
  return {
    ...scenario,
    connectionMode: "online",
    syncState:
      evidence.zeroDataLoss &&
      evidence.dataLossCount === 0 &&
      evidence.queueRemaining === 0 &&
      evidence.auditChainValid
        ? "synced"
        : evidence.queueRemaining > 0
          ? "queued"
          : "conflict",
    queuedRecordCount: evidence.queueRemaining,
    reconciliationEvidence: Object.freeze({ ...evidence }),
  };
}

export function applyM52MedicationTimingEvidence(
  scenario: M52MedicationPassScenario,
  evidence: M52MedicationTimingEvidence,
): M52MedicationPassScenario {
  if (!scenario.complete)
    throw new Error("Timing evidence requires a completed medication-pass scenario.");
  if (!evidence.evidenceId.trim() || evidence.measuredElapsedSeconds <= 0)
    throw new Error("Timing evidence requires a stable ID and positive duration.");
  return {
    ...scenario,
    measuredElapsedSeconds: evidence.measuredElapsedSeconds,
    timingEvidenceId: evidence.evidenceId,
  };
}

export function requestM52ConflictReview(
  scenario: M52MedicationPassScenario,
): M52MedicationPassScenario {
  if (scenario.connectionMode !== "conflict") return scenario;
  return {
    ...scenario,
    conflictResolution: "governed-review-requested",
  };
}

export function m52MedicationPassCompletedUnderTarget(
  scenario: M52MedicationPassScenario,
): boolean {
  return (
    scenario.complete &&
    m52MedicationPassHasNoBypassedControls(scenario) &&
    scenario.measuredElapsedSeconds !== null &&
    scenario.measuredElapsedSeconds > 0 &&
    scenario.measuredElapsedSeconds < M52_MEDICATION_PASS_TARGET_SECONDS &&
    Boolean(scenario.timingEvidenceId)
  );
}

export function m52ScriptedMedicationPassUnderTarget(
  scenario: M52MedicationPassScenario,
): boolean {
  return (
    scenario.complete &&
    m52MedicationPassHasNoBypassedControls(scenario) &&
    scenario.scriptedElapsedSeconds > 0 &&
    scenario.scriptedElapsedSeconds < M52_MEDICATION_PASS_TARGET_SECONDS
  );
}

export function m52MedicationPassHasNoBypassedControls(
  scenario: M52MedicationPassScenario,
): boolean {
  if (!scenario.complete) return false;
  const expectedSteps = M52_MEDICATION_PASS_STEPS.map((step) => step.id);
  const expectedControls = M52_MEDICATION_PASS_STEPS.flatMap((step) =>
    step.controls.map((control) => control.id),
  );
  const exactOrderedSet = (actual: readonly string[], expected: readonly string[]) =>
    actual.length === expected.length &&
    new Set(actual).size === actual.length &&
    actual.every((value, index) => value === expected[index]);
  const outcomeComplete =
    scenario.outcome !== null &&
    Boolean(scenario.administrationNote?.trim()) &&
    (scenario.outcome === "administered" ||
      Boolean(scenario.exceptionReason?.trim()));
  return (
    exactOrderedSet(scenario.completedStepIds, expectedSteps) &&
    exactOrderedSet(scenario.verifiedControlIds, expectedControls) &&
    outcomeComplete &&
    scenario.attestation !== null
  );
}

export function runM52MedicationPassScenario(
  initial = createM52MedicationPassScenario(),
): M52MedicationPassScenario {
  let scenario = initial;
  while (!scenario.complete) {
    const step = currentM52MedicationPassStep(scenario);
    if (step?.id === "outcome")
      scenario = updateM52MedicationOutcome(scenario, {
        outcome: "administered",
        administrationNote:
          "Synthetic administration observed; no fictional exception recorded.",
      });
    if (step?.id === "attestation")
      scenario = captureM52MedicationAttestation(scenario);
    for (const control of step?.controls ?? [])
      scenario = verifyM52MedicationPassControl(scenario, control.id);
    scenario = advanceM52MedicationPass(scenario);
  }
  return scenario;
}

export function formatM52Elapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

export function m52ApprovedWorkflowSetIsExact(): boolean {
  const presented = [...M52_APPROVED_OFFLINE_WORKFLOWS]
    .map((workflow) => workflow.id)
    .sort();
  const controlled = [...M52_APPROVED_WORKFLOW_IDS].sort();
  return (
    presented.length === controlled.length &&
    presented.every((workflowId, index) => workflowId === controlled[index])
  );
}

export function buildM52ExperienceModel(
  input: {
    timingEvidence?: M52MedicationTimingEvidence;
    reconciliationEvidence?: M52ReconciliationEvidence;
    fieldValidationEvidence?: M52FieldValidationEvidence;
  } = {},
) {
  let medicationPass = runM52MedicationPassScenario();
  if (input.timingEvidence)
    medicationPass = applyM52MedicationTimingEvidence(
      medicationPass,
      input.timingEvidence,
    );
  const reconnectStarted = setM52ConnectionMode(
    medicationPass,
    "reconnecting",
  );
  let reconnectCompleted = completeM52Reconnect(reconnectStarted);
  if (input.reconciliationEvidence)
    reconnectCompleted = applyM52ReconciliationEvidence(
      reconnectCompleted,
      input.reconciliationEvidence,
    );
  const fieldEvidence = input.fieldValidationEvidence;
  const fieldValidationPassed = Boolean(
    fieldEvidence &&
      fieldEvidence.representativeAuthorizedRoleCount >= 4 &&
      fieldEvidence.minimumObservedTouchTargetPixels >= 44 &&
      fieldEvidence.keyboardOperable &&
      fieldEvidence.screenReaderSemantics &&
      fieldEvidence.tabletPortraitPassed &&
      fieldEvidence.tabletLandscapePassed &&
      fieldEvidence.batteryBehaviorPassed &&
      fieldEvidence.networkBehaviorPassed,
  );
  return {
    milestone: "M5.2" as const,
    evidenceClass: "SYNTHETIC_PROTOTYPE" as const,
    boundary: createM52PrototypeBoundary(),
    approvedWorkflows: M52_APPROVED_OFFLINE_WORKFLOWS,
    approvedWorkflowIds: M52_APPROVED_OFFLINE_WORKFLOWS.map(
      (workflow) => workflow.id,
    ),
    exactApprovedWorkflowSet: m52ApprovedWorkflowSetIsExact(),
    documentedRestrictions: M52_DOCUMENTED_OFFLINE_RESTRICTIONS,
    medicationPass: {
      scenarioId: medicationPass.scenarioId,
      scriptedElapsedSeconds: medicationPass.scriptedElapsedSeconds,
      scriptedFormattedElapsed: formatM52Elapsed(
        medicationPass.scriptedElapsedSeconds,
      ),
      scriptedUnderFiveMinutes:
        m52ScriptedMedicationPassUnderTarget(medicationPass),
      measuredElapsedSeconds: medicationPass.measuredElapsedSeconds,
      measuredFormattedElapsed:
        medicationPass.measuredElapsedSeconds === null
          ? null
          : formatM52Elapsed(medicationPass.measuredElapsedSeconds),
      timingEvidenceId: medicationPass.timingEvidenceId,
      timingEvidenceSupplied: medicationPass.timingEvidenceId !== null,
      targetSeconds: M52_MEDICATION_PASS_TARGET_SECONDS,
      completedUnderFiveMinutes:
        m52MedicationPassCompletedUnderTarget(medicationPass),
      noVerificationControlBypassed:
        m52MedicationPassHasNoBypassedControls(medicationPass),
      verificationGateCount: M52_MEDICATION_PASS_STEPS.reduce(
        (total, step) => total + step.controls.length,
        0,
      ),
      completedStepCount: medicationPass.completedStepIds.length,
      totalStepCount: M52_MEDICATION_PASS_STEPS.length,
      outcome: medicationPass.outcome,
      administrationNoteCaptured: Boolean(
        medicationPass.administrationNote?.trim(),
      ),
      exceptionReasonRequired:
        medicationPass.outcome === "refused" ||
        medicationPass.outcome === "held",
      exceptionReasonCaptured: Boolean(medicationPass.exceptionReason?.trim()),
      attestationCaptured: medicationPass.attestation !== null,
    },
    reconnect: {
      queuedBeforeReconnect: medicationPass.queuedRecordCount,
      queuedAfterReconnect: reconnectCompleted.queuedRecordCount,
      syncState: reconnectCompleted.syncState,
      evidenceId:
        reconnectCompleted.reconciliationEvidence?.evidenceId ?? null,
      evidenceSupplied:
        reconnectCompleted.reconciliationEvidence?.verified ?? false,
      dataLossCount:
        reconnectCompleted.reconciliationEvidence?.dataLossCount ?? null,
      zeroDataLoss:
        reconnectCompleted.reconciliationEvidence?.zeroDataLoss ?? null,
      passed:
        reconnectCompleted.reconciliationEvidence?.verified === true &&
        reconnectCompleted.reconciliationEvidence.zeroDataLoss &&
        reconnectCompleted.reconciliationEvidence.dataLossCount === 0 &&
        reconnectCompleted.reconciliationEvidence.queueRemaining === 0 &&
        reconnectCompleted.reconciliationEvidence.auditChainValid,
    },
    fieldUsability: {
      tabletLayouts: ["768px portrait", "1024px landscape"] as const,
      responsiveTabletLayout: true,
      minimumTouchTargetPixels: 48,
      touchTargetsPassed: true,
      keyboardOperable: true,
      screenReaderSemantics: true,
      visibleNetworkStates: [
        "online",
        "offline",
        "reconnecting",
        "conflict",
        "restricted",
      ] as const,
      batteryIndicatorVisible: true,
      lowBatteryWarningPercent: 20,
      representativeAuthorizedRoleProfiles: [
        "Synthetic GRO medication nurse",
        "Synthetic GRO shift supervisor",
        "Synthetic BHC field case manager",
        "Synthetic enterprise task assignee",
      ] as const,
      validationEvidenceId: fieldEvidence?.evidenceId ?? null,
      validationEvidenceSupplied: fieldEvidence !== undefined,
      passed: fieldValidationPassed,
    },
  } as const;
}

export type M52ExperienceModel = ReturnType<typeof buildM52ExperienceModel>;
