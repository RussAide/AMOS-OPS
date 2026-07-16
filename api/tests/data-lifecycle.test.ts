import fs from "fs";
import os from "os";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  adoptExistingMigrationBaseline,
  applyPendingMigrations,
  createDatabaseBackup,
  extractMigrationSchemaRequirements,
  listAppliedMigrations,
  openLifecycleDatabase,
  planMigrations,
  restoreDatabaseBackup,
  validateDatabaseIntegrity,
} from "../data-lifecycle";
import { assertSyntheticSeedAllowed } from "../../db/seed-guard";

const temporaryDirectories: string[] = [];

function temporaryDirectory(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "amos-m11-data-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("M1.1 database lifecycle controls", () => {
  it("plans and applies repository migrations exactly once with checksums", () => {
    const directory = temporaryDirectory();
    const databasePath = path.join(directory, "amos-evaluation.db");
    const db = openLifecycleDatabase(databasePath);
    try {
      const before = planMigrations(db, path.resolve("db/migrations"));
      expect(before.length).toBeGreaterThanOrEqual(2);
      expect(before.every((migration) => migration.state === "pending")).toBe(true);
      expect(
        db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = '_amos_migrations'").get(),
      ).toBeUndefined();

      const applied = applyPendingMigrations(db, path.resolve("db/migrations"));
      expect(applied).toHaveLength(before.length);
      expect(applyPendingMigrations(db, path.resolve("db/migrations"))).toEqual([]);
      expect(listAppliedMigrations(db)).toHaveLength(before.length);
      const userColumns = new Set(
        (db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>).map(
          (column) => column.name,
        ),
      );
      for (const column of [
        "failed_login_count",
        "locked_until",
        "password_changed_at",
        "must_change_password",
        "mfa_enabled",
        "mfa_method",
        "last_login_at",
        "last_access_review_at",
        "next_access_review_at",
      ]) {
        expect(userColumns).toContain(column);
      }
      for (const table of [
        "identity_sessions",
        "identity_login_attempts",
        "identity_mfa_challenges",
        "identity_password_reset_tokens",
        "identity_access_reviews",
        "operational_audit_events",
        "operational_alerts",
      ]) {
        expect(
          db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table),
        ).toBeTruthy();
      }
      const integrity = validateDatabaseIntegrity(db);
      expect(integrity.ok).toBe(true);
      expect(integrity.skippedRules).toEqual([]);
    } finally {
      db.close();
    }
  });

  it("extracts ALTER-added identity columns for controlled baseline adoption", () => {
    const requirements = extractMigrationSchemaRequirements(
      fs.readFileSync(path.resolve("db/migrations/0002_m11_identity_observability.sql"), "utf8"),
    );
    const users = requirements.tables.find((table) => table.name === "users");
    expect(users?.columns).toEqual(expect.arrayContaining([
      "failed_login_count",
      "locked_until",
      "password_changed_at",
      "must_change_password",
      "mfa_enabled",
      "mfa_method",
      "last_login_at",
      "last_access_review_at",
      "next_access_review_at",
    ]));
    expect(requirements.tables.map((table) => table.name)).toEqual(
      expect.arrayContaining(["identity_sessions", "operational_audit_events", "operational_alerts"]),
    );
  });

  it("rolls a migration back by restoring and validating its pre-migration checkpoint", async () => {
    const directory = temporaryDirectory();
    const databasePath = path.join(directory, "amos-evaluation.db");
    const checkpointPath = path.join(directory, "checkpoints", "before-change.db");
    const migrationsPath = path.join(directory, "migrations");
    fs.mkdirSync(migrationsPath);
    fs.writeFileSync(
      path.join(migrationsPath, "0000_add_recovery_marker.sql"),
      "CREATE TABLE recovery_marker (id TEXT PRIMARY KEY, value TEXT NOT NULL);",
    );
    let db = openLifecycleDatabase(databasePath);
    db.exec("CREATE TABLE control_value (id TEXT PRIMARY KEY, value TEXT NOT NULL)");
    db.prepare("INSERT INTO control_value (id, value) VALUES (?, ?)").run("state", "accepted");
    db.close();

    await createDatabaseBackup(databasePath, checkpointPath);
    db = openLifecycleDatabase(databasePath);
    applyPendingMigrations(db, migrationsPath);
    db.prepare("INSERT INTO recovery_marker (id, value) VALUES (?, ?)").run("change", "applied");
    db.prepare("UPDATE control_value SET value = ? WHERE id = ?").run("changed", "state");
    expect(
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get("recovery_marker"),
    ).toBeTruthy();
    db.close();

    restoreDatabaseBackup(checkpointPath, databasePath, { allowOverwrite: true });
    db = openLifecycleDatabase(databasePath);
    try {
      const row = db.prepare("SELECT value FROM control_value WHERE id = ?").get("state") as {
        value: string;
      };
      expect(row.value).toBe("accepted");
      expect(
        db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get("recovery_marker"),
      ).toBeUndefined();
      expect(validateDatabaseIntegrity(db, []).ok).toBe(true);
    } finally {
      db.close();
    }
  });

  it("detects orphaned logical references even when legacy tables lack FK clauses", () => {
    const directory = temporaryDirectory();
    const db = openLifecycleDatabase(path.join(directory, "amos-evaluation.db"));
    try {
      db.exec(`
        CREATE TABLE patients (id TEXT PRIMARY KEY);
        CREATE TABLE treatment_plans (id TEXT PRIMARY KEY, patient_id TEXT NOT NULL);
        INSERT INTO treatment_plans (id, patient_id) VALUES ('plan-1', 'missing-patient');
      `);
      const report = validateDatabaseIntegrity(db);
      expect(report.ok).toBe(false);
      expect(report.logicalReferenceViolations).toBe(1);
      expect(report.skippedRules.length).toBeGreaterThan(0);
      expect(report.findings[0]?.message).toContain("orphaned references");
    } finally {
      db.close();
    }
  });

  it("adopts a verified existing schema by checksum without re-executing collision-prone SQL", async () => {
    const directory = temporaryDirectory();
    const databasePath = path.join(directory, "amos-evaluation-existing.db");
    const checkpointPath = path.join(directory, "checkpoints", "before-adoption.db");
    const migrationsPath = path.join(directory, "migrations");
    fs.mkdirSync(migrationsPath);
    fs.writeFileSync(
      path.join(migrationsPath, "0000_existing.sql"),
      `CREATE TABLE parent (\n  id TEXT PRIMARY KEY,\n  label TEXT NOT NULL\n);\n` +
        `CREATE TABLE child (\n  id TEXT PRIMARY KEY,\n  parent_id TEXT NOT NULL,\n  FOREIGN KEY (parent_id) REFERENCES parent(id)\n);\n` +
        "CREATE INDEX idx_child_parent ON child(parent_id);\n",
    );
    const db = openLifecycleDatabase(databasePath);
    db.exec(`
      CREATE TABLE parent (id TEXT PRIMARY KEY, label TEXT NOT NULL);
      CREATE TABLE child (
        id TEXT PRIMARY KEY,
        parent_id TEXT NOT NULL,
        FOREIGN KEY (parent_id) REFERENCES parent(id)
      );
      CREATE INDEX idx_child_parent ON child(parent_id);
    `);
    db.close();

    await expect(
      adoptExistingMigrationBaseline({
        databasePath,
        migrationsDirectory: migrationsPath,
        checkpointPath,
        confirmation: "not-confirmed",
        referentialRules: [],
      }),
    ).rejects.toThrow("ADOPT_EXISTING_SCHEMA");

    const report = await adoptExistingMigrationBaseline({
      databasePath,
      migrationsDirectory: migrationsPath,
      checkpointPath,
      confirmation: "ADOPT_EXISTING_SCHEMA",
      referentialRules: [],
    });
    expect(report.mode).toBe("baseline-existing");
    expect(report.adopted).toMatchObject([
      { name: "0000_existing.sql", tableCount: 2, indexCount: 1, columnCount: 4 },
    ]);
    expect(report.integrity.ok).toBe(true);
    expect(fs.existsSync(checkpointPath)).toBe(true);

    const adopted = openLifecycleDatabase(databasePath);
    try {
      expect(planMigrations(adopted, migrationsPath).every((item) => item.state === "applied")).toBe(
        true,
      );
      expect(applyPendingMigrations(adopted, migrationsPath)).toEqual([]);
    } finally {
      adopted.close();
    }
  });

  it("refuses baseline adoption when an expected table, column, or index is missing", async () => {
    const directory = temporaryDirectory();
    const databasePath = path.join(directory, "amos-evaluation-incomplete.db");
    const checkpointPath = path.join(directory, "checkpoint.db");
    const migrationsPath = path.join(directory, "migrations");
    fs.mkdirSync(migrationsPath);
    fs.writeFileSync(
      path.join(migrationsPath, "0000_expected.sql"),
      `CREATE TABLE parent (\n  id TEXT PRIMARY KEY\n);\n` +
        `CREATE TABLE child (\n  id TEXT PRIMARY KEY,\n  parent_id TEXT NOT NULL\n);\n` +
        "CREATE INDEX idx_child_parent ON child(parent_id);\n",
    );
    const db = openLifecycleDatabase(databasePath);
    db.exec("CREATE TABLE parent (id TEXT PRIMARY KEY); CREATE TABLE child (id TEXT PRIMARY KEY);");
    db.close();

    await expect(
      adoptExistingMigrationBaseline({
        databasePath,
        migrationsDirectory: migrationsPath,
        checkpointPath,
        confirmation: "ADOPT_EXISTING_SCHEMA",
        referentialRules: [],
      }),
    ).rejects.toThrow(/column:child\.parent_id.*index:idx_child_parent/);
    expect(fs.existsSync(checkpointPath)).toBe(false);
    const unchanged = openLifecycleDatabase(databasePath, { readonly: true });
    try {
      expect(listAppliedMigrations(unchanged)).toEqual([]);
    } finally {
      unchanged.close();
    }
  });

  it("refuses overwrite restore unless explicitly authorized", async () => {
    const directory = temporaryDirectory();
    const source = path.join(directory, "amos-evaluation-source.db");
    const backup = path.join(directory, "amos-evaluation-backup.db");
    const target = path.join(directory, "amos-evaluation-target.db");
    for (const databasePath of [source, target]) {
      const db = openLifecycleDatabase(databasePath);
      db.exec("CREATE TABLE marker (id TEXT PRIMARY KEY)");
      db.close();
    }
    await createDatabaseBackup(source, backup);
    await expect(createDatabaseBackup(source, backup)).rejects.toThrow("allowOverwrite");
    expect(() => restoreDatabaseBackup(backup, target)).toThrow("allowOverwrite");
  });
});

describe("M1.1 synthetic seed isolation", () => {
  const safeEnvironment = {
    NODE_ENV: "test",
    APP_ENV: "demo",
    AMOS_RUNTIME_MODE: "demo",
    AMOS_SEED_MODE: "synthetic",
  } as NodeJS.ProcessEnv;

  it("permits an explicitly isolated synthetic evaluation target", () => {
    expect(() =>
      assertSyntheticSeedAllowed({
        scriptName: "test-seed",
        databasePath: "/tmp/amos-evaluation.db",
        environment: safeEnvironment,
      }),
    ).not.toThrow();
  });

  it("refuses production, unflagged, and ambiguously named targets", () => {
    expect(() =>
      assertSyntheticSeedAllowed({
        scriptName: "test-seed",
        databasePath: "/tmp/amos-evaluation.db",
        environment: { ...safeEnvironment, NODE_ENV: "production" },
      }),
    ).toThrow("NODE_ENV=production");
    expect(() =>
      assertSyntheticSeedAllowed({
        scriptName: "test-seed",
        databasePath: "/tmp/amos-evaluation.db",
        environment: { ...safeEnvironment, AMOS_SEED_MODE: undefined },
      }),
    ).toThrow("requires AMOS_SEED_MODE=synthetic");
    expect(() =>
      assertSyntheticSeedAllowed({
        scriptName: "test-seed",
        databasePath: "/srv/amos-ops.db",
        environment: safeEnvironment,
      }),
    ).toThrow("Refusing non-evaluation database target");
  });
});
