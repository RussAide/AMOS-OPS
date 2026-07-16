import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_BASE_NAME = "AMOS-OPS_M4_1A_Executive_Decision_Intelligence_Package_v1_0";
const SOURCE_SNAPSHOT_NAME = "AMOS-OPS_M4_1A_Canonical_Source_Snapshot_v1_0.zip";
const REQUIRED_QA_STEPS = [
  "migration_integrity",
  "focused_m41a_tests",
  "typecheck",
  "strict_lint",
  "full_regression",
  "client_build",
  "server_build",
];
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

export function parseM41aSealOptions(argv) {
  let root;
  let output;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else output = value;
      index += 1;
    } else if (argument.startsWith("--")) {
      throw new Error(`Unknown option: ${argument}`);
    } else {
      positional.push(argument);
    }
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
  throw new Error(`M4.1A source root is missing under ${root}.`);
}

function phaseRootFor(root) {
  return fs.existsSync(path.join(root, "source", "package.json")) ? root : path.dirname(sourceRootFor(root));
}

function normalize(value) {
  return value.split(path.sep).join("/");
}

function isWithin(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function hashFile(filePath) {
  const contents = fs.readFileSync(filePath);
  return { bytes: contents.length, sha256: createHash("sha256").update(contents).digest("hex") };
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const result = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push(normalize(path.relative(root, absolute)));
      else throw new Error(`Unsupported package filesystem entry: ${absolute}`);
    }
  };
  visit(root);
  return result;
}

function sourcePathExcluded(relativePath) {
  if (!relativePath) return false;
  const segments = normalize(relativePath).split("/");
  if (segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment))) return true;
  const fileName = segments.at(-1) ?? "";
  if (/\.(db|sqlite|sqlite3)(-shm|-wal)?$/i.test(fileName)) return true;
  if (/\.(log|tsbuildinfo)$/i.test(fileName) || fileName === ".DS_Store") return true;
  if (/^\.env(?:\..+)?$/.test(fileName) && !/\.(example|sample|template)$/.test(fileName)) return true;
  return false;
}

function copyFilteredSource(source, destination) {
  fs.cpSync(source, destination, {
    recursive: true,
    preserveTimestamps: true,
    filter: (sourcePath) => !sourcePathExcluded(path.relative(source, sourcePath)),
  });
}

function fileMap(root) {
  return new Map(walkFiles(root).map((relativePath) => [relativePath, hashFile(path.join(root, relativePath))]));
}

function filteredSourceMap(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relativePath = normalize(path.relative(root, absolute));
      if (sourcePathExcluded(relativePath)) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(relativePath);
      else throw new Error(`Unsupported canonical-source filesystem entry: ${absolute}`);
    }
  };
  visit(root);
  return new Map(files.map((relativePath) => [relativePath, hashFile(path.join(root, relativePath))]));
}

function compareMaps(expected, actual, label) {
  assert(JSON.stringify([...expected.keys()].sort()) === JSON.stringify([...actual.keys()].sort()), `${label} file inventory changed.`);
  for (const [relativePath, expectedValue] of expected) {
    const actualValue = actual.get(relativePath);
    assert(actualValue && actualValue.bytes === expectedValue.bytes && actualValue.sha256 === expectedValue.sha256, `${label} byte/hash mismatch: ${relativePath}`);
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 200 * 1024 * 1024,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed (${result.status ?? "unknown"}).\n${result.stdout ?? ""}\n${result.stderr ?? ""}`);
  }
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

function verifyQaReport(evidenceRoot) {
  const reportPath = path.join(evidenceRoot, "M4_1A_INTEGRATED_QA.json");
  assert(fs.existsSync(reportPath), `M4.1A integrated QA report is missing: ${reportPath}`);
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  assert(report.reportId === "M41A-INTEGRATED-QA" && report.evidenceClass === "synthetic_demo", "M4.1A integrated QA identity or evidence boundary drifted.");
  assert(report.passed === true, "M4.1A integrated QA is not passing.");
  assert(JSON.stringify(report.requiredSteps) === JSON.stringify(REQUIRED_QA_STEPS), "M4.1A required QA step register drifted.");
  assert(Array.isArray(report.focusedTests) && report.focusedTests.length > 0, "M4.1A QA did not retain focused test identities.");
  assert(Array.isArray(report.steps) && JSON.stringify(report.steps.map((step) => step.id)) === JSON.stringify(REQUIRED_QA_STEPS), "M4.1A executed QA step order drifted.");
  assert(report.steps.every((step) => step.exitCode === 0), "M4.1A integrated QA contains a failing step.");
  for (const step of report.steps) {
    assert(typeof step.log === "string" && !path.isAbsolute(step.log), `M4.1A QA log path is invalid for ${step.id}.`);
    const logPath = path.resolve(evidenceRoot, step.log);
    assert(isWithin(evidenceRoot, logPath) && fs.existsSync(logPath), `M4.1A QA log is missing for ${step.id}.`);
  }
  return report;
}

export function sealM41aPackage(options) {
  const phaseRoot = phaseRootFor(options.root);
  const sourceRoot = sourceRootFor(options.root);
  const controlsRoot = path.join(phaseRoot, "controls");
  const evidenceRoot = path.join(phaseRoot, "evidence");
  for (const [label, target] of [["source", sourceRoot], ["controls", controlsRoot], ["evidence", evidenceRoot]]) {
    assert(fs.existsSync(target) && fs.statSync(target).isDirectory(), `M4.1A ${label} root is missing: ${target}`);
  }
  assert(!isWithin(sourceRoot, options.output), "M4.1A package output cannot be written inside the canonical source tree.");

  run(process.execPath, [
    "--import",
    "tsx",
    path.join(SCRIPT_DIRECTORY, "m41a-verify-evidence.ts"),
    "--root",
    phaseRoot,
    "--output",
    evidenceRoot,
  ], { cwd: sourceRoot });

  const acceptanceManifest = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "M4_1A_ACCEPTANCE_MANIFEST.json"), "utf8"));
  assert(acceptanceManifest.status === "complete" && acceptanceManifest.evidenceClass === "synthetic_demo", "Final sealing requires complete synthetic M4.1A acceptance evidence.");
  assert(acceptanceManifest.criteriaExpected === 8 && acceptanceManifest.criteriaPassed === 8, "Final sealing requires all 8 M4.1A criteria.");
  assert(acceptanceManifest.exitGate === true, "Final sealing requires the passing M4.1A exit gate.");
  const qaReport = verifyQaReport(evidenceRoot);

  fs.mkdirSync(options.output, { recursive: true });
  const packageZip = path.join(options.output, `${PACKAGE_BASE_NAME}.zip`);
  const packageSidecar = `${packageZip}.sha256`;
  const sealResultPath = path.join(options.output, `${PACKAGE_BASE_NAME}_SEAL_RESULT.json`);
  for (const target of [packageZip, packageSidecar, sealResultPath]) assert(!fs.existsSync(target), `M4.1A sealing refuses to overwrite existing output: ${target}`);

  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "amos-m41a-seal-"));
  try {
    const filteredSource = path.join(temporaryRoot, "filtered-source");
    const sourceRestore = path.join(temporaryRoot, "source-restore");
    const snapshotZip = path.join(temporaryRoot, SOURCE_SNAPSHOT_NAME);
    const liveSourceBefore = filteredSourceMap(sourceRoot);
    copyFilteredSource(sourceRoot, filteredSource);
    const stagedSourceMap = fileMap(filteredSource);
    compareMaps(liveSourceBefore, stagedSourceMap, "Canonical source staging");
    assert(stagedSourceMap.size > 0 && stagedSourceMap.has("package.json"), "Filtered M4.1A canonical source snapshot is incomplete.");
    assert([...stagedSourceMap.keys()].every((relativePath) => !sourcePathExcluded(relativePath)), "Filtered M4.1A source still contains excluded content.");
    normalizeTimes(filteredSource);
    createDeterministicZip(snapshotZip, filteredSource, [...stagedSourceMap.keys()]);
    fs.mkdirSync(sourceRestore, { recursive: true });
    run("unzip", ["-q", snapshotZip, "-d", sourceRestore]);
    compareMaps(stagedSourceMap, fileMap(sourceRestore), "Canonical source snapshot restoration");

    const packageRoot = path.join(temporaryRoot, PACKAGE_BASE_NAME);
    const packageControls = path.join(packageRoot, "00_Controls");
    const packageEvidence = path.join(packageRoot, "10_Evidence");
    const packageSource = path.join(packageRoot, "20_Canonical_Source");
    const packageManifestRoot = path.join(packageRoot, "90_Seal_Manifest");
    fs.mkdirSync(packageRoot, { recursive: true });
    fs.cpSync(controlsRoot, packageControls, { recursive: true, preserveTimestamps: true });
    fs.cpSync(evidenceRoot, packageEvidence, { recursive: true, preserveTimestamps: true });
    fs.mkdirSync(packageSource, { recursive: true });
    fs.copyFileSync(snapshotZip, path.join(packageSource, SOURCE_SNAPSHOT_NAME));
    fs.mkdirSync(packageManifestRoot, { recursive: true });

    const evidenceFiles = walkFiles(packageEvidence);
    assert(!evidenceFiles.some((relativePath) => relativePath.split("/").some((segment) => ["source", "node_modules", ".git", "dist", "dist-server", "coverage"].includes(segment))), "M4.1A evidence contains a prohibited source, dependency, or build-output copy.");
    assert(!evidenceFiles.some((relativePath) => /\.(zip|db|sqlite|sqlite3)(-shm|-wal)?$/i.test(relativePath)), "M4.1A evidence contains a nested snapshot or runtime database.");
    const sourceEntries = walkFiles(packageSource);
    assert(sourceEntries.length === 1 && sourceEntries[0] === SOURCE_SNAPSHOT_NAME, "M4.1A package must contain exactly one canonical source snapshot and no loose source copy.");

    fs.writeFileSync(path.join(packageRoot, "README.md"), `# AMOS-OPS M4.1A Integrated Sprint Package

This package contains one controlling-document set, one integrated evidence set, and one filtered canonical source snapshot for M4.1A Executive Decision Intelligence.

- Evidence boundary: synthetic demonstration only
- Acceptance criteria: 8/8
- Integrated QA: passed
- Exit gate: passed
- Canonical source snapshots: one
- Milestone source copies: zero

The source snapshot excludes Git metadata, dependencies, compiled output, coverage, caches, uploads, runtime databases, logs, TypeScript build information, and non-template environment files.
`);

    const snapshotHash = hashFile(snapshotZip);
    const filesBeforeManifest = walkFiles(packageRoot).map((relativePath) => ({
      path: relativePath,
      ...hashFile(path.join(packageRoot, relativePath)),
    })).sort((left, right) => left.path.localeCompare(right.path));
    const packageManifest = {
      schemaVersion: "1.0",
      packageId: PACKAGE_BASE_NAME,
      status: "complete",
      evidenceClass: "synthetic_demo",
      criteriaPassed: 8,
      criteriaExpected: 8,
      integratedQa: "passed",
      exitGate: true,
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
    const packageManifestPath = path.join(packageManifestRoot, "M4_1A_PACKAGE_MANIFEST.json");
    fs.writeFileSync(packageManifestPath, `${JSON.stringify(packageManifest, null, 2)}\n`);
    const checksumFiles = walkFiles(packageRoot).map((relativePath) => ({
      path: relativePath,
      ...hashFile(path.join(packageRoot, relativePath)),
    })).sort((left, right) => left.path.localeCompare(right.path));
    fs.writeFileSync(
      path.join(packageManifestRoot, "M4_1A_PACKAGE_SHA256SUMS.txt"),
      `${checksumFiles.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`,
    );

    normalizeTimes(packageRoot);
    const stagedPackageMap = fileMap(packageRoot);
    const stagedZip = path.join(temporaryRoot, `${PACKAGE_BASE_NAME}.zip`);
    const outerFiles = walkFiles(packageRoot).map((relativePath) => normalize(path.join(PACKAGE_BASE_NAME, relativePath)));
    createDeterministicZip(stagedZip, temporaryRoot, outerFiles);
    const packageRestore = path.join(temporaryRoot, "package-restore");
    fs.mkdirSync(packageRestore, { recursive: true });
    run("unzip", ["-q", stagedZip, "-d", packageRestore]);
    compareMaps(stagedPackageMap, fileMap(path.join(packageRestore, PACKAGE_BASE_NAME)), "Integrated M4.1A package restoration");
    const outerListing = run("unzip", ["-Z1", stagedZip]).split(/\r?\n/).filter(Boolean);
    const sourceSnapshots = outerListing.filter((entry) => /\/20_Canonical_Source\/[^/]+\.zip$/.test(entry));
    assert(sourceSnapshots.length === 1 && sourceSnapshots[0].endsWith(`/${SOURCE_SNAPSHOT_NAME}`), `Sealed M4.1A package contains ${sourceSnapshots.length} canonical source snapshots; exactly one is required.`);
    assert(outerListing.filter((entry) => entry.endsWith("/M4_1A_INTEGRATED_SCENARIO_RESULT.json")).length === 1, "Sealed M4.1A package must contain exactly one integrated scenario result.");
    compareMaps(liveSourceBefore, filteredSourceMap(sourceRoot), "Canonical source during sealing");

    const sealedHash = hashFile(stagedZip);
    atomicCopy(stagedZip, packageZip);
    atomicWrite(packageSidecar, `${sealedHash.sha256}  ${path.basename(packageZip)}\n`);
    const sealResult = {
      status: "PASS",
      sealedAt: new Date().toISOString(),
      package: path.basename(packageZip),
      final: true,
      evidenceClass: "synthetic_demo",
      bytes: sealedHash.bytes,
      sha256: sealedHash.sha256,
      criteriaPassed: 8,
      criteriaExpected: 8,
      integratedQa: qaReport.passed ? "passed" : "failed",
      exitGate: true,
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

const isMain = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = parseM41aSealOptions(process.argv.slice(2));
    console.log(JSON.stringify(sealM41aPackage(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
