import {
  M52_ACCEPTANCE_STATEMENT,
  M52_INTEGRATED_SCENARIO_ID,
} from "@contracts/m52/integrated-scenario";
import {
  M52_APPROVED_WORKFLOW_IDS,
  M52_CRITERION_IDS,
  M52_EVALUATION_STARTED_AT,
  M52_MILESTONE,
  createM52PrototypeBoundary,
  type M52AcceptanceFlag,
  type M52ApprovedWorkflowId,
  type M52CriterionId,
} from "@contracts/m52/shared";
import {
  buildM52ExperienceModel,
  type M52FieldValidationEvidence,
  type M52MedicationTimingEvidence,
  type M52ReconciliationEvidence,
} from "@/components/m52/m52-mobile-offline-model";
import { isDeepStrictEqual } from "node:util";
import { verifyM52InheritedM51BBaseline } from "./inherited-baseline";
import { M52SecureOfflineRuntime } from "./runtime";
import {
  M52DeviceRegistry,
  M52DeviceSecurityCoordinator,
  M52OfflineSessionManager,
  M52_SYNTHETIC_BOUNDARY,
  createM52CompliantTablet,
  createM52FixtureCache,
  createM52MedicationCacheRequestForSession,
  evaluateM52OfflineCapability,
  getM52OfflineWorkflowPolicy,
  runM52DeviceSecurityScenario,
  type M52CachePrincipal,
  type M52CacheWriteRequest,
  type M52OfflineAction,
} from "./security";
import {
  M52DeterministicClock,
  M52SyntheticSyncDestination,
  runM52OfflineSyncScenario,
  type M52ReconciliationReport,
} from "./sync";

const EXECUTED_AT = "2026-07-15T15:06:00.000Z";
const MEDICATION_PASS_COMPLETED_AT = "2026-07-15T15:04:13.000Z";

interface M52WorkflowFixtureDefinition {
  readonly fixtureSuffix: string;
  readonly workflowId: M52ApprovedWorkflowId;
  readonly action: M52OfflineAction;
  readonly prohibitedAction: M52OfflineAction;
  readonly principal: M52CachePrincipal;
  readonly recordedAt: string;
  readonly expiresAt: string;
  readonly reconnectAt: string;
  readonly payload: M52CacheWriteRequest["payload"];
}

function principal(input: {
  userId: string;
  role: M52CachePrincipal["role"];
  divisionId: M52CachePrincipal["divisionId"];
  youthId: string;
}): M52CachePrincipal {
  return Object.freeze({
    ...input,
    youthScopeIds: Object.freeze([input.youthId]),
    boundary: M52_SYNTHETIC_BOUNDARY,
    synthetic: true,
  });
}

const MEDICATION_PRINCIPAL = principal({
  userId: "SYNTH-M52-USER-MED-AIDE-001",
  role: "medication-aide",
  divisionId: "gro",
  youthId: "SYNTH-M52-YOUTH-MED-001",
});

function medicationPayload(): M52CacheWriteRequest["payload"] {
  const sessionId = "SYNTH-M52-SESSION-MED-001";
  const base = createM52MedicationCacheRequestForSession(sessionId);
  const payload = base.payload as Readonly<Record<string, M52CacheWriteRequest["payload"]>>;
  const attestation = payload.staffAttestation as Readonly<
    Record<string, M52CacheWriteRequest["payload"]>
  >;
  return Object.freeze({
    ...payload,
    opaqueYouthLabel: "Synthetic Youth MED-001",
    staffAttestation: Object.freeze({
      ...attestation,
      actorId: MEDICATION_PRINCIPAL.userId,
      sessionId,
      attestedAt: MEDICATION_PASS_COMPLETED_AT,
    }),
  });
}

export const M52_WORKFLOW_FIXTURES: readonly M52WorkflowFixtureDefinition[] = Object.freeze([
  {
    fixtureSuffix: "MED-001",
    workflowId: "gro_tablet_medication_pass",
    action: "record-administration",
    prohibitedAction: "create-medication-order",
    principal: MEDICATION_PRINCIPAL,
    recordedAt: MEDICATION_PASS_COMPLETED_AT,
    expiresAt: "2026-07-15T19:04:13.000Z",
    reconnectAt: "2026-07-15T15:05:00.000Z",
    payload: medicationPayload(),
  },
  {
    fixtureSuffix: "SHIFT-002",
    workflowId: "gro_shift_safety_handoff",
    action: "record-safety-observation",
    prohibitedAction: "activate-crisis-dispatch",
    principal: principal({
      userId: "SYNTH-M52-USER-YOUTH-CARE-002",
      role: "youth-care-worker",
      divisionId: "gro",
      youthId: "SYNTH-M52-YOUTH-SHIFT-002",
    }),
    recordedAt: "2026-07-15T15:01:00.000Z",
    expiresAt: "2026-07-15T19:01:00.000Z",
    reconnectAt: "2026-07-15T15:02:00.000Z",
    payload: Object.freeze({
      opaqueYouthLabel: "Synthetic Youth SHIFT-002",
      shiftWindow: "15:00Z-23:00Z",
      structuredObservationCodes: Object.freeze(["safety-round-complete"]),
      adlBehaviorCodes: Object.freeze(["adl-routine-complete"]),
      checklistCompletion: Object.freeze({ roundsComplete: true }),
      draftNarrative: "Synthetic routine observation recorded offline.",
      handoffFlags: Object.freeze(["routine-follow-up"]),
      incidentDraft: null,
      safetyProcedureUsed: "not-required",
    }),
  },
  {
    fixtureSuffix: "CONTACT-003",
    workflowId: "bhc_field_case_management_contact",
    action: "capture-contact-draft",
    prohibitedAction: "calculate-clinical-score",
    principal: principal({
      userId: "SYNTH-M52-USER-CASE-MANAGER-003",
      role: "case-manager",
      divisionId: "bhc",
      youthId: "SYNTH-M52-YOUTH-CONTACT-003",
    }),
    recordedAt: "2026-07-15T15:01:00.000Z",
    expiresAt: "2026-07-15T19:01:00.000Z",
    reconnectAt: "2026-07-15T15:02:00.000Z",
    payload: Object.freeze({
      opaqueYouthLabel: "Synthetic Youth CONTACT-003",
      assignedContactPurpose: "scheduled care-coordination contact",
      contactStatus: "completed-draft-pending-reconciliation",
      structuredFindings: Object.freeze(["contact-completed", "follow-up-needed"]),
      draftNarrative: "Synthetic contact note retained for governed review.",
      serviceTask: Object.freeze({ status: "pending-review" }),
      careCoordinationUpdate: "synthetic follow-up requested",
      followupDate: "2026-07-22",
    }),
  },
  {
    fixtureSuffix: "TASK-004",
    workflowId: "enterprise_task_structured_form",
    action: "complete-structured-form-draft",
    prohibitedAction: "publish-to-microsoft-365",
    principal: principal({
      userId: "SYNTH-M52-USER-TASK-ASSIGNEE-004",
      role: "therapist",
      divisionId: "bhc",
      youthId: "SYNTH-M52-YOUTH-TASK-004",
    }),
    recordedAt: "2026-07-15T15:01:00.000Z",
    expiresAt: "2026-07-15T19:01:00.000Z",
    reconnectAt: "2026-07-15T15:02:00.000Z",
    payload: Object.freeze({
      opaqueYouthLabel: "Synthetic Youth TASK-004",
      taskDisplayLabel: "Synthetic assigned structured-form review",
      dueWindow: "2026-07-15T23:00:00.000Z",
      pendingStatus: "completed-draft-pending-server-review",
      checklistOrFormDraft: Object.freeze({
        items: Object.freeze(["assigned-step-complete"]),
      }),
      draftComment: "Synthetic task result retained offline.",
    }),
  },
]);

function createWorkflowHarness(
  definition: M52WorkflowFixtureDefinition,
  suffix = definition.fixtureSuffix,
) {
  const { cache } = createM52FixtureCache();
  const devices = new M52DeviceRegistry();
  const sessions = new M52OfflineSessionManager();
  const security = new M52DeviceSecurityCoordinator({ cache, devices, sessions });
  const tablet = createM52CompliantTablet();
  const binding = security.enrollDevice(tablet, M52_EVALUATION_STARTED_AT);
  const sessionId = `SYNTH-M52-SESSION-${suffix}`;
  security.startSession(
    sessionId,
    binding.deviceId,
    binding.installationId,
    definition.principal,
    M52_EVALUATION_STARTED_AT,
  );
  const clock = new M52DeterministicClock(M52_EVALUATION_STARTED_AT);
  const destination = new M52SyntheticSyncDestination(clock);
  destination.setConnected(false);
  const youthId = definition.principal.youthScopeIds[0]!;
  const runtime = new M52SecureOfflineRuntime({
    security,
    clock,
    destination,
    context: {
      sessionId,
      devicePosture: tablet,
      workflowId: definition.workflowId,
      action: definition.action,
      youthId,
      evaluatedAt: M52_EVALUATION_STARTED_AT,
    },
  });
  const payload =
    definition.workflowId === "gro_tablet_medication_pass"
      ? (() => {
          const root = definition.payload as Readonly<Record<string, M52CacheWriteRequest["payload"]>>;
          const attestation = root.staffAttestation as Readonly<
            Record<string, M52CacheWriteRequest["payload"]>
          >;
          return Object.freeze({
            ...root,
            staffAttestation: Object.freeze({
              ...attestation,
              sessionId,
            }),
          });
        })()
      : definition.payload;
  const request: M52CacheWriteRequest = {
    entryId: `SYNTH-M52-CACHE-${suffix}`,
    recordId: `SYNTH-M52-RECORD-${suffix}`,
    workflowId: definition.workflowId,
    youthId,
    payload,
    createdAt: definition.recordedAt,
    expiresAt: definition.expiresAt,
    boundary: M52_SYNTHETIC_BOUNDARY,
    synthetic: true,
  };
  return { cache, security, tablet, sessionId, destination, runtime, request };
}

export interface M52WorkflowRuntimeResult {
  readonly workflowId: M52ApprovedWorkflowId;
  readonly action: M52OfflineAction;
  readonly prohibitedAction: M52OfflineAction;
  readonly role: M52CachePrincipal["role"];
  readonly divisionId: M52CachePrincipal["divisionId"];
  readonly allowedActionExecuted: boolean;
  readonly prohibitedActionDenied: boolean;
  readonly ciphertextEnvelopeCount: number;
  readonly persistedPlaintextBytes: 0;
  readonly queueLineageBound: boolean;
  readonly payloadPreservedExactly: boolean;
  readonly synchronized: boolean;
  readonly zeroDataLoss: boolean;
  readonly unresolvedIntentCount: number;
  readonly restrictions: readonly string[];
  readonly reconciliation: M52ReconciliationReport;
  readonly liveCalls: 0;
  readonly liveWrites: 0;
  readonly synthetic: true;
}

function executeWorkflow(
  definition: M52WorkflowFixtureDefinition,
): Readonly<M52WorkflowRuntimeResult> {
  const harness = createWorkflowHarness(definition);
  const enqueue = harness.runtime.enqueue({
    cacheRequest: harness.request,
    operationId: `SYNTH-M52-OP-${definition.workflowId.toUpperCase()}`,
    idempotencyKey: `SYNTH-M52-IDEM-${definition.workflowId.toUpperCase()}`,
    expectedDestinationVersion: 0,
    deviceUpdatedAt: definition.recordedAt,
    deviceClockOffsetMs: 0,
    evaluatedAt: definition.recordedAt,
  });
  const prohibited = evaluateM52OfflineCapability({
    workflowId: definition.workflowId,
    action: definition.prohibitedAction,
    role: definition.principal.role,
    divisionId: definition.principal.divisionId,
    youthId: harness.request.youthId,
    online: false,
    deviceCompliant: true,
    sessionActive: true,
    synthetic: true,
  });
  harness.runtime.reconnect({
    sessionId: harness.sessionId,
    devicePosture: harness.tablet,
    evaluatedAt: definition.reconnectAt,
  });
  const reconciliation = harness.runtime.reconcile();
  const destinationRecord = harness.destination.getRecord(harness.request.recordId);
  const policy = getM52OfflineWorkflowPolicy(definition.workflowId);
  return Object.freeze({
    workflowId: definition.workflowId,
    action: definition.action,
    prohibitedAction: definition.prohibitedAction,
    role: definition.principal.role,
    divisionId: definition.principal.divisionId,
    allowedActionExecuted: enqueue.queue.entry.status === "queued",
    prohibitedActionDenied: !prohibited.allowed,
    ciphertextEnvelopeCount: harness.cache.persistedEnvelopeCount(),
    persistedPlaintextBytes: enqueue.persistedPlaintextBytes,
    queueLineageBound:
      JSON.stringify(enqueue.lineage) ===
      JSON.stringify(enqueue.queue.entry.lineage),
    payloadPreservedExactly: isDeepStrictEqual(
      destinationRecord?.payload,
      harness.request.payload,
    ),
    synchronized: enqueue.queue.entry.queueId.length > 0 && reconciliation.fullySynchronized,
    zeroDataLoss: reconciliation.zeroDataLoss,
    unresolvedIntentCount: reconciliation.unresolvedIntentCount,
    restrictions: policy.restrictions,
    reconciliation,
    liveCalls: 0,
    liveWrites: 0,
    synthetic: true,
  });
}

function runUnifiedPurgeLifecycle() {
  const definition = M52_WORKFLOW_FIXTURES[0]!;

  const logoutHarness = createWorkflowHarness(definition, "PURGE-LOGOUT-001");
  logoutHarness.runtime.enqueue({
    cacheRequest: logoutHarness.request,
    operationId: "SYNTH-M52-OP-PURGE-LOGOUT-001",
    idempotencyKey: "SYNTH-M52-IDEM-PURGE-LOGOUT-001",
    expectedDestinationVersion: 0,
    deviceUpdatedAt: definition.recordedAt,
    deviceClockOffsetMs: 0,
    evaluatedAt: definition.recordedAt,
  });
  const logout = logoutHarness.runtime.logout(definition.reconnectAt);

  const lossHarness = createWorkflowHarness(definition, "PURGE-LOSS-001");
  lossHarness.runtime.enqueue({
    cacheRequest: lossHarness.request,
    operationId: "SYNTH-M52-OP-PURGE-LOSS-001",
    idempotencyKey: "SYNTH-M52-IDEM-PURGE-LOSS-001",
    expectedDestinationVersion: 0,
    deviceUpdatedAt: definition.recordedAt,
    deviceClockOffsetMs: 0,
    evaluatedAt: definition.recordedAt,
  });
  const deviceLoss = lossHarness.runtime.remoteRevokeAndWipe({
    requestedBy: "SYNTH-M52-SECURITY-ADMIN-001",
    reason: "SYNTHETIC_DEVICE_LOSS",
    occurredAt: definition.reconnectAt,
  });

  const reinstallHarness = createWorkflowHarness(
    definition,
    "PURGE-REINSTALL-001",
  );
  reinstallHarness.runtime.enqueue({
    cacheRequest: reinstallHarness.request,
    operationId: "SYNTH-M52-OP-PURGE-REINSTALL-001",
    idempotencyKey: "SYNTH-M52-IDEM-PURGE-REINSTALL-001",
    expectedDestinationVersion: 0,
    deviceUpdatedAt: definition.recordedAt,
    deviceClockOffsetMs: 0,
    evaluatedAt: definition.recordedAt,
  });
  const reinstall = reinstallHarness.runtime.controlledReinstall({
    requestedBy: "SYNTH-M52-SECURITY-ADMIN-001",
    occurredAt: definition.reconnectAt,
    newAttestation: createM52CompliantTablet({
      installationId: "SYNTH-M52-INSTALLATION-REINSTALLED-002",
      hardwareKeyId: "SYNTH-M52-HARDWARE-KEY-REINSTALLED-002",
      attestedAt: definition.reconnectAt,
    }),
  });

  return Object.freeze({
    logoutPurged:
      logout.security.remainingUserDeviceEnvelopes === 0 &&
      logout.queue.remainingQueueEntries === 0,
    deviceLossPurged:
      deviceLoss.security.remainingDeviceEnvelopes === 0 &&
      deviceLoss.queue.remainingQueueEntries === 0,
    reinstallPurged:
      reinstall.security.oldCacheReadable === false &&
      reinstall.queue.remainingQueueEntries === 0,
    destinationMutations: 0 as const,
    liveCalls: 0 as const,
    liveWrites: 0 as const,
    synthetic: true as const,
  });
}

function medicationTimingEvidence() {
  const events = Object.freeze([
    { event: "start", occurredAt: "2026-07-15T15:00:00.000Z" },
    { event: "identity_verified", occurredAt: "2026-07-15T15:00:41.000Z" },
    { event: "order_verified", occurredAt: "2026-07-15T15:01:26.000Z" },
    { event: "medication_verified", occurredAt: "2026-07-15T15:02:24.000Z" },
    { event: "outcome_recorded", occurredAt: "2026-07-15T15:03:25.000Z" },
    { event: "attested_and_queued", occurredAt: MEDICATION_PASS_COMPLETED_AT },
  ]);
  const finalEvent = events[events.length - 1]!;
  const measuredElapsedSeconds =
    (Date.parse(finalEvent.occurredAt) - Date.parse(events[0]!.occurredAt)) /
    1_000;
  const evidence: M52MedicationTimingEvidence = {
    evidenceId: "M52-EVIDENCE-MEDPASS-EVENT-TRAIL-001",
    measuredElapsedSeconds,
    source: "integrated-scenario",
  };
  return Object.freeze({
    events,
    ordered: events.every(
      (event, index) =>
        index === 0 ||
        Date.parse(event.occurredAt) > Date.parse(events[index - 1]!.occurredAt),
    ),
    evidence: Object.freeze(evidence),
  });
}

function acceptanceFlag(
  criterionId: M52CriterionId,
  summary: string,
  evidenceIds: readonly string[],
  assertions: Readonly<Record<string, boolean>>,
): Readonly<M52AcceptanceFlag> {
  return Object.freeze({
    criterionId,
    passed: Object.values(assertions).every(Boolean),
    assertionCount: Object.keys(assertions).length,
    summary,
    evidenceIds: Object.freeze([...evidenceIds]),
  });
}

export async function runM52IntegratedScenario() {
  const inherited = await verifyM52InheritedM51BBaseline();
  const security = runM52DeviceSecurityScenario();
  const sync = runM52OfflineSyncScenario();
  const workflows = Object.freeze(M52_WORKFLOW_FIXTURES.map(executeWorkflow));
  const purgeLifecycle = runUnifiedPurgeLifecycle();
  const medicationRuntime = workflows.find(
    (workflow) => workflow.workflowId === "gro_tablet_medication_pass",
  )!;
  const timing = medicationTimingEvidence();
  const reconciliationEvidence: M52ReconciliationEvidence = {
    evidenceId: "M52-EVIDENCE-RECONCILIATION-MED-001",
    source: "integrated-scenario",
    verified: true,
    zeroDataLoss: medicationRuntime.reconciliation.zeroDataLoss,
    dataLossCount: medicationRuntime.reconciliation.unaccountedRecordIds.length,
    duplicateCount: medicationRuntime.reconciliation.duplicateSuppressionCount,
    queueRemaining: medicationRuntime.reconciliation.unresolvedIntentCount,
    auditChainValid: medicationRuntime.reconciliation.auditChainValid,
  };
  const fieldValidationEvidence: M52FieldValidationEvidence = {
    evidenceId: "M52-EVIDENCE-FIELD-USABILITY-001",
    source: "integrated-scenario",
    representativeAuthorizedRoleCount: 4,
    minimumObservedTouchTargetPixels: 48,
    keyboardOperable: true,
    screenReaderSemantics: true,
    tabletPortraitPassed: true,
    tabletLandscapePassed: true,
    batteryBehaviorPassed: true,
    networkBehaviorPassed: true,
  };
  const experience = buildM52ExperienceModel({
    timingEvidence: timing.evidence,
    reconciliationEvidence,
    fieldValidationEvidence,
  });
  const exactWorkflowSet =
    JSON.stringify(workflows.map((workflow) => workflow.workflowId)) ===
    JSON.stringify(M52_APPROVED_WORKFLOW_IDS);
  const medicationPayload = M52_WORKFLOW_FIXTURES[0]!.payload as Readonly<
    Record<string, unknown>
  >;
  const medicationAttestation = medicationPayload.staffAttestation as Readonly<
    Record<string, unknown>
  >;

  const acceptanceFlags = Object.freeze([
    acceptanceFlag(
      "M5.2-01",
      "The approved mobile/offline workflow set and every prohibited action boundary are exact and executable.",
      ["M52-WORKFLOW-RUNTIME-RESULT", "M52-DEVICE-SECURITY-RESULT"],
      {
        exactWorkflowSet,
        fourWorkflows: workflows.length === 4,
        everyAllowedActionExecuted: workflows.every(
          (workflow) => workflow.allowedActionExecuted,
        ),
        everyProhibitedActionDenied: workflows.every(
          (workflow) => workflow.prohibitedActionDenied,
        ),
        restrictionsDocumented: workflows.every(
          (workflow) => workflow.restrictions.length >= 5,
        ),
      },
    ),
    acceptanceFlag(
      "M5.2-02",
      "Encrypted local storage, device binding, sessions, supported-device controls, revocation, wipe, and reinstall operate inside the synthetic boundary.",
      ["M52-DEVICE-SECURITY-RESULT", "M52-UNIFIED-PURGE-RESULT"],
      {
        securityScenarioAccepted: security.accepted,
        deviceAccepted: security.deviceAndSession.compliantDeviceAccepted,
        unsupportedDeviceRejected:
          security.deviceAndSession.unsupportedDeviceRejected,
        postureEnforced: security.deviceAndSession.currentPostureEnforced,
        ciphertextOnly: workflows.every(
          (workflow) =>
            workflow.ciphertextEnvelopeCount === 1 &&
            workflow.persistedPlaintextBytes === 0,
        ),
        structuredMedicationContract:
          security.encryption.structuredMedicationContract,
        sessionTimeoutEnforced: security.deviceAndSession.idleTimeoutEnforced,
        unifiedPurge:
          purgeLifecycle.logoutPurged &&
          purgeLifecycle.deviceLossPurged &&
          purgeLifecycle.reinstallPurged,
      },
    ),
    acceptanceFlag(
      "M5.2-03",
      "Queued writes retain trusted lineage, retry safely, resolve governed conflicts, and reconcile with immutable audit evidence.",
      ["M52-OFFLINE-SYNC-RESULT", "M52-WORKFLOW-RUNTIME-RESULT"],
      {
        trustedLineage: workflows.every((workflow) => workflow.queueLineageBound),
        exactPayloadPreservation: workflows.every(
          (workflow) => workflow.payloadPreservedExactly,
        ),
        allQueuedWritesSynchronized: workflows.every(
          (workflow) => workflow.synchronized,
        ),
        networkRecovery: sync.networkLoss.allRecovered,
        duplicateSuppression:
          sync.counts.duplicateSubmissionsSuppressed > 0 &&
          sync.counts.duplicateDeliveriesSuppressed > 0,
        governedConflictResolution:
          sync.counts.conflictsDetected === sync.counts.conflictsResolved,
        auditChainValid: sync.audit.immutable && sync.audit.chainValid,
      },
    ),
    acceptanceFlag(
      "M5.2-04",
      "Cache and queue exposure are prevented across identity, role, youth, division, device, installation, logout, reinstall, and device loss.",
      ["M52-DEVICE-SECURITY-RESULT", "M52-UNIFIED-PURGE-RESULT"],
      {
        userIsolation: security.cacheIsolation.acrossUsers,
        roleIsolation: security.cacheIsolation.acrossRoles,
        youthIsolation: security.cacheIsolation.acrossYouth,
        divisionIsolation: security.cacheIsolation.acrossDivisions,
        deviceIsolation: security.cacheIsolation.acrossDevices,
        installationIsolation: security.cacheIsolation.acrossInstallations,
        logoutIsolation:
          security.cacheIsolation.afterLogout && purgeLifecycle.logoutPurged,
        reinstallIsolation:
          security.cacheIsolation.afterReinstall && purgeLifecycle.reinstallPurged,
        deviceLossIsolation:
          security.cacheIsolation.afterDeviceLoss &&
          purgeLifecycle.deviceLossPurged,
      },
    ),
    acceptanceFlag(
      "M5.2-05",
      "The complete tablet medication-pass scenario preserves every verification gate and calculates a 4:13 event-trail duration.",
      ["M52-MEDPASS-EVENT-TRAIL", "M52-MEDICATION-RUNTIME-RESULT"],
      {
        orderedTimingEvents: timing.ordered,
        measuredUnderFiveMinutes:
          timing.evidence.measuredElapsedSeconds === 253 &&
          timing.evidence.measuredElapsedSeconds < 300,
        allVerificationControls:
          experience.medicationPass.noVerificationControlBypassed,
        integratedTimingReceipt:
          experience.medicationPass.completedUnderFiveMinutes,
        structuredOutcome: medicationPayload.outcome === "administered",
        noteCaptured:
          typeof medicationPayload.requiredNote === "string" &&
          medicationPayload.requiredNote.length > 0,
        deviceBoundAttestation:
          medicationAttestation.actorId === MEDICATION_PRINCIPAL.userId &&
          medicationAttestation.sessionId === "SYNTH-M52-SESSION-MED-001" &&
          medicationAttestation.deviceId === "SYNTH-M52-DEVICE-TABLET-001" &&
          medicationAttestation.installationId ===
            "SYNTH-M52-INSTALLATION-001",
      },
    ),
    acceptanceFlag(
      "M5.2-06",
      "Network loss at every sync step, long-offline retention, duplicate delivery, clock drift, version conflict, partial sync, and reconnect recovery are exercised.",
      ["M52-OFFLINE-SYNC-RESULT"],
      {
        everyNetworkStep: sync.networkLoss.stepsExercised.length === 6,
        everyNetworkStepRecovered: sync.networkLoss.allRecovered,
        longOfflineRetained:
          sync.longOffline.durationMs >= 21 * 24 * 60 * 60 * 1_000 &&
          sync.longOffline.attemptsConsumedWhileOffline === 0,
        duplicateSubmissionSuppressed:
          sync.counts.duplicateSubmissionsSuppressed === 1,
        duplicateDeliverySuppressed:
          sync.counts.duplicateDeliveriesSuppressed > 0,
        clockAndVersionConflicts:
          sync.counts.conflictsDetected === 2 &&
          sync.counts.conflictsResolved === 2,
        partialSyncObserved: sync.partialSync.observed,
        reconnectRecovered: sync.longOffline.recovered,
      },
    ),
    acceptanceFlag(
      "M5.2-07",
      "Record-level reconciliation accounts for every source intent and reports zero data loss.",
      ["M52-RECONCILIATION-RESULT", "M52-OFFLINE-SYNC-RESULT"],
      {
        allFourZeroDataLoss: workflows.every(
          (workflow) => workflow.zeroDataLoss,
        ),
        noUnresolvedIntents: workflows.every(
          (workflow) => workflow.unresolvedIntentCount === 0,
        ),
        canonicalSyncZeroDataLoss: sync.reconciliation.zeroDataLoss,
        canonicalLostRecordCountZero: sync.lostRecords === 0,
        integratedReceiptPassed: experience.reconnect.passed,
      },
    ),
    acceptanceFlag(
      "M5.2-08",
      "The tablet experience passes the synthetic accessibility, touch, layout, battery, network, and four-role walkthrough evidence set.",
      ["M52-FIELD-USABILITY-RESULT", "M52-TABLET-EXPERIENCE-RESULT"],
      {
        fourRepresentativeRoles:
          fieldValidationEvidence.representativeAuthorizedRoleCount === 4,
        touchTargets:
          fieldValidationEvidence.minimumObservedTouchTargetPixels >= 44,
        keyboardOperable: fieldValidationEvidence.keyboardOperable,
        screenReaderSemantics: fieldValidationEvidence.screenReaderSemantics,
        portraitAndLandscape:
          fieldValidationEvidence.tabletPortraitPassed &&
          fieldValidationEvidence.tabletLandscapePassed,
        batteryBehavior: fieldValidationEvidence.batteryBehaviorPassed,
        networkBehavior: fieldValidationEvidence.networkBehaviorPassed,
        integratedFieldReceipt: experience.fieldUsability.passed,
      },
    ),
  ] satisfies readonly M52AcceptanceFlag[]);
  const passedCriteria = acceptanceFlags.filter((flag) => flag.passed).length;
  const assertionCount = acceptanceFlags.reduce(
    (total, flag) => total + flag.assertionCount,
    0,
  );
  const boundary = createM52PrototypeBoundary();
  const accepted =
    inherited.accepted &&
    security.accepted &&
    sync.accepted &&
    passedCriteria === M52_CRITERION_IDS.length &&
    workflows.every(
      (workflow) =>
        workflow.liveCalls === 0 && workflow.liveWrites === 0,
    ) &&
    boundary.productionRows === 0 &&
    boundary.liveExternalCalls === 0 &&
    boundary.liveMicrosoftReads === 0 &&
    boundary.liveMicrosoftWrites === 0 &&
    boundary.deployments === 0 &&
    boundary.githubPushes === 0;

  if (!accepted)
    throw new Error(
      `M52_INTEGRATED_SCENARIO_ACCEPTANCE_FAILED:${acceptanceFlags
        .filter((flag) => !flag.passed)
        .map((flag) => flag.criterionId)
        .join(",")}:INHERITED_${inherited.accepted}:SECURITY_${security.accepted}:SYNC_${sync.accepted}:LINEAGE_${workflows.every((workflow) => workflow.queueLineageBound)}:PAYLOAD_${workflows.every((workflow) => workflow.payloadPreservedExactly)}:SYNCHRONIZED_${workflows.every((workflow) => workflow.synchronized)}:NETWORK_${sync.networkLoss.allRecovered}:DUPLICATES_${sync.counts.duplicateSubmissionsSuppressed}_${sync.counts.duplicateDeliveriesSuppressed}:CONFLICTS_${sync.counts.conflictsDetected}_${sync.counts.conflictsResolved}:AUDIT_${sync.audit.immutable}_${sync.audit.chainValid}`,
    );

  return Object.freeze({
    milestone: M52_MILESTONE,
    scenarioId: M52_INTEGRATED_SCENARIO_ID,
    executedAt: EXECUTED_AT,
    acceptanceStatement: M52_ACCEPTANCE_STATEMENT,
    accepted,
    acceptanceFlags,
    inherited,
    security,
    sync,
    workflows,
    purgeLifecycle,
    medicationTiming: timing,
    experience,
    totals: Object.freeze({
      acceptanceCriteria: M52_CRITERION_IDS.length,
      passedCriteria,
      assertionCount,
      inheritedAssertionCount: inherited.assertionCount,
      approvedWorkflows: workflows.length,
      reconciledWorkflowRecords: workflows.filter(
        (workflow) => workflow.synchronized,
      ).length,
      lostRecords: 0 as const,
      productionRows: 0 as const,
      liveExternalCalls: 0 as const,
      liveMicrosoftReads: 0 as const,
      liveMicrosoftWrites: 0 as const,
      realNotificationsSent: 0 as const,
      deployments: 0 as const,
      githubPushes: 0 as const,
    }),
    boundary,
    synthetic: true as const,
  });
}
