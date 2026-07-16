import {
  M41B_ENVIRONMENT_LABEL,
  type M41bAuditEvent,
  type M41bCompletionEvidence,
  type M41bGovernedSource,
  type M41bGuidanceResponse,
  type M41bGuidanceRequest,
  type M41bHumanDecision,
  type M41bRecommendation,
  type M41bWorkplan,
} from "@contracts/m41b";
import {
  AlertTriangle,
  Bot,
  CalendarRange,
  FileWarning,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { M41bAskAmosPanel } from "./m41b-ask-amos-panel";
import {
  allWorkplanItems,
  buildM41bLineages,
  firstWorkplanItemId,
  formatTimestamp,
  prettyToken,
  type M41bDispositionSubmission,
  type M41bGuidanceSubmission,
  type M41bQueryState,
} from "./m41b-experience-model";
import { M41bLineagePanel } from "./m41b-lineage-panel";
import { M41bRoleContextCard } from "./m41b-role-context-card";
import { M41bWorkplanPanel } from "./m41b-workplan-panel";

export interface M41bIntelligenceAssistantViewProps {
  state: M41bQueryState;
  errorMessage?: string;
  workplan: M41bWorkplan | null;
  sources: readonly M41bGovernedSource[];
  requests: readonly M41bGuidanceRequest[];
  activeGuidance: M41bGuidanceResponse | null;
  guidanceHistory: readonly M41bGuidanceResponse[];
  recommendations: readonly M41bRecommendation[];
  decisions: readonly M41bHumanDecision[];
  completionEvidence: readonly M41bCompletionEvidence[];
  auditEvents: readonly M41bAuditEvent[];
  isRefreshing: boolean;
  isSubmittingGuidance: boolean;
  isSubmittingDisposition: boolean;
  mutatingTaskId?: string | null;
  onRefresh: () => void;
  onAsk: (submission: M41bGuidanceSubmission) => void;
  onAddEvidence?: (taskId: string, summary: string) => void;
  onCompleteTask?: (taskId: string) => void;
  onDisposition?: (submission: M41bDispositionSubmission) => void;
  onEscalateTask?: (taskId: string) => void;
  onRouteSupervisor?: (response: M41bGuidanceResponse) => void;
}

function LoadingState() {
  return (
    <div
      className="space-y-4 p-4 md:p-6"
      aria-label="Loading governed workplan"
    >
      <div className="h-44 animate-pulse rounded-2xl bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <div className="h-[520px] animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-[520px] animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry: () => void;
}) {
  return (
    <div className="p-4 md:p-6">
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto size-8 text-rose-700"
        />
        <h1 className="mt-3 text-lg font-bold text-rose-950">
          Governed workplan unavailable
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-rose-800">
          {message ??
            "The server did not return an authoritative M4.1B workplan. No priorities, approvals, or source facts were inferred."}
        </p>
        <Button
          className="mt-4"
          onClick={onRetry}
          type="button"
          variant="outline"
        >
          <RefreshCw aria-hidden="true" className="size-4" />
          Retry governed query
        </Button>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Bot;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-200">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 text-xl font-bold text-white">{value}</p>
    </div>
  );
}

function Workspace({
  props,
  workplan,
}: {
  props: M41bIntelligenceAssistantViewProps;
  workplan: M41bWorkplan;
}) {
  const [requestedItemId, setRequestedItemId] = useState<string | null>(() =>
    firstWorkplanItemId(workplan),
  );
  const items = allWorkplanItems(workplan);
  const selectedItem =
    items.find((item) => item.id === requestedItemId) ?? items[0] ?? null;
  const lineages = useMemo(
    () =>
      buildM41bLineages({
        workplan,
        sources: props.sources,
        requests: props.requests,
        guidance: props.guidanceHistory,
        recommendations: props.recommendations,
        decisions: props.decisions,
        completionEvidence: props.completionEvidence,
        auditEvents: props.auditEvents,
      }),
    [
      workplan,
      props.sources,
      props.requests,
      props.guidanceHistory,
      props.recommendations,
      props.decisions,
      props.completionEvidence,
      props.auditEvents,
    ],
  );
  const approvalCount = items.filter(
    (item) => item.humanApprovalRequired && !item.approvalId,
  ).length;
  const evidencePendingCount = items.filter(
    (item) => item.status === "evidence_pending",
  ).length;
  const sourceIssueCount = props.sources.filter(
    (source) => source.state !== "current",
  ).length;
  const mayDispositionActiveGuidance = Boolean(
    props.activeGuidance?.humanGate.accountableRoles.includes(
      workplan.roleContext.role,
    ),
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="overflow-hidden rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 text-white shadow-sm">
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className="border-white/20 bg-white/10 text-white"
                  variant="outline"
                >
                  M4.1B
                </Badge>
                <Badge
                  className="border-rose-300/30 bg-rose-300/10 text-rose-100"
                  variant="outline"
                >
                  <LockKeyhole aria-hidden="true" className="mr-1 size-3" />
                  Production actions blocked
                </Badge>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
                Executive Intelligence Assistant &amp; Workplan Orchestration
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                One permission-aware workplan across daily, weekly, monthly,
                quarterly, and annual commitments, with sourced Ask AMOS
                guidance and accountable human control.
              </p>
              <p className="mt-3 text-xs text-slate-400">
                {prettyToken(workplan.roleContext.role)} ·{" "}
                {prettyToken(workplan.roleContext.division)} · generated{" "}
                {formatTimestamp(workplan.generatedAt)}
              </p>
            </div>
            <Button
              className="border-white/20 bg-white/10 text-white hover:bg-white/20"
              disabled={props.isRefreshing}
              onClick={props.onRefresh}
              size="sm"
              type="button"
              variant="outline"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn("size-4", props.isRefreshing && "animate-spin")}
              />
              Refresh governed state
            </Button>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat
              icon={CalendarRange}
              label="Workplan items"
              value={items.length}
            />
            <Stat
              icon={UserRoundCog}
              label="Human gates pending"
              value={approvalCount}
            />
            <Stat
              icon={FileWarning}
              label="Evidence pending"
              value={evidencePendingCount}
            />
            <Stat
              icon={ShieldCheck}
              label="Source issues"
              value={sourceIssueCount}
            />
          </div>
        </div>
      </header>

      <M41bRoleContextCard context={workplan.roleContext} />

      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.7fr)_minmax(380px,0.8fr)]">
        <M41bWorkplanPanel
          mutatingTaskId={props.mutatingTaskId}
          onAddEvidence={props.onAddEvidence}
          onCompleteTask={props.onCompleteTask}
          onEscalateTask={props.onEscalateTask}
          onSelectItem={setRequestedItemId}
          selectedItemId={selectedItem?.id ?? null}
          sources={props.sources}
          workplan={workplan}
        />
        <M41bAskAmosPanel
          isSubmittingDisposition={props.isSubmittingDisposition}
          isSubmittingGuidance={props.isSubmittingGuidance}
          onAsk={props.onAsk}
          onDisposition={
            mayDispositionActiveGuidance ? props.onDisposition : undefined
          }
          onRouteSupervisor={props.onRouteSupervisor}
          response={props.activeGuidance}
          selectedItem={selectedItem}
        />
      </div>

      <M41bLineagePanel lineages={lineages} />
    </div>
  );
}

export function M41bIntelligenceAssistantView(
  props: M41bIntelligenceAssistantViewProps,
) {
  return (
    <div className="min-h-full bg-slate-50/40">
      <div
        aria-label="Synthetic environment boundary"
        className="sticky top-0 z-50 flex min-h-10 items-center justify-center gap-2 border-b border-amber-400 bg-amber-300 px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.14em] text-slate-950 shadow-sm"
        role="status"
      >
        <Sparkles aria-hidden="true" className="size-4 shrink-0" />
        {M41B_ENVIRONMENT_LABEL}
      </div>
      {props.state === "loading" ? <LoadingState /> : null}
      {props.state === "error" ? (
        <ErrorState message={props.errorMessage} onRetry={props.onRefresh} />
      ) : null}
      {props.state === "ready" && props.workplan ? (
        <Workspace props={props} workplan={props.workplan} />
      ) : null}
      {props.state === "ready" && !props.workplan ? (
        <ErrorState
          message="The query completed without an authoritative workplan payload. No fallback workplan was created."
          onRetry={props.onRefresh}
        />
      ) : null}
      {props.isRefreshing && props.state === "ready" ? (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-full border bg-white px-3 py-2 text-xs shadow-lg">
          <Loader2
            aria-hidden="true"
            className="size-3.5 animate-spin text-teal-700"
          />
          Refreshing governed state
        </div>
      ) : null}
    </div>
  );
}

export default M41bIntelligenceAssistantView;
