import { useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ClipboardCheck,
  FileClock,
  GitBranch,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import {
  M22_SYNTHETIC_WORKSPACE,
  type M22SyntheticWorkspace,
} from "../../data/m22-synthetic-data";

interface M22WorkspaceProps {
  data?: M22SyntheticWorkspace;
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-4"
          : "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      }
    >
      <p
        className={
          accent
            ? "text-xs font-medium uppercase tracking-wider text-cyan-100"
            : "text-xs font-medium uppercase tracking-wider text-slate-500"
        }
      >
        {label}
      </p>
      <p
        className={
          accent
            ? "mt-2 text-2xl font-bold text-white"
            : "mt-2 text-2xl font-bold text-slate-950"
        }
      >
        {value}
      </p>
    </div>
  );
}

export function M22Workspace({
  data = M22_SYNTHETIC_WORKSPACE,
}: M22WorkspaceProps) {
  const [selectedFunction, setSelectedFunction] = useState<
    M22SyntheticWorkspace["functions"][number]["id"]
  >(data.functions[2].id);
  const activeFunction =
    data.functions.find((item) => item.id === selectedFunction) ??
    data.functions[0];

  return (
    <main
      data-testid="m22-workspace"
      className="min-h-screen bg-slate-50 text-slate-950"
    >
      <section className="relative overflow-hidden bg-slate-950 px-5 py-8 text-white sm:px-8 lg:px-12">
        <div className="absolute -right-16 -top-24 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="relative mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-cyan-300">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                AMOS-OPS · M2.2 Synthetic Demonstration
              </div>
              <h1 className="max-w-3xl text-3xl font-bold tracking-tight sm:text-4xl">
                MHTCM Case Management Workspace
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                One controlled experience from the approved M2.1 handoff through
                aftercare, billing readiness, and the revenue handoff.
              </p>
            </div>
            <StatusPill>Acceptance gate passed</StatusPill>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="Lifecycle" value="6 / 6" accent />
            <MetricCard label="Plan" value="Approved v2" accent />
            <MetricCard
              label="Billing"
              value={data.controls.billingDecision}
              accent
            />
            <MetricCard label="Evidence" value="8 / 8" accent />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-12">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-cyan-700">
                  Controlled case
                </p>
                <h2 className="mt-1 text-2xl font-bold">
                  {data.case.youthLabel}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {data.case.id} · Age {data.case.ageYears} · {data.case.source}
                </p>
              </div>
              <StatusPill>{data.case.status}</StatusPill>
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-700">
              <span>M2.1 referral + CANS</span>
              <ArrowRight className="h-4 w-4 text-cyan-700" />
              <span>{data.case.plan}</span>
              <ArrowRight className="h-4 w-4 text-cyan-700" />
              <span>Aftercare complete</span>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <GitBranch className="h-5 w-5 text-cyan-700" aria-hidden="true" />
              <div>
                <h2 className="text-lg font-bold">Six-function lifecycle</h2>
                <p className="text-sm text-slate-500">
                  Select a function to inspect its controlled disposition.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {data.functions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedFunction(item.id)}
                  className={
                    selectedFunction === item.id
                      ? "rounded-2xl border border-cyan-500 bg-cyan-50 p-4 text-left ring-2 ring-cyan-100"
                      : "rounded-2xl border border-slate-200 p-4 text-left hover:border-cyan-300 hover:bg-slate-50"
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-cyan-700">
                      0{index + 1}
                    </span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-3 font-semibold">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    Completed {item.date}
                  </p>
                </button>
              ))}
            </div>
            <div
              className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4"
              data-testid="m22-function-detail"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
                {activeFunction.label}
              </p>
              <p className="mt-1 font-semibold text-slate-900">
                {activeFunction.disposition}
              </p>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <ClipboardCheck className="h-5 w-5 text-cyan-700" />
                <h2 className="text-lg font-bold">Immutable service plan</h2>
              </div>
              <p className="mt-2 text-sm text-slate-500">
                Approved v2 preserves v1 and the exact M2.1 lineage.
              </p>
              <div className="mt-4 divide-y divide-slate-100">
                {data.planComponents.map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between gap-4 py-3 text-sm"
                  >
                    <span className="font-medium text-slate-700">{label}</span>
                    <span className="text-right text-slate-500">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3">
                <CalendarClock className="h-5 w-5 text-cyan-700" />
                <h2 className="text-lg font-bold">Transition controls</h2>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricCard
                  label="Discharge lead"
                  value={data.controls.dischargeLead}
                />
                <MetricCard
                  label="Aftercare due"
                  value={data.controls.aftercareDue}
                />
              </div>
              <div className="mt-4 rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
                <p className="font-semibold">
                  Aftercare completed {data.controls.aftercareCompleted}
                </p>
                <p className="mt-1 text-emerald-800">
                  Follow-up occurred inside the controlled 30-day window.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-cyan-700" />
                <div>
                  <h2 className="text-lg font-bold">T1017 fail-closed gate</h2>
                  <p className="text-sm text-slate-500">
                    No claim handoff occurs until every required evidence domain
                    passes.
                  </p>
                </div>
              </div>
              <StatusPill>{data.controls.handoff}</StatusPill>
            </div>
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <th className="py-3">Gate</th>
                    <th className="py-3">Evidence</th>
                    <th className="py-3 text-right">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gates.map(([gate, evidence, result]) => (
                    <tr
                      key={gate}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-3 font-medium">{gate}</td>
                      <td className="py-3 text-slate-500">{evidence}</td>
                      <td className="py-3 text-right font-semibold text-emerald-700">
                        {result}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-center gap-3 text-amber-900">
              <CalendarClock className="h-5 w-5" />
              <h2 className="font-bold">Authorization watch</h2>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-amber-700">
              Renewal due
            </p>
            <p className="mt-1 text-xl font-bold text-amber-950">
              {data.controls.renewalDue}
            </p>
            <p className="mt-3 rounded-xl bg-white/70 p-3 text-sm font-semibold text-amber-900">
              {data.controls.alert}
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <FileClock className="h-5 w-5 text-cyan-700" />
              <h2 className="font-bold">Record history</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold">Plan v1 → v2</p>
                <p className="text-slate-500">Append-only approval</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold">Note v1 → v4</p>
                <p className="text-slate-500">
                  Original, signature, amendment, signature
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold">
                  {data.controls.auditEvents} audit events
                </p>
                <p className="text-slate-500">Stable case correlation</p>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <LockKeyhole className="h-5 w-5 text-cyan-700" />
              <h2 className="font-bold">Role boundaries</h2>
            </div>
            <ul className="mt-4 space-y-3 text-sm text-slate-700">
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Assigned case manager: full case
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                QA reviewer: full review
              </li>
              <li className="flex gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                Revenue: minimum billing projection
              </li>
              <li className="flex gap-2">
                <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                Revenue: full clinical case denied
              </li>
            </ul>
          </section>

          <section className="rounded-3xl bg-slate-950 p-5 text-white">
            <h2 className="font-bold">M2.2 acceptance criteria</h2>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {data.criteria.map((criterion, index) => (
                <li key={criterion} className="flex gap-2">
                  <span className="font-bold text-cyan-300">{index + 1}</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
}

export default M22Workspace;
