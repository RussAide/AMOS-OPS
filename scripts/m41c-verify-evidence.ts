import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  M41C_CRITERIA,
  M41C_CRITERION_EVIDENCE_FILES,
  M41C_EVIDENCE_FILES,
  M41C_EXACT_ACCEPTANCE_KEYS,
  assertM41c,
  buildM41cEvidenceReports,
  buildM41cSummary,
  inspectM41cSyntheticBoundary,
  isM41cPathWithin,
  loadM41cScenario,
  m41cControlReferences,
  m41cFileRecord,
  normalizeM41cPath,
  parseM41cEvidenceOptions,
  readM41cJson,
  stableM41cJson,
  validateM41cAcceptanceMatrix,
  validateM41cScenario,
  type M41cEvidenceOptions,
  type M41cFileRecord,
} from "./m41c-export-evidence";

function parseChecksums(value: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = value.trim().split(/\r?\n/);
  assertM41c(lines.length > 0, "M4.1C checksum file is empty.");
  for (const line of lines) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertM41c(match, `Invalid M4.1C checksum line: ${line}`);
    assertM41c(!result.has(match[2]), `Duplicate M4.1C checksum: ${match[2]}`);
    result.set(match[2], match[1]);
  }
  return result;
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string): void => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile())
        files.push(normalizeM41cPath(path.relative(root, absolute)));
      else throw new Error(`Unsupported M4.1C evidence entry: ${absolute}`);
    }
  };
  visit(root);
  return files;
}

function inventoryFromManifest(
  manifest: Record<string, unknown>,
): M41cFileRecord[] {
  const inventory = manifest.inventory;
  assertM41c(Array.isArray(inventory), "M4.1C manifest inventory is missing.");
  const records = inventory as M41cFileRecord[];
  assertM41c(
    records.every(
      (record) =>
        record &&
        typeof record.path === "string" &&
        !path.isAbsolute(record.path) &&
        typeof record.bytes === "number" &&
        Number.isInteger(record.bytes) &&
        record.bytes > 0 &&
        typeof record.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(record.sha256),
    ),
    "M4.1C manifest contains an invalid inventory record.",
  );
  assertM41c(
    new Set(records.map((record) => record.path)).size === records.length,
    "M4.1C manifest contains duplicate inventory paths.",
  );
  return records;
}

export async function verifyM41cEvidence(options: M41cEvidenceOptions) {
  assertM41c(
    fs.existsSync(options.output) && fs.statSync(options.output).isDirectory(),
    `M4.1C evidence root is missing: ${options.output}`,
  );
  const scenarioPath = path.join(options.output, M41C_EVIDENCE_FILES.scenario);
  const scenario = validateM41cScenario(readM41cJson(scenarioPath));
  const replay = validateM41cScenario(await loadM41cScenario(options.root));
  assertM41c(
    stableM41cJson(replay) === stableM41cJson(scenario),
    "M4.1C deterministic scenario replay does not match exported evidence.",
  );

  const manifest = readM41cJson(
    path.join(options.output, M41C_EVIDENCE_FILES.manifest),
  ) as Record<string, unknown>;
  inspectM41cSyntheticBoundary(manifest, "M4.1C acceptance manifest");
  assertM41c(
    manifest.recordId === "AMOS-OPS-M4.1C-ACCEPTANCE-EVIDENCE" &&
      manifest.milestone === "M4.1C" &&
      manifest.status === "complete" &&
      manifest.evidenceClass === "synthetic_clinical_demo" &&
      manifest.criteriaExpected === 18 &&
      manifest.criteriaPassed === 18 &&
      manifest.exitGate === true,
    "M4.1C acceptance manifest is not complete and passing.",
  );
  const boundary = manifest.syntheticBoundary as
    Record<string, unknown> | undefined;
  assertM41c(
    boundary?.syntheticDataOnly === true &&
      boundary.productionRows === 0 &&
      boundary.liveWrites === 0 &&
      boundary.usesProductionData === false &&
      boundary.productionActivationAvailable === false &&
      boundary.liveClinicalDecisionAvailable === false &&
      boundary.externalWritesAvailable === false,
    "M4.1C manifest synthetic clinical boundary drifted.",
  );
  const exactAcceptance = manifest.exactAcceptance as
    Record<string, unknown> | undefined;
  assertM41c(
    exactAcceptance !== undefined &&
      JSON.stringify(Object.keys(exactAcceptance).sort()) ===
        JSON.stringify([...M41C_EXACT_ACCEPTANCE_KEYS].sort()) &&
      M41C_EXACT_ACCEPTANCE_KEYS.every((key) => exactAcceptance[key] === true),
    "M4.1C manifest exact acceptance assertions are incomplete or failing.",
  );

  const expectedReports = buildM41cEvidenceReports(scenario);
  const exactCriterionFiles = M41C_CRITERIA.map(
    (criterionId) => M41C_CRITERION_EVIDENCE_FILES[criterionId],
  );
  assertM41c(
    JSON.stringify(Object.keys(expectedReports)) ===
      JSON.stringify(exactCriterionFiles),
    "M4.1C derived evidence does not contain the 18 controlling criterion artifacts in order.",
  );
  for (const [fileName, expected] of Object.entries(expectedReports)) {
    const criterionId = M41C_CRITERIA.find(
      (candidate) => M41C_CRITERION_EVIDENCE_FILES[candidate] === fileName,
    );
    const evidenceRecord = expected as Record<string, unknown>;
    assertM41c(
      evidenceRecord.criterionId === criterionId &&
        evidenceRecord.passed === true &&
        evidenceRecord.evidenceClass === "synthetic_clinical_demo" &&
        evidenceRecord.productionRows === 0 &&
        evidenceRecord.liveWrites === 0,
      `M4.1C criterion artifact identity drifted: ${fileName}`,
    );
    const actual = fs.readFileSync(path.join(options.output, fileName), "utf8");
    assertM41c(
      actual === stableM41cJson(expected),
      `M4.1C derived evidence drifted: ${fileName}`,
    );
  }
  assertM41c(
    fs.readFileSync(
      path.join(options.output, M41C_EVIDENCE_FILES.summary),
      "utf8",
    ) === buildM41cSummary(scenario),
    "M4.1C acceptance summary drifted from the integrated scenario.",
  );

  const inventory = inventoryFromManifest(manifest);
  const expectedInventoryNames = [
    M41C_EVIDENCE_FILES.scenario,
    ...exactCriterionFiles,
    M41C_EVIDENCE_FILES.summary,
  ].sort();
  assertM41c(
    JSON.stringify(inventory.map((record) => record.path).sort()) ===
      JSON.stringify(expectedInventoryNames),
    "M4.1C manifest inventory must contain only the scenario, 18 criterion artifacts, and summary.",
  );
  for (const expected of inventory) {
    const absolute = path.resolve(options.output, expected.path);
    assertM41c(
      isM41cPathWithin(options.output, absolute),
      `M4.1C inventory path escapes the evidence root: ${expected.path}`,
    );
    const actual = m41cFileRecord(absolute, expected.path);
    assertM41c(
      actual.bytes === expected.bytes && actual.sha256 === expected.sha256,
      `M4.1C inventory hash mismatch: ${expected.path}`,
    );
  }

  const expectedControlReferences = m41cControlReferences(options.root);
  assertM41c(
    stableM41cJson(manifest.controlReferences) ===
      stableM41cJson(expectedControlReferences),
    "M4.1C control-reference hashes drifted.",
  );
  assertM41c(
    stableM41cJson(manifest.criterionEvidence) ===
      stableM41cJson(validateM41cAcceptanceMatrix(options.root)),
    "M4.1C manifest criterion evidence paths drifted from the acceptance matrix.",
  );

  const checksums = parseChecksums(
    fs.readFileSync(
      path.join(options.output, M41C_EVIDENCE_FILES.checksums),
      "utf8",
    ),
  );
  const checksumExpected = [
    ...inventory,
    m41cFileRecord(
      path.join(options.output, M41C_EVIDENCE_FILES.manifest),
      M41C_EVIDENCE_FILES.manifest,
    ),
  ];
  assertM41c(
    checksums.size === checksumExpected.length,
    "M4.1C checksum inventory count drifted.",
  );
  for (const record of checksumExpected)
    assertM41c(
      checksums.get(record.path) === record.sha256,
      `M4.1C checksum mismatch: ${record.path}`,
    );

  const prohibited = walkFiles(options.output).filter(
    (relativePath) =>
      relativePath
        .split("/")
        .some((segment) =>
          [
            "source",
            "node_modules",
            ".git",
            "dist",
            "dist-server",
            "coverage",
          ].includes(segment),
        ) || /.(zip|db|sqlite|sqlite3)(-shm|-wal)?$/i.test(relativePath),
  );
  assertM41c(
    prohibited.length === 0,
    `M4.1C evidence contains prohibited source, dependency, package, build, or runtime files: ${prohibited.join(", ")}`,
  );

  return {
    milestone: "M4.1C",
    status: "PASS",
    evidenceClass: "synthetic_clinical_demo",
    criteriaVerified: 18,
    criterionArtifactsVerified: exactCriterionFiles.length,
    deterministicReplayVerified: true,
    syntheticScenariosVerified: scenario.scenarioRuns.length,
    workplansVerified: scenario.workplans.length,
    guidanceResponsesVerified: scenario.guidanceResponses.length,
    productionRows: 0,
    liveWrites: 0,
    inventoryFilesVerified: inventory.length,
    checksumFilesVerified: checksums.size,
  } as const;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(
      JSON.stringify(
        await verifyM41cEvidence(
          parseM41cEvidenceOptions(process.argv.slice(2)),
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
