import {
  M52_SYNTHETIC_BOUNDARY,
  type M52DeviceAttestation,
  type M52DeviceBinding,
  type M52DevicePlatform,
  type M52DevicePolicyDecision,
  type M52DeviceState,
} from "./types";
import {
  addReason,
  deepFreeze,
  parseTimestamp,
  requireSyntheticBoundary,
  requireSyntheticId,
} from "./support";

export const M52_MINIMUM_SUPPORTED_DEVICE_VERSIONS = deepFreeze<
  Readonly<Record<M52DevicePlatform, string>>
>({
  ios: "17.6",
  ipados: "17.6",
  android: "14.0",
  windows: "11.0",
});

export const M52_DEVICE_CONTROL_LIMITS = deepFreeze({
  maximumAutoLockMinutes: 5,
  maximumOsPatchAgeDays: 90,
  maximumClockDriftSeconds: 300,
  maximumAttestationAgeMinutes: 15,
  requiredFormFactors: ["phone", "tablet"] as const,
  requiresManagedDevice: true,
  requiresEncryptionAtRest: true,
  requiresHardwareBackedKey: true,
  requiresScreenLock: true,
  requiresApplicationIntegrity: true,
  requiresRemoteWipe: true,
  prohibitsRootedOrJailbrokenDevice: true,
});

function parseVersion(value: string): readonly number[] | null {
  if (!/^\d+(?:\.\d+){0,3}$/.test(value)) return null;
  const parts = value.split(".").map(Number);
  return parts.every((part) => Number.isSafeInteger(part) && part >= 0)
    ? parts
    : null;
}

function versionAtLeast(actual: string, minimum: string): boolean {
  const actualParts = parseVersion(actual);
  const minimumParts = parseVersion(minimum);
  if (!actualParts || !minimumParts) return false;
  const length = Math.max(actualParts.length, minimumParts.length);
  for (let index = 0; index < length; index += 1) {
    const actualPart = actualParts[index] ?? 0;
    const minimumPart = minimumParts[index] ?? 0;
    if (actualPart > minimumPart) return true;
    if (actualPart < minimumPart) return false;
  }
  return true;
}

export function evaluateM52DevicePolicy(
  device: M52DeviceAttestation,
  evaluatedAt: string,
): Readonly<M52DevicePolicyDecision> {
  const reasons: string[] = [];
  let identifiersValid = true;
  try {
    requireSyntheticBoundary(device);
    requireSyntheticId(device.deviceId, "device_id");
    requireSyntheticId(device.installationId, "installation_id");
    requireSyntheticId(device.hardwareKeyId, "hardware_key_id");
  } catch {
    identifiersValid = false;
  }
  addReason(reasons, !identifiersValid, "M52_DEVICE_SYNTHETIC_BOUNDARY_DENIED");
  const minimum = M52_MINIMUM_SUPPORTED_DEVICE_VERSIONS[device.platform] ?? null;
  addReason(reasons, minimum === null, "M52_DEVICE_PLATFORM_UNSUPPORTED");
  addReason(
    reasons,
    minimum !== null && !versionAtLeast(device.platformVersion, minimum),
    "M52_DEVICE_OS_VERSION_UNSUPPORTED",
  );
  addReason(
    reasons,
    !M52_DEVICE_CONTROL_LIMITS.requiredFormFactors.includes(device.formFactor),
    "M52_DEVICE_FORM_FACTOR_UNSUPPORTED",
  );
  addReason(reasons, !device.managed, "M52_DEVICE_MANAGEMENT_REQUIRED");
  addReason(
    reasons,
    !device.encryptionAtRest,
    "M52_DEVICE_ENCRYPTION_AT_REST_REQUIRED",
  );
  addReason(
    reasons,
    !device.hardwareBackedKey,
    "M52_DEVICE_HARDWARE_KEY_REQUIRED",
  );
  addReason(
    reasons,
    !device.screenLockEnabled,
    "M52_DEVICE_SCREEN_LOCK_REQUIRED",
  );
  addReason(
    reasons,
    !Number.isFinite(device.autoLockMinutes) ||
      device.autoLockMinutes <= 0 ||
      device.autoLockMinutes > M52_DEVICE_CONTROL_LIMITS.maximumAutoLockMinutes,
    "M52_DEVICE_AUTO_LOCK_DENIED",
  );
  addReason(
    reasons,
    device.rootedOrJailbroken,
    "M52_DEVICE_ROOT_OR_JAILBREAK_DENIED",
  );
  addReason(
    reasons,
    !device.applicationIntegrityPassed,
    "M52_DEVICE_APPLICATION_INTEGRITY_REQUIRED",
  );
  addReason(
    reasons,
    !device.remoteWipeCapable,
    "M52_DEVICE_REMOTE_WIPE_REQUIRED",
  );
  addReason(
    reasons,
    !Number.isFinite(device.osPatchAgeDays) ||
      device.osPatchAgeDays < 0 ||
      device.osPatchAgeDays > M52_DEVICE_CONTROL_LIMITS.maximumOsPatchAgeDays,
    "M52_DEVICE_PATCH_AGE_DENIED",
  );
  addReason(
    reasons,
    !Number.isFinite(device.clockDriftSeconds) ||
      Math.abs(device.clockDriftSeconds) >
        M52_DEVICE_CONTROL_LIMITS.maximumClockDriftSeconds,
    "M52_DEVICE_CLOCK_DRIFT_DENIED",
  );
  try {
    const attested = parseTimestamp(device.attestedAt, "device_attested_at");
    const evaluated = parseTimestamp(evaluatedAt, "device_evaluated_at");
    const age = evaluated - attested;
    addReason(
      reasons,
      age < 0 ||
        age > M52_DEVICE_CONTROL_LIMITS.maximumAttestationAgeMinutes * 60_000,
      "M52_DEVICE_ATTESTATION_STALE",
    );
  } catch {
    addReason(reasons, true, "M52_DEVICE_ATTESTATION_TIME_INVALID");
  }

  return deepFreeze({
    allowed: reasons.length === 0,
    reasonCodes: reasons.length === 0 ? ["M52_DEVICE_CONTROLS_PASSED"] : reasons,
    minimumVersion: minimum,
    evaluatedAt,
    liveMdmCalls: 0,
    liveDeviceCalls: 0,
    synthetic: true,
  });
}

interface MutableDeviceRecord {
  attestation: M52DeviceAttestation;
  enrolledAt: string;
  state: M52DeviceState;
  stateReason: string;
  stateChangedAt: string;
}

export interface M52DeviceRegistrySnapshot {
  readonly totalDevices: number;
  readonly activeDevices: number;
  readonly revokedDevices: number;
  readonly wipedDevices: number;
  readonly supersededInstallations: number;
  readonly liveMdmCalls: 0;
  readonly liveDeviceCalls: 0;
  readonly synthetic: true;
}

/** Server-side synthetic registry; it does not contact an MDM or a real device. */
export class M52DeviceRegistry {
  private readonly currentByDeviceId = new Map<string, MutableDeviceRecord>();
  private supersededInstallations = 0;

  enroll(
    device: M52DeviceAttestation,
    evaluatedAt: string,
  ): Readonly<M52DeviceBinding> {
    const decision = evaluateM52DevicePolicy(device, evaluatedAt);
    if (!decision.allowed) {
      throw new Error(`M52_DEVICE_ENROLLMENT_DENIED:${decision.reasonCodes.join(",")}`);
    }
    const existing = this.currentByDeviceId.get(device.deviceId);
    if (existing && existing.state !== "wiped") {
      if (existing.attestation.installationId === device.installationId) {
        throw new Error("M52_DEVICE_INSTALLATION_ALREADY_ENROLLED");
      }
      throw new Error("M52_DEVICE_REINSTALL_REQUIRES_CONTROLLED_WIPE");
    }
    this.currentByDeviceId.set(device.deviceId, {
      attestation: deepFreeze({ ...device }) as M52DeviceAttestation,
      enrolledAt: evaluatedAt,
      state: "active",
      stateReason: "M52_DEVICE_ENROLLED",
      stateChangedAt: evaluatedAt,
    });
    return this.binding(device.deviceId);
  }

  currentBinding(deviceId: string): Readonly<M52DeviceBinding> {
    requireSyntheticId(deviceId, "device_id");
    return this.binding(deviceId);
  }

  assertActive(
    deviceId: string,
    installationId: string,
  ): Readonly<M52DeviceBinding> {
    const binding = this.binding(deviceId);
    if (binding.installationId !== installationId) {
      throw new Error("M52_DEVICE_INSTALLATION_BINDING_MISMATCH");
    }
    if (binding.state !== "active") throw new Error("M52_DEVICE_NOT_ACTIVE");
    return binding;
  }

  revalidatePosture(
    posture: M52DeviceAttestation,
    evaluatedAt: string,
  ): Readonly<M52DeviceBinding> {
    const record = this.record(posture.deviceId);
    if (record.state !== "active") throw new Error("M52_DEVICE_NOT_ACTIVE");
    if (
      record.attestation.installationId !== posture.installationId ||
      record.attestation.hardwareKeyId !== posture.hardwareKeyId
    ) {
      throw new Error("M52_DEVICE_POSTURE_BINDING_MISMATCH");
    }
    const decision = evaluateM52DevicePolicy(posture, evaluatedAt);
    if (!decision.allowed) {
      throw new Error(
        `M52_DEVICE_POSTURE_DENIED:${decision.reasonCodes.join(",")}`,
      );
    }
    record.attestation = deepFreeze({ ...posture }) as M52DeviceAttestation;
    record.stateReason = "M52_DEVICE_POSTURE_REVALIDATED";
    record.stateChangedAt = evaluatedAt;
    return this.binding(posture.deviceId);
  }

  revoke(deviceId: string, reason: string, occurredAt: string): Readonly<M52DeviceBinding> {
    const record = this.record(deviceId);
    if (record.state !== "active") throw new Error("M52_DEVICE_NOT_ACTIVE");
    if (!reason.trim()) throw new Error("M52_DEVICE_REVOCATION_REASON_REQUIRED");
    parseTimestamp(occurredAt, "device_revoked_at");
    record.state = "revoked";
    record.stateReason = reason;
    record.stateChangedAt = occurredAt;
    return this.binding(deviceId);
  }

  markWipePending(deviceId: string, occurredAt: string): Readonly<M52DeviceBinding> {
    const record = this.record(deviceId);
    if (record.state !== "revoked") throw new Error("M52_DEVICE_REVOCATION_REQUIRED");
    parseTimestamp(occurredAt, "device_wipe_pending_at");
    record.state = "wipe-pending";
    record.stateReason = "M52_REMOTE_WIPE_REQUESTED";
    record.stateChangedAt = occurredAt;
    return this.binding(deviceId);
  }

  markWiped(deviceId: string, occurredAt: string): Readonly<M52DeviceBinding> {
    const record = this.record(deviceId);
    if (record.state !== "wipe-pending") {
      throw new Error("M52_DEVICE_WIPE_PENDING_REQUIRED");
    }
    parseTimestamp(occurredAt, "device_wiped_at");
    record.state = "wiped";
    record.stateReason = "M52_REMOTE_WIPE_VERIFIED";
    record.stateChangedAt = occurredAt;
    return this.binding(deviceId);
  }

  recordControlledReinstall(): void {
    this.supersededInstallations += 1;
  }

  snapshot(): Readonly<M52DeviceRegistrySnapshot> {
    const records = [...this.currentByDeviceId.values()];
    return deepFreeze({
      totalDevices: records.length,
      activeDevices: records.filter((record) => record.state === "active").length,
      revokedDevices: records.filter(
        (record) => record.state === "revoked" || record.state === "wipe-pending",
      ).length,
      wipedDevices: records.filter((record) => record.state === "wiped").length,
      supersededInstallations: this.supersededInstallations,
      liveMdmCalls: 0,
      liveDeviceCalls: 0,
      synthetic: true,
    });
  }

  private record(deviceId: string): MutableDeviceRecord {
    requireSyntheticId(deviceId, "device_id");
    const record = this.currentByDeviceId.get(deviceId);
    if (!record) throw new Error("M52_DEVICE_NOT_ENROLLED");
    return record;
  }

  private binding(deviceId: string): Readonly<M52DeviceBinding> {
    const record = this.record(deviceId);
    return deepFreeze({
      deviceId: record.attestation.deviceId,
      installationId: record.attestation.installationId,
      hardwareKeyId: record.attestation.hardwareKeyId,
      enrolledAt: record.enrolledAt,
      state: record.state,
      boundary: M52_SYNTHETIC_BOUNDARY,
      synthetic: true,
    });
  }
}
