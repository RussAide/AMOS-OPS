import type { M51aHandlingClassCode } from "./operations-hub";
import type { M51aMicrosoftPermissionSet } from "./microsoft-connectors";

export interface M51aMicrosoftItemAddress {
  tenantId: string;
  siteId: string;
  driveId: string;
  itemId: string;
  listId: string | null;
  listItemId: string | null;
}

export interface M51aItemRetentionState {
  policyId: string;
  retentionUntil: string | null;
  legalHoldIds: readonly string[];
  recordLocked: boolean;
  dispositionAllowed: boolean;
  liveRetentionMutationAvailable: false;
}

export interface M51aMicrosoftItemSnapshot {
  connectorId: string;
  stableObjectId: string;
  address: M51aMicrosoftItemAddress;
  name: string;
  path: string;
  parentItemId: string;
  webUrl: string;
  eTag: string;
  cTag: string | null;
  versionId: string;
  contentHash: string;
  metadataHash: string;
  lastModifiedAt: string;
  handlingClass: M51aHandlingClassCode;
  sensitivityLabelRef: string;
  permissions: M51aMicrosoftPermissionSet;
  retention: M51aItemRetentionState;
  deleted: boolean;
  searchVisible: boolean;
  synthetic: true;
}

export type M51aStableBindingReason =
  | "initial_bind"
  | "metadata_refresh"
  | "rename"
  | "move_within_drive"
  | "cross_drive_rebind"
  | "tombstone";

export interface M51aStableBindingEvent {
  bindingId: string;
  bindingVersion: number;
  stableObjectId: string;
  connectorId: string;
  address: M51aMicrosoftItemAddress;
  name: string;
  path: string;
  parentItemId: string;
  eTag: string;
  cTag: string | null;
  versionId: string;
  contentHash: string;
  metadataHash: string;
  observedAt: string;
  effectiveAt: string;
  supersededAt: string | null;
  reason: M51aStableBindingReason;
  active: boolean;
  deleted: boolean;
  synthetic: true;
}

export interface M51aStableObjectMapping {
  stableObjectId: string;
  connectorId: string;
  currentBindingId: string | null;
  status: "active" | "tombstoned" | "quarantined";
  sourceOfTruth: "AMOS-DMS";
  bindingHistory: readonly M51aStableBindingEvent[];
  createdAt: string;
  updatedAt: string;
  liveMicrosoftMutationAvailable: false;
  appendOnlyHistory: true;
  synthetic: true;
}

export interface M51aStableMappingValidationIssue {
  stableObjectId: string;
  code: string;
  message: string;
}
