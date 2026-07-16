import { useState } from "react";
import { toast } from "sonner";
import { M42DocumentKnowledgeView } from "@/components/m42/m42-document-knowledge-view";
import type { M42ScenarioResult } from "@/components/m42/m42-experience-model";
import { trpc } from "@/providers/trpc";

const SCENARIO_ID = "SYNTH-M42-SCENARIO-DOCUMENT-KNOWLEDGE" as const;

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export function M42DocumentKnowledgePage() {
  const [scenarioResult, setScenarioResult] =
    useState<M42ScenarioResult | null>(null);
  const [documentQuery, setDocumentQuery] = useState<string | null>(null);
  const [nilQuery, setNilQuery] = useState<string | null>(null);

  const snapshotQuery = trpc.m42.getExperienceSnapshot.useQuery();
  const acceptanceQuery = trpc.m42.getAcceptanceStatus.useQuery();
  const documentsQuery = trpc.m42.listGovernedDocuments.useQuery();
  const reportFieldsQuery = trpc.m42.listReportFields.useQuery(undefined, {
    enabled: snapshotQuery.data?.viewer.canBuildReports === true,
  });
  const configurationSchemasQuery =
    trpc.m42.listConfigurationSchemas.useQuery(undefined, {
      enabled:
        snapshotQuery.data?.viewer.canAdministerConfiguration === true,
    });
  const documentSearch = trpc.m42.searchDocuments.useQuery(
    { text: documentQuery ?? "retention governance", limit: 6 },
    { enabled: documentQuery !== null },
  );
  const nilSearch = trpc.m42.searchNil.useQuery(
    { query: nilQuery ?? "youth continuum transition", limit: 5 },
    { enabled: nilQuery !== null },
  );
  const runScenario = trpc.m42.runIntegratedScenario.useMutation({
    onSuccess: (result) => {
      setScenarioResult(result);
      toast.success("All eight M4.2 controls passed the integrated scenario.");
    },
    onError: (error) =>
      toast.error(error.message || "The integrated M4.2 scenario did not complete."),
  });
  const evaluateDocument = trpc.m42.evaluateDocumentAction.useMutation({
    onSuccess: (result) =>
      toast.success(
        result.allowed
          ? "Document action passed the signed-in role checks."
          : "Document action was denied and recorded by the demo control.",
      ),
    onError: (error) =>
      toast.error(error.message || "Document access evaluation failed."),
  });
  const runVersionDemo = trpc.m42.runVersionControlDemo.useMutation({
    onSuccess: () =>
      toast.success("Version, approval, publication, and supersession passed."),
    onError: (error) =>
      toast.error(error.message || "The version-control demo failed."),
  });
  const runReportDemo = trpc.m42.runReportBuilderDemo.useMutation({
    onSuccess: () =>
      toast.success("Role-trimmed report execution and export manifest passed."),
    onError: (error) =>
      toast.error(error.message || "The report-builder demo failed."),
  });
  const runConfigurationDemo = trpc.m42.runConfigurationDemo.useMutation({
    onSuccess: () =>
      toast.success("Configuration change and append-only rollback passed."),
    onError: (error) =>
      toast.error(error.message || "The configuration demo failed."),
  });

  const refresh = async () => {
    await Promise.all([
      snapshotQuery.refetch(),
      acceptanceQuery.refetch(),
      documentsQuery.refetch(),
      reportFieldsQuery.refetch(),
      configurationSchemasQuery.refetch(),
    ]);
  };
  const isLoading = snapshotQuery.isLoading || acceptanceQuery.isLoading;
  const isError = snapshotQuery.isError || acceptanceQuery.isError;
  const combinedError =
    errorMessage(snapshotQuery.error) ?? errorMessage(acceptanceQuery.error);

  return (
    <M42DocumentKnowledgeView
      acceptance={acceptanceQuery.data ?? null}
      configurationDemoResult={runConfigurationDemo.data ?? null}
      configurationSchemas={configurationSchemasQuery.data ?? null}
      documentActionResult={evaluateDocument.data ?? null}
      documentSearchResult={documentSearch.data ?? null}
      errorMessage={combinedError}
      governedDocuments={documentsQuery.data ?? null}
      isEvaluatingDocument={evaluateDocument.isPending}
      isRefreshing={snapshotQuery.isFetching || acceptanceQuery.isFetching}
      isRunningConfigurationDemo={runConfigurationDemo.isPending}
      isRunningReportDemo={runReportDemo.isPending}
      isRunningScenario={runScenario.isPending}
      isRunningVersionDemo={runVersionDemo.isPending}
      isSearchingDocuments={documentSearch.isFetching}
      isSearchingNil={nilSearch.isFetching}
      nilSearchResult={nilSearch.data ?? null}
      onEvaluateDocument={(documentId, action) =>
        evaluateDocument.mutate({ documentId, action })
      }
      onRefresh={() => void refresh()}
      onRunConfigurationDemo={(configKey) =>
        runConfigurationDemo.mutate({ configKey })
      }
      onRunReportDemo={() => runReportDemo.mutate()}
      onRunScenario={() =>
        runScenario.mutate({ scenarioId: SCENARIO_ID, searchIterations: 3 })
      }
      onRunVersionDemo={() => runVersionDemo.mutate()}
      onSearchDocuments={(query) => {
        setDocumentQuery(query);
        if (query === documentQuery) void documentSearch.refetch();
      }}
      onSearchNil={(query) => {
        setNilQuery(query);
        if (query === nilQuery) void nilSearch.refetch();
      }}
      reportDemoResult={runReportDemo.data ?? null}
      reportFields={reportFieldsQuery.data ?? null}
      scenarioResult={scenarioResult}
      snapshot={snapshotQuery.data ?? null}
      state={isLoading ? "loading" : isError ? "error" : "ready"}
      versionDemoResult={runVersionDemo.data ?? null}
    />
  );
}

export default M42DocumentKnowledgePage;
