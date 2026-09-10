import { useState } from "react";
import { CheckCircle2, Database, RefreshCw, ShieldCheck, XCircle } from "lucide-react";
import { trpc } from "@/providers/trpc";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-slate-200 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      <span className="break-all text-sm font-medium text-slate-900 md:max-w-[68%] md:text-right">{value}</span>
    </div>
  );
}

export function SharePointBridgeStatusPanel() {
  const status = trpc.m2.sharePointBridgeStatus.useQuery();
  const [lastProbe, setLastProbe] = useState<{
    status: string;
    verification: string;
    tenantHost: string;
    siteId: string;
    driveId: string;
    rootItemId: string;
    name: string;
    webUrl: string;
    accessMode: string;
    writesEnabled: boolean;
    verifiedAt: string;
  } | null>(null);
  const probe = trpc.m2.probeSharePointBridge.useMutation({
    onSuccess: (result) => setLastProbe(result),
  });

  const configured = status.data?.configured === true;
  const connected = lastProbe?.status === "CONNECTED";
  const error =
    probe.error?.message ??
    (status.data?.status === "ERROR" ? status.data.errorCode : null);

  return (
    <section className="mx-auto mb-6 w-full max-w-7xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-teal-700">
            <ShieldCheck size={16} /> Production control
          </div>
          <h2 className="text-xl font-bold text-slate-950">SharePoint Bridge Status</h2>
          <p className="mt-1 max-w-3xl text-sm text-slate-600">
            Server-side verification of the authorized AMOS-OPS DMS connection to the Cypress GRO SharePoint repository. Credentials and access tokens are never displayed.
          </p>
        </div>
        <button
          type="button"
          disabled={!configured || probe.isPending}
          onClick={() => probe.mutate()}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw size={16} className={probe.isPending ? "animate-spin" : ""} />
          {probe.isPending ? "Running live probe…" : "Run live probe"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            {configured ? <CheckCircle2 size={18} className="text-emerald-600" /> : <XCircle size={18} className="text-rose-600" />}
            Configuration
          </div>
          <div className="mt-2 text-lg font-bold text-slate-950">{configured ? "CONFIGURED" : "NOT READY"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            {connected ? <CheckCircle2 size={18} className="text-emerald-600" /> : <Database size={18} className="text-slate-500" />}
            Microsoft Graph
          </div>
          <div className="mt-2 text-lg font-bold text-slate-950">{connected ? "CONNECTED" : "NOT PROBED"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-700">Repository access</div>
          <div className="mt-2 text-lg font-bold text-slate-950">{connected ? "VERIFIED" : "PENDING"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="text-sm font-semibold text-slate-700">Write authority</div>
          <div className="mt-2 text-lg font-bold text-emerald-700">DISABLED</div>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800">
          Live probe failed: {error}
        </div>
      )}

      <div className="mt-5 rounded-xl border border-slate-200 px-4">
        <Row label="Tenant" value={lastProbe?.tenantHost ?? status.data?.tenantHost ?? "Not configured"} />
        <Row label="Site identity" value={lastProbe?.siteId ?? status.data?.siteId ?? "Not configured"} />
        <Row label="Allowed drives" value={String(status.data?.allowedDriveCount ?? 0)} />
        <Row label="Access mode" value={lastProbe?.accessMode ?? "READ ONLY / awaiting live verification"} />
        {lastProbe && <Row label="Verified library" value={`${lastProbe.name} — ${lastProbe.driveId}`} />}
        {lastProbe && <Row label="Root item" value={lastProbe.rootItemId} />}
        {lastProbe && <Row label="Verified at" value={lastProbe.verifiedAt} />}
      </div>

      {lastProbe && (
        <a
          href={lastProbe.webUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex text-sm font-semibold text-teal-700 underline underline-offset-4"
        >
          Open verified Cypress GRO library
        </a>
      )}
    </section>
  );
}
