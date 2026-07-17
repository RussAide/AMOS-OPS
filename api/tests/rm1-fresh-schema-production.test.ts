import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { listAppliedMigrations } from "../data-lifecycle";
import { bootstrapFreshDatabaseSchema } from "../fresh-schema";

const migrationsDirectory = path.join(process.cwd(), "db", "migrations");
const currentSchemaPath = path.join(process.cwd(), "db", "current-schema.sql");

function migrationChecksums(): Map<string, string> {
  return new Map(
    fs
      .readdirSync(migrationsDirectory)
      .filter((name) => name.endsWith(".sql"))
      .sort()
      .map((name) => [
        name,
        createHash("sha256")
          .update(fs.readFileSync(path.join(migrationsDirectory, name)))
          .digest("hex"),
      ]),
  );
}

function rowCount(db: Database.Database, tableName: string): number {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(tableName)) {
    throw new Error(`Unsafe test table name: ${tableName}`);
  }
  return (
    db.prepare(`SELECT COUNT(*) AS count FROM "${tableName}"`).get() as {
      count: number;
    }
  ).count;
}

describe("RM.1 fresh Production schema bootstrap", () => {
  it("installs the complete schema and immutable migration history without operational rows", () => {
    const before = migrationChecksums();
    const db = new Database(":memory:");
    try {
      const result = bootstrapFreshDatabaseSchema(db, {
        migrationsDirectory,
        currentSchemaPath,
        migrationDataMode: "schema-only",
      });

      expect(result.bootstrapped).toBe(true);
      expect(result.migrationDataMode).toBe("schema-only");
      expect(result.appliedMigrations).toBe(before.size);
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");

      const requiredObjects = [
        ["table", "users"],
        ["table", "regulatory_sources"],
        ["table", "mgma_domains"],
        ["table", "m21_ccmg_referrals"],
        ["table", "phase2_care_episodes"],
        ["table", "phase3_support_cases"],
        ["table", "m41c_audit_events"],
        ["index", "idx_phi_access_patient"],
        ["trigger", "m21_ccmg_audit_events_no_delete"],
      ] as const;
      for (const [type, name] of requiredObjects) {
        expect(
          db
            .prepare(
              "SELECT 1 FROM sqlite_master WHERE type = ? AND name = ?",
            )
            .get(type, name),
          `${type}:${name}`,
        ).toBeTruthy();
      }

      const applicationTables = db
        .prepare(
          `SELECT name
           FROM sqlite_master
           WHERE type = 'table'
             AND name NOT LIKE 'sqlite_%'
             AND name <> '_amos_migrations'
           ORDER BY name`,
        )
        .all() as Array<{ name: string }>;
      expect(applicationTables.length).toBeGreaterThan(100);
      for (const { name } of applicationTables) {
        expect(rowCount(db, name), name).toBe(0);
      }

      const applied = listAppliedMigrations(db);
      expect(applied).toHaveLength(before.size);
      expect(
        new Map(applied.map(({ name, checksum }) => [name, checksum])),
      ).toEqual(before);
      expect(migrationChecksums()).toEqual(before);
    } finally {
      db.close();
    }
  });

  it("retains the accepted migration fixtures for Demo and training stores", () => {
    const db = new Database(":memory:");
    try {
      const result = bootstrapFreshDatabaseSchema(db, {
        migrationsDirectory,
        currentSchemaPath,
        migrationDataMode: "include",
      });

      expect(result.migrationDataMode).toBe("include");
      expect(rowCount(db, "regulatory_sources")).toBeGreaterThan(0);
      expect(rowCount(db, "mgma_domains")).toBeGreaterThan(0);
      expect(rowCount(db, "mgma_kpi_targets")).toBeGreaterThan(0);
      expect(rowCount(db, "m21_ccmg_referrals")).toBe(4);
      expect(rowCount(db, "m21_ccmg_work_items")).toBeGreaterThan(0);
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
    } finally {
      db.close();
    }
  });

  it("never applies schema-only migration history over an existing application schema", () => {
    const db = new Database(":memory:");
    try {
      db.exec("CREATE TABLE existing_operational_record (id TEXT PRIMARY KEY)");
      expect(() =>
        bootstrapFreshDatabaseSchema(db, {
          migrationsDirectory,
          currentSchemaPath,
          migrationDataMode: "schema-only",
        }),
      ).toThrow(/FRESH_SCHEMA_PARTIAL_DATABASE/);
      expect(rowCount(db, "existing_operational_record")).toBe(0);
      expect(
        db
          .prepare("SELECT 1 FROM sqlite_master WHERE name = 'users'")
          .get(),
      ).toBeUndefined();
    } finally {
      db.close();
    }
  });
});
