import type {
  M51aAuthoritativeStatus,
  M51aConnectorMode,
  M51aRepositoryClassification,
  M51aRepositoryDisposition,
} from "./microsoft-connectors";
import type { M51aHandlingClassCode } from "./operations-hub";

export interface M51aRepositoryInventoryRecord {
  inventoryId: string;
  connectorId: string;
  displayName: string;
  ownerActorId: string;
  accountableTeam: string;
  classification: M51aRepositoryClassification;
  handlingClass: M51aHandlingClassCode;
  recordClasses: readonly string[];
  authoritativeStatus: M51aAuthoritativeStatus;
  authorityCandidateAnalyzed: true;
  connectorMode: M51aConnectorMode;
  connectorEligible: boolean;
  disposition: M51aRepositoryDisposition;
  targetOrExclusionRationale: string;
  permissionSnapshotId: string;
  permissionReviewComplete: true;
  externalSharingAllowed: false;
  anonymousLinksAllowed: false;
  duplicateAnalysis: "unique_repository_address";
  versionAnalysis: "item_versions_inventoried" | "no_business_items_expected";
  activityAnalyzed: true;
  lastSyntheticActivityAt: string | null;
  brokenLinkCount: number;
  syntheticItemCount: number;
  sourcePreserved: true;
  liveRepositoryRead: false;
  synthetic: true;
}

export interface M51aItemDispositionRecord {
  inventoryItemId: string;
  connectorId: string;
  stableObjectId: string;
  name: string;
  ownerActorId: string;
  classification: M51aRepositoryClassification;
  handlingClass: M51aHandlingClassCode;
  authoritativeStatus: M51aAuthoritativeStatus;
  authorityCandidateAnalyzed: true;
  versionId: string;
  contentHash: string;
  metadataHash: string;
  permissionSnapshotId: string;
  activityAnalyzed: true;
  lastModifiedAt: string;
  connectorEligible: boolean;
  disposition: M51aRepositoryDisposition;
  targetOrExclusionRationale: string;
  duplicateOfStableObjectId: null;
  duplicateAnalysisComplete: true;
  brokenLink: false;
  linkAnalysisComplete: true;
  sourcePreserved: true;
  liveItemRead: false;
  synthetic: true;
}

export interface M51aInventoryDispositionResult {
  inventoryId: "SYNTH-M51A-INVENTORY-DISPOSITION-V1";
  repositories: readonly M51aRepositoryInventoryRecord[];
  items: readonly M51aItemDispositionRecord[];
  validationErrors: readonly string[];
  totals: {
    repositories: number;
    items: number;
    restrictedRepositories: number;
    systemManagedExcluded: number;
    oneDriveWorkbenches: number;
    duplicateItems: 0;
    brokenLinks: 0;
    liveRepositoryReads: 0;
    liveItemReads: 0;
  };
  accepted: boolean;
  sourcePreserved: true;
  realDataUsed: false;
  synthetic: true;
}
