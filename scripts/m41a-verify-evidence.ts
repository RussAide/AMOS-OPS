import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  M41A_EVIDENCE_FILES,
  assertM41a,
  hashM41aBuffer,
  m41aControlReferences,
  m41aFileRecord,
  parseM41aEvidenceOptions,
  readM41aJson,
  stableM41aJson,
  validateM41aScenario,
  type M41aEvidenceOptions,
} from "./m41a-evidence-common";
import { buildM41aEvidenceReports } from "./m41a-export-evidence";

function parseChecksums(value: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of value.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertM41a(match, `Invalid M4.1A checksum line: ${line}`);
    assertM41a(!result.has(match[2]), `Duplicate M4.1A checksum: ${match[2]}`);
    result.set(match[2], match[1]);
  }
  return result;
}

export function verifyM41aEvidence(options: M41aEvidenceOptions) {
  const scenario = validateM41aScenario(
    readM41aJson(path.join(options.output, M41A_EVIDENCE_FILES.scenario)),
  );
  const manifest = readM41aJson(
    path.join(options.output, M41A_EVIDENCE_FILES.manifest),
  ) as Record<string, unknown>;
  assertM41a(
    manifest.recordId === "AMOS-OPS-M4.1A-ACCEPTANCE-EVIDENCE" &&
      manifest.status === "complete" &&
      manifest.evidenceClass === "synthetic_demo" &&
      manifest.criteriaExpected === 8 &&
      manifest.criteriaPassed === 8 &&
      manifest.exitGate === true,
    "M4.1A acceptance manifest is not complete and passing.",
  );

  const expectedReports = buildM41aEvidenceReports(scenario);
  for (const [fileName, expected] of Object.entries(expectedReports)) {
    const actual = fs.readFileSync(path.join(options.output, fileName), "utf8");
    assertM41a(
      actual === stableM41aJson(expected),
      `M4.1A derived evidence drifted: ${fileName}`,
    );
  }

  const inventory = manifest.inventory as
    | { path: string; bytes: number; sha256: string }[]
    | undefined;
  assertM41a(
    Array.isArray(inventory) && inventory.length === 10,
    "M4.1A manifest inventory is incomplete.",
  );
  for (const expected of inventory) {
    const actual = m41aFileRecord(
      path.join(options.output, expected.path),
      expected.path,
    );
    assertM41a(
      actual.bytes === expected.bytes && actual.sha256 === expected.sha256,
      `M4.1A inventory hash mismatch: ${expected.path}`,
    );
  }

  const expectedControlReferences = m41aControlReferences(options.root);
  assertM41a(
    stableM41aJson(manifest.controlReferences) ===
      stableM41aJson(expectedControlReferences),
    "M4.1A control-reference hashes drifted.",
  );

  const checksums = parseChecksums(
    fs.readFileSync(
      path.join(options.output, M41A_EVIDENCE_FILES.checksums),
      "utf8",
    ),
  );
  const checksumExpected = [
    ...inventory,
    m41aFileRecord(
      path.join(options.output, M41A_EVIDENCE_FILES.manifest),
      M41A_EVIDENCE_FILES.manifest,
    ),
  ];
  assertM41a(
    checksums.size === checksumExpected.length,
    "M4.1A checksum inventory count drifted.",
  );
  for (const record of checksumExpected)
    assertM41a(
      checksums.get(record.path) === record.sha256,
      `M4.1A checksum mismatch: ${record.path}`,
    );

  const prohibited = fs
    .readdirSync(options.output, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && /\.(zip|db|sqlite|sqlite3)(-shm|-wal)?$/i.test(entry.name),
    );
  assertM41a(
    prohibited.length === 0,
    `M4.1A evidence contains prohibited runtime/package files: ${prohibited.map((entry) => entry.name).join(", ")}`,
  );

  return {
    milestone: "M4.1A",
    status: "PASS",
    evidenceClass: "synthetic_demo",
    criteriaVerified: 8,
    dashboardsVerified: 5,
    metricsVerified: Object.values(scenario.dashboards).reduce(
      (count, dashboard) => count + dashboard.metrics.length,
      0,
    ),
    inventoryFilesVerified: inventory.length + 1,
    controlReferencesVerified: expectedControlReferences.length,
    checksumFileSha256: hashM41aBuffer(
      fs.readFileSync(path.join(options.output, M41A_EVIDENCE_FILES.checksums)),
    ),
  } as const;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  try {
    console.log(
      JSON.stringify(
        verifyM41aEvidence(parseM41aEvidenceOptions(process.argv.slice(2))),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
