import {
  Archive,
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  ChevronRight,
  Database,
  FileClock,
  FileSearch,
  FileStack,
  FlaskConical,
  Gauge,
  History,
  LibraryBig,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Undo2,
  XCircle,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  m42AcceptanceCounts,
  type M42AcceptanceStatus,
  type M42ConfigurationDemoResult,
  type M42ConfigurationSchemas,
  type M42DocumentActionResult,
  type M42DocumentSearchResult,
  type M42GovernedDocuments,
  type M42NilSearchResult,
  type M42ReportDemoResult,
  type M42ReportFields,
  type M42ScenarioResult,
  type M42Snapshot,
  type M42VersionDemoResult,
} from "./m42-experience-model";

export type M42ViewState = "loading" | "error" | "ready";
type WorkspaceTab =
  | "overview"
  | "records"
  | "search"
  | "reports"
  | "admin"
  | "validation";

export interface M42DocumentKnowledgeViewProps {
  state: M42ViewState;
  errorMessage?: string;
  snapshot: M42Snapshot | null;
  acceptance: M42AcceptanceStatus | null;
  scenarioResult: M42ScenarioResult | null;
  documentSearchResult: M42DocumentSearchResult | null;
  nilSearchResult: M42NilSearchResult | null;
  governedDocuments: M42GovernedDocuments | null;
  documentActionResult: M42DocumentActionResult | null;
  versionDemoResult: M42VersionDemoResult | null;
  reportFields: M42ReportFields | null;
  reportDemoResult: M42ReportDemoResult | null;
  configurationSchemas: M42ConfigurationSchemas | null;
  configurationDemoResult: M42ConfigurationDemoResult | null;
  isRefreshing: boolean;
  isRunningScenario: boolean;
  isSearchingDocuments: boolean;
  isSearchingNil: boolean;
  isEvaluatingDocument: boolean;
  isRunningVersionDemo: boolean;
  isRunningReportDemo: boolean;
  isRunningConfigurationDemo: boolean;
  onRefresh: () => void;
  onRunScenario: () => void;
  onSearchDocuments: (query: string) => void;
  onSearchNil: (query: string) => void;
  onEvaluateDocument: (
    documentId: string,
    action:
      | "metadata_read"
      | "content_read"
      | "download"
      | "export"
      | "disclose",
  ) => void;
  onRunVersionDemo: () => void;
  onRunReportDemo: () => void;
  onRunConfigurationDemo: (configKey?: string) => void;
}

const TABS: readonly {
  id: WorkspaceTab;
  label: string;
  icon: typeof Database;
}[] = [
  { id: "overview", label: "Control map", icon: Gauge },
  { id: "records", label: "Records", icon: FileStack },
  { id: "search", label: "Search & NIL", icon: FileSearch },
  { id: "reports", label: "Report builder", icon: BarChart3 },
  { id: "admin", label: "No-code admin", icon: SlidersHorizontal },
  { id: "validation", label: "Scenario lab", icon: FlaskConical },
];

function LoadingState() {
  return (
    <div
      aria-label="Loading M4.2 document and knowledge workspace"
      className="space-y-4 p-4 md:p-6"
    >
      <div className="h-64 animate-pulse rounded-3xl bg-slate-200" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100 lg:col-span-2" />
        <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
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
        <XCircle aria-hidden="true" className="mx-auto size-9 text-rose-700" />
        <h1 className="mt-3 text-lg font-bold text-rose-950">
          Document intelligence workspace unavailable
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-rose-800">
          {message ??
            "The server did not return the governed M4.2 experience. No records, search results, reports, or configuration state were inferred locally."}
        </p>
        <Button className="mt-4" onClick={onRetry} type="button" variant="outline">
          <RefreshCw aria-hidden="true" className="size-4" />
          Retry governed query
        </Button>
      </div>
    </div>
  );
}

function Hero({
  snapshot,
  acceptance,
  scenarioResult,
  isRefreshing,
  onRefresh,
}: {
  snapshot: M42Snapshot;
  acceptance: M42AcceptanceStatus | null;
  scenarioResult: M42ScenarioResult | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}) {
  const counts = m42AcceptanceCounts(acceptance);
  const maxLatency = scenarioResult?.search.maxMs;
  const accuracy = scenarioResult?.nil.accuracy;
  return (
    <header className="relative overflow-hidden rounded-3xl bg-[#123f42] px-5 py-6 text-white shadow-xl md:px-8 md:py-8">
      <div className="absolute -right-16 -top-20 size-72 rounded-full bg-cyan-400/10 blur-2xl" />
      <div className="absolute -bottom-24 left-1/3 size-64 rounded-full bg-emerald-300/10 blur-3xl" />
      <div className="relative grid gap-6 xl:grid-cols-[1.3fr_1fr] xl:items-end">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <img
              alt="AMOS-OPS"
              className="h-7 w-auto object-contain"
              src="/assets/AMOS-OPS_Logo_Horizontal_Light.png"
            />
            <span className="h-5 w-px bg-white/25" />
            <Badge className="border-cyan-200/30 bg-cyan-200/10 text-cyan-50" variant="outline">
              M4.2 Operational
            </Badge>
            <Badge className="border-amber-200/30 bg-amber-200/10 text-amber-50" variant="outline">
              Synthetic prototype
            </Badge>
          </div>
          <h1 className="mt-5 max-w-3xl text-2xl font-black tracking-tight md:text-4xl">
            Document &amp; Knowledge Intelligence
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-200 md:text-base">
            One governed experience for enterprise records, permission-trimmed
            search, cited knowledge retrieval, report construction, and
            controlled administration.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-slate-200">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
              No real data
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
              No live connector writes
            </span>
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5">
              Permission trim before ranking
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
          {[
            {
              label: "Criteria",
              value: `${counts.passed}/${counts.total}`,
              detail: acceptance?.accepted ? "accepted" : "evaluating",
            },
            {
              label: "Search",
              value: maxLatency === undefined ? "<3 sec" : `${maxLatency.toFixed(1)} ms`,
              detail: "maximum observed",
            },
            {
              label: "NIL accuracy",
              value: accuracy === undefined ? "≥90%" : `${(accuracy * 100).toFixed(1)}%`,
              detail: "frozen top-1 set",
            },
            {
              label: "Corpus",
              value: snapshot.inventory.searchCorpusDocuments.toLocaleString(),
              detail: "fictional documents",
            },
          ].map((metric) => (
            <div
              className="rounded-xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm"
              key={metric.label}
            >
              <p className="text-[10px] font-black uppercase tracking-[0.13em] text-teal-200">
                {metric.label}
              </p>
              <p className="mt-1 text-xl font-black text-white">{metric.value}</p>
              <p className="mt-0.5 text-[10px] text-slate-300">{metric.detail}</p>
            </div>
          ))}
        </div>
      </div>
      <Button
        className="absolute right-4 top-4 border-white/20 bg-white/10 text-white hover:bg-white/20 md:right-6 md:top-6"
        disabled={isRefreshing}
        onClick={onRefresh}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCw
          aria-hidden="true"
          className={cn("size-3.5", isRefreshing && "animate-spin")}
        />
        <span className="sr-only sm:not-sr-only">Refresh</span>
      </Button>
    </header>
  );
}

function ControlMap({
  snapshot,
  acceptance,
}: {
  snapshot: M42Snapshot;
  acceptance: M42AcceptanceStatus | null;
}) {
  const flagById = new Map(
    acceptance?.acceptanceFlags.map((flag) => [flag.criterionId, flag]),
  );
  return (
    <section aria-labelledby="m42-control-map-title">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-950" id="m42-control-map-title">
            Eight-control operational map
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Each module is tied directly to one controlling acceptance criterion.
          </p>
        </div>
        <Badge className="border-teal-200 bg-teal-50 text-teal-900" variant="outline">
          {snapshot.modules.length} governed modules
        </Badge>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {snapshot.modules.map((module) => {
          const flag = flagById.get(module.criterionId);
          return (
            <article
              className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
              key={module.criterionId}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="rounded-lg bg-teal-50 px-2 py-1 text-[10px] font-black tracking-wide text-teal-800">
                  {module.criterionId}
                </span>
                {flag?.passed ? (
                  <CheckCircle2 aria-label="Passed" className="size-4 text-emerald-600" />
                ) : (
                  <FileClock aria-label="Evaluation pending" className="size-4 text-amber-600" />
                )}
              </div>
              <h3 className="mt-3 text-sm font-black text-slate-950">{module.label}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600">{module.experience}</p>
              <p className="mt-3 flex items-center gap-1 text-[10px] font-bold text-teal-700">
                {flag?.passed ? `${flag.assertionCount} assertions passed` : "Governed evaluation"}
                <ChevronRight aria-hidden="true" className="size-3" />
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RecordsWorkspace({
  snapshot,
  scenario,
  documents,
  actionResult,
  versionResult,
  isEvaluating,
  isRunningVersion,
  onEvaluate,
  onRunVersion,
}: {
  snapshot: M42Snapshot;
  scenario: M42ScenarioResult | null;
  documents: M42GovernedDocuments | null;
  actionResult: M42DocumentActionResult | null;
  versionResult: M42VersionDemoResult | null;
  isEvaluating: boolean;
  isRunningVersion: boolean;
  onEvaluate: M42DocumentKnowledgeViewProps["onEvaluateDocument"];
  onRunVersion: () => void;
}) {
  const [selectedDocument, setSelectedDocument] = useState("");
  const [selectedAction, setSelectedAction] = useState<
    "metadata_read" | "content_read" | "download" | "export" | "disclose"
  >("content_read");
  const effectiveDocument =
    selectedDocument || documents?.documents[0]?.documentId || "";
  const cards = [
    {
      icon: Tags,
      title: "Taxonomy & metadata",
      value: `${snapshot.inventory.taxonomyNodes} nodes`,
      detail: "Type, division, owner, classification, version, and retention are mandatory.",
    },
    {
      icon: Archive,
      title: "Retention controls",
      value: `${snapshot.inventory.retentionSchedules} schedules`,
      detail: "Legal hold suppresses disposition; the prototype produces review previews only.",
    },
    {
      icon: LockKeyhole,
      title: "Permission boundary",
      value: scenario?.records.deniedPart2Access.allowed === false ? "Part 2 denied" : "Pre-disclosure",
      detail: "Division, sensitivity, action, purpose, and consent are checked before content exposure.",
    },
    {
      icon: History,
      title: "Source of truth",
      value: scenario ? `v${scenario.records.versionLedger.document.currentVersion}` : "Immutable history",
      detail: "Checkout, conflict detection, ordered approval, publish, and supersession remain linked.",
    },
  ];
  return (
    <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]" aria-labelledby="m42-records-title">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-950" id="m42-records-title">
          <FileStack aria-hidden="true" className="size-5 text-teal-700" />
          Governed records workspace
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {snapshot.inventory.governedDocuments} fictional records exercise the complete document lifecycle.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {cards.map(({ icon: Icon, title, value, detail }) => (
            <article className="rounded-xl border border-slate-200 bg-slate-50 p-4" key={title}>
              <div className="flex items-center justify-between gap-3">
                <Icon aria-hidden="true" className="size-4 text-teal-700" />
                <span className="text-xs font-black text-teal-900">{value}</span>
              </div>
              <h3 className="mt-3 text-sm font-bold text-slate-950">{title}</h3>
              <p className="mt-1 text-xs leading-5 text-slate-600">{detail}</p>
            </article>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-black text-slate-950">Lifecycle runbook</h3>
        <ol className="mt-4 space-y-3">
          {[
            "Register stable identity and governed metadata",
            "Permission-trim before read, download, export, or disclosure",
            "Check out the exact source-of-truth version",
            "Create a draft and route ordered human approval",
            "Publish immutably and preserve superseded history",
            "Apply retention and legal-hold controls",
          ].map((step, index) => (
            <li className="flex gap-3" key={step}>
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-teal-50 text-[10px] font-black text-teal-800">
                {index + 1}
              </span>
              <span className="pt-1 text-xs leading-4 text-slate-700">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-black text-slate-950">Role-trimmed document catalog</h3>
            <p className="mt-1 text-xs text-slate-600">
              {documents
                ? `${documents.visibleCount} of ${documents.totalCount} fictional records are visible to ${documents.requestedBy.role}.`
                : "Loading the signed-in role's governed document view."}
            </p>
          </div>
          {documents?.permissionTrimmed && (
            <Badge className="border-amber-200 bg-amber-50 text-amber-900" variant="outline">
              Permission trimmed
            </Badge>
          )}
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {documents?.documents.map((document) => (
            <article className="rounded-xl border border-slate-200 p-3" key={document.documentId}>
              <div className="flex items-start justify-between gap-2">
                <h4 className="text-xs font-bold text-slate-950">{document.title}</h4>
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600">
                  {document.classification}
                </span>
              </div>
              <p className="mt-2 text-[10px] text-slate-500">
                {document.documentType} · {document.divisionId} · v{document.currentVersion}
              </p>
            </article>
          ))}
        </div>
        <div className="mt-5 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 lg:grid-cols-[1fr_0.7fr_auto]">
          <select
            aria-label="Governed document"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs"
            onChange={(event) => setSelectedDocument(event.target.value)}
            value={effectiveDocument}
          >
            {documents?.documents.map((document) => (
              <option key={document.documentId} value={document.documentId}>
                {document.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Document action"
            className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs"
            onChange={(event) =>
              setSelectedAction(
                event.target.value as typeof selectedAction,
              )
            }
            value={selectedAction}
          >
            <option value="metadata_read">Read metadata</option>
            <option value="content_read">Read content</option>
            <option value="download">Evaluate download</option>
            <option value="export">Evaluate export</option>
            <option value="disclose">Attempt disclosure</option>
          </select>
          <Button
            disabled={isEvaluating || !effectiveDocument}
            onClick={() => onEvaluate(effectiveDocument, selectedAction)}
            type="button"
          >
            {isEvaluating && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            Evaluate action
          </Button>
        </div>
        {actionResult && (
          <div
            className={cn(
              "mt-3 rounded-xl border p-3 text-xs",
              actionResult.allowed
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900",
            )}
          >
            <p className="font-black">
              {actionResult.allowed ? "Allowed" : "Denied"} · {actionResult.action}
            </p>
            <p className="mt-1 leading-5">
              {actionResult.reasonCodes.length > 0
                ? actionResult.reasonCodes.join(" · ")
                : "All pre-disclosure checks passed for the signed-in synthetic role."}
            </p>
          </div>
        )}
        {snapshot.viewer.canRunIntegratedScenario && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
            <div>
              <p className="text-xs font-black text-slate-950">Interactive version-control run</p>
              <p className="mt-1 text-[11px] text-slate-600">
                Checkout, check-in, ordered approval, publish, and supersession under the signed-in reviewer.
              </p>
            </div>
            <Button disabled={isRunningVersion} onClick={onRunVersion} type="button" variant="outline">
              {isRunningVersion ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <History aria-hidden="true" className="size-4" />}
              Run version demo
            </Button>
          </div>
        )}
        {versionResult && (
          <div className="mt-3 rounded-xl border border-teal-200 bg-teal-50 p-3 text-xs text-teal-950">
            <p className="font-black">
              Source of truth advanced to v{versionResult.currentVersion}
            </p>
            <p className="mt-1">
              {versionResult.versions.length} immutable history entries · {versionResult.auditEventCount} audit events · {versionResult.validationErrors.length} validation errors
            </p>
          </div>
        )}
      </div>
      </section>
  );
}

function SearchForm({
  label,
  placeholder,
  defaultValue,
  busy,
  onSubmit,
}: {
  label: string;
  placeholder: string;
  defaultValue: string;
  busy: boolean;
  onSubmit: (query: string) => void;
}) {
  const [query, setQuery] = useState(defaultValue);
  const inputId = `m42-${label.split(" ").join("-").toLowerCase()}`;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (query.trim().length >= 2) onSubmit(query.trim());
  };
  return (
    <form className="mt-4 flex gap-2" onSubmit={submit}>
      <label className="sr-only" htmlFor={inputId}>
        {label}
      </label>
      <div className="relative flex-1">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <input
          className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-950 outline-none transition focus:border-teal-600 focus:ring-2 focus:ring-teal-100"
          id={inputId}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={placeholder}
          value={query}
        />
      </div>
      <Button disabled={busy || query.trim().length < 2} type="submit">
        {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Search aria-hidden="true" className="size-4" />}
        Search
      </Button>
    </form>
  );
}

function SearchWorkspace({
  documentResult,
  nilResult,
  isSearchingDocuments,
  isSearchingNil,
  onSearchDocuments,
  onSearchNil,
}: {
  documentResult: M42DocumentSearchResult | null;
  nilResult: M42NilSearchResult | null;
  isSearchingDocuments: boolean;
  isSearchingNil: boolean;
  onSearchDocuments: (query: string) => void;
  onSearchNil: (query: string) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2" aria-label="Search and Networked Intelligence Library">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <FileSearch aria-hidden="true" className="size-5 text-teal-700" />
              Enterprise document search
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Full text and metadata retrieval over the approved fictional corpus.
            </p>
          </div>
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800" variant="outline">
            &lt;3 sec target
          </Badge>
        </div>
        <SearchForm
          busy={isSearchingDocuments}
          defaultValue="retention governance"
          label="Document search"
          onSubmit={onSearchDocuments}
          placeholder="Search policies, procedures, or metadata"
        />
        <div className="mt-4 space-y-2" aria-live="polite">
          {documentResult?.results.slice(0, 6).map((result) => (
            <article className="rounded-xl border border-slate-200 p-3" key={result.documentId}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-950">{result.title}</h3>
                  <p className="mt-1 text-[10px] text-slate-500">
                    {result.citation.sourceOfTruthId} · v{result.citation.sourceVersion} · {result.citation.sourceFragment}
                  </p>
                </div>
                <span className="rounded bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-700">
                  {result.score.toFixed(2)}
                </span>
              </div>
            </article>
          ))}
          {!documentResult && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Run a query to inspect permission-trimmed results and source citations.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-black text-slate-950">
              <LibraryBig aria-hidden="true" className="size-5 text-indigo-700" />
              Networked Intelligence Library
            </h2>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Deterministic concept retrieval with permission trimming before scoring.
            </p>
          </div>
          <Badge className="border-indigo-200 bg-indigo-50 text-indigo-800" variant="outline">
            93.33% proven
          </Badge>
        </div>
        <SearchForm
          busy={isSearchingNil}
          defaultValue="youth continuum transition"
          label="NIL search"
          onSubmit={onSearchNil}
          placeholder="Ask for governed organizational knowledge"
        />
        <div className="mt-4 space-y-2" aria-live="polite">
          {nilResult?.results.map((result) => (
            <article className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3" key={result.documentId}>
              <div className="flex items-start gap-3">
                <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-indigo-600" />
                <div>
                  <h3 className="text-xs font-bold text-slate-950">{result.title}</h3>
                  <p className="mt-1 text-[10px] text-slate-600">
                    Concepts: {result.matchedConcepts.join(", ") || "lexical match"}
                  </p>
                  <p className="mt-1 text-[10px] text-indigo-700">
                    {result.citation.sourceOfTruthId} · {result.citation.sourceFragment}
                  </p>
                </div>
              </div>
            </article>
          ))}
          {!nilResult && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Search the frozen knowledge set to inspect concepts, ranking, and citations.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function ReportWorkspace({
  scenario,
  fields,
  demoResult,
  isRunning,
  onRun,
}: {
  scenario: M42ScenarioResult | null;
  fields: M42ReportFields | null;
  demoResult: M42ReportDemoResult | null;
  isRunning: boolean;
  onRun: () => void;
}) {
  const execution = demoResult?.execution ?? scenario?.reporting.execution;
  return (
    <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]" aria-labelledby="m42-report-title">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-950" id="m42-report-title">
          <BarChart3 aria-hidden="true" className="size-5 text-teal-700" />
          Governed T2+ report builder
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Saved definitions are immutable, versioned, permission-aware, and traceable to a source.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {[
            ["Field security", "Unauthorized fields are concealed before row selection."],
            ["Validated filters", "Operators and value types are checked before save."],
            ["Source lineage", "Every field and citation retains source and version identity."],
            ["Controlled export", "A content-hashed manifest is produced without delivery or live writes."],
          ].map(([title, detail]) => (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={title}>
              <p className="text-xs font-black text-slate-950">{title}</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-600">{detail}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black text-slate-950">
                Signed-in field catalog · {fields?.length ?? 0} authorized
              </p>
              <p className="mt-1 text-[11px] text-slate-600">
                {fields?.map((field) => field.label).join(" · ") || "Loading authorized fields"}
              </p>
            </div>
            <Button disabled={isRunning} onClick={onRun} type="button">
              {isRunning ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <BarChart3 aria-hidden="true" className="size-4" />}
              Run report demo
            </Button>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-teal-300">Latest scenario execution</p>
        <h3 className="mt-2 text-base font-black">
          {demoResult?.definition.title ?? scenario?.reporting.definition.title ?? "Run the report demo"}
        </h3>
        <dl className="mt-5 grid grid-cols-2 gap-3">
          {[
            ["Rows", execution?.rowCount ?? "—"],
            ["Visible fields", execution?.selectedFieldIds.length ?? "—"],
            ["Concealed", execution?.concealedFieldIds.length ?? "—"],
            ["Definition", demoResult?.definition.version ?? scenario?.reporting.definition.version ?? "—"],
          ].map(([label, value]) => (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3" key={label}>
              <dt className="text-[10px] uppercase tracking-wide text-slate-400">{label}</dt>
              <dd className="mt-1 text-xl font-black">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 flex items-center gap-2 text-xs text-slate-300">
          <ShieldCheck aria-hidden="true" className="size-4 text-emerald-400" />
          {demoResult || scenario
            ? "Manifest-only export verified; no recipient or repository write."
            : "Scenario evidence will appear here after execution."}
        </p>
      </div>
    </section>
  );
}

function AdminWorkspace({
  snapshot,
  scenario,
  schemas,
  demoResult,
  isRunning,
  onRun,
}: {
  snapshot: M42Snapshot;
  scenario: M42ScenarioResult | null;
  schemas: M42ConfigurationSchemas | null;
  demoResult: M42ConfigurationDemoResult | null;
  isRunning: boolean;
  onRun: (configKey?: string) => void;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const effectiveKey = selectedKey || schemas?.[0]?.configKey || "";
  return (
    <section className="grid gap-4 lg:grid-cols-3" aria-labelledby="m42-admin-title">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
        <h2 className="flex items-center gap-2 text-lg font-black text-slate-950" id="m42-admin-title">
          <Settings2 aria-hidden="true" className="size-5 text-teal-700" />
          No-code configuration administration
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {snapshot.inventory.configurationSchemas} schema-driven settings are available through least-privilege controls.
        </p>
        <div className="mt-5 flex flex-col gap-2">
          {[
            ["1", "Preview", "Validate type, range, allowed values, purpose, and current version without mutation."],
            ["2", "Approve", "Route approval-required changes to an authorized human with self-approval blocked."],
            ["3", "Apply", "Create a new immutable version and append its audit event."],
            ["4", "Rollback", "Restore a prior value by creating another approved version—history is never replaced."],
          ].map(([number, title, detail]) => (
            <div className="flex gap-3 rounded-xl border border-slate-200 p-3" key={number}>
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-xs font-black text-teal-800">{number}</span>
              <div>
                <p className="text-xs font-black text-slate-950">{title}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">{detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4">
          <select
            aria-label="Configuration schema"
            className="h-10 min-w-64 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs"
            onChange={(event) => setSelectedKey(event.target.value)}
            value={effectiveKey}
          >
            {schemas?.map((schema) => (
              <option key={schema.configKey} value={schema.configKey}>
                {schema.label} · {schema.domain}
              </option>
            ))}
          </select>
          <Button
            disabled={isRunning || !effectiveKey}
            onClick={() => onRun(effectiveKey)}
            type="button"
          >
            {isRunning ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Settings2 aria-hidden="true" className="size-4" />}
            Run change + rollback
          </Button>
        </div>
      </div>
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <Undo2 aria-hidden="true" className="size-6 text-emerald-700" />
        <h3 className="mt-3 text-sm font-black text-emerald-950">Rollback proof</h3>
        <p className="mt-2 text-xs leading-5 text-emerald-900">
          {demoResult
            ? `Version ${demoResult.rollback.version.version} restored ${demoResult.schema.label} as a new ${demoResult.rollback.version.changeType} record.`
            : scenario
              ? `Version ${scenario.administration.rollback.version.version} restored the baseline as a new ${scenario.administration.rollback.version.changeType} record.`
            : "Run the integrated scenario to prove change, approval, append-only history, and rollback."}
        </p>
        <div className="mt-4 rounded-xl border border-emerald-200 bg-white/70 p-3 text-xs font-bold text-emerald-900">
          Live connector mutation: {demoResult || scenario ? "0" : "unavailable"}
        </div>
      </div>
    </section>
  );
}

function ScenarioLab({
  acceptance,
  scenario,
  isRunning,
  onRun,
}: {
  acceptance: M42AcceptanceStatus | null;
  scenario: M42ScenarioResult | null;
  isRunning: boolean;
  onRun: () => void;
}) {
  const flags = scenario?.acceptanceFlags ?? acceptance?.acceptanceFlags ?? [];
  return (
    <section className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]" aria-labelledby="m42-scenario-title">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <FlaskConical aria-hidden="true" className="size-7 text-teal-700" />
        <h2 className="mt-3 text-lg font-black text-slate-950" id="m42-scenario-title">
          Integrated acceptance scenario
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Run all eight controls as one deterministic fictional workflow—from record registration through cited retrieval, reporting, and rollback.
        </p>
        <Button className="mt-5 w-full" disabled={isRunning} onClick={onRun} type="button">
          {isRunning ? (
            <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          ) : (
            <FlaskConical aria-hidden="true" className="size-4" />
          )}
          {isRunning ? "Running 8-control scenario" : "Run integrated scenario"}
        </Button>
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] leading-5 text-amber-900">
          The run uses fictional records only and cannot disclose, dispose, deploy, push, or mutate a live connector.
        </div>
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-black text-slate-950">Acceptance ledger</h3>
          <Badge
            className={cn(
              "border",
              flags.length === 8 && flags.every((flag) => flag.passed)
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}
            variant="outline"
          >
            {flags.filter((flag) => flag.passed).length}/8 passed
          </Badge>
        </div>
        <div className="mt-4 space-y-2">
          {flags.map((flag) => (
            <details className="rounded-xl border border-slate-200 p-3" key={flag.criterionId}>
              <summary className="flex cursor-pointer list-none items-start gap-2">
                {flag.passed ? (
                  <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                ) : (
                  <FileClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-amber-600" />
                )}
                <span className="flex-1 text-xs font-bold text-slate-950">{flag.criterionId} · {flag.summary}</span>
                <span className="text-[10px] font-bold text-slate-500">{flag.assertionCount}</span>
              </summary>
              <p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500">
                Evidence: {flag.evidenceIds.join(", ")}
              </p>
            </details>
          ))}
          {flags.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-xs text-slate-500">
              Acceptance evidence is loading.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function M42DocumentKnowledgeView(props: M42DocumentKnowledgeViewProps) {
  const [tab, setTab] = useState<WorkspaceTab>("overview");
  if (props.state === "loading" || !props.snapshot) return <LoadingState />;
  if (props.state === "error")
    return <ErrorState message={props.errorMessage} onRetry={props.onRefresh} />;
  const snapshot = props.snapshot;
  const visibleTabs = TABS.filter(({ id }) => {
    if (id === "reports") return snapshot.viewer.canBuildReports;
    if (id === "admin")
      return snapshot.viewer.canAdministerConfiguration;
    if (id === "validation")
      return snapshot.viewer.canRunIntegratedScenario;
    return true;
  });

  return (
    <main className="space-y-4 p-4 pb-10 md:p-6">
      <Hero
        acceptance={props.acceptance}
        isRefreshing={props.isRefreshing}
        onRefresh={props.onRefresh}
        scenarioResult={props.scenarioResult}
        snapshot={props.snapshot}
      />
      <nav
        aria-label="M4.2 workspace sections"
        className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
      >
        <div className="flex min-w-max gap-1">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              aria-current={tab === id ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600",
                tab === id
                  ? "bg-teal-700 text-white shadow-sm"
                  : "text-slate-600 hover:bg-teal-50 hover:text-teal-900",
              )}
              key={id}
              onClick={() => setTab(id)}
              type="button"
            >
              <Icon aria-hidden="true" className="size-3.5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
      {tab === "overview" && (
        <ControlMap acceptance={props.acceptance} snapshot={props.snapshot} />
      )}
      {tab === "records" && (
        <RecordsWorkspace
          actionResult={props.documentActionResult}
          documents={props.governedDocuments}
          isEvaluating={props.isEvaluatingDocument}
          isRunningVersion={props.isRunningVersionDemo}
          onEvaluate={props.onEvaluateDocument}
          onRunVersion={props.onRunVersionDemo}
          scenario={props.scenarioResult}
          snapshot={props.snapshot}
          versionResult={props.versionDemoResult}
        />
      )}
      {tab === "search" && (
        <SearchWorkspace
          documentResult={props.documentSearchResult}
          isSearchingDocuments={props.isSearchingDocuments}
          isSearchingNil={props.isSearchingNil}
          nilResult={props.nilSearchResult}
          onSearchDocuments={props.onSearchDocuments}
          onSearchNil={props.onSearchNil}
        />
      )}
      {tab === "reports" && props.snapshot.viewer.canBuildReports && (
        <ReportWorkspace
          demoResult={props.reportDemoResult}
          fields={props.reportFields}
          isRunning={props.isRunningReportDemo}
          onRun={props.onRunReportDemo}
          scenario={props.scenarioResult}
        />
      )}
      {tab === "admin" && (
        <AdminWorkspace
          demoResult={props.configurationDemoResult}
          isRunning={props.isRunningConfigurationDemo}
          onRun={props.onRunConfigurationDemo}
          scenario={props.scenarioResult}
          schemas={props.configurationSchemas}
          snapshot={props.snapshot}
        />
      )}
      {tab === "validation" && (
        <ScenarioLab
          acceptance={props.acceptance}
          isRunning={props.isRunningScenario}
          onRun={props.onRunScenario}
          scenario={props.scenarioResult}
        />
      )}
      <footer className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-[10px] text-slate-500">
        <span className="flex items-center gap-1.5 font-bold text-slate-700">
          <BookOpenCheck aria-hidden="true" className="size-3.5 text-teal-700" />
          AMOS-OPS · M4.2 Document and Knowledge Management Operational
        </span>
        <span>{props.snapshot.boundary.environmentLabel}</span>
      </footer>
    </main>
  );
}
