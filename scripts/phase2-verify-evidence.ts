import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const MILESTONES = [
  { id: "M2.2", directory: "M2.2_MHTCM_Case_Management_Live" },
  { id: "M2.3", directory: "M2.3_MHRS_Program_Module_Live" },
  { id: "M2.4", directory: "M2.4_GRO_Residential_Operations_Complete" },
] as const;

interface Options {
  root: string;
  output: string;
  allowIncomplete: boolean;
}

interface FileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

interface ManifestCriterion {
  criterion: string;
  milestone: string;
  status: "passed" | "pending_missing_evidence";
  evidencePaths: string[];
}

interface MilestoneRecord {
  id: string;
  directory: string;
  status: "complete" | "pending_missing_evidence";
  manifestPath: string | null;
  evidenceClass: string | null;
  acceptanceGate: boolean;
  files: FileRecord[];
  criteria: ManifestCriterion[];
}

interface AcceptanceManifest {
  schemaVersion: string;
  recordId: string;
  evidenceClass: string;
  status: "complete" | "development_incomplete";
  allowIncompleteUsed: boolean;
  criteriaExpected: number;
  criteriaPassed: number;
  integratedQa: { status: "passed" | "pending_missing_evidence"; files: FileRecord[] };
  milestones: MilestoneRecord[];
  criteria: ManifestCriterion[];
  inventory: FileRecord[];
  nonredundancy: {
    canonicalSourceTrees: number;
    milestoneEvidenceDirectories: string[];
    sharedQaExecutions: number;
  };
}

function parseOptions(argv: string[]): Options {
  let root: string | undefined;
  let output: string | undefined;
  let allowIncomplete = false;
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--allow-incomplete") allowIncomplete = true;
    else if (argument === "--root" || argument === "--output") {
      const value = argv[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`${argument} requires a path.`);
      if (argument === "--root") root = value;
      else output = value;
      index += 1;
    } else if (argument.startsWith("--")) throw new Error(`Unknown option: ${argument}`);
    else positional.push(argument);
  }
  root ??= positional[0] ?? "..";
  const resolvedRoot = path.resolve(root);
  output ??= positional[1] ?? path.join(resolvedRoot, "evidence", "shared");
  return { root: resolvedRoot, output: path.resolve(output), allowIncomplete };
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalize(value: string): string {
  return value.split(path.sep).join("/");
}

function isWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function hashFile(filePath: string): { bytes: number; sha256: string } {
  const contents = fs.readFileSync(filePath);
  return { bytes: contents.length, sha256: createHash("sha256").update(contents).digest("hex") };
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function inspectSyntheticBoundary(value: unknown, source: string): void {
  const visit = (candidate: unknown, pointer: string) => {
    if (Array.isArray(candidate)) {
      candidate.forEach((child, index) => visit(child, `${pointer}[${index}]`));
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/_/g, "");
      const childPointer = `${pointer}.${key}`;
      if (normalizedKey === "evidenceclass") assert(child === "synthetic_demo" || child === null, `${source} has non-synthetic evidence at ${childPointer}.`);
      if (normalizedKey === "productionrows") assert(child === 0, `${source} reports production rows at ${childPointer}.`);
      if (normalizedKey === "usesproductiondata" || normalizedKey === "productiondataused") assert(child === false, `${source} reports production-data use at ${childPointer}.`);
      if (normalizedKey === "datamode" && typeof child === "string") assert(/synthetic|demo/i.test(child), `${source} has a non-synthetic data mode at ${childPointer}.`);
      if (normalizedKey === "productionevidence") {
        const acceptable = child === false || child === null || (typeof child === "string" && /not supplied|none|synthetic/i.test(child));
        assert(acceptable, `${source} claims production evidence at ${childPointer}.`);
      }
      visit(child, childPointer);
    }
  };
  visit(value, "$");
}

function resolveRegisterPath(options: Options, registerPath: string): string {
  const absolute = registerPath.startsWith("@output/")
    ? path.resolve(options.output, registerPath.slice("@output/".length))
    : path.resolve(options.root, registerPath);
  const allowedRoot = registerPath.startsWith("@output/") ? options.output : options.root;
  assert(isWithin(allowedRoot, absolute), `Checksum path escapes its allowed root: ${registerPath}`);
  return absolute;
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const result: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push(normalize(path.relative(root, absolute)));
      else throw new Error(`Unsupported evidence filesystem entry: ${absolute}`);
    }
  };
  visit(root);
  return result;
}

function acceptanceMatrixCriterionIds(root: string): string[] {
  const matrixPath = path.join(root, "controls", "PHASE_2_ACCEPTANCE_MATRIX.csv");
  assert(fs.existsSync(matrixPath), "Controlling Phase 2 acceptance matrix is missing.");
  const lines = fs.readFileSync(matrixPath, "utf8").trim().split(/\r?\n/);
  assert(lines[0]?.startsWith("criterion,"), "Controlling acceptance matrix header drifted.");
  const ids = lines.slice(1).map((line) => line.slice(0, line.indexOf(",")));
  assert(ids.length === 24 && new Set(ids).size === 24, `Controlling acceptance matrix must have 24 unique criteria; found ${ids.length}.`);
  return ids;
}

function verifyCanonicalMilestone(options: Options, milestone: MilestoneRecord): void {
  const expected = MILESTONES.find((candidate) => candidate.id === milestone.id);
  assert(expected, `Unknown milestone in consolidated manifest: ${milestone.id}`);
  assert(milestone.directory === `evidence/${expected.directory}`, `${milestone.id} evidence directory drifted.`);
  if (milestone.status === "pending_missing_evidence") {
    assert(options.allowIncomplete, `${milestone.id} is incomplete without --allow-incomplete.`);
    assert(milestone.manifestPath === null && milestone.files.length === 0, `${milestone.id} pending state contains partial canonical evidence.`);
    return;
  }
  assert(milestone.evidenceClass === "synthetic_demo" && milestone.acceptanceGate, `${milestone.id} synthetic acceptance gate is not passing.`);
  assert(milestone.manifestPath, `${milestone.id} canonical manifest path is missing.`);
  const manifestAbsolute = resolveRegisterPath(options, milestone.manifestPath);
  const canonical = readJson(manifestAbsolute) as { milestone?: string; evidenceClass?: string; files?: Array<{ path?: string; sha256?: string; bytes?: number }> };
  inspectSyntheticBoundary(canonical, `${milestone.id} canonical manifest`);
  assert(canonical.milestone === milestone.id && canonical.evidenceClass === "synthetic_demo", `${milestone.id} canonical manifest boundary drifted.`);
  assert(Array.isArray(canonical.files) && canonical.files.length > 0, `${milestone.id} canonical manifest file inventory is empty.`);
  const milestoneDirectory = path.join(options.root, "evidence", expected.directory);
  const manifestRelative = normalize(path.relative(milestoneDirectory, manifestAbsolute));
  const declaredPaths = canonical.files.map((file) => {
    assert(typeof file.path === "string" && typeof file.sha256 === "string", `${milestone.id} canonical file entry is invalid.`);
    const absolute = path.resolve(milestoneDirectory, file.path);
    assert(isWithin(milestoneDirectory, absolute), `${milestone.id} canonical file path escapes its directory.`);
    assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `${milestone.id} canonical payload is missing: ${file.path}`);
    const actual = hashFile(absolute);
    assert(actual.sha256 === file.sha256, `${milestone.id} canonical payload hash mismatch: ${file.path}`);
    if (file.bytes !== undefined) assert(actual.bytes === file.bytes, `${milestone.id} canonical payload byte mismatch: ${file.path}`);
    if (file.path.endsWith(".json")) inspectSyntheticBoundary(readJson(absolute), `${milestone.id}/${file.path}`);
    return normalize(file.path);
  });
  assert(new Set(declaredPaths).size === declaredPaths.length, `${milestone.id} canonical manifest contains duplicate payloads.`);
  const actualPayload = walkFiles(milestoneDirectory).filter((relativePath) => relativePath !== manifestRelative).sort();
  assert(JSON.stringify([...declaredPaths].sort()) === JSON.stringify(actualPayload), `${milestone.id} contains unmanifested or missing evidence files.`);
  assert(declaredPaths.some((relativePath) => relativePath.endsWith(".md") && /acceptance|report|summary/i.test(path.basename(relativePath))), `${milestone.id} acceptance summary/report is missing.`);
  assert(declaredPaths.some((relativePath) => /\.json$|\.csv$/i.test(relativePath)), `${milestone.id} structured evidence is missing.`);
}

const options = parseOptions(process.argv.slice(2));
const manifestPath = path.join(options.output, "PHASE_2_ACCEPTANCE_MANIFEST.json");
const summaryPath = path.join(options.output, "PHASE_2_ACCEPTANCE_SUMMARY.md");
const checksumPath = path.join(options.output, "PHASE_2_SHA256SUMS.txt");
for (const required of [manifestPath, summaryPath, checksumPath]) assert(fs.existsSync(required), `Consolidated evidence file is missing: ${required}`);

const manifest = readJson(manifestPath) as AcceptanceManifest;
inspectSyntheticBoundary(manifest, "consolidated Phase 2 manifest");
assert(manifest.schemaVersion === "1.0", "Unsupported consolidated evidence schema version.");
assert(manifest.recordId === "AMOS-OPS-PHASE2-ACCEPTANCE-EVIDENCE", "Consolidated record identity drifted.");
assert(manifest.evidenceClass === "synthetic_demo", "Consolidated evidence is not synthetic-only.");
assert(manifest.criteriaExpected === 24 && manifest.criteria.length === 24, "Consolidated manifest must contain exactly 24 criteria.");
assert(new Set(manifest.criteria.map((criterion) => criterion.criterion)).size === 24, "Consolidated criteria are not unique.");
const matrixIds = acceptanceMatrixCriterionIds(options.root).sort();
assert(JSON.stringify(manifest.criteria.map((criterion) => criterion.criterion).sort()) === JSON.stringify(matrixIds), "Consolidated criteria do not match the controlling matrix.");
for (const milestone of MILESTONES) {
  const criteria = manifest.criteria.filter((criterion) => criterion.milestone === milestone.id);
  assert(criteria.length === 8, `${milestone.id} must contribute exactly eight criteria.`);
}

const passedCriteria = manifest.criteria.filter((criterion) => criterion.status === "passed");
assert(passedCriteria.length === manifest.criteriaPassed, "Consolidated criteriaPassed count drifted.");
for (const criterion of passedCriteria) {
  assert(criterion.evidencePaths.length > 0, `${criterion.criterion} has no evidence paths.`);
  for (const evidencePath of criterion.evidencePaths) {
    assert(manifest.inventory.some((file) => file.path === evidencePath), `${criterion.criterion} references evidence outside the checksum inventory: ${evidencePath}`);
  }
}
for (const criterion of manifest.criteria.filter((candidate) => candidate.status === "pending_missing_evidence")) {
  assert(options.allowIncomplete, `${criterion.criterion} remains pending without --allow-incomplete.`);
  assert(criterion.evidencePaths.length === 0, `${criterion.criterion} pending status contains partial evidence.`);
}

assert(manifest.milestones.length === 3, "Consolidated manifest must contain exactly three milestone records.");
for (const milestone of manifest.milestones) verifyCanonicalMilestone(options, milestone);

assert(manifest.nonredundancy.canonicalSourceTrees === 1, "Nonredundancy contract requires one canonical source tree.");
assert(manifest.nonredundancy.sharedQaExecutions === 1, "Nonredundancy contract requires one shared QA execution.");
assert(new Set(manifest.nonredundancy.milestoneEvidenceDirectories).size === 3, "Milestone evidence directory register must contain three unique subfolders.");

if (manifest.integratedQa.status === "passed") {
  const qaRecord = manifest.integratedQa.files.find((file) => file.path === "evidence/shared/PHASE_2_INTEGRATED_QA.json");
  assert(qaRecord, "Passing integrated QA has no canonical report in the inventory.");
  const qa = readJson(path.join(options.root, qaRecord.path)) as { evidenceClass?: string; passed?: boolean; steps?: Array<{ id?: string; exitCode?: number }> };
  inspectSyntheticBoundary(qa, "integrated QA report");
  assert(qa.evidenceClass === "synthetic_demo" && qa.passed === true, "Integrated QA is not passing under the synthetic boundary.");
  const expectedSteps = ["migration_integrity", "focused_phase2_tests", "typecheck", "strict_lint", "full_regression", "client_server_build"];
  assert(JSON.stringify(qa.steps?.map((step) => step.id)) === JSON.stringify(expectedSteps), "Integrated QA step register drifted.");
  assert(qa.steps?.every((step) => step.exitCode === 0), "Integrated QA contains a failing step.");
} else {
  assert(options.allowIncomplete, "Integrated QA is missing without --allow-incomplete.");
}

if (!options.allowIncomplete) {
  assert(manifest.status === "complete", "Default verification requires a complete final manifest.");
  assert(manifest.allowIncompleteUsed === false, "Final manifest was generated in incomplete mode.");
  assert(manifest.criteriaPassed === 24, `Default verification requires 24/24 criteria; found ${manifest.criteriaPassed}.`);
  assert(manifest.milestones.every((milestone) => milestone.status === "complete"), "Default verification requires all three milestone gates.");
  assert(manifest.integratedQa.status === "passed", "Default verification requires passing integrated QA.");
} else {
  assert(manifest.status === "complete" || manifest.status === "development_incomplete", "Unexpected development manifest status.");
}

const inventoryPaths = manifest.inventory.map((file) => file.path);
assert(new Set(inventoryPaths).size === inventoryPaths.length, "Consolidated inventory contains duplicate paths.");
for (const file of manifest.inventory) {
  const absolute = resolveRegisterPath(options, file.path);
  assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `Inventory file is missing: ${file.path}`);
  const actual = hashFile(absolute);
  assert(actual.bytes === file.bytes && actual.sha256 === file.sha256, `Inventory byte/hash mismatch: ${file.path}`);
  if (file.path.endsWith(".json")) inspectSyntheticBoundary(readJson(absolute), file.path);
}

const checksumLines = fs.readFileSync(checksumPath, "utf8").trim().split(/\r?\n/).filter(Boolean);
const checksumMap = new Map<string, string>();
for (const line of checksumLines) {
  const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
  assert(match, `Invalid checksum-register line: ${line}`);
  assert(!checksumMap.has(match[2]), `Checksum register repeats ${match[2]}.`);
  checksumMap.set(match[2], match[1]);
}
const manifestLabel = isWithin(options.root, manifestPath) ? normalize(path.relative(options.root, manifestPath)) : "@output/PHASE_2_ACCEPTANCE_MANIFEST.json";
const expectedChecksumPaths = [...inventoryPaths, manifestLabel].sort();
assert(JSON.stringify([...checksumMap.keys()].sort()) === JSON.stringify(expectedChecksumPaths), "Checksum register differs from the consolidated inventory plus manifest.");
for (const [registerPath, expectedHash] of checksumMap) {
  const absolute = resolveRegisterPath(options, registerPath);
  assert(fs.existsSync(absolute), `Checksummed file is missing: ${registerPath}`);
  assert(hashFile(absolute).sha256 === expectedHash, `Checksum mismatch: ${registerPath}`);
}

console.log(JSON.stringify({
  verified: true,
  mode: options.allowIncomplete ? "development_allow_incomplete" : "final_fail_closed",
  status: manifest.status,
  criteria: `${manifest.criteriaPassed}/24`,
  milestones: Object.fromEntries(manifest.milestones.map((milestone) => [milestone.id, milestone.status])),
  integratedQa: manifest.integratedQa.status,
  filesVerified: checksumMap.size,
  evidenceClass: manifest.evidenceClass,
}, null, 2));
