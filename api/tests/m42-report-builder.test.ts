import { describe, expect, it } from "vitest";
import type { M42ActorContext, M42RoleTier } from "@contracts/m42/shared";
import type { UserRole } from "../../src/constants/roles";
import {
  createSyntheticM42ReportBuilder,
  type M42GovernedReportBuilder,
} from "../services/m42/report-builder";

function actor(input: {
  actorId: string;
  role: UserRole;
  tier: M42RoleTier;
  permissions: readonly string[];
  clearance?: M42ActorContext["sensitivityClearance"];
}): M42ActorContext {
  return Object.freeze({
    actorId: input.actorId,
    role: input.role,
    tier: input.tier,
    divisionIds: Object.freeze(["eo"] as const),
    permissions: Object.freeze([...input.permissions]),
    sensitivityClearance:
      input.clearance ?? Object.freeze(["public", "internal", "confidential"]),
    minimumNecessaryPurpose: "Evaluate governed synthetic M4.2 reports.",
    synthetic: true,
  });
}

const t1 = actor({
  actorId: "SYNTH-M42-REPORT-T1",
  role: "managing-director",
  tier: "T1",
  permissions: [
    "m42:report:build",
    "m42:report:export",
    "m42:report:clinical-aggregate",
    "m42:report:finance",
    "m42:report:restricted",
  ],
  clearance: ["public", "internal", "confidential", "restricted"],
});

const t2 = actor({
  actorId: "SYNTH-M42-REPORT-T2",
  role: "bhc-director",
  tier: "T2",
  permissions: [
    "m42:report:build",
    "m42:report:export",
    "m42:report:clinical-aggregate",
  ],
});

function saveFinanceDefinition(builder: M42GovernedReportBuilder) {
  return builder.saveDefinition(
    t1,
    {
      stableKey: "SYNTH-M42-REPORT-FINANCE",
      title: "Synthetic division finance review",
      purpose: "Review fictional aggregate operating results by division.",
      sourceId: "SYNTH-M42-SOURCE-OPERATIONS",
      selectedFieldIds: [
        "record_id",
        "division",
        "service_count",
        "restricted_control_note",
      ],
      filters: [{ fieldId: "division", operator: "equals", value: "BHC" }],
      exportEnabled: true,
    },
    "2026-12-15T08:10:00.000Z",
  );
}

describe("M4.2 governed report builder", () => {
  it("makes the builder available to authorized T1 and T2 actors and denies T3/T4", () => {
    const builder = createSyntheticM42ReportBuilder();
    expect(
      builder
        .listAvailableFields(t1, "SYNTH-M42-SOURCE-OPERATIONS")
        .map((field) => field.fieldId),
    ).toEqual([
      "record_id",
      "division",
      "service_count",
      "net_revenue",
      "restricted_control_note",
    ]);
    expect(
      builder
        .listAvailableFields(t2, "SYNTH-M42-SOURCE-OPERATIONS")
        .map((field) => field.fieldId),
    ).toEqual(["record_id", "division", "service_count"]);

    for (const tier of ["T3", "T4"] as const) {
      const denied = actor({
        actorId: `SYNTH-M42-REPORT-${tier}`,
        role: "billing-specialist",
        tier,
        permissions: ["*"],
        clearance: [
          "public",
          "internal",
          "confidential",
          "restricted",
          "part2",
        ],
      });
      expect(() =>
        builder.listAvailableFields(denied, "SYNTH-M42-SOURCE-OPERATIONS"),
      ).toThrow(`M42_REPORT_TIER_ACCESS_DENIED:${tier}`);
    }
  });

  it("saves immutable versioned definitions instead of overwriting history", () => {
    const builder = createSyntheticM42ReportBuilder();
    const first = saveFinanceDefinition(builder);
    const second = builder.saveDefinition(
      t1,
      {
        ...first,
        title: "Synthetic division finance and control review",
        selectedFieldIds: ["record_id", "division", "service_count"],
      },
      "2026-12-15T08:11:00.000Z",
    );

    expect(first).toMatchObject({
      definitionId: "SYNTH-M42-REPORT-FINANCE-V1",
      version: 1,
      previousDefinitionId: null,
      immutable: true,
    });
    expect(second).toMatchObject({
      definitionId: "SYNTH-M42-REPORT-FINANCE-V2",
      version: 2,
      previousDefinitionId: first.definitionId,
      immutable: true,
    });
    expect(builder.definitionHistory(first.stableKey)).toEqual([first, second]);
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.selectedFieldIds)).toBe(true);
    expect(Object.isFrozen(first.filters)).toBe(true);
    expect(
      builder
        .snapshot()
        .auditEvents.filter((event) => event.eventType === "report_saved"),
    ).toHaveLength(2);
  });

  it("validates filter types and operators and denies unauthorized field selection", () => {
    const builder = createSyntheticM42ReportBuilder();
    expect(() =>
      builder.saveDefinition(
        t2,
        {
          stableKey: "SYNTH-M42-REPORT-UNAUTHORIZED",
          title: "Unauthorized report",
          purpose:
            "Attempt to include a field outside minimum necessary access.",
          sourceId: "SYNTH-M42-SOURCE-OPERATIONS",
          selectedFieldIds: ["restricted_control_note"],
          filters: [],
          exportEnabled: false,
        },
        "2026-12-15T08:10:00.000Z",
      ),
    ).toThrow("M42_REPORT_FIELD_ACCESS_DENIED:restricted_control_note");

    expect(() =>
      builder.saveDefinition(
        t1,
        {
          stableKey: "SYNTH-M42-REPORT-BAD-FILTER",
          title: "Invalid filter report",
          purpose:
            "Prove that malformed filters cannot become saved definitions.",
          sourceId: "SYNTH-M42-SOURCE-OPERATIONS",
          selectedFieldIds: ["record_id"],
          filters: [
            { fieldId: "net_revenue", operator: "contains", value: "100" },
          ],
          exportEnabled: false,
        },
        "2026-12-15T08:10:00.000Z",
      ),
    ).toThrow("M42_REPORT_FILTER_OPERATOR_INVALID:net_revenue:contains");
  });

  it("permission-trims fields before selection and preserves source lineage", () => {
    const builder = createSyntheticM42ReportBuilder();
    const definition = saveFinanceDefinition(builder);
    const execution = builder.executeDefinition(
      t2,
      definition.definitionId,
      "2026-12-15T08:12:00.000Z",
    );

    expect(execution).toMatchObject({
      definitionVersion: 1,
      rowCount: 2,
      selectedFieldIds: ["record_id", "division", "service_count"],
      concealedFieldIds: ["restricted_control_note"],
      permissionTrimmedBeforeSelection: true,
      realDataUsed: false,
      externalWritePerformed: false,
    });
    expect(execution.rows).toEqual([
      {
        record_id: "SYNTH-M42-ROW-001",
        division: "BHC",
        service_count: 42,
      },
      {
        record_id: "SYNTH-M42-ROW-003",
        division: "BHC",
        service_count: 27,
      },
    ]);
    expect(
      execution.rows.every(
        (row) =>
          !("restricted_control_note" in row) && !("net_revenue" in row),
      ),
    ).toBe(true);
    expect(execution.lineage).toMatchObject({
      definitionId: definition.definitionId,
      definitionVersion: 1,
      sourceIds: ["SYNTH-M42-SOURCE-OPERATIONS"],
      immutable: true,
    });
    expect(execution.lineage.definitionHash).toMatch(/^[a-f0-9]{64}$/);
    expect(execution.lineage.fields.map((field) => field.fieldId)).toEqual(
      execution.selectedFieldIds,
    );
    expect(execution.lineage.sourceCitations[0]).toMatchObject({
      stableObjectId: "SYNTH-M42-STABLE-OPERATIONS",
      sourceOfTruthUri: "amos-synthetic://m42/sources/operations/v1",
      synthetic: true,
    });
  });

  it("creates a controlled export manifest without a file, recipient, or live write", () => {
    const builder = createSyntheticM42ReportBuilder();
    const definition = saveFinanceDefinition(builder);
    const execution = builder.executeDefinition(
      t2,
      definition.definitionId,
      "2026-12-15T08:12:00.000Z",
    );
    const manifest = builder.createExportManifest(
      t2,
      execution,
      "csv-manifest",
      "2026-12-15T08:13:00.000Z",
    );

    expect(manifest).toMatchObject({
      executionId: execution.executionId,
      fieldIds: ["record_id", "division", "service_count"],
      concealedFieldIds: ["restricted_control_note"],
      rowCount: 2,
      deliveryStatus: "manifest_only_demo_boundary",
      externalRecipient: null,
      liveRepositoryWrite: false,
      realDataUsed: false,
      immutable: true,
    });
    expect(manifest.contentSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(
      builder.snapshot().auditEvents.map((event) => event.eventType),
    ).toEqual(["report_saved", "report_executed", "export_manifest_created"]);
    expect(() => builder.assertLiveExportUnavailable()).toThrow(
      "M42_LIVE_REPORT_EXPORT_UNAVAILABLE",
    );
  });

  it("requires explicit export permission and blocks non-exportable fields", () => {
    const builder = createSyntheticM42ReportBuilder();
    const noExportActor = actor({
      actorId: "SYNTH-M42-REPORT-NO-EXPORT",
      role: "administrator",
      tier: "T1",
      permissions: ["m42:report:build", "m42:report:finance"],
    });
    expect(() =>
      builder.saveDefinition(
        noExportActor,
        {
          stableKey: "SYNTH-M42-REPORT-NO-EXPORT",
          title: "Export permission check",
          purpose:
            "Confirm that export must be separately and explicitly authorized.",
          sourceId: "SYNTH-M42-SOURCE-OPERATIONS",
          selectedFieldIds: ["record_id"],
          filters: [],
          exportEnabled: true,
        },
        "2026-12-15T08:10:00.000Z",
      ),
    ).toThrow("M42_REPORT_EXPORT_PERMISSION_REQUIRED");

    const definition = saveFinanceDefinition(builder);
    const t1Execution = builder.executeDefinition(
      t1,
      definition.definitionId,
      "2026-12-15T08:12:00.000Z",
    );
    expect(() =>
      builder.createExportManifest(
        t1,
        t1Execution,
        "json-manifest",
        "2026-12-15T08:13:00.000Z",
      ),
    ).toThrow("M42_REPORT_FIELD_NOT_EXPORTABLE:restricted_control_note");
  });
});
