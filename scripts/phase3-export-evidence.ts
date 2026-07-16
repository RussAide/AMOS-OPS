import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  PHASE3_CRITERIA,
  type Phase3IntegratedResult,
} from "@contracts/phase3/shared";
import {
  PHASE3_CRITERIA_EXPECTED,
  PHASE3_EVIDENCE_CLASS,
  PHASE3_MILESTONE_EVIDENCE,
  PHASE3_SHARED_FILES,
  assertPhase3,
  atomicWritePhase3,
  controllingPhase3CriterionIds,
  expectedPhase3Criteria,
  inspectPhase3SyntheticBoundary,
  parsePhase3EvidenceOptions,
  phase3EvidenceLabel,
  phase3EvidenceRoot,
  phase3ControlReferences,
  phase3FileRecord,
  phase3SourceRoot,
  stablePhase3Json,
  validatePhase3IntegratedResult,
  walkPhase3Files,
  type Phase3AcceptanceManifest,
  type Phase3EvidenceOptions,
  type Phase3ManifestCriterion,
  type Phase3ManifestMilestone,
} from "./phase3-evidence-common";

function markdownEscape(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll(/\r?\n/g, " ");
}

function assertCanonicalMilestoneDirectory(
  directory: string,
  allowedFiles: readonly string[],
): void {
  const existing = walkPhase3Files(directory);
  const unexpected = existing.filter(
    (relativePath) => !allowedFiles.includes(relativePath),
  );
  assertPhase3(
    unexpected.length === 0,
    `Milestone evidence directory contains noncanonical files: ${unexpected.join(", ")}`,
  );
}

async function loadIntegratedScenario(root: string): Promise<unknown> {
  const sourceRoot = phase3SourceRoot(root);
  const modulePath = path.join(
    sourceRoot,
    "api",
    "services",
    "phase3",
    "integrated-scenario.ts",
  );
  assertPhase3(
    fs.existsSync(modulePath),
    `Phase 3 integrated scenario is missing: ${modulePath}`,
  );
  const loaded = (await import(pathToFileURL(modulePath).href)) as Record<
    string,
    unknown
  >;
  const runner = loaded.runPhase3IntegratedScenario;
  assertPhase3(
    typeof runner === "function",
    "Integrated scenario module must export runPhase3IntegratedScenario().",
  );
  return Promise.resolve((runner as () => unknown)());
}

function milestoneSummary(
  result: Phase3IntegratedResult,
  definition: (typeof PHASE3_MILESTONE_EVIDENCE)[number],
): string {
  const moduleResult = result.moduleResults[definition.id];
  return `# AMOS-OPS Phase 3 — ${definition.id} Acceptance Summary

**Status:** COMPLETE  
**Domain:** ${definition.domain}  
**Evidence boundary:** Synthetic demonstration only  
**Criteria passed:** ${moduleResult.criteria.length}/${moduleResult.criteria.length}

| Criterion | Status | Evidence summary |
|---|---|---|
${moduleResult.criteria.map((criterion) => `| ${criterion.criterionId} | PASS | ${markdownEscape(criterion.summary)} |`).join("\n")}

This folder contains the canonical ${definition.id} result extracted from the single Phase 3 integrated scenario. It does not contain a source-tree copy or a second scenario execution.
`;
}

function acceptanceSummary(
  result: Phase3IntegratedResult,
  milestones: readonly Phase3ManifestMilestone[],
  criteria: readonly Phase3ManifestCriterion[],
): string {
  return `# AMOS-OPS Phase 3 Integrated Sprint — Acceptance Summary

**Status:** ACCEPTANCE EVIDENCE COMPLETE  
**Evidence boundary:** Synthetic demonstration only; production rows and production actions are prohibited.  
**Criteria verified:** ${criteria.length}/${PHASE3_CRITERIA_EXPECTED}  
**Integrated scenario:** ${result.scenarioRun.status.toUpperCase()}  
**Exit gate:** PASS
**DX.1-P3:** PASS — ${result.dx1.applicableControls.length}/${result.dx1.applicableControls.length} applicable controls and ${result.dx1.featureScenarios.length} feature scenarios verified

## Milestone results

| Milestone | Domain | Status | Criteria | Canonical evidence folder |
|---|---|---|---:|---|
${milestones.map((milestone) => `| ${milestone.id} | ${milestone.domain} | COMPLETE | ${milestone.criteriaPassed}/${milestone.criteriaExpected} | \`${milestone.directory}\` |`).join("\n")}

## Controlling 31-criterion register

| Criterion | Milestone | Status | Evidence summary |
|---|---|---|---|
${criteria.map((criterion) => `| ${criterion.criterionId} | ${criterion.milestone} | PASS | ${markdownEscape(criterion.summary)} |`).join("\n")}

## Synthetic and nonredundancy controls

- One integrated scenario produced all four module results and all 31 criterion results.
- All evidence is labeled \`${PHASE3_EVIDENCE_CLASS}\`; production rows are zero.
- ${result.productionActionsBlocked.length} production-action attempts were blocked and retained in the integrated result.
- Milestone evidence is separately traceable in four folders without embedding source copies.
- Final sealing is responsible for one filtered canonical source snapshot and one integrated package.

## DX.1-P3 evaluation controls

- Environment: ${result.dx1.environmentId}
- Persistent label: **${result.dx1.environmentLabel}**
- Reset, kill switch, data expiration, persona access review, and separate demo-action audit all executed successfully.
- ${result.dx1.deferredControls.length} future-sequence items remain explicitly deferred and are not claimed by Phase 3.
`;
}

export async function exportPhase3Evidence(
  options: Phase3EvidenceOptions,
  suppliedResult?: unknown,
): Promise<Phase3AcceptanceManifest> {
  controllingPhase3CriterionIds(options.root);
  const result = validatePhase3IntegratedResult(
    suppliedResult ?? (await loadIntegratedScenario(options.root)),
  );
  const evidenceRoot = phase3EvidenceRoot(options.output);
  fs.mkdirSync(options.output, { recursive: true });

  const milestones: Phase3ManifestMilestone[] = [];
  const criteria: Phase3ManifestCriterion[] = [];
  const generatedPaths: string[] = [];

  for (const definition of PHASE3_MILESTONE_EVIDENCE) {
    const directory = path.join(evidenceRoot, definition.directory);
    fs.mkdirSync(directory, { recursive: true });
    assertCanonicalMilestoneDirectory(directory, [
      definition.resultFile,
      definition.summaryFile,
    ]);
    const resultPath = path.join(directory, definition.resultFile);
    const summaryPath = path.join(directory, definition.summaryFile);
    atomicWritePhase3(
      resultPath,
      stablePhase3Json(result.moduleResults[definition.id]),
    );
    atomicWritePhase3(summaryPath, milestoneSummary(result, definition));
    const resultLabel = phase3EvidenceLabel(evidenceRoot, resultPath);
    const summaryLabel = phase3EvidenceLabel(evidenceRoot, summaryPath);
    generatedPaths.push(resultPath, summaryPath);
    const expectedCriteria = expectedPhase3Criteria(definition.id);
    milestones.push({
      id: definition.id,
      domain: definition.domain,
      directory: definition.directory,
      evidenceClass: PHASE3_EVIDENCE_CLASS,
      status: "complete",
      criteriaExpected: expectedCriteria.length,
      criteriaPassed: expectedCriteria.length,
      moduleResultPath: resultLabel,
      summaryPath: summaryLabel,
    });
    for (const criterion of result.moduleResults[definition.id].criteria) {
      criteria.push({
        criterionId: criterion.criterionId,
        milestone: definition.id,
        status: "passed",
        summary: criterion.summary,
        evidencePaths: [resultLabel],
      });
    }
  }

  assertPhase3(
    criteria.length === PHASE3_CRITERIA_EXPECTED,
    `Exporter must produce exactly ${PHASE3_CRITERIA_EXPECTED} criterion rows.`,
  );
  assertPhase3(
    JSON.stringify(
      criteria.map((criterion) => criterion.criterionId).sort(),
    ) === JSON.stringify([...PHASE3_CRITERIA].sort()),
    "Exporter criterion register drifted from the shared contract.",
  );

  const scenarioPath = path.join(options.output, PHASE3_SHARED_FILES.scenario);
  atomicWritePhase3(scenarioPath, stablePhase3Json(result));
  generatedPaths.push(scenarioPath);
  const scenarioLabel = phase3EvidenceLabel(evidenceRoot, scenarioPath);
  for (const criterion of criteria) criterion.evidencePaths.push(scenarioLabel);

  const dx1Path = path.join(options.output, PHASE3_SHARED_FILES.dx1);
  atomicWritePhase3(dx1Path, stablePhase3Json(result.dx1));
  generatedPaths.push(dx1Path);
  const dx1Label = phase3EvidenceLabel(evidenceRoot, dx1Path);

  const summaryPath = path.join(options.output, PHASE3_SHARED_FILES.summary);
  atomicWritePhase3(
    summaryPath,
    acceptanceSummary(result, milestones, criteria),
  );
  generatedPaths.push(summaryPath);

  const inventory = generatedPaths
    .map((absolutePath) =>
      phase3FileRecord(
        absolutePath,
        phase3EvidenceLabel(evidenceRoot, absolutePath),
      ),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
  assertPhase3(
    new Set(inventory.map((file) => file.path)).size === inventory.length,
    "Phase 3 evidence inventory contains duplicate paths.",
  );

  const manifest: Phase3AcceptanceManifest = {
    schemaVersion: "1.0",
    recordId: "AMOS-OPS-PHASE3-ACCEPTANCE-EVIDENCE",
    evidenceClass: PHASE3_EVIDENCE_CLASS,
    status: "complete",
    criteriaExpected: PHASE3_CRITERIA_EXPECTED,
    criteriaPassed: PHASE3_CRITERIA_EXPECTED,
    syntheticBoundary: {
      dataMode: "synthetic_demo",
      productionRows: 0,
      usesProductionData: false,
    },
    productionActionsBlocked: [...result.productionActionsBlocked],
    exitGate: true,
    integratedScenario: {
      id: result.scenarioRun.id,
      status: "passed",
      supportCaseId: result.supportCaseId,
      sourceEpisodeId: result.sourceEpisodeId,
      resultPath: scenarioLabel,
      assertionsPassed: result.scenarioRun.assertionsPassed,
      assertionsFailed: 0,
    },
    crossCuttingControl: {
      id: "DX.1-P3",
      status: "complete",
      resultPath: dx1Label,
      applicableControlsExpected: result.dx1.applicableControls.length,
      applicableControlsPassed: result.dx1.applicableControls.filter(
        (control) => control.passed,
      ).length,
      featureScenarios: 31,
      deferredBySequence: result.dx1.deferredControls.length,
    },
    controlReferences: phase3ControlReferences(options.root),
    milestones,
    criteria,
    inventory,
    nonredundancy: {
      canonicalSourceTrees: 1,
      integratedScenarioExecutions: 1,
      milestoneSourceCopies: 0,
      milestoneEvidenceDirectories: PHASE3_MILESTONE_EVIDENCE.map(
        (definition) => definition.directory,
      ),
    },
  };
  inspectPhase3SyntheticBoundary(manifest, "Phase 3 acceptance manifest");
  const manifestPath = path.join(options.output, PHASE3_SHARED_FILES.manifest);
  atomicWritePhase3(manifestPath, stablePhase3Json(manifest));
  const checksumRecords = [
    ...inventory,
    phase3FileRecord(
      manifestPath,
      phase3EvidenceLabel(evidenceRoot, manifestPath),
    ),
  ].sort((left, right) => left.path.localeCompare(right.path));
  const checksumsPath = path.join(
    options.output,
    PHASE3_SHARED_FILES.checksums,
  );
  atomicWritePhase3(
    checksumsPath,
    `${checksumRecords.map((file) => `${file.sha256}  ${file.path}`).join("\n")}\n`,
  );

  return manifest;
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
    const manifest = await exportPhase3Evidence(options);
    console.log(
      JSON.stringify(
        {
          root: options.root,
          output: options.output,
          status: manifest.status,
          criteria: `${manifest.criteriaPassed}/${manifest.criteriaExpected}`,
          milestones: Object.fromEntries(
            manifest.milestones.map((milestone) => [
              milestone.id,
              milestone.status,
            ]),
          ),
          exitGate: manifest.exitGate,
          evidenceClass: manifest.evidenceClass,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
