import {
  AlertTriangle,
  BarChart3,
  Building2,
  DatabaseZap,
  EyeOff,
  Gauge,
  Layers3,
  Loader2,
  LockKeyhole,
  RefreshCw,
  RotateCcw,
  Route,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  M41aAlertsPanel,
  type M41aAlertActionPayloads,
} from "./m41a-alerts-panel";
import { M41aDrilldownPanel } from "./m41a-drilldown-panel";
import { M41aMetricCard } from "./m41a-metric-card";
import {
  M41A_SCOPES,
  formatTimestamp,
  getScopeDefinition,
  groupMetricsByCategory,
  metricAttentionCount,
  metricQualityIssueCount,
  prettyToken,
  type M41aAlertView,
  type M41aDashboardView,
  type M41aDrillNodeView,
  type M41aDrilldownView,
  type M41aMetricView,
  type M41aQueryState,
  type M41aScopeId,
} from "./m41a-model";

export type M41aWorkspaceTab = "dashboard" | "drilldown" | "alerts";

interface M41aDecisionIntelligenceViewProps {
  scopeId: M41aScopeId;
  dashboard: M41aDashboardView;
  dashboardState: M41aQueryState;
  dashboardError?: string;
  isDashboardFetching: boolean;
  alerts: readonly M41aAlertView[];
  alertsState: M41aQueryState;
  alertsError?: string;
  isAlertsFetching: boolean;
  drilldown: M41aDrilldownView | null;
  drilldownState: M41aQueryState;
  drilldownError?: string;
  isDrilldownFetching: boolean;
  selectedMetricId: string | null;
  isMutating: boolean;
  decisionDispositions: readonly string[];
  onScopeChange: (scope: M41aScopeId) => void;
  onInspectMetric: (metric: M41aMetricView) => void;
  onSelectDrillNode: (node: M41aDrillNodeView) => void;
  onDrillBack: () => void;
  onDrillClose: () => void;
  onRefreshDashboard: () => void;
  onRefreshAlerts: () => void;
  onRetryDrilldown: () => void;
  onResetEvaluation: () => void;
  onAcknowledge: (payload: M41aAlertActionPayloads["acknowledge"]) => void;
  onAssign: (payload: M41aAlertActionPayloads["assign"]) => void;
  onRecordDecision: (
    payload: M41aAlertActionPayloads["recordDecision"],
  ) => void;
  onAddEvidence: (payload: M41aAlertActionPayloads["addEvidence"]) => void;
  onResolve: (payload: M41aAlertActionPayloads["resolve"]) => void;
}

function ScopeSelector({
  scopeId,
  onScopeChange,
  authorizedScopes,
}: {
  scopeId: M41aScopeId;
  onScopeChange: (scope: M41aScopeId) => void;
  authorizedScopes: readonly M41aScopeId[];
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" aria-label="Decision intelligence scope">
      {M41A_SCOPES.map((scope) => {
        const active = scope.id === scopeId;
        const authorized = authorizedScopes.includes(scope.id);
        return (
          <button
            key={scope.id}
            aria-pressed={active}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-left transition-all",
              active
                ? "border-teal-400 bg-teal-400/15 text-white ring-1 ring-teal-300/40"
                : "border-white/10 bg-white/5 text-slate-300 hover:border-white/20 hover:bg-white/10",
              !authorized && "cursor-not-allowed opacity-50",
            )}
            disabled={!authorized}
            onClick={() => onScopeChange(scope.id)}
            type="button"
          >
            <span className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold">{scope.shortLabel}</span>
              {authorized ? (
                <ShieldCheck aria-hidden="true" className="size-3.5 text-teal-300" />
              ) : (
                <LockKeyhole aria-hidden="true" className="size-3.5" />
              )}
            </span>
            <span className="mt-1 block text-[10px] leading-4 opacity-80">
              {scope.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <div key={index} className="h-[390px] animate-pulse rounded-xl border bg-slate-100" />
      ))}
    </div>
  );
}

function StageCensus({ dashboard }: { dashboard: M41aDashboardView }) {
  if (dashboard.stageCensus.length === 0) return null;
  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Building2 aria-hidden="true" className="size-4 text-teal-700" />
              Three-stage census
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Governed aggregate capacity; supporting record identifiers remain source-linked.
            </CardDescription>
          </div>
          <Badge variant="outline">{dashboard.stageCensus.length} stages</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 px-5 md:grid-cols-3">
        {dashboard.stageCensus.map((stage) => {
          const percent =
            stage.capacity > 0 ? Math.round((stage.census / stage.capacity) * 100) : 0;
          return (
            <div key={stage.id} className="rounded-xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-slate-800">{stage.label}</p>
                <span className="text-[10px] font-semibold text-slate-500">{percent}%</span>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-950">
                {stage.census}
                <span className="ml-1 text-xs font-medium text-slate-500">
                  / {stage.capacity}
                </span>
              </p>
              <Progress className="mt-3 h-1.5" value={Math.min(percent, 100)} />
              <p className="mt-2 text-[10px] text-slate-500">
                {stage.sourceRecordIds.length} source record{stage.sourceRecordIds.length === 1 ? "" : "s"}
              </p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function AccessBanner({ dashboard }: { dashboard: M41aDashboardView }) {
  return (
    <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-xs text-sky-950">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-sky-700" />
        <div>
          <p className="font-semibold">Server-authorized scope projection</p>
          <p className="mt-1 leading-5 text-sky-800">
            Role {prettyToken(dashboard.access.actorRole)} · {dashboard.access.authorizedScopes.length} authorized scope{dashboard.access.authorizedScopes.length === 1 ? "" : "s"} · aggregate finance {dashboard.access.aggregateFinanceVisible ? "visible" : "suppressed"}.
          </p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700">
        <EyeOff aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-slate-500" />
        <div>
          <p className="font-semibold">Sensitive detail policy</p>
          <p className="mt-1 leading-5 text-slate-600">
            {dashboard.access.suppressedSensitivity.length > 0
              ? dashboard.access.suppressedSensitivity.map(prettyToken).join(", ")
              : "No additional classes suppressed at this scope"}
          </p>
        </div>
      </div>
    </div>
  );
}

function DashboardOverview({
  dashboard,
  state,
  errorMessage,
  isFetching,
  selectedMetricId,
  onInspectMetric,
  onRetry,
}: {
  dashboard: M41aDashboardView;
  state: M41aQueryState;
  errorMessage?: string;
  isFetching: boolean;
  selectedMetricId: string | null;
  onInspectMetric: (metric: M41aMetricView) => void;
  onRetry: () => void;
}) {
  if (state === "loading") return <DashboardLoading />;
  if (state === "error") {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertTriangle aria-hidden="true" className="mx-auto size-7 text-rose-700" />
        <p className="mt-3 text-sm font-semibold text-rose-950">Dashboard could not be loaded</p>
        <p className="mt-1 text-xs text-rose-700">
          {errorMessage ?? "No values were inferred or replaced."}
        </p>
        <Button className="mt-4" onClick={onRetry} size="sm" variant="outline">
          Retry governed query
        </Button>
      </div>
    );
  }

  const groups = groupMetricsByCategory(dashboard.metrics);
  return (
    <div className="space-y-6">
      <AccessBanner dashboard={dashboard} />
      <StageCensus dashboard={dashboard} />
      {groups.length > 0 ? (
        groups.map((group) => (
          <section key={group.category}>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-700">Metric domain</p>
                <h2 className="mt-1 text-base font-bold text-slate-900">{group.category}</h2>
              </div>
              <span className="text-[10px] text-slate-500">
                {group.metrics.length} governed metric{group.metrics.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {group.metrics.map((metric) => (
                <M41aMetricCard
                  key={metric.id}
                  metric={metric}
                  onInspect={onInspectMetric}
                  selected={selectedMetricId === metric.id}
                />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="rounded-xl border border-dashed bg-slate-50 p-8 text-center">
          <DatabaseZap aria-hidden="true" className="mx-auto size-7 text-slate-400" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No authorized metrics returned</p>
          <p className="mt-1 text-xs text-slate-500">The dashboard does not invent values when source evidence is unavailable.</p>
        </div>
      )}
      {isFetching ? (
        <div className="fixed bottom-5 right-5 flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs shadow-lg">
          <Loader2 aria-hidden="true" className="size-3.5 animate-spin text-teal-700" />
          Refreshing scope
        </div>
      ) : null}
    </div>
  );
}

export function M41aDecisionIntelligenceView(
  props: M41aDecisionIntelligenceViewProps,
) {
  const [activeTab, setActiveTab] = useState<M41aWorkspaceTab>("dashboard");
  const scope = getScopeDefinition(props.scopeId);
  const attention = metricAttentionCount(props.dashboard.metrics);
  const qualityIssues = metricQualityIssueCount(props.dashboard.metrics);

  const inspectMetric = (metric: M41aMetricView) => {
    props.onInspectMetric(metric);
    setActiveTab("drilldown");
  };

  const changeScope = (nextScope: M41aScopeId) => {
    props.onScopeChange(nextScope);
    setActiveTab("dashboard");
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <section className="overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white shadow-sm">
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge className="border-0 bg-amber-300 text-slate-950 hover:bg-amber-300">
                  {props.dashboard.environmentLabel}
                </Badge>
                <Badge className="border-white/20 bg-white/10 text-white" variant="outline">
                  M4.1A
                </Badge>
              </div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                Executive Decision Intelligence
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                Governed enterprise and division metrics with source transparency, measured drill-down, threshold alerts, and accountable human decisions.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                className="border-white/20 bg-white/10 text-white hover:bg-white/20"
                disabled={props.isDashboardFetching || props.isMutating}
                onClick={props.onRefreshDashboard}
                size="sm"
                variant="outline"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn("size-4", props.isDashboardFetching && "animate-spin")}
                />
                Refresh
              </Button>
              <Button
                className="border-amber-300/30 bg-amber-300/10 text-amber-100 hover:bg-amber-300/20"
                disabled={
                  !props.dashboard.access.authorizedScopes.includes(
                    "ENTERPRISE",
                  ) ||
                  props.isMutating
                }
                onClick={props.onResetEvaluation}
                size="sm"
                variant="outline"
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                Reset evaluation
              </Button>
            </div>
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Authorized dashboard scope
            </p>
            <ScopeSelector
              authorizedScopes={props.dashboard.access.authorizedScopes}
              onScopeChange={changeScope}
              scopeId={props.scopeId}
            />
          </div>
        </div>

        <div className="grid border-t border-white/10 bg-black/15 sm:grid-cols-2 lg:grid-cols-5">
          <div className="border-b border-white/10 px-5 py-4 sm:border-r lg:border-b-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Active scope</p>
            <p className="mt-1 text-sm font-bold">{scope.label}</p>
          </div>
          <div className="border-b border-white/10 px-5 py-4 lg:border-b-0 lg:border-r">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Metrics</p>
            <p className="mt-1 text-sm font-bold">{props.dashboard.metrics.length}</p>
          </div>
          <div className="border-b border-white/10 px-5 py-4 sm:border-r lg:border-b-0">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Off target</p>
            <p className="mt-1 text-sm font-bold">{attention}</p>
          </div>
          <div className="border-b border-white/10 px-5 py-4 lg:border-b-0 lg:border-r">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">Quality exceptions</p>
            <p className="mt-1 text-sm font-bold">{qualityIssues}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">As of</p>
            <p className="mt-1 text-xs font-semibold">{formatTimestamp(props.dashboard.asOf)}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white px-4 py-3 shadow-sm">
        <div>
          <p className="text-sm font-bold text-slate-900">{props.dashboard.scopeLabel}</p>
          <p className="mt-0.5 text-xs text-slate-500">{props.dashboard.scopeDescription}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[10px]">
          <span className="rounded-full border bg-slate-50 px-2.5 py-1 text-slate-600">
            Period {props.dashboard.periodStart ?? "—"} to {props.dashboard.periodEnd ?? "—"}
          </span>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">
            {props.dashboard.evidenceLabel}
          </span>
        </div>
      </div>

      <Tabs onValueChange={(value) => setActiveTab(value as M41aWorkspaceTab)} value={activeTab}>
        <TabsList className="h-auto w-full justify-start overflow-x-auto border bg-white p-1 shadow-sm">
          <TabsTrigger className="min-w-36" value="dashboard">
            <BarChart3 aria-hidden="true" className="size-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger className="min-w-36" value="drilldown">
            <Route aria-hidden="true" className="size-4" />
            Metric drill-down
          </TabsTrigger>
          <TabsTrigger className="min-w-36" value="alerts">
            <AlertTriangle aria-hidden="true" className="size-4" />
            Alerts
            {props.dashboard.openAlertCount > 0 ? (
              <span className="ml-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                {props.dashboard.openAlertCount}
              </span>
            ) : null}
          </TabsTrigger>
        </TabsList>

        <TabsContent className="mt-4" value="dashboard">
          <DashboardOverview
            dashboard={props.dashboard}
            errorMessage={props.dashboardError}
            isFetching={props.isDashboardFetching}
            onInspectMetric={inspectMetric}
            onRetry={props.onRefreshDashboard}
            selectedMetricId={props.selectedMetricId}
            state={props.dashboardState}
          />
        </TabsContent>

        <TabsContent className="mt-4" value="drilldown">
          {props.selectedMetricId ? (
            <M41aDrilldownPanel
              drilldown={props.drilldown}
              errorMessage={props.drilldownError}
              isFetching={props.isDrilldownFetching}
              onBack={props.onDrillBack}
              onClose={() => {
                props.onDrillClose();
                setActiveTab("dashboard");
              }}
              onRetry={props.onRetryDrilldown}
              onSelectNode={props.onSelectDrillNode}
              queryState={props.drilldownState}
            />
          ) : (
            <div className="flex min-h-72 items-center justify-center rounded-xl border border-dashed bg-slate-50 p-6 text-center">
              <div className="max-w-md">
                <Layers3 aria-hidden="true" className="mx-auto size-8 text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">Select a governed metric</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Begin on the dashboard. The metric card is measured as step one, then the server returns only authorized supporting detail.
                </p>
                <Button className="mt-4" onClick={() => setActiveTab("dashboard")} size="sm">
                  <Gauge aria-hidden="true" className="size-4" />
                  View metrics
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent className="mt-4" value="alerts">
          <M41aAlertsPanel
            alerts={props.alerts}
            decisionDispositions={props.decisionDispositions}
            errorMessage={props.alertsError}
            isFetching={props.isAlertsFetching}
            isMutating={props.isMutating}
            onAcknowledge={props.onAcknowledge}
            onAddEvidence={props.onAddEvidence}
            onAssign={props.onAssign}
            onRecordDecision={props.onRecordDecision}
            onRefresh={props.onRefreshAlerts}
            onResolve={props.onResolve}
            queryState={props.alertsState}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
