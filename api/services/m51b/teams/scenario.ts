import type { M51BTeamsScenarioResult } from "../../../../contracts/m51b/teams";
import { M51BTeamsDeliveryOrchestrator } from "./delivery-orchestrator";
import {
  createSyntheticM51BTeamsActor,
  createSyntheticM51BTeamsDestinations,
  createSyntheticM51BTeamsEvent,
  createSyntheticM51BTeamsIdentities,
  M51B_TEAMS_DESTINATION_IDS,
  m51bTeamsActorId,
} from "./fixtures";
import { M51BTeamsRegistry } from "./registry";
import {
  M51BTeamsSyntheticError,
  SyntheticM51BTeamsAdapter,
} from "./synthetic-teams-adapter";
import { deepFreeze, isoAt, parseTeamsTimestamp } from "./support";

export async function runM51BTeamsScenario(): Promise<M51BTeamsScenarioResult> {
  const registry = new M51BTeamsRegistry(
    createSyntheticM51BTeamsDestinations(),
    createSyntheticM51BTeamsIdentities(),
  );
  const adapter = new SyntheticM51BTeamsAdapter();
  const orchestrator = new M51BTeamsDeliveryOrchestrator(registry, adapter);
  const primaryRequest = deepFreeze({
    idempotencyKey: "SYNTH-M51B-TEAMS-IDEMPOTENCY-PRIMARY",
    submittedAt: "2026-07-15T12:00:03.000Z",
    actor: createSyntheticM51BTeamsActor("super-admin"),
    event: createSyntheticM51BTeamsEvent(),
  });
  const primaryDelivery = await orchestrator.deliver(primaryRequest);
  const replayDelivery = await orchestrator.deliver(primaryRequest);
  const primaryAcknowledgement = await orchestrator.acknowledge({
    idempotencyKey: "SYNTH-M51B-TEAMS-ACK-IDEMPOTENCY-PRIMARY",
    deliveryId: primaryDelivery.deliveryId,
    messageId: primaryDelivery.evidence!.messageId,
    acknowledgedAt: isoAt(
      parseTeamsTimestamp(primaryDelivery.evidence!.deliveredAt)! + 15_000,
    ),
    actor: createSyntheticM51BTeamsActor("managing-director"),
  });

  const retryKey = "SYNTH-M51B-TEAMS-IDEMPOTENCY-RETRY";
  adapter.scheduleFaults(retryKey, [
    new M51BTeamsSyntheticError(429, "M51B_TEAMS_SYNTHETIC_THROTTLE", 2_750),
    null,
  ]);
  const retryDelivery = await orchestrator.deliver({
    idempotencyKey: retryKey,
    submittedAt: "2026-07-15T12:02:03.000Z",
    actor: createSyntheticM51BTeamsActor("clinical-director"),
    event: createSyntheticM51BTeamsEvent({
      eventId: "SYNTH-M51B-TEAMS-EVENT-RETRY",
      eventType: "clinical_review_approved",
      occurredAt: "2026-07-15T12:02:00.000Z",
      approvedAt: "2026-07-15T12:02:02.000Z",
      approvalExpiresAt: "2026-07-15T13:02:02.000Z",
      approvedByActorId: m51bTeamsActorId("clinical-director"),
      sourceReference: "SYNTH-M51B-WORK-ITEM-RETRY",
      divisionId: "bhc",
      ownerRole: "clinical-supervisor",
      destinationId: M51B_TEAMS_DESTINATION_IDS.bhcCareCoordination,
      intendedRecipientActorIds: [m51bTeamsActorId("clinical-supervisor")],
    }),
  });
  const outageKey = "SYNTH-M51B-TEAMS-IDEMPOTENCY-PERSISTENT-OUTAGE";
  adapter.scheduleFaults(
    outageKey,
    Array.from(
      { length: 4 },
      () =>
        new M51BTeamsSyntheticError(
          503,
          "M51B_TEAMS_SYNTHETIC_PERSISTENT_OUTAGE",
        ),
    ),
  );
  const persistentOutageDelivery = await orchestrator.deliver({
    idempotencyKey: outageKey,
    submittedAt: "2026-07-15T12:04:03.000Z",
    actor: createSyntheticM51BTeamsActor("super-admin"),
    event: createSyntheticM51BTeamsEvent({
      eventId: "SYNTH-M51B-TEAMS-EVENT-PERSISTENT-OUTAGE",
      occurredAt: "2026-07-15T12:04:00.000Z",
      approvedAt: "2026-07-15T12:04:02.000Z",
      approvalExpiresAt: "2026-07-15T13:04:02.000Z",
      sourceReference: "SYNTH-M51B-WORK-ITEM-PERSISTENT-OUTAGE",
    }),
  });
  const outageRecovery = await orchestrator.recoverDeadLetter({
    deadLetterId: persistentOutageDelivery.deadLetter!.deadLetterId,
    recoveryIdempotencyKey:
      "SYNTH-M51B-TEAMS-IDEMPOTENCY-PERSISTENT-OUTAGE-RECOVERY",
    replayedAt: "2026-07-15T12:04:10.000Z",
    actor: createSyntheticM51BTeamsActor("administrator"),
  });
  const operationalState = orchestrator.getOperationalStateSnapshot();
  const privacyDenial = await orchestrator.deliver({
    idempotencyKey: "SYNTH-M51B-TEAMS-IDEMPOTENCY-PRIVACY-DENIAL",
    submittedAt: "2026-07-15T12:03:03.000Z",
    actor: createSyntheticM51BTeamsActor("super-admin"),
    event: createSyntheticM51BTeamsEvent({
      eventId: "SYNTH-M51B-TEAMS-EVENT-PRIVACY-DENIAL",
      occurredAt: "2026-07-15T12:03:00.000Z",
      approvedAt: "2026-07-15T12:03:02.000Z",
      approvalExpiresAt: "2026-07-15T13:03:02.000Z",
      sourceReference: "SYNTH-M51B-WORK-ITEM-PRIVACY-DENIAL",
      sourceSensitivity: "part2",
    }),
  });
  const metrics = adapter.metrics();
  const assertions = deepFreeze({
    approvedEventDelivered: primaryDelivery.status === "delivered",
    destinationResolved: primaryDelivery.evidence?.destinationResolved === true,
    mentionsValidated: primaryDelivery.evidence?.mentionsValidated === true,
    contentMinimized:
      primaryDelivery.evidence?.contentMinimized === true &&
      primaryDelivery.payload?.freeTextIncluded === false,
    deliveredWithinThirtySeconds:
      primaryDelivery.timing.withinThirtySeconds &&
      retryDelivery.timing.withinThirtySeconds,
    acknowledgementRecorded:
      primaryAcknowledgement.status === "acknowledged" &&
      primaryAcknowledgement.evidence?.withinAcknowledgementWindow === true,
    immutableEvidenceRecorded:
      primaryDelivery.evidence?.immutable === true &&
      Object.isFrozen(primaryDelivery.evidence),
    retryBoundedAndRecovered:
      retryDelivery.status === "delivered" &&
      retryDelivery.attempts.length === 2 &&
      retryDelivery.attempts[0]?.outcome === "retry_scheduled" &&
      persistentOutageDelivery.status === "dead_lettered" &&
      persistentOutageDelivery.attempts.length === 4 &&
      persistentOutageDelivery.deadLetter?.replayEligible === true &&
      persistentOutageDelivery.operationalAlert?.status === "open" &&
      outageRecovery.status === "recovered" &&
      outageRecovery.evidence?.deadLetterId ===
        persistentOutageDelivery.deadLetter?.deadLetterId &&
      outageRecovery.evidence?.resolvedOperationalAlertId ===
        persistentOutageDelivery.operationalAlert?.alertId &&
      operationalState.activeDeadLetters === 0 &&
      operationalState.openAlerts === 0 &&
      operationalState.recoveredDeadLetters === 1 &&
      operationalState.resolvedAlerts === 1 &&
      operationalState.deadLetters[0]?.resolution?.recoveredDeliveryId ===
        outageRecovery.delivery?.deliveryId &&
      operationalState.alerts[0]?.resolution?.recoveredDeliveryId ===
        outageRecovery.delivery?.deliveryId &&
      orchestrator.actualSleepCalls === 0,
    privacyDenied:
      privacyDenial.status === "denied" &&
      privacyDenial.denialCodes.includes(
        "M51B_TEAMS_RESTRICTED_SOURCE_NOTIFICATION_DENIED",
      ),
    idempotentReplay:
      replayDelivery.replayed &&
      replayDelivery.deliveryId === primaryDelivery.deliveryId &&
      replayDelivery.evidence?.messageId === primaryDelivery.evidence?.messageId,
    zeroLiveOperations:
      metrics.liveGraphCalls === 0 &&
      metrics.liveTeamsWrites === 0 &&
      metrics.realNotificationsSent === 0 &&
      metrics.credentialReads === 0,
  });
  return deepFreeze({
    primaryDelivery,
    primaryAcknowledgement,
    retryDelivery,
    persistentOutageDelivery,
    outageRecovery,
    operationalState,
    privacyDenial,
    replayDelivery,
    assertions,
    passed: Object.values(assertions).every(Boolean),
    adapterMetrics: metrics,
    auditEvents: orchestrator.listAuditEvents(),
    synthetic: true,
  });
}
