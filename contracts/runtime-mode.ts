export const AMOS_RUNTIME_CONFIG_SCHEMA_VERSION = 2 as const;

export const AMOS_RUNTIME_MODES = ["demo", "production"] as const;

export type AmosRuntimeMode = (typeof AMOS_RUNTIME_MODES)[number];

export const AMOS_DEPLOYMENT_POSTURES = [
  "demo",
  "release-review",
  "locked",
  "live",
] as const;

export type AmosDeploymentPosture =
  (typeof AMOS_DEPLOYMENT_POSTURES)[number];

export interface AmosRuntimeSafeguards {
  readonly syntheticDataOnly: boolean;
  readonly evaluationFallbacksAllowed: boolean;
  readonly productionDataAllowed: boolean;
  readonly externalWritesAllowed: boolean;
}

export interface PublicAmosRuntimeConfig {
  readonly schemaVersion: typeof AMOS_RUNTIME_CONFIG_SCHEMA_VERSION;
  readonly mode: AmosRuntimeMode;
  readonly appEnvironment: string;
  readonly environmentId: string;
  readonly apiUrl: "/api/trpc";
  readonly evaluationMode: boolean;
  readonly productionReleaseAuthorized: boolean;
  readonly productionReleaseId: string | null;
  readonly deploymentPosture: AmosDeploymentPosture;
  readonly reviewDeployment: boolean;
  readonly candidateId: string | null;
  readonly buildId: string;
  readonly banner: string;
  readonly safeguards: AmosRuntimeSafeguards;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireString(
  source: Record<string, unknown>,
  name: string,
): string {
  const value = source[name];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Runtime configuration field ${name} must be a non-empty string.`);
  }
  return value;
}

function requireBoolean(
  source: Record<string, unknown>,
  name: string,
): boolean {
  const value = source[name];
  if (typeof value !== "boolean") {
    throw new Error(`Runtime configuration field ${name} must be a boolean.`);
  }
  return value;
}

export function parsePublicAmosRuntimeConfig(
  value: unknown,
): PublicAmosRuntimeConfig {
  if (!isRecord(value)) {
    throw new Error("Runtime configuration response must be an object.");
  }
  if (value.schemaVersion !== AMOS_RUNTIME_CONFIG_SCHEMA_VERSION) {
    throw new Error("Runtime configuration schema version is not supported.");
  }

  const mode = value.mode;
  if (mode !== "demo" && mode !== "production") {
    throw new Error("Runtime configuration mode must be demo or production.");
  }

  const apiUrl = requireString(value, "apiUrl");
  if (apiUrl !== "/api/trpc") {
    throw new Error("Runtime configuration must use the same-origin AMOS API.");
  }

  const evaluationMode = requireBoolean(value, "evaluationMode");
  const reviewDeployment = requireBoolean(value, "reviewDeployment");
  const productionReleaseAuthorized = requireBoolean(
    value,
    "productionReleaseAuthorized",
  );
  const releaseId = value.productionReleaseId;
  if (releaseId !== null && (typeof releaseId !== "string" || !releaseId.trim())) {
    throw new Error(
      "Runtime configuration productionReleaseId must be null or a non-empty string.",
    );
  }
  const candidateId = value.candidateId;
  if (
    candidateId !== null &&
    (typeof candidateId !== "string" || !candidateId.trim())
  ) {
    throw new Error(
      "Runtime configuration candidateId must be null or a non-empty string.",
    );
  }
  const deploymentPosture = value.deploymentPosture;
  if (
    deploymentPosture !== "demo" &&
    deploymentPosture !== "release-review" &&
    deploymentPosture !== "locked" &&
    deploymentPosture !== "live"
  ) {
    throw new Error("Runtime configuration deployment posture is not supported.");
  }
  if (!isRecord(value.safeguards)) {
    throw new Error("Runtime configuration safeguards must be an object.");
  }

  const safeguards = Object.freeze({
    syntheticDataOnly: requireBoolean(value.safeguards, "syntheticDataOnly"),
    evaluationFallbacksAllowed: requireBoolean(
      value.safeguards,
      "evaluationFallbacksAllowed",
    ),
    productionDataAllowed: requireBoolean(
      value.safeguards,
      "productionDataAllowed",
    ),
    externalWritesAllowed: requireBoolean(
      value.safeguards,
      "externalWritesAllowed",
    ),
  });

  if (mode === "demo") {
    if (
      !evaluationMode ||
      !safeguards.syntheticDataOnly ||
      !safeguards.evaluationFallbacksAllowed ||
      safeguards.productionDataAllowed ||
      safeguards.externalWritesAllowed ||
      productionReleaseAuthorized ||
      releaseId !== null ||
      reviewDeployment ||
      candidateId !== null ||
      deploymentPosture !== "demo"
    ) {
      throw new Error("Demo runtime configuration violates the synthetic-only boundary.");
    }
  } else {
    const validReview =
      reviewDeployment &&
      deploymentPosture === "release-review" &&
      candidateId !== null &&
      !evaluationMode &&
      safeguards.syntheticDataOnly &&
      !safeguards.evaluationFallbacksAllowed &&
      !safeguards.productionDataAllowed &&
      !safeguards.externalWritesAllowed &&
      !productionReleaseAuthorized &&
      releaseId === null;
    const validLive =
      !reviewDeployment &&
      deploymentPosture === "live" &&
      candidateId === null &&
      !evaluationMode &&
      !safeguards.syntheticDataOnly &&
      !safeguards.evaluationFallbacksAllowed &&
      safeguards.productionDataAllowed &&
      safeguards.externalWritesAllowed &&
      productionReleaseAuthorized &&
      releaseId !== null;
    const validLocked =
      !reviewDeployment &&
      deploymentPosture === "locked" &&
      candidateId === null &&
      !evaluationMode &&
      !safeguards.syntheticDataOnly &&
      !safeguards.evaluationFallbacksAllowed &&
      !safeguards.productionDataAllowed &&
      !safeguards.externalWritesAllowed &&
      !productionReleaseAuthorized &&
      releaseId === null;
    if (!validReview && !validLive && !validLocked) {
      throw new Error("Production runtime configuration violates the release boundary.");
    }
  }

  return Object.freeze({
    schemaVersion: AMOS_RUNTIME_CONFIG_SCHEMA_VERSION,
    mode,
    appEnvironment: requireString(value, "appEnvironment"),
    environmentId: requireString(value, "environmentId"),
    apiUrl: "/api/trpc",
    evaluationMode,
    productionReleaseAuthorized,
    productionReleaseId: releaseId,
    deploymentPosture,
    reviewDeployment,
    candidateId,
    buildId: requireString(value, "buildId"),
    banner: requireString(value, "banner"),
    safeguards,
  });
}
