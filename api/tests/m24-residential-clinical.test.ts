import { describe, expect, it } from "vitest";
import type {
  GroPersonalRestraintInput,
  GroRightsRecipientEvidence,
} from "../../contracts/regulatory/gro";
import type { M24Actor, M24IncidentLevel } from "../../contracts/gro/m24-model";
import { M24GroEngine } from "../lib/m24-gro/engine";

const admin: M24Actor = { id: "SYNTH-ADMIN", role: "gro-administrator" };
const supervisor: M24Actor = {
  id: "SYNTH-SUPERVISOR",
  role: "shift-supervisor",
};
const careWorker: M24Actor = { id: "SYNTH-CARE", role: "youth-care-worker" };
const nurse: M24Actor = { id: "SYNTH-NURSE", role: "nurse" };
const medAide: M24Actor = { id: "SYNTH-MED-AIDE", role: "medication-aide" };
const compliance: M24Actor = {
  id: "SYNTH-COMPLIANCE",
  role: "compliance-officer",
};
const familyLiaison: M24Actor = { id: "SYNTH-FAMILY", role: "family-liaison" };

const restraintEvidence: GroPersonalRestraintInput = {
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
  operationCapacity: 16,
  childCondition: "stable",
};

function rightsEvidence(at: string): GroRightsRecipientEvidence {
  return {
    reviewedAt: at,
    writtenCopyProvidedAt: at,
    understandsEnglish: true,
    acknowledgmentSignedAt: at,
    acknowledgmentConfirmsReadAndUnderstands: true,
    acknowledgmentFiledInChildRecord: true,
  };
}

function setup() {
  const target = new M24GroEngine({ now: () => "2026-07-14T12:00:00.000Z" });
  const placement = target.admitYouth(admin, {
    caseId: "SYNTH-M24-CASE-1",
    youthId: "SYNTH-M24-YOUTH-1",
    youthLabel: "Synthetic Youth 1",
    ageYears: 16,
    requiresTreatmentServices: true,
    parentConsentRequired: true,
    bedId: "M24-STAGE-1-ROOM-1-BED-1",
    admittedAt: "2026-07-14T08:00:00.000Z",
    reason: "M2.4 clinical test admission",
  }).placement;
  const from = target.createShift(supervisor, {
    stageId: "M24-STAGE-1",
    shiftDate: "2026-07-14",
    shiftType: "day",
    startsAt: "2026-07-14T08:00:00.000Z",
    endsAt: "2026-07-14T16:00:00.000Z",
    staff: [
      {
        staffId: "SYNTH-CARE",
        staffName: "Synthetic Care",
        role: "youth-care-worker",
        qualified: true,
        workingDirectlyWithGroup: true,
        awakeStatus: "awake",
      },
    ],
    reason: "M2.4 clinical test shift",
  }).shift;
  const to = target.createShift(supervisor, {
    stageId: "M24-STAGE-1",
    shiftDate: "2026-07-14",
    shiftType: "evening",
    startsAt: "2026-07-14T16:00:00.000Z",
    endsAt: "2026-07-15T00:00:00.000Z",
    staff: [
      {
        staffId: "SYNTH-CARE-2",
        staffName: "Synthetic Care 2",
        role: "youth-care-worker",
        qualified: true,
        workingDirectlyWithGroup: true,
        awakeStatus: "awake",
      },
    ],
    reason: "M2.4 clinical test shift",
  }).shift;
  return { target, placement, from, to };
}

describe("M2.4 MAR, PRN, controlled count, and medication handoff", () => {
  it("records a witnessed controlled PRN count and timely effectiveness", () => {
    const { target, placement } = setup();
    const medication = target.scheduleMedication(nurse, {
      caseId: placement.caseId,
      youthId: placement.youthId,
      medicationName: "Synthetic PRN",
      dose: "1 unit",
      route: "oral",
      scheduledAt: "2026-07-14T10:00:00.000Z",
      isPrn: true,
      isControlled: true,
      expectedControlledCount: 10,
      reason: "Medication test",
    }).medication;
    const administered = target.recordMedicationDisposition(medAide, {
      medicationRecordId: medication.id,
      action: "administer",
      occurredAt: "2026-07-14T10:05:00.000Z",
      prnReason: "Synthetic symptom",
      countBefore: 10,
      countAfter: 9,
      witnessedBy: nurse.id,
      expectedVersion: medication.version,
    });
    expect(administered.discrepancy).toBeNull();
    expect(administered.medication).toMatchObject({
      status: "administered",
      countBefore: 10,
      countAfter: 9,
      witnessedBy: nurse.id,
    });
    const followUp = target.recordPrnEffectiveness(medAide, {
      medicationRecordId: medication.id,
      effectiveness: "effective",
      recordedAt: "2026-07-14T10:45:00.000Z",
      reason: "Required PRN follow-up",
      expectedVersion: administered.medication.version,
    });
    expect(followUp).toMatchObject({
      timely: true,
      medication: { prnEffectiveness: "effective" },
    });
  });

  it("opens a count discrepancy, blocks handoff, then permits it after reconciliation", () => {
    const { target, placement, from, to } = setup();
    const medication = target.scheduleMedication(nurse, {
      caseId: placement.caseId,
      youthId: placement.youthId,
      medicationName: "Synthetic controlled medication",
      dose: "1 unit",
      route: "oral",
      scheduledAt: "2026-07-14T10:00:00.000Z",
      isControlled: true,
      expectedControlledCount: 10,
      reason: "Discrepancy test",
    }).medication;
    const administered = target.recordMedicationDisposition(medAide, {
      medicationRecordId: medication.id,
      action: "administer",
      occurredAt: "2026-07-14T10:05:00.000Z",
      countBefore: 10,
      countAfter: 8,
      witnessedBy: nurse.id,
      expectedVersion: medication.version,
    });
    expect(administered.discrepancy).toMatchObject({
      status: "open",
      expectedCountAfter: 9,
      actualCountAfter: 8,
    });
    const handoff = target.createMedicationHandoff(nurse, {
      caseId: placement.caseId,
      fromShiftId: from.id,
      toShiftId: to.id,
      medicationRecordIds: [medication.id],
      initiatedAt: "2026-07-14T15:30:00.000Z",
      reason: "Medication handoff test",
    }).handoff;
    expect(() =>
      target.acceptMedicationHandoff(nurse, {
        handoffId: handoff.id,
        acceptedAt: "2026-07-14T15:35:00.000Z",
        reason: "Premature acceptance",
      }),
    ).toThrowError(
      expect.objectContaining({ code: "M24_MED_HANDOFF_UNRESOLVED" }),
    );
    target.resolveMedicationDiscrepancy(nurse, {
      discrepancyId: administered.discrepancy?.id ?? "missing",
      resolution: "Synthetic recount confirmed actual balance of eight",
      resolvedAt: "2026-07-14T15:40:00.000Z",
      reason: "Reconciled discrepancy",
    });
    expect(
      target.acceptMedicationHandoff(nurse, {
        handoffId: handoff.id,
        acceptedAt: "2026-07-14T15:45:00.000Z",
        reason: "Resolved medication handoff",
      }).handoff.status,
    ).toBe("accepted");
  });

  it("requires a reason for refusals, omissions, and holds", () => {
    const { target, placement } = setup();
    const medication = target.scheduleMedication(nurse, {
      caseId: placement.caseId,
      youthId: placement.youthId,
      medicationName: "Synthetic scheduled medication",
      dose: "1 unit",
      route: "oral",
      scheduledAt: "2026-07-14T10:00:00.000Z",
      reason: "Disposition test",
    }).medication;
    expect(() =>
      target.recordMedicationDisposition(medAide, {
        medicationRecordId: medication.id,
        action: "refuse",
        occurredAt: "2026-07-14T10:05:00.000Z",
        expectedVersion: medication.version,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "M24_MEDICATION_REASON_REQUIRED" }),
    );
    expect(
      target.recordMedicationDisposition(medAide, {
        medicationRecordId: medication.id,
        action: "refuse",
        occurredAt: "2026-07-14T10:05:00.000Z",
        reason: "Youth declined after education",
        expectedVersion: medication.version,
      }).medication,
    ).toMatchObject({
      status: "refused",
      dispositionReason: "Youth declined after education",
    });
  });
});

describe("M2.4 incidents, rights, practices, and continuum coordination", () => {
  it("routes L1 through L5 incidents to progressively broader notification sets", () => {
    const expectedCounts: Record<M24IncidentLevel, number> = {
      L1: 1,
      L2: 2,
      L3: 3,
      L4: 4,
      L5: 5,
    };
    for (const level of Object.keys(expectedCounts) as M24IncidentLevel[]) {
      const { target, placement } = setup();
      const captured = target.captureIncident(careWorker, {
        caseId: placement.caseId,
        youthId: placement.youthId,
        level,
        incidentType: "safety",
        summary: `Synthetic ${level} incident`,
        occurredAt: "2026-07-14T11:00:00.000Z",
        reason: "Incident routing test",
      });
      expect(captured.notifications).toHaveLength(expectedCounts[level]);
      expect(captured.incident.notificationIds).toHaveLength(
        expectedCounts[level],
      );
    }
  });

  it("marks documentation after one hour and debrief after 24 hours as untimely", () => {
    const { target, placement } = setup();
    const incident = target.captureIncident(careWorker, {
      caseId: placement.caseId,
      youthId: placement.youthId,
      level: "L2",
      incidentType: "behavioral",
      summary: "Synthetic behavioral incident",
      occurredAt: "2026-07-14T10:00:00.000Z",
      reason: "Deadline test",
    }).incident;
    const documented = target.documentIncident(careWorker, {
      incidentId: incident.id,
      documentedAt: "2026-07-14T11:00:01.000Z",
      reason: "Late documentation test",
      expectedVersion: incident.version,
    }).incident;
    const debriefed = target.completeIncidentDebrief(compliance, {
      incidentId: incident.id,
      debriefAt: "2026-07-15T10:00:01.000Z",
      reason: "Late debrief test",
      expectedVersion: documented.version,
    }).incident;
    expect(documented.documentationTimely).toBe(false);
    expect(debriefed.debriefTimely).toBe(false);
    expect(() =>
      target.closeIncident(compliance, {
        incidentId: incident.id,
        closedAt: "2026-07-15T11:00:00.000Z",
        reason: "Attempt close",
        expectedVersion: debriefed.version,
      }),
    ).toThrowError(
      expect.objectContaining({ code: "M24_INCIDENT_DOCUMENTATION_GATE" }),
    );
  });

  it("closes a restraint incident only after one-hour, 24-hour, parent, and corrective gates", () => {
    const { target, placement } = setup();
    const captured = target.captureIncident(careWorker, {
      caseId: placement.caseId,
      youthId: placement.youthId,
      level: "L3",
      incidentType: "restraint",
      summary: "Synthetic trained standing restraint",
      occurredAt: "2026-07-14T10:00:00.000Z",
      practiceCodes: ["verbal-deescalation"],
      interventionEndedAt: "2026-07-14T10:05:00.000Z",
      stabilizedAt: "2026-07-14T10:06:00.000Z",
      restraintEvidence,
      reason: "Restraint gate test",
    }).incident;
    let version = target.documentIncident(careWorker, {
      incidentId: captured.id,
      documentedAt: "2026-07-14T10:30:00.000Z",
      reason: "Timely documentation",
      expectedVersion: captured.version,
    }).incident.version;
    version = target.completeIncidentDebrief(compliance, {
      incidentId: captured.id,
      debriefAt: "2026-07-14T11:00:00.000Z",
      reason: "Timely debrief",
      expectedVersion: version,
    }).incident.version;
    version = target.notifyIncidentParent(supervisor, {
      incidentId: captured.id,
      notifiedAt: "2026-07-14T11:05:00.000Z",
      reason: "Written parent notification",
      expectedVersion: version,
    }).incident.version;
    for (const correctiveActionId of captured.correctiveActionIds) {
      target.completeCorrectiveAction(compliance, {
        correctiveActionId,
        completedAt: "2026-07-14T11:10:00.000Z",
        evidence: "Synthetic corrective review",
        reason: "Corrective action gate",
      });
    }
    expect(
      target.closeIncident(compliance, {
        incidentId: captured.id,
        closedAt: "2026-07-14T11:15:00.000Z",
        reason: "All gates complete",
        expectedVersion: version,
      }).incident,
    ).toMatchObject({
      status: "closed",
      documentationTimely: true,
      debriefTimely: true,
    });
  });

  it("completes the admission rights task from a compliant child and parent acknowledgment", () => {
    const { target, placement } = setup();
    const at = "2026-07-14T09:00:00.000Z";
    const decision = target.recordRightsAcknowledgment(familyLiaison, {
      placementId: placement.id,
      child: rightsEvidence(at),
      parent: rightsEvidence(at),
      rightsDocumentUsesSimpleNonTechnicalTerms: true,
      acknowledgedAt: at,
      reason: "Rights test",
    });
    expect(decision.acknowledgment.compliant).toBe(true);
    expect(
      target.getState().tasks.find((item) => item.sourceId === placement.id),
    ).toMatchObject({ status: "completed", completedAt: at });
  });

  it("allows supportive practices and fail-closes prohibited or unknown practices", () => {
    const { target, placement } = setup();
    expect(
      target.evaluatePractice(compliance, {
        caseId: placement.caseId,
        practiceCode: "verbal-deescalation",
        reason: "Practice test",
      }).decision,
    ).toMatchObject({ allowed: true, classification: "supportive" });
    expect(
      target.evaluatePractice(compliance, {
        caseId: placement.caseId,
        practiceCode: "corporal-punishment",
        reason: "Practice test",
      }).decision,
    ).toMatchObject({ allowed: false, classification: "prohibited" });
    expect(
      target.evaluatePractice(compliance, {
        caseId: placement.caseId,
        practiceCode: "synthetic-unknown",
        reason: "Practice test",
      }).decision,
    ).toMatchObject({ allowed: false, classification: "unknown" });
  });

  it("records family, activity, transport, crisis, and discharge coordination in one case history", () => {
    const { target, placement } = setup();
    const events = [
      target.recordEngagement(familyLiaison, {
        caseId: placement.caseId,
        youthId: placement.youthId,
        eventType: "family_contact",
        occurredAt: "2026-07-14T09:00:00.000Z",
        summary: "Family contact",
        reason: "Continuum test",
      }),
      target.recordEngagement(careWorker, {
        caseId: placement.caseId,
        youthId: placement.youthId,
        eventType: "activity",
        occurredAt: "2026-07-14T09:10:00.000Z",
        summary: "Structured activity",
        reason: "Continuum test",
      }),
      target.recordEngagement(supervisor, {
        caseId: placement.caseId,
        youthId: placement.youthId,
        eventType: "transport",
        occurredAt: "2026-07-14T09:20:00.000Z",
        summary: "Transport",
        details: { destination: "Synthetic clinic" },
        reason: "Continuum test",
      }),
      target.recordEngagement(supervisor, {
        caseId: placement.caseId,
        youthId: placement.youthId,
        eventType: "crisis",
        occurredAt: "2026-07-14T09:30:00.000Z",
        summary: "Crisis response",
        details: { responsePlan: "Synthetic plan" },
        reason: "Continuum test",
      }),
      target.recordEngagement(supervisor, {
        caseId: placement.caseId,
        youthId: placement.youthId,
        eventType: "discharge_coordination",
        occurredAt: "2026-07-14T09:40:00.000Z",
        summary: "Discharge coordination",
        details: {
          familyConfirmed: true,
          transportPlan: true,
          medicationReconciled: true,
          crisisPlan: true,
          aftercarePlan: true,
        },
        reason: "Continuum test",
      }),
    ];
    expect(events.map((item) => item.event.eventType)).toEqual([
      "family_contact",
      "activity",
      "transport",
      "crisis",
      "discharge_coordination",
    ]);
    expect(target.dashboard().engagement).toMatchObject({
      familyContacts: 1,
      activities: 1,
      transports: 1,
      activeCrises: 0,
      dischargeCoordinations: 1,
    });
  });
});
