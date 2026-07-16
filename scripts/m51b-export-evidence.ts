import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import type { M51BCriterionId } from "@contracts/m51b/shared";
import { runM51BIntegratedScenario } from "../api/services/m51b/integration/integrated-scenario";

export const M51B_CRITERION_EVIDENCE_FILES: Readonly<
  Record<M51BCriterionId, string>
> = Object.freeze({
  "M5.1B-AC-01": "M5_1B_INHERITED_M5_1A_RESULT.json",
  "M5.1B-AC-02": "M5_1B_INTEGRATION_GOVERNANCE_RESULT.json",
  "M5.1B-AC-03": "M5_1B_TEAMS_NOTIFICATION_RESULT.json",
  "M5.1B-AC-04": "M5_1B_OUTLOOK_REFERRAL_INTAKE_RESULT.json",
  "M5.1B-AC-05": "M5_1B_SHAREPOINT_SYNC_RESULT.json",
  "M5.1B-AC-06": "M5_1B_IDENTITY_ACCESS_SECRET_RESULT.json",
  "M5.1B-AC-07": "M5_1B_RELIABILITY_RECOVERY_RESULT.json",
  "M5.1B-AC-08": "M5_1B_INTEGRATED_SCENARIO_RESULT.json",
});

export const M51B_EVIDENCE_FILES = Object.freeze({
  manifest: "M5_1B_ACCEPTANCE_MANIFEST.json",
  summary: "M5_1B_ACCEPTANCE_SUMMARY.md",
  checksums: "M5_1B_SHA256SUMS.txt",
  qa: "M5_1B_INTEGRATED_QA.json",
  schema: "M5_1B_SCHEMA_INTEGRITY.json",
});

export const M51B_BASELINE_CONTROL_FILES = Object.freeze([
  "AGENT_FILE_OWNERSHIP.csv",
  "DEFERRED_SEQUENCE_BACKLOG.md",
  "M5_1B_ACCEPTANCE_MATRIX.csv",
  "M5_1B_ACCESS_SUPPORT_REVIEW.md",
  "M5_1B_BASELINE_GAP_ASSESSMENT.md",
  "M5_1B_IMPLEMENTATION_REGISTER.md",
  "M5_1B_INHERITED_BASELINE_VERIFICATION.md",
  "M5_1B_INTEGRATION_CONTRACT_REGISTER.md",
  "M5_1B_REQUIREMENT_BASELINE.md",
  "M5_1B_SCOPE_BOUNDARY.md",
  "M5_1B_SPRINT_CHARTER.md",
  "M5_1B_TEST_PLAN.md",
  "M5_1B_TRACEABILITY_MATRIX.csv",
]);

export interface M51BEvidenceOptions {
  root: string;
  output: string;
}

export interface M51BFileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

type IntegratedResult = Awaited<ReturnType<typeof runM51BIntegratedScenario>>;

export function assertM51B(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function stableM51BJson(value: unknown): string {
  const stable = (child: unknown): unknown => {
    if (Array.isArray(child)) return child.map(stable);
    if (!child || typeof child !== "object") return child;
    return Object.fromEntries(
      Object.entries(child as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => [key, stable(value)]),
    );
  };
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

export function hashM51B(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function atomicWriteM51B(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function parseM51BEvidenceOptions(
  argv: readonly string[],
): M51BEvidenceOptions {
  let root = "..";
  let output: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") root = argv[++index] ?? "";
    else if (argument === "--output") output = argv[++index];
    else throw new Error(`Unknown M5.1B evidence option: ${argument}`);
  }
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    output: path.resolve(output ?? path.join(resolvedRoot, "evidence")),
  };
}

export function m51bSourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M5.1B source root is missing under ${root}.`);
}

export function m51bMilestoneRoot(root: string): string {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(m51bSourceRoot(root));
}

export function isM51BPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function m51bFileRecord(
  absolutePath: string,
  label = path.basename(absolutePath),
): M51BFileRecord {
  const contents = fs.readFileSync(absolutePath);
  return Object.freeze({
    path: label.split(path.sep).join("/"),
    bytes: contents.length,
    sha256: hashM51B(contents),
  });
}

function controlReferences(root: string): readonly M51BFileRecord[] {
  const controlsRoot = path.join(m51bMilestoneRoot(root), "controls");
  return Object.freeze(
    M51B_BASELINE_CONTROL_FILES.map((name) => {
      const absolute = path.join(controlsRoot, name);
      assertM51B(fs.existsSync(absolute), `M5.1B control is missing: ${name}`);
      return m51bFileRecord(absolute, `controls/${name}`);
    }),
  );
}

function criterionArtifact(
  result: IntegratedResult,
  criterionId: M51BCriterionId,
  artifacts: Readonly<Record<string, unknown>>,
) {
  const flag = result.acceptanceFlags.find(
    (candidate) => candidate.criterionId === criterionId,
  );
  assertM51B(flag, `M5.1B criterion flag is missing: ${criterionId}`);
  return Object.freeze({
    schemaVersion: "1.0",
    recordId: `AMOS-OPS-${criterionId}-ACCEPTANCE-EVIDENCE`,
    milestone: "M5.1B",
    criterionId,
    passed: flag.passed,
    assertionCount: flag.assertionCount,
    summary: flag.summary,
    evidenceIds: flag.evidenceIds,
    generatedAt: result.executedAt,
    evidenceClass: result.boundary.evidenceClass,
    productionRows: 0 as const,
    liveGraphCalls: 0 as const,
    liveMicrosoftReads: 0 as const,
    liveMicrosoftWrites: 0 as const,
    realNotificationsSent: 0 as const,
    liveWrites: 0 as const,
    usesProductionData: false,
    synthetic: true,
    artifacts,
  });
}

export function buildM51BCriterionEvidence(result: IntegratedResult) {
  return Object.freeze({
    [M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-01"]]: criterionArtifact(
      result,
      "M5.1B-AC-01",
      { inherited: result.inherited },
    ),
    [M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-02"]]: criterionArtifact(
      result,
      "M5.1B-AC-02",
      { governance: result.governance },
    ),
    [M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-03"]]: criterionArtifact(
      result,
      "M5.1B-AC-03",
      { teams: result.teams },
    ),
    [M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-04"]]: criterionArtifact(
      result,
      "M5.1B-AC-04",
      { outlook: result.outlook },
    ),
    [M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-05"]]: criterionArtifact(
      result,
      "M5.1B-AC-05",
      { sharepoint: result.sharepoint },
    ),
    [M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-06"]]: criterionArtifact(
      result,
      "M5.1B-AC-06",
      {
        contracts: result.governance.contracts.map((contract) => ({
          contractId: contract.contractId,
          channel: contract.channel,
          tenantBoundary: contract.tenantBoundary,
          identity: contract.identity,
          leastPrivilegeScopes: contract.leastPrivilegeScopes,
          managedSecretReference: contract.managedSecretReference,
          secretMaterialPresent: contract.secretMaterialPresent,
          productionCredentialReadAvailable:
            contract.productionCredentialReadAvailable,
          accessReview: contract.accessReview,
        })),
      },
    ),
    [M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-07"]]: criterionArtifact(
      result,
      "M5.1B-AC-07",
      {
        channelRecovery: {
          teams: {
            originalFailure: result.teams.persistentOutageDelivery,
            recovery: result.teams.outageRecovery,
            operationalState: result.teams.operationalState,
          },
          outlook: {
            originalFailure: result.outlook.outage,
            recovery: result.outlook.recovery,
            recoverySnapshot: result.outlook.recoverySnapshot,
          },
          sharepoint: result.sharepoint.exhaustedFailureRecovery,
        },
        sharedReliability: result.reliability,
      },
    ),
    [M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-08"]]: criterionArtifact(
      result,
      "M5.1B-AC-08",
      {
        scenarioId: result.scenarioId,
        acceptanceStatement: result.acceptanceStatement,
        accepted: result.accepted,
        acceptanceFlags: result.acceptanceFlags,
        totals: result.totals,
        boundary: result.boundary,
      },
    ),
  });
}

function summary(result: IntegratedResult): string {
  const rows = result.acceptanceFlags
    .map(
      (flag) =>
        `| ${flag.criterionId} | ${flag.passed ? "PASS" : "FAIL"} | ${flag.assertionCount} | ${flag.summary} |`,
    )
    .join("\n");
  return `# AMOS-OPS M5.1B Acceptance Summary

**Milestone:** M5.1B — Microsoft 365 Integration Operational  
**Disposition:** ${result.accepted ? "ACCEPTED" : "NOT ACCEPTED"}  
**Evidence class:** ${result.boundary.evidenceClass}  
**Scenario:** ${result.scenarioId}

| Criterion | Status | Assertions | Result |
|---|---:|---:|---|
${rows}

## Exact operational results

- Inherited M5.1A: ${result.inherited.criteriaPassed}/${result.inherited.criteriaExpected} criteria remain accepted.
- Teams notification: ${result.teams.primaryDelivery.timing.elapsedMilliseconds} ms against a 30,000 ms limit; acknowledgement recorded.
- Outlook referral: ${result.outlook.primarySnapshot.metrics.intakeCount} intake created; duplicate replay prevented.
- SharePoint synchronization: ${result.sharepoint.elapsedSeconds} seconds against a 300-second limit; all ${Object.values(result.sharepoint.gateDecision.gates).length} governance gates passed.
- Reliability: ${result.reliability.snapshot.recoveredDeadLetters} dead letter recovered, ${result.reliability.snapshot.openDeadLetters} open, ${result.reliability.snapshot.duplicateDeliveries} duplicate deliveries.
- Acceptance: ${result.totals.passedCriteria}/${result.totals.acceptanceCriteria} criteria across ${result.totals.assertionCount} assertions.

## Boundary

Fictional records only. Production rows: 0. Live Graph calls: 0. Live Microsoft reads: 0. Live Microsoft writes: 0. Real Teams notifications: 0. Mailbox reads: 0. Deployments: 0. GitHub pushes: 0.
`;
}

export async function exportM51BEvidence(options: M51BEvidenceOptions) {
  const sourceRoot = m51bSourceRoot(options.root);
  assertM51B(
    !isM51BPathWithin(sourceRoot, options.output),
    "M5.1B evidence output cannot be inside the canonical source tree.",
  );
  fs.mkdirSync(options.output, { recursive: true });
  const result = await runM51BIntegratedScenario();
  assertM51B(result.accepted, "M5.1B integrated scenario is not accepted.");
  assertM51B(
    result.acceptanceFlags.length === 8 &&
      result.acceptanceFlags.every((flag) => flag.passed),
    "M5.1B does not have eight passing acceptance criteria.",
  );

  const records = buildM51BCriterionEvidence(result);
  for (const [name, record] of Object.entries(records))
    atomicWriteM51B(path.join(options.output, name), stableM51BJson(record));
  atomicWriteM51B(
    path.join(options.output, M51B_EVIDENCE_FILES.summary),
    summary(result),
  );

  const evidenceNames = [
    ...Object.values(M51B_CRITERION_EVIDENCE_FILES),
    M51B_EVIDENCE_FILES.summary,
  ];
  const files = evidenceNames.map((name) =>
    m51bFileRecord(path.join(options.output, name), name),
  );
  const controls = controlReferences(options.root);
  const manifest = Object.freeze({
    schemaVersion: "1.0",
    manifestId: "AMOS-OPS-M5.1B-ACCEPTANCE-MANIFEST",
    milestone: "M5.1B",
    generatedAt: result.executedAt,
    scenarioId: result.scenarioId,
    acceptanceStatement: result.acceptanceStatement,
    disposition: result.accepted ? "ACCEPTED" : "NOT_ACCEPTED",
    complete: result.accepted,
    acceptanceCriteria: result.acceptanceFlags,
    totals: result.totals,
    boundary: result.boundary,
    evidenceFiles: files,
    controlReferences: controls,
    synthetic: true,
  });
  atomicWriteM51B(
    path.join(options.output, M51B_EVIDENCE_FILES.manifest),
    stableM51BJson(manifest),
  );
  const checksumNames = [...evidenceNames, M51B_EVIDENCE_FILES.manifest].sort();
  atomicWriteM51B(
    path.join(options.output, M51B_EVIDENCE_FILES.checksums),
    `${checksumNames
      .map(
        (name) =>
          `${hashM51B(fs.readFileSync(path.join(options.output, name)))}  ${name}`,
      )
      .join("\n")}\n`,
  );
  return manifest;
}

const invoked = process.argv[1];
if (invoked && path.resolve(invoked) === fileURLToPath(import.meta.url)) {
  exportM51BEvidence(parseM51BEvidenceOptions(process.argv.slice(2)))
    .then((manifest) => process.stdout.write(stableM51BJson(manifest)))
    .catch((error) => {
      process.stderr.write(
        `M5.1B evidence export failed: ${error instanceof Error ? error.message : String(error)}\n`,
      );
      process.exitCode = 1;
    });
}
