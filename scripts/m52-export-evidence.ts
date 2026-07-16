import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  M52_CRITERION_IDS,
  type M52CriterionId,
} from "@contracts/m52/shared";
import { runM52IntegratedScenario } from "../api/services/m52";

export const M52_CRITERION_EVIDENCE_FILES: Readonly<
  Record<M52CriterionId, string>
> = Object.freeze({
  "M5.2-01": "M5_2_OFFLINE_CAPABILITY_RESULT.json",
  "M5.2-02": "M5_2_DEVICE_SECURITY_RESULT.json",
  "M5.2-03": "M5_2_QUEUE_SYNC_RESULT.json",
  "M5.2-04": "M5_2_CACHE_ISOLATION_RESULT.json",
  "M5.2-05": "M5_2_MEDICATION_PASS_RESULT.json",
  "M5.2-06": "M5_2_NETWORK_RESILIENCE_RESULT.json",
  "M5.2-07": "M5_2_RECONCILIATION_RESULT.json",
  "M5.2-08": "M5_2_FIELD_USABILITY_RESULT.json",
});

export const M52_EVIDENCE_FILES = Object.freeze({
  manifest: "M5_2_ACCEPTANCE_MANIFEST.json",
  summary: "M5_2_ACCEPTANCE_SUMMARY.md",
  checksums: "M5_2_SHA256SUMS.txt",
  integrated: "M5_2_INTEGRATED_SCENARIO_RESULT.json",
  inherited: "M5_2_INHERITED_M5_1B_RESULT.json",
  qa: "M5_2_INTEGRATED_QA.json",
  schema: "M5_2_SCHEMA_INTEGRITY.json",
});

export const M52_BASELINE_CONTROL_FILES = Object.freeze([
  "M5_2_ACCEPTANCE_MATRIX.csv",
  "M5_2_ACCESS_SUPPORT_REVIEW.md",
  "M5_2_AGENT_FILE_OWNERSHIP.csv",
  "M5_2_BASELINE_GAP_ASSESSMENT.md",
  "M5_2_DEFERRED_SEQUENCE_BACKLOG.md",
  "M5_2_IMPLEMENTATION_REGISTER.md",
  "M5_2_INHERITED_BASELINE_VERIFICATION.md",
  "M5_2_INTEGRATION_CONTRACT_REGISTER.md",
  "M5_2_OFFLINE_CAPABILITY_BASELINE.md",
  "M5_2_REQUIREMENT_BASELINE.md",
  "M5_2_SCOPE_BOUNDARY.md",
  "M5_2_SPRINT_CHARTER.md",
  "M5_2_TEST_PLAN.md",
  "M5_2_TRACEABILITY_MATRIX.csv",
]);

export interface M52EvidenceOptions {
  readonly root: string;
  readonly output: string;
}

type IntegratedResult = Awaited<ReturnType<typeof runM52IntegratedScenario>>;

export function assertM52(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function stableM52Json(value: unknown): string {
  const stable = (child: unknown): unknown => {
    if (Array.isArray(child)) return child.map(stable);
    if (!child || typeof child !== "object") return child;
    return Object.fromEntries(
      Object.entries(child as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stable(item)]),
    );
  };
  return `${JSON.stringify(stable(value), null, 2)}\n`;
}

export function hashM52(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function atomicWriteM52(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function parseM52EvidenceOptions(
  argv: readonly string[],
): M52EvidenceOptions {
  let root = "..";
  let output: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") root = argv[++index] ?? "";
    else if (argument === "--output") output = argv[++index];
    else throw new Error(`Unknown M5.2 evidence option: ${argument}`);
  }
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    output: path.resolve(output ?? path.join(resolvedRoot, "evidence")),
  };
}

export function m52SourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M5.2 source root is missing under ${root}.`);
}

export function m52MilestoneRoot(root: string): string {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(m52SourceRoot(root));
}

export function isM52PathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

function fileRecord(absolute: string, label: string) {
  const contents = fs.readFileSync(absolute);
  return Object.freeze({
    path: label.split(path.sep).join("/"),
    bytes: contents.length,
    sha256: hashM52(contents),
  });
}

function controlReferences(root: string) {
  const controlsRoot = path.join(m52MilestoneRoot(root), "controls");
  return Object.freeze(
    M52_BASELINE_CONTROL_FILES.map((name) => {
      const absolute = path.join(controlsRoot, name);
      assertM52(fs.existsSync(absolute), `M5.2 control is missing: ${name}`);
      return fileRecord(absolute, `controls/${name}`);
    }),
  );
}

function criterionArtifacts(
  result: IntegratedResult,
  criterionId: M52CriterionId,
): Readonly<Record<string, unknown>> {
  switch (criterionId) {
    case "M5.2-01":
      return {
        workflows: result.workflows.map(({ reconciliation, ...row }) => {
          assertM52(
            reconciliation !== undefined,
            "M5.2 workflow reconciliation evidence is missing.",
          );
          return row;
        }),
      };
    case "M5.2-02":
      return { security: result.security, purgeLifecycle: result.purgeLifecycle };
    case "M5.2-03":
      return { workflows: result.workflows, sync: result.sync };
    case "M5.2-04":
      return {
        cacheIsolation: result.security.cacheIsolation,
        purgeLifecycle: result.purgeLifecycle,
      };
    case "M5.2-05":
      return {
        medicationTiming: result.medicationTiming,
        medicationPass: result.experience.medicationPass,
      };
    case "M5.2-06":
      return {
        networkLoss: result.sync.networkLoss,
        longOffline: result.sync.longOffline,
        partialSync: result.sync.partialSync,
        counts: result.sync.counts,
      };
    case "M5.2-07":
      return {
        workflowReconciliation: result.workflows.map((row) => ({
          workflowId: row.workflowId,
          reconciliation: row.reconciliation,
        })),
        canonicalReconciliation: result.sync.reconciliation,
      };
    case "M5.2-08":
      return { fieldUsability: result.experience.fieldUsability };
  }
}

export function buildM52CriterionEvidence(result: IntegratedResult) {
  return Object.freeze(
    Object.fromEntries(
      M52_CRITERION_IDS.map((criterionId) => {
        const flag = result.acceptanceFlags.find(
          (candidate) => candidate.criterionId === criterionId,
        );
        assertM52(flag, `M5.2 criterion flag is missing: ${criterionId}`);
        return [
          M52_CRITERION_EVIDENCE_FILES[criterionId],
          Object.freeze({
            schemaVersion: "1.0",
            recordId: `AMOS-OPS-${criterionId}-ACCEPTANCE-EVIDENCE`,
            milestone: "M5.2",
            criterionId,
            passed: flag.passed,
            assertionCount: flag.assertionCount,
            summary: flag.summary,
            evidenceIds: flag.evidenceIds,
            generatedAt: result.executedAt,
            evidenceClass: result.boundary.evidenceClass,
            productionRows: 0,
            liveExternalCalls: 0,
            liveMicrosoftReads: 0,
            liveMicrosoftWrites: 0,
            realNotificationsSent: 0,
            deployments: 0,
            githubPushes: 0,
            usesProductionData: false,
            synthetic: true,
            artifacts: criterionArtifacts(result, criterionId),
          }),
        ];
      }),
    ),
  );
}

function summary(result: IntegratedResult): string {
  const rows = result.acceptanceFlags
    .map(
      (flag) =>
        `| ${flag.criterionId} | ${flag.passed ? "PASS" : "FAIL"} | ${flag.assertionCount} | ${flag.summary} |`,
    )
    .join("\n");
  return `# AMOS-OPS M5.2 Acceptance Summary

**Milestone:** M5.2 — Mobile and Offline Deployment  
**Disposition:** ${result.accepted ? "ACCEPTED" : "NOT ACCEPTED"}  
**Evidence class:** ${result.boundary.evidenceClass}  
**Scenario:** ${result.scenarioId}

| Criterion | Status | Assertions | Result |
|---|---:|---:|---|
${rows}

## Exact results

- Approved workflows: ${result.workflows.length}/4 authorized, encrypted, synchronized, and reconciled.
- Medication pass: ${result.medicationTiming.evidence.measuredElapsedSeconds} seconds from ordered synthetic event evidence; every verification control completed.
- Reconciliation: ${result.workflows.filter((row) => row.zeroDataLoss).length}/4 workflows report zero data loss.
- Network resilience: all ${result.sync.networkLoss.stepsExercised.length} loss points recovered; partial sync observed while 2 conflicts remained held.
- Purge lifecycle: logout, reinstall, and device-loss cache/queue purges passed.
- Acceptance: ${result.totals.passedCriteria}/${result.totals.acceptanceCriteria} criteria across ${result.totals.assertionCount} integrated assertions.

## Boundary

Fictional records only. Production rows: 0. Live external calls: 0. Live Microsoft reads: 0. Live Microsoft writes: 0. Real notifications: 0. Deployments: 0. GitHub pushes: 0.
`;
}

export async function exportM52Evidence(options: M52EvidenceOptions) {
  const sourceRoot = m52SourceRoot(options.root);
  assertM52(
    !isM52PathWithin(sourceRoot, options.output),
    "M5.2 evidence output cannot be inside the canonical source tree.",
  );
  fs.mkdirSync(options.output, { recursive: true });
  const result = await runM52IntegratedScenario();
  assertM52(
    result.accepted &&
      result.acceptanceFlags.length === 8 &&
      result.acceptanceFlags.every((flag) => flag.passed),
    "M5.2 integrated scenario is not accepted.",
  );
  const criterionRecords = buildM52CriterionEvidence(result);
  for (const [name, record] of Object.entries(criterionRecords))
    atomicWriteM52(path.join(options.output, name), stableM52Json(record));
  atomicWriteM52(
    path.join(options.output, M52_EVIDENCE_FILES.integrated),
    stableM52Json(result),
  );
  atomicWriteM52(
    path.join(options.output, M52_EVIDENCE_FILES.inherited),
    stableM52Json(result.inherited),
  );
  atomicWriteM52(
    path.join(options.output, M52_EVIDENCE_FILES.summary),
    summary(result),
  );
  const contentNames = [
    ...Object.values(M52_CRITERION_EVIDENCE_FILES),
    M52_EVIDENCE_FILES.integrated,
    M52_EVIDENCE_FILES.inherited,
    M52_EVIDENCE_FILES.summary,
  ];
  const evidenceFiles = Object.freeze(
    contentNames.map((name) => fileRecord(path.join(options.output, name), name)),
  );
  const manifest = Object.freeze({
    schemaVersion: "1.0",
    manifestId: "AMOS-OPS-M5.2-ACCEPTANCE-MANIFEST",
    milestone: "M5.2",
    scenarioId: result.scenarioId,
    generatedAt: result.executedAt,
    disposition: "ACCEPTED",
    complete: true,
    acceptanceStatement: result.acceptanceStatement,
    acceptanceCriteria: result.acceptanceFlags,
    totals: result.totals,
    boundary: result.boundary,
    controlReferences: controlReferences(options.root),
    evidenceFiles,
    synthetic: true,
  });
  atomicWriteM52(
    path.join(options.output, M52_EVIDENCE_FILES.manifest),
    stableM52Json(manifest),
  );
  const checksumNames = [...contentNames, M52_EVIDENCE_FILES.manifest].sort();
  atomicWriteM52(
    path.join(options.output, M52_EVIDENCE_FILES.checksums),
    `${checksumNames
      .map((name) => `${hashM52(fs.readFileSync(path.join(options.output, name)))}  ${name}`)
      .join("\n")}\n`,
  );
  return manifest;
}

const invoked = process.argv[1];
if (invoked && pathToFileURL(path.resolve(invoked)).href === import.meta.url) {
  try {
    process.stdout.write(
      `${stableM52Json(await exportM52Evidence(parseM52EvidenceOptions(process.argv.slice(2))))}`,
    );
  } catch (error) {
    process.stderr.write(
      `M5.2 evidence export failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
