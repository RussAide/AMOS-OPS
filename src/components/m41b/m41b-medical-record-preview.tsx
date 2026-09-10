import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FileHeart,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { trpc } from "@/providers/trpc";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function M41bMedicalRecordPreview() {
  const [recordKey, setRecordKey] = useState("");
  const [submittedKey, setSubmittedKey] = useState("");
  const status = trpc.m2.medicalRecordBridgeStatus.useQuery(undefined, {
    retry: false,
  });
  const retrieval = trpc.m2.askAmosMedicalRecordLive.useQuery(
    { recordKey: submittedKey || "NOT_SUBMITTED" },
    {
      enabled: Boolean(submittedKey),
      retry: false,
      refetchOnWindowFocus: false,
    },
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalized = recordKey.trim();
    if (!normalized) return;
    if (normalized === submittedKey) {
      void retrieval.refetch();
      return;
    }
    setSubmittedKey(normalized);
  };

  const result = retrieval.data ?? null;
  const liveConfigured = Boolean(status.data?.live.configured);
  const liveReadOnly = status.data?.live.writesEnabled === false;

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
              <Badge className="border-emerald-300/30 bg-emerald-300/10 text-emerald-100" variant="outline">
                <ShieldCheck aria-hidden="true" className="mr-1 size-3" />
                Live governed retrieval
              </Badge>
              <Badge className="border-sky-300/30 bg-sky-300/10 text-sky-100" variant="outline">
                <LockKeyhole aria-hidden="true" className="mr-1 size-3" />
                SharePoint read-only
              </Badge>
            </div>
            <CardTitle className="mt-3 text-xl text-white">
              Ask AMOS · Live SharePoint Record Retrieval
            </CardTitle>
            <CardDescription className="mt-2 max-w-3xl text-slate-300">
              Retrieve the current controlling record through AMOS-DMS. The server resolves authority and assignment, re-verifies the exact bound SharePoint object, integrity-checks the read-only retrieval, and records the access event before returning an authoritative link.
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5 p-4 md:p-5">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <ShieldCheck aria-hidden="true" className="size-4 text-teal-700" />
              Governed access
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              {status.isError
                ? `Bridge status could not be verified: ${status.error.message}`
                : status.data?.message ?? "Checking live SharePoint bridge configuration…"}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
              <LockKeyhole aria-hidden="true" className="size-4 text-sky-700" />
              Runtime control
            </p>
            <p className="mt-1 text-[11px] leading-5 text-slate-600">
              {liveConfigured && liveReadOnly
                ? "Microsoft Graph is configured and writes remain disabled. Every retrieval still requires record-specific authorization and exact object re-verification."
                : "Live retrieval remains fail-closed until the read-only Microsoft Graph bridge is correctly configured."}
            </p>
          </div>
        </div>

        <form className="rounded-2xl border border-slate-200 bg-white p-4" onSubmit={submit}>
          <label className="text-xs font-bold text-slate-900" htmlFor="ask-amos-record-key">
            Governed record key
          </label>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            Enter the AMOS-DMS record key. Do not enter a SharePoint URL, drive ID, item ID, or filesystem path.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Input
              autoComplete="off"
              id="ask-amos-record-key"
              maxLength={500}
              onChange={(event) => setRecordKey(event.target.value)}
              placeholder="CYPRESS:…:MEDICAL-CONTINUITY"
              value={recordKey}
            />
            <Button
              disabled={!recordKey.trim() || retrieval.isFetching || !liveConfigured || !liveReadOnly}
              type="submit"
            >
              {retrieval.isFetching ? (
                <RefreshCw aria-hidden="true" className="mr-1 size-4 animate-spin" />
              ) : (
                <ShieldCheck aria-hidden="true" className="mr-1 size-4" />
              )}
              Retrieve controlling record
            </Button>
          </div>
        </form>

        {retrieval.isError ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <p className="flex items-center gap-2 font-bold">
              <AlertTriangle aria-hidden="true" className="size-4" />
              Retrieval did not complete
            </p>
            <p className="mt-2 text-xs leading-5">{retrieval.error.message}</p>
          </div>
        ) : null}

        {result && result.outcome !== "AUTHORIZED" ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="flex items-center gap-2 font-bold">
              <AlertTriangle aria-hidden="true" className="size-4" />
              Record withheld · {result.outcome.replace(/_/g, " ")}
            </p>
            <p className="mt-2 text-xs leading-5">{result.message}</p>
            <p className="mt-2 font-mono text-[10px] text-amber-800">{result.code}</p>
          </div>
        ) : null}

        {result?.outcome === "AUTHORIZED" && result.record ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-emerald-950">
                  <CheckCircle2 aria-hidden="true" className="size-4" />
                  Authorized current controlling record
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{result.record.name}</p>
                <p className="mt-1 text-[11px] leading-5 text-slate-600">
                  {result.message}
                </p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={result.record.webUrl} rel="noreferrer" target="_blank">
                  <ExternalLink aria-hidden="true" className="mr-1 size-4" />
                  Open verified SharePoint record
                </a>
              </Button>
            </div>
            <dl className="mt-4 grid gap-3 text-xs md:grid-cols-3">
              <div>
                <dt className="text-slate-500">Access mode</dt>
                <dd className="mt-1 font-bold text-slate-900">{result.record.accessMode}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Verified content size</dt>
                <dd className="mt-1 font-bold text-slate-900">{formatBytes(result.record.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Last modified</dt>
                <dd className="mt-1 font-bold text-slate-900">
                  {result.record.lastModifiedAt
                    ? new Date(result.record.lastModifiedAt).toLocaleString()
                    : "Not supplied by SharePoint"}
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default M41bMedicalRecordPreview;
