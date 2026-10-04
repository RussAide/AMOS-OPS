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

export const GAD_LOGISTICS_R2_TARGET_MIGRATION =
  "0012_gad_logistics_r2_workplans.sql";
const REQUIRED_TABLE = "gad_logistics_workplan_items";
const REQUIRED_INDEXES = [
  "idx_gad_logistics_workplan_owner",
  "idx_gad_logistics_workplan_request",
  "idx_gad_logistics_workplan_due",
] as const;

export interface GadLogisticsR2MigrationResult {
  target: string;
  migrationChecksum: string | null;
  state: "database_missing_bootstrap_deferred" | "already_applied" | "applied";
  appliedNow: boolean;
  backupBasename: string | null;
  backupSha256: string | null;
  integrity: "ok" | "not_checked";
  foreignKeyViolations: number;
  requestCount: number | null;
  eventCount: number | null;
  workplanCount: number | null;
  requiredTablePresent: boolean;
  requiredIndexesPresent: boolean;
}

export interface GadLogisticsR2MigrationOptions {
  databasePath?: string;
  backupRoot?: string;
  migrationsDirectory?: string;
}

function sha256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function objectExists(
  db: ReturnType<typeof openLifecycleDatabase>,
  type: "table" | "index",
  name: string,
): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?")
      .get(type, name),
  );
}

function assertObject(
  db: ReturnType<typeof openLifecycleDatabase>,
  type: "table" | "index",
  name: string,
): void {
  if (!objectExists(db, type, name)) {
    throw new Error(`REQUIRED_${type.toUpperCase()}_MISSING:${name}`);
  }
}

export async function runGadLogisticsR2WorkplanMigration(
  options: GadLogisticsR2MigrationOptions = {},
): Promise<GadLogisticsR2MigrationResult> {
  const rawDatabasePath = options.databasePath ?? process.env.DATABASE_PATH;
  const rawBackupRoot = options.backupRoot ?? process.env.BACKUP_PATH;
  if (!rawDatabasePath || !rawBackupRoot) {
    throw new Error("LOGISTICS_R2_STORAGE_PATHS_REQUIRED");
  }

  const databasePath = path.resolve(rawDatabasePath);
  const backupRoot = path.resolve(rawBackupRoot);
  const migrationsDirectory = path.resolve(
    options.migrationsDirectory ?? path.join(process.cwd(), "db", "migrations"),
  );

  if (!fs.existsSync(databasePath)) {
    return {
      target: GAD_LOGISTICS_R2_TARGET_MIGRATION,
      migrationChecksum: null,
      state: "database_missing_bootstrap_deferred",
      appliedNow: false,
      backupBasename: null,
      backupSha256: null,
      integrity: "not_checked",
      foreignKeyViolations: 0,
      requestCount: null,
      eventCount: null,
      workplanCount: null,
      requiredTablePresent: false,
      requiredIndexesPresent: false,
    };
  }

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
    const target = plan.find(
      (item) => item.name === GAD_LOGISTICS_R2_TARGET_MIGRATION,
    );
    if (!target) throw new Error("LOGISTICS_R2_TARGET_MIGRATION_MISSING");

    targetState = target.state;
    targetChecksum = target.checksum;

    const targetIndex = plan.findIndex(
      (item) => item.name === GAD_LOGISTICS_R2_TARGET_MIGRATION,
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
        pendingThroughTarget[0].name !== GAD_LOGISTICS_R2_TARGET_MIGRATION
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
        (item) => item.name === GAD_LOGISTICS_R2_TARGET_MIGRATION,
      );
      const pendingThroughTarget = plan
        .slice(0, targetIndex + 1)
        .filter((item) => item.state === "pending");
      if (
        pendingThroughTarget.length !== 1 ||
        pendingThroughTarget[0].name !== GAD_LOGISTICS_R2_TARGET_MIGRATION
      ) {
        throw new Error("LOGISTICS_R2_APPLY_SET_REJECTED");
      }

      const applied = applyPendingMigrations(writable, migrationsDirectory);
      const targetApplied = applied.find(
        (item) => item.name === GAD_LOGISTICS_R2_TARGET_MIGRATION,
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
      (item) => item.name === GAD_LOGISTICS_R2_TARGET_MIGRATION,
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

    return {
      target: GAD_LOGISTICS_R2_TARGET_MIGRATION,
      migrationChecksum: targetChecksum,
      state: appliedNow ? "applied" : "already_applied",
      appliedNow,
      backupBasename,
      backupSha256,
      integrity: "ok",
      foreignKeyViolations: integrity.foreignKeyViolations,
      requestCount,
      eventCount,
      workplanCount,
      requiredTablePresent: objectExists(finalDb, "table", REQUIRED_TABLE),
      requiredIndexesPresent: REQUIRED_INDEXES.every((index) =>
        objectExists(finalDb, "index", index),
      ),
    };
  } finally {
    finalDb.close();
  }
}
