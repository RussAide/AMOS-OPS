import { useState } from "react";
import { toast } from "sonner";
import {
  DX1_DEMO_SCENARIO_ID,
  Dx1EnterpriseDemoView,
  type Dx1EnterpriseDemoSnapshot,
} from "@/components/dx1";
import { trpc } from "@/providers/trpc";

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export function Dx1EnterpriseDemoPage() {
  const [verificationResult, setVerificationResult] =
    useState<Dx1EnterpriseDemoSnapshot | null>(null);

  const snapshotQuery = trpc.dx1.getExperienceSnapshot.useQuery(undefined, {
    retry: false,
  });
  const runVerification = trpc.dx1.runIntegratedScenario.useMutation({
    onSuccess: (result) => {
      const snapshot = result as unknown as Dx1EnterpriseDemoSnapshot;
      setVerificationResult(snapshot);
      toast.success(
        snapshot.passed
          ? "All twelve DX.1 controls passed."
          : "DX.1 verification completed with controls requiring review.",
      );
    },
    onError: (error) =>
      toast.error(
        error.message || "The deterministic DX.1 verification could not run.",
      ),
  });

  const querySnapshot =
    (snapshotQuery.data as unknown as Dx1EnterpriseDemoSnapshot | undefined) ??
    null;
  const snapshot = verificationResult ?? querySnapshot;

  return (
    <Dx1EnterpriseDemoView
      canRunVerification={
        snapshot?.viewer?.canRunVerification ??
        snapshot?.viewer?.canRunIntegratedEvaluation
      }
      errorMessage={errorMessage(snapshotQuery.error)}
      isRefreshing={snapshotQuery.isFetching}
      isRunning={runVerification.isPending}
      onRefresh={() => {
        setVerificationResult(null);
        void snapshotQuery.refetch();
      }}
      onRunVerification={() =>
        runVerification.mutate({ scenarioId: DX1_DEMO_SCENARIO_ID })
      }
      snapshot={snapshot}
      state={
        snapshotQuery.isLoading
          ? "loading"
          : snapshotQuery.isError
            ? "error"
            : "ready"
      }
    />
  );
}

export default Dx1EnterpriseDemoPage;
