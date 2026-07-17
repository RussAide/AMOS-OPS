import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decryptStoragePayload,
  enforceEncryptedDirectory,
  encryptStoragePayload,
  inspectEncryptedDatabase,
  isEncryptedStoragePayload,
  loadStorageEncryptionConfiguration,
  migrateDatabaseEncryption,
  openEncryptedDatabase,
  rewrapStoragePayload,
} from "./storage-encryption";

const temporaryDirectories: string[] = [];
const OBJECT_ID = "a".repeat(64);
const OTHER_OBJECT_ID = "b".repeat(64);

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "amos-rm2-"));
  temporaryDirectories.push(directory);
  return directory;
}

function key(): string {
  return randomBytes(32).toString("base64");
}

function keySlots(
  prefix: "AMOS_DATABASE" | "AMOS_UPLOAD" | "AMOS_BACKUP",
  keys: Record<string, string>,
): NodeJS.ProcessEnv {
  const manifest: Record<string, string> = {};
  const variables: NodeJS.ProcessEnv = {};
  Object.entries(keys).forEach(([keyId, material], index) => {
    const slot = `${prefix}_KEY_TEST_V${index + 1}`;
    manifest[keyId] = slot;
    variables[slot] = material;
  });
  variables[`${prefix}_KEY_MANIFEST_JSON`] = JSON.stringify(manifest);
  return variables;
}

function environment(options: {
  database?: Record<string, string>;
  upload?: Record<string, string>;
  backup?: Record<string, string>;
  databaseActive?: string;
  uploadActive?: string;
  backupActive?: string;
  migrationMode?: "none" | "encrypt-plaintext" | "rotate";
} = {}): NodeJS.ProcessEnv {
  const database = options.database ?? { "db-2026-07": key() };
  const upload = options.upload ?? { "upload-2026-07": key() };
  const backup = options.backup ?? { "backup-2026-07": key() };
  return {
    NODE_ENV: "production",
    APP_ENV: "production",
    AMOS_STORAGE_ENCRYPTION_REQUIRED: "true",
    AMOS_STORAGE_KEY_PROVIDER: "railway-sealed-variables-v1",
    AMOS_STORAGE_MIGRATION_MODE: options.migrationMode ?? "none",
    AMOS_DATABASE_ACTIVE_KEY_ID:
      options.databaseActive ?? Object.keys(database)[0],
    ...keySlots("AMOS_DATABASE", database),
    AMOS_UPLOAD_ACTIVE_KEY_ID:
      options.uploadActive ?? Object.keys(upload)[0],
    ...keySlots("AMOS_UPLOAD", upload),
    AMOS_BACKUP_ACTIVE_KEY_ID:
      options.backupActive ?? Object.keys(backup)[0],
    ...keySlots("AMOS_BACKUP", backup),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("RM.2 key configuration", () => {
  it("fails closed when Production encryption or a keyring is missing", () => {
    expect(() =>
      loadStorageEncryptionConfiguration({ APP_ENV: "production" }),
    ).toThrow("PRODUCTION_STORAGE_ENCRYPTION_REQUIRED");
    expect(() =>
      loadStorageEncryptionConfiguration({
        APP_ENV: "production",
        AMOS_STORAGE_ENCRYPTION_REQUIRED: "true",
      }),
    ).toThrow("AMOS_DATABASE_ACTIVE_KEY_ID");
  });

  it("requires three independent active keyrings", () => {
    const configured = loadStorageEncryptionConfiguration(environment());
    expect(configured.provider).toBe("railway-sealed-variables-v1");
    expect(configured.database?.activeKeyId).toBe("db-2026-07");
    expect(configured.upload?.activeKeyId).toBe("upload-2026-07");
    expect(configured.backup?.activeKeyId).toBe("backup-2026-07");
  });

  it("loads immutable sealed key slots and rejects inline keyrings", () => {
    const databaseKey = key();
    const uploadKey = key();
    const backupKey = key();
    const configured = loadStorageEncryptionConfiguration({
      NODE_ENV: "production",
      APP_ENV: "production",
      AMOS_STORAGE_ENCRYPTION_REQUIRED: "true",
      AMOS_STORAGE_KEY_PROVIDER: "railway-sealed-variables-v1",
      AMOS_DATABASE_ACTIVE_KEY_ID: "database-2026-07",
      AMOS_DATABASE_KEY_MANIFEST_JSON: JSON.stringify({
        "database-2026-07": "AMOS_DATABASE_KEY_V1",
      }),
      AMOS_DATABASE_KEY_V1: databaseKey,
      AMOS_UPLOAD_ACTIVE_KEY_ID: "upload-2026-07",
      AMOS_UPLOAD_KEY_MANIFEST_JSON: JSON.stringify({
        "upload-2026-07": "AMOS_UPLOAD_KEY_V1",
      }),
      AMOS_UPLOAD_KEY_V1: uploadKey,
      AMOS_BACKUP_ACTIVE_KEY_ID: "backup-2026-07",
      AMOS_BACKUP_KEY_MANIFEST_JSON: JSON.stringify({
        "backup-2026-07": "AMOS_BACKUP_KEY_V1",
      }),
      AMOS_BACKUP_KEY_V1: backupKey,
    });
    expect(configured.database?.activeKeyId).toBe("database-2026-07");
    expect(configured.upload?.activeKeyId).toBe("upload-2026-07");
    expect(configured.backup?.activeKeyId).toBe("backup-2026-07");

    const inline = environment();
    delete inline.AMOS_DATABASE_KEY_MANIFEST_JSON;
    inline.AMOS_DATABASE_KEYRING_JSON = JSON.stringify({
      "database-2026-07": databaseKey,
    });
    expect(() => loadStorageEncryptionConfiguration(inline)).toThrow(
      "AMOS_DATABASE_KEY_MANIFEST_JSON",
    );
  });

  it("rejects reuse of key material across storage domains", () => {
    const reused = key();
    expect(() =>
      loadStorageEncryptionConfiguration(
        environment({
          database: { "database-test": reused },
          upload: { "upload-test": reused },
          backup: { "backup-test": key() },
        }),
      ),
    ).toThrow("STORAGE_KEY_DOMAIN_REUSE_REJECTED");
  });
});

describe("RM.2 AES-256-GCM envelope encryption", () => {
  it("round-trips without exposing plaintext and rejects wrong keys or tampering", () => {
    const source = environment();
    const plaintext = Buffer.from("regulated-record-marker-72d18a", "utf8");
    const encrypted = encryptStoragePayload(
      plaintext,
      "upload-operational",
      OBJECT_ID,
      source,
    );
    expect(isEncryptedStoragePayload(encrypted)).toBe(true);
    expect(encrypted.includes(plaintext)).toBe(false);
    expect(
      decryptStoragePayload(
        encrypted,
        "upload-operational",
        OBJECT_ID,
        source,
      ),
    ).toEqual(plaintext);

    const wrong = environment();
    expect(() =>
      decryptStoragePayload(
        encrypted,
        "upload-operational",
        OBJECT_ID,
        wrong,
      ),
    ).toThrow("ENCRYPTED_STORAGE_AUTHENTICATION_FAILED");
    expect(() =>
      decryptStoragePayload(encrypted, "upload-training", OBJECT_ID, source),
    ).toThrow("PURPOSE_MISMATCH");
    expect(() =>
      decryptStoragePayload(
        encrypted,
        "upload-operational",
        OTHER_OBJECT_ID,
        source,
      ),
    ).toThrow("OBJECT_MISMATCH");

    const tampered = Buffer.from(encrypted);
    tampered[tampered.length - 1] ^= 0xff;
    expect(() =>
      decryptStoragePayload(
        tampered,
        "upload-operational",
        OBJECT_ID,
        source,
      ),
    ).toThrow("AUTHENTICATION_FAILED");
  });

  it("rotates a wrapping key without rewriting ciphertext", () => {
    const oldKey = key();
    const newKey = key();
    const initial = environment({
      upload: { "upload-old": oldKey },
      uploadActive: "upload-old",
    });
    const plaintext = Buffer.from("rotation-marker", "utf8");
    const encrypted = encryptStoragePayload(
      plaintext,
      "upload-operational",
      OBJECT_ID,
      initial,
    );
    const rotating = environment({
      upload: { "upload-old": oldKey, "upload-new": newKey },
      uploadActive: "upload-new",
      migrationMode: "rotate",
    });
    const rewrapped = rewrapStoragePayload(
      encrypted,
      "upload-operational",
      OBJECT_ID,
      rotating,
    );
    expect(rewrapped).not.toEqual(encrypted);
    expect(
      decryptStoragePayload(
        rewrapped,
        "upload-operational",
        OBJECT_ID,
        rotating,
      ),
    ).toEqual(plaintext);
    expect(() =>
      decryptStoragePayload(
        rewrapped,
        "upload-operational",
        OBJECT_ID,
        initial,
      ),
    ).toThrow("ENCRYPTED_STORAGE_AUTHENTICATION_FAILED");
  });
});

describe("RM.2 SQLCipher database encryption", () => {
  it("migrates a plaintext database only through the explicit gate", () => {
    const directory = temporaryDirectory();
    const databasePath = path.join(directory, "operational.db");
    const database = new Database(databasePath);
    database.exec(
      "CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('u1')",
    );
    database.close();

    const databaseKeys = { "db-2026-07": key() };
    const uploadKeys = { "upload-2026-07": key() };
    const backupKeys = { "backup-2026-07": key() };
    const normal = environment({
      database: databaseKeys,
      upload: uploadKeys,
      backup: backupKeys,
    });
    expect(inspectEncryptedDatabase(databasePath, "operational", normal)).toMatchObject({
      encrypted: false,
      cipher: "plaintext",
    });
    expect(() =>
      migrateDatabaseEncryption(databasePath, "operational", normal),
    ).toThrow("MIGRATION_NOT_AUTHORIZED");

    const migration = environment({
      database: databaseKeys,
      upload: uploadKeys,
      backup: backupKeys,
      migrationMode: "encrypt-plaintext",
    });
    expect(
      migrateDatabaseEncryption(databasePath, "operational", migration),
    ).toMatchObject({
      encrypted: true,
      activeKey: true,
      cipher: "sqlcipher-aes-256",
    });
    expect(
      fs.readFileSync(databasePath).subarray(0, 16).toString("ascii"),
    ).not.toContain("SQLite format 3");

    const keyless = new Database(databasePath);
    expect(() => keyless.prepare("SELECT * FROM users").all()).toThrow();
    keyless.close();
    const authorized = openEncryptedDatabase(
      databasePath,
      "operational",
      { readonly: true, fileMustExist: true },
      normal,
    );
    expect(authorized.prepare("SELECT id FROM users").pluck().all()).toEqual([
      "u1",
    ]);
    authorized.close();
  });

  it("leaves the canonical database unchanged when final publication fails", () => {
    const directory = temporaryDirectory();
    const databasePath = path.join(directory, "atomic.db");
    const database = new Database(databasePath);
    database.exec(
      "CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('u1')",
    );
    database.close();
    const before = fs.readFileSync(databasePath);
    const rename = fs.renameSync.bind(fs);
    vi.spyOn(fs, "renameSync").mockImplementation((source, destination) => {
      if (String(source).endsWith(".amos-rm2-partial")) {
        throw new Error("SIMULATED_FINAL_RENAME_FAILURE");
      }
      rename(source, destination);
    });

    expect(() =>
      migrateDatabaseEncryption(
        databasePath,
        "operational",
        environment({ migrationMode: "encrypt-plaintext" }),
      ),
    ).toThrow("SIMULATED_FINAL_RENAME_FAILURE");
    expect(fs.readFileSync(databasePath)).toEqual(before);
    expect(fs.existsSync(`${databasePath}.amos-rm2-partial`)).toBe(false);
    expect(fs.existsSync(`${databasePath}.rm2-original`)).toBe(false);
  });

  it("keeps operational and Training database keys cryptographically isolated", () => {
    const directory = temporaryDirectory();
    const source = environment({ migrationMode: "encrypt-plaintext" });
    const databasePath = path.join(directory, "operational.db");
    const database = new Database(databasePath);
    database.exec("CREATE TABLE users (id TEXT PRIMARY KEY)");
    database.close();
    migrateDatabaseEncryption(databasePath, "operational", source);
    expect(() =>
      openEncryptedDatabase(
        databasePath,
        "training",
        { readonly: true, fileMustExist: true },
        source,
      ),
    ).toThrow("active Production key");
  });

  it("rotates an encrypted database to a new active key and retires the old key", () => {
    const directory = temporaryDirectory();
    const databasePath = path.join(directory, "operational.db");
    const oldKey = key();
    const newKey = key();
    const initial = environment({
      database: { "database-old": oldKey },
      databaseActive: "database-old",
      migrationMode: "encrypt-plaintext",
    });
    const database = new Database(databasePath);
    database.exec(
      "CREATE TABLE users (id TEXT PRIMARY KEY); INSERT INTO users VALUES ('u1')",
    );
    database.close();
    migrateDatabaseEncryption(databasePath, "operational", initial);

    const rotating = environment({
      database: { "database-old": oldKey, "database-new": newKey },
      databaseActive: "database-new",
      migrationMode: "rotate",
    });
    expect(
      migrateDatabaseEncryption(databasePath, "operational", rotating),
    ).toMatchObject({ encrypted: true, activeKey: true, keyId: "database-new" });

    const retired = environment({
      database: { "database-old": oldKey },
      databaseActive: "database-old",
    });
    expect(() =>
      openEncryptedDatabase(
        databasePath,
        "operational",
        { readonly: true, fileMustExist: true },
        retired,
      ),
    ).toThrow("active Production key");
  });
});

describe("RM.2 stored-file migration gate", () => {
  it("rejects plaintext normally and encrypts it only in migration mode", () => {
    const directory = temporaryDirectory();
    const filePath = path.join(directory, "evidence.pdf");
    fs.writeFileSync(filePath, "plaintext-evidence-marker");
    expect(() =>
      enforceEncryptedDirectory(
        directory,
        "upload-operational",
        environment(),
      ),
    ).toThrow("PLAINTEXT_STORAGE_OBJECT_REJECTED");

    const report = enforceEncryptedDirectory(
      directory,
      "upload-operational",
      environment({ migrationMode: "encrypt-plaintext" }),
    );
    expect(report).toMatchObject({ inspected: 1, encrypted: 1 });
    expect(isEncryptedStoragePayload(fs.readFileSync(filePath))).toBe(true);
  });

  it("rejects ciphertext substituted between two stored object names", () => {
    const directory = temporaryDirectory();
    const first = path.join(directory, "first.bin");
    const second = path.join(directory, "second.bin");
    fs.writeFileSync(first, "first-object");
    fs.writeFileSync(second, "second-object");
    enforceEncryptedDirectory(
      directory,
      "upload-operational",
      environment({ migrationMode: "encrypt-plaintext" }),
    );
    const firstPayload = fs.readFileSync(first);
    const secondPayload = fs.readFileSync(second);
    fs.writeFileSync(first, secondPayload);
    fs.writeFileSync(second, firstPayload);

    expect(() =>
      enforceEncryptedDirectory(
        directory,
        "upload-operational",
        environment(),
      ),
    ).toThrow("ENCRYPTED_STORAGE_OBJECT_MISMATCH");
  });

  it("cleans only reserved crash temporaries and inventories ordinary partial files", () => {
    const directory = temporaryDirectory();
    const stale = path.join(directory, "record.bin.amos-encrypted-partial");
    const ordinary = path.join(directory, "record.partial");
    fs.writeFileSync(stale, "uncommitted-temporary");
    fs.writeFileSync(ordinary, "authoritative-plaintext");

    expect(() =>
      enforceEncryptedDirectory(
        directory,
        "upload-operational",
        environment(),
      ),
    ).toThrow("PLAINTEXT_STORAGE_OBJECT_REJECTED");
    expect(fs.existsSync(stale)).toBe(false);
    expect(fs.existsSync(ordinary)).toBe(true);
  });
});
