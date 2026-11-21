/**
 * Focused Cypress Launch Matrix route tests against the existing M1 work queue.
 * Production identity, schemas and persistent records are never opened here.
 */
import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ db: null as Database.Database | null }));
vi.mock("../queries/connection", () => ({
  sqlite: new Proxy({}, {
    get(_target, key) {
      if (!fixture.db) throw new Error("LAUNCH_ROUTE_TEST_DB_NOT_READY");
      const value: unknown = Reflect.get(fixture.db, key);
      return typeof value === "function" ? value.bind(fixture.db) : value;
    },
  }),
  currentDataScope: () => "operational",
}));
vi.mock("../lib/env", () => ({
  env: { isProduction:true, isStaging:false },
  assertSyntheticScenarioRuntime: () => undefined,
}));
vi.mock("../middleware", async () => {
  const { initTRPC } = await import("@trpc/server");
  const t = initTRPC.context<{
    req: Request;
    resHeaders: Headers;
    user: {id:string;email:string;role:string};
  }>().create();
  return {
    createRouter: t.router,
    authedQuery: t.procedure,
    adminQuery: t.procedure,
    auditLog: vi.fn(),
  };
});

import { m1Router } from "../routers/m1";

const REPO = "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents";
function caller(role: string, userId = "user-1") {
  return m1Router.createCaller({
    req: new Request("https://amos-ops.com/api/trpc"),
    resHeaders: new Headers(),
    user: {id:userId,email:userId+"@example.invalid",role,firstName:"Synthetic",lastName:"Reviewer"},
  });
}

beforeEach(() => {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE work_queue (
      id TEXT PRIMARY KEY, task_title TEXT, task_type TEXT, description TEXT,
      priority TEXT, status TEXT, assigned_to TEXT, assigned_by TEXT,
      entity_type TEXT, entity_id TEXT, evidence_required INTEGER,
      evidence_uploaded INTEGER, workflow_id TEXT, due_date TEXT,
      completed_at TEXT, completed_by TEXT, escalation_level INTEGER, created_at TEXT
    );
    CREATE TABLE task_evidence (
      id TEXT PRIMARY KEY, task_id TEXT, file_name TEXT, file_path TEXT,
      evidence_type TEXT, uploaded_by TEXT, uploaded_at TEXT
    );
    CREATE TABLE workflow_audit_log (
      id TEXT PRIMARY KEY, instance_id TEXT, action TEXT, actor TEXT,
      details TEXT, created_at TEXT
    );
  `);
  const insert = db.prepare(
    "INSERT INTO work_queue (id,task_title,task_type,priority,status,entity_type,entity_id,evidence_required,evidence_uploaded,due_date) " +
    "VALUES (?, ?, 'general', 'urgent', 'pending', 'adolbi_cypress_launch_2026', ?, 1, 0, '2026-11-23')"
  );
  insert.run("ADL-LAUNCH-2026-G01", "[P0-01] G01 — Synthetic approval", "G01");
  insert.run("ADL-LAUNCH-2026-Q04", "[P3-40] Q04 — [FIRST ADMISSION HOLD] Synthetic", "Q04");
  fixture.db = db;
});
afterEach(() => { fixture.db?.close(); fixture.db = null; });

describe("Production Cypress Launch Matrix M1 role and human approval boundaries", () => {
  it("restricts the complete matrix to leadership; ordinary staff see only assigned tasks", async () => {
    expect(await caller("managing-director").getCypressLaunchQueue()).toHaveLength(2);
    await expect(caller("logistics-coordinator").getCypressLaunchQueue())
      .rejects.toThrow("requires enterprise leadership access");
    expect(await caller("logistics-coordinator").getWorkQueue()).toHaveLength(0);
    fixture.db!.prepare("UPDATE work_queue SET assigned_to = ? WHERE entity_id = 'G01'")
      .run("staff@example.invalid");
    expect(await caller("logistics-coordinator","staff").getWorkQueue())
      .toHaveLength(1);
    expect(await caller("super-admin").getWorkQueue()).toHaveLength(2);
  });

  it("denies generic completion and generic completion-status transition for controlled launch actions", async () => {
    const manager = caller("managing-director");
    await expect(manager.completeWorkTask({taskId:"ADL-LAUNCH-2026-G01",evidenceUploaded:true}))
      .rejects.toThrow("Complete this launch action through");
    await expect(manager.transitionTaskStatus({
      taskId:"ADL-LAUNCH-2026-G01",fromStatus:"pending",
      toStatus:"completed",evidenceProvided:true,
    })).rejects.toThrow("Complete this launch action through");
    await expect(manager.completeWorkTask({taskId:"ADL-LAUNCH-2026-Q04",evidenceUploaded:true}))
      .rejects.toThrow("First admission remains on HOLD");
  });

  it("records evidence, human approval, and audit lineage only for designated leadership", async () => {
    const input = {
      taskId:"ADL-LAUNCH-2026-G01",
      evidenceReference:REPO+"/evidence-G01.pdf",
      approvalReference:REPO+"/qualified-review-G01.pdf",
      reviewNote:"Reviewed source evidence and recorded the qualified sign-off reference.",
    };
    await expect(caller("logistics-coordinator").completeCypressLaunchTask(input))
      .rejects.toThrow("designated human leadership reviewer");
    await expect(caller("managing-director").completeCypressLaunchTask({
      ...input,approvalReference:"https://example.com/uncontrolled.pdf",
    })).rejects.toThrow("controlled Cypress GRO SharePoint");
    const completed = await caller("managing-director").completeCypressLaunchTask(input);
    expect(completed).toMatchObject({success:true,alreadyCompleted:false});
    const task = fixture.db!.prepare(
      "SELECT status, completed_by, evidence_uploaded FROM work_queue WHERE entity_id = 'G01'"
    ).get();
    expect(task).toEqual({
      status:"completed", completed_by:"user-1@example.invalid", evidence_uploaded:1,
    });
    const evidences = fixture.db!.prepare(
      "SELECT evidence_type FROM task_evidence WHERE task_id = ? ORDER BY evidence_type"
    ).all(input.taskId);
    expect(evidences).toEqual([
      {evidence_type:"launch-action-evidence"},{evidence_type:"launch-action-review"},
    ]);
    const audit = fixture.db!.prepare(
      "SELECT action FROM workflow_audit_log WHERE instance_id = ?"
    ).get(input.taskId);
    expect(audit).toEqual({action:"cypress-launch:human-evidence-review"});
    expect(await caller("managing-director").completeCypressLaunchTask(input))
      .toMatchObject({success:true,alreadyCompleted:true});
  });

  it("never releases Q04 through the human launch closure procedure", async () => {
    await expect(caller("managing-director").completeCypressLaunchTask({
      taskId:"ADL-LAUNCH-2026-Q04",
      evidenceReference:REPO+"/q04-evidence.pdf",
      approvalReference:REPO+"/q04-review.pdf",
      reviewNote:"The admission hold remains required until a separate Owner decision.",
    })).rejects.toThrow("First admission remains on HOLD");
    const status = fixture.db!.prepare("SELECT status FROM work_queue WHERE entity_id = 'Q04'").get();
    expect(status).toEqual({status:"pending"});
  });

  it("forbids direct creation of forged official launch actions", async () => {
    await expect(caller("managing-director").createWorkTask({
      taskTitle:"Fake official action",taskType:"general",
      entityType:"adolbi_cypress_launch_2026",entityId:"G02",
    })).rejects.toThrow("imported only from the authoritative registry");
  });

  it("prevents non-leadership users from changing a known controlled task", async () => {
    await expect(caller("logistics-coordinator").claimWorkTask({
      taskId:"ADL-LAUNCH-2026-G01",
    })).rejects.toThrow("requires leadership or an explicit assigned task");
  });
});
