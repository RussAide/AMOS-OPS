/**
 * M2.4 — GRO Residential Operations deterministic prototype contract.
 *
 * Every record in this contract is synthetic evaluation evidence. The model is
 * deliberately independent from persistence so the Phase 2 integration layer
 * can bind it to the canonical repository without changing domain behavior.
 */

import {
  changedFieldNames,
  stablePhase2Id,
  type Phase2Actor,
  type Phase2AuditEvent,
} from "../phase2";

export const M24_EVIDENCE_CLASS = "synthetic_demo" as const;
export type M24EvidenceClass = typeof M24_EVIDENCE_CLASS;

export const M24_CRITERIA = [
  "M2.4-01",
  "M2.4-02",
  "M2.4-03",
  "M2.4-04",
  "M2.4-05",
  "M2.4-06",
  "M2.4-07",
  "M2.4-08",
] as const;
export type M24CriterionId = (typeof M24_CRITERIA)[number];

export const M24_SCENARIO_IDS = [
  "multi_shift",
  "high_census",
  "medication",
  "incident",
  "staffing_shortage",
  "handoff",
] as const;
export type M24ScenarioId = (typeof M24_SCENARIO_IDS)[number];

export type M24Actor = Phase2Actor;

export type M24Capability =
  | "census.manage"
  | "staffing.manage"
  | "shift.manage"
  | "shift.document"
  | "medication.administer"
  | "medication.reconcile"
  | "incident.capture"
  | "incident.close"
  | "rights.manage"
  | "engagement.manage"
  | "compliance.review";

const ROLE_CAPABILITIES: Readonly<Record<string, readonly M24Capability[]>> = {
  "super-admin": [
    "census.manage",
    "staffing.manage",
    "shift.manage",
    "shift.document",
    "medication.administer",
    "medication.reconcile",
    "incident.capture",
    "incident.close",
    "rights.manage",
    "engagement.manage",
    "compliance.review",
  ],
  administrator: [
    "census.manage",
    "staffing.manage",
    "shift.manage",
    "shift.document",
    "medication.reconcile",
    "incident.capture",
    "incident.close",
    "rights.manage",
    "engagement.manage",
    "compliance.review",
  ],
  "program-director": [
    "census.manage",
    "staffing.manage",
    "shift.manage",
    "incident.close",
    "rights.manage",
    "engagement.manage",
    "compliance.review",
  ],
  "gro-administrator": [
    "census.manage",
    "staffing.manage",
    "shift.manage",
    "shift.document",
    "medication.reconcile",
    "incident.capture",
    "incident.close",
    "rights.manage",
    "engagement.manage",
    "compliance.review",
  ],
  "shift-supervisor": [
    "census.manage",
    "staffing.manage",
    "shift.manage",
    "shift.document",
    "medication.reconcile",
    "incident.capture",
    "incident.close",
    "engagement.manage",
  ],
  "rcs-lead": [
    "shift.manage",
    "shift.document",
    "incident.capture",
    "engagement.manage",
  ],
  "youth-care-worker": [
    "shift.document",
    "incident.capture",
    "engagement.manage",
  ],
  "rcs-day": ["shift.document", "incident.capture", "engagement.manage"],
  "rcs-night": ["shift.document", "incident.capture", "engagement.manage"],
  nurse: [
    "medication.administer",
    "medication.reconcile",
    "incident.capture",
    "engagement.manage",
  ],
  "medication-aide": [
    "medication.administer",
    "medication.reconcile",
    "incident.capture",
  ],
  "crisis-intervention-specialist": ["incident.capture", "engagement.manage"],
  "family-liaison": ["rights.manage", "engagement.manage"],
  "recreation-coordinator": ["engagement.manage"],
  "compliance-officer": [
    "incident.close",
    "rights.manage",
    "compliance.review",
  ],
  "qa-coordinator": ["incident.close", "rights.manage", "compliance.review"],
};

export function m24RoleCan(role: string, capability: M24Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function m24CorrelationId(caseId: string): string {
  return stablePhase2Id("M24-CORR", caseId);
}

export type M24StageStatus = "operational" | "evaluation" | "closed";

export interface M24Stage {
  id: string;
  stageNumber: 1 | 2 | 3;
  name: string;
  licensedCapacity: number;
  operationalCapacity: number;
  currentCensus: number;
  leaveCount: number;
  capacityAlertThreshold: 90;
  status: M24StageStatus;
}

export interface M24Room {
  id: string;
  stageId: string;
  label: string;
  grossFloorSquareFeet: number;
  closetAndAlcoveSquareFeet: number;
  maximumBeds: number;
  active: boolean;
}

export type M24BedStatus = "available" | "occupied" | "held";

export interface M24Bed {
  id: string;
  stageId: string;
  roomId: string;
  label: string;
  status: M24BedStatus;
  youthId: string | null;
}

export type M24PlacementStatus = "active" | "leave" | "discharged";

export interface M24Placement {
  id: string;
  caseId: string;
  youthId: string;
  youthLabel: string;
  ageYears: number;
  requiresTreatmentServices: boolean;
  requiresConstantSupervision: boolean;
  parentConsentRequired: boolean;
  stageId: string;
  roomId: string;
  bedId: string;
  status: M24PlacementStatus;
  admittedAt: string;
  lastTransitionAt: string;
  version: number;
}

export interface M24PlacementTransition {
  id: string;
  placementId: string;
  youthId: string;
  transitionType: "admission" | "transfer" | "leave" | "return" | "discharge";
  fromStageId: string | null;
  toStageId: string | null;
  fromBedId: string | null;
  toBedId: string | null;
  reason: string;
  occurredAt: string;
}

export interface M24CensusAlert {
  id: string;
  stageId: string;
  alertType: "capacity_90_percent" | "capacity_exceeded";
  percentFull: number;
  currentCensus: number;
  leaveCount: number;
  capacityLimit: number;
  triggeredAt: string;
  acknowledgedBy: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
}

export type M24ShiftType = "day" | "evening" | "overnight";
export type M24AttendanceStatus =
  "scheduled" | "present" | "late" | "absent" | "no_show";

export interface M24StaffAssignment {
  staffId: string;
  staffName: string;
  role: string;
  qualified: boolean;
  workingDirectlyWithGroup: boolean;
  awakeStatus: "awake" | "sleeping";
  attendanceStatus: M24AttendanceStatus;
  clockInAt: string | null;
  clockOutAt: string | null;
}

export interface M24Shift {
  id: string;
  stageId: string;
  shiftDate: string;
  shiftType: M24ShiftType;
  startsAt: string;
  endsAt: string;
  status: "scheduled" | "active" | "completed";
  staff: M24StaffAssignment[];
  version: number;
}

export interface M24StaffingEvaluation {
  shiftId: string;
  period: "children-awake" | "night-sleeping";
  compliant: boolean;
  reasonCodes: readonly string[];
  weightedChildUnits: number;
  availableCapacityUnits: number;
  requiredAdditionalCapacityUnits: number;
  evaluatedAt: string;
}

export interface M24SafetyRound {
  id: string;
  shiftId: string;
  area: string;
  completedAt: string;
  completedBy: string;
  passed: boolean;
  findings: string | null;
  correctiveTaskId: string | null;
}

export interface M24YouthCareLog {
  id: string;
  shiftId: string;
  youthId: string;
  category:
    | "daily_living"
    | "behavioral"
    | "medical"
    | "educational"
    | "recreational"
    | "emotional_support"
    | "crisis_intervention";
  narrative: string;
  followUpRequired: boolean;
  followUpTaskId: string | null;
  recordedAt: string;
  recordedBy: string;
}

export interface M24Task {
  id: string;
  caseId: string;
  title: string;
  sourceType: string;
  sourceId: string;
  assignedRole: string;
  assignedTo: string | null;
  dueAt: string;
  priority: "routine" | "urgent" | "critical";
  status: "open" | "in_progress" | "completed" | "escalated";
  escalationLevel: "none" | "supervisor" | "director" | "executive";
  escalationReason: string | null;
  completedAt: string | null;
  version: number;
}

export interface M24ShiftHandoff {
  id: string;
  caseId: string;
  fromShiftId: string;
  toShiftId: string;
  summary: string;
  taskIds: string[];
  medicationRecordIds: string[];
  status: "pending" | "accepted" | "completed";
  initiatedBy: string;
  initiatedAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
  completedAt: string | null;
  version: number;
}

export type M24MedicationStatus =
  "scheduled" | "administered" | "refused" | "omitted" | "held";

export interface M24MedicationRecord {
  id: string;
  caseId: string;
  youthId: string;
  medicationName: string;
  dose: string;
  route: string;
  scheduledAt: string;
  status: M24MedicationStatus;
  isPrn: boolean;
  prnReason: string | null;
  prnEffectivenessDueAt: string | null;
  prnEffectiveness: "effective" | "partial" | "ineffective" | null;
  prnEffectivenessAt: string | null;
  isControlled: boolean;
  expectedControlledCount: number | null;
  countBefore: number | null;
  countAfter: number | null;
  witnessedBy: string | null;
  dispositionReason: string | null;
  administeredBy: string | null;
  administeredAt: string | null;
  discrepancyId: string | null;
  version: number;
}

export interface M24MedicationDiscrepancy {
  id: string;
  medicationRecordId: string;
  expectedCountAfter: number;
  actualCountAfter: number;
  reason: string;
  status: "open" | "resolved";
  openedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolution: string | null;
}

export interface M24MedicationHandoff {
  id: string;
  caseId: string;
  fromShiftId: string;
  toShiftId: string;
  medicationRecordIds: string[];
  status: "pending" | "accepted";
  initiatedBy: string;
  initiatedAt: string;
  acceptedBy: string | null;
  acceptedAt: string | null;
}

export type M24IncidentLevel = "L1" | "L2" | "L3" | "L4" | "L5";

export interface M24Incident {
  id: string;
  caseId: string;
  youthId: string;
  level: M24IncidentLevel;
  incidentType:
    | "behavioral"
    | "safety"
    | "medication"
    | "injury"
    | "elopement"
    | "self_harm"
    | "aggression"
    | "restraint"
    | "other";
  summary: string;
  occurredAt: string;
  isRestraint: boolean;
  interventionEndedAt: string | null;
  stabilizedAt: string | null;
  documentationDueAt: string;
  documentationCompletedAt: string | null;
  documentationTimely: boolean | null;
  debriefDueAt: string;
  debriefCompletedAt: string | null;
  debriefTimely: boolean | null;
  medicalEvaluationRequired: boolean;
  medicalEvaluationCompletedAt: string | null;
  parentNotifiedAt: string | null;
  supervisorReviewedAt: string | null;
  practiceCodes: string[];
  regulatoryReasonCodes: string[];
  notificationIds: string[];
  correctiveActionIds: string[];
  status: "open" | "documented" | "under_review" | "closed";
  version: number;
}

export interface M24Notification {
  id: string;
  caseId: string;
  sourceType: string;
  sourceId: string;
  targetRole: string;
  priority: "normal" | "high" | "critical";
  message: string;
  createdAt: string;
  acknowledgedAt: string | null;
}

export interface M24CorrectiveAction {
  id: string;
  incidentId: string;
  title: string;
  ownerRole: string;
  dueAt: string;
  status: "open" | "completed";
  completedAt: string | null;
  completionEvidence: string | null;
}

export interface M24RightsPosting {
  id: string;
  version: string;
  documentUrl: string;
  postedAt: string;
  postedBy: string;
  active: boolean;
}

export interface M24RightsAcknowledgment {
  id: string;
  caseId: string;
  youthId: string;
  postingId: string;
  compliant: boolean;
  reasonCodes: string[];
  acknowledgedAt: string;
  recordedBy: string;
}

export interface M24PracticeDecision {
  id: string;
  caseId: string;
  practiceCode: string;
  allowed: boolean;
  classification: string;
  reasonCodes: string[];
  evaluatedAt: string;
  evaluatedBy: string;
}

export type M24EngagementType =
  | "family_contact"
  | "activity"
  | "transport"
  | "crisis"
  | "discharge_coordination";

export interface M24EngagementEvent {
  id: string;
  caseId: string;
  youthId: string;
  eventType: M24EngagementType;
  occurredAt: string;
  summary: string;
  details: Record<string, string | number | boolean | null>;
  status: "open" | "completed";
  recordedBy: string;
}

export interface M24AuditEvent extends Omit<
  Phase2AuditEvent,
  "episodeId" | "before" | "after"
> {
  caseId: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface M24ScenarioResult {
  id: M24ScenarioId;
  passed: boolean;
  assertions: string[];
  evidenceIds: string[];
}

export interface M24State {
  sequence: number;
  stages: M24Stage[];
  rooms: M24Room[];
  beds: M24Bed[];
  placements: M24Placement[];
  transitions: M24PlacementTransition[];
  censusAlerts: M24CensusAlert[];
  shifts: M24Shift[];
  staffingEvaluations: M24StaffingEvaluation[];
  safetyRounds: M24SafetyRound[];
  careLogs: M24YouthCareLog[];
  tasks: M24Task[];
  shiftHandoffs: M24ShiftHandoff[];
  medications: M24MedicationRecord[];
  medicationDiscrepancies: M24MedicationDiscrepancy[];
  medicationHandoffs: M24MedicationHandoff[];
  incidents: M24Incident[];
  notifications: M24Notification[];
  correctiveActions: M24CorrectiveAction[];
  rightsPostings: M24RightsPosting[];
  rightsAcknowledgments: M24RightsAcknowledgment[];
  practiceDecisions: M24PracticeDecision[];
  engagementEvents: M24EngagementEvent[];
  auditEvents: M24AuditEvent[];
}

export interface M24Dashboard {
  generatedAt: string;
  evidenceClass: M24EvidenceClass;
  census: {
    stages: Array<M24Stage & { percentFull: number; availableBeds: number }>;
    totalCensus: number;
    totalCapacity: number;
    activeAlerts: number;
  };
  staffing: { evaluated: number; noncompliant: number };
  shifts: {
    scheduled: number;
    active: number;
    pendingHandoffs: number;
    openTasks: number;
  };
  medications: {
    scheduled: number;
    prnPending: number;
    openDiscrepancies: number;
    pendingHandoffs: number;
  };
  incidents: {
    open: number;
    critical: number;
    overdueDocumentation: number;
    overdueDebriefs: number;
  };
  rights: {
    activePostingVersion: string | null;
    pendingAcknowledgments: number;
  };
  engagement: {
    familyContacts: number;
    activities: number;
    transports: number;
    activeCrises: number;
    dischargeCoordinations: number;
  };
  auditEvents: number;
}

export function changedM24Fields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): string[] {
  return changedFieldNames(before ?? undefined, after ?? undefined);
}
