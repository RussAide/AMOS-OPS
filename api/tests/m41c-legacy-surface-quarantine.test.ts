import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { runM41cIntegratedScenario } from "../services/m41c/integrated-scenario";
import {
  M41C_LEGACY_SURFACE_IDS,
  M41C_LEGACY_SURFACE_QUARANTINE_MANIFEST_ID,
  M41C_LEGACY_SURFACE_QUARANTINE_RESULT,
  M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID,
} from "../services/m41c/legacy-surface-quarantine";

const EXPECTED_SURFACE_IDS = Object.freeze([
  "M41C-LSQ-01-BHC-DIRECT-ENDPOINTS",
  "M41C-LSQ-02-BHC-PATIENT-PROFILE",
  "M41C-LSQ-03-M14-SCORING-RISK-LOC",
  "M41C-LSQ-04-M14-NARRATIVE-PROJECTION",
  "M41C-LSQ-05-M21-SYNTHETIC-REGRESSION",
  "M41C-LSQ-06-MHTCM-CANS-LOC-INPUTS",
  "M41C-LSQ-07-MHTCM-ELIGIBILITY-DECISION",
  "M41C-LSQ-08-CCMG-SCORE-RISK-INPUTS",
  "M41C-LSQ-09-MHRS-SCORE-DOMAIN-INPUTS",
  "M41C-LSQ-10-WF002-TRANSITION",
  "M41C-LSQ-11-WF002-EVIDENCE",
  "M41C-LSQ-12-CLINICAL-UI",
  "M41C-LSQ-13-TOOLKIT-UI",
  "M41C-LSQ-14-WORKSPACE-UI",
  "M41C-LSQ-15-M2-DMS-PLACEHOLDER",
  "M41C-LSQ-16-M10-ANALYTICS",
  "M41C-LSQ-17-DEMO-MOCK-FALLBACK",
  "M41C-LSQ-18-M13-LEVEL-OF-CARE",
  "M41C-LSQ-19-M15-OBSERVATION-SCORING",
  "M41C-LSQ-20-BHC-OUTCOME-MEASURES",
  "M41C-LSQ-21-M5-OUTCOME-MEASURES",
  "M41C-LSQ-22-OUTCOME-MEASURES-PAGE",
  "M41C-LSQ-23-DASHBOARD-OUTCOME-MODAL",
] as const);

const REQUIRED_CONTROL_ID_BY_SURFACE = Object.freeze({
  "M41C-LSQ-01-BHC-DIRECT-ENDPOINTS": "M41C_LEGACY_CANS_LOGIC_QUARANTINED",
  "M41C-LSQ-02-BHC-PATIENT-PROFILE": "buildBhcGovernedAssessmentReference",
  "M41C-LSQ-03-M14-SCORING-RISK-LOC": "quarantineM14UnapprovedClinicalLogic",
  "M41C-LSQ-04-M14-NARRATIVE-PROJECTION": [
    "M41C_NARRATIVE_ASSESSMENT_COLUMNS",
    "@/pages/intake/assessment-page",
  ],
  "M41C-LSQ-05-M21-SYNTHETIC-REGRESSION": "isM21CansSyntheticRegressionContext",
  "M41C-LSQ-06-MHTCM-CANS-LOC-INPUTS":
    "assertMhtcmServicePlanLegacyCansInputsAbsent",
  "M41C-LSQ-07-MHTCM-ELIGIBILITY-DECISION":
    "M41C_UNGOVERNED_ELIGIBILITY_DECISION_QUARANTINED",
  "M41C-LSQ-08-CCMG-SCORE-RISK-INPUTS": [
    "assertCcmgLegacyCansInputsAbsent",
    "M41C_CCMG_UNGOVERNED_COMPLETION_METRIC_REMOVED",
  ],
  "M41C-LSQ-09-MHRS-SCORE-DOMAIN-INPUTS":
    "M41C_MHRS_LEGACY_CANS_INPUT_QUARANTINED",
  "M41C-LSQ-10-WF002-TRANSITION": "M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED",
  "M41C-LSQ-11-WF002-EVIDENCE": "M41C_WORKFLOW_LEGACY_CANS_LOGIC_QUARANTINED",
  "M41C-LSQ-12-CLINICAL-UI": "M41cLegacyCansQuarantine",
  "M41C-LSQ-13-TOOLKIT-UI": "M41cLegacyCansQuarantine",
  "M41C-LSQ-14-WORKSPACE-UI": "M41C_LEGACY_OUTCOME_MEASURE_PREVIEW_ENABLED",
  "M41C-LSQ-15-M2-DMS-PLACEHOLDER": "M41C_DMS_CLINICAL_INSTRUMENT_PLACEHOLDER",
  "M41C-LSQ-16-M10-ANALYTICS": "M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED",
  "M41C-LSQ-17-DEMO-MOCK-FALLBACK":
    "M41C_EVALUATION_CLINICAL_FIXTURES_SANITIZED",
  "M41C-LSQ-18-M13-LEVEL-OF-CARE": [
    "M41C_UNGOVERNED_LOC_LOGIC_QUARANTINED",
    "M41C_M13_LEGACY_LOC_READS_WITHHELD",
    "buildM13GovernedLocReference",
  ],
  "M41C-LSQ-19-M15-OBSERVATION-SCORING":
    "M41C_UNGOVERNED_OBSERVATION_SCORING_QUARANTINED",
  "M41C-LSQ-20-BHC-OUTCOME-MEASURES": [
    "M41C_BHC_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED",
    "M41C_PATIENT_PROFILE_OUTCOME_TAB_MODE",
    "M41C_BHC_GET_PATIENT_FALLBACK_OUTCOME_MODE",
  ],
  "M41C-LSQ-21-M5-OUTCOME-MEASURES":
    "M41C_M5_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED",
  "M41C-LSQ-22-OUTCOME-MEASURES-PAGE": "M41C_OUTCOME_MEASURE_PAGE_MODE",
  "M41C-LSQ-23-DASHBOARD-OUTCOME-MODAL":
    "M41C_DASHBOARD_OUTCOME_MEASURE_PREVIEW_ENABLED",
} satisfies Readonly<
  Record<(typeof EXPECTED_SURFACE_IDS)[number], string | readonly string[]>
>);

describe("M4.1C deterministic legacy-surface quarantine manifest", () => {
  it("locks the exact active-surface inventory without duplicates or omissions", () => {
    const actualIds = M41C_LEGACY_SURFACE_QUARANTINE_RESULT.surfaces.map(
      (surface) => surface.surfaceId,
    );
    const activeSurfaceBindings =
      M41C_LEGACY_SURFACE_QUARANTINE_RESULT.surfaces.flatMap((surface) =>
        Array.from(surface.activeSurfacePaths),
      );

    expect(M41C_LEGACY_SURFACE_IDS).toEqual(EXPECTED_SURFACE_IDS);
    expect(actualIds).toEqual(EXPECTED_SURFACE_IDS);
    expect(new Set(actualIds).size).toBe(EXPECTED_SURFACE_IDS.length);
    expect(new Set(activeSurfaceBindings).size).toBe(
      activeSurfaceBindings.length,
    );
    expect(M41C_LEGACY_SURFACE_QUARANTINE_RESULT).toMatchObject({
      manifestId: M41C_LEGACY_SURFACE_QUARANTINE_MANIFEST_ID,
      surfaceCount: EXPECTED_SURFACE_IDS.length,
      exactSurfaceInventory: true,
      uniqueActiveSurfaceBindings: true,
      complete: true,
      productionRows: 0,
      liveWrites: 0,
    });
  });

  it("binds every record to a fail-closed control, disposition, replacement, and focused regression", () => {
    for (const surface of M41C_LEGACY_SURFACE_QUARANTINE_RESULT.surfaces) {
      expect(surface.activeSurfacePaths.length).toBeGreaterThan(0);
      expect(surface.legacyCapabilities.length).toBeGreaterThan(0);
      expect(surface.guardOrDispositionIds.length).toBeGreaterThan(0);
      const requiredControlIds =
        REQUIRED_CONTROL_ID_BY_SURFACE[surface.surfaceId];
      for (const requiredControlId of typeof requiredControlIds === "string"
        ? [requiredControlIds]
        : requiredControlIds) {
        expect(surface.guardOrDispositionIds).toContain(requiredControlId);
      }
      expect(surface.governedReplacement.trim().length).toBeGreaterThan(0);
      expect(surface.disposition.trim().length).toBeGreaterThan(0);
      expect(surface.productionBlocked).toBe(true);
      expect(surface.failClosed).toBe(true);
      expect(surface.rawLegacyRowsReturned).toBe(false);
      expect(surface.focusedRegressionTestIds).toContain(
        M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID,
      );
      expect(
        surface.focusedRegressionTestIds.some(
          (testId) => testId !== M41C_LEGACY_SURFACE_QUARANTINE_TEST_ID,
        ),
      ).toBe(true);
      expect(surface.evidenceClass).toBe("synthetic_clinical_demo");
    }

    expect(M41C_LEGACY_SURFACE_QUARANTINE_RESULT).toMatchObject({
      allFailClosed: true,
      allProductionBlocked: true,
      allRawLegacyRowsWithheld: true,
      allRecordsBoundToControls: true,
      allRecordsBoundToFocusedRegression: true,
    });
  });

  it("resolves every referenced focused regression identity to a real test file", () => {
    const testIds = new Set(
      M41C_LEGACY_SURFACE_QUARANTINE_RESULT.surfaces.flatMap((surface) =>
        Array.from(surface.focusedRegressionTestIds),
      ),
    );

    for (const testId of testIds) {
      expect(testId).toMatch(/\.test\.tsx?$/);
      expect(
        existsSync(new URL(`../../${testId}`, import.meta.url)),
        `Missing focused regression file: ${testId}`,
      ).toBe(true);
    }
  });

  it("keeps retained legacy execution inside the two named synthetic-only boundaries", () => {
    expect(
      M41C_LEGACY_SURFACE_QUARANTINE_RESULT.surfaces
        .filter((surface) => surface.syntheticRegressionOnly)
        .map((surface) => surface.surfaceId),
    ).toEqual([
      "M41C-LSQ-05-M21-SYNTHETIC-REGRESSION",
      "M41C-LSQ-17-DEMO-MOCK-FALLBACK",
    ]);
  });

  it("binds analytics and disconnected mock reconciliation to their exported dispositions", () => {
    const analytics = M41C_LEGACY_SURFACE_QUARANTINE_RESULT.surfaces.find(
      (surface) => surface.surfaceId === "M41C-LSQ-16-M10-ANALYTICS",
    );
    const mock = M41C_LEGACY_SURFACE_QUARANTINE_RESULT.surfaces.find(
      (surface) => surface.surfaceId === "M41C-LSQ-17-DEMO-MOCK-FALLBACK",
    );

    expect(analytics?.guardOrDispositionIds).toContain(
      "M41C_ANALYTICS_UNGOVERNED_DERIVATIONS_REMOVED",
    );
    expect(mock?.guardOrDispositionIds).toContain(
      "M41C_EVALUATION_CLINICAL_FIXTURES_SANITIZED",
    );
    expect(analytics?.focusedRegressionTestIds).toContain(
      "api/tests/m41c-analytics-fixture-quarantine.test.ts",
    );
    expect(mock?.focusedRegressionTestIds).toContain(
      "api/tests/m41c-analytics-fixture-quarantine.test.ts",
    );
  });

  it("makes M4.1C-04 acceptance depend on the complete manifest result", () => {
    const first = runM41cIntegratedScenario();
    const second = runM41cIntegratedScenario();
    const criterion = first.criterionEvidence["M4.1C-04"];

    expect(first.exactAcceptance.unapprovedLogicProductionBlocked).toBe(true);
    expect(criterion.passed).toBe(true);
    expect(criterion.assertions.map((item) => item.assertionId)).toEqual([
      "QUARANTINE-PRESENT",
      "LEGACY-SURFACE-INVENTORY",
      "LEGACY-SURFACE-CONTROLS",
      "RAW-LEGACY-ROWS-WITHHELD",
      "PRODUCTION-BLOCKED",
    ]);
    expect(criterion.assertions.every((item) => item.passed)).toBe(true);
    expect(criterion.evidenceIds).toEqual([
      M41C_LEGACY_SURFACE_QUARANTINE_MANIFEST_ID,
      ...EXPECTED_SURFACE_IDS,
      ...first.snapshot.instrumentRegistry.quarantines.map(
        (entry) => entry.quarantineId,
      ),
    ]);
    expect(criterion.artifacts.legacySurfaceQuarantine).toEqual(
      M41C_LEGACY_SURFACE_QUARANTINE_RESULT,
    );
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it("uses static deterministic data and performs no runtime source inspection", () => {
    const serviceSource = readFileSync(
      new URL("../services/m41c/legacy-surface-quarantine.ts", import.meta.url),
      "utf8",
    );

    expect(serviceSource).not.toMatch(/from\s+["']node:fs["']/);
    expect(serviceSource).not.toMatch(/\breadFile(?:Sync)?\s*\(/);
    expect(serviceSource).not.toContain("import.meta.url");
  });
});
