import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createDatabaseBackup,
  enforceDatabaseBackupDirectory,
  restoreDatabaseBackup,
} from "../data-lifecycle";
import {
  decryptStoragePayloadWithMetadata,
  deriveStorageObjectId,
  isEncryptedStoragePayload,
  migrateDatabaseEncryption,
  openEncryptedDatabase,
} from "../security/storage-encryption";
import { decodeDatabaseBackupContainer } from "../security/database-backup-container";

const trackedNames = [
  "APP_ENV",
  "PERSISTENT_ROOT",
  "DATABASE_PATH",
  "TRAINING_DATABASE_PATH",
  "BACKUP_PATH",
  "AMOS_STORAGE_ENCRYPTION_REQUIRED",
  "AMOS_STORAGE_KEY_PROVIDER",
  "AMOS_STORAGE_MIGRATION_MODE",
  "AMOS_DATABASE_ACTIVE_KEY_ID",
  "AMOS_DATABASE_KEY_MANIFEST_JSON",
  "AMOS_DATABASE_KEY_TEST_V1",
  "AMOS_DATABASE_KEY_TEST_V2",
  "AMOS_UPLOAD_ACTIVE_KEY_ID",
  "AMOS_UPLOAD_KEY_MANIFEST_JSON",
  "AMOS_UPLOAD_KEY_TEST_V1",
  "AMOS_BACKUP_ACTIVE_KEY_ID",
  "AMOS_BACKUP_KEY_MANIFEST_JSON",
  "AMOS_BACKUP_KEY_TEST_V1",
  "AMOS_BACKUP_KEY_TEST_V2",
] as const;
const originalEnvironment = new Map<string, string | undefined>();
const temporaryRoots: string[] = [];

function key(): string {
  return randomBytes(32).toString("base64");
}

function sha256(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

beforeEach(() => {
  for (const name of trackedNames) originalEnvironment.set(name, process.env[name]);
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const name of trackedNames) {
    const value = originalEnvironment.get(name);
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
  originalEnvironment.clear();
  for (const root of temporaryRoots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function configureProduction(): {
  databasePath: string;
  backupPath: string;
  backupRoot: string;
  databaseKey: string;
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "amos-rm2-backup-"));
  temporaryRoots.push(root);
  const databasePath = path.join(root, "data/production/amos-ops.db");
  const trainingDatabasePath = path.join(
    root,
    "data/production/training/amos-ops-training.db",
  );
  const backupRoot = path.join(root, "backups/production");
  const backupPath = path.join(backupRoot, "operational.amosbackup");
  const databaseKey = key();
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  fs.mkdirSync(backupRoot, { recursive: true });

  Object.assign(process.env, {
    APP_ENV: "production",
    PERSISTENT_ROOT: root,
    DATABASE_PATH: databasePath,
    TRAINING_DATABASE_PATH: trainingDatabasePath,
    BACKUP_PATH: backupRoot,
    AMOS_STORAGE_ENCRYPTION_REQUIRED: "true",
    AMOS_STORAGE_KEY_PROVIDER: "railway-sealed-variables-v1",
    AMOS_STORAGE_MIGRATION_MODE: "encrypt-plaintext",
    AMOS_DATABASE_ACTIVE_KEY_ID: "database-test-v1",
    AMOS_DATABASE_KEY_MANIFEST_JSON: JSON.stringify({
      "database-test-v1": "AMOS_DATABASE_KEY_TEST_V1",
    }),
    AMOS_DATABASE_KEY_TEST_V1: databaseKey,
    AMOS_UPLOAD_ACTIVE_KEY_ID: "upload-test-v1",
    AMOS_UPLOAD_KEY_MANIFEST_JSON: JSON.stringify({
      "upload-test-v1": "AMOS_UPLOAD_KEY_TEST_V1",
    }),
    AMOS_UPLOAD_KEY_TEST_V1: key(),
    AMOS_BACKUP_ACTIVE_KEY_ID: "backup-test-v1",
    AMOS_BACKUP_KEY_MANIFEST_JSON: JSON.stringify({
      "backup-test-v1": "AMOS_BACKUP_KEY_TEST_V1",
    }),
    AMOS_BACKUP_KEY_TEST_V1: key(),
  });

  const database = new Database(databasePath);
  database.exec(
    "CREATE TABLE users (id TEXT PRIMARY KEY, marker TEXT NOT NULL)",
  );
  database
    .prepare("INSERT INTO users (id, marker) VALUES (?, ?)")
    .run("u1", "authorized-restore-marker");
  database.close();
  migrateDatabaseEncryption(databasePath, "operational");
  process.env.AMOS_STORAGE_MIGRATION_MODE = "none";
  return { databasePath, backupPath, backupRoot, databaseKey };
}

describe("RM.2 encrypted database backup and restore", () => {
  it("creates only authenticated ciphertext and restores it with authorized keys", async () => {
    const { databasePath, backupPath, backupRoot } = configureProduction();
    await createDatabaseBackup(databasePath, backupPath);
    const payload = fs.readFileSync(backupPath);
    expect(isEncryptedStoragePayload(payload)).toBe(true);
    expect(payload.includes(Buffer.from("authorized-restore-marker"))).toBe(false);
    expect(fs.statSync(backupPath).mode & 0o077).toBe(0);
    const authenticated = decryptStoragePayloadWithMetadata(
      payload,
      "backup-files",
      deriveStorageObjectId(backupRoot, backupPath, "backup-files"),
    );
    try {
      const decoded = decodeDatabaseBackupContainer(authenticated.plaintext);
      try {
        expect(authenticated.keyId).toBe("backup-test-v1");
        expect(decoded.manifest).toMatchObject({
          scope: "operational",
          databaseKeyId: "database-test-v1",
          databaseCipher: "sqlite3mc-sqlcipher-legacy-4",
        });
      } finally {
        decoded.database.fill(0);
      }
    } finally {
      authenticated.plaintext.fill(0);
    }
    expect(enforceDatabaseBackupDirectory(backupRoot)).toMatchObject({
      inspected: 1,
      outerBackupKeyIds: ["backup-test-v1"],
      innerDatabaseKeyIds: ["database-test-v1"],
    });

    const changed = openEncryptedDatabase(databasePath, "operational");
    changed.prepare("UPDATE users SET marker = ? WHERE id = ?").run("changed", "u1");
    changed.close();
    restoreDatabaseBackup(backupPath, databasePath, {
      allowOverwrite: true,
      maintenanceConfirmed: true,
    });

    const restored = openEncryptedDatabase(databasePath, "operational", {
      readonly: true,
      fileMustExist: true,
    });
    expect(
      restored.prepare("SELECT marker FROM users WHERE id = ?").pluck().get("u1"),
    ).toBe("authorized-restore-marker");
    restored.close();
  });

  it("rejects an unauthorized backup key without modifying the restore target", async () => {
    const { databasePath, backupPath } = configureProduction();
    await createDatabaseBackup(databasePath, backupPath);
    const before = sha256(databasePath);
    process.env.AMOS_BACKUP_KEY_TEST_V1 = key();

    expect(() =>
      restoreDatabaseBackup(backupPath, databasePath, {
        allowOverwrite: true,
        maintenanceConfirmed: true,
      }),
    ).toThrow("ENCRYPTED_STORAGE_AUTHENTICATION_FAILED");
    expect(sha256(databasePath)).toBe(before);
  });

  it("restores into an absent canonical Production target", async () => {
    const { databasePath, backupPath } = configureProduction();
    await createDatabaseBackup(databasePath, backupPath);
    fs.rmSync(databasePath);
    fs.rmSync(`${databasePath}-wal`, { force: true });
    fs.rmSync(`${databasePath}-shm`, { force: true });

    restoreDatabaseBackup(backupPath, databasePath);
    const restored = openEncryptedDatabase(databasePath, "operational", {
      readonly: true,
      fileMustExist: true,
    });
    expect(restored.prepare("SELECT COUNT(*) FROM users").pluck().get()).toBe(1);
    restored.close();
  });

  it("rejects Production backup destinations outside the governed root", async () => {
    const { databasePath } = configureProduction();
    await expect(
      createDatabaseBackup(databasePath, path.join(os.tmpdir(), "outside.db")),
    ).rejects.toThrow("PRODUCTION_BACKUP_PATH_REJECTED");
  });

  it(
    "restores an older backup and rekeys it to the current database key",
    async () => {
      const { databasePath, backupPath } = configureProduction();
      await createDatabaseBackup(databasePath, backupPath);
      const nextKey = key();
      process.env.AMOS_DATABASE_ACTIVE_KEY_ID = "database-test-v2";
      process.env.AMOS_DATABASE_KEY_MANIFEST_JSON = JSON.stringify({
        "database-test-v1": "AMOS_DATABASE_KEY_TEST_V1",
        "database-test-v2": "AMOS_DATABASE_KEY_TEST_V2",
      });
      process.env.AMOS_DATABASE_KEY_TEST_V2 = nextKey;
      process.env.AMOS_STORAGE_MIGRATION_MODE = "rotate";
      migrateDatabaseEncryption(databasePath, "operational");
      process.env.AMOS_STORAGE_MIGRATION_MODE = "none";

      restoreDatabaseBackup(backupPath, databasePath, {
        allowOverwrite: true,
        maintenanceConfirmed: true,
      });
      const restored = openEncryptedDatabase(databasePath, "operational", {
        readonly: true,
        fileMustExist: true,
      });
      expect(restored.prepare("SELECT COUNT(*) FROM users").pluck().get()).toBe(1);
      restored.close();

      process.env.AMOS_DATABASE_ACTIVE_KEY_ID = "database-test-v1";
      process.env.AMOS_DATABASE_KEY_MANIFEST_JSON = JSON.stringify({
        "database-test-v1": "AMOS_DATABASE_KEY_TEST_V1",
      });
      delete process.env.AMOS_DATABASE_KEY_TEST_V2;
      expect(() =>
        openEncryptedDatabase(databasePath, "operational", {
          readonly: true,
          fileMustExist: true,
        }),
      ).toThrow("active Production key");
    },
    20_000,
  );

  it("preserves an existing backup when final publication fails", async () => {
    const { databasePath, backupPath } = configureProduction();
    await createDatabaseBackup(databasePath, backupPath);
    const before = sha256(backupPath);
    const rename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((source, destination) => {
      if (String(source).endsWith(".amos-backup-partial")) {
        throw new Error("SIMULATED_BACKUP_RENAME_FAILURE");
      }
      rename(source, destination);
    });

    await expect(
      createDatabaseBackup(databasePath, backupPath, { allowOverwrite: true }),
    ).rejects.toThrow("SIMULATED_BACKUP_RENAME_FAILURE");
    expect(sha256(backupPath)).toBe(before);
    expect(fs.existsSync(`${backupPath}.amos-backup-partial`)).toBe(false);
  });

  it("preserves the live database when restore publication fails", async () => {
    const { databasePath, backupPath } = configureProduction();
    await createDatabaseBackup(databasePath, backupPath);
    const changed = openEncryptedDatabase(databasePath, "operational");
    changed.prepare("UPDATE users SET marker = ? WHERE id = ?").run("changed", "u1");
    changed.close();
    const before = sha256(databasePath);
    const rename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((source, destination) => {
      if (String(source).endsWith(".amos-restore-partial")) {
        throw new Error("SIMULATED_RESTORE_RENAME_FAILURE");
      }
      rename(source, destination);
    });

    expect(() =>
      restoreDatabaseBackup(backupPath, databasePath, {
        allowOverwrite: true,
        maintenanceConfirmed: true,
      }),
    ).toThrow("SIMULATED_RESTORE_RENAME_FAILURE");
    expect(sha256(databasePath)).toBe(before);
    expect(
      fs.existsSync(`${databasePath}.amos-restore-partial`),
    ).toBe(false);
  });

  it("retains the old database key dependency after outer backup-key rotation", async () => {
    const { databasePath, backupPath, backupRoot } = configureProduction();
    await createDatabaseBackup(databasePath, backupPath);
    const previousBackupKey = process.env.AMOS_BACKUP_KEY_TEST_V1 || "";
    const nextDatabaseKey = key();
    const nextBackupKey = key();
    process.env.AMOS_DATABASE_ACTIVE_KEY_ID = "database-test-v2";
    process.env.AMOS_DATABASE_KEY_MANIFEST_JSON = JSON.stringify({
      "database-test-v1": "AMOS_DATABASE_KEY_TEST_V1",
      "database-test-v2": "AMOS_DATABASE_KEY_TEST_V2",
    });
    process.env.AMOS_DATABASE_KEY_TEST_V2 = nextDatabaseKey;
    process.env.AMOS_BACKUP_ACTIVE_KEY_ID = "backup-test-v2";
    process.env.AMOS_BACKUP_KEY_MANIFEST_JSON = JSON.stringify({
      "backup-test-v1": "AMOS_BACKUP_KEY_TEST_V1",
      "backup-test-v2": "AMOS_BACKUP_KEY_TEST_V2",
    });
    process.env.AMOS_BACKUP_KEY_TEST_V1 = previousBackupKey;
    process.env.AMOS_BACKUP_KEY_TEST_V2 = nextBackupKey;
    process.env.AMOS_STORAGE_MIGRATION_MODE = "rotate";
    migrateDatabaseEncryption(databasePath, "operational");
    const report = enforceDatabaseBackupDirectory(backupRoot);
    expect(report).toMatchObject({
      rewrapped: 1,
      outerBackupKeyIds: ["backup-test-v2"],
      innerDatabaseKeyIds: ["database-test-v1"],
    });

    process.env.AMOS_DATABASE_KEY_MANIFEST_JSON = JSON.stringify({
      "database-test-v2": "AMOS_DATABASE_KEY_TEST_V2",
    });
    delete process.env.AMOS_DATABASE_KEY_TEST_V1;
    process.env.AMOS_STORAGE_MIGRATION_MODE = "none";
    expect(() => enforceDatabaseBackupDirectory(backupRoot)).toThrow(
      "DATABASE_DECRYPTION_FAILED",
    );
  });

  it("rejects legacy plaintext database backups instead of blindly wrapping them", () => {
    const { backupPath, backupRoot } = configureProduction();
    const legacy = new Database(backupPath);
    legacy.exec("CREATE TABLE legacy (id TEXT PRIMARY KEY)");
    legacy.close();
    process.env.AMOS_STORAGE_MIGRATION_MODE = "encrypt-plaintext";

    expect(() => enforceDatabaseBackupDirectory(backupRoot)).toThrow(
      "LEGACY_BACKUP_FORMAT_UNSUPPORTED",
    );
    expect(
      fs.readFileSync(backupPath).subarray(0, 16).toString("ascii"),
    ).toContain("SQLite format 3");
  });

  it("cleans reserved backup crash temporaries but does not hide ordinary partial files", () => {
    const { backupRoot } = configureProduction();
    const stale = path.join(backupRoot, "job.amos-backup-partial");
    const ordinary = path.join(backupRoot, "authoritative.partial");
    fs.writeFileSync(stale, "uncommitted-temporary");
    fs.writeFileSync(ordinary, "authoritative-legacy-artifact");

    expect(() => enforceDatabaseBackupDirectory(backupRoot)).toThrow(
      "LEGACY_BACKUP_FORMAT_UNSUPPORTED",
    );
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(ordinary)).toBe(true);
  });
});
