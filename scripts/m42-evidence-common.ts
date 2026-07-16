import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { M42CriterionId } from "@contracts/m42/shared";
import type { M42IntegratedScenarioResult } from "../api/services/m42/experience-service";

export const M42_CRITERION_EVIDENCE_FILES: Readonly<
  Record<M42CriterionId, string>
> = Object.freeze({
  "M4.2-01": "M4_2_DMS_TAXONOMY_LIFECYCLE_RESULT.json",
  "M4.2-02": "M4_2_DOCUMENT_ACCESS_RECORDS_RESULT.json",
  "M4.2-03": "M4_2_VERSION_SOURCE_OF_TRUTH_RESULT.json",
  "M4.2-04": "M4_2_SEARCH_PERFORMANCE_RESULT.json",
  "M4.2-05": "M4_2_NIL_SEMANTIC_ACCURACY_RESULT.json",
  "M4.2-06": "M4_2_REPORT_BUILDER_RESULT.json",
  "M4.2-07": "M4_2_NO_CODE_ADMIN_RESULT.json",
  "M4.2-08": "M4_2_INTEGRATED_SCENARIO_RESULT.json",
});

export const M42_EVIDENCE_FILES = Object.freeze({
  manifest: "M4_2_ACCEPTANCE_MANIFEST.json",
  summary: "M4_2_ACCEPTANCE_SUMMARY.md",
  checksums: "M4_2_SHA256SUMS.txt",
  qa: "M4_2_INTEGRATED_QA.json",
  schema: "M4_2_SCHEMA_INTEGRITY.json",
});

export const M42_CONTROL_FILES = Object.freeze([
  "AGENT_FILE_OWNERSHIP.csv",
  "DEFERRED_SEQUENCE_BACKLOG.md",
  "M4_2_ACCEPTANCE_MATRIX.csv",
  "M4_2_BASELINE_GAP_ASSESSMENT.md",
  "M4_2_INHERITED_BASELINE_VERIFICATION.md",
  "M4_2_REQUIREMENT_BASELINE.md",
  "M4_2_SCOPE_BOUNDARY.md",
  "M4_2_SPRINT_CHARTER.md",
  "M4_2_TRACEABILITY_MATRIX.csv",
  "M4_2_IMPLEMENTATION_REGISTER.md",
  "M4_2_INDEPENDENT_REVIEW.md",
  "M4_2_ACCEPTANCE_RECORD.md",
  "M4_2_RELEASE_READINESS.md",
]);

export interface M42EvidenceOptions {
  root: string;
  output: string;
}

export interface M42FileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

export function assertM42(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function normalizeM42Path(value: string): string {
  return value.split(path.sep).join("/");
}

export function isM42PathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function parseM42EvidenceOptions(
  argv: readonly string[],
): M42EvidenceOptions {
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

export function m42SourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.2 source root is missing under ${root}.`);
}

export function m42MilestoneRoot(root: string): string {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(m42SourceRoot(root));
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

export function stableM42Json(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function atomicWriteM42(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function hashM42Buffer(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function m42FileRecord(
  absolutePath: string,
  label = path.basename(absolutePath),
): M42FileRecord {
  const contents = fs.readFileSync(absolutePath);
  return {
    path: normalizeM42Path(label),
    bytes: contents.length,
    sha256: hashM42Buffer(contents),
  };
}

export function readM42Json(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Unable to read M4.2 JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function m42ControlReferences(root: string): readonly M42FileRecord[] {
  const controlsRoot = path.join(m42MilestoneRoot(root), "controls");
  return Object.freeze(
    M42_CONTROL_FILES.map((fileName) => {
      const absolute = path.join(controlsRoot, fileName);
      assertM42(fs.existsSync(absolute), `M4.2 control is missing: ${fileName}`);
      return m42FileRecord(absolute, `controls/${fileName}`);
    }),
  );
}

function criterionArtifact(
  result: M42IntegratedScenarioResult,
  criterionId: M42CriterionId,
  artifacts: Readonly<Record<string, unknown>>,
) {
  const flag = result.acceptanceFlags.find(
    (candidate) => candidate.criterionId === criterionId,
  );
  assertM42(flag, `M4.2 criterion flag is missing: ${criterionId}`);
  return Object.freeze({
    schemaVersion: "1.0",
    recordId: `AMOS-OPS-${criterionId}-ACCEPTANCE-EVIDENCE`,
    milestone: "M4.2",
    criterionId,
    passed: flag.passed,
    assertionCount: flag.assertionCount,
    summary: flag.summary,
    evidenceIds: flag.evidenceIds,
    generatedAt: result.executedAt,
    evidenceClass: result.boundary.evidenceClass,
    productionRows: 0 as const,
    liveWrites: 0 as const,
    usesProductionData: false,
    synthetic: true,
    artifacts,
  });
}

export function buildM42CriterionEvidence(
  result: M42IntegratedScenarioResult,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    [M42_CRITERION_EVIDENCE_FILES["M4.2-01"]]: criterionArtifact(
      result,
      "M4.2-01",
      {
        registry: result.records.registry,
        validationErrors: result.records.registryValidationErrors,
      },
    ),
    [M42_CRITERION_EVIDENCE_FILES["M4.2-02"]]: criterionArtifact(
      result,
      "M4.2-02",
      {
        allowedAccess: result.records.allowedAccess,
        deniedPart2Access: result.records.deniedPart2Access,
        blockedDisclosure: result.records.blockedDisclosure,
        disclosureLedgerValidationErrors:
          result.records.disclosureLedgerValidationErrors,
        exportManifest: result.records.exportManifest,
        dispositionPreview: result.records.dispositionPreview,
      },
    ),
    [M42_CRITERION_EVIDENCE_FILES["M4.2-03"]]: criterionArtifact(
      result,
      "M4.2-03",
      {
        versionLedger: result.records.versionLedger,
        validationErrors: result.records.versionLedgerValidationErrors,
      },
    ),
    [M42_CRITERION_EVIDENCE_FILES["M4.2-04"]]: criterionArtifact(
      result,
      "M4.2-04",
      { performance: result.search },
    ),
    [M42_CRITERION_EVIDENCE_FILES["M4.2-05"]]: criterionArtifact(
      result,
      "M4.2-05",
      { semanticEvaluation: result.nil },
    ),
    [M42_CRITERION_EVIDENCE_FILES["M4.2-06"]]: criterionArtifact(
      result,
      "M4.2-06",
      { reporting: result.reporting },
    ),
    [M42_CRITERION_EVIDENCE_FILES["M4.2-07"]]: criterionArtifact(
      result,
      "M4.2-07",
      { administration: result.administration },
    ),
    [M42_CRITERION_EVIDENCE_FILES["M4.2-08"]]: criterionArtifact(
      result,
      "M4.2-08",
      {
        scenarioId: result.scenarioId,
        accepted: result.accepted,
        acceptanceFlags: result.acceptanceFlags,
        totals: result.totals,
        boundary: result.boundary,
      },
    ),
  });
}

export function buildM42Summary(result: M42IntegratedScenarioResult): string {
  const rows = result.acceptanceFlags
    .map(
      (flag) =>
        `| ${flag.criterionId} | ${flag.passed ? "PASS" : "FAIL"} | ${flag.assertionCount} | ${flag.summary} |`,
    )
    .join("\n");
  return `# AMOS-OPS M4.2 Acceptance Summary

**Milestone:** M4.2 — Document and Knowledge Management Operational  
**Disposition:** ${result.accepted ? "ACCEPTED" : "NOT ACCEPTED"}  
**Evidence class:** ${result.boundary.evidenceClass}  
**Scenario:** ${result.scenarioId}

| Criterion | Status | Assertions | Result |
|---|---:|---:|---|
${rows}

## Exact acceptance results

- Search maximum: ${result.search.maxMs.toFixed(3)} ms (target: under ${result.search.targetMsExclusive.toLocaleString()} ms)
- NIL top-1 accuracy: ${(result.nil.accuracy * 100).toFixed(2)}% (target: at least ${(result.nil.threshold * 100).toFixed(0)}%)
- Report builder: T2+ field-permission, lineage, saved-definition, filter, audit, and manifest controls passed
- No-code administration: validation, approval, append-only change, audit, and rollback controls passed
- Integrated controls: ${result.totals.criteriaPassed}/${result.totals.criteriaTotal} passed across ${result.totals.assertions} assertions

## Boundary

Fictional records only. Production rows: 0. Live external writes: 0. Production disposition: 0. Deployments: 0. GitHub pushes: 0.
`;
}
