import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileClock,
  GitBranch,
  History,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from "lucide-react";
import {
  ccmgDetailCoverageChecks,
  type CcmgReferralDetailViewModel,
} from "./ccmg-oversight-model";
import {
  CcmgCarePathActions,
  type CcmgCarePathActionRequest,
} from "./ccmg-care-path-actions";
import {
  CcmgWorkflowActions,
  type CcmgWorkflowActionRequest,
} from "./ccmg-workflow-actions";

const COLORS = {
  teal: "#245C5A",
  rust: "#C45C4A",
  maroon: "#991B1B",
  amber: "#D97706",
  green: "#047857",
  slate: "#64748B",
} as const;

function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function versionLabel(value: string | number): string {
  const rendered = String(value);
  return /^v(?:ersion)?\s*/i.test(rendered) ? rendered : `v${rendered}`;
}

function numericVersion(value: string | number): number {
  if (typeof value === "number") return value;
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : 0;
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(parsed);
}

function statusColor(status: string | null): string {
  const normalized = status?.toLowerCase() ?? "";
  if (/overdue|blocked|rejected|critical|failed|incomplete/.test(normalized))
    return "#B91C1C";
  if (/pending|review|due|hold|conditional|approval/.test(normalized))
    return "#B45309";
  if (/complete|approved|ready|active|current|verified/.test(normalized))
    return COLORS.green;
  return COLORS.slate;
}

function StatusPill({ value }: { value: string | null }) {
  const rendered = value ?? "not set";
  const color = statusColor(rendered);
  return (
    <span
      className="inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold leading-none"
      style={{
        color,
        borderColor: `${color}40`,
        backgroundColor: `${color}0D`,
      }}
    >
      {humanize(rendered)}
    </span>
  );
}

function DetailField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="min-w-0">
      <p
        className="text-[9px] font-semibold uppercase tracking-[0.8px]"
        style={{ color: "var(--topbar-subtitle)" }}
      >
        {label}
      </p>
      <p
        className="mt-1 break-words text-[11px] font-semibold"
        style={{ color: "var(--topbar-title)" }}
      >
        {value ?? "—"}
      </p>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  detail,
}: {
  icon: typeof ClipboardCheck;
  title: string;
  detail: string;
}) {
  return (
    <div className="mb-4 flex items-start gap-2">
      <span
        className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
        style={{ color: COLORS.teal, backgroundColor: `${COLORS.teal}12` }}
      >
        <Icon size={15} aria-hidden="true" />
      </span>
      <div>
        <h2
          className="text-[13px] font-bold"
          style={{ color: "var(--topbar-title)" }}
        >
          {title}
        </h2>
        <p
          className="mt-0.5 text-[10px] leading-4"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {detail}
        </p>
      </div>
    </div>
  );
}

export function CcmgReferralDetailView({
  model,
  authenticatedRoleLabel,
  queryState,
  isRefreshing,
  fallbackNotice,
  carePathEnabled,
  carePathDisabledReason,
  carePathSubmitting,
  carePathError,
  carePathSuccess,
  actionsEnabled,
  actionsDisabledReason,
  actionSubmitting,
  actionError,
  actionSuccess,
  onWorkflowAction,
  onCarePathAction,
  onRefresh,
}: {
  model: CcmgReferralDetailViewModel;
  authenticatedRoleLabel: string;
  queryState: "loading" | "error" | "ready";
  isRefreshing: boolean;
  fallbackNotice?: string;
  carePathEnabled: boolean;
  carePathDisabledReason?: string;
  carePathSubmitting: boolean;
  carePathError?: string;
  carePathSuccess?: string;
  actionsEnabled: boolean;
  actionsDisabledReason?: string;
  actionSubmitting: boolean;
  actionError?: string;
  actionSuccess?: string;
  onWorkflowAction: (request: CcmgWorkflowActionRequest) => Promise<void>;
  onCarePathAction: (request: CcmgCarePathActionRequest) => Promise<void>;
  onRefresh: () => void;
}) {
  const synthetic = model.evidenceMode === "synthetic_demo";
  const checks = ccmgDetailCoverageChecks(model);
  const latestCansAssessment = model.cansLineage.reduce<
    (typeof model.cansLineage)[number] | null
  >(
    (latest, assessment) =>
      !latest ||
      numericVersion(assessment.assessmentVersion) >
        numericVersion(latest.assessmentVersion)
        ? assessment
        : latest,
    null,
  );

  return (
    <main className="p-4 md:p-6" aria-labelledby="referral-detail-title">
      <div className="mx-auto max-w-[1380px]">
        <Link
          to="/ccmg"
          className="mb-4 inline-flex min-h-8 items-center gap-1.5 rounded-md px-1 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2"
          style={{ color: COLORS.teal }}
        >
          <ArrowLeft size={13} aria-hidden="true" /> Back to oversight queues
        </Link>

        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span
                className="rounded-[3px] border px-1.5 py-0.5 text-[9px] font-bold"
                style={{
                  color: COLORS.rust,
                  borderColor: `${COLORS.rust}55`,
                  backgroundColor: `${COLORS.rust}10`,
                }}
              >
                CCMG DRILL-IN
              </span>
              <StatusPill value={model.workflow.status} />
            </div>
            <h1
              id="referral-detail-title"
              className="text-xl font-bold md:text-[24px]"
              style={{ color: "var(--topbar-title)" }}
            >
              {model.youthAlias}
            </h1>
            <p
              className="mt-1 text-[11px]"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {model.recordLabel} · {model.program ?? "CCMG continuum"} · Viewed
              as {authenticatedRoleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex min-h-9 w-fit items-center gap-2 rounded-lg border px-3 text-[10px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
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
            Refresh trace
          </button>
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
                  "This referral, workflow, CANS lineage, and audit history are entirely fictional."}
              </p>
            </div>
          </div>
        )}

        {queryState === "loading" ? (
          <div className="space-y-4" aria-label="Loading referral trace">
            {[160, 240, 280].map((height) => (
              <div
                key={height}
                className="animate-pulse rounded-xl border bg-black/[0.04]"
                style={{ height, borderColor: "var(--card-border)" }}
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
              Referral trace is unavailable or outside your role scope
            </h2>
            <p className="mt-1 text-[11px]" style={{ color: "#B91C1C" }}>
              No synthetic record was substituted outside evaluation mode.
            </p>
          </div>
        ) : (
          <>
            <section
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
              aria-label="Referral overview"
            >
              {[
                {
                  label: "Workflow stage",
                  value: humanize(model.workflow.stage),
                  tone: COLORS.teal,
                },
                {
                  label: "Acuity",
                  value: humanize(model.acuity),
                  tone: statusColor(model.acuity),
                },
                {
                  label: "Authorization",
                  value: humanize(model.authorizationStatus ?? "not set"),
                  tone: statusColor(model.authorizationStatus),
                },
                {
                  label: "Due date",
                  value: formatDateTime(model.workflow.dueAt),
                  tone: model.workflow.dueAt ? COLORS.amber : COLORS.slate,
                },
              ].map((item) => (
                <article
                  key={item.label}
                  className="rounded-xl border p-4"
                  style={{
                    backgroundColor: "var(--card-bg)",
                    borderColor: "var(--card-border)",
                  }}
                >
                  <p
                    className="text-[9px] font-semibold uppercase tracking-[0.8px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="mt-2 text-[14px] font-bold"
                    style={{ color: item.tone }}
                  >
                    {item.value}
                  </p>
                </article>
              ))}
            </section>

            <div className="mt-4 grid gap-4 xl:grid-cols-[1.05fr_1.95fr]">
              <section
                className="rounded-xl border p-4"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                }}
              >
                <SectionHeader
                  icon={UserRoundCheck}
                  title="Workflow accountability"
                  detail="Current assignment, approval, due date, exception, and handoff context."
                />
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <DetailField
                    label="Status"
                    value={humanize(model.workflow.status)}
                  />
                  <DetailField
                    label="Current stage"
                    value={humanize(model.workflow.stage)}
                  />
                  <DetailField
                    label="Assigned to"
                    value={model.workflow.assignedTo ?? "Unassigned"}
                  />
                  <DetailField
                    label="Assigned role"
                    value={
                      model.workflow.assignedRole
                        ? humanize(model.workflow.assignedRole)
                        : null
                    }
                  />
                  <DetailField
                    label="Due"
                    value={formatDateTime(model.workflow.dueAt)}
                  />
                  <DetailField
                    label="Approval"
                    value={
                      model.workflow.approvalStatus
                        ? humanize(model.workflow.approvalStatus)
                        : null
                    }
                  />
                </div>
                <div
                  className="mt-4 rounded-lg border p-3"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  <p
                    className="text-[9px] font-semibold uppercase tracking-[0.8px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Handoff
                  </p>
                  <p
                    className="mt-1 text-[10px] leading-4"
                    style={{ color: "var(--topbar-title)" }}
                  >
                    {model.workflow.handoff ?? "No active handoff"}
                  </p>
                </div>
                <div className="mt-3">
                  <p
                    className="text-[9px] font-semibold uppercase tracking-[0.8px]"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    Exception flags
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {model.workflow.exceptions.length > 0 ? (
                      model.workflow.exceptions.map((exception) => (
                        <span
                          key={exception}
                          className="rounded border px-2 py-1 text-[9px] font-semibold"
                          style={{
                            color: "#B91C1C",
                            borderColor: "#FCA5A5",
                            backgroundColor: "#FEF2F2",
                          }}
                        >
                          {humanize(exception)}
                        </span>
                      ))
                    ) : (
                      <span
                        className="text-[10px]"
                        style={{ color: COLORS.slate }}
                      >
                        No open exceptions
                      </span>
                    )}
                  </div>
                </div>
              </section>

              <section
                className="rounded-xl border p-4"
                style={{
                  backgroundColor: "var(--card-bg)",
                  borderColor: "var(--card-border)",
                }}
              >
                <SectionHeader
                  icon={ClipboardCheck}
                  title="Readiness gates"
                  detail="Intake, eligibility, authorization, consent, CANS, and capacity evidence."
                />
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {model.gates.map((gate, index) => (
                    <article
                      key={gate.id}
                      className="rounded-lg border p-3"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className="text-[9px] font-bold"
                          style={{ color: COLORS.slate }}
                        >
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <StatusPill value={gate.status} />
                      </div>
                      <h3
                        className="mt-3 text-[12px] font-bold"
                        style={{ color: "var(--topbar-title)" }}
                      >
                        {gate.label}
                      </h3>
                      <p
                        className="mt-1 min-h-8 text-[10px] leading-4"
                        style={{ color: "var(--topbar-subtitle)" }}
                      >
                        {gate.detail ?? "No supporting detail returned."}
                      </p>
                      <div
                        className="mt-3 border-t pt-2 text-[9px]"
                        style={{
                          borderColor: "var(--card-border)",
                          color: COLORS.slate,
                        }}
                      >
                        <p>
                          {gate.owner ? humanize(gate.owner) : "Owner not set"}
                        </p>
                        <p className="mt-0.5">
                          {formatDateTime(gate.updatedAt)}
                        </p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>

            <CcmgCarePathActions
              key={`${model.referralVersion ?? "none"}-${latestCansAssessment?.id ?? "no-cans"}`}
              referralId={model.referralId}
              referralVersion={model.referralVersion}
              latestCansAssessmentId={latestCansAssessment?.id ?? null}
              authenticatedRoleLabel={authenticatedRoleLabel}
              synthetic={synthetic}
              enabled={carePathEnabled}
              disabledReason={carePathDisabledReason}
              submitting={carePathSubmitting}
              error={carePathError}
              success={carePathSuccess}
              onAction={onCarePathAction}
            />

            <CcmgWorkflowActions
              key={`${model.workflow.workItemId ?? "none"}-${model.workflow.expectedVersion ?? 0}`}
              workflow={model.workflow}
              authenticatedRoleLabel={authenticatedRoleLabel}
              enabled={actionsEnabled}
              disabledReason={actionsDisabledReason}
              submitting={actionSubmitting}
              error={actionError}
              success={actionSuccess}
              onAction={onWorkflowAction}
            />

            <section
              className="mt-4 rounded-xl border p-4"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <SectionHeader
                icon={GitBranch}
                title="CANS lineage"
                detail="Assessment and instrument versions, provenance, supersession, and every routed plan target."
              />
              {model.cansLineage.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[850px] border-collapse text-left">
                    <thead>
                      <tr
                        style={{ borderBottom: "1px solid var(--card-border)" }}
                      >
                        {[
                          "Assessment",
                          "Completed",
                          "Completed by",
                          "Score / risk",
                          "Evidence class",
                          "Supersedes",
                          "Target routes",
                        ].map((label) => (
                          <th
                            key={label}
                            className="px-3 py-2 text-[9px] font-semibold uppercase tracking-[0.8px]"
                            style={{ color: "var(--topbar-subtitle)" }}
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {model.cansLineage.map((assessment) => (
                        <tr
                          key={assessment.id}
                          style={{
                            borderBottom: "1px solid var(--card-border)",
                          }}
                        >
                          <td className="px-3 py-3">
                            <p
                              className="text-[11px] font-bold"
                              style={{ color: "var(--topbar-title)" }}
                            >
                              Assessment{" "}
                              {versionLabel(assessment.assessmentVersion)}
                            </p>
                            <p
                              className="mt-0.5 text-[9px]"
                              style={{ color: COLORS.slate }}
                            >
                              Instrument{" "}
                              {assessment.instrumentVersion ?? "not returned"}
                            </p>
                            <p
                              className="mt-0.5 text-[9px]"
                              style={{ color: COLORS.slate }}
                            >
                              {assessment.id}
                            </p>
                          </td>
                          <td
                            className="px-3 py-3 text-[10px]"
                            style={{ color: "var(--topbar-subtitle)" }}
                          >
                            {formatDateTime(assessment.completedAt)}
                          </td>
                          <td
                            className="px-3 py-3 text-[10px]"
                            style={{ color: "var(--topbar-title)" }}
                          >
                            {assessment.completedByRole
                              ? humanize(assessment.completedByRole)
                              : "—"}
                          </td>
                          <td className="px-3 py-3">
                            <p
                              className="text-[11px] font-bold"
                              style={{
                                color: statusColor(assessment.riskLevel),
                              }}
                            >
                              {assessment.totalScore ?? "—"}
                            </p>
                            <p
                              className="mt-0.5 text-[9px]"
                              style={{ color: COLORS.slate }}
                            >
                              {assessment.riskLevel
                                ? humanize(assessment.riskLevel)
                                : "Risk not set"}
                            </p>
                          </td>
                          <td
                            className="px-3 py-3 text-[10px]"
                            style={{ color: "var(--topbar-subtitle)" }}
                          >
                            {assessment.source ?? "—"}
                          </td>
                          <td
                            className="px-3 py-3 text-[10px]"
                            style={{ color: "var(--topbar-subtitle)" }}
                          >
                            {assessment.supersedes ?? "Initial version"}
                          </td>
                          <td className="min-w-72 px-3 py-3">
                            {assessment.routes.length > 0 ? (
                              <div className="space-y-2">
                                {assessment.routes.map((route) => (
                                  <div
                                    key={route.id}
                                    className="rounded-lg border p-2 text-[9px] leading-4"
                                    style={{
                                      borderColor: "var(--card-border)",
                                      color: "var(--topbar-title)",
                                    }}
                                  >
                                    <p className="text-[10px] font-bold">
                                      {humanize(route.targetType)}
                                    </p>
                                    <p style={{ color: COLORS.slate }}>
                                      {route.targetRecordId ??
                                        "Target record not returned"}
                                      {route.targetVersion !== null
                                        ? ` · Target ${versionLabel(route.targetVersion)}`
                                        : ""}
                                    </p>
                                    <p style={{ color: COLORS.slate }}>
                                      {route.approvalStatus
                                        ? humanize(route.approvalStatus)
                                        : "Approval status not returned"}
                                      {` · ${route.mappedGoalCount} mapped goal${route.mappedGoalCount === 1 ? "" : "s"}`}
                                    </p>
                                    {(route.routedAt || route.routedBy) && (
                                      <p style={{ color: COLORS.slate }}>
                                        Routed {formatDateTime(route.routedAt)}
                                        {route.routedBy
                                          ? ` by ${humanize(route.routedBy)}`
                                          : ""}
                                      </p>
                                    )}
                                    {route.detail && <p>{route.detail}</p>}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span
                                className="text-[10px]"
                                style={{ color: COLORS.slate }}
                              >
                                No target routes returned for this assessment.
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p
                  className="rounded-lg border p-4 text-[10px]"
                  style={{
                    borderColor: "var(--card-border)",
                    color: COLORS.slate,
                  }}
                >
                  No CANS lineage is available within this role scope.
                </p>
              )}
            </section>

            <section
              className="mt-4 rounded-xl border p-4"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <SectionHeader
                icon={History}
                title="Audit trail"
                detail="Traceable workflow events returned by the authenticated oversight contract."
              />
              <div className="space-y-0">
                {model.auditTrail.length > 0 ? (
                  model.auditTrail.map((event, index) => (
                    <div
                      key={event.id}
                      className="grid grid-cols-[24px_1fr] gap-3"
                    >
                      <div className="flex flex-col items-center">
                        <span
                          className="mt-1 h-2.5 w-2.5 rounded-full"
                          style={{
                            backgroundColor:
                              index === 0 ? COLORS.teal : "#CBD5E1",
                          }}
                        />
                        {index < model.auditTrail.length - 1 && (
                          <span
                            className="min-h-14 w-px flex-1"
                            style={{ backgroundColor: "var(--card-border)" }}
                          />
                        )}
                      </div>
                      <article className="pb-5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3
                            className="text-[11px] font-bold"
                            style={{ color: "var(--topbar-title)" }}
                          >
                            {event.action}
                          </h3>
                          <span
                            className="text-[9px]"
                            style={{ color: COLORS.slate }}
                          >
                            {formatDateTime(event.occurredAt)}
                          </span>
                        </div>
                        <p
                          className="mt-1 text-[10px] font-semibold"
                          style={{ color: COLORS.teal }}
                        >
                          {humanize(event.actorRole)}
                          {event.source ? ` · ${event.source}` : ""}
                        </p>
                        {event.detail && (
                          <p
                            className="mt-1 text-[10px] leading-4"
                            style={{ color: "var(--topbar-subtitle)" }}
                          >
                            {event.detail}
                          </p>
                        )}
                      </article>
                    </div>
                  ))
                ) : (
                  <p
                    className="rounded-lg border p-4 text-[10px]"
                    style={{
                      borderColor: "var(--card-border)",
                      color: COLORS.slate,
                    }}
                  >
                    No audit events are available within this role scope.
                  </p>
                )}
              </div>
            </section>

            <section
              className="mt-4 rounded-xl border p-4"
              style={{
                backgroundColor: "var(--card-bg)",
                borderColor: "var(--card-border)",
              }}
            >
              <div className="flex items-center gap-2">
                <ShieldCheck
                  size={16}
                  style={{ color: COLORS.teal }}
                  aria-hidden="true"
                />
                <h2
                  className="text-[13px] font-bold"
                  style={{ color: "var(--topbar-title)" }}
                >
                  Drill-in surface coverage self-check
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

            {model.coordinationSummary && (
              <div
                className="mt-4 flex items-start gap-2 rounded-xl border px-4 py-3"
                style={{
                  backgroundColor: "#F0FDFA",
                  borderColor: `${COLORS.teal}44`,
                }}
              >
                <FileClock
                  size={15}
                  className="mt-0.5 flex-shrink-0"
                  style={{ color: COLORS.teal }}
                  aria-hidden="true"
                />
                <p
                  className="text-[10px] leading-4"
                  style={{ color: COLORS.teal }}
                >
                  <strong>Coordination note:</strong>{" "}
                  {model.coordinationSummary}
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
