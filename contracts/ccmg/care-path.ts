import type { CansAssessmentVersion, CansPlanLineage } from "./cans-routing";
import { validateCansVersionHistory } from "./cans-routing";
import type { CcmgReferralIntake, ReferralStatus } from "./intake";
import { evaluateIntakeReadiness } from "./intake";

export type ReferralIntakeGateDecision = {
  gate: "intake";
  decision: { status: "complete" };
};

export type ReferralEligibilityGateDecision = {
  gate: "eligibility";
  decision: {
    status: "eligible" | "ineligible" | "needs_review";
    criteria?: CcmgReferralIntake["eligibility"]["criteria"];
    rationale: string;
  };
};

export type ReferralPayerAuthorizationGateDecision = {
  gate: "payer_authorization";
  decision: {
    payerLabel: string;
    verificationStatus: "verified" | "failed";
    authorizationRequired: boolean;
    authorizationStatus: "not_required" | "pending" | "approved" | "denied" | "expired";
    authorizationReference?: string;
    effectiveAt?: string;
    expiresAt?: string;
  };
};

export type ReferralConsentGateDecision = {
  gate: "consent";
  decision: {
    status: "active" | "declined" | "revoked" | "expired";
    consentReference?: string;
    effectiveAt?: string;
    expiresAt?: string;
  };
};

export type ReferralCansScheduleGateDecision = {
  gate: "cans_schedule";
  decision: {
    status: "scheduled" | "overdue" | "cancelled";
    dueAt: string;
    scheduledFor?: string;
  };
};

export type ReferralCapacityGateDecision = {
  gate: "capacity";
  decision: {
    required: boolean;
    facilityLabel?: string;
    status: "available" | "reserved" | "waitlisted" | "unavailable";
    availableSlots?: number;
    reservedSlotReference?: string;
    checkedAt?: string;
  };
};

/**
 * Exact decision union consumed by the M2.1 `recordReferralGate` mutation.
 * Actor identity and decision timestamps are deliberately server-owned.
 */
export type RecordReferralGateDecision =
  | ReferralIntakeGateDecision
  | ReferralEligibilityGateDecision
  | ReferralPayerAuthorizationGateDecision
  | ReferralConsentGateDecision
  | ReferralCansScheduleGateDecision
  | ReferralCapacityGateDecision;

export type RecordReferralGateInput = RecordReferralGateDecision & {
  referralId: string;
  reason: string;
  expectedVersion: number;
};

export type CarePathValidationIssueCode =
  | "PAYLOAD_NOT_OBJECT"
  | "GATE_UNSUPPORTED"
  | "DECISION_NOT_OBJECT"
  | "DECISION_STATUS_INVALID"
  | "REQUIRED_FIELD_MISSING"
  | "FIELD_TYPE_INVALID"
  | "TIMESTAMP_INVALID"
  | "TIMESTAMP_ORDER_INVALID"
  | "STATE_INCONSISTENT"
  | "CANS_CONTEXT_SCOPE_MISMATCH"
  | "CANS_HISTORY_SEQUENCE_INVALID"
  | "CANS_CURRENT_POINTER_MISMATCH"
  | "CANS_PRIOR_STATUS_INVALID"
  | "CANS_PRIOR_COMPLETION_MISSING"
  | "TARGET_TYPE_INVALID"
  | "TARGET_APPROVER_ROLE_INVALID"
  | "MEDICATION_ALERT_PRIORITY_INVALID"
  | "MEDICATION_ALERT_DUE_NOT_FUTURE";

export interface CarePathValidationIssue {
  code: CarePathValidationIssueCode;
  path: string;
  message: string;
}

export type CarePathValidationResult<T> =
  | { valid: true; value: T; issues: readonly [] }
  | { valid: false; value: null; issues: readonly CarePathValidationIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function issue(
  code: CarePathValidationIssueCode,
  path: string,
  message: string,
): CarePathValidationIssue {
  return { code, path, message };
}

function validateOptionalTimestamp(
  value: unknown,
  path: string,
  issues: CarePathValidationIssue[],
): void {
  if (value !== undefined && !isTimestamp(value)) {
    issues.push(issue("TIMESTAMP_INVALID", path, `${path} must be a valid timestamp when supplied.`));
  }
}

function validateTimestampWindow(
  effectiveAt: unknown,
  expiresAt: unknown,
  issues: CarePathValidationIssue[],
): void {
  validateOptionalTimestamp(effectiveAt, "decision.effectiveAt", issues);
  validateOptionalTimestamp(expiresAt, "decision.expiresAt", issues);
  if (isTimestamp(effectiveAt) && isTimestamp(expiresAt) && Date.parse(expiresAt) <= Date.parse(effectiveAt)) {
    issues.push(issue(
      "TIMESTAMP_ORDER_INVALID",
      "decision.expiresAt",
      "decision.expiresAt must be later than decision.effectiveAt.",
    ));
  }
}

function validateEligibilityDecision(
  decision: Record<string, unknown>,
  issues: CarePathValidationIssue[],
): void {
  if (!["eligible", "ineligible", "needs_review"].includes(String(decision.status))) {
    issues.push(issue("DECISION_STATUS_INVALID", "decision.status", "Eligibility status is invalid."));
  }
  if (!isNonBlankString(decision.rationale)) {
    issues.push(issue("REQUIRED_FIELD_MISSING", "decision.rationale", "Eligibility rationale is required."));
  }
  if (decision.criteria !== undefined) {
    const criteria = decision.criteria;
    if (!isRecord(criteria)) {
      issues.push(issue("FIELD_TYPE_INVALID", "decision.criteria", "Eligibility criteria must be an object."));
    } else {
      const fields = ["ageQualified", "diagnosisQualified", "functionalImpairment", "coverageQualified"] as const;
      if (fields.some((field) => typeof criteria[field] !== "boolean")) {
        issues.push(issue("FIELD_TYPE_INVALID", "decision.criteria", "All four eligibility criteria must be boolean values."));
      }
      if (decision.status === "eligible" && fields.some((field) => criteria[field] !== true)) {
        issues.push(issue("STATE_INCONSISTENT", "decision.criteria", "An eligible decision requires all four criteria to be true."));
      }
    }
  } else if (decision.status === "eligible") {
    issues.push(issue("REQUIRED_FIELD_MISSING", "decision.criteria", "An eligible decision requires all four criteria."));
  }
}

function validatePayerDecision(
  decision: Record<string, unknown>,
  issues: CarePathValidationIssue[],
): void {
  if (!isNonBlankString(decision.payerLabel)) {
    issues.push(issue("REQUIRED_FIELD_MISSING", "decision.payerLabel", "Payer label is required."));
  }
  if (!["verified", "failed"].includes(String(decision.verificationStatus))) {
    issues.push(issue("DECISION_STATUS_INVALID", "decision.verificationStatus", "Payer verification status is invalid."));
  }
  if (typeof decision.authorizationRequired !== "boolean") {
    issues.push(issue("FIELD_TYPE_INVALID", "decision.authorizationRequired", "authorizationRequired must be boolean."));
  }
  const authorizationStatuses = ["not_required", "pending", "approved", "denied", "expired"];
  if (!authorizationStatuses.includes(String(decision.authorizationStatus))) {
    issues.push(issue("DECISION_STATUS_INVALID", "decision.authorizationStatus", "Authorization status is invalid."));
  }
  if (decision.authorizationRequired === false && decision.authorizationStatus !== "not_required") {
    issues.push(issue("STATE_INCONSISTENT", "decision.authorizationStatus", "Authorization not required must use not_required status."));
  }
  if (decision.authorizationRequired === true && decision.authorizationStatus === "not_required") {
    issues.push(issue("STATE_INCONSISTENT", "decision.authorizationStatus", "Required authorization cannot use not_required status."));
  }
  if (decision.authorizationStatus === "approved") {
    if (decision.verificationStatus !== "verified") {
      issues.push(issue("STATE_INCONSISTENT", "decision.verificationStatus", "Approved authorization requires verified payer coverage."));
    }
    if (!isNonBlankString(decision.authorizationReference)) {
      issues.push(issue("REQUIRED_FIELD_MISSING", "decision.authorizationReference", "Approved authorization requires a reference."));
    }
    if (!isTimestamp(decision.effectiveAt)) {
      issues.push(issue("TIMESTAMP_INVALID", "decision.effectiveAt", "Approved authorization requires a valid effective timestamp."));
    }
    if (!isTimestamp(decision.expiresAt)) {
      issues.push(issue("TIMESTAMP_INVALID", "decision.expiresAt", "Approved authorization requires a valid expiration timestamp."));
    }
  }
  validateTimestampWindow(decision.effectiveAt, decision.expiresAt, issues);
}

function validateConsentDecision(
  decision: Record<string, unknown>,
  issues: CarePathValidationIssue[],
): void {
  if (!["active", "declined", "revoked", "expired"].includes(String(decision.status))) {
    issues.push(issue("DECISION_STATUS_INVALID", "decision.status", "Consent status is invalid."));
  }
  if (decision.status === "active") {
    if (!isNonBlankString(decision.consentReference)) {
      issues.push(issue("REQUIRED_FIELD_MISSING", "decision.consentReference", "Active consent requires a reference."));
    }
    if (!isTimestamp(decision.effectiveAt)) {
      issues.push(issue("TIMESTAMP_INVALID", "decision.effectiveAt", "Active consent requires a valid effective timestamp."));
    }
    if (!isTimestamp(decision.expiresAt)) {
      issues.push(issue("TIMESTAMP_INVALID", "decision.expiresAt", "Active consent requires a valid expiration timestamp."));
    }
  }
  validateTimestampWindow(decision.effectiveAt, decision.expiresAt, issues);
}

function validateCansScheduleDecision(
  decision: Record<string, unknown>,
  issues: CarePathValidationIssue[],
): void {
  if (!["scheduled", "overdue", "cancelled"].includes(String(decision.status))) {
    issues.push(issue("DECISION_STATUS_INVALID", "decision.status", "CANS schedule status is invalid."));
  }
  if (!isTimestamp(decision.dueAt)) {
    issues.push(issue("TIMESTAMP_INVALID", "decision.dueAt", "CANS dueAt must be a valid timestamp."));
  }
  if (decision.status === "scheduled" && !isTimestamp(decision.scheduledFor)) {
    issues.push(issue("TIMESTAMP_INVALID", "decision.scheduledFor", "A scheduled CANS requires a valid scheduledFor timestamp."));
  } else {
    validateOptionalTimestamp(decision.scheduledFor, "decision.scheduledFor", issues);
  }
  if (isTimestamp(decision.dueAt) && isTimestamp(decision.scheduledFor)
    && Date.parse(decision.scheduledFor) > Date.parse(decision.dueAt)) {
    issues.push(issue("TIMESTAMP_ORDER_INVALID", "decision.scheduledFor", "CANS scheduledFor cannot be later than dueAt."));
  }
}

function validateCapacityDecision(
  decision: Record<string, unknown>,
  issues: CarePathValidationIssue[],
): void {
  if (typeof decision.required !== "boolean") {
    issues.push(issue("FIELD_TYPE_INVALID", "decision.required", "Capacity required must be boolean."));
  }
  if (!["available", "reserved", "waitlisted", "unavailable"].includes(String(decision.status))) {
    issues.push(issue("DECISION_STATUS_INVALID", "decision.status", "Capacity status is invalid."));
  }
  if (decision.required === true && !isNonBlankString(decision.facilityLabel)) {
    issues.push(issue("REQUIRED_FIELD_MISSING", "decision.facilityLabel", "Required capacity must identify a facility or pool."));
  }
  if (decision.availableSlots !== undefined
    && (!Number.isInteger(decision.availableSlots) || Number(decision.availableSlots) < 0)) {
    issues.push(issue("FIELD_TYPE_INVALID", "decision.availableSlots", "Available slots must be a non-negative integer."));
  }
  if (decision.status === "available"
    && (!Number.isInteger(decision.availableSlots) || Number(decision.availableSlots) < 1)) {
    issues.push(issue("STATE_INCONSISTENT", "decision.availableSlots", "Available capacity requires at least one available slot."));
  }
  if (decision.status === "reserved" && !isNonBlankString(decision.reservedSlotReference)) {
    issues.push(issue("REQUIRED_FIELD_MISSING", "decision.reservedSlotReference", "Reserved capacity requires a slot reference."));
  }
  validateOptionalTimestamp(decision.checkedAt, "decision.checkedAt", issues);
}

export function validateReferralGateDecision(input: unknown): CarePathValidationResult<RecordReferralGateDecision> {
  if (!isRecord(input)) {
    return {
      valid: false,
      value: null,
      issues: [issue("PAYLOAD_NOT_OBJECT", "", "Referral gate payload must be an object.")],
    };
  }
  const supportedGates = ["intake", "eligibility", "payer_authorization", "consent", "cans_schedule", "capacity"];
  if (!supportedGates.includes(String(input.gate))) {
    return {
      valid: false,
      value: null,
      issues: [issue("GATE_UNSUPPORTED", "gate", "Referral gate is unsupported.")],
    };
  }
  if (!isRecord(input.decision)) {
    return {
      valid: false,
      value: null,
      issues: [issue("DECISION_NOT_OBJECT", "decision", "Referral gate decision must be an object.")],
    };
  }

  const issues: CarePathValidationIssue[] = [];
  switch (input.gate) {
    case "intake":
      if (input.decision.status !== "complete") {
        issues.push(issue("DECISION_STATUS_INVALID", "decision.status", "Intake decision must be complete."));
      }
      break;
    case "eligibility":
      validateEligibilityDecision(input.decision, issues);
      break;
    case "payer_authorization":
      validatePayerDecision(input.decision, issues);
      break;
    case "consent":
      validateConsentDecision(input.decision, issues);
      break;
    case "cans_schedule":
      validateCansScheduleDecision(input.decision, issues);
      break;
    case "capacity":
      validateCapacityDecision(input.decision, issues);
      break;
  }

  return issues.length === 0
    ? { valid: true, value: input as RecordReferralGateDecision, issues: [] }
    : { valid: false, value: null, issues };
}

/**
 * Recomputes a pre-routing referral status only from current gate state. This
 * intentionally clears a former held/rejected disposition after corrected gate
 * data is recorded instead of treating the old status as a permanent blocker.
 */
export function recomputeReferralStatus(
  referral: CcmgReferralIntake,
  evaluatedAt: string,
): ReferralStatus {
  if (referral.eligibility.status === "ineligible") return "rejected";
  if (referral.eligibility.status === "needs_review") return "held";
  if (referral.capacity.required && ["waitlisted", "unavailable"].includes(referral.capacity.status)) return "held";

  const normalizedReferral: CcmgReferralIntake = {
    ...referral,
    status: "screening",
    holdReason: null,
    rejectionReason: null,
  };
  return evaluateIntakeReadiness(normalizedReferral, evaluatedAt).ready
    ? "ready_for_routing"
    : "screening";
}

export interface NextCansVersionContextInput {
  referral: Pick<CcmgReferralIntake,
    "id" | "caseId" | "evidenceClass"
  > & Pick<CcmgReferralIntake["cans"], never> & {
    currentAssessmentId: CcmgReferralIntake["cans"]["currentAssessmentId"];
    currentVersion: CcmgReferralIntake["cans"]["currentVersion"];
  };
  priorAssessments: readonly CansAssessmentVersion[];
}

export type NextCansVersionContextResult =
  | {
      valid: true;
      nextVersion: number;
      previousAssessmentId: string | null;
      issues: readonly [];
    }
  | {
      valid: false;
      nextVersion: null;
      previousAssessmentId: null;
      issues: readonly CarePathValidationIssue[];
    };

export function validateNextCansVersionContext(
  input: NextCansVersionContextInput,
): NextCansVersionContextResult {
  const issues: CarePathValidationIssue[] = [];
  const sorted = [...input.priorAssessments].sort((left, right) => left.version - right.version);

  if (sorted.some((assessment) => (
    assessment.caseId !== input.referral.caseId
    || assessment.referralId !== input.referral.id
    || assessment.evidenceClass !== input.referral.evidenceClass
  ))) {
    issues.push(issue(
      "CANS_CONTEXT_SCOPE_MISMATCH",
      "priorAssessments",
      "Every prior CANS must match the referral case, referral, and evidence scope.",
    ));
  }
  if (validateCansVersionHistory(sorted).length > 0) {
    issues.push(issue(
      "CANS_HISTORY_SEQUENCE_INVALID",
      "priorAssessments",
      "Prior CANS versions must be contiguous and preserve exact predecessor continuity.",
    ));
  }

  if (sorted.length === 0) {
    if (input.referral.currentAssessmentId !== null || input.referral.currentVersion !== null) {
      issues.push(issue(
        "CANS_CURRENT_POINTER_MISMATCH",
        "referral",
        "A referral without CANS history cannot have a current CANS pointer.",
      ));
    }
    return issues.length === 0
      ? { valid: true, nextVersion: 1, previousAssessmentId: null, issues: [] }
      : { valid: false, nextVersion: null, previousAssessmentId: null, issues };
  }

  const latest = sorted[sorted.length - 1];
  if (input.referral.currentAssessmentId !== latest.id || input.referral.currentVersion !== latest.version) {
    issues.push(issue(
      "CANS_CURRENT_POINTER_MISMATCH",
      "referral",
      "Referral current CANS ID and version must identify the maximum prior version.",
    ));
  }
  if (latest.status !== "final") {
    issues.push(issue("CANS_PRIOR_STATUS_INVALID", "priorAssessments", "The current prior CANS must be final."));
  }
  if (!isTimestamp(latest.completedAt) || !isNonBlankString(latest.completedBy)) {
    issues.push(issue(
      "CANS_PRIOR_COMPLETION_MISSING",
      "priorAssessments",
      "The current prior CANS requires completion timestamp and actor provenance.",
    ));
  }
  if (sorted.slice(0, -1).some((assessment) => assessment.status !== "superseded")) {
    issues.push(issue(
      "CANS_PRIOR_STATUS_INVALID",
      "priorAssessments",
      "Every earlier CANS version must be superseded before a later version is finalized.",
    ));
  }

  return issues.length === 0
    ? {
        valid: true,
        nextVersion: latest.version + 1,
        previousAssessmentId: latest.id,
        issues: [],
      }
    : { valid: false, nextVersion: null, previousAssessmentId: null, issues };
}

export const CANS_TARGET_APPROVER_ROLES = {
  mhtcm_plan: ["treatment-director", "mhtcm-supervisor"],
  mhrs_skills_goals: ["mhrs-supervisor"],
} as const satisfies Readonly<Record<CansPlanLineage["targetType"], readonly string[]>>;

export interface PlanTargetRouteValidationInput {
  targetType: CansPlanLineage["targetType"];
  targetRecordId: string;
  targetVersion: number;
  actorRole: string;
}

export function validatePlanTargetRoute(input: unknown): CarePathValidationResult<PlanTargetRouteValidationInput> {
  if (!isRecord(input)) {
    return { valid: false, value: null, issues: [issue("PAYLOAD_NOT_OBJECT", "", "Plan target route must be an object.")] };
  }
  const issues: CarePathValidationIssue[] = [];
  const targetType = input.targetType;
  if (targetType !== "mhtcm_plan" && targetType !== "mhrs_skills_goals") {
    issues.push(issue("TARGET_TYPE_INVALID", "targetType", "Target type must be mhtcm_plan or mhrs_skills_goals."));
  }
  if (!isNonBlankString(input.targetRecordId)) {
    issues.push(issue("REQUIRED_FIELD_MISSING", "targetRecordId", "Target record ID is required."));
  }
  if (!Number.isInteger(input.targetVersion) || Number(input.targetVersion) < 1) {
    issues.push(issue("FIELD_TYPE_INVALID", "targetVersion", "Target version must be a positive integer."));
  }
  if (!isNonBlankString(input.actorRole)) {
    issues.push(issue("REQUIRED_FIELD_MISSING", "actorRole", "Authenticated actor role is required."));
  } else if ((targetType === "mhtcm_plan" || targetType === "mhrs_skills_goals")
    && !CANS_TARGET_APPROVER_ROLES[targetType].includes(input.actorRole as never)) {
    issues.push(issue(
      "TARGET_APPROVER_ROLE_INVALID",
      "actorRole",
      `Role ${input.actorRole} cannot approve ${targetType}.`,
    ));
  }

  return issues.length === 0
    ? { valid: true, value: input as unknown as PlanTargetRouteValidationInput, issues: [] }
    : { valid: false, value: null, issues };
}

export interface MedicationAlertValidationInput {
  referralId: string;
  title: string;
  priority: "urgent" | "critical";
  dueAt: string;
  reason: string;
  expectedReferralVersion: number;
}

export function validateMedicationAlertInput(
  input: unknown,
  evaluatedAt: string,
): CarePathValidationResult<MedicationAlertValidationInput> {
  if (!isRecord(input)) {
    return { valid: false, value: null, issues: [issue("PAYLOAD_NOT_OBJECT", "", "Medication alert must be an object.")] };
  }
  const issues: CarePathValidationIssue[] = [];
  for (const field of ["referralId", "title", "reason"] as const) {
    if (!isNonBlankString(input[field])) {
      issues.push(issue("REQUIRED_FIELD_MISSING", field, `${field} is required.`));
    }
  }
  if (input.priority !== "urgent" && input.priority !== "critical") {
    issues.push(issue("MEDICATION_ALERT_PRIORITY_INVALID", "priority", "Medication alert priority must be urgent or critical."));
  }
  if (!isTimestamp(input.dueAt)) {
    issues.push(issue("TIMESTAMP_INVALID", "dueAt", "Medication alert dueAt must be a valid timestamp."));
  }
  if (!isTimestamp(evaluatedAt)) {
    issues.push(issue("TIMESTAMP_INVALID", "evaluatedAt", "Medication alert evaluation time must be valid."));
  } else if (isTimestamp(input.dueAt) && Date.parse(input.dueAt) <= Date.parse(evaluatedAt)) {
    issues.push(issue("MEDICATION_ALERT_DUE_NOT_FUTURE", "dueAt", "Medication alert dueAt must be later than evaluatedAt."));
  }
  if (!Number.isInteger(input.expectedReferralVersion) || Number(input.expectedReferralVersion) < 1) {
    issues.push(issue("FIELD_TYPE_INVALID", "expectedReferralVersion", "Expected referral version must be a positive integer."));
  }

  return issues.length === 0
    ? { valid: true, value: input as unknown as MedicationAlertValidationInput, issues: [] }
    : { valid: false, value: null, issues };
}

/** Stable synthetic case-level correlation key shared by the M2.1 care path. */
export function stableCaseCorrelationId(caseId: string): string {
  const normalized = caseId.trim();
  if (!normalized) throw new Error("A non-empty caseId is required for care-path correlation.");
  return `M21-CORR-${normalized}`;
}
