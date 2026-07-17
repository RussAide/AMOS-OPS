import { describe, expect, it } from "vitest";
import {
  assertSyntheticDemoRuntime,
  assertSyntheticScenarioRuntime,
  buildEnvironmentConfig,
} from "./env";

const testCredential = (scope: string) =>
  `not-a-secret-test-fixture-${scope}-${"x".repeat(32)}`;
const testMfaCode = () => ["48", "27", "31"].join("");

describe("environment isolation controls", () => {
  it("derives separate database and credential namespaces", () => {
    const development = buildEnvironmentConfig({
      APP_ENV: "development",
      NODE_ENV: "development",
    });
    const demo = buildEnvironmentConfig({
      APP_ENV: "demo",
      NODE_ENV: "production",
      AMOS_RUNTIME_MODE: "demo",
    });

    expect(development.databasePath).toContain("development");
    expect(demo.databasePath).toContain("demo");
    expect(development.databasePath).not.toBe(demo.databasePath);
    expect(development.uploadPath).not.toBe(demo.uploadPath);
    expect(development.credentialNamespace).not.toBe(demo.credentialNamespace);
    expect(demo.evaluationMode).toBe(true);
  });

  it("rejects demo mode outside the isolated demo environment", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "staging",
        NODE_ENV: "production",
        AMOS_RUNTIME_MODE: "demo",
      }),
    ).toThrow(/requires APP_ENV=demo/);
  });

  it("rejects the retired build-time evaluation flag", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "demo",
        NODE_ENV: "production",
        AMOS_RUNTIME_MODE: "demo",
        VITE_AMOS_EVALUATION_MODE: "true",
      }),
    ).toThrow(/no longer supported/);
  });

  it("fails closed when a demo profile points at production resources", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "demo",
        NODE_ENV: "production",
        AMOS_RUNTIME_MODE: "demo",
        AMOS_ENVIRONMENT_ID: "amos-ops-demo",
        DATABASE_PATH: "/app/data/production/amos-ops.db",
        UPLOAD_PATH: "/uploads/demo",
        CREDENTIAL_NAMESPACE: "amos-ops/demo",
      }),
    ).toThrow(/must not reference production or staging/);
  });

  it("allows synthetic startup only in the isolated demo profile", () => {
    const demo = buildEnvironmentConfig({
      APP_ENV: "demo",
      NODE_ENV: "production",
      AMOS_RUNTIME_MODE: "demo",
      DATABASE_PATH: "/app/data/demo/amos-ops.db",
      UPLOAD_PATH: "/app/uploads/demo",
      CREDENTIAL_NAMESPACE: "amos-ops/demo",
    });
    expect(() => assertSyntheticDemoRuntime(demo)).not.toThrow();
    expect(() => assertSyntheticScenarioRuntime(demo)).not.toThrow();
    expect(() =>
      assertSyntheticDemoRuntime(
        buildEnvironmentConfig({
          APP_ENV: "development",
          NODE_ENV: "test",
        }),
      ),
    ).toThrow(/require APP_ENV=demo/);
  });

  it("rejects staging configuration that reuses an unscoped data store", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "staging",
        NODE_ENV: "production",
        DATABASE_PATH: "/shared/amos-ops.db",
        CREDENTIAL_NAMESPACE: "amos-ops/staging",
        APP_SECRET: testCredential("staging-app"),
        JWT_SECRET: testCredential("staging-jwt"),
        DEPLOYMENT_APPROVAL_ID: "APR-001",
        DEPLOYMENT_CHANGE_REFERENCE: "CHG-001",
        AMOS_ALLOWED_ORIGINS: "https://staging.example.invalid",
      }),
    ).toThrow(/DATABASE_PATH.*staging/);
  });

  it("requires approval metadata and non-placeholder credentials for controlled environments", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "production",
        NODE_ENV: "production",
        DATABASE_PATH: "/app/persistent/data/production/amos-ops.db",
        CREDENTIAL_NAMESPACE: "amos-ops/production",
        APP_SECRET: "replace-me",
        JWT_SECRET: "replace-me",
      }),
    ).toThrow(/APP_SECRET/);
  });

  it("rejects controlled profiles that reuse a shared upload store", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "staging",
        NODE_ENV: "production",
        DATABASE_PATH: "/data/staging/amos-ops.db",
        UPLOAD_PATH: "/uploads/shared",
        CREDENTIAL_NAMESPACE: "amos-ops/staging",
        APP_SECRET: testCredential("staging-app"),
        JWT_SECRET: testCredential("staging-jwt"),
        DEPLOYMENT_APPROVAL_ID: "APR-001",
        DEPLOYMENT_CHANGE_REFERENCE: "CHG-001",
        AMOS_ALLOWED_ORIGINS: "https://staging.example.invalid",
      }),
    ).toThrow(/UPLOAD_PATH.*staging/);
  });

  it("accepts a fully isolated production profile", () => {
    const config = buildEnvironmentConfig({
      APP_ENV: "production",
      AMOS_RUNTIME_MODE: "production",
      NODE_ENV: "production",
      DATABASE_PATH: "/app/persistent/data/production/amos-ops.db",
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

    expect(config.isProduction).toBe(true);
    expect(config.runtimeMode).toBe("production");
    expect(config.allowSelfRegistration).toBe(false);
    expect(config.mfaPolicy).toBe("required-all");
    expect(config.productionReleaseAuthorized).toBe(true);
    expect(config.productionReleaseId).toBe("RG1-GO-2026-001");
    expect(config.persistentRoot).toBe("/app/persistent");
    expect(config.databasePath).toBe(
      "/app/persistent/data/production/amos-ops.db",
    );
    expect(config.trainingDatabasePath).toBe(
      "/app/persistent/data/production/training/amos-ops-training.db",
    );
    expect(config.uploadPath).toBe("/app/persistent/uploads/production");
    expect(config.trainingUploadPath).toBe(
      "/app/persistent/uploads/production/training",
    );
    expect(config.backupPath).toBe("/app/persistent/backups/production");
    expect(() => assertSyntheticScenarioRuntime(config)).toThrow(
      /Demo or an isolated release-review/,
    );
  });

  it.each([
    ["DATABASE_PATH", "/tmp/production/amos-ops.db"],
    ["TRAINING_DATABASE_PATH", "/tmp/production/training/amos-ops.db"],
    ["UPLOAD_PATH", "/tmp/uploads/production"],
    ["TRAINING_UPLOAD_PATH", "/tmp/uploads/production/training"],
    ["BACKUP_PATH", "/tmp/backups/production"],
  ])("rejects a nonpersistent production %s", (name, value) => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "production",
        AMOS_RUNTIME_MODE: "production",
        NODE_ENV: "production",
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
        [name]: value,
      }),
    ).toThrow(new RegExp(`${name}.*beneath PERSISTENT_ROOT`));
  });

  it("requires the canonical root to match Railway's mounted volume", () => {
    const base = {
      APP_ENV: "production",
      AMOS_RUNTIME_MODE: "production",
      NODE_ENV: "production",
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
      RAILWAY_PROJECT_ID: "project-001",
    };

    expect(() =>
      buildEnvironmentConfig({
        ...base,
        RAILWAY_VOLUME_MOUNT_PATH: "/app/not-persistent",
      }),
    ).toThrow(/must match RAILWAY_VOLUME_MOUNT_PATH/);
    expect(
      buildEnvironmentConfig({
        ...base,
        RAILWAY_VOLUME_MOUNT_PATH: "/app/persistent",
      }).persistentRoot,
    ).toBe("/app/persistent");
  });

  it("keeps production locked without explicit release authorization", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "production",
        AMOS_RUNTIME_MODE: "production",
        NODE_ENV: "production",
        DATABASE_PATH: "/app/persistent/data/production/amos-ops.db",
        UPLOAD_PATH: "/app/persistent/uploads/production",
        CREDENTIAL_NAMESPACE: "amos-ops/production",
        APP_SECRET: testCredential("production-app"),
        JWT_SECRET: testCredential("production-jwt"),
        DEPLOYMENT_APPROVAL_ID: "APR-2026-001",
        DEPLOYMENT_CHANGE_REFERENCE: "CHG-2026-001",
        AMOS_ALLOWED_ORIGINS: "https://amos.example.invalid",
        ALLOW_SELF_REGISTRATION: "false",
        MFA_POLICY: "required-all",
      }),
    ).toThrow(/Production is locked/);
  });

  it("accepts only a complete, expiring production initial-admin invitation", () => {
    const base = {
      APP_ENV: "production",
      AMOS_RUNTIME_MODE: "production",
      NODE_ENV: "production",
      DATABASE_PATH: "/app/persistent/data/production/amos-ops.db",
      UPLOAD_PATH: "/app/persistent/uploads/production",
      CREDENTIAL_NAMESPACE: "amos-ops/production",
      APP_SECRET: testCredential("bootstrap-app"),
      JWT_SECRET: testCredential("bootstrap-jwt"),
      DEPLOYMENT_APPROVAL_ID: "INITIAL-ADMIN",
      DEPLOYMENT_CHANGE_REFERENCE: "INITIAL-ADMIN-2026",
      AMOS_ALLOWED_ORIGINS: "https://amos.example.invalid",
      ALLOW_SELF_REGISTRATION: "false",
      MFA_POLICY: "required-all",
      AMOS_PRODUCTION_RELEASE_AUTHORIZED: "true",
      AMOS_PRODUCTION_RELEASE_ID: "RG1-GO-2026-001",
    };
    expect(() =>
      buildEnvironmentConfig({
        ...base,
        AMOS_INITIAL_ADMIN_EMAIL: "e.o.aideyan@adobicarebhc.com",
      }),
    ).toThrow(/requires email, first name, last name/);

    const config = buildEnvironmentConfig({
      ...base,
      AMOS_INITIAL_ADMIN_EMAIL: "e.o.aideyan@adobicarebhc.com",
      AMOS_INITIAL_ADMIN_FIRST_NAME: "Eghosa",
      AMOS_INITIAL_ADMIN_LAST_NAME: "Aideyan",
      AMOS_INITIAL_ADMIN_INVITATION_TOKEN_HASH: "a".repeat(64),
      AMOS_INITIAL_ADMIN_INVITATION_EXPIRES_AT: new Date(
        Date.now() + 60 * 60_000,
      ).toISOString(),
    });
    expect(config.initialAdminEmail).toBe("e.o.aideyan@adobicarebhc.com");
    expect(config.initialAdminInvitationTokenHash).toBe("a".repeat(64));
  });

  it("accepts only a fully owner-bound staging review posture", () => {
    const review = buildEnvironmentConfig({
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

    expect(review.reviewDeployment).toBe(true);
    expect(review.runtimeMode).toBe("production");
    expect(review.productionReleaseAuthorized).toBe(false);
    expect(review.finalGateOwnerEmail).toBe("owner@amos-ops.invalid");
    expect(() => assertSyntheticScenarioRuntime(review)).not.toThrow();
  });

  it("rejects review owner secrets outside the release-review posture", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "development",
        NODE_ENV: "development",
        AMOS_FINAL_GATE_OWNER_EMAIL: "owner@example.invalid",
      }),
    ).toThrow(/only when AMOS_REVIEW_DEPLOYMENT=true/);
  });

  it("rejects CORS entries that are not exact origins", () => {
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "development",
        NODE_ENV: "development",
        AMOS_ALLOWED_ORIGINS: "https://example.invalid/path",
      }),
    ).toThrow(/exact http\(s\) origins/);
    expect(() =>
      buildEnvironmentConfig({
        APP_ENV: "development",
        NODE_ENV: "development",
        AMOS_ALLOWED_ORIGINS: "*",
      }),
    ).toThrow(/exact http\(s\) origins/);
  });
});
