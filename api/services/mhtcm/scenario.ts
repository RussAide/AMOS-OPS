import {
  M22DomainError,
  M22_MHTCM_FUNCTIONS,
  type M22Actor,
  type M22EncounterDocumentation,
  type M22PlanComponents,
  type M22ScenarioResult,
} from "@contracts/mhtcm";
import { assertSyntheticBoundary } from "@contracts/phase2";
import { M22MhtcmEngine } from "./engine";

export const M22_SCENARIO_IDS = {
  caseId: "SYNTH-M22-CASE-001",
  referralId: "M21-REF-EXISTING-001",
  youthId: "SYNTH-YOUTH-EXISTING-001",
  sourceCansAssessmentId: "M21-CANS-EXISTING-V2",
  sourceLineageId: "M21-LINEAGE-EXISTING-V2-MHTCM",
  planId: "SYNTH-MHTCM-PLAN-001",
  encounterId: "SYNTH-M22-ENC-001",
  authorizationId: "SYNTH-M22-AUTH-001",
} as const;

export const M22_SCENARIO_ACTORS = {
  supervisor: {
    id: "SYNTH-M22-SUPERVISOR-001",
    role: "mhtcm-supervisor",
    displayName: "Synthetic MHTCM Supervisor",
  },
  caseManager: {
    id: "SYNTH-M22-CASE-MANAGER-001",
    role: "case-manager",
    displayName: "Synthetic Case Manager",
  },
  qa: {
    id: "SYNTH-M22-QA-001",
    role: "chart-auditor",
    displayName: "Synthetic Quality Reviewer",
  },
  revenue: {
    id: "SYNTH-M22-REVENUE-001",
    role: "revenue-cycle-manager",
    displayName: "Synthetic Revenue Reviewer",
  },
} as const satisfies Readonly<Record<string, M22Actor>>;

export const M22_SCENARIO_PLAN_COMPONENTS: M22PlanComponents = {
  goals: [
    {
      id: "SYNTH-M22-GOAL-001",
      sourceCansItemCode: "CANS-LIFE-DOMAIN-03",
      function: "care_coordination",
      statement:
        "Coordinate timely access to the synthetic youth's specialty behavioral-health supports.",
      measurableOutcome:
        "Synthetic provider connection occurs within ten business days.",
      status: "active",
    },
  ],
  providers: [
    {
      id: M22_SCENARIO_ACTORS.caseManager.id,
      displayName: "Synthetic Case Manager",
      organization: "Adolbi Care Synthetic Demonstration",
      credential: "QMHP_CS",
      credentialCurrent: true,
      requiredTrainingCurrent: true,
      competencyDocumented: true,
      employeeOfBillingProvider: true,
      supervisionActive: true,
      supervisorCredential: "QMHP_CS",
      supervisingQmhpHasLphaSupervision: true,
    },
  ],
  referrals: [
    {
      id: "SYNTH-M22-REFERRAL-001",
      providerId: "SYNTH-COMMUNITY-PROVIDER-001",
      service: "Youth specialty behavioral-health consultation",
      status: "connected",
      dueOn: "2026-06-15",
    },
  ],
  contacts: [
    {
      id: "SYNTH-M22-CONTACT-001",
      contactType: "guardian",
      displayLabel: "Synthetic Guardian",
      purpose: "Review care-coordination progress and access barriers.",
      nextContactOn: "2026-07-17",
    },
  ],
  barriers: [
    {
      id: "SYNTH-M22-BARRIER-001",
      description:
        "Synthetic transportation barrier to specialty appointments.",
      severity: "moderate",
      mitigation:
        "Coordinate a synthetic transportation benefit and appointment reminder.",
      status: "monitoring",
    },
  ],
  outcomes: [
    {
      id: "SYNTH-M22-OUTCOME-001",
      measure: "Specialty-service connection",
      baseline: "Not connected",
      target: "Connected within ten business days",
      current: "Connected",
      measuredOn: "2026-06-12",
    },
  ],
};

export const M22_SCENARIO_DOCUMENTATION: M22EncounterDocumentation = {
  personName: "Synthetic Youth One",
  diagnosisAndNeed:
    "Synthetic SED criteria and coordinated-access need documented.",
  reasonForEncounter:
    "Coordinate the plan-linked synthetic specialty referral.",
  contactParticipants: "Synthetic youth and case manager.",
  collateralContacts: null,
  planGoal: "SYNTH-M22-GOAL-001",
  progress: "Synthetic referral connection and transportation plan confirmed.",
  serviceAccessTimeline:
    "Confirm first synthetic provider contact within five days.",
  intervention:
    "Coordinated access, removed a synthetic barrier, and confirmed next steps.",
  reevaluationTimeline: "Review progress at the next weekly contact.",
  agencyName: "Adolbi Care Synthetic Demonstration",
};

function assertScenarioBoundary(): void {
  const m22OwnedOrSyntheticM21Ids = [
    M22_SCENARIO_IDS.caseId,
    M22_SCENARIO_IDS.youthId,
    M22_SCENARIO_IDS.planId,
    M22_SCENARIO_IDS.encounterId,
    M22_SCENARIO_IDS.authorizationId,
  ];
  for (const id of m22OwnedOrSyntheticM21Ids) {
    assertSyntheticBoundary({ id, evidenceClass: "synthetic_demo" });
  }
  const acceptedM21References = [
    M22_SCENARIO_IDS.referralId,
    M22_SCENARIO_IDS.sourceCansAssessmentId,
    M22_SCENARIO_IDS.sourceLineageId,
  ];
  const exactAcceptedReferences = [
    "M21-REF-EXISTING-001",
    "M21-CANS-EXISTING-V2",
    "M21-LINEAGE-EXISTING-V2-MHTCM",
  ];
  if (acceptedM21References.join("|") !== exactAcceptedReferences.join("|")) {
    throw new Error("M22_ACCEPTED_M21_REFERENCE_DRIFT");
  }
}

export function seedM22CaseThroughApprovedPlan(
  engine = new M22MhtcmEngine(),
): M22MhtcmEngine {
  assertScenarioBoundary();
  const { supervisor, caseManager } = M22_SCENARIO_ACTORS;
  engine.openCase(supervisor, {
    id: M22_SCENARIO_IDS.caseId,
    referralId: M22_SCENARIO_IDS.referralId,
    youthId: M22_SCENARIO_IDS.youthId,
    youthDisplayLabel: "Synthetic Youth One",
    ageYears: 16,
    assignedCaseManagerId: caseManager.id,
    sourceCansAssessmentId: M22_SCENARIO_IDS.sourceCansAssessmentId,
    sourceCansVersion: 2,
    sourceLineageId: M22_SCENARIO_IDS.sourceLineageId,
    targetPlanId: M22_SCENARIO_IDS.planId,
    targetPlanVersion: 2,
    eligibility: {
      medicaidEligible: true,
      texasResident: true,
      diagnosisCategory: "serious_emotional_disturbance",
      diagnosisEstablishedOn: "2026-01-10",
      diagnosisLastReviewedOn: "2026-01-10",
      diagnosticCriteriaDocumented: true,
      functionalEligibilityConfirmed: true,
      uniformAssessment: "CANS",
      uniformAssessmentOn: "2026-06-02",
      assessorCertificationExpiresOn: "2027-05-31",
      medicalNecessityConfirmedByLpha: true,
    },
    openedAt: "2026-06-01T09:00:00.000Z",
  });
  engine.createPlanVersion(caseManager, {
    caseId: M22_SCENARIO_IDS.caseId,
    planId: M22_SCENARIO_IDS.planId,
    expectedCurrentVersion: null,
    activeFrom: "2026-06-03",
    activeThrough: "2026-12-31",
    serviceIncluded: true,
    typeAmountDurationDocumented: true,
    telehealthApproved: false,
    components: M22_SCENARIO_PLAN_COMPONENTS,
    preparedAt: "2026-06-02T15:00:00.000Z",
    reason:
      "Create the immutable synthetic MHTCM plan from the exact M2.1 handoff.",
  });
  engine.approveCurrentPlan(
    supervisor,
    M22_SCENARIO_IDS.caseId,
    1,
    "2026-06-03T09:00:00.000Z",
    "Independent supervisory review confirms plan completeness and source lineage.",
  );
  return engine;
}

export function seedM22CaseThroughEncounter(
  engine = seedM22CaseThroughApprovedPlan(),
): M22MhtcmEngine {
  const { supervisor, caseManager, revenue } = M22_SCENARIO_ACTORS;
  engine.recordAuthorization(revenue, {
    id: M22_SCENARIO_IDS.authorizationId,
    caseId: M22_SCENARIO_IDS.caseId,
    payerLabel: "Synthetic Texas Payer",
    status: "authorized",
    payerModel: "fee_for_service",
    waiverDocumentationReference: null,
    authorizationReference: "SYNTH-T1017-AUTH-001",
    effectiveFrom: "2026-01-15",
    validThrough: "2026-12-31",
    approvedUnits: 120,
    createdAt: "2026-06-03T10:00:00.000Z",
    reason: "Record deterministic synthetic T1017 authorization evidence.",
  });
  const completions = [
    [
      "intake_screening",
      "2026-06-01T11:00:00.000Z",
      "Synthetic intake and screening completed.",
    ],
    [
      "eligibility",
      "2026-06-02T11:00:00.000Z",
      "Synthetic MHTCM eligibility confirmed.",
    ],
    [
      "care_coordination",
      "2026-06-05T11:00:00.000Z",
      "Synthetic coordinated-care activities completed.",
    ],
    [
      "referral_management",
      "2026-06-07T11:00:00.000Z",
      "Synthetic referral connected and tracked.",
    ],
  ] as const;
  for (const [lifecycleFunction, completedAt, note] of completions) {
    engine.completeLifecycleFunction(
      caseManager,
      M22_SCENARIO_IDS.caseId,
      lifecycleFunction,
      completedAt,
      note,
    );
  }
  engine.planDischarge(caseManager, {
    caseId: M22_SCENARIO_IDS.caseId,
    applies: true,
    projectedDischargeOn: "2026-07-15",
    completedOn: "2026-06-30",
    disposition: "Synthetic community follow-up",
    aftercareNeeds: [
      "Confirm synthetic provider continuity",
      "Review the transportation mitigation",
    ],
    reason: "Complete applicable discharge planning 15 days before discharge.",
  });
  engine.completeLifecycleFunction(
    caseManager,
    M22_SCENARIO_IDS.caseId,
    "discharge_planning",
    "2026-06-30T13:00:00.000Z",
    "Synthetic discharge planning completed at least 14 days in advance.",
  );
  engine.createEncounter(caseManager, {
    id: M22_SCENARIO_IDS.encounterId,
    caseId: M22_SCENARIO_IDS.caseId,
    providerId: caseManager.id,
    function: "care_coordination",
    level: "routine",
    modifiers: ["HA", "TF"],
    serviceDate: "2026-07-10",
    startTime: "10:00",
    endTime: "10:30",
    declaredUnits: 2,
    deliveryMode: "in_person",
    setting: "individual",
    continuousContact: true,
    personPresentAwakeParticipating: true,
    collateralContact: false,
    personOrLarPresentForCollateral: false,
    emergentTreatment: false,
    duplicatesAnotherServiceOrDischargeActivity: false,
    documentation: M22_SCENARIO_DOCUMENTATION,
    authoredAt: "2026-07-10T10:40:00.000Z",
    reason: "Create deterministic synthetic T1017 documentation.",
  });
  engine.signEncounter(
    caseManager,
    M22_SCENARIO_IDS.encounterId,
    1,
    "2026-07-10T10:45:00.000Z",
    "Rendering provider signed the original note.",
  );
  engine.reviseEncounter(caseManager, {
    encounterId: M22_SCENARIO_IDS.encounterId,
    expectedRevision: 2,
    kind: "amendment",
    documentationPatch: {
      progress:
        "Synthetic referral connection, transportation plan, and guardian update confirmed.",
    },
    authoredAt: "2026-07-11T09:00:00.000Z",
    reason:
      "Append a transparent progress clarification without overwriting the signed note.",
  });
  engine.signEncounter(
    caseManager,
    M22_SCENARIO_IDS.encounterId,
    3,
    "2026-07-11T09:05:00.000Z",
    "Rendering provider signed the amendment.",
  );
  engine.generateAuthorizationAlerts(supervisor, "2026-07-01");
  return engine;
}

export function runM22RepresentativeScenario(): M22ScenarioResult {
  const engine = seedM22CaseThroughEncounter();
  const { supervisor, caseManager, qa, revenue } = M22_SCENARIO_ACTORS;
  const caseId = M22_SCENARIO_IDS.caseId;
  engine.recordDischarge(
    caseManager,
    caseId,
    "2026-07-15",
    "Synthetic transition to community supports",
    "2026-07-15T16:00:00.000Z",
  );
  engine.scheduleAftercare(
    caseManager,
    caseId,
    "2026-07-25",
    "2026-07-16T09:00:00.000Z",
  );
  engine.completeAftercare(
    caseManager,
    caseId,
    "2026-07-25T11:00:00.000Z",
    "phone",
    "Synthetic youth remained connected to the planned provider; no new barrier identified.",
  );
  engine.completeLifecycleFunction(
    caseManager,
    caseId,
    "aftercare_follow_up",
    "2026-07-25T11:05:00.000Z",
    "Synthetic aftercare follow-up completed within the 30-day window.",
  );
  engine.evaluateEncounter(
    qa,
    M22_SCENARIO_IDS.encounterId,
    "2026-07-31T12:00:00.000Z",
  );
  const claimHandoff = engine.createClaimHandoff(
    caseManager,
    M22_SCENARIO_IDS.encounterId,
    "2026-07-31T12:05:00.000Z",
  );

  engine.getCase(caseManager, caseId, "2026-07-31T13:00:00.000Z");
  engine.getCase(qa, caseId, "2026-07-31T13:05:00.000Z");
  let revenueFullCaseAccess: "denied" | null = null;
  try {
    engine.getCase(revenue, caseId, "2026-07-31T13:10:00.000Z");
  } catch (error) {
    if (error instanceof M22DomainError && error.code === "PERMISSION_DENIED") {
      revenueFullCaseAccess = "denied";
    } else {
      throw error;
    }
  }
  engine.getBillingProjection(revenue, caseId, "2026-07-31T13:15:00.000Z");
  const snapshot = engine.getSnapshot(
    supervisor,
    caseId,
    "2026-07-31T13:20:00.000Z",
  );
  const billingDecision = snapshot.billingDecisions.find(
    (item) => item.id === claimHandoff.billingDecisionId,
  );
  if (
    !billingDecision ||
    !billingDecision.result.billingReady ||
    revenueFullCaseAccess !== "denied"
  ) {
    throw new Error("M22_REPRESENTATIVE_SCENARIO_FAILED");
  }
  if (
    snapshot.case.lifecycle.map((item) => item.function).join("|") !==
    M22_MHTCM_FUNCTIONS.join("|")
  ) {
    throw new Error("M22_LIFECYCLE_TAXONOMY_DRIFT");
  }

  return {
    scenarioId: "SCN-M22-001",
    dataMode: "synthetic_demo",
    criteria: {
      "M2.2-01": true,
      "M2.2-02": true,
      "M2.2-03": true,
      "M2.2-04": true,
      "M2.2-05": true,
      "M2.2-06": true,
      "M2.2-07": true,
      "M2.2-08": true,
    },
    acceptanceGate: true,
    permissionEvidence: {
      caseManagerOwnCase: "allowed",
      qaFullCaseReview: "allowed",
      revenueFullCaseAccess,
      revenueBillingProjection: "allowed",
    },
    snapshot,
    billingDecision,
    claimHandoff,
  };
}

export function createM22SeededEngine(): M22MhtcmEngine {
  return seedM22CaseThroughEncounter();
}
