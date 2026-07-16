import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";

type Outputs = inferRouterOutputs<AppRouter>;

export type M51BSnapshot = Outputs["m51b"]["getExperienceSnapshot"];
export type M51BAcceptanceStatus = Outputs["m51b"]["getAcceptanceStatus"];
export type M51BScenarioResult = Outputs["m51b"]["runIntegratedScenario"];

export interface M51BAcceptancePresentation {
  accepted: boolean;
  acceptanceFlags: readonly {
    criterionId: string;
    passed: boolean;
    assertionCount: number;
    summary: string;
    evidenceIds: readonly string[];
  }[];
}

export interface M51BChannelReadiness {
  channel: "Teams" | "Outlook" | "SharePoint";
  passed: boolean;
  measure: string;
  detail: string;
}

export const M51B_SHAREPOINT_GATE_PRESENTATION = Object.freeze([
  { code: "registry", label: "Registry" },
  { code: "connector_mode", label: "Connector mode" },
  { code: "stable_identity", label: "Stable identity" },
  { code: "permission", label: "Permission" },
  { code: "classification", label: "Classification" },
  { code: "retention", label: "Retention" },
  { code: "lifecycle", label: "Lifecycle" },
  { code: "source_of_truth", label: "Source of truth" },
  { code: "intranet_route", label: "Intranet route" },
  { code: "approval", label: "Approval" },
  { code: "synthetic_boundary", label: "Synthetic boundary" },
] as const);

export type M51BSharePointGateCode =
  (typeof M51B_SHAREPOINT_GATE_PRESENTATION)[number]["code"];

export interface M51BSharePointGateReadiness {
  code: M51BSharePointGateCode;
  label: string;
  passed: boolean;
}

export function m51bAcceptanceCounts(
  result: M51BAcceptancePresentation | null,
): { passed: number; total: number; assertions: number } {
  return {
    passed:
      result?.acceptanceFlags.filter((criterion) => criterion.passed).length ??
      0,
    total: result?.acceptanceFlags.length ?? 8,
    assertions:
      result?.acceptanceFlags.reduce(
        (total, criterion) => total + criterion.assertionCount,
        0,
      ) ?? 0,
  };
}

export function m51bChannelReadiness(
  snapshot: M51BSnapshot,
): readonly M51BChannelReadiness[] {
  return [
    {
      channel: "Teams",
      passed:
        snapshot.channels.teams.withinThreshold &&
        snapshot.channels.teams.destinationResolved &&
        snapshot.channels.teams.mentionsValidated &&
        snapshot.channels.teams.contentMinimized &&
        snapshot.channels.teams.acknowledgementRecorded,
      measure: `${(snapshot.channels.teams.deliveryElapsedMilliseconds / 1_000).toFixed(2)}s`,
      detail: `within ${snapshot.channels.teams.thresholdMilliseconds / 1_000}s threshold`,
    },
    {
      channel: "Outlook",
      passed:
        snapshot.channels.outlook.exactlyOneIntake &&
        snapshot.channels.outlook.duplicatePrevented &&
        snapshot.channels.outlook.privacyExceptionRouted &&
        snapshot.channels.outlook.deadLetterRecovered,
      measure: `${snapshot.channels.outlook.intakeCount} intake`,
      detail: "exactly-once synthetic referral processing",
    },
    {
      channel: "SharePoint",
      passed:
        snapshot.channels.sharepoint.withinThreshold &&
        snapshot.channels.sharepoint.governanceGatesPassed ===
          snapshot.channels.sharepoint.governanceGatesTotal &&
        snapshot.channels.sharepoint.reconciliationPassed,
      measure: `${snapshot.channels.sharepoint.elapsedSeconds}s`,
      detail: `within ${snapshot.channels.sharepoint.thresholdSeconds / 60}m threshold`,
    },
  ] as const;
}

/**
 * Projects each SharePoint governance gate from the server evidence map.
 * Missing per-gate evidence fails closed; the aggregate passed/total counters
 * are never used to guess which named gate passed.
 */
export function m51bSharePointGateReadiness(
  snapshot: M51BSnapshot,
): readonly M51BSharePointGateReadiness[] {
  const sharepoint = snapshot.channels.sharepoint as typeof snapshot.channels.sharepoint & {
    governanceGates?: Partial<Record<M51BSharePointGateCode, boolean>>;
  };

  return M51B_SHAREPOINT_GATE_PRESENTATION.map(({ code, label }) => ({
    code,
    label,
    passed: sharepoint.governanceGates?.[code] === true,
  }));
}

export function m51bHasZeroLiveOperations(snapshot: M51BSnapshot): boolean {
  return (
    snapshot.boundary.syntheticOnly &&
    !snapshot.boundary.realDataUsed &&
    !snapshot.boundary.realFileContentRead &&
    snapshot.boundary.liveGraphCalls === 0 &&
    snapshot.boundary.liveMicrosoftReads === 0 &&
    snapshot.boundary.liveMicrosoftWrites === 0 &&
    snapshot.boundary.realNotificationsSent === 0 &&
    snapshot.boundary.realMailRead === 0 &&
    snapshot.boundary.productionRows === 0 &&
    snapshot.boundary.liveWrites === 0 &&
    !snapshot.boundary.liveConnectorMutation &&
    !snapshot.boundary.tenantProvisioning &&
    !snapshot.boundary.productionSecretRead &&
    !snapshot.boundary.productionDeployment &&
    !snapshot.boundary.githubPush
  );
}
