import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const GENERATED_EVIDENCE_FILES = [
  "PHASE_2_ACCEPTANCE_SUMMARY.md",
  "PHASE_2_ACCEPTANCE_MANIFEST.json",
  "PHASE_2_SHA256SUMS.txt",
];
const MILESTONE_DIRECTORIES = [
  "M2.2_MHTCM_Case_Management_Live",
  "M2.3_MHRS_Program_Module_Live",
  "M2.4_GRO_Residential_Operations_Complete",
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

function parseOptions(argv) {
  let root;
  let output;
  let evidenceOutput;
  let allowIncomplete = false;
  const positional = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--allow-incomplete") allowIncomplete = true;
    else if (["--root", "--output", "--evidence-output"].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else if (argument === "--output") output = value;
      else evidenceOutput = value;
      index += 1;
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else positional.push(argument);
  }
  root ??= positional[0] ?? "..";
  const resolvedRoot = path.resolve(root);
  output ??= positional[1] ?? path.join(resolvedRoot, "package");
  evidenceOutput ??= path.join(resolvedRoot, "evidence", "shared");
  return {
    root: resolvedRoot,
    output: path.resolve(output),
    evidenceOutput: path.resolve(evidenceOutput),
    allowIncomplete,
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  return {
    bytes: contents.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(normalize(path.relative(root, absolute)));
      else throw new Error(`Unsupported filesystem entry: ${absolute}`);
    }
  };
  visit(root);
  return files;
}

function sourcePathExcluded(relativePath) {
  if (!relativePath) return false;
  const segments = normalize(relativePath).split("/");
  if (segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment))) return true;
  const fileName = segments[segments.length - 1] ?? "";
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

function fileMap(root) {
  return new Map(walkFiles(root).map((relativePath) => [relativePath, hashFile(path.join(root, relativePath))]));
}

function compareMaps(expected, actual, label) {
  assert(JSON.stringify([...expected.keys()].sort()) === JSON.stringify([...actual.keys()].sort()), `${label} file inventory changed after ZIP restoration.`);
  for (const [relativePath, expectedValue] of expected) {
    const actualValue = actual.get(relativePath);
    assert(actualValue && actualValue.bytes === expectedValue.bytes && actualValue.sha256 === expectedValue.sha256, `${label} byte/hash mismatch after restoration: ${relativePath}`);
  }
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

const options = parseOptions(process.argv.slice(2));
const sourceRoot = path.join(options.root, "source");
const controlsRoot = path.join(options.root, "controls");
const evidenceRoot = path.join(options.root, "evidence");
for (const [label, target] of [["source", sourceRoot], ["controls", controlsRoot], ["evidence", evidenceRoot]]) {
  assert(fs.existsSync(target) && fs.statSync(target).isDirectory(), `Phase 2 ${label} root is missing: ${target}`);
}
assert(!isWithin(sourceRoot, options.output), "Package output cannot be written inside the canonical source tree.");

const verifyArguments = [
  "--import",
  "tsx",
  path.join(SCRIPT_DIRECTORY, "phase2-verify-evidence.ts"),
  "--root",
  options.root,
  "--output",
  options.evidenceOutput,
];
if (options.allowIncomplete) verifyArguments.push("--allow-incomplete");
run(process.execPath, verifyArguments, { cwd: sourceRoot });

const consolidatedManifestPath = path.join(options.evidenceOutput, "PHASE_2_ACCEPTANCE_MANIFEST.json");
const consolidatedManifest = JSON.parse(fs.readFileSync(consolidatedManifestPath, "utf8"));
if (!options.allowIncomplete) {
  assert(consolidatedManifest.status === "complete", "Final package sealing requires a complete consolidated manifest.");
  assert(consolidatedManifest.criteriaPassed === 24, "Final package sealing requires all 24 criteria.");
  assert(consolidatedManifest.integratedQa?.status === "passed", "Final package sealing requires passing integrated QA.");
} else {
  assert(consolidatedManifest.status === "development_incomplete" || consolidatedManifest.status === "complete", "Development package has an invalid consolidated status.");
}

const packageBaseName = options.allowIncomplete && consolidatedManifest.status !== "complete"
  ? "AMOS-OPS_Phase_2_Integrated_Sprint_DEVELOPMENT_INCOMPLETE"
  : "AMOS-OPS_Phase_2_Integrated_Sprint_Package_v1_0";
const packageZip = path.join(options.output, `${packageBaseName}.zip`);
const packageSidecar = `${packageZip}.sha256`;
const sealResultPath = path.join(options.output, `${packageBaseName}_SEAL_RESULT.json`);
for (const target of [packageZip, packageSidecar, sealResultPath]) assert(!fs.existsSync(target), `Sealing refuses to overwrite existing output: ${target}`);

const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "amos-phase2-seal-"));
try {
  const filteredSource = path.join(temporaryRoot, "filtered-source");
  const snapshotRestore = path.join(temporaryRoot, "snapshot-restore");
  const snapshotZip = path.join(temporaryRoot, "AMOS-OPS_Phase_2_Canonical_Source_Snapshot_v1_0.zip");
  copyFilteredSource(sourceRoot, filteredSource);
  const filteredFiles = walkFiles(filteredSource);
  assert(filteredFiles.length > 0, "Filtered canonical source snapshot is empty.");
  assert(filteredFiles.includes("package.json"), "Filtered canonical source snapshot is missing package.json.");
  assert(filteredFiles.every((relativePath) => !sourcePathExcluded(relativePath)), "Filtered canonical source snapshot still contains excluded content.");
  run("zip", ["-q", "-X", "-r", snapshotZip, "."], { cwd: filteredSource });
  run("unzip", ["-tq", snapshotZip]);
  fs.mkdirSync(snapshotRestore, { recursive: true });
  run("unzip", ["-q", snapshotZip, "-d", snapshotRestore]);
  compareMaps(fileMap(filteredSource), fileMap(snapshotRestore), "Canonical source snapshot");

  const packageRoot = path.join(temporaryRoot, packageBaseName);
  const packageControls = path.join(packageRoot, "00_Controls");
  const packageEvidence = path.join(packageRoot, "10_Evidence");
  const packageSource = path.join(packageRoot, "20_Canonical_Source");
  const packageQa = path.join(packageRoot, "90_Manifest_and_QA");
  fs.mkdirSync(packageRoot, { recursive: true });
  fs.cpSync(controlsRoot, packageControls, { recursive: true, preserveTimestamps: true });
  fs.mkdirSync(packageEvidence, { recursive: true });
  for (const directoryName of [...MILESTONE_DIRECTORIES, "shared"]) {
    const source = path.join(evidenceRoot, directoryName);
    const destination = path.join(packageEvidence, directoryName);
    if (fs.existsSync(source)) fs.cpSync(source, destination, { recursive: true, preserveTimestamps: true });
    else fs.mkdirSync(destination, { recursive: true });
  }
  if (path.resolve(options.evidenceOutput) !== path.resolve(path.join(evidenceRoot, "shared"))) {
    const packageShared = path.join(packageEvidence, "shared");
    fs.mkdirSync(packageShared, { recursive: true });
    for (const fileName of GENERATED_EVIDENCE_FILES) {
      fs.copyFileSync(path.join(options.evidenceOutput, fileName), path.join(packageShared, fileName));
    }
  }
  fs.mkdirSync(packageSource, { recursive: true });
  fs.copyFileSync(snapshotZip, path.join(packageSource, path.basename(snapshotZip)));
  fs.mkdirSync(packageQa, { recursive: true });

  for (const relativePath of walkFiles(packageEvidence)) {
    const segments = relativePath.split("/");
    assert(!segments.some((segment) => ["source", "node_modules", ".git", "dist", "dist-server", "coverage"].includes(segment)), `Milestone evidence contains a prohibited source/dependency copy: ${relativePath}`);
  }
  const sourceEntries = walkFiles(packageSource);
  assert(sourceEntries.length === 1 && sourceEntries[0] === path.basename(snapshotZip), "Package must contain exactly one canonical source snapshot and no loose source copy.");

  const readme = `# AMOS-OPS Phase 2 Integrated Sprint Package

This package contains one controls set, one integrated evidence set, and one filtered canonical source snapshot for M2.2, M2.3, and M2.4.

- Evidence boundary: synthetic demonstration only
- Acceptance criteria: ${consolidatedManifest.criteriaPassed}/24
- Integrated QA: ${consolidatedManifest.integratedQa?.status}
- Package status: ${consolidatedManifest.status}
- Source snapshots: one
- Milestone source copies: zero

The source snapshot excludes Git metadata, dependencies, compiled output, coverage, caches, uploads, runtime databases, logs, TypeScript build information, and non-template environment files.
`;
  fs.writeFileSync(path.join(packageRoot, "README.md"), readme);

  const snapshotHash = hashFile(snapshotZip);
  const filesBeforeManifest = walkFiles(packageRoot).map((relativePath) => ({
    path: relativePath,
    ...hashFile(path.join(packageRoot, relativePath)),
  }));
  const packageManifest = {
    schemaVersion: "1.0",
    packageId: packageBaseName,
    status: consolidatedManifest.status,
    evidenceClass: "synthetic_demo",
    criteriaPassed: consolidatedManifest.criteriaPassed,
    criteriaExpected: 24,
    integratedQa: consolidatedManifest.integratedQa?.status,
    nonredundancy: {
      canonicalSourceSnapshots: 1,
      looseSourceCopies: 0,
      milestoneEvidenceSubfolders: MILESTONE_DIRECTORIES,
    },
    sourceSnapshot: {
      path: `20_Canonical_Source/${path.basename(snapshotZip)}`,
      ...snapshotHash,
      restoredFiles: filteredFiles.length,
    },
    files: filesBeforeManifest.sort((left, right) => left.path.localeCompare(right.path)),
  };
  const packageManifestPath = path.join(packageQa, "PHASE_2_PACKAGE_MANIFEST.json");
  fs.writeFileSync(packageManifestPath, `${JSON.stringify(packageManifest, null, 2)}\n`);
  const checksumFiles = walkFiles(packageRoot).map((relativePath) => ({
    path: relativePath,
    ...hashFile(path.join(packageRoot, relativePath)),
  })).sort((left, right) => left.path.localeCompare(right.path));
  fs.writeFileSync(
    path.join(packageQa, "PHASE_2_PACKAGE_SHA256SUMS.txt"),
    `${checksumFiles.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`,
  );

  const stagedPackageMap = fileMap(packageRoot);
  const stagedZip = path.join(temporaryRoot, `${packageBaseName}.zip`);
  run("zip", ["-q", "-X", "-r", stagedZip, packageBaseName], { cwd: temporaryRoot });
  run("unzip", ["-tq", stagedZip]);
  const packageRestore = path.join(temporaryRoot, "package-restore");
  fs.mkdirSync(packageRestore, { recursive: true });
  run("unzip", ["-q", stagedZip, "-d", packageRestore]);
  compareMaps(stagedPackageMap, fileMap(path.join(packageRestore, packageBaseName)), "Integrated Phase 2 package");
  const outerListing = run("unzip", ["-Z1", stagedZip]).split(/\r?\n/).filter(Boolean);
  const sourceSnapshotEntries = outerListing.filter((entry) => /\/20_Canonical_Source\/[^/]+\.zip$/.test(entry));
  assert(sourceSnapshotEntries.length === 1, `Sealed package contains ${sourceSnapshotEntries.length} canonical source snapshots; exactly one is required.`);
  assert(!outerListing.some((entry) => /\/20_Canonical_Source\/[^/]+\/$/.test(entry) && !entry.endsWith("20_Canonical_Source/")), "Sealed package contains a loose source directory.");

  const sealedHash = hashFile(stagedZip);
  atomicCopy(stagedZip, packageZip);
  atomicWrite(packageSidecar, `${sealedHash.sha256}  ${path.basename(packageZip)}\n`);
  const sealResult = {
    package: path.basename(packageZip),
    status: consolidatedManifest.status,
    final: consolidatedManifest.status === "complete" && !options.allowIncomplete,
    evidenceClass: "synthetic_demo",
    bytes: sealedHash.bytes,
    sha256: sealedHash.sha256,
    criteriaPassed: consolidatedManifest.criteriaPassed,
    criteriaExpected: 24,
    integratedQa: consolidatedManifest.integratedQa?.status,
    canonicalSourceSnapshot: {
      file: path.basename(snapshotZip),
      bytes: snapshotHash.bytes,
      sha256: snapshotHash.sha256,
      restoredFiles: filteredFiles.length,
    },
    packageFiles: stagedPackageMap.size,
    milestoneEvidenceSubfolders: MILESTONE_DIRECTORIES,
    nonredundancyVerified: true,
  };
  atomicWrite(sealResultPath, `${JSON.stringify(sealResult, null, 2)}\n`);
  console.log(JSON.stringify({ output: options.output, ...sealResult }, null, 2));
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}
