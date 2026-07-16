import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  PHASE3_CRITERIA,
  PHASE3_DEMO_CONTROL_ROLES,
  PHASE3_DX1_APPLICABLE_CONTROLS,
  PHASE3_MILESTONES,
  type Phase3Criterion,
  type Phase3IntegratedResult,
  type Phase3Milestone,
} from "@contracts/phase3/shared";

export const PHASE3_EVIDENCE_CLASS = "synthetic_demo" as const;
export const PHASE3_CRITERIA_EXPECTED = 31;

export const PHASE3_MILESTONE_EVIDENCE = [
  {
    id: "M3.1",
    domain: "COMPLIANCE",
    directory: "M3.1_Compliance_and_Audit_System_Operational",
    resultFile: "M3_1_MODULE_RESULT.json",
    summaryFile: "M3_1_ACCEPTANCE_SUMMARY.md",
  },
  {
    id: "M3.2",
    domain: "REVENUE",
    directory: "M3.2_Revenue_Cycle_Functional",
    resultFile: "M3_2_MODULE_RESULT.json",
    summaryFile: "M3_2_ACCEPTANCE_SUMMARY.md",
  },
  {
    id: "M3.3",
    domain: "WORKFORCE",
    directory: "M3.3_Workforce_Management_Live",
    resultFile: "M3_3_MODULE_RESULT.json",
    summaryFile: "M3_3_ACCEPTANCE_SUMMARY.md",
  },
  {
    id: "M3.4",
    domain: "GAD",
    directory: "M3.4_GAD_Operations_Complete",
    resultFile: "M3_4_MODULE_RESULT.json",
    summaryFile: "M3_4_ACCEPTANCE_SUMMARY.md",
  },
] as const;

export const PHASE3_SHARED_FILES = {
  scenario: "PHASE_3_INTEGRATED_SCENARIO_RESULT.json",
  dx1: "PHASE_3_DX1_RESULT.json",
  manifest: "PHASE_3_ACCEPTANCE_MANIFEST.json",
  summary: "PHASE_3_ACCEPTANCE_SUMMARY.md",
  checksums: "PHASE_3_SHA256SUMS.txt",
  qa: "PHASE_3_INTEGRATED_QA.json",
} as const;

export const PHASE3_CONTROL_REFERENCE_PATHS = [
  "controls/PHASE_3_METRIC_DEFINITION_RECONCILIATION.md",
  "controls/PHASE_3_DEMO_PARITY_DEVIATION_REGISTER.md",
  "../M1.3_MGMA_Baseline_Established/evidence/01_Domain_Mapping_and_KPI_Dictionary/M1_3_KPI_DATA_DICTIONARY.csv",
] as const;

export interface Phase3EvidenceOptions {
  root: string;
  output: string;
}

export interface Phase3FileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

export interface Phase3ControlReference {
  repoPath: string;
  bytes: number;
  sha256: string;
}

export interface Phase3ManifestCriterion {
  criterionId: Phase3Criterion;
  milestone: Phase3Milestone;
  status: "passed";
  summary: string;
  evidencePaths: string[];
}

export interface Phase3ManifestMilestone {
  id: Phase3Milestone;
  domain: (typeof PHASE3_MILESTONE_EVIDENCE)[number]["domain"];
  directory: string;
  evidenceClass: typeof PHASE3_EVIDENCE_CLASS;
  status: "complete";
  criteriaExpected: number;
  criteriaPassed: number;
  moduleResultPath: string;
  summaryPath: string;
}

export interface Phase3AcceptanceManifest {
  schemaVersion: "1.0";
  recordId: "AMOS-OPS-PHASE3-ACCEPTANCE-EVIDENCE";
  evidenceClass: typeof PHASE3_EVIDENCE_CLASS;
  status: "complete";
  criteriaExpected: typeof PHASE3_CRITERIA_EXPECTED;
  criteriaPassed: typeof PHASE3_CRITERIA_EXPECTED;
  syntheticBoundary: {
    dataMode: "synthetic_demo";
    productionRows: 0;
    usesProductionData: false;
  };
  productionActionsBlocked: string[];
  exitGate: true;
  integratedScenario: {
    id: string;
    status: "passed";
    supportCaseId: string;
    sourceEpisodeId: string;
    resultPath: string;
    assertionsPassed: number;
    assertionsFailed: 0;
  };
  crossCuttingControl: {
    id: "DX.1-P3";
    status: "complete";
    resultPath: string;
    applicableControlsExpected: number;
    applicableControlsPassed: number;
    featureScenarios: 31;
    deferredBySequence: number;
  };
  controlReferences: Phase3ControlReference[];
  milestones: Phase3ManifestMilestone[];
  criteria: Phase3ManifestCriterion[];
  inventory: Phase3FileRecord[];
  nonredundancy: {
    canonicalSourceTrees: 1;
    integratedScenarioExecutions: 1;
    milestoneSourceCopies: 0;
    milestoneEvidenceDirectories: string[];
  };
}

export function assertPhase3(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function normalizePhase3Path(value: string): string {
  return value.split(path.sep).join("/");
}

export function isPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function parsePhase3EvidenceOptions(
  argv: readonly string[],
): Phase3EvidenceOptions {
  let root: string | undefined;
  let output: string | undefined;
  const positional: string[] = [];
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
    } else {
      positional.push(argument);
    }
  }
  root ??= positional[0] ?? "..";
  const resolvedRoot = path.resolve(root);
  output ??= positional[1] ?? path.join(resolvedRoot, "evidence", "shared");
  return { root: resolvedRoot, output: path.resolve(output) };
}

export function phase3SourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`Phase 3 source root is missing under ${root}.`);
}

export function phase3EvidenceRoot(output: string): string {
  return path.dirname(output);
}

export function phase3EvidenceLabel(
  evidenceRoot: string,
  absolutePath: string,
): string {
  assertPhase3(
    isPathWithin(evidenceRoot, absolutePath),
    `Evidence path escapes the evidence root: ${absolutePath}`,
  );
  return normalizePhase3Path(path.relative(evidenceRoot, absolutePath));
}

export function resolvePhase3EvidencePath(
  evidenceRoot: string,
  label: string,
): string {
  assertPhase3(
    !path.isAbsolute(label),
    `Evidence path must be relative: ${label}`,
  );
  const absolute = path.resolve(evidenceRoot, label);
  assertPhase3(
    isPathWithin(evidenceRoot, absolute),
    `Evidence path escapes the evidence root: ${label}`,
  );
  return absolute;
}

export function hashPhase3Buffer(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function phase3FileRecord(
  absolutePath: string,
  label: string,
): Phase3FileRecord {
  const contents = fs.readFileSync(absolutePath);
  return {
    path: normalizePhase3Path(label),
    bytes: contents.length,
    sha256: hashPhase3Buffer(contents),
  };
}

export function phase3ControlReferences(
  root: string,
): Phase3ControlReference[] {
  const allowedParent = path.dirname(path.resolve(root));
  return PHASE3_CONTROL_REFERENCE_PATHS.map((repoPath) => {
    const absolute = path.resolve(root, repoPath);
    assertPhase3(
      isPathWithin(allowedParent, absolute),
      `Phase 3 control reference escapes the milestone repository: ${repoPath}`,
    );
    assertPhase3(
      fs.existsSync(absolute) && fs.statSync(absolute).isFile(),
      `Phase 3 control reference is missing: ${repoPath}`,
    );
    const contents = fs.readFileSync(absolute);
    return {
      repoPath: normalizePhase3Path(repoPath),
      bytes: contents.length,
      sha256: hashPhase3Buffer(contents),
    };
  }).sort((left, right) => left.repoPath.localeCompare(right.repoPath));
}

export function readPhase3Json(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stableValue(child)]),
  );
}

export function stablePhase3Json(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function atomicWritePhase3(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporaryPath, value);
  fs.renameSync(temporaryPath, filePath);
}

export function walkPhase3Files(root: string): string[] {
  if (!fs.existsSync(root)) return [];
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile())
        files.push(normalizePhase3Path(path.relative(root, absolute)));
      else
        throw new Error(`Unsupported evidence filesystem entry: ${absolute}`);
    }
  };
  visit(root);
  return files;
}

export function expectedPhase3Criteria(
  milestone: Phase3Milestone,
): Phase3Criterion[] {
  return PHASE3_CRITERIA.filter((criterion) =>
    criterion.startsWith(`${milestone}-`),
  );
}

export function inspectPhase3SyntheticBoundary(
  value: unknown,
  source: string,
): void {
  const visit = (candidate: unknown, pointer: string) => {
    if (Array.isArray(candidate)) {
      candidate.forEach((child, index) => visit(child, `${pointer}[${index}]`));
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(
      candidate as Record<string, unknown>,
    )) {
      const normalizedKey = key.toLowerCase().replaceAll("_", "");
      const childPointer = `${pointer}.${key}`;
      if (normalizedKey === "evidenceclass") {
        assertPhase3(
          child === PHASE3_EVIDENCE_CLASS || child === null,
          `${source} has non-synthetic evidence at ${childPointer}.`,
        );
      }
      if (normalizedKey === "productionrows") {
        assertPhase3(
          child === 0,
          `${source} reports production rows at ${childPointer}.`,
        );
      }
      if (
        normalizedKey === "usesproductiondata" ||
        normalizedKey === "productiondataused"
      ) {
        assertPhase3(
          child === false,
          `${source} reports production-data use at ${childPointer}.`,
        );
      }
      if (normalizedKey === "datamode" && typeof child === "string") {
        assertPhase3(
          /synthetic|demo/i.test(child),
          `${source} has a non-synthetic data mode at ${childPointer}.`,
        );
      }
      if (normalizedKey === "productionevidence") {
        const acceptable =
          child === false ||
          child === null ||
          (typeof child === "string" &&
            /not supplied|none|synthetic/i.test(child));
        assertPhase3(
          acceptable,
          `${source} claims production evidence at ${childPointer}.`,
        );
      }
      visit(child, childPointer);
    }
  };
  visit(value, "$");
}

function assertString(
  value: unknown,
  message: string,
): asserts value is string {
  assertPhase3(typeof value === "string" && value.trim().length > 0, message);
}

function assertStringArray(
  value: unknown,
  message: string,
): asserts value is string[] {
  assertPhase3(
    Array.isArray(value) &&
      value.every(
        (entry) => typeof entry === "string" && entry.trim().length > 0,
      ),
    message,
  );
}

export function validatePhase3IntegratedResult(
  value: unknown,
): Phase3IntegratedResult {
  assertPhase3(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "Phase 3 integrated scenario returned no result object.",
  );
  const result = value as Partial<Phase3IntegratedResult>;
  inspectPhase3SyntheticBoundary(result, "Phase 3 integrated scenario");
  assertPhase3(
    result.milestone === "PHASE3_EXIT",
    "Integrated scenario milestone must be PHASE3_EXIT.",
  );
  assertPhase3(
    result.evidenceClass === PHASE3_EVIDENCE_CLASS,
    "Integrated scenario must be synthetic_demo.",
  );
  assertString(
    result.supportCaseId,
    "Integrated scenario supportCaseId is missing.",
  );
  assertString(
    result.sourceEpisodeId,
    "Integrated scenario sourceEpisodeId is missing.",
  );
  assertPhase3(
    result.supportCaseId.startsWith("SYNTH-") &&
      result.sourceEpisodeId.startsWith("SYNTH-"),
    "Integrated scenario identifiers must retain the synthetic boundary.",
  );
  assertPhase3(
    result.criteria !== null &&
      typeof result.criteria === "object" &&
      !Array.isArray(result.criteria),
    "Integrated scenario criteria register is missing.",
  );
  const criterionKeys = Object.keys(result.criteria).sort();
  assertPhase3(
    JSON.stringify(criterionKeys) ===
      JSON.stringify([...PHASE3_CRITERIA].sort()),
    `Integrated scenario must contain exactly ${PHASE3_CRITERIA_EXPECTED} controlling criteria.`,
  );
  assertPhase3(
    PHASE3_CRITERIA.every((criterion) => result.criteria?.[criterion] === true),
    "Every Phase 3 criterion must pass.",
  );
  assertPhase3(
    Array.isArray(result.failedCriteria) && result.failedCriteria.length === 0,
    "Integrated scenario contains failed criteria.",
  );
  assertPhase3(
    Array.isArray(result.supportLinks),
    "Integrated scenario support links are missing.",
  );
  assertPhase3(
    Array.isArray(result.workItems),
    "Integrated scenario work items are missing.",
  );
  assertPhase3(
    Array.isArray(result.auditEvents),
    "Integrated scenario audit events are missing.",
  );
  assertPhase3(
    result.moduleResults !== null &&
      typeof result.moduleResults === "object" &&
      !Array.isArray(result.moduleResults),
    "Integrated scenario module results are missing.",
  );
  assertPhase3(
    JSON.stringify(Object.keys(result.moduleResults).sort()) ===
      JSON.stringify([...PHASE3_MILESTONES].sort()),
    "Integrated scenario must contain all four and only four module results.",
  );

  for (const definition of PHASE3_MILESTONE_EVIDENCE) {
    const moduleResult = result.moduleResults[definition.id];
    assertPhase3(
      moduleResult !== undefined,
      `${definition.id} module result is missing.`,
    );
    assertPhase3(
      moduleResult.milestone === definition.id,
      `${definition.id} module identity drifted.`,
    );
    assertPhase3(
      moduleResult.domain === definition.domain,
      `${definition.id} domain drifted.`,
    );
    assertPhase3(
      moduleResult.evidenceClass === PHASE3_EVIDENCE_CLASS,
      `${definition.id} is not synthetic_demo.`,
    );
    assertPhase3(
      moduleResult.passed === true,
      `${definition.id} module result is not passing.`,
    );
    assertPhase3(
      Array.isArray(moduleResult.criteria),
      `${definition.id} criteria are missing.`,
    );
    assertPhase3(
      Array.isArray(moduleResult.auditEvents),
      `${definition.id} audit events are missing.`,
    );
    assertPhase3(
      moduleResult.snapshot !== null &&
        typeof moduleResult.snapshot === "object",
      `${definition.id} snapshot is missing.`,
    );
    const expected = expectedPhase3Criteria(definition.id);
    const actual = moduleResult.criteria.map(
      (criterion) => criterion.criterionId,
    );
    assertPhase3(
      JSON.stringify([...actual].sort()) ===
        JSON.stringify([...expected].sort()),
      `${definition.id} module criteria do not match the controlling register.`,
    );
    assertPhase3(
      new Set(actual).size === actual.length,
      `${definition.id} module criteria are duplicated.`,
    );
    for (const criterion of moduleResult.criteria) {
      assertPhase3(
        criterion.passed === true,
        `${criterion.criterionId} did not pass.`,
      );
      assertString(
        criterion.summary,
        `${criterion.criterionId} summary is missing.`,
      );
      assertPhase3(
        criterion.evidence !== null &&
          typeof criterion.evidence === "object" &&
          !Array.isArray(criterion.evidence),
        `${criterion.criterionId} structured evidence is missing.`,
      );
    }
  }

  assertPhase3(
    result.dx1 !== null &&
      typeof result.dx1 === "object" &&
      !Array.isArray(result.dx1),
    "DX.1-P3 result is missing from the integrated scenario.",
  );
  const dx1 = result.dx1;
  assertPhase3(
    dx1.controlId === "DX.1-P3",
    "DX.1-P3 control identity drifted.",
  );
  assertPhase3(
    dx1.evidenceClass === PHASE3_EVIDENCE_CLASS,
    "DX.1-P3 must be synthetic_demo.",
  );
  assertPhase3(dx1.passed === true, "DX.1-P3 is not passing.");
  assertPhase3(
    dx1.environmentId === "AMOS-OPS-PHASE3-EVALUATION" &&
      dx1.environmentLabel === "DEMO - NOT FOR CARE DELIVERY",
    "DX.1-P3 environment identity or persistent label drifted.",
  );
  assertPhase3(
    Array.isArray(dx1.applicableControls) &&
      dx1.applicableControls.length === PHASE3_DX1_APPLICABLE_CONTROLS.length,
    "DX.1-P3 applicable-control register is incomplete.",
  );
  const dxControlIds = dx1.applicableControls.map((control) => control.id);
  assertPhase3(
    JSON.stringify([...dxControlIds].sort()) ===
      JSON.stringify([...PHASE3_DX1_APPLICABLE_CONTROLS].sort()),
    "DX.1-P3 applicable-control identifiers drifted.",
  );
  assertPhase3(
    new Set(dxControlIds).size === dxControlIds.length &&
      dx1.applicableControls.every(
        (control) =>
          control.passed === true &&
          Array.isArray(control.evidence) &&
          control.evidence.length > 0,
      ),
    "Every applicable DX.1-P3 control must pass with evidence.",
  );
  assertPhase3(
    Array.isArray(dx1.featureScenarios) &&
      dx1.featureScenarios.length === PHASE3_CRITERIA_EXPECTED,
    "DX.1-P3 must inventory exactly 31 feature scenarios.",
  );
  const featureCriteria = dx1.featureScenarios.map(
    (scenario) => scenario.criterionId,
  );
  assertPhase3(
    JSON.stringify([...featureCriteria].sort()) ===
      JSON.stringify([...PHASE3_CRITERIA].sort()) &&
      new Set(dx1.featureScenarios.map((scenario) => scenario.scenarioId))
        .size === PHASE3_CRITERIA_EXPECTED &&
      dx1.featureScenarios.every(
        (scenario) =>
          scenario.expectedResult === "pass" &&
          scenario.actualResult === "pass" &&
          scenario.evidenceIds.length > 0,
      ),
    "DX.1-P3 feature scenarios are missing, duplicated, or not passing.",
  );
  assertPhase3(
    JSON.stringify([...dx1.authorizedControlRoles].sort()) ===
      JSON.stringify([...PHASE3_DEMO_CONTROL_ROLES].sort()) &&
      dx1.deniedRepresentativeRole === "rcs-day",
    "DX.1-P3 persona authorization register drifted.",
  );
  assertPhase3(
    Array.isArray(dx1.dataProvenance) && dx1.dataProvenance.length >= 3,
    "DX.1-P3 synthetic data provenance is incomplete.",
  );
  assertPhase3(
    Object.values(dx1.runtimeControls).every((value) => value === true),
    "DX.1-P3 runtime controls were not all executed successfully.",
  );
  assertPhase3(
    Array.isArray(dx1.parityDeviationRegister) &&
      dx1.parityDeviationRegister.some(
        (entry) => entry.disposition === "parity",
      ) &&
      dx1.parityDeviationRegister.some(
        (entry) => entry.disposition === "controlled_deviation",
      ) &&
      dx1.parityDeviationRegister.filter(
        (entry) => entry.disposition === "deferred_by_sequence",
      ).length === 2 &&
      dx1.deferredControls.length === 2,
    "DX.1-P3 parity, controlled-deviation, and sequence-deferment register is incomplete.",
  );

  assertStringArray(
    result.productionActionsBlocked,
    "Integrated scenario must record blocked production actions.",
  );
  assertPhase3(
    result.productionActionsBlocked.length > 0,
    "Integrated scenario did not exercise a production-action block.",
  );
  assertPhase3(
    new Set(result.productionActionsBlocked).size ===
      result.productionActionsBlocked.length,
    "Blocked production actions are duplicated.",
  );
  assertPhase3(result.exitGate === true, "Phase 3 exit gate is not passing.");
  assertPhase3(
    result.scenarioRun !== undefined && result.scenarioRun !== null,
    "Integrated scenario run record is missing.",
  );
  assertString(
    result.scenarioRun.id,
    "Integrated scenario run identifier is missing.",
  );
  assertPhase3(
    result.scenarioRun.milestone === "PHASE3_EXIT",
    "Integrated scenario run milestone drifted.",
  );
  assertPhase3(
    result.scenarioRun.status === "passed",
    "Integrated scenario run is not passing.",
  );
  assertPhase3(
    result.scenarioRun.supportCaseId === result.supportCaseId,
    "Integrated scenario support-case lineage drifted.",
  );
  assertPhase3(
    result.scenarioRun.assertionsFailed === 0,
    "Integrated scenario has failed assertions.",
  );
  assertPhase3(
    result.scenarioRun.assertionsPassed >= PHASE3_CRITERIA_EXPECTED,
    "Integrated scenario did not pass enough assertions for all criteria.",
  );
  assertPhase3(
    result.scenarioRun.evidence.dx1Passed === true &&
      result.scenarioRun.evidence.dx1ControlId === "DX.1-P3",
    "Integrated scenario run is not bound to the passing DX.1-P3 control.",
  );
  assertString(
    result.scenarioRun.startedAt,
    "Integrated scenario start time is missing.",
  );
  assertString(
    result.scenarioRun.completedAt,
    "Integrated scenario completion time is missing.",
  );
  return result as Phase3IntegratedResult;
}

export function controllingPhase3CriterionIds(root: string): string[] {
  const matrixPath = path.join(
    root,
    "controls",
    "PHASE_3_ACCEPTANCE_MATRIX.csv",
  );
  assertPhase3(
    fs.existsSync(matrixPath),
    `Controlling Phase 3 acceptance matrix is missing: ${matrixPath}`,
  );
  const lines = fs.readFileSync(matrixPath, "utf8").trim().split(/\r?\n/);
  assertPhase3(
    lines[0]?.startsWith("criterion_id,"),
    "Controlling Phase 3 acceptance matrix header drifted.",
  );
  const parseCsv = (line: string): string[] => {
    const cells: string[] = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const character = line[index];
      if (character === '"') {
        if (quoted && line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = !quoted;
      } else if (character === "," && !quoted) {
        cells.push(cell);
        cell = "";
      } else cell += character;
    }
    cells.push(cell);
    return cells;
  };
  const rows = lines.slice(1).map(parseCsv);
  const ids = rows.map((row) => row[0] ?? "");
  assertPhase3(
    new Set(ids).size === ids.length,
    "Controlling Phase 3 acceptance matrix contains duplicate identifiers.",
  );
  const moduleIds = ids.filter((id): id is Phase3Criterion =>
    /^M3\.[1-4]-\d{2}$/.test(id),
  );
  assertPhase3(
    JSON.stringify([...moduleIds].sort()) ===
      JSON.stringify([...PHASE3_CRITERIA].sort()),
    `Controlling matrix must contain the exact ${PHASE3_CRITERIA_EXPECTED} Phase 3 module criteria.`,
  );
  assertPhase3(
    ids.length === PHASE3_CRITERIA_EXPECTED + 1 &&
      ids.filter((id) => id === "DX.1-P3").length === 1,
    "Controlling matrix must contain exactly one DX.1-P3 cross-cutting control in addition to the 31 module criteria.",
  );
  assertPhase3(
    rows.every((row) => row[3]?.trim().toLowerCase() === "complete"),
    "Every Phase 3 matrix row, including DX.1-P3, must be Complete before evidence export.",
  );
  return moduleIds;
}
