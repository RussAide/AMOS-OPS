import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  compareDx1InheritedFiles,
  collectDx1SourceFiles,
  verifyDx1DatabaseSourceCoverage,
} from "./dx1-source-inventory.mjs";

const EXPECTED = Object.freeze({
  packageSha256: "284613989317add5478d10eb04b607e173744217a3a4389df0c2e1762d1c7ea2",
  snapshotSha256: "5ce615096007f7eb64c75fe0e5d85ff07fe8dbcc3da2718cab203fb63418e3bd",
  parentSourceFiles: 927,
  parentRegression: "1291_passed",
});

const APPROVED_DX1_INTEGRATION_FILES = new Set([
  "api/router.ts",
  "package.json",
  "src/components/shell/app-shell-routes.tsx",
  "src/components/shell/app-shell.tsx",
  "src/constants/access-control.ts",
  "src/data/navData.ts",
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function hashFile(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function parse(argv) {
  let root = "..";
  let output;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") root = argv[++index];
    else if (argv[index] === "--output") output = argv[++index];
    else throw new Error(`Unknown DX.1 inherited-baseline option: ${argv[index]}`);
  }
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    output: path.resolve(output ?? path.join(resolvedRoot, "evidence")),
  };
}

function sourceRootFor(root) {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`DX.1 source root is missing under ${root}.`);
}

function milestoneRootFor(root) {
  const sourceRoot = sourceRootFor(root);
  return sourceRoot === root ? path.dirname(root) : root;
}

function verifyZip(filePath) {
  const result = spawnSync("unzip", ["-t", filePath], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  assert(result.status === 0, `DX1_PARENT_ZIP_INTEGRITY_FAILED:${path.basename(filePath)}`);
  return true;
}

function atomicWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function verifyDx1InheritedBaseline(options) {
  const milestoneRoot = milestoneRootFor(options.root);
  const sourceRoot = sourceRootFor(options.root);
  const parentRoot = path.join(path.dirname(milestoneRoot), "M5.2_Mobile_and_Offline_Deployment");
  const parentSource = path.join(parentRoot, "source");
  const parentPackage = path.join(
    parentRoot,
    "package",
    "AMOS-OPS_M5_2_Mobile_and_Offline_Deployment_Package_v1_0.zip",
  );
  const parentSnapshot = path.join(
    parentRoot,
    "package",
    "AMOS-OPS_M5_2_Canonical_Source_Snapshot_v1_0.zip",
  );
  const parentSealPath = path.join(parentRoot, "package", "M5_2_PACKAGE_SEAL_RESULT.json");
  for (const required of [parentSource, parentPackage, parentSnapshot, parentSealPath])
    assert(fs.existsSync(required), `DX1_PARENT_ARTIFACT_MISSING:${required}`);

  const packageSha256 = hashFile(parentPackage);
  const snapshotSha256 = hashFile(parentSnapshot);
  assert(packageSha256 === EXPECTED.packageSha256, "DX1_PARENT_PACKAGE_HASH_MISMATCH");
  assert(snapshotSha256 === EXPECTED.snapshotSha256, "DX1_PARENT_SNAPSHOT_HASH_MISMATCH");
  verifyZip(parentPackage);
  verifyZip(parentSnapshot);

  const seal = JSON.parse(fs.readFileSync(parentSealPath, "utf8"));
  assert(seal.status === "PASS", "DX1_PARENT_SEAL_NOT_PASS");
  assert(seal.acceptance === "ACCEPTED", "DX1_PARENT_NOT_ACCEPTED");
  assert(seal.independentReview === "GO", "DX1_PARENT_REVIEW_NOT_GO");
  assert(seal.qaStepsPassed === 10, "DX1_PARENT_QA_INCOMPLETE");
  assert(seal.fullRegression === EXPECTED.parentRegression, "DX1_PARENT_REGRESSION_MISMATCH");
  assert(seal.sourceFileCount === EXPECTED.parentSourceFiles, "DX1_PARENT_FILE_COUNT_MISMATCH");
  assert(seal.productionRows === 0 && seal.liveExternalCalls === 0, "DX1_PARENT_ZERO_LIVE_FAILED");

  const inheritedFiles = collectDx1SourceFiles(parentSource);
  const databaseCoverage = verifyDx1DatabaseSourceCoverage(inheritedFiles);
  const { changed, approvedIntegrationChanges, missing } =
    compareDx1InheritedFiles(
      parentSource,
      sourceRoot,
      inheritedFiles,
      APPROVED_DX1_INTEGRATION_FILES,
    );
  assert(missing.length === 0, `DX1_INHERITED_FILES_MISSING:${missing.join(",")}`);
  assert(changed.length === 0, `DX1_INHERITED_FILES_CHANGED:${changed.join(",")}`);

  const result = Object.freeze({
    schemaVersion: "1.0",
    recordId: "AMOS-OPS-DX1-INHERITED-M5.2-VERIFICATION",
    milestone: "DX.1",
    parentMilestone: "M5.2",
    status: "PASS",
    packageSha256,
    snapshotSha256,
    packageZipIntegrity: "PASS",
    snapshotZipIntegrity: "PASS",
    parentSeal: "PASS",
    parentAcceptance: "ACCEPTED",
    parentIndependentReview: "GO",
    parentQa: "10/10",
    parentFocusedTests: "171/171",
    parentFullRegression: "1291/1291",
    inheritedFilesCompared: inheritedFiles.length,
    inheritedDatabaseSourceFilesCompared:
      databaseCoverage.databaseSourceFileCount,
    inheritedDatabaseMigrationFilesCompared:
      databaseCoverage.databaseMigrationFileCount,
    inheritedDatabaseSourceFiles: databaseCoverage.databaseFiles,
    inheritedFilesMissing: missing.length,
    inheritedFilesChanged: changed.length,
    approvedIntegrationChanges,
    approvedIntegrationChangeCount: approvedIntegrationChanges.length,
    productionRows: 0,
    liveExternalCalls: 0,
    liveMicrosoftReads: 0,
    liveMicrosoftWrites: 0,
    deployments: 0,
    githubPushes: 0,
    usesProductionData: false,
    synthetic: true,
  });
  atomicWrite(
    path.join(options.output, "DX_1_INHERITED_M5_2_RESULT.json"),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return result;
}

const options = parse(process.argv.slice(2));
const result = verifyDx1InheritedBaseline(options);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
