import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BedDouble,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  HeartHandshake,
  House,
  Pill,
  ShieldCheck,
  Users,
} from "lucide-react";
import {
  M24_SYNTHETIC_VIEW,
  type M24ScenarioViewModel,
  type M24StageViewModel,
} from "@/data/m24-synthetic-data";

const COLORS = {
  teal: "#245C5A",
  green: "#047857",
  amber: "#B45309",
  red: "#B91C1C",
  blue: "#1D4ED8",
  slate: "#64748B",
} as const;

type Section = "overview" | "workflows" | "controls" | "scenarios";

function queueToneColor(tone: string): string {
  if (tone === "red") return COLORS.red;
  if (tone === "amber") return COLORS.amber;
  return COLORS.green;
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

function StageCard({ stage }: { stage: M24StageViewModel }) {
  const alert = stage.percentFull >= 90;
  return (
    <article
      className="rounded-xl border p-5"
      style={{
        background: "var(--card-bg)",
        borderColor: alert ? `${COLORS.amber}80` : "var(--card-border)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className="text-[10px] font-semibold uppercase tracking-[1px]"
            style={{ color: COLORS.teal }}
          >
            {stage.status}
          </p>
          <h3
            className="mt-1 text-[13px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            {stage.name}
          </h3>
        </div>
        {alert ? (
          <AlertTriangle
            aria-label="Capacity alert"
            size={18}
            style={{ color: COLORS.amber }}
          />
        ) : (
          <House aria-hidden="true" size={18} style={{ color: COLORS.teal }} />
        )}
      </div>
      <div className="mt-5 flex items-end justify-between gap-4">
        <div>
          <span
            className="text-3xl font-bold"
            style={{ color: alert ? COLORS.amber : COLORS.teal }}
          >
            {stage.census}
          </span>
          <span className="text-sm" style={{ color: "var(--topbar-subtitle)" }}>
            {" "}
            / {stage.capacity}
          </span>
        </div>
        <p
          className="text-[10px] font-semibold"
          style={{ color: alert ? COLORS.amber : COLORS.green }}
        >
          {stage.percentFull}% occupied
        </p>
      </div>
      <div
        className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={`${stage.name} census`}
        aria-valuemin={0}
        aria-valuemax={stage.capacity}
        aria-valuenow={stage.census}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${stage.percentFull}%`,
            background: alert ? COLORS.amber : COLORS.teal,
          }}
        />
      </div>
      <p
        className="mt-3 text-[10px]"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {stage.capacity - stage.census - stage.leave} available · {stage.leave}{" "}
        on leave
      </p>
    </article>
  );
}

function ScenarioPicker({
  scenario,
  active,
  onSelect,
}: {
  scenario: M24ScenarioViewModel;
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
        <p
          className="text-[12px] font-bold"
          style={{ color: "var(--topbar-title)" }}
        >
          {scenario.label}
        </p>
        <span
          className="rounded-full border px-2 py-1 text-[9px] font-bold"
          style={{
            color: COLORS.green,
            borderColor: `${COLORS.green}40`,
            background: "#ECFDF5",
          }}
        >
          {scenario.status}
        </span>
      </div>
      <p
        className="mt-2 text-[10px] leading-5"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {scenario.summary}
      </p>
    </button>
  );
}

export interface M24OperationsDashboardProps {
  readonly model?: typeof M24_SYNTHETIC_VIEW;
}

export function M24OperationsDashboard({
  model = M24_SYNTHETIC_VIEW,
}: M24OperationsDashboardProps) {
  const [section, setSection] = useState<Section>("overview");
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    model.scenarios[0].id,
  );
  const selectedScenario = useMemo(
    () =>
      model.scenarios.find((item) => item.id === selectedScenarioId) ??
      model.scenarios[0],
    [model.scenarios, selectedScenarioId],
  );

  return (
    <main className="space-y-5 p-4 md:p-6">
      <header
        className="rounded-2xl border p-5 md:p-6"
        style={{
          borderColor: "var(--card-border)",
          background:
            "linear-gradient(135deg, #F0FDFA 0%, #FFFFFF 58%, #FFF7ED 100%)",
        }}
      >
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-start">
          <div className="flex gap-4">
            <span
              className="inline-flex h-11 w-11 flex-none items-center justify-center rounded-xl text-white"
              style={{ background: COLORS.teal }}
            >
              <BedDouble size={22} />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1
                  className="text-xl font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  GRO Residential Operations
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
                One governed workspace for three-stage census, rooms and beds,
                staffing, shifts, MAR, incidents, youth rights, engagement,
                crisis response, and discharge coordination.
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

      <section
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
        aria-label="Residential operating metrics"
      >
        {model.headlineMetrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <nav
        className="flex flex-wrap gap-2"
        aria-label="Residential operations sections"
      >
        {(
          [
            ["overview", "Operations overview", Activity],
            ["workflows", "Daily workflows", Clock3],
            ["controls", "Acceptance controls", ClipboardCheck],
            ["scenarios", "Demo scenarios", ShieldCheck],
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

      {section === "overview" ? (
        <div className="space-y-4">
          <section
            className="grid gap-4 lg:grid-cols-3"
            aria-label="Three-stage census"
          >
            {model.stages.map((stage) => (
              <StageCard key={stage.id} stage={stage} />
            ))}
          </section>
          <section
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
            aria-label="Residential feature status"
          >
            {model.operationalPanels.map((panel, index) => {
              const Icon =
                [
                  Clock3,
                  Pill,
                  AlertTriangle,
                  ShieldCheck,
                  HeartHandshake,
                  Users,
                ][index] ?? Activity;
              return (
                <article
                  key={panel.label}
                  className="rounded-xl border p-5"
                  style={{
                    background: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                  }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Icon size={18} style={{ color: COLORS.teal }} />
                    <span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">
                      {panel.value}
                    </span>
                  </div>
                  <h2
                    className="mt-4 text-[13px] font-bold"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    {panel.label}
                  </h2>
                  <p
                    className="mt-2 text-[10px] leading-5"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    {panel.detail}
                  </p>
                </article>
              );
            })}
          </section>
        </div>
      ) : null}

      {section === "workflows" ? (
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
              className="text-[15px] font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              Current synthetic work queue
            </h2>
            <p
              className="mt-1 text-[11px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Every item has an explicit stream, owner, state, and
              evidence-bearing lifecycle.
            </p>
          </div>
          <div
            className="divide-y"
            style={{ borderColor: "var(--card-border)" }}
          >
            {model.workQueues.map((item) => {
              const tone = queueToneColor(item.tone);
              return (
                <article
                  key={`${item.stream}-${item.item}`}
                  className="grid gap-2 p-4 md:grid-cols-[120px_minmax(0,1fr)_180px_120px] md:items-center"
                >
                  <p
                    className="text-[10px] font-semibold uppercase tracking-[0.8px]"
                    style={{ color: COLORS.teal }}
                  >
                    {item.stream}
                  </p>
                  <p
                    className="text-[11px] font-semibold"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    {item.item}
                  </p>
                  <p
                    className="text-[10px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    {item.owner}
                  </p>
                  <span
                    className="w-fit rounded-full border px-2 py-1 text-[9px] font-bold"
                    style={{
                      color: tone,
                      borderColor: `${tone}40`,
                      background: `${tone}0D`,
                    }}
                  >
                    {item.state}
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {section === "controls" ? (
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
              className="text-[15px] font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              M2.4 acceptance criteria
            </h2>
            <p
              className="mt-1 text-[11px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Eight controlling criteria are connected to executable synthetic
              proof.
            </p>
          </div>
          <div className="grid gap-px bg-slate-100 md:grid-cols-2">
            {model.criteria.map((criterion) => (
              <article key={criterion.id} className="bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p
                      className="text-[10px] font-bold"
                      style={{ color: COLORS.teal }}
                    >
                      {criterion.id}
                    </p>
                    <h3
                      className="mt-1 text-[12px] font-bold"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      {criterion.title}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-700">
                    <CheckCircle2 size={11} /> {criterion.status}
                  </span>
                </div>
                <p
                  className="mt-3 text-[10px] leading-5"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  {criterion.proof}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {section === "scenarios" ? (
        <div className="grid gap-4 xl:grid-cols-[350px_minmax(0,1fr)]">
          <section className="space-y-3" aria-label="M2.4 synthetic scenarios">
            {model.scenarios.map((scenario) => (
              <ScenarioPicker
                key={scenario.id}
                scenario={scenario}
                active={scenario.id === selectedScenario.id}
                onSelect={() => setSelectedScenarioId(scenario.id)}
              />
            ))}
          </section>
          <section
            className="rounded-xl border p-5"
            style={{
              background: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[1px]"
                  style={{ color: COLORS.teal }}
                >
                  Executable acceptance evidence
                </p>
                <h2
                  className="mt-1 text-[17px] font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  {selectedScenario.label}
                </h2>
              </div>
              <CheckCircle2 size={22} style={{ color: COLORS.green }} />
            </div>
            <p
              className="mt-4 text-[11px] leading-6"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {selectedScenario.summary}
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {selectedScenario.evidence.map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-2 rounded-lg border p-3 text-[10px] font-semibold"
                  style={{
                    borderColor: "var(--card-border)",
                    color: "var(--topbar-title)",
                  }}
                >
                  <CheckCircle2 size={14} style={{ color: COLORS.green }} />{" "}
                  {item}
                </div>
              ))}
            </div>
            <div
              className="mt-5 rounded-lg border p-4"
              style={{ borderColor: `${COLORS.blue}30`, background: "#EFF6FF" }}
            >
              <p
                className="text-[10px] font-bold"
                style={{ color: COLORS.blue }}
              >
                Deterministic and isolated
              </p>
              <p className="mt-1 text-[10px] leading-5 text-blue-800">
                Running this scenario creates synthetic evidence in an isolated
                engine and does not alter the runtime prototype state.
              </p>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default M24OperationsDashboard;
