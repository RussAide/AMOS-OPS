import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";

const databasePath = path.resolve(process.argv[2] ?? "phase2-migration-verification.db");
if (fs.existsSync(databasePath)) {
  throw new Error(`Refusing to overwrite existing verification database: ${databasePath}`);
}

const migrationDirectory = path.resolve("db/migrations");
const migrations = fs.readdirSync(migrationDirectory).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
const db = new Database(databasePath);

try {
  db.pragma("foreign_keys = ON");
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(migrationDirectory, migration), "utf8");
    const statements = sql.split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
    db.transaction(() => statements.forEach((statement) => db.exec(statement)))();
  }

  const expectedTables = [
    "phase2_care_episodes", "phase2_care_links", "phase2_work_items", "phase2_alerts",
    "phase2_handoffs", "phase2_audit_events", "phase2_claim_handoffs",
    "phase2_program_snapshots", "phase2_scenario_runs",
  ];
  const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'phase2_%' ORDER BY name").all().map((row) => row.name);
  for (const table of expectedTables) {
    if (!tableNames.includes(table)) throw new Error(`Missing Phase 2 table: ${table}`);
  }

  const now = "2026-07-14T12:00:00.000Z";
  db.prepare(`INSERT INTO phase2_care_episodes
    (id, case_id, referral_id, youth_id, youth_display_label, evidence_class, status, version, created_at, updated_at)
    VALUES ('SYNTH-EPISODE-MIGRATION', 'SYNTH-CASE-MIGRATION', 'SYNTH-REF-MIGRATION', 'SYNTH-YOUTH-MIGRATION', 'Synthetic Youth Migration', 'synthetic_demo', 'active', 1, ?, ?)`)
    .run(now, now);
  db.prepare(`INSERT INTO phase2_audit_events
    (id, episode_id, domain, event_type, action, entity_type, entity_id, actor_id, actor_role, reason, changed_fields_json, correlation_id, evidence_class, occurred_at)
    VALUES ('SYNTH-AUD-MIGRATION', 'SYNTH-EPISODE-MIGRATION', 'SHARED', 'material_change', 'migration.verified', 'care_episode', 'SYNTH-EPISODE-MIGRATION', 'SYNTH-QA', 'chart-auditor', 'Verify immutable ledger', '[]', 'SYNTH-CASE-MIGRATION', 'synthetic_demo', ?)`)
    .run(now);
  db.prepare(`INSERT INTO phase2_program_snapshots
    (id, episode_id, domain, aggregate_type, aggregate_id, aggregate_version, payload_json, evidence_class, is_current, created_at)
    VALUES ('SYNTH-SNAPSHOT-MIGRATION', 'SYNTH-EPISODE-MIGRATION', 'SHARED', 'migration', 'SYNTH-AGG-MIGRATION', 1, '{}', 'synthetic_demo', 1, ?)`)
    .run(now);

  let auditImmutable = false;
  try {
    db.prepare("UPDATE phase2_audit_events SET reason = 'changed' WHERE id = 'SYNTH-AUD-MIGRATION'").run();
  } catch (error) {
    auditImmutable = String(error).includes("PHASE2_AUDIT_IMMUTABLE");
  }
  let snapshotImmutable = false;
  try {
    db.prepare("UPDATE phase2_program_snapshots SET payload_json = '{\"changed\":true}' WHERE id = 'SYNTH-SNAPSHOT-MIGRATION'").run();
  } catch (error) {
    snapshotImmutable = String(error).includes("PHASE2_SNAPSHOT_IMMUTABLE");
  }
  if (!auditImmutable || !snapshotImmutable) throw new Error("Phase 2 immutable record controls failed");

  const integrity = db.pragma("integrity_check", { simple: true });
  const foreignKeys = db.pragma("foreign_key_check");
  if (integrity !== "ok" || foreignKeys.length > 0) throw new Error("Phase 2 migration integrity failed");

  console.log(JSON.stringify({ migrations, expectedTables, auditImmutable, snapshotImmutable, integrity, foreignKeys }, null, 2));
} finally {
  db.close();
}
