import { describe, expect, it } from "vitest";
import {
  appendM42DisclosureEvent,
  assertM42LiveDisclosureUnavailable,
  createM42DisclosureLedger,
  createM42SyntheticExportManifest,
  evaluateM42DocumentAccess,
  permissionTrimM42Documents,
  validateM42DisclosureLedger,
} from "../services/m42/document-access";
import {
  createSyntheticM42DocumentRegistry,
  createSyntheticM42RecordsActors,
} from "../services/m42/document-governance";

describe("M4.2-02 least-privilege document access and disclosure control", () => {
  it("allows a minimum-necessary restricted reference only to an authorized clinical role", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const document = registry.documents.find(
      (candidate) =>
        candidate.documentId === "SYNTH-DOCUMENT-BHC-CLINICAL-REFERENCE",
    );
    expect(document).toBeDefined();
    const decision = evaluateM42DocumentAccess(
      document!,
      actors.clinicalReader,
      "content_read",
    );
    expect(decision).toMatchObject({
      allowed: true,
      permissionTrimmed: false,
      metadataVisible: true,
      contentVisible: true,
      liveDisclosureAvailable: false,
    });
    expect(decision.auditEvent).toMatchObject({
      eventType: "access_evaluated",
      outcome: "allowed",
      immutable: true,
    });
  });

  it("denies restricted content when classification clearance and permission are absent", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const document = registry.documents.find(
      (candidate) =>
        candidate.documentId === "SYNTH-DOCUMENT-GRO-YOUTH-CONTINUUM",
    );
    const decision = evaluateM42DocumentAccess(
      document!,
      actors.limitedResidentialReader,
      "content_read",
    );
    expect(decision).toMatchObject({
      allowed: false,
      permissionTrimmed: true,
      metadataVisible: false,
      contentVisible: false,
    });
    expect(decision.reasonCodes).toEqual(
      expect.arrayContaining([
        "SENSITIVITY_CLEARANCE_REQUIRED:restricted",
        "CLASSIFICATION_PERMISSION_REQUIRED:documents.restricted.read",
      ]),
    );
  });

  it("segments documents by division before exposing metadata", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const result = permissionTrimM42Documents(
      registry.documents,
      actors.limitedResidentialReader,
    );
    expect(result.visibleDocuments.map((document) => document.documentId)).toEqual([
      "SYNTH-DOCUMENT-ENTERPRISE-DOCTRINE",
    ]);
    expect(result.trimmedDocumentIds).toHaveLength(5);
    const bhcDecision = result.decisions.find(
      (decision) =>
        decision.documentId === "SYNTH-DOCUMENT-BHC-CLINICAL-REFERENCE",
    );
    expect(bhcDecision?.reasonCodes).toContain("DIVISION_SEGMENT_DENIED");
    expect(bhcDecision?.metadataVisible).toBe(false);
  });

  it("requires explicit Part 2 permission, clearance, consent verification, and BHC scope", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const part2 = registry.documents.find(
      (document) => document.classification === "part2",
    );
    expect(part2).toBeDefined();
    expect(
      evaluateM42DocumentAccess(part2!, actors.part2Reader, "content_read"),
    ).toMatchObject({ allowed: true, contentVisible: true });
    const restrictedOnly = evaluateM42DocumentAccess(
      part2!,
      actors.clinicalReader,
      "content_read",
    );
    expect(restrictedOnly.allowed).toBe(false);
    expect(restrictedOnly.reasonCodes).toEqual(
      expect.arrayContaining([
        "SENSITIVITY_CLEARANCE_REQUIRED:part2",
        "CLASSIFICATION_PERMISSION_REQUIRED:documents.part2.read",
        "PART2_CONSENT_VERIFICATION_REQUIRED",
      ]),
    );
  });

  it("honors record-level download and export controls after permission checks", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const part2 = registry.documents.find(
      (document) => document.classification === "part2",
    )!;
    const actor = {
      ...actors.part2Reader,
      permissions: [
        ...actors.part2Reader.permissions,
        "documents.download",
        "documents.export",
      ],
    };
    const download = evaluateM42DocumentAccess(part2, actor, "download");
    const exportDecision = evaluateM42DocumentAccess(part2, actor, "export");
    expect(download.allowed).toBe(false);
    expect(download.reasonCodes).toContain("DOCUMENT_DOWNLOAD_DISABLED");
    expect(exportDecision.allowed).toBe(false);
    expect(exportDecision.reasonCodes).toContain("DOCUMENT_EXPORT_DISABLED");
  });

  it("blocks every live disclosure and records the attempted disclosure", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const doctrine = registry.documents[0];
    const actor = {
      ...actors.enterpriseApprover,
      permissions: [...actors.enterpriseApprover.permissions, "documents.disclose"],
    };
    const decision = evaluateM42DocumentAccess(doctrine, actor, "disclose");
    expect(decision).toMatchObject({
      allowed: false,
      liveDisclosureAvailable: false,
      auditEvent: {
        eventType: "disclosure_blocked",
        outcome: "blocked",
      },
    });
    expect(decision.reasonCodes).toContain("LIVE_DISCLOSURE_UNAVAILABLE");
  });

  it("maintains an append-only access and disclosure ledger", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const decision = evaluateM42DocumentAccess(
      registry.documents[0],
      actors.enterpriseApprover,
      "content_read",
    );
    const ledger = appendM42DisclosureEvent(createM42DisclosureLedger(), decision);
    expect(ledger.events).toHaveLength(1);
    expect(validateM42DisclosureLedger(ledger)).toEqual([]);
    expect(Object.isFrozen(ledger)).toBe(true);
    expect(Object.isFrozen(ledger.events)).toBe(true);
    expect(() => appendM42DisclosureEvent(ledger, decision)).toThrow(
      "M42_DISCLOSURE_LEDGER_EVENT_DUPLICATE",
    );
  });

  it("creates a permission-trimmed manifest without content, delivery, or live writes", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const manifest = createM42SyntheticExportManifest(
      registry.documents,
      actors.exporter,
    );
    expect(manifest).toMatchObject({
      recipientDelivery: false,
      binaryContentIncluded: false,
      liveRepositoryWrite: false,
      synthetic: true,
    });
    expect(manifest.documentIds).toHaveLength(4);
    expect(manifest.deniedDocumentIds).toEqual([
      "SYNTH-DOCUMENT-EO-WORKFORCE-TRAINING",
      "SYNTH-DOCUMENT-BHC-PART2-CONSENT",
    ]);
    expect(manifest.versionIds).toHaveLength(manifest.documentIds.length);
    expect(manifest.contentHashes).toHaveLength(manifest.documentIds.length);
    expect(manifest.auditEvents.at(-1)?.eventType).toBe(
      "export_manifest_created",
    );
  });

  it("produces deterministic export and access audit identities", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const first = createM42SyntheticExportManifest(
      registry.documents,
      actors.exporter,
    );
    const second = createM42SyntheticExportManifest(
      registry.documents,
      actors.exporter,
    );
    expect(second).toEqual(first);
    expect(new Set(first.auditEvents.map((event) => event.eventId)).size).toBe(
      first.auditEvents.length,
    );
  });

  it("fails closed without a documented minimum-necessary purpose", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const actor = { ...actors.enterpriseApprover, minimumNecessaryPurpose: "" };
    const decision = evaluateM42DocumentAccess(
      registry.documents[0],
      actor,
      "metadata_read",
    );
    expect(decision.allowed).toBe(false);
    expect(decision.reasonCodes).toContain(
      "MINIMUM_NECESSARY_PURPOSE_REQUIRED",
    );
    expect(decision.metadataVisible).toBe(false);
  });

  it("exposes no live-disclosure execution path", () => {
    expect(assertM42LiveDisclosureUnavailable).toThrow(
      "M42_LIVE_DISCLOSURE_UNAVAILABLE",
    );
  });
});
