import {
  getM41aMetricDefinition,
  type M41aScopeId,
  type M41aSourceReport,
  type M41aSensitivity,
} from "@contracts/m41a";
import type { UserRole } from "@/constants/roles";
import type {
  M31Snapshot,
  M32Snapshot,
  M33Snapshot,
  M34Snapshot,
} from "@contracts/phase3";
import { runPhase2IntegratedScenario } from "../phase2/integrated-scenario";
import { runPhase3IntegratedScenario } from "../phase3/integrated-scenario";

export const M41A_AS_OF = "2026-10-14T12:00:00.000Z";
export const M41A_PERIOD_START = "2026-07-01";
export const M41A_PERIOD_END = "2026-09-30";
const CURRENT_REFRESH = "2026-10-14T11:30:00.000Z";
const STALE_REFRESH = "2026-07-31T12:00:00.000Z";

export const M41A_STAGE_CROSSWALK = Object.freeze([
  {
    stageId: "STAGE_1" as const,
    phase2StageId: "M24-STAGE-1",
    phase3StageId: "SYNTH-M34-STAGE-1",
    canonicalStageId: "campus-stage-1",
  },
  {
    stageId: "STAGE_2" as const,
    phase2StageId: "M24-STAGE-2",
    phase3StageId: "SYNTH-M34-STAGE-2",
    canonicalStageId: "campus-stage-2",
  },
  {
    stageId: "STAGE_3" as const,
    phase2StageId: "M24-STAGE-3",
    phase3StageId: "SYNTH-M34-STAGE-3",
    canonicalStageId: "campus-stage-3",
  },
]);

export interface M41aSafeSourceRow {
  id: string;
  reportId: string;
  metricId: string;
  scope: M41aScopeId;
  label: string;
  sensitivity: M41aSensitivity;
  detail: Readonly<Record<string, string | number | boolean | null>>;
}

export interface M41aSupplementalRegisters {
  budgetActual: readonly {
    id: string;
    scope: M41aScopeId;
    kind: "budget" | "actual";
    amount: number;
    ownerRole: UserRole;
    version: 1;
  }[];
  groRevenue: readonly {
    id: string;
    amount: number;
    ownerRole: "revenue-cycle-manager";
    version: 1;
  }[];
  strategicInitiatives: readonly {
    id: string;
    dueAt: string;
    completedAt: string | null;
    status: "completed" | "in_progress";
    ownerRole: "managing-director";
    version: 1;
  }[];
}

export interface M41aSourceBundle {
  phase2RunId: string;
  phase3RunId: string;
  sourceReports: readonly M41aSourceReport[];
  safeSourceRows: readonly M41aSafeSourceRow[];
  stageCensus: readonly {
    stageId: "STAGE_1" | "STAGE_2" | "STAGE_3";
    label: string;
    census: number;
    capacity: number;
    sourceRecordIds: readonly string[];
  }[];
  supplementalRegisters: M41aSupplementalRegisters;
}

function round(value: number, precision = 4): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function report(
  metricId: string,
  scope: M41aScopeId,
  value: number,
  numerator: number,
  denominator: number,
  sourceRecordIds: readonly string[],
  sourceReference: string,
  refreshedAt = CURRENT_REFRESH,
  suffix = "001",
): M41aSourceReport {
  const definition = getM41aMetricDefinition(metricId);
  return Object.freeze({
    id: `SYNTH-M41A-REPORT-${scope}-${metricId}-${suffix}`,
    scope,
    metricId,
    periodStart: M41A_PERIOD_START,
    periodEnd: M41A_PERIOD_END,
    value: round(value),
    numerator,
    denominator,
    sourceRecordIds: Object.freeze([...sourceRecordIds]),
    sourceReference,
    ownerRole: definition.owner.roleId,
    version: 1,
    refreshedAt,
    evidenceClass: "synthetic_demo",
  });
}

function elapsedDays(start: string, end: string): number {
  return Math.max(
    0,
    Math.ceil((Date.parse(end) - Date.parse(start)) / 86_400_000),
  );
}

function buildSafeRows(
  reports: readonly M41aSourceReport[],
): readonly M41aSafeSourceRow[] {
  return Object.freeze(
    reports.flatMap((item) => {
      const sensitivity = getM41aMetricDefinition(item.metricId).sensitivity;
      return item.sourceRecordIds.map((sourceRecordId, index) =>
        Object.freeze({
          id: `SYNTH-M41A-SAFE-${item.id}-${String(index + 1).padStart(3, "0")}`,
          reportId: item.id,
          metricId: item.metricId,
          scope: item.scope,
          label: `Controlled source record ${index + 1}`,
          sensitivity,
          detail: Object.freeze({
            sourceRecordId,
            sourceReference: item.sourceReference,
            periodEnd: item.periodEnd,
            evidenceClass: "synthetic_demo",
          }),
        }),
      );
    }),
  );
}

export function buildM41aSourceBundle(): M41aSourceBundle {
  const phase2 = runPhase2IntegratedScenario();
  const phase3 = runPhase3IntegratedScenario();
  if (!phase2.exitGate || !phase3.exitGate)
    throw new Error("M41A_ACCEPTED_SOURCE_GATE_FAILED");

  const m22 = phase2.milestoneEvidence.m22.snapshot;
  const m23 = phase2.milestoneEvidence.m23;
  const m24 = phase2.milestoneEvidence.m24.snapshot;
  const m31 = phase3.moduleResults["M3.1"].snapshot as M31Snapshot;
  const m32 = phase3.moduleResults["M3.2"].snapshot as M32Snapshot;
  const m33 = phase3.moduleResults["M3.3"].snapshot as M33Snapshot;
  const m34 = phase3.moduleResults["M3.4"].snapshot as M34Snapshot;

  const stageCensus = M41A_STAGE_CROSSWALK.map((crosswalk) => {
    const censusStage = m24.stages.find(
      (stage) => stage.id === crosswalk.phase2StageId,
    );
    const facilityStage = m34.campusStages.find(
      (stage) => stage.id === crosswalk.phase3StageId,
    );
    if (
      !censusStage ||
      !facilityStage ||
      facilityStage.canonicalStageId !== crosswalk.canonicalStageId
    )
      throw new Error(`M41A_STAGE_CROSSWALK_FAILED:${crosswalk.stageId}`);
    return Object.freeze({
      stageId: crosswalk.stageId,
      label: censusStage.name,
      census: censusStage.currentCensus,
      capacity: censusStage.operationalCapacity,
      sourceRecordIds: Object.freeze([censusStage.id, facilityStage.id]),
    });
  });

  const supplementalRegisters: M41aSupplementalRegisters = {
    budgetActual: Object.freeze([
      {
        id: "SYNTH-M41A-FIN-BHC-BUDGET",
        scope: "BHC",
        kind: "budget",
        amount: 115_000,
        ownerRole: "revenue-cycle-manager",
        version: 1,
      },
      {
        id: "SYNTH-M41A-FIN-BHC-ACTUAL",
        scope: "BHC",
        kind: "actual",
        amount: 112_000,
        ownerRole: "revenue-cycle-manager",
        version: 1,
      },
      {
        id: "SYNTH-M41A-FIN-GRO-BUDGET",
        scope: "GRO",
        kind: "budget",
        amount: 65_000,
        ownerRole: "revenue-cycle-manager",
        version: 1,
      },
      {
        id: "SYNTH-M41A-FIN-EO-BUDGET",
        scope: "EO",
        kind: "budget",
        amount: 85_000,
        ownerRole: "administrator",
        version: 1,
      },
      {
        id: "SYNTH-M41A-FIN-EO-ACTUAL",
        scope: "EO",
        kind: "actual",
        amount: 80_000,
        ownerRole: "administrator",
        version: 1,
      },
      {
        id: "SYNTH-M41A-FIN-GAD-BUDGET",
        scope: "GAD",
        kind: "budget",
        amount: 7_000,
        ownerRole: "facilities-manager",
        version: 1,
      },
    ] as const),
    groRevenue: Object.freeze([
      {
        id: "SYNTH-M41A-GRO-REVENUE-Q3",
        amount: 64_000,
        ownerRole: "revenue-cycle-manager",
        version: 1,
      },
    ] as const),
    strategicInitiatives: Object.freeze([
      {
        id: "SYNTH-M41A-INITIATIVE-001",
        dueAt: "2026-08-31",
        completedAt: "2026-08-28",
        status: "completed",
        ownerRole: "managing-director",
        version: 1,
      },
      {
        id: "SYNTH-M41A-INITIATIVE-002",
        dueAt: "2026-09-30",
        completedAt: "2026-09-30",
        status: "completed",
        ownerRole: "managing-director",
        version: 1,
      },
      {
        id: "SYNTH-M41A-INITIATIVE-003",
        dueAt: "2026-09-30",
        completedAt: null,
        status: "in_progress",
        ownerRole: "managing-director",
        version: 1,
      },
    ] as const),
  };

  const activeGroStages = m24.stages.filter(
    (stage) => stage.status === "operational",
  );
  const groCapacity = activeGroStages.reduce(
    (total, stage) => total + stage.operationalCapacity,
    0,
  );
  const groCensus = activeGroStages.reduce(
    (total, stage) => total + stage.currentCensus,
    0,
  );
  const signedSessions = m23.snapshot.sessions.filter(
    (session) => session.billingInput.documentation.providerSignature !== null,
  );
  const bhcCases = m23.snapshot.cases;
  const bhcAccessDays = [
    elapsedDays(
      m22.case.createdAt,
      `${m22.encounters[0]?.serviceDate ?? M41A_PERIOD_END}T00:00:00.000Z`,
    ),
    ...bhcCases.map((careCase) => {
      const first = m23.snapshot.sessions
        .filter((session) => session.caseId === careCase.id)
        .map((session) => session.documentedAt)
        .sort()[0];
      return elapsedDays(careCase.createdAt, first ?? careCase.createdAt);
    }),
  ];
  const bhcMeanAccessDays =
    bhcAccessDays.reduce((total, value) => total + value, 0) /
    bhcAccessDays.length;
  const workforceEvidenceIds = m33.credentialEvidence.map((item) => item.id);
  const credentialCurrent = m33.credentialEvidence.filter(
    (item) => item.status === "current" || item.status === "expiring",
  ).length;
  const chartFindings = m31.findings.filter((item) =>
    item.auditId.includes("CHART"),
  );
  const bhcFindings = m31.findings.filter((item) => item.division === "BHC");
  const gadFindings = m31.findings.filter((item) => item.division === "GAD");
  const privacyFindings = m31.findings.filter((item) => item.division === "EO");
  const procurementMatched = m34.procurementCycles.filter(
    (cycle) =>
      cycle.matchOutcome === "matched" ||
      cycle.matchOutcome === "exception_resolved",
  );
  const gadActualCost =
    m34.procurementCycles.reduce(
      (total, cycle) => total + cycle.invoicedAmountCents,
      0,
    ) / 100;
  const eoWork = phase3.workItems.filter((item) => item.domain !== "GAD");
  const gadWork = phase3.workItems.filter((item) => item.domain === "GAD");
  const withinSla = (item: (typeof phase3.workItems)[number]) =>
    item.completedAt !== undefined && item.completedAt <= item.dueAt;

  const reports: M41aSourceReport[] = [];
  const add = (...items: M41aSourceReport[]) => reports.push(...items);
  const phase2Ref = `Accepted Phase 2 integrated scenario ${phase2.scenarioRun.id}`;
  const phase3Ref = `Accepted Phase 3 integrated scenario ${phase3.scenarioRun.id}`;

  add(
    report(
      "EXEC-CENSUS-3STAGE",
      "ENTERPRISE",
      stageCensus.reduce((n, stage) => n + stage.census, 0),
      stageCensus.reduce((n, stage) => n + stage.census, 0),
      1,
      stageCensus.flatMap((stage) => stage.sourceRecordIds),
      phase2Ref,
    ),
    report(
      "EXEC-REVENUE-VARIANCE",
      "ENTERPRISE",
      (176_000 / 180_000) * 100,
      176_000,
      180_000,
      [
        "SYNTH-M41A-FIN-BHC-ACTUAL",
        "SYNTH-M41A-GRO-REVENUE-Q3",
        "SYNTH-M41A-FIN-BHC-BUDGET",
        "SYNTH-M41A-FIN-GRO-BUDGET",
      ],
      "M4.1A Budget/Actual and GRO Revenue registers",
    ),
    report(
      "ENTERPRISE-MGMA-007",
      "ENTERPRISE",
      100,
      chartFindings.length,
      chartFindings.length,
      chartFindings.map((item) => item.id),
      phase3Ref,
    ),
    report(
      "ENTERPRISE-MGMA-013",
      "ENTERPRISE",
      (2 / 3) * 100,
      2,
      3,
      supplementalRegisters.strategicInitiatives.map((item) => item.id),
      "M4.1A Strategic Initiative register",
    ),
    report(
      "BHC-REVENUE",
      "BHC",
      112_000,
      112_000,
      1,
      [
        "SYNTH-M41A-FIN-BHC-ACTUAL",
        ...m32.claimScenarios.map((item) => item.claimId),
      ],
      `${phase3Ref}; M4.1A Budget/Actual register`,
    ),
    report(
      "BHC-CENSUS",
      "BHC",
      bhcCases.length,
      bhcCases.length,
      1,
      bhcCases.map((item) => item.id),
      phase2Ref,
    ),
    report(
      "BHC-UTILIZATION",
      "BHC",
      (signedSessions.length / m23.snapshot.sessions.length) * 100,
      signedSessions.length,
      m23.snapshot.sessions.length,
      m23.snapshot.sessions.map((item) => item.id),
      phase2Ref,
    ),
    report(
      "BHC-MGMA-009",
      "BHC",
      100,
      2,
      2,
      [
        m22.planVersions[m22.planVersions.length - 1]?.planId ??
          "SYNTH-MHTCM-PLAN-001",
        m23.review.alertId,
      ],
      phase2Ref,
    ),
    report(
      "BHC-MGMA-010",
      "BHC",
      bhcMeanAccessDays,
      bhcAccessDays.reduce((n, value) => n + value, 0),
      bhcAccessDays.length,
      [m22.case.referralId, ...bhcCases.map((item) => item.id)],
      phase2Ref,
    ),
    report(
      "BHC-OPERATIONAL-RISK",
      "BHC",
      100,
      bhcFindings.filter((item) => item.status === "closed" && item.capId)
        .length,
      Math.max(1, bhcFindings.length),
      bhcFindings.map((item) => item.id),
      phase3Ref,
    ),
    report(
      "GRO-REVENUE",
      "GRO",
      supplementalRegisters.groRevenue[0].amount,
      supplementalRegisters.groRevenue[0].amount,
      1,
      supplementalRegisters.groRevenue.map((item) => item.id),
      "M4.1A GRO Revenue register",
    ),
    report(
      "GRO-CENSUS",
      "GRO",
      groCensus,
      groCensus,
      1,
      activeGroStages.map((item) => item.id),
      phase2Ref,
    ),
    report(
      "GRO-UTILIZATION",
      "GRO",
      (groCensus / groCapacity) * 100,
      groCensus,
      groCapacity,
      activeGroStages.map((item) => item.id),
      phase2Ref,
    ),
    report(
      "GRO-MGMA-009",
      "GRO",
      100,
      1,
      1,
      [m23.review.alertId, phase2.representativeIdentity.groPlacementId],
      phase2Ref,
    ),
    report(
      "GRO-MGMA-010",
      "GRO",
      0,
      0,
      1,
      [
        phase2.representativeIdentity.groPlacementId,
        m24.careLogs[0]?.id ?? "SYNTH-M24-CARE-LOG-00075",
      ],
      phase2Ref,
    ),
    report(
      "GRO-OPERATIONAL-RISK",
      "GRO",
      100,
      1,
      1,
      [
        m31.riskViews.find((item) => item.division === "GRO")
          ?.sourceRecordIds[0] ?? "SYNTH-M31-RISK-BASELINE-GRO",
      ],
      phase3Ref,
    ),
    report(
      "EO-MGMA-007",
      "EO",
      0,
      0,
      Math.max(1, privacyFindings.length),
      privacyFindings.map((item) => item.id),
      phase3Ref,
    ),
    report(
      "EO-COST-VARIANCE",
      "EO",
      (80_000 / 85_000) * 100,
      80_000,
      85_000,
      ["SYNTH-M41A-FIN-EO-ACTUAL", "SYNTH-M41A-FIN-EO-BUDGET"],
      "M4.1A Budget/Actual register",
    ),
    report(
      "EO-MGMA-005",
      "EO",
      (credentialCurrent / m33.credentialEvidence.length) * 100,
      credentialCurrent,
      m33.credentialEvidence.length,
      workforceEvidenceIds,
      phase3Ref,
    ),
    report(
      "EO-MGMA-008",
      "EO",
      m34.uptime.uptimePercent,
      m34.uptime.availableMinutes,
      m34.uptime.scheduledMinutes,
      m34.uptime.sourceEventIds,
      phase3Ref,
      STALE_REFRESH,
    ),
    report(
      "EO-MGMA-014",
      "EO",
      (eoWork.filter(withinSla).length / eoWork.length) * 100,
      eoWork.filter(withinSla).length,
      eoWork.length,
      eoWork.map((item) => item.id),
      phase3Ref,
    ),
    report(
      "GAD-MGMA-007",
      "GAD",
      0,
      0,
      Math.max(1, gadFindings.length),
      gadFindings.map((item) => item.id),
      `${phase3Ref}:compliance`,
      CURRENT_REFRESH,
      "A",
    ),
    report(
      "GAD-MGMA-007",
      "GAD",
      100,
      m34.safetyDrills.length,
      m34.safetyDrills.length,
      m34.safetyDrills.map((item) => item.id),
      `${phase3Ref}:safety`,
      CURRENT_REFRESH,
      "B",
    ),
    report(
      "GAD-COST-VARIANCE",
      "GAD",
      (gadActualCost / 7_000) * 100,
      gadActualCost,
      7_000,
      [
        "SYNTH-M41A-FIN-GAD-BUDGET",
        ...m34.procurementCycles.map((item) => item.invoiceId),
      ],
      `${phase3Ref}; M4.1A Budget/Actual register`,
    ),
    report(
      "GAD-MGMA-005",
      "GAD",
      (credentialCurrent / m33.credentialEvidence.length) * 100,
      credentialCurrent,
      m33.credentialEvidence.length,
      workforceEvidenceIds,
      phase3Ref,
    ),
    report(
      "GAD-MGMA-008",
      "GAD",
      m34.uptime.uptimePercent,
      m34.uptime.availableMinutes,
      m34.uptime.scheduledMinutes,
      m34.uptime.sourceEventIds,
      phase3Ref,
    ),
    report(
      "GAD-PROCUREMENT",
      "GAD",
      (procurementMatched.length / m34.procurementCycles.length) * 100,
      procurementMatched.length,
      m34.procurementCycles.length,
      m34.procurementCycles.map((item) => item.id),
      phase3Ref,
    ),
    report(
      "GAD-MGMA-014",
      "GAD",
      (gadWork.filter(withinSla).length / gadWork.length) * 100,
      gadWork.filter(withinSla).length,
      gadWork.length,
      gadWork.map((item) => item.id),
      phase3Ref,
    ),
  );

  const profitCenterReports = reports.filter(
    (item) => item.scope === "BHC" || item.scope === "GRO",
  );
  const profitCenterMeasuresOnTarget = profitCenterReports.filter((item) => {
    const definition = getM41aMetricDefinition(item.metricId);
    return definition.target.comparison === "gte"
      ? item.value >= definition.target.value
      : item.value <= definition.target.value;
  });
  add(
    report(
      "EXEC-PC-PERFORMANCE",
      "ENTERPRISE",
      (profitCenterMeasuresOnTarget.length / profitCenterReports.length) * 100,
      profitCenterMeasuresOnTarget.length,
      profitCenterReports.length,
      profitCenterReports.map((item) => item.id),
      "Recalculated from the twelve current BHC/GRO metric source reports",
    ),
  );

  return Object.freeze({
    phase2RunId: phase2.scenarioRun.id,
    phase3RunId: phase3.scenarioRun.id,
    sourceReports: Object.freeze(reports),
    safeSourceRows: buildSafeRows(reports),
    stageCensus: Object.freeze(stageCensus),
    supplementalRegisters,
  });
}
