import type {
  M51aConnectorActorContext,
  M51aConnectorRegistryEntry,
  M51aMicrosoftPermissionSet,
} from "@contracts/m51a/microsoft-connectors";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import {
  M51B_SHAREPOINT_COMPLETED_AT,
  M51B_SHAREPOINT_CONNECTOR_ID,
  M51B_SHAREPOINT_EVALUATED_AT,
  M51B_SHAREPOINT_STABLE_OBJECT_ID,
  M51B_SHAREPOINT_WORKFLOW_ID,
  type M51BSharePointScenarioFixtures,
  type M51BSharePointWorkflowRequest,
} from "@contracts/m51b/sharepoint";
import { createSyntheticM51aConnectorRegistryEntries } from "../../m51a/connectors/synthetic-repository-fixtures";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const WRITER_GROUP_ID = "SYNTH-M51B-GROUP-SHAREPOINT-PUBLISHERS";
const ITEM_ID = "SYNTH-M51B-SP-ITEM-001";
const PARENT_ID = "SYNTH-M51B-SP-PUBLISHED-ROOT";

function approvedPermissions(): M51aMicrosoftPermissionSet {
  return frozen({
    permissionSnapshotId: "SYNTH-M51B-SP-ACL-APPROVED-PUBLISHERS",
    externalSharingAllowed: false,
    anonymousLinksAllowed: false,
    grants: frozen([
      frozen({
        principalType: "group" as const,
        principalId: WRITER_GROUP_ID,
        roles: frozen(["read" as const, "write" as const]),
        inherited: true,
      }),
    ]),
  });
}

export function createM51bSharePointConnector(): M51aConnectorRegistryEntry {
  const base = createSyntheticM51aConnectorRegistryEntries().find(
    (candidate) => candidate.connectorId === "SYNTH-CONNECTOR-PUBLISHED",
  );
  if (!base) throw new Error("M51B_PUBLISHED_SHAREPOINT_CONNECTOR_REQUIRED");
  const permissions = approvedPermissions();
  return frozen({
    ...base,
    connectorId: M51B_SHAREPOINT_CONNECTOR_ID,
    displayName: "M5.1B Approved Published Content Synchronization",
    businessPurpose:
      "Synchronize approved AMOS-DMS intranet guidance to a constrained synthetic SharePoint library.",
    location: frozen({
      ...base.location,
      rootItemId: PARENT_ID,
      libraryName: "M5.1B Published Intranet Content",
    }),
    owner: frozen({
      ...base.owner,
      actorId: "SYNTH-M51B-ACTOR-SHAREPOINT-OWNER",
      role: "managing-director",
      divisionId: "enterprise",
      accountableTeam: "Enterprise Operations Publishing",
    }),
    recordClasses: frozen(["intranet-publication", "approved-guidance"]),
    contentTypes: frozen(["intranet-knowledge-article"]),
    retentionPolicy: frozen({
      ...base.retentionPolicy,
      policyId: "SYNTH-M51B-RETENTION-PUBLISHED-GUIDANCE",
      scheduleCode: "AMOS-DMS-PUBLISHED-GUIDANCE-7Y",
    }),
    permissionModel: frozen({
      ...base.permissionModel,
      repositoryPermissions: permissions,
    }),
    sync: frozen({
      ...base.sync,
      checkpoint: null,
      lastSuccessfulReconciliationAt: null,
    }),
  });
}

/**
 * The inherited M5.1A adapter validates the enterprise registry as a complete
 * four-mode control set. Replace only the published-content fixture while
 * retaining the remaining canonical synthetic repositories.
 */
export function createM51bSharePointRegistry(): readonly M51aConnectorRegistryEntry[] {
  const connector = createM51bSharePointConnector();
  return frozen(
    createSyntheticM51aConnectorRegistryEntries().map((candidate) =>
      candidate.connectorId === "SYNTH-CONNECTOR-PUBLISHED"
        ? connector
        : candidate,
    ),
  );
}

function initialTarget(
  connector: M51aConnectorRegistryEntry,
): M51aMicrosoftItemSnapshot {
  const path = `${connector.location.sitePath}/${connector.location.libraryName}/Operations-Hub-Staff-Guide.aspx`;
  return frozen({
    connectorId: connector.connectorId,
    stableObjectId: M51B_SHAREPOINT_STABLE_OBJECT_ID,
    address: frozen({
      tenantId: connector.location.tenantId,
      siteId: connector.location.siteId,
      driveId: connector.location.driveId,
      itemId: ITEM_ID,
      listId: null,
      listItemId: null,
    }),
    name: "Operations-Hub-Staff-Guide.aspx",
    path,
    parentItemId: connector.location.rootItemId,
    webUrl: `https://amos-synthetic.invalid${path}`,
    eTag: `"SYNTH-ETAG-${ITEM_ID}-V1"`,
    cTag: `"SYNTH-CTAG-${ITEM_ID}-V1"`,
    versionId: `SYNTH-VERSION-${ITEM_ID}-1`,
    contentHash: "sha256:synthetic-approved-sharepoint-v1",
    metadataHash: "sha256:synthetic-approved-sharepoint-metadata-v1",
    lastModifiedAt: M51B_SHAREPOINT_EVALUATED_AT,
    handlingClass: connector.handlingClass,
    sensitivityLabelRef: connector.sensitivityLabelRef,
    permissions: connector.permissionModel.repositoryPermissions,
    retention: frozen({
      policyId: connector.retentionPolicy.policyId,
      retentionUntil: "2033-07-15T00:00:00.000Z",
      legalHoldIds: frozen([]),
      recordLocked: false,
      dispositionAllowed: true,
      liveRetentionMutationAvailable: false,
    }),
    deleted: false,
    searchVisible: true,
    synthetic: true,
  });
}

function desiredSource(
  initial: M51aMicrosoftItemSnapshot,
): M51aMicrosoftItemSnapshot {
  return frozen({
    ...initial,
    eTag: `"SYNTH-ETAG-${ITEM_ID}-V2"`,
    cTag: `"SYNTH-CTAG-${ITEM_ID}-V2"`,
    versionId: `SYNTH-VERSION-${ITEM_ID}-2`,
    contentHash: "sha256:synthetic-approved-sharepoint-v2",
    lastModifiedAt: M51B_SHAREPOINT_COMPLETED_AT,
  });
}

export function createM51bSharePointActor(
  connector: M51aConnectorRegistryEntry,
): M51aConnectorActorContext {
  return frozen({
    actorId: "SYNTH-M51B-ACTOR-MANAGING-DIRECTOR",
    role: "managing-director",
    roleTier: "T1",
    divisions: frozen(["enterprise"]),
    amosPermissions: frozen([
      "dms.connector.discover",
      "dms.connector.read",
      "dms.connector.write",
    ]),
    purposeOfUse: "operations",
    tenantId: connector.location.tenantId,
    microsoftPrincipalId: "SYNTH-M51B-PRINCIPAL-MANAGING-DIRECTOR",
    microsoftGroupIds: frozen([WRITER_GROUP_ID]),
    graphScopes: frozen(["Sites.ReadWrite.All"]),
    part2ConsentId: null,
    enterpriseEntitlements: frozen([]),
    externalGuest: false,
    synthetic: true,
  });
}

function approvedRequest(
  connector: M51aConnectorRegistryEntry,
  item: M51aMicrosoftItemSnapshot,
  desired: M51aMicrosoftItemSnapshot,
): M51BSharePointWorkflowRequest {
  return frozen({
    workflowId: M51B_SHAREPOINT_WORKFLOW_ID,
    correlationId: "SYNTH-M51B-CORRELATION-SHAREPOINT-001",
    idempotencyKey: "SYNTH-M51B-IDEMPOTENCY-SHAREPOINT-DELIVERY-001",
    connectorId: connector.connectorId,
    stableObjectId: item.stableObjectId,
    actorRole: "managing-director",
    operation: "content_write",
    expectedETag: item.eTag,
    contentHash: desired.contentHash,
    handlingClass: item.handlingClass,
    sensitivityLabelRef: item.sensitivityLabelRef,
    retentionPolicyId: item.retention.policyId,
    lifecycleState: "Published",
    approvalState: "approved",
    sourceOfTruth: "AMOS-DMS",
    routeCode: connector.intranetRoute.destination,
    requestedAt: M51B_SHAREPOINT_EVALUATED_AT,
    targetCompletionAt: M51B_SHAREPOINT_COMPLETED_AT,
    synthetic: true,
  });
}

export function createM51bSharePointScenarioFixtures(): M51BSharePointScenarioFixtures {
  const connector = createM51bSharePointConnector();
  const initial = initialTarget(connector);
  const desired = desiredSource(initial);
  return frozen({
    connector,
    actor: createM51bSharePointActor(connector),
    request: approvedRequest(connector, initial, desired),
    initialTarget: initial,
    desiredSource: desired,
  });
}
