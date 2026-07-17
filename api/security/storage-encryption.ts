import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { assertPathConfined } from "./path-confinement";

export type StorageKeyDomain = "database" | "upload" | "backup";
export type DatabaseStorageScope = "operational" | "training";
export type EncryptedStoragePurpose =
  | "upload-operational"
  | "upload-training"
  | "backup-operational"
  | "backup-training"
  | "backup-files";
export type StorageMigrationMode = "none" | "encrypt-plaintext" | "rotate";

export interface StorageKeyring {
  readonly domain: StorageKeyDomain;
  readonly activeKeyId: string;
  readonly keys: ReadonlyMap<string, Buffer>;
}

export interface StorageEncryptionConfiguration {
  readonly enabled: boolean;
  readonly provider: "railway-sealed-variables-v1" | "none";
  readonly migrationMode: StorageMigrationMode;
  readonly database: StorageKeyring | null;
  readonly upload: StorageKeyring | null;
  readonly backup: StorageKeyring | null;
}

export interface DatabaseEncryptionInspection {
  readonly encrypted: boolean;
  readonly activeKey: boolean;
  readonly keyId: string | null;
  readonly cipher: "sqlcipher-aes-256" | "plaintext";
  readonly engine: "sqlite3mc" | "none";
  readonly engineVersion: "SQLite3 Multiple Ciphers 2.3.5" | null;
  readonly compatibility: "sqlcipher-legacy-4" | null;
  readonly integrity: "ok";
}

export interface DirectoryEncryptionReport {
  readonly directory: string;
  readonly purpose: EncryptedStoragePurpose;
  readonly inspected: number;
  readonly encrypted: number;
  readonly rewrapped: number;
  readonly alreadyProtected: number;
}

export interface DecryptedStoragePayload {
  readonly plaintext: Buffer;
  readonly keyId: string;
  readonly purpose: EncryptedStoragePurpose;
  readonly objectId: string;
  readonly envelopeVersion: 2;
}

const ENVELOPE_MAGIC = Buffer.from("AMOSENC2", "ascii");
const ENVELOPE_VERSION = 2;
const MAX_HEADER_BYTES = 16 * 1024;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const OBJECT_ID_PATTERN = /^[a-f0-9]{64}$/;
const KEY_BYTES = 32;
const GCM_NONCE_BYTES = 12;
const GCM_TAG_BYTES = 16;
const DATABASE_KEY_SALT = Buffer.from("amos-ops/sqlcipher/v1", "utf8");
const ENVELOPE_KEY_SALT = Buffer.from("amos-ops/envelope-kek/v1", "utf8");
const STORAGE_DOMAINS: readonly StorageKeyDomain[] = [
  "database",
  "upload",
  "backup",
] as const;

interface EnvelopeHeader {
  v: 2;
  algorithm: "AES-256-GCM";
  purpose: EncryptedStoragePurpose;
  keyId: string;
  objectId: string;
  dataNonce: string;
  dataTag: string;
  wrapNonce: string;
  wrapTag: string;
  wrappedDek: string;
  plaintextBytes: number;
}

function enabled(value: string | undefined): boolean {
  return ["1", "true", "yes", "on"].includes(
    value?.trim().toLowerCase() ?? "",
  );
}

function variablePrefix(domain: StorageKeyDomain): string {
  return `AMOS_${domain.toUpperCase()}`;
}

function parseMigrationMode(value: string | undefined): StorageMigrationMode {
  const normalized = value?.trim().toLowerCase() || "none";
  if (
    normalized === "none" ||
    normalized === "encrypt-plaintext" ||
    normalized === "rotate"
  ) {
    return normalized;
  }
  throw new Error(
    "AMOS_STORAGE_MIGRATION_MODE must be none, encrypt-plaintext, or rotate.",
  );
}

function parseKeyring(
  domain: StorageKeyDomain,
  source: NodeJS.ProcessEnv,
): StorageKeyring {
  const prefix = variablePrefix(domain);
  const activeKeyId = source[`${prefix}_ACTIVE_KEY_ID`]?.trim() || "";
  if (!KEY_ID_PATTERN.test(activeKeyId)) {
    throw new Error(
      `${prefix}_ACTIVE_KEY_ID must be a versioned identifier of 3-64 safe characters.`,
    );
  }

  const manifestVariable = `${prefix}_KEY_MANIFEST_JSON`;
  const serialized = source[manifestVariable]?.trim() || "";
  if (!serialized) {
    throw new Error(
      `${manifestVariable} is required when storage encryption is enabled.`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    throw new Error(`${manifestVariable} must be valid JSON.`);
  }
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error(`${manifestVariable} must be a JSON object.`);
  }

  const keys = new Map<string, Buffer>();
  const usedSlots = new Set<string>();
  try {
    for (const [keyId, slotOrEncoded] of Object.entries(parsed)) {
      if (!KEY_ID_PATTERN.test(keyId) || typeof slotOrEncoded !== "string") {
        throw new Error(`${manifestVariable} contains an invalid key entry.`);
      }
      const slotName = slotOrEncoded.trim();
      if (
        !new RegExp(`^${prefix}_KEY_[A-Z][A-Z0-9_]{1,47}$`, "u").test(
          slotName,
        ) ||
        slotName === manifestVariable
      ) {
        throw new Error(
          `${manifestVariable} must map each key ID to a dedicated ${prefix}_KEY_* variable.`,
        );
      }
      if (usedSlots.has(slotName)) {
        throw new Error(
          `${manifestVariable} must not reuse a sealed key slot.`,
        );
      }
      usedSlots.add(slotName);
      const encoded = source[slotName]?.trim() || "";
      const key = Buffer.from(encoded, "base64");
      if (
        key.length !== KEY_BYTES ||
        key.toString("base64") !== encoded
      ) {
        key.fill(0);
        throw new Error(
          `${slotName} must contain canonical base64 for exactly 32 bytes.`,
        );
      }
      keys.set(keyId, key);
    }
    if (!keys.has(activeKeyId)) {
      throw new Error(
        `${manifestVariable} does not contain the configured active key ID.`,
      );
    }
  } catch (error) {
    for (const key of keys.values()) key.fill(0);
    throw error;
  }
  return { domain, activeKeyId, keys };
}

export function loadStorageEncryptionConfiguration(
  source: NodeJS.ProcessEnv = process.env,
  production = source.APP_ENV?.trim().toLowerCase() === "production",
): StorageEncryptionConfiguration {
  const encryptionEnabled = enabled(source.AMOS_STORAGE_ENCRYPTION_REQUIRED);
  const provider =
    source.AMOS_STORAGE_KEY_PROVIDER?.trim().toLowerCase() ||
    (encryptionEnabled ? "railway-sealed-variables-v1" : "none");
  const migrationMode = parseMigrationMode(source.AMOS_STORAGE_MIGRATION_MODE);

  if (production && !encryptionEnabled) {
    throw new Error(
      "PRODUCTION_STORAGE_ENCRYPTION_REQUIRED: set AMOS_STORAGE_ENCRYPTION_REQUIRED=true.",
    );
  }
  if (!encryptionEnabled) {
    if (production || migrationMode !== "none") {
      throw new Error(
        "Storage migration cannot run while storage encryption is disabled.",
      );
    }
    return {
      enabled: false,
      provider: "none",
      migrationMode,
      database: null,
      upload: null,
      backup: null,
    };
  }
  if (provider !== "railway-sealed-variables-v1") {
    throw new Error(
      "AMOS_STORAGE_KEY_PROVIDER must be railway-sealed-variables-v1 for this release.",
    );
  }

  const keyrings = new Map<StorageKeyDomain, StorageKeyring>();
  try {
    for (const domain of STORAGE_DOMAINS) {
      keyrings.set(domain, parseKeyring(domain, source));
    }
  } catch (error) {
    for (const configured of keyrings.values()) {
      for (const material of configured.keys.values()) material.fill(0);
    }
    throw error;
  }
  const fingerprints = new Set<string>();
  for (const keyring of keyrings.values()) {
    for (const key of keyring.keys.values()) {
      const fingerprint = createHash("sha256").update(key).digest("hex");
      if (fingerprints.has(fingerprint)) {
        for (const configured of keyrings.values()) {
          for (const material of configured.keys.values()) material.fill(0);
        }
        throw new Error(
          "STORAGE_KEY_DOMAIN_REUSE_REJECTED: database, upload, and backup keys must be independent.",
        );
      }
      fingerprints.add(fingerprint);
    }
  }
  return {
    enabled: true,
    provider,
    migrationMode,
    database: keyrings.get("database") ?? null,
    upload: keyrings.get("upload") ?? null,
    backup: keyrings.get("backup") ?? null,
  };
}

export function disposeStorageEncryptionConfiguration(
  configuration: StorageEncryptionConfiguration,
): void {
  for (const domain of STORAGE_DOMAINS) {
    const keyring = configuration[domain];
    if (!keyring) continue;
    for (const key of keyring.keys.values()) key.fill(0);
  }
}

function requireKeyring(
  configuration: StorageEncryptionConfiguration,
  domain: StorageKeyDomain,
): StorageKeyring {
  const keyring = configuration[domain];
  if (!configuration.enabled || !keyring) {
    throw new Error(`STORAGE_ENCRYPTION_NOT_CONFIGURED: ${domain}.`);
  }
  return keyring;
}

function deriveKey(master: Buffer, context: string, salt: Buffer): Buffer {
  return Buffer.from(
    hkdfSync("sha256", master, salt, Buffer.from(context, "utf8"), KEY_BYTES),
  );
}

function databaseKey(
  keyring: StorageKeyring,
  keyId: string,
  scope: DatabaseStorageScope,
): Buffer {
  const master = keyring.keys.get(keyId);
  if (!master) throw new Error("DATABASE_ENCRYPTION_KEY_UNAVAILABLE.");
  return deriveKey(master, `database:${scope}`, DATABASE_KEY_SALT);
}

function envelopeKek(
  keyring: StorageKeyring,
  keyId: string,
  purpose: EncryptedStoragePurpose,
): Buffer {
  const master = keyring.keys.get(keyId);
  if (!master) throw new Error("STORAGE_ENCRYPTION_KEY_UNAVAILABLE.");
  return deriveKey(master, `envelope:${purpose}`, ENVELOPE_KEY_SALT);
}

function configureSqlCipher(database: Database.Database): void {
  database.pragma("cipher='sqlcipher'");
  database.pragma("legacy=4");
}

function assertSqlCipherEngineVersion(database: Database.Database): void {
  const engineVersion = database
    .prepare("SELECT sqlite3mc_version()")
    .pluck()
    .get();
  if (engineVersion !== "SQLite3 Multiple Ciphers 2.3.5") {
    throw new Error("SQLCIPHER_ENGINE_VERSION_UNAPPROVED.");
  }
  const cipher = database.pragma("cipher", { simple: true });
  if (String(cipher).toLowerCase() !== "sqlcipher") {
    throw new Error("SQLCIPHER_ENGINE_UNAVAILABLE.");
  }
}

function assertSqlCipherIntegrity(database: Database.Database): void {
  const cipherIntegrity = database.pragma("cipher_integrity_check") as unknown[];
  if (cipherIntegrity.length !== 0) {
    throw new Error("DATABASE_CIPHER_INTEGRITY_FAILED.");
  }
  const integrity = database.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    throw new Error("DATABASE_INTEGRITY_FAILED.");
  }
}

function openWithKey(
  databasePath: string,
  scope: DatabaseStorageScope,
  keyring: StorageKeyring,
  keyId: string,
  options: Database.Options = {},
): Database.Database {
  const database = new Database(databasePath, options);
  const key = databaseKey(keyring, keyId, scope);
  try {
    configureSqlCipher(database);
    database.key(key);
    assertSqlCipherEngineVersion(database);
    database.prepare("SELECT count(*) FROM sqlite_master").get();
    assertSqlCipherIntegrity(database);
    return database;
  } catch (error) {
    database.close();
    throw error;
  } finally {
    key.fill(0);
  }
}

function orderedKeyIds(keyring: StorageKeyring): string[] {
  return [
    keyring.activeKeyId,
    ...[...keyring.keys.keys()].filter((keyId) => keyId !== keyring.activeKeyId),
  ];
}

function tryOpenPlaintext(
  databasePath: string,
  options: Database.Options = {},
): Database.Database | null {
  const database = new Database(databasePath, options);
  try {
    database.prepare("SELECT count(*) FROM sqlite_master").get();
    const header = fs.readFileSync(databasePath).subarray(0, 16).toString("ascii");
    if (!header.startsWith("SQLite format 3")) {
      database.close();
      return null;
    }
    return database;
  } catch {
    database.close();
    return null;
  }
}

export function inspectEncryptedDatabase(
  databasePath: string,
  scope: DatabaseStorageScope,
  source: NodeJS.ProcessEnv = process.env,
): DatabaseEncryptionInspection {
  const configuration = loadStorageEncryptionConfiguration(source);
  const keyring = requireKeyring(configuration, "database");
  try {
    for (const keyId of orderedKeyIds(keyring)) {
      try {
        const database = openWithKey(databasePath, scope, keyring, keyId, {
          readonly: true,
          fileMustExist: true,
        });
        database.close();
        return {
          encrypted: true,
          activeKey: keyId === keyring.activeKeyId,
          keyId,
          cipher: "sqlcipher-aes-256",
          engine: "sqlite3mc",
          engineVersion: "SQLite3 Multiple Ciphers 2.3.5",
          compatibility: "sqlcipher-legacy-4",
          integrity: "ok",
        };
      } catch {
        // Try the next authorized retained key without exposing identifiers.
      }
    }
    const plaintext = tryOpenPlaintext(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    if (plaintext) {
      plaintext.close();
      return {
        encrypted: false,
        activeKey: false,
        keyId: null,
        cipher: "plaintext",
        engine: "none",
        engineVersion: null,
        compatibility: null,
        integrity: "ok",
      };
    }
    throw new Error(
      "DATABASE_DECRYPTION_FAILED: no authorized key can open the database.",
    );
  } finally {
    disposeStorageEncryptionConfiguration(configuration);
  }
}

export function openEncryptedDatabase(
  databasePath: string,
  scope: DatabaseStorageScope,
  options: Database.Options = {},
  source: NodeJS.ProcessEnv = process.env,
): Database.Database {
  const configuration = loadStorageEncryptionConfiguration(source);
  const keyring = requireKeyring(configuration, "database");
  try {
    try {
      const database = openWithKey(
        databasePath,
        scope,
        keyring,
        keyring.activeKeyId,
        options,
      );
      if (!options.readonly) {
        database.pragma("foreign_keys = ON");
        database.pragma("journal_mode = WAL");
      }
      return database;
    } catch {
      throw new Error(
        "DATABASE_DECRYPTION_FAILED: the active Production key cannot open the database.",
      );
    }
  } finally {
    disposeStorageEncryptionConfiguration(configuration);
  }
}

function syncFile(filePath: string): void {
  const descriptor = fs.openSync(filePath, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

function syncDirectory(directoryPath: string): void {
  const descriptor = fs.openSync(directoryPath, "r");
  try {
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
}

export function migrateDatabaseEncryption(
  databasePath: string,
  scope: DatabaseStorageScope,
  source: NodeJS.ProcessEnv = process.env,
): DatabaseEncryptionInspection {
  const configuration = loadStorageEncryptionConfiguration(source);
  const keyring = requireKeyring(configuration, "database");
  try {
    if (configuration.migrationMode === "none") {
      throw new Error("DATABASE_ENCRYPTION_MIGRATION_NOT_AUTHORIZED.");
    }

  const before = inspectEncryptedDatabase(databasePath, scope, source);
  if (before.encrypted && before.activeKey) return before;
  if (
    !before.encrypted &&
    configuration.migrationMode !== "encrypt-plaintext"
  ) {
    throw new Error("PLAINTEXT_DATABASE_MIGRATION_NOT_AUTHORIZED.");
  }
  if (before.encrypted && configuration.migrationMode !== "rotate") {
    throw new Error("DATABASE_KEY_ROTATION_NOT_AUTHORIZED.");
  }

  const resolvedPath = path.resolve(databasePath);
  const partialPath = `${resolvedPath}.amos-rm2-partial`;
  fs.rmSync(partialPath, { force: true });

  try {
  let sourceDatabase: Database.Database;
  if (before.encrypted && before.keyId) {
    sourceDatabase = openWithKey(
      resolvedPath,
      scope,
      keyring,
      before.keyId,
    );
  } else {
    const plaintextDatabase = tryOpenPlaintext(resolvedPath, {
      fileMustExist: true,
    });
    if (!plaintextDatabase) {
      throw new Error("PLAINTEXT_DATABASE_OPEN_FAILED.");
    }
    sourceDatabase = plaintextDatabase;
  }
  try {
    sourceDatabase.pragma("wal_checkpoint(TRUNCATE)");
    sourceDatabase.pragma("journal_mode = DELETE");
  } finally {
    sourceDatabase.close();
  }

  fs.copyFileSync(resolvedPath, partialPath, fs.constants.COPYFILE_EXCL);
  fs.chmodSync(partialPath, 0o600);
  const partial = before.encrypted && before.keyId
    ? openWithKey(partialPath, scope, keyring, before.keyId)
    : (tryOpenPlaintext(partialPath, { fileMustExist: true }) as Database.Database);
  const activeKey = databaseKey(keyring, keyring.activeKeyId, scope);
  try {
    configureSqlCipher(partial);
    partial.rekey(activeKey);
    assertSqlCipherEngineVersion(partial);
    assertSqlCipherIntegrity(partial);
  } finally {
    activeKey.fill(0);
    partial.close();
  }
  syncFile(partialPath);

  const verifiedPartial = openWithKey(
    partialPath,
    scope,
    keyring,
    keyring.activeKeyId,
    { readonly: true, fileMustExist: true },
  );
  verifiedPartial.close();

  fs.renameSync(partialPath, resolvedPath);
  syncDirectory(path.dirname(resolvedPath));
  const installed = openWithKey(
    resolvedPath,
    scope,
    keyring,
    keyring.activeKeyId,
    { readonly: true, fileMustExist: true },
  );
  installed.close();
  fs.rmSync(`${resolvedPath}-wal`, { force: true });
  fs.rmSync(`${resolvedPath}-shm`, { force: true });

    return inspectEncryptedDatabase(resolvedPath, scope, source);
  } finally {
    fs.rmSync(partialPath, { force: true });
  }
  } finally {
    disposeStorageEncryptionConfiguration(configuration);
  }
}

function keyringForPurpose(
  configuration: StorageEncryptionConfiguration,
  purpose: EncryptedStoragePurpose,
): StorageKeyring {
  return requireKeyring(
    configuration,
    purpose.startsWith("upload-") ? "upload" : "backup",
  );
}

function dataAad(
  purpose: EncryptedStoragePurpose,
  objectId: string,
): Buffer {
  return Buffer.from(
    `AMOSENC2|${ENVELOPE_VERSION}|${purpose}|${objectId}|data`,
    "utf8",
  );
}

function wrapAad(
  purpose: EncryptedStoragePurpose,
  keyId: string,
  objectId: string,
): Buffer {
  return Buffer.from(
    `AMOSENC2|${ENVELOPE_VERSION}|${purpose}|${objectId}|${keyId}|dek`,
    "utf8",
  );
}

export function deriveStorageObjectId(
  storageRoot: string,
  filePath: string,
  purpose: EncryptedStoragePurpose,
): string {
  const confined = assertPathConfined(storageRoot, filePath, {
    allowMissing: true,
    type: "file",
  });
  const relative = path
    .relative(confined.root, confined.candidate)
    .split(path.sep)
    .join("/");
  return createHash("sha256")
    .update(`AMOSENC2|object|${purpose}|${relative}`, "utf8")
    .digest("hex");
}

function cipherGcm(
  key: Buffer,
  nonce: Buffer,
  aad: Buffer,
  plaintext: Buffer,
): { ciphertext: Buffer; tag: Buffer } {
  const cipher = createCipheriv("aes-256-gcm", key, nonce, {
    authTagLength: GCM_TAG_BYTES,
  });
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { ciphertext, tag: cipher.getAuthTag() };
}

function decipherGcm(
  key: Buffer,
  nonce: Buffer,
  aad: Buffer,
  tag: Buffer,
  ciphertext: Buffer,
): Buffer {
  const decipher = createDecipheriv("aes-256-gcm", key, nonce, {
    authTagLength: GCM_TAG_BYTES,
  });
  decipher.setAAD(aad);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function encodeEnvelope(header: EnvelopeHeader, ciphertext: Buffer): Buffer {
  const serialized = Buffer.from(JSON.stringify(header), "utf8");
  if (serialized.length > MAX_HEADER_BYTES) {
    throw new Error("ENCRYPTED_STORAGE_HEADER_TOO_LARGE.");
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(serialized.length);
  return Buffer.concat([ENVELOPE_MAGIC, length, serialized, ciphertext]);
}

function decodeEnvelope(payload: Buffer): {
  header: EnvelopeHeader;
  ciphertext: Buffer;
} {
  if (
    payload.length < ENVELOPE_MAGIC.length + 4 ||
    !payload.subarray(0, ENVELOPE_MAGIC.length).equals(ENVELOPE_MAGIC)
  ) {
    throw new Error("PLAINTEXT_STORAGE_OBJECT_REJECTED.");
  }
  const headerLength = payload.readUInt32BE(ENVELOPE_MAGIC.length);
  const headerStart = ENVELOPE_MAGIC.length + 4;
  const ciphertextStart = headerStart + headerLength;
  if (
    headerLength < 2 ||
    headerLength > MAX_HEADER_BYTES ||
    ciphertextStart > payload.length
  ) {
    throw new Error("ENCRYPTED_STORAGE_HEADER_INVALID.");
  }
  let header: EnvelopeHeader;
  try {
    header = JSON.parse(
      payload.subarray(headerStart, ciphertextStart).toString("utf8"),
    ) as EnvelopeHeader;
  } catch {
    throw new Error("ENCRYPTED_STORAGE_HEADER_INVALID.");
  }
  if (
    header.v !== ENVELOPE_VERSION ||
    header.algorithm !== "AES-256-GCM" ||
    !KEY_ID_PATTERN.test(header.keyId) ||
    !OBJECT_ID_PATTERN.test(header.objectId) ||
    !Number.isSafeInteger(header.plaintextBytes) ||
    header.plaintextBytes < 0
  ) {
    throw new Error("ENCRYPTED_STORAGE_HEADER_INVALID.");
  }
  if (
    Buffer.from(header.dataNonce, "base64").length !== GCM_NONCE_BYTES ||
    Buffer.from(header.dataTag, "base64").length !== GCM_TAG_BYTES ||
    Buffer.from(header.wrapNonce, "base64").length !== GCM_NONCE_BYTES ||
    Buffer.from(header.wrapTag, "base64").length !== GCM_TAG_BYTES ||
    Buffer.from(header.wrappedDek, "base64").length !== KEY_BYTES
  ) {
    throw new Error("ENCRYPTED_STORAGE_HEADER_INVALID.");
  }
  return { header, ciphertext: payload.subarray(ciphertextStart) };
}

export function isEncryptedStoragePayload(payload: Buffer): boolean {
  return (
    payload.length >= ENVELOPE_MAGIC.length &&
    payload.subarray(0, ENVELOPE_MAGIC.length).equals(ENVELOPE_MAGIC)
  );
}

export function encryptStoragePayload(
  plaintext: Buffer,
  purpose: EncryptedStoragePurpose,
  objectId: string,
  source: NodeJS.ProcessEnv = process.env,
): Buffer {
  if (!OBJECT_ID_PATTERN.test(objectId)) {
    throw new Error("ENCRYPTED_STORAGE_OBJECT_ID_INVALID.");
  }
  const configuration = loadStorageEncryptionConfiguration(source);
  const keyring = keyringForPurpose(configuration, purpose);
  const keyId = keyring.activeKeyId;
  const kek = envelopeKek(keyring, keyId, purpose);
  const dek = randomBytes(KEY_BYTES);
  try {
    const dataNonce = randomBytes(GCM_NONCE_BYTES);
    const encrypted = cipherGcm(
      dek,
      dataNonce,
      dataAad(purpose, objectId),
      plaintext,
    );
    const wrapNonce = randomBytes(GCM_NONCE_BYTES);
    const wrapped = cipherGcm(
      kek,
      wrapNonce,
      wrapAad(purpose, keyId, objectId),
      dek,
    );
    const header: EnvelopeHeader = {
      v: ENVELOPE_VERSION,
      algorithm: "AES-256-GCM",
      purpose,
      keyId,
      objectId,
      dataNonce: dataNonce.toString("base64"),
      dataTag: encrypted.tag.toString("base64"),
      wrapNonce: wrapNonce.toString("base64"),
      wrapTag: wrapped.tag.toString("base64"),
      wrappedDek: wrapped.ciphertext.toString("base64"),
      plaintextBytes: plaintext.length,
    };
    return encodeEnvelope(header, encrypted.ciphertext);
  } finally {
    dek.fill(0);
    kek.fill(0);
    disposeStorageEncryptionConfiguration(configuration);
  }
}

function unwrapDek(
  header: EnvelopeHeader,
  keyring: StorageKeyring,
): Buffer {
  const kek = envelopeKek(keyring, header.keyId, header.purpose);
  try {
    return decipherGcm(
      kek,
      Buffer.from(header.wrapNonce, "base64"),
      wrapAad(header.purpose, header.keyId, header.objectId),
      Buffer.from(header.wrapTag, "base64"),
      Buffer.from(header.wrappedDek, "base64"),
    );
  } catch {
    throw new Error("STORAGE_KEY_UNWRAP_FAILED.");
  } finally {
    kek.fill(0);
  }
}

export function decryptStoragePayloadWithMetadata(
  payload: Buffer,
  expectedPurpose: EncryptedStoragePurpose,
  expectedObjectId: string,
  source: NodeJS.ProcessEnv = process.env,
): DecryptedStoragePayload {
  const { header, ciphertext } = decodeEnvelope(payload);
  if (header.purpose !== expectedPurpose) {
    throw new Error("ENCRYPTED_STORAGE_PURPOSE_MISMATCH.");
  }
  if (header.objectId !== expectedObjectId) {
    throw new Error("ENCRYPTED_STORAGE_OBJECT_MISMATCH.");
  }
  const configuration = loadStorageEncryptionConfiguration(source);
  const keyring = keyringForPurpose(configuration, expectedPurpose);
  let dek: Buffer | null = null;
  try {
    dek = unwrapDek(header, keyring);
    const plaintext = decipherGcm(
      dek,
      Buffer.from(header.dataNonce, "base64"),
      dataAad(expectedPurpose, expectedObjectId),
      Buffer.from(header.dataTag, "base64"),
      ciphertext,
    );
    if (
      plaintext.length !== header.plaintextBytes
    ) {
      plaintext.fill(0);
      throw new Error("ENCRYPTED_STORAGE_PLAINTEXT_VALIDATION_FAILED.");
    }
    return {
      plaintext,
      keyId: header.keyId,
      purpose: header.purpose,
      objectId: header.objectId,
      envelopeVersion: header.v,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "ENCRYPTED_STORAGE_PLAINTEXT_VALIDATION_FAILED."
    ) {
      throw error;
    }
    throw new Error("ENCRYPTED_STORAGE_AUTHENTICATION_FAILED.");
  } finally {
    dek?.fill(0);
    disposeStorageEncryptionConfiguration(configuration);
  }
}

export function decryptStoragePayload(
  payload: Buffer,
  expectedPurpose: EncryptedStoragePurpose,
  expectedObjectId: string,
  source: NodeJS.ProcessEnv = process.env,
): Buffer {
  return decryptStoragePayloadWithMetadata(
    payload,
    expectedPurpose,
    expectedObjectId,
    source,
  ).plaintext;
}

export function rewrapStoragePayload(
  payload: Buffer,
  expectedPurpose: EncryptedStoragePurpose,
  expectedObjectId: string,
  source: NodeJS.ProcessEnv = process.env,
): Buffer {
  const decoded = decodeEnvelope(payload);
  if (decoded.header.purpose !== expectedPurpose) {
    throw new Error("ENCRYPTED_STORAGE_PURPOSE_MISMATCH.");
  }
  if (decoded.header.objectId !== expectedObjectId) {
    throw new Error("ENCRYPTED_STORAGE_OBJECT_MISMATCH.");
  }
  const configuration = loadStorageEncryptionConfiguration(source);
  const keyring = keyringForPurpose(configuration, expectedPurpose);
  if (decoded.header.keyId === keyring.activeKeyId) {
    disposeStorageEncryptionConfiguration(configuration);
    return payload;
  }
  let dek: Buffer | null = null;
  let newKek: Buffer | null = null;
  try {
    dek = unwrapDek(decoded.header, keyring);
    newKek = envelopeKek(keyring, keyring.activeKeyId, expectedPurpose);
    const wrapNonce = randomBytes(GCM_NONCE_BYTES);
    const wrapped = cipherGcm(
      newKek,
      wrapNonce,
      wrapAad(expectedPurpose, keyring.activeKeyId, expectedObjectId),
      dek,
    );
    const header: EnvelopeHeader = {
      ...decoded.header,
      keyId: keyring.activeKeyId,
      wrapNonce: wrapNonce.toString("base64"),
      wrapTag: wrapped.tag.toString("base64"),
      wrappedDek: wrapped.ciphertext.toString("base64"),
    };
    return encodeEnvelope(header, decoded.ciphertext);
  } finally {
    dek?.fill(0);
    newKek?.fill(0);
    disposeStorageEncryptionConfiguration(configuration);
  }
}

export function writeEncryptedFileAtomic(
  filePath: string,
  plaintext: Buffer,
  purpose: EncryptedStoragePurpose,
  storageRoot: string = path.dirname(path.resolve(filePath)),
  source: NodeJS.ProcessEnv = process.env,
): void {
  const destination = path.resolve(filePath);
  assertPathConfined(path.dirname(destination), destination, {
    allowMissing: true,
    type: "file",
  });
  const temporary = `${destination}.amos-encrypted-partial`;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.rmSync(temporary, { force: true });
  const objectId = deriveStorageObjectId(storageRoot, destination, purpose);
  const payload = encryptStoragePayload(plaintext, purpose, objectId, source);
  try {
    fs.writeFileSync(temporary, payload, { mode: 0o600, flag: "wx" });
    syncFile(temporary);
    fs.renameSync(temporary, destination);
    syncDirectory(path.dirname(destination));
  } finally {
    payload.fill(0);
    fs.rmSync(temporary, { force: true });
  }
}

export function readEncryptedFile(
  filePath: string,
  purpose: EncryptedStoragePurpose,
  storageRoot: string = path.dirname(path.resolve(filePath)),
  source: NodeJS.ProcessEnv = process.env,
): Buffer {
  const resolved = path.resolve(filePath);
  assertPathConfined(path.dirname(resolved), resolved, {
    allowMissing: false,
    type: "file",
  });
  const objectId = deriveStorageObjectId(storageRoot, resolved, purpose);
  return decryptStoragePayload(
    fs.readFileSync(resolved),
    purpose,
    objectId,
    source,
  );
}

function storedFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];
  const root = path.resolve(directory);
  assertPathConfined(root, root, {
    allowRoot: true,
    allowMissing: false,
    type: "directory",
  });
  const files: string[] = [];
  const visit = (current: string): void => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const candidate = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`STORAGE_SYMLINK_REJECTED: ${candidate}`);
      }
      if (entry.isDirectory()) visit(candidate);
      else if (
        entry.isFile() &&
        entry.name.endsWith(".amos-encrypted-partial")
      ) {
        fs.rmSync(candidate);
        syncDirectory(current);
      } else if (entry.isFile()) {
        assertPathConfined(root, candidate, {
          allowMissing: false,
          type: "file",
        });
        files.push(candidate);
      }
    }
  };
  visit(directory);
  return files.sort();
}

function replaceFileAtomic(filePath: string, payload: Buffer): void {
  assertPathConfined(path.dirname(filePath), filePath, {
    allowMissing: false,
    type: "file",
  });
  const temporary = `${filePath}.amos-encrypted-partial`;
  fs.rmSync(temporary, { force: true });
  fs.writeFileSync(temporary, payload, { mode: 0o600, flag: "wx" });
  try {
    syncFile(temporary);
    fs.renameSync(temporary, filePath);
    syncDirectory(path.dirname(filePath));
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

export function removeStaleDatabaseEncryptionTemporary(
  databasePath: string,
): boolean {
  const temporary = `${path.resolve(databasePath)}.amos-rm2-partial`;
  if (!fs.existsSync(temporary)) return false;
  const stats = fs.lstatSync(temporary);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error("DATABASE_ENCRYPTION_TEMPORARY_INVALID.");
  }
  fs.rmSync(temporary);
  syncDirectory(path.dirname(temporary));
  return true;
}

export function rewrapEncryptedFileAtomic(
  filePath: string,
  purpose: EncryptedStoragePurpose,
  storageRoot: string,
  source: NodeJS.ProcessEnv = process.env,
): boolean {
  const resolved = path.resolve(filePath);
  assertPathConfined(path.dirname(resolved), resolved, {
    allowMissing: false,
    type: "file",
  });
  const payload = fs.readFileSync(resolved);
  if (!isEncryptedStoragePayload(payload)) {
    throw new Error("PLAINTEXT_STORAGE_OBJECT_REJECTED.");
  }
  const objectId = deriveStorageObjectId(storageRoot, resolved, purpose);
  const rewrapped = rewrapStoragePayload(
    payload,
    purpose,
    objectId,
    source,
  );
  if (rewrapped === payload) return false;
  try {
    replaceFileAtomic(resolved, rewrapped);
    return true;
  } finally {
    rewrapped.fill(0);
  }
}

export function enforceEncryptedDirectory(
  directory: string,
  purpose: EncryptedStoragePurpose,
  source: NodeJS.ProcessEnv = process.env,
): DirectoryEncryptionReport {
  const configuration = loadStorageEncryptionConfiguration(source);
  const keyring = keyringForPurpose(configuration, purpose);
  const report = {
    directory: path.resolve(directory),
    purpose,
    inspected: 0,
    encrypted: 0,
    rewrapped: 0,
    alreadyProtected: 0,
  };
  try {
    for (const filePath of storedFiles(directory)) {
      report.inspected += 1;
      const objectId = deriveStorageObjectId(directory, filePath, purpose);
      const payload = fs.readFileSync(filePath);
      if (!isEncryptedStoragePayload(payload)) {
        if (configuration.migrationMode !== "encrypt-plaintext") {
          throw new Error("PLAINTEXT_STORAGE_OBJECT_REJECTED.");
        }
        const protectedPayload = encryptStoragePayload(
          payload,
          purpose,
          objectId,
          source,
        );
        try {
          replaceFileAtomic(filePath, protectedPayload);
        } finally {
          protectedPayload.fill(0);
          payload.fill(0);
        }
        report.encrypted += 1;
        continue;
      }

      const decoded = decodeEnvelope(payload);
      if (!keyring.keys.has(decoded.header.keyId)) {
        throw new Error("STORAGE_ENCRYPTION_KEY_UNAVAILABLE.");
      }
      const plaintext = decryptStoragePayload(
        payload,
        purpose,
        objectId,
        source,
      );
      plaintext.fill(0);
      if (decoded.header.keyId !== keyring.activeKeyId) {
        if (configuration.migrationMode !== "rotate") {
          throw new Error("STORAGE_KEY_ROTATION_REQUIRED.");
        }
        const rewrapped = rewrapStoragePayload(
          payload,
          purpose,
          objectId,
          source,
        );
        try {
          replaceFileAtomic(filePath, rewrapped);
        } finally {
          rewrapped.fill(0);
        }
        report.rewrapped += 1;
      } else {
        report.alreadyProtected += 1;
      }
    }
    return report;
  } finally {
    disposeStorageEncryptionConfiguration(configuration);
  }
}

export function databaseFileSha256(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
