import { useState } from "react";
import { toast } from "sonner";
import { M51BMicrosoftIntegrationsView } from "@/components/m51b/m51b-microsoft-integrations-view";
import type { M51BScenarioResult } from "@/components/m51b/m51b-experience-model";
import { trpc } from "@/providers/trpc";
import { M51B_INTEGRATED_SCENARIO_ID } from "@contracts/m51b/integrated-scenario";

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export function M51BMicrosoftIntegrationsPage() {
  const [scenarioResult, setScenarioResult] =
    useState<M51BScenarioResult | null>(null);
  const snapshotQuery = trpc.m51b.getExperienceSnapshot.useQuery();
  const acceptanceQuery = trpc.m51b.getAcceptanceStatus.useQuery();
  const runScenario = trpc.m51b.runIntegratedScenario.useMutation({
    onSuccess: (result) => {
      setScenarioResult(result);
      toast.success(
        result.accepted
          ? "All eight M5.1B synthetic integration controls passed."
          : "The M5.1B evaluation completed with controls requiring review.",
      );
    },
    onError: (error) =>
      toast.error(
        error.message || "The synthetic M5.1B integration evaluation failed.",
      ),
  });

  const refresh = async () => {
    await Promise.all([
      snapshotQuery.refetch(),
      acceptanceQuery.refetch(),
    ]);
  };
  const isLoading = snapshotQuery.isLoading || acceptanceQuery.isLoading;
  const isError = snapshotQuery.isError || acceptanceQuery.isError;

  return (
    <M51BMicrosoftIntegrationsView
      acceptance={acceptanceQuery.data ?? null}
      errorMessage={
        errorMessage(snapshotQuery.error) ?? errorMessage(acceptanceQuery.error)
      }
      isRefreshing={snapshotQuery.isFetching || acceptanceQuery.isFetching}
      isRunningScenario={runScenario.isPending}
      onRefresh={() => void refresh()}
      onRunScenario={() =>
        runScenario.mutate({ scenarioId: M51B_INTEGRATED_SCENARIO_ID })
      }
      scenarioResult={scenarioResult}
      snapshot={snapshotQuery.data ?? null}
      state={isLoading ? "loading" : isError ? "error" : "ready"}
    />
  );
}

export default M51BMicrosoftIntegrationsPage;
