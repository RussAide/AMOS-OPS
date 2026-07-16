export type CcmgEvidenceClass = "synthetic_demo" | "production";
export type ReferralUrgency = "routine" | "urgent" | "emergency";
export type ReferralStatus =
  | "received"
  | "screening"
  | "held"
  | "rejected"
  | "ready_for_routing"
  | "active"
  | "closed";
export type IntakeProgressStatus = "not_started" | "in_progress" | "complete";
export type EligibilityStatus = "pending" | "eligible" | "ineligible" | "needs_review";
export type PayerVerificationStatus = "not_started" | "pending" | "verified" | "failed";
export type AuthorizationStatus = "not_required" | "pending" | "approved" | "denied" | "expired";
export type ConsentStatus = "pending" | "active" | "declined" | "revoked" | "expired";
export type CansScheduleStatus = "not_scheduled" | "scheduled" | "completed" | "overdue" | "cancelled";
export type CapacityStatus = "not_required" | "unchecked" | "available" | "reserved" | "waitlisted" | "unavailable";

export interface EligibilityCriteria {
  ageQualified: boolean;
  diagnosisQualified: boolean;
  functionalImpairment: boolean;
  coverageQualified: boolean;
}

export interface CcmgReferralIntake {
  id: string;
  caseId: string;
  evidenceClass: CcmgEvidenceClass;
  youthId: string;
  youthDisplayLabel: string;
  referralSourceDivision: "BHC" | "GRO" | "EO" | "GAD" | "external";
  referredAt: string;
  referralReason: string;
  urgency: ReferralUrgency;
  status: ReferralStatus;
  holdReason: string | null;
  rejectionReason: string | null;
  intake: {
    status: IntakeProgressStatus;
    completedAt: string | null;
    completedBy: string | null;
  };
  eligibility: {
    status: EligibilityStatus;
    criteria: EligibilityCriteria;
    rationale: string | null;
    determinedAt: string | null;
    determinedBy: string | null;
  };
  payerAuthorization: {
    payerLabel: string | null;
    verificationStatus: PayerVerificationStatus;
    verifiedAt: string | null;
    authorizationRequired: boolean;
    authorizationStatus: AuthorizationStatus;
    authorizationReference: string | null;
    authorizationEffectiveAt: string | null;
    authorizationExpiresAt: string | null;
  };
  consent: {
    status: ConsentStatus;
    consentReference: string | null;
    effectiveAt: string | null;
    expiresAt: string | null;
  };
  cans: {
    status: CansScheduleStatus;
    dueAt: string | null;
    scheduledFor: string | null;
    currentAssessmentId: string | null;
    currentVersion: number | null;
    acuity: "not_assessed" | "low" | "moderate" | "high" | "critical";
  };
  capacity: {
    required: boolean;
    facilityLabel: string | null;
    status: CapacityStatus;
    availableSlots: number | null;
    reservedSlotReference: string | null;
    checkedAt: string | null;
  };
  createdAt: string;
  updatedAt: string;
  version: number;
}

export const INTAKE_GATE_IDS = [
  "referral_intake",
  "eligibility",
  "payer_authorization",
  "consent",
  "cans_schedule",
  "capacity",
] as const;

export type IntakeGateId = (typeof INTAKE_GATE_IDS)[number];
export type IntakeReadinessReasonCode =
  | "INTAKE_INCOMPLETE"
  | "ELIGIBILITY_PENDING"
  | "ELIGIBILITY_INELIGIBLE"
  | "ELIGIBILITY_CRITERIA_INCOMPLETE"
  | "PAYER_NOT_VERIFIED"
  | "AUTHORIZATION_PENDING"
  | "AUTHORIZATION_DENIED_OR_EXPIRED"
  | "CONSENT_NOT_ACTIVE"
  | "CONSENT_EXPIRED"
  | "CANS_NOT_SCHEDULED"
  | "CANS_SCHEDULE_OVERDUE"
  | "CAPACITY_NOT_CHECKED"
  | "CAPACITY_UNAVAILABLE"
  | "REFERRAL_HELD"
  | "REFERRAL_REJECTED";

export interface IntakeGateResult {
  id: IntakeGateId;
  passed: boolean;
  reasonCodes: readonly IntakeReadinessReasonCode[];
  detail: string;
}

export interface IntakeReadinessEvaluation {
  ready: boolean;
  status: "ready_for_routing" | "blocked" | "held" | "rejected";
  gates: readonly IntakeGateResult[];
  reasonCodes: readonly IntakeReadinessReasonCode[];
  evaluatedAt: string;
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function gate(id: IntakeGateId, reasonCodes: IntakeReadinessReasonCode[], detail: string): IntakeGateResult {
  return { id, passed: reasonCodes.length === 0, reasonCodes, detail };
}

export function evaluateIntakeReadiness(
  referral: CcmgReferralIntake,
  evaluatedAt: string,
): IntakeReadinessEvaluation {
  const evaluatedTimestamp = timestamp(evaluatedAt);
  if (evaluatedTimestamp === null) throw new Error("A valid evaluatedAt timestamp is required.");

  const intakeReasons: IntakeReadinessReasonCode[] = referral.intake.status === "complete" ? [] : ["INTAKE_INCOMPLETE"];

  const eligibilityReasons: IntakeReadinessReasonCode[] = [];
  if (referral.eligibility.status === "ineligible") eligibilityReasons.push("ELIGIBILITY_INELIGIBLE");
  else if (referral.eligibility.status !== "eligible") eligibilityReasons.push("ELIGIBILITY_PENDING");
  if (referral.eligibility.status === "eligible" && !Object.values(referral.eligibility.criteria).every(Boolean)) {
    eligibilityReasons.push("ELIGIBILITY_CRITERIA_INCOMPLETE");
  }

  const payerReasons: IntakeReadinessReasonCode[] = [];
  if (referral.payerAuthorization.verificationStatus !== "verified") payerReasons.push("PAYER_NOT_VERIFIED");
  if (referral.payerAuthorization.authorizationRequired) {
    if (["denied", "expired"].includes(referral.payerAuthorization.authorizationStatus)) {
      payerReasons.push("AUTHORIZATION_DENIED_OR_EXPIRED");
    } else if (referral.payerAuthorization.authorizationStatus !== "approved") {
      payerReasons.push("AUTHORIZATION_PENDING");
    }
    const expiresAt = timestamp(referral.payerAuthorization.authorizationExpiresAt);
    if (expiresAt !== null && expiresAt < evaluatedTimestamp && !payerReasons.includes("AUTHORIZATION_DENIED_OR_EXPIRED")) {
      payerReasons.push("AUTHORIZATION_DENIED_OR_EXPIRED");
    }
  }

  const consentReasons: IntakeReadinessReasonCode[] = [];
  if (referral.consent.status !== "active") consentReasons.push("CONSENT_NOT_ACTIVE");
  const consentExpiresAt = timestamp(referral.consent.expiresAt);
  if (consentExpiresAt !== null && consentExpiresAt < evaluatedTimestamp) consentReasons.push("CONSENT_EXPIRED");

  const cansReasons: IntakeReadinessReasonCode[] = [];
  if (!["scheduled", "completed"].includes(referral.cans.status)) cansReasons.push("CANS_NOT_SCHEDULED");
  const cansDueAt = timestamp(referral.cans.dueAt);
  if (cansDueAt !== null && cansDueAt < evaluatedTimestamp && referral.cans.status !== "completed") {
    cansReasons.push("CANS_SCHEDULE_OVERDUE");
  }

  const capacityReasons: IntakeReadinessReasonCode[] = [];
  if (referral.capacity.required) {
    if (["unchecked", "not_required"].includes(referral.capacity.status)) capacityReasons.push("CAPACITY_NOT_CHECKED");
    else if (!["available", "reserved"].includes(referral.capacity.status)) capacityReasons.push("CAPACITY_UNAVAILABLE");
  }

  const gates = [
    gate("referral_intake", intakeReasons, "Referral intake must be complete."),
    gate("eligibility", eligibilityReasons, "Eligibility must be affirmatively determined from all controlled criteria."),
    gate("payer_authorization", payerReasons, "Payer verification and any required authorization must be current."),
    gate("consent", consentReasons, "Consent must be active and unexpired."),
    gate("cans_schedule", cansReasons, "CANS must be scheduled within its controlled due window or completed."),
    gate("capacity", capacityReasons, "Required capacity must be checked and available or reserved."),
  ] satisfies readonly IntakeGateResult[];

  const reasonCodes = [...new Set(gates.flatMap((result) => result.reasonCodes))];
  let status: IntakeReadinessEvaluation["status"] = reasonCodes.length === 0 ? "ready_for_routing" : "blocked";
  if (referral.status === "held") {
    status = "held";
    reasonCodes.unshift("REFERRAL_HELD");
  } else if (referral.status === "rejected" || eligibilityReasons.includes("ELIGIBILITY_INELIGIBLE")) {
    status = "rejected";
    if (!reasonCodes.includes("REFERRAL_REJECTED")) reasonCodes.unshift("REFERRAL_REJECTED");
  }

  return {
    ready: status === "ready_for_routing",
    status,
    gates,
    reasonCodes: [...new Set(reasonCodes)],
    evaluatedAt,
  };
}
