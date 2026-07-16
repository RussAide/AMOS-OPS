import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { M51B_REQUIRED_QA_STEPS } from "./m51b-run-qa.mjs";

const PACKAGE_NAME =
  "AMOS-OPS_M5_1B_Microsoft_365_Integration_Package_v1_0";
const SOURCE_SNAPSHOT_NAME =
  "AMOS-OPS_M5_1B_Canonical_Source_Snapshot_v1_0.zip";
const REQUIRED_CLOSURE_CONTROLS = Object.freeze([
  "M5_1B_ACCEPTANCE_RECORD.md",
  "M5_1B_IMPLEMENTATION_REGISTER.md",
  "M5_1B_INDEPENDENT_REVIEW.md",
  "M5_1B_INTEGRATED_QA_RECORD.md",
  "M5_1B_RELEASE_READINESS.md",
  "M5_1B_TRACEABILITY_MATRIX.csv",
]);
const REQUIRED_EVIDENCE = Object.freeze([
  "M5_1B_ACCEPTANCE_MANIFEST.json",
  "M5_1B_ACCEPTANCE_SUMMARY.md",
  "M5_1B_INTEGRATED_QA.json",
  "M5_1B_SCHEMA_INTEGRITY.json",
  "M5_1B_SHA256SUMS.txt",
  "M5_1B_INHERITED_M5_1A_RESULT.json",
  "M5_1B_INTEGRATION_GOVERNANCE_RESULT.json",
  "M5_1B_TEAMS_NOTIFICATION_RESULT.json",
  "M5_1B_OUTLOOK_REFERRAL_INTAKE_RESULT.json",
  "M5_1B_SHAREPOINT_SYNC_RESULT.json",
  "M5_1B_IDENTITY_ACCESS_SECRET_RESULT.json",
  "M5_1B_RELIABILITY_RECOVERY_RESULT.json",
  "M5_1B_INTEGRATED_SCENARIO_RESULT.json",
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
const FIXED_TIME = new Date("2000-01-01T00:00:00.000Z");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parse(argv) {
  let root = "..";
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
    else throw new Error(`Unknown M5.1B seal option: ${argv[index]}`);
  }
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    output: path.resolve(output ?? path.join(resolvedRoot, "package")),
  };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M5.1B source root is missing under ${root}.`);
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

function excluded(relativePath) {
  const segments = normalize(relativePath).split("/");
  if (segments.some((segment) => EXCLUDED_DIRECTORIES.has(segment)))
    return true;
  const fileName = segments[segments.length - 1] ?? "";
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

function walk(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      const relative = normalize(path.relative(root, absolute));
      if (excluded(relative)) continue;
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(relative);
      else throw new Error(`Unsupported source entry: ${absolute}`);
    }
  };
  visit(root);
  return files;
}

function hashFile(filePath) {
  const contents = fs.readFileSync(filePath);
  return {
    bytes: contents.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
  };
}

function aggregateHash(records) {
  return createHash("sha256")
    .update(
      records
        .map((record) => `${record.sha256}  ${record.path}\n`)
        .join(""),
    )
    .digest("hex");
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
      fs.utimesSync(absolute, FIXED_TIME, FIXED_TIME);
    }
  };
  visit(root);
  fs.utimesSync(root, FIXED_TIME, FIXED_TIME);
}

function zipDirectory(archive, cwd, files) {
  assert(files.length > 0, `Refusing to create empty ZIP: ${archive}`);
  run("zip", ["-q", "-X", archive, "-@"], {
    cwd,
    input: `${[...files].sort().join("\n")}\n`,
  });
  run("unzip", ["-tq", archive]);
}

function copyTree(source, destination) {
  fs.cpSync(source, destination, { recursive: true, preserveTimestamps: true });
}

function verifyClosure(controlsRoot) {
  for (const name of REQUIRED_CLOSURE_CONTROLS)
    assert(
      fs.existsSync(path.join(controlsRoot, name)),
      `M5.1B closure control is missing: ${name}`,
    );
  const review = fs.readFileSync(
    path.join(controlsRoot, "M5_1B_INDEPENDENT_REVIEW.md"),
    "utf8",
  );
  const acceptance = fs.readFileSync(
    path.join(controlsRoot, "M5_1B_ACCEPTANCE_RECORD.md"),
    "utf8",
  );
  const readiness = fs.readFileSync(
    path.join(controlsRoot, "M5_1B_RELEASE_READINESS.md"),
    "utf8",
  );
  assert(/\*\*Disposition:\*\*\s+GO\b/i.test(review), "Independent review is not GO.");
  assert(/\*\*Disposition:\*\*\s+ACCEPTED\b/i.test(acceptance), "Acceptance record is not ACCEPTED.");
  assert(/\*\*Readiness:\*\*\s+READY\b/i.test(readiness), "Release readiness is not READY.");
}

function verifyQa(evidenceRoot) {
  const report = JSON.parse(
    fs.readFileSync(path.join(evidenceRoot, "M5_1B_INTEGRATED_QA.json"), "utf8"),
  );
  assert(
    report.reportId === "M51B-INTEGRATED-QA" &&
      report.milestone === "M5.1B" &&
      report.passed === true &&
      JSON.stringify(report.requiredSteps) ===
        JSON.stringify(M51B_REQUIRED_QA_STEPS) &&
      report.steps.length === 10 &&
      report.steps.every((step) => step.exitCode === 0) &&
      report.productionRows === 0 &&
      report.liveMicrosoftWrites === 0,
    "M5.1B integrated QA report is incomplete or failed.",
  );
  return report;
}

export function sealM51BPackage(options) {
  const milestoneRoot = milestoneRootFor(options.root);
  const sourceRoot = sourceRootFor(options.root);
  const controlsRoot = path.join(milestoneRoot, "controls");
  const evidenceRoot = path.join(milestoneRoot, "evidence");
  assert(
    !isWithin(sourceRoot, options.output),
    "M5.1B package output cannot be inside the source tree.",
  );
  verifyClosure(controlsRoot);
  const qa = verifyQa(evidenceRoot);
  for (const name of REQUIRED_EVIDENCE)
    assert(
      fs.existsSync(path.join(evidenceRoot, name)),
      `M5.1B evidence is missing: ${name}`,
    );
  run(process.execPath, [
    "--import",
    "tsx",
    path.join(sourceRoot, "scripts", "m51b-verify-evidence.ts"),
    "--root",
    milestoneRoot,
    "--output",
    evidenceRoot,
  ], { cwd: sourceRoot });
  const acceptanceEvidence = JSON.parse(
    fs.readFileSync(
      path.join(evidenceRoot, "M5_1B_ACCEPTANCE_MANIFEST.json"),
      "utf8",
    ),
  );
  const acceptanceFlags = acceptanceEvidence.acceptanceCriteria;
  assert(
    Array.isArray(acceptanceFlags) &&
      acceptanceFlags.length === 8 &&
      acceptanceFlags.every((flag) => flag.passed === true),
    "M5.1B acceptance manifest does not contain eight passing criteria.",
  );
  const assertionCount = acceptanceFlags.reduce(
    (total, flag) => total + flag.assertionCount,
    0,
  );
  assert(
    Number.isInteger(assertionCount) &&
      assertionCount > 0 &&
      acceptanceEvidence.totals?.assertionCount === assertionCount,
    "M5.1B assertion total is not derived from the criterion catalog.",
  );

  fs.mkdirSync(options.output, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(
    path.join(os.tmpdir(), "amos-m51b-seal-"),
  );
  try {
    const sourceStage = path.join(temporaryRoot, "source");
    fs.mkdirSync(sourceStage, { recursive: true });
    const sourceFiles = walk(sourceRoot);
    for (const relative of sourceFiles) {
      const destination = path.join(sourceStage, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, relative), destination);
    }
    normalizeTimes(sourceStage);
    const snapshotPath = path.join(options.output, SOURCE_SNAPSHOT_NAME);
    if (fs.existsSync(snapshotPath)) fs.unlinkSync(snapshotPath);
    zipDirectory(snapshotPath, sourceStage, sourceFiles);
    const archivedFiles = run("unzip", ["-Z1", snapshotPath])
      .trim()
      .split(/\r?\n/)
      .filter(Boolean)
      .sort();
    assert(
      JSON.stringify(archivedFiles) === JSON.stringify([...sourceFiles].sort()),
      "M5.1B source snapshot inventory drifted.",
    );

    const sourceRecords = sourceFiles.map((relative) => ({
      path: relative,
      ...hashFile(path.join(sourceRoot, relative)),
    }));
    const packageStage = path.join(temporaryRoot, PACKAGE_NAME);
    fs.mkdirSync(packageStage, { recursive: true });
    copyTree(controlsRoot, path.join(packageStage, "controls"));
    copyTree(evidenceRoot, path.join(packageStage, "evidence"));
    fs.copyFileSync(snapshotPath, path.join(packageStage, SOURCE_SNAPSHOT_NAME));
    const manifest = {
      schemaVersion: "1.0",
      packageId: "AMOS-OPS-M5.1B-PACKAGE-V1.0",
      milestone: "M5.1B",
      disposition: "ACCEPTED",
      evidenceClass: "synthetic_microsoft_365_workflow_integration_demo",
      sourceSnapshot: SOURCE_SNAPSHOT_NAME,
      sourceFileCount: sourceRecords.length,
      sourceAggregateSha256: aggregateHash(sourceRecords),
      sourceSnapshotSha256: hashFile(snapshotPath).sha256,
      qaStepsPassed: qa.steps.length,
      acceptanceCriteriaPassed: acceptanceFlags.length,
      assertionCount,
      productionRows: 0,
      liveGraphCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      realNotificationsSent: 0,
      liveWrites: 0,
      productionDeployment: false,
      githubPush: false,
      synthetic: true,
    };
    fs.writeFileSync(
      path.join(packageStage, "M5_1B_PACKAGE_MANIFEST.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    normalizeTimes(packageStage);
    const packageArchive = path.join(options.output, `${PACKAGE_NAME}.zip`);
    if (fs.existsSync(packageArchive)) fs.unlinkSync(packageArchive);
    const packageFiles = [];
    const visit = (directory) => {
      for (const entry of fs
        .readdirSync(directory, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))) {
        const absolute = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(absolute);
        else packageFiles.push(normalize(path.relative(temporaryRoot, absolute)));
      }
    };
    visit(packageStage);
    zipDirectory(packageArchive, temporaryRoot, packageFiles);
    const packageHash = hashFile(packageArchive);
    fs.writeFileSync(
      path.join(options.output, "M5_1B_PACKAGE_SHA256.txt"),
      `${packageHash.sha256}  ${path.basename(packageArchive)}\n`,
    );
    return Object.freeze({
      ...manifest,
      packageArchive,
      packageBytes: packageHash.bytes,
      packageSha256: packageHash.sha256,
    });
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

const invoked = process.argv[1];
if (invoked && pathToFileURL(path.resolve(invoked)).href === import.meta.url) {
  try {
    process.stdout.write(
      `${JSON.stringify(sealM51BPackage(parse(process.argv.slice(2))), null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `M5.1B package sealing failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
