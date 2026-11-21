/**
 * One-shot live HTTP acceptance of the existing AMOS Prime GAD Logistics
 * delegation gateway, using only synthetic records in Staging TRAINING.
 *
 * No credentials, personally identifying records, or clinical information
 * leave the running Staging process. No human approval is simulated.
 */
import { randomUUID } from "node:crypto";
import { env } from "../lib/env";
import { runWithDataScope, sqlite } from "../queries/connection";
import {
  createLogisticsRequest,
  createLogisticsWorkplanItem,
  getLogisticsRequest,
  getLogisticsWorkplanItem,
  listLogisticsEvents,
} from "../services/gad-logistics";
import {
  PRIME_ID, LOGISTICS_ID,
  issueStagingScenarioCredential,
  revokeStagingScenarioCredential,
} from "./prime-logistics-delegation";

type QaCheck = { scenario: string; passed: boolean; detail: string };
type QaResult = {
  candidate: string;
  status: "PASS" | "FAIL";
  passed: number;
  failed: number;
  checks: QaCheck[];
  syntheticRecordsRemoved: boolean;
  credentialsRevoked: boolean;
};

type Fixture = {
  coordinatorId: string;
  requestId: string;
  supplyId: string;
  vendorId: string;
  workplanId: string;
};

const registryEvidence =
  "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/" +
  "06%20-%20GRO%20Operations%20%26%20Activation/" +
  "02%20-%20Operational%20Activation/" +
  "2026-09-09%20-%20AMOS-OPS%20Led%20Launch%20Doctrine/" +
  "Adolbi_AMOS_OPS_Launch_Control_Registry_v2_2026-11-21.json";

function makeFixture(): Fixture {
  const now = new Date().toISOString();
  const coordinatorId = randomUUID();
  sqlite.prepare(
    "INSERT INTO users " +
    "(id, email, password_hash, first_name, last_name, role, department, " +
    "is_active, access_status, created_at, updated_at) " +
    "VALUES (?, ?, ?, 'Synthetic', 'QA Coordinator', 'logistics-coordinator', " +
    "'GAD', 1, 'training', ?, ?)"
  ).run(coordinatorId, "qa-" + coordinatorId + "@example.invalid",
    "NOT_A_REAL_CREDENTIAL", now, now);
  const base = {
    requesterUserId: "synthetic-qa-requester",
    requesterRole: "staging-test",
    requirement: "SYNTHETIC STAGING QA ONLY; not an operational service request",
    priority: "priority" as const,
  };
  const repair = createLogisticsRequest({
    ...base, originDivision: "gro", serviceType: "facilities",
    title: "SYNTHETIC QA: GRO lock repair",
  });
  const supply = createLogisticsRequest({
    ...base, originDivision: "bhc", serviceType: "procurement",
    title: "SYNTHETIC QA: BHC office supplies",
  });
  const vendor = createLogisticsRequest({
    ...base, originDivision: "gro", serviceType: "equipment",
    title: "SYNTHETIC QA: vendor generator schedule",
  });
  const workplan = createLogisticsWorkplanItem({
    requestId: repair.id, ownerUserId: coordinatorId,
    ownerRole: "logistics-coordinator",
    title: "SYNTHETIC QA: service coordination schedule",
    actionType: "schedule", priority: "priority",
    plannedFor: "2026-11-24", createdBy: "synthetic-qa-runner",
  });
  return {
    coordinatorId, requestId: repair.id, supplyId: supply.id,
    vendorId: vendor.id, workplanId: workplan.id,
  };
}

function purgeFixture(fixture: Fixture): void {
  const ids = [fixture.requestId, fixture.supplyId, fixture.vendorId];
  sqlite.transaction(() => {
    for (const id of ids) {
      sqlite.prepare("DELETE FROM gad_logistics_events WHERE request_id = ?").run(id);
      sqlite.prepare("DELETE FROM gad_logistics_workplan_items WHERE request_id = ?").run(id);
      sqlite.prepare("DELETE FROM gad_logistics_requests WHERE id = ?").run(id);
    }
    sqlite.prepare(
      "DELETE FROM users WHERE id = ? AND email LIKE 'qa-%@example.invalid'"
    ).run(fixture.coordinatorId);
  })();
}

function persistResult(result: QaResult) {
  sqlite.prepare(
    "UPDATE gad_agent_scenario_runs SET status = ?, results_json = ?, finished_at = ? " +
    "WHERE id = ?"
  ).run(result.status, JSON.stringify(result), new Date().toISOString(), result.candidate);
}

export async function runLiveStagingDelegateAcceptance(
  port: number,
  candidate: string,
): Promise<QaResult | { candidate: string; skipped: true }> {
  if (!env.isStaging || env.isProduction ||
      process.env.AMOS_PRIME_LIVE_QA_RUN_ONCE !== "true") {
    return { candidate, skipped: true };
  }
  const reserved = runWithDataScope("training", () => {
    const old = sqlite.prepare(
      "SELECT id FROM gad_agent_scenario_runs WHERE id = ?"
    ).get(candidate);
    if (old) return false;
    sqlite.prepare(
      "INSERT INTO gad_agent_scenario_runs " +
      "(id, status, results_json, started_at) VALUES (?, 'RUNNING', '{}', ?)"
    ).run(candidate, new Date().toISOString());
    return true;
  });
  if (!reserved) return { candidate, skipped: true };

  const checks: QaCheck[] = [];
  const check = (scenario: string, passed: boolean, detail: string) =>
    checks.push({ scenario, passed, detail });
  let fixture: Fixture | null = null;
  let primeCredential: { key: string; credentialId: string } | null = null;
  let logisticsCredential: { key: string; credentialId: string } | null = null;
  let credentialsRevoked = false;
  let syntheticRecordsRemoved = false;

  const origin = "http://127.0.0.1:" + port;
  const request = async (
    url: string, key: string,
    body?: Record<string, unknown>,
  ): Promise<{ status: number; body: Record<string, unknown> }> => {
    const response = await fetch(origin + "/api/delegation" + url, {
      method: body ? "POST" : "GET",
      headers: {
        "x-amos-delegation-key": key,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(7000),
    });
    const raw: unknown = await response.json();
    return {
      status: response.status,
      body: raw && typeof raw === "object" && !Array.isArray(raw)
        ? raw as Record<string, unknown> : {},
    };
  };

  try {
    const prepared = runWithDataScope("training", () => {
      const prime = issueStagingScenarioCredential(PRIME_ID);
      const logistics = issueStagingScenarioCredential(LOGISTICS_ID);
      const testFixture = makeFixture();
      return { prime, logistics, testFixture };
    });
    primeCredential = prepared.prime;
    logisticsCredential = prepared.logistics;
    fixture = prepared.testFixture;

    // 1: Cross-department launch briefing and N01–N04 provider readiness.
    const overview = await request("/prime/overview", primeCredential.key);
    const readiness = overview.body.providerNetworkReadiness as
      | { recordedActions?: number; referralGate?: string;
          authoritativeProviderNetworkConnected?: boolean } | undefined;
    const launch = overview.body.launch as
      | Array<{ count?: number }> | undefined;
    check("1: Prime launch coordination summary", overview.status === 200 &&
      overview.body.actorId === PRIME_ID &&
      (launch?.reduce((a, x) => a + (Number(x.count) || 0), 0) ?? 0) === 40,
      "Prime identity, 40 launch actions and aggregated coordination only");
    check("7: Provider N01–N04 readiness crosswalk (source held)", overview.status === 200 &&
      readiness?.recordedActions === 4 && readiness.referralGate === "HOLD" &&
      readiness.authoritativeProviderNetworkConnected === false,
      "N01–N04 linked to launch register; actual provider and CRM data not authenticated");

    // 2/3: GRO and BHC work from the same delegated logistics queue.
    const queue = await request("/logistics/queue", logisticsCredential.key);
    const rows = queue.body.requests as Array<{ id: string; originDivision: string }> | undefined;
    check("2/3: GRO and BHC shared logistics queue", queue.status === 200 &&
      queue.body.actorId === LOGISTICS_ID &&
      Boolean(rows?.some(x => x.id === fixture!.requestId && x.originDivision === "gro")) &&
      Boolean(rows?.some(x => x.id === fixture!.supplyId && x.originDivision === "bhc")),
      "Two synthetic cross-division requests visible to the Logistics identity");

    const invalidCoordinator = await request("/logistics/action", logisticsCredential.key, {
      action: "assign", requestId: fixture.vendorId, coordinatorId: randomUUID(),
    });
    check("5: Staffing vacancy blocks invented assignment",
      invalidCoordinator.status === 422,
      "Unregistered coordinator rejected; operational workforce remains unstaffed");

    const assigned = await request("/logistics/action", logisticsCredential.key, {
      action: "assign", requestId: fixture.requestId,
      coordinatorId: fixture.coordinatorId,
    });
    check("2: Delegated assignment", assigned.status === 200 &&
      assigned.body.actorId === LOGISTICS_ID, "Synthetic eligible coordinator assigned");

    const scheduled = await request("/logistics/action", logisticsCredential.key, {
      action: "schedule", requestId: fixture.requestId,
      workplanItemId: fixture.workplanId, plannedFor: "2026-11-25",
    });
    check("4: Schedule change", scheduled.status === 200,
      "Existing workplan date updated by delegated actor");

    const blocker = await request("/logistics/action", logisticsCredential.key, {
      action: "blocker", requestId: fixture.vendorId,
      dependencyType: "supplier_unavailable",
      dependencyOwner: "SYNTHETIC Vendor Desk",
      note: "SYNTHETIC QA: supplier delivery blocked",
    });
    check("4: Vendor dependency", blocker.status === 200,
      "Vendor delay recorded on separate GRO request");

    const evidence = await request("/logistics/action", logisticsCredential.key, {
      action: "evidence", requestId: fixture.requestId,
      evidenceReference: registryEvidence,
    });
    check("6: Controlled SharePoint evidence reference", evidence.status === 200,
      "Existing control registry used as a QA link; not proof of an actual repair");

    const submitted = await request("/logistics/action", logisticsCredential.key, {
      action: "submit", requestId: fixture.requestId,
      evidenceReference: registryEvidence,
      note: "SYNTHETIC QA: submitted for human sign-off only",
    });
    const retained = runWithDataScope("training", () => {
      const current = getLogisticsRequest(fixture!.requestId);
      const workplan = getLogisticsWorkplanItem(fixture!.workplanId);
      const events = listLogisticsEvents(fixture!.requestId);
      const audited = sqlite.prepare(
        "SELECT action FROM gad_agent_action_audit WHERE agent_id = ? " +
        "AND resource_id = ? AND outcome = 'allowed'"
      ).all(LOGISTICS_ID, fixture!.requestId) as Array<{ action: string }>;
      return {
        status: current?.status,
        verification: current?.verification_status,
        closedAt: current?.closed_at,
        workplanDate: workplan?.planned_for,
        attributableEvents: events.filter(x => x.actor_user_id === LOGISTICS_ID).length,
        auditActions: audited.map(x => x.action),
      };
    });
    check("6: Human sign-off preserved",
      submitted.status === 200 && retained.status === "ready_for_verification" &&
      retained.verification === "pending" && retained.closedAt === null,
      "Agent submitted work; approval and closure remain human-controlled");
    check("2/4/6: Persistent records and audit attribution",
      retained.workplanDate === "2026-11-25" &&
      retained.attributableEvents === 4 &&
      ["assign","schedule","evidence","submit"].every(x => retained.auditActions.includes(x)),
      "Schedule, event history and audited actor persisted in training database");

    // 8: Denials, isolation and actual same-process revocation via HTTP.
    const wrongRole = await request("/prime/overview", logisticsCredential.key);
    const wrongScope = await request("/logistics/queue", primeCredential.key);
    const approval = await request("/logistics/action", logisticsCredential.key, {
      action: "approve", requestId: fixture.requestId,
    });
    const revocationDenied = await request("/human/revoke", logisticsCredential.key, {
      agentId: LOGISTICS_ID,
    });
    check("8: Cross-role and approval access denied",
      wrongRole.status === 401 && wrongScope.status === 401 &&
      approval.status === 400 && revocationDenied.status === 401,
      "Cross-identity access, approval and human-only revocation rejected");

    const offScope = await fetch(origin + "/api/trpc/m1.getWorkQueue", {
      headers: { "x-amos-delegation-key": logisticsCredential.key },
      signal: AbortSignal.timeout(7000),
    });
    check("8: General AMOS-OPS work queue rejects agent-only identity",
      [401, 403].includes(offScope.status),
      "Delegated key does not authorize general tRPC modules");

    runWithDataScope("training", () =>
      revokeStagingScenarioCredential(LOGISTICS_ID, logisticsCredential!.credentialId));
    const afterRevoke = await request("/logistics/queue", logisticsCredential.key);
    check("8: Immediate delegated access revocation",
      afterRevoke.status === 401,
      "Ephemeral credential revoked; next live HTTP request rejected");
  } catch (error) {
    check("LIVE_STAGING_HARNESS", false,
      error instanceof Error ? error.message : "Unknown acceptance failure");
  } finally {
    if (primeCredential || logisticsCredential) {
      try {
        runWithDataScope("training", () => {
          if (primeCredential) revokeStagingScenarioCredential(PRIME_ID, primeCredential.credentialId);
          if (logisticsCredential) revokeStagingScenarioCredential(LOGISTICS_ID, logisticsCredential.credentialId);
        });
        credentialsRevoked = true;
      } catch {
        check("QA credential cleanup", false, "Failed to revoke ephemeral QA credentials");
      }
    }
    if (fixture) {
      try {
        runWithDataScope("training", () => purgeFixture(fixture!));
        syntheticRecordsRemoved = true;
      } catch {
        check("Synthetic fixture cleanup", false, "Failed to remove training-only QA fixtures");
      }
    }
  }
  const failed = checks.filter(x => !x.passed).length;
  const result: QaResult = {
    candidate, status: failed ? "FAIL" : "PASS",
    passed: checks.length - failed, failed, checks,
    syntheticRecordsRemoved, credentialsRevoked,
  };
  runWithDataScope("training", () => persistResult(result));
  return result;
}
