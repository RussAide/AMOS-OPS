import type {
  CypressS5PreviewResult,
  CypressS5PreviewScenario,
} from "@contracts/doctrine/cypress-referral-acuity-rate";
import {
  Activity,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  CircleDollarSign,
  FileCheck2,
  RefreshCw,
  Scale,
  ShieldAlert,
  UserRoundCheck,
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
  id: CypressS5PreviewScenario;
  label: string;
  description: string;
}> = [
  {
    id: "high_acuity_accept",
    label: "High-acuity accept",
    description: "Evidence-backed high-acuity referral with capacity and enhanced-rate support.",
  },
  {
    id: "target_population_decline_review",
    label: "Target decline review",
    description: "Test a convenience/low-acuity decline against the placement doctrine.",
  },
  {
    id: "below_floor_rate_blocked",
    label: "Below-floor rate",
    description: "Attempt acceptance below the controlled $450 daily operating floor.",
  },
  {
    id: "capacity_full_hold",
    label: "10-bed capacity full",
    description: "Hold a referral when the controlling licensed capacity is fully occupied.",
  },
  {
    id: "evidence_gap_hold",
    label: "Evidence gap",
    description: "Prevent high-acuity/rate inference when controlled acuity evidence is incomplete.",
  },
];

function OutcomeBadge({ result }: { result: CypressS5PreviewResult }) {
  const accepted = result.outcome === "ACCEPT_AUTHORIZED";
  const review = result.outcome === "DECLINE_REVIEW_REQUIRED";
  return (
    <Badge
      className={cn(
        accepted
          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
          : review
            ? "border-amber-300 bg-amber-50 text-amber-800"
            : "border-rose-300 bg-rose-50 text-rose-800",
      )}
      variant="outline"
    >
      {accepted ? (
        <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
      ) : (
        <AlertTriangle aria-hidden="true" className="mr-1 size-3" />
      )}
      {result.outcome.replace(/_/g, " ")}
    </Badge>
  );
}

function ReadinessGateList({ result }: { result: CypressS5PreviewResult }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {result.referralReadiness.gates.map((gate) => (
        <div
          className={cn(
            "rounded-xl border p-3",
            gate.passed
              ? "border-emerald-200 bg-emerald-50/60"
              : "border-rose-200 bg-rose-50/70",
          )}
          key={gate.id}
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-bold text-slate-900">{gate.id.replace(/_/g, " ")}</p>
            <Badge className="text-[9px]" variant="outline">
              {gate.passed ? "PASS" : "BLOCKED"}
            </Badge>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-600">{gate.detail}</p>
          {gate.reasonCodes.length > 0 ? (
            <p className="mt-2 text-[10px] font-semibold text-rose-700">
              {gate.reasonCodes.join(" · ")}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function M41bReferralAcuityRatePreview() {
  const [scenario, setScenario] =
    useState<CypressS5PreviewScenario>("high_acuity_accept");
  const status = trpc.m2.referralAcuityRateStatus.useQuery();
  const preview = trpc.m2.referralAcuityRatePreview.useQuery({ scenario });
  const result = preview.data ?? null;

  return (
    <Card className="overflow-hidden border-teal-200 shadow-sm">
      <CardHeader className="border-b border-teal-100 bg-gradient-to-r from-slate-950 via-teal-950 to-slate-900 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-teal-300/30 bg-teal-300/10 text-teal-100" variant="outline">
                <Activity aria-hidden="true" className="mr-1 size-3" />
                S5 Referral / Acuity / Rate
              </Badge>
              <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100" variant="outline">
                Synthetic preview · no PHI
              </Badge>
            </div>
            <CardTitle className="mt-3 text-xl text-white">
              Ask AMOS · Cypress Placement Decision Control
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-slate-300">
              Run the referral through existing CCMG readiness gates, then apply Cypress acuity, resource-fit, 10-bed capacity, decline-reason, and $450/$550/$650 rate controls.
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
        <div className="grid gap-2 lg:grid-cols-5">
          {SCENARIOS.map((option) => (
            <button
              aria-pressed={scenario === option.id}
              className={cn(
                "rounded-xl border p-3 text-left transition",
                scenario === option.id
                  ? "border-teal-600 bg-teal-50 ring-1 ring-teal-200"
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
            <ShieldAlert aria-hidden="true" className="size-4 text-teal-700" />
            S5 command boundary
          </p>
          <p className="mt-1 text-[11px] leading-5 text-slate-600">
            {status.data?.message ?? "Checking the S5 command boundary…"}
          </p>
        </div>

        {preview.isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Evaluating referral, acuity, resource fit, capacity, and rate controls…
          </div>
        ) : null}

        {preview.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            The S5 synthetic preview could not be rendered: {preview.error.message}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">
                    S5 placement decision
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{result.title}</h3>
                  <p className="mt-1 text-[11px] font-semibold text-slate-500">{result.testCaseId}</p>
                </div>
                <OutcomeBadge result={result} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{result.summary}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <FileCheck2 className="size-3" /> Readiness
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">{result.referralReadiness.status.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <UserRoundCheck className="size-3" /> Acuity
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">{result.acuityProfile.acuity} · {result.acuityProfile.supervision}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <BedDouble className="size-3" /> Census
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">{result.currentCensus}/{result.licensedCapacity} · {result.availableBeds} open</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <CircleDollarSign className="size-3" /> Rate
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">
                    ${result.rateControl.proposedDailyRate} → {result.rateControl.recommendedTier}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    <Scale className="size-3" /> Disposition
                  </p>
                  <p className="mt-1 text-sm font-black text-slate-950">{result.disposition.replace(/_/g, " ")}</p>
                </div>
              </div>
            </div>

            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">Existing CCMG referral gates</p>
                <Badge variant="outline">Reused · not duplicated</Badge>
              </div>
              <ReadinessGateList result={result} />
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">Acuity / resource fit</p>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p>Behavioral risk: <strong className="text-slate-900">{result.acuityProfile.behavioralRisk}</strong></p>
                  <p>Clinical supports: <strong className="text-slate-900">{result.acuityProfile.clinicalSupportIntensity}</strong></p>
                  <p>Staffing intensity: <strong className="text-slate-900">{result.acuityProfile.staffingIntensity}</strong></p>
                  <p>Resource cost: <strong className="text-slate-900">${result.acuityProfile.estimatedResourceCostPerDay}/day</strong></p>
                  <p>Evidence refs: <strong className="text-slate-900">{result.acuityProfile.evidenceRefs.length}</strong></p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">Rate doctrine</p>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] uppercase text-slate-500">Floor</p><p className="font-black">$450</p></div>
                  <div className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] uppercase text-slate-500">Target</p><p className="font-black">$550</p></div>
                  <div className="rounded-lg bg-slate-50 p-2"><p className="text-[9px] uppercase text-slate-500">Enhanced</p><p className="font-black">$650</p></div>
                </div>
                <p className="mt-3 text-[11px] leading-5 text-slate-600">
                  Recommended: <strong className="text-slate-900">{result.rateControl.recommendedTier}{result.rateControl.recommendedDailyRate ? ` · $${result.rateControl.recommendedDailyRate}` : ""}</strong>. Operating control only; not a payer guarantee.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-700">Decline control</p>
                <div className="mt-3 space-y-2 text-xs text-slate-600">
                  <p>Requested decision: <strong className="text-slate-900">{result.requestedDecision}</strong></p>
                  <p>Reason code: <strong className="text-slate-900">{result.declineReasonCode ?? "NONE"}</strong></p>
                  <p>Reason class: <strong className="text-slate-900">{result.declineClass.replace(/_/g, " ")}</strong></p>
                </div>
              </div>
            </div>

            {result.exceptions.length > 0 ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-900">Control exceptions</p>
                <div className="mt-3 space-y-3">
                  {result.exceptions.map((exception) => (
                    <div key={exception.code}>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{exception.code}</Badge>
                        <Badge variant="outline">{exception.disposition}</Badge>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-amber-950">{exception.summary}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-2 text-xs font-black uppercase tracking-[0.12em] text-slate-700">Synthetic audit trail</p>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                {result.audit.map((event) => (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3" key={event.eventId}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-500">{event.eventType.replace(/_/g, " ")}</p>
                      <Badge variant="outline">{event.status.replace(/_/g, " ")}</Badge>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-600">{event.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-800">Exact next action</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-teal-950">{result.exactNextAction}</p>
              <p className="mt-3 text-[11px] text-teal-800">Production promotion remains NOT AUTHORIZED.</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
