import type {
  M41aDashboard,
  M41aDrilldownResponse,
  M41aThresholdAlert,
} from "@contracts/m41a";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { M41aMetricCard } from "./m41a-metric-card";
import {
  normalizeM41aAlerts,
  normalizeM41aDashboard,
  normalizeM41aDrilldown,
} from "./m41a-model";

const dashboard: M41aDashboard = {
  milestone: "M4.1A",
  environmentId: "AMOS-OPS-M4.1A-EVALUATION",
  environmentLabel: "Synthetic evaluation",
  evidenceClass: "synthetic_demo",
  scope: "ENTERPRISE",
  scopeLabel: "Managing Director",
  scopeType: "enterprise",
  asOf: "2026-07-14T12:00:00.000Z",
  periodStart: "2026-07-01",
  periodEnd: "2026-07-31",
  openAlertCount: 1,
  access: {
    actorRole: "managing-director",
    requestedScope: "ENTERPRISE",
    authorizedScopes: ["ENTERPRISE", "BHC", "GRO", "EO", "GAD"],
    aggregateFinanceVisible: true,
    sensitiveDetailSuppressed: ["youth", "staff", "sud"],
    decisionActionsAllowed: true,
  },
  stageCensus: [
    {
      stageId: "STAGE_1",
      label: "Synthetic stage",
      census: 6,
      capacity: 8,
      sourceRecordIds: ["SYN-CENSUS-01"],
    },
  ],
  metrics: [
    {
      id: "ENTERPRISE:SYN-METRIC-01",
      scope: "ENTERPRISE",
      definition: {
        id: "SYN-METRIC-01",
        name: "Synthetic governed measure",
        category: "support_performance",
        scopeIds: ["ENTERPRISE"],
        description: "A test-only governed metric definition.",
        formula: "synthetic numerator / synthetic denominator",
        unit: "percent",
        precision: 1,
        sourceSystem: "Synthetic source register",
        sourceFields: ["synthetic_value"],
        owner: {
          roleId: "managing-director",
          roleLabel: "Managing Director",
          division: "EO",
        },
        refreshCadence: "daily",
        staleAfterHours: 24,
        target: { value: 90, comparison: "gte", label: "≥ 90%" },
        alertThreshold: 85,
        drillDownLabel: "Synthetic supporting detail",
        maximumDrillDepth: 3,
        sensitivity: "aggregate",
      },
      periodStart: "2026-07-01",
      periodEnd: "2026-07-31",
      value: 88,
      displayValue: "88.0%",
      variance: -2,
      status: "off_target",
      dataQualityState: "current",
      dataQualityReasons: [],
      measuredAt: "2026-07-14T11:55:00.000Z",
      refreshTime: "2026-07-14T12:00:00.000Z",
      sourceReportId: "SYN-REPORT-01",
      sourceRecordIds: ["SYN-ROW-01"],
      reconciliation: {
        dashboardValue: 88,
        sourceReportValue: 88,
        delta: 0,
        reconciled: true,
        reasonCode: "MATCHED",
      },
      maximumAuthorizedDrillDepth: 3,
      evidenceClass: "synthetic_demo",
    },
  ],
};

describe("M4.1A executive experience", () => {
  it("renders every required metric transparency field from the governed response", () => {
    const model = normalizeM41aDashboard(dashboard, "ENTERPRISE");
    const markup = renderToStaticMarkup(
      <M41aMetricCard
        metric={model.metrics[0]}
        onInspect={() => undefined}
        selected={false}
      />,
    );

    expect(markup).toContain("Synthetic governed measure");
    expect(markup).toContain("Definition");
    expect(markup).toContain("Synthetic source register");
    expect(markup).toContain("Managing Director · EO");
    expect(markup).toContain("Refresh");
    expect(markup).toContain("≥ 90%");
    expect(markup).toContain("Variance");
    expect(markup).toContain("DQ · Current");
    expect(markup).toContain("Step 1 of 3");
  });

  it("preserves the server-measured click count and suppressed rows", () => {
    const response: M41aDrilldownResponse = {
      scope: "ENTERPRISE",
      metricId: "ENTERPRISE:SYN-METRIC-01",
      depth: 3,
      clickCount: 3,
      maximumClicks: 3,
      parentId: "SYN-NODE-02",
      breadcrumb: ["Synthetic governed measure", "Division", "Evidence"],
      nodes: [
        {
          nodeId: "SYN-NODE-03",
          parentId: "SYN-NODE-02",
          depth: 3,
          label: "Protected synthetic detail",
          displayValue: "Suppressed",
          routeLabel: "Policy-filtered source",
          terminal: true,
          sensitivity: "sud",
          dataQualityState: "suppressed",
          sourceRecordId: null,
          detail: { policy: "minimum necessary" },
        },
      ],
      terminal: true,
      suppressedCount: 1,
      evidenceClass: "synthetic_demo",
    };

    const model = normalizeM41aDrilldown(response, "Synthetic governed measure");
    expect(model?.measuredSteps).toBe(3);
    expect(model?.maxDepth).toBe(3);
    expect(model?.nodes[0].suppressed).toBe(true);
    expect(model?.nodes[0].authorized).toBe(false);
  });

  it("enables only the next server-valid alert action for an authorized actor", () => {
    const alert: M41aThresholdAlert = {
      id: "SYN-ALERT-01",
      naturalKey: "ENTERPRISE:SYN-METRIC-01:2026-07",
      metricId: "ENTERPRISE:SYN-METRIC-01",
      scope: "ENTERPRISE",
      status: "acknowledged",
      severity: "urgent",
      title: "Synthetic threshold exception",
      threshold: 85,
      observedValue: 88,
      triggeredAt: "2026-07-14T10:00:00.000Z",
      acknowledgedAt: "2026-07-14T10:05:00.000Z",
      acknowledgedBy: "synthetic-executive",
      assignedAt: null,
      assignedTo: null,
      decisionId: null,
      followUpEvidenceIds: [],
      resolvedAt: null,
      evidenceClass: "synthetic_demo",
    };

    const alerts = normalizeM41aAlerts([alert], dashboard);
    expect(alerts[0].metricLabel).toBe("Synthetic governed measure");
    expect(alerts[0].allowedActions).toEqual(["assign"]);

    const suppressed = normalizeM41aAlerts(
      [alert],
      {
        ...dashboard,
        access: { ...dashboard.access, decisionActionsAllowed: false },
      },
    );
    expect(suppressed[0].allowedActions).toEqual([]);
  });

  it("never converts a missing-source alert into a displayed zero", () => {
    const missingSourceAlert: M41aThresholdAlert = {
      id: "SYN-ALERT-MISSING",
      naturalKey: "ENTERPRISE:SYN-MISSING:2026-07",
      metricId: "SYN-MISSING",
      scope: "ENTERPRISE",
      status: "open",
      severity: "critical",
      title: "Synthetic source is missing",
      threshold: 1,
      observedValue: null,
      triggeredAt: "2026-07-14T10:00:00.000Z",
      acknowledgedAt: null,
      acknowledgedBy: null,
      assignedAt: null,
      assignedTo: null,
      decisionId: null,
      followUpEvidenceIds: [],
      resolvedAt: null,
      evidenceClass: "synthetic_demo",
    };

    const alerts = normalizeM41aAlerts([missingSourceAlert], dashboard);
    expect(alerts[0].currentValueLabel).toBe("Not measured");
    expect(alerts[0].currentValueLabel).not.toBe("0");
  });
});
