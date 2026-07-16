import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function options(argv) {
  let root = "..";
  let output = "m41b-migration-verification.db";
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
    else throw new Error(`Unknown option: ${argv[index]}`);
  }
  return { root: path.resolve(root), output: path.resolve(output) };
}

function sourceRoot(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.1B source root is missing under ${root}.`);
}

function rejected(action, code) {
  try {
    action();
    return false;
  } catch (error) {
    return String(error).includes(code);
  }
}

export function verifyM41bMigrations(input) {
  const source = sourceRoot(input.root);
  if (fs.existsSync(input.output)) throw new Error(`Refusing to overwrite ${input.output}.`);
  fs.mkdirSync(path.dirname(input.output), { recursive: true });
  const db = new Database(input.output);
  try {
    db.pragma("foreign_keys = ON");
    const migrationRoot = path.join(source, "db", "migrations");
    const migrations = fs.readdirSync(migrationRoot).filter((name) => /^\d{4}_.+\.sql$/.test(name)).sort();
    for (const migration of migrations) {
      const statements = fs.readFileSync(path.join(migrationRoot, migration), "utf8")
        .split("--> statement-breakpoint").map((value) => value.trim()).filter(Boolean);
      db.transaction(() => statements.forEach((statement) => db.exec(statement)))();
    }
    assert(migrations.at(-1) === "0009_m41b_executive_intelligence_workplans.sql", "M4.1B migration is not latest.");
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'm41b_%' ORDER BY name").all().map((row) => row.name);
    const expected = ["m41b_interaction_events", "m41b_scenario_runs", "m41b_workplan_snapshots"];
    assert(JSON.stringify(tables) === JSON.stringify(expected), `M4.1B table inventory drifted: ${tables.join(", ")}`);

    const now = "2026-10-15T08:00:00.000Z";
    db.prepare(`INSERT INTO m41b_scenario_runs
      (id,scenario_id,status,started_at,completed_at,assertions_passed,assertions_failed,evidence_json,evidence_class,is_current,created_at)
      VALUES (?,?,?,?,?,10,0,'{}','synthetic_demo',1,?)`).run(
      "SYNTH-M41B-MIGRATION-RUN-001", "SYNTH-M41B-MIGRATION-SCENARIO", "passed", now, now, now,
    );
    db.prepare(`INSERT INTO m41b_workplan_snapshots
      (id,run_id,user_id,role,tier,division,snapshot_version,payload_json,source_ids_json,evidence_class,is_current,created_at)
      VALUES (?,?,?,?,?,?,1,?,'[]','synthetic_demo',1,?)`).run(
      "SYNTH-M41B-SNAPSHOT-001", "SYNTH-M41B-MIGRATION-RUN-001", "SYNTH-M41B-USER", "managing-director", "T1", "eo", '{"milestone":"M4.1B"}', now,
    );
    db.prepare(`INSERT INTO m41b_interaction_events
      (id,run_id,aggregate_id,aggregate_type,sequence,event_type,actor_id,actor_role,division,payload_json,source_ids_json,correlation_id,evidence_class,occurred_at)
      VALUES (?,?,?,?,1,?,?,?,?,?,'[]',?,'synthetic_demo',?)`).run(
      "SYNTH-M41B-EVENT-001", "SYNTH-M41B-MIGRATION-RUN-001", "SYNTH-M41B-GUIDANCE-001", "guidance", "prompt_received", "SYNTH-M41B-USER", "managing-director", "eo", '{"prompt":"synthetic"}', "SYNTH-M41B-CORRELATION-001", now,
    );

    const snapshotUpdateImmutable = rejected(
      () => db.prepare("UPDATE m41b_workplan_snapshots SET payload_json='{}' WHERE id=?").run("SYNTH-M41B-SNAPSHOT-001"),
      "M41B_WORKPLAN_SNAPSHOT_IMMUTABLE",
    );
    const snapshotDeleteImmutable = rejected(
      () => db.prepare("DELETE FROM m41b_workplan_snapshots WHERE id=?").run("SYNTH-M41B-SNAPSHOT-001"),
      "M41B_WORKPLAN_SNAPSHOT_IMMUTABLE",
    );
    const eventUpdateImmutable = rejected(
      () => db.prepare("UPDATE m41b_interaction_events SET payload_json='{}' WHERE id=?").run("SYNTH-M41B-EVENT-001"),
      "M41B_INTERACTION_EVENT_IMMUTABLE",
    );
    const eventDeleteImmutable = rejected(
      () => db.prepare("DELETE FROM m41b_interaction_events WHERE id=?").run("SYNTH-M41B-EVENT-001"),
      "M41B_INTERACTION_EVENT_IMMUTABLE",
    );
    db.prepare("UPDATE m41b_workplan_snapshots SET is_current=0 WHERE id=?").run("SYNTH-M41B-SNAPSHOT-001");
    const historyImmutable = rejected(
      () => db.prepare("UPDATE m41b_workplan_snapshots SET is_current=1 WHERE id=?").run("SYNTH-M41B-SNAPSHOT-001"),
      "M41B_WORKPLAN_SNAPSHOT_IMMUTABLE",
    );
    assert(snapshotUpdateImmutable && snapshotDeleteImmutable && eventUpdateImmutable && eventDeleteImmutable && historyImmutable, "M4.1B immutable controls failed.");
    const integrity = db.pragma("integrity_check", { simple: true });
    const foreignKeys = db.pragma("foreign_key_check");
    assert(integrity === "ok" && foreignKeys.length === 0, "M4.1B migration integrity failed.");
    const journal = JSON.parse(fs.readFileSync(path.join(migrationRoot, "meta", "_journal.json"), "utf8"));
    const finalJournalEntry = journal.entries?.at(-1);
    assert(finalJournalEntry?.idx === 9 && finalJournalEntry?.tag === "0009_m41b_executive_intelligence_workplans", "M4.1B journal drifted.");
    return {
      milestone: "M4.1B", evidenceClass: "synthetic_demo", migrations, tables,
      immutableControls: { snapshotUpdateImmutable, snapshotDeleteImmutable, eventUpdateImmutable, eventDeleteImmutable, historyImmutable },
      integrity, foreignKeyViolations: foreignKeys.length, journal: finalJournalEntry, passed: true,
    };
  } finally {
    db.close();
  }
}

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(JSON.stringify(verifyM41bMigrations(options(process.argv.slice(2))), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

