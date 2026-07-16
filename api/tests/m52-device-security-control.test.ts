import { describe, expect, it } from "vitest";
import {
  M52_ABSOLUTE_SESSION_TIMEOUT_MS,
  M52_DEVICE_CONTROL_LIMITS,
  M52_IDLE_SESSION_TIMEOUT_MS,
  M52DeviceRegistry,
  M52DeviceSecurityCoordinator,
  M52OfflineSessionManager,
  createM52CompliantTablet,
  createM52FixtureCache,
  createM52MedicationAidePrincipal,
  createM52MedicationCacheRequest,
  evaluateM52DevicePolicy,
  M52_FIXTURE_TIME,
  runM52DeviceSecurityScenario,
  type M52DeviceAttestation,
} from "../services/m52/security";

function runtime() {
  const { cache } = createM52FixtureCache();
  const devices = new M52DeviceRegistry();
  const sessions = new M52OfflineSessionManager();
  const coordinator = new M52DeviceSecurityCoordinator({
    cache,
    devices,
    sessions,
  });
  const tablet = createM52CompliantTablet();
  const binding = coordinator.enrollDevice(tablet, M52_FIXTURE_TIME);
  const principal = createM52MedicationAidePrincipal();
  const session = coordinator.startSession(
    "SYNTH-M52-SESSION-CONTROL-001",
    binding.deviceId,
    binding.installationId,
    principal,
    M52_FIXTURE_TIME,
  );
  return { coordinator, devices, sessions, cache, tablet, binding, principal, session };
}

describe("M5.2-02 supported-device and session controls", () => {
  it("accepts the compliant managed tablet with zero live device or MDM calls", () => {
    const decision = evaluateM52DevicePolicy(
      createM52CompliantTablet(),
      M52_FIXTURE_TIME,
    );
    expect(decision).toEqual({
      allowed: true,
      reasonCodes: ["M52_DEVICE_CONTROLS_PASSED"],
      minimumVersion: "17.6",
      evaluatedAt: M52_FIXTURE_TIME,
      liveMdmCalls: 0,
      liveDeviceCalls: 0,
      synthetic: true,
    });
  });

  it.each([
    ["ios", "17.6", "phone"],
    ["ipados", "17.6", "tablet"],
    ["android", "14.0", "tablet"],
    ["windows", "11.0", "tablet"],
  ] as const)("accepts minimum supported %s %s", (platform, version, formFactor) => {
    const decision = evaluateM52DevicePolicy(
      createM52CompliantTablet({
        platform,
        platformVersion: version,
        formFactor,
      }),
      M52_FIXTURE_TIME,
    );
    expect(decision.allowed).toBe(true);
    expect(decision.minimumVersion).toBe(version);
  });

  it.each([
    [{ platformVersion: "17.5" }, "M52_DEVICE_OS_VERSION_UNSUPPORTED"],
    [{ platformVersion: "invalid" }, "M52_DEVICE_OS_VERSION_UNSUPPORTED"],
    [{ managed: false }, "M52_DEVICE_MANAGEMENT_REQUIRED"],
    [{ encryptionAtRest: false }, "M52_DEVICE_ENCRYPTION_AT_REST_REQUIRED"],
    [{ hardwareBackedKey: false }, "M52_DEVICE_HARDWARE_KEY_REQUIRED"],
    [{ screenLockEnabled: false }, "M52_DEVICE_SCREEN_LOCK_REQUIRED"],
    [
      { autoLockMinutes: M52_DEVICE_CONTROL_LIMITS.maximumAutoLockMinutes + 1 },
      "M52_DEVICE_AUTO_LOCK_DENIED",
    ],
    [{ rootedOrJailbroken: true }, "M52_DEVICE_ROOT_OR_JAILBREAK_DENIED"],
    [
      { applicationIntegrityPassed: false },
      "M52_DEVICE_APPLICATION_INTEGRITY_REQUIRED",
    ],
    [{ remoteWipeCapable: false }, "M52_DEVICE_REMOTE_WIPE_REQUIRED"],
    [
      { osPatchAgeDays: M52_DEVICE_CONTROL_LIMITS.maximumOsPatchAgeDays + 1 },
      "M52_DEVICE_PATCH_AGE_DENIED",
    ],
    [
      {
        clockDriftSeconds:
          M52_DEVICE_CONTROL_LIMITS.maximumClockDriftSeconds + 1,
      },
      "M52_DEVICE_CLOCK_DRIFT_DENIED",
    ],
    [{ attestedAt: "2026-07-15T14:44:59.000Z" }, "M52_DEVICE_ATTESTATION_STALE"],
  ] as const)("denies a failed device control %#", (overrides, reason) => {
    const decision = evaluateM52DevicePolicy(
      createM52CompliantTablet(overrides as Partial<M52DeviceAttestation>),
      M52_FIXTURE_TIME,
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain(reason);
  });

  it("requires controlled wipe before accepting a new installation", () => {
    const registry = new M52DeviceRegistry();
    const tablet = createM52CompliantTablet();
    registry.enroll(tablet, M52_FIXTURE_TIME);
    expect(() =>
      registry.enroll(
        createM52CompliantTablet({
          installationId: "SYNTH-M52-INSTALLATION-REINSTALLED-002",
        }),
        M52_FIXTURE_TIME,
      ),
    ).toThrow("M52_DEVICE_REINSTALL_REQUIRES_CONTROLLED_WIPE");
  });

  it("revalidates current posture on every protected cache access", () => {
    const { coordinator, tablet, session, cache } = runtime();
    expect(() =>
      coordinator.writeCachedIntent({
        sessionId: session.sessionId,
        action: "record-administration",
        devicePosture: { ...tablet, rootedOrJailbroken: true },
        request: createM52MedicationCacheRequest(),
        evaluatedAt: "2026-07-15T15:01:00.000Z",
      }),
    ).toThrow("M52_DEVICE_ROOT_OR_JAILBREAK_DENIED");
    expect(cache.persistedEnvelopeCount()).toBe(0);
    expect(() =>
      coordinator.writeCachedIntent({
        sessionId: session.sessionId,
        action: "record-administration",
        devicePosture: {
          ...tablet,
          attestedAt: "2026-07-15T14:30:00.000Z",
        },
        request: createM52MedicationCacheRequest(),
        evaluatedAt: "2026-07-15T15:01:00.000Z",
      }),
    ).toThrow("M52_DEVICE_ATTESTATION_STALE");
    expect(cache.persistedEnvelopeCount()).toBe(0);
  });

  it("rejects posture from another device installation or hardware key", () => {
    const { coordinator, tablet, session } = runtime();
    expect(() =>
      coordinator.writeCachedIntent({
        sessionId: session.sessionId,
        action: "record-administration",
        devicePosture: {
          ...tablet,
          installationId: "SYNTH-M52-INSTALLATION-OTHER-002",
        },
        request: createM52MedicationCacheRequest(),
        evaluatedAt: "2026-07-15T15:01:00.000Z",
      }),
    ).toThrow("M52_DEVICE_POSTURE_SESSION_MISMATCH");
    expect(() =>
      coordinator.writeCachedIntent({
        sessionId: session.sessionId,
        action: "record-administration",
        devicePosture: {
          ...tablet,
          hardwareKeyId: "SYNTH-M52-HARDWARE-KEY-OTHER-002",
        },
        request: createM52MedicationCacheRequest(),
        evaluatedAt: "2026-07-15T15:01:00.000Z",
      }),
    ).toThrow("M52_DEVICE_POSTURE_BINDING_MISMATCH");
  });

  it("enforces idle timeout at the configured boundary", () => {
    const { sessions, binding } = runtime();
    sessions.start(
      "SYNTH-M52-SESSION-IDLE-002",
      binding,
      createM52MedicationAidePrincipal(),
      M52_FIXTURE_TIME,
    );
    const justBefore = new Date(
      Date.parse(M52_FIXTURE_TIME) + M52_IDLE_SESSION_TIMEOUT_MS - 1,
    ).toISOString();
    expect(
      sessions.requireActive(
        "SYNTH-M52-SESSION-IDLE-002",
        binding,
        justBefore,
        false,
      ).state,
    ).toBe("active");
    const exact = new Date(
      Date.parse(M52_FIXTURE_TIME) + M52_IDLE_SESSION_TIMEOUT_MS,
    ).toISOString();
    expect(() =>
      sessions.requireActive(
        "SYNTH-M52-SESSION-IDLE-002",
        binding,
        exact,
      ),
    ).toThrow("M52_SESSION_IDLE_TIMEOUT");
    expect(sessions.inspect("SYNTH-M52-SESSION-IDLE-002").state).toBe(
      "idle-timeout",
    );
  });

  it("enforces absolute timeout and clock-rollback protection", () => {
    const { sessions, binding } = runtime();
    sessions.start(
      "SYNTH-M52-SESSION-ABSOLUTE-002",
      binding,
      createM52MedicationAidePrincipal(),
      M52_FIXTURE_TIME,
    );
    const absolute = new Date(
      Date.parse(M52_FIXTURE_TIME) + M52_ABSOLUTE_SESSION_TIMEOUT_MS,
    ).toISOString();
    expect(() =>
      sessions.requireActive(
        "SYNTH-M52-SESSION-ABSOLUTE-002",
        binding,
        absolute,
      ),
    ).toThrow("M52_SESSION_ABSOLUTE_TIMEOUT");

    sessions.start(
      "SYNTH-M52-SESSION-CLOCK-002",
      binding,
      createM52MedicationAidePrincipal(),
      M52_FIXTURE_TIME,
    );
    expect(() =>
      sessions.requireActive(
        "SYNTH-M52-SESSION-CLOCK-002",
        binding,
        "2026-07-15T14:59:59.000Z",
      ),
    ).toThrow("M52_SESSION_CLOCK_ROLLBACK_DENIED");
  });

  it("binds a session to the exact device installation", () => {
    const { sessions, binding } = runtime();
    sessions.start(
      "SYNTH-M52-SESSION-BINDING-002",
      binding,
      createM52MedicationAidePrincipal(),
      M52_FIXTURE_TIME,
    );
    expect(() =>
      sessions.requireActive(
        "SYNTH-M52-SESSION-BINDING-002",
        {
          ...binding,
          installationId: "SYNTH-M52-INSTALLATION-OTHER-002",
        },
        "2026-07-15T15:01:00.000Z",
      ),
    ).toThrow("M52_SESSION_DEVICE_BINDING_MISMATCH");
  });

  it("stores no persistent session token", () => {
    const { sessions } = runtime();
    expect(sessions.summary()).toMatchObject({
      total: 1,
      active: 1,
      persistedSessionTokens: 0,
      synthetic: true,
    });
  });
});

describe("M5.2-04 cache isolation through logout, reinstall, and device loss", () => {
  it("purges user cache on logout and rejects the ended session", () => {
    const { coordinator, tablet, session, cache } = runtime();
    const request = createM52MedicationCacheRequest();
    coordinator.writeCachedIntent({
      sessionId: session.sessionId,
      action: "record-administration",
      devicePosture: tablet,
      request,
      evaluatedAt: "2026-07-15T15:01:00.000Z",
    });
    const logout = coordinator.logout(
      session.sessionId,
      "2026-07-15T15:02:00.000Z",
    );
    expect(logout).toMatchObject({
      state: "logged-out",
      deletedCiphertextEnvelopes: 1,
      remainingUserDeviceEnvelopes: 0,
    });
    expect(cache.persistedEnvelopeCount()).toBe(0);
    expect(() =>
      coordinator.readCachedRecord({
        sessionId: session.sessionId,
        action: "view-minimum-necessary",
        devicePosture: tablet,
        workflowId: request.workflowId,
        entryId: request.entryId,
        youthId: request.youthId,
        evaluatedAt: "2026-07-15T15:03:00.000Z",
      }),
    ).toThrow("M52_SESSION_NOT_ACTIVE");
  });

  it("revokes sessions and verifies an encrypted-cache remote wipe", () => {
    const { coordinator, tablet, binding, session, cache } = runtime();
    coordinator.writeCachedIntent({
      sessionId: session.sessionId,
      action: "record-administration",
      devicePosture: tablet,
      request: createM52MedicationCacheRequest(),
      evaluatedAt: "2026-07-15T15:01:00.000Z",
    });
    const result = coordinator.remoteRevokeAndWipe({
      deviceId: binding.deviceId,
      requestedBy: "SYNTH-M52-ACTOR-SECURITY-001",
      reason: "M52_DEVICE_REPORTED_LOST",
      occurredAt: "2026-07-15T15:02:00.000Z",
    });
    expect(result).toMatchObject({
      revokedSessions: 1,
      deletedCiphertextEnvelopes: 1,
      remainingDeviceEnvelopes: 0,
      finalState: "wiped",
      liveMdmCalls: 0,
      liveDeviceCalls: 0,
      liveWrites: 0,
      synthetic: true,
    });
    expect(cache.persistedEnvelopeCount()).toBe(0);
    expect(coordinator.sessions.inspect(session.sessionId).state).toBe(
      "device-revoked",
    );
    expect(
      result.auditEvents.every(
        (event) =>
          event.immutable &&
          event.liveCalls === 0 &&
          event.liveWrites === 0 &&
          Object.isFrozen(event),
      ),
    ).toBe(true);
  });

  it("wipes the prior installation before a controlled reinstall", () => {
    const { coordinator, tablet, binding, session, cache } = runtime();
    coordinator.writeCachedIntent({
      sessionId: session.sessionId,
      action: "record-administration",
      devicePosture: tablet,
      request: createM52MedicationCacheRequest(),
      evaluatedAt: "2026-07-15T15:01:00.000Z",
    });
    const result = coordinator.controlledReinstall({
      oldDeviceId: binding.deviceId,
      requestedBy: "SYNTH-M52-ACTOR-SECURITY-001",
      occurredAt: "2026-07-15T15:03:00.000Z",
      newAttestation: createM52CompliantTablet({
        installationId: "SYNTH-M52-INSTALLATION-REINSTALLED-002",
        hardwareKeyId: "SYNTH-M52-HARDWARE-KEY-REINSTALLED-002",
        attestedAt: "2026-07-15T15:03:00.000Z",
      }),
    });
    expect(result).toMatchObject({
      oldInstallationId: binding.installationId,
      deletedCiphertextEnvelopes: 1,
      revokedSessions: 1,
      oldCacheReadable: false,
      synthetic: true,
    });
    expect(result.newBinding.installationId).not.toBe(binding.installationId);
    expect(result.newBinding.state).toBe("active");
    expect(cache.persistedEnvelopeCount()).toBe(0);
    expect(coordinator.devices.snapshot().supersededInstallations).toBe(1);
  });

  it("rejects prohibited actions before cache persistence", () => {
    const { coordinator, tablet, session, cache } = runtime();
    expect(() =>
      coordinator.writeCachedIntent({
        sessionId: session.sessionId,
        action: "create-medication-order",
        devicePosture: tablet,
        request: createM52MedicationCacheRequest(),
        evaluatedAt: "2026-07-15T15:01:00.000Z",
      }),
    ).toThrow("M52_ACTION_GLOBALLY_PROHIBITED_OFFLINE");
    expect(cache.persistedEnvelopeCount()).toBe(0);
  });

  it("binds medication staff attestation to the active session", () => {
    const { coordinator, tablet, session, cache } = runtime();
    const request = createM52MedicationCacheRequest();
    const payload = request.payload as Readonly<Record<string, unknown>>;
    const attestation = payload.staffAttestation as Readonly<
      Record<string, unknown>
    >;
    expect(() =>
      coordinator.writeCachedIntent({
        sessionId: session.sessionId,
        action: "record-administration",
        devicePosture: tablet,
        request: {
          ...request,
          payload: {
            ...payload,
            staffAttestation: {
              ...attestation,
              sessionId: "SYNTH-M52-SESSION-OTHER-002",
            },
          } as never,
        },
        evaluatedAt: "2026-07-15T15:01:00.000Z",
      }),
    ).toThrow("M52_MEDICATION_STAFF_ATTESTATION_SESSION_DENIED");
    expect(cache.persistedEnvelopeCount()).toBe(0);
  });

  it("publishes a deterministic integrated security proof with all zero-live boundaries", () => {
    const result = runM52DeviceSecurityScenario();
    expect(result.accepted).toBe(true);
    expect(result.assertionCount).toBe(29);
    expect(Object.values(result.assertions).every(Boolean)).toBe(true);
    expect(result.capabilityPolicy.approvedWorkflowIds).toEqual([
      "gro_tablet_medication_pass",
      "gro_shift_safety_handoff",
      "bhc_field_case_management_contact",
      "enterprise_task_structured_form",
    ]);
    expect(result.encryption).toMatchObject({
      algorithm: "AES-256-GCM",
      ciphertextOnlyPersistence: true,
      plaintextSentinelAbsent: true,
      scopedIdentifiersAbsent: true,
      tamperRejected: true,
      persistedPlaintextBytes: 0,
    });
    expect(Object.values(result.cacheIsolation).every(Boolean)).toBe(true);
    expect(result.boundary).toMatchObject({
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
    expect(result.prototypeBoundary).toMatchObject({
      realPeople: 0,
      realMedicationAdministrations: 0,
      liveDeviceEnrollments: 0,
      physicalDeviceWipes: 0,
      liveExternalCalls: 0,
      deployments: 0,
      githubPushes: 0,
      usesProductionData: false,
    });
  });
});
