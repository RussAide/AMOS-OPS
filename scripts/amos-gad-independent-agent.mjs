#!/usr/bin/env node
/**
 * Independently executed GitHub Actions QA client for AMOS-OPS Staging.
 * Authenticates with a short-lived, GitHub-signed OIDC token. Never prints
 * the identity token, passwords, cookies, secrets or any real care records.
 * Writes only to synthetic, run-scoped fixtures in the TRAINING database.
 */
import assert from "node:assert/strict";

const origin = "https://amos-ops-staging.up.railway.app";
const base = origin + "/api/delegation/gh-oidc";
const audience = "amos-ops-staging-gad-logistics-agent";
const evidence = "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/" +
  "06%20-%20GRO%20Operations%20%26%20Activation/" +
  "02%20-%20Operational%20Activation/" +
  "2026-09-09%20-%20AMOS-OPS%20Led%20Launch%20Doctrine/" +
  "Adolbi_AMOS_OPS_Launch_Control_Registry_v2_2026-11-21.json";

async function obtainOidcToken() {
  const requestUrl = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const requestToken = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  assert(requestUrl && requestToken, "GitHub OIDC identity variables are required");
  const url = requestUrl + (requestUrl.includes("?") ? "&" : "?") +
    "audience=" + encodeURIComponent(audience);
  const result = await fetch(url, {
    headers: { Authorization: "Bearer " + requestToken },
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(result.status, 200, "GitHub OIDC identity request rejected");
  const data = await result.json();
  assert(typeof data.value === "string" && data.value.length > 100,
    "GitHub OIDC identity token missing");
  return data.value;
}

async function call(path, oidc, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(oidc ? { Authorization: "Bearer " + oidc } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });
  let data = {};
  try { data = await response.json(); } catch { /* Denied non-JSON is still failure */ }
  return { status: response.status, data };
}

function pass(label) {
  process.stdout.write("PASS " + label + "\n");
}

const checks = [];
function check(label, condition) {
  checks.push({ label, passed: Boolean(condition) });
  assert(condition, "QA_FAILED: " + label);
  pass(label);
}

const oidc = await obtainOidcToken();
let created = false;
let finished = false;

try {
  const unauthenticated = await call("/status", null);
  check("Uncredentialed agent rejected", unauthenticated.status === 401);

  const identity = await call("/status", oidc);
  check("Independent GitHub workload identity authenticated",
    identity.status === 200 &&
    identity.data.actorId === "AMOS-PRIME-LOGISTICS" &&
    identity.data.identityProvider === "github-oidc" &&
    identity.data.trainingOnly === true &&
    identity.data.humanApprovalReserved === true);

  const initialQueue = await call("/queue", oidc);
  check("Read synthetic Logistics queue", initialQueue.status === 200 &&
    initialQueue.data.actorId === "AMOS-PRIME-LOGISTICS" &&
    Array.isArray(initialQueue.data.requests));

  const setup = await call("/qa/setup", oidc, {});
  check("Run-scoped synthetic fixture created", setup.status === 201 &&
    setup.data.fixture?.request_id &&
    setup.data.fixture?.coordinator_id &&
    setup.data.fixture?.workplan_id);
  created = true;
  const { request_id: requestId, coordinator_id: coordinatorId,
    workplan_id: workplanItemId } = setup.data.fixture;

  const duplicate = await call("/qa/setup", oidc, {});
  check("Repeated setup cannot duplicate the run", duplicate.status === 409);

  const queue = await call("/queue", oidc);
  check("Synthetic request appears in existing queue", queue.status === 200 &&
    queue.data.requests.some(r => r.id === requestId));

  const wrong = await call("/qa/action", oidc, {
    action: "assign",
    requestId: "00000000-0000-4000-8000-000000000000",
    coordinatorId,
  });
  check("Unauthorized request identity blocked", wrong.status === 403);

  const invalidStaff = await call("/qa/action", oidc, {
    action: "assign",
    requestId,
    coordinatorId: "22222222-2222-4222-8222-222222222222",
  });
  check("Fabricated assignment blocked", invalidStaff.status === 403);

  const assign = await call("/qa/action", oidc, {
    action: "assign", requestId, coordinatorId,
  });
  check("Agent assigned synthetic coordinator under human manager",
    assign.status === 200 && assign.data.actorId === "AMOS-PRIME-LOGISTICS");

  const schedule = await call("/qa/action", oidc, {
    action: "schedule", requestId, workplanItemId, plannedFor: "2026-11-25",
  });
  check("Agent revised existing workplan schedule", schedule.status === 200);

  const dependency = await call("/qa/action", oidc, {
    action: "blocker", requestId, dependencyType: "qa_synthetic_vendor_delay",
    dependencyOwner: "Synthetic Vendor", note: "QA only: supplier handoff pending",
  });
  check("Agent recorded a real staging dependency event",
    dependency.status === 200);

  const evidenceResult = await call("/qa/action", oidc, {
    action: "evidence", requestId, evidenceReference: evidence,
  });
  check("Agent linked approved QA SharePoint control reference",
    evidenceResult.status === 200);

  const rejectExternalEvidence = await call("/qa/action", oidc, {
    action: "submit", requestId,
    evidenceReference: "https://example.org/not-an-approved-reference",
    note: "Synthetic QA only",
  });
  check("Unapproved evidence reference denied", rejectExternalEvidence.status === 403);

  const submit = await call("/qa/action", oidc, {
    action: "submit", requestId, evidenceReference: evidence,
    note: "QA complete; human verification still required",
  });
  check("Agent submitted for human verification, not approval",
    submit.status === 200);

  const approve = await call("/qa/action", oidc, { action: "approve", requestId });
  check("Agent cannot approve or close", approve.status === 400);

  const revoke = await fetch(origin + "/api/delegation/human/revoke", {
    method: "POST",
    headers: { Authorization: "Bearer " + oidc, "content-type": "application/json" },
    body: JSON.stringify({ agentId: "AMOS-PRIME-LOGISTICS" }),
    signal: AbortSignal.timeout(15000),
  });
  check("Agent cannot revoke identity or act as human approver",
    revoke.status === 401);

  const cleanup = await call("/qa/cleanup", oidc, {});
  check("Human sign-off preserved, records and IDs cleaned",
    cleanup.status === 200 && cleanup.data.actorId === "AMOS-PRIME-LOGISTICS" &&
    cleanup.data.cleaned && cleanup.data.existed &&
    cleanup.data.beforeCleanup?.readyForHumanReview === true &&
    cleanup.data.beforeCleanup?.humanVerified === false &&
    cleanup.data.beforeCleanup?.closed === false &&
    cleanup.data.beforeCleanup?.agentEventCount >= 5);
  finished = true;
  const after = await call("/queue", oidc);
  check("Synthetic fixture removed from queue", after.status === 200 &&
    !after.data.requests.some(r => r.id === requestId));

  process.stdout.write("Independent GitHub OIDC client: " +
    checks.length + "/" + checks.length + " checks passed.\n");
} finally {
  if (created && !finished) {
    try {
      const clean = await call("/qa/cleanup", oidc, {});
      if (clean.status !== 200 || !clean.data.cleaned) {
        process.stderr.write("QA cleanup incomplete: inspect staging logs.\n");
        process.exitCode = 1;
      }
    } catch {
      process.stderr.write("QA cleanup unavailable: inspect staging logs.\n");
      process.exitCode = 1;
    }
  }
}
