import { describe, expect, it } from "vitest";
import { M51A_METADATA_FIELD_CODES } from "@contracts/m51a/operations-hub";
import { M51A_PILOT_CATEGORIES } from "@contracts/m51a/pilot";
import {
  createDeterministicM51aPilotSource,
  runM51aNonSensitivePilot,
  searchM51aPilotItems,
} from "../services/m51a/pilot/pilot-migration";

describe("M5.1A deterministic non-sensitive pilot migration", () => {
  it("creates exactly two fictional items in each of the six approved pilot categories", () => {
    const source = createDeterministicM51aPilotSource();
    expect(source).toHaveLength(12);
    for (const category of M51A_PILOT_CATEGORIES)
      expect(source.filter((item) => item.category === category)).toHaveLength(2);
    expect(new Set(source.map((item) => item.stableObjectId)).size).toBe(12);
    expect(source.every((item) => item.stableObjectId.startsWith("SYNTH-"))).toBe(true);
    expect(source.every((item) => item.realDataUsed === false)).toBe(true);
  });

  it("preserves complete metadata, two immutable versions, ACL hashes, stable IDs, and logical links", () => {
    const source = createDeterministicM51aPilotSource();
    for (const item of source) {
      expect(Object.keys(item.metadata).sort()).toEqual(
        [...M51A_METADATA_FIELD_CODES].sort(),
      );
      expect(item.metadata.amos_object_id).toBe(item.stableObjectId);
      expect(item.metadataHash).toMatch(/^[a-f0-9]{64}$/);
      expect(item.acl.aclHash).toMatch(/^[a-f0-9]{64}$/);
      expect(item.versions).toHaveLength(2);
      expect(item.versions.map((version) => version.version)).toEqual(["1.0", "1.1"]);
      expect(item.versions.every((version) => version.immutable)).toBe(true);
      expect(item.currentVersionId).toBe(item.versions[1]?.versionId);
      expect(item.sourceLink).toBe(`amos-synthetic://m51a/source/${item.stableObjectId}`);
      expect(item.canonicalLink).toBe(`amos-synthetic://m51a/object/${item.stableObjectId}`);
      expect(["Move", "Publish"]).toContain(item.disposition);
      expect(Object.isFrozen(item)).toBe(true);
      expect(Object.isFrozen(item.metadata)).toBe(true);
      expect(Object.isFrozen(item.versions)).toBe(true);
    }
  });

  it("fails at a deterministic checkpoint, replays idempotently, and prevents duplicate target objects", () => {
    const result = runM51aNonSensitivePilot();
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({
      status: "failed_synthetic_checkpoint",
      exceptionCode: "SYNTHETIC_CONNECTOR_OUTAGE_AFTER_6_ITEMS",
      liveWrites: 0,
    });
    expect(result.attempts[0]?.processedStableObjectIds).toHaveLength(6);
    expect(result.attempts[1]).toMatchObject({
      status: "completed_replay",
      duplicateWritesPrevented: 6,
      exceptionCode: null,
      liveWrites: 0,
    });
    expect(result.targetItems).toHaveLength(12);
    expect(new Set(result.targetItems.map((item) => item.stableObjectId)).size).toBe(12);
  });

  it("keeps source and target search results stable without path-dependent identities", () => {
    const result = runM51aNonSensitivePilot();
    for (const source of result.sourceItems) {
      expect(searchM51aPilotItems(result.sourceItems, source.stableObjectId)).toEqual([
        source.stableObjectId,
      ]);
      expect(searchM51aPilotItems(result.targetItems, source.stableObjectId)).toEqual([
        source.stableObjectId,
      ]);
      const target = result.targetItems.find(
        (candidate) => candidate.stableObjectId === source.stableObjectId,
      );
      expect(target?.canonicalLink).toBe(source.canonicalLink);
      expect(target?.liveMicrosoftItemId).toBeNull();
    }
  });
});
