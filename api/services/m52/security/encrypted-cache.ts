import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { ALL_ROLES } from "../../../../src/constants/roles";
import {
  evaluateM52PayloadMinimumNecessary,
  extractM52MedicationStaffAttestation,
} from "./capability-policy";
import {
  M52_CACHE_ALGORITHM,
  M52_CACHE_SCHEMA_VERSION,
  M52_SYNTHETIC_BOUNDARY,
  type M52CachePrincipal,
  type M52CachedRecord,
  type M52CacheWriteRequest,
  type M52CacheWriteResult,
  type M52CiphertextEnvelope,
  type M52DeviceBinding,
  type M52JsonValue,
} from "./types";
import {
  canonicalJson,
  cloneJson,
  deepFreeze,
  digestsEqual,
  parseTimestamp,
  requireSyntheticBoundary,
  requireSyntheticId,
  sha256,
} from "./support";

const GCM_IV_BYTES = 12;
const GCM_TAG_BYTES = 16;
const DERIVED_KEY_BYTES = 32;
const MAX_CACHE_TTL_MS = 8 * 60 * 60 * 1_000;

export interface M52CiphertextStore {
  load(entryId: string): M52CiphertextEnvelope | null;
  save(envelope: M52CiphertextEnvelope): void;
  delete(entryId: string): boolean;
  list(): readonly M52CiphertextEnvelope[];
  deleteWhere(predicate: (envelope: M52CiphertextEnvelope) => boolean): number;
  count(): number;
}

function cloneEnvelope(envelope: M52CiphertextEnvelope): M52CiphertextEnvelope {
  return deepFreeze(cloneJson(envelope)) as M52CiphertextEnvelope;
}

/**
 * Synthetic persistence adapter whose type surface accepts ciphertext only.
 * It models an IndexedDB/native encrypted-blob table without creating any
 * browser, filesystem, production database, or device write.
 */
export class M52InMemoryCiphertextStore implements M52CiphertextStore {
  private readonly envelopes = new Map<string, M52CiphertextEnvelope>();

  load(entryId: string): M52CiphertextEnvelope | null {
    const envelope = this.envelopes.get(entryId);
    return envelope ? cloneEnvelope(envelope) : null;
  }

  save(envelope: M52CiphertextEnvelope): void {
    if (
      envelope.algorithm !== M52_CACHE_ALGORITHM ||
      envelope.schemaVersion !== M52_CACHE_SCHEMA_VERSION ||
      envelope.keyVersion !== 1 ||
      !envelope.synthetic
    ) {
      throw new Error("M52_CACHE_ENVELOPE_SCHEMA_DENIED");
    }
    if (
      Buffer.from(envelope.iv, "base64url").length !== GCM_IV_BYTES ||
      Buffer.from(envelope.authTag, "base64url").length !== GCM_TAG_BYTES ||
      Buffer.from(envelope.ciphertext, "base64url").length === 0
    ) {
      throw new Error("M52_CACHE_ENVELOPE_ENCODING_INVALID");
    }
    this.envelopes.set(envelope.entryId, cloneEnvelope(envelope));
  }

  delete(entryId: string): boolean {
    return this.envelopes.delete(entryId);
  }

  list(): readonly M52CiphertextEnvelope[] {
    return deepFreeze(
      [...this.envelopes.values()]
        .sort((left, right) => left.entryId.localeCompare(right.entryId))
        .map((envelope) => cloneEnvelope(envelope)),
    );
  }

  deleteWhere(predicate: (envelope: M52CiphertextEnvelope) => boolean): number {
    let deleted = 0;
    for (const [entryId, envelope] of this.envelopes) {
      if (predicate(cloneEnvelope(envelope)) && this.envelopes.delete(entryId)) {
        deleted += 1;
      }
    }
    return deleted;
  }

  count(): number {
    return this.envelopes.size;
  }
}

export type M52NonceFactory = () => Uint8Array;

export interface M52EncryptedCacheOptions {
  readonly rootKey: Uint8Array;
  readonly store?: M52CiphertextStore;
  readonly nonceFactory?: M52NonceFactory;
  readonly maximumTtlMs?: number;
}

interface M52InternalPlaintextRecord extends M52CachedRecord {
  readonly userId: string;
  readonly role: M52CachePrincipal["role"];
  readonly divisionId: M52CachePrincipal["divisionId"];
}

function deviceDigest(binding: M52DeviceBinding): string {
  return sha256("M52-DEVICE", binding.deviceId);
}

function bindingDigest(binding: M52DeviceBinding): string {
  return sha256(
    "M52-BINDING",
    binding.deviceId,
    binding.installationId,
    binding.hardwareKeyId,
  );
}

function userDigest(principal: M52CachePrincipal): string {
  return sha256("M52-USER", principal.userId);
}

function partitionDigest(
  principal: M52CachePrincipal,
  youthId: string,
): string {
  return sha256(
    "M52-PARTITION",
    principal.userId,
    principal.role,
    principal.divisionId,
    youthId,
  );
}

function envelopeAad(envelope: Omit<M52CiphertextEnvelope, "ciphertext" | "authTag">): Buffer {
  return Buffer.from(
    JSON.stringify([
      envelope.schemaVersion,
      envelope.algorithm,
      envelope.keyVersion,
      envelope.entryId,
      envelope.deviceDigest,
      envelope.bindingDigest,
      envelope.userDigest,
      envelope.partitionDigest,
      envelope.createdAt,
      envelope.expiresAt,
      envelope.iv,
      envelope.synthetic,
    ]),
    "utf8",
  );
}

function validatePrincipal(principal: M52CachePrincipal): void {
  requireSyntheticBoundary(principal);
  requireSyntheticId(principal.userId, "user_id");
  if (!ALL_ROLES.includes(principal.role)) throw new Error("M52_ROLE_NOT_CANONICAL");
  if (principal.youthScopeIds.length === 0) {
    throw new Error("M52_YOUTH_SCOPE_REQUIRED");
  }
  for (const youthId of principal.youthScopeIds) {
    requireSyntheticId(youthId, "youth_id");
  }
  if (new Set(principal.youthScopeIds).size !== principal.youthScopeIds.length) {
    throw new Error("M52_YOUTH_SCOPE_DUPLICATE");
  }
}

function validateBinding(binding: M52DeviceBinding): void {
  requireSyntheticBoundary(binding);
  requireSyntheticId(binding.deviceId, "device_id");
  requireSyntheticId(binding.installationId, "installation_id");
  requireSyntheticId(binding.hardwareKeyId, "hardware_key_id");
  if (binding.state !== "active") throw new Error("M52_DEVICE_BINDING_NOT_ACTIVE");
}

function validateJsonValue(value: unknown): asserts value is M52JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("M52_CACHE_JSON_NUMBER_INVALID");
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) validateJsonValue(item);
    return;
  }
  if (typeof value === "object") {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw new Error("M52_CACHE_JSON_OBJECT_INVALID");
    }
    for (const [key, item] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        throw new Error("M52_CACHE_JSON_KEY_PROHIBITED");
      }
      validateJsonValue(item);
    }
    return;
  }
  throw new Error("M52_CACHE_JSON_VALUE_INVALID");
}

function parsePlaintext(value: Buffer): M52InternalPlaintextRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value.toString("utf8"));
  } catch {
    throw new Error("M52_CACHE_PLAINTEXT_INVALID");
  }
  validateJsonValue(parsed);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("M52_CACHE_PLAINTEXT_INVALID");
  }
  const record = parsed as unknown as M52InternalPlaintextRecord;
  if (
    record.boundary !== M52_SYNTHETIC_BOUNDARY ||
    record.synthetic !== true ||
    typeof record.entryId !== "string" ||
    typeof record.recordId !== "string" ||
    typeof record.workflowId !== "string" ||
    typeof record.youthId !== "string" ||
    typeof record.userId !== "string" ||
    typeof record.role !== "string" ||
    typeof record.divisionId !== "string" ||
    typeof record.createdAt !== "string" ||
    typeof record.expiresAt !== "string" ||
    !("payload" in record)
  ) {
    throw new Error("M52_CACHE_PLAINTEXT_SCHEMA_INVALID");
  }
  return record;
}

/**
 * Authenticated, device-bound cache. AES-256-GCM protects confidentiality and
 * integrity; HKDF derives a unique key for every device installation and
 * user/role/division/youth partition. Only ciphertext envelopes enter the
 * persistence adapter.
 */
export class M52EncryptedLocalCache {
  private readonly rootKey: Buffer;
  private readonly store: M52CiphertextStore;
  private readonly nonceFactory: M52NonceFactory;
  private readonly maximumTtlMs: number;
  private disposed = false;

  constructor(options: M52EncryptedCacheOptions) {
    if (options.rootKey.byteLength !== DERIVED_KEY_BYTES) {
      throw new Error("M52_CACHE_ROOT_KEY_MUST_BE_256_BITS");
    }
    this.rootKey = Buffer.from(options.rootKey);
    this.store = options.store ?? new M52InMemoryCiphertextStore();
    this.nonceFactory = options.nonceFactory ?? (() => randomBytes(GCM_IV_BYTES));
    this.maximumTtlMs = options.maximumTtlMs ?? MAX_CACHE_TTL_MS;
    if (
      !Number.isSafeInteger(this.maximumTtlMs) ||
      this.maximumTtlMs <= 0 ||
      this.maximumTtlMs > MAX_CACHE_TTL_MS
    ) {
      throw new Error("M52_CACHE_MAXIMUM_TTL_INVALID");
    }
  }

  put(
    binding: M52DeviceBinding,
    principal: M52CachePrincipal,
    request: M52CacheWriteRequest,
  ): Readonly<M52CacheWriteResult> {
    this.requireAvailable();
    validateBinding(binding);
    validatePrincipal(principal);
    requireSyntheticBoundary(request);
    requireSyntheticId(request.entryId, "cache_entry_id");
    requireSyntheticId(request.recordId, "record_id");
    requireSyntheticId(request.youthId, "youth_id");
    if (!principal.youthScopeIds.includes(request.youthId)) {
      throw new Error("M52_CACHE_YOUTH_SCOPE_DENIED");
    }
    validateJsonValue(request.payload);
    const payloadDecision = evaluateM52PayloadMinimumNecessary(
      request.workflowId,
      request.payload,
    );
    if (!payloadDecision.allowed) {
      throw new Error(
        `M52_CACHE_MINIMUM_NECESSARY_DENIED:${payloadDecision.reasonCodes.join(",")}`,
      );
    }
    const created = parseTimestamp(request.createdAt, "cache_created_at");
    const expires = parseTimestamp(request.expiresAt, "cache_expires_at");
    if (expires <= created || expires - created > this.maximumTtlMs) {
      throw new Error("M52_CACHE_TTL_DENIED");
    }

    const expected = this.scopeDigests(binding, principal, request.youthId);
    const existing = this.store.load(request.entryId);
    if (existing && !this.scopeMatches(existing, expected)) {
      throw new Error("M52_CACHE_SCOPE_DENIED");
    }
    if (existing && request.workflowId === "gro_tablet_medication_pass") {
      throw new Error("M52_CACHE_IMMUTABLE_MEDICATION_EVENT_REPLACEMENT_DENIED");
    }
    if (request.workflowId === "gro_tablet_medication_pass") {
      const attestation = extractM52MedicationStaffAttestation(request.payload);
      if (
        attestation.actorId !== principal.userId ||
        attestation.deviceId !== binding.deviceId ||
        attestation.installationId !== binding.installationId ||
        attestation.attestedAt !== request.createdAt
      ) {
        throw new Error("M52_MEDICATION_STAFF_ATTESTATION_BINDING_DENIED");
      }
    }

    const iv = Buffer.from(this.nonceFactory());
    if (iv.length !== GCM_IV_BYTES) throw new Error("M52_CACHE_NONCE_INVALID");
    const encodedIv = iv.toString("base64url");
    if (
      this.store.list().some(
        (envelope) =>
          envelope.keyVersion === 1 &&
          digestsEqual(envelope.bindingDigest, expected.bindingDigest) &&
          digestsEqual(envelope.partitionDigest, expected.partitionDigest) &&
          envelope.iv === encodedIv,
      )
    ) {
      throw new Error("M52_CACHE_GCM_NONCE_REUSE_BLOCKED");
    }

    const envelopeWithoutCiphertext = {
      schemaVersion: M52_CACHE_SCHEMA_VERSION,
      algorithm: M52_CACHE_ALGORITHM,
      keyVersion: 1 as const,
      entryId: request.entryId,
      ...expected,
      createdAt: request.createdAt,
      expiresAt: request.expiresAt,
      iv: encodedIv,
      synthetic: true as const,
    };
    const plaintextRecord: M52InternalPlaintextRecord = {
      ...request,
      userId: principal.userId,
      role: principal.role,
      divisionId: principal.divisionId,
    };
    const plaintext = Buffer.from(
      canonicalJson(plaintextRecord as unknown as M52JsonValue),
      "utf8",
    );
    const key = this.deriveKey(expected.bindingDigest, expected.partitionDigest);
    try {
      const cipher = createCipheriv("aes-256-gcm", key, iv, {
        authTagLength: GCM_TAG_BYTES,
      });
      cipher.setAAD(envelopeAad(envelopeWithoutCiphertext));
      const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const envelope: M52CiphertextEnvelope = {
        ...envelopeWithoutCiphertext,
        ciphertext: ciphertext.toString("base64url"),
        authTag: cipher.getAuthTag().toString("base64url"),
      };
      this.store.save(envelope);
      return deepFreeze({
        entryId: request.entryId,
        replaced: existing !== null,
        ciphertextBytes: ciphertext.length,
        persistedPlaintextBytes: 0,
        algorithm: M52_CACHE_ALGORITHM,
        synthetic: true,
      });
    } finally {
      plaintext.fill(0);
      key.fill(0);
      iv.fill(0);
    }
  }

  get(
    binding: M52DeviceBinding,
    principal: M52CachePrincipal,
    entryId: string,
    youthId: string,
    evaluatedAt: string,
  ): Readonly<M52CachedRecord> | null {
    this.requireAvailable();
    validateBinding(binding);
    validatePrincipal(principal);
    requireSyntheticId(entryId, "cache_entry_id");
    requireSyntheticId(youthId, "youth_id");
    if (!principal.youthScopeIds.includes(youthId)) {
      throw new Error("M52_CACHE_SCOPE_DENIED");
    }
    const envelope = this.store.load(entryId);
    if (!envelope) return null;
    const expected = this.scopeDigests(binding, principal, youthId);
    if (!this.scopeMatches(envelope, expected)) {
      throw new Error("M52_CACHE_SCOPE_DENIED");
    }
    const now = parseTimestamp(evaluatedAt, "cache_evaluated_at");
    if (now >= parseTimestamp(envelope.expiresAt, "cache_expires_at")) {
      this.store.delete(entryId);
      return null;
    }

    const key = this.deriveKey(expected.bindingDigest, expected.partitionDigest);
    const iv = Buffer.from(envelope.iv, "base64url");
    const plaintextChunks: Buffer[] = [];
    let plaintext: Buffer | null = null;
    try {
      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        iv,
        { authTagLength: GCM_TAG_BYTES },
      );
      const aadEnvelope = {
        schemaVersion: envelope.schemaVersion,
        algorithm: envelope.algorithm,
        keyVersion: envelope.keyVersion,
        entryId: envelope.entryId,
        deviceDigest: envelope.deviceDigest,
        bindingDigest: envelope.bindingDigest,
        userDigest: envelope.userDigest,
        partitionDigest: envelope.partitionDigest,
        createdAt: envelope.createdAt,
        expiresAt: envelope.expiresAt,
        iv: envelope.iv,
        synthetic: envelope.synthetic,
      };
      decipher.setAAD(envelopeAad(aadEnvelope));
      decipher.setAuthTag(Buffer.from(envelope.authTag, "base64url"));
      plaintextChunks.push(
        decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
      );
      plaintextChunks.push(decipher.final());
      plaintext = Buffer.concat(plaintextChunks);
    } catch {
      throw new Error("M52_CACHE_AUTHENTICATION_FAILED");
    } finally {
      for (const chunk of plaintextChunks) chunk.fill(0);
      key.fill(0);
      iv.fill(0);
    }

    try {
      const record = parsePlaintext(plaintext);
      if (
        record.entryId !== entryId ||
        record.youthId !== youthId ||
        record.userId !== principal.userId ||
        record.role !== principal.role ||
        record.divisionId !== principal.divisionId ||
        record.createdAt !== envelope.createdAt ||
        record.expiresAt !== envelope.expiresAt
      ) {
        throw new Error("M52_CACHE_DECRYPTED_SCOPE_MISMATCH");
      }
      return deepFreeze({
        entryId: record.entryId,
        recordId: record.recordId,
        workflowId: record.workflowId,
        youthId: record.youthId,
        payload: cloneJson(record.payload),
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
        boundary: record.boundary,
        synthetic: true,
      });
    } finally {
      plaintext.fill(0);
    }
  }

  listPartition(
    binding: M52DeviceBinding,
    principal: M52CachePrincipal,
    youthId: string,
    evaluatedAt: string,
  ): readonly Readonly<M52CachedRecord>[] {
    validateBinding(binding);
    validatePrincipal(principal);
    if (!principal.youthScopeIds.includes(youthId)) {
      throw new Error("M52_CACHE_SCOPE_DENIED");
    }
    const expected = this.scopeDigests(binding, principal, youthId);
    const records: Readonly<M52CachedRecord>[] = [];
    for (const envelope of this.store.list()) {
      if (this.scopeMatches(envelope, expected)) {
        const record = this.get(
          binding,
          principal,
          envelope.entryId,
          youthId,
          evaluatedAt,
        );
        if (record) records.push(record);
      }
    }
    return deepFreeze(records);
  }

  wipeUserFromDevice(
    binding: M52DeviceBinding,
    principal: M52CachePrincipal,
  ): number {
    this.requireAvailable();
    requireSyntheticBoundary(binding);
    requireSyntheticBoundary(principal);
    const expectedDevice = deviceDigest(binding);
    const expectedUser = userDigest(principal);
    return this.store.deleteWhere(
      (envelope) =>
        digestsEqual(envelope.deviceDigest, expectedDevice) &&
        digestsEqual(envelope.userDigest, expectedUser),
    );
  }

  wipeBinding(binding: M52DeviceBinding): number {
    this.requireAvailable();
    requireSyntheticBoundary(binding);
    const expected = bindingDigest(binding);
    return this.store.deleteWhere((envelope) =>
      digestsEqual(envelope.bindingDigest, expected),
    );
  }

  wipeDevice(deviceId: string): number {
    this.requireAvailable();
    requireSyntheticId(deviceId, "device_id");
    const expected = sha256("M52-DEVICE", deviceId);
    return this.store.deleteWhere((envelope) =>
      digestsEqual(envelope.deviceDigest, expected),
    );
  }

  persistedEnvelopeCount(): number {
    return this.store.count();
  }

  deviceEnvelopeCount(deviceId: string): number {
    requireSyntheticId(deviceId, "device_id");
    const expected = sha256("M52-DEVICE", deviceId);
    return this.store
      .list()
      .filter((envelope) => digestsEqual(envelope.deviceDigest, expected)).length;
  }

  persistedCiphertextSnapshot(): readonly M52CiphertextEnvelope[] {
    return this.store.list();
  }

  serializedPersistenceSnapshot(): string {
    return JSON.stringify(this.store.list());
  }

  dispose(): void {
    if (!this.disposed) this.rootKey.fill(0);
    this.disposed = true;
  }

  private deriveKey(binding: string, partition: string): Buffer {
    this.requireAvailable();
    return Buffer.from(
      hkdfSync(
        "sha256",
        this.rootKey,
        Buffer.from(binding, "hex"),
        Buffer.from(`AMOS-OPS|M5.2|CACHE|${partition}|KEY-V1`, "utf8"),
        DERIVED_KEY_BYTES,
      ),
    );
  }

  private scopeDigests(
    binding: M52DeviceBinding,
    principal: M52CachePrincipal,
    youthId: string,
  ): Pick<
    M52CiphertextEnvelope,
    "deviceDigest" | "bindingDigest" | "userDigest" | "partitionDigest"
  > {
    return {
      deviceDigest: deviceDigest(binding),
      bindingDigest: bindingDigest(binding),
      userDigest: userDigest(principal),
      partitionDigest: partitionDigest(principal, youthId),
    };
  }

  private scopeMatches(
    envelope: M52CiphertextEnvelope,
    expected: Pick<
      M52CiphertextEnvelope,
      "deviceDigest" | "bindingDigest" | "userDigest" | "partitionDigest"
    >,
  ): boolean {
    return (
      digestsEqual(envelope.deviceDigest, expected.deviceDigest) &&
      digestsEqual(envelope.bindingDigest, expected.bindingDigest) &&
      digestsEqual(envelope.userDigest, expected.userDigest) &&
      digestsEqual(envelope.partitionDigest, expected.partitionDigest)
    );
  }

  private requireAvailable(): void {
    if (this.disposed) throw new Error("M52_CACHE_KEY_MATERIAL_DISPOSED");
  }
}
