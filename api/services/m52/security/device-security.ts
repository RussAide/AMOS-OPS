import { ALL_ROLES } from "../../../../src/constants/roles";
import {
  evaluateM52OfflineCapability,
  extractM52MedicationStaffAttestation,
  getM52OfflineWorkflowPolicy,
} from "./capability-policy";
import { M52DeviceRegistry } from "./device-policy";
import { M52EncryptedLocalCache } from "./encrypted-cache";
import {
  M52_SYNTHETIC_BOUNDARY,
  type M52CachePrincipal,
  type M52CachedRecord,
  type M52CacheWriteRequest,
  type M52CacheWriteResult,
  type M52DeviceAttestation,
  type M52DeviceBinding,
  type M52OfflineAction,
  type M52OfflineSession,
  type M52RemoteWipeResult,
  type M52SecurityAuditEvent,
  type M52SecurityBoundarySnapshot,
  type M52SessionState,
} from "./types";
import {
  deepFreeze,
  parseTimestamp,
  requireSyntheticBoundary,
  requireSyntheticId,
  sha256,
} from "./support";

export const M52_IDLE_SESSION_TIMEOUT_MS = 15 * 60 * 1_000;
export const M52_ABSOLUTE_SESSION_TIMEOUT_MS = 8 * 60 * 60 * 1_000;

interface MutableSessionRecord {
  sessionId: string;
  deviceId: string;
  installationId: string;
  principal: M52CachePrincipal;
  startedAt: string;
  lastActivityAt: string;
  absoluteExpiresAt: string;
  state: M52SessionState;
}

function validatePrincipal(principal: M52CachePrincipal): void {
  requireSyntheticBoundary(principal);
  requireSyntheticId(principal.userId, "user_id");
  if (!ALL_ROLES.includes(principal.role)) throw new Error("M52_ROLE_NOT_CANONICAL");
  if (principal.youthScopeIds.length === 0) throw new Error("M52_YOUTH_SCOPE_REQUIRED");
  for (const youthId of principal.youthScopeIds) {
    requireSyntheticId(youthId, "youth_id");
  }
}

function immutablePrincipal(principal: M52CachePrincipal): M52CachePrincipal {
  return deepFreeze({
    ...principal,
    youthScopeIds: [...principal.youthScopeIds],
  }) as M52CachePrincipal;
}

export interface M52SessionSnapshot {
  readonly total: number;
  readonly active: number;
  readonly loggedOut: number;
  readonly timedOut: number;
  readonly deviceRevoked: number;
  readonly persistedSessionTokens: 0;
  readonly synthetic: true;
}

/** In-memory synthetic session state; no session credential is persisted. */
export class M52OfflineSessionManager {
  private readonly sessions = new Map<string, MutableSessionRecord>();

  start(
    sessionId: string,
    binding: M52DeviceBinding,
    principal: M52CachePrincipal,
    startedAt: string,
  ): Readonly<M52OfflineSession> {
    requireSyntheticId(sessionId, "session_id");
    requireSyntheticBoundary(binding);
    validatePrincipal(principal);
    if (binding.state !== "active") throw new Error("M52_DEVICE_NOT_ACTIVE");
    if (this.sessions.has(sessionId)) throw new Error("M52_SESSION_ID_REUSED");
    const started = parseTimestamp(startedAt, "session_started_at");
    const record: MutableSessionRecord = {
      sessionId,
      deviceId: binding.deviceId,
      installationId: binding.installationId,
      principal: immutablePrincipal(principal),
      startedAt,
      lastActivityAt: startedAt,
      absoluteExpiresAt: new Date(started + M52_ABSOLUTE_SESSION_TIMEOUT_MS).toISOString(),
      state: "active",
    };
    this.sessions.set(sessionId, record);
    return this.snapshotRecord(record);
  }

  requireActive(
    sessionId: string,
    binding: M52DeviceBinding,
    evaluatedAt: string,
    touch = true,
  ): Readonly<M52OfflineSession> {
    const record = this.record(sessionId);
    if (record.state !== "active") {
      throw new Error(`M52_SESSION_NOT_ACTIVE:${record.state}`);
    }
    if (
      record.deviceId !== binding.deviceId ||
      record.installationId !== binding.installationId
    ) {
      throw new Error("M52_SESSION_DEVICE_BINDING_MISMATCH");
    }
    if (binding.state !== "active") {
      record.state = "device-revoked";
      throw new Error("M52_SESSION_DEVICE_REVOKED");
    }
    const evaluated = parseTimestamp(evaluatedAt, "session_evaluated_at");
    const started = parseTimestamp(record.startedAt, "session_started_at");
    const lastActivity = parseTimestamp(
      record.lastActivityAt,
      "session_last_activity_at",
    );
    if (evaluated < lastActivity || evaluated < started) {
      throw new Error("M52_SESSION_CLOCK_ROLLBACK_DENIED");
    }
    if (evaluated >= parseTimestamp(record.absoluteExpiresAt, "session_absolute_expires_at")) {
      record.state = "absolute-timeout";
      throw new Error("M52_SESSION_ABSOLUTE_TIMEOUT");
    }
    if (evaluated - lastActivity >= M52_IDLE_SESSION_TIMEOUT_MS) {
      record.state = "idle-timeout";
      throw new Error("M52_SESSION_IDLE_TIMEOUT");
    }
    if (touch) record.lastActivityAt = evaluatedAt;
    return this.snapshotRecord(record);
  }

  inspect(sessionId: string): Readonly<M52OfflineSession> {
    return this.snapshotRecord(this.record(sessionId));
  }

  logout(sessionId: string, occurredAt: string): Readonly<M52OfflineSession> {
    const record = this.record(sessionId);
    parseTimestamp(occurredAt, "session_logout_at");
    if (record.state !== "active") throw new Error("M52_SESSION_NOT_ACTIVE");
    record.state = "logged-out";
    record.lastActivityAt = occurredAt;
    return this.snapshotRecord(record);
  }

  revokeDevice(deviceId: string): number {
    requireSyntheticId(deviceId, "device_id");
    let revoked = 0;
    for (const session of this.sessions.values()) {
      if (session.deviceId === deviceId && session.state === "active") {
        session.state = "device-revoked";
        revoked += 1;
      }
    }
    return revoked;
  }

  summary(): Readonly<M52SessionSnapshot> {
    const sessions = [...this.sessions.values()];
    return deepFreeze({
      total: sessions.length,
      active: sessions.filter((session) => session.state === "active").length,
      loggedOut: sessions.filter((session) => session.state === "logged-out").length,
      timedOut: sessions.filter(
        (session) =>
          session.state === "idle-timeout" || session.state === "absolute-timeout",
      ).length,
      deviceRevoked: sessions.filter(
        (session) => session.state === "device-revoked",
      ).length,
      persistedSessionTokens: 0,
      synthetic: true,
    });
  }

  private record(sessionId: string): MutableSessionRecord {
    requireSyntheticId(sessionId, "session_id");
    const record = this.sessions.get(sessionId);
    if (!record) throw new Error("M52_SESSION_NOT_FOUND");
    return record;
  }

  private snapshotRecord(record: MutableSessionRecord): Readonly<M52OfflineSession> {
    return deepFreeze({
      sessionId: record.sessionId,
      deviceId: record.deviceId,
      installationId: record.installationId,
      principal: immutablePrincipal(record.principal),
      startedAt: record.startedAt,
      lastActivityAt: record.lastActivityAt,
      absoluteExpiresAt: record.absoluteExpiresAt,
      state: record.state,
      boundary: M52_SYNTHETIC_BOUNDARY,
      synthetic: true,
    });
  }
}

export interface M52AuthorizedCacheWrite {
  readonly sessionId: string;
  readonly action: M52OfflineAction;
  readonly devicePosture: M52DeviceAttestation;
  readonly request: M52CacheWriteRequest;
  readonly evaluatedAt: string;
}

export interface M52AuthorizedCacheRead {
  readonly sessionId: string;
  readonly action: M52OfflineAction;
  readonly devicePosture: M52DeviceAttestation;
  readonly workflowId: M52CacheWriteRequest["workflowId"];
  readonly entryId: string;
  readonly youthId: string;
  readonly evaluatedAt: string;
}

export interface M52LogoutResult {
  readonly sessionId: string;
  readonly state: "logged-out";
  readonly deletedCiphertextEnvelopes: number;
  readonly remainingUserDeviceEnvelopes: 0;
  readonly synthetic: true;
}

export interface M52ReinstallResult {
  readonly oldInstallationId: string;
  readonly newBinding: M52DeviceBinding;
  readonly deletedCiphertextEnvelopes: number;
  readonly revokedSessions: number;
  readonly oldCacheReadable: false;
  readonly synthetic: true;
}

/**
 * Composes device policy, binding, sessions, capability policy, encryption,
 * revocation, and wipe without any production connector or device side effect.
 */
export class M52DeviceSecurityCoordinator {
  readonly devices: M52DeviceRegistry;
  readonly sessions: M52OfflineSessionManager;
  readonly cache: M52EncryptedLocalCache;

  constructor(input: {
    readonly cache: M52EncryptedLocalCache;
    readonly devices?: M52DeviceRegistry;
    readonly sessions?: M52OfflineSessionManager;
  }) {
    this.cache = input.cache;
    this.devices = input.devices ?? new M52DeviceRegistry();
    this.sessions = input.sessions ?? new M52OfflineSessionManager();
  }

  enrollDevice(
    attestation: M52DeviceAttestation,
    evaluatedAt: string,
  ): Readonly<M52DeviceBinding> {
    return this.devices.enroll(attestation, evaluatedAt);
  }

  startSession(
    sessionId: string,
    deviceId: string,
    installationId: string,
    principal: M52CachePrincipal,
    startedAt: string,
  ): Readonly<M52OfflineSession> {
    const binding = this.devices.assertActive(deviceId, installationId);
    return this.sessions.start(sessionId, binding, principal, startedAt);
  }

  writeCachedIntent(
    input: M52AuthorizedCacheWrite,
  ): Readonly<M52CacheWriteResult> {
    const sessionBeforeTouch = this.sessions.inspect(input.sessionId);
    if (
      input.devicePosture.deviceId !== sessionBeforeTouch.deviceId ||
      input.devicePosture.installationId !== sessionBeforeTouch.installationId
    ) {
      throw new Error("M52_DEVICE_POSTURE_SESSION_MISMATCH");
    }
    const binding = this.devices.revalidatePosture(
      input.devicePosture,
      input.evaluatedAt,
    );
    const session = this.sessions.requireActive(
      input.sessionId,
      binding,
      input.evaluatedAt,
    );
    const decision = evaluateM52OfflineCapability({
      workflowId: input.request.workflowId,
      action: input.action,
      role: session.principal.role,
      divisionId: session.principal.divisionId,
      youthId: input.request.youthId,
      online: false,
      deviceCompliant: true,
      sessionActive: true,
      synthetic: true,
    });
    if (!decision.allowed) {
      throw new Error(`M52_OFFLINE_ACTION_DENIED:${decision.reasonCodes.join(",")}`);
    }
    const policy = getM52OfflineWorkflowPolicy(input.request.workflowId);
    const ttl =
      parseTimestamp(input.request.expiresAt, "cache_expires_at") -
      parseTimestamp(input.request.createdAt, "cache_created_at");
    if (ttl > policy.maxCacheMinutes * 60_000) {
      throw new Error("M52_WORKFLOW_CACHE_TTL_EXCEEDED");
    }
    if (input.request.workflowId === "gro_tablet_medication_pass") {
      const attestation = extractM52MedicationStaffAttestation(
        input.request.payload,
      );
      if (attestation.sessionId !== input.sessionId) {
        throw new Error("M52_MEDICATION_STAFF_ATTESTATION_SESSION_DENIED");
      }
    }
    return this.cache.put(binding, session.principal, input.request);
  }

  readCachedRecord(
    input: M52AuthorizedCacheRead,
  ): Readonly<M52CachedRecord> | null {
    const sessionBeforeTouch = this.sessions.inspect(input.sessionId);
    if (
      input.devicePosture.deviceId !== sessionBeforeTouch.deviceId ||
      input.devicePosture.installationId !== sessionBeforeTouch.installationId
    ) {
      throw new Error("M52_DEVICE_POSTURE_SESSION_MISMATCH");
    }
    const binding = this.devices.revalidatePosture(
      input.devicePosture,
      input.evaluatedAt,
    );
    const session = this.sessions.requireActive(
      input.sessionId,
      binding,
      input.evaluatedAt,
    );
    const decision = evaluateM52OfflineCapability({
      workflowId: input.workflowId,
      action: input.action,
      role: session.principal.role,
      divisionId: session.principal.divisionId,
      youthId: input.youthId,
      online: false,
      deviceCompliant: true,
      sessionActive: true,
      synthetic: true,
    });
    if (!decision.allowed) {
      throw new Error(`M52_OFFLINE_ACTION_DENIED:${decision.reasonCodes.join(",")}`);
    }
    return this.cache.get(
      binding,
      session.principal,
      input.entryId,
      input.youthId,
      input.evaluatedAt,
    );
  }

  logout(sessionId: string, occurredAt: string): Readonly<M52LogoutResult> {
    const session = this.sessions.inspect(sessionId);
    const binding = this.devices.currentBinding(session.deviceId);
    const deleted = this.cache.wipeUserFromDevice(binding, session.principal);
    this.sessions.logout(sessionId, occurredAt);
    return deepFreeze({
      sessionId,
      state: "logged-out",
      deletedCiphertextEnvelopes: deleted,
      remainingUserDeviceEnvelopes: 0,
      synthetic: true,
    });
  }

  remoteRevokeAndWipe(input: {
    readonly deviceId: string;
    readonly requestedBy: string;
    readonly reason: string;
    readonly occurredAt: string;
  }): Readonly<M52RemoteWipeResult> {
    requireSyntheticId(input.requestedBy, "wipe_actor_id");
    const before = this.devices.currentBinding(input.deviceId);
    this.devices.revoke(input.deviceId, input.reason, input.occurredAt);
    const revokedSessions = this.sessions.revokeDevice(input.deviceId);
    this.devices.markWipePending(input.deviceId, input.occurredAt);
    const deleted = this.cache.wipeDevice(input.deviceId);
    const after = this.devices.markWiped(input.deviceId, input.occurredAt);
    const digest = sha256("M52-DEVICE", input.deviceId);
    const auditEvents: readonly M52SecurityAuditEvent[] = deepFreeze([
      this.audit(
        `${before.installationId}-REVOKED`,
        "m52.device.remote-revoked",
        input.occurredAt,
        input.requestedBy,
        digest,
        "revoked",
        [input.reason],
      ),
      this.audit(
        `${before.installationId}-WIPED`,
        "m52.cache.remote-wipe-verified",
        input.occurredAt,
        input.requestedBy,
        digest,
        "wiped",
        [
          "M52_DEVICE_CIPHERTEXT_REMOVED",
          "M52_DEVICE_SESSIONS_INVALIDATED",
        ],
      ),
    ]);
    if (after.state !== "wiped" || this.cache.deviceEnvelopeCount(input.deviceId) !== 0) {
      throw new Error("M52_REMOTE_WIPE_VERIFICATION_FAILED");
    }
    return deepFreeze({
      deviceId: input.deviceId,
      revokedSessions,
      deletedCiphertextEnvelopes: deleted,
      remainingDeviceEnvelopes: 0,
      finalState: "wiped",
      auditEvents,
      liveMdmCalls: 0,
      liveDeviceCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }

  controlledReinstall(input: {
    readonly oldDeviceId: string;
    readonly requestedBy: string;
    readonly occurredAt: string;
    readonly newAttestation: M52DeviceAttestation;
  }): Readonly<M52ReinstallResult> {
    if (input.oldDeviceId !== input.newAttestation.deviceId) {
      throw new Error("M52_REINSTALL_DEVICE_ID_MISMATCH");
    }
    const oldBinding = this.devices.currentBinding(input.oldDeviceId);
    if (oldBinding.installationId === input.newAttestation.installationId) {
      throw new Error("M52_REINSTALL_REQUIRES_NEW_INSTALLATION_ID");
    }
    const wipe = this.remoteRevokeAndWipe({
      deviceId: input.oldDeviceId,
      requestedBy: input.requestedBy,
      reason: "M52_CONTROLLED_REINSTALL",
      occurredAt: input.occurredAt,
    });
    this.devices.recordControlledReinstall();
    const newBinding = this.devices.enroll(input.newAttestation, input.occurredAt);
    return deepFreeze({
      oldInstallationId: oldBinding.installationId,
      newBinding,
      deletedCiphertextEnvelopes: wipe.deletedCiphertextEnvelopes,
      revokedSessions: wipe.revokedSessions,
      oldCacheReadable: false,
      synthetic: true,
    });
  }

  boundarySnapshot(): Readonly<M52SecurityBoundarySnapshot> {
    return deepFreeze({
      boundary: M52_SYNTHETIC_BOUNDARY,
      syntheticOnly: true,
      realDataUsed: false,
      productionRows: 0,
      plaintextPayloadsPersisted: 0,
      liveMdmCalls: 0,
      liveDeviceCalls: 0,
      liveWrites: 0,
      liveNotifications: 0,
      productionDeployment: false,
      githubPush: false,
    });
  }

  private audit(
    suffix: string,
    eventType: string,
    occurredAt: string,
    actorId: string,
    deviceDigest: string,
    outcome: M52SecurityAuditEvent["outcome"],
    reasonCodes: readonly string[],
  ): M52SecurityAuditEvent {
    return deepFreeze({
      eventId: `SYNTH-M52-AUDIT-${sha256(suffix, occurredAt).slice(0, 20).toUpperCase()}`,
      eventType,
      occurredAt,
      actorId,
      deviceDigest,
      outcome,
      reasonCodes: [...reasonCodes],
      immutable: true,
      liveCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
  }
}
