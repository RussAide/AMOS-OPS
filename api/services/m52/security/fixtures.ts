import { createHash } from "node:crypto";
import { M52EncryptedLocalCache, M52InMemoryCiphertextStore } from "./encrypted-cache";
import {
  M52_SYNTHETIC_BOUNDARY,
  type M52CachePrincipal,
  type M52CacheWriteRequest,
  type M52DeviceAttestation,
} from "./types";

export const M52_FIXTURE_TIME = "2026-07-15T15:00:00.000Z";
export const M52_FIXTURE_CACHE_CREATED_AT = "2026-07-15T15:01:00.000Z";
export const M52_FIXTURE_CACHE_EXPIRES_AT = "2026-07-15T19:01:00.000Z";
export const M52_FIXTURE_PLAINTEXT_SENTINEL =
  "M52-PLAINTEXT-SENTINEL-MUST-NOT-PERSIST";

export function createM52FixtureRootKey(): Buffer {
  return createHash("sha256")
    .update("AMOS-OPS|M5.2|SYNTHETIC-FIXTURE-ROOT-KEY|V1")
    .digest();
}

export function createM52DeterministicNonceFactory(): () => Uint8Array {
  let sequence = 0;
  return () => {
    sequence += 1;
    return createHash("sha256")
      .update(`AMOS-OPS|M5.2|SYNTHETIC-NONCE|${sequence}`)
      .digest()
      .subarray(0, 12);
  };
}

export function createM52FixtureCache(): {
  readonly cache: M52EncryptedLocalCache;
  readonly store: M52InMemoryCiphertextStore;
} {
  const store = new M52InMemoryCiphertextStore();
  return {
    cache: new M52EncryptedLocalCache({
      rootKey: createM52FixtureRootKey(),
      store,
      nonceFactory: createM52DeterministicNonceFactory(),
    }),
    store,
  };
}

export function createM52CompliantTablet(
  overrides: Partial<M52DeviceAttestation> = {},
): M52DeviceAttestation {
  return {
    deviceId: "SYNTH-M52-DEVICE-TABLET-001",
    installationId: "SYNTH-M52-INSTALLATION-001",
    hardwareKeyId: "SYNTH-M52-HARDWARE-KEY-001",
    platform: "ipados",
    platformVersion: "18.1",
    formFactor: "tablet",
    managed: true,
    encryptionAtRest: true,
    hardwareBackedKey: true,
    screenLockEnabled: true,
    autoLockMinutes: 3,
    rootedOrJailbroken: false,
    applicationIntegrityPassed: true,
    remoteWipeCapable: true,
    osPatchAgeDays: 12,
    clockDriftSeconds: 4,
    attestedAt: "2026-07-15T14:55:00.000Z",
    boundary: M52_SYNTHETIC_BOUNDARY,
    synthetic: true,
    ...overrides,
  };
}

export function createM52MedicationAidePrincipal(
  overrides: Partial<M52CachePrincipal> = {},
): M52CachePrincipal {
  return {
    userId: "SYNTH-M52-USER-MED-AIDE-001",
    role: "medication-aide",
    divisionId: "gro",
    youthScopeIds: [
      "SYNTH-M52-YOUTH-ALPHA-001",
      "SYNTH-M52-YOUTH-BRAVO-002",
    ],
    boundary: M52_SYNTHETIC_BOUNDARY,
    synthetic: true,
    ...overrides,
  };
}

export function createM52MedicationCacheRequest(
  overrides: Partial<M52CacheWriteRequest> = {},
): M52CacheWriteRequest {
  return {
    entryId: "SYNTH-M52-CACHE-ENTRY-MAR-001",
    recordId: "SYNTH-M52-MAR-EVENT-001",
    workflowId: "gro_tablet_medication_pass",
    youthId: "SYNTH-M52-YOUTH-ALPHA-001",
    payload: {
      opaqueYouthLabel: "Youth A",
      medicationDisplayLabel: "Synthetic Medication A",
      doseDisplay: "Synthetic dose 1",
      routeDisplay: "Synthetic route",
      scheduledWindow: "15:00Z",
      outcome: "administered",
      exceptionReason: null,
      allergyHoldIndicators: {
        allergyReviewed: true,
        holdReviewed: true,
        activeAllergyConflict: false,
        activeHold: false,
      },
      verificationChecklist: {
        youthVerified: true,
        medicationVerified: true,
        doseVerified: true,
        routeVerified: true,
        scheduledTimeVerified: true,
      },
      requiredNote: M52_FIXTURE_PLAINTEXT_SENTINEL,
      staffAttestation: {
        actorId: "SYNTH-M52-USER-MED-AIDE-001",
        sessionId: "SYNTH-M52-SESSION-CONTROL-001",
        deviceId: "SYNTH-M52-DEVICE-TABLET-001",
        installationId: "SYNTH-M52-INSTALLATION-001",
        attestedAt: M52_FIXTURE_CACHE_CREATED_AT,
        synthetic: true,
      },
    },
    createdAt: M52_FIXTURE_CACHE_CREATED_AT,
    expiresAt: M52_FIXTURE_CACHE_EXPIRES_AT,
    boundary: M52_SYNTHETIC_BOUNDARY,
    synthetic: true,
    ...overrides,
  };
}

export function createM52MedicationCacheRequestForSession(
  sessionId: string,
  overrides: Partial<M52CacheWriteRequest> = {},
): M52CacheWriteRequest {
  const request = createM52MedicationCacheRequest();
  const payload = request.payload as Readonly<Record<string, M52CacheWriteRequest["payload"]>>;
  const attestation = payload.staffAttestation as Readonly<
    Record<string, M52CacheWriteRequest["payload"]>
  >;
  return {
    ...request,
    ...overrides,
    payload: {
      ...payload,
      staffAttestation: {
        ...attestation,
        sessionId,
      },
    },
  };
}
