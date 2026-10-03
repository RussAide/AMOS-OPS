import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  applyPendingMigrations,
  createDatabaseBackup,
  listAppliedMigrations,
  openLifecycleDatabase,
  planMigrations,
  validateDatabaseIntegrity,
} from "../data-lifecycle";

const EXPECTED_CANDIDATE_SHA =
  "40fd8ae70b72a6fcb21b074a508ea9eb95635c6a";
const TARGET_MIGRATION = "0011_gad_logistics_r1.sql";
const TARGET_CHECKSUM =
  "65a4f1b76dfa105cc8b9b451b7bc66cd5a1850ccf820bf78f0414eccc0615764";

const EXPECTED_MIGRATIONS = [
  "0000_concerned_kronos.sql",
  "0001_boundary_enforcement.sql",
  "0002_m11_identity_observability.sql",
  "0003_m12_regulatory_framework.sql",
  "0004_m13_mgma_baseline.sql",
  "0005_m21_ccmg_oversight.sql",
  "0006_phase2_integrated_controls.sql",
  "0007_phase3_integrated_controls.sql",
  "0008_m41a_executive_decision_intelligence.sql",
  "0009_m41b_executive_intelligence_workplans.sql",
  "0010_m41c_clinical_intelligence_fabric.sql",
  TARGET_MIGRATION,
] as const;

const REQUIRED_TABLES = [
  "gad_logistics_requests",
  "gad_logistics_events",
] as const;

const REQUIRED_INDEXES = [
  "gad_logistics_requests_request_number_unique",
  "idx_gad_logistics_requests_requester",
  "idx_gad_logistics_requests_queue",
  "idx_gad_logistics_requests_assignment",
  "idx_gad_logistics_events_sequence",
  "idx_gad_logistics_events_time",
] as const;

function enabled(value: string | undefined): boolean {
  return new Set(["1", "true", "yes", "on"]).has(
    value?.trim().toLowerCase() ?? "",
  );
}

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
  if (!found) throw new Error(`REQUIRED_${type.toUpperCase()}_MISSING:${name}`);
}

async function main(): Promise<void> {
  if (process.env.APP_ENV !== "production") {
    throw new Error("PRODUCTION_ENV_REQUIRED");
  }
  if (!enabled(process.env.AMOS_PRODUCTION_RELEASE_AUTHORIZED)) {
    throw new Error("PRODUCTION_RELEASE_AUTHORIZATION_REQUIRED");
  }

  const databasePath = path.resolve(process.env.DATABASE_PATH ?? "");
  const backupRoot = path.resolve(process.env.BACKUP_PATH ?? "");
  const migrationsDirectory = path.resolve(process.cwd(), "db", "migrations");
  const releaseManifestPath = path.resolve(
    process.cwd(),
    "dist",
    "release-manifest.json",
  );

  if (!process.env.DATABASE_PATH || !process.env.BACKUP_PATH) {
    throw new Error("PRODUCTION_STORAGE_PATHS_REQUIRED");
  }
  if (!fs.existsSync(releaseManifestPath)) {
    throw new Error("RELEASE_MANIFEST_MISSING");
  }

  const releaseManifest = JSON.parse(
    fs.readFileSync(releaseManifestPath, "utf8"),
  ) as { commitSha?: string; releaseId?: string };
  if (releaseManifest.commitSha !== EXPECTED_CANDIDATE_SHA) {
    throw new Error("RELEASE_SHA_MISMATCH");
  }
  if (
    !process.env.AMOS_PRODUCTION_RELEASE_ID ||
    releaseManifest.releaseId !== process.env.AMOS_PRODUCTION_RELEASE_ID
  ) {
    throw new Error("RELEASE_ID_MISMATCH");
  }

  const targetPath = path.join(migrationsDirectory, TARGET_MIGRATION);
  const targetSql = fs.readFileSync(targetPath, "utf8");
  if (sha256(Buffer.from(targetSql, "utf8")) !== TARGET_CHECKSUM) {
    throw new Error("TARGET_MIGRATION_CHECKSUM_MISMATCH");
  }
  if (
    /\b(DROP|ALTER|DELETE|UPDATE|INSERT|REPLACE|VACUUM|ATTACH|DETACH)\b/i.test(
      targetSql,
    )
  ) {
    throw new Error("TARGET_MIGRATION_NOT_STRICTLY_ADDITIVE");
  }

  let readonly = openLifecycleDatabase(databasePath, { readonly: true });
  let plan;
  let appliedRecords;
  try {
    plan = planMigrations(readonly, migrationsDirectory);
    appliedRecords = listAppliedMigrations(readonly);
    const integrity = validateDatabaseIntegrity(readonly, []);
    if (
      integrity.sqliteIntegrity !== "ok" ||
      integrity.foreignKeyViolations !== 0
    ) {
      throw new Error("PRE_MIGRATION_INTEGRITY_FAILED");
    }
  } finally {
    readonly.close();
  }

  if (
    JSON.stringify(plan.map((item) => item.name)) !==
    JSON.stringify(EXPECTED_MIGRATIONS)
  ) {
    throw new Error("MIGRATION_SOURCE_SET_MISMATCH");
  }
  const appliedNames = new Set(appliedRecords.map((record) => record.name));
  const unexpectedApplied = [...appliedNames].filter(
    (name) => !EXPECTED_MIGRATIONS.includes(name as (typeof EXPECTED_MIGRATIONS)[number]),
  );
  if (unexpectedApplied.length > 0) {
    throw new Error(
      `UNEXPECTED_APPLIED_MIGRATIONS:${unexpectedApplied.join(",")}`,
    );
  }

  for (const prior of plan.slice(0, -1)) {
    if (prior.state !== "applied") {
      throw new Error(`PRIOR_MIGRATION_NOT_APPLIED:${prior.name}`);
    }
  }

  const target = plan[plan.length - 1];
  if (
    target.name !== TARGET_MIGRATION ||
    target.checksum !== TARGET_CHECKSUM
  ) {
    throw new Error("TARGET_MIGRATION_PLAN_MISMATCH");
  }

  fs.mkdirSync(backupRoot, { recursive: true });
  let backupBasename: string;
  let appliedNow = false;

  if (target.state === "pending") {
    const pending = plan.filter((item) => item.state === "pending");
    if (pending.length !== 1 || pending[0].name !== TARGET_MIGRATION) {
      throw new Error("PENDING_MIGRATION_SET_REJECTED");
    }

    backupBasename =
      "production-gad-logistics-r1-pre-0011-" +
      new Date().toISOString().replace(/[:.]/g, "-") +
      ".db";
    const backupPath = path.join(backupRoot, backupBasename);
    await createDatabaseBackup(databasePath, backupPath);

    const writable = openLifecycleDatabase(databasePath);
    try {
      const applied = applyPendingMigrations(writable, migrationsDirectory);
      if (
        applied.length !== 1 ||
        applied[0].name !== TARGET_MIGRATION ||
        applied[0].checksum !== TARGET_CHECKSUM
      ) {
        throw new Error("TARGET_MIGRATION_APPLY_MISMATCH");
      }
    } finally {
      writable.close();
    }
    appliedNow = true;
  } else {
    const matchingBackups = fs
      .readdirSync(backupRoot)
      .filter(
        (name) =>
          name.startsWith("production-gad-logistics-r1-pre-0011-") &&
          name.endsWith(".db"),
      )
      .sort();
    if (matchingBackups.length === 0) {
      throw new Error("PRE_MIGRATION_BACKUP_EVIDENCE_MISSING");
    }
    backupBasename = matchingBackups[matchingBackups.length - 1];
  }

  const finalDb = openLifecycleDatabase(databasePath, { readonly: true });
  try {
    const integrity = validateDatabaseIntegrity(finalDb, []);
    if (
      integrity.sqliteIntegrity !== "ok" ||
      integrity.foreignKeyViolations !== 0
    ) {
      throw new Error("POST_MIGRATION_INTEGRITY_FAILED");
    }

    for (const table of REQUIRED_TABLES) assertObject(finalDb, "table", table);
    for (const index of REQUIRED_INDEXES) assertObject(finalDb, "index", index);

    const finalPlan = planMigrations(finalDb, migrationsDirectory);
    const finalTarget = finalPlan.find(
      (item) => item.name === TARGET_MIGRATION,
    );
    if (
      !finalTarget ||
      finalTarget.state !== "applied" ||
      finalTarget.checksum !== TARGET_CHECKSUM
    ) {
      throw new Error("TARGET_MIGRATION_LEDGER_VERIFICATION_FAILED");
    }

    const backupPath = path.join(backupRoot, backupBasename);
    const backupBytes = fs.readFileSync(backupPath);
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

    console.log(
      "GAD_LOGISTICS_PRODUCTION_MIGRATION_RESULT=" +
        JSON.stringify({
          target: TARGET_MIGRATION,
          migrationChecksum: TARGET_CHECKSUM,
          appliedNow,
          backupBasename,
          backupSha256: sha256(backupBytes),
          backupSize: backupBytes.length,
          integrity: integrity.sqliteIntegrity,
          foreignKeyViolations: integrity.foreignKeyViolations,
          requestCount,
          eventCount,
          requiredTablesPresent: true,
          requiredIndexesPresent: true,
        }),
    );
  } finally {
    finalDb.close();
  }
}

main().catch((error: unknown) => {
  console.error(
    "GAD_LOGISTICS_PRODUCTION_MIGRATION_FAILED=" +
      (error instanceof Error ? error.message : String(error)),
  );
  process.exit(1);
});
