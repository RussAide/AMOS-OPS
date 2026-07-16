import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseOptions(argv) {
  let root;
  let output;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else output = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
  }
  root ??= positional[0] ?? "..";
  output ??= positional[1] ?? "m41a-migration-verification.db";
  return { root: path.resolve(root), output: path.resolve(output) };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.1A source root is missing under ${root}.`);
}

function applyMigrations(db, sourceRoot) {
  const directory = path.join(sourceRoot, "db", "migrations");
  const migrations = fs
    .readdirSync(directory)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  for (const migration of migrations) {
    const sql = fs.readFileSync(path.join(directory, migration), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((value) => value.trim())
      .filter(Boolean);
    db.transaction(() => statements.forEach((statement) => db.exec(statement)))();
  }
  return migrations;
}

function rejected(action, code) {
  try {
    action();
    return false;
  } catch (error) {
    return String(error).includes(code);
  }
}

export function verifyM41aMigrations(options) {
  const sourceRoot = sourceRootFor(options.root);
  if (fs.existsSync(options.output))
    throw new Error(
      `Refusing to overwrite existing verification database: ${options.output}`,
    );
  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  const db = new Database(options.output);
  try {
    db.pragma("foreign_keys = ON");
    const migrations = applyMigrations(db, sourceRoot);
    assert(
      migrations.at(-1) === "0008_m41a_executive_decision_intelligence.sql",
      "M4.1A migration is not the latest ordered migration.",
    );

    const expectedTables = [
      "m41a_dashboard_snapshots",
      "m41a_decision_events",
      "m41a_scenario_runs",
    ];
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'm41a_%' ORDER BY name",
      )
      .all()
      .map((row) => row.name);
    assert(
      JSON.stringify(tables) === JSON.stringify(expectedTables),
      `M4.1A table inventory drifted: ${tables.join(", ")}`,
    );

    const now = "2026-07-14T19:00:00.000Z";
    db.prepare(
      `INSERT INTO m41a_scenario_runs
       (id,scenario_id,status,started_at,completed_at,assertions_passed,assertions_failed,evidence_json,evidence_class,is_current,created_at)
       VALUES (?,?,?,?,?,8,0,'{}','synthetic_demo',1,?)`,
    ).run(
      "SYNTH-M41A-MIGRATION-RUN-001",
      "SYNTH-M41A-MIGRATION-SCENARIO",
      "passed",
      now,
      now,
      now,
    );
    db.prepare(
      `INSERT INTO m41a_dashboard_snapshots
       (id,run_id,scope,snapshot_version,payload_json,source_hashes_json,reconciliation_status,evidence_class,is_current,created_at)
       VALUES (?,?,?,?,?,'[]','reconciled','synthetic_demo',1,?)`,
    ).run(
      "SYNTH-M41A-MIGRATION-SNAPSHOT-001",
      "SYNTH-M41A-MIGRATION-RUN-001",
      "ENTERPRISE",
      1,
      '{"milestone":"M4.1A"}',
      now,
    );
    db.prepare(
      `INSERT INTO m41a_decision_events
       (id,aggregate_id,aggregate_type,sequence,event_type,scope,metric_id,actor_id,actor_role,payload_json,correlation_id,evidence_class,occurred_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,'synthetic_demo',?)`,
    ).run(
      "SYNTH-M41A-MIGRATION-EVENT-001",
      "SYNTH-M41A-MIGRATION-ALERT-001",
      "alert",
      1,
      "alert_triggered",
      "ENTERPRISE",
      "EXEC-REVENUE-VARIANCE",
      "SYNTH-SYSTEM",
      "system",
      '{"status":"open"}',
      "SYNTH-M41A-MIGRATION-CORRELATION",
      now,
    );

    const snapshotPayloadImmutable = rejected(
      () =>
        db
          .prepare(
            "UPDATE m41a_dashboard_snapshots SET payload_json='{}' WHERE id=?",
          )
          .run("SYNTH-M41A-MIGRATION-SNAPSHOT-001"),
      "M41A_DASHBOARD_SNAPSHOT_IMMUTABLE",
    );
    const eventUpdateImmutable = rejected(
      () =>
        db
          .prepare("UPDATE m41a_decision_events SET payload_json='{}' WHERE id=?")
          .run("SYNTH-M41A-MIGRATION-EVENT-001"),
      "M41A_DECISION_EVENT_IMMUTABLE",
    );
    const eventDeleteImmutable = rejected(
      () =>
        db
          .prepare("DELETE FROM m41a_decision_events WHERE id=?")
          .run("SYNTH-M41A-MIGRATION-EVENT-001"),
      "M41A_DECISION_EVENT_IMMUTABLE",
    );
    const snapshotDeleteImmutable = rejected(
      () =>
        db
          .prepare("DELETE FROM m41a_dashboard_snapshots WHERE id=?")
          .run("SYNTH-M41A-MIGRATION-SNAPSHOT-001"),
      "M41A_DASHBOARD_SNAPSHOT_IMMUTABLE",
    );
    db.prepare(
      "UPDATE m41a_dashboard_snapshots SET is_current=0 WHERE id=?",
    ).run("SYNTH-M41A-MIGRATION-SNAPSHOT-001");
    const historicalSnapshotImmutable = rejected(
      () =>
        db
          .prepare(
            "UPDATE m41a_dashboard_snapshots SET is_current=1 WHERE id=?",
          )
          .run("SYNTH-M41A-MIGRATION-SNAPSHOT-001"),
      "M41A_DASHBOARD_SNAPSHOT_IMMUTABLE",
    );

    assert(
      snapshotPayloadImmutable &&
        eventUpdateImmutable &&
        eventDeleteImmutable &&
        snapshotDeleteImmutable &&
        historicalSnapshotImmutable,
      "M4.1A immutable history controls failed.",
    );

    const integrity = db.pragma("integrity_check", { simple: true });
    const foreignKeys = db.pragma("foreign_key_check");
    assert(
      integrity === "ok" && foreignKeys.length === 0,
      "M4.1A migration integrity failed.",
    );

    const journal = JSON.parse(
      fs.readFileSync(
        path.join(sourceRoot, "db", "migrations", "meta", "_journal.json"),
        "utf8",
      ),
    );
    const finalJournalEntry = journal.entries?.at(-1);
    assert(
      finalJournalEntry?.idx === 8 &&
        finalJournalEntry?.tag === "0008_m41a_executive_decision_intelligence",
      "M4.1A migration journal entry drifted.",
    );

    return {
      milestone: "M4.1A",
      evidenceClass: "synthetic_demo",
      migrations,
      tables,
      immutableControls: {
        snapshotPayloadImmutable,
        eventUpdateImmutable,
        eventDeleteImmutable,
        snapshotDeleteImmutable,
        historicalSnapshotImmutable,
      },
      integrity,
      foreignKeyViolations: foreignKeys.length,
      journal: finalJournalEntry,
      passed: true,
    };
  } finally {
    db.close();
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(
      JSON.stringify(verifyM41aMigrations(parseOptions(process.argv.slice(2))), null, 2),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
