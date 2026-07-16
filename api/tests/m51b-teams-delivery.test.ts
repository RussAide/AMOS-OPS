import { describe, expect, it } from "vitest";
import { M51B_APPROVED_TENANT_BOUNDARY } from "@contracts/m51b/shared";
import {
  M51B_TEAMS_DELIVERY_SLO_MS,
  type M51BTeamsDispatchRequest,
} from "@contracts/m51b/teams";
import { M51BTeamsDeliveryOrchestrator } from "../services/m51b/teams/delivery-orchestrator";
import {
  createSyntheticM51BTeamsActor,
  createSyntheticM51BTeamsDestinations,
  createSyntheticM51BTeamsEvent,
  createSyntheticM51BTeamsIdentities,
} from "../services/m51b/teams/fixtures";
import { M51BTeamsRegistry } from "../services/m51b/teams/registry";
import { runM51BTeamsScenario } from "../services/m51b/teams/scenario";
import { SyntheticM51BTeamsAdapter } from "../services/m51b/teams/synthetic-teams-adapter";

function foundation(latencyMs = 1_250) {
  const registry = new M51BTeamsRegistry(
    createSyntheticM51BTeamsDestinations(),
    createSyntheticM51BTeamsIdentities(),
  );
  const adapter = new SyntheticM51BTeamsAdapter(latencyMs);
  const orchestrator = new M51BTeamsDeliveryOrchestrator(registry, adapter);
  return { registry, adapter, orchestrator };
}

function primaryRequest(
  overrides: Partial<M51BTeamsDispatchRequest> = {},
): M51BTeamsDispatchRequest {
  return {
    idempotencyKey: "SYNTH-M51B-TEAMS-IDEMPOTENCY-DELIVERY-001",
    submittedAt: "2026-07-15T12:00:03.000Z",
    actor: createSyntheticM51BTeamsActor("super-admin"),
    event: createSyntheticM51BTeamsEvent(),
    ...overrides,
  };
}

describe("M5.1B deterministic Teams approved-event delivery", () => {
  it("resolves only logical synthetic destinations inside the approved tenant", () => {
    const { registry } = foundation();
    const destinations = registry.listDestinations();

    expect(destinations).toHaveLength(5);
    expect(
      destinations.every(
        (destination) =>
          destination.tenantId === M51B_APPROVED_TENANT_BOUNDARY &&
          destination.physicalUrlExposed === false &&
          destination.teamId.startsWith("SYNTH-") &&
          destination.channelId.startsWith("SYNTH-") &&
          !JSON.stringify(destination).includes("https://"),
      ),
    ).toBe(true);
    expect(Object.isFrozen(destinations)).toBe(true);
  });

  it("delivers an approved event within 30 seconds with validated mentions and minimized content", async () => {
    const { adapter, orchestrator } = foundation();
    const result = await orchestrator.deliver(primaryRequest());

    expect(result.status).toBe("delivered");
    expect(result.timing).toEqual({
      approvedAt: "2026-07-15T12:00:02.000Z",
      submittedAt: "2026-07-15T12:00:03.000Z",
      deliveredAt: "2026-07-15T12:00:04.250Z",
      elapsedMilliseconds: 2_250,
      thresholdMilliseconds: M51B_TEAMS_DELIVERY_SLO_MS,
      withinThirtySeconds: true,
      measuredFromTimestamps: true,
    });
    expect(result.destination).toMatchObject({
      logicalName: "Enterprise Leadership Decisions",
      physicalUrlExposed: false,
    });
    expect(result.payload).toMatchObject({
      minimized: true,
      notificationSensitivity: "internal",
      freeTextIncluded: false,
      protectedRecordIdentifierIncluded: false,
      physicalMicrosoftUrlIncluded: false,
    });
    expect(result.payload?.body).toContain("@Managing Director");
    expect(result.payload?.body).toContain("work item");
    expect(result.payload?.mentions).toEqual([
      expect.objectContaining({
        role: "managing-director",
        validated: true,
        synthetic: true,
      }),
    ]);
    expect(result.evidence).toMatchObject({
      destinationResolved: true,
      contentMinimized: true,
      mentionsValidated: true,
      acknowledgementRequired: true,
      elapsedMilliseconds: 2_250,
      liveGraphCalls: 0,
      liveTeamsWrites: 0,
      realNotificationsSent: 0,
    });
    expect(result.attempts).toHaveLength(1);
    expect(result.attempts[0]).toMatchObject({
      attempt: 1,
      outcome: "delivered",
      statusCode: 202,
    });
    expect(adapter.metrics()).toMatchObject({
      syntheticSendAttempts: 1,
      syntheticDeliveries: 1,
      liveGraphCalls: 0,
      liveTeamsWrites: 0,
      realNotificationsSent: 0,
      credentialReads: 0,
    });
  });

  it("records deeply immutable delivery evidence without retaining prohibited source detail", async () => {
    const { orchestrator } = foundation();
    const result = await orchestrator.deliver(primaryRequest());

    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.payload)).toBe(true);
    expect(Object.isFrozen(result.payload?.mentions)).toBe(true);
    expect(Object.isFrozen(result.payload?.mentions[0])).toBe(true);
    expect(Object.isFrozen(result.evidence)).toBe(true);
    expect(Object.isFrozen(result.evidence?.recipientActorIds)).toBe(true);
    expect(result.evidence?.contentHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toMatch(
      /patient|guardian|diagnosis|medication|real notification/i,
    );
  });

  it("returns one logical delivery on replay and rejects key reuse with a changed payload", async () => {
    const { adapter, orchestrator } = foundation();
    const request = primaryRequest();
    const first = await orchestrator.deliver(request);
    const replay = await orchestrator.deliver(request);
    const mismatch = await orchestrator.deliver({
      ...request,
      event: createSyntheticM51BTeamsEvent({ priority: "urgent" }),
    });

    expect(replay).toMatchObject({
      deliveryId: first.deliveryId,
      replayed: true,
      status: "delivered",
    });
    expect(replay.evidence?.messageId).toBe(first.evidence?.messageId);
    expect(adapter.metrics().syntheticSendAttempts).toBe(1);
    expect(mismatch.status).toBe("denied");
    expect(mismatch.denialCodes).toContain(
      "M51B_TEAMS_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH",
    );
    expect(adapter.metrics().syntheticSendAttempts).toBe(1);
    expect(orchestrator.getDelivery(first.deliveryId)).toBe(first);
  });

  it("blocks the live adapter surface and keeps every live counter at zero", () => {
    const { adapter } = foundation();

    expect(() => adapter.sendLiveTeamsNotification()).toThrow(
      "M51B_TEAMS_LIVE_NOTIFICATION_PROHIBITED",
    );
    expect(adapter.metrics()).toEqual({
      syntheticSendAttempts: 0,
      syntheticDeliveries: 0,
      blockedLiveOperations: 1,
      liveGraphCalls: 0,
      liveTeamsWrites: 0,
      realNotificationsSent: 0,
      credentialReads: 0,
    });
  });

  it("passes the integrated Teams positive, retry, privacy, acknowledgement, and replay scenario", async () => {
    const scenario = await runM51BTeamsScenario();

    expect(scenario.passed).toBe(true);
    expect(Object.values(scenario.assertions).every(Boolean)).toBe(true);
    expect(scenario.primaryDelivery.status).toBe("delivered");
    expect(scenario.primaryAcknowledgement.status).toBe("acknowledged");
    expect(scenario.retryDelivery.attempts).toHaveLength(2);
    expect(scenario.persistentOutageDelivery).toMatchObject({
      status: "dead_lettered",
      deadLetter: { replayEligible: true, attempts: 4 },
      operationalAlert: { status: "open", alertType: "delivery_failed" },
    });
    expect(scenario.outageRecovery).toMatchObject({
      status: "recovered",
      evidence: {
        deadLetterId: scenario.persistentOutageDelivery.deadLetter!.deadLetterId,
        resolvedOperationalAlertId:
          scenario.persistentOutageDelivery.operationalAlert!.alertId,
        duplicateNotificationCreated: false,
      },
    });
    expect(scenario.operationalState).toMatchObject({
      totalDeadLetters: 1,
      activeDeadLetters: 0,
      recoveredDeadLetters: 1,
      totalAlerts: 1,
      openAlerts: 0,
      resolvedAlerts: 1,
      deadLetters: [
        {
          operationalStatus: "recovered",
          active: false,
          resolution: {
            recoveredDeliveryId: scenario.outageRecovery.delivery!.deliveryId,
            status: "recovered",
          },
        },
      ],
      alerts: [
        {
          originalStatus: "open",
          status: "resolved",
          active: false,
          resolution: {
            recoveredDeliveryId: scenario.outageRecovery.delivery!.deliveryId,
            status: "resolved",
          },
        },
      ],
    });
    expect(scenario.assertions.retryBoundedAndRecovered).toBe(true);
    expect(scenario.privacyDenial.status).toBe("denied");
    expect(scenario.replayDelivery.replayed).toBe(true);
    expect(scenario.adapterMetrics).toMatchObject({
      liveGraphCalls: 0,
      liveTeamsWrites: 0,
      realNotificationsSent: 0,
      credentialReads: 0,
    });
    expect(scenario.auditEvents.length).toBeGreaterThanOrEqual(6);
    expect(scenario.auditEvents.every((event) => event.immutable)).toBe(true);
  });
});
