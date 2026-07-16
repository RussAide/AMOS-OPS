import type {
  M41aDashboard,
  M41aDecisionDisposition,
  M41aDecisionRecord,
  M41aDrilldownResponse,
  M41aFollowUpEvidence,
  M41aMetricSnapshot,
  M41aScopeId as ContractM41aScopeId,
  M41aThresholdAlert,
} from "@contracts/m41a";

export const M41A_SCOPES = [
  {
    id: "ENTERPRISE",
    scopeType: "enterprise",
    label: "Managing Director",
    shortLabel: "Enterprise",
    description: "Enterprise decision view across Profit Centers and Corporate Offices.",
  },
  {
    id: "BHC",
    scopeType: "profit_center",
    label: "BHC Profit Center",
    shortLabel: "BHC",
    description: "Behavioral Health Center operating and performance view.",
  },
  {
    id: "GRO",
    scopeType: "profit_center",
    label: "GRO Profit Center",
    shortLabel: "GRO",
    description: "Group Residential Operations operating and performance view.",
  },
  {
    id: "EO",
    scopeType: "corporate_office",
    label: "Executive Office",
    shortLabel: "EO",
    description: "Corporate governance, compliance, workforce, cost, and support view.",
  },
  {
    id: "GAD",
    scopeType: "corporate_office",
    label: "General Administration",
    shortLabel: "GAD",
    description: "Facilities, procurement, cost, workforce, and support view.",
  },
] as const;

export type M41aScopeId = ContractM41aScopeId;
export type M41aScopeType = (typeof M41A_SCOPES)[number]["scopeType"];

export const M41A_DECISION_DISPOSITIONS = [
  "approve_action",
  "modify_action",
  "defer",
  "reject",
  "delegate",
] as const satisfies readonly M41aDecisionDisposition[];

export type M41aMetricStatus =
  | "on_target"
  | "at_risk"
  | "off_target"
  | "not_measured"
  | "suppressed"
  | "unknown";

export type M41aDataQualityState =
  | "pass"
  | "current"
  | "warning"
  | "fail"
  | "stale"
  | "missing"
  | "conflicting"
  | "contradictory"
  | "suppressed"
  | "not_measured"
  | "unknown";

export interface M41aMetricView {
  id: string;
  title: string;
  category: string;
  formattedValue: string;
  status: M41aMetricStatus;
  definition: string;
  sourceLabel: string;
  sourceRecordIds: readonly string[];
  ownerLabel: string;
  measuredAt: string | null;
  refreshedAt: string | null;
  refreshLabel: string;
  targetLabel: string;
  varianceLabel: string;
  dataQualityState: M41aDataQualityState;
  dataQualityLabel: string;
  dataQualityReasons: readonly string[];
  drilldownAvailable: boolean;
  disclosure: string | null;
}

export interface M41aDashboardView {
  scopeId: M41aScopeId;
  scopeLabel: string;
  scopeDescription: string;
  environmentLabel: string;
  asOf: string | null;
  evidenceLabel: string;
  synthetic: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  openAlertCount: number;
  stageCensus: readonly {
    id: string;
    label: string;
    census: number;
    capacity: number;
    sourceRecordIds: readonly string[];
  }[];
  access: {
    actorRole: string;
    authorizedScopes: readonly M41aScopeId[];
    aggregateFinanceVisible: boolean;
    suppressedSensitivity: readonly string[];
    decisionActionsAllowed: boolean;
  };
  metrics: readonly M41aMetricView[];
}

export interface M41aDrillNodeView {
  id: string;
  label: string;
  description: string;
  valueLabel: string;
  sourceLabel: string;
  sourceRecordId: string | null;
  dataQualityState: M41aDataQualityState;
  authorized: boolean;
  suppressed: boolean;
  suppressionReason: string | null;
  hasChildren: boolean;
}

export interface M41aDrillBreadcrumb {
  id: string;
  label: string;
  depth: number;
}

export interface M41aDrilldownView {
  metricId: string;
  metricLabel: string;
  depth: number;
  maxDepth: number;
  terminal: boolean;
  measuredSteps: number;
  breadcrumb: readonly M41aDrillBreadcrumb[];
  nodes: readonly M41aDrillNodeView[];
  lineageLabel: string;
}

export type M41aAlertAction =
  | "acknowledge"
  | "assign"
  | "record_decision"
  | "add_follow_up_evidence"
  | "resolve";

export interface M41aAlertEvidenceView {
  id: string;
  reference: string;
  summary: string;
  addedAt: string | null;
  addedBy: string | null;
}

export interface M41aAlertView {
  id: string;
  title: string;
  metricId: string;
  metricLabel: string;
  severity: string;
  status: string;
  thresholdLabel: string;
  currentValueLabel: string;
  ownerLabel: string;
  assignedTo: string | null;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  decisionDisposition: string | null;
  decisionRationale: string | null;
  updatedAt: string | null;
  evidence: readonly M41aAlertEvidenceView[];
  allowedActions: readonly M41aAlertAction[];
}

export type M41aQueryState = "loading" | "error" | "ready";

export function getScopeDefinition(scopeId: M41aScopeId) {
  return (
    M41A_SCOPES.find((scope) => scope.id === scopeId) ?? M41A_SCOPES[0]
  );
}

export function prettyToken(value: string) {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatTimestamp(value: string | null) {
  if (!value) return "Not measured";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function metricAttentionCount(metrics: readonly M41aMetricView[]) {
  return metrics.filter(
    (metric) =>
      metric.status === "at_risk" || metric.status === "off_target",
  ).length;
}

export function metricQualityIssueCount(metrics: readonly M41aMetricView[]) {
  return metrics.filter((metric) =>
    ["fail", "stale", "missing", "conflicting", "contradictory"].includes(
      metric.dataQualityState,
    ),
  ).length;
}

export function groupMetricsByCategory(metrics: readonly M41aMetricView[]) {
  const grouped = new Map<string, M41aMetricView[]>();
  for (const metric of metrics) {
    const rows = grouped.get(metric.category) ?? [];
    rows.push(metric);
    grouped.set(metric.category, rows);
  }
  return [...grouped.entries()].map(([category, rows]) => ({
    category,
    metrics: rows,
  }));
}

function signedNumber(value: number, precision = 1) {
  const formatted = Math.abs(value).toLocaleString("en-US", {
    maximumFractionDigits: precision,
    minimumFractionDigits: precision,
  });
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${formatted}`;
}

function varianceLabel(metric: M41aMetricSnapshot) {
  if (metric.variance === null) return "Not measured";
  const unit = metric.definition.unit;
  if (unit === "currency") {
    return `${metric.variance > 0 ? "+" : metric.variance < 0 ? "−" : ""}$${Math.abs(metric.variance).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (unit === "percent") return `${signedNumber(metric.variance)} pp`;
  if (unit === "days") return `${signedNumber(metric.variance)} days`;
  if (unit === "count") return signedNumber(metric.variance, 0);
  return signedNumber(metric.variance);
}

export function normalizeM41aDashboard(
  dashboard: M41aDashboard | undefined,
  scopeId: M41aScopeId,
): M41aDashboardView {
  const scope = getScopeDefinition(scopeId);
  return {
    scopeId,
    scopeLabel: dashboard?.scopeLabel ?? scope.label,
    scopeDescription: scope.description,
    environmentLabel:
      dashboard?.environmentLabel ?? "Synthetic evaluation — no real data",
    asOf: dashboard?.asOf ?? null,
    evidenceLabel:
      dashboard?.evidenceClass === "synthetic_demo"
        ? "Synthetic evaluation evidence"
        : "Evaluation evidence unavailable",
    synthetic: dashboard?.evidenceClass === "synthetic_demo",
    periodStart: dashboard?.periodStart ?? null,
    periodEnd: dashboard?.periodEnd ?? null,
    openAlertCount: dashboard?.openAlertCount ?? 0,
    stageCensus:
      dashboard?.stageCensus.map((stage) => ({
        id: stage.stageId,
        label: stage.label,
        census: stage.census,
        capacity: stage.capacity,
        sourceRecordIds: stage.sourceRecordIds,
      })) ?? [],
    access: {
      actorRole: dashboard?.access.actorRole ?? "unknown",
      authorizedScopes: dashboard?.access.authorizedScopes ?? [],
      aggregateFinanceVisible:
        dashboard?.access.aggregateFinanceVisible ?? false,
      suppressedSensitivity:
        dashboard?.access.sensitiveDetailSuppressed ?? [],
      decisionActionsAllowed:
        dashboard?.access.decisionActionsAllowed ?? false,
    },
    metrics:
      dashboard?.metrics.map((metric) => ({
        id: metric.definition.id,
        title: metric.definition.name,
        category: prettyToken(metric.definition.category),
        formattedValue: metric.displayValue,
        status: metric.status,
        definition: metric.definition.description,
        sourceLabel: metric.sourceReportId
          ? `${metric.definition.sourceSystem} · ${metric.sourceReportId}`
          : `${metric.definition.sourceSystem} · No source report`,
        sourceRecordIds: metric.sourceRecordIds,
        ownerLabel: `${metric.definition.owner.roleLabel} · ${metric.definition.owner.division}`,
        measuredAt: metric.measuredAt,
        refreshedAt: metric.refreshTime,
        refreshLabel: prettyToken(metric.definition.refreshCadence),
        targetLabel: metric.definition.target.label,
        varianceLabel: varianceLabel(metric),
        dataQualityState: metric.dataQualityState,
        dataQualityLabel: prettyToken(metric.dataQualityState),
        dataQualityReasons: metric.dataQualityReasons.map(prettyToken),
        drilldownAvailable: metric.maximumAuthorizedDrillDepth > 0,
        disclosure: `Reconciliation · ${prettyToken(metric.reconciliation.reasonCode)}${
          metric.reconciliation.delta === null
            ? ""
            : ` · delta ${metric.reconciliation.delta}`
        }`,
      })) ?? [],
  };
}

export function normalizeM41aDrilldown(
  response: M41aDrilldownResponse | undefined,
  metricLabel: string,
): M41aDrilldownView | null {
  if (!response) return null;
  return {
    metricId: response.metricId,
    metricLabel,
    depth: response.depth,
    maxDepth: response.maximumClicks,
    terminal: response.terminal,
    measuredSteps: response.clickCount,
    breadcrumb: response.breadcrumb.map((label, index) => ({
      id: `${response.metricId}:${index}:${label}`,
      label,
      depth: index + 1,
    })),
    nodes: response.nodes.map((node) => ({
      id: node.nodeId,
      label: node.label,
      description: Object.entries(node.detail)
        .map(([key, value]) => `${prettyToken(key)}: ${String(value ?? "—")}`)
        .join(" · "),
      valueLabel: node.displayValue,
      sourceLabel: node.routeLabel,
      sourceRecordId: node.sourceRecordId,
      dataQualityState: node.dataQualityState,
      authorized: node.dataQualityState !== "suppressed",
      suppressed: node.dataQualityState === "suppressed",
      suppressionReason:
        node.dataQualityState === "suppressed"
          ? "This supporting detail is suppressed for the authenticated role and scope."
          : null,
      hasChildren: !node.terminal,
    })),
    lineageLabel: `${response.nodes.length} returned · ${response.suppressedCount} suppressed by policy`,
  };
}

type AlertEnvelope = {
  alerts?: readonly M41aThresholdAlert[];
  decisions?: readonly M41aDecisionRecord[];
  followUpEvidence?: readonly M41aFollowUpEvidence[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedAlertActions(alert: M41aThresholdAlert): M41aAlertAction[] {
  if (alert.status === "open") return ["acknowledge"];
  if (alert.status === "acknowledged") return ["assign"];
  if (alert.status === "assigned") return ["assign", "record_decision"];
  if (alert.status === "decided") return ["add_follow_up_evidence"];
  if (alert.status === "evidence_pending") {
    return alert.followUpEvidenceIds.length > 0
      ? ["add_follow_up_evidence", "resolve"]
      : ["add_follow_up_evidence"];
  }
  return [];
}

function numberWithUnit(
  value: number | null,
  metric: M41aMetricSnapshot | undefined,
) {
  if (value === null) return "Not measured";
  if (metric?.definition.unit === "currency") {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (metric?.definition.unit === "percent") return `${value}%`;
  if (metric?.definition.unit === "days") return `${value} days`;
  return value.toLocaleString("en-US");
}

export function normalizeM41aAlerts(
  value: unknown,
  dashboard: M41aDashboard | undefined,
): M41aAlertView[] {
  const envelope: AlertEnvelope = Array.isArray(value)
    ? { alerts: value as readonly M41aThresholdAlert[] }
    : isRecord(value)
      ? (value as AlertEnvelope)
      : {};
  const alerts = envelope.alerts ?? [];
  const decisions = envelope.decisions ?? [];
  const evidence = envelope.followUpEvidence ?? [];

  return alerts.map((alert) => {
    const metric = dashboard?.metrics.find(
      (snapshot) =>
        snapshot.id === alert.metricId ||
        snapshot.definition.id === alert.metricId,
    );
    const decision = decisions.find((row) => row.id === alert.decisionId);
    return {
      id: alert.id,
      title: alert.title,
      metricId: alert.metricId,
      metricLabel: metric?.definition.name ?? alert.metricId,
      severity: alert.severity,
      status: alert.status,
      thresholdLabel: numberWithUnit(alert.threshold, metric),
      currentValueLabel:
        metric?.displayValue ?? numberWithUnit(alert.observedValue, metric),
      ownerLabel: metric
        ? `${metric.definition.owner.roleLabel} · ${metric.definition.owner.division}`
        : "Governed metric owner",
      assignedTo: alert.assignedTo,
      acknowledgedBy: alert.acknowledgedBy,
      acknowledgedAt: alert.acknowledgedAt,
      decisionDisposition: decision?.disposition ?? null,
      decisionRationale: decision?.rationale ?? null,
      updatedAt:
        alert.resolvedAt ??
        decision?.decidedAt ??
        alert.assignedAt ??
        alert.acknowledgedAt ??
        alert.triggeredAt,
      evidence: alert.followUpEvidenceIds.map((evidenceId) => {
        const row = evidence.find((item) => item.id === evidenceId);
        return row
          ? {
              id: row.id,
              reference: row.evidenceRef,
              summary: row.summary,
              addedAt: row.recordedAt,
              addedBy: row.recordedBy,
            }
          : {
              id: evidenceId,
              reference: evidenceId,
              summary: "Linked follow-up evidence is retained in the governed alert record.",
              addedAt: null,
              addedBy: null,
            };
      }),
      allowedActions: dashboard?.access.decisionActionsAllowed
        ? normalizedAlertActions(alert)
        : [],
    };
  });
}
