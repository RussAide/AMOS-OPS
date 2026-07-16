import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { M52_CRITERION_IDS } from "@contracts/m52/shared";
import { runM52IntegratedScenario } from "../api/services/m52";
import {
  M52_BASELINE_CONTROL_FILES,
  M52_CRITERION_EVIDENCE_FILES,
  M52_EVIDENCE_FILES,
  assertM52,
  buildM52CriterionEvidence,
  hashM52,
  m52MilestoneRoot,
  parseM52EvidenceOptions,
  stableM52Json,
  type M52EvidenceOptions,
} from "./m52-export-evidence";

function readJson(filePath: string): Record<string, unknown> {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  assertM52(
    Boolean(value) && typeof value === "object" && !Array.isArray(value),
    `M5.2 JSON record is not an object: ${filePath}`,
  );
  return value as Record<string, unknown>;
}

function checksumMap(value: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of value.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertM52(match, `Invalid M5.2 checksum line: ${line}`);
    assertM52(!result.has(match[2]), `Duplicate checksum: ${match[2]}`);
    result.set(match[2], match[1]);
  }
  return result;
}

export async function verifyM52Evidence(options: M52EvidenceOptions) {
  const manifestPath = path.join(options.output, M52_EVIDENCE_FILES.manifest);
  const checksumsPath = path.join(options.output, M52_EVIDENCE_FILES.checksums);
  assertM52(fs.existsSync(manifestPath), "M5.2 manifest is missing.");
  assertM52(fs.existsSync(checksumsPath), "M5.2 checksums are missing.");
  const manifest = readJson(manifestPath);
  assertM52(
    manifest.manifestId === "AMOS-OPS-M5.2-ACCEPTANCE-MANIFEST" &&
      manifest.milestone === "M5.2" &&
      manifest.disposition === "ACCEPTED" &&
      manifest.complete === true &&
      manifest.synthetic === true,
    "M5.2 manifest identity or disposition drifted.",
  );

  const controls = manifest.controlReferences;
  assertM52(
    Array.isArray(controls) && controls.length === M52_BASELINE_CONTROL_FILES.length,
    "M5.2 control-reference inventory drifted.",
  );
  const controlsRoot = path.join(m52MilestoneRoot(options.root), "controls");
  for (const reference of controls as Array<Record<string, unknown>>) {
    assertM52(typeof reference.path === "string", "M5.2 control path is invalid.");
    const name = path.basename(reference.path);
    assertM52(
      M52_BASELINE_CONTROL_FILES.includes(name),
      `M5.2 unexpected control reference: ${reference.path}`,
    );
    const absolute = path.join(controlsRoot, name);
    const contents = fs.readFileSync(absolute);
    assertM52(
      reference.bytes === contents.length && reference.sha256 === hashM52(contents),
      `M5.2 control reference drifted: ${name}`,
    );
  }

  const checksums = checksumMap(fs.readFileSync(checksumsPath, "utf8"));
  const expectedChecksumNames = [
    ...Object.values(M52_CRITERION_EVIDENCE_FILES),
    M52_EVIDENCE_FILES.integrated,
    M52_EVIDENCE_FILES.inherited,
    M52_EVIDENCE_FILES.summary,
    M52_EVIDENCE_FILES.manifest,
  ].sort();
  assertM52(
    JSON.stringify([...checksums.keys()].sort()) ===
      JSON.stringify(expectedChecksumNames),
    "M5.2 checksum inventory drifted.",
  );
  for (const [name, expected] of checksums) {
    const absolute = path.join(options.output, name);
    assertM52(fs.existsSync(absolute), `M5.2 evidence is missing: ${name}`);
    assertM52(
      hashM52(fs.readFileSync(absolute)) === expected,
      `M5.2 evidence hash mismatch: ${name}`,
    );
  }

  for (const criterionId of M52_CRITERION_IDS) {
    const record = readJson(
      path.join(options.output, M52_CRITERION_EVIDENCE_FILES[criterionId]),
    );
    assertM52(
      record.milestone === "M5.2" &&
        record.criterionId === criterionId &&
        record.passed === true &&
        typeof record.assertionCount === "number" &&
        record.productionRows === 0 &&
        record.liveExternalCalls === 0 &&
        record.liveMicrosoftReads === 0 &&
        record.liveMicrosoftWrites === 0 &&
        record.realNotificationsSent === 0 &&
        record.deployments === 0 &&
        record.githubPushes === 0 &&
        record.usesProductionData === false &&
        record.synthetic === true,
      `M5.2 criterion evidence drifted: ${criterionId}`,
    );
  }

  const replay = await runM52IntegratedScenario();
  assertM52(
    replay.accepted &&
      replay.acceptanceFlags.length === 8 &&
      replay.acceptanceFlags.every((flag) => flag.passed) &&
      replay.totals.assertionCount === 57 &&
      replay.workflows.length === 4 &&
      replay.workflows.every(
        (workflow) =>
          workflow.synchronized &&
          workflow.zeroDataLoss &&
          workflow.payloadPreservedExactly &&
          workflow.liveCalls === 0 &&
          workflow.liveWrites === 0,
      ) &&
      replay.medicationTiming.evidence.measuredElapsedSeconds === 253 &&
      replay.sync.networkLoss.allRecovered &&
      replay.sync.partialSync.observed &&
      replay.sync.reconciliation.zeroDataLoss &&
      replay.purgeLifecycle.logoutPurged &&
      replay.purgeLifecycle.reinstallPurged &&
      replay.purgeLifecycle.deviceLossPurged &&
      replay.totals.productionRows === 0 &&
      replay.totals.liveExternalCalls === 0 &&
      replay.totals.liveMicrosoftWrites === 0 &&
      replay.totals.deployments === 0 &&
      replay.totals.githubPushes === 0,
    "M5.2 replay or adversarial boundary verification failed.",
  );
  const fresh = buildM52CriterionEvidence(replay);
  for (const [name, record] of Object.entries(fresh))
    assertM52(
      fs.readFileSync(path.join(options.output, name), "utf8") ===
        stableM52Json(record),
      `M5.2 fresh replay differs from stored evidence: ${name}`,
    );
  assertM52(
    fs.readFileSync(
      path.join(options.output, M52_EVIDENCE_FILES.integrated),
      "utf8",
    ) === stableM52Json(replay),
    "M5.2 integrated scenario evidence differs from fresh replay.",
  );
  return Object.freeze({
    milestone: "M5.2" as const,
    verified: true as const,
    criteriaVerified: 8 as const,
    assertionCount: 57 as const,
    approvedWorkflows: 4 as const,
    lostRecords: 0 as const,
    liveExternalCalls: 0 as const,
    liveWrites: 0 as const,
    synthetic: true as const,
  });
}

const invoked = process.argv[1];
if (invoked && pathToFileURL(path.resolve(invoked)).href === import.meta.url) {
  try {
    process.stdout.write(
      `${stableM52Json(await verifyM52Evidence(parseM52EvidenceOptions(process.argv.slice(2))))}`,
    );
  } catch (error) {
    process.stderr.write(
      `M5.2 evidence verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
