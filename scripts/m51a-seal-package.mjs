import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { M51A_REQUIRED_QA_STEPS } from "./m51a-run-qa.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_BASE_NAME =
  "AMOS-OPS_M5_1A_Operations_Hub_and_Microsoft_DMS_Connector_Architecture_Package_v1_0";
const SOURCE_SNAPSHOT_NAME =
  "AMOS-OPS_M5_1A_Canonical_Source_Snapshot_v1_0.zip";
const CRITERION_EVIDENCE_FILES = Object.freeze([
  "M5_1A_OPERATIONS_HUB_TOPOLOGY_RESULT.json",
  "M5_1A_CONTENT_MODEL_HANDLING_LIFECYCLE_RESULT.json",
  "M5_1A_REPOSITORY_INVENTORY_DISPOSITION_RESULT.json",
  "M5_1A_CONNECTOR_REGISTRY_MODES_RESULT.json",
  "M5_1A_STABLE_OBJECT_IDENTITY_RESULT.json",
  "M5_1A_INTRANET_PUBLISHING_RESULT.json",
  "M5_1A_NON_SENSITIVE_PILOT_RESULT.json",
  "M5_1A_INTEGRATED_SCENARIO_RESULT.json",
]);
const REQUIRED_CLOSURE_CONTROLS = Object.freeze([
  "M5_1A_IMPLEMENTATION_REGISTER.md",
  "M5_1A_TRACEABILITY_MATRIX.csv",
  "M5_1A_INDEPENDENT_REVIEW.md",
  "M5_1A_ACCEPTANCE_RECORD.md",
  "M5_1A_RELEASE_READINESS.md",
]);
const REQUIRED_FOCUSED_TESTS = Object.freeze([
  "api/tests/m51a-integration-foundation.test.ts",
  "api/tests/m51a-operations-hub-architecture-scenario.test.ts",
  "api/tests/m51a-operations-hub-intranet-map.test.ts",
  "api/tests/m51a-connector-registry.test.ts",
  "api/tests/m51a-connector-access-policy.test.ts",
  "api/tests/m51a-connector-stable-mapping.test.ts",
  "api/tests/m51a-connector-version-conflict.test.ts",
  "api/tests/m51a-connector-reliability.test.ts",
  "api/tests/m51a-pilot-migration.test.ts",
  "api/tests/m51a-pilot-reconciliation.test.ts",
  "api/tests/m51a-security-boundary.test.ts",
  "api/tests/m51a-security-permission-trimming.test.ts",
]);
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".cache",
  ".turbo",
  ".vite",
  "coverage",
  "dist",
  "dist-server",
  "node_modules",
  "uploads",
]);
const FIXED_ZIP_TIME = new Date("2000-01-01T00:00:00.000Z");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function parseM51aSealOptions(argv) {
  let root;
  let output;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--"))
        throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else output = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else positional.push(argument);
  }
  root ??= positional[0] ?? "..";
  const resolvedRoot = path.resolve(root);
  output ??= positional[1] ?? path.join(resolvedRoot, "package");
  return { root: resolvedRoot, output: path.resolve(output) };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M5.1A source root is missing under ${root}.`);
}

function milestoneRootFor(root) {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(sourceRootFor(root));
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function hashFile(filePath) {
  const contents = fs.readFileSync(filePath);
  return {
    bytes: contents.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile())
        result.push(normalize(path.relative(root, absolute)));
      else throw new Error(`Unsupported M5.1A package entry: ${absolute}`);
    }
  };
  visit(root);
  return result;
}

function sourcePathExcluded(relativePath) {
  if (!relativePath) return false;
  const segments = normalize(relativePath).split("/");
  if (segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment)))
    return true;
  const fileName = segments.at(-1) ?? "";
  if (/\.(db|sqlite|sqlite3)(-shm|-wal)?$/i.test(fileName)) return true;
  if (/\.(log|tsbuildinfo)$/i.test(fileName) || fileName === ".DS_Store")
    return true;
  if (
    /^\.env(?:\..+)?$/.test(fileName) &&
    !/\.(example|sample|template)$/.test(fileName)
  )
    return true;
  return false;
}

function copyFilteredSource(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    preserveTimestamps: true,
    filter: (sourcePath) =>
      !sourcePathExcluded(path.relative(source, sourcePath)),
  });
}

function fileMap(root) {
  return new Map(
    walkFiles(root).map((relativePath) => [
      relativePath,
      hashFile(path.join(root, relativePath)),
    ]),
  );
}

function filteredSourceMap(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relativePath = normalize(path.relative(root, absolute));
      if (sourcePathExcluded(relativePath)) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(relativePath);
      else throw new Error(`Unsupported canonical-source entry: ${absolute}`);
    }
  };
  visit(root);
  return new Map(
    files.map((relativePath) => [
      relativePath,
      hashFile(path.join(root, relativePath)),
    ]),
  );
}

function compareMaps(expected, actual, label) {
  assert(
    JSON.stringify([...expected.keys()].sort()) ===
      JSON.stringify([...actual.keys()].sort()),
    `${label} file inventory changed.`,
  );
  for (const [relativePath, expectedValue] of expected) {
    const actualValue = actual.get(relativePath);
    assert(
      actualValue &&
        actualValue.bytes === expectedValue.bytes &&
        actualValue.sha256 === expectedValue.sha256,
      `${label} byte/hash mismatch: ${relativePath}`,
    );
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 200 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0)
    throw new Error(
      `${command} ${args.join(" ")} failed (${result.status ?? "unknown"}).\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  return result.stdout ?? "";
}

function normalizeTimes(root) {
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      fs.utimesSync(absolute, FIXED_ZIP_TIME, FIXED_ZIP_TIME);
    }
  };
  visit(root);
  fs.utimesSync(root, FIXED_ZIP_TIME, FIXED_ZIP_TIME);
}

function createDeterministicZip(archivePath, cwd, relativeFiles) {
  assert(relativeFiles.length > 0, `Refusing to create empty ZIP: ${archivePath}`);
  run("zip", ["-q", "-X", archivePath, "-@"], {
    cwd,
    input: `${[...relativeFiles].sort().join("\n")}\n`,
  });
  run("unzip", ["-tq", archivePath]);
}

function atomicCopy(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.partial-${process.pid}`;
  fs.copyFileSync(source, temporary);
  fs.renameSync(temporary, destination);
}

function atomicWrite(destination, value) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, destination);
}

function verifyClosureControls(controlsRoot) {
  for (const fileName of REQUIRED_CLOSURE_CONTROLS)
    assert(
      fs.existsSync(path.join(controlsRoot, fileName)),
      `M5.1A closure control is missing: ${fileName}`,
    );
  const review = fs.readFileSync(
    path.join(controlsRoot, "M5_1A_INDEPENDENT_REVIEW.md"),
    "utf8",
  );
  const acceptance = fs.readFileSync(
    path.join(controlsRoot, "M5_1A_ACCEPTANCE_RECORD.md"),
    "utf8",
  );
  const readiness = fs.readFileSync(
    path.join(controlsRoot, "M5_1A_RELEASE_READINESS.md"),
    "utf8",
  );
  assert(
    /\*\*Disposition:\*\*\s+GO\b/i.test(review),
    "M5.1A sealing requires independent-review Disposition: GO.",
  );
  assert(
    /\*\*Disposition:\*\*\s+ACCEPTED\b/i.test(acceptance),
    "M5.1A sealing requires acceptance-record Disposition: ACCEPTED.",
  );
  assert(
    /\*\*Readiness:\*\*\s+READY\b/i.test(readiness),
    "M5.1A sealing requires release-readiness Readiness: READY.",
  );
}

function verifySchemaReport(evidenceRoot, expectedRelativePath) {
  assert(
    typeof expectedRelativePath === "string" &&
      !path.isAbsolute(expectedRelativePath),
    "M5.1A schema report path is invalid.",
  );
  const reportPath = path.resolve(evidenceRoot, expectedRelativePath);
  assert(
    isWithin(evidenceRoot, reportPath) && fs.existsSync(reportPath),
    "M5.1A schema-integrity report is missing.",
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert(
    report.reportId === "M51A-SCHEMA-INTEGRITY" &&
      report.milestone === "M5.1A" &&
      report.evidenceClass ===
        "synthetic_operations_hub_connector_architecture_demo" &&
      report.passed === true &&
      report.disposition === "NO_SCHEMA_CHANGE_REQUIRED" &&
      report.inheritedMigrationCount === 11 &&
      report.inheritedMigrationHead ===
        "0010_m41c_clinical_intelligence_fabric.sql" &&
      Array.isArray(report.m51aMigrationFiles) &&
      report.m51aMigrationFiles.length === 0 &&
      /^[a-f0-9]{64}$/.test(report.schemaSha256) &&
      report.databaseWrites === 0 &&
      report.productionRows === 0 &&
      report.usesProductionData === false &&
      report.liveMicrosoftWrites === 0,
    "M5.1A schema-integrity result drifted.",
  );
  return report;
}

function verifyQaReport(evidenceRoot) {
  const reportPath = path.join(evidenceRoot, "M5_1A_INTEGRATED_QA.json");
  assert(fs.existsSync(reportPath), "M5.1A integrated QA report is missing.");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert(
    report.reportId === "M51A-INTEGRATED-QA" &&
      report.milestone === "M5.1A" &&
      report.evidenceClass ===
        "synthetic_operations_hub_connector_architecture_demo" &&
      report.productionRows === 0 &&
      report.liveGraphCalls === 0 &&
      report.liveMicrosoftWrites === 0 &&
      report.liveWrites === 0 &&
      report.usesProductionData === false &&
      report.passed === true,
    "M5.1A integrated QA identity, boundary, or result drifted.",
  );
  assert(
    JSON.stringify(report.requiredSteps) ===
      JSON.stringify(M51A_REQUIRED_QA_STEPS),
    "M5.1A required QA step register drifted.",
  );
  assert(
    Array.isArray(report.focusedTests) && report.focusedTests.length > 0,
    "M5.1A QA did not retain focused test identities.",
  );
  for (const required of REQUIRED_FOCUSED_TESTS)
    assert(
      report.focusedTests.includes(required),
      `M5.1A focused QA omitted ${required}.`,
    );
  assert(
    new Set(report.focusedTests).size === report.focusedTests.length,
    "M5.1A focused QA contains duplicate test execution.",
  );
  assert(
    Array.isArray(report.steps) &&
      JSON.stringify(report.steps.map((step) => step.id)) ===
        JSON.stringify(M51A_REQUIRED_QA_STEPS) &&
      report.steps.every((step) => step.exitCode === 0),
    "M5.1A QA sequence is incomplete, reordered, or failing.",
  );
  for (const step of report.steps) {
    assert(
      typeof step.log === "string" && !path.isAbsolute(step.log),
      `M5.1A QA log path is invalid for ${step.id}.`,
    );
    const logPath = path.resolve(evidenceRoot, step.log);
    assert(
      isWithin(evidenceRoot, logPath) && fs.existsSync(logPath),
      `M5.1A QA log is missing for ${step.id}.`,
    );
  }
  verifySchemaReport(evidenceRoot, report.schemaReport);
  return report;
}

function verifyAcceptanceManifest(evidenceRoot) {
  const manifestPath = path.join(
    evidenceRoot,
    "M5_1A_ACCEPTANCE_MANIFEST.json",
  );
  assert(fs.existsSync(manifestPath), "M5.1A acceptance manifest is missing.");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(
    manifest.recordId === "AMOS-OPS-M5.1A-ACCEPTANCE-EVIDENCE" &&
      manifest.milestone === "M5.1A" &&
      manifest.status === "complete" &&
      manifest.disposition === "ACCEPTED" &&
      manifest.evidenceClass ===
        "synthetic_operations_hub_connector_architecture_demo" &&
      manifest.criteriaExpected === 8 &&
      manifest.criteriaPassed === 8 &&
      Number.isInteger(manifest.assertionCount) &&
      manifest.assertionCount > 0 &&
      manifest.accepted === true &&
      Object.values(manifest.exactAcceptance ?? {}).length === 8 &&
      Object.values(manifest.exactAcceptance).every(Boolean),
    "Final sealing requires complete passing M5.1A acceptance evidence.",
  );
  const boundary = manifest.syntheticBoundary ?? {};
  assert(
    boundary.syntheticOnly === true &&
      boundary.realDataUsed === false &&
      boundary.realFileContentRead === false &&
      boundary.liveSiteProvisioning === false &&
      boundary.liveConnectorMutation === false &&
      boundary.restrictedRecordMigration === false &&
      boundary.productionDeployment === false &&
      boundary.githubPush === false &&
      boundary.productionRows === 0 &&
      boundary.liveWrites === 0 &&
      boundary.liveGraphCalls === 0 &&
      boundary.liveMicrosoftReads === 0 &&
      boundary.liveMicrosoftWrites === 0 &&
      boundary.usesProductionData === false,
    "M5.1A acceptance boundary drifted.",
  );
  return manifest;
}

export function sealM51aPackage(options) {
  const milestoneRoot = milestoneRootFor(options.root);
  const sourceRoot = sourceRootFor(options.root);
  const controlsRoot = path.join(milestoneRoot, "controls");
  const evidenceRoot = path.join(milestoneRoot, "evidence");
  for (const [label, target] of [
    ["source", sourceRoot],
    ["controls", controlsRoot],
    ["evidence", evidenceRoot],
  ])
    assert(
      fs.existsSync(target) && fs.statSync(target).isDirectory(),
      `M5.1A ${label} root is missing: ${target}`,
    );
  assert(
    !isWithin(sourceRoot, options.output),
    "M5.1A package output cannot be written inside the canonical source tree.",
  );

  run(
    process.execPath,
    [
      "--import",
      "tsx",
      path.join(SCRIPT_DIRECTORY, "m51a-verify-evidence.ts"),
      "--root",
      milestoneRoot,
      "--output",
      evidenceRoot,
    ],
    { cwd: sourceRoot },
  );
  const acceptanceManifest = verifyAcceptanceManifest(evidenceRoot);
  const qaReport = verifyQaReport(evidenceRoot);
  verifyClosureControls(controlsRoot);

  fs.mkdirSync(options.output, { recursive: true });
  const packageZip = path.join(options.output, `${PACKAGE_BASE_NAME}.zip`);
  const packageSidecar = `${packageZip}.sha256`;
  const sealResultPath = path.join(
    options.output,
    `${PACKAGE_BASE_NAME}_SEAL_RESULT.json`,
  );
  for (const target of [packageZip, packageSidecar, sealResultPath])
    assert(
      !fs.existsSync(target),
      `M5.1A sealing refuses to overwrite existing output: ${target}`,
    );

  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "amos-m51a-seal-"),
  );
  try {
    const filteredSource = path.join(temporaryRoot, "filtered-source");
    const sourceRestore = path.join(temporaryRoot, "source-restore");
    const snapshotZip = path.join(temporaryRoot, SOURCE_SNAPSHOT_NAME);
    const liveSourceBefore = filteredSourceMap(sourceRoot);
    copyFilteredSource(sourceRoot, filteredSource);
    const stagedSourceMap = fileMap(filteredSource);
    compareMaps(liveSourceBefore, stagedSourceMap, "Canonical source staging");
    assert(
      stagedSourceMap.size > 0 && stagedSourceMap.has("package.json"),
      "Filtered M5.1A canonical source snapshot is incomplete.",
    );
    assert(
      [...stagedSourceMap.keys()].every(
        (relativePath) => !sourcePathExcluded(relativePath),
      ),
      "Filtered M5.1A source contains excluded content.",
    );
    normalizeTimes(filteredSource);
    createDeterministicZip(snapshotZip, filteredSource, [
      ...stagedSourceMap.keys(),
    ]);
    fs.mkdirSync(sourceRestore, { recursive: true });
    run("unzip", ["-q", snapshotZip, "-d", sourceRestore]);
    compareMaps(
      stagedSourceMap,
      fileMap(sourceRestore),
      "Canonical source snapshot restoration",
    );

    const packageRoot = path.join(temporaryRoot, PACKAGE_BASE_NAME);
    const packageControls = path.join(packageRoot, "00_Controls");
    const packageEvidence = path.join(packageRoot, "10_Evidence");
    const packageSource = path.join(packageRoot, "20_Canonical_Source");
    const packageManifestRoot = path.join(packageRoot, "90_Seal_Manifest");
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.cpSync(controlsRoot, packageControls, {
      recursive: true,
      preserveTimestamps: true,
    });
    fs.cpSync(evidenceRoot, packageEvidence, {
      recursive: true,
      preserveTimestamps: true,
    });
    fs.mkdirSync(packageSource, { recursive: true });
    fs.copyFileSync(snapshotZip, path.join(packageSource, SOURCE_SNAPSHOT_NAME));
    fs.mkdirSync(packageManifestRoot, { recursive: true });

    const evidenceFiles = walkFiles(packageEvidence);
    assert(
      !evidenceFiles.some((relativePath) =>
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
          ),
      ),
      "M5.1A evidence contains a prohibited source, dependency, or build-output copy.",
    );
    assert(
      !evidenceFiles.some((relativePath) =>
        /\.(zip|db|sqlite|sqlite3)(-shm|-wal)?$/i.test(relativePath),
      ),
      "M5.1A evidence contains a nested snapshot or runtime database.",
    );
    const sourceEntries = walkFiles(packageSource);
    assert(
      sourceEntries.length === 1 && sourceEntries[0] === SOURCE_SNAPSHOT_NAME,
      "M5.1A package must contain one canonical source snapshot and no loose source copy.",
    );

    fs.writeFileSync(
      path.join(packageRoot, "README.md"),
      `# AMOS-OPS M5.1A Integrated Sprint Package

This package contains one controlling-document set, one integrated evidence set, and one filtered canonical source snapshot for M5.1A Operations Hub and Microsoft DMS Connector Architecture Operational.

- Evidence boundary: synthetic Operations Hub and connector architecture only
- Acceptance criteria: 8/8
- Acceptance assertions: ${acceptanceManifest.assertionCount}
- Integrated QA: passed
- Schema disposition: no schema change required
- Repositories inventoried: 9
- Non-sensitive pilot items: 12
- Production rows: zero
- Live Graph calls: zero
- Live Microsoft writes: zero
- Canonical source snapshots: one
- Loose source copies: zero

The source snapshot excludes Git metadata, dependencies, compiled output, coverage, caches, uploads, runtime databases, logs, TypeScript build information, and non-template environment files.
`,
    );

    const snapshotHash = hashFile(snapshotZip);
    const filesBeforeManifest = walkFiles(packageRoot)
      .map((relativePath) => ({
        path: relativePath,
        ...hashFile(path.join(packageRoot, relativePath)),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
    const packageManifest = {
      schemaVersion: "1.0",
      packageId: PACKAGE_BASE_NAME,
      milestone: "M5.1A",
      status: "complete",
      evidenceClass:
        "synthetic_operations_hub_connector_architecture_demo",
      criteriaPassed: 8,
      criteriaExpected: 8,
      assertionCount: acceptanceManifest.assertionCount,
      integratedQa: "passed",
      schemaIntegrity: "passed_no_change_required",
      exactAcceptance: acceptanceManifest.exactAcceptance,
      exitGate: true,
      productionRows: 0,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
      liveWrites: 0,
      nonredundancy: {
        canonicalSourceSnapshots: 1,
        looseSourceCopies: 0,
        milestoneSourceCopies: 0,
        integratedScenarioResults: 1,
        milestoneEvidenceSubfolders: [],
      },
      sourceSnapshot: {
        path: `20_Canonical_Source/${SOURCE_SNAPSHOT_NAME}`,
        ...snapshotHash,
        restoredFiles: stagedSourceMap.size,
      },
      files: filesBeforeManifest,
    };
    fs.writeFileSync(
      path.join(packageManifestRoot, "M5_1A_PACKAGE_MANIFEST.json"),
      `${JSON.stringify(packageManifest, null, 2)}\n`,
    );
    const checksumFiles = walkFiles(packageRoot)
      .map((relativePath) => ({
        path: relativePath,
        ...hashFile(path.join(packageRoot, relativePath)),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
    fs.writeFileSync(
      path.join(packageManifestRoot, "M5_1A_PACKAGE_SHA256SUMS.txt"),
      `${checksumFiles
        .map((file) => `${file.sha256}  ${file.path}`)
        .join("\n")}\n`,
    );

    normalizeTimes(packageRoot);
    const stagedPackageMap = fileMap(packageRoot);
    const stagedZip = path.join(temporaryRoot, `${PACKAGE_BASE_NAME}.zip`);
    const outerFiles = walkFiles(packageRoot).map((relativePath) =>
      normalize(path.join(PACKAGE_BASE_NAME, relativePath)),
    );
    createDeterministicZip(stagedZip, temporaryRoot, outerFiles);
    const packageRestore = path.join(temporaryRoot, "package-restore");
    fs.mkdirSync(packageRestore, { recursive: true });
    run("unzip", ["-q", stagedZip, "-d", packageRestore]);
    compareMaps(
      stagedPackageMap,
      fileMap(path.join(packageRestore, PACKAGE_BASE_NAME)),
      "Integrated M5.1A package restoration",
    );
    const outerListing = run("unzip", ["-Z1", stagedZip])
      .split(/\r?\n/)
      .filter(Boolean);
    const sourceSnapshots = outerListing.filter((entry) =>
      /\/20_Canonical_Source\/[^/]+\.zip$/.test(entry),
    );
    assert(
      sourceSnapshots.length === 1 &&
        sourceSnapshots[0].endsWith(`/${SOURCE_SNAPSHOT_NAME}`),
      `Sealed M5.1A package contains ${sourceSnapshots.length} canonical source snapshots; exactly one is required.`,
    );
    assert(
      outerListing.filter((entry) =>
        entry.endsWith("/M5_1A_INTEGRATED_SCENARIO_RESULT.json"),
      ).length === 1,
      "Sealed M5.1A package must contain exactly one integrated scenario result.",
    );
    for (const criterionFile of CRITERION_EVIDENCE_FILES)
      assert(
        outerListing.filter((entry) => entry.endsWith(`/${criterionFile}`))
          .length === 1,
        `Sealed M5.1A package must contain exactly one ${criterionFile}.`,
      );
    for (const stepId of M51A_REQUIRED_QA_STEPS)
      assert(
        outerListing.filter((entry) =>
          entry.endsWith(`/Verification_Logs/${stepId}.log`),
        ).length === 1,
        `Sealed M5.1A package must contain exactly one ${stepId} QA log.`,
      );
    for (const requiredEvidence of [
      "M5_1A_ACCEPTANCE_MANIFEST.json",
      "M5_1A_INTEGRATED_QA.json",
      "M5_1A_SCHEMA_INTEGRITY.json",
    ])
      assert(
        outerListing.filter((entry) => entry.endsWith(`/${requiredEvidence}`))
          .length === 1,
        `Sealed M5.1A package must contain exactly one ${requiredEvidence}.`,
      );
    compareMaps(
      liveSourceBefore,
      filteredSourceMap(sourceRoot),
      "Canonical source during sealing",
    );

    const sealedHash = hashFile(stagedZip);
    atomicCopy(stagedZip, packageZip);
    atomicWrite(
      packageSidecar,
      `${sealedHash.sha256}  ${path.basename(packageZip)}\n`,
    );
    const sealResult = {
      status: "PASS",
      sealedAt: new Date().toISOString(),
      package: path.basename(packageZip),
      final: true,
      milestone: "M5.1A",
      evidenceClass:
        "synthetic_operations_hub_connector_architecture_demo",
      bytes: sealedHash.bytes,
      sha256: sealedHash.sha256,
      criteriaPassed: 8,
      criteriaExpected: 8,
      assertionCount: acceptanceManifest.assertionCount,
      integratedQa: qaReport.passed ? "passed" : "failed",
      schemaIntegrity: "passed_no_change_required",
      independentReview: "GO",
      acceptance: "ACCEPTED",
      releaseReadiness: "READY",
      exitGate: true,
      productionRows: 0,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
      liveWrites: 0,
      canonicalSourceSnapshot: {
        file: SOURCE_SNAPSHOT_NAME,
        bytes: snapshotHash.bytes,
        sha256: snapshotHash.sha256,
        restoredFiles: stagedSourceMap.size,
      },
      packageFiles: stagedPackageMap.size,
      milestoneEvidenceSubfolders: [],
      nonredundancyVerified: true,
    };
    atomicWrite(sealResultPath, `${JSON.stringify(sealResult, null, 2)}\n`);
    return { output: options.output, ...sealResult };
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(
      JSON.stringify(
        sealM51aPackage(parseM51aSealOptions(process.argv.slice(2))),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
