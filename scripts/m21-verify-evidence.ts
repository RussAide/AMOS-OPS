import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  CCMG_AUDIT_EVENT_TYPES,
  CCMG_QUEUE_IDS,
  visibleQueueIdsForRole,
} from "../contracts/ccmg";

const evidenceRoot = path.resolve(process.argv[2] ?? "../evidence");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  assert(!quoted, "CSV ended inside a quoted field.");
  return rows.filter((candidate) => candidate.some((entry) => entry !== ""));
}

function readCsv(relativePath: string): Array<Record<string, string>> {
  const rows = parseCsv(
    fs.readFileSync(path.join(evidenceRoot, relativePath), "utf8"),
  );
  const headers = rows[0];
  assert(headers, `${relativePath} has no header row.`);
  return rows.slice(1).map((row, rowIndex) => {
    assert(
      row.length === headers.length,
      `${relativePath} row ${rowIndex + 2} has ${row.length} cells; expected ${headers.length}.`,
    );
    return Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? ""]),
    );
  });
}

const queueRows = readCsv(
  "01_Roles_and_Queues/M2_1_QUEUE_INVENTORY.csv",
);
const requiredQueueNames = new Map([
  ["intake", "Intake"],
  ["qa", "QA"],
  ["cans", "CANS"],
  ["medication_management", "Medication-management oversight"],
  ["mhtcm", "MHTCM"],
  ["mhrs", "MHRS"],
]);
for (const queueId of CCMG_QUEUE_IDS) {
  const requiredName = requiredQueueNames.get(queueId);
  assert(requiredName, `No evidence-name mapping for queue ${queueId}.`);
  assert(
    queueRows.some((row) => row.queue_name === requiredName),
    `Evidence inventory is missing required queue ${requiredName}.`,
  );
}
assert(
  queueRows.some((row) => row.queue_name === "Cross-divisional handoffs"),
  "Evidence inventory is missing the cross-divisional handoff control queue.",
);

const roleRows = readCsv(
  "01_Roles_and_Queues/M2_1_ROLE_ACCESS_MATRIX.csv",
);
for (const role of [
  "ccmg-program-director",
  "bhc-director",
  "intake-coordinator",
  "chart-auditor",
  "mhtcm-supervisor",
  "mhrs-supervisor",
]) {
  assert(
    roleRows.some((row) => row.role_id === role),
    `Role/access matrix is missing ${role}.`,
  );
}
assert(
  JSON.stringify(visibleQueueIdsForRole("ccmg-program-director")) ===
    JSON.stringify(CCMG_QUEUE_IDS),
  "Implemented CCMG Program Director access does not cover all six queues.",
);
assert(
  JSON.stringify(visibleQueueIdsForRole("bhc-director")) ===
    JSON.stringify(CCMG_QUEUE_IDS),
  "Implemented BHC Director access does not cover all six queues.",
);

const auditRows = readCsv("05_Audit/M2_1_AUDIT_EVENT_REGISTER.csv");
assert(
  auditRows.length >= 17,
  `Expected at least 17 controlled audit events; found ${auditRows.length}.`,
);
const auditEvidenceClasses = new Set(
  auditRows.flatMap((row) => {
    const type = row.event_type;
    if (type.startsWith("ACCESS_")) return ["access"];
    if (type === "QUEUE_ASSIGNMENT_CHANGED") return ["assignment"];
    if (type === "APPROVAL_DECIDED") return ["approval"];
    if (type.startsWith("PLAN_HANDOFF_")) return ["plan_handoff"];
    if (
      type === "MATERIAL_CHANGE_RECORDED" ||
      type.startsWith("CANS_VERSION_") ||
      type === "INTAKE_GATE_DECIDED"
    ) {
      return ["material_change"];
    }
    return [];
  }),
);
for (const eventType of CCMG_AUDIT_EVENT_TYPES) {
  assert(
    auditEvidenceClasses.has(eventType),
    `Evidence register does not map implemented audit class ${eventType}.`,
  );
}

const scenarioRows = readCsv(
  "06_Scenarios/M2_1_SYNTHETIC_SCENARIO_INVENTORY.csv",
);
assert(scenarioRows.length === 4, `Expected 4 scenarios; found ${scenarioRows.length}.`);
assert(
  JSON.stringify(scenarioRows.map((row) => row.scenario_id)) ===
    JSON.stringify([
      "SCN-M21-001",
      "SCN-M21-002",
      "SCN-M21-003",
      "SCN-M21-004",
    ]),
  "Scenario identity or ordering drifted.",
);
for (const scenario of scenarioRows) {
  assert(scenario.data_mode === "Synthetic only", `${scenario.scenario_id} is not synthetic-only.`);
  assert(
    scenario.production_evidence === "Not supplied",
    `${scenario.scenario_id} incorrectly claims production evidence.`,
  );
  assert(
    scenario.implementation_evidence_status.startsWith("Complete"),
    `${scenario.scenario_id} has no completed implementation evidence.`,
  );
  assert(
    scenario.automated_result.startsWith("PASS"),
    `${scenario.scenario_id} does not have a passing automated result.`,
  );
}

const acceptanceRows = readCsv(
  "08_Acceptance/M2_1_ACCEPTANCE_MATRIX.csv",
);
assert(acceptanceRows.length === 8, `Expected 8 acceptance rows; found ${acceptanceRows.length}.`);
assert(
  JSON.stringify(acceptanceRows.map((row) => row.criterion_id)) ===
    JSON.stringify([
      "M2.1-01",
      "M2.1-02",
      "M2.1-03",
      "M2.1-04",
      "M2.1-05",
      "M2.1-06",
      "M2.1-07",
      "M2.1-GATE",
    ]),
  "Acceptance-matrix criteria drifted.",
);
for (const row of acceptanceRows) {
  assert(
    row.owner_acceptance.startsWith("Pending"),
    `${row.criterion_id} incorrectly claims owner acceptance.`,
  );
  assert(
    row.production_evidence === "Not supplied",
    `${row.criterion_id} incorrectly claims production evidence.`,
  );
  assert(
    row.automated_result.startsWith("PASS"),
    `${row.criterion_id} does not have a passing automated result.`,
  );
  assert(
    row.current_disposition ===
      "Complete — awaiting milestone-owner acceptance",
    `${row.criterion_id} disposition is not reconciled to completed automated work.`,
  );
}

const checklistRows = readCsv(
  "90_Manifest_and_QA/M2_1_CHECKLIST_CONTROL.csv",
);
assert(
  checklistRows.length === 7,
  `Expected 7 checklist-control rows; found ${checklistRows.length}.`,
);
assert(
  checklistRows.every(
    (row) => row.status === "Complete" && row.owner_acceptance === "Pending",
  ),
  "Checklist control is not complete with owner acceptance pending.",
);

const intakeExecution = readCsv(
  "01_Intake_Eligibility_and_Capacity/M2_1_INTAKE_GATE_EXECUTION.csv",
);
assert(
  intakeExecution.length === 4,
  `Expected 4 executed intake scenarios; found ${intakeExecution.length}.`,
);
assert(
  intakeExecution.every((row) => row.evidence_class === "synthetic_demo"),
  "Intake execution contains a non-synthetic row.",
);
const newReferralExecution = intakeExecution.find(
  (row) => row.referral_id === "M21-REF-NEW-001",
);
const rejectedReferralExecution = intakeExecution.find(
  (row) => row.referral_id === "M21-REF-HELD-001",
);
assert(
  newReferralExecution?.scenario_status === "active" &&
    newReferralExecution.gate_audit_count === "6" &&
    newReferralExecution.intake_status === "complete" &&
    newReferralExecution.eligibility_status === "eligible" &&
    newReferralExecution.payer_verification_status === "verified" &&
    newReferralExecution.authorization_status === "approved" &&
    newReferralExecution.consent_status === "active" &&
    newReferralExecution.cans_status === "completed" &&
    newReferralExecution.capacity_status === "reserved",
  "New-referral execution did not persist all six passing gates and active disposition.",
);
assert(
  rejectedReferralExecution?.scenario_status === "rejected" &&
    rejectedReferralExecution.eligibility_status === "ineligible",
  "Held-referral execution did not persist the rejected disposition.",
);

const roleQueueExecution = readCsv(
  "02_CCMG_Oversight_Queues/M2_1_ROLE_QUEUE_EXECUTION.csv",
);
const directorQueueRows = roleQueueExecution.filter(
  (row) => row.actor_role === "ccmg-program-director",
);
assert(
  directorQueueRows.length === 6 &&
    directorQueueRows.every((row) => row.queue_visible === "true"),
  "Executed CCMG Program Director evidence does not cover all six visible queues.",
);

const lineageExecution = readCsv(
  "03_CANS_Plan_Lineage/M2_1_CANS_LINEAGE_EXECUTION.csv",
);
assert(
  lineageExecution.length === 8,
  `Expected 8 executed lineage rows; found ${lineageExecution.length}.`,
);
assert(
  new Set(lineageExecution.map((row) => row.target_type)).size === 2 &&
    lineageExecution.every(
      (row) => row.target_approval_status === "approved",
    ),
  "Executed lineage does not cover both approved target types.",
);
for (const [referralId, assessmentVersion] of [
  ["M21-REF-NEW-001", "1"],
  ["M21-REF-EXISTING-001", "3"],
] as const) {
  const exactVersionRoutes = lineageExecution.filter(
    (row) =>
      row.referral_id === referralId &&
      row.assessment_version === assessmentVersion,
  );
  assert(
    exactVersionRoutes.length === 2 &&
      new Set(exactVersionRoutes.map((row) => row.target_type)).size === 2,
    `${referralId} CANS v${assessmentVersion} is not routed to both exact targets.`,
  );
}

const auditExecution = readCsv(
  "06_Audit_and_Scenarios/M2_1_AUDIT_EXECUTION.csv",
);
const executedAuditTypes = new Set(
  auditExecution.map((row) => row.event_type),
);
for (const eventType of CCMG_AUDIT_EVENT_TYPES) {
  assert(
    executedAuditTypes.has(eventType),
    `Execution evidence is missing audit class ${eventType}.`,
  );
}
assert(
  auditExecution.every((row) => row.validation_findings === ""),
  "An executed audit row has validation findings.",
);

const scenarioResultFiles = [
  "SCN-M21-001_NEW_REFERRAL_RESULT.json",
  "SCN-M21-002_EXISTING_YOUTH_RESULT.json",
  "SCN-M21-003_HELD_AND_REJECTED_REFERRAL_RESULT.json",
  "SCN-M21-004_URGENT_ESCALATION_RESULT.json",
];
const scenarioPayloads = new Map<string, {
  status?: string;
  evidenceClass?: string;
  actual?: Record<string, unknown>;
}>();
for (const fileName of scenarioResultFiles) {
  const result = JSON.parse(
    fs.readFileSync(
      path.join(evidenceRoot, "06_Audit_and_Scenarios", fileName),
      "utf8",
    ),
  ) as {
    status?: string;
    evidenceClass?: string;
    actual?: Record<string, unknown>;
  };
  assert(result.status === "PASS", `${fileName} is not PASS.`);
  assert(
    result.evidenceClass === "synthetic_demo",
    `${fileName} is not labeled synthetic_demo.`,
  );
  scenarioPayloads.set(fileName, result);
}

const newScenario = scenarioPayloads.get(
  "SCN-M21-001_NEW_REFERRAL_RESULT.json",
)?.actual;
assert(
  newScenario?.persistedFinalStatus === "active" &&
    newScenario.gateAuditCount === 6 &&
    newScenario.finalCansVersion === 1 &&
    newScenario.routeCount === 2 &&
    JSON.stringify(newScenario.approvedTargetTypes) ===
      JSON.stringify(["mhtcm_plan", "mhrs_skills_goals"]) &&
    newScenario.correlationId === "M21-CORR-M21-CASE-NEW-001",
  "New-referral scenario is not true end-to-end persisted evidence.",
);
const existingScenario = scenarioPayloads.get(
  "SCN-M21-002_EXISTING_YOUTH_RESULT.json",
)?.actual;
assert(
  existingScenario?.persistedFinalStatus === "active" &&
    existingScenario.appendedVersion === 3 &&
    existingScenario.previousAssessmentId === "M21-CANS-EXISTING-V2" &&
    existingScenario.priorVersionsUnchanged === true &&
    existingScenario.v3RouteCount === 2 &&
    Array.isArray(existingScenario.v3TargetTypes) &&
    existingScenario.v3TargetTypes.length === 2 &&
    new Set(existingScenario.v3TargetTypes).has("mhtcm_plan") &&
    new Set(existingScenario.v3TargetTypes).has("mhrs_skills_goals") &&
    existingScenario.correlationId ===
      "M21-CORR-M21-CASE-EXISTING-001",
  "Existing-youth scenario did not append and route immutable CANS v3.",
);
const rejectedScenario = scenarioPayloads.get(
  "SCN-M21-003_HELD_AND_REJECTED_REFERRAL_RESULT.json",
)?.actual;
assert(
  rejectedScenario?.initialStatus === "held" &&
    rejectedScenario.persistedFinalStatus === "rejected" &&
    rejectedScenario.lineageCount === 0 &&
    rejectedScenario.correlationId === "M21-CORR-M21-CASE-HELD-001",
  "Held/rejected scenario is not a persisted fail-closed branch.",
);
const urgentScenario = scenarioPayloads.get(
  "SCN-M21-004_URGENT_ESCALATION_RESULT.json",
)?.actual;
assert(
  urgentScenario?.escalationLevel === "executive" &&
    urgentScenario.medicationDisposition === "approved" &&
    urgentScenario.medicationDispositionStatus === "completed" &&
    urgentScenario.medicationApprovedBy === "SYNTH-CLINICAL-DIRECTOR" &&
    urgentScenario.correlationId === "M21-CORR-M21-CASE-URGENT-001",
  "Urgent scenario did not complete medication-oversight disposition.",
);

const reconciliation = JSON.parse(
  fs.readFileSync(
    path.join(
      evidenceRoot,
      "90_Manifest_and_QA/M2_1_EXECUTION_RECONCILIATION.json",
    ),
    "utf8",
  ),
) as {
  status?: string;
  rolesExecuted?: number;
  scenarios?: unknown[];
  lineageRows?: number;
  auditEvents?: number;
  productionRows?: number;
  ownerAcceptance?: string;
  trueEndToEnd?: {
    newReferral?: {
      finalStatus?: string;
      gateAuditCount?: number;
      cansVersion?: number;
      routeCount?: number;
    };
    existingYouth?: {
      finalStatus?: string;
      appendedCansVersion?: number;
      priorVersionsUnchanged?: boolean;
      newRouteCount?: number;
    };
    heldRejected?: {
      finalStatus?: string;
      routeDenied?: boolean;
      lineageCount?: number;
    };
    urgent?: {
      escalationLevel?: string;
      medicationDisposition?: string;
      medicationStatus?: string;
    };
  };
};
assert(reconciliation.status === "PASS", "Execution reconciliation is not PASS.");
assert(reconciliation.rolesExecuted === 11, "Role-execution count drifted.");
assert(reconciliation.scenarios?.length === 4, "Scenario reconciliation count drifted.");
assert(reconciliation.lineageRows === 8, "Lineage reconciliation count drifted.");
assert(
  reconciliation.trueEndToEnd?.newReferral?.finalStatus === "active" &&
    reconciliation.trueEndToEnd.newReferral.gateAuditCount === 6 &&
    reconciliation.trueEndToEnd.newReferral.cansVersion === 1 &&
    reconciliation.trueEndToEnd.newReferral.routeCount === 2,
  "Reconciliation does not prove the new-referral end-to-end path.",
);
assert(
  reconciliation.trueEndToEnd?.existingYouth?.finalStatus === "active" &&
    reconciliation.trueEndToEnd.existingYouth.appendedCansVersion === 3 &&
    reconciliation.trueEndToEnd.existingYouth.priorVersionsUnchanged === true &&
    reconciliation.trueEndToEnd.existingYouth.newRouteCount === 2,
  "Reconciliation does not prove the existing-youth end-to-end path.",
);
assert(
  reconciliation.trueEndToEnd?.heldRejected?.finalStatus === "rejected" &&
    reconciliation.trueEndToEnd.heldRejected.routeDenied === true &&
    reconciliation.trueEndToEnd.heldRejected.lineageCount === 0,
  "Reconciliation does not prove persisted rejection and route denial.",
);
assert(
  reconciliation.trueEndToEnd?.urgent?.escalationLevel === "executive" &&
    reconciliation.trueEndToEnd.urgent.medicationDisposition === "approved" &&
    reconciliation.trueEndToEnd.urgent.medicationStatus === "completed",
  "Reconciliation does not prove urgent medication-oversight disposition.",
);
assert(reconciliation.productionRows === 0, "Execution evidence contains production rows.");
assert(reconciliation.ownerAcceptance === "pending", "Owner acceptance was prematurely claimed.");

const allEvidenceText = fs
  .readdirSync(evidenceRoot, { recursive: true })
  .filter((entry) => typeof entry === "string")
  .map((entry) => path.join(evidenceRoot, entry))
  .filter((entry) => fs.statSync(entry).isFile())
  .map((entry) => fs.readFileSync(entry, "utf8"))
  .join("\n");
assert(!/\bM1\.4\b|\bM2\.2\b/.test(allEvidenceText), "Evidence contains later-milestone scope.");
for (const stalePhrase of [
  "Pending — execution not supplied",
  "implementation behavior and execution results are **Pending",
  "They have not been executed in this evidence package",
]) {
  assert(
    !allEvidenceText.includes(stalePhrase),
    `Evidence contains stale implementation claim: ${stalePhrase}`,
  );
}

console.log(
  JSON.stringify(
    {
      status: "PASS",
      evidenceRoot,
      requiredQueues: CCMG_QUEUE_IDS.length,
      evidenceQueueRows: queueRows.length,
      roleRows: roleRows.length,
      auditRegisterRows: auditRows.length,
      scenarios: scenarioRows.length,
      executedScenarioFiles: scenarioResultFiles.length,
      acceptanceRows: acceptanceRows.length,
      checklistRows: checklistRows.length,
      intakeExecutionRows: intakeExecution.length,
      directorQueueRows: directorQueueRows.length,
      lineageExecutionRows: lineageExecution.length,
      executedAuditRows: auditExecution.length,
      productionEvidence: "not_supplied",
      ownerAcceptance: "pending",
      laterMilestoneReferences: 0,
    },
    null,
    2,
  ),
);
