import { describe, expect, it } from "vitest";
import { createM51aInventoryDispositionRegister } from "../services/m51a/inventory-disposition";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "../services/m51a/connectors/synthetic-repository-fixtures";

describe("M5.1A repository inventory and item disposition register", () => {
  it("registers every fictional repository and item with complete disposition evidence", () => {
    const result = createM51aInventoryDispositionRegister();
    expect(result.accepted).toBe(true);
    expect(result.validationErrors).toEqual([]);
    expect(result.totals).toEqual({
      repositories: 9,
      items: 7,
      restrictedRepositories: 4,
      systemManagedExcluded: 2,
      oneDriveWorkbenches: 1,
      duplicateItems: 0,
      brokenLinks: 0,
      liveRepositoryReads: 0,
      liveItemReads: 0,
    });
    expect(
      result.repositories.every(
        (entry) =>
          entry.ownerActorId &&
          entry.classification &&
          entry.handlingClass &&
          entry.authoritativeStatus &&
          entry.targetOrExclusionRationale &&
          entry.permissionReviewComplete &&
          entry.activityAnalyzed &&
          entry.sourcePreserved,
      ),
    ).toBe(true);
    expect(
      result.items.every(
        (entry) =>
          entry.duplicateAnalysisComplete &&
          entry.linkAnalysisComplete &&
          entry.activityAnalyzed &&
          entry.sourcePreserved &&
          !entry.liveItemRead,
      ),
    ).toBe(true);
  });

  it("rejects empty version, hash, permission, and activity evidence", () => {
    const clean = createM51aInventoryDispositionRegister();
    const sourceItems = clean.items;
    expect(sourceItems).toHaveLength(7);

    const repositories = createSyntheticM51aConnectorRegistryEntries();
    const snapshots = createSyntheticM51aMicrosoftItems(repositories);
    const corrupted = snapshots.map((item, index) =>
      index === 0
        ? {
            ...item,
            versionId: "",
            contentHash: "",
            metadataHash: "",
            lastModifiedAt: "not-a-date",
            permissions: { ...item.permissions, permissionSnapshotId: "" },
          }
        : item,
    );
    const result = createM51aInventoryDispositionRegister(
      repositories,
      corrupted,
    );
    expect(result.accepted).toBe(false);
    expect(result.validationErrors).toContain(
      "M51A_INVENTORY_ITEM_EVIDENCE_INCOMPLETE",
    );
  });

  it("treats OneDrive as a workbench and excludes system-managed libraries", () => {
    const result = createM51aInventoryDispositionRegister();
    const workbench = result.repositories.find(
      (entry) => entry.classification === "personal_workbench",
    );
    expect(workbench).toMatchObject({
      authoritativeStatus: "working_copy",
      disposition: "Retain",
      connectorEligible: true,
    });
    const excluded = result.repositories.filter(
      (entry) => entry.classification === "system_managed",
    );
    expect(excluded).toHaveLength(2);
    expect(
      excluded.every(
        (entry) =>
          entry.disposition === "Exclude" && !entry.connectorEligible,
      ),
    ).toBe(true);
  });
});
