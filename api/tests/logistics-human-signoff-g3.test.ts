/**
 * G3: real existing Logistics request, requester verification and manager
 * closeout procedures exercised together. Synthetic SQLite database only.
 * Agent cannot substitute for the requester or the manager at either gate.
 */
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ db: null as Database.Database | null }));
const managerId = "11111111-1111-4111-8111-111111111111";
const requesterId = "22222222-2222-4222-8222-222222222222";
const otherId = "33333333-3333-4333-8333-333333333333";
const coordinatorId = "44444444-4444-4444-8444-444444444444";

vi.mock("../queries/connection", () => ({
  sqlite: new Proxy({}, {
    get(_target, key) {
      if (!fixture.db) throw new Error("G3_TEST_DB_NOT_READY");
      const value: unknown = Reflect.get(fixture.db, key);
      return typeof value === "function" ? value.bind(fixture.db) : value;
    },
  }),
  currentDataScope: () => "training",
  runWithDataScope: (_scope: string, fn: () => unknown) => fn(),
}));

vi.mock("../security/identity", () => ({
  resolveIdentityUser: (req: Request) => {
    const name = req.headers.get("x-g3-synthetic-actor");
    const all: Record<string, { id: string; role: string; email: string }> = {
      manager: { id: managerId, role: "logistics-manager", email: "manager@example.invalid" },
      requester: { id: requesterId, role: "program-director", email: "requester@example.invalid" },
      other: { id: otherId, role: "program-director", email: "other@example.invalid" },
      coordinator: { id: coordinatorId, role: "logistics-coordinator", email: "coordinator@example.invalid" },
    };
    const match = name ? all[name] : undefined;
    return match ? { ...match, firstName: "Synthetic", lastName: name,
      accessStatus: "training", isActive: true, department: "QA" } : null;
  },
  resolveRequestedDataScope: () => "training",
}));

// The root router imports M2 tables eagerly; defer import until the synthetic DB is initialized.
import {
  getLogisticsRequest,
  listLogisticsEvents,
  updateLogisticsRequest,
} from "../services/gad-logistics";
import { LOGISTICS_ID } from "../agents/prime-logistics-delegation";

function context(actor: "manager" | "requester" | "other" | "coordinator" | "agent") {
  return {
    req: new Request("http://localhost/api/trpc", {
      headers: { "x-g3-synthetic-actor": actor },
    }),
    resHeaders: new Headers(),
  };
}
function migrate(db: Database.Database, filename: string) {
  const source = readFileSync(path.join(process.cwd(), "db/migrations", filename), "utf8");
  for (const sql of source.split("--> statement-breakpoint")) {
    if (sql.trim()) db.exec(sql);
  }
}
const evidence =
  "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/SYNTHETIC-QA-EVIDENCE";

describe("G3 Logistics requester verification and human-only closeout", () => {
  beforeEach(() => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    migrate(db, "0011_gad_logistics_r1.sql");
    migrate(db, "0012_gad_logistics_r2_workplans.sql");
    db.exec("CREATE TABLE workflow_audit_log (" +
      "id TEXT, action TEXT, actor TEXT, details TEXT, created_at TEXT)");
    db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, role TEXT, is_active INTEGER, access_status TEXT)");
    for (const [id, role] of [
      [managerId, "logistics-manager"],
      [requesterId, "program-director"],
      [otherId, "program-director"],
      [coordinatorId, "logistics-coordinator"],
    ]) db.prepare("INSERT INTO users (id, first_name, last_name, role, is_active, access_status) VALUES (?, 'Synthetic', 'G3 QA', ?, 1, 'training')").run(id, role);
    fixture.db = db;
  });
  afterEach(() => {
    fixture.db?.close();
    fixture.db = null;
  });

  it("refuses agent and unrelated person sign-off, allows requester verify then manager close", async () => {
    const { appRouter } = await import("../router");
    const requester = appRouter.createCaller(context("requester")).logistics;
    const other = appRouter.createCaller(context("other")).logistics;
    const manager = appRouter.createCaller(context("manager")).gad;
    const agentAsHuman = appRouter.createCaller(context("agent")).logistics;
    const created = await requester.createRequest({
      serviceType: "facilities", title: "SYNTHETIC QA: exterior lock",
      requirement: "SYNTHETIC QA: test complete evidence and requester control",
      priority: "priority",
    });
    expect(created.requester_user_id).toBe(requesterId);
    expect(created.status).toBe("submitted");

    const triaged = await manager.approveLogisticsDisposition({
      id: created.id, action: "triage", priority: "priority",
    });
    expect(triaged?.logistics_manager_id).toBe(managerId);

    const assigned = await manager.approveLogisticsDisposition({
      id: created.id, action: "assign", coordinatorId,
    });
    expect(assigned?.logistics_coordinator_id).toBe(coordinatorId);

    // The independent agent test covers the actual external boundary. Reuse
    // the same underlying event contract here to exercise human approval.
    updateLogisticsRequest({
      id: created.id,
      patch: { status: "ready_for_verification", verificationStatus: "pending" },
      event: {
        eventType: "evidence_linked", actorUserId: LOGISTICS_ID,
        actorRole: "amos-prime-delegated-logistics",
        evidenceReference: evidence,
        note: "Synthetic QA completion for human sign-off",
        toStatus: "ready_for_verification",
      },
    });
    expect(getLogisticsRequest(created.id)?.verification_status).toBe("pending");

    await expect(manager.approveLogisticsDisposition({
      id: created.id, action: "close", closureSummary: "Not yet verified",
    })).rejects.toThrow("Requester verification is required");
    await expect(other.recordMyVerification({
      id: created.id, outcome: "verified",
    })).rejects.toThrow("Logistics request not found");
    await expect(agentAsHuman.recordMyVerification({
      id: created.id, outcome: "verified",
    })).rejects.toThrow("Unauthorized");

    const verified = await requester.recordMyVerification({
      id: created.id, outcome: "verified",
      note: "Synthetic requester confirms evidence; not a real facility approval",
    });
    expect(verified?.verification_status).toBe("verified");
    expect(verified?.verification_owner_id).toBe(requesterId);

    const closed = await manager.approveLogisticsDisposition({
      id: created.id, action: "close",
      closureSummary: "Synthetic test only: requester verified; manager closes",
    });
    expect(closed?.status).toBe("closed");
    expect(closed?.closed_at).not.toBeNull();
    const events = listLogisticsEvents(created.id);
    expect(events.map(x => x.event_type)).toEqual(
      expect.arrayContaining(["submitted", "triaged", "assigned", "evidence_linked", "verification_recorded", "closed"]),
    );
    expect(events.find(x => x.event_type === "evidence_linked")?.actor_user_id)
      .toBe(LOGISTICS_ID);
    expect(events.find(x => x.event_type === "verification_recorded")?.actor_user_id)
      .toBe(requesterId);
    expect(events.find(x => x.event_type === "closed")?.actor_user_id).toBe(managerId);
  });

  it("requester return-for-information reopens work and stops manager closure", async () => {
    const { appRouter } = await import("../router");
    const requester = appRouter.createCaller(context("requester")).logistics;
    const manager = appRouter.createCaller(context("manager")).gad;
    const created = await requester.createRequest({
      serviceType: "equipment", title: "SYNTHETIC QA: backup generator",
      requirement: "SYNTHETIC QA: demonstrate return-to-work loop",
      priority: "priority",
    });
    await manager.approveLogisticsDisposition({ id: created.id, action: "triage" });
    updateLogisticsRequest({
      id: created.id,
      patch: { status: "ready_for_verification", verificationStatus: "pending" },
      event: {
        eventType: "evidence_linked", actorUserId: LOGISTICS_ID,
        actorRole: "amos-prime-delegated-logistics",
        evidenceReference: evidence, toStatus: "ready_for_verification",
      },
    });
    const returned = await requester.recordMyVerification({
      id: created.id, outcome: "returned", note: "Work needs synthetic QA correction",
    });
    expect(returned?.status).toBe("in_progress");
    expect(returned?.verification_status).toBe("returned");
    await expect(manager.approveLogisticsDisposition({
      id: created.id, action: "close", closureSummary: "Must not close",
    })).rejects.toThrow("Only requests ready for verification can be closed");
    expect(getLogisticsRequest(created.id)?.closed_at).toBeNull();
    expect(listLogisticsEvents(created.id).at(-1)?.actor_user_id).toBe(requesterId);
  });
});
