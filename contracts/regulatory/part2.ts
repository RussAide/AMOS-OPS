/**
 * M1.2-06 deterministic 42 CFR Part 2 policy contract.
 *
 * This module is deliberately pure: callers supply timestamps and identifiers, and
 * every access/disclosure decision returns its audit event. It does not persist data,
 * infer legal authority from a log entry, or make a definitive Part 2 applicability
 * determination when source facts are incomplete.
 *
 * Primary authorities were revalidated 2026-07-14. Title 42 and Title 45 eCFR were
 * current through 2026-07-10. The 2024 Part 2 final rule became effective 2024-04-16;
 * general compliance was required by 2026-02-16. HHS's updated Part 2 fact sheet notes
 * that the operational compliance date for the new accounting right will be set with
 * the corresponding HIPAA accounting revision. AMOS nevertheless implements the
 * three-year query now as a conservative readiness control for 42 CFR 2.25.
 */

export const PART2_REGULATORY_SOURCES = Object.freeze([
  {
    authority: "42 CFR Part 2 (including 2.13, 2.25, 2.31-2.33, and 2.51)",
    url: "https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2",
    currentThrough: "2026-07-10",
    effectiveDate: "2024-04-16",
    complianceDate: "2026-02-16",
    verifiedOn: "2026-07-14",
  },
  {
    authority: "HHS Fact Sheet: 42 CFR Part 2 Final Rule",
    url: "https://www.hhs.gov/hipaa/for-professionals/regulatory-initiatives/fact-sheet-42-cfr-part-2-final-rule/index.html",
    lastReviewed: "2026-01-30",
    verifiedOn: "2026-07-14",
  },
  {
    authority: "89 FR 12472: Confidentiality of SUD Patient Records final rule",
    url: "https://www.federalregister.gov/documents/2024/02/16/2024-02544/confidentiality-of-substance-use-disorder-sud-patient-records",
    publicationDate: "2024-02-16",
    effectiveDate: "2024-04-16",
    verifiedOn: "2026-07-14",
  },
  {
    authority: "45 CFR 164.502(b), 164.514(d), and 164.528",
    url: "https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-C/part-164/subpart-E",
    currentThrough: "2026-07-10",
    verifiedOn: "2026-07-14",
  },
  {
    authority: "HHS HIPAA Minimum Necessary Requirement guidance",
    url: "https://www.hhs.gov/hipaa/for-professionals/privacy/guidance/minimum-necessary-requirement/index.html",
    lastReviewed: "2013-07-26",
    verifiedOn: "2026-07-14",
  },
] as const);

export const PART2_NOTICE_STATEMENT_2 =
  "42 CFR part 2 prohibits unauthorized use or disclosure of these records." as const;

export type Part2DataCategory =
  | "patient_identity"
  | "diagnosis"
  | "medications"
  | "laboratory_results"
  | "treatment_plan"
  | "progress_summary"
  | "billing"
  | "sud_counseling_notes"
  | "entire_record";

export type Part2Purpose =
  | "treatment"
  | "payment"
  | "health_care_operations"
  | "patient_request"
  | "research"
  | "fundraising"
  | "legal_proceeding"
  | "other";

export type Part2RecordFlagReason =
  | "PART2_CONFIRMED"
  | "PENDING_SUD_CONTENT_REVIEW"
  | "PENDING_PART2_PROGRAM_REVIEW"
  | "PENDING_FEDERAL_ASSISTANCE_REVIEW";

export interface Part2RecordApplicabilityInput {
  containsSudDiagnosisTreatmentOrReferral?: boolean;
  maintainedByPart2Program?: boolean;
  federallyAssistedProgram?: boolean;
}

export interface Part2RecordFlag {
  status: "protected" | "pending_review";
  enforcement: "treat_as_part2";
  reasonCodes: Part2RecordFlagReason[];
}

/**
 * A record is never automatically marked unprotected. Unresolved or negative source
 * facts require privacy review and are enforced as Part 2 in the meantime.
 */
export function classifyPart2Record(input: Part2RecordApplicabilityInput): Part2RecordFlag {
  if (
    input.containsSudDiagnosisTreatmentOrReferral === true
    && input.maintainedByPart2Program === true
    && input.federallyAssistedProgram === true
  ) {
    return {
      status: "protected",
      enforcement: "treat_as_part2",
      reasonCodes: ["PART2_CONFIRMED"],
    };
  }

  const reasonCodes: Part2RecordFlagReason[] = [];
  if (input.containsSudDiagnosisTreatmentOrReferral !== true) {
    reasonCodes.push("PENDING_SUD_CONTENT_REVIEW");
  }
  if (input.maintainedByPart2Program !== true) {
    reasonCodes.push("PENDING_PART2_PROGRAM_REVIEW");
  }
  if (input.federallyAssistedProgram !== true) {
    reasonCodes.push("PENDING_FEDERAL_ASSISTANCE_REVIEW");
  }

  return { status: "pending_review", enforcement: "treat_as_part2", reasonCodes };
}

export type Part2ConsentExpiration =
  | { kind: "date"; expiresAt: string }
  | { kind: "event"; description: string; occurredAt?: string }
  | { kind: "none_for_tpo" };

export interface Part2RecipientDesignation {
  namesOrClasses: string[];
  intermediary?: {
    name: string;
    memberParticipants?: string[];
    participantClass?: string;
    participantClassLimitedToTreatingProviders?: boolean;
  };
  coveredEntityOrBusinessAssociateForTpo?: boolean;
  hipaaRedisclosureStatementIncluded?: boolean;
}

export interface Part2Consent {
  consentId: string;
  patientId: string;
  patientName: string;
  authorizedDisclosers: string[];
  informationDescription: string;
  authorizedCategories: Part2DataCategory[];
  recipientDesignation: Part2RecipientDesignation;
  purposeDescription: string;
  purposeCodes: Part2Purpose[];
  revocationRightStatement: string;
  revocationMethod: string;
  expiration: Part2ConsentExpiration;
  signature: {
    signerName: string;
    signedAt: string;
    capacity: "patient" | "authorized_representative";
    authorityReference?: string;
  };
  tpoStatements?: {
    potentialRedisclosureStatementIncluded: boolean;
    refusalConsequencesStatementIncluded: boolean;
  };
  fundraisingOptOutStatementIncluded?: boolean;
  revokedAt?: string;
  knownMateriallyFalse?: boolean;
}

export type Part2ConsentIssue =
  | "CONSENT_EVALUATION_TIMESTAMP_INVALID"
  | "CONSENT_ID_MISSING"
  | "CONSENT_PATIENT_ID_MISSING"
  | "CONSENT_PATIENT_NAME_MISSING"
  | "CONSENT_AUTHORIZED_DISCLOSER_MISSING"
  | "CONSENT_INFORMATION_DESCRIPTION_MISSING"
  | "CONSENT_INFORMATION_CATEGORIES_MISSING"
  | "CONSENT_RECIPIENT_MISSING"
  | "CONSENT_INTERMEDIARY_NAME_MISSING"
  | "CONSENT_INTERMEDIARY_PARTICIPANTS_MISSING"
  | "CONSENT_INTERMEDIARY_CLASS_NOT_LIMITED_TO_TREATING_PROVIDERS"
  | "CONSENT_HIPAA_REDISCLOSURE_STATEMENT_MISSING"
  | "CONSENT_PURPOSE_MISSING"
  | "CONSENT_REVOCATION_RIGHT_MISSING"
  | "CONSENT_REVOCATION_METHOD_MISSING"
  | "CONSENT_EXPIRATION_MISSING_OR_INVALID"
  | "CONSENT_EXPIRED"
  | "CONSENT_SIGNATURE_MISSING"
  | "CONSENT_SIGNED_AT_INVALID"
  | "CONSENT_SIGNED_IN_FUTURE"
  | "CONSENT_REPRESENTATIVE_AUTHORITY_MISSING"
  | "CONSENT_TPO_REDISCLOSURE_WARNING_MISSING"
  | "CONSENT_TPO_REFUSAL_CONSEQUENCES_MISSING"
  | "CONSENT_FUNDRAISING_OPT_OUT_MISSING"
  | "CONSENT_COUNSELING_NOTES_NOT_SEPARATE"
  | "CONSENT_PROCEEDING_PURPOSE_NOT_SEPARATE"
  | "CONSENT_REVOCATION_TIMESTAMP_INVALID"
  | "CONSENT_REVOKED"
  | "CONSENT_KNOWN_MATERIALLY_FALSE";

export interface Part2ConsentValidationResult {
  valid: boolean;
  consentId: string;
  issues: Part2ConsentIssue[];
}

const TPO_PURPOSES = new Set<Part2Purpose>([
  "treatment",
  "payment",
  "health_care_operations",
]);

const hasText = (value: string | undefined): value is string =>
  typeof value === "string" && value.trim().length > 0;

const instant = (value: string | undefined): number | null => {
  if (!hasText(value)) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const unique = <T extends string>(values: T[]): T[] => [...new Set(values)];

const includesAll = <T extends string>(allowed: readonly T[], requested: readonly T[]): boolean => {
  const allowedSet = new Set(allowed);
  return requested.every((item) => allowedSet.has(item));
};

const isTpoOnly = (purposes: readonly Part2Purpose[]): boolean =>
  purposes.length > 0 && purposes.every((purpose) => TPO_PURPOSES.has(purpose));

const hasTpoPurpose = (purposes: readonly Part2Purpose[]): boolean =>
  purposes.some((purpose) => TPO_PURPOSES.has(purpose));

export function validatePart2Consent(
  consent: Part2Consent,
  evaluatedAt: string,
): Part2ConsentValidationResult {
  const issues: Part2ConsentIssue[] = [];
  const evaluatedAtMs = instant(evaluatedAt);

  if (evaluatedAtMs === null) issues.push("CONSENT_EVALUATION_TIMESTAMP_INVALID");
  if (!hasText(consent.consentId)) issues.push("CONSENT_ID_MISSING");
  if (!hasText(consent.patientId)) issues.push("CONSENT_PATIENT_ID_MISSING");
  if (!hasText(consent.patientName)) issues.push("CONSENT_PATIENT_NAME_MISSING");
  if (!consent.authorizedDisclosers.some(hasText)) {
    issues.push("CONSENT_AUTHORIZED_DISCLOSER_MISSING");
  }
  if (!hasText(consent.informationDescription)) {
    issues.push("CONSENT_INFORMATION_DESCRIPTION_MISSING");
  }
  if (consent.authorizedCategories.length === 0) {
    issues.push("CONSENT_INFORMATION_CATEGORIES_MISSING");
  }
  if (!consent.recipientDesignation.namesOrClasses.some(hasText)) {
    issues.push("CONSENT_RECIPIENT_MISSING");
  }

  const intermediary = consent.recipientDesignation.intermediary;
  if (intermediary) {
    if (!hasText(intermediary.name)) issues.push("CONSENT_INTERMEDIARY_NAME_MISSING");
    const hasNamedParticipants = intermediary.memberParticipants?.some(hasText) === true;
    const hasParticipantClass = hasText(intermediary.participantClass);
    if (!hasNamedParticipants && !hasParticipantClass) {
      issues.push("CONSENT_INTERMEDIARY_PARTICIPANTS_MISSING");
    }
    if (hasParticipantClass && intermediary.participantClassLimitedToTreatingProviders !== true) {
      issues.push("CONSENT_INTERMEDIARY_CLASS_NOT_LIMITED_TO_TREATING_PROVIDERS");
    }
  }

  const tpoConsent = hasTpoPurpose(consent.purposeCodes);
  if (
    tpoConsent
    && consent.recipientDesignation.coveredEntityOrBusinessAssociateForTpo === true
    && consent.recipientDesignation.hipaaRedisclosureStatementIncluded !== true
  ) {
    issues.push("CONSENT_HIPAA_REDISCLOSURE_STATEMENT_MISSING");
  }

  if (!hasText(consent.purposeDescription) || consent.purposeCodes.length === 0) {
    issues.push("CONSENT_PURPOSE_MISSING");
  }
  if (!hasText(consent.revocationRightStatement)) {
    issues.push("CONSENT_REVOCATION_RIGHT_MISSING");
  }
  if (!hasText(consent.revocationMethod)) issues.push("CONSENT_REVOCATION_METHOD_MISSING");

  if (consent.expiration.kind === "date") {
    const expiresAtMs = instant(consent.expiration.expiresAt);
    if (expiresAtMs === null) {
      issues.push("CONSENT_EXPIRATION_MISSING_OR_INVALID");
    } else if (evaluatedAtMs !== null && expiresAtMs <= evaluatedAtMs) {
      issues.push("CONSENT_EXPIRED");
    }
  } else if (consent.expiration.kind === "event") {
    if (!hasText(consent.expiration.description)) {
      issues.push("CONSENT_EXPIRATION_MISSING_OR_INVALID");
    }
    if (consent.expiration.occurredAt !== undefined) {
      const occurredAtMs = instant(consent.expiration.occurredAt);
      if (occurredAtMs === null) {
        issues.push("CONSENT_EXPIRATION_MISSING_OR_INVALID");
      } else if (evaluatedAtMs !== null && occurredAtMs <= evaluatedAtMs) {
        issues.push("CONSENT_EXPIRED");
      }
    }
  } else if (!isTpoOnly(consent.purposeCodes)) {
    issues.push("CONSENT_EXPIRATION_MISSING_OR_INVALID");
  }

  if (!hasText(consent.signature.signerName)) issues.push("CONSENT_SIGNATURE_MISSING");
  const signedAtMs = instant(consent.signature.signedAt);
  if (signedAtMs === null) {
    issues.push("CONSENT_SIGNED_AT_INVALID");
  } else if (evaluatedAtMs !== null && signedAtMs > evaluatedAtMs) {
    issues.push("CONSENT_SIGNED_IN_FUTURE");
  }
  if (
    consent.signature.capacity === "authorized_representative"
    && !hasText(consent.signature.authorityReference)
  ) {
    issues.push("CONSENT_REPRESENTATIVE_AUTHORITY_MISSING");
  }

  if (tpoConsent) {
    if (consent.tpoStatements?.potentialRedisclosureStatementIncluded !== true) {
      issues.push("CONSENT_TPO_REDISCLOSURE_WARNING_MISSING");
    }
    if (consent.tpoStatements?.refusalConsequencesStatementIncluded !== true) {
      issues.push("CONSENT_TPO_REFUSAL_CONSEQUENCES_MISSING");
    }
  }
  if (
    consent.purposeCodes.includes("fundraising")
    && consent.fundraisingOptOutStatementIncluded !== true
  ) {
    issues.push("CONSENT_FUNDRAISING_OPT_OUT_MISSING");
  }

  if (
    consent.authorizedCategories.includes("sud_counseling_notes")
    && consent.authorizedCategories.some((category) => category !== "sud_counseling_notes")
  ) {
    issues.push("CONSENT_COUNSELING_NOTES_NOT_SEPARATE");
  }
  if (
    consent.purposeCodes.includes("legal_proceeding")
    && consent.purposeCodes.some((purpose) => purpose !== "legal_proceeding")
  ) {
    issues.push("CONSENT_PROCEEDING_PURPOSE_NOT_SEPARATE");
  }

  if (consent.revokedAt !== undefined) {
    const revokedAtMs = instant(consent.revokedAt);
    if (revokedAtMs === null) {
      issues.push("CONSENT_REVOCATION_TIMESTAMP_INVALID");
    } else if (evaluatedAtMs !== null && revokedAtMs <= evaluatedAtMs) {
      issues.push("CONSENT_REVOKED");
    }
  }
  if (consent.knownMateriallyFalse === true) issues.push("CONSENT_KNOWN_MATERIALLY_FALSE");

  const normalizedIssues = unique(issues);
  return {
    valid: normalizedIssues.length === 0,
    consentId: consent.consentId,
    issues: normalizedIssues,
  };
}

export type Part2DecisionReason =
  | "ALLOW_PART2_ACCESS"
  | "ALLOW_CONSENT_DISCLOSURE"
  | "ALLOW_MEDICAL_EMERGENCY_DISCLOSURE"
  | "DENY_AUDIT_METADATA_INVALID"
  | "DENY_IDENTITY_NOT_VERIFIED"
  | "DENY_PART2_AUTHORIZATION_MISSING"
  | "DENY_PENDING_REVIEW_ACCESS_NOT_APPROVED"
  | "DENY_PURPOSE_NOT_APPROVED"
  | "DENY_REQUESTED_CATEGORIES_MISSING"
  | "DENY_CATEGORY_NOT_APPROVED"
  | "DENY_MINIMUM_NECESSARY_POLICY_MISSING"
  | "DENY_MINIMUM_NECESSARY_EXCEEDED"
  | "DENY_ENTIRE_RECORD_NOT_JUSTIFIED"
  | "DENY_CONSENT_INVALID"
  | "DENY_CONSENT_PATIENT_MISMATCH"
  | "DENY_DISCLOSER_NOT_CONSENTED"
  | "DENY_RECIPIENT_NOT_CONSENTED"
  | "DENY_PURPOSE_NOT_CONSENTED"
  | "DENY_CATEGORY_NOT_CONSENTED"
  | "DENY_NOTICE_MISSING_OR_INVALID"
  | "DENY_CONSENT_SCOPE_ACCOMPANIMENT_MISSING"
  | "DENY_REDISCLOSURE_NOT_PERMITTED"
  | "DENY_MEDICAL_EMERGENCY_RECORD_INVALID"
  | "DENY_MEDICAL_EMERGENCY_CONTEXT_MISMATCH"
  | "MANUAL_LOG_NOT_AUTHORIZATION";

export type Part2LegalBasis =
  | "workforce_authorization"
  | "written_consent"
  | "medical_emergency"
  | "manual_log";

export type Part2RedisclosureRule =
  | "HIPAA_TPO_EXCEPT_PATIENT_PROCEEDINGS"
  | "CONSISTENT_WITH_CONSENT_ONLY"
  | "NECESSARY_CONTRACTORS_FOR_PAYMENT_OR_OPERATIONS_ONLY"
  | "NO_REDISCLOSURE_UNLESS_SEPARATELY_PERMITTED"
  | "PART2_EXCEPTION_LIMITED_NO_GENERAL_REDISCLOSURE";

export type Part2Transport =
  | "electronic_health_record"
  | "other_electronic"
  | "paper"
  | "oral";

export interface Part2DecisionAuditEvent {
  eventId: string;
  occurredAt: string;
  action: "access" | "disclosure";
  outcome: "allowed" | "denied";
  actorId: string;
  patientId: string;
  recordId: string;
  recordStatus: Part2RecordFlag["status"];
  legalBasis: Part2LegalBasis;
  purpose: Part2Purpose;
  requestedCategories: Part2DataCategory[];
  reasonCodes: Part2DecisionReason[];
  authorizationReference?: string;
  consentId?: string;
  emergencyExceptionId?: string;
  recipientName?: string;
  recipientAddress?: string;
  informationDescription?: string;
  noticeAccompanied?: boolean;
  consentScopeAccompanied?: boolean;
  redisclosureRule?: Part2RedisclosureRule;
  transport?: Part2Transport;
}

export interface Part2DecisionResult {
  allowed: boolean;
  reasonCodes: Part2DecisionReason[];
  audit: Part2DecisionAuditEvent;
  redisclosureRule?: Part2RedisclosureRule;
}

export interface Part2AccessInput {
  eventId: string;
  occurredAt: string;
  actorId: string;
  patientId: string;
  recordId: string;
  recordFlag: Part2RecordFlag;
  identityVerified: boolean;
  purpose: Part2Purpose;
  requestedCategories: Part2DataCategory[];
  authorization?: {
    reference: string;
    allowedPurposes: Part2Purpose[];
    allowedCategories: Part2DataCategory[];
    pendingReviewAccessApproved?: boolean;
    entireRecordJustification?: string;
  };
}

const hasValidAuditMetadata = (input: {
  eventId: string;
  occurredAt: string;
  actorId: string;
  patientId: string;
  recordId: string;
}): boolean =>
  hasText(input.eventId)
  && instant(input.occurredAt) !== null
  && hasText(input.actorId)
  && hasText(input.patientId)
  && hasText(input.recordId);

export function evaluatePart2Access(input: Part2AccessInput): Part2DecisionResult {
  const reasons: Part2DecisionReason[] = [];
  if (!hasValidAuditMetadata(input)) reasons.push("DENY_AUDIT_METADATA_INVALID");
  if (!input.identityVerified) reasons.push("DENY_IDENTITY_NOT_VERIFIED");
  if (!input.authorization || !hasText(input.authorization.reference)) {
    reasons.push("DENY_PART2_AUTHORIZATION_MISSING");
  }
  if (
    input.recordFlag.status === "pending_review"
    && input.authorization?.pendingReviewAccessApproved !== true
  ) {
    reasons.push("DENY_PENDING_REVIEW_ACCESS_NOT_APPROVED");
  }
  if (input.authorization && !input.authorization.allowedPurposes.includes(input.purpose)) {
    reasons.push("DENY_PURPOSE_NOT_APPROVED");
  }
  if (input.requestedCategories.length === 0) {
    reasons.push("DENY_REQUESTED_CATEGORIES_MISSING");
  } else if (
    input.authorization
    && !includesAll(input.authorization.allowedCategories, input.requestedCategories)
  ) {
    reasons.push("DENY_CATEGORY_NOT_APPROVED");
  }
  if (
    input.requestedCategories.includes("entire_record")
    && !hasText(input.authorization?.entireRecordJustification)
  ) {
    reasons.push("DENY_ENTIRE_RECORD_NOT_JUSTIFIED");
  }

  const deniedReasons = unique(reasons);
  const allowed = deniedReasons.length === 0;
  const reasonCodes = allowed ? ["ALLOW_PART2_ACCESS" as const] : deniedReasons;
  return {
    allowed,
    reasonCodes,
    audit: {
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      action: "access",
      outcome: allowed ? "allowed" : "denied",
      actorId: input.actorId,
      patientId: input.patientId,
      recordId: input.recordId,
      recordStatus: input.recordFlag.status,
      legalBasis: "workforce_authorization",
      purpose: input.purpose,
      requestedCategories: unique(input.requestedCategories),
      reasonCodes,
      authorizationReference: input.authorization?.reference,
    },
  };
}

export type Part2RecipientType =
  | "covered_entity"
  | "business_associate"
  | "part2_program_non_hipaa"
  | "non_hipaa_lawful_holder"
  | "medical_personnel"
  | "other";

export type Part2RedisclosureIntent =
  | "none"
  | "hipaa_tpo"
  | "consistent_with_consent"
  | "contractor_for_payment_or_operations"
  | "proceeding_against_patient";

export interface Part2MedicalEmergencyException {
  exceptionId: string;
  patientId: string;
  recordId: string;
  disclosureAt: string;
  recipientMedicalPersonnelName: string;
  recipientAffiliation: string;
  disclosedBy: string;
  natureOfEmergency: string;
  bonaFideMedicalEmergency: boolean;
  priorWrittenConsentCouldNotBeObtained: boolean;
  documentedAt: string;
  documentedImmediatelyFollowingDisclosure: boolean;
}

export type Part2MedicalEmergencyIssue =
  | "EMERGENCY_EXCEPTION_ID_MISSING"
  | "EMERGENCY_PATIENT_ID_MISSING"
  | "EMERGENCY_RECORD_ID_MISSING"
  | "EMERGENCY_NOT_BONA_FIDE"
  | "EMERGENCY_PRIOR_CONSENT_COULD_BE_OBTAINED"
  | "EMERGENCY_MEDICAL_PERSONNEL_MISSING"
  | "EMERGENCY_AFFILIATION_MISSING"
  | "EMERGENCY_DISCLOSER_MISSING"
  | "EMERGENCY_DISCLOSURE_TIMESTAMP_INVALID"
  | "EMERGENCY_NATURE_MISSING"
  | "EMERGENCY_DOCUMENTATION_TIMESTAMP_INVALID"
  | "EMERGENCY_DOCUMENTED_BEFORE_DISCLOSURE"
  | "EMERGENCY_NOT_DOCUMENTED_IMMEDIATELY";

export interface Part2MedicalEmergencyValidationResult {
  valid: boolean;
  issues: Part2MedicalEmergencyIssue[];
}

export function validateMedicalEmergencyException(
  exception: Part2MedicalEmergencyException,
): Part2MedicalEmergencyValidationResult {
  const issues: Part2MedicalEmergencyIssue[] = [];
  if (!hasText(exception.exceptionId)) issues.push("EMERGENCY_EXCEPTION_ID_MISSING");
  if (!hasText(exception.patientId)) issues.push("EMERGENCY_PATIENT_ID_MISSING");
  if (!hasText(exception.recordId)) issues.push("EMERGENCY_RECORD_ID_MISSING");
  if (!exception.bonaFideMedicalEmergency) issues.push("EMERGENCY_NOT_BONA_FIDE");
  if (!exception.priorWrittenConsentCouldNotBeObtained) {
    issues.push("EMERGENCY_PRIOR_CONSENT_COULD_BE_OBTAINED");
  }
  if (!hasText(exception.recipientMedicalPersonnelName)) {
    issues.push("EMERGENCY_MEDICAL_PERSONNEL_MISSING");
  }
  if (!hasText(exception.recipientAffiliation)) issues.push("EMERGENCY_AFFILIATION_MISSING");
  if (!hasText(exception.disclosedBy)) issues.push("EMERGENCY_DISCLOSER_MISSING");
  const disclosureAtMs = instant(exception.disclosureAt);
  if (disclosureAtMs === null) issues.push("EMERGENCY_DISCLOSURE_TIMESTAMP_INVALID");
  if (!hasText(exception.natureOfEmergency)) issues.push("EMERGENCY_NATURE_MISSING");
  const documentedAtMs = instant(exception.documentedAt);
  if (documentedAtMs === null) {
    issues.push("EMERGENCY_DOCUMENTATION_TIMESTAMP_INVALID");
  } else if (disclosureAtMs !== null && documentedAtMs < disclosureAtMs) {
    issues.push("EMERGENCY_DOCUMENTED_BEFORE_DISCLOSURE");
  }
  if (!exception.documentedImmediatelyFollowingDisclosure) {
    issues.push("EMERGENCY_NOT_DOCUMENTED_IMMEDIATELY");
  }
  const normalizedIssues = unique(issues);
  return { valid: normalizedIssues.length === 0, issues: normalizedIssues };
}

export interface Part2DisclosureInput {
  eventId: string;
  occurredAt: string;
  actorId: string;
  patientId: string;
  recordId: string;
  recordFlag: Part2RecordFlag;
  identityVerified: boolean;
  part2AuthorizationReference?: string;
  purpose: Part2Purpose;
  requestedCategories: Part2DataCategory[];
  minimumNecessary?: {
    policyReference: string;
    approvedCategories: Part2DataCategory[];
    entireRecordJustification?: string;
  };
  recipient: {
    name: string;
    designation: string;
    type: Part2RecipientType;
    address?: string;
  };
  transport: Part2Transport;
  intendedRedisclosure: Part2RedisclosureIntent;
  legalBasis:
    | {
        type: "written_consent";
        consent: Part2Consent;
        discloserDesignation: string;
        accompaniment?: {
          noticeText: string;
          consentCopyAttached: boolean;
          clearScopeExplanation?: string;
        };
      }
    | { type: "medical_emergency"; exception: Part2MedicalEmergencyException }
    | { type: "manual_log"; logReference?: string };
}

export function determinePart2RedisclosureRule(
  recipientType: Part2RecipientType,
  purpose: Part2Purpose,
): Part2RedisclosureRule {
  if (
    (recipientType === "covered_entity" || recipientType === "business_associate")
    && TPO_PURPOSES.has(purpose)
  ) {
    return "HIPAA_TPO_EXCEPT_PATIENT_PROCEEDINGS";
  }
  if (recipientType === "part2_program_non_hipaa" && TPO_PURPOSES.has(purpose)) {
    return "CONSISTENT_WITH_CONSENT_ONLY";
  }
  if (
    recipientType === "non_hipaa_lawful_holder"
    && (purpose === "payment" || purpose === "health_care_operations")
  ) {
    return "NECESSARY_CONTRACTORS_FOR_PAYMENT_OR_OPERATIONS_ONLY";
  }
  return "NO_REDISCLOSURE_UNLESS_SEPARATELY_PERMITTED";
}

const redisclosureIntentAllowed = (
  rule: Part2RedisclosureRule,
  intent: Part2RedisclosureIntent,
): boolean => {
  if (intent === "none") return true;
  if (intent === "proceeding_against_patient") return false;
  if (rule === "HIPAA_TPO_EXCEPT_PATIENT_PROCEEDINGS") return intent === "hipaa_tpo";
  if (rule === "CONSISTENT_WITH_CONSENT_ONLY") return intent === "consistent_with_consent";
  if (rule === "NECESSARY_CONTRACTORS_FOR_PAYMENT_OR_OPERATIONS_ONLY") {
    return intent === "contractor_for_payment_or_operations";
  }
  return false;
};

export function evaluatePart2Disclosure(input: Part2DisclosureInput): Part2DecisionResult {
  const reasons: Part2DecisionReason[] = [];
  if (!hasValidAuditMetadata(input) || !hasText(input.recipient.name)) {
    reasons.push("DENY_AUDIT_METADATA_INVALID");
  }
  if (!input.identityVerified) reasons.push("DENY_IDENTITY_NOT_VERIFIED");
  if (!hasText(input.part2AuthorizationReference)) {
    reasons.push("DENY_PART2_AUTHORIZATION_MISSING");
  }
  if (input.requestedCategories.length === 0) {
    reasons.push("DENY_REQUESTED_CATEGORIES_MISSING");
  }
  if (!input.minimumNecessary || !hasText(input.minimumNecessary.policyReference)) {
    reasons.push("DENY_MINIMUM_NECESSARY_POLICY_MISSING");
  } else if (!includesAll(input.minimumNecessary.approvedCategories, input.requestedCategories)) {
    reasons.push("DENY_MINIMUM_NECESSARY_EXCEEDED");
  }
  if (
    input.requestedCategories.includes("entire_record")
    && !hasText(input.minimumNecessary?.entireRecordJustification)
  ) {
    reasons.push("DENY_ENTIRE_RECORD_NOT_JUSTIFIED");
  }

  let consentId: string | undefined;
  let emergencyExceptionId: string | undefined;
  let noticeAccompanied: boolean | undefined;
  let consentScopeAccompanied: boolean | undefined;
  let redisclosureRule: Part2RedisclosureRule;

  if (input.legalBasis.type === "manual_log") {
    reasons.push("MANUAL_LOG_NOT_AUTHORIZATION");
    redisclosureRule = "NO_REDISCLOSURE_UNLESS_SEPARATELY_PERMITTED";
  } else if (input.legalBasis.type === "medical_emergency") {
    const emergency = input.legalBasis.exception;
    emergencyExceptionId = emergency.exceptionId;
    const emergencyValidation = validateMedicalEmergencyException(emergency);
    if (!emergencyValidation.valid || input.recipient.type !== "medical_personnel") {
      reasons.push("DENY_MEDICAL_EMERGENCY_RECORD_INVALID");
    }
    if (
      emergency.patientId !== input.patientId
      || emergency.recordId !== input.recordId
      || emergency.disclosedBy !== input.actorId
      || emergency.disclosureAt !== input.occurredAt
      || emergency.recipientMedicalPersonnelName !== input.recipient.name
      || emergency.recipientAffiliation !== input.recipient.designation
    ) {
      reasons.push("DENY_MEDICAL_EMERGENCY_CONTEXT_MISMATCH");
    }
    if (input.intendedRedisclosure !== "none") {
      reasons.push("DENY_REDISCLOSURE_NOT_PERMITTED");
    }
    redisclosureRule = "PART2_EXCEPTION_LIMITED_NO_GENERAL_REDISCLOSURE";
  } else {
    const consent = input.legalBasis.consent;
    consentId = consent.consentId;
    const validation = validatePart2Consent(consent, input.occurredAt);
    if (!validation.valid) reasons.push("DENY_CONSENT_INVALID");
    if (consent.patientId !== input.patientId) reasons.push("DENY_CONSENT_PATIENT_MISMATCH");
    if (!consent.authorizedDisclosers.includes(input.legalBasis.discloserDesignation)) {
      reasons.push("DENY_DISCLOSER_NOT_CONSENTED");
    }
    if (!consent.recipientDesignation.namesOrClasses.includes(input.recipient.designation)) {
      reasons.push("DENY_RECIPIENT_NOT_CONSENTED");
    }
    if (!consent.purposeCodes.includes(input.purpose)) reasons.push("DENY_PURPOSE_NOT_CONSENTED");
    if (!includesAll(consent.authorizedCategories, input.requestedCategories)) {
      reasons.push("DENY_CATEGORY_NOT_CONSENTED");
    }

    const accompaniment = input.legalBasis.accompaniment;
    noticeAccompanied = accompaniment?.noticeText === PART2_NOTICE_STATEMENT_2;
    consentScopeAccompanied = accompaniment !== undefined
      && (accompaniment.consentCopyAttached || hasText(accompaniment.clearScopeExplanation));
    if (!noticeAccompanied) reasons.push("DENY_NOTICE_MISSING_OR_INVALID");
    if (!consentScopeAccompanied) {
      reasons.push("DENY_CONSENT_SCOPE_ACCOMPANIMENT_MISSING");
    }

    redisclosureRule = determinePart2RedisclosureRule(input.recipient.type, input.purpose);
    if (!redisclosureIntentAllowed(redisclosureRule, input.intendedRedisclosure)) {
      reasons.push("DENY_REDISCLOSURE_NOT_PERMITTED");
    }
  }

  const deniedReasons = unique(reasons);
  const allowed = deniedReasons.length === 0;
  const allowCode: Part2DecisionReason = input.legalBasis.type === "medical_emergency"
    ? "ALLOW_MEDICAL_EMERGENCY_DISCLOSURE"
    : "ALLOW_CONSENT_DISCLOSURE";
  const reasonCodes = allowed ? [allowCode] : deniedReasons;
  const legalBasis: Part2LegalBasis = input.legalBasis.type;

  return {
    allowed,
    reasonCodes,
    redisclosureRule,
    audit: {
      eventId: input.eventId,
      occurredAt: input.occurredAt,
      action: "disclosure",
      outcome: allowed ? "allowed" : "denied",
      actorId: input.actorId,
      patientId: input.patientId,
      recordId: input.recordId,
      recordStatus: input.recordFlag.status,
      legalBasis,
      purpose: input.purpose,
      requestedCategories: unique(input.requestedCategories),
      reasonCodes,
      authorizationReference: input.part2AuthorizationReference,
      consentId,
      emergencyExceptionId,
      recipientName: input.recipient.name,
      recipientAddress: input.recipient.address,
      informationDescription: unique(input.requestedCategories).join(", "),
      noticeAccompanied,
      consentScopeAccompanied,
      redisclosureRule,
      transport: input.transport,
    },
  };
}

export interface Part2ManualDisclosureLogInput {
  logId: string;
  loggedAt: string;
  loggedBy: string;
  patientId: string;
  recordId: string;
  claimedDisclosureAt: string;
  recipientName: string;
  purpose: Part2Purpose;
  categories: Part2DataCategory[];
  note: string;
}

export interface Part2ManualDisclosureLog {
  recordType: "manual_supplemental_log";
  authorizationGranted: false;
  reasonCode: "MANUAL_LOG_NOT_AUTHORIZATION";
  data: Part2ManualDisclosureLogInput;
}

/** A manual log is evidence only; it can never be used as a disclosure basis. */
export function createManualDisclosureLog(
  input: Part2ManualDisclosureLogInput,
): Part2ManualDisclosureLog {
  return {
    recordType: "manual_supplemental_log",
    authorizationGranted: false,
    reasonCode: "MANUAL_LOG_NOT_AUTHORIZATION",
    data: { ...input, categories: unique(input.categories) },
  };
}

export type Part2AccountingIssue =
  | "ACCOUNTING_REQUEST_TIMESTAMP_INVALID"
  | "ACCOUNTING_PATIENT_ID_MISSING"
  | "ACCOUNTING_START_TIMESTAMP_INVALID"
  | "ACCOUNTING_START_AFTER_REQUEST"
  | "ACCOUNTING_PERIOD_EXCEEDS_THREE_YEARS";

export interface Part2AccountingEntry {
  eventId: string;
  disclosedAt: string;
  recipientName: string;
  recipientAddress?: string;
  informationDescription: string;
  purpose: Part2Purpose;
  consentId: string;
  transport: Part2Transport;
}

export interface Part2AccountingResult {
  valid: boolean;
  issues: Part2AccountingIssue[];
  patientId: string;
  requestedAt: string;
  windowStart: string | null;
  entries: Part2AccountingEntry[];
}

const subtractUtcYears = (timestamp: number, years: number): number => {
  const date = new Date(timestamp);
  const originalMonth = date.getUTCMonth();
  date.setUTCFullYear(date.getUTCFullYear() - years);
  if (date.getUTCMonth() !== originalMonth) date.setUTCDate(0);
  return date.getTime();
};

const isTpoPurpose = (purpose: Part2Purpose): boolean => TPO_PURPOSES.has(purpose);

/**
 * Returns consent disclosures in the requested period, capped at the preceding three
 * years. Under 42 CFR 2.25(b), TPO disclosures are included only when made through an
 * electronic health record. Denials, access events, emergencies, and manual logs stay
 * in the audit trail but do not become entries in this consent-disclosure accounting.
 */
export function queryThreeYearPart2Accounting(
  events: readonly Part2DecisionAuditEvent[],
  request: { patientId: string; requestedAt: string; startAt?: string },
): Part2AccountingResult {
  const issues: Part2AccountingIssue[] = [];
  const requestedAtMs = instant(request.requestedAt);
  if (requestedAtMs === null) issues.push("ACCOUNTING_REQUEST_TIMESTAMP_INVALID");
  if (!hasText(request.patientId)) issues.push("ACCOUNTING_PATIENT_ID_MISSING");

  const regulatoryStartMs = requestedAtMs === null ? null : subtractUtcYears(requestedAtMs, 3);
  let startAtMs = regulatoryStartMs;
  if (request.startAt !== undefined) {
    startAtMs = instant(request.startAt);
    if (startAtMs === null) {
      issues.push("ACCOUNTING_START_TIMESTAMP_INVALID");
    } else if (requestedAtMs !== null && startAtMs > requestedAtMs) {
      issues.push("ACCOUNTING_START_AFTER_REQUEST");
    } else if (regulatoryStartMs !== null && startAtMs < regulatoryStartMs) {
      issues.push("ACCOUNTING_PERIOD_EXCEEDS_THREE_YEARS");
    }
  }

  if (issues.length > 0 || requestedAtMs === null || startAtMs === null) {
    return {
      valid: false,
      issues: unique(issues),
      patientId: request.patientId,
      requestedAt: request.requestedAt,
      windowStart: regulatoryStartMs === null ? null : new Date(regulatoryStartMs).toISOString(),
      entries: [],
    };
  }

  const entries = events
    .filter((event) => {
      if (
        event.patientId !== request.patientId
        || event.action !== "disclosure"
        || event.outcome !== "allowed"
        || event.legalBasis !== "written_consent"
        || !event.consentId
        || !event.recipientName
        || !event.transport
      ) return false;
      const occurredAtMs = instant(event.occurredAt);
      if (occurredAtMs === null || occurredAtMs < startAtMs || occurredAtMs > requestedAtMs) {
        return false;
      }
      return !isTpoPurpose(event.purpose) || event.transport === "electronic_health_record";
    })
    .map((event): Part2AccountingEntry => ({
      eventId: event.eventId,
      disclosedAt: event.occurredAt,
      recipientName: event.recipientName!,
      recipientAddress: event.recipientAddress,
      informationDescription: event.informationDescription
        ?? event.requestedCategories.join(", "),
      purpose: event.purpose,
      consentId: event.consentId!,
      transport: event.transport!,
    }))
    .sort((left, right) =>
      left.disclosedAt.localeCompare(right.disclosedAt) || left.eventId.localeCompare(right.eventId));

  return {
    valid: true,
    issues: [],
    patientId: request.patientId,
    requestedAt: request.requestedAt,
    windowStart: new Date(startAtMs).toISOString(),
    entries,
  };
}
