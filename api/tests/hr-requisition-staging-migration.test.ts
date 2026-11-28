import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runHrRequisitionStagingMigration } from "../release-controls/hr-requisition-staging-migration";

const originalSchema = fs.readFileSync("db/migrations/0000_concerned_kronos.sql", "utf8");
const auditSchema = originalSchema.match(/CREATE TABLE `audit_logs` \([\s\S]*?\n\);/)?.[0] ?? "";

function prepareExistingDatabase(file: string) {
  const db = new Database(file);
  try {
    db.exec(auditSchema);
    db.exec("CREATE TABLE existing_records (id TEXT PRIMARY KEY)");
    db.exec("INSERT INTO existing_records VALUES ('existing')");
  } finally {
    db.close();
  }
}

describe("Staging requisition migration", () => {
  let root: string;
  let storage: Parameters<typeof runHrRequisitionStagingMigration>[0];

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "amos-staging-0013-"));
    storage = {
      databasePath: path.join(root, "operational.db"),
      trainingDatabasePath: path.join(root, "training.db"),
      backupPath: path.join(root, "backups"),
    };
  });

  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it("round-trips restricted backups, applies only the workforce migrations to both existing stores, and skips repeat work", async () => {
    prepareExistingDatabase(storage.databasePath);
    prepareExistingDatabase(storage.trainingDatabasePath);

    const applied = await runHrRequisitionStagingMigration(storage);
    expect(applied).toMatchObject([
      { scope: "operational", state: "verified" },
      { scope: "training", state: "verified" },
    ]);
    for (const file of [storage.databasePath, storage.trainingDatabasePath]) {
      const db = new Database(file, { readonly: true });
      try {
        expect(db.prepare("SELECT name FROM _amos_migrations ORDER BY name").all()).toEqual([
          { name: "0013_hr_requisitions.sql" },
          { name: "0014_hr_applications.sql" },
        ]);
        expect(db.prepare("SELECT id FROM existing_records").get()).toEqual({ id: "existing" });
        expect(db.prepare("SELECT count(*) AS size FROM hr_requisitions").get()).toEqual({ size: 0 });
      } finally {
        db.close();
      }
    }

    const backupDirs = fs.readdirSync(storage.backupPath);
    expect(backupDirs).toHaveLength(2);
    for (const directory of backupDirs) {
      const backup = path.join(storage.backupPath, directory, "before.db");
      expect(fs.statSync(backup).mode & 0o777).toBe(0o600);
      const db = new Database(backup, { readonly: true });
      try {
        expect(db.prepare("SELECT id FROM existing_records").get()).toEqual({ id: "existing" });
        expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'hr_requisitions'").get()).toBeUndefined();
      } finally {
        db.close();
      }
    }
    expect(await runHrRequisitionStagingMigration(storage)).toEqual([
      { scope: "operational", state: "already_applied" },
      { scope: "training", state: "already_applied" },
    ]);
    expect(fs.readdirSync(storage.backupPath)).toEqual(backupDirs);
  });

  it("preserves an already migrated requisition when upgrading to application records", async () => {
    prepareExistingDatabase(storage.databasePath);
    prepareExistingDatabase(storage.trainingDatabasePath);
    const db = new Database(storage.databasePath);
    try {
      const migration = "0013_hr_requisitions.sql";
      const source = fs.readFileSync(path.join("db/migrations", migration), "utf8");
      db.exec(source);
      db.exec("CREATE TABLE _amos_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL)");
      db.prepare("INSERT INTO _amos_migrations VALUES (?, ?, ?)").run(migration,
        createHash("sha256").update(source).digest("hex"), new Date().toISOString());
      db.exec("INSERT INTO hr_requisitions VALUES ('QA-APP-REQ', 'QA position', 'GRO', 'QA supervisor', 'QA owner', 2, 1)");
    } finally {
      db.close();
    }

    const result = await runHrRequisitionStagingMigration(storage);
    const checkpoint = result.find(row => row.scope === "operational")?.checkpoint;
    expect(checkpoint).toBeTruthy();
    const migrated = new Database(storage.databasePath, { readonly: true });
    const prior = new Database(path.join(storage.backupPath, checkpoint!, "before.db"), { readonly: true });
    try {
      expect(migrated.prepare("SELECT reference FROM hr_requisitions").get()).toEqual({ reference: "QA-APP-REQ" });
      expect(prior.prepare("SELECT reference FROM hr_requisitions").get()).toEqual({ reference: "QA-APP-REQ" });
      expect(prior.prepare("SELECT name FROM sqlite_master WHERE name = 'hr_applications'").get()).toBeUndefined();
      expect(migrated.prepare("SELECT name FROM sqlite_master WHERE name = 'hr_applications'").get()).toBeTruthy();
    } finally {
      prior.close();
      migrated.close();
    }
  });

  it("defers missing stores to bootstrap and fails before migrating a store without the audit schema", async () => {
    expect(await runHrRequisitionStagingMigration(storage)).toEqual([
      { scope: "operational", state: "fresh_schema_deferred" },
      { scope: "training", state: "fresh_schema_deferred" },
    ]);
    const db = new Database(storage.databasePath);
    db.close();
    await expect(runHrRequisitionStagingMigration(storage)).rejects.toThrow("AUDIT_SCHEMA_MISSING");
    expect(fs.readdirSync(storage.backupPath)).toEqual([]);
  });
});
