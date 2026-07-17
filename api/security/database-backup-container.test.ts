import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  DATABASE_BACKUP_CIPHER,
  DATABASE_BACKUP_CONTAINER_MAGIC,
  DatabaseBackupContainerError,
  decodeDatabaseBackupContainer,
  encodeDatabaseBackupContainer,
  isDatabaseBackupContainer,
} from "./database-backup-container";

const BACKUP_ID = "a42fd6dc-591c-4bc6-880d-f30e7c48f99e";
const DATABASE = Buffer.from(
  "encrypted-sqlcipher-database-fixture\u0000\u0001\u0002",
  "utf8",
);

function digest(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function validManifest() {
  return {
    v: 1,
    kind: "amos-sqlite-backup",
    backupId: BACKUP_ID,
    scope: "operational",
    databaseKeyId: "database-2026-07",
    databaseCipher: DATABASE_BACKUP_CIPHER,
    databaseBytes: DATABASE.length,
    databaseSha256: digest(DATABASE),
  };
}

function rawContainer(serializedManifest: string, database = DATABASE): Buffer {
  const manifest = Buffer.from(serializedManifest, "utf8");
  const prefix = Buffer.alloc(12);
  prefix.write(DATABASE_BACKUP_CONTAINER_MAGIC, 0, "ascii");
  prefix.writeUInt32BE(manifest.length, 8);
  return Buffer.concat([prefix, manifest, database]);
}

function expectCode(callback: () => unknown, code: string): void {
  try {
    callback();
  } catch (error) {
    expect(error).toBeInstanceOf(DatabaseBackupContainerError);
    expect((error as DatabaseBackupContainerError).code).toBe(code);
    return;
  }
  throw new Error(`Expected ${code}`);
}

describe("AMOSDBB1 authenticated database-backup container", () => {
  it("encodes a canonical manifest and round-trips the inner database", () => {
    const container = encodeDatabaseBackupContainer({
      backupId: BACKUP_ID,
      scope: "operational",
      databaseKeyId: "database-2026-07",
      database: DATABASE,
    });

    expect(isDatabaseBackupContainer(container)).toBe(true);
    expect(container.subarray(0, 8).toString("ascii")).toBe("AMOSDBB1");
    const manifestLength = container.readUInt32BE(8);
    expect(container.subarray(12, 12 + manifestLength).toString("utf8")).toBe(
      JSON.stringify(validManifest()),
    );
    expect(decodeDatabaseBackupContainer(container)).toEqual({
      manifest: validManifest(),
      database: DATABASE,
    });
  });

  it("supports the training scope and returns a database copy", () => {
    const source = Buffer.from(DATABASE);
    const container = encodeDatabaseBackupContainer({
      backupId: "0198ae10-c70e-7f52-8cf8-08d370a0e733",
      scope: "training",
      databaseKeyId: "training.key-v2",
      database: source,
    });
    source.fill(0);

    const decoded = decodeDatabaseBackupContainer(container);
    expect(decoded.manifest.scope).toBe("training");
    expect(decoded.manifest.databaseKeyId).toBe("training.key-v2");
    expect(decoded.database).toEqual(DATABASE);
  });

  it("rejects invalid UUID, scope, key ID, and an empty database while encoding", () => {
    const base = {
      backupId: BACKUP_ID,
      scope: "operational" as const,
      databaseKeyId: "database-2026-07",
      database: DATABASE,
    };
    for (const invalid of [
      { ...base, backupId: "not-a-uuid" },
      { ...base, backupId: BACKUP_ID.toUpperCase() },
      { ...base, scope: "production" as "operational" },
      { ...base, databaseKeyId: "x" },
      { ...base, databaseKeyId: "unsafe/key" },
      { ...base, database: Buffer.alloc(0) },
    ]) {
      expectCode(
        () => encodeDatabaseBackupContainer(invalid),
        "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      );
    }
  });

  it("rejects truncated, wrong-magic, and invalid manifest framing", () => {
    expect(isDatabaseBackupContainer(Buffer.from("AMOSDBB1"))).toBe(false);
    expectCode(
      () => decodeDatabaseBackupContainer(Buffer.from("AMOSDBB1")),
      "DATABASE_BACKUP_CONTAINER_TOO_SHORT",
    );

    const wrongMagic = rawContainer(JSON.stringify(validManifest()));
    wrongMagic[0] ^= 0xff;
    expectCode(
      () => decodeDatabaseBackupContainer(wrongMagic),
      "DATABASE_BACKUP_CONTAINER_MAGIC_MISMATCH",
    );

    const zeroLength = Buffer.alloc(12);
    zeroLength.write(DATABASE_BACKUP_CONTAINER_MAGIC, 0, "ascii");
    expectCode(
      () => decodeDatabaseBackupContainer(zeroLength),
      "DATABASE_BACKUP_MANIFEST_LENGTH_INVALID",
    );

    const truncated = rawContainer(JSON.stringify(validManifest()));
    truncated.writeUInt32BE(16 * 1024, 8);
    expectCode(
      () => decodeDatabaseBackupContainer(truncated),
      "DATABASE_BACKUP_MANIFEST_LENGTH_INVALID",
    );
  });

  it("rejects invalid UTF-8 and invalid JSON manifests", () => {
    const invalidUtf8 = Buffer.alloc(13);
    invalidUtf8.write(DATABASE_BACKUP_CONTAINER_MAGIC, 0, "ascii");
    invalidUtf8.writeUInt32BE(1, 8);
    invalidUtf8[12] = 0xff;
    expectCode(
      () => decodeDatabaseBackupContainer(invalidUtf8),
      "DATABASE_BACKUP_MANIFEST_UTF8_INVALID",
    );
    expectCode(
      () => decodeDatabaseBackupContainer(rawContainer("{")),
      "DATABASE_BACKUP_MANIFEST_JSON_INVALID",
    );
  });

  it("rejects unknown, missing, and unsupported manifest fields", () => {
    const manifest = validManifest();
    for (const invalid of [
      { ...manifest, extra: true },
      { ...manifest, kind: "sqlite-backup" },
      { ...manifest, v: 2 },
      { ...manifest, databaseCipher: "sqlcipher" },
      { ...manifest, scope: "production" },
      { ...manifest, databaseKeyId: "bad/key" },
      { ...manifest, databaseSha256: manifest.databaseSha256.toUpperCase() },
      { ...manifest, databaseBytes: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      expectCode(
        () => decodeDatabaseBackupContainer(rawContainer(JSON.stringify(invalid))),
        "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
      );
    }
    const missing = {
      v: manifest.v,
      kind: manifest.kind,
      backupId: manifest.backupId,
      scope: manifest.scope,
      databaseKeyId: manifest.databaseKeyId,
      databaseCipher: manifest.databaseCipher,
      databaseBytes: manifest.databaseBytes,
    };
    expectCode(
      () => decodeDatabaseBackupContainer(rawContainer(JSON.stringify(missing))),
      "DATABASE_BACKUP_MANIFEST_SCHEMA_INVALID",
    );
  });

  it("requires the exact canonical field order and whitespace-free serialization", () => {
    const manifest = validManifest();
    const reordered = JSON.stringify({
      kind: manifest.kind,
      v: manifest.v,
      backupId: manifest.backupId,
      scope: manifest.scope,
      databaseKeyId: manifest.databaseKeyId,
      databaseCipher: manifest.databaseCipher,
      databaseBytes: manifest.databaseBytes,
      databaseSha256: manifest.databaseSha256,
    });
    expectCode(
      () => decodeDatabaseBackupContainer(rawContainer(reordered)),
      "DATABASE_BACKUP_MANIFEST_NOT_CANONICAL",
    );
    expectCode(
      () =>
        decodeDatabaseBackupContainer(
          rawContainer(JSON.stringify(manifest, null, 2)),
        ),
      "DATABASE_BACKUP_MANIFEST_NOT_CANONICAL",
    );
  });

  it("binds the manifest to the exact database length and SHA-256 digest", () => {
    const wrongLength = { ...validManifest(), databaseBytes: DATABASE.length + 1 };
    expectCode(
      () =>
        decodeDatabaseBackupContainer(rawContainer(JSON.stringify(wrongLength))),
      "DATABASE_BACKUP_DATABASE_LENGTH_MISMATCH",
    );

    const wrongDigest = { ...validManifest(), databaseSha256: "0".repeat(64) };
    expectCode(
      () =>
        decodeDatabaseBackupContainer(rawContainer(JSON.stringify(wrongDigest))),
      "DATABASE_BACKUP_DATABASE_HASH_MISMATCH",
    );

    const valid = encodeDatabaseBackupContainer({
      backupId: BACKUP_ID,
      scope: "operational",
      databaseKeyId: "database-2026-07",
      database: DATABASE,
    });
    valid[valid.length - 1] ^= 0xff;
    expectCode(
      () => decodeDatabaseBackupContainer(valid),
      "DATABASE_BACKUP_DATABASE_HASH_MISMATCH",
    );
  });
});
