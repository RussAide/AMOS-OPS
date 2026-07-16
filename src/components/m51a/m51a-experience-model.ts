import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../api/router";

type Outputs = inferRouterOutputs<AppRouter>;

export type M51ASnapshot = Outputs["m51a"]["getExperienceSnapshot"];
export type M51ARouteDecision = Outputs["m51a"]["resolveIntranetRoute"];
export type M51AAcceptanceStatus = Outputs["m51a"]["getAcceptanceStatus"];
export type M51AScenarioResult = Outputs["m51a"]["runIntegratedScenario"];

export interface M51AAcceptancePresentation {
  accepted: boolean;
  acceptanceFlags: readonly {
    criterionId: string;
    passed: boolean;
    assertionCount: number;
    summary: string;
    evidenceIds: readonly string[];
  }[];
  totals?: Readonly<Record<string, number>>;
}

export function m51aAcceptanceCounts(
  result: M51AAcceptancePresentation | null,
): { passed: number; total: number } {
  return {
    passed:
      result?.acceptanceFlags.filter((criterion) => criterion.passed).length ??
      0,
    total: result?.acceptanceFlags.length ?? 8,
  };
}
