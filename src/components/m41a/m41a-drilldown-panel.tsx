import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Database,
  EyeOff,
  FileSearch,
  Link2,
  Loader2,
  Route,
  ShieldCheck,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  type M41aDrillNodeView,
  type M41aDrilldownView,
  type M41aQueryState,
} from "./m41a-model";
import { M41aStatusPill } from "./m41a-status-pill";

function StepRail({
  current,
  max,
}: {
  current: number;
  max: number;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" aria-label={`Drill-down step ${current} of ${max}`}>
      {[1, 2, 3].map((step) => {
        const complete = step < current;
        const active = step === current;
        return (
          <div key={step} className="flex items-center gap-2">
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                complete && "border-emerald-600 bg-emerald-600 text-white",
                active && "border-teal-700 bg-teal-50 text-teal-800",
                !complete && !active && "border-slate-200 bg-white text-slate-400",
              )}
            >
              {complete ? <Check aria-hidden="true" className="size-3.5" /> : step}
            </span>
            {step < 3 ? (
              <span
                className={cn(
                  "h-0.5 w-full rounded",
                  step < current ? "bg-emerald-500" : "bg-slate-200",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function DrillNode({
  node,
  currentStep,
  maxSteps,
  onSelect,
}: {
  node: M41aDrillNodeView;
  currentStep: number;
  maxSteps: number;
  onSelect: (node: M41aDrillNodeView) => void;
}) {
  const canContinue =
    node.authorized && !node.suppressed && node.hasChildren && currentStep < maxSteps;

  return (
    <article
      className={cn(
        "rounded-xl border p-4",
        node.suppressed ? "border-slate-200 bg-slate-100" : "bg-white",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {node.suppressed ? (
              <EyeOff aria-hidden="true" className="size-4 text-slate-500" />
            ) : (
              <Database aria-hidden="true" className="size-4 text-teal-700" />
            )}
            <h4 className="text-sm font-semibold text-slate-900">{node.label}</h4>
          </div>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            {node.description}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-950">{node.valueLabel}</p>
          <M41aStatusPill className="mt-1" value={node.dataQualityState} />
        </div>
      </div>

      <dl className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-[11px] sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-500">Source</dt>
          <dd className="mt-0.5 break-words text-slate-700">{node.sourceLabel}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-500">Supporting record</dt>
          <dd className="mt-0.5 break-all font-mono text-slate-700">
            {node.sourceRecordId ?? "Aggregate only"}
          </dd>
        </div>
      </dl>

      {node.suppressed ? (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-slate-300 bg-white p-3 text-[11px] leading-4 text-slate-600">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-slate-500" />
          <span>
            {node.suppressionReason ??
              "Supporting detail is suppressed for the authenticated role and division."}
          </span>
        </div>
      ) : null}

      {canContinue ? (
        <Button
          className="mt-3 w-full justify-between"
          onClick={() => onSelect(node)}
          size="sm"
          variant="outline"
        >
          <span>Open supporting detail</span>
          <span className="flex items-center gap-1 text-[10px]">
            Step {Math.min(currentStep + 1, maxSteps)} of {maxSteps}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </span>
        </Button>
      ) : null}
    </article>
  );
}

export function M41aDrilldownPanel({
  drilldown,
  queryState,
  isFetching,
  errorMessage,
  onSelectNode,
  onBack,
  onRetry,
  onClose,
}: {
  drilldown: M41aDrilldownView | null;
  queryState: M41aQueryState;
  isFetching: boolean;
  errorMessage?: string;
  onSelectNode: (node: M41aDrillNodeView) => void;
  onBack: () => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  const currentStep = Math.min(
    Math.max(drilldown?.measuredSteps ?? 2, 1),
    drilldown?.maxDepth ?? 3,
  );
  const maxSteps = drilldown?.maxDepth ?? 3;

  return (
    <Card className="gap-0 overflow-hidden py-0 shadow-lg">
      <CardHeader className="border-b bg-slate-950 px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-teal-200">
              <Route aria-hidden="true" className="size-4" />
              Measured accountable drill-down
            </div>
            <CardTitle className="text-base text-white">
              {drilldown?.metricLabel ?? "Governed metric detail"}
            </CardTitle>
            <CardDescription className="mt-1 text-xs text-slate-300">
              Enterprise metric to authorized supporting evidence in no more than three steps.
            </CardDescription>
          </div>
          <Button
            aria-label="Close drill-down"
            className="text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={onClose}
            size="icon"
            variant="ghost"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
          <StepRail current={currentStep} max={maxSteps} />
          <div className="mt-3 flex flex-wrap items-center gap-1 text-[10px] text-slate-300">
            {(drilldown?.breadcrumb ?? []).map((crumb, index) => (
              <span key={`${crumb.depth}-${crumb.id}`} className="flex items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3" /> : null}
                <span>{crumb.label}</span>
              </span>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-5">
        {queryState === "loading" ? (
          <div className="flex min-h-56 items-center justify-center rounded-xl border border-dashed">
            <div className="text-center">
              <Loader2 aria-hidden="true" className="mx-auto size-6 animate-spin text-teal-700" />
              <p className="mt-2 text-sm font-semibold text-slate-700">
                Loading authorized detail
              </p>
              <p className="text-xs text-slate-500">Scope and disclosure rules are applied server-side.</p>
            </div>
          </div>
        ) : queryState === "error" ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-center">
            <p className="text-sm font-semibold text-rose-900">Detail could not be loaded.</p>
            <p className="mt-1 text-xs text-rose-700">
              {errorMessage ?? "The source remained unchanged. Retry the governed query."}
            </p>
            <Button className="mt-3" onClick={onRetry} size="sm" variant="outline">
              Retry
            </Button>
          </div>
        ) : drilldown && drilldown.nodes.length > 0 ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-100 bg-teal-50 px-3 py-2 text-[11px] text-teal-900">
              <span className="flex items-center gap-1.5 font-semibold">
                <Link2 aria-hidden="true" className="size-3.5" />
                {drilldown.lineageLabel}
              </span>
              <span>
                Step {currentStep} of {maxSteps} · {drilldown.nodes.length} authorized result{drilldown.nodes.length === 1 ? "" : "s"}
              </span>
            </div>
            {drilldown.nodes.map((node) => (
              <DrillNode
                key={node.id}
                currentStep={currentStep}
                maxSteps={maxSteps}
                node={node}
                onSelect={onSelectNode}
              />
            ))}
            {drilldown.terminal ? (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900">
                <FileSearch aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                <div>
                  <p className="font-semibold">Authorized supporting detail reached</p>
                  <p className="mt-1 leading-5">
                    The drill path completed in {currentStep} measured step{currentStep === 1 ? "" : "s"}; displayed records retain source and quality state.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-xl border border-dashed bg-slate-50 text-center">
            <div className="max-w-sm p-5">
              <FileSearch aria-hidden="true" className="mx-auto size-6 text-slate-400" />
              <p className="mt-2 text-sm font-semibold text-slate-700">No authorized detail returned</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                The metric remains visible, but the current role has no supporting rows at this scope.
              </p>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <Button
            disabled={!drilldown || drilldown.depth <= 1 || isFetching}
            onClick={onBack}
            size="sm"
            variant="ghost"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            Previous level
          </Button>
          {isFetching && queryState === "ready" ? (
            <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <Loader2 aria-hidden="true" className="size-3 animate-spin" />
              Refreshing governed detail
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
