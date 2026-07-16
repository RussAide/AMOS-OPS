import { runM31SyntheticSuite } from "../../m31";
import { runM32SyntheticSuite } from "../../m32";
import { runM33SyntheticSuite } from "../../m33";
import { runM41aScenario } from "../../m41a";
import {
  DX1_EVALUATED_AT,
  DX1_SCENARIO_ID,
  type Dx1AuditEvent,
} from "../contracts";
import { DX1_PILOT_FIXTURE } from "../fixtures";
import {
  assertDx1Intelligence,
  createDx1IntelligenceAuditEvent,
  immutable,
  unique,
} from "./support";

export const DX1_DASHBOARD_DOMAINS = [
  "operational",
  "compliance",
  "revenue",
  "workforce",
  "executive",
] as const;

export type Dx1DashboardDomain = (typeof DX1_DASHBOARD_DOMAINS)[number];

export interface Dx1DashboardCard {
  readonly domain: Dx1DashboardDomain;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly referralId: string;
  readonly episodeId: string;
  readonly documentPacketId: string;
  readonly pilotStageCount: 8;
  readonly status: "coherent";
  readonly sourceMilestone: "M3.1" | "M3.2" | "M3.3" | "M4.1A";
  readonly sourceAccepted: true;
  readonly sourceEvidenceIds: readonly string[];
  readonly measures: Readonly<Record<string, string | number | boolean>>;
  readonly evaluatedAt: typeof DX1_EVALUATED_AT;
  readonly synthetic: true;
}

export interface Dx1DashboardReconciliationResult {
  readonly accepted: boolean;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly cards: readonly Dx1DashboardCard[];
  readonly validationErrors: readonly string[];
  readonly sourceMilestones: readonly ["M3.1", "M3.2", "M3.3", "M4.1A"];
  readonly auditEvents: readonly Dx1AuditEvent[];
  readonly liveDashboardReads: 0;
  readonly liveDashboardWrites: 0;
  readonly synthetic: true;
}

function card(input: {
  domain: Dx1DashboardDomain;
  sourceMilestone: Dx1DashboardCard["sourceMilestone"];
  sourceEvidenceIds: readonly string[];
  measures: Readonly<Record<string, string | number | boolean>>;
}): Readonly<Dx1DashboardCard> {
  return immutable({
    domain: input.domain,
    scenarioId: DX1_SCENARIO_ID,
    referralId: DX1_PILOT_FIXTURE.referralId,
    episodeId: DX1_PILOT_FIXTURE.episodeId,
    documentPacketId: DX1_PILOT_FIXTURE.documentPacketId,
    pilotStageCount: 8 as const,
    status: "coherent" as const,
    sourceMilestone: input.sourceMilestone,
    sourceAccepted: true as const,
    sourceEvidenceIds: unique(input.sourceEvidenceIds),
    measures: input.measures,
    evaluatedAt: DX1_EVALUATED_AT,
    synthetic: true as const,
  });
}

export function validateDx1DashboardCards(
  cards: readonly Dx1DashboardCard[],
): readonly string[] {
  const errors: string[] = [];
  if (
    cards.length !== DX1_DASHBOARD_DOMAINS.length ||
    new Set(cards.map((candidate) => candidate.domain)).size !==
      DX1_DASHBOARD_DOMAINS.length ||
    DX1_DASHBOARD_DOMAINS.some(
      (domain) => !cards.some((candidate) => candidate.domain === domain),
    )
  )
    errors.push("DX1_DASHBOARD_DOMAIN_INVENTORY_MISMATCH");
  for (const candidate of cards) {
    if (candidate.scenarioId !== DX1_SCENARIO_ID)
      errors.push(`DX1_DASHBOARD_SCENARIO_DRIFT:${candidate.domain}`);
    if (
      candidate.referralId !== DX1_PILOT_FIXTURE.referralId ||
      candidate.episodeId !== DX1_PILOT_FIXTURE.episodeId ||
      candidate.documentPacketId !== DX1_PILOT_FIXTURE.documentPacketId
    )
      errors.push(`DX1_DASHBOARD_ENTITY_DRIFT:${candidate.domain}`);
    if (
      candidate.pilotStageCount !== 8 ||
      candidate.status !== "coherent" ||
      !candidate.sourceAccepted
    )
      errors.push(`DX1_DASHBOARD_STATUS_DRIFT:${candidate.domain}`);
    if (candidate.sourceEvidenceIds.length === 0)
      errors.push(`DX1_DASHBOARD_PROVENANCE_MISSING:${candidate.domain}`);
    if (!candidate.synthetic)
      errors.push(
        `DX1_DASHBOARD_SYNTHETIC_BOUNDARY_REQUIRED:${candidate.domain}`,
      );
  }
  return immutable(unique(errors));
}

export function runDx1DashboardReconciliation(): Readonly<Dx1DashboardReconciliationResult> {
  const compliance = runM31SyntheticSuite();
  const revenue = runM32SyntheticSuite();
  const workforce = runM33SyntheticSuite();
  const executive = runM41aScenario();
  assertDx1Intelligence(
    compliance.passed &&
      revenue.passed &&
      workforce.passed &&
      executive.exitGate,
    "DX1_DASHBOARD_INHERITED_SOURCE_NOT_ACCEPTED",
  );
  const enterpriseRisk = compliance.snapshot.riskViews.find(
    (view) => view.scope === "enterprise",
  );
  const cleanClaimRate = revenue.snapshot.metrics.find(
    (metric) => metric.name === "clean_claim_rate",
  );
  const daysInAr = revenue.snapshot.metrics.find(
    (metric) => metric.name === "days_in_ar",
  );
  assertDx1Intelligence(
    enterpriseRisk && cleanClaimRate && daysInAr,
    "DX1_DASHBOARD_REQUIRED_MEASURE_MISSING",
  );
  const enterpriseMetrics = executive.dashboards.ENTERPRISE.metrics;

  const cards: readonly Dx1DashboardCard[] = immutable([
    card({
      domain: "operational",
      sourceMilestone: "M4.1A",
      sourceEvidenceIds: [
        executive.scenarioId,
        ...executive.criteria.map((criterion) => criterion.criterionId),
      ],
      measures: {
        pilotStagesComplete: DX1_PILOT_FIXTURE.expectedStages.length,
        enterpriseMetricsReconciled: enterpriseMetrics.length,
        executiveSourceExitGate: executive.exitGate,
      },
    }),
    card({
      domain: "compliance",
      sourceMilestone: "M3.1",
      sourceEvidenceIds: [
        ...compliance.criteria.map((criterion) => criterion.criterionId),
        ...enterpriseRisk.sourceRecordIds,
      ],
      measures: {
        findings: compliance.snapshot.findings.length,
        correctiveActionPlans: compliance.snapshot.correctiveActionPlans.length,
        enterpriseRiskScore: enterpriseRisk.riskScore,
        riskTrend: enterpriseRisk.riskTrend,
      },
    }),
    card({
      domain: "revenue",
      sourceMilestone: "M3.2",
      sourceEvidenceIds: [
        cleanClaimRate.id,
        daysInAr.id,
        ...revenue.criteria.map((criterion) => criterion.criterionId),
      ],
      measures: {
        cleanClaimRate: cleanClaimRate.value,
        daysInAr: daysInAr.value,
        acceptedSyntheticHandoffs: revenue.snapshot.handoffValidations.filter(
          (validation) => validation.accepted,
        ).length,
        completeSyntheticClaims: revenue.snapshot.claimScenarios.length,
      },
    }),
    card({
      domain: "workforce",
      sourceMilestone: "M3.3",
      sourceEvidenceIds: [
        ...workforce.criteria.map((criterion) => criterion.criterionId),
        ...workforce.snapshot.scenarios.map((scenario) => scenario.id),
      ],
      measures: {
        syntheticWorkers: workforce.snapshot.workforce.length,
        expirationAlerts: workforce.snapshot.expirationAlerts.length,
        workforceScenariosPassed: workforce.snapshot.scenarios.filter(
          (scenario) => scenario.status === "passed",
        ).length,
        releaseToDutyGatePassed: workforce.snapshot.releaseToDutyPassed,
      },
    }),
    card({
      domain: "executive",
      sourceMilestone: "M4.1A",
      sourceEvidenceIds: [
        executive.scenarioId,
        ...executive.decisions.map((decision) => decision.id),
        ...enterpriseMetrics.map((metric) => metric.definition.id),
      ],
      measures: {
        coherentDomains: 5,
        humanDecisionRecords: executive.decisions.length,
        enterpriseAlerts: executive.alerts.length,
        executiveExitGate: executive.exitGate,
      },
    }),
  ]);
  const validationErrors = validateDx1DashboardCards(cards);
  assertDx1Intelligence(
    validationErrors.length === 0,
    `DX1_DASHBOARD_RECONCILIATION_FAILED:${validationErrors.join(",")}`,
  );
  const auditEvents = immutable(
    cards.map((candidate) =>
      createDx1IntelligenceAuditEvent({
        action: `dashboard-${candidate.domain}-reconciled`,
        actorId: "SYNTH-DX1-ACTOR-EXEC-005",
        actorRole: "executive",
        outcome: "completed",
        reason:
          "The dashboard projection reconciles the shared DX.1 scenario through accepted source evidence.",
        evidenceIds: [
          candidate.scenarioId,
          candidate.sourceMilestone,
          ...candidate.sourceEvidenceIds.slice(0, 3),
        ],
        stageId: "executive-risk-revenue-summary",
      }),
    ),
  );
  return immutable({
    accepted: true,
    scenarioId: DX1_SCENARIO_ID,
    cards,
    validationErrors,
    sourceMilestones: ["M3.1", "M3.2", "M3.3", "M4.1A"] as const,
    auditEvents,
    liveDashboardReads: 0 as const,
    liveDashboardWrites: 0 as const,
    synthetic: true as const,
  });
}
