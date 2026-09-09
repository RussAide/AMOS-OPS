import type {
  AskAmosMedicalRecordPreviewResult,
  AskAmosMedicalRecordPreviewScenario,
} from "@contracts/dms/ask-amos-medical-record";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  FileHeart,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
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
import { trpc } from "@/providers/trpc";
import { cn } from "@/lib/utils";

const SCENARIOS: ReadonlyArray<{
  id: AskAmosMedicalRecordPreviewScenario;
  label: string;
  description: string;
}> = [
  {
    id: "authorized",
    label: "Authorized record",
    description: "Current controller + access + exact backend re-verification.",
  },
  {
    id: "superseded_protected",
    label: "Superseded protected",
    description: "Old copy is excluded; only the replacement controller returns.",
  },
  {
    id: "denied",
    label: "Denied access",
    description: "No record or backend locator leaks after assignment denial.",
  },
  {
    id: "authority_conflict",
    label: "Authority conflict",
    description: "Two current controllers force a fail-closed exception.",
  },
  {
    id: "backend_stale",
    label: "Backend drift",
    description: "SharePoint metadata drift blocks content download.",
  },
];

function OutcomeBadge({ result }: { result: AskAmosMedicalRecordPreviewResult }) {
  const blocked = result.outcome !== "AUTHORIZED";
  return (
    <Badge
      className={cn(
        blocked
          ? "border-rose-300 bg-rose-50 text-rose-800"
          : "border-emerald-300 bg-emerald-50 text-emerald-800",
      )}
      variant="outline"
    >
      {blocked ? (
        <AlertTriangle aria-hidden="true" className="mr-1 size-3" />
      ) : (
        <CheckCircle2 aria-hidden="true" className="mr-1 size-3" />
      )}
      {result.outcome.replaceAll("_", " ")}
    </Badge>
  );
}

function Trace({ result }: { result: AskAmosMedicalRecordPreviewResult }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {result.trace.map((entry, index) => (
        <div
          className={cn(
            "rounded-xl border p-3",
            entry.status === "PASS"
              ? "border-emerald-200 bg-emerald-50/60"
              : entry.status === "BLOCKED"
                ? "border-rose-200 bg-rose-50/70"
                : "border-slate-200 bg-slate-50",
          )}
          key={`${index}-${entry.step}`}
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

export function M41bMedicalRecordPreview() {
  const [scenario, setScenario] =
    useState<AskAmosMedicalRecordPreviewScenario>("authorized");
  const status = trpc.m2.medicalRecordBridgeStatus.useQuery();
  const preview = trpc.m2.askAmosMedicalRecordPreview.useQuery({ scenario });
  const result = preview.data ?? null;

  return (
    <Card className="overflow-hidden border-teal-200 shadow-sm">
      <CardHeader className="border-b border-teal-100 bg-gradient-to-r from-teal-950 via-slate-950 to-slate-900 text-white">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge className="border-teal-300/30 bg-teal-300/10 text-teal-100" variant="outline">
                <FileHeart aria-hidden="true" className="mr-1 size-3" />
                S3 Medical Record Bridge
              </Badge>
              <Badge className="border-amber-300/30 bg-amber-300/10 text-amber-100" variant="outline">
                <Sparkles aria-hidden="true" className="mr-1 size-3" />
                Synthetic preview · no PHI
              </Badge>
            </div>
            <CardTitle className="mt-3 text-xl text-white">Ask AMOS · Governed Medical Record Preview</CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-slate-300">
              Inspect the authority-first record experience now without waiting for live Railway/Microsoft Graph credentials. The preview exercises the same S1 authority and S2 backend bridge controls against isolated training fixtures.
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
            Refresh scenario
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

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShieldCheck aria-hidden="true" className="size-4 text-teal-700" />
              Preview gate
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              {status.data?.message ?? "Checking the S3 bridge status…"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <LockKeyhole aria-hidden="true" className="size-4 text-amber-700" />
              Live runtime
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              {status.data?.live.configured
                ? "Graph configuration is present, but live use remains unauthorized until a successful runtime probe is recorded."
                : "Not configured / not connected. This does not block the synthetic S3 preview."}
            </p>
          </div>
        </div>

        {preview.isLoading ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            Building the governed synthetic record view…
          </div>
        ) : null}

        {preview.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800">
            The synthetic S3 preview could not be rendered: {preview.error.message}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-teal-700">Ask AMOS response</p>
                  <h3 className="mt-1 text-lg font-bold text-slate-950">{result.title}</h3>
                </div>
                <OutcomeBadge result={result} />
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-700">{result.answer}</p>
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-5 text-amber-900">
                {result.controlNotice}
              </p>
            </div>

            <Trace result={result} />

            {result.record ? (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.6fr)]">
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">CURRENT / CONTROLLING</Badge>
                    <Badge variant="outline">{result.record.recordClass.replaceAll("_", " ")}</Badge>
                    <Badge variant="outline">{result.record.governingVersion}</Badge>
                  </div>
                  <p className="mt-3 text-sm font-bold text-slate-950">{result.record.youthLabel}</p>
                  <p className="text-xs text-slate-500">{result.record.recordType} · reviewed {new Date(result.record.reviewedAt).toLocaleString()}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-700">{result.record.summary}</p>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-bold text-slate-800">Controlling facts</p>
                      <ul className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                        {result.record.facts.map((fact) => (
                          <li className="flex items-start gap-2" key={fact}>
                            <CheckCircle2 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-teal-700" />
                            {fact}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Controlled next actions</p>
                      <ol className="mt-2 space-y-2 text-xs leading-5 text-slate-600">
                        {result.record.nextActions.map((action, index) => (
                          <li className="flex items-start gap-2" key={action}>
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-700">{index + 1}</span>
                            {action}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 text-white">
                  <p className="flex items-center gap-1.5 text-xs font-bold text-teal-200">
                    <Database aria-hidden="true" className="size-4" />
                    Verified backend identity
                  </p>
                  <dl className="mt-3 space-y-3 text-xs">
                    <div>
                      <dt className="text-slate-400">DMS document</dt>
                      <dd className="mt-0.5 break-all font-mono text-[10px]">{result.record.documentId}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Stable object</dt>
                      <dd className="mt-0.5 break-all font-mono text-[10px]">{result.backend?.stableObjectId}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">SharePoint item</dt>
                      <dd className="mt-0.5 break-all font-mono text-[10px]">{result.backend?.itemId}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-400">Integrity</dt>
                      <dd className="mt-0.5 font-semibold text-emerald-300">Verified before view</dd>
                    </div>
                  </dl>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-rose-300 bg-rose-50 p-5 text-sm text-rose-800">
                No medical-record content is displayed for this scenario. The control path stopped before disclosure.
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default M41bMedicalRecordPreview;
