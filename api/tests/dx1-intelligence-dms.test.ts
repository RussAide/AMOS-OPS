import { describe, expect, it } from "vitest";
import {
  createSyntheticM42DocumentRegistry,
  createSyntheticM42RecordsActors,
  decideM42DocumentApproval,
  requestM42DocumentApproval,
} from "../services/m42";
import {
  DX1_DMS_ACTIONS,
  runDx1DmsVerification,
} from "../services/dx1/intelligence";

describe("DX.1 governed DMS lifecycle verification", () => {
  it("demonstrates all eight required actions with zero live repository writes", () => {
    const result = runDx1DmsVerification();
    expect(result.accepted).toBe(true);
    expect(result.actions.map((candidate) => candidate.action)).toEqual(
      DX1_DMS_ACTIONS,
    );
    expect(result.actions.every((candidate) => candidate.passed)).toBe(true);
    expect(result.packet).toMatchObject({
      orphanedDocumentIds: [],
      synthetic: true,
    });
    expect(result.liveRepositoryWrites).toBe(0);
    expect(result.productionRepositoryConnected).toBe(false);
    expect(result.auditEvents).toHaveLength(8);
  });

  it("uses version-specific packet and manifest evidence without binary delivery", () => {
    const result = runDx1DmsVerification();
    expect(result.packet.documentIds).toHaveLength(3);
    expect(result.packet.versionIds).toHaveLength(3);
    expect(result.versionCreated).toContain("V1-1");
    expect(result.exportManifestId).toMatch(/^SYNTH-/);
    expect(result.archivedDocumentId).toMatch(/^SYNTH-DOCUMENT-/);
  });

  it("retains M4.2 separation of duties instead of allowing self-approval", () => {
    const registry = createSyntheticM42DocumentRegistry();
    const actors = createSyntheticM42RecordsActors();
    const source = registry.documents[0]!;
    const requested = requestM42DocumentApproval(
      { ...source, lifecycleState: "draft", approvalRoute: null },
      actors.recordsOwner,
      ["administrator"],
      "2026-12-15T11:00:00.000Z",
    );
    expect(() =>
      decideM42DocumentApproval(
        requested.document,
        actors.recordsOwner,
        "approved",
        "Attempted synthetic self-approval.",
        "2026-12-15T11:01:00.000Z",
      ),
    ).toThrow("M42_APPROVAL_SEPARATION_OF_DUTIES_REQUIRED");
  });
});
