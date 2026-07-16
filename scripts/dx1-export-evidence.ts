import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  DX1_CRITERION_IDS,
  DX1_EVALUATED_AT,
  DX1_EXACT_ACCEPTANCE_STATEMENT,
  DX1_MILESTONE,
  runDx1IntegratedScenario,
  type Dx1CriterionId,
  type Dx1ExperienceGovernanceResult,
  type Dx1IntelligencePlatformStreamResult,
  type Dx1SecurityPilotResult,
} from "../api/services/dx1";
import {
  DX1_BASELINE_CONTROL_FILES,
  DX1_CRITERION_EVIDENCE_FILES,
  DX1_EVIDENCE_FILES,
  assertDx1Evidence,
  atomicWriteDx1,
  dx1FileRecord,
  dx1MilestoneRoot,
  dx1SourceRoot,
  hashDx1,
  isDx1PathWithin,
  parseDx1EvidenceOptions,
  stableDx1Json,
} from "./dx1-evidence-common";

type IntegratedResult = ReturnType<typeof runDx1IntegratedScenario>;

function streamViews(result: IntegratedResult) {
  return {
    experience: result.streams.experience as Dx1ExperienceGovernanceResult,
    intelligence:
      result.streams.intelligence as Dx1IntelligencePlatformStreamResult,
    pilot: result.streams.pilot as Dx1SecurityPilotResult,
  };
}

function criterionArtifacts(result: IntegratedResult, criterionId: Dx1CriterionId) {
  const { experience, intelligence, pilot } = streamViews(result);
  switch (criterionId) {
    case "DX.1-01":
      return {
        workspaces: experience.workspaces,
        personaAssignments: experience.personaAssignments,
      };
    case "DX.1-02":
      return { workflows: experience.workflows };
    case "DX.1-03":
      return { dms: intelligence.dms };
    case "DX.1-04":
      return { agents: intelligence.agents };
    case "DX.1-05":
      return { nil: intelligence.nil };
    case "DX.1-06":
      return { dashboards: intelligence.dashboards };
    case "DX.1-07":
      return { microsoft: intelligence.microsoft };
    case "DX.1-08":
      return {
        accessDecisions: pilot.accessDecisions,
        deniedAttempts: pilot.deniedAttempts,
        partialSideEffectCount: pilot.partialSideEffectCount,
      };
    case "DX.1-09":
      return { frontlineWalkthroughs: experience.frontlineWalkthroughs };
    case "DX.1-10":
      return {
        stages: pilot.stages,
        attempts: pilot.attempts,
        traceFingerprint: pilot.traceFingerprint,
      };
    case "DX.1-11":
      return {
        guidanceAtWork: experience.guidanceAtWork,
        issueSupport: experience.issueSupport,
      };
    case "DX.1-12":
      return { releaseGovernance: experience.releaseGovernance };
  }
}

function controlReferences(root: string) {
  const controlsRoot = path.join(dx1MilestoneRoot(root), "controls");
  return Object.freeze(
    DX1_BASELINE_CONTROL_FILES.map((name) => {
      const absolute = path.join(controlsRoot, name);
      assertDx1Evidence(fs.existsSync(absolute), `DX.1 control is missing: ${name}`);
      return dx1FileRecord(absolute, `controls/${name}`);
    }),
  );
}

function acceptanceSummary(result: IntegratedResult): string {
  const rows = result.criteria
    .map(
      (criterion) =>
        `| ${criterion.criterionId} | ${criterion.status} | ${criterion.assertionIds.length} | ${criterion.summary} |`,
    )
    .join("\n");
  const { experience, intelligence, pilot } = streamViews(result);
  return `# AMOS-OPS DX.1 Acceptance Summary

**Milestone:** DX.1 — Final Cross-Enterprise Demo Verification  
**Disposition:** ${result.acceptance}  
**Scenario:** ${result.scenarioId}  
**Evidence class:** SYNTHETIC PROTOTYPE

| Criterion | Status | Assertions | Result |
|---|---|---:|---|
${rows}

## Integrated result

- All ${result.criteria.length}/12 criteria are Complete.
- ${result.assertionCount} deterministic assertions passed across three disjoint streams.
- ${result.auditEvents.length} unique audit events retain the one correlated scenario identity.
- ${experience.workspaces.length} enterprise workspaces, ${experience.personaAssignments.length} persona routes, ${experience.workflows.length} governed pilot workflows, and ${experience.frontlineWalkthroughs.length} frontline walkthroughs reconciled.
- AMOS-DMS completed ${intelligence.dms.actions.length}/8 required lifecycle actions; the active agent registry, relationship-aware NIL, five dashboard domains, and Microsoft support-layer boundary passed.
- The pilot completed ${pilot.completedStageCount}/8 stages with ${pilot.deniedAttempts.length} held or denied adversarial attempts and ${pilot.partialSideEffectCount} partial business side effects.
- Production rows, live connector calls, live Microsoft reads/writes, production scoring or level-of-care activations, notifications, deployments, and GitHub pushes: all zero.

## Acceptance statement

${DX1_EXACT_ACCEPTANCE_STATEMENT}
`;
}

export function exportDx1Evidence(options: {
  readonly root: string;
  readonly output: string;
}) {
  const sourceRoot = dx1SourceRoot(options.root);
  assertDx1Evidence(
    !isDx1PathWithin(sourceRoot, options.output),
    "DX.1 evidence output cannot be inside the canonical source tree.",
  );
  fs.mkdirSync(options.output, { recursive: true });
  const result = runDx1IntegratedScenario();
  assertDx1Evidence(result.accepted, "DX.1 integrated scenario is not accepted.");
  assertDx1Evidence(result.criteria.length === 12, "DX.1 criterion count is not 12.");
  assertDx1Evidence(
    result.criteria.every((criterion) => criterion.status === "Complete"),
    "DX.1 has an incomplete criterion.",
  );

  atomicWriteDx1(
    path.join(options.output, DX1_EVIDENCE_FILES.integrated),
    stableDx1Json(result),
  );
  atomicWriteDx1(
    path.join(options.output, DX1_EVIDENCE_FILES.audit),
    stableDx1Json({
      schemaVersion: "1.0",
      recordId: "AMOS-OPS-DX1-CORRELATED-AUDIT-HISTORY",
      scenarioId: result.scenarioId,
      eventCount: result.auditEvents.length,
      events: result.auditEvents,
      generatedAt: DX1_EVALUATED_AT,
      synthetic: true,
    }),
  );
  const pilot = streamViews(result).pilot;
  atomicWriteDx1(
    path.join(options.output, DX1_EVIDENCE_FILES.pilot),
    stableDx1Json({
      schemaVersion: "1.0",
      recordId: "AMOS-OPS-DX1-EIGHT-STAGE-PILOT-TRACE",
      scenarioId: result.scenarioId,
      completedStageCount: pilot.completedStageCount,
      stages: pilot.stages,
      attempts: pilot.attempts,
      traceFingerprint: pilot.traceFingerprint,
      partialSideEffectCount: pilot.partialSideEffectCount,
      generatedAt: DX1_EVALUATED_AT,
      synthetic: true,
    }),
  );

  for (const criterionId of DX1_CRITERION_IDS) {
    const criterion = result.criteria.find(
      (candidate) => candidate.criterionId === criterionId,
    );
    assertDx1Evidence(criterion, `DX.1 criterion result is missing: ${criterionId}`);
    atomicWriteDx1(
      path.join(options.output, DX1_CRITERION_EVIDENCE_FILES[criterionId]),
      stableDx1Json({
        schemaVersion: "1.0",
        recordId: `AMOS-OPS-${criterionId}-ACCEPTANCE-EVIDENCE`,
        milestone: DX1_MILESTONE,
        criterionId,
        status: criterion.status,
        passed: criterion.status === "Complete",
        assertionCount: criterion.assertionIds.length,
        assertionIds: criterion.assertionIds,
        evidenceIds: criterion.evidenceIds,
        summary: criterion.summary,
        generatedAt: DX1_EVALUATED_AT,
        boundary: result.boundary,
        artifacts: criterionArtifacts(result, criterionId),
      }),
    );
  }

  atomicWriteDx1(
    path.join(options.output, DX1_EVIDENCE_FILES.summary),
    acceptanceSummary(result),
  );

  const inheritedPath = path.join(options.output, DX1_EVIDENCE_FILES.inherited);
  assertDx1Evidence(
    fs.existsSync(inheritedPath),
    "DX.1 inherited M5.2 evidence must be generated before acceptance export.",
  );
  const coreNames = [
    DX1_EVIDENCE_FILES.inherited,
    DX1_EVIDENCE_FILES.integrated,
    DX1_EVIDENCE_FILES.audit,
    DX1_EVIDENCE_FILES.pilot,
    DX1_EVIDENCE_FILES.summary,
    ...DX1_CRITERION_IDS.map(
      (criterionId) => DX1_CRITERION_EVIDENCE_FILES[criterionId],
    ),
  ];
  const records = coreNames.map((name) =>
    dx1FileRecord(path.join(options.output, name), `evidence/${name}`),
  );
  const manifest = Object.freeze({
    schemaVersion: "1.0",
    manifestId: "AMOS-OPS-DX1-ACCEPTANCE-MANIFEST-V1.0",
    milestone: DX1_MILESTONE,
    scenarioId: result.scenarioId,
    acceptance: result.acceptance,
    accepted: result.accepted,
    criteriaComplete: result.criteria.length,
    criteriaExpected: DX1_CRITERION_IDS.length,
    assertionCount: result.assertionCount,
    auditEventCount: result.auditEvents.length,
    pilotStagesComplete: pilot.completedStageCount,
    generatedAt: DX1_EVALUATED_AT,
    acceptanceStatement: DX1_EXACT_ACCEPTANCE_STATEMENT,
    records,
    controls: controlReferences(options.root),
    boundary: result.boundary,
    usesProductionData: false,
    synthetic: true,
  });
  atomicWriteDx1(
    path.join(options.output, DX1_EVIDENCE_FILES.manifest),
    stableDx1Json(manifest),
  );

  const checksumNames = [...coreNames, DX1_EVIDENCE_FILES.manifest].sort();
  const checksumLines = checksumNames.map((name) => {
    const contents = fs.readFileSync(path.join(options.output, name));
    return `${hashDx1(contents)}  ${name}`;
  });
  atomicWriteDx1(
    path.join(options.output, DX1_EVIDENCE_FILES.checksums),
    `${checksumLines.join("\n")}\n`,
  );

  return Object.freeze({
    manifest,
    evidenceFiles: checksumNames.length + 1,
    checksumEntries: checksumNames.length,
  });
}

const options = parseDx1EvidenceOptions(process.argv.slice(2));
const exported = exportDx1Evidence(options);
process.stdout.write(`${JSON.stringify(exported, null, 2)}\n`);

