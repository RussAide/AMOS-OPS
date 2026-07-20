import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseRailwayBaseline,
  chooseNetlifyPublishedDeploy,
  assertRailwayBaselineReadiness,
  parseCommandArgs,
  validateConfiguration,
  validateNetlifyReleasePath,
  validateRailwayVariables,
} from "./production-release-control.mjs";

const env = {
  RELEASE_SHA: "a".repeat(40),
  RELEASE_ID: "AMOS-OPS-PRODUCTION-20260720-001",
  CHANGE_REFERENCE: "AUTH.STAB.1",
  RECOVERY_RELEASE: "false",
  RAILWAY_CREDENTIAL: "r".repeat(32),
  RAILWAY_TOKEN_TYPE: "project",
  RAILWAY_PROJECT_ID: "f9357da4-00c4-4f25-a52d-5c53f6ce07dc",
  RAILWAY_SERVICE_ID: "8fdf6d7e-c7ba-412d-95f0-8b980ba612ba",
  RAILWAY_ENVIRONMENT_ID: "7c22d214-abac-478f-983b-1418a7cbac77",
  RAILWAY_PUBLIC_ORIGIN: "https://amos-ops-production.up.railway.app",
  NETLIFY_AUTH_TOKEN: "n".repeat(32),
  NETLIFY_SITE_ID: "11111111-2222-4333-8444-555555555555",
  NETLIFY_PUBLIC_ORIGIN: "https://amos-ops.com",
  EXPECTED_ALLOWED_ORIGINS: "https://amos-ops.com,https://www.amos-ops.com",
  EXPECTED_RM2_STATUS: "paused",
  PERSISTENT_ROOT: "/app/persistent",
  DATABASE_PATH: "/app/persistent/data/production/amos-ops.db",
  TRAINING_DATABASE_PATH:
    "/app/persistent/data/production/training/amos-ops-training.db",
  UPLOAD_PATH: "/app/persistent/uploads/production",
  TRAINING_UPLOAD_PATH: "/app/persistent/uploads/production/training",
  BACKUP_PATH: "/app/persistent/backups/production",
};

test("accepts only an exact protected Production target", () => {
  const result = validateConfiguration(env);
  assert.equal(result.releaseSha, env.RELEASE_SHA);
  assert.equal(result.railwayOrigin, env.RAILWAY_PUBLIC_ORIGIN);
  assert.equal(result.netlifyOrigin, env.NETLIFY_PUBLIC_ORIGIN);
});

test("rejects branch names and wildcard origins", () => {
  assert.throws(
    () => validateConfiguration({ ...env, RELEASE_SHA: "main" }),
    /exact lowercase Git SHA/,
  );
  assert.throws(
    () =>
      validateConfiguration({
        ...env,
        EXPECTED_ALLOWED_ORIGINS: "https://amos-ops.com,*",
      }),
    /contain no wildcard/,
  );
});

test("requires an explicit recovery posture and limits unhealthy baselines to recovery", () => {
  assert.equal(validateConfiguration(env).recoveryRelease, false);
  assert.equal(
    validateConfiguration({ ...env, RECOVERY_RELEASE: "true" })
      .recoveryRelease,
    true,
  );
  assert.throws(
    () => validateConfiguration({ ...env, RECOVERY_RELEASE: "yes" }),
    /RECOVERY_RELEASE/,
  );
  assert.doesNotThrow(() => assertRailwayBaselineReadiness({ ready: true }, false));
  assert.throws(
    () => assertRailwayBaselineReadiness(null, false),
    /readiness is not true/,
  );
  assert.doesNotThrow(() => assertRailwayBaselineReadiness(null, true));
});

test("selects a successful active deployment and proven rollback target", () => {
  const deployments = [
    {
      id: "current",
      status: "SUCCESS",
      canRollback: false,
      createdAt: "2026-07-20T12:00:00Z",
    },
    {
      id: "rollback",
      status: "SUCCESS",
      canRollback: true,
      createdAt: "2026-07-20T11:00:00Z",
    },
  ];
  assert.deepEqual(chooseRailwayBaseline(deployments), {
    current: deployments[0],
    rollbackTarget: deployments[1],
  });
  assert.throws(
    () => chooseRailwayBaseline([deployments[0]]),
    /mutation is blocked/,
  );
  const failedOnly = [
    {
      id: "latest-failed",
      status: "FAILED",
      canRollback: false,
      createdAt: "2026-07-20T13:00:00Z",
    },
    {
      id: "older-removed",
      status: "REMOVED",
      canRollback: false,
      createdAt: "2026-07-20T12:00:00Z",
    },
  ];
  assert.throws(
    () => chooseRailwayBaseline(failedOnly),
    /no successful Production deployment/,
  );
  assert.deepEqual(chooseRailwayBaseline(failedOnly, true), {
    current: failedOnly[0],
    rollbackTarget: undefined,
  });
});

test("resolves the active Netlify Production deploy from published_deploy", () => {
  const published = {
    id: "published-production-deploy",
    state: "ready",
    published_at: "2026-07-20T14:00:00Z",
  };
  const older = {
    id: "older-production-deploy",
    state: "ready",
    published_at: "2026-07-19T14:00:00Z",
  };
  assert.equal(
    chooseNetlifyPublishedDeploy(
      { published_deploy: published },
      [older, published],
    ),
    published,
  );
  assert.equal(
    chooseNetlifyPublishedDeploy({ published_deploy: published }, []),
    published,
  );
  assert.equal(chooseNetlifyPublishedDeploy({}, [published]), null);
});

test("requires all persistent paths and identity controls on Railway", () => {
  const configuration = validateConfiguration(env);
  const variables = {
    APP_ENV: "production",
    AMOS_RUNTIME_MODE: "production",
    AMOS_ENVIRONMENT_ID: "amos-ops-production",
    CREDENTIAL_NAMESPACE: "amos-ops/production",
    NODE_ENV: "production",
    PERSISTENT_ROOT: env.PERSISTENT_ROOT,
    RAILWAY_VOLUME_MOUNT_PATH: env.PERSISTENT_ROOT,
    DATABASE_PATH: env.DATABASE_PATH,
    TRAINING_DATABASE_PATH: env.TRAINING_DATABASE_PATH,
    UPLOAD_PATH: env.UPLOAD_PATH,
    TRAINING_UPLOAD_PATH: env.TRAINING_UPLOAD_PATH,
    BACKUP_PATH: env.BACKUP_PATH,
    ALLOW_SELF_REGISTRATION: "false",
    MFA_POLICY: "required-all",
    AMOS_PRODUCTION_RELEASE_AUTHORIZED: "true",
    AMOS_ALLOWED_ORIGINS: env.EXPECTED_ALLOWED_ORIGINS,
    APP_SECRET: "s".repeat(64),
    JWT_SECRET: "j".repeat(64),
    DEPLOYMENT_APPROVAL_ID: "approved",
    DEPLOYMENT_CHANGE_REFERENCE: "AUTH.STAB.1",
    AMOS_PRODUCTION_RELEASE_ID: "previous-valid-release",
  };
  assert.doesNotThrow(() =>
    validateRailwayVariables(variables, configuration, env),
  );
  assert.throws(
    () =>
      validateRailwayVariables(
        { ...variables, DATABASE_PATH: "/tmp/db" },
        configuration,
        env,
      ),
    /DATABASE_PATH/,
  );
  assert.throws(
    () =>
      validateRailwayVariables(
        { ...variables, MFA_POLICY: "optional" },
        configuration,
        env,
      ),
    /MFA_POLICY/,
  );
  assert.throws(
    () =>
      validateRailwayVariables(
        { ...variables, AMOS_RM2_STATUS: "active" },
        configuration,
        env,
      ),
    /AMOS_RM2_STATUS/,
  );
  assert.doesNotThrow(() =>
    validateRailwayVariables(
      { ...variables, AMOS_RM2_STATUS: "paused" },
      configuration,
      env,
    ),
  );
});

test("parses explicit control commands without accepting flags without values", () => {
  assert.deepEqual(parseCommandArgs(["preflight", "--output", "proof.json"]), {
    command: "preflight",
    values: { output: "proof.json" },
  });
  assert.throws(
    () => parseCommandArgs(["preflight", "--output"]),
    /Invalid argument/,
  );
});

test("requires Netlify Git builds stopped while preserving protected manual deploys", () => {
  const site = {
    id: env.NETLIFY_SITE_ID,
    custom_domain: "amos-ops.com",
    prevent_non_git_prod_deploys: false,
    build_settings: { stop_builds: true },
  };
  assert.doesNotThrow(() => validateNetlifyReleasePath(site, env));
  assert.throws(
    () =>
      validateNetlifyReleasePath(
        { ...site, build_settings: { stop_builds: false } },
        env,
      ),
    /Git builds must be stopped/,
  );
  assert.throws(
    () =>
      validateNetlifyReleasePath(
        { ...site, prevent_non_git_prod_deploys: true },
        env,
      ),
    /reject the protected manual release path/,
  );
});
