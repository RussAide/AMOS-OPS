import {
  M52_APPROVED_WORKFLOW_IDS,
  createM52PrototypeBoundary,
  type M52PrototypeBoundary,
} from "../../../../contracts/m52/shared";
import {
  M52_GLOBALLY_PROHIBITED_OFFLINE_ACTIONS,
  M52_PROHIBITED_OFFLINE_RECORDS,
  evaluateM52OfflineCapability,
  inspectM52CapabilityMatrix,
} from "./capability-policy";
import { evaluateM52DevicePolicy, M52DeviceRegistry } from "./device-policy";
import {
  M52DeviceSecurityCoordinator,
  M52OfflineSessionManager,
} from "./device-security";
import {
  createM52CompliantTablet,
  createM52FixtureCache,
  createM52MedicationAidePrincipal,
  createM52MedicationCacheRequestForSession,
  M52_FIXTURE_PLAINTEXT_SENTINEL,
  M52_FIXTURE_TIME,
} from "./fixtures";
import { deepFreeze } from "./support";
import {
  M52_CACHE_ALGORITHM,
  M52_SYNTHETIC_BOUNDARY,
  type M52DeviceBinding,
  type M52SecurityBoundarySnapshot,
} from "./types";

export interface M52DeviceSecurityScenarioResult {
  readonly accepted: boolean;
  readonly assertionCount: number;
  readonly assertions: Readonly<Record<string, boolean>>;
  readonly capabilityPolicy: {
    readonly exactCanonicalWorkflowSet: boolean;
    readonly approvedWorkflowIds: readonly string[];
    readonly approvedWorkflowCount: number;
    readonly offlineFirstWorkflowCount: number;
    readonly globallyProhibitedActionCount: number;
    readonly prohibitedRecordClassCount: number;
    readonly prohibitedMedicationOrderDenied: boolean;
    readonly restrictionsDocumented: boolean;
    readonly synthetic: true;
  };
  readonly encryption: {
    readonly algorithm: typeof M52_CACHE_ALGORITHM;
    readonly roundTripPassed: boolean;
    readonly ciphertextOnlyPersistence: boolean;
    readonly plaintextSentinelAbsent: boolean;
    readonly scopedIdentifiersAbsent: boolean;
    readonly tamperRejected: boolean;
    readonly structuredMedicationContract: boolean;
    readonly immutableMedicationEvent: boolean;
    readonly minimumNecessaryPayloadEnforced: boolean;
    readonly persistedPlaintextBytes: 0;
    readonly synthetic: true;
  };
  readonly cacheIsolation: {
    readonly acrossUsers: boolean;
    readonly acrossRoles: boolean;
    readonly acrossYouth: boolean;
    readonly acrossDivisions: boolean;
    readonly acrossDevices: boolean;
    readonly acrossInstallations: boolean;
    readonly afterLogout: boolean;
    readonly afterReinstall: boolean;
    readonly afterDeviceLoss: boolean;
    readonly synthetic: true;
  };
  readonly deviceAndSession: {
    readonly compliantDeviceAccepted: boolean;
    readonly unsupportedDeviceRejected: boolean;
    readonly idleTimeoutEnforced: boolean;
    readonly currentPostureEnforced: boolean;
    readonly remoteRevocationEnforced: boolean;
    readonly remoteWipeVerified: boolean;
    readonly revokedSessionCount: number;
    readonly wipedEnvelopeCount: number;
    readonly liveMdmCalls: 0;
    readonly liveDeviceCalls: 0;
    readonly synthetic: true;
  };
  readonly boundary: M52SecurityBoundarySnapshot;
  readonly prototypeBoundary: M52PrototypeBoundary;
  readonly synthetic: true;
}

function rejectedWith(operation: () => unknown, errorCode: string): boolean {
  try {
    operation();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(errorCode);
  }
}

function activeBinding(input: {
  deviceId: string;
  installationId: string;
  hardwareKeyId: string;
}): M52DeviceBinding {
  return deepFreeze({
    ...input,
    enrolledAt: M52_FIXTURE_TIME,
    state: "active",
    boundary: M52_SYNTHETIC_BOUNDARY,
    synthetic: true,
  });
}

function runtime(): {
  coordinator: M52DeviceSecurityCoordinator;
  devices: M52DeviceRegistry;
  sessions: M52OfflineSessionManager;
} {
  const { cache } = createM52FixtureCache();
  const devices = new M52DeviceRegistry();
  const sessions = new M52OfflineSessionManager();
  return {
    coordinator: new M52DeviceSecurityCoordinator({ cache, devices, sessions }),
    devices,
    sessions,
  };
}

/**
 * Deterministic executable proof for checklist M5.2-01, M5.2-02, and M5.2-04.
 * It uses only fictional fixture values and in-memory adapters.
 */
export function runM52DeviceSecurityScenario(): Readonly<M52DeviceSecurityScenarioResult> {
  const matrix = inspectM52CapabilityMatrix();
  const actualWorkflowIds = [...M52_APPROVED_WORKFLOW_IDS];
  const exactCanonicalWorkflowSet =
    matrix.contractWorkflowSetMatch &&
    JSON.stringify(actualWorkflowIds) ===
      JSON.stringify([...M52_APPROVED_WORKFLOW_IDS]);
  const allowedMedicationAction = evaluateM52OfflineCapability({
    workflowId: "gro_tablet_medication_pass",
    action: "record-administration",
    role: "medication-aide",
    divisionId: "gro",
    youthId: "SYNTH-M52-YOUTH-ALPHA-001",
    online: false,
    deviceCompliant: true,
    sessionActive: true,
    synthetic: true,
  });
  const prohibitedMedicationOrder = evaluateM52OfflineCapability({
    workflowId: "gro_tablet_medication_pass",
    action: "create-medication-order",
    role: "medication-aide",
    divisionId: "gro",
    youthId: "SYNTH-M52-YOUTH-ALPHA-001",
    online: false,
    deviceCompliant: true,
    sessionActive: true,
    synthetic: true,
  });

  const main = runtime();
  const tablet = createM52CompliantTablet();
  const binding = main.coordinator.enrollDevice(tablet, M52_FIXTURE_TIME);
  const principal = createM52MedicationAidePrincipal();
  const session = main.coordinator.startSession(
    "SYNTH-M52-SESSION-MAIN-001",
    binding.deviceId,
    binding.installationId,
    principal,
    M52_FIXTURE_TIME,
  );
  const cacheRequest = createM52MedicationCacheRequestForSession(
    session.sessionId,
  );
  const write = main.coordinator.writeCachedIntent({
    sessionId: session.sessionId,
    action: "record-administration",
    devicePosture: tablet,
    request: cacheRequest,
    evaluatedAt: "2026-07-15T15:01:00.000Z",
  });
  const read = main.coordinator.readCachedRecord({
    sessionId: session.sessionId,
    action: "view-minimum-necessary",
    devicePosture: tablet,
    workflowId: cacheRequest.workflowId,
    entryId: cacheRequest.entryId,
    youthId: cacheRequest.youthId,
    evaluatedAt: "2026-07-15T15:02:00.000Z",
  });
  const serializedPersistence = main.coordinator.cache.serializedPersistenceSnapshot();
  const readPayload = read?.payload as
    | Readonly<Record<string, unknown>>
    | undefined;
  const readChecklist = readPayload?.verificationChecklist as
    | Readonly<Record<string, unknown>>
    | undefined;
  const readAttestation = readPayload?.staffAttestation as
    | Readonly<Record<string, unknown>>
    | undefined;
  const structuredMedicationContract =
    readPayload?.outcome === "administered" &&
    readPayload.exceptionReason === null &&
    readChecklist?.youthVerified === true &&
    readChecklist.medicationVerified === true &&
    readChecklist.doseVerified === true &&
    readChecklist.routeVerified === true &&
    readChecklist.scheduledTimeVerified === true &&
    readAttestation?.actorId === principal.userId &&
    readAttestation.sessionId === session.sessionId &&
    readAttestation.deviceId === binding.deviceId &&
    readAttestation.installationId === binding.installationId &&
    readAttestation.attestedAt === cacheRequest.createdAt;
  const immutableMedicationEvent = rejectedWith(
    () => main.coordinator.cache.put(binding, principal, cacheRequest),
    "M52_CACHE_IMMUTABLE_MEDICATION_EVENT_REPLACEMENT_DENIED",
  );
  const minimumNecessaryPayloadEnforced = rejectedWith(
    () =>
      main.coordinator.cache.put(binding, principal, {
        ...cacheRequest,
        entryId: "SYNTH-M52-CACHE-ENTRY-MAR-EXCESS-002",
        recordId: "SYNTH-M52-MAR-EVENT-EXCESS-002",
        payload: {
          ...(cacheRequest.payload as Readonly<Record<string, never>>),
          excessiveField: "synthetic-excess",
        },
      }),
    "M52_PAYLOAD_EXCESS_FIELD_DENIED",
  );
  const currentPostureEnforced = rejectedWith(
    () =>
      main.coordinator.writeCachedIntent({
        sessionId: session.sessionId,
        action: "record-administration",
        devicePosture: { ...tablet, rootedOrJailbroken: true },
        request: cacheRequest,
        evaluatedAt: "2026-07-15T15:03:00.000Z",
      }),
    "M52_DEVICE_ROOT_OR_JAILBREAK_DENIED",
  );
  const ciphertextOnlyPersistence =
    write.persistedPlaintextBytes === 0 &&
    main.coordinator.cache.persistedEnvelopeCount() === 1 &&
    main.coordinator.cache.persistedCiphertextSnapshot().every(
      (envelope) =>
        envelope.algorithm === M52_CACHE_ALGORITHM &&
        envelope.ciphertext.length > 0 &&
        envelope.authTag.length > 0,
    );
  const scopedIdentifiersAbsent = [
    principal.userId,
    principal.role,
    principal.divisionId,
    cacheRequest.youthId,
    cacheRequest.recordId,
  ].every((value) => !serializedPersistence.includes(value));

  const otherUser = createM52MedicationAidePrincipal({
    userId: "SYNTH-M52-USER-MED-AIDE-OTHER-002",
  });
  const changedRole = createM52MedicationAidePrincipal({
    role: "shift-supervisor",
  });
  const changedDivision = createM52MedicationAidePrincipal({
    divisionId: "bhc",
  });
  const acrossUsers = rejectedWith(
    () =>
      main.coordinator.cache.get(
        binding,
        otherUser,
        cacheRequest.entryId,
        cacheRequest.youthId,
        "2026-07-15T15:03:00.000Z",
      ),
    "M52_CACHE_SCOPE_DENIED",
  );
  const acrossRoles = rejectedWith(
    () =>
      main.coordinator.cache.get(
        binding,
        changedRole,
        cacheRequest.entryId,
        cacheRequest.youthId,
        "2026-07-15T15:03:00.000Z",
      ),
    "M52_CACHE_SCOPE_DENIED",
  );
  const acrossYouth = rejectedWith(
    () =>
      main.coordinator.cache.get(
        binding,
        principal,
        cacheRequest.entryId,
        "SYNTH-M52-YOUTH-BRAVO-002",
        "2026-07-15T15:03:00.000Z",
      ),
    "M52_CACHE_SCOPE_DENIED",
  );
  const acrossDivisions = rejectedWith(
    () =>
      main.coordinator.cache.get(
        binding,
        changedDivision,
        cacheRequest.entryId,
        cacheRequest.youthId,
        "2026-07-15T15:03:00.000Z",
      ),
    "M52_CACHE_SCOPE_DENIED",
  );
  const acrossDevices = rejectedWith(
    () =>
      main.coordinator.cache.get(
        activeBinding({
          deviceId: "SYNTH-M52-DEVICE-TABLET-OTHER-002",
          installationId: "SYNTH-M52-INSTALLATION-OTHER-002",
          hardwareKeyId: "SYNTH-M52-HARDWARE-KEY-OTHER-002",
        }),
        principal,
        cacheRequest.entryId,
        cacheRequest.youthId,
        "2026-07-15T15:03:00.000Z",
      ),
    "M52_CACHE_SCOPE_DENIED",
  );
  const acrossInstallations = rejectedWith(
    () =>
      main.coordinator.cache.get(
        activeBinding({
          deviceId: binding.deviceId,
          installationId: "SYNTH-M52-INSTALLATION-REINSTALLED-002",
          hardwareKeyId: binding.hardwareKeyId,
        }),
        principal,
        cacheRequest.entryId,
        cacheRequest.youthId,
        "2026-07-15T15:03:00.000Z",
      ),
    "M52_CACHE_SCOPE_DENIED",
  );

  const tamperFixture = createM52FixtureCache();
  tamperFixture.cache.put(binding, principal, cacheRequest);
  const originalEnvelope = tamperFixture.store.load(cacheRequest.entryId);
  if (!originalEnvelope) throw new Error("M52_SCENARIO_TAMPER_ENVELOPE_MISSING");
  const firstCipherCharacter = originalEnvelope.ciphertext[0];
  tamperFixture.store.save({
    ...originalEnvelope,
    ciphertext: `${firstCipherCharacter === "A" ? "B" : "A"}${originalEnvelope.ciphertext.slice(1)}`,
  });
  const tamperRejected = rejectedWith(
    () =>
      tamperFixture.cache.get(
        binding,
        principal,
        cacheRequest.entryId,
        cacheRequest.youthId,
        "2026-07-15T15:03:00.000Z",
      ),
    "M52_CACHE_AUTHENTICATION_FAILED",
  );

  const idleRuntime = runtime();
  const idleBinding = idleRuntime.coordinator.enrollDevice(tablet, M52_FIXTURE_TIME);
  idleRuntime.coordinator.startSession(
    "SYNTH-M52-SESSION-IDLE-001",
    idleBinding.deviceId,
    idleBinding.installationId,
    principal,
    M52_FIXTURE_TIME,
  );
  const idleTimeoutEnforced = rejectedWith(
    () =>
      idleRuntime.sessions.requireActive(
        "SYNTH-M52-SESSION-IDLE-001",
        idleBinding,
        "2026-07-15T15:15:00.000Z",
      ),
    "M52_SESSION_IDLE_TIMEOUT",
  );

  const logoutRuntime = runtime();
  const logoutBinding = logoutRuntime.coordinator.enrollDevice(tablet, M52_FIXTURE_TIME);
  logoutRuntime.coordinator.startSession(
    "SYNTH-M52-SESSION-LOGOUT-001",
    logoutBinding.deviceId,
    logoutBinding.installationId,
    principal,
    M52_FIXTURE_TIME,
  );
  const logoutRequest = createM52MedicationCacheRequestForSession(
    "SYNTH-M52-SESSION-LOGOUT-001",
  );
  logoutRuntime.coordinator.writeCachedIntent({
    sessionId: "SYNTH-M52-SESSION-LOGOUT-001",
    action: "record-administration",
    devicePosture: tablet,
    request: logoutRequest,
    evaluatedAt: "2026-07-15T15:01:00.000Z",
  });
  const logout = logoutRuntime.coordinator.logout(
    "SYNTH-M52-SESSION-LOGOUT-001",
    "2026-07-15T15:02:00.000Z",
  );
  const afterLogout =
    logout.deletedCiphertextEnvelopes === 1 &&
    logoutRuntime.coordinator.cache.persistedEnvelopeCount() === 0 &&
    rejectedWith(
      () =>
        logoutRuntime.coordinator.readCachedRecord({
          sessionId: "SYNTH-M52-SESSION-LOGOUT-001",
          action: "view-minimum-necessary",
          devicePosture: tablet,
          workflowId: logoutRequest.workflowId,
          entryId: logoutRequest.entryId,
          youthId: logoutRequest.youthId,
          evaluatedAt: "2026-07-15T15:03:00.000Z",
        }),
      "M52_SESSION_NOT_ACTIVE",
    );

  const reinstallRuntime = runtime();
  const reinstallBinding = reinstallRuntime.coordinator.enrollDevice(
    tablet,
    M52_FIXTURE_TIME,
  );
  reinstallRuntime.coordinator.startSession(
    "SYNTH-M52-SESSION-REINSTALL-001",
    reinstallBinding.deviceId,
    reinstallBinding.installationId,
    principal,
    M52_FIXTURE_TIME,
  );
  const reinstallRequest = createM52MedicationCacheRequestForSession(
    "SYNTH-M52-SESSION-REINSTALL-001",
  );
  reinstallRuntime.coordinator.writeCachedIntent({
    sessionId: "SYNTH-M52-SESSION-REINSTALL-001",
    action: "record-administration",
    devicePosture: tablet,
    request: reinstallRequest,
    evaluatedAt: "2026-07-15T15:01:00.000Z",
  });
  const reinstall = reinstallRuntime.coordinator.controlledReinstall({
    oldDeviceId: tablet.deviceId,
    requestedBy: "SYNTH-M52-ACTOR-SECURITY-001",
    occurredAt: "2026-07-15T15:03:00.000Z",
    newAttestation: createM52CompliantTablet({
      installationId: "SYNTH-M52-INSTALLATION-REINSTALLED-002",
      hardwareKeyId: "SYNTH-M52-HARDWARE-KEY-REINSTALLED-002",
      attestedAt: "2026-07-15T15:03:00.000Z",
    }),
  });
  const afterReinstall =
    reinstall.oldCacheReadable === false &&
    reinstall.deletedCiphertextEnvelopes === 1 &&
    reinstallRuntime.coordinator.cache.persistedEnvelopeCount() === 0 &&
    reinstall.newBinding.installationId !== reinstall.oldInstallationId;

  const lossRuntime = runtime();
  const lossBinding = lossRuntime.coordinator.enrollDevice(tablet, M52_FIXTURE_TIME);
  lossRuntime.coordinator.startSession(
    "SYNTH-M52-SESSION-LOSS-001",
    lossBinding.deviceId,
    lossBinding.installationId,
    principal,
    M52_FIXTURE_TIME,
  );
  const lossRequest = createM52MedicationCacheRequestForSession(
    "SYNTH-M52-SESSION-LOSS-001",
  );
  lossRuntime.coordinator.writeCachedIntent({
    sessionId: "SYNTH-M52-SESSION-LOSS-001",
    action: "record-administration",
    devicePosture: tablet,
    request: lossRequest,
    evaluatedAt: "2026-07-15T15:01:00.000Z",
  });
  const lossWipe = lossRuntime.coordinator.remoteRevokeAndWipe({
    deviceId: lossBinding.deviceId,
    requestedBy: "SYNTH-M52-ACTOR-SECURITY-001",
    reason: "M52_DEVICE_REPORTED_LOST",
    occurredAt: "2026-07-15T15:04:00.000Z",
  });
  const afterDeviceLoss =
    lossWipe.finalState === "wiped" &&
    lossWipe.remainingDeviceEnvelopes === 0 &&
    lossRuntime.coordinator.cache.persistedEnvelopeCount() === 0;

  const unsupportedDeviceRejected = !evaluateM52DevicePolicy(
    createM52CompliantTablet({
      managed: false,
      encryptionAtRest: false,
      hardwareBackedKey: false,
      rootedOrJailbroken: true,
      remoteWipeCapable: false,
    }),
    M52_FIXTURE_TIME,
  ).allowed;

  const mainWipe = main.coordinator.remoteRevokeAndWipe({
    deviceId: binding.deviceId,
    requestedBy: "SYNTH-M52-ACTOR-SECURITY-001",
    reason: "M52_REMOTE_ACCESS_REVOKED",
    occurredAt: "2026-07-15T15:05:00.000Z",
  });
  const remoteRevocationEnforced =
    main.coordinator.sessions.inspect(session.sessionId).state === "device-revoked";
  const remoteWipeVerified =
    mainWipe.finalState === "wiped" &&
    mainWipe.remainingDeviceEnvelopes === 0 &&
    main.coordinator.cache.persistedEnvelopeCount() === 0;

  const assertions: Readonly<Record<string, boolean>> = deepFreeze({
    capabilityMatrixAccepted: matrix.accepted,
    exactCanonicalWorkflowSet,
    approvedMedicationAction: allowedMedicationAction.allowed,
    prohibitedMedicationOrderDenied:
      !prohibitedMedicationOrder.allowed &&
      prohibitedMedicationOrder.reasonCodes.includes(
        "M52_ACTION_GLOBALLY_PROHIBITED_OFFLINE",
      ),
    restrictionsDocumented: matrix.approvedWorkflowCount === 4,
    compliantDeviceAccepted: binding.state === "active",
    unsupportedDeviceRejected,
    encryptedRoundTrip:
      read !== null &&
      read.recordId === cacheRequest.recordId &&
      JSON.stringify(read.payload).includes(M52_FIXTURE_PLAINTEXT_SENTINEL),
    ciphertextOnlyPersistence,
    plaintextSentinelAbsent: !serializedPersistence.includes(
      M52_FIXTURE_PLAINTEXT_SENTINEL,
    ),
    scopedIdentifiersAbsent,
    tamperRejected,
    structuredMedicationContract,
    immutableMedicationEvent,
    minimumNecessaryPayloadEnforced,
    acrossUsers,
    acrossRoles,
    acrossYouth,
    acrossDivisions,
    acrossDevices,
    acrossInstallations,
    afterLogout,
    afterReinstall,
    afterDeviceLoss,
    idleTimeoutEnforced,
    currentPostureEnforced,
    remoteRevocationEnforced,
    remoteWipeVerified,
    zeroLiveBoundary:
      main.coordinator.boundarySnapshot().liveMdmCalls === 0 &&
      main.coordinator.boundarySnapshot().liveDeviceCalls === 0 &&
      main.coordinator.boundarySnapshot().liveWrites === 0 &&
      createM52PrototypeBoundary().physicalDeviceWipes === 0,
  });
  const assertionValues = Object.values(assertions);
  const boundary = main.coordinator.boundarySnapshot();

  return deepFreeze({
    accepted: assertionValues.every(Boolean),
    assertionCount: assertionValues.length,
    assertions,
    capabilityPolicy: {
      exactCanonicalWorkflowSet,
      approvedWorkflowIds: actualWorkflowIds,
      approvedWorkflowCount: matrix.approvedWorkflowCount,
      offlineFirstWorkflowCount: matrix.offlineFirstWorkflowCount,
      globallyProhibitedActionCount:
        M52_GLOBALLY_PROHIBITED_OFFLINE_ACTIONS.length,
      prohibitedRecordClassCount: M52_PROHIBITED_OFFLINE_RECORDS.length,
      prohibitedMedicationOrderDenied: !prohibitedMedicationOrder.allowed,
      restrictionsDocumented: matrix.missingRequiredControls.length === 0,
      synthetic: true,
    },
    encryption: {
      algorithm: M52_CACHE_ALGORITHM,
      roundTripPassed: assertions.encryptedRoundTrip,
      ciphertextOnlyPersistence,
      plaintextSentinelAbsent: assertions.plaintextSentinelAbsent,
      scopedIdentifiersAbsent,
      tamperRejected,
      structuredMedicationContract,
      immutableMedicationEvent,
      minimumNecessaryPayloadEnforced,
      persistedPlaintextBytes: 0,
      synthetic: true,
    },
    cacheIsolation: {
      acrossUsers,
      acrossRoles,
      acrossYouth,
      acrossDivisions,
      acrossDevices,
      acrossInstallations,
      afterLogout,
      afterReinstall,
      afterDeviceLoss,
      synthetic: true,
    },
    deviceAndSession: {
      compliantDeviceAccepted: binding.state === "active",
      unsupportedDeviceRejected,
      idleTimeoutEnforced,
      currentPostureEnforced,
      remoteRevocationEnforced,
      remoteWipeVerified,
      revokedSessionCount: mainWipe.revokedSessions,
      wipedEnvelopeCount: mainWipe.deletedCiphertextEnvelopes,
      liveMdmCalls: 0,
      liveDeviceCalls: 0,
      synthetic: true,
    },
    boundary,
    prototypeBoundary: createM52PrototypeBoundary(),
    synthetic: true,
  });
}
