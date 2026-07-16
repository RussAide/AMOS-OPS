import { describe, expect, it } from "vitest";
import type { M51aDeltaPage } from "@contracts/m51a/connector-reconciliation";
import {
  classifyM51aConnectorFailure,
  M51aConnectorSyncOrchestrator,
} from "../services/m51a/connectors/sync-orchestrator";
import {
  M51aSyntheticMicrosoftError,
  SyntheticM51aMicrosoftAdapter,
} from "../services/m51a/connectors/synthetic-microsoft-adapter";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "../services/m51a/connectors/synthetic-repository-fixtures";

function foundation() {
  const repositories = createSyntheticM51aConnectorRegistryEntries();
  const items = createSyntheticM51aMicrosoftItems(repositories);
  const adapter = new SyntheticM51aMicrosoftAdapter(repositories, items);
  const orchestrator = new M51aConnectorSyncOrchestrator({
    repositories,
    adapter,
  });
  return { repositories, items, adapter, orchestrator };
}

describe("M5.1A idempotency, retry, delta, and checkpoint reliability", () => {
  it("classifies throttling, transient failure, conflict, expired delta, and hard failure", () => {
    expect(
      classifyM51aConnectorFailure(
        new M51aSyntheticMicrosoftError(
          429,
          "M51A_GRAPH_THROTTLED",
          2_750,
        ),
        1,
      ),
    ).toEqual({
      disposition: "retry",
      code: "M51A_GRAPH_THROTTLED",
      delayMs: 2_750,
      status: 429,
      retryAfterHonored: true,
    });
    expect(
      classifyM51aConnectorFailure(
        new M51aSyntheticMicrosoftError(503, "M51A_GRAPH_UNAVAILABLE"),
        2,
      ),
    ).toMatchObject({ disposition: "retry", delayMs: 1_000 });
    expect(
      classifyM51aConnectorFailure(
        new M51aSyntheticMicrosoftError(412, "M51A_ETAG_PRECONDITION_FAILED"),
        1,
      ).disposition,
    ).toBe("conflict");
    expect(
      classifyM51aConnectorFailure(
        new M51aSyntheticMicrosoftError(410, "M51A_DELTA_TOKEN_EXPIRED"),
        1,
      ).disposition,
    ).toBe("resync_required");
    expect(
      classifyM51aConnectorFailure(
        new M51aSyntheticMicrosoftError(403, "M51A_GRAPH_FORBIDDEN"),
        1,
      ).disposition,
    ).toBe("fail");
    expect(classifyM51aConnectorFailure(new Error("ETIMEDOUT"), 3)).toMatchObject({
      disposition: "retry",
      delayMs: 2_000,
    });
  });

  it("honors Retry-After without sleeping and replays one logical result exactly once", async () => {
    const { orchestrator } = foundation();
    let executions = 0;
    const request = {
      idempotencyKey: "SYNTH-IDEMPOTENCY-THROTTLE-001",
      requestFingerprint: "sha256:synthetic-throttle-request",
      connectorId: "SYNTH-CONNECTOR-GOVERNANCE",
      operation: "metadata_read" as const,
      requestedAt: "2026-07-15T12:00:00.000Z",
    };
    const first = await orchestrator.executeIdempotent(request, (attempt) => {
      executions += 1;
      if (attempt === 1) {
        throw new M51aSyntheticMicrosoftError(
          429,
          "M51A_GRAPH_THROTTLED",
          2_750,
        );
      }
      return { read: "synthetic-success" };
    });
    const replay = await orchestrator.executeIdempotent(request, () => {
      executions += 1;
      return { read: "must-not-run" };
    });

    expect(first).toMatchObject({
      status: "succeeded",
      replayed: false,
      liveGraphCalls: 0,
      liveWrites: 0,
    });
    expect(first.attempts).toHaveLength(2);
    expect(first.attempts[0]).toMatchObject({
      outcome: "retry_scheduled",
      scheduledDelayMs: 2_750,
      status: 429,
    });
    expect(replay.operationId).toBe(first.operationId);
    expect(replay.value).toEqual(first.value);
    expect(replay.replayed).toBe(true);
    expect(executions).toBe(2);
    expect(orchestrator.listOperationLedger()).toHaveLength(1);
    expect(orchestrator.actualSleepCalls).toBe(0);

    await expect(
      orchestrator.executeIdempotent(
        { ...request, requestFingerprint: "sha256:different-payload" },
        () => ({ read: "never" }),
      ),
    ).rejects.toThrow("M51A_IDEMPOTENCY_KEY_PAYLOAD_MISMATCH");
  });

  it("bounds retries at four attempts and never blindly retries conflict or expired delta", async () => {
    const { orchestrator } = foundation();
    const exhausted = await orchestrator.executeIdempotent(
      {
        idempotencyKey: "SYNTH-IDEMPOTENCY-RETRY-EXHAUSTED",
        requestFingerprint: "sha256:synthetic-exhausted",
        connectorId: "SYNTH-CONNECTOR-GOVERNANCE",
        operation: "metadata_read",
        requestedAt: "2026-07-15T12:00:00.000Z",
      },
      () => {
        throw new M51aSyntheticMicrosoftError(
          503,
          "M51A_GRAPH_UNAVAILABLE",
        );
      },
    );
    const conflict = await orchestrator.executeIdempotent(
      {
        idempotencyKey: "SYNTH-IDEMPOTENCY-CONFLICT-001",
        requestFingerprint: "sha256:synthetic-conflict",
        connectorId: "SYNTH-CONNECTOR-GOVERNANCE",
        operation: "metadata_write",
        requestedAt: "2026-07-15T12:01:00.000Z",
      },
      () => {
        throw new M51aSyntheticMicrosoftError(
          412,
          "M51A_ETAG_PRECONDITION_FAILED",
        );
      },
    );
    const expired = await orchestrator.executeIdempotent(
      {
        idempotencyKey: "SYNTH-IDEMPOTENCY-DELTA-EXPIRED",
        requestFingerprint: "sha256:synthetic-delta-expired",
        connectorId: "SYNTH-CONNECTOR-GOVERNANCE",
        operation: "reconcile",
        requestedAt: "2026-07-15T12:02:00.000Z",
      },
      () => {
        throw new M51aSyntheticMicrosoftError(
          410,
          "M51A_DELTA_TOKEN_EXPIRED",
        );
      },
    );

    expect(exhausted).toMatchObject({
      status: "failed",
      errorCode: "M51A_RETRY_EXHAUSTED:M51A_GRAPH_UNAVAILABLE",
    });
    expect(exhausted.attempts).toHaveLength(4);
    expect(exhausted.attempts.slice(0, 3).map((attempt) => attempt.scheduledDelayMs)).toEqual([
      500, 1_000, 2_000,
    ]);
    expect(conflict.status).toBe("conflict");
    expect(conflict.attempts).toHaveLength(1);
    expect(expired.status).toBe("resync_required");
    expect(expired.attempts).toHaveLength(1);
  });

  it("processes next cursors through a delta link and advances only after reconciliation", async () => {
    const { adapter, orchestrator } = foundation();
    const connectorId = "SYNTH-CONNECTOR-GOVERNANCE";
    const baseline = await orchestrator.runControlledFullResync({
      connectorId,
      idempotencyKey: "SYNTH-IDEMPOTENCY-FULL-RESYNC-GOV-001",
      requestFingerprint: "sha256:synthetic-full-resync-gov-001",
    });
    expect(baseline.status).toBe("succeeded");
    const baselineCheckpoint = baseline.value!.checkpoint;
    const original = adapter.listItems(connectorId)[0];
    const updated = adapter.applySyntheticMetadataPatch({
      stableObjectId: original.stableObjectId,
      expectedETag: original.eTag,
      patch: {
        name: "Enterprise-Doctrine-Delta.docx",
        path:
          "/sites/operations-hub/Enterprise Governance & Doctrine/Enterprise-Doctrine-Delta.docx",
      },
      modifiedAt: "2026-07-15T13:00:00.000Z",
    });
    const pages: readonly M51aDeltaPage[] = [
      {
        connectorId,
        cursor: baselineCheckpoint.checkpoint,
        changes: [],
        deletedAddresses: [],
        nextCursor: "SYNTH-DELTA-NEXT-GOV-001",
        deltaLink: null,
        synthetic: true,
      },
      {
        connectorId,
        cursor: "SYNTH-DELTA-NEXT-GOV-001",
        changes: [updated],
        deletedAddresses: [],
        nextCursor: null,
        deltaLink: "SYNTH-DELTA-LINK-GOV-002",
        synthetic: true,
      },
    ];
    adapter.configureDeltaPages(connectorId, pages);

    const delta = await orchestrator.runDeltaSync({
      connectorId,
      idempotencyKey: "SYNTH-IDEMPOTENCY-DELTA-GOV-002",
      requestFingerprint: "sha256:synthetic-delta-gov-002",
      requestedAt: "2026-07-15T13:00:00.000Z",
    });
    expect(delta).toMatchObject({
      status: "succeeded",
      replayed: false,
      value: {
        pagesProcessed: 2,
        resyncPerformed: false,
        report: { passed: true, unexplainedDifferenceCount: 0 },
        checkpoint: {
          checkpoint: "SYNTH-DELTA-LINK-GOV-002",
          checkpointKind: "delta_link",
        },
      },
    });
    expect(orchestrator.getCheckpoint(connectorId)).toEqual(
      delta.value!.checkpoint,
    );
    expect(orchestrator.getMirror(connectorId)[0]).toEqual(updated);
    expect(adapter.metrics()).toMatchObject({
      liveGraphCalls: 0,
      liveWrites: 0,
      credentialReads: 0,
    });

    const replay = await orchestrator.runDeltaSync({
      connectorId,
      idempotencyKey: "SYNTH-IDEMPOTENCY-DELTA-GOV-002",
      requestFingerprint: "sha256:synthetic-delta-gov-002",
      requestedAt: "2026-07-15T13:00:00.000Z",
    });
    expect(replay.replayed).toBe(true);
    expect(replay.operationId).toBe(delta.operationId);
  });

  it("holds the checkpoint on a reconciliation conflict", async () => {
    const { adapter, orchestrator } = foundation();
    const connectorId = "SYNTH-CONNECTOR-PUBLISHED";
    const baseline = await orchestrator.runControlledFullResync({
      connectorId,
      idempotencyKey: "SYNTH-IDEMPOTENCY-FULL-PUBLISHED-001",
      requestFingerprint: "sha256:synthetic-full-published-001",
    });
    const checkpointBefore = baseline.value!.checkpoint;
    const original = adapter.listItems(connectorId)[0];
    adapter.applySyntheticMetadataPatch({
      stableObjectId: original.stableObjectId,
      expectedETag: original.eTag,
      patch: { name: "Published-Changed-Without-Delta.aspx" },
      modifiedAt: "2026-07-15T13:10:00.000Z",
    });
    adapter.configureDeltaPages(connectorId, [
      {
        connectorId,
        cursor: checkpointBefore.checkpoint,
        changes: [],
        deletedAddresses: [],
        nextCursor: null,
        deltaLink: "SYNTH-DELTA-LINK-PUBLISHED-CONFLICT",
        synthetic: true,
      },
    ]);
    const result = await orchestrator.runDeltaSync({
      connectorId,
      idempotencyKey: "SYNTH-IDEMPOTENCY-DELTA-PUBLISHED-CONFLICT",
      requestFingerprint: "sha256:synthetic-delta-published-conflict",
      requestedAt: "2026-07-15T13:10:00.000Z",
    });
    expect(result.status).toBe("conflict");
    expect(result.errorCode).toBe("M51A_DELTA_RECONCILIATION_CONFLICT");
    expect(result.attempts).toHaveLength(1);
    expect(orchestrator.getCheckpoint(connectorId)).toEqual(checkpointBefore);
    expect(orchestrator.getMirror(connectorId)[0]).toEqual(original);
  });

  it("turns 410 into a controlled full resync without advancing the stale checkpoint", async () => {
    const { adapter, orchestrator } = foundation();
    const connectorId = "SYNTH-CONNECTOR-CONTRACTS";
    const baseline = await orchestrator.runControlledFullResync({
      connectorId,
      idempotencyKey: "SYNTH-IDEMPOTENCY-FULL-CONTRACTS-001",
      requestFingerprint: "sha256:synthetic-full-contracts-001",
    });
    const staleCheckpoint = baseline.value!.checkpoint;
    adapter.configureDeltaFailure(
      connectorId,
      staleCheckpoint.checkpoint,
      new M51aSyntheticMicrosoftError(410, "M51A_DELTA_TOKEN_EXPIRED"),
    );
    const delta = await orchestrator.runDeltaSync({
      connectorId,
      idempotencyKey: "SYNTH-IDEMPOTENCY-DELTA-CONTRACTS-EXPIRED",
      requestFingerprint: "sha256:synthetic-delta-contracts-expired",
      requestedAt: "2026-07-15T13:20:00.000Z",
    });
    expect(delta.status).toBe("resync_required");
    expect(delta.attempts).toHaveLength(1);
    expect(orchestrator.getCheckpoint(connectorId)).toEqual(staleCheckpoint);

    const recovered = await orchestrator.runControlledFullResync({
      connectorId,
      idempotencyKey: "SYNTH-IDEMPOTENCY-FULL-CONTRACTS-RECOVERY",
      requestFingerprint: "sha256:synthetic-full-contracts-recovery",
      requestedAt: "2026-07-15T13:21:00.000Z",
    });
    expect(recovered).toMatchObject({
      status: "succeeded",
      value: {
        resyncPerformed: true,
        report: { passed: true },
        checkpoint: { checkpointKind: "full_resync" },
      },
    });
    expect(orchestrator.getCheckpoint(connectorId)).toEqual(
      recovered.value!.checkpoint,
    );
    expect(orchestrator.getCheckpoint(connectorId)).not.toEqual(staleCheckpoint);
  });
});
