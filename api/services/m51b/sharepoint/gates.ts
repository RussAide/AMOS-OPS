import { createHash } from "node:crypto";
import type {
  M51aConnectorActorContext,
  M51aConnectorRegistryEntry,
} from "@contracts/m51a/microsoft-connectors";
import type { M51aIntranetPublishingCandidate } from "@contracts/m51a/operations-hub";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import {
  M51B_SHAREPOINT_GATE_CODES,
  type M51BSharePointGateCode,
  type M51BSharePointGateDecision,
  type M51BSharePointWorkflowRequest,
} from "@contracts/m51b/sharepoint";
import { evaluateM51aConnectorAccess } from "../../m51a/connectors/connector-policy";
import { validateM51aConnectorRegistry } from "../../m51a/connectors/connector-registry";
import { M51aStableObjectResolver } from "../../m51a/connectors/stable-object-resolver";
import {
  createSyntheticM51aIntranetMap,
  resolveM51aIntranetRoute,
} from "../../m51a/operations-hub/intranet-map";
import {
  createSyntheticM51aPublishingCandidates,
  evaluateM51aAuthoritativePublishing,
} from "../../m51a/operations-hub/publishing";
import { createSyntheticM51aHubTopology } from "../../m51a/operations-hub/topology";

function frozen<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function deterministicId(...parts: readonly string[]): string {
  const hash = createHash("sha256")
    .update(parts.join("|"))
    .digest("hex")
    .slice(0, 20)
    .toUpperCase();
  return `SYNTH-M51B-SP-GATE-${hash}`;
}

function publishingCandidate(
  request: M51BSharePointWorkflowRequest,
): M51aIntranetPublishingCandidate {
  const base = createSyntheticM51aPublishingCandidates().find(
    (candidate) =>
      candidate.contentTypeCode === "intranet-knowledge-article" &&
      candidate.lifecycleState === "Published" &&
      candidate.approvalState === "approved",
  );
  if (!base) throw new Error("M51B_PUBLISHING_CANDIDATE_TEMPLATE_REQUIRED");
  return frozen({
    ...base,
    objectId: request.stableObjectId,
    title: "M5.1B Synthetic Operations Hub Staff Guide",
    handlingClass: request.handlingClass,
    lifecycleState: request.lifecycleState,
    approvalState: request.approvalState,
    sourceOfTruthUri: `amos-dms://synthetic/${request.stableObjectId}`,
    contentHash: request.contentHash,
    metadata: frozen({
      ...base.metadata,
      amos_object_id: request.stableObjectId,
      sensitivity: request.handlingClass,
      lifecycle_status: request.lifecycleState,
      connector_state: "m51b-approved-sharepoint-sync",
    }),
  });
}

export interface M51BSharePointGateInput {
  request: M51BSharePointWorkflowRequest;
  connector: M51aConnectorRegistryEntry;
  actor: M51aConnectorActorContext;
  item: M51aMicrosoftItemSnapshot;
  resolver: M51aStableObjectResolver;
}

export function evaluateM51bSharePointGates(
  input: M51BSharePointGateInput,
): M51BSharePointGateDecision {
  const { request, connector, actor, item, resolver } = input;
  const registryIssues = validateM51aConnectorRegistry([connector], false);
  const accessDecision = evaluateM51aConnectorAccess(
    connector,
    actor,
    request.operation,
    item,
    request.requestedAt,
  );
  const candidate = publishingCandidate(request);
  const publishingDecision = evaluateM51aAuthoritativePublishing(
    candidate,
    undefined,
    undefined,
    request.requestedAt,
  );
  const routeDecision = resolveM51aIntranetRoute(
    actor.role,
    request.routeCode,
    createSyntheticM51aIntranetMap(),
    createSyntheticM51aHubTopology(),
  );

  let stableBindingId: string | null = null;
  let stableIdentity = false;
  try {
    const binding = resolver.resolve(request.stableObjectId);
    stableBindingId = binding.bindingId;
    stableIdentity =
      binding.stableObjectId === item.stableObjectId &&
      binding.connectorId === connector.connectorId &&
      binding.address.itemId === item.address.itemId &&
      request.stableObjectId === item.stableObjectId;
  } catch {
    stableIdentity = false;
  }

  const gates: Readonly<Record<M51BSharePointGateCode, boolean>> = frozen({
    registry:
      registryIssues.length === 0 &&
      request.connectorId === connector.connectorId &&
      connector.status === "active",
    connector_mode:
      connector.connectorMode === "Governed Full Integration" &&
      connector.allowedOperations.includes(request.operation),
    stable_identity: stableIdentity,
    permission: accessDecision.allowed,
    classification:
      request.handlingClass === connector.handlingClass &&
      request.handlingClass === item.handlingClass &&
      request.sensitivityLabelRef === connector.sensitivityLabelRef &&
      request.sensitivityLabelRef === item.sensitivityLabelRef &&
      !connector.permissionModel.externalSharingAllowed &&
      !connector.permissionModel.anonymousLinksAllowed,
    retention:
      request.retentionPolicyId === connector.retentionPolicy.policyId &&
      request.retentionPolicyId === item.retention.policyId &&
      !item.retention.recordLocked &&
      item.retention.legalHoldIds.length === 0,
    lifecycle:
      request.lifecycleState === "Published" &&
      publishingDecision.authoritativeGuidanceEligible,
    source_of_truth:
      request.sourceOfTruth === "AMOS-DMS" &&
      connector.authoritativeStatus === "amos_dms_source_of_record" &&
      candidate.sourceSystem === "AMOS-DMS" &&
      candidate.sourceOfTruthUri.startsWith("amos-dms://synthetic/"),
    intranet_route:
      connector.intranetRoute.destination === request.routeCode &&
      connector.intranetRoute.visibility === "general_permission_trimmed" &&
      routeDecision.allowed &&
      routeDecision.permissionTrimmed &&
      routeDecision.physicalMicrosoftUrl === null,
    approval:
      request.approvalState === "approved" &&
      request.actorRole === actor.role &&
      Boolean(candidate.approverId && candidate.approverRole),
    synthetic_boundary:
      request.synthetic &&
      connector.synthetic &&
      actor.synthetic &&
      item.synthetic &&
      !connector.liveTenantConnected &&
      !connector.liveReadsAvailable &&
      !connector.liveWritesAvailable,
  });
  const reasonCodes = M51B_SHAREPOINT_GATE_CODES
    .filter((gate) => !gates[gate])
    .map((gate) => `M51B_SHAREPOINT_${gate.toUpperCase()}_DENY`);
  return frozen({
    decisionId: deterministicId(
      request.workflowId,
      request.correlationId,
      request.stableObjectId,
      request.requestedAt,
    ),
    allowed: reasonCodes.length === 0,
    gates,
    reasonCodes: frozen(
      reasonCodes.length === 0
        ? ["M51B_SHAREPOINT_APPROVED_SYNC_ALLOWED"]
        : reasonCodes,
    ),
    accessDecision,
    publishingDecision,
    routeDecision,
    stableBindingId,
    liveExecutionAvailable: false,
    synthetic: true,
  });
}
