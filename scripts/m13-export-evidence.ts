import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import {
  KPI_DEFINITIONS,
  MGMA_DOMAIN_MAPPINGS,
  validateDomainMappings,
  validateKpiDefinitions,
} from "../contracts/mgma/baseline";

const root = path.resolve(process.argv[2] ?? "../evidence");
const mappingDirectory = path.join(
  root,
  "01_Domain_Mapping_and_KPI_Dictionary",
);
const qaDirectory = path.join(root, "90_Manifest_and_QA");

fs.mkdirSync(mappingDirectory, { recursive: true });
fs.mkdirSync(qaDirectory, { recursive: true });

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
const csv = (headers: string[], rows: unknown[][]) =>
  [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
const write = (filePath: string, value: string) =>
  fs.writeFileSync(filePath, value.endsWith("\n") ? value : `${value}\n`);
const databaseDomainId = (id: string) => `M13-${id}`;
const databaseKpiId = (id: string) => `M13-KPI-${id}`;
const scopeLabel = (scope: { scopeType: string; scopeId: string }) =>
  `${scope.scopeType}:${scope.scopeId}`;
const targetOperator = (comparison: "lte" | "gte") =>
  comparison === "lte" ? "<=" : ">=";
const thresholdText = (
  comparison: "lte" | "gte",
  target: number,
  threshold: number,
) =>
  comparison === "lte"
    ? `On target <= ${target}; at risk > ${target} and <= ${threshold}; off target > ${threshold}`
    : `On target >= ${target}; at risk < ${target} and >= ${threshold}; off target < ${threshold}`;

const domainValidation = validateDomainMappings(MGMA_DOMAIN_MAPPINGS);
const kpiValidation = validateKpiDefinitions(KPI_DEFINITIONS);
if (!domainValidation.valid || !kpiValidation.valid) {
  throw new Error(
    `M1.3 contract validation failed: ${JSON.stringify({ domainValidation, kpiValidation })}`,
  );
}

write(
  path.join(mappingDirectory, "M1_3_SEVEN_DOMAIN_MAPPING.csv"),
  csv(
    [
      "domain_id",
      "sequence",
      "domain_name",
      "purpose",
      "amos_ops_modules",
      "routes",
      "workflows",
      "accountable_owner_role",
      "accountable_owner_division",
      "source_systems",
      "source_entities",
      "source_key_fields",
      "responsible_division",
      "corporate_office_sponsor_role",
      "corporate_office_sponsor_division",
      "consuming_scopes",
      "baseline_state",
    ],
    MGMA_DOMAIN_MAPPINGS.map((domain, index) => [
      databaseDomainId(domain.id),
      index + 1,
      domain.name,
      domain.purpose,
      domain.modules.join(" | "),
      domain.routes.join(" | "),
      domain.workflows.join(" | "),
      domain.accountableOwner.roleLabel,
      domain.accountableOwner.division,
      domain.sourceData.map((source) => source.system).join(" | "),
      domain.sourceData.flatMap((source) => source.entities).join(" | "),
      domain.sourceData.flatMap((source) => source.keyFields).join(" | "),
      domain.responsibleDivision,
      domain.corporateOfficeSponsor.roleLabel,
      domain.corporateOfficeSponsor.division,
      domain.consumingScopes.map(scopeLabel).join(" | "),
      "Mapped; production baseline not measured",
    ]),
  ),
);

write(
  path.join(mappingDirectory, "M1_3_KPI_DATA_DICTIONARY.csv"),
  csv(
    [
      "kpi_id",
      "kpi_name",
      "domain_id",
      "domain_name",
      "definition",
      "unit",
      "formula",
      "numerator",
      "denominator",
      "source_system",
      "required_fields",
      "refresh_cadence",
      "accountable_owner_role",
      "responsible_division",
      "comparison_operator",
      "target_value",
      "target_display",
      "status_thresholds",
      "drill_down_path",
      "stale_after_hours",
      "consuming_scopes",
      "target_basis",
      "target_approval_status",
      "production_baseline_status",
      "synthetic_preview_allowed",
    ],
    KPI_DEFINITIONS.map((kpi) => {
      const domain = MGMA_DOMAIN_MAPPINGS.find(
        (candidate) => candidate.id === kpi.domainId,
      );
      return [
        databaseKpiId(kpi.id),
        kpi.name,
        databaseDomainId(kpi.domainId),
        domain?.name ?? "",
        kpi.description,
        kpi.unit,
        kpi.formula,
        `${kpi.numerator.name}: ${kpi.numerator.definition}`,
        `${kpi.denominator.name}: ${kpi.denominator.definition}`,
        kpi.sourceSystem,
        kpi.sourceFields.join(" | "),
        kpi.refreshCadence,
        kpi.owner.roleLabel,
        kpi.owner.division,
        targetOperator(kpi.comparison),
        kpi.target,
        `${targetOperator(kpi.comparison)} ${kpi.target} ${kpi.unit}`,
        thresholdText(kpi.comparison, kpi.target, kpi.threshold.value),
        kpi.drillDownPath,
        kpi.staleAfterHours,
        kpi.relevantScopes.map(scopeLabel).join(" | "),
        `${kpi.targetBasis.label}: ${kpi.targetBasis.statement}`,
        `${kpi.approval.status}; ${kpi.approval.approvalReference}; version ${kpi.approval.version}`,
        "Not measured; no production evidence or data loaded",
        "Yes; separately labeled synthetic demo only",
      ];
    }),
  ),
);

write(
  path.join(mappingDirectory, "M1_3_SEVEN_DOMAIN_MAPPING.md"),
  `# M1.3 Seven-Domain Mapping

This mapping is generated directly from the validated M1.3 contract in \`contracts/mgma/baseline.ts\`. It describes the prototype configuration and does not assert a measured production baseline.

| ID | Domain | Modules | Accountable owner | Responsible division | Corporate Office sponsor | Consuming scopes |
|---|---|---|---|---|---|---|
${MGMA_DOMAIN_MAPPINGS.map(
  (domain) =>
    `| ${databaseDomainId(domain.id)} | ${domain.name} | ${domain.modules.join("; ")} | ${domain.accountableOwner.roleLabel} (${domain.accountableOwner.division}) | ${domain.responsibleDivision} | ${domain.corporateOfficeSponsor.roleLabel} (${domain.corporateOfficeSponsor.division}) | ${domain.consumingScopes.map(scopeLabel).join("; ")} |`,
).join("\n")}

## Reconciliation result

- Exactly seven controlled domains: PASS.
- Every domain has modules, routes, workflows, an accountable owner, source systems/entities/key fields, a responsible division, a Corporate Office sponsor, and consuming scopes: PASS.
- Contract validation findings: 0.
- Production baseline state: Not measured; no production data loaded.

The companion CSV contains the complete route, workflow, source-entity, and source-key-field mapping.
`,
);

write(
  path.join(mappingDirectory, "M1_3_KPI_DATA_DICTIONARY.md"),
  `# M1.3 KPI Data Dictionary

This dictionary is generated directly from the validated M1.3 contract in \`contracts/mgma/baseline.ts\`. All targets are controlled internal prototype thresholds; none is represented as a proprietary MGMA benchmark, percentile, survey result, or production result.

| KPI | Domain | Formula | Target | Cadence | Owner | Production state |
|---|---|---|---|---|---|---|
${KPI_DEFINITIONS.map(
  (kpi) =>
    `| ${databaseKpiId(kpi.id)} — ${kpi.name} | ${databaseDomainId(kpi.domainId)} | ${kpi.formula} | ${targetOperator(kpi.comparison)} ${kpi.target} ${kpi.unit} | ${kpi.refreshCadence} | ${kpi.owner.roleLabel} (${kpi.owner.division}) | Not measured |`,
).join("\n")}

## Control result

- Controlled KPI definitions: ${KPI_DEFINITIONS.length}.
- Checklist targets configured: 8 (KPI-001 through KPI-008).
- Each KPI includes its formula, numerator, denominator, source system and fields, cadence, owner, target, threshold, drill-down path, stale window, consuming scopes, and approval metadata.
- Contract validation findings: 0.
- Synthetic previews are permitted only in the segregated, visibly labeled demonstration mode.

The companion CSV is the authoritative human-readable export of the implemented contract.
`,
);

const reconciliation = {
  generatedOn: "2026-07-14",
  sourceOfTruth: "contracts/mgma/baseline.ts",
  dataPosture: "fictional-and-synthetic-prototype-only",
  domains: MGMA_DOMAIN_MAPPINGS.length,
  kpis: KPI_DEFINITIONS.length,
  checklistTargets: KPI_DEFINITIONS.slice(0, 8).map((kpi) =>
    databaseKpiId(kpi.id),
  ),
  domainValidation,
  kpiValidation,
  productionBaseline: "not_measured_no_production_data_loaded",
};
write(
  path.join(qaDirectory, "M1_3_CONTRACT_RECONCILIATION.json"),
  JSON.stringify(reconciliation, null, 2),
);

console.log(JSON.stringify(reconciliation, null, 2));
