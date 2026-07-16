import { describe, expect, it } from "vitest";
import {
  applyM42SyntheticLegalHold,
  assertM42ProductionDispositionUnavailable,
  createSyntheticM42DocumentRegistry,
  createSyntheticM42RecordsActors,
  decideM42DocumentApproval,
  previewM42SyntheticDisposition,
  requestM42DocumentApproval,
  transitionM42DocumentLifecycle,
  validateM42DocumentRegistry,
} from "../services/m42/document-governance";

describe("M4.2-01 governed document taxonomy and lifecycle", () => {
  it("builds a deterministic synthetic enterprise document registry", () => {
    const first = createSyntheticM42DocumentRegistry();
    const second = createSyntheticM42DocumentRegistry();
    expect(second).toEqual(first);
    expect(first).toMatchObject({
      frozenAt: "2026-12-15T08:00:00.000Z",
      productionRepositoryConnected: false,
      synthetic: true,
    });
    expect(first.taxonomy).toHaveLength(7);
    expect(first.retentionSchedules).toHaveLength(4);
    expect(first.documents).toHaveLength(6);
    expect(first.auditEvents).toHaveLength(6);
  });

  it("requires complete identity, metadata, owner, classification, lifecycle, version, and retention controls", () => {
    const registry = createSyntheticM42DocumentRegistry();
    expect(validateM42DocumentRegistry(registry)).toEqual([]);
    for (const document of registry.documents) {
      expect(document.documentId).toMatch(/^SYNTH-DOCUMENT-/);
      expect(document.stableObjectId).toMatch(/^SYNTH-OBJECT-/);
      expect(document.ownerId).toMatch(/^SYNTH-HUMAN-/);
      expect(document.currentVersion).toBe("1.0");
      expect(document.lifecycleState).toBe("published");
      expect(document.approvalRoute?.status).toBe("approved");
      expect(document.retentionScheduleId).toMatch(/^SYNTH-RET-/);
      expect(document.productionDispositionAvailable).toBe(false);
      expect(document.evidenceClass).toBe("synthetic_document_knowledge_demo");
    }
  });

  it("validates the taxonomy hierarchy, permitted types, and governed defaults", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const taxonomyIds = new Set(registry.taxonomy.map((node) => node.taxonomyId));
    const scheduleIds = new Set(
      registry.retentionSchedules.map((item) => item.scheduleId),
    );
    for (const node of registry.taxonomy) {
      if (node.parentTaxonomyId) expect(taxonomyIds).toContain(node.parentTaxonomyId);
      expect(scheduleIds).toContain(node.defaultRetentionScheduleId);
      expect(node.allowedDocumentTypes.length).toBeGreaterThan(0);
      expect(node.ownerRole).toBeTruthy();
      expect(node.active).toBe(true);
    }
  });

  it("detects taxonomy, retention, source-of-truth, and boundary corruption", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const document = registry.documents[0];
    const corrupted = {
      ...registry,
      productionRepositoryConnected: true as false,
      documents: [
        {
          ...document,
          taxonomyId: "SYNTH-TAX-MISSING",
          retentionScheduleId: "SYNTH-RET-MISSING",
          productionDispositionAvailable: true as false,
          sourceOfTruth: {
            ...document.sourceOfTruth,
            currentVersionId: "SYNTH-WRONG-VERSION",
          },
        },
      ],
    };
    expect(validateM42DocumentRegistry(corrupted)).toEqual(
      expect.arrayContaining([
        "PRODUCTION_REPOSITORY_MUST_BE_DISCONNECTED",
        `DOCUMENT_TAXONOMY_MISSING:${document.documentId}`,
        `DOCUMENT_RETENTION_MISSING:${document.documentId}`,
        `SOURCE_OF_TRUTH_MISMATCH:${document.documentId}`,
        `DOCUMENT_BOUNDARY_INVALID:${document.documentId}`,
      ]),
    );
  });

  it("routes approval sequentially with separation of duties", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const draft = {
      ...registry.documents[1],
      lifecycleState: "draft" as const,
      approvalRoute: null,
    };
    const requested = requestM42DocumentApproval(
      draft,
      actors.facilitiesEditor,
      ["administrator", "hr-compliance-officer"],
    );
    expect(requested.document.lifecycleState).toBe("in_review");
    expect(requested.document.approvalRoute?.steps.map((step) => step.requiredRole)).toEqual([
      "administrator",
      "hr-compliance-officer",
    ]);
    const first = decideM42DocumentApproval(
      requested.document,
      actors.enterpriseApprover,
      "approved",
      "Synthetic metadata and owner controls verified.",
    );
    expect(first.document.lifecycleState).toBe("in_review");
    const second = decideM42DocumentApproval(
      first.document,
      actors.complianceApprover,
      "approved",
      "Synthetic records controls verified.",
    );
    expect(second.document).toMatchObject({
      lifecycleState: "approved",
      approvalRoute: { status: "approved" },
    });
  });

  it("rejects out-of-order approval and non-human governance actors", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const draft = {
      ...registry.documents[1],
      lifecycleState: "draft" as const,
      approvalRoute: null,
    };
    const requested = requestM42DocumentApproval(
      draft,
      actors.facilitiesEditor,
      ["administrator", "hr-compliance-officer"],
    );
    expect(() =>
      decideM42DocumentApproval(
        requested.document,
        actors.complianceApprover,
        "approved",
        "Attempt out of sequence.",
      ),
    ).toThrow("M42_SEQUENTIAL_APPROVER_ROLE_MISMATCH");
    const modelActor = {
      ...actors.enterpriseApprover,
      actorId: "SYNTH-MODEL-DOCUMENT-APPROVER",
    };
    expect(() =>
      decideM42DocumentApproval(
        requested.document,
        modelActor,
        "approved",
        "Model attempt.",
      ),
    ).toThrow("M42_HUMAN_GOVERNANCE_ACTOR_REQUIRED");
  });

  it("enforces lifecycle transitions and approval before publication", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const draft = {
      ...registry.documents[0],
      lifecycleState: "draft" as const,
      approvalRoute: null,
    };
    expect(() =>
      transitionM42DocumentLifecycle(draft, actors.recordsOwner, "published"),
    ).toThrow("M42_DOCUMENT_LIFECYCLE_TRANSITION_INVALID");
    const unapproved = { ...draft, lifecycleState: "approved" as const };
    expect(() =>
      transitionM42DocumentLifecycle(unapproved, actors.recordsOwner, "published"),
    ).toThrow("M42_APPROVAL_REQUIRED_BEFORE_PUBLISH");
    const approved = {
      ...unapproved,
      approvalRoute: registry.documents[0].approvalRoute,
    };
    expect(
      transitionM42DocumentLifecycle(approved, actors.recordsOwner, "published")
        .document.lifecycleState,
    ).toBe("published");
  });

  it("applies a synthetic legal hold and blocks an otherwise due disposition", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const target = registry.documents.find(
      (document) => document.documentId === "SYNTH-DOCUMENT-GAD-CAMPUS-SAFETY",
    );
    expect(target).toBeDefined();
    const held = applyM42SyntheticLegalHold(
      target!,
      actors.recordsOwner,
      "Preserve for synthetic evaluation matter",
      "SYNTH-MATTER-2026-001",
    );
    const preview = previewM42SyntheticDisposition(
      held.document,
      registry.retentionSchedules,
      "2040-12-15T08:00:00.000Z",
    );
    expect(preview).toMatchObject({
      retentionComplete: true,
      legalHoldActive: true,
      eligibleForSyntheticReview: false,
      dispositionExecuted: false,
      productionDispositionAvailable: false,
    });
    expect(preview.reasons).toContain("ACTIVE_LEGAL_HOLD");
  });

  it("permits only a review manifest when retention is due and no hold exists", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const target = registry.documents[1];
    const preview = previewM42SyntheticDisposition(
      target,
      registry.retentionSchedules,
      "2040-12-15T08:00:00.000Z",
    );
    expect(preview).toMatchObject({
      retentionComplete: true,
      legalHoldActive: false,
      eligibleForSyntheticReview: true,
      dispositionExecuted: false,
      productionDispositionAvailable: false,
    });
    expect(preview.reasons).toEqual([
      "SYNTHETIC_REVIEW_ONLY",
      "PRODUCTION_DISPOSITION_UNAVAILABLE",
    ]);
  });

  it("exposes no production disposition execution path", () => {
    expect(assertM42ProductionDispositionUnavailable).toThrow(
      "M42_PRODUCTION_DISPOSITION_UNAVAILABLE",
    );
  });
});
