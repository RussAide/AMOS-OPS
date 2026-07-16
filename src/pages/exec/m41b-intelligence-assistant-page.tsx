import type { M41bGuidanceResponse, M41bRecommendation } from "@contracts/m41b";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { M41bIntelligenceAssistantView } from "@/components/m41b/m41b-intelligence-assistant-view";
import type {
  M41bDispositionSubmission,
  M41bGuidanceSubmission,
} from "@/components/m41b/m41b-experience-model";
import { trpc } from "@/providers/trpc";

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function uniqueRecommendations(
  recommendations: readonly M41bRecommendation[],
  latest: M41bRecommendation | null,
): readonly M41bRecommendation[] {
  if (!latest) return recommendations;
  return [
    ...recommendations.filter(
      (recommendation) => recommendation.id !== latest.id,
    ),
    latest,
  ];
}

function uniqueGuidance(
  guidance: readonly M41bGuidanceResponse[],
  latest: M41bGuidanceResponse | null,
): readonly M41bGuidanceResponse[] {
  if (!latest) return guidance;
  return [
    ...guidance.filter((response) => response.responseId !== latest.responseId),
    latest,
  ];
}

export function M41bIntelligenceAssistantPage() {
  const [activeGuidance, setActiveGuidance] =
    useState<M41bGuidanceResponse | null>(null);
  const [latestRecommendation, setLatestRecommendation] =
    useState<M41bRecommendation | null>(null);
  const workplanQuery = trpc.m41b.getMyWorkplan.useQuery();
  const lineageQuery = trpc.m41b.getAuditLineage.useQuery();

  const refreshGovernedState = async () => {
    await Promise.all([workplanQuery.refetch(), lineageQuery.refetch()]);
  };

  const askAmos = trpc.m41b.askAmos.useMutation({
    onSuccess: async (result) => {
      setActiveGuidance(result.response);
      setLatestRecommendation(result.recommendation);
      toast.success(
        result.response.refused
          ? "AMOS recorded a governed refusal and route."
          : "Sourced AMOS guidance returned.",
      );
      await refreshGovernedState();
    },
    onError: (error) =>
      toast.error(error.message || "The governed Ask AMOS request failed."),
  });

  const recordDisposition = trpc.m41b.recordHumanDisposition.useMutation({
    onSuccess: async (result) => {
      setLatestRecommendation(result.recommendation);
      setActiveGuidance((current) => {
        if (
          !current ||
          current.recommendationId !== result.recommendation.id
        )
          return current;
        const disposition =
          result.decision.disposition === "reject"
            ? "rejected"
            : result.decision.disposition === "modify"
              ? "modified"
              : "approved";
        return {
          ...current,
          humanGate: {
            ...current.humanGate,
            disposition,
            decisionId: result.decision.id,
          },
        };
      });
      toast.success(
        result.task
          ? "Human disposition recorded and owned task created."
          : "Human disposition recorded without a downstream task.",
      );
      await refreshGovernedState();
    },
    onError: (error) =>
      toast.error(
        error.message || "The accountable human disposition was not recorded.",
      ),
  });

  const addEvidence = trpc.m41b.addCompletionEvidence.useMutation({
    onSuccess: async () => {
      toast.success("Synthetic completion evidence recorded.");
      await refreshGovernedState();
    },
    onError: (error) =>
      toast.error(error.message || "Completion evidence was not recorded."),
  });

  const completeTask = trpc.m41b.completeTask.useMutation({
    onSuccess: async () => {
      toast.success("Task closed with accountable evidence lineage.");
      await refreshGovernedState();
    },
    onError: (error) =>
      toast.error(error.message || "The governed task was not closed."),
  });

  const escalateTask = trpc.m41b.escalateTask.useMutation({
    onSuccess: async () => {
      toast.success("Task escalated through the governed route.");
      await refreshGovernedState();
    },
    onError: (error) =>
      toast.error(error.message || "The governed escalation was not recorded."),
  });

  const submitGuidance = (submission: M41bGuidanceSubmission) => {
    askAmos.mutate({
      requestId: `SYNTH-M41B-UI-${crypto.randomUUID()}`,
      prompt: submission.prompt,
      intent: submission.intent,
      sourceIds: submission.sourceIds ? [...submission.sourceIds] : undefined,
      workplanItemId: submission.workplanItemId,
      requestedDivision: submission.requestedDivision,
      requestedDomain: submission.requestedDomain,
    });
  };

  const submitDisposition = (submission: M41bDispositionSubmission) => {
    recordDisposition.mutate(submission);
  };

  const routeSupervisor = (response: M41bGuidanceResponse) => {
    const firstCitation = response.citations[0];
    const source = lineageQuery.data?.sources.find(
      (candidate) => candidate.id === firstCitation?.sourceId,
    );
    const ownDivision = workplanQuery.data?.roleContext.division;
    const requestedDivision = source?.divisions.includes(ownDivision ?? "eo")
      ? ownDivision
      : source?.divisions.length === 1
        ? source.divisions[0]
        : undefined;
    askAmos.mutate({
      requestId: `SYNTH-M41B-UI-${crypto.randomUUID()}`,
      prompt:
        "Route this governed guidance to an authorized supervisor for documented review.",
      intent: "route_supervisor",
      sourceIds: response.citations.map((citation) => citation.sourceId),
      requestedDivision,
      requestedDomain: response.humanGate.materialDomain,
    });
  };

  const guidanceHistory = useMemo(
    () => uniqueGuidance(lineageQuery.data?.guidance ?? [], activeGuidance),
    [lineageQuery.data?.guidance, activeGuidance],
  );
  const recommendations = useMemo(
    () =>
      uniqueRecommendations(
        lineageQuery.data?.recommendations ?? [],
        latestRecommendation,
      ),
    [lineageQuery.data?.recommendations, latestRecommendation],
  );
  const isLoading = workplanQuery.isLoading || lineageQuery.isLoading;
  const isError = workplanQuery.isError || lineageQuery.isError;
  const combinedError =
    errorMessage(workplanQuery.error) ?? errorMessage(lineageQuery.error);
  const pendingTaskId = addEvidence.isPending
    ? addEvidence.variables?.taskId
    : completeTask.isPending
      ? completeTask.variables?.taskId
      : escalateTask.isPending
        ? escalateTask.variables?.taskId
        : undefined;

  return (
    <M41bIntelligenceAssistantView
      activeGuidance={activeGuidance}
      auditEvents={lineageQuery.data?.auditEvents ?? []}
      completionEvidence={lineageQuery.data?.completionEvidence ?? []}
      decisions={lineageQuery.data?.decisions ?? []}
      errorMessage={combinedError}
      guidanceHistory={guidanceHistory}
      isRefreshing={workplanQuery.isFetching || lineageQuery.isFetching}
      isSubmittingDisposition={recordDisposition.isPending}
      isSubmittingGuidance={askAmos.isPending}
      mutatingTaskId={pendingTaskId ?? null}
      onAddEvidence={(taskId, summary) =>
        addEvidence.mutate({
          taskId,
          evidenceRef: `SYNTH-M41B-UI-EVIDENCE-${crypto.randomUUID()}`,
          summary,
        })
      }
      onAsk={submitGuidance}
      onCompleteTask={(taskId) => completeTask.mutate({ taskId })}
      onDisposition={submitDisposition}
      onEscalateTask={(taskId) => escalateTask.mutate({ taskId })}
      onRefresh={() => void refreshGovernedState()}
      onRouteSupervisor={routeSupervisor}
      recommendations={recommendations}
      requests={lineageQuery.data?.requests ?? []}
      sources={lineageQuery.data?.sources ?? []}
      state={isLoading ? "loading" : isError ? "error" : "ready"}
      workplan={workplanQuery.data ?? null}
    />
  );
}

export default M41bIntelligenceAssistantPage;
