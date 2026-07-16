import { describe, expect, it } from "vitest";
import {
  M52_CACHE_ALGORITHM,
  M52DeviceRegistry,
  M52EncryptedLocalCache,
  M52InMemoryCiphertextStore,
  createM52CompliantTablet,
  createM52FixtureCache,
  createM52FixtureRootKey,
  createM52MedicationAidePrincipal,
  createM52MedicationCacheRequest,
  M52_FIXTURE_PLAINTEXT_SENTINEL,
  M52_FIXTURE_TIME,
  type M52CacheWriteRequest,
  type M52CiphertextEnvelope,
  type M52JsonValue,
} from "../services/m52/security";

function fixture() {
  const { cache, store } = createM52FixtureCache();
  const registry = new M52DeviceRegistry();
  const binding = registry.enroll(createM52CompliantTablet(), M52_FIXTURE_TIME);
  const principal = createM52MedicationAidePrincipal();
  const request = createM52MedicationCacheRequest();
  return { cache, store, registry, binding, principal, request };
}

function flipFirst(value: string): string {
  return `${value.at(0) === "A" ? "B" : "A"}${value.slice(1)}`;
}

function payloadObject(
  request: M52CacheWriteRequest,
): Readonly<Record<string, M52JsonValue>> {
  return request.payload as Readonly<Record<string, M52JsonValue>>;
}

describe("M5.2-02 authenticated encrypted local cache", () => {
  it("round-trips through AES-256-GCM while persisting ciphertext only", () => {
    const { cache, binding, principal, request } = fixture();
    const write = cache.put(binding, principal, request);
    const read = cache.get(
      binding,
      principal,
      request.entryId,
      request.youthId,
      "2026-07-15T15:02:00.000Z",
    );
    expect(write).toMatchObject({
      replaced: false,
      algorithm: M52_CACHE_ALGORITHM,
      persistedPlaintextBytes: 0,
      synthetic: true,
    });
    expect(read).toEqual(request);
    expect(Object.isFrozen(read)).toBe(true);
  });

  it("keeps payload and scoped identifiers out of the persistence representation", () => {
    const { cache, binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    const persisted = cache.serializedPersistenceSnapshot();
    expect(persisted).not.toContain(M52_FIXTURE_PLAINTEXT_SENTINEL);
    expect(persisted).not.toContain(principal.userId);
    expect(persisted).not.toContain(principal.role);
    expect(persisted).not.toContain(principal.divisionId);
    expect(persisted).not.toContain(request.youthId);
    expect(persisted).not.toContain(request.recordId);
    expect(persisted).not.toContain(request.workflowId);
    expect(cache.persistedCiphertextSnapshot()[0]).toMatchObject({
      algorithm: "AES-256-GCM",
      schemaVersion: 1,
      keyVersion: 1,
      synthetic: true,
    });
  });

  it("makes synthetic fixture envelopes deterministic without weakening the default random-nonce path", () => {
    const left = fixture();
    const right = fixture();
    left.cache.put(left.binding, left.principal, left.request);
    right.cache.put(right.binding, right.principal, right.request);
    expect(left.cache.persistedCiphertextSnapshot()).toEqual(
      right.cache.persistedCiphertextSnapshot(),
    );
  });

  it("uses a new nonce and ciphertext when replacing a scoped entry", () => {
    const { cache, binding, principal, request } = fixture();
    const taskRequest: M52CacheWriteRequest = {
      ...request,
      entryId: "SYNTH-M52-CACHE-ENTRY-TASK-001",
      recordId: "SYNTH-M52-TASK-EVENT-001",
      workflowId: "enterprise_task_structured_form",
      payload: {
        opaqueYouthLabel: "Youth A",
        taskDisplayLabel: "Synthetic Task A",
        dueWindow: "15:00Z",
        pendingStatus: "synthetic-in-progress",
        checklistOrFormDraft: ["synthetic-step-1"],
        draftComment: "synthetic-first-draft",
      },
    };
    cache.put(binding, principal, taskRequest);
    const first = cache.persistedCiphertextSnapshot()[0];
    const replaced = cache.put(binding, principal, {
      ...taskRequest,
      payload: {
        ...taskRequest.payload as Record<string, never>,
        draftComment: "synthetic-updated-draft",
      },
    });
    const second = cache.persistedCiphertextSnapshot()[0];
    expect(replaced.replaced).toBe(true);
    expect(second.iv).not.toBe(first.iv);
    expect(second.ciphertext).not.toBe(first.ciphertext);
  });

  it("keeps queued medication events append-only", () => {
    const { cache, binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    expect(() =>
      cache.put(binding, principal, {
        ...request,
        payload: {
          ...request.payload as Record<string, never>,
          requiredNote: "synthetic-attempted-mutation",
        },
      }),
    ).toThrow("M52_CACHE_IMMUTABLE_MEDICATION_EVENT_REPLACEMENT_DENIED");
    const read = cache.get(
      binding,
      principal,
      request.entryId,
      request.youthId,
      "2026-07-15T15:02:00.000Z",
    );
    expect(JSON.stringify(read?.payload)).toContain(M52_FIXTURE_PLAINTEXT_SENTINEL);
    expect(JSON.stringify(read?.payload)).not.toContain(
      "synthetic-attempted-mutation",
    );
  });

  it("persists a structured immutable medication outcome, five-right check, exception field, and device-bound staff attestation", () => {
    const { cache, binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    const read = cache.get(
      binding,
      principal,
      request.entryId,
      request.youthId,
      "2026-07-15T15:02:00.000Z",
    );
    const payload = read!.payload as Readonly<Record<string, M52JsonValue>>;
    expect(payload.outcome).toBe("administered");
    expect(payload.exceptionReason).toBeNull();
    expect(payload.verificationChecklist).toEqual({
      youthVerified: true,
      medicationVerified: true,
      doseVerified: true,
      routeVerified: true,
      scheduledTimeVerified: true,
    });
    expect(payload.allergyHoldIndicators).toEqual({
      allergyReviewed: true,
      holdReviewed: true,
      activeAllergyConflict: false,
      activeHold: false,
    });
    expect(payload.staffAttestation).toEqual({
      actorId: principal.userId,
      sessionId: "SYNTH-M52-SESSION-CONTROL-001",
      deviceId: binding.deviceId,
      installationId: binding.installationId,
      attestedAt: request.createdAt,
      synthetic: true,
    });
    expect(Object.isFrozen(payload)).toBe(true);
    expect(Object.isFrozen(payload.verificationChecklist)).toBe(true);
    expect(Object.isFrozen(payload.staffAttestation)).toBe(true);
  });

  it.each(["refused", "held"] as const)(
    "requires and accepts a structured exception reason for %s outcomes",
    (outcome) => {
      const { cache, binding, principal, request } = fixture();
      cache.put(binding, principal, {
        ...request,
        payload: {
          ...payloadObject(request),
          outcome,
          exceptionReason: `synthetic-${outcome}-reason`,
        },
      });
      const read = cache.get(
        binding,
        principal,
        request.entryId,
        request.youthId,
        "2026-07-15T15:02:00.000Z",
      );
      expect((read!.payload as Record<string, M52JsonValue>).outcome).toBe(
        outcome,
      );
    },
  );

  it.each([
    [
      { outcome: "unknown" },
      "M52_MEDICATION_OUTCOME_INVALID",
    ],
    [
      { outcome: "refused", exceptionReason: null },
      "M52_MEDICATION_EXCEPTION_REASON_REQUIRED",
    ],
    [
      {
        verificationChecklist: {
          youthVerified: true,
          medicationVerified: true,
          doseVerified: true,
          routeVerified: true,
          scheduledTimeVerified: false,
        },
      },
      "M52_MEDICATION_FIVE_RIGHTS_INCOMPLETE",
    ],
    [
      { staffAttestation: "synthetic-bare-attestation" },
      "M52_MEDICATION_STAFF_ATTESTATION_INVALID",
    ],
  ] as const)("rejects malformed medication contract %#", (overrides, reason) => {
    const { cache, binding, principal, request } = fixture();
    expect(() =>
      cache.put(binding, principal, {
        ...request,
        payload: {
          ...payloadObject(request),
          ...overrides,
        },
      }),
    ).toThrow(reason);
  });

  it.each([
    ["actorId", "SYNTH-M52-USER-OTHER-002"],
    ["deviceId", "SYNTH-M52-DEVICE-TABLET-OTHER-002"],
    ["installationId", "SYNTH-M52-INSTALLATION-OTHER-002"],
    ["attestedAt", "2026-07-15T15:01:01.000Z"],
  ] as const)("rejects medication attestation %s binding drift", (field, value) => {
    const { cache, binding, principal, request } = fixture();
    const payload = payloadObject(request);
    const staffAttestation = payload.staffAttestation as Readonly<
      Record<string, M52JsonValue>
    >;
    expect(() =>
      cache.put(binding, principal, {
        ...request,
        payload: {
          ...payload,
          staffAttestation: {
            ...staffAttestation,
            [field]: value,
          },
        },
      }),
    ).toThrow("M52_MEDICATION_STAFF_ATTESTATION_BINDING_DENIED");
  });

  it("enforces exact minimum-necessary payload schemas", () => {
    const { cache, binding, principal, request } = fixture();
    expect(() =>
      cache.put(binding, principal, {
        ...request,
        payload: {
          ...request.payload as Record<string, never>,
          excessiveField: "synthetic-excess",
        },
      }),
    ).toThrow("M52_PAYLOAD_EXCESS_FIELD_DENIED");
    const missingRequired = Object.fromEntries(
      Object.entries(request.payload as Record<string, unknown>).filter(
        ([key]) => key !== "requiredNote",
      ),
    ) as M52CacheWriteRequest["payload"];
    expect(() =>
      cache.put(binding, principal, {
        ...request,
        payload: missingRequired,
      }),
    ).toThrow("M52_PAYLOAD_REQUIRED_FIELD_MISSING");
  });

  it("rejects prohibited nested keys even when the root field is allowed", () => {
    const { cache, binding, principal, request } = fixture();
    expect(() =>
      cache.put(binding, principal, {
        ...request,
        payload: {
          ...request.payload as Record<string, never>,
          requiredNote: {
            text: "synthetic note",
            clinicalScore: 42,
          },
        },
      }),
    ).toThrow("M52_PAYLOAD_PROHIBITED_FIELD");
  });

  it.each([
    ["ciphertext", (envelope: M52CiphertextEnvelope) => flipFirst(envelope.ciphertext)],
    ["authTag", (envelope: M52CiphertextEnvelope) => flipFirst(envelope.authTag)],
    ["expiresAt", () => "2026-07-15T19:00:59.000Z"],
  ] as const)("rejects authenticated-envelope %s tampering", (field, mutate) => {
    const { cache, store, binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    const envelope = store.load(request.entryId);
    expect(envelope).not.toBeNull();
    store.save({
      ...envelope!,
      [field]: mutate(envelope!),
    });
    expect(() =>
      cache.get(
        binding,
        principal,
        request.entryId,
        request.youthId,
        "2026-07-15T15:02:00.000Z",
      ),
    ).toThrow("M52_CACHE_AUTHENTICATION_FAILED");
  });

  it.each([
    [
      "user",
      createM52MedicationAidePrincipal({
        userId: "SYNTH-M52-USER-MED-AIDE-OTHER-002",
      }),
      "SYNTH-M52-YOUTH-ALPHA-001",
    ],
    [
      "role",
      createM52MedicationAidePrincipal({ role: "shift-supervisor" }),
      "SYNTH-M52-YOUTH-ALPHA-001",
    ],
    [
      "division",
      createM52MedicationAidePrincipal({ divisionId: "bhc" }),
      "SYNTH-M52-YOUTH-ALPHA-001",
    ],
    [
      "youth",
      createM52MedicationAidePrincipal(),
      "SYNTH-M52-YOUTH-BRAVO-002",
    ],
  ] as const)("isolates ciphertext across %s scope", (_label, otherPrincipal, youthId) => {
    const { cache, binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    expect(() =>
      cache.get(
        binding,
        otherPrincipal,
        request.entryId,
        youthId,
        "2026-07-15T15:02:00.000Z",
      ),
    ).toThrow("M52_CACHE_SCOPE_DENIED");
  });

  it("isolates cache records across devices and installations", () => {
    const { cache, binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    expect(() =>
      cache.get(
        {
          ...binding,
          deviceId: "SYNTH-M52-DEVICE-TABLET-OTHER-002",
          installationId: "SYNTH-M52-INSTALLATION-OTHER-002",
          hardwareKeyId: "SYNTH-M52-HARDWARE-KEY-OTHER-002",
        },
        principal,
        request.entryId,
        request.youthId,
        "2026-07-15T15:02:00.000Z",
      ),
    ).toThrow("M52_CACHE_SCOPE_DENIED");
    expect(() =>
      cache.get(
        {
          ...binding,
          installationId: "SYNTH-M52-INSTALLATION-REINSTALLED-002",
        },
        principal,
        request.entryId,
        request.youthId,
        "2026-07-15T15:02:00.000Z",
      ),
    ).toThrow("M52_CACHE_SCOPE_DENIED");
  });

  it("removes expired ciphertext instead of returning stale plaintext", () => {
    const { cache, binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    expect(
      cache.get(
        binding,
        principal,
        request.entryId,
        request.youthId,
        request.expiresAt,
      ),
    ).toBeNull();
    expect(cache.persistedEnvelopeCount()).toBe(0);
  });

  it("rejects invalid or overlong cache TTL", () => {
    const { cache, binding, principal, request } = fixture();
    expect(() =>
      cache.put(binding, principal, {
        ...request,
        expiresAt: request.createdAt,
      }),
    ).toThrow("M52_CACHE_TTL_DENIED");
    expect(() =>
      cache.put(binding, principal, {
        ...request,
        expiresAt: "2026-07-16T00:01:01.000Z",
      }),
    ).toThrow("M52_CACHE_TTL_DENIED");
  });

  it("blocks AES-GCM nonce reuse for the same derived key, including a reconstructed cache instance", () => {
    const store = new M52InMemoryCiphertextStore();
    const constantNonce = () => Buffer.alloc(12, 7);
    const left = new M52EncryptedLocalCache({
      rootKey: createM52FixtureRootKey(),
      store,
      nonceFactory: constantNonce,
    });
    const { binding, principal, request } = fixture();
    left.put(binding, principal, request);
    const reconstructed = new M52EncryptedLocalCache({
      rootKey: createM52FixtureRootKey(),
      store,
      nonceFactory: constantNonce,
    });
    expect(() =>
      reconstructed.put(binding, principal, {
        ...request,
        entryId: "SYNTH-M52-CACHE-ENTRY-MAR-002",
        recordId: "SYNTH-M52-MAR-EVENT-002",
      }),
    ).toThrow("M52_CACHE_GCM_NONCE_REUSE_BLOCKED");
  });

  it("rejects non-synthetic cache requests and inactive device bindings", () => {
    const { cache, binding, principal, request } = fixture();
    const nonSynthetic = {
      ...request,
      synthetic: false,
    } as unknown as M52CacheWriteRequest;
    expect(() => cache.put(binding, principal, nonSynthetic)).toThrow(
      "M52_SYNTHETIC_BOUNDARY_REQUIRED",
    );
    expect(() =>
      cache.put({ ...binding, state: "revoked" }, principal, request),
    ).toThrow("M52_DEVICE_BINDING_NOT_ACTIVE");
  });

  it("supports user, binding, and device ciphertext wipe without decrypting payloads", () => {
    const userFixture = fixture();
    userFixture.cache.put(
      userFixture.binding,
      userFixture.principal,
      userFixture.request,
    );
    expect(
      userFixture.cache.wipeUserFromDevice(
        userFixture.binding,
        userFixture.principal,
      ),
    ).toBe(1);
    expect(userFixture.cache.persistedEnvelopeCount()).toBe(0);

    const bindingFixture = fixture();
    bindingFixture.cache.put(
      bindingFixture.binding,
      bindingFixture.principal,
      bindingFixture.request,
    );
    expect(bindingFixture.cache.wipeBinding(bindingFixture.binding)).toBe(1);
    expect(bindingFixture.cache.persistedEnvelopeCount()).toBe(0);

    const deviceFixture = fixture();
    deviceFixture.cache.put(
      deviceFixture.binding,
      deviceFixture.principal,
      deviceFixture.request,
    );
    expect(deviceFixture.cache.wipeDevice(deviceFixture.binding.deviceId)).toBe(1);
    expect(deviceFixture.cache.deviceEnvelopeCount(deviceFixture.binding.deviceId)).toBe(
      0,
    );
  });

  it("will not let another scope overwrite an existing opaque entry identifier", () => {
    const { cache, binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    const other = createM52MedicationAidePrincipal({
      userId: "SYNTH-M52-USER-MED-AIDE-OTHER-002",
    });
    expect(() => cache.put(binding, other, request)).toThrow(
      "M52_CACHE_SCOPE_DENIED",
    );
  });

  it("zeros in-memory root material on disposal and denies later operations", () => {
    const { cache, binding, principal, request } = fixture();
    cache.dispose();
    expect(() => cache.put(binding, principal, request)).toThrow(
      "M52_CACHE_KEY_MATERIAL_DISPOSED",
    );
  });

  it("rejects malformed ciphertext envelopes at the storage boundary", () => {
    const store = new M52InMemoryCiphertextStore();
    const malformed = {
      schemaVersion: 1,
      algorithm: "AES-256-GCM",
      keyVersion: 1,
      entryId: "SYNTH-M52-CACHE-ENTRY-BAD-001",
      deviceDigest: "0".repeat(64),
      bindingDigest: "0".repeat(64),
      userDigest: "0".repeat(64),
      partitionDigest: "0".repeat(64),
      createdAt: "2026-07-15T15:00:00.000Z",
      expiresAt: "2026-07-15T16:00:00.000Z",
      iv: Buffer.alloc(3).toString("base64url"),
      ciphertext: Buffer.from("not-empty").toString("base64url"),
      authTag: Buffer.alloc(16).toString("base64url"),
      synthetic: true,
    } as const;
    expect(() => store.save(malformed)).toThrow(
      "M52_CACHE_ENVELOPE_ENCODING_INVALID",
    );
  });

  it("accepts the cryptographically random default nonce path", () => {
    const store = new M52InMemoryCiphertextStore();
    const cache = new M52EncryptedLocalCache({
      rootKey: createM52FixtureRootKey(),
      store,
    });
    const { binding, principal, request } = fixture();
    cache.put(binding, principal, request);
    const envelope = store.load(request.entryId);
    expect(Buffer.from(envelope!.iv, "base64url")).toHaveLength(12);
    expect(Buffer.from(envelope!.authTag, "base64url")).toHaveLength(16);
  });
});
