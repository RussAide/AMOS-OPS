import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  M41A_CRITERIA,
  M41A_EVIDENCE_FILES,
  assertM41a,
  atomicWriteM41a,
  m41aControlReferences,
  m41aFileRecord,
  m41aMilestoneRoot,
  m41aSourceRoot,
  parseM41aEvidenceOptions,
  stableM41aJson,
  validateM41aScenario,
  type M41aEvidenceOptions,
  type M41aOperationalScenarioResult,
} from "./m41a-evidence-common";

async function loadScenario(root: string): Promise<unknown> {
  const modulePath = path.join(
    m41aSourceRoot(root),
    "api",
    "services",
    "m41a",
    "index.ts",
  );
  assertM41a(
    fs.existsSync(modulePath),
    `M4.1A service entry point is missing: ${modulePath}`,
  );
  const loaded = (await import(pathToFileURL(modulePath).href)) as Record<
    string,
    unknown
  >;
  const runner = loaded.runM41aScenario;
  assertM41a(
    typeof runner === "function",
    "M4.1A service must export runM41aScenario().",
  );
  return Promise.resolve((runner as () => unknown)());
}

export function buildM41aEvidenceReports(
  result: M41aOperationalScenarioResult,
): Readonly<Record<string, unknown>> {
  const scopeOrder = ["ENTERPRISE", "BHC", "GRO", "EO", "GAD"] as const;
  const metricRows = scopeOrder.flatMap((scope) =>
    result.dashboards[scope].metrics.map((metric) => ({
      scope,
      metricId: metric.definition.id,
      name: metric.definition.name,
      category: metric.definition.category,
      definition: metric.definition.description,
      formula: metric.definition.formula,
      sourceSystem: metric.definition.sourceSystem,
      sourceFields: metric.definition.sourceFields,
      owner: metric.definition.owner,
      refreshTime: metric.refreshTime,
      refreshCadence: metric.definition.refreshCadence,
      target: metric.definition.target,
      value: metric.value,
      variance: metric.variance,
      dataQualityState: metric.dataQualityState,
      dataQualityReasons: metric.dataQualityReasons,
      sourceReportId: metric.sourceReportId,
      sourceRecordIds: metric.sourceRecordIds,
      reconciliation: metric.reconciliation,
      maximumAuthorizedDrillDepth: metric.maximumAuthorizedDrillDepth,
      evidenceClass: metric.evidenceClass,
    })),
  );
  return {
    [M41A_EVIDENCE_FILES.executive]: result.dashboards.ENTERPRISE,
    [M41A_EVIDENCE_FILES.profitCenters]: {
      milestone: "M4.1A",
      evidenceClass: "synthetic_demo",
      dashboards: { BHC: result.dashboards.BHC, GRO: result.dashboards.GRO },
    },
    [M41A_EVIDENCE_FILES.corporateOffices]: {
      milestone: "M4.1A",
      evidenceClass: "synthetic_demo",
      dashboards: { EO: result.dashboards.EO, GAD: result.dashboards.GAD },
    },
    [M41A_EVIDENCE_FILES.drilldown]: {
      milestone: "M4.1A",
      maximumClicks: 3,
      evidenceClass: "synthetic_demo",
      paths: result.drilldownEvidence,
    },
    [M41A_EVIDENCE_FILES.lineage]: {
      milestone: "M4.1A",
      evidenceClass: "synthetic_demo",
      metrics: metricRows,
      sourceRegister: result.sourceRegister,
      reconciliations: result.reconciliations,
    },
    [M41A_EVIDENCE_FILES.alertDecision]: {
      milestone: "M4.1A",
      evidenceClass: "synthetic_demo",
      alerts: result.alerts,
      decisions: result.decisions,
      followUpEvidence: result.followUpEvidence,
      auditEvents: result.auditEvents,
    },
    [M41A_EVIDENCE_FILES.access]: {
      milestone: "M4.1A",
      evidenceClass: "synthetic_demo",
      evaluations: result.accessEvaluations,
    },
    [M41A_EVIDENCE_FILES.dataQuality]: {
      milestone: "M4.1A",
      evidenceClass: "synthetic_demo",
      scenarios: result.dataQualityScenarios,
      reconciliations: result.reconciliations,
    },
  };
}

function summary(result: M41aOperationalScenarioResult): string {
  const rows = result.criteria
    .map(
      (criterion) =>
        `| ${criterion.criterionId} | PASS | ${criterion.summary.replaceAll("|", "\\|")} |`,
    )
    .join("\n");
  return `# AMOS-OPS M4.1A — Acceptance Summary

**Milestone:** Executive Decision Intelligence Operational  
**Status:** COMPLETE  
**Evidence boundary:** Synthetic demonstration only  
**Criteria verified:** 8/8  
**Exit gate:** PASS  
**Production rows:** 0

| Criterion | Status | Evidence summary |
|---|---|---|
${rows}

## Verified experience

- Managing Director dashboard: three-stage census, revenue vs budget, Profit Center performance, compliance, and strategic initiatives.
- BHC and GRO dashboards: revenue, census, utilization, outcomes, service timeliness, and operational risk.
- EO and GAD dashboards: compliance, cost, workforce, facilities, procurement, and support performance.
- Authorized supporting detail is reachable within three clicks; sensitive detail is suppressed server-side.
- Threshold alerts complete acknowledgement, assignment, human decision, follow-up evidence, and resolution.
- Missing and contradictory sources remain unavailable rather than becoming zero; stale sources remain visibly stale.

M4.1B assistant/workplan orchestration, M4.1C clinical intelligence, and later DMS/Microsoft connector work are not claimed by this evidence set.
`;
}

export async function exportM41aEvidence(
  options: M41aEvidenceOptions,
  suppliedResult?: unknown,
) {
  const result = validateM41aScenario(
    suppliedResult ?? (await loadScenario(options.root)),
  );
  assertM41a(
    !path.resolve(options.output).startsWith(`${m41aSourceRoot(options.root)}${path.sep}`),
    "M4.1A evidence output cannot be written inside the canonical source tree.",
  );
  fs.mkdirSync(options.output, { recursive: true });

  const scenarioPath = path.join(options.output, M41A_EVIDENCE_FILES.scenario);
  atomicWriteM41a(scenarioPath, stableM41aJson(result));
  const reports = buildM41aEvidenceReports(result);
  for (const [fileName, report] of Object.entries(reports))
    atomicWriteM41a(path.join(options.output, fileName), stableM41aJson(report));
  atomicWriteM41a(
    path.join(options.output, M41A_EVIDENCE_FILES.summary),
    summary(result),
  );

  const inventoryNames = [
    M41A_EVIDENCE_FILES.scenario,
    ...Object.keys(reports),
    M41A_EVIDENCE_FILES.summary,
  ].sort();
  const inventory = inventoryNames.map((fileName) =>
    m41aFileRecord(path.join(options.output, fileName), fileName),
  );
  const manifest = {
    schemaVersion: "1.0",
    recordId: "AMOS-OPS-M4.1A-ACCEPTANCE-EVIDENCE",
    milestone: "M4.1A",
    title: "Executive Decision Intelligence Operational",
    status: "complete",
    evidenceClass: "synthetic_demo",
    criteriaExpected: 8,
    criteriaPassed: 8,
    exitGate: true,
    syntheticBoundary: {
      dataMode: "synthetic_demo",
      productionRows: 0,
      usesProductionData: false,
      productionActionsBlocked: result.productionActionsBlocked,
    },
    scenario: {
      scenarioId: result.scenarioId,
      runId: result.runId,
      resultPath: M41A_EVIDENCE_FILES.scenario,
    },
    criteria: result.criteria,
    dashboards: {
      scopes: ["ENTERPRISE", "BHC", "GRO", "EO", "GAD"],
      metrics: Object.values(result.dashboards).reduce(
        (count, dashboard) => count + dashboard.metrics.length,
        0,
      ),
    },
    controlReferences: m41aControlReferences(m41aMilestoneRoot(options.root)),
    inventory,
    nonredundancy: {
      canonicalSourceTrees: 1,
      integratedScenarioExecutions: 1,
      duplicateDashboardEngines: 0,
      sourceCopiesInEvidence: 0,
    },
  } as const;
  const manifestPath = path.join(options.output, M41A_EVIDENCE_FILES.manifest);
  atomicWriteM41a(manifestPath, stableM41aJson(manifest));
  const checksumRecords = [...inventory, m41aFileRecord(manifestPath, M41A_EVIDENCE_FILES.manifest)]
    .sort((left, right) => left.path.localeCompare(right.path));
  atomicWriteM41a(
    path.join(options.output, M41A_EVIDENCE_FILES.checksums),
    `${checksumRecords.map((record) => `${record.sha256}  ${record.path}`).join("\n")}\n`,
  );
  assertM41a(
    JSON.stringify(result.criteria.map((criterion) => criterion.criterionId).sort()) ===
      JSON.stringify([...M41A_CRITERIA].sort()),
    "M4.1A controlling criteria drifted during export.",
  );
  return manifest;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  try {
    console.log(
      JSON.stringify(
        await exportM41aEvidence(
          parseM41aEvidenceOptions(process.argv.slice(2)),
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
