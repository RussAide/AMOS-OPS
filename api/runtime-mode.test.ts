import { describe, expect, it } from "vitest";
import { buildEnvironmentConfig } from "./lib/env";
import { createPublicRuntimeConfig } from "./runtime-mode";

const testCredential = (scope: string) =>
  `not-a-secret-test-fixture-${scope}-${"x".repeat(32)}`;
const testMfaCode = () => ["48", "27", "31"].join("");

describe("public runtime mode contract", () => {
  it("publishes a synthetic-only demo boundary", () => {
    const environment = buildEnvironmentConfig({
      APP_ENV: "demo",
      AMOS_RUNTIME_MODE: "demo",
      NODE_ENV: "production",
    });

    expect(createPublicRuntimeConfig(environment, "build-001")).toEqual({
      schemaVersion: 2,
      mode: "demo",
      appEnvironment: "demo",
      environmentId: "amos-ops-demo",
      apiUrl: "/api/trpc",
      evaluationMode: true,
      productionReleaseAuthorized: false,
      productionReleaseId: null,
      deploymentPosture: "demo",
      reviewDeployment: false,
      candidateId: null,
      buildId: "build-001",
      banner:
        "DEMO — FICTIONAL DATA — NOT FOR CARE DELIVERY — LIVE WRITES BLOCKED",
      safeguards: {
        syntheticDataOnly: true,
        evaluationFallbacksAllowed: true,
        productionDataAllowed: false,
        externalWritesAllowed: false,
      },
    });
  });

  it("publishes an isolated synthetic review on the production pathway", () => {
    const environment = buildEnvironmentConfig({
      APP_ENV: "staging",
      AMOS_RUNTIME_MODE: "production",
      NODE_ENV: "production",
      DATABASE_PATH: "/data/staging/amos-ops.db",
      UPLOAD_PATH: "/uploads/staging",
      CREDENTIAL_NAMESPACE: "amos-ops/staging",
      APP_SECRET: testCredential("review-app"),
      JWT_SECRET: testCredential("review-jwt"),
      DEPLOYMENT_APPROVAL_ID: "DMS1-REVIEW",
      DEPLOYMENT_CHANGE_REFERENCE: "DMS1-RC1",
      AMOS_ALLOWED_ORIGINS: "https://review.example.invalid",
      ALLOW_SELF_REGISTRATION: "false",
      MFA_POLICY: "required-all",
      AMOS_REVIEW_DEPLOYMENT: "true",
      AMOS_FINAL_GATE_OWNER_EMAIL: "owner@amos-ops.invalid",
      AMOS_FINAL_GATE_CANDIDATE_ID: "DMS.1",
      AMOS_BUILD_ID: "DMS.1-RC1",
      AMOS_SOURCE_DIGEST: "a".repeat(64),
      AMOS_REVIEW_OWNER_PASSWORD_HASH: `$2b$12$${"b".repeat(53)}`,
      AMOS_REVIEW_OWNER_MFA_CODE: testMfaCode(),
    });

    expect(createPublicRuntimeConfig(environment)).toMatchObject({
      schemaVersion: 2,
      mode: "production",
      deploymentPosture: "release-review",
      reviewDeployment: true,
      candidateId: "DMS.1",
      evaluationMode: false,
      productionReleaseAuthorized: false,
      safeguards: {
        syntheticDataOnly: true,
        evaluationFallbacksAllowed: false,
        productionDataAllowed: false,
        externalWritesAllowed: false,
      },
    });
  });

  it("publishes production capability only after the startup release gate", () => {
    const environment = buildEnvironmentConfig({
      APP_ENV: "production",
      AMOS_RUNTIME_MODE: "production",
      NODE_ENV: "production",
      DATABASE_PATH: "/data/production/amos-ops.db",
      UPLOAD_PATH: "/uploads/production",
      CREDENTIAL_NAMESPACE: "amos-ops/production",
      APP_SECRET: testCredential("production-app"),
      JWT_SECRET: testCredential("production-jwt"),
      DEPLOYMENT_APPROVAL_ID: "APR-2026-001",
      DEPLOYMENT_CHANGE_REFERENCE: "CHG-2026-001",
      AMOS_ALLOWED_ORIGINS: "https://amos.example.invalid",
      ALLOW_SELF_REGISTRATION: "false",
      MFA_POLICY: "required-all",
      AMOS_PRODUCTION_RELEASE_AUTHORIZED: "true",
      AMOS_PRODUCTION_RELEASE_ID: "RG1-GO-2026-001",
    });

    expect(createPublicRuntimeConfig(environment, "build-001")).toMatchObject({
      mode: "production",
      evaluationMode: false,
      productionReleaseAuthorized: true,
      productionReleaseId: "RG1-GO-2026-001",
      safeguards: {
        syntheticDataOnly: false,
        evaluationFallbacksAllowed: false,
        productionDataAllowed: true,
        externalWritesAllowed: true,
      },
    });
  });
});
