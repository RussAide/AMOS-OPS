import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { Hono, type Context } from "hono";
import { z } from "zod";
import { env } from "../lib/env";
import { currentDataScope, runWithDataScope, sqlite } from "../queries/connection";
import {
  appendLogisticsEvent, getLogisticsRequest, getLogisticsWorkplanItem,
  listLogisticsRequests, listLogisticsWorkplanItems, updateLogisticsRequest,
  updateLogisticsWorkplanItem,
} from "../services/gad-logistics";
import { resolveIdentityUser, type IdentityUser } from "../security/identity";

export const PRIME_ID = "AMOS-PRIME-COMMAND";
export const LOGISTICS_ID = "AMOS-PRIME-LOGISTICS";
export type DelegateId = typeof PRIME_ID | typeof LOGISTICS_ID;
type DelegateRow = { agent_id: string; scope: string; key_hash: string; active: number; revoked_at: string | null };
const SHA256 = /^[0-9a-f]{64}$/i;

function requireTraining(): void {
  if (!env.isStaging || env.isProduction || currentDataScope() !== "training") {
    throw new Error("DELEGATION_STAGING_TRAINING_ONLY");
  }
}
function digest(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
function constantEqual(left: string, right: string): boolean {
  return SHA256.test(left) && SHA256.test(right) &&
    timingSafeEqual(Buffer.from(left, "hex"), Buffer.from(right, "hex"));
}
function audit(agent: string, action: string, target: string, outcome: string, detail = ""): void {
  sqlite.prepare(
    "INSERT INTO gad_agent_action_audit " +
    "(id, agent_id, action, resource_id, outcome, detail, occurred_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(randomUUID(), agent, action, target, outcome, detail, new Date().toISOString());
}
function principal(id: DelegateId): DelegateRow | undefined {
  return sqlite.prepare("SELECT * FROM gad_agent_delegated_identities WHERE agent_id = ?")
    .get(id) as DelegateRow | undefined;
}

/** Idempotent module-owned identity registry. Revocation survives restarts. */
export function initializeDelegatedAgents(settings: {
  primeKeyHash?: string;
  logisticsKeyHash?: string;
}): { created: number; retained: number } {
  requireTraining();
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS gad_agent_delegated_identities (" +
    "agent_id TEXT PRIMARY KEY, scope TEXT NOT NULL, key_hash TEXT NOT NULL, " +
    "active INTEGER NOT NULL CHECK (active IN (0,1)), revoked_at TEXT, created_at TEXT NOT NULL);" +
    "CREATE TABLE IF NOT EXISTS gad_agent_action_audit (" +
    "id TEXT PRIMARY KEY, agent_id TEXT NOT NULL, action TEXT NOT NULL, " +
    "resource_id TEXT NOT NULL, outcome TEXT NOT NULL, detail TEXT NOT NULL, occurred_at TEXT NOT NULL);" +
    "CREATE INDEX IF NOT EXISTS idx_gad_agent_action_audit_actor " +
    "ON gad_agent_action_audit(agent_id, occurred_at);"
  );
  let created = 0, retained = 0;
  const specs: Array<[DelegateId, string, string | undefined]> = [
    [PRIME_ID, "enterprise-coordination-summary", settings.primeKeyHash],
    [LOGISTICS_ID, "adolbi-gad-logistics", settings.logisticsKeyHash],
  ];
  for (const [id, scope, suppliedHash] of specs) {
    if (!suppliedHash) continue;
    if (!SHA256.test(suppliedHash)) throw new Error("DELEGATION_INVALID_HASH");
    const hash = suppliedHash.toLowerCase();
    const current = principal(id);
    if (current) {
      if (current.scope !== scope || !constantEqual(current.key_hash, hash)) {
        throw new Error("DELEGATION_ROTATION_REQUIRES_CONTROLLED_ACTION");
      }
      retained++;
      continue;
    }
    sqlite.prepare("INSERT INTO gad_agent_delegated_identities " +
      "(agent_id, scope, key_hash, active, created_at) VALUES (?, ?, ?, 1, ?)")
      .run(id, scope, hash, new Date().toISOString());
    created++;
  }
  return { created, retained };
}
export function verifyDelegate(id: DelegateId, key?: string): boolean {
  requireTraining();
  const p = principal(id);
  return Boolean(p && p.active === 1 && !p.revoked_at && key &&
    key.length >= 32 && key.length <= 256 && constantEqual(p.key_hash, digest(key)));
}
export function revokeDelegate(id: DelegateId, human: IdentityUser): boolean {
  requireTraining();
  if (!["managing-director", "super-admin"].includes(human.role) ||
      human.accessStatus !== "cleared") {
    audit(human.id, "revoke", id, "denied", "Human privilege required");
    return false;
  }
  const changed = sqlite.prepare(
    "UPDATE gad_agent_delegated_identities SET active = 0, revoked_at = ? " +
    "WHERE agent_id = ? AND active = 1"
  ).run(new Date().toISOString(), id).changes === 1;
  audit(human.id, "revoke", id, changed ? "allowed" : "denied");
  return changed;
}

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("assign"), requestId: z.string().uuid(), coordinatorId: z.string().uuid() }),
  z.object({ action: z.literal("schedule"), requestId: z.string().uuid(),
    workplanItemId: z.string().uuid(), plannedFor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    dueAt: z.string().datetime().nullable().optional() }),
  z.object({ action: z.literal("blocker"), requestId: z.string().uuid(),
    dependencyType: z.string().min(3).max(120), dependencyOwner: z.string().min(3).max(160),
    note: z.string().min(3).max(400) }),
  z.object({ action: z.literal("evidence"), requestId: z.string().uuid(),
    evidenceReference: z.string().url().max(1000) }),
  z.object({ action: z.literal("submit"), requestId: z.string().uuid(),
    evidenceReference: z.string().url().max(1000), note: z.string().min(3).max(400) }),
]);
export type DelegatedAction = z.infer<typeof inputSchema>;
class DelegationError extends Error {
  constructor(readonly code: string, readonly status: 400 | 404 | 409 | 422 = 422) {
    super(code);
  }
}
function evidenceReference(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === "adolbi.sharepoint.com" &&
        url.pathname.startsWith("/sites/CypressGRO/")) return value;
  } catch { /* Invalid URL. */ }
  throw new DelegationError("SHAREPOINT_EVIDENCE_REQUIRED");
}
export function executeDelegatedAction(input: DelegatedAction) {
  requireTraining();
  const request = getLogisticsRequest(input.requestId);
  if (!request) throw new DelegationError("REQUEST_NOT_FOUND", 404);
  if (["closed", "cancelled", "declined", "ready_for_verification"].includes(request.status)) {
    throw new DelegationError("REQUEST_NOT_EDITABLE", 409);
  }
  const attributedEvent = {
    actorUserId: LOGISTICS_ID,
    actorRole: "amos-prime-delegated-logistics",
  };
  let result: unknown;
  if (input.action === "assign") {
    const staff = sqlite.prepare(
      "SELECT role, is_active, access_status FROM users WHERE id = ?"
    ).get(input.coordinatorId) as
      | { role: string; is_active: number; access_status: string } | undefined;
    if (!staff || staff.role !== "logistics-coordinator" ||
        staff.is_active !== 1 || !["cleared", "training"].includes(staff.access_status)) {
      throw new DelegationError("ACTIVE_COORDINATOR_REQUIRED");
    }
    result = updateLogisticsRequest({
      id: request.id,
      patch: { logisticsCoordinatorId: input.coordinatorId, status: "assigned",
        assignedAt: new Date().toISOString() },
      event: { eventType: "assigned", ...attributedEvent, toStatus: "assigned",
        note: "Delegated assignment; human supervisor retains final authority" },
    });
  } else if (input.action === "schedule") {
    const work = getLogisticsWorkplanItem(input.workplanItemId);
    if (!work || work.request_id !== request.id ||
        ["cancelled", "completed"].includes(work.status)) {
      throw new DelegationError("WORKPLAN_NOT_EDITABLE", 409);
    }
    result = updateLogisticsWorkplanItem({
      id: work.id, plannedFor: input.plannedFor, dueAt: input.dueAt,
    });
    appendLogisticsEvent({
      requestId: request.id, eventType: "status_changed", ...attributedEvent,
      note: "Schedule revised: " + work.id, fromStatus: request.status, toStatus: request.status,
    });
  } else if (input.action === "blocker") {
    result = updateLogisticsRequest({
      id: request.id,
      patch: { status: "pending_dependency", dependencyType: input.dependencyType,
        dependencyOwner: input.dependencyOwner },
      event: { eventType: "dependency_recorded", ...attributedEvent,
        toStatus: "pending_dependency", note: input.note },
    });
  } else if (input.action === "evidence") {
    result = appendLogisticsEvent({
      requestId: request.id, eventType: "evidence_linked", ...attributedEvent,
      fromStatus: request.status, toStatus: request.status,
      evidenceReference: evidenceReference(input.evidenceReference),
      note: "Evidence linked for review",
    });
  } else {
    result = updateLogisticsRequest({
      id: request.id,
      patch: { status: "ready_for_verification", verificationStatus: "pending",
        completedAt: new Date().toISOString() },
      event: { eventType: "evidence_linked", ...attributedEvent,
        toStatus: "ready_for_verification", evidenceReference: evidenceReference(input.evidenceReference),
        note: input.note + "; submitted for HUMAN sign-off, not approved" },
    });
  }
  audit(LOGISTICS_ID, input.action, request.id, "allowed", "Human sign-off reserved");
  return { actorId: LOGISTICS_ID, action: input.action, requestId: request.id, result };
}
function safeCoordinationOverview() {
  requireTraining();
  const launch = sqlite.prepare(
    "SELECT priority, status, COUNT(*) AS count FROM work_queue " +
    "WHERE entity_type = 'adolbi_cypress_launch_2026' GROUP BY priority, status"
  ).all();
  const logistics = sqlite.prepare(
    "SELECT origin_division AS division, status, COUNT(*) AS count FROM " +
    "gad_logistics_requests GROUP BY origin_division, status"
  ).all();
  audit(PRIME_ID, "coordination_overview", "cypress", "allowed");
  return { actorId: PRIME_ID, trainingOnly: true, launch, logistics };
}

function rejectAccess(c: Context, id: DelegateId, action: string): Response | null {
  if (!env.isStaging || env.isProduction) return c.json({ error: "STAGING_ONLY" }, 404);
  const valid = runWithDataScope("training", () =>
    verifyDelegate(id, c.req.header("x-amos-delegation-key")));
  if (valid) return null;
  runWithDataScope("training", () =>
    audit(id, action, "authorization", "denied", "Invalid or revoked credential"));
  return c.json({ error: "DELEGATION_DENIED" }, 401);
}
export function createPrimeDelegationGateway(): Hono {
  const app = new Hono();
  app.get("/prime/overview", (c) => {
    const denied = rejectAccess(c, PRIME_ID, "overview");
    if (denied) return denied;
    return c.json(runWithDataScope("training", safeCoordinationOverview));
  });
  app.get("/logistics/queue", (c) => {
    const denied = rejectAccess(c, LOGISTICS_ID, "queue");
    if (denied) return denied;
    const data = runWithDataScope("training", () => {
      requireTraining();
      const requests = listLogisticsRequests().map((r) => ({
        id: r.id, requestNumber: r.request_number, title: r.title,
        originDivision: r.origin_division, status: r.status,
        priority: r.priority, assignedCoordinatorId: r.logistics_coordinator_id,
        verificationStatus: r.verification_status, needBy: r.need_by,
      }));
      const workplans = listLogisticsWorkplanItems().map((w) => ({
        id: w.id, requestId: w.request_id, ownerUserId: w.owner_user_id,
        status: w.status, plannedFor: w.planned_for, dueAt: w.due_at,
      }));
      audit(LOGISTICS_ID, "queue_read", "gad-logistics", "allowed");
      return { actorId: LOGISTICS_ID, requests, workplans };
    });
    return c.json(data);
  });
  app.post("/logistics/action", async (c) => {
    const denied = rejectAccess(c, LOGISTICS_ID, "action");
    if (denied) return denied;
    const parsed = inputSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "INVALID_ACTION" }, 400);
    try {
      return c.json(runWithDataScope("training", () =>
        executeDelegatedAction(parsed.data)));
    } catch (error) {
      const failure = error instanceof DelegationError ? error.code : "ACTION_FAILED";
      runWithDataScope("training", () =>
        audit(LOGISTICS_ID, parsed.data.action, parsed.data.requestId, "denied", failure));
      return c.json({ error: failure },
        error instanceof DelegationError ? error.status : 500);
    }
  });
  app.post("/human/revoke", async (c) => {
    if (!env.isStaging || env.isProduction) return c.json({ error: "STAGING_ONLY" }, 404);
    const human = resolveIdentityUser(c.req.raw);
    if (!human) return c.json({ error: "HUMAN_SESSION_REQUIRED" }, 401);
    const parsed = z.object({ agentId: z.enum([PRIME_ID, LOGISTICS_ID]) })
      .safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "INVALID_AGENT" }, 400);
    const revoked = runWithDataScope("training", () =>
      revokeDelegate(parsed.data.agentId, human));
    return c.json({ revoked, actorId: human.id, agentId: parsed.data.agentId },
      revoked ? 200 : 403);
  });
  return app;
}
