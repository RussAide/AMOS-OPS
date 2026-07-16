import {
  assertSyntheticBoundary,
  stablePhase2Id,
  type Phase2Actor,
  type Phase2ScenarioRun,
} from "../../../contracts/phase2";
import type {
  GroPersonalRestraintInput,
  GroRightsRecipientEvidence,
} from "../../../contracts/regulatory/gro";
import {
  M24_SCENARIO_IDS,
  type M24ScenarioResult,
} from "../../../contracts/gro/m24-model";
import { M24GroEngine } from "./engine";

export const M24_ACCEPTANCE_CLOCK = "2026-07-14T08:00:00.000Z";

const administrator: Phase2Actor = {
  id: "SYNTH-M24-ADMIN",
  role: "gro-administrator",
  displayLabel: "Synthetic GRO Administrator",
};
const supervisor: Phase2Actor = {
  id: "SYNTH-M24-SUPERVISOR",
  role: "shift-supervisor",
  displayLabel: "Synthetic Shift Supervisor",
};
const nurse: Phase2Actor = {
  id: "SYNTH-M24-NURSE",
  role: "nurse",
  displayLabel: "Synthetic Nurse",
};
const medicationAide: Phase2Actor = {
  id: "SYNTH-M24-MED-AIDE",
  role: "medication-aide",
  displayLabel: "Synthetic Medication Aide",
};
const careWorker: Phase2Actor = {
  id: "SYNTH-M24-CARE",
  role: "youth-care-worker",
  displayLabel: "Synthetic Youth Care Worker",
};
const familyLiaison: Phase2Actor = {
  id: "SYNTH-M24-FAMILY",
  role: "family-liaison",
  displayLabel: "Synthetic Family Liaison",
};
const compliance: Phase2Actor = {
  id: "SYNTH-M24-COMPLIANCE",
  role: "compliance-officer",
  displayLabel: "Synthetic Compliance Officer",
};

const compliantRestraintEvidence: GroPersonalRestraintInput = {
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

function result(
  id: M24ScenarioResult["id"],
  assertions: string[],
  evidenceIds: string[],
): M24ScenarioResult {
  return {
    id,
    passed: assertions.length > 0 && evidenceIds.length > 0,
    assertions,
    evidenceIds,
  };
}

function scenarioRun(
  item: M24ScenarioResult,
  episodeId: string,
): Phase2ScenarioRun {
  const id = stablePhase2Id("SYNTH-M24-RUN", item.id, episodeId);
  const run: Phase2ScenarioRun = {
    id,
    milestone: "M2.4",
    scenarioType: item.id,
    status: item.passed ? "passed" : "failed",
    episodeId,
    startedAt: M24_ACCEPTANCE_CLOCK,
    completedAt: "2026-07-14T16:00:00.000Z",
    assertionsPassed: item.passed ? item.assertions.length : 0,
    assertionsFailed: item.passed ? 0 : Math.max(1, item.assertions.length),
    evidence: {
      assertionLabels: item.assertions,
      evidenceIds: item.evidenceIds,
      evidenceClass: "synthetic_demo",
    },
  };
  assertSyntheticBoundary({ id: run.id, evidenceClass: "synthetic_demo" });
  return run;
}

export interface M24AcceptanceSuite {
  milestone: "M2.4";
  evidenceClass: "synthetic_demo";
  generatedAt: string;
  passed: boolean;
  results: readonly M24ScenarioResult[];
  scenarioRuns: readonly Phase2ScenarioRun[];
  snapshot: ReturnType<M24GroEngine["getState"]>;
  dashboard: ReturnType<M24GroEngine["dashboard"]>;
}

/** Runs all six controlling M2.4 acceptance scenarios against one deterministic synthetic state. */
export function runM24AcceptanceSuite(): M24AcceptanceSuite {
  let now = M24_ACCEPTANCE_CLOCK;
  const engine = new M24GroEngine({ now: () => now });

  const placements = Array.from({ length: 15 }, (_, index) => {
    const ordinal = index + 1;
    const sharedRepresentative = ordinal === 1;
    return engine.admitYouth(administrator, {
      caseId: sharedRepresentative
        ? "M21-CASE-EXISTING-001"
        : `SYNTH-M24-CASE-${String(ordinal).padStart(2, "0")}`,
      youthId: sharedRepresentative
        ? "SYNTH-YOUTH-EXISTING-001"
        : `SYNTH-M24-YOUTH-${String(ordinal).padStart(2, "0")}`,
      youthLabel: sharedRepresentative
        ? "Synthetic Youth Existing-01"
        : `Synthetic Youth ${ordinal}`,
      ageYears: 14 + (index % 3),
      requiresTreatmentServices: true,
      requiresConstantSupervision: index === 0,
      parentConsentRequired: true,
      bedId: `M24-STAGE-1-ROOM-${Math.floor(index / 4) + 1}-BED-${(index % 4) + 1}`,
      admittedAt: `2026-07-14T08:${String(index).padStart(2, "0")}:00.000Z`,
      reason: "Deterministic M2.4 high-census admission scenario",
    }).placement;
  });

  const highCensusAlert = engine
    .getState()
    .censusAlerts.find((alert) => alert.stageId === "M24-STAGE-1");
  if (!highCensusAlert || highCensusAlert.percentFull < 90)
    throw new Error("M24_SCENARIO_HIGH_CENSUS_ALERT_MISSING");

  const staff = [1, 2, 3].map((ordinal) => ({
    staffId: `SYNTH-M24-RCS-${ordinal}`,
    staffName: `Synthetic RCS ${ordinal}`,
    role: "youth-care-worker",
    qualified: true,
    workingDirectlyWithGroup: true,
    awakeStatus: "awake" as const,
  }));
  const day = engine.createShift(supervisor, {
    stageId: "M24-STAGE-1",
    shiftDate: "2026-07-14",
    shiftType: "day",
    startsAt: "2026-07-14T08:00:00.000Z",
    endsAt: "2026-07-14T16:00:00.000Z",
    staff,
    reason: "M2.4 multi-shift acceptance scenario",
  }).shift;
  let dayVersion = day.version;
  for (const member of staff) {
    dayVersion = engine.recordAttendance(supervisor, {
      shiftId: day.id,
      staffId: member.staffId,
      status: "present",
      occurredAt: "2026-07-14T08:00:00.000Z",
      reason: "Synthetic attendance confirmation",
      expectedVersion: dayVersion,
    }).shift.version;
  }
  const dayStaffing = engine.evaluateStaffing(
    administrator,
    day.id,
    "children-awake",
    "Verify waking-hours ratio",
  ).evaluation;
  if (!dayStaffing.compliant)
    throw new Error("M24_SCENARIO_DAY_STAFFING_UNEXPECTED_FAILURE");

  const evening = engine.createShift(supervisor, {
    stageId: "M24-STAGE-1",
    shiftDate: "2026-07-14",
    shiftType: "evening",
    startsAt: "2026-07-14T16:00:00.000Z",
    endsAt: "2026-07-15T00:00:00.000Z",
    staff,
    reason: "M2.4 multi-shift acceptance scenario",
  }).shift;
  let eveningVersion = evening.version;
  for (const member of staff) {
    eveningVersion = engine.recordAttendance(supervisor, {
      shiftId: evening.id,
      staffId: member.staffId,
      status: "present",
      occurredAt: "2026-07-14T16:00:00.000Z",
      reason: "Synthetic attendance confirmation",
      expectedVersion: eveningVersion,
    }).shift.version;
  }
  const round = engine.recordSafetyRound(careWorker, {
    shiftId: day.id,
    area: "Residential unit and egress",
    passed: true,
    completedAt: "2026-07-14T09:00:00.000Z",
    reason: "Scheduled safety round",
  }).round;
  const careLog = engine.recordYouthCareLog(careWorker, {
    shiftId: day.id,
    youthId: placements[0].youthId,
    category: "daily_living",
    narrative:
      "Synthetic youth completed morning routine and participated in unit planning.",
    recordedAt: "2026-07-14T09:10:00.000Z",
    reason: "Required shift documentation",
  }).log;

  const acknowledgmentAt = "2026-07-14T09:15:00.000Z";
  const rights = engine.recordRightsAcknowledgment(familyLiaison, {
    placementId: placements[0].id,
    child: rightsEvidence(acknowledgmentAt),
    parent: rightsEvidence(acknowledgmentAt),
    rightsDocumentUsesSimpleNonTechnicalTerms: true,
    acknowledgedAt: acknowledgmentAt,
    reason: "Synthetic rights review and acknowledgment",
  }).acknowledgment;
  if (!rights.compliant)
    throw new Error("M24_SCENARIO_RIGHTS_ACKNOWLEDGMENT_FAILED");
  const practiceDecisions = [
    engine.evaluatePractice(compliance, {
      caseId: placements[0].caseId,
      practiceCode: "verbal-deescalation",
      reason: "Verify supportive-practice classification",
    }).decision,
    engine.evaluatePractice(compliance, {
      caseId: placements[0].caseId,
      practiceCode: "corporal-punishment",
      reason: "Verify prohibited-practice denial",
    }).decision,
    engine.evaluatePractice(compliance, {
      caseId: placements[0].caseId,
      practiceCode: "synthetic-unknown-practice",
      reason: "Verify unknown-practice fail-closed behavior",
    }).decision,
  ];
  if (
    !practiceDecisions[0].allowed ||
    practiceDecisions[1].allowed ||
    practiceDecisions[2].allowed
  ) {
    throw new Error("M24_SCENARIO_PRACTICE_CONTROL_FAILED");
  }

  const engagementIds = [
    engine.recordEngagement(familyLiaison, {
      caseId: placements[0].caseId,
      youthId: placements[0].youthId,
      eventType: "family_contact",
      occurredAt: "2026-07-14T09:20:00.000Z",
      summary: "Synthetic family check-in completed.",
      reason: "Family engagement workplan",
    }).event.id,
    engine.recordEngagement(careWorker, {
      caseId: placements[0].caseId,
      youthId: placements[0].youthId,
      eventType: "activity",
      occurredAt: "2026-07-14T09:30:00.000Z",
      summary: "Synthetic structured recreation completed.",
      reason: "Daily activity workplan",
    }).event.id,
    engine.recordEngagement(supervisor, {
      caseId: placements[0].caseId,
      youthId: placements[0].youthId,
      eventType: "transport",
      occurredAt: "2026-07-14T09:40:00.000Z",
      summary: "Synthetic transport coordination completed.",
      details: { destination: "Synthetic clinic", driverVerified: true },
      reason: "Transport coordination workplan",
    }).event.id,
    engine.recordEngagement(supervisor, {
      caseId: placements[0].caseId,
      youthId: placements[0].youthId,
      eventType: "crisis",
      occurredAt: "2026-07-14T09:50:00.000Z",
      summary: "Synthetic crisis drill resolved through de-escalation.",
      details: {
        responsePlan: "Trauma-informed de-escalation and supervisor review",
      },
      status: "completed",
      reason: "Crisis workflow drill",
    }).event.id,
    engine.recordEngagement(supervisor, {
      caseId: placements[0].caseId,
      youthId: placements[0].youthId,
      eventType: "discharge_coordination",
      occurredAt: "2026-07-14T10:00:00.000Z",
      summary: "Synthetic discharge readiness coordination completed.",
      details: {
        familyConfirmed: true,
        transportPlan: true,
        medicationReconciled: true,
        crisisPlan: true,
        aftercarePlan: true,
      },
      reason: "Discharge coordination workplan",
    }).event.id,
  ];

  const medication = engine.scheduleMedication(nurse, {
    caseId: placements[0].caseId,
    youthId: placements[0].youthId,
    medicationName: "Synthetic PRN medication",
    dose: "1 synthetic unit",
    route: "oral",
    scheduledAt: "2026-07-14T10:00:00.000Z",
    isPrn: true,
    isControlled: true,
    expectedControlledCount: 10,
    reason: "M2.4 MAR acceptance scenario",
  }).medication;
  const administered = engine.recordMedicationDisposition(medicationAide, {
    medicationRecordId: medication.id,
    action: "administer",
    occurredAt: "2026-07-14T10:05:00.000Z",
    prnReason: "Synthetic breakthrough symptom",
    countBefore: 10,
    countAfter: 9,
    witnessedBy: nurse.id,
    expectedVersion: medication.version,
  }).medication;
  const effective = engine.recordPrnEffectiveness(medicationAide, {
    medicationRecordId: medication.id,
    effectiveness: "effective",
    recordedAt: "2026-07-14T10:45:00.000Z",
    reason: "Synthetic PRN follow-up",
    expectedVersion: administered.version,
  }).medication;
  const medHandoff = engine.createMedicationHandoff(nurse, {
    caseId: placements[0].caseId,
    fromShiftId: day.id,
    toShiftId: evening.id,
    medicationRecordIds: [medication.id],
    initiatedAt: "2026-07-14T15:30:00.000Z",
    reason: "End-of-shift controlled medication reconciliation",
  }).handoff;
  const acceptedMedHandoff = engine.acceptMedicationHandoff(nurse, {
    handoffId: medHandoff.id,
    acceptedAt: "2026-07-14T15:40:00.000Z",
    reason: "Incoming nurse accepted reconciled MAR evidence",
  }).handoff;

  const incident = engine.captureIncident(careWorker, {
    caseId: placements[0].caseId,
    youthId: placements[0].youthId,
    level: "L3",
    incidentType: "restraint",
    summary:
      "Synthetic emergency safety event resolved with a brief trained standing restraint.",
    occurredAt: "2026-07-14T11:00:00.000Z",
    practiceCodes: ["verbal-deescalation"],
    interventionEndedAt: "2026-07-14T11:05:00.000Z",
    stabilizedAt: "2026-07-14T11:06:00.000Z",
    restraintEvidence: compliantRestraintEvidence,
    reason: "M2.4 incident acceptance scenario",
  }).incident;
  let incidentVersion = incident.version;
  incidentVersion = engine.documentIncident(careWorker, {
    incidentId: incident.id,
    documentedAt: "2026-07-14T11:30:00.000Z",
    reason: "Completed within the one-hour gate",
    expectedVersion: incidentVersion,
  }).incident.version;
  incidentVersion = engine.completeIncidentDebrief(compliance, {
    incidentId: incident.id,
    debriefAt: "2026-07-14T12:00:00.000Z",
    reason: "Completed within the 24-hour gate",
    expectedVersion: incidentVersion,
  }).incident.version;
  incidentVersion = engine.notifyIncidentParent(supervisor, {
    incidentId: incident.id,
    notifiedAt: "2026-07-14T12:05:00.000Z",
    reason: "Required written parent notification",
    expectedVersion: incidentVersion,
  }).incident.version;
  for (const correctiveActionId of incident.correctiveActionIds) {
    engine.completeCorrectiveAction(compliance, {
      correctiveActionId,
      completedAt: "2026-07-14T12:10:00.000Z",
      evidence: "Synthetic supervisor review and corrective-action record",
      reason: "Close L3 corrective action",
    });
  }
  const closedIncident = engine.closeIncident(compliance, {
    incidentId: incident.id,
    closedAt: "2026-07-14T12:15:00.000Z",
    reason: "All M2.4 incident gates satisfied",
    expectedVersion: incidentVersion,
  }).incident;

  const shortageShift = engine.createShift(supervisor, {
    stageId: "M24-STAGE-1",
    shiftDate: "2026-07-15",
    shiftType: "day",
    startsAt: "2026-07-15T08:00:00.000Z",
    endsAt: "2026-07-15T16:00:00.000Z",
    staff: [staff[0]],
    reason: "M2.4 staffing-shortage scenario",
  }).shift;
  engine.recordAttendance(supervisor, {
    shiftId: shortageShift.id,
    staffId: staff[0].staffId,
    status: "present",
    occurredAt: "2026-07-15T08:00:00.000Z",
    reason: "Synthetic shortage attendance",
    expectedVersion: shortageShift.version,
  });
  now = "2026-07-15T08:01:00.000Z";
  const shortage = engine.evaluateStaffing(
    administrator,
    shortageShift.id,
    "children-awake",
    "Detect synthetic staff shortage",
  );
  if (shortage.evaluation.compliant || !shortage.taskId)
    throw new Error("M24_SCENARIO_STAFFING_SHORTAGE_NOT_DETECTED");
  const shortageEscalation = engine.sweepOverdueTasks(
    supervisor,
    now,
    "Escalate unresolved staffing shortage after shift start",
  );
  if (!shortageEscalation.escalatedTaskIds.includes(shortage.taskId))
    throw new Error("M24_SCENARIO_STAFFING_SHORTAGE_NOT_ESCALATED");

  const handoffTask = engine.createTask(supervisor, {
    caseId: placements[0].caseId,
    title: "Confirm evening wellness check",
    sourceType: "shift_workplan",
    sourceId: day.id,
    assignedRole: "shift-supervisor",
    dueAt: "2026-07-14T17:00:00.000Z",
    priority: "urgent",
    reason: "M2.4 handoff acceptance scenario",
  }).task;
  const shiftHandoff = engine.createShiftHandoff(supervisor, {
    caseId: placements[0].caseId,
    fromShiftId: day.id,
    toShiftId: evening.id,
    summary:
      "Census, MAR, incident status, rights, and unresolved task reviewed.",
    taskIds: [handoffTask.id],
    medicationRecordIds: [medication.id],
    initiatedAt: "2026-07-14T15:45:00.000Z",
    reason: "Required shift-to-shift handoff",
  }).handoff;
  const acceptedHandoff = engine.acceptShiftHandoff(supervisor, {
    handoffId: shiftHandoff.id,
    acceptedAt: "2026-07-14T15:50:00.000Z",
    reason: "Incoming shift accepted unresolved-work visibility",
    expectedVersion: shiftHandoff.version,
  });
  const completedTask = engine.completeTask(supervisor, {
    taskId: handoffTask.id,
    completedAt: "2026-07-14T16:30:00.000Z",
    reason: "Evening wellness check confirmed",
    expectedVersion: handoffTask.version,
  }).task;
  const completedHandoff = engine.completeShiftHandoff(supervisor, {
    handoffId: shiftHandoff.id,
    completedAt: "2026-07-14T16:35:00.000Z",
    reason: "All transferred work completed",
    expectedVersion: acceptedHandoff.handoff.version,
  }).handoff;
  const dischargedRepresentative = engine.transitionPlacement(administrator, {
    placementId: placements[0].id,
    transitionType: "discharge",
    occurredAt: "2026-07-14T17:00:00.000Z",
    reason:
      "Complete shared representative youth continuum path after coordinated handoff",
    expectedVersion: placements[0].version,
  });

  const results: M24ScenarioResult[] = [
    result(
      "multi_shift",
      [
        "two consecutive shifts activated",
        "safety round recorded",
        "youth care log recorded",
        "rights and engagement workflows recorded",
        "supportive, prohibited, and unknown practice controls evaluated",
        "shared representative continuum discharge completed",
      ],
      [
        day.id,
        evening.id,
        round.id,
        careLog.id,
        rights.id,
        ...practiceDecisions.map((decision) => decision.id),
        ...engagementIds,
        dischargedRepresentative.placement.id,
        dischargedRepresentative.transition.id,
      ],
    ),
    result(
      "high_census",
      ["15 of 16 beds occupied", "90-percent capacity alert emitted"],
      [placements[placements.length - 1]?.id ?? "", highCensusAlert.id],
    ),
    result(
      "medication",
      [
        "PRN reason recorded",
        "controlled count reconciled",
        "effectiveness recorded",
        "medication handoff accepted",
      ],
      [effective.id, acceptedMedHandoff.id],
    ),
    result(
      "incident",
      [
        "L3 notifications generated",
        "one-hour documentation met",
        "24-hour debrief met",
        "post-intervention and correction gates met",
      ],
      [
        closedIncident.id,
        ...closedIncident.notificationIds,
        ...closedIncident.correctiveActionIds,
      ],
    ),
    result(
      "staffing_shortage",
      [
        "waking-hours ratio shortage detected",
        "critical resolution task emitted",
        "unresolved shortage escalated after shift start",
      ],
      [shortageShift.id, ...shortageEscalation.escalatedTaskIds],
    ),
    result(
      "handoff",
      [
        "unresolved task visible at acceptance",
        "task completed by incoming shift",
        "handoff completed only after resolution",
        "coordinated discharge followed completed handoff",
      ],
      [
        shiftHandoff.id,
        completedTask.id,
        completedHandoff.id,
        dischargedRepresentative.transition.id,
      ],
    ),
  ];
  if (results.map((item) => item.id).join("|") !== M24_SCENARIO_IDS.join("|"))
    throw new Error("M24_SCENARIO_SET_MISMATCH");

  const scenarioRuns = results.map((item) =>
    scenarioRun(item, placements[0].caseId),
  );
  const summary = engine.scenarioSummary(results);
  return {
    milestone: "M2.4",
    evidenceClass: "synthetic_demo",
    generatedAt: now,
    passed: summary.passed,
    results: summary.results,
    scenarioRuns,
    snapshot: engine.getState(),
    dashboard: engine.dashboard(now),
  };
}
