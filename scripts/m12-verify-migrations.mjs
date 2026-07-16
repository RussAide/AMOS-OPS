import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";

const databasePath = path.resolve(process.argv[2] ?? "m12-migration-verification.db");
if (fs.existsSync(databasePath)) {
  throw new Error(`Refusing to overwrite existing verification database: ${databasePath}`);
}

const migrationDirectory = path.resolve("db/migrations");
const migrations = fs.readdirSync(migrationDirectory)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const db = new Database(databasePath);

try {
  db.pragma("foreign_keys = ON");
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(migrationDirectory, migration), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    db.transaction(() => {
      for (const statement of statements) db.exec(statement);
    })();
  }

  const expectedCounts = {
    regulatory_sources: 4,
    regulatory_rules: 30,
    regulatory_rule_reviews: 60,
    regulatory_exceptions: 3,
  };
  const counts = Object.fromEntries(Object.entries(expectedCounts).map(([table]) => [
    table,
    db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
  ]));
  const integrity = db.pragma("integrity_check", { simple: true });
  const foreignKeys = db.pragma("foreign_key_check");
  const tables = db.prepare(
    "SELECT COUNT(*) AS count FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
  ).get().count;

  if (integrity !== "ok") throw new Error(`Integrity check failed: ${integrity}`);
  if (foreignKeys.length !== 0) throw new Error("Foreign-key validation failed");
  for (const [table, expected] of Object.entries(expectedCounts)) {
    if (counts[table] !== expected) {
      throw new Error(`${table} expected ${expected} rows, found ${counts[table]}`);
    }
  }

  console.log(JSON.stringify({
    databasePath,
    dataPosture: "disposable-synthetic-verification-only",
    migrations,
    tables,
    counts,
    integrity,
    foreignKeyViolations: foreignKeys.length,
  }, null, 2));
} finally {
  db.close();
}
