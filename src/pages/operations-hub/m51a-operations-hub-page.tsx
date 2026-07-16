import { useState } from "react";
import { toast } from "sonner";
import { M51AOperationsHubView } from "@/components/m51a/m51a-operations-hub-view";
import type {
  M51AScenarioResult,
  M51ASnapshot,
} from "@/components/m51a/m51a-experience-model";
import { trpc } from "@/providers/trpc";

const SCENARIO_ID =
  "SYNTH-M51A-INTEGRATED-OPERATIONS-HUB-SCENARIO" as const;

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export function M51AOperationsHubPage() {
  const [scenarioResult, setScenarioResult] =
    useState<M51AScenarioResult | null>(null);
  const [routeCode, setRouteCode] =
    useState<M51ASnapshot["hub"]["routes"][number]["code"] | null>(null);

  const snapshotQuery = trpc.m51a.getExperienceSnapshot.useQuery();
  const acceptanceQuery = trpc.m51a.getAcceptanceStatus.useQuery();
  const routeQuery = trpc.m51a.resolveIntranetRoute.useQuery(
    { routeCode: routeCode ?? "home-enterprise-operations" },
    { enabled: routeCode !== null },
  );
  const runScenario = trpc.m51a.runIntegratedScenario.useMutation({
    onSuccess: (result) => {
      setScenarioResult(result);
      toast.success(
        result.accepted
          ? "All eight M5.1A controls passed."
          : "The M5.1A evaluation completed with controls requiring review.",
      );
    },
    onError: (error) =>
      toast.error(error.message || "The integrated M5.1A evaluation failed."),
  });

  const refresh = async () => {
    await Promise.all([
      snapshotQuery.refetch(),
      acceptanceQuery.refetch(),
      routeCode ? routeQuery.refetch() : Promise.resolve(),
    ]);
  };
  const isLoading = snapshotQuery.isLoading || acceptanceQuery.isLoading;
  const isError = snapshotQuery.isError || acceptanceQuery.isError;

  return (
    <M51AOperationsHubView
      acceptance={acceptanceQuery.data ?? null}
      errorMessage={
        errorMessage(snapshotQuery.error) ?? errorMessage(acceptanceQuery.error)
      }
      isRefreshing={
        snapshotQuery.isFetching || acceptanceQuery.isFetching
      }
      isResolvingRoute={routeQuery.isFetching}
      isRunningScenario={runScenario.isPending}
      onRefresh={() => void refresh()}
      onResolveRoute={(nextRouteCode) => {
        setRouteCode(nextRouteCode);
        if (nextRouteCode === routeCode) void routeQuery.refetch();
      }}
      onRunScenario={() =>
        runScenario.mutate({ scenarioId: SCENARIO_ID })
      }
      routeDecision={routeQuery.data ?? null}
      scenarioResult={scenarioResult}
      snapshot={snapshotQuery.data ?? null}
      state={isLoading ? "loading" : isError ? "error" : "ready"}
    />
  );
}

export default M51AOperationsHubPage;
