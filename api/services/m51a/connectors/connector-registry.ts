import {
  M51A_CONNECTOR_MODE_OPERATION_MATRIX,
  M51A_CONNECTOR_MODES,
  M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS,
  type M51aConnectorMode,
  type M51aConnectorRegistryEntry,
  type M51aConnectorRegistryValidationIssue,
  type M51aMicrosoftRepositoryLocation,
} from "@contracts/m51a/microsoft-connectors";
import { M51A_EVIDENCE_CLASS, requireM51ASyntheticId } from "@contracts/m51a/shared";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

export function m51aRepositoryAddressKey(
  location: M51aMicrosoftRepositoryLocation,
): string {
  return [
    location.tenantId,
    location.siteId,
    location.driveId,
    location.rootItemId,
  ].join("::");
}

function sameValues(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function issue(
  connectorId: string,
  code: string,
  field: string,
  message: string,
): M51aConnectorRegistryValidationIssue {
  return frozen({ connectorId, code, field, message });
}

export function validateM51aConnectorRegistry(
  entries: readonly M51aConnectorRegistryEntry[],
  requireAllModes = true,
): readonly M51aConnectorRegistryValidationIssue[] {
  const issues: M51aConnectorRegistryValidationIssue[] = [];
  const connectorIds = new Set<string>();
  const repositoryAddresses = new Set<string>();
  const modes = new Set<M51aConnectorMode>();

  for (const entry of entries) {
    const connectorId = entry.connectorId || "M51A-UNKNOWN-CONNECTOR";
    for (const field of M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS) {
      if (!(field in entry) || entry[field] === undefined) {
        issues.push(
          issue(
            connectorId,
            "M51A_REGISTRY_REQUIRED_FIELD_MISSING",
            field,
            `Required connector registry field ${field} is missing.`,
          ),
        );
      }
    }

    try {
      requireM51ASyntheticId(entry.connectorId, "connector_id");
      requireM51ASyntheticId(entry.location.tenantId, "tenant_id");
      requireM51ASyntheticId(entry.location.siteId, "site_id");
      requireM51ASyntheticId(entry.location.driveId, "drive_id");
      requireM51ASyntheticId(entry.location.rootItemId, "root_item_id");
      requireM51ASyntheticId(entry.owner.actorId, "owner_actor_id");
    } catch (error) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_SYNTHETIC_ID_REQUIRED",
          "identity",
          error instanceof Error ? error.message : "Synthetic identity required.",
        ),
      );
    }

    if (connectorIds.has(entry.connectorId)) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_DUPLICATE_CONNECTOR_ID",
          "connectorId",
          "Each repository must be registered exactly once.",
        ),
      );
    }
    connectorIds.add(entry.connectorId);

    const address = m51aRepositoryAddressKey(entry.location);
    if (repositoryAddresses.has(address)) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_DUPLICATE_REPOSITORY_ADDRESS",
          "location",
          "A Microsoft repository address may have only one active connector.",
        ),
      );
    }
    repositoryAddresses.add(address);
    modes.add(entry.connectorMode);

    const expectedOperations =
      M51A_CONNECTOR_MODE_OPERATION_MATRIX[entry.connectorMode];
    if (!expectedOperations) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_CONNECTOR_MODE_INVALID",
          "connectorMode",
          "Connector mode is not canonical.",
        ),
      );
    } else if (!sameValues(entry.allowedOperations, expectedOperations)) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_OPERATION_MATRIX_MISMATCH",
          "allowedOperations",
          "Allowed operations must exactly match the canonical connector mode.",
        ),
      );
    }

    if (
      entry.recordClasses.length === 0 ||
      entry.contentTypes.length === 0 ||
      !entry.businessPurpose.trim() ||
      !entry.owner.accountableTeam.trim() ||
      !entry.sensitivityLabelRef.trim() ||
      !entry.dlpPolicyRef.trim() ||
      !entry.intranetRoute.routePath.trim() ||
      !entry.retentionPolicy.policyId.trim() ||
      !entry.retentionPolicy.scheduleCode.trim()
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_GOVERNANCE_METADATA_INCOMPLETE",
          "governanceMetadata",
          "Owner, purpose, record class, and content type are required.",
        ),
      );
    }

    if (
      entry.retentionPolicy.dispositionAuthority !== "AMOS-DMS" ||
      !entry.retentionPolicy.legalHoldCapable ||
      !entry.retentionPolicy.recordLockCapable ||
      entry.retentionPolicy.livePolicyActivation
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_RETENTION_CONTROL_INVALID",
          "retentionPolicy",
          "Retention authority, legal hold, record lock, and no-live-activation controls are required.",
        ),
      );
    }

    const expectedSync =
      entry.connectorMode === "Excluded/System-Managed"
        ? { method: "excluded", state: "excluded", cadence: "none" }
        : entry.connectorMode === "Metadata-Only Restricted Reference"
          ? {
              method: "synthetic_metadata_inventory",
              state: "metadata_only",
              cadence: "event_plus_daily_reconciliation",
            }
          : {
              method: "synthetic_delta",
              state: "ready",
              cadence:
                entry.repositoryKind === "onedrive_workbench"
                  ? "daily"
                  : "event_plus_daily_reconciliation",
            };
    if (
      entry.sync.method !== expectedSync.method ||
      entry.sync.state !== expectedSync.state ||
      entry.sync.cadence !== expectedSync.cadence ||
      entry.sync.maximumAttempts !== 4
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_SYNC_STATE_INCONSISTENT",
          "sync",
          "Sync method, state, cadence, and retry bound must match the connector mode.",
        ),
      );
    }

    const exceptionComplete =
      entry.exceptionState.status === "none"
        ? entry.exceptionState.code === null &&
          entry.exceptionState.rationale === null
        : Boolean(
            entry.exceptionState.code?.trim() &&
              entry.exceptionState.rationale?.trim(),
          );
    if (!exceptionComplete) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_EXCEPTION_STATE_INCOMPLETE",
          "exceptionState",
          "Exception state requires a consistent code and rationale.",
        ),
      );
    }

    if (
      (entry.connectorMode === "Excluded/System-Managed") !==
        (entry.status === "excluded") ||
      (entry.exceptionState.status === "quarantined") !==
        (entry.status === "quarantined")
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_HEALTH_STATUS_INCONSISTENT",
          "status",
          "Connector status must match exclusion and quarantine state.",
        ),
      );
    }

    if (
      entry.credentialReference !== null ||
      entry.liveTenantConnected ||
      entry.liveReadsAvailable ||
      entry.liveWritesAvailable ||
      !entry.synthetic ||
      entry.evidenceClass !== M51A_EVIDENCE_CLASS
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_SYNTHETIC_BOUNDARY_VIOLATION",
          "syntheticBoundary",
          "Registry entries must contain no credential or live Microsoft capability.",
        ),
      );
    }

    if (
      entry.permissionModel.externalSharingAllowed ||
      entry.permissionModel.anonymousLinksAllowed ||
      entry.permissionModel.repositoryPermissions.externalSharingAllowed ||
      entry.permissionModel.repositoryPermissions.anonymousLinksAllowed
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_EXTERNAL_SHARING_PROHIBITED",
          "permissionModel",
          "External and anonymous sharing must be denied by default.",
        ),
      );
    }

    const mustBeExcluded =
      entry.repositoryKind === "system_managed_library" ||
      /personalcachelibrary|hr365\s+support/i.test(entry.displayName);
    if (
      mustBeExcluded &&
      (entry.connectorMode !== "Excluded/System-Managed" ||
        entry.disposition !== "Exclude" ||
        entry.status !== "excluded" ||
        entry.intranetRoute.visibility !== "excluded")
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_SYSTEM_REPOSITORY_NOT_EXCLUDED",
          "connectorMode",
          "System-managed repositories must be excluded from indexing and migration.",
        ),
      );
    }

    if (
      entry.handlingClass.startsWith("restricted-") &&
      entry.connectorMode !== "Metadata-Only Restricted Reference" &&
      entry.connectorMode !== "Excluded/System-Managed"
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_RESTRICTED_MODE_REQUIRED",
          "connectorMode",
          "Restricted repositories must be metadata-only or excluded in M5.1A.",
        ),
      );
    }

    if (
      entry.connectorMode === "Excluded/System-Managed" &&
      (entry.sync.method !== "excluded" || entry.sync.cadence !== "none")
    ) {
      issues.push(
        issue(
          connectorId,
          "M51A_REGISTRY_EXCLUDED_SYNC_PROHIBITED",
          "sync",
          "Excluded repositories cannot have a content synchronization plan.",
        ),
      );
    }
  }

  if (requireAllModes) {
    for (const mode of M51A_CONNECTOR_MODES) {
      if (!modes.has(mode)) {
        issues.push(
          issue(
            "M51A-REGISTRY",
            "M51A_REGISTRY_CONNECTOR_MODE_NOT_REPRESENTED",
            "connectorMode",
            `Synthetic registry must represent ${mode}.`,
          ),
        );
      }
    }
  }

  return frozen(issues);
}

export class M51aConnectorRegistry {
  readonly synthetic = true as const;
  readonly liveTenantConnected = false as const;
  readonly liveReadsAvailable = false as const;
  readonly liveWritesAvailable = false as const;

  private readonly byId: ReadonlyMap<string, M51aConnectorRegistryEntry>;
  private readonly entries: readonly M51aConnectorRegistryEntry[];

  constructor(
    entries: readonly M51aConnectorRegistryEntry[],
    options: { requireAllModes?: boolean } = {},
  ) {
    const validation = validateM51aConnectorRegistry(
      entries,
      options.requireAllModes ?? true,
    );
    if (validation.length > 0) {
      throw new Error(
        `M51A_CONNECTOR_REGISTRY_INVALID:${validation
          .map((candidate) => candidate.code)
          .join(",")}`,
      );
    }
    this.entries = frozen([...entries]);
    this.byId = new Map(entries.map((entry) => [entry.connectorId, entry]));
  }

  list(): readonly M51aConnectorRegistryEntry[] {
    return this.entries;
  }

  get(connectorId: string): M51aConnectorRegistryEntry {
    const entry = this.byId.get(connectorId);
    if (!entry) throw new Error("M51A_CONNECTOR_NOT_FOUND");
    return entry;
  }

  listByMode(mode: M51aConnectorMode): readonly M51aConnectorRegistryEntry[] {
    return frozen(this.entries.filter((entry) => entry.connectorMode === mode));
  }

  inventoryCompleteness(): {
    repositoryCount: number;
    registeredExactlyOnce: true;
    requiredFieldCount: number;
    completeFieldCount: number;
    representedModes: readonly M51aConnectorMode[];
    liveCredentials: 0;
    liveConnections: 0;
    synthetic: true;
  } {
    return frozen({
      repositoryCount: this.entries.length,
      registeredExactlyOnce: true,
      requiredFieldCount:
        this.entries.length * M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS.length,
      completeFieldCount:
        this.entries.length * M51A_REQUIRED_CONNECTOR_REGISTRY_FIELDS.length,
      representedModes: frozen(
        M51A_CONNECTOR_MODES.filter((mode) =>
          this.entries.some((entry) => entry.connectorMode === mode),
        ),
      ),
      liveCredentials: 0,
      liveConnections: 0,
      synthetic: true,
    });
  }
}
