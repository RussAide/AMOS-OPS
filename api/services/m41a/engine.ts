import type { UserRole } from "@/constants/roles";
import {
  assertM41aScopeAuthorized,
  assertM41aEnterpriseControlRole,
  buildM41aDashboardAccess,
  maximumM41aDrillDepth,
  M41A_SCOPE_IDS,
  m41aDefinitionsForScope,
  type M41aAlertStatus,
  type M41aAuditEvent,
  type M41aCriterionResult,
  type M41aDashboard,
  type M41aDataQualityState,
  type M41aDecisionRecord,
  type M41aDrilldownResponse,
  type M41aDrillNode,
  type M41aFollowUpEvidence,
  type M41aMetricDefinition,
  type M41aMetricSnapshot,
  type M41aScenarioResult,
  type M41aScopeId,
  type M41aSourceReport,
  type M41aThresholdAlert,
} from "@contracts/m41a";
import {
  buildM41aSourceBundle,
  M41A_AS_OF,
  M41A_PERIOD_END,
  M41A_PERIOD_START,
  M41A_STAGE_CROSSWALK,
  type M41aSourceBundle,
} from "./source-adapters";

export const M41A_FEATURE_CATALOG = Object.freeze([
  { criterionId: "M4.1A-01", capability: "Enterprise executive dashboard" },
  {
    criterionId: "M4.1A-02",
    capability: "BHC and GRO profit-center dashboards",
  },
  {
    criterionId: "M4.1A-03",
    capability: "EO and GAD corporate-office dashboards",
  },
  { criterionId: "M4.1A-04", capability: "Governed three-click drilldown" },
  {
    criterionId: "M4.1A-05",
    capability: "Metric metadata and source reconciliation",
  },
  { criterionId: "M4.1A-06", capability: "Threshold-alert decision lifecycle" },
  {
    criterionId: "M4.1A-07",
    capability: "Role and sensitivity access enforcement",
  },
  {
    criterionId: "M4.1A-08",
    capability: "Data-quality states and deterministic exit gate",
  },
] as const);

export interface M41aDrillEvidence {
  scope: M41aScopeId;
  metricId: string;
  depth: 1 | 2 | 3;
  nodeIds: readonly string[];
  sourceRecordIds: readonly string[];
  terminal: boolean;
  suppressedCount: number;
}

export interface M41aAccessEvaluation {
  role: UserRole;
  scope: M41aScopeId;
  expected: "allowed" | "denied";
  allowed: boolean;
  financeVisible: boolean | null;
  maximumDepth: number | null;
  noLeakedFields: boolean;
  sensitivity?: M41aMetricDefinition["sensitivity"];
}

export interface M41aOperationalScenarioResult extends M41aScenarioResult {
  initialAlerts: readonly M41aThresholdAlert[];
  drilldownEvidence: readonly M41aDrillEvidence[];
  accessEvaluations: readonly M41aAccessEvaluation[];
  dataQualityScenarios: readonly {
    state: M41aDataQualityState;
    scope: M41aScopeId;
    metricId: string;
    snapshotId: string;
  }[];
  sourceRegister: {
    acceptedSourceRunIds: readonly string[];
    supplementalRegisterKinds: readonly [
      "budget_actual",
      "gro_revenue",
      "strategic_initiatives",
    ];
    sourceReportIds: readonly string[];
    safeProjectionFields: readonly string[];
    stageCrosswalk: typeof M41A_STAGE_CROSSWALK;
  };
  reconciliations: readonly {
    snapshotId: string;
    scope: M41aScopeId;
    metricId: string;
    state: M41aDataQualityState;
    reasonCode: M41aMetricSnapshot["reconciliation"]["reasonCode"];
    reconciled: boolean;
  }[];
  productionActionsBlocked: true;
}

const SCOPE_META: Readonly<
  Record<M41aScopeId, { label: string; type: M41aDashboard["scopeType"] }>
> = {
  ENTERPRISE: { label: "Enterprise", type: "enterprise" },
  BHC: { label: "Behavioral Health Center", type: "profit_center" },
  GRO: { label: "Group Residential Operations", type: "profit_center" },
  EO: { label: "Executive Office", type: "corporate_office" },
  GAD: { label: "General Administration", type: "corporate_office" },
};

const SYSTEM_ROLE = "system" as const;
const SCENARIO_ID = "SYNTH-M41A-EXECUTIVE-DECISION-INTELLIGENCE";
const RUN_ID = "SYNTH-M41A-RUN-001";
const STARTED_AT = "2026-10-14T12:00:00.000Z";
const COMPLETED_AT = "2026-10-14T12:05:00.000Z";

function round(value: number, precision = 4): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function metricDisplay(
  definition: M41aMetricDefinition,
  value: number | null,
): string {
  if (value === null) return "Not available";
  const fixed = value.toFixed(definition.precision);
  if (definition.unit === "currency")
    return `$${Math.round(value).toLocaleString("en-US")}`;
  if (definition.unit === "percent") return `${fixed}%`;
  if (definition.unit === "days") return `${fixed} days`;
  if (definition.unit === "status")
    return value >= 1 ? "On target" : "Action required";
  return definition.precision === 0 ? String(Math.round(value)) : fixed;
}

function meetsTarget(definition: M41aMetricDefinition, value: number): boolean {
  return definition.target.comparison === "gte"
    ? value >= definition.target.value
    : value <= definition.target.value;
}

function breachesAlertThreshold(
  definition: M41aMetricDefinition,
  value: number,
): boolean {
  return definition.target.comparison === "gte"
    ? value < definition.alertThreshold
    : value > definition.alertThreshold;
}

function sourceState(
  definition: M41aMetricDefinition,
  reports: readonly M41aSourceReport[],
): {
  state: Exclude<M41aDataQualityState, "suppressed">;
  reasons: readonly string[];
  report: M41aSourceReport | null;
} {
  if (reports.length === 0)
    return {
      state: "missing",
      reasons: ["No controlled source report was available for the period."],
      report: null,
    };
  const distinctValues = new Set(reports.map((item) => item.value));
  if (distinctValues.size > 1)
    return {
      state: "contradictory",
      reasons: [
        "Controlled source reports disagree for the same metric and period.",
        `Conflicting report IDs: ${reports.map((item) => item.id).join(", ")}`,
        `Conflicting source record IDs: ${reports.flatMap((item) => item.sourceRecordIds).join(", ")}`,
      ],
      report: reports[0],
    };
  const report = reports[0];
  const ageHours =
    (Date.parse(M41A_AS_OF) - Date.parse(report.refreshedAt)) / 3_600_000;
  if (ageHours > definition.staleAfterHours)
    return {
      state: "stale",
      reasons: [
        `Source age ${round(ageHours, 1)} hours exceeds the ${definition.staleAfterHours}-hour control.`,
      ],
      report,
    };
  return { state: "current", reasons: [], report };
}

function buildMetricSnapshot(
  definition: M41aMetricDefinition,
  scope: M41aScopeId,
  sourceReports: readonly M41aSourceReport[],
): M41aMetricSnapshot {
  const reports = sourceReports.filter(
    (item) => item.scope === scope && item.metricId === definition.id,
  );
  const quality = sourceState(definition, reports);
  const measured = quality.state === "current" || quality.state === "stale";
  const value = measured ? (quality.report?.value ?? null) : null;
  const reasonCode =
    quality.state === "current"
      ? "MATCHED"
      : quality.state === "stale"
        ? "STALE_SOURCE"
        : quality.state === "missing"
          ? "MISSING_SOURCE"
          : "CONTRADICTORY_SOURCE";
  return Object.freeze({
    id: `SYNTH-M41A-SNAPSHOT-${scope}-${definition.id}`,
    definition,
    scope,
    periodStart: M41A_PERIOD_START,
    periodEnd: M41A_PERIOD_END,
    value,
    displayValue: metricDisplay(definition, value),
    variance: value === null ? null : round(value - definition.target.value),
    status:
      value === null || quality.state !== "current"
        ? "not_measured"
        : meetsTarget(definition, value)
          ? "on_target"
          : "off_target",
    dataQualityState: quality.state,
    dataQualityReasons: quality.reasons,
    measuredAt: quality.report?.periodEnd ?? null,
    refreshTime: quality.report?.refreshedAt ?? null,
    sourceReportId: reports.length === 1 ? reports[0].id : null,
    sourceRecordIds: Object.freeze(
      reports.length === 1
        ? [...reports[0].sourceRecordIds]
        : reports.flatMap((item) => [item.id, ...item.sourceRecordIds]),
    ),
    reconciliation: Object.freeze({
      dashboardValue: value,
      sourceReportValue: reports.length === 1 ? reports[0].value : null,
      delta:
        reports.length === 1 && value !== null
          ? round(value - reports[0].value)
          : null,
      reconciled: quality.state === "current",
      reasonCode,
    }),
    maximumAuthorizedDrillDepth: maximumM41aDrillDepth(
      "managing-director",
      scope,
      definition.sensitivity,
    ),
    evidenceClass: "synthetic_demo",
  });
}

function buildAlert(snapshot: M41aMetricSnapshot): M41aThresholdAlert | null {
  const breached =
    snapshot.value !== null &&
    breachesAlertThreshold(snapshot.definition, snapshot.value);
  if (snapshot.dataQualityState === "current" && !breached) return null;
  const severity =
    snapshot.dataQualityState === "missing" ||
    snapshot.dataQualityState === "contradictory"
      ? "critical"
      : snapshot.dataQualityState === "stale" || breached
        ? "urgent"
        : "advisory";
  return Object.freeze({
    id: `SYNTH-M41A-ALERT-${snapshot.scope}-${snapshot.definition.id}`,
    naturalKey: `${snapshot.scope}:${snapshot.definition.id}:${snapshot.periodEnd}`,
    metricId: snapshot.definition.id,
    scope: snapshot.scope,
    status: "open",
    severity,
    title:
      snapshot.dataQualityState === "current"
        ? `${snapshot.definition.name} crossed its controlled threshold`
        : `${snapshot.definition.name} data quality is ${snapshot.dataQualityState}`,
    threshold: snapshot.definition.alertThreshold,
    observedValue: snapshot.value,
    triggeredAt: M41A_AS_OF,
    acknowledgedAt: null,
    acknowledgedBy: null,
    assignedAt: null,
    assignedTo: null,
    decisionId: null,
    followUpEvidenceIds: [],
    resolvedAt: null,
    evidenceClass: "synthetic_demo",
  });
}

export function projectM41aDashboard(
  dashboard: M41aDashboard,
  role: UserRole,
): M41aDashboard {
  assertM41aScopeAuthorized(role, dashboard.scope);
  const access = buildM41aDashboardAccess(role, dashboard.scope);
  const metrics = dashboard.metrics.map((snapshot) => {
    const financeSuppressed =
      snapshot.definition.sensitivity === "finance" &&
      !access.aggregateFinanceVisible;
    if (financeSuppressed)
      return Object.freeze({
        ...snapshot,
        value: null,
        displayValue: "Suppressed",
        variance: null,
        status: "not_measured" as const,
        dataQualityState: "suppressed" as const,
        dataQualityReasons: Object.freeze([
          "Aggregate finance visibility is not authorized for this role and scope.",
        ]),
        sourceReportId: null,
        sourceRecordIds: [],
        reconciliation: Object.freeze({
          dashboardValue: null,
          sourceReportValue: null,
          delta: null,
          reconciled: false,
          reasonCode: "SUPPRESSED" as const,
        }),
        maximumAuthorizedDrillDepth: 0 as const,
      });
    return Object.freeze({
      ...snapshot,
      maximumAuthorizedDrillDepth: maximumM41aDrillDepth(
        role,
        dashboard.scope,
        snapshot.definition.sensitivity,
      ),
    });
  });
  return Object.freeze({
    ...dashboard,
    metrics: Object.freeze(metrics),
    access,
  });
}

export interface M41aEvaluation {
  sourceBundle: M41aSourceBundle;
  dashboards: Readonly<Record<M41aScopeId, M41aDashboard>>;
  alerts: readonly M41aThresholdAlert[];
}

export function buildM41aEvaluation(): M41aEvaluation {
  const sourceBundle = buildM41aSourceBundle();
  const snapshots = Object.fromEntries(
    M41A_SCOPE_IDS.map((scope) => [
      scope,
      m41aDefinitionsForScope(scope).map((definition) =>
        buildMetricSnapshot(definition, scope, sourceBundle.sourceReports),
      ),
    ]),
  ) as unknown as Record<M41aScopeId, readonly M41aMetricSnapshot[]>;
  const alerts = Object.freeze(
    M41A_SCOPE_IDS.flatMap((scope) => snapshots[scope])
      .map(buildAlert)
      .filter((item): item is M41aThresholdAlert => item !== null),
  );
  const dashboards = Object.fromEntries(
    M41A_SCOPE_IDS.map((scope) => {
      const meta = SCOPE_META[scope];
      return [
        scope,
        Object.freeze({
          milestone: "M4.1A" as const,
          environmentId: "AMOS-OPS-M4.1A-EVALUATION" as const,
          environmentLabel:
            "SYNTHETIC PROTOTYPE — CONTROLLED TIME-SHIFT — NO REAL DATA",
          evidenceClass: "synthetic_demo" as const,
          scope,
          scopeLabel: meta.label,
          scopeType: meta.type,
          asOf: M41A_AS_OF,
          periodStart: M41A_PERIOD_START,
          periodEnd: M41A_PERIOD_END,
          metrics: Object.freeze(snapshots[scope]),
          stageCensus:
            scope === "ENTERPRISE" || scope === "GRO"
              ? sourceBundle.stageCensus
              : [],
          openAlertCount: alerts.filter((item) => item.scope === scope).length,
          access: buildM41aDashboardAccess("managing-director", scope),
        }),
      ];
    }),
  ) as unknown as Readonly<Record<M41aScopeId, M41aDashboard>>;
  return Object.freeze({ sourceBundle, dashboards, alerts });
}

function resolveParentLabel(
  dashboard: M41aDashboard,
  metricId: string,
  parentId: string | null,
): string {
  const metric = dashboard.metrics.find(
    (item) => item.definition.id === metricId,
  );
  if (!metric)
    throw new Error(`M41A_UNKNOWN_SCOPE_METRIC:${dashboard.scope}:${metricId}`);
  return parentId ?? metric.definition.name;
}

export function buildM41aDrilldown(
  dashboard: M41aDashboard,
  bundle: M41aSourceBundle,
  metricId: string,
  depth: 1 | 2 | 3,
  parentId: string | null = null,
): M41aDrilldownResponse {
  const metric = dashboard.metrics.find(
    (item) => item.definition.id === metricId,
  );
  if (!metric)
    throw new Error(`M41A_UNKNOWN_SCOPE_METRIC:${dashboard.scope}:${metricId}`);
  if (depth > metric.maximumAuthorizedDrillDepth)
    throw new Error(
      `M41A_DRILL_DEPTH_DENIED:${metricId}:${depth}:${metric.maximumAuthorizedDrillDepth}`,
    );
  const reports = bundle.sourceReports.filter(
    (item) => item.scope === dashboard.scope && item.metricId === metricId,
  );
  const safeRows = bundle.safeSourceRows.filter(
    (item) => item.scope === dashboard.scope && item.metricId === metricId,
  );
  let nodes: readonly M41aDrillNode[];
  const summaryNodeId = `M41A-DRILL-${dashboard.scope}-${metricId}-SUMMARY`;
  if (depth === 1) {
    if (parentId !== null)
      throw new Error(`M41A_DRILL_PARENT_INVALID:${metricId}:1:${parentId}`);
    nodes = [
      {
        nodeId: summaryNodeId,
        parentId,
        depth,
        label: metric.definition.drillDownLabel,
        displayValue: metric.displayValue,
        routeLabel: "Metric summary",
        terminal: reports.length === 0,
        sensitivity: metric.definition.sensitivity,
        dataQualityState: metric.dataQualityState,
        sourceRecordId: null,
        detail: Object.freeze({
          formula: metric.definition.formula,
          ownerRole: metric.definition.owner.roleId,
          refreshTime: metric.refreshTime,
          sourceSystem: metric.definition.sourceSystem,
        }),
      },
    ];
  } else if (depth === 2) {
    if (parentId !== summaryNodeId)
      throw new Error(
        `M41A_DRILL_PARENT_INVALID:${metricId}:2:${parentId ?? "null"}`,
      );
    nodes = reports.map((report) => ({
      nodeId: `M41A-DRILL-REPORT-${report.id}`,
      parentId,
      depth,
      label: report.sourceReference,
      displayValue: metricDisplay(metric.definition, report.value),
      routeLabel: "Controlled source report",
      terminal:
        safeRows.filter((item) => item.reportId === report.id).length === 0,
      sensitivity: metric.definition.sensitivity,
      dataQualityState: metric.dataQualityState,
      sourceRecordId: report.id,
      detail: Object.freeze({
        reportId: report.id,
        version: report.version,
        refreshedAt: report.refreshedAt,
        evidenceClass: report.evidenceClass,
      }),
    }));
  } else {
    const selectedReport = reports.find(
      (report) => `M41A-DRILL-REPORT-${report.id}` === parentId,
    );
    if (!selectedReport)
      throw new Error(
        `M41A_DRILL_PARENT_INVALID:${metricId}:3:${parentId ?? "null"}`,
      );
    nodes = safeRows
      .filter((row) => row.reportId === selectedReport.id)
      .map((row) => ({
        nodeId: `M41A-DRILL-SOURCE-${row.id}`,
        parentId,
        depth,
        label: row.label,
        displayValue: "Controlled source evidence",
        routeLabel: "Terminal source reference",
        terminal: true,
        sensitivity: row.sensitivity,
        dataQualityState: metric.dataQualityState,
        sourceRecordId: String(row.detail.sourceRecordId),
        detail: row.detail,
      }));
  }
  const frozenNodes = Object.freeze(nodes.map((node) => Object.freeze(node)));
  return Object.freeze({
    scope: dashboard.scope,
    metricId,
    depth,
    clickCount: depth,
    maximumClicks: 3,
    parentId,
    breadcrumb: Object.freeze([
      dashboard.scopeLabel,
      metric.definition.name,
      ...(depth > 1 ? [resolveParentLabel(dashboard, metricId, parentId)] : []),
    ]),
    nodes: frozenNodes,
    terminal:
      frozenNodes.length === 0 || frozenNodes.every((node) => node.terminal),
    suppressedCount: 0,
    evidenceClass: "synthetic_demo",
  });
}

function auditEvent(
  sequence: number,
  action: M41aAuditEvent["action"],
  entityType: M41aAuditEvent["entityType"],
  entityId: string,
  actorId: string,
  actorRole: M41aAuditEvent["actorRole"],
  occurredAt: string,
  correlationId: string,
  before: Readonly<Record<string, unknown>> | null,
  after: Readonly<Record<string, unknown>> | null,
): M41aAuditEvent {
  return Object.freeze({
    id: `SYNTH-M41A-AUDIT-${correlationId}-${String(sequence).padStart(2, "0")}`,
    action,
    entityType,
    entityId,
    actorId,
    actorRole,
    occurredAt,
    before,
    after,
    correlationId,
    evidenceClass: "synthetic_demo",
  });
}

function evaluateAccess(
  dashboards: Readonly<Record<M41aScopeId, M41aDashboard>>,
  role: UserRole,
  scope: M41aScopeId,
  expected: "allowed" | "denied",
  metricId: string,
): M41aAccessEvaluation {
  try {
    const projected = projectM41aDashboard(dashboards[scope], role);
    const metric = projected.metrics.find(
      (item) => item.definition.id === metricId,
    );
    const serialized = JSON.stringify(metric ?? {});
    return Object.freeze({
      role,
      scope,
      expected,
      allowed: true,
      financeVisible: projected.access.aggregateFinanceVisible,
      maximumDepth: metric?.maximumAuthorizedDrillDepth ?? null,
      sensitivity: metric?.definition.sensitivity,
      noLeakedFields:
        !serialized.includes("firstName") &&
        !serialized.includes("lastName") &&
        !serialized.includes("dateOfBirth"),
    });
  } catch {
    return Object.freeze({
      role,
      scope,
      expected,
      allowed: false,
      financeVisible: null,
      maximumDepth: null,
      noLeakedFields: true,
    });
  }
}

function criterion(
  criterionId: M41aCriterionResult["criterionId"],
  passed: boolean,
  summary: string,
  evidenceIds: readonly string[],
): M41aCriterionResult {
  return Object.freeze({ criterionId, passed, summary, evidenceIds });
}

export function runM41aScenario(): M41aOperationalScenarioResult {
  const evaluation = buildM41aEvaluation();
  const { dashboards, sourceBundle } = evaluation;
  const initialAlerts = Object.freeze(
    evaluation.alerts.map((item) => ({ ...item })),
  );
  if (initialAlerts.length === 0)
    throw new Error("M41A_SCENARIO_ALERT_MISSING");
  const lifecycleAlert = { ...initialAlerts[0] };
  const auditEvents: M41aAuditEvent[] = initialAlerts.map((alert) =>
    auditEvent(
      1,
      "alert_triggered",
      "alert",
      alert.id,
      "M41A-SYSTEM",
      SYSTEM_ROLE,
      alert.triggeredAt,
      alert.id,
      null,
      alert,
    ),
  );
  const actorId = "SYNTH-MANAGING-DIRECTOR";
  const actorRole = "managing-director" as const;
  const acknowledgeAt = "2026-10-14T12:01:00.000Z";
  const assignAt = "2026-10-14T12:02:00.000Z";
  const decisionAt = "2026-10-14T12:03:00.000Z";
  const evidenceAt = "2026-10-14T12:04:00.000Z";
  const resolveAt = COMPLETED_AT;
  const beforeAck = { ...lifecycleAlert };
  Object.assign(lifecycleAlert, {
    status: "acknowledged" as M41aAlertStatus,
    acknowledgedAt: acknowledgeAt,
    acknowledgedBy: actorId,
  });
  auditEvents.push(
    auditEvent(
      2,
      "alert_acknowledged",
      "alert",
      lifecycleAlert.id,
      actorId,
      actorRole,
      acknowledgeAt,
      lifecycleAlert.id,
      beforeAck,
      { ...lifecycleAlert },
    ),
  );
  const beforeAssign = { ...lifecycleAlert };
  Object.assign(lifecycleAlert, {
    status: "assigned" as M41aAlertStatus,
    assignedAt: assignAt,
    assignedTo: "SYNTH-EXECUTIVE-OWNER",
  });
  auditEvents.push(
    auditEvent(
      3,
      "alert_assigned",
      "alert",
      lifecycleAlert.id,
      actorId,
      actorRole,
      assignAt,
      lifecycleAlert.id,
      beforeAssign,
      { ...lifecycleAlert },
    ),
  );
  const decision: M41aDecisionRecord = Object.freeze({
    id: `SYNTH-M41A-DECISION-${lifecycleAlert.id}`,
    alertId: lifecycleAlert.id,
    disposition: "approve_action",
    rationale:
      "Approve the synthetic corrective action and require evidence before closure.",
    decidedBy: actorId,
    decidedByRole: actorRole,
    decidedAt: decisionAt,
    humanApproved: true,
    evidenceClass: "synthetic_demo",
  });
  const beforeDecision = { ...lifecycleAlert };
  Object.assign(lifecycleAlert, {
    status: "decided" as M41aAlertStatus,
    decisionId: decision.id,
  });
  auditEvents.push(
    auditEvent(
      4,
      "decision_recorded",
      "decision",
      decision.id,
      actorId,
      actorRole,
      decisionAt,
      lifecycleAlert.id,
      beforeDecision,
      decision as unknown as Readonly<Record<string, unknown>>,
    ),
  );
  const followUp: M41aFollowUpEvidence = Object.freeze({
    id: `SYNTH-M41A-EVIDENCE-${lifecycleAlert.id}`,
    alertId: lifecycleAlert.id,
    evidenceRef: "SYNTH-M41A-CORRECTIVE-ACTION-001",
    summary:
      "Synthetic follow-up evidence verified against the controlled source report.",
    recordedBy: actorId,
    recordedAt: evidenceAt,
    evidenceClass: "synthetic_demo",
  });
  const beforeEvidence = { ...lifecycleAlert };
  Object.assign(lifecycleAlert, {
    status: "evidence_pending" as M41aAlertStatus,
    followUpEvidenceIds: [followUp.id],
  });
  auditEvents.push(
    auditEvent(
      5,
      "follow_up_evidence_added",
      "follow_up_evidence",
      followUp.id,
      actorId,
      actorRole,
      evidenceAt,
      lifecycleAlert.id,
      beforeEvidence,
      followUp as unknown as Readonly<Record<string, unknown>>,
    ),
  );
  const beforeResolve = { ...lifecycleAlert };
  Object.assign(lifecycleAlert, {
    status: "resolved" as M41aAlertStatus,
    resolvedAt: resolveAt,
  });
  auditEvents.push(
    auditEvent(
      6,
      "alert_resolved",
      "alert",
      lifecycleAlert.id,
      actorId,
      actorRole,
      resolveAt,
      lifecycleAlert.id,
      beforeResolve,
      { ...lifecycleAlert },
    ),
  );
  const alerts = Object.freeze([
    Object.freeze(lifecycleAlert),
    ...initialAlerts.slice(1).map((item) => Object.freeze({ ...item })),
  ]);

  const drilldownEvidence = Object.freeze(
    M41A_SCOPE_IDS.map((scope) => {
      const metric = dashboards[scope].metrics.find(
        (item) =>
          item.maximumAuthorizedDrillDepth === 3 &&
          item.dataQualityState !== "missing",
      );
      if (!metric)
        throw new Error(`M41A_SCENARIO_DRILL_METRIC_MISSING:${scope}`);
      const first = buildM41aDrilldown(
        dashboards[scope],
        sourceBundle,
        metric.definition.id,
        1,
      );
      const summaryNode = first.nodes[0];
      if (!summaryNode || summaryNode.terminal)
        throw new Error(`M41A_SCENARIO_DRILL_SUMMARY_INVALID:${scope}`);
      const second = buildM41aDrilldown(
        dashboards[scope],
        sourceBundle,
        metric.definition.id,
        2,
        summaryNode.nodeId,
      );
      const reportNode = second.nodes.find((node) => !node.terminal);
      if (!reportNode)
        throw new Error(`M41A_SCENARIO_DRILL_REPORT_INVALID:${scope}`);
      const response = buildM41aDrilldown(
        dashboards[scope],
        sourceBundle,
        metric.definition.id,
        3,
        reportNode.nodeId,
      );
      if (
        response.nodes.length === 0 ||
        response.nodes.some(
          (node) => !node.terminal || node.sourceRecordId === null,
        )
      )
        throw new Error(`M41A_SCENARIO_DRILL_TERMINAL_INVALID:${scope}`);
      return Object.freeze({
        scope,
        metricId: metric.definition.id,
        depth: 3 as const,
        nodeIds: Object.freeze([
          summaryNode.nodeId,
          reportNode.nodeId,
          ...response.nodes.map((node) => node.nodeId),
        ]),
        sourceRecordIds: Object.freeze(
          response.nodes
            .map((node) => node.sourceRecordId)
            .filter((id): id is string => id !== null),
        ),
        terminal: response.terminal,
        suppressedCount: response.suppressedCount,
      });
    }),
  );

  const accessEvaluations = Object.freeze([
    evaluateAccess(
      dashboards,
      "managing-director",
      "ENTERPRISE",
      "allowed",
      "EXEC-REVENUE-VARIANCE",
    ),
    evaluateAccess(dashboards, "bhc-director", "BHC", "allowed", "BHC-CENSUS"),
    evaluateAccess(dashboards, "bhc-director", "GRO", "denied", "GRO-CENSUS"),
    evaluateAccess(
      dashboards,
      "gro-administrator",
      "GRO",
      "allowed",
      "GRO-CENSUS",
    ),
    evaluateAccess(
      dashboards,
      "revenue-cycle-manager",
      "EO",
      "allowed",
      "EO-COST-VARIANCE",
    ),
    evaluateAccess(
      dashboards,
      "facilities-manager",
      "GAD",
      "allowed",
      "GAD-COST-VARIANCE",
    ),
    evaluateAccess(
      dashboards,
      "hr-director",
      "EO",
      "allowed",
      "EO-COST-VARIANCE",
    ),
    evaluateAccess(dashboards, "rcs-day", "BHC", "denied", "BHC-CENSUS"),
    Object.freeze({
      role: "managing-director" as const,
      scope: "ENTERPRISE" as const,
      expected: "allowed" as const,
      allowed: true,
      financeVisible: true,
      maximumDepth: maximumM41aDrillDepth(
        "managing-director",
        "ENTERPRISE",
        "sud",
      ),
      noLeakedFields: true,
      sensitivity: "sud" as const,
    }),
  ]);

  const allSnapshots = M41A_SCOPE_IDS.flatMap(
    (scope) => dashboards[scope].metrics,
  );
  const suppressed = projectM41aDashboard(
    dashboards.EO,
    "hr-director",
  ).metrics.find((item) => item.dataQualityState === "suppressed");
  if (!suppressed) throw new Error("M41A_SUPPRESSED_SCENARIO_MISSING");
  const dataQualityScenarios: Array<{
    state: M41aDataQualityState;
    scope: M41aScopeId;
    metricId: string;
    snapshotId: string;
  }> = (["current", "stale", "missing", "contradictory"] as const).map(
    (state) => {
      const snapshot = allSnapshots.find(
        (item) => item.dataQualityState === state,
      );
      if (!snapshot)
        throw new Error(`M41A_DATA_QUALITY_SCENARIO_MISSING:${state}`);
      return Object.freeze({
        state,
        scope: snapshot.scope,
        metricId: snapshot.definition.id,
        snapshotId: snapshot.id,
      });
    },
  );
  dataQualityScenarios.push(
    Object.freeze({
      state: "suppressed" as const,
      scope: suppressed.scope,
      metricId: suppressed.definition.id,
      snapshotId: suppressed.id,
    }),
  );
  const frozenDataQualityScenarios = Object.freeze(dataQualityScenarios);

  const enterpriseCategories = new Set(
    dashboards.ENTERPRISE.metrics.map((item) => item.definition.category),
  );
  const pcComplete = (["BHC", "GRO"] as const).every(
    (scope) => dashboards[scope].metrics.length === 6,
  );
  const officeComplete = (["EO", "GAD"] as const).every(
    (scope) => dashboards[scope].metrics.length === 6,
  );
  const metadataComplete = allSnapshots.every(
    (item) =>
      item.definition.formula.length > 0 &&
      item.definition.sourceFields.length > 0 &&
      item.definition.owner.roleId.length > 0 &&
      item.reconciliation.reasonCode.length > 0,
  );
  const criteria = Object.freeze([
    criterion(
      "M4.1A-01",
      [
        "census",
        "revenue",
        "profit_center_performance",
        "compliance",
        "strategic_initiatives",
      ].every((category) =>
        enterpriseCategories.has(category as M41aMetricDefinition["category"]),
      ) && dashboards.ENTERPRISE.stageCensus.length === 3,
      "Enterprise dashboard covers the five controlled executive categories and all three campus stages.",
      dashboards.ENTERPRISE.metrics.map((item) => item.id),
    ),
    criterion(
      "M4.1A-02",
      pcComplete,
      "BHC and GRO each expose six governed profit-center measures.",
      [...dashboards.BHC.metrics, ...dashboards.GRO.metrics].map(
        (item) => item.id,
      ),
    ),
    criterion(
      "M4.1A-03",
      officeComplete,
      "EO and GAD each expose six governed corporate-office measures.",
      [...dashboards.EO.metrics, ...dashboards.GAD.metrics].map(
        (item) => item.id,
      ),
    ),
    criterion(
      "M4.1A-04",
      drilldownEvidence.length === 5 &&
        drilldownEvidence.every((item) => item.depth <= 3 && item.terminal),
      "Every scope has a terminal, source-referenced drilldown within three clicks.",
      drilldownEvidence.flatMap((item) => item.nodeIds),
    ),
    criterion(
      "M4.1A-05",
      metadataComplete,
      "Metric formula, owner, source fields, refresh state, and reconciliation are explicit.",
      allSnapshots.map((item) => item.id),
    ),
    criterion(
      "M4.1A-06",
      lifecycleAlert.status === "resolved" &&
        Boolean(lifecycleAlert.decisionId) &&
        lifecycleAlert.followUpEvidenceIds.length === 1 &&
        auditEvents.filter((event) => event.correlationId === lifecycleAlert.id)
          .length === 6,
      "One deterministic alert completed acknowledgement, assignment, human decision, evidence, and resolution.",
      [lifecycleAlert.id, decision.id, followUp.id],
    ),
    criterion(
      "M4.1A-07",
      accessEvaluations.every(
        (item) =>
          item.allowed === (item.expected === "allowed") && item.noLeakedFields,
      ) &&
        accessEvaluations.some(
          (item) =>
            item.role === "hr-director" && item.financeVisible === false,
        ) &&
        accessEvaluations.some(
          (item) => item.sensitivity === "sud" && item.maximumDepth === 0,
        ) &&
        dashboards.ENTERPRISE.access.sensitiveDetailSuppressed.includes("sud"),
      "Scope, role, finance suppression, T4 denial, and safe-field controls pass.",
      accessEvaluations.map(
        (item) => `${item.role}:${item.scope}:${item.expected}`,
      ),
    ),
    criterion(
      "M4.1A-08",
      new Set(frozenDataQualityScenarios.map((item) => item.state)).size ===
        5 &&
        allSnapshots
          .filter((item) => item.dataQualityState === "current")
          .every((item) => item.reconciliation.reconciled),
      "Current, stale, missing, contradictory, and suppressed states are deterministic and reconciled where current.",
      frozenDataQualityScenarios.map((item) => item.snapshotId),
    ),
  ]);

  const reconciliations = Object.freeze(
    allSnapshots.map((snapshot) =>
      Object.freeze({
        snapshotId: snapshot.id,
        scope: snapshot.scope,
        metricId: snapshot.definition.id,
        state: snapshot.dataQualityState,
        reasonCode: snapshot.reconciliation.reasonCode,
        reconciled: snapshot.reconciliation.reconciled,
      }),
    ),
  );
  return Object.freeze({
    milestone: "M4.1A",
    scenarioId: SCENARIO_ID,
    runId: RUN_ID,
    startedAt: STARTED_AT,
    completedAt: COMPLETED_AT,
    evidenceClass: "synthetic_demo",
    criteria,
    dashboards,
    alerts,
    initialAlerts,
    decisions: Object.freeze([decision]),
    followUpEvidence: Object.freeze([followUp]),
    auditEvents: Object.freeze(auditEvents),
    drilldownEvidence,
    accessEvaluations,
    dataQualityScenarios: frozenDataQualityScenarios,
    sourceRegister: Object.freeze({
      acceptedSourceRunIds: Object.freeze([
        sourceBundle.phase2RunId,
        sourceBundle.phase3RunId,
      ]),
      supplementalRegisterKinds: Object.freeze([
        "budget_actual",
        "gro_revenue",
        "strategic_initiatives",
      ] as const),
      sourceReportIds: Object.freeze(
        sourceBundle.sourceReports.map((item) => item.id),
      ),
      safeProjectionFields: Object.freeze([
        "sourceRecordId",
        "sourceReference",
        "periodEnd",
        "evidenceClass",
      ]),
      stageCrosswalk: M41A_STAGE_CROSSWALK,
    }),
    reconciliations,
    productionActionsBlocked: true,
    exitGate: criteria.length === 8 && criteria.every((item) => item.passed),
  });
}

export function runM41aControlledScenario(
  role: UserRole,
): M41aOperationalScenarioResult {
  assertM41aEnterpriseControlRole(role);
  return runM41aScenario();
}

export function evaluateM41aControlledComponent(
  role: UserRole,
  criterionId: M41aCriterionResult["criterionId"],
) {
  const result = runM41aControlledScenario(role);
  const criterion = result.criteria.find(
    (item) => item.criterionId === criterionId,
  );
  if (!criterion) throw new Error(`M41A_UNKNOWN_CRITERION:${criterionId}`);
  return Object.freeze({
    milestone: "M4.1A" as const,
    evidenceClass: "synthetic_demo" as const,
    criterion,
    feature: M41A_FEATURE_CATALOG.find(
      (item) => item.criterionId === criterionId,
    ),
  });
}
