import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import type { DatabaseStorageScope } from "./storage-encryption";

export const DATABASE_BACKUP_CONTAINER_MAGIC = "AMOSDBB1";
export const DATABASE_BACKUP_CONTAINER_VERSION = 1 as const;
export const DATABASE_BACKUP_CIPHER =
  "sqlite3mc-sqlcipher-legacy-4" as const;

const MAGIC = Buffer.from(DATABASE_BACKUP_CONTAINER_MAGIC, "ascii");
const PREFIX_BYTES = MAGIC.length + 4;
const MAX_MANIFEST_BYTES = 16 * 1024;
const KEY_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const MANIFEST_KEYS = [
  "v",
  "kind",
  "backupId",
  "scope",
  "databaseKeyId",
  "databaseCipher",
  "databaseBytes",
  "databaseSha256",
] as const;

export type DatabaseBackupContainerErrorCode =
  | "DATABASE_BACKUP_CONTAINER_TOO_SHORT"
  | "DATABASE_BACKUP_CONTAINER_MAGIC_MISMATCH"
  | "DATABASE_BACKUP_MANIFEST_LENGTH_INVALID"
  | "DATABASE_BACKUP_MANIFEST_UTF8_INVALID"
  | "DATABASE_BACKUP_MANIFEST_JSON_INVALID"
  | "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID"
  | "DATABASE_BACKUP_MANIFEST_NOT_CANONICAL"
  | "DATABASE_BACKUP_DATABASE_LENGTH_MISMATCH"
  | "DATABASE_BACKUP_DATABASE_HASH_MISMATCH";

export class DatabaseBackupContainerError extends Error {
  readonly code: DatabaseBackupContainerErrorCode;

  constructor(code: DatabaseBackupContainerErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "DatabaseBackupContainerError";
    this.code = code;
  }
}

export interface DatabaseBackupManifest {
  readonly v: 1;
  readonly kind: "amos-sqlite-backup";
  readonly backupId: string;
  readonly scope: DatabaseStorageScope;
  readonly databaseKeyId: string;
  readonly databaseCipher: typeof DATABASE_BACKUP_CIPHER;
  readonly databaseBytes: number;
  readonly databaseSha256: string;
}

export interface DatabaseBackupContainerInput {
  readonly backupId: string;
  readonly scope: DatabaseStorageScope;
  readonly databaseKeyId: string;
  readonly database: Uint8Array;
}

export interface DecodedDatabaseBackupContainer {
  readonly manifest: DatabaseBackupManifest;
  readonly database: Buffer;
}

function fail(
  code: DatabaseBackupContainerErrorCode,
  detail: string,
): never {
  throw new DatabaseBackupContainerError(code, detail);
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function canonicalManifestJson(manifest: DatabaseBackupManifest): string {
  return JSON.stringify({
    v: manifest.v,
    kind: manifest.kind,
    backupId: manifest.backupId,
    scope: manifest.scope,
    databaseKeyId: manifest.databaseKeyId,
    databaseCipher: manifest.databaseCipher,
    databaseBytes: manifest.databaseBytes,
    databaseSha256: manifest.databaseSha256,
  });
}

function validateManifest(value: unknown): DatabaseBackupManifest {
  if (!isPlainObject(value)) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "the manifest must be a JSON object",
    );
  }

  const keys = Object.keys(value);
  if (
    keys.length !== MANIFEST_KEYS.length ||
    !MANIFEST_KEYS.every((key) => Object.hasOwn(value, key))
  ) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "the manifest must contain exactly the version 1 fields",
    );
  }
  if (value.v !== DATABASE_BACKUP_CONTAINER_VERSION) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "unsupported manifest version",
    );
  }
  if (value.kind !== "amos-sqlite-backup") {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "unsupported backup kind",
    );
  }
  if (typeof value.backupId !== "string" || !UUID_PATTERN.test(value.backupId)) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "backupId must be a canonical RFC 4122 UUID",
    );
  }
  if (value.scope !== "operational" && value.scope !== "training") {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "scope must be operational or training",
    );
  }
  if (
    typeof value.databaseKeyId !== "string" ||
    !KEY_ID_PATTERN.test(value.databaseKeyId)
  ) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "databaseKeyId must contain 3-64 safe characters",
    );
  }
  if (value.databaseCipher !== DATABASE_BACKUP_CIPHER) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "unsupported database cipher",
    );
  }
  if (
    typeof value.databaseBytes !== "number" ||
    !Number.isSafeInteger(value.databaseBytes) ||
    value.databaseBytes <= 0
  ) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "databaseBytes must be a positive safe integer",
    );
  }
  if (
    typeof value.databaseSha256 !== "string" ||
    !SHA256_PATTERN.test(value.databaseSha256)
  ) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      "databaseSha256 must be a lowercase SHA-256 digest",
    );
  }

  return {
    v: DATABASE_BACKUP_CONTAINER_VERSION,
    kind: "amos-sqlite-backup",
    backupId: value.backupId,
    scope: value.scope,
    databaseKeyId: value.databaseKeyId,
    databaseCipher: DATABASE_BACKUP_CIPHER,
    databaseBytes: value.databaseBytes,
    databaseSha256: value.databaseSha256,
  };
}

function manifestBytes(manifest: DatabaseBackupManifest): Buffer {
  const encoded = Buffer.from(canonicalManifestJson(manifest), "utf8");
  if (encoded.length === 0 || encoded.length > MAX_MANIFEST_BYTES) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_LENGTH_INVALID",
      `the manifest must be 1-${MAX_MANIFEST_BYTES} bytes`,
    );
  }
  return encoded;
}

export function isDatabaseBackupContainer(value: Uint8Array): boolean {
  return (
    value.byteLength >= PREFIX_BYTES &&
    Buffer.from(value.buffer, value.byteOffset, MAGIC.length).equals(MAGIC)
  );
}

export function encodeDatabaseBackupContainer(
  input: DatabaseBackupContainerInput,
): Buffer {
  const database = Buffer.from(input.database);
  const manifest = validateManifest({
    v: DATABASE_BACKUP_CONTAINER_VERSION,
    kind: "amos-sqlite-backup",
    backupId: input.backupId,
    scope: input.scope,
    databaseKeyId: input.databaseKeyId,
    databaseCipher: DATABASE_BACKUP_CIPHER,
    databaseBytes: database.length,
    databaseSha256: sha256(database),
  });
  const encodedManifest = manifestBytes(manifest);
  const prefix = Buffer.allocUnsafe(PREFIX_BYTES);
  MAGIC.copy(prefix, 0);
  prefix.writeUInt32BE(encodedManifest.length, MAGIC.length);
  return Buffer.concat([prefix, encodedManifest, database]);
}

export function decodeDatabaseBackupContainer(
  value: Uint8Array,
): DecodedDatabaseBackupContainer {
  const container = Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (container.length < PREFIX_BYTES) {
    return fail(
      "DATABASE_BACKUP_CONTAINER_TOO_SHORT",
      "the container prefix is truncated",
    );
  }
  if (!container.subarray(0, MAGIC.length).equals(MAGIC)) {
    return fail(
      "DATABASE_BACKUP_CONTAINER_MAGIC_MISMATCH",
      `expected ${DATABASE_BACKUP_CONTAINER_MAGIC}`,
    );
  }

  const encodedLength = container.readUInt32BE(MAGIC.length);
  if (
    encodedLength === 0 ||
    encodedLength > MAX_MANIFEST_BYTES ||
    PREFIX_BYTES + encodedLength > container.length
  ) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_LENGTH_INVALID",
      "the encoded manifest length is invalid",
    );
  }

  const encodedManifest = container.subarray(
    PREFIX_BYTES,
    PREFIX_BYTES + encodedLength,
  );
  let serialized: string;
  try {
    serialized = new TextDecoder("utf-8", { fatal: true }).decode(
      encodedManifest,
    );
  } catch {
    return fail(
      "DATABASE_BACKUP_MANIFEST_UTF8_INVALID",
      "the manifest is not valid UTF-8",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(serialized);
  } catch {
    return fail(
      "DATABASE_BACKUP_MANIFEST_JSON_INVALID",
      "the manifest is not valid JSON",
    );
  }
  const manifest = validateManifest(parsed);
  if (serialized !== canonicalManifestJson(manifest)) {
    return fail(
      "DATABASE_BACKUP_MANIFEST_NOT_CANONICAL",
      "the manifest must use the canonical version 1 serialization",
    );
  }

  const database = Buffer.from(container.subarray(PREFIX_BYTES + encodedLength));
  if (database.length !== manifest.databaseBytes) {
    return fail(
      "DATABASE_BACKUP_DATABASE_LENGTH_MISMATCH",
      "the inner database length does not match the manifest",
    );
  }
  if (sha256(database) !== manifest.databaseSha256) {
    return fail(
      "DATABASE_BACKUP_DATABASE_HASH_MISMATCH",
      "the inner database digest does not match the manifest",
    );
  }

  return { manifest, database };
}
