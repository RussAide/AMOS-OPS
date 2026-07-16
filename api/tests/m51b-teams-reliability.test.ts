import { describe, expect, it } from "vitest";
import type { M51BTeamsDispatchRequest } from "@contracts/m51b/teams";
import { M51BTeamsDeliveryOrchestrator } from "../services/m51b/teams/delivery-orchestrator";
import {
  createSyntheticM51BTeamsActor,
  createSyntheticM51BTeamsDestinations,
  createSyntheticM51BTeamsEvent,
  createSyntheticM51BTeamsIdentities,
} from "../services/m51b/teams/fixtures";
import { M51BTeamsRegistry } from "../services/m51b/teams/registry";
import {
  classifyM51BTeamsFailure,
  M51BTeamsSyntheticError,
  SyntheticM51BTeamsAdapter,
} from "../services/m51b/teams/synthetic-teams-adapter";
import { isoAt, parseTeamsTimestamp } from "../services/m51b/teams/support";

function foundation(latencyMs = 1_250) {
  const adapter = new SyntheticM51BTeamsAdapter(latencyMs);
  const orchestrator = new M51BTeamsDeliveryOrchestrator(
    new M51BTeamsRegistry(
      createSyntheticM51BTeamsDestinations(),
      createSyntheticM51BTeamsIdentities(),
    ),
    adapter,
  );
  return { adapter, orchestrator };
}

function request(id = "RELIABILITY"): M51BTeamsDispatchRequest {
  return {
    idempotencyKey: `SYNTH-M51B-TEAMS-IDEMPOTENCY-${id}`,
    submittedAt: "2026-07-15T12:00:03.000Z",
    actor: createSyntheticM51BTeamsActor("super-admin"),
    event: createSyntheticM51BTeamsEvent({
      eventId: `SYNTH-M51B-TEAMS-EVENT-${id}`,
      sourceReference: `SYNTH-M51B-WORK-ITEM-${id}`,
    }),
  };
}

describe("M5.1B Teams bounded retry, acknowledgement, and recovery", () => {
  it("classifies throttling, outage, timeout, and authorization failure deterministically", () => {
    expect(
      classifyM51BTeamsFailure(
        new M51BTeamsSyntheticError(429, "THROTTLED", 2_750),
        1,
      ),
    ).toEqual({
      disposition: "retry",
      statusCode: 429,
      code: "THROTTLED",
      delayMs: 2_750,
      retryAfterHonored: true,
    });
    expect(
      classifyM51BTeamsFailure(
        new M51BTeamsSyntheticError(503, "UNAVAILABLE"),
        3,
      ),
    ).toMatchObject({ disposition: "retry", delayMs: 2_000 });
    expect(classifyM51BTeamsFailure(new Error("ETIMEDOUT"), 2)).toMatchObject({
      disposition: "retry",
      statusCode: null,
      delayMs: 1_000,
    });
    expect(
      classifyM51BTeamsFailure(
        new M51BTeamsSyntheticError(403, "FORBIDDEN"),
        1,
      ),
    ).toMatchObject({ disposition: "fail", delayMs: 0 });
  });

  it("honors Retry-After without sleeping and still meets the measured 30-second SLO", async () => {
    const { adapter, orchestrator } = foundation();
    const input = request("THROTTLE");
    adapter.scheduleFaults(input.idempotencyKey, [
      new M51BTeamsSyntheticError(429, "M51B_TEAMS_THROTTLED", 2_750),
      null,
    ]);

    const result = await orchestrator.deliver(input);

    expect(result.status).toBe("delivered");
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({
      outcome: "retry_scheduled",
      scheduledDelayMs: 2_750,
      retryAfterHonored: true,
      statusCode: 429,
    });
    expect(result.timing).toMatchObject({
      elapsedMilliseconds: 5_000,
      withinThirtySeconds: true,
      measuredFromTimestamps: true,
    });
    expect(orchestrator.actualSleepCalls).toBe(0);
  });

  it("bounds an outage at four attempts, dead-letters it, alerts operations, and replays idempotently", async () => {
    const { adapter, orchestrator } = foundation();
    const input = request("OUTAGE");
    adapter.scheduleFaults(
      input.idempotencyKey,
      Array.from(
        { length: 4 },
        () => new M51BTeamsSyntheticError(503, "M51B_TEAMS_DESTINATION_OUTAGE"),
      ),
    );

    const failed = await orchestrator.deliver(input);
    const replay = await orchestrator.deliver(input);

    expect(failed.status).toBe("dead_lettered");
    expect(failed.attempts).toHaveLength(4);
    expect(failed.attempts.map((attempt) => attempt.scheduledDelayMs)).toEqual([
      500,
      1_000,
      2_000,
      0,
    ]);
    expect(failed.deadLetter).toMatchObject({
      attempts: 4,
      replayEligible: true,
      immutable: true,
    });
    expect(failed.deadLetter?.finalErrorCode).toContain(
      "M51B_TEAMS_RETRY_EXHAUSTED",
    );
    expect(failed.operationalAlert).toMatchObject({
      alertType: "delivery_failed",
      ownerRole: "administrator",
      status: "open",
    });
    expect(orchestrator.listDeadLetters()).toHaveLength(1);
    expect(orchestrator.listOperationalAlerts()).toHaveLength(1);
    expect(replay.replayed).toBe(true);
    expect(replay.deliveryId).toBe(failed.deliveryId);
    expect(adapter.metrics().syntheticSendAttempts).toBe(4);
    expect(orchestrator.actualSleepCalls).toBe(0);
  });

  it("performs accountable dead-letter recovery once and returns the recovery on replay", async () => {
    const { adapter, orchestrator } = foundation();
    const input = request("RECOVERY");
    adapter.scheduleFaults(
      input.idempotencyKey,
      Array.from(
        { length: 4 },
        () => new M51BTeamsSyntheticError(503, "M51B_TEAMS_DESTINATION_OUTAGE"),
      ),
    );
    const failed = await orchestrator.deliver(input);
    const recoveryRequest = {
      deadLetterId: failed.deadLetter!.deadLetterId,
      recoveryIdempotencyKey: "SYNTH-M51B-TEAMS-RECOVERY-IDEMPOTENCY-001",
      replayedAt: "2026-07-15T12:00:10.000Z",
      actor: createSyntheticM51BTeamsActor("administrator"),
    };

    const recovered = await orchestrator.recoverDeadLetter(recoveryRequest);
    const replay = await orchestrator.recoverDeadLetter(recoveryRequest);
    const alternateKeyReplay = await orchestrator.recoverDeadLetter({
      ...recoveryRequest,
      recoveryIdempotencyKey: "SYNTH-M51B-TEAMS-RECOVERY-IDEMPOTENCY-002",
    });

    expect(recovered.status).toBe("recovered");
    expect(recovered.delivery).toMatchObject({
      status: "delivered",
      replayOfDeliveryId: failed.deliveryId,
    });
    expect(recovered.evidence).toMatchObject({
      deadLetterId: failed.deadLetter!.deadLetterId,
      originalDeliveryId: failed.deliveryId,
      duplicateNotificationCreated: false,
      recoveredByActorId: createSyntheticM51BTeamsActor("administrator").actorId,
      deadLetterResolutionId: expect.stringMatching(
        /^SYNTH-M51B-TEAMS-DLQ-RESOLUTION-/,
      ),
      operationalAlertResolutionId: expect.stringMatching(
        /^SYNTH-M51B-TEAMS-ALERT-RESOLUTION-/,
      ),
      resolvedOperationalAlertId: failed.operationalAlert!.alertId,
    });
    expect(replay.replayed).toBe(true);
    expect(alternateKeyReplay.replayed).toBe(true);
    expect(alternateKeyReplay.delivery?.deliveryId).toBe(
      recovered.delivery?.deliveryId,
    );
    expect(adapter.metrics()).toMatchObject({
      syntheticSendAttempts: 5,
      syntheticDeliveries: 1,
      liveGraphCalls: 0,
      liveTeamsWrites: 0,
      realNotificationsSent: 0,
    });
    expect(orchestrator.listActiveDeadLetters()).toEqual([]);
    expect(orchestrator.listOpenOperationalAlerts()).toEqual([]);
  });

  it("retains immutable failure evidence while projecting the recovered DLQ and resolved alert as inactive", async () => {
    const { adapter, orchestrator } = foundation();
    const input = request("OPERATIONAL-RESOLUTION");
    adapter.scheduleFaults(
      input.idempotencyKey,
      Array.from(
        { length: 4 },
        () => new M51BTeamsSyntheticError(503, "M51B_TEAMS_DESTINATION_OUTAGE"),
      ),
    );
    const failed = await orchestrator.deliver(input);
    const originalDeadLetter = failed.deadLetter!;
    const originalAlert = failed.operationalAlert!;
    const originalFailureSnapshot = JSON.stringify({
      deadLetter: originalDeadLetter,
      alert: originalAlert,
      attempts: failed.attempts,
    });

    expect(orchestrator.getOperationalStateSnapshot()).toMatchObject({
      totalDeadLetters: 1,
      activeDeadLetters: 1,
      recoveredDeadLetters: 0,
      totalAlerts: 1,
      openAlerts: 1,
      resolvedAlerts: 0,
      immutable: true,
    });

    const recovery = await orchestrator.recoverDeadLetter({
      deadLetterId: originalDeadLetter.deadLetterId,
      recoveryIdempotencyKey:
        "SYNTH-M51B-TEAMS-OPERATIONAL-RESOLUTION-RECOVERY",
      replayedAt: "2026-07-15T12:00:10.000Z",
      actor: createSyntheticM51BTeamsActor("administrator"),
    });
    const deadLetterProjection = orchestrator.listDeadLetters()[0];
    const alertProjection = orchestrator.listOperationalAlerts()[0];
    const state = orchestrator.getOperationalStateSnapshot();

    expect(recovery.status).toBe("recovered");
    expect(JSON.stringify({
      deadLetter: failed.deadLetter,
      alert: failed.operationalAlert,
      attempts: failed.attempts,
    })).toBe(originalFailureSnapshot);
    expect(failed.deadLetter).toBe(originalDeadLetter);
    expect(failed.operationalAlert).toBe(originalAlert);
    expect(Object.isFrozen(originalDeadLetter)).toBe(true);
    expect(Object.isFrozen(originalAlert)).toBe(true);
    expect(originalAlert.status).toBe("open");

    expect(deadLetterProjection).toMatchObject({
      deadLetterId: originalDeadLetter.deadLetterId,
      operationalStatus: "recovered",
      active: false,
      resolution: {
        deadLetterId: originalDeadLetter.deadLetterId,
        originalDeliveryId: failed.deliveryId,
        recoveredDeliveryId: recovery.delivery!.deliveryId,
        recoveryEvidenceId: recovery.evidence!.recoveryEvidenceId,
        resolvedByActorId: createSyntheticM51BTeamsActor("administrator").actorId,
        status: "recovered",
        immutable: true,
      },
    });
    expect(alertProjection).toMatchObject({
      alertId: originalAlert.alertId,
      originalStatus: "open",
      status: "resolved",
      active: false,
      acknowledgedAt: recovery.evidence!.recoveredAt,
      acknowledgedByActorId: createSyntheticM51BTeamsActor("administrator").actorId,
      resolvedAt: recovery.evidence!.recoveredAt,
      resolvedByActorId: createSyntheticM51BTeamsActor("administrator").actorId,
      resolution: {
        alertId: originalAlert.alertId,
        deadLetterId: originalDeadLetter.deadLetterId,
        recoveredDeliveryId: recovery.delivery!.deliveryId,
        recoveryEvidenceId: recovery.evidence!.recoveryEvidenceId,
        status: "resolved",
        immutable: true,
      },
    });
    expect(orchestrator.listActiveDeadLetters()).toEqual([]);
    expect(orchestrator.listOpenOperationalAlerts()).toEqual([]);
    expect(state).toMatchObject({
      totalDeadLetters: 1,
      activeDeadLetters: 0,
      recoveredDeadLetters: 1,
      totalAlerts: 1,
      openAlerts: 0,
      resolvedAlerts: 1,
      immutable: true,
      synthetic: true,
    });
    expect(Object.isFrozen(state)).toBe(true);
    expect(Object.isFrozen(deadLetterProjection.resolution)).toBe(true);
    expect(Object.isFrozen(alertProjection.resolution)).toBe(true);
  });

  it("hard-fails a 403 after one attempt instead of blindly retrying", async () => {
    const { adapter, orchestrator } = foundation();
    const input = request("FORBIDDEN");
    adapter.scheduleFaults(input.idempotencyKey, [
      new M51BTeamsSyntheticError(403, "M51B_TEAMS_DESTINATION_FORBIDDEN"),
    ]);

    const result = await orchestrator.deliver(input);

    expect(result.status).toBe("dead_lettered");
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      outcome: "hard_failed",
      statusCode: 403,
      scheduledDelayMs: 0,
    });
    expect(result.deadLetter?.finalErrorCode).toBe(
      "M51B_TEAMS_DESTINATION_FORBIDDEN",
    );
  });

  it("detects a measured delivery over 30 seconds and opens an SLO alert", async () => {
    const { orchestrator } = foundation(40_000);
    const result = await orchestrator.deliver(request("LATE"));

    expect(result.status).toBe("delivered_late");
    expect(result.timing).toMatchObject({
      elapsedMilliseconds: 41_000,
      thresholdMilliseconds: 30_000,
      withinThirtySeconds: false,
      measuredFromTimestamps: true,
    });
    expect(result.operationalAlert).toMatchObject({
      alertType: "delivery_slo_breached",
      reasonCode: "M51B_TEAMS_DELIVERY_SLO_BREACHED",
    });
    expect(result.auditEvents.at(-1)).toMatchObject({
      outcome: "failed",
      reasonCodes: ["M51B_TEAMS_DELIVERY_SLO_BREACHED"],
    });
  });

  it("records exactly one acknowledgement by an intended recipient", async () => {
    const { orchestrator } = foundation();
    const delivery = await orchestrator.deliver(request("ACK"));
    const acknowledgedAt = isoAt(
      parseTeamsTimestamp(delivery.evidence!.deliveredAt)! + 25_000,
    );
    const ackRequest = {
      idempotencyKey: "SYNTH-M51B-TEAMS-ACK-IDEMPOTENCY-001",
      deliveryId: delivery.deliveryId,
      messageId: delivery.evidence!.messageId,
      acknowledgedAt,
      actor: createSyntheticM51BTeamsActor("managing-director"),
    };

    const first = await orchestrator.acknowledge(ackRequest);
    const replay = await orchestrator.acknowledge(ackRequest);
    const duplicateKey = await orchestrator.acknowledge({
      ...ackRequest,
      idempotencyKey: "SYNTH-M51B-TEAMS-ACK-IDEMPOTENCY-002",
    });

    expect(first.status).toBe("acknowledged");
    expect(first.evidence).toMatchObject({
      deliveryId: delivery.deliveryId,
      actorId: createSyntheticM51BTeamsActor("managing-director").actorId,
      elapsedFromDeliveryMilliseconds: 25_000,
      withinAcknowledgementWindow: true,
      immutable: true,
    });
    expect(replay.replayed).toBe(true);
    expect(duplicateKey.replayed).toBe(true);
    expect(duplicateKey.evidence?.acknowledgementId).toBe(
      first.evidence?.acknowledgementId,
    );
  });

  it("denies acknowledgement by a non-recipient, for a mismatched message, or outside the window", async () => {
    const { orchestrator } = foundation();
    const delivery = await orchestrator.deliver(request("ACK-DENIAL"));
    const base = {
      deliveryId: delivery.deliveryId,
      messageId: delivery.evidence!.messageId,
      acknowledgedAt: isoAt(
        parseTeamsTimestamp(delivery.evidence!.deliveredAt)! + 10_000,
      ),
      actor: createSyntheticM51BTeamsActor("managing-director"),
    };
    const nonRecipient = await orchestrator.acknowledge({
      ...base,
      idempotencyKey: "SYNTH-M51B-TEAMS-ACK-DENIAL-NONRECIPIENT",
      actor: createSyntheticM51BTeamsActor("administrator"),
    });
    const mismatch = await orchestrator.acknowledge({
      ...base,
      idempotencyKey: "SYNTH-M51B-TEAMS-ACK-DENIAL-MESSAGE",
      messageId: "SYNTH-M51B-TEAMS-MESSAGE-WRONG",
    });
    const late = await orchestrator.acknowledge({
      ...base,
      idempotencyKey: "SYNTH-M51B-TEAMS-ACK-DENIAL-LATE",
      acknowledgedAt: isoAt(
        parseTeamsTimestamp(delivery.evidence!.deliveredAt)! + 300_001,
      ),
    });

    expect(nonRecipient.denialCodes).toContain(
      "M51B_TEAMS_ACK_NON_RECIPIENT_DENIED",
    );
    expect(mismatch.denialCodes).toContain("M51B_TEAMS_ACK_MESSAGE_MISMATCH");
    expect(late.denialCodes).toContain("M51B_TEAMS_ACK_WINDOW_DENIED");
    expect([nonRecipient, mismatch, late].every((item) => item.evidence === null)).toBe(
      true,
    );
  });

  it("rejects acknowledgement idempotency-key payload drift", async () => {
    const { orchestrator } = foundation();
    const delivery = await orchestrator.deliver(request("ACK-DRIFT"));
    const base = {
      idempotencyKey: "SYNTH-M51B-TEAMS-ACK-DRIFT",
      deliveryId: delivery.deliveryId,
      messageId: delivery.evidence!.messageId,
      acknowledgedAt: isoAt(
        parseTeamsTimestamp(delivery.evidence!.deliveredAt)! + 10_000,
      ),
      actor: createSyntheticM51BTeamsActor("managing-director"),
    };
    await orchestrator.acknowledge(base);
    const drift = await orchestrator.acknowledge({
      ...base,
      acknowledgedAt: isoAt(parseTeamsTimestamp(base.acknowledgedAt)! + 1_000),
    });

    expect(drift.status).toBe("denied");
    expect(drift.denialCodes).toContain(
      "M51B_TEAMS_ACK_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
    );
  });
});
