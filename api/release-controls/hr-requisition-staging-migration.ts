import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  applyPendingMigrations,
  createDatabaseBackup,
  openLifecycleDatabase,
  planMigrations,
  restoreDatabaseBackup,
  validateDatabaseIntegrity,
} from "../data-lifecycle";
import { assertPathConfined } from "../security/path-confinement";

const workforceMigrations = [
  { file: "0013_hr_requisitions.sql", table: "hr_requisitions" },
  { file: "0014_hr_applications.sql", table: "hr_applications" },
  { file: "0015_hr_offers.sql", table: "hr_offers" },
] as const;
const auditColumns = [
  "id", "entity_type", "entity_id", "action", "performed_by", "performed_at", "old_values", "new_values",
];

type Database = ReturnType<typeof openLifecycleDatabase>;

interface StagingRequisitionStorage {
  databasePath: string;
  trainingDatabasePath: string;
  backupPath: string;
}

function assertHealthy(db: Database) {
  if (!validateDatabaseIntegrity(db, []).ok) {
    throw new Error("HR_REQUISITION_STAGING_DATABASE_INTEGRITY_FAILED");
  }
  const columns = new Set(
    (db.pragma("table_info(audit_logs)") as { name: string }[]).map((row) => row.name),
  );
  if (!auditColumns.every((column) => columns.has(column))) {
    throw new Error("HR_REQUISITION_STAGING_AUDIT_SCHEMA_MISSING");
  }
}

function assertApplied(db: Database, folder: string) {
  const plan = planMigrations(db, folder);
  const table = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?");
  if (!workforceMigrations.every(item =>
    plan.some(entry => entry.name === item.file && entry.state === "applied") &&
    table.get(item.table),
  )) {
    throw new Error("HR_REQUISITION_STAGING_MIGRATION_VERIFICATION_FAILED");
  }
}

export async function runHrRequisitionStagingMigration(storage: StagingRequisitionStorage) {
  const checkpointRoot = path.resolve(storage.backupPath);
  fs.mkdirSync(checkpointRoot, { recursive: true });
  const scratch = fs.mkdtempSync(path.join(checkpointRoot, ".hr-workforce-"));
  const folder = path.join(scratch, "migration");
  try {
    fs.mkdirSync(folder);
    for (const migration of workforceMigrations) {
      fs.copyFileSync(path.resolve("db/migrations", migration.file), path.join(folder, migration.file));
    }
    const stores = [
      { scope: "operational", file: storage.databasePath },
      { scope: "training", file: storage.trainingDatabasePath },
    ] as const;
    const results = [];
    for (const { scope, file } of stores) {
      if (!fs.existsSync(file)) {
        results.push({ scope, state: "fresh_schema_deferred" });
        continue;
      }
      const readonly = openLifecycleDatabase(file, { readonly: true });
      let alreadyApplied: boolean;
      try {
        assertHealthy(readonly);
        const plan = planMigrations(readonly, folder);
        alreadyApplied = plan.length === workforceMigrations.length && plan.every(entry => entry.state === "applied");
        if (alreadyApplied) assertApplied(readonly, folder);
      } finally {
        readonly.close();
      }
      if (alreadyApplied) {
        results.push({ scope, state: "already_applied" });
        continue;
      }

      // Create private checkpoint files and rehearse recovery before changing the source database.
      const checkpointDirectory = path.join(checkpointRoot, `hr-workforce-${scope}-${randomUUID()}`);
      assertPathConfined(checkpointRoot, checkpointDirectory);
      fs.mkdirSync(checkpointDirectory, { mode: 0o700 });
      const checkpoint = path.join(checkpointDirectory, "before.db");
      await createDatabaseBackup(file, checkpoint);
      fs.chmodSync(checkpoint, 0o600);
      const rehearsal = path.join(scratch, `${scope}-restore.db`);
      restoreDatabaseBackup(checkpoint, rehearsal);
      const restored = openLifecycleDatabase(rehearsal, { readonly: true });
      try {
        assertHealthy(restored);
      } finally {
        restored.close();
      }

      const writable = openLifecycleDatabase(file);
      try {
        writable.transaction(() => {
          applyPendingMigrations(writable, folder);
          assertApplied(writable, folder);
          assertHealthy(writable);
        }).immediate();
      } finally {
        writable.close();
      }
      results.push({ scope, state: "verified", checkpoint: path.basename(checkpointDirectory) });
    }
    return results;
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}
