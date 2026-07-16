import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type {
  M41aDashboard,
  M41aMetricCategory,
  M41aScenarioResult,
  M41aScopeId,
  M41aThresholdAlert,
} from "@contracts/m41a";

export const M41A_CRITERIA = [
  "M4.1A-01",
  "M4.1A-02",
  "M4.1A-03",
  "M4.1A-04",
  "M4.1A-05",
  "M4.1A-06",
  "M4.1A-07",
  "M4.1A-08",
] as const;

export const M41A_EVIDENCE_FILES = {
  scenario: "M4_1A_INTEGRATED_SCENARIO_RESULT.json",
  executive: "M4_1A_EXECUTIVE_DASHBOARD_RESULT.json",
  profitCenters: "M4_1A_PROFIT_CENTER_DASHBOARD_RESULT.json",
  corporateOffices: "M4_1A_CORPORATE_OFFICE_DASHBOARD_RESULT.json",
  drilldown: "M4_1A_DRILL_DOWN_RESULT.json",
  lineage: "M4_1A_METRIC_LINEAGE_RECONCILIATION.json",
  alertDecision: "M4_1A_ALERT_DECISION_LINEAGE.json",
  access: "M4_1A_ROLE_ACCESS_SUPPRESSION_RESULT.json",
  dataQuality: "M4_1A_SOURCE_RECONCILIATION_AND_DQ_RESULT.json",
  manifest: "M4_1A_ACCEPTANCE_MANIFEST.json",
  summary: "M4_1A_ACCEPTANCE_SUMMARY.md",
  checksums: "M4_1A_SHA256SUMS.txt",
  qa: "M4_1A_INTEGRATED_QA.json",
} as const;

export const M41A_CONTROL_REFERENCES = [
  "controls/M4_1A_REQUIREMENT_BASELINE.md",
  "controls/M4_1A_SCOPE_BOUNDARY.md",
  "controls/M4_1A_ACCEPTANCE_MATRIX.csv",
  "../M1.3_MGMA_Baseline_Established/evidence/01_Domain_Mapping_and_KPI_Dictionary/M1_3_KPI_DATA_DICTIONARY.csv",
  "../Phase_2_Integrated_Sprint/evidence/shared/PHASE_2_ACCEPTANCE_MANIFEST.json",
  "../Phase_3_Integrated_Sprint/evidence/shared/PHASE_3_ACCEPTANCE_MANIFEST.json",
] as const;

export const REQUIRED_CATEGORIES: Readonly<
  Record<M41aScopeId, readonly M41aMetricCategory[]>
> = {
  ENTERPRISE: [
    "census",
    "revenue",
    "profit_center_performance",
    "compliance",
    "strategic_initiatives",
  ],
  BHC: [
    "revenue",
    "census",
    "utilization",
    "outcomes",
    "service_timeliness",
    "operational_risk",
  ],
  GRO: [
    "revenue",
    "census",
    "utilization",
    "outcomes",
    "service_timeliness",
    "operational_risk",
  ],
  EO: [
    "compliance",
    "cost",
    "workforce",
    "facilities",
    "procurement",
    "support_performance",
  ],
  GAD: [
    "compliance",
    "cost",
    "workforce",
    "facilities",
    "procurement",
    "support_performance",
  ],
};

export interface M41aEvidenceOptions {
  root: string;
  output: string;
}

export interface M41aFileRecord {
  path: string;
  bytes: number;
  sha256: string;
}

export function assertM41a(
  condition: unknown,
  message: string,
): asserts condition {
  if (!condition) throw new Error(message);
}

export function normalizeM41aPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function isM41aPathWithin(parent: string, candidate: string): boolean {
  const relative = path.relative(parent, candidate);
  return (
    relative === "" ||
    (!relative.startsWith("..") && !path.isAbsolute(relative))
  );
}

export function parseM41aEvidenceOptions(
  argv: readonly string[],
): M41aEvidenceOptions {
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
  output ??= positional[1] ?? path.join(resolvedRoot, "evidence");
  return { root: resolvedRoot, output: path.resolve(output) };
}

export function m41aSourceRoot(root: string): string {
  const nested = path.join(root, "source");
  if (fs.existsSync(path.join(nested, "package.json"))) return nested;
  if (fs.existsSync(path.join(root, "package.json"))) return root;
  throw new Error(`M4.1A source root is missing under ${root}.`);
}

export function m41aMilestoneRoot(root: string): string {
  return fs.existsSync(path.join(root, "source", "package.json"))
    ? root
    : path.dirname(m41aSourceRoot(root));
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

export function stableM41aJson(value: unknown): string {
  return `${JSON.stringify(stableValue(value), null, 2)}\n`;
}

export function atomicWriteM41a(filePath: string, value: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial-${process.pid}`;
  fs.writeFileSync(temporary, value);
  fs.renameSync(temporary, filePath);
}

export function hashM41aBuffer(value: Buffer | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function m41aFileRecord(
  absolutePath: string,
  label = path.basename(absolutePath),
): M41aFileRecord {
  const contents = fs.readFileSync(absolutePath);
  return {
    path: normalizeM41aPath(label),
    bytes: contents.length,
    sha256: hashM41aBuffer(contents),
  };
}

export function readM41aJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Invalid JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export function inspectM41aSyntheticBoundary(
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
      const normalized = key.toLowerCase().replaceAll("_", "");
      const childPointer = `${pointer}.${key}`;
      if (normalized === "evidenceclass")
        assertM41a(
          child === "synthetic_demo" || child === null,
          `${source} contains non-synthetic evidence at ${childPointer}.`,
        );
      if (normalized === "productionrows")
        assertM41a(
          child === 0,
          `${source} reports production rows at ${childPointer}.`,
        );
      if (normalized === "usesproductiondata")
        assertM41a(
          child === false,
          `${source} reports production-data use at ${childPointer}.`,
        );
      visit(child, childPointer);
    }
  };
  visit(value, "$");
}

function validateDashboard(scope: M41aScopeId, dashboard: M41aDashboard): void {
  assertM41a(dashboard.scope === scope, `${scope} dashboard scope drifted.`);
  assertM41a(
    dashboard.milestone === "M4.1A" &&
      dashboard.evidenceClass === "synthetic_demo",
    `${scope} dashboard identity or evidence boundary drifted.`,
  );
  assertM41a(
    dashboard.environmentLabel.includes("CONTROLLED TIME-SHIFT") &&
      dashboard.environmentLabel.includes("NO REAL DATA"),
    `${scope} dashboard does not disclose its controlled synthetic time shift.`,
  );
  const categories = new Set(
    dashboard.metrics.map((metric) => metric.definition.category),
  );
  for (const required of REQUIRED_CATEGORIES[scope])
    assertM41a(
      categories.has(required),
      `${scope} dashboard is missing category ${required}.`,
    );
  assertM41a(
    dashboard.metrics.length === REQUIRED_CATEGORIES[scope].length,
    `${scope} dashboard must contain one governed metric per required category.`,
  );
  const metricIds = dashboard.metrics.map((metric) => metric.definition.id);
  assertM41a(
    new Set(metricIds).size === metricIds.length,
    `${scope} dashboard contains duplicate metric definitions.`,
  );
  for (const metric of dashboard.metrics) {
    const definition = metric.definition;
    assertM41a(
      definition.description.length > 0 &&
        definition.formula.length > 0 &&
        definition.sourceSystem.length > 0 &&
        definition.sourceFields.length > 0 &&
        definition.owner.roleId.length > 0 &&
        definition.target.label.length > 0 &&
        definition.maximumDrillDepth === 3,
      `${scope}/${definition.id} is missing governed definition metadata.`,
    );
    assertM41a(
      metric.maximumAuthorizedDrillDepth <= 3,
      `${scope}/${definition.id} exceeds the three-click limit.`,
    );
    assertM41a(
      metric.reconciliation.reasonCode !== "MATCHED" ||
        metric.reconciliation.reconciled,
      `${scope}/${definition.id} claims a matched source without reconciliation.`,
    );
    if (
      metric.dataQualityState === "missing" ||
      metric.dataQualityState === "contradictory" ||
      metric.dataQualityState === "suppressed"
    ) {
      assertM41a(
        metric.value === null &&
          metric.variance === null &&
          metric.status === "not_measured",
        `${scope}/${definition.id} defaulted unavailable data to a value.`,
      );
      if (metric.dataQualityState === "contradictory")
        assertM41a(
          metric.sourceRecordIds.length > 1,
          `${scope}/${definition.id} discarded contradictory source lineage.`,
        );
    } else {
      assertM41a(
        metric.value !== null &&
          metric.variance !== null &&
          metric.refreshTime !== null,
        `${scope}/${definition.id} omitted value, variance, or refresh metadata.`,
      );
      if (metric.dataQualityState === "current")
        assertM41a(
          metric.reconciliation.reconciled &&
            metric.reconciliation.reasonCode === "MATCHED",
          `${scope}/${definition.id} is current without matched reconciliation.`,
        );
      if (metric.dataQualityState === "stale")
        assertM41a(
          metric.status === "not_measured" &&
            metric.reconciliation.reasonCode === "STALE_SOURCE",
          `${scope}/${definition.id} represents stale data as an ordinary performance claim.`,
        );
    }
  }
  if (scope === "ENTERPRISE") {
    assertM41a(
      dashboard.stageCensus.length === 3 &&
        new Set(dashboard.stageCensus.map((stage) => stage.stageId)).size === 3,
      "Enterprise dashboard must expose the three distinct campus stages.",
    );
  }
}

export type M41aOperationalScenarioResult = M41aScenarioResult & {
  drilldownEvidence: readonly Record<string, unknown>[];
  accessEvaluations: readonly Record<string, unknown>[];
  dataQualityScenarios: readonly Record<string, unknown>[];
  sourceRegister: Readonly<Record<string, unknown>>;
  reconciliations: readonly Record<string, unknown>[];
  productionActionsBlocked: true;
};

export function validateM41aScenario(
  value: unknown,
): M41aOperationalScenarioResult {
  assertM41a(
    value !== null && typeof value === "object" && !Array.isArray(value),
    "M4.1A integrated scenario returned no result object.",
  );
  const result = value as Partial<M41aOperationalScenarioResult>;
  inspectM41aSyntheticBoundary(result, "M4.1A integrated scenario");
  assertM41a(
    result.milestone === "M4.1A" &&
      result.evidenceClass === "synthetic_demo",
    "M4.1A integrated scenario identity or evidence boundary drifted.",
  );
  assertM41a(
    typeof result.scenarioId === "string" &&
      result.scenarioId.startsWith("SYNTH-") &&
      typeof result.runId === "string" &&
      result.runId.startsWith("SYNTH-"),
    "M4.1A scenario identities must be explicitly synthetic.",
  );
  assertM41a(result.exitGate === true, "M4.1A exit gate is not passing.");
  assertM41a(Array.isArray(result.criteria), "M4.1A criteria are missing.");
  assertM41a(
    JSON.stringify(result.criteria.map((criterion) => criterion.criterionId).sort()) ===
      JSON.stringify([...M41A_CRITERIA].sort()),
    "M4.1A scenario must contain exactly eight controlling criteria.",
  );
  assertM41a(
    result.criteria.every(
      (criterion) => criterion.passed && criterion.evidenceIds.length > 0,
    ),
    "Every M4.1A criterion must pass with linked evidence.",
  );
  assertM41a(
    result.dashboards !== null && typeof result.dashboards === "object",
    "M4.1A dashboards are missing.",
  );
  for (const scope of ["ENTERPRISE", "BHC", "GRO", "EO", "GAD"] as const) {
    const dashboard = result.dashboards[scope];
    assertM41a(dashboard !== undefined, `${scope} dashboard is missing.`);
    validateDashboard(scope, dashboard);
  }
  assertM41a(
    Array.isArray(result.alerts) && result.alerts.length > 0,
    "M4.1A threshold alerts are missing.",
  );
  const alerts = result.alerts as readonly M41aThresholdAlert[];
  for (const alert of alerts) {
    const snapshot = result.dashboards[alert.scope].metrics.find(
      (metric) => metric.definition.id === alert.metricId,
    );
    assertM41a(snapshot, `M4.1A alert ${alert.id} has no governed metric.`);
    if (
      snapshot.dataQualityState === "missing" ||
      snapshot.dataQualityState === "contradictory"
    )
      assertM41a(
        alert.observedValue === null,
        `M4.1A alert ${alert.id} defaulted unavailable evidence to zero.`,
      );
  }
  assertM41a(
    Array.isArray(result.decisions) &&
      result.decisions.some((decision) => decision.humanApproved),
    "M4.1A has no human-approved decision record.",
  );
  assertM41a(
    Array.isArray(result.followUpEvidence) && result.followUpEvidence.length > 0,
    "M4.1A follow-up evidence is missing.",
  );
  assertM41a(
    Array.isArray(result.auditEvents) && result.auditEvents.length >= 6,
    "M4.1A append-only alert/decision audit lineage is incomplete.",
  );
  const resolvedAlert = alerts.find(
    (alert) => alert.status === "resolved",
  );
  assertM41a(
    resolvedAlert &&
      resolvedAlert.decisionId &&
      resolvedAlert.followUpEvidenceIds.length > 0,
    "M4.1A has no fully evidenced resolved alert.",
  );
  const lifecycleActions = result.auditEvents
    .filter((event) => event.correlationId === resolvedAlert.id)
    .map((event) => event.action);
  assertM41a(
    JSON.stringify(lifecycleActions) ===
      JSON.stringify([
        "alert_triggered",
        "alert_acknowledged",
        "alert_assigned",
        "decision_recorded",
        "follow_up_evidence_added",
        "alert_resolved",
      ]),
    "M4.1A alert lifecycle audit sequence drifted.",
  );
  for (const key of [
    "drilldownEvidence",
    "accessEvaluations",
    "dataQualityScenarios",
    "reconciliations",
  ] as const)
    assertM41a(
      Array.isArray(result[key]) && result[key].length > 0,
      `M4.1A operational evidence is missing ${key}.`,
    );
  const drillRows = result.drilldownEvidence as readonly Record<
    string,
    unknown
  >[];
  assertM41a(
    drillRows.length === 5 &&
      drillRows.every(
        (row) =>
          row.depth === 3 &&
          row.terminal === true &&
          Array.isArray(row.nodeIds) &&
          row.nodeIds.length > 0 &&
          Array.isArray(row.sourceRecordIds) &&
          row.sourceRecordIds.length > 0,
      ),
    "M4.1A three-click evidence is incomplete or not source-terminal.",
  );
  const qualityStates = new Set(
    (result.dataQualityScenarios as readonly Record<string, unknown>[]).map(
      (row) => row.state,
    ),
  );
  assertM41a(
    ["current", "stale", "missing", "contradictory", "suppressed"].every(
      (state) => qualityStates.has(state),
    ),
    "M4.1A data-quality evidence does not cover every controlled state.",
  );
  const accessRows = result.accessEvaluations as readonly Record<
    string,
    unknown
  >[];
  assertM41a(
    accessRows.every(
      (row) =>
        row.noLeakedFields === true &&
        row.allowed === (row.expected === "allowed"),
    ) &&
      accessRows.some(
        (row) => row.sensitivity === "sud" && row.maximumDepth === 0,
      ),
    "M4.1A access evidence is missing a deny/suppression result or leaked fields.",
  );
  assertM41a(
    result.sourceRegister !== null &&
      typeof result.sourceRegister === "object" &&
      !Array.isArray(result.sourceRegister) &&
      Object.keys(result.sourceRegister).length > 0,
    "M4.1A operational evidence is missing sourceRegister.",
  );
  assertM41a(
    result.productionActionsBlocked === true,
    "M4.1A production-action boundary is not engaged.",
  );
  return result as M41aOperationalScenarioResult;
}

export function m41aControlReferences(root: string): M41aFileRecord[] {
  const milestoneRoot = m41aMilestoneRoot(root);
  const allowedParent = path.dirname(milestoneRoot);
  return M41A_CONTROL_REFERENCES.map((repoPath) => {
    const absolute = path.resolve(milestoneRoot, repoPath);
    assertM41a(
      isM41aPathWithin(allowedParent, absolute),
      `M4.1A control reference escapes the milestone repository: ${repoPath}`,
    );
    assertM41a(
      fs.existsSync(absolute) && fs.statSync(absolute).isFile(),
      `M4.1A control reference is missing: ${repoPath}`,
    );
    return m41aFileRecord(absolute, repoPath);
  }).sort((left, right) => left.path.localeCompare(right.path));
}
