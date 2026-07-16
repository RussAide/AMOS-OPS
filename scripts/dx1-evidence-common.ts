import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { Dx1CriterionId } from "../api/services/dx1/contracts";

export const DX1_CRITERION_EVIDENCE_FILES: Readonly<
  Record<Dx1CriterionId, string>
> = Object.freeze({
  "DX.1-01": "DX_1_01_WORKSPACE_NAVIGATION_RESULT.json",
  "DX.1-02": "DX_1_02_WORKFLOW_GOVERNANCE_RESULT.json",
  "DX.1-03": "DX_1_03_DMS_LIFECYCLE_RESULT.json",
  "DX.1-04": "DX_1_04_AGENT_ASSISTANCE_RESULT.json",
  "DX.1-05": "DX_1_05_NIL_RELATIONSHIP_RESULT.json",
  "DX.1-06": "DX_1_06_ENTERPRISE_DASHBOARD_RESULT.json",
  "DX.1-07": "DX_1_07_MICROSOFT_BOUNDARY_RESULT.json",
  "DX.1-08": "DX_1_08_PERMISSION_SECURITY_RESULT.json",
  "DX.1-09": "DX_1_09_FRONTLINE_USABILITY_RESULT.json",
  "DX.1-10": "DX_1_10_END_TO_END_PILOT_RESULT.json",
  "DX.1-11": "DX_1_11_GUIDANCE_SUPPORT_RESULT.json",
  "DX.1-12": "DX_1_12_CHANGE_CONTROL_RESULT.json",
});

export const DX1_EVIDENCE_FILES = Object.freeze({
  manifest: "DX_1_ACCEPTANCE_MANIFEST.json",
  summary: "DX_1_ACCEPTANCE_SUMMARY.md",
  checksums: "DX_1_SHA256SUMS.txt",
  integrated: "DX_1_INTEGRATED_SCENARIO_RESULT.json",
  inherited: "DX_1_INHERITED_M5_2_RESULT.json",
  audit: "DX_1_CORRELATED_AUDIT_HISTORY.json",
  pilot: "DX_1_EIGHT_STAGE_PILOT_TRACE.json",
  verification: "DX_1_EVIDENCE_VERIFICATION.json",
  qa: "DX_1_INTEGRATED_QA.json",
});

export const DX1_BASELINE_CONTROL_FILES = Object.freeze([
  "DX_1_ACCEPTANCE_MATRIX.csv",
  "DX_1_AGENT_FILE_OWNERSHIP.csv",
  "DX_1_BASELINE_GAP_ASSESSMENT.md",
  "DX_1_IMPLEMENTATION_REGISTER.md",
  "DX_1_INHERITED_BASELINE_VERIFICATION.md",
  "DX_1_INTEGRATION_CONTRACT_REGISTER.md",
  "DX_1_PILOT_WORKFLOW_BASELINE.md",
  "DX_1_REQUIREMENT_BASELINE.md",
  "DX_1_SCOPE_BOUNDARY.md",
  "DX_1_SOURCE_INTEGRITY_NOTE.md",
  "DX_1_SOURCE_PROVENANCE.md",
  "DX_1_SPRINT_CHARTER.md",
  "DX_1_TEST_PLAN.md",
  "DX_1_TRACEABILITY_MATRIX.csv",
]);

export interface Dx1EvidenceOptions {
  readonly root: string;
  readonly output: string;
}

export function assertDx1Evidence(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function stableDx1Json(value: unknown): string {
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

export function hashDx1(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function atomicWriteDx1(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function parseDx1EvidenceOptions(
  argv: readonly string[],
): Dx1EvidenceOptions {
  let root = "..";
  let output: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--root") root = argv[++index] ?? "";
    else if (argument === "--output") output = argv[++index];
    else throw new Error(`Unknown DX.1 evidence option: ${argument}`);
  }
  const resolvedRoot = path.resolve(root);
  return {
    root: resolvedRoot,
    output: path.resolve(output ?? path.join(resolvedRoot, "evidence")),
  };
}

export function dx1SourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`DX.1 source root is missing under ${root}.`);
}

export function dx1MilestoneRoot(root: string): string {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(dx1SourceRoot(root));
}

export function isDx1PathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function dx1FileRecord(absolute: string, label: string) {
  const contents = fs.readFileSync(absolute);
  return Object.freeze({
    path: label.split(path.sep).join("/"),
    bytes: contents.length,
    sha256: hashDx1(contents),
  });
}
