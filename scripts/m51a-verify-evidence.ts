import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { runM51AIntegratedScenario } from "../api/services/m51a/integrated-scenario";
import { createM51aInventoryDispositionRegister } from "../api/services/m51a/inventory-disposition";
import { validateM51aConnectorRegistry } from "../api/services/m51a/connectors/connector-registry";
import {
  createSyntheticM51aConnectorRegistryEntries,
  createSyntheticM51aMicrosoftItems,
} from "../api/services/m51a/connectors/synthetic-repository-fixtures";
import {
  createSyntheticM51aHubContentModel,
  validateM51aHubContentModel,
} from "../api/services/m51a/operations-hub/content-model";
import {
  createSyntheticM51aPublishingCandidates,
  evaluateM51aAuthoritativePublishing,
} from "../api/services/m51a/operations-hub/publishing";
import {
  createSyntheticM51aHubTopology,
  validateM51aHubTopology,
} from "../api/services/m51a/operations-hub/topology";
import {
  reconcileM51aPilot,
  runM51aNonSensitivePilot,
} from "../api/services/m51a/pilot/pilot-migration";
import {
  createM51aSecurityResources,
  projectM51aSecuritySearch,
  runM51aSecurityEvaluation,
} from "../api/services/m51a/pilot/security-evaluation";
import {
  M51A_CRITERION_EVIDENCE_FILES,
  M51A_EVIDENCE_FILES,
  assertM51a,
  hashM51a,
  m51aControlReferences,
  m51aFileRecord,
  parseM51aEvidenceOptions,
  stableM51aJson,
  type M51aEvidenceOptions,
  type M51aFileRecord,
} from "./m51a-export-evidence";

function object(value: unknown, label: string): Record<string, unknown> {
  assertM51a(
    typeof value === "object" && value !== null && !Array.isArray(value),
    `${label} must be an object.`,
  );
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  assertM51a(Array.isArray(value), `${label} must be an array.`);
  return value;
}

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    throw new Error(
      `Unable to read M5.1A JSON ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseChecksums(value: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of value.trim().split(/\r?\n/)) {
    const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
    assertM51a(match, `Invalid M5.1A checksum line: ${line}`);
    assertM51a(!result.has(match[2]), `Duplicate M5.1A checksum: ${match[2]}`);
    result.set(match[2], match[1]);
  }
  return result;
}

function criterionRecord(
  options: M51aEvidenceOptions,
  criterionId: keyof typeof M51A_CRITERION_EVIDENCE_FILES,
) {
  return object(
    readJson(
      path.join(
        options.output,
        M51A_CRITERION_EVIDENCE_FILES[criterionId],
      ),
    ),
    `M5.1A criterion ${criterionId}`,
  );
}

function verifyAdversarialControls(): void {
  const topology = createSyntheticM51aHubTopology();
  const topologyIssues = validateM51aHubTopology(
    topology.map((site) =>
      site.code === "bhc-operations"
        ? {
            ...site,
            sharedNavigationEligible: false,
            contentRollupEligible: false,
            generalSearchEligible: false,
            lifecycleBoundary: "",
          }
        : site,
    ),
  );
  assertM51a(
    topologyIssues.includes(
      "ASSOCIATED_SITE_VISIBILITY_INVALID:bhc-operations",
    ) &&
      topologyIssues.includes(
        "SITE_LIFECYCLE_BOUNDARY_REQUIRED:bhc-operations",
      ),
    "M5.1A AC01 adversarial topology controls did not fail closed.",
  );

  const contentModel = createSyntheticM51aHubContentModel();
  const lifecycleIssues = validateM51aHubContentModel(
    {
      ...contentModel,
      libraries: contentModel.libraries.map((library, index) =>
        index === 0
          ? {
              ...library,
              permittedLifecycleStates: Array(7).fill("Draft"),
            }
          : library,
      ),
    } as typeof contentModel,
    topology,
  );
  assertM51a(
    lifecycleIssues.includes(
      "LIBRARY_LIFECYCLE_INCOMPLETE:enterprise-governance-doctrine",
    ),
    "M5.1A AC02 adversarial lifecycle control accepted a noncanonical set.",
  );

  const publishingSource = createSyntheticM51aPublishingCandidates()[0];
  assertM51a(publishingSource, "M5.1A publishing fixture is missing.");
  const publishingDecision = evaluateM51aAuthoritativePublishing({
    ...publishingSource,
    metadata: {
      ...publishingSource.metadata,
      lifecycle_status: "Draft",
      authoritative_record_flag: false,
      intranet_state: "review",
      owner: "SYNTH-HUMAN-DIFFERENT-OWNER",
    },
  });
  const publishingMismatchCodes = [
    "PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:lifecycle_status",
    "PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:authoritative_record_flag",
    "PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:intranet_state",
    "PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:owner",
  ];
  assertM51a(
    publishingDecision.authoritativeGuidanceEligible === false &&
      publishingMismatchCodes.every((code) =>
        publishingDecision.reasonCodes.includes(code),
      ),
    "M5.1A AC02/AC06 adversarial publishing controls accepted contradictory metadata.",
  );

  const repositories = createSyntheticM51aConnectorRegistryEntries();
  const items = createSyntheticM51aMicrosoftItems(repositories);
  const inventory = createM51aInventoryDispositionRegister(
    repositories,
    items.map((item, index) =>
      index === 0
        ? {
            ...item,
            versionId: "",
            contentHash: "",
            metadataHash: "",
            lastModifiedAt: "not-a-date",
            permissions: { ...item.permissions, permissionSnapshotId: "" },
          }
        : item,
    ),
  );
  assertM51a(
    inventory.accepted === false &&
      inventory.validationErrors.includes(
        "M51A_INVENTORY_ITEM_EVIDENCE_INCOMPLETE",
      ),
    "M5.1A AC03 adversarial inventory controls accepted incomplete evidence.",
  );

  const registryIssues = validateM51aConnectorRegistry(
    repositories.map((entry, index) =>
      index === 0
        ? {
            ...entry,
            sensitivityLabelRef: "",
            dlpPolicyRef: "",
            intranetRoute: { ...entry.intranetRoute, routePath: "" },
            retentionPolicy: { ...entry.retentionPolicy, scheduleCode: "" },
            sync: {
              ...entry.sync,
              method: "excluded" as const,
              state: "exception" as const,
              cadence: "manual" as const,
            },
            exceptionState: {
              status: "owner_review_required" as const,
              code: null,
              rationale: null,
            },
          }
        : entry,
    ),
  );
  assertM51a(
    [
      "M51A_REGISTRY_GOVERNANCE_METADATA_INCOMPLETE",
      "M51A_REGISTRY_SYNC_STATE_INCONSISTENT",
      "M51A_REGISTRY_EXCEPTION_STATE_INCOMPLETE",
    ].every((code) => registryIssues.some((issue) => issue.code === code)),
    "M5.1A AC04 adversarial registry controls accepted malformed governance.",
  );

  const pilot = runM51aNonSensitivePilot();
  const tamperedTarget = pilot.targetItems.map((item, index) =>
    index === 0
      ? {
          ...item,
          metadata: { ...item.metadata, owner: "tampered-owner" },
          acl: {
            ...item.acl,
            principalRefs: [...item.acl.principalRefs, "GROUP:TAMPERED"],
          },
        }
      : item,
  );
  const tamperReconciliation = reconcileM51aPilot(
    pilot.sourceItems,
    tamperedTarget,
  );
  assertM51a(
    tamperReconciliation.passed === false &&
      tamperReconciliation.metadataMismatches.includes(
        tamperedTarget[0]?.stableObjectId ?? "",
      ) &&
      tamperReconciliation.aclMismatches.includes(
        tamperedTarget[0]?.stableObjectId ?? "",
      ) &&
      pilot.rollback.targetItemsBeforeRollback === 12 &&
      pilot.rollback.targetItemsAfterRollback === 0 &&
      pilot.rollback.removedTargetStableObjectIds.length === 12 &&
      pilot.rollback.sourceMutationCount === 0,
    "M5.1A AC07 adversarial tamper or executed-rollback controls failed.",
  );

  const security = runM51aSecurityEvaluation();
  const managingDirector = security.actors.find(
    (actor) => actor.role === "managing-director",
  );
  assertM51a(managingDirector, "M5.1A Managing Director actor is missing.");
  const resources = createM51aSecurityResources();
  const duplicateProjection = projectM51aSecuritySearch(managingDirector, [
    ...resources,
    resources[0]!,
  ]);
  assertM51a(
    duplicateProjection.duplicateResults === 1 &&
      duplicateProjection.visibleResourceIds.filter(
        (id) => id === resources[0]?.resourceId,
      ).length === 1 &&
      security.dlpDecisionViolations === 0 &&
      security.decisions.every((decision) => decision.dlpPolicyApplied) &&
      security.decisions.every((decision) =>
        decision.allowed
          ? decision.projection === "metadata_only"
            ? decision.dlpDecision === "metadata_only"
            : decision.dlpDecision === "allow_controlled"
          : decision.dlpDecision === "block",
      ),
    "M5.1A AC08 adversarial duplicate/DLP controls failed.",
  );
}

export async function verifyM51aEvidence(options: M51aEvidenceOptions) {
  const manifest = object(
    readJson(path.join(options.output, M51A_EVIDENCE_FILES.manifest)),
    "M5.1A manifest",
  );
  const exactAcceptance = object(
    manifest.exactAcceptance,
    "M5.1A exact acceptance",
  );
  assertM51a(
    manifest.recordId === "AMOS-OPS-M5.1A-ACCEPTANCE-EVIDENCE" &&
      manifest.milestone === "M5.1A" &&
      manifest.status === "complete" &&
      manifest.disposition === "ACCEPTED" &&
      manifest.evidenceClass ===
        "synthetic_operations_hub_connector_architecture_demo" &&
      manifest.criteriaExpected === 8 &&
      manifest.criteriaPassed === 8 &&
      Number.isInteger(manifest.assertionCount) &&
      (manifest.assertionCount as number) > 0 &&
      manifest.accepted === true &&
      Object.keys(exactAcceptance).length === 8 &&
      Object.values(exactAcceptance).every((value) => value === true) &&
      typeof manifest.scenarioSha256 === "string" &&
      /^[a-f0-9]{64}$/.test(manifest.scenarioSha256),
    "M5.1A acceptance manifest is incomplete or failing.",
  );
  const boundary = object(manifest.syntheticBoundary, "M5.1A boundary");
  assertM51a(
    boundary.syntheticOnly === true &&
      boundary.realDataUsed === false &&
      boundary.realFileContentRead === false &&
      boundary.liveSiteProvisioning === false &&
      boundary.liveConnectorMutation === false &&
      boundary.restrictedRecordMigration === false &&
      boundary.productionDeployment === false &&
      boundary.githubPush === false &&
      boundary.productionRows === 0 &&
      boundary.liveWrites === 0 &&
      boundary.liveGraphCalls === 0 &&
      boundary.liveMicrosoftReads === 0 &&
      boundary.liveMicrosoftWrites === 0 &&
      boundary.usesProductionData === false,
    "M5.1A evidence boundary drifted.",
  );

  const criterionFiles = Object.entries(M51A_CRITERION_EVIDENCE_FILES);
  let assertionTotal = 0;
  for (const [criterionId, fileName] of criterionFiles) {
    const record = object(
      readJson(path.join(options.output, fileName)),
      `M5.1A criterion ${criterionId}`,
    );
    assertM51a(
      record.milestone === "M5.1A" &&
        record.criterionId === criterionId &&
        record.passed === true &&
        typeof record.assertionCount === "number" &&
        record.assertionCount > 0 &&
        record.evidenceClass ===
          "synthetic_operations_hub_connector_architecture_demo" &&
        record.productionRows === 0 &&
        record.liveWrites === 0 &&
        record.liveGraphCalls === 0 &&
        record.liveMicrosoftWrites === 0 &&
        record.usesProductionData === false &&
        record.synthetic === true,
      `M5.1A criterion evidence is invalid: ${fileName}`,
    );
    assertionTotal += record.assertionCount as number;
  }
  assertM51a(
    assertionTotal === manifest.assertionCount,
    "M5.1A assertion total drifted.",
  );

  const topology = object(
    criterionRecord(options, "M5.1A-AC-01").artifacts,
    "M5.1A topology artifacts",
  );
  const architecture = object(topology.architecture, "M5.1A architecture");
  const hubTotals = object(topology.totals, "M5.1A hub totals");
  assertM51a(
    array(architecture.sites, "M5.1A sites").length === 14 &&
      array(architecture.libraries, "M5.1A libraries").length === 10 &&
      array(topology.architectureCriteria, "M5.1A architecture criteria").every(
        (criterion) => object(criterion, "M5.1A architecture criterion").passed === true,
      ) &&
      hubTotals.restrictedOrSystemZones === 7 &&
      hubTotals.liveExternalWrites === 0,
    "M5.1A Operations Hub topology evidence failed exact acceptance.",
  );

  const content = object(
    criterionRecord(options, "M5.1A-AC-02").artifacts,
    "M5.1A content artifacts",
  );
  assertM51a(
    array(content.contentTypes, "M5.1A content types").length === 11 &&
      array(content.metadataDefinitions, "M5.1A metadata definitions").length === 18 &&
      array(content.handlingClasses, "M5.1A handling classes").length === 6 &&
      array(content.libraries, "M5.1A governed libraries").length === 10,
    "M5.1A controlled content and handling evidence failed exact acceptance.",
  );

  const inventoryArtifacts = object(
    criterionRecord(options, "M5.1A-AC-03").artifacts,
    "M5.1A inventory artifacts",
  );
  const inventoryRegister = object(
    inventoryArtifacts.inventoryDisposition,
    "M5.1A inventory register",
  );
  const inventoryTotals = object(
    inventoryRegister.totals,
    "M5.1A inventory totals",
  );
  assertM51a(
    inventoryRegister.accepted === true &&
      inventoryTotals.repositories === 9 &&
      inventoryTotals.items === 7 &&
      inventoryTotals.systemManagedExcluded === 2 &&
      inventoryTotals.oneDriveWorkbenches === 1 &&
      inventoryTotals.duplicateItems === 0 &&
      inventoryTotals.brokenLinks === 0 &&
      inventoryTotals.liveRepositoryReads === 0 &&
      inventoryTotals.liveItemReads === 0,
    "M5.1A repository inventory/disposition evidence failed exact acceptance.",
  );

  const registryArtifacts = object(
    criterionRecord(options, "M5.1A-AC-04").artifacts,
    "M5.1A connector artifacts",
  );
  const registry = object(
    registryArtifacts.connectorRegistry,
    "M5.1A connector registry",
  );
  const completeness = object(registry.completeness, "M5.1A registry completeness");
  const modeOperations = object(registry.modeOperations, "M5.1A mode operations");
  assertM51a(
    array(registry.entries, "M5.1A connector entries").length === 9 &&
      array(registry.validationIssues, "M5.1A registry issues").length === 0 &&
      completeness.repositoryCount === 9 &&
      completeness.registeredExactlyOnce === true &&
      array(completeness.representedModes, "M5.1A represented modes").length === 4 &&
      completeness.liveCredentials === 0 &&
      completeness.liveConnections === 0 &&
      modeOperations.attemptedOperations === 99 &&
      modeOperations.modeMismatches === 0 &&
      modeOperations.liveExecutionAvailable === false,
    "M5.1A connector registry/mode evidence failed exact acceptance.",
  );

  const stableArtifacts = object(
    criterionRecord(options, "M5.1A-AC-05").artifacts,
    "M5.1A stable identity artifacts",
  );
  const stableIdentity = object(stableArtifacts.stableIdentity, "M5.1A stable identity");
  const mapping = object(stableIdentity.mapping, "M5.1A stable mapping");
  const current = object(stableIdentity.current, "M5.1A current binding");
  const currentAddress = object(current.address, "M5.1A current address");
  const bindingReasons = array(mapping.bindingHistory, "M5.1A binding history").map(
    (binding) => object(binding, "M5.1A binding").reason,
  );
  assertM51a(
    array(stableIdentity.validationErrors, "M5.1A stable mapping errors").length === 0 &&
      stableIdentity.renameResolved === true &&
      stableIdentity.moveResolved === true &&
      stableIdentity.crossDriveResolved === true &&
      stableIdentity.priorLocatorsPreserved === true &&
      stableIdentity.sourceOfTruth === "AMOS-DMS" &&
      stableIdentity.liveMicrosoftMutationAvailable === false &&
      currentAddress.driveId === "SYNTH-DRIVE-GOVERNANCE-ARCHIVE" &&
      stableM51aJson(bindingReasons) ===
        stableM51aJson([
          "initial_bind",
          "rename",
          "move_within_drive",
          "cross_drive_rebind",
        ]),
    "M5.1A stable-object evidence failed exact acceptance.",
  );

  const intranet = object(
    criterionRecord(options, "M5.1A-AC-06").artifacts,
    "M5.1A intranet artifacts",
  );
  const projections = array(intranet.roleProjections, "M5.1A role projections");
  const publishing = array(intranet.publishingDecisions, "M5.1A publishing decisions");
  assertM51a(
    array(intranet.routes, "M5.1A intranet routes").length === 11 &&
      projections.length === 36 &&
      projections.every(
        (projection) => object(projection, "M5.1A role projection").permissionTrimmed === true,
      ) &&
      publishing.filter(
        (decision) =>
          object(decision, "M5.1A publishing decision").authoritativeGuidanceEligible === true,
      ).length === 2,
    "M5.1A intranet and authoritative-publishing evidence failed exact acceptance.",
  );

  const pilotArtifacts = object(
    criterionRecord(options, "M5.1A-AC-07").artifacts,
    "M5.1A pilot artifacts",
  );
  const pilot = object(pilotArtifacts.pilot, "M5.1A pilot");
  const pilotReconciliation = object(pilot.reconciliation, "M5.1A pilot reconciliation");
  const rollback = object(pilot.rollback, "M5.1A pilot rollback");
  assertM51a(
    pilot.accepted === true &&
      array(pilot.sourceItems, "M5.1A pilot source").length === 12 &&
      array(pilot.targetItems, "M5.1A pilot target").length === 12 &&
      pilotReconciliation.sourceCount === 12 &&
      pilotReconciliation.targetCount === 12 &&
      pilotReconciliation.passed === true &&
      rollback.rollbackComplete === true &&
      rollback.sourceUnchanged === true &&
      rollback.targetItemsAfterRollback === 0 &&
      pilot.productionRows === 0 &&
      pilot.liveWrites === 0 &&
      pilot.realDataUsed === false,
    "M5.1A non-sensitive pilot evidence failed exact acceptance.",
  );

  const integrated = object(
    criterionRecord(options, "M5.1A-AC-08").artifacts,
    "M5.1A integrated artifacts",
  );
  const totals = object(integrated.totals, "M5.1A integrated totals");
  const reliability = object(integrated.reliability, "M5.1A reliability");
  const retry = object(reliability.retry, "M5.1A retry");
  const replay = object(reliability.replay, "M5.1A replay");
  const expiredDelta = object(reliability.expiredDelta, "M5.1A expired delta");
  const recovery = object(reliability.recoveryResync, "M5.1A recovery resync");
  const reconciliation = object(reliability.reconciliation, "M5.1A reconciliation");
  const adapterMetrics = object(reliability.adapterMetrics, "M5.1A adapter metrics");
  const security = object(integrated.security, "M5.1A security");
  const securityViolations = [
    security.metadataOnlyViolations,
    security.excludedModeViolations,
    security.staleSuppressionViolations,
    security.unauthorizedAiRetrievalViolations,
    security.liveWriteViolations,
    security.permissionLeakViolations,
  ];
  assertM51a(
    integrated.accepted === true &&
      array(integrated.acceptanceFlags, "M5.1A acceptance flags").length === 8 &&
      totals.acceptanceCriteria === 8 &&
      totals.passedCriteria === 8 &&
      totals.securityViolations === 0 &&
      totals.liveGraphCalls === 0 &&
      totals.liveMicrosoftWrites === 0 &&
      totals.productionRows === 0 &&
      totals.realDataRecords === 0 &&
      security.accepted === true &&
      securityViolations.every((value) => value === 0) &&
      retry.status === "succeeded" &&
      array(retry.attempts, "M5.1A retry attempts").length === 2 &&
      replay.replayed === true &&
      reliability.duplicateExecutionPrevented === true &&
      expiredDelta.status === "resync_required" &&
      reliability.checkpointHeldAfterExpiredDelta === true &&
      recovery.status === "succeeded" &&
      reconciliation.passed === true &&
      reliability.actualSleepCalls === 0 &&
      adapterMetrics.liveGraphCalls === 0 &&
      adapterMetrics.liveWrites === 0 &&
      adapterMetrics.credentialReads === 0,
    "M5.1A integrated security/resilience evidence failed exact acceptance.",
  );

  verifyAdversarialControls();

  const inventory = array(manifest.inventory, "M5.1A manifest inventory") as M51aFileRecord[];
  assertM51a(
    inventory.length === criterionFiles.length + 1,
    "M5.1A manifest inventory count drifted.",
  );
  for (const expected of inventory) {
    const actual = m51aFileRecord(
      path.join(options.output, expected.path),
      expected.path,
    );
    assertM51a(
      actual.bytes === expected.bytes && actual.sha256 === expected.sha256,
      `M5.1A inventory hash mismatch: ${expected.path}`,
    );
  }
  assertM51a(
    stableM51aJson(manifest.controlReferences) ===
      stableM51aJson(m51aControlReferences(options.root)),
    "M5.1A control-reference hashes drifted.",
  );
  const checksums = parseChecksums(
    fs.readFileSync(
      path.join(options.output, M51A_EVIDENCE_FILES.checksums),
      "utf8",
    ),
  );
  const expectedChecksums = [
    ...inventory,
    m51aFileRecord(
      path.join(options.output, M51A_EVIDENCE_FILES.manifest),
      M51A_EVIDENCE_FILES.manifest,
    ),
  ];
  assertM51a(
    checksums.size === expectedChecksums.length,
    "M5.1A checksum inventory count drifted.",
  );
  for (const record of expectedChecksums)
    assertM51a(
      checksums.get(record.path) === record.sha256,
      `M5.1A checksum mismatch: ${record.path}`,
    );

  const replayScenario = await runM51AIntegratedScenario();
  assertM51a(
    replayScenario.accepted &&
      hashM51a(stableM51aJson(replayScenario)) === manifest.scenarioSha256,
    "M5.1A deterministic integrated-scenario replay drifted.",
  );
  return Object.freeze({
    milestone: "M5.1A",
    status: "PASS",
    criteriaVerified: criterionFiles.length,
    assertionsVerified: assertionTotal,
    inventoryFilesVerified: inventory.length,
    checksumRecordsVerified: expectedChecksums.length,
    deterministicIntegratedReplayVerified: true,
    repositoriesVerified: 9,
    pilotItemsVerified: 12,
    securityDecisionsVerified: totals.securityDecisions,
    productionRows: 0,
    liveGraphCalls: 0,
    liveWrites: 0,
  });
}

const invokedPath = process.argv[1];
if (
  invokedPath &&
  pathToFileURL(path.resolve(invokedPath)).href === import.meta.url
) {
  try {
    process.stdout.write(
      stableM51aJson(
        await verifyM51aEvidence(
          parseM51aEvidenceOptions(process.argv.slice(2)),
        ),
      ),
    );
  } catch (error) {
    process.stderr.write(
      `M5.1A evidence verification failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
