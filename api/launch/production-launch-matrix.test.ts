import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  db: null as Database.Database | null,
  scope: "operational" as "operational" | "training",
}));

vi.mock("../queries/connection", () => ({
  sqlite: new Proxy({}, {
    get(_target, key) {
      if (!fixture.db) throw new Error("LAUNCH_TEST_DB_NOT_INITIALIZED");
      const value: unknown = Reflect.get(fixture.db, key);
      return typeof value === "function" ? value.bind(fixture.db) : value;
    },
  }),
  currentDataScope: () => fixture.scope,
}));
vi.mock("../lib/env", () => ({
  env: { isProduction: true, isStaging: false },
}));

import {
  CYPRESS_LAUNCH_ENTITY_TYPE,
  CYPRESS_LAUNCH_PREFIX,
  importProductionCypressLaunchMatrix,
  parseAuthoritativeCypressRegistry,
} from "./production-launch-matrix";

function launchRegistry() {
  const ids = ["G", "C", "W", "S", "B", "N", "O", "F", "T", "Q"]
    .flatMap((p) => [1, 2, 3, 4].map((n) => p + "0" + n));
  return {
    metadata: {
      work_item: "ADL-AMOS-OPS-LAUNCH-2026-11",
      repository_destination: "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents",
    },
    priority_distribution: { P0: 14, P1: 14, P2: 9, P3: 3 },
    actions: ids.map((id, i) => ({
      id, title: "Synthetic action " + id,
      priority: i < 14 ? "P0" : i < 28 ? "P1" : i < 37 ? "P2" : "P3",
      planned_due_original: "Mon 23 Nov 2026",
      lead: "Synthetic functional lead", dependencies: "G01",
      source_status: id === "Q04" ? "On hold" : "Planned",
      status: id === "Q04" ? "On hold" : "Planned",
      rank: i + 1, immediate_action: "Capture synthetic evidence",
      approval: "Human reviewer with qualified approval where required",
      verified_in_amos_ops: false,
    })),
  };
}

beforeEach(() => {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE work_queue (
    id TEXT PRIMARY KEY, task_title TEXT NOT NULL, task_type TEXT NOT NULL,
    description TEXT, assigned_to TEXT, assigned_by TEXT,
    priority TEXT NOT NULL, status TEXT NOT NULL, entity_type TEXT,
    entity_id TEXT, workflow_id TEXT, evidence_required INTEGER,
    evidence_uploaded INTEGER, due_date TEXT, created_at TEXT
  );`);
  fixture.db = db;
  fixture.scope = "operational";
});
afterEach(() => {
  fixture.db?.close();
  fixture.db = null;
});

describe("Controlled Production Cypress Launch Matrix import", () => {
  it("accepts the authoritative registry, creates exactly 40 unique M1 tasks and preserves Q04 HOLD", () => {
    const payload = JSON.stringify(launchRegistry());
    expect(parseAuthoritativeCypressRegistry(payload)).toHaveLength(40);
    const result = importProductionCypressLaunchMatrix(payload);
    expect(result).toMatchObject({
      actionCount: 40, inserted: 40, retained: 0,
      source: "production-operational", firstAdmissionHold: true,
    });
    expect(result.registrySha256).toMatch(/^[a-f0-9]{64}$/);
    const priorities = fixture.db!.prepare(
      "SELECT priority, COUNT(*) AS count FROM work_queue GROUP BY priority"
    ).all() as Array<{priority:string; count:number}>;
    expect(Object.fromEntries(priorities.map((p) => [p.priority, p.count])))
      .toEqual({urgent:14, high:14, medium:9, low:3});
    const hold = fixture.db!.prepare(
      "SELECT task_title, status, evidence_required FROM work_queue WHERE id = ?"
    ).get(CYPRESS_LAUNCH_PREFIX + "Q04") as
      {task_title:string;status:string;evidence_required:number};
    expect(hold.task_title).toContain("FIRST ADMISSION HOLD");
    expect(hold.status).toBe("pending");
    expect(hold.evidence_required).toBe(1);
  });

  it("is idempotent and preserves prior status, assignment, uploaded evidence and title", () => {
    const payload = JSON.stringify(launchRegistry());
    importProductionCypressLaunchMatrix(payload);
    fixture.db!.prepare(
      "UPDATE work_queue SET status = ?, assigned_to = ?, evidence_uploaded = ?, task_title = ? WHERE id = ?"
    ).run("in-progress", "existing.staff@example.invalid", 1,
      "Previous approved task title", CYPRESS_LAUNCH_PREFIX + "G01");
    const second = importProductionCypressLaunchMatrix(payload);
    expect(second).toMatchObject({inserted:0, retained:40});
    const original = fixture.db!.prepare(
      "SELECT status, assigned_to, evidence_uploaded, task_title FROM work_queue WHERE id = ?"
    ).get(CYPRESS_LAUNCH_PREFIX + "G01");
    expect(original).toEqual({
      status:"in-progress", assigned_to:"existing.staff@example.invalid",
      evidence_uploaded:1, task_title:"Previous approved task title",
    });
  });

  it("fails atomically if a colliding task belongs to another work item", () => {
    const payload = JSON.stringify(launchRegistry());
    fixture.db!.prepare(
      "INSERT INTO work_queue (id,task_title,task_type,priority,status,entity_type,entity_id,evidence_required) " +
      "VALUES (?, 'Foreign task', 'general', 'high', 'pending', 'other', 'T03', 1)"
    ).run(CYPRESS_LAUNCH_PREFIX + "T03");
    expect(() => importProductionCypressLaunchMatrix(payload))
      .toThrow("CYPRESS_LAUNCH_EXISTING_TASK_CONFLICT:T03");
    expect((fixture.db!.prepare("SELECT COUNT(*) AS count FROM work_queue")
      .get() as {count:number}).count).toBe(1);
  });

  it("refuses to reconcile a prematurely completed first-admission action", () => {
    const payload = JSON.stringify(launchRegistry());
    importProductionCypressLaunchMatrix(payload);
    fixture.db!.prepare("UPDATE work_queue SET status = 'completed' WHERE id = ?")
      .run(CYPRESS_LAUNCH_PREFIX + "Q04");
    expect(() => importProductionCypressLaunchMatrix(payload))
      .toThrow("CYPRESS_FIRST_ADMISSION_PREMATURE_CLOSURE");
  });

  it("refuses training-scope writes and incorrect registry authority", () => {
    const payload = JSON.stringify(launchRegistry());
    fixture.scope = "training";
    expect(() => importProductionCypressLaunchMatrix(payload))
      .toThrow("CYPRESS_LAUNCH_PRODUCTION_OPERATIONAL_ONLY");
    fixture.scope = "operational";
    const wrong = launchRegistry();
    wrong.metadata.work_item = "UNRELATED";
    expect(() => parseAuthoritativeCypressRegistry(JSON.stringify(wrong)))
      .toThrow("CYPRESS_REGISTRY_AUTHORITY_MISMATCH");
  });

  it("rejects a missing action, modified priority, or released admission hold", () => {
    const missing = launchRegistry();
    missing.actions.pop();
    expect(() => parseAuthoritativeCypressRegistry(JSON.stringify(missing)))
      .toThrow("CYPRESS_LAUNCH_REQUIRES_40_ACTIONS");
    const changed = launchRegistry();
    changed.actions[0].priority = "P3";
    expect(() => parseAuthoritativeCypressRegistry(JSON.stringify(changed)))
      .toThrow("CYPRESS_LAUNCH_UNEXPECTED_PRIORITY_DISTRIBUTION");
    const opened = launchRegistry();
    opened.actions.find((a) => a.id === "Q04")!.status = "Planned";
    expect(() => parseAuthoritativeCypressRegistry(JSON.stringify(opened)))
      .toThrow("CYPRESS_FIRST_ADMISSION_HOLD_REQUIRED");
  });

  it("rejects any rows outside the official 40-action namespace", () => {
    const payload = JSON.stringify(launchRegistry());
    importProductionCypressLaunchMatrix(payload);
    fixture.db!.prepare(
      "INSERT INTO work_queue (id,task_title,task_type,priority,status,entity_type,entity_id,evidence_required) " +
      "VALUES ('extra','Foreign','general','low','pending',?,'Z99',1)"
    ).run(CYPRESS_LAUNCH_ENTITY_TYPE);
    expect(() => importProductionCypressLaunchMatrix(payload))
      .toThrow("CYPRESS_LAUNCH_READBACK_INCOMPLETE_OR_DUPLICATE");
  });
});
