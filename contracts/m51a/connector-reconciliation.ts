import type { M51aConnectorOperation } from "./microsoft-connectors";
import type { M51aMicrosoftItemSnapshot } from "./stable-object-mapping";

export type M51aConnectorFailureDisposition =
  | "retry"
  | "fail"
  | "conflict"
  | "resync_required";

export interface M51aConnectorFailureClassification {
  disposition: M51aConnectorFailureDisposition;
  code: string;
  delayMs: number | null;
  status: number | null;
  retryAfterHonored: boolean;
}

export interface M51aConnectorOperationAttempt {
  attempt: number;
  startedAt: string;
  completedAt: string;
  outcome: "succeeded" | "retry_scheduled" | "failed" | "conflict" | "resync_required";
  errorCode: string | null;
  status: number | null;
  scheduledDelayMs: number | null;
}

export interface M51aIdempotentOperationRequest {
  idempotencyKey: string;
  requestFingerprint: string;
  connectorId: string;
  operation: M51aConnectorOperation;
  requestedAt: string;
}

export interface M51aIdempotentOperationResult<T = unknown> {
  operationId: string;
  idempotencyKey: string;
  requestFingerprint: string;
  connectorId: string;
  operation: M51aConnectorOperation;
  status: "succeeded" | "failed" | "conflict" | "resync_required";
  attempts: readonly M51aConnectorOperationAttempt[];
  value: T | null;
  errorCode: string | null;
  replayed: boolean;
  liveGraphCalls: 0;
  liveWrites: 0;
  completedAt: string;
  synthetic: true;
}

export interface M51aDeltaPage {
  connectorId: string;
  cursor: string | null;
  changes: readonly M51aMicrosoftItemSnapshot[];
  deletedAddresses: readonly string[];
  nextCursor: string | null;
  deltaLink: string | null;
  synthetic: true;
}

export interface M51aConnectorCheckpoint {
  connectorId: string;
  checkpoint: string;
  checkpointKind: "delta_link" | "full_resync";
  reconciledAt: string;
  reconciliationReportId: string;
  itemCount: number;
  liveCheckpointWrite: false;
  synthetic: true;
}

export const M51A_RECONCILIATION_DIMENSIONS = [
  "item_count",
  "stable_object_id",
  "content_hash",
  "version_identity",
  "metadata",
  "permissions",
  "locator",
  "sensitivity_retention",
] as const;
export type M51aReconciliationDimension =
  (typeof M51A_RECONCILIATION_DIMENSIONS)[number];

export interface M51aReconciliationDifference {
  differenceId: string;
  stableObjectId: string | null;
  dimension: M51aReconciliationDimension;
  sourceValue: string;
  targetValue: string;
  explained: boolean;
  explanation: string | null;
  severity: "P0" | "P1" | "P2";
}

export interface M51aReconciliationReport {
  reportId: string;
  connectorId: string;
  sourceCount: number;
  targetCount: number;
  dimensionsChecked: readonly M51aReconciliationDimension[];
  differences: readonly M51aReconciliationDifference[];
  unexplainedDifferenceCount: number;
  p0DifferenceCount: number;
  p1DifferenceCount: number;
  passed: boolean;
  evaluatedAt: string;
  sourceUnchanged: true;
  liveRepositoryWrite: false;
  synthetic: true;
}
