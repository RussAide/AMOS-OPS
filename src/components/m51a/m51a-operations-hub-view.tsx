import {
  AlertTriangle,
  Archive,
  ArrowRight,
  BookOpenCheck,
  Boxes,
  Check,
  CheckCircle2,
  Database,
  FileCheck2,
  FolderKanban,
  GitBranch,
  KeyRound,
  LayoutGrid,
  Link2,
  Loader2,
  LockKeyhole,
  Network,
  Play,
  RefreshCw,
  RotateCcw,
  Route,
  SearchCheck,
  ShieldCheck,
  Waypoints,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge-view";
import { Button } from "@/components/ui/button-view";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import type {
  M51AAcceptancePresentation,
  M51ARouteDecision,
  M51ASnapshot,
} from "./m51a-experience-model";
import { m51aAcceptanceCounts } from "./m51a-experience-model";

type ViewState = "loading" | "error" | "ready";

export interface M51AOperationsHubViewProps {
  snapshot: M51ASnapshot | null;
  acceptance: M51AAcceptancePresentation | null;
  scenarioResult: M51AAcceptancePresentation | null;
  routeDecision: M51ARouteDecision | null;
  state: ViewState;
  errorMessage?: string;
  isRefreshing: boolean;
  isRunningScenario: boolean;
  isResolvingRoute: boolean;
  onRefresh: () => void;
  onRunScenario: () => void;
  onResolveRoute: (routeCode: M51ASnapshot["hub"]["routes"][number]["code"]) => void;
}

const cardClass =
  "rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/40";
const labelClass =
  "text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500";

function MetricCard(props: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  detail: string;
  tone?: "navy" | "teal" | "amber" | "violet";
}) {
  const tone = {
    navy: "bg-slate-950 text-white",
    teal: "bg-teal-50 text-teal-800 border-teal-100",
    amber: "bg-amber-50 text-amber-800 border-amber-100",
    violet: "bg-violet-50 text-violet-800 border-violet-100",
  }[props.tone ?? "teal"];
  const Icon = props.icon;
  return (
    <div className={`${cardClass} flex min-h-32 flex-col justify-between p-4 ${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">
          {props.label}
        </p>
        <Icon className="h-5 w-5 opacity-80" />
      </div>
      <div>
        <p className="mt-5 text-3xl font-semibold tracking-tight">{props.value}</p>
        <p className="mt-1 text-xs opacity-70">{props.detail}</p>
      </div>
    </div>
  );
}

function BoundaryStrip({ snapshot }: { snapshot: M51ASnapshot }) {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-teal-800/40 bg-teal-950 px-5 py-3 text-xs text-teal-50">
      <span className="inline-flex items-center gap-2 font-semibold">
        <ShieldCheck className="h-4 w-4" /> Synthetic architecture evaluation
      </span>
      <span>Real data: {snapshot.boundary.realDataUsed ? "Yes" : "No"}</span>
      <span>Live Microsoft reads: {snapshot.boundary.liveMicrosoftReads}</span>
      <span>Live Microsoft writes: {snapshot.boundary.liveMicrosoftWrites}</span>
      <span>Production rows: {snapshot.boundary.productionRows}</span>
    </div>
  );
}

function AcceptancePanel({
  result,
}: {
  result: M51AAcceptancePresentation | null;
}) {
  const counts = m51aAcceptanceCounts(result);
  if (!result)
    return (
      <div className={`${cardClass} p-5`}>
        <p className={labelClass}>Milestone control set</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">
          Eight executable acceptance criteria
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Run the integrated scenario to evaluate architecture, inventory,
          connector modes, stable identity, routing, pilot reconciliation, and
          security recovery as one system.
        </p>
      </div>
    );

  return (
    <div className={`${cardClass} overflow-hidden`}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
        <div>
          <p className={labelClass}>Integrated acceptance</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            {counts.passed}/{counts.total} controls passed
          </h2>
        </div>
        <Badge
          className={
            result.accepted
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }
          variant="outline"
        >
          {result.accepted ? "Accepted" : "Review required"}
        </Badge>
      </div>
      <div className="grid gap-px bg-slate-200 sm:grid-cols-2">
        {result.acceptanceFlags.map((criterion) => (
          <article className="bg-white p-4" key={criterion.criterionId}>
            <div className="flex gap-3">
              {criterion.passed ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
              )}
              <div>
                <p className="text-xs font-bold text-slate-950">
                  {criterion.criterionId}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  {criterion.summary}
                </p>
                <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  {criterion.assertionCount} assertions
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function OverviewTab(props: M51AOperationsHubViewProps & { snapshot: M51ASnapshot }) {
  const { snapshot } = props;
  const result = props.scenarioResult ?? props.acceptance;
  const counts = m51aAcceptanceCounts(result);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          detail="governed and segregated zones"
          icon={Network}
          label="Hub topology"
          tone="navy"
          value={snapshot.hub.totals.sites}
        />
        <MetricCard
          detail="controlled enterprise libraries"
          icon={FolderKanban}
          label="Libraries"
          value={snapshot.hub.totals.libraries}
        />
        <MetricCard
          detail="registered exactly once"
          icon={Database}
          label="Repositories"
          tone="violet"
          value={snapshot.connectors.inventory.repositoryCount}
        />
        <MetricCard
          detail={`${counts.total} milestone controls`}
          icon={CheckCircle2}
          label="Acceptance"
          tone="amber"
          value={`${counts.passed}/${counts.total}`}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <AcceptancePanel result={result} />
        <div className={`${cardClass} p-5`}>
          <p className={labelClass}>Operating model</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            AMOS governs. Microsoft collaborates.
          </h2>
          <div className="mt-5 space-y-3">
            {[
              ["1", "AMOS-DMS", "Owns identity, lifecycle, authority, and audit."],
              ["2", "Connector policy", "Applies mode, sensitivity, ACL, and retention gates."],
              ["3", "Microsoft 365", "Provides constrained repositories and collaboration surfaces."],
              ["4", "Intranet", "Returns permission-trimmed, source-transparent guidance."],
            ].map(([step, title, detail]) => (
              <div className="flex gap-3" key={step}>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-950 text-xs font-bold text-white">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="text-xs leading-5 text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className={`${cardClass} p-4`}>
          <p className={labelClass}>Signed-in projection</p>
          <p className="mt-2 text-base font-semibold capitalize text-slate-900">
            {snapshot.viewer.role.replace(/-/g, " ")}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {snapshot.viewer.tier} · {snapshot.viewer.divisionIds.join(", ").toUpperCase()}
          </p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className={labelClass}>Authorized destinations</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {snapshot.hub.routes.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {snapshot.hub.deniedRouteCount} routes suppressed before display
          </p>
        </div>
        <div className={`${cardClass} p-4`}>
          <p className={labelClass}>Security evaluation</p>
          <p className="mt-2 text-2xl font-semibold text-slate-900">
            {snapshot.security.decisionCount.toLocaleString()}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            deterministic decisions · zero live writes
          </p>
        </div>
      </div>
    </div>
  );
}

function HubTab({ snapshot }: { snapshot: M51ASnapshot }) {
  const associated = snapshot.hub.sites.filter(
    (site) => site.kind === "associated_operational_site",
  );
  const restricted = snapshot.hub.sites.filter(
    (site) =>
      site.kind === "restricted_record_zone" ||
      site.kind === "system_managed_zone",
  );
  return (
    <div className="space-y-5">
      <div className={`${cardClass} p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className={labelClass}>Architecture topology</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              One hub, approved associations, hard restricted boundaries
            </h2>
          </div>
          <Badge variant="outline">{snapshot.hub.governingSystem} authority</Badge>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-[.8fr_1fr_1fr]">
          <div className="rounded-xl bg-slate-950 p-4 text-white">
            <Waypoints className="h-6 w-6 text-teal-300" />
            <p className="mt-5 text-xs uppercase tracking-widest text-slate-400">
              Governing hub
            </p>
            <p className="mt-1 font-semibold">Adolbi Care Operations Hub</p>
            <p className="mt-2 text-xs leading-5 text-slate-300">
              Shared navigation, governed roll-up, knowledge discovery, and
              source-transparent publishing.
            </p>
          </div>
          <div className="rounded-xl border border-teal-100 bg-teal-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
              Associated operational sites · {associated.length}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {associated.map((site) => (
                <span className="rounded-full bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm" key={site.siteId}>
                  {site.name}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-800">
              Segregated zones · {restricted.length}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {restricted.map((site) => (
                <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs text-slate-700 shadow-sm" key={site.siteId}>
                  <LockKeyhole className="h-3 w-3 text-rose-500" /> {site.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-200 px-5 py-4">
          <p className={labelClass}>Controlled library architecture</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Ten libraries with one authoritative publishing lane
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-5 py-3">Library</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Handling</th>
                <th className="px-4 py-3">Content types</th>
                <th className="px-4 py-3">Authority</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshot.hub.libraries.map((library) => (
                <tr key={library.libraryId}>
                  <td className="px-5 py-3 font-semibold text-slate-900">{library.name}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{library.ownerRole.replace(/-/g, " ")}</td>
                  <td className="px-4 py-3 text-slate-600">{library.defaultHandlingClass}</td>
                  <td className="px-4 py-3 text-slate-600">{library.allowedContentTypes.length}</td>
                  <td className="px-4 py-3">
                    {library.authoritativeGuidanceEligible ? (
                      <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">Published guidance</Badge>
                    ) : library.temporaryIntakeOnly ? (
                      <Badge className="border-amber-200 bg-amber-50 text-amber-800" variant="outline">Temporary intake</Badge>
                    ) : (
                      <span className="text-slate-400">Governed content</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ConnectorsTab({ snapshot }: { snapshot: M51ASnapshot }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.connectors.modeCounts.map((item, index) => (
          <div className={`${cardClass} p-4`} key={item.mode}>
            <div className="flex items-start justify-between">
              <GitBranch className={index === 3 ? "h-5 w-5 text-slate-400" : "h-5 w-5 text-teal-700"} />
              <span className="text-2xl font-semibold text-slate-950">{item.count}</span>
            </div>
            <p className="mt-4 text-xs font-semibold leading-5 text-slate-700">{item.mode}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
        <div className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-slate-200 px-5 py-4">
            <p className={labelClass}>Microsoft Connector Registry</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              Every repository has one mode and one disposition
            </h2>
          </div>
          {snapshot.connectors.repositoryDetailsTrimmed ? (
            <div className="p-8 text-center">
              <LockKeyhole className="mx-auto h-7 w-7 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-800">Registry detail is role-trimmed</p>
              <p className="mt-1 text-xs text-slate-500">The inventory total is visible; repository governance details require T1 or T2 review authority.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {snapshot.connectors.repositories.map((repository) => (
                <article className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_1fr_.7fr]" key={repository.connectorId}>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{repository.displayName}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{repository.classification.replace(/_/g, " ")}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-700">{repository.connectorMode}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{repository.allowedOperations.length} permitted operations</p>
                  </div>
                  <div className="md:text-right">
                    <Badge className={repository.disposition === "Exclude" || repository.disposition === "Quarantine" ? "border-amber-200 bg-amber-50 text-amber-800" : "border-teal-200 bg-teal-50 text-teal-800"} variant="outline">
                      {repository.disposition}
                    </Badge>
                    <p className="mt-2 text-[10px] uppercase tracking-wider text-slate-400">{repository.status}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className={`${cardClass} p-5`}>
            <KeyRound className="h-6 w-6 text-teal-700" />
            <p className="mt-4 text-3xl font-semibold text-slate-950">{snapshot.connectors.stableObjectCount}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Stable AMOS object mappings</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Opaque site, drive, and item locators can change without changing enterprise identity.</p>
          </div>
          <div className={`${cardClass} p-5`}>
            <SearchCheck className="h-6 w-6 text-violet-700" />
            <p className="mt-4 text-3xl font-semibold text-slate-950">{snapshot.connectors.stableMappingIssueCount}</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">Mapping validation issues</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">All fixture items resolve uniquely with append-only locator history.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function IntranetTab(props: M51AOperationsHubViewProps & { snapshot: M51ASnapshot }) {
  const { snapshot } = props;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-200 px-5 py-4">
          <p className={labelClass}>Permission-aware intranet map</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">
            Destinations authorized for this role
          </h2>
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
          {snapshot.hub.routes.map((route) => (
            <button
              className="group flex min-h-28 flex-col items-start bg-white p-4 text-left transition hover:bg-teal-50 disabled:opacity-60"
              disabled={props.isResolvingRoute}
              key={route.routeId}
              onClick={() => props.onResolveRoute(route.code)}
              type="button"
            >
              <div className="flex w-full items-center justify-between gap-2">
                <Route className="h-5 w-5 text-teal-700" />
                <ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-1 group-hover:text-teal-700" />
              </div>
              <p className="mt-4 text-sm font-semibold text-slate-900">{route.label}</p>
              <p className="mt-1 text-[11px] text-slate-500">{route.logicalPath}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-5">
        <div className={`${cardClass} p-5`}>
          <p className={labelClass}>Route evaluator</p>
          {props.routeDecision ? (
            <div className="mt-4">
              <div className="flex items-center gap-2">
                {props.routeDecision.allowed ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <XCircle className="h-5 w-5 text-rose-600" />}
                <p className="font-semibold text-slate-900">{props.routeDecision.allowed ? "Route authorized" : "Route suppressed"}</p>
              </div>
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                <dt className="text-slate-400">Decision</dt><dd className="font-medium text-slate-700">{props.routeDecision.reasonCode}</dd>
                <dt className="text-slate-400">Logical path</dt><dd className="font-medium text-slate-700">{props.routeDecision.logicalPath ?? "Not disclosed"}</dd>
                <dt className="text-slate-400">Physical URL</dt><dd className="font-medium text-slate-700">Never returned</dd>
              </dl>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-6 text-slate-600">Select a destination to run the server-side role, scope, and restricted-target decision.</p>
          )}
        </div>
        <div className={`${cardClass} p-5`}>
          <p className={labelClass}>Authoritative guidance</p>
          <div className="mt-4 space-y-3">
            {snapshot.hub.citations.map((citation) => (
              <article className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3" key={citation.objectId}>
                <div className="flex gap-2">
                  <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold text-slate-900">{citation.title}</p>
                    <p className="mt-1 text-[10px] text-slate-500">Approved by {citation.approverRole.replace(/-/g, " ")} · AMOS-DMS source</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PilotTab({ snapshot }: { snapshot: M51ASnapshot }) {
  const checks = [
    ["Counts", snapshot.pilot.reconciliation.countMismatches.length],
    ["Content hashes", snapshot.pilot.reconciliation.contentHashMismatches.length],
    ["Versions", snapshot.pilot.reconciliation.versionMismatches.length],
    ["Metadata", snapshot.pilot.reconciliation.metadataMismatches.length],
    ["Permissions", snapshot.pilot.reconciliation.aclMismatches.length],
    ["Stable IDs", snapshot.pilot.reconciliation.stableObjectMismatches.length],
    ["Links", snapshot.pilot.reconciliation.linkMismatches.length],
    ["Search", snapshot.pilot.reconciliation.searchMismatches.length],
  ] as const;
  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-3">
        <MetricCard detail="two fictional items per category" icon={Boxes} label="Pilot items" tone="navy" value={snapshot.pilot.sourceItemCount} />
        <MetricCard detail="controlled failure then idempotent replay" icon={RotateCcw} label="Execution attempts" value={snapshot.pilot.attemptCount} />
        <MetricCard detail="after full target rollback" icon={Archive} label="Target items retained" tone="amber" value={snapshot.pilot.rollback.targetItemsAfterRollback} />
      </div>
      <div className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <div className={`${cardClass} p-5`}>
          <p className={labelClass}>Non-sensitive pilot corpus</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Six approved categories</h2>
          <div className="mt-4 space-y-2">
            {snapshot.pilot.categories.map((item) => (
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5" key={item.category}>
                <span className="text-xs font-medium capitalize text-slate-700">{item.category.replace(/-/g, " ")}</span>
                <Badge variant="outline">{item.count}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className={`${cardClass} p-5`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className={labelClass}>Reconciliation result</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950">Source and target reconcile exactly</h2>
            </div>
            <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">Passed</Badge>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {checks.map(([label, mismatchCount]) => (
              <div className="flex items-center justify-between rounded-xl border border-slate-100 p-3" key={label}>
                <span className="text-xs font-medium text-slate-700">{label}</span>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> {mismatchCount} mismatches</span>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-slate-950 p-4 text-slate-100">
            <div className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-teal-300" /><p className="text-xs font-semibold">Rollback proof</p></div>
            <p className="mt-2 text-xs leading-5 text-slate-300">The synthetic target returns to zero items while all {snapshot.pilot.rollback.sourceItemsAfterRollback} source items and the original source manifest remain unchanged.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityTab({ snapshot }: { snapshot: M51ASnapshot }) {
  const violations = [
    ["Metadata-only boundary", snapshot.security.metadataOnlyViolations],
    ["System-managed exclusion", snapshot.security.excludedModeViolations],
    ["Stale content suppression", snapshot.security.staleSuppressionViolations],
    ["Unauthorized AI retrieval", snapshot.security.unauthorizedAiRetrievalViolations],
    ["Live write attempts", snapshot.security.liveWriteViolations],
    ["Permission disclosure", snapshot.security.permissionLeakViolations],
    ["DLP decision coherence", snapshot.security.dlpDecisionViolations],
  ] as const;
  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
      <div className={`${cardClass} overflow-hidden`}>
        <div className="border-b border-slate-200 bg-slate-950 px-5 py-5 text-white">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-teal-300">Integrated security evaluation</p>
              <h2 className="mt-1 text-xl font-semibold">{snapshot.security.decisionCount.toLocaleString()} deterministic access decisions</h2>
              <p className="mt-2 text-xs text-slate-300">{snapshot.security.rolesEvaluated} roles · {snapshot.security.tiersEvaluated.length} tiers · {snapshot.security.divisionsEvaluated.length} divisions</p>
            </div>
            <ShieldCheck className="h-8 w-8 text-teal-300" />
          </div>
        </div>
        <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
          {violations.map(([label, count]) => (
            <div className="flex items-center justify-between bg-white p-4" key={label}>
              <span className="text-xs font-medium text-slate-700">{label}</span>
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> {count}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={`${cardClass} p-5`}>
        <p className={labelClass}>Hard prototype boundary</p>
        <h2 className="mt-1 text-lg font-semibold text-slate-950">Unavailable by design in M5.1A</h2>
        <div className="mt-4 space-y-2">
          {snapshot.boundary.prohibitedActions.slice(0, 9).map((action) => (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-800" key={action}>
              <LockKeyhole className="h-3.5 w-3.5 shrink-0" />
              <span>{action.replace(/_/g, " ")}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function M51AOperationsHubView(props: M51AOperationsHubViewProps) {
  if (props.state === "error")
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center">
        <AlertTriangle className="mx-auto h-8 w-8 text-rose-700" />
        <h2 className="mt-3 font-semibold text-rose-950">The Operations Hub evaluation could not load</h2>
        <p className="mt-2 text-sm text-rose-800">{props.errorMessage ?? "Unknown M5.1A evaluation error."}</p>
        <Button className="mt-5" onClick={props.onRefresh} variant="outline"><RefreshCw className="h-4 w-4" /> Retry</Button>
      </div>
    );

  if (props.state === "loading" || !props.snapshot)
    return (
      <div className="flex min-h-[440px] items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-700" />
          <p className="mt-3 text-sm font-semibold text-slate-800">Loading M5.1A Operations Hub architecture</p>
          <p className="mt-1 text-xs text-slate-500">Building the signed-in role projection and synthetic control evidence.</p>
        </div>
      </div>
    );

  const snapshot = props.snapshot;
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <BoundaryStrip snapshot={snapshot} />
      <div className="border-b border-slate-200 bg-white px-5 py-5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-teal-200 bg-teal-50 text-teal-800" variant="outline">M5.1A operational prototype</Badge>
              <Badge variant="outline">{snapshot.viewer.tier} projection</Badge>
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">Adolbi Care Operations Hub</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">A governed enterprise content, connector, intranet, pilot, and security experience—evaluated as one deterministic system.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={props.isRefreshing} onClick={props.onRefresh} variant="outline">
              {props.isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh
            </Button>
            <Button disabled={props.isRunningScenario || !snapshot.viewer.canReviewArchitecture} onClick={props.onRunScenario}>
              {props.isRunningScenario ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run integrated evaluation
            </Button>
          </div>
        </div>
      </div>

      <Tabs className="gap-0" defaultValue="overview">
        <div className="overflow-x-auto border-b border-slate-200 bg-white px-4 sm:px-6">
          <TabsList className="h-12 w-max bg-transparent p-0">
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="overview"><LayoutGrid /> Control center</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="hub"><FolderKanban /> Hub & libraries</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="connectors"><GitBranch /> Connectors</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="intranet"><Link2 /> Intranet</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="pilot"><FileCheck2 /> Pilot</TabsTrigger>
            <TabsTrigger className="rounded-none border-b-2 border-transparent px-4 data-[state=active]:border-teal-700 data-[state=active]:shadow-none" value="security"><ShieldCheck /> Security</TabsTrigger>
          </TabsList>
        </div>
        <div className="p-4 sm:p-6">
          <TabsContent value="overview"><OverviewTab {...props} snapshot={snapshot} /></TabsContent>
          <TabsContent value="hub"><HubTab snapshot={snapshot} /></TabsContent>
          <TabsContent value="connectors"><ConnectorsTab snapshot={snapshot} /></TabsContent>
          <TabsContent value="intranet"><IntranetTab {...props} snapshot={snapshot} /></TabsContent>
          <TabsContent value="pilot"><PilotTab snapshot={snapshot} /></TabsContent>
          <TabsContent value="security"><SecurityTab snapshot={snapshot} /></TabsContent>
        </div>
      </Tabs>
    </section>
  );
}
