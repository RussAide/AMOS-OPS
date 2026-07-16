import {
  M51A_CONNECTOR_EVALUATION_AS_OF,
  type M51aConnectorAccessDecision,
  type M51aConnectorActorContext,
  type M51aConnectorOperation,
  type M51aConnectorRegistryEntry,
  type M51aMicrosoftPermissionSet,
  type M51aPurposeOfUse,
} from "@contracts/m51a/microsoft-connectors";
import type { M51aHandlingClassCode } from "@contracts/m51a/operations-hub";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

const HANDLING_RANK: Readonly<Record<M51aHandlingClassCode, number>> =
  Object.freeze({
    "internal-general": 0,
    "internal-controlled": 1,
    confidential: 2,
    "restricted-clinical": 3,
    "restricted-workforce-financial": 4,
    "restricted-sud-part2": 5,
  });

const HANDLING_PERMISSION: Readonly<Record<M51aHandlingClassCode, string | null>> =
  Object.freeze({
    "internal-general": null,
    "internal-controlled": "dms.handling.internal_controlled",
    confidential: "dms.handling.confidential",
    "restricted-clinical": "dms.handling.restricted_clinical",
    "restricted-sud-part2": "dms.handling.restricted_part2",
    "restricted-workforce-financial":
      "dms.handling.restricted_workforce_financial",
  });

const HANDLING_ROLE_TIERS: Readonly<
  Record<M51aHandlingClassCode, readonly M51aConnectorActorContext["roleTier"][]>
> = Object.freeze({
  "internal-general": Object.freeze(["T1", "T2", "T3", "T4"] as const),
  "internal-controlled": Object.freeze(["T1", "T2", "T3", "T4"] as const),
  confidential: Object.freeze(["T1", "T2", "T3"] as const),
  "restricted-clinical": Object.freeze(["T1", "T2", "T3", "T4"] as const),
  "restricted-sud-part2": Object.freeze(["T1", "T2", "T3", "T4"] as const),
  "restricted-workforce-financial": Object.freeze(["T1", "T2", "T3", "T4"] as const),
});

const MUTATING_OPERATIONS = new Set<M51aConnectorOperation>([
  "metadata_write",
  "content_write",
  "publish",
  "move",
  "delete",
]);

const CONTENT_OPERATIONS = new Set<M51aConnectorOperation>([
  "content_read",
  "download",
  "content_write",
  "publish",
]);

const READ_OPERATIONS = new Set<M51aConnectorOperation>([
  "discover_repository",
  "metadata_read",
  "content_read",
  "search_index",
  "download",
  "reconcile",
]);

function effectiveHandlingClass(
  repositoryClass: M51aHandlingClassCode,
  itemClass: M51aHandlingClassCode | null,
): M51aHandlingClassCode {
  if (!itemClass) return repositoryClass;
  return HANDLING_RANK[itemClass] > HANDLING_RANK[repositoryClass]
    ? itemClass
    : repositoryClass;
}

function hasMicrosoftAcl(
  permissionSet: M51aMicrosoftPermissionSet,
  actor: M51aConnectorActorContext,
  write: boolean,
): boolean {
  const principals = new Set([
    actor.microsoftPrincipalId,
    ...actor.microsoftGroupIds,
  ]);
  return permissionSet.grants.some((grant) => {
    if (!principals.has(grant.principalId)) return false;
    if (write) return grant.roles.includes("write") || grant.roles.includes("owner");
    return (
      grant.roles.includes("read") ||
      grant.roles.includes("write") ||
      grant.roles.includes("owner")
    );
  });
}

function hasGraphScope(
  actor: M51aConnectorActorContext,
  write: boolean,
): boolean {
  const scopes = new Set(actor.graphScopes);
  if (write) {
    return scopes.has("Sites.ReadWrite.All") || scopes.has("Files.ReadWrite.All");
  }
  return (
    scopes.has("Sites.Read.All") ||
    scopes.has("Files.Read.All") ||
    scopes.has("Sites.Selected") ||
    scopes.has("Sites.ReadWrite.All") ||
    scopes.has("Files.ReadWrite.All")
  );
}

function purposeAllowed(
  handlingClass: M51aHandlingClassCode,
  purpose: M51aPurposeOfUse,
): boolean {
  switch (handlingClass) {
    case "restricted-clinical":
      return purpose === "treatment" || purpose === "operations" || purpose === "compliance";
    case "restricted-sud-part2":
      return purpose === "treatment" || purpose === "operations" || purpose === "compliance";
    case "restricted-workforce-financial":
      return (
        purpose === "workforce_operations" ||
        purpose === "financial_operations" ||
        purpose === "compliance"
      );
    default:
      return true;
  }
}

function baseAmosPermission(operation: M51aConnectorOperation): string {
  if (operation === "discover_repository") return "dms.connector.discover";
  if (MUTATING_OPERATIONS.has(operation)) return "dms.connector.write";
  return "dms.connector.read";
}

function downloadAllowed(handlingClass: M51aHandlingClassCode): boolean {
  return !handlingClass.startsWith("restricted-");
}

function hasDivisionScope(
  connector: M51aConnectorRegistryEntry,
  actor: M51aConnectorActorContext,
): boolean {
  if (connector.owner.divisionId === "enterprise") return true;
  return (
    actor.divisions.includes("enterprise") ||
    actor.divisions.includes(connector.owner.divisionId) ||
    actor.enterpriseEntitlements.includes(
      `cross_division:${connector.owner.divisionId}`,
    )
  );
}

export function evaluateM51aConnectorAccess(
  connector: M51aConnectorRegistryEntry,
  actor: M51aConnectorActorContext,
  operation: M51aConnectorOperation,
  item: M51aMicrosoftItemSnapshot | null = null,
  evaluatedAt: string = M51A_CONNECTOR_EVALUATION_AS_OF,
): M51aConnectorAccessDecision {
  if (!Number.isFinite(Date.parse(evaluatedAt))) {
    throw new Error("M51A_CONNECTOR_ACCESS_TIME_INVALID");
  }
  if (item && item.connectorId !== connector.connectorId) {
    throw new Error("M51A_CONNECTOR_ITEM_MISMATCH");
  }

  const reasons: string[] = [];
  const handlingClass = effectiveHandlingClass(
    connector.handlingClass,
    item?.handlingClass ?? null,
  );
  const architectureOperationAllowed =
    connector.allowedOperations.includes(operation);
  const write = MUTATING_OPERATIONS.has(operation);
  const repositoryPermissions = connector.permissionModel.repositoryPermissions;
  const itemPermissions = item?.permissions ?? repositoryPermissions;

  if (!architectureOperationAllowed) reasons.push("M51A_CONNECTOR_MODE_DENY");
  if (
    connector.connectorMode === "Excluded/System-Managed" &&
    operation !== "discover_repository"
  ) {
    reasons.push("M51A_EXCLUDED_REPOSITORY_DENY");
  }
  if (actor.externalGuest) reasons.push("M51A_EXTERNAL_GUEST_DENY");
  if (actor.tenantId !== connector.location.tenantId) {
    reasons.push("M51A_MICROSOFT_TENANT_MISMATCH");
  }
  if (!hasGraphScope(actor, write)) reasons.push("M51A_GRAPH_SCOPE_REQUIRED");
  if (!actor.amosPermissions.includes(baseAmosPermission(operation))) {
    reasons.push("M51A_AMOS_CONNECTOR_PERMISSION_REQUIRED");
  }
  const handlingPermission = HANDLING_PERMISSION[handlingClass];
  if (!HANDLING_ROLE_TIERS[handlingClass].includes(actor.roleTier)) {
    reasons.push("M51A_AMOS_ROLE_TIER_DENY");
  }
  if (handlingPermission && !actor.amosPermissions.includes(handlingPermission)) {
    reasons.push("M51A_AMOS_HANDLING_PERMISSION_REQUIRED");
  }
  if (!hasDivisionScope(connector, actor)) {
    reasons.push("M51A_DIVISION_SCOPE_DENY");
  }
  if (!purposeAllowed(handlingClass, actor.purposeOfUse)) {
    reasons.push("M51A_MINIMUM_NECESSARY_PURPOSE_DENY");
  }
  if (
    handlingClass === "restricted-sud-part2" &&
    (!actor.part2ConsentId ||
      !actor.enterpriseEntitlements.includes("part2.consent_authorized"))
  ) {
    reasons.push("M51A_PART2_CONSENT_AUTHORIZATION_REQUIRED");
  }
  if (!hasMicrosoftAcl(repositoryPermissions, actor, write)) {
    reasons.push("M51A_MICROSOFT_REPOSITORY_ACL_DENY");
  }
  if (!hasMicrosoftAcl(itemPermissions, actor, write)) {
    reasons.push("M51A_MICROSOFT_ITEM_ACL_DENY");
  }
  if (operation === "download" && !downloadAllowed(handlingClass)) {
    reasons.push("M51A_HANDLING_CLASS_DOWNLOAD_DENY");
  }
  if (item && write) {
    if (item.retention.recordLocked) reasons.push("M51A_RECORD_LOCK_WRITE_DENY");
    if (item.retention.legalHoldIds.length > 0) {
      reasons.push("M51A_LEGAL_HOLD_WRITE_DENY");
    }
    if (
      operation === "delete" &&
      (!item.retention.dispositionAllowed ||
        (item.retention.retentionUntil !== null &&
          Date.parse(item.retention.retentionUntil) > Date.parse(evaluatedAt)))
    ) {
      reasons.push("M51A_RETENTION_DISPOSITION_DENY");
    }
  }

  const allowed = reasons.length === 0;
  const metadataVisible =
    allowed &&
    (READ_OPERATIONS.has(operation) || operation === "metadata_write");
  const contentVisible =
    allowed &&
    CONTENT_OPERATIONS.has(operation) &&
    connector.connectorMode !== "Metadata-Only Restricted Reference";
  const downloadable =
    allowed && operation === "download" && downloadAllowed(handlingClass);

  return frozen({
    connectorId: connector.connectorId,
    stableObjectId: item?.stableObjectId ?? null,
    actorId: actor.actorId,
    operation,
    effectiveHandlingClass: handlingClass,
    allowed,
    metadataVisible,
    contentVisible,
    downloadable,
    concealAsNotFound: !allowed,
    reasonCodes: frozen(reasons),
    architectureOperationAllowed,
    liveExecutionAvailable: false,
    evaluatedAt,
    synthetic: true,
  });
}
