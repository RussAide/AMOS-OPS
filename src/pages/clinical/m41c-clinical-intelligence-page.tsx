import type {
  M41cClinicalGuidanceResponse,
  M41cSyntheticScenarioRunResponse,
} from "@contracts/m41c";
import { useState } from "react";
import { toast } from "sonner";
import { M41cClinicalIntelligenceView } from "@/components/m41c/m41c-clinical-intelligence-view";
import type { M41cGuidanceSubmission } from "@/components/m41c/m41c-experience-model";
import { trpc } from "@/providers/trpc";

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function syntheticRequestId(): string {
  return `SYNTH-M41C-UI-${crypto.randomUUID()}`;
}

export function M41cClinicalIntelligencePage() {
  const [guidance, setGuidance] = useState<M41cClinicalGuidanceResponse | null>(
    null,
  );
  const [scenarioResult, setScenarioResult] =
    useState<M41cSyntheticScenarioRunResponse | null>(null);
  const snapshotQuery = trpc.m41c.getExperienceSnapshot.useQuery();
  const workplanQuery = trpc.m41c.getMyClinicalWorkplan.useQuery();

  const askClinicalGuidance = trpc.m41c.askClinicalGuidance.useMutation({
    onSuccess: (result) => {
      setGuidance(result);
      toast.success(
        result.refused
          ? "AMOS recorded a governed clinical refusal and route."
          : "Sourced synthetic clinical guidance returned.",
      );
    },
    onError: (error) =>
      toast.error(
        error.message || "The governed clinical guidance request failed.",
      ),
  });

  const runSyntheticScenario = trpc.m41c.runSyntheticScenario.useMutation({
    onSuccess: (result) => {
      setScenarioResult(result);
      toast.success("Deterministic synthetic scenario controls passed.");
    },
    onError: (error) =>
      toast.error(error.message || "The synthetic scenario did not complete."),
  });

  const refreshGovernedState = async () => {
    await Promise.all([snapshotQuery.refetch(), workplanQuery.refetch()]);
  };

  const submitGuidance = (submission: M41cGuidanceSubmission) => {
    askClinicalGuidance.mutate({
      requestId: syntheticRequestId(),
      subjectId: submission.subjectId,
      prompt: submission.prompt,
      intent: submission.intent,
      sourceIds: submission.sourceIds ? [...submission.sourceIds] : undefined,
      workplanItemId: submission.workplanItemId,
    });
  };

  const isLoading = snapshotQuery.isLoading || workplanQuery.isLoading;
  const isError = snapshotQuery.isError || workplanQuery.isError;
  const combinedError =
    errorMessage(snapshotQuery.error) ?? errorMessage(workplanQuery.error);

  return (
    <M41cClinicalIntelligenceView
      errorMessage={combinedError}
      guidance={guidance}
      isRefreshing={snapshotQuery.isFetching || workplanQuery.isFetching}
      isRunningScenario={runSyntheticScenario.isPending}
      isSubmittingGuidance={askClinicalGuidance.isPending}
      onAsk={submitGuidance}
      onRefresh={() => void refreshGovernedState()}
      onRunScenario={(scenarioId) =>
        runSyntheticScenario.mutate({ scenarioId })
      }
      scenarioResult={scenarioResult}
      snapshot={snapshotQuery.data ?? null}
      state={isLoading ? "loading" : isError ? "error" : "ready"}
      workplan={workplanQuery.data ?? null}
    />
  );
}

export default M41cClinicalIntelligencePage;
