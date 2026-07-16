import { describe, expect, it, vi } from "vitest";
import type { M51BReliabilityRequest } from "@contracts/m51b/reliability";
import { M51BReliabilityCoordinator } from "../services/m51b/integration/resilience";

function request(
  operationId = "SYNTH-M51B-OP-RELIABILITY-001",
  idempotencyKey = "SYNTH-M51B-IDEMPOTENCY-RELIABILITY-001",
): M51BReliabilityRequest {
  return {
    operationId,
    channel: "teams",
    correlationId: "SYNTH-M51B-CORRELATION-RELIABILITY-001",
    idempotencyKey,
    actorId: "SYNTH-M51B-ACTOR-ADMIN-001",
    payloadFingerprint: "SYNTH-M51B-SHA256-RELIABILITY-001",
    requestedAt: "2026-07-15T12:00:00.000Z",
    synthetic: true,
  };
}

describe("M5.1B shared reliability coordinator", () => {
  it("records one successful delivery and suppresses a duplicate", () => {
    const coordinator = new M51BReliabilityCoordinator();
    const adapter = vi.fn(() => ({ ok: true, value: { delivered: true } }));
    const first = coordinator.execute(request(), adapter);
    const duplicate = coordinator.execute(request("SYNTH-M51B-OP-DUPLICATE-002"), adapter);

    expect(first.status).toBe("delivered");
    expect(duplicate.status).toBe("duplicate_suppressed");
    expect(duplicate.duplicateSuppressed).toBe(true);
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(coordinator.snapshot().duplicateDeliveries).toBe(0);
  });

  it("quarantines an idempotency-key reuse when the payload fingerprint changes", () => {
    const coordinator = new M51BReliabilityCoordinator();
    const firstAdapter = vi.fn(() => ({
      ok: true,
      value: { delivered: true, confidentialValue: "prior-result" },
    }));
    const conflictingAdapter = vi.fn(() => ({
      ok: true,
      value: { delivered: true, confidentialValue: "must-not-run" },
    }));
    const first = coordinator.execute(request(), firstAdapter);
    const conflict = coordinator.execute(
      {
        ...request("SYNTH-M51B-OP-CONFLICT-002"),
        correlationId: "SYNTH-M51B-CORRELATION-CONFLICT-002",
        payloadFingerprint: "SYNTH-M51B-SHA256-DIFFERENT-PAYLOAD-002",
      },
      conflictingAdapter,
    );

    expect(first.status).toBe("delivered");
    expect(conflict).toMatchObject({
      operationId: "SYNTH-M51B-OP-CONFLICT-002",
      status: "dead_lettered",
      value: null,
      duplicateSuppressed: false,
      attempts: [],
    });
    expect(conflict.auditEvents[0]?.reasonCodes).toContain(
      "M51B_IDEMPOTENCY_PAYLOAD_CONFLICT",
    );
    expect(conflict.value).not.toEqual(first.value);
    expect(firstAdapter).toHaveBeenCalledTimes(1);
    expect(conflictingAdapter).not.toHaveBeenCalled();
    expect(coordinator.listDeadLetters()).toHaveLength(1);
    expect(coordinator.listDeadLetters()[0]).toMatchObject({
      failureClass: "conflict",
      reasonCode: "M51B_IDEMPOTENCY_PAYLOAD_CONFLICT",
      request: {
        payloadFingerprint: "SYNTH-M51B-SHA256-DIFFERENT-PAYLOAD-002",
      },
    });
    expect(coordinator.listAlerts()).toHaveLength(1);
    expect(coordinator.snapshot()).toMatchObject({
      delivered: 1,
      openDeadLetters: 1,
      duplicateDeliveries: 0,
    });
  });

  it("preserves the first conflict record and alert across dead-letter ID collisions", () => {
    const coordinator = new M51BReliabilityCoordinator();
    coordinator.execute(request(), () => ({ ok: true, value: "original" }));
    const operationId = "SYNTH-M51B-OP-COLLISION-002";
    const firstCollisionRequest = {
      ...request(operationId),
      correlationId: "SYNTH-M51B-CORRELATION-COLLISION-B",
      payloadFingerprint: "SYNTH-M51B-SHA256-COLLISION-B",
    };
    const secondCollisionRequest = {
      ...request(operationId),
      correlationId: "SYNTH-M51B-CORRELATION-COLLISION-C",
      payloadFingerprint: "SYNTH-M51B-SHA256-COLLISION-C",
    };
    const firstAdapter = vi.fn(() => ({ ok: true, value: "must-not-run-b" }));
    const secondAdapter = vi.fn(() => ({ ok: true, value: "must-not-run-c" }));
    const repeatedAdapter = vi.fn(() => ({ ok: true, value: "must-not-repeat" }));

    const firstCollision = coordinator.execute(
      firstCollisionRequest,
      firstAdapter,
    );
    const originalRecord = coordinator.listDeadLetters()[0];
    const originalAlert = coordinator.listAlerts()[0];
    const secondCollision = coordinator.execute(
      secondCollisionRequest,
      secondAdapter,
    );
    const identicalRepeat = coordinator.execute(
      firstCollisionRequest,
      repeatedAdapter,
    );

    expect(firstAdapter).not.toHaveBeenCalled();
    expect(secondAdapter).not.toHaveBeenCalled();
    expect(repeatedAdapter).not.toHaveBeenCalled();
    expect(firstCollision.deadLetterId).not.toBe(secondCollision.deadLetterId);
    expect(secondCollision.deadLetterId).toBe(
      `${firstCollision.deadLetterId}-COLLISION-2`,
    );
    expect(identicalRepeat).toMatchObject({
      deadLetterId: firstCollision.deadLetterId,
      alertId: firstCollision.alertId,
      duplicateSuppressed: true,
      value: null,
    });

    const records = coordinator.listDeadLetters();
    const alerts = coordinator.listAlerts();
    expect(records).toHaveLength(2);
    expect(alerts).toHaveLength(2);
    expect(records.find(({ deadLetterId }) => deadLetterId === firstCollision.deadLetterId)).toEqual(
      originalRecord,
    );
    expect(alerts.find(({ alertId }) => alertId === firstCollision.alertId)).toEqual(
      originalAlert,
    );
    expect(originalRecord).toMatchObject({
      reasonCode: "M51B_IDEMPOTENCY_PAYLOAD_CONFLICT",
      failureClass: "conflict",
      failedAt: "2026-07-15T12:00:00.000Z",
      request: {
        correlationId: "SYNTH-M51B-CORRELATION-COLLISION-B",
        payloadFingerprint: "SYNTH-M51B-SHA256-COLLISION-B",
      },
    });
    expect(originalAlert).toMatchObject({
      alertId: firstCollision.alertId,
      correlationId: "SYNTH-M51B-CORRELATION-COLLISION-B",
      reasonCode: "M51B_IDEMPOTENCY_PAYLOAD_CONFLICT",
    });
    expect(records[1]).toMatchObject({
      deadLetterId: secondCollision.deadLetterId,
      request: {
        correlationId: "SYNTH-M51B-CORRELATION-COLLISION-C",
        payloadFingerprint: "SYNTH-M51B-SHA256-COLLISION-C",
      },
    });
  });

  it("denies replay of an idempotency payload-conflict quarantine without mutation", () => {
    const coordinator = new M51BReliabilityCoordinator();
    const originalAdapter = vi.fn(() => ({ ok: true, value: "original" }));
    const conflictAdapter = vi.fn(() => ({ ok: true, value: "must-not-run" }));
    const replayAdapter = vi.fn(() => ({ ok: true, value: "must-not-replay" }));
    coordinator.execute(request(), originalAdapter);
    const conflict = coordinator.execute(
      {
        ...request("SYNTH-M51B-OP-NONREPLAYABLE-CONFLICT-002"),
        correlationId: "SYNTH-M51B-CORRELATION-NONREPLAYABLE-CONFLICT-002",
        payloadFingerprint: "SYNTH-M51B-SHA256-NONREPLAYABLE-CONFLICT-002",
      },
      conflictAdapter,
    );
    const originalRecord = coordinator.listDeadLetters()[0];
    const originalAlert = coordinator.listAlerts()[0];

    expect(originalRecord).toMatchObject({
      deadLetterId: conflict.deadLetterId,
      replayEligible: false,
      failureClass: "conflict",
      reasonCode: "M51B_IDEMPOTENCY_PAYLOAD_CONFLICT",
    });
    expect(() =>
      coordinator.replay(
        conflict.deadLetterId!,
        {
          authorizedBy: "SYNTH-M51B-ACTOR-ADMIN-001",
          authorizedRole: "administrator",
          authorizedAt: "2026-07-15T12:05:00.000Z",
          failureCorrected: true,
          privacyAndPermissionRevalidated: true,
          synthetic: true,
        },
        replayAdapter,
      ),
    ).toThrow("M51B_DEAD_LETTER_NOT_REPLAY_ELIGIBLE");

    expect(originalAdapter).toHaveBeenCalledTimes(1);
    expect(conflictAdapter).not.toHaveBeenCalled();
    expect(replayAdapter).not.toHaveBeenCalled();
    expect(coordinator.listDeadLetters()).toEqual([originalRecord]);
    expect(coordinator.listAlerts()).toEqual([originalAlert]);
    expect(coordinator.snapshot()).toMatchObject({
      delivered: 1,
      openDeadLetters: 1,
      recoveredDeadLetters: 0,
      alertsRaised: 1,
    });
  });

  it("retries transient failures within the four-attempt bound", () => {
    const coordinator = new M51BReliabilityCoordinator();
    const result = coordinator.execute(request(), (attempt) =>
      attempt < 3
        ? {
            ok: false,
            failureClass: "transient",
            reasonCode: "SYNTHETIC_SERVICE_UNAVAILABLE",
          }
        : { ok: true, value: "recovered" },
    );

    expect(result.status).toBe("delivered");
    expect(result.attempts).toHaveLength(3);
    expect(result.attempts[0]?.retryScheduled).toBe(true);
    expect(result.liveCalls).toBe(0);
  });

  it("does not retry privacy, permission, validation, or conflict failures", () => {
    for (const failureClass of [
      "privacy",
      "permission",
      "validation",
      "conflict",
    ] as const) {
      const coordinator = new M51BReliabilityCoordinator();
      const adapter = vi.fn(() => ({
        ok: false,
        failureClass,
        reasonCode: `SYNTH_${failureClass.toUpperCase()}_DENIED`,
      }));
      const result = coordinator.execute(request(), adapter);
      expect(result.status).toBe("dead_lettered");
      expect(adapter).toHaveBeenCalledTimes(1);
      expect(result.alertId).toContain("ALERT");
    }
  });

  it("dead-letters exhausted retryable failures and raises an alert", () => {
    const coordinator = new M51BReliabilityCoordinator();
    const adapter = vi.fn(() => ({
      ok: false,
      failureClass: "throttle" as const,
      reasonCode: "SYNTHETIC_GRAPH_THROTTLE",
    }));
    const result = coordinator.execute(request(), adapter);

    expect(result.status).toBe("dead_lettered");
    expect(result.attempts).toHaveLength(4);
    expect(adapter).toHaveBeenCalledTimes(4);
    expect(coordinator.listDeadLetters()).toHaveLength(1);
    expect(coordinator.listAlerts()).toHaveLength(1);
  });

  it("requires governed authorization before replay", () => {
    const coordinator = new M51BReliabilityCoordinator();
    const failed = coordinator.execute(request(), () => ({
      ok: false,
      failureClass: "transient",
      reasonCode: "SYNTHETIC_OUTAGE",
    }));

    expect(() =>
      coordinator.replay(
        failed.deadLetterId!,
        {
          authorizedBy: "SYNTH-M51B-ACTOR-STAFF-001",
          authorizedRole: "therapist",
          authorizedAt: "2026-07-15T12:05:00.000Z",
          failureCorrected: true,
          privacyAndPermissionRevalidated: true,
          synthetic: true,
        },
        () => ({ ok: true, value: "must-not-run" }),
      ),
    ).toThrow("M51B_REPLAY_AUTHORIZATION_DENIED");
  });

  it("recovers an open dead letter exactly once after approved replay", () => {
    const coordinator = new M51BReliabilityCoordinator();
    const failed = coordinator.execute(request(), () => ({
      ok: false,
      failureClass: "transient",
      reasonCode: "SYNTHETIC_OUTAGE",
    }));
    const authorization = {
      authorizedBy: "SYNTH-M51B-ACTOR-ADMIN-001",
      authorizedRole: "administrator" as const,
      authorizedAt: "2026-07-15T12:05:00.000Z",
      failureCorrected: true,
      privacyAndPermissionRevalidated: true,
      synthetic: true as const,
    };
    const recovered = coordinator.replay(
      failed.deadLetterId!,
      authorization,
      () => ({ ok: true, value: "recovered" }),
    );

    expect(recovered.status).toBe("recovered");
    expect(recovered.replayed).toBe(true);
    expect(coordinator.snapshot().recoveredDeadLetters).toBe(1);
    expect(() =>
      coordinator.replay(failed.deadLetterId!, authorization, () => ({ ok: true })),
    ).toThrow("M51B_DEAD_LETTER_ALREADY_RESOLVED");
  });

  it("reconciles delivered and open dead-letter operations without duplicates", () => {
    const coordinator = new M51BReliabilityCoordinator();
    coordinator.execute(request(), () => ({ ok: true, value: "ok" }));
    coordinator.execute(
      request(
        "SYNTH-M51B-OP-RELIABILITY-002",
        "SYNTH-M51B-IDEMPOTENCY-RELIABILITY-002",
      ),
      () => ({
        ok: false,
        failureClass: "permission",
        reasonCode: "SYNTHETIC_PERMISSION_DENIED",
      }),
    );
    const result = coordinator.reconcile([
      "SYNTH-M51B-OP-RELIABILITY-001",
      "SYNTH-M51B-OP-RELIABILITY-002",
    ]);

    expect(result.accepted).toBe(true);
    expect(result.missingOperationIds).toEqual([]);
    expect(result.duplicateDeliveries).toEqual([]);
    expect(result.alertsRaised).toBe(1);
  });

  it("denies requests that are not explicitly synthetic", () => {
    const coordinator = new M51BReliabilityCoordinator();
    expect(() =>
      coordinator.execute(
        { ...request(), synthetic: false } as unknown as M51BReliabilityRequest,
        () => ({ ok: true }),
      ),
    ).toThrow("M51B_REAL_OPERATION_DENIED");
  });
});
