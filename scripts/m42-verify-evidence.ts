import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runM42IntegratedScenario } from "../api/services/m42/experience-service";
import {
  M42_CRITERION_EVIDENCE_FILES,
  M42_EVIDENCE_FILES,
  assertM42,
  m42ControlReferences,
  m42FileRecord,
  parseM42EvidenceOptions,
  readM42Json,
  stableM42Json,
  type M42EvidenceOptions,
  type M42FileRecord,
} from "./m42-evidence-common";

function object(value: unknown, label: string): Record<string, unknown> {
  assertM42(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `${label} must be an object.`,
  );
  return value as Record<string, unknown>;
}

function parseChecksums(value: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of value.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertM42(match, `Invalid M4.2 checksum line: ${line}`);
    assertM42(!result.has(match[2]), `Duplicate M4.2 checksum: ${match[2]}`);
    result.set(match[2], match[1]);
  }
  return result;
}

export function verifyM42Evidence(options: M42EvidenceOptions) {
  const manifest = object(
    readM42Json(path.join(options.output, M42_EVIDENCE_FILES.manifest)),
    "M4.2 manifest",
  );
  const exactAcceptance = object(
    manifest.exactAcceptance,
    "M4.2 exact acceptance",
  );
  assertM42(
    manifest.recordId === "AMOS-OPS-M4.2-ACCEPTANCE-EVIDENCE" &&
      manifest.milestone === "M4.2" &&
      manifest.status === "complete" &&
      manifest.disposition === "ACCEPTED" &&
      manifest.criteriaExpected === 8 &&
      manifest.criteriaPassed === 8 &&
      manifest.accepted === true &&
      Object.values(exactAcceptance).every((value) => value === true),
    "M4.2 acceptance manifest is incomplete or failing.",
  );
  const boundary = object(manifest.syntheticBoundary, "M4.2 boundary");
  assertM42(
    boundary.syntheticOnly === true &&
      boundary.realDataUsed === false &&
      boundary.liveConnectorMutation === false &&
      boundary.productionDisposition === false &&
      boundary.productionDeployment === false &&
      boundary.githubPush === false &&
      boundary.productionRows === 0 &&
      boundary.liveWrites === 0 &&
      boundary.usesProductionData === false,
    "M4.2 evidence boundary drifted.",
  );

  const criterionFiles = Object.entries(M42_CRITERION_EVIDENCE_FILES);
  for (const [criterionId, fileName] of criterionFiles) {
    const record = object(
      readM42Json(path.join(options.output, fileName)),
      `M4.2 criterion ${criterionId}`,
    );
    assertM42(
      record.milestone === "M4.2" &&
        record.criterionId === criterionId &&
        record.passed === true &&
        record.productionRows === 0 &&
        record.liveWrites === 0 &&
        record.usesProductionData === false &&
        record.synthetic === true,
      `M4.2 criterion evidence is invalid: ${fileName}`,
    );
  }

  const searchRecord = object(
    readM42Json(
      path.join(
        options.output,
        M42_CRITERION_EVIDENCE_FILES["M4.2-04"],
      ),
    ),
    "M4.2 search evidence",
  );
  const searchArtifacts = object(searchRecord.artifacts, "M4.2 search artifacts");
  const performance = object(
    searchArtifacts.performance,
    "M4.2 search performance",
  );
  assertM42(
    performance.accepted === true &&
      typeof performance.maxMs === "number" &&
      typeof performance.targetMsExclusive === "number" &&
      performance.maxMs < performance.targetMsExclusive &&
      performance.permissionTrimmedBeforeRanking === true &&
      performance.permissionTrimmedBeforeCitation === true &&
      performance.externalWrites === 0,
    "M4.2 search evidence did not meet exact acceptance.",
  );
  const nilRecord = object(
    readM42Json(
      path.join(
        options.output,
        M42_CRITERION_EVIDENCE_FILES["M4.2-05"],
      ),
    ),
    "M4.2 NIL evidence",
  );
  const nilArtifacts = object(nilRecord.artifacts, "M4.2 NIL artifacts");
  const semantic = object(
    nilArtifacts.semanticEvaluation,
    "M4.2 NIL semantic evaluation",
  );
  assertM42(
    semantic.accepted === true &&
      semantic.correctTop1Count === 28 &&
      semantic.labeledQueryCount === 30 &&
      typeof semantic.accuracy === "number" &&
      typeof semantic.threshold === "number" &&
      semantic.accuracy >= semantic.threshold &&
      semantic.externalWrites === 0,
    "M4.2 NIL evidence did not meet exact acceptance.",
  );

  const inventory = manifest.inventory;
  assertM42(Array.isArray(inventory), "M4.2 manifest inventory is missing.");
  const records = inventory as M42FileRecord[];
  assertM42(
    records.length === criterionFiles.length + 1,
    "M4.2 manifest inventory count drifted.",
  );
  for (const expected of records) {
    const actual = m42FileRecord(
      path.join(options.output, expected.path),
      expected.path,
    );
    assertM42(
      actual.bytes === expected.bytes && actual.sha256 === expected.sha256,
      `M4.2 inventory hash mismatch: ${expected.path}`,
    );
  }
  assertM42(
    stableM42Json(manifest.controlReferences) ===
      stableM42Json(m42ControlReferences(options.root)),
    "M4.2 control-reference hashes drifted.",
  );
  const checksums = parseChecksums(
    fs.readFileSync(
      path.join(options.output, M42_EVIDENCE_FILES.checksums),
      "utf8",
    ),
  );
  const expectedChecksums = [
    ...records,
    m42FileRecord(
      path.join(options.output, M42_EVIDENCE_FILES.manifest),
      M42_EVIDENCE_FILES.manifest,
    ),
  ];
  assertM42(
    checksums.size === expectedChecksums.length,
    "M4.2 checksum inventory count drifted.",
  );
  for (const record of expectedChecksums)
    assertM42(
      checksums.get(record.path) === record.sha256,
      `M4.2 checksum mismatch: ${record.path}`,
    );

  const replay = runM42IntegratedScenario(undefined, 1);
  assertM42(
    replay.accepted &&
      replay.search.corpusSha256 === performance.corpusSha256 &&
      replay.nil.corpusSha256 === semantic.corpusSha256 &&
      replay.nil.evaluationSetSha256 === semantic.evaluationSetSha256,
    "M4.2 deterministic corpus or acceptance replay drifted.",
  );
  return Object.freeze({
    milestone: "M4.2",
    status: "PASS",
    criteriaVerified: criterionFiles.length,
    inventoryFilesVerified: records.length,
    checksumRecordsVerified: expectedChecksums.length,
    deterministicCorpusReplayVerified: true,
    productionRows: 0,
    liveWrites: 0,
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  pathToFileURL(path.resolve(invokedPath)).href === import.meta.url
) {
  try {
    process.stdout.write(
      stableM42Json(
        verifyM42Evidence(parseM42EvidenceOptions(process.argv.slice(2))),
      ),
    );
  } catch (error) {
    process.stderr.write(
      `M4.2 evidence verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
