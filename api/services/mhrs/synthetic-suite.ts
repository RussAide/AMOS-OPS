import {
  buildReadyM23ClinicalEvidence,
  cloneM23ClinicalEvidence,
} from "../../../contracts/mhrs/synthetic";
import type {
  M23Actor,
  M23ScenarioResult,
  M23SyntheticSuiteResult,
} from "../../../contracts/mhrs/types";
import type { MhrsCategory, MhrsServiceBasis } from "../../../contracts/regulatory/clinical";
import { M23ProgramEngine } from "./engine";
import { M22_SCENARIO_IDS } from "../mhtcm/scenario";

export const M23_SYNTHETIC_SPECIALIST: M23Actor = {
  id: "SYNTH-M23-THERAPIST-001",
  role: "therapist",
  displayName: "Synthetic MHRS Specialist",
};

export const M23_SYNTHETIC_SUPERVISOR: M23Actor = {
  id: "SYNTH-M23-SUPERVISOR-001",
  role: "mhrs-supervisor",
  displayName: "Synthetic MHRS Supervisor",
};

export const M23_SYNTHETIC_AUDITOR: M23Actor = {
  id: "SYNTH-M23-AUDITOR-001",
  role: "chart-auditor",
  displayName: "Synthetic Chart Auditor",
};

interface ScenarioDefinition {
  readonly id: string;
  readonly name: string;
  readonly ageYears: number;
  readonly category: MhrsCategory;
  readonly serviceBasis: MhrsServiceBasis;
  readonly setting: "individual" | "group";
  readonly needCode: string;
}

const SCENARIOS: readonly ScenarioDefinition[] = [
  {
    id: "M23-SCENARIO-INDIVIDUAL",
    name: "Individual skills training",
    ageYears: 16,
    category: "skills_training",
    serviceBasis: "skills_training_and_development",
    setting: "individual",
    needCode: "CANS-LIFE-SKILLS",
  },
  {
    id: "M23-SCENARIO-GROUP",
    name: "Group psychosocial rehabilitation",
    ageYears: 19,
    category: "psychosocial_rehabilitation",
    serviceBasis: "psychosocial_rehabilitation",
    setting: "group",
    needCode: "ANSA-SOCIAL-FUNCTION",
  },
  {
    id: "M23-SCENARIO-SUPPORTIVE",
    name: "Supportive intervention",
    ageYears: 17,
    category: "supportive_interventions",
    serviceBasis: "skills_training_and_development",
    setting: "individual",
    needCode: "CANS-EMOTIONAL-REGULATION",
  },
  {
    id: "M23-SCENARIO-COMMUNITY",
    name: "Community integration",
    ageYears: 18,
    category: "community_integration",
    serviceBasis: "psychosocial_rehabilitation",
    setting: "individual",
    needCode: "ANSA-COMMUNITY-PARTICIPATION",
  },
] as const;

interface BuiltScenario extends M23ScenarioResult {
  readonly planVersionId: string;
  readonly goalId: string;
  readonly interventionId: string;
}

function buildScenario(engine: M23ProgramEngine, definition: ScenarioDefinition, index: number): BuiltScenario {
  const number = String(index + 1).padStart(3, "0");
  const continuumScenario = index === 0;
  const subjectId = continuumScenario ? M22_SCENARIO_IDS.youthId : `SYNTH-M23-YOUTH-${number}`;
  const caseCreatedAt = `2026-07-01T0${index}:00:00.000Z`;
  const caseRecord = engine.registerCase(M23_SYNTHETIC_SUPERVISOR, {
    subjectId,
    subjectLabel: continuumScenario ? "Synthetic Youth One" : `Synthetic Youth ${number}`,
    ageYears: definition.ageYears,
    assignedSpecialistId: M23_SYNTHETIC_SPECIALIST.id,
    assignedSupervisorId: M23_SYNTHETIC_SUPERVISOR.id,
    careBridge: {
      ccmg: {
        ownerDepartment: "CCMG",
        accessMode: "read_only",
        referralId: continuumScenario ? M22_SCENARIO_IDS.referralId : `SYNTH-CCMG-REF-${number}`,
        caseId: continuumScenario ? "M21-CASE-EXISTING-001" : `SYNTH-CCMG-CASE-${number}`,
        handoffId: continuumScenario ? M22_SCENARIO_IDS.sourceLineageId : `SYNTH-CCMG-HANDOFF-${number}`,
        status: "active",
      },
      cans: {
        ownerDepartment: "CCMG",
        accessMode: "read_only",
        assessmentId: continuumScenario ? M22_SCENARIO_IDS.sourceCansAssessmentId : `SYNTH-CANS-${number}`,
        version: 2,
        lineageId: continuumScenario ? M22_SCENARIO_IDS.sourceLineageId : `SYNTH-CANS-LINEAGE-${number}`,
        targetRecordId: continuumScenario ? M22_SCENARIO_IDS.planId : `SYNTH-CANS-TARGET-${number}`,
        mappedGoalCodes: [definition.needCode],
      },
      mhtcm: {
        ownerDepartment: "MHTCM",
        accessMode: "read_only",
        planId: continuumScenario ? M22_SCENARIO_IDS.planId : `SYNTH-MHTCM-PLAN-${number}`,
        version: continuumScenario ? 2 : 1,
        status: "approved",
        coordinationSummary: "Synthetic coordination reference; MHRS cannot mutate the MHTCM plan.",
      },
    },
  }, caseCreatedAt);
  const need = engine.recordNeed(M23_SYNTHETIC_SPECIALIST, caseRecord.id, {
    sourceDepartment: "CCMG",
    sourceType: definition.ageYears <= 17 ? "CANS" : "CCMG",
    sourceRecordId: definition.ageYears <= 17 ? caseRecord.careBridge.cans.assessmentId : caseRecord.careBridge.ccmg.referralId,
    sourceVersion: definition.ageYears <= 17 ? caseRecord.careBridge.cans.version : 1,
    code: definition.needCode,
    statement: `${definition.name} synthetic assessed need.`,
    baseline: 2,
    target: 4,
  }, `2026-07-01T0${index}:05:00.000Z`);
  const plan = engine.createPlanVersion(M23_SYNTHETIC_SPECIALIST, caseRecord.id, {
    effectiveFrom: "2026-07-01",
    effectiveThrough: "2026-09-30",
    typeAmountDurationStatement: `${definition.name}; 2 units per session; weekly for 90 days.`,
  }, `2026-07-01T0${index}:10:00.000Z`);
  const goal = engine.addGoal(M23_SYNTHETIC_SPECIALIST, plan.id, {
    needId: need.id,
    category: definition.category,
    statement: `Increase ${definition.needCode.toLowerCase()} from 2 to 4.`,
    measure: "Synthetic anchored rating",
    targetValue: 4,
  }, `2026-07-01T0${index}:15:00.000Z`);
  const intervention = engine.addIntervention(M23_SYNTHETIC_SPECIALIST, plan.id, {
    goalId: goal.id,
    category: definition.category,
    serviceBasis: definition.serviceBasis,
    description: `${definition.name} using structured practice, feedback, and generalization.`,
    amount: "2 units",
    duration: "30 minutes",
    frequency: "Weekly",
  }, `2026-07-01T0${index}:20:00.000Z`);
  engine.transitionPlan(M23_SYNTHETIC_SPECIALIST, plan.id, "under_review", "Synthetic specialist submitted complete plan.", `2026-07-01T0${index}:25:00.000Z`);
  engine.transitionPlan(M23_SYNTHETIC_SUPERVISOR, plan.id, "approved", "Synthetic supervisor verified qualification, necessity, and plan detail.", `2026-07-01T0${index}:30:00.000Z`);

  const billingInput = buildReadyM23ClinicalEvidence({
    encounterId: `SYNTH-M23-ENC-${number}`,
    clientId: subjectId,
    clientLabel: caseRecord.subjectLabel,
    providerId: M23_SYNTHETIC_SPECIALIST.id,
    ageYears: definition.ageYears,
    category: definition.category,
    serviceBasis: definition.serviceBasis,
    setting: definition.setting,
    goalReference: goal.id,
    startTime: `${10 + index}:00`,
    endTime: `${10 + index}:30`,
  });
  const session = engine.documentSession(M23_SYNTHETIC_SPECIALIST, caseRecord.id, {
    planVersionId: plan.id,
    goalId: goal.id,
    interventionId: intervention.id,
    billingInput,
    progressValue: 3,
    progressNarrative: "Synthetic progress moved one anchored point toward target.",
    barrier: "Synthetic transportation variability.",
    barrierResponse: "Practiced an alternate access plan and coordinated a backup option.",
    outcome: "Synthetic youth completed the planned rehearsal.",
    measuredValue: 3,
  }, `2026-07-10T${10 + index}:35:00.000Z`);
  engine.signSession(M23_SYNTHETIC_SPECIALIST, session.id, "Synthetic Therapist Signature", `2026-07-10T${10 + index}:40:00.000Z`);
  const handoff = engine.requestClaimHandoff(M23_SYNTHETIC_SPECIALIST, session.id, `2026-07-10T${10 + index}:45:00.000Z`);

  return {
    id: definition.id,
    name: definition.name,
    category: definition.category,
    procedureCode: billingInput.encounter.procedureCode as "H2014" | "H2017",
    setting: definition.setting,
    caseId: caseRecord.id,
    sessionId: session.id,
    claimHandoffState: handoff.state,
    billingReady: session.billingEvaluation.billingReady,
    correlationId: `M23-CORR-${caseRecord.id}`,
    planVersionId: plan.id,
    goalId: goal.id,
    interventionId: intervention.id,
  };
}

function buildControlSession(
  engine: M23ProgramEngine,
  base: BuiltScenario,
  suffix: string,
  mutate: (input: ReturnType<typeof buildReadyM23ClinicalEvidence>) => void,
  sign: boolean,
  minute: number,
) {
  const snapshot = engine.snapshot();
  const programCase = snapshot.cases.find((candidate) => candidate.id === base.caseId)!;
  const intervention = snapshot.interventions.find((candidate) => candidate.id === base.interventionId)!;
  const input = buildReadyM23ClinicalEvidence({
    encounterId: `SYNTH-M23-CONTROL-${suffix}`,
    clientId: programCase.subjectId,
    clientLabel: programCase.subjectLabel,
    providerId: M23_SYNTHETIC_SPECIALIST.id,
    ageYears: programCase.ageYears,
    category: intervention.category,
    serviceBasis: intervention.serviceBasis,
    setting: "individual",
    goalReference: base.goalId,
    startTime: "15:00",
    endTime: "15:30",
  });
  const mutable = cloneM23ClinicalEvidence(input);
  mutate(mutable);
  const documentedAt = `2026-07-11T15:${String(minute).padStart(2, "0")}:00.000Z`;
  const session = engine.documentSession(M23_SYNTHETIC_SPECIALIST, base.caseId, {
    planVersionId: base.planVersionId,
    goalId: base.goalId,
    interventionId: base.interventionId,
    billingInput: mutable,
    progressValue: 3,
    progressNarrative: "Synthetic control session.",
    barrier: "Synthetic control barrier.",
    barrierResponse: "Synthetic control response.",
    outcome: "Synthetic control outcome.",
    measuredValue: 3,
  }, documentedAt);
  if (sign) {
    engine.signSession(M23_SYNTHETIC_SPECIALIST, session.id, "Synthetic Therapist Signature", `2026-07-11T15:${String(minute + 1).padStart(2, "0")}:00.000Z`);
  }
  return engine.requestClaimHandoff(M23_SYNTHETIC_SPECIALIST, session.id, `2026-07-11T15:${String(minute + 2).padStart(2, "0")}:00.000Z`);
}

/** Run all M2.3 acceptance scenarios against a fresh deterministic repository. */
export function runM23SyntheticSuite(engine = new M23ProgramEngine()): M23SyntheticSuiteResult {
  const scenarios = SCENARIOS.map((scenario, index) => buildScenario(engine, scenario, index));
  const base = scenarios[0];
  const h2014HoControl = buildControlSession(engine, base, "H2014-HO", (input) => {
    input.encounter.modifiers = [...input.encounter.modifiers, "HO"];
  }, true, 0);
  const missingEvidenceControls = [
    buildControlSession(engine, base, "PLAN", (input) => {
      input.plan.exists = false;
      input.plan.activeFrom = null;
      input.plan.activeThrough = null;
    }, true, 5),
    buildControlSession(engine, base, "AUTH", (input) => {
      input.authorization.status = "missing";
      input.authorization.authorizationId = null;
    }, true, 10),
    buildControlSession(engine, base, "CREDENTIAL", (input) => {
      input.provider.credentialCurrent = false;
    }, true, 15),
    buildControlSession(engine, base, "NOTE", (input) => {
      input.documentation.modalityAndMethod = null;
    }, true, 20),
    buildControlSession(engine, base, "SIGNATURE", (input) => {
      input.documentation.providerSignature = null;
    }, false, 25),
  ];

  const firstOriginalPlan = engine.snapshot().planVersions.find((plan) => plan.id === base.planVersionId)!;
  const firstAlert = engine.snapshot().reviewAlerts.find((alert) => alert.planVersionId === firstOriginalPlan.id)!;
  engine.evaluateReviewAlerts(M23_SYNTHETIC_SUPERVISOR, "2026-09-30T00:00:00.000Z");
  const nextPlan = engine.completeReview(M23_SYNTHETIC_SUPERVISOR, firstAlert.id, {
    effectiveFrom: "2026-09-30",
    effectiveThrough: "2026-12-28",
    typeAmountDurationStatement: "Reviewed MHRS services; 2 units per session; weekly for the next 90 days.",
  }, "2026-09-30T09:00:00.000Z");

  const dashboard = engine.getDashboard(M23_SYNTHETIC_AUDITOR, "2026-09-30T10:00:00.000Z");
  return {
    scenarios: scenarios.map((scenario) => ({
      id: scenario.id,
      name: scenario.name,
      category: scenario.category,
      procedureCode: scenario.procedureCode,
      setting: scenario.setting,
      caseId: scenario.caseId,
      sessionId: scenario.sessionId,
      claimHandoffState: scenario.claimHandoffState,
      billingReady: scenario.billingReady,
      correlationId: scenario.correlationId,
    })),
    h2014HoControl,
    missingEvidenceControls,
    review: {
      alertId: firstAlert.id,
      priorPlanVersion: firstOriginalPlan.version,
      newPlanVersion: nextPlan.version,
      state: engine.reviewAlertState(firstAlert.id)!,
    },
    snapshot: engine.snapshot(),
    dashboard,
  };
}
