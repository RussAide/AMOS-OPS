import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import {
  type M51BSharePointExhaustedFailureRecovery,
  type M51BSharePointWorkflowRequest,
} from "@contracts/m51b/sharepoint";
import type {
  M51BAdapterAttempt,
  M51BReplayAuthorization,
} from "@contracts/m51b/reliability";
import {
  M51B_EVIDENCE_CLASS,
  type M51BAuditEvent,
} from "@contracts/m51b/shared";
import { M51aReconciliationEngine } from "../../m51a/connectors/reconciliation-engine";
import { M51aStableObjectResolver } from "../../m51a/connectors/stable-object-resolver";
import {
  M51aSyntheticMicrosoftError,
  SyntheticM51aMicrosoftAdapter,
} from "../../m51a/connectors/synthetic-microsoft-adapter";
import { M51BReliabilityCoordinator } from "../integration/resilience";
import {
  createM51bSharePointRegistry,
  createM51bSharePointScenarioFixtures,
} from "./fixtures";
import { evaluateM51bSharePointGates } from "./gates";

const RECOVERY_REQUESTED_AT = "2026-07-15T12:03:00.000Z" as const;
const RECOVERY_AUTHORIZED_AT = "2026-07-15T12:04:00.000Z" as const;
const RECOVERY_RECONCILED_AT = "2026-07-15T12:04:05.000Z" as const;
const PERSISTENT_OUTAGE_CODE =
  "M51B_SYNTHETIC_SHAREPOINT_PERSISTENT_OUTAGE" as const;

export interface M51BSharePointRecoveryOptions {
  authorization?: Readonly<M51BReplayAuthorization>;
}

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function channelAuditEvent(input: {
  suffix: string;
  eventType: string;
  occurredAt: string;
  request: M51BSharePointWorkflowRequest;
  idempotencyKey: string;
  outcome: M51BAuditEvent["outcome"];
  reasonCodes: readonly string[];
}): M51BAuditEvent {
  return frozen({
    eventId: `SYNTH-M51B-SP-RECOVERY-AUDIT-${input.suffix}`,
    eventType: input.eventType,
    channel: "sharepoint",
    occurredAt: input.occurredAt,
    actorId: "SYNTH-M51B-ACTOR-MANAGING-DIRECTOR",
    correlationId: input.request.correlationId,
    idempotencyKey: input.idempotencyKey,
    outcome: input.outcome,
    reasonCodes: frozen([...input.reasonCodes]),
    immutable: true,
    evidenceClass: M51B_EVIDENCE_CLASS,
    synthetic: true,
  });
}

function defaultAuthorization(): Readonly<M51BReplayAuthorization> {
  return frozen({
    authorizedBy: "SYNTH-M51B-ACTOR-MANAGING-DIRECTOR",
    authorizedRole: "managing-director",
    authorizedAt: RECOVERY_AUTHORIZED_AT,
    failureCorrected: true,
    privacyAndPermissionRevalidated: true,
    synthetic: true,
  });
}

/**
 * Runs an exhausted-outage drill through the actual synthetic SharePoint
 * adapter callback used for content synchronization. The same callback is
 * first forced through four persistent connector failures and then allowed to
 * perform the governed adapter mutation only after dead-letter authorization.
 */
export function runM51bSharePointExhaustedFailureRecovery(
  options: M51BSharePointRecoveryOptions = {},
): M51BSharePointExhaustedFailureRecovery {
  const fixture = createM51bSharePointScenarioFixtures();
  const { connector, actor, request, initialTarget, desiredSource } = fixture;
  const resolver = new M51aStableObjectResolver();
  resolver.bind(initialTarget, request.requestedAt);

  const recoveryGateDecision = evaluateM51bSharePointGates({
    request,
    connector,
    actor,
    item: initialTarget,
    resolver,
  });
  if (!recoveryGateDecision.allowed) {
    throw new Error(
      `M51B_SHAREPOINT_RECOVERY_GATE_FAILED:${recoveryGateDecision.reasonCodes.join(",")}`,
    );
  }

  const adapter = new SyntheticM51aMicrosoftAdapter(
    createM51bSharePointRegistry(),
    [initialTarget],
  );
  const coordinator = new M51BReliabilityCoordinator();
  const reliabilityRequest = frozen({
    operationId: "SYNTH-M51B-SP-RECOVERY-OPERATION-001",
    channel: "sharepoint" as const,
    correlationId: request.correlationId,
    idempotencyKey: "SYNTH-M51B-SP-RECOVERY-IDEMPOTENCY-001",
    actorId: "SYNTH-M51B-ACTOR-MANAGING-DIRECTOR",
    payloadFingerprint: "SYNTH-M51B-SHA256-SHAREPOINT-RECOVERY-CONTENT",
    requestedAt: RECOVERY_REQUESTED_AT,
    synthetic: true as const,
  });

  const executeSharePointChannelAttempt = (
    outageActive: boolean,
  ): M51BAdapterAttempt<M51aMicrosoftItemSnapshot> => {
    try {
      if (outageActive) {
        throw new M51aSyntheticMicrosoftError(503, PERSISTENT_OUTAGE_CODE);
      }
      return {
        ok: true,
        value: adapter.applySyntheticContentUpdate({
          stableObjectId: request.stableObjectId,
          expectedETag: request.expectedETag,
          contentHash: request.contentHash,
          modifiedAt: request.targetCompletionAt,
        }),
      };
    } catch (error) {
      if (error instanceof M51aSyntheticMicrosoftError) {
        return {
          ok: false,
          failureClass:
            error.status === 429 ? "throttle" : error.status === 503 ? "transient" : "validation",
          reasonCode: error.code,
        };
      }
      throw error;
    }
  };

  const originalFailure = coordinator.execute(reliabilityRequest, () =>
    executeSharePointChannelAttempt(true),
  );
  if (
    originalFailure.status !== "dead_lettered" ||
    !originalFailure.deadLetterId ||
    !originalFailure.alertId
  ) {
    throw new Error("M51B_SHAREPOINT_EXHAUSTED_FAILURE_NOT_DEAD_LETTERED");
  }
  const openedDeadLetter = coordinator.listDeadLetters()[0];
  const operationalAlert = coordinator.listAlerts()[0];
  if (!openedDeadLetter || !operationalAlert) {
    throw new Error("M51B_SHAREPOINT_DEAD_LETTER_ALERT_EVIDENCE_REQUIRED");
  }

  const mutationsBeforeRecovery = adapter.metrics().syntheticMutations;
  const authorization = options.authorization ?? defaultAuthorization();
  const recovery = coordinator.replay(
    originalFailure.deadLetterId,
    authorization,
    () => executeSharePointChannelAttempt(false),
  );
  const mutationsAfterRecovery = adapter.metrics().syntheticMutations;
  if (recovery.status !== "recovered" || !recovery.value) {
    throw new Error("M51B_SHAREPOINT_AUTHORIZED_RECOVERY_REQUIRED");
  }

  const recoveredDeadLetter = coordinator.listDeadLetters()[0];
  if (!recoveredDeadLetter) {
    throw new Error("M51B_SHAREPOINT_RECOVERED_DEAD_LETTER_REQUIRED");
  }
  const duplicateReplay = coordinator.execute<M51aMicrosoftItemSnapshot>(
    {
      ...reliabilityRequest,
      operationId: "SYNTH-M51B-SP-RECOVERY-OPERATION-DUPLICATE-001",
    },
    () => {
      throw new Error("M51B_SHAREPOINT_DUPLICATE_ADAPTER_EXECUTED");
    },
  );
  const mutationsAfterDuplicateReplay = adapter.metrics().syntheticMutations;

  const contentReconciliation = new M51aReconciliationEngine().reconcile({
    connectorId: connector.connectorId,
    source: [desiredSource],
    target: [recovery.value],
    evaluatedAt: RECOVERY_RECONCILED_AT,
  });
  const channelReconciliation = coordinator.reconcile([
    reliabilityRequest.operationId,
  ]);
  const reliabilitySnapshot = coordinator.snapshot();
  const duplicateMutationPrevented =
    duplicateReplay.status === "duplicate_suppressed" &&
    duplicateReplay.duplicateSuppressed &&
    duplicateReplay.replayed &&
    mutationsAfterDuplicateReplay === mutationsAfterRecovery;

  const auditEvents = frozen([
    ...originalFailure.auditEvents,
    channelAuditEvent({
      suffix: "02",
      eventType: "sharepoint_operational_alert_verified",
      occurredAt: RECOVERY_REQUESTED_AT,
      request,
      idempotencyKey: reliabilityRequest.idempotencyKey,
      outcome: "queued",
      reasonCodes: [
        PERSISTENT_OUTAGE_CODE,
        "M51B_SHAREPOINT_OPERATIONAL_ALERT_RAISED",
      ],
    }),
    channelAuditEvent({
      suffix: "03",
      eventType: "sharepoint_recovery_gates_revalidated",
      occurredAt: authorization.authorizedAt,
      request,
      idempotencyKey: reliabilityRequest.idempotencyKey,
      outcome: "accepted",
      reasonCodes: [
        "M51B_SHAREPOINT_PERMISSION_PRIVACY_AND_GOVERNANCE_REVALIDATED",
      ],
    }),
    ...recovery.auditEvents,
    channelAuditEvent({
      suffix: "06",
      eventType: "sharepoint_recovery_reconciled",
      occurredAt: RECOVERY_RECONCILED_AT,
      request,
      idempotencyKey: reliabilityRequest.idempotencyKey,
      outcome: "accepted",
      reasonCodes: ["M51B_SHAREPOINT_RECOVERY_RECONCILIATION_PASSED"],
    }),
    ...duplicateReplay.auditEvents,
  ]);

  const accepted =
    originalFailure.status === "dead_lettered" &&
    originalFailure.attempts.length === reliabilitySnapshot.maximumAttempts &&
    originalFailure.attempts.slice(0, -1).every((attempt) => attempt.retryScheduled) &&
    originalFailure.attempts[originalFailure.attempts.length - 1]
      ?.retryScheduled === false &&
    openedDeadLetter.state === "open" &&
    openedDeadLetter.replayEligible &&
    openedDeadLetter.immutableOriginalFailure &&
    operationalAlert.deadLetterId === openedDeadLetter.deadLetterId &&
    operationalAlert.alertId === originalFailure.alertId &&
    operationalAlert.channel === "sharepoint" &&
    operationalAlert.escalationQueue === "SYNTH-QUEUE-M51B-SHAREPOINT-SUPPORT" &&
    authorization.failureCorrected &&
    authorization.privacyAndPermissionRevalidated &&
    recoveryGateDecision.allowed &&
    recovery.status === "recovered" &&
    recovery.replayed &&
    recoveredDeadLetter.state === "recovered" &&
    recoveredDeadLetter.recoveryOperationId === recovery.operationId &&
    contentReconciliation.passed &&
    contentReconciliation.sourceUnchanged &&
    channelReconciliation.accepted &&
    channelReconciliation.openDeadLetterOperationIds.length === 0 &&
    channelReconciliation.duplicateDeliveries.length === 0 &&
    reliabilitySnapshot.openDeadLetters === 0 &&
    reliabilitySnapshot.recoveredDeadLetters === 1 &&
    reliabilitySnapshot.alertsRaised === 1 &&
    reliabilitySnapshot.duplicateDeliveries === 0 &&
    mutationsBeforeRecovery === 0 &&
    mutationsAfterRecovery === 1 &&
    duplicateMutationPrevented &&
    originalFailure.liveCalls === 0 &&
    recovery.liveCalls === 0 &&
    duplicateReplay.liveCalls === 0 &&
    reliabilitySnapshot.liveCalls === 0 &&
    reliabilitySnapshot.liveWrites === 0;

  return frozen({
    originalFailure,
    openedDeadLetter,
    operationalAlert,
    authorization,
    recoveryGateDecision,
    recovery,
    recoveredDeadLetter,
    duplicateReplay,
    channelReconciliation,
    contentReconciliation,
    reliabilitySnapshot,
    mutationsBeforeRecovery,
    mutationsAfterRecovery,
    mutationsAfterDuplicateReplay,
    duplicateMutationPrevented,
    auditEvents,
    accepted,
    liveGraphCalls: 0,
    liveWrites: 0,
    synthetic: true,
  });
}
