import type { M51AActorContext } from "@contracts/m51a/shared";
import { createM51ADemoBoundary } from "@contracts/m51a/shared";
import { M51A_CONNECTOR_MODES } from "@contracts/m51a/microsoft-connectors";
import { runM51aHubArchitectureScenario } from "./operations-hub/architecture-scenario";
import { M51aConnectorRegistry } from "./connectors/connector-registry";
import { M51aStableObjectResolver } from "./connectors/stable-object-resolver";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "./connectors/synthetic-repository-fixtures";
import { runM51aNonSensitivePilot } from "./pilot/pilot-migration";
import { runM51aSecurityEvaluation } from "./pilot/security-evaluation";

function immutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

/**
 * Builds the role-aware demo experience without reading from or writing to a
 * Microsoft tenant. This is intentionally a projection of executable M5.1A
 * controls, not a second source of business truth.
 */
export function createM51AExperienceSnapshot(actor: M51AActorContext) {
  const hub = runM51aHubArchitectureScenario();
  const registry = new M51aConnectorRegistry(
    createSyntheticM51aConnectorRegistryEntries(),
  );
  const items = createSyntheticM51aMicrosoftItems(registry.list());
  const stableObjects = new M51aStableObjectResolver();
  for (const item of items) stableObjects.bind(item);
  const pilot = runM51aNonSensitivePilot();
  const security = runM51aSecurityEvaluation();
  const roleProjection = hub.roleProjections.find(
    (candidate) => candidate.role === actor.role,
  );
  if (!roleProjection) throw new Error("M51A_ROLE_ROUTE_PROJECTION_REQUIRED");

  const canViewRegistry = actor.permissions.includes("m51a:registry:read");
  const citations = hub.publishingDecisions
    .map((decision) => decision.citation)
    .filter((citation) => citation !== null);
  const modeCounts = M51A_CONNECTOR_MODES.map((mode) =>
    immutable({ mode, count: registry.listByMode(mode).length }),
  );

  return immutable({
    milestone: "M5.1A" as const,
    title: "Operations Hub and Microsoft DMS Connector Architecture",
    evaluatedAt: hub.executedAt,
    viewer: immutable({
      role: actor.role,
      tier: actor.tier,
      divisionIds: actor.divisionIds,
      canReviewArchitecture: actor.permissions.includes("m51a:pilot:review"),
      canExecutePilot: actor.permissions.includes("m51a:pilot:execute"),
      canViewRegistry,
    }),
    hub: immutable({
      architectureId: hub.architecture.architectureId,
      governingSystem: hub.architecture.governingSystem,
      collaborationLayer: hub.architecture.collaborationLayer,
      totals: hub.totals,
      criteria: hub.criteria,
      sites: hub.architecture.sites,
      libraries: hub.architecture.libraries,
      contentTypes: hub.architecture.contentTypes,
      metadataDefinitions: hub.architecture.metadataDefinitions,
      handlingClasses: hub.architecture.handlingClasses,
      routes: roleProjection.routes,
      deniedRouteCount: roleProjection.deniedRouteCodes.length,
      citations: immutable(citations),
    }),
    connectors: immutable({
      inventory: registry.inventoryCompleteness(),
      modeCounts: immutable(modeCounts),
      repositories: canViewRegistry ? registry.list() : immutable([]),
      repositoryDetailsTrimmed: !canViewRegistry,
      stableObjectCount: stableObjects.list().length,
      stableMappingIssueCount: stableObjects.validate().length,
      syntheticItemCount: items.length,
    }),
    pilot: immutable({
      scenarioId: pilot.scenarioId,
      accepted: pilot.accepted,
      categories: immutable(
        Object.entries(pilot.reconciliation.categoryCounts).map(
          ([category, count]) => immutable({ category, count }),
        ),
      ),
      sourceItemCount: pilot.sourceItems.length,
      targetItemCount: pilot.targetItems.length,
      attemptCount: pilot.attempts.length,
      duplicateWritesPrevented: pilot.attempts.reduce(
        (total, attempt) => total + attempt.duplicateWritesPrevented,
        0,
      ),
      reconciliation: pilot.reconciliation,
      rollback: pilot.rollback,
    }),
    security: immutable({
      accepted: security.accepted,
      rolesEvaluated: security.rolesEvaluated,
      tiersEvaluated: security.tiersEvaluated,
      divisionsEvaluated: security.divisionsEvaluated,
      decisionCount: security.decisionCount,
      metadataOnlyViolations: security.metadataOnlyViolations,
      excludedModeViolations: security.excludedModeViolations,
      staleSuppressionViolations: security.staleSuppressionViolations,
      unauthorizedAiRetrievalViolations:
        security.unauthorizedAiRetrievalViolations,
      liveWriteViolations: security.liveWriteViolations,
      permissionLeakViolations: security.permissionLeakViolations,
      dlpDecisionViolations: security.dlpDecisionViolations,
    }),
    boundary: createM51ADemoBoundary(),
    synthetic: true as const,
  });
}
