import {
  evaluateGroBedroom,
  evaluateGroPersonalRestraint,
  evaluateGroPostIntervention,
  evaluateGroPractice,
  evaluateGroSupervisionRatio,
  evaluateGroYouthRights,
  type GroPersonalRestraintInput,
  type GroRightsRecipientEvidence,
} from "../../../contracts/regulatory/gro";
import {
  addUtcHours,
  assertSyntheticBoundary,
  evaluateDeadline,
  type Phase2AuditEvent,
} from "../../../contracts/phase2";
import {
  M24_EVIDENCE_CLASS,
  changedM24Fields,
  m24CorrelationId,
  m24RoleCan,
  type M24Actor,
  type M24AuditEvent,
  type M24Capability,
  type M24Dashboard,
  type M24EngagementType,
  type M24IncidentLevel,
  type M24MedicationStatus,
  type M24Placement,
  type M24ScenarioResult,
  type M24ShiftType,
  type M24StaffAssignment,
  type M24State,
} from "../../../contracts/gro/m24-model";
import { createM24SyntheticState } from "../../../contracts/gro/m24-synthetic";

const HOUR_MS = 60 * 60 * 1_000;

export class M24DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "M24DomainError";
  }
}

export interface M24EngineOptions {
  now?: () => string;
  initialState?: M24State;
}

export interface M24AdmissionInput {
  caseId: string;
  youthId: string;
  youthLabel: string;
  ageYears: number;
  requiresTreatmentServices: boolean;
  requiresConstantSupervision?: boolean;
  parentConsentRequired?: boolean;
  bedId: string;
  admittedAt: string;
  reason: string;
}

export interface M24PlacementTransitionInput {
  placementId: string;
  transitionType: "transfer" | "leave" | "return" | "discharge";
  occurredAt: string;
  reason: string;
  toBedId?: string;
  expectedVersion: number;
}

export interface M24ShiftInput {
  stageId: string;
  shiftDate: string;
  shiftType: M24ShiftType;
  startsAt: string;
  endsAt: string;
  staff: Array<
    Omit<M24StaffAssignment, "attendanceStatus" | "clockInAt" | "clockOutAt">
  >;
  reason: string;
}

export interface M24MedicationScheduleInput {
  caseId: string;
  youthId: string;
  medicationName: string;
  dose: string;
  route: string;
  scheduledAt: string;
  isPrn?: boolean;
  isControlled?: boolean;
  expectedControlledCount?: number;
  reason: string;
}

export interface M24MedicationDispositionInput {
  medicationRecordId: string;
  action: "administer" | "refuse" | "omit" | "hold";
  occurredAt: string;
  reason?: string;
  prnReason?: string;
  countBefore?: number;
  countAfter?: number;
  witnessedBy?: string;
  expectedVersion: number;
}

export interface M24IncidentInput {
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
  practiceCodes?: string[];
  interventionEndedAt?: string;
  stabilizedAt?: string;
  restraintEvidence?: GroPersonalRestraintInput;
  medicalEvaluationRequired?: boolean;
  reason: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function record(value: unknown): Record<string, unknown> {
  return clone(value) as Record<string, unknown>;
}

function requireIso(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed) || !/(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new M24DomainError(
      "M24_TIMESTAMP_INVALID",
      `${label} must be a timezone-qualified ISO-8601 instant.`,
    );
  }
  return parsed;
}

function assertNonempty(
  value: string | undefined,
  code: string,
  message: string,
): string {
  if (!value?.trim()) throw new M24DomainError(code, message);
  return value.trim();
}

function findRequired<T extends { id: string }>(
  rows: T[],
  id: string,
  entity: string,
): T {
  const found = rows.find((row) => row.id === id);
  if (!found)
    throw new M24DomainError(
      "M24_NOT_FOUND",
      `${entity} '${id}' was not found.`,
    );
  return found;
}

export class M24GroEngine {
  private state: M24State;
  private readonly nowProvider: () => string;

  constructor(options: M24EngineOptions = {}) {
    this.nowProvider = options.now ?? (() => new Date().toISOString());
    assertSyntheticBoundary({
      id: "SYNTH-M24-GRO-STATE",
      evidenceClass: M24_EVIDENCE_CLASS,
    });
    this.state = clone(options.initialState ?? createM24SyntheticState());
  }

  now(): string {
    const value = this.nowProvider();
    requireIso(value, "Engine clock");
    return value;
  }

  reset(): M24State {
    assertSyntheticBoundary({
      id: "SYNTH-M24-GRO-STATE",
      evidenceClass: M24_EVIDENCE_CLASS,
    });
    this.state = createM24SyntheticState();
    return this.getState();
  }

  getState(): M24State {
    return clone(this.state);
  }

  private transaction<T>(work: (draft: M24State) => T): T {
    const draft = clone(this.state);
    const result = work(draft);
    this.state = draft;
    return clone(result);
  }

  private id(draft: M24State, prefix: string): string {
    draft.sequence += 1;
    return `SYNTH-M24-${prefix}-${String(draft.sequence).padStart(5, "0")}`;
  }

  private authorize(actor: M24Actor, capability: M24Capability): void {
    if (!actor.id.trim() || !m24RoleCan(actor.role, capability)) {
      throw new M24DomainError(
        "M24_ROLE_FORBIDDEN",
        `Role '${actor.role}' is not authorized for '${capability}'.`,
      );
    }
  }

  private audit(
    draft: M24State,
    actor: M24Actor,
    caseId: string,
    action: string,
    entityType: string,
    entityId: string,
    reason: string,
    before: Record<string, unknown> | null,
    after: Record<string, unknown> | null,
    occurredAt = this.now(),
  ): M24AuditEvent {
    const eventType: Phase2AuditEvent["eventType"] = action.includes("handoff")
      ? "handoff"
      : action.includes("staffing") ||
          action.includes("practice") ||
          action.includes("incident_closed")
        ? "gate_decision"
        : "material_change";
    const event: M24AuditEvent = {
      id: this.id(draft, "AUDIT"),
      caseId,
      domain: "GRO",
      eventType,
      correlationId: m24CorrelationId(caseId),
      action,
      entityType,
      entityId,
      actorId: actor.id,
      actorRole: actor.role,
      reason: assertNonempty(
        reason,
        "M24_AUDIT_REASON_REQUIRED",
        "An audit reason is required.",
      ),
      before,
      after,
      changedFields: changedM24Fields(before, after),
      occurredAt,
      evidenceClass: M24_EVIDENCE_CLASS,
    };
    assertSyntheticBoundary({
      id: event.id,
      evidenceClass: event.evidenceClass,
    });
    draft.auditEvents.push(event);
    return event;
  }

  private createTaskInDraft(
    draft: M24State,
    input: {
      caseId: string;
      title: string;
      sourceType: string;
      sourceId: string;
      assignedRole: string;
      dueAt: string;
      priority?: "routine" | "urgent" | "critical";
    },
  ) {
    requireIso(input.dueAt, "Task due date");
    const task = {
      id: this.id(draft, "TASK"),
      caseId: input.caseId,
      title: input.title,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      assignedRole: input.assignedRole,
      assignedTo: null,
      dueAt: input.dueAt,
      priority: input.priority ?? "routine",
      status: "open" as const,
      escalationLevel: "none" as const,
      escalationReason: null,
      completedAt: null,
      version: 1,
    };
    draft.tasks.push(task);
    return task;
  }

  private notifyInDraft(
    draft: M24State,
    input: {
      caseId: string;
      sourceType: string;
      sourceId: string;
      targetRole: string;
      priority: "normal" | "high" | "critical";
      message: string;
      at?: string;
    },
  ) {
    const notification = {
      id: this.id(draft, "NOTICE"),
      caseId: input.caseId,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      targetRole: input.targetRole,
      priority: input.priority,
      message: input.message,
      createdAt: input.at ?? this.now(),
      acknowledgedAt: null,
    };
    draft.notifications.push(notification);
    return notification;
  }

  private syncCensus(draft: M24State, stageId: string, at: string): void {
    const stage = findRequired(draft.stages, stageId, "Stage");
    const active = draft.placements.filter(
      (item) => item.stageId === stageId && item.status === "active",
    ).length;
    const leave = draft.placements.filter(
      (item) => item.stageId === stageId && item.status === "leave",
    ).length;
    stage.currentCensus = active;
    stage.leaveCount = leave;
    const capacityUse = active + leave;
    const percent =
      stage.operationalCapacity > 0
        ? Math.round((capacityUse / stage.operationalCapacity) * 100)
        : 0;
    const open = draft.censusAlerts.find(
      (item) => item.stageId === stageId && item.resolvedAt === null,
    );
    if (percent >= stage.capacityAlertThreshold) {
      if (!open) {
        draft.censusAlerts.push({
          id: this.id(draft, "CENSUS-ALERT"),
          stageId,
          alertType:
            capacityUse > stage.operationalCapacity
              ? "capacity_exceeded"
              : "capacity_90_percent",
          percentFull: percent,
          currentCensus: active,
          leaveCount: leave,
          capacityLimit: stage.operationalCapacity,
          triggeredAt: at,
          acknowledgedBy: null,
          acknowledgedAt: null,
          resolvedAt: null,
        });
      } else {
        open.percentFull = percent;
        open.currentCensus = active;
        open.leaveCount = leave;
      }
    } else if (open) {
      open.resolvedAt = at;
    }
  }

  private assertRoomAndBedAvailable(
    draft: M24State,
    bedId: string,
    stageId?: string,
  ) {
    const bed = findRequired(draft.beds, bedId, "Bed");
    if (bed.status !== "available" || bed.youthId !== null) {
      throw new M24DomainError(
        "M24_BED_UNAVAILABLE",
        `Bed '${bedId}' is not available.`,
      );
    }
    if (stageId && bed.stageId !== stageId) {
      throw new M24DomainError(
        "M24_BED_STAGE_MISMATCH",
        "The selected bed is outside the required stage.",
      );
    }
    const room = findRequired(draft.rooms, bed.roomId, "Room");
    if (!room.active)
      throw new M24DomainError(
        "M24_ROOM_INACTIVE",
        "The selected room is inactive.",
      );
    const occupantCount =
      draft.beds.filter(
        (item) => item.roomId === room.id && item.status !== "available",
      ).length + 1;
    if (occupantCount > room.maximumBeds) {
      throw new M24DomainError(
        "M24_ROOM_CAPACITY_EXCEEDED",
        "The room bed limit would be exceeded.",
      );
    }
    const decision = evaluateGroBedroom({
      occupantCount,
      grossFloorSquareFeet: room.grossFloorSquareFeet,
      closetAndAlcoveSquareFeet: room.closetAndAlcoveSquareFeet,
    });
    if (!decision.compliant) {
      throw new M24DomainError(
        "M24_ROOM_POLICY_DENIED",
        decision.reasonCodes.join(","),
      );
    }
    return { bed, room, decision };
  }

  admitYouth(actor: M24Actor, input: M24AdmissionInput) {
    this.authorize(actor, "census.manage");
    requireIso(input.admittedAt, "Admission date");
    if (!Number.isFinite(input.ageYears) || input.ageYears < 0) {
      throw new M24DomainError(
        "M24_AGE_INVALID",
        "Youth age must be nonnegative.",
      );
    }
    return this.transaction((draft) => {
      if (
        draft.placements.some(
          (item) =>
            item.youthId === input.youthId && item.status !== "discharged",
        )
      ) {
        throw new M24DomainError(
          "M24_ACTIVE_PLACEMENT_EXISTS",
          "Youth already has an active or leave placement.",
        );
      }
      const { bed, room, decision } = this.assertRoomAndBedAvailable(
        draft,
        input.bedId,
      );
      const stage = findRequired(draft.stages, bed.stageId, "Stage");
      if (stage.status === "closed")
        throw new M24DomainError("M24_STAGE_CLOSED", "The stage is closed.");
      const capacityUse = draft.placements.filter(
        (item) => item.stageId === stage.id && item.status !== "discharged",
      ).length;
      if (capacityUse >= stage.operationalCapacity) {
        throw new M24DomainError(
          "M24_STAGE_CAPACITY_EXCEEDED",
          "The stage has no operational capacity.",
        );
      }
      const placement: M24Placement = {
        id: this.id(draft, "PLACEMENT"),
        caseId: input.caseId,
        youthId: input.youthId,
        youthLabel: input.youthLabel,
        ageYears: input.ageYears,
        requiresTreatmentServices: input.requiresTreatmentServices,
        requiresConstantSupervision: input.requiresConstantSupervision ?? false,
        parentConsentRequired: input.parentConsentRequired ?? true,
        stageId: stage.id,
        roomId: room.id,
        bedId: bed.id,
        status: "active",
        admittedAt: input.admittedAt,
        lastTransitionAt: input.admittedAt,
        version: 1,
      };
      bed.status = "occupied";
      bed.youthId = input.youthId;
      draft.placements.push(placement);
      const transition = {
        id: this.id(draft, "TRANSITION"),
        placementId: placement.id,
        youthId: placement.youthId,
        transitionType: "admission" as const,
        fromStageId: null,
        toStageId: placement.stageId,
        fromBedId: null,
        toBedId: placement.bedId,
        reason: input.reason,
        occurredAt: input.admittedAt,
      };
      draft.transitions.push(transition);
      const rightsTask = this.createTaskInDraft(draft, {
        caseId: input.caseId,
        title: "Complete youth-rights review and acknowledgment",
        sourceType: "placement",
        sourceId: placement.id,
        assignedRole: "family-liaison",
        dueAt: addUtcHours(input.admittedAt, 168),
        priority: "urgent",
      });
      this.syncCensus(draft, stage.id, input.admittedAt);
      const audit = this.audit(
        draft,
        actor,
        input.caseId,
        "youth_admitted",
        "gro_placement",
        placement.id,
        input.reason,
        null,
        record({
          placement,
          bedroomReasonCodes: decision.reasonCodes,
          rightsTaskId: rightsTask.id,
        }),
        input.admittedAt,
      );
      return {
        placement,
        transition,
        rightsTask,
        audit,
        censusAlert:
          draft.censusAlerts.length > 0
            ? draft.censusAlerts[draft.censusAlerts.length - 1]
            : null,
      };
    });
  }

  transitionPlacement(actor: M24Actor, input: M24PlacementTransitionInput) {
    this.authorize(actor, "census.manage");
    requireIso(input.occurredAt, "Placement transition date");
    return this.transaction((draft) => {
      const placement = findRequired(
        draft.placements,
        input.placementId,
        "Placement",
      );
      if (placement.version !== input.expectedVersion) {
        throw new M24DomainError(
          "M24_VERSION_CONFLICT",
          "Placement version changed.",
        );
      }
      if (placement.status === "discharged") {
        throw new M24DomainError(
          "M24_PLACEMENT_CLOSED",
          "The placement is discharged.",
        );
      }
      const before = record(placement);
      const oldStageId = placement.stageId;
      const oldBedId = placement.bedId;
      const oldBed = findRequired(draft.beds, oldBedId, "Bed");
      let toStageId: string | null = placement.stageId;
      let toBedId: string | null = placement.bedId;

      if (input.transitionType === "transfer") {
        const targetBedId = assertNonempty(
          input.toBedId,
          "M24_TRANSFER_BED_REQUIRED",
          "Transfer requires a target bed.",
        );
        const { bed, room } = this.assertRoomAndBedAvailable(
          draft,
          targetBedId,
        );
        const targetStage = findRequired(draft.stages, bed.stageId, "Stage");
        if (targetStage.status === "closed")
          throw new M24DomainError(
            "M24_STAGE_CLOSED",
            "The target stage is closed.",
          );
        if (targetStage.id !== placement.stageId) {
          const use = draft.placements.filter(
            (row) =>
              row.stageId === targetStage.id && row.status !== "discharged",
          ).length;
          if (use >= targetStage.operationalCapacity)
            throw new M24DomainError(
              "M24_STAGE_CAPACITY_EXCEEDED",
              "Target stage capacity is full.",
            );
        }
        oldBed.status = "available";
        oldBed.youthId = null;
        bed.status = "occupied";
        bed.youthId = placement.youthId;
        placement.stageId = bed.stageId;
        placement.roomId = room.id;
        placement.bedId = bed.id;
        placement.status = "active";
        toStageId = bed.stageId;
        toBedId = bed.id;
      } else if (input.transitionType === "leave") {
        if (placement.status !== "active")
          throw new M24DomainError(
            "M24_LEAVE_STATE_INVALID",
            "Only an active placement may enter leave.",
          );
        placement.status = "leave";
        oldBed.status = "held";
      } else if (input.transitionType === "return") {
        if (placement.status !== "leave" || oldBed.status !== "held") {
          throw new M24DomainError(
            "M24_RETURN_STATE_INVALID",
            "Only a held leave placement may return.",
          );
        }
        placement.status = "active";
        oldBed.status = "occupied";
      } else {
        const coordination = draft.engagementEvents.find(
          (event) =>
            event.caseId === placement.caseId &&
            event.eventType === "discharge_coordination" &&
            event.status === "completed",
        );
        if (!coordination) {
          throw new M24DomainError(
            "M24_DISCHARGE_COORDINATION_REQUIRED",
            "Completed discharge coordination is required.",
          );
        }
        placement.status = "discharged";
        oldBed.status = "available";
        oldBed.youthId = null;
        toStageId = null;
        toBedId = null;
      }

      placement.lastTransitionAt = input.occurredAt;
      placement.version += 1;
      const transition = {
        id: this.id(draft, "TRANSITION"),
        placementId: placement.id,
        youthId: placement.youthId,
        transitionType: input.transitionType,
        fromStageId: oldStageId,
        toStageId,
        fromBedId: oldBedId,
        toBedId,
        reason: input.reason,
        occurredAt: input.occurredAt,
      };
      draft.transitions.push(transition);
      this.syncCensus(draft, oldStageId, input.occurredAt);
      if (toStageId && toStageId !== oldStageId)
        this.syncCensus(draft, toStageId, input.occurredAt);
      const audit = this.audit(
        draft,
        actor,
        placement.caseId,
        `placement_${input.transitionType}`,
        "gro_placement",
        placement.id,
        input.reason,
        before,
        record(placement),
        input.occurredAt,
      );
      return { placement, transition, audit };
    });
  }

  acknowledgeCensusAlert(actor: M24Actor, alertId: string, reason: string) {
    this.authorize(actor, "census.manage");
    return this.transaction((draft) => {
      const alert = findRequired(draft.censusAlerts, alertId, "Census alert");
      const before = record(alert);
      alert.acknowledgedBy = actor.id;
      alert.acknowledgedAt = this.now();
      const audit = this.audit(
        draft,
        actor,
        `CENSUS-${alert.stageId}`,
        "census_alert_acknowledged",
        "census_alert",
        alert.id,
        reason,
        before,
        record(alert),
      );
      return { alert, audit };
    });
  }

  createShift(actor: M24Actor, input: M24ShiftInput) {
    this.authorize(actor, "shift.manage");
    requireIso(input.startsAt, "Shift start");
    requireIso(input.endsAt, "Shift end");
    if (Date.parse(input.endsAt) <= Date.parse(input.startsAt))
      throw new M24DomainError(
        "M24_SHIFT_ORDER_INVALID",
        "Shift end must follow start.",
      );
    return this.transaction((draft) => {
      findRequired(draft.stages, input.stageId, "Stage");
      const shift = {
        id: this.id(draft, "SHIFT"),
        stageId: input.stageId,
        shiftDate: input.shiftDate,
        shiftType: input.shiftType,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        status: "scheduled" as const,
        staff: input.staff.map((member) => ({
          ...member,
          attendanceStatus: "scheduled" as const,
          clockInAt: null,
          clockOutAt: null,
        })),
        version: 1,
      };
      draft.shifts.push(shift);
      const audit = this.audit(
        draft,
        actor,
        `SHIFT-${shift.id}`,
        "shift_scheduled",
        "gro_shift",
        shift.id,
        input.reason,
        null,
        record(shift),
      );
      return { shift, audit };
    });
  }

  recordAttendance(
    actor: M24Actor,
    input: {
      shiftId: string;
      staffId: string;
      status: "present" | "late" | "absent" | "no_show";
      occurredAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "shift.manage");
    requireIso(input.occurredAt, "Attendance timestamp");
    return this.transaction((draft) => {
      const shift = findRequired(draft.shifts, input.shiftId, "Shift");
      if (shift.version !== input.expectedVersion)
        throw new M24DomainError(
          "M24_VERSION_CONFLICT",
          "Shift version changed.",
        );
      const member = shift.staff.find((item) => item.staffId === input.staffId);
      if (!member)
        throw new M24DomainError(
          "M24_SHIFT_STAFF_NOT_FOUND",
          "Staff member is not assigned to the shift.",
        );
      const before = record(member);
      member.attendanceStatus = input.status;
      member.clockInAt =
        input.status === "present" || input.status === "late"
          ? input.occurredAt
          : null;
      shift.status = "active";
      shift.version += 1;
      const audit = this.audit(
        draft,
        actor,
        `SHIFT-${shift.id}`,
        "attendance_recorded",
        "shift_staff_assignment",
        member.staffId,
        input.reason,
        before,
        record(member),
        input.occurredAt,
      );
      return { shift, member, audit };
    });
  }

  evaluateStaffing(
    actor: M24Actor,
    shiftId: string,
    period?: "children-awake" | "night-sleeping",
    reason = "Evaluate shift staffing",
  ) {
    this.authorize(actor, "staffing.manage");
    return this.transaction((draft) => {
      const shift = findRequired(draft.shifts, shiftId, "Shift");
      const evaluationPeriod =
        period ??
        (shift.shiftType === "overnight" ? "night-sleeping" : "children-awake");
      const children = draft.placements
        .filter(
          (placement) =>
            placement.stageId === shift.stageId &&
            placement.status === "active",
        )
        .map((placement) => ({
          id: placement.youthId,
          ageYears: placement.ageYears,
          requiresTreatmentServices: placement.requiresTreatmentServices,
          requiresConstantSupervision: placement.requiresConstantSupervision,
        }));
      const caregivers = shift.staff
        .filter(
          (member) =>
            member.attendanceStatus === "present" ||
            member.attendanceStatus === "late",
        )
        .map((member) => ({
          id: member.staffId,
          qualified: member.qualified,
          workingDirectlyWithGroup: member.workingDirectlyWithGroup,
          status: member.awakeStatus,
        }));
      const policy = evaluateGroSupervisionRatio({
        period: evaluationPeriod,
        children,
        caregivers,
      });
      const evaluation = {
        shiftId,
        period: evaluationPeriod,
        compliant: policy.compliant,
        reasonCodes: policy.reasonCodes,
        weightedChildUnits: policy.facts.weightedChildUnits,
        availableCapacityUnits: policy.facts.availableCapacityUnits,
        requiredAdditionalCapacityUnits:
          policy.facts.requiredAdditionalCapacityUnits,
        evaluatedAt: this.now(),
      };
      draft.staffingEvaluations.push(evaluation);
      let taskId: string | null = null;
      if (!policy.compliant) {
        const task = this.createTaskInDraft(draft, {
          caseId: `SHIFT-${shift.id}`,
          title: `Resolve staffing shortage for ${shift.shiftType} shift`,
          sourceType: "staffing_evaluation",
          sourceId: shift.id,
          assignedRole: "shift-supervisor",
          dueAt: shift.startsAt,
          priority: "critical",
        });
        taskId = task.id;
        this.notifyInDraft(draft, {
          caseId: `SHIFT-${shift.id}`,
          sourceType: "staffing_evaluation",
          sourceId: shift.id,
          targetRole: "gro-administrator",
          priority: "critical",
          message: `Staffing shortage: ${policy.facts.requiredAdditionalCapacityUnits} additional capacity unit(s) required.`,
        });
      }
      const audit = this.audit(
        draft,
        actor,
        `SHIFT-${shift.id}`,
        "staffing_evaluated",
        "gro_shift",
        shift.id,
        reason,
        null,
        record(evaluation),
      );
      return { evaluation, taskId, audit };
    });
  }

  recordSafetyRound(
    actor: M24Actor,
    input: {
      shiftId: string;
      area: string;
      passed: boolean;
      findings?: string;
      completedAt: string;
      reason: string;
    },
  ) {
    this.authorize(actor, "shift.document");
    requireIso(input.completedAt, "Safety round completion");
    return this.transaction((draft) => {
      const shift = findRequired(draft.shifts, input.shiftId, "Shift");
      let correctiveTaskId: string | null = null;
      if (!input.passed) {
        correctiveTaskId = this.createTaskInDraft(draft, {
          caseId: `SHIFT-${shift.id}`,
          title: `Correct safety finding: ${input.area}`,
          sourceType: "safety_round",
          sourceId: shift.id,
          assignedRole: "shift-supervisor",
          dueAt: addUtcHours(input.completedAt, 2),
          priority: "urgent",
        }).id;
      }
      const round = {
        id: this.id(draft, "ROUND"),
        shiftId: shift.id,
        area: input.area,
        completedAt: input.completedAt,
        completedBy: actor.id,
        passed: input.passed,
        findings: input.findings ?? null,
        correctiveTaskId,
      };
      draft.safetyRounds.push(round);
      const audit = this.audit(
        draft,
        actor,
        `SHIFT-${shift.id}`,
        "safety_round_recorded",
        "safety_round",
        round.id,
        input.reason,
        null,
        record(round),
        input.completedAt,
      );
      return { round, audit };
    });
  }

  recordYouthCareLog(
    actor: M24Actor,
    input: {
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
      followUpRequired?: boolean;
      recordedAt: string;
      reason: string;
    },
  ) {
    this.authorize(actor, "shift.document");
    requireIso(input.recordedAt, "Care-log timestamp");
    return this.transaction((draft) => {
      const shift = findRequired(draft.shifts, input.shiftId, "Shift");
      const placement = draft.placements.find(
        (item) => item.youthId === input.youthId && item.status === "active",
      );
      if (!placement || placement.stageId !== shift.stageId)
        throw new M24DomainError(
          "M24_YOUTH_NOT_ON_SHIFT_STAGE",
          "Youth is not active on the shift stage.",
        );
      let followUpTaskId: string | null = null;
      if (input.followUpRequired) {
        followUpTaskId = this.createTaskInDraft(draft, {
          caseId: placement.caseId,
          title: `Follow up youth-care log: ${input.category}`,
          sourceType: "youth_care_log",
          sourceId: shift.id,
          assignedRole: "shift-supervisor",
          dueAt: addUtcHours(input.recordedAt, 8),
          priority: "urgent",
        }).id;
      }
      const log = {
        id: this.id(draft, "CARE-LOG"),
        shiftId: shift.id,
        youthId: input.youthId,
        category: input.category,
        narrative: assertNonempty(
          input.narrative,
          "M24_CARE_NARRATIVE_REQUIRED",
          "Care-log narrative is required.",
        ),
        followUpRequired: input.followUpRequired ?? false,
        followUpTaskId,
        recordedAt: input.recordedAt,
        recordedBy: actor.id,
      };
      draft.careLogs.push(log);
      const audit = this.audit(
        draft,
        actor,
        placement.caseId,
        "youth_care_log_recorded",
        "youth_care_log",
        log.id,
        input.reason,
        null,
        record(log),
        input.recordedAt,
      );
      return { log, audit };
    });
  }

  createTask(
    actor: M24Actor,
    input: {
      caseId: string;
      title: string;
      sourceType: string;
      sourceId: string;
      assignedRole: string;
      dueAt: string;
      priority?: "routine" | "urgent" | "critical";
      reason: string;
    },
  ) {
    this.authorize(actor, "shift.manage");
    return this.transaction((draft) => {
      const task = this.createTaskInDraft(draft, input);
      const audit = this.audit(
        draft,
        actor,
        input.caseId,
        "task_created",
        "gro_task",
        task.id,
        input.reason,
        null,
        record(task),
      );
      return { task, audit };
    });
  }

  completeTask(
    actor: M24Actor,
    input: {
      taskId: string;
      completedAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "shift.manage");
    requireIso(input.completedAt, "Task completion");
    return this.transaction((draft) => {
      const task = findRequired(draft.tasks, input.taskId, "Task");
      if (task.version !== input.expectedVersion)
        throw new M24DomainError(
          "M24_VERSION_CONFLICT",
          "Task version changed.",
        );
      const before = record(task);
      task.status = "completed";
      task.completedAt = input.completedAt;
      task.version += 1;
      const audit = this.audit(
        draft,
        actor,
        task.caseId,
        "task_completed",
        "gro_task",
        task.id,
        input.reason,
        before,
        record(task),
        input.completedAt,
      );
      return { task, audit };
    });
  }

  createShiftHandoff(
    actor: M24Actor,
    input: {
      caseId: string;
      fromShiftId: string;
      toShiftId: string;
      summary: string;
      taskIds?: string[];
      medicationRecordIds?: string[];
      initiatedAt: string;
      reason: string;
    },
  ) {
    this.authorize(actor, "shift.manage");
    requireIso(input.initiatedAt, "Handoff initiation");
    return this.transaction((draft) => {
      findRequired(draft.shifts, input.fromShiftId, "From shift");
      findRequired(draft.shifts, input.toShiftId, "To shift");
      for (const taskId of input.taskIds ?? [])
        findRequired(draft.tasks, taskId, "Handoff task");
      for (const medId of input.medicationRecordIds ?? [])
        findRequired(draft.medications, medId, "Handoff medication");
      const handoff = {
        id: this.id(draft, "HANDOFF"),
        caseId: input.caseId,
        fromShiftId: input.fromShiftId,
        toShiftId: input.toShiftId,
        summary: assertNonempty(
          input.summary,
          "M24_HANDOFF_SUMMARY_REQUIRED",
          "Handoff summary is required.",
        ),
        taskIds: input.taskIds ?? [],
        medicationRecordIds: input.medicationRecordIds ?? [],
        status: "pending" as const,
        initiatedBy: actor.id,
        initiatedAt: input.initiatedAt,
        acceptedBy: null,
        acceptedAt: null,
        completedAt: null,
        version: 1,
      };
      draft.shiftHandoffs.push(handoff);
      const audit = this.audit(
        draft,
        actor,
        input.caseId,
        "shift_handoff_initiated",
        "shift_handoff",
        handoff.id,
        input.reason,
        null,
        record(handoff),
        input.initiatedAt,
      );
      return { handoff, audit };
    });
  }

  acceptShiftHandoff(
    actor: M24Actor,
    input: {
      handoffId: string;
      acceptedAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "shift.manage");
    requireIso(input.acceptedAt, "Handoff acceptance");
    return this.transaction((draft) => {
      const handoff = findRequired(
        draft.shiftHandoffs,
        input.handoffId,
        "Shift handoff",
      );
      if (
        handoff.version !== input.expectedVersion ||
        handoff.status !== "pending"
      )
        throw new M24DomainError(
          "M24_HANDOFF_STATE_CONFLICT",
          "Handoff cannot be accepted from its current state.",
        );
      const before = record(handoff);
      handoff.status = "accepted";
      handoff.acceptedBy = actor.id;
      handoff.acceptedAt = input.acceptedAt;
      handoff.version += 1;
      const audit = this.audit(
        draft,
        actor,
        handoff.caseId,
        "shift_handoff_accepted",
        "shift_handoff",
        handoff.id,
        input.reason,
        before,
        record(handoff),
        input.acceptedAt,
      );
      return {
        handoff,
        unresolvedTaskIds: handoff.taskIds.filter(
          (id) => findRequired(draft.tasks, id, "Task").status !== "completed",
        ),
        audit,
      };
    });
  }

  completeShiftHandoff(
    actor: M24Actor,
    input: {
      handoffId: string;
      completedAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "shift.manage");
    return this.transaction((draft) => {
      const handoff = findRequired(
        draft.shiftHandoffs,
        input.handoffId,
        "Shift handoff",
      );
      if (
        handoff.version !== input.expectedVersion ||
        handoff.status !== "accepted"
      )
        throw new M24DomainError(
          "M24_HANDOFF_STATE_CONFLICT",
          "Accepted handoff required.",
        );
      const openTasks = handoff.taskIds.filter(
        (id) => findRequired(draft.tasks, id, "Task").status !== "completed",
      );
      if (openTasks.length > 0)
        throw new M24DomainError(
          "M24_HANDOFF_UNRESOLVED_TASKS",
          "Handoff has unresolved tasks.",
        );
      const before = record(handoff);
      handoff.status = "completed";
      handoff.completedAt = input.completedAt;
      handoff.version += 1;
      const audit = this.audit(
        draft,
        actor,
        handoff.caseId,
        "shift_handoff_completed",
        "shift_handoff",
        handoff.id,
        input.reason,
        before,
        record(handoff),
        input.completedAt,
      );
      return { handoff, audit };
    });
  }

  sweepOverdueTasks(actor: M24Actor, at: string, reason: string) {
    this.authorize(actor, "shift.manage");
    const atMs = requireIso(at, "Escalation sweep");
    return this.transaction((draft) => {
      const escalated: string[] = [];
      for (const task of draft.tasks) {
        if (
          evaluateDeadline(task.dueAt, at, task.completedAt ?? undefined) !==
          "overdue"
        )
          continue;
        const before = record(task);
        const overdueHours = Math.floor(
          (atMs - Date.parse(task.dueAt)) / HOUR_MS,
        );
        task.status = "escalated";
        task.escalationLevel = overdueHours >= 24 ? "director" : "supervisor";
        task.escalationReason = `Unresolved ${overdueHours} hour(s) after due time.`;
        task.version += 1;
        escalated.push(task.id);
        this.audit(
          draft,
          actor,
          task.caseId,
          "task_escalated",
          "gro_task",
          task.id,
          reason,
          before,
          record(task),
          at,
        );
      }
      return { escalatedTaskIds: escalated };
    });
  }

  scheduleMedication(actor: M24Actor, input: M24MedicationScheduleInput) {
    this.authorize(actor, "medication.reconcile");
    requireIso(input.scheduledAt, "Medication schedule");
    if (
      input.isControlled &&
      (!Number.isInteger(input.expectedControlledCount) ||
        (input.expectedControlledCount ?? -1) < 1)
    ) {
      throw new M24DomainError(
        "M24_CONTROLLED_COUNT_REQUIRED",
        "Controlled medication requires a positive expected count.",
      );
    }
    return this.transaction((draft) => {
      const placement = draft.placements.find(
        (item) =>
          item.youthId === input.youthId && item.status !== "discharged",
      );
      if (!placement || placement.caseId !== input.caseId)
        throw new M24DomainError(
          "M24_MEDICATION_YOUTH_NOT_PLACED",
          "Medication youth has no matching placement.",
        );
      const medication = {
        id: this.id(draft, "MAR"),
        caseId: input.caseId,
        youthId: input.youthId,
        medicationName: input.medicationName,
        dose: input.dose,
        route: input.route,
        scheduledAt: input.scheduledAt,
        status: "scheduled" as M24MedicationStatus,
        isPrn: input.isPrn ?? false,
        prnReason: null,
        prnEffectivenessDueAt: null,
        prnEffectiveness: null,
        prnEffectivenessAt: null,
        isControlled: input.isControlled ?? false,
        expectedControlledCount: input.expectedControlledCount ?? null,
        countBefore: null,
        countAfter: null,
        witnessedBy: null,
        dispositionReason: null,
        administeredBy: null,
        administeredAt: null,
        discrepancyId: null,
        version: 1,
      };
      draft.medications.push(medication);
      const audit = this.audit(
        draft,
        actor,
        input.caseId,
        "medication_scheduled",
        "mar_record",
        medication.id,
        input.reason,
        null,
        record(medication),
      );
      return { medication, audit };
    });
  }

  recordMedicationDisposition(
    actor: M24Actor,
    input: M24MedicationDispositionInput,
  ) {
    this.authorize(actor, "medication.administer");
    requireIso(input.occurredAt, "Medication disposition");
    return this.transaction((draft) => {
      const medication = findRequired(
        draft.medications,
        input.medicationRecordId,
        "Medication record",
      );
      if (
        medication.version !== input.expectedVersion ||
        medication.status !== "scheduled"
      ) {
        throw new M24DomainError(
          "M24_MAR_STATE_CONFLICT",
          "Medication is not in the expected scheduled state.",
        );
      }
      const before = record(medication);
      let discrepancy = null;
      if (input.action === "administer") {
        if (medication.isPrn)
          medication.prnReason = assertNonempty(
            input.prnReason,
            "M24_PRN_REASON_REQUIRED",
            "PRN administration requires a reason.",
          );
        if (medication.isControlled) {
          if (
            !Number.isInteger(input.countBefore) ||
            !Number.isInteger(input.countAfter)
          ) {
            throw new M24DomainError(
              "M24_CONTROLLED_COUNT_REQUIRED",
              "Controlled administration requires before and after counts.",
            );
          }
          const witness = assertNonempty(
            input.witnessedBy,
            "M24_CONTROLLED_WITNESS_REQUIRED",
            "Controlled administration requires a witness.",
          );
          if (witness === actor.id)
            throw new M24DomainError(
              "M24_INDEPENDENT_WITNESS_REQUIRED",
              "The administering actor cannot witness their own count.",
            );
          medication.countBefore = input.countBefore ?? null;
          medication.countAfter = input.countAfter ?? null;
          medication.witnessedBy = witness;
          const expectedBefore =
            medication.expectedControlledCount ?? input.countBefore ?? 0;
          const expectedAfter = expectedBefore - 1;
          if (
            input.countBefore !== expectedBefore ||
            input.countAfter !== expectedAfter
          ) {
            discrepancy = {
              id: this.id(draft, "MED-DISCREPANCY"),
              medicationRecordId: medication.id,
              expectedCountAfter: expectedAfter,
              actualCountAfter: input.countAfter ?? 0,
              reason: `Count expected ${expectedBefore}→${expectedAfter}; recorded ${input.countBefore}→${input.countAfter}.`,
              status: "open" as const,
              openedAt: input.occurredAt,
              resolvedAt: null,
              resolvedBy: null,
              resolution: null,
            };
            draft.medicationDiscrepancies.push(discrepancy);
            medication.discrepancyId = discrepancy.id;
            this.notifyInDraft(draft, {
              caseId: medication.caseId,
              sourceType: "medication_discrepancy",
              sourceId: discrepancy.id,
              targetRole: "gro-administrator",
              priority: "critical",
              message: discrepancy.reason,
              at: input.occurredAt,
            });
          } else {
            medication.expectedControlledCount = expectedAfter;
          }
        }
        medication.status = "administered";
        medication.administeredBy = actor.id;
        medication.administeredAt = input.occurredAt;
        if (medication.isPrn)
          medication.prnEffectivenessDueAt = addUtcHours(input.occurredAt, 1);
      } else {
        medication.status =
          input.action === "refuse"
            ? "refused"
            : input.action === "omit"
              ? "omitted"
              : "held";
        medication.dispositionReason = assertNonempty(
          input.reason,
          "M24_MEDICATION_REASON_REQUIRED",
          `${input.action} requires a reason.`,
        );
      }
      medication.version += 1;
      const audit = this.audit(
        draft,
        actor,
        medication.caseId,
        `medication_${input.action}`,
        "mar_record",
        medication.id,
        input.reason ?? input.prnReason ?? input.action,
        before,
        record(medication),
        input.occurredAt,
      );
      return { medication, discrepancy, audit };
    });
  }

  recordPrnEffectiveness(
    actor: M24Actor,
    input: {
      medicationRecordId: string;
      effectiveness: "effective" | "partial" | "ineffective";
      recordedAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "medication.administer");
    requireIso(input.recordedAt, "PRN effectiveness");
    return this.transaction((draft) => {
      const medication = findRequired(
        draft.medications,
        input.medicationRecordId,
        "Medication record",
      );
      if (
        medication.version !== input.expectedVersion ||
        !medication.isPrn ||
        medication.status !== "administered"
      ) {
        throw new M24DomainError(
          "M24_PRN_STATE_INVALID",
          "Effectiveness requires an administered PRN record at the expected version.",
        );
      }
      const before = record(medication);
      medication.prnEffectiveness = input.effectiveness;
      medication.prnEffectivenessAt = input.recordedAt;
      medication.version += 1;
      const audit = this.audit(
        draft,
        actor,
        medication.caseId,
        "prn_effectiveness_recorded",
        "mar_record",
        medication.id,
        input.reason,
        before,
        record(medication),
        input.recordedAt,
      );
      return {
        medication,
        timely:
          Date.parse(input.recordedAt) <=
          Date.parse(medication.prnEffectivenessDueAt ?? input.recordedAt),
        audit,
      };
    });
  }

  resolveMedicationDiscrepancy(
    actor: M24Actor,
    input: {
      discrepancyId: string;
      resolution: string;
      resolvedAt: string;
      reason: string;
    },
  ) {
    this.authorize(actor, "medication.reconcile");
    return this.transaction((draft) => {
      const discrepancy = findRequired(
        draft.medicationDiscrepancies,
        input.discrepancyId,
        "Medication discrepancy",
      );
      if (discrepancy.status !== "open")
        throw new M24DomainError(
          "M24_DISCREPANCY_CLOSED",
          "Discrepancy is already resolved.",
        );
      const medication = findRequired(
        draft.medications,
        discrepancy.medicationRecordId,
        "Medication record",
      );
      const before = record(discrepancy);
      discrepancy.status = "resolved";
      discrepancy.resolvedAt = input.resolvedAt;
      discrepancy.resolvedBy = actor.id;
      discrepancy.resolution = assertNonempty(
        input.resolution,
        "M24_RESOLUTION_REQUIRED",
        "A discrepancy resolution is required.",
      );
      medication.expectedControlledCount = discrepancy.actualCountAfter;
      const audit = this.audit(
        draft,
        actor,
        medication.caseId,
        "medication_discrepancy_resolved",
        "medication_discrepancy",
        discrepancy.id,
        input.reason,
        before,
        record(discrepancy),
        input.resolvedAt,
      );
      return { discrepancy, medication, audit };
    });
  }

  createMedicationHandoff(
    actor: M24Actor,
    input: {
      caseId: string;
      fromShiftId: string;
      toShiftId: string;
      medicationRecordIds: string[];
      initiatedAt: string;
      reason: string;
    },
  ) {
    this.authorize(actor, "medication.reconcile");
    return this.transaction((draft) => {
      findRequired(draft.shifts, input.fromShiftId, "From shift");
      findRequired(draft.shifts, input.toShiftId, "To shift");
      for (const id of input.medicationRecordIds)
        findRequired(draft.medications, id, "Medication record");
      const handoff = {
        id: this.id(draft, "MED-HANDOFF"),
        caseId: input.caseId,
        fromShiftId: input.fromShiftId,
        toShiftId: input.toShiftId,
        medicationRecordIds: [...input.medicationRecordIds],
        status: "pending" as const,
        initiatedBy: actor.id,
        initiatedAt: input.initiatedAt,
        acceptedBy: null,
        acceptedAt: null,
      };
      draft.medicationHandoffs.push(handoff);
      const audit = this.audit(
        draft,
        actor,
        input.caseId,
        "medication_handoff_initiated",
        "medication_handoff",
        handoff.id,
        input.reason,
        null,
        record(handoff),
        input.initiatedAt,
      );
      return { handoff, audit };
    });
  }

  acceptMedicationHandoff(
    actor: M24Actor,
    input: { handoffId: string; acceptedAt: string; reason: string },
  ) {
    this.authorize(actor, "medication.reconcile");
    return this.transaction((draft) => {
      const handoff = findRequired(
        draft.medicationHandoffs,
        input.handoffId,
        "Medication handoff",
      );
      if (handoff.status !== "pending")
        throw new M24DomainError(
          "M24_MED_HANDOFF_STATE_INVALID",
          "Medication handoff is not pending.",
        );
      const unresolved = handoff.medicationRecordIds.filter((id) => {
        const med = findRequired(draft.medications, id, "Medication record");
        const discrepancyOpen = med.discrepancyId
          ? findRequired(
              draft.medicationDiscrepancies,
              med.discrepancyId,
              "Medication discrepancy",
            ).status === "open"
          : false;
        return (
          discrepancyOpen ||
          (med.isPrn && med.status === "administered" && !med.prnEffectiveness)
        );
      });
      if (unresolved.length > 0)
        throw new M24DomainError(
          "M24_MED_HANDOFF_UNRESOLVED",
          "Medication handoff contains unresolved PRN or count evidence.",
        );
      const before = record(handoff);
      handoff.status = "accepted";
      handoff.acceptedBy = actor.id;
      handoff.acceptedAt = input.acceptedAt;
      const audit = this.audit(
        draft,
        actor,
        handoff.caseId,
        "medication_handoff_accepted",
        "medication_handoff",
        handoff.id,
        input.reason,
        before,
        record(handoff),
        input.acceptedAt,
      );
      return { handoff, audit };
    });
  }

  evaluatePractice(
    actor: M24Actor,
    input: { caseId: string; practiceCode: string; reason: string },
  ) {
    this.authorize(actor, "compliance.review");
    return this.transaction((draft) => {
      const policy = evaluateGroPractice({ practiceCode: input.practiceCode });
      const decision = {
        id: this.id(draft, "PRACTICE"),
        caseId: input.caseId,
        practiceCode: input.practiceCode,
        allowed: policy.compliant,
        classification: policy.facts.classification,
        reasonCodes: [...policy.reasonCodes],
        evaluatedAt: this.now(),
        evaluatedBy: actor.id,
      };
      draft.practiceDecisions.push(decision);
      const audit = this.audit(
        draft,
        actor,
        input.caseId,
        policy.compliant ? "practice_authorized" : "practice_denied",
        "practice_decision",
        decision.id,
        input.reason,
        null,
        record(decision),
      );
      return { decision, audit };
    });
  }

  captureIncident(actor: M24Actor, input: M24IncidentInput) {
    this.authorize(actor, "incident.capture");
    requireIso(input.occurredAt, "Incident occurrence");
    return this.transaction((draft) => {
      const placement = draft.placements.find(
        (item) =>
          item.youthId === input.youthId && item.status !== "discharged",
      );
      if (!placement || placement.caseId !== input.caseId)
        throw new M24DomainError(
          "M24_INCIDENT_YOUTH_NOT_PLACED",
          "Incident youth has no matching placement.",
        );
      const practiceResults = (input.practiceCodes ?? []).map(
        (practiceCode) => ({
          practiceCode,
          policy: evaluateGroPractice({ practiceCode }),
        }),
      );
      let restraintReasons: string[] = [];
      let medicalRequired = input.medicalEvaluationRequired ?? false;
      if (input.incidentType === "restraint") {
        if (
          !input.restraintEvidence ||
          !input.interventionEndedAt ||
          !input.stabilizedAt
        ) {
          throw new M24DomainError(
            "M24_RESTRAINT_EVIDENCE_REQUIRED",
            "Restraint incidents require intervention evidence and ordered end/stabilization times.",
          );
        }
        const policy = evaluateGroPersonalRestraint(input.restraintEvidence);
        if (!policy.compliant)
          throw new M24DomainError(
            "M24_RESTRAINT_POLICY_DENIED",
            policy.reasonCodes.join(","),
          );
        restraintReasons = [...policy.reasonCodes];
        medicalRequired ||= policy.facts.immediateMedicalResponseRequired;
      }
      const incidentId = this.id(draft, "INCIDENT");
      const notificationRoles: Readonly<
        Record<M24IncidentLevel, readonly string[]>
      > = {
        L1: ["shift-supervisor"],
        L2: ["shift-supervisor", "gro-administrator"],
        L3: ["shift-supervisor", "gro-administrator", "compliance-officer"],
        L4: [
          "shift-supervisor",
          "gro-administrator",
          "compliance-officer",
          "nurse",
        ],
        L5: [
          "shift-supervisor",
          "gro-administrator",
          "compliance-officer",
          "nurse",
          "managing-director",
        ],
      };
      const notificationIds = notificationRoles[input.level].map(
        (targetRole) =>
          this.notifyInDraft(draft, {
            caseId: input.caseId,
            sourceType: "incident",
            sourceId: incidentId,
            targetRole,
            priority:
              input.level === "L5"
                ? "critical"
                : input.level === "L1"
                  ? "normal"
                  : "high",
            message: `${input.level} ${input.incidentType} incident requires review.`,
            at: input.occurredAt,
          }).id,
      );
      const correctiveActionIds: string[] = [];
      const prohibitedOccurred = practiceResults.some(
        (item) => item.policy.facts.classification === "prohibited",
      );
      if (["L3", "L4", "L5"].includes(input.level) || prohibitedOccurred) {
        const correction = {
          id: this.id(draft, "CORRECTIVE"),
          incidentId,
          title: prohibitedOccurred
            ? "Investigate prohibited-practice occurrence"
            : "Complete incident corrective review",
          ownerRole: "gro-administrator",
          dueAt: addUtcHours(input.occurredAt, 24),
          status: "open" as const,
          completedAt: null,
          completionEvidence: null,
        };
        draft.correctiveActions.push(correction);
        correctiveActionIds.push(correction.id);
      }
      const incident = {
        id: incidentId,
        caseId: input.caseId,
        youthId: input.youthId,
        level: input.level,
        incidentType: input.incidentType,
        summary: assertNonempty(
          input.summary,
          "M24_INCIDENT_SUMMARY_REQUIRED",
          "Incident summary is required.",
        ),
        occurredAt: input.occurredAt,
        isRestraint: input.incidentType === "restraint",
        interventionEndedAt: input.interventionEndedAt ?? null,
        stabilizedAt: input.stabilizedAt ?? null,
        documentationDueAt: addUtcHours(input.occurredAt, 1),
        documentationCompletedAt: null,
        documentationTimely: null,
        debriefDueAt: addUtcHours(input.occurredAt, 24),
        debriefCompletedAt: null,
        debriefTimely: null,
        medicalEvaluationRequired: medicalRequired,
        medicalEvaluationCompletedAt: null,
        parentNotifiedAt: null,
        supervisorReviewedAt: null,
        practiceCodes: input.practiceCodes ?? [],
        regulatoryReasonCodes: [
          ...new Set([
            ...restraintReasons,
            ...practiceResults.flatMap((item) => item.policy.reasonCodes),
          ]),
        ],
        notificationIds,
        correctiveActionIds,
        status: "open" as const,
        version: 1,
      };
      draft.incidents.push(incident);
      const audit = this.audit(
        draft,
        actor,
        input.caseId,
        "incident_captured",
        "gro_incident",
        incident.id,
        input.reason,
        null,
        record(incident),
        input.occurredAt,
      );
      return {
        incident,
        notifications: draft.notifications.filter((item) =>
          notificationIds.includes(item.id),
        ),
        audit,
      };
    });
  }

  documentIncident(
    actor: M24Actor,
    input: {
      incidentId: string;
      documentedAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "incident.capture");
    return this.transaction((draft) => {
      const incident = findRequired(
        draft.incidents,
        input.incidentId,
        "Incident",
      );
      if (incident.version !== input.expectedVersion)
        throw new M24DomainError(
          "M24_VERSION_CONFLICT",
          "Incident version changed.",
        );
      const before = record(incident);
      incident.documentationCompletedAt = input.documentedAt;
      incident.documentationTimely =
        evaluateDeadline(incident.documentationDueAt, input.documentedAt) !==
        "overdue";
      incident.status = "documented";
      incident.version += 1;
      const audit = this.audit(
        draft,
        actor,
        incident.caseId,
        "incident_documented",
        "gro_incident",
        incident.id,
        input.reason,
        before,
        record(incident),
        input.documentedAt,
      );
      return { incident, audit };
    });
  }

  completeIncidentDebrief(
    actor: M24Actor,
    input: {
      incidentId: string;
      debriefAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "incident.close");
    return this.transaction((draft) => {
      const incident = findRequired(
        draft.incidents,
        input.incidentId,
        "Incident",
      );
      if (incident.version !== input.expectedVersion)
        throw new M24DomainError(
          "M24_VERSION_CONFLICT",
          "Incident version changed.",
        );
      const before = record(incident);
      incident.debriefCompletedAt = input.debriefAt;
      incident.debriefTimely =
        evaluateDeadline(incident.debriefDueAt, input.debriefAt) !== "overdue";
      incident.supervisorReviewedAt = input.debriefAt;
      incident.status = "under_review";
      incident.version += 1;
      const audit = this.audit(
        draft,
        actor,
        incident.caseId,
        "incident_debrief_completed",
        "gro_incident",
        incident.id,
        input.reason,
        before,
        record(incident),
        input.debriefAt,
      );
      return { incident, audit };
    });
  }

  recordIncidentMedicalEvaluation(
    actor: M24Actor,
    input: {
      incidentId: string;
      completedAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "medication.reconcile");
    return this.transaction((draft) => {
      const incident = findRequired(
        draft.incidents,
        input.incidentId,
        "Incident",
      );
      if (incident.version !== input.expectedVersion)
        throw new M24DomainError(
          "M24_VERSION_CONFLICT",
          "Incident version changed.",
        );
      const before = record(incident);
      incident.medicalEvaluationCompletedAt = input.completedAt;
      incident.version += 1;
      const audit = this.audit(
        draft,
        actor,
        incident.caseId,
        "incident_medical_evaluation_recorded",
        "gro_incident",
        incident.id,
        input.reason,
        before,
        record(incident),
        input.completedAt,
      );
      return { incident, audit };
    });
  }

  notifyIncidentParent(
    actor: M24Actor,
    input: {
      incidentId: string;
      notifiedAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "engagement.manage");
    return this.transaction((draft) => {
      const incident = findRequired(
        draft.incidents,
        input.incidentId,
        "Incident",
      );
      if (incident.version !== input.expectedVersion)
        throw new M24DomainError(
          "M24_VERSION_CONFLICT",
          "Incident version changed.",
        );
      const before = record(incident);
      incident.parentNotifiedAt = input.notifiedAt;
      incident.version += 1;
      const audit = this.audit(
        draft,
        actor,
        incident.caseId,
        "incident_parent_notified",
        "gro_incident",
        incident.id,
        input.reason,
        before,
        record(incident),
        input.notifiedAt,
      );
      return { incident, audit };
    });
  }

  completeCorrectiveAction(
    actor: M24Actor,
    input: {
      correctiveActionId: string;
      completedAt: string;
      evidence: string;
      reason: string;
    },
  ) {
    this.authorize(actor, "incident.close");
    return this.transaction((draft) => {
      const action = findRequired(
        draft.correctiveActions,
        input.correctiveActionId,
        "Corrective action",
      );
      const incident = findRequired(
        draft.incidents,
        action.incidentId,
        "Incident",
      );
      const before = record(action);
      action.status = "completed";
      action.completedAt = input.completedAt;
      action.completionEvidence = assertNonempty(
        input.evidence,
        "M24_CORRECTIVE_EVIDENCE_REQUIRED",
        "Corrective completion evidence is required.",
      );
      const audit = this.audit(
        draft,
        actor,
        incident.caseId,
        "corrective_action_completed",
        "corrective_action",
        action.id,
        input.reason,
        before,
        record(action),
        input.completedAt,
      );
      return { action, audit };
    });
  }

  closeIncident(
    actor: M24Actor,
    input: {
      incidentId: string;
      closedAt: string;
      reason: string;
      expectedVersion: number;
    },
  ) {
    this.authorize(actor, "incident.close");
    return this.transaction((draft) => {
      const incident = findRequired(
        draft.incidents,
        input.incidentId,
        "Incident",
      );
      if (incident.version !== input.expectedVersion)
        throw new M24DomainError(
          "M24_VERSION_CONFLICT",
          "Incident version changed.",
        );
      if (
        !incident.documentationCompletedAt ||
        incident.documentationTimely !== true
      )
        throw new M24DomainError(
          "M24_INCIDENT_DOCUMENTATION_GATE",
          "Timely one-hour documentation is required.",
        );
      if (!incident.debriefCompletedAt || incident.debriefTimely !== true)
        throw new M24DomainError(
          "M24_INCIDENT_DEBRIEF_GATE",
          "Timely 24-hour debrief is required.",
        );
      if (
        incident.medicalEvaluationRequired &&
        !incident.medicalEvaluationCompletedAt
      )
        throw new M24DomainError(
          "M24_MEDICAL_EVALUATION_GATE",
          "Required medical evaluation is incomplete.",
        );
      const corrections = incident.correctiveActionIds.map((id) =>
        findRequired(draft.correctiveActions, id, "Corrective action"),
      );
      if (corrections.some((item) => item.status !== "completed"))
        throw new M24DomainError(
          "M24_CORRECTIVE_ACTION_GATE",
          "Corrective actions remain open.",
        );
      if (incident.isRestraint) {
        if (
          !incident.interventionEndedAt ||
          !incident.stabilizedAt ||
          !incident.parentNotifiedAt ||
          !incident.supervisorReviewedAt
        ) {
          throw new M24DomainError(
            "M24_POST_INTERVENTION_EVIDENCE_GATE",
            "Post-intervention evidence is incomplete.",
          );
        }
        const observedUntil = new Date(
          Date.parse(incident.interventionEndedAt) + 15 * 60 * 1_000,
        ).toISOString();
        const post = evaluateGroPostIntervention({
          interventionKind: "personal-restraint",
          initiatedAt: incident.occurredAt,
          interventionEndedAt: incident.interventionEndedAt,
          stabilizedAt: incident.stabilizedAt,
          observedUntil,
          privateChildDiscussionAt: incident.debriefCompletedAt,
          caregiverDebriefAt: incident.debriefCompletedAt,
          caregiverDebriefAsSoonAsPossibleAttested: true,
          witnessesPresent: false,
          supervisorReviewedAt: incident.supervisorReviewedAt,
          incidentDocumentedAt: incident.documentationCompletedAt,
          parentNotifiedInWritingAt: incident.parentNotifiedAt,
        });
        if (!post.compliant)
          throw new M24DomainError(
            "M24_POST_INTERVENTION_POLICY_DENIED",
            post.reasonCodes.join(","),
          );
        incident.regulatoryReasonCodes = [
          ...new Set([...incident.regulatoryReasonCodes, ...post.reasonCodes]),
        ];
      }
      const before = record(incident);
      incident.status = "closed";
      incident.version += 1;
      const audit = this.audit(
        draft,
        actor,
        incident.caseId,
        "incident_closed",
        "gro_incident",
        incident.id,
        input.reason,
        before,
        record(incident),
        input.closedAt,
      );
      return { incident, audit };
    });
  }

  postRightsVersion(
    actor: M24Actor,
    input: {
      version: string;
      documentUrl: string;
      postedAt: string;
      reason: string;
    },
  ) {
    this.authorize(actor, "rights.manage");
    return this.transaction((draft) => {
      for (const posting of draft.rightsPostings) posting.active = false;
      const posting = {
        id: this.id(draft, "RIGHTS-POSTING"),
        version: input.version,
        documentUrl: input.documentUrl,
        postedAt: input.postedAt,
        postedBy: actor.id,
        active: true,
      };
      draft.rightsPostings.push(posting);
      const audit = this.audit(
        draft,
        actor,
        "GRO-RIGHTS",
        "rights_version_posted",
        "rights_posting",
        posting.id,
        input.reason,
        null,
        record(posting),
        input.postedAt,
      );
      return { posting, audit };
    });
  }

  recordRightsAcknowledgment(
    actor: M24Actor,
    input: {
      placementId: string;
      child: GroRightsRecipientEvidence;
      parent?: GroRightsRecipientEvidence;
      rightsDocumentUsesSimpleNonTechnicalTerms: boolean;
      acknowledgedAt: string;
      reason: string;
    },
  ) {
    this.authorize(actor, "rights.manage");
    return this.transaction((draft) => {
      const placement = findRequired(
        draft.placements,
        input.placementId,
        "Placement",
      );
      const posting = draft.rightsPostings.find((item) => item.active);
      if (!posting)
        throw new M24DomainError(
          "M24_RIGHTS_POSTING_REQUIRED",
          "An active rights posting is required.",
        );
      const policy = evaluateGroYouthRights({
        admittedAt: placement.admittedAt,
        rightsDocumentUsesSimpleNonTechnicalTerms:
          input.rightsDocumentUsesSimpleNonTechnicalTerms,
        parentConsentRequired: placement.parentConsentRequired,
        child: input.child,
        parent: input.parent,
      });
      const acknowledgment = {
        id: this.id(draft, "RIGHTS-ACK"),
        caseId: placement.caseId,
        youthId: placement.youthId,
        postingId: posting.id,
        compliant: policy.compliant,
        reasonCodes: [...policy.reasonCodes],
        acknowledgedAt: input.acknowledgedAt,
        recordedBy: actor.id,
      };
      draft.rightsAcknowledgments.push(acknowledgment);
      if (policy.compliant) {
        const task = draft.tasks.find(
          (item) =>
            item.sourceType === "placement" &&
            item.sourceId === placement.id &&
            item.title.startsWith("Complete youth-rights") &&
            item.status !== "completed",
        );
        if (task) {
          task.status = "completed";
          task.completedAt = input.acknowledgedAt;
          task.version += 1;
        }
      }
      const audit = this.audit(
        draft,
        actor,
        placement.caseId,
        policy.compliant
          ? "rights_acknowledgment_completed"
          : "rights_acknowledgment_failed",
        "rights_acknowledgment",
        acknowledgment.id,
        input.reason,
        null,
        record(acknowledgment),
        input.acknowledgedAt,
      );
      return { acknowledgment, policy, audit };
    });
  }

  recordEngagement(
    actor: M24Actor,
    input: {
      caseId: string;
      youthId: string;
      eventType: M24EngagementType;
      occurredAt: string;
      summary: string;
      details?: Record<string, string | number | boolean | null>;
      status?: "open" | "completed";
      reason: string;
    },
  ) {
    this.authorize(actor, "engagement.manage");
    return this.transaction((draft) => {
      const placement = draft.placements.find(
        (item) =>
          item.caseId === input.caseId &&
          item.youthId === input.youthId &&
          item.status !== "discharged",
      );
      if (!placement)
        throw new M24DomainError(
          "M24_ENGAGEMENT_YOUTH_NOT_PLACED",
          "Engagement youth has no matching placement.",
        );
      if (input.eventType === "transport" && !input.details?.destination)
        throw new M24DomainError(
          "M24_TRANSPORT_DESTINATION_REQUIRED",
          "Transportation requires a destination.",
        );
      if (input.eventType === "crisis" && !input.details?.responsePlan)
        throw new M24DomainError(
          "M24_CRISIS_RESPONSE_REQUIRED",
          "Crisis documentation requires a response plan.",
        );
      if (input.eventType === "discharge_coordination") {
        const required = [
          "familyConfirmed",
          "transportPlan",
          "medicationReconciled",
          "crisisPlan",
          "aftercarePlan",
        ];
        if (required.some((key) => !input.details?.[key]))
          throw new M24DomainError(
            "M24_DISCHARGE_COORDINATION_INCOMPLETE",
            "Discharge coordination is missing a required element.",
          );
      }
      const event = {
        id: this.id(draft, "ENGAGEMENT"),
        caseId: input.caseId,
        youthId: input.youthId,
        eventType: input.eventType,
        occurredAt: input.occurredAt,
        summary: input.summary,
        details: input.details ?? {},
        status: input.status ?? "completed",
        recordedBy: actor.id,
      };
      draft.engagementEvents.push(event);
      const audit = this.audit(
        draft,
        actor,
        input.caseId,
        `${input.eventType}_recorded`,
        "gro_engagement_event",
        event.id,
        input.reason,
        null,
        record(event),
        input.occurredAt,
      );
      return { event, audit };
    });
  }

  dashboard(at = this.now()): M24Dashboard {
    const state = this.state;
    const atMs = requireIso(at, "Dashboard time");
    const activePlacements = state.placements.filter(
      (item) => item.status !== "discharged",
    );
    const stageRows = state.stages.map((stage) => {
      const used = stage.currentCensus + stage.leaveCount;
      return {
        ...clone(stage),
        percentFull:
          stage.operationalCapacity > 0
            ? Math.round((used / stage.operationalCapacity) * 100)
            : 0,
        availableBeds: Math.max(0, stage.operationalCapacity - used),
      };
    });
    return {
      generatedAt: at,
      evidenceClass: M24_EVIDENCE_CLASS,
      census: {
        stages: stageRows,
        totalCensus: state.stages.reduce(
          (sum, item) => sum + item.currentCensus,
          0,
        ),
        totalCapacity: state.stages.reduce(
          (sum, item) => sum + item.operationalCapacity,
          0,
        ),
        activeAlerts: state.censusAlerts.filter(
          (item) => item.resolvedAt === null,
        ).length,
      },
      staffing: {
        evaluated: state.staffingEvaluations.length,
        noncompliant: state.staffingEvaluations.filter(
          (item) => !item.compliant,
        ).length,
      },
      shifts: {
        scheduled: state.shifts.filter((item) => item.status === "scheduled")
          .length,
        active: state.shifts.filter((item) => item.status === "active").length,
        pendingHandoffs: state.shiftHandoffs.filter(
          (item) => item.status !== "completed",
        ).length,
        openTasks: state.tasks.filter((item) => item.status !== "completed")
          .length,
      },
      medications: {
        scheduled: state.medications.filter(
          (item) => item.status === "scheduled",
        ).length,
        prnPending: state.medications.filter(
          (item) =>
            item.isPrn &&
            item.status === "administered" &&
            !item.prnEffectiveness,
        ).length,
        openDiscrepancies: state.medicationDiscrepancies.filter(
          (item) => item.status === "open",
        ).length,
        pendingHandoffs: state.medicationHandoffs.filter(
          (item) => item.status === "pending",
        ).length,
      },
      incidents: {
        open: state.incidents.filter((item) => item.status !== "closed").length,
        critical: state.incidents.filter(
          (item) =>
            ["L4", "L5"].includes(item.level) && item.status !== "closed",
        ).length,
        overdueDocumentation: state.incidents.filter(
          (item) =>
            !item.documentationCompletedAt &&
            Date.parse(item.documentationDueAt) < atMs,
        ).length,
        overdueDebriefs: state.incidents.filter(
          (item) =>
            !item.debriefCompletedAt && Date.parse(item.debriefDueAt) < atMs,
        ).length,
      },
      rights: {
        activePostingVersion:
          state.rightsPostings.find((item) => item.active)?.version ?? null,
        pendingAcknowledgments: activePlacements.filter(
          (placement) =>
            !state.rightsAcknowledgments.some(
              (ack) => ack.youthId === placement.youthId && ack.compliant,
            ),
        ).length,
      },
      engagement: {
        familyContacts: state.engagementEvents.filter(
          (item) => item.eventType === "family_contact",
        ).length,
        activities: state.engagementEvents.filter(
          (item) => item.eventType === "activity",
        ).length,
        transports: state.engagementEvents.filter(
          (item) => item.eventType === "transport",
        ).length,
        activeCrises: state.engagementEvents.filter(
          (item) => item.eventType === "crisis" && item.status === "open",
        ).length,
        dischargeCoordinations: state.engagementEvents.filter(
          (item) => item.eventType === "discharge_coordination",
        ).length,
      },
      auditEvents: state.auditEvents.length,
    };
  }

  scenarioSummary(results: readonly M24ScenarioResult[]): {
    passed: boolean;
    results: readonly M24ScenarioResult[];
  } {
    return {
      passed: results.length === 6 && results.every((item) => item.passed),
      results: clone(results),
    };
  }
}

let sharedM24GroEngine: M24GroEngine | undefined;

function getSharedM24GroEngine(): M24GroEngine {
  return (sharedM24GroEngine ??= new M24GroEngine());
}

export function isM24GroEngineInitialized(): boolean {
  return sharedM24GroEngine !== undefined;
}

/** Preserve the existing shared-engine API without creating synthetic state at
 * module load. The first permitted operation initializes the isolated
 * Demo/review engine; Production router gates reject before this proxy is read. */
export const m24GroEngine: M24GroEngine = new Proxy({} as M24GroEngine, {
  get(_target, property) {
    const engine = getSharedM24GroEngine();
    const value: unknown = Reflect.get(engine, property, engine);
    return typeof value === "function" ? value.bind(engine) : value;
  },
});
