import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  applyPendingMigrations,
  createDatabaseBackup,
  openLifecycleDatabase,
  planMigrations,
  validateDatabaseIntegrity,
} from "../data-lifecycle";

const TARGET_MIGRATION = "0012_gad_logistics_r2_workplans.sql";
const REQUIRED_TABLE = "gad_logistics_workplan_items";
const REQUIRED_INDEXES = [
  "idx_gad_logistics_workplan_owner",
  "idx_gad_logistics_workplan_request",
  "idx_gad_logistics_workplan_due",
] as const;

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function assertObject(
  db: ReturnType<typeof openLifecycleDatabase>,
  type: "table" | "index",
  name: string,
): void {
  const found = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?")
    .get(type, name);
  if (!found) {
    throw new Error(`REQUIRED_${type.toUpperCase()}_MISSING:${name}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_PATH || !process.env.BACKUP_PATH) {
    throw new Error("LOGISTICS_R2_STORAGE_PATHS_REQUIRED");
  }

  const databasePath = path.resolve(process.env.DATABASE_PATH);
  const backupRoot = path.resolve(process.env.BACKUP_PATH);
  const migrationsDirectory = path.resolve(process.cwd(), "db", "migrations");

  const readonly = openLifecycleDatabase(databasePath, { readonly: true });
  let targetState: "applied" | "pending";
  let targetChecksum: string;
  try {
    const integrity = validateDatabaseIntegrity(readonly, []);
    if (
      integrity.sqliteIntegrity !== "ok" ||
      integrity.foreignKeyViolations !== 0
    ) {
      throw new Error("LOGISTICS_R2_PRE_MIGRATION_INTEGRITY_FAILED");
    }

    const plan = planMigrations(readonly, migrationsDirectory);
    const target = plan.find((item) => item.name === TARGET_MIGRATION);
    if (!target) throw new Error("LOGISTICS_R2_TARGET_MIGRATION_MISSING");

    targetState = target.state;
    targetChecksum = target.checksum;

    const targetIndex = plan.findIndex(
      (item) => item.name === TARGET_MIGRATION,
    );
    for (const prior of plan.slice(0, targetIndex)) {
      if (prior.state !== "applied") {
        throw new Error(
          `LOGISTICS_R2_PRIOR_MIGRATION_NOT_APPLIED:${prior.name}`,
        );
      }
    }

    if (target.state === "pending") {
      const pendingThroughTarget = plan
        .slice(0, targetIndex + 1)
        .filter((item) => item.state === "pending");
      if (
        pendingThroughTarget.length !== 1 ||
        pendingThroughTarget[0].name !== TARGET_MIGRATION
      ) {
        throw new Error("LOGISTICS_R2_PENDING_MIGRATION_SET_REJECTED");
      }
    }
  } finally {
    readonly.close();
  }

  let appliedNow = false;
  let backupBasename: string | null = null;
  let backupSha256: string | null = null;

  if (targetState === "pending") {
    fs.mkdirSync(backupRoot, { recursive: true });
    backupBasename =
      "gad-logistics-r2-pre-0012-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".db";
    const backupPath = path.join(backupRoot, backupBasename);
    await createDatabaseBackup(databasePath, backupPath);
    backupSha256 = sha256(fs.readFileSync(backupPath));

    const writable = openLifecycleDatabase(databasePath);
    try {
      const plan = planMigrations(writable, migrationsDirectory);
      const targetIndex = plan.findIndex(
        (item) => item.name === TARGET_MIGRATION,
      );
      const pendingThroughTarget = plan
        .slice(0, targetIndex + 1)
        .filter((item) => item.state === "pending");
      if (
        pendingThroughTarget.length !== 1 ||
        pendingThroughTarget[0].name !== TARGET_MIGRATION
      ) {
        throw new Error("LOGISTICS_R2_APPLY_SET_REJECTED");
      }

      const applied = applyPendingMigrations(writable, migrationsDirectory);
      const targetApplied = applied.find(
        (item) => item.name === TARGET_MIGRATION,
      );
      if (!targetApplied || targetApplied.checksum !== targetChecksum) {
        throw new Error("LOGISTICS_R2_APPLY_MISMATCH");
      }
      appliedNow = true;
    } finally {
      writable.close();
    }
  }

  const finalDb = openLifecycleDatabase(databasePath, { readonly: true });
  try {
    const integrity = validateDatabaseIntegrity(finalDb, []);
    if (
      integrity.sqliteIntegrity !== "ok" ||
      integrity.foreignKeyViolations !== 0
    ) {
      throw new Error("LOGISTICS_R2_POST_MIGRATION_INTEGRITY_FAILED");
    }

    assertObject(finalDb, "table", REQUIRED_TABLE);
    for (const index of REQUIRED_INDEXES) {
      assertObject(finalDb, "index", index);
    }

    const target = planMigrations(finalDb, migrationsDirectory).find(
      (item) => item.name === TARGET_MIGRATION,
    );
    if (
      !target ||
      target.state !== "applied" ||
      target.checksum !== targetChecksum
    ) {
      throw new Error("LOGISTICS_R2_LEDGER_VERIFICATION_FAILED");
    }

    const requestCount = (
      finalDb
        .prepare("SELECT COUNT(*) AS count FROM gad_logistics_requests")
        .get() as { count: number }
    ).count;
    const eventCount = (
      finalDb
        .prepare("SELECT COUNT(*) AS count FROM gad_logistics_events")
        .get() as { count: number }
    ).count;
    const workplanCount = (
      finalDb
        .prepare(
          "SELECT COUNT(*) AS count FROM gad_logistics_workplan_items",
        )
        .get() as { count: number }
    ).count;

    console.log(
      "GAD_LOGISTICS_R2_MIGRATION_RESULT=" +
        JSON.stringify({
          target: TARGET_MIGRATION,
          migrationChecksum: targetChecksum,
          appliedNow,
          backupBasename,
          backupSha256,
          integrity: integrity.sqliteIntegrity,
          foreignKeyViolations: integrity.foreignKeyViolations,
          requestCount,
          eventCount,
          workplanCount,
          requiredTablePresent: true,
          requiredIndexesPresent: true,
        }),
    );
  } finally {
    finalDb.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    "GAD_LOGISTICS_R2_MIGRATION_FAILED=" +
      (error instanceof Error ? error.message : String(error)),
  );
  process.exit(1);
});
