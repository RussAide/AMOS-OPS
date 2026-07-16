import { describe, expect, it } from "vitest";
import { M51A_RECONCILIATION_DIMENSIONS } from "@contracts/m51a/connector-reconciliation";
import { M51aReconciliationEngine } from "../services/m51a/connectors/reconciliation-engine";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "../services/m51a/connectors/synthetic-repository-fixtures";

describe("M5.1A reusable reconciliation primitives", () => {
  const repositories = createSyntheticM51aConnectorRegistryEntries();
  const items = createSyntheticM51aMicrosoftItems(repositories);
  const connectorId = "SYNTH-CONNECTOR-GOVERNANCE";
  const source = items.filter((item) => item.connectorId === connectorId);

  it("reconciles all identity, hash, version, metadata, ACL, locator, and retention dimensions", () => {
    const engine = new M51aReconciliationEngine();
    const report = engine.reconcile({
      connectorId,
      source,
      target: [...source],
    });
    expect(report).toMatchObject({
      sourceCount: 1,
      targetCount: 1,
      differences: [],
      unexplainedDifferenceCount: 0,
      p0DifferenceCount: 0,
      p1DifferenceCount: 0,
      passed: true,
      sourceUnchanged: true,
      liveRepositoryWrite: false,
      synthetic: true,
    });
    expect(report.dimensionsChecked).toEqual(M51A_RECONCILIATION_DIMENSIONS);
  });

  it("fails on unexplained content, permission, and locator differences", () => {
    const engine = new M51aReconciliationEngine();
    const target = [
      {
        ...source[0],
        contentHash: "sha256:synthetic-divergent-content",
        path: "/synthetic/divergent/path.docx",
        permissions: {
          ...source[0].permissions,
          permissionSnapshotId: "SYNTH-ACL-DIVERGENT",
        },
      },
    ];
    const report = engine.reconcile({ connectorId, source, target });
    expect(report.passed).toBe(false);
    expect(report.unexplainedDifferenceCount).toBe(3);
    expect(report.differences.map((difference) => difference.dimension)).toEqual([
      "content_hash",
      "permissions",
      "locator",
    ]);
    expect(report.p0DifferenceCount).toBe(2);
    expect(report.p1DifferenceCount).toBe(1);
    expect(report.sourceUnchanged).toBe(true);
  });

  it("supports an explicit explanation ledger without silently dropping differences", () => {
    const engine = new M51aReconciliationEngine();
    const target = [
      {
        ...source[0],
        contentHash: "sha256:synthetic-approved-transformation",
      },
    ];
    const report = engine.reconcile({
      connectorId,
      source,
      target,
      explanations: {
        [`${source[0].stableObjectId}:content_hash`]:
          "Approved synthetic format transformation; source remains unchanged.",
      },
    });
    expect(report.passed).toBe(true);
    expect(report.unexplainedDifferenceCount).toBe(0);
    expect(report.differences).toHaveLength(1);
    expect(report.differences[0]).toMatchObject({
      dimension: "content_hash",
      explained: true,
      severity: "P0",
    });
  });

  it("detects missing stable identities and item-count mismatch as P0", () => {
    const engine = new M51aReconciliationEngine();
    const report = engine.reconcile({ connectorId, source, target: [] });
    expect(report.passed).toBe(false);
    expect(report.differences.map((difference) => difference.dimension)).toEqual([
      "item_count",
      "stable_object_id",
    ]);
    expect(report.p0DifferenceCount).toBe(2);
  });
});
