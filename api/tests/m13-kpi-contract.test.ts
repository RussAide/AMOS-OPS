import { describe, expect, it } from "vitest";
import {
  CONTROLLED_KPI_IDS,
  KPI_DEFINITIONS,
  MGMA_DOMAIN_MAPPINGS,
  SYNTHETIC_KPI_MEASUREMENTS,
  calculateKpiValue,
  compareKpiValue,
  validateDomainMappings,
  validateKpiDefinitions,
  type KpiDefinition,
  type KpiMeasurementEvidence,
} from "../../contracts/mgma/baseline";
import {
  DATA_QUALITY_CHECK_IDS,
  buildKpiScorecard,
  evaluateMeasurementDataQuality,
  type DataQualityCheckId,
  type DataQualityCheckResult,
  type DataQualityEvaluation,
} from "../../contracts/mgma/data-quality";

const AS_OF = "2026-07-01T12:00:00.000Z";
const FIXED_PERIOD = {
  periodStart: "2026-06-01",
  periodEnd: "2026-06-30",
} as const;

function cloneMeasurement(
  index: number,
  overrides: Partial<KpiMeasurementEvidence> = {},
): KpiMeasurementEvidence {
  const source = SYNTHETIC_KPI_MEASUREMENTS[index];
  if (!source) throw new Error(`Missing synthetic fixture at index ${index}.`);
  return {
    ...source,
    sourceReferences: [...source.sourceReferences],
    sourceRecordIds: [...source.sourceRecordIds],
    ...overrides,
  };
}

function checkById(
  evaluation: DataQualityEvaluation,
  id: DataQualityCheckId,
): DataQualityCheckResult {
  const check = evaluation.checks.find((candidate) => candidate.id === id);
  if (!check) throw new Error(`Missing data-quality check ${id}.`);
  return check;
}

function eoScorecard(
  mode: "production" | "synthetic_demo",
  measurements = SYNTHETIC_KPI_MEASUREMENTS,
) {
  return buildKpiScorecard({
    mode,
    asOf: AS_OF,
    scopeType: "corporate_office",
    scopeId: "EO",
    ...FIXED_PERIOD,
    measurements,
  });
}

describe("M1.3 doctrine-controlled domain mappings", () => {
  it("defines exactly the seven required domains in controlled order", () => {
    expect(MGMA_DOMAIN_MAPPINGS.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: "D1", name: "Operations Management" },
      { id: "D2", name: "Financial Management" },
      { id: "D3", name: "Human Resources Management" },
      { id: "D4", name: "Compliance & Risk Management" },
      { id: "D5", name: "Patient Care & Clinical Quality" },
      { id: "D6", name: "Information Management" },
      { id: "D7", name: "Transformation & Strategy" },
    ]);
  });

  it("maps every domain to complete operating and accountability metadata", () => {
    expect(validateDomainMappings(MGMA_DOMAIN_MAPPINGS)).toEqual({
      valid: true,
      findings: [],
    });
    for (const domain of MGMA_DOMAIN_MAPPINGS) {
      expect(domain.modules.length).toBeGreaterThan(0);
      expect(domain.routes.length).toBeGreaterThan(0);
      expect(domain.routes.every((route) => route.startsWith("/"))).toBe(true);
      expect(domain.workflows.length).toBeGreaterThan(0);
      expect(domain.accountableOwner).toMatchObject({
        roleId: expect.any(String),
        division: expect.any(String),
      });
      expect(domain.sourceData.length).toBeGreaterThan(0);
      expect(
        domain.sourceData.every(
          (source) => source.entities.length > 0 && source.keyFields.length > 0,
        ),
      ).toBe(true);
      expect(["BHC", "GRO", "EO", "GAD"]).toContain(domain.responsibleDivision);
      expect(["EO", "GAD"]).toContain(domain.corporateOfficeSponsor.division);
      expect(domain.consumingScopes.length).toBeGreaterThan(0);
    }
  });

  it("rejects duplicate domain identifiers", () => {
    const result = validateDomainMappings([
      ...MGMA_DOMAIN_MAPPINGS,
      MGMA_DOMAIN_MAPPINGS[0],
    ]);
    expect(result.valid).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "DOMAIN_DUPLICATE_ID", recordId: "D1" }),
    );
  });
});

describe("M1.3 controlled KPI catalog", () => {
  it("defines exactly the 14 required KPI identifiers, names, and domains", () => {
    expect(CONTROLLED_KPI_IDS).toEqual([
      "001",
      "002",
      "003",
      "004",
      "005",
      "006",
      "007",
      "008",
      "009",
      "010",
      "011",
      "012",
      "013",
      "014",
    ]);
    expect(
      KPI_DEFINITIONS.map(({ id, name, domainId }) => ({ id, name, domainId })),
    ).toEqual([
      { id: "001", name: "Days in AR", domainId: "D2" },
      { id: "002", name: "Clean Claim Rate", domainId: "D2" },
      { id: "003", name: "Encounter Documentation Timeliness", domainId: "D4" },
      { id: "004", name: "Staff Turnover Rate", domainId: "D3" },
      { id: "005", name: "Credentialing Currency Rate", domainId: "D3" },
      { id: "006", name: "Training Currency Rate", domainId: "D3" },
      { id: "007", name: "Chart Audit Pass Rate", domainId: "D4" },
      { id: "008", name: "Facility Uptime", domainId: "D1" },
      { id: "009", name: "Care Plan Review Currency", domainId: "D5" },
      { id: "010", name: "Referral-to-First-Service Days", domainId: "D5" },
      { id: "011", name: "Data Refresh Success Rate", domainId: "D6" },
      { id: "012", name: "Critical Data Quality Pass Rate", domainId: "D6" },
      { id: "013", name: "Strategic Milestone On-Time Rate", domainId: "D7" },
      {
        id: "014",
        name: "Corporate Office Service-Level Completion Rate",
        domainId: "D7",
      },
    ]);
  });

  it("provides every required definition, source, control, and approval field", () => {
    expect(validateKpiDefinitions(KPI_DEFINITIONS)).toEqual({
      valid: true,
      findings: [],
    });
    for (const definition of KPI_DEFINITIONS) {
      expect(definition.formula).not.toHaveLength(0);
      expect(definition.numerator.name).not.toHaveLength(0);
      expect(definition.numerator.definition).not.toHaveLength(0);
      expect(definition.denominator.name).not.toHaveLength(0);
      expect(definition.denominator.definition).not.toHaveLength(0);
      expect(definition.sourceSystem).not.toHaveLength(0);
      expect(definition.sourceFields.length).toBeGreaterThan(0);
      expect(["daily", "weekly", "monthly", "quarterly"]).toContain(
        definition.refreshCadence,
      );
      expect(definition.owner.roleId).not.toHaveLength(0);
      expect(["lte", "gte"]).toContain(definition.comparison);
      expect(Number.isFinite(definition.target)).toBe(true);
      expect(Number.isFinite(definition.threshold.value)).toBe(true);
      expect(definition.drillDownPath).toMatch(/^\//);
      expect(definition.staleAfterHours).toBeGreaterThan(0);
      expect(definition.relevantScopes.length).toBeGreaterThan(0);
      expect(definition.targetBasis.type).toBe("internal_controlled_prototype");
      expect(definition.approval).toMatchObject({
        status: "controlled_for_prototype",
        approvedByRole: "managing-director",
        changeControlRequired: true,
      });
    }
  });

  it("locks the eight checklist targets and comparisons exactly", () => {
    const requiredTargets = [
      { id: "001", comparison: "lte", target: 40 },
      { id: "002", comparison: "gte", target: 95 },
      { id: "003", comparison: "gte", target: 95 },
      { id: "004", comparison: "lte", target: 15 },
      { id: "005", comparison: "gte", target: 98 },
      { id: "006", comparison: "gte", target: 95 },
      { id: "007", comparison: "gte", target: 95 },
      { id: "008", comparison: "gte", target: 99 },
    ];
    expect(
      KPI_DEFINITIONS.slice(0, 8).map(({ id, comparison, target }) => ({
        id,
        comparison,
        target,
      })),
    ).toEqual(requiredTargets);
  });

  it("uses reasonable controlled prototype targets for KPIs 009 through 014", () => {
    expect(
      KPI_DEFINITIONS.slice(8).map(({ id, comparison, target }) => ({
        id,
        comparison,
        target,
      })),
    ).toEqual([
      { id: "009", comparison: "gte", target: 95 },
      { id: "010", comparison: "lte", target: 7 },
      { id: "011", comparison: "gte", target: 99 },
      { id: "012", comparison: "gte", target: 98 },
      { id: "013", comparison: "gte", target: 90 },
      { id: "014", comparison: "gte", target: 95 },
    ]);
  });

  it("never attributes controlled targets to proprietary benchmark authority", () => {
    for (const definition of KPI_DEFINITIONS) {
      expect(definition.targetBasis.proprietaryBenchmarkClaim).toBe(false);
      expect(definition.targetBasis.statement).not.toMatch(
        /mgma\s+(percentile|benchmark|survey)/i,
      );
      expect(definition.targetBasis.statement).toMatch(
        /internal evaluation threshold/i,
      );
    }
  });

  it("detects prohibited proprietary attribution metadata", () => {
    const invalidDefinition = {
      ...KPI_DEFINITIONS[0],
      targetBasis: {
        ...KPI_DEFINITIONS[0].targetBasis,
        proprietaryBenchmarkClaim: true,
        statement: "Based on an MGMA benchmark.",
      },
    } as unknown as KpiDefinition;
    const result = validateKpiDefinitions([invalidDefinition]);
    expect(result.valid).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        code: "KPI_PROPRIETARY_BENCHMARK_ATTRIBUTION",
      }),
    );
  });

  it("rejects duplicate KPI identifiers", () => {
    const result = validateKpiDefinitions([
      ...KPI_DEFINITIONS,
      KPI_DEFINITIONS[0],
    ]);
    expect(result.valid).toBe(false);
    expect(result.findings).toContainEqual(
      expect.objectContaining({ code: "KPI_DUPLICATE_ID", recordId: "001" }),
    );
  });

  it("calculates ratios and percentages at controlled precision", () => {
    expect(calculateKpiValue(KPI_DEFINITIONS[0], 38_000, 1_000)).toBe(38);
    expect(calculateKpiValue(KPI_DEFINITIONS[1], 97, 100)).toBe(97);
    expect(calculateKpiValue(KPI_DEFINITIONS[7], 42_900, 43_200)).toBe(99.31);
    expect(calculateKpiValue(KPI_DEFINITIONS[0], 1, 0)).toBeNull();
  });

  it("applies inclusive target and threshold boundaries", () => {
    expect(compareKpiValue(KPI_DEFINITIONS[0], 40)).toBe("on_target");
    expect(compareKpiValue(KPI_DEFINITIONS[0], 45)).toBe("at_risk");
    expect(compareKpiValue(KPI_DEFINITIONS[0], 45.1)).toBe("off_target");
    expect(compareKpiValue(KPI_DEFINITIONS[1], 95)).toBe("on_target");
    expect(compareKpiValue(KPI_DEFINITIONS[1], 90)).toBe("at_risk");
    expect(compareKpiValue(KPI_DEFINITIONS[1], 89.9)).toBe("off_target");
  });
});

describe("M1.3 measurement evidence boundary and scorecard modes", () => {
  it("contains one controlled fictional fixture per KPI with fixed periods and source provenance", () => {
    expect(SYNTHETIC_KPI_MEASUREMENTS).toHaveLength(14);
    expect(
      SYNTHETIC_KPI_MEASUREMENTS.map((measurement) => measurement.kpiId),
    ).toEqual(CONTROLLED_KPI_IDS);
    for (const measurement of SYNTHETIC_KPI_MEASUREMENTS) {
      expect(measurement.evidenceClass).toBe("synthetic_demo");
      expect(measurement.periodType).toBe("fixed");
      expect(measurement).toMatchObject(FIXED_PERIOD);
      expect(
        measurement.sourceReferences.every((reference) =>
          reference.startsWith("synthetic://"),
        ),
      ).toBe(true);
      expect(
        measurement.sourceRecordIds.every((recordId) =>
          recordId.startsWith("SYNTHETIC-"),
        ),
      ).toBe(true);
      expect(measurement.collectedAt).toBe("2026-07-01T06:00:00.000Z");
    }
  });

  it("excludes synthetic evidence from production mode and remains not measured", () => {
    const scorecard = eoScorecard("production");
    expect(scorecard).toMatchObject({
      evidenceClass: "production",
      evidenceLabel: "PRODUCTION",
      preview: false,
      score: null,
      status: "not_measured",
      measuredKpiCount: 0,
      totalKpiCount: 14,
    });
    expect(scorecard.rows).toHaveLength(14);
    expect(
      scorecard.rows.every(
        (row) => row.score === null && row.status === "not_measured",
      ),
    ).toBe(true);
    expect(
      scorecard.rows.every(
        (row) => row.reasonCode === "SCORECARD_NO_MATCHING_EVIDENCE",
      ),
    ).toBe(true);
  });

  it("computes a clearly labeled synthetic demo preview", () => {
    const scorecard = eoScorecard("synthetic_demo");
    expect(scorecard).toMatchObject({
      evidenceClass: "synthetic_demo",
      evidenceLabel: "SYNTHETIC DEMO PREVIEW",
      preview: true,
      score: 100,
      status: "on_target",
      measuredKpiCount: 14,
      totalKpiCount: 14,
    });
    expect(scorecard.dataQuality.passed).toBe(true);
    expect(
      scorecard.rows.every(
        (row) => row.score !== null && row.status === "on_target",
      ),
    ).toBe(true);
  });

  it("does not promote a synthetic-provenance record labeled as production", () => {
    const disguised = cloneMeasurement(0, { evidenceClass: "production" });
    const scorecard = eoScorecard("production", [disguised]);
    expect(scorecard.dataQuality.passed).toBe(false);
    expect(scorecard.dataQuality.reasonCodes).toContain(
      "DQ_COMPLETENESS_EVIDENCE_CLASS_MISMATCH",
    );
    expect(scorecard.score).toBeNull();
    expect(scorecard.status).toBe("not_measured");
  });
});

describe("M1.3 deterministic data-quality controls", () => {
  it("runs exactly five checks in controlled order and passes valid fixtures", () => {
    const evaluation = evaluateMeasurementDataQuality(
      SYNTHETIC_KPI_MEASUREMENTS,
      AS_OF,
    );
    expect(DATA_QUALITY_CHECK_IDS).toEqual([
      "completeness",
      "timeliness",
      "duplication",
      "denominator_validity",
      "stale_data",
    ]);
    expect(evaluation.checks.map((check) => check.id)).toEqual(
      DATA_QUALITY_CHECK_IDS,
    );
    expect(evaluation.passed).toBe(true);
    expect(evaluation.checks.every((check) => check.passed)).toBe(true);
    expect(evaluation.reasonCodes).toEqual([]);
  });

  it("fails completeness deterministically for an invalid scope pairing", () => {
    const measurement = cloneMeasurement(0, {
      scopeType: "profit_center",
      scopeId: "EO",
    });
    const evaluation = evaluateMeasurementDataQuality([measurement], AS_OF);
    expect(checkById(evaluation, "completeness")).toMatchObject({
      passed: false,
      reasonCodes: ["DQ_COMPLETENESS_INVALID_SCOPE"],
    });
    expect(
      evaluation.checks
        .filter((check) => !check.passed)
        .map((check) => check.id),
    ).toEqual(["completeness"]);
  });

  it("fails completeness deterministically when required provenance is missing", () => {
    const measurement = cloneMeasurement(0, { sourceReferences: [] });
    const evaluation = evaluateMeasurementDataQuality([measurement], AS_OF);
    expect(checkById(evaluation, "completeness")).toMatchObject({
      passed: false,
      reasonCodes: ["DQ_COMPLETENESS_MISSING_REQUIRED_FIELD"],
    });
    expect(
      evaluation.checks
        .filter((check) => !check.passed)
        .map((check) => check.id),
    ).toEqual(["completeness"]);
  });

  it("fails timeliness deterministically when daily evidence arrives outside its refresh window", () => {
    const measurement = cloneMeasurement(2, {
      collectedAt: "2026-07-02T12:00:00.000Z",
    });
    const evaluation = evaluateMeasurementDataQuality(
      [measurement],
      "2026-07-02T13:00:00.000Z",
    );
    expect(checkById(evaluation, "timeliness")).toMatchObject({
      passed: false,
      reasonCodes: ["DQ_TIMELINESS_COLLECTION_LATE"],
    });
    expect(
      evaluation.checks
        .filter((check) => !check.passed)
        .map((check) => check.id),
    ).toEqual(["timeliness"]);
  });

  it("fails duplication deterministically for duplicate measurement and natural keys", () => {
    const measurement = cloneMeasurement(0);
    const evaluation = evaluateMeasurementDataQuality(
      [measurement, { ...measurement }],
      AS_OF,
    );
    expect(checkById(evaluation, "duplication")).toMatchObject({
      passed: false,
      reasonCodes: ["DQ_DUPLICATE_MEASUREMENT_ID", "DQ_DUPLICATE_NATURAL_KEY"],
    });
    expect(
      evaluation.checks
        .filter((check) => !check.passed)
        .map((check) => check.id),
    ).toEqual(["duplication"]);
  });

  it("fails denominator validity deterministically for zero and negative denominators", () => {
    for (const denominator of [0, -1]) {
      const measurement = cloneMeasurement(0, { denominator, value: 0 });
      const evaluation = evaluateMeasurementDataQuality([measurement], AS_OF);
      expect(checkById(evaluation, "denominator_validity")).toMatchObject({
        passed: false,
        reasonCodes: ["DQ_DENOMINATOR_NON_POSITIVE"],
      });
      expect(
        evaluation.checks
          .filter((check) => !check.passed)
          .map((check) => check.id),
      ).toEqual(["denominator_validity"]);
    }
  });

  it("fails formula validation when a stored value does not match its controlled operands", () => {
    const measurement = cloneMeasurement(0, { value: 39 });
    const evaluation = evaluateMeasurementDataQuality([measurement], AS_OF);
    expect(checkById(evaluation, "denominator_validity")).toMatchObject({
      passed: false,
      reasonCodes: ["DQ_VALUE_FORMULA_MISMATCH"],
    });
  });

  it("fails stale-data control deterministically after the KPI freshness window", () => {
    const measurement = cloneMeasurement(2);
    const evaluation = evaluateMeasurementDataQuality(
      [measurement],
      "2026-07-02T13:00:00.000Z",
    );
    expect(checkById(evaluation, "stale_data")).toMatchObject({
      passed: false,
      reasonCodes: ["DQ_STALE_DATA"],
    });
    expect(
      evaluation.checks
        .filter((check) => !check.passed)
        .map((check) => check.id),
    ).toEqual(["stale_data"]);
  });

  it("returns audit-ready deterministic findings across repeated evaluations", () => {
    const invalid = cloneMeasurement(0, { denominator: 0, value: 0 });
    const first = evaluateMeasurementDataQuality(
      [invalid, { ...invalid }],
      AS_OF,
    );
    const second = evaluateMeasurementDataQuality(
      [invalid, { ...invalid }],
      AS_OF,
    );
    expect(second).toEqual(first);
    expect(
      first.findings.every(
        (finding) => finding.measurementId && finding.kpiId && finding.detail,
      ),
    ).toBe(true);
  });
});
