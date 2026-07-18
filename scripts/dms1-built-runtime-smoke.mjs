import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import bcrypt from "bcryptjs";
import { createTRPCProxyClient, httpBatchLink } from "@trpc/client";
import superjson from "superjson";

const BUILD_ID = "AMOS-OPS-DMS.1-RC4-20260715";
const CANDIDATE_ID = "DMS.1-RC4";
const SOURCE_DIGEST = "b".repeat(64);
const REVIEW_BANNER = "AMOS-OPS Operational Workspace";
const testCredential = (scope) =>
  `not-a-secret-test-fixture-${scope}-${"x".repeat(32)}`;
const testStorageKey = (marker) =>
  Buffer.from(marker.repeat(32), "utf8").toString("base64");
const testMfaCode = () => ["48", "27", "31"].join("");
const FORBIDDEN_DEPLOYMENT_UX = Object.freeze([
  "Final Gate",
  "/admin/final-gate",
  "RELEASE CANDIDATE REVIEW",
  "Production pathway",
  "APPROVE DMS.1",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function createClient(origin, headers = {}) {
  return createTRPCProxyClient({
    links: [
      httpBatchLink({
        url: `${origin}/api/trpc`,
        transformer: superjson,
        headers: () => headers,
      }),
    ],
  });
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      assert(address && typeof address === "object", "DMS1_PORT_RESERVATION_FAILED");
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function captureProcess(child) {
  const output = { stdout: "", stderr: "" };
  child.stdout?.on("data", (chunk) => {
    output.stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output.stderr += chunk.toString();
  });
  return output;
}

function startServer(environment) {
  const child = spawn(process.execPath, ["dist/boot.js"], {
    cwd: process.cwd(),
    env: { ...process.env, ...environment },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return { child, output: captureProcess(child) };
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => child.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ]);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function waitForReady(child, output, origin) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(
        `DMS1_BUILT_SERVER_EXITED_EARLY:${child.exitCode}\n${output.stdout}\n${output.stderr}`,
      );
    }
    try {
      const response = await fetch(`${origin}/api/health`);
      if (response.ok) return response.json();
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `DMS1_BUILT_SERVER_NOT_READY\n${output.stdout}\n${output.stderr}`,
  );
}

function sharedEnvironment(port, temporaryRoot) {
  return {
    NODE_ENV: "production",
    PORT: String(port),
    APP_ID: "amos-ops",
    APP_SECRET: testCredential("built-runtime-app"),
    JWT_SECRET: testCredential("built-runtime-jwt"),
    ALLOW_SELF_REGISTRATION: "false",
    MFA_POLICY: "required-all",
    DEPLOYMENT_APPROVAL_ID: "DMS-1-BUILT-RUNTIME-SMOKE",
    DEPLOYMENT_CHANGE_REFERENCE: "DMS-1-BUILT-RUNTIME-SMOKE",
    AMOS_ALLOWED_ORIGINS: `http://127.0.0.1:${port}`,
    AMOS_BUILD_ID: BUILD_ID,
    DMS1_TEMPORARY_ROOT: temporaryRoot,
  };
}

async function inspectRunningMode(kind, reviewPassword, reviewPasswordHash) {
  const port = await reservePort();
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), `amos-dms1-${kind}-`),
  );
  const common = sharedEnvironment(port, temporaryRoot);
  const environment =
    kind === "demo"
      ? {
          ...common,
          APP_ENV: "demo",
          AMOS_RUNTIME_MODE: "demo",
          AMOS_ENVIRONMENT_ID: "amos-ops-demo-built-smoke",
          CREDENTIAL_NAMESPACE: "amos-ops/demo/built-smoke",
          DATABASE_PATH: path.join(temporaryRoot, "data", "demo", "amos-ops.db"),
          UPLOAD_PATH: path.join(temporaryRoot, "uploads", "demo"),
        }
      : {
          ...common,
          APP_ENV: "staging",
          AMOS_RUNTIME_MODE: "production",
          AMOS_REVIEW_DEPLOYMENT: "true",
          AMOS_ENVIRONMENT_ID: "amos-ops-staging-built-smoke",
          CREDENTIAL_NAMESPACE: "amos-ops/staging/built-smoke",
          DATABASE_PATH: path.join(
            temporaryRoot,
            "data",
            "staging",
            "amos-ops.db",
          ),
          UPLOAD_PATH: path.join(temporaryRoot, "uploads", "staging"),
          AMOS_FINAL_GATE_OWNER_EMAIL: "owner@amos-ops.invalid",
          AMOS_FINAL_GATE_CANDIDATE_ID: CANDIDATE_ID,
          AMOS_SOURCE_DIGEST: SOURCE_DIGEST,
          AMOS_REVIEW_OWNER_PASSWORD_HASH: reviewPasswordHash,
          AMOS_REVIEW_OWNER_MFA_CODE: testMfaCode(),
        };
  fs.mkdirSync(path.dirname(environment.DATABASE_PATH), { recursive: true });
  fs.mkdirSync(environment.UPLOAD_PATH, { recursive: true });

  const { child, output } = startServer(environment);
  const origin = `http://127.0.0.1:${port}`;
  try {
    const health = await waitForReady(child, output, origin);
    const runtimeResponse = await fetch(`${origin}/api/runtime-config`);
    assert(runtimeResponse.ok, `DMS1_${kind.toUpperCase()}_RUNTIME_CONFIG_FAILED`);
    const runtime = await runtimeResponse.json();
    const indexResponse = await fetch(`${origin}/`);
    const index = await indexResponse.text();
    assert(indexResponse.ok && /<!doctype html>/i.test(index), "DMS1_STATIC_APP_FAILED");
    const bundlePath = /<script[^>]+src="([^"]+)"/.exec(index)?.[1];
    assert(bundlePath, "DMS1_CLIENT_BUNDLE_PATH_MISSING");
    const bundleResponse = await fetch(new URL(bundlePath, origin));
    const bundle = await bundleResponse.text();
    assert(bundleResponse.ok, "DMS1_CLIENT_BUNDLE_FAILED");
    for (const forbidden of FORBIDDEN_DEPLOYMENT_UX) {
      assert(!bundle.includes(forbidden), `DMS1_DEPLOYMENT_UX_LEAK:${forbidden}`);
    }
    assert(health.status === "ready" && health.checks?.database?.status === "ok", "DMS1_HEALTH_FAILED");
    assert(runtime.schemaVersion === 2 && runtime.buildId === BUILD_ID, "DMS1_BUILD_BINDING_FAILED");
    if (kind === "demo") {
      assert(
        runtime.mode === "demo" &&
          runtime.deploymentPosture === "demo" &&
          runtime.evaluationMode === true &&
          runtime.reviewDeployment === false &&
          runtime.safeguards?.syntheticDataOnly === true &&
          runtime.safeguards?.evaluationFallbacksAllowed === true &&
          runtime.safeguards?.productionDataAllowed === false &&
          runtime.safeguards?.externalWritesAllowed === false,
        "DMS1_DEMO_RUNTIME_BOUNDARY_FAILED",
      );
    } else {
      assert(
        runtime.mode === "production" &&
          runtime.deploymentPosture === "release-review" &&
          runtime.evaluationMode === false &&
          runtime.reviewDeployment === true &&
          runtime.candidateId === CANDIDATE_ID &&
          runtime.productionReleaseAuthorized === false &&
          runtime.banner === REVIEW_BANNER &&
          runtime.safeguards?.syntheticDataOnly === true &&
          runtime.safeguards?.evaluationFallbacksAllowed === false &&
          runtime.safeguards?.productionDataAllowed === false &&
          runtime.safeguards?.externalWritesAllowed === false,
        "DMS1_REVIEW_RUNTIME_BOUNDARY_FAILED",
      );
    }

    let client;
    if (kind === "demo") {
      client = createClient(origin, {
        authorization: "Bearer amos-evaluation-session",
        "x-amos-evaluation-role": "super-admin",
      });
    } else {
      const anonymous = createClient(origin);
      const login = await anonymous.auth.login.mutate({
        email: "owner@amos-ops.invalid",
        password: reviewPassword,
      });
      assert(login.status === "mfa_required", "DMS1_BUILT_REVIEW_MFA_NOT_REQUIRED");
      assert(!("evaluationCode" in login), "DMS1_BUILT_REVIEW_MFA_CODE_LEAKED");
      const verified = await anonymous.auth.verifyMfa.mutate({
        challengeId: login.challengeId,
        code: testMfaCode(),
      });
      assert(
        verified.status === "authenticated" &&
          verified.mfaVerified === true &&
          verified.user.role === "super-admin" &&
          verified.user.email.toLowerCase() === "owner@amos-ops.invalid",
        "DMS1_BUILT_REVIEW_OWNER_SESSION_FAILED",
      );
      client = createClient(origin, {
        authorization: `Bearer ${verified.token}`,
      });
    }

    if (kind === "demo") {
      const orientationModules =
        await client.training.listOrientationModules.query();
      assert(
        orientationModules.length > 0 &&
          orientationModules.every((module) => module.id.startsWith("mod-")),
        "DMS1_FRESH_TRAINING_DATABASE_ORIENTATION_FAILED",
      );
    } else {
      const dashboard = await client.dashboard.overview.query();
      assert(
        ["bhc", "revenue", "campus", "mgma", "part2", "documents", "nil"].every(
          (section) => section in dashboard,
        ),
        "DMS1_FRESH_DATABASE_DASHBOARD_FAILED",
      );
      await client.phase3.overview.query();
      await client.dx1.getAcceptanceStatus.query();
    }

    return Object.freeze({
      mode: runtime.mode,
      deploymentPosture: runtime.deploymentPosture,
      buildId: runtime.buildId,
      candidateId: runtime.candidateId,
      health: health.status,
      staticApp: "PASS",
      freshDatabaseReadChecks: "PASS",
      deploymentApprovalSurface: "ABSENT",
      deploymentGovernanceVisibleInProduct: false,
      safeguards: runtime.safeguards,
    });
  } finally {
    await stopServer(child);
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

async function verifyUnauthorizedProductionFailsClosed() {
  const port = await reservePort();
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "amos-dms1-production-denied-"),
  );
  const environment = {
    ...sharedEnvironment(port, temporaryRoot),
    APP_ENV: "production",
    AMOS_RUNTIME_MODE: "production",
    AMOS_ENVIRONMENT_ID: "amos-ops-production-denied-smoke",
    CREDENTIAL_NAMESPACE: "amos-ops/production/denied-smoke",
    PERSISTENT_ROOT: "/app/persistent",
    RAILWAY_VOLUME_MOUNT_PATH: "/app/persistent",
    DATABASE_PATH: `/app/persistent/dms1-production-denied-${process.pid}.db`,
    UPLOAD_PATH: `/app/persistent/dms1-production-denied-${process.pid}-uploads`,
    AMOS_STORAGE_ENCRYPTION_REQUIRED: "true",
    AMOS_STORAGE_KEY_PROVIDER: "railway-sealed-variables-v1",
    AMOS_STORAGE_MIGRATION_MODE: "none",
    AMOS_DATABASE_ACTIVE_KEY_ID: "database-smoke",
    AMOS_DATABASE_KEY_MANIFEST_JSON:
      '{"database-smoke":"AMOS_DATABASE_KEY_SMOKE"}',
    AMOS_DATABASE_KEY_SMOKE: testStorageKey("d"),
    AMOS_UPLOAD_ACTIVE_KEY_ID: "upload-smoke",
    AMOS_UPLOAD_KEY_MANIFEST_JSON:
      '{"upload-smoke":"AMOS_UPLOAD_KEY_SMOKE"}',
    AMOS_UPLOAD_KEY_SMOKE: testStorageKey("u"),
    AMOS_BACKUP_ACTIVE_KEY_ID: "backup-smoke",
    AMOS_BACKUP_KEY_MANIFEST_JSON:
      '{"backup-smoke":"AMOS_BACKUP_KEY_SMOKE"}',
    AMOS_BACKUP_KEY_SMOKE: testStorageKey("b"),
  };
  const { child, output } = startServer(environment);
  const exitCode = await Promise.race([
    new Promise((resolve) => child.once("exit", (code) => resolve(code))),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 8_000)),
  ]);
  if (exitCode === "timeout") await stopServer(child);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  assert(exitCode !== "timeout" && exitCode !== 0, "DMS1_UNAUTHORIZED_PRODUCTION_STARTED");
  assert(
    /Production is locked until AMOS_PRODUCTION_RELEASE_AUTHORIZED=true/.test(
      `${output.stdout}\n${output.stderr}`,
    ),
    "DMS1_UNAUTHORIZED_PRODUCTION_DID_NOT_FAIL_CLOSED",
  );
  return Object.freeze({ status: "PASS", startup: "DENIED" });
}

const reviewPassword = "Dms1BuiltSmoke!2026-Only";
const reviewPasswordHash = await bcrypt.hash(reviewPassword, 4);
const demo = await inspectRunningMode("demo", reviewPassword, reviewPasswordHash);
const releaseReview = await inspectRunningMode(
  "review",
  reviewPassword,
  reviewPasswordHash,
);
const unauthorizedProduction = await verifyUnauthorizedProductionFailsClosed();
assert(demo.buildId === releaseReview.buildId, "DMS1_MODES_DID_NOT_USE_SAME_BUILD");

process.stdout.write(
  `${JSON.stringify(
    {
      schemaVersion: "1.0",
      milestone: "DMS.1",
      status: "PASS",
      sameBuildVerified: true,
      buildId: BUILD_ID,
      demo,
      releaseReview,
      unauthorizedProduction,
      productionRows: 0,
      liveExternalCalls: 0,
      usesProductionData: false,
    },
    null,
    2,
  )}\n`,
);
