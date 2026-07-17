import { randomBytes } from "node:crypto";
import fs from "node:fs";
import Database from "better-sqlite3";
import { enforceDatabaseBackupDirectory } from "./data-lifecycle";
import { env } from "./lib/env";
import {
  enforceEncryptedDirectory,
  inspectEncryptedDatabase,
  openEncryptedDatabase,
  type DatabaseStorageScope,
} from "./security/storage-encryption";

function fail(message: string): never {
  throw new Error(`RM2_EVIDENCE_FAILED: ${message}`);
}

function plaintextSqliteHeader(databasePath: string): boolean {
  const descriptor = fs.openSync(databasePath, "r");
  const header = Buffer.alloc(16);
  try {
    fs.readSync(descriptor, header, 0, header.length, 0);
    return header.toString("ascii") === "SQLite format 3\u0000";
  } finally {
    header.fill(0);
    fs.closeSync(descriptor);
  }
}

function keylessReadDenied(databasePath: string): boolean {
  let database: Database.Database | null = null;
  try {
    database = new Database(databasePath, {
      readonly: true,
      fileMustExist: true,
    });
    database.prepare("SELECT count(*) FROM sqlite_master").get();
    return false;
  } catch {
    return true;
  } finally {
    database?.close();
  }
}

function crossScopeReadDenied(
  databasePath: string,
  wrongScope: DatabaseStorageScope,
): boolean {
  try {
    const database = openEncryptedDatabase(databasePath, wrongScope, {
      readonly: true,
      fileMustExist: true,
    });
    database.close();
    return false;
  } catch {
    return true;
  }
}

function wrongKeySource(domain: "DATABASE" | "UPLOAD" | "BACKUP") {
  const source = { ...process.env };
  const manifestName = `AMOS_${domain}_KEY_MANIFEST_JSON`;
  const manifest = JSON.parse(source[manifestName] || "{}") as Record<
    string,
    string
  >;
  for (const slot of Object.values(manifest)) {
    source[slot] = randomBytes(32).toString("base64");
  }
  return source;
}

if (!env.isProduction) fail("Production environment is required.");
if (env.storageMigrationMode !== "none") {
  fail("Run evidence only after migration mode returns to none.");
}

const databases = [
  {
    scope: "operational" as const,
    path: env.databasePath,
    wrongScope: "training" as const,
  },
  {
    scope: "training" as const,
    path: env.trainingDatabasePath,
    wrongScope: "operational" as const,
  },
].map(({ scope, path, wrongScope }) => {
  const inspection = inspectEncryptedDatabase(path, scope);
  if (!inspection.encrypted || !inspection.activeKey || !inspection.keyId) {
    fail(`${scope} database is not protected by the active key.`);
  }
  if (plaintextSqliteHeader(path)) fail(`${scope} database header is plaintext.`);
  if (!keylessReadDenied(path)) fail(`${scope} database allowed a keyless read.`);
  if (!crossScopeReadDenied(path, wrongScope)) {
    fail(`${scope} database opened with the wrong data-scope context.`);
  }
  try {
    inspectEncryptedDatabase(path, scope, wrongKeySource("DATABASE"));
    fail(`${scope} database opened with generated wrong keys.`);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("RM2_EVIDENCE_FAILED")
    ) {
      throw error;
    }
  }
  return {
    scope,
    keyId: inspection.keyId,
    cipher: inspection.cipher,
    engine: inspection.engine,
    engineVersion: inspection.engineVersion,
    compatibility: inspection.compatibility,
    integrity: inspection.integrity,
    plaintextHeader: false,
    keylessReadDenied: true,
    wrongKeyReadDenied: true,
    crossScopeReadDenied: true,
  };
});

const uploadReports = [
  enforceEncryptedDirectory(env.uploadPath, "upload-operational"),
  enforceEncryptedDirectory(env.trainingUploadPath, "upload-training"),
];
const backupReport = enforceDatabaseBackupDirectory(env.backupPath);
const uploadWrongKeyDenied =
  uploadReports.reduce((total, report) => total + report.inspected, 0) === 0
    ? null
    : (() => {
        try {
          enforceEncryptedDirectory(
            env.uploadPath,
            "upload-operational",
            wrongKeySource("UPLOAD"),
          );
          if (uploadReports[0].inspected > 0) return false;
          enforceEncryptedDirectory(
            env.trainingUploadPath,
            "upload-training",
            wrongKeySource("UPLOAD"),
          );
          return false;
        } catch {
          return true;
        }
      })();
if (uploadWrongKeyDenied === false) fail("Stored uploads accepted wrong keys.");
const backupWrongKeyDenied =
  backupReport.inspected === 0
    ? null
    : (() => {
        try {
          enforceDatabaseBackupDirectory(
            env.backupPath,
            wrongKeySource("BACKUP"),
          );
          return false;
        } catch {
          return true;
        }
      })();
if (backupWrongKeyDenied === false) fail("Stored backups accepted wrong keys.");

process.stdout.write(
  `${JSON.stringify(
    {
      event: "rm2.storage.evidence",
      generatedAt: new Date().toISOString(),
      buildId: env.buildId,
      provider: env.storageKeyProvider,
      migrationMode: env.storageMigrationMode,
      activeKeyIds: {
        database: env.databaseActiveKeyId,
        upload: env.uploadActiveKeyId,
        backup: env.backupActiveKeyId,
      },
      databases,
      uploads: uploadReports.map((report) => ({
        purpose: report.purpose,
        inspected: report.inspected,
        protected: report.alreadyProtected,
      })),
      uploadWrongKeyDenied,
      backups: {
        inspected: backupReport.inspected,
        outerBackupKeyIds: backupReport.outerBackupKeyIds,
        innerDatabaseKeyIds: backupReport.innerDatabaseKeyIds,
        wrongKeyDenied: backupWrongKeyDenied,
      },
      result: "pass",
    },
    null,
    2,
  )}\n`,
);
