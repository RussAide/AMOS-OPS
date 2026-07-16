import {
  M41C_ENVIRONMENT_LABEL,
  type M41cClinicalGuidanceResponse,
  type M41cClinicalWorkplan,
  type M41cExperienceComponentStatus,
  type M41cExperienceSnapshot,
  type M41cSyntheticScenarioRunResponse,
} from "@contracts/m41c";
import {
  Activity,
  AlertTriangle,
  Ban,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  DatabaseZap,
  FileCheck2,
  FlaskConical,
  LibraryBig,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Route,
  Scale,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatM41cTimestamp,
  prettyM41cToken,
  snapshotMetrics,
  type M41cGuidanceSubmission,
  type M41cQueryState,
} from "./m41c-experience-model";
import { M41cGovernanceProfilesPanel } from "./m41c-governance-profiles-panel";
import { M41cPathwaySafetyPanel } from "./m41c-pathway-safety-panel";
import { M41cScenarioLab } from "./m41c-scenario-lab";
import { M41cSourceRegistryPanel } from "./m41c-source-registry-panel";
import { M41cWorkplanAssistantPanel } from "./m41c-workplan-assistant-panel";

export interface M41cClinicalIntelligenceViewProps {
  state: M41cQueryState;
  errorMessage?: string;
  snapshot: M41cExperienceSnapshot | null;
  workplan: M41cClinicalWorkplan | null;
  guidance: M41cClinicalGuidanceResponse | null;
  scenarioResult: M41cSyntheticScenarioRunResponse | null;
  isRefreshing: boolean;
  isSubmittingGuidance: boolean;
  isRunningScenario: boolean;
  onRefresh: () => void;
  onAsk: (submission: M41cGuidanceSubmission) => void;
  onRunScenario: (scenarioId: string) => void;
}

function LoadingState() {
  return (
    <div
      aria-label="Loading Clinical Intelligence Fabric"
      className="space-y-5 p-4 md:p-6"
    >
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
      <div className="grid gap-4 xl:grid-cols-2">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100" />
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
      <div className="mx-auto max-w-3xl rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertTriangle
          aria-hidden="true"
          className="mx-auto size-9 text-rose-700"
        />
        <h1 className="mt-3 text-lg font-bold text-rose-950">
          Clinical Intelligence Fabric unavailable
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-rose-800">
          {message ??
            "The server did not return the governed M4.1C experience. No clinical sources, pathways, or guidance were inferred locally."}
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

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
      <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.13em] text-teal-200">
        <Icon aria-hidden="true" className="size-3.5" />
        {label}
      </p>
      <p className="mt-1 text-2xl font-black text-white">{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-300">{detail}</p>
    </div>
  );
}

function statusPresentation(status: M41cExperienceComponentStatus["status"]): {
  icon: typeof CheckCircle2;
  className: string;
} {
  if (status === "complete")
    return {
      icon: CheckCircle2,
      className: "border-emerald-200 bg-emerald-50 text-emerald-900",
    };
  if (status === "quarantined")
    return { icon: Ban, className: "border-rose-200 bg-rose-50 text-rose-900" };
  return {
    icon: LockKeyhole,
    className: "border-amber-200 bg-amber-50 text-amber-950",
  };
}

function ComponentControls({
  components,
}: {
  components: readonly M41cExperienceComponentStatus[];
}) {
  const complete = components.filter(
    (component) => component.status === "complete",
  ).length;
  return (
    <section aria-labelledby="m41c-controls-title" id="controls">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2
              className="flex items-center gap-2 text-base font-bold text-slate-950"
              id="m41c-controls-title"
            >
              <ClipboardCheck
                aria-hidden="true"
                className="size-4 text-teal-700"
              />
              M4.1C experience control map
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              A component may be built while its clinical authority remains
              deliberately blocked or quarantined.
            </p>
          </div>
          <Badge
            className="border-teal-200 bg-teal-50 text-teal-800"
            variant="outline"
          >
            {complete}/{components.length} complete
          </Badge>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {components.map((component) => {
            const presentation = statusPresentation(component.status);
            const Icon = presentation.icon;
            return (
              <details
                className={`rounded-xl border p-3 text-xs ${presentation.className}`}
                key={component.criterionId}
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-start gap-2">
                    <Icon
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0"
                    />
                    <div>
                      <p className="font-bold">
                        {component.criterionId} · {component.title}
                      </p>
                      <p className="mt-0.5 opacity-80">
                        {prettyM41cToken(component.status)}
                      </p>
                    </div>
                  </div>
                </summary>
                <p className="mt-2 border-t border-current/15 pt-2 leading-5">
                  {component.summary}
                </p>
                <p className="mt-2 opacity-75">
                  {component.evidenceIds.length} evidence reference(s)
                </p>
              </details>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function QuickNav() {
  const links = [
    { href: "#governance", label: "Governance", icon: Scale },
    { href: "#sources", label: "Knowledge", icon: LibraryBig },
    { href: "#pathways", label: "Pathways", icon: Route },
    { href: "#safety", label: "Safety", icon: Stethoscope },
    { href: "#workplan", label: "Workplan & AMOS", icon: Bot },
    { href: "#scenarios", label: "Scenario lab", icon: FlaskConical },
  ] as const;
  return (
    <nav
      aria-label="Clinical Intelligence Fabric sections"
      className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 shadow-sm"
    >
      <div className="flex min-w-max gap-1">
        {links.map(({ href, icon: Icon, label }) => (
          <a
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-teal-50 hover:text-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            {label}
          </a>
        ))}
      </div>
    </nav>
  );
}

function Workspace({
  props,
  snapshot,
  workplan,
}: {
  props: M41cClinicalIntelligenceViewProps;
  snapshot: M41cExperienceSnapshot;
  workplan: M41cClinicalWorkplan;
}) {
  const metrics = snapshotMetrics(snapshot);
  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="overflow-hidden rounded-3xl border border-slate-800 bg-[radial-gradient(circle_at_top_right,_rgba(13,148,136,0.42),_transparent_42%),linear-gradient(135deg,#020617,#0f172a_52%,#134e4a)] text-white shadow-xl">
        <div className="p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-4xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  className="border-white/20 bg-white/10 text-white"
                  variant="outline"
                >
                  M4.1C
                </Badge>
                <Badge
                  className="border-teal-300/30 bg-teal-300/10 text-teal-100"
                  variant="outline"
                >
                  <BrainCircuit aria-hidden="true" className="mr-1 size-3" />
                  Clinical intelligence fabric
                </Badge>
                <Badge
                  className="border-rose-300/30 bg-rose-300/10 text-rose-100"
                  variant="outline"
                >
                  <DatabaseZap aria-hidden="true" className="mr-1 size-3" />0
                  live writes · 0 production rows
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight md:text-4xl">
                Clinical Intelligence Fabric
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 md:text-base">
                A governed clinical experience connecting source authority,
                distinct instrument profiles, youth pathways, safety escalation,
                continuum lineage, workforce competency, five-cadence work, and
                Ask AMOS—without autonomous clinical action.
              </p>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                <span>{prettyM41cToken(workplan.role)}</span>
                <span>
                  Generated {formatM41cTimestamp(snapshot.generatedAt)}
                </span>
                <span>Evidence: {prettyM41cToken(snapshot.evidenceClass)}</span>
              </div>
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

          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
            <Metric
              detail={`${metrics.activeSources} current`}
              icon={LibraryBig}
              label="Sources"
              value={metrics.sources}
            />
            <Metric
              detail="TRR and DFPS remain distinct"
              icon={FileCheck2}
              label="Profiles"
              value={metrics.profiles}
            />
            <Metric
              detail={`${metrics.pathwayReady} demo approved`}
              icon={Route}
              label="Pathways"
              value={metrics.pathways}
            />
            <Metric
              detail="Named human attestations"
              icon={UsersRound}
              label="Signed validations"
              value={metrics.signedValidations}
            />
            <Metric
              detail="Invalid logic isolated"
              icon={Ban}
              label="Quarantines"
              value={metrics.quarantineCount}
            />
            <Metric
              detail="Monitoring needs review"
              icon={Activity}
              label="Actionable signals"
              value={metrics.actionableSignals}
            />
          </div>
        </div>
        <div className="grid gap-px border-t border-white/10 bg-white/10 md:grid-cols-3">
          <div className="flex items-start gap-2 bg-slate-950/50 p-4 text-xs leading-5 text-slate-300">
            <ShieldCheck
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-teal-300"
            />
            <p>
              <span className="font-bold text-white">
                Human accountability.
              </span>{" "}
              Council, competency, signed validation, and disposition gates
              remain visible.
            </p>
          </div>
          <div className="flex items-start gap-2 bg-slate-950/50 p-4 text-xs leading-5 text-slate-300">
            <LibraryBig
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-teal-300"
            />
            <p>
              <span className="font-bold text-white">Source transparency.</span>{" "}
              Version, owner, freshness, license, limits, uncertainty, and
              missing evidence travel with guidance.
            </p>
          </div>
          <div className="flex items-start gap-2 bg-slate-950/50 p-4 text-xs leading-5 text-slate-300">
            <LockKeyhole
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-rose-300"
            />
            <p>
              <span className="font-bold text-white">Safety boundary.</span> No
              diagnosis, prescribing, autonomous LOC, discharge, claims,
              disclosure, or CMBHS write.
            </p>
          </div>
        </div>
      </header>

      <QuickNav />
      <ComponentControls components={snapshot.components} />
      <M41cGovernanceProfilesPanel
        council={snapshot.council}
        instrumentRegistry={snapshot.instrumentRegistry}
        profileSeparation={snapshot.profileSeparation}
        signedValidationRecords={snapshot.signedValidationRecords}
      />
      <M41cSourceRegistryPanel registry={snapshot.registry} />
      <M41cPathwaySafetyPanel
        continuum={snapshot.continuum}
        mapping={snapshot.mapping}
        monitoring={snapshot.monitoring}
        pathways={snapshot.pathwayCatalog}
        youthPathwayPacks={snapshot.youthPathwayPacks}
      />
      <M41cWorkplanAssistantPanel
        competencyRegistry={snapshot.competencyRegistry}
        guidance={props.guidance}
        isSubmittingGuidance={props.isSubmittingGuidance}
        onAsk={props.onAsk}
        workplan={workplan}
      />
      <M41cScenarioLab
        isRunning={props.isRunningScenario}
        onRun={props.onRunScenario}
        result={props.scenarioResult}
        scenarios={snapshot.scenarioCatalog}
      />

      <footer className="rounded-2xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600">
        <p className="flex items-start gap-2">
          <Sparkles
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-teal-700"
          />
          <span>
            <strong className="text-slate-900">Evaluation boundary:</strong>{" "}
            {snapshot.environment.label}. All records, people, episodes,
            workplans, attestations, decisions, and outcomes shown here are
            synthetic.
          </span>
        </p>
      </footer>
    </div>
  );
}

export function M41cClinicalIntelligenceView(
  props: M41cClinicalIntelligenceViewProps,
) {
  return (
    <div className="min-h-full scroll-smooth bg-slate-50/60">
      <div
        aria-label="Synthetic clinical environment boundary"
        className="sticky top-0 z-50 flex min-h-11 items-center justify-center gap-2 border-b border-amber-500 bg-amber-300 px-4 py-2 text-center text-[11px] font-black uppercase tracking-[0.13em] text-slate-950 shadow-sm"
        role="status"
      >
        <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
        {M41C_ENVIRONMENT_LABEL}
      </div>
      {props.state === "loading" ? <LoadingState /> : null}
      {props.state === "error" ? (
        <ErrorState message={props.errorMessage} onRetry={props.onRefresh} />
      ) : null}
      {props.state === "ready" && props.snapshot && props.workplan ? (
        <Workspace
          props={props}
          snapshot={props.snapshot}
          workplan={props.workplan}
        />
      ) : null}
      {props.state === "ready" && (!props.snapshot || !props.workplan) ? (
        <ErrorState
          message="The query completed without the governed snapshot or five-cadence clinical workplan. No local fallback content was created."
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

export default M41cClinicalIntelligenceView;
