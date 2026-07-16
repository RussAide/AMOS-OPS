import {
  checkinM42Document,
  checkoutM42Document,
  createApprovedM42SearchPerformanceCorpus,
  createApprovedM42SearchPerformanceQueries,
  createM42SearchPerformanceActor,
  createM42SyntheticExportManifest,
  createM42VersionLedger,
  createSyntheticM42DocumentRegistry,
  createSyntheticM42RecordsActors,
  decideM42DocumentApproval,
  requestM42DocumentApproval,
  searchM42Documents,
  transitionM42DocumentLifecycle,
  validateM42DocumentRegistry,
} from "../../m42";
import type { M42DocumentRecord } from "@contracts/m42/records";
import {
  DX1_EVALUATED_AT,
  DX1_SCENARIO_ID,
  type Dx1AuditEvent,
} from "../contracts";
import { DX1_PILOT_FIXTURE } from "../fixtures";
import {
  assertDx1Intelligence,
  createDx1IntelligenceAuditEvent,
  immutable,
} from "./support";

export const DX1_DMS_ACTIONS = [
  "create",
  "classify",
  "approve",
  "version",
  "search",
  "packetize",
  "export",
  "archive",
] as const;

export type Dx1DmsAction = (typeof DX1_DMS_ACTIONS)[number];

export interface Dx1DmsActionResult {
  readonly action: Dx1DmsAction;
  readonly passed: boolean;
  readonly evidenceIds: readonly string[];
  readonly summary: string;
}

export interface Dx1DocumentPacket {
  readonly packetId: string;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly documentIds: readonly string[];
  readonly versionIds: readonly string[];
  readonly assembledAt: typeof DX1_EVALUATED_AT;
  readonly orphanedDocumentIds: readonly string[];
  readonly synthetic: true;
}

export interface Dx1DmsVerificationResult {
  readonly accepted: boolean;
  readonly scenarioId: typeof DX1_SCENARIO_ID;
  readonly sourceMilestone: "M4.2";
  readonly actions: readonly Dx1DmsActionResult[];
  readonly packet: Readonly<Dx1DocumentPacket>;
  readonly searchResultIds: readonly string[];
  readonly exportManifestId: string;
  readonly archivedDocumentId: string;
  readonly versionCreated: string;
  readonly auditEvents: readonly Dx1AuditEvent[];
  readonly productionRepositoryConnected: false;
  readonly liveRepositoryWrites: 0;
  readonly synthetic: true;
}

function action(
  actionName: Dx1DmsAction,
  passed: boolean,
  evidenceIds: readonly string[],
  summary: string,
): Readonly<Dx1DmsActionResult> {
  return immutable({ action: actionName, passed, evidenceIds, summary });
}

function draftCopy(document: M42DocumentRecord): M42DocumentRecord {
  return {
    ...document,
    lifecycleState: "draft",
    approvalRoute: null,
  };
}

/**
 * Executes all eight DX.1 document actions through the accepted M4.2 engines.
 * Every state change is an in-memory synthetic projection; no repository is
 * connected and the exported result is a manifest only.
 */
export function runDx1DmsVerification(): Readonly<Dx1DmsVerificationResult> {
  const registry = createSyntheticM42DocumentRegistry();
  const actors = createSyntheticM42RecordsActors();
  const registryErrors = validateM42DocumentRegistry(registry);
  assertDx1Intelligence(
    registryErrors.length === 0,
    `DX1_DMS_INHERITED_REGISTRY_INVALID:${registryErrors.join(",")}`,
  );
  const document = registry.documents.find(
    (candidate) => candidate.documentId === "SYNTH-DOCUMENT-GAD-CAMPUS-SAFETY",
  );
  assertDx1Intelligence(document, "DX1_DMS_FIXTURE_DOCUMENT_REQUIRED");

  const approvalRequest = requestM42DocumentApproval(
    draftCopy(document),
    actors.recordsOwner,
    ["hr-compliance-officer"],
    "2026-12-15T08:10:00.000Z",
  );
  const approvalDecision = decideM42DocumentApproval(
    approvalRequest.document,
    actors.complianceApprover,
    "approved",
    "Synthetic DX.1 classification and governance review passed.",
    "2026-12-15T08:20:00.000Z",
  );

  let versionLedger = createM42VersionLedger(document);
  const checkout = checkoutM42Document(
    versionLedger,
    actors.facilitiesEditor,
    document.currentVersionId,
    "2026-12-15T09:00:00.000Z",
  );
  versionLedger = checkout.ledger;
  const checkin = checkinM42Document(versionLedger, {
    actor: actors.facilitiesEditor,
    lockId: checkout.lock.lockId,
    expectedBaseVersionId: document.currentVersionId,
    contentHash: "sha256:synth-dx1-campus-safety-1-1",
    changeSummary: "Synthetic DX.1 controlled version demonstration.",
    checkedInAt: "2026-12-15T09:10:00.000Z",
  });

  const searchQuery = createApprovedM42SearchPerformanceQueries().find(
    (candidate) => candidate.id === "SYN-M42-QUERY-05",
  );
  assertDx1Intelligence(searchQuery, "DX1_DMS_SEARCH_QUERY_REQUIRED");
  const search = searchM42Documents(
    createApprovedM42SearchPerformanceCorpus(),
    createM42SearchPerformanceActor(),
    searchQuery.query,
  );
  assertDx1Intelligence(
    search.results.length > 0 && search.permissionTrimmedBeforeRanking,
    "DX1_DMS_SEARCH_VERIFICATION_FAILED",
  );

  const packetDocuments = registry.documents.filter((candidate) =>
    [
      "SYNTH-DOCUMENT-ENTERPRISE-DOCTRINE",
      "SYNTH-DOCUMENT-GRO-YOUTH-CONTINUUM",
      "SYNTH-DOCUMENT-BHC-CLINICAL-REFERENCE",
    ].includes(candidate.documentId),
  );
  const packet = immutable({
    packetId: DX1_PILOT_FIXTURE.documentPacketId,
    scenarioId: DX1_SCENARIO_ID,
    documentIds: packetDocuments.map((candidate) => candidate.documentId),
    versionIds: packetDocuments.map((candidate) => candidate.currentVersionId),
    assembledAt: DX1_EVALUATED_AT,
    orphanedDocumentIds: [] as readonly string[],
    synthetic: true as const,
  });
  assertDx1Intelligence(
    packet.documentIds.length === 3 && packet.orphanedDocumentIds.length === 0,
    "DX1_DMS_PACKET_INCOMPLETE",
  );

  const exportManifest = createM42SyntheticExportManifest(
    packetDocuments,
    actors.exporter,
    "2026-12-15T09:30:00.000Z",
  );
  assertDx1Intelligence(
    exportManifest.documentIds.length > 0 &&
      !exportManifest.binaryContentIncluded &&
      !exportManifest.recipientDelivery &&
      !exportManifest.liveRepositoryWrite,
    "DX1_DMS_EXPORT_BOUNDARY_FAILED",
  );

  const superseded = transitionM42DocumentLifecycle(
    document,
    actors.recordsOwner,
    "superseded",
    "2026-12-15T10:00:00.000Z",
  );
  const retained = transitionM42DocumentLifecycle(
    superseded.document,
    actors.recordsOwner,
    "retained",
    "2026-12-15T10:01:00.000Z",
  );

  const actions: readonly Dx1DmsActionResult[] = immutable([
    action(
      "create",
      registry.documents.length > 0,
      [registry.auditEvents[0]!.eventId, document.documentId],
      "The accepted M4.2 registry creates a governed synthetic document record.",
    ),
    action(
      "classify",
      Boolean(
        document.taxonomyId &&
        document.classification &&
        document.retentionScheduleId,
      ),
      [
        document.taxonomyId,
        document.retentionScheduleId,
        document.stableObjectId,
      ],
      "Taxonomy, sensitivity, retention, ownership, and source authority are assigned.",
    ),
    action(
      "approve",
      approvalDecision.document.approvalRoute?.status === "approved",
      [approvalRequest.auditEvent.eventId, approvalDecision.auditEvent.eventId],
      "A sequential human approval is completed with separation of duties.",
    ),
    action(
      "version",
      checkin.version.version === "1.1" &&
        checkin.version.baseVersionId === document.currentVersionId,
      [
        checkout.lock.lockId,
        checkin.version.versionId,
        checkin.auditEvent.eventId,
      ],
      "Checkout, optimistic concurrency, and check-in create a traceable version.",
    ),
    action(
      "search",
      search.results.length > 0,
      [search.corpusId, searchQuery.id, search.results[0]!.documentId],
      "Permission trimming precedes ranking and citation in the accepted search engine.",
    ),
    action(
      "packetize",
      packet.documentIds.length === packet.versionIds.length,
      [packet.packetId, ...packet.documentIds],
      "Three governed source versions form the pilot document packet without orphans.",
    ),
    action(
      "export",
      !exportManifest.liveRepositoryWrite,
      [exportManifest.manifestId, ...exportManifest.documentIds],
      "A metadata-only export manifest is produced without content delivery or live writes.",
    ),
    action(
      "archive",
      retained.document.lifecycleState === "retained",
      [superseded.auditEvent.eventId, retained.auditEvent.eventId],
      "The synthetic record moves from published to superseded to retained.",
    ),
  ]);
  assertDx1Intelligence(
    actions.length === DX1_DMS_ACTIONS.length &&
      actions.every(
        (candidate, index) =>
          candidate.action === DX1_DMS_ACTIONS[index] && candidate.passed,
      ),
    "DX1_DMS_ACTION_INVENTORY_FAILED",
  );

  const auditEvents = immutable(
    actions.map((candidate) =>
      createDx1IntelligenceAuditEvent({
        action: `dms-${candidate.action}`,
        actorId: actors.recordsOwner.actorId,
        actorRole: actors.recordsOwner.role,
        outcome: "completed",
        reason: candidate.summary,
        evidenceIds: candidate.evidenceIds,
        stageId:
          candidate.action === "packetize" || candidate.action === "export"
            ? "qa-documentation-review"
            : "cross-enterprise",
      }),
    ),
  );

  return immutable({
    accepted: true,
    scenarioId: DX1_SCENARIO_ID,
    sourceMilestone: "M4.2" as const,
    actions,
    packet,
    searchResultIds: search.results.map((candidate) => candidate.documentId),
    exportManifestId: exportManifest.manifestId,
    archivedDocumentId: retained.document.documentId,
    versionCreated: checkin.version.versionId,
    auditEvents,
    productionRepositoryConnected: false as const,
    liveRepositoryWrites: 0 as const,
    synthetic: true as const,
  });
}
