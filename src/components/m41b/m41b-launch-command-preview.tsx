import type {
  CypressLaunchCommandPreviewResult,
  CypressLaunchPreviewScenario,
} from "@contracts/doctrine/cypress-launch-command";
import {
  AlertTriangle,
  CheckCircle2,
  Gauge,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
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
  id: CypressLaunchPreviewScenario;
  label: string;
  description: string;
}> = [
  {
    id: "controlled_baseline",
    label: "Controlled baseline",
    description: "Resolve the accepted S0-S3 chain and bounded S4 command posture.",
  },
  {
    id: "future_capacity_blocked",
    label: "16-bed expansion",
    description: "Show why future capacity cannot supersede the 10-bed controller.",
  },
  {
    id: "runtime_dependency",
    label: "Live-runtime dependency",
    description: "Test production-readiness claims against the open Graph probe dependency.",
  },
  {
    id: "authority_conflict",
    label: "Authority conflict",
    description: "Competing current doctrine controllers force a fail-closed result.",
  },
  {
    id: "calendar_bypass_blocked",
    label: "Calendar bypass",
    description: "Attempting to jump to L12 without L6-L11 evidence is blocked.",
  },
];

function OutcomeBadge({ result }: { result: CypressLaunchCommandPreviewResult }) {
  const ready = result.outcome === "READY_FOR_AUTHORIZED_LEVEL";
  return (
    <Badge
      className={cn(
        ready
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : "border-rose-300 bg-rose-50 text-rose-800",
      )}
      variant="outline"
    >
      {ready ? (
        <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
      ) : (
        <AlertTriangle aria-hidden="true" className="mr-1 size-3" />
      )}
      {result.outcome.replace(/_/g, " ")}
    </Badge>
  );
}

function GateGrid({ result }: { result: CypressLaunchCommandPreviewResult }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {result.gates.map((gate) => {
        const ready = gate.state === "VERIFIED_READY";
        const blocked = gate.state === "BLOCKED";
        return (
          <div
            className={cn(
              "rounded-xl border p-3",
              ready
                ? "border-emerald-200 bg-emerald-50/60"
                : blocked
                  ? "border-rose-200 bg-rose-50/70"
                  : "border-slate-200 bg-slate-50",
            )}
            key={gate.level}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                  {gate.level}
                </p>
                <p className="mt-1 text-xs font-bold text-slate-900">{gate.title}</p>
              </div>
              <Badge className="text-[9px]" variant="outline">
                {gate.state.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-2 text-[10px] leading-4 text-slate-600">
              {gate.evidence[0]}
            </p>
            {gate.blockers[0] ? (
              <p className="mt-2 text-[10px] font-semibold leading-4 text-rose-700">
                {gate.blockers[0]}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Trace({ result }: { result: CypressLaunchCommandPreviewResult }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {result.trace.map((entry, index) => (
        <div
          className={cn(
            "rounded-xl border p-3",
            entry.status === "PASS"
              ? "border-teal-200 bg-teal-50/60"
              : entry.status === "BLOCKED"
                ? "border-rose-200 bg-rose-50/70"
                : "border-slate-200 bg-slate-50",
          )}
          key={`${entry.step}-${index}`}
        >
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
            {index + 1}. {entry.step}
          </p>
          <p className="mt-1 text-xs font-bold text-slate-900">{entry.status}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-600">{entry.detail}</p>
        </div>
      ))}
    </div>
  );
}

export function M41bLaunchCommandPreview() {
  const [scenario, setScenario] =
    useState<CypressLaunchPreviewScenario>("controlled_baseline");
  const status = trpc.m2.launchCommandStatus.useQuery();
  const preview = trpc.m2.launchCommandPreview.useQuery({ scenario });
  const result = preview.data ?? null;

  return (
    <Card className="overflow-hidden border-indigo-200 shadow-sm">
      <CardHeader className="border-b border-indigo-100 bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-900 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-indigo-300/30 bg-indigo-300/10 text-indigo-100" variant="outline">
                <Gauge aria-hidden="true" className="mr-1 size-3" />
                S4 Launch Command / Doctrine
              </Badge>
              <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100" variant="outline">
                <Sparkles aria-hidden="true" className="mr-1 size-3" />
                Synthetic preview · no PHI
              </Badge>
            </div>
            <CardTitle className="mt-3 text-xl text-white">
              Ask AMOS · Cypress Launch Command
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-slate-300">
              Resolve the controlling launch doctrine, capability chain, exceptions, and exact next action without promoting the sprint branch or claiming live production readiness.
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
            Refresh posture
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 md:p-5">
        <div className="grid gap-2 lg:grid-cols-5">
          {SCENARIOS.map((option) => (
            <button
              aria-pressed={scenario === option.id}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                scenario === option.id
                  ? "border-indigo-600 bg-indigo-50 ring-1 ring-indigo-200"
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

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShieldCheck aria-hidden="true" className="size-4 text-indigo-700" />
              Command boundary
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              {status.data?.message ?? "Checking the S4 command boundary…"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <Target aria-hidden="true" className="size-4 text-teal-700" />
              Controlling launch capacity
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              10 beds. Sixteen beds remains future expansion and cannot activate without regulatory approval and express authorization.
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <LockKeyhole aria-hidden="true" className="size-4 text-amber-700" />
              Production promotion
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              NOT AUTHORIZED. This preview cannot merge main, alter SharePoint governance, or declare live connectivity.
            </p>
          </div>
        </div>

        {preview.isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Resolving the synthetic Launch Command posture…
          </div>
        ) : null}

        {preview.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            The S4 synthetic preview could not be rendered: {preview.error.message}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">
                    Launch Command result
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{result.title}</h3>
                </div>
                <OutcomeBadge result={result} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{result.summary}</p>

              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Requested</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{result.requestedLevel}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Highest verified</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{result.highestVerifiedLevel}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Capacity request</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{result.requestedCapacity}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Rate doctrine</p>
                  <p className="mt-1 text-sm font-black text-slate-950">$450 · $550 · $650</p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">L0–L12 capability chain</p>
                <Badge variant="outline">Capability-gated · not date-gated</Badge>
              </div>
              <GateGrid result={result} />
            </div>

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700">Control trace</p>
              <Trace result={result} />
            </div>

            {result.doctrine.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {result.doctrine.map((rule) => (
                  <div className="rounded-xl border border-slate-200 bg-white p-3" key={rule.id}>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">{rule.title}</p>
                      <Badge variant="outline">CURRENT / CONTROLLING</Badge>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-600">{rule.statement}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
                No doctrine values are disclosed as controlling because the scenario contains an authority conflict.
              </div>
            )}

            {result.exceptions.length > 0 ? (
              <div className="space-y-2">
                {result.exceptions.map((exception) => (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3" key={exception.code}>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="border-rose-300 text-rose-800" variant="outline">{exception.code}</Badge>
                      <span className="text-xs font-bold text-rose-900">{exception.severity}</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-rose-800">{exception.summary}</p>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-indigo-700">Exact next action</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-indigo-950">{result.exactNextAction}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default M41bLaunchCommandPreview;
