import { describe, expect, it } from "vitest";
import {
  M51B_SHAREPOINT_GATE_CODES,
  M51B_SHAREPOINT_MAX_ELAPSED_SECONDS,
} from "@contracts/m51b/sharepoint";
import { runM51bApprovedSharePointSync } from "../services/m51b/sharepoint/sync";

describe("M5.1B approved SharePoint synchronization", () => {
  it("delivers approved AMOS-DMS content within the 300-second control", async () => {
    const result = await runM51bApprovedSharePointSync();

    expect(result.accepted).toBe(true);
    expect(result.elapsedSeconds).toBe(145);
    expect(result.elapsedSeconds).toBeLessThanOrEqual(
      M51B_SHAREPOINT_MAX_ELAPSED_SECONDS,
    );
    expect(result.withinElapsedLimit).toBe(true);
    expect(result.gateDecision.allowed).toBe(true);
    expect(Object.keys(result.gateDecision.gates).sort()).toEqual(
      [...M51B_SHAREPOINT_GATE_CODES].sort(),
    );
    expect(Object.values(result.gateDecision.gates).every(Boolean)).toBe(true);
  });

  it("preserves stable AMOS identity while advancing the synthetic SharePoint version", async () => {
    const result = await runM51bApprovedSharePointSync();

    expect(result.initialTarget.versionId).toContain("-1");
    expect(result.finalTarget).toEqual(result.desiredSource);
    expect(result.finalTarget.versionId).toContain("-2");
    expect(result.finalTarget.eTag).not.toBe(result.initialTarget.eTag);
    expect(result.finalTarget.contentHash).not.toBe(
      result.initialTarget.contentHash,
    );
    expect(result.finalTarget.stableObjectId).toBe(result.stableObjectId);
    expect(result.stableMapping).toMatchObject({
      stableObjectId: result.stableObjectId,
      status: "active",
      sourceOfTruth: "AMOS-DMS",
      appendOnlyHistory: true,
      liveMicrosoftMutationAvailable: false,
    });
    expect(result.stableMapping.bindingHistory).toHaveLength(2);
    expect(result.resolvedBinding.eTag).toBe(result.finalTarget.eTag);
  });

  it("reconciles all inherited dimensions and records a synthetic checkpoint", async () => {
    const result = await runM51bApprovedSharePointSync();

    expect(result.reconciliation).toMatchObject({
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
    expect(result.reconciliation.dimensionsChecked).toEqual([
      "item_count",
      "stable_object_id",
      "content_hash",
      "version_identity",
      "metadata",
      "permissions",
      "locator",
      "sensitivity_retention",
    ]);
    expect(result.checkpoint).toMatchObject({
      connectorId: result.connectorId,
      checkpointKind: "full_resync",
      itemCount: 1,
      liveCheckpointWrite: false,
      synthetic: true,
    });
  });
});
