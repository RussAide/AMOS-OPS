import {
  parsePublicAmosRuntimeConfig,
  type AmosRuntimeMode,
  type AmosRuntimeSafeguards,
  type AmosDeploymentPosture,
  type PublicAmosRuntimeConfig,
} from "@contracts/runtime-mode";

export const EVALUATION_SESSION_TOKEN = "amos-evaluation-session";

export interface ClientRuntimeConfig {
  initialized: boolean;
  schemaVersion: 2;
  mode: AmosRuntimeMode | "locked";
  appEnvironment: string;
  environmentId: string;
  apiUrl: string;
  evaluationMode: boolean;
  productionReleaseAuthorized: boolean;
  productionReleaseId: string | null;
  deploymentPosture: AmosDeploymentPosture;
  reviewDeployment: boolean;
  candidateId: string | null;
  buildId: string;
  banner: string;
  safeguards: AmosRuntimeSafeguards;
}

const LOCKED_SAFEGUARDS = Object.freeze({
  syntheticDataOnly: false,
  evaluationFallbacksAllowed: false,
  productionDataAllowed: false,
  externalWritesAllowed: false,
});

const configuredApiOrigin = (import.meta.env.VITE_AMOS_API_ORIGIN as string | undefined)
  ?.trim()
  .replace(/\/$/, "");

export function apiEndpoint(path: string): string {
  return configuredApiOrigin ? `${configuredApiOrigin}${path}` : path;
}

export const runtimeConfig: ClientRuntimeConfig = {
  initialized: false,
  schemaVersion: 2,
  mode: "locked",
  appEnvironment: "locked",
  environmentId: "amos-ops-locked",
  apiUrl: "/api/trpc",
  evaluationMode: false,
  productionReleaseAuthorized: false,
  productionReleaseId: null,
  deploymentPosture: "locked",
  reviewDeployment: false,
  candidateId: null,
  buildId: "unverified",
  banner: "SAFE STARTUP LOCK — RUNTIME CONFIGURATION NOT VERIFIED",
  safeguards: LOCKED_SAFEGUARDS,
};

export type RuntimeConfigFetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export async function fetchRuntimeConfig(
  fetcher: RuntimeConfigFetcher = fetch,
): Promise<PublicAmosRuntimeConfig> {
  const response = await fetcher(apiEndpoint("/api/runtime-config"), {
    cache: "no-store",
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Runtime configuration request failed with status ${response.status}.`,
    );
  }
  return parsePublicAmosRuntimeConfig(await response.json());
}

let initializationPromise: Promise<Readonly<ClientRuntimeConfig>> | null = null;

export function initializeRuntimeConfig(
  fetcher: RuntimeConfigFetcher = fetch,
): Promise<Readonly<ClientRuntimeConfig>> {
  if (runtimeConfig.initialized) return Promise.resolve(runtimeConfig);
  if (initializationPromise) return initializationPromise;

  initializationPromise = fetchRuntimeConfig(fetcher)
    .then((verified) => {
      Object.assign(runtimeConfig, verified, {
        apiUrl: apiEndpoint(verified.apiUrl),
        initialized: true,
      });
      return Object.freeze(runtimeConfig);
    })
    .catch((error: unknown) => {
      initializationPromise = null;
      throw error;
    });
  return initializationPromise;
}

export type EvaluationFallbackKind = "unavailable" | "api-error" | "empty";

export function isAuthenticationRequest(path: string): boolean {
  return /(?:^|[,/])auth\.(?:login|register|me|logout)(?:\?|,|$)/.test(path);
}

const AUTHORITATIVE_CCMG_WRITES = [
  "m21.transitionWorkflow",
  "m21.assignWorkflow",
  "m21.approveWorkflow",
  "m21.handoffWorkflow",
  "m21.escalateWorkflow",
  "m21.setExceptionDisposition",
  "m21.decideHandoff",
  "m21.recordReferralGate",
  "m21.finalizeCansVersion",
  "m21.approveCansTargetRoute",
  "m21.createMedicationOversightAlert",
] as const;

export function isAuthoritativeCcmgWriteRequest(path: string): boolean {
  return AUTHORITATIVE_CCMG_WRITES.some((procedure) =>
    path.includes(procedure),
  );
}

export function mayUseEvaluationData(
  path: string,
  kind: EvaluationFallbackKind,
  evaluationMode = runtimeConfig.evaluationMode,
): boolean {
  if (!evaluationMode) return false;
  // Evaluation fixtures may replace eligible reads, never controlled writes.
  if (isAuthoritativeCcmgWriteRequest(path)) return false;
  // A responding authentication service remains authoritative. Invalid
  // credentials and expired sessions must never be converted into a login.
  if (kind === "api-error" && isAuthenticationRequest(path)) return false;
  return true;
}
