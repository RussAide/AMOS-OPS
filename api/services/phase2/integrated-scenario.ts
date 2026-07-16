import { runM22RepresentativeScenario, M22_SCENARIO_IDS } from "../mhtcm/scenario";
import { runM23SyntheticSuite } from "../mhrs/synthetic-suite";
import { runM24AcceptanceSuite } from "../../lib/m24-gro/scenarios";
import { assertSyntheticBoundary, stablePhase2Id, type Phase2ScenarioRun } from "@contracts/phase2";

export const PHASE2_EXIT_CRITERIA = [
  "M2.2-01", "M2.2-02", "M2.2-03", "M2.2-04", "M2.2-05", "M2.2-06", "M2.2-07", "M2.2-08",
  "M2.3-01", "M2.3-02", "M2.3-03", "M2.3-04", "M2.3-05", "M2.3-06", "M2.3-07", "M2.3-08",
  "M2.4-01", "M2.4-02", "M2.4-03", "M2.4-04", "M2.4-05", "M2.4-06", "M2.4-07", "M2.4-08",
] as const;

export type Phase2ExitCriterion = (typeof PHASE2_EXIT_CRITERIA)[number];

function all<T>(values: readonly T[], predicate: (value: T) => boolean): boolean {
  return values.length > 0 && values.every(predicate);
}

export function runPhase2IntegratedScenario() {
  const m22 = runM22RepresentativeScenario();
  const m23 = runM23SyntheticSuite();
  const m24 = runM24AcceptanceSuite();
  const m23RepresentativeScenario = m23.scenarios[0];
  const m23RepresentativeCase = m23.snapshot.cases.find((item) => item.id === m23RepresentativeScenario?.caseId);
  const m24RepresentativePlacement = m24.snapshot.placements.find((item) => item.youthId === M22_SCENARIO_IDS.youthId);

  const representativeIdentity = {
    ccmgCaseId: "M21-CASE-EXISTING-001",
    referralId: M22_SCENARIO_IDS.referralId,
    youthId: M22_SCENARIO_IDS.youthId,
    cansAssessmentId: m22.snapshot.case.sourceCansAssessmentId,
    mhtcmCaseId: m22.snapshot.case.id,
    mhtcmPlanId: m22.snapshot.planVersions[m22.snapshot.planVersions.length - 1]?.planId ?? "",
    mhrsCaseId: m23RepresentativeCase?.id ?? "",
    groPlacementId: m24RepresentativePlacement?.id ?? "",
  };

  assertSyntheticBoundary({ id: representativeIdentity.youthId, evidenceClass: "synthetic_demo" });
  assertSyntheticBoundary({ id: representativeIdentity.mhtcmCaseId, evidenceClass: "synthetic_demo" });

  const m23Ready = m23.scenarios.filter((scenario) => scenario.billingReady && scenario.claimHandoffState === "ready_for_revenue");
  const m23RepresentativePlans = m23.snapshot.planVersions.filter((plan) => plan.caseId === m23RepresentativeCase?.id);
  const m23RepresentativeSessions = m23.snapshot.sessions.filter((session) => session.caseId === m23RepresentativeCase?.id);
  const m23RepresentativeGoals = m23.snapshot.goals.filter((goal) => goal.caseId === m23RepresentativeCase?.id);
  const m23RepresentativeInterventions = m23.snapshot.interventions.filter((intervention) => intervention.caseId === m23RepresentativeCase?.id);
  const m24RepresentativeTransitions = m24.snapshot.transitions.filter((transition) => transition.placementId === m24RepresentativePlacement?.id);
  const m24EngagementTypes = new Set(m24.snapshot.engagementEvents.filter((event) => event.youthId === representativeIdentity.youthId).map((event) => event.eventType));

  const criteria: Record<Phase2ExitCriterion, boolean> = {
    ...m22.criteria,
    "M2.3-01": new Set(m23.scenarios.map((scenario) => scenario.category)).size === 4,
    "M2.3-02": m23RepresentativeCase !== undefined && m23RepresentativePlans.length >= 2 && m23RepresentativeGoals.length > 0 && m23RepresentativeInterventions.length > 0 && m23RepresentativeSessions.length > 0 && m23.snapshot.progress.some((item) => item.caseId === m23RepresentativeCase.id) && m23.snapshot.barriers.some((item) => item.caseId === m23RepresentativeCase.id) && m23.snapshot.outcomes.some((item) => item.caseId === m23RepresentativeCase.id),
    "M2.3-03": m23Ready.length === 4 && m23.missingEvidenceControls.every((handoff) => handoff.state === "rejected"),
    "M2.3-04": m23.scenarios.some((scenario) => scenario.procedureCode === "H2014") && m23.scenarios.some((scenario) => scenario.procedureCode === "H2017") && m23.h2014HoControl.state === "rejected",
    "M2.3-05": m23.review.state === "completed" && m23.review.priorPlanVersion === 1 && m23.review.newPlanVersion === 2,
    "M2.3-06": m23RepresentativeCase !== undefined && m23RepresentativeCase.careBridge.ccmg.accessMode === "read_only" && m23RepresentativeCase.careBridge.cans.accessMode === "read_only" && m23RepresentativeCase.careBridge.mhtcm.accessMode === "read_only",
    "M2.3-07": m23Ready.length === 4 && m23.missingEvidenceControls.length === 5 && m23.missingEvidenceControls.every((handoff) => handoff.state === "rejected"),
    "M2.3-08": m23.scenarios.length === 4 && all(m23.scenarios, (scenario) => scenario.billingReady),
    "M2.4-01": m24.snapshot.stages.length === 3 && m24.snapshot.beds.length === 48 && Boolean(m24RepresentativePlacement) && m24RepresentativeTransitions.some((item) => item.transitionType === "admission") && m24RepresentativeTransitions.some((item) => item.transitionType === "discharge"),
    "M2.4-02": m24.snapshot.staffingEvaluations.some((item) => item.compliant) && m24.snapshot.staffingEvaluations.some((item) => !item.compliant),
    "M2.4-03": m24.snapshot.shifts.length >= 3 && m24.snapshot.safetyRounds.length > 0 && m24.snapshot.careLogs.length > 0 && m24.snapshot.shiftHandoffs.some((item) => item.status === "completed") && m24.snapshot.tasks.some((item) => item.escalationLevel !== "none"),
    "M2.4-04": m24.snapshot.medications.some((item) => item.isPrn && item.isControlled && item.prnEffectiveness !== null) && m24.snapshot.medicationHandoffs.some((item) => item.status === "accepted"),
    "M2.4-05": m24.snapshot.incidents.some((item) => item.level === "L3" && item.status === "closed" && item.documentationTimely === true && item.debriefTimely === true),
    "M2.4-06": m24.snapshot.rightsAcknowledgments.some((item) => item.youthId === representativeIdentity.youthId && item.compliant) && m24.snapshot.practiceDecisions.some((item) => item.allowed && item.classification === "supportive") && m24.snapshot.practiceDecisions.some((item) => !item.allowed && item.classification === "prohibited" && item.reasonCodes.length > 0) && m24.snapshot.practiceDecisions.some((item) => !item.allowed && item.classification === "unknown" && item.reasonCodes.length > 0),
    "M2.4-07": ["family_contact", "activity", "transport", "crisis", "discharge_coordination"].every((type) => m24EngagementTypes.has(type as never)) && m24RepresentativePlacement?.status === "discharged",
    "M2.4-08": m24.passed && m24.results.length === 6 && all(m24.results, (result) => result.passed),
  };

  const identityContinuity = m23RepresentativeCase !== undefined
    && m24RepresentativePlacement !== undefined
    && m22.snapshot.case.youthId === m23RepresentativeCase.subjectId
    && m23RepresentativeCase.subjectId === m24RepresentativePlacement.youthId
    && m22.snapshot.case.referralId === m23RepresentativeCase.careBridge.ccmg.referralId
    && m23RepresentativeCase.careBridge.ccmg.caseId === m24RepresentativePlacement.caseId
    && representativeIdentity.mhtcmPlanId === m23RepresentativeCase.careBridge.mhtcm.planId;
  const failedCriteria = PHASE2_EXIT_CRITERIA.filter((criterion) => !criteria[criterion]);
  const scenarioRun: Phase2ScenarioRun = {
    id: stablePhase2Id("SYNTH-PHASE2-RUN", representativeIdentity.youthId, "PHASE2_EXIT"),
    milestone: "PHASE2_EXIT",
    scenarioType: "ccmg_to_mhtcm_mhrs_gro_discharge_aftercare_claim",
    status: identityContinuity && failedCriteria.length === 0 ? "passed" : "failed",
    episodeId: "SYNTH-PHASE2-EPISODE-001",
    startedAt: "2026-06-01T09:00:00.000Z",
    completedAt: "2026-09-30T10:00:00.000Z",
    assertionsPassed: PHASE2_EXIT_CRITERIA.length - failedCriteria.length + (identityContinuity ? 1 : 0),
    assertionsFailed: failedCriteria.length + (identityContinuity ? 0 : 1),
    evidence: { representativeIdentity, identityContinuity, criteria, failedCriteria, evidenceClass: "synthetic_demo" },
  };
  assertSyntheticBoundary({ id: scenarioRun.id, evidenceClass: "synthetic_demo" });

  return {
    milestone: "PHASE2_EXIT" as const,
    evidenceClass: "synthetic_demo" as const,
    representativeIdentity,
    identityContinuity,
    criteria,
    failedCriteria,
    exitGate: scenarioRun.status === "passed",
    scenarioRun,
    milestoneEvidence: { m22, m23, m24 },
  };
}
