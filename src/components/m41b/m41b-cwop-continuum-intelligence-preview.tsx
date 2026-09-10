import type {
  CypressS7PreviewResult,
  CypressS7PreviewScenario,
} from "@contracts/doctrine/cypress-cwop-continuum-intelligence";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BadgeDollarSign,
  CheckCircle2,
  FileCheck2,
  Gauge,
  RefreshCw,
  Scale,
  ShieldCheck,
  TrendingUp,
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
import { cn } from "@/lib/utils";
import { trpc } from "@/providers/trpc";

const SCENARIOS: ReadonlyArray<{
  id: CypressS7PreviewScenario;
  label: string;
  description: string;
}> = [
  {
    id: "continuum_outcomes_only",
    label: "Continuum outcomes",
    description: "Track before/during/outcome stability without inventing dollar savings.",
  },
  {
    id: "validated_value_case",
    label: "Validated value case",
    description: "Validated partner cost evidence supports a bounded negotiation comparison.",
  },
  {
    id: "unsupported_savings_claim_blocked",
    label: "Unsupported savings blocked",
    description: "A dollar claim is withheld when source evidence is not validated.",
  },
  {
    id: "executive_trend_referral_declines",
    label: "Repeated referral declines",
    description: "Repeated target-population declines become an ownership decision case.",
  },
  {
    id: "executive_trend_low_census",
    label: "Low census trend",
    description: "Verified underutilization is routed for reserved business action.",
  },
  {
    id: "executive_trend_rate_drift",
    label: "Rate drift",
    description: "Material rate drift is escalated without silently changing doctrine.",
  },
];

function OutcomeBadge({ result }: { result: CypressS7PreviewResult }) {
  const pass =
    result.outcome === "CONTINUUM_TRACKING_ACTIVE" ||
    result.outcome === "VALUE_EVIDENCE_READY";
  const review = result.outcome === "EXECUTIVE_DECISION_CASE_CREATED";
  return (
    <Badge
      className={cn(
        pass
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : review
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-rose-300 bg-rose-50 text-rose-800",
      )}
      variant="outline"
    >
      {pass ? (
        <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
      ) : (
        <AlertTriangle aria-hidden="true" className="mr-1 size-3" />
      )}
      {result.outcome.replace(/_/g, " ")}
    </Badge>
  );
}

export function M41bCwopContinuumIntelligencePreview() {
  const [scenario, setScenario] =
    useState<CypressS7PreviewScenario>("continuum_outcomes_only");
  const status = trpc.m2.cwopContinuumIntelligenceStatus.useQuery();
  const preview = trpc.m2.cwopContinuumIntelligencePreview.useQuery({ scenario });
  const result = preview.data ?? null;

  return (
    <Card className="overflow-hidden border-violet-200 shadow-sm">
      <CardHeader className="border-b border-violet-100 bg-gradient-to-r from-slate-950 via-violet-950 to-slate-900 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-violet-300/30 bg-violet-300/10 text-violet-100" variant="outline">
                <TrendingUp aria-hidden="true" className="mr-1 size-3" />
                S7 CWOP Continuum Intelligence
              </Badge>
              <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100" variant="outline">
                Synthetic control surface · no PHI
              </Badge>
            </div>
            <CardTitle className="mt-3 text-xl text-white">
              Ask AMOS · CWOP Continuum & Value Evidence
            </CardTitle>
            <CardDescription className="mt-2 max-w-4xl text-slate-300">
              Track before/during/outcome stability, enforce source-gated avoided-cost evidence, and convert verified decline/census/rate trends into governed ownership decision cases.
            </CardDescription>
          </div>
          <Button
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            disabled={preview.isFetching}
            onClick={() => void preview.refetch()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw aria-hidden="true" className={cn("size-4", preview.isFetching && "animate-spin")} />
            Re-evaluate
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 md:p-5">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {SCENARIOS.map((option) => (
            <button
              aria-pressed={scenario === option.id}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                scenario === option.id
                  ? "border-violet-600 bg-violet-50 ring-1 ring-violet-200"
                  : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
              )}
              key={option.id}
              onClick={() => setScenario(option.id)}
              type="button"
            >
              <p className="text-xs font-bold text-slate-900">{option.label}</p>
              <p className="mt-1 text-[11px] leading-4 text-slate-500">{option.description}</p>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <ShieldCheck aria-hidden="true" className="size-4 text-violet-700" />
            S7 evidence boundary
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            {status.data?.message ?? "Checking the S7 evidence boundary…"}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-amber-700">
            Strategic CWOP agreements and material rate posture remain reserved to Governing Body/Ownership. S8 and production promotion are not authorized.
          </p>
        </div>

        {preview.isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Evaluating continuum evidence, source validity, and executive trend routing…
          </div>
        ) : null}

        {preview.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            The S7 synthetic control surface could not be rendered: {preview.error.message}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-violet-700">
                    S7 controlled result
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{result.title}</h3>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{result.testCaseId}</p>
                </div>
                <OutcomeBadge result={result} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{result.summary}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <Activity className="size-3" /> Continuum
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">3 evidence phases</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <BadgeDollarSign className="size-3" /> Dollar claim
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {result.valueMeasurement.dollarClaimAllowed ? "SOURCE SUPPORTED" : "WITHHELD"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <Scale className="size-3" /> Negotiation case
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {result.negotiationCase.ready ? "READY" : "NOT READY"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <Gauge className="size-3" /> Executive case
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {result.executiveDecisionCase.created ? "ROUTED" : "NONE"}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                Before → During → Outcome continuum
              </p>
              <div className="grid gap-3 lg:grid-cols-3">
                {result.continuum.map((row, index) => (
                  <div className="flex items-stretch gap-2" key={row.phase}>
                    <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4">
                      <p className="text-[10px] font-black uppercase tracking-wide text-violet-700">
                        {row.phase.replace(/_/g, " ")}
                      </p>
                      <div className="mt-3 space-y-1 text-[11px] leading-5 text-slate-600">
                        <p>Hospital/ED: <strong>{row.hospitalOrEdEpisodes ?? "—"}</strong></p>
                        <p>Placement searches: <strong>{row.placementSearches ?? "—"}</strong></p>
                        <p>Stability days: <strong>{row.stabilityDays ?? "—"}</strong></p>
                        <p>Placement maintained: <strong>{row.placementMaintained === null ? "—" : row.placementMaintained ? "YES" : "NO"}</strong></p>
                        <p>Evidence refs: <strong>{row.evidenceRefs.length}</strong></p>
                      </div>
                    </div>
                    {index < result.continuum.length - 1 ? (
                      <ArrowRight className="mt-10 hidden size-4 shrink-0 text-violet-400 lg:block" />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-violet-900">
                  <FileCheck2 className="size-4" /> Value evidence discipline
                </p>
                <p className="mt-3 text-[11px] leading-5 text-slate-700">
                  {result.valueMeasurement.reason}
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[9px] uppercase text-slate-500">Validated sources</p>
                    <p className="font-black">{result.valueSources.filter((row) => row.validated).length}</p>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <p className="text-[9px] uppercase text-slate-500">Avoided-cost demo</p>
                    <p className="font-black">
                      {result.valueMeasurement.estimatedAvoidedCost === null
                        ? "WITHHELD"
                        : `$${result.valueMeasurement.estimatedAvoidedCost.toLocaleString()}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className={cn(
                "rounded-xl border p-4",
                result.executiveDecisionCase.created
                  ? "border-amber-200 bg-amber-50"
                  : "border-slate-200 bg-white",
              )}>
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-800">
                  <TrendingUp className="size-4 text-amber-700" /> Executive decision routing
                </p>
                <p className="mt-3 text-[11px] leading-5 text-slate-700">
                  {result.executiveDecisionCase.observation}
                </p>
                {result.executiveDecisionCase.decisionQuestion ? (
                  <p className="mt-3 rounded-lg border border-amber-200 bg-white p-3 text-[11px] font-semibold leading-5 text-amber-950">
                    {result.executiveDecisionCase.decisionQuestion}
                  </p>
                ) : null}
                <p className="mt-2 text-[9px] font-semibold text-slate-500">
                  Evidence refs: {result.executiveDecisionCase.evidenceRefs.length} · Reserved authority: {result.executiveDecisionCase.reservedAuthority}
                </p>
              </div>
            </div>

            {result.exceptions.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-900">Control exceptions / review routes</p>
                <div className="mt-3 space-y-2">
                  {result.exceptions.map((row) => (
                    <div className="rounded-lg border border-amber-200 bg-white p-3" key={row.code}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[10px] font-black text-amber-950">{row.code}</p>
                        <Badge variant="outline">{row.disposition}</Badge>
                      </div>
                      <p className="mt-1 text-[10px] leading-4 text-slate-600">{row.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-950 p-4 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.12em] text-violet-200">Exact next action</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">{result.exactNextAction}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
