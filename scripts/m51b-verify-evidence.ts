import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { M51B_CRITERION_IDS } from "@contracts/m51b/shared";
import { runM51BIntegratedScenario } from "../api/services/m51b/integration/integrated-scenario";
import {
  M51B_BASELINE_CONTROL_FILES,
  M51B_CRITERION_EVIDENCE_FILES,
  M51B_EVIDENCE_FILES,
  assertM51B,
  buildM51BCriterionEvidence,
  hashM51B,
  m51bFileRecord,
  m51bMilestoneRoot,
  parseM51BEvidenceOptions,
  stableM51BJson,
  type M51BEvidenceOptions,
} from "./m51b-export-evidence";

function readJson(filePath: string): Record<string, unknown> {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  assertM51B(
    Boolean(value) && typeof value === "object" && !Array.isArray(value),
    `M5.1B JSON record is not an object: ${filePath}`,
  );
  return value as Record<string, unknown>;
}

function checksumMap(value: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of value.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertM51B(match, `Invalid M5.1B checksum line: ${line}`);
    assertM51B(!result.has(match[2]), `Duplicate checksum: ${match[2]}`);
    result.set(match[2], match[1]);
  }
  return result;
}

function verifyControlReferences(
  manifest: Record<string, unknown>,
  root: string,
): void {
  const references = manifest.controlReferences;
  assertM51B(
    Array.isArray(references) &&
      references.length === M51B_BASELINE_CONTROL_FILES.length,
    "M5.1B control-reference inventory drifted.",
  );
  const milestoneRoot = m51bMilestoneRoot(root);
  const expectedPaths = M51B_BASELINE_CONTROL_FILES.map(
    (name) => `controls/${name}`,
  ).sort();
  const records = references as Array<Record<string, unknown>>;
  const recordedPaths = records
    .map((record) => record.path)
    .filter((value): value is string => typeof value === "string")
    .sort();
  assertM51B(
    JSON.stringify(recordedPaths) === JSON.stringify(expectedPaths),
    "M5.1B control-reference paths drifted.",
  );
  for (const record of records) {
    assertM51B(
      typeof record.path === "string" && expectedPaths.includes(record.path),
      "M5.1B control-reference path is invalid.",
    );
    const absolute = path.resolve(milestoneRoot, record.path);
    const controlsRoot = path.join(milestoneRoot, "controls");
    const relative = path.relative(controlsRoot, absolute);
    assertM51B(
      relative !== "" &&
        !relative.startsWith("..") &&
        !path.isAbsolute(relative),
      `M5.1B control reference escapes the controls root: ${record.path}`,
    );
    assertM51B(
      fs.existsSync(absolute) && fs.statSync(absolute).isFile(),
      `M5.1B referenced control is missing: ${record.path}`,
    );
    const actual = m51bFileRecord(absolute, record.path);
    assertM51B(
      record.bytes === actual.bytes,
      `M5.1B control byte count drifted: ${record.path}`,
    );
    assertM51B(
      record.sha256 === actual.sha256,
      `M5.1B control SHA-256 drifted: ${record.path}`,
    );
  }
}

function verifyEvidenceFileRecords(
  manifest: Record<string, unknown>,
  output: string,
): void {
  const records = manifest.evidenceFiles;
  const expectedPaths = [
    ...Object.values(M51B_CRITERION_EVIDENCE_FILES),
    M51B_EVIDENCE_FILES.summary,
  ].sort();
  assertM51B(
    Array.isArray(records) && records.length === expectedPaths.length,
    "M5.1B manifest evidence-file inventory drifted.",
  );
  const typedRecords = records as Array<Record<string, unknown>>;
  const paths = typedRecords
    .map((record) => record.path)
    .filter((value): value is string => typeof value === "string")
    .sort();
  assertM51B(
    JSON.stringify(paths) === JSON.stringify(expectedPaths),
    "M5.1B manifest evidence-file paths drifted.",
  );
  for (const record of typedRecords) {
    assertM51B(
      typeof record.path === "string" && expectedPaths.includes(record.path),
      "M5.1B manifest evidence-file path is invalid.",
    );
    const absolute = path.join(output, record.path);
    const actual = m51bFileRecord(absolute, record.path);
    assertM51B(
      record.bytes === actual.bytes && record.sha256 === actual.sha256,
      `M5.1B manifest evidence-file record drifted: ${record.path}`,
    );
  }
}

export async function verifyM51BEvidence(options: M51BEvidenceOptions) {
  const manifestPath = path.join(
    options.output,
    M51B_EVIDENCE_FILES.manifest,
  );
  const checksumPath = path.join(
    options.output,
    M51B_EVIDENCE_FILES.checksums,
  );
  assertM51B(fs.existsSync(manifestPath), "M5.1B manifest is missing.");
  assertM51B(fs.existsSync(checksumPath), "M5.1B checksums are missing.");
  const manifest = readJson(manifestPath);
  assertM51B(
    manifest.manifestId === "AMOS-OPS-M5.1B-ACCEPTANCE-MANIFEST" &&
      manifest.milestone === "M5.1B" &&
      manifest.disposition === "ACCEPTED" &&
      manifest.complete === true &&
      manifest.synthetic === true,
    "M5.1B manifest identity or disposition drifted.",
  );
  verifyControlReferences(manifest, options.root);

  const checksums = checksumMap(fs.readFileSync(checksumPath, "utf8"));
  const expectedNames = [
    ...Object.values(M51B_CRITERION_EVIDENCE_FILES),
    M51B_EVIDENCE_FILES.summary,
    M51B_EVIDENCE_FILES.manifest,
  ].sort();
  assertM51B(
    JSON.stringify([...checksums.keys()].sort()) ===
      JSON.stringify(expectedNames),
    "M5.1B checksum inventory drifted.",
  );
  for (const [name, expected] of checksums) {
    const absolute = path.join(options.output, name);
    assertM51B(fs.existsSync(absolute), `M5.1B evidence is missing: ${name}`);
    assertM51B(
      hashM51B(fs.readFileSync(absolute)) === expected,
      `M5.1B evidence hash mismatch: ${name}`,
    );
  }
  verifyEvidenceFileRecords(manifest, options.output);

  const storedCriterionRecords = new Map<string, Record<string, unknown>>();
  for (const criterionId of M51B_CRITERION_IDS) {
    const record = readJson(
      path.join(options.output, M51B_CRITERION_EVIDENCE_FILES[criterionId]),
    );
    assertM51B(
      record.milestone === "M5.1B" &&
        record.criterionId === criterionId &&
        record.passed === true &&
        typeof record.assertionCount === "number" &&
        record.evidenceClass ===
          "synthetic_microsoft_365_workflow_integration_demo" &&
        record.productionRows === 0 &&
        record.liveGraphCalls === 0 &&
        record.liveMicrosoftReads === 0 &&
        record.liveMicrosoftWrites === 0 &&
        record.realNotificationsSent === 0 &&
        record.liveWrites === 0 &&
        record.usesProductionData === false &&
        record.synthetic === true,
      `M5.1B criterion evidence drifted: ${criterionId}`,
    );
    storedCriterionRecords.set(criterionId, record);
  }

  const replay = await runM51BIntegratedScenario();
  const replayAssertionCount = replay.acceptanceFlags.reduce(
    (total, flag) => total + flag.assertionCount,
    0,
  );
  assertM51B(
    replay.accepted &&
      replay.acceptanceFlags.length === 8 &&
      replay.acceptanceFlags.every((flag) => flag.passed) &&
      replay.totals.assertionCount === replayAssertionCount &&
      replay.teams.primaryDelivery.timing.withinThirtySeconds &&
      replay.teams.persistentOutageDelivery.status === "dead_lettered" &&
      replay.teams.persistentOutageDelivery.attempts.length === 4 &&
      replay.teams.outageRecovery.status === "recovered" &&
      replay.teams.operationalState.activeDeadLetters === 0 &&
      replay.teams.operationalState.openAlerts === 0 &&
      replay.outlook.primarySnapshot.metrics.intakeCount === 1 &&
      replay.outlook.replay.duplicatePrevented &&
      replay.outlook.recovery.disposition === "recovered" &&
      replay.sharepoint.elapsedSeconds === 145 &&
      replay.sharepoint.withinElapsedLimit &&
      Object.values(replay.sharepoint.gateDecision.gates).every(Boolean) &&
      replay.sharepoint.exhaustedFailureRecovery.accepted &&
      replay.sharepoint.exhaustedFailureRecovery.recovery.status ===
        "recovered" &&
      replay.sharepoint.exhaustedFailureRecovery.reliabilitySnapshot
        .openDeadLetters === 0 &&
      replay.reliability.snapshot.openDeadLetters === 0 &&
      replay.reliability.snapshot.duplicateDeliveries === 0 &&
      replay.totals.liveGraphCalls === 0 &&
      replay.totals.liveMicrosoftWrites === 0 &&
      replay.totals.productionRows === 0,
    "M5.1B replay or adversarial boundary verification failed.",
  );
  const freshRecords = buildM51BCriterionEvidence(replay);
  for (const criterionId of M51B_CRITERION_IDS) {
    const stored = storedCriterionRecords.get(criterionId);
    const fresh = freshRecords[M51B_CRITERION_EVIDENCE_FILES[criterionId]];
    assertM51B(stored, `M5.1B stored criterion is missing: ${criterionId}`);
    for (const field of [
      "passed",
      "assertionCount",
      "summary",
      "evidenceIds",
      "artifacts",
    ] as const)
      assertM51B(
        stableM51BJson(stored[field]) === stableM51BJson(fresh[field]),
        `M5.1B stored criterion is not bound to fresh replay: ${criterionId}/${field}`,
      );
  }
  assertM51B(
    stableM51BJson(manifest.acceptanceCriteria) ===
      stableM51BJson(replay.acceptanceFlags) &&
      stableM51BJson(manifest.totals) === stableM51BJson(replay.totals) &&
      stableM51BJson(manifest.boundary) === stableM51BJson(replay.boundary),
    "M5.1B manifest is not bound to fresh replay.",
  );
  return Object.freeze({
    reportId: "M51B-EVIDENCE-VERIFICATION",
    milestone: "M5.1B",
    criteriaVerified: 8,
    checksumFilesVerified: checksums.size,
    assertionCount: replay.totals.assertionCount,
    passed: true,
    productionRows: 0,
    liveGraphCalls: 0,
    liveMicrosoftWrites: 0,
    liveWrites: 0,
    synthetic: true,
  });
}

const invoked = process.argv[1];
if (invoked && path.resolve(invoked) === fileURLToPath(import.meta.url)) {
  verifyM51BEvidence(parseM51BEvidenceOptions(process.argv.slice(2)))
    .then((report) =>
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`),
    )
    .catch((error) => {
      process.stderr.write(
        `M5.1B evidence verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
