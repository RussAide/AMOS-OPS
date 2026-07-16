import { M52_APPROVED_WORKFLOW_IDS } from "@contracts/m52/shared";
import { M52DeterministicClock } from "./clock";
import { M52SyntheticSyncDestination } from "./destination";
import { M52OfflineSyncEngine } from "./engine";
import {
  M52_SYNC_STEPS,
  M52_CANONICAL_SYNTHETIC_LINEAGE,
  type M52ApprovedOfflineWorkflow,
  type M52ReconciliationReport,
  type M52SyncRecord,
  type M52SyncStep,
} from "./types";

export interface M52OfflineSyncScenarioResult {
  readonly accepted: boolean;
  readonly approvedWorkflowsExercised: readonly M52ApprovedOfflineWorkflow[];
  readonly counts: Readonly<{
    queued: number;
    delivered: number;
    conflictsDetected: number;
    conflictsResolved: number;
    duplicateSubmissionsSuppressed: number;
    duplicateDeliveriesSuppressed: number;
  }>;
  readonly networkLoss: Readonly<{
    stepsExercised: readonly M52SyncStep[];
    recoveredOperationIds: readonly string[];
    allRecovered: boolean;
  }>;
  readonly longOffline: Readonly<{
    durationMs: number;
    retainedIntentCount: number;
    attemptsConsumedWhileOffline: number;
    recovered: boolean;
  }>;
  readonly partialSync: Readonly<{
    synchronizedBeforeConflictResolution: number;
    conflictsStillHeld: number;
    observed: boolean;
  }>;
  readonly reconciliation: M52ReconciliationReport;
  readonly lostRecords: 0;
  readonly audit: Readonly<{
    eventCount: number;
    immutable: boolean;
    chainValid: boolean;
  }>;
  readonly boundary: Readonly<{
    liveCalls: 0;
    liveWrites: 0;
    liveDeployments: 0;
    realRecords: 0;
    synthetic: true;
  }>;
}

function scenarioRecord(input: {
  recordId: string;
  workflow: M52ApprovedOfflineWorkflow;
  version?: number;
  state?: string;
}): M52SyncRecord {
  return Object.freeze({
    recordId: input.recordId,
    workflow: input.workflow,
    payload: Object.freeze({ state: input.state ?? "baseline" }),
    version: input.version ?? 1,
    updatedAt: "2026-07-15T13:55:00.000Z",
    synthetic: true,
  });
}

/**
 * Runs the canonical M5.2 zero-data-loss demonstration. Every operation is
 * synthetic and in memory; this function has no connector, database, device,
 * notification, deployment, or external-system side effect.
 */
export function runM52OfflineSyncScenario(): M52OfflineSyncScenarioResult {
  const clock = new M52DeterministicClock();
  const networkRecords = M52_SYNC_STEPS.map((_step, index) =>
    scenarioRecord({
      recordId: `SYNTH-M52-RECORD-NETWORK-${String(index + 1).padStart(2, "0")}`,
      workflow:
        M52_APPROVED_WORKFLOW_IDS[
          index % M52_APPROVED_WORKFLOW_IDS.length
        ] ?? "gro_tablet_medication_pass",
    }),
  );
  const versionLocal = scenarioRecord({
    recordId: "SYNTH-M52-RECORD-VERSION-CONFLICT",
    workflow: "gro_shift_safety_handoff",
  });
  const versionDestination = scenarioRecord({
    recordId: versionLocal.recordId,
    workflow: versionLocal.workflow,
    version: 2,
    state: "concurrent-destination-update",
  });
  const clockDriftRecord = scenarioRecord({
    recordId: "SYNTH-M52-RECORD-CLOCK-CONFLICT",
    workflow: "bhc_field_case_management_contact",
  });
  const localRecords = Object.freeze([
    ...networkRecords,
    versionLocal,
    clockDriftRecord,
  ]);
  const destination = new M52SyntheticSyncDestination(clock, [
    ...networkRecords,
    versionDestination,
    clockDriftRecord,
  ]);
  const engine = new M52OfflineSyncEngine({
    clock,
    destination,
    initialLocalRecords: localRecords,
    maximumAttempts: 3,
  });

  const networkRequests = networkRecords.map((record, index) => ({
    operationId: `SYNTH-M52-OP-NETWORK-${String(index + 1).padStart(2, "0")}`,
    idempotencyKey: `SYNTH-M52-IDEM-NETWORK-${String(index + 1).padStart(2, "0")}`,
    recordId: record.recordId,
    workflow: record.workflow,
    payload: Object.freeze({ state: `completed-after-${M52_SYNC_STEPS[index]}` }),
    expectedDestinationVersion: 1,
    deviceUpdatedAt: clock.now(),
    deviceClockOffsetMs: 0,
    lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
  }));
  for (const request of networkRequests) {
    engine.enqueue(request);
  }
  const versionEntry = engine.enqueue({
    operationId: "SYNTH-M52-OP-VERSION-CONFLICT",
    idempotencyKey: "SYNTH-M52-IDEM-VERSION-CONFLICT",
    recordId: versionLocal.recordId,
    workflow: versionLocal.workflow,
    payload: Object.freeze({ state: "authorized-local-update" }),
    expectedDestinationVersion: 1,
    deviceUpdatedAt: clock.now(),
    deviceClockOffsetMs: 0,
    lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
  }).entry;
  const clockEntry = engine.enqueue({
    operationId: "SYNTH-M52-OP-CLOCK-CONFLICT",
    idempotencyKey: "SYNTH-M52-IDEM-CLOCK-CONFLICT",
    recordId: clockDriftRecord.recordId,
    workflow: clockDriftRecord.workflow,
    payload: Object.freeze({ state: "authorized-clock-drift-update" }),
    expectedDestinationVersion: 1,
    deviceUpdatedAt: clock.now(),
    deviceClockOffsetMs: 600_001,
    lineage: M52_CANONICAL_SYNTHETIC_LINEAGE,
  }).entry;
  const duplicateSubmission = engine.enqueue({
    ...networkRequests[0]!,
    operationId: "SYNTH-M52-OP-DUPLICATE-SUBMISSION",
  });

  destination.setConnected(false);
  const attemptsBeforeOfflinePass = engine
    .queueSnapshot()
    .reduce((sum, entry) => sum + entry.lifetimeAttempts, 0);
  const offlinePass = engine.synchronizePass();
  const attemptsAfterOfflinePass = engine
    .queueSnapshot()
    .reduce((sum, entry) => sum + entry.lifetimeAttempts, 0);
  const longOfflineDurationMs = 21 * 24 * 60 * 60 * 1_000;
  clock.advance(longOfflineDurationMs);

  destination.setConnected(true);
  networkRequests.forEach((request, index) => {
    destination.planNetworkLoss(
      request.operationId,
      M52_SYNC_STEPS[index] ?? "connect",
    );
  });
  engine.reconnect();
  clock.advance(1_000);
  engine.synchronizePass();

  const partialStatus = engine.localStatus();
  const conflictCount = partialStatus.conflicts;
  const partialSyncObserved =
    partialStatus.synchronized > 0 && partialStatus.conflicts === 2;
  engine.resolveConflict(versionEntry.queueId, {
    resolution: "keep_local",
    resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
  });
  engine.resolveConflict(clockEntry.queueId, {
    resolution: "keep_local",
    resolvedBy: M52_CANONICAL_SYNTHETIC_LINEAGE.userId,
  });
  engine.reconnect();

  const queue = engine.queueSnapshot();
  const audit = engine.auditHistory();
  const reconciliation = engine.reconcileRecords();
  const recoveredOperationIds = networkRequests
    .filter((request) =>
      queue.some(
        (entry) =>
          entry.operationId === request.operationId &&
          entry.status === "synchronized" &&
          entry.lifetimeAttempts >= 2,
      ),
    )
    .map((request) => request.operationId);
  const duplicateDeliveriesSuppressed = queue.filter(
    (entry) => entry.duplicateDeliverySuppressed,
  ).length;
  const delivered = queue.filter(
    (entry) => entry.status === "synchronized",
  ).length;
  const conflictsResolved = queue.filter(
    (entry) => entry.conflict?.resolved,
  ).length;
  const immutableAudit =
    Object.isFrozen(audit) &&
    audit.every(
      (event) =>
        event.immutable &&
        Object.isFrozen(event) &&
        Object.isFrozen(event.reasonCodes),
    );
  const metrics = destination.metrics();
  const accepted =
    M52_APPROVED_WORKFLOW_IDS.every((workflow) =>
      queue.some((entry) => entry.record.workflow === workflow),
    ) &&
    offlinePass.deferredOffline === queue.length &&
    attemptsAfterOfflinePass - attemptsBeforeOfflinePass === 0 &&
    recoveredOperationIds.length === M52_SYNC_STEPS.length &&
    partialSyncObserved &&
    conflictCount === 2 &&
    conflictsResolved === 2 &&
    duplicateSubmission.duplicateSuppressed &&
    duplicateDeliveriesSuppressed >= 3 &&
    delivered === queue.length &&
    reconciliation.zeroDataLoss &&
    reconciliation.unaccountedRecordIds.length === 0 &&
    immutableAudit &&
    engine.verifyAuditChain() &&
    metrics.liveCalls === 0 &&
    metrics.liveWrites === 0;

  if (!accepted) {
    throw new Error("M52_OFFLINE_SYNC_SCENARIO_ACCEPTANCE_FAILED");
  }

  return Object.freeze({
    accepted,
    approvedWorkflowsExercised: Object.freeze([
      ...M52_APPROVED_WORKFLOW_IDS,
    ]),
    counts: Object.freeze({
      queued: queue.length,
      delivered,
      conflictsDetected: conflictCount,
      conflictsResolved,
      duplicateSubmissionsSuppressed: duplicateSubmission.duplicateSuppressed
        ? 1
        : 0,
      duplicateDeliveriesSuppressed,
    }),
    networkLoss: Object.freeze({
      stepsExercised: Object.freeze([...M52_SYNC_STEPS]),
      recoveredOperationIds: Object.freeze(recoveredOperationIds),
      allRecovered: recoveredOperationIds.length === M52_SYNC_STEPS.length,
    }),
    longOffline: Object.freeze({
      durationMs: longOfflineDurationMs,
      retainedIntentCount: offlinePass.retainedIntentCount,
      attemptsConsumedWhileOffline:
        attemptsAfterOfflinePass - attemptsBeforeOfflinePass,
      recovered: delivered === queue.length,
    }),
    partialSync: Object.freeze({
      synchronizedBeforeConflictResolution: partialStatus.synchronized,
      conflictsStillHeld: partialStatus.conflicts,
      observed: partialSyncObserved,
    }),
    reconciliation,
    lostRecords: 0,
    audit: Object.freeze({
      eventCount: audit.length,
      immutable: immutableAudit,
      chainValid: engine.verifyAuditChain(),
    }),
    boundary: Object.freeze({
      liveCalls: 0,
      liveWrites: 0,
      liveDeployments: 0,
      realRecords: 0,
      synthetic: true,
    }),
  });
}
