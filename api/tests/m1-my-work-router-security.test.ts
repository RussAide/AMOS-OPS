/**
 * M1.8 restricted/privileged route tests using ephemeral SQLite and synthetic identities.
 * No live accounts, databases, or Protected Health Information are accessed.
 */
import Database from "better-sqlite3";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ db: null as Database.Database | null }));
vi.mock("../queries/connection", () => ({
  sqlite: new Proxy({}, {
    get(_target, key) {
      if (!fixture.db) throw new Error("M1_MY_WORK_TEST_DB_NOT_READY");
      const value: unknown = Reflect.get(fixture.db, key);
      return typeof value === "function" ? value.bind(fixture.db) : value;
    },
  }),
  currentDataScope: () => "operational",
}));
vi.mock("../lib/env", () => ({
  env: { isProduction: false, isStaging: true },
  assertSyntheticScenarioRuntime: () => undefined,
}));
vi.mock("../middleware", async () => {
  const { initTRPC } = await import("@trpc/server");
  const t = initTRPC.context<{
    req: Request;
    resHeaders: Headers;
    user: { id: string; email: string; role: string };
  }>().create();
  return {
    createRouter: t.router,
    authedQuery: t.procedure,
    adminQuery: t.procedure,
    auditLog: vi.fn(),
  };
});
import { m1Router } from "../routers/m1";

function caller(role: string, id = "worker-a") {
  return m1Router.createCaller({
    req: new Request("https://amos-ops-staging.up.railway.app/api/trpc"),
    resHeaders: new Headers(),
    user: { id, email: id + "@example.invalid", role, firstName: "Synthetic", lastName: "Tester" },
  });
}
const restricted = () => caller("training-coordinator", "worker-a");
const leadership = () => caller("managing-director", "leader-1");
const other = () => caller("logistics-coordinator", "worker-b");

function rows(): Array<{ id: string; assigned_to: string | null; status: string }> {
  return fixture.db!.prepare("SELECT id, assigned_to, status FROM work_queue ORDER BY id")
    .all() as Array<{ id: string; assigned_to: string | null; status: string }>;
}

beforeEach(() => {
  const db = new Database(":memory:");
  db.exec([
    "CREATE TABLE work_queue (id TEXT PRIMARY KEY, task_title TEXT, task_type TEXT, description TEXT,",
    "priority TEXT, status TEXT, assigned_to TEXT, assigned_by TEXT, entity_type TEXT,",
    "entity_id TEXT, evidence_required INTEGER, evidence_uploaded INTEGER, workflow_id TEXT,",
    "due_date TEXT, completed_at TEXT, completed_by TEXT, escalation_level INTEGER,",
    "escalated_at TEXT, escalation_reason TEXT, created_at TEXT);",
    "CREATE TABLE task_evidence (id TEXT PRIMARY KEY, task_id TEXT, file_name TEXT,",
    "file_path TEXT, evidence_type TEXT, uploaded_by TEXT, uploaded_at TEXT);",
    "CREATE TABLE workflow_audit_log (id TEXT PRIMARY KEY, instance_id TEXT,",
    "action TEXT, actor TEXT, details TEXT, created_at TEXT);",
    "CREATE TABLE workflow_definitions (id TEXT PRIMARY KEY, workflow_id TEXT UNIQUE,",
    "workflow_name TEXT, category TEXT, is_active INTEGER DEFAULT 1, created_at TEXT);",
    "CREATE TABLE evidence_gates (id TEXT PRIMARY KEY, workflow_id TEXT, gate_name TEXT,",
    "evidence_type TEXT, required INTEGER, sort_order INTEGER DEFAULT 0, created_at TEXT,",
    "UNIQUE(workflow_id, gate_name));",
    "CREATE TABLE reassignment_log (id TEXT PRIMARY KEY, task_id TEXT, old_assignee TEXT,",
    "new_assignee TEXT, reason TEXT, reassigned_by TEXT, created_at TEXT);",
    "CREATE TABLE notifications (id TEXT PRIMARY KEY, user_id TEXT, type TEXT, title TEXT,",
    "message TEXT, person_name TEXT, module_name TEXT, action_href TEXT,",
    "is_read INTEGER, created_at TEXT);",
    "CREATE TABLE escalation_log (id TEXT PRIMARY KEY, task_id TEXT, previous_level INTEGER,",
    "new_level INTEGER, reason TEXT, escalated_by TEXT, notification_sent INTEGER, created_at TEXT);",
  ].join("\n"));
  const insert = db.prepare(
    "INSERT INTO work_queue " +
    "(id, task_title, task_type, priority, status, assigned_to, assigned_by, " +
    "evidence_required, evidence_uploaded, due_date, escalation_level, created_at) " +
    "VALUES (?, ?, 'general', 'medium', 'pending', ?, 'leader-1@example.invalid', " +
    "0, 0, '2026-12-03', 0, datetime('now'))"
  );
  insert.run("work-own-id", "Own ID assignment", "worker-a");
  insert.run("work-own-email", "Own email assignment", "WORKER-A@EXAMPLE.INVALID");
  insert.run("work-other", "Another worker's task", "worker-b");
  insert.run("work-unassigned", "Unassigned task", null);
  fixture.db = db;
});
afterEach(() => { fixture.db?.close(); fixture.db = null; });

describe("M1.8 My Work actual route security with synthetic user identities", () => {
  it("scopes direct task lists to the authenticated assignee", async () => {
    expect((await restricted().getWorkQueue()).map((t) => t.id).sort())
      .toEqual(["work-own-email", "work-own-id"]);
    expect(await restricted().getWorkQueue({ assignedTo: "worker-b" })).toEqual([]);
    expect((await restricted().getWorkQueue({ assignedTo: "worker-a" })).map((t) => t.id))
      .toEqual(["work-own-id"]);
  });

  it("scopes grouped workflow tasks and counts without leaking unrelated work", async () => {
    const result = await restricted().getWorkQueueGrouped();
    expect(result.stats.total).toBe(2);
    expect(result.workflows.flatMap((w) => w.tasks.map((t) => t.id)).sort())
      .toEqual(["work-own-email", "work-own-id"]);
    const spoofed = await restricted().getWorkQueueGrouped({ assignedTo: "worker-b" });
    expect(spoofed.stats.total).toBe(0);
    expect(spoofed.workflows).toEqual([]);
  });

  it("denies unassigned and another person's work across four direct action procedures", async () => {
    for (const taskId of ["work-other", "work-unassigned"]) {
      await expect(restricted().claimWorkTask({ taskId })).rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(restricted().addWorkTaskComment({ taskId, comment: "Unauthorized." }))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(restricted().completeWorkTask({ taskId, evidenceUploaded: true }))
        .rejects.toMatchObject({ code: "FORBIDDEN" });
      await expect(restricted().transitionTaskStatus({
        taskId, fromStatus: "pending", toStatus: "completed", evidenceProvided: true,
      })).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
    expect(rows().every((r) => r.status === "pending")).toBe(true);
  });

  it("permits an explicitly assigned user to claim, comment and complete own task", async () => {
    expect((await restricted().claimWorkTask({ taskId: "work-own-email" })).task.status)
      .toBe("in-progress");
    expect((await restricted().addWorkTaskComment({
      taskId: "work-own-email", comment: "Assigned review complete.",
    })).success).toBe(true);
    expect((await restricted().completeWorkTask({
      taskId: "work-own-email", evidenceUploaded: true,
    })).success).toBe(true);
    expect(rows().find((r) => r.id === "work-own-email")?.status).toBe("completed");
    expect(rows().find((r) => r.id === "work-other")?.status).toBe("pending");
  });

  it("blocks restricted task creation, escalation and reassignment", async () => {
    await expect(restricted().createWorkTask({
      taskTitle: "Unauthorized delegation", taskType: "general", assignedTo: "worker-b",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(restricted().checkEscalation()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(restricted().escalateWorkTask({
      taskId: "work-own-id", reason: "Unauthorized escalation",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(restricted().reassignWorkTask({
      taskId: "work-own-id", newAssigneeId: "worker-b", reason: "Unauthorized reassignment",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(rows().find((r) => r.id === "work-own-id")?.assigned_to).toBe("worker-a");
  });

  it("allows enterprise leadership to view, create and delegate tasks", async () => {
    expect((await leadership().getWorkQueue()).map((t) => t.id)).toHaveLength(4);
    const created = await leadership().createWorkTask({
      taskTitle: "Approved Executive Office assignment",
      taskType: "general", assignedTo: "worker-a",
    });
    expect(created.success).toBe(true);
    const moved = await leadership().reassignWorkTask({
      taskId: "work-other", newAssigneeId: "worker-a",
      reason: "Approved synthetic leadership delegation",
    });
    expect(moved.success).toBe(true);
    expect((await restricted().getWorkQueue()).map((t) => t.id).sort())
      .toEqual(["work-other", "work-own-email", "work-own-id", created.id].sort());
  });

  it("denies a different restricted worker access to an Executive Office assignment", async () => {
    await expect(other().claimWorkTask({ taskId: "work-own-id" }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(other().addWorkTaskComment({
      taskId: "work-own-id", comment: "Cross-team access attempt.",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
