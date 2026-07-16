import { describe, expect, it } from "vitest";
import type { M42VersionLedger } from "@contracts/m42/records";
import {
  createSyntheticM42DocumentRegistry,
  createSyntheticM42RecordsActors,
} from "../services/m42/document-governance";
import {
  checkinM42Document,
  checkoutM42Document,
  createM42VersionLedger,
  decideM42VersionApproval,
  linkM42DocumentSupersession,
  publishM42ApprovedVersion,
  submitM42VersionForApproval,
  validateM42VersionLedger,
} from "../services/m42/document-versioning";

function createCheckedInLedger(): M42VersionLedger {
  const registry = createSyntheticM42DocumentRegistry();
  const actors = createSyntheticM42RecordsActors();
  const document = registry.documents.find(
    (candidate) =>
      candidate.documentId === "SYNTH-DOCUMENT-GAD-CAMPUS-SAFETY",
  )!;
  const ledger = createM42VersionLedger(document);
  const checkout = checkoutM42Document(
    ledger,
    actors.facilitiesEditor,
    document.currentVersionId,
    "2026-12-15T08:00:00.000Z",
  );
  return checkinM42Document(checkout.ledger, {
    actor: actors.facilitiesEditor,
    lockId: checkout.lock.lockId,
    expectedBaseVersionId: document.currentVersionId,
    contentHash: "sha256:synth-campus-safety-1-1",
    changeSummary: "Clarify the synthetic campus response sequence.",
    checkedInAt: "2026-12-15T09:00:00.000Z",
  }).ledger;
}

function createApprovedLedger(): M42VersionLedger {
  const actors = createSyntheticM42RecordsActors();
  let ledger = submitM42VersionForApproval(
    createCheckedInLedger(),
    actors.facilitiesEditor,
    ["administrator", "hr-compliance-officer"],
    "2026-12-15T09:05:00.000Z",
  );
  ledger = decideM42VersionApproval(
    ledger,
    actors.enterpriseApprover,
    "approved",
    "Synthetic record identity and version controls verified.",
    "2026-12-15T09:10:00.000Z",
  );
  return decideM42VersionApproval(
    ledger,
    actors.complianceApprover,
    "approved",
    "Synthetic compliance review completed.",
    "2026-12-15T09:15:00.000Z",
  );
}

describe("M4.2-03 version, conflict, approval, and source-of-truth controls", () => {
  it("creates a valid append-only version ledger from the published source of truth", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const document = registry.documents[1];
    const ledger = createM42VersionLedger(document);
    expect(ledger).toMatchObject({
      appendOnlyHistory: true,
      synthetic: true,
      document: { currentVersion: "1.0" },
    });
    expect(ledger.versions).toHaveLength(1);
    expect(ledger.versions[0]).toMatchObject({
      versionId: document.currentVersionId,
      status: "published",
      immutableAfterPublish: true,
      contentHash: document.sourceOfTruth.contentHash,
    });
    expect(validateM42VersionLedger(ledger)).toEqual([]);
  });

  it("checks out the exact current version with an expiring exclusive lock", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const document = registry.documents[1];
    const first = checkoutM42Document(
      createM42VersionLedger(document),
      actors.facilitiesEditor,
      document.currentVersionId,
      "2026-12-15T08:00:00.000Z",
    );
    const second = checkoutM42Document(
      createM42VersionLedger(document),
      actors.facilitiesEditor,
      document.currentVersionId,
      "2026-12-15T08:00:00.000Z",
    );
    expect(second).toEqual(first);
    expect(first.lock).toMatchObject({
      documentId: document.documentId,
      versionId: document.currentVersionId,
      checkedOutBy: actors.facilitiesEditor.actorId,
      expiresAt: "2026-12-15T10:00:00.000Z",
      active: true,
      releasedAt: null,
    });
  });

  it("rejects stale-version checkout and concurrent active checkout", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const document = registry.documents[1];
    const ledger = createM42VersionLedger(document);
    expect(() =>
      checkoutM42Document(
        ledger,
        actors.facilitiesEditor,
        "SYNTH-STALE-VERSION",
      ),
    ).toThrow("M42_OPTIMISTIC_VERSION_CONFLICT");
    const first = checkoutM42Document(
      ledger,
      actors.facilitiesEditor,
      document.currentVersionId,
    );
    expect(() =>
      checkoutM42Document(
        first.ledger,
        actors.facilitiesEditor,
        document.currentVersionId,
      ),
    ).toThrow("M42_DOCUMENT_ALREADY_CHECKED_OUT");
  });

  it("checks in a new draft while preserving the published version and releasing the lock", () => {
    const ledger = createCheckedInLedger();
    expect(ledger.versions).toHaveLength(2);
    expect(ledger.versions[0]).toMatchObject({
      version: "1.0",
      status: "published",
      immutableAfterPublish: true,
    });
    expect(ledger.versions[1]).toMatchObject({
      version: "1.1",
      status: "draft",
      baseVersionId: ledger.document.currentVersionId,
      contentHash: "sha256:synth-campus-safety-1-1",
      immutableAfterPublish: false,
    });
    expect(ledger.locks[0]).toMatchObject({
      active: false,
      releasedAt: "2026-12-15T09:00:00.000Z",
    });
    expect(ledger.auditEvents.at(-1)?.eventType).toBe("version_created");
    expect(validateM42VersionLedger(ledger)).toEqual([]);
  });

  it("requires the lock owner, a live lock, changed content, and the exact base version", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const document = registry.documents[1];
    const checkout = checkoutM42Document(
      createM42VersionLedger(document),
      actors.facilitiesEditor,
      document.currentVersionId,
      "2026-12-15T08:00:00.000Z",
    );
    const base = {
      actor: actors.facilitiesEditor,
      lockId: checkout.lock.lockId,
      expectedBaseVersionId: document.currentVersionId,
      contentHash: "sha256:synth-campus-safety-1-1",
      changeSummary: "Synthetic change.",
      checkedInAt: "2026-12-15T09:00:00.000Z",
    };
    expect(() =>
      checkinM42Document(checkout.ledger, {
        ...base,
        actor: actors.enterpriseApprover,
      }),
    ).toThrow("M42_CHECKOUT_LOCK_OWNER_REQUIRED");
    expect(() =>
      checkinM42Document(checkout.ledger, {
        ...base,
        expectedBaseVersionId: "SYNTH-STALE-VERSION",
      }),
    ).toThrow("M42_OPTIMISTIC_VERSION_CONFLICT");
    expect(() =>
      checkinM42Document(checkout.ledger, {
        ...base,
        contentHash: document.sourceOfTruth.contentHash,
      }),
    ).toThrow("M42_CONTENT_HASH_UNCHANGED");
    expect(() =>
      checkinM42Document(checkout.ledger, {
        ...base,
        checkedInAt: "2026-12-15T10:00:00.000Z",
      }),
    ).toThrow("M42_CHECKOUT_LOCK_EXPIRED");
  });

  it("uses ordered human approval with author-approver separation", () => {
    const actors = createSyntheticM42RecordsActors();
    const inReview = submitM42VersionForApproval(
      createCheckedInLedger(),
      actors.facilitiesEditor,
      ["administrator", "hr-compliance-officer"],
    );
    expect(inReview.versions.at(-1)).toMatchObject({
      status: "in_review",
      approvalRoute: { status: "pending" },
    });
    expect(() =>
      decideM42VersionApproval(
        inReview,
        actors.complianceApprover,
        "approved",
        "Out-of-order attempt.",
      ),
    ).toThrow("M42_SEQUENTIAL_APPROVER_ROLE_MISMATCH");
    const authorAsApprover = {
      ...actors.facilitiesEditor,
      role: "administrator" as const,
      permissions: [...actors.facilitiesEditor.permissions, "documents.approve"],
    };
    expect(() =>
      decideM42VersionApproval(
        inReview,
        authorAsApprover,
        "approved",
        "Self-approval attempt.",
      ),
    ).toThrow("M42_APPROVAL_SEPARATION_OF_DUTIES_REQUIRED");
  });

  it("publishes only a fully approved version and preserves superseded history", () => {
    const actors = createSyntheticM42RecordsActors();
    const approved = createApprovedLedger();
    expect(approved.versions.at(-1)).toMatchObject({
      version: "1.1",
      status: "approved",
      approvalRoute: { status: "approved" },
    });
    const published = publishM42ApprovedVersion(
      approved,
      actors.enterpriseApprover,
      "2026-12-15T09:20:00.000Z",
    );
    expect(published.versions.map((version) => version.status)).toEqual([
      "superseded",
      "published",
    ]);
    expect(published.versions.every((version) => version.immutableAfterPublish)).toBe(
      true,
    );
    expect(published.document).toMatchObject({
      currentVersion: "1.1",
      currentVersionId: published.versions[1].versionId,
      lifecycleState: "published",
      sourceOfTruth: {
        currentVersionId: published.versions[1].versionId,
        contentHash: "sha256:synth-campus-safety-1-1",
      },
    });
    expect(validateM42VersionLedger(published)).toEqual([]);
  });

  it("does not publish a draft or partially approved version", () => {
    const actors = createSyntheticM42RecordsActors();
    expect(() =>
      publishM42ApprovedVersion(createCheckedInLedger(), actors.enterpriseApprover),
    ).toThrow("M42_APPROVED_VERSION_REQUIRED");
    let ledger = submitM42VersionForApproval(
      createCheckedInLedger(),
      actors.facilitiesEditor,
      ["administrator", "hr-compliance-officer"],
    );
    ledger = decideM42VersionApproval(
      ledger,
      actors.enterpriseApprover,
      "approved",
      "First approval only.",
    );
    expect(() =>
      publishM42ApprovedVersion(ledger, actors.enterpriseApprover),
    ).toThrow("M42_APPROVED_VERSION_REQUIRED");
  });

  it("records bidirectional supersession while preserving stable source identities", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const linked = linkM42DocumentSupersession(
      registry.documents[0],
      registry.documents[1],
      actors.recordsOwner,
    );
    expect(linked.prior).toMatchObject({
      lifecycleState: "superseded",
      sourceOfTruth: {
        supersededByStableObjectId: registry.documents[1].stableObjectId,
      },
    });
    expect(linked.replacement.sourceOfTruth.supersedesStableObjectId).toBe(
      registry.documents[0].stableObjectId,
    );
    expect(linked.auditEvent).toMatchObject({
      eventType: "record_superseded",
      outcome: "recorded",
      sourceIds: [
        registry.documents[0].stableObjectId,
        registry.documents[1].stableObjectId,
      ],
    });
  });

  it("rejects self-supersession and detects broken version lineage", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    expect(() =>
      linkM42DocumentSupersession(
        registry.documents[0],
        registry.documents[0],
        actors.recordsOwner,
      ),
    ).toThrow("M42_SUPERSESSION_REPLACEMENT_MUST_BE_DISTINCT");
    const ledger = createCheckedInLedger();
    const corrupted = {
      ...ledger,
      versions: [
        ledger.versions[0],
        { ...ledger.versions[1], baseVersionId: "SYNTH-MISSING-BASE" },
      ],
    };
    expect(validateM42VersionLedger(corrupted)).toContain(
      `VERSION_BASE_MISSING:${ledger.versions[1].versionId}`,
    );
  });
});
