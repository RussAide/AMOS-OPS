import type {
  Phase3AuditEvent,
  Phase3CriterionResult,
  Phase3EvidenceClass,
  Phase3ModuleResult,
} from "./shared";
import type { UserRole } from "@/constants/roles";

export const M33_CRITERIA = [
  "M3.3-01",
  "M3.3-02",
  "M3.3-03",
  "M3.3-04",
  "M3.3-05",
  "M3.3-06",
  "M3.3-07",
  "M3.3-08",
] as const;
export type M33Criterion = (typeof M33_CRITERIA)[number];

export const M33_FIXED_NOW = "2026-07-14T13:00:00.000Z";
export const M33_ANNUAL_TRAINING_REQUIREMENT_HOURS = 40;
export const M33_PERSONNEL_RETENTION_YEARS = 7;

export type M33Tier = "T1" | "T2" | "T3" | "T4";
export type M33Division = "BHC" | "GRO" | "EO" | "GAD";
export type M33EmploymentStatus =
  "candidate" | "active" | "leave" | "separated";
export type M33RequirementType =
  | "license"
  | "certification"
  | "background"
  | "exclusion"
  | "health"
  | "training"
  | "ceu";
export type M33AccessImpact =
  "none" | "restrict_at_expiry" | "suspend_at_expiry";

export interface M33AccessAssignment {
  id: string;
  system: string;
  role: UserRole;
  scope: string;
  leastPrivilegeReason: string;
  status: "pending" | "active" | "revoked";
  effectiveAt: string;
  revokedAt?: string;
}

export interface M33WorkforceRecord {
  id: string;
  tier: M33Tier;
  syntheticName: string;
  positionId: string;
  positionTitle: string;
  role: UserRole;
  division: M33Division;
  department: string;
  supervisorId: string | null;
  employmentStatus: M33EmploymentStatus;
  employmentStartedAt: string;
  employmentEndedAt?: string;
  accessAssignments: readonly M33AccessAssignment[];
  evidenceClass: "synthetic_demo";
}

export type M33GateName =
  | "recruitment"
  | "conditional_offer"
  | "screening"
  | "credentialing"
  | "onboarding"
  | "orientation"
  | "role_learning"
  | "release_to_duty";

export interface M33LifecycleGate {
  id: string;
  workforceId: string;
  gate: M33GateName;
  sequence: number;
  status: "passed" | "blocked";
  ownerRole: UserRole;
  evidenceIds: readonly string[];
  decidedAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M33Requirement {
  id: string;
  tier: M33Tier;
  type: M33RequirementType;
  title: string;
  required: true;
  renewalCycleMonths: number | null;
  evidenceRequired: true;
  releaseToDutyImpact: "blocking" | "non_blocking";
  evidenceClass: "synthetic_demo";
}

export interface M33CredentialEvidence {
  id: string;
  workforceId: string;
  requirementId: string;
  issuedAt: string;
  expiresAt: string | null;
  status: "current" | "expiring" | "expired";
  secureDocumentLink: string;
  verifiedBy: string;
  verifiedAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M33ExpirationAlert {
  id: string;
  credentialEvidenceId: string;
  workforceId: string;
  thresholdDays: 90 | 60 | 30;
  daysRemaining: number;
  ownerId: string;
  escalationRole: UserRole;
  status: "assigned" | "acknowledged" | "escalated" | "closed";
  evidenceIds: readonly string[];
  accessImpact: M33AccessImpact;
  dueAt: string;
  createdAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M33TrainingEntry {
  id: string;
  workforceId: string;
  creditKey: string;
  title: string;
  requirementType: "training" | "ceu";
  completedAt: string;
  hours: number;
  evidenceId: string;
  status: "completed" | "void";
  applicable: boolean;
  verified: boolean;
  evidenceClass: "synthetic_demo";
}

export type M33TrainingExclusionReason =
  | "duplicate_credit_key"
  | "void"
  | "future"
  | "out_of_period"
  | "non_applicable"
  | "unverified";

export interface M33TrainingExclusion {
  entryId: string;
  creditKey: string;
  reason: M33TrainingExclusionReason;
}

export interface M33TrainingAnnualSummary {
  workforceId: string;
  calendarYear: 2026;
  requiredHours: 40;
  completedHours: number;
  compliant: boolean;
  sourceEntryIds: readonly string[];
  excludedEntries: readonly M33TrainingExclusion[];
}

export interface M33CredentialingCycle {
  id: string;
  workforceId: string;
  verifiedCompletePacket: {
    evidenceId: string;
    status: "verified_complete";
    receivedAt: string;
    verifiedAt: string;
    verifiedBy: string;
  };
  finalDecision: {
    evidenceId: string;
    decision: "approved";
    decidedAt: string;
    decidedBy: string;
    requirementEvidenceIds: readonly string[];
  };
  durationDays: 29;
  evidenceClass: "synthetic_demo";
}

export interface M33PerformanceEvent {
  id: string;
  workforceId: string;
  type:
    | "goal_set"
    | "supervision"
    | "coaching"
    | "review"
    | "improvement_plan_opened"
    | "improvement_plan_verified"
    | "separation_initiated"
    | "access_revoked"
    | "separation_closed";
  ownerId: string;
  status: "completed";
  evidenceIds: readonly string[];
  occurredAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M33PersonnelDocument {
  id: string;
  workforceId: string;
  documentType: string;
  classification: "personnel_confidential";
  secureLink: string;
  retentionYears: 7;
  allowedRoles: readonly UserRole[];
  evidenceClass: "synthetic_demo";
}

export interface M33AccessDecision {
  id: string;
  documentId: string;
  actorId: string;
  actorRole: UserRole;
  decision: "allowed" | "denied";
  reason: string;
  occurredAt: string;
  evidenceClass: "synthetic_demo";
}

export interface M33Scenario {
  id: string;
  tier: M33Tier;
  scenarioType: "onboarding" | "renewal" | "performance" | "separation";
  workforceId: string;
  status: "passed";
  assertionCount: number;
  evidenceIds: readonly string[];
  evidenceClass: "synthetic_demo";
}

export interface M33WriteBoundary {
  mode: "evaluation_only";
  productionWritesBlocked: true;
  liveConnectorMutationsBlocked: true;
  allowedEvidenceClass: "synthetic_demo";
  blockedActionTypes: readonly string[];
}

export interface M33Snapshot {
  readonly [key: string]: unknown;
  generatedAt: typeof M33_FIXED_NOW;
  workforce: readonly M33WorkforceRecord[];
  lifecycleGates: readonly M33LifecycleGate[];
  credentialingCycle: M33CredentialingCycle;
  requirements: readonly M33Requirement[];
  credentialEvidence: readonly M33CredentialEvidence[];
  expirationAlerts: readonly M33ExpirationAlert[];
  trainingEntries: readonly M33TrainingEntry[];
  annualTraining: readonly M33TrainingAnnualSummary[];
  performanceEvents: readonly M33PerformanceEvent[];
  personnelDocuments: readonly M33PersonnelDocument[];
  accessDecisions: readonly M33AccessDecision[];
  scenarios: readonly M33Scenario[];
  credentialingDurationDays: 29;
  releaseToDutyPassed: true;
  writeBoundary: M33WriteBoundary;
}

export interface M33ModuleResult extends Omit<
  Phase3ModuleResult,
  "milestone" | "domain" | "criteria" | "snapshot" | "auditEvents"
> {
  milestone: "M3.3";
  domain: "WORKFORCE";
  criteria: readonly Phase3CriterionResult[];
  snapshot: M33Snapshot;
  auditEvents: readonly Phase3AuditEvent[];
}

export interface M33WriteCandidate {
  id: string;
  evidenceClass: Phase3EvidenceClass;
}

/**
 * Synthetic services fail closed. A production-class record or an identifier
 * outside the synthetic namespace can never enter this prototype module.
 */
export function assertM33SyntheticWrite(
  candidate: M33WriteCandidate,
): asserts candidate is M33WriteCandidate & {
  evidenceClass: "synthetic_demo";
} {
  if (candidate.evidenceClass !== "synthetic_demo") {
    throw new Error("M33_PRODUCTION_WRITE_BLOCKED");
  }
  if (!candidate.id.startsWith("SYNTH-")) {
    throw new Error("M33_NON_SYNTHETIC_ID_BLOCKED");
  }
}
