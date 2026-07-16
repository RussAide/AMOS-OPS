import { describe, expect, it } from "vitest";
import { ALL_ROLES } from "../../src/constants/roles";
import { ROLE_TIER_BY_ROLE } from "../../src/constants/access-control";
import {
  buildAllM42ActorContexts,
  buildM42ActorContext,
  buildM42SearchActorContext,
  evaluateM42DocumentAccess,
  createSyntheticM42DocumentRegistry,
  createSyntheticM42ReportBuilder,
  createSyntheticM42ConfigurationAdmin,
  evaluateM42GovernedDocumentAction,
  listM42GovernedDocuments,
  runM42ConfigurationDemo,
  runM42ReportBuilderDemo,
  runM42VersionControlDemo,
} from "../services/m42";

describe("M4.2 canonical enterprise authorization integration", () => {
  it("uses the enterprise tier registry for every one of the 36 roles", () => {
    const contexts = buildAllM42ActorContexts();
    expect(contexts).toHaveLength(ALL_ROLES.length);
    for (const context of contexts)
      expect(context.tier).toBe(ROLE_TIER_BY_ROLE[context.role]);
  });

  it("makes a canonical T1 actor usable across records, reports, and administration", () => {
    const actor = buildM42ActorContext("managing-director");
    const registry = createSyntheticM42DocumentRegistry();
    const doctrine = registry.documents.find(
      (document) =>
        document.documentId === "SYNTH-DOCUMENT-ENTERPRISE-DOCTRINE",
    );
    expect(doctrine).toBeDefined();
    expect(
      evaluateM42DocumentAccess(doctrine!, actor, "content_read").allowed,
    ).toBe(true);
    expect(
      createSyntheticM42ReportBuilder().listAvailableFields(
        actor,
        "SYNTH-M42-SOURCE-OPERATIONS",
      ),
    ).toHaveLength(5);
    expect(
      createSyntheticM42ConfigurationAdmin().listSchemas(actor),
    ).toHaveLength(5);
  });

  it("gives canonical T2 leaders bounded report and configuration capabilities", () => {
    const actor = buildM42ActorContext("bhc-director");
    expect(actor.tier).toBe("T2");
    expect(
      createSyntheticM42ReportBuilder()
        .listAvailableFields(actor, "SYNTH-M42-SOURCE-OPERATIONS")
        .map((field) => field.fieldId),
    ).toEqual(["record_id", "division", "service_count"]);
    expect(
      createSyntheticM42ConfigurationAdmin()
        .listSchemas(actor)
        .map((schema) => schema.configKey),
    ).toEqual([
      "search.result_limit",
      "reporting.export.max_rows",
      "workspace.documents.default_view",
    ]);
  });

  it("denies report and configuration controls to canonical T3/T4 actors", () => {
    for (const role of ["facilities-manager", "case-manager"] as const) {
      const actor = buildM42ActorContext(role);
      expect(["T3", "T4"]).toContain(actor.tier);
      expect(() =>
        createSyntheticM42ReportBuilder().listAvailableFields(
          actor,
          "SYNTH-M42-SOURCE-OPERATIONS",
        ),
      ).toThrow(`M42_REPORT_TIER_ACCESS_DENIED:${actor.tier}`);
      expect(() =>
        createSyntheticM42ConfigurationAdmin().listSchemas(actor),
      ).toThrow(`M42_ADMIN_TIER_ACCESS_DENIED:${actor.tier}`);
    }
  });

  it("derives search segments, classifications, and entitlements from the canonical actor", () => {
    const clinical = buildM42SearchActorContext(
      buildM42ActorContext("bhc-director"),
    );
    const frontline = buildM42SearchActorContext(
      buildM42ActorContext("rcs-day"),
    );
    expect(clinical.allowedSegmentIds).toContain("clinical");
    expect(clinical.allowedClassifications).toContain("restricted");
    expect(clinical.entitlements).toContain("document:restricted:read");
    expect(frontline.allowedSegmentIds).toEqual(["enterprise"]);
    expect(frontline.allowedClassifications).toEqual(["public", "internal"]);
    expect(frontline.entitlements).not.toContain("document:restricted:read");
  });

  it("exposes only visible document metadata and no denied identifiers", () => {
    const result = listM42GovernedDocuments(
      buildM42ActorContext("youth-care-worker"),
    );
    expect(result.visibleCount).toBeLessThan(result.totalCount);
    expect(result.permissionTrimmed).toBe(true);
    expect(result.deniedDocumentIdsDisclosed).toBe(false);
    expect(result).not.toHaveProperty("trimmedDocumentIds");
    expect(result).not.toHaveProperty("decisions");
  });

  it("makes hidden and unknown document identifiers indistinguishable", () => {
    const actor = buildM42ActorContext("youth-care-worker");
    for (const documentId of [
      "SYNTH-DOCUMENT-BHC-PART2-CONSENT",
      "SYNTH-DOCUMENT-DOES-NOT-EXIST",
    ])
      expect(() =>
        evaluateM42GovernedDocumentAction(actor, documentId, "content_read"),
      ).toThrow("M42_DOCUMENT_NOT_AVAILABLE");
  });

  it("runs the export-enabled report demo for every canonical T1 role", () => {
    for (const role of [
      "super-admin",
      "managing-director",
      "administrator",
    ] as const) {
      const result = runM42ReportBuilderDemo(buildM42ActorContext(role));
      expect(result).toMatchObject({
        requestedBy: { role, tier: "T1" },
        execution: {
          concealedFieldIds: [],
          externalWritePerformed: false,
        },
        exportManifest: {
          fieldIds: ["record_id", "division", "service_count", "net_revenue"],
          liveRepositoryWrite: false,
        },
      });
    }
  });

  it("runs role-derived records, reporting, and administration demos without live writes", () => {
    const actor = buildM42ActorContext("bhc-director");
    const version = runM42VersionControlDemo(actor);
    const report = runM42ReportBuilderDemo(actor);
    const configuration = runM42ConfigurationDemo(actor);
    expect(version).toMatchObject({
      requestedBy: { role: "bhc-director", tier: "T2" },
      currentVersion: "1.1",
      validationErrors: [],
      externalWritePerformed: false,
    });
    expect(report).toMatchObject({
      requestedBy: { role: "bhc-director", tier: "T2" },
      execution: {
        selectedFieldIds: ["record_id", "division", "service_count"],
        concealedFieldIds: ["net_revenue"],
        externalWritePerformed: false,
      },
      exportManifest: { liveRepositoryWrite: false },
    });
    expect(configuration).toMatchObject({
      requestedBy: { role: "bhc-director", tier: "T2" },
      rollback: {
        rollbackCreatedNewVersion: true,
        liveConnectorMutation: false,
      },
      externalWritePerformed: false,
    });
  });
});
