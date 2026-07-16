import type {
  M51aConnectorAccessDecision,
  M51aConnectorActorContext,
  M51aConnectorRegistryEntry,
} from "../m51a/microsoft-connectors";
import type {
  M51aDocumentLifecycle,
  M51aHandlingClassCode,
  M51aIntranetDestinationCode,
  M51aIntranetRouteDecision,
  M51aPublishingDecision,
} from "../m51a/operations-hub";
import type { M51aConnectorCheckpoint, M51aReconciliationReport } from "../m51a/connector-reconciliation";
import type {
  M51aMicrosoftItemSnapshot,
  M51aStableBindingEvent,
  M51aStableObjectMapping,
} from "../m51a/stable-object-mapping";
import type { UserRole } from "../../src/constants/roles";
import type { M51BAuditEvent, M51BDemoBoundary } from "./shared";
import type {
  M51BDeadLetterRecord,
  M51BOperationalAlert,
  M51BReconciliationResult,
  M51BReliabilityResult,
  M51BReliabilitySnapshot,
  M51BReplayAuthorization,
} from "./reliability";

export const M51B_SHAREPOINT_WORKFLOW_ID =
  "SYNTH-M51B-SHAREPOINT-APPROVED-CONTENT-SYNC" as const;
export const M51B_SHAREPOINT_CONNECTOR_ID =
  "SYNTH-M51B-CONNECTOR-SHAREPOINT-PUBLISHED" as const;
export const M51B_SHAREPOINT_STABLE_OBJECT_ID =
  "SYNTH-AMOS-DMS-OBJECT-M51B-SHAREPOINT-001" as const;
export const M51B_SHAREPOINT_EVALUATED_AT =
  "2026-07-15T12:00:00.000Z" as const;
export const M51B_SHAREPOINT_COMPLETED_AT =
  "2026-07-15T12:02:25.000Z" as const;
export const M51B_SHAREPOINT_MAX_ELAPSED_SECONDS = 300 as const;

export interface M51BSharePointWorkflowRequest {
  workflowId: typeof M51B_SHAREPOINT_WORKFLOW_ID;
  correlationId: string;
  idempotencyKey: string;
  connectorId: string;
  stableObjectId: string;
  actorRole: UserRole;
  operation: "content_write";
  expectedETag: string;
  contentHash: string;
  handlingClass: M51aHandlingClassCode;
  sensitivityLabelRef: string;
  retentionPolicyId: string;
  lifecycleState: M51aDocumentLifecycle;
  approvalState: "pending" | "approved" | "rejected";
  sourceOfTruth: "AMOS-DMS";
  routeCode: M51aIntranetDestinationCode;
  requestedAt: string;
  targetCompletionAt: string;
  synthetic: true;
}

export const M51B_SHAREPOINT_GATE_CODES = [
  "registry",
  "connector_mode",
  "stable_identity",
  "permission",
  "classification",
  "retention",
  "lifecycle",
  "source_of_truth",
  "intranet_route",
  "approval",
  "synthetic_boundary",
] as const;
export type M51BSharePointGateCode =
  (typeof M51B_SHAREPOINT_GATE_CODES)[number];

export interface M51BSharePointGateDecision {
  decisionId: string;
  allowed: boolean;
  gates: Readonly<Record<M51BSharePointGateCode, boolean>>;
  reasonCodes: readonly string[];
  accessDecision: M51aConnectorAccessDecision;
  publishingDecision: M51aPublishingDecision;
  routeDecision: M51aIntranetRouteDecision;
  stableBindingId: string | null;
  liveExecutionAvailable: false;
  synthetic: true;
}

export interface M51BSharePointOperationSummary {
  operationId: string;
  status: "succeeded" | "failed" | "conflict" | "resync_required";
  attempts: number;
  retriesScheduled: number;
  replayed: boolean;
  errorCode: string | null;
  completedAt: string;
  liveGraphCalls: 0;
  liveWrites: 0;
  synthetic: true;
}

export interface M51BSharePointAdapterMetrics {
  syntheticReads: number;
  syntheticMutations: number;
  blockedLiveOperations: number;
  liveGraphCalls: 0;
  liveWrites: 0;
  credentialReads: 0;
}

export interface M51BSharePointScenarioFixtures {
  connector: M51aConnectorRegistryEntry;
  actor: M51aConnectorActorContext;
  request: M51BSharePointWorkflowRequest;
  initialTarget: M51aMicrosoftItemSnapshot;
  desiredSource: M51aMicrosoftItemSnapshot;
}

/**
 * Evidence produced by the real synthetic SharePoint channel path when a
 * persistent connector outage exhausts retry, enters the dead-letter queue,
 * and is recovered through an authorized replay. The recovery callback uses
 * the same governed SharePoint adapter mutation as the approved sync path.
 */
export interface M51BSharePointExhaustedFailureRecovery {
  originalFailure: Readonly<
    M51BReliabilityResult<M51aMicrosoftItemSnapshot>
  >;
  openedDeadLetter: Readonly<M51BDeadLetterRecord>;
  operationalAlert: Readonly<M51BOperationalAlert>;
  authorization: Readonly<M51BReplayAuthorization>;
  recoveryGateDecision: M51BSharePointGateDecision;
  recovery: Readonly<M51BReliabilityResult<M51aMicrosoftItemSnapshot>>;
  recoveredDeadLetter: Readonly<M51BDeadLetterRecord>;
  duplicateReplay: Readonly<
    M51BReliabilityResult<M51aMicrosoftItemSnapshot>
  >;
  channelReconciliation: Readonly<M51BReconciliationResult>;
  contentReconciliation: M51aReconciliationReport;
  reliabilitySnapshot: Readonly<M51BReliabilitySnapshot>;
  mutationsBeforeRecovery: number;
  mutationsAfterRecovery: number;
  mutationsAfterDuplicateReplay: number;
  duplicateMutationPrevented: boolean;
  auditEvents: readonly M51BAuditEvent[];
  accepted: boolean;
  liveGraphCalls: 0;
  liveWrites: 0;
  synthetic: true;
}

export interface M51BSharePointSyncResult {
  workflowId: typeof M51B_SHAREPOINT_WORKFLOW_ID;
  correlationId: string;
  connectorId: string;
  stableObjectId: string;
  startedAt: string;
  completedAt: string;
  elapsedSeconds: number;
  maximumElapsedSeconds: typeof M51B_SHAREPOINT_MAX_ELAPSED_SECONDS;
  withinElapsedLimit: boolean;
  gateDecision: M51BSharePointGateDecision;
  initialTarget: M51aMicrosoftItemSnapshot;
  desiredSource: M51aMicrosoftItemSnapshot;
  finalTarget: M51aMicrosoftItemSnapshot;
  stableMapping: M51aStableObjectMapping;
  resolvedBinding: M51aStableBindingEvent;
  staleVersionConflict: M51BSharePointOperationSummary;
  delivery: M51BSharePointOperationSummary;
  replay: M51BSharePointOperationSummary;
  exhaustedFailureRecovery: M51BSharePointExhaustedFailureRecovery;
  reconciliation: M51aReconciliationReport;
  checkpoint: M51aConnectorCheckpoint;
  auditEvents: readonly M51BAuditEvent[];
  adapterMetrics: M51BSharePointAdapterMetrics;
  boundary: M51BDemoBoundary;
  accepted: boolean;
  productionRows: 0;
  liveGraphCalls: 0;
  liveMicrosoftReads: 0;
  liveMicrosoftWrites: 0;
  liveWrites: 0;
  realDataUsed: false;
  realFileContentRead: false;
  synthetic: true;
}
