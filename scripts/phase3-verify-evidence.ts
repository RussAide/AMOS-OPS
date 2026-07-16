import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  PHASE3_CRITERIA,
  PHASE3_DX1_APPLICABLE_CONTROLS,
  PHASE3_MILESTONES,
} from "@contracts/phase3/shared";
import {
  PHASE3_CRITERIA_EXPECTED,
  PHASE3_EVIDENCE_CLASS,
  PHASE3_MILESTONE_EVIDENCE,
  PHASE3_SHARED_FILES,
  assertPhase3,
  controllingPhase3CriterionIds,
  expectedPhase3Criteria,
  inspectPhase3SyntheticBoundary,
  parsePhase3EvidenceOptions,
  phase3EvidenceLabel,
  phase3EvidenceRoot,
  phase3ControlReferences,
  phase3FileRecord,
  readPhase3Json,
  resolvePhase3EvidencePath,
  stablePhase3Json,
  validatePhase3IntegratedResult,
  walkPhase3Files,
  type Phase3AcceptanceManifest,
  type Phase3EvidenceOptions,
} from "./phase3-evidence-common";

export interface Phase3EvidenceVerificationResult {
  verified: true;
  status: "complete";
  criteriaPassed: 31;
  criteriaExpected: 31;
  milestones: Record<string, "complete">;
  exitGate: true;
  productionActionsBlocked: number;
  filesVerified: number;
  dx1: "complete";
  evidenceClass: "synthetic_demo";
}

function sameStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return JSON.stringify([...left].sort()) === JSON.stringify([...right].sort());
}

function readChecksumRegister(filePath: string): Map<string, string> {
  const lines = fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  const result = new Map<string, string>();
  for (const line of lines) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertPhase3(match, `Invalid Phase 3 checksum-register line: ${line}`);
    assertPhase3(
      !result.has(match[2]),
      `Phase 3 checksum register repeats ${match[2]}.`,
    );
    result.set(match[2], match[1]);
  }
  return result;
}

export function verifyPhase3Evidence(
  options: Phase3EvidenceOptions,
): Phase3EvidenceVerificationResult {
  controllingPhase3CriterionIds(options.root);
  const evidenceRoot = phase3EvidenceRoot(options.output);
  const manifestPath = path.join(options.output, PHASE3_SHARED_FILES.manifest);
  const summaryPath = path.join(options.output, PHASE3_SHARED_FILES.summary);
  const checksumPath = path.join(options.output, PHASE3_SHARED_FILES.checksums);
  const scenarioPath = path.join(options.output, PHASE3_SHARED_FILES.scenario);
  const dx1Path = path.join(options.output, PHASE3_SHARED_FILES.dx1);
  for (const requiredPath of [
    manifestPath,
    summaryPath,
    checksumPath,
    scenarioPath,
    dx1Path,
  ]) {
    assertPhase3(
      fs.existsSync(requiredPath) && fs.statSync(requiredPath).isFile(),
      `Phase 3 consolidated evidence file is missing: ${requiredPath}`,
    );
  }

  const manifest = readPhase3Json(manifestPath) as Phase3AcceptanceManifest;
  inspectPhase3SyntheticBoundary(manifest, "Phase 3 acceptance manifest");
  assertPhase3(
    manifest.schemaVersion === "1.0",
    "Unsupported Phase 3 acceptance-manifest schema version.",
  );
  assertPhase3(
    manifest.recordId === "AMOS-OPS-PHASE3-ACCEPTANCE-EVIDENCE",
    "Phase 3 acceptance record identity drifted.",
  );
  assertPhase3(
    manifest.evidenceClass === PHASE3_EVIDENCE_CLASS,
    "Phase 3 acceptance manifest is not synthetic_demo.",
  );
  assertPhase3(
    manifest.status === "complete",
    "Phase 3 acceptance manifest is not complete.",
  );
  assertPhase3(
    manifest.criteriaExpected === PHASE3_CRITERIA_EXPECTED,
    `Phase 3 manifest must expect exactly ${PHASE3_CRITERIA_EXPECTED} criteria.`,
  );
  assertPhase3(
    manifest.criteriaPassed === PHASE3_CRITERIA_EXPECTED,
    `Phase 3 manifest must report ${PHASE3_CRITERIA_EXPECTED} passed criteria.`,
  );
  assertPhase3(
    manifest.syntheticBoundary?.dataMode === "synthetic_demo",
    "Phase 3 data mode is not synthetic_demo.",
  );
  assertPhase3(
    manifest.syntheticBoundary?.productionRows === 0,
    "Phase 3 acceptance manifest reports production rows.",
  );
  assertPhase3(
    manifest.syntheticBoundary?.usesProductionData === false,
    "Phase 3 acceptance manifest reports production-data use.",
  );
  assertPhase3(
    Array.isArray(manifest.productionActionsBlocked) &&
      manifest.productionActionsBlocked.length > 0,
    "Phase 3 acceptance manifest has no blocked production actions.",
  );
  assertPhase3(
    manifest.productionActionsBlocked.every(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    ),
    "Phase 3 blocked-production-action register is invalid.",
  );
  assertPhase3(
    new Set(manifest.productionActionsBlocked).size ===
      manifest.productionActionsBlocked.length,
    "Phase 3 blocked-production-action register has duplicates.",
  );
  assertPhase3(
    manifest.exitGate === true,
    "Phase 3 manifest exit gate is not passing.",
  );
  assertPhase3(
    manifest.crossCuttingControl?.id === "DX.1-P3" &&
      manifest.crossCuttingControl.status === "complete" &&
      manifest.crossCuttingControl.applicableControlsExpected ===
        PHASE3_DX1_APPLICABLE_CONTROLS.length &&
      manifest.crossCuttingControl.applicableControlsPassed ===
        PHASE3_DX1_APPLICABLE_CONTROLS.length &&
      manifest.crossCuttingControl.featureScenarios === 31 &&
      manifest.crossCuttingControl.deferredBySequence === 2,
    "DX.1-P3 manifest gate is incomplete.",
  );
  assertPhase3(
    stablePhase3Json(manifest.controlReferences) ===
      stablePhase3Json(phase3ControlReferences(options.root)),
    "Phase 3 controlling metric, parity, or accepted M1.3 reference hash drifted.",
  );

  assertPhase3(
    Array.isArray(manifest.criteria) &&
      manifest.criteria.length === PHASE3_CRITERIA_EXPECTED,
    `Phase 3 manifest must contain exactly ${PHASE3_CRITERIA_EXPECTED} criterion records.`,
  );
  const manifestCriterionIds = manifest.criteria.map(
    (criterion) => criterion.criterionId,
  );
  assertPhase3(
    new Set(manifestCriterionIds).size === PHASE3_CRITERIA_EXPECTED,
    "Phase 3 manifest criterion identifiers are duplicated.",
  );
  assertPhase3(
    sameStrings(manifestCriterionIds, PHASE3_CRITERIA),
    "Phase 3 manifest criteria drifted from the shared contract.",
  );
  assertPhase3(
    manifest.criteria.every((criterion) => criterion.status === "passed"),
    "Every Phase 3 manifest criterion must be passed.",
  );

  assertPhase3(
    Array.isArray(manifest.milestones) &&
      manifest.milestones.length === PHASE3_MILESTONES.length,
    "Phase 3 manifest must contain four milestone records.",
  );
  assertPhase3(
    sameStrings(
      manifest.milestones.map((milestone) => milestone.id),
      PHASE3_MILESTONES,
    ),
    "Phase 3 manifest milestone register drifted.",
  );
  const scenario = validatePhase3IntegratedResult(readPhase3Json(scenarioPath));
  const scenarioLabel = phase3EvidenceLabel(evidenceRoot, scenarioPath);
  const dx1 = readPhase3Json(dx1Path);
  const dx1Label = phase3EvidenceLabel(evidenceRoot, dx1Path);
  assertPhase3(
    manifest.crossCuttingControl.resultPath === dx1Label,
    "DX.1-P3 result path drifted.",
  );
  assertPhase3(
    stablePhase3Json(dx1) === stablePhase3Json(scenario.dx1),
    "DX.1-P3 result differs from the integrated scenario.",
  );
  assertPhase3(
    manifest.integratedScenario?.resultPath === scenarioLabel,
    "Phase 3 integrated-scenario path drifted.",
  );
  assertPhase3(
    manifest.integratedScenario.id === scenario.scenarioRun.id,
    "Phase 3 integrated-scenario identity drifted.",
  );
  assertPhase3(
    manifest.integratedScenario.status === "passed",
    "Phase 3 integrated scenario is not passing in the manifest.",
  );
  assertPhase3(
    manifest.integratedScenario.supportCaseId === scenario.supportCaseId,
    "Phase 3 support-case lineage drifted.",
  );
  assertPhase3(
    manifest.integratedScenario.sourceEpisodeId === scenario.sourceEpisodeId,
    "Phase 3 source-episode lineage drifted.",
  );
  assertPhase3(
    manifest.integratedScenario.assertionsFailed === 0 &&
      manifest.integratedScenario.assertionsPassed ===
        scenario.scenarioRun.assertionsPassed,
    "Phase 3 scenario assertion register drifted.",
  );
  assertPhase3(
    JSON.stringify(manifest.productionActionsBlocked) ===
      JSON.stringify(scenario.productionActionsBlocked),
    "Phase 3 blocked-production-action evidence drifted from the integrated scenario.",
  );
  assertPhase3(
    scenario.exitGate === true,
    "Phase 3 integrated scenario exit gate is not passing.",
  );

  const canonicalPayloadLabels: string[] = [
    scenarioLabel,
    dx1Label,
    phase3EvidenceLabel(evidenceRoot, summaryPath),
  ];
  for (const definition of PHASE3_MILESTONE_EVIDENCE) {
    const milestone = manifest.milestones.find(
      (candidate) => candidate.id === definition.id,
    );
    assertPhase3(milestone, `${definition.id} manifest milestone is missing.`);
    const expectedCriteria = expectedPhase3Criteria(definition.id);
    assertPhase3(
      milestone.domain === definition.domain,
      `${definition.id} manifest domain drifted.`,
    );
    assertPhase3(
      milestone.directory === definition.directory,
      `${definition.id} evidence-directory identity drifted.`,
    );
    assertPhase3(
      milestone.evidenceClass === PHASE3_EVIDENCE_CLASS &&
        milestone.status === "complete",
      `${definition.id} synthetic acceptance gate is not complete.`,
    );
    assertPhase3(
      milestone.criteriaExpected === expectedCriteria.length &&
        milestone.criteriaPassed === expectedCriteria.length,
      `${definition.id} criterion count drifted.`,
    );
    const directory = path.join(evidenceRoot, definition.directory);
    assertPhase3(
      fs.existsSync(directory) && fs.statSync(directory).isDirectory(),
      `${definition.id} evidence directory is missing.`,
    );
    assertPhase3(
      sameStrings(walkPhase3Files(directory), [
        definition.resultFile,
        definition.summaryFile,
      ]),
      `${definition.id} evidence directory contains missing or unmanifested files.`,
    );
    const resultPath = path.join(directory, definition.resultFile);
    const moduleSummaryPath = path.join(directory, definition.summaryFile);
    const resultLabel = phase3EvidenceLabel(evidenceRoot, resultPath);
    const moduleSummaryLabel = phase3EvidenceLabel(
      evidenceRoot,
      moduleSummaryPath,
    );
    assertPhase3(
      milestone.moduleResultPath === resultLabel &&
        milestone.summaryPath === moduleSummaryLabel,
      `${definition.id} canonical evidence paths drifted.`,
    );
    const moduleResult = readPhase3Json(resultPath);
    inspectPhase3SyntheticBoundary(
      moduleResult,
      `${definition.id} module result`,
    );
    assertPhase3(
      stablePhase3Json(moduleResult) ===
        stablePhase3Json(scenario.moduleResults[definition.id]),
      `${definition.id} module result differs from the single integrated scenario.`,
    );
    canonicalPayloadLabels.push(resultLabel, moduleSummaryLabel);
    const milestoneCriteria = manifest.criteria.filter(
      (criterion) => criterion.milestone === definition.id,
    );
    assertPhase3(
      milestoneCriteria.length === expectedCriteria.length,
      `${definition.id} manifest criterion allocation drifted.`,
    );
    assertPhase3(
      sameStrings(
        milestoneCriteria.map((criterion) => criterion.criterionId),
        expectedCriteria,
      ),
      `${definition.id} manifest criteria do not match the shared contract.`,
    );
    for (const criterion of milestoneCriteria) {
      const scenarioCriterion = scenario.moduleResults[
        definition.id
      ].criteria.find(
        (candidate) => candidate.criterionId === criterion.criterionId,
      );
      assertPhase3(
        scenarioCriterion?.passed === true,
        `${criterion.criterionId} is not passing in the integrated scenario.`,
      );
      assertPhase3(
        criterion.summary === scenarioCriterion.summary,
        `${criterion.criterionId} evidence summary drifted.`,
      );
      assertPhase3(
        sameStrings(criterion.evidencePaths, [resultLabel, scenarioLabel]),
        `${criterion.criterionId} does not point to both canonical module and integrated evidence.`,
      );
    }
  }

  assertPhase3(
    manifest.nonredundancy?.canonicalSourceTrees === 1,
    "Phase 3 nonredundancy requires one canonical source tree.",
  );
  assertPhase3(
    manifest.nonredundancy.integratedScenarioExecutions === 1,
    "Phase 3 nonredundancy requires one integrated scenario execution.",
  );
  assertPhase3(
    manifest.nonredundancy.milestoneSourceCopies === 0,
    "Phase 3 milestone evidence must not contain source copies.",
  );
  assertPhase3(
    sameStrings(
      manifest.nonredundancy.milestoneEvidenceDirectories,
      PHASE3_MILESTONE_EVIDENCE.map((definition) => definition.directory),
    ),
    "Phase 3 milestone evidence-directory register drifted.",
  );

  assertPhase3(
    Array.isArray(manifest.inventory),
    "Phase 3 evidence inventory is missing.",
  );
  const inventoryPaths = manifest.inventory.map((file) => file.path);
  assertPhase3(
    new Set(inventoryPaths).size === inventoryPaths.length,
    "Phase 3 evidence inventory contains duplicate paths.",
  );
  assertPhase3(
    sameStrings(inventoryPaths, canonicalPayloadLabels),
    "Phase 3 evidence inventory differs from the canonical milestone, scenario, and summary payloads.",
  );
  for (const file of manifest.inventory) {
    const absolute = resolvePhase3EvidencePath(evidenceRoot, file.path);
    assertPhase3(
      fs.existsSync(absolute) && fs.statSync(absolute).isFile(),
      `Phase 3 inventory file is missing: ${file.path}`,
    );
    const actual = phase3FileRecord(absolute, file.path);
    assertPhase3(
      actual.bytes === file.bytes && actual.sha256 === file.sha256,
      `Phase 3 inventory byte/hash mismatch: ${file.path}`,
    );
    if (file.path.endsWith(".json"))
      inspectPhase3SyntheticBoundary(readPhase3Json(absolute), file.path);
  }

  const checksumMap = readChecksumRegister(checksumPath);
  const manifestLabel = phase3EvidenceLabel(evidenceRoot, manifestPath);
  assertPhase3(
    sameStrings([...checksumMap.keys()], [...inventoryPaths, manifestLabel]),
    "Phase 3 checksum register differs from the evidence inventory plus manifest.",
  );
  for (const [label, expectedHash] of checksumMap) {
    const absolute = resolvePhase3EvidencePath(evidenceRoot, label);
    assertPhase3(
      fs.existsSync(absolute) && fs.statSync(absolute).isFile(),
      `Checksummed Phase 3 file is missing: ${label}`,
    );
    assertPhase3(
      phase3FileRecord(absolute, label).sha256 === expectedHash,
      `Phase 3 checksum mismatch: ${label}`,
    );
  }

  return {
    verified: true,
    status: "complete",
    criteriaPassed: 31,
    criteriaExpected: 31,
    milestones: Object.fromEntries(
      PHASE3_MILESTONES.map((milestone) => [milestone, "complete"]),
    ) as Record<string, "complete">,
    exitGate: true,
    productionActionsBlocked: scenario.productionActionsBlocked.length,
    filesVerified: checksumMap.size,
    dx1: "complete",
    evidenceClass: "synthetic_demo",
  };
}

function isMainModule(): boolean {
  const entry = process.argv[1];
  return (
    entry !== undefined &&
    pathToFileURL(path.resolve(entry)).href === import.meta.url
  );
}

if (isMainModule()) {
  try {
    const options = parsePhase3EvidenceOptions(process.argv.slice(2));
    console.log(JSON.stringify(verifyPhase3Evidence(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
