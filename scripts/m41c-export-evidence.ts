import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

export const M41C_CRITERIA = [
  "M4.1C-01",
  "M4.1C-02",
  "M4.1C-03",
  "M4.1C-04",
  "M4.1C-05",
  "M4.1C-06",
  "M4.1C-07",
  "M4.1C-08",
  "M4.1C-09",
  "M4.1C-10",
  "M4.1C-11",
  "M4.1C-12",
  "M4.1C-13",
  "M4.1C-14",
  "M4.1C-15",
  "M4.1C-16",
  "M4.1C-17",
  "M4.1C-18",
] as const;

export type M41cCriterionId = (typeof M41C_CRITERIA)[number];

export const M41C_EVIDENCE_FILES = {
  scenario: "M4_1C_INTEGRATED_SCENARIO_RESULT.json",
  clinicalGovernance: "M4_1C_CLINICAL_GOVERNANCE_RESULT.json",
  knowledgeRegistry: "M4_1C_KNOWLEDGE_REGISTRY_RESULT.json",
  profileSeparation: "M4_1C_INSTRUMENT_PROFILE_SEPARATION_RESULT.json",
  logicQuarantine: "M4_1C_UNAPPROVED_LOGIC_QUARANTINE_RESULT.json",
  instrumentValidation: "M4_1C_INSTRUMENT_VALIDATION_RESULT.json",
  pathwayOrchestration: "M4_1C_PATHWAY_ORCHESTRATION_RESULT.json",
  texasTrr: "M4_1C_TEXAS_TRR_RESULT.json",
  suicideCrisis: "M4_1C_SUICIDE_CRISIS_PATHWAY_RESULT.json",
  youthPathwayPack: "M4_1C_YOUTH_PATHWAY_PACK_RESULT.json",
  medicationSafety: "M4_1C_MEDICATION_PHYSICAL_HEALTH_SAFETY_RESULT.json",
  continuumEpisode: "M4_1C_CONTINUUM_EPISODE_RESULT.json",
  askAmosEia: "M4_1C_ASK_AMOS_EIA_CLINICAL_RESULT.json",
  fiveCadence: "M4_1C_FIVE_CADENCE_CLINICAL_WORKPLAN_RESULT.json",
  mappings: "M4_1C_CMBHS_FHIR_MAPPING_RESULT.json",
  accessProvenance: "M4_1C_CLINICAL_ACCESS_PROVENANCE_RESULT.json",
  syntheticScenarios: "M4_1C_SYNTHETIC_PATHWAY_SCENARIO_RESULT.json",
  testsMonitoring: "M4_1C_CLINICAL_TEST_MONITORING_RESULT.json",
  competency: "M4_1C_COMPETENCY_CERTIFICATION_RESULT.json",
  manifest: "M4_1C_ACCEPTANCE_MANIFEST.json",
  summary: "M4_1C_ACCEPTANCE_SUMMARY.md",
  checksums: "M4_1C_SHA256SUMS.txt",
  qa: "M4_1C_INTEGRATED_QA.json",
  migration: "M4_1C_MIGRATION_VERIFICATION.json",
} as const;

export const M41C_CRITERION_EVIDENCE_FILES: Readonly<
  Record<M41cCriterionId, string>
> = Object.freeze({
  "M4.1C-01": M41C_EVIDENCE_FILES.clinicalGovernance,
  "M4.1C-02": M41C_EVIDENCE_FILES.knowledgeRegistry,
  "M4.1C-03": M41C_EVIDENCE_FILES.profileSeparation,
  "M4.1C-04": M41C_EVIDENCE_FILES.logicQuarantine,
  "M4.1C-05": M41C_EVIDENCE_FILES.instrumentValidation,
  "M4.1C-06": M41C_EVIDENCE_FILES.pathwayOrchestration,
  "M4.1C-07": M41C_EVIDENCE_FILES.texasTrr,
  "M4.1C-08": M41C_EVIDENCE_FILES.suicideCrisis,
  "M4.1C-09": M41C_EVIDENCE_FILES.youthPathwayPack,
  "M4.1C-10": M41C_EVIDENCE_FILES.medicationSafety,
  "M4.1C-11": M41C_EVIDENCE_FILES.continuumEpisode,
  "M4.1C-12": M41C_EVIDENCE_FILES.askAmosEia,
  "M4.1C-13": M41C_EVIDENCE_FILES.fiveCadence,
  "M4.1C-14": M41C_EVIDENCE_FILES.mappings,
  "M4.1C-15": M41C_EVIDENCE_FILES.accessProvenance,
  "M4.1C-16": M41C_EVIDENCE_FILES.syntheticScenarios,
  "M4.1C-17": M41C_EVIDENCE_FILES.testsMonitoring,
  "M4.1C-18": M41C_EVIDENCE_FILES.competency,
});

export const M41C_EXACT_ACCEPTANCE_KEYS = [
  "governedVersionedPathwayCatalog",
  "longitudinalYouthRecord",
  "allFiveCadences",
  "trrDfpsProfilesDistinct",
  "unapprovedLogicProductionBlocked",
  "everyRecommendationSourcedAndHumanGated",
  "allSyntheticScenariosPassed",
  "everyActivatedPathwaySigned",
] as const;

const REQUIRED_CADENCES = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
] as const;

const REQUIRED_PROHIBITED_ACTIONS = [
  "production_care_update",
  "diagnosis",
  "autonomous_level_of_care_assignment",
  "prescribing",
  "medication_authorization",
  "autonomous_discharge",
  "claims_submission",
  "external_disclosure",
  "cmbhs_write",
] as const;

const M41C_CONTROL_REFERENCES = [
  "controls/AGENT_FILE_OWNERSHIP.csv",
  "controls/DEFERRED_SEQUENCE_BACKLOG.md",
  "controls/M4_1C_ACCEPTANCE_MATRIX.csv",
  "controls/M4_1C_REQUIREMENT_BASELINE.md",
  "controls/M4_1C_SCOPE_BOUNDARY.md",
  "controls/M4_1C_SPRINT_CHARTER.md",
  "controls/M4_1C_OFFICIAL_SOURCE_AUTHORITY_REGISTER.md",
  "controls/M4_1C_BASELINE_GAP_ASSESSMENT.md",
  "controls/M4_1C_INHERITED_BASELINE_VERIFICATION.md",
  "controls/M4_1C_INHERITED_FILE_HASHES.sha256",
  "../M4.1B_Executive_Intelligence_Assistant_and_Workplan_Orchestration_Operational/evidence/M4_1B_ACCEPTANCE_MANIFEST.json",
] as const;

interface CriterionResult {
  criterionId: M41cCriterionId;
  passed: boolean;
  summary: string;
  evidenceIds: readonly string[];
}

interface CriterionEvidence extends CriterionResult {
  assertions: readonly unknown[];
  artifacts: Readonly<Record<string, unknown>>;
  productionRows: 0;
  liveWrites: 0;
  evidenceClass: "synthetic_clinical_demo";
}

export interface M41cAcceptanceScenarioResult {
  milestone: "M4.1C";
  scenarioId: string;
  startedAt: string;
  completedAt: string;
  environment: {
    syntheticDataOnly: true;
    productionActivationAvailable: false;
    liveClinicalDecisionAvailable: false;
    externalWritesAvailable: false;
    prohibitedActions: readonly string[];
  };
  representedDivisions: readonly string[];
  representedCadences: readonly string[];
  recommendationIds: readonly string[];
  auditEventIds: readonly string[];
  criteria: readonly CriterionResult[];
  exitGate: true;
  productionRows: 0;
  liveWrites: 0;
  evidenceClass: "synthetic_clinical_demo";
  snapshot: unknown;
  workplans: readonly unknown[];
  guidanceResponses: readonly unknown[];
  scenarioRuns: readonly Record<string, unknown>[];
  exactAcceptance: Readonly<
    Record<(typeof M41C_EXACT_ACCEPTANCE_KEYS)[number], boolean>
  >;
  criterionEvidence: Readonly<Record<M41cCriterionId, CriterionEvidence>>;
}

export interface M41cEvidenceOptions {
  root: string;
  output: string;
}

export interface M41cFileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

export function assertM41c(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function normalizeM41cPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function isM41cPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function parseM41cEvidenceOptions(
  argv: readonly string[],
): M41cEvidenceOptions {
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
    } else positional.push(argument);
  }
  root ??= positional[0] ?? "..";
  const resolvedRoot = path.resolve(root);
  output ??= positional[1] ?? path.join(resolvedRoot, "evidence");
  return { root: resolvedRoot, output: path.resolve(output) };
}

export function m41cSourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.1C source root is missing under ${root}.`);
}

export function m41cMilestoneRoot(root: string): string {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(m41cSourceRoot(root));
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

export function stableM41cJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function atomicWriteM41c(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function hashM41cBuffer(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function m41cFileRecord(
  absolutePath: string,
  label = path.basename(absolutePath),
): M41cFileRecord {
  const contents = fs.readFileSync(absolutePath);
  return {
    path: normalizeM41cPath(label),
    bytes: contents.length,
    sha256: hashM41cBuffer(contents),
  };
}

export function readM41cJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function inspectM41cSyntheticBoundary(
  value: unknown,
  source: string,
): void {
  const dangerousTrueKeys = new Set([
    "productionactivationavailable",
    "liveclinicaldecisionavailable",
    "externalwritesavailable",
    "productionactionavailable",
    "productionuseenabled",
    "externalwriteattempted",
    "externalwritesucceeded",
  ]);
  const visit = (candidate: unknown, pointer: string): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach((child, index) => visit(child, `${pointer}[${index}]`));
      return;
    }
    if (!candidate || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(
      candidate as Record<string, unknown>,
    )) {
      const normalized = key.toLowerCase().replaceAll("_", "");
      const childPointer = `${pointer}.${key}`;
      if (normalized === "evidenceclass")
        assertM41c(
          child === "synthetic_clinical_demo" ||
            child === "synthetic_demo" ||
            child === null,
          `${source} contains non-synthetic evidence at ${childPointer}.`,
        );
      if (normalized === "productionrows" || normalized === "livewrites")
        assertM41c(
          child === 0,
          `${source} reports production rows or live writes at ${childPointer}.`,
        );
      if (normalized === "usesproductiondata")
        assertM41c(
          child === false,
          `${source} reports production-data use at ${childPointer}.`,
        );
      if (dangerousTrueKeys.has(normalized))
        assertM41c(
          child === false,
          `${source} enables a prohibited production capability at ${childPointer}.`,
        );
      visit(child, childPointer);
    }
  };
  visit(value, "$");
}

function sameSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    JSON.stringify([...left].sort()) === JSON.stringify([...right].sort())
  );
}

export function validateM41cScenario(
  value: unknown,
): M41cAcceptanceScenarioResult {
  assertM41c(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "M4.1C integrated scenario returned no result object.",
  );
  const result = value as Partial<M41cAcceptanceScenarioResult>;
  inspectM41cSyntheticBoundary(result, "M4.1C integrated scenario");
  assertM41c(
    result.milestone === "M4.1C" &&
      result.evidenceClass === "synthetic_clinical_demo" &&
      result.productionRows === 0 &&
      result.liveWrites === 0,
    "M4.1C scenario identity or synthetic data boundary drifted.",
  );
  assertM41c(
    typeof result.scenarioId === "string" &&
      result.scenarioId.startsWith("SYNTH-") &&
      typeof result.startedAt === "string" &&
      Number.isFinite(Date.parse(result.startedAt)) &&
      typeof result.completedAt === "string" &&
      Number.isFinite(Date.parse(result.completedAt)) &&
      Date.parse(result.completedAt) >= Date.parse(result.startedAt),
    "M4.1C scenario identity or execution timestamps are invalid.",
  );
  assertM41c(result.exitGate === true, "M4.1C exit gate is not passing.");
  assertM41c(
    result.environment?.syntheticDataOnly === true &&
      result.environment.productionActivationAvailable === false &&
      result.environment.liveClinicalDecisionAvailable === false &&
      result.environment.externalWritesAvailable === false &&
      sameSet(
        result.environment.prohibitedActions,
        REQUIRED_PROHIBITED_ACTIONS,
      ),
    "M4.1C environment does not retain the complete synthetic clinical boundary.",
  );
  assertM41c(
    Array.isArray(result.representedCadences) &&
      JSON.stringify(result.representedCadences) ===
        JSON.stringify(REQUIRED_CADENCES),
    "M4.1C must represent daily, weekly, monthly, quarterly, and annual cadences exactly once.",
  );
  assertM41c(
    Array.isArray(result.representedDivisions) &&
      result.representedDivisions.length > 0 &&
      new Set(result.representedDivisions).size ===
        result.representedDivisions.length,
    "M4.1C represented divisions are missing or duplicated.",
  );
  assertM41c(
    Array.isArray(result.criteria) &&
      JSON.stringify(result.criteria.map((row) => row.criterionId).sort()) ===
        JSON.stringify([...M41C_CRITERIA].sort()) &&
      result.criteria.every(
        (row) =>
          row.passed === true &&
          typeof row.summary === "string" &&
          row.summary.trim().length > 0 &&
          Array.isArray(row.evidenceIds) &&
          row.evidenceIds.length > 0,
      ),
    "M4.1C must pass exactly 18 controlling criteria with linked evidence.",
  );
  assertM41c(
    result.exactAcceptance !== undefined &&
      JSON.stringify(Object.keys(result.exactAcceptance).sort()) ===
        JSON.stringify([...M41C_EXACT_ACCEPTANCE_KEYS].sort()) &&
      M41C_EXACT_ACCEPTANCE_KEYS.every(
        (key) => result.exactAcceptance?.[key] === true,
      ),
    "M4.1C exact acceptance assertions are incomplete or failing.",
  );
  assertM41c(
    result.criterionEvidence !== undefined &&
      JSON.stringify(Object.keys(result.criterionEvidence).sort()) ===
        JSON.stringify([...M41C_CRITERIA].sort()),
    "M4.1C criterion evidence must contain exactly 18 rows.",
  );
  for (const criterionId of M41C_CRITERIA) {
    const criterion = result.criteria.find(
      (candidate) => candidate.criterionId === criterionId,
    );
    const evidence = result.criterionEvidence[criterionId];
    assertM41c(
      evidence?.criterionId === criterionId &&
        evidence.passed === true &&
        evidence.summary === criterion?.summary &&
        stableM41cJson(evidence.evidenceIds) ===
          stableM41cJson(criterion?.evidenceIds) &&
        Array.isArray(evidence.assertions) &&
        evidence.assertions.length > 0 &&
        evidence.artifacts !== null &&
        typeof evidence.artifacts === "object" &&
        !Array.isArray(evidence.artifacts) &&
        Object.keys(evidence.artifacts).length > 0 &&
        evidence.productionRows === 0 &&
        evidence.liveWrites === 0 &&
        evidence.evidenceClass === "synthetic_clinical_demo",
      `M4.1C criterion evidence is incomplete or drifted: ${criterionId}`,
    );
  }
  assertM41c(
    Array.isArray(result.scenarioRuns) &&
      result.scenarioRuns.length === 11 &&
      result.scenarioRuns.every(
        (run) =>
          run.status === "passed" &&
          run.productionRows === 0 &&
          run.liveWrites === 0 &&
          run.evidenceClass === "synthetic_clinical_demo",
      ),
    "M4.1C must execute and pass all 11 deterministic synthetic pathway scenarios.",
  );
  assertM41c(
    Array.isArray(result.workplans) && result.workplans.length > 0,
    "M4.1C five-cadence clinical workplan evidence is missing.",
  );
  assertM41c(
    Array.isArray(result.guidanceResponses) &&
      result.guidanceResponses.length > 0,
    "M4.1C Ask AMOS and EIA clinical guidance evidence is missing.",
  );
  assertM41c(
    Array.isArray(result.recommendationIds) &&
      result.recommendationIds.length > 0 &&
      Array.isArray(result.auditEventIds) &&
      result.auditEventIds.length > 0,
    "M4.1C recommendation or audit lineage is missing.",
  );
  assertM41c(
    result.snapshot !== null && typeof result.snapshot === "object",
    "M4.1C integrated experience snapshot is missing.",
  );
  return result as M41cAcceptanceScenarioResult;
}

export async function loadM41cScenario(root: string): Promise<unknown> {
  const modulePath = path.join(
    m41cSourceRoot(root),
    "api",
    "services",
    "m41c",
    "index.ts",
  );
  assertM41c(
    fs.existsSync(modulePath),
    `M4.1C service entry point is missing: ${modulePath}`,
  );
  const loaded = (await import(pathToFileURL(modulePath).href)) as Record<
    string,
    unknown
  >;
  const runner = loaded.runM41cIntegratedScenario;
  assertM41c(
    typeof runner === "function",
    "M4.1C service must export runM41cIntegratedScenario().",
  );
  return Promise.resolve((runner as () => unknown)());
}

export function m41cControlReferences(root: string): M41cFileRecord[] {
  const milestoneRoot = m41cMilestoneRoot(root);
  const allowedParent = path.dirname(milestoneRoot);
  return M41C_CONTROL_REFERENCES.map((repoPath) => {
    const absolute = path.resolve(milestoneRoot, repoPath);
    assertM41c(
      isM41cPathWithin(allowedParent, absolute),
      `M4.1C control reference escapes the milestone repository: ${repoPath}`,
    );
    assertM41c(
      fs.existsSync(absolute) && fs.statSync(absolute).isFile(),
      `M4.1C control reference is missing: ${repoPath}`,
    );
    return m41cFileRecord(absolute, repoPath);
  }).sort((left, right) => left.path.localeCompare(right.path));
}

function parseCsvRow(value: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '"') {
      if (quoted && value[index + 1] === '"') {
        field += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else field += character;
  }
  assertM41c(!quoted, "M4.1C acceptance matrix contains an unclosed quote.");
  fields.push(field);
  return fields;
}

export function validateM41cAcceptanceMatrix(root: string) {
  const matrixPath = path.join(
    m41cMilestoneRoot(root),
    "controls",
    "M4_1C_ACCEPTANCE_MATRIX.csv",
  );
  const lines = fs
    .readFileSync(matrixPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  assertM41c(lines.length > 1, "M4.1C acceptance matrix is empty.");
  const headers = parseCsvRow(lines[0]);
  const criterionIndex = headers.indexOf("criterion_id");
  const evidencePathIndex = headers.indexOf("evidence_path");
  const evidenceFileIndex = headers.indexOf("evidence_file");
  const statusIndex = headers.indexOf("status");
  assertM41c(
    criterionIndex >= 0 &&
      (evidencePathIndex >= 0 || evidenceFileIndex >= 0) &&
      statusIndex >= 0,
    "M4.1C acceptance matrix is missing criterion_id, evidence_path/evidence_file, or status.",
  );
  const rows = lines.slice(1).map((line) => {
    const fields = parseCsvRow(line);
    const criterionId = fields[criterionIndex] as M41cCriterionId;
    const rawPath =
      evidencePathIndex >= 0
        ? fields[evidencePathIndex]
        : `evidence/${fields[evidenceFileIndex]}`;
    return {
      criterionId,
      evidencePath: normalizeM41cPath(rawPath),
      status: fields[statusIndex],
    };
  });
  assertM41c(
    rows.length === M41C_CRITERIA.length &&
      new Set(rows.map((row) => row.criterionId)).size ===
        M41C_CRITERIA.length &&
      M41C_CRITERIA.every((criterionId) => {
        const row = rows.find(
          (candidate) => candidate.criterionId === criterionId,
        );
        return (
          row?.evidencePath ===
            `evidence/${M41C_CRITERION_EVIDENCE_FILES[criterionId]}` &&
          row.status.trim().toLowerCase() === "complete"
        );
      }),
    "M4.1C acceptance matrix must contain 18 unique Complete rows mapped to the exact criterion artifacts.",
  );
  return rows;
}

export function buildM41cEvidenceReports(
  result: M41cAcceptanceScenarioResult,
): Readonly<Record<string, unknown>> {
  return Object.freeze(
    Object.fromEntries(
      M41C_CRITERIA.map((criterionId) => {
        const evidence = result.criterionEvidence[criterionId];
        return [
          M41C_CRITERION_EVIDENCE_FILES[criterionId],
          {
            schemaVersion: "1.0",
            milestone: "M4.1C",
            criterionId,
            passed: true,
            evidenceClass: "synthetic_clinical_demo",
            acceptance: result.criteria.find(
              (criterion) => criterion.criterionId === criterionId,
            ),
            productionRows: 0,
            liveWrites: 0,
            evidence,
          },
        ];
      }),
    ),
  );
}

export function buildM41cSummary(result: M41cAcceptanceScenarioResult): string {
  const rows = result.criteria
    .map(
      (criterion) =>
        `| ${criterion.criterionId} | PASS | ${criterion.summary.replaceAll("|", "\\|")} | ${M41C_CRITERION_EVIDENCE_FILES[criterion.criterionId]} |`,
    )
    .join("\n");
  return `# AMOS-OPS M4.1C — Acceptance Summary

**Milestone:** Clinical Intelligence Fabric Operational  
**Status:** COMPLETE  
**Evidence boundary:** Synthetic clinical demonstration only  
**Criteria verified:** 18/18  
**Synthetic scenarios:** ${result.scenarioRuns.length}/11 passed  
**Operating cadences:** daily, weekly, monthly, quarterly, annual  
**Exit gate:** PASS  
**Production rows:** 0  
**Live writes:** 0

| Criterion | Status | Evidence summary | Evidence artifact |
|---|---|---|---|
${rows}

## Exact acceptance

- Governed, versioned pathway catalog: PASS
- Longitudinal youth record: PASS
- Five-cadence clinical workplans: PASS
- Texas TRR and DFPS CANS 3.0 profiles remain distinct: PASS
- Unapproved logic is blocked from production use: PASS
- Every recommendation is sourced and human-gated: PASS
- All deterministic synthetic scenarios passed: PASS
- Every demo-activated pathway has a signed validation record: PASS

This evidence set does not contain real youth or clinical data, does not enable production clinical decisions, and performs no external or live writes.
`;
}

export async function exportM41cEvidence(
  options: M41cEvidenceOptions,
  suppliedResult?: unknown,
) {
  const result = validateM41cScenario(
    suppliedResult ?? (await loadM41cScenario(options.root)),
  );
  assertM41c(
    !isM41cPathWithin(m41cSourceRoot(options.root), options.output),
    "M4.1C evidence output cannot be written inside the canonical source tree.",
  );
  fs.mkdirSync(options.output, { recursive: true });

  atomicWriteM41c(
    path.join(options.output, M41C_EVIDENCE_FILES.scenario),
    stableM41cJson(result),
  );
  const reports = buildM41cEvidenceReports(result);
  for (const [fileName, report] of Object.entries(reports))
    atomicWriteM41c(
      path.join(options.output, fileName),
      stableM41cJson(report),
    );
  atomicWriteM41c(
    path.join(options.output, M41C_EVIDENCE_FILES.summary),
    buildM41cSummary(result),
  );

  const inventoryNames = [
    M41C_EVIDENCE_FILES.scenario,
    ...Object.keys(reports),
    M41C_EVIDENCE_FILES.summary,
  ].sort();
  const inventory = inventoryNames.map((fileName) =>
    m41cFileRecord(path.join(options.output, fileName), fileName),
  );
  const manifest = {
    schemaVersion: "1.0",
    recordId: "AMOS-OPS-M4.1C-ACCEPTANCE-EVIDENCE",
    milestone: "M4.1C",
    title: "Clinical Intelligence Fabric Operational",
    status: "complete",
    evidenceClass: "synthetic_clinical_demo",
    criteriaExpected: 18,
    criteriaPassed: 18,
    exitGate: true,
    syntheticBoundary: {
      dataMode: "synthetic_clinical_demo",
      syntheticDataOnly: true,
      productionRows: 0,
      liveWrites: 0,
      usesProductionData: false,
      productionActivationAvailable: false,
      liveClinicalDecisionAvailable: false,
      externalWritesAvailable: false,
      prohibitedActions: result.environment.prohibitedActions,
    },
    scenario: {
      scenarioId: result.scenarioId,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      resultPath: M41C_EVIDENCE_FILES.scenario,
      deterministicReplayRequired: true,
    },
    exactAcceptance: result.exactAcceptance,
    criteria: result.criteria,
    criterionEvidence: validateM41cAcceptanceMatrix(options.root),
    coverage: {
      divisions: result.representedDivisions,
      cadences: result.representedCadences,
      workplans: result.workplans.length,
      guidanceResponses: result.guidanceResponses.length,
      recommendations: result.recommendationIds.length,
      auditEvents: result.auditEventIds.length,
      syntheticScenarios: result.scenarioRuns.length,
    },
    controlReferences: m41cControlReferences(options.root),
    inventory,
    nonredundancy: {
      canonicalSourceTrees: 1,
      integratedScenarioExecutions: 1,
      sourceCopiesInEvidence: 0,
      duplicateCriterionArtifacts: 0,
    },
  } as const;
  const manifestPath = path.join(options.output, M41C_EVIDENCE_FILES.manifest);
  atomicWriteM41c(manifestPath, stableM41cJson(manifest));
  const checksumRecords = [
    ...inventory,
    m41cFileRecord(manifestPath, M41C_EVIDENCE_FILES.manifest),
  ].sort((left, right) => left.path.localeCompare(right.path));
  atomicWriteM41c(
    path.join(options.output, M41C_EVIDENCE_FILES.checksums),
    `${checksumRecords
      .map((record) => `${record.sha256}  ${record.path}`)
      .join("\n")}\n`,
  );
  return manifest;
}

const isMain =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    console.log(
      JSON.stringify(
        await exportM41cEvidence(
          parseM41cEvidenceOptions(process.argv.slice(2)),
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
