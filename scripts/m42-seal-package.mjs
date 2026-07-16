import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { M42_REQUIRED_QA_STEPS } from "./m42-run-qa.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_BASE_NAME =
  "AMOS-OPS_M4_2_Document_and_Knowledge_Management_Operational_Package_v1_0";
const SOURCE_SNAPSHOT_NAME = "AMOS-OPS_M4_2_Canonical_Source_Snapshot_v1_0.zip";
const CRITERION_EVIDENCE_FILES = Object.freeze([
  "M4_2_DMS_TAXONOMY_LIFECYCLE_RESULT.json",
  "M4_2_DOCUMENT_ACCESS_RECORDS_RESULT.json",
  "M4_2_VERSION_SOURCE_OF_TRUTH_RESULT.json",
  "M4_2_SEARCH_PERFORMANCE_RESULT.json",
  "M4_2_NIL_SEMANTIC_ACCURACY_RESULT.json",
  "M4_2_REPORT_BUILDER_RESULT.json",
  "M4_2_NO_CODE_ADMIN_RESULT.json",
  "M4_2_INTEGRATED_SCENARIO_RESULT.json",
]);
const REQUIRED_CLOSURE_CONTROLS = Object.freeze([
  "M4_2_IMPLEMENTATION_REGISTER.md",
  "M4_2_TRACEABILITY_MATRIX.csv",
  "M4_2_INDEPENDENT_REVIEW.md",
  "M4_2_ACCEPTANCE_RECORD.md",
  "M4_2_RELEASE_READINESS.md",
]);
const REQUIRED_FOCUSED_TESTS = Object.freeze([
  "api/tests/m42-integrated-scenario.test.ts",
  "api/tests/m42-search-performance.test.ts",
  "api/tests/m42-nil-semantic-accuracy.test.ts",
  "api/tests/m42-report-builder.test.ts",
  "api/tests/m42-admin-configuration.test.ts",
  "src/components/m42/m42-document-knowledge-view.test.tsx",
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

export function parseM42SealOptions(argv) {
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
  throw new Error(`M4.2 source root is missing under ${root}.`);
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
      else throw new Error(`Unsupported M4.2 package entry: ${absolute}`);
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
  assert(
    relativeFiles.length > 0,
    `Refusing to create empty ZIP: ${archivePath}`,
  );
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
      `M4.2 closure control is missing: ${fileName}`,
    );
  const review = fs.readFileSync(
    path.join(controlsRoot, "M4_2_INDEPENDENT_REVIEW.md"),
    "utf8",
  );
  const acceptance = fs.readFileSync(
    path.join(controlsRoot, "M4_2_ACCEPTANCE_RECORD.md"),
    "utf8",
  );
  const readiness = fs.readFileSync(
    path.join(controlsRoot, "M4_2_RELEASE_READINESS.md"),
    "utf8",
  );
  assert(
    /\*\*Disposition:\*\*\s+GO\b/i.test(review),
    "M4.2 sealing requires independent-review Disposition: GO.",
  );
  assert(
    /\*\*Disposition:\*\*\s+ACCEPTED\b/i.test(acceptance),
    "M4.2 sealing requires acceptance-record Disposition: ACCEPTED.",
  );
  assert(
    /\*\*Readiness:\*\*\s+READY\b/i.test(readiness),
    "M4.2 sealing requires release-readiness Readiness: READY.",
  );
}

function verifySchemaReport(evidenceRoot, expectedRelativePath) {
  assert(
    typeof expectedRelativePath === "string" &&
      !path.isAbsolute(expectedRelativePath),
    "M4.2 schema report path is invalid.",
  );
  const reportPath = path.resolve(evidenceRoot, expectedRelativePath);
  assert(
    isWithin(evidenceRoot, reportPath) && fs.existsSync(reportPath),
    "M4.2 schema-integrity report is missing.",
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert(
    report.reportId === "M42-SCHEMA-INTEGRITY" &&
      report.milestone === "M4.2" &&
      report.evidenceClass === "synthetic_document_knowledge_demo" &&
      report.passed === true &&
      report.disposition === "NO_SCHEMA_CHANGE_REQUIRED" &&
      report.inheritedMigrationCount === 11 &&
      report.inheritedMigrationHead ===
        "0010_m41c_clinical_intelligence_fabric.sql" &&
      Array.isArray(report.m42MigrationFiles) &&
      report.m42MigrationFiles.length === 0 &&
      /^[a-f0-9]{64}$/.test(report.schemaSha256) &&
      report.databaseWrites === 0 &&
      report.productionRows === 0 &&
      report.usesProductionData === false,
    "M4.2 schema-integrity result drifted.",
  );
  return report;
}

function verifyQaReport(evidenceRoot) {
  const reportPath = path.join(evidenceRoot, "M4_2_INTEGRATED_QA.json");
  assert(fs.existsSync(reportPath), "M4.2 integrated QA report is missing.");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert(
    report.reportId === "M42-INTEGRATED-QA" &&
      report.milestone === "M4.2" &&
      report.evidenceClass === "synthetic_document_knowledge_demo" &&
      report.productionRows === 0 &&
      report.liveWrites === 0 &&
      report.usesProductionData === false &&
      report.passed === true,
    "M4.2 integrated QA identity, boundary, or result drifted.",
  );
  assert(
    JSON.stringify(report.requiredSteps) ===
      JSON.stringify(M42_REQUIRED_QA_STEPS),
    "M4.2 required QA step register drifted.",
  );
  assert(
    Array.isArray(report.focusedTests) && report.focusedTests.length > 0,
    "M4.2 QA did not retain focused test identities.",
  );
  for (const required of REQUIRED_FOCUSED_TESTS)
    assert(
      report.focusedTests.includes(required),
      `M4.2 focused QA omitted ${required}.`,
    );
  assert(
    new Set(report.focusedTests).size === report.focusedTests.length,
    "M4.2 focused QA contains duplicate test execution.",
  );
  assert(
    Array.isArray(report.steps) &&
      JSON.stringify(report.steps.map((step) => step.id)) ===
        JSON.stringify(M42_REQUIRED_QA_STEPS) &&
      report.steps.every((step) => step.exitCode === 0),
    "M4.2 QA sequence is incomplete, reordered, or failing.",
  );
  for (const step of report.steps) {
    assert(
      typeof step.log === "string" && !path.isAbsolute(step.log),
      `M4.2 QA log path is invalid for ${step.id}.`,
    );
    const logPath = path.resolve(evidenceRoot, step.log);
    assert(
      isWithin(evidenceRoot, logPath) && fs.existsSync(logPath),
      `M4.2 QA log is missing for ${step.id}.`,
    );
  }
  verifySchemaReport(evidenceRoot, report.schemaReport);
  return report;
}

function verifyAcceptanceManifest(evidenceRoot) {
  const manifestPath = path.join(evidenceRoot, "M4_2_ACCEPTANCE_MANIFEST.json");
  assert(fs.existsSync(manifestPath), "M4.2 acceptance manifest is missing.");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert(
    manifest.recordId === "AMOS-OPS-M4.2-ACCEPTANCE-EVIDENCE" &&
      manifest.milestone === "M4.2" &&
      manifest.status === "complete" &&
      manifest.disposition === "ACCEPTED" &&
      manifest.evidenceClass === "synthetic_document_knowledge_demo" &&
      manifest.criteriaExpected === 8 &&
      manifest.criteriaPassed === 8 &&
      Number.isInteger(manifest.assertionCount) &&
      manifest.assertionCount > 0 &&
      manifest.accepted === true &&
      Object.values(manifest.exactAcceptance ?? {}).length === 5 &&
      Object.values(manifest.exactAcceptance).every(Boolean),
    "Final sealing requires complete passing M4.2 acceptance evidence.",
  );
  const boundary = manifest.syntheticBoundary ?? {};
  assert(
    boundary.syntheticOnly === true &&
      boundary.realDataUsed === false &&
      boundary.liveConnectorMutation === false &&
      boundary.productionDisposition === false &&
      boundary.productionDeployment === false &&
      boundary.githubPush === false &&
      boundary.productionRows === 0 &&
      boundary.liveWrites === 0 &&
      boundary.usesProductionData === false,
    "M4.2 acceptance boundary drifted.",
  );
  return manifest;
}

export function sealM42Package(options) {
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
      `M4.2 ${label} root is missing: ${target}`,
    );
  assert(
    !isWithin(sourceRoot, options.output),
    "M4.2 package output cannot be written inside the canonical source tree.",
  );

  run(
    process.execPath,
    [
      "--import",
      "tsx",
      path.join(SCRIPT_DIRECTORY, "m42-verify-evidence.ts"),
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
      `M4.2 sealing refuses to overwrite existing output: ${target}`,
    );

  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "amos-m42-seal-"),
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
      "Filtered M4.2 canonical source snapshot is incomplete.",
    );
    assert(
      [...stagedSourceMap.keys()].every(
        (relativePath) => !sourcePathExcluded(relativePath),
      ),
      "Filtered M4.2 source contains excluded content.",
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
    fs.copyFileSync(
      snapshotZip,
      path.join(packageSource, SOURCE_SNAPSHOT_NAME),
    );
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
      "M4.2 evidence contains a prohibited source, dependency, or build-output copy.",
    );
    assert(
      !evidenceFiles.some((relativePath) =>
        /\.(zip|db|sqlite|sqlite3)(-shm|-wal)?$/i.test(relativePath),
      ),
      "M4.2 evidence contains a nested snapshot or runtime database.",
    );
    const sourceEntries = walkFiles(packageSource);
    assert(
      sourceEntries.length === 1 && sourceEntries[0] === SOURCE_SNAPSHOT_NAME,
      "M4.2 package must contain one canonical source snapshot and no loose source copy.",
    );

    fs.writeFileSync(
      path.join(packageRoot, "README.md"),
      `# AMOS-OPS M4.2 Integrated Sprint Package

This package contains one controlling-document set, one integrated evidence set, and one filtered canonical source snapshot for M4.2 Document and Knowledge Management Operational.

- Evidence boundary: synthetic document and knowledge demonstration only
- Acceptance criteria: 8/8
- Acceptance assertions: ${acceptanceManifest.assertionCount}
- Integrated QA: passed
- Schema disposition: no schema change required
- Search target: under 3,000 milliseconds
- NIL target: at least 90 percent top-1 accuracy
- Production rows: zero
- Live writes: zero
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
      milestone: "M4.2",
      status: "complete",
      evidenceClass: "synthetic_document_knowledge_demo",
      criteriaPassed: 8,
      criteriaExpected: 8,
      assertionCount: acceptanceManifest.assertionCount,
      integratedQa: "passed",
      schemaIntegrity: "passed_no_change_required",
      exactAcceptance: acceptanceManifest.exactAcceptance,
      exitGate: true,
      productionRows: 0,
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
      path.join(packageManifestRoot, "M4_2_PACKAGE_MANIFEST.json"),
      `${JSON.stringify(packageManifest, null, 2)}\n`,
    );
    const checksumFiles = walkFiles(packageRoot)
      .map((relativePath) => ({
        path: relativePath,
        ...hashFile(path.join(packageRoot, relativePath)),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
    fs.writeFileSync(
      path.join(packageManifestRoot, "M4_2_PACKAGE_SHA256SUMS.txt"),
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
      "Integrated M4.2 package restoration",
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
      `Sealed M4.2 package contains ${sourceSnapshots.length} canonical source snapshots; exactly one is required.`,
    );
    assert(
      outerListing.filter((entry) =>
        entry.endsWith("/M4_2_INTEGRATED_SCENARIO_RESULT.json"),
      ).length === 1,
      "Sealed M4.2 package must contain exactly one integrated scenario result.",
    );
    for (const criterionFile of CRITERION_EVIDENCE_FILES)
      assert(
        outerListing.filter((entry) => entry.endsWith(`/${criterionFile}`))
          .length === 1,
        `Sealed M4.2 package must contain exactly one ${criterionFile}.`,
      );
    for (const stepId of M42_REQUIRED_QA_STEPS)
      assert(
        outerListing.filter((entry) =>
          entry.endsWith(`/Verification_Logs/${stepId}.log`),
        ).length === 1,
        `Sealed M4.2 package must contain exactly one ${stepId} QA log.`,
      );
    for (const requiredEvidence of [
      "M4_2_ACCEPTANCE_MANIFEST.json",
      "M4_2_INTEGRATED_QA.json",
      "M4_2_SCHEMA_INTEGRITY.json",
    ])
      assert(
        outerListing.filter((entry) => entry.endsWith(`/${requiredEvidence}`))
          .length === 1,
        `Sealed M4.2 package must contain exactly one ${requiredEvidence}.`,
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
      milestone: "M4.2",
      evidenceClass: "synthetic_document_knowledge_demo",
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
        sealM42Package(parseM42SealOptions(process.argv.slice(2))),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
