import {
  authorizedM41aScopes,
  type M41aDecisionDisposition,
  type M41aDrillDepth,
  type M41aScopeId,
} from "@contracts/m41a";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { M41aDecisionIntelligenceView } from "@/components/m41a/m41a-decision-intelligence-view";
import {
  M41A_DECISION_DISPOSITIONS,
  normalizeM41aAlerts,
  normalizeM41aDashboard,
  normalizeM41aDrilldown,
  type M41aDrillNodeView,
  type M41aMetricView,
} from "@/components/m41a/m41a-model";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/use-auth";

interface DrillRequest {
  depth: M41aDrillDepth;
  parentId?: string;
}

function queryState(query: { isLoading: boolean; isError: boolean }) {
  return query.isLoading ? "loading" : query.isError ? "error" : "ready";
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : undefined;
}

export function M41aDecisionIntelligencePage() {
  const { currentRole } = useAuth();
  const roleScopes = authorizedM41aScopes(currentRole);
  const [requestedScope, setRequestedScope] =
    useState<M41aScopeId>("ENTERPRISE");
  const scope = roleScopes.includes(requestedScope)
    ? requestedScope
    : (roleScopes[0] ?? "ENTERPRISE");
  const [selectedMetric, setSelectedMetric] = useState<M41aMetricView | null>(
    null,
  );
  const [drillHistory, setDrillHistory] = useState<DrillRequest[]>([
    { depth: 1 },
  ]);

  const dashboardQuery = trpc.m41a.getDashboard.useQuery({ scope });
  const alertsQuery = trpc.m41a.listAlerts.useQuery({ scope });
  const currentDrill = drillHistory[drillHistory.length - 1] ?? { depth: 1 };
  const drilldownQuery = trpc.m41a.getDrilldown.useQuery(
    {
      scope,
      metricId: selectedMetric?.id ?? "",
      depth: currentDrill.depth,
      parentId: currentDrill.parentId,
    },
    { enabled: selectedMetric !== null },
  );

  const refreshGovernedState = async () => {
    await Promise.all([dashboardQuery.refetch(), alertsQuery.refetch()]);
    if (selectedMetric) await drilldownQuery.refetch();
  };

  const mutationOptions = (successMessage: string) => ({
    onSuccess: async () => {
      toast.success(successMessage);
      await refreshGovernedState();
    },
    onError: (error: unknown) =>
      toast.error(errorMessage(error) ?? "The governed action failed."),
  });

  const acknowledgeAlert = trpc.m41a.acknowledgeAlert.useMutation(
    mutationOptions("Alert acknowledged with authenticated actor."),
  );
  const assignAlert = trpc.m41a.assignAlert.useMutation(
    mutationOptions("Alert assignment recorded."),
  );
  const recordDecision = trpc.m41a.recordDecision.useMutation(
    mutationOptions("Human decision and rationale recorded."),
  );
  const addFollowUpEvidence = trpc.m41a.addFollowUpEvidence.useMutation(
    mutationOptions("Follow-up evidence linked to the alert."),
  );
  const resolveAlert = trpc.m41a.resolveAlert.useMutation(
    mutationOptions("Alert resolved with its evidence chain intact."),
  );
  const resetEvaluation = trpc.m41a.resetEvaluation.useMutation({
    onSuccess: async () => {
      setSelectedMetric(null);
      setDrillHistory([{ depth: 1 }]);
      toast.success("Synthetic decision-intelligence evaluation reset.");
      await Promise.all([dashboardQuery.refetch(), alertsQuery.refetch()]);
    },
    onError: (error) => toast.error(error.message),
  });

  const dashboard = normalizeM41aDashboard(dashboardQuery.data, scope);
  const alerts = useMemo(
    () => normalizeM41aAlerts(alertsQuery.data, dashboardQuery.data),
    [alertsQuery.data, dashboardQuery.data],
  );
  const drilldown = normalizeM41aDrilldown(
    drilldownQuery.data,
    selectedMetric?.title ?? "Governed metric",
  );
  const isMutating =
    acknowledgeAlert.isPending ||
    assignAlert.isPending ||
    recordDecision.isPending ||
    addFollowUpEvidence.isPending ||
    resolveAlert.isPending ||
    resetEvaluation.isPending;

  const changeScope = (nextScope: M41aScopeId) => {
    setRequestedScope(nextScope);
    setSelectedMetric(null);
    setDrillHistory([{ depth: 1 }]);
  };

  const inspectMetric = (metric: M41aMetricView) => {
    setSelectedMetric(metric);
    setDrillHistory([{ depth: 1 }]);
  };

  const selectDrillNode = (node: M41aDrillNodeView) => {
    if (!drilldown || !node.hasChildren || drilldown.depth >= 3) return;
    const nextDepth = (drilldown.depth + 1) as M41aDrillDepth;
    setDrillHistory((history) => [
      ...history,
      { depth: nextDepth, parentId: node.id },
    ]);
  };

  return (
    <M41aDecisionIntelligenceView
      alerts={alerts}
      alertsError={errorMessage(alertsQuery.error)}
      alertsState={queryState(alertsQuery)}
      dashboard={dashboard}
      dashboardError={errorMessage(dashboardQuery.error)}
      dashboardState={queryState(dashboardQuery)}
      decisionDispositions={M41A_DECISION_DISPOSITIONS}
      drilldown={drilldown}
      drilldownError={errorMessage(drilldownQuery.error)}
      drilldownState={selectedMetric ? queryState(drilldownQuery) : "ready"}
      isAlertsFetching={alertsQuery.isFetching}
      isDashboardFetching={dashboardQuery.isFetching}
      isDrilldownFetching={drilldownQuery.isFetching}
      isMutating={isMutating}
      onAcknowledge={({ alertId }) => acknowledgeAlert.mutate({ alertId })}
      onAddEvidence={({ alertId, evidenceRef, summary }) =>
        addFollowUpEvidence.mutate({ alertId, evidenceRef, summary })
      }
      onAssign={({ alertId, assigneeId }) =>
        assignAlert.mutate({ alertId, assigneeId })
      }
      onDrillBack={() =>
        setDrillHistory((history) =>
          history.length > 1 ? history.slice(0, -1) : history,
        )
      }
      onDrillClose={() => {
        setSelectedMetric(null);
        setDrillHistory([{ depth: 1 }]);
      }}
      onInspectMetric={inspectMetric}
      onRecordDecision={({ alertId, disposition, rationale }) =>
        recordDecision.mutate({
          alertId,
          disposition: disposition as M41aDecisionDisposition,
          rationale,
        })
      }
      onRefreshAlerts={() => void alertsQuery.refetch()}
      onRefreshDashboard={() => void refreshGovernedState()}
      onResetEvaluation={() => resetEvaluation.mutate()}
      onResolve={({ alertId }) => resolveAlert.mutate({ alertId })}
      onRetryDrilldown={() => void drilldownQuery.refetch()}
      onScopeChange={changeScope}
      onSelectDrillNode={selectDrillNode}
      scopeId={scope}
      selectedMetricId={selectedMetric?.id ?? null}
    />
  );
}

export default M41aDecisionIntelligencePage;
