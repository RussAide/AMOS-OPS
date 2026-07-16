import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import type { M51ACriterionId } from "@contracts/m51a/shared";
import { runM51AIntegratedScenario } from "../api/services/m51a/integrated-scenario";

export const M51A_CRITERION_EVIDENCE_FILES: Readonly<
  Record<M51ACriterionId, string>
> = Object.freeze({
  "M5.1A-AC-01": "M5_1A_OPERATIONS_HUB_TOPOLOGY_RESULT.json",
  "M5.1A-AC-02": "M5_1A_CONTENT_MODEL_HANDLING_LIFECYCLE_RESULT.json",
  "M5.1A-AC-03": "M5_1A_REPOSITORY_INVENTORY_DISPOSITION_RESULT.json",
  "M5.1A-AC-04": "M5_1A_CONNECTOR_REGISTRY_MODES_RESULT.json",
  "M5.1A-AC-05": "M5_1A_STABLE_OBJECT_IDENTITY_RESULT.json",
  "M5.1A-AC-06": "M5_1A_INTRANET_PUBLISHING_RESULT.json",
  "M5.1A-AC-07": "M5_1A_NON_SENSITIVE_PILOT_RESULT.json",
  "M5.1A-AC-08": "M5_1A_INTEGRATED_SCENARIO_RESULT.json",
});

export const M51A_EVIDENCE_FILES = Object.freeze({
  manifest: "M5_1A_ACCEPTANCE_MANIFEST.json",
  summary: "M5_1A_ACCEPTANCE_SUMMARY.md",
  checksums: "M5_1A_SHA256SUMS.txt",
  qa: "M5_1A_INTEGRATED_QA.json",
  schema: "M5_1A_SCHEMA_INTEGRITY.json",
});

export const M51A_BASELINE_CONTROL_FILES = Object.freeze([
  "AGENT_FILE_OWNERSHIP.csv",
  "DEFERRED_SEQUENCE_BACKLOG.md",
  "M5_1A_ACCEPTANCE_MATRIX.csv",
  "M5_1A_BASELINE_GAP_ASSESSMENT.md",
  "M5_1A_INHERITED_BASELINE_VERIFICATION.md",
  "M5_1A_REQUIREMENT_BASELINE.md",
  "M5_1A_SCOPE_BOUNDARY.md",
  "M5_1A_SPRINT_CHARTER.md",
]);

export interface M51aEvidenceOptions {
  root: string;
  output: string;
}

export interface M51aFileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

type M51aIntegratedScenarioResult = Awaited<
  ReturnType<typeof runM51AIntegratedScenario>
>;

export function assertM51a(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function normalizeM51aPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function isM51aPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function parseM51aEvidenceOptions(
  argv: readonly string[],
): M51aEvidenceOptions {
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

export function m51aSourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M5.1A source root is missing under ${root}.`);
}

export function m51aMilestoneRoot(root: string): string {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(m51aSourceRoot(root));
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

export function stableM51aJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function hashM51a(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function atomicWriteM51a(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function m51aFileRecord(
  absolutePath: string,
  label = path.basename(absolutePath),
): M51aFileRecord {
  const contents = fs.readFileSync(absolutePath);
  return Object.freeze({
    path: normalizeM51aPath(label),
    bytes: contents.length,
    sha256: hashM51a(contents),
  });
}

export function m51aControlReferences(
  root: string,
): readonly M51aFileRecord[] {
  const controlsRoot = path.join(m51aMilestoneRoot(root), "controls");
  return Object.freeze(
    M51A_BASELINE_CONTROL_FILES.map((fileName) => {
      const absolute = path.join(controlsRoot, fileName);
      assertM51a(fs.existsSync(absolute), `M5.1A control is missing: ${fileName}`);
      return m51aFileRecord(absolute, `controls/${fileName}`);
    }),
  );
}

function criterionArtifact(
  result: M51aIntegratedScenarioResult,
  criterionId: M51ACriterionId,
  artifacts: Readonly<Record<string, unknown>>,
) {
  const flag = result.acceptanceFlags.find(
    (candidate) => candidate.criterionId === criterionId,
  );
  assertM51a(flag, `M5.1A criterion flag is missing: ${criterionId}`);
  return Object.freeze({
    schemaVersion: "1.0",
    recordId: `AMOS-OPS-${criterionId}-ACCEPTANCE-EVIDENCE`,
    milestone: "M5.1A",
    criterionId,
    passed: flag.passed,
    assertionCount: flag.assertionCount,
    summary: flag.summary,
    evidenceIds: flag.evidenceIds,
    generatedAt: result.executedAt,
    evidenceClass: result.boundary.evidenceClass,
    productionRows: 0 as const,
    liveWrites: 0 as const,
    liveGraphCalls: 0 as const,
    liveMicrosoftWrites: 0 as const,
    usesProductionData: false,
    synthetic: true,
    artifacts,
  });
}

function buildCriterionEvidence(result: M51aIntegratedScenarioResult) {
  return Object.freeze({
    [M51A_CRITERION_EVIDENCE_FILES["M5.1A-AC-01"]]: criterionArtifact(
      result,
      "M5.1A-AC-01",
      {
        architecture: result.hub.architecture,
        architectureCriteria: result.hub.criteria,
        totals: result.hub.totals,
      },
    ),
    [M51A_CRITERION_EVIDENCE_FILES["M5.1A-AC-02"]]: criterionArtifact(
      result,
      "M5.1A-AC-02",
      {
        contentTypes: result.hub.architecture.contentTypes,
        metadataDefinitions: result.hub.architecture.metadataDefinitions,
        handlingClasses: result.hub.architecture.handlingClasses,
        libraries: result.hub.architecture.libraries,
        publishingDecisions: result.hub.publishingDecisions,
      },
    ),
    [M51A_CRITERION_EVIDENCE_FILES["M5.1A-AC-03"]]: criterionArtifact(
      result,
      "M5.1A-AC-03",
      { inventoryDisposition: result.inventory },
    ),
    [M51A_CRITERION_EVIDENCE_FILES["M5.1A-AC-04"]]: criterionArtifact(
      result,
      "M5.1A-AC-04",
      { connectorRegistry: result.connectorRegistry },
    ),
    [M51A_CRITERION_EVIDENCE_FILES["M5.1A-AC-05"]]: criterionArtifact(
      result,
      "M5.1A-AC-05",
      { stableIdentity: result.stableIdentity },
    ),
    [M51A_CRITERION_EVIDENCE_FILES["M5.1A-AC-06"]]: criterionArtifact(
      result,
      "M5.1A-AC-06",
      {
        routes: result.hub.architecture.intranetRoutes,
        roleProjections: result.hub.roleProjections,
        publishingDecisions: result.hub.publishingDecisions,
      },
    ),
    [M51A_CRITERION_EVIDENCE_FILES["M5.1A-AC-07"]]: criterionArtifact(
      result,
      "M5.1A-AC-07",
      { pilot: result.pilot },
    ),
    [M51A_CRITERION_EVIDENCE_FILES["M5.1A-AC-08"]]: criterionArtifact(
      result,
      "M5.1A-AC-08",
      {
        scenarioId: result.scenarioId,
        acceptanceStatement: result.acceptanceStatement,
        accepted: result.accepted,
        acceptanceFlags: result.acceptanceFlags,
        totals: result.totals,
        reliability: result.reliability,
        security: result.security,
        boundary: result.boundary,
      },
    ),
  });
}

function buildSummary(result: M51aIntegratedScenarioResult): string {
  const assertions = result.acceptanceFlags.reduce(
    (total, flag) => total + flag.assertionCount,
    0,
  );
  const rows = result.acceptanceFlags
    .map(
      (flag) =>
        `| ${flag.criterionId} | ${flag.passed ? "PASS" : "FAIL"} | ${flag.assertionCount} | ${flag.summary} |`,
    )
    .join("\n");
  return `# AMOS-OPS M5.1A Acceptance Summary

**Milestone:** M5.1A — Operations Hub and Microsoft DMS Connector Architecture Operational  
**Disposition:** ${result.accepted ? "ACCEPTED" : "NOT ACCEPTED"}  
**Evidence class:** ${result.boundary.evidenceClass}  
**Scenario:** ${result.scenarioId}

| Criterion | Status | Assertions | Result |
|---|---:|---:|---|
${rows}

## Exact acceptance results

- Operations Hub: ${result.totals.sites} governed sites/zones and ${result.totals.libraries} controlled libraries
- Microsoft inventory: ${result.totals.repositories} repositories and ${result.totals.inventoryItems} deterministic inventory items
- Connector operation decisions: ${result.totals.connectorOperationDecisions} across all four exclusive modes
- Stable AMOS object mappings: ${result.totals.stableObjects}
- Non-sensitive pilot: ${result.totals.pilotItems} items reconciled and rolled back
- Permission/security decisions: ${result.totals.securityDecisions}; violations: ${result.totals.securityViolations}
- Acceptance: ${result.totals.passedCriteria}/${result.totals.acceptanceCriteria} criteria across ${assertions} assertions

## Boundary

Fictional records only. Production rows: 0. Real-data records: 0. Live Graph reads: 0. Live Microsoft writes: 0. Live site provisioning: 0. Deployments: 0. GitHub pushes: 0.
`;
}

export async function exportM51aEvidence(options: M51aEvidenceOptions) {
  const sourceRoot = m51aSourceRoot(options.root);
  assertM51a(
    !isM51aPathWithin(sourceRoot, options.output),
    "M5.1A evidence output cannot be inside the canonical source tree.",
  );
  fs.mkdirSync(options.output, { recursive: true });
  const result = await runM51AIntegratedScenario();
  assertM51a(result.accepted, "M5.1A integrated scenario is not accepted.");
  assertM51a(
    result.acceptanceFlags.length === 8 &&
      result.acceptanceFlags.every((flag) => flag.passed),
    "M5.1A does not have eight passing acceptance criteria.",
  );
  const criterionEvidence = buildCriterionEvidence(result);
  for (const [fileName, record] of Object.entries(criterionEvidence))
    atomicWriteM51a(path.join(options.output, fileName), stableM51aJson(record));

  atomicWriteM51a(
    path.join(options.output, M51A_EVIDENCE_FILES.summary),
    buildSummary(result),
  );
  const criterionFiles = Object.values(M51A_CRITERION_EVIDENCE_FILES);
  const inventory = [...criterionFiles, M51A_EVIDENCE_FILES.summary]
    .map((fileName) =>
      m51aFileRecord(path.join(options.output, fileName), fileName),
    )
    .sort((left, right) => left.path.localeCompare(right.path));
  const assertionCount = result.acceptanceFlags.reduce(
    (total, flag) => total + flag.assertionCount,
    0,
  );
  const manifest = Object.freeze({
    schemaVersion: "1.0",
    recordId: "AMOS-OPS-M5.1A-ACCEPTANCE-EVIDENCE",
    milestone: "M5.1A",
    title: "Operations Hub and Microsoft DMS Connector Architecture Operational",
    status: "complete",
    disposition: "ACCEPTED",
    evidenceClass: result.boundary.evidenceClass,
    generatedAt: result.executedAt,
    criteriaExpected: 8,
    criteriaPassed: result.totals.passedCriteria,
    assertionCount,
    accepted: result.accepted,
    acceptanceStatement: result.acceptanceStatement,
    scenarioId: result.scenarioId,
    scenarioSha256: hashM51a(stableM51aJson(result)),
    exactAcceptance: Object.freeze({
      operationsHubTopologyOperational:
        result.acceptanceFlags[0]?.passed === true,
      controlledContentAndHandlingOperational:
        result.acceptanceFlags[1]?.passed === true,
      repositoryInventoryDispositionComplete:
        result.acceptanceFlags[2]?.passed === true,
      connectorRegistryAndModesOperational:
        result.acceptanceFlags[3]?.passed === true,
      stableObjectIdentityResolvesCurrentItems:
        result.acceptanceFlags[4]?.passed === true,
      permissionTrimmedIntranetPublishingOperational:
        result.acceptanceFlags[5]?.passed === true,
      pilotReconciledAndRollbackVerified:
        result.acceptanceFlags[6]?.passed === true,
      integratedSecurityAndResiliencePassed:
        result.acceptanceFlags[7]?.passed === true,
    }),
    syntheticBoundary: Object.freeze({
      ...result.boundary,
      productionRows: 0,
      liveWrites: 0,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
      usesProductionData: false,
    }),
    criterionEvidence: result.acceptanceFlags.map((flag) => ({
      criterionId: flag.criterionId,
      passed: flag.passed,
      assertionCount: flag.assertionCount,
      evidenceFile: M51A_CRITERION_EVIDENCE_FILES[flag.criterionId],
    })),
    controlReferences: m51aControlReferences(options.root),
    inventory,
  });
  atomicWriteM51a(
    path.join(options.output, M51A_EVIDENCE_FILES.manifest),
    stableM51aJson(manifest),
  );
  const checksumRecords = [
    ...inventory,
    m51aFileRecord(
      path.join(options.output, M51A_EVIDENCE_FILES.manifest),
      M51A_EVIDENCE_FILES.manifest,
    ),
  ].sort((left, right) => left.path.localeCompare(right.path));
  atomicWriteM51a(
    path.join(options.output, M51A_EVIDENCE_FILES.checksums),
    `${checksumRecords
      .map((record) => `${record.sha256}  ${record.path}`)
      .join("\n")}\n`,
  );
  return Object.freeze({
    milestone: "M5.1A",
    status: "PASS",
    criteriaPassed: result.totals.passedCriteria,
    criterionArtifacts: criterionFiles.length,
    assertions: assertionCount,
    repositories: result.totals.repositories,
    pilotItems: result.totals.pilotItems,
    securityDecisions: result.totals.securityDecisions,
    securityViolations: result.totals.securityViolations,
    productionRows: 0,
    liveGraphCalls: 0,
    liveWrites: 0,
    output: options.output,
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  pathToFileURL(path.resolve(invokedPath)).href === import.meta.url
) {
  try {
    process.stdout.write(
      stableM51aJson(
        await exportM51aEvidence(
          parseM51aEvidenceOptions(process.argv.slice(2)),
        ),
      ),
    );
  } catch (error) {
    process.stderr.write(
      `M5.1A evidence export failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
