import { describe, expect, it } from "vitest";
import {
  authorizedM41aScopes,
  M41A_ENTERPRISE_CONTROL_ROLES,
  maximumM41aDrillDepth,
  M41A_AUTHORIZED_ROLES,
} from "@contracts/m41a";
import {
  buildM41aEvaluation,
  evaluateM41aControlledComponent,
  projectM41aDashboard,
  runM41aControlledScenario,
  runM41aScenario,
} from "../services/m41a";

describe("M4.1A access and suppression controls", () => {
  it("sets SUD drill depth to zero for every authorized role and scope", () => {
    for (const role of M41A_AUTHORIZED_ROLES)
      for (const scope of authorizedM41aScopes(role))
        expect(maximumM41aDrillDepth(role, scope, "sud")).toBe(0);
  });

  it("reports SUD suppression in enterprise access metadata and scenario evidence", () => {
    const result = runM41aScenario();
    expect(
      result.dashboards.ENTERPRISE.access.sensitiveDetailSuppressed,
    ).toContain("sud");
    expect(
      result.accessEvaluations.some(
        (item) =>
          item.sensitivity === "sud" &&
          item.allowed &&
          item.maximumDepth === 0 &&
          item.noLeakedFields,
      ),
    ).toBe(true);
  });

  it("denies a T4 role and cross-division access", () => {
    const { dashboards } = buildM41aEvaluation();
    expect(() => projectM41aDashboard(dashboards.BHC, "rcs-day")).toThrow(
      "M41A_T4_ACCESS_DENIED",
    );
    expect(() => projectM41aDashboard(dashboards.GRO, "bhc-director")).toThrow(
      "M41A_SCOPE_ACCESS_DENIED",
    );
  });

  it("denies division roles the unprojected enterprise scenario and evaluator", () => {
    expect(M41A_ENTERPRISE_CONTROL_ROLES).not.toContain("bhc-director");
    expect(() => runM41aControlledScenario("bhc-director")).toThrow(
      "M41A_ENTERPRISE_CONTROL_ACCESS_DENIED",
    );
    expect(() =>
      evaluateM41aControlledComponent("gro-administrator", "M4.1A-02"),
    ).toThrow("M41A_ENTERPRISE_CONTROL_ACCESS_DENIED");
    expect(
      runM41aControlledScenario("managing-director").dashboards.ENTERPRISE,
    ).toBeDefined();
  });

  it("suppresses unauthorized aggregate finance without exposing source fields", () => {
    const { dashboards } = buildM41aEvaluation();
    const projected = projectM41aDashboard(dashboards.EO, "hr-director");
    const finance = projected.metrics.find(
      (item) => item.definition.id === "EO-COST-VARIANCE",
    );
    expect(finance).toMatchObject({
      value: null,
      displayValue: "Suppressed",
      dataQualityState: "suppressed",
      sourceReportId: null,
      sourceRecordIds: [],
      maximumAuthorizedDrillDepth: 0,
    });
    expect(JSON.stringify(finance)).not.toMatch(
      /firstName|lastName|dateOfBirth|staffName|youthName/,
    );
  });
});
