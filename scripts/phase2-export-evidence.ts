import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const GENERATED_FILES = new Set([
  "PHASE_2_ACCEPTANCE_SUMMARY.md",
  "PHASE_2_ACCEPTANCE_MANIFEST.json",
  "PHASE_2_SHA256SUMS.txt",
]);

const MILESTONES = [
  { id: "M2.2", directory: "M2.2_MHTCM_Case_Management_Live" },
  { id: "M2.3", directory: "M2.3_MHRS_Program_Module_Live" },
  { id: "M2.4", directory: "M2.4_GRO_Residential_Operations_Complete" },
] as const;

type MilestoneId = (typeof MILESTONES)[number]["id"];
type CriterionStatus = "passed" | "pending_missing_evidence";

interface Options {
  root: string;
  output: string;
  allowIncomplete: boolean;
}

interface AcceptanceCriterion {
  criterion: string;
  milestone: MilestoneId;
  control: string;
  plannedEvidence: string;
}

interface CriterionResult extends AcceptanceCriterion {
  status: CriterionStatus;
  evidencePaths: string[];
  detail: string;
}

interface FileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

interface MilestoneResult {
  id: MilestoneId;
  directory: string;
  status: "complete" | "pending_missing_evidence";
  manifestPath: string | null;
  evidenceClass: "synthetic_demo" | null;
  acceptanceGate: boolean;
  files: FileRecord[];
  criteria: CriterionResult[];
  detail: string;
}

interface GenericManifestFile {
  path: string;
  sha256: string;
  bytes?: number;
}

interface GenericCriterionEntry {
  criterion?: string;
  criterionId?: string;
  id?: string;
  status?: string;
  passed?: boolean;
  evidence?: string | string[];
  evidencePaths?: string[];
}

interface GenericMilestoneManifest {
  milestone?: string;
  evidenceClass?: string;
  acceptanceGate?: boolean | string;
  passed?: boolean;
  complete?: boolean;
  allCriteriaPassed?: boolean;
  files?: GenericManifestFile[];
  criteria?: GenericCriterionEntry[];
  assertions?: Record<string, unknown>;
}

function parseOptions(argv: string[]): Options {
  let root: string | undefined;
  let output: string | undefined;
  let allowIncomplete = false;
  const positional: string[] = [];
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--allow-incomplete") {
      allowIncomplete = true;
    } else if (argument === "--root" || argument === "--output") {
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

function safeResolve(parent: string, relativePath: string): string {
  assert(!path.isAbsolute(relativePath), `Manifest path must be relative: ${relativePath}`);
  const resolved = path.resolve(parent, relativePath);
  assert(isWithin(parent, resolved), `Manifest path escapes its milestone directory: ${relativePath}`);
  return resolved;
}

function hashBuffer(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fileRecord(absolutePath: string, label: string): FileRecord {
  const contents = fs.readFileSync(absolutePath);
  return { path: label, bytes: contents.length, sha256: hashBuffer(contents) };
}

function walkFiles(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const result: string[] = [];
  const visit = (directory: string) => {
    const entries = fs.readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile()) result.push(normalize(path.relative(root, absolute)));
      else throw new Error(`Unsupported evidence filesystem entry: ${absolute}`);
    }
  };
  visit(root);
  return result;
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  assert(!quoted, "Acceptance matrix CSV ends inside a quoted field.");
  return rows.filter((candidate) => candidate.some((entry) => entry !== ""));
}

function readAcceptanceMatrix(root: string): AcceptanceCriterion[] {
  const matrixPath = path.join(root, "controls", "PHASE_2_ACCEPTANCE_MATRIX.csv");
  assert(fs.existsSync(matrixPath), `Phase 2 acceptance matrix is missing: ${matrixPath}`);
  const rows = parseCsv(fs.readFileSync(matrixPath, "utf8"));
  const headers = rows[0];
  assert(headers, "Phase 2 acceptance matrix has no headers.");
  const required = ["criterion", "milestone", "control", "planned_evidence"];
  for (const header of required) assert(headers.includes(header), `Acceptance matrix is missing ${header}.`);
  const records = rows.slice(1).map((row, rowIndex) => {
    assert(row.length === headers.length, `Acceptance matrix row ${rowIndex + 2} has an invalid column count.`);
    return Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""]));
  });
  assert(records.length === 24, `Phase 2 must contain exactly 24 criteria; found ${records.length}.`);
  const criteria = records.map((record) => {
    assert(MILESTONES.some((milestone) => milestone.id === record.milestone), `Unexpected milestone ${record.milestone}.`);
    return {
      criterion: record.criterion,
      milestone: record.milestone as MilestoneId,
      control: record.control,
      plannedEvidence: record.planned_evidence,
    };
  });
  assert(new Set(criteria.map((criterion) => criterion.criterion)).size === 24, "Phase 2 criterion identifiers are not unique.");
  for (const milestone of MILESTONES) {
    assert(criteria.filter((criterion) => criterion.milestone === milestone.id).length === 8, `${milestone.id} must have exactly eight criteria.`);
  }
  return criteria;
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSON evidence ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
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
      if (normalizedKey === "evidenceclass") {
        assert(child === "synthetic_demo" || child === null, `${source} has non-synthetic evidence at ${childPointer}.`);
      }
      if (normalizedKey === "productionrows") {
        assert(child === 0, `${source} reports production rows at ${childPointer}.`);
      }
      if (normalizedKey === "usesproductiondata" || normalizedKey === "productiondataused") {
        assert(child === false, `${source} reports production-data use at ${childPointer}.`);
      }
      if (normalizedKey === "datamode" && typeof child === "string") {
        assert(/synthetic|demo/i.test(child), `${source} has a non-synthetic data mode at ${childPointer}.`);
      }
      if (normalizedKey === "productionevidence") {
        const acceptable = child === false || child === null || (typeof child === "string" && /not supplied|none|synthetic/i.test(child));
        assert(acceptable, `${source} claims production evidence at ${childPointer}.`);
      }
      visit(child, childPointer);
    }
  };
  visit(value, "$");
}

function passingStatus(value: unknown): boolean {
  if (value === true) return true;
  return typeof value === "string" && /^(pass|passed|complete|completed|accepted|ready)$/i.test(value.trim());
}

function criterionId(entry: GenericCriterionEntry): string | undefined {
  return entry.criterion ?? entry.criterionId ?? entry.id;
}

function milestoneGatePassed(manifest: GenericMilestoneManifest, milestone: MilestoneId): boolean {
  if (passingStatus(manifest.acceptanceGate) || manifest.passed === true || manifest.complete === true || manifest.allCriteriaPassed === true) return true;
  if (milestone === "M2.3") {
    const assertions = manifest.assertions ?? {};
    return assertions.controlledWorkflows === 4
      && assertions.billingReadyScenarios === 4
      && assertions.revenueReadyHandoffs === 4
      && assertions.rejectedNegativeControls === 6
      && assertions.reviewState === "completed";
  }
  return false;
}

function discoverManifest(directory: string, milestone: MilestoneId): { relativePath: string; manifest: GenericMilestoneManifest } | null {
  const candidates = walkFiles(directory).filter((relativePath) => /manifest.*\.json$|\.json$/i.test(path.basename(relativePath)));
  const matches: Array<{ relativePath: string; manifest: GenericMilestoneManifest }> = [];
  for (const relativePath of candidates) {
    if (!/manifest/i.test(path.basename(relativePath))) continue;
    const parsed = readJson(path.join(directory, relativePath));
    if (parsed && typeof parsed === "object" && (parsed as GenericMilestoneManifest).milestone === milestone) {
      matches.push({ relativePath, manifest: parsed as GenericMilestoneManifest });
    }
  }
  assert(matches.length <= 1, `${milestone} has multiple canonical manifests: ${matches.map((match) => match.relativePath).join(", ")}`);
  return matches[0] ?? null;
}

function validateMilestone(
  root: string,
  evidenceRoot: string,
  milestone: (typeof MILESTONES)[number],
  criteria: AcceptanceCriterion[],
  allowIncomplete: boolean,
): MilestoneResult {
  const directory = path.join(evidenceRoot, milestone.directory);
  const actualFiles = walkFiles(directory);
  const discovered = actualFiles.length > 0 ? discoverManifest(directory, milestone.id) : null;
  if (!discovered) {
    if (!allowIncomplete) throw new Error(`${milestone.id} canonical evidence manifest is missing from ${directory}.`);
    return {
      id: milestone.id,
      directory: normalize(path.relative(root, directory)),
      status: "pending_missing_evidence",
      manifestPath: null,
      evidenceClass: null,
      acceptanceGate: false,
      files: [],
      criteria: criteria.map((criterion) => ({
        ...criterion,
        status: "pending_missing_evidence",
        evidencePaths: [],
        detail: `${milestone.id} evidence has not been exported.`,
      })),
      detail: "Canonical milestone evidence is absent; development-only incomplete mode retained the pending disposition.",
    };
  }

  const { relativePath: manifestRelativePath, manifest } = discovered;
  assert(manifest.evidenceClass === "synthetic_demo", `${milestone.id} manifest evidenceClass must be synthetic_demo.`);
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, `${milestone.id} manifest has no file inventory.`);
  inspectSyntheticBoundary(manifest, `${milestone.id} manifest`);

  const declaredPaths = new Set<string>();
  const fileRecords: FileRecord[] = [];
  for (const file of manifest.files) {
    assert(file && typeof file.path === "string" && file.path.length > 0, `${milestone.id} manifest contains an invalid file path.`);
    const normalizedPath = normalize(file.path);
    assert(!declaredPaths.has(normalizedPath), `${milestone.id} manifest declares ${normalizedPath} more than once.`);
    declaredPaths.add(normalizedPath);
    const absolute = safeResolve(directory, normalizedPath);
    assert(fs.existsSync(absolute) && fs.statSync(absolute).isFile(), `${milestone.id} declared file is missing: ${normalizedPath}`);
    const record = fileRecord(absolute, normalize(path.join("evidence", milestone.directory, normalizedPath)));
    assert(record.sha256 === file.sha256, `${milestone.id} hash mismatch: ${normalizedPath}`);
    if (file.bytes !== undefined) assert(record.bytes === file.bytes, `${milestone.id} byte-count mismatch: ${normalizedPath}`);
    if (normalizedPath.endsWith(".json")) inspectSyntheticBoundary(readJson(absolute), `${milestone.id}/${normalizedPath}`);
    fileRecords.push(record);
  }

  const actualPayloadFiles = actualFiles.filter((relativePath) => relativePath !== manifestRelativePath).sort();
  assert(
    JSON.stringify([...declaredPaths].sort()) === JSON.stringify(actualPayloadFiles),
    `${milestone.id} evidence inventory differs from its canonical manifest.`,
  );
  assert(
    [...declaredPaths].some((relativePath) => relativePath.endsWith(".md") && /acceptance|report|summary/i.test(path.basename(relativePath))),
    `${milestone.id} is missing a declared acceptance summary/report.`,
  );
  assert(
    [...declaredPaths].some((relativePath) => /\.json$|\.csv$/i.test(relativePath)),
    `${milestone.id} is missing declared structured evidence.`,
  );

  const expectedIds = criteria.map((criterion) => criterion.criterion);
  const explicitCriteria = Array.isArray(manifest.criteria) ? manifest.criteria : null;
  if (explicitCriteria) {
    const ids = explicitCriteria.map(criterionId);
    assert(ids.every(Boolean) && new Set(ids).size === 8, `${milestone.id} manifest criteria must contain eight unique identifiers.`);
    assert(JSON.stringify([...ids].sort()) === JSON.stringify([...expectedIds].sort()), `${milestone.id} manifest criteria do not match the controlling matrix.`);
    for (const entry of explicitCriteria) {
      assert(entry.passed === true || passingStatus(entry.status), `${criterionId(entry)} is not explicitly passed.`);
    }
  } else {
    assert(milestoneGatePassed(manifest, milestone.id), `${milestone.id} manifest lacks an explicit passing acceptance gate.`);
  }

  const manifestLabel = normalize(path.join("evidence", milestone.directory, manifestRelativePath));
  const manifestRecord = fileRecord(path.join(directory, manifestRelativePath), manifestLabel);
  fileRecords.push(manifestRecord);
  const criteriaResults = criteria.map((criterion) => {
    const entry = explicitCriteria?.find((candidate) => criterionId(candidate) === criterion.criterion);
    const entryEvidence = entry?.evidencePaths ?? (typeof entry?.evidence === "string" ? [entry.evidence] : entry?.evidence ?? []);
    const planned = [...declaredPaths].find((relativePath) => path.basename(relativePath).toLowerCase() === criterion.plannedEvidence.toLowerCase());
    const relativeEvidence = entryEvidence.length > 0 ? entryEvidence : planned ? [planned] : [...declaredPaths].filter((relativePath) => /\.json$|\.csv$/i.test(relativePath));
    for (const relativePath of relativeEvidence) {
      assert(declaredPaths.has(normalize(relativePath)), `${criterion.criterion} references evidence not declared by ${milestone.id}: ${relativePath}`);
    }
    const evidencePaths = [manifestLabel, ...relativeEvidence.map((relativePath) => normalize(path.join("evidence", milestone.directory, relativePath)))];
    return {
      ...criterion,
      status: "passed" as const,
      evidencePaths: [...new Set(evidencePaths)],
      detail: `Passed under the hash-verified ${milestone.id} synthetic acceptance gate.`,
    };
  });

  return {
    id: milestone.id,
    directory: normalize(path.relative(root, directory)),
    status: "complete",
    manifestPath: manifestLabel,
    evidenceClass: "synthetic_demo",
    acceptanceGate: true,
    files: fileRecords.sort((left, right) => left.path.localeCompare(right.path)),
    criteria: criteriaResults,
    detail: `${manifest.files.length} declared payload files and one canonical manifest passed byte/hash and synthetic-boundary verification.`,
  };
}

function validateSharedQa(root: string, sharedDirectory: string, allowIncomplete: boolean): {
  status: "passed" | "pending_missing_evidence";
  files: FileRecord[];
  detail: string;
} {
  const qaPath = path.join(sharedDirectory, "PHASE_2_INTEGRATED_QA.json");
  if (!fs.existsSync(qaPath)) {
    if (!allowIncomplete) throw new Error(`Integrated QA evidence is missing: ${qaPath}`);
    return { status: "pending_missing_evidence", files: [], detail: "Integrated QA has not completed." };
  }
  const qa = readJson(qaPath) as Record<string, unknown>;
  inspectSyntheticBoundary(qa, "Phase 2 integrated QA");
  assert(qa.evidenceClass === "synthetic_demo", "Integrated QA evidenceClass must be synthetic_demo.");
  assert(qa.passed === true, "Integrated QA report is not passing.");
  const steps = qa.steps;
  assert(Array.isArray(steps), "Integrated QA report has no step register.");
  const expectedSteps = ["migration_integrity", "focused_phase2_tests", "typecheck", "strict_lint", "full_regression", "client_server_build"];
  assert(JSON.stringify(steps.map((step) => (step as { id?: string }).id)) === JSON.stringify(expectedSteps), "Integrated QA step identity/order drifted.");
  assert(steps.every((step) => (step as { exitCode?: number }).exitCode === 0), "One or more integrated QA steps failed.");
  const sharedFiles = walkFiles(sharedDirectory).filter((relativePath) => !GENERATED_FILES.has(path.basename(relativePath)));
  for (const stepId of expectedSteps) assert(sharedFiles.includes(`${stepId}.log`), `Integrated QA log is missing: ${stepId}.log`);
  const files = sharedFiles.map((relativePath) => fileRecord(
    path.join(sharedDirectory, relativePath),
    normalize(path.join("evidence", "shared", relativePath)),
  ));
  return { status: "passed", files, detail: "All six integrated QA steps passed with retained logs." };
}

function markdownEscape(value: string): string {
  return value.split("|").join("\\|").replace(/\r?\n/g, " ");
}

function outputLabel(root: string, output: string, fileName: string): string {
  const absolute = path.join(output, fileName);
  return isWithin(root, absolute) ? normalize(path.relative(root, absolute)) : `@output/${fileName}`;
}

function atomicWrite(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporaryPath, value);
  fs.renameSync(temporaryPath, filePath);
}

const options = parseOptions(process.argv.slice(2));
const controlsRoot = path.join(options.root, "controls");
const evidenceRoot = path.join(options.root, "evidence");
assert(fs.existsSync(controlsRoot), `Controls root is missing: ${controlsRoot}`);
assert(fs.existsSync(evidenceRoot), `Evidence root is missing: ${evidenceRoot}`);
for (const milestone of MILESTONES) {
  const milestoneDirectory = path.join(evidenceRoot, milestone.directory);
  assert(!isWithin(milestoneDirectory, options.output), "Consolidated output cannot be written inside a milestone evidence directory.");
}

const criteria = readAcceptanceMatrix(options.root);
const milestoneResults = MILESTONES.map((milestone) => validateMilestone(
  options.root,
  evidenceRoot,
  milestone,
  criteria.filter((criterion) => criterion.milestone === milestone.id),
  options.allowIncomplete,
));
const criterionResults = milestoneResults.flatMap((milestone) => milestone.criteria);
assert(criterionResults.length === 24, `Consolidated criterion register must contain 24 rows; found ${criterionResults.length}.`);
const qa = validateSharedQa(options.root, path.join(evidenceRoot, "shared"), options.allowIncomplete);
const passedCriteria = criterionResults.filter((criterion) => criterion.status === "passed").length;
const incomplete = passedCriteria !== 24 || qa.status !== "passed" || milestoneResults.some((milestone) => milestone.status !== "complete");
if (incomplete && !options.allowIncomplete) throw new Error("Phase 2 is incomplete; rerun only after all milestones and integrated QA pass.");

const overallStatus = incomplete ? "DEVELOPMENT INCOMPLETE" : "ACCEPTANCE EVIDENCE COMPLETE";
const summary = `# AMOS-OPS Phase 2 Integrated Sprint — Acceptance Summary

**Status:** ${overallStatus}  
**Evidence boundary:** Synthetic demonstration only; production evidence and production rows are prohibited.  
**Criteria verified:** ${passedCriteria}/24  
**Integrated QA:** ${qa.status}

${incomplete ? "> Development-only output produced with the explicit `--allow-incomplete` flag. It is not a final acceptance record and cannot be sealed as the final Phase 2 package.\n" : "All three milestone gates and the single integrated QA sequence passed. This record is eligible for final package sealing.\n"}

## Milestone gates

| Milestone | Status | Criteria | Canonical manifest | Verification |
|---|---|---:|---|---|
${milestoneResults.map((milestone) => `| ${milestone.id} | ${milestone.status} | ${milestone.criteria.filter((criterion) => criterion.status === "passed").length}/8 | ${milestone.manifestPath ? `\`${milestone.manifestPath}\`` : "Pending"} | ${markdownEscape(milestone.detail)} |`).join("\n")}

## Controlling 24-criterion register

| Criterion | Milestone | Status | Control | Evidence |
|---|---|---|---|---|
${criterionResults.map((criterion) => `| ${criterion.criterion} | ${criterion.milestone} | ${criterion.status} | ${markdownEscape(criterion.control)} | ${criterion.evidencePaths.length > 0 ? criterion.evidencePaths.map((evidencePath) => `\`${evidencePath}\``).join("<br>") : "Pending"} |`).join("\n")}

## Nonredundancy and data controls

- One canonical source tree is used for M2.2, M2.3, and M2.4.
- Milestone evidence remains in three subfolders under one integrated evidence root.
- Milestone manifests and every declared payload file are verified by SHA-256.
- Shared QA is executed and retained once, not repeated per milestone.
- All inspected evidence-class and data-mode fields are synthetic-only; any production-data indicator fails closed.
- Final sealing creates one filtered canonical source snapshot, not three milestone source copies.
`;

const summaryName = "PHASE_2_ACCEPTANCE_SUMMARY.md";
const manifestName = "PHASE_2_ACCEPTANCE_MANIFEST.json";
const checksumsName = "PHASE_2_SHA256SUMS.txt";
atomicWrite(path.join(options.output, summaryName), summary);

const matrixPath = path.join(options.root, "controls", "PHASE_2_ACCEPTANCE_MATRIX.csv");
const inventory = [
  fileRecord(matrixPath, "controls/PHASE_2_ACCEPTANCE_MATRIX.csv"),
  ...milestoneResults.flatMap((milestone) => milestone.files),
  ...qa.files,
  fileRecord(path.join(options.output, summaryName), outputLabel(options.root, options.output, summaryName)),
].sort((left, right) => left.path.localeCompare(right.path));
assert(new Set(inventory.map((file) => file.path)).size === inventory.length, "Consolidated evidence inventory contains duplicate paths.");

const manifest = {
  schemaVersion: "1.0",
  recordId: "AMOS-OPS-PHASE2-ACCEPTANCE-EVIDENCE",
  evidenceClass: "synthetic_demo",
  status: incomplete ? "development_incomplete" : "complete",
  allowIncompleteUsed: options.allowIncomplete,
  criteriaExpected: 24,
  criteriaPassed: passedCriteria,
  integratedQa: qa,
  milestones: milestoneResults,
  criteria: criterionResults,
  inventory,
  nonredundancy: {
    canonicalSourceTrees: 1,
    milestoneEvidenceDirectories: MILESTONES.map((milestone) => `evidence/${milestone.directory}`),
    sharedQaExecutions: 1,
  },
};
inspectSyntheticBoundary(manifest, "consolidated Phase 2 manifest");
const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;
atomicWrite(path.join(options.output, manifestName), manifestText);
const manifestRecord = fileRecord(path.join(options.output, manifestName), outputLabel(options.root, options.output, manifestName));
const checksumRecords = [...inventory, manifestRecord].sort((left, right) => left.path.localeCompare(right.path));
const checksumText = `${checksumRecords.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`;
atomicWrite(path.join(options.output, checksumsName), checksumText);

console.log(JSON.stringify({
  root: options.root,
  output: options.output,
  status: manifest.status,
  criteriaPassed: passedCriteria,
  criteriaExpected: 24,
  integratedQa: qa.status,
  milestoneStatuses: Object.fromEntries(milestoneResults.map((milestone) => [milestone.id, milestone.status])),
  filesChecksummed: checksumRecords.length,
}, null, 2));
