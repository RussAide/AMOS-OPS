import { describe, expect, it } from "vitest";
import {
  createSyntheticM51aPublishingCandidates,
  evaluateM51aAuthoritativePublishing,
  selectM51aAuthoritativeGuidance,
} from "../services/m51a/operations-hub/publishing";

describe("M5.1A Hub A05 authoritative intranet publishing", () => {
  it("publishes only the two approved and current synthetic guidance records", () => {
    const result = selectM51aAuthoritativeGuidance(
      createSyntheticM51aPublishingCandidates(),
    );
    expect(result.citations).toHaveLength(2);
    expect(result.deniedObjectIds).toHaveLength(5);
    expect(result.citations.map((citation) => citation.objectId)).toEqual([
      "SYNTH-AMOS-DMS-OBJECT-POLICY-001",
      "SYNTH-AMOS-DMS-OBJECT-ARTICLE-001",
    ]);
  });

  it("preserves source transparency and accountable publication metadata", () => {
    const result = selectM51aAuthoritativeGuidance(
      createSyntheticM51aPublishingCandidates(),
    );
    for (const citation of result.citations) {
      expect(citation.sourceSystem).toBe("AMOS-DMS");
      expect(citation.sourceOfTruthUri).toMatch(/^amos-dms:\/\/synthetic\//);
      expect(citation.contentHash).toMatch(/^sha256:/);
      expect(citation.ownerRole).toBeTruthy();
      expect(citation.approverRole).toBeTruthy();
      expect(citation.effectiveAt).toBe("2026-01-01T00:00:00.000Z");
      expect(citation.reviewDueAt).toBe("2027-12-31T23:59:59.000Z");
      expect(citation.synthetic).toBe(true);
    }
  });

  it("denies draft, superseded, legacy, restricted, and overdue records for specific reasons", () => {
    const result = selectM51aAuthoritativeGuidance(
      createSyntheticM51aPublishingCandidates(),
    );
    const decision = (marker: string) =>
      result.decisions.find((item) => item.objectId.includes(marker))!;
    expect(decision("DRAFT").reasonCodes).toEqual(
      expect.arrayContaining([
        "LIFECYCLE_NOT_PUBLISHED:Draft",
        "APPROVAL_REQUIRED",
        "ACCOUNTABLE_APPROVER_REQUIRED",
      ]),
    );
    expect(decision("SUPERSEDED").reasonCodes).toContain(
      "LIFECYCLE_NOT_PUBLISHED:Superseded",
    );
    expect(decision("LEGACY").reasonCodes).toEqual(
      expect.arrayContaining([
        "PUBLISHED_INTRANET_CONTENT_LIBRARY_REQUIRED",
        "LIBRARY_NOT_AUTHORITATIVE_GUIDANCE_ELIGIBLE",
      ]),
    );
    expect(decision("PART2").reasonCodes).toContain(
      "HANDLING_CLASS_GENERAL_ROLLUP_DENIED",
    );
    expect(decision("OVERDUE").reasonCodes).toContain(
      "REVIEW_OVERDUE_OR_INVALID",
    );
  });

  it("rejects any otherwise eligible record with incomplete required metadata", () => {
    const source = createSyntheticM51aPublishingCandidates()[0];
    const corrupted = {
      ...source,
      metadata: { ...source.metadata, owner: "" },
    };
    expect(
      evaluateM51aAuthoritativePublishing(corrupted).reasonCodes,
    ).toContain("REQUIRED_PUBLISHED_METADATA_INCOMPLETE");
  });

  it("rejects physical or non-AMOS source identities", () => {
    const source = createSyntheticM51aPublishingCandidates()[0];
    const corrupted = {
      ...source,
      sourceOfTruthUri: "https://tenant.sharepoint.invalid/document.docx",
    };
    expect(
      evaluateM51aAuthoritativePublishing(corrupted).reasonCodes,
    ).toContain("AMOS_DMS_SOURCE_OF_TRUTH_REQUIRED");
  });

  it("rejects contradictory top-level and controlled metadata values", () => {
    const source = createSyntheticM51aPublishingCandidates()[0];
    const corrupted = {
      ...source,
      metadata: {
        ...source.metadata,
        lifecycle_status: "Draft",
        authoritative_record_flag: false,
        intranet_state: "review",
        owner: "SYNTH-HUMAN-DIFFERENT-OWNER",
      },
    };
    expect(
      evaluateM51aAuthoritativePublishing(corrupted).reasonCodes,
    ).toEqual(
      expect.arrayContaining([
        "PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:lifecycle_status",
        "PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:authoritative_record_flag",
        "PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:intranet_state",
        "PUBLISHED_METADATA_TOP_LEVEL_MISMATCH:owner",
      ]),
    );
    expect(
      evaluateM51aAuthoritativePublishing(corrupted)
        .authoritativeGuidanceEligible,
    ).toBe(false);
  });

  it("performs zero live Microsoft publishing or external writes", () => {
    const result = selectM51aAuthoritativeGuidance(
      createSyntheticM51aPublishingCandidates(),
    );
    expect(result.liveExternalWrites).toBe(0);
    for (const decision of result.decisions) {
      expect(decision.liveMicrosoftPublishPerformed).toBe(false);
      expect(decision.liveExternalWrites).toBe(0);
      expect(decision.synthetic).toBe(true);
    }
  });

  it("replays deterministically at the canonical evaluation instant", () => {
    const candidates = createSyntheticM51aPublishingCandidates();
    expect(selectM51aAuthoritativeGuidance(candidates)).toEqual(
      selectM51aAuthoritativeGuidance(candidates),
    );
  });
});
