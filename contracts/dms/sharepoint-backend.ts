export const SHAREPOINT_BACKEND_BINDING_STATES = [
  "ACTIVE",
  "RETIRED",
  "QUARANTINED",
  "TOMBSTONED",
] as const;

export type SharePointBackendBindingState =
  (typeof SHAREPOINT_BACKEND_BINDING_STATES)[number];

export interface SharePointBackendObjectAddress {
  tenantHost: string;
  siteId: string;
  driveId: string;
  itemId: string;
}

export interface SharePointBackendBindingCandidate {
  id: string;
  authorityId: string;
  documentId: string;
  recordKey: string;
  stableObjectId: string;
  bindingState: SharePointBackendBindingState;
  address: SharePointBackendObjectAddress;
  name: string;
  webUrl: string;
  parentItemId: string | null;
  relativePath: string | null;
  versionId: string | null;
  eTag: string | null;
  cTag: string | null;
  sizeBytes: number | null;
  contentHash: string | null;
  metadataHash: string;
  verificationMethod: "MICROSOFT_GRAPH" | "CONNECTOR_ATTESTATION";
  verifiedAt: string;
  verifiedBy: string;
  supersedesBindingId: string | null;
  dataScope: "training" | "operational";
}

export type SharePointBackendResolution =
  | {
      outcome: "RESOLVED";
      code: "SHAREPOINT_BACKEND_RESOLVED";
      binding: SharePointBackendBindingCandidate;
      candidateIds: string[];
    }
  | {
      outcome: "CONFLICT";
      code: "SHAREPOINT_BACKEND_CONFLICT";
      binding: null;
      candidateIds: string[];
    }
  | {
      outcome: "UNAVAILABLE";
      code: "NO_SHAREPOINT_BACKEND_BINDING";
      binding: null;
      candidateIds: string[];
    };

/**
 * Resolve the effective immutable SharePoint binding for one authority row.
 * A later immutable binding can explicitly retire an earlier binding by
 * referencing it through supersedesBindingId. Only one effective ACTIVE row
 * may remain. Conflicts fail closed.
 */
export function resolveSharePointBackendBinding(
  authorityId: string,
  candidates: readonly SharePointBackendBindingCandidate[],
): SharePointBackendResolution {
  const lineage = candidates.filter(
    (candidate) => candidate.authorityId === authorityId,
  );
  const retired = new Set(
    lineage
      .map((candidate) => candidate.supersedesBindingId)
      .filter((value): value is string => Boolean(value)),
  );
  const effective = lineage.filter((candidate) => !retired.has(candidate.id));
  const active = effective.filter(
    (candidate) => candidate.bindingState === "ACTIVE",
  );
  const candidateIds = effective.map((candidate) => candidate.id);

  if (active.length === 1) {
    return {
      outcome: "RESOLVED",
      code: "SHAREPOINT_BACKEND_RESOLVED",
      binding: active[0],
      candidateIds,
    };
  }
  if (active.length > 1) {
    return {
      outcome: "CONFLICT",
      code: "SHAREPOINT_BACKEND_CONFLICT",
      binding: null,
      candidateIds,
    };
  }
  return {
    outcome: "UNAVAILABLE",
    code: "NO_SHAREPOINT_BACKEND_BINDING",
    binding: null,
    candidateIds,
  };
}

export function stableSharePointObjectId(documentId: string): string {
  return `AMOS-DMS:${documentId}`;
}
