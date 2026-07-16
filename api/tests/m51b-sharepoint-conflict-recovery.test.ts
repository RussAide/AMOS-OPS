import { describe, expect, it } from "vitest";
import type { M51BReplayAuthorization } from "@contracts/m51b/reliability";
import { runM51bSharePointExhaustedFailureRecovery } from "../services/m51b/sharepoint/recovery";
import { runM51bApprovedSharePointSync } from "../services/m51b/sharepoint/sync";

describe("M5.1B SharePoint conflict, outage, retry, and replay recovery", () => {
  it("classifies a stale eTag as a conflict without overwriting the target", async () => {
    const result = await runM51bApprovedSharePointSync();
    expect(result.staleVersionConflict).toMatchObject({
      status: "conflict",
      attempts: 1,
      retriesScheduled: 0,
      replayed: false,
      errorCode: "M51A_ETAG_PRECONDITION_FAILED",
      liveGraphCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  });

  it("recovers from a synthetic SharePoint outage on the bounded retry", async () => {
    const result = await runM51bApprovedSharePointSync();
    expect(result.delivery).toMatchObject({
      status: "succeeded",
      attempts: 2,
      retriesScheduled: 1,
      replayed: false,
      errorCode: null,
      liveGraphCalls: 0,
      liveWrites: 0,
    });
    expect(result.adapterMetrics.syntheticMutations).toBe(1);
  });

  it("replays the successful operation without a duplicate SharePoint mutation", async () => {
    const result = await runM51bApprovedSharePointSync();
    expect(result.replay).toMatchObject({
      operationId: result.delivery.operationId,
      status: "succeeded",
      attempts: result.delivery.attempts,
      retriesScheduled: result.delivery.retriesScheduled,
      replayed: true,
      errorCode: null,
    });
    expect(result.adapterMetrics.syntheticMutations).toBe(1);
  });

  it("routes exhausted SharePoint failures to a linked dead letter and operational alert", async () => {
    const result = await runM51bApprovedSharePointSync();
    const recovery = result.exhaustedFailureRecovery;

    expect(recovery.originalFailure).toMatchObject({
      channel: "sharepoint",
      status: "dead_lettered",
      duplicateSuppressed: false,
      replayed: false,
      liveCalls: 0,
      liveWrites: 0,
    });
    expect(recovery.originalFailure.attempts).toHaveLength(4);
    expect(
      recovery.originalFailure.attempts
        .slice(0, -1)
        .every((attempt) => attempt.retryScheduled),
    ).toBe(true);
    expect(recovery.originalFailure.attempts.at(-1)?.retryScheduled).toBe(false);
    expect(recovery.openedDeadLetter).toMatchObject({
      deadLetterId: recovery.originalFailure.deadLetterId,
      attempts: 4,
      replayEligible: true,
      state: "open",
      immutableOriginalFailure: true,
      synthetic: true,
    });
    expect(recovery.operationalAlert).toMatchObject({
      alertId: recovery.originalFailure.alertId,
      deadLetterId: recovery.openedDeadLetter.deadLetterId,
      channel: "sharepoint",
      severity: "high",
      escalationQueue: "SYNTH-QUEUE-M51B-SHAREPOINT-SUPPORT",
      acknowledged: false,
      synthetic: true,
    });
  });

  it("recovers the SharePoint dead letter only after governed replay and reconciles the actual adapter result", async () => {
    const result = await runM51bApprovedSharePointSync();
    const recovery = result.exhaustedFailureRecovery;

    expect(recovery.authorization).toMatchObject({
      authorizedRole: "managing-director",
      failureCorrected: true,
      privacyAndPermissionRevalidated: true,
      synthetic: true,
    });
    expect(recovery.recoveryGateDecision.allowed).toBe(true);
    expect(Object.values(recovery.recoveryGateDecision.gates).every(Boolean)).toBe(
      true,
    );
    expect(recovery.recovery).toMatchObject({
      channel: "sharepoint",
      status: "recovered",
      replayed: true,
      deadLetterId: recovery.openedDeadLetter.deadLetterId,
      alertId: recovery.operationalAlert.alertId,
      liveCalls: 0,
      liveWrites: 0,
    });
    expect(recovery.recovery.value).toEqual(result.desiredSource);
    expect(recovery.recoveredDeadLetter).toMatchObject({
      deadLetterId: recovery.openedDeadLetter.deadLetterId,
      state: "recovered",
      recoveryOperationId: recovery.recovery.operationId,
    });
    expect(recovery.contentReconciliation).toMatchObject({
      passed: true,
      differences: [],
      sourceUnchanged: true,
      liveRepositoryWrite: false,
    });
    expect(recovery.channelReconciliation).toMatchObject({
      accepted: true,
      openDeadLetterOperationIds: [],
      missingOperationIds: [],
      duplicateDeliveries: [],
      alertsRaised: 1,
      liveCalls: 0,
      liveWrites: 0,
    });
    expect(recovery.reliabilitySnapshot).toMatchObject({
      openDeadLetters: 0,
      recoveredDeadLetters: 1,
      alertsRaised: 1,
      duplicateDeliveries: 0,
      maximumAttempts: 4,
      liveCalls: 0,
      liveWrites: 0,
    });
    expect(recovery.accepted).toBe(true);
  });

  it("suppresses a replay duplicate before a second SharePoint mutation", async () => {
    const result = await runM51bApprovedSharePointSync();
    const recovery = result.exhaustedFailureRecovery;

    expect(recovery.duplicateReplay).toMatchObject({
      channel: "sharepoint",
      status: "duplicate_suppressed",
      duplicateSuppressed: true,
      replayed: true,
    });
    expect(recovery.mutationsBeforeRecovery).toBe(0);
    expect(recovery.mutationsAfterRecovery).toBe(1);
    expect(recovery.mutationsAfterDuplicateReplay).toBe(1);
    expect(recovery.duplicateMutationPrevented).toBe(true);
  });

  it("denies recovery when a non-governance role attempts the SharePoint replay", () => {
    const unauthorized: M51BReplayAuthorization = {
      authorizedBy: "SYNTH-M51B-ACTOR-CASE-MANAGER",
      authorizedRole: "case-manager",
      authorizedAt: "2026-07-15T12:04:00.000Z",
      failureCorrected: true,
      privacyAndPermissionRevalidated: true,
      synthetic: true,
    };

    expect(() =>
      runM51bSharePointExhaustedFailureRecovery({
        authorization: unauthorized,
      }),
    ).toThrow("M51B_REPLAY_AUTHORIZATION_DENIED");
  });

  it("denies recovery when permission and privacy have not been revalidated", () => {
    const unvalidated: M51BReplayAuthorization = {
      authorizedBy: "SYNTH-M51B-ACTOR-MANAGING-DIRECTOR",
      authorizedRole: "managing-director",
      authorizedAt: "2026-07-15T12:04:00.000Z",
      failureCorrected: true,
      privacyAndPermissionRevalidated: false,
      synthetic: true,
    };

    expect(() =>
      runM51bSharePointExhaustedFailureRecovery({
        authorization: unvalidated,
      }),
    ).toThrow("M51B_REPLAY_AUTHORIZATION_DENIED");
  });
});
