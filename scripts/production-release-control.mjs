#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const UUID =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;
const RAILWAY_API = "https://backboard.railway.com/graphql/v2";
const NETLIFY_API = "https://api.netlify.com/api/v1";
const TERMINAL_FAILURES = new Set(["FAILED", "CRASHED", "REMOVED", "SKIPPED"]);
const MANIFEST_FIELDS = [
  "schemaVersion",
  "releaseId",
  "commitSha",
  "treeSha",
  "sourceDigest",
  "frontendArtifactDigest",
  "backendArtifactDigest",
];

function fail(message) {
  throw new Error(message);
}

export function parseCommandArgs(argv) {
  const [command, ...rest] = argv;
  if (!command) fail("A release-control command is required.");
  const values = {};
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (!name?.startsWith("--") || value === undefined) {
      fail(`Invalid argument near ${name ?? "end of command"}.`);
    }
    values[name.slice(2)] = value;
  }
  return { command, values };
}

function requiredEnv(name, env = process.env) {
  const value = env[name]?.trim();
  if (!value) fail(`${name} is required.`);
  return value;
}

function exactOrigin(name, env = process.env) {
  const value = requiredEnv(name, env);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${name} must be a valid HTTPS origin.`);
  }
  if (
    url.protocol !== "https:" ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    fail(
      `${name} must be an exact HTTPS origin without a path or credentials.`,
    );
  }
  return url.origin;
}

export function validateConfiguration(env = process.env) {
  const releaseSha = requiredEnv("RELEASE_SHA", env);
  const releaseId = requiredEnv("RELEASE_ID", env);
  if (!SHA1.test(releaseSha))
    fail("RELEASE_SHA must be an exact lowercase Git SHA.");
  if (!RELEASE_ID.test(releaseId)) fail("RELEASE_ID has an invalid format.");
  if (!requiredEnv("CHANGE_REFERENCE", env))
    fail("CHANGE_REFERENCE is required.");
  const recoveryValue = requiredEnv("RECOVERY_RELEASE", env);
  if (!new Set(["true", "false"]).has(recoveryValue)) {
    fail("RECOVERY_RELEASE must be true or false.");
  }
  const recoveryRelease = recoveryValue === "true";

  const ids = [
    "RAILWAY_PROJECT_ID",
    "RAILWAY_SERVICE_ID",
    "RAILWAY_ENVIRONMENT_ID",
    "NETLIFY_SITE_ID",
  ];
  for (const name of ids) {
    if (!UUID.test(requiredEnv(name, env)))
      fail(`${name} must be an exact UUID.`);
  }
  for (const name of ["RAILWAY_CREDENTIAL", "NETLIFY_AUTH_TOKEN"]) {
    if (requiredEnv(name, env).length < 20)
      fail(`${name} is not a usable token.`);
  }
  const tokenType = requiredEnv("RAILWAY_TOKEN_TYPE", env);
  if (!new Set(["project", "account"]).has(tokenType)) {
    fail("RAILWAY_TOKEN_TYPE must be project or account.");
  }

  const railwayOrigin = exactOrigin("RAILWAY_PUBLIC_ORIGIN", env);
  const netlifyOrigin = exactOrigin("NETLIFY_PUBLIC_ORIGIN", env);
  if (!railwayOrigin.endsWith(".up.railway.app")) {
    fail(
      "RAILWAY_PUBLIC_ORIGIN must use the approved Railway production domain.",
    );
  }
  if (new URL(netlifyOrigin).hostname !== "amos-ops.com") {
    fail("NETLIFY_PUBLIC_ORIGIN must be https://amos-ops.com.");
  }

  const expectedPaths = {
    PERSISTENT_ROOT: "/app/persistent",
    DATABASE_PATH: "/app/persistent/data/production/amos-ops.db",
    TRAINING_DATABASE_PATH:
      "/app/persistent/data/production/training/amos-ops-training.db",
    UPLOAD_PATH: "/app/persistent/uploads/production",
    TRAINING_UPLOAD_PATH: "/app/persistent/uploads/production/training",
    BACKUP_PATH: "/app/persistent/backups/production",
  };
  for (const [name, expected] of Object.entries(expectedPaths)) {
    if (requiredEnv(name, env) !== expected)
      fail(`${name} is not the approved Production path.`);
  }
  const allowedOrigins = requiredEnv("EXPECTED_ALLOWED_ORIGINS", env)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (
    !allowedOrigins.includes(netlifyOrigin) ||
    allowedOrigins.some((value) => value.includes("*"))
  ) {
    fail(
      "EXPECTED_ALLOWED_ORIGINS must explicitly include amos-ops.com and contain no wildcard.",
    );
  }
  for (const origin of allowedOrigins) {
    const parsed = new URL(origin);
    if (parsed.origin !== origin || parsed.protocol !== "https:") {
      fail("EXPECTED_ALLOWED_ORIGINS entries must be exact HTTPS origins.");
    }
  }
  return Object.freeze({
    releaseSha,
    releaseId,
    recoveryRelease,
    railwayOrigin,
    netlifyOrigin,
    allowedOrigins: allowedOrigins.join(","),
    tokenType,
  });
}

function railwayHeaders(env = process.env) {
  const token = requiredEnv("RAILWAY_CREDENTIAL", env);
  return env.RAILWAY_TOKEN_TYPE === "project"
    ? { "Project-Access-Token": token, "Content-Type": "application/json" }
    : { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function request(url, options = {}, expectedStatuses = [200]) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(30_000),
  });
  if (!expectedStatuses.includes(response.status)) {
    fail(
      `Request to ${new URL(url).origin} failed with status ${response.status}.`,
    );
  }
  return response;
}

async function railwayGraphql(query, variables = {}, env = process.env) {
  const response = await request(RAILWAY_API, {
    method: "POST",
    headers: railwayHeaders(env),
    body: JSON.stringify({ query, variables }),
  });
  const payload = await response.json();
  if (payload.errors?.length) {
    fail(
      `Railway API rejected the release operation: ${payload.errors[0].message}`,
    );
  }
  if (!payload.data) fail("Railway API returned no data.");
  return payload.data;
}

async function netlify(pathname, options = {}, env = process.env) {
  return request(`${NETLIFY_API}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${requiredEnv("NETLIFY_AUTH_TOKEN", env)}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
}

function sortDeployments(deployments) {
  return [...deployments].sort(
    (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
  );
}

export function chooseRailwayBaseline(deployments, recoveryRelease = false) {
  const ordered = sortDeployments(deployments);
  if (ordered.length === 0) fail("Railway returned no Production deployments.");
  const successful = ordered.find(
    (deployment) => deployment.status === "SUCCESS",
  );
  if (!successful && !recoveryRelease) {
    fail("Railway has no successful Production deployment.");
  }
  const current = successful ?? ordered[0];
  const rollbackTarget = ordered.find(
    (deployment) =>
      deployment.status === "SUCCESS" && deployment.canRollback === true,
  );
  if (!rollbackTarget && !recoveryRelease) {
    fail(
      "Railway exposes no successful deployment with canRollback=true; Production mutation is blocked.",
    );
  }
  return { current, rollbackTarget };
}

async function readRailwayDeployments(env = process.env) {
  const data = await railwayGraphql(
    `query ProductionDeployments($input: DeploymentListInput!) {
      deployments(input: $input, first: 20) {
        edges { node { id status createdAt updatedAt projectId serviceId environmentId canRollback } }
      }
    }`,
    {
      input: {
        projectId: requiredEnv("RAILWAY_PROJECT_ID", env),
        serviceId: requiredEnv("RAILWAY_SERVICE_ID", env),
      },
    },
    env,
  );
  const deployments = (
    data.deployments?.edges?.map((edge) => edge.node) ?? []
  ).filter(
    (deployment) =>
      deployment.environmentId === requiredEnv("RAILWAY_ENVIRONMENT_ID", env),
  );
  for (const deployment of deployments) {
    if (
      deployment.projectId !== requiredEnv("RAILWAY_PROJECT_ID", env) ||
      deployment.serviceId !== requiredEnv("RAILWAY_SERVICE_ID", env) ||
      deployment.environmentId !== requiredEnv("RAILWAY_ENVIRONMENT_ID", env)
    ) {
      fail(
        "Railway returned a deployment outside the approved Production target.",
      );
    }
  }
  return sortDeployments(deployments);
}

async function proveRailwayScope(env = process.env) {
  if (env.RAILWAY_TOKEN_TYPE === "project") {
    const data = await railwayGraphql(
      `query ProductionProjectToken { projectToken { projectId environmentId } }`,
      {},
      env,
    );
    if (
      data.projectToken?.projectId !== requiredEnv("RAILWAY_PROJECT_ID", env) ||
      data.projectToken?.environmentId !==
        requiredEnv("RAILWAY_ENVIRONMENT_ID", env)
    ) {
      fail(
        "Railway project token is not scoped to the approved Production target.",
      );
    }
    return;
  }
  const data = await railwayGraphql(
    `query ProductionProject($id: String!) {
      project(id: $id) {
        id
        services { edges { node { id } } }
        environments { edges { node { id } } }
      }
    }`,
    { id: requiredEnv("RAILWAY_PROJECT_ID", env) },
    env,
  );
  const services =
    data.project?.services?.edges?.map((edge) => edge.node.id) ?? [];
  const environments =
    data.project?.environments?.edges?.map((edge) => edge.node.id) ?? [];
  if (
    data.project?.id !== requiredEnv("RAILWAY_PROJECT_ID", env) ||
    !services.includes(requiredEnv("RAILWAY_SERVICE_ID", env)) ||
    !environments.includes(requiredEnv("RAILWAY_ENVIRONMENT_ID", env))
  ) {
    fail("Railway token cannot prove the approved Production project target.");
  }
}

export function validateRailwayVariables(
  variables,
  configuration,
  env = process.env,
) {
  const exact = {
    APP_ENV: "production",
    AMOS_RUNTIME_MODE: "production",
    AMOS_ENVIRONMENT_ID: "amos-ops-production",
    CREDENTIAL_NAMESPACE: "amos-ops/production",
    NODE_ENV: "production",
    PERSISTENT_ROOT: requiredEnv("PERSISTENT_ROOT", env),
    RAILWAY_VOLUME_MOUNT_PATH: requiredEnv("PERSISTENT_ROOT", env),
    DATABASE_PATH: requiredEnv("DATABASE_PATH", env),
    TRAINING_DATABASE_PATH: requiredEnv("TRAINING_DATABASE_PATH", env),
    UPLOAD_PATH: requiredEnv("UPLOAD_PATH", env),
    TRAINING_UPLOAD_PATH: requiredEnv("TRAINING_UPLOAD_PATH", env),
    BACKUP_PATH: requiredEnv("BACKUP_PATH", env),
    ALLOW_SELF_REGISTRATION: "false",
    MFA_POLICY: "required-all",
    AMOS_PRODUCTION_RELEASE_AUTHORIZED: "true",
    AMOS_ALLOWED_ORIGINS: configuration.allowedOrigins,
  };
  for (const [name, expected] of Object.entries(exact)) {
    if (variables?.[name] !== expected)
      fail(`Railway Production variable ${name} is missing or contradictory.`);
  }
  const expectedRm2Status = requiredEnv("EXPECTED_RM2_STATUS", env);
  if (
    variables?.AMOS_RM2_STATUS !== undefined &&
    variables.AMOS_RM2_STATUS !== expectedRm2Status
  ) {
    fail("Railway Production variable AMOS_RM2_STATUS is contradictory.");
  }
  const encryptionRequired = variables?.AMOS_STORAGE_ENCRYPTION_REQUIRED;
  if (
    expectedRm2Status === "paused" &&
    typeof encryptionRequired === "string" &&
    ["1", "true", "yes", "on"].includes(encryptionRequired.trim().toLowerCase())
  ) {
    fail(
      "Railway Production variable AMOS_STORAGE_ENCRYPTION_REQUIRED contradicts paused RM.2.",
    );
  }
  if (
    expectedRm2Status === "active" &&
    (typeof encryptionRequired !== "string" ||
      !["1", "true", "yes", "on"].includes(
        encryptionRequired.trim().toLowerCase(),
      ))
  ) {
    fail(
      "Railway Production variable AMOS_STORAGE_ENCRYPTION_REQUIRED must be enabled when RM.2 is active.",
    );
  }
  if (expectedRm2Status === "paused") {
    const migrationMode = variables?.AMOS_STORAGE_MIGRATION_MODE;
    if (
      typeof migrationMode === "string" &&
      migrationMode.trim() &&
      migrationMode.trim().toLowerCase() !== "none"
    ) {
      fail(
        "Railway Production variable AMOS_STORAGE_MIGRATION_MODE contradicts paused RM.2.",
      );
    }
    if (
      typeof variables?.AMOS_STORAGE_MIGRATION_CONFIRMATION === "string" &&
      variables.AMOS_STORAGE_MIGRATION_CONFIRMATION.trim()
    ) {
      fail(
        "Railway Production variable AMOS_STORAGE_MIGRATION_CONFIRMATION must be absent while RM.2 is paused.",
      );
    }
  }
  for (const name of ["APP_SECRET", "JWT_SECRET"]) {
    const value = variables?.[name];
    if (
      typeof value !== "string" ||
      value.length < 32 ||
      /placeholder|changeme|example/i.test(value)
    ) {
      fail(
        `Railway Production variable ${name} is not a valid protected secret.`,
      );
    }
  }
  for (const name of [
    "DEPLOYMENT_APPROVAL_ID",
    "DEPLOYMENT_CHANGE_REFERENCE",
    "AMOS_PRODUCTION_RELEASE_ID",
  ]) {
    if (
      typeof variables?.[name] !== "string" ||
      variables[name].trim().length < 2
    ) {
      fail(`Railway Production variable ${name} is not active.`);
    }
  }
}

async function readRailwayVariables(configuration, env = process.env) {
  const data = await railwayGraphql(
    `query ProductionVariables($projectId: String!, $environmentId: String!, $serviceId: String!) {
      variables(projectId: $projectId, environmentId: $environmentId, serviceId: $serviceId)
    }`,
    {
      projectId: requiredEnv("RAILWAY_PROJECT_ID", env),
      environmentId: requiredEnv("RAILWAY_ENVIRONMENT_ID", env),
      serviceId: requiredEnv("RAILWAY_SERVICE_ID", env),
    },
    env,
  );
  validateRailwayVariables(data.variables, configuration, env);
}

export function validateNetlifyReleasePath(
  site,
  env = process.env,
  options = { requireStoppedBuilds: true },
) {
  const siteId = requiredEnv("NETLIFY_SITE_ID", env);
  if (site?.id !== siteId) fail("Netlify token resolved a different site ID.");
  const expectedHost = new URL(requiredEnv("NETLIFY_PUBLIC_ORIGIN", env))
    .hostname;
  if (site.custom_domain !== expectedHost) {
    fail("Netlify site is not bound to the approved amos-ops.com domain.");
  }
  if (site.prevent_non_git_prod_deploys === true) {
    fail("Netlify is configured to reject the protected manual release path.");
  }
  if (
    options.requireStoppedBuilds &&
    site.build_settings?.stop_builds !== true
  ) {
    fail(
      "Netlify Git builds must be stopped so Production can change only through the protected matching-pair workflow.",
    );
  }
}

async function enforceNetlifyReleasePath(env = process.env) {
  const siteId = requiredEnv("NETLIFY_SITE_ID", env);
  const beforeResponse = await netlify(`/sites/${siteId}`, {}, env);
  const before = await beforeResponse.json();
  validateNetlifyReleasePath(before, env, { requireStoppedBuilds: false });
  if (before.build_settings?.stop_builds !== true) {
    await netlify(
      `/sites/${siteId}`,
      {
        method: "PATCH",
        body: JSON.stringify({ build_settings: { stop_builds: true } }),
      },
      env,
    );
  }
  const afterResponse = await netlify(`/sites/${siteId}`, {}, env);
  const after = await afterResponse.json();
  validateNetlifyReleasePath(after, env);
  return { siteId, gitBuildsStopped: true, manualReleasePathAvailable: true };
}

async function readNetlifyState(env = process.env) {
  const siteId = requiredEnv("NETLIFY_SITE_ID", env);
  const [siteResponse, deployResponse] = await Promise.all([
    netlify(`/sites/${siteId}`, {}, env),
    netlify(`/sites/${siteId}/deploys?per_page=100`, {}, env),
  ]);
  const site = await siteResponse.json();
  const deploys = await deployResponse.json();
  validateNetlifyReleasePath(site, env);
  const current = chooseNetlifyPublishedDeploy(site, deploys);
  if (!current?.id) fail("Netlify has no current Production deploy.");
  return { site, deploys, current };
}

export function chooseNetlifyPublishedDeploy(site, deploys) {
  const publishedId = site?.published_deploy?.id;
  if (typeof publishedId !== "string" || !publishedId) return null;
  return (
    deploys.find((deploy) => deploy.id === publishedId) ??
    site.published_deploy
  );
}

function parseManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("Release manifest is not an object.");
  }
  if (value.schemaVersion !== 1)
    fail("Release manifest schemaVersion must be numeric 1.");
  if (!RELEASE_ID.test(value.releaseId ?? ""))
    fail("Release manifest releaseId is invalid.");
  for (const name of ["commitSha", "treeSha"]) {
    if (!SHA1.test(value[name] ?? ""))
      fail(`Release manifest ${name} is invalid.`);
  }
  for (const name of [
    "sourceDigest",
    "frontendArtifactDigest",
    "backendArtifactDigest",
  ]) {
    if (!SHA256.test(value[name] ?? ""))
      fail(`Release manifest ${name} is invalid.`);
  }
  return value;
}

async function optionalPublicManifest(
  origin,
  pathname = "/release-manifest.json",
) {
  try {
    const response = await request(`${origin}${pathname}`);
    return parseManifest(await response.json());
  } catch {
    return null;
  }
}

async function createSnapshot(configuration, env = process.env) {
  await proveRailwayScope(env);
  await readRailwayVariables(configuration, env);
  const [railwayDeployments, netlifyState, readiness] = await Promise.all([
    readRailwayDeployments(env),
    readNetlifyState(env),
    readRailwayReadiness(configuration.railwayOrigin),
  ]);
  const { current, rollbackTarget } = chooseRailwayBaseline(
    railwayDeployments,
    configuration.recoveryRelease,
  );
  assertRailwayBaselineReadiness(readiness, configuration.recoveryRelease);
  const [railwayManifest, netlifyManifest] = await Promise.all([
    optionalPublicManifest(
      configuration.railwayOrigin,
      "/api/release-identity",
    ),
    optionalPublicManifest(configuration.netlifyOrigin),
  ]);
  return {
    schemaVersion: 1,
    capturedAt: new Date().toISOString(),
    releaseId: configuration.releaseId,
    releaseSha: configuration.releaseSha,
    recoveryRelease: configuration.recoveryRelease,
    baselineReady: readiness?.ready === true,
    targets: {
      railway: {
        projectId: requiredEnv("RAILWAY_PROJECT_ID", env),
        environmentId: requiredEnv("RAILWAY_ENVIRONMENT_ID", env),
        serviceId: requiredEnv("RAILWAY_SERVICE_ID", env),
        origin: configuration.railwayOrigin,
        currentDeploymentId: current.id,
        rollbackTargetDeploymentId: rollbackTarget?.id ?? null,
        observedDeploymentIds: railwayDeployments.map(
          (deployment) => deployment.id,
        ),
        releaseManifest: railwayManifest,
      },
      netlify: {
        siteId: requiredEnv("NETLIFY_SITE_ID", env),
        origin: configuration.netlifyOrigin,
        currentDeployId: netlifyState.current.id,
        releaseManifest: netlifyManifest,
      },
    },
  };
}

async function readRailwayReadiness(origin) {
  try {
    const response = await request(`${origin}/api/health/ready`);
    return await response.json();
  } catch {
    return null;
  }
}

export function assertRailwayBaselineReadiness(readiness, recoveryRelease) {
  if (readiness?.ready === true) return;
  if (!recoveryRelease) fail("Railway Production readiness is not true.");
}

function readJson(filePath) {
  return JSON.parse(readFileSync(path.resolve(filePath), "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(path.resolve(filePath), `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
}

function requireValue(values, name) {
  if (!values[name]) fail(`--${name} is required.`);
  return values[name];
}

async function assertSnapshot(snapshot, env = process.env) {
  const [deployments, netlifyState] = await Promise.all([
    readRailwayDeployments(env),
    readNetlifyState(env),
  ]);
  const { current } = chooseRailwayBaseline(
    deployments,
    snapshot.recoveryRelease === true,
  );
  if (current.id !== snapshot.targets.railway.currentDeploymentId) {
    fail("Railway Production changed after preflight; release is stopped.");
  }
  if (netlifyState.current.id !== snapshot.targets.netlify.currentDeployId) {
    fail("Netlify Production changed after preflight; release is stopped.");
  }
}

async function waitForRailway(snapshot, env = process.env) {
  const seen = new Set(snapshot.targets.railway.observedDeploymentIds);
  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const deployments = await readRailwayDeployments(env);
    const candidate = deployments.find(
      (deployment) => !seen.has(deployment.id),
    );
    if (candidate) {
      if (candidate.status === "SUCCESS") {
        return {
          schemaVersion: 1,
          deploymentId: candidate.id,
          status: candidate.status,
          verifiedAt: new Date().toISOString(),
        };
      }
      if (TERMINAL_FAILURES.has(candidate.status)) {
        fail(
          `New Railway deployment entered terminal status ${candidate.status}.`,
        );
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  fail("Timed out waiting for the new Railway Production deployment.");
}

function manifestsEqual(left, right) {
  return MANIFEST_FIELDS.every((name) => left[name] === right[name]);
}

async function verifyLive(values, configuration, env = process.env) {
  const expectedBytes = readFileSync(
    path.resolve(requireValue(values, "manifest")),
  );
  const expected = parseManifest(JSON.parse(expectedBytes.toString("utf8")));
  if (
    expected.releaseId !== configuration.releaseId ||
    expected.commitSha !== configuration.releaseSha
  ) {
    fail("Local release manifest does not match the approved release inputs.");
  }
  const railwayDeploy = readJson(requireValue(values, "railway"));
  const netlifyCli = readJson(requireValue(values, "netlify"));
  const netlifyDeployId = netlifyCli.deploy_id ?? netlifyCli.id;
  if (!railwayDeploy.deploymentId || !netlifyDeployId) {
    fail("Host deployment IDs were not captured.");
  }

  const [
    railwayStaticResponse,
    netlifyStaticResponse,
    railwayIdentityResponse,
    liveResponse,
    readyResponse,
    runtimeResponse,
    operatorResponse,
    netlifyHomeResponse,
    railwayState,
    netlifyState,
  ] = await Promise.all([
    request(`${configuration.railwayOrigin}/release-manifest.json`),
    request(`${configuration.netlifyOrigin}/release-manifest.json`),
    request(`${configuration.railwayOrigin}/api/release-identity`),
    request(`${configuration.railwayOrigin}/api/health/live`),
    request(`${configuration.railwayOrigin}/api/health/ready`),
    request(`${configuration.railwayOrigin}/api/runtime-config`, {
      headers: { Origin: configuration.netlifyOrigin },
    }),
    request(
      `${configuration.railwayOrigin}/api/operator/identity/diagnosis`,
      {},
      [401],
    ),
    request(`${configuration.netlifyOrigin}/`),
    readRailwayDeployments(env),
    readNetlifyState(env),
  ]);

  const railwayBytes = Buffer.from(await railwayStaticResponse.arrayBuffer());
  const netlifyBytes = Buffer.from(await netlifyStaticResponse.arrayBuffer());
  if (
    !expectedBytes.equals(railwayBytes) ||
    !expectedBytes.equals(netlifyBytes)
  ) {
    fail(
      "Railway and Netlify do not serve the byte-identical release manifest.",
    );
  }
  const railwayIdentity = await railwayIdentityResponse.json();
  if (
    railwayIdentity.verified !== true ||
    !manifestsEqual(expected, railwayIdentity)
  ) {
    fail(
      "Railway release-identity fields do not match the immutable manifest.",
    );
  }
  const live = await liveResponse.json();
  const ready = await readyResponse.json();
  const runtime = await runtimeResponse.json();
  const home = await netlifyHomeResponse.text();
  if (
    live.status !== "alive" ||
    live.buildId !== expected.releaseId ||
    ready.ready !== true ||
    runtime.productionReleaseAuthorized !== true ||
    runtime.productionReleaseId !== expected.releaseId ||
    runtime.buildId !== expected.releaseId ||
    runtime.evaluationMode !== false
  ) {
    fail("Post-deploy health/runtime identity checks did not pass.");
  }
  if (
    runtimeResponse.headers.get("access-control-allow-origin") !==
    configuration.netlifyOrigin
  ) {
    fail(
      "Railway CORS does not authorize the exact Netlify Production origin.",
    );
  }
  if (operatorResponse.status !== 401)
    fail("Unsigned identity operations are not protected.");
  if (!/<div[^>]+id=["']root["']/i.test(home) || !/<script/i.test(home)) {
    fail("Netlify Production returned an incomplete application shell.");
  }
  const activeRailway = railwayState.find((item) => item.status === "SUCCESS");
  if (activeRailway?.id !== railwayDeploy.deploymentId) {
    fail(
      "Railway deployment ID is no longer the active successful deployment.",
    );
  }
  if (netlifyState.current.id !== netlifyDeployId) {
    fail("Netlify deploy ID is not the current Production deploy.");
  }
  return {
    schemaVersion: 1,
    verifiedAt: new Date().toISOString(),
    releaseIdentity: expected,
    railwayDeploymentId: railwayDeploy.deploymentId,
    netlifyDeployId,
    matchingReleasePair: true,
    healthReady: true,
    identityBoundaryProtected: true,
  };
}

async function getRailwayDeployment(id, env = process.env) {
  const data = await railwayGraphql(
    `query ProductionDeployment($id: String!) {
      deployment(id: $id) { id status projectId environmentId serviceId canRollback }
    }`,
    { id },
    env,
  );
  const deployment = data.deployment;
  if (
    !deployment ||
    deployment.projectId !== requiredEnv("RAILWAY_PROJECT_ID", env) ||
    deployment.environmentId !== requiredEnv("RAILWAY_ENVIRONMENT_ID", env) ||
    deployment.serviceId !== requiredEnv("RAILWAY_SERVICE_ID", env)
  ) {
    fail("Railway rollback target is outside the approved Production service.");
  }
  return deployment;
}

async function rollbackRailway(snapshot, env = process.env) {
  if (!snapshot.targets.railway.rollbackTargetDeploymentId) {
    return {
      targetDeploymentId: null,
      rollbackDeploymentId: null,
      skipped: true,
      state: "unavailable-before-recovery",
    };
  }
  const preferred = await getRailwayDeployment(
    snapshot.targets.railway.currentDeploymentId,
    env,
  );
  const target = preferred.canRollback
    ? preferred
    : await getRailwayDeployment(
        snapshot.targets.railway.rollbackTargetDeploymentId,
        env,
      );
  if (target.status !== "SUCCESS" || target.canRollback !== true) {
    fail("Railway rollback target is no longer restorable.");
  }
  const data = await railwayGraphql(
    `mutation ProductionRollback($id: String!) {
      deploymentRollback(id: $id) { id }
    }`,
    { id: target.id },
    env,
  );
  const rollbackId = data.deploymentRollback?.id ?? data.deploymentRollback;
  if (typeof rollbackId !== "string")
    fail("Railway did not return a rollback deployment ID.");

  const deadline = Date.now() + 12 * 60_000;
  while (Date.now() < deadline) {
    const deployment = await getRailwayDeployment(rollbackId, env);
    if (deployment.status === "SUCCESS") {
      return {
        targetDeploymentId: target.id,
        rollbackDeploymentId: rollbackId,
      };
    }
    if (TERMINAL_FAILURES.has(deployment.status)) {
      fail(`Railway rollback entered terminal status ${deployment.status}.`);
    }
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  fail("Timed out waiting for Railway rollback.");
}

async function rollbackNetlify(snapshot, env = process.env) {
  const state = await readNetlifyState(env);
  const targetId = snapshot.targets.netlify.currentDeployId;
  if (state.current.id === targetId) {
    return {
      targetDeployId: targetId,
      restored: false,
      state: "already-current",
    };
  }
  const response = await netlify(
    `/sites/${requiredEnv("NETLIFY_SITE_ID", env)}/deploys/${targetId}/restore`,
    { method: "POST", body: "{}" },
    env,
  );
  const restored = await response.json();
  if (restored.id !== targetId || restored.state !== "current") {
    fail("Netlify did not restore the captured Production deploy.");
  }
  return { targetDeployId: targetId, restored: true, state: restored.state };
}

async function rollbackBoth(snapshot, configuration, env = process.env) {
  const [railway, netlifyResult] = await Promise.allSettled([
    rollbackRailway(snapshot, env),
    rollbackNetlify(snapshot, env),
  ]);
  const evidence = {
    schemaVersion: 1,
    attemptedAt: new Date().toISOString(),
    railway:
      railway.status === "fulfilled"
        ? { status: "restored", ...railway.value }
        : { status: "failed", reason: railway.reason?.message ?? "unknown" },
    netlify:
      netlifyResult.status === "fulfilled"
        ? { status: "restored", ...netlifyResult.value }
        : {
            status: "failed",
            reason: netlifyResult.reason?.message ?? "unknown",
          },
  };
  if (railway.status === "rejected" || netlifyResult.status === "rejected") {
    return { evidence, failed: true };
  }
  const netlifyState = await readNetlifyState(env);
  if (netlifyState.current.id !== snapshot.targets.netlify.currentDeployId) {
    evidence.verification = "failed";
    return { evidence, failed: true };
  }
  if (
    snapshot.baselineReady === false &&
    !snapshot.targets.railway.rollbackTargetDeploymentId
  ) {
    evidence.verification =
      "netlify-restored-railway-unavailable-before-recovery";
    return { evidence, failed: false };
  }
  const health = await request(
    `${configuration.railwayOrigin}/api/health/ready`,
  );
  const readiness = await health.json();
  if (readiness.ready !== true) {
    evidence.verification = "failed";
    return { evidence, failed: true };
  }
  evidence.verification = "restored-and-ready";
  return { evidence, failed: false };
}

async function main() {
  const { command, values } = parseCommandArgs(process.argv.slice(2));
  const configuration = validateConfiguration();
  if (command === "enforce-netlify-release-path") {
    const result = await enforceNetlifyReleasePath();
    writeJson(requireValue(values, "output"), result);
    process.stdout.write(
      "Netlify Git builds are stopped; protected manual Production releases remain available.\n",
    );
    return;
  }
  if (command === "preflight") {
    const snapshot = await createSnapshot(configuration);
    writeJson(requireValue(values, "output"), snapshot);
    process.stdout.write(
      "Production preflight and rollback readiness passed.\n",
    );
    return;
  }
  if (command === "assert-snapshot") {
    await assertSnapshot(readJson(requireValue(values, "snapshot")));
    process.stdout.write("Production targets remain unchanged.\n");
    return;
  }
  if (command === "wait-railway") {
    const result = await waitForRailway(
      readJson(requireValue(values, "snapshot")),
    );
    writeJson(requireValue(values, "output"), result);
    process.stdout.write(
      `Railway deployment ${result.deploymentId} is successful.\n`,
    );
    return;
  }
  if (command === "verify-live") {
    const result = await verifyLive(values, configuration);
    writeJson(requireValue(values, "output"), result);
    process.stdout.write(
      "Railway and Netlify expose one matching release identity.\n",
    );
    return;
  }
  if (command === "rollback") {
    const { evidence, failed } = await rollbackBoth(
      readJson(requireValue(values, "snapshot")),
      configuration,
    );
    writeJson(requireValue(values, "output"), evidence);
    if (failed)
      fail("At least one Production rollback target was not restored.");
    process.stdout.write("Both Production hosts were restored and verified.\n");
    return;
  }
  fail(`Unknown release-control command: ${command}`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((error) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
}
