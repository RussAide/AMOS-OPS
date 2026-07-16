import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseOptions(argv) {
  let root = "..";
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
    else throw new Error(`Unknown option: ${argv[index]}`);
  }
  const temporary = output === undefined;
  output ??= path.join(
    os.tmpdir(),
    `amos-m41c-direct-verification-${process.pid}-${Date.now()}.db`,
  );
  return { root: path.resolve(root), output: path.resolve(output), temporary };
}

function sourceRoot(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.1C source root is missing under ${root}.`);
}

function rejected(action, code) {
  try {
    action();
    return false;
  } catch (error) {
    return String(error).includes(code);
  }
}

function tableNames(db) {
  return db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'm41c_%' ORDER BY name",
    )
    .all()
    .map((row) => row.name);
}

export function verifyM41cMigrations(input) {
  const source = sourceRoot(input.root);
  if (fs.existsSync(input.output))
    throw new Error(`Refusing to overwrite ${input.output}.`);
  fs.mkdirSync(path.dirname(input.output), { recursive: true });
  const db = new Database(input.output);
  try {
    db.pragma("foreign_keys = ON");
    const migrationRoot = path.join(source, "db", "migrations");
    const migrations = fs
      .readdirSync(migrationRoot)
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      const statements = fs
        .readFileSync(path.join(migrationRoot, migration), "utf8")
        .split("--> statement-breakpoint")
        .map((value) => value.trim())
        .filter(Boolean);
      db.transaction(() =>
        statements.forEach((statement) => db.exec(statement)),
      )();
    }
    assert(
      migrations.at(-1) === "0010_m41c_clinical_intelligence_fabric.sql",
      "M4.1C migration is not latest.",
    );

    const tables = tableNames(db);
    const expected = [
      "m41c_audit_events",
      "m41c_competency_bindings",
      "m41c_external_projections",
      "m41c_governance_decisions",
      "m41c_instrument_profiles",
      "m41c_knowledge_versions",
      "m41c_longitudinal_events",
      "m41c_monitoring_signals",
      "m41c_pathway_definitions",
      "m41c_quarantine_entries",
      "m41c_recommendations",
      "m41c_scenario_runs",
    ];
    assert(
      JSON.stringify(tables) === JSON.stringify(expected),
      `M4.1C table inventory drifted: ${tables.join(", ")}`,
    );

    const now = "2026-11-15T08:00:00.000Z";
    const runId = "SYNTH-M41C-MIGRATION-RUN-001";
    db.prepare(
      `INSERT INTO m41c_scenario_runs
       (id,scenario_id,status,started_at,completed_at,assertions_passed,assertions_failed,
        evidence_json,evidence_class,production_rows,live_writes,is_current,created_at)
       VALUES (?,?,?,?,?,18,0,'{}','synthetic_clinical_demo',0,0,1,?)`,
    ).run(runId, "SYNTH-M41C-MIGRATION-SCENARIO", "passed", now, now, now);

    db.prepare(
      `INSERT INTO m41c_governance_decisions
       (id,run_id,subject_type,subject_id,subject_version,decision_type,decision_status,
        approver_roles_json,signatures_json,rationale,effective_at,review_due_at,correlation_id,
        evidence_class,created_at)
       VALUES (?,?,?,?,?,'approve_demo','signed',?,?,?,?,?,?,'synthetic_clinical_demo',?)`,
    ).run(
      "SYNTH-M41C-GOV-001",
      runId,
      "pathway",
      "SYNTH-PATHWAY-001",
      "1.0",
      '["clinical-director","bhc-director"]',
      '[{"signerId":"SYNTH-CLINICAL-DIRECTOR"}]',
      "Synthetic demonstration approval only.",
      now,
      "2027-11-15T08:00:00.000Z",
      "SYNTH-M41C-CORRELATION-001",
      now,
    );
    db.prepare(
      `INSERT INTO m41c_knowledge_versions
       (id,run_id,knowledge_id,version,activation_state,source_id,owner_role,population_json,
        license_state,effective_at,review_due_at,content_hash,validation_json,evidence_class,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'synthetic_clinical_demo',?)`,
    ).run(
      "SYNTH-M41C-KNOW-001",
      runId,
      "KNOW-SAFETY-DEMO",
      "1.0",
      "demo_approved",
      "M41C-SRC-SYNTHETIC-SAFETY",
      "clinical-director",
      '{"population":["synthetic youth"]}',
      "not_required",
      now,
      "2027-11-15T08:00:00.000Z",
      "sha256:synthetic",
      '{"passed":true}',
      now,
    );
    const profileInsert = db.prepare(
      `INSERT INTO m41c_instrument_profiles
       (id,run_id,profile_key,profile_version,program,activation_state,source_id,license_state,
        content_hash,qualification_ids_json,reassessment_cadence,external_mappings_json,
        validation_json,evidence_class,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'{}','synthetic_clinical_demo',?)`,
    );
    profileInsert.run(
      "SYNTH-M41C-PROFILE-TRR",
      runId,
      "TRR-CANS-SYNTHETIC-DEMO",
      "metadata-1.0",
      "Texas TRR",
      "validation_pending",
      "M41C-SRC-TEXAS-TRR",
      "license_validation_pending",
      null,
      '["CANS-CERTIFICATION"]',
      "program-defined; authoritative validation pending",
      '["CMBHS-TRR-SIMULATOR"]',
      now,
    );
    profileInsert.run(
      "SYNTH-M41C-PROFILE-DFPS",
      runId,
      "DFPS-CANS-3.0-SYNTHETIC-DEMO",
      "metadata-3.0",
      "Texas DFPS",
      "validation_pending",
      "M41C-SRC-DFPS-CANS-3",
      "license_validation_pending",
      null,
      '["DFPS-CANS-CERTIFICATION"]',
      "program-defined; authoritative validation pending",
      '["DFPS-SIMULATOR"]',
      now,
    );
    db.prepare(
      `INSERT INTO m41c_quarantine_entries
       (id,run_id,artifact_type,artifact_id,source_path,reason_codes_json,enforcement,
        production_use_blocked,demo_recommendation_blocked,reviewed_by_role,reviewed_at,evidence_class)
       VALUES (?,?,?,?,?,?,'non_executable',1,1,'clinical-director',?,'synthetic_clinical_demo')`,
    ).run(
      "SYNTH-M41C-QUAR-001",
      runId,
      "home_grown_scoring",
      "LEGACY-CANS-TOTAL-BANDS",
      "contracts/ccmg/cans-routing.ts",
      '["UNAPPROVED_TOTAL_SCORE","GENERIC_LOC_MAPPING"]',
      now,
    );
    db.prepare(
      `INSERT INTO m41c_pathway_definitions
       (id,run_id,pathway_key,pathway_version,activation_state,source_ids_json,
        required_approver_roles_json,required_competency_ids_json,steps_json,
        validation_record_id,evidence_class,created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,'synthetic_clinical_demo',?)`,
    ).run(
      "SYNTH-M41C-PATH-001",
      runId,
      "YOUTH-SAFETY-SYNTHETIC-DEMO",
      "1.0",
      "demo_approved",
      '["M41C-SRC-SYNTHETIC-SAFETY"]',
      '["clinical-director","bhc-director"]',
      '["COMP-SYNTHETIC-SAFETY"]',
      '["screen","qualified_assessment","licensed_disposition","follow_up"]',
      "SYNTH-M41C-GOV-001",
      now,
    );
    db.prepare(
      `INSERT INTO m41c_longitudinal_events
       (id,run_id,episode_id,subject_id,sequence,event_type,stage,source_ids_json,payload_json,
        correlation_id,evidence_class,occurred_at)
       VALUES (?,?,?,?,1,'assessment_recorded','assessment','[]','{}',?,'synthetic_clinical_demo',?)`,
    ).run(
      "SYNTH-M41C-LONG-001",
      runId,
      "SYNTH-EPISODE-001",
      "SYNTH-YOUTH-001",
      "SYNTH-M41C-CORRELATION-001",
      now,
    );
    db.prepare(
      `INSERT INTO m41c_recommendations
       (id,run_id,episode_id,pathway_id,pathway_version,source_ids_json,recommendation_json,
        human_gate_json,status,production_action_blocked,created_at)
       VALUES (?,?,?,?,?,'[]','{}','{"required":true}','proposed',1,?)`,
    ).run(
      "SYNTH-M41C-REC-001",
      runId,
      "SYNTH-EPISODE-001",
      "SYNTH-M41C-PATH-001",
      "1.0",
      now,
    );
    db.prepare(
      `INSERT INTO m41c_external_projections
       (id,run_id,episode_id,target_system,resource_type,mapping_version,direction,payload_json,
        reconciliation_status,external_write_blocked,evidence_class,created_at)
       VALUES (?,?,?,'CMBHS_SIMULATOR','TRR_RECONCILIATION','1.0','reconciliation_read','{}',
        'synthetic_match',1,'synthetic_clinical_demo',?)`,
    ).run("SYNTH-M41C-PROJECTION-001", runId, "SYNTH-EPISODE-001", now);
    db.prepare(
      `INSERT INTO m41c_competency_bindings
       (id,run_id,actor_id,actor_role,competency_id,subject_type,subject_id,status,
        valid_from,expires_at,supervisor_role,evidence_class)
       VALUES (?,?,?,?,?,'pathway',?,'current',?,?,'clinical-director','synthetic_clinical_demo')`,
    ).run(
      "SYNTH-M41C-COMP-001",
      runId,
      "SYNTH-THERAPIST-001",
      "therapist",
      "COMP-SYNTHETIC-SAFETY",
      "SYNTH-M41C-PATH-001",
      now,
      "2027-11-15T08:00:00.000Z",
    );
    db.prepare(
      `INSERT INTO m41c_monitoring_signals
       (id,run_id,pathway_id,signal_type,cadence,numerator,denominator,threshold_json,status,
        workplan_item_id,evidence_class,measured_at)
       VALUES (?,?,?,'fidelity','monthly',10,10,'{"minimum":0.9}','within_limit',?,
        'synthetic_clinical_demo',?)`,
    ).run(
      "SYNTH-M41C-MONITOR-001",
      runId,
      "SYNTH-M41C-PATH-001",
      "SYNTH-M41B-WORKPLAN-MONTHLY-001",
      now,
    );
    db.prepare(
      `INSERT INTO m41c_audit_events
       (id,run_id,aggregate_id,sequence,event_type,actor_id,actor_role,entity_type,entity_id,
        source_ids_json,before_json,after_json,rationale,correlation_id,evidence_class,occurred_at)
       VALUES (?,?,?,1,'governance_decision','SYNTH-CLINICAL-DIRECTOR','clinical-director',
        'pathway',?,'[]',NULL,'{}','Synthetic validation',?,'synthetic_clinical_demo',?)`,
    ).run(
      "SYNTH-M41C-AUDIT-001",
      runId,
      "SYNTH-M41C-PATH-001",
      "SYNTH-M41C-PATH-001",
      "SYNTH-M41C-CORRELATION-001",
      now,
    );

    const controls = {
      productionRowsRejected: rejected(
        () =>
          db
            .prepare(
              `INSERT INTO m41c_scenario_runs
               (id,scenario_id,status,started_at,evidence_class,production_rows,live_writes,created_at)
               VALUES ('BAD-RUN','BAD-SCENARIO','failed',?,'synthetic_clinical_demo',1,0,?)`,
            )
            .run(now, now),
        "CHECK constraint failed",
      ),
      productionActivationRejected: rejected(
        () =>
          db
            .prepare(
              `INSERT INTO m41c_pathway_definitions
               (id,run_id,pathway_key,pathway_version,activation_state,steps_json,evidence_class,created_at)
               VALUES ('BAD-PATH',?,'BAD','1','production_approved','[]','synthetic_clinical_demo',?)`,
            )
            .run(runId, now),
        "CHECK constraint failed",
      ),
      liveWriteEnableRejected: rejected(
        () =>
          db
            .prepare(
              `INSERT INTO m41c_external_projections
               (id,run_id,episode_id,target_system,resource_type,mapping_version,direction,payload_json,
                reconciliation_status,external_write_blocked,evidence_class,created_at)
               VALUES ('BAD-PROJECTION',?,'SYNTH-EPISODE-001','CMBHS_SIMULATOR','Task','1',
                'internal_projection','{}','blocked',0,'synthetic_clinical_demo',?)`,
            )
            .run(runId, now),
        "CHECK constraint failed",
      ),
      realSubjectRejected: rejected(
        () =>
          db
            .prepare(
              `INSERT INTO m41c_longitudinal_events
               (id,run_id,episode_id,subject_id,sequence,event_type,stage,payload_json,
                correlation_id,evidence_class,occurred_at)
               VALUES ('BAD-LONG',?,'EPISODE','REAL-123',2,'event','stage','{}','CORR',
                'synthetic_clinical_demo',?)`,
            )
            .run(runId, now),
        "CHECK constraint failed",
      ),
      governanceImmutable: rejected(
        () =>
          db
            .prepare(
              "UPDATE m41c_governance_decisions SET rationale='changed' WHERE id=?",
            )
            .run("SYNTH-M41C-GOV-001"),
        "M41C_GOVERNANCE_DECISION_IMMUTABLE",
      ),
      longitudinalImmutable: rejected(
        () =>
          db
            .prepare("DELETE FROM m41c_longitudinal_events WHERE id=?")
            .run("SYNTH-M41C-LONG-001"),
        "M41C_LONGITUDINAL_EVENT_IMMUTABLE",
      ),
      auditImmutable: rejected(
        () =>
          db
            .prepare(
              "UPDATE m41c_audit_events SET rationale='changed' WHERE id=?",
            )
            .run("SYNTH-M41C-AUDIT-001"),
        "M41C_AUDIT_EVENT_IMMUTABLE",
      ),
    };
    assert(
      Object.values(controls).every(Boolean),
      "M4.1C database controls failed.",
    );

    const profiles = db
      .prepare(
        "SELECT profile_key,program,activation_state FROM m41c_instrument_profiles ORDER BY profile_key",
      )
      .all();
    assert(
      profiles.length === 2 &&
        profiles[0].profile_key !== profiles[1].profile_key &&
        profiles[0].program !== profiles[1].program,
      "TRR CANS and DFPS CANS 3.0 profiles were not kept distinct.",
    );

    const integrity = db.pragma("integrity_check", { simple: true });
    const foreignKeys = db.pragma("foreign_key_check");
    assert(
      integrity === "ok" && foreignKeys.length === 0,
      "M4.1C migration integrity failed.",
    );
    const journal = JSON.parse(
      fs.readFileSync(
        path.join(migrationRoot, "meta", "_journal.json"),
        "utf8",
      ),
    );
    const finalJournalEntry = journal.entries?.at(-1);
    assert(
      finalJournalEntry?.idx === 10 &&
        finalJournalEntry?.tag === "0010_m41c_clinical_intelligence_fabric",
      "M4.1C journal drifted.",
    );
    return {
      milestone: "M4.1C",
      evidenceClass: "synthetic_clinical_demo",
      migrations,
      tables,
      rowCounts: Object.fromEntries(
        tables.map((table) => [
          table,
          db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
        ]),
      ),
      profiles,
      controls,
      productionRows: 0,
      liveWrites: 0,
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
  const options = parseOptions(process.argv.slice(2));
  try {
    console.log(JSON.stringify(verifyM41cMigrations(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  } finally {
    if (options.temporary) {
      for (const suffix of ["", "-shm", "-wal"])
        fs.rmSync(`${options.output}${suffix}`, { force: true });
    }
  }
}
