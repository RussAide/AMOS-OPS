import {
  M51A_CONNECTOR_EVALUATION_AS_OF,
  M51A_CONNECTOR_MODE_OPERATION_MATRIX,
  type M51aConnectorIntranetRoute,
  type M51aConnectorMode,
  type M51aConnectorOwner,
  type M51aConnectorRegistryEntry,
  type M51aConnectorRetentionPolicy,
  type M51aMicrosoftPermissionSet,
  type M51aRepositoryClassification,
  type M51aRepositoryDisposition,
  type M51aRepositoryKind,
} from "@contracts/m51a/microsoft-connectors";
import type {
  M51aItemRetentionState,
  M51aMicrosoftItemSnapshot,
} from "@contracts/m51a/stable-object-mapping";
import type {
  M51aContentTypeCode,
  M51aHandlingClassCode,
} from "@contracts/m51a/operations-hub";
import { M51A_EVIDENCE_CLASS } from "@contracts/m51a/shared";

const TENANT_ID = "SYNTH-TENANT-ADOLBI";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function permissionSet(
  snapshotId: string,
  groups: readonly string[],
  users: readonly string[] = [],
): M51aMicrosoftPermissionSet {
  return frozen({
    permissionSnapshotId: snapshotId,
    externalSharingAllowed: false,
    anonymousLinksAllowed: false,
    grants: frozen([
      ...groups.map((principalId) =>
        frozen({
          principalType: "group" as const,
          principalId,
          roles: frozen(["read" as const]),
          inherited: true,
        }),
      ),
      ...users.map((principalId) =>
        frozen({
          principalType: "user" as const,
          principalId,
          roles: frozen(["read" as const]),
          inherited: false,
        }),
      ),
    ]),
  });
}

interface RepositoryFixtureInput {
  connectorId: string;
  displayName: string;
  repositoryKind: M51aRepositoryKind;
  siteId: string;
  driveId: string;
  rootItemId: string;
  sitePath: string;
  owner: M51aConnectorOwner;
  businessPurpose: string;
  classification: M51aRepositoryClassification;
  recordClasses: readonly string[];
  handlingClass: M51aHandlingClassCode;
  contentTypes: readonly M51aContentTypeCode[];
  connectorMode: M51aConnectorMode;
  disposition: M51aRepositoryDisposition;
  intranetRoute: M51aConnectorIntranetRoute;
  lifecycle: M51aConnectorRegistryEntry["lifecycle"];
  authoritativeStatus: M51aConnectorRegistryEntry["authoritativeStatus"];
  groups: readonly string[];
  status?: M51aConnectorRegistryEntry["status"];
  repositoryException?: M51aConnectorRegistryEntry["exceptionState"];
}

function repositoryFixture(
  input: RepositoryFixtureInput,
): M51aConnectorRegistryEntry {
  const excluded = input.connectorMode === "Excluded/System-Managed";
  const metadataOnly =
    input.connectorMode === "Metadata-Only Restricted Reference";
  const retentionPolicy: M51aConnectorRetentionPolicy = frozen({
    policyId: `SYNTH-RETENTION-${input.connectorId}`,
    scheduleCode: excluded ? "SYSTEM-MANAGED" : "AMOS-DMS-GOVERNED",
    dispositionAuthority: "AMOS-DMS",
    legalHoldCapable: true,
    recordLockCapable: true,
    livePolicyActivation: false,
  });
  return frozen({
    connectorId: input.connectorId,
    displayName: input.displayName,
    repositoryKind: input.repositoryKind,
    location: frozen({
      tenantId: TENANT_ID,
      siteId: input.siteId,
      driveId: input.driveId,
      rootItemId: input.rootItemId,
      listId: null,
      sitePath: input.sitePath,
      libraryName: input.displayName,
    }),
    owner: frozen(input.owner),
    businessPurpose: input.businessPurpose,
    classification: input.classification,
    recordClasses: frozen([...input.recordClasses]),
    handlingClass: input.handlingClass,
    sensitivityLabelRef: `SYNTH-PURVIEW-${input.handlingClass.toUpperCase()}`,
    dlpPolicyRef: `SYNTH-DLP-${input.handlingClass.toUpperCase()}`,
    contentTypes: frozen([...input.contentTypes]),
    connectorMode: input.connectorMode,
    allowedOperations:
      M51A_CONNECTOR_MODE_OPERATION_MATRIX[input.connectorMode],
    authoritativeStatus: input.authoritativeStatus,
    disposition: input.disposition,
    intranetRoute: frozen(input.intranetRoute),
    lifecycle: input.lifecycle,
    retentionPolicy,
    permissionModel: frozen({
      microsoftAclRequired: true,
      amosAuthorizationRequired: true,
      connectorModeEnforced: true,
      sensitivityPolicyEnforced: true,
      externalSharingAllowed: false,
      anonymousLinksAllowed: false,
      repositoryPermissions: permissionSet(
        `SYNTH-ACL-${input.connectorId}`,
        input.groups,
      ),
    }),
    sync: frozen({
      method: excluded
        ? "excluded"
        : metadataOnly
          ? "synthetic_metadata_inventory"
          : "synthetic_delta",
      cadence: excluded
        ? "none"
        : input.repositoryKind === "onedrive_workbench"
          ? "daily"
          : "event_plus_daily_reconciliation",
      state: excluded ? "excluded" : metadataOnly ? "metadata_only" : "ready",
      checkpoint: null,
      lastSuccessfulReconciliationAt: null,
      maximumAttempts: 4,
    }),
    exceptionState: frozen(
      input.repositoryException ?? {
        status: "none" as const,
        code: null,
        rationale: null,
      },
    ),
    status: input.status ?? (excluded ? "excluded" : "active"),
    credentialReference: null,
    liveTenantConnected: false,
    liveReadsAvailable: false,
    liveWritesAvailable: false,
    evidenceClass: M51A_EVIDENCE_CLASS,
    synthetic: true,
  });
}

export function createSyntheticM51aConnectorRegistryEntries(): readonly M51aConnectorRegistryEntry[] {
  return frozen([
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-GOVERNANCE",
      displayName: "Enterprise Governance & Doctrine",
      repositoryKind: "sharepoint_document_library",
      siteId: "SYNTH-SITE-OPERATIONS-HUB",
      driveId: "SYNTH-DRIVE-GOVERNANCE",
      rootItemId: "SYNTH-ROOT-GOVERNANCE",
      sitePath: "/sites/operations-hub",
      owner: {
        actorId: "SYNTH-ACTOR-MANAGING-DIRECTOR",
        role: "managing-director",
        divisionId: "enterprise",
        accountableTeam: "Executive Office",
      },
      businessPurpose: "Controlled enterprise doctrine and governance records.",
      classification: "enterprise_governance",
      recordClasses: ["governance", "doctrine", "board-decision"],
      handlingClass: "internal-controlled",
      contentTypes: ["controlled-policy", "meeting-decision-record"],
      connectorMode: "Governed Full Integration",
      disposition: "Retain",
      intranetRoute: {
        destination: "enterprise-dms-search",
        routePath: "/operations-hub/governance",
        visibility: "general_permission_trimmed",
      },
      lifecycle: "governed",
      authoritativeStatus: "amos_dms_source_of_record",
      groups: ["SYNTH-GROUP-ENTERPRISE-OPS"],
    }),
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-PUBLISHED",
      displayName: "Published Intranet Content",
      repositoryKind: "sharepoint_document_library",
      siteId: "SYNTH-SITE-OPERATIONS-HUB",
      driveId: "SYNTH-DRIVE-PUBLISHED",
      rootItemId: "SYNTH-ROOT-PUBLISHED",
      sitePath: "/sites/operations-hub",
      owner: {
        actorId: "SYNTH-ACTOR-COMMUNICATIONS-OWNER",
        role: "administrator",
        divisionId: "eo",
        accountableTeam: "Enterprise Communications",
      },
      businessPurpose: "Approved content published to the employee intranet.",
      classification: "published_knowledge",
      recordClasses: ["intranet-publication", "knowledge-article"],
      handlingClass: "internal-general",
      contentTypes: ["intranet-knowledge-article"],
      connectorMode: "Governed Full Integration",
      disposition: "Publish",
      intranetRoute: {
        destination: "home-enterprise-operations",
        routePath: "/home/enterprise-operations",
        visibility: "general_permission_trimmed",
      },
      lifecycle: "governed",
      authoritativeStatus: "amos_dms_source_of_record",
      groups: ["SYNTH-GROUP-ALL-STAFF"],
    }),
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-CONTRACTS",
      displayName: "Contracts & Partnerships",
      repositoryKind: "sharepoint_document_library",
      siteId: "SYNTH-SITE-CONTRACTS",
      driveId: "SYNTH-DRIVE-CONTRACTS",
      rootItemId: "SYNTH-ROOT-CONTRACTS",
      sitePath: "/sites/contracts-projects",
      owner: {
        actorId: "SYNTH-ACTOR-CONTRACTS-OWNER",
        role: "administrator",
        divisionId: "eo",
        accountableTeam: "Contracts and Growth",
      },
      businessPurpose: "Permission-trimmed contract and partnership reference.",
      classification: "operational_collaboration",
      recordClasses: ["contract", "grant", "partner-agreement"],
      handlingClass: "confidential",
      contentTypes: ["contract-grant"],
      connectorMode: "Permission-Trimmed Reference",
      disposition: "Retain",
      intranetRoute: {
        destination: "contracts-growth",
        routePath: "/contracts-growth/repository",
        visibility: "restricted_permission_trimmed",
      },
      lifecycle: "governed",
      authoritativeStatus: "governed_reference",
      groups: ["SYNTH-GROUP-CONTRACTS"],
    }),
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-CLINICAL",
      displayName: "Restricted Clinical Records",
      repositoryKind: "sharepoint_document_library",
      siteId: "SYNTH-SITE-RESTRICTED-CLINICAL",
      driveId: "SYNTH-DRIVE-RESTRICTED-CLINICAL",
      rootItemId: "SYNTH-ROOT-RESTRICTED-CLINICAL",
      sitePath: "/sites/restricted-clinical-records",
      owner: {
        actorId: "SYNTH-ACTOR-CLINICAL-DIRECTOR",
        role: "clinical-director",
        divisionId: "bhc",
        accountableTeam: "BHC Clinical Governance",
      },
      businessPurpose: "Restricted clinical repository metadata discovery.",
      classification: "restricted_record",
      recordClasses: ["clinical-record"],
      handlingClass: "restricted-clinical",
      contentTypes: ["general-working-document"],
      connectorMode: "Metadata-Only Restricted Reference",
      disposition: "Quarantine",
      intranetRoute: {
        destination: "clinical",
        routePath: "/clinical/restricted-record-reference",
        visibility: "restricted_permission_trimmed",
      },
      lifecycle: "restricted",
      authoritativeStatus: "governed_reference",
      groups: ["SYNTH-GROUP-BHC-CLINICAL"],
    }),
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-PART2",
      displayName: "Restricted SUD Part 2 Records",
      repositoryKind: "sharepoint_document_library",
      siteId: "SYNTH-SITE-RESTRICTED-PART2",
      driveId: "SYNTH-DRIVE-RESTRICTED-PART2",
      rootItemId: "SYNTH-ROOT-RESTRICTED-PART2",
      sitePath: "/sites/restricted-sud-part2",
      owner: {
        actorId: "SYNTH-ACTOR-COMPLIANCE-OFFICER",
        role: "hr-compliance-officer",
        divisionId: "eo",
        accountableTeam: "Privacy and Compliance",
      },
      businessPurpose: "Part 2 metadata reference under consent-aware controls.",
      classification: "restricted_record",
      recordClasses: ["sud-part2-record"],
      handlingClass: "restricted-sud-part2",
      contentTypes: ["general-working-document"],
      connectorMode: "Metadata-Only Restricted Reference",
      disposition: "Quarantine",
      intranetRoute: {
        destination: "clinical",
        routePath: "/clinical/part2-restricted-reference",
        visibility: "restricted_permission_trimmed",
      },
      lifecycle: "restricted",
      authoritativeStatus: "governed_reference",
      groups: ["SYNTH-GROUP-PART2-AUTHORIZED"],
    }),
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-WORKFORCE-FINANCE",
      displayName: "Restricted Workforce & Financial Records",
      repositoryKind: "sharepoint_document_library",
      siteId: "SYNTH-SITE-RESTRICTED-WORKFORCE-FINANCE",
      driveId: "SYNTH-DRIVE-RESTRICTED-WORKFORCE-FINANCE",
      rootItemId: "SYNTH-ROOT-RESTRICTED-WORKFORCE-FINANCE",
      sitePath: "/sites/restricted-workforce-finance",
      owner: {
        actorId: "SYNTH-ACTOR-HR-DIRECTOR",
        role: "hr-director",
        divisionId: "eo",
        accountableTeam: "Workforce and Finance Governance",
      },
      businessPurpose: "Restricted workforce and financial metadata reference.",
      classification: "restricted_record",
      recordClasses: ["personnel", "payroll", "financial-record"],
      handlingClass: "restricted-workforce-financial",
      contentTypes: ["general-working-document"],
      connectorMode: "Metadata-Only Restricted Reference",
      disposition: "Quarantine",
      intranetRoute: {
        destination: "workforce-learning",
        routePath: "/workforce/restricted-reference",
        visibility: "restricted_permission_trimmed",
      },
      lifecycle: "restricted",
      authoritativeStatus: "governed_reference",
      groups: ["SYNTH-GROUP-HR-FINANCE-AUTHORIZED"],
    }),
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-ONEDRIVE-WORKBENCH",
      displayName: "Executive OneDrive Workbench",
      repositoryKind: "onedrive_workbench",
      siteId: "SYNTH-SITE-ONEDRIVE-EXECUTIVE",
      driveId: "SYNTH-DRIVE-ONEDRIVE-EXECUTIVE",
      rootItemId: "SYNTH-ROOT-ONEDRIVE-EXECUTIVE",
      sitePath: "/personal/synthetic-executive",
      owner: {
        actorId: "SYNTH-ACTOR-MANAGING-DIRECTOR",
        role: "managing-director",
        divisionId: "eo",
        accountableTeam: "Executive Office",
      },
      businessPurpose: "Personal workbench; governed records must publish into AMOS-DMS.",
      classification: "personal_workbench",
      recordClasses: ["working-draft"],
      handlingClass: "internal-controlled",
      contentTypes: ["general-working-document"],
      connectorMode: "Permission-Trimmed Reference",
      disposition: "Retain",
      intranetRoute: {
        destination: "my-work-eia",
        routePath: "/my-work/onedrive-workbench",
        visibility: "restricted_permission_trimmed",
      },
      lifecycle: "working",
      authoritativeStatus: "working_copy",
      groups: ["SYNTH-GROUP-EXECUTIVE-WORKBENCH"],
    }),
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-PERSONAL-CACHE",
      displayName: "PersonalCacheLibrary",
      repositoryKind: "system_managed_library",
      siteId: "SYNTH-SITE-SYSTEM-PERSONAL-CACHE",
      driveId: "SYNTH-DRIVE-SYSTEM-PERSONAL-CACHE",
      rootItemId: "SYNTH-ROOT-SYSTEM-PERSONAL-CACHE",
      sitePath: "/personal/system-cache",
      owner: {
        actorId: "SYNTH-ACTOR-MICROSOFT-SYSTEM-OWNER",
        role: "super-admin",
        divisionId: "eo",
        accountableTeam: "Microsoft 365 Platform Administration",
      },
      businessPurpose: "System-managed cache; never treated as a business repository.",
      classification: "system_managed",
      recordClasses: ["system-cache"],
      handlingClass: "internal-general",
      contentTypes: ["general-working-document"],
      connectorMode: "Excluded/System-Managed",
      disposition: "Exclude",
      intranetRoute: {
        destination: "system-administration",
        routePath: "/system-administration/excluded-repositories",
        visibility: "excluded",
      },
      lifecycle: "system_managed",
      authoritativeStatus: "system_managed_non_business_record",
      groups: ["SYNTH-GROUP-M365-PLATFORM-ADMINS"],
    }),
    repositoryFixture({
      connectorId: "SYNTH-CONNECTOR-HR365-SUPPORT",
      displayName: "HR365 Support Library",
      repositoryKind: "system_managed_library",
      siteId: "SYNTH-SITE-SYSTEM-HR365",
      driveId: "SYNTH-DRIVE-SYSTEM-HR365",
      rootItemId: "SYNTH-ROOT-SYSTEM-HR365",
      sitePath: "/sites/hr365-system",
      owner: {
        actorId: "SYNTH-ACTOR-MICROSOFT-SYSTEM-OWNER",
        role: "super-admin",
        divisionId: "eo",
        accountableTeam: "Microsoft 365 Platform Administration",
      },
      businessPurpose: "System support library excluded from business indexing and migration.",
      classification: "system_managed",
      recordClasses: ["application-support"],
      handlingClass: "restricted-workforce-financial",
      contentTypes: ["general-working-document"],
      connectorMode: "Excluded/System-Managed",
      disposition: "Exclude",
      intranetRoute: {
        destination: "system-administration",
        routePath: "/system-administration/excluded-repositories",
        visibility: "excluded",
      },
      lifecycle: "system_managed",
      authoritativeStatus: "system_managed_non_business_record",
      groups: ["SYNTH-GROUP-M365-PLATFORM-ADMINS"],
    }),
  ]);
}

function retentionState(
  connectorId: string,
  overrides: Partial<M51aItemRetentionState> = {},
): M51aItemRetentionState {
  return frozen({
    policyId: `SYNTH-RETENTION-${connectorId}`,
    retentionUntil: null,
    legalHoldIds: frozen([]),
    recordLocked: false,
    dispositionAllowed: true,
    liveRetentionMutationAvailable: false,
    ...overrides,
  });
}

interface ItemFixtureInput {
  connector: M51aConnectorRegistryEntry;
  stableObjectId: string;
  itemId: string;
  name: string;
  parentItemId: string;
  version: number;
  retention?: M51aItemRetentionState;
}

function itemFixture(input: ItemFixtureInput): M51aMicrosoftItemSnapshot {
  const path = `${input.connector.location.sitePath}/${input.connector.location.libraryName}/${input.name}`;
  return frozen({
    connectorId: input.connector.connectorId,
    stableObjectId: input.stableObjectId,
    address: frozen({
      tenantId: input.connector.location.tenantId,
      siteId: input.connector.location.siteId,
      driveId: input.connector.location.driveId,
      itemId: input.itemId,
      listId: null,
      listItemId: null,
    }),
    name: input.name,
    path,
    parentItemId: input.parentItemId,
    webUrl: `https://amos-synthetic.invalid${path}`,
    eTag: `"SYNTH-ETAG-${input.itemId}-V${input.version}"`,
    cTag: `"SYNTH-CTAG-${input.itemId}-V${input.version}"`,
    versionId: `SYNTH-VERSION-${input.itemId}-${input.version}`,
    contentHash: `sha256:synth-content-${input.itemId.toLowerCase()}-${input.version}`,
    metadataHash: `sha256:synth-metadata-${input.itemId.toLowerCase()}-${input.version}`,
    lastModifiedAt: M51A_CONNECTOR_EVALUATION_AS_OF,
    handlingClass: input.connector.handlingClass,
    sensitivityLabelRef: input.connector.sensitivityLabelRef,
    permissions: input.connector.permissionModel.repositoryPermissions,
    retention: input.retention ?? retentionState(input.connector.connectorId),
    deleted: false,
    searchVisible:
      input.connector.connectorMode !== "Excluded/System-Managed",
    synthetic: true,
  });
}

export function createSyntheticM51aMicrosoftItems(
  repositories: readonly M51aConnectorRegistryEntry[] =
    createSyntheticM51aConnectorRegistryEntries(),
): readonly M51aMicrosoftItemSnapshot[] {
  const byId = new Map(repositories.map((entry) => [entry.connectorId, entry]));
  const get = (connectorId: string): M51aConnectorRegistryEntry => {
    const entry = byId.get(connectorId);
    if (!entry) throw new Error(`M51A_SYNTHETIC_CONNECTOR_REQUIRED:${connectorId}`);
    return entry;
  };
  return frozen([
    itemFixture({
      connector: get("SYNTH-CONNECTOR-GOVERNANCE"),
      stableObjectId: "SYNTH-AMOS-OBJECT-GOVERNANCE-001",
      itemId: "SYNTH-ITEM-GOVERNANCE-001",
      name: "Enterprise-Doctrine.docx",
      parentItemId: "SYNTH-ROOT-GOVERNANCE",
      version: 1,
    }),
    itemFixture({
      connector: get("SYNTH-CONNECTOR-PUBLISHED"),
      stableObjectId: "SYNTH-AMOS-OBJECT-PUBLISHED-001",
      itemId: "SYNTH-ITEM-PUBLISHED-001",
      name: "Operations-Hub-Welcome.aspx",
      parentItemId: "SYNTH-ROOT-PUBLISHED",
      version: 1,
    }),
    itemFixture({
      connector: get("SYNTH-CONNECTOR-CONTRACTS"),
      stableObjectId: "SYNTH-AMOS-OBJECT-CONTRACT-001",
      itemId: "SYNTH-ITEM-CONTRACT-001",
      name: "Synthetic-Partner-Agreement.docx",
      parentItemId: "SYNTH-ROOT-CONTRACTS",
      version: 2,
    }),
    itemFixture({
      connector: get("SYNTH-CONNECTOR-CLINICAL"),
      stableObjectId: "SYNTH-AMOS-OBJECT-CLINICAL-001",
      itemId: "SYNTH-ITEM-CLINICAL-001",
      name: "Synthetic-Clinical-Record.json",
      parentItemId: "SYNTH-ROOT-RESTRICTED-CLINICAL",
      version: 1,
      retention: retentionState("SYNTH-CONNECTOR-CLINICAL", {
        retentionUntil: "2037-01-15T00:00:00.000Z",
        dispositionAllowed: false,
      }),
    }),
    itemFixture({
      connector: get("SYNTH-CONNECTOR-PART2"),
      stableObjectId: "SYNTH-AMOS-OBJECT-PART2-001",
      itemId: "SYNTH-ITEM-PART2-001",
      name: "Synthetic-Part2-Record.json",
      parentItemId: "SYNTH-ROOT-RESTRICTED-PART2",
      version: 1,
      retention: retentionState("SYNTH-CONNECTOR-PART2", {
        legalHoldIds: frozen(["SYNTH-HOLD-PART2-001"]),
        recordLocked: true,
        dispositionAllowed: false,
      }),
    }),
    itemFixture({
      connector: get("SYNTH-CONNECTOR-WORKFORCE-FINANCE"),
      stableObjectId: "SYNTH-AMOS-OBJECT-WORKFORCE-001",
      itemId: "SYNTH-ITEM-WORKFORCE-001",
      name: "Synthetic-Workforce-Record.json",
      parentItemId: "SYNTH-ROOT-RESTRICTED-WORKFORCE-FINANCE",
      version: 1,
      retention: retentionState("SYNTH-CONNECTOR-WORKFORCE-FINANCE", {
        recordLocked: true,
        dispositionAllowed: false,
      }),
    }),
    itemFixture({
      connector: get("SYNTH-CONNECTOR-ONEDRIVE-WORKBENCH"),
      stableObjectId: "SYNTH-AMOS-OBJECT-WORKBENCH-001",
      itemId: "SYNTH-ITEM-WORKBENCH-001",
      name: "Synthetic-Executive-Draft.docx",
      parentItemId: "SYNTH-ROOT-ONEDRIVE-EXECUTIVE",
      version: 3,
    }),
  ]);
}

export const M51A_SYNTHETIC_TENANT_ID = TENANT_ID;
