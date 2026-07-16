import { describe, expect, it } from "vitest";
import {
  M52DeviceSecurityCoordinator,
  M52DeviceRegistry,
  M52OfflineSessionManager,
  createM52CompliantTablet,
  createM52FixtureCache,
  createM52MedicationAidePrincipal,
  createM52MedicationCacheRequestForSession,
  M52_FIXTURE_PLAINTEXT_SENTINEL,
  M52_FIXTURE_TIME,
  type M52CachePrincipal,
  type M52OfflineAction,
} from "../services/m52/security";
import {
  M52DeterministicClock,
  M52SyntheticSyncDestination,
  type M52SyncRecord,
} from "../services/m52/sync";
import { M52SecureOfflineRuntime } from "../services/m52/runtime";

const SESSION_ID = "SYNTH-M52-SESSION-RUNTIME-001";
const YOUTH_ID = "SYNTH-M52-YOUTH-ALPHA-001";

function fixture(input: {
  readonly principal?: M52CachePrincipal;
  readonly action?: M52OfflineAction;
  readonly youthId?: string;
  readonly destinationRecords?: readonly M52SyncRecord[];
} = {}) {
  const { cache } = createM52FixtureCache();
  const devices = new M52DeviceRegistry();
  const sessions = new M52OfflineSessionManager();
  const security = new M52DeviceSecurityCoordinator({
    cache,
    devices,
    sessions,
  });
  const tablet = createM52CompliantTablet();
  const binding = security.enrollDevice(tablet, M52_FIXTURE_TIME);
  const principal = input.principal ?? createM52MedicationAidePrincipal();
  security.startSession(
    SESSION_ID,
    binding.deviceId,
    binding.installationId,
    principal,
    M52_FIXTURE_TIME,
  );
  const clock = new M52DeterministicClock(M52_FIXTURE_TIME);
  const destination = new M52SyntheticSyncDestination(
    clock,
    input.destinationRecords ?? [],
  );
  destination.setConnected(false);
  const context = {
    sessionId: SESSION_ID,
    devicePosture: tablet,
    workflowId: "gro_tablet_medication_pass" as const,
    action: input.action ?? ("record-administration" as const),
    youthId: input.youthId ?? YOUTH_ID,
    evaluatedAt: M52_FIXTURE_TIME,
  };
  const runtime = new M52SecureOfflineRuntime({
    security,
    clock,
    destination,
    context,
  });
  return { runtime, security, cache, clock, destination, tablet, context };
}

function enqueueMedication(
  current: ReturnType<typeof fixture>,
  suffix = "001",
) {
  const cacheRequest = createM52MedicationCacheRequestForSession(SESSION_ID, {
    entryId: `SYNTH-M52-CACHE-RUNTIME-${suffix}`,
    recordId: `SYNTH-M52-RECORD-RUNTIME-${suffix}`,
  });
  const result = current.runtime.enqueue({
    cacheRequest,
    operationId: `SYNTH-M52-OP-RUNTIME-${suffix}`,
    idempotencyKey: `SYNTH-M52-IDEM-RUNTIME-${suffix}`,
    expectedDestinationVersion: 0,
    deviceUpdatedAt: "2026-07-15T15:01:00.000Z",
    deviceClockOffsetMs: 0,
    evaluatedAt: "2026-07-15T15:01:00.000Z",
  });
  return { result, cacheRequest };
}

describe("M5.2 integrated security-bound offline runtime", () => {
  it("moves the exact recursive payload through ciphertext, trusted queue lineage, reconnect, and reconciliation", () => {
    const current = fixture();
    const { result, cacheRequest } = enqueueMedication(current);
    expect(result).toMatchObject({
      ciphertextOnlyPersistence: true,
      persistedPlaintextBytes: 0,
      synthetic: true,
    });
    expect(result.queue.entry.lineage).toEqual(current.runtime.lineage);
    expect(result.queue.entry.record.payload).toEqual(cacheRequest.payload);
    const persisted = current.cache.serializedPersistenceSnapshot();
    expect(persisted).not.toContain(M52_FIXTURE_PLAINTEXT_SENTINEL);
    expect(persisted).not.toContain(cacheRequest.recordId);

    const pass = current.runtime.reconnect({
      sessionId: SESSION_ID,
      devicePosture: current.tablet,
      evaluatedAt: "2026-07-15T15:02:00.000Z",
    });
    const report = current.runtime.reconcile();
    expect(pass.synchronized).toBe(1);
    expect(current.destination.getRecord(cacheRequest.recordId)?.payload).toEqual(
      cacheRequest.payload,
    );
    expect(report).toMatchObject({
      fullySynchronized: true,
      zeroDataLoss: true,
      unresolvedIntentCount: 0,
      unaccountedRecordIds: [],
      auditChainValid: true,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  });

  it("rebuilds the volatile queue from ciphertext after a synthetic application restart", () => {
    const current = fixture();
    const { cacheRequest } = enqueueMedication(current, "RESTART-001");
    expect(current.cache.persistedEnvelopeCount()).toBe(1);

    const restarted = new M52SecureOfflineRuntime({
      security: current.security,
      clock: current.clock,
      destination: current.destination,
      context: {
        ...current.context,
        evaluatedAt: "2026-07-15T15:01:30.000Z",
      },
    });
    const recovered = restarted.recoverEncryptedIntent({
      entryId: cacheRequest.entryId,
      recordId: cacheRequest.recordId,
      operationId: "SYNTH-M52-OP-RECOVERED-001",
      idempotencyKey: "SYNTH-M52-IDEM-RECOVERED-001",
      expectedDestinationVersion: 0,
      deviceUpdatedAt: "2026-07-15T15:01:00.000Z",
      deviceClockOffsetMs: 0,
      evaluatedAt: "2026-07-15T15:01:30.000Z",
    });
    expect(recovered.entry.record.payload).toEqual(cacheRequest.payload);
    restarted.reconnect({
      sessionId: SESSION_ID,
      devicePosture: current.tablet,
      evaluatedAt: "2026-07-15T15:02:00.000Z",
    });
    expect(restarted.reconcile().zeroDataLoss).toBe(true);
  });

  it("denies prohibited actions, unapproved scope, stale posture, wrong session, and wrong device before transport", () => {
    expect(() => fixture({ action: "create-medication-order" })).toThrow(
      "M52_RUNTIME_OFFLINE_ACTION_DENIED",
    );
    expect(() =>
      fixture({ youthId: "SYNTH-M52-YOUTH-NOT-ASSIGNED-999" }),
    ).toThrow("M52_RUNTIME_YOUTH_SCOPE_DENIED");
    expect(() =>
      fixture({
        principal: createM52MedicationAidePrincipal({
          role: "billing-specialist",
        }),
      }),
    ).toThrow("M52_RUNTIME_OFFLINE_ACTION_DENIED");
    expect(() =>
      fixture({
        principal: createM52MedicationAidePrincipal({ divisionId: "bhc" }),
      }),
    ).toThrow("M52_RUNTIME_OFFLINE_ACTION_DENIED");

    const current = fixture();
    const wrongYouthRequest = createM52MedicationCacheRequestForSession(
      SESSION_ID,
      { youthId: "SYNTH-M52-YOUTH-BRAVO-002" },
    );
    expect(() =>
      current.runtime.enqueue({
        cacheRequest: wrongYouthRequest,
        operationId: "SYNTH-M52-OP-WRONG-YOUTH",
        idempotencyKey: "SYNTH-M52-IDEM-WRONG-YOUTH",
        expectedDestinationVersion: 0,
        deviceUpdatedAt: "2026-07-15T15:01:00.000Z",
        deviceClockOffsetMs: 0,
        evaluatedAt: "2026-07-15T15:01:00.000Z",
      }),
    ).toThrow("M52_RUNTIME_CACHE_REQUEST_SCOPE_MISMATCH");
    enqueueMedication(current);
    expect(() =>
      current.runtime.reconnect({
        sessionId: "SYNTH-M52-SESSION-CLIENT-SPOOFED",
        devicePosture: current.tablet,
        evaluatedAt: "2026-07-15T15:02:00.000Z",
      }),
    ).toThrow("M52_RUNTIME_SERVER_SESSION_MISMATCH");
    expect(() =>
      current.runtime.reconnect({
        sessionId: SESSION_ID,
        devicePosture: {
          ...current.tablet,
          installationId: "SYNTH-M52-INSTALLATION-SPOOFED-999",
        },
        evaluatedAt: "2026-07-15T15:02:00.000Z",
      }),
    ).toThrow("M52_RUNTIME_SESSION_DEVICE_POSTURE_MISMATCH");
    expect(() =>
      current.runtime.reconnect({
        sessionId: SESSION_ID,
        devicePosture: {
          ...current.tablet,
          attestedAt: "2026-07-15T14:30:00.000Z",
        },
        evaluatedAt: "2026-07-15T15:02:00.000Z",
      }),
    ).toThrow("M52_DEVICE_ATTESTATION_STALE");
  });

  it("denies expired and revoked sessions at reconnect", () => {
    const expired = fixture();
    enqueueMedication(expired, "EXPIRED-001");
    expect(() =>
      expired.runtime.reconnect({
        sessionId: SESSION_ID,
        devicePosture: {
          ...expired.tablet,
          attestedAt: "2026-07-15T15:16:00.000Z",
        },
        evaluatedAt: "2026-07-15T15:16:00.000Z",
      }),
    ).toThrow("M52_SESSION_IDLE_TIMEOUT");

    const revoked = fixture();
    enqueueMedication(revoked, "REVOKED-001");
    revoked.runtime.remoteRevokeAndWipe({
      requestedBy: "SYNTH-M52-SECURITY-ADMIN-001",
      reason: "SYNTHETIC_DEVICE_LOSS",
      occurredAt: "2026-07-15T15:02:00.000Z",
    });
    expect(() =>
      revoked.runtime.reconnect({
        sessionId: SESSION_ID,
        devicePosture: revoked.tablet,
        evaluatedAt: "2026-07-15T15:02:30.000Z",
      }),
    ).toThrow();
  });

  it("purges ciphertext and queued intent together on logout and device loss", () => {
    const loggedOut = fixture();
    enqueueMedication(loggedOut, "LOGOUT-001");
    const logout = loggedOut.runtime.logout("2026-07-15T15:02:00.000Z");
    expect(logout.security).toMatchObject({
      state: "logged-out",
      remainingUserDeviceEnvelopes: 0,
    });
    expect(logout.queue).toMatchObject({
      purgedQueueEntries: 1,
      remainingQueueEntries: 0,
      remainingLocalRecords: 0,
      destinationRecordsChanged: 0,
    });
    expect(loggedOut.cache.persistedEnvelopeCount()).toBe(0);

    const lost = fixture();
    enqueueMedication(lost, "DEVICE-LOSS-001");
    const wipe = lost.runtime.remoteRevokeAndWipe({
      requestedBy: "SYNTH-M52-SECURITY-ADMIN-001",
      reason: "SYNTHETIC_DEVICE_LOSS",
      occurredAt: "2026-07-15T15:02:00.000Z",
    });
    expect(wipe.security).toMatchObject({
      finalState: "wiped",
      remainingDeviceEnvelopes: 0,
    });
    expect(wipe.queue).toMatchObject({
      purgedQueueEntries: 1,
      remainingQueueEntries: 0,
      destinationRecordsChanged: 0,
    });
    expect(lost.cache.persistedEnvelopeCount()).toBe(0);
  });

  it("requires the same active server-derived context to resolve a conflict", () => {
    const request = createM52MedicationCacheRequestForSession(SESSION_ID);
    const destinationRecord: M52SyncRecord = {
      recordId: "SYNTH-M52-RECORD-RUNTIME-001",
      workflow: request.workflowId,
      payload: request.payload as M52SyncRecord["payload"],
      version: 1,
      updatedAt: "2026-07-15T14:59:00.000Z",
      synthetic: true,
    };
    const current = fixture({ destinationRecords: [destinationRecord] });
    const { result } = enqueueMedication(current);
    current.runtime.reconnect({
      sessionId: SESSION_ID,
      devicePosture: current.tablet,
      evaluatedAt: "2026-07-15T15:02:00.000Z",
    });
    expect(current.runtime.sync.localStatus().conflicts).toBe(1);
    expect(() =>
      current.runtime.resolveConflict({
        sessionId: "SYNTH-M52-SESSION-SPOOFED-999",
        devicePosture: current.tablet,
        evaluatedAt: "2026-07-15T15:02:30.000Z",
        queueId: result.queue.entry.queueId,
        resolution: { resolution: "accept_destination" },
      }),
    ).toThrow("M52_RUNTIME_SERVER_SESSION_MISMATCH");
    expect(() =>
      current.runtime.resolveConflict({
        sessionId: SESSION_ID,
        devicePosture: {
          ...current.tablet,
          deviceId: "SYNTH-M52-DEVICE-SPOOFED-999",
        },
        evaluatedAt: "2026-07-15T15:02:30.000Z",
        queueId: result.queue.entry.queueId,
        resolution: { resolution: "accept_destination" },
      }),
    ).toThrow("M52_RUNTIME_SESSION_DEVICE_POSTURE_MISMATCH");
    const resolved = current.runtime.resolveConflict({
      sessionId: SESSION_ID,
      devicePosture: current.tablet,
      evaluatedAt: "2026-07-15T15:02:30.000Z",
      queueId: result.queue.entry.queueId,
      resolution: { resolution: "accept_destination" },
    });
    expect(resolved).toMatchObject({
      status: "synchronized",
      resolutionCount: 1,
      conflict: {
        resolved: true,
        resolvedBy: "SYNTH-M52-USER-MED-AIDE-001",
      },
    });
    expect(current.runtime.reconcile().zeroDataLoss).toBe(true);
  });
});
