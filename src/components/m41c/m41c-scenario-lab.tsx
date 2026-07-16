import type {
  M41cSyntheticScenario,
  M41cSyntheticScenarioRunResponse,
} from "@contracts/m41c";
import {
  Ban,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  FlaskConical,
  Loader2,
  Play,
  RotateCcw,
  ShieldCheck,
  TestTubeDiagonal,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  M41C_REQUIRED_SCENARIO_KINDS,
  prettyM41cToken,
  scenarioCoverage,
  scenarioRunIsBounded,
} from "./m41c-experience-model";

function ScenarioResult({
  result,
}: {
  result: M41cSyntheticScenarioRunResponse;
}) {
  const bounded = scenarioRunIsBounded(result);
  return (
    <article
      aria-live="polite"
      className={`rounded-xl border p-4 ${
        bounded
          ? "border-emerald-200 bg-emerald-50"
          : "border-rose-200 bg-rose-50"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
            Deterministic run {result.runId}
          </p>
          <h3 className="mt-1 flex items-center gap-2 text-base font-bold text-slate-950">
            {bounded ? (
              <ShieldCheck
                aria-hidden="true"
                className="size-4 text-emerald-700"
              />
            ) : (
              <CircleAlert
                aria-hidden="true"
                className="size-4 text-rose-700"
              />
            )}
            {prettyM41cToken(result.scenarioKind)} control result
          </h3>
        </div>
        <Badge
          className={
            bounded
              ? "border-emerald-300 bg-white text-emerald-800"
              : "border-rose-300 bg-white text-rose-800"
          }
          variant="outline"
        >
          {bounded ? "Boundary passed" : "Review required"}
        </Badge>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-900">{result.summary}</p>
      <div className="mt-3 rounded-lg border border-white/80 bg-white p-3 text-xs text-slate-800">
        <p className="font-bold">Expected control</p>
        <p className="mt-1 leading-5">{result.expectedControl}</p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        <div className="rounded-lg bg-white p-2">
          <dt className="text-slate-500">Human gate</dt>
          <dd className="mt-0.5 font-black text-slate-950">
            {result.humanGateRequired ? "Required" : "Missing"}
          </dd>
        </div>
        <div className="rounded-lg bg-white p-2">
          <dt className="text-slate-500">Sources</dt>
          <dd className="mt-0.5 font-black text-slate-950">
            {result.sourceIds.length}
          </dd>
        </div>
        <div className="rounded-lg bg-white p-2">
          <dt className="text-slate-500">Evidence</dt>
          <dd className="mt-0.5 font-black text-slate-950">
            {result.evidenceIds.length}
          </dd>
        </div>
        <div className="rounded-lg bg-white p-2">
          <dt className="text-slate-500">Live writes / rows</dt>
          <dd className="mt-0.5 font-black text-rose-800">
            {result.liveWrites} / {result.productionRows}
          </dd>
        </div>
      </dl>

      <details className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
        <summary className="cursor-pointer font-bold text-slate-800">
          Evidence and audit lineage
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <div>
            <p className="font-bold text-slate-600">Sources</p>
            {result.sourceIds.map((id) => (
              <code className="mt-1 block break-all text-[10px]" key={id}>
                {id}
              </code>
            ))}
          </div>
          <div>
            <p className="font-bold text-slate-600">Evidence</p>
            {result.evidenceIds.map((id) => (
              <code className="mt-1 block break-all text-[10px]" key={id}>
                {id}
              </code>
            ))}
          </div>
          <div>
            <p className="font-bold text-slate-600">Audit events</p>
            {result.auditEventIds.map((id) => (
              <code className="mt-1 block break-all text-[10px]" key={id}>
                {id}
              </code>
            ))}
          </div>
        </div>
      </details>

      <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-100 bg-white p-3 text-xs text-rose-950">
        <Ban aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Blocked actions:{" "}
          {result.prohibitedActions.map(prettyM41cToken).join(" · ")}
        </p>
      </div>
    </article>
  );
}

export function M41cScenarioLab({
  isRunning,
  onRun,
  result,
  scenarios,
}: {
  isRunning: boolean;
  onRun: (scenarioId: string) => void;
  result: M41cSyntheticScenarioRunResponse | null;
  scenarios: readonly M41cSyntheticScenario[];
}) {
  const coverage = useMemo(() => scenarioCoverage(scenarios), [scenarios]);
  const [selectedId, setSelectedId] = useState(scenarios[0]?.id ?? "");
  const effectiveSelectedId = scenarios.some(
    (scenario) => scenario.id === selectedId,
  )
    ? selectedId
    : (scenarios[0]?.id ?? "");
  const selected =
    scenarios.find((scenario) => scenario.id === effectiveSelectedId) ??
    scenarios[0] ??
    null;

  return (
    <section aria-labelledby="m41c-scenario-title" id="scenarios">
      <Card className="border-slate-200 bg-slate-50/70">
        <CardHeader className="border-b bg-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <CardTitle
                className="flex items-center gap-2 text-lg"
                id="m41c-scenario-title"
              >
                <FlaskConical
                  aria-hidden="true"
                  className="size-5 text-teal-700"
                />
                Deterministic clinical scenario lab
              </CardTitle>
              <CardDescription className="mt-2 max-w-3xl leading-5">
                Exercise routine, incomplete, safety-positive, escalation,
                conflict, reassessment, level-of-care review, transition,
                outage, override, and recovery controls without real data or
                live writes.
              </CardDescription>
            </div>
            <Badge
              className={
                coverage.missing.length === 0
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-900"
              }
              variant="outline"
            >
              {coverage.covered.length}/{M41C_REQUIRED_SCENARIO_KINDS.length}{" "}
              required types
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-4 pb-5 pt-5 md:px-6">
          <div
            className="flex flex-wrap gap-2"
            aria-label="Required scenario coverage"
          >
            {M41C_REQUIRED_SCENARIO_KINDS.map((kind) => {
              const covered = coverage.covered.includes(kind);
              return (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                    covered
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-900"
                  }`}
                  key={kind}
                >
                  {covered ? (
                    <CheckCircle2 aria-hidden="true" className="size-3" />
                  ) : (
                    <CircleAlert aria-hidden="true" className="size-3" />
                  )}
                  {prettyM41cToken(kind)}
                </span>
              );
            })}
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(300px,0.7fr)_minmax(0,1.3fr)]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="flex items-center gap-2 text-base font-bold text-slate-950">
                <TestTubeDiagonal aria-hidden="true" className="size-4" />
                Select a server-defined scenario
              </h3>
              <label className="mt-4 block text-xs font-bold text-slate-700">
                Scenario
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  onChange={(event) => setSelectedId(event.target.value)}
                  value={selected?.id ?? ""}
                >
                  {scenarios.map((scenario) => (
                    <option key={scenario.id} value={scenario.id}>
                      {prettyM41cToken(scenario.kind)}
                    </option>
                  ))}
                </select>
              </label>
              {selected ? (
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
                  <p className="font-bold text-slate-900">Expected control</p>
                  <p className="mt-1 leading-5 text-slate-700">
                    {selected.expectedControl}
                  </p>
                  <code className="mt-2 block break-all text-[10px] text-slate-500">
                    {selected.id}
                  </code>
                </div>
              ) : (
                <div className="mt-3 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                  No server-defined synthetic scenario was returned.
                </div>
              )}
              <Button
                className="mt-4 w-full"
                disabled={!selected || isRunning}
                onClick={() => selected && onRun(selected.id)}
                type="button"
              >
                {isRunning ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : result?.scenarioId === selected?.id ? (
                  <RotateCcw aria-hidden="true" className="size-4" />
                ) : (
                  <Play aria-hidden="true" className="size-4" />
                )}
                {isRunning
                  ? "Running deterministic controls"
                  : result?.scenarioId === selected?.id
                    ? "Run scenario again"
                    : "Run selected scenario"}
              </Button>
              <p className="mt-2 text-center text-[10px] text-slate-500">
                Input selection is local; scenario truth and result are
                server-controlled.
              </p>
            </article>

            {result ? (
              <ScenarioResult result={result} />
            ) : (
              <article className="grid min-h-72 place-items-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                <div>
                  <ClipboardList
                    aria-hidden="true"
                    className="mx-auto size-8 text-slate-400"
                  />
                  <h3 className="mt-3 font-bold text-slate-900">
                    No scenario run yet
                  </h3>
                  <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
                    Choose a governed synthetic scenario to inspect its human
                    gate, source lineage, evidence references, blocked actions,
                    and zero-write proof.
                  </p>
                </div>
              </article>
            )}
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
