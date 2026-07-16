import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";

const databasePath = path.resolve(
  process.argv[2] ?? "m21-migration-verification.db",
);
if (fs.existsSync(databasePath)) {
  throw new Error(
    `Refusing to overwrite existing verification database: ${databasePath}`,
  );
}

const migrationDirectory = path.resolve("db/migrations");
const migrations = fs
  .readdirSync(migrationDirectory)
  .filter((name) => /^\d{4}_.+\.sql$/.test(name))
  .sort();
const db = new Database(databasePath);

const count = (sql) => db.prepare(sql).get().count;
const assertEqual = (label, actual, expected) => {
  if (actual !== expected) {
    throw new Error(`${label} expected ${expected}, found ${actual}`);
  }
};

try {
  db.pragma("foreign_keys = ON");
  for (const migration of migrations) {
    const sql = fs.readFileSync(
      path.join(migrationDirectory, migration),
      "utf8",
    );
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    db.transaction(() => {
      for (const statement of statements) db.exec(statement);
    })();
  }

  const counts = {
    referrals: count("SELECT COUNT(*) AS count FROM m21_ccmg_referrals"),
    cansVersions: count(
      "SELECT COUNT(*) AS count FROM m21_ccmg_cans_assessments",
    ),
    lineageRoutes: count(
      "SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage",
    ),
    workItems: count("SELECT COUNT(*) AS count FROM m21_ccmg_work_items"),
    handoffs: count("SELECT COUNT(*) AS count FROM m21_ccmg_handoffs"),
    auditEvents: count(
      "SELECT COUNT(*) AS count FROM m21_ccmg_audit_events",
    ),
    productionRows: count(`
      SELECT (
        (SELECT COUNT(*) FROM m21_ccmg_referrals WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_cans_assessments WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_plan_lineage WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_work_items WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_handoffs WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_audit_events WHERE evidence_class = 'production')
      ) AS count
    `),
  };

  const expectedCounts = {
    referrals: 4,
    cansVersions: 3,
    lineageRoutes: 4,
    workItems: 10,
    handoffs: 3,
    auditEvents: 5,
    productionRows: 0,
  };
  for (const [label, expected] of Object.entries(expectedCounts)) {
    assertEqual(label, counts[label], expected);
  }

  const queueInventory = db
    .prepare(
      "SELECT queue_id AS queueId, COUNT(*) AS count FROM m21_ccmg_work_items GROUP BY queue_id ORDER BY queue_id",
    )
    .all();
  const expectedQueues = [
    "cans",
    "intake",
    "medication_management",
    "mhrs",
    "mhtcm",
    "qa",
  ];
  if (
    JSON.stringify(queueInventory.map((row) => row.queueId)) !==
    JSON.stringify(expectedQueues)
  ) {
    throw new Error("The six required M2.1 queues are not all represented.");
  }

  const scenarioInventory = db
    .prepare(`
      SELECT id, status, urgency
      FROM m21_ccmg_referrals
      WHERE id IN (
        'M21-REF-NEW-001',
        'M21-REF-EXISTING-001',
        'M21-REF-HELD-001',
        'M21-REF-URGENT-001'
      )
      ORDER BY id
    `)
    .all();
  assertEqual("controlled scenario referrals", scenarioInventory.length, 4);
  const scenarioById = new Map(
    scenarioInventory.map((row) => [row.id, row]),
  );
  if (
    scenarioById.get("M21-REF-NEW-001")?.status !== "screening" ||
    scenarioById.get("M21-REF-EXISTING-001")?.status !== "active" ||
    scenarioById.get("M21-REF-HELD-001")?.status !== "held" ||
    scenarioById.get("M21-REF-URGENT-001")?.urgency !== "emergency"
  ) {
    throw new Error("The four controlled M2.1 scenario classes drifted.");
  }

  const minimumNecessarySlices = db
    .prepare(`
      SELECT source_type AS sourceType, COUNT(*) AS count
      FROM m21_ccmg_work_items
      WHERE source_type IN ('payer_authorization','capacity')
      GROUP BY source_type
      ORDER BY source_type
    `)
    .all();
  if (
    JSON.stringify(minimumNecessarySlices) !==
    JSON.stringify([
      { sourceType: "capacity", count: 1 },
      { sourceType: "payer_authorization", count: 1 },
    ])
  ) {
    throw new Error(
      "The minimum-necessary GRO capacity and revenue authorization slices drifted.",
    );
  }

  const independenceControl = db
    .prepare(`
      SELECT COUNT(*) AS count
      FROM m21_ccmg_work_items
      WHERE id = 'M21-WORK-SELF-APPROVAL-001'
        AND approval_status = 'pending'
        AND assigned_to = 'SYNTH-TREATMENT-DIRECTOR'
    `)
    .get().count;
  assertEqual("independent approval control row", independenceControl, 1);

  const auditInventory = db
    .prepare(
      "SELECT event_type AS eventType, COUNT(*) AS count FROM m21_ccmg_audit_events GROUP BY event_type ORDER BY event_type",
    )
    .all();
  const expectedAuditTypes = [
    "access",
    "approval",
    "assignment",
    "material_change",
    "plan_handoff",
  ];
  if (
    JSON.stringify(auditInventory.map((row) => row.eventType)) !==
    JSON.stringify(expectedAuditTypes)
  ) {
    throw new Error("The five required M2.1 audit classes are not represented.");
  }

  const dualTargetVersions = db
    .prepare(`
      SELECT cans_assessment_id AS assessmentId,
             COUNT(DISTINCT target_type) AS targetCount
      FROM m21_ccmg_plan_lineage
      GROUP BY cans_assessment_id
      ORDER BY cans_assessment_id
    `)
    .all();
  if (
    dualTargetVersions.length !== 2 ||
    dualTargetVersions.some((row) => row.targetCount !== 2)
  ) {
    throw new Error(
      "Each seeded routed CANS version must link to both approved target types.",
    );
  }

  let updateDenied = false;
  try {
    db.prepare(
      "UPDATE m21_ccmg_audit_events SET reason = reason WHERE id = (SELECT id FROM m21_ccmg_audit_events LIMIT 1)",
    ).run();
  } catch (error) {
    updateDenied = String(error).includes("M21_AUDIT_IMMUTABLE");
  }
  let deleteDenied = false;
  try {
    db.prepare(
      "DELETE FROM m21_ccmg_audit_events WHERE id = (SELECT id FROM m21_ccmg_audit_events LIMIT 1)",
    ).run();
  } catch (error) {
    deleteDenied = String(error).includes("M21_AUDIT_IMMUTABLE");
  }
  if (!updateDenied || !deleteDenied) {
    throw new Error("The M2.1 audit ledger is not update/delete immutable.");
  }

  const integrity = db.pragma("integrity_check", { simple: true });
  const foreignKeys = db.pragma("foreign_key_check");
  if (integrity !== "ok") {
    throw new Error(`Integrity check failed: ${integrity}`);
  }
  if (foreignKeys.length !== 0) {
    throw new Error("Foreign-key validation failed");
  }

  console.log(
    JSON.stringify(
      {
        status: "PASS",
        databasePath,
        dataPosture: "disposable-fictional-synthetic-verification-only",
        migrations,
        counts,
        queueInventory,
        scenarioInventory,
        minimumNecessarySlices,
        independenceControl,
        auditInventory,
        dualTargetVersions,
        auditImmutability: { updateDenied, deleteDenied },
        integrity,
        foreignKeyViolations: foreignKeys.length,
      },
      null,
      2,
    ),
  );
} finally {
  db.close();
}
