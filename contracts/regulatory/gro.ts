/**
 * M1.2-05 — Texas GRO Chapter 748 deterministic policy controls.
 *
 * Controlling source: Texas Secretary of State, 26 TAC Chapter 748, queried
 * as in effect on 2026-07-14. HHSC's Chapter 748 compilation is retained as
 * the agency publication locator; the Secretary of State TAC is authoritative.
 *
 * Texas SOS: https://texas-sos.appianportalsgov.com/rules-and-meetings?interface=VIEW_TAC&title=26&part=1&chapter=748
 * Texas HHSC: https://www.hhs.texas.gov/sites/default/files/documents/doing-business-with-hhs/provider-portal/protective-services/ccl/min-standards/chapter-748-gro.pdf
 *
 * These controls are an auditable prototype policy layer, not a replacement
 * for case-specific legal or licensing review. They use no clock, network,
 * database, or mutable module state; every decision is a pure function of its
 * supplied facts.
 */

const SOS_RULE_QUERY_DATE = "07%2F14%2F2026";

function officialRuleUrl(recordId: number): string {
  return `https://texas-sos.appianportalsgov.com/rules-and-meetings?recordId=${recordId}&queryAsDate=${SOS_RULE_QUERY_DATE}&interface=VIEW_TAC_SUMMARY&$locale=en_US`;
}

export interface GroCitation {
  readonly id: string;
  readonly citation: string;
  readonly subject: string;
  readonly effectiveHistory: string;
  readonly officialUrl: string;
}

export const GRO_CHAPTER_748_CITATIONS = {
  "748.431": {
    id: "748.431",
    citation: "26 TAC §748.431",
    subject: "Personnel record retention",
    effectiveHistory:
      "Effective 2007-01-01; transferred to HHSC effective 2018-03-09",
    officialUrl: officialRuleUrl(189010),
  },
  "748.433": {
    id: "748.433",
    citation: "26 TAC §748.433",
    subject: "Child record retention",
    effectiveHistory:
      "Effective 2007-01-01; amended 2010-09-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189011),
  },
  "748.1003": {
    id: "748.1003",
    citation: "26 TAC §748.1003",
    subject: "Waking-hours child/caregiver ratio",
    effectiveHistory:
      "Effective 2010-09-01; amended 2017-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189102),
  },
  "748.1007": {
    id: "748.1007",
    citation: "26 TAC §748.1007",
    subject: "Night-time sleeping-hours child/caregiver ratio",
    effectiveHistory: "Effective 2010-09-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189104),
  },
  "748.1011": {
    id: "748.1011",
    citation: "26 TAC §748.1011",
    subject: "Caregivers eligible to count in ratio",
    effectiveHistory: "Effective 2007-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189106),
  },
  "748.1013": {
    id: "748.1013",
    citation: "26 TAC §748.1013",
    subject: "Constant supervision during sleeping hours",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189107),
  },
  "748.1015": {
    id: "748.1015",
    citation: "26 TAC §748.1015",
    subject: "Children of caregivers included in ratio",
    effectiveHistory: "Effective 2007-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189108),
  },
  "748.1101": {
    id: "748.1101",
    citation: "26 TAC §748.1101",
    subject: "Rights of a child in care",
    effectiveHistory: "Effective 2017-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189110),
  },
  "748.1103": {
    id: "748.1103",
    citation: "26 TAC §748.1103",
    subject: "Rights review, accessible copy, acknowledgment, and filing",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189111),
  },
  "748.1119": {
    id: "748.1119",
    citation: "26 TAC §748.1119",
    subject: "Techniques prohibited for children",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189118),
  },
  "748.2303": {
    id: "748.2303",
    citation: "26 TAC §748.2303",
    subject: "Corporal punishment prohibited",
    effectiveHistory: "Effective 2007-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189248),
  },
  "748.2307": {
    id: "748.2307",
    citation: "26 TAC §748.2307",
    subject: "Other prohibited punishment methods",
    effectiveHistory:
      "Effective 2007-01-01; transferred 2018-03-09; amended 2022-04-25",
    officialUrl: officialRuleUrl(208618),
  },
  "748.2451": {
    id: "748.2451",
    citation: "26 TAC §748.2451",
    subject:
      "Permitted emergency behavior interventions; chemical restraint prohibited",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-02-07; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189253),
  },
  "748.2455": {
    id: "748.2455",
    citation: "26 TAC §748.2455",
    subject: "Preconditions to emergency behavior intervention",
    effectiveHistory:
      "Effective 2007-01-01; amended 2010-09-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189255),
  },
  "748.2463": {
    id: "748.2463",
    citation: "26 TAC §748.2463",
    subject: "Purposes for which intervention may never be used",
    effectiveHistory: "Effective 2007-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189258),
  },
  "748.2551": {
    id: "748.2551",
    citation: "26 TAC §748.2551",
    subject: "Caregiver responsibilities during intervention",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-02-07; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189263),
  },
  "748.2601": {
    id: "748.2601",
    citation: "26 TAC §748.2601",
    subject: "Monitoring a personal restraint",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-02-07; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189265),
  },
  "748.2603": {
    id: "748.2603",
    citation: "26 TAC §748.2603",
    subject:
      "Immediate release and medical assistance for life-threatening distress",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-02-07; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189266),
  },
  "748.2605": {
    id: "748.2605",
    citation: "26 TAC §748.2605",
    subject:
      "Prohibited personal-restraint techniques and positional safeguards",
    effectiveHistory:
      "Effective 2007-01-01; amended 2010-09-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189267),
  },
  "748.2851": {
    id: "748.2851",
    citation: "26 TAC §748.2851",
    subject: "Post-intervention observation, discussion, debrief, and review",
    effectiveHistory: "Effective 2007-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189281),
  },
  "748.2855": {
    id: "748.2855",
    citation: "26 TAC §748.2855",
    subject: "Intervention documentation deadlines and content",
    effectiveHistory:
      "Effective 2007-01-01; amended 2010-09-01 and 2017-02-07; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189283),
  },
  "748.2857": {
    id: "748.2857",
    citation: "26 TAC §748.2857",
    subject: "Parent notice after emergency behavior intervention",
    effectiveHistory: "Effective 2022-04-25",
    officialUrl: officialRuleUrl(208623),
  },
  "748.2903": {
    id: "748.2903",
    citation: "26 TAC §748.2903",
    subject: "Triggered-review deadline",
    effectiveHistory: "Effective 2007-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189285),
  },
  "748.2907": {
    id: "748.2907",
    citation: "26 TAC §748.2907",
    subject: "Triggered-review content and child-record documentation",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-02-07; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189290),
  },
  "748.3357": {
    id: "748.3357",
    citation: "26 TAC §748.3357",
    subject: "Bedroom usable floor space and maximum occupancy",
    effectiveHistory:
      "Effective 2007-01-01; amended 2017-01-01; transferred 2018-03-09",
    officialUrl: officialRuleUrl(189364),
  },
} as const satisfies Record<string, GroCitation>;

type GroCitationId = keyof typeof GRO_CHAPTER_748_CITATIONS;

export const GRO_CHAPTER_748_POLICY_METADATA = {
  policyId: "M1.2-05-GRO-748",
  title: "Texas Chapter 748 General Residential Operation Controls",
  jurisdiction: "Texas",
  titlePartChapter: "26 TAC, Part 1, Chapter 748",
  verifiedAsInEffectOn: "2026-07-14",
  authoritativeSource: "Texas Secretary of State Rules and Meetings portal",
  authoritativeChapterUrl:
    "https://texas-sos.appianportalsgov.com/rules-and-meetings?interface=VIEW_TAC&title=26&part=1&chapter=748",
  agencyCompilationUrl:
    "https://www.hhs.texas.gov/sites/default/files/documents/doing-business-with-hhs/provider-portal/protective-services/ccl/min-standards/chapter-748-gro.pdf",
  rules: Object.values(GRO_CHAPTER_748_CITATIONS),
  controlledAssumptions: [
    "A seven-day rights deadline is evaluated as 168 elapsed hours from the supplied admission instant.",
    "A child younger than five contributes two ratio units; all other included children contribute one.",
    "For a child who is unresponsive, cannot breathe, or has potentially life-threatening distress, documented health-care-professional evaluation is required as prototype evidence that medical assistance was immediately sought. Section 748.2603 expressly requires immediate assistance, but does not state a separate completion deadline for that evaluation.",
    "An unknown practice, intervention, caregiver status, or record type is denied rather than inferred compliant.",
  ],
} as const;

export const GRO_REASON_CODES = {
  INPUT_INVALID: "GRO_INPUT_INVALID",
  RATIO_COMPLIANT: "GRO_RATIO_COMPLIANT",
  RATIO_INSUFFICIENT: "GRO_RATIO_INSUFFICIENT_QUALIFIED_CAREGIVERS",
  RATIO_CAREGIVER_EXCLUDED:
    "GRO_RATIO_CAREGIVER_EXCLUDED_NOT_QUALIFIED_OR_DIRECT",
  RATIO_SLEEPING_CAREGIVER_EXCLUDED:
    "GRO_RATIO_SLEEPING_CAREGIVER_EXCLUDED_WHILE_CHILDREN_AWAKE",
  RATIO_UNDER_FIVE_WEIGHTED: "GRO_RATIO_UNDER_FIVE_WEIGHT_APPLIED",
  RATIO_CAREGIVER_CHILD_INCLUDED: "GRO_RATIO_CAREGIVER_CHILD_INCLUDED",
  RATIO_UNSUPERVISED_ACTIVITY_EXCLUDED:
    "GRO_RATIO_APPROVED_UNSUPERVISED_ACTIVITY_EXCLUDED",
  RATIO_CONSTANT_SUPERVISION_NEEDS_AWAKE:
    "GRO_RATIO_CONSTANT_SUPERVISION_REQUIRES_AWAKE_CAREGIVER",
  RATIO_COTTAGE_EXCEPTION_APPLIED:
    "GRO_RATIO_COTTAGE_HOME_TEMPORARY_EXCEPTION_APPLIED",
  RATIO_COTTAGE_EXCEPTION_INCOMPLETE:
    "GRO_RATIO_COTTAGE_HOME_EXCEPTION_EVIDENCE_INCOMPLETE",
  RATIO_ADULT_MIX_REQUIRES_REVIEW:
    "GRO_RATIO_ADULT_RESIDENT_MIX_REQUIRES_748_1935_REVIEW",
  BEDROOM_COMPLIANT: "GRO_BEDROOM_COMPLIANT",
  BEDROOM_SPACE_INSUFFICIENT: "GRO_BEDROOM_USABLE_FLOOR_SPACE_INSUFFICIENT",
  BEDROOM_OCCUPANCY_EXCEEDED: "GRO_BEDROOM_MAXIMUM_OCCUPANCY_EXCEEDED",
  BEDROOM_PRIMARY_MEDICAL_EXCEPTION:
    "GRO_BEDROOM_PRIMARY_MEDICAL_NEEDS_EXCEPTION_APPLIED",
  BEDROOM_LEGACY_OCCUPANCY_EXCEPTION:
    "GRO_BEDROOM_LEGACY_OCCUPANCY_EXCEPTION_APPLIED",
  BEDROOM_LEGACY_SPACE_EXCEPTION:
    "GRO_BEDROOM_LEGACY_EMERGENCY_SPACE_EXCEPTION_APPLIED",
  RIGHTS_COMPLIANT: "GRO_RIGHTS_DELIVERY_COMPLIANT",
  RIGHTS_DOCUMENT_NOT_PLAIN: "GRO_RIGHTS_DOCUMENT_NOT_SIMPLE_NONTECHNICAL",
  RIGHTS_RECIPIENT_MISSING: "GRO_RIGHTS_REQUIRED_RECIPIENT_EVIDENCE_MISSING",
  RIGHTS_REVIEW_MISSING: "GRO_RIGHTS_REVIEW_MISSING",
  RIGHTS_REVIEW_LATE: "GRO_RIGHTS_REVIEW_AFTER_SEVEN_DAYS",
  RIGHTS_COPY_MISSING: "GRO_RIGHTS_WRITTEN_COPY_MISSING",
  RIGHTS_COPY_LATE: "GRO_RIGHTS_WRITTEN_COPY_AFTER_SEVEN_DAYS",
  RIGHTS_LANGUAGE_INACCESSIBLE:
    "GRO_RIGHTS_PRIMARY_LANGUAGE_COPY_MISSING_WHEN_POSSIBLE",
  RIGHTS_LANGUAGE_EXCEPTION: "GRO_RIGHTS_PRIMARY_LANGUAGE_COPY_NOT_POSSIBLE",
  RIGHTS_IMPAIRMENT_INACCESSIBLE: "GRO_RIGHTS_IMPAIRMENT_ACCESS_NOT_PROVIDED",
  RIGHTS_ACK_MISSING: "GRO_RIGHTS_SIGNED_ACKNOWLEDGMENT_MISSING",
  RIGHTS_ACK_INVALID:
    "GRO_RIGHTS_ACKNOWLEDGMENT_DOES_NOT_CONFIRM_UNDERSTANDING",
  RIGHTS_ACK_NOT_FILED: "GRO_RIGHTS_ACKNOWLEDGMENT_NOT_IN_CHILD_RECORD",
  RIGHTS_PARENT_NOT_REQUIRED: "GRO_RIGHTS_PARENT_REVIEW_NOT_REQUIRED",
  PRACTICE_PERMITTED: "GRO_PRACTICE_PERMITTED_SUPPORTIVE_TECHNIQUE",
  PRACTICE_PROHIBITED: "GRO_PRACTICE_PROHIBITED",
  PRACTICE_INTERVENTION_PROTOCOL_REQUIRED:
    "GRO_PRACTICE_EMERGENCY_INTERVENTION_PROTOCOL_REQUIRED",
  PRACTICE_UNKNOWN_DENIED: "GRO_PRACTICE_UNCLASSIFIED_DENIED",
  RESTRAINT_COMPLIANT: "GRO_RESTRAINT_COMPLIANT",
  RESTRAINT_POLICY_NOT_PERMITTED:
    "GRO_RESTRAINT_NOT_PERMITTED_BY_OPERATION_POLICY",
  RESTRAINT_LESS_RESTRICTIVE_NOT_EXHAUSTED:
    "GRO_RESTRAINT_LESS_RESTRICTIVE_INTERVENTIONS_NOT_EXHAUSTED",
  RESTRAINT_BASIS_INVALID: "GRO_RESTRAINT_BASIS_NOT_PERMITTED",
  RESTRAINT_PURPOSE_PROHIBITED: "GRO_RESTRAINT_PURPOSE_PROHIBITED",
  RESTRAINT_FORCE_EXCESSIVE: "GRO_RESTRAINT_FORCE_NOT_MINIMAL",
  RESTRAINT_PRIVACY_DIGNITY_FAILURE:
    "GRO_RESTRAINT_PRIVACY_OR_DIGNITY_NOT_PROTECTED",
  RESTRAINT_MONITOR_UNQUALIFIED: "GRO_RESTRAINT_MONITOR_NOT_QUALIFIED",
  RESTRAINT_MONITORING_INCOMPLETE: "GRO_RESTRAINT_MONITORING_INCOMPLETE",
  RESTRAINT_TECHNIQUE_PROHIBITED: "GRO_RESTRAINT_TECHNIQUE_PROHIBITED",
  RESTRAINT_TECHNIQUE_UNKNOWN: "GRO_RESTRAINT_TECHNIQUE_UNCLASSIFIED_DENIED",
  RESTRAINT_POSITIONAL_LIMIT:
    "GRO_RESTRAINT_PRONE_SUPINE_TRANSITION_EXCEEDS_ONE_MINUTE",
  RESTRAINT_POSITIONAL_NOT_LAST_RESORT:
    "GRO_RESTRAINT_PRONE_SUPINE_NOT_LAST_RESORT",
  RESTRAINT_OBSERVER_MISSING:
    "GRO_RESTRAINT_REQUIRED_INDEPENDENT_OBSERVER_MISSING",
  RESTRAINT_SMALL_OPERATION_OBSERVER_EXCEPTION:
    "GRO_RESTRAINT_CAPACITY_16_OR_FEWER_OBSERVER_EXCEPTION",
  RESTRAINT_IMMEDIATE_RELEASE_MISSING:
    "GRO_RESTRAINT_IMMEDIATE_RELEASE_NOT_DOCUMENTED",
  RESTRAINT_MEDICAL_ASSISTANCE_MISSING:
    "GRO_RESTRAINT_IMMEDIATE_MEDICAL_ASSISTANCE_NOT_DOCUMENTED",
  RESTRAINT_MEDICAL_EVALUATION_MISSING:
    "GRO_RESTRAINT_HEALTHCARE_EVALUATION_NOT_DOCUMENTED",
  POST_COMPLIANT: "GRO_POST_INTERVENTION_COMPLIANT",
  POST_FOLLOWUP_EXCEPTION: "GRO_POST_INTERVENTION_748_2851_EXCEPTION_APPLIED",
  POST_OBSERVATION_SHORT: "GRO_POST_INTERVENTION_OBSERVATION_UNDER_15_MINUTES",
  POST_DISCUSSION_LATE:
    "GRO_POST_INTERVENTION_CHILD_DISCUSSION_MISSING_OR_LATE",
  POST_DEBRIEF_MISSING: "GRO_POST_INTERVENTION_CAREGIVER_DEBRIEF_MISSING",
  POST_WITNESS_DEBRIEF_MISSING:
    "GRO_POST_INTERVENTION_WITNESS_DEBRIEF_EFFORT_MISSING",
  POST_SUPERVISOR_REVIEW_LATE:
    "GRO_POST_INTERVENTION_SUPERVISOR_REVIEW_MISSING_OR_LATE",
  POST_DOCUMENTATION_LATE:
    "GRO_POST_INTERVENTION_DOCUMENTATION_MISSING_OR_LATE",
  POST_PARENT_NOTICE_LATE:
    "GRO_POST_INTERVENTION_PARENT_NOTICE_MISSING_OR_LATE",
  POST_TRIGGERED_REVIEW_LATE: "GRO_TRIGGERED_REVIEW_MISSING_OR_AFTER_30_DAYS",
  POST_TRIGGERED_REVIEW_INCOMPLETE:
    "GRO_TRIGGERED_REVIEW_CONTENT_OR_RECORD_INCOMPLETE",
  RETENTION_REQUIRED: "GRO_RECORD_RETENTION_REQUIRED",
  RETENTION_INVESTIGATION_OPEN: "GRO_RECORD_RETENTION_INVESTIGATION_OPEN",
  RETENTION_ELIGIBLE: "GRO_RECORD_ELIGIBLE_FOR_CONTROLLED_DISPOSITION",
  RETENTION_TRAINING_WINDOW:
    "GRO_PERSONNEL_TRAINING_CURRENT_AND_PRIOR_YEAR_REQUIRED",
} as const;

export type GroReasonCode =
  (typeof GRO_REASON_CODES)[keyof typeof GRO_REASON_CODES];
export type GroFindingLevel = "pass" | "fail" | "exception" | "info";

export interface GroFinding {
  readonly code: GroReasonCode;
  readonly level: GroFindingLevel;
  readonly message: string;
  readonly citationIds: readonly GroCitationId[];
}

export interface GroControlResult<TFacts> {
  readonly policyId: typeof GRO_CHAPTER_748_POLICY_METADATA.policyId;
  readonly controlId: string;
  readonly outcome: "compliant" | "noncompliant";
  readonly compliant: boolean;
  readonly reasonCodes: readonly GroReasonCode[];
  readonly findings: readonly GroFinding[];
  readonly citations: readonly GroCitation[];
  readonly facts: Readonly<TFacts>;
}

function finding(
  code: GroReasonCode,
  level: GroFindingLevel,
  message: string,
  citationIds: readonly GroCitationId[],
): GroFinding {
  return { code, level, message, citationIds };
}

function result<TFacts>(
  controlId: string,
  findings: readonly GroFinding[],
  facts: TFacts,
): GroControlResult<TFacts> {
  const compliant = findings.every((item) => item.level !== "fail");
  const citationIds = [
    ...new Set(findings.flatMap((item) => item.citationIds)),
  ];
  return {
    policyId: GRO_CHAPTER_748_POLICY_METADATA.policyId,
    controlId,
    outcome: compliant ? "compliant" : "noncompliant",
    compliant,
    reasonCodes: [...new Set(findings.map((item) => item.code))],
    findings,
    citations: citationIds.map((id) => GRO_CHAPTER_748_CITATIONS[id]),
    facts,
  };
}

function validFinite(value: number): boolean {
  return Number.isFinite(value);
}

function instant(value: string | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

function noLaterThan(
  value: number,
  anchor: number,
  durationMs: number,
): boolean {
  return value >= anchor && value <= anchor + durationMs;
}

export interface GroRatioChild {
  readonly id: string;
  readonly ageYears: number;
  readonly requiresTreatmentServices: boolean;
  readonly requiresConstantSupervision?: boolean;
  readonly approvedUnsupervisedChildhoodActivity?: boolean;
  readonly relationship?: "child-in-care" | "caregiver-child";
}

export interface GroRatioCaregiver {
  readonly id: string;
  readonly qualified: boolean;
  readonly workingDirectlyWithGroup: boolean;
  readonly status: "awake" | "sleeping" | string;
}

export interface GroCottageRatioException {
  readonly forNormalHomeLikeRoutine: boolean;
  readonly shortPeriod: boolean;
  readonly careAndSupervisionNeedsMet: boolean;
  readonly additionalStaffOrCaregiversOnPremisesAndAvailable: boolean;
  readonly addressedInWrittenProfessionalStaffingPlan: boolean;
}

export interface GroSupervisionRatioInput {
  readonly period: "children-awake" | "night-sleeping" | string;
  readonly children: readonly GroRatioChild[];
  readonly caregivers: readonly GroRatioCaregiver[];
  readonly adultResidentsPresent?: boolean;
  readonly setting?: "cottage-home" | "other";
  readonly cottageTemporaryException?: GroCottageRatioException;
}

export interface GroSupervisionRatioFacts {
  readonly includedChildCount: number;
  readonly weightedChildUnits: number;
  readonly underFiveCount: number;
  readonly treatmentServicesPresent: boolean;
  readonly eligibleAwakeCaregivers: number;
  readonly eligibleSleepingCaregivers: number;
  readonly availableCapacityUnits: number;
  readonly requiredAdditionalCapacityUnits: number;
  readonly cottageExceptionApplied: boolean;
}

export function evaluateGroSupervisionRatio(
  input: GroSupervisionRatioInput,
): GroControlResult<GroSupervisionRatioFacts> {
  const findings: GroFinding[] = [];
  const invalidPeriod =
    input.period !== "children-awake" && input.period !== "night-sleeping";
  const invalidChildren =
    !Array.isArray(input.children) ||
    input.children.some(
      (child) =>
        !child.id ||
        !validFinite(child.ageYears) ||
        child.ageYears < 0 ||
        typeof child.requiresTreatmentServices !== "boolean",
    ) ||
    new Set(input.children.map((child) => child.id)).size !==
      input.children.length;
  const invalidCaregivers =
    !Array.isArray(input.caregivers) ||
    input.caregivers.some(
      (caregiver) =>
        !caregiver.id ||
        typeof caregiver.qualified !== "boolean" ||
        typeof caregiver.workingDirectlyWithGroup !== "boolean" ||
        (caregiver.status !== "awake" && caregiver.status !== "sleeping"),
    ) ||
    new Set(input.caregivers.map((caregiver) => caregiver.id)).size !==
      input.caregivers.length;

  if (invalidPeriod || invalidChildren || invalidCaregivers) {
    findings.push(
      finding(
        GRO_REASON_CODES.INPUT_INVALID,
        "fail",
        "Ratio facts must use a known period, unique identifiers, nonnegative ages, and known caregiver statuses.",
        ["748.1003", "748.1007", "748.1011"],
      ),
    );
  }

  const included = input.children.filter(
    (child) => !child.approvedUnsupervisedChildhoodActivity,
  );
  const underFiveCount = included.filter((child) => child.ageYears < 5).length;
  const weightedChildUnits = included.reduce(
    (total, child) => total + (child.ageYears < 5 ? 2 : 1),
    0,
  );
  const treatmentServicesPresent = included.some(
    (child) => child.requiresTreatmentServices,
  );
  const eligible = input.caregivers.filter(
    (caregiver) => caregiver.qualified && caregiver.workingDirectlyWithGroup,
  );
  const eligibleAwake = eligible.filter(
    (caregiver) => caregiver.status === "awake",
  );
  const eligibleSleeping = eligible.filter(
    (caregiver) => caregiver.status === "sleeping",
  );
  const wakingCapacityPerCaregiver = treatmentServicesPresent ? 5 : 8;
  const nightAwakeCapacityPerCaregiver = treatmentServicesPresent ? 15 : 24;
  const nightSleepingCapacityPerCaregiver = treatmentServicesPresent ? 10 : 16;
  const availableCapacityUnits =
    input.period === "children-awake"
      ? eligibleAwake.length * wakingCapacityPerCaregiver
      : eligibleAwake.length * nightAwakeCapacityPerCaregiver +
        eligibleSleeping.length * nightSleepingCapacityPerCaregiver;

  if (underFiveCount > 0) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_UNDER_FIVE_WEIGHTED,
        "info",
        `${underFiveCount} child(ren) younger than five were counted as two ratio units each.`,
        input.period === "night-sleeping" ? ["748.1007"] : ["748.1003"],
      ),
    );
  }
  if (
    input.children.some((child) => child.approvedUnsupervisedChildhoodActivity)
  ) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_UNSUPERVISED_ACTIVITY_EXCLUDED,
        "info",
        "Children in an approved unsupervised childhood activity were excluded from the waking-hours count.",
        ["748.1003"],
      ),
    );
  }
  if (included.some((child) => child.relationship === "caregiver-child")) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_CAREGIVER_CHILD_INCLUDED,
        "info",
        "Children of caregivers who are present with children in care were included in the ratio.",
        ["748.1015"],
      ),
    );
  }
  if (eligible.length < input.caregivers.length) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_CAREGIVER_EXCLUDED,
        "info",
        "Only qualified caregivers working directly with the group were counted.",
        ["748.1011"],
      ),
    );
  }
  if (input.period === "children-awake" && eligibleSleeping.length > 0) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_SLEEPING_CAREGIVER_EXCLUDED,
        "info",
        "Sleeping caregivers were not credited while children were awake.",
        ["748.1003", "748.1011"],
      ),
    );
  }
  if (input.adultResidentsPresent) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_ADULT_MIX_REQUIRES_REVIEW,
        "fail",
        "A mixed child/adult resident group requires the additional §748.1935 calculation, which was not supplied.",
        ["748.1015"],
      ),
    );
  }

  const needsConstantSupervision =
    input.period === "night-sleeping" &&
    included.some((child) => child.requiresConstantSupervision);
  const constantSupervisionFailure =
    needsConstantSupervision && eligibleAwake.length === 0;
  if (constantSupervisionFailure) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_CONSTANT_SUPERVISION_NEEDS_AWAKE,
        "fail",
        "At least one qualified, directly assigned caregiver must remain awake for a child needing constant supervision.",
        ["748.1013"],
      ),
    );
  }

  const shortfall = Math.max(0, weightedChildUnits - availableCapacityUnits);
  const exception = input.cottageTemporaryException;
  const exceptionComplete =
    input.setting === "cottage-home" &&
    exception?.forNormalHomeLikeRoutine === true &&
    exception.shortPeriod === true &&
    exception.careAndSupervisionNeedsMet === true &&
    exception.additionalStaffOrCaregiversOnPremisesAndAvailable === true &&
    exception.addressedInWrittenProfessionalStaffingPlan === true;
  const cottageExceptionApplied =
    shortfall > 0 && exceptionComplete && !constantSupervisionFailure;

  if (shortfall > 0 && cottageExceptionApplied) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_COTTAGE_EXCEPTION_APPLIED,
        "exception",
        "A fully evidenced, short cottage-home routine exception was applied to the ratio shortfall.",
        input.period === "night-sleeping" ? ["748.1007"] : ["748.1003"],
      ),
    );
  } else if (shortfall > 0) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_INSUFFICIENT,
        "fail",
        `The group exceeds qualified caregiver capacity by ${shortfall} weighted child unit(s).`,
        input.period === "night-sleeping"
          ? ["748.1007", "748.1011"]
          : ["748.1003", "748.1011"],
      ),
    );
    if (exception && !exceptionComplete) {
      findings.push(
        finding(
          GRO_REASON_CODES.RATIO_COTTAGE_EXCEPTION_INCOMPLETE,
          "fail",
          "The claimed cottage-home exception is missing one or more required safeguards.",
          input.period === "night-sleeping" ? ["748.1007"] : ["748.1003"],
        ),
      );
    }
  } else if (!invalidPeriod && !invalidChildren && !invalidCaregivers) {
    findings.push(
      finding(
        GRO_REASON_CODES.RATIO_COMPLIANT,
        "pass",
        "Weighted children do not exceed the capacity of eligible caregivers.",
        input.period === "night-sleeping"
          ? ["748.1007", "748.1011"]
          : ["748.1003", "748.1011"],
      ),
    );
  }

  return result("GRO-748-RATIO", findings, {
    includedChildCount: included.length,
    weightedChildUnits,
    underFiveCount,
    treatmentServicesPresent,
    eligibleAwakeCaregivers: eligibleAwake.length,
    eligibleSleepingCaregivers: eligibleSleeping.length,
    availableCapacityUnits,
    requiredAdditionalCapacityUnits: shortfall,
    cottageExceptionApplied,
  });
}

export interface GroLegacyBedroomPermit {
  readonly grantedBefore2007: boolean;
  readonly emergencyCarePermit: boolean;
  readonly operationMovedSincePermit: boolean;
  readonly bedroomAddedSincePermit: boolean;
  readonly permitStillValid: boolean;
}

export interface GroBedroomInput {
  readonly occupantCount: number;
  readonly grossFloorSquareFeet: number;
  readonly closetAndAlcoveSquareFeet: number;
  readonly allOccupantsReceivePrimaryMedicalNeedsTreatment?: boolean;
  readonly legacyPermit?: GroLegacyBedroomPermit;
}

export interface GroBedroomFacts {
  readonly occupantCount: number;
  readonly usableFloorSquareFeet: number;
  readonly requiredFloorSquareFeet: number;
  readonly maximumOccupancy: number | null;
  readonly legacySpaceExceptionApplied: boolean;
  readonly legacyOccupancyExceptionApplied: boolean;
  readonly primaryMedicalNeedsExceptionApplied: boolean;
}

export function evaluateGroBedroom(
  input: GroBedroomInput,
): GroControlResult<GroBedroomFacts> {
  const findings: GroFinding[] = [];
  const invalid =
    !Number.isInteger(input.occupantCount) ||
    input.occupantCount < 1 ||
    !validFinite(input.grossFloorSquareFeet) ||
    !validFinite(input.closetAndAlcoveSquareFeet) ||
    input.grossFloorSquareFeet < 0 ||
    input.closetAndAlcoveSquareFeet < 0 ||
    input.closetAndAlcoveSquareFeet > input.grossFloorSquareFeet;
  if (invalid) {
    findings.push(
      finding(
        GRO_REASON_CODES.INPUT_INVALID,
        "fail",
        "Bedroom occupancy and nonnegative floor-space measurements are required; excluded space cannot exceed gross space.",
        ["748.3357"],
      ),
    );
  }

  const usableFloorSquareFeet = Math.max(
    0,
    input.grossFloorSquareFeet - input.closetAndAlcoveSquareFeet,
  );
  const legacy = input.legacyPermit;
  const legacyConditionsRemain =
    legacy?.grantedBefore2007 === true &&
    legacy.permitStillValid === true &&
    legacy.operationMovedSincePermit === false &&
    legacy.bedroomAddedSincePermit === false;
  const legacyOccupancyExceptionApplied =
    input.occupantCount > 4 && legacyConditionsRemain;
  const legacySpaceExceptionApplied =
    input.occupantCount > 1 &&
    legacyConditionsRemain &&
    legacy?.emergencyCarePermit === true;
  const primaryMedicalNeedsExceptionApplied =
    input.occupantCount > 4 &&
    input.allOccupantsReceivePrimaryMedicalNeedsTreatment === true;
  const requiredFloorSquareFeet =
    input.occupantCount === 1 ? 80 : input.occupantCount * 60;
  const maximumOccupancy =
    legacyOccupancyExceptionApplied || primaryMedicalNeedsExceptionApplied
      ? null
      : 4;

  if (legacyOccupancyExceptionApplied) {
    findings.push(
      finding(
        GRO_REASON_CODES.BEDROOM_LEGACY_OCCUPANCY_EXCEPTION,
        "exception",
        "The pre-2007 permit exception was applied to the four-occupant limit.",
        ["748.3357"],
      ),
    );
  } else if (primaryMedicalNeedsExceptionApplied) {
    findings.push(
      finding(
        GRO_REASON_CODES.BEDROOM_PRIMARY_MEDICAL_EXCEPTION,
        "exception",
        "The primary-medical-needs treatment exception was applied to the four-occupant limit.",
        ["748.3357"],
      ),
    );
  } else if (input.occupantCount > 4) {
    findings.push(
      finding(
        GRO_REASON_CODES.BEDROOM_OCCUPANCY_EXCEEDED,
        "fail",
        "A bedroom may not have more than four occupants without a documented exception.",
        ["748.3357"],
      ),
    );
  }

  if (legacySpaceExceptionApplied) {
    findings.push(
      finding(
        GRO_REASON_CODES.BEDROOM_LEGACY_SPACE_EXCEPTION,
        "exception",
        "The qualifying pre-2007 emergency-care permit exception was applied to the 60-square-foot-per-occupant requirement.",
        ["748.3357"],
      ),
    );
  } else if (usableFloorSquareFeet < requiredFloorSquareFeet) {
    findings.push(
      finding(
        GRO_REASON_CODES.BEDROOM_SPACE_INSUFFICIENT,
        "fail",
        `The room has ${usableFloorSquareFeet} usable square feet; ${requiredFloorSquareFeet} are required.`,
        ["748.3357"],
      ),
    );
  }

  if (!invalid && findings.every((item) => item.level !== "fail")) {
    findings.push(
      finding(
        GRO_REASON_CODES.BEDROOM_COMPLIANT,
        "pass",
        "The bedroom satisfies the applicable usable-space and occupancy controls.",
        ["748.3357"],
      ),
    );
  }

  return result("GRO-748-BEDROOM", findings, {
    occupantCount: input.occupantCount,
    usableFloorSquareFeet,
    requiredFloorSquareFeet,
    maximumOccupancy,
    legacySpaceExceptionApplied,
    legacyOccupancyExceptionApplied,
    primaryMedicalNeedsExceptionApplied,
  });
}

export interface GroRightsRecipientEvidence {
  readonly reviewedAt?: string;
  readonly writtenCopyProvidedAt?: string;
  readonly understandsEnglish: boolean;
  readonly primaryLanguageCopyPossible?: boolean;
  readonly writtenCopyInPrimaryLanguage?: boolean;
  readonly hasVisualOrAuditoryImpairment?: boolean;
  readonly accessibleExplanationProvided?: boolean;
  readonly acknowledgmentSignedAt?: string;
  readonly acknowledgmentConfirmsReadAndUnderstands: boolean;
  readonly acknowledgmentFiledInChildRecord: boolean;
}

export interface GroYouthRightsInput {
  readonly admittedAt: string;
  readonly rightsDocumentUsesSimpleNonTechnicalTerms: boolean;
  readonly parentConsentRequired: boolean;
  readonly child: GroRightsRecipientEvidence;
  readonly parent?: GroRightsRecipientEvidence;
}

export interface GroYouthRightsFacts {
  readonly admissionInstant: string;
  readonly deadlineInstant: string | null;
  readonly evaluatedRecipients: readonly ("child" | "parent")[];
  readonly parentEvidenceRequired: boolean;
}

export function evaluateGroYouthRights(
  input: GroYouthRightsInput,
): GroControlResult<GroYouthRightsFacts> {
  const findings: GroFinding[] = [];
  const admittedAt = instant(input.admittedAt);
  if (admittedAt === null) {
    findings.push(
      finding(
        GRO_REASON_CODES.INPUT_INVALID,
        "fail",
        "Admission must be a valid ISO-8601 instant with a timezone.",
        ["748.1103"],
      ),
    );
  }
  if (!input.rightsDocumentUsesSimpleNonTechnicalTerms) {
    findings.push(
      finding(
        GRO_REASON_CODES.RIGHTS_DOCUMENT_NOT_PLAIN,
        "fail",
        "The written rights are not attested as simple and non-technical.",
        ["748.1103"],
      ),
    );
  }

  const recipients: Array<["child" | "parent", GroRightsRecipientEvidence]> = [
    ["child", input.child],
  ];
  if (input.parentConsentRequired) {
    if (input.parent) recipients.push(["parent", input.parent]);
    else {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_RECIPIENT_MISSING,
          "fail",
          "Parent rights evidence is required when parent consent is required.",
          ["748.1103"],
        ),
      );
    }
  } else {
    findings.push(
      finding(
        GRO_REASON_CODES.RIGHTS_PARENT_NOT_REQUIRED,
        "exception",
        "Parent review evidence was not required because parent consent is not required.",
        ["748.1103"],
      ),
    );
  }

  for (const [recipientName, evidence] of recipients) {
    const reviewedAt = instant(evidence.reviewedAt);
    const copyAt = instant(evidence.writtenCopyProvidedAt);
    const acknowledgmentAt = instant(evidence.acknowledgmentSignedAt);
    if (reviewedAt === null) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_REVIEW_MISSING,
          "fail",
          `${recipientName} rights review evidence is missing or invalid.`,
          ["748.1103"],
        ),
      );
    } else if (
      admittedAt !== null &&
      !noLaterThan(reviewedAt, admittedAt, 7 * DAY_MS)
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_REVIEW_LATE,
          "fail",
          `${recipientName} rights review occurred after the seven-day deadline or before admission.`,
          ["748.1103"],
        ),
      );
    }
    if (copyAt === null) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_COPY_MISSING,
          "fail",
          `${recipientName} written-copy evidence is missing or invalid.`,
          ["748.1103"],
        ),
      );
    } else if (
      admittedAt !== null &&
      !noLaterThan(copyAt, admittedAt, 7 * DAY_MS)
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_COPY_LATE,
          "fail",
          `${recipientName} written rights were provided after the seven-day deadline or before admission.`,
          ["748.1103"],
        ),
      );
    }
    if (!evidence.understandsEnglish) {
      if (evidence.primaryLanguageCopyPossible === false) {
        findings.push(
          finding(
            GRO_REASON_CODES.RIGHTS_LANGUAGE_EXCEPTION,
            "exception",
            `${recipientName} primary-language copy was documented as not possible.`,
            ["748.1103"],
          ),
        );
      } else if (!evidence.writtenCopyInPrimaryLanguage) {
        findings.push(
          finding(
            GRO_REASON_CODES.RIGHTS_LANGUAGE_INACCESSIBLE,
            "fail",
            `${recipientName} did not receive a primary-language copy when one was possible.`,
            ["748.1103"],
          ),
        );
      }
    }
    if (
      evidence.hasVisualOrAuditoryImpairment &&
      !evidence.accessibleExplanationProvided
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_IMPAIRMENT_INACCESSIBLE,
          "fail",
          `${recipientName} did not receive an understandable accessible explanation.`,
          ["748.1103"],
        ),
      );
    }
    if (acknowledgmentAt === null) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_ACK_MISSING,
          "fail",
          `${recipientName} signed acknowledgment is missing or invalid.`,
          ["748.1103"],
        ),
      );
    } else if (
      (reviewedAt !== null && acknowledgmentAt < reviewedAt) ||
      (admittedAt !== null &&
        !noLaterThan(acknowledgmentAt, admittedAt, 7 * DAY_MS))
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_ACK_MISSING,
          "fail",
          `${recipientName} acknowledgment was signed before review or after the delivery deadline.`,
          ["748.1103"],
        ),
      );
    }
    if (!evidence.acknowledgmentConfirmsReadAndUnderstands) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_ACK_INVALID,
          "fail",
          `${recipientName} acknowledgment does not attest that the rights were read and understood.`,
          ["748.1103"],
        ),
      );
    }
    if (!evidence.acknowledgmentFiledInChildRecord) {
      findings.push(
        finding(
          GRO_REASON_CODES.RIGHTS_ACK_NOT_FILED,
          "fail",
          `${recipientName} signed acknowledgment is not filed in the child's record.`,
          ["748.1103"],
        ),
      );
    }
  }

  if (findings.every((item) => item.level !== "fail")) {
    findings.push(
      finding(
        GRO_REASON_CODES.RIGHTS_COMPLIANT,
        "pass",
        "Required recipients received an accessible review and copy, signed acknowledgment, and record filing.",
        ["748.1101", "748.1103"],
      ),
    );
  }

  return result("GRO-748-YOUTH-RIGHTS", findings, {
    admissionInstant: input.admittedAt,
    deadlineInstant:
      admittedAt === null
        ? null
        : new Date(admittedAt + 7 * DAY_MS).toISOString(),
    evaluatedRecipients: recipients.map(([name]) => name),
    parentEvidenceRequired: input.parentConsentRequired,
  });
}

export const GRO_PROHIBITED_PRACTICES = [
  "chemical-restraint",
  "aversive-conditioning",
  "pressure-points",
  "rebirthing-therapy",
  "hug-or-holding-therapy",
  "taser-or-stun-gun",
  "corporal-punishment",
  "threatened-corporal-punishment",
  "physical-exercise-as-punishment",
  "forced-position-as-punishment",
  "unproductive-work-as-punishment",
  "harsh-cruel-unusual-unnecessary-demeaning-or-humiliating-punishment",
  "deny-mail-or-family-visits-as-punishment",
  "threaten-loss-of-placement",
  "sarcastic-or-cruel-humor",
  "pinch-pull-hair-bite-or-shake",
  "object-in-or-on-mouth",
  "humiliate-shame-ridicule-reject-or-yell",
  "abusive-or-profane-language",
  "dark-room-bathroom-or-closet-confinement",
  "inappropriately-long-silence-or-inactivity",
  "furniture-or-equipment-confinement-as-punishment",
  "deny-basic-rights-as-punishment",
  "withhold-nutritionally-required-food",
  "emergency-intervention-as-punishment-or-threat",
] as const;

export const GRO_SUPPORTIVE_PRACTICES = [
  "verbal-deescalation",
  "positive-reinforcement",
  "redirection",
  "trauma-informed-choice",
] as const;

const GRO_EMERGENCY_INTERVENTION_PRACTICES = [
  "short-personal-restraint",
  "personal-restraint",
  "emergency-medication",
  "seclusion",
  "mechanical-restraint",
] as const;

export interface GroPracticeInput {
  readonly practiceCode: string;
}

export interface GroPracticeFacts {
  readonly practiceCode: string;
  readonly classification:
    "supportive" | "prohibited" | "intervention-requires-evidence" | "unknown";
}

export function evaluateGroPractice(
  input: GroPracticeInput,
): GroControlResult<GroPracticeFacts> {
  const prohibited = (GRO_PROHIBITED_PRACTICES as readonly string[]).includes(
    input.practiceCode,
  );
  const supportive = (GRO_SUPPORTIVE_PRACTICES as readonly string[]).includes(
    input.practiceCode,
  );
  const intervention = (
    GRO_EMERGENCY_INTERVENTION_PRACTICES as readonly string[]
  ).includes(input.practiceCode);
  const classification: GroPracticeFacts["classification"] = prohibited
    ? "prohibited"
    : supportive
      ? "supportive"
      : intervention
        ? "intervention-requires-evidence"
        : "unknown";
  const findings: GroFinding[] = [];

  if (prohibited) {
    findings.push(
      finding(
        GRO_REASON_CODES.PRACTICE_PROHIBITED,
        "fail",
        `Practice '${input.practiceCode}' is prohibited.`,
        ["748.1119", "748.2303", "748.2307", "748.2451", "748.2463"],
      ),
    );
  } else if (supportive) {
    findings.push(
      finding(
        GRO_REASON_CODES.PRACTICE_PERMITTED,
        "pass",
        `Practice '${input.practiceCode}' is classified as a nonphysical supportive technique.`,
        ["748.2455", "748.2551"],
      ),
    );
  } else if (intervention) {
    findings.push(
      finding(
        GRO_REASON_CODES.PRACTICE_INTERVENTION_PROTOCOL_REQUIRED,
        "fail",
        "An emergency intervention is not approved by classification alone; complete the intervention-specific control.",
        ["748.2451", "748.2455", "748.2551"],
      ),
    );
  } else {
    findings.push(
      finding(
        GRO_REASON_CODES.PRACTICE_UNKNOWN_DENIED,
        "fail",
        "The practice is unclassified and was denied fail-closed.",
        ["748.1119", "748.2307", "748.2451"],
      ),
    );
  }

  return result("GRO-748-PROHIBITED-PRACTICE", findings, {
    practiceCode: input.practiceCode,
    classification,
  });
}

export type GroRestraintTechniqueCode =
  | "trained-standing-restraint"
  | "trained-seated-restraint"
  | "trained-side-restraint"
  | "torso-pressure-or-lung-expansion-obstruction"
  | "airway-obstruction"
  | "face-obscured-from-view"
  | "communication-or-distress-vocalization-obstructed"
  | "limb-twisted-or-behind-back";

const PROHIBITED_RESTRAINT_TECHNIQUES: readonly GroRestraintTechniqueCode[] = [
  "torso-pressure-or-lung-expansion-obstruction",
  "airway-obstruction",
  "face-obscured-from-view",
  "communication-or-distress-vocalization-obstructed",
  "limb-twisted-or-behind-back",
];

const RECOGNIZED_RESTRAINT_TECHNIQUES: readonly GroRestraintTechniqueCode[] = [
  "trained-standing-restraint",
  "trained-seated-restraint",
  "trained-side-restraint",
  ...PROHIBITED_RESTRAINT_TECHNIQUES,
];

export interface GroRestraintMonitorEvidence {
  readonly qualifiedInEmergencyBehaviorIntervention: boolean;
  readonly continuouslyMonitoredAppropriatePerformance: boolean;
  readonly continuouslyMonitoredBreathingAndPhysicalDistress: boolean;
  readonly preparedToProtectRespirationCirculationAndWellBeing: boolean;
}

export interface GroIndependentObserverEvidence {
  readonly present: boolean;
  readonly trainedInPositionalCompressionAndRestraintAsphyxiaRisks: boolean;
  readonly trainedInProneAndSupineRisks: boolean;
  readonly notInvolvedInRestraint: boolean;
}

export interface GroPersonalRestraintInput {
  readonly restraintKind:
    "short-personal-restraint" | "personal-restraint" | string;
  readonly operationPolicyPermits: boolean;
  readonly lessRestrictiveInterventionsAttempted: boolean;
  readonly lessRestrictiveInterventionsIneffective: boolean;
  readonly basis:
    | "emergency-situation"
    | "prescribed-intramuscular-medication-or-treatment"
    | string;
  readonly purpose:
    | "emergency-safety"
    | "prescribed-medical-treatment"
    | "punishment"
    | "retribution-or-retaliation"
    | "compliance"
    | "caregiver-convenience"
    | "substitute-for-treatment"
    | string;
  readonly minimalReasonableForceUsed: boolean;
  readonly privacyProtected: boolean;
  readonly dignityAndWellBeingProtected: boolean;
  readonly monitor: GroRestraintMonitorEvidence;
  readonly techniques: readonly string[];
  readonly position:
    "standing" | "seated" | "side" | "prone" | "supine" | string;
  readonly proneOrSupineDurationSeconds?: number;
  readonly proneOrSupineWasLastResort?: boolean;
  readonly operationCapacity: number;
  readonly independentObserver?: GroIndependentObserverEvidence;
  readonly childCondition:
    | "stable"
    | "unresponsive"
    | "reported-cannot-breathe"
    | "physical-distress"
    | string;
  readonly distressPotentiallyLifeThreatening?: boolean;
  readonly releasedImmediately?: boolean;
  readonly medicalAssistanceSoughtImmediately?: boolean;
  readonly healthCareProfessionalEvaluationDocumentedAt?: string;
}

export interface GroPersonalRestraintFacts {
  readonly restraintKind: string;
  readonly recognizedTechniques: readonly string[];
  readonly prohibitedTechniques: readonly string[];
  readonly unknownTechniques: readonly string[];
  readonly positionalSafeguardsRequired: boolean;
  readonly independentObserverRequired: boolean;
  readonly immediateMedicalResponseRequired: boolean;
}

export function evaluateGroPersonalRestraint(
  input: GroPersonalRestraintInput,
): GroControlResult<GroPersonalRestraintFacts> {
  const findings: GroFinding[] = [];
  const validKind =
    input.restraintKind === "short-personal-restraint" ||
    input.restraintKind === "personal-restraint";
  const validPosition = [
    "standing",
    "seated",
    "side",
    "prone",
    "supine",
  ].includes(input.position);
  if (
    !validKind ||
    !validPosition ||
    !Number.isInteger(input.operationCapacity) ||
    input.operationCapacity < 1
  ) {
    findings.push(
      finding(
        GRO_REASON_CODES.INPUT_INVALID,
        "fail",
        "A known personal-restraint kind, position, and positive integer operation capacity are required.",
        ["748.2451", "748.2601", "748.2605"],
      ),
    );
  }
  if (!input.operationPolicyPermits) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_POLICY_NOT_PERMITTED,
        "fail",
        "The operation policy does not permit this intervention.",
        ["748.2451"],
      ),
    );
  }
  if (
    !input.lessRestrictiveInterventionsAttempted ||
    !input.lessRestrictiveInterventionsIneffective
  ) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_LESS_RESTRICTIVE_NOT_EXHAUSTED,
        "fail",
        "Less restrictive behavior interventions were not both attempted and shown ineffective.",
        ["748.2455", "748.2551"],
      ),
    );
  }
  const basisAllowed =
    input.basis === "emergency-situation" ||
    input.basis === "prescribed-intramuscular-medication-or-treatment";
  if (!basisAllowed) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_BASIS_INVALID,
        "fail",
        "The stated basis is not one of the permitted bases for personal restraint.",
        ["748.2455"],
      ),
    );
  }
  const purposeAllowed =
    input.purpose === "emergency-safety" ||
    input.purpose === "prescribed-medical-treatment";
  if (!purposeAllowed) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_PURPOSE_PROHIBITED,
        "fail",
        "The stated purpose is prohibited or unclassified and was denied fail-closed.",
        ["748.2463"],
      ),
    );
  }
  if (!input.minimalReasonableForceUsed) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_FORCE_EXCESSIVE,
        "fail",
        "The minimal reasonable and necessary force was not attested.",
        ["748.2551"],
      ),
    );
  }
  if (!input.privacyProtected || !input.dignityAndWellBeingProtected) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_PRIVACY_DIGNITY_FAILURE,
        "fail",
        "Privacy, dignity, and well-being protections are incomplete.",
        ["748.2551"],
      ),
    );
  }
  if (!input.monitor.qualifiedInEmergencyBehaviorIntervention) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_MONITOR_UNQUALIFIED,
        "fail",
        "The restraint monitor is not documented as qualified in emergency behavior intervention.",
        ["748.2601"],
      ),
    );
  }
  if (
    !input.monitor.continuouslyMonitoredAppropriatePerformance ||
    !input.monitor.continuouslyMonitoredBreathingAndPhysicalDistress ||
    !input.monitor.preparedToProtectRespirationCirculationAndWellBeing
  ) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_MONITORING_INCOMPLETE,
        "fail",
        "Required performance, breathing, distress, circulation, and well-being monitoring is incomplete.",
        ["748.2601"],
      ),
    );
  }

  const prohibitedTechniques = input.techniques.filter((technique) =>
    (PROHIBITED_RESTRAINT_TECHNIQUES as readonly string[]).includes(technique),
  );
  const unknownTechniques = input.techniques.filter(
    (technique) =>
      !(RECOGNIZED_RESTRAINT_TECHNIQUES as readonly string[]).includes(
        technique,
      ),
  );
  if (prohibitedTechniques.length > 0) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_TECHNIQUE_PROHIBITED,
        "fail",
        `Prohibited restraint technique(s): ${prohibitedTechniques.join(", ")}.`,
        ["748.2605"],
      ),
    );
  }
  if (unknownTechniques.length > 0 || input.techniques.length === 0) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_TECHNIQUE_UNKNOWN,
        "fail",
        "Every restraint technique must be explicitly classified; empty or unknown techniques are denied.",
        ["748.2605"],
      ),
    );
  }

  const positionalSafeguardsRequired =
    input.position === "prone" || input.position === "supine";
  const independentObserverRequired =
    positionalSafeguardsRequired && input.operationCapacity > 16;
  if (positionalSafeguardsRequired) {
    if (
      !validFinite(input.proneOrSupineDurationSeconds ?? Number.NaN) ||
      (input.proneOrSupineDurationSeconds ?? Number.POSITIVE_INFINITY) < 0 ||
      (input.proneOrSupineDurationSeconds ?? Number.POSITIVE_INFINITY) > 60
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.RESTRAINT_POSITIONAL_LIMIT,
          "fail",
          "A prone or supine transitional hold must last no longer than one minute.",
          ["748.2605"],
        ),
      );
    }
    if (
      !input.proneOrSupineWasLastResort ||
      !input.lessRestrictiveInterventionsIneffective
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.RESTRAINT_POSITIONAL_NOT_LAST_RESORT,
          "fail",
          "Prone or supine restraint is not documented as a last resort after ineffective alternatives.",
          ["748.2605"],
        ),
      );
    }
    if (independentObserverRequired) {
      const observer = input.independentObserver;
      if (
        !observer?.present ||
        !observer.trainedInPositionalCompressionAndRestraintAsphyxiaRisks ||
        !observer.trainedInProneAndSupineRisks ||
        !observer.notInvolvedInRestraint
      ) {
        findings.push(
          finding(
            GRO_REASON_CODES.RESTRAINT_OBSERVER_MISSING,
            "fail",
            "A capacity-over-16 operation lacks a fully qualified independent positional-restraint observer.",
            ["748.2605"],
          ),
        );
      }
    } else {
      findings.push(
        finding(
          GRO_REASON_CODES.RESTRAINT_SMALL_OPERATION_OBSERVER_EXCEPTION,
          "exception",
          "The operation has capacity 16 or fewer and qualifies for the §748.2605(b)(3)(C) observer exception.",
          ["748.2605"],
        ),
      );
    }
  }

  const immediateMedicalResponseRequired =
    input.childCondition === "unresponsive" ||
    input.childCondition === "reported-cannot-breathe" ||
    input.distressPotentiallyLifeThreatening === true;
  if (immediateMedicalResponseRequired) {
    if (!input.releasedImmediately) {
      findings.push(
        finding(
          GRO_REASON_CODES.RESTRAINT_IMMEDIATE_RELEASE_MISSING,
          "fail",
          "Immediate release is not documented for potentially life-threatening distress.",
          ["748.2603"],
        ),
      );
    }
    if (!input.medicalAssistanceSoughtImmediately) {
      findings.push(
        finding(
          GRO_REASON_CODES.RESTRAINT_MEDICAL_ASSISTANCE_MISSING,
          "fail",
          "Immediate medical assistance from a health-care professional is not documented.",
          ["748.2603"],
        ),
      );
    }
    if (instant(input.healthCareProfessionalEvaluationDocumentedAt) === null) {
      findings.push(
        finding(
          GRO_REASON_CODES.RESTRAINT_MEDICAL_EVALUATION_MISSING,
          "fail",
          "Health-care-professional evaluation evidence is missing or invalid.",
          ["748.2603"],
        ),
      );
    }
  }

  if (findings.every((item) => item.level !== "fail")) {
    findings.push(
      finding(
        GRO_REASON_CODES.RESTRAINT_COMPLIANT,
        "pass",
        "The supplied personal-restraint evidence satisfies the evaluated Chapter 748 safeguards.",
        ["748.2455", "748.2551", "748.2601", "748.2603", "748.2605"],
      ),
    );
  }

  return result("GRO-748-PERSONAL-RESTRAINT", findings, {
    restraintKind: input.restraintKind,
    recognizedTechniques: input.techniques.filter((technique) =>
      (RECOGNIZED_RESTRAINT_TECHNIQUES as readonly string[]).includes(
        technique,
      ),
    ),
    prohibitedTechniques,
    unknownTechniques,
    positionalSafeguardsRequired,
    independentObserverRequired,
    immediateMedicalResponseRequired,
  });
}

export interface GroTriggeredReviewEvidence {
  readonly triggeredAt: string;
  readonly completedAt?: string;
  readonly recordsAndOrdersReviewed: boolean;
  readonly medicalAndPsychiatricContraindicationsReviewed: boolean;
  readonly behaviorPatternsAndDeescalationReviewed: boolean;
  readonly alternativesIdentified: boolean;
  readonly writtenReductionPlanCompleted: boolean;
  readonly documentedInChildRecord: boolean;
}

export interface GroPostInterventionInput {
  readonly interventionKind:
    | "short-personal-restraint"
    | "personal-restraint"
    | "emergency-medication"
    | "seclusion"
    | "mechanical-restraint"
    | string;
  readonly emergencyCareSeclusion?: boolean;
  readonly initiatedAt: string;
  readonly interventionEndedAt: string;
  readonly stabilizedAt: string;
  readonly observedUntil?: string;
  readonly privateChildDiscussionAt?: string;
  readonly caregiverDebriefAt?: string;
  readonly caregiverDebriefAsSoonAsPossibleAttested?: boolean;
  readonly witnessesPresent?: boolean;
  readonly reasonableWitnessDebriefEffortsMade?: boolean;
  readonly supervisorReviewedAt?: string;
  readonly incidentDocumentedAt?: string;
  readonly parentNotifiedInWritingAt?: string;
  readonly triggeredReview?: GroTriggeredReviewEvidence;
}

export interface GroPostInterventionFacts {
  readonly followUpRuleApplies: boolean;
  readonly documentationRuleApplies: boolean;
  readonly parentNoticeRuleApplies: boolean;
  readonly observationMinutes: number | null;
  readonly childDiscussionDeadline: string | null;
  readonly supervisorReviewDeadline: string | null;
  readonly documentationDeadline: string | null;
  readonly parentNoticeDeadline: string | null;
  readonly triggeredReviewDeadline: string | null;
}

export function evaluateGroPostIntervention(
  input: GroPostInterventionInput,
): GroControlResult<GroPostInterventionFacts> {
  const findings: GroFinding[] = [];
  const knownKinds = [
    "short-personal-restraint",
    "personal-restraint",
    "emergency-medication",
    "seclusion",
    "mechanical-restraint",
  ];
  const initiatedAt = instant(input.initiatedAt);
  const endedAt = instant(input.interventionEndedAt);
  const stabilizedAt = instant(input.stabilizedAt);
  if (
    !knownKinds.includes(input.interventionKind) ||
    initiatedAt === null ||
    endedAt === null ||
    stabilizedAt === null ||
    (initiatedAt !== null && endedAt !== null && endedAt < initiatedAt) ||
    (endedAt !== null && stabilizedAt !== null && stabilizedAt < endedAt)
  ) {
    findings.push(
      finding(
        GRO_REASON_CODES.INPUT_INVALID,
        "fail",
        "A known intervention and ordered, timezone-qualified initiation, end, and stabilization instants are required.",
        ["748.2851", "748.2855", "748.2857"],
      ),
    );
  }

  const shortPersonalRestraint =
    input.interventionKind === "short-personal-restraint";
  const emergencyCareSeclusion =
    input.interventionKind === "seclusion" &&
    input.emergencyCareSeclusion === true;
  const followUpRuleApplies =
    !shortPersonalRestraint && !emergencyCareSeclusion;
  const documentationRuleApplies = !shortPersonalRestraint;
  const parentNoticeRuleApplies = !shortPersonalRestraint;
  const observedUntil = instant(input.observedUntil);
  const observationMinutes =
    endedAt === null || observedUntil === null
      ? null
      : (observedUntil - endedAt) / (60 * 1_000);

  if (!followUpRuleApplies) {
    findings.push(
      finding(
        GRO_REASON_CODES.POST_FOLLOWUP_EXCEPTION,
        "exception",
        "Section 748.2851 follow-up was not applied to a short personal restraint or emergency-care seclusion.",
        ["748.2851"],
      ),
    );
  } else {
    if (observationMinutes === null || observationMinutes < 15) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_OBSERVATION_SHORT,
          "fail",
          "At least 15 minutes of post-intervention observation is not documented.",
          ["748.2851"],
        ),
      );
    }
    const childDiscussionAt = instant(input.privateChildDiscussionAt);
    if (
      endedAt === null ||
      childDiscussionAt === null ||
      !noLaterThan(childDiscussionAt, endedAt, 48 * HOUR_MS)
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_DISCUSSION_LATE,
          "fail",
          "A private child discussion was not documented within 48 hours after the intervention ended.",
          ["748.2851"],
        ),
      );
    }
    const caregiverDebriefAt = instant(input.caregiverDebriefAt);
    if (
      stabilizedAt === null ||
      caregiverDebriefAt === null ||
      caregiverDebriefAt < stabilizedAt ||
      !input.caregiverDebriefAsSoonAsPossibleAttested
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_DEBRIEF_MISSING,
          "fail",
          "Caregiver debrief after stabilization and its as-soon-as-possible attestation are incomplete.",
          ["748.2851"],
        ),
      );
    }
    if (input.witnessesPresent && !input.reasonableWitnessDebriefEffortsMade) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_WITNESS_DEBRIEF_MISSING,
          "fail",
          "Reasonable efforts to debrief witnessing children are not documented.",
          ["748.2851"],
        ),
      );
    }
    const supervisorReviewedAt = instant(input.supervisorReviewedAt);
    if (
      initiatedAt === null ||
      supervisorReviewedAt === null ||
      !noLaterThan(supervisorReviewedAt, initiatedAt, 72 * HOUR_MS)
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_SUPERVISOR_REVIEW_LATE,
          "fail",
          "Supervisor review is missing or later than 72 hours after initiation.",
          ["748.2851", "748.2855"],
        ),
      );
    }
  }

  if (documentationRuleApplies) {
    const documentedAt = instant(input.incidentDocumentedAt);
    if (
      initiatedAt === null ||
      documentedAt === null ||
      !noLaterThan(documentedAt, initiatedAt, 24 * HOUR_MS)
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_DOCUMENTATION_LATE,
          "fail",
          "Child-record intervention documentation is missing or later than 24 hours after initiation.",
          ["748.2855"],
        ),
      );
    }
  }

  if (parentNoticeRuleApplies) {
    const parentNoticeAt = instant(input.parentNotifiedInWritingAt);
    if (
      initiatedAt === null ||
      parentNoticeAt === null ||
      !noLaterThan(parentNoticeAt, initiatedAt, 72 * HOUR_MS)
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_PARENT_NOTICE_LATE,
          "fail",
          "Written parent notice is missing or later than 72 hours after initiation.",
          ["748.2857"],
        ),
      );
    }
  }

  const triggered = input.triggeredReview;
  const triggeredAt = instant(triggered?.triggeredAt);
  const triggeredCompletedAt = instant(triggered?.completedAt);
  if (triggered) {
    if (
      triggeredAt === null ||
      triggeredCompletedAt === null ||
      !noLaterThan(triggeredCompletedAt, triggeredAt, 30 * DAY_MS)
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_TRIGGERED_REVIEW_LATE,
          "fail",
          "Triggered review is missing or later than 30 days after the trigger.",
          ["748.2903"],
        ),
      );
    }
    if (
      !triggered.recordsAndOrdersReviewed ||
      !triggered.medicalAndPsychiatricContraindicationsReviewed ||
      !triggered.behaviorPatternsAndDeescalationReviewed ||
      !triggered.alternativesIdentified ||
      !triggered.writtenReductionPlanCompleted ||
      !triggered.documentedInChildRecord
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.POST_TRIGGERED_REVIEW_INCOMPLETE,
          "fail",
          "Triggered-review content or child-record documentation is incomplete.",
          ["748.2907"],
        ),
      );
    }
  }

  if (findings.every((item) => item.level !== "fail")) {
    findings.push(
      finding(
        GRO_REASON_CODES.POST_COMPLIANT,
        "pass",
        "Applicable observation, discussion, debrief, review, documentation, and notice controls are satisfied.",
        ["748.2851", "748.2855", "748.2857", "748.2903", "748.2907"],
      ),
    );
  }

  const toDeadline = (
    anchor: number | null,
    duration: number,
  ): string | null =>
    anchor === null ? null : new Date(anchor + duration).toISOString();
  return result("GRO-748-POST-INTERVENTION", findings, {
    followUpRuleApplies,
    documentationRuleApplies,
    parentNoticeRuleApplies,
    observationMinutes,
    childDiscussionDeadline: followUpRuleApplies
      ? toDeadline(endedAt, 48 * HOUR_MS)
      : null,
    supervisorReviewDeadline: followUpRuleApplies
      ? toDeadline(initiatedAt, 72 * HOUR_MS)
      : null,
    documentationDeadline: documentationRuleApplies
      ? toDeadline(initiatedAt, 24 * HOUR_MS)
      : null,
    parentNoticeDeadline: parentNoticeRuleApplies
      ? toDeadline(initiatedAt, 72 * HOUR_MS)
      : null,
    triggeredReviewDeadline:
      triggeredAt === null ? null : toDeadline(triggeredAt, 30 * DAY_MS),
  });
}

/**
 * One deliberately broad input shape keeps unknown record types representable
 * for the fail-closed branch. Type-specific fields are validated when their
 * corresponding record type is selected.
 */
export interface GroRecordRetentionInput {
  readonly recordType: string;
  readonly asOf: string;
  readonly investigationStatus: "none" | "open" | "resolved";
  readonly investigationResolvedAt?: string;
  readonly category?: "annual-training" | "other";
  readonly currentEmployee?: boolean;
  readonly trainingYear?: number;
  readonly lastDayOfEmployment?: string;
  readonly dischargedAt?: string;
}

export interface GroRecordRetentionFacts {
  readonly recordType: string;
  readonly retain: boolean;
  readonly dispositionEligibleOn: string | null;
  readonly indefiniteReason:
    "current-personnel" | "open-investigation" | "child-not-discharged" | null;
}

function addUtcYears(timestamp: number, years: number): number {
  const value = new Date(timestamp);
  value.setUTCFullYear(value.getUTCFullYear() + years);
  return value.getTime();
}

export function evaluateGroRecordRetention(
  input: GroRecordRetentionInput,
): GroControlResult<GroRecordRetentionFacts> {
  const findings: GroFinding[] = [];
  const asOf = instant(input.asOf);
  let retain = true;
  let dispositionEligibleAt: number | null = null;
  let indefiniteReason: GroRecordRetentionFacts["indefiniteReason"] = null;
  if (asOf === null) {
    findings.push(
      finding(
        GRO_REASON_CODES.INPUT_INVALID,
        "fail",
        "The retention as-of value must be an ISO-8601 instant with a timezone.",
        ["748.431", "748.433"],
      ),
    );
  }

  if (input.recordType !== "personnel" && input.recordType !== "child") {
    findings.push(
      finding(
        GRO_REASON_CODES.INPUT_INVALID,
        "fail",
        "Unknown record types are denied fail-closed.",
        ["748.431", "748.433"],
      ),
    );
  } else if (input.investigationStatus === "open") {
    retain = true;
    indefiniteReason = "open-investigation";
    findings.push(
      finding(
        GRO_REASON_CODES.RETENTION_INVESTIGATION_OPEN,
        "pass",
        "The record must be retained until the open investigation is resolved.",
        input.recordType === "personnel" ? ["748.431"] : ["748.433"],
      ),
    );
  } else if (input.recordType === "personnel") {
    if (input.currentEmployee && input.category === "annual-training") {
      const asOfYear = asOf === null ? null : new Date(asOf).getUTCFullYear();
      if (
        !Number.isInteger(input.trainingYear) ||
        input.trainingYear === undefined ||
        asOfYear === null
      ) {
        findings.push(
          finding(
            GRO_REASON_CODES.INPUT_INVALID,
            "fail",
            "A training year is required for a current employee's annual training record.",
            ["748.431"],
          ),
        );
      } else {
        retain = input.trainingYear >= asOfYear - 1;
        dispositionEligibleAt = retain ? Date.UTC(asOfYear + 1, 0, 1) : asOf;
        findings.push(
          finding(
            retain
              ? GRO_REASON_CODES.RETENTION_TRAINING_WINDOW
              : GRO_REASON_CODES.RETENTION_ELIGIBLE,
            "pass",
            retain
              ? "The training record is in the current or last full training year and must be retained."
              : "The training record predates the required current/prior-year window.",
            ["748.431"],
          ),
        );
      }
    } else if (input.currentEmployee) {
      retain = true;
      indefiniteReason = "current-personnel";
      findings.push(
        finding(
          GRO_REASON_CODES.RETENTION_REQUIRED,
          "pass",
          "Current personnel records remain subject to retention.",
          ["748.431"],
        ),
      );
    } else {
      const lastDay = instant(input.lastDayOfEmployment);
      const resolvedAt =
        input.investigationStatus === "resolved"
          ? instant(input.investigationResolvedAt)
          : null;
      if (
        lastDay === null ||
        (input.investigationStatus === "resolved" && resolvedAt === null)
      ) {
        findings.push(
          finding(
            GRO_REASON_CODES.INPUT_INVALID,
            "fail",
            "Former-personnel retention requires a valid last day and, when applicable, investigation resolution instant.",
            ["748.431"],
          ),
        );
      } else {
        dispositionEligibleAt = Math.max(
          addUtcYears(lastDay, 1),
          resolvedAt ?? 0,
        );
        retain = asOf === null || asOf < dispositionEligibleAt;
        findings.push(
          finding(
            retain
              ? GRO_REASON_CODES.RETENTION_REQUIRED
              : GRO_REASON_CODES.RETENTION_ELIGIBLE,
            "pass",
            retain
              ? "The former employee's one-year or investigation retention horizon has not elapsed."
              : "The former employee's one-year and investigation retention horizons have elapsed.",
            ["748.431"],
          ),
        );
      }
    }
  } else {
    const dischargedAt = instant(input.dischargedAt);
    const resolvedAt =
      input.investigationStatus === "resolved"
        ? instant(input.investigationResolvedAt)
        : null;
    if (!input.dischargedAt) {
      retain = true;
      indefiniteReason = "child-not-discharged";
      findings.push(
        finding(
          GRO_REASON_CODES.RETENTION_REQUIRED,
          "pass",
          "The child has not been discharged; the complete record must remain retained.",
          ["748.433"],
        ),
      );
    } else if (
      dischargedAt === null ||
      (input.investigationStatus === "resolved" && resolvedAt === null)
    ) {
      findings.push(
        finding(
          GRO_REASON_CODES.INPUT_INVALID,
          "fail",
          "Child retention requires a valid discharge and, when applicable, investigation resolution instant.",
          ["748.433"],
        ),
      );
    } else {
      dispositionEligibleAt = Math.max(
        addUtcYears(dischargedAt, 2),
        resolvedAt ?? 0,
      );
      retain = asOf === null || asOf < dispositionEligibleAt;
      findings.push(
        finding(
          retain
            ? GRO_REASON_CODES.RETENTION_REQUIRED
            : GRO_REASON_CODES.RETENTION_ELIGIBLE,
          "pass",
          retain
            ? "The child's two-year or investigation retention horizon has not elapsed."
            : "The child's two-year and investigation retention horizons have elapsed.",
          ["748.433"],
        ),
      );
    }
  }

  return result("GRO-748-RECORD-RETENTION", findings, {
    recordType: input.recordType,
    retain,
    dispositionEligibleOn:
      dispositionEligibleAt === null
        ? null
        : new Date(dispositionEligibleAt).toISOString(),
    indefiniteReason,
  });
}
