import {
  AMOS_RUNTIME_CONFIG_SCHEMA_VERSION,
  type PublicAmosRuntimeConfig,
} from "@contracts/runtime-mode";
import type { EnvironmentConfig } from "./lib/env";

export function createPublicRuntimeConfig(
  environment: EnvironmentConfig,
  buildId = environment.buildId,
): PublicAmosRuntimeConfig {
  const demo = environment.runtimeMode === "demo";
  const releaseReview = environment.reviewDeployment;
  const productionActive =
    environment.isProduction && environment.productionReleaseAuthorized;

  return Object.freeze({
    schemaVersion: AMOS_RUNTIME_CONFIG_SCHEMA_VERSION,
    mode: environment.runtimeMode,
    appEnvironment: environment.appEnvironment,
    environmentId: environment.environmentId,
    apiUrl: "/api/trpc",
    evaluationMode: demo,
    productionReleaseAuthorized: productionActive,
    productionReleaseId: productionActive
      ? environment.productionReleaseId
      : null,
    deploymentPosture: demo
      ? "demo"
      : releaseReview
        ? "release-review"
        : productionActive
          ? "live"
          : "locked",
    reviewDeployment: releaseReview,
    candidateId: releaseReview ? environment.finalGateCandidateId : null,
    buildId,
    banner: demo
      ? "DEMO — FICTIONAL DATA — NOT FOR CARE DELIVERY — LIVE WRITES BLOCKED"
      : releaseReview
        ? "AMOS-OPS Operational Workspace"
      : productionActive
        ? "PRODUCTION — AUTHORIZED LIVE OPERATIONS"
        : "PRODUCTION PATH — LIVE OPERATIONS LOCKED",
    safeguards: Object.freeze({
      syntheticDataOnly: demo || releaseReview,
      evaluationFallbacksAllowed: demo,
      productionDataAllowed: productionActive,
      externalWritesAllowed: productionActive,
    }),
  });
}
