import { createHash } from "node:crypto";
import {
  M51A_METADATA_FIELD_CODES,
  type M51aContentTypeCode,
  type M51aLibraryCode,
} from "@contracts/m51a/operations-hub";
import { M51A_CONNECTOR_MODE_OPERATION_MATRIX } from "@contracts/m51a/microsoft-connectors";
import {
  M51A_PILOT_CATEGORIES,
  M51A_PILOT_EVALUATED_AT,
  M51A_PILOT_SCENARIO_ID,
  type M51aPilotAcl,
  type M51aPilotCategory,
  type M51aPilotConnectorRecord,
  type M51aPilotMetadata,
  type M51aPilotMigrationResult,
  type M51aPilotReconciliation,
  type M51aPilotSourceItem,
  type M51aPilotTargetItem,
  type M51aPilotVersion,
} from "@contracts/m51a/pilot";
import {
  M51A_EVIDENCE_CLASS,
  createM51ADemoBoundary,
  type M51AAuditEvent,
} from "@contracts/m51a/shared";
import type { DivisionId } from "@/constants/organization";
import type { UserRole } from "@/constants/roles";

type JsonLike =
  | null
  | boolean
  | number
  | string
  | readonly JsonLike[]
  | { readonly [key: string]: JsonLike };

function stableStringify(value: JsonLike): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value))
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  return `{${Object.entries(value)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
    .join(",")}}`;
}

function sha256(value: JsonLike): string {
  return createHash("sha256").update(stableStringify(value)).digest("hex");
}

function immutable<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      immutable(child);
    Object.freeze(value);
  }
  return value;
}

interface PilotBlueprint {
  category: M51aPilotCategory;
  sequence: 1 | 2;
  title: string;
  divisionId: DivisionId | "enterprise";
  targetLibraryCode: M51aLibraryCode;
  contentTypeCode: M51aContentTypeCode;
  handlingClass: "internal-general" | "internal-controlled";
  lifecycleState: "Approved" | "Published";
  disposition: "Move" | "Publish";
  ownerRole: UserRole;
  approverRole: UserRole;
}

const BLUEPRINTS: readonly PilotBlueprint[] = immutable([
  { category: "governance", sequence: 1, title: "Enterprise decision authority charter", divisionId: "enterprise", targetLibraryCode: "enterprise-governance-doctrine", contentTypeCode: "meeting-decision-record", handlingClass: "internal-controlled", lifecycleState: "Approved", disposition: "Move", ownerRole: "managing-director", approverRole: "administrator" },
  { category: "governance", sequence: 2, title: "Synthetic information ownership register", divisionId: "enterprise", targetLibraryCode: "enterprise-governance-doctrine", contentTypeCode: "meeting-decision-record", handlingClass: "internal-controlled", lifecycleState: "Approved", disposition: "Move", ownerRole: "administrator", approverRole: "managing-director" },
  { category: "policy", sequence: 1, title: "General records handling policy", divisionId: "enterprise", targetLibraryCode: "policies-sops-standards", contentTypeCode: "controlled-policy", handlingClass: "internal-controlled", lifecycleState: "Approved", disposition: "Move", ownerRole: "administrator", approverRole: "managing-director" },
  { category: "policy", sequence: 2, title: "GRO shift handoff standard", divisionId: "gro", targetLibraryCode: "policies-sops-standards", contentTypeCode: "standard-operating-procedure", handlingClass: "internal-controlled", lifecycleState: "Approved", disposition: "Move", ownerRole: "gro-administrator", approverRole: "administrator" },
  { category: "form", sequence: 1, title: "Enterprise meeting decision template", divisionId: "enterprise", targetLibraryCode: "forms-templates", contentTypeCode: "form-template", handlingClass: "internal-general", lifecycleState: "Approved", disposition: "Move", ownerRole: "administrator", approverRole: "managing-director" },
  { category: "form", sequence: 2, title: "Campus maintenance request template", divisionId: "gad", targetLibraryCode: "forms-templates", contentTypeCode: "form-template", handlingClass: "internal-general", lifecycleState: "Approved", disposition: "Move", ownerRole: "facilities-manager", approverRole: "administrator" },
  { category: "training", sequence: 1, title: "Controlled document fundamentals module", divisionId: "enterprise", targetLibraryCode: "learning-knowledge", contentTypeCode: "training-competency-module", handlingClass: "internal-general", lifecycleState: "Approved", disposition: "Move", ownerRole: "training-coordinator", approverRole: "hr-director" },
  { category: "training", sequence: 2, title: "Permission-aware search orientation", divisionId: "enterprise", targetLibraryCode: "learning-knowledge", contentTypeCode: "training-competency-module", handlingClass: "internal-general", lifecycleState: "Approved", disposition: "Move", ownerRole: "training-coordinator", approverRole: "administrator" },
  { category: "project-release", sequence: 1, title: "AMOS M5.1A architecture release note", divisionId: "eo", targetLibraryCode: "projects-change-releases", contentTypeCode: "project-release-artifact", handlingClass: "internal-controlled", lifecycleState: "Approved", disposition: "Move", ownerRole: "super-admin", approverRole: "managing-director" },
  { category: "project-release", sequence: 2, title: "Operations Hub pilot change record", divisionId: "enterprise", targetLibraryCode: "projects-change-releases", contentTypeCode: "project-release-artifact", handlingClass: "internal-controlled", lifecycleState: "Approved", disposition: "Move", ownerRole: "super-admin", approverRole: "administrator" },
  { category: "intranet-article", sequence: 1, title: "How to find authoritative staff guidance", divisionId: "enterprise", targetLibraryCode: "published-intranet-content", contentTypeCode: "intranet-knowledge-article", handlingClass: "internal-general", lifecycleState: "Published", disposition: "Publish", ownerRole: "administrator", approverRole: "managing-director" },
  { category: "intranet-article", sequence: 2, title: "How to submit a working document to AMOS-DMS", divisionId: "enterprise", targetLibraryCode: "published-intranet-content", contentTypeCode: "intranet-knowledge-article", handlingClass: "internal-general", lifecycleState: "Published", disposition: "Publish", ownerRole: "administrator", approverRole: "managing-director" },
]);

function token(category: M51aPilotCategory, sequence: number): string {
  return `${category.replace(/[^a-z0-9]/gi, "-").toUpperCase()}-${String(sequence).padStart(2, "0")}`;
}

function createVersions(stableObjectId: string): readonly M51aPilotVersion[] {
  return immutable(
    (["1.0", "1.1"] as const).map((version, index) => ({
      versionId: `${stableObjectId}-V${version.replace(".", "-")}`,
      version,
      contentHash: sha256({
        stableObjectId,
        version,
        content: `Fictional non-sensitive pilot content ${stableObjectId} ${version}`,
      }),
      createdAt: `2026-07-${String(10 + index).padStart(2, "0")}T13:00:00.000Z`,
      immutable: true,
      synthetic: true,
    })),
  );
}

function createMetadata(
  blueprint: PilotBlueprint,
  stableObjectId: string,
): M51aPilotMetadata {
  const values: M51aPilotMetadata = {
    amos_object_id: stableObjectId,
    document_type: blueprint.contentTypeCode,
    division: blueprint.divisionId,
    department_service_line:
      blueprint.divisionId === "enterprise" ? "enterprise-operations" : `${blueprint.divisionId}-operations`,
    program_campus: "synthetic-pilot",
    record_class: "operational-knowledge-pilot",
    sensitivity: blueprint.handlingClass,
    phi_part2_indicator: "none",
    lifecycle_status: blueprint.lifecycleState,
    owner: blueprint.ownerRole,
    approver: blueprint.approverRole,
    effective_date: "2026-07-15",
    review_date: "2027-07-15",
    retention_class: "SYNTH-RET-OPERATIONS-7Y",
    source_system: "SYNTHETIC-LEGACY-PILOT",
    authoritative_record_flag: true,
    intranet_state:
      blueprint.lifecycleState === "Published" ? "published" : "not-published",
    connector_state: "approved-pilot",
  };
  return immutable(values);
}

function createAcl(
  blueprint: PilotBlueprint,
  stableObjectId: string,
): M51aPilotAcl {
  const projection = {
    stableObjectId,
    minimumTier: "T4" as const,
    allowedDivisions: [blueprint.divisionId],
    principalRefs: [
      `ROLE:${blueprint.ownerRole}`,
      `DIVISION:${blueprint.divisionId}`,
      ...(blueprint.divisionId === "enterprise" ? ["GROUP:ALL-CANONICAL-STAFF"] : []),
    ],
    permissions: ["metadata_read", "content_read", "search"] as const,
  };
  return immutable({
    aclId: `${stableObjectId}-ACL`,
    ...projection,
    aclHash: sha256(projection),
    inheritedFromSource: true,
    synthetic: true,
  });
}

function metadataDigest(metadata: M51aPilotMetadata): string {
  return sha256(metadata as unknown as JsonLike);
}

function aclDigest(
  stableObjectId: string,
  acl: Pick<
    M51aPilotAcl,
    "minimumTier" | "allowedDivisions" | "principalRefs" | "permissions"
  >,
): string {
  return sha256({
    stableObjectId,
    minimumTier: acl.minimumTier,
    allowedDivisions: acl.allowedDivisions,
    principalRefs: acl.principalRefs,
    permissions: acl.permissions,
  });
}

export function createDeterministicM51aPilotSource(): readonly M51aPilotSourceItem[] {
  return immutable(
    BLUEPRINTS.map((blueprint) => {
      const stableObjectId = `SYNTH-AMOS-DMS-M51A-${token(blueprint.category, blueprint.sequence)}`;
      const versions = createVersions(stableObjectId);
      const metadata = createMetadata(blueprint, stableObjectId);
      return immutable({
        sourceItemId: `SYNTH-M51A-SOURCE-${token(blueprint.category, blueprint.sequence)}`,
        stableObjectId,
        category: blueprint.category,
        title: blueprint.title,
        divisionId: blueprint.divisionId,
        sourceRepositoryId: "SYNTH-M51A-REPOSITORY-NON-SENSITIVE-PILOT",
        sourceLibraryCode: "legacy-intake-disposition",
        targetLibraryCode: blueprint.targetLibraryCode,
        contentTypeCode: blueprint.contentTypeCode,
        handlingClass: blueprint.handlingClass,
        lifecycleState: blueprint.lifecycleState,
        disposition: blueprint.disposition,
        versions,
        currentVersionId: versions[versions.length - 1]!.versionId,
        metadata,
        metadataHash: metadataDigest(metadata),
        acl: createAcl(blueprint, stableObjectId),
        sourceLink: `amos-synthetic://m51a/source/${stableObjectId}`,
        canonicalLink: `amos-synthetic://m51a/object/${stableObjectId}`,
        authoritative: true,
        sourceImmutable: true,
        realDataUsed: false,
        synthetic: true,
      });
    }),
  );
}

function createConnector(): M51aPilotConnectorRecord {
  return immutable({
    connectorId: "SYNTH-M51A-CONNECTOR-PILOT-GOVERNED",
    repositoryId: "SYNTH-M51A-REPOSITORY-NON-SENSITIVE-PILOT",
    connectorMode: "Governed Full Integration",
    allowedOperations:
      M51A_CONNECTOR_MODE_OPERATION_MATRIX["Governed Full Integration"],
    readAuthority: "full",
    writeAuthority: "governed",
    stableObjectResolution: true,
    synthetic: true,
  });
}

function toTarget(
  item: M51aPilotSourceItem,
  connector: M51aPilotConnectorRecord,
): M51aPilotTargetItem {
  return immutable({
    targetItemId: `SYNTH-M51A-TARGET-${item.stableObjectId.replace("SYNTH-AMOS-DMS-M51A-", "")}`,
    stableObjectId: item.stableObjectId,
    category: item.category,
    title: item.title,
    divisionId: item.divisionId,
    targetLibraryCode: item.targetLibraryCode,
    contentTypeCode: item.contentTypeCode,
    handlingClass: item.handlingClass,
    lifecycleState: item.lifecycleState,
    disposition: item.disposition,
    versions: item.versions,
    currentVersionId: item.currentVersionId,
    metadata: item.metadata,
    metadataHash: item.metadataHash,
    acl: item.acl,
    sourceLink: item.sourceLink,
    canonicalLink: item.canonicalLink,
    connectorId: connector.connectorId,
    migratedFromSourceItemId: item.sourceItemId,
    sourcePreserved: true,
    liveMicrosoftItemId: null,
    realDataUsed: false,
    synthetic: true,
  });
}

function reconciliationProjection(
  item: M51aPilotSourceItem | M51aPilotTargetItem,
): JsonLike {
  return {
    stableObjectId: item.stableObjectId,
    category: item.category,
    title: item.title,
    divisionId: item.divisionId,
    targetLibraryCode: item.targetLibraryCode,
    contentTypeCode: item.contentTypeCode,
    handlingClass: item.handlingClass,
    lifecycleState: item.lifecycleState,
    disposition: item.disposition,
    versions: item.versions.map((version) => ({
      versionId: version.versionId,
      version: version.version,
      contentHash: version.contentHash,
    })),
    currentVersionId: item.currentVersionId,
    metadataHash: item.metadataHash,
    metadata: item.metadata as unknown as JsonLike,
    aclHash: item.acl.aclHash,
    acl: {
      minimumTier: item.acl.minimumTier,
      allowedDivisions: item.acl.allowedDivisions,
      principalRefs: item.acl.principalRefs,
      permissions: item.acl.permissions,
    },
    sourceLink: item.sourceLink,
    canonicalLink: item.canonicalLink,
  };
}

export function searchM51aPilotItems(
  items: readonly (M51aPilotSourceItem | M51aPilotTargetItem)[],
  query: string,
): readonly string[] {
  const normalizedQuery = query.trim();
  if (normalizedQuery.startsWith("SYNTH-AMOS-DMS-M51A-"))
    return immutable(
      items
        .filter((item) => item.stableObjectId === normalizedQuery)
        .map((item) => item.stableObjectId),
    );
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 1);
  if (terms.length === 0) return immutable([]);
  return immutable(
    items
      .filter((item) => {
        const haystack = `${item.title} ${item.category} ${item.stableObjectId}`.toLowerCase();
        return terms.every((term) => haystack.includes(term));
      })
      .map((item) => item.stableObjectId)
      .sort(),
  );
}

export function reconcileM51aPilot(
  sourceItems: readonly M51aPilotSourceItem[],
  targetItems: readonly M51aPilotTargetItem[],
): M51aPilotReconciliation {
  const targetByStableId = new Map(
    targetItems.map((item) => [item.stableObjectId, item] as const),
  );
  const categories = Object.fromEntries(
    M51A_PILOT_CATEGORIES.map((category) => [
      category,
      targetItems.filter((item) => item.category === category).length,
    ]),
  ) as Record<M51aPilotCategory, number>;
  const contentHashMismatches: string[] = [];
  const versionMismatches: string[] = [];
  const metadataMismatches: string[] = [];
  const aclMismatches: string[] = [];
  const stableObjectMismatches: string[] = [];
  const linkMismatches: string[] = [];
  const searchMismatches: string[] = [];
  const dispositionMismatches: string[] = [];

  for (const source of sourceItems) {
    const target = targetByStableId.get(source.stableObjectId);
    if (!target) {
      stableObjectMismatches.push(source.stableObjectId);
      continue;
    }
    const sourceHashes = source.versions.map((version) => version.contentHash);
    const targetHashes = target.versions.map((version) => version.contentHash);
    if (stableStringify(sourceHashes) !== stableStringify(targetHashes))
      contentHashMismatches.push(source.stableObjectId);
    if (
      source.currentVersionId !== target.currentVersionId ||
      stableStringify(source.versions.map((version) => version.version)) !==
        stableStringify(target.versions.map((version) => version.version))
    )
      versionMismatches.push(source.stableObjectId);
    const sourceMetadataDigest = metadataDigest(source.metadata);
    const targetMetadataDigest = metadataDigest(target.metadata);
    if (
      source.metadataHash !== sourceMetadataDigest ||
      target.metadataHash !== targetMetadataDigest ||
      sourceMetadataDigest !== targetMetadataDigest ||
      stableStringify(source.metadata as unknown as JsonLike) !==
        stableStringify(target.metadata as unknown as JsonLike)
    )
      metadataMismatches.push(source.stableObjectId);
    const sourceAclDigest = aclDigest(source.stableObjectId, source.acl);
    const targetAclDigest = aclDigest(target.stableObjectId, target.acl);
    if (
      source.acl.aclHash !== sourceAclDigest ||
      target.acl.aclHash !== targetAclDigest ||
      sourceAclDigest !== targetAclDigest
    )
      aclMismatches.push(source.stableObjectId);
    if (
      source.sourceLink !== target.sourceLink ||
      source.canonicalLink !== target.canonicalLink
    )
      linkMismatches.push(source.stableObjectId);
    if (source.disposition !== target.disposition)
      dispositionMismatches.push(source.stableObjectId);
    if (
      stableStringify(searchM51aPilotItems(sourceItems, source.stableObjectId)) !==
      stableStringify(searchM51aPilotItems(targetItems, source.stableObjectId))
    )
      searchMismatches.push(source.stableObjectId);
  }

  const stableIds = targetItems.map((item) => item.stableObjectId);
  const duplicateStableObjectIds = stableIds.filter(
    (value, index) => stableIds.indexOf(value) !== index,
  );
  const countMismatches = [
    ...(sourceItems.length !== targetItems.length
      ? [`TOTAL:${sourceItems.length}:${targetItems.length}`]
      : []),
    ...M51A_PILOT_CATEGORIES.filter((category) => categories[category] !== 2).map(
      (category) => `CATEGORY:${category}:${categories[category]}`,
    ),
  ];
  const sourceManifestHash = sha256(
    sourceItems.map(reconciliationProjection).sort((left, right) =>
      String((left as { stableObjectId: string }).stableObjectId).localeCompare(
        String((right as { stableObjectId: string }).stableObjectId),
      ),
    ),
  );
  const targetManifestHash = sha256(
    targetItems.map(reconciliationProjection).sort((left, right) =>
      String((left as { stableObjectId: string }).stableObjectId).localeCompare(
        String((right as { stableObjectId: string }).stableObjectId),
      ),
    ),
  );
  const errorCollections = [
    countMismatches,
    contentHashMismatches,
    versionMismatches,
    metadataMismatches,
    aclMismatches,
    stableObjectMismatches,
    linkMismatches,
    searchMismatches,
    dispositionMismatches,
    duplicateStableObjectIds,
  ];
  return immutable({
    sourceCount: sourceItems.length,
    targetCount: targetItems.length,
    categoryCounts: immutable(categories),
    uniqueStableObjectIds: new Set(stableIds).size,
    sourceManifestHash,
    targetManifestHash,
    countMismatches: immutable(countMismatches),
    contentHashMismatches: immutable(contentHashMismatches),
    versionMismatches: immutable(versionMismatches),
    metadataMismatches: immutable(metadataMismatches),
    aclMismatches: immutable(aclMismatches),
    stableObjectMismatches: immutable(stableObjectMismatches),
    linkMismatches: immutable(linkMismatches),
    searchMismatches: immutable(searchMismatches),
    dispositionMismatches: immutable(dispositionMismatches),
    duplicateStableObjectIds: immutable([...new Set(duplicateStableObjectIds)]),
    passed:
      sourceManifestHash === targetManifestHash &&
      errorCollections.every((errors) => errors.length === 0),
    synthetic: true,
  });
}

function auditEvent(
  sequence: number,
  eventType: M51AAuditEvent["eventType"],
  entityId: string,
  outcome: M51AAuditEvent["outcome"],
  reason: string,
): M51AAuditEvent {
  return immutable({
    eventId: `SYNTH-M51A-PILOT-AUDIT-${String(sequence).padStart(4, "0")}`,
    eventType,
    actorId: "SYNTH-M51A-PILOT-OPERATOR",
    actorRole: "managing-director",
    entityType: "pilot",
    entityId,
    correlationId: "SYNTH-M51A-PILOT-CORRELATION",
    outcome,
    reason,
    occurredAt: M51A_PILOT_EVALUATED_AT,
    immutable: true,
    evidenceClass: M51A_EVIDENCE_CLASS,
  });
}

function executeSyntheticPilotRollback(
  sourceItems: readonly M51aPilotSourceItem[],
  targetItems: readonly M51aPilotTargetItem[],
  sourceHashBefore: string,
) {
  const targetStore = new Map(
    targetItems.map((item) => [item.stableObjectId, item] as const),
  );
  const removedTargetStableObjectIds = [...targetStore.keys()].sort();
  const targetItemsBeforeRollback = targetStore.size;
  targetStore.clear();
  const targetItemsAfterRollback = targetStore.size;
  const sourceHashAfter = sha256(sourceItems.map(reconciliationProjection));
  return immutable({
    rollbackId: "SYNTH-M51A-PILOT-ROLLBACK-01",
    targetItemsBeforeRollback,
    targetItemsAfterRollback: targetItemsAfterRollback as 0,
    sourceItemsBeforeRollback: sourceItems.length,
    sourceItemsAfterRollback: sourceItems.length,
    sourceManifestHashBefore: sourceHashBefore,
    sourceManifestHashAfter: sourceHashAfter,
    removedTargetStableObjectIds: immutable(removedTargetStableObjectIds),
    sourceMutationCount: 0 as const,
    sourceUnchanged: sourceHashBefore === sourceHashAfter,
    rollbackComplete:
      targetItemsBeforeRollback === targetItems.length &&
      targetItemsAfterRollback === 0 &&
      removedTargetStableObjectIds.length === targetItems.length,
    liveWrites: 0 as const,
    synthetic: true as const,
  });
}

export function runM51aNonSensitivePilot(): M51aPilotMigrationResult {
  const connector = createConnector();
  const sourceItems = createDeterministicM51aPilotSource();
  const sourceHashBefore = sha256(sourceItems.map(reconciliationProjection));
  const firstHalf = sourceItems.slice(0, 6).map((item) => toTarget(item, connector));
  const targetByStableId = new Map(
    firstHalf.map((item) => [item.stableObjectId, item] as const),
  );
  let duplicateWritesPrevented = 0;
  for (const source of sourceItems) {
    if (targetByStableId.has(source.stableObjectId)) {
      duplicateWritesPrevented += 1;
      continue;
    }
    targetByStableId.set(source.stableObjectId, toTarget(source, connector));
  }
  const targetItems = immutable(
    [...targetByStableId.values()].sort((left, right) =>
      left.stableObjectId.localeCompare(right.stableObjectId),
    ),
  );
  const reconciliation = reconcileM51aPilot(sourceItems, targetItems);
  const attempts = immutable([
    {
      attemptId: "SYNTH-M51A-PILOT-ATTEMPT-01",
      status: "failed_synthetic_checkpoint" as const,
      processedStableObjectIds: immutable(
        firstHalf.map((item) => item.stableObjectId),
      ),
      duplicateWritesPrevented: 0,
      exceptionCode: "SYNTHETIC_CONNECTOR_OUTAGE_AFTER_6_ITEMS",
      liveWrites: 0 as const,
      synthetic: true as const,
    },
    {
      attemptId: "SYNTH-M51A-PILOT-ATTEMPT-02",
      status: "completed_replay" as const,
      processedStableObjectIds: immutable(
        targetItems.map((item) => item.stableObjectId),
      ),
      duplicateWritesPrevented,
      exceptionCode: null,
      liveWrites: 0 as const,
      synthetic: true as const,
    },
  ]);
  const rollback = executeSyntheticPilotRollback(
    sourceItems,
    targetItems,
    sourceHashBefore,
  );
  const auditEvents = immutable([
    auditEvent(1, "connector_conflict_recorded", M51A_PILOT_SCENARIO_ID, "recorded", "A deterministic connector outage stopped the first attempt after six items."),
    auditEvent(2, "connector_retry_recorded", M51A_PILOT_SCENARIO_ID, "recorded", `Replay resumed idempotently and prevented ${duplicateWritesPrevented} duplicate writes.`),
    auditEvent(3, "reconciliation_completed", M51A_PILOT_SCENARIO_ID, reconciliation.passed ? "recorded" : "blocked", "Counts, content hashes, versions, metadata, ACLs, stable IDs, links, search, and disposition were reconciled."),
    auditEvent(4, "pilot_rolled_back", M51A_PILOT_SCENARIO_ID, "recorded", "The synthetic target was rolled back while the immutable source remained unchanged."),
  ]);
  const boundary = createM51ADemoBoundary();
  return immutable({
    scenarioId: M51A_PILOT_SCENARIO_ID,
    evaluatedAt: M51A_PILOT_EVALUATED_AT,
    connector,
    sourceItems,
    targetItems,
    attempts,
    reconciliation,
    rollback,
    auditEvents,
    boundary,
    accepted:
      sourceItems.length === 12 &&
      M51A_PILOT_CATEGORIES.every(
        (category) =>
          sourceItems.filter((item) => item.category === category).length === 2,
      ) &&
      sourceItems.every(
        (item) =>
          M51A_METADATA_FIELD_CODES.every((field) => field in item.metadata) &&
          item.versions.length === 2 &&
          item.sourceImmutable &&
          !item.realDataUsed,
      ) &&
      reconciliation.passed &&
      rollback.sourceUnchanged &&
      rollback.rollbackComplete &&
      boundary.productionRows === 0 &&
      boundary.liveWrites === 0,
    productionRows: 0,
    liveWrites: 0,
    realDataUsed: false,
    synthetic: true,
  });
}
