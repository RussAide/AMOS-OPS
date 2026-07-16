import type { ComponentType } from "react";
import {
  AlertCircle,
  ArrowRight,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  GitPullRequestArrow,
  HelpCircle,
  History,
  Home,
  LayoutGrid,
  ListChecks,
  LoaderCircle,
  LockKeyhole,
  Play,
  RefreshCw,
  Route,
  ShieldCheck,
  UserRoundCheck,
  Users,
  Workflow,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge-view";
import { Button } from "@/components/ui/button-view";
import {
  dx1AcceptanceCounts,
  dx1ExperienceCriteriaCounts,
  dx1ExperienceStream,
  type Dx1EnterpriseDemoSnapshot,
  type Dx1EnterpriseDemoViewState,
} from "./dx1-enterprise-demo-model";

const card =
  "rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50";
const eyebrow =
  "text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500";

export interface Dx1EnterpriseDemoViewProps {
  snapshot: Dx1EnterpriseDemoSnapshot | null;
  state: Dx1EnterpriseDemoViewState;
  errorMessage?: string;
  canRunVerification?: boolean;
  isRefreshing: boolean;
  isRunning: boolean;
  onRefresh: () => void;
  onRunVerification: () => void;
}

function Metric(props: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  detail: string;
}) {
  const Icon = props.icon;
  return (
    <article className={`${card} p-4`}>
      <div className="flex items-center justify-between gap-3">
        <p className={eyebrow}>{props.label}</p>
        <Icon aria-hidden="true" className="h-5 w-5 text-teal-700" />
      </div>
      <p className="mt-4 text-3xl font-semibold tracking-tight text-slate-950">
        {props.value}
      </p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{props.detail}</p>
    </article>
  );
}

function Boundary({ snapshot }: { snapshot: Dx1EnterpriseDemoSnapshot }) {
  return (
    <div
      className="border-b border-teal-800 bg-teal-950 px-5 py-3 text-xs text-teal-50"
      data-testid="dx1-synthetic-boundary"
      role="status"
    >
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-5 gap-y-2">
        <span className="inline-flex items-center gap-2 font-bold uppercase tracking-wider">
          <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          Synthetic cross-enterprise verification
        </span>
        <span>Production rows: {snapshot.boundary.productionRows}</span>
        <span>Live external calls: {snapshot.boundary.liveExternalCalls}</span>
        <span>Live Microsoft writes: {snapshot.boundary.liveMicrosoftWrites}</span>
        <span>Deployments: {snapshot.boundary.deployments}</span>
        <span>GitHub pushes: {snapshot.boundary.githubPushes}</span>
      </div>
    </div>
  );
}

function CriteriaPanel({ snapshot }: { snapshot: Dx1EnterpriseDemoSnapshot }) {
  const experience = dx1ExperienceStream(snapshot);
  if (!experience) return null;
  return (
    <section aria-labelledby="dx1-criteria-title" className={card}>
      <header className="border-b border-slate-200 px-5 py-4">
        <p className={eyebrow}>Experience and governance evidence</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950" id="dx1-criteria-title">
          Five assigned controls
        </h2>
      </header>
      <div className="grid gap-px bg-slate-200 sm:grid-cols-2 xl:grid-cols-5">
        {experience.criteria.map((criterion) => (
          <article className="bg-white p-4" key={criterion.criterionId}>
            <div className="flex items-start gap-3">
              {criterion.status === "Complete" ? (
                <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              )}
              <div>
                <p className="text-xs font-bold text-slate-950">{criterion.criterionId}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{criterion.summary}</p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {criterion.assertionIds.length} assertions
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function PersonaWorkspaces({ snapshot }: { snapshot: Dx1EnterpriseDemoSnapshot }) {
  const experience = dx1ExperienceStream(snapshot);
  if (!experience) return null;
  return (
    <section aria-labelledby="dx1-personas-title" className={card}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className={eyebrow}>Start from assigned work</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950" id="dx1-personas-title">
            Persona workspace launchpad
          </h2>
        </div>
        <Badge className="border-teal-200 bg-teal-50 text-teal-800" variant="outline">
          {experience.workspaces.length}/11 enterprise destinations
        </Badge>
      </header>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-5">
        {experience.personaAssignments.map((assignment) => (
          <article className="flex min-h-56 flex-col rounded-xl border border-slate-200 bg-slate-50 p-4" key={assignment.actorId}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-950 text-white">
              <UserRoundCheck aria-hidden="true" className="h-5 w-5" />
            </div>
            <p className="mt-4 text-sm font-semibold text-slate-950">{assignment.displayLabel}</p>
            <p className="mt-1 text-xs text-slate-500">{assignment.workspaceLabel}</p>
            <p className="mt-3 flex-1 text-xs leading-5 text-slate-700">{assignment.primaryWorkLabel}</p>
            <a
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-800 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
              href={assignment.primaryWorkPath}
            >
              Open assigned work <ArrowRight aria-hidden="true" className="h-4 w-4" />
            </a>
          </article>
        ))}
      </div>
    </section>
  );
}

function WorkflowRegistry({ snapshot }: { snapshot: Dx1EnterpriseDemoSnapshot }) {
  const experience = dx1ExperienceStream(snapshot);
  if (!experience) return null;
  return (
    <section aria-labelledby="dx1-workflows-title" className={card}>
      <header className="border-b border-slate-200 px-5 py-4">
        <p className={eyebrow}>No unmanaged pilot workflow</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950" id="dx1-workflows-title">
          Eight-stage governance registry
        </h2>
      </header>
      <ol className="grid gap-px bg-slate-200 lg:grid-cols-2">
        {experience.workflows.map((workflow) => (
          <li className="bg-white p-5" key={workflow.workflowId}>
            <div className="flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">
                {workflow.sequence}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-950">{workflow.label}</p>
                  <Badge variant="outline">Owner · {workflow.ownerRole}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{workflow.sourceModule}</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg bg-slate-50 p-3">
                    <p className={eyebrow}>Evidence gate</p>
                    <p className="mt-1 text-xs leading-5 text-slate-700">
                      {workflow.requiredEvidence.join(" · ")}
                    </p>
                  </div>
                  <div className="rounded-lg bg-amber-50 p-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-700">
                      Escalation
                    </p>
                    <p className="mt-1 text-xs leading-5 text-amber-950">
                      {workflow.escalation.routeLabel} → {workflow.escalation.targetRole}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-[11px] text-slate-500">
                  Status: {workflow.statusModel.join(" → ")}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function FrontlineWalkthroughs({ snapshot }: { snapshot: Dx1EnterpriseDemoSnapshot }) {
  const experience = dx1ExperienceStream(snapshot);
  if (!experience) return null;
  return (
    <section aria-labelledby="dx1-frontline-title" className={card}>
      <header className="border-b border-slate-200 px-5 py-4">
        <p className={eyebrow}>Plain-language task completion</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950" id="dx1-frontline-title">
          Frontline walkthrough proof
        </h2>
      </header>
      <div className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-4">
        {experience.frontlineWalkthroughs.map((walkthrough) => (
          <article className="rounded-xl border border-slate-200 p-4" key={walkthrough.walkthroughId}>
            <div className="flex items-center justify-between gap-2">
              <ClipboardCheck aria-hidden="true" className="h-5 w-5 text-emerald-700" />
              <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
                Completed
              </Badge>
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-950">{walkthrough.personaLabel}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{walkthrough.primaryTask}</p>
            <ol className="mt-4 space-y-2">
              {walkthrough.visibleActions.map((action, index) => (
                <li className="flex gap-2 text-xs leading-5 text-slate-700" key={action}>
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{index + 1}. {action}</span>
                </li>
              ))}
            </ol>
            <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-semibold text-slate-600">
              Hidden technical steps: {walkthrough.hiddenTechnicalSteps}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function GuidanceAndSupport({ snapshot }: { snapshot: Dx1EnterpriseDemoSnapshot }) {
  const experience = dx1ExperienceStream(snapshot);
  if (!experience) return null;
  return (
    <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]" id="dx1-guidance">
      <div className={card}>
        <header className="border-b border-slate-200 px-5 py-4">
          <p className={eyebrow}>Help at the point of work</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Quick guidance, SOPs, and AMOS-Coach
          </h2>
        </header>
        <div className="divide-y divide-slate-200">
          {experience.guidanceAtWork.map((guidance) => (
            <article className="grid gap-3 p-4 md:grid-cols-[1fr_auto]" key={guidance.stageId}>
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  {guidance.stageId.replace(/-/g, " ")}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{guidance.quickGuidance}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-800">
                    <BookOpenCheck aria-hidden="true" className="h-3.5 w-3.5" />
                    {guidance.sopId} · {guidance.sopTitle}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-800">
                    Human owner · {guidance.accountableHumanRole}
                  </span>
                </div>
              </div>
              <div className="max-w-sm rounded-xl border border-violet-200 bg-violet-50 p-3">
                <p className="inline-flex items-center gap-2 text-xs font-bold text-violet-900">
                  <Bot aria-hidden="true" className="h-4 w-4" /> AMOS-Coach prompt
                </p>
                <p className="mt-2 text-xs leading-5 text-violet-900">“{guidance.coachPrompt}”</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <aside className={`${card} h-fit p-5`} id="dx1-issue-support">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <HelpCircle aria-hidden="true" className="h-5 w-5" />
        </div>
        <p className={"mt-4 " + eyebrow}>Issue-support path</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">{experience.issueSupport.label}</h2>
        <p className="mt-2 text-xs leading-5 text-slate-600">
          Keep the evidence gate intact and route the issue to {experience.issueSupport.ownerRole}.
        </p>
        <ol className="mt-4 space-y-3">
          {experience.issueSupport.steps.map((step, index) => (
            <li className="flex gap-3 text-xs leading-5 text-slate-700" key={step}>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-950 text-[10px] font-bold text-white">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-lg bg-slate-100 px-3 py-2 text-[11px] font-mono text-slate-700">
          {experience.issueSupport.queueId}
        </p>
      </aside>
    </section>
  );
}

function ReleaseGovernance({ snapshot }: { snapshot: Dx1EnterpriseDemoSnapshot }) {
  const experience = dx1ExperienceStream(snapshot);
  if (!experience) return null;
  const release = experience.releaseGovernance;
  if (!release) return null;
  return (
    <section aria-labelledby="dx1-release-title" className={card}>
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className={eyebrow}>Safe change disposition</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950" id="dx1-release-title">
            Release and enhancement governance
          </h2>
        </div>
        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
          Demo-only · no production activation
        </Badge>
      </header>
      <div className="grid gap-5 p-5 xl:grid-cols-3">
        <article className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-950">
            <GitPullRequestArrow aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="text-sm font-semibold">Release register</p>
          </div>
          {release.releaseRegister.map((record) => (
            <div className="mt-4 rounded-lg bg-slate-50 p-3" key={record.releaseId}>
              <p className="text-xs font-semibold text-slate-900">{record.label}</p>
              <p className="mt-1 text-[11px] text-slate-500">{record.status.replace(/-/g, " ")}</p>
              <p className="mt-2 text-[11px] font-semibold text-teal-800">Owner · {record.ownerRole}</p>
            </div>
          ))}
        </article>
        <article className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-950">
            <ListChecks aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="text-sm font-semibold">Enhancement backlog</p>
          </div>
          <div className="mt-4 space-y-3">
            {release.enhancementBacklog.map((item) => (
              <div className="rounded-lg bg-slate-50 p-3" key={item.enhancementId}>
                <p className="text-xs font-semibold text-slate-900">{item.label}</p>
                <p className="mt-1 text-[11px] font-semibold text-amber-800">{item.disposition.replace(/-/g, " ")}</p>
                <p className="mt-1 text-[11px] leading-4 text-slate-500">{item.rationale}</p>
              </div>
            ))}
          </div>
        </article>
        <article className="rounded-xl border border-slate-200 p-4">
          <div className="flex items-center gap-2 text-slate-950">
            <History aria-hidden="true" className="h-5 w-5 text-teal-700" />
            <p className="text-sm font-semibold">Evidence history</p>
          </div>
          <ol className="mt-4 space-y-3">
            {release.evidenceHistory.map((entry) => (
              <li className="flex gap-3" key={entry.historyId}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-950 text-[10px] font-bold text-white">
                  {entry.sequence}
                </span>
                <div>
                  <p className="text-xs leading-5 text-slate-700">{entry.action}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Append only</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs font-bold text-emerald-900">Approved demo-only change</p>
            <p className="mt-1 text-[11px] leading-5 text-emerald-900">
              {release.safeChangeDisposition.rationale}
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-[55vh] items-center justify-center" data-testid="dx1-loading-state">
      <div className="text-center">
        <LoaderCircle aria-hidden="true" className="mx-auto h-9 w-9 animate-spin text-teal-700" />
        <p className="mt-3 text-sm font-semibold text-slate-800">Loading verified enterprise evidence…</p>
        <p className="mt-1 text-xs text-slate-500">No readiness claim is shown until evidence arrives.</p>
      </div>
    </div>
  );
}

function ErrorState({ message, onRefresh }: { message?: string; onRefresh: () => void }) {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-2xl items-center px-5" data-testid="dx1-error-state">
      <div className={`${card} w-full p-6 text-center`}>
        <AlertCircle aria-hidden="true" className="mx-auto h-10 w-10 text-rose-600" />
        <h1 className="mt-4 text-xl font-semibold text-slate-950">Enterprise evidence is unavailable</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{message ?? "The synthetic verification result could not be loaded."}</p>
        <Button className="mt-5" onClick={onRefresh} type="button">
          <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" /> Retry evidence load
        </Button>
      </div>
    </div>
  );
}

export function Dx1EnterpriseDemoView(props: Dx1EnterpriseDemoViewProps) {
  if (props.state === "loading") return <LoadingState />;
  if (props.state === "error" || !props.snapshot)
    return <ErrorState message={props.errorMessage} onRefresh={props.onRefresh} />;

  const snapshot = props.snapshot;
  const overall = dx1AcceptanceCounts(snapshot);
  const experience = dx1ExperienceCriteriaCounts(snapshot);
  const stream = dx1ExperienceStream(snapshot);
  const canRunVerification =
    props.canRunVerification ??
    snapshot.viewer?.canRunVerification ??
    snapshot.viewer?.canRunIntegratedEvaluation ??
    false;
  if (!stream)
    return <ErrorState message="Experience-governance evidence is missing from the integrated result." onRefresh={props.onRefresh} />;

  return (
    <div className="min-h-screen bg-slate-50" data-testid="dx1-enterprise-demo-ready">
      <Boundary snapshot={snapshot} />
      <main className="mx-auto max-w-[1500px] space-y-5 px-4 py-6 md:px-6">
        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl shadow-slate-300/30">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1fr_auto] lg:px-9">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-teal-300">AMOS-OPS · DX.1</p>
              <h1 className="mt-3 max-w-4xl text-3xl font-semibold tracking-tight md:text-4xl">
                Final cross-enterprise demo verification
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-300">
                Enter through the Operations Hub, open assigned work, follow the eight governed stages, ask for bounded help, and review release evidence without technical setup.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Home aria-hidden="true" className="h-4 w-4" /> Operations Hub entry
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <Workflow aria-hidden="true" className="h-4 w-4" /> Eight governed stages
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-2">
                  <LockKeyhole aria-hidden="true" className="h-4 w-4" /> Human gates intact
                </span>
              </div>
            </div>
            <div className="flex min-w-64 flex-col justify-between rounded-2xl border border-white/15 bg-white/10 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Current result</p>
                <p className="mt-2 text-2xl font-semibold">{snapshot.acceptance.replace("_", " ")}</p>
                <p className="mt-1 text-xs text-slate-300">{overall.passed}/{overall.total} enterprise criteria · {snapshot.assertionCount} assertions</p>
              </div>
              <div className="mt-6 flex gap-2">
                <Button
                  className="flex-1 bg-teal-400 text-slate-950 hover:bg-teal-300"
                  disabled={props.isRunning || !canRunVerification}
                  onClick={props.onRunVerification}
                  title={
                    canRunVerification
                      ? "Run the deterministic DX.1 verification again"
                      : "Reviewer role required to run verification"
                  }
                  type="button"
                >
                  {props.isRunning ? <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" /> : <Play aria-hidden="true" className="mr-2 h-4 w-4" />}
                  {canRunVerification ? "Verify again" : "Reviewer required"}
                </Button>
                <Button aria-label="Refresh evidence" disabled={props.isRefreshing} onClick={props.onRefresh} size="icon" type="button" variant="outline">
                  <RefreshCw aria-hidden="true" className={`h-4 w-4 ${props.isRefreshing ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric detail="configured and governed" icon={LayoutGrid} label="Enterprise workspaces" value={`${stream.workspaces.length}/11`} />
          <Metric detail="routed to assigned work" icon={Users} label="Synthetic personas" value={stream.personaAssignments.length} />
          <Metric detail="owner, status, evidence, escalation" icon={Workflow} label="Pilot workflows" value={stream.workflows.length} />
          <Metric detail={`${experience.assertions} executable assertions`} icon={ShieldCheck} label="Assigned criteria" value={`${experience.passed}/${experience.total}`} />
        </section>

        <CriteriaPanel snapshot={snapshot} />
        <PersonaWorkspaces snapshot={snapshot} />
        <WorkflowRegistry snapshot={snapshot} />
        <FrontlineWalkthroughs snapshot={snapshot} />
        <GuidanceAndSupport snapshot={snapshot} />
        <ReleaseGovernance snapshot={snapshot} />

        <footer className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-700">
            <FileClock aria-hidden="true" className="h-4 w-4" /> Evidence evaluated {snapshot.evaluatedAt}
          </span>
          <span className="inline-flex items-center gap-2">
            <Route aria-hidden="true" className="h-4 w-4" /> {snapshot.scenarioId}
          </span>
        </footer>
      </main>
    </div>
  );
}
