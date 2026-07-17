import { z } from "zod";
import { TRPCError } from "@trpc/server";
import type Database from "better-sqlite3";
import { createRouter, publicQuery, authedQuery, auditLog } from "../middleware";
import { sqlite } from "../queries/connection";
import { randomUUID } from "crypto";
import { assertSyntheticScenarioRuntime, env } from "../lib/env";
import {
  CCMG_QUEUE_IDS,
  changedFieldNames,
  evaluateIntakeReadiness,
  isValidWorkflowTransition,
  routeCansToApprovedPlans,
  validateCansVersionHistory,
  visibleQueueIdsForRole,
  type CansActionableItem,
  type CansAssessmentVersion,
  type CansDomain,
  type CansPlanLineage,
  type CcmgAuditEvent,
  type CcmgAuditEventType,
  type CcmgEvidenceClass,
  type CcmgHandoff,
  type CcmgQueueId,
  type CcmgReferralIntake,
  type CcmgWorkItem,
  type OversightDashboardResponse,
  type OversightQueueItem,
  type ReferralDetailResponse,
  type RoutedPlanGoal,
  type WorkflowStatus,
} from "@contracts/ccmg";
import {
  recomputeReferralStatus,
  stableCaseCorrelationId,
  validateMedicationAlertInput,
  validatePlanTargetRoute,
  validateReferralGateDecision,
} from "@contracts/ccmg/care-path";

type ChartAuditRow = Record<string, unknown>;

interface PersonaRow {
  id: string;
  name: string;
  code: string;
  description: string;
  status: string;
  wave: string;
  category: string;
  permissions: string | null;
  outputs: string | null;
  activated_at: string | null;
  sort_order: number;
}

interface StatusCountRow {
  status: string;
  count: number;
}

interface WaveStatusCountRow extends StatusCountRow {
  wave: string;
}

interface CountRow {
  c: number;
}

interface WaveActivationSummary {
  active: number;
  inactive: number;
  [status: string]: number;
}

type M21Database = Database.Database;

export interface M21Actor {
  id: string;
  role: string;
}

type ReferralGateMutationBase = {
  referralId: string;
  reason: string;
  expectedVersion: number;
};

export type RecordReferralGateInput = ReferralGateMutationBase & (
  | { gate: "intake"; decision: { status: "complete" } }
  | {
      gate: "eligibility";
      decision: {
        status: "eligible" | "ineligible" | "needs_review";
        criteria?: CcmgReferralIntake["eligibility"]["criteria"];
        rationale: string;
      };
    }
  | {
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
    }
  | {
      gate: "consent";
      decision: {
        status: "active" | "declined" | "revoked" | "expired";
        consentReference?: string;
        effectiveAt?: string;
        expiresAt?: string;
      };
    }
  | {
      gate: "cans_schedule";
      decision: {
        status: "scheduled" | "overdue" | "cancelled";
        dueAt: string;
        scheduledFor?: string;
      };
    }
  | {
      gate: "capacity";
      decision: {
        required: boolean;
        facilityLabel?: string;
        status: "available" | "reserved" | "waitlisted" | "unavailable";
        availableSlots?: number;
        reservedSlotReference?: string;
        checkedAt?: string;
      };
    }
);

export interface FinalizeCansVersionInput {
  referralId: string;
  instrumentVersion: string;
  domainScores: Readonly<Record<CansDomain, number>>;
  actionableItems: readonly CansActionableItem[];
  totalScore: number;
  acuity: CansAssessmentVersion["acuity"];
  completedAt: string;
  reason: string;
  expectedReferralVersion: number;
}

export interface ApproveCansTargetRouteInput {
  referralId: string;
  cansAssessmentId: string;
  targetType: CansPlanLineage["targetType"];
  targetRecordId: string;
  targetVersion: number;
  reason: string;
  expectedReferralVersion: number;
}

export interface CreateMedicationOversightAlertInput {
  referralId: string;
  title: string;
  priority: "urgent" | "critical";
  dueAt: string;
  reason: string;
  expectedReferralVersion: number;
}

interface M21ReferralRow {
  id: string;
  case_id: string;
  evidence_class: CcmgEvidenceClass;
  youth_id: string;
  youth_display_label: string;
  referral_source_division: CcmgReferralIntake["referralSourceDivision"];
  referred_at: string;
  referral_reason: string;
  urgency: CcmgReferralIntake["urgency"];
  status: CcmgReferralIntake["status"];
  hold_reason: string | null;
  rejection_reason: string | null;
  intake_status: CcmgReferralIntake["intake"]["status"];
  intake_completed_at: string | null;
  intake_completed_by: string | null;
  eligibility_status: CcmgReferralIntake["eligibility"]["status"];
  age_qualified: number;
  diagnosis_qualified: number;
  functional_impairment: number;
  coverage_qualified: number;
  eligibility_rationale: string | null;
  eligibility_determined_at: string | null;
  eligibility_determined_by: string | null;
  payer_label: string | null;
  payer_verification_status: CcmgReferralIntake["payerAuthorization"]["verificationStatus"];
  payer_verified_at: string | null;
  authorization_required: number;
  authorization_status: CcmgReferralIntake["payerAuthorization"]["authorizationStatus"];
  authorization_reference: string | null;
  authorization_effective_at: string | null;
  authorization_expires_at: string | null;
  consent_status: CcmgReferralIntake["consent"]["status"];
  consent_reference: string | null;
  consent_effective_at: string | null;
  consent_expires_at: string | null;
  cans_status: CcmgReferralIntake["cans"]["status"];
  cans_due_at: string | null;
  cans_scheduled_for: string | null;
  current_cans_assessment_id: string | null;
  current_cans_version: number | null;
  cans_acuity: CcmgReferralIntake["cans"]["acuity"];
  capacity_required: number;
  capacity_facility_label: string | null;
  capacity_status: CcmgReferralIntake["capacity"]["status"];
  available_slots: number | null;
  reserved_slot_reference: string | null;
  capacity_checked_at: string | null;
  created_at: string;
  updated_at: string;
  version: number;
}

interface M21WorkItemRow {
  id: string;
  case_id: string;
  referral_id: string;
  youth_display_label: string;
  queue_id: CcmgQueueId;
  title: string;
  status: CcmgWorkItem["status"];
  priority: CcmgWorkItem["priority"];
  assigned_division: CcmgWorkItem["assignedDivision"];
  assigned_department: CcmgWorkItem["assignedDepartment"];
  assigned_role: string;
  assigned_to: string | null;
  due_at: string;
  escalation_level: CcmgWorkItem["escalationLevel"];
  escalated_at: string | null;
  escalation_reason: string | null;
  approval_status: CcmgWorkItem["approvalStatus"];
  approved_by: string | null;
  approved_at: string | null;
  approval_rationale: string | null;
  exception_code: string | null;
  exception_reason: string | null;
  exception_status: CcmgWorkItem["exceptionStatus"];
  source_type: string;
  source_id: string;
  evidence_class: CcmgEvidenceClass;
  version: number;
  created_at: string;
  updated_at: string;
}

interface M21CansRow {
  id: string;
  case_id: string;
  referral_id: string;
  evidence_class: CcmgEvidenceClass;
  version: number;
  instrument_version: string;
  status: CansAssessmentVersion["status"];
  previous_assessment_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  total_score: number | null;
  acuity: CansAssessmentVersion["acuity"];
  domain_scores_json: string;
  actionable_items_json: string;
  created_at: string;
}

interface M21LineageRow {
  cans_assessment_id: string;
  cans_version: number;
  target_type: CansPlanLineage["targetType"];
  target_record_id: string;
  target_version: number;
  target_approval_status: "approved";
  target_approved_by: string;
  target_approved_at: string;
  routed_by: string;
  routed_at: string;
  mapped_goals_json: string;
}

interface M21HandoffRow {
  id: string;
  case_id: string;
  referral_id: string;
  work_item_id: string;
  from_division: CcmgHandoff["fromDivision"];
  from_department: CcmgHandoff["fromDepartment"];
  to_division: CcmgHandoff["toDivision"];
  to_department: CcmgHandoff["toDepartment"];
  status: CcmgHandoff["status"];
  reason: string;
  payload_json: string;
  initiated_by: string;
  initiated_at: string;
  due_at: string;
  accepted_by: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  evidence_class: CcmgEvidenceClass;
  version: number;
}

interface M21AuditRow {
  id: string;
  case_id: string | null;
  referral_id: string | null;
  work_item_id: string | null;
  event_type: CcmgAuditEvent["eventType"];
  action: string;
  entity_type: string;
  entity_id: string;
  actor_id: string;
  actor_role: string;
  reason: string;
  before_json: string | null;
  after_json: string | null;
  changed_fields_json: string;
  correlation_id: string;
  evidence_class: CcmgEvidenceClass;
  occurred_at: string;
}

const QUEUE_LABELS: Readonly<Record<CcmgQueueId, string>> = {
  intake: "Intake",
  qa: "Quality Assurance",
  cans: "CANS",
  medication_management: "Medication Management",
  mhtcm: "MHTCM",
  mhrs: "MHRS",
};

const ALL_QUEUE_ACCESS_ROLES = new Set([
  "super-admin",
  "managing-director",
  "administrator",
  "bhc-director",
  "clinical-director",
  "ccmg-program-director",
  "clinical-supervisor",
]);

const MINIMUM_NECESSARY_DASHBOARD_ONLY_ROLES = new Set([
  "revenue-cycle-manager",
  "gro-administrator",
  "program-director",
]);

const GRO_CAPACITY_ROLES = new Set(["gro-administrator", "program-director"]);

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function referralFromRow(row: M21ReferralRow): CcmgReferralIntake {
  return {
    id: row.id,
    caseId: row.case_id,
    evidenceClass: row.evidence_class,
    youthId: row.youth_id,
    youthDisplayLabel: row.youth_display_label,
    referralSourceDivision: row.referral_source_division,
    referredAt: row.referred_at,
    referralReason: row.referral_reason,
    urgency: row.urgency,
    status: row.status,
    holdReason: row.hold_reason,
    rejectionReason: row.rejection_reason,
    intake: { status: row.intake_status, completedAt: row.intake_completed_at, completedBy: row.intake_completed_by },
    eligibility: {
      status: row.eligibility_status,
      criteria: {
        ageQualified: Boolean(row.age_qualified),
        diagnosisQualified: Boolean(row.diagnosis_qualified),
        functionalImpairment: Boolean(row.functional_impairment),
        coverageQualified: Boolean(row.coverage_qualified),
      },
      rationale: row.eligibility_rationale,
      determinedAt: row.eligibility_determined_at,
      determinedBy: row.eligibility_determined_by,
    },
    payerAuthorization: {
      payerLabel: row.payer_label,
      verificationStatus: row.payer_verification_status,
      verifiedAt: row.payer_verified_at,
      authorizationRequired: Boolean(row.authorization_required),
      authorizationStatus: row.authorization_status,
      authorizationReference: row.authorization_reference,
      authorizationEffectiveAt: row.authorization_effective_at,
      authorizationExpiresAt: row.authorization_expires_at,
    },
    consent: {
      status: row.consent_status,
      consentReference: row.consent_reference,
      effectiveAt: row.consent_effective_at,
      expiresAt: row.consent_expires_at,
    },
    cans: {
      status: row.cans_status,
      dueAt: row.cans_due_at,
      scheduledFor: row.cans_scheduled_for,
      currentAssessmentId: row.current_cans_assessment_id,
      currentVersion: row.current_cans_version,
      acuity: row.cans_acuity,
    },
    capacity: {
      required: Boolean(row.capacity_required),
      facilityLabel: row.capacity_facility_label,
      status: row.capacity_status,
      availableSlots: row.available_slots,
      reservedSlotReference: row.reserved_slot_reference,
      checkedAt: row.capacity_checked_at,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    version: row.version,
  };
}

function workItemFromRow(row: M21WorkItemRow): CcmgWorkItem {
  return {
    id: row.id,
    caseId: row.case_id,
    referralId: row.referral_id,
    youthDisplayLabel: row.youth_display_label,
    queueId: row.queue_id,
    title: row.title,
    status: row.status,
    priority: row.priority,
    assignedDivision: row.assigned_division,
    assignedDepartment: row.assigned_department,
    assignedRole: row.assigned_role,
    assignedTo: row.assigned_to,
    dueAt: row.due_at,
    escalationLevel: row.escalation_level,
    escalatedAt: row.escalated_at,
    escalationReason: row.escalation_reason,
    approvalStatus: row.approval_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    approvalRationale: row.approval_rationale,
    exceptionCode: row.exception_code,
    exceptionReason: row.exception_reason,
    exceptionStatus: row.exception_status,
    sourceType: row.source_type,
    sourceId: row.source_id,
    evidenceClass: row.evidence_class,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function cansFromRow(row: M21CansRow): CansAssessmentVersion {
  return {
    id: row.id,
    caseId: row.case_id,
    referralId: row.referral_id,
    evidenceClass: row.evidence_class,
    version: row.version,
    instrumentVersion: row.instrument_version,
    status: row.status,
    previousAssessmentId: row.previous_assessment_id,
    completedAt: row.completed_at,
    completedBy: row.completed_by,
    totalScore: row.total_score,
    acuity: row.acuity,
    domainScores: parseJson<Readonly<Record<CansDomain, number>>>(row.domain_scores_json, {
      behavioral_emotional: 0,
      risk_behaviors: 0,
      life_functioning: 0,
      strengths: 0,
      caregiver_resources: 0,
      cultural_factors: 0,
    }),
    actionableItems: parseJson<CansActionableItem[]>(row.actionable_items_json, []),
    createdAt: row.created_at,
  };
}

function lineageFromRow(row: M21LineageRow): CansPlanLineage {
  return {
    cansAssessmentId: row.cans_assessment_id,
    cansVersion: row.cans_version,
    targetType: row.target_type,
    targetRecordId: row.target_record_id,
    targetVersion: row.target_version,
    targetApprovalStatus: row.target_approval_status,
    targetApprovedBy: row.target_approved_by,
    targetApprovedAt: row.target_approved_at,
    routedBy: row.routed_by,
    routedAt: row.routed_at,
    mappedGoals: parseJson<RoutedPlanGoal[]>(row.mapped_goals_json, []),
  };
}

function handoffFromRow(row: M21HandoffRow): CcmgHandoff {
  return {
    id: row.id,
    caseId: row.case_id,
    referralId: row.referral_id,
    workItemId: row.work_item_id,
    fromDivision: row.from_division,
    fromDepartment: row.from_department,
    toDivision: row.to_division,
    toDepartment: row.to_department,
    status: row.status,
    reason: row.reason,
    payload: parseJson<Record<string, unknown>>(row.payload_json, {}),
    initiatedBy: row.initiated_by,
    initiatedAt: row.initiated_at,
    dueAt: row.due_at,
    acceptedBy: row.accepted_by,
    acceptedAt: row.accepted_at,
    completedAt: row.completed_at,
    evidenceClass: row.evidence_class,
    version: row.version,
  };
}

function auditFromRow(row: M21AuditRow): CcmgAuditEvent {
  return {
    id: row.id,
    caseId: row.case_id,
    referralId: row.referral_id,
    workItemId: row.work_item_id,
    eventType: row.event_type,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    actorId: row.actor_id,
    actorRole: row.actor_role,
    reason: row.reason,
    before: parseJson<Record<string, unknown> | null>(row.before_json, null),
    after: parseJson<Record<string, unknown> | null>(row.after_json, null),
    changedFields: parseJson<string[]>(row.changed_fields_json, []),
    correlationId: row.correlation_id,
    evidenceClass: row.evidence_class,
    occurredAt: row.occurred_at,
  };
}

function recordAccess(
  db: M21Database,
  input: {
    actor: M21Actor;
    entityType: string;
    entityId: string;
    evidenceClass: CcmgEvidenceClass;
    action: string;
    reason: string;
    caseId?: string | null;
    referralId?: string | null;
  },
): { id: string; occurredAt: string } {
  const id = `M21-AUDIT-${randomUUID()}`;
  const occurredAt = new Date().toISOString();
  db.prepare(`INSERT INTO m21_ccmg_audit_events
    (id,case_id,referral_id,work_item_id,event_type,action,entity_type,entity_id,actor_id,actor_role,reason,before_json,after_json,changed_fields_json,correlation_id,evidence_class,occurred_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,
      input.caseId ?? null,
      input.referralId ?? null,
      null,
      "access",
      input.action,
      input.entityType,
      input.entityId,
      input.actor.id,
      input.actor.role,
      input.reason,
      null,
      null,
      "[]",
      randomUUID(),
      input.evidenceClass,
      occurredAt,
    );
  return { id, occurredAt };
}

function recordChangeAudit(
  db: M21Database,
  input: {
    actor: M21Actor;
    item: CcmgWorkItem;
    eventType: Exclude<CcmgAuditEventType, "access">;
    action: string;
    entityType: string;
    entityId: string;
    reason: string;
    before: Readonly<Record<string, unknown>>;
    after: Readonly<Record<string, unknown>>;
  },
): string {
  const id = `M21-AUDIT-${randomUUID()}`;
  const changedFields = changedFieldNames(input.before, input.after);
  db.prepare(`INSERT INTO m21_ccmg_audit_events
    (id,case_id,referral_id,work_item_id,event_type,action,entity_type,entity_id,actor_id,actor_role,reason,before_json,after_json,changed_fields_json,correlation_id,evidence_class,occurred_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,
      input.item.caseId,
      input.item.referralId,
      input.item.id,
      input.eventType,
      input.action,
      input.entityType,
      input.entityId,
      input.actor.id,
      input.actor.role,
      input.reason,
      JSON.stringify(input.before),
      JSON.stringify(input.after),
      JSON.stringify(changedFields),
      stableCaseCorrelationId(input.item.caseId),
      input.item.evidenceClass,
      new Date().toISOString(),
    );
  return id;
}

function recordEntityAudit(
  db: M21Database,
  input: {
    actor: M21Actor;
    referral: CcmgReferralIntake;
    workItemId?: string | null;
    eventType: Exclude<CcmgAuditEventType, "access">;
    action: string;
    entityType: string;
    entityId: string;
    reason: string;
    before: Readonly<Record<string, unknown>>;
    after: Readonly<Record<string, unknown>>;
  },
): string {
  const id = `M21-AUDIT-${randomUUID()}`;
  const changedFields = changedFieldNames(input.before, input.after);
  db.prepare(`INSERT INTO m21_ccmg_audit_events
    (id,case_id,referral_id,work_item_id,event_type,action,entity_type,entity_id,actor_id,actor_role,reason,before_json,after_json,changed_fields_json,correlation_id,evidence_class,occurred_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
      id,
      input.referral.caseId,
      input.referral.id,
      input.workItemId ?? null,
      input.eventType,
      input.action,
      input.entityType,
      input.entityId,
      input.actor.id,
      input.actor.role,
      input.reason,
      JSON.stringify(input.before),
      JSON.stringify(input.after),
      JSON.stringify(changedFields),
      stableCaseCorrelationId(input.referral.caseId),
      input.referral.evidenceClass,
      new Date().toISOString(),
    );
  return id;
}

function getReferral(db: M21Database, referralId: string): CcmgReferralIntake {
  const row = db.prepare("SELECT * FROM m21_ccmg_referrals WHERE id = ?").get(referralId) as M21ReferralRow | undefined;
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "CCMG referral not found." });
  return referralFromRow(row);
}

function ensureReferralExpectedVersion(referral: CcmgReferralIntake, expectedVersion: number): void {
  if (referral.version !== expectedVersion) {
    throw new TRPCError({ code: "CONFLICT", message: `Referral version conflict; current version is ${referral.version}.` });
  }
}

function denyReferralMutation(
  db: M21Database,
  actor: M21Actor,
  referral: CcmgReferralIntake,
  action: string,
  reason: string,
  code: "FORBIDDEN" | "PRECONDITION_FAILED" = "FORBIDDEN",
): never {
  recordEntityAudit(db, {
    actor,
    referral,
    eventType: "material_change",
    action: `${action}_denied`,
    entityType: "ccmg_referral",
    entityId: referral.id,
    reason,
    before: { decision: "requested", action, status: referral.status, version: referral.version },
    after: { decision: "denied", action, status: referral.status, version: referral.version },
  });
  throw new TRPCError({ code, message: reason });
}

type WorkflowMutationKind = "transition" | "assignment" | "approval" | "handoff" | "escalation" | "exception";

function denyWorkflowMutation(
  db: M21Database,
  actor: M21Actor,
  item: CcmgWorkItem,
  operation: WorkflowMutationKind,
  reason: string,
  code: "FORBIDDEN" | "PRECONDITION_FAILED" = "FORBIDDEN",
): never {
  recordChangeAudit(db, {
    actor,
    item,
    eventType: operation === "approval"
      ? "approval"
      : operation === "assignment"
        ? "assignment"
        : operation === "handoff"
          ? "plan_handoff"
          : "material_change",
    action: `${operation}_denied`,
    entityType: "ccmg_work_item",
    entityId: item.id,
    reason,
    before: { decision: "requested", operation },
    after: { decision: "denied", operation },
  });
  throw new TRPCError({ code, message: reason });
}

function getWorkItem(db: M21Database, workItemId: string): CcmgWorkItem {
  const row = db.prepare("SELECT * FROM m21_ccmg_work_items WHERE id = ?").get(workItemId) as M21WorkItemRow | undefined;
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "CCMG work item not found." });
  return workItemFromRow(row);
}

function getHandoff(db: M21Database, handoffId: string): CcmgHandoff {
  const row = db.prepare("SELECT * FROM m21_ccmg_handoffs WHERE id = ?").get(handoffId) as M21HandoffRow | undefined;
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "CCMG handoff not found." });
  return handoffFromRow(row);
}

function ensureExpectedVersion(item: CcmgWorkItem, expectedVersion: number): void {
  if (item.version !== expectedVersion) {
    throw new TRPCError({ code: "CONFLICT", message: `Workflow version conflict; current version is ${item.version}.` });
  }
}

const WORKFLOW_ASSIGNMENT_ROLES = new Set([
  ...ALL_QUEUE_ACCESS_ROLES,
  "treatment-director",
  "mhtcm-supervisor",
  "mhrs-supervisor",
]);

function roleCanApproveQueue(role: string, queueId: CcmgQueueId): boolean {
  const queueApprovers: Readonly<Record<CcmgQueueId, readonly string[]>> = {
    intake: ["ccmg-program-director"],
    qa: ["treatment-director"],
    cans: ["treatment-director"],
    medication_management: ["clinical-director"],
    mhtcm: ["treatment-director", "mhtcm-supervisor"],
    mhrs: ["mhrs-supervisor"],
  };
  return queueApprovers[queueId].includes(role);
}

function ownerRolesForDepartment(department: CcmgWorkItem["assignedDepartment"]): readonly string[] {
  const departmentOwners: Readonly<Record<CcmgWorkItem["assignedDepartment"], readonly string[]>> = {
    CCMG: ["ccmg-program-director"],
    MHTCM: ["mhtcm-supervisor", "treatment-director"],
    MHRS: ["mhrs-supervisor"],
    GRO: ["program-director", "gro-administrator"],
  };
  return departmentOwners[department];
}

function primaryOwnerRoleForDepartment(department: CcmgWorkItem["assignedDepartment"]): string {
  return ownerRolesForDepartment(department)[0];
}

function queueForHandoffDestination(
  department: CcmgWorkItem["assignedDepartment"],
  currentQueue: CcmgQueueId,
): CcmgQueueId {
  if (department === "MHTCM") return "mhtcm";
  if (department === "MHRS") return "mhrs";
  return currentQueue;
}

function authorizeWorkflowMutation(
  db: M21Database,
  actor: M21Actor,
  item: CcmgWorkItem,
  operation: WorkflowMutationKind,
): void {
  const visibleQueueSet = new Set(visibleQueueIdsForRole(actor.role));
  if (!workItemVisibleToActor(actor, item, visibleQueueSet)) {
    denyWorkflowMutation(db, actor, item, operation, "Work item is outside the authenticated role's controlled queue scope.");
  }
  if (operation === "approval") {
    if (roleCanApproveQueue(actor.role, item.queueId)) return;
    denyWorkflowMutation(db, actor, item, operation, "Authenticated role is not an authorized independent approver for this queue.");
  }
  if (ALL_QUEUE_ACCESS_ROLES.has(actor.role)) return;
  if (operation === "assignment" && WORKFLOW_ASSIGNMENT_ROLES.has(actor.role)) return;
  if (operation === "handoff" && (
    ["treatment-director", "mhtcm-supervisor", "mhrs-supervisor"].includes(actor.role)
    || (GRO_CAPACITY_ROLES.has(actor.role) && item.sourceType === "capacity")
  )) return;
  if (["transition", "escalation", "exception"].includes(operation)
    && (item.assignedTo === actor.id || item.assignedRole === actor.role || WORKFLOW_ASSIGNMENT_ROLES.has(actor.role))) return;
  denyWorkflowMutation(db, actor, item, operation, `Role is not permitted to perform ${operation} on this work item.`);
}

function ensureCompletionPrerequisites(
  db: M21Database,
  actor: M21Actor,
  item: CcmgWorkItem,
  operation: "transition" | "approval",
): void {
  if (item.approvalStatus === "pending" && operation !== "approval") {
    denyWorkflowMutation(db, actor, item, operation, "Pending approval must be resolved before completion.", "PRECONDITION_FAILED");
  }
  if (item.exceptionStatus === "open") {
    denyWorkflowMutation(db, actor, item, operation, "Open exception must be resolved or waived before completion.", "PRECONDITION_FAILED");
  }
  const unresolvedHandoff = db.prepare(`SELECT id FROM m21_ccmg_handoffs
    WHERE work_item_id = ? AND status = 'initiated' LIMIT 1`).get(item.id) as { id: string } | undefined;
  if (unresolvedHandoff) {
    denyWorkflowMutation(db, actor, item, operation, "Related handoff must be accepted, rejected, or returned before completion.", "PRECONDITION_FAILED");
  }
}

function updatedWorkItem(db: M21Database, id: string): CcmgWorkItem {
  return getWorkItem(db, id);
}

export function transitionM21Workflow(
  actor: M21Actor,
  input: { workItemId: string; toStatus: WorkflowStatus; reason: string; expectedVersion: number },
  db: M21Database = sqlite,
): { workItem: CcmgWorkItem; auditEventId: string } {
  const current = getWorkItem(db, input.workItemId);
  authorizeWorkflowMutation(db, actor, current, "transition");
  ensureExpectedVersion(current, input.expectedVersion);
  if (!isValidWorkflowTransition(current.status, input.toStatus)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `Invalid workflow transition ${current.status} -> ${input.toStatus}.` });
  }
  if (input.toStatus === "completed") ensureCompletionPrerequisites(db, actor, current, "transition");
  return db.transaction(() => {
    const now = new Date().toISOString();
    const result = db.prepare("UPDATE m21_ccmg_work_items SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?")
      .run(input.toStatus, now, current.id, input.expectedVersion);
    if (result.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Workflow version changed during transition." });
    const auditEventId = recordChangeAudit(db, {
      actor,
      item: current,
      eventType: "material_change",
      action: "workflow_status_transitioned",
      entityType: "ccmg_work_item",
      entityId: current.id,
      reason: input.reason,
      before: { status: current.status, version: current.version },
      after: { status: input.toStatus, version: current.version + 1 },
    });
    return { workItem: updatedWorkItem(db, current.id), auditEventId };
  })();
}

export function assignM21Workflow(
  actor: M21Actor,
  input: {
    workItemId: string;
    assignedDivision: CcmgWorkItem["assignedDivision"];
    assignedDepartment: CcmgWorkItem["assignedDepartment"];
    assignedRole: string;
    assignedTo?: string;
    dueAt: string;
    reason: string;
    expectedVersion: number;
  },
  db: M21Database = sqlite,
): { workItem: CcmgWorkItem; auditEventId: string } {
  const current = getWorkItem(db, input.workItemId);
  authorizeWorkflowMutation(db, actor, current, "assignment");
  ensureExpectedVersion(current, input.expectedVersion);
  const validDivisionDepartment = input.assignedDivision === "GRO"
    ? input.assignedDepartment === "GRO"
    : input.assignedDepartment !== "GRO";
  if (!validDivisionDepartment || !Number.isFinite(Date.parse(input.dueAt))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Assignment division/department or due date is invalid." });
  }
  return db.transaction(() => {
    const now = new Date().toISOString();
    const result = db.prepare(`UPDATE m21_ccmg_work_items
      SET assigned_division = ?, assigned_department = ?, assigned_role = ?, assigned_to = ?, due_at = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(
        input.assignedDivision,
        input.assignedDepartment,
        input.assignedRole,
        input.assignedTo ?? null,
        input.dueAt,
        now,
        current.id,
        input.expectedVersion,
      );
    if (result.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Workflow version changed during assignment." });
    const auditEventId = recordChangeAudit(db, {
      actor,
      item: current,
      eventType: "assignment",
      action: "work_item_assigned",
      entityType: "ccmg_work_item",
      entityId: current.id,
      reason: input.reason,
      before: {
        assignedDivision: current.assignedDivision,
        assignedDepartment: current.assignedDepartment,
        assignedRole: current.assignedRole,
        assignedTo: current.assignedTo,
        dueAt: current.dueAt,
      },
      after: {
        assignedDivision: input.assignedDivision,
        assignedDepartment: input.assignedDepartment,
        assignedRole: input.assignedRole,
        assignedTo: input.assignedTo ?? null,
        dueAt: input.dueAt,
      },
    });
    return { workItem: updatedWorkItem(db, current.id), auditEventId };
  })();
}

export function approveM21Workflow(
  actor: M21Actor,
  input: { workItemId: string; decision: "approved" | "rejected"; rationale: string; expectedVersion: number },
  db: M21Database = sqlite,
): { workItem: CcmgWorkItem; auditEventId: string } {
  const current = getWorkItem(db, input.workItemId);
  authorizeWorkflowMutation(db, actor, current, "approval");
  ensureExpectedVersion(current, input.expectedVersion);
  if (current.assignedTo === actor.id) {
    denyWorkflowMutation(db, actor, current, "approval", "The assigned owner cannot approve their own work item.");
  }
  if (current.approvalStatus !== "pending") {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Work item is not awaiting approval." });
  }
  if (input.decision === "approved") ensureCompletionPrerequisites(db, actor, current, "approval");
  return db.transaction(() => {
    const now = new Date().toISOString();
    const nextStatus: WorkflowStatus = input.decision === "approved" ? "completed" : "blocked";
    const result = db.prepare(`UPDATE m21_ccmg_work_items
      SET approval_status = ?, approved_by = ?, approved_at = ?, approval_rationale = ?, status = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(
        input.decision,
        actor.id,
        now,
        input.rationale,
        nextStatus,
        now,
        current.id,
        input.expectedVersion,
      );
    if (result.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Workflow version changed during approval." });
    const auditEventId = recordChangeAudit(db, {
      actor,
      item: current,
      eventType: "approval",
      action: input.decision === "approved" ? "work_item_approved" : "work_item_rejected",
      entityType: "ccmg_work_item",
      entityId: current.id,
      reason: input.rationale,
      before: { approvalStatus: current.approvalStatus, status: current.status },
      after: { approvalStatus: input.decision, status: nextStatus, approvedBy: actor.id },
    });
    return { workItem: updatedWorkItem(db, current.id), auditEventId };
  })();
}

function ensureCansHandoffEvidence(
  db: M21Database,
  actor: M21Actor,
  item: CcmgWorkItem,
  toDepartment: CcmgHandoff["toDepartment"],
): void {
  if (!["MHTCM", "MHRS"].includes(toDepartment) || !["cans_schedule", "cans_lineage"].includes(item.sourceType)) return;
  const referral = getReferral(db, item.referralId);
  if (!["ready_for_routing", "active"].includes(referral.status) || !referral.cans.currentAssessmentId) {
    denyWorkflowMutation(db, actor, item, "handoff", "CANS handoff requires a routing-ready referral and finalized current CANS.", "PRECONDITION_FAILED");
  }
  const assessmentRow = db.prepare(`SELECT id FROM m21_ccmg_cans_assessments
    WHERE id = ? AND referral_id = ? AND case_id = ? AND evidence_class = ? AND version = ? AND status = 'final'`)
    .get(
      referral.cans.currentAssessmentId,
      referral.id,
      referral.caseId,
      referral.evidenceClass,
      referral.cans.currentVersion,
    ) as { id: string } | undefined;
  if (!assessmentRow || (item.sourceType === "cans_lineage" && item.sourceId !== assessmentRow.id)) {
    denyWorkflowMutation(db, actor, item, "handoff", "CANS handoff source does not match the exact finalized current assessment.", "PRECONDITION_FAILED");
  }
  const targetType: CansPlanLineage["targetType"] = toDepartment === "MHTCM" ? "mhtcm_plan" : "mhrs_skills_goals";
  const lineage = db.prepare(`SELECT id FROM m21_ccmg_plan_lineage
    WHERE referral_id = ? AND cans_assessment_id = ? AND cans_version = ? AND target_type = ? AND target_approval_status = 'approved'
    LIMIT 1`).get(referral.id, assessmentRow.id, referral.cans.currentVersion, targetType) as { id: string } | undefined;
  if (!lineage) {
    denyWorkflowMutation(db, actor, item, "handoff", "CANS handoff requires the corresponding exact approved target-lineage record.", "PRECONDITION_FAILED");
  }
}

export function handoffM21Workflow(
  actor: M21Actor,
  input: {
    workItemId: string;
    toDivision: CcmgHandoff["toDivision"];
    toDepartment: CcmgHandoff["toDepartment"];
    dueAt: string;
    reason: string;
    expectedVersion: number;
  },
  db: M21Database = sqlite,
): { workItem: CcmgWorkItem; handoff: CcmgHandoff; auditEventId: string } {
  const current = getWorkItem(db, input.workItemId);
  authorizeWorkflowMutation(db, actor, current, "handoff");
  ensureExpectedVersion(current, input.expectedVersion);
  const validDivisionDepartment = input.toDivision === "GRO" ? input.toDepartment === "GRO" : input.toDepartment !== "GRO";
  if (!validDivisionDepartment || !Number.isFinite(Date.parse(input.dueAt))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Handoff division/department or due date is invalid." });
  }
  ensureCansHandoffEvidence(db, actor, current, input.toDepartment);
  return db.transaction(() => {
    const id = `M21-HANDOFF-${randomUUID()}`;
    const now = new Date().toISOString();
    db.prepare(`INSERT INTO m21_ccmg_handoffs
      (id,case_id,referral_id,work_item_id,from_division,from_department,to_division,to_department,status,reason,payload_json,initiated_by,initiated_at,due_at,accepted_by,accepted_at,completed_at,evidence_class,version)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        id,
        current.caseId,
        current.referralId,
        current.id,
        current.assignedDivision,
        current.assignedDepartment,
        input.toDivision,
        input.toDepartment,
        "initiated",
        input.reason,
        JSON.stringify({
          sourceType: current.sourceType,
          sourceId: current.sourceId,
          sourceQueueId: current.queueId,
          sourceAssignedDivision: current.assignedDivision,
          sourceAssignedDepartment: current.assignedDepartment,
          sourceAssignedRole: current.assignedRole,
          sourceAssignedTo: current.assignedTo,
          destinationQueueId: queueForHandoffDestination(input.toDepartment, current.queueId),
        }),
        actor.id,
        now,
        input.dueAt,
        null,
        null,
        null,
        current.evidenceClass,
        1,
      );
    const update = db.prepare(`UPDATE m21_ccmg_work_items
      SET version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(now, current.id, input.expectedVersion);
    if (update.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Workflow version changed during handoff." });
    const auditEventId = recordChangeAudit(db, {
      actor,
      item: current,
      eventType: "plan_handoff",
      action: "plan_handoff_initiated",
      entityType: "ccmg_handoff",
      entityId: id,
      reason: input.reason,
      before: { division: current.assignedDivision, department: current.assignedDepartment, handoffStatus: "none" },
      after: {
        division: current.assignedDivision,
        department: current.assignedDepartment,
        receivingDivision: input.toDivision,
        receivingDepartment: input.toDepartment,
        handoffStatus: "initiated",
      },
    });
    const handoffRow = db.prepare("SELECT * FROM m21_ccmg_handoffs WHERE id = ?").get(id) as M21HandoffRow;
    return { workItem: updatedWorkItem(db, current.id), handoff: handoffFromRow(handoffRow), auditEventId };
  })();
}

export function escalateM21Workflow(
  actor: M21Actor,
  input: {
    workItemId: string;
    level: Exclude<CcmgWorkItem["escalationLevel"], "none">;
    reason: string;
    expectedVersion: number;
  },
  db: M21Database = sqlite,
): { workItem: CcmgWorkItem; auditEventId: string } {
  if (!input.reason.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Escalation reason is required." });
  const current = getWorkItem(db, input.workItemId);
  authorizeWorkflowMutation(db, actor, current, "escalation");
  ensureExpectedVersion(current, input.expectedVersion);
  const rank: Readonly<Record<CcmgWorkItem["escalationLevel"], number>> = {
    none: 0,
    supervisor: 1,
    director: 2,
    executive: 3,
  };
  if (rank[input.level] <= rank[current.escalationLevel]) {
    denyWorkflowMutation(db, actor, current, "escalation", "Escalation level must advance beyond the current level.", "PRECONDITION_FAILED");
  }
  return db.transaction(() => {
    const now = new Date().toISOString();
    const result = db.prepare(`UPDATE m21_ccmg_work_items
      SET escalation_level = ?, escalated_at = ?, escalation_reason = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(input.level, now, input.reason, now, current.id, input.expectedVersion);
    if (result.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Workflow version changed during escalation." });
    const auditEventId = recordChangeAudit(db, {
      actor,
      item: current,
      eventType: "material_change",
      action: "work_item_escalated",
      entityType: "ccmg_work_item",
      entityId: current.id,
      reason: input.reason,
      before: { escalationLevel: current.escalationLevel, escalatedAt: current.escalatedAt, escalationReason: current.escalationReason },
      after: { escalationLevel: input.level, escalatedAt: now, escalationReason: input.reason },
    });
    return { workItem: updatedWorkItem(db, current.id), auditEventId };
  })();
}

export function setM21ExceptionDisposition(
  actor: M21Actor,
  input: {
    workItemId: string;
    disposition: "open" | "resolved" | "waived";
    exceptionCode?: string;
    reason: string;
    expectedVersion: number;
  },
  db: M21Database = sqlite,
): { workItem: CcmgWorkItem; auditEventId: string } {
  if (!input.reason.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Exception disposition reason is required." });
  const current = getWorkItem(db, input.workItemId);
  authorizeWorkflowMutation(db, actor, current, "exception");
  ensureExpectedVersion(current, input.expectedVersion);
  if (input.disposition === "open" && !input.exceptionCode) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Opening an exception requires an exception code." });
  }
  if (input.disposition === "open" && current.exceptionStatus === "open") {
    denyWorkflowMutation(db, actor, current, "exception", "Work item already has an open exception.", "PRECONDITION_FAILED");
  }
  if (input.disposition !== "open" && current.exceptionStatus !== "open") {
    denyWorkflowMutation(db, actor, current, "exception", "Only an open exception may be resolved or waived.", "PRECONDITION_FAILED");
  }
  if (["completed", "cancelled"].includes(current.status) && input.disposition === "open") {
    denyWorkflowMutation(db, actor, current, "exception", "A terminal work item cannot receive a new exception.", "PRECONDITION_FAILED");
  }
  const nextCode = input.disposition === "open" ? input.exceptionCode! : current.exceptionCode;
  return db.transaction(() => {
    const now = new Date().toISOString();
    const nextStatus = input.disposition === "open" ? "blocked" : current.status;
    const result = db.prepare(`UPDATE m21_ccmg_work_items
      SET exception_code = ?, exception_reason = ?, exception_status = ?, status = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(
        nextCode,
        input.reason,
        input.disposition,
        nextStatus,
        now,
        current.id,
        input.expectedVersion,
      );
    if (result.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Workflow version changed during exception disposition." });
    const auditEventId = recordChangeAudit(db, {
      actor,
      item: current,
      eventType: "material_change",
      action: `work_item_exception_${input.disposition}`,
      entityType: "ccmg_work_item",
      entityId: current.id,
      reason: input.reason,
      before: { exceptionCode: current.exceptionCode, exceptionReason: current.exceptionReason, exceptionStatus: current.exceptionStatus, status: current.status },
      after: { exceptionCode: nextCode, exceptionReason: input.reason, exceptionStatus: input.disposition, status: nextStatus },
    });
    return { workItem: updatedWorkItem(db, current.id), auditEventId };
  })();
}

export function decideM21Handoff(
  actor: M21Actor,
  input: {
    handoffId: string;
    decision: "accepted" | "rejected" | "returned";
    reason: string;
    expectedHandoffVersion: number;
    expectedWorkItemVersion: number;
  },
  db: M21Database = sqlite,
): { workItem: CcmgWorkItem; handoff: CcmgHandoff; auditEventId: string } {
  if (!input.reason.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Handoff decision reason is required." });
  const currentHandoff = getHandoff(db, input.handoffId);
  const currentItem = getWorkItem(db, currentHandoff.workItemId);
  ensureExpectedVersion(currentItem, input.expectedWorkItemVersion);
  if (currentHandoff.version !== input.expectedHandoffVersion) {
    throw new TRPCError({ code: "CONFLICT", message: `Handoff version conflict; current version is ${currentHandoff.version}.` });
  }
  if (!ownerRolesForDepartment(currentHandoff.toDepartment).includes(actor.role)) {
    denyWorkflowMutation(db, actor, currentItem, "handoff", "Only a validated receiving-owner role may decide this handoff.");
  }
  const allowedDecision = currentHandoff.status === "initiated"
    || (currentHandoff.status === "accepted" && input.decision === "returned");
  if (!allowedDecision) {
    denyWorkflowMutation(db, actor, currentItem, "handoff", "Handoff is not in a state that permits this receiving-owner decision.", "PRECONDITION_FAILED");
  }
  return db.transaction(() => {
    const now = new Date().toISOString();
    const payload = {
      ...currentHandoff.payload,
      decision: input.decision,
      decisionReason: input.reason,
      decidedBy: actor.id,
      decidedAt: now,
    };
    const acceptedBy = input.decision === "accepted" ? actor.id : null;
    const acceptedAt = input.decision === "accepted" ? now : null;
    const completedAt = input.decision === "accepted" ? null : now;
    const handoffUpdate = db.prepare(`UPDATE m21_ccmg_handoffs
      SET status = ?, payload_json = ?, accepted_by = ?, accepted_at = ?, completed_at = ?, version = version + 1
      WHERE id = ? AND version = ?`).run(
        input.decision,
        JSON.stringify(payload),
        acceptedBy,
        acceptedAt,
        completedAt,
        currentHandoff.id,
        input.expectedHandoffVersion,
      );
    if (handoffUpdate.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Handoff version changed during decision." });

    const returnToOrigin = input.decision === "rejected" || input.decision === "returned";
    const sourceDivision = ["BHC", "GRO"].includes(String(currentHandoff.payload.sourceAssignedDivision))
      ? currentHandoff.payload.sourceAssignedDivision as CcmgWorkItem["assignedDivision"]
      : currentHandoff.fromDivision;
    const sourceDepartment = ["CCMG", "MHTCM", "MHRS", "GRO"].includes(String(currentHandoff.payload.sourceAssignedDepartment))
      ? currentHandoff.payload.sourceAssignedDepartment as CcmgWorkItem["assignedDepartment"]
      : currentHandoff.fromDepartment;
    const sourceRole = typeof currentHandoff.payload.sourceAssignedRole === "string"
      ? currentHandoff.payload.sourceAssignedRole
      : primaryOwnerRoleForDepartment(sourceDepartment);
    const sourceAssignedTo = typeof currentHandoff.payload.sourceAssignedTo === "string"
      ? currentHandoff.payload.sourceAssignedTo
      : null;
    const nextDivision = returnToOrigin ? sourceDivision : currentHandoff.toDivision;
    const nextDepartment = returnToOrigin ? sourceDepartment : currentHandoff.toDepartment;
    const nextRole = returnToOrigin ? sourceRole : primaryOwnerRoleForDepartment(nextDepartment);
    const nextAssignedTo = returnToOrigin ? sourceAssignedTo : actor.id;
    const sourceQueue = CCMG_QUEUE_IDS.includes(currentHandoff.payload.sourceQueueId as CcmgQueueId)
      ? currentHandoff.payload.sourceQueueId as CcmgQueueId
      : currentItem.queueId;
    const destinationQueue = CCMG_QUEUE_IDS.includes(currentHandoff.payload.destinationQueueId as CcmgQueueId)
      ? currentHandoff.payload.destinationQueueId as CcmgQueueId
      : queueForHandoffDestination(currentHandoff.toDepartment, currentItem.queueId);
    const nextQueue = returnToOrigin ? sourceQueue : destinationQueue;
    const nextStatus: WorkflowStatus = returnToOrigin ? "blocked" : "in_progress";
    const nextExceptionCode = returnToOrigin ? `HANDOFF_${input.decision.toUpperCase()}` : currentItem.exceptionCode;
    const nextExceptionReason = returnToOrigin ? input.reason : currentItem.exceptionReason;
    const nextExceptionStatus = returnToOrigin ? "open" : currentItem.exceptionStatus;
    const itemUpdate = db.prepare(`UPDATE m21_ccmg_work_items
      SET queue_id = ?, assigned_division = ?, assigned_department = ?, assigned_role = ?, assigned_to = ?, status = ?,
          exception_code = ?, exception_reason = ?, exception_status = ?, version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(
        nextQueue,
        nextDivision,
        nextDepartment,
        nextRole,
        nextAssignedTo,
        nextStatus,
        nextExceptionCode,
        nextExceptionReason,
        nextExceptionStatus,
        now,
        currentItem.id,
        input.expectedWorkItemVersion,
      );
    if (itemUpdate.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Workflow version changed during handoff decision." });

    const auditEventId = recordChangeAudit(db, {
      actor,
      item: currentItem,
      eventType: "plan_handoff",
      action: `plan_handoff_${input.decision}`,
      entityType: "ccmg_handoff",
      entityId: currentHandoff.id,
      reason: input.reason,
      before: {
        status: currentHandoff.status,
        version: currentHandoff.version,
        assignedDivision: currentItem.assignedDivision,
        assignedDepartment: currentItem.assignedDepartment,
        queueId: currentItem.queueId,
        assignedTo: currentItem.assignedTo,
        exceptionStatus: currentItem.exceptionStatus,
      },
      after: {
        status: input.decision,
        version: currentHandoff.version + 1,
        assignedDivision: nextDivision,
        assignedDepartment: nextDepartment,
        queueId: nextQueue,
        assignedTo: nextAssignedTo,
        exceptionCode: nextExceptionCode,
        exceptionStatus: nextExceptionStatus,
      },
    });
    return {
      workItem: updatedWorkItem(db, currentItem.id),
      handoff: getHandoff(db, currentHandoff.id),
      auditEventId,
    };
  })();
}

const REFERRAL_GATE_ROLES: Readonly<Record<RecordReferralGateInput["gate"], readonly string[]>> = {
  intake: ["intake-coordinator", "ccmg-program-director", "bhc-director"],
  eligibility: ["qmhp-cs", "treatment-director", "clinical-director", "ccmg-program-director", "bhc-director"],
  payer_authorization: ["revenue-cycle-manager"],
  consent: ["intake-coordinator", "ccmg-program-director", "bhc-director"],
  cans_schedule: ["qmhp-cs", "treatment-director", "clinical-director", "ccmg-program-director", "bhc-director"],
  capacity: ["gro-administrator", "program-director"],
};

function gateState(referral: CcmgReferralIntake, gate: RecordReferralGateInput["gate"]): unknown {
  if (gate === "intake") return referral.intake;
  if (gate === "eligibility") return referral.eligibility;
  if (gate === "payer_authorization") return referral.payerAuthorization;
  if (gate === "consent") return referral.consent;
  if (gate === "cans_schedule") return referral.cans;
  return referral.capacity;
}

function validTimestamp(value: string | undefined): boolean {
  return value === undefined || Number.isFinite(Date.parse(value));
}

function validateGateInput(input: RecordReferralGateInput): void {
  if (!input.reason.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Gate decision reason is required." });
  const contract = validateReferralGateDecision(input);
  if (!contract.valid) {
    throw new TRPCError({ code: "BAD_REQUEST", message: contract.issues.map((item) => item.message).join(" ") });
  }
  if (input.gate === "eligibility") {
    if (!input.decision.rationale.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Eligibility rationale is required." });
    if (input.decision.status === "eligible" && (!input.decision.criteria || !Object.values(input.decision.criteria).every(Boolean))) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Eligible disposition requires all controlled criteria." });
    }
  } else if (input.gate === "payer_authorization") {
    if (!input.decision.payerLabel.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "Payer label is required." });
    if (input.decision.authorizationRequired && input.decision.authorizationStatus === "not_required") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Required authorization cannot be marked not required." });
    }
    if (!input.decision.authorizationRequired && input.decision.authorizationStatus !== "not_required") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Non-required authorization must use not_required status." });
    }
    if (input.decision.authorizationStatus === "approved" && !input.decision.authorizationReference?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Approved authorization requires a reference." });
    }
    if (!validTimestamp(input.decision.effectiveAt) || !validTimestamp(input.decision.expiresAt)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Authorization timestamps are invalid." });
    }
  } else if (input.gate === "consent") {
    if (input.decision.status === "active" && (!input.decision.consentReference?.trim() || !input.decision.effectiveAt)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Active consent requires a reference and effective timestamp." });
    }
    if (!validTimestamp(input.decision.effectiveAt) || !validTimestamp(input.decision.expiresAt)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Consent timestamps are invalid." });
    }
  } else if (input.gate === "cans_schedule") {
    if (!validTimestamp(input.decision.dueAt) || !validTimestamp(input.decision.scheduledFor)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "CANS schedule timestamps are invalid." });
    }
    if (input.decision.status === "scheduled" && !input.decision.scheduledFor) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Scheduled CANS requires scheduledFor." });
    }
  } else if (input.gate === "capacity") {
    if (!Number.isInteger(input.decision.availableSlots ?? 0) || (input.decision.availableSlots ?? 0) < 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Available slots must be a non-negative integer." });
    }
    if (input.decision.status === "reserved" && !input.decision.reservedSlotReference?.trim()) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Reserved capacity requires a reservation reference." });
    }
    if (!validTimestamp(input.decision.checkedAt)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Capacity checkedAt is invalid." });
    }
  }
}

export function recordM21ReferralGate(
  actor: M21Actor,
  input: RecordReferralGateInput,
  db: M21Database = sqlite,
): { referral: CcmgReferralIntake; readiness: ReturnType<typeof evaluateIntakeReadiness>; auditEventId: string } {
  validateGateInput(input);
  const current = getReferral(db, input.referralId);
  ensureReferralExpectedVersion(current, input.expectedVersion);
  if (!REFERRAL_GATE_ROLES[input.gate].includes(actor.role)) {
    denyReferralMutation(db, actor, current, "referral_gate", `Role is not authorized to record the ${input.gate} gate.`);
  }
  if (current.status === "rejected" || current.status === "closed") {
    denyReferralMutation(db, actor, current, "referral_gate", "Terminal referral cannot accept another gate decision.", "PRECONDITION_FAILED");
  }

  return db.transaction(() => {
    const now = new Date().toISOString();
    let result: Database.RunResult;
    if (input.gate === "intake") {
      result = db.prepare(`UPDATE m21_ccmg_referrals
        SET intake_status = 'complete', intake_completed_at = ?, intake_completed_by = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`).run(now, actor.id, now, current.id, input.expectedVersion);
    } else if (input.gate === "eligibility") {
      const criteria = input.decision.criteria ?? {
        ageQualified: false,
        diagnosisQualified: false,
        functionalImpairment: false,
        coverageQualified: false,
      };
      result = db.prepare(`UPDATE m21_ccmg_referrals
        SET eligibility_status = ?, age_qualified = ?, diagnosis_qualified = ?, functional_impairment = ?, coverage_qualified = ?,
            eligibility_rationale = ?, eligibility_determined_at = ?, eligibility_determined_by = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`).run(
          input.decision.status,
          Number(criteria.ageQualified),
          Number(criteria.diagnosisQualified),
          Number(criteria.functionalImpairment),
          Number(criteria.coverageQualified),
          input.decision.rationale,
          now,
          actor.id,
          now,
          current.id,
          input.expectedVersion,
        );
    } else if (input.gate === "payer_authorization") {
      result = db.prepare(`UPDATE m21_ccmg_referrals
        SET payer_label = ?, payer_verification_status = ?, payer_verified_at = ?, authorization_required = ?, authorization_status = ?,
            authorization_reference = ?, authorization_effective_at = ?, authorization_expires_at = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`).run(
          input.decision.payerLabel,
          input.decision.verificationStatus,
          input.decision.verificationStatus === "verified" ? now : null,
          Number(input.decision.authorizationRequired),
          input.decision.authorizationStatus,
          input.decision.authorizationReference ?? null,
          input.decision.effectiveAt ?? null,
          input.decision.expiresAt ?? null,
          now,
          current.id,
          input.expectedVersion,
        );
    } else if (input.gate === "consent") {
      result = db.prepare(`UPDATE m21_ccmg_referrals
        SET consent_status = ?, consent_reference = ?, consent_effective_at = ?, consent_expires_at = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`).run(
          input.decision.status,
          input.decision.consentReference ?? null,
          input.decision.effectiveAt ?? null,
          input.decision.expiresAt ?? null,
          now,
          current.id,
          input.expectedVersion,
        );
    } else if (input.gate === "cans_schedule") {
      result = db.prepare(`UPDATE m21_ccmg_referrals
        SET cans_status = ?, cans_due_at = ?, cans_scheduled_for = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`).run(
          input.decision.status,
          input.decision.dueAt,
          input.decision.scheduledFor ?? null,
          now,
          current.id,
          input.expectedVersion,
        );
    } else {
      result = db.prepare(`UPDATE m21_ccmg_referrals
        SET capacity_required = ?, capacity_facility_label = ?, capacity_status = ?, available_slots = ?, reserved_slot_reference = ?,
            capacity_checked_at = ?, version = version + 1, updated_at = ?
        WHERE id = ? AND version = ?`).run(
          Number(input.decision.required),
          input.decision.facilityLabel ?? null,
          input.decision.status,
          input.decision.availableSlots ?? null,
          input.decision.reservedSlotReference ?? null,
          input.decision.checkedAt ?? now,
          now,
          current.id,
          input.expectedVersion,
        );
    }
    if (result.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Referral version changed during gate decision." });

    const candidate = getReferral(db, current.id);
    const computedStatus = recomputeReferralStatus(candidate, now);
    const nextStatus: CcmgReferralIntake["status"] = current.status === "active" && computedStatus === "ready_for_routing"
      ? "active"
      : computedStatus;
    const holdReason = nextStatus === "held" ? input.reason : null;
    const rejectionReason = nextStatus === "rejected" ? input.reason : null;
    db.prepare(`UPDATE m21_ccmg_referrals SET status = ?, hold_reason = ?, rejection_reason = ? WHERE id = ?`)
      .run(nextStatus, holdReason, rejectionReason, current.id);
    const referral = getReferral(db, current.id);
    const readiness = evaluateIntakeReadiness(referral, now);
    const auditEventId = recordEntityAudit(db, {
      actor,
      referral,
      eventType: "material_change",
      action: `referral_gate_${input.gate}_recorded`,
      entityType: "ccmg_referral",
      entityId: referral.id,
      reason: input.reason,
      before: { gate: input.gate, gateState: gateState(current, input.gate), status: current.status, version: current.version },
      after: { gate: input.gate, gateState: gateState(referral, input.gate), status: referral.status, version: referral.version },
    });
    return { referral, readiness, auditEventId };
  })();
}

function getCansAssessment(db: M21Database, assessmentId: string): CansAssessmentVersion {
  const row = db.prepare("SELECT * FROM m21_ccmg_cans_assessments WHERE id = ?").get(assessmentId) as M21CansRow | undefined;
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "CANS assessment not found." });
  return cansFromRow(row);
}

function cansHistoryForReferral(db: M21Database, referralId: string): CansAssessmentVersion[] {
  return (db.prepare("SELECT * FROM m21_ccmg_cans_assessments WHERE referral_id = ? ORDER BY version").all(referralId) as M21CansRow[])
    .map(cansFromRow);
}

const CANS_ASSESSOR_ROLES = new Set([
  "qmhp-cs",
  "treatment-director",
  "clinical-director",
  "ccmg-program-director",
  "bhc-director",
]);

export function isM21CansSyntheticRegressionContext(input: {
  evidenceClass: CcmgEvidenceClass;
  actorId: string;
  instrumentVersion?: string;
}): boolean {
  return (
    input.evidenceClass === "synthetic_demo" &&
    input.actorId.startsWith("SYNTH-") &&
    (input.instrumentVersion === undefined ||
      input.instrumentVersion.startsWith("CANS-SYNTHETIC-"))
  );
}

export function finalizeM21CansVersion(
  actor: M21Actor,
  input: FinalizeCansVersionInput,
  db: M21Database = sqlite,
): { referral: CcmgReferralIntake; assessment: CansAssessmentVersion; auditEventId: string } {
  const current = getReferral(db, input.referralId);
  ensureReferralExpectedVersion(current, input.expectedReferralVersion);
  if (!isM21CansSyntheticRegressionContext({
    evidenceClass: current.evidenceClass,
    actorId: actor.id,
    instrumentVersion: input.instrumentVersion,
  })) {
    denyReferralMutation(
      db,
      actor,
      current,
      "cans_finalize",
      "M41C_LEGACY_CANS_LOGIC_QUARANTINED: this retained workflow is available only as a clearly labeled synthetic regression demonstration and cannot finalize production CANS scoring or acuity.",
    );
  }
  if (!CANS_ASSESSOR_ROLES.has(actor.role)) {
    denyReferralMutation(db, actor, current, "cans_finalize", "Role is not authorized to finalize CANS versions.");
  }
  if (!input.instrumentVersion.trim() || !input.reason.trim() || !Number.isFinite(Date.parse(input.completedAt))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CANS instrument, completion timestamp, and reason are required." });
  }
  if (!Number.isInteger(input.totalScore) || input.totalScore < 0) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CANS total score must be a non-negative integer." });
  }
  const scoreValues = Object.values(input.domainScores);
  if (scoreValues.length !== 6 || scoreValues.some((score) => !Number.isInteger(score) || score < 0 || score > 3)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "All six CANS domain scores must be integers from 0 through 3." });
  }
  if (input.actionableItems.some((item) => (
    !item.itemCode.trim()
    || !item.label.trim()
    || !Number.isInteger(item.rating)
    || item.rating < 0
    || item.rating > 3
  ))) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "CANS actionable items are invalid." });
  }
  if (!input.actionableItems.length) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "At least one CANS actionable item is required." });
  }
  if (!input.referralId || !["ready_for_routing", "active"].includes(current.status)) {
    denyReferralMutation(db, actor, current, "cans_finalize", "Referral must be routing-ready or active before CANS finalization.", "PRECONDITION_FAILED");
  }

  const history = cansHistoryForReferral(db, current.id);
  const previous = history.length > 0 ? history[history.length - 1] : null;
  if (validateCansVersionHistory(history).length > 0) {
    denyReferralMutation(db, actor, current, "cans_finalize", "Existing CANS history failed continuity validation.", "PRECONDITION_FAILED");
  }
  if ((previous === null && (current.cans.currentAssessmentId !== null || current.cans.currentVersion !== null))
    || (previous !== null && (
      current.cans.currentAssessmentId !== previous.id
      || current.cans.currentVersion !== previous.version
      || previous.caseId !== current.caseId
      || previous.referralId !== current.id
      || previous.evidenceClass !== current.evidenceClass
    ))) {
    denyReferralMutation(db, actor, current, "cans_finalize", "Referral current-CANS pointer does not match immutable history.", "PRECONDITION_FAILED");
  }

  const assessmentId = `M21-CANS-${randomUUID()}`;
  const nextVersion = (previous?.version ?? 0) + 1;
  const assessment: CansAssessmentVersion = {
    id: assessmentId,
    caseId: current.caseId,
    referralId: current.id,
    evidenceClass: current.evidenceClass,
    version: nextVersion,
    instrumentVersion: input.instrumentVersion,
    status: "final",
    previousAssessmentId: previous?.id ?? null,
    completedAt: input.completedAt,
    completedBy: actor.id,
    totalScore: input.totalScore,
    acuity: input.acuity,
    domainScores: input.domainScores,
    actionableItems: input.actionableItems,
    createdAt: input.completedAt,
  };
  if (validateCansVersionHistory([...history, assessment]).length > 0) {
    denyReferralMutation(db, actor, current, "cans_finalize", "New CANS version failed strict continuity validation.", "PRECONDITION_FAILED");
  }

  return db.transaction(() => {
    db.prepare(`INSERT INTO m21_ccmg_cans_assessments
      (id,case_id,referral_id,evidence_class,version,instrument_version,status,previous_assessment_id,completed_at,completed_by,total_score,acuity,domain_scores_json,actionable_items_json,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        assessment.id,
        assessment.caseId,
        assessment.referralId,
        assessment.evidenceClass,
        assessment.version,
        assessment.instrumentVersion,
        assessment.status,
        assessment.previousAssessmentId,
        assessment.completedAt,
        assessment.completedBy,
        assessment.totalScore,
        assessment.acuity,
        JSON.stringify(assessment.domainScores),
        JSON.stringify(assessment.actionableItems),
        assessment.createdAt,
      );
    const now = new Date().toISOString();
    const update = db.prepare(`UPDATE m21_ccmg_referrals
      SET current_cans_assessment_id = ?, current_cans_version = ?, cans_status = 'completed', cans_acuity = ?,
          status = 'ready_for_routing', version = version + 1, updated_at = ?
      WHERE id = ? AND version = ?`).run(
        assessment.id,
        assessment.version,
        assessment.acuity,
        now,
        current.id,
        input.expectedReferralVersion,
      );
    if (update.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Referral version changed during CANS finalization." });
    const referral = getReferral(db, current.id);
    const auditEventId = recordEntityAudit(db, {
      actor,
      referral,
      eventType: "material_change",
      action: "cans_version_finalized",
      entityType: "ccmg_cans_assessment",
      entityId: assessment.id,
      reason: input.reason,
      before: { currentAssessmentId: current.cans.currentAssessmentId, currentVersion: current.cans.currentVersion, referralVersion: current.version },
      after: { currentAssessmentId: assessment.id, currentVersion: assessment.version, referralVersion: referral.version },
    });
    return { referral, assessment: getCansAssessment(db, assessment.id), auditEventId };
  })();
}

function targetApproverRoles(targetType: CansPlanLineage["targetType"]): readonly string[] {
  return targetType === "mhtcm_plan"
    ? ["treatment-director", "mhtcm-supervisor"]
    : ["mhrs-supervisor"];
}

export function approveM21CansTargetRoute(
  actor: M21Actor,
  input: ApproveCansTargetRouteInput,
  db: M21Database = sqlite,
): {
  referral: CcmgReferralIntake;
  lineage: CansPlanLineage;
  workItem: CcmgWorkItem;
  handoff: CcmgHandoff;
  approvalAuditEventId: string;
  handoffAuditEventId: string;
} {
  const current = getReferral(db, input.referralId);
  ensureReferralExpectedVersion(current, input.expectedReferralVersion);
  if (!isM21CansSyntheticRegressionContext({
    evidenceClass: current.evidenceClass,
    actorId: actor.id,
  })) {
    denyReferralMutation(
      db,
      actor,
      current,
      "cans_target_route",
      "M41C_LEGACY_CANS_LOGIC_QUARANTINED: retained CANS target routing is synthetic regression behavior only and cannot drive production care.",
    );
  }
  const targetContract = validatePlanTargetRoute({
    targetType: input.targetType,
    targetRecordId: input.targetRecordId,
    targetVersion: input.targetVersion,
    actorRole: actor.role,
  });
  if (!targetContract.valid || !targetApproverRoles(input.targetType).includes(actor.role)) {
    denyReferralMutation(db, actor, current, "cans_target_route", "Role is not authorized to approve this CANS target route.");
  }
  if (!input.targetRecordId.trim() || !input.reason.trim() || !Number.isInteger(input.targetVersion) || input.targetVersion < 1) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Target record, positive version, and reason are required." });
  }
  if (!["ready_for_routing", "active"].includes(current.status)) {
    denyReferralMutation(db, actor, current, "cans_target_route", "Referral is not eligible for CANS target routing.", "PRECONDITION_FAILED");
  }
  if (current.cans.currentAssessmentId !== input.cansAssessmentId || current.cans.currentVersion === null) {
    denyReferralMutation(db, actor, current, "cans_target_route", "Target route must use the referral's exact current CANS assessment.", "PRECONDITION_FAILED");
  }
  const assessment = getCansAssessment(db, input.cansAssessmentId);
  if (assessment.status !== "final"
    || !isM21CansSyntheticRegressionContext({
      evidenceClass: assessment.evidenceClass,
      actorId: actor.id,
      instrumentVersion: assessment.instrumentVersion,
    })
    || assessment.caseId !== current.caseId
    || assessment.referralId !== current.id
    || assessment.evidenceClass !== current.evidenceClass
    || assessment.version !== current.cans.currentVersion) {
    denyReferralMutation(db, actor, current, "cans_target_route", "Current CANS assessment failed exact finalized-scope validation.", "PRECONDITION_FAILED");
  }
  if (assessment.completedBy === actor.id) {
    denyReferralMutation(db, actor, current, "cans_target_route", "CANS assessor cannot independently approve the target route.");
  }
  const duplicate = db.prepare(`SELECT id FROM m21_ccmg_plan_lineage
    WHERE cans_assessment_id = ? AND target_type = ? LIMIT 1`).get(assessment.id, input.targetType) as { id: string } | undefined;
  if (duplicate) {
    denyReferralMutation(db, actor, current, "cans_target_route", "Current CANS already has this approved target route.", "PRECONDITION_FAILED");
  }

  const approvedAt = new Date().toISOString();
  const approvedTarget = {
    id: input.targetRecordId,
    version: input.targetVersion,
    targetType: input.targetType,
    status: "approved" as const,
    approvedBy: actor.id,
    approvedAt,
  };
  const placeholderMhtcm = {
    ...approvedTarget,
    id: input.targetType === "mhtcm_plan" ? input.targetRecordId : `M21-MAPPING-MHTCM-${assessment.id}`,
    targetType: "mhtcm_plan" as const,
  };
  const placeholderMhrs = {
    ...approvedTarget,
    id: input.targetType === "mhrs_skills_goals" ? input.targetRecordId : `M21-MAPPING-MHRS-${assessment.id}`,
    targetType: "mhrs_skills_goals" as const,
  };
  const previous = assessment.previousAssessmentId ? getCansAssessment(db, assessment.previousAssessmentId) : null;
  const routing = routeCansToApprovedPlans({
    referralStatus: current.status,
    assessment,
    previousAssessment: previous,
    mhtcmPlan: placeholderMhtcm,
    mhrsSkillsGoals: placeholderMhrs,
    routedBy: actor.id,
    routedAt: approvedAt,
  });
  const selectedLineage = routing.lineage.find((lineage) => lineage.targetType === input.targetType);
  if (!routing.valid || !selectedLineage) {
    denyReferralMutation(
      db,
      actor,
      current,
      "cans_target_route",
      `CANS target routing validation failed: ${routing.reasonCodes.join(", ")}.`,
      "PRECONDITION_FAILED",
    );
  }

  return db.transaction(() => {
    const lineageId = `M21-LINEAGE-${randomUUID()}`;
    db.prepare(`INSERT INTO m21_ccmg_plan_lineage
      (id,case_id,referral_id,cans_assessment_id,cans_version,target_type,target_record_id,target_version,target_approval_status,target_approved_by,target_approved_at,routed_by,routed_at,mapped_goals_json,evidence_class,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        lineageId,
        current.caseId,
        current.id,
        assessment.id,
        assessment.version,
        selectedLineage.targetType,
        selectedLineage.targetRecordId,
        selectedLineage.targetVersion,
        "approved",
        actor.id,
        approvedAt,
        actor.id,
        approvedAt,
        JSON.stringify(selectedLineage.mappedGoals),
        current.evidenceClass,
        approvedAt,
      );

    const targetIsMhtcm = input.targetType === "mhtcm_plan";
    const queueId: CcmgQueueId = targetIsMhtcm ? "mhtcm" : "mhrs";
    const department: CcmgWorkItem["assignedDepartment"] = targetIsMhtcm ? "MHTCM" : "MHRS";
    const assignedRole = targetIsMhtcm ? "mhtcm-supervisor" : "mhrs-supervisor";
    const workItemId = `M21-WORK-${randomUUID()}`;
    const dueAt = new Date(Date.parse(approvedAt) + (72 * 60 * 60 * 1_000)).toISOString();
    const priority: CcmgWorkItem["priority"] = current.urgency === "emergency"
      ? "critical"
      : current.urgency === "urgent"
        ? "urgent"
        : "routine";
    db.prepare(`INSERT INTO m21_ccmg_work_items
      (id,case_id,referral_id,youth_display_label,queue_id,title,status,priority,assigned_division,assigned_department,assigned_role,assigned_to,due_at,escalation_level,escalated_at,escalation_reason,approval_status,approved_by,approved_at,approval_rationale,exception_code,exception_reason,exception_status,source_type,source_id,evidence_class,version,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        workItemId,
        current.caseId,
        current.id,
        current.youthDisplayLabel,
        queueId,
        targetIsMhtcm ? "Implement approved MHTCM CANS route" : "Implement approved MHRS skills goals",
        "in_progress",
        priority,
        "BHC",
        department,
        assignedRole,
        actor.id,
        dueAt,
        "none",
        null,
        null,
        "approved",
        actor.id,
        approvedAt,
        input.reason,
        null,
        null,
        "none",
        "cans_lineage",
        assessment.id,
        current.evidenceClass,
        1,
        approvedAt,
        approvedAt,
      );

    const handoffId = `M21-HANDOFF-${randomUUID()}`;
    db.prepare(`INSERT INTO m21_ccmg_handoffs
      (id,case_id,referral_id,work_item_id,from_division,from_department,to_division,to_department,status,reason,payload_json,initiated_by,initiated_at,due_at,accepted_by,accepted_at,completed_at,evidence_class,version)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        handoffId,
        current.caseId,
        current.id,
        workItemId,
        "BHC",
        "CCMG",
        "BHC",
        department,
        "accepted",
        input.reason,
        JSON.stringify({
          cansAssessmentId: assessment.id,
          cansVersion: assessment.version,
          targetType: input.targetType,
          targetRecordId: input.targetRecordId,
          targetVersion: input.targetVersion,
        }),
        actor.id,
        approvedAt,
        dueAt,
        actor.id,
        approvedAt,
        null,
        current.evidenceClass,
        2,
      );

    const routeCount = (db.prepare(`SELECT COUNT(DISTINCT target_type) AS c FROM m21_ccmg_plan_lineage
      WHERE cans_assessment_id = ?`).get(assessment.id) as CountRow).c;
    const nextStatus: CcmgReferralIntake["status"] = routeCount === 2 ? "active" : "ready_for_routing";
    const referralUpdate = db.prepare(`UPDATE m21_ccmg_referrals
      SET status = ?, version = version + 1, updated_at = ? WHERE id = ? AND version = ?`)
      .run(nextStatus, approvedAt, current.id, input.expectedReferralVersion);
    if (referralUpdate.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Referral version changed during target routing." });
    const referral = getReferral(db, current.id);
    const workItem = getWorkItem(db, workItemId);
    const handoff = getHandoff(db, handoffId);
    const approvalAuditEventId = recordEntityAudit(db, {
      actor,
      referral,
      workItemId,
      eventType: "approval",
      action: "cans_target_approved",
      entityType: "ccmg_plan_lineage",
      entityId: lineageId,
      reason: input.reason,
      before: { approvalStatus: "pending", targetType: input.targetType, referralVersion: current.version },
      after: { approvalStatus: "approved", targetType: input.targetType, referralVersion: referral.version },
    });
    const handoffAuditEventId = recordEntityAudit(db, {
      actor,
      referral,
      workItemId,
      eventType: "plan_handoff",
      action: "cans_target_routed",
      entityType: "ccmg_handoff",
      entityId: handoffId,
      reason: input.reason,
      before: { status: "initiated", department: "CCMG" },
      after: { status: "accepted", department },
    });
    const lineageRow = db.prepare("SELECT * FROM m21_ccmg_plan_lineage WHERE id = ?").get(lineageId) as M21LineageRow;
    return {
      referral,
      lineage: lineageFromRow(lineageRow),
      workItem,
      handoff,
      approvalAuditEventId,
      handoffAuditEventId,
    };
  })();
}

export function createM21MedicationOversightAlert(
  actor: M21Actor,
  input: CreateMedicationOversightAlertInput,
  db: M21Database = sqlite,
): { referral: CcmgReferralIntake; workItem: CcmgWorkItem; auditEventId: string } {
  const current = getReferral(db, input.referralId);
  ensureReferralExpectedVersion(current, input.expectedReferralVersion);
  if (actor.role !== "nurse") {
    denyReferralMutation(db, actor, current, "medication_oversight_alert", "Only an authenticated nurse may create a medication-oversight alert.");
  }
  const alertContract = validateMedicationAlertInput(input, new Date().toISOString());
  if (!alertContract.valid) {
    throw new TRPCError({ code: "BAD_REQUEST", message: alertContract.issues.map((item) => item.message).join(" ") });
  }
  if (current.urgency === "routine" || ["rejected", "closed"].includes(current.status)) {
    denyReferralMutation(db, actor, current, "medication_oversight_alert", "Medication oversight alert requires a nonterminal urgent referral.", "PRECONDITION_FAILED");
  }
  return db.transaction(() => {
    const now = new Date().toISOString();
    const workItemId = `M21-WORK-${randomUUID()}`;
    db.prepare(`INSERT INTO m21_ccmg_work_items
      (id,case_id,referral_id,youth_display_label,queue_id,title,status,priority,assigned_division,assigned_department,assigned_role,assigned_to,due_at,escalation_level,escalated_at,escalation_reason,approval_status,approved_by,approved_at,approval_rationale,exception_code,exception_reason,exception_status,source_type,source_id,evidence_class,version,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        workItemId,
        current.caseId,
        current.id,
        current.youthDisplayLabel,
        "medication_management",
        input.title,
        "awaiting_approval",
        input.priority,
        "BHC",
        "CCMG",
        "nurse",
        actor.id,
        input.dueAt,
        "none",
        null,
        null,
        "pending",
        null,
        null,
        null,
        null,
        null,
        "none",
        "medication_alert",
        current.id,
        current.evidenceClass,
        1,
        now,
        now,
      );
    const update = db.prepare(`UPDATE m21_ccmg_referrals SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?`)
      .run(now, current.id, input.expectedReferralVersion);
    if (update.changes !== 1) throw new TRPCError({ code: "CONFLICT", message: "Referral version changed during medication alert creation." });
    const referral = getReferral(db, current.id);
    const workItem = getWorkItem(db, workItemId);
    const auditEventId = recordEntityAudit(db, {
      actor,
      referral,
      workItemId,
      eventType: "assignment",
      action: "medication_oversight_alert_created",
      entityType: "ccmg_work_item",
      entityId: workItemId,
      reason: input.reason,
      before: { alertStatus: "none", referralVersion: current.version },
      after: { alertStatus: "awaiting_approval", priority: input.priority, referralVersion: referral.version },
    });
    return { referral, workItem, auditEventId };
  })();
}

function ensureRoleHasM21Access(
  db: M21Database,
  actor: M21Actor,
  evidenceClass: CcmgEvidenceClass,
  entityType: string,
  entityId: string,
): readonly CcmgQueueId[] {
  const visibleQueueIds = visibleQueueIdsForRole(actor.role);
  if (visibleQueueIds.length > 0) return visibleQueueIds;
  recordAccess(db, {
    actor,
    entityType,
    entityId,
    evidenceClass,
    action: "ccmg_oversight_access_denied",
    reason: "Authenticated role has no controlled CCMG oversight queue grant.",
  });
  throw new TRPCError({ code: "FORBIDDEN", message: "Role has no CCMG oversight access." });
}

function nonTerminal(status: CcmgWorkItem["status"]): boolean {
  return status !== "completed" && status !== "cancelled";
}

function workItemVisibleToActor(actor: M21Actor, item: CcmgWorkItem, visibleQueueSet: ReadonlySet<CcmgQueueId>): boolean {
  if (!visibleQueueSet.has(item.queueId)) return false;
  if (actor.role === "revenue-cycle-manager") return item.sourceType === "payer_authorization";
  if (GRO_CAPACITY_ROLES.has(actor.role)) return item.sourceType === "capacity";
  if (["intake-coordinator", "chart-auditor", "nurse", "qmhp-cs", "case-manager", "therapist"].includes(actor.role)) {
    return item.assignedTo === actor.id;
  }
  return true;
}

function overdue(item: CcmgWorkItem, asOfTimestamp: number): boolean {
  return nonTerminal(item.status) && Date.parse(item.dueAt) < asOfTimestamp;
}

function queueItem(actor: M21Actor, item: CcmgWorkItem, asOfTimestamp: number): OversightQueueItem {
  const maskForGroCapacity = GRO_CAPACITY_ROLES.has(actor.role);
  return {
    id: item.id,
    caseId: item.caseId,
    referralId: item.referralId,
    youthDisplayLabel: maskForGroCapacity ? "Synthetic Youth ••••" : item.youthDisplayLabel,
    title: item.title,
    status: item.status,
    priority: item.priority,
    assignedDepartment: item.assignedDepartment,
    assignedRole: item.assignedRole,
    assignedTo: maskForGroCapacity ? null : item.assignedTo,
    dueAt: item.dueAt,
    overdue: overdue(item, asOfTimestamp),
    approvalStatus: item.approvalStatus,
    exceptionCode: item.exceptionCode,
    updatedAt: item.updatedAt,
  };
}

export function buildM21OversightDashboard(
  actor: M21Actor,
  evidenceClass: CcmgEvidenceClass = "synthetic_demo",
  asOf = new Date().toISOString(),
  db: M21Database = sqlite,
): OversightDashboardResponse {
  const asOfTimestamp = Date.parse(asOf);
  if (!Number.isFinite(asOfTimestamp)) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid asOf timestamp." });
  const visibleQueueIds = ensureRoleHasM21Access(db, actor, evidenceClass, "ccmg_oversight_dashboard", evidenceClass);
  const visibleQueueSet = new Set(visibleQueueIds);
  const allWorkItems = (db.prepare("SELECT * FROM m21_ccmg_work_items WHERE evidence_class = ? ORDER BY due_at,id").all(evidenceClass) as M21WorkItemRow[])
    .map(workItemFromRow);
  const visibleWorkItems = allWorkItems.filter((item) => workItemVisibleToActor(actor, item, visibleQueueSet));
  const visibleReferralIds = new Set(visibleWorkItems.map((item) => item.referralId));
  const allReferrals = (db.prepare("SELECT * FROM m21_ccmg_referrals WHERE evidence_class = ? ORDER BY referred_at,id").all(evidenceClass) as M21ReferralRow[])
    .map(referralFromRow);
  const referrals = ALL_QUEUE_ACCESS_ROLES.has(actor.role)
    ? allReferrals
    : allReferrals.filter((referral) => visibleReferralIds.has(referral.id));
  const allHandoffs = (db.prepare("SELECT * FROM m21_ccmg_handoffs WHERE evidence_class = ? ORDER BY initiated_at,id").all(evidenceClass) as M21HandoffRow[])
    .map(handoffFromRow);
  const visibleWorkIds = new Set(visibleWorkItems.map((item) => item.id));
  const handoffs = allHandoffs.filter((handoff) => visibleWorkIds.has(handoff.workItemId));
  const access = recordAccess(db, {
    actor,
    entityType: "ccmg_oversight_dashboard",
    entityId: evidenceClass,
    evidenceClass,
    action: "ccmg_oversight_dashboard_viewed",
    reason: "Authenticated role-appropriate CCMG oversight access.",
  });

  const queues = CCMG_QUEUE_IDS.map((queueId) => {
    const visible = visibleQueueSet.has(queueId);
    const items = visible ? visibleWorkItems.filter((item) => item.queueId === queueId) : [];
    return {
      id: queueId,
      label: QUEUE_LABELS[queueId],
      visible,
      total: items.length,
      overdue: items.filter((item) => overdue(item, asOfTimestamp)).length,
      urgent: items.filter((item) => item.priority === "urgent" || item.priority === "critical").length,
      awaitingApproval: items.filter((item) => item.approvalStatus === "pending").length,
      blocked: items.filter((item) => item.status === "blocked").length,
      items: items.map((item) => queueItem(actor, item, asOfTimestamp)),
    };
  });

  return {
    generatedAt: asOf,
    evidenceClass,
    actor: { id: actor.id, role: actor.role, visibleQueueIds },
    metrics: {
      totalReferrals: referrals.length,
      openReferrals: referrals.filter((referral) => !["closed", "rejected"].includes(referral.status)).length,
      urgentReferrals: referrals.filter((referral) => referral.urgency !== "routine").length,
      heldReferrals: referrals.filter((referral) => referral.status === "held").length,
      overdueWorkItems: visibleWorkItems.filter((item) => overdue(item, asOfTimestamp)).length,
      pendingApprovals: visibleWorkItems.filter((item) => item.approvalStatus === "pending").length,
      openExceptions: visibleWorkItems.filter((item) => item.exceptionStatus === "open").length,
      activeHandoffs: handoffs.filter((handoff) => ["initiated", "accepted", "returned"].includes(handoff.status)).length,
      authorizationsPending: referrals.filter((referral) => referral.payerAuthorization.authorizationStatus === "pending").length,
      cansDue: referrals.filter((referral) => referral.cans.status !== "completed"
        && referral.cans.dueAt !== null
        && Date.parse(referral.cans.dueAt) <= asOfTimestamp + (48 * 60 * 60 * 1_000)).length,
      highAcuityCases: referrals.filter((referral) => ["high", "critical"].includes(referral.cans.acuity)).length,
      backlogWorkItems: visibleWorkItems.filter((item) => nonTerminal(item.status)).length,
      qaFindings: visibleWorkItems.filter((item) => item.queueId === "qa" && nonTerminal(item.status)).length,
      serviceCoordinationItems: visibleWorkItems.filter((item) => (
        ["mhtcm", "mhrs"].includes(item.queueId) && nonTerminal(item.status)
      )).length,
    },
    queues,
    audit: { accessEventId: access.id, loggedAt: access.occurredAt },
  };
}

export function buildM21ReferralDetail(
  actor: M21Actor,
  referralId: string,
  evidenceClass: CcmgEvidenceClass = "synthetic_demo",
  asOf = new Date().toISOString(),
  db: M21Database = sqlite,
): ReferralDetailResponse {
  const visibleQueueIds = ensureRoleHasM21Access(db, actor, evidenceClass, "ccmg_referral", referralId);
  if (MINIMUM_NECESSARY_DASHBOARD_ONLY_ROLES.has(actor.role)) {
    recordAccess(db, {
      actor,
      entityType: "ccmg_referral",
      entityId: referralId,
      evidenceClass,
      action: "ccmg_referral_access_denied",
      reason: "Role is limited to its masked minimum-necessary oversight dashboard slice.",
    });
    throw new TRPCError({ code: "FORBIDDEN", message: "Role is limited to a minimum-necessary dashboard slice." });
  }
  const row = db.prepare("SELECT * FROM m21_ccmg_referrals WHERE id = ? AND evidence_class = ?").get(referralId, evidenceClass) as M21ReferralRow | undefined;
  if (!row) {
    recordAccess(db, {
      actor,
      entityType: "ccmg_referral",
      entityId: referralId,
      evidenceClass,
      action: "ccmg_referral_access_denied",
      reason: "Requested CCMG referral does not exist in the selected evidence class.",
    });
    throw new TRPCError({ code: "NOT_FOUND", message: "CCMG referral not found." });
  }
  const referral = referralFromRow(row);
  const allWorkItems = (db.prepare("SELECT * FROM m21_ccmg_work_items WHERE referral_id = ? AND evidence_class = ? ORDER BY due_at,id").all(referralId, evidenceClass) as M21WorkItemRow[])
    .map(workItemFromRow);
  const visibleQueueSet = new Set(visibleQueueIds);
  const assignments = allWorkItems.filter((item) => workItemVisibleToActor(actor, item, visibleQueueSet));
  if (!ALL_QUEUE_ACCESS_ROLES.has(actor.role) && assignments.length === 0) {
    recordAccess(db, {
      actor,
      entityType: "ccmg_referral",
      entityId: referralId,
      evidenceClass,
      action: "ccmg_referral_access_denied",
      reason: "Referral has no work in a queue granted to the authenticated role.",
      caseId: referral.caseId,
      referralId,
    });
    throw new TRPCError({ code: "FORBIDDEN", message: "Referral is outside the role's CCMG queue scope." });
  }

  const access = recordAccess(db, {
    actor,
    entityType: "ccmg_referral",
    entityId: referralId,
    evidenceClass,
    action: "ccmg_referral_detail_viewed",
    reason: "Authenticated role-appropriate CCMG referral access.",
    caseId: referral.caseId,
    referralId,
  });
  const visibleWorkIds = new Set(assignments.map((item) => item.id));
  const handoffs = (db.prepare("SELECT * FROM m21_ccmg_handoffs WHERE referral_id = ? AND evidence_class = ? ORDER BY initiated_at,id").all(referralId, evidenceClass) as M21HandoffRow[])
    .map(handoffFromRow)
    .filter((handoff) => visibleWorkIds.has(handoff.workItemId));
  const canSeeLineage = ALL_QUEUE_ACCESS_ROLES.has(actor.role)
    || visibleQueueIds.some((queueId) => ["cans", "mhtcm", "mhrs"].includes(queueId));
  const versions = canSeeLineage
    ? (db.prepare("SELECT * FROM m21_ccmg_cans_assessments WHERE referral_id = ? AND evidence_class = ? ORDER BY version").all(referralId, evidenceClass) as M21CansRow[]).map(cansFromRow)
    : [];
  const routes = canSeeLineage
    ? (db.prepare("SELECT * FROM m21_ccmg_plan_lineage WHERE referral_id = ? AND evidence_class = ? ORDER BY cans_version,target_type").all(referralId, evidenceClass) as M21LineageRow[]).map(lineageFromRow)
    : [];
  const allAuditEvents = (db.prepare("SELECT * FROM m21_ccmg_audit_events WHERE referral_id = ? AND evidence_class = ? ORDER BY occurred_at,id").all(referralId, evidenceClass) as M21AuditRow[])
    .map(auditFromRow);
  const events = ALL_QUEUE_ACCESS_ROLES.has(actor.role)
    ? allAuditEvents
    : allAuditEvents.filter((event) => event.eventType === "access" || (event.workItemId !== null && visibleWorkIds.has(event.workItemId)));

  return {
    referral: {
      id: referral.id,
      caseId: referral.caseId,
      evidenceClass: referral.evidenceClass,
      youthId: referral.youthId,
      youthDisplayLabel: referral.youthDisplayLabel,
      referralSourceDivision: referral.referralSourceDivision,
      referredAt: referral.referredAt,
      referralReason: referral.referralReason,
      urgency: referral.urgency,
      status: referral.status,
      holdReason: referral.holdReason,
      rejectionReason: referral.rejectionReason,
      createdAt: referral.createdAt,
      updatedAt: referral.updatedAt,
      version: referral.version,
    },
    gates: {
      intake: referral.intake,
      eligibility: referral.eligibility,
      payerAuthorization: referral.payerAuthorization,
      consent: referral.consent,
      cans: referral.cans,
      capacity: referral.capacity,
      readiness: evaluateIntakeReadiness(referral, asOf),
    },
    workflow: {
      assignments,
      approvals: assignments.filter((item) => item.approvalStatus !== "not_required"),
      exceptions: assignments.filter((item) => item.exceptionStatus !== "none"),
      handoffs,
    },
    cansLineage: { versions, routes },
    audit: { accessEventId: access.id, events },
  };
}

export const m21Router = createRouter({
  listAudits: authedQuery
    .input(z.object({ youthId: z.string().optional(), result: z.string().optional() }).optional())
    .query(async ({ input }) => {
      let sql = "SELECT * FROM chart_audits WHERE 1=1";
      const params: unknown[] = [];
      if (input?.youthId) { sql += " AND youth_id = ?"; params.push(input.youthId); }
      if (input?.result) { sql += " AND overall_result = ?"; params.push(input.result); }
      sql += " ORDER BY audit_date DESC";
      return sqlite.prepare(sql).all(...params) ?? [];
    }),

  getAudit: authedQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const row = sqlite.prepare("SELECT * FROM chart_audits WHERE id = ?").get(input.id);
      return row ?? null;
    }),

  createAudit: authedQuery
    .input(z.object({
      youthId: z.string(), youthName: z.string(), mrn: z.string(),
      auditDate: z.string(), auditorName: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const id = randomUUID();
      const now = new Date().toISOString();
      sqlite.prepare(`INSERT INTO chart_audits (id, youth_id, youth_name, mrn, audit_date, auditor_name, created_at, updated_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, input.youthId, input.youthName, input.mrn, input.auditDate, input.auditorName, now, now, actor);
      auditLog({ action: "m18:createAudit", actor, resource: `audit:${id}` });
      return { id, ...input, createdAt: now };
    }),

  updateAudit: authedQuery
    .input(z.object({
      id: z.string(),
      area1: z.boolean().optional(), area1Notes: z.string().optional(),
      area2: z.boolean().optional(), area2Notes: z.string().optional(),
      area3: z.boolean().optional(), area3Notes: z.string().optional(),
      area4: z.boolean().optional(), area4Notes: z.string().optional(),
      area5: z.boolean().optional(), area5Notes: z.string().optional(),
      area6: z.boolean().optional(), area6Notes: z.string().optional(),
      area7: z.boolean().optional(), area7Notes: z.string().optional(),
      area8: z.boolean().optional(), area8Notes: z.string().optional(),
      area9: z.boolean().optional(), area9Notes: z.string().optional(),
      correctiveActions: z.string().optional(),
      followUpDate: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const actor = ctx.user?.email ?? "unknown";
      const { id, ...fields } = input;
      const areaMap: Record<string, { field: string; notes: string }> = {
        area1: { field: "area1_identifying_info", notes: "area1_notes" },
        area2: { field: "area2_consent_forms", notes: "area2_notes" },
        area3: { field: "area3_assessment_current", notes: "area3_notes" },
        area4: { field: "area4_treatment_plan", notes: "area4_notes" },
        area5: { field: "area5_progress_notes", notes: "area5_notes" },
        area6: { field: "area6_medication_records", notes: "area6_notes" },
        area7: { field: "area7_safety_plans", notes: "area7_notes" },
        area8: { field: "area8_incident_reports", notes: "area8_notes" },
        area9: { field: "area9_authorization_billing", notes: "area9_notes" },
      };

      const updates: string[] = [];
      const values: unknown[] = [];

      for (const [key, val] of Object.entries(fields)) {
        if (val === undefined) continue;
        if (key === "correctiveActions") {
          updates.push("corrective_actions = ?");
          values.push(val);
        } else if (key === "followUpDate") {
          updates.push("follow_up_date = ?");
          values.push(val);
        } else if (key.endsWith("Notes")) {
          const areaKey = key.replace("Notes", "");
          const area = areaMap[areaKey];
          if (!area) continue;
          updates.push(`${area.notes} = ?`);
          values.push(val);
        } else {
          const area = areaMap[key];
          if (!area) continue;
          updates.push(`${area.field} = ?`);
          values.push(val ? 1 : 0);
        }
      }

      if (updates.length > 0) {
        const current = sqlite.prepare("SELECT * FROM chart_audits WHERE id = ?").get(id) as ChartAuditRow | undefined;
        if (current) {
          const submittedAreas = [
            fields.area1, fields.area2, fields.area3,
            fields.area4, fields.area5, fields.area6,
            fields.area7, fields.area8, fields.area9,
          ];
          const allAreas = submittedAreas.map((value, index) => {
            const area = areaMap[`area${index + 1}`];
            return value ?? current[area.field];
          });
          const passed = allAreas.filter(Boolean).length;
          updates.push("areas_passed = ?"); values.push(passed);

          let result = "incomplete";
          if (passed === 9) result = "pass";
          else if (passed >= 7) result = "pass_with_notes";
          else if (passed > 0) result = "fail";
          updates.push("overall_result = ?"); values.push(result);
        }
        updates.push("updated_at = ?"); values.push(new Date().toISOString());
        sqlite.prepare(`UPDATE chart_audits SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
      }
      auditLog({ action: "m18:updateAudit", actor, resource: `audit:${id}` });
      return { success: true };
    }),

  // ─── M21: Persona Activation Wave 1 ────────────────────

  listPersonas: publicQuery.query(async () => {
    const rows = sqlite.prepare("SELECT * FROM agent_personas ORDER BY sort_order").all() as PersonaRow[];
    if (rows.length === 0) {
      try {
        assertSyntheticScenarioRuntime(env);
        return PERSONA_SEED;
      } catch {
        return [];
      }
    }
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      code: r.code,
      description: r.description,
      status: r.status,
      wave: r.wave,
      category: r.category,
      permissions: r.permissions ? JSON.parse(r.permissions) : [],
      outputs: r.outputs ? JSON.parse(r.outputs) : [],
      activatedAt: r.activated_at,
      sortOrder: r.sort_order,
    }));
  }),

  getPersona: publicQuery
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const r = sqlite.prepare("SELECT * FROM agent_personas WHERE id = ?").get(input.id) as PersonaRow | undefined;
      if (!r) return null;
      return {
        id: r.id, name: r.name, code: r.code, description: r.description,
        status: r.status, wave: r.wave, category: r.category,
        permissions: r.permissions ? JSON.parse(r.permissions) : [],
        outputs: r.outputs ? JSON.parse(r.outputs) : [],
        activatedAt: r.activated_at, sortOrder: r.sort_order,
      };
    }),

  activatePersona: publicQuery
    .input(z.object({ id: z.string(), active: z.boolean() }))
    .mutation(async ({ input }) => {
      const status = input.active ? "active" : "inactive";
      const activatedAt = input.active ? new Date().toISOString() : null;
      sqlite.prepare("UPDATE agent_personas SET status = ?, activated_at = ? WHERE id = ?")
        .run(status, activatedAt, input.id);
      return { success: true, id: input.id, status };
    }),

  getActivationStatus: publicQuery.query(async () => {
    const rows = sqlite.prepare("SELECT status, COUNT(*) as count FROM agent_personas GROUP BY status").all() as StatusCountRow[];
    const byWave = sqlite.prepare("SELECT wave, status, COUNT(*) as count FROM agent_personas GROUP BY wave, status").all() as WaveStatusCountRow[];
    const total = sqlite.prepare("SELECT COUNT(*) as c FROM agent_personas").get() as CountRow | undefined;
    return {
      total: total?.c ?? 0,
      active: rows.find(r => r.status === "active")?.count ?? 0,
      inactive: rows.find(r => r.status === "inactive")?.count ?? 0,
      byWave: byWave.reduce<Record<string, WaveActivationSummary>>((acc, r) => {
        if (!acc[r.wave]) acc[r.wave] = { active: 0, inactive: 0 };
        acc[r.wave][r.status] = r.count;
        return acc;
      }, {}),
    };
  }),

  // ─── M2.1: CCMG Oversight Operational ──────────────────

  getOversightDashboard: authedQuery
    .input(z.object({
      evidenceClass: z.enum(["synthetic_demo", "production"]).default("synthetic_demo"),
      asOf: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid asOf timestamp").optional(),
    }).optional())
    .query(({ ctx, input }) => {
      const evidenceClass = input?.evidenceClass ?? "synthetic_demo";
      if (evidenceClass === "synthetic_demo") {
        assertSyntheticScenarioRuntime(env);
      }
      return buildM21OversightDashboard(
        { id: ctx.user.id, role: ctx.user.role },
        evidenceClass,
        input?.asOf ?? new Date().toISOString(),
      );
    }),

  getReferralDetail: authedQuery
    .input(z.object({
      referralId: z.string().min(1),
      evidenceClass: z.enum(["synthetic_demo", "production"]).default("synthetic_demo"),
      asOf: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid asOf timestamp").optional(),
    }))
    .query(({ ctx, input }) => {
      if (input.evidenceClass === "synthetic_demo") {
        assertSyntheticScenarioRuntime(env);
      }
      return buildM21ReferralDetail(
        { id: ctx.user.id, role: ctx.user.role },
        input.referralId,
        input.evidenceClass,
        input.asOf ?? new Date().toISOString(),
      );
    }),

  transitionWorkflow: authedQuery
    .input(z.object({
      workItemId: z.string().min(1),
      toStatus: z.enum(["pending", "in_progress", "blocked", "awaiting_approval", "completed", "cancelled"]),
      reason: z.string().min(1),
      expectedVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => transitionM21Workflow({ id: ctx.user.id, role: ctx.user.role }, input)),

  assignWorkflow: authedQuery
    .input(z.object({
      workItemId: z.string().min(1),
      assignedDivision: z.enum(["BHC", "GRO"]),
      assignedDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]),
      assignedRole: z.string().min(1),
      assignedTo: z.string().min(1).optional(),
      dueAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid dueAt timestamp"),
      reason: z.string().min(1),
      expectedVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => assignM21Workflow({ id: ctx.user.id, role: ctx.user.role }, input)),

  approveWorkflow: authedQuery
    .input(z.object({
      workItemId: z.string().min(1),
      decision: z.enum(["approved", "rejected"]),
      rationale: z.string().min(1),
      expectedVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => approveM21Workflow({ id: ctx.user.id, role: ctx.user.role }, input)),

  handoffWorkflow: authedQuery
    .input(z.object({
      workItemId: z.string().min(1),
      toDivision: z.enum(["BHC", "GRO"]),
      toDepartment: z.enum(["CCMG", "MHTCM", "MHRS", "GRO"]),
      dueAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid dueAt timestamp"),
      reason: z.string().min(1),
      expectedVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => handoffM21Workflow({ id: ctx.user.id, role: ctx.user.role }, input)),

  escalateWorkflow: authedQuery
    .input(z.object({
      workItemId: z.string().min(1),
      level: z.enum(["supervisor", "director", "executive"]),
      reason: z.string().min(1),
      expectedVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => escalateM21Workflow({ id: ctx.user.id, role: ctx.user.role }, input)),

  setExceptionDisposition: authedQuery
    .input(z.object({
      workItemId: z.string().min(1),
      disposition: z.enum(["open", "resolved", "waived"]),
      exceptionCode: z.string().min(1).optional(),
      reason: z.string().min(1),
      expectedVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => setM21ExceptionDisposition({ id: ctx.user.id, role: ctx.user.role }, input)),

  decideHandoff: authedQuery
    .input(z.object({
      handoffId: z.string().min(1),
      decision: z.enum(["accepted", "rejected", "returned"]),
      reason: z.string().min(1),
      expectedHandoffVersion: z.number().int().positive(),
      expectedWorkItemVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => decideM21Handoff({ id: ctx.user.id, role: ctx.user.role }, input)),

  recordReferralGate: authedQuery
    .input(z.discriminatedUnion("gate", [
      z.object({
        referralId: z.string().min(1),
        gate: z.literal("intake"),
        decision: z.object({ status: z.literal("complete") }),
        reason: z.string().min(1),
        expectedVersion: z.number().int().positive(),
      }),
      z.object({
        referralId: z.string().min(1),
        gate: z.literal("eligibility"),
        decision: z.object({
          status: z.enum(["eligible", "ineligible", "needs_review"]),
          criteria: z.object({
            ageQualified: z.boolean(),
            diagnosisQualified: z.boolean(),
            functionalImpairment: z.boolean(),
            coverageQualified: z.boolean(),
          }).optional(),
          rationale: z.string().min(1),
        }),
        reason: z.string().min(1),
        expectedVersion: z.number().int().positive(),
      }),
      z.object({
        referralId: z.string().min(1),
        gate: z.literal("payer_authorization"),
        decision: z.object({
          payerLabel: z.string().min(1),
          verificationStatus: z.enum(["verified", "failed"]),
          authorizationRequired: z.boolean(),
          authorizationStatus: z.enum(["not_required", "pending", "approved", "denied", "expired"]),
          authorizationReference: z.string().min(1).optional(),
          effectiveAt: z.string().optional(),
          expiresAt: z.string().optional(),
        }),
        reason: z.string().min(1),
        expectedVersion: z.number().int().positive(),
      }),
      z.object({
        referralId: z.string().min(1),
        gate: z.literal("consent"),
        decision: z.object({
          status: z.enum(["active", "declined", "revoked", "expired"]),
          consentReference: z.string().min(1).optional(),
          effectiveAt: z.string().optional(),
          expiresAt: z.string().optional(),
        }),
        reason: z.string().min(1),
        expectedVersion: z.number().int().positive(),
      }),
      z.object({
        referralId: z.string().min(1),
        gate: z.literal("cans_schedule"),
        decision: z.object({
          status: z.enum(["scheduled", "overdue", "cancelled"]),
          dueAt: z.string(),
          scheduledFor: z.string().optional(),
        }),
        reason: z.string().min(1),
        expectedVersion: z.number().int().positive(),
      }),
      z.object({
        referralId: z.string().min(1),
        gate: z.literal("capacity"),
        decision: z.object({
          required: z.boolean(),
          facilityLabel: z.string().min(1).optional(),
          status: z.enum(["available", "reserved", "waitlisted", "unavailable"]),
          availableSlots: z.number().int().nonnegative().optional(),
          reservedSlotReference: z.string().min(1).optional(),
          checkedAt: z.string().optional(),
        }),
        reason: z.string().min(1),
        expectedVersion: z.number().int().positive(),
      }),
    ]))
    .mutation(({ ctx, input }) => recordM21ReferralGate({ id: ctx.user.id, role: ctx.user.role }, input)),

  finalizeCansVersion: authedQuery
    .input(z.object({
      referralId: z.string().min(1),
      instrumentVersion: z.string().min(1),
      domainScores: z.object({
        behavioral_emotional: z.number().int().min(0).max(3),
        risk_behaviors: z.number().int().min(0).max(3),
        life_functioning: z.number().int().min(0).max(3),
        strengths: z.number().int().min(0).max(3),
        caregiver_resources: z.number().int().min(0).max(3),
        cultural_factors: z.number().int().min(0).max(3),
      }),
      actionableItems: z.array(z.object({
        itemCode: z.string().min(1),
        label: z.string().min(1),
        domain: z.enum(["behavioral_emotional", "risk_behaviors", "life_functioning", "strengths", "caregiver_resources", "cultural_factors"]),
        rating: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
        disposition: z.enum(["need", "strength"]),
      })).min(1),
      totalScore: z.number().int().nonnegative(),
      acuity: z.enum(["low", "moderate", "high", "critical"]),
      completedAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid completedAt timestamp"),
      reason: z.string().min(1),
      expectedReferralVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => finalizeM21CansVersion({ id: ctx.user.id, role: ctx.user.role }, input)),

  approveCansTargetRoute: authedQuery
    .input(z.object({
      referralId: z.string().min(1),
      cansAssessmentId: z.string().min(1),
      targetType: z.enum(["mhtcm_plan", "mhrs_skills_goals"]),
      targetRecordId: z.string().min(1),
      targetVersion: z.number().int().positive(),
      reason: z.string().min(1),
      expectedReferralVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => approveM21CansTargetRoute({ id: ctx.user.id, role: ctx.user.role }, input)),

  createMedicationOversightAlert: authedQuery
    .input(z.object({
      referralId: z.string().min(1),
      title: z.string().min(1),
      priority: z.enum(["urgent", "critical"]),
      dueAt: z.string().refine((value) => Number.isFinite(Date.parse(value)), "Invalid dueAt timestamp"),
      reason: z.string().min(1),
      expectedReferralVersion: z.number().int().positive(),
    }))
    .mutation(({ ctx, input }) => createM21MedicationOversightAlert({ id: ctx.user.id, role: ctx.user.role }, input)),
});

// ─── Persona Seed Data (13 personas) ─────────────────────

const PERSONA_SEED = [
  { id: "amos-prime", name: "AMOS-Prime", code: "AP", description: "Executive orchestration persona. Top-level task routing, cross-system coordination, and strategic synthesis.", status: "inactive", wave: "wave3", category: "Executive", permissions: ["all_read", "routing_write"], outputs: ["memos", "decisions", "alerts"], activatedAt: null, sortOrder: 1 },
  { id: "amos-core", name: "AMOS-Core", code: "AC", description: "Universal operational backbone. Dashboard aggregation, notification routing, cross-module search, and daily operational support.", status: "active", wave: "pilot", category: "Core", permissions: ["all_read", "ops_write"], outputs: ["dashboards", "alerts", "search_results"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 2 },
  { id: "amos-nxl", name: "AMOS-NXL", code: "ANXL", description: "Narrative intelligence engine. Generates operational narratives, trend explanations, and executive briefings from live data.", status: "inactive", wave: "wave3", category: "Intelligence", permissions: ["analytics_read", "narrative_write"], outputs: ["briefings", "narratives", "summaries"], activatedAt: null, sortOrder: 3 },
  { id: "amos-thesis", name: "AMOS-THESIS", code: "AT", description: "Research and evidence synthesis. Academic literature review, regulatory research, evidence-based recommendation engine.", status: "inactive", wave: "wave3", category: "Research", permissions: ["research_read", "synthesis_write"], outputs: ["reports", "literature_reviews", "recommendations"], activatedAt: null, sortOrder: 4 },
  { id: "amos-dms", name: "AMOS-DMS", code: "ADMS", description: "Document management specialist. Document lifecycle, template generation, packet assembly, and compliance publishing.", status: "inactive", wave: "wave3", category: "Documents", permissions: ["documents_read", "dms_write", "templates_write"], outputs: ["documents", "packets", "templates"], activatedAt: null, sortOrder: 5 },
  { id: "amos-sentinel", name: "AMOS-Sentinel", code: "ASENT", description: "QA and compliance guardian. Audit readiness, CAP tracking, deficiency monitoring, regulatory compliance verification.", status: "active", wave: "pilot", category: "Compliance", permissions: ["qa_read", "audit_write", "compliance_write"], outputs: ["audits", "cap_plans", "compliance_reports"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 6 },
  { id: "amos-scribe", name: "AMOS-Scribe", code: "ASCR", description: "Document production engine. Branded DOCX/PDF/Excel generation, template library, controlled publishing workflow.", status: "active", wave: "pilot", category: "Documents", permissions: ["documents_read", "studio_write", "templates_write"], outputs: ["documents", "presentations", "spreadsheets"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 7 },
  { id: "amos-clinical", name: "AMOS-Clinical", code: "ACL", description: "Clinical operations specialist. BHC care delivery, CANS/ANSA assessment support, treatment planning, clinical documentation guidance.", status: "active", wave: "pilot", category: "Clinical", permissions: ["clinical_read", "clinical_write", "phi_access"], outputs: ["assessments", "treatment_plans", "clinical_notes"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 8 },
  { id: "amos-gro", name: "AMOS-GRO", code: "AGRO", description: "Residential operations specialist. GRO shift management, youth care logs, behavioral observations, safety rounds, census tracking.", status: "active", wave: "pilot", category: "Residential", permissions: ["gro_read", "gro_write", "residential_write"], outputs: ["shift_logs", "observations", "care_plans"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 9 },
  { id: "amos-revenue", name: "AMOS-Revenue", code: "AREV", description: "Revenue cycle specialist. Authorizations, claims management, billing readiness, payer packet assembly, denials tracking.", status: "active", wave: "pilot", category: "Revenue", permissions: ["revenue_read", "billing_write", "claims_write"], outputs: ["claims", "authorizations", "payer_packets"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 10 },
  { id: "amos-hr", name: "AMOS-HR", code: "AHR", description: "Human resources specialist. Onboarding workflow, credential tracking, training assignments, performance documentation, compliance auditing.", status: "inactive", wave: "wave1", category: "HR", permissions: ["hr_read", "hr_write", "credentials_write"], outputs: ["onboarding_plans", "credentials_reports", "performance_reviews"], activatedAt: null, sortOrder: 11 },
  { id: "amos-coach", name: "AMOS-Coach", code: "ACOACH", description: "Training and coaching facilitator. Staff development, competency tracking, scenario-based learning, performance coaching.", status: "inactive", wave: "wave2", category: "Training", permissions: ["training_read", "coaching_write"], outputs: ["training_plans", "competency_assessments", "coaching_sessions"], activatedAt: null, sortOrder: 12 },
  { id: "amos-strategy", name: "AMOS-Strategy", code: "ASTRAT", description: "Strategic planning analyst. Growth initiatives, market analysis, board reporting, risk register, strategic decision support.", status: "inactive", wave: "wave2", category: "Strategy", permissions: ["executive_read", "strategy_write"], outputs: ["strategic_plans", "risk_registers", "board_memos"], activatedAt: null, sortOrder: 13 },
];
