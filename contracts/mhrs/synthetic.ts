import {
  CLINICAL_POLICY_METADATA,
  type ClinicalBillingEvaluationInput,
  type MhrsCategory,
  type MhrsServiceBasis,
} from "../regulatory/clinical";

export interface M23SyntheticClinicalEvidenceOptions {
  readonly encounterId: string;
  readonly clientId: string;
  readonly clientLabel: string;
  readonly providerId: string;
  readonly ageYears: number;
  readonly category: MhrsCategory;
  readonly serviceBasis: MhrsServiceBasis;
  readonly setting: "individual" | "group";
  readonly goalReference: string;
  readonly serviceDate?: string;
  readonly startTime?: string;
  readonly endTime?: string;
}

/**
 * Complete, deterministic synthetic MHRS billing evidence.
 * It intentionally acknowledges the controlled M1.2 evaluator policy rather
 * than duplicating clinical rules in the M2.3 workflow.
 */
export function buildReadyM23ClinicalEvidence(
  options: M23SyntheticClinicalEvidenceOptions,
): ClinicalBillingEvaluationInput {
  const procedureCode = options.serviceBasis === "psychosocial_rehabilitation" ? "H2017" : "H2014";
  const serviceDate = options.serviceDate ?? "2026-07-10";
  const startTime = options.startTime ?? "10:00";
  const endTime = options.endTime ?? "10:30";
  const modifiers: string[] = [];
  if (procedureCode === "H2014" && options.ageYears <= 20) modifiers.push("HA");
  if (options.setting === "group") modifiers.push("HQ");

  return {
    evaluatedOn: "2026-07-14",
    acknowledgedPolicyVersion: CLINICAL_POLICY_METADATA.version,
    encounter: {
      encounterId: options.encounterId,
      clientId: options.clientId,
      program: "MHRS",
      procedureCode,
      modifiers,
      serviceDate,
      startTime,
      endTime,
      declaredUnits: 2,
      ageYears: options.ageYears,
      deliveryMode: "in_person",
      setting: options.setting,
      groupSize: options.setting === "group" ? 4 : undefined,
      fundingSource: "standard",
      continuousContact: true,
      personPresentAwakeParticipating: true,
      collateralContact: false,
      personOrLarPresentForCollateral: false,
      mhrsCategory: options.category,
      mhrsServiceBasis: options.serviceBasis,
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
      uniformAssessment: options.ageYears <= 17 ? "CANS" : "ANSA",
      uniformAssessmentOn: "2026-06-20",
      assessorCertificationExpiresOn: "2027-05-31",
      medicalNecessityConfirmedByLpha: true,
    },
    provider: {
      providerId: options.providerId,
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
      authorizationId: `AUTH-${options.encounterId}`,
      payerModel: "fee_for_service",
      waiverDocumentationReference: null,
      validFrom: "2026-07-01",
      validThrough: "2026-09-30",
      procedureCode,
      remainingUnits: 24,
    },
    plan: {
      exists: true,
      activeFrom: "2026-07-01",
      activeThrough: "2026-09-30",
      serviceIncluded: true,
      goalReference: options.goalReference,
      typeAmountDurationDocumented: true,
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
      personName: options.clientLabel,
      diagnosisAndNeed: null,
      reasonForEncounter: null,
      contactParticipants: null,
      collateralContacts: null,
      planGoal: options.goalReference,
      progress: null,
      serviceAccessTimeline: null,
      intervention: null,
      reevaluationTimeline: null,
      serviceType: options.serviceBasis,
      modalityAndMethod: "Structured synthetic practice using the approved MHRS intervention.",
      location: "Synthetic community setting",
      pertinentEventsOrBehavior: "Synthetic youth practiced the planned skill with guided assistance.",
      outcomeOrProgress: "Synthetic youth demonstrated measurable progress toward the plan goal.",
      serviceDate,
      startTime,
      endTime,
      deliveryMode: "in_person",
      agencyName: "Adolbi Care Synthetic Prototype",
      providerSignature: "Synthetic Therapist Signature",
      providerCredential: "QMHP_CS",
    },
    priorEncounters: [],
  };
}

export function cloneM23ClinicalEvidence(
  input: ClinicalBillingEvaluationInput,
): ClinicalBillingEvaluationInput {
  return structuredClone(input);
}
