import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  FileSignature,
  Link2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import {
  M23_SYNTHETIC_VIEW,
  type M23ScenarioViewModel,
} from "@/data/m23-synthetic-data";
import { runtimeConfig } from "@/config/runtime";
import { mayUseIsolatedFixtures } from "@/context/onboarding-context";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";
import type { OperationalProgramSummary } from "../../../api/services/operational-program-summary";

const COLORS = {
  teal: "#245C5A",
  green: "#047857",
  amber: "#B45309",
  red: "#B91C1C",
  blue: "#1D4ED8",
  slate: "#64748B",
} as const;

function humanize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article
      className="rounded-xl border p-4"
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <p
        className="text-[10px] font-semibold uppercase tracking-[1px]"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {label}
      </p>
      <p className="mt-3 text-2xl font-bold" style={{ color: COLORS.teal }}>
        {value}
      </p>
      <p
        className="mt-1 text-[11px] leading-5"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {detail}
      </p>
    </article>
  );
}

function ScenarioButton({
  scenario,
  active,
  onSelect,
}: {
  scenario: M23ScenarioViewModel;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="w-full rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2"
      style={{
        borderColor: active ? COLORS.teal : "var(--card-border)",
        background: active ? "#F0FDFA" : "var(--card-bg)",
        boxShadow: active ? `inset 0 0 0 1px ${COLORS.teal}22` : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-[12px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            {scenario.name}
          </p>
          <p
            className="mt-1 text-[10px]"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            {humanize(scenario.category)} · age {scenario.age} ·{" "}
            {scenario.setting}
          </p>
        </div>
        <span
          className="rounded-full border px-2 py-1 text-[10px] font-bold"
          style={{
            color: COLORS.blue,
            borderColor: `${COLORS.blue}40`,
            background: "#EFF6FF",
          }}
        >
          {scenario.procedureCode}
        </span>
      </div>
      <div
        className="mt-3 flex items-center gap-2 text-[10px] font-semibold"
        style={{ color: COLORS.green }}
      >
        <CheckCircle2 size={13} /> {scenario.status}
      </div>
    </button>
  );
}

function Lineage({ scenario }: { scenario: M23ScenarioViewModel }) {
  return (
    <section
      className="rounded-xl border p-5"
      style={{
        background: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[1px]"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Immutable clinical lineage
          </p>
          <h2
            className="mt-1 text-[16px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            {scenario.name}
          </h2>
        </div>
        <FileSignature size={20} style={{ color: COLORS.teal }} />
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {scenario.lineage.map((step, index) => (
          <div key={step} className="flex items-center gap-2">
            <span
              className="rounded-lg border px-3 py-2 text-[10px] font-semibold"
              style={{
                borderColor: "var(--card-border)",
                color: "var(--topbar-title)",
                background:
                  index === scenario.lineage.length - 1
                    ? "#ECFDF5"
                    : "var(--card-bg)",
              }}
            >
              {step}
            </span>
            {index < scenario.lineage.length - 1 ? (
              <ArrowRight size={13} style={{ color: COLORS.slate }} />
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          ["Clinical result", "READY", COLORS.green],
          ["Documentation", "SIGNED", COLORS.green],
          ["Claim disposition", "READY FOR REVENUE", COLORS.green],
        ].map(([label, value, color]) => (
          <div
            key={label}
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--card-border)" }}
          >
            <p
              className="text-[9px] uppercase tracking-[0.8px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {label}
            </p>
            <p className="mt-1 text-[11px] font-bold" style={{ color }}>
              {value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export interface M23WorkspaceProps {
  readonly model?: typeof M23_SYNTHETIC_VIEW;
  readonly syntheticDataAllowed?: boolean;
  readonly operationalSummary?: OperationalProgramSummary | null;
  readonly operationalLoading?: boolean;
  readonly operationalError?: boolean;
}

function M23Unavailable({
  state = "unavailable",
}: {
  state?: "unavailable" | "loading" | "error" | "empty";
}) {
  const content = {
    unavailable: {
      title: "MHRS operational data unavailable",
      detail:
        "No authoritative program records are available. Production does not substitute demonstration workflows, metrics, or claim dispositions.",
    },
    loading: {
      title: "Loading MHRS operational data",
      detail:
        "AMOS-OPS is reading the authoritative durable coordination store. No demonstration records are used.",
    },
    error: {
      title: "MHRS operational data could not be loaded",
      detail:
        "The authoritative store did not return a safe response. No cached or demonstration records were substituted.",
    },
    empty: {
      title: "No MHRS operational records",
      detail:
        "The authoritative durable store is connected and currently contains no Production MHRS work, handoffs, or approved lineage.",
    },
  }[state];
  return (
    <main
      data-testid={`m23-operational-${state}`}
      className="space-y-5 p-4 md:p-6"
    >
      <section
        className="rounded-2xl border p-6"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <ShieldCheck size={24} style={{ color: COLORS.teal }} />
        <h1
          className="mt-4 text-xl font-bold"
          style={{ color: "var(--topbar-title)" }}
        >
          {content.title}
        </h1>
        <p
          className="mt-2 max-w-2xl text-[12px] leading-5"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {content.detail}
        </p>
      </section>
    </main>
  );
}

function M23OperationalWorkspace({
  summary,
  loading,
  failed,
}: {
  summary?: OperationalProgramSummary | null;
  loading?: boolean;
  failed?: boolean;
}) {
  if (loading) return <M23Unavailable state="loading" />;
  if (failed) return <M23Unavailable state="error" />;
  if (!summary) return <M23Unavailable />;
  if (summary.empty) return <M23Unavailable state="empty" />;

  return (
    <main
      data-testid="m23-operational-workspace"
      className="space-y-5 p-4 md:p-6"
    >
      <header
        className="rounded-2xl border p-5 md:p-6"
        style={{
          borderColor: "var(--card-border)",
          background:
            "linear-gradient(135deg, #F0FDFA 0%, #FFFFFF 58%, #EFF6FF 100%)",
        }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[1px] text-teal-700">
              AMOS-OPS · Authoritative Production view
            </p>
            <h1
              className="mt-2 text-xl font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              MHRS Operational Queue
            </h1>
            <p
              className="mt-2 max-w-3xl text-[12px] leading-5"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Read-only work, handoff, and approved CANS lineage from the
              durable CCMG operational store.
            </p>
          </div>
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[10px] font-bold text-emerald-800">
            Authoritative · read only
          </span>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Active work"
          value={String(summary.metrics.activeWorkItems)}
          detail={`${summary.metrics.totalWorkItems} total Production items`}
        />
        <MetricCard
          label="Overdue"
          value={String(summary.metrics.overdueWorkItems)}
          detail="Nonterminal items past their due time"
        />
        <MetricCard
          label="Active handoffs"
          value={String(summary.metrics.activeHandoffs)}
          detail="Accepted or pending CCMG coordination"
        />
        <MetricCard
          label="Approved lineage"
          value={String(summary.metrics.approvedLineages)}
          detail="Immutable approved CANS-to-MHRS routes"
        />
      </section>

      <section
        className="overflow-hidden rounded-xl border"
        style={{
          background: "var(--card-bg)",
          borderColor: "var(--card-border)",
        }}
      >
        <div
          className="border-b p-5"
          style={{ borderColor: "var(--card-border)" }}
        >
          <h2
            className="text-[14px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            Production work items
          </h2>
          <p
            className="mt-1 text-[10px]"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Case identifiers and minimum-necessary coordination fields only.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-[11px]">
            <thead className="bg-slate-50 text-[9px] uppercase tracking-[0.8px] text-slate-500">
              <tr>
                <th className="px-5 py-3">Case</th>
                <th className="px-5 py-3">Work</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Priority</th>
                <th className="px-5 py-3">Due</th>
                <th className="px-5 py-3">Approval</th>
              </tr>
            </thead>
            <tbody>
              {summary.workItems.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-5 py-4 font-mono text-[10px]">
                    {item.caseId}
                  </td>
                  <td className="px-5 py-4 font-semibold">{item.title}</td>
                  <td className="px-5 py-4">{humanize(item.status)}</td>
                  <td className="px-5 py-4">{humanize(item.priority)}</td>
                  <td className="px-5 py-4">{item.dueAt}</td>
                  <td className="px-5 py-4">{humanize(item.approvalStatus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

export function M23Workspace(props: M23WorkspaceProps = {}) {
  if (props.syntheticDataAllowed !== undefined) {
    return (
      <M23WorkspaceContent
        {...props}
        syntheticDataAllowed={props.syntheticDataAllowed ?? true}
      />
    );
  }
  return <AuthenticatedM23Workspace {...props} />;
}

function AuthenticatedM23Workspace(props: M23WorkspaceProps) {
  const { workspace } = useAuth();
  const syntheticDataAllowed = mayUseIsolatedFixtures(
    runtimeConfig.evaluationMode,
    workspace,
  );
  const [asOf] = useState(() => new Date().toISOString());
  const summaryQuery = trpc.m23.operationalSummary.useQuery(
    { asOf },
    { enabled: !syntheticDataAllowed, retry: false },
  );
  return (
    <M23WorkspaceContent
      {...props}
      syntheticDataAllowed={syntheticDataAllowed}
      operationalSummary={summaryQuery.data}
      operationalLoading={summaryQuery.isLoading}
      operationalError={summaryQuery.isError}
    />
  );
}

function M23WorkspaceContent({
  model: suppliedModel,
  syntheticDataAllowed,
  operationalSummary,
  operationalLoading,
  operationalError,
}: M23WorkspaceProps & { syntheticDataAllowed: boolean }) {
  const model = syntheticDataAllowed
    ? (suppliedModel ?? M23_SYNTHETIC_VIEW)
    : null;
  const [selectedId, setSelectedId] = useState(model?.scenarios[0]?.id ?? "");
  const [section, setSection] = useState<"workflows" | "controls" | "bridges">(
    "workflows",
  );
  const selected = useMemo(
    () =>
      model?.scenarios.find((scenario) => scenario.id === selectedId) ??
      model?.scenarios[0],
    [model, selectedId],
  );
  if (!syntheticDataAllowed) {
    return (
      <M23OperationalWorkspace
        summary={operationalSummary}
        loading={operationalLoading}
        failed={operationalError}
      />
    );
  }
  if (!model || !selected) return <M23Unavailable />;

  return (
    <main className="space-y-5 p-4 md:p-6">
      <header
        className="rounded-2xl border p-5 md:p-6"
        style={{
          borderColor: "var(--card-border)",
          background:
            "linear-gradient(135deg, #F0FDFA 0%, #FFFFFF 58%, #EFF6FF 100%)",
        }}
      >
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="flex gap-4">
            <span
              className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl"
              style={{ color: "white", background: COLORS.teal }}
            >
              <Stethoscope size={22} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-xl font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  MHRS Program Operations
                </h1>
                <span
                  className="rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.6px]"
                  style={{
                    color: COLORS.amber,
                    borderColor: `${COLORS.amber}40`,
                    background: "#FFFBEB",
                  }}
                >
                  Demo mode
                </span>
              </div>
              <p
                className="mt-2 max-w-3xl text-[12px] leading-5"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Four governed service workflows with need-to-outcome lineage,
                90-day plan versioning, clinical billing evaluation, and
                fail-closed revenue handoff.
              </p>
            </div>
          </div>
          <div
            className="rounded-lg border px-3 py-2 text-[10px]"
            style={{
              color: COLORS.teal,
              borderColor: `${COLORS.teal}35`,
              background: "#FFFFFFCC",
            }}
          >
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck size={14} /> {model.evidenceClass}
            </div>
            <p
              className="mt-1 pl-5"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Evidence view: {model.asOf}
            </p>
          </div>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {model.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <nav
        className="flex flex-wrap gap-2"
        aria-label="MHRS workspace sections"
      >
        {(
          [
            ["workflows", "Service workflows", ClipboardCheck],
            ["controls", "Claim controls", LockKeyhole],
            ["bridges", "Continuum bridges", Link2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setSection(id)}
            aria-pressed={section === id}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-semibold"
            style={{
              color: section === id ? "white" : COLORS.teal,
              background: section === id ? COLORS.teal : "var(--card-bg)",
              borderColor: section === id ? COLORS.teal : "var(--card-border)",
            }}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </nav>

      {section === "workflows" ? (
        <div className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
          <section className="space-y-3" aria-label="Synthetic MHRS scenarios">
            {model.scenarios.map((scenario) => (
              <ScenarioButton
                key={scenario.id}
                scenario={scenario}
                active={scenario.id === selected.id}
                onSelect={() => setSelectedId(scenario.id)}
              />
            ))}
          </section>
          <div className="space-y-4">
            <Lineage scenario={selected} />
            <section
              className="rounded-xl border p-5"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <RefreshCw size={17} style={{ color: COLORS.amber }} />
                <h2
                  className="text-[14px] font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  90-day plan review
                </h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-amber-50 p-3">
                  <p className="text-[9px] uppercase text-amber-700">Alert</p>
                  <p className="mt-1 text-[11px] font-bold text-amber-800">
                    Assigned → escalated
                  </p>
                </div>
                <div className="rounded-lg bg-blue-50 p-3">
                  <p className="text-[9px] uppercase text-blue-700">Review</p>
                  <p className="mt-1 text-[11px] font-bold text-blue-800">
                    Supervisor completed
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-[9px] uppercase text-emerald-700">
                    Version
                  </p>
                  <p className="mt-1 text-[11px] font-bold text-emerald-800">
                    v1 superseded by v2
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {section === "controls" ? (
        <section
          className="rounded-xl border"
          style={{
            background: "var(--card-bg)",
            borderColor: "var(--card-border)",
          }}
        >
          <div
            className="border-b p-5"
            style={{ borderColor: "var(--card-border)" }}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: COLORS.red }} />
              <h2
                className="text-[15px] font-bold"
                style={{ color: "var(--topbar-title)" }}
              >
                Negative controls
              </h2>
            </div>
            <p
              className="mt-1 text-[11px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Each synthetic defect is rejected before a claim can enter revenue
              cycle.
            </p>
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "var(--card-border)" }}
          >
            {model.gates.map((gate) => (
              <article
                key={gate.label}
                className="grid gap-2 p-4 md:grid-cols-[210px_150px_1fr] md:items-center"
              >
                <p
                  className="text-[11px] font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  {gate.label}
                </p>
                <span
                  className="w-fit rounded-full border px-2 py-1 text-[9px] font-bold"
                  style={{
                    color: COLORS.red,
                    borderColor: `${COLORS.red}35`,
                    background: "#FEF2F2",
                  }}
                >
                  {gate.status}
                </span>
                <p
                  className="text-[10px] leading-5"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  {gate.detail}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {section === "bridges" ? (
        <section className="grid gap-4 md:grid-cols-3">
          {model.bridges.map((bridge) => (
            <article
              key={bridge.record}
              className="rounded-xl border p-5"
              style={{
                background: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <div className="flex items-center justify-between">
                <Link2 size={18} style={{ color: COLORS.teal }} />
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-600">
                  {bridge.mode}
                </span>
              </div>
              <p
                className="mt-4 text-[10px] font-semibold uppercase tracking-[0.8px]"
                style={{ color: COLORS.teal }}
              >
                {bridge.owner} owns
              </p>
              <p
                className="mt-1 text-[13px] font-bold"
                style={{ color: "var(--topbar-title)" }}
              >
                {bridge.record}
              </p>
              <p
                className="mt-2 text-[10px] leading-5"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                MHRS can reference the versioned source without changing the
                owning department&apos;s record.
              </p>
            </article>
          ))}
        </section>
      ) : null}
    </main>
  );
}

export default M23Workspace;
