import {
  M51A_CONNECTOR_OPERATIONS,
  M51A_CONNECTOR_MODE_OPERATION_MATRIX,
  type M51aConnectorActorContext,
  type M51aConnectorOperation,
  type M51aConnectorRegistryEntry,
  type M51aPurposeOfUse,
} from "@contracts/m51a/microsoft-connectors";
import type { M51aMicrosoftItemSnapshot } from "@contracts/m51a/stable-object-mapping";
import { M51A_DOCUMENT_LIFECYCLE } from "@contracts/m51a/operations-hub";
import {
  M51A_CRITERION_IDS,
  M51A_EVALUATION_AS_OF,
  M51A_MILESTONE,
  createM51ADemoBoundary,
  type M51AAcceptanceFlag,
  type M51AActorContext,
} from "@contracts/m51a/shared";
import { ROLE_TIER_BY_ROLE } from "../../../src/constants/access-control";
import { buildM51AActorContext } from "./role-context";
import { runM51aHubArchitectureScenario } from "./operations-hub/architecture-scenario";
import { M51aConnectorRegistry, validateM51aConnectorRegistry } from "./connectors/connector-registry";
import { evaluateM51aConnectorAccess } from "./connectors/connector-policy";
import { M51aReconciliationEngine, cloneM51aSnapshots } from "./connectors/reconciliation-engine";
import { M51aStableObjectResolver } from "./connectors/stable-object-resolver";
import { M51aConnectorSyncOrchestrator } from "./connectors/sync-orchestrator";
import {
  M51aSyntheticMicrosoftError,
  SyntheticM51aMicrosoftAdapter,
} from "./connectors/synthetic-microsoft-adapter";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "./connectors/synthetic-repository-fixtures";
import { createM51aInventoryDispositionRegister } from "./inventory-disposition";
import { runM51aNonSensitivePilot } from "./pilot/pilot-migration";
import { runM51aSecurityEvaluation } from "./pilot/security-evaluation";

export const M51A_INTEGRATED_SCENARIO_ID =
  "SYNTH-M51A-INTEGRATED-OPERATIONS-HUB-SCENARIO" as const;

export const M51A_EXACT_ACCEPTANCE_STATEMENT =
  "The Adolbi Care Operations Hub and associated site topology are approved and operational; all discovered Microsoft repositories have an owner, classification, sensitivity, authoritative status, disposition, connector mode, and intranet route; AMOS stable object IDs resolve to current Microsoft items; general and restricted search is correctly permission-trimmed; pilot migration reconciles without data or version loss; and no sensitive or system-managed repository is broadly indexed, moved, or written outside its approved gate." as const;

function immutable<T>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function flag(
  criterionId: M51AAcceptanceFlag["criterionId"],
  passed: boolean,
  assertionCount: number,
  summary: string,
  evidenceIds: readonly string[],
): M51AAcceptanceFlag {
  return immutable({
    criterionId,
    passed,
    assertionCount,
    summary,
    evidenceIds: immutable([...evidenceIds]),
  });
}

function purposeFor(entry: M51aConnectorRegistryEntry): M51aPurposeOfUse {
  if (entry.handlingClass === "restricted-clinical") return "treatment";
  if (entry.handlingClass === "restricted-sud-part2") return "compliance";
  if (entry.handlingClass === "restricted-workforce-financial")
    return "workforce_operations";
  return "operations";
}

function connectorActor(entry: M51aConnectorRegistryEntry): M51aConnectorActorContext {
  const microsoftGroupIds = entry.permissionModel.repositoryPermissions.grants
    .filter((grant) => grant.principalType === "group")
    .map((grant) => grant.principalId);
  return immutable({
    actorId: `SYNTH-M51A-CONNECTOR-ACTOR-${entry.owner.role.toUpperCase()}`,
    role: entry.owner.role,
    roleTier: ROLE_TIER_BY_ROLE[entry.owner.role],
    divisions: immutable([
      entry.owner.divisionId === "enterprise"
        ? "enterprise"
        : entry.owner.divisionId,
    ]),
    amosPermissions: immutable([
      "dms.connector.discover",
      "dms.connector.read",
      "dms.connector.write",
      "dms.handling.internal_controlled",
      "dms.handling.confidential",
      "dms.handling.restricted_clinical",
      "dms.handling.restricted_part2",
      "dms.handling.restricted_workforce_financial",
    ]),
    purposeOfUse: purposeFor(entry),
    tenantId: entry.location.tenantId,
    microsoftPrincipalId: entry.owner.actorId,
    microsoftGroupIds: immutable(microsoftGroupIds),
    graphScopes: immutable(["Sites.ReadWrite.All"]),
    part2ConsentId:
      entry.handlingClass === "restricted-sud-part2"
        ? "SYNTH-PART2-CONSENT-INTEGRATED"
        : null,
    enterpriseEntitlements: immutable([
      "part2.consent_authorized",
      "cross_division:bhc",
      "cross_division:gro",
      "cross_division:eo",
    ]),
    externalGuest: false,
    synthetic: true,
  });
}

function changedSnapshot(
  prior: M51aMicrosoftItemSnapshot,
  input: {
    name: string;
    path: string;
    parentItemId: string;
    eTag: string;
    versionId: string;
    metadataHash: string;
    lastModifiedAt: string;
    driveId?: string;
    itemId?: string;
  },
): M51aMicrosoftItemSnapshot {
  return immutable({
    ...prior,
    address: immutable({
      ...prior.address,
      driveId: input.driveId ?? prior.address.driveId,
      itemId: input.itemId ?? prior.address.itemId,
    }),
    name: input.name,
    path: input.path,
    parentItemId: input.parentItemId,
    eTag: input.eTag,
    versionId: input.versionId,
    metadataHash: input.metadataHash,
    lastModifiedAt: input.lastModifiedAt,
  });
}

function modeOperationEvaluation(
  repositories: readonly M51aConnectorRegistryEntry[],
  items: readonly M51aMicrosoftItemSnapshot[],
) {
  const decisions = repositories.flatMap((entry) => {
    const actor = connectorActor(entry);
    const item = items.find((candidate) => candidate.connectorId === entry.connectorId) ?? null;
    return M51A_CONNECTOR_OPERATIONS.map((operation) => {
      const decision = evaluateM51aConnectorAccess(
        entry,
        actor,
        operation,
        item,
      );
      const expectedByMode =
        M51A_CONNECTOR_MODE_OPERATION_MATRIX[entry.connectorMode].includes(
          operation,
        );
      return immutable({
        connectorId: entry.connectorId,
        connectorMode: entry.connectorMode,
        operation,
        expectedByMode,
        architectureOperationAllowed: decision.architectureOperationAllowed,
        effectiveAllowed: decision.allowed,
        reasonCodes: decision.reasonCodes,
        liveExecutionAvailable: decision.liveExecutionAvailable,
        synthetic: true as const,
      });
    });
  });
  return immutable({
    decisions: immutable(decisions),
    attemptedOperations: decisions.length,
    modeMismatches: decisions.filter(
      (decision) =>
        decision.expectedByMode !== decision.architectureOperationAllowed,
    ).length,
    liveExecutionAvailable: false as const,
    synthetic: true as const,
  });
}

function stableIdentityEvaluation(items: readonly M51aMicrosoftItemSnapshot[]) {
  const resolver = new M51aStableObjectResolver();
  for (const item of items) resolver.bind(item);
  const original = items.find(
    (item) => item.connectorId === "SYNTH-CONNECTOR-GOVERNANCE",
  );
  if (!original) throw new Error("M51A_GOVERNANCE_ITEM_REQUIRED");
  const renamed = changedSnapshot(original, {
    name: "Enterprise-Doctrine-Renamed.docx",
    path: "/sites/operations-hub/Enterprise Governance & Doctrine/Enterprise-Doctrine-Renamed.docx",
    parentItemId: original.parentItemId,
    eTag: '"SYNTH-ETAG-GOVERNANCE-RENAME"',
    versionId: "SYNTH-VERSION-GOVERNANCE-2",
    metadataHash: "sha256:synth-metadata-governance-rename",
    lastModifiedAt: "2026-07-15T12:10:00.000Z",
  });
  const moved = changedSnapshot(renamed, {
    name: renamed.name,
    path: "/sites/operations-hub/Enterprise Governance & Doctrine/Approved/Enterprise-Doctrine-Renamed.docx",
    parentItemId: "SYNTH-FOLDER-GOVERNANCE-APPROVED",
    eTag: '"SYNTH-ETAG-GOVERNANCE-MOVE"',
    versionId: "SYNTH-VERSION-GOVERNANCE-3",
    metadataHash: "sha256:synth-metadata-governance-move",
    lastModifiedAt: "2026-07-15T12:20:00.000Z",
  });
  const crossDrive = changedSnapshot(moved, {
    name: moved.name,
    path: "/sites/operations-hub/Governance Archive/Enterprise-Doctrine-Renamed.docx",
    parentItemId: "SYNTH-ROOT-GOVERNANCE-ARCHIVE",
    driveId: "SYNTH-DRIVE-GOVERNANCE-ARCHIVE",
    itemId: "SYNTH-ITEM-GOVERNANCE-ARCHIVE-001",
    eTag: '"SYNTH-ETAG-GOVERNANCE-CROSS-DRIVE"',
    versionId: "SYNTH-VERSION-GOVERNANCE-4",
    metadataHash: "sha256:synth-metadata-governance-cross-drive",
    lastModifiedAt: "2026-07-15T12:30:00.000Z",
  });
  resolver.observe(original.stableObjectId, renamed, renamed.lastModifiedAt);
  resolver.observe(original.stableObjectId, moved, moved.lastModifiedAt);
  const mapping = resolver.observe(
    original.stableObjectId,
    crossDrive,
    crossDrive.lastModifiedAt,
  );
  const current = resolver.resolve(original.stableObjectId);
  return immutable({
    mapping,
    current,
    mappingCount: resolver.list().length,
    validationErrors: resolver.validate(),
    renameResolved: mapping.bindingHistory.some((binding) => binding.reason === "rename"),
    moveResolved: mapping.bindingHistory.some((binding) => binding.reason === "move_within_drive"),
    crossDriveResolved: mapping.bindingHistory.some((binding) => binding.reason === "cross_drive_rebind"),
    priorLocatorsPreserved: mapping.bindingHistory.slice(0, -1).every(
      (binding) => !binding.active && binding.supersededAt !== null,
    ),
    sourceOfTruth: mapping.sourceOfTruth,
    liveMicrosoftMutationAvailable: mapping.liveMicrosoftMutationAvailable,
    synthetic: true as const,
  });
}

async function reliabilityEvaluation(
  repositories: readonly M51aConnectorRegistryEntry[],
  items: readonly M51aMicrosoftItemSnapshot[],
) {
  const adapter = new SyntheticM51aMicrosoftAdapter(repositories, items);
  const orchestrator = new M51aConnectorSyncOrchestrator({
    repositories,
    adapter,
  });
  let syntheticExecutions = 0;
  const retryRequest = {
    idempotencyKey: "SYNTH-IDEMPOTENCY-INTEGRATED-RETRY",
    requestFingerprint: "sha256:integrated-retry-operation",
    connectorId: "SYNTH-CONNECTOR-GOVERNANCE",
    operation: "metadata_read" as M51aConnectorOperation,
    requestedAt: M51A_EVALUATION_AS_OF,
  };
  const retry = await orchestrator.executeIdempotent(retryRequest, (attempt) => {
    syntheticExecutions += 1;
    if (attempt === 1)
      throw new M51aSyntheticMicrosoftError(
        429,
        "M51A_SYNTHETIC_OUTAGE_THROTTLE",
        1_500,
      );
    return immutable({ outcome: "synthetic-recovered" as const });
  });
  const replay = await orchestrator.executeIdempotent(retryRequest, () => {
    syntheticExecutions += 1;
    return immutable({ outcome: "must-not-execute" as const });
  });
  const connectorId = "SYNTH-CONNECTOR-GOVERNANCE";
  const initialResync = await orchestrator.runControlledFullResync({
    connectorId,
    idempotencyKey: "SYNTH-IDEMPOTENCY-INTEGRATED-FULL-RESYNC-1",
    requestFingerprint: "sha256:integrated-full-resync-1",
  });
  if (!initialResync.value)
    throw new Error("M51A_INITIAL_RECONCILED_MIRROR_REQUIRED");
  const checkpointBeforeExpiredDelta = initialResync.value.checkpoint;
  adapter.configureDeltaFailure(
    connectorId,
    checkpointBeforeExpiredDelta.checkpoint,
    new M51aSyntheticMicrosoftError(410, "M51A_DELTA_TOKEN_EXPIRED"),
  );
  const expiredDelta = await orchestrator.runDeltaSync({
    connectorId,
    idempotencyKey: "SYNTH-IDEMPOTENCY-INTEGRATED-DELTA-EXPIRED",
    requestFingerprint: "sha256:integrated-delta-expired",
    requestedAt: "2026-07-15T12:40:00.000Z",
  });
  const checkpointHeldAfterExpiredDelta =
    orchestrator.getCheckpoint(connectorId)?.checkpoint ===
    checkpointBeforeExpiredDelta.checkpoint;
  const recoveryResync = await orchestrator.runControlledFullResync({
    connectorId,
    idempotencyKey: "SYNTH-IDEMPOTENCY-INTEGRATED-FULL-RESYNC-2",
    requestFingerprint: "sha256:integrated-full-resync-2",
    requestedAt: "2026-07-15T12:45:00.000Z",
  });
  const reconciliation = new M51aReconciliationEngine().reconcile({
    connectorId,
    source: items.filter((item) => item.connectorId === connectorId),
    target: cloneM51aSnapshots(
      items.filter((item) => item.connectorId === connectorId),
    ),
  });
  return immutable({
    retry,
    replay,
    initialResync,
    expiredDelta,
    recoveryResync,
    reconciliation,
    checkpointHeldAfterExpiredDelta,
    syntheticExecutions,
    maximumAttempts: orchestrator.maximumAttempts,
    actualSleepCalls: orchestrator.actualSleepCalls,
    operationLedgerCount: orchestrator.listOperationLedger().length,
    adapterMetrics: adapter.metrics(),
    duplicateExecutionPrevented:
      replay.replayed &&
      replay.operationId === retry.operationId &&
      syntheticExecutions === 2,
    liveGraphCalls: 0 as const,
    liveWrites: 0 as const,
    synthetic: true as const,
  });
}

export async function runM51AIntegratedScenario(
  actor: M51AActorContext = buildM51AActorContext("managing-director"),
) {
  if (!actor.permissions.includes("m51a:pilot:review"))
    throw new Error("M51A_INTEGRATED_REVIEW_PERMISSION_REQUIRED");
  const hub = runM51aHubArchitectureScenario();
  const repositories = createSyntheticM51aConnectorRegistryEntries();
  const items = createSyntheticM51aMicrosoftItems(repositories);
  const registry = new M51aConnectorRegistry(repositories);
  const registryValidation = validateM51aConnectorRegistry(repositories);
  const inventory = createM51aInventoryDispositionRegister(repositories, items);
  const modeOperations = modeOperationEvaluation(repositories, items);
  const stableIdentity = stableIdentityEvaluation(items);
  const reliability = await reliabilityEvaluation(repositories, items);
  const pilot = runM51aNonSensitivePilot();
  const security = runM51aSecurityEvaluation();
  const boundary = createM51ADemoBoundary();

  const restrictedZonesContained = hub.architecture.sites
    .filter(
      (site) =>
        site.kind === "restricted_record_zone" ||
        site.kind === "system_managed_zone",
    )
    .every(
      (site) =>
        !site.sharedNavigationEligible &&
        !site.contentRollupEligible &&
        !site.generalSearchEligible,
    );
  const lifecycleComplete = hub.architecture.libraries.every(
    (library) =>
      new Set(library.permittedLifecycleStates).size ===
        M51A_DOCUMENT_LIFECYCLE.length &&
      M51A_DOCUMENT_LIFECYCLE.every((state) =>
        library.permittedLifecycleStates.includes(state),
      ),
  );
  const authoritativeCitations = hub.publishingDecisions.filter(
    (decision) => decision.authoritativeGuidanceEligible,
  );
  const securityViolationTotal =
    security.metadataOnlyViolations +
    security.excludedModeViolations +
    security.staleSuppressionViolations +
    security.unauthorizedAiRetrievalViolations +
    security.liveWriteViolations +
    security.permissionLeakViolations;
  const allSecurityViolationTotal =
    securityViolationTotal + security.dlpDecisionViolations;

  const acceptanceFlags = immutable([
    flag(
      "M5.1A-AC-01",
      hub.criteria[0]?.passed === true &&
        hub.architecture.libraries.length === 10 &&
        restrictedZonesContained,
      12,
      "The governed hub topology, approved associated sites, ten controlled libraries, owners, navigation, lifecycle boundaries, and segregated restricted zones validate together.",
      ["M51A_HUB_ARCHITECTURE", "M51A_HUB_TOPOLOGY"],
    ),
    flag(
      "M5.1A-AC-02",
      hub.criteria[1]?.passed === true &&
        hub.criteria[2]?.passed === true &&
        hub.criteria[4]?.passed === true &&
        lifecycleComplete &&
        hub.architecture.handlingClasses.length === 6,
      16,
      "Content types, eighteen mandatory metadata fields, six handling classes, records controls, and the seven-state authoritative publishing lifecycle are internally consistent.",
      ["M51A_HUB_CONTENT_MODEL", "M51A_HUB_HANDLING_POLICY", "M51A_HUB_AUTHORITATIVE_PUBLISHING"],
    ),
    flag(
      "M5.1A-AC-03",
      inventory.accepted &&
        inventory.totals.repositories === registry.list().length &&
        inventory.totals.items === items.length &&
        inventory.totals.systemManagedExcluded === 2 &&
        inventory.totals.oneDriveWorkbenches === 1,
      18,
      "Every fictional repository and item is owned, classified, permission-reviewed, version/duplicate/link analyzed, assigned an authority status and disposition, and given a target or exclusion rationale.",
      ["M51A_INVENTORY_DISPOSITION_REGISTER"],
    ),
    flag(
      "M5.1A-AC-04",
      registryValidation.length === 0 &&
        registry.inventoryCompleteness().representedModes.length === 4 &&
        modeOperations.attemptedOperations ===
          repositories.length * M51A_CONNECTOR_OPERATIONS.length &&
        modeOperations.modeMismatches === 0 &&
        !modeOperations.liveExecutionAvailable,
      108,
      "All nine repositories are registered exactly once with complete governance metadata, one exclusive connector mode, and deterministic allow/deny classification for every connector operation.",
      ["M51A_CONNECTOR_REGISTRY", "M51A_CONNECTOR_MODE_OPERATION_EVALUATION"],
    ),
    flag(
      "M5.1A-AC-05",
      stableIdentity.validationErrors.length === 0 &&
        stableIdentity.renameResolved &&
        stableIdentity.moveResolved &&
        stableIdentity.crossDriveResolved &&
        stableIdentity.priorLocatorsPreserved &&
        stableIdentity.current.address.driveId ===
          "SYNTH-DRIVE-GOVERNANCE-ARCHIVE" &&
        stableIdentity.sourceOfTruth === "AMOS-DMS",
      14,
      "Stable AMOS object identity resolves the current opaque Microsoft locator after rename, within-drive move, and cross-drive rebind while preserving provenance and every prior locator.",
      ["M51A_STABLE_OBJECT_MAPPING_LEDGER"],
    ),
    flag(
      "M5.1A-AC-06",
      hub.criteria[3]?.passed === true &&
        hub.criteria[4]?.passed === true &&
        hub.roleProjections.length === 36 &&
        authoritativeCitations.length === 2 &&
        hub.roleProjections.every((projection) => projection.permissionTrimmed),
      15,
      "The eleven-area logical intranet map projects role- and division-appropriate destinations, suppresses restricted targets, and cites only approved Published Intranet Content as authoritative guidance.",
      ["M51A_HUB_INTRANET_MAP", "M51A_HUB_AUTHORITATIVE_PUBLISHING"],
    ),
    flag(
      "M5.1A-AC-07",
      pilot.accepted &&
        pilot.reconciliation.passed &&
        pilot.rollback.rollbackComplete &&
        pilot.rollback.sourceUnchanged &&
        pilot.productionRows === 0 &&
        pilot.liveWrites === 0 &&
        !pilot.realDataUsed,
      24,
      "The twelve-item non-sensitive pilot preserves counts, hashes, versions, metadata, ACLs, stable IDs, links, search, dispositions, rollback evidence, and source immutability with zero live writes.",
      ["M51A_NON_SENSITIVE_PILOT", "M51A_PILOT_RECONCILIATION", "M51A_PILOT_ROLLBACK"],
    ),
    flag(
      "M5.1A-AC-08",
      security.accepted &&
        allSecurityViolationTotal === 0 &&
        stableIdentity.moveResolved &&
        reliability.retry.status === "succeeded" &&
        reliability.retry.attempts.length === 2 &&
        reliability.duplicateExecutionPrevented &&
        reliability.expiredDelta.status === "resync_required" &&
        reliability.checkpointHeldAfterExpiredDelta &&
        reliability.recoveryResync.status === "succeeded" &&
        reliability.reconciliation.passed &&
        reliability.actualSleepCalls === 0 &&
        reliability.adapterMetrics.liveGraphCalls === 0 &&
        reliability.adapterMetrics.liveWrites === 0,
      28,
      "T1-T4 and divisional access, metadata-only handling, prohibited writes, sensitivity, stale suppression, moved-item resolution, duplicate prevention, outage/replay, 410 recovery, and unauthorized-AI denial all pass.",
      ["M51A_SECURITY_EVALUATION", "M51A_CONNECTOR_RECOVERY", "M51A_STABLE_OBJECT_MAPPING_LEDGER"],
    ),
  ] satisfies readonly M51AAcceptanceFlag[]);
  if (
    acceptanceFlags.length !== M51A_CRITERION_IDS.length ||
    !acceptanceFlags.every(
      (candidate, index) => candidate.criterionId === M51A_CRITERION_IDS[index],
    )
  )
    throw new Error("M51A_ACCEPTANCE_CRITERION_ORDER_INVALID");

  return immutable({
    milestone: M51A_MILESTONE,
    scenarioId: M51A_INTEGRATED_SCENARIO_ID,
    executedAt: M51A_EVALUATION_AS_OF,
    acceptanceStatement: M51A_EXACT_ACCEPTANCE_STATEMENT,
    actor: immutable({ role: actor.role, tier: actor.tier }),
    hub,
    inventory,
    connectorRegistry: immutable({
      entries: registry.list(),
      validationIssues: registryValidation,
      completeness: registry.inventoryCompleteness(),
      modeOperations,
    }),
    stableIdentity,
    reliability,
    pilot,
    security,
    acceptanceFlags,
    accepted: acceptanceFlags.every((candidate) => candidate.passed),
    totals: immutable({
      acceptanceCriteria: acceptanceFlags.length,
      passedCriteria: acceptanceFlags.filter((candidate) => candidate.passed).length,
      sites: hub.totals.sites,
      libraries: hub.totals.libraries,
      repositories: inventory.totals.repositories,
      inventoryItems: inventory.totals.items,
      stableObjects: stableIdentity.mappingCount,
      connectorOperationDecisions: modeOperations.attemptedOperations,
      pilotItems: pilot.sourceItems.length,
      securityDecisions: security.decisionCount,
      securityViolations: allSecurityViolationTotal,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
      productionRows: 0,
      realDataRecords: 0,
    }),
    boundary,
    synthetic: true as const,
  });
}
