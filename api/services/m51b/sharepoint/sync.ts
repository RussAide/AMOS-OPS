import type { M51aIdempotentOperationResult } from "@contracts/m51a/connector-reconciliation";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import {
  M51B_SHAREPOINT_MAX_ELAPSED_SECONDS,
  type M51BSharePointOperationSummary,
  type M51BSharePointSyncResult,
} from "@contracts/m51b/sharepoint";
import {
  M51B_EVIDENCE_CLASS,
  createM51BDemoBoundary,
  elapsedSeconds,
  type M51BAuditEvent,
} from "@contracts/m51b/shared";
import { M51aReconciliationEngine } from "../../m51a/connectors/reconciliation-engine";
import { M51aStableObjectResolver } from "../../m51a/connectors/stable-object-resolver";
import { M51aConnectorSyncOrchestrator } from "../../m51a/connectors/sync-orchestrator";
import {
  M51aSyntheticMicrosoftError,
  SyntheticM51aMicrosoftAdapter,
} from "../../m51a/connectors/synthetic-microsoft-adapter";
import {
  createM51bSharePointRegistry,
  createM51bSharePointScenarioFixtures,
} from "./fixtures";
import { evaluateM51bSharePointGates } from "./gates";
import { runM51bSharePointExhaustedFailureRecovery } from "./recovery";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function summary<T>(
  result: M51aIdempotentOperationResult<T>,
): M51BSharePointOperationSummary {
  return frozen({
    operationId: result.operationId,
    status: result.status,
    attempts: result.attempts.length,
    retriesScheduled: result.attempts.filter(
      (attempt) => attempt.outcome === "retry_scheduled",
    ).length,
    replayed: result.replayed,
    errorCode: result.errorCode,
    completedAt: result.completedAt,
    liveGraphCalls: result.liveGraphCalls,
    liveWrites: result.liveWrites,
    synthetic: true,
  });
}

function auditEvent(input: {
  sequence: number;
  eventType: string;
  occurredAt: string;
  correlationId: string;
  idempotencyKey: string;
  outcome: M51BAuditEvent["outcome"];
  reasonCodes: readonly string[];
}): M51BAuditEvent {
  return frozen({
    eventId: `SYNTH-M51B-SP-AUDIT-${String(input.sequence).padStart(2, "0")}`,
    eventType: input.eventType,
    channel: "sharepoint",
    occurredAt: input.occurredAt,
    actorId: "SYNTH-M51B-ACTOR-MANAGING-DIRECTOR",
    correlationId: input.correlationId,
    idempotencyKey: input.idempotencyKey,
    outcome: input.outcome,
    reasonCodes: frozen([...input.reasonCodes]),
    immutable: true,
    evidenceClass: M51B_EVIDENCE_CLASS,
    synthetic: true,
  });
}

/**
 * Executes the approved SharePoint synchronization entirely against the
 * deterministic synthetic M5.1A adapter. No Microsoft credential, Graph call,
 * real file read, or live write is available on this path.
 */
export async function runM51bApprovedSharePointSync(): Promise<M51BSharePointSyncResult> {
  const fixture = createM51bSharePointScenarioFixtures();
  const { connector, actor, request, initialTarget, desiredSource } = fixture;
  const resolver = new M51aStableObjectResolver();
  resolver.bind(initialTarget, request.requestedAt);
  const gateDecision = evaluateM51bSharePointGates({
    request,
    connector,
    actor,
    item: initialTarget,
    resolver,
  });
  if (!gateDecision.allowed) {
    throw new Error(
      `M51B_SHAREPOINT_APPROVED_GATE_FAILED:${gateDecision.reasonCodes.join(",")}`,
    );
  }

  const adapter = new SyntheticM51aMicrosoftAdapter(
    createM51bSharePointRegistry(),
    [initialTarget],
  );
  const orchestrator = new M51aConnectorSyncOrchestrator({
    repositories: createM51bSharePointRegistry(),
    adapter,
  });

  const staleConflict = await orchestrator.executeIdempotent({
    idempotencyKey: "SYNTH-M51B-IDEMPOTENCY-SHAREPOINT-STALE-001",
    requestFingerprint: `${request.stableObjectId}|stale-etag|${request.contentHash}`,
    connectorId: connector.connectorId,
    operation: request.operation,
    requestedAt: request.requestedAt,
  }, () => adapter.applySyntheticContentUpdate({
    stableObjectId: request.stableObjectId,
    expectedETag: `"SYNTH-M51B-STALE-ETAG"`,
    contentHash: request.contentHash,
    modifiedAt: request.targetCompletionAt,
  }));

  const deliveryRequest = {
    idempotencyKey: request.idempotencyKey,
    requestFingerprint: `${request.stableObjectId}|${request.expectedETag}|${request.contentHash}`,
    connectorId: connector.connectorId,
    operation: request.operation,
    requestedAt: request.requestedAt,
  } as const;
  const delivery = await orchestrator.executeIdempotent(
    deliveryRequest,
    (attempt) => {
      if (attempt === 1) {
        throw new M51aSyntheticMicrosoftError(
          503,
          "M51B_SYNTHETIC_SHAREPOINT_OUTAGE",
        );
      }
      return adapter.applySyntheticContentUpdate({
        stableObjectId: request.stableObjectId,
        expectedETag: request.expectedETag,
        contentHash: request.contentHash,
        modifiedAt: request.targetCompletionAt,
      });
    },
  );
  if (delivery.status !== "succeeded" || !delivery.value) {
    throw new Error("M51B_SHAREPOINT_DELIVERY_RECOVERY_REQUIRED");
  }
  const finalTarget = delivery.value as M51aMicrosoftItemSnapshot;
  const mutationsBeforeReplay = adapter.metrics().syntheticMutations;
  const replay = await orchestrator.executeIdempotent(
    deliveryRequest,
    () => {
      throw new Error("M51B_IDEMPOTENT_REPLAY_EXECUTED_UNEXPECTEDLY");
    },
  );
  const mutationsAfterReplay = adapter.metrics().syntheticMutations;

  const stableMapping = resolver.observe(
    request.stableObjectId,
    finalTarget,
    request.targetCompletionAt,
  );
  const resolvedBinding = resolver.resolve(request.stableObjectId);
  const reconciliation = new M51aReconciliationEngine().reconcile({
    connectorId: connector.connectorId,
    source: [desiredSource],
    target: [finalTarget],
    evaluatedAt: request.targetCompletionAt,
  });
  const checkpointResult = await orchestrator.runControlledFullResync({
    connectorId: connector.connectorId,
    idempotencyKey: "SYNTH-M51B-IDEMPOTENCY-SHAREPOINT-CHECKPOINT-001",
    requestFingerprint: `${request.stableObjectId}|checkpoint|${finalTarget.eTag}`,
    requestedAt: request.targetCompletionAt,
  });
  if (checkpointResult.status !== "succeeded" || !checkpointResult.value) {
    throw new Error("M51B_SHAREPOINT_CHECKPOINT_RECONCILIATION_REQUIRED");
  }
  const checkpoint = checkpointResult.value.checkpoint;
  const boundary = createM51BDemoBoundary();
  const duration = elapsedSeconds(
    request.requestedAt,
    request.targetCompletionAt,
  );
  const adapterMetrics = adapter.metrics();
  const exhaustedFailureRecovery =
    runM51bSharePointExhaustedFailureRecovery();

  const auditEvents = frozen([
    auditEvent({
      sequence: 1,
      eventType: "sharepoint_governance_gates_evaluated",
      occurredAt: request.requestedAt,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      outcome: "accepted",
      reasonCodes: gateDecision.reasonCodes,
    }),
    auditEvent({
      sequence: 2,
      eventType: "sharepoint_stale_etag_conflict_detected",
      occurredAt: staleConflict.completedAt,
      correlationId: request.correlationId,
      idempotencyKey: staleConflict.idempotencyKey,
      outcome: "failed",
      reasonCodes: [staleConflict.errorCode ?? "M51A_ETAG_PRECONDITION_FAILED"],
    }),
    auditEvent({
      sequence: 3,
      eventType: "sharepoint_outage_retry_scheduled",
      occurredAt: delivery.attempts[0]?.completedAt ?? request.requestedAt,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      outcome: "queued",
      reasonCodes: ["M51B_SYNTHETIC_SHAREPOINT_OUTAGE"],
    }),
    auditEvent({
      sequence: 4,
      eventType: "sharepoint_approved_content_delivered",
      occurredAt: request.targetCompletionAt,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      outcome: "delivered",
      reasonCodes: ["M51B_SHAREPOINT_APPROVED_CONTENT_SYNCHRONIZED"],
    }),
    auditEvent({
      sequence: 5,
      eventType: "sharepoint_idempotent_replay_prevented",
      occurredAt: request.targetCompletionAt,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      outcome: "recovered",
      reasonCodes: ["M51B_SHAREPOINT_DUPLICATE_MUTATION_PREVENTED"],
    }),
    auditEvent({
      sequence: 6,
      eventType: "sharepoint_source_target_reconciled",
      occurredAt: request.targetCompletionAt,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      outcome: "accepted",
      reasonCodes: ["M51B_SHAREPOINT_RECONCILIATION_PASSED"],
    }),
    auditEvent({
      sequence: 7,
      eventType: "sharepoint_checkpoint_recorded",
      occurredAt: checkpoint.reconciledAt,
      correlationId: request.correlationId,
      idempotencyKey: checkpointResult.idempotencyKey,
      outcome: "accepted",
      reasonCodes: ["M51B_SHAREPOINT_SYNTHETIC_CHECKPOINT_READY"],
    }),
    auditEvent({
      sequence: 8,
      eventType: "sharepoint_synthetic_boundary_verified",
      occurredAt: request.targetCompletionAt,
      correlationId: request.correlationId,
      idempotencyKey: request.idempotencyKey,
      outcome: "accepted",
      reasonCodes: ["M51B_ZERO_LIVE_MICROSOFT_ACTIVITY"],
    }),
    ...exhaustedFailureRecovery.auditEvents,
  ]);

  const withinElapsedLimit =
    Number.isFinite(duration) &&
    duration <= M51B_SHAREPOINT_MAX_ELAPSED_SECONDS;
  const accepted =
    gateDecision.allowed &&
    staleConflict.status === "conflict" &&
    staleConflict.errorCode === "M51A_ETAG_PRECONDITION_FAILED" &&
    delivery.status === "succeeded" &&
    delivery.attempts.length === 2 &&
    delivery.attempts[0]?.outcome === "retry_scheduled" &&
    replay.status === "succeeded" &&
    replay.replayed &&
    replay.operationId === delivery.operationId &&
    mutationsBeforeReplay === mutationsAfterReplay &&
    adapterMetrics.syntheticMutations === 1 &&
    reconciliation.passed &&
    reconciliation.sourceUnchanged &&
    checkpointResult.value.report.passed &&
    checkpoint.itemCount === 1 &&
    stableMapping.sourceOfTruth === "AMOS-DMS" &&
    stableMapping.bindingHistory.length === 2 &&
    resolvedBinding.eTag === finalTarget.eTag &&
    resolver.validate().length === 0 &&
    exhaustedFailureRecovery.accepted &&
    exhaustedFailureRecovery.originalFailure.status === "dead_lettered" &&
    exhaustedFailureRecovery.recovery.status === "recovered" &&
    exhaustedFailureRecovery.duplicateMutationPrevented &&
    exhaustedFailureRecovery.contentReconciliation.passed &&
    exhaustedFailureRecovery.channelReconciliation.accepted &&
    exhaustedFailureRecovery.reliabilitySnapshot.openDeadLetters === 0 &&
    exhaustedFailureRecovery.reliabilitySnapshot.duplicateDeliveries === 0 &&
    withinElapsedLimit &&
    boundary.liveGraphCalls === 0 &&
    boundary.liveMicrosoftReads === 0 &&
    boundary.liveMicrosoftWrites === 0 &&
    boundary.liveWrites === 0 &&
    !boundary.realDataUsed &&
    !boundary.realFileContentRead &&
    adapterMetrics.liveGraphCalls === 0 &&
    adapterMetrics.liveWrites === 0 &&
    adapterMetrics.credentialReads === 0;

  return frozen({
    workflowId: request.workflowId,
    correlationId: request.correlationId,
    connectorId: connector.connectorId,
    stableObjectId: request.stableObjectId,
    startedAt: request.requestedAt,
    completedAt: request.targetCompletionAt,
    elapsedSeconds: duration,
    maximumElapsedSeconds: M51B_SHAREPOINT_MAX_ELAPSED_SECONDS,
    withinElapsedLimit,
    gateDecision,
    initialTarget,
    desiredSource,
    finalTarget,
    stableMapping,
    resolvedBinding,
    staleVersionConflict: summary(staleConflict),
    delivery: summary(delivery),
    replay: summary(replay),
    exhaustedFailureRecovery,
    reconciliation,
    checkpoint,
    auditEvents,
    adapterMetrics,
    boundary,
    accepted,
    productionRows: 0,
    liveGraphCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    liveWrites: 0,
    realDataUsed: false,
    realFileContentRead: false,
    synthetic: true,
  });
}
