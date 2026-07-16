import {
  KPI_DEFINITIONS,
  calculateKpiValue,
  compareKpiValue,
  type EvidenceClass,
  type KpiDefinition,
  type KpiMeasurementEvidence,
  type KpiTargetStatus,
  type RefreshCadence,
  type ScopeId,
  type ScopeType,
} from "./baseline";

export const DATA_QUALITY_CHECK_IDS = [
  "completeness",
  "timeliness",
  "duplication",
  "denominator_validity",
  "stale_data",
] as const;

export type DataQualityCheckId = (typeof DATA_QUALITY_CHECK_IDS)[number];

export type DataQualityReasonCode =
  | "DQ_COMPLETENESS_MISSING_REQUIRED_FIELD"
  | "DQ_COMPLETENESS_UNKNOWN_KPI"
  | "DQ_COMPLETENESS_INVALID_EVIDENCE_CLASS"
  | "DQ_COMPLETENESS_EVIDENCE_CLASS_MISMATCH"
  | "DQ_COMPLETENESS_INVALID_SCOPE"
  | "DQ_COMPLETENESS_INVALID_PERIOD"
  | "DQ_TIMELINESS_INVALID_COLLECTION_TIME"
  | "DQ_TIMELINESS_COLLECTED_BEFORE_PERIOD_END"
  | "DQ_TIMELINESS_COLLECTION_LATE"
  | "DQ_DUPLICATE_MEASUREMENT_ID"
  | "DQ_DUPLICATE_NATURAL_KEY"
  | "DQ_DENOMINATOR_NON_POSITIVE"
  | "DQ_VALUE_FORMULA_MISMATCH"
  | "DQ_STALE_AS_OF_INVALID"
  | "DQ_STALE_COLLECTION_TIME_INVALID"
  | "DQ_STALE_COLLECTION_IN_FUTURE"
  | "DQ_STALE_DATA";

export interface DataQualityFinding {
  checkId: DataQualityCheckId;
  reasonCode: DataQualityReasonCode;
  measurementId: string;
  kpiId: string;
  detail: string;
}

export interface DataQualityCheckResult {
  id: DataQualityCheckId;
  label: string;
  passed: boolean;
  reasonCodes: readonly DataQualityReasonCode[];
  findings: readonly DataQualityFinding[];
}

export interface DataQualityEvaluation {
  passed: boolean;
  checks: readonly DataQualityCheckResult[];
  reasonCodes: readonly DataQualityReasonCode[];
  findings: readonly DataQualityFinding[];
}

const CHECK_LABELS: Readonly<Record<DataQualityCheckId, string>> = {
  completeness: "Required measurement evidence is complete",
  timeliness: "Evidence was collected within its controlled refresh window",
  duplication: "Measurement and natural-key identities are unique",
  denominator_validity:
    "Denominator is valid and the stored value matches the formula",
  stale_data: "Evidence remains current at the requested as-of time",
};

const MAX_COLLECTION_DELAY_HOURS: Readonly<Record<RefreshCadence, number>> = {
  daily: 30,
  weekly: 192,
  monthly: 768,
  quarterly: 2_304,
};

const SCOPE_TYPE_BY_ID: Readonly<Record<ScopeId, ScopeType>> = {
  BHC: "profit_center",
  GRO: "profit_center",
  EO: "corporate_office",
  GAD: "corporate_office",
};

function nonBlank(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDateOnly(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(timestamp) ||
    new Date(timestamp).toISOString().slice(0, 10) !== value
  )
    return null;
  return timestamp;
}

function parseTimestamp(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function uniqueReasonCodes(
  findings: readonly DataQualityFinding[],
): DataQualityReasonCode[] {
  return [...new Set(findings.map((finding) => finding.reasonCode))];
}

function makeCheck(
  id: DataQualityCheckId,
  findings: DataQualityFinding[],
): DataQualityCheckResult {
  return {
    id,
    label: CHECK_LABELS[id],
    passed: findings.length === 0,
    reasonCodes: uniqueReasonCodes(findings),
    findings,
  };
}

function identityFor(
  measurement: KpiMeasurementEvidence,
  index: number,
): { measurementId: string; kpiId: string } {
  return {
    measurementId: nonBlank(measurement.measurementId)
      ? measurement.measurementId
      : `measurement-index-${index}`,
    kpiId: nonBlank(measurement.kpiId) ? measurement.kpiId : "unknown-kpi",
  };
}

function addFinding(
  findings: DataQualityFinding[],
  checkId: DataQualityCheckId,
  reasonCode: DataQualityReasonCode,
  measurement: KpiMeasurementEvidence,
  index: number,
  detail: string,
): void {
  findings.push({
    checkId,
    reasonCode,
    ...identityFor(measurement, index),
    detail,
  });
}

function evaluateCompleteness(
  measurements: readonly KpiMeasurementEvidence[],
  definitionsById: ReadonlyMap<string, KpiDefinition>,
): DataQualityCheckResult {
  const findings: DataQualityFinding[] = [];

  measurements.forEach((measurement, index) => {
    const requiredFieldsPresent =
      nonBlank(measurement.measurementId) &&
      nonBlank(measurement.kpiId) &&
      Number.isFinite(measurement.numerator) &&
      Number.isFinite(measurement.denominator) &&
      Number.isFinite(measurement.value) &&
      Array.isArray(measurement.sourceReferences) &&
      measurement.sourceReferences.length > 0 &&
      measurement.sourceReferences.every(nonBlank) &&
      Array.isArray(measurement.sourceRecordIds) &&
      measurement.sourceRecordIds.length > 0 &&
      measurement.sourceRecordIds.every(nonBlank) &&
      nonBlank(measurement.collectedAt);
    if (!requiredFieldsPresent) {
      addFinding(
        findings,
        "completeness",
        "DQ_COMPLETENESS_MISSING_REQUIRED_FIELD",
        measurement,
        index,
        "Required identity, value, provenance, or collection metadata is missing.",
      );
    }

    if (!definitionsById.has(measurement.kpiId)) {
      addFinding(
        findings,
        "completeness",
        "DQ_COMPLETENESS_UNKNOWN_KPI",
        measurement,
        index,
        `KPI ${measurement.kpiId || "<blank>"} is not a controlled definition.`,
      );
    }

    if (
      measurement.evidenceClass !== "synthetic_demo" &&
      measurement.evidenceClass !== "production"
    ) {
      addFinding(
        findings,
        "completeness",
        "DQ_COMPLETENESS_INVALID_EVIDENCE_CLASS",
        measurement,
        index,
        `Evidence class ${String(measurement.evidenceClass)} is not controlled.`,
      );
    }

    const sourceReferences = Array.isArray(measurement.sourceReferences)
      ? measurement.sourceReferences
      : [];
    const sourceRecordIds = Array.isArray(measurement.sourceRecordIds)
      ? measurement.sourceRecordIds
      : [];
    const hasSyntheticProvenance =
      sourceReferences.some(
        (reference) =>
          nonBlank(reference) && reference.startsWith("synthetic://"),
      ) ||
      sourceRecordIds.some(
        (recordId) => nonBlank(recordId) && recordId.startsWith("SYNTHETIC-"),
      );
    if (measurement.evidenceClass === "production" && hasSyntheticProvenance) {
      addFinding(
        findings,
        "completeness",
        "DQ_COMPLETENESS_EVIDENCE_CLASS_MISMATCH",
        measurement,
        index,
        "Production evidence cannot use synthetic source provenance.",
      );
    }

    const controlledScopeId = Object.prototype.hasOwnProperty.call(
      SCOPE_TYPE_BY_ID,
      measurement.scopeId,
    );
    if (
      !controlledScopeId ||
      SCOPE_TYPE_BY_ID[measurement.scopeId] !== measurement.scopeType
    ) {
      addFinding(
        findings,
        "completeness",
        "DQ_COMPLETENESS_INVALID_SCOPE",
        measurement,
        index,
        `Scope ${measurement.scopeType}/${measurement.scopeId} is not a controlled scope pairing.`,
      );
    }

    const periodStart = parseDateOnly(measurement.periodStart);
    const periodEnd = parseDateOnly(measurement.periodEnd);
    if (
      measurement.periodType !== "fixed" ||
      periodStart === null ||
      periodEnd === null ||
      periodStart > periodEnd
    ) {
      addFinding(
        findings,
        "completeness",
        "DQ_COMPLETENESS_INVALID_PERIOD",
        measurement,
        index,
        "A fixed period requires valid YYYY-MM-DD boundaries with start on or before end.",
      );
    }
  });

  return makeCheck("completeness", findings);
}

function evaluateTimeliness(
  measurements: readonly KpiMeasurementEvidence[],
  definitionsById: ReadonlyMap<string, KpiDefinition>,
): DataQualityCheckResult {
  const findings: DataQualityFinding[] = [];

  measurements.forEach((measurement, index) => {
    const collectedAt = parseTimestamp(measurement.collectedAt);
    const periodEndStart = parseDateOnly(measurement.periodEnd);
    if (collectedAt === null) {
      addFinding(
        findings,
        "timeliness",
        "DQ_TIMELINESS_INVALID_COLLECTION_TIME",
        measurement,
        index,
        "Collection timestamp is invalid.",
      );
      return;
    }
    if (periodEndStart === null) return;

    const periodEnd = periodEndStart + 86_400_000 - 1;
    if (collectedAt < periodEnd) {
      addFinding(
        findings,
        "timeliness",
        "DQ_TIMELINESS_COLLECTED_BEFORE_PERIOD_END",
        measurement,
        index,
        "Evidence was collected before the fixed measurement period closed.",
      );
      return;
    }

    const definition = definitionsById.get(measurement.kpiId);
    if (!definition) return;
    const delayHours = (collectedAt - periodEnd) / 3_600_000;
    const allowedDelayHours =
      MAX_COLLECTION_DELAY_HOURS[definition.refreshCadence];
    if (delayHours > allowedDelayHours) {
      addFinding(
        findings,
        "timeliness",
        "DQ_TIMELINESS_COLLECTION_LATE",
        measurement,
        index,
        `Evidence was collected ${delayHours.toFixed(2)} hours after period close; the ${definition.refreshCadence} limit is ${allowedDelayHours} hours.`,
      );
    }
  });

  return makeCheck("timeliness", findings);
}

function evaluateDuplication(
  measurements: readonly KpiMeasurementEvidence[],
): DataQualityCheckResult {
  const findings: DataQualityFinding[] = [];
  const measurementIds = new Map<string, number>();
  const naturalKeys = new Map<string, number>();

  measurements.forEach((measurement, index) => {
    if (nonBlank(measurement.measurementId)) {
      const firstIndex = measurementIds.get(measurement.measurementId);
      if (firstIndex !== undefined) {
        addFinding(
          findings,
          "duplication",
          "DQ_DUPLICATE_MEASUREMENT_ID",
          measurement,
          index,
          `Measurement id duplicates the record at index ${firstIndex}.`,
        );
      } else {
        measurementIds.set(measurement.measurementId, index);
      }
    }

    const naturalKey = [
      measurement.kpiId,
      measurement.evidenceClass,
      measurement.scopeType,
      measurement.scopeId,
      measurement.periodType,
      measurement.periodStart,
      measurement.periodEnd,
    ].join("|");
    const firstNaturalKeyIndex = naturalKeys.get(naturalKey);
    if (firstNaturalKeyIndex !== undefined) {
      addFinding(
        findings,
        "duplication",
        "DQ_DUPLICATE_NATURAL_KEY",
        measurement,
        index,
        `KPI/scope/evidence/period key duplicates the record at index ${firstNaturalKeyIndex}.`,
      );
    } else {
      naturalKeys.set(naturalKey, index);
    }
  });

  return makeCheck("duplication", findings);
}

function evaluateDenominatorValidity(
  measurements: readonly KpiMeasurementEvidence[],
  definitionsById: ReadonlyMap<string, KpiDefinition>,
): DataQualityCheckResult {
  const findings: DataQualityFinding[] = [];

  measurements.forEach((measurement, index) => {
    if (
      !Number.isFinite(measurement.denominator) ||
      measurement.denominator <= 0
    ) {
      addFinding(
        findings,
        "denominator_validity",
        "DQ_DENOMINATOR_NON_POSITIVE",
        measurement,
        index,
        "Denominator must be a finite number greater than zero.",
      );
      return;
    }

    const definition = definitionsById.get(measurement.kpiId);
    if (
      !definition ||
      !Number.isFinite(measurement.numerator) ||
      !Number.isFinite(measurement.value)
    )
      return;
    const expectedValue = calculateKpiValue(
      definition,
      measurement.numerator,
      measurement.denominator,
    );
    if (expectedValue !== measurement.value) {
      addFinding(
        findings,
        "denominator_validity",
        "DQ_VALUE_FORMULA_MISMATCH",
        measurement,
        index,
        `Stored value ${measurement.value} does not equal controlled formula result ${String(expectedValue)}.`,
      );
    }
  });

  return makeCheck("denominator_validity", findings);
}

function evaluateStaleData(
  measurements: readonly KpiMeasurementEvidence[],
  asOf: string,
  definitionsById: ReadonlyMap<string, KpiDefinition>,
): DataQualityCheckResult {
  const findings: DataQualityFinding[] = [];
  const asOfTimestamp = parseTimestamp(asOf);

  if (asOfTimestamp === null) {
    findings.push({
      checkId: "stale_data",
      reasonCode: "DQ_STALE_AS_OF_INVALID",
      measurementId: "batch",
      kpiId: "all",
      detail: "Scorecard as-of timestamp is invalid.",
    });
    return makeCheck("stale_data", findings);
  }

  measurements.forEach((measurement, index) => {
    const collectedAt = parseTimestamp(measurement.collectedAt);
    if (collectedAt === null) {
      addFinding(
        findings,
        "stale_data",
        "DQ_STALE_COLLECTION_TIME_INVALID",
        measurement,
        index,
        "Collection timestamp cannot be used for stale-data evaluation.",
      );
      return;
    }
    if (collectedAt > asOfTimestamp) {
      addFinding(
        findings,
        "stale_data",
        "DQ_STALE_COLLECTION_IN_FUTURE",
        measurement,
        index,
        "Collection timestamp is later than the requested as-of time.",
      );
      return;
    }

    const definition = definitionsById.get(measurement.kpiId);
    if (!definition) return;
    const ageHours = (asOfTimestamp - collectedAt) / 3_600_000;
    if (ageHours > definition.staleAfterHours) {
      addFinding(
        findings,
        "stale_data",
        "DQ_STALE_DATA",
        measurement,
        index,
        `Evidence age is ${ageHours.toFixed(2)} hours; KPI ${definition.id} expires after ${definition.staleAfterHours} hours.`,
      );
    }
  });

  return makeCheck("stale_data", findings);
}

export function evaluateMeasurementDataQuality(
  measurements: readonly KpiMeasurementEvidence[],
  asOf: string,
  definitions: readonly KpiDefinition[] = KPI_DEFINITIONS,
): DataQualityEvaluation {
  const definitionsById = new Map(
    definitions.map((definition) => [definition.id, definition]),
  );
  const checks = [
    evaluateCompleteness(measurements, definitionsById),
    evaluateTimeliness(measurements, definitionsById),
    evaluateDuplication(measurements),
    evaluateDenominatorValidity(measurements, definitionsById),
    evaluateStaleData(measurements, asOf, definitionsById),
  ] satisfies readonly DataQualityCheckResult[];
  const findings = checks.flatMap((check) => check.findings);
  return {
    passed: checks.every((check) => check.passed),
    checks,
    reasonCodes: uniqueReasonCodes(findings),
    findings,
  };
}

export type ScorecardMode = "production" | "synthetic_demo";
export type ScorecardStatus = KpiTargetStatus | "not_measured";

export interface KpiScorecardRow {
  kpiId: string;
  name: string;
  domainId: string;
  target: number;
  comparison: "lte" | "gte";
  unit: "days" | "percent";
  score: number | null;
  status: ScorecardStatus;
  evidenceCount: number;
  evidenceClass: EvidenceClass;
  evidenceLabel: "PRODUCTION" | "SYNTHETIC DEMO PREVIEW";
  reasonCode:
    "SCORECARD_NO_MATCHING_EVIDENCE" | "SCORECARD_DATA_QUALITY_FAILED" | null;
}

export interface KpiScorecard {
  mode: ScorecardMode;
  evidenceClass: EvidenceClass;
  evidenceLabel: "PRODUCTION" | "SYNTHETIC DEMO PREVIEW";
  preview: boolean;
  asOf: string;
  scopeType: ScopeType;
  scopeId: ScopeId;
  periodType: "fixed";
  periodStart: string;
  periodEnd: string;
  score: number | null;
  status: ScorecardStatus;
  measuredKpiCount: number;
  totalKpiCount: number;
  rows: readonly KpiScorecardRow[];
  dataQuality: DataQualityEvaluation;
}

export interface BuildKpiScorecardInput {
  mode: ScorecardMode;
  asOf: string;
  scopeType: ScopeType;
  scopeId: ScopeId;
  periodStart: string;
  periodEnd: string;
  measurements: readonly KpiMeasurementEvidence[];
  definitions?: readonly KpiDefinition[];
}

function overallStatus(score: number | null): ScorecardStatus {
  if (score === null) return "not_measured";
  if (score >= 90) return "on_target";
  if (score >= 75) return "at_risk";
  return "off_target";
}

export function buildKpiScorecard(input: BuildKpiScorecardInput): KpiScorecard {
  const definitions = input.definitions ?? KPI_DEFINITIONS;
  const evidenceClass: EvidenceClass =
    input.mode === "production" ? "production" : "synthetic_demo";
  const evidenceLabel =
    input.mode === "production" ? "PRODUCTION" : "SYNTHETIC DEMO PREVIEW";
  const selectedMeasurements = input.measurements.filter(
    (measurement) =>
      measurement.evidenceClass === evidenceClass &&
      measurement.scopeType === input.scopeType &&
      measurement.scopeId === input.scopeId &&
      measurement.periodType === "fixed" &&
      measurement.periodStart === input.periodStart &&
      measurement.periodEnd === input.periodEnd,
  );
  const dataQuality = evaluateMeasurementDataQuality(
    selectedMeasurements,
    input.asOf,
    definitions,
  );

  const rows: KpiScorecardRow[] = definitions.map((definition) => {
    const matchingEvidence = selectedMeasurements.filter(
      (measurement) => measurement.kpiId === definition.id,
    );
    if (matchingEvidence.length === 0) {
      return {
        kpiId: definition.id,
        name: definition.name,
        domainId: definition.domainId,
        target: definition.target,
        comparison: definition.comparison,
        unit: definition.unit,
        score: null,
        status: "not_measured",
        evidenceCount: 0,
        evidenceClass,
        evidenceLabel,
        reasonCode: "SCORECARD_NO_MATCHING_EVIDENCE",
      };
    }
    if (!dataQuality.passed || matchingEvidence.length !== 1) {
      return {
        kpiId: definition.id,
        name: definition.name,
        domainId: definition.domainId,
        target: definition.target,
        comparison: definition.comparison,
        unit: definition.unit,
        score: null,
        status: "not_measured",
        evidenceCount: matchingEvidence.length,
        evidenceClass,
        evidenceLabel,
        reasonCode: "SCORECARD_DATA_QUALITY_FAILED",
      };
    }

    const measurement = matchingEvidence[0];
    const score = calculateKpiValue(
      definition,
      measurement.numerator,
      measurement.denominator,
    );
    return {
      kpiId: definition.id,
      name: definition.name,
      domainId: definition.domainId,
      target: definition.target,
      comparison: definition.comparison,
      unit: definition.unit,
      score,
      status:
        score === null ? "not_measured" : compareKpiValue(definition, score),
      evidenceCount: 1,
      evidenceClass,
      evidenceLabel,
      reasonCode: score === null ? "SCORECARD_DATA_QUALITY_FAILED" : null,
    };
  });

  const measuredRows = rows.filter((row) => row.score !== null);
  const score =
    measuredRows.length === 0
      ? null
      : Math.round(
          (measuredRows.filter((row) => row.status === "on_target").length /
            measuredRows.length) *
            1_000,
        ) / 10;

  return {
    mode: input.mode,
    evidenceClass,
    evidenceLabel,
    preview: input.mode === "synthetic_demo",
    asOf: input.asOf,
    scopeType: input.scopeType,
    scopeId: input.scopeId,
    periodType: "fixed",
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    score,
    status: overallStatus(score),
    measuredKpiCount: measuredRows.length,
    totalKpiCount: definitions.length,
    rows,
    dataQuality,
  };
}
