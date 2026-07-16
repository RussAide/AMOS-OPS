import type {
  M51aInventoryDispositionResult,
  M51aItemDispositionRecord,
  M51aRepositoryInventoryRecord,
} from "@contracts/m51a/inventory";
import type { M51aConnectorRegistryEntry } from "@contracts/m51a/microsoft-connectors";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import { M51aConnectorRegistry } from "./connectors/connector-registry";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "./connectors/synthetic-repository-fixtures";

function immutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function dispositionRationale(entry: M51aConnectorRegistryEntry): string {
  if (entry.connectorMode === "Excluded/System-Managed")
    return "System-managed support repository excluded from business indexing, migration, and intranet roll-up.";
  if (entry.repositoryKind === "onedrive_workbench")
    return "Individual workbench retained in place; authoritative records require governed submit-to-DMS publication.";
  if (entry.connectorMode === "Metadata-Only Restricted Reference")
    return "Restricted repository remains segregated; only permission-trimmed metadata may be referenced.";
  if (entry.disposition === "Publish")
    return "Approved Published Intranet Content may flow through the authoritative AMOS-DMS publishing gate.";
  return "Governed repository retained under its registered AMOS-DMS authority and connector policy.";
}

function repositoryRecord(
  entry: M51aConnectorRegistryEntry,
  itemCount: number,
): M51aRepositoryInventoryRecord {
  const excluded = entry.connectorMode === "Excluded/System-Managed";
  return immutable({
    inventoryId: `SYNTH-INVENTORY-${entry.connectorId}`,
    connectorId: entry.connectorId,
    displayName: entry.displayName,
    ownerActorId: entry.owner.actorId,
    accountableTeam: entry.owner.accountableTeam,
    classification: entry.classification,
    handlingClass: entry.handlingClass,
    recordClasses: entry.recordClasses,
    authoritativeStatus: entry.authoritativeStatus,
    authorityCandidateAnalyzed: true,
    connectorMode: entry.connectorMode,
    connectorEligible: !excluded,
    disposition: entry.disposition,
    targetOrExclusionRationale: dispositionRationale(entry),
    permissionSnapshotId:
      entry.permissionModel.repositoryPermissions.permissionSnapshotId,
    permissionReviewComplete: true,
    externalSharingAllowed: false,
    anonymousLinksAllowed: false,
    duplicateAnalysis: "unique_repository_address",
    versionAnalysis: excluded
      ? "no_business_items_expected"
      : "item_versions_inventoried",
    activityAnalyzed: true,
    lastSyntheticActivityAt: excluded
      ? null
      : "2026-07-15T12:00:00.000Z",
    brokenLinkCount: 0,
    syntheticItemCount: itemCount,
    sourcePreserved: true,
    liveRepositoryRead: false,
    synthetic: true,
  });
}

function itemRecord(
  item: M51aMicrosoftItemSnapshot,
  repository: M51aConnectorRegistryEntry,
): M51aItemDispositionRecord {
  return immutable({
    inventoryItemId: `SYNTH-INVENTORY-ITEM-${item.stableObjectId}`,
    connectorId: repository.connectorId,
    stableObjectId: item.stableObjectId,
    name: item.name,
    ownerActorId: repository.owner.actorId,
    classification: repository.classification,
    handlingClass: item.handlingClass,
    authoritativeStatus: repository.authoritativeStatus,
    authorityCandidateAnalyzed: true,
    versionId: item.versionId,
    contentHash: item.contentHash,
    metadataHash: item.metadataHash,
    permissionSnapshotId: item.permissions.permissionSnapshotId,
    activityAnalyzed: true,
    lastModifiedAt: item.lastModifiedAt,
    connectorEligible:
      repository.connectorMode !== "Excluded/System-Managed",
    disposition: repository.disposition,
    targetOrExclusionRationale: dispositionRationale(repository),
    duplicateOfStableObjectId: null,
    duplicateAnalysisComplete: true,
    brokenLink: false,
    linkAnalysisComplete: true,
    sourcePreserved: true,
    liveItemRead: false,
    synthetic: true,
  });
}

export function createM51aInventoryDispositionRegister(
  repositoryEntries: readonly M51aConnectorRegistryEntry[] =
    createSyntheticM51aConnectorRegistryEntries(),
  itemSnapshots: readonly M51aMicrosoftItemSnapshot[] =
    createSyntheticM51aMicrosoftItems(repositoryEntries),
): M51aInventoryDispositionResult {
  const registry = new M51aConnectorRegistry(repositoryEntries);
  const byConnector = new Map(
    registry.list().map((entry) => [entry.connectorId, entry] as const),
  );
  const repositories = registry.list().map((entry) =>
    repositoryRecord(
      entry,
      itemSnapshots.filter((item) => item.connectorId === entry.connectorId)
        .length,
    ),
  );
  const items = itemSnapshots.map((item) => {
    const repository = byConnector.get(item.connectorId);
    if (!repository) throw new Error("M51A_INVENTORY_REPOSITORY_REQUIRED");
    return itemRecord(item, repository);
  });
  const validationErrors: string[] = [];
  if (new Set(repositories.map((entry) => entry.connectorId)).size !== repositories.length)
    validationErrors.push("M51A_INVENTORY_REPOSITORY_DUPLICATE");
  if (new Set(items.map((entry) => entry.stableObjectId)).size !== items.length)
    validationErrors.push("M51A_INVENTORY_STABLE_OBJECT_DUPLICATE");
  if (
    repositories.some(
      (entry) =>
        !entry.ownerActorId ||
        !entry.classification ||
        !entry.handlingClass ||
        !entry.authoritativeStatus ||
        !entry.disposition ||
        !entry.targetOrExclusionRationale ||
        !entry.permissionSnapshotId ||
        !entry.activityAnalyzed ||
        (entry.connectorEligible &&
          (!entry.lastSyntheticActivityAt ||
            !Number.isFinite(Date.parse(entry.lastSyntheticActivityAt)))),
    )
  )
    validationErrors.push("M51A_INVENTORY_REQUIRED_FIELD_MISSING");
  if (
    repositories.some(
      (entry) =>
        entry.classification === "system_managed" &&
        (entry.connectorEligible || entry.disposition !== "Exclude"),
    )
  )
    validationErrors.push("M51A_SYSTEM_REPOSITORY_EXCLUSION_INVALID");
  if (
    repositories.some(
      (entry) =>
        entry.classification === "personal_workbench" &&
        entry.authoritativeStatus !== "working_copy",
    )
  )
    validationErrors.push("M51A_ONEDRIVE_AUTHORITY_INVALID");
  if (
    repositories.some(
      (entry) => entry.externalSharingAllowed || entry.anonymousLinksAllowed,
    )
  )
    validationErrors.push("M51A_INVENTORY_EXTERNAL_SHARING_INVALID");
  if (items.some((item) => !item.sourcePreserved || !item.synthetic))
    validationErrors.push("M51A_INVENTORY_SOURCE_PRESERVATION_INVALID");
  if (
    items.some(
      (item) =>
        !/^SYNTH-[A-Z0-9][A-Z0-9._:-]*$/i.test(item.stableObjectId) ||
        !item.name.trim() ||
        !item.versionId.trim() ||
        !/^sha256:/i.test(item.contentHash) ||
        !/^sha256:/i.test(item.metadataHash) ||
        !item.permissionSnapshotId.trim() ||
        !item.activityAnalyzed ||
        !Number.isFinite(Date.parse(item.lastModifiedAt)) ||
        !item.targetOrExclusionRationale.trim() ||
        !item.duplicateAnalysisComplete ||
        !item.linkAnalysisComplete,
    )
  )
    validationErrors.push("M51A_INVENTORY_ITEM_EVIDENCE_INCOMPLETE");

  return immutable({
    inventoryId: "SYNTH-M51A-INVENTORY-DISPOSITION-V1",
    repositories: immutable(repositories),
    items: immutable(items),
    validationErrors: immutable(validationErrors),
    totals: immutable({
      repositories: repositories.length,
      items: items.length,
      restrictedRepositories: repositories.filter((entry) =>
        entry.handlingClass.startsWith("restricted-"),
      ).length,
      systemManagedExcluded: repositories.filter(
        (entry) => entry.classification === "system_managed",
      ).length,
      oneDriveWorkbenches: repositories.filter(
        (entry) => entry.classification === "personal_workbench",
      ).length,
      duplicateItems: 0,
      brokenLinks: 0,
      liveRepositoryReads: 0,
      liveItemReads: 0,
    }),
    accepted: validationErrors.length === 0,
    sourcePreserved: true,
    realDataUsed: false,
    synthetic: true,
  });
}
