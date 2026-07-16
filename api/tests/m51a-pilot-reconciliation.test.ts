import { describe, expect, it } from "vitest";
import {
  reconcileM51aPilot,
  runM51aNonSensitivePilot,
} from "../services/m51a/pilot/pilot-migration";

describe("M5.1A pilot reconciliation and rollback", () => {
  it("reconciles counts, hashes, versions, metadata, ACLs, stable IDs, links, search, and disposition", () => {
    const result = runM51aNonSensitivePilot();
    expect(result.reconciliation).toMatchObject({
      sourceCount: 12,
      targetCount: 12,
      uniqueStableObjectIds: 12,
      passed: true,
      synthetic: true,
    });
    expect(result.reconciliation.categoryCounts).toEqual({
      governance: 2,
      policy: 2,
      form: 2,
      training: 2,
      "project-release": 2,
      "intranet-article": 2,
    });
    expect(result.reconciliation.sourceManifestHash).toBe(
      result.reconciliation.targetManifestHash,
    );
    for (const key of [
      "countMismatches",
      "contentHashMismatches",
      "versionMismatches",
      "metadataMismatches",
      "aclMismatches",
      "stableObjectMismatches",
      "linkMismatches",
      "searchMismatches",
      "dispositionMismatches",
      "duplicateStableObjectIds",
    ] as const)
      expect(result.reconciliation[key]).toEqual([]);
  });

  it("detects a changed target metadata hash rather than silently accepting it", () => {
    const result = runM51aNonSensitivePilot();
    const changed = result.targetItems.map((item, index) =>
      index === 0 ? { ...item, metadataHash: "0".repeat(64) } : item,
    );
    const reconciliation = reconcileM51aPilot(result.sourceItems, changed);
    expect(reconciliation.passed).toBe(false);
    expect(reconciliation.metadataMismatches).toEqual([
      changed[0]?.stableObjectId,
    ]);
    expect(reconciliation.sourceManifestHash).not.toBe(
      reconciliation.targetManifestHash,
    );
  });

  it("recomputes metadata and ACL hashes so stale stored hashes cannot hide tampering", () => {
    const result = runM51aNonSensitivePilot();
    const changed = result.targetItems.map((item, index) =>
      index === 0
        ? {
            ...item,
            metadata: { ...item.metadata, owner: "tampered-owner" },
            acl: {
              ...item.acl,
              principalRefs: [...item.acl.principalRefs, "GROUP:TAMPERED"],
            },
          }
        : item,
    );
    const reconciliation = reconcileM51aPilot(result.sourceItems, changed);
    expect(reconciliation.passed).toBe(false);
    expect(reconciliation.metadataMismatches).toContain(
      changed[0]?.stableObjectId,
    );
    expect(reconciliation.aclMismatches).toContain(changed[0]?.stableObjectId);
    expect(reconciliation.sourceManifestHash).not.toBe(
      reconciliation.targetManifestHash,
    );
  });

  it("rolls back only the synthetic target and proves the source manifest is unchanged", () => {
    const result = runM51aNonSensitivePilot();
    expect(result.rollback).toMatchObject({
      targetItemsBeforeRollback: 12,
      targetItemsAfterRollback: 0,
      sourceItemsBeforeRollback: 12,
      sourceItemsAfterRollback: 12,
      sourceUnchanged: true,
      rollbackComplete: true,
      sourceMutationCount: 0,
      liveWrites: 0,
    });
    expect(result.rollback.removedTargetStableObjectIds).toHaveLength(12);
    expect(result.rollback.sourceManifestHashBefore).toBe(
      result.rollback.sourceManifestHashAfter,
    );
  });

  it("stays inside the hard synthetic boundary", () => {
    const result = runM51aNonSensitivePilot();
    expect(result.accepted).toBe(true);
    expect(result).toMatchObject({
      productionRows: 0,
      liveWrites: 0,
      realDataUsed: false,
      synthetic: true,
    });
    expect(result.boundary).toMatchObject({
      syntheticOnly: true,
      realDataUsed: false,
      realFileContentRead: false,
      productionRows: 0,
      liveWrites: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      liveConnectorMutation: false,
      restrictedRecordMigration: false,
    });
    expect(result.auditEvents.map((event) => event.eventType)).toEqual([
      "connector_conflict_recorded",
      "connector_retry_recorded",
      "reconciliation_completed",
      "pilot_rolled_back",
    ]);
  });
});
