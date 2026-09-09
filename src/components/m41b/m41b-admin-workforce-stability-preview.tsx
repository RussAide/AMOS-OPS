import type {
  CypressS6PreviewResult,
  CypressS6PreviewScenario,
} from "@contracts/doctrine/cypress-admin-workforce-stability";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  HeartPulse,
  Hospital,
  RefreshCw,
  ShieldCheck,
  UserCog,
  UsersRound,
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
  id: CypressS6PreviewScenario;
  label: string;
  description: string;
}> = [
  {
    id: "administrator_ready",
    label: "Administrator ready",
    description: "Five role-based benchmarks and workforce readiness are evidenced.",
  },
  {
    id: "administrator_benchmark_exception",
    label: "Benchmark exception",
    description: "A missed Administrator benchmark becomes a corrective-action case.",
  },
  {
    id: "workforce_clearance_gap",
    label: "Workforce clearance gap",
    description: "Incomplete clearance and inadequate present staffing hold release to duty.",
  },
  {
    id: "hospitalization_return",
    label: "Hospitalization → return",
    description: "Preserve placement, modify supports, verify return capability, and return safely.",
  },
  {
    id: "automatic_discharge_blocked",
    label: "Automatic discharge blocked",
    description: "Hospitalization cannot skip reassessment, support revision, or return review.",
  },
  {
    id: "justified_discharge_after_review",
    label: "Justified discharge",
    description: "Discharge only after the full continuity review shows safe return is not supportable.",
  },
];

function OutcomeBadge({ result }: { result: CypressS6PreviewResult }) {
  const pass =
    result.outcome === "ADMIN_WORKFORCE_READY" ||
    result.outcome === "RETURN_SUPPORTED" ||
    result.outcome === "JUSTIFIED_DISCHARGE_ALLOWED";
  const review = result.outcome === "ADMIN_CORRECTIVE_ACTION_REQUIRED";
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

export function M41bAdminWorkforceStabilityPreview() {
  const [scenario, setScenario] =
    useState<CypressS6PreviewScenario>("administrator_ready");
  const status = trpc.m2.adminWorkforceStabilityStatus.useQuery();
  const preview = trpc.m2.adminWorkforceStabilityPreview.useQuery({ scenario });
  const result = preview.data ?? null;

  return (
    <Card className="overflow-hidden border-cyan-200 shadow-sm">
      <CardHeader className="border-b border-cyan-100 bg-gradient-to-r from-slate-950 via-cyan-950 to-slate-900 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100" variant="outline">
                <UserCog aria-hidden="true" className="mr-1 size-3" />
                S6 Administrator / Workforce / Stability
              </Badge>
              <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100" variant="outline">
                Synthetic control surface · no PHI
              </Badge>
            </div>
            <CardTitle className="mt-3 text-xl text-white">
              Ask AMOS · Cypress Leadership & Placement Continuity
            </CardTitle>
            <CardDescription className="mt-2 max-w-4xl text-slate-300">
              Apply the approved Administrator scorecard, M3.3 workforce readiness, M2.4 staffing evaluation, and the crisis → stabilize → reassess → modify supports → return-capability → return/justify doctrine.
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
                  ? "border-cyan-600 bg-cyan-50 ring-1 ring-cyan-200"
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
            <ShieldCheck aria-hidden="true" className="size-4 text-cyan-700" />
            S6 command boundary
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            {status.data?.message ?? "Checking the S6 command boundary…"}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-amber-700">
            Browser-native implementation exists in this controlled branch; it is not counted as successful user-facing preview evidence until Eghosa actually experiences it through a working review runtime.
          </p>
        </div>

        {preview.isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Evaluating Administrator benchmarks, workforce readiness, staffing, and placement continuity…
          </div>
        ) : null}

        {preview.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            The S6 synthetic control surface could not be rendered: {preview.error.message}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-cyan-700">
                    S6 controlled result
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
                    <ClipboardCheck className="size-3" /> Admin benchmarks
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {result.administratorBenchmarks.filter((row) => row.state === "MEETS").length}/5 meet
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <UsersRound className="size-3" /> Workforce
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {result.workforce.releaseToDutyAllowed ? "RELEASE READY" : "HELD"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <ShieldCheck className="size-3" /> Staffing
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {result.staffing.compliant ? "COMPLIANT" : "INSUFFICIENT"}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <HeartPulse className="size-3" /> Stability
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    {result.placementContinuity.underlyingPlacementStatus}
                  </p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                  Administrator scorecard · role based
                </p>
                <Badge variant="outline">Not coded around one individual</Badge>
              </div>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                {result.administratorBenchmarks.map((row) => (
                  <div
                    className={cn(
                      "rounded-xl border p-3",
                      row.state === "MEETS"
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-amber-300 bg-amber-50",
                    )}
                    key={row.id}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900">{row.label}</p>
                      <Badge className="text-[9px]" variant="outline">{row.state}</Badge>
                    </div>
                    <p className="mt-2 text-[10px] leading-4 text-slate-600">{row.actual}</p>
                    <p className="mt-2 text-[9px] font-semibold text-slate-500">Evidence: {row.evidenceRefs.length}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                  <UsersRound className="size-4 text-cyan-700" /> Workforce fit & clearance
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {result.workforce.competencies.map((competency) => (
                    <div className="rounded-lg bg-slate-50 p-2" key={competency.id}>
                      <p className="text-[10px] font-bold text-slate-800">{competency.id.replace(/_/g, " ")}</p>
                      <p className={cn("mt-1 text-[9px] font-semibold", competency.verified ? "text-emerald-700" : "text-rose-700")}>
                        {competency.verified ? "VERIFIED" : "NOT VERIFIED"}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] leading-5 text-slate-600">
                  M3.3 gates: <strong>{result.workforce.recruitmentToReleaseGatesPassed ? "PASS" : "BLOCKED"}</strong> · Credential classes: <strong>{result.workforce.credentialRequirementTypesCovered}</strong> · Annual training: <strong>{result.workforce.annualTrainingCompliant ? "COMPLIANT" : "GAP"}</strong>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700">
                  <ShieldCheck className="size-4 text-cyan-700" /> M2.4 staffing readiness
                </p>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-[9px] uppercase text-slate-500">Youth</p><p className="font-black">{result.staffing.evaluatedCensus}</p></div>
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-[9px] uppercase text-slate-500">Qualified present</p><p className="font-black">{result.staffing.qualifiedPresentStaff}</p></div>
                  <div className="rounded-lg bg-slate-50 p-3"><p className="text-[9px] uppercase text-slate-500">Result</p><p className="font-black">{result.staffing.compliant ? "PASS" : "HOLD"}</p></div>
                </div>
                {result.staffing.reasonCodes.length > 0 ? (
                  <p className="mt-3 text-[10px] font-semibold text-rose-700">{result.staffing.reasonCodes.join(" · ")}</p>
                ) : null}
              </div>
            </div>

            {result.correctiveAction.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-900">Administrator corrective-action workflow</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {result.correctiveAction.map((step, index) => (
                    <div className="flex items-center gap-2" key={step.id}>
                      <div className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                        <p className="text-[9px] font-bold text-amber-950">{step.id.replace(/_/g, " ")}</p>
                        <p className="mt-1 text-[9px] font-semibold text-amber-700">{step.state}</p>
                      </div>
                      {index < result.correctiveAction.length - 1 ? <ArrowRight className="size-3 text-amber-500" /> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {result.placementContinuity.steps.length > 0 ? (
              <div className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cyan-950">
                    <Hospital className="size-4" /> Placement stability continuity chain
                  </p>
                  <Badge variant="outline">Automatic discharge: PROHIBITED</Badge>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {result.placementContinuity.steps.map((step) => (
                    <div
                      className={cn(
                        "rounded-xl border p-3",
                        step.state === "COMPLETE"
                          ? "border-emerald-200 bg-white"
                          : step.state === "BLOCKED"
                            ? "border-rose-300 bg-rose-50"
                            : "border-slate-200 bg-slate-50",
                      )}
                      key={step.id}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-black text-slate-900">{step.id.replace(/_/g, " ")}</p>
                        <Badge className="text-[9px]" variant="outline">{step.state}</Badge>
                      </div>
                      <p className="mt-2 text-[10px] leading-4 text-slate-600">{step.detail}</p>
                    </div>
                  ))}
                </div>
                {result.placementContinuity.supportChanges.length > 0 ? (
                  <div className="mt-3 rounded-lg bg-white p-3 text-[11px] leading-5 text-slate-700">
                    <strong>Support modifications:</strong> {result.placementContinuity.supportChanges.join(" · ")}
                  </div>
                ) : null}
              </div>
            ) : null}

            {result.exceptions.length > 0 ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-rose-900">Control exceptions / executive review</p>
                <div className="mt-3 space-y-3">
                  {result.exceptions.map((exception) => (
                    <div key={exception.code}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{exception.code}</Badge>
                        <Badge variant="outline">{exception.disposition}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-rose-950">{exception.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700">Synthetic audit trail</p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
                {result.audit.map((event) => (
                  <div className="rounded-xl border border-slate-200 bg-white p-3" key={event.eventId}>
                    <Badge className="text-[9px]" variant="outline">{event.status}</Badge>
                    <p className="mt-2 text-[10px] font-bold text-slate-900">{event.eventType.replace(/_/g, " ")}</p>
                    <p className="mt-1 text-[10px] leading-4 text-slate-500">{event.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-300 bg-slate-950 p-4 text-white">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-cyan-300">Exact next action</p>
              <p className="mt-2 text-sm leading-6 text-slate-100">{result.exactNextAction}</p>
              <p className="mt-2 text-[10px] font-semibold text-amber-300">
                Capacity remains {result.licensedCapacity} beds. Future {result.futureCapacity}-bed expansion and production promotion remain unauthorized.
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
