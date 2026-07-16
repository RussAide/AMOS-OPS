import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import {
  validateAuditEvent,
  type CcmgAuditEvent,
} from "../contracts/ccmg";
import type { RecordReferralGateInput } from "../api/routers/m21";

const AS_OF = "2026-07-14T18:00:00Z";
const evidenceRoot = path.resolve(process.argv[2] ?? "../evidence");
const runtimeDatabasePath = path.join(
  "/tmp",
  `amos-m21-evidence-runtime-${randomUUID()}.db`,
);
process.env.DATABASE_PATH = runtimeDatabasePath;
process.env.NODE_ENV = "test";

const m21 = await import("../api/routers/m21");
const db = new Database(":memory:");

const directories = {
  intake: path.join(evidenceRoot, "01_Intake_Eligibility_and_Capacity"),
  queues: path.join(evidenceRoot, "02_CCMG_Oversight_Queues"),
  lineage: path.join(evidenceRoot, "03_CANS_Plan_Lineage"),
  workflow: path.join(evidenceRoot, "04_Assignment_Escalation_and_Handoffs"),
  dashboards: path.join(evidenceRoot, "05_Role_Dashboards"),
  scenarios: path.join(evidenceRoot, "06_Audit_and_Scenarios"),
  qa: path.join(evidenceRoot, "90_Manifest_and_QA"),
};
Object.values(directories).forEach((directory) =>
  fs.mkdirSync(directory, { recursive: true }),
);

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\n") + "\n";
const write = (filePath: string, value: string) =>
  fs.writeFileSync(filePath, value.endsWith("\n") ? value : `${value}\n`);
const writeJson = (filePath: string, value: unknown) =>
  write(filePath, JSON.stringify(value, null, 2));

function installMigrations(target: Database.Database): string[] {
  const migrationDirectory = path.resolve("db/migrations");
  const migrations = fs
    .readdirSync(migrationDirectory)
    .filter((name) => /^\d{4}_.+\.sql$/.test(name))
    .sort();
  target.pragma("foreign_keys = ON");
  for (const migration of migrations) {
    const statements = fs
      .readFileSync(path.join(migrationDirectory, migration), "utf8")
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    target.transaction(() => {
      statements.forEach((statement) => target.exec(statement));
    })();
  }
  return migrations;
}

function errorResult(error: unknown) {
  if (error instanceof Error) {
    return { denied: true, name: error.name, message: error.message };
  }
  return { denied: true, name: "UnknownError", message: String(error) };
}

function expectDenied(operation: () => unknown) {
  try {
    operation();
  } catch (error) {
    return errorResult(error);
  }
  throw new Error("Expected operation to be denied, but it succeeded.");
}

function auditEventFromRow(row: Record<string, unknown>): CcmgAuditEvent {
  const parse = <T>(value: unknown, fallback: T): T => {
    if (typeof value !== "string") return fallback;
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  };
  return {
    id: String(row.id),
    caseId: row.case_id === null ? null : String(row.case_id),
    referralId: row.referral_id === null ? null : String(row.referral_id),
    workItemId: row.work_item_id === null ? null : String(row.work_item_id),
    eventType: row.event_type as CcmgAuditEvent["eventType"],
    action: String(row.action),
    entityType: String(row.entity_type),
    entityId: String(row.entity_id),
    actorId: String(row.actor_id),
    actorRole: String(row.actor_role),
    reason: String(row.reason),
    before: parse<Record<string, unknown> | null>(row.before_json, null),
    after: parse<Record<string, unknown> | null>(row.after_json, null),
    changedFields: parse<string[]>(row.changed_fields_json, []),
    correlationId: String(row.correlation_id),
    evidenceClass: row.evidence_class as CcmgAuditEvent["evidenceClass"],
    occurredAt: String(row.occurred_at),
  };
}

function rowCount(sql: string, ...parameters: unknown[]): number {
  return (db.prepare(sql).get(...parameters) as { count: number }).count;
}

function correlationIds(auditEventIds: readonly string[]): string[] {
  return auditEventIds.map((auditEventId) => {
    const row = db
      .prepare(
        "SELECT correlation_id AS correlationId FROM m21_ccmg_audit_events WHERE id = ?",
      )
      .get(auditEventId) as { correlationId: string } | undefined;
    assert(row, `Audit event ${auditEventId} is missing.`);
    return row.correlationId;
  });
}

function assertStableCorrelation(
  auditEventIds: readonly string[],
  caseId: string,
): string {
  const expected = `M21-CORR-${caseId}`;
  const actual = correlationIds(auditEventIds);
  assert(
    actual.length > 0 && actual.every((correlationId) => correlationId === expected),
    `Audit correlation drifted for ${caseId}.`,
  );
  return expected;
}

const migrations = installMigrations(db);
const director = {
  id: "SYNTH-CCMG-DIRECTOR",
  role: "ccmg-program-director",
};
const treatmentDirector = {
  id: "SYNTH-TREATMENT-DIRECTOR",
  role: "treatment-director",
};
const clinicalDirector = {
  id: "SYNTH-CLINICAL-DIRECTOR",
  role: "clinical-director",
};
const mhtcmSupervisor = {
  id: "SYNTH-MHTCM-SUPERVISOR",
  role: "mhtcm-supervisor",
};
const mhrsSupervisor = {
  id: "SYNTH-MHRS-SUPERVISOR",
  role: "mhrs-supervisor",
};
const qmhp = { id: "SYNTH-QMHP-001", role: "qmhp-cs" };
const intakeCoordinator = {
  id: "SYNTH-INTAKE-COORDINATOR",
  role: "intake-coordinator",
};
const revenueActor = {
  id: "SYNTH-REVENUE-001",
  role: "revenue-cycle-manager",
};
const groDirector = {
  id: "SYNTH-GRO-DIRECTOR",
  role: "program-director",
};

const domainScores = {
  behavioral_emotional: 3,
  risk_behaviors: 3,
  life_functioning: 2,
  strengths: 1,
  caregiver_resources: 2,
  cultural_factors: 0,
} as const;
const actionableItems = [
  {
    itemCode: "RSK-E2E",
    label: "controlled safety planning",
    domain: "risk_behaviors",
    rating: 3,
    disposition: "need",
  },
  {
    itemCode: "LIF-E2E",
    label: "controlled daily routine",
    domain: "life_functioning",
    rating: 2,
    disposition: "need",
  },
  {
    itemCode: "STR-E2E",
    label: "controlled community connection",
    domain: "strengths",
    rating: 1,
    disposition: "strength",
  },
] as const;

// Negative control: a CANS work item cannot bypass finalized CANS and exact
// approved target lineage merely by initiating a generic handoff.
const cansHandoffBypassDenied = expectDenied(() =>
  m21.handoffM21Workflow(
    director,
    {
      workItemId: "M21-WORK-CANS-001",
      toDivision: "BHC",
      toDepartment: "MHTCM",
      dueAt: "2026-07-18T17:00:00Z",
      reason: "Controlled CANS handoff bypass must fail.",
      expectedVersion: 1,
    },
    db,
  ),
);

// SCN-M21-001: persist all six gates, finalize the first CANS, and route the
// exact assessment independently to both required target workflows.
const newScenarioAuditIds: string[] = [];
let newReferralVersion = 1;
const recordNewGate = (
  actor: { id: string; role: string },
  input: Omit<RecordReferralGateInput, "referralId" | "expectedVersion">,
) => {
  const result = m21.recordM21ReferralGate(
    actor,
    {
      referralId: "M21-REF-NEW-001",
      expectedVersion: newReferralVersion,
      ...input,
    } as RecordReferralGateInput,
    db,
  );
  newReferralVersion = result.referral.version;
  newScenarioAuditIds.push(result.auditEventId);
  return result;
};

recordNewGate(intakeCoordinator, {
  gate: "intake",
  decision: { status: "complete" },
  reason: "Controlled synthetic intake completed.",
});
recordNewGate(qmhp, {
  gate: "eligibility",
  decision: {
    status: "eligible",
    criteria: {
      ageQualified: true,
      diagnosisQualified: true,
      functionalImpairment: true,
      coverageQualified: true,
    },
    rationale: "All controlled synthetic eligibility criteria are met.",
  },
  reason: "Controlled synthetic eligibility approved.",
});
recordNewGate(revenueActor, {
  gate: "payer_authorization",
  decision: {
    payerLabel: "Synthetic Payer Alpha",
    verificationStatus: "verified",
    authorizationRequired: true,
    authorizationStatus: "approved",
    authorizationReference: "SYNTH-AUTH-E2E-NEW",
    effectiveAt: "2026-07-14T00:00:00Z",
    expiresAt: "2026-10-14T23:59:59Z",
  },
  reason: "Controlled synthetic payer authorization approved.",
});
recordNewGate(intakeCoordinator, {
  gate: "consent",
  decision: {
    status: "active",
    consentReference: "SYNTH-CONSENT-E2E-NEW",
    effectiveAt: "2026-07-14T00:00:00Z",
    expiresAt: "2026-12-31T23:59:59Z",
  },
  reason: "Controlled synthetic consent activated.",
});
recordNewGate(qmhp, {
  gate: "cans_schedule",
  decision: {
    status: "scheduled",
    dueAt: "2026-07-16T17:00:00Z",
    scheduledFor: "2026-07-15T10:00:00Z",
  },
  reason: "Controlled synthetic CANS scheduled.",
});
const newReady = recordNewGate(groDirector, {
  gate: "capacity",
  decision: {
    required: true,
    facilityLabel: "Synthetic GRO Capacity Pool",
    status: "reserved",
    availableSlots: 1,
    reservedSlotReference: "SYNTH-SLOT-E2E-NEW",
    checkedAt: "2026-07-14T12:00:00Z",
  },
  reason: "Controlled synthetic capacity reserved.",
});
assert(
  newReady.referral.status === "ready_for_routing" && newReady.readiness.ready,
  "New referral did not reach routing readiness after all six gates.",
);

const newCans = m21.finalizeM21CansVersion(
  qmhp,
  {
    referralId: newReady.referral.id,
    instrumentVersion: "CANS-SYNTHETIC-2026.1",
    domainScores,
    actionableItems,
    totalScore: 35,
    acuity: "high",
    completedAt: "2026-07-15T11:00:00Z",
    reason: "Controlled synthetic CANS finalization.",
    expectedReferralVersion: newReady.referral.version,
  },
  db,
);
newScenarioAuditIds.push(newCans.auditEventId);
const newMhtcmRoute = m21.approveM21CansTargetRoute(
  treatmentDirector,
  {
    referralId: newCans.referral.id,
    cansAssessmentId: newCans.assessment.id,
    targetType: "mhtcm_plan",
    targetRecordId: "SYNTH-MHTCM-E2E-NEW",
    targetVersion: 1,
    reason: "Independent controlled MHTCM route approval.",
    expectedReferralVersion: newCans.referral.version,
  },
  db,
);
newScenarioAuditIds.push(
  newMhtcmRoute.approvalAuditEventId,
  newMhtcmRoute.handoffAuditEventId,
);
const newMhrsRoute = m21.approveM21CansTargetRoute(
  mhrsSupervisor,
  {
    referralId: newMhtcmRoute.referral.id,
    cansAssessmentId: newCans.assessment.id,
    targetType: "mhrs_skills_goals",
    targetRecordId: "SYNTH-MHRS-E2E-NEW",
    targetVersion: 1,
    reason: "Independent controlled MHRS route approval.",
    expectedReferralVersion: newMhtcmRoute.referral.version,
  },
  db,
);
newScenarioAuditIds.push(
  newMhrsRoute.approvalAuditEventId,
  newMhrsRoute.handoffAuditEventId,
);
assert(
  newMhrsRoute.referral.status === "active" &&
    rowCount(
      "SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE cans_assessment_id = ?",
      newCans.assessment.id,
    ) === 2,
  "New referral did not become active with both target routes.",
);
const newCorrelationId = assertStableCorrelation(
  newScenarioAuditIds,
  "M21-CASE-NEW-001",
);

// SCN-M21-002: append immutable CANS v3 for the existing case, preserve v1/v2,
// and route only the exact new current assessment to both named targets.
const priorExistingCansRows = db
  .prepare(
    "SELECT * FROM m21_ccmg_cans_assessments WHERE referral_id = ? AND version <= 2 ORDER BY version",
  )
  .all("M21-REF-EXISTING-001");
const existingCans = m21.finalizeM21CansVersion(
  { id: "SYNTH-QMHP-EXISTING", role: "qmhp-cs" },
  {
    referralId: "M21-REF-EXISTING-001",
    instrumentVersion: "CANS-SYNTHETIC-2026.1",
    domainScores,
    actionableItems,
    totalScore: 38,
    acuity: "high",
    completedAt: "2026-07-16T10:00:00Z",
    reason: "Controlled synthetic reassessment finalized.",
    expectedReferralVersion: 3,
  },
  db,
);
const existingMhtcmRoute = m21.approveM21CansTargetRoute(
  mhtcmSupervisor,
  {
    referralId: existingCans.referral.id,
    cansAssessmentId: existingCans.assessment.id,
    targetType: "mhtcm_plan",
    targetRecordId: "SYNTH-MHTCM-E2E-V3",
    targetVersion: 3,
    reason: "Approve exact CANS v3 MHTCM route.",
    expectedReferralVersion: existingCans.referral.version,
  },
  db,
);
const existingMhrsRoute = m21.approveM21CansTargetRoute(
  mhrsSupervisor,
  {
    referralId: existingMhtcmRoute.referral.id,
    cansAssessmentId: existingCans.assessment.id,
    targetType: "mhrs_skills_goals",
    targetRecordId: "SYNTH-MHRS-E2E-V3",
    targetVersion: 3,
    reason: "Approve exact CANS v3 MHRS route.",
    expectedReferralVersion: existingMhtcmRoute.referral.version,
  },
  db,
);
const afterExistingCansRows = db
  .prepare(
    "SELECT * FROM m21_ccmg_cans_assessments WHERE referral_id = ? AND version <= 2 ORDER BY version",
  )
  .all("M21-REF-EXISTING-001");
assert(
  JSON.stringify(afterExistingCansRows) === JSON.stringify(priorExistingCansRows),
  "Existing CANS v1/v2 rows changed during v3 append.",
);
const existingScenarioAuditIds = [
  existingCans.auditEventId,
  existingMhtcmRoute.approvalAuditEventId,
  existingMhtcmRoute.handoffAuditEventId,
  existingMhrsRoute.approvalAuditEventId,
  existingMhrsRoute.handoffAuditEventId,
];
const existingCorrelationId = assertStableCorrelation(
  existingScenarioAuditIds,
  "M21-CASE-EXISTING-001",
);
assert(
  existingMhrsRoute.referral.status === "active" &&
    existingCans.assessment.version === 3 &&
    rowCount(
      "SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE cans_assessment_id = ?",
      existingCans.assessment.id,
    ) === 2,
  "Existing youth v3 was not fully routed.",
);

// SCN-M21-003: persist—not simulate—the rejected disposition, then prove that
// a post-rejection route is denied and leaves no lineage behind.
const rejected = m21.recordM21ReferralGate(
  { id: "SYNTH-QMHP-INDEPENDENT", role: "qmhp-cs" },
  {
    referralId: "M21-REF-HELD-001",
    gate: "eligibility",
    decision: {
      status: "ineligible",
      criteria: {
        ageQualified: true,
        diagnosisQualified: false,
        functionalImpairment: false,
        coverageQualified: true,
      },
      rationale: "Controlled synthetic evidence does not meet eligibility.",
    },
    reason: "Independent persisted rejection disposition.",
    expectedVersion: 1,
  },
  db,
);
const postRejectionRouteDenied = expectDenied(() =>
  m21.approveM21CansTargetRoute(
    treatmentDirector,
    {
      referralId: rejected.referral.id,
      cansAssessmentId: "M21-CANS-EXISTING-V2",
      targetType: "mhtcm_plan",
      targetRecordId: "SYNTH-POST-REJECT",
      targetVersion: 1,
      reason: "Post-rejection target route must fail closed.",
      expectedReferralVersion: rejected.referral.version,
    },
    db,
  ),
);
const rejectionAuditRow = db
  .prepare(
    `SELECT id,correlation_id AS correlationId FROM m21_ccmg_audit_events
     WHERE referral_id = ? AND action = 'cans_target_route_denied'
     ORDER BY occurred_at DESC,id DESC LIMIT 1`,
  )
  .get(rejected.referral.id) as
  | { id: string; correlationId: string }
  | undefined;
assert(rejectionAuditRow, "Post-rejection denial audit is missing.");
const rejectedCorrelationId = assertStableCorrelation(
  [rejected.auditEventId, rejectionAuditRow.id],
  "M21-CASE-HELD-001",
);
assert(
  rejected.referral.status === "rejected" &&
    rowCount(
      "SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE referral_id = ?",
      rejected.referral.id,
    ) === 0,
  "Rejected referral was not persisted fail-closed.",
);

// SCN-M21-004: escalate urgent oversight, create the nurse-owned medication
// alert, and obtain an independent clinical-director disposition.
const urgentEscalation = m21.escalateM21Workflow(
  director,
  {
    workItemId: "M21-WORK-URGENT-001",
    level: "executive",
    reason: "Urgent controlled escalation.",
    expectedVersion: 2,
  },
  db,
);
const urgentMedicationAlert = m21.createM21MedicationOversightAlert(
  { id: "SYNTH-NURSE-URGENT", role: "nurse" },
  {
    referralId: "M21-REF-URGENT-001",
    title: "Urgent synthetic medication oversight review",
    priority: "critical",
    dueAt: "2026-07-15T17:00:00Z",
    reason: "Urgent referral requires controlled medication oversight.",
    expectedReferralVersion: 2,
  },
  db,
);
const urgentMedicationApproval = m21.approveM21Workflow(
  clinicalDirector,
  {
    workItemId: urgentMedicationAlert.workItem.id,
    decision: "approved",
    rationale: "Independent clinical medication disposition completed.",
    expectedVersion: urgentMedicationAlert.workItem.version,
  },
  db,
);
const urgentScenarioAuditIds = [
  urgentEscalation.auditEventId,
  urgentMedicationAlert.auditEventId,
  urgentMedicationApproval.auditEventId,
];
const urgentCorrelationId = assertStableCorrelation(
  urgentScenarioAuditIds,
  "M21-CASE-URGENT-001",
);
assert(
  urgentEscalation.workItem.escalationLevel === "executive" &&
    urgentMedicationApproval.workItem.status === "completed" &&
    urgentMedicationApproval.workItem.approvalStatus === "approved",
  "Urgent medication-oversight scenario did not reach disposition.",
);

// Cross-scenario workflow controls cover assignment, due date, receiving-owner
// accountability, status transition, exceptions, rejection, and self-approval.
const assignment = m21.assignM21Workflow(
  director,
  {
    workItemId: "M21-WORK-CANS-001",
    assignedDivision: "BHC",
    assignedDepartment: "CCMG",
    assignedRole: "qmhp-cs",
    assignedTo: qmhp.id,
    dueAt: "2026-07-16T16:00:00Z",
    reason: "Controlled synthetic CANS assignment refresh.",
    expectedVersion: 1,
  },
  db,
);
const handoffInitiated = m21.handoffM21Workflow(
  director,
  {
    workItemId: assignment.workItem.id,
    toDivision: "BHC",
    toDepartment: "MHTCM",
    dueAt: "2026-07-18T17:00:00Z",
    reason: "Controlled receiving-owner handoff demonstration.",
    expectedVersion: assignment.workItem.version,
  },
  db,
);
const handoffAccepted = m21.decideM21Handoff(
  mhtcmSupervisor,
  {
    handoffId: handoffInitiated.handoff.id,
    decision: "accepted",
    reason: "Receiving owner accepts synthetic accountability.",
    expectedHandoffVersion: handoffInitiated.handoff.version,
    expectedWorkItemVersion: handoffInitiated.workItem.version,
  },
  db,
);
const transitioned = m21.transitionM21Workflow(
  mhtcmSupervisor,
  {
    workItemId: handoffAccepted.workItem.id,
    toStatus: "awaiting_approval",
    reason: "Controlled receiving work is ready for review.",
    expectedVersion: handoffAccepted.workItem.version,
  },
  db,
);
const exceptionOpened = m21.setM21ExceptionDisposition(
  intakeCoordinator,
  {
    workItemId: "M21-WORK-INTAKE-001",
    disposition: "open",
    exceptionCode: "SYNTH-CONSENT-GAP",
    reason: "Controlled synthetic consent evidence requires review.",
    expectedVersion: 1,
  },
  db,
);
const exceptionResolved = m21.setM21ExceptionDisposition(
  intakeCoordinator,
  {
    workItemId: exceptionOpened.workItem.id,
    disposition: "resolved",
    reason: "Controlled synthetic consent evidence verified.",
    expectedVersion: exceptionOpened.workItem.version,
  },
  db,
);
const selfApprovalDenied = expectDenied(() =>
  m21.approveM21Workflow(
    treatmentDirector,
    {
      workItemId: "M21-WORK-SELF-APPROVAL-001",
      decision: "approved",
      rationale: "Controlled self-approval denial demonstration.",
      expectedVersion: 1,
    },
    db,
  ),
);
const rejectedHandoffInitiated = m21.handoffM21Workflow(
  groDirector,
  {
    workItemId: "M21-WORK-CAPACITY-001",
    toDivision: "BHC",
    toDepartment: "CCMG",
    dueAt: "2026-07-15T16:00:00Z",
    reason: "Controlled capacity handoff for rejection-path proof.",
    expectedVersion: 1,
  },
  db,
);
const rejectedHandoff = m21.decideM21Handoff(
  director,
  {
    handoffId: rejectedHandoffInitiated.handoff.id,
    decision: "rejected",
    reason: "Synthetic receiving package requires correction.",
    expectedHandoffVersion: rejectedHandoffInitiated.handoff.version,
    expectedWorkItemVersion: rejectedHandoffInitiated.workItem.version,
  },
  db,
);
assert(
  rejectedHandoff.workItem.exceptionStatus === "open" &&
    rejectedHandoff.workItem.assignedTo === groDirector.id,
  "Rejected handoff did not restore sender accountability and open an exception.",
);

const roleActors = [
  director,
  { id: "SYNTH-BHC-DIRECTOR", role: "bhc-director" },
  treatmentDirector,
  clinicalDirector,
  intakeCoordinator,
  { id: "SYNTH-CHART-AUDITOR", role: "chart-auditor" },
  { id: "SYNTH-NURSE-001", role: "nurse" },
  mhtcmSupervisor,
  mhrsSupervisor,
  { id: "SYNTH-REVENUE", role: "revenue-cycle-manager" },
  { id: "SYNTH-GRO-DIRECTOR", role: "gro-administrator" },
] as const;
const dashboards = roleActors.map((actor) =>
  m21.buildM21OversightDashboard(actor, "synthetic_demo", AS_OF, db),
);
const directorDashboard = dashboards[0];
assert(
  directorDashboard.actor.visibleQueueIds.length === 6 &&
    directorDashboard.queues.every((queue) => queue.visible),
  "Director does not have all six controlled queues.",
);
write(
  path.join(directories.queues, "M2_1_ROLE_QUEUE_EXECUTION.csv"),
  csv(
    [
      "actor_role",
      "visible_queue_ids",
      "queue_id",
      "queue_visible",
      "total",
      "overdue",
      "urgent",
      "awaiting_approval",
      "blocked",
      "backlog_work_items",
      "qa_findings",
      "service_coordination_items",
      "generated_at",
      "evidence_class",
    ],
    dashboards.flatMap((dashboard) =>
      dashboard.queues.map((queue) => [
        dashboard.actor.role,
        dashboard.actor.visibleQueueIds.join(" | "),
        queue.id,
        queue.visible,
        queue.total,
        queue.overdue,
        queue.urgent,
        queue.awaitingApproval,
        queue.blocked,
        dashboard.metrics.backlogWorkItems,
        dashboard.metrics.qaFindings,
        dashboard.metrics.serviceCoordinationItems,
        dashboard.generatedAt,
        dashboard.evidenceClass,
      ]),
    ),
  ),
);
writeJson(
  path.join(directories.dashboards, "M2_1_DASHBOARD_EXECUTION.json"),
  {
    status: "PASS",
    asOf: AS_OF,
    dataPosture: "fictional-synthetic-prototype-only",
    dashboards,
    deniedAccess: {
      unrelatedRole: expectDenied(() =>
        m21.buildM21OversightDashboard(
          { id: "SYNTH-HR", role: "hr-director" },
          "synthetic_demo",
          AS_OF,
          db,
        ),
      ),
      revenueDetail: expectDenied(() =>
        m21.buildM21ReferralDetail(
          { id: "SYNTH-REVENUE", role: "revenue-cycle-manager" },
          "M21-REF-URGENT-001",
          "synthetic_demo",
          AS_OF,
          db,
        ),
      ),
      unrelatedCaseManager: expectDenied(() =>
        m21.buildM21ReferralDetail(
          { id: "SYNTH-OTHER-CM", role: "case-manager" },
          "M21-REF-EXISTING-001",
          "synthetic_demo",
          AS_OF,
          db,
        ),
      ),
    },
  },
);

const referralIds = [
  "M21-REF-NEW-001",
  "M21-REF-EXISTING-001",
  "M21-REF-HELD-001",
  "M21-REF-URGENT-001",
];
const details = referralIds.map((referralId) =>
  m21.buildM21ReferralDetail(
    director,
    referralId,
    "synthetic_demo",
    AS_OF,
    db,
  ),
);
const detailById = new Map(details.map((detail) => [detail.referral.id, detail]));
const newDetail = detailById.get("M21-REF-NEW-001");
const existingDetail = detailById.get("M21-REF-EXISTING-001");
const rejectedDetail = detailById.get("M21-REF-HELD-001");
const urgentDetail = detailById.get("M21-REF-URGENT-001");
assert(
  newDetail && existingDetail && rejectedDetail && urgentDetail,
  "A controlled scenario detail is missing.",
);

write(
  path.join(directories.intake, "M2_1_INTAKE_GATE_EXECUTION.csv"),
  csv(
    [
      "referral_id",
      "scenario_status",
      "urgency",
      "readiness_status",
      "ready",
      "reason_codes",
      "intake_status",
      "eligibility_status",
      "payer_verification_status",
      "authorization_status",
      "consent_status",
      "cans_status",
      "capacity_status",
      "gate_audit_count",
      "referral_version",
      "evaluated_at",
      "evidence_class",
    ],
    details.map((detail) => [
      detail.referral.id,
      detail.referral.status,
      detail.referral.urgency,
      detail.gates.readiness.status,
      detail.gates.readiness.ready,
      detail.gates.readiness.reasonCodes.join(" | "),
      detail.gates.intake.status,
      detail.gates.eligibility.status,
      detail.gates.payerAuthorization.verificationStatus,
      detail.gates.payerAuthorization.authorizationStatus,
      detail.gates.consent.status,
      detail.gates.cans.status,
      detail.gates.capacity.status,
      rowCount(
        `SELECT COUNT(*) AS count FROM m21_ccmg_audit_events
         WHERE referral_id = ? AND action LIKE 'referral_gate_%_recorded'`,
        detail.referral.id,
      ),
      detail.referral.version,
      detail.gates.readiness.evaluatedAt,
      detail.referral.evidenceClass,
    ]),
  ),
);

const lineageRows = [...newDetail.cansLineage.versions, ...existingDetail.cansLineage.versions]
  .flatMap((assessment) => {
    const routes = assessment.referralId === newDetail.referral.id
      ? newDetail.cansLineage.routes
      : existingDetail.cansLineage.routes;
    return routes
      .filter((route) => route.cansAssessmentId === assessment.id)
      .map((route) => ({ assessment, route }));
  });
assert(
  lineageRows.length === 8 &&
    new Set(lineageRows.map(({ route }) => route.targetType)).size === 2,
  "Executed lineage does not contain eight rows across both target types.",
);
write(
  path.join(directories.lineage, "M2_1_CANS_LINEAGE_EXECUTION.csv"),
  csv(
    [
      "referral_id",
      "assessment_id",
      "assessment_version",
      "instrument_version",
      "assessment_status",
      "previous_assessment_id",
      "acuity",
      "target_type",
      "target_record_id",
      "target_version",
      "target_approval_status",
      "target_approved_by",
      "target_approved_at",
      "routed_by",
      "routed_at",
      "mapped_goal_count",
      "evidence_class",
    ],
    lineageRows.map(({ assessment, route }) => [
      assessment.referralId,
      assessment.id,
      assessment.version,
      assessment.instrumentVersion,
      assessment.status,
      assessment.previousAssessmentId,
      assessment.acuity,
      route.targetType,
      route.targetRecordId,
      route.targetVersion,
      route.targetApprovalStatus,
      route.targetApprovedBy,
      route.targetApprovedAt,
      route.routedBy,
      route.routedAt,
      route.mappedGoals.length,
      assessment.evidenceClass,
    ]),
  ),
);

writeJson(
  path.join(directories.workflow, "M2_1_WORKFLOW_EXECUTION.json"),
  {
    status: "PASS",
    dataPosture: "fictional-synthetic-prototype-only",
    cansHandoffBypassDenied,
    assignment,
    handoffInitiated,
    handoffAccepted,
    transitioned,
    exceptionOpened,
    exceptionResolved,
    urgentEscalation,
    medicationAlert: urgentMedicationAlert,
    medicationDisposition: urgentMedicationApproval,
    rejectedHandoff,
    selfApprovalDenied,
  },
);

const scenarioResults = [
  {
    file: "SCN-M21-001_NEW_REFERRAL_RESULT.json",
    result: {
      id: "SCN-M21-001",
      name: "New referral",
      status: "PASS",
      evidenceClass: "synthetic_demo",
      actual: {
        persistedFinalStatus: newDetail.referral.status,
        referralVersion: newDetail.referral.version,
        gateAuditCount: rowCount(
          `SELECT COUNT(*) AS count FROM m21_ccmg_audit_events
           WHERE referral_id = ? AND action LIKE 'referral_gate_%_recorded'`,
          newDetail.referral.id,
        ),
        finalCansAssessmentId: newCans.assessment.id,
        finalCansVersion: newCans.assessment.version,
        approvedTargetTypes: [
          newMhtcmRoute.lineage.targetType,
          newMhrsRoute.lineage.targetType,
        ],
        routeCount: rowCount(
          "SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE cans_assessment_id = ?",
          newCans.assessment.id,
        ),
        acceptedHandoffCount: rowCount(
          "SELECT COUNT(*) AS count FROM m21_ccmg_handoffs WHERE referral_id = ? AND status = 'accepted'",
          newDetail.referral.id,
        ),
        correlationId: newCorrelationId,
      },
    },
  },
  {
    file: "SCN-M21-002_EXISTING_YOUTH_RESULT.json",
    result: {
      id: "SCN-M21-002",
      name: "Existing youth",
      status: "PASS",
      evidenceClass: "synthetic_demo",
      actual: {
        persistedFinalStatus: existingDetail.referral.status,
        cansVersions: existingDetail.cansLineage.versions.map(
          (assessment) => assessment.version,
        ),
        appendedAssessmentId: existingCans.assessment.id,
        appendedVersion: existingCans.assessment.version,
        previousAssessmentId: existingCans.assessment.previousAssessmentId,
        priorVersionsUnchanged:
          JSON.stringify(afterExistingCansRows) ===
          JSON.stringify(priorExistingCansRows),
        v3TargetTypes: existingDetail.cansLineage.routes
          .filter((route) => route.cansAssessmentId === existingCans.assessment.id)
          .map((route) => route.targetType),
        v3RouteCount: rowCount(
          "SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE cans_assessment_id = ?",
          existingCans.assessment.id,
        ),
        correlationId: existingCorrelationId,
      },
    },
  },
  {
    file: "SCN-M21-003_HELD_AND_REJECTED_REFERRAL_RESULT.json",
    result: {
      id: "SCN-M21-003",
      name: "Held and rejected referral",
      status: "PASS",
      evidenceClass: "synthetic_demo",
      actual: {
        initialStatus: "held",
        persistedFinalStatus: rejectedDetail.referral.status,
        persistedRejectionReason: rejectedDetail.referral.rejectionReason,
        postRejectionRouteDenied,
        lineageCount: rowCount(
          "SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE referral_id = ?",
          rejectedDetail.referral.id,
        ),
        correlationId: rejectedCorrelationId,
      },
    },
  },
  {
    file: "SCN-M21-004_URGENT_ESCALATION_RESULT.json",
    result: {
      id: "SCN-M21-004",
      name: "Urgent escalation",
      status: "PASS",
      evidenceClass: "synthetic_demo",
      actual: {
        urgency: urgentDetail.referral.urgency,
        escalationLevel: urgentEscalation.workItem.escalationLevel,
        medicationAlertWorkItemId: urgentMedicationAlert.workItem.id,
        medicationAlertPriority: urgentMedicationAlert.workItem.priority,
        medicationAlertAssignedTo: urgentMedicationAlert.workItem.assignedTo,
        medicationDisposition: urgentMedicationApproval.workItem.approvalStatus,
        medicationDispositionStatus: urgentMedicationApproval.workItem.status,
        medicationApprovedBy: urgentMedicationApproval.workItem.approvedBy,
        correlationId: urgentCorrelationId,
      },
    },
  },
] as const;
scenarioResults.forEach(({ file, result }) =>
  writeJson(path.join(directories.scenarios, file), result),
);

write(
  path.join(directories.scenarios, "M2_1_SCENARIO_EXECUTION_REPORT.md"),
  `# M2.1 Synthetic Scenario Execution Report

Result: **PASS — 4/4 controlled scenarios executed end to end**  
As-of time: ${AS_OF}  
Data posture: fictional and synthetic prototype evidence only; production evidence not supplied

| Scenario | Result | Persisted demonstrated outcome |
|---|---|---|
| SCN-M21-001 — New referral | PASS | Six gate decisions persisted; CANS v1 finalized; approved MHTCM and MHRS targets, work items, and accepted handoffs created; referral reached active |
| SCN-M21-002 — Existing youth | PASS | Immutable CANS v1/v2 preserved; v3 appended and routed only to exact approved MHTCM and MHRS targets; referral remained active |
| SCN-M21-003 — Held and rejected referral | PASS | Held referral persisted as rejected with a reason; post-rejection route was denied and no lineage was created |
| SCN-M21-004 — Urgent escalation | PASS | Oversight escalated to executive; nurse-owned critical medication alert created; clinical director independently approved and completed the alert |

## Control results

- CCMG Program Director received all six queue summaries.
- All non-supervisory assigned-work roles are constrained to the authenticated actor's exact assignments by the focused test suite.
- A generic CANS handoff without exact finalized CANS and approved target lineage was denied and audited.
- Receiving-owner acceptance transferred accountability; a rejected handoff restored the sender and opened an exception.
- Queue-specific independent approval succeeded; self-approval was denied and audited.
- Every scenario mutation used a stable case-level correlation key.
- All five required audit classes were emitted, immutable, and passed the audit contract validator.

Milestone-owner acceptance remains pending. This report does not represent production validation.
`,
);

const auditRows = db
  .prepare("SELECT * FROM m21_ccmg_audit_events ORDER BY occurred_at,id")
  .all() as Array<Record<string, unknown>>;
const auditEvents = auditRows.map(auditEventFromRow);
const invalidAuditEvents = auditEvents
  .map((event) => ({ id: event.id, findings: validateAuditEvent(event) }))
  .filter((result) => result.findings.length > 0);
assert(invalidAuditEvents.length === 0, "Generated audit events failed validation.");
assert(
  new Set(auditEvents.map((event) => event.eventType)).size === 5,
  "All five M2.1 audit event classes were not emitted.",
);
write(
  path.join(directories.scenarios, "M2_1_AUDIT_EXECUTION.csv"),
  csv(
    [
      "event_id",
      "event_type",
      "action",
      "entity_type",
      "entity_id",
      "case_id",
      "referral_id",
      "work_item_id",
      "actor_id",
      "actor_role",
      "reason",
      "changed_fields",
      "correlation_id",
      "occurred_at",
      "evidence_class",
      "validation_findings",
    ],
    auditEvents.map((event) => [
      event.id,
      event.eventType,
      event.action,
      event.entityType,
      event.entityId,
      event.caseId,
      event.referralId,
      event.workItemId,
      event.actorId,
      event.actorRole,
      event.reason,
      event.changedFields.join(" | "),
      event.correlationId,
      event.occurredAt,
      event.evidenceClass,
      validateAuditEvent(event).join(" | "),
    ]),
  ),
);

const productionRows = (
  db
    .prepare(`
      SELECT (
        (SELECT COUNT(*) FROM m21_ccmg_referrals WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_cans_assessments WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_plan_lineage WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_work_items WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_handoffs WHERE evidence_class = 'production') +
        (SELECT COUNT(*) FROM m21_ccmg_audit_events WHERE evidence_class = 'production')
      ) AS count
    `)
    .get() as { count: number }
).count;
assert(productionRows === 0, "Production evidence rows were unexpectedly created.");

writeJson(
  path.join(directories.qa, "M2_1_EXECUTION_RECONCILIATION.json"),
  {
    status: "PASS",
    asOf: AS_OF,
    dataPosture: "fictional-synthetic-prototype-only",
    migrations,
    rolesExecuted: dashboards.length,
    directorVisibleQueues: directorDashboard.actor.visibleQueueIds,
    directorMetrics: directorDashboard.metrics,
    intakeScenarios: details.length,
    lineageRows: lineageRows.length,
    lineageTargetTypes: ["mhtcm_plan", "mhrs_skills_goals"],
    trueEndToEnd: {
      newReferral: {
        finalStatus: newDetail.referral.status,
        gateAuditCount: 6,
        cansVersion: newCans.assessment.version,
        routeCount: 2,
        correlationId: newCorrelationId,
      },
      existingYouth: {
        finalStatus: existingDetail.referral.status,
        appendedCansVersion: existingCans.assessment.version,
        priorVersionsUnchanged: true,
        newRouteCount: 2,
        correlationId: existingCorrelationId,
      },
      heldRejected: {
        finalStatus: rejectedDetail.referral.status,
        routeDenied: postRejectionRouteDenied.denied,
        lineageCount: 0,
        correlationId: rejectedCorrelationId,
      },
      urgent: {
        escalationLevel: urgentEscalation.workItem.escalationLevel,
        medicationDisposition: urgentMedicationApproval.workItem.approvalStatus,
        medicationStatus: urgentMedicationApproval.workItem.status,
        correlationId: urgentCorrelationId,
      },
    },
    workflowActions: [
      "six_gate_decisions",
      "cans_version_finalized",
      "dual_target_routes_approved",
      "assignment",
      "handoff_bypass_denied",
      "handoff_initiated",
      "handoff_accepted",
      "handoff_rejected",
      "transition",
      "exception_opened",
      "exception_resolved",
      "independent_approval",
      "urgent_escalation",
      "medication_alert_created",
      "medication_alert_approved",
      "self_approval_denied",
    ],
    auditEvents: auditEvents.length,
    auditClasses: [...new Set(auditEvents.map((event) => event.eventType))],
    invalidAuditEvents,
    scenarios: scenarioResults.map(({ result }) => ({
      id: result.id,
      name: result.name,
      status: result.status,
    })),
    productionRows,
    ownerAcceptance: "pending",
  },
);

db.close();
try {
  fs.rmSync(runtimeDatabasePath, { force: true });
} catch {
  // The imported connection may still own the disposable file on some hosts.
}

console.log(
  JSON.stringify(
    {
      status: "PASS",
      evidenceRoot,
      scenarios: scenarioResults.length,
      endToEndScenarios: scenarioResults.length,
      newReferralFinalStatus: newDetail.referral.status,
      existingCansVersion: existingCans.assessment.version,
      rejectedReferralFinalStatus: rejectedDetail.referral.status,
      urgentMedicationDisposition:
        urgentMedicationApproval.workItem.approvalStatus,
      lineageRows: lineageRows.length,
      auditEvents: auditEvents.length,
      productionRows,
      ownerAcceptance: "pending",
    },
    null,
    2,
  ),
);
