/**
 * Staging-only independent Logistics agent adapter.
 *
 * Uses short-lived, signed GitHub Actions OIDC identity rather than a copied
 * owner session or long-lived agent secret. The trusted workflow runs on the
 * existing GitHub Actions infrastructure; all QA writes are synthetic and
 * isolated to AMOS-OPS Staging TRAINING. No Production or other tRPC access.
 *
 * This is an external machine-client connectivity test, not autonomous agent
 * authorization or permission to approve operational work.
 */
import { randomUUID } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { Hono } from "hono";

import { env } from "../lib/env";
import { loadRuntimeReleaseIdentity } from "../release-identity";
import { sqlite, runWithDataScope } from "../queries/connection";
import {
  createLogisticsRequest,
  createLogisticsWorkplanItem,
  getLogisticsRequest,
  listLogisticsRequests,
  listLogisticsEvents,
} from "../services/gad-logistics";
import {
  LOGISTICS_ID,
  executeDelegatedAction,
  delegatedActionSchema,
} from "./prime-logistics-delegation";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "amos-ops-staging-gad-logistics-agent";
const REPO = "RussAide/AMOS-OPS";
const BRANCH = "refs/heads/staging/amos-g3-oidc-agent-20261121";
const WORKFLOW = REPO + "/.github/workflows/amos-gad-independent-agent.yml@" + BRANCH;
const JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
  { timeoutDuration: 6000, cooldownDuration: 60000, cacheMaxAge: 600000 },
);

type AgentClaims = { runId: string; sourceSha: string; actor: string };
type FixtureRow = {
  run_id: string;
  request_id: string;
  coordinator_id: string;
  manager_id: string;
  workplan_id: string;
};

function requireStaging(): void {
  if (!env.isStaging || env.isProduction) {
    throw new Error("GITHUB_AGENT_STAGING_ONLY");
  }
}

function prepareFixtureRegistry(): void {
  sqlite.exec(
    "CREATE TABLE IF NOT EXISTS gad_agent_external_qa_fixture (" +
    "run_id TEXT PRIMARY KEY NOT NULL, request_id TEXT NOT NULL, " +
    "coordinator_id TEXT NOT NULL, manager_id TEXT NOT NULL, workplan_id TEXT NOT NULL, " +
    "created_at TEXT NOT NULL);",
  );
}

function audit(action: string, resource: string, allowed: boolean, runId: string): void {
  sqlite.prepare(
    "INSERT INTO gad_agent_action_audit " +
    "(id, agent_id, action, resource_id, outcome, detail, occurred_at) " +
    "VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(randomUUID(), LOGISTICS_ID, action, resource,
    allowed ? "allowed" : "denied", "github-oidc-run:" + runId,
    new Date().toISOString());
}

function active(): boolean {
  const row = sqlite.prepare(
    "SELECT active, revoked_at FROM gad_agent_delegated_identities WHERE agent_id = ?",
  ).get(LOGISTICS_ID) as { active: number; revoked_at: string | null } | undefined;
  return row?.active === 1 && !row.revoked_at;
}

async function authenticate(header: string | undefined): Promise<AgentClaims | null> {
  requireStaging();
  if (!header?.startsWith("Bearer ") || header.length > 8192) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["RS256"],
      clockTolerance: "10s",
      maxTokenAge: "6m",
    });
    if (payload.repository !== REPO ||
        payload.ref !== BRANCH ||
        payload.workflow_ref !== WORKFLOW ||
        payload.event_name !== "push" ||
        payload.runner_environment !== "github-hosted" ||
        typeof payload.run_id !== "string" ||
        !/^\d{5,20}$/.test(payload.run_id) ||
        typeof payload.sha !== "string" ||
        !/^[0-9a-f]{40}$/.test(payload.sha)) return null;
    // The independent runner must execute the SAME immutable source identity
    // as the live Staging service, not simply any future commit on the branch.
    const release = loadRuntimeReleaseIdentity();
    if (!release.verified || release.commitSha !== payload.sha) return null;
    const enabled = runWithDataScope("training", active);
    return enabled ? { runId: payload.run_id, sourceSha: payload.sha, actor: LOGISTICS_ID } : null;
  } catch {
    // A missing JWK, invalid signature, expired token or incorrect claim
    // always denies access. JWT contents are never logged or returned.
    return null;
  }
}

const evidence = "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/" +
  "06%20-%20GRO%20Operations%20%26%20Activation/" +
  "02%20-%20Operational%20Activation/" +
  "2026-09-09%20-%20AMOS-OPS%20Led%20Launch%20Doctrine/" +
  "Adolbi_AMOS_OPS_Launch_Control_Registry_v2_2026-11-21.json";

function fixtureFor(runId: string): FixtureRow | undefined {
  prepareFixtureRegistry();
  return sqlite.prepare(
    "SELECT run_id, request_id, coordinator_id, manager_id, workplan_id FROM " +
    "gad_agent_external_qa_fixture WHERE run_id = ?",
  ).get(runId) as FixtureRow | undefined;
}

function createFixture(runId: string): FixtureRow {
  const old = fixtureFor(runId);
  if (old) throw new Error("QA_FIXTURE_ALREADY_EXISTS");
  const coordinatorId = randomUUID();
  const managerId = randomUUID();
  const now = new Date().toISOString();
  return sqlite.transaction(() => {
    sqlite.prepare(
      "INSERT INTO users " +
      "(id, email, password_hash, first_name, last_name, role, department, " +
      "is_active, access_status, created_at, updated_at) VALUES " +
      "(?, ?, 'NOT_A_LOGIN', 'Synthetic', 'QA Only', 'logistics-coordinator', " +
      "'GAD', 1, 'training', ?, ?)",
    ).run(coordinatorId, "external-qa-" + coordinatorId + "@example.invalid", now, now);
    sqlite.prepare(
      "INSERT INTO users " +
      "(id, email, password_hash, first_name, last_name, role, department, " +
      "is_active, access_status, created_at, updated_at) VALUES " +
      "(?, ?, 'NOT_A_LOGIN', 'Synthetic', 'QA Manager', 'logistics-manager', " +
      "'GAD', 1, 'training', ?, ?)",
    ).run(managerId, "external-qa-" + managerId + "@example.invalid", now, now);
    const request = createLogisticsRequest({
      originDivision: "gro",
      requesterUserId: "synthetic-external-qa-requester",
      requesterRole: "staging-test",
      serviceType: "facilities",
      title: "SYNTHETIC QA: Independent GAD agent connectivity",
      requirement: "Non-operational test of external authenticated agent workflow",
      priority: "priority",
    });
    // Only synthetic QA: stage the manager prerequisite as an existing
    // owner assignment, not an agent-granted managerial approval.
    sqlite.prepare(
      "UPDATE gad_logistics_requests SET logistics_manager_id = ? WHERE id = ?"
    ).run(managerId, request.id);
    const workplan = createLogisticsWorkplanItem({
      requestId: request.id,
      ownerUserId: coordinatorId,
      ownerRole: "logistics-coordinator",
      title: "SYNTHETIC QA: scoped schedule",
      actionType: "schedule",
      priority: "priority",
      plannedFor: "2026-11-24",
      createdBy: "synthetic-external-agent-client",
    });
    sqlite.prepare(
      "INSERT INTO gad_agent_external_qa_fixture " +
      "(run_id, request_id, coordinator_id, manager_id, workplan_id, created_at) " +
      "VALUES (?, ?, ?, ?, ?, ?)",
    ).run(runId, request.id, coordinatorId, managerId, workplan.id, now);
    audit("external_qa_setup", request.id, true, runId);
    return {
      run_id: runId,
      request_id: request.id,
      coordinator_id: coordinatorId,
      manager_id: managerId,
      workplan_id: workplan.id,
    };
  })();
}

function cleanup(runId: string) {
  const fixture = fixtureFor(runId);
  if (!fixture) return { cleaned: true, existed: false };
  const request = getLogisticsRequest(fixture.request_id);
  const events = listLogisticsEvents(fixture.request_id);
  const result = {
    cleaned: true,
    existed: true,
    beforeCleanup: {
      agentEventCount: events.filter(x => x.actor_user_id === LOGISTICS_ID).length,
      humanVerified: request?.verification_status === "verified",
      closed: request?.status === "closed",
      readyForHumanReview: request?.status === "ready_for_verification",
      evidenceCount: events.filter(x => x.event_type === "evidence_linked").length,
    },
  };
  sqlite.transaction(() => {
    sqlite.prepare("DELETE FROM gad_logistics_events WHERE request_id = ?")
      .run(fixture.request_id);
    sqlite.prepare("DELETE FROM gad_logistics_workplan_items WHERE request_id = ?")
      .run(fixture.request_id);
    sqlite.prepare("DELETE FROM gad_logistics_requests WHERE id = ?")
      .run(fixture.request_id);
    sqlite.prepare(
      "DELETE FROM users WHERE id = ? AND email LIKE 'external-qa-%@example.invalid'",
    ).run(fixture.coordinator_id);
    sqlite.prepare(
      "DELETE FROM users WHERE id = ? AND email LIKE 'external-qa-%@example.invalid'",
    ).run(fixture.manager_id);
    sqlite.prepare("DELETE FROM gad_agent_external_qa_fixture WHERE run_id = ?")
      .run(runId);
    audit("external_qa_cleanup", fixture.request_id, true, runId);
  })();
  return result;
}

export function createGithubOidcLogisticsBridge() {
  const app = new Hono<{ Variables: { agent: AgentClaims } }>();
  app.use("*", async (c, next) => {
    if (!env.isStaging || env.isProduction) return c.json({ error: "NOT_FOUND" }, 404);
    const identity = await authenticate(c.req.header("authorization"));
    if (!identity) return c.json({ error: "AGENT_IDENTITY_DENIED" }, 401);
    c.set("agent", identity);
    await next();
  });
  app.get("/status", (c) => {
    const actor = c.get("agent");
    runWithDataScope("training", () =>
      audit("external_connect", "gad-logistics", true, actor.runId));
    return c.json({
      actorId: actor.actor,
      identityProvider: "github-oidc",
      sourceSha: actor.sourceSha,
      trainingOnly: true,
      humanApprovalReserved: true,
    });
  });
  app.get("/queue", (c) => {
    const actor = c.get("agent");
    const data = runWithDataScope("training", () => {
      const all = listLogisticsRequests().filter(x =>
        x.title.startsWith("SYNTHETIC QA: Independent GAD agent connectivity"));
      audit("external_queue_read", "gad-logistics", true, actor.runId);
      return all.map(x => ({ id: x.id, status: x.status, title: x.title }));
    });
    return c.json({ actorId: actor.actor, requests: data });
  });
  app.post("/qa/setup", (c) => {
    const actor = c.get("agent");
    try {
      const fixture = runWithDataScope("training", () => createFixture(actor.runId));
      return c.json({ actorId: actor.actor, fixture }, 201);
    } catch {
      return c.json({ error: "QA_FIXTURE_UNAVAILABLE" }, 409);
    }
  });
  app.post("/qa/action", async (c) => {
    const actor = c.get("agent");
    const parsed = delegatedActionSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "DELEGATION_ACTION_DENIED" }, 400);
    const fixture = runWithDataScope("training", () => fixtureFor(actor.runId));
    if (!fixture || parsed.data.requestId !== fixture.request_id) {
      runWithDataScope("training", () =>
        audit("external_wrong_fixture", parsed.data.requestId, false, actor.runId));
      return c.json({ error: "RUN_SCOPED_FIXTURE_REQUIRED" }, 403);
    }
    if (parsed.data.action === "assign" && parsed.data.coordinatorId !== fixture.coordinator_id) {
      return c.json({ error: "TEST_COORDINATOR_REQUIRED" }, 403);
    }
    if (parsed.data.action === "schedule" && parsed.data.workplanItemId !== fixture.workplan_id) {
      return c.json({ error: "TEST_WORKPLAN_REQUIRED" }, 403);
    }
    if ((parsed.data.action === "evidence" || parsed.data.action === "submit") &&
        parsed.data.evidenceReference !== evidence) {
      return c.json({ error: "TEST_EVIDENCE_REQUIRED" }, 403);
    }
    try {
      const outcome = runWithDataScope("training", () =>
        executeDelegatedAction(parsed.data));
      return c.json({ actorId: actor.actor, outcome });
    } catch {
      runWithDataScope("training", () =>
        audit("external_action_error", parsed.data.requestId, false, actor.runId));
      return c.json({ error: "DELEGATION_ACTION_REJECTED" }, 409);
    }
  });
  app.post("/qa/cleanup", (c) => {
    const actor = c.get("agent");
    const result = runWithDataScope("training", () => cleanup(actor.runId));
    return c.json({ actorId: actor.actor, ...result });
  });
  // No clinical, HR, finance, manager disposition, human verification or
  // Production routes are implemented in this isolated machine-client bridge.
  return app;
}

export const EXTERNAL_QA_EVIDENCE_REFERENCE = evidence;
