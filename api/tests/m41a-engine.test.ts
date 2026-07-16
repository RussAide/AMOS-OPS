import { describe, expect, it } from "vitest";
import {
  buildM41aDrilldown,
  buildM41aEvaluation,
  runM41aScenario,
} from "../services/m41a";

describe("M4.1A deterministic decision-intelligence engine", () => {
  it("passes exactly eight controlling criteria with explicit synthetic time shift", () => {
    const result = runM41aScenario();
    expect(result.exitGate).toBe(true);
    expect(result.criteria).toHaveLength(8);
    expect(result.criteria.map((item) => item.criterionId)).toEqual([
      "M4.1A-01",
      "M4.1A-02",
      "M4.1A-03",
      "M4.1A-04",
      "M4.1A-05",
      "M4.1A-06",
      "M4.1A-07",
      "M4.1A-08",
    ]);
    expect(result.criteria.every((item) => item.passed)).toBe(true);
    expect(
      Object.values(result.dashboards).every(
        (dashboard) =>
          dashboard.environmentLabel ===
          "SYNTHETIC PROTOTYPE — CONTROLLED TIME-SHIFT — NO REAL DATA",
      ),
    ).toBe(true);
    expect(result.productionActionsBlocked).toBe(true);
  });

  it("recalculates profit-center performance from all twelve source measures", () => {
    const { sourceBundle } = buildM41aEvaluation();
    const source = sourceBundle.sourceReports.find(
      (item) => item.metricId === "EXEC-PC-PERFORMANCE",
    );
    expect(source).toBeDefined();
    expect(source?.denominator).toBe(12);
    expect(source?.sourceRecordIds).toHaveLength(12);
    expect(source?.value).toBeCloseTo(
      ((source?.numerator ?? 0) / (source?.denominator ?? 1)) * 100,
      4,
    );
    expect(source?.sourceReference).toContain("twelve current BHC/GRO");
  });

  it("uses null for unavailable alerts and preserves every contradictory lineage ID", () => {
    const result = runM41aScenario();
    const unavailableAlerts = result.initialAlerts.filter((item) =>
      ["EO-PROCUREMENT", "GAD-MGMA-007"].includes(item.metricId),
    );
    expect(unavailableAlerts).toHaveLength(2);
    expect(unavailableAlerts.every((item) => item.observedValue === null)).toBe(
      true,
    );
    const contradictory = result.dashboards.GAD.metrics.find(
      (item) => item.definition.id === "GAD-MGMA-007",
    );
    expect(contradictory?.dataQualityState).toBe("contradictory");
    expect(contradictory?.sourceReportId).toBeNull();
    expect(
      contradictory?.dataQualityReasons.some((reason) =>
        reason.includes("Conflicting report IDs"),
      ),
    ).toBe(true);
    expect(
      contradictory?.sourceRecordIds.filter((id) =>
        id.startsWith("SYNTH-M41A-REPORT-GAD-GAD-MGMA-007"),
      ),
    ).toHaveLength(2);
  });

  it("requires a valid 1-to-2-to-3 parent chain and filters terminal rows to one report", () => {
    const { dashboards, sourceBundle } = buildM41aEvaluation();
    const metricId = "GAD-MGMA-007";
    const first = buildM41aDrilldown(dashboards.GAD, sourceBundle, metricId, 1);
    expect(first.nodes).toHaveLength(1);
    expect(() =>
      buildM41aDrilldown(
        dashboards.GAD,
        sourceBundle,
        metricId,
        2,
        "WRONG-SUMMARY",
      ),
    ).toThrow("M41A_DRILL_PARENT_INVALID");
    const second = buildM41aDrilldown(
      dashboards.GAD,
      sourceBundle,
      metricId,
      2,
      first.nodes[0].nodeId,
    );
    expect(second.nodes).toHaveLength(2);
    const selectedReport = second.nodes.find((node) => !node.terminal);
    expect(selectedReport).toBeDefined();
    expect(() =>
      buildM41aDrilldown(
        dashboards.GAD,
        sourceBundle,
        metricId,
        3,
        first.nodes[0].nodeId,
      ),
    ).toThrow("M41A_DRILL_PARENT_INVALID");
    const terminal = buildM41aDrilldown(
      dashboards.GAD,
      sourceBundle,
      metricId,
      3,
      selectedReport?.nodeId ?? "",
    );
    expect(terminal.nodes.length).toBeGreaterThan(0);
    expect(
      terminal.nodes.every(
        (node) => node.terminal && node.sourceRecordId !== null,
      ),
    ).toBe(true);
    const selectedReportId = selectedReport?.sourceRecordId;
    expect(
      terminal.nodes.every((node) =>
        sourceBundle.safeSourceRows.some(
          (row) =>
            row.reportId === selectedReportId &&
            row.detail.sourceRecordId === node.sourceRecordId,
        ),
      ),
    ).toBe(true);
  });

  it("emits all five governed data-quality states and nonempty terminal evidence", () => {
    const result = runM41aScenario();
    expect(
      new Set(result.dataQualityScenarios.map((item) => item.state)),
    ).toEqual(
      new Set(["current", "stale", "missing", "contradictory", "suppressed"]),
    );
    expect(result.drilldownEvidence).toHaveLength(5);
    expect(
      result.drilldownEvidence.every(
        (item) =>
          item.terminal &&
          item.nodeIds.length >= 3 &&
          item.sourceRecordIds.length > 0,
      ),
    ).toBe(true);
  });
});
