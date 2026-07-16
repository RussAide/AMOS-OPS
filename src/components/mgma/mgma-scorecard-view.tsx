import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDashed,
  ClipboardCheck,
  Database,
  FileCheck2,
  FlaskConical,
  Gauge,
  HeartPulse,
  Landmark,
  Layers3,
  Lightbulb,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UsersRound,
  XCircle,
} from "lucide-react";
import type {
  MgmaDataQualityViewModel,
  MgmaDomainViewModel,
  MgmaKpiViewModel,
  MgmaMetricStatus,
  MgmaQualityStatus,
  MgmaScopeViewModel,
  MgmaScorecardViewModel,
  MgmaViewMode,
} from "./mgma-scorecard-model";

const AMOS_COLORS = {
  teal: "#245C5A",
  rust: "#C45C4A",
  maroon: "#991B1B",
  amber: "#D97706",
  indigo: "#4F46E5",
  cyan: "#0891B2",
  violet: "#7C3AED",
  green: "#059669",
  red: "#DC2626",
  slate: "#64748B",
} as const;

const DOMAIN_PRESENTATION: ReadonlyArray<{ icon: LucideIcon; color: string }> =
  [
    { icon: Building2, color: AMOS_COLORS.teal },
    { icon: BarChart3, color: AMOS_COLORS.amber },
    { icon: UsersRound, color: AMOS_COLORS.indigo },
    { icon: Shield, color: AMOS_COLORS.maroon },
    { icon: HeartPulse, color: AMOS_COLORS.rust },
    { icon: Database, color: AMOS_COLORS.cyan },
    { icon: Lightbulb, color: AMOS_COLORS.violet },
  ];

const METRIC_STATUS: Record<
  MgmaMetricStatus,
  { label: string; icon: LucideIcon; color: string; background: string }
> = {
  on_target: {
    label: "On target",
    icon: CheckCircle2,
    color: AMOS_COLORS.green,
    background: "#ECFDF5",
  },
  at_risk: {
    label: "At risk",
    icon: AlertTriangle,
    color: "#B45309",
    background: "#FFFBEB",
  },
  off_target: {
    label: "Off target",
    icon: XCircle,
    color: AMOS_COLORS.red,
    background: "#FEF2F2",
  },
  not_measured: {
    label: "Not yet measured",
    icon: CircleDashed,
    color: AMOS_COLORS.slate,
    background: "#F1F5F9",
  },
};

const QUALITY_STATUS: Record<
  MgmaQualityStatus,
  { label: string; icon: LucideIcon; color: string; background: string }
> = {
  pass: {
    label: "Passed",
    icon: CheckCircle2,
    color: AMOS_COLORS.green,
    background: "#ECFDF5",
  },
  warning: {
    label: "Review",
    icon: AlertTriangle,
    color: "#B45309",
    background: "#FFFBEB",
  },
  fail: {
    label: "Failed",
    icon: XCircle,
    color: AMOS_COLORS.red,
    background: "#FEF2F2",
  },
  not_measured: {
    label: "Not checked",
    icon: CircleDashed,
    color: AMOS_COLORS.slate,
    background: "#F1F5F9",
  },
};

const SCOPE_COLORS: Record<MgmaScopeViewModel["code"], string> = {
  BHC: AMOS_COLORS.rust,
  GRO: AMOS_COLORS.teal,
  EO: AMOS_COLORS.maroon,
  GAD: AMOS_COLORS.amber,
};

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function formatCount(value: number | null): string {
  return value === null ? "—" : value.toLocaleString("en-US");
}

function formatMetric(
  value: string | number | null,
  unit: string | null,
): string {
  if (value === null || value === "") return "—";
  const rendered =
    typeof value === "number" ? value.toLocaleString("en-US") : value;
  const normalizedUnit = unit?.trim().toLowerCase();
  if (!normalizedUnit) return String(rendered);
  if (
    normalizedUnit === "percentage" ||
    normalizedUnit === "percent" ||
    normalizedUnit === "%"
  ) {
    return String(rendered).includes("%") ? String(rendered) : `${rendered}%`;
  }
  if (
    normalizedUnit === "dollars" ||
    normalizedUnit === "usd" ||
    normalizedUnit === "$"
  ) {
    return String(rendered).startsWith("$") ? String(rendered) : `$${rendered}`;
  }
  return `${rendered} ${unit}`;
}

function scoreLabel(score: number | null): string {
  return score === null ? "Not yet measured" : `${Math.round(score)}%`;
}

function statusPill(status: string, color: string = AMOS_COLORS.slate) {
  return (
    <span
      className="inline-flex max-w-full items-center rounded-full border px-2 py-1 text-[10px] font-semibold leading-none"
      style={{
        borderColor: `${color}40`,
        backgroundColor: `${color}10`,
        color,
      }}
    >
      <span className="truncate">{humanize(status)}</span>
    </span>
  );
}

function EvidenceModeHeader({
  viewMode,
  evidenceLabel,
  isRefreshing,
  onViewModeChange,
  onRefresh,
}: {
  viewMode: MgmaViewMode;
  evidenceLabel: string;
  isRefreshing: boolean;
  onViewModeChange: (viewMode: MgmaViewMode) => void;
  onRefresh: () => void;
}) {
  const synthetic = viewMode === "synthetic_demo";

  return (
    <>
      <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="rounded-[3px] border px-1.5 py-0.5 text-[9px] font-bold"
              style={{
                backgroundColor: `${AMOS_COLORS.maroon}12`,
                borderColor: `${AMOS_COLORS.maroon}35`,
                color: AMOS_COLORS.maroon,
              }}
              aria-hidden="true"
            >
              CO
            </span>
            <h1
              className="text-xl font-bold md:text-[24px]"
              style={{ color: "var(--topbar-title)" }}
            >
              MGMA Executive Scorecard
            </h1>
          </div>
          <p
            className="max-w-3xl text-[13px] leading-5"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Seven-domain practice-management baseline with profit-center
            accountability, corporate-office governance, and traceable KPI
            evidence.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div
            className="inline-flex rounded-lg border p-1"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
            }}
            role="group"
            aria-label="Scorecard evidence mode"
          >
            <button
              type="button"
              onClick={() => onViewModeChange("production_baseline")}
              aria-pressed={viewMode === "production_baseline"}
              className="min-h-9 rounded-md px-3 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor:
                  viewMode === "production_baseline"
                    ? AMOS_COLORS.teal
                    : "transparent",
                color:
                  viewMode === "production_baseline"
                    ? "#FFFFFF"
                    : "var(--topbar-subtitle)",
              }}
            >
              Production Baseline
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("synthetic_demo")}
              aria-pressed={viewMode === "synthetic_demo"}
              className="min-h-9 rounded-md px-3 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              style={{
                backgroundColor:
                  viewMode === "synthetic_demo"
                    ? AMOS_COLORS.amber
                    : "transparent",
                color:
                  viewMode === "synthetic_demo"
                    ? "#FFFFFF"
                    : "var(--topbar-subtitle)",
              }}
            >
              Synthetic Demo
            </button>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border px-3 text-[11px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            style={{
              backgroundColor: "var(--card-bg)",
              borderColor: "var(--card-border)",
              color: "var(--topbar-title)",
            }}
            aria-label="Refresh MGMA scorecard evidence"
          >
            <RefreshCw
              size={13}
              className={isRefreshing ? "animate-spin" : ""}
              aria-hidden="true"
            />
            Refresh
          </button>
        </div>
      </div>

      <div
        className="mb-6 flex items-start gap-3 rounded-xl border px-4 py-3"
        style={{
          backgroundColor: synthetic ? "#FFFBEB" : "#F0FDFA",
          borderColor: synthetic ? "#F59E0B66" : `${AMOS_COLORS.teal}45`,
          color: synthetic ? "#92400E" : "#134E4A",
        }}
        role={synthetic ? "alert" : "status"}
        aria-live="polite"
      >
        {synthetic ? (
          <FlaskConical
            size={19}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
        ) : (
          <LockKeyhole
            size={19}
            className="mt-0.5 shrink-0"
            aria-hidden="true"
          />
        )}
        <div className="min-w-0">
          <div className="text-[12px] font-bold">
            {synthetic
              ? "Synthetic preview — not production evidence"
              : "Production baseline evidence"}
          </div>
          <p className="mt-0.5 text-[11px] leading-5">
            {synthetic
              ? "Preview values are synthetic and must not be used as production, clinical, financial, compliance, or governance evidence. Switch to Production Baseline for governed results."
              : "Only governed production evidence is represented here. Missing evidence is shown as “Not yet measured” and is never converted to a zero score."}
          </p>
          <p className="mt-1 truncate text-[10px] font-medium opacity-80">
            Evidence label: {evidenceLabel}
          </p>
        </div>
      </div>
    </>
  );
}

function LoadingPanel() {
  return (
    <div
      className="flex min-h-64 items-center justify-center rounded-xl border p-8"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="text-center">
        <Loader2
          size={28}
          className="mx-auto mb-3 animate-spin"
          style={{ color: AMOS_COLORS.teal }}
          aria-hidden="true"
        />
        <p
          className="text-[13px] font-semibold"
          style={{ color: "var(--topbar-title)" }}
        >
          Loading governed scorecard evidence
        </p>
        <p
          className="mt-1 text-[11px]"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          Resolving domain mappings, baseline period, quality checks, and
          approvals.
        </p>
      </div>
    </div>
  );
}

function ErrorPanel({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{ backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert
          size={20}
          className="mt-0.5 shrink-0"
          style={{ color: AMOS_COLORS.red }}
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-bold" style={{ color: "#991B1B" }}>
            Scorecard evidence could not be loaded
          </h2>
          <p
            className="mt-1 text-[11px] leading-5"
            style={{ color: "#7F1D1D" }}
          >
            No score has been inferred. Retry the governed dashboard query or
            return later when the evidence service is available.
          </p>
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border px-3 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              backgroundColor: "#FFFFFF",
              borderColor: "#FCA5A5",
              color: "#991B1B",
            }}
          >
            <RefreshCw size={13} aria-hidden="true" />
            Retry scorecard query
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  description,
  trailing,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  trailing?: string;
}) {
  return (
    <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-2.5">
        <div
          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            backgroundColor: `${AMOS_COLORS.teal}12`,
            color: AMOS_COLORS.teal,
          }}
        >
          <Icon size={16} aria-hidden="true" />
        </div>
        <div>
          <h2
            className="text-[14px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            {title}
          </h2>
          <p
            className="mt-0.5 text-[11px] leading-4"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            {description}
          </p>
        </div>
      </div>
      {trailing ? (
        <span
          className="text-[10px] font-semibold"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {trailing}
        </span>
      ) : null}
    </div>
  );
}

function OverallScorePanel({ model }: { model: MgmaScorecardViewModel }) {
  const score = model.overallScore;
  const counts = [
    {
      label: "On target",
      value: model.overallKpis.onTarget,
      color: AMOS_COLORS.green,
    },
    { label: "At risk", value: model.overallKpis.atRisk, color: "#B45309" },
    {
      label: "Off target",
      value: model.overallKpis.offTarget,
      color: AMOS_COLORS.red,
    },
    {
      label: "Not measured",
      value: model.overallKpis.notMeasured,
      color: AMOS_COLORS.slate,
    },
  ];
  const measured =
    (model.overallKpis.onTarget ?? 0) +
    (model.overallKpis.atRisk ?? 0) +
    (model.overallKpis.offTarget ?? 0);

  return (
    <section
      className="mb-7 overflow-hidden rounded-xl border"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
      aria-labelledby="overall-score-heading"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)]">
        <div
          className="border-b p-5 lg:border-r lg:border-b-0"
          style={{ borderColor: "var(--card-border)" }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <Gauge
                  size={15}
                  style={{ color: AMOS_COLORS.teal }}
                  aria-hidden="true"
                />
                <h2
                  id="overall-score-heading"
                  className="text-[11px] font-semibold uppercase tracking-[0.08em]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Overall performance score
                </h2>
              </div>
              <div
                className={
                  score === null
                    ? "mt-3 text-[25px] font-bold"
                    : "mt-1 text-[44px] font-bold leading-none"
                }
                style={{
                  color: score === null ? AMOS_COLORS.slate : AMOS_COLORS.teal,
                }}
                role={score === null ? "status" : "progressbar"}
                aria-label="Overall performance score"
                aria-valuenow={score === null ? undefined : Math.round(score)}
                aria-valuemin={score === null ? undefined : 0}
                aria-valuemax={score === null ? undefined : 100}
              >
                {scoreLabel(score)}
              </div>
              <p
                className="mt-2 max-w-sm text-[11px] leading-5"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                {score === null
                  ? "No governed evidence is available for a defensible production score."
                  : `${formatCount(model.overallKpis.onTarget)} of ${measured.toLocaleString("en-US")} measured KPIs are on target.`}
              </p>
            </div>
            <Sparkles
              size={24}
              style={{ color: `${AMOS_COLORS.amber}AA` }}
              aria-hidden="true"
            />
          </div>

          <div
            className="mt-4 h-2 overflow-hidden rounded-full"
            style={{ backgroundColor: "#E2E8F0" }}
          >
            {score === null ? (
              <div className="h-full w-full bg-slate-200" aria-hidden="true" />
            ) : (
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: `${score}%`,
                  backgroundColor: AMOS_COLORS.teal,
                }}
                aria-hidden="true"
              />
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p
                className="text-[12px] font-bold"
                style={{ color: "var(--topbar-title)" }}
              >
                KPI evidence disposition
              </p>
              <p
                className="mt-0.5 text-[10px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Total configured KPIs: {formatCount(model.overallKpis.total)}
              </p>
            </div>
            {statusPill(model.baselinePeriod.status, AMOS_COLORS.teal)}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {counts.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border p-3"
                style={{
                  borderColor: `${item.color}30`,
                  backgroundColor: `${item.color}08`,
                }}
              >
                <div
                  className="text-[20px] font-bold leading-none"
                  style={{ color: item.color }}
                >
                  {formatCount(item.value)}
                </div>
                <div
                  className="mt-1.5 text-[10px] font-medium"
                  style={{ color: item.color }}
                >
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function ScopeCard({ scope }: { scope: MgmaScopeViewModel }) {
  const color = SCOPE_COLORS[scope.code];
  return (
    <article
      className="rounded-xl border p-4"
      style={{ backgroundColor: "var(--card-bg)", borderColor: `${color}38` }}
      aria-label={`${scope.label} scorecard summary`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 min-w-8 items-center justify-center rounded-md px-1.5 text-[10px] font-bold text-white"
              style={{ backgroundColor: color }}
            >
              {scope.code}
            </span>
            <div className="min-w-0">
              <h3
                className="truncate text-[12px] font-bold"
                style={{ color: "var(--topbar-title)" }}
              >
                {scope.label}
              </h3>
              <p
                className="text-[9px] uppercase tracking-wide"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                {scope.kind === "profit_center"
                  ? "Profit center"
                  : "Corporate office"}
              </p>
            </div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div
            className={
              scope.score === null
                ? "max-w-28 text-[12px] font-bold leading-4"
                : "text-[24px] font-bold leading-none"
            }
            style={{ color: scope.score === null ? AMOS_COLORS.slate : color }}
          >
            {scoreLabel(scope.score)}
          </div>
        </div>
      </div>

      <div
        className="mt-4 grid grid-cols-3 gap-2 border-t pt-3"
        style={{ borderColor: "var(--card-border)" }}
      >
        <div>
          <div
            className="text-[14px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            {formatCount(scope.domainCount)}
          </div>
          <div
            className="text-[9px]"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Domains
          </div>
        </div>
        <div>
          <div
            className="text-[14px] font-bold"
            style={{ color: AMOS_COLORS.green }}
          >
            {formatCount(scope.onTarget)}
          </div>
          <div
            className="text-[9px]"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            On target
          </div>
        </div>
        <div>
          <div
            className="text-[14px] font-bold"
            style={{ color: AMOS_COLORS.slate }}
          >
            {formatCount(scope.totalKpis)}
          </div>
          <div
            className="text-[9px]"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            Total KPIs
          </div>
        </div>
      </div>
      {scope.evidenceLabel ? (
        <p
          className="mt-3 truncate text-[9px]"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {scope.evidenceLabel}
        </p>
      ) : null}
    </article>
  );
}

function ScopeSections({ model }: { model: MgmaScorecardViewModel }) {
  return (
    <div className="mb-8 grid gap-6 xl:grid-cols-2">
      <section aria-labelledby="profit-centers-heading">
        <SectionHeading
          icon={Building2}
          title="Profit Center Scorecards"
          description="Operating performance for revenue- and service-delivery centers."
          trailing="BHC · GRO"
        />
        <span id="profit-centers-heading" className="sr-only">
          Profit Center Scorecards
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          {model.profitCenters.map((scope) => (
            <ScopeCard key={scope.code} scope={scope} />
          ))}
        </div>
      </section>

      <section aria-labelledby="corporate-offices-heading">
        <SectionHeading
          icon={Landmark}
          title="Corporate Office Scorecards"
          description="Enterprise governance and shared-service accountability."
          trailing="EO · GAD"
        />
        <span id="corporate-offices-heading" className="sr-only">
          Corporate Office Scorecards
        </span>
        <div className="grid gap-3 sm:grid-cols-2">
          {model.corporateOffices.map((scope) => (
            <ScopeCard key={scope.code} scope={scope} />
          ))}
        </div>
      </section>
    </div>
  );
}

function MetricStatusPill({ status }: { status: MgmaMetricStatus }) {
  const config = METRIC_STATUS[status];
  const Icon = config.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold"
      style={{ backgroundColor: config.background, color: config.color }}
    >
      <Icon size={10} aria-hidden="true" />
      {config.label}
    </span>
  );
}

function MetadataItem({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="min-w-0">
      <dt
        className="text-[8px] font-bold uppercase tracking-[0.08em]"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {label}
      </dt>
      <dd
        className="mt-0.5 break-words text-[10px] leading-4"
        style={{ color: "var(--topbar-title)" }}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

function KpiRow({ kpi }: { kpi: MgmaKpiViewModel }) {
  const config = METRIC_STATUS[kpi.status];
  return (
    <article
      className="rounded-lg border p-3"
      style={{
        borderColor: `${config.color}25`,
        backgroundColor: `${config.color}05`,
      }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              className="text-[11px] font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              {kpi.name}
            </h4>
            <MetricStatusPill status={kpi.status} />
          </div>
          {kpi.description ? (
            <p
              className="mt-1 text-[10px] leading-4"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {kpi.description}
            </p>
          ) : null}
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-2 sm:min-w-64">
          <div
            className="rounded-md border px-2.5 py-2"
            style={{ borderColor: "var(--card-border)" }}
          >
            <div
              className="text-[8px] font-bold uppercase tracking-wide"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Target
            </div>
            <div
              className="mt-0.5 text-[12px] font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              {formatMetric(kpi.target, kpi.unit)}
            </div>
          </div>
          <div
            className="rounded-md border px-2.5 py-2"
            style={{ borderColor: `${config.color}35` }}
          >
            <div
              className="text-[8px] font-bold uppercase tracking-wide"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Current
            </div>
            <div
              className="mt-0.5 text-[12px] font-bold"
              style={{ color: config.color }}
            >
              {formatMetric(kpi.current, kpi.unit)}
            </div>
          </div>
        </div>
      </div>

      <dl
        className="mt-3 grid gap-3 border-t pt-3 sm:grid-cols-2 lg:grid-cols-5"
        style={{ borderColor: "var(--card-border)" }}
      >
        <MetadataItem label="Formula" value={kpi.formula} />
        <MetadataItem label="Owner" value={kpi.owner} />
        <MetadataItem label="Cadence" value={kpi.cadence} />
        <MetadataItem label="Source" value={kpi.source} />
        <MetadataItem label="Drill-down" value={kpi.drillDown} />
      </dl>
    </article>
  );
}

function DomainCard({ domain }: { domain: MgmaDomainViewModel }) {
  const presentation =
    DOMAIN_PRESENTATION[domain.number - 1] ?? DOMAIN_PRESENTATION[0];
  const Icon = presentation.icon;
  const color = presentation.color;
  const measured = domain.onTarget + domain.atRisk + domain.offTarget;

  return (
    <details
      className="group overflow-hidden rounded-xl border"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
      open={domain.number === 1}
    >
      <summary className="cursor-pointer list-none p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${color}12`, color }}
            >
              <Icon size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="text-[9px] font-bold uppercase tracking-[0.1em]"
                  style={{ color }}
                >
                  Domain {domain.number}
                </span>
                {domain.mappingStatus
                  ? statusPill(domain.mappingStatus, color)
                  : null}
              </div>
              <h3
                className="mt-0.5 text-[13px] font-bold"
                style={{ color: "var(--topbar-title)" }}
              >
                {domain.name}
              </h3>
              {domain.description ? (
                <p
                  className="mt-1 line-clamp-2 text-[10px] leading-4"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  {domain.description}
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 lg:justify-end">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[9px] sm:grid-cols-4">
              <span style={{ color: AMOS_COLORS.green }}>
                {domain.onTarget} on target
              </span>
              <span style={{ color: "#B45309" }}>{domain.atRisk} at risk</span>
              <span style={{ color: AMOS_COLORS.red }}>
                {domain.offTarget} off target
              </span>
              <span style={{ color: AMOS_COLORS.slate }}>
                {domain.notMeasured} unmeasured
              </span>
            </div>
            <div className="min-w-24 text-right">
              <div
                className={
                  domain.score === null
                    ? "text-[11px] font-bold leading-4"
                    : "text-[20px] font-bold leading-none"
                }
                style={{
                  color: domain.score === null ? AMOS_COLORS.slate : color,
                }}
              >
                {scoreLabel(domain.score)}
              </div>
              <div
                className="mt-1 text-[9px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                {measured} measured KPI{measured === 1 ? "" : "s"}
              </div>
            </div>
            <ChevronDown
              size={17}
              className="shrink-0 transition-transform group-open:rotate-180"
              style={{ color: "var(--topbar-subtitle)" }}
              aria-hidden="true"
            />
          </div>
        </div>

        <div
          className="mt-4 grid gap-3 border-t pt-3 sm:grid-cols-2 xl:grid-cols-4"
          style={{ borderColor: "var(--card-border)" }}
        >
          <MetadataItem label="AMOS-OPS surface" value={domain.module} />
          <MetadataItem
            label="Accountable scope"
            value={domain.responsibleScope}
          />
          <MetadataItem label="Accountable owner" value={domain.owner} />
          <MetadataItem label="Drill-down" value={domain.drillDown} />
        </div>
      </summary>

      <div
        className="border-t p-4"
        style={{
          borderColor: "var(--card-border)",
          backgroundColor: `${color}03`,
        }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p
              className="text-[11px] font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              KPI evidence rows
            </p>
            <p
              className="mt-0.5 text-[9px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Target, evidence value, calculation provenance, and accountable
              workflow.
            </p>
          </div>
          <span className="text-[10px] font-semibold" style={{ color }}>
            {domain.kpis.length} configured
          </span>
        </div>
        {domain.kpis.length > 0 ? (
          <div className="space-y-2">
            {domain.kpis.map((kpi) => (
              <KpiRow key={kpi.id} kpi={kpi} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-lg border border-dashed px-4 py-6 text-center"
            style={{ borderColor: "var(--card-border)" }}
          >
            <CircleDashed
              size={18}
              className="mx-auto mb-2"
              style={{ color: AMOS_COLORS.slate }}
              aria-hidden="true"
            />
            <p
              className="text-[11px] font-semibold"
              style={{ color: "var(--topbar-title)" }}
            >
              No governed KPI evidence available
            </p>
            <p
              className="mt-1 text-[9px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              The domain mapping remains visible without inferring a score.
            </p>
          </div>
        )}
      </div>
    </details>
  );
}

function DomainSection({ domains }: { domains: MgmaDomainViewModel[] }) {
  return (
    <section className="mb-8" aria-labelledby="domain-mapping-heading">
      <SectionHeading
        icon={Layers3}
        title="Seven-Domain Mapping & KPI Evidence"
        description="Each MGMA domain is mapped to an accountable AMOS-OPS surface and drill-down path."
        trailing={`${domains.length} domain mappings`}
      />
      <span id="domain-mapping-heading" className="sr-only">
        Seven-Domain Mapping and KPI Evidence
      </span>
      <div className="space-y-3">
        {domains.map((domain) => (
          <DomainCard key={domain.id} domain={domain} />
        ))}
      </div>
    </section>
  );
}

function QualityCheck({ check }: { check: MgmaDataQualityViewModel }) {
  const config = QUALITY_STATUS[check.status];
  const Icon = config.icon;
  return (
    <li
      className="flex items-start gap-3 rounded-lg border p-3"
      style={{
        borderColor: `${config.color}28`,
        backgroundColor: `${config.color}05`,
      }}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: config.background, color: config.color }}
      >
        <Icon size={14} aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span
            className="text-[11px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            {check.label}
          </span>
          <span
            className="text-[9px] font-bold"
            style={{ color: config.color }}
          >
            {config.label}
            {check.value !== null ? ` · ${check.value}` : ""}
          </span>
        </div>
        <p
          className="mt-1 text-[9px] leading-4"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {check.detail ?? "No governed check result has been supplied."}
        </p>
      </div>
    </li>
  );
}

function DataQualityPanel({
  checks,
  status,
}: {
  checks: MgmaDataQualityViewModel[];
  status: string;
}) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
      aria-labelledby="data-quality-heading"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `${AMOS_COLORS.cyan}12`,
              color: AMOS_COLORS.cyan,
            }}
          >
            <Database size={17} aria-hidden="true" />
          </div>
          <div>
            <h2
              id="data-quality-heading"
              className="text-[13px] font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              Data-Quality Gate
            </h2>
            <p
              className="mt-0.5 text-[10px] leading-4"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Five mandatory checks determine whether baseline evidence is
              decision-ready.
            </p>
          </div>
        </div>
        {statusPill(status, AMOS_COLORS.cyan)}
      </div>
      <ul className="space-y-2">
        {checks.map((check) => (
          <QualityCheck key={check.id} check={check} />
        ))}
      </ul>
    </section>
  );
}

function ApprovalCount({
  label,
  value,
  color,
}: {
  label: string;
  value: number | null;
  color: string;
}) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: `${color}28`, backgroundColor: `${color}05` }}
    >
      <div className="text-[16px] font-bold" style={{ color }}>
        {formatCount(value)}
      </div>
      <div
        className="mt-0.5 text-[9px]"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {label}
      </div>
    </div>
  );
}

function GovernancePanel({ model }: { model: MgmaScorecardViewModel }) {
  return (
    <section
      className="rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
      aria-labelledby="governance-heading"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{
              backgroundColor: `${AMOS_COLORS.maroon}10`,
              color: AMOS_COLORS.maroon,
            }}
          >
            <ClipboardCheck size={17} aria-hidden="true" />
          </div>
          <div>
            <h2
              id="governance-heading"
              className="text-[13px] font-bold"
              style={{ color: "var(--topbar-title)" }}
            >
              Baseline Governance & Approval
            </h2>
            <p
              className="mt-0.5 text-[10px] leading-4"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Period lock, review state, and accountable approval trail.
            </p>
          </div>
        </div>
        {statusPill(model.approvals.status, AMOS_COLORS.maroon)}
      </div>

      <div
        className="rounded-lg border p-3"
        style={{ borderColor: "var(--card-border)" }}
      >
        <div className="mb-3 flex items-center gap-2">
          <CalendarDays
            size={14}
            style={{ color: AMOS_COLORS.teal }}
            aria-hidden="true"
          />
          <span
            className="text-[11px] font-bold"
            style={{ color: "var(--topbar-title)" }}
          >
            Baseline period
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <div
              className="text-[8px] font-bold uppercase tracking-wide"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Period start
            </div>
            <div
              className="mt-1 text-[11px] font-semibold"
              style={{ color: "var(--topbar-title)" }}
            >
              {formatDate(model.baselinePeriod.start)}
            </div>
          </div>
          <div>
            <div
              className="text-[8px] font-bold uppercase tracking-wide"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Period end
            </div>
            <div
              className="mt-1 text-[11px] font-semibold"
              style={{ color: "var(--topbar-title)" }}
            >
              {formatDate(model.baselinePeriod.end)}
            </div>
          </div>
        </div>
        <div
          className="mt-3 flex flex-wrap gap-2 border-t pt-3"
          style={{ borderColor: "var(--card-border)" }}
        >
          {statusPill(model.baselinePeriod.status, AMOS_COLORS.teal)}
          {statusPill(model.baselinePeriod.approvalStatus, AMOS_COLORS.maroon)}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ApprovalCount
          label="Required"
          value={model.approvals.required}
          color={AMOS_COLORS.slate}
        />
        <ApprovalCount
          label="Approved"
          value={model.approvals.approved}
          color={AMOS_COLORS.green}
        />
        <ApprovalCount
          label="Pending"
          value={model.approvals.pending}
          color={AMOS_COLORS.amber}
        />
        <ApprovalCount
          label="Rejected"
          value={model.approvals.rejected}
          color={AMOS_COLORS.red}
        />
      </div>

      <dl
        className="mt-3 grid gap-3 rounded-lg border p-3 sm:grid-cols-3"
        style={{ borderColor: "var(--card-border)" }}
      >
        <MetadataItem
          label="Last approved by"
          value={model.approvals.approvedBy}
        />
        <MetadataItem
          label="Last approval"
          value={formatDate(model.approvals.lastApprovedAt)}
        />
        <MetadataItem
          label="Next review"
          value={formatDate(model.approvals.nextReviewAt)}
        />
      </dl>

      {model.approvals.items.length > 0 ? (
        <ol className="mt-3 space-y-2" aria-label="Approval workflow">
          {model.approvals.items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--card-border)" }}
            >
              <div className="min-w-0">
                <div
                  className="truncate text-[10px] font-semibold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  {item.label}
                </div>
                <div
                  className="mt-0.5 text-[9px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  {item.owner ?? "Owner not assigned"}
                  {item.decidedAt ? ` · ${formatDate(item.decidedAt)}` : ""}
                </div>
              </div>
              {statusPill(item.status, AMOS_COLORS.maroon)}
            </li>
          ))}
        </ol>
      ) : (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[10px]"
          style={{
            borderColor: "var(--card-border)",
            color: "var(--topbar-subtitle)",
          }}
        >
          <FileCheck2 size={14} aria-hidden="true" />
          Approval steps have not yet been supplied for this baseline.
        </div>
      )}
    </section>
  );
}

function FooterNote({ viewMode }: { viewMode: MgmaViewMode }) {
  return (
    <div
      className="mt-6 flex flex-col gap-2 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="flex items-start gap-2">
        {viewMode === "production_baseline" ? (
          <ShieldCheck
            size={14}
            className="mt-0.5 shrink-0"
            style={{ color: AMOS_COLORS.teal }}
          />
        ) : (
          <FlaskConical
            size={14}
            className="mt-0.5 shrink-0"
            style={{ color: AMOS_COLORS.amber }}
          />
        )}
        <p
          className="text-[9px] leading-4"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {viewMode === "production_baseline"
            ? "Scores appear only when governed production evidence supports a measured denominator."
            : "Synthetic values are isolated preview data and are never promoted to production evidence."}
        </p>
      </div>
      <div
        className="flex items-center gap-1 text-[9px] font-semibold"
        style={{ color: AMOS_COLORS.teal }}
      >
        MGMA Body of Knowledge mapping
        <ArrowRight size={11} aria-hidden="true" />
        AMOS-OPS governance
      </div>
    </div>
  );
}

export function MgmaScorecardView({
  model,
  viewMode,
  queryState,
  isRefreshing,
  onViewModeChange,
  onRefresh,
}: {
  model: MgmaScorecardViewModel;
  viewMode: MgmaViewMode;
  queryState: "loading" | "error" | "ready";
  isRefreshing: boolean;
  onViewModeChange: (viewMode: MgmaViewMode) => void;
  onRefresh: () => void;
}) {
  return (
    <div className="px-4 pt-4 pb-8 md:px-6">
      <EvidenceModeHeader
        viewMode={viewMode}
        evidenceLabel={model.evidenceLabel}
        isRefreshing={isRefreshing}
        onViewModeChange={onViewModeChange}
        onRefresh={onRefresh}
      />

      {queryState === "loading" ? <LoadingPanel /> : null}
      {queryState === "error" ? <ErrorPanel onRetry={onRefresh} /> : null}
      {queryState === "ready" ? (
        <>
          <OverallScorePanel model={model} />
          <ScopeSections model={model} />
          <DomainSection domains={model.domains} />
          <div className="grid gap-5 xl:grid-cols-2">
            <DataQualityPanel
              checks={model.dataQuality}
              status={model.dataQualityStatus}
            />
            <GovernancePanel model={model} />
          </div>
          <FooterNote viewMode={model.viewMode} />
        </>
      ) : null}
    </div>
  );
}
