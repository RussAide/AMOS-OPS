import { describe, expect, it } from "vitest";
import {
  M51aSyntheticMicrosoftError,
  SyntheticM51aMicrosoftAdapter,
} from "../services/m51a/connectors/synthetic-microsoft-adapter";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "../services/m51a/connectors/synthetic-repository-fixtures";

function adapterFixture() {
  const repositories = createSyntheticM51aConnectorRegistryEntries();
  const items = createSyntheticM51aMicrosoftItems(repositories);
  return {
    items,
    adapter: new SyntheticM51aMicrosoftAdapter(repositories, items),
  };
}

describe("M5.1A synthetic Microsoft eTag and no-overwrite controls", () => {
  it("turns a stale If-Match eTag into a 412 conflict without changing the item", () => {
    const { items, adapter } = adapterFixture();
    const original = items[0];
    let captured: unknown;
    try {
      adapter.applySyntheticMetadataPatch({
        stableObjectId: original.stableObjectId,
        expectedETag: '"SYNTH-STALE-ETAG"',
        patch: { name: "Unauthorized-Overwrite.docx" },
        modifiedAt: "2026-07-15T13:00:00.000Z",
      });
    } catch (error) {
      captured = error;
    }
    expect(captured).toBeInstanceOf(M51aSyntheticMicrosoftError);
    expect(captured).toMatchObject({
      status: 412,
      code: "M51A_ETAG_PRECONDITION_FAILED",
    });
    expect(adapter.getItemByStableObject(original.stableObjectId)).toEqual(original);
    expect(adapter.metrics().syntheticMutations).toBe(0);
  });

  it("changes eTag but preserves cTag and content hash for a metadata-only update", () => {
    const { items, adapter } = adapterFixture();
    const original = items[0];
    const updated = adapter.applySyntheticMetadataPatch({
      stableObjectId: original.stableObjectId,
      expectedETag: original.eTag,
      patch: { name: "Enterprise-Doctrine-Renamed.docx" },
      modifiedAt: "2026-07-15T13:05:00.000Z",
    });
    expect(updated.eTag).not.toBe(original.eTag);
    expect(updated.cTag).toBe(original.cTag);
    expect(updated.contentHash).toBe(original.contentHash);
    expect(updated.metadataHash).not.toBe(original.metadataHash);
    expect(adapter.metrics()).toMatchObject({
      syntheticMutations: 1,
      liveGraphCalls: 0,
      liveWrites: 0,
      credentialReads: 0,
    });
  });

  it("changes eTag, cTag, version, and hash only with the current expected eTag", () => {
    const { items, adapter } = adapterFixture();
    const original = items[0];
    const updated = adapter.applySyntheticContentUpdate({
      stableObjectId: original.stableObjectId,
      expectedETag: original.eTag,
      contentHash: "sha256:synthetic-governance-content-v2",
      modifiedAt: "2026-07-15T13:10:00.000Z",
    });
    expect(updated.eTag).not.toBe(original.eTag);
    expect(updated.cTag).not.toBe(original.cTag);
    expect(updated.versionId).not.toBe(original.versionId);
    expect(updated.contentHash).toBe("sha256:synthetic-governance-content-v2");
    expect(() =>
      adapter.applySyntheticContentUpdate({
        stableObjectId: original.stableObjectId,
        expectedETag: original.eTag,
        contentHash: "sha256:synthetic-silent-overwrite-v3",
        modifiedAt: "2026-07-15T13:11:00.000Z",
      }),
    ).toThrow("M51A_ETAG_PRECONDITION_FAILED");
    expect(adapter.getItemByStableObject(original.stableObjectId).contentHash).toBe(
      "sha256:synthetic-governance-content-v2",
    );
  });

  it("cannot use metadata-only or held repositories as a synthetic write bypass", () => {
    const { items, adapter } = adapterFixture();
    const clinical = items.find(
      (candidate) =>
        candidate.stableObjectId === "SYNTH-AMOS-OBJECT-CLINICAL-001",
    )!;
    const part2 = items.find(
      (candidate) => candidate.stableObjectId === "SYNTH-AMOS-OBJECT-PART2-001",
    )!;
    expect(() =>
      adapter.applySyntheticMetadataPatch({
        stableObjectId: clinical.stableObjectId,
        expectedETag: clinical.eTag,
        patch: { name: "Synthetic-Clinical-Rename.json" },
        modifiedAt: "2026-07-15T13:15:00.000Z",
      }),
    ).toThrow("M51A_CONNECTOR_MODE_METADATA_WRITE_DENY");
    expect(() =>
      adapter.applySyntheticContentUpdate({
        stableObjectId: part2.stableObjectId,
        expectedETag: part2.eTag,
        contentHash: "sha256:synthetic-part2-overwrite",
        modifiedAt: "2026-07-15T13:16:00.000Z",
      }),
    ).toThrow("M51A_CONNECTOR_MODE_CONTENT_WRITE_DENY");
    expect(adapter.metrics().syntheticMutations).toBe(0);
  });
});
