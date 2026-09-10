import { createHash } from "node:crypto";
import Database from "better-sqlite3";
import type { IdentityUser } from "../security/identity";
import {
  deriveRecordAssignmentContext,
  governedRecordContextRequirements,
  governedRecordReadResource,
} from "./record-authority-context";
import { establishRecordAuthority } from "./record-authority-store";
import { establishSharePointBackendBinding } from "./sharepoint-backend-store";
import {
  retrieveAuthorizedSharePointBinary,
  type SharePointBackendReader,
} from "./sharepoint-authority-bridge";
import type {
  AskAmosMedicalRecordPreviewBackend,
  AskAmosMedicalRecordPreviewRecord,
  AskAmosMedicalRecordPreviewResult,
  AskAmosMedicalRecordPreviewScenario,
  AskAmosMedicalRecordPreviewTraceStep,
} from "../../contracts/dms/ask-amos-medical-record";

const PREVIEW_USER: IdentityUser = {
  id: "SYNTH-S3-USER",
  email: "s3.preview@example.invalid",
  firstName: "Synthetic",
  lastName: "Preview",
  name: "Synthetic Preview",
  role: "shift-supervisor",
  department: "GRO Residential",
  mfaEnabled: true,
  accessStatus: "cleared",
  identityType: "workforce",
  trainingAccess: true,
  sponsorName: null,
  accessExpiresAt: null,
  dataScope: "training",
};

const RECORD_KEY = "CYPRESS:SYNTH-S3-YOUTH:MEDICAL-CONTINUITY";
const CASE_ID = "SYNTH-S3-CASE";
const YOUTH_ID = "SYNTH-S3-YOUTH";
const OPERATION_ID = "CYPRESS-GRO";

const PREVIEW_CONTENT = {
  recordType: "Medical & Clinical Continuity",
  reviewedAt: "2026-09-09T12:00:00.000Z",
  summary:
    "Synthetic training record: the youth returned to Cypress GRO after a brief hospital evaluation. The controlling continuity record preserves current medication, supervision, follow-up, and return-to-placement instructions.",
  facts: [
    "Hospital evaluation completed and return-to-placement is documented.",
    "Medication reconciliation is required before the next scheduled administration.",
    "Enhanced supervision remains active until clinical reassessment is documented.",
    "Follow-up review is assigned to the authorized care team; no automatic discharge is indicated.",
  ],
  nextActions: [
    "Verify medication reconciliation against the controlling record.",
    "Document post-return clinical reassessment and supervision status.",
    "Escalate any conflict, missing controller, or backend drift instead of substituting another copy.",
  ],
} as const;

function contentBytes(): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(PREVIEW_CONTENT));
}

function contentHash(content: Uint8Array): string {
  return createHash("sha256").update(content).digest("hex");
}

function trace(
  step: string,
  status: AskAmosMedicalRecordPreviewTraceStep["status"],
  detail: string,
): AskAmosMedicalRecordPreviewTraceStep {
  return { step, status, detail };
}

export async function retrieveAskAmosMedicalRecord(
  db: Database.Database,
  input: {
    recordKey: string;
    user: IdentityUser;
    reader: SharePointBackendReader;
  },
) {
  const assignment = deriveRecordAssignmentContext(db, input.user);
  return retrieveAuthorizedSharePointBinary(db, {
    recordKey: input.recordKey,
    user: input.user,
    resource: governedRecordReadResource,
    assignment,
    contextRequirements: (record) =>
      governedRecordContextRequirements(record, input.user),
    reader: input.reader,
  });
}

function establishPreviewFixture(
  db: Database.Database,
  scenario: AskAmosMedicalRecordPreviewScenario,
) {
  const establishedBy = "SYNTH-S3-CONTROL";
  if (scenario === "authority_conflict") {
    const first = establishRecordAuthority(db, {
      documentId: "SYNTH-S3-CONFLICT-A",
      recordKey: RECORD_KEY,
      recordClass: "MEDICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "synthetic-preview",
      sourceLocator: "dms://SYNTH-S3-CONFLICT-A",
      governingVersion: "v1",
      youthId: YOUTH_ID,
      caseId: CASE_ID,
      operationId: OPERATION_ID,
      division: "gro",
      dataScope: "training",
      rationale: "Synthetic S3 authority-conflict preview candidate A.",
      establishedBy,
    });
    establishRecordAuthority(db, {
      documentId: "SYNTH-S3-CONFLICT-B",
      recordKey: RECORD_KEY,
      recordClass: "MEDICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "synthetic-preview",
      sourceLocator: "dms://SYNTH-S3-CONFLICT-B",
      governingVersion: "v2",
      youthId: YOUTH_ID,
      caseId: CASE_ID,
      operationId: OPERATION_ID,
      division: "gro",
      dataScope: "training",
      rationale: "Synthetic S3 authority-conflict preview candidate B.",
      establishedBy,
    });
    return { current: first, supersededDocumentId: null };
  }

  let supersededDocumentId: string | null = null;
  let current;
  if (scenario === "superseded_protected") {
    const prior = establishRecordAuthority(db, {
      documentId: "SYNTH-S3-MEDICAL-V1",
      recordKey: RECORD_KEY,
      recordClass: "MEDICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "synthetic-preview",
      sourceLocator: "dms://SYNTH-S3-MEDICAL-V1",
      governingVersion: "v1",
      youthId: YOUTH_ID,
      caseId: CASE_ID,
      operationId: OPERATION_ID,
      division: "gro",
      dataScope: "training",
      rationale: "Synthetic prior controlling copy for supersession preview.",
      establishedBy,
    });
    supersededDocumentId = prior.documentId;
    current = establishRecordAuthority(db, {
      documentId: "SYNTH-S3-MEDICAL-V2",
      recordKey: RECORD_KEY,
      recordClass: "MEDICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "synthetic-preview",
      sourceLocator: "dms://SYNTH-S3-MEDICAL-V2",
      governingVersion: "v2",
      supersedesAuthorityId: prior.id,
      youthId: YOUTH_ID,
      caseId: CASE_ID,
      operationId: OPERATION_ID,
      division: "gro",
      dataScope: "training",
      rationale: "Synthetic replacement controller; prior copy must not be returned.",
      establishedBy,
    });
  } else {
    current = establishRecordAuthority(db, {
      documentId: "SYNTH-S3-MEDICAL-CURRENT",
      recordKey: RECORD_KEY,
      recordClass: "MEDICAL_RECORD",
      authorityState: "CURRENT_CONTROLLING",
      sourceSystem: "synthetic-preview",
      sourceLocator: "dms://SYNTH-S3-MEDICAL-CURRENT",
      governingVersion: "v1",
      youthId: YOUTH_ID,
      caseId: CASE_ID,
      operationId: OPERATION_ID,
      division: "gro",
      dataScope: "training",
      rationale: "Synthetic current medical continuity record for S3 preview.",
      establishedBy,
    });
  }

  const bytes = contentBytes();
  const binding = establishSharePointBackendBinding(db, {
    authorityId: current.id,
    documentId: current.documentId,
    recordKey: current.recordKey,
    bindingState: "ACTIVE",
    tenantHost: "adolbi.sharepoint.com",
    siteId: "SYNTH-S3-CYPRESS-GRO-SITE",
    driveId: "SYNTH-S3-DOCUMENTS-DRIVE",
    itemId: `SYNTH-S3-${current.documentId}`,
    name: "Synthetic Medical Continuity Record.json",
    webUrl:
      "https://adolbi.sharepoint.com/sites/CypressGRO/Shared%20Documents/Synthetic%20Medical%20Continuity%20Record.json",
    sizeBytes: bytes.byteLength,
    contentHash: contentHash(bytes),
    verificationMethod: "CONNECTOR_ATTESTATION",
    verifiedBy: establishedBy,
  });
  return { current, binding, bytes, supersededDocumentId };
}

function previewReader(
  fixture: ReturnType<typeof establishPreviewFixture>,
  scenario: AskAmosMedicalRecordPreviewScenario,
): SharePointBackendReader {
  const binding = "binding" in fixture ? fixture.binding : undefined;
  const bytes = "bytes" in fixture ? fixture.bytes : undefined;
  if (!binding || !bytes) {
    return {
      getItemMetadata: async () => {
        throw new Error("SHAREPOINT_MUST_NOT_BE_CONTACTED_ON_AUTHORITY_CONFLICT");
      },
      downloadItemContent: async () => {
        throw new Error("SHAREPOINT_MUST_NOT_BE_CONTACTED_ON_AUTHORITY_CONFLICT");
      },
    };
  }
  return {
    getItemMetadata: async () => ({
      tenantHost: binding.address.tenantHost,
      siteId: binding.address.siteId,
      driveId: binding.address.driveId,
      itemId: binding.address.itemId,
      name:
        scenario === "backend_stale"
          ? "Synthetic Drifted Medical Record.json"
          : binding.name,
      webUrl: binding.webUrl,
      parentItemId: binding.parentItemId,
      relativePath: binding.relativePath,
      versionId: binding.versionId,
      eTag: binding.eTag,
      cTag: binding.cTag,
      sizeBytes: binding.sizeBytes,
      contentHash: binding.contentHash,
      metadataHash:
        scenario === "backend_stale" ? "SYNTH-S3-DRIFT" : binding.metadataHash,
      lastModifiedAt: "2026-09-09T12:00:00.000Z",
    }),
    downloadItemContent: async () => bytes,
  };
}

function recordView(
  documentId: string,
  governingVersion: string | null,
): AskAmosMedicalRecordPreviewRecord {
  return {
    recordKey: RECORD_KEY,
    documentId,
    recordClass: "MEDICAL_RECORD",
    authorityState: "CURRENT_CONTROLLING",
    governingVersion: governingVersion ?? "unversioned",
    youthLabel: "Synthetic Youth S3",
    recordType: PREVIEW_CONTENT.recordType,
    reviewedAt: PREVIEW_CONTENT.reviewedAt,
    summary: PREVIEW_CONTENT.summary,
    facts: PREVIEW_CONTENT.facts,
    nextActions: PREVIEW_CONTENT.nextActions,
  };
}

export async function runAskAmosMedicalRecordPreview(
  scenario: AskAmosMedicalRecordPreviewScenario,
): Promise<AskAmosMedicalRecordPreviewResult> {
  const db = new Database(":memory:");
  try {
    const fixture = establishPreviewFixture(db, scenario);
    const assignment =
      scenario === "denied"
        ? { assignedCaseIds: [], assignedYouthIds: [], operationIds: [OPERATION_ID] }
        : {
            assignedCaseIds: [CASE_ID],
            assignedYouthIds: [YOUTH_ID],
            operationIds: [OPERATION_ID],
          };

    const result = await retrieveAuthorizedSharePointBinary(db, {
      recordKey: RECORD_KEY,
      user: PREVIEW_USER,
      resource: governedRecordReadResource,
      assignment,
      contextRequirements: (record) =>
        governedRecordContextRequirements(record, PREVIEW_USER),
      reader: previewReader(fixture, scenario),
    });

    const generatedAt = new Date().toISOString();
    if (result.outcome !== "AUTHORIZED_BINARY") {
      const outcome =
        result.outcome === "DENIED"
          ? "DENIED"
          : result.outcome === "AUTHORITY_CONFLICT"
            ? "AUTHORITY_CONFLICT"
            : result.outcome === "BACKEND_STALE"
              ? "BACKEND_STALE"
              : "NO_CONTROLLING_RECORD";
      const title =
        outcome === "DENIED"
          ? "Access denied before record disclosure"
          : outcome === "AUTHORITY_CONFLICT"
            ? "Authority conflict — no record guessed"
            : outcome === "BACKEND_STALE"
              ? "Backend drift detected — content withheld"
              : "No controlling record available";
      const answer =
        outcome === "DENIED"
          ? "Ask AMOS withheld the medical record because contextual assignment requirements were not satisfied."
          : outcome === "AUTHORITY_CONFLICT"
            ? "Ask AMOS found more than one current controller and refused to choose between them."
            : outcome === "BACKEND_STALE"
              ? "Ask AMOS resolved an authorized controller, but the bound SharePoint object no longer matched its verified metadata, so the content was not downloaded or shown."
              : "Ask AMOS could not establish one current/controlling record and returned no substitute copy.";
      return {
        environment: "SYNTHETIC_PREVIEW",
        noPhi: true,
        scenario,
        outcome,
        code: result.code,
        title,
        answer,
        controlNotice:
          "Synthetic preview only. No production PHI, live SharePoint content, permissions, or repository settings are used or changed.",
        record: null,
        backend: null,
        trace: [
          trace(
            "Authority resolution",
            outcome === "AUTHORITY_CONFLICT" || outcome === "NO_CONTROLLING_RECORD"
              ? "BLOCKED"
              : "PASS",
            outcome === "AUTHORITY_CONFLICT"
              ? "Conflicting current controllers detected; fail closed."
              : outcome === "NO_CONTROLLING_RECORD"
                ? "No current controller exists; fail closed."
                : "One current controller resolved.",
          ),
          trace(
            "Contextual access",
            outcome === "DENIED"
              ? "BLOCKED"
              : outcome === "AUTHORITY_CONFLICT" || outcome === "NO_CONTROLLING_RECORD"
                ? "NOT_REACHED"
                : "PASS",
            outcome === "DENIED"
              ? "Assignment/context policy denied access before any backend locator was exposed."
              : outcome === "AUTHORITY_CONFLICT" || outcome === "NO_CONTROLLING_RECORD"
                ? "Access evaluation did not proceed because authority was unresolved."
                : "Identity, RBAC, scope, operation, and assignment checks passed.",
          ),
          trace(
            "SharePoint object re-verification",
            outcome === "BACKEND_STALE"
              ? "BLOCKED"
              : outcome === "DENIED" || outcome === "AUTHORITY_CONFLICT" || outcome === "NO_CONTROLLING_RECORD"
                ? "NOT_REACHED"
                : "PASS",
            outcome === "BACKEND_STALE"
              ? "Bound item metadata drifted; binary download was blocked."
              : outcome === "DENIED" || outcome === "AUTHORITY_CONFLICT" || outcome === "NO_CONTROLLING_RECORD"
                ? "No SharePoint contact was required."
                : "Exact bound object matched the immutable backend binding.",
          ),
          trace(
            "Controlled record view",
            "NOT_REACHED",
            "No record content is rendered after a denied, conflicted, unavailable, or stale result.",
          ),
        ],
        generatedAt,
      };
    }

    const binding = "binding" in fixture ? fixture.binding : undefined;
    if (!binding) throw new Error("S3_PREVIEW_BINDING_MISSING");
    const backend: AskAmosMedicalRecordPreviewBackend = {
      stableObjectId: binding.stableObjectId,
      name: binding.name,
      tenantHost: binding.address.tenantHost,
      siteId: binding.address.siteId,
      driveId: binding.address.driveId,
      itemId: binding.address.itemId,
      integrityVerified: true,
    };
    const supersededProtected = scenario === "superseded_protected";
    return {
      environment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      scenario,
      outcome: "AUTHORIZED",
      code: supersededProtected
        ? "SUPERSEDED_COPY_BLOCKED_CURRENT_RETURNED"
        : result.code,
      title: supersededProtected
        ? "Current controller returned; superseded copy protected"
        : "Authorized current medical record",
      answer: supersededProtected
        ? "Ask AMOS ignored the retired prior copy and returned only the replacement CURRENT / CONTROLLING medical continuity record."
        : PREVIEW_CONTENT.summary,
      controlNotice:
        "Synthetic preview only. The live Graph path remains fail-closed until AMOS-OPS runtime credentials are configured and successfully probed.",
      record: recordView(fixture.current.documentId, fixture.current.governingVersion),
      backend,
      trace: [
        trace(
          "Authority resolution",
          "PASS",
          supersededProtected
            ? `Retired copy ${fixture.supersededDocumentId} was excluded; replacement controller selected.`
            : "Exactly one CURRENT / CONTROLLING medical record resolved.",
        ),
        trace(
          "Contextual access",
          "PASS",
          "Synthetic workforce identity passed RBAC, training scope, Cypress GRO operation, case, and youth assignment checks.",
        ),
        trace(
          "SharePoint object re-verification",
          "PASS",
          "Exact immutable tenant/site/drive/item binding matched immediately before binary read.",
        ),
        trace(
          "Controlled record view",
          "PASS",
          "Verified synthetic content was rendered as a bounded Ask AMOS record view without exposing a caller-selected SharePoint path.",
        ),
      ],
      generatedAt,
    };
  } finally {
    db.close();
  }
}
