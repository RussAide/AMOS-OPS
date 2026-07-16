import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  KPI_DEFINITIONS,
  MGMA_DOMAIN_MAPPINGS,
} from "../../contracts/mgma/baseline";

const databasePath = path.join(
  "/tmp",
  `amos-ops-m13-integration-${randomUUID()}.db`,
);
const originalDatabasePath = process.env.DATABASE_PATH;
const originalNodeEnvironment = process.env.NODE_ENV;
let buildMgmaDashboard: typeof import("../routers/mgma").buildMgmaDashboard;
let mgmaRouter: typeof import("../routers/mgma").mgmaRouter;

function applyMigrations(targetPath: string): void {
  const db = new Database(targetPath);
  try {
    db.pragma("foreign_keys = ON");
    const migrationDirectory = path.resolve("db/migrations");
    const migrations = fs
      .readdirSync(migrationDirectory)
      .filter((name) => /^\d{4}_.+\.sql$/.test(name))
      .sort();
    for (const migration of migrations) {
      const sql = fs.readFileSync(
        path.join(migrationDirectory, migration),
        "utf8",
      );
      const statements = sql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);
      db.transaction(() => {
        for (const statement of statements) db.exec(statement);
      })();
    }
    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(db.pragma("foreign_key_check")).toEqual([]);
  } finally {
    db.close();
  }
}

beforeAll(async () => {
  applyMigrations(databasePath);
  process.env.DATABASE_PATH = databasePath;
  process.env.NODE_ENV = "test";
  const module = await import("../routers/mgma");
  buildMgmaDashboard = module.buildMgmaDashboard;
  mgmaRouter = module.mgmaRouter;
});

afterAll(() => {
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
  if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnvironment;
});

describe("M1.3 controlled MGMA migration", () => {
  it("installs the exact controlled inventory without production evidence", () => {
    const db = new Database(databasePath, { readonly: true });
    try {
      const count = (sql: string) =>
        (db.prepare(sql).get() as { count: number }).count;
      expect(count("SELECT COUNT(*) AS count FROM mgma_domains")).toBe(7);
      expect(count("SELECT COUNT(*) AS count FROM mgma_kpi_targets")).toBe(14);
      expect(
        count(
          "SELECT COUNT(*) AS count FROM mgma_kpi_targets WHERE is_checklist_target = 1",
        ),
      ).toBe(8);
      expect(
        count(
          "SELECT COUNT(*) AS count FROM mgma_measurements WHERE evidence_class = 'synthetic_demo'",
        ),
      ).toBe(19);
      expect(
        count(
          "SELECT COUNT(*) AS count FROM mgma_measurements WHERE evidence_class = 'production'",
        ),
      ).toBe(0);
      expect(
        count("SELECT COUNT(*) AS count FROM mgma_data_quality_results"),
      ).toBe(95);
      expect(count("SELECT COUNT(*) AS count FROM mgma_owner_approvals")).toBe(
        14,
      );
      expect(
        count("SELECT COUNT(*) AS count FROM mgma_dashboard_governance"),
      ).toBe(1);
    } finally {
      db.close();
    }
  });

  it("does not seed unlabeled current values or proprietary benchmark claims", () => {
    const db = new Database(databasePath, { readonly: true });
    try {
      const unsafeCurrentValues = (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM mgma_kpi_targets WHERE current_value IS NOT NULL OR last_measured_at IS NOT NULL OR status <> 'not_measured'",
          )
          .get() as { count: number }
      ).count;
      const proprietaryClaims = (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM mgma_kpi_targets WHERE lower(benchmark_source) LIKE 'mgma %' OR lower(target_basis) LIKE 'mgma %'",
          )
          .get() as { count: number }
      ).count;
      expect(unsafeCurrentValues).toBe(0);
      expect(proprietaryClaims).toBe(0);
    } finally {
      db.close();
    }
  });

  it("keeps the migration seed aligned with the validated contract", () => {
    const db = new Database(databasePath, { readonly: true });
    try {
      const domainRows = db
        .prepare(
          `SELECT id, domain_number AS domainNumber, domain_name AS domainName,
                  domain_description AS domainDescription, amos_ops_module AS amosOpsModule,
                  module_route AS moduleRoute, workflow_ids_json AS workflowIdsJson,
                  accountable_owner AS accountableOwner, source_data_json AS sourceDataJson,
                  corporate_office_sponsor AS corporateOfficeSponsor,
                  consuming_scopes_json AS consumingScopesJson,
                  responsible_division AS responsibleDivision
             FROM mgma_domains ORDER BY domain_number`,
        )
        .all() as Array<Record<string, string | number>>;

      expect(domainRows).toHaveLength(MGMA_DOMAIN_MAPPINGS.length);
      domainRows.forEach((row, index) => {
        const definition = MGMA_DOMAIN_MAPPINGS[index];
        expect(row).toMatchObject({
          id: `M13-${definition.id}`,
          domainNumber: index + 1,
          domainName: definition.name,
          domainDescription: definition.purpose,
          amosOpsModule: definition.modules.join(" + "),
          moduleRoute: definition.routes[0],
          accountableOwner: definition.accountableOwner.roleLabel,
          corporateOfficeSponsor: definition.corporateOfficeSponsor.division,
          responsibleDivision: definition.responsibleDivision,
        });
        expect(JSON.parse(String(row.workflowIdsJson))).toEqual(
          definition.workflows,
        );
        expect(JSON.parse(String(row.sourceDataJson))).toEqual(
          definition.sourceData,
        );
        expect(JSON.parse(String(row.consumingScopesJson))).toEqual(
          definition.consumingScopes,
        );
      });

      const kpiRows = db
        .prepare(
          `SELECT id, domain_id AS domainId, kpi_name AS kpiName,
                  kpi_description AS kpiDescription, target_value AS targetValue,
                  target_unit AS targetUnit, comparison_operator AS comparisonOperator,
                  benchmark_source AS benchmarkSource, formula,
                  numerator_definition AS numeratorDefinition,
                  denominator_definition AS denominatorDefinition,
                  source_system AS sourceSystem, source_fields_json AS sourceFieldsJson,
                  owner_role AS ownerRole, drill_down_path AS drillDownPath,
                  target_basis AS targetBasis,
                  target_approval_status AS targetApprovalStatus,
                  stale_after_hours AS staleAfterHours, scope_ids_json AS scopeIdsJson,
                  is_checklist_target AS isChecklistTarget,
                  measurement_frequency AS measurementFrequency,
                  alert_threshold AS alertThreshold
             FROM mgma_kpi_targets ORDER BY id`,
        )
        .all() as Array<Record<string, string | number>>;

      expect(kpiRows).toHaveLength(KPI_DEFINITIONS.length);
      kpiRows.forEach((row, index) => {
        const definition = KPI_DEFINITIONS[index];
        expect(row).toMatchObject({
          id: `M13-KPI-${definition.id}`,
          domainId: `M13-${definition.domainId}`,
          kpiName: definition.name,
          kpiDescription: definition.description,
          targetValue: String(definition.target),
          targetUnit: definition.unit,
          comparisonOperator:
            definition.comparison === "lte"
              ? "less_than_or_equal"
              : "greater_than_or_equal",
          benchmarkSource: definition.targetBasis.label,
          formula: definition.formula,
          numeratorDefinition: definition.numerator.definition,
          denominatorDefinition: definition.denominator.definition,
          sourceSystem: definition.sourceSystem,
          ownerRole: definition.owner.roleLabel,
          drillDownPath: definition.drillDownPath,
          targetBasis: definition.targetBasis.statement,
          targetApprovalStatus: "prototype-reviewed",
          staleAfterHours: definition.staleAfterHours,
          isChecklistTarget: index < 8 ? 1 : 0,
          measurementFrequency: definition.refreshCadence,
          alertThreshold: String(definition.threshold.value),
        });
        expect(JSON.parse(String(row.sourceFieldsJson))).toEqual(
          definition.sourceFields,
        );
        expect(JSON.parse(String(row.scopeIdsJson))).toEqual(
          definition.relevantScopes.map((scope) => scope.scopeId),
        );
      });
    } finally {
      db.close();
    }
  });
});

describe("M1.3 dashboard evidence boundary", () => {
  it("mounts the controlled contract, scorecard, quality, governance, and synthetic-evidence procedures", () => {
    expect(Object.keys(mgmaRouter._def.record)).toEqual(
      expect.arrayContaining([
        "baselineContract",
        "listDomains",
        "getDomain",
        "listKpiTargets",
        "recordSyntheticMeasurement",
        "executiveDashboard",
        "dataQualityReport",
        "governanceSummary",
      ]),
    );
  });

  it("keeps the production baseline unmeasured when only synthetic evidence exists", async () => {
    const dashboard = await buildMgmaDashboard("production_baseline");
    expect(dashboard.viewMode).toBe("production_baseline");
    expect(dashboard.productionAssertion).toBe(false);
    expect(dashboard.overallScore).toBeNull();
    expect(dashboard.overallKpis).toEqual({
      total: 14,
      onTarget: 0,
      atRisk: 0,
      offTarget: 0,
      notMeasured: 14,
    });
    expect(dashboard.scopeSummaries).toHaveLength(4);
    expect(
      dashboard.scopeSummaries.every((scope) => scope.score === null),
    ).toBe(true);
    expect(dashboard.dataQuality.status).toBe("not_measured");
    expect(
      dashboard.dataQuality.checks.every(
        (check) => check.status === "not_measured",
      ),
    ).toBe(true);
  });

  it("computes a clearly labeled synthetic preview across all seven domains", async () => {
    const dashboard = await buildMgmaDashboard("synthetic_demo");
    expect(dashboard.viewMode).toBe("synthetic_demo");
    expect(dashboard.evidenceLabel).toContain("not production evidence");
    expect(dashboard.productionAssertion).toBe(false);
    expect(dashboard.domains).toHaveLength(7);
    expect(dashboard.overallKpis.total).toBe(14);
    expect(dashboard.overallKpis.notMeasured).toBe(0);
    expect(dashboard.overallScore).not.toBeNull();
    expect(dashboard.dataQuality.status).toBe("pass");
    expect(dashboard.dataQuality.checks).toHaveLength(5);
    expect(
      dashboard.dataQuality.checks.every((check) => check.status === "pass"),
    ).toBe(true);
    expect(dashboard.scopeSummaries.map((scope) => scope.scopeId)).toEqual([
      "BHC",
      "GRO",
      "EO",
      "GAD",
    ]);
  });
});
