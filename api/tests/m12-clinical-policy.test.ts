import { describe, expect, it } from "vitest";
import {
  CLINICAL_BILLING_CODE_RULES,
  CLINICAL_POLICY_METADATA,
  CLINICAL_REGULATORY_SOURCES,
  MHRS_CATEGORIES,
  MHTCM_FUNCTIONS,
  evaluateClinicalBillingReadiness,
  type ClinicalBillingEvaluationInput,
  type MhrsCategory,
  type MhrsServiceBasis,
  type ProviderCredential,
} from "../../contracts/regulatory/clinical";

function readyMhtcm(): ClinicalBillingEvaluationInput {
  return {
    evaluatedOn: "2026-07-14",
    acknowledgedPolicyVersion: CLINICAL_POLICY_METADATA.version,
    encounter: {
      encounterId: "enc-synthetic-mhtcm-001",
      clientId: "client-synthetic-001",
      program: "MHTCM",
      procedureCode: "T1017",
      modifiers: ["HA", "TF"],
      serviceDate: "2026-07-10",
      startTime: "10:00",
      endTime: "10:30",
      declaredUnits: 2,
      ageYears: 16,
      deliveryMode: "in_person",
      setting: "individual",
      fundingSource: "standard",
      continuousContact: true,
      personPresentAwakeParticipating: true,
      collateralContact: false,
      personOrLarPresentForCollateral: false,
      mhtcmFunction: "care_coordination",
      mhtcmLevel: "routine",
      emergentTreatment: false,
      duplicatesAnotherServiceOrDischargeActivity: false,
    },
    eligibility: {
      medicaidEligible: true,
      texasResident: true,
      diagnosisCategory: "serious_emotional_disturbance",
      diagnosisEstablishedOn: "2026-01-10",
      diagnosisLastReviewedOn: "2026-01-10",
      diagnosticCriteriaDocumented: true,
      functionalEligibilityConfirmed: true,
      uniformAssessment: "CANS",
      uniformAssessmentOn: "2026-06-20",
      assessorCertificationExpiresOn: "2027-05-31",
      medicalNecessityConfirmedByLpha: true,
    },
    provider: {
      providerId: "provider-synthetic-qmhp-001",
      credential: "QMHP_CS",
      credentialCurrent: true,
      requiredTrainingCurrent: true,
      competencyDocumented: true,
      employeeOfBillingProvider: true,
      supervisionActive: true,
      supervisorCredential: "QMHP_CS",
      supervisingQmhpHasLphaSupervision: true,
      peerMonthlyMeetingDocumented: false,
      peerMonthlyObservationDocumented: false,
      familyPartnerCertified: false,
    },
    authorization: {
      status: "authorized",
      authorizationId: "auth-synthetic-001",
      payerModel: "fee_for_service",
      waiverDocumentationReference: null,
      validFrom: "2026-07-01",
      validThrough: "2026-09-30",
      procedureCode: "T1017",
      remainingUnits: 12,
    },
    plan: {
      exists: true,
      activeFrom: "2026-07-01",
      activeThrough: "2026-09-30",
      serviceIncluded: true,
      goalReference: "goal-synthetic-access-001",
      typeAmountDurationDocumented: false,
      telehealthApproved: false,
    },
    telehealth: {
      consentDocumented: false,
      clinicallyAppropriateAndSafe: false,
      audioOnlyReason: null,
      priorInPersonOrAudiovisualServiceOn: null,
      rollingTwelveMonthInPersonOrAudiovisualServiceOn: null,
      rollingTwelveMonthWaiverDocumented: false,
    },
    documentation: {
      personName: "Synthetic Client One",
      diagnosisAndNeed: "Synthetic SED criteria and coordinated-access need documented.",
      reasonForEncounter: "Coordinate a synthetic specialty referral.",
      contactParticipants: "Synthetic client and case manager.",
      collateralContacts: null,
      planGoal: "goal-synthetic-access-001",
      progress: "Synthetic referral options reviewed.",
      serviceAccessTimeline: "Contact synthetic provider within five days.",
      intervention: "Coordinated access and confirmed referral steps.",
      reevaluationTimeline: "Review at next weekly contact.",
      serviceType: null,
      modalityAndMethod: null,
      location: null,
      pertinentEventsOrBehavior: null,
      outcomeOrProgress: null,
      serviceDate: "2026-07-10",
      startTime: "10:00",
      endTime: "10:30",
      deliveryMode: "in_person",
      agencyName: "Synthetic Texas Provider",
      providerSignature: "Synthetic QMHP-CS Signature",
      providerCredential: "QMHP_CS",
    },
    priorEncounters: [],
  };
}

function readyMhrs(
  procedureCode: "H2014" | "H2017" = "H2014",
  category: MhrsCategory = "skills_training",
  serviceBasis: MhrsServiceBasis = "skills_training_and_development",
): ClinicalBillingEvaluationInput {
  const input = readyMhtcm();
  input.encounter = {
    ...input.encounter,
    encounterId: `enc-synthetic-${procedureCode.toLowerCase()}-001`,
    program: "MHRS",
    procedureCode,
    modifiers: [],
    ageYears: 30,
    mhtcmFunction: undefined,
    mhtcmLevel: undefined,
    mhrsCategory: category,
    mhrsServiceBasis: serviceBasis,
  };
  input.eligibility = {
    ...input.eligibility,
    diagnosisCategory: "serious_mental_illness",
    uniformAssessment: "ANSA",
  };
  input.authorization = {
    ...input.authorization,
    authorizationId: `auth-synthetic-${procedureCode.toLowerCase()}-001`,
    procedureCode,
  };
  input.plan = {
    ...input.plan,
    typeAmountDurationDocumented: true,
  };
  input.documentation = {
    ...input.documentation,
    diagnosisAndNeed: null,
    reasonForEncounter: null,
    contactParticipants: null,
    collateralContacts: null,
    progress: null,
    serviceAccessTimeline: null,
    intervention: null,
    reevaluationTimeline: null,
    serviceType: serviceBasis,
    modalityAndMethod: "Individual curriculum-based synthetic skills practice.",
    location: "Synthetic community office",
    pertinentEventsOrBehavior: "Synthetic client practiced the planned skill.",
    outcomeOrProgress: "Synthetic client demonstrated progress toward the plan goal.",
  };
  return input;
}

function setProvider(input: ClinicalBillingEvaluationInput, credential: ProviderCredential): void {
  input.provider.credential = credential;
  input.documentation.providerCredential = credential;
}

function expectNotReady(input: ClinicalBillingEvaluationInput, reasonCode: string): void {
  const result = evaluateClinicalBillingReadiness(input);
  expect(result.billingReady).toBe(false);
  expect(result.decision).toBe("NOT_READY");
  expect(result.reasonCodes).toContain(reasonCode);
}

describe("M1.2 clinical regulatory policy metadata and controlled taxonomies", () => {
  it("publishes the exact six MHTCM functions and exact four MHRS categories", () => {
    expect(MHTCM_FUNCTIONS).toEqual([
      "intake_screening",
      "eligibility",
      "care_coordination",
      "referral_management",
      "discharge_planning",
      "aftercare_follow_up",
    ]);
    expect(MHRS_CATEGORIES).toEqual([
      "psychosocial_rehabilitation",
      "skills_training",
      "supportive_interventions",
      "community_integration",
    ]);
  });

  it("registers current official source editions, effective dates, URLs, and code units", () => {
    expect(CLINICAL_REGULATORY_SOURCES).toHaveLength(2);
    expect(CLINICAL_REGULATORY_SOURCES[0]).toMatchObject({
      edition: "July 2026",
      publishedOn: "2026-06-30",
      effectiveOn: "2026-07-01",
      reviewedOn: "2026-07-14",
    });
    expect(CLINICAL_REGULATORY_SOURCES.every((source) => /^https?:\/\//.test(source.url))).toBe(true);
    expect(CLINICAL_BILLING_CODE_RULES.T1017.unitMinutes).toBe(15);
    expect(CLINICAL_BILLING_CODE_RULES.H2014.unitMinutes).toBe(15);
    expect(CLINICAL_BILLING_CODE_RULES.H2017.unitMinutes).toBe(15);
    expect(CLINICAL_POLICY_METADATA.defaultPosture).toBe("fail_closed");
  });
});

describe("M1.2 ready-path billing decisions", () => {
  it("returns a deterministic, audit-ready READY result for compliant youth routine T1017", () => {
    const input = readyMhtcm();
    const first = evaluateClinicalBillingReadiness(input);
    const second = evaluateClinicalBillingReadiness(input);

    expect(first).toEqual(second);
    expect(first).toMatchObject({
      billingReady: true,
      decision: "READY",
      encounter: {
        procedureCode: "T1017",
        normalizedModifiers: ["HA", "TF"],
        durationMinutes: 30,
        calculatedUnits: 2,
      },
      reasonCodes: [],
      findings: [],
      controlledExceptions: [],
    });
    expect(first.checks.length).toBeGreaterThan(30);
    expect(first.checks.every((check) => check.outcome !== "fail")).toBe(true);
  });

  it.each(["care_coordination", "referral_management", "discharge_planning", "aftercare_follow_up"] as const)(
    "allows controlled T1017 function %s when every reimbursement criterion is met",
    (mhtcmFunction) => {
      const input = readyMhtcm();
      input.encounter.mhtcmFunction = mhtcmFunction;
      expect(evaluateClinicalBillingReadiness(input).billingReady).toBe(true);
    },
  );

  it("allows adult individual H2014 skills training with no age/group modifier", () => {
    const result = evaluateClinicalBillingReadiness(readyMhrs());
    expect(result.billingReady).toBe(true);
    expect(result.encounter.normalizedModifiers).toEqual([]);
  });

  it("allows adult H2017 psychosocial rehabilitation", () => {
    const result = evaluateClinicalBillingReadiness(
      readyMhrs("H2017", "psychosocial_rehabilitation", "psychosocial_rehabilitation"),
    );
    expect(result.billingReady).toBe(true);
  });

  it.each([
    ["supportive_interventions", "H2014", "skills_training_and_development"],
    ["supportive_interventions", "H2017", "psychosocial_rehabilitation"],
    ["community_integration", "H2014", "skills_training_and_development"],
    ["community_integration", "H2017", "psychosocial_rehabilitation"],
  ] as const)("requires category %s to resolve through covered basis %s/%s", (category, code, basis) => {
    expect(evaluateClinicalBillingReadiness(readyMhrs(code, category, basis)).billingReady).toBe(true);
  });

  it("accepts completed 15-minute intervals while leaving a partial interval unbilled", () => {
    const input = readyMhtcm();
    input.encounter.endTime = "10:44";
    input.documentation.endTime = "10:44";
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.billingReady).toBe(true);
    expect(result.encounter).toMatchObject({ durationMinutes: 44, calculatedUnits: 2, declaredUnits: 2 });
  });

  it("accepts a documented managed-care waiver of prior-authorization submission", () => {
    const input = readyMhrs();
    input.authorization = {
      status: "mco_waived",
      authorizationId: null,
      payerModel: "managed_care",
      waiverDocumentationReference: "waiver-synthetic-mco-001",
      validFrom: null,
      validThrough: null,
      procedureCode: null,
      remainingUnits: null,
    };
    expect(evaluateClinicalBillingReadiness(input).billingReady).toBe(true);
  });

  it("supports audiovisual T1017 with modifier 95 and plan/consent evidence", () => {
    const input = readyMhtcm();
    input.encounter.deliveryMode = "synchronous_audiovisual";
    input.encounter.modifiers = ["95", "HA", "TF"];
    input.plan.telehealthApproved = true;
    input.telehealth.consentDocumented = true;
    input.telehealth.clinicallyAppropriateAndSafe = true;
    input.documentation.deliveryMode = "synchronous_audiovisual";
    expect(evaluateClinicalBillingReadiness(input).billingReady).toBe(true);
  });

  it("supports audio-only H2014 with FQ, six-month relationship, and rolling-12-month evidence", () => {
    const input = readyMhrs();
    input.encounter.deliveryMode = "synchronous_audio_only";
    input.encounter.modifiers = ["FQ"];
    input.plan.telehealthApproved = true;
    input.telehealth = {
      consentDocumented: true,
      clinicallyAppropriateAndSafe: true,
      audioOnlyReason: "Synthetic client lacked reliable video bandwidth.",
      priorInPersonOrAudiovisualServiceOn: "2026-06-01",
      rollingTwelveMonthInPersonOrAudiovisualServiceOn: "2026-06-01",
      rollingTwelveMonthWaiverDocumented: false,
    };
    input.documentation.deliveryMode = "synchronous_audio_only";
    expect(evaluateClinicalBillingReadiness(input).billingReady).toBe(true);
  });

  it("allows RN-delivered group H2017 only with HQ and TD", () => {
    const input = readyMhrs("H2017", "psychosocial_rehabilitation", "psychosocial_rehabilitation");
    setProvider(input, "RN");
    input.encounter.setting = "group";
    input.encounter.groupSize = 7;
    input.encounter.modifiers = ["TD", "HQ"];
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.billingReady).toBe(true);
    expect(result.encounter.normalizedModifiers).toEqual(["HQ", "TD"]);
  });
});

describe("M1.2 fail-closed taxonomy and coding controls", () => {
  it.each(["intake_screening", "eligibility"] as const)(
    "keeps the MHTCM function %s in the operating taxonomy but not separately T1017-billable",
    (mhtcmFunction) => {
      const input = readyMhtcm();
      input.encounter.mhtcmFunction = mhtcmFunction;
      expectNotReady(input, "MHTCM_FUNCTION_NOT_SEPARATELY_BILLABLE");
    },
  );

  it("rejects an MHRS operating category paired to the wrong covered service basis", () => {
    const input = readyMhrs("H2014", "psychosocial_rehabilitation", "skills_training_and_development");
    expectNotReady(input, "MHRS_CATEGORY_BASIS_MISMATCH");
  });

  it("rejects a procedure code that does not match the program or selected MHRS basis", () => {
    const input = readyMhrs();
    input.encounter.procedureCode = "T1017";
    expectNotReady(input, "PROGRAM_CODE_MISMATCH");
    expect(evaluateClinicalBillingReadiness(input).reasonCodes).toContain("MHRS_CODE_BASIS_MISMATCH");
  });

  it("fails H2014-HO closed and emits an explicit controlled exception", () => {
    const input = readyMhrs();
    input.encounter.modifiers = ["HO"];
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toContain("H2014_HO_PRIMARY_AUTHORITY_REQUIRED");
    expect(result.controlledExceptions).toEqual([
      expect.objectContaining({ controlId: "H2014-HO", status: "required" }),
    ]);
  });

  it("requires youth T1017 HA plus its TF/TG level modifier", () => {
    const input = readyMhtcm();
    input.encounter.modifiers = [];
    expectNotReady(input, "REQUIRED_MODIFIER_MISSING");
  });

  it("rejects conflicting, duplicate, unknown, and context-inapplicable modifiers", () => {
    const input = readyMhtcm();
    input.encounter.modifiers = ["HA", "TF", "TG", "95", "FQ", "TF", "ZZ"];
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "DUPLICATE_MODIFIER",
      "MODIFIER_CONFLICT",
      "MODIFIER_NOT_ALLOWED",
    ]));
  });

  it("rejects H2017 for a person younger than 18", () => {
    const input = readyMhrs("H2017", "psychosocial_rehabilitation", "psychosocial_rehabilitation");
    input.encounter.ageYears = 17;
    input.eligibility.diagnosisCategory = "serious_emotional_disturbance";
    input.eligibility.uniformAssessment = "CANS";
    expectNotReady(input, "AGE_RESTRICTION");
  });

  it("rejects fewer than 15 minutes and over-declared units", () => {
    const short = readyMhtcm();
    short.encounter.endTime = "10:14";
    short.documentation.endTime = "10:14";
    short.encounter.declaredUnits = 1;
    expectNotReady(short, "INSUFFICIENT_BILLABLE_TIME");

    const overDeclared = readyMhtcm();
    overDeclared.encounter.declaredUnits = 3;
    expectNotReady(overDeclared, "UNIT_DURATION_MISMATCH");
  });

  it("requires continuous contact", () => {
    const input = readyMhtcm();
    input.encounter.continuousContact = false;
    expectNotReady(input, "NON_CONTINUOUS_CONTACT");
  });
});

describe("M1.2 eligibility, credential, authorization, and documentation controls", () => {
  it.each(["idd_only", "substance_use_disorder_only"] as const)(
    "excludes a standalone %s diagnosis",
    (diagnosisCategory) => {
      const input = readyMhtcm();
      input.eligibility.diagnosisCategory = diagnosisCategory;
      expectNotReady(input, "CLIENT_NOT_ELIGIBLE");
    },
  );

  it("requires diagnosis before service, annual diagnosis review, and documented diagnostic criteria", () => {
    const input = readyMhtcm();
    input.eligibility.diagnosisEstablishedOn = "2026-07-11";
    input.eligibility.diagnosisLastReviewedOn = "2025-01-01";
    input.eligibility.diagnosticCriteriaDocumented = false;
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "DIAGNOSIS_NOT_ESTABLISHED",
      "DIAGNOSIS_NOT_CURRENT",
      "DIAGNOSTIC_CRITERIA_NOT_DOCUMENTED",
    ]));
  });

  it("requires the age-correct, current uniform assessment and current assessor certification", () => {
    const input = readyMhtcm();
    input.eligibility.uniformAssessment = "ANSA";
    input.eligibility.uniformAssessmentOn = "2026-01-01";
    input.eligibility.assessorCertificationExpiresOn = "2026-07-09";
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "UNIFORM_ASSESSMENT_TYPE_INVALID",
      "UNIFORM_ASSESSMENT_STALE",
      "ASSESSOR_CERTIFICATION_NOT_CURRENT",
    ]));
  });

  it("applies the conservative 90-day MHRS reassessment interval to ages 18 through 20", () => {
    const input = readyMhrs();
    input.encounter.ageYears = 19;
    input.encounter.modifiers = ["HA"];
    input.eligibility.diagnosisCategory = "serious_emotional_disturbance";
    input.eligibility.uniformAssessment = "ANSA";
    input.eligibility.uniformAssessmentOn = "2026-04-10";
    expectNotReady(input, "UNIFORM_ASSESSMENT_STALE");
  });

  it("requires CSSP employment and active QMHP-CS-or-higher supervision", () => {
    const input = readyMhtcm();
    setProvider(input, "CSSP");
    input.provider.employeeOfBillingProvider = false;
    input.provider.supervisionActive = false;
    input.provider.supervisorCredential = null;
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "PROVIDER_EMPLOYMENT_REQUIRED",
      "PROVIDER_SUPERVISION_MISSING",
    ]));
  });

  it("requires a QMHP-CS supervision chain that reaches an LPHA", () => {
    const input = readyMhtcm();
    input.provider.supervisingQmhpHasLphaSupervision = false;
    expectNotReady(input, "PROVIDER_SUPERVISION_MISSING");
  });

  it("requires peer LPHA supervision plus a monthly meeting and separate observation", () => {
    const input = readyMhrs();
    setProvider(input, "PEER_PROVIDER");
    input.provider.supervisorCredential = "LPHA";
    input.provider.peerMonthlyMeetingDocumented = false;
    input.provider.peerMonthlyObservationDocumented = false;
    expectNotReady(input, "PEER_SUPERVISION_DOCUMENTATION_MISSING");

    input.provider.peerMonthlyMeetingDocumented = true;
    input.provider.peerMonthlyObservationDocumented = true;
    expect(evaluateClinicalBillingReadiness(input).billingReady).toBe(true);
  });

  it("permits a certified, supervised family partner for youth H2014 and rejects missing certification", () => {
    const input = readyMhrs();
    input.encounter.ageYears = 16;
    input.encounter.modifiers = ["HA"];
    input.eligibility.diagnosisCategory = "serious_emotional_disturbance";
    input.eligibility.uniformAssessment = "CANS";
    setProvider(input, "FAMILY_PARTNER");
    input.provider.supervisorCredential = "QMHP_CS";
    input.provider.familyPartnerCertified = false;
    expectNotReady(input, "FAMILY_PARTNER_CERTIFICATION_MISSING");

    input.provider.familyPartnerCertified = true;
    expect(evaluateClinicalBillingReadiness(input).billingReady).toBe(true);
  });

  it("requires authorization, matching dates/code, and sufficient units", () => {
    const missing = readyMhrs();
    missing.authorization.status = "missing";
    expectNotReady(missing, "AUTHORIZATION_MISSING");

    const mismatch = readyMhrs();
    mismatch.authorization.validThrough = "2026-07-09";
    mismatch.authorization.procedureCode = "H2017";
    mismatch.authorization.remainingUnits = 1;
    const result = evaluateClinicalBillingReadiness(mismatch);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "AUTHORIZATION_DATE_INVALID",
      "AUTHORIZATION_CODE_MISMATCH",
      "AUTHORIZED_UNITS_EXCEEDED",
    ]));
  });

  it("does not accept an undocumented or fee-for-service waiver", () => {
    const input = readyMhrs();
    input.authorization.status = "mco_waived";
    input.authorization.payerModel = "fee_for_service";
    input.authorization.waiverDocumentationReference = null;
    expectNotReady(input, "MCO_WAIVER_DOCUMENTATION_MISSING");
  });

  it("requires person participation and person/LAR presence for an MHTCM collateral contact", () => {
    const input = readyMhtcm();
    input.encounter.personPresentAwakeParticipating = false;
    input.encounter.collateralContact = true;
    input.encounter.personOrLarPresentForCollateral = false;
    input.documentation.collateralContacts = "Synthetic school collateral contact.";
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "PERSON_PARTICIPATION_REQUIRED",
      "COLLATERAL_PARTICIPATION_REQUIRED",
    ]));
  });

  it("rejects duplicative discharge planning", () => {
    const input = readyMhtcm();
    input.encounter.mhtcmFunction = "discharge_planning";
    input.encounter.duplicatesAnotherServiceOrDischargeActivity = true;
    expectNotReady(input, "DUPLICATIVE_ACTIVITY");
  });

  it("requires an active plan, included goal, and MHRS type/amount/duration", () => {
    const input = readyMhrs();
    input.plan.exists = false;
    input.plan.serviceIncluded = false;
    input.plan.goalReference = null;
    input.plan.typeAmountDurationDocumented = false;
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "PLAN_OF_CARE_MISSING_OR_INACTIVE",
      "SERVICE_NOT_IN_PLAN",
      "MHRS_PLAN_DETAIL_MISSING",
    ]));
  });

  it("fails closed on missing or encounter-inconsistent required documentation", () => {
    const input = readyMhtcm();
    input.documentation.intervention = "   ";
    input.documentation.endTime = "10:45";
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "DOCUMENTATION_INCOMPLETE",
      "DOCUMENTATION_MISMATCH",
    ]));
  });
});

describe("M1.2 telehealth, group, duplicate, same-day, and review-currency controls", () => {
  it("requires audiovisual modifier, plan approval, consent, and safety evidence", () => {
    const input = readyMhtcm();
    input.encounter.deliveryMode = "synchronous_audiovisual";
    input.documentation.deliveryMode = "synchronous_audiovisual";
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "REQUIRED_MODIFIER_MISSING",
      "TELEHEALTH_CONSENT_OR_SAFETY_MISSING",
      "TELEHEALTH_PLAN_APPROVAL_MISSING",
    ]));
  });

  it("requires audio-only reason, nonwaivable six-month relationship, and periodic contact/waiver", () => {
    const input = readyMhrs();
    input.encounter.deliveryMode = "synchronous_audio_only";
    input.encounter.modifiers = ["FQ"];
    input.documentation.deliveryMode = "synchronous_audio_only";
    input.plan.telehealthApproved = true;
    input.telehealth.consentDocumented = true;
    input.telehealth.clinicallyAppropriateAndSafe = true;
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "AUDIO_ONLY_REASON_MISSING",
      "AUDIO_ONLY_RELATIONSHIP_REQUIRED",
      "AUDIO_ONLY_PERIODIC_CONTACT_REQUIRED",
    ]));
  });

  it("enforces six-person youth and eight-person adult group limits", () => {
    const youth = readyMhrs();
    youth.encounter.ageYears = 16;
    youth.encounter.setting = "group";
    youth.encounter.groupSize = 7;
    youth.encounter.modifiers = ["HA", "HQ"];
    youth.eligibility.diagnosisCategory = "serious_emotional_disturbance";
    youth.eligibility.uniformAssessment = "CANS";
    expectNotReady(youth, "GROUP_SIZE_EXCEEDED");

    const adult = readyMhrs();
    adult.encounter.setting = "group";
    adult.encounter.groupSize = 9;
    adult.encounter.modifiers = ["HQ"];
    expectNotReady(adult, "GROUP_SIZE_EXCEEDED");

    adult.encounter.groupSize = 8;
    expect(evaluateClinicalBillingReadiness(adult).billingReady).toBe(true);
  });

  it("detects an exact duplicate but ignores a voided duplicate", () => {
    const input = readyMhtcm();
    input.priorEncounters = [{
      encounterId: "prior-synthetic-duplicate",
      clientId: input.encounter.clientId,
      serviceDate: input.encounter.serviceDate,
      startTime: input.encounter.startTime,
      endTime: input.encounter.endTime,
      procedureCode: input.encounter.procedureCode,
      modifiers: ["TF", "HA"],
      status: "submitted",
    }];
    expectNotReady(input, "DUPLICATE_ENCOUNTER");

    input.priorEncounters = [{ ...input.priorEncounters[0], status: "voided" }];
    expect(evaluateClinicalBillingReadiness(input).billingReady).toBe(true);
  });

  it("detects overlapping time even when procedure codes differ", () => {
    const input = readyMhtcm();
    input.priorEncounters = [{
      encounterId: "prior-synthetic-overlap",
      clientId: input.encounter.clientId,
      serviceDate: input.encounter.serviceDate,
      startTime: "09:50",
      endTime: "10:10",
      procedureCode: "H2014",
      modifiers: [],
      status: "documented",
    }];
    expectNotReady(input, "OVERLAPPING_ENCOUNTER");
  });

  it("rejects routine and intensive T1017 on the same day", () => {
    const input = readyMhtcm();
    input.priorEncounters = [{
      encounterId: "prior-synthetic-intensive",
      clientId: input.encounter.clientId,
      serviceDate: input.encounter.serviceDate,
      startTime: "08:00",
      endTime: "08:30",
      procedureCode: "T1017",
      modifiers: ["HA", "TG"],
      status: "paid",
    }];
    expectNotReady(input, "SAME_DAY_ROUTINE_AND_INTENSIVE_MHTCM");
  });

  it("rejects same-day T1017 and H2017", () => {
    const input = readyMhtcm();
    input.priorEncounters = [{
      encounterId: "prior-synthetic-h2017",
      clientId: input.encounter.clientId,
      serviceDate: input.encounter.serviceDate,
      startTime: "08:00",
      endTime: "08:30",
      procedureCode: "H2017",
      modifiers: [],
      status: "submitted",
    }];
    expectNotReady(input, "SAME_DAY_MHTCM_AND_PSYCHOSOCIAL_REHABILITATION");
  });

  it("rejects same-day H2017 and H2014", () => {
    const input = readyMhrs("H2017", "psychosocial_rehabilitation", "psychosocial_rehabilitation");
    input.priorEncounters = [{
      encounterId: "prior-synthetic-h2014",
      clientId: input.encounter.clientId,
      serviceDate: input.encounter.serviceDate,
      startTime: "08:00",
      endTime: "08:30",
      procedureCode: "H2014",
      modifiers: [],
      status: "submitted",
    }];
    expectNotReady(input, "SAME_DAY_PSYCHOSOCIAL_REHABILITATION_AND_SKILLS_TRAINING");
  });

  it("fails when the monthly source review is stale or a version is not acknowledged", () => {
    const input = readyMhtcm();
    input.evaluatedOn = "2026-08-01";
    input.acknowledgedPolicyVersion = "2026.06.legacy";
    const result = evaluateClinicalBillingReadiness(input);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "POLICY_REVIEW_STALE",
      "POLICY_VERSION_MISMATCH",
    ]));
  });

  it("rejects future service and service before the controlled edition", () => {
    const future = readyMhtcm();
    future.encounter.serviceDate = "2026-07-15";
    future.documentation.serviceDate = "2026-07-15";
    expectNotReady(future, "SERVICE_DATE_AFTER_EVALUATION_DATE");

    const historical = readyMhtcm();
    historical.encounter.serviceDate = "2026-06-30";
    historical.documentation.serviceDate = "2026-06-30";
    expectNotReady(historical, "SERVICE_BEFORE_POLICY_EFFECTIVE_DATE");
  });
});
