/**
 * M1.2 clinical regulatory policy (M1.2-02 through M1.2-04).
 *
 * This module is deliberately pure: callers supply the evaluation date and all
 * evidence. It performs no I/O, reads no clock, and never assumes that missing
 * evidence is compliant.
 *
 * Controlling primary sources reviewed 2026-07-14:
 * - TMHP, Texas Medicaid Provider Procedures Manual (TMPPM), Behavioral Health
 *   and Case Management Services Handbook, July 2026. The TMPPM page states it
 *   was updated 2026-06-30 and contains policy changes through 2026-07-01.
 *   https://www.tmhp.com/resources/provider-manuals/tmppm
 *   https://www.tmhp.com/sites/default/files/file-library/resources/provider-manuals/tmppm/pdf-chapters/2026/2026-07-july/2_02_behavioral_health.pdf
 * - TMHP, Texas Medicaid Fee Schedule, Case Management and Rehabilitative
 *   Services - Mental Health, schedule PRCR423C, published 2026-04-16.
 *   http://public.tmhp.com/FeeSchedules/StaticFeeSchedule/FeeSchedules.aspx
 *
 * The six MHTCM functions and four AMOS MHRS operating categories are the
 * milestone-controlled taxonomy. Reimbursement decisions below are constrained
 * by the cited Texas Medicaid sources and may therefore be narrower than the
 * operating taxonomy.
 */

export const CLINICAL_REGULATORY_SOURCES = [
  {
    id: "TMHP-TMPPM-BHCM-2026-07",
    issuer: "Texas Medicaid & Healthcare Partnership (TMHP)",
    title: "Behavioral Health and Case Management Services Handbook",
    edition: "July 2026",
    publishedOn: "2026-06-30",
    effectiveOn: "2026-07-01",
    reviewedOn: "2026-07-14",
    url: "https://www.tmhp.com/sites/default/files/file-library/resources/provider-manuals/tmppm/pdf-chapters/2026/2026-07-july/2_02_behavioral_health.pdf",
    sections: [
      "5.1.4 Provider Credentials",
      "5.2.2 Mental Health Targeted Case Management",
      "5.2.3 Mental Health Rehabilitative Services",
      "5.3 Documentation Requirements",
      "5.4 Claims Filing and Reimbursement",
    ],
  },
  {
    id: "TMHP-FEE-PRCR423C-2026-04-16",
    issuer: "Texas Medicaid & Healthcare Partnership (TMHP)",
    title: "Texas Medicaid Fee Schedule - Case Management and Rehabilitative Services - Mental Health",
    edition: "PRCR423C",
    publishedOn: "2026-04-16",
    effectiveOn: "2026-04-16",
    reviewedOn: "2026-07-14",
    url: "http://public.tmhp.com/FeeSchedules/StaticFeeSchedule/FeeSchedules.aspx",
    sections: ["H2014", "H2017", "T1017"],
  },
] as const;

export const CLINICAL_POLICY_METADATA = {
  policyId: "AMOS-M1.2-CLINICAL-TX-MEDICAID",
  version: "2026.07.14",
  jurisdiction: "Texas",
  effectiveFrom: "2026-07-01",
  reviewedOn: "2026-07-14",
  reviewRequiredBy: "2026-08-01",
  sourceIds: CLINICAL_REGULATORY_SOURCES.map((source) => source.id),
  defaultPosture: "fail_closed",
  h2014HoStatus: "primary_authority_required",
  h2014HoControlNote:
    "HO is not listed for H2014 in the July 2026 TMPPM or the 2026-04-16 PRCR423C fee schedule. A claim containing HO remains not ready until a current, applicable payer-primary rule is registered in a superseding policy version.",
} as const;

export const MHTCM_FUNCTIONS = [
  "intake_screening",
  "eligibility",
  "care_coordination",
  "referral_management",
  "discharge_planning",
  "aftercare_follow_up",
] as const;

export type MhtcmFunction = (typeof MHTCM_FUNCTIONS)[number];

export const MHTCM_FUNCTION_RULES: Readonly<
  Record<
    MhtcmFunction,
    {
      label: string;
      t1017Disposition: "billable_when_criteria_met" | "included_or_excluded_not_separately_billable";
      authority: string;
    }
  >
> = {
  intake_screening: {
    label: "Intake screening",
    t1017Disposition: "included_or_excluded_not_separately_billable",
    authority:
      "TMPPM 5.2.2.7 excludes preadmission or intake activities from covered MHTCM.",
  },
  eligibility: {
    label: "Eligibility",
    t1017Disposition: "included_or_excluded_not_separately_billable",
    authority:
      "TMPPM 5.2.2 includes ongoing uniform assessment in the MHTCM rate and 5.2.2.7 excludes authorizing services.",
  },
  care_coordination: {
    label: "Care coordination",
    t1017Disposition: "billable_when_criteria_met",
    authority: "TMPPM 5.2.2 covers gaining and coordinating access to needed services and supports.",
  },
  referral_management: {
    label: "Referral management",
    t1017Disposition: "billable_when_criteria_met",
    authority: "TMPPM 5.2.2 covers referrals, linkage, scheduling, and related access activities.",
  },
  discharge_planning: {
    label: "Discharge planning",
    t1017Disposition: "billable_when_criteria_met",
    authority:
      "TMPPM 5.2.2 permits transition case management but prohibits duplication of nursing-facility services and discharge-planning activities.",
  },
  aftercare_follow_up: {
    label: "Aftercare follow-up",
    t1017Disposition: "billable_when_criteria_met",
    authority: "TMPPM 5.2.2 covers monitoring and necessary follow-up on the plan of care.",
  },
};

export const MHRS_CATEGORIES = [
  "psychosocial_rehabilitation",
  "skills_training",
  "supportive_interventions",
  "community_integration",
] as const;

export type MhrsCategory = (typeof MHRS_CATEGORIES)[number];
export type MhrsServiceBasis = "psychosocial_rehabilitation" | "skills_training_and_development";

export const MHRS_CATEGORY_RULES: Readonly<
  Record<
    MhrsCategory,
    {
      label: string;
      allowedServiceBases: readonly MhrsServiceBasis[];
      authority: string;
    }
  >
> = {
  psychosocial_rehabilitation: {
    label: "Psychosocial rehabilitation",
    allowedServiceBases: ["psychosocial_rehabilitation"],
    authority: "TMPPM 5.2.3.6; H2017; persons 18 years of age and older.",
  },
  skills_training: {
    label: "Skills training",
    allowedServiceBases: ["skills_training_and_development"],
    authority: "TMPPM 5.2.3.7; H2014.",
  },
  supportive_interventions: {
    label: "Supportive interventions",
    allowedServiceBases: ["psychosocial_rehabilitation", "skills_training_and_development"],
    authority:
      "TMPPM 5.2.3.6.1 and 5.2.3.7 describe supportive interventions within a covered service; this is not a standalone Texas Medicaid code category.",
  },
  community_integration: {
    label: "Community integration",
    allowedServiceBases: ["psychosocial_rehabilitation", "skills_training_and_development"],
    authority:
      "TMPPM 5.2.3 describes community integration as a rehabilitative outcome; the selected covered service basis controls coding.",
  },
};

export const CLINICAL_BILLING_CODE_RULES = {
  T1017: {
    program: "MHTCM",
    unitMinutes: 15,
    unitRule: "15 continuous minutes of contact",
    authority: "TMPPM 5.2.2",
    listedModifiers: ["95", "FQ", "HA", "HZ", "TF", "TG"],
  },
  H2014: {
    program: "MHRS",
    unitMinutes: 15,
    unitRule: "one HCPCS service unit per completed 15-minute interval",
    authority: "TMPPM 5.2.3 and fee schedule PRCR423C",
    listedModifiers: ["95", "FQ", "HA", "HQ", "HZ"],
  },
  H2017: {
    program: "MHRS",
    unitMinutes: 15,
    unitRule: "one HCPCS service unit per completed 15-minute interval",
    authority: "TMPPM 5.2.3 and fee schedule PRCR423C",
    listedModifiers: ["95", "FQ", "ET", "HQ", "HZ", "TD"],
  },
} as const;

export type ClinicalProgram = "MHTCM" | "MHRS";
export type DeliveryMode = "in_person" | "synchronous_audiovisual" | "synchronous_audio_only";
export type ServiceSetting = "individual" | "group";
export type MhtcmLevel = "routine" | "intensive";
export type FundingSource = "standard" | "criminal_justice_agency";
export type ProviderCredential = "LPHA" | "QMHP_CS" | "CSSP" | "PEER_PROVIDER" | "FAMILY_PARTNER" | "RN";
export type DiagnosisCategory =
  | "mental_illness"
  | "serious_emotional_disturbance"
  | "serious_mental_illness"
  | "idd_only"
  | "substance_use_disorder_only";
export type UniformAssessment = "CANS" | "ANSA";

export interface ClinicalEncounterEvidence {
  encounterId: string;
  clientId: string;
  program: ClinicalProgram;
  procedureCode: string;
  modifiers: readonly string[];
  serviceDate: string;
  startTime: string;
  endTime: string;
  declaredUnits: number;
  ageYears: number;
  deliveryMode: DeliveryMode;
  setting: ServiceSetting;
  groupSize?: number;
  fundingSource: FundingSource;
  continuousContact: boolean;
  personPresentAwakeParticipating: boolean;
  collateralContact: boolean;
  personOrLarPresentForCollateral: boolean;
  mhtcmFunction?: MhtcmFunction;
  mhtcmLevel?: MhtcmLevel;
  mhrsCategory?: MhrsCategory;
  mhrsServiceBasis?: MhrsServiceBasis;
  emergentTreatment: boolean;
  duplicatesAnotherServiceOrDischargeActivity: boolean;
}

export interface ClinicalEligibilityEvidence {
  medicaidEligible: boolean;
  texasResident: boolean;
  diagnosisCategory: DiagnosisCategory;
  diagnosisEstablishedOn: string | null;
  diagnosisLastReviewedOn: string | null;
  diagnosticCriteriaDocumented: boolean;
  functionalEligibilityConfirmed: boolean;
  uniformAssessment: UniformAssessment | null;
  uniformAssessmentOn: string | null;
  assessorCertificationExpiresOn: string | null;
  medicalNecessityConfirmedByLpha: boolean;
}

export interface ClinicalProviderEvidence {
  providerId: string;
  credential: ProviderCredential;
  credentialCurrent: boolean;
  requiredTrainingCurrent: boolean;
  competencyDocumented: boolean;
  employeeOfBillingProvider: boolean;
  supervisionActive: boolean;
  supervisorCredential: "LPHA" | "QMHP_CS" | null;
  supervisingQmhpHasLphaSupervision: boolean;
  peerMonthlyMeetingDocumented: boolean;
  peerMonthlyObservationDocumented: boolean;
  familyPartnerCertified: boolean;
}

export interface ClinicalAuthorizationEvidence {
  status: "authorized" | "mco_waived" | "missing" | "pending" | "denied";
  authorizationId: string | null;
  payerModel: "managed_care" | "fee_for_service";
  waiverDocumentationReference: string | null;
  validFrom: string | null;
  validThrough: string | null;
  procedureCode: string | null;
  remainingUnits: number | null;
}

export interface ClinicalPlanEvidence {
  exists: boolean;
  activeFrom: string | null;
  activeThrough: string | null;
  serviceIncluded: boolean;
  goalReference: string | null;
  typeAmountDurationDocumented: boolean;
  telehealthApproved: boolean;
}

export interface ClinicalTelehealthEvidence {
  consentDocumented: boolean;
  clinicallyAppropriateAndSafe: boolean;
  audioOnlyReason: string | null;
  priorInPersonOrAudiovisualServiceOn: string | null;
  rollingTwelveMonthInPersonOrAudiovisualServiceOn: string | null;
  rollingTwelveMonthWaiverDocumented: boolean;
}

export interface ClinicalDocumentationEvidence {
  personName: string | null;
  diagnosisAndNeed: string | null;
  reasonForEncounter: string | null;
  contactParticipants: string | null;
  collateralContacts: string | null;
  planGoal: string | null;
  progress: string | null;
  serviceAccessTimeline: string | null;
  intervention: string | null;
  reevaluationTimeline: string | null;
  serviceType: string | null;
  modalityAndMethod: string | null;
  location: string | null;
  pertinentEventsOrBehavior: string | null;
  outcomeOrProgress: string | null;
  serviceDate: string | null;
  startTime: string | null;
  endTime: string | null;
  deliveryMode: string | null;
  agencyName: string | null;
  providerSignature: string | null;
  providerCredential: string | null;
}

export interface PriorClinicalEncounter {
  encounterId: string;
  clientId: string;
  serviceDate: string;
  startTime: string;
  endTime: string;
  procedureCode: string;
  modifiers: readonly string[];
  status: "documented" | "submitted" | "paid" | "voided";
}

export interface ClinicalBillingEvaluationInput {
  evaluatedOn: string;
  acknowledgedPolicyVersion: string;
  encounter: ClinicalEncounterEvidence;
  eligibility: ClinicalEligibilityEvidence;
  provider: ClinicalProviderEvidence;
  authorization: ClinicalAuthorizationEvidence;
  plan: ClinicalPlanEvidence;
  telehealth: ClinicalTelehealthEvidence;
  documentation: ClinicalDocumentationEvidence;
  priorEncounters: readonly PriorClinicalEncounter[];
}

export const CLINICAL_BILLING_REASON_CODES = [
  "INVALID_EVALUATION_DATE",
  "INVALID_SERVICE_DATE",
  "SERVICE_BEFORE_POLICY_EFFECTIVE_DATE",
  "SERVICE_DATE_AFTER_EVALUATION_DATE",
  "POLICY_VERSION_MISMATCH",
  "POLICY_REVIEW_STALE",
  "INVALID_SERVICE_TIME",
  "INVALID_DECLARED_UNITS",
  "INSUFFICIENT_BILLABLE_TIME",
  "UNIT_DURATION_MISMATCH",
  "NON_CONTINUOUS_CONTACT",
  "PROGRAM_CODE_MISMATCH",
  "MHTCM_FUNCTION_REQUIRED",
  "MHTCM_FUNCTION_NOT_SEPARATELY_BILLABLE",
  "MHTCM_LEVEL_REQUIRED",
  "MHRS_CATEGORY_REQUIRED",
  "MHRS_SERVICE_BASIS_REQUIRED",
  "MHRS_CATEGORY_BASIS_MISMATCH",
  "MHRS_CODE_BASIS_MISMATCH",
  "AGE_RESTRICTION",
  "DUPLICATE_MODIFIER",
  "MODIFIER_NOT_ALLOWED",
  "MODIFIER_CONFLICT",
  "REQUIRED_MODIFIER_MISSING",
  "H2014_HO_PRIMARY_AUTHORITY_REQUIRED",
  "CLIENT_NOT_ELIGIBLE",
  "DIAGNOSIS_NOT_ESTABLISHED",
  "DIAGNOSIS_NOT_CURRENT",
  "DIAGNOSTIC_CRITERIA_NOT_DOCUMENTED",
  "FUNCTIONAL_ELIGIBILITY_NOT_CONFIRMED",
  "UNIFORM_ASSESSMENT_MISSING",
  "UNIFORM_ASSESSMENT_TYPE_INVALID",
  "UNIFORM_ASSESSMENT_STALE",
  "ASSESSOR_CERTIFICATION_NOT_CURRENT",
  "MEDICAL_NECESSITY_NOT_CONFIRMED",
  "PROVIDER_CREDENTIAL_NOT_ALLOWED",
  "PROVIDER_CREDENTIAL_NOT_CURRENT",
  "PROVIDER_TRAINING_OR_COMPETENCY_MISSING",
  "PROVIDER_EMPLOYMENT_REQUIRED",
  "PROVIDER_SUPERVISION_MISSING",
  "PEER_SUPERVISION_DOCUMENTATION_MISSING",
  "FAMILY_PARTNER_CERTIFICATION_MISSING",
  "PERSON_PARTICIPATION_REQUIRED",
  "COLLATERAL_PARTICIPATION_REQUIRED",
  "DUPLICATIVE_ACTIVITY",
  "AUTHORIZATION_MISSING",
  "MCO_WAIVER_DOCUMENTATION_MISSING",
  "AUTHORIZATION_DATE_INVALID",
  "AUTHORIZATION_CODE_MISMATCH",
  "AUTHORIZED_UNITS_EXCEEDED",
  "PLAN_OF_CARE_MISSING_OR_INACTIVE",
  "SERVICE_NOT_IN_PLAN",
  "MHRS_PLAN_DETAIL_MISSING",
  "TELEHEALTH_CONSENT_OR_SAFETY_MISSING",
  "TELEHEALTH_PLAN_APPROVAL_MISSING",
  "AUDIO_ONLY_REASON_MISSING",
  "AUDIO_ONLY_RELATIONSHIP_REQUIRED",
  "AUDIO_ONLY_PERIODIC_CONTACT_REQUIRED",
  "GROUP_SIZE_EXCEEDED",
  "DOCUMENTATION_INCOMPLETE",
  "DOCUMENTATION_MISMATCH",
  "DUPLICATE_ENCOUNTER",
  "OVERLAPPING_ENCOUNTER",
  "SAME_DAY_ROUTINE_AND_INTENSIVE_MHTCM",
  "SAME_DAY_MHTCM_AND_PSYCHOSOCIAL_REHABILITATION",
  "SAME_DAY_PSYCHOSOCIAL_REHABILITATION_AND_SKILLS_TRAINING",
] as const;

export type ClinicalBillingReasonCode = (typeof CLINICAL_BILLING_REASON_CODES)[number];
export type ClinicalAuditOutcome = "pass" | "fail" | "not_applicable";

export interface ClinicalAuditCheck {
  checkId: string;
  outcome: ClinicalAuditOutcome;
  reasonCode?: ClinicalBillingReasonCode;
  detail: string;
  authoritySourceIds: readonly string[];
}

export interface ClinicalBillingFinding {
  reasonCode: ClinicalBillingReasonCode;
  checkId: string;
  detail: string;
  authoritySourceIds: readonly string[];
}

export interface ClinicalBillingReadinessResult {
  billingReady: boolean;
  decision: "READY" | "NOT_READY";
  policy: {
    policyId: string;
    version: string;
    evaluatedOn: string;
    sourceIds: readonly string[];
  };
  encounter: {
    encounterId: string;
    clientId: string;
    program: ClinicalProgram;
    procedureCode: string;
    normalizedModifiers: readonly string[];
    serviceDate: string;
    durationMinutes: number | null;
    calculatedUnits: number | null;
    declaredUnits: number;
  };
  reasonCodes: readonly ClinicalBillingReasonCode[];
  findings: readonly ClinicalBillingFinding[];
  checks: readonly ClinicalAuditCheck[];
  controlledExceptions: readonly {
    controlId: string;
    status: "required";
    detail: string;
  }[];
}

const HANDBOOK_SOURCE = ["TMHP-TMPPM-BHCM-2026-07"] as const;
const HANDBOOK_AND_FEE_SOURCES = [
  "TMHP-TMPPM-BHCM-2026-07",
  "TMHP-FEE-PRCR423C-2026-04-16",
] as const;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_OF_DAY = /^(\d{2}):(\d{2})$/;
const DAY_MS = 86_400_000;

function isNonBlank(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIsoDate(value: string | null | undefined): value is string {
  if (!value) return false;
  const match = ISO_DATE.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isoDateToEpoch(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function daysBetween(earlier: string, later: string): number {
  return Math.floor((isoDateToEpoch(later) - isoDateToEpoch(earlier)) / DAY_MS);
}

function timeToMinutes(value: string): number | null {
  const match = TIME_OF_DAY.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function normalizedModifiers(modifiers: readonly string[]): string[] {
  return [...new Set(modifiers.map((modifier) => modifier.trim().toUpperCase()).filter(Boolean))].sort();
}

function sameModifiers(left: readonly string[], right: readonly string[]): boolean {
  const normalizedLeft = normalizedModifiers(left);
  const normalizedRight = normalizedModifiers(right);
  return normalizedLeft.length === normalizedRight.length && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

function containsAll(values: readonly string[], required: readonly string[]): boolean {
  return required.every((modifier) => values.includes(modifier));
}

function monthsWindowDays(months: 6 | 12): number {
  return months === 6 ? 184 : 366;
}

class AuditCollector {
  readonly checks: ClinicalAuditCheck[] = [];

  pass(checkId: string, detail: string, authoritySourceIds: readonly string[] = HANDBOOK_SOURCE): void {
    this.checks.push({ checkId, outcome: "pass", detail, authoritySourceIds });
  }

  fail(
    checkId: string,
    reasonCode: ClinicalBillingReasonCode,
    detail: string,
    authoritySourceIds: readonly string[] = HANDBOOK_SOURCE,
  ): void {
    this.checks.push({ checkId, outcome: "fail", reasonCode, detail, authoritySourceIds });
  }

  notApplicable(checkId: string, detail: string, authoritySourceIds: readonly string[] = HANDBOOK_SOURCE): void {
    this.checks.push({ checkId, outcome: "not_applicable", detail, authoritySourceIds });
  }
}

function evaluatePolicyCurrency(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const evaluationValid = isIsoDate(input.evaluatedOn);
  const serviceValid = isIsoDate(input.encounter.serviceDate);

  if (!evaluationValid) {
    audit.fail("policy.evaluation_date", "INVALID_EVALUATION_DATE", "evaluatedOn must be a real ISO calendar date.");
  } else {
    audit.pass("policy.evaluation_date", `Evaluation date ${input.evaluatedOn} is valid.`);
  }

  if (!serviceValid) {
    audit.fail("policy.service_date", "INVALID_SERVICE_DATE", "serviceDate must be a real ISO calendar date.");
  } else {
    audit.pass("policy.service_date", `Service date ${input.encounter.serviceDate} is valid.`);
  }

  if (input.acknowledgedPolicyVersion !== CLINICAL_POLICY_METADATA.version) {
    audit.fail(
      "policy.version",
      "POLICY_VERSION_MISMATCH",
      `Acknowledged policy ${input.acknowledgedPolicyVersion || "<missing>"} does not match ${CLINICAL_POLICY_METADATA.version}.`,
      HANDBOOK_AND_FEE_SOURCES,
    );
  } else {
    audit.pass("policy.version", `Policy version ${CLINICAL_POLICY_METADATA.version} was acknowledged.`, HANDBOOK_AND_FEE_SOURCES);
  }

  if (evaluationValid && input.evaluatedOn >= CLINICAL_POLICY_METADATA.reviewRequiredBy) {
    audit.fail(
      "policy.review_currency",
      "POLICY_REVIEW_STALE",
      `Policy requires source re-review before evaluations on or after ${CLINICAL_POLICY_METADATA.reviewRequiredBy}.`,
      HANDBOOK_AND_FEE_SOURCES,
    );
  } else if (evaluationValid) {
    audit.pass(
      "policy.review_currency",
      `Source review remains current through ${CLINICAL_POLICY_METADATA.reviewRequiredBy}.`,
      HANDBOOK_AND_FEE_SOURCES,
    );
  }

  if (serviceValid && input.encounter.serviceDate < CLINICAL_POLICY_METADATA.effectiveFrom) {
    audit.fail(
      "policy.effective_date",
      "SERVICE_BEFORE_POLICY_EFFECTIVE_DATE",
      `Service predates this policy edition's ${CLINICAL_POLICY_METADATA.effectiveFrom} effective date.`,
      HANDBOOK_AND_FEE_SOURCES,
    );
  } else if (serviceValid) {
    audit.pass("policy.effective_date", "Service is on or after this edition's effective date.", HANDBOOK_AND_FEE_SOURCES);
  }

  if (evaluationValid && serviceValid && input.encounter.serviceDate > input.evaluatedOn) {
    audit.fail(
      "policy.no_future_service",
      "SERVICE_DATE_AFTER_EVALUATION_DATE",
      "A future service cannot be declared billing-ready.",
    );
  } else if (evaluationValid && serviceValid) {
    audit.pass("policy.no_future_service", "Service is not later than the evaluation date.");
  }
}

function evaluateTimeAndUnits(input: ClinicalBillingEvaluationInput, audit: AuditCollector): { durationMinutes: number | null; calculatedUnits: number | null } {
  const start = timeToMinutes(input.encounter.startTime);
  const end = timeToMinutes(input.encounter.endTime);
  let durationMinutes: number | null = null;
  let calculatedUnits: number | null = null;

  if (start === null || end === null || end <= start) {
    audit.fail("units.service_time", "INVALID_SERVICE_TIME", "Start and end must be valid HH:mm values with end after start.");
  } else {
    durationMinutes = end - start;
    calculatedUnits = Math.floor(durationMinutes / 15);
    audit.pass("units.service_time", `Documented duration is ${durationMinutes} minutes.`);
  }

  if (!Number.isInteger(input.encounter.declaredUnits) || input.encounter.declaredUnits <= 0) {
    audit.fail("units.declared", "INVALID_DECLARED_UNITS", "Declared units must be a positive integer.", HANDBOOK_AND_FEE_SOURCES);
  } else {
    audit.pass("units.declared", `${input.encounter.declaredUnits} positive integer unit(s) declared.`, HANDBOOK_AND_FEE_SOURCES);
  }

  if (calculatedUnits !== null && calculatedUnits < 1) {
    audit.fail("units.minimum", "INSUFFICIENT_BILLABLE_TIME", "Fewer than 15 continuous minutes were documented.", HANDBOOK_AND_FEE_SOURCES);
  } else if (calculatedUnits !== null) {
    audit.pass("units.minimum", `${calculatedUnits} completed 15-minute interval(s) documented.`, HANDBOOK_AND_FEE_SOURCES);
  }

  if (calculatedUnits !== null && calculatedUnits !== input.encounter.declaredUnits) {
    audit.fail(
      "units.match",
      "UNIT_DURATION_MISMATCH",
      `Declared ${input.encounter.declaredUnits} unit(s), but ${calculatedUnits} completed 15-minute interval(s) are supported.`,
      HANDBOOK_AND_FEE_SOURCES,
    );
  } else if (calculatedUnits !== null) {
    audit.pass("units.match", "Declared units match completed 15-minute intervals.", HANDBOOK_AND_FEE_SOURCES);
  }

  if (!input.encounter.continuousContact) {
    audit.fail("units.continuity", "NON_CONTINUOUS_CONTACT", "Continuous contact is not evidenced for the billed interval(s).", HANDBOOK_AND_FEE_SOURCES);
  } else {
    audit.pass("units.continuity", "Continuous contact is evidenced.", HANDBOOK_AND_FEE_SOURCES);
  }

  return { durationMinutes, calculatedUnits };
}

function evaluateTaxonomyAndCode(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { encounter } = input;
  const expectedProgram = encounter.procedureCode === "T1017" ? "MHTCM" : encounter.procedureCode === "H2014" || encounter.procedureCode === "H2017" ? "MHRS" : null;

  if (expectedProgram !== encounter.program) {
    audit.fail(
      "coding.program",
      "PROGRAM_CODE_MISMATCH",
      `Procedure ${encounter.procedureCode} is not controlled for program ${encounter.program}.`,
      HANDBOOK_AND_FEE_SOURCES,
    );
  } else {
    audit.pass("coding.program", `${encounter.procedureCode} is controlled for ${encounter.program}.`, HANDBOOK_AND_FEE_SOURCES);
  }

  if (encounter.program === "MHTCM") {
    if (!encounter.mhtcmFunction) {
      audit.fail("taxonomy.mhtcm_function", "MHTCM_FUNCTION_REQUIRED", "One controlled MHTCM function is required.");
    } else if (MHTCM_FUNCTION_RULES[encounter.mhtcmFunction].t1017Disposition !== "billable_when_criteria_met") {
      audit.fail(
        "taxonomy.mhtcm_function",
        "MHTCM_FUNCTION_NOT_SEPARATELY_BILLABLE",
        `${MHTCM_FUNCTION_RULES[encounter.mhtcmFunction].label} is not separately billable as T1017.`,
      );
    } else {
      audit.pass("taxonomy.mhtcm_function", `${MHTCM_FUNCTION_RULES[encounter.mhtcmFunction].label} may be T1017-billable when all criteria pass.`);
    }

    if (!encounter.mhtcmLevel) {
      audit.fail("taxonomy.mhtcm_level", "MHTCM_LEVEL_REQUIRED", "Routine or intensive case-management level is required.");
    } else {
      audit.pass("taxonomy.mhtcm_level", `${encounter.mhtcmLevel} MHTCM level is identified.`);
    }

    audit.notApplicable("taxonomy.mhrs", "MHRS taxonomy does not apply to MHTCM.");
    return;
  }

  audit.notApplicable("taxonomy.mhtcm_level", "MHTCM level does not apply to MHRS.");
  audit.notApplicable("taxonomy.mhtcm_function", "MHTCM function does not apply to MHRS.");

  if (!encounter.mhrsCategory) {
    audit.fail("taxonomy.mhrs_category", "MHRS_CATEGORY_REQUIRED", "One controlled MHRS category is required.");
  } else {
    audit.pass("taxonomy.mhrs_category", `${MHRS_CATEGORY_RULES[encounter.mhrsCategory].label} category is identified.`);
  }

  if (!encounter.mhrsServiceBasis) {
    audit.fail("taxonomy.mhrs_basis", "MHRS_SERVICE_BASIS_REQUIRED", "A covered MHRS service basis is required because operating categories do not independently determine a billing code.");
  } else {
    audit.pass("taxonomy.mhrs_basis", `${encounter.mhrsServiceBasis} service basis is identified.`);
  }

  if (encounter.mhrsCategory && encounter.mhrsServiceBasis) {
    const allowed = MHRS_CATEGORY_RULES[encounter.mhrsCategory].allowedServiceBases;
    if (!allowed.includes(encounter.mhrsServiceBasis)) {
      audit.fail(
        "taxonomy.mhrs_category_basis",
        "MHRS_CATEGORY_BASIS_MISMATCH",
        `${encounter.mhrsCategory} cannot use ${encounter.mhrsServiceBasis}.`,
      );
    } else {
      audit.pass("taxonomy.mhrs_category_basis", "Operating category is supported by the selected covered service basis.");
    }

    const expectedCode = encounter.mhrsServiceBasis === "psychosocial_rehabilitation" ? "H2017" : "H2014";
    if (encounter.procedureCode !== expectedCode) {
      audit.fail(
        "coding.mhrs_basis",
        "MHRS_CODE_BASIS_MISMATCH",
        `${encounter.mhrsServiceBasis} requires ${expectedCode}, not ${encounter.procedureCode}.`,
        HANDBOOK_AND_FEE_SOURCES,
      );
    } else {
      audit.pass("coding.mhrs_basis", `${encounter.procedureCode} matches the covered service basis.`, HANDBOOK_AND_FEE_SOURCES);
    }
  }

  if (encounter.procedureCode === "H2017" && encounter.ageYears < 18) {
    audit.fail("coding.h2017_age", "AGE_RESTRICTION", "Psychosocial rehabilitation (H2017) is limited to persons 18 years of age and older.");
  } else if (encounter.procedureCode === "H2017") {
    audit.pass("coding.h2017_age", "H2017 age requirement is satisfied.");
  } else {
    audit.notApplicable("coding.h2017_age", "H2017 age rule does not apply.");
  }
}

function evaluateModifiers(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { encounter, provider } = input;
  const modifiers = normalizedModifiers(encounter.modifiers);
  const known = new Set(["95", "ET", "FQ", "HA", "HO", "HQ", "HZ", "TD", "TF", "TG"]);
  const unknown = modifiers.filter((modifier) => !known.has(modifier));

  if (modifiers.length !== encounter.modifiers.length) {
    audit.fail("coding.modifier_duplicates", "DUPLICATE_MODIFIER", "Modifiers must be unique after normalization.", HANDBOOK_AND_FEE_SOURCES);
  } else {
    audit.pass("coding.modifier_duplicates", "Modifiers are unique.", HANDBOOK_AND_FEE_SOURCES);
  }

  if (unknown.length > 0) {
    audit.fail("coding.modifier_known", "MODIFIER_NOT_ALLOWED", `Uncontrolled modifier(s): ${unknown.join(", ")}.`, HANDBOOK_AND_FEE_SOURCES);
  } else {
    audit.pass("coding.modifier_known", "All submitted modifiers are recognized by the policy.", HANDBOOK_AND_FEE_SOURCES);
  }

  if (modifiers.includes("HO")) {
    audit.fail(
      "coding.h2014_ho",
      "H2014_HO_PRIMARY_AUTHORITY_REQUIRED",
      CLINICAL_POLICY_METADATA.h2014HoControlNote,
      HANDBOOK_AND_FEE_SOURCES,
    );
  } else {
    audit.notApplicable("coding.h2014_ho", "H2014-HO controlled exception was not invoked.", HANDBOOK_AND_FEE_SOURCES);
  }

  if (containsAll(modifiers, ["95", "FQ"]) || containsAll(modifiers, ["TF", "TG"])) {
    audit.fail("coding.modifier_conflicts", "MODIFIER_CONFLICT", "Mutually exclusive delivery or MHTCM-level modifiers were submitted.", HANDBOOK_AND_FEE_SOURCES);
  } else {
    audit.pass("coding.modifier_conflicts", "No mutually exclusive modifiers were submitted.", HANDBOOK_AND_FEE_SOURCES);
  }

  const required: string[] = [];
  const disallowed: string[] = [];

  if (encounter.deliveryMode === "synchronous_audiovisual") {
    required.push("95");
    disallowed.push("FQ");
  } else if (encounter.deliveryMode === "synchronous_audio_only") {
    required.push("FQ");
    disallowed.push("95");
  } else {
    disallowed.push("95", "FQ");
  }

  if (encounter.fundingSource === "criminal_justice_agency") required.push("HZ");
  else disallowed.push("HZ");

  if (encounter.procedureCode === "T1017") {
    if (encounter.mhtcmLevel === "routine") required.push("TF");
    if (encounter.mhtcmLevel === "intensive") required.push("TG");
    if (encounter.ageYears <= 20) required.push("HA");
    else disallowed.push("HA", "TG");
    disallowed.push("HQ", "TD", "ET", "HO");
  } else if (encounter.procedureCode === "H2014") {
    if (encounter.ageYears <= 20) required.push("HA");
    else disallowed.push("HA");
    if (encounter.setting === "group") required.push("HQ");
    else disallowed.push("HQ");
    disallowed.push("TF", "TG", "TD", "ET");
  } else if (encounter.procedureCode === "H2017") {
    if (encounter.setting === "group") required.push("HQ");
    else disallowed.push("HQ");
    if (provider.credential === "RN") required.push("TD");
    else disallowed.push("TD");
    if (encounter.emergentTreatment) required.push("ET");
    else disallowed.push("ET");
    disallowed.push("HA", "TF", "TG", "HO");
  }

  const missing = [...new Set(required)].filter((modifier) => !modifiers.includes(modifier));
  if (missing.length > 0) {
    audit.fail("coding.required_modifiers", "REQUIRED_MODIFIER_MISSING", `Required modifier(s) missing: ${missing.join(", ")}.`, HANDBOOK_AND_FEE_SOURCES);
  } else {
    audit.pass("coding.required_modifiers", "All context-required modifiers are present.", HANDBOOK_AND_FEE_SOURCES);
  }

  const presentButDisallowed = [...new Set(disallowed)].filter((modifier) => modifiers.includes(modifier));
  if (presentButDisallowed.length > 0) {
    audit.fail("coding.context_modifiers", "MODIFIER_NOT_ALLOWED", `Modifier(s) do not match encounter context: ${presentButDisallowed.join(", ")}.`, HANDBOOK_AND_FEE_SOURCES);
  } else {
    audit.pass("coding.context_modifiers", "Submitted modifiers match encounter context.", HANDBOOK_AND_FEE_SOURCES);
  }
}

function evaluateEligibility(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { encounter, eligibility } = input;
  if (!eligibility.medicaidEligible || !eligibility.texasResident) {
    audit.fail("eligibility.coverage", "CLIENT_NOT_ELIGIBLE", "Current Texas Medicaid eligibility and Texas residency are required.");
  } else {
    audit.pass("eligibility.coverage", "Texas Medicaid eligibility and residency are evidenced.");
  }

  const diagnosisDateValid = isIsoDate(eligibility.diagnosisEstablishedOn);
  if (!diagnosisDateValid || (isIsoDate(encounter.serviceDate) && eligibility.diagnosisEstablishedOn! > encounter.serviceDate)) {
    audit.fail("eligibility.diagnosis_established", "DIAGNOSIS_NOT_ESTABLISHED", "A qualifying diagnosis must be established on or before service.");
  } else {
    audit.pass("eligibility.diagnosis_established", "Diagnosis was established on or before service.");
  }

  const diagnosisAllowed = encounter.ageYears <= 20
    ? eligibility.diagnosisCategory === "mental_illness" || eligibility.diagnosisCategory === "serious_emotional_disturbance"
    : eligibility.diagnosisCategory === "serious_mental_illness";
  if (!diagnosisAllowed) {
    audit.fail(
      "eligibility.diagnosis_category",
      "CLIENT_NOT_ELIGIBLE",
      `Diagnosis category ${eligibility.diagnosisCategory} is not qualifying for this age and program; IDD-only and SUD-only diagnoses are excluded.`,
    );
  } else {
    audit.pass("eligibility.diagnosis_category", "Diagnosis category satisfies the controlled age/program rule.");
  }

  if (!eligibility.diagnosticCriteriaDocumented) {
    audit.fail("eligibility.diagnostic_criteria", "DIAGNOSTIC_CRITERIA_NOT_DOCUMENTED", "Applicable DSM diagnostic criteria and service need must be documented.");
  } else {
    audit.pass("eligibility.diagnostic_criteria", "Diagnostic criteria and service need are documented.");
  }

  if (!eligibility.functionalEligibilityConfirmed) {
    audit.fail("eligibility.functional", "FUNCTIONAL_ELIGIBILITY_NOT_CONFIRMED", "Uniform-assessment functional eligibility is not confirmed.");
  } else {
    audit.pass("eligibility.functional", "Functional eligibility is confirmed.");
  }

  if (!isIsoDate(eligibility.diagnosisLastReviewedOn) || !isIsoDate(encounter.serviceDate) || eligibility.diagnosisLastReviewedOn! > encounter.serviceDate || daysBetween(eligibility.diagnosisLastReviewedOn!, encounter.serviceDate) > 365) {
    audit.fail("eligibility.diagnosis_currency", "DIAGNOSIS_NOT_CURRENT", "Diagnosis must be updated when changed and at least annually.");
  } else {
    audit.pass("eligibility.diagnosis_currency", "Diagnosis review is current within the annual interval.");
  }

  if (!eligibility.uniformAssessment || !isIsoDate(eligibility.uniformAssessmentOn)) {
    audit.fail("eligibility.assessment", "UNIFORM_ASSESSMENT_MISSING", "A dated CANS or ANSA uniform assessment is required.");
  } else {
    audit.pass("eligibility.assessment", `${eligibility.uniformAssessment} assessment is documented.`);
  }

  const expectedAssessment: UniformAssessment = encounter.ageYears <= 17 ? "CANS" : "ANSA";
  if (eligibility.uniformAssessment && eligibility.uniformAssessment !== expectedAssessment) {
    audit.fail("eligibility.assessment_type", "UNIFORM_ASSESSMENT_TYPE_INVALID", `${expectedAssessment} is required for age ${encounter.ageYears}.`);
  } else if (eligibility.uniformAssessment) {
    audit.pass("eligibility.assessment_type", `${expectedAssessment} is the correct age-based assessment.`);
  }

  if (isIsoDate(eligibility.uniformAssessmentOn) && isIsoDate(encounter.serviceDate)) {
    const maxAgeDays = encounter.ageYears <= 20 ? 90 : 180;
    const assessmentAge = daysBetween(eligibility.uniformAssessmentOn, encounter.serviceDate);
    if (assessmentAge < 0 || assessmentAge > maxAgeDays) {
      audit.fail(
        "eligibility.assessment_currency",
        "UNIFORM_ASSESSMENT_STALE",
        `Assessment is ${assessmentAge} day(s) from service; maximum is ${maxAgeDays} days. For MHRS ages 18-20, this applies the more conservative 90-day reauthorization rule in TMPPM 5.2.3.10.2.`,
      );
    } else {
      audit.pass("eligibility.assessment_currency", `Assessment is current within ${maxAgeDays} days.`);
    }
  }

  if (!isIsoDate(eligibility.assessorCertificationExpiresOn) || !isIsoDate(encounter.serviceDate) || eligibility.assessorCertificationExpiresOn! < encounter.serviceDate) {
    audit.fail("eligibility.assessor_certification", "ASSESSOR_CERTIFICATION_NOT_CURRENT", "CANS/ANSA assessor certification must be current on the service date.");
  } else {
    audit.pass("eligibility.assessor_certification", "Assessor certification is current on the service date.");
  }

  if (!eligibility.medicalNecessityConfirmedByLpha) {
    audit.fail("eligibility.medical_necessity", "MEDICAL_NECESSITY_NOT_CONFIRMED", "LPHA medical-necessity confirmation is required.");
  } else {
    audit.pass("eligibility.medical_necessity", "LPHA medical necessity is confirmed.");
  }
}

function allowedProviderCredentials(input: ClinicalBillingEvaluationInput): readonly ProviderCredential[] {
  const { encounter } = input;
  if (encounter.program === "MHTCM") return ["LPHA", "QMHP_CS", "CSSP"];
  if (encounter.procedureCode === "H2017") return ["LPHA", "QMHP_CS", "CSSP", "PEER_PROVIDER", "RN"];
  if (encounter.ageYears <= 20) return ["LPHA", "QMHP_CS", "CSSP", "FAMILY_PARTNER", "RN"];
  return ["LPHA", "QMHP_CS", "CSSP", "PEER_PROVIDER"];
}

function evaluateProvider(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { provider } = input;
  const allowed = allowedProviderCredentials(input);
  if (!allowed.includes(provider.credential)) {
    audit.fail("provider.credential_allowed", "PROVIDER_CREDENTIAL_NOT_ALLOWED", `${provider.credential} is not authorized for this service/age combination.`);
  } else {
    audit.pass("provider.credential_allowed", `${provider.credential} is an allowed provider type for this service/age combination.`);
  }

  if (!provider.credentialCurrent) {
    audit.fail("provider.credential_current", "PROVIDER_CREDENTIAL_NOT_CURRENT", "Provider credential is not current.");
  } else {
    audit.pass("provider.credential_current", "Provider credential is current.");
  }

  if (!provider.requiredTrainingCurrent || !provider.competencyDocumented) {
    audit.fail("provider.training_competency", "PROVIDER_TRAINING_OR_COMPETENCY_MISSING", "Required training and documented competency must both be current.");
  } else {
    audit.pass("provider.training_competency", "Training and competency are documented.");
  }

  if (provider.credential === "CSSP" && !provider.employeeOfBillingProvider) {
    audit.fail("provider.employment", "PROVIDER_EMPLOYMENT_REQUIRED", "A CSSP performing these services must be an employee of the billing provider.");
  } else {
    audit.pass("provider.employment", "Applicable provider-employment requirement is satisfied.");
  }

  if (provider.credential === "CSSP") {
    if (!provider.supervisionActive || !["LPHA", "QMHP_CS"].includes(provider.supervisorCredential ?? "")) {
      audit.fail("provider.supervision", "PROVIDER_SUPERVISION_MISSING", "CSSP requires active clinical supervision by at least a QMHP-CS.");
    } else {
      audit.pass("provider.supervision", "CSSP clinical supervision is evidenced.");
    }
  } else if (provider.credential === "QMHP_CS") {
    const validSupervisor = provider.supervisionActive && ["LPHA", "QMHP_CS"].includes(provider.supervisorCredential ?? "");
    const validUpstream = provider.supervisorCredential !== "QMHP_CS" || provider.supervisingQmhpHasLphaSupervision;
    if (!validSupervisor || !validUpstream) {
      audit.fail("provider.supervision", "PROVIDER_SUPERVISION_MISSING", "QMHP-CS requires QMHP-CS supervision, with LPHA supervision in the chain.");
    } else {
      audit.pass("provider.supervision", "QMHP-CS supervision chain is evidenced.");
    }
  } else if (provider.credential === "PEER_PROVIDER") {
    if (!provider.supervisionActive || provider.supervisorCredential !== "LPHA") {
      audit.fail("provider.supervision", "PROVIDER_SUPERVISION_MISSING", "Peer provider requires active LPHA supervision.");
    } else {
      audit.pass("provider.supervision", "Peer provider has active LPHA supervision.");
    }
  } else if (provider.credential === "FAMILY_PARTNER") {
    if (!provider.supervisionActive || !["LPHA", "QMHP_CS"].includes(provider.supervisorCredential ?? "")) {
      audit.fail("provider.supervision", "PROVIDER_SUPERVISION_MISSING", "Family partner requires supervision by at least a QMHP-CS.");
    } else {
      audit.pass("provider.supervision", "Family-partner supervision is evidenced.");
    }
  } else {
    audit.notApplicable("provider.supervision", `${provider.credential} has no additional supervision evidence gate in this policy.`);
  }

  if (provider.credential === "PEER_PROVIDER") {
    if (!provider.peerMonthlyMeetingDocumented || !provider.peerMonthlyObservationDocumented) {
      audit.fail("provider.peer_monthly_evidence", "PEER_SUPERVISION_DOCUMENTATION_MISSING", "Peer provider requires a documented monthly LPHA meeting and a separate monthly observation.");
    } else {
      audit.pass("provider.peer_monthly_evidence", "Monthly peer meeting and observation are documented.");
    }
  } else {
    audit.notApplicable("provider.peer_monthly_evidence", "Peer-provider monthly evidence does not apply.");
  }

  if (provider.credential === "FAMILY_PARTNER" && !provider.familyPartnerCertified) {
    audit.fail("provider.family_partner_certification", "FAMILY_PARTNER_CERTIFICATION_MISSING", "Family partner certification is required for the controlled billing decision.");
  } else if (provider.credential === "FAMILY_PARTNER") {
    audit.pass("provider.family_partner_certification", "Family partner certification is documented.");
  } else {
    audit.notApplicable("provider.family_partner_certification", "Family-partner certification does not apply.");
  }
}

function evaluateParticipationAndDuplication(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { encounter } = input;
  if (!encounter.personPresentAwakeParticipating) {
    audit.fail("service.participation", "PERSON_PARTICIPATION_REQUIRED", "The person must be present, awake, and participating for the controlled services.");
  } else {
    audit.pass("service.participation", "Person presence, wakefulness, and participation are evidenced.");
  }

  if (encounter.program === "MHTCM" && encounter.collateralContact && !encounter.personOrLarPresentForCollateral) {
    audit.fail("service.collateral", "COLLATERAL_PARTICIPATION_REQUIRED", "MHTCM collateral contacts are payable only when the person or LAR is present.");
  } else if (encounter.program === "MHTCM" && encounter.collateralContact) {
    audit.pass("service.collateral", "Person or LAR was present for the collateral-contact session.");
  } else {
    audit.notApplicable("service.collateral", "Collateral-contact condition does not apply.");
  }

  if (encounter.duplicatesAnotherServiceOrDischargeActivity) {
    audit.fail("service.nonduplication", "DUPLICATIVE_ACTIVITY", "The activity duplicates another service or discharge-planning activity.");
  } else {
    audit.pass("service.nonduplication", "No duplicative service or discharge-planning activity is identified.");
  }

  if (encounter.setting === "group") {
    const maximum = encounter.ageYears <= 20 ? 6 : 8;
    if (!Number.isInteger(encounter.groupSize) || (encounter.groupSize ?? 0) < 1 || (encounter.groupSize ?? 0) > maximum) {
      audit.fail("service.group_size", "GROUP_SIZE_EXCEEDED", `Group size must be between 1 and ${maximum} for this age.`);
    } else {
      audit.pass("service.group_size", `Group size ${encounter.groupSize} is within the ${maximum}-person limit.`);
    }
  } else {
    audit.notApplicable("service.group_size", "Group-size limit does not apply to an individual service.");
  }
}

function evaluateAuthorization(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { authorization, encounter } = input;
  if (authorization.status === "missing" || authorization.status === "pending" || authorization.status === "denied") {
    audit.fail("authorization.status", "AUTHORIZATION_MISSING", `Authorization status is ${authorization.status}; T1017, H2014, and H2017 require authorization or a documented MCO waiver.`);
  } else {
    audit.pass("authorization.status", `Authorization status ${authorization.status} is potentially acceptable.`);
  }

  if (authorization.status === "mco_waived") {
    if (authorization.payerModel !== "managed_care" || !isNonBlank(authorization.waiverDocumentationReference)) {
      audit.fail("authorization.waiver", "MCO_WAIVER_DOCUMENTATION_MISSING", "Only a managed-care MCO may waive submission, and the waiver must be documented.");
    } else {
      audit.pass("authorization.waiver", "Managed-care MCO waiver is documented.");
    }
  } else {
    audit.notApplicable("authorization.waiver", "MCO waiver was not used.");
  }

  if (authorization.status === "authorized") {
    if (!isNonBlank(authorization.authorizationId)) {
      audit.fail("authorization.identifier", "AUTHORIZATION_MISSING", "Authorized status requires an authorization identifier.");
    } else {
      audit.pass("authorization.identifier", "Authorization identifier is present.");
    }

    const datesValid = isIsoDate(authorization.validFrom) && isIsoDate(authorization.validThrough) && isIsoDate(encounter.serviceDate);
    if (!datesValid || authorization.validFrom! > encounter.serviceDate || authorization.validThrough! < encounter.serviceDate) {
      audit.fail("authorization.dates", "AUTHORIZATION_DATE_INVALID", "Service must fall within valid authorization dates.");
    } else {
      audit.pass("authorization.dates", "Service falls within authorization dates.");
    }

    if (authorization.procedureCode !== encounter.procedureCode) {
      audit.fail("authorization.code", "AUTHORIZATION_CODE_MISMATCH", `Authorization covers ${authorization.procedureCode ?? "<missing>"}, not ${encounter.procedureCode}.`);
    } else {
      audit.pass("authorization.code", "Authorization procedure code matches the encounter.");
    }

    if (authorization.remainingUnits === null || authorization.remainingUnits < encounter.declaredUnits) {
      audit.fail("authorization.units", "AUTHORIZED_UNITS_EXCEEDED", "Declared units exceed documented remaining authorized units.");
    } else {
      audit.pass("authorization.units", "Declared units are within remaining authorized units.");
    }
  } else {
    audit.notApplicable("authorization.identifier", "Authorization identifier gate does not apply to this status.");
    audit.notApplicable("authorization.dates", "Authorization date gate does not apply to this status.");
    audit.notApplicable("authorization.code", "Authorization code gate does not apply to this status.");
    audit.notApplicable("authorization.units", "Authorization unit gate does not apply to this status.");
  }
}

function evaluatePlan(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { plan, encounter } = input;
  const active = plan.exists && isIsoDate(plan.activeFrom) && isIsoDate(plan.activeThrough) && isIsoDate(encounter.serviceDate) && plan.activeFrom! <= encounter.serviceDate && plan.activeThrough! >= encounter.serviceDate;
  if (!active) {
    audit.fail("plan.active", "PLAN_OF_CARE_MISSING_OR_INACTIVE", "A written, active plan of care is required on the service date.");
  } else {
    audit.pass("plan.active", "Plan of care is active on the service date.");
  }

  if (!plan.serviceIncluded || !isNonBlank(plan.goalReference)) {
    audit.fail("plan.service_goal", "SERVICE_NOT_IN_PLAN", "The service and a specific goal/objective must be included in the plan.");
  } else {
    audit.pass("plan.service_goal", "Service and goal/objective are included in the plan.");
  }

  if (encounter.program === "MHRS" && !plan.typeAmountDurationDocumented) {
    audit.fail("plan.mhrs_detail", "MHRS_PLAN_DETAIL_MISSING", "MHRS plan must state service type, amount, and duration.");
  } else if (encounter.program === "MHRS") {
    audit.pass("plan.mhrs_detail", "MHRS type, amount, and duration are documented.");
  } else {
    audit.notApplicable("plan.mhrs_detail", "MHRS plan-detail rule does not apply.");
  }
}

function evaluateTelehealth(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { encounter, telehealth, plan } = input;
  if (encounter.deliveryMode === "in_person") {
    audit.notApplicable("telehealth.consent_safety", "Telehealth evidence does not apply to in-person service.");
    audit.notApplicable("telehealth.plan_approval", "Telehealth plan approval does not apply to in-person service.");
    audit.notApplicable("telehealth.audio_reason", "Audio-only reason does not apply.");
    audit.notApplicable("telehealth.relationship", "Audio-only relationship does not apply.");
    audit.notApplicable("telehealth.periodic_contact", "Audio-only periodic contact does not apply.");
    return;
  }

  if (!telehealth.consentDocumented || !telehealth.clinicallyAppropriateAndSafe) {
    audit.fail("telehealth.consent_safety", "TELEHEALTH_CONSENT_OR_SAFETY_MISSING", "Telehealth requires documented agreement and a clinically appropriate/safe determination.");
  } else {
    audit.pass("telehealth.consent_safety", "Telehealth agreement and clinical safety are documented.");
  }

  if (!plan.telehealthApproved) {
    audit.fail("telehealth.plan_approval", "TELEHEALTH_PLAN_APPROVAL_MISSING", "Telehealth delivery must be approved in the plan of care for these non-crisis services.");
  } else {
    audit.pass("telehealth.plan_approval", "Telehealth delivery is approved in the plan of care.");
  }

  if (encounter.deliveryMode !== "synchronous_audio_only") {
    audit.notApplicable("telehealth.audio_reason", "Audio-only reason does not apply to audiovisual service.");
    audit.notApplicable("telehealth.relationship", "Audio-only relationship does not apply to audiovisual service.");
    audit.notApplicable("telehealth.periodic_contact", "Audio-only periodic contact does not apply to audiovisual service.");
    return;
  }

  if (!isNonBlank(telehealth.audioOnlyReason)) {
    audit.fail("telehealth.audio_reason", "AUDIO_ONLY_REASON_MISSING", "The medical record must state why synchronous audio-only delivery was used.");
  } else {
    audit.pass("telehealth.audio_reason", "Audio-only delivery reason is documented.");
  }

  const relationshipDate = telehealth.priorInPersonOrAudiovisualServiceOn;
  if (!isIsoDate(relationshipDate) || !isIsoDate(encounter.serviceDate) || relationshipDate >= encounter.serviceDate || daysBetween(relationshipDate, encounter.serviceDate) > monthsWindowDays(6)) {
    audit.fail("telehealth.relationship", "AUDIO_ONLY_RELATIONSHIP_REQUIRED", "Same-provider in-person or audiovisual service is required within the prior six months.");
  } else {
    audit.pass("telehealth.relationship", "Six-month existing clinical relationship is evidenced.");
  }

  const periodicDate = telehealth.rollingTwelveMonthInPersonOrAudiovisualServiceOn;
  const periodicCurrent = isIsoDate(periodicDate) && isIsoDate(encounter.serviceDate) && periodicDate <= encounter.serviceDate && daysBetween(periodicDate, encounter.serviceDate) <= monthsWindowDays(12);
  if (!periodicCurrent && !telehealth.rollingTwelveMonthWaiverDocumented) {
    audit.fail("telehealth.periodic_contact", "AUDIO_ONLY_PERIODIC_CONTACT_REQUIRED", "A rolling-12-month in-person/audiovisual service or documented clinical waiver is required.");
  } else {
    audit.pass("telehealth.periodic_contact", periodicCurrent ? "Rolling-12-month in-person/audiovisual contact is current." : "Rolling-12-month contact waiver is documented.");
  }
}

function evaluateDocumentation(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { documentation, encounter } = input;
  const common: Array<keyof ClinicalDocumentationEvidence> = [
    "personName",
    "planGoal",
    "serviceDate",
    "startTime",
    "endTime",
    "deliveryMode",
    "agencyName",
    "providerSignature",
    "providerCredential",
  ];
  const programSpecific: Array<keyof ClinicalDocumentationEvidence> = encounter.program === "MHTCM"
    ? [
        "diagnosisAndNeed",
        "reasonForEncounter",
        "contactParticipants",
        "progress",
        "serviceAccessTimeline",
        "intervention",
        "reevaluationTimeline",
      ]
    : ["serviceType", "modalityAndMethod", "location", "pertinentEventsOrBehavior", "outcomeOrProgress"];
  const required = [...common, ...programSpecific];
  if (encounter.program === "MHTCM" && encounter.collateralContact) required.push("collateralContacts");
  const missing = required.filter((field) => !isNonBlank(documentation[field]));
  if (missing.length > 0) {
    audit.fail("documentation.required", "DOCUMENTATION_INCOMPLETE", `Missing or blank documentation field(s): ${missing.join(", ")}.`);
  } else {
    audit.pass("documentation.required", "All program-specific required documentation fields are present.");
  }

  const matches = documentation.serviceDate === encounter.serviceDate
    && documentation.startTime === encounter.startTime
    && documentation.endTime === encounter.endTime
    && documentation.deliveryMode === encounter.deliveryMode
    && documentation.providerCredential === input.provider.credential;
  if (!matches) {
    audit.fail("documentation.consistency", "DOCUMENTATION_MISMATCH", "Documentation date, time, mode, and credential must match the billing encounter.");
  } else {
    audit.pass("documentation.consistency", "Documentation date, time, mode, and credential match the encounter.");
  }
}

function intervalsOverlap(leftStart: string, leftEnd: string, rightStart: string, rightEnd: string): boolean {
  const aStart = timeToMinutes(leftStart);
  const aEnd = timeToMinutes(leftEnd);
  const bStart = timeToMinutes(rightStart);
  const bEnd = timeToMinutes(rightEnd);
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

function evaluatePriorEncounters(input: ClinicalBillingEvaluationInput, audit: AuditCollector): void {
  const { encounter } = input;
  const sameDay = input.priorEncounters.filter(
    (prior) => prior.status !== "voided" && prior.clientId === encounter.clientId && prior.serviceDate === encounter.serviceDate,
  );
  const duplicate = sameDay.find(
    (prior) => prior.procedureCode === encounter.procedureCode
      && prior.startTime === encounter.startTime
      && prior.endTime === encounter.endTime
      && sameModifiers(prior.modifiers, encounter.modifiers),
  );
  if (duplicate) {
    audit.fail("duplicates.exact", "DUPLICATE_ENCOUNTER", `Encounter duplicates ${duplicate.encounterId}.`);
  } else {
    audit.pass("duplicates.exact", "No exact duplicate active encounter was found.");
  }

  const overlap = sameDay.find(
    (prior) => prior.encounterId !== duplicate?.encounterId
      && intervalsOverlap(prior.startTime, prior.endTime, encounter.startTime, encounter.endTime),
  );
  if (overlap) {
    audit.fail("duplicates.overlap", "OVERLAPPING_ENCOUNTER", `Encounter time overlaps ${overlap.encounterId}.`);
  } else {
    audit.pass("duplicates.overlap", "No overlapping active encounter was found.");
  }

  const hasOppositeMhtcmLevel = encounter.procedureCode === "T1017" && sameDay.some((prior) => {
    if (prior.procedureCode !== "T1017") return false;
    return (encounter.modifiers.includes("TF") && prior.modifiers.includes("TG"))
      || (encounter.modifiers.includes("TG") && prior.modifiers.includes("TF"));
  });
  if (hasOppositeMhtcmLevel) {
    audit.fail("same_day.mhtcm_levels", "SAME_DAY_ROUTINE_AND_INTENSIVE_MHTCM", "Routine and intensive MHTCM are not payable on the same day.");
  } else {
    audit.pass("same_day.mhtcm_levels", "No same-day routine/intensive MHTCM conflict was found.");
  }

  const hasMhtcmPsychosocialConflict = (encounter.procedureCode === "T1017" && sameDay.some((prior) => prior.procedureCode === "H2017"))
    || (encounter.procedureCode === "H2017" && sameDay.some((prior) => prior.procedureCode === "T1017"));
  if (hasMhtcmPsychosocialConflict) {
    audit.fail("same_day.mhtcm_h2017", "SAME_DAY_MHTCM_AND_PSYCHOSOCIAL_REHABILITATION", "MHTCM and psychosocial rehabilitation are not payable on the same day.");
  } else {
    audit.pass("same_day.mhtcm_h2017", "No same-day MHTCM/psychosocial-rehabilitation conflict was found.");
  }

  const hasPsychosocialSkillsConflict = (encounter.procedureCode === "H2017" && sameDay.some((prior) => prior.procedureCode === "H2014"))
    || (encounter.procedureCode === "H2014" && sameDay.some((prior) => prior.procedureCode === "H2017"));
  if (hasPsychosocialSkillsConflict) {
    audit.fail("same_day.h2017_h2014", "SAME_DAY_PSYCHOSOCIAL_REHABILITATION_AND_SKILLS_TRAINING", "Psychosocial rehabilitation and skills training are not payable on the same day.");
  } else {
    audit.pass("same_day.h2017_h2014", "No same-day psychosocial-rehabilitation/skills-training conflict was found.");
  }
}

/** Evaluate billing readiness using fail-closed, audit-ready deterministic rules. */
export function evaluateClinicalBillingReadiness(input: ClinicalBillingEvaluationInput): ClinicalBillingReadinessResult {
  const audit = new AuditCollector();
  evaluatePolicyCurrency(input, audit);
  const units = evaluateTimeAndUnits(input, audit);
  evaluateTaxonomyAndCode(input, audit);
  evaluateModifiers(input, audit);
  evaluateEligibility(input, audit);
  evaluateProvider(input, audit);
  evaluateParticipationAndDuplication(input, audit);
  evaluateAuthorization(input, audit);
  evaluatePlan(input, audit);
  evaluateTelehealth(input, audit);
  evaluateDocumentation(input, audit);
  evaluatePriorEncounters(input, audit);

  const findings: ClinicalBillingFinding[] = audit.checks
    .filter((check): check is ClinicalAuditCheck & { outcome: "fail"; reasonCode: ClinicalBillingReasonCode } => check.outcome === "fail" && Boolean(check.reasonCode))
    .map((check) => ({
      reasonCode: check.reasonCode,
      checkId: check.checkId,
      detail: check.detail,
      authoritySourceIds: check.authoritySourceIds,
    }));
  const reasonCodes = [...new Set(findings.map((finding) => finding.reasonCode))];
  const controlledExceptions = normalizedModifiers(input.encounter.modifiers).includes("HO")
    ? [{ controlId: "H2014-HO", status: "required" as const, detail: CLINICAL_POLICY_METADATA.h2014HoControlNote }]
    : [];

  return {
    billingReady: findings.length === 0,
    decision: findings.length === 0 ? "READY" : "NOT_READY",
    policy: {
      policyId: CLINICAL_POLICY_METADATA.policyId,
      version: CLINICAL_POLICY_METADATA.version,
      evaluatedOn: input.evaluatedOn,
      sourceIds: CLINICAL_POLICY_METADATA.sourceIds,
    },
    encounter: {
      encounterId: input.encounter.encounterId,
      clientId: input.encounter.clientId,
      program: input.encounter.program,
      procedureCode: input.encounter.procedureCode,
      normalizedModifiers: normalizedModifiers(input.encounter.modifiers),
      serviceDate: input.encounter.serviceDate,
      durationMinutes: units.durationMinutes,
      calculatedUnits: units.calculatedUnits,
      declaredUnits: input.encounter.declaredUnits,
    },
    reasonCodes,
    findings,
    checks: audit.checks,
    controlledExceptions,
  };
}
