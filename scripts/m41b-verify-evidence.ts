import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  M41B_EVIDENCE_FILES,
  M41B_CRITERION_EVIDENCE_FILES,
  assertM41b,
  buildM41bEvidenceReports,
  buildM41bSummary,
  hashM41bBuffer,
  isM41bPathWithin,
  loadM41bScenario,
  m41bControlReferences,
  m41bFileRecord,
  m41bWorkplanItems,
  parseM41bEvidenceOptions,
  readM41bJson,
  stableM41bJson,
  validateM41bAcceptanceMatrix,
  validateM41bScenario,
  type M41bEvidenceOptions,
  type M41bFileRecord,
} from "./m41b-export-evidence";

function parseChecksums(value: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = value.trim().split(/\r?\n/);
  assertM41b(lines.length > 0, "M4.1B checksum file is empty.");
  for (const line of lines) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertM41b(match, `Invalid M4.1B checksum line: ${line}`);
    assertM41b(!result.has(match[2]), `Duplicate M4.1B checksum: ${match[2]}`);
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
      else if (entry.isFile()) files.push(path.relative(root, absolute));
      else throw new Error(`Unsupported M4.1B evidence entry: ${absolute}`);
    }
  };
  visit(root);
  return files;
}

function inventoryFromManifest(
  manifest: Record<string, unknown>,
): M41bFileRecord[] {
  const inventory = manifest.inventory;
  assertM41b(Array.isArray(inventory), "M4.1B manifest inventory is missing.");
  const records = inventory as M41bFileRecord[];
  assertM41b(
    records.every(
      (record) =>
        record &&
        typeof record.path === "string" &&
        typeof record.bytes === "number" &&
        typeof record.sha256 === "string" &&
        /^[a-f0-9]{64}$/.test(record.sha256),
    ),
    "M4.1B manifest contains an invalid inventory record.",
  );
  return records;
}

export async function verifyM41bEvidence(options: M41bEvidenceOptions) {
  assertM41b(
    fs.existsSync(options.output) && fs.statSync(options.output).isDirectory(),
    `M4.1B evidence root is missing: ${options.output}`,
  );
  const scenarioPath = path.join(options.output, M41B_EVIDENCE_FILES.scenario);
  const scenario = validateM41bScenario(readM41bJson(scenarioPath));
  const replay = validateM41bScenario(await loadM41bScenario(options.root));
  assertM41b(
    stableM41bJson(replay) === stableM41bJson(scenario),
    "M4.1B deterministic scenario replay does not match sealed evidence.",
  );

  const manifest = readM41bJson(
    path.join(options.output, M41B_EVIDENCE_FILES.manifest),
  ) as Record<string, unknown>;
  assertM41b(
    manifest.recordId === "AMOS-OPS-M4.1B-ACCEPTANCE-EVIDENCE" &&
      manifest.milestone === "M4.1B" &&
      manifest.status === "complete" &&
      manifest.evidenceClass === "synthetic_demo" &&
      manifest.criteriaExpected === 10 &&
      manifest.criteriaPassed === 10 &&
      manifest.exitGate === true,
    "M4.1B acceptance manifest is not complete and passing.",
  );
  const syntheticBoundary = manifest.syntheticBoundary as
    Record<string, unknown> | undefined;
  assertM41b(
    syntheticBoundary?.productionRows === 0 &&
      syntheticBoundary.usesProductionData === false &&
      syntheticBoundary.productionActionsBlocked === true,
    "M4.1B manifest synthetic boundary drifted.",
  );

  const expectedReports = buildM41bEvidenceReports(scenario);
  const exactCriterionFiles = Object.values(M41B_CRITERION_EVIDENCE_FILES);
  assertM41b(
    JSON.stringify(Object.keys(expectedReports)) ===
      JSON.stringify(exactCriterionFiles),
    "M4.1B derived evidence does not contain the ten controlling criterion artifacts in order.",
  );
  for (const [fileName, expected] of Object.entries(expectedReports)) {
    const criterionId = Object.entries(M41B_CRITERION_EVIDENCE_FILES).find(
      ([, expectedFile]) => expectedFile === fileName,
    )?.[0];
    const evidenceRecord = expected as Record<string, unknown>;
    assertM41b(
      evidenceRecord.criterionId === criterionId &&
        evidenceRecord.passed === true &&
        evidenceRecord.evidenceClass === "synthetic_demo",
      `M4.1B criterion artifact identity drifted: ${fileName}`,
    );
    const actual = fs.readFileSync(path.join(options.output, fileName), "utf8");
    assertM41b(
      actual === stableM41bJson(expected),
      `M4.1B derived evidence drifted: ${fileName}`,
    );
  }
  const accessEvidence = expectedReports[
    M41B_EVIDENCE_FILES.accessRefusal
  ] as Record<string, unknown>;
  assertM41b(
    Array.isArray(accessEvidence.requiredRefusalCodes) &&
      accessEvidence.requiredRefusalCodes.includes(
        "M41B_SOURCE_PERMISSION_DENIED",
      ) &&
      (accessEvidence.silentClosureControl as Record<string, unknown>)
        ?.evidenceCount === 0 &&
      (accessEvidence.silentClosureControl as Record<string, unknown>)
        ?.blocked === true &&
      (accessEvidence.silentClosureControl as Record<string, unknown>)
        ?.observedCode === "M41B_TASK_COMPLETION_EVIDENCE_REQUIRED",
    "M4.1B access evidence does not require source-permission denial and blocked silent closure.",
  );
  const lineageEvidence = expectedReports[
    M41B_EVIDENCE_FILES.auditLineage
  ] as Record<string, unknown>;
  const lineages = lineageEvidence.lineages as
    Array<Record<string, unknown>> | undefined;
  const overrideProof = lineageEvidence.overrideProof as
    Array<Record<string, unknown>> | undefined;
  assertM41b(
    Array.isArray(lineages) &&
      lineages.length === scenario.recommendations.length &&
      lineages.every((lineage) => {
        const request = lineage.originalRequest as
          Record<string, unknown> | undefined;
        const roleContext = request?.roleContext as
          Record<string, unknown> | undefined;
        return (
          lineage.promptContextResolved === true &&
          typeof request?.prompt === "string" &&
          request.prompt.trim().length > 0 &&
          roleContext?.evidenceClass === "synthetic_demo" &&
          typeof roleContext.userId === "string" &&
          roleContext.userId.startsWith("SYNTH-M41B-")
        );
      }) &&
      Array.isArray(overrideProof) &&
      overrideProof.some((lineage) => {
        const disposition = lineage.humanDisposition as
          Record<string, unknown> | undefined;
        return (
          disposition?.disposition === "override" &&
          typeof lineage.overrideReason === "string" &&
          lineage.overrideReason.trim().length > 0
        );
      }),
    "M4.1B audit-lineage evidence does not resolve every recommendation to its original prompt/context and a reasoned override.",
  );
  assertM41b(
    fs.readFileSync(
      path.join(options.output, M41B_EVIDENCE_FILES.summary),
      "utf8",
    ) === buildM41bSummary(scenario),
    "M4.1B acceptance summary drifted from the integrated scenario.",
  );

  const inventory = inventoryFromManifest(manifest);
  const expectedInventoryNames = [
    M41B_EVIDENCE_FILES.scenario,
    ...Object.keys(expectedReports),
    M41B_EVIDENCE_FILES.summary,
  ].sort();
  assertM41b(
    JSON.stringify(inventory.map((record) => record.path).sort()) ===
      JSON.stringify(expectedInventoryNames),
    "M4.1B manifest inventory is incomplete or contains non-acceptance files.",
  );
  for (const expected of inventory) {
    const absolute = path.resolve(options.output, expected.path);
    assertM41b(
      isM41bPathWithin(options.output, absolute),
      `M4.1B inventory path escapes the evidence root: ${expected.path}`,
    );
    const actual = m41bFileRecord(absolute, expected.path);
    assertM41b(
      actual.bytes === expected.bytes && actual.sha256 === expected.sha256,
      `M4.1B inventory hash mismatch: ${expected.path}`,
    );
  }

  const expectedControlReferences = m41bControlReferences(options.root);
  assertM41b(
    stableM41bJson(manifest.controlReferences) ===
      stableM41bJson(expectedControlReferences),
    "M4.1B control-reference hashes drifted.",
  );
  assertM41b(
    stableM41bJson(manifest.criterionEvidence) ===
      stableM41bJson(validateM41bAcceptanceMatrix(options.root)),
    "M4.1B manifest criterion evidence paths drifted from the acceptance matrix.",
  );

  for (const obsolete of [
    "M4_1B_WORKPLAN_AND_CADENCE_COVERAGE.json",
    "M4_1B_GUIDED_ASSISTANCE_RESULT.json",
    "M4_1B_HUMAN_GATE_AND_TASK_RESULT.json",
    "M4_1B_RECOMMENDATION_TO_EVIDENCE_LINEAGE.json",
    "M4_1B_FAIL_CLOSED_CONTROL_RESULT.json",
    "M4_1B_ROLE_DIVISION_SCENARIO_COVERAGE.json",
  ])
    assertM41b(
      !fs.existsSync(path.join(options.output, obsolete)),
      `M4.1B evidence retains obsolete grouped artifact: ${obsolete}`,
    );

  const checksums = parseChecksums(
    fs.readFileSync(
      path.join(options.output, M41B_EVIDENCE_FILES.checksums),
      "utf8",
    ),
  );
  const checksumExpected = [
    ...inventory,
    m41bFileRecord(
      path.join(options.output, M41B_EVIDENCE_FILES.manifest),
      M41B_EVIDENCE_FILES.manifest,
    ),
  ];
  assertM41b(
    checksums.size === checksumExpected.length,
    "M4.1B checksum inventory count drifted.",
  );
  for (const record of checksumExpected)
    assertM41b(
      checksums.get(record.path) === record.sha256,
      `M4.1B checksum mismatch: ${record.path}`,
    );

  const prohibited = walkFiles(options.output).filter(
    (relativePath) =>
      relativePath
        .split(path.sep)
        .some((segment) =>
          [
            "source",
            "node_modules",
            ".git",
            "dist",
            "dist-server",
            "coverage",
          ].includes(segment),
        ) || /\.(zip|db|sqlite|sqlite3)(-shm|-wal)?$/i.test(relativePath),
  );
  assertM41b(
    prohibited.length === 0,
    `M4.1B evidence contains prohibited source, dependency, package, or runtime files: ${prohibited.join(", ")}`,
  );

  const tasks = m41bWorkplanItems(scenario).filter(
    (task) => task.recommendationId !== null,
  );
  return {
    milestone: "M4.1B",
    status: "PASS",
    evidenceClass: "synthetic_demo",
    criteriaVerified: 10,
    deterministicReplayVerified: true,
    workplansVerified: scenario.workplans.length,
    cadencesPerWorkplanVerified: 5,
    authorizedRequestsVerified: scenario.requests.length,
    guidanceResponsesVerified: scenario.guidance.length,
    humanDecisionsVerified: scenario.decisions.length,
    downstreamTasksVerified: tasks.length,
    auditEventsVerified: scenario.auditEvents.length,
    inventoryFilesVerified: inventory.length + 1,
    controlReferencesVerified: expectedControlReferences.length,
    checksumFileSha256: hashM41bBuffer(
      fs.readFileSync(path.join(options.output, M41B_EVIDENCE_FILES.checksums)),
    ),
  } as const;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(
      JSON.stringify(
        await verifyM41bEvidence(
          parseM41bEvidenceOptions(process.argv.slice(2)),
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
