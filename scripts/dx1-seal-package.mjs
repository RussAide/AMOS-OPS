import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  collectDx1SourceFiles,
  verifyDx1DatabaseSourceCoverage,
} from "./dx1-source-inventory.mjs";

const PACKAGE_DIRECTORY =
  "AMOS-OPS_DX_1_Final_Cross_Enterprise_Demo_Verification_Package_v1_0";
const PACKAGE_ARCHIVE = `${PACKAGE_DIRECTORY}.zip`;
const SOURCE_SNAPSHOT = "AMOS-OPS_DX_1_Canonical_Source_Snapshot_v1_0.zip";
const PACKAGE_MANIFEST = "DX_1_PACKAGE_MANIFEST.json";
const PACKAGE_SEAL_RESULT = "DX_1_PACKAGE_SEAL_RESULT.json";
const PACKAGE_SHA256 = "DX_1_PACKAGE_SHA256.txt";
const FIXED_TIME = new Date("2000-01-01T00:00:00.000Z");

const EXPECTED_QA_STEPS = Object.freeze([
  "inherited_m52_seal",
  "inherited_m52_regression",
  "focused_dx1_tests",
  "typecheck",
  "strict_lint",
  "full_regression",
  "client_build",
  "server_build",
  "evidence_export",
  "evidence_verification",
]);

const EXPECTED_CRITERION_IDS = Object.freeze([
  "DX.1-01",
  "DX.1-02",
  "DX.1-03",
  "DX.1-04",
  "DX.1-05",
  "DX.1-06",
  "DX.1-07",
  "DX.1-08",
  "DX.1-09",
  "DX.1-10",
  "DX.1-11",
  "DX.1-12",
]);

const CRITERION_EVIDENCE = Object.freeze([
  "DX_1_01_WORKSPACE_NAVIGATION_RESULT.json",
  "DX_1_02_WORKFLOW_GOVERNANCE_RESULT.json",
  "DX_1_03_DMS_LIFECYCLE_RESULT.json",
  "DX_1_04_AGENT_ASSISTANCE_RESULT.json",
  "DX_1_05_NIL_RELATIONSHIP_RESULT.json",
  "DX_1_06_ENTERPRISE_DASHBOARD_RESULT.json",
  "DX_1_07_MICROSOFT_BOUNDARY_RESULT.json",
  "DX_1_08_PERMISSION_SECURITY_RESULT.json",
  "DX_1_09_FRONTLINE_USABILITY_RESULT.json",
  "DX_1_10_END_TO_END_PILOT_RESULT.json",
  "DX_1_11_GUIDANCE_SUPPORT_RESULT.json",
  "DX_1_12_CHANGE_CONTROL_RESULT.json",
]);

const REQUIRED_EVIDENCE = Object.freeze([
  ...CRITERION_EVIDENCE,
  "DX_1_ACCEPTANCE_MANIFEST.json",
  "DX_1_ACCEPTANCE_SUMMARY.md",
  "DX_1_CORRELATED_AUDIT_HISTORY.json",
  "DX_1_EIGHT_STAGE_PILOT_TRACE.json",
  "DX_1_EVIDENCE_VERIFICATION.json",
  "DX_1_INHERITED_M5_2_RESULT.json",
  "DX_1_INTEGRATED_QA.json",
  "DX_1_INTEGRATED_SCENARIO_RESULT.json",
  "DX_1_SHA256SUMS.txt",
]);

const REQUIRED_CLOSURE_CONTROLS = Object.freeze([
  "DX_1_ACCEPTANCE_MATRIX.csv",
  "DX_1_ACCEPTANCE_RECORD.md",
  "DX_1_INDEPENDENT_REVIEW.md",
  "DX_1_RELEASE_READINESS.md",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parse(argv) {
  let root = "..";
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
    else throw new Error(`Unknown DX.1 seal option: ${argv[index]}`);
  }
  const resolvedRoot = path.resolve(root);
  return Object.freeze({
    root: resolvedRoot,
    output: path.resolve(output ?? path.join(resolvedRoot, "package")),
  });
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`DX.1 source root is missing under ${root}.`);
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

function walkPackage(root, relativeTo) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) files.push(normalize(path.relative(relativeTo, absolute)));
      else throw new Error(`Unsupported DX.1 package entry: ${absolute}`);
    }
  };
  visit(root);
  return Object.freeze(files);
}

function hashFile(filePath) {
  const contents = fs.readFileSync(filePath);
  return Object.freeze({
    bytes: contents.length,
    sha256: createHash("sha256").update(contents).digest("hex"),
  });
}

function aggregateHash(records) {
  return createHash("sha256")
    .update(records.map((record) => `${record.sha256}  ${record.path}\n`).join(""))
    .digest("hex");
}

function readJson(filePath) {
  const value = JSON.parse(fs.readFileSync(filePath, "utf8"));
  assert(value && typeof value === "object" && !Array.isArray(value), `Invalid JSON: ${filePath}`);
  return value;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
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
  assert(files.length > 0, `Refusing to create empty DX.1 ZIP: ${archive}`);
  run("zip", ["-q", "-X", archive, "-@"], {
    cwd,
    input: `${[...files].sort().join("\n")}\n`,
  });
  run("unzip", ["-tq", archive]);
}

function zipInventory(archive) {
  const output = run("unzip", ["-Z1", archive]).trim();
  return Object.freeze((output ? output.split(/\r?\n/) : []).filter(Boolean).sort());
}

function copyTree(source, destination) {
  assert(fs.existsSync(source), `DX.1 package source is missing: ${source}`);
  const visit = (from, to) => {
    fs.mkdirSync(to, { recursive: true });
    for (const entry of fs
      .readdirSync(from, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const sourceEntry = path.join(from, entry.name);
      const destinationEntry = path.join(to, entry.name);
      if (entry.isDirectory()) visit(sourceEntry, destinationEntry);
      else if (entry.isFile()) fs.copyFileSync(sourceEntry, destinationEntry);
      else throw new Error(`Unsupported DX.1 package source entry: ${sourceEntry}`);
    }
  };
  visit(source, destination);
}

function publishFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.partial-${process.pid}`;
  fs.copyFileSync(source, temporary);
  fs.renameSync(temporary, destination);
}

function atomicWrite(filePath, contents) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, contents);
  fs.renameSync(temporary, filePath);
}

function verifyClosure(controlsRoot) {
  for (const name of REQUIRED_CLOSURE_CONTROLS)
    assert(fs.existsSync(path.join(controlsRoot, name)), `DX.1 closure control missing: ${name}`);
  const matrix = fs.readFileSync(path.join(controlsRoot, "DX_1_ACCEPTANCE_MATRIX.csv"), "utf8");
  const acceptance = fs.readFileSync(path.join(controlsRoot, "DX_1_ACCEPTANCE_RECORD.md"), "utf8");
  const review = fs.readFileSync(path.join(controlsRoot, "DX_1_INDEPENDENT_REVIEW.md"), "utf8");
  const readiness = fs.readFileSync(path.join(controlsRoot, "DX_1_RELEASE_READINESS.md"), "utf8");
  assert((matrix.match(/,Complete,/g) ?? []).length === 12, "DX.1 matrix is not 12/12 Complete.");
  assert(/\*\*Disposition:\*\*\s+ACCEPTED\b/i.test(acceptance), "DX.1 acceptance is not ACCEPTED.");
  assert(/\*\*Disposition:\*\*\s+GO\b/i.test(review), "DX.1 independent review is not GO.");
  assert(/\*\*Readiness:\*\*\s+READY\b/i.test(readiness), "DX.1 readiness is not READY.");
}

function parsePassedTests(logPath) {
  const contents = fs.readFileSync(logPath, "utf8");
  const match = /Tests\s+(\d+) passed/.exec(contents);
  assert(match, `Unable to determine passing test count from ${logPath}.`);
  return Number(match[1]);
}

function verifyQa(evidenceRoot) {
  const report = readJson(path.join(evidenceRoot, "DX_1_INTEGRATED_QA.json"));
  assert(
    report.reportId === "DX1-INTEGRATED-QA" &&
      report.milestone === "DX.1" &&
      report.status === "PASS" &&
      Array.isArray(report.requiredSteps) &&
      JSON.stringify(report.requiredSteps) === JSON.stringify(EXPECTED_QA_STEPS) &&
      Array.isArray(report.steps) &&
      report.steps.length === 10 &&
      report.steps.every((step) => step.exitCode === 0) &&
      report.stepsPassed === 10 &&
      report.productionRows === 0 &&
      report.liveExternalCalls === 0 &&
      report.liveMicrosoftReads === 0 &&
      report.liveMicrosoftWrites === 0 &&
      report.liveClinicalScoringActivations === 0 &&
      report.liveLevelOfCareDecisions === 0 &&
      report.deployments === 0 &&
      report.githubPushes === 0 &&
      report.usesProductionData === false,
    "DX.1 integrated QA is not an exact passing 10/10 zero-live report.",
  );
  return Object.freeze({
    report,
    focusedTests: parsePassedTests(
      path.join(evidenceRoot, "Verification_Logs", "focused_dx1_tests.log"),
    ),
    fullRegression: parsePassedTests(
      path.join(evidenceRoot, "Verification_Logs", "full_regression.log"),
    ),
  });
}

function verifyAcceptance(evidenceRoot) {
  const manifest = readJson(path.join(evidenceRoot, "DX_1_ACCEPTANCE_MANIFEST.json"));
  const integrated = readJson(path.join(evidenceRoot, "DX_1_INTEGRATED_SCENARIO_RESULT.json"));
  const verification = readJson(path.join(evidenceRoot, "DX_1_EVIDENCE_VERIFICATION.json"));
  const criteria = integrated.criteria;
  const boundary = integrated.boundary;
  assert(
    manifest.manifestId === "AMOS-OPS-DX1-ACCEPTANCE-MANIFEST-V1.0" &&
      manifest.milestone === "DX.1" &&
      manifest.acceptance === "ACCEPTED" &&
      manifest.accepted === true &&
      manifest.criteriaComplete === 12 &&
      manifest.criteriaExpected === 12 &&
      manifest.assertionCount === 96 &&
      manifest.auditEventCount === 60 &&
      manifest.pilotStagesComplete === 8 &&
      Array.isArray(criteria) &&
      criteria.length === 12 &&
      JSON.stringify(criteria.map((item) => item.criterionId).sort()) ===
        JSON.stringify([...EXPECTED_CRITERION_IDS].sort()) &&
      criteria.every((item) => item.status === "Complete"),
    "DX.1 acceptance manifest or integrated result is incomplete.",
  );
  assert(
    boundary &&
      boundary.synthetic === true &&
      boundary.demoMode === true &&
      Object.entries(boundary).every(
        ([key, value]) => key === "synthetic" || key === "demoMode" || value === 0,
      ),
    "DX.1 acceptance boundary contains live activity.",
  );
  assert(
    verification.status === "PASS" &&
      verification.criteriaVerified === 12 &&
      verification.assertionCount === 96 &&
      verification.auditEventsVerified === 60 &&
      verification.pilotStagesVerified === 8 &&
      verification.zeroLiveBoundaryVerified === true,
    "DX.1 evidence verification is not PASS.",
  );
  return Object.freeze({ manifest, integrated, verification });
}

function verifyEvidence(sourceRoot, milestoneRoot, evidenceRoot) {
  const output = run(
    process.execPath,
    [
      "--import",
      "tsx",
      path.join(sourceRoot, "scripts", "dx1-verify-evidence.ts"),
      "--root",
      milestoneRoot,
      "--output",
      evidenceRoot,
    ],
    { cwd: sourceRoot },
  );
  const result = JSON.parse(output);
  assert(result.status === "PASS" && result.criteriaVerified === 12, "DX.1 verifier did not pass.");
  return result;
}

export function sealDx1Package(options) {
  const milestoneRoot = milestoneRootFor(options.root);
  const sourceRoot = sourceRootFor(options.root);
  const controlsRoot = path.join(milestoneRoot, "controls");
  const evidenceRoot = path.join(milestoneRoot, "evidence");
  assert(!isWithin(sourceRoot, options.output), "DX.1 package output cannot be inside source.");
  verifyClosure(controlsRoot);
  const qa = verifyQa(evidenceRoot);
  for (const name of REQUIRED_EVIDENCE)
    assert(fs.existsSync(path.join(evidenceRoot, name)), `DX.1 evidence missing: ${name}`);
  verifyEvidence(sourceRoot, milestoneRoot, evidenceRoot);
  const acceptance = verifyAcceptance(evidenceRoot);

  fs.mkdirSync(options.output, { recursive: true });
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "amos-dx1-seal-"));
  try {
    const sourceStage = path.join(temporaryRoot, "source");
    fs.mkdirSync(sourceStage, { recursive: true });
    const sourceFiles = collectDx1SourceFiles(sourceRoot);
    const databaseCoverage = verifyDx1DatabaseSourceCoverage(sourceFiles);
    for (const relative of sourceFiles) {
      const destination = path.join(sourceStage, relative);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(sourceRoot, relative), destination);
    }
    normalizeTimes(sourceStage);
    const temporarySnapshot = path.join(temporaryRoot, SOURCE_SNAPSHOT);
    zipDirectory(temporarySnapshot, sourceStage, sourceFiles);
    assert(
      JSON.stringify(zipInventory(temporarySnapshot)) === JSON.stringify([...sourceFiles].sort()),
      "DX.1 source snapshot inventory drifted.",
    );
    const sourceRecords = sourceFiles.map((relative) => ({
      path: relative,
      ...hashFile(path.join(sourceRoot, relative)),
    }));
    const sourceSnapshotHash = hashFile(temporarySnapshot);

    const packageStage = path.join(temporaryRoot, PACKAGE_DIRECTORY);
    fs.mkdirSync(packageStage, { recursive: true });
    copyTree(controlsRoot, path.join(packageStage, "controls"));
    copyTree(evidenceRoot, path.join(packageStage, "evidence"));
    fs.copyFileSync(temporarySnapshot, path.join(packageStage, SOURCE_SNAPSHOT));
    const packageManifest = Object.freeze({
      schemaVersion: "1.0",
      manifestId: "AMOS-OPS-DX1-PACKAGE-MANIFEST-V1.0",
      packageId: "AMOS-OPS-DX1-FINAL-CROSS-ENTERPRISE-DEMO-PACKAGE-V1.0",
      milestone: "DX.1",
      disposition: "ACCEPTED",
      readiness: "READY",
      evidenceClass: "SYNTHETIC_PROTOTYPE",
      packageArchive: PACKAGE_ARCHIVE,
      sourceSnapshot: SOURCE_SNAPSHOT,
      sourceFileCount: sourceRecords.length,
      databaseSourceFileCount: databaseCoverage.databaseSourceFileCount,
      databaseMigrationFileCount: databaseCoverage.databaseMigrationFileCount,
      databaseSourceFiles: databaseCoverage.databaseFiles,
      sourceAggregateSha256: aggregateHash(sourceRecords),
      sourceSnapshotBytes: sourceSnapshotHash.bytes,
      sourceSnapshotSha256: sourceSnapshotHash.sha256,
      qaStepsRequired: 10,
      qaStepsPassed: qa.report.stepsPassed,
      focusedTestsPassed: qa.focusedTests,
      fullRegressionTestsPassed: qa.fullRegression,
      acceptanceCriteriaRequired: 12,
      acceptanceCriteriaPassed: 12,
      assertionCount: 96,
      auditEventCount: 60,
      pilotStagesPassed: 8,
      evidenceVerified: true,
      parentM52PackageVerified: true,
      productionRows: 0,
      liveExternalCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      liveClinicalScoringActivations: 0,
      liveLevelOfCareDecisions: 0,
      realNotificationsSent: 0,
      deployments: 0,
      githubPushes: 0,
      usesProductionData: false,
      productionDeployment: false,
      githubPush: false,
      zipIntegrityVerified: true,
      synthetic: true,
    });
    fs.writeFileSync(
      path.join(packageStage, PACKAGE_MANIFEST),
      `${JSON.stringify(packageManifest, null, 2)}\n`,
    );
    normalizeTimes(packageStage);

    const packageFiles = walkPackage(packageStage, temporaryRoot);
    const temporaryPackage = path.join(temporaryRoot, PACKAGE_ARCHIVE);
    zipDirectory(temporaryPackage, temporaryRoot, packageFiles);
    assert(
      JSON.stringify(zipInventory(temporaryPackage)) === JSON.stringify([...packageFiles].sort()),
      "DX.1 sealed package inventory drifted.",
    );
    const packageHash = hashFile(temporaryPackage);
    publishFile(temporarySnapshot, path.join(options.output, SOURCE_SNAPSHOT));
    publishFile(temporaryPackage, path.join(options.output, PACKAGE_ARCHIVE));

    const sealResult = Object.freeze({
      schemaVersion: "1.0",
      sealId: "AMOS-OPS-DX1-PACKAGE-SEAL-V1.0",
      status: "PASS",
      sealedAt: qa.report.completedAt,
      package: PACKAGE_ARCHIVE,
      final: true,
      milestone: "DX.1",
      sealed: true,
      disposition: "ACCEPTED",
      readiness: "READY",
      packageArchive: PACKAGE_ARCHIVE,
      packageBytes: packageHash.bytes,
      packageSha256: packageHash.sha256,
      bytes: packageHash.bytes,
      sha256: packageHash.sha256,
      sourceSnapshot: SOURCE_SNAPSHOT,
      sourceSnapshotBytes: sourceSnapshotHash.bytes,
      sourceSnapshotSha256: sourceSnapshotHash.sha256,
      sourceFileCount: sourceRecords.length,
      databaseSourceFileCount: databaseCoverage.databaseSourceFileCount,
      databaseMigrationFileCount: databaseCoverage.databaseMigrationFileCount,
      databaseSourceFiles: databaseCoverage.databaseFiles,
      sourceAggregateSha256: packageManifest.sourceAggregateSha256,
      packageManifest: PACKAGE_MANIFEST,
      qaStepsPassed: 10,
      acceptanceCriteriaPassed: 12,
      criteriaPassed: 12,
      criteriaExpected: 12,
      assertionCount: 96,
      auditEventCount: 60,
      pilotStagesPassed: 8,
      evidenceVerified: true,
      zipIntegrityVerified: true,
      integratedQa: "passed_10_of_10",
      focusedTests: `${qa.focusedTests}_passed`,
      fullRegression: `${qa.fullRegression}_passed`,
      inheritedM52: "verified_complete_parent_source_including_database_and_accepted_seal",
      independentReview: "GO",
      acceptance: "ACCEPTED",
      releaseReadiness: "READY",
      exitGate: true,
      productionRows: 0,
      liveExternalCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      liveClinicalScoringActivations: 0,
      liveLevelOfCareDecisions: 0,
      realNotificationsSent: 0,
      deployments: 0,
      githubPushes: 0,
      productionDeployment: false,
      githubPush: false,
      usesProductionData: false,
      canonicalSourceSnapshot: Object.freeze({
        file: SOURCE_SNAPSHOT,
        bytes: sourceSnapshotHash.bytes,
        sha256: sourceSnapshotHash.sha256,
        sourceFiles: sourceRecords.length,
        databaseSourceFiles: databaseCoverage.databaseSourceFileCount,
        databaseMigrationFiles: databaseCoverage.databaseMigrationFileCount,
        sourceAggregateSha256: packageManifest.sourceAggregateSha256,
      }),
      nonredundancyVerified: true,
      synthetic: true,
    });
    atomicWrite(
      path.join(options.output, PACKAGE_SEAL_RESULT),
      `${JSON.stringify(sealResult, null, 2)}\n`,
    );
    atomicWrite(
      path.join(options.output, PACKAGE_SHA256),
      `${packageHash.sha256}  ${PACKAGE_ARCHIVE}\n`,
    );
    return sealResult;
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

const invoked = process.argv[1];
if (invoked && pathToFileURL(path.resolve(invoked)).href === import.meta.url) {
  try {
    process.stdout.write(
      `${JSON.stringify(sealDx1Package(parse(process.argv.slice(2))), null, 2)}\n`,
    );
  } catch (error) {
    process.stderr.write(
      `DX.1 package sealing failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
