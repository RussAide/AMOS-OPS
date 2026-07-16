import {
  M51A_SECURITY_ACTIONS,
  type M51aSecurityAction,
  type M51aSecurityActor,
  type M51aSecurityDecision,
  type M51aSecurityEvaluationResult,
  type M51aSecurityResource,
  type M51aSecuritySearchProjection,
} from "@contracts/m51a/pilot";
import {
  M51A_CONNECTOR_MODE_OPERATION_MATRIX,
  type M51aConnectorOperation,
} from "@contracts/m51a/microsoft-connectors";
import {
  M51A_EVALUATION_AS_OF,
  M51A_EVIDENCE_CLASS,
  createM51ADemoBoundary,
  type M51AAuditEvent,
} from "@contracts/m51a/shared";
import type { RoleTier } from "@/constants/access-control";
import type { DivisionId } from "@/constants/organization";
import { buildAllM51AActorContexts } from "../role-context";

function immutable<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      immutable(child);
    Object.freeze(value);
  }
  return value;
}

const RESOURCES: readonly M51aSecurityResource[] = immutable([
  {
    resourceId: "SYNTH-M51A-RESOURCE-ENTERPRISE-GENERAL",
    label: "Published enterprise operating guidance",
    divisionId: "enterprise",
    handlingClass: "internal-general",
    connectorMode: "Governed Full Integration",
    lifecycleState: "Published",
    stale: false,
    synthetic: true,
  },
  {
    resourceId: "SYNTH-M51A-RESOURCE-GRO-CONTROLLED",
    label: "GRO controlled operations reference",
    divisionId: "gro",
    handlingClass: "internal-controlled",
    connectorMode: "Permission-Trimmed Reference",
    lifecycleState: "Published",
    stale: false,
    synthetic: true,
  },
  {
    resourceId: "SYNTH-M51A-RESOURCE-BHC-RESTRICTED",
    label: "BHC restricted clinical metadata reference",
    divisionId: "bhc",
    handlingClass: "restricted-clinical",
    connectorMode: "Metadata-Only Restricted Reference",
    lifecycleState: "Published",
    stale: false,
    synthetic: true,
  },
  {
    resourceId: "SYNTH-M51A-RESOURCE-PART2-METADATA-ONLY",
    label: "Synthetic Part 2 repository metadata",
    divisionId: "bhc",
    handlingClass: "restricted-sud-part2",
    connectorMode: "Metadata-Only Restricted Reference",
    lifecycleState: "Retained",
    stale: false,
    synthetic: true,
  },
  {
    resourceId: "SYNTH-M51A-RESOURCE-HR365-EXCLUDED",
    label: "Synthetic HR365 system-managed repository",
    divisionId: "eo",
    handlingClass: "restricted-workforce-financial",
    connectorMode: "Excluded/System-Managed",
    lifecycleState: "Retained",
    stale: false,
    synthetic: true,
  },
  {
    resourceId: "SYNTH-M51A-RESOURCE-WITHDRAWN-GUIDANCE",
    label: "Withdrawn enterprise guidance",
    divisionId: "enterprise",
    handlingClass: "internal-general",
    connectorMode: "Governed Full Integration",
    lifecycleState: "Withdrawn",
    stale: true,
    synthetic: true,
  },
]);

function actorContexts(): readonly M51aSecurityActor[] {
  return immutable(
    buildAllM51AActorContexts().map((actor) => ({
      actorId: actor.actorId,
      role: actor.role,
      tier: actor.tier,
      divisionId: actor.divisionIds[0]!,
      permissions: actor.permissions,
      synthetic: true,
    })),
  );
}

function scopeAuthorized(
  actor: M51aSecurityActor,
  resource: M51aSecurityResource,
): boolean {
  return (
    resource.divisionId === "enterprise" ||
    actor.tier === "T1" ||
    actor.divisionId === resource.divisionId
  );
}

function handlingAuthorized(
  actor: M51aSecurityActor,
  resource: M51aSecurityResource,
): boolean {
  if (resource.handlingClass === "internal-general") return true;
  if (resource.handlingClass === "internal-controlled") return actor.tier !== "T4";
  if (resource.handlingClass === "confidential")
    return actor.tier === "T1" || actor.tier === "T2";
  if (resource.handlingClass === "restricted-clinical")
    return (
      actor.permissions.includes("m51a:restricted:metadata") &&
      actor.tier !== "T4"
    );
  if (resource.handlingClass === "restricted-sud-part2")
    return actor.permissions.includes("m51a:part2:metadata");
  return actor.permissions.includes("m51a:workforce-finance:metadata");
}

function actionAllowedByMode(
  resource: M51aSecurityResource,
  action: M51aSecurityAction,
): boolean {
  const operationByAction: Readonly<
    Record<M51aSecurityAction, M51aConnectorOperation>
  > = {
    search: "search_index",
    metadata_read: "metadata_read",
    content_read: "content_read",
    write: "content_write",
    ai_retrieve: "content_read",
  };
  return M51A_CONNECTOR_MODE_OPERATION_MATRIX[
    resource.connectorMode
  ].includes(operationByAction[action]);
}

function decisionReasonCodes(input: {
  scope: boolean;
  handling: boolean;
  mode: boolean;
  current: boolean;
  write: boolean;
}): readonly string[] {
  const codes: string[] = [];
  if (!input.scope) codes.push("M51A_SCOPE_NOT_AUTHORIZED");
  if (!input.handling) codes.push("M51A_HANDLING_NOT_AUTHORIZED");
  if (!input.mode) codes.push("M51A_CONNECTOR_MODE_BLOCKED");
  if (!input.current) codes.push("M51A_STALE_OR_WITHDRAWN_SUPPRESSED");
  if (input.write) codes.push("M51A_LIVE_WRITE_UNAVAILABLE");
  if (codes.length === 0) codes.push("M51A_PERMISSION_TRIMMED_ALLOW");
  return immutable(codes);
}

export function evaluateM51aSecurityAction(
  actor: M51aSecurityActor,
  resource: M51aSecurityResource,
  action: M51aSecurityAction,
  sequence = 1,
): M51aSecurityDecision {
  const scope = scopeAuthorized(actor, resource);
  const handling = handlingAuthorized(actor, resource);
  const mode = actionAllowedByMode(resource, action);
  const staleOrWithdrawn =
    resource.stale || resource.lifecycleState === "Withdrawn";
  const current =
    !staleOrWithdrawn || action === "metadata_read";
  const write = action === "write";
  const allowed = scope && handling && mode && current && !write;
  const projection = allowed
    ? resource.connectorMode === "Metadata-Only Restricted Reference"
      ? "metadata_only"
      : "full"
    : "none";
  const dlpDecision = !allowed
    ? "block"
    : projection === "metadata_only"
      ? "metadata_only"
      : "allow_controlled";
  return immutable({
    decisionId: `SYNTH-M51A-SECURITY-DECISION-${String(sequence).padStart(5, "0")}`,
    role: actor.role,
    tier: actor.tier,
    divisionId: actor.divisionId,
    action,
    requestedResourceId: resource.resourceId,
    disclosedResourceId: allowed ? resource.resourceId : null,
    allowed,
    projection,
    scopeAuthorized: scope,
    modeAuthorized: mode,
    permissionTrimmedBeforeRetrieval: true,
    staleOrWithdrawnSuppressed:
      staleOrWithdrawn && ["search", "content_read", "ai_retrieve"].includes(action),
    dlpPolicyApplied: true,
    dlpDecision,
    liveWritePerformed: false,
    reasonCodes: decisionReasonCodes({
      scope,
      handling,
      mode,
      current,
      write,
    }),
    synthetic: true,
  });
}

export function projectM51aSecuritySearch(
  actor: M51aSecurityActor,
  resources: readonly M51aSecurityResource[] = RESOURCES,
): M51aSecuritySearchProjection {
  const decisions = resources.map((resource, index) =>
    evaluateM51aSecurityAction(actor, resource, "search", index + 1),
  );
  const visibleRaw = decisions
    .filter((decision) => decision.allowed)
    .map((decision) => decision.disclosedResourceId!)
    .sort();
  const visible = [...new Set(visibleRaw)];
  const metadataOnly = [...new Set(decisions
    .filter(
      (decision) => decision.allowed && decision.projection === "metadata_only",
    )
    .map((decision) => decision.disclosedResourceId!)
    .sort())];
  const resourceById = new Map(
    resources.map((resource) => [resource.resourceId, resource] as const),
  );
  const staleOrWithdrawnResults = decisions.filter((decision) => {
    const resource = resourceById.get(decision.requestedResourceId);
    return (
      decision.allowed &&
      Boolean(resource && (resource.stale || resource.lifecycleState === "Withdrawn"))
    );
  }).length;
  const excludedResults = decisions.filter((decision) => {
    const resource = resourceById.get(decision.requestedResourceId);
    return (
      decision.allowed && resource?.connectorMode === "Excluded/System-Managed"
    );
  }).length;
  return immutable({
    role: actor.role,
    tier: actor.tier,
    divisionId: actor.divisionId,
    visibleResourceIds: immutable(visible),
    metadataOnlyResourceIds: immutable(metadataOnly),
    deniedResourceIdsDisclosed: false,
    permissionTrimmedBeforeRanking: true,
    duplicateResults: visibleRaw.length - visible.length,
    staleOrWithdrawnResults,
    excludedResults,
    synthetic: true,
  });
}

function auditEvent(
  sequence: number,
  decision: M51aSecurityDecision,
): M51AAuditEvent {
  const isWrite = decision.action === "write";
  return immutable({
    eventId: `SYNTH-M51A-SECURITY-AUDIT-${String(sequence).padStart(5, "0")}`,
    eventType: isWrite
      ? "live_write_blocked"
      : "unauthorized_retrieval_blocked",
    actorId: `SYNTH-M51A-SECURITY-${decision.role.toUpperCase()}`,
    actorRole: decision.role,
    entityType: "item",
    entityId: decision.requestedResourceId,
    correlationId: "SYNTH-M51A-SECURITY-EVALUATION-CORRELATION",
    outcome: "blocked",
    reason: decision.reasonCodes.join(";"),
    occurredAt: M51A_EVALUATION_AS_OF,
    immutable: true,
    evidenceClass: M51A_EVIDENCE_CLASS,
  });
}

export function createM51aSecurityResources(): readonly M51aSecurityResource[] {
  return RESOURCES;
}

export function runM51aSecurityEvaluation(): M51aSecurityEvaluationResult {
  const actors = actorContexts();
  const decisions: M51aSecurityDecision[] = [];
  let sequence = 1;
  for (const actor of actors)
    for (const resource of RESOURCES)
      for (const action of M51A_SECURITY_ACTIONS)
        decisions.push(
          evaluateM51aSecurityAction(actor, resource, action, sequence++),
        );
  const searchProjections = immutable(
    actors.map((actor) => projectM51aSecuritySearch(actor)),
  );
  const resourceById = new Map(
    RESOURCES.map((resource) => [resource.resourceId, resource] as const),
  );
  const metadataOnlyViolations = decisions.filter((decision) => {
    const resource = resourceById.get(decision.requestedResourceId)!;
    return (
      resource.connectorMode === "Metadata-Only Restricted Reference" &&
      decision.allowed &&
      !["search", "metadata_read"].includes(decision.action)
    );
  }).length;
  const excludedModeViolations = decisions.filter((decision) => {
    const resource = resourceById.get(decision.requestedResourceId)!;
    return resource.connectorMode === "Excluded/System-Managed" && decision.allowed;
  }).length;
  const staleSuppressionViolations = decisions.filter((decision) => {
    const resource = resourceById.get(decision.requestedResourceId)!;
    return (
      (resource.stale || resource.lifecycleState === "Withdrawn") &&
      ["search", "content_read", "ai_retrieve"].includes(decision.action) &&
      decision.allowed
    );
  }).length;
  const unauthorizedAiRetrievalViolations = decisions.filter((decision) => {
    if (decision.action !== "ai_retrieve" || !decision.allowed) return false;
    const resource = resourceById.get(decision.requestedResourceId)!;
    return (
      !decision.scopeAuthorized ||
      !decision.modeAuthorized ||
      resource.connectorMode === "Metadata-Only Restricted Reference" ||
      resource.connectorMode === "Excluded/System-Managed" ||
      resource.stale ||
      resource.lifecycleState === "Withdrawn"
    );
  }).length;
  const liveWriteViolations = decisions.filter(
    (decision) => decision.action === "write" && decision.allowed,
  ).length;
  const permissionLeakViolations = decisions.filter(
    (decision) => !decision.allowed && decision.disclosedResourceId !== null,
  ).length;
  const dlpDecisionViolations = decisions.filter(
    (decision) =>
      !decision.dlpPolicyApplied ||
      (decision.allowed &&
        decision.projection === "metadata_only" &&
        decision.dlpDecision !== "metadata_only") ||
      (decision.allowed &&
        decision.projection === "full" &&
        decision.dlpDecision !== "allow_controlled") ||
      (!decision.allowed && decision.dlpDecision !== "block"),
  ).length;
  const auditEvents = immutable(
    decisions
      .filter(
        (decision) =>
          !decision.allowed &&
          (decision.action === "ai_retrieve" || decision.action === "write"),
      )
      .map((decision, index) => auditEvent(index + 1, decision)),
  );
  const tiersEvaluated = immutable(
    [...new Set(actors.map((actor) => actor.tier))].sort() as RoleTier[],
  );
  const divisionsEvaluated = immutable(
    [...new Set(actors.map((actor) => actor.divisionId))].sort() as DivisionId[],
  );
  const accepted =
    actors.length === 36 &&
    tiersEvaluated.length === 4 &&
    divisionsEvaluated.length === 4 &&
    decisions.length === actors.length * RESOURCES.length * M51A_SECURITY_ACTIONS.length &&
    metadataOnlyViolations === 0 &&
    excludedModeViolations === 0 &&
    staleSuppressionViolations === 0 &&
    unauthorizedAiRetrievalViolations === 0 &&
    liveWriteViolations === 0 &&
    permissionLeakViolations === 0 &&
    dlpDecisionViolations === 0 &&
    searchProjections.every(
      (projection) =>
        projection.duplicateResults === 0 &&
        projection.staleOrWithdrawnResults === 0 &&
        projection.excludedResults === 0 &&
        !projection.deniedResourceIdsDisclosed,
    );
  return immutable({
    evaluationId: "SYNTH-M51A-SECURITY-EVALUATION",
    actors,
    resources: RESOURCES,
    decisions: immutable(decisions),
    searchProjections,
    rolesEvaluated: actors.length,
    tiersEvaluated,
    divisionsEvaluated,
    decisionCount: decisions.length,
    metadataOnlyViolations,
    excludedModeViolations,
    staleSuppressionViolations,
    unauthorizedAiRetrievalViolations,
    liveWriteViolations,
    permissionLeakViolations,
    dlpDecisionViolations,
    auditEvents,
    boundary: createM51ADemoBoundary(),
    accepted,
    productionRows: 0,
    liveWrites: 0,
    realDataUsed: false,
    synthetic: true,
  });
}
