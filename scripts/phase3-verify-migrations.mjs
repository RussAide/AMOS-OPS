import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function parsePhase3MigrationOptions(argv) {
  let root;
  let output;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else output = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }
  if (!root && !output && positional.length === 1) output = positional[0];
  else {
    root ??= positional[0];
    output ??= positional[1];
  }
  root ??= "..";
  output ??= "phase3-migration-verification.db";
  return { root: path.resolve(root), output: path.resolve(output) };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`Phase 3 source root is missing under ${root}.`);
}

export function verifyPhase3Migrations(options) {
  const sourceRoot = sourceRootFor(options.root);
  const databasePath = options.output;
  if (fs.existsSync(databasePath)) throw new Error(`Refusing to overwrite existing verification database: ${databasePath}`);
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const migrationDirectory = path.join(sourceRoot, "db", "migrations");
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
      "phase3_support_cases", "phase3_support_links", "phase3_work_items", "phase3_audit_events",
      "phase3_module_snapshots", "phase3_scenario_runs", "phase3_demo_controls",
    ];
    const tableNames = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'phase3_%' ORDER BY name").all().map((row) => row.name);
    for (const table of expectedTables) assert(tableNames.includes(table), `Missing Phase 3 table: ${table}`);

    const now = "2026-07-14T18:00:00.000Z";
    db.prepare(`INSERT INTO phase2_care_episodes
      (id,case_id,referral_id,youth_id,youth_display_label,evidence_class,status,version,created_at,updated_at)
      VALUES ('SYNTH-P2-PARENT-MIGRATION','SYNTH-CASE-P3-MIGRATION','SYNTH-REF-P3-MIGRATION','SYNTH-YOUTH-P3-MIGRATION','Synthetic Youth Phase3 Migration','synthetic_demo','active',1,?,?)`).run(now, now);
    db.prepare(`INSERT INTO phase3_support_cases
      (id,source_episode_id,evidence_class,status,version,created_at,updated_at)
      VALUES ('SYNTH-P3-SUPPORT-MIGRATION','SYNTH-P2-PARENT-MIGRATION','synthetic_demo','active',1,?,?)`).run(now, now);
    db.prepare(`INSERT INTO phase3_audit_events
      (id,support_case_id,domain,action,entity_type,entity_id,actor_id,actor_role,reason,correlation_id,changed_fields_json,evidence_class,occurred_at)
      VALUES ('SYNTH-P3-AUDIT-MIGRATION','SYNTH-P3-SUPPORT-MIGRATION','COMPLIANCE','change','migration','SYNTH-P3-SUPPORT-MIGRATION','SYNTH-QA','chart-auditor','Verify immutable Phase 3 audit ledger','SYNTH-P3-MIGRATION','[]','synthetic_demo',?)`).run(now);
    db.prepare(`INSERT INTO phase3_module_snapshots
      (id,support_case_id,milestone,aggregate_type,aggregate_id,aggregate_version,payload_json,evidence_class,is_current,created_at)
      VALUES ('SYNTH-P3-SNAPSHOT-MIGRATION','SYNTH-P3-SUPPORT-MIGRATION','M3.1','migration','SYNTH-P3-AGG-MIGRATION',1,'{}','synthetic_demo',1,?)`).run(now);

    let auditImmutable = false;
    try { db.prepare("UPDATE phase3_audit_events SET reason='changed'").run(); } catch (error) { auditImmutable = String(error).includes("PHASE3_AUDIT_IMMUTABLE"); }
    let snapshotImmutable = false;
    try { db.prepare("UPDATE phase3_module_snapshots SET payload_json='{\"changed\":true}'").run(); } catch (error) { snapshotImmutable = String(error).includes("PHASE3_SNAPSHOT_IMMUTABLE"); }
    assert(auditImmutable && snapshotImmutable, "Phase 3 immutable record controls failed");

    const integrity = db.pragma("integrity_check", { simple: true });
    const foreignKeys = db.pragma("foreign_key_check");
    assert(integrity === "ok" && foreignKeys.length === 0, "Phase 3 migration integrity failed");
    return { migrations, expectedTables, auditImmutable, snapshotImmutable, integrity, foreignKeys };
  } finally {
    db.close();
  }
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parsePhase3MigrationOptions(process.argv.slice(2));
    console.log(JSON.stringify(verifyPhase3Migrations(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
