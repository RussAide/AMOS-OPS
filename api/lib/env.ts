import "dotenv/config";
import path from "node:path";
import {
  AMOS_RUNTIME_MODES,
  type AmosRuntimeMode,
} from "@contracts/runtime-mode";
import {
  disposeStorageEncryptionConfiguration,
  loadStorageEncryptionConfiguration,
  type StorageMigrationMode,
} from "../security/storage-encryption";

export const APP_ENVIRONMENTS = [
  "development",
  "demo",
  "staging",
  "production",
] as const;

export type AppEnvironment = (typeof APP_ENVIRONMENTS)[number];
export type MfaPolicy = "optional" | "required-privileged" | "required-all";
export const PRODUCTION_PERSISTENT_ROOT = "/app/persistent";

export interface EnvironmentConfig {
  appEnvironment: AppEnvironment;
  runtimeMode: AmosRuntimeMode;
  environmentId: string;
  credentialNamespace: string;
  nodeEnvironment: "development" | "test" | "production";
  port: number;
  appId: string;
  appSecret: string;
  jwtSecret: string;
  persistentRoot: string;
  databasePath: string;
  trainingDatabasePath: string;
  uploadPath: string;
  trainingUploadPath: string;
  backupPath: string;
  storageEncryptionEnabled: boolean;
  storageKeyProvider: "railway-sealed-variables-v1" | "none";
  storageMigrationMode: StorageMigrationMode;
  databaseActiveKeyId: string | null;
  uploadActiveKeyId: string | null;
  backupActiveKeyId: string | null;
  evaluationMode: boolean;
  allowSelfRegistration: boolean;
  mfaPolicy: MfaPolicy;
  deploymentApprovalId: string;
  deploymentChangeReference: string;
  productionReleaseAuthorized: boolean;
  productionReleaseId: string | null;
  reviewDeployment: boolean;
  finalGateOwnerEmail: string | null;
  finalGateCandidateId: string | null;
  buildId: string;
  sourceDigest: string | null;
  reviewOwnerPasswordHash: string | null;
  reviewOwnerMfaCode: string | null;
  initialAdminEmail: string | null;
  initialAdminFirstName: string | null;
  initialAdminLastName: string | null;
  initialAdminInvitationTokenHash: string | null;
  initialAdminInvitationExpiresAt: string | null;
  allowedOrigins: readonly string[];
  isDevelopment: boolean;
  isDemo: boolean;
  isStaging: boolean;
  isProduction: boolean;
}

const ENABLED_VALUES = new Set(["1", "true", "yes", "on"]);

function enabled(value: string | undefined): boolean {
  return ENABLED_VALUES.has(value?.trim().toLowerCase() ?? "");
}

function parseAppEnvironment(
  value: string | undefined,
  nodeEnvironment: string | undefined,
): AppEnvironment {
  const normalized = value?.trim().toLowerCase();
  if (normalized && APP_ENVIRONMENTS.includes(normalized as AppEnvironment)) {
    return normalized as AppEnvironment;
  }
  if (normalized) {
    throw new Error(
      `Invalid APP_ENV "${value}". Expected one of: ${APP_ENVIRONMENTS.join(", ")}.`,
    );
  }
  return nodeEnvironment === "production" ? "production" : "development";
}

function parseRuntimeMode(
  value: string | undefined,
  appEnvironment: AppEnvironment,
): AmosRuntimeMode {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized &&
    AMOS_RUNTIME_MODES.includes(normalized as AmosRuntimeMode)
  ) {
    return normalized as AmosRuntimeMode;
  }
  if (normalized) {
    throw new Error(
      `Invalid AMOS_RUNTIME_MODE "${value}". Expected demo or production.`,
    );
  }
  return appEnvironment === "demo" ? "demo" : "production";
}

function nodeMode(
  value: string | undefined,
): EnvironmentConfig["nodeEnvironment"] {
  return value === "production" || value === "test" ? value : "development";
}

function parseMfaPolicy(value: string | undefined): MfaPolicy {
  const normalized = value?.trim().toLowerCase() || "required-privileged";
  if (
    normalized === "optional" ||
    normalized === "required-privileged" ||
    normalized === "required-all"
  ) {
    return normalized;
  }
  throw new Error(
    `Invalid MFA_POLICY "${value}". Expected optional, required-privileged, or required-all.`,
  );
}

function integerInRange(
  name: string,
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const parsed = value ? Number.parseInt(value, 10) : fallback;
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(
      `${name} must be an integer from ${minimum} through ${maximum}.`,
    );
  }
  return parsed;
}

function isPlaceholder(value: string): boolean {
  return /^(?:change|replace|example|placeholder|your[-_])/i.test(value.trim());
}

function isExactHttpOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === value
    );
  } catch {
    return false;
  }
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$.{53}$/.test(value);
}

function containsEnvironmentSegment(
  value: string,
  environment: string,
): boolean {
  const normalized = value.toLowerCase().replace(/\\/g, "/");
  return new RegExp(`(?:^|[./_-])${environment}(?:[./_-]|$)`, "i").test(
    normalized,
  );
}

function isStrictPathDescendant(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return (
    relative.length > 0 &&
    relative !== ".." &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function assertDemoIsolation(
  environmentId: string,
  credentialNamespace: string,
  databasePath: string,
  uploadPath: string,
): void {
  const values = [environmentId, credentialNamespace, databasePath, uploadPath];
  if (
    values.some((value) =>
      /(?:^|[./_-])(production|staging)(?:[./_-]|$)/i.test(value),
    )
  ) {
    throw new Error(
      "Demo environment resources must not reference production or staging namespaces.",
    );
  }
  for (const [name, value] of [
    ["AMOS_ENVIRONMENT_ID", environmentId],
    ["CREDENTIAL_NAMESPACE", credentialNamespace],
    ["DATABASE_PATH", databasePath],
    ["UPLOAD_PATH", uploadPath],
  ] as const) {
    if (!containsEnvironmentSegment(value, "demo")) {
      throw new Error(
        `${name} for demo must include an isolated demo segment.`,
      );
    }
  }
}

export function buildEnvironmentConfig(
  source: NodeJS.ProcessEnv = process.env,
): EnvironmentConfig {
  const appEnvironment = parseAppEnvironment(source.APP_ENV, source.NODE_ENV);
  const runtimeMode = parseRuntimeMode(
    source.AMOS_RUNTIME_MODE,
    appEnvironment,
  );
  const nodeEnvironment = nodeMode(source.NODE_ENV);
  const isProduction = appEnvironment === "production";
  const isStaging = appEnvironment === "staging";
  const isDemo = appEnvironment === "demo";
  const isDevelopment = appEnvironment === "development";
  const environmentId =
    source.AMOS_ENVIRONMENT_ID?.trim() || `amos-ops-${appEnvironment}`;
  const credentialNamespace =
    source.CREDENTIAL_NAMESPACE?.trim() || `amos-ops/${appEnvironment}`;
  const persistentRoot =
    source.PERSISTENT_ROOT?.trim() ||
    (isProduction
      ? PRODUCTION_PERSISTENT_ROOT
      : path.join("data", appEnvironment));
  const databasePath =
    source.DATABASE_PATH?.trim() ||
    (isProduction
      ? path.join(persistentRoot, "data", appEnvironment, "amos-ops.db")
      : path.join("data", appEnvironment, "amos-ops.db"));
  const trainingDatabasePath =
    source.TRAINING_DATABASE_PATH?.trim() ||
    (isProduction
      ? path.join(
          persistentRoot,
          "data",
          appEnvironment,
          "training",
          "amos-ops-training.db",
        )
      : path.join("data", appEnvironment, "training", "amos-ops-training.db"));
  const uploadPath =
    source.UPLOAD_PATH?.trim() ||
    (isProduction
      ? path.join(persistentRoot, "uploads", appEnvironment)
      : path.join("uploads", appEnvironment));
  const trainingUploadPath =
    source.TRAINING_UPLOAD_PATH?.trim() ||
    (isProduction
      ? path.join(persistentRoot, "uploads", appEnvironment, "training")
      : path.join("uploads", appEnvironment, "training"));
  const backupPath =
    source.BACKUP_PATH?.trim() ||
    (isProduction
      ? path.join(persistentRoot, "backups", appEnvironment)
      : path.join("backups", appEnvironment));
  const evaluationMode = runtimeMode === "demo";
  const storageEncryption = loadStorageEncryptionConfiguration(
    source,
    isProduction,
  );
  const storageEncryptionMetadata = {
    storageEncryptionEnabled: storageEncryption.enabled,
    storageKeyProvider: storageEncryption.provider,
    storageMigrationMode: storageEncryption.migrationMode,
    databaseActiveKeyId: storageEncryption.database?.activeKeyId ?? null,
    uploadActiveKeyId: storageEncryption.upload?.activeKeyId ?? null,
    backupActiveKeyId: storageEncryption.backup?.activeKeyId ?? null,
  };
  disposeStorageEncryptionConfiguration(storageEncryption);
  const appId = source.APP_ID?.trim() || "amos-ops";
  const appSecret = source.APP_SECRET?.trim() || "";
  const jwtSecret = source.JWT_SECRET?.trim() || "";
  const deploymentApprovalId = source.DEPLOYMENT_APPROVAL_ID?.trim() || "";
  const deploymentChangeReference =
    source.DEPLOYMENT_CHANGE_REFERENCE?.trim() || "";
  const productionReleaseAuthorized = enabled(
    source.AMOS_PRODUCTION_RELEASE_AUTHORIZED,
  );
  const productionReleaseId = source.AMOS_PRODUCTION_RELEASE_ID?.trim() || null;
  const reviewDeployment = enabled(source.AMOS_REVIEW_DEPLOYMENT);
  const finalGateOwnerEmail =
    source.AMOS_FINAL_GATE_OWNER_EMAIL?.trim().toLowerCase() || null;
  const finalGateCandidateId =
    source.AMOS_FINAL_GATE_CANDIDATE_ID?.trim() || null;
  const buildId = source.AMOS_BUILD_ID?.trim() || "unversioned";
  const sourceDigest = source.AMOS_SOURCE_DIGEST?.trim().toLowerCase() || null;
  const reviewOwnerPasswordHash =
    source.AMOS_REVIEW_OWNER_PASSWORD_HASH?.trim() || null;
  const reviewOwnerMfaCode = source.AMOS_REVIEW_OWNER_MFA_CODE?.trim() || null;
  const initialAdminEmail =
    source.AMOS_INITIAL_ADMIN_EMAIL?.trim().toLowerCase() || null;
  const initialAdminFirstName =
    source.AMOS_INITIAL_ADMIN_FIRST_NAME?.trim() || null;
  const initialAdminLastName =
    source.AMOS_INITIAL_ADMIN_LAST_NAME?.trim() || null;
  const initialAdminInvitationTokenHash =
    source.AMOS_INITIAL_ADMIN_INVITATION_TOKEN_HASH?.trim().toLowerCase() ||
    null;
  const initialAdminInvitationExpiresAt =
    source.AMOS_INITIAL_ADMIN_INVITATION_EXPIRES_AT?.trim() || null;
  const allowSelfRegistration =
    source.ALLOW_SELF_REGISTRATION === undefined
      ? isDevelopment || isDemo
      : enabled(source.ALLOW_SELF_REGISTRATION);
  const mfaPolicy = parseMfaPolicy(source.MFA_POLICY);
  const allowedOrigins = (source.AMOS_ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (source.VITE_AMOS_EVALUATION_MODE !== undefined) {
    throw new Error(
      "VITE_AMOS_EVALUATION_MODE is no longer supported; set AMOS_RUNTIME_MODE at startup.",
    );
  }
  if (runtimeMode === "demo" && !isDemo) {
    throw new Error("AMOS_RUNTIME_MODE=demo requires APP_ENV=demo.");
  }
  if (isDemo && runtimeMode !== "demo") {
    throw new Error("APP_ENV=demo requires AMOS_RUNTIME_MODE=demo.");
  }
  if (isProduction && runtimeMode !== "production") {
    throw new Error(
      "APP_ENV=production requires AMOS_RUNTIME_MODE=production.",
    );
  }
  if (isDemo) {
    assertDemoIsolation(
      environmentId,
      credentialNamespace,
      databasePath,
      uploadPath,
    );
  }
  if (isProduction && nodeEnvironment !== "production") {
    throw new Error("APP_ENV=production requires NODE_ENV=production.");
  }
  if (isProduction) {
    if (
      !path.isAbsolute(persistentRoot) ||
      path.resolve(persistentRoot) !== path.resolve(PRODUCTION_PERSISTENT_ROOT)
    ) {
      throw new Error(
        `Production PERSISTENT_ROOT must resolve to ${PRODUCTION_PERSISTENT_ROOT}.`,
      );
    }
    const railwayVolumeMountPath =
      source.RAILWAY_VOLUME_MOUNT_PATH?.trim() || null;
    if (
      source.RAILWAY_PROJECT_ID &&
      (!railwayVolumeMountPath ||
        path.resolve(railwayVolumeMountPath) !== path.resolve(persistentRoot))
    ) {
      throw new Error(
        "Production PERSISTENT_ROOT must match RAILWAY_VOLUME_MOUNT_PATH.",
      );
    }
    for (const [name, value] of [
      ["DATABASE_PATH", databasePath],
      ["TRAINING_DATABASE_PATH", trainingDatabasePath],
      ["UPLOAD_PATH", uploadPath],
      ["TRAINING_UPLOAD_PATH", trainingUploadPath],
      ["BACKUP_PATH", backupPath],
    ] as const) {
      if (
        !path.isAbsolute(value) ||
        !isStrictPathDescendant(persistentRoot, value)
      ) {
        throw new Error(
          `${name} for production must be an absolute path beneath PERSISTENT_ROOT ${PRODUCTION_PERSISTENT_ROOT}.`,
        );
      }
    }
    if (!containsEnvironmentSegment(backupPath, appEnvironment)) {
      throw new Error(
        "BACKUP_PATH for production must include the production environment segment.",
      );
    }
  }
  if (allowedOrigins.some((origin) => !isExactHttpOrigin(origin))) {
    throw new Error(
      "AMOS_ALLOWED_ORIGINS entries must be exact http(s) origins without paths, queries, fragments, or wildcards.",
    );
  }
  if ((isStaging || isProduction) && !databasePath.includes(appEnvironment)) {
    throw new Error(
      `DATABASE_PATH for ${appEnvironment} must include the environment name to prevent cross-environment data reuse.`,
    );
  }
  if ((isStaging || isProduction) && !uploadPath.includes(appEnvironment)) {
    throw new Error(
      `UPLOAD_PATH for ${appEnvironment} must include the environment name to prevent cross-environment file reuse.`,
    );
  }
  if (path.resolve(trainingDatabasePath) === path.resolve(databasePath)) {
    throw new Error(
      "TRAINING_DATABASE_PATH must be isolated from DATABASE_PATH.",
    );
  }
  if (path.resolve(trainingUploadPath) === path.resolve(uploadPath)) {
    throw new Error("TRAINING_UPLOAD_PATH must be isolated from UPLOAD_PATH.");
  }
  if (
    (isStaging || isProduction) &&
    (!trainingDatabasePath.includes(appEnvironment) ||
      !trainingDatabasePath.toLowerCase().includes("training"))
  ) {
    throw new Error(
      `TRAINING_DATABASE_PATH for ${appEnvironment} must include both the environment and training segments.`,
    );
  }
  if (
    (isStaging || isProduction) &&
    (!trainingUploadPath.includes(appEnvironment) ||
      !trainingUploadPath.toLowerCase().includes("training"))
  ) {
    throw new Error(
      `TRAINING_UPLOAD_PATH for ${appEnvironment} must include both the environment and training segments.`,
    );
  }
  if (
    (isStaging || isProduction) &&
    !credentialNamespace.toLowerCase().includes(appEnvironment)
  ) {
    throw new Error(
      `CREDENTIAL_NAMESPACE for ${appEnvironment} must include the environment name.`,
    );
  }
  if (isStaging || isProduction) {
    for (const [name, value] of [
      ["APP_SECRET", appSecret],
      ["JWT_SECRET", jwtSecret],
    ] as const) {
      if (value.length < 32 || isPlaceholder(value)) {
        throw new Error(
          `${name} must be a non-placeholder secret of at least 32 characters in ${appEnvironment}.`,
        );
      }
    }
    if (!deploymentApprovalId || !deploymentChangeReference) {
      throw new Error(
        `${appEnvironment} requires DEPLOYMENT_APPROVAL_ID and DEPLOYMENT_CHANGE_REFERENCE.`,
      );
    }
    if (!allowedOrigins.length) {
      throw new Error(
        `${appEnvironment} requires AMOS_ALLOWED_ORIGINS with exact origins; wildcard CORS is prohibited.`,
      );
    }
  }
  if (isProduction) {
    if (allowSelfRegistration) {
      throw new Error("Production requires ALLOW_SELF_REGISTRATION=false.");
    }
    if (mfaPolicy !== "required-all") {
      throw new Error("Production requires MFA_POLICY=required-all.");
    }
    if (
      !productionReleaseAuthorized ||
      !productionReleaseId ||
      isPlaceholder(productionReleaseId)
    ) {
      throw new Error(
        "Production is locked until AMOS_PRODUCTION_RELEASE_AUTHORIZED=true and a non-placeholder AMOS_PRODUCTION_RELEASE_ID are supplied.",
      );
    }
  } else if (productionReleaseAuthorized || productionReleaseId) {
    throw new Error(
      "Production release authorization may be supplied only when APP_ENV=production.",
    );
  }
  if (reviewDeployment) {
    if (!isStaging || runtimeMode !== "production") {
      throw new Error(
        "AMOS_REVIEW_DEPLOYMENT=true requires APP_ENV=staging with AMOS_RUNTIME_MODE=production.",
      );
    }
    if (allowSelfRegistration) {
      throw new Error("Release review requires ALLOW_SELF_REGISTRATION=false.");
    }
    if (mfaPolicy !== "required-all") {
      throw new Error("Release review requires MFA_POLICY=required-all.");
    }
    if (!finalGateOwnerEmail || !isEmail(finalGateOwnerEmail)) {
      throw new Error(
        "Release review requires a valid AMOS_FINAL_GATE_OWNER_EMAIL.",
      );
    }
    if (
      !finalGateCandidateId ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{1,63}$/.test(finalGateCandidateId)
    ) {
      throw new Error(
        "Release review requires a controlled AMOS_FINAL_GATE_CANDIDATE_ID.",
      );
    }
    if (buildId === "unversioned" || isPlaceholder(buildId)) {
      throw new Error(
        "Release review requires a non-placeholder AMOS_BUILD_ID.",
      );
    }
    if (!sourceDigest || !/^[a-f0-9]{64}$/.test(sourceDigest)) {
      throw new Error(
        "Release review requires AMOS_SOURCE_DIGEST as a lowercase SHA-256 digest.",
      );
    }
    if (!reviewOwnerPasswordHash || !isBcryptHash(reviewOwnerPasswordHash)) {
      throw new Error(
        "Release review requires AMOS_REVIEW_OWNER_PASSWORD_HASH as a bcrypt hash.",
      );
    }
    if (
      !reviewOwnerMfaCode ||
      !/^\d{6}$/.test(reviewOwnerMfaCode) ||
      new Set(["000000", "111111", "123456", "654321"]).has(reviewOwnerMfaCode)
    ) {
      throw new Error(
        "Release review requires a non-trivial six-digit AMOS_REVIEW_OWNER_MFA_CODE.",
      );
    }
  } else if (
    finalGateOwnerEmail ||
    finalGateCandidateId ||
    sourceDigest ||
    reviewOwnerPasswordHash ||
    reviewOwnerMfaCode
  ) {
    throw new Error(
      "Final-gate owner and review bootstrap variables may be supplied only when AMOS_REVIEW_DEPLOYMENT=true.",
    );
  }

  const initialAdminValues = [
    initialAdminEmail,
    initialAdminFirstName,
    initialAdminLastName,
    initialAdminInvitationTokenHash,
    initialAdminInvitationExpiresAt,
  ];
  const hasInitialAdminConfig = initialAdminValues.some(Boolean);
  if (hasInitialAdminConfig && !initialAdminValues.every(Boolean)) {
    throw new Error(
      "Initial administrator bootstrap requires email, first name, last name, invitation token hash, and invitation expiry together.",
    );
  }
  if (hasInitialAdminConfig) {
    if (!isProduction || runtimeMode !== "production") {
      throw new Error(
        "Initial administrator bootstrap is available only in Production.",
      );
    }
    if (!isEmail(initialAdminEmail!)) {
      throw new Error(
        "AMOS_INITIAL_ADMIN_EMAIL must be a valid email address.",
      );
    }
    if (
      initialAdminFirstName!.length > 80 ||
      initialAdminLastName!.length > 80
    ) {
      throw new Error(
        "Initial administrator names must not exceed 80 characters.",
      );
    }
    if (!/^[a-f0-9]{64}$/.test(initialAdminInvitationTokenHash!)) {
      throw new Error(
        "AMOS_INITIAL_ADMIN_INVITATION_TOKEN_HASH must be a lowercase SHA-256 HMAC digest.",
      );
    }
    const invitationExpiry = Date.parse(initialAdminInvitationExpiresAt!);
    if (!Number.isFinite(invitationExpiry) || invitationExpiry <= Date.now()) {
      throw new Error(
        "AMOS_INITIAL_ADMIN_INVITATION_EXPIRES_AT must be a future ISO timestamp.",
      );
    }
  }

  return Object.freeze({
    appEnvironment,
    runtimeMode,
    environmentId,
    credentialNamespace,
    nodeEnvironment,
    port: integerInRange("PORT", source.PORT, 3000, 1, 65535),
    appId,
    appSecret,
    jwtSecret:
      jwtSecret ||
      "development-only-secret-not-valid-for-staging-or-production",
    persistentRoot,
    databasePath,
    trainingDatabasePath,
    uploadPath,
    trainingUploadPath,
    backupPath,
    ...storageEncryptionMetadata,
    evaluationMode,
    allowSelfRegistration,
    mfaPolicy,
    deploymentApprovalId,
    deploymentChangeReference,
    productionReleaseAuthorized,
    productionReleaseId,
    reviewDeployment,
    finalGateOwnerEmail,
    finalGateCandidateId,
    buildId,
    sourceDigest,
    reviewOwnerPasswordHash,
    reviewOwnerMfaCode,
    initialAdminEmail,
    initialAdminFirstName,
    initialAdminLastName,
    initialAdminInvitationTokenHash,
    initialAdminInvitationExpiresAt,
    allowedOrigins: Object.freeze(allowedOrigins),
    isDevelopment,
    isDemo,
    isStaging,
    isProduction,
  });
}

export function assertSyntheticDemoRuntime(config: EnvironmentConfig): void {
  if (
    !config.isDemo ||
    config.runtimeMode !== "demo" ||
    !config.evaluationMode
  ) {
    throw new Error(
      "Synthetic milestone scenarios require APP_ENV=demo with AMOS_RUNTIME_MODE=demo.",
    );
  }
  assertDemoIsolation(
    config.environmentId,
    config.credentialNamespace,
    config.databasePath,
    config.uploadPath,
  );
}

/** Synthetic milestone scenarios are available only in Demo or in the
 * explicitly isolated DMS.1 release-review posture. Live Production remains
 * ineligible even when a caller holds an administrative role. */
export function assertSyntheticScenarioRuntime(
  config: EnvironmentConfig,
): void {
  if (config.isDemo && config.runtimeMode === "demo" && config.evaluationMode) {
    assertSyntheticDemoRuntime(config);
    return;
  }
  if (
    config.reviewDeployment &&
    config.isStaging &&
    config.runtimeMode === "production" &&
    !config.evaluationMode &&
    !config.productionReleaseAuthorized
  ) {
    return;
  }
  throw new Error(
    "Synthetic milestone scenarios require Demo or an isolated release-review deployment.",
  );
}

export const env = buildEnvironmentConfig();
