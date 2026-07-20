import fs from "node:fs";
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildOperationalProgramSummary } from "./operational-program-summary";

let db: Database.Database;

function installSchema(target: Database.Database): void {
  target.exec(`
    CREATE TABLE m21_ccmg_work_items (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      priority TEXT NOT NULL,
      assigned_department TEXT NOT NULL,
      assigned_role TEXT NOT NULL,
      due_at TEXT NOT NULL,
      approval_status TEXT NOT NULL,
      exception_status TEXT NOT NULL,
      queue_id TEXT NOT NULL,
      evidence_class TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE m21_ccmg_handoffs (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      work_item_id TEXT NOT NULL,
      to_department TEXT NOT NULL,
      status TEXT NOT NULL,
      initiated_at TEXT NOT NULL,
      due_at TEXT NOT NULL,
      accepted_at TEXT,
      completed_at TEXT,
      evidence_class TEXT NOT NULL
    );
    CREATE TABLE m21_ccmg_plan_lineage (
      id TEXT PRIMARY KEY,
      case_id TEXT NOT NULL,
      cans_assessment_id TEXT NOT NULL,
      cans_version INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_record_id TEXT NOT NULL,
      target_version INTEGER NOT NULL,
      target_approval_status TEXT NOT NULL,
      target_approved_at TEXT NOT NULL,
      routed_at TEXT NOT NULL,
      evidence_class TEXT NOT NULL
    );
  `);
}

function insertWork(
  target: Database.Database,
  input: {
    id: string;
    program: "MHTCM" | "MHRS";
    status: string;
    priority: string;
    dueAt: string;
    evidenceClass?: "production" | "synthetic_demo";
  },
): void {
  target
    .prepare(
      `INSERT INTO m21_ccmg_work_items
       (id,case_id,title,status,priority,assigned_department,assigned_role,due_at,
        approval_status,exception_status,queue_id,evidence_class,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      input.id,
      `CASE-${input.id}`,
      `Governed ${input.program} task`,
      input.status,
      input.priority,
      input.program,
      input.program === "MHTCM" ? "mhtcm-supervisor" : "mhrs-supervisor",
      input.dueAt,
      input.status === "awaiting_approval" ? "pending" : "approved",
      input.status === "blocked" ? "open" : "none",
      input.program.toLowerCase(),
      input.evidenceClass ?? "production",
      "2026-07-19T12:00:00.000Z",
    );
}

function databaseSnapshot(target: Database.Database): unknown {
  return [
    "m21_ccmg_work_items",
    "m21_ccmg_handoffs",
    "m21_ccmg_plan_lineage",
  ].map((table) => ({
    table,
    rows: target.prepare(`SELECT * FROM ${table} ORDER BY id`).all(),
  }));
}

beforeEach(() => {
  db = new Database(":memory:");
  installSchema(db);
});

afterEach(() => db.close());

describe("PF-11 durable Production program summaries", () => {
  it("returns only authoritative MHTCM records and performs zero writes", () => {
    insertWork(db, {
      id: "WORK-MHTCM-A",
      program: "MHTCM",
      status: "in_progress",
      priority: "urgent",
      dueAt: "2026-07-18T12:00:00.000Z",
    });
    insertWork(db, {
      id: "WORK-MHTCM-B",
      program: "MHTCM",
      status: "completed",
      priority: "routine",
      dueAt: "2026-07-17T12:00:00.000Z",
    });
    insertWork(db, {
      id: "SYNTH-WORK-MHTCM",
      program: "MHTCM",
      status: "in_progress",
      priority: "critical",
      dueAt: "2026-07-01T12:00:00.000Z",
      evidenceClass: "synthetic_demo",
    });
    db.prepare(
      `INSERT INTO m21_ccmg_handoffs
       VALUES ('HANDOFF-MHTCM','CASE-WORK-MHTCM-A','WORK-MHTCM-A','MHTCM',
               'accepted','2026-07-18T10:00:00.000Z','2026-07-20T10:00:00.000Z',
               '2026-07-18T11:00:00.000Z',NULL,'production')`,
    ).run();
    db.prepare(
      `INSERT INTO m21_ccmg_plan_lineage
       VALUES ('LINEAGE-MHTCM','CASE-WORK-MHTCM-A','CANS-PROD-1',1,
               'mhtcm_plan','PLAN-PROD-1',2,'approved',
               '2026-07-18T09:00:00.000Z','2026-07-18T10:00:00.000Z','production')`,
    ).run();

    const before = databaseSnapshot(db);
    db.pragma("query_only = ON");
    const result = buildOperationalProgramSummary(
      "MHTCM",
      "2026-07-20T12:00:00.000Z",
      db,
    );
    const after = databaseSnapshot(db);

    expect(after).toEqual(before);
    expect(result.source).toEqual({
      provider: "m21_ccmg_durable",
      evidenceClass: "production",
      accessMode: "read_only",
    });
    expect(result.metrics).toMatchObject({
      totalWorkItems: 2,
      activeWorkItems: 1,
      overdueWorkItems: 1,
      urgentWorkItems: 1,
      activeHandoffs: 1,
      approvedLineages: 1,
    });
    expect(result.workItems.map((item) => item.id)).toEqual([
      "WORK-MHTCM-B",
      "WORK-MHTCM-A",
    ]);
    expect(JSON.stringify(result)).not.toContain("SYNTH-WORK-MHTCM");
    expect(JSON.stringify(result)).not.toContain("youth");
  });

  it("keeps MHRS scope independent and returns an honest empty result", () => {
    insertWork(db, {
      id: "WORK-MHTCM-ONLY",
      program: "MHTCM",
      status: "in_progress",
      priority: "routine",
      dueAt: "2026-07-22T12:00:00.000Z",
    });

    const result = buildOperationalProgramSummary(
      "MHRS",
      "2026-07-20T12:00:00.000Z",
      db,
    );

    expect(result.empty).toBe(true);
    expect(result.metrics.totalWorkItems).toBe(0);
    expect(result.workItems).toEqual([]);
    expect(result.handoffs).toEqual([]);
    expect(result.approvedLineage).toEqual([]);
  });

  it("fails closed on an invalid timestamp or unavailable authoritative schema", () => {
    expect(() =>
      buildOperationalProgramSummary("MHTCM", "not-a-time", db),
    ).toThrow("OPERATIONAL_PROGRAM_SUMMARY_INVALID_AS_OF");

    const missing = new Database(":memory:");
    try {
      expect(() =>
        buildOperationalProgramSummary(
          "MHRS",
          "2026-07-20T12:00:00.000Z",
          missing,
        ),
      ).toThrow(/m21_ccmg_work_items/);
    } finally {
      missing.close();
    }
  });

  it("routes Production summaries directly to the durable adapter, never a synthetic provider", () => {
    const m22Source = fs.readFileSync("api/routers/m22.ts", "utf8");
    const m23Source = fs.readFileSync("api/routers/m23.ts", "utf8");
    const m22Procedure = m22Source.slice(
      m22Source.indexOf("operationalSummary:"),
      m22Source.indexOf("representativeScenario:"),
    );
    const m23Procedure = m23Source.slice(
      m23Source.indexOf("operationalSummary:"),
      m23Source.indexOf("dashboard:"),
    );

    expect(m22Procedure).toContain(
      'buildOperationalProgramSummary("MHTCM", input.asOf)',
    );
    expect(m23Procedure).toContain(
      'buildOperationalProgramSummary("MHRS", input.asOf)',
    );
    for (const procedure of [m22Procedure, m23Procedure]) {
      expect(procedure).toContain('dataScope !== "operational"');
      expect(procedure).not.toMatch(/Synthetic|Engine|Scenario/);
    }
  });
});
