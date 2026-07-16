import { describe, expect, it } from "vitest";
import {
  GRO_CHAPTER_748_CITATIONS,
  GRO_CHAPTER_748_POLICY_METADATA,
  GRO_PROHIBITED_PRACTICES,
  GRO_REASON_CODES,
  GRO_SUPPORTIVE_PRACTICES,
  evaluateGroBedroom,
  evaluateGroPersonalRestraint,
  evaluateGroPostIntervention,
  evaluateGroPractice,
  evaluateGroRecordRetention,
  evaluateGroSupervisionRatio,
  evaluateGroYouthRights,
  type GroPersonalRestraintInput,
  type GroPostInterventionInput,
  type GroRatioCaregiver,
  type GroRatioChild,
  type GroRightsRecipientEvidence,
} from "../../contracts/regulatory/gro";

const ADMISSION = "2026-01-01T00:00:00.000Z";

function syntheticChildren(
  count: number,
  overrides: Partial<GroRatioChild> = {},
): GroRatioChild[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `synthetic-child-${index + 1}`,
    ageYears: 12,
    requiresTreatmentServices: false,
    relationship: "child-in-care",
    ...overrides,
  }));
}

function caregiver(
  id: string,
  overrides: Partial<GroRatioCaregiver> = {},
): GroRatioCaregiver {
  return {
    id,
    qualified: true,
    workingDirectlyWithGroup: true,
    status: "awake",
    ...overrides,
  };
}

function rightsEvidence(
  overrides: Partial<GroRightsRecipientEvidence> = {},
): GroRightsRecipientEvidence {
  return {
    reviewedAt: "2026-01-04T12:00:00.000Z",
    writtenCopyProvidedAt: "2026-01-04T12:00:00.000Z",
    understandsEnglish: true,
    acknowledgmentSignedAt: "2026-01-04T12:01:00.000Z",
    acknowledgmentConfirmsReadAndUnderstands: true,
    acknowledgmentFiledInChildRecord: true,
    ...overrides,
  };
}

function compliantRestraint(
  overrides: Partial<GroPersonalRestraintInput> = {},
): GroPersonalRestraintInput {
  return {
    restraintKind: "personal-restraint",
    operationPolicyPermits: true,
    lessRestrictiveInterventionsAttempted: true,
    lessRestrictiveInterventionsIneffective: true,
    basis: "emergency-situation",
    purpose: "emergency-safety",
    minimalReasonableForceUsed: true,
    privacyProtected: true,
    dignityAndWellBeingProtected: true,
    monitor: {
      qualifiedInEmergencyBehaviorIntervention: true,
      continuouslyMonitoredAppropriatePerformance: true,
      continuouslyMonitoredBreathingAndPhysicalDistress: true,
      preparedToProtectRespirationCirculationAndWellBeing: true,
    },
    techniques: ["trained-standing-restraint"],
    position: "standing",
    operationCapacity: 17,
    childCondition: "stable",
    ...overrides,
  };
}

function compliantPostIntervention(
  overrides: Partial<GroPostInterventionInput> = {},
): GroPostInterventionInput {
  return {
    interventionKind: "personal-restraint",
    initiatedAt: "2026-01-01T00:00:00.000Z",
    interventionEndedAt: "2026-01-01T00:10:00.000Z",
    stabilizedAt: "2026-01-01T00:11:00.000Z",
    observedUntil: "2026-01-01T00:25:00.000Z",
    privateChildDiscussionAt: "2026-01-03T00:10:00.000Z",
    caregiverDebriefAt: "2026-01-01T00:12:00.000Z",
    caregiverDebriefAsSoonAsPossibleAttested: true,
    witnessesPresent: true,
    reasonableWitnessDebriefEffortsMade: true,
    supervisorReviewedAt: "2026-01-04T00:00:00.000Z",
    incidentDocumentedAt: "2026-01-02T00:00:00.000Z",
    parentNotifiedInWritingAt: "2026-01-04T00:00:00.000Z",
    ...overrides,
  };
}

describe("M1.2-05 official Chapter 748 policy metadata", () => {
  it("pins the Texas SOS chapter and HHSC compilation to the verification date", () => {
    expect(GRO_CHAPTER_748_POLICY_METADATA).toMatchObject({
      policyId: "M1.2-05-GRO-748",
      verifiedAsInEffectOn: "2026-07-14",
      titlePartChapter: "26 TAC, Part 1, Chapter 748",
      authoritativeSource: "Texas Secretary of State Rules and Meetings portal",
    });
    expect(GRO_CHAPTER_748_POLICY_METADATA.authoritativeChapterUrl).toContain(
      "title=26&part=1&chapter=748",
    );
    expect(GRO_CHAPTER_748_POLICY_METADATA.agencyCompilationUrl).toContain(
      "hhs.texas.gov/",
    );
  });

  it("provides official rule-level citations and effective histories for every control domain", () => {
    expect(Object.keys(GRO_CHAPTER_748_CITATIONS)).toEqual(
      expect.arrayContaining([
        "748.431",
        "748.433",
        "748.1003",
        "748.1007",
        "748.1103",
        "748.2307",
        "748.2603",
        "748.2605",
        "748.2851",
        "748.2855",
        "748.2857",
        "748.2903",
        "748.2907",
        "748.3357",
      ]),
    );
    for (const citation of Object.values(GRO_CHAPTER_748_CITATIONS)) {
      expect(citation.officialUrl).toMatch(
        /^https:\/\/texas-sos\.appianportalsgov\.com\/rules-and-meetings\?recordId=/,
      );
      expect(citation.effectiveHistory).toMatch(/Effective \d{4}-\d{2}-\d{2}/);
    }
  });
});

describe("M1.2-05 awake and sleeping supervision ratios", () => {
  it("allows eight non-treatment ratio units per awake caregiver during waking hours", () => {
    const decision = evaluateGroSupervisionRatio({
      period: "children-awake",
      children: syntheticChildren(8),
      caregivers: [caregiver("caregiver-1")],
    });

    expect(decision).toMatchObject({
      compliant: true,
      facts: { weightedChildUnits: 8, availableCapacityUnits: 8 },
    });
    expect(decision.reasonCodes).toContain(GRO_REASON_CODES.RATIO_COMPLIANT);
  });

  it("uses the five-child treatment-services waking limit", () => {
    const decision = evaluateGroSupervisionRatio({
      period: "children-awake",
      children: syntheticChildren(6, { requiresTreatmentServices: true }),
      caregivers: [caregiver("caregiver-1")],
    });

    expect(decision.compliant).toBe(false);
    expect(decision.facts).toMatchObject({
      treatmentServicesPresent: true,
      availableCapacityUnits: 5,
      requiredAdditionalCapacityUnits: 1,
    });
    expect(decision.reasonCodes).toContain(GRO_REASON_CODES.RATIO_INSUFFICIENT);
  });

  it("counts each child younger than five as two units", () => {
    const fourChildren = evaluateGroSupervisionRatio({
      period: "children-awake",
      children: syntheticChildren(4, { ageYears: 4 }),
      caregivers: [caregiver("caregiver-1")],
    });
    const fiveChildren = evaluateGroSupervisionRatio({
      period: "children-awake",
      children: syntheticChildren(5, { ageYears: 4 }),
      caregivers: [caregiver("caregiver-1")],
    });

    expect(fourChildren).toMatchObject({
      compliant: true,
      facts: { underFiveCount: 4, weightedChildUnits: 8 },
    });
    expect(fourChildren.reasonCodes).toContain(
      GRO_REASON_CODES.RATIO_UNDER_FIVE_WEIGHTED,
    );
    expect(fiveChildren).toMatchObject({
      compliant: false,
      facts: { weightedChildUnits: 10, requiredAdditionalCapacityUnits: 2 },
    });
  });

  it("combines the 15-unit awake and 10-unit sleeping treatment capacities at night", () => {
    const decision = evaluateGroSupervisionRatio({
      period: "night-sleeping",
      children: syntheticChildren(25, { requiresTreatmentServices: true }),
      caregivers: [
        caregiver("awake-caregiver"),
        caregiver("sleeping-caregiver", { status: "sleeping" }),
      ],
    });

    expect(decision).toMatchObject({
      compliant: true,
      facts: {
        eligibleAwakeCaregivers: 1,
        eligibleSleepingCaregivers: 1,
        availableCapacityUnits: 25,
      },
    });
  });

  it("requires an awake eligible caregiver for a child needing constant nighttime supervision", () => {
    const decision = evaluateGroSupervisionRatio({
      period: "night-sleeping",
      children: syntheticChildren(1, { requiresConstantSupervision: true }),
      caregivers: [caregiver("sleeping-caregiver", { status: "sleeping" })],
    });

    expect(decision.compliant).toBe(false);
    expect(decision.reasonCodes).toContain(
      GRO_REASON_CODES.RATIO_CONSTANT_SUPERVISION_NEEDS_AWAKE,
    );
  });

  it("excludes ineligible caregivers and approved unsupervised activities but includes caregiver children", () => {
    const children = syntheticChildren(8);
    children[0] = {
      ...children[0],
      approvedUnsupervisedChildhoodActivity: true,
    };
    children[1] = { ...children[1], relationship: "caregiver-child" };
    const decision = evaluateGroSupervisionRatio({
      period: "children-awake",
      children,
      caregivers: [
        caregiver("eligible"),
        caregiver("not-qualified", { qualified: false }),
        caregiver("not-direct", { workingDirectlyWithGroup: false }),
      ],
    });

    expect(decision).toMatchObject({
      compliant: true,
      facts: { includedChildCount: 7, weightedChildUnits: 7 },
    });
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RATIO_CAREGIVER_EXCLUDED,
        GRO_REASON_CODES.RATIO_UNSUPERVISED_ACTIVITY_EXCLUDED,
        GRO_REASON_CODES.RATIO_CAREGIVER_CHILD_INCLUDED,
      ]),
    );
  });

  it("applies only a fully evidenced short cottage-home routine exception", () => {
    const completeException = {
      forNormalHomeLikeRoutine: true,
      shortPeriod: true,
      careAndSupervisionNeedsMet: true,
      additionalStaffOrCaregiversOnPremisesAndAvailable: true,
      addressedInWrittenProfessionalStaffingPlan: true,
    };
    const permitted = evaluateGroSupervisionRatio({
      period: "children-awake",
      children: syntheticChildren(9),
      caregivers: [caregiver("caregiver-1")],
      setting: "cottage-home",
      cottageTemporaryException: completeException,
    });
    const denied = evaluateGroSupervisionRatio({
      period: "children-awake",
      children: syntheticChildren(9),
      caregivers: [caregiver("caregiver-1")],
      setting: "cottage-home",
      cottageTemporaryException: {
        ...completeException,
        addressedInWrittenProfessionalStaffingPlan: false,
      },
    });

    expect(permitted).toMatchObject({
      compliant: true,
      facts: { cottageExceptionApplied: true },
    });
    expect(permitted.reasonCodes).toContain(
      GRO_REASON_CODES.RATIO_COTTAGE_EXCEPTION_APPLIED,
    );
    expect(denied.compliant).toBe(false);
    expect(denied.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RATIO_INSUFFICIENT,
        GRO_REASON_CODES.RATIO_COTTAGE_EXCEPTION_INCOMPLETE,
      ]),
    );
  });

  it("fails closed for mixed child/adult groups and unknown caregiver statuses", () => {
    const mixed = evaluateGroSupervisionRatio({
      period: "children-awake",
      children: syntheticChildren(1),
      caregivers: [caregiver("caregiver-1")],
      adultResidentsPresent: true,
    });
    const unknown = evaluateGroSupervisionRatio({
      period: "children-awake",
      children: syntheticChildren(1),
      caregivers: [caregiver("caregiver-1", { status: "on-call" })],
    });

    expect(mixed.reasonCodes).toContain(
      GRO_REASON_CODES.RATIO_ADULT_MIX_REQUIRES_REVIEW,
    );
    expect(mixed.compliant).toBe(false);
    expect(unknown.reasonCodes).toContain(GRO_REASON_CODES.INPUT_INVALID);
    expect(unknown.compliant).toBe(false);
  });
});

describe("M1.2-05 bedroom usable space and occupancy", () => {
  it("requires 80 usable square feet for a single-occupancy room", () => {
    expect(
      evaluateGroBedroom({
        occupantCount: 1,
        grossFloorSquareFeet: 90,
        closetAndAlcoveSquareFeet: 10,
      }),
    ).toMatchObject({
      compliant: true,
      facts: { usableFloorSquareFeet: 80, requiredFloorSquareFeet: 80 },
    });
    expect(
      evaluateGroBedroom({
        occupantCount: 1,
        grossFloorSquareFeet: 79,
        closetAndAlcoveSquareFeet: 0,
      }).reasonCodes,
    ).toContain(GRO_REASON_CODES.BEDROOM_SPACE_INSUFFICIENT);
  });

  it("requires 60 usable square feet each and normally limits a room to four children", () => {
    const four = evaluateGroBedroom({
      occupantCount: 4,
      grossFloorSquareFeet: 260,
      closetAndAlcoveSquareFeet: 20,
    });
    const five = evaluateGroBedroom({
      occupantCount: 5,
      grossFloorSquareFeet: 300,
      closetAndAlcoveSquareFeet: 0,
    });

    expect(four).toMatchObject({
      compliant: true,
      facts: { maximumOccupancy: 4 },
    });
    expect(five.compliant).toBe(false);
    expect(five.reasonCodes).toContain(
      GRO_REASON_CODES.BEDROOM_OCCUPANCY_EXCEEDED,
    );
  });

  it("supports the primary-medical-needs maximum-occupancy exception without waiving space", () => {
    const decision = evaluateGroBedroom({
      occupantCount: 5,
      grossFloorSquareFeet: 300,
      closetAndAlcoveSquareFeet: 0,
      allOccupantsReceivePrimaryMedicalNeedsTreatment: true,
    });

    expect(decision).toMatchObject({
      compliant: true,
      facts: {
        primaryMedicalNeedsExceptionApplied: true,
        requiredFloorSquareFeet: 300,
      },
    });
    expect(decision.reasonCodes).toContain(
      GRO_REASON_CODES.BEDROOM_PRIMARY_MEDICAL_EXCEPTION,
    );
  });

  it("applies qualifying pre-2007 occupancy and emergency-care space exceptions", () => {
    const decision = evaluateGroBedroom({
      occupantCount: 6,
      grossFloorSquareFeet: 180,
      closetAndAlcoveSquareFeet: 20,
      legacyPermit: {
        grantedBefore2007: true,
        emergencyCarePermit: true,
        operationMovedSincePermit: false,
        bedroomAddedSincePermit: false,
        permitStillValid: true,
      },
    });

    expect(decision).toMatchObject({
      compliant: true,
      facts: {
        legacySpaceExceptionApplied: true,
        legacyOccupancyExceptionApplied: true,
      },
    });
  });

  it("ends legacy exceptions after a move and validates floor-space measurements", () => {
    const moved = evaluateGroBedroom({
      occupantCount: 6,
      grossFloorSquareFeet: 180,
      closetAndAlcoveSquareFeet: 20,
      legacyPermit: {
        grantedBefore2007: true,
        emergencyCarePermit: true,
        operationMovedSincePermit: true,
        bedroomAddedSincePermit: false,
        permitStillValid: true,
      },
    });
    const invalid = evaluateGroBedroom({
      occupantCount: 1,
      grossFloorSquareFeet: 70,
      closetAndAlcoveSquareFeet: 80,
    });

    expect(moved.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.BEDROOM_OCCUPANCY_EXCEEDED,
        GRO_REASON_CODES.BEDROOM_SPACE_INSUFFICIENT,
      ]),
    );
    expect(moved.compliant).toBe(false);
    expect(invalid.reasonCodes).toContain(GRO_REASON_CODES.INPUT_INVALID);
    expect(invalid.compliant).toBe(false);
  });
});

describe("M1.2-05 youth-rights delivery and acknowledgment", () => {
  it("accepts complete child and parent evidence through the exact seven-day boundary", () => {
    const boundary = rightsEvidence({
      reviewedAt: "2026-01-08T00:00:00.000Z",
      writtenCopyProvidedAt: "2026-01-08T00:00:00.000Z",
      acknowledgmentSignedAt: "2026-01-08T00:00:00.000Z",
    });
    const decision = evaluateGroYouthRights({
      admittedAt: ADMISSION,
      rightsDocumentUsesSimpleNonTechnicalTerms: true,
      parentConsentRequired: true,
      child: boundary,
      parent: boundary,
    });

    expect(decision).toMatchObject({
      compliant: true,
      facts: {
        deadlineInstant: "2026-01-08T00:00:00.000Z",
        evaluatedRecipients: ["child", "parent"],
      },
    });
    expect(decision.reasonCodes).toContain(GRO_REASON_CODES.RIGHTS_COMPLIANT);
  });

  it("rejects late review, written-copy, and acknowledgment evidence", () => {
    const late = rightsEvidence({
      reviewedAt: "2026-01-08T00:00:00.001Z",
      writtenCopyProvidedAt: "2026-01-08T00:00:00.001Z",
      acknowledgmentSignedAt: "2026-01-08T00:00:00.001Z",
    });
    const decision = evaluateGroYouthRights({
      admittedAt: ADMISSION,
      rightsDocumentUsesSimpleNonTechnicalTerms: true,
      parentConsentRequired: false,
      child: late,
    });

    expect(decision.compliant).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RIGHTS_REVIEW_LATE,
        GRO_REASON_CODES.RIGHTS_COPY_LATE,
        GRO_REASON_CODES.RIGHTS_ACK_MISSING,
      ]),
    );
  });

  it("requires a possible primary-language copy and an impairment-accessible explanation", () => {
    const decision = evaluateGroYouthRights({
      admittedAt: ADMISSION,
      rightsDocumentUsesSimpleNonTechnicalTerms: true,
      parentConsentRequired: false,
      child: rightsEvidence({
        understandsEnglish: false,
        primaryLanguageCopyPossible: true,
        writtenCopyInPrimaryLanguage: false,
        hasVisualOrAuditoryImpairment: true,
        accessibleExplanationProvided: false,
      }),
    });

    expect(decision.compliant).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RIGHTS_LANGUAGE_INACCESSIBLE,
        GRO_REASON_CODES.RIGHTS_IMPAIRMENT_INACCESSIBLE,
      ]),
    );
  });

  it("records controlled exceptions when a primary-language copy or parent review is not required", () => {
    const decision = evaluateGroYouthRights({
      admittedAt: ADMISSION,
      rightsDocumentUsesSimpleNonTechnicalTerms: true,
      parentConsentRequired: false,
      child: rightsEvidence({
        understandsEnglish: false,
        primaryLanguageCopyPossible: false,
      }),
    });

    expect(decision.compliant).toBe(true);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RIGHTS_LANGUAGE_EXCEPTION,
        GRO_REASON_CODES.RIGHTS_PARENT_NOT_REQUIRED,
      ]),
    );
  });

  it("requires parent evidence, a valid understanding acknowledgment, and child-record filing", () => {
    const missingParent = evaluateGroYouthRights({
      admittedAt: ADMISSION,
      rightsDocumentUsesSimpleNonTechnicalTerms: true,
      parentConsentRequired: true,
      child: rightsEvidence(),
    });
    const invalidAcknowledgment = evaluateGroYouthRights({
      admittedAt: ADMISSION,
      rightsDocumentUsesSimpleNonTechnicalTerms: false,
      parentConsentRequired: false,
      child: rightsEvidence({
        acknowledgmentConfirmsReadAndUnderstands: false,
        acknowledgmentFiledInChildRecord: false,
      }),
    });

    expect(missingParent.reasonCodes).toContain(
      GRO_REASON_CODES.RIGHTS_RECIPIENT_MISSING,
    );
    expect(invalidAcknowledgment.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RIGHTS_DOCUMENT_NOT_PLAIN,
        GRO_REASON_CODES.RIGHTS_ACK_INVALID,
        GRO_REASON_CODES.RIGHTS_ACK_NOT_FILED,
      ]),
    );
  });
});

describe("M1.2-05 prohibited-practice fail-closed classifier", () => {
  it.each(GRO_PROHIBITED_PRACTICES)(
    "denies prohibited practice %s",
    (practiceCode) => {
      const decision = evaluateGroPractice({ practiceCode });

      expect(decision).toMatchObject({
        compliant: false,
        facts: { practiceCode, classification: "prohibited" },
      });
      expect(decision.reasonCodes).toEqual([
        GRO_REASON_CODES.PRACTICE_PROHIBITED,
      ]);
    },
  );

  it.each(GRO_SUPPORTIVE_PRACTICES)(
    "allows classified supportive practice %s",
    (practiceCode) => {
      expect(evaluateGroPractice({ practiceCode })).toMatchObject({
        compliant: true,
        facts: { classification: "supportive" },
        reasonCodes: [GRO_REASON_CODES.PRACTICE_PERMITTED],
      });
    },
  );

  it("routes emergency interventions to their evidence-specific protocol", () => {
    const decision = evaluateGroPractice({
      practiceCode: "personal-restraint",
    });

    expect(decision).toMatchObject({
      compliant: false,
      facts: { classification: "intervention-requires-evidence" },
    });
    expect(decision.reasonCodes).toContain(
      GRO_REASON_CODES.PRACTICE_INTERVENTION_PROTOCOL_REQUIRED,
    );
  });

  it("denies an unclassified practice", () => {
    const decision = evaluateGroPractice({
      practiceCode: "synthetic-unknown-practice",
    });

    expect(decision).toMatchObject({
      compliant: false,
      facts: { classification: "unknown" },
    });
    expect(decision.reasonCodes).toEqual([
      GRO_REASON_CODES.PRACTICE_UNKNOWN_DENIED,
    ]);
  });
});

describe("M1.2-05 personal-restraint monitoring and immediate medical response", () => {
  it("accepts complete personal-restraint evidence deterministically", () => {
    const input = compliantRestraint();

    expect(evaluateGroPersonalRestraint(input)).toEqual(
      evaluateGroPersonalRestraint(input),
    );
    expect(evaluateGroPersonalRestraint(input)).toMatchObject({
      compliant: true,
      reasonCodes: [GRO_REASON_CODES.RESTRAINT_COMPLIANT],
      facts: { immediateMedicalResponseRequired: false },
    });
  });

  it("reports policy, basis, purpose, force, privacy, and monitoring failures independently", () => {
    const decision = evaluateGroPersonalRestraint(
      compliantRestraint({
        operationPolicyPermits: false,
        lessRestrictiveInterventionsAttempted: false,
        basis: "unknown-basis",
        purpose: "caregiver-convenience",
        minimalReasonableForceUsed: false,
        privacyProtected: false,
        monitor: {
          qualifiedInEmergencyBehaviorIntervention: false,
          continuouslyMonitoredAppropriatePerformance: false,
          continuouslyMonitoredBreathingAndPhysicalDistress: false,
          preparedToProtectRespirationCirculationAndWellBeing: false,
        },
      }),
    );

    expect(decision.compliant).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RESTRAINT_POLICY_NOT_PERMITTED,
        GRO_REASON_CODES.RESTRAINT_LESS_RESTRICTIVE_NOT_EXHAUSTED,
        GRO_REASON_CODES.RESTRAINT_BASIS_INVALID,
        GRO_REASON_CODES.RESTRAINT_PURPOSE_PROHIBITED,
        GRO_REASON_CODES.RESTRAINT_FORCE_EXCESSIVE,
        GRO_REASON_CODES.RESTRAINT_PRIVACY_DIGNITY_FAILURE,
        GRO_REASON_CODES.RESTRAINT_MONITOR_UNQUALIFIED,
        GRO_REASON_CODES.RESTRAINT_MONITORING_INCOMPLETE,
      ]),
    );
  });

  it("denies prohibited, empty, and unclassified restraint techniques", () => {
    const prohibited = evaluateGroPersonalRestraint(
      compliantRestraint({ techniques: ["airway-obstruction"] }),
    );
    const unknown = evaluateGroPersonalRestraint(
      compliantRestraint({ techniques: ["synthetic-unknown-hold"] }),
    );
    const empty = evaluateGroPersonalRestraint(
      compliantRestraint({ techniques: [] }),
    );

    expect(prohibited.reasonCodes).toContain(
      GRO_REASON_CODES.RESTRAINT_TECHNIQUE_PROHIBITED,
    );
    expect(unknown.reasonCodes).toContain(
      GRO_REASON_CODES.RESTRAINT_TECHNIQUE_UNKNOWN,
    );
    expect(empty.reasonCodes).toContain(
      GRO_REASON_CODES.RESTRAINT_TECHNIQUE_UNKNOWN,
    );
  });

  it("accepts a one-minute prone transition only with last-resort and observer safeguards", () => {
    const decision = evaluateGroPersonalRestraint(
      compliantRestraint({
        position: "prone",
        proneOrSupineDurationSeconds: 60,
        proneOrSupineWasLastResort: true,
        independentObserver: {
          present: true,
          trainedInPositionalCompressionAndRestraintAsphyxiaRisks: true,
          trainedInProneAndSupineRisks: true,
          notInvolvedInRestraint: true,
        },
      }),
    );

    expect(decision).toMatchObject({
      compliant: true,
      facts: {
        positionalSafeguardsRequired: true,
        independentObserverRequired: true,
      },
    });
  });

  it("rejects an over-one-minute positional restraint or missing required observer", () => {
    const decision = evaluateGroPersonalRestraint(
      compliantRestraint({
        position: "supine",
        proneOrSupineDurationSeconds: 61,
        proneOrSupineWasLastResort: false,
      }),
    );

    expect(decision.compliant).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RESTRAINT_POSITIONAL_LIMIT,
        GRO_REASON_CODES.RESTRAINT_POSITIONAL_NOT_LAST_RESORT,
        GRO_REASON_CODES.RESTRAINT_OBSERVER_MISSING,
      ]),
    );
  });

  it("records the capacity-16 observer exception without waiving other positional safeguards", () => {
    const decision = evaluateGroPersonalRestraint(
      compliantRestraint({
        position: "prone",
        operationCapacity: 16,
        proneOrSupineDurationSeconds: 30,
        proneOrSupineWasLastResort: true,
      }),
    );

    expect(decision.compliant).toBe(true);
    expect(decision.reasonCodes).toContain(
      GRO_REASON_CODES.RESTRAINT_SMALL_OPERATION_OBSERVER_EXCEPTION,
    );
    expect(decision.facts.independentObserverRequired).toBe(false);
  });

  it("requires immediate release, medical assistance, and evaluation evidence for life-threatening distress", () => {
    const complete = evaluateGroPersonalRestraint(
      compliantRestraint({
        childCondition: "unresponsive",
        releasedImmediately: true,
        medicalAssistanceSoughtImmediately: true,
        healthCareProfessionalEvaluationDocumentedAt:
          "2026-01-01T00:12:00.000Z",
      }),
    );
    const incomplete = evaluateGroPersonalRestraint(
      compliantRestraint({
        childCondition: "reported-cannot-breathe",
        releasedImmediately: false,
        medicalAssistanceSoughtImmediately: false,
      }),
    );

    expect(complete).toMatchObject({
      compliant: true,
      facts: { immediateMedicalResponseRequired: true },
    });
    expect(incomplete.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.RESTRAINT_IMMEDIATE_RELEASE_MISSING,
        GRO_REASON_CODES.RESTRAINT_MEDICAL_ASSISTANCE_MISSING,
        GRO_REASON_CODES.RESTRAINT_MEDICAL_EVALUATION_MISSING,
      ]),
    );
  });

  it("fails closed for unknown restraint kinds, positions, and invalid capacity", () => {
    const decision = evaluateGroPersonalRestraint(
      compliantRestraint({
        restraintKind: "synthetic-restraint",
        position: "unknown-position",
        operationCapacity: 0,
      }),
    );

    expect(decision.compliant).toBe(false);
    expect(decision.reasonCodes).toContain(GRO_REASON_CODES.INPUT_INVALID);
  });
});

describe("M1.2-05 post-intervention deadlines", () => {
  it("accepts every deadline at its exact regulatory boundary", () => {
    const decision = evaluateGroPostIntervention(compliantPostIntervention());

    expect(decision).toMatchObject({
      compliant: true,
      facts: {
        observationMinutes: 15,
        childDiscussionDeadline: "2026-01-03T00:10:00.000Z",
        supervisorReviewDeadline: "2026-01-04T00:00:00.000Z",
        documentationDeadline: "2026-01-02T00:00:00.000Z",
        parentNoticeDeadline: "2026-01-04T00:00:00.000Z",
      },
    });
  });

  it("reports each late or missing post-intervention safeguard", () => {
    const decision = evaluateGroPostIntervention(
      compliantPostIntervention({
        observedUntil: "2026-01-01T00:24:59.000Z",
        privateChildDiscussionAt: "2026-01-03T00:10:00.001Z",
        caregiverDebriefAt: "2026-01-01T00:10:00.000Z",
        caregiverDebriefAsSoonAsPossibleAttested: false,
        reasonableWitnessDebriefEffortsMade: false,
        supervisorReviewedAt: "2026-01-04T00:00:00.001Z",
        incidentDocumentedAt: "2026-01-02T00:00:00.001Z",
        parentNotifiedInWritingAt: "2026-01-04T00:00:00.001Z",
      }),
    );

    expect(decision.compliant).toBe(false);
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.POST_OBSERVATION_SHORT,
        GRO_REASON_CODES.POST_DISCUSSION_LATE,
        GRO_REASON_CODES.POST_DEBRIEF_MISSING,
        GRO_REASON_CODES.POST_WITNESS_DEBRIEF_MISSING,
        GRO_REASON_CODES.POST_SUPERVISOR_REVIEW_LATE,
        GRO_REASON_CODES.POST_DOCUMENTATION_LATE,
        GRO_REASON_CODES.POST_PARENT_NOTICE_LATE,
      ]),
    );
  });

  it("applies all three rule exceptions to a short personal restraint", () => {
    const decision = evaluateGroPostIntervention({
      interventionKind: "short-personal-restraint",
      initiatedAt: "2026-01-01T00:00:00.000Z",
      interventionEndedAt: "2026-01-01T00:01:00.000Z",
      stabilizedAt: "2026-01-01T00:01:00.000Z",
    });

    expect(decision).toMatchObject({
      compliant: true,
      facts: {
        followUpRuleApplies: false,
        documentationRuleApplies: false,
        parentNoticeRuleApplies: false,
      },
    });
    expect(decision.reasonCodes).toContain(
      GRO_REASON_CODES.POST_FOLLOWUP_EXCEPTION,
    );
  });

  it("exempts emergency-care seclusion only from follow-up while retaining documentation and notice", () => {
    const decision = evaluateGroPostIntervention({
      interventionKind: "seclusion",
      emergencyCareSeclusion: true,
      initiatedAt: "2026-01-01T00:00:00.000Z",
      interventionEndedAt: "2026-01-01T00:05:00.000Z",
      stabilizedAt: "2026-01-01T00:05:00.000Z",
    });

    expect(decision.facts).toMatchObject({
      followUpRuleApplies: false,
      documentationRuleApplies: true,
      parentNoticeRuleApplies: true,
    });
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.POST_FOLLOWUP_EXCEPTION,
        GRO_REASON_CODES.POST_DOCUMENTATION_LATE,
        GRO_REASON_CODES.POST_PARENT_NOTICE_LATE,
      ]),
    );
  });

  it("enforces triggered-review timing, content, reduction plan, and child-record evidence", () => {
    const review = {
      triggeredAt: "2026-02-01T00:00:00.000Z",
      completedAt: "2026-03-03T00:00:00.000Z",
      recordsAndOrdersReviewed: true,
      medicalAndPsychiatricContraindicationsReviewed: true,
      behaviorPatternsAndDeescalationReviewed: true,
      alternativesIdentified: true,
      writtenReductionPlanCompleted: true,
      documentedInChildRecord: true,
    };
    const complete = evaluateGroPostIntervention(
      compliantPostIntervention({ triggeredReview: review }),
    );
    const incomplete = evaluateGroPostIntervention(
      compliantPostIntervention({
        triggeredReview: {
          ...review,
          completedAt: "2026-03-03T00:00:00.001Z",
          writtenReductionPlanCompleted: false,
        },
      }),
    );

    expect(complete).toMatchObject({
      compliant: true,
      facts: { triggeredReviewDeadline: "2026-03-03T00:00:00.000Z" },
    });
    expect(incomplete.reasonCodes).toEqual(
      expect.arrayContaining([
        GRO_REASON_CODES.POST_TRIGGERED_REVIEW_LATE,
        GRO_REASON_CODES.POST_TRIGGERED_REVIEW_INCOMPLETE,
      ]),
    );
  });

  it("fails closed for unknown intervention kinds or unordered timestamps", () => {
    const decision = evaluateGroPostIntervention(
      compliantPostIntervention({
        interventionKind: "synthetic-intervention",
        interventionEndedAt: "2025-12-31T23:59:00.000Z",
      }),
    );

    expect(decision.compliant).toBe(false);
    expect(decision.reasonCodes).toContain(GRO_REASON_CODES.INPUT_INVALID);
  });
});

describe("M1.2-05 child and personnel record retention", () => {
  it("retains current and prior-year annual training but releases older training", () => {
    const currentWindow = evaluateGroRecordRetention({
      recordType: "personnel",
      category: "annual-training",
      currentEmployee: true,
      trainingYear: 2025,
      asOf: "2026-07-14T00:00:00.000Z",
      investigationStatus: "none",
    });
    const older = evaluateGroRecordRetention({
      recordType: "personnel",
      category: "annual-training",
      currentEmployee: true,
      trainingYear: 2024,
      asOf: "2026-07-14T00:00:00.000Z",
      investigationStatus: "none",
    });

    expect(currentWindow).toMatchObject({
      compliant: true,
      facts: { retain: true },
    });
    expect(currentWindow.reasonCodes).toContain(
      GRO_REASON_CODES.RETENTION_TRAINING_WINDOW,
    );
    expect(older).toMatchObject({ compliant: true, facts: { retain: false } });
    expect(older.reasonCodes).toContain(GRO_REASON_CODES.RETENTION_ELIGIBLE);
  });

  it("retains other current-personnel records indefinitely", () => {
    const decision = evaluateGroRecordRetention({
      recordType: "personnel",
      category: "other",
      currentEmployee: true,
      asOf: "2026-07-14T00:00:00.000Z",
      investigationStatus: "none",
    });

    expect(decision.facts).toMatchObject({
      retain: true,
      dispositionEligibleOn: null,
      indefiniteReason: "current-personnel",
    });
  });

  it("retains former-personnel records for one year and through later investigation resolution", () => {
    const oneYear = evaluateGroRecordRetention({
      recordType: "personnel",
      category: "other",
      currentEmployee: false,
      lastDayOfEmployment: "2025-01-01T00:00:00.000Z",
      asOf: "2025-12-31T23:59:59.999Z",
      investigationStatus: "none",
    });
    const afterLaterResolution = evaluateGroRecordRetention({
      recordType: "personnel",
      category: "other",
      currentEmployee: false,
      lastDayOfEmployment: "2025-01-01T00:00:00.000Z",
      investigationStatus: "resolved",
      investigationResolvedAt: "2026-06-01T00:00:00.000Z",
      asOf: "2026-06-01T00:00:00.000Z",
    });

    expect(oneYear.facts).toMatchObject({
      retain: true,
      dispositionEligibleOn: "2026-01-01T00:00:00.000Z",
    });
    expect(afterLaterResolution.facts).toMatchObject({
      retain: false,
      dispositionEligibleOn: "2026-06-01T00:00:00.000Z",
    });
  });

  it("retains child records for two years after discharge", () => {
    const retained = evaluateGroRecordRetention({
      recordType: "child",
      dischargedAt: "2025-01-01T00:00:00.000Z",
      asOf: "2026-12-31T23:59:59.999Z",
      investigationStatus: "none",
    });
    const eligible = evaluateGroRecordRetention({
      recordType: "child",
      dischargedAt: "2025-01-01T00:00:00.000Z",
      asOf: "2027-01-01T00:00:00.000Z",
      investigationStatus: "none",
    });

    expect(retained.facts).toMatchObject({
      retain: true,
      dispositionEligibleOn: "2027-01-01T00:00:00.000Z",
    });
    expect(eligible.facts.retain).toBe(false);
  });

  it("retains open-investigation and not-yet-discharged child records indefinitely", () => {
    const investigation = evaluateGroRecordRetention({
      recordType: "child",
      dischargedAt: "2020-01-01T00:00:00.000Z",
      asOf: "2026-07-14T00:00:00.000Z",
      investigationStatus: "open",
    });
    const admitted = evaluateGroRecordRetention({
      recordType: "child",
      asOf: "2026-07-14T00:00:00.000Z",
      investigationStatus: "none",
    });

    expect(investigation.facts).toMatchObject({
      retain: true,
      indefiniteReason: "open-investigation",
    });
    expect(investigation.reasonCodes).toContain(
      GRO_REASON_CODES.RETENTION_INVESTIGATION_OPEN,
    );
    expect(admitted.facts).toMatchObject({
      retain: true,
      indefiniteReason: "child-not-discharged",
    });
  });

  it("fails closed for unknown record types and invalid evaluation instants", () => {
    const unknown = evaluateGroRecordRetention({
      recordType: "synthetic-record",
      asOf: "2026-07-14T00:00:00.000Z",
      investigationStatus: "none",
    });
    const invalid = evaluateGroRecordRetention({
      recordType: "child",
      asOf: "not-an-instant",
      investigationStatus: "none",
    });

    expect(unknown.compliant).toBe(false);
    expect(unknown.reasonCodes).toContain(GRO_REASON_CODES.INPUT_INVALID);
    expect(invalid.compliant).toBe(false);
    expect(invalid.reasonCodes).toContain(GRO_REASON_CODES.INPUT_INVALID);
  });
});
