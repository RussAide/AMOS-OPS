import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Eye,
  FileWarning,
  HeartHandshake,
  ListChecks,
  LockKeyhole,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";
import {
  ccmgAcceptanceChecks,
  type CcmgDashboardViewModel,
  type CcmgMetricViewModel,
  type CcmgQueueKind,
  type CcmgQueueViewModel,
  type CcmgTone,
} from "./ccmg-oversight-model";

const COLORS = {
  teal: "#245C5A",
  rust: "#C45C4A",
  maroon: "#991B1B",
  amber: "#D97706",
  green: "#047857",
  slate: "#64748B",
} as const;

const QUEUE_ICONS = {
  intake: HeartHandshake,
  qa: ShieldCheck,
  cans: ClipboardCheck,
  medication: FileWarning,
  mhtcm: UsersRound,
  mhrs: ListChecks,
} satisfies Record<CcmgQueueKind, typeof HeartHandshake>;

const TONE_STYLE: Record<CcmgTone, { color: string; background: string }> = {
  neutral: { color: COLORS.teal, background: "#F0FDFA" },
  positive: { color: COLORS.green, background: "#ECFDF5" },
  warning: { color: "#B45309", background: "#FFFBEB" },
  critical: { color: "#B91C1C", background: "#FEF2F2" },
};

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(parsed);
}

function statusColor(status: string): string {
  const normalized = status.toLowerCase();
  if (/overdue|blocked|rejected|critical|failed/.test(normalized))
    return "#B91C1C";
  if (/pending|review|due|hold|conditional|approval/.test(normalized))
    return "#B45309";
  if (/complete|approved|ready|active|current/.test(normalized))
    return COLORS.green;
  return COLORS.slate;
}

function StatusPill({ value }: { value: string }) {
  const color = statusColor(value);
  return (
    <span
      className="inline-flex max-w-full rounded-full border px-2 py-1 text-[10px] font-semibold leading-none"
      style={{
        color,
        borderColor: `${color}40`,
        backgroundColor: `${color}0D`,
      }}
    >
      <span className="truncate">{humanize(value)}</span>
    </span>
  );
}

function MetricCard({ metric }: { metric: CcmgMetricViewModel }) {
  const style = TONE_STYLE[metric.tone];
  return (
    <article
      className="min-w-0 rounded-xl border p-4"
      style={{
        backgroundColor: "var(--card-bg)",
        borderColor: "var(--card-border)",
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p
          className="truncate text-[10px] font-semibold uppercase tracking-[1px]"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {metric.label}
        </p>
        <span
          className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          style={{ backgroundColor: style.color }}
          aria-hidden="true"
        />
      </div>
      <p
        className="text-[26px] font-bold leading-none"
        style={{ color: style.color }}
      >
        {metric.value ?? "—"}
      </p>
      <p
        className="mt-2 min-h-4 text-[10px]"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {metric.detail ?? "Visible within authenticated queue scope"}
      </p>
    </article>
  );
}

function QueueSummaryCard({
  queue,
  active,
  onSelect,
}: {
  queue: CcmgQueueViewModel;
  active: boolean;
  onSelect: () => void;
}) {
  const Icon = QUEUE_ICONS[queue.kind];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className="min-w-0 rounded-xl border p-4 text-left transition-shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
      style={{
        backgroundColor: active ? "#F0FDFA" : "var(--card-bg)",
        borderColor: active ? `${COLORS.teal}99` : "var(--card-border)",
        boxShadow: active ? `inset 0 0 0 1px ${COLORS.teal}22` : undefined,
      }}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ backgroundColor: `${COLORS.teal}12`, color: COLORS.teal }}
        >
          {queue.visible ? (
            <Icon size={17} aria-hidden="true" />
          ) : (
            <LockKeyhole size={16} />
          )}
        </span>
        <span
          className="text-xl font-bold"
          style={{ color: "var(--topbar-title)" }}
        >
          {queue.visible ? queue.count : "—"}
        </span>
      </div>
      <p
        className="truncate text-[12px] font-bold"
        style={{ color: "var(--topbar-title)" }}
      >
        {queue.label}
      </p>
      <p
        className="mt-1 line-clamp-2 min-h-8 text-[10px] leading-4"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {queue.visible
          ? queue.description
          : queue.available
            ? "Not visible for this authenticated role."
            : "Queue evidence was not returned by the oversight service."}
      </p>
      <div className="mt-3 flex items-center gap-3 text-[9px] font-semibold uppercase tracking-[0.5px]">
        <span style={{ color: queue.overdue > 0 ? "#B91C1C" : COLORS.slate }}>
          {queue.visible ? queue.overdue : "—"} overdue
        </span>
        <span
          style={{ color: queue.highAcuity > 0 ? "#B45309" : COLORS.slate }}
        >
          {queue.visible ? queue.highAcuity : "—"} urgent
        </span>
      </div>
    </button>
  );
}

function QueueTable({
  queue,
  search,
}: {
  queue: CcmgQueueViewModel;
  search: string;
}) {
  const items = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return queue.items;
    return queue.items.filter((item) =>
      [
        item.youthAlias,
        item.recordLabel,
        item.status,
        item.acuity,
        item.assignedRole,
        item.assignedTo,
        ...item.exceptions,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle)),
    );
  }, [queue.items, search]);

  if (!queue.visible) {
    return (
      <div className="flex min-h-56 flex-col items-center justify-center px-6 text-center">
        <LockKeyhole
          size={28}
          style={{ color: COLORS.slate }}
          aria-hidden="true"
        />
        <h3
          className="mt-3 text-[14px] font-bold"
          style={{ color: "var(--topbar-title)" }}
        >
          {queue.available
            ? "Queue restricted by role scope"
            : "Queue evidence unavailable"}
        </h3>
        <p
          className="mt-1 max-w-lg text-[11px]"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {queue.available
            ? "The queue summary remains visible to show the complete oversight model, but counts and records are withheld for this authenticated role."
            : "The oversight response did not include this queue, so the interface does not infer a zero count or fabricate queue items."}
        </p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-48 flex-col items-center justify-center px-6 text-center">
        <Search size={24} style={{ color: COLORS.slate }} aria-hidden="true" />
        <p
          className="mt-3 text-[12px] font-semibold"
          style={{ color: "var(--topbar-title)" }}
        >
          No queue items match this filter.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] border-collapse text-left">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
            {[
              "Record",
              "Status",
              "Acuity",
              "Assignment",
              "Due",
              "Exceptions",
              "",
            ].map((label) => (
              <th
                key={label || "actions"}
                className="px-4 py-3 text-[9px] font-semibold uppercase tracking-[1px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="transition-colors hover:bg-black/[0.02]"
              style={{ borderBottom: "1px solid var(--card-border)" }}
            >
              <td className="px-4 py-3">
                <p
                  className="text-[12px] font-semibold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  {item.youthAlias}
                </p>
                <p
                  className="mt-0.5 text-[9px] font-medium"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  {item.recordLabel}
                </p>
              </td>
              <td className="px-4 py-3">
                <StatusPill value={item.status} />
              </td>
              <td
                className="px-4 py-3 text-[11px] font-semibold"
                style={{ color: statusColor(item.acuity) }}
              >
                {humanize(item.acuity)}
              </td>
              <td className="px-4 py-3">
                <p
                  className="text-[11px] font-semibold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  {item.assignedTo ?? "Unassigned"}
                </p>
                <p
                  className="mt-0.5 text-[9px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  {item.assignedRole ? humanize(item.assignedRole) : "No role"}
                </p>
              </td>
              <td
                className="px-4 py-3 text-[10px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                {formatDateTime(item.dueAt)}
              </td>
              <td className="max-w-48 px-4 py-3">
                {item.exceptions.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {item.exceptions.map((exception) => (
                      <span
                        key={exception}
                        className="rounded border px-1.5 py-1 text-[9px] font-semibold"
                        style={{
                          color: "#B91C1C",
                          borderColor: "#FCA5A5",
                          backgroundColor: "#FEF2F2",
                        }}
                      >
                        {humanize(exception)}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-[10px]" style={{ color: COLORS.slate }}>
                    None
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <Link
                  to={`/ccmg/referrals/${encodeURIComponent(item.referralId)}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-md border px-2.5 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  style={{
                    color: COLORS.teal,
                    borderColor: `${COLORS.teal}55`,
                  }}
                >
                  Review <ArrowRight size={12} aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CcmgOversightView({
  model,
  authenticatedRoleLabel,
  queryState,
  isRefreshing,
  fallbackNotice,
  onRefresh,
}: {
  model: CcmgDashboardViewModel;
  authenticatedRoleLabel: string;
  queryState: "loading" | "error" | "ready";
  isRefreshing: boolean;
  fallbackNotice?: string;
  onRefresh: () => void;
}) {
  const firstVisible =
    model.queues.find((queue) => queue.visible)?.kind ?? "intake";
  const [selectedQueue, setSelectedQueue] =
    useState<CcmgQueueKind>(firstVisible);
  const [search, setSearch] = useState("");
  const queue =
    model.queues.find((entry) => entry.kind === selectedQueue) ??
    model.queues[0];
  const checks = ccmgAcceptanceChecks(model);
  const synthetic = model.evidenceMode === "synthetic_demo";

  return (
    <main className="p-4 md:p-6" aria-labelledby="ccmg-title">
      <div className="mx-auto max-w-[1500px]">
        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-2">
              <span
                className="rounded-[3px] border px-1.5 py-0.5 text-[9px] font-bold"
                style={{
                  color: COLORS.rust,
                  borderColor: `${COLORS.rust}55`,
                  backgroundColor: `${COLORS.rust}10`,
                }}
              >
                PC · BHC
              </span>
              <h1
                id="ccmg-title"
                className="text-xl font-bold md:text-[24px]"
                style={{ color: "var(--topbar-title)" }}
              >
                CCMG Oversight Command Center
              </h1>
            </div>
            <p
              className="max-w-3xl text-[13px] leading-5"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              Role-scoped operational oversight across intake, QA, CANS,
              medication management, MHTCM, and MHRS.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-semibold"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--topbar-title)",
              }}
            >
              <Eye
                size={13}
                style={{ color: COLORS.teal }}
                aria-hidden="true"
              />
              {authenticatedRoleLabel}
            </span>
            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
                color: "var(--topbar-title)",
              }}
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

        {(synthetic || fallbackNotice) && (
          <div
            className="mb-5 flex items-start gap-3 rounded-xl border px-4 py-3"
            style={{ backgroundColor: "#FFFBEB", borderColor: "#F59E0B66" }}
            role="status"
          >
            <Sparkles
              size={17}
              style={{ color: COLORS.amber }}
              className="mt-0.5 flex-shrink-0"
              aria-hidden="true"
            />
            <div>
              <p className="text-[11px] font-bold" style={{ color: "#92400E" }}>
                {model.evidenceLabel}
              </p>
              <p
                className="mt-0.5 text-[10px] leading-4"
                style={{ color: "#A16207" }}
              >
                {fallbackNotice ??
                  "Every alias, identifier, count, timestamp, and event on this surface is fictional demo data."}
              </p>
            </div>
          </div>
        )}

        {queryState === "loading" ? (
          <div
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
            aria-label="Loading CCMG metrics"
          >
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-28 animate-pulse rounded-xl border bg-black/[0.04]"
                style={{ borderColor: "var(--card-border)" }}
              />
            ))}
          </div>
        ) : queryState === "error" ? (
          <div
            className="rounded-xl border p-6 text-center"
            style={{ backgroundColor: "#FEF2F2", borderColor: "#FCA5A5" }}
          >
            <AlertTriangle
              className="mx-auto"
              size={26}
              style={{ color: "#B91C1C" }}
              aria-hidden="true"
            />
            <h2
              className="mt-3 text-[14px] font-bold"
              style={{ color: "#991B1B" }}
            >
              CCMG oversight evidence is unavailable
            </h2>
            <p className="mt-1 text-[11px]" style={{ color: "#B91C1C" }}>
              No production data was replaced. Retry the authenticated connector
              when it becomes available.
            </p>
          </div>
        ) : (
          <>
            <section aria-labelledby="role-metrics-heading">
              <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2
                    id="role-metrics-heading"
                    className="text-[14px] font-bold"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    Role-appropriate operating metrics
                  </h2>
                  <p
                    className="mt-0.5 text-[10px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    {model.scopeLabel} · Generated{" "}
                    {formatDateTime(model.generatedAt)}
                  </p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {model.metrics.map((metric) => (
                  <MetricCard key={metric.id} metric={metric} />
                ))}
              </div>
            </section>

            <section className="mt-7" aria-labelledby="queue-heading">
              <div className="mb-3">
                <h2
                  id="queue-heading"
                  className="text-[14px] font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  Oversight queues
                </h2>
                <p
                  className="mt-0.5 text-[10px]"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Select a queue to review assignment, due-date, acuity,
                  authorization, and exception signals.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                {model.queues.map((entry) => (
                  <QueueSummaryCard
                    key={entry.kind}
                    queue={entry}
                    active={entry.kind === queue?.kind}
                    onSelect={() => setSelectedQueue(entry.kind)}
                  />
                ))}
              </div>
            </section>

            {queue && (
              <section
                className="mt-4 overflow-hidden rounded-xl border"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                }}
                aria-labelledby="selected-queue-heading"
              >
                <div
                  className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <div>
                    <h2
                      id="selected-queue-heading"
                      className="text-[14px] font-bold"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      {queue.label} queue
                    </h2>
                    <p
                      className="mt-0.5 text-[10px]"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      {queue.description}
                    </p>
                  </div>
                  <label className="relative block w-full sm:w-72">
                    <span className="sr-only">Filter selected queue</span>
                    <Search
                      className="absolute left-3 top-1/2 -translate-y-1/2"
                      size={13}
                      style={{ color: COLORS.slate }}
                      aria-hidden="true"
                    />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Filter queue"
                      className="min-h-9 w-full rounded-lg border bg-transparent pl-9 pr-3 text-[11px] outline-none focus:ring-2"
                      style={{
                        borderColor: "var(--card-border)",
                        color: "var(--topbar-title)",
                      }}
                    />
                  </label>
                </div>
                <QueueTable queue={queue} search={search} />
              </section>
            )}

            <section
              className="mt-7 rounded-xl border p-4"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
              aria-labelledby="acceptance-heading"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  size={16}
                  style={{ color: COLORS.teal }}
                  aria-hidden="true"
                />
                <h2
                  id="acceptance-heading"
                  className="text-[13px] font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  M2.1 surface coverage self-check
                </h2>
              </div>
              <p
                className="mt-1 text-[9px] leading-4"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Informational UI coverage only; this is not owner acceptance or
                milestone proof.
              </p>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {checks.map((check) => (
                  <div
                    key={check.id}
                    className="flex items-start gap-2 rounded-lg border px-3 py-2.5"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    {check.passed ? (
                      <CheckCircle2
                        size={14}
                        className="mt-0.5 flex-shrink-0"
                        style={{ color: COLORS.green }}
                        aria-hidden="true"
                      />
                    ) : (
                      <Clock3
                        size={14}
                        className="mt-0.5 flex-shrink-0"
                        style={{ color: COLORS.amber }}
                        aria-hidden="true"
                      />
                    )}
                    <p
                      className="text-[10px] font-medium leading-4"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      {check.label}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
