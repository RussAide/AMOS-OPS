import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { M41C_REQUIRED_QA_STEPS } from "./m41c-run-qa.mjs";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_BASE_NAME =
  "AMOS-OPS_M4_1C_Clinical_Intelligence_Fabric_Operational_Package_v1_0";
const SOURCE_SNAPSHOT_NAME =
  "AMOS-OPS_M4_1C_Canonical_Source_Snapshot_v1_0.zip";
const CRITERION_EVIDENCE_FILES = Object.freeze([
  "M4_1C_CLINICAL_GOVERNANCE_RESULT.json",
  "M4_1C_KNOWLEDGE_REGISTRY_RESULT.json",
  "M4_1C_INSTRUMENT_PROFILE_SEPARATION_RESULT.json",
  "M4_1C_UNAPPROVED_LOGIC_QUARANTINE_RESULT.json",
  "M4_1C_INSTRUMENT_VALIDATION_RESULT.json",
  "M4_1C_PATHWAY_ORCHESTRATION_RESULT.json",
  "M4_1C_TEXAS_TRR_RESULT.json",
  "M4_1C_SUICIDE_CRISIS_PATHWAY_RESULT.json",
  "M4_1C_YOUTH_PATHWAY_PACK_RESULT.json",
  "M4_1C_MEDICATION_PHYSICAL_HEALTH_SAFETY_RESULT.json",
  "M4_1C_CONTINUUM_EPISODE_RESULT.json",
  "M4_1C_ASK_AMOS_EIA_CLINICAL_RESULT.json",
  "M4_1C_FIVE_CADENCE_CLINICAL_WORKPLAN_RESULT.json",
  "M4_1C_CMBHS_FHIR_MAPPING_RESULT.json",
  "M4_1C_CLINICAL_ACCESS_PROVENANCE_RESULT.json",
  "M4_1C_SYNTHETIC_PATHWAY_SCENARIO_RESULT.json",
  "M4_1C_CLINICAL_TEST_MONITORING_RESULT.json",
  "M4_1C_COMPETENCY_CERTIFICATION_RESULT.json",
]);
const REQUIRED_CLOSURE_CONTROLS = Object.freeze([
  "M4_1C_IMPLEMENTATION_REGISTER.md",
  "M4_1C_TRACEABILITY_MATRIX.csv",
  "M4_1C_INDEPENDENT_REVIEW.md",
  "M4_1C_ACCEPTANCE_RECORD.md",
  "M4_1C_RELEASE_READINESS.md",
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

export function parseM41cSealOptions(argv) {
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
  throw new Error(`M4.1C source root is missing under ${root}.`);
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
      else throw new Error(`Unsupported M4.1C package entry: ${absolute}`);
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
      `M4.1C closure control is missing: ${fileName}`,
    );
  const review = fs.readFileSync(
    path.join(controlsRoot, "M4_1C_INDEPENDENT_REVIEW.md"),
    "utf8",
  );
  const acceptance = fs.readFileSync(
    path.join(controlsRoot, "M4_1C_ACCEPTANCE_RECORD.md"),
    "utf8",
  );
  const readiness = fs.readFileSync(
    path.join(controlsRoot, "M4_1C_RELEASE_READINESS.md"),
    "utf8",
  );
  assert(
    /\*\*Disposition:\*\*\s+GO\b/i.test(review),
    "M4.1C sealing is blocked until independent review records Disposition: GO.",
  );
  assert(
    /\*\*Disposition:\*\*\s+ACCEPTED\b/i.test(acceptance),
    "M4.1C sealing is blocked until the acceptance record states Disposition: ACCEPTED.",
  );
  assert(
    /\*\*Readiness:\*\*\s+READY\b/i.test(readiness),
    "M4.1C sealing is blocked until release readiness states Readiness: READY.",
  );
}

function verifyQaReport(evidenceRoot) {
  const reportPath = path.join(evidenceRoot, "M4_1C_INTEGRATED_QA.json");
  assert(
    fs.existsSync(reportPath),
    `M4.1C integrated QA report is missing: ${reportPath}`,
  );
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert(
    report.reportId === "M41C-INTEGRATED-QA" &&
      report.milestone === "M4.1C" &&
      report.evidenceClass === "synthetic_clinical_demo" &&
      report.productionRows === 0 &&
      report.liveWrites === 0 &&
      report.usesProductionData === false,
    "M4.1C integrated QA identity or evidence boundary drifted.",
  );
  assert(report.passed === true, "M4.1C integrated QA is not passing.");
  assert(
    JSON.stringify(report.requiredSteps) ===
      JSON.stringify(M41C_REQUIRED_QA_STEPS),
    "M4.1C required QA step register drifted.",
  );
  assert(
    Array.isArray(report.focusedTests) && report.focusedTests.length > 0,
    "M4.1C QA did not retain focused test identities.",
  );
  for (const required of [
    "api/tests/m41c-integrated-scenario.test.ts",
    "api/tests/m41c-router-access.test.ts",
    "src/components/m41c/m41c-experience-model.test.ts",
  ])
    assert(
      report.focusedTests.includes(required),
      `M4.1C focused QA omitted ${required}.`,
    );
  assert(
    new Set(report.focusedTests).size === report.focusedTests.length,
    "M4.1C focused QA contains duplicate test execution.",
  );
  assert(
    Array.isArray(report.steps) &&
      JSON.stringify(report.steps.map((step) => step.id)) ===
        JSON.stringify(M41C_REQUIRED_QA_STEPS) &&
      report.steps.every((step) => step.exitCode === 0),
    "M4.1C executed QA sequence is incomplete, reordered, or failing.",
  );
  for (const step of report.steps) {
    assert(
      typeof step.log === "string" && !path.isAbsolute(step.log),
      `M4.1C QA log path is invalid for ${step.id}.`,
    );
    const logPath = path.resolve(evidenceRoot, step.log);
    assert(
      isWithin(evidenceRoot, logPath) && fs.existsSync(logPath),
      `M4.1C QA log is missing for ${step.id}.`,
    );
  }
  const migrationReportPath = path.resolve(
    evidenceRoot,
    report.migrationReport,
  );
  assert(
    isWithin(evidenceRoot, migrationReportPath) &&
      fs.existsSync(migrationReportPath),
    "M4.1C migration verification report is missing.",
  );
  const migration = JSON.parse(fs.readFileSync(migrationReportPath, "utf8"));
  assert(
    migration.reportId === "M41C-MIGRATION-VERIFICATION" &&
      migration.milestone === "M4.1C" &&
      migration.evidenceClass === "synthetic_clinical_demo" &&
      migration.productionRows === 0 &&
      migration.liveWrites === 0 &&
      migration.passed === true &&
      migration.databaseArtifact?.lifecycle === "transient_verification_only" &&
      migration.databaseArtifact?.retained === false &&
      Number.isInteger(migration.databaseArtifact?.bytes) &&
      migration.databaseArtifact.bytes > 0 &&
      /^[a-f0-9]{64}$/.test(migration.databaseArtifact?.sha256),
    "M4.1C migration verification report or transient database hash drifted.",
  );
  return report;
}

export function sealM41cPackage(options) {
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
      `M4.1C ${label} root is missing: ${target}`,
    );
  assert(
    !isWithin(sourceRoot, options.output),
    "M4.1C package output cannot be written inside the canonical source tree.",
  );

  run(
    process.execPath,
    [
      "--import",
      "tsx",
      path.join(SCRIPT_DIRECTORY, "m41c-verify-evidence.ts"),
      "--root",
      milestoneRoot,
      "--output",
      evidenceRoot,
    ],
    { cwd: sourceRoot },
  );
  const acceptanceManifest = JSON.parse(
    fs.readFileSync(
      path.join(evidenceRoot, "M4_1C_ACCEPTANCE_MANIFEST.json"),
      "utf8",
    ),
  );
  assert(
    acceptanceManifest.status === "complete" &&
      acceptanceManifest.evidenceClass === "synthetic_clinical_demo" &&
      acceptanceManifest.criteriaExpected === 18 &&
      acceptanceManifest.criteriaPassed === 18 &&
      acceptanceManifest.exitGate === true,
    "Final sealing requires complete passing synthetic M4.1C acceptance evidence for all 18 criteria.",
  );
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
      `M4.1C sealing refuses to overwrite existing output: ${target}`,
    );

  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "amos-m41c-seal-"),
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
      "Filtered M4.1C canonical source snapshot is incomplete.",
    );
    assert(
      [...stagedSourceMap.keys()].every(
        (relativePath) => !sourcePathExcluded(relativePath),
      ),
      "Filtered M4.1C source still contains excluded content.",
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
      "M4.1C evidence contains a prohibited source, dependency, or build-output copy.",
    );
    assert(
      !evidenceFiles.some((relativePath) =>
        /\.(zip|db|sqlite|sqlite3)(-shm|-wal)?$/i.test(relativePath),
      ),
      "M4.1C evidence contains a nested snapshot or runtime database.",
    );
    const sourceEntries = walkFiles(packageSource);
    assert(
      sourceEntries.length === 1 && sourceEntries[0] === SOURCE_SNAPSHOT_NAME,
      "M4.1C package must contain exactly one canonical source snapshot and no loose source copy.",
    );

    fs.writeFileSync(
      path.join(packageRoot, "README.md"),
      `# AMOS-OPS M4.1C Integrated Sprint Package

This package contains one controlling-document set, one integrated evidence set, and one filtered canonical source snapshot for M4.1C Clinical Intelligence Fabric Operational.

- Evidence boundary: synthetic clinical demonstration only
- Acceptance criteria: 18/18
- Deterministic synthetic scenarios: 11/11
- Operating cadences: five
- Integrated QA: passed
- Exit gate: passed
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
      milestone: "M4.1C",
      status: "complete",
      evidenceClass: "synthetic_clinical_demo",
      criteriaPassed: 18,
      criteriaExpected: 18,
      syntheticScenariosPassed: 11,
      integratedQa: "passed",
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
    const packageManifestPath = path.join(
      packageManifestRoot,
      "M4_1C_PACKAGE_MANIFEST.json",
    );
    fs.writeFileSync(
      packageManifestPath,
      `${JSON.stringify(packageManifest, null, 2)}\n`,
    );
    const checksumFiles = walkFiles(packageRoot)
      .map((relativePath) => ({
        path: relativePath,
        ...hashFile(path.join(packageRoot, relativePath)),
      }))
      .sort((left, right) => left.path.localeCompare(right.path));
    fs.writeFileSync(
      path.join(packageManifestRoot, "M4_1C_PACKAGE_SHA256SUMS.txt"),
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
      "Integrated M4.1C package restoration",
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
      `Sealed M4.1C package contains ${sourceSnapshots.length} canonical source snapshots; exactly one is required.`,
    );
    assert(
      outerListing.filter((entry) =>
        entry.endsWith("/M4_1C_INTEGRATED_SCENARIO_RESULT.json"),
      ).length === 1,
      "Sealed M4.1C package must contain exactly one integrated scenario result.",
    );
    for (const criterionFile of CRITERION_EVIDENCE_FILES)
      assert(
        outerListing.filter((entry) => entry.endsWith(`/${criterionFile}`))
          .length === 1,
        `Sealed M4.1C package must contain exactly one ${criterionFile}.`,
      );
    for (const stepId of M41C_REQUIRED_QA_STEPS)
      assert(
        outerListing.filter((entry) =>
          entry.endsWith(`/Verification_Logs/${stepId}.log`),
        ).length === 1,
        `Sealed M4.1C package must contain exactly one ${stepId} QA log.`,
      );
    assert(
      outerListing.filter((entry) =>
        entry.endsWith("/M4_1C_MIGRATION_VERIFICATION.json"),
      ).length === 1,
      "Sealed M4.1C package must contain exactly one migration verification report.",
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
      milestone: "M4.1C",
      evidenceClass: "synthetic_clinical_demo",
      bytes: sealedHash.bytes,
      sha256: sealedHash.sha256,
      criteriaPassed: 18,
      criteriaExpected: 18,
      syntheticScenariosPassed: 11,
      integratedQa: qaReport.passed ? "passed" : "failed",
      migrationVerification: "passed",
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
        sealM41cPackage(parseM41cSealOptions(process.argv.slice(2))),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
