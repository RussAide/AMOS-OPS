import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";

const databasePath = path.resolve(
  process.argv[2] ?? "m13-migration-verification.db",
);
if (fs.existsSync(databasePath)) {
  throw new Error(
    `Refusing to overwrite existing verification database: ${databasePath}`,
  );
}

const migrationDirectory = path.resolve("db/migrations");
const migrations = fs
  .readdirSync(migrationDirectory)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const db = new Database(databasePath);

try {
  db.pragma("foreign_keys = ON");
  for (const migration of migrations) {
    const sql = fs.readFileSync(
      path.join(migrationDirectory, migration),
      "utf8",
    );
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    db.transaction(() => {
      for (const statement of statements) db.exec(statement);
    })();
  }

  const scalar = (sql) => db.prepare(sql).get().count;
  const counts = {
    domains: scalar("SELECT COUNT(*) AS count FROM mgma_domains"),
    kpis: scalar("SELECT COUNT(*) AS count FROM mgma_kpi_targets"),
    checklistTargets: scalar(
      "SELECT COUNT(*) AS count FROM mgma_kpi_targets WHERE is_checklist_target = 1",
    ),
    syntheticMeasurements: scalar(
      "SELECT COUNT(*) AS count FROM mgma_measurements WHERE evidence_class = 'synthetic_demo'",
    ),
    productionMeasurements: scalar(
      "SELECT COUNT(*) AS count FROM mgma_measurements WHERE evidence_class = 'production'",
    ),
    qualityResults: scalar(
      "SELECT COUNT(*) AS count FROM mgma_data_quality_results",
    ),
    ownerApprovals: scalar(
      "SELECT COUNT(*) AS count FROM mgma_owner_approvals",
    ),
    governanceRecords: scalar(
      "SELECT COUNT(*) AS count FROM mgma_dashboard_governance",
    ),
    misleadingCurrentValues: scalar(
      "SELECT COUNT(*) AS count FROM mgma_kpi_targets WHERE current_value IS NOT NULL OR last_measured_at IS NOT NULL OR status <> 'not_measured'",
    ),
    proprietaryBenchmarkClaims: scalar(
      "SELECT COUNT(*) AS count FROM mgma_kpi_targets WHERE lower(benchmark_source) LIKE 'mgma %' OR lower(target_basis) LIKE 'mgma %'",
    ),
  };
  const expected = {
    domains: 7,
    kpis: 14,
    checklistTargets: 8,
    syntheticMeasurements: 19,
    productionMeasurements: 0,
    qualityResults: 95,
    ownerApprovals: 14,
    governanceRecords: 1,
    misleadingCurrentValues: 0,
    proprietaryBenchmarkClaims: 0,
  };
  for (const [name, expectedCount] of Object.entries(expected)) {
    if (counts[name] !== expectedCount) {
      throw new Error(
        `${name} expected ${expectedCount}, found ${counts[name]}`,
      );
    }
  }

  const checkTypes = db
    .prepare(
      "SELECT check_type AS checkType, COUNT(*) AS count FROM mgma_data_quality_results GROUP BY check_type ORDER BY check_type",
    )
    .all();
  const integrity = db.pragma("integrity_check", { simple: true });
  const foreignKeys = db.pragma("foreign_key_check");
  if (integrity !== "ok")
    throw new Error(`Integrity check failed: ${integrity}`);
  if (foreignKeys.length !== 0)
    throw new Error("Foreign-key validation failed");

  console.log(
    JSON.stringify(
      {
        databasePath,
        dataPosture: "disposable-synthetic-verification-only",
        migrations,
        counts,
        checkTypes,
        integrity,
        foreignKeyViolations: foreignKeys.length,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
