import { describe, expect, it } from "vitest";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import { M51aStableObjectResolver } from "../services/m51a/connectors/stable-object-resolver";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "../services/m51a/connectors/synthetic-repository-fixtures";
import { SyntheticM51aMicrosoftAdapter } from "../services/m51a/connectors/synthetic-microsoft-adapter";

function foundation() {
  const repositories = createSyntheticM51aConnectorRegistryEntries();
  const items = createSyntheticM51aMicrosoftItems(repositories);
  const adapter = new SyntheticM51aMicrosoftAdapter(repositories, items);
  return { repositories, items, adapter };
}

describe("M5.1A Stable AMOS DMS Object ID mapping", () => {
  it("preserves one AMOS identity and immutable history across rename, move, and cross-drive rebind", () => {
    const { items, adapter } = foundation();
    const resolver = new M51aStableObjectResolver();
    const initial = items[0];
    resolver.bind(initial, "2026-07-15T12:00:00.000Z");

    const renamed = adapter.applySyntheticMetadataPatch({
      stableObjectId: initial.stableObjectId,
      expectedETag: initial.eTag,
      patch: {
        name: "Enterprise-Doctrine-v4.2.docx",
        path:
          "/sites/operations-hub/Enterprise Governance & Doctrine/Enterprise-Doctrine-v4.2.docx",
      },
      modifiedAt: "2026-07-15T12:10:00.000Z",
    });
    resolver.observe(
      initial.stableObjectId,
      renamed,
      "2026-07-15T12:10:00.000Z",
    );

    const moved = adapter.applySyntheticMetadataPatch({
      stableObjectId: initial.stableObjectId,
      expectedETag: renamed.eTag,
      patch: {
        parentItemId: "SYNTH-FOLDER-APPROVED-DOCTRINE",
        path:
          "/sites/operations-hub/Enterprise Governance & Doctrine/Approved/Enterprise-Doctrine-v4.2.docx",
      },
      modifiedAt: "2026-07-15T12:20:00.000Z",
    });
    resolver.observe(
      initial.stableObjectId,
      moved,
      "2026-07-15T12:20:00.000Z",
    );

    const rebound: M51aMicrosoftItemSnapshot = {
      ...moved,
      connectorId: "SYNTH-CONNECTOR-GOVERNANCE",
      address: {
        ...moved.address,
        siteId: "SYNTH-SITE-OPERATIONS-HUB-ARCHIVE",
        driveId: "SYNTH-DRIVE-GOVERNANCE-ARCHIVE",
        itemId: "SYNTH-ITEM-GOVERNANCE-ARCHIVE-001",
      },
      path:
        "/sites/operations-hub-archive/Governance/Enterprise-Doctrine-v4.2.docx",
      parentItemId: "SYNTH-ROOT-GOVERNANCE-ARCHIVE",
      eTag: '"SYNTH-ETAG-ARCHIVE-V1"',
      cTag: '"SYNTH-CTAG-ARCHIVE-V1"',
      versionId: "SYNTH-VERSION-GOVERNANCE-ARCHIVE-1",
      lastModifiedAt: "2026-07-15T12:30:00.000Z",
    };
    const mapping = resolver.observe(
      initial.stableObjectId,
      rebound,
      "2026-07-15T12:30:00.000Z",
    );

    expect(mapping.stableObjectId).toBe(initial.stableObjectId);
    expect(mapping.bindingHistory.map((binding) => binding.reason)).toEqual([
      "initial_bind",
      "rename",
      "move_within_drive",
      "cross_drive_rebind",
    ]);
    expect(mapping.bindingHistory.map((binding) => binding.bindingVersion)).toEqual([
      1, 2, 3, 4,
    ]);
    expect(mapping.bindingHistory.filter((binding) => binding.active)).toHaveLength(1);
    expect(resolver.resolve(initial.stableObjectId).address).toEqual(rebound.address);
    expect(resolver.validate()).toEqual([]);
  });

  it("prevents two AMOS objects from resolving to the same active Microsoft item", () => {
    const { items } = foundation();
    const resolver = new M51aStableObjectResolver();
    resolver.bind(items[0]);
    expect(() =>
      resolver.bind({
        ...items[0],
        stableObjectId: "SYNTH-AMOS-OBJECT-DUPLICATE-001",
      }),
    ).toThrow("M51A_MICROSOFT_ITEM_ALREADY_BOUND");
  });

  it("tombstones deleted items, preserves their history, and fails closed on resolution", () => {
    const { items } = foundation();
    const resolver = new M51aStableObjectResolver();
    const initial = items[1];
    resolver.bind(initial);
    const tombstoned = resolver.tombstone(
      initial.stableObjectId,
      {
        ...initial,
        deleted: true,
        eTag: '"SYNTH-ETAG-DELETED"',
        lastModifiedAt: "2026-07-15T13:00:00.000Z",
      },
      "2026-07-15T13:00:00.000Z",
    );
    expect(tombstoned).toMatchObject({
      currentBindingId: null,
      status: "tombstoned",
      appendOnlyHistory: true,
    });
    expect(tombstoned.bindingHistory.map((binding) => binding.reason)).toEqual([
      "initial_bind",
      "tombstone",
    ]);
    expect(() => resolver.resolve(initial.stableObjectId)).toThrow(
      "M51A_STABLE_OBJECT_NOT_RESOLVABLE",
    );
    expect(() => resolver.resolveByMicrosoftAddress(initial.address)).toThrow(
      "M51A_MICROSOFT_ITEM_NOT_MAPPED",
    );
    expect(resolver.validate()).toEqual([]);
  });
});
