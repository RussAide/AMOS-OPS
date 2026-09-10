import type { M24Actor, M24Shift } from "../../contracts/gro/m24-model";
import type {
  CypressS6AdministratorBenchmark,
  CypressS6AuditEvent,
  CypressS6ContinuityStepId,
  CypressS6CorrectiveActionStep,
  CypressS6Exception,
  CypressS6PlacementContinuity,
  CypressS6PreviewResult,
  CypressS6PreviewScenario,
  CypressS6StaffingControl,
  CypressS6Status,
  CypressS6WorkforceCompetency,
  CypressS6WorkforceControl,
} from "../../contracts/doctrine/cypress-admin-workforce-stability";
import { M24GroEngine } from "../lib/m24-gro/engine";
import { runM33SyntheticSuite } from "../services/m33";

const LICENSED_CAPACITY = 10 as const;
const FUTURE_CAPACITY = 16 as const;
const AT = "2026-09-09T17:45:00.000Z";
const ADMIN: M24Actor = { id: "SYNTH-S6-ADMIN", role: "gro-administrator" };
const SUPERVISOR: M24Actor = {
  id: "SYNTH-S6-SUPERVISOR",
  role: "shift-supervisor",
};

const BENCHMARKS: ReadonlyArray<
  Pick<CypressS6AdministratorBenchmark, "id" | "label" | "benchmark">
> = [
  {
    id: "ON_SITE_LEADERSHIP",
    label: "On-site leadership",
    benchmark: "Verified leadership presence, availability, and owned launch work.",
  },
  {
    id: "REFERRAL_RESPONSIVENESS",
    label: "Referral responsiveness",
    benchmark: "Referral decisions are timely, evidenced, and aligned to approved target-population doctrine.",
  },
  {
    id: "STAFFING_READINESS",
    label: "Staffing readiness",
    benchmark: "Qualified, cleared staff and required supervision capacity are available for the active census and acuity mix.",
  },
  {
    id: "HIGH_ACUITY_EXECUTION",
    label: "High-acuity execution",
    benchmark: "Leadership demonstrates crisis judgment, resource matching, support modification, and placement-stability execution.",
  },
  {
    id: "COMPLIANCE_REPORTING",
    label: "Compliance & reporting",
    benchmark: "Required records, reporting, escalation, and Governing Body directives are completed with evidence.",
  },
];

const COMPETENCIES: ReadonlyArray<{
  id: CypressS6WorkforceCompetency["id"];
  evidence: string;
}> = [
  { id: "RAPPORT", evidence: "SYNTH-S6-COMP-RAPPORT" },
  { id: "DE_ESCALATION", evidence: "SYNTH-S6-COMP-DEESC" },
  { id: "RESILIENCE", evidence: "SYNTH-S6-COMP-RESILIENCE" },
  { id: "SUPERVISION_DISCIPLINE", evidence: "SYNTH-S6-COMP-SUPERVISION" },
  { id: "DOCUMENTATION", evidence: "SYNTH-S6-COMP-DOCUMENTATION" },
  { id: "CRISIS_JUDGMENT", evidence: "SYNTH-S6-COMP-CRISIS" },
  { id: "RELIABILITY", evidence: "SYNTH-S6-COMP-RELIABILITY" },
  { id: "TEAMWORK", evidence: "SYNTH-S6-COMP-TEAMWORK" },
];

const SUPPORT_CHANGES = [
  "Increase supervision to 2:1 during transition window",
  "Revise crisis-prevention and elopement-response plan",
  "Complete clinical/hospital coordination before return",
  "Confirm qualified staffing and relief coverage",
] as const;

function administratorBenchmarks(
  scenario: CypressS6PreviewScenario,
): readonly CypressS6AdministratorBenchmark[] {
  return BENCHMARKS.map((item) => {
    const missed =
      scenario === "administrator_benchmark_exception" &&
      item.id === "STAFFING_READINESS";
    return {
      ...item,
      owner: "GRO_ADMINISTRATOR",
      actual: missed
        ? "Required staffing-readiness evidence missed the controlled benchmark."
        : "Synthetic evidence demonstrates the benchmark for this controlled scenario.",
      state: missed ? "MISSED" : "MEETS",
      evidenceRefs: missed
        ? ["SYNTH-S6-ADMIN-STAFFING-GAP-001"]
        : [`SYNTH-S6-ADMIN-${item.id}-001`],
    };
  });
}

function correctiveAction(
  scenario: CypressS6PreviewScenario,
): readonly CypressS6CorrectiveActionStep[] {
  if (scenario !== "administrator_benchmark_exception") return [];
  return [
    {
      id: "EVIDENCE_ASSEMBLED",
      state: "COMPLETE",
      evidenceRefs: ["SYNTH-S6-ADMIN-STAFFING-GAP-001"],
    },
    {
      id: "MANAGEMENT_REVIEW",
      state: "COMPLETE",
      evidenceRefs: ["SYNTH-S6-MGMT-REVIEW-001"],
    },
    {
      id: "CORRECTIVE_ACTION",
      state: "COMPLETE",
      evidenceRefs: ["SYNTH-S6-CAP-001"],
    },
    {
      id: "FOLLOW_UP",
      state: "PENDING",
      evidenceRefs: ["SYNTH-S6-FOLLOWUP-DUE-001"],
    },
    { id: "CLOSE_OR_ESCALATE", state: "NOT_REACHED", evidenceRefs: [] },
  ];
}

function workforceControl(
  scenario: CypressS6PreviewScenario,
): CypressS6WorkforceControl {
  const foundation = runM33SyntheticSuite();
  const clearanceReady = scenario !== "workforce_clearance_gap";
  return {
    foundation: "M3.3_WORKFORCE",
    recruitmentToReleaseGatesPassed: foundation.snapshot.lifecycleGates.every(
      (gate) => gate.status === "passed",
    ),
    credentialRequirementTypesCovered: new Set(
      foundation.snapshot.requirements.map((requirement) => requirement.type),
    ).size,
    annualTrainingCompliant: foundation.snapshot.annualTraining.every(
      (summary) => summary.compliant,
    ),
    personnelAccessControlled:
      foundation.snapshot.accessDecisions.some(
        (decision) => decision.decision === "allowed",
      ) &&
      foundation.snapshot.accessDecisions.some(
        (decision) => decision.decision === "denied",
      ),
    clearanceReady,
    releaseToDutyAllowed: clearanceReady,
    competencies: COMPETENCIES.map((competency) => ({
      id: competency.id,
      verified: clearanceReady,
      evidenceRefs: clearanceReady ? [competency.evidence] : [],
    })),
  };
}

function m24BedId(ordinal: number): string {
  const room = Math.floor((ordinal - 1) / 4) + 1;
  const bed = ((ordinal - 1) % 4) + 1;
  return `M24-STAGE-1-ROOM-${room}-BED-${bed}`;
}

function staffingControl(
  scenario: CypressS6PreviewScenario,
): CypressS6StaffingControl {
  const evaluatedCensus = 6;
  const qualifiedPresentStaff = scenario === "workforce_clearance_gap" ? 1 : 2;
  const engine = new M24GroEngine({ now: () => AT });

  for (let ordinal = 1; ordinal <= evaluatedCensus; ordinal += 1) {
    engine.admitYouth(ADMIN, {
      caseId: `SYNTH-S6-STAFF-CASE-${ordinal}`,
      youthId: `SYNTH-S6-STAFF-YOUTH-${ordinal}`,
      youthLabel: `Synthetic S6 Youth ${ordinal}`,
      ageYears: 15,
      requiresTreatmentServices: true,
      bedId: m24BedId(ordinal),
      admittedAt: `2026-09-09T08:${String(ordinal).padStart(2, "0")}:00.000Z`,
      reason: "S6 synthetic staffing-readiness evaluation",
    });
  }

  let shift: M24Shift = engine.createShift(SUPERVISOR, {
    stageId: "M24-STAGE-1",
    shiftDate: "2026-09-09",
    shiftType: "day",
    startsAt: "2026-09-09T08:00:00.000Z",
    endsAt: "2026-09-09T16:00:00.000Z",
    staff: Array.from({ length: qualifiedPresentStaff }, (_, index) => ({
      staffId: `SYNTH-S6-STAFF-${index + 1}`,
      staffName: `Synthetic Qualified Staff ${index + 1}`,
      role: "youth-care-worker",
      qualified: true,
      workingDirectlyWithGroup: true,
      awakeStatus: "awake" as const,
    })),
    reason: "S6 synthetic staffing-readiness evaluation",
  }).shift;

  for (const member of shift.staff) {
    shift = engine.recordAttendance(SUPERVISOR, {
      shiftId: shift.id,
      staffId: member.staffId,
      status: "present",
      occurredAt: shift.startsAt,
      reason: "S6 synthetic attendance evidence",
      expectedVersion: shift.version,
    }).shift;
  }

  const evaluation = engine.evaluateStaffing(
    ADMIN,
    shift.id,
    "children-awake",
  ).evaluation;
  return {
    foundation: "M2.4_GRO_STAFFING",
    evaluatedCensus,
    qualifiedPresentStaff,
    compliant: evaluation.compliant,
    requiredAdditionalCapacityUnits: evaluation.requiredAdditionalCapacityUnits,
    reasonCodes: evaluation.reasonCodes,
  };
}

function placementEngineAtHospitalLeave() {
  const engine = new M24GroEngine({ now: () => AT });
  let placement = engine.admitYouth(ADMIN, {
    caseId: "SYNTH-S6-CONTINUITY-CASE-001",
    youthId: "SYNTH-S6-CONTINUITY-YOUTH-001",
    youthLabel: "Synthetic Continuity Youth",
    ageYears: 15,
    requiresTreatmentServices: true,
    requiresConstantSupervision: true,
    bedId: "M24-STAGE-1-ROOM-1-BED-1",
    admittedAt: "2026-09-09T08:00:00.000Z",
    reason: "S6 synthetic continuity admission",
  }).placement;

  engine.recordEngagement(SUPERVISOR, {
    caseId: placement.caseId,
    youthId: placement.youthId,
    eventType: "crisis",
    occurredAt: "2026-09-09T10:00:00.000Z",
    summary: "Synthetic crisis requiring hospital evaluation",
    details: {
      hospitalization: true,
      responsePlan:
        "Stabilize in the hospital, maintain placement on leave, reassess acuity and triggers, revise supports, and complete return-capability review before any discharge decision.",
    },
    reason: "S6 placement-stability scenario",
  });

  placement = engine.transitionPlacement(ADMIN, {
    placementId: placement.id,
    transitionType: "leave",
    occurredAt: "2026-09-09T10:15:00.000Z",
    reason: "Synthetic hospitalization leave - placement retained",
    expectedVersion: placement.version,
  }).placement;
  return { engine, placement };
}

function completedSteps(
  rows: ReadonlyArray<readonly [CypressS6ContinuityStepId, string, string]>,
): CypressS6PlacementContinuity["steps"] {
  return rows.map(([id, detail, evidence]) => ({
    id,
    state: "COMPLETE" as const,
    detail,
    evidenceRefs: [evidence],
  }));
}

function continuity(
  scenario: CypressS6PreviewScenario,
): CypressS6PlacementContinuity {
  if (
    scenario === "administrator_ready" ||
    scenario === "administrator_benchmark_exception" ||
    scenario === "workforce_clearance_gap"
  ) {
    return {
      doctrine: "CRISIS_STABILIZE_REASSESS_MODIFY_RETURN_REVIEW_RETURN_OR_JUSTIFY",
      steps: [],
      supportChanges: [],
      safeReturn: null,
      requestedDisposition: "NONE",
      automaticDischargeAllowed: false,
      underlyingPlacementStatus: "NOT_APPLICABLE",
      executiveFlags: [],
    };
  }

  const { engine, placement: leavePlacement } = placementEngineAtHospitalLeave();

  if (scenario === "automatic_discharge_blocked") {
    return {
      doctrine: "CRISIS_STABILIZE_REASSESS_MODIFY_RETURN_REVIEW_RETURN_OR_JUSTIFY",
      steps: [
        {
          id: "CRISIS_EVENT",
          state: "COMPLETE",
          detail: "Crisis and hospitalization were recorded while the placement remained retained on leave.",
          evidenceRefs: ["SYNTH-S6-CRISIS-001", "SYNTH-S6-HOSPITAL-001"],
        },
        {
          id: "STABILIZE",
          state: "COMPLETE",
          detail: "Hospital stabilization is documented.",
          evidenceRefs: ["SYNTH-S6-HOSPITAL-STABILIZED-001"],
        },
        {
          id: "REASSESS",
          state: "BLOCKED",
          detail: "A discharge request arrived before the controlled reassessment was completed.",
          evidenceRefs: [],
        },
        {
          id: "MODIFY_SUPPORTS",
          state: "NOT_REACHED",
          detail: "Support modification cannot be skipped after crisis.",
          evidenceRefs: [],
        },
        {
          id: "RETURN_CAPABILITY_REVIEW",
          state: "NOT_REACHED",
          detail: "Safe-return capability has not been reviewed.",
          evidenceRefs: [],
        },
        {
          id: "RETURN_OR_JUSTIFIED_DISCHARGE",
          state: "NOT_REACHED",
          detail: "Automatic discharge is prohibited while continuity prerequisites remain incomplete.",
          evidenceRefs: [],
        },
      ],
      supportChanges: [],
      safeReturn: null,
      requestedDisposition: "DISCHARGE",
      automaticDischargeAllowed: false,
      underlyingPlacementStatus:
        leavePlacement.status === "leave" ? "LEAVE" : "ACTIVE",
      executiveFlags: ["HOSPITALIZATION_TO_DISCHARGE_PATTERN"],
    };
  }

  if (scenario === "hospitalization_return") {
    const returned = engine.transitionPlacement(ADMIN, {
      placementId: leavePlacement.id,
      transitionType: "return",
      occurredAt: "2026-09-09T15:30:00.000Z",
      reason: "S6 continuity review supports safe return",
      expectedVersion: leavePlacement.version,
    }).placement;
    return {
      doctrine: "CRISIS_STABILIZE_REASSESS_MODIFY_RETURN_REVIEW_RETURN_OR_JUSTIFY",
      steps: completedSteps([
        ["CRISIS_EVENT", "Crisis/hospital event recorded.", "SYNTH-S6-CRISIS-001"],
        ["STABILIZE", "Hospital stabilization documented.", "SYNTH-S6-STABILIZE-001"],
        ["REASSESS", "Acuity, triggers, supervision, and return risks reassessed.", "SYNTH-S6-REASSESS-001"],
        ["MODIFY_SUPPORTS", "Supports revised before return.", "SYNTH-S6-SUPPORT-MOD-001"],
        ["RETURN_CAPABILITY_REVIEW", "Safe-return capability confirmed with enhanced supports.", "SYNTH-S6-RETURN-REVIEW-001"],
        ["RETURN_OR_JUSTIFIED_DISCHARGE", "Youth returned to the retained placement.", "SYNTH-S6-RETURN-001"],
      ]),
      supportChanges: SUPPORT_CHANGES,
      safeReturn: true,
      requestedDisposition: "RETURN",
      automaticDischargeAllowed: false,
      underlyingPlacementStatus: returned.status === "active" ? "ACTIVE" : "LEAVE",
      executiveFlags: [],
    };
  }

  engine.recordEngagement(SUPERVISOR, {
    caseId: leavePlacement.caseId,
    youthId: leavePlacement.youthId,
    eventType: "discharge_coordination",
    occurredAt: "2026-09-09T15:15:00.000Z",
    summary: "Synthetic justified-discharge coordination completed after continuity review",
    details: {
      familyConfirmed: true,
      transportPlan: true,
      medicationReconciled: true,
      crisisPlan: true,
      aftercarePlan: true,
    },
    reason: "S6 justified-discharge scenario",
  });
  const discharged = engine.transitionPlacement(ADMIN, {
    placementId: leavePlacement.id,
    transitionType: "discharge",
    occurredAt: "2026-09-09T15:45:00.000Z",
    reason: "Documented return-capability review found a safety requirement outside currently supportable scope after support modifications were attempted",
    expectedVersion: leavePlacement.version,
  }).placement;

  return {
    doctrine: "CRISIS_STABILIZE_REASSESS_MODIFY_RETURN_REVIEW_RETURN_OR_JUSTIFY",
    steps: completedSteps([
      ["CRISIS_EVENT", "Crisis/hospital event recorded.", "SYNTH-S6-CRISIS-002"],
      ["STABILIZE", "Hospital stabilization documented.", "SYNTH-S6-STABILIZE-002"],
      ["REASSESS", "Return risks and licensed/supportable scope reassessed.", "SYNTH-S6-REASSESS-002"],
      ["MODIFY_SUPPORTS", "Available support modifications were attempted and documented.", "SYNTH-S6-SUPPORT-MOD-002"],
      ["RETURN_CAPABILITY_REVIEW", "Review found safe return cannot be supported within the current verified capability.", "SYNTH-S6-RETURN-REVIEW-002"],
      ["RETURN_OR_JUSTIFIED_DISCHARGE", "Discharge was coordinated and justified after the full continuity review.", "SYNTH-S6-JUSTIFIED-DISCHARGE-001"],
    ]),
    supportChanges: SUPPORT_CHANGES,
    safeReturn: false,
    requestedDisposition: "DISCHARGE",
    automaticDischargeAllowed: false,
    underlyingPlacementStatus:
      discharged.status === "discharged" ? "DISCHARGED" : "LEAVE",
    executiveFlags: ["HIGH_ACUITY_DISCHARGE_REVIEWED"],
  };
}

function exceptionRows(
  scenario: CypressS6PreviewScenario,
  workforce: CypressS6WorkforceControl,
  staffing: CypressS6StaffingControl,
  placement: CypressS6PlacementContinuity,
): readonly CypressS6Exception[] {
  const rows: CypressS6Exception[] = [];
  if (scenario === "administrator_benchmark_exception") {
    rows.push({
      code: "ADMINISTRATOR_BENCHMARK_MISSED",
      severity: "CONTROL",
      disposition: "CORRECT",
      summary: "A missed Administrator benchmark requires evidence assembly, management review, corrective action/support, follow-up, and close-or-escalate disposition; the system must not silently normalize the miss.",
    });
  }
  if (!workforce.clearanceReady) {
    rows.push({
      code: "WORKFORCE_CLEARANCE_INCOMPLETE",
      severity: "WORKFORCE",
      disposition: "BLOCK",
      summary: "Required screening/credential/clearance evidence is incomplete, so release to duty is held.",
    });
  }
  if (!staffing.compliant) {
    rows.push({
      code: "STAFFING_READINESS_INSUFFICIENT",
      severity: "WORKFORCE",
      disposition: "BLOCK",
      summary: "The existing M2.4 staffing engine identified insufficient qualified present capacity for the evaluated census.",
    });
  }
  if (scenario === "automatic_discharge_blocked") {
    rows.push(
      {
        code: "AUTOMATIC_CRISIS_DISCHARGE_PROHIBITED",
        severity: "STABILITY",
        disposition: "BLOCK",
        summary: "Hospitalization is not an automatic discharge trigger; reassessment, support modification, and return-capability review must occur first.",
      },
      {
        code: "HOSPITALIZATION_TO_DISCHARGE_PATTERN",
        severity: "EXECUTIVE",
        disposition: "REVIEW",
        summary: "Hospitalization followed by an immediate discharge request is a placement-stability flag for executive review.",
      },
    );
  }
  if (scenario === "justified_discharge_after_review" && placement.safeReturn === false) {
    rows.push({
      code: "JUSTIFIED_DISCHARGE_EVIDENCE_COMPLETE",
      severity: "STABILITY",
      disposition: "CARRY_FORWARD",
      summary: "The full continuity sequence and discharge coordination are evidenced; discharge is justified rather than automatic.",
    });
  }
  return rows;
}

function auditEvents(
  benchmarks: readonly CypressS6AdministratorBenchmark[],
  workforce: CypressS6WorkforceControl,
  staffing: CypressS6StaffingControl,
  placement: CypressS6PlacementContinuity,
  corrective: readonly CypressS6CorrectiveActionStep[],
): readonly CypressS6AuditEvent[] {
  const benchmarkPass = benchmarks.every((row) => row.state === "MEETS");
  const placementComplete =
    placement.steps.length === 0 ||
    placement.steps.every((step) => step.state === "COMPLETE");
  const rows: CypressS6AuditEvent[] = [
    {
      eventId: "SYNTH-S6-AUD-001",
      eventType: "ADMINISTRATOR_BENCHMARK_EVALUATED",
      status: benchmarkPass ? "PASS" : "REVIEW_REQUIRED",
      detail: benchmarkPass
        ? "All five role-based Administrator scorecard benchmarks are evidenced for the scenario."
        : "At least one role-based Administrator scorecard benchmark was missed and routed to corrective action.",
    },
    {
      eventId: "SYNTH-S6-AUD-002",
      eventType: "WORKFORCE_READINESS_EVALUATED",
      status: workforce.releaseToDutyAllowed ? "PASS" : "BLOCKED",
      detail: workforce.releaseToDutyAllowed
        ? "M3.3 workforce gates, controlled credentials, training, and access evidence support release to duty."
        : "Release to duty is blocked by incomplete controlled clearance evidence.",
    },
    {
      eventId: "SYNTH-S6-AUD-003",
      eventType: "STAFFING_READINESS_EVALUATED",
      status: staffing.compliant ? "PASS" : "BLOCKED",
      detail: `M2.4 staffing evaluation: ${staffing.qualifiedPresentStaff} qualified present staff for ${staffing.evaluatedCensus} synthetic youth.`,
    },
    {
      eventId: "SYNTH-S6-AUD-004",
      eventType: "PLACEMENT_CONTINUITY_EVALUATED",
      status: placementComplete ? "PASS" : "BLOCKED",
      detail:
        placement.steps.length === 0
          ? "No crisis/placement continuity episode is active in this scenario."
          : `Continuity disposition ${placement.requestedDisposition}; underlying placement status ${placement.underlyingPlacementStatus}.`,
    },
  ];
  if (corrective.length > 0) {
    rows.push({
      eventId: "SYNTH-S6-AUD-005",
      eventType: "CORRECTIVE_ACTION_ROUTED",
      status: "REVIEW_REQUIRED",
      detail: "Missed Administrator benchmark was converted into an evidence-backed corrective-action workflow with follow-up pending.",
    });
  }
  return rows;
}

function outcomeFor(scenario: CypressS6PreviewScenario): CypressS6PreviewResult["outcome"] {
  switch (scenario) {
    case "administrator_benchmark_exception":
      return "ADMIN_CORRECTIVE_ACTION_REQUIRED";
    case "workforce_clearance_gap":
      return "WORKFORCE_RELEASE_HELD";
    case "hospitalization_return":
      return "RETURN_SUPPORTED";
    case "automatic_discharge_blocked":
      return "DISCHARGE_BLOCKED";
    case "justified_discharge_after_review":
      return "JUSTIFIED_DISCHARGE_ALLOWED";
    default:
      return "ADMIN_WORKFORCE_READY";
  }
}

function titleFor(scenario: CypressS6PreviewScenario): string {
  return {
    administrator_ready: "Administrator and workforce ready",
    administrator_benchmark_exception: "Administrator benchmark exception routed",
    workforce_clearance_gap: "Workforce release held",
    hospitalization_return: "Hospitalization continuity supports return",
    automatic_discharge_blocked: "Automatic post-crisis discharge blocked",
    justified_discharge_after_review: "Discharge justified after continuity review",
  }[scenario];
}

function nextActionFor(scenario: CypressS6PreviewScenario): string {
  return {
    administrator_ready: "Continue operating against the five Administrator benchmarks and verified workforce-fit evidence; escalate material variances rather than redefining doctrine.",
    administrator_benchmark_exception: "Complete the scheduled follow-up, verify corrective-action effectiveness, then close or escalate the Administrator benchmark exception with evidence.",
    workforce_clearance_gap: "Resolve missing clearance evidence and restore compliant qualified staffing before releasing the affected workforce member to duty.",
    hospitalization_return: "Execute the documented enhanced supports and monitor safe return/placement continuity; do not convert the crisis event into an automatic discharge.",
    automatic_discharge_blocked: "Complete reassessment, support modification, and return-capability review before any discharge decision; route the hospitalization-to-discharge pattern for executive review.",
    justified_discharge_after_review: "Preserve the completed continuity and discharge-coordination evidence and monitor the downstream transition; do not characterize this as automatic crisis discharge.",
  }[scenario];
}

export function getCypressS6Status(): CypressS6Status {
  return {
    sprint: "Cypress Doctrine Sprint 01",
    stage: "S6",
    capability: "Administrator / Workforce / Placement Stability",
    previewAvailable: true,
    previewEnvironment: "SYNTHETIC_PREVIEW",
    noPhi: true,
    s5Accepted: true,
    productionPromotion: "NOT_AUTHORIZED",
    message: "S6 applies the approved role-based Administrator scorecard, M3.3 workforce readiness, M2.4 staffing controls, and the crisis-to-return/justified-discharge continuity doctrine using synthetic/no-PHI evidence only.",
  };
}

export function buildCypressS6Preview(
  scenario: CypressS6PreviewScenario,
): CypressS6PreviewResult {
  const benchmarks = administratorBenchmarks(scenario);
  const corrective = correctiveAction(scenario);
  const workforce = workforceControl(scenario);
  const staffing = staffingControl(scenario);
  const placementContinuity = continuity(scenario);
  const exceptions = exceptionRows(scenario, workforce, staffing, placementContinuity);
  const outcome = outcomeFor(scenario);

  return {
    sprint: "Cypress Doctrine Sprint 01",
    stage: "S6",
    environment: "SYNTHETIC_PREVIEW",
    noPhi: true,
    scenario,
    testCaseId: `SYNTH-S6-${scenario.toUpperCase().replace(/_/g, "-")}`,
    capabilityLevels: ["L9", "L10"],
    administratorSubject: "ROLE:GRO_ADMINISTRATOR",
    licensedCapacity: LICENSED_CAPACITY,
    futureCapacity: FUTURE_CAPACITY,
    administratorBenchmarks: benchmarks,
    correctiveAction: corrective,
    workforce,
    staffing,
    placementContinuity,
    outcome,
    exceptions,
    audit: auditEvents(benchmarks, workforce, staffing, placementContinuity, corrective),
    executiveVisibility: [
      `S6 outcome: ${outcome}`,
      `Administrator benchmarks missed: ${benchmarks.filter((row) => row.state === "MISSED").length}`,
      `Workforce release to duty: ${workforce.releaseToDutyAllowed ? "ALLOWED" : "HELD"}`,
      `Staffing readiness: ${staffing.compliant ? "COMPLIANT" : "INSUFFICIENT"}`,
      `Placement continuity flags: ${placementContinuity.executiveFlags.length}`,
    ],
    title: titleFor(scenario),
    summary:
      scenario === "automatic_discharge_blocked"
        ? "The continuity controller retains the placement on hospital leave and blocks discharge because reassessment, support modification, and return-capability review are incomplete."
        : scenario === "hospitalization_return"
          ? "The continuity controller preserves the placement through hospitalization, documents support changes, confirms safe return capability, and returns the youth to the retained placement."
          : scenario === "justified_discharge_after_review"
            ? "Discharge occurs only after the full continuity sequence, attempted support modifications, return-capability review, and coordinated evidence establish that safe return is not supportable."
            : scenario === "administrator_benchmark_exception"
              ? "A missed staffing-readiness benchmark becomes an evidence-backed corrective-action case with management review and follow-up rather than disappearing into informal discussion."
              : scenario === "workforce_clearance_gap"
                ? "Incomplete workforce clearance and insufficient qualified present staffing hold release to duty and create explicit readiness exceptions."
                : "Role-based Administrator benchmarks, M3.3 workforce evidence, and M2.4 staffing readiness align for the controlled scenario.",
    exactNextAction: nextActionFor(scenario),
    productionPromotion: "NOT_AUTHORIZED",
  };
}
