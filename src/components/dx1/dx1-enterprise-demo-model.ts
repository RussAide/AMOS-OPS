import type { Dx1CriterionResult, Dx1PrototypeBoundary } from "../../../api/services/dx1/contracts";
import type { Dx1ExperienceGovernanceResult } from "../../../api/services/dx1/experience";

export const DX1_DEMO_SCENARIO_ID =
  "SYNTH-DX1-CROSS-ENTERPRISE-DEMO-001" as const;

export type Dx1ExperiencePresentation = Omit<
  Dx1ExperienceGovernanceResult,
  "releaseGovernance"
> & {
  readonly releaseGovernance?: Dx1ExperienceGovernanceResult["releaseGovernance"];
};

export interface Dx1EnterpriseDemoSnapshot {
  readonly milestone: "DX.1";
  readonly scenarioId: typeof DX1_DEMO_SCENARIO_ID;
  readonly evaluatedAt: string;
  readonly acceptance: "ACCEPTED" | "NOT_ACCEPTED";
  readonly accepted?: boolean;
  readonly passed: boolean;
  readonly assertionCount: number;
  readonly criteria: readonly Dx1CriterionResult[];
  readonly streams: Readonly<{
    experience: Readonly<Dx1ExperiencePresentation>;
    intelligence?: Readonly<{ streamId: string; passed: boolean }>;
    pilot?: Readonly<{ streamId: string; passed: boolean }>;
  }>;
  readonly boundary: Readonly<Dx1PrototypeBoundary>;
  readonly viewer?: Readonly<{
    actorId?: string;
    role?: string;
    canRunVerification?: boolean;
    canRunIntegratedEvaluation?: boolean;
  }>;
}

export type Dx1EnterpriseDemoViewState = "loading" | "error" | "ready";

export function dx1AcceptanceCounts(snapshot: Dx1EnterpriseDemoSnapshot | null) {
  return Object.freeze({
    passed:
      snapshot?.criteria.filter((criterion) => criterion.status === "Complete")
        .length ?? 0,
    total: snapshot?.criteria.length ?? 12,
  });
}

export function dx1ExperienceCriteriaCounts(
  snapshot: Dx1EnterpriseDemoSnapshot | null,
) {
  const criteria = snapshot?.streams.experience.criteria ?? [];
  return Object.freeze({
    passed: criteria.filter((criterion) => criterion.status === "Complete").length,
    total: criteria.length || 5,
    assertions: criteria.reduce(
      (total, criterion) => total + criterion.assertionIds.length,
      0,
    ),
  });
}

export function dx1ExperienceStream(
  snapshot: Dx1EnterpriseDemoSnapshot | null,
): Readonly<Dx1ExperiencePresentation> | null {
  return snapshot?.streams.experience ?? null;
}
