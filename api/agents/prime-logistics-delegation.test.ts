import Database from "better-sqlite3";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ db: null as Database.Database | null }));
vi.mock("../queries/connection", () => ({
  sqlite: new Proxy({}, {
    get(_target, key) {
      if (!fixture.db) throw new Error("TEST_DATABASE_NOT_READY");
      const value: unknown = Reflect.get(fixture.db, key);
      return typeof value === "function" ? value.bind(fixture.db) : value;
    },
  }),
  currentDataScope: () => "training",
  runWithDataScope: (_scope: string, callback: () => unknown) => callback(),
}));
vi.mock("../lib/env", () => ({
  env: { isStaging: true, isProduction: false },
}));
vi.mock("../security/identity", () => ({
  bearerTokenFromRequest: vi.fn((request: Request) =>
    request.headers.get("authorization") === "Bearer human-test-session" ? "human-test-session" : null),
  identityService: {
    getSession: vi.fn((token: string) =>
      token === "human-test-session"
        ? { id: "eghosa-test-actor", role: "managing-director", accessStatus: "cleared" }
        : null),
  },
}));

import {
  PRIME_ID, LOGISTICS_ID, createPrimeDelegationGateway, initializeDelegatedAgents,
  verifyDelegate, issueStagingScenarioCredential, revokeStagingScenarioCredential,
  ensureStagingTrainingLogisticsSchema,
} from "./prime-logistics-delegation";
import {
  createLogisticsRequest, createLogisticsWorkplanItem, getLogisticsRequest,
  listLogisticsEvents, getLogisticsWorkplanItem,
} from "../services/gad-logistics";

const primeKey = "P".repeat(48);
const logisticsKey = "L".repeat(48);
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const coordinatorId = "11111111-1111-4111-8111-111111111111";
const managerId = "33333333-3333-4333-8333-333333333333";

function loadMigration(db: Database.Database, filename: string) {
  const source = readFileSync(path.join(process.cwd(), "db/migrations", filename), "utf8");
  for (const statement of source.split("--> statement-breakpoint")) {
    if (statement.trim()) db.exec(statement);
  }
}
function setup() {
  const db = new Database(":memory:");
  db.pragma("foreign_keys = ON");
  loadMigration(db, "0011_gad_logistics_r1.sql");
  loadMigration(db, "0012_gad_logistics_r2_workplans.sql");
  db.exec("CREATE TABLE users (id TEXT PRIMARY KEY, role TEXT, is_active INTEGER, access_status TEXT)");
  db.exec("CREATE TABLE work_queue (priority TEXT, status TEXT, entity_type TEXT, entity_id TEXT, task_title TEXT, evidence_required INTEGER, evidence_uploaded INTEGER, due_date TEXT)");
  db.prepare("INSERT INTO users VALUES (?, 'logistics-coordinator', 1, 'training')")
    .run(coordinatorId);
  db.prepare("INSERT INTO users VALUES (?, 'logistics-manager', 1, 'training')")
    .run(managerId);
  db.prepare("INSERT INTO work_queue (priority, status, entity_type) VALUES ('urgent', 'pending', 'adolbi_cypress_launch_2026')").run();
  fixture.db = db;
  initializeDelegatedAgents({ primeKeyHash: digest(primeKey), logisticsKeyHash: digest(logisticsKey) });
  return db;
}
function makeRequest(division: "gro" | "bhc" = "gro") {
  const request = createLogisticsRequest({
    originDivision: division,
    requesterUserId: "human-requester-1",
    requesterRole: "program-director",
    serviceType: "facilities",
    title: "Synthetic Staging operational request",
    requirement: "Demonstrate controlled logistics workflow with synthetic records",
    priority: "priority",
  });
  fixture.db!.prepare("UPDATE gad_logistics_requests SET logistics_manager_id = ? WHERE id = ?")
    .run(managerId, request.id);
  return getLogisticsRequest(request.id)!;
}
function header(key: string) {
  return { "x-amos-delegation-key": key };
}
function postAction(app: ReturnType<typeof createPrimeDelegationGateway>, key: string, data: object) {
  return app.request("/logistics/action", {
    method: "POST",
    headers: { ...header(key), "content-type": "application/json" },
    body: JSON.stringify(data),
  });
}

describe("AMOS Prime / Adolbi GAD Logistics delegated Staging pilot", () => {
  beforeEach(setup);
  afterEach(() => {
    fixture.db?.close();
    fixture.db = null;
  });

  it("separates Prime enterprise coordination from Logistics execution", async () => {
    const app = createPrimeDelegationGateway();
    makeRequest("gro");
    makeRequest("bhc");
    const overview = await app.request("/prime/overview", { headers: header(primeKey) });
    expect(overview.status).toBe(200);
    const data = await overview.json();
    expect(data.actorId).toBe(PRIME_ID);
    expect(data.trainingOnly).toBe(true);
    expect(data.logistics.map((r: { division: string }) => r.division).sort())
      .toEqual(["bhc", "gro"]);
    expect(data.launch[0].count).toBe(1);
    expect(data.providerNetworkReadiness.referralGate).toBe("HOLD");
    expect(data.providerNetworkReadiness.authoritativeProviderNetworkConnected).toBe(false);
    expect(JSON.stringify(data)).not.toContain("Synthetic Staging operational request");
    expect((await app.request("/logistics/queue", { headers: header(primeKey) })).status)
      .toBe(401);
    expect((await app.request("/prime/overview", { headers: header(logisticsKey) })).status)
      .toBe(401);
    expect((await app.request("/logistics/queue", { headers: header(logisticsKey) })).status)
      .toBe(200);
    expect((await app.request("/clinical/referrals", { headers: header(logisticsKey) })).status)
      .toBe(404);
    expect((await app.request("/gad/approve", { headers: header(logisticsKey) })).status)
      .toBe(404);
  });

  it("reviews, assigns, reschedules, records a blocker and evidence, and submits for HUMAN approval", async () => {
    const app = createPrimeDelegationGateway();
    const request = makeRequest("gro");
    const workplan = createLogisticsWorkplanItem({
      requestId: request.id,
      ownerUserId: coordinatorId,
      ownerRole: "logistics-coordinator",
      title: "Synthetic supplier coordination action",
      actionType: "schedule",
      priority: "priority",
      plannedFor: "2026-11-24",
      createdBy: "human-owner-1",
    });
    const queue = await app.request("/logistics/queue", { headers: header(logisticsKey) });
    expect(queue.status).toBe(200);
    expect((await queue.json()).requests.some((r: { id: string }) => r.id === request.id))
      .toBe(true);
    const steps = [
      { action: "assign", requestId: request.id, coordinatorId },
      { action: "schedule", requestId: request.id,
        workplanItemId: workplan.id, plannedFor: "2026-11-25" },
      { action: "blocker", requestId: request.id,
        dependencyType: "vendor_capacity", dependencyOwner: "Vendor Desk",
        note: "Awaiting confirmed supplier availability" },
      { action: "evidence", requestId: request.id,
        evidenceReference: "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/test-evidence.pdf" },
      { action: "submit", requestId: request.id,
        evidenceReference: "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/test-evidence.pdf",
        note: "Completed synthetic coordination review" },
    ];
    for (const action of steps) {
      const result = await postAction(app, logisticsKey, action);
      expect(result.status, action.action + ": " + (await result.text())).toBe(200);
    }
    const after = getLogisticsRequest(request.id)!;
    expect(after.logistics_coordinator_id).toBe(coordinatorId);
    expect(after.status).toBe("ready_for_verification");
    expect(after.verification_status).toBe("pending");
    expect(after.closed_at).toBeNull();
    expect(getLogisticsWorkplanItem(workplan.id)?.planned_for).toBe("2026-11-25");
    const events = listLogisticsEvents(request.id);
    expect(events.filter((event) => event.actor_user_id === LOGISTICS_ID))
      .toHaveLength(5);
    const audited = fixture.db!.prepare(
      "SELECT action, agent_id, outcome FROM gad_agent_action_audit WHERE agent_id = ? ORDER BY occurred_at"
    ).all(LOGISTICS_ID) as Array<{ action: string; agent_id: string; outcome: string }>;
    const allowed = audited.filter((entry) => entry.outcome === "allowed");
    expect(allowed.map((entry) => entry.action)).toContain("queue_read");
    for (const action of steps) expect(allowed.map((e) => e.action)).toContain(action.action);
    expect((await postAction(app, logisticsKey, {
      action: "blocker", requestId: request.id, dependencyType: "new",
      dependencyOwner: "Vendor Desk", note: "No mutation after submission",
    })).status).toBe(409);
  });

  it("cannot assign any coordinator before a valid human Logistics Manager owns the request", async () => {
    const app = createPrimeDelegationGateway();
    const request = makeRequest();
    fixture.db!.prepare("UPDATE gad_logistics_requests SET logistics_manager_id = NULL WHERE id = ?")
      .run(request.id);
    const denied = await postAction(app, logisticsKey, {
      action: "assign", requestId: request.id, coordinatorId,
    });
    expect(denied.status).toBe(409);
    expect((await denied.json()).error).toBe("HUMAN_MANAGER_OWNERSHIP_REQUIRED");
    expect(getLogisticsRequest(request.id)?.logistics_coordinator_id).toBeNull();
    expect(fixture.db!.prepare("SELECT COUNT(*) AS count FROM gad_agent_action_audit " +
      "WHERE agent_id = ? AND action = 'assign' AND outcome = 'denied'").get(LOGISTICS_ID))
      .toMatchObject({ count: 1 });
  });

  it("requires valid staff assignments and authorized SharePoint evidence", async () => {
    const app = createPrimeDelegationGateway();
    const request = makeRequest();
    expect((await postAction(app, logisticsKey, {
      action: "assign", requestId: request.id,
      coordinatorId: "22222222-2222-4222-8222-222222222222",
    })).status).toBe(422);
    expect((await postAction(app, logisticsKey, {
      action: "evidence", requestId: request.id,
      evidenceReference: "https://evil.example.org/forged.pdf",
    })).status).toBe(422);
    expect(getLogisticsRequest(request.id)?.status).toBe("submitted");
  });

  it("denies agent-only revocation and enforces immediate revocation without restart", async () => {
    const app = createPrimeDelegationGateway();
    makeRequest();
    expect((await app.request("/human/revoke", {
      method: "POST",
      headers: { ...header(logisticsKey), "content-type": "application/json" },
      body: JSON.stringify({ agentId: LOGISTICS_ID }),
    })).status).toBe(401);
    const revocation = await app.request("/human/revoke", {
      method: "POST",
      headers: { authorization: "Bearer human-test-session", "content-type": "application/json" },
      body: JSON.stringify({ agentId: LOGISTICS_ID }),
    });
    expect(revocation.status).toBe(200);
    expect((await revocation.json()).revoked).toBe(true);
    expect(verifyDelegate(LOGISTICS_ID, logisticsKey)).toBe(false);
    expect((await app.request("/logistics/queue", { headers: header(logisticsKey) })).status)
      .toBe(401);
    const afterRestart = initializeDelegatedAgents({
      primeKeyHash: digest(primeKey), logisticsKeyHash: digest(logisticsKey),
    });
    expect(afterRestart).toEqual({ created: 0, retained: 2 });
    expect(verifyDelegate(LOGISTICS_ID, logisticsKey)).toBe(false);
    expect(verifyDelegate(PRIME_ID, primeKey)).toBe(true);
    expect((await app.request("/prime/overview", { headers: header(primeKey) })).status)
      .toBe(200);
    const audit = fixture.db!.prepare(
      "SELECT agent_id, action, outcome FROM gad_agent_action_audit WHERE action = 'revoke'"
    ).get() as { agent_id: string; action: string; outcome: string };
    expect(audit.agent_id).toBe("eghosa-test-actor");
    expect(audit.outcome).toBe("allowed");
  });

  it("restores only versioned GAD R1/R2 tables in a fresh staging training database", () => {
    const db = fixture.db!;
    db.exec("DROP TABLE gad_logistics_workplan_items");
    db.exec("DROP TABLE gad_logistics_events");
    db.exec("DROP TABLE gad_logistics_requests");
    const first = ensureStagingTrainingLogisticsSchema();
    expect(first).toEqual({ r1Applied: true, r2Applied: true, requests: 0, workplans: 0 });
    const again = ensureStagingTrainingLogisticsSchema();
    expect(again).toEqual({ r1Applied: false, r2Applied: false, requests: 0, workplans: 0 });
    const restored = makeRequest();
    expect(getLogisticsRequest(restored.id)?.status).toBe("submitted");
  });

  it("accepts ephemeral credentials and revokes them without changing the parent identity", async () => {
    const app = createPrimeDelegationGateway();
    const { key, credentialId } = issueStagingScenarioCredential(LOGISTICS_ID);
    expect(verifyDelegate(LOGISTICS_ID, key)).toBe(true);
    expect((await app.request("/logistics/queue", { headers: header(key) })).status).toBe(200);
    expect(revokeStagingScenarioCredential(LOGISTICS_ID, credentialId)).toBe(true);
    expect(verifyDelegate(LOGISTICS_ID, key)).toBe(false);
    expect((await app.request("/logistics/queue", { headers: header(key) })).status).toBe(401);
    expect(verifyDelegate(LOGISTICS_ID, logisticsKey)).toBe(true);
  });

  it("includes N01-N04 in the live Prime readiness crosswalk without claiming provider verification", async () => {
    const insert = fixture.db!.prepare(
      "INSERT INTO work_queue (priority, status, entity_type, entity_id, task_title, evidence_required, evidence_uploaded, due_date) " +
      "VALUES ('high', 'pending', 'adolbi_cypress_launch_2026', ?, ?, 1, 0, '2026-12-01')"
    );
    for (const id of ["N01", "N02", "N03", "N04"]) {
      insert.run(id, "Synthetic provider readiness " + id);
    }
    const app = createPrimeDelegationGateway();
    const response = await app.request("/prime/overview", { headers: header(primeKey) });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.providerNetworkReadiness.recordedActions).toBe(4);
    expect(data.providerNetworkReadiness.actions.map((a: { id: string }) => a.id))
      .toEqual(["N01", "N02", "N03", "N04"]);
    expect(data.providerNetworkReadiness.referralGate).toBe("HOLD");
    expect(data.providerNetworkReadiness.verifiedProviders).toBeNull();
    expect(data.providerNetworkReadiness.placementCrmConnected).toBe(false);
  });

  it("fails closed on key rotation without explicitly controlled re-provisioning", () => {
    expect(() => initializeDelegatedAgents({
      primeKeyHash: digest("new-prime-key-with-no-authority"), logisticsKeyHash: digest(logisticsKey),
    })).toThrow("DELEGATION_ROTATION_REQUIRES_CONTROLLED_ACTION");
  });
});
