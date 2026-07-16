import { describe, expect, it } from "vitest";
import {
  PART2_NOTICE_STATEMENT_2,
  PART2_REGULATORY_SOURCES,
  classifyPart2Record,
  createManualDisclosureLog,
  determinePart2RedisclosureRule,
  evaluatePart2Access,
  evaluatePart2Disclosure,
  queryThreeYearPart2Accounting,
  validateMedicalEmergencyException,
  validatePart2Consent,
  type Part2Consent,
  type Part2DecisionAuditEvent,
  type Part2DisclosureInput,
  type Part2MedicalEmergencyException,
} from "../../contracts/regulatory/part2";

const NOW = "2026-07-14T15:00:00.000Z";

const protectedRecord = classifyPart2Record({
  containsSudDiagnosisTreatmentOrReferral: true,
  maintainedByPart2Program: true,
  federallyAssistedProgram: true,
});

const makeConsent = (overrides: Partial<Part2Consent> = {}): Part2Consent => ({
  consentId: "consent-synthetic-001",
  patientId: "patient-synthetic-001",
  patientName: "Synthetic Patient",
  authorizedDisclosers: ["Adolbi Part 2 Program"],
  informationDescription: "Diagnosis and treatment-plan summary",
  authorizedCategories: ["diagnosis", "treatment_plan"],
  recipientDesignation: {
    namesOrClasses: ["Synthetic Treating Provider"],
    coveredEntityOrBusinessAssociateForTpo: true,
    hipaaRedisclosureStatementIncluded: true,
  },
  purposeDescription: "for treatment, payment, and health care operations",
  purposeCodes: ["treatment", "payment", "health_care_operations"],
  revocationRightStatement: "The patient may revoke this consent in writing.",
  revocationMethod: "Submit a signed revocation to the privacy office.",
  expiration: { kind: "date", expiresAt: "2027-07-14T15:00:00.000Z" },
  signature: {
    signerName: "Synthetic Patient",
    signedAt: "2026-01-10T12:00:00.000Z",
    capacity: "patient",
  },
  tpoStatements: {
    potentialRedisclosureStatementIncluded: true,
    refusalConsequencesStatementIncluded: true,
  },
  ...overrides,
});

const makeEmergency = (
  overrides: Partial<Part2MedicalEmergencyException> = {},
): Part2MedicalEmergencyException => ({
  exceptionId: "emergency-synthetic-001",
  patientId: "patient-synthetic-001",
  recordId: "record-synthetic-001",
  disclosureAt: NOW,
  recipientMedicalPersonnelName: "Synthetic Emergency Physician",
  recipientAffiliation: "Synthetic General Hospital",
  disclosedBy: "user-synthetic-privacy",
  natureOfEmergency: "Unresponsive patient; medication interaction must be assessed.",
  bonaFideMedicalEmergency: true,
  priorWrittenConsentCouldNotBeObtained: true,
  documentedAt: "2026-07-14T15:01:00.000Z",
  documentedImmediatelyFollowingDisclosure: true,
  ...overrides,
});

const makeDisclosure = (
  overrides: Partial<Part2DisclosureInput> = {},
): Part2DisclosureInput => ({
  eventId: "event-synthetic-disclosure-001",
  occurredAt: NOW,
  actorId: "user-synthetic-privacy",
  patientId: "patient-synthetic-001",
  recordId: "record-synthetic-001",
  recordFlag: protectedRecord,
  identityVerified: true,
  part2AuthorizationReference: "role-policy-part2-privacy-v1",
  purpose: "treatment",
  requestedCategories: ["diagnosis"],
  minimumNecessary: {
    policyReference: "minimum-necessary-treatment-summary-v1",
    approvedCategories: ["diagnosis", "treatment_plan"],
  },
  recipient: {
    name: "Synthetic Treating Provider",
    designation: "Synthetic Treating Provider",
    type: "covered_entity",
    address: "100 Synthetic Way, Example, TX",
  },
  transport: "electronic_health_record",
  intendedRedisclosure: "hipaa_tpo",
  legalBasis: {
    type: "written_consent",
    consent: makeConsent(),
    discloserDesignation: "Adolbi Part 2 Program",
    accompaniment: {
      noticeText: PART2_NOTICE_STATEMENT_2,
      consentCopyAttached: true,
    },
  },
  ...overrides,
});

const accountingEvent = (
  overrides: Partial<Part2DecisionAuditEvent> = {},
): Part2DecisionAuditEvent => ({
  eventId: "accounting-event-001",
  occurredAt: "2026-07-01T12:00:00.000Z",
  action: "disclosure",
  outcome: "allowed",
  actorId: "user-synthetic-privacy",
  patientId: "patient-synthetic-001",
  recordId: "record-synthetic-001",
  recordStatus: "protected",
  legalBasis: "written_consent",
  purpose: "treatment",
  requestedCategories: ["diagnosis"],
  reasonCodes: ["ALLOW_CONSENT_DISCLOSURE"],
  consentId: "consent-synthetic-001",
  recipientName: "Synthetic Treating Provider",
  recipientAddress: "100 Synthetic Way, Example, TX",
  informationDescription: "diagnosis",
  transport: "electronic_health_record",
  ...overrides,
});

describe("M1.2-06 regulatory source metadata", () => {
  it("pins official sources, verification dates, and current-through dates", () => {
    expect(PART2_REGULATORY_SOURCES).toHaveLength(5);
    expect(PART2_REGULATORY_SOURCES[0]).toMatchObject({
      url: "https://www.ecfr.gov/current/title-42/chapter-I/subchapter-A/part-2",
      currentThrough: "2026-07-10",
      effectiveDate: "2024-04-16",
      complianceDate: "2026-02-16",
      verifiedOn: "2026-07-14",
    });
    expect(PART2_REGULATORY_SOURCES[1]).toMatchObject({
      lastReviewed: "2026-01-30",
      verifiedOn: "2026-07-14",
    });
    expect(PART2_REGULATORY_SOURCES[2]).toMatchObject({
      publicationDate: "2024-02-16",
      effectiveDate: "2024-04-16",
      verifiedOn: "2026-07-14",
    });
    expect(PART2_REGULATORY_SOURCES[3]).toMatchObject({
      currentThrough: "2026-07-10",
      verifiedOn: "2026-07-14",
    });
    expect(PART2_NOTICE_STATEMENT_2).toBe(
      "42 CFR part 2 prohibits unauthorized use or disclosure of these records.",
    );
  });
});

describe("M1.2-06 protected and pending-review SUD flags", () => {
  it("marks records protected only when all applicability facts are affirmative", () => {
    expect(protectedRecord).toEqual({
      status: "protected",
      enforcement: "treat_as_part2",
      reasonCodes: ["PART2_CONFIRMED"],
    });
  });

  it("fails closed to pending review for missing, negative, or unresolved facts", () => {
    expect(classifyPart2Record({})).toEqual({
      status: "pending_review",
      enforcement: "treat_as_part2",
      reasonCodes: [
        "PENDING_SUD_CONTENT_REVIEW",
        "PENDING_PART2_PROGRAM_REVIEW",
        "PENDING_FEDERAL_ASSISTANCE_REVIEW",
      ],
    });
    expect(classifyPart2Record({
      containsSudDiagnosisTreatmentOrReferral: true,
      maintainedByPart2Program: false,
      federallyAssistedProgram: true,
    })).toMatchObject({
      status: "pending_review",
      enforcement: "treat_as_part2",
      reasonCodes: ["PENDING_PART2_PROGRAM_REVIEW"],
    });
  });
});

describe("M1.2-06 42 CFR 2.31 consent validity", () => {
  it("accepts a complete, unexpired TPO consent", () => {
    expect(validatePart2Consent(makeConsent(), NOW)).toEqual({
      valid: true,
      consentId: "consent-synthetic-001",
      issues: [],
    });
  });

  it("reports each missing core element with stable reason codes", () => {
    const result = validatePart2Consent(makeConsent({
      consentId: "",
      patientId: "",
      patientName: " ",
      authorizedDisclosers: [],
      informationDescription: "",
      authorizedCategories: [],
      recipientDesignation: { namesOrClasses: [] },
      purposeDescription: "",
      purposeCodes: [],
      revocationRightStatement: "",
      revocationMethod: "",
      expiration: { kind: "event", description: "" },
      signature: { signerName: "", signedAt: "not-a-time", capacity: "patient" },
      tpoStatements: undefined,
    }), "not-a-time");

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "CONSENT_EVALUATION_TIMESTAMP_INVALID",
      "CONSENT_ID_MISSING",
      "CONSENT_PATIENT_ID_MISSING",
      "CONSENT_PATIENT_NAME_MISSING",
      "CONSENT_AUTHORIZED_DISCLOSER_MISSING",
      "CONSENT_INFORMATION_DESCRIPTION_MISSING",
      "CONSENT_INFORMATION_CATEGORIES_MISSING",
      "CONSENT_RECIPIENT_MISSING",
      "CONSENT_PURPOSE_MISSING",
      "CONSENT_REVOCATION_RIGHT_MISSING",
      "CONSENT_REVOCATION_METHOD_MISSING",
      "CONSENT_EXPIRATION_MISSING_OR_INVALID",
      "CONSENT_SIGNATURE_MISSING",
      "CONSENT_SIGNED_AT_INVALID",
    ]));
  });

  it("rejects expired, revoked, future-signed, and materially false consents", () => {
    const result = validatePart2Consent(makeConsent({
      expiration: { kind: "date", expiresAt: "2026-07-14T14:59:59.000Z" },
      signature: {
        signerName: "Synthetic Patient",
        signedAt: "2026-07-14T15:01:00.000Z",
        capacity: "patient",
      },
      revokedAt: "2026-07-01T00:00:00.000Z",
      knownMateriallyFalse: true,
    }), NOW);
    expect(result.issues).toEqual(expect.arrayContaining([
      "CONSENT_EXPIRED",
      "CONSENT_SIGNED_IN_FUTURE",
      "CONSENT_REVOKED",
      "CONSENT_KNOWN_MATERIALLY_FALSE",
    ]));
  });

  it("allows no fixed expiration only for a TPO-only consent", () => {
    expect(validatePart2Consent(makeConsent({
      expiration: { kind: "none_for_tpo" },
    }), NOW).valid).toBe(true);
    expect(validatePart2Consent(makeConsent({
      purposeCodes: ["research"],
      purposeDescription: "Synthetic research",
      expiration: { kind: "none_for_tpo" },
      tpoStatements: undefined,
      recipientDesignation: { namesOrClasses: ["Synthetic Researcher"] },
    }), NOW).issues).toContain("CONSENT_EXPIRATION_MISSING_OR_INVALID");
  });

  it("enforces intermediary and covered-entity recipient instructions", () => {
    const result = validatePart2Consent(makeConsent({
      recipientDesignation: {
        namesOrClasses: ["Synthetic Exchange"],
        intermediary: {
          name: "Synthetic Exchange",
          participantClass: "All exchange members",
          participantClassLimitedToTreatingProviders: false,
        },
        coveredEntityOrBusinessAssociateForTpo: true,
        hipaaRedisclosureStatementIncluded: false,
      },
    }), NOW);
    expect(result.issues).toEqual(expect.arrayContaining([
      "CONSENT_INTERMEDIARY_CLASS_NOT_LIMITED_TO_TREATING_PROVIDERS",
      "CONSENT_HIPAA_REDISCLOSURE_STATEMENT_MISSING",
    ]));
  });

  it("requires the representative authority reference and TPO statements", () => {
    const result = validatePart2Consent(makeConsent({
      signature: {
        signerName: "Synthetic Representative",
        signedAt: "2026-01-10T12:00:00.000Z",
        capacity: "authorized_representative",
      },
      tpoStatements: {
        potentialRedisclosureStatementIncluded: false,
        refusalConsequencesStatementIncluded: false,
      },
    }), NOW);
    expect(result.issues).toEqual(expect.arrayContaining([
      "CONSENT_REPRESENTATIVE_AUTHORITY_MISSING",
      "CONSENT_TPO_REDISCLOSURE_WARNING_MISSING",
      "CONSENT_TPO_REFUSAL_CONSEQUENCES_MISSING",
    ]));
  });

  it("keeps SUD counseling-note and proceeding consents separate", () => {
    expect(validatePart2Consent(makeConsent({
      authorizedCategories: ["sud_counseling_notes", "diagnosis"],
    }), NOW).issues).toContain("CONSENT_COUNSELING_NOTES_NOT_SEPARATE");
    expect(validatePart2Consent(makeConsent({
      purposeCodes: ["legal_proceeding", "treatment"],
    }), NOW).issues).toContain("CONSENT_PROCEEDING_PURPOSE_NOT_SEPARATE");
  });

  it("requires a fundraising opt-out statement when fundraising is a purpose", () => {
    const result = validatePart2Consent(makeConsent({
      purposeCodes: ["fundraising"],
      purposeDescription: "Synthetic fundraising",
      expiration: { kind: "event", description: "end of synthetic campaign" },
      tpoStatements: undefined,
      recipientDesignation: { namesOrClasses: ["Adolbi Part 2 Program"] },
    }), NOW);
    expect(result.issues).toContain("CONSENT_FUNDRAISING_OPT_OUT_MISSING");
  });
});

describe("M1.2-06 access decisions and audit trails", () => {
  it("allows approved minimum access and emits an audit-ready allow event", () => {
    const result = evaluatePart2Access({
      eventId: "event-synthetic-access-001",
      occurredAt: NOW,
      actorId: "user-synthetic-clinician",
      patientId: "patient-synthetic-001",
      recordId: "record-synthetic-001",
      recordFlag: protectedRecord,
      identityVerified: true,
      purpose: "treatment",
      requestedCategories: ["diagnosis"],
      authorization: {
        reference: "assigned-clinician-policy-v1",
        allowedPurposes: ["treatment"],
        allowedCategories: ["diagnosis", "treatment_plan"],
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.reasonCodes).toEqual(["ALLOW_PART2_ACCESS"]);
    expect(result.audit).toMatchObject({
      action: "access",
      outcome: "allowed",
      legalBasis: "workforce_authorization",
      reasonCodes: ["ALLOW_PART2_ACCESS"],
      authorizationReference: "assigned-clinician-policy-v1",
    });
  });

  it("denies unverified, unauthorized, overbroad access and records every reason", () => {
    const result = evaluatePart2Access({
      eventId: "",
      occurredAt: "invalid",
      actorId: "",
      patientId: "patient-synthetic-001",
      recordId: "record-synthetic-001",
      recordFlag: protectedRecord,
      identityVerified: false,
      purpose: "research",
      requestedCategories: ["entire_record"],
      authorization: {
        reference: "",
        allowedPurposes: ["treatment"],
        allowedCategories: ["diagnosis"],
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "DENY_AUDIT_METADATA_INVALID",
      "DENY_IDENTITY_NOT_VERIFIED",
      "DENY_PART2_AUTHORIZATION_MISSING",
      "DENY_PURPOSE_NOT_APPROVED",
      "DENY_CATEGORY_NOT_APPROVED",
      "DENY_ENTIRE_RECORD_NOT_JUSTIFIED",
    ]));
    expect(result.audit.outcome).toBe("denied");
  });

  it("treats pending-review records as protected and requires explicit review access", () => {
    const pending = classifyPart2Record({
      containsSudDiagnosisTreatmentOrReferral: true,
      maintainedByPart2Program: true,
    });
    const base = {
      eventId: "event-synthetic-access-pending",
      occurredAt: NOW,
      actorId: "user-synthetic-reviewer",
      patientId: "patient-synthetic-001",
      recordId: "record-synthetic-001",
      recordFlag: pending,
      identityVerified: true,
      purpose: "health_care_operations" as const,
      requestedCategories: ["diagnosis" as const],
      authorization: {
        reference: "privacy-review-policy-v1",
        allowedPurposes: ["health_care_operations" as const],
        allowedCategories: ["diagnosis" as const],
      },
    };
    expect(evaluatePart2Access(base).reasonCodes)
      .toContain("DENY_PENDING_REVIEW_ACCESS_NOT_APPROVED");
    expect(evaluatePart2Access({
      ...base,
      authorization: { ...base.authorization, pendingReviewAccessApproved: true },
    }).allowed).toBe(true);
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      eventId: "event-synthetic-deterministic",
      occurredAt: NOW,
      actorId: "user-synthetic-clinician",
      patientId: "patient-synthetic-001",
      recordId: "record-synthetic-001",
      recordFlag: protectedRecord,
      identityVerified: true,
      purpose: "treatment" as const,
      requestedCategories: ["diagnosis" as const],
      authorization: {
        reference: "assigned-clinician-policy-v1",
        allowedPurposes: ["treatment" as const],
        allowedCategories: ["diagnosis" as const],
      },
    };
    expect(evaluatePart2Access(input)).toEqual(evaluatePart2Access(input));
  });
});

describe("M1.2-06 consent disclosure, minimum necessary, notice, and redisclosure", () => {
  it("allows a scoped consent disclosure with notice/copy and HIPAA TPO rule", () => {
    const result = evaluatePart2Disclosure(makeDisclosure());
    expect(result.allowed).toBe(true);
    expect(result.reasonCodes).toEqual(["ALLOW_CONSENT_DISCLOSURE"]);
    expect(result.redisclosureRule).toBe("HIPAA_TPO_EXCEPT_PATIENT_PROCEEDINGS");
    expect(result.audit).toMatchObject({
      action: "disclosure",
      outcome: "allowed",
      legalBasis: "written_consent",
      consentId: "consent-synthetic-001",
      noticeAccompanied: true,
      consentScopeAccompanied: true,
      recipientName: "Synthetic Treating Provider",
      informationDescription: "diagnosis",
    });
  });

  it("accepts a clear consent-scope explanation instead of a consent copy", () => {
    const base = makeDisclosure();
    const result = evaluatePart2Disclosure({
      ...base,
      legalBasis: {
        ...base.legalBasis as Extract<Part2DisclosureInput["legalBasis"], { type: "written_consent" }>,
        accompaniment: {
          noticeText: PART2_NOTICE_STATEMENT_2,
          consentCopyAttached: false,
          clearScopeExplanation: "Diagnosis only for the named treating provider.",
        },
      },
    });
    expect(result.allowed).toBe(true);
    expect(result.audit.consentScopeAccompanied).toBe(true);
  });

  it("denies a consent disclosure missing the exact notice and consent scope", () => {
    const base = makeDisclosure();
    const result = evaluatePart2Disclosure({
      ...base,
      legalBasis: {
        ...base.legalBasis as Extract<Part2DisclosureInput["legalBasis"], { type: "written_consent" }>,
        accompaniment: {
          noticeText: "Part 2 data",
          consentCopyAttached: false,
          clearScopeExplanation: " ",
        },
      },
    });
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "DENY_NOTICE_MISSING_OR_INVALID",
      "DENY_CONSENT_SCOPE_ACCOMPANIMENT_MISSING",
    ]));
    expect(result.audit.outcome).toBe("denied");
  });

  it("denies consent context mismatches without leaking an allow", () => {
    const base = makeDisclosure();
    const consentBasis = base.legalBasis as Extract<
      Part2DisclosureInput["legalBasis"], { type: "written_consent" }
    >;
    const result = evaluatePart2Disclosure({
      ...base,
      patientId: "patient-synthetic-002",
      purpose: "research",
      requestedCategories: ["billing"],
      recipient: { ...base.recipient, designation: "Synthetic School" },
      legalBasis: {
        ...consentBasis,
        discloserDesignation: "Unknown Program",
      },
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "DENY_CONSENT_PATIENT_MISMATCH",
      "DENY_DISCLOSER_NOT_CONSENTED",
      "DENY_RECIPIENT_NOT_CONSENTED",
      "DENY_PURPOSE_NOT_CONSENTED",
      "DENY_CATEGORY_NOT_CONSENTED",
      "DENY_MINIMUM_NECESSARY_EXCEEDED",
    ]));
  });

  it("denies missing or exceeded minimum-necessary policy and unjustified whole records", () => {
    expect(evaluatePart2Disclosure(makeDisclosure({ minimumNecessary: undefined })).reasonCodes)
      .toContain("DENY_MINIMUM_NECESSARY_POLICY_MISSING");
    const result = evaluatePart2Disclosure(makeDisclosure({
      requestedCategories: ["entire_record"],
      minimumNecessary: {
        policyReference: "whole-record-review-v1",
        approvedCategories: ["entire_record"],
      },
      legalBasis: {
        type: "written_consent",
        consent: makeConsent({ authorizedCategories: ["entire_record"] }),
        discloserDesignation: "Adolbi Part 2 Program",
        accompaniment: {
          noticeText: PART2_NOTICE_STATEMENT_2,
          consentCopyAttached: true,
        },
      },
    }));
    expect(result.reasonCodes).toContain("DENY_ENTIRE_RECORD_NOT_JUSTIFIED");
  });

  it("denies disclosure under an expired consent", () => {
    const result = evaluatePart2Disclosure(makeDisclosure({
      legalBasis: {
        type: "written_consent",
        consent: makeConsent({
          expiration: { kind: "date", expiresAt: "2026-01-01T00:00:00.000Z" },
        }),
        discloserDesignation: "Adolbi Part 2 Program",
        accompaniment: {
          noticeText: PART2_NOTICE_STATEMENT_2,
          consentCopyAttached: true,
        },
      },
    }));
    expect(result.reasonCodes).toContain("DENY_CONSENT_INVALID");
  });

  it("enforces each 2.33 redisclosure path and bars proceedings against the patient", () => {
    expect(determinePart2RedisclosureRule("covered_entity", "treatment"))
      .toBe("HIPAA_TPO_EXCEPT_PATIENT_PROCEEDINGS");
    expect(determinePart2RedisclosureRule("part2_program_non_hipaa", "payment"))
      .toBe("CONSISTENT_WITH_CONSENT_ONLY");
    expect(determinePart2RedisclosureRule("non_hipaa_lawful_holder", "health_care_operations"))
      .toBe("NECESSARY_CONTRACTORS_FOR_PAYMENT_OR_OPERATIONS_ONLY");
    expect(determinePart2RedisclosureRule("other", "research"))
      .toBe("NO_REDISCLOSURE_UNLESS_SEPARATELY_PERMITTED");

    const result = evaluatePart2Disclosure(makeDisclosure({
      intendedRedisclosure: "proceeding_against_patient",
    }));
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain("DENY_REDISCLOSURE_NOT_PERMITTED");
  });

  it("allows consent-bound and necessary-contractor redisclosure intents only in context", () => {
    const part2Program = makeDisclosure({
      recipient: {
        name: "Synthetic Part 2 Program",
        designation: "Synthetic Part 2 Program",
        type: "part2_program_non_hipaa",
      },
      intendedRedisclosure: "consistent_with_consent",
      legalBasis: {
        type: "written_consent",
        consent: makeConsent({
          recipientDesignation: { namesOrClasses: ["Synthetic Part 2 Program"] },
        }),
        discloserDesignation: "Adolbi Part 2 Program",
        accompaniment: {
          noticeText: PART2_NOTICE_STATEMENT_2,
          consentCopyAttached: true,
        },
      },
    });
    expect(evaluatePart2Disclosure(part2Program).allowed).toBe(true);

    const lawfulHolder = makeDisclosure({
      purpose: "payment",
      recipient: {
        name: "Synthetic Payment Vendor",
        designation: "Synthetic Payment Vendor",
        type: "non_hipaa_lawful_holder",
      },
      intendedRedisclosure: "contractor_for_payment_or_operations",
      legalBasis: {
        type: "written_consent",
        consent: makeConsent({
          recipientDesignation: { namesOrClasses: ["Synthetic Payment Vendor"] },
        }),
        discloserDesignation: "Adolbi Part 2 Program",
        accompaniment: {
          noticeText: PART2_NOTICE_STATEMENT_2,
          consentCopyAttached: true,
        },
      },
    });
    expect(evaluatePart2Disclosure(lawfulHolder).allowed).toBe(true);
  });
});

describe("M1.2-06 42 CFR 2.51 medical-emergency exception", () => {
  it("validates all immediately recorded emergency fields", () => {
    expect(validateMedicalEmergencyException(makeEmergency())).toEqual({ valid: true, issues: [] });
  });

  it("reports a non-bona-fide, undocumented exception as invalid", () => {
    const result = validateMedicalEmergencyException(makeEmergency({
      bonaFideMedicalEmergency: false,
      priorWrittenConsentCouldNotBeObtained: false,
      recipientMedicalPersonnelName: "",
      recipientAffiliation: "",
      disclosedBy: "",
      disclosureAt: "invalid",
      natureOfEmergency: "",
      documentedAt: "invalid",
      documentedImmediatelyFollowingDisclosure: false,
    }));
    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      "EMERGENCY_NOT_BONA_FIDE",
      "EMERGENCY_PRIOR_CONSENT_COULD_BE_OBTAINED",
      "EMERGENCY_MEDICAL_PERSONNEL_MISSING",
      "EMERGENCY_AFFILIATION_MISSING",
      "EMERGENCY_DISCLOSER_MISSING",
      "EMERGENCY_DISCLOSURE_TIMESTAMP_INVALID",
      "EMERGENCY_NATURE_MISSING",
      "EMERGENCY_DOCUMENTATION_TIMESTAMP_INVALID",
      "EMERGENCY_NOT_DOCUMENTED_IMMEDIATELY",
    ]));
  });

  it("allows a minimum-necessary emergency disclosure to matching medical personnel", () => {
    const result = evaluatePart2Disclosure(makeDisclosure({
      recipient: {
        name: "Synthetic Emergency Physician",
        designation: "Synthetic General Hospital",
        type: "medical_personnel",
      },
      intendedRedisclosure: "none",
      legalBasis: { type: "medical_emergency", exception: makeEmergency() },
    }));
    expect(result.allowed).toBe(true);
    expect(result.reasonCodes).toEqual(["ALLOW_MEDICAL_EMERGENCY_DISCLOSURE"]);
    expect(result.audit).toMatchObject({
      legalBasis: "medical_emergency",
      emergencyExceptionId: "emergency-synthetic-001",
      outcome: "allowed",
      redisclosureRule: "PART2_EXCEPTION_LIMITED_NO_GENERAL_REDISCLOSURE",
    });
  });

  it("denies mismatched emergency context and requested redisclosure", () => {
    const result = evaluatePart2Disclosure(makeDisclosure({
      recipient: {
        name: "Different Physician",
        designation: "Synthetic General Hospital",
        type: "medical_personnel",
      },
      intendedRedisclosure: "hipaa_tpo",
      legalBasis: { type: "medical_emergency", exception: makeEmergency() },
    }));
    expect(result.reasonCodes).toEqual(expect.arrayContaining([
      "DENY_MEDICAL_EMERGENCY_CONTEXT_MISMATCH",
      "DENY_REDISCLOSURE_NOT_PERMITTED",
    ]));
  });
});

describe("M1.2-06 manual disclosure logging", () => {
  it("creates evidence that explicitly grants no authorization", () => {
    const log = createManualDisclosureLog({
      logId: "manual-log-synthetic-001",
      loggedAt: NOW,
      loggedBy: "user-synthetic-privacy",
      patientId: "patient-synthetic-001",
      recordId: "record-synthetic-001",
      claimedDisclosureAt: NOW,
      recipientName: "Synthetic Recipient",
      purpose: "other",
      categories: ["diagnosis", "diagnosis"],
      note: "Synthetic reconstruction evidence only.",
    });
    expect(log).toMatchObject({
      recordType: "manual_supplemental_log",
      authorizationGranted: false,
      reasonCode: "MANUAL_LOG_NOT_AUTHORIZATION",
    });
    expect(log.data.categories).toEqual(["diagnosis"]);
  });

  it("denies a disclosure that presents a manual log as its legal basis", () => {
    const result = evaluatePart2Disclosure(makeDisclosure({
      legalBasis: { type: "manual_log", logReference: "manual-log-synthetic-001" },
      intendedRedisclosure: "none",
    }));
    expect(result.allowed).toBe(false);
    expect(result.reasonCodes).toContain("MANUAL_LOG_NOT_AUTHORIZATION");
    expect(result.audit).toMatchObject({
      legalBasis: "manual_log",
      outcome: "denied",
    });
  });
});

describe("M1.2-06 three-year disclosure accounting", () => {
  it("returns only accountable consent disclosures in the three-year window", () => {
    const events: Part2DecisionAuditEvent[] = [
      accountingEvent(),
      accountingEvent({
        eventId: "accounting-event-research-paper",
        occurredAt: "2025-06-01T12:00:00.000Z",
        purpose: "research",
        transport: "paper",
        recipientName: "Synthetic Researcher",
      }),
      accountingEvent({
        eventId: "excluded-tpo-paper",
        occurredAt: "2025-05-01T12:00:00.000Z",
        purpose: "payment",
        transport: "paper",
      }),
      accountingEvent({
        eventId: "excluded-denied",
        outcome: "denied",
        reasonCodes: ["DENY_CONSENT_INVALID"],
      }),
      accountingEvent({
        eventId: "excluded-emergency",
        legalBasis: "medical_emergency",
        emergencyExceptionId: "emergency-synthetic-001",
        consentId: undefined,
      }),
      accountingEvent({
        eventId: "excluded-access",
        action: "access",
        legalBasis: "workforce_authorization",
        consentId: undefined,
      }),
      accountingEvent({
        eventId: "excluded-other-patient",
        patientId: "patient-synthetic-002",
      }),
      accountingEvent({
        eventId: "excluded-too-old",
        occurredAt: "2023-07-13T23:59:59.000Z",
      }),
    ];
    const result = queryThreeYearPart2Accounting(events, {
      patientId: "patient-synthetic-001",
      requestedAt: "2026-07-14T00:00:00.000Z",
    });
    expect(result.valid).toBe(true);
    expect(result.windowStart).toBe("2023-07-14T00:00:00.000Z");
    expect(result.entries.map((entry) => entry.eventId)).toEqual([
      "accounting-event-research-paper",
      "accounting-event-001",
    ]);
    expect(result.entries[0]).toMatchObject({
      recipientName: "Synthetic Researcher",
      informationDescription: "diagnosis",
      purpose: "research",
      consentId: "consent-synthetic-001",
    });
  });

  it("honors a patient-selected shorter period", () => {
    const result = queryThreeYearPart2Accounting([
      accountingEvent({ eventId: "before-short-window", occurredAt: "2025-12-31T23:59:59.000Z" }),
      accountingEvent({ eventId: "inside-short-window", occurredAt: "2026-01-01T00:00:00.000Z" }),
    ], {
      patientId: "patient-synthetic-001",
      requestedAt: "2026-07-14T00:00:00.000Z",
      startAt: "2026-01-01T00:00:00.000Z",
    });
    expect(result.windowStart).toBe("2026-01-01T00:00:00.000Z");
    expect(result.entries.map((entry) => entry.eventId)).toEqual(["inside-short-window"]);
  });

  it("rejects invalid, future, and longer-than-three-year accounting requests", () => {
    expect(queryThreeYearPart2Accounting([], {
      patientId: "patient-synthetic-001",
      requestedAt: "invalid",
    }).issues).toContain("ACCOUNTING_REQUEST_TIMESTAMP_INVALID");
    expect(queryThreeYearPart2Accounting([], {
      patientId: "patient-synthetic-001",
      requestedAt: "2026-07-14T00:00:00.000Z",
      startAt: "2026-07-15T00:00:00.000Z",
    }).issues).toContain("ACCOUNTING_START_AFTER_REQUEST");
    expect(queryThreeYearPart2Accounting([], {
      patientId: "patient-synthetic-001",
      requestedAt: "2026-07-14T00:00:00.000Z",
      startAt: "2023-07-13T23:59:59.000Z",
    }).issues).toContain("ACCOUNTING_PERIOD_EXCEEDS_THREE_YEARS");
  });

  it("calculates the three-year boundary safely across leap day", () => {
    const result = queryThreeYearPart2Accounting([], {
      patientId: "patient-synthetic-001",
      requestedAt: "2024-02-29T12:30:00.000Z",
    });
    expect(result.windowStart).toBe("2021-02-28T12:30:00.000Z");
  });
});
