import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import {
  KPI_DEFINITIONS,
  MGMA_DOMAIN_MAPPINGS,
  calculateKpiValue,
  compareKpiValue,
  evaluateMeasurementDataQuality,
  validateDomainMappings,
  validateKpiDefinitions,
  type EvidenceClass,
  type KpiDefinition,
  type KpiMeasurementEvidence,
  type KpiTargetStatus,
  type ScopeId,
  type ScopeType,
} from "@contracts/mgma";
import {
  mgmaDashboardGovernance,
  mgmaDataQualityResults,
  mgmaDomains,
  mgmaKpiTargets,
  mgmaMeasurements,
  mgmaOwnerApprovals,
  mgmaScorecards,
} from "@db/schema";
import { adminQuery, createRouter, authedQuery } from "../middleware";
import { getDb } from "../queries/connection";

const viewModeSchema = z.enum(["production_baseline", "synthetic_demo"]);
type MgmaViewMode = z.infer<typeof viewModeSchema>;

const scopeCatalog = [
  {
    scopeId: "BHC",
    scopeType: "profit_center",
    label: "Behavioral Health Center",
  },
  {
    scopeId: "GRO",
    scopeType: "profit_center",
    label: "General Residential Operation",
  },
  { scopeId: "EO", scopeType: "corporate_office", label: "Executive Office" },
  {
    scopeId: "GAD",
    scopeType: "corporate_office",
    label: "General Administration",
  },
] as const satisfies readonly {
  scopeId: ScopeId;
  scopeType: ScopeType;
  label: string;
}[];

const baselinePeriod = {
  start: "2026-06-01",
  end: "2026-06-30",
  asOf: "2026-07-01T12:00:00.000Z",
  governanceReviewedAt: "2026-07-14T00:00:00.000Z",
  nextReviewAt: "2026-08-05",
} as const;

const evidenceClassFor = (viewMode: MgmaViewMode): EvidenceClass =>
  viewMode === "production_baseline" ? "production" : "synthetic_demo";

function databaseKpiId(kpiId: string): string {
  return kpiId.startsWith("M13-KPI-") ? kpiId : `M13-KPI-${kpiId}`;
}

function contractKpiId(kpiId: string): string {
  return kpiId.replace(/^M13-KPI-/, "");
}

function databaseDomainId(domainId: string): string {
  return domainId.startsWith("M13-") ? domainId : `M13-${domainId}`;
}

function contractDomainId(domainId: string): string {
  return domainId.replace(/^M13-/, "");
}

function parseStringArray(value: string): string[] {
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) &&
      parsed.every((item) => typeof item === "string")
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function finiteNumber(value: string | null): number {
  if (value === null) return Number.NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function toMeasurementEvidence(
  row: typeof mgmaMeasurements.$inferSelect,
): KpiMeasurementEvidence {
  return {
    measurementId: row.id,
    kpiId: contractKpiId(row.kpiId),
    evidenceClass: row.evidenceClass,
    scopeType: row.scopeType,
    scopeId: row.scopeId,
    periodType: "fixed",
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    numerator: finiteNumber(row.numeratorValue),
    denominator: finiteNumber(row.denominatorValue),
    value: finiteNumber(row.calculatedValue),
    sourceReferences: [row.sourceReference],
    sourceRecordIds: parseStringArray(row.sourceRecordIdsJson),
    collectedAt: row.collectedAt,
  };
}

function appliesToScope(
  definition: KpiDefinition,
  scopeType: ScopeType,
  scopeId: ScopeId,
): boolean {
  return definition.relevantScopes.some(
    (scope) => scope.scopeType === scopeType && scope.scopeId === scopeId,
  );
}

function worstStatus(statuses: readonly KpiTargetStatus[]): KpiTargetStatus {
  if (statuses.includes("off_target")) return "off_target";
  if (statuses.includes("at_risk")) return "at_risk";
  return "on_target";
}

interface EvaluatedKpi {
  definition: KpiDefinition;
  current: number | null;
  status: KpiTargetStatus | "not_measured";
  evidenceCount: number;
  dataQualityStatus: "pass" | "fail" | "not_measured";
  reasonCodes: readonly string[];
}

function evaluateKpi(
  definition: KpiDefinition,
  measurements: readonly KpiMeasurementEvidence[],
  asOf: string,
): EvaluatedKpi {
  const matching = measurements.filter(
    (measurement) => measurement.kpiId === definition.id,
  );
  if (matching.length === 0) {
    return {
      definition,
      current: null,
      status: "not_measured",
      evidenceCount: 0,
      dataQualityStatus: "not_measured",
      reasonCodes: ["SCORECARD_NO_MATCHING_EVIDENCE"],
    };
  }

  const quality = evaluateMeasurementDataQuality(matching, asOf, [definition]);
  if (!quality.passed) {
    return {
      definition,
      current: null,
      status: "not_measured",
      evidenceCount: matching.length,
      dataQualityStatus: "fail",
      reasonCodes: quality.reasonCodes,
    };
  }

  const values = matching
    .map((measurement) =>
      calculateKpiValue(
        definition,
        measurement.numerator,
        measurement.denominator,
      ),
    )
    .filter((value): value is number => value !== null);
  if (values.length !== matching.length || values.length === 0) {
    return {
      definition,
      current: null,
      status: "not_measured",
      evidenceCount: matching.length,
      dataQualityStatus: "fail",
      reasonCodes: ["DQ_VALUE_FORMULA_MISMATCH"],
    };
  }

  const statuses = values.map((value) => compareKpiValue(definition, value));
  const current =
    Math.round(
      (values.reduce((sum, value) => sum + value, 0) / values.length) * 10,
    ) / 10;
  return {
    definition,
    current,
    status: worstStatus(statuses),
    evidenceCount: matching.length,
    dataQualityStatus: "pass",
    reasonCodes: [],
  };
}

function statusCounts(rows: readonly EvaluatedKpi[]) {
  return {
    onTarget: rows.filter((row) => row.status === "on_target").length,
    atRisk: rows.filter((row) => row.status === "at_risk").length,
    offTarget: rows.filter((row) => row.status === "off_target").length,
    notMeasured: rows.filter((row) => row.status === "not_measured").length,
  };
}

function percentOnTarget(
  counts: ReturnType<typeof statusCounts>,
): number | null {
  const measured = counts.onTarget + counts.atRisk + counts.offTarget;
  return measured === 0
    ? null
    : Math.round((counts.onTarget / measured) * 1_000) / 10;
}

function kpiResponse(row: EvaluatedKpi) {
  return {
    id: databaseKpiId(row.definition.id),
    kpiId: databaseKpiId(row.definition.id),
    name: row.definition.name,
    description: row.definition.description,
    target: row.definition.target,
    current: row.current,
    unit: row.definition.unit,
    status: row.status,
    formula: row.definition.formula,
    numerator: row.definition.numerator.definition,
    denominator: row.definition.denominator.definition,
    owner: row.definition.owner.roleLabel,
    cadence: row.definition.refreshCadence,
    source: row.definition.sourceSystem,
    sourceFields: row.definition.sourceFields,
    threshold: row.definition.threshold.value,
    comparison: row.definition.comparison,
    drillDownPath: row.definition.drillDownPath,
    staleAfterHours: row.definition.staleAfterHours,
    targetBasis: row.definition.targetBasis,
    approval: row.definition.approval,
    evidenceCount: row.evidenceCount,
    dataQualityStatus: row.dataQualityStatus,
    reasonCodes: row.reasonCodes,
  };
}

export async function buildMgmaDashboard(viewMode: MgmaViewMode) {
  const db = getDb();
  const evidenceClass = evidenceClassFor(viewMode);
  const measurementRows = await db
    .select()
    .from(mgmaMeasurements)
    .where(eq(mgmaMeasurements.evidenceClass, evidenceClass));
  const measurements = measurementRows.map(toMeasurementEvidence);

  const allKpiRows = KPI_DEFINITIONS.map((definition) =>
    evaluateKpi(definition, measurements, baselinePeriod.asOf),
  );
  const overallKpis = statusCounts(allKpiRows);
  const overallScore = percentOnTarget(overallKpis);

  const domains = MGMA_DOMAIN_MAPPINGS.map((domain, index) => {
    const rows = allKpiRows.filter(
      (row) => row.definition.domainId === domain.id,
    );
    const counts = statusCounts(rows);
    return {
      id: databaseDomainId(domain.id),
      domainNumber: index + 1,
      domainName: domain.name,
      domainDescription: domain.purpose,
      amosOpsModule: domain.modules.join(" + "),
      moduleRoute: domain.routes[0],
      workflows: domain.workflows,
      accountableOwner: domain.accountableOwner.roleLabel,
      sourceData: domain.sourceData,
      corporateOfficeSponsor: domain.corporateOfficeSponsor.roleLabel,
      consumingScopes: domain.consumingScopes,
      responsibleDivision: domain.responsibleDivision,
      mappingStatus: "configured",
      score: percentOnTarget(counts),
      ...counts,
      kpiCount: rows.length,
      kpis: rows.map(kpiResponse),
    };
  });

  const scopeSummaries = scopeCatalog.map((scope) => {
    const definitions = KPI_DEFINITIONS.filter((definition) =>
      appliesToScope(definition, scope.scopeType, scope.scopeId),
    );
    const scopeMeasurements = measurements.filter(
      (measurement) =>
        measurement.scopeType === scope.scopeType &&
        measurement.scopeId === scope.scopeId,
    );
    const rows = definitions.map((definition) =>
      evaluateKpi(definition, scopeMeasurements, baselinePeriod.asOf),
    );
    const counts = statusCounts(rows);
    return {
      code: scope.scopeId,
      scopeId: scope.scopeId,
      scopeType: scope.scopeType,
      label: scope.label,
      score: percentOnTarget(counts),
      domainCount: new Set(definitions.map((definition) => definition.domainId))
        .size,
      totalKpis: rows.length,
      ...counts,
      evidenceLabel:
        viewMode === "production_baseline"
          ? "Production baseline evidence"
          : "Synthetic demo preview — not production evidence",
    };
  });

  const dataQualityEvaluation =
    measurements.length > 0
      ? evaluateMeasurementDataQuality(measurements, baselinePeriod.asOf)
      : null;
  const dataQuality = {
    status:
      dataQualityEvaluation === null
        ? "not_measured"
        : dataQualityEvaluation.passed
          ? "pass"
          : "fail",
    evaluatedEvidenceCount: measurements.length,
    reasonCodes: dataQualityEvaluation?.reasonCodes ?? [],
    checks: [
      "completeness",
      "timeliness",
      "duplication",
      "denominator_validity",
      "stale_data",
    ].map((id) => {
      const check = dataQualityEvaluation?.checks.find(
        (item) => item.id === id,
      );
      return {
        id,
        label: check?.label ?? id.replace(/_/g, " "),
        status: check ? (check.passed ? "pass" : "fail") : "not_measured",
        value: check ? check.findings.length : null,
        detail: check
          ? check.passed
            ? "No exceptions found in the selected evidence mode."
            : check.findings.map((finding) => finding.detail).join(" ")
          : "No production evidence is loaded; this check has not run.",
      };
    }),
  };

  const approvalItems = [
    {
      id: "M13-APR-DOMAIN",
      label: "Seven-domain mapping",
      status: "prototype_reviewed",
      owner: "Managing Director",
      decidedAt: baselinePeriod.governanceReviewedAt,
    },
    {
      id: "M13-APR-FORMULA",
      label: "KPI formulas",
      status: "prototype_reviewed",
      owner: "KPI owner roles",
      decidedAt: baselinePeriod.governanceReviewedAt,
    },
    {
      id: "M13-APR-TARGET",
      label: "Internal prototype targets",
      status: "prototype_reviewed",
      owner: "Managing Director / CFO",
      decidedAt: baselinePeriod.governanceReviewedAt,
    },
    {
      id: "M13-APR-SOURCE",
      label: "Sources and refresh cadence",
      status: "prototype_reviewed",
      owner: "Source data-owner roles",
      decidedAt: baselinePeriod.governanceReviewedAt,
    },
    {
      id: "M13-APR-PERIOD",
      label: "Baseline period and dashboard governance",
      status: "prototype_reviewed",
      owner: "Managing Director / CFO",
      decidedAt: baselinePeriod.governanceReviewedAt,
    },
  ];

  return {
    viewMode,
    evidenceClass,
    evidenceLabel:
      viewMode === "production_baseline"
        ? "Governed production baseline — no production evidence loaded"
        : "Synthetic demo preview — not production evidence",
    baselinePeriod: {
      start: baselinePeriod.start,
      end: baselinePeriod.end,
      status:
        viewMode === "production_baseline"
          ? "not_measured"
          : "synthetic_preview",
      approvalStatus: "prototype_reviewed_pending_milestone_owner_acceptance",
      cadence: "monthly",
      closeRule:
        "Prior full calendar month; source-owner validation before fifth-business-day publication.",
    },
    productionAssertion: false,
    overallScore,
    domains,
    scopeSummaries,
    overallKpis: { total: allKpiRows.length, ...overallKpis },
    dataQuality,
    approvals: {
      status: "prototype_reviewed_pending_milestone_owner_acceptance",
      required: approvalItems.length,
      approved: 0,
      pending: approvalItems.length,
      rejected: 0,
      approvedBy: null,
      lastApprovedAt: null,
      nextReviewAt: baselinePeriod.nextReviewAt,
      items: approvalItems,
    },
  };
}

export const mgmaRouter = createRouter({
  baselineContract: authedQuery.query(() => ({
    version: "M1.3-v1.0",
    domainValidation: validateDomainMappings(MGMA_DOMAIN_MAPPINGS),
    kpiValidation: validateKpiDefinitions(KPI_DEFINITIONS),
    domains: MGMA_DOMAIN_MAPPINGS,
    kpis: KPI_DEFINITIONS,
    targetAuthority: "AMOS-OPS controlled internal prototype target",
    proprietaryBenchmarkClaim: false,
  })),

  listDomains: authedQuery.query(() =>
    MGMA_DOMAIN_MAPPINGS.map((domain, index) => ({
      id: databaseDomainId(domain.id),
      domainNumber: index + 1,
      domainName: domain.name,
      domainDescription: domain.purpose,
      amosOpsModule: domain.modules.join(" + "),
      moduleRoute: domain.routes[0],
      workflows: domain.workflows,
      accountableOwner: domain.accountableOwner,
      sourceData: domain.sourceData,
      responsibleDivision: domain.responsibleDivision,
      corporateOfficeSponsor: domain.corporateOfficeSponsor,
      consumingScopes: domain.consumingScopes,
      status: "active" as const,
    })),
  ),

  getDomain: authedQuery
    .input(z.object({ id: z.string().min(1) }))
    .query(({ input }) => {
      const id = contractDomainId(input.id);
      const domain = MGMA_DOMAIN_MAPPINGS.find(
        (candidate) => candidate.id === id,
      );
      if (!domain) return null;
      return {
        ...domain,
        id: databaseDomainId(domain.id),
        kpis: KPI_DEFINITIONS.filter(
          (definition) => definition.domainId === domain.id,
        ),
      };
    }),

  configureDomain: adminQuery
    .input(
      z.object({
        id: z.string().min(1),
        status: z.enum(["planned", "configured", "active", "under_review"]),
        configuredBy: z.string().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(mgmaDomains)
        .set({
          status: input.status,
          configuredAt: new Date().toISOString(),
          configuredBy: input.configuredBy,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(mgmaDomains.id, databaseDomainId(input.id)));
      return { success: true };
    }),

  listKpiTargets: authedQuery
    .input(
      z
        .object({
          domainId: z.string().optional(),
          status: z
            .enum(["on_target", "at_risk", "off_target", "not_measured"])
            .optional(),
        })
        .optional(),
    )
    .query(({ input }) => {
      const domainId = input?.domainId
        ? contractDomainId(input.domainId)
        : null;
      const rows = KPI_DEFINITIONS.filter(
        (definition) => domainId === null || definition.domainId === domainId,
      ).map((definition) => ({
        id: databaseKpiId(definition.id),
        domainId: databaseDomainId(definition.domainId),
        kpiName: definition.name,
        kpiDescription: definition.description,
        targetValue: String(definition.target),
        targetUnit: definition.unit,
        comparisonOperator: definition.comparison,
        benchmarkSource: definition.targetBasis.label,
        formula: definition.formula,
        numeratorDefinition: definition.numerator.definition,
        denominatorDefinition: definition.denominator.definition,
        sourceSystem: definition.sourceSystem,
        sourceFields: definition.sourceFields,
        ownerRole: definition.owner.roleLabel,
        drillDownPath: definition.drillDownPath,
        targetBasis: definition.targetBasis,
        approval: definition.approval,
        measurementFrequency: definition.refreshCadence,
        staleAfterHours: definition.staleAfterHours,
        currentValue: null,
        lastMeasuredAt: null,
        status: "not_measured" as const,
        alertThreshold: String(definition.threshold.value),
      }));
      return input?.status
        ? rows.filter((row) => row.status === input.status)
        : rows;
    }),

  updateKpiCurrentValue: adminQuery
    .input(
      z.object({
        id: z.string(),
        currentValue: z.string(),
        status: z.enum(["on_target", "at_risk", "off_target", "not_measured"]),
      }),
    )
    .mutation(() => {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Direct current-value writes are disabled. Record evidence-classified numerator, denominator, scope, period, and provenance instead.",
      });
    }),

  recordSyntheticMeasurement: adminQuery
    .input(
      z.object({
        kpiId: z.string().min(1),
        scopeType: z.enum(["profit_center", "corporate_office"]),
        scopeId: z.enum(["BHC", "GRO", "EO", "GAD"]),
        periodStart: z.string().date(),
        periodEnd: z.string().date(),
        numerator: z.number().finite(),
        denominator: z.number().positive(),
        sourceReferences: z.array(z.string().startsWith("synthetic://")).min(1),
        sourceRecordIds: z.array(z.string().startsWith("SYNTHETIC-")).min(1),
        collectedAt: z.string().datetime({ offset: true }),
        asOf: z.string().datetime({ offset: true }),
      }),
    )
    .mutation(async ({ input }) => {
      const kpiId = contractKpiId(input.kpiId);
      const definition = KPI_DEFINITIONS.find(
        (candidate) => candidate.id === kpiId,
      );
      if (!definition)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Unknown controlled KPI",
        });
      if (!appliesToScope(definition, input.scopeType, input.scopeId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "KPI is not mapped to the selected scope",
        });
      }
      const value = calculateKpiValue(
        definition,
        input.numerator,
        input.denominator,
      );
      if (value === null)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid KPI numerator or denominator",
        });
      const evidence: KpiMeasurementEvidence = {
        measurementId: randomUUID(),
        kpiId,
        evidenceClass: "synthetic_demo",
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        periodType: "fixed",
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        numerator: input.numerator,
        denominator: input.denominator,
        value,
        sourceReferences: input.sourceReferences,
        sourceRecordIds: input.sourceRecordIds,
        collectedAt: input.collectedAt,
      };
      const quality = evaluateMeasurementDataQuality([evidence], input.asOf, [
        definition,
      ]);
      if (!quality.passed) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Synthetic evidence failed data-quality controls: ${quality.reasonCodes.join(", ")}`,
        });
      }

      const db = getDb();
      await db.insert(mgmaMeasurements).values({
        id: evidence.measurementId,
        kpiId: databaseKpiId(kpiId),
        scopeType: evidence.scopeType,
        scopeId: evidence.scopeId,
        evidenceClass: evidence.evidenceClass,
        periodStart: evidence.periodStart,
        periodEnd: evidence.periodEnd,
        numeratorValue: String(evidence.numerator),
        denominatorValue: String(evidence.denominator),
        calculatedValue: String(evidence.value),
        sourceReference: evidence.sourceReferences.join(" | "),
        sourceRecordIdsJson: JSON.stringify(evidence.sourceRecordIds),
        sourceRecordCount: evidence.sourceRecordIds.length,
        collectedAt: evidence.collectedAt,
        createdAt: new Date().toISOString(),
      });
      await db.insert(mgmaDataQualityResults).values(
        quality.checks.map((check) => ({
          id: randomUUID(),
          measurementId: evidence.measurementId,
          kpiId: databaseKpiId(kpiId),
          scopeId: evidence.scopeId,
          evidenceClass: evidence.evidenceClass,
          checkType: check.id,
          checkStatus: check.passed ? ("pass" as const) : ("fail" as const),
          reasonCode:
            check.reasonCodes.join(",") ||
            `M13-DQ-${check.id.toUpperCase()}-PASS`,
          details:
            check.findings.map((finding) => finding.detail).join(" ") ||
            "No exception found.",
          evaluatedAt: input.asOf,
        })),
      );
      return {
        success: true,
        measurementId: evidence.measurementId,
        evidenceClass: "synthetic_demo" as const,
        productionAssertion: false,
        value,
        status: compareKpiValue(definition, value),
        dataQuality: quality,
      };
    }),

  listScorecards: authedQuery
    .input(
      z
        .object({ division: z.enum(["EO", "GAD", "GRO", "BHC"]).optional() })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      return input?.division
        ? db
            .select()
            .from(mgmaScorecards)
            .where(eq(mgmaScorecards.division, input.division))
            .orderBy(desc(mgmaScorecards.scorecardDate))
        : db
            .select()
            .from(mgmaScorecards)
            .orderBy(desc(mgmaScorecards.scorecardDate));
    }),

  createScorecard: adminQuery
    .input(
      z.object({
        division: z.enum(["EO", "GAD", "GRO", "BHC"]),
        scorecardDate: z.string().date(),
        viewMode: viewModeSchema.default("production_baseline"),
        executiveSummary: z.string().optional(),
        actionItems: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const dashboard = await buildMgmaDashboard(input.viewMode);
      const scope = dashboard.scopeSummaries.find(
        (item) => item.scopeId === input.division,
      );
      if (!scope)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Unknown scorecard scope",
        });
      const id = randomUUID();
      const db = getDb();
      await db.insert(mgmaScorecards).values({
        id,
        division: input.division,
        scopeType: scope.scopeType,
        evidenceClass: evidenceClassFor(input.viewMode),
        baselineStatus: scope.score === null ? "not_measured" : "measured",
        dataQualityStatus:
          dashboard.dataQuality.status === "pass"
            ? "pass"
            : dashboard.dataQuality.status === "fail"
              ? "fail"
              : "not_run",
        scorecardDate: input.scorecardDate,
        overallScore: scope.score === null ? null : Math.round(scope.score),
        kpisOnTarget: scope.onTarget,
        kpisAtRisk: scope.atRisk,
        kpisOffTarget: scope.offTarget,
        kpisNotMeasured: scope.notMeasured,
        domainScoresJson: JSON.stringify(
          dashboard.domains.map((domain) => ({
            id: domain.id,
            score: domain.score,
          })),
        ),
        executiveSummary: input.executiveSummary ?? null,
        actionItems: input.actionItems ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return {
        success: true,
        id,
        viewMode: input.viewMode,
        evidenceClass: evidenceClassFor(input.viewMode),
        productionAssertion: false,
        baselineStatus:
          scope.score === null
            ? ("not_measured" as const)
            : ("measured" as const),
        overallScore: scope.score,
      };
    }),

  executiveDashboard: authedQuery
    .input(z.object({ viewMode: viewModeSchema }).optional())
    .query(({ input }) =>
      buildMgmaDashboard(input?.viewMode ?? "production_baseline"),
    ),

  dataQualityReport: authedQuery
    .input(z.object({ viewMode: viewModeSchema }).optional())
    .query(async ({ input }) => {
      const dashboard = await buildMgmaDashboard(
        input?.viewMode ?? "production_baseline",
      );
      return {
        viewMode: dashboard.viewMode,
        evidenceLabel: dashboard.evidenceLabel,
        productionAssertion: false,
        ...dashboard.dataQuality,
      };
    }),

  governanceSummary: authedQuery.query(async () => {
    const db = getDb();
    const [governance, approvals] = await Promise.all([
      db.select().from(mgmaDashboardGovernance),
      db.select().from(mgmaOwnerApprovals),
    ]);
    return {
      baselinePeriod,
      governance,
      approvals,
      status: "prototype_reviewed_pending_milestone_owner_acceptance",
      productionEvidenceLoaded: false,
    };
  }),

  seedMgmaData: adminQuery.mutation(async () => {
    const db = getDb();
    const [domains, kpis, synthetic, production] = await Promise.all([
      db.select().from(mgmaDomains),
      db.select().from(mgmaKpiTargets),
      db
        .select()
        .from(mgmaMeasurements)
        .where(eq(mgmaMeasurements.evidenceClass, "synthetic_demo")),
      db
        .select()
        .from(mgmaMeasurements)
        .where(eq(mgmaMeasurements.evidenceClass, "production")),
    ]);
    return {
      success: true,
      message:
        "M1.3 controlled baseline is migration-owned; no unlabeled current values were written.",
      domains: domains.length,
      kpis: kpis.length,
      syntheticMeasurements: synthetic.length,
      productionMeasurements: production.length,
      productionAssertion: false,
    };
  }),
});
