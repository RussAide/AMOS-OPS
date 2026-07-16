import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  KPI_DEFINITIONS,
  MGMA_DOMAIN_MAPPINGS,
} from "../contracts/mgma/baseline";

const evidenceRoot = path.resolve(process.argv[2] ?? "../evidence");

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function parseCsv(value: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quoted) {
      if (character === '"' && value[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        cell += character;
      }
    } else if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(cell);
      cell = "";
    } else if (character === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  assert(!quoted, "CSV ended inside a quoted field.");
  return rows.filter((candidate) => candidate.some((entry) => entry !== ""));
}

function readCsv(relativePath: string): Array<Record<string, string>> {
  const rows = parseCsv(
    fs.readFileSync(path.join(evidenceRoot, relativePath), "utf8"),
  );
  const headers = rows[0];
  assert(headers, `${relativePath} has no header row.`);
  return rows.slice(1).map((row, rowIndex) => {
    assert(
      row.length === headers.length,
      `${relativePath} row ${rowIndex + 2} has ${row.length} cells; expected ${headers.length}.`,
    );
    return Object.fromEntries(
      headers.map((header, index) => [header, row[index] ?? ""]),
    );
  });
}

const mapping = readCsv(
  "01_Domain_Mapping_and_KPI_Dictionary/M1_3_SEVEN_DOMAIN_MAPPING.csv",
);
assert(
  mapping.length === 7,
  `Expected 7 domain rows; found ${mapping.length}.`,
);
mapping.forEach((row, index) => {
  const definition = MGMA_DOMAIN_MAPPINGS[index];
  assert(
    row.domain_id === `M13-${definition.id}`,
    `Domain ${index + 1} ID drift.`,
  );
  assert(
    row.domain_name === definition.name,
    `Domain ${definition.id} name drift.`,
  );
  assert(
    row.accountable_owner_role === definition.accountableOwner.roleLabel,
    `Domain ${definition.id} owner drift.`,
  );
  assert(
    row.responsible_division === definition.responsibleDivision,
    `Domain ${definition.id} division drift.`,
  );
  assert(
    row.routes.includes(definition.routes[0]),
    `Domain ${definition.id} route drift.`,
  );
});

const dictionary = readCsv(
  "01_Domain_Mapping_and_KPI_Dictionary/M1_3_KPI_DATA_DICTIONARY.csv",
);
assert(
  dictionary.length === 14,
  `Expected 14 KPI rows; found ${dictionary.length}.`,
);
dictionary.forEach((row, index) => {
  const definition = KPI_DEFINITIONS[index];
  const comparison = definition.comparison === "lte" ? "<=" : ">=";
  assert(
    row.kpi_id === `M13-KPI-${definition.id}`,
    `KPI ${index + 1} ID drift.`,
  );
  assert(
    row.domain_id === `M13-${definition.domainId}`,
    `KPI ${definition.id} domain drift.`,
  );
  assert(row.kpi_name === definition.name, `KPI ${definition.id} name drift.`);
  assert(
    row.formula === definition.formula,
    `KPI ${definition.id} formula drift.`,
  );
  assert(
    row.refresh_cadence === definition.refreshCadence,
    `KPI ${definition.id} cadence drift.`,
  );
  assert(
    row.accountable_owner_role === definition.owner.roleLabel,
    `KPI ${definition.id} owner drift.`,
  );
  assert(
    row.responsible_division === definition.owner.division,
    `KPI ${definition.id} division drift.`,
  );
  assert(
    row.comparison_operator === comparison,
    `KPI ${definition.id} comparison drift.`,
  );
  assert(
    row.target_value === String(definition.target),
    `KPI ${definition.id} target drift.`,
  );
  assert(
    row.drill_down_path === definition.drillDownPath,
    `KPI ${definition.id} drill-down drift.`,
  );
  assert(
    row.stale_after_hours === String(definition.staleAfterHours),
    `KPI ${definition.id} stale-window drift.`,
  );
  assert(
    row.production_baseline_status ===
      "Not measured; no production evidence or data loaded",
    `KPI ${definition.id} production posture drift.`,
  );
});

const ownerReviews = readCsv(
  "04_Owner_Approval_and_Governance/M1_3_OWNER_REVIEW_REGISTER.csv",
);
const kpiReviews = ownerReviews.filter(
  (row) => row.control_type === "KPI definition and target",
);
assert(
  kpiReviews.length === 14,
  `Expected 14 KPI owner reviews; found ${kpiReviews.length}.`,
);
KPI_DEFINITIONS.forEach((definition) => {
  const review = kpiReviews.find(
    (candidate) => candidate.control_id === `M13-KPI-${definition.id}`,
  );
  assert(review, `Missing owner review for KPI ${definition.id}.`);
  assert(
    review.owner_role === definition.owner.roleLabel,
    `KPI ${definition.id} review owner drift.`,
  );
  assert(
    review.responsible_division === definition.owner.division,
    `KPI ${definition.id} review division drift.`,
  );
  assert(
    review.milestone_owner_acceptance === "Pending",
    `KPI ${definition.id} was prematurely accepted.`,
  );
  assert(
    review.real_person_or_signature === "None; role placeholder only",
    `KPI ${definition.id} fabricates an approver.`,
  );
});

const scenarios = readCsv("05_Scenarios/M1_3_SCENARIO_INVENTORY.csv");
assert(
  scenarios.length === 10,
  `Expected 10 scenario rows; found ${scenarios.length}.`,
);
const expectedReasonCodes = new Map([
  ["SCN-M13-003", "DQ_COMPLETENESS_MISSING_REQUIRED_FIELD"],
  ["SCN-M13-004", "DQ_TIMELINESS_COLLECTION_LATE"],
  ["SCN-M13-005", "DQ_DUPLICATE_MEASUREMENT_ID | DQ_DUPLICATE_NATURAL_KEY"],
  ["SCN-M13-006", "DQ_DENOMINATOR_NON_POSITIVE"],
  ["SCN-M13-007", "DQ_STALE_DATA"],
]);
for (const [scenarioId, expectedReasonCode] of expectedReasonCodes) {
  const scenario = scenarios.find(
    (candidate) => candidate.scenario_id === scenarioId,
  );
  assert(scenario, `Missing ${scenarioId}.`);
  assert(
    scenario.expected_reason_code === expectedReasonCode,
    `${scenarioId} reason-code drift.`,
  );
}

const scorecardSpec = fs.readFileSync(
  path.join(
    evidenceRoot,
    "02_Baseline_Scorecards_and_Data_Quality/M1_3_BASELINE_SCORECARD_SPEC.md",
  ),
  "utf8",
);
assert(
  scorecardSpec.includes(
    "19 migration-owned `synthetic_demo` measurement rows",
  ),
  "Scorecard specification is not reconciled to the migration preview.",
);
assert(
  /M13-KPI-012[^\n]+≥ 98%/.test(scorecardSpec),
  "KPI-012 scorecard target is not the controlled 98% target.",
);

const dataQualityReport = fs.readFileSync(
  path.join(
    evidenceRoot,
    "02_Baseline_Scorecards_and_Data_Quality/M1_3_DATA_QUALITY_REPORT.md",
  ),
  "utf8",
);
for (const legacyReasonCode of [
  "DQ_COMPLETENESS_FAILED",
  "DQ_TIMELINESS_FAILED",
  "DQ_DUPLICATION_FAILED",
  "DQ_DENOMINATOR_INVALID",
  "DQ_STALE_DATA_FAILED",
]) {
  assert(
    !dataQualityReport.includes(legacyReasonCode),
    `Data-quality report contains legacy reason code ${legacyReasonCode}.`,
  );
}

console.log(
  JSON.stringify(
    {
      status: "PASS",
      evidenceRoot,
      domains: mapping.length,
      kpis: dictionary.length,
      ownerReviews: ownerReviews.length,
      scenarios: scenarios.length,
      productionBaseline: "not_measured_no_production_data_loaded",
      legacyReasonCodes: 0,
    },
    null,
    2,
  ),
);
