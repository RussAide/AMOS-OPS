import type { M52ApprovedWorkflowId } from "@contracts/m52/shared";
import {
  evaluateM52OfflineCapability,
  type M52CacheWriteRequest,
  type M52DeviceAttestation,
  type M52DeviceSecurityCoordinator,
  type M52OfflineAction,
} from "../security";
import {
  M52OfflineSyncEngine,
  type M52ConflictResolution,
  type M52DeterministicClock,
  type M52EnqueueResult,
  type M52PurgeResult,
  type M52QueueEntrySnapshot,
  type M52ReconciliationReport,
  type M52RecordPayload,
  type M52SyncLineage,
  type M52SyncPassResult,
  type M52SyntheticSyncDestination,
} from "../sync";

export interface M52SecureRuntimeContext {
  readonly sessionId: string;
  readonly devicePosture: M52DeviceAttestation;
  readonly workflowId: M52ApprovedWorkflowId;
  readonly action: M52OfflineAction;
  readonly youthId: string;
  readonly evaluatedAt: string;
}

export interface M52SecureRuntimeEnqueueRequest {
  readonly cacheRequest: M52CacheWriteRequest;
  readonly operationId: string;
  readonly idempotencyKey: string;
  readonly expectedDestinationVersion: number;
  readonly deviceUpdatedAt: string;
  readonly deviceClockOffsetMs: number;
  readonly evaluatedAt: string;
}

export interface M52SecureRuntimeEnqueueResult {
  readonly cacheEntryId: string;
  readonly ciphertextOnlyPersistence: true;
  readonly persistedPlaintextBytes: 0;
  readonly queue: M52EnqueueResult;
  readonly lineage: Readonly<M52SyncLineage>;
  readonly synthetic: true;
}

function requirePayloadObject(payload: unknown): M52RecordPayload {
  if (!payload || Array.isArray(payload) || typeof payload !== "object")
    throw new Error("M52_RUNTIME_WORKFLOW_PAYLOAD_OBJECT_REQUIRED");
  return payload as M52RecordPayload;
}

function sameLineage(
  left: Readonly<M52SyncLineage>,
  right: Readonly<M52SyncLineage>,
): boolean {
  return (Object.keys(left) as (keyof M52SyncLineage)[]).every(
    (key) => left[key] === right[key],
  );
}

function deriveAuthorizedLineage(
  security: M52DeviceSecurityCoordinator,
  context: M52SecureRuntimeContext,
): Readonly<M52SyncLineage> {
  const before = security.sessions.inspect(context.sessionId);
  if (
    before.deviceId !== context.devicePosture.deviceId ||
    before.installationId !== context.devicePosture.installationId
  )
    throw new Error("M52_RUNTIME_SESSION_DEVICE_POSTURE_MISMATCH");
  const binding = security.devices.revalidatePosture(
    context.devicePosture,
    context.evaluatedAt,
  );
  const session = security.sessions.requireActive(
    context.sessionId,
    binding,
    context.evaluatedAt,
    false,
  );
  if (!session.principal.youthScopeIds.includes(context.youthId))
    throw new Error("M52_RUNTIME_YOUTH_SCOPE_DENIED");
  const decision = evaluateM52OfflineCapability({
    workflowId: context.workflowId,
    action: context.action,
    role: session.principal.role,
    divisionId: session.principal.divisionId,
    youthId: context.youthId,
    online: false,
    deviceCompliant: true,
    sessionActive: true,
    synthetic: true,
  });
  if (!decision.allowed)
    throw new Error(
      `M52_RUNTIME_OFFLINE_ACTION_DENIED:${decision.reasonCodes.join(",")}`,
    );
  return Object.freeze({
    sessionId: session.sessionId,
    deviceId: session.deviceId,
    installationId: session.installationId,
    userId: session.principal.userId,
    role: session.principal.role,
    divisionId: session.principal.divisionId,
    youthId: context.youthId,
    action: context.action,
    boundary: "SYNTHETIC_PROTOTYPE",
  });
}

/**
 * The only application-facing M5.2 mutation boundary. It joins live posture
 * revalidation, an active server-held session, workflow authorization,
 * ciphertext persistence, trusted queue lineage, reconnect, conflict review,
 * and the common purge lifecycle. The underlying adapters remain synthetic.
 */
export class M52SecureOfflineRuntime {
  readonly security: M52DeviceSecurityCoordinator;
  readonly sync: M52OfflineSyncEngine;
  readonly lineage: Readonly<M52SyncLineage>;
  readonly context: Readonly<M52SecureRuntimeContext>;

  constructor(input: {
    readonly security: M52DeviceSecurityCoordinator;
    readonly clock: M52DeterministicClock;
    readonly destination: M52SyntheticSyncDestination;
    readonly context: M52SecureRuntimeContext;
    readonly maximumAttempts?: number;
    readonly retryDelaysMs?: readonly number[];
  }) {
    this.security = input.security;
    this.context = Object.freeze({ ...input.context });
    this.lineage = deriveAuthorizedLineage(this.security, this.context);
    this.sync = new M52OfflineSyncEngine({
      clock: input.clock,
      destination: input.destination,
      maximumAttempts: input.maximumAttempts,
      retryDelaysMs: input.retryDelaysMs,
      auditActorId: this.lineage.userId,
      trustedLineage: this.lineage,
    });
  }

  enqueue(
    input: M52SecureRuntimeEnqueueRequest,
  ): Readonly<M52SecureRuntimeEnqueueResult> {
    const lineage = this.authorize(input.evaluatedAt);
    if (
      input.cacheRequest.workflowId !== this.context.workflowId ||
      input.cacheRequest.youthId !== this.context.youthId
    )
      throw new Error("M52_RUNTIME_CACHE_REQUEST_SCOPE_MISMATCH");
    const write = this.security.writeCachedIntent({
      sessionId: this.context.sessionId,
      action: this.context.action,
      devicePosture: this.context.devicePosture,
      request: input.cacheRequest,
      evaluatedAt: input.evaluatedAt,
    });
    const cached = this.security.readCachedRecord({
      sessionId: this.context.sessionId,
      action: "view-minimum-necessary",
      devicePosture: this.context.devicePosture,
      workflowId: this.context.workflowId,
      entryId: input.cacheRequest.entryId,
      youthId: this.context.youthId,
      evaluatedAt: input.evaluatedAt,
    });
    if (!cached) throw new Error("M52_RUNTIME_ENCRYPTED_INTENT_NOT_READABLE");
    const queue = this.sync.enqueue({
      operationId: input.operationId,
      idempotencyKey: input.idempotencyKey,
      recordId: cached.recordId,
      workflow: cached.workflowId,
      payload: requirePayloadObject(cached.payload),
      expectedDestinationVersion: input.expectedDestinationVersion,
      deviceUpdatedAt: input.deviceUpdatedAt,
      deviceClockOffsetMs: input.deviceClockOffsetMs,
      lineage,
    });
    return Object.freeze({
      cacheEntryId: cached.entryId,
      ciphertextOnlyPersistence: true,
      persistedPlaintextBytes: write.persistedPlaintextBytes,
      queue,
      lineage,
      synthetic: true,
    });
  }

  /** Rehydrates the volatile transport queue from the encrypted cache. */
  recoverEncryptedIntent(
    input: Omit<M52SecureRuntimeEnqueueRequest, "cacheRequest"> & {
      readonly entryId: string;
      readonly recordId: string;
    },
  ): M52EnqueueResult {
    const lineage = this.authorize(input.evaluatedAt);
    const cached = this.security.readCachedRecord({
      sessionId: this.context.sessionId,
      action: "view-minimum-necessary",
      devicePosture: this.context.devicePosture,
      workflowId: this.context.workflowId,
      entryId: input.entryId,
      youthId: this.context.youthId,
      evaluatedAt: input.evaluatedAt,
    });
    if (!cached || cached.recordId !== input.recordId)
      throw new Error("M52_RUNTIME_ENCRYPTED_RECOVERY_RECORD_MISMATCH");
    return this.sync.enqueue({
      operationId: input.operationId,
      idempotencyKey: input.idempotencyKey,
      recordId: cached.recordId,
      workflow: cached.workflowId,
      payload: requirePayloadObject(cached.payload),
      expectedDestinationVersion: input.expectedDestinationVersion,
      deviceUpdatedAt: input.deviceUpdatedAt,
      deviceClockOffsetMs: input.deviceClockOffsetMs,
      lineage,
    });
  }

  reconnect(input: {
    readonly sessionId: string;
    readonly devicePosture: M52DeviceAttestation;
    readonly evaluatedAt: string;
  }): M52SyncPassResult {
    this.authorize(input.evaluatedAt, input.sessionId, input.devicePosture);
    return this.sync.reconnect();
  }

  resolveConflict(input: {
    readonly sessionId: string;
    readonly devicePosture: M52DeviceAttestation;
    readonly evaluatedAt: string;
    readonly queueId: string;
    readonly resolution: Omit<M52ConflictResolution, "resolvedBy">;
  }): M52QueueEntrySnapshot {
    const lineage = this.authorize(
      input.evaluatedAt,
      input.sessionId,
      input.devicePosture,
    );
    return this.sync.resolveConflict(input.queueId, {
      ...input.resolution,
      resolvedBy: lineage.userId,
    });
  }

  logout(occurredAt: string): Readonly<{
    security: ReturnType<M52DeviceSecurityCoordinator["logout"]>;
    queue: M52PurgeResult;
    synthetic: true;
  }> {
    const lineage = this.authorize(occurredAt);
    const security = this.security.logout(this.context.sessionId, occurredAt);
    const queue = this.sync.purgeLocalRuntime({
      scope: "full_runtime",
      requestedBy: lineage.userId,
      reason: "logout",
    });
    return Object.freeze({ security, queue, synthetic: true });
  }

  remoteRevokeAndWipe(input: {
    readonly requestedBy: string;
    readonly reason: string;
    readonly occurredAt: string;
  }) {
    const security = this.security.remoteRevokeAndWipe({
      deviceId: this.context.devicePosture.deviceId,
      ...input,
    });
    const queue = this.sync.purgeLocalRuntime({
      scope: "full_runtime",
      requestedBy: input.requestedBy,
      reason: "device_revoked",
    });
    return Object.freeze({ security, queue, synthetic: true as const });
  }

  controlledReinstall(input: {
    readonly requestedBy: string;
    readonly occurredAt: string;
    readonly newAttestation: M52DeviceAttestation;
  }) {
    const security = this.security.controlledReinstall({
      oldDeviceId: this.context.devicePosture.deviceId,
      ...input,
    });
    const queue = this.sync.purgeLocalRuntime({
      scope: "full_runtime",
      requestedBy: input.requestedBy,
      reason: "reinstall",
    });
    return Object.freeze({ security, queue, synthetic: true as const });
  }

  reconcile(): M52ReconciliationReport {
    return this.sync.reconcileRecords();
  }

  private authorize(
    evaluatedAt: string,
    sessionId = this.context.sessionId,
    devicePosture = this.context.devicePosture,
  ): Readonly<M52SyncLineage> {
    if (sessionId !== this.context.sessionId)
      throw new Error("M52_RUNTIME_SERVER_SESSION_MISMATCH");
    const derived = deriveAuthorizedLineage(this.security, {
      ...this.context,
      sessionId,
      devicePosture,
      evaluatedAt,
    });
    if (!sameLineage(derived, this.lineage))
      throw new Error("M52_RUNTIME_AUTHORIZED_LINEAGE_CHANGED");
    return derived;
  }
}
