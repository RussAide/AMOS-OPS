import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DX1_CRITERION_IDS,
  DX1_PILOT_STAGE_IDS,
  DX1_SCENARIO_ID,
} from "../api/services/dx1";
import {
  DX1_BASELINE_CONTROL_FILES,
  DX1_CRITERION_EVIDENCE_FILES,
  DX1_EVIDENCE_FILES,
  assertDx1Evidence,
  atomicWriteDx1,
  dx1FileRecord,
  dx1MilestoneRoot,
  hashDx1,
  parseDx1EvidenceOptions,
  stableDx1Json,
} from "./dx1-evidence-common";

function readJson(filePath: string) {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
}

function exactIds(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length &&
    [...actual].sort().every((value, index) => value === [...expected].sort()[index])
  );
}

export function verifyDx1Evidence(options: {
  readonly root: string;
  readonly output: string;
}) {
  const requiredNames = [
    DX1_EVIDENCE_FILES.inherited,
    DX1_EVIDENCE_FILES.integrated,
    DX1_EVIDENCE_FILES.audit,
    DX1_EVIDENCE_FILES.pilot,
    DX1_EVIDENCE_FILES.summary,
    DX1_EVIDENCE_FILES.manifest,
    DX1_EVIDENCE_FILES.checksums,
    ...DX1_CRITERION_IDS.map(
      (criterionId) => DX1_CRITERION_EVIDENCE_FILES[criterionId],
    ),
  ];
  for (const name of requiredNames)
    assertDx1Evidence(
      fs.existsSync(path.join(options.output, name)),
      `DX.1 evidence file is missing: ${name}`,
    );

  const manifest = readJson(path.join(options.output, DX1_EVIDENCE_FILES.manifest));
  const integrated = readJson(path.join(options.output, DX1_EVIDENCE_FILES.integrated));
  const inherited = readJson(path.join(options.output, DX1_EVIDENCE_FILES.inherited));
  const audit = readJson(path.join(options.output, DX1_EVIDENCE_FILES.audit));
  const pilot = readJson(path.join(options.output, DX1_EVIDENCE_FILES.pilot));

  assertDx1Evidence(manifest.acceptance === "ACCEPTED", "DX1_MANIFEST_NOT_ACCEPTED");
  assertDx1Evidence(manifest.criteriaComplete === 12, "DX1_MANIFEST_CRITERIA_INCOMPLETE");
  assertDx1Evidence(manifest.criteriaExpected === 12, "DX1_MANIFEST_CRITERIA_DRIFT");
  assertDx1Evidence(integrated.accepted === true, "DX1_INTEGRATED_RESULT_NOT_ACCEPTED");
  assertDx1Evidence(integrated.assertionCount === 96, "DX1_ASSERTION_COUNT_MISMATCH");
  assertDx1Evidence(integrated.scenarioId === DX1_SCENARIO_ID, "DX1_SCENARIO_ID_MISMATCH");
  assertDx1Evidence(inherited.status === "PASS", "DX1_INHERITED_BASELINE_NOT_PASS");
  assertDx1Evidence(inherited.inheritedFilesMissing === 0, "DX1_PARENT_FILES_MISSING");
  assertDx1Evidence(inherited.inheritedFilesChanged === 0, "DX1_UNAPPROVED_PARENT_CHANGE");

  const criteria = integrated.criteria as Array<Record<string, unknown>>;
  assertDx1Evidence(
    exactIds(
      criteria.map((criterion) => String(criterion.criterionId)),
      DX1_CRITERION_IDS,
    ),
    "DX1_CRITERION_INVENTORY_MISMATCH",
  );
  for (const criterionId of DX1_CRITERION_IDS) {
    const record = readJson(
      path.join(options.output, DX1_CRITERION_EVIDENCE_FILES[criterionId]),
    );
    assertDx1Evidence(record.criterionId === criterionId, `DX1_CRITERION_FILE_MISMATCH:${criterionId}`);
    assertDx1Evidence(record.status === "Complete", `DX1_CRITERION_NOT_COMPLETE:${criterionId}`);
    assertDx1Evidence(record.passed === true, `DX1_CRITERION_NOT_PASS:${criterionId}`);
    assertDx1Evidence(
      typeof record.assertionCount === "number" && record.assertionCount > 0,
      `DX1_CRITERION_ASSERTIONS_MISSING:${criterionId}`,
    );
  }

  const auditEvents = audit.events as Array<Record<string, unknown>>;
  assertDx1Evidence(audit.eventCount === 60, "DX1_AUDIT_EVENT_COUNT_MISMATCH");
  assertDx1Evidence(auditEvents.length === 60, "DX1_AUDIT_HISTORY_INCOMPLETE");
  assertDx1Evidence(
    new Set(auditEvents.map((event) => String(event.eventId))).size === 60,
    "DX1_AUDIT_EVENT_ID_NOT_UNIQUE",
  );
  assertDx1Evidence(
    auditEvents.every(
      (event) => event.scenarioId === DX1_SCENARIO_ID && event.synthetic === true,
    ),
    "DX1_AUDIT_SCENARIO_BOUNDARY_MISMATCH",
  );

  const stages = pilot.stages as Array<Record<string, unknown>>;
  assertDx1Evidence(pilot.completedStageCount === 8, "DX1_PILOT_STAGE_COUNT_MISMATCH");
  assertDx1Evidence(
    JSON.stringify(stages.map((stage) => stage.stageId)) ===
      JSON.stringify(DX1_PILOT_STAGE_IDS),
    "DX1_PILOT_STAGE_ORDER_MISMATCH",
  );
  assertDx1Evidence(pilot.partialSideEffectCount === 0, "DX1_PILOT_PARTIAL_SIDE_EFFECT");

  const boundary = integrated.boundary as Record<string, unknown>;
  assertDx1Evidence(boundary.synthetic === true && boundary.demoMode === true, "DX1_BOUNDARY_MISSING");
  for (const [key, value] of Object.entries(boundary)) {
    if (key === "synthetic" || key === "demoMode") continue;
    assertDx1Evidence(value === 0, `DX1_ZERO_LIVE_BOUNDARY_VIOLATION:${key}`);
  }

  const checksumLines = fs
    .readFileSync(path.join(options.output, DX1_EVIDENCE_FILES.checksums), "utf8")
    .trim()
    .split("\n")
    .filter(Boolean);
  assertDx1Evidence(checksumLines.length === 18, "DX1_CHECKSUM_ENTRY_COUNT_MISMATCH");
  for (const line of checksumLines) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertDx1Evidence(match, `DX1_CHECKSUM_LINE_INVALID:${line}`);
    const [, expected, name] = match;
    const absolute = path.join(options.output, name);
    assertDx1Evidence(fs.existsSync(absolute), `DX1_CHECKSUM_TARGET_MISSING:${name}`);
    assertDx1Evidence(
      hashDx1(fs.readFileSync(absolute)) === expected,
      `DX1_CHECKSUM_MISMATCH:${name}`,
    );
  }

  const controlsRoot = path.join(dx1MilestoneRoot(options.root), "controls");
  const controlRecords = manifest.controls as Array<Record<string, unknown>>;
  assertDx1Evidence(
    controlRecords.length === DX1_BASELINE_CONTROL_FILES.length,
    "DX1_CONTROL_REFERENCE_COUNT_MISMATCH",
  );
  for (const name of DX1_BASELINE_CONTROL_FILES) {
    const current = dx1FileRecord(path.join(controlsRoot, name), `controls/${name}`);
    const recorded = controlRecords.find((record) => record.path === current.path);
    assertDx1Evidence(recorded, `DX1_CONTROL_REFERENCE_MISSING:${name}`);
    assertDx1Evidence(recorded.sha256 === current.sha256, `DX1_CONTROL_HASH_MISMATCH:${name}`);
  }

  const verification = Object.freeze({
    schemaVersion: "1.0",
    recordId: "AMOS-OPS-DX1-EVIDENCE-VERIFICATION",
    milestone: "DX.1",
    status: "PASS",
    criteriaVerified: 12,
    assertionCount: 96,
    auditEventsVerified: 60,
    pilotStagesVerified: 8,
    checksumEntriesVerified: checksumLines.length,
    controlReferencesVerified: DX1_BASELINE_CONTROL_FILES.length,
    inheritedBaselineVerified: true,
    zeroLiveBoundaryVerified: true,
    productionRows: 0,
    liveExternalCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    liveClinicalScoringActivations: 0,
    liveLevelOfCareDecisions: 0,
    deployments: 0,
    githubPushes: 0,
    usesProductionData: false,
    synthetic: true,
  });
  atomicWriteDx1(
    path.join(options.output, DX1_EVIDENCE_FILES.verification),
    stableDx1Json(verification),
  );
  return verification;
}

const options = parseDx1EvidenceOptions(process.argv.slice(2));
const result = verifyDx1Evidence(options);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
