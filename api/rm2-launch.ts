import fs from "node:fs";
import path from "node:path";
import { env } from "./lib/env";
import {
  enforceEncryptedDirectory,
  migrateDatabaseEncryption,
} from "./security/storage-encryption";
import { enforceDatabaseBackupDirectory } from "./data-lifecycle";

const RM2_MIGRATION_CONFIRMATION = "RM2_ENCRYPT_PRODUCTION_STORAGE";

function decodeMountInfoPath(value: string): string {
  return value.replace(/\\(040|011|012|134)/gu, (_match, code: string) => {
    switch (code) {
      case "040":
        return " ";
      case "011":
        return "\t";
      case "012":
        return "\n";
      default:
        return "\\";
    }
  });
}

function assertProductionMount(root: string): void {
  const mountPoints = new Set<string>();
  const mountInfo = fs.readFileSync("/proc/self/mountinfo", "utf8");
  for (const line of mountInfo.split("\n")) {
    if (!line.trim()) continue;
    const fields = line.split(" - ", 1)[0]?.split(" ") ?? [];
    if (fields.length >= 5) {
      mountPoints.add(path.resolve(decodeMountInfoPath(fields[4])));
    }
  }
  if (!mountPoints.has(path.resolve(root))) {
    throw new Error(
      `RM2_PERSISTENT_VOLUME_NOT_MOUNTED: ${path.resolve(root)} is not active.`,
    );
  }
}

function migrateProductionStorage(): void {
  if (!env.isProduction) {
    throw new Error("RM2_STORAGE_MIGRATION_REQUIRES_PRODUCTION.");
  }
  if (
    process.env.AMOS_STORAGE_MIGRATION_CONFIRMATION !==
    RM2_MIGRATION_CONFIRMATION
  ) {
    throw new Error(
      `RM2_STORAGE_MIGRATION_CONFIRMATION must equal ${RM2_MIGRATION_CONFIRMATION}.`,
    );
  }
  assertProductionMount(env.persistentRoot);

  // Legacy or malformed application backups cannot be inferred or converted.
  // Validate them before the first authoritative database is changed so this
  // predictable late-stage failure cannot leave a partially migrated volume.
  const databaseBackupReport = enforceDatabaseBackupDirectory(env.backupPath);
  const databaseReports = [
    migrateDatabaseEncryption(env.databasePath, "operational"),
    migrateDatabaseEncryption(env.trainingDatabasePath, "training"),
  ];
  const directoryReports = [
    enforceEncryptedDirectory(
      env.uploadPath,
      "upload-operational",
      process.env,
      [env.trainingUploadPath],
    ),
    enforceEncryptedDirectory(env.trainingUploadPath, "upload-training"),
  ];

  process.stdout.write(
    `${JSON.stringify({
      event: "rm2.storage.migration.completed",
      databaseReports: databaseReports.map((report) => ({
        encrypted: report.encrypted,
        activeKey: report.activeKey,
        cipher: report.cipher,
        integrity: report.integrity,
      })),
      directoryReports: directoryReports.map((report) => ({
        purpose: report.purpose,
        inspected: report.inspected,
        encrypted: report.encrypted,
        rewrapped: report.rewrapped,
        alreadyProtected: report.alreadyProtected,
      })),
      databaseBackupReport: {
        inspected: databaseBackupReport.inspected,
        rewrapped: databaseBackupReport.rewrapped,
        outerKeyVersions: databaseBackupReport.outerBackupKeyIds.length,
        innerDatabaseKeyVersions:
          databaseBackupReport.innerDatabaseKeyIds.length,
      },
    })}\n`,
  );
}

if (env.storageMigrationMode !== "none") {
  migrateProductionStorage();
} else if (process.env.AMOS_STORAGE_MIGRATION_CONFIRMATION) {
  throw new Error(
    "RM2_STORAGE_MIGRATION_CONFIRMATION must be removed when migration mode is none.",
  );
}

await import("./boot");
