import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { getTableColumns, getTableName, isTable } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as currentSchema from "../../db/schema";
import { bootstrapFreshDatabaseSchema } from "../fresh-schema";

function withTemporaryDatabase(run: (db: Database.Database) => void): void {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "amos-dms1-fresh-schema-"));
  const db = new Database(path.join(directory, "fresh.db"));
  try {
    run(db);
  } finally {
    db.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

describe("DMS.1 fresh database bootstrap", () => {
  it("applies controlled history and reconciles every current Drizzle table and column", () => {
    withTemporaryDatabase((db) => {
      const result = bootstrapFreshDatabaseSchema(db, {
        migrationsDirectory: path.resolve("db/migrations"),
        currentSchemaPath: path.resolve("db/current-schema.sql"),
      });

      expect(result.bootstrapped).toBe(true);
      expect(result.appliedMigrations).toBeGreaterThan(0);
      expect(db.pragma("integrity_check", { simple: true })).toBe("ok");

      for (const value of Object.values(currentSchema)) {
        if (!isTable(value)) continue;
        const tableName = getTableName(value);
        const table = db
          .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
          .get(tableName);
        expect(table, `missing current table ${tableName}`).toBeTruthy();
        const actualColumns = new Set(
          (db.prepare(`PRAGMA table_info("${tableName}")`).all() as Array<{ name: string }>).map(
            (column) => column.name,
          ),
        );
        for (const column of Object.values(getTableColumns(value))) {
          expect(actualColumns.has(column.name), `missing ${tableName}.${column.name}`).toBe(true);
        }
      }

      expect(
        bootstrapFreshDatabaseSchema(db, {
          migrationsDirectory: path.resolve("db/migrations"),
          currentSchemaPath: path.resolve("db/current-schema.sql"),
        }).bootstrapped,
      ).toBe(false);
    });
  });

  it("refuses to mutate a partially initialized database", () => {
    withTemporaryDatabase((db) => {
      db.exec("CREATE TABLE partial_runtime (id TEXT PRIMARY KEY)");
      expect(() =>
        bootstrapFreshDatabaseSchema(db, {
          migrationsDirectory: path.resolve("db/migrations"),
          currentSchemaPath: path.resolve("db/current-schema.sql"),
        }),
      ).toThrow("FRESH_SCHEMA_PARTIAL_DATABASE");
    });
  });
});
