import { describe, expect, it } from "vitest";
import type { M24Actor } from "../../contracts/gro/m24-model";
import { M24DomainError, M24GroEngine } from "../lib/m24-gro/engine";

const admin: M24Actor = { id: "SYNTH-ADMIN", role: "gro-administrator" };
const supervisor: M24Actor = {
  id: "SYNTH-SUPERVISOR",
  role: "shift-supervisor",
};
const careWorker: M24Actor = { id: "SYNTH-CARE", role: "youth-care-worker" };

function engine(at = "2026-07-14T12:00:00.000Z") {
  return new M24GroEngine({ now: () => at });
}

function admit(target: M24GroEngine, ordinal: number, treatment = true) {
  return target.admitYouth(admin, {
    caseId: `SYNTH-CASE-${ordinal}`,
    youthId: `SYNTH-YOUTH-${ordinal}`,
    youthLabel: `Synthetic Youth ${ordinal}`,
    ageYears: 15,
    requiresTreatmentServices: treatment,
    bedId: `M24-STAGE-1-ROOM-${Math.floor((ordinal - 1) / 4) + 1}-BED-${((ordinal - 1) % 4) + 1}`,
    admittedAt: `2026-07-14T08:${String(ordinal).padStart(2, "0")}:00.000Z`,
    reason: "M2.4 test admission",
  }).placement;
}

function shift(target: M24GroEngine, staffCount: number, date = "2026-07-14") {
  return target.createShift(supervisor, {
    stageId: "M24-STAGE-1",
    shiftDate: date,
    shiftType: "day",
    startsAt: `${date}T08:00:00.000Z`,
    endsAt: `${date}T16:00:00.000Z`,
    staff: Array.from({ length: staffCount }, (_, index) => ({
      staffId: `SYNTH-STAFF-${date}-${index + 1}`,
      staffName: `Synthetic Staff ${index + 1}`,
      role: "youth-care-worker",
      qualified: true,
      workingDirectlyWithGroup: true,
      awakeStatus: "awake" as const,
    })),
    reason: "M2.4 test shift",
  }).shift;
}

function markPresent(target: M24GroEngine, shiftId: string) {
  let current = target.getState().shifts.find((item) => item.id === shiftId);
  if (!current) throw new Error("shift missing");
  for (const member of current.staff) {
    current = target.recordAttendance(supervisor, {
      shiftId,
      staffId: member.staffId,
      status: "present",
      occurredAt: current.startsAt,
      reason: "M2.4 attendance test",
      expectedVersion: current.version,
    }).shift;
  }
}

describe("M2.4 census, beds, rooms, and three-stage lifecycle", () => {
  it("starts with three stages, 12 rooms, 48 beds, and no residents", () => {
    const state = engine().getState();
    expect(state.stages).toHaveLength(3);
    expect(state.rooms).toHaveLength(12);
    expect(state.beds).toHaveLength(48);
    expect(state.placements).toHaveLength(0);
  });

  it("atomically occupies a bed, creates a rights task, and writes correlated audit evidence", () => {
    const target = engine();
    const placement = admit(target, 1);
    const state = target.getState();
    expect(
      state.beds.find((item) => item.id === placement.bedId),
    ).toMatchObject({ status: "occupied", youthId: placement.youthId });
    expect(state.stages[0].currentCensus).toBe(1);
    expect(state.tasks[0]).toMatchObject({
      caseId: placement.caseId,
      assignedRole: "family-liaison",
    });
    expect(state.auditEvents[0]).toMatchObject({
      domain: "GRO",
      evidenceClass: "synthetic_demo",
      action: "youth_admitted",
    });
    expect(state.auditEvents[0].correlationId).toMatch(/^M24-CORR-/);
  });

  it("emits the real-time 90-percent alert at 15 of 16 occupied beds", () => {
    const target = engine();
    for (let ordinal = 1; ordinal <= 15; ordinal += 1) admit(target, ordinal);
    expect(target.dashboard().census.stages[0]).toMatchObject({
      currentCensus: 15,
      percentFull: 94,
      availableBeds: 1,
    });
    expect(target.getState().censusAlerts).toEqual([
      expect.objectContaining({
        alertType: "capacity_90_percent",
        currentCensus: 15,
        percentFull: 94,
      }),
    ]);
  });

  it("supports leave, return, cross-stage transfer, and discharge only after coordination", () => {
    const target = engine();
    let placement = admit(target, 1);
    placement = target.transitionPlacement(admin, {
      placementId: placement.id,
      transitionType: "leave",
      occurredAt: "2026-07-14T10:00:00.000Z",
      reason: "Approved therapeutic leave",
      expectedVersion: placement.version,
    }).placement;
    expect(target.dashboard().census.stages[0]).toMatchObject({
      currentCensus: 0,
      percentFull: 6,
    });
    placement = target.transitionPlacement(admin, {
      placementId: placement.id,
      transitionType: "return",
      occurredAt: "2026-07-14T11:00:00.000Z",
      reason: "Returned from leave",
      expectedVersion: placement.version,
    }).placement;
    placement = target.transitionPlacement(admin, {
      placementId: placement.id,
      transitionType: "transfer",
      toBedId: "M24-STAGE-2-ROOM-1-BED-1",
      occurredAt: "2026-07-14T12:00:00.000Z",
      reason: "Synthetic stage transfer",
      expectedVersion: placement.version,
    }).placement;
    expect(() =>
      target.transitionPlacement(admin, {
        placementId: placement.id,
        transitionType: "discharge",
        occurredAt: "2026-07-14T13:00:00.000Z",
        reason: "Attempted discharge",
        expectedVersion: placement.version,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "M24_DISCHARGE_COORDINATION_REQUIRED" }),
    );
    target.recordEngagement(supervisor, {
      caseId: placement.caseId,
      youthId: placement.youthId,
      eventType: "discharge_coordination",
      occurredAt: "2026-07-14T13:05:00.000Z",
      summary: "Discharge package completed",
      details: {
        familyConfirmed: true,
        transportPlan: true,
        medicationReconciled: true,
        crisisPlan: true,
        aftercarePlan: true,
      },
      reason: "Discharge gate test",
    });
    const discharged = target.transitionPlacement(admin, {
      placementId: placement.id,
      transitionType: "discharge",
      occurredAt: "2026-07-14T14:00:00.000Z",
      reason: "Coordinated discharge",
      expectedVersion: placement.version,
    }).placement;
    expect(discharged.status).toBe("discharged");
  });

  it("denies census mutation to an unauthorized direct-care role", () => {
    expect(() =>
      engine().admitYouth(careWorker, {
        caseId: "SYNTH-CASE-DENIED",
        youthId: "SYNTH-YOUTH-DENIED",
        youthLabel: "Synthetic Youth",
        ageYears: 15,
        requiresTreatmentServices: true,
        bedId: "M24-STAGE-1-ROOM-1-BED-1",
        admittedAt: "2026-07-14T08:00:00.000Z",
        reason: "Authorization test",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "M24_ROLE_FORBIDDEN",
      } satisfies Partial<M24DomainError>),
    );
  });
});

describe("M2.4 staffing, work, escalation, and handoff", () => {
  it("passes a waking-hours treatment ratio with sufficient qualified present staff", () => {
    const target = engine();
    for (let ordinal = 1; ordinal <= 10; ordinal += 1) admit(target, ordinal);
    const row = shift(target, 2);
    markPresent(target, row.id);
    expect(
      target.evaluateStaffing(admin, row.id, "children-awake").evaluation,
    ).toMatchObject({ compliant: true, requiredAdditionalCapacityUnits: 0 });
  });

  it("detects a shortage and creates a critical resolution task and notification", () => {
    const target = engine();
    for (let ordinal = 1; ordinal <= 6; ordinal += 1) admit(target, ordinal);
    const row = shift(target, 1);
    markPresent(target, row.id);
    const decision = target.evaluateStaffing(admin, row.id, "children-awake");
    expect(decision.evaluation.compliant).toBe(false);
    expect(
      target.getState().tasks.find((item) => item.id === decision.taskId),
    ).toMatchObject({ priority: "critical", assignedRole: "shift-supervisor" });
    expect(target.getState().notifications).toEqual([
      expect.objectContaining({
        targetRole: "gro-administrator",
        priority: "critical",
      }),
    ]);
  });

  it("escalates overdue work deterministically", () => {
    const target = engine();
    const task = target.createTask(supervisor, {
      caseId: "SYNTH-CASE-1",
      title: "Complete unresolved shift work",
      sourceType: "shift",
      sourceId: "SYNTH-SHIFT",
      assignedRole: "shift-supervisor",
      dueAt: "2026-07-14T09:00:00.000Z",
      reason: "Escalation test",
    }).task;
    expect(
      target.sweepOverdueTasks(
        supervisor,
        "2026-07-14T10:00:00.000Z",
        "Hourly sweep",
      ).escalatedTaskIds,
    ).toContain(task.id);
    expect(target.getState().tasks[0]).toMatchObject({
      status: "escalated",
      escalationLevel: "supervisor",
    });
  });

  it("prevents handoff completion until transferred work is resolved", () => {
    const target = engine();
    const from = shift(target, 1, "2026-07-14");
    const to = shift(target, 1, "2026-07-15");
    const task = target.createTask(supervisor, {
      caseId: "SYNTH-CASE-HANDOFF",
      title: "Confirm wellness check",
      sourceType: "shift",
      sourceId: from.id,
      assignedRole: "shift-supervisor",
      dueAt: "2026-07-14T17:00:00.000Z",
      reason: "Handoff test",
    }).task;
    const initiated = target.createShiftHandoff(supervisor, {
      caseId: task.caseId,
      fromShiftId: from.id,
      toShiftId: to.id,
      summary: "Transfer unresolved wellness check",
      taskIds: [task.id],
      initiatedAt: "2026-07-14T15:45:00.000Z",
      reason: "Handoff test",
    }).handoff;
    const accepted = target.acceptShiftHandoff(supervisor, {
      handoffId: initiated.id,
      acceptedAt: "2026-07-14T15:50:00.000Z",
      reason: "Incoming shift acceptance",
      expectedVersion: initiated.version,
    });
    expect(accepted.unresolvedTaskIds).toEqual([task.id]);
    expect(() =>
      target.completeShiftHandoff(supervisor, {
        handoffId: initiated.id,
        completedAt: "2026-07-14T16:00:00.000Z",
        reason: "Premature completion",
        expectedVersion: accepted.handoff.version,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "M24_HANDOFF_UNRESOLVED_TASKS" }),
    );
    target.completeTask(supervisor, {
      taskId: task.id,
      completedAt: "2026-07-14T16:10:00.000Z",
      reason: "Resolved",
      expectedVersion: task.version,
    });
    expect(
      target.completeShiftHandoff(supervisor, {
        handoffId: initiated.id,
        completedAt: "2026-07-14T16:15:00.000Z",
        reason: "Resolved handoff",
        expectedVersion: accepted.handoff.version,
      }).handoff.status,
    ).toBe("completed");
  });
});
