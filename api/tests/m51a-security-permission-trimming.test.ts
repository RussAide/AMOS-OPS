import { describe, expect, it } from "vitest";
import {
  createM51aSecurityResources,
  projectM51aSecuritySearch,
  runM51aSecurityEvaluation,
} from "../services/m51a/pilot/security-evaluation";

describe("M5.1A permission-trimmed search and AI safety", () => {
  it("returns only authorized resource identifiers and never discloses denied identifiers", () => {
    const result = runM51aSecurityEvaluation();
    const gro = result.actors.find((candidate) => candidate.role === "shift-supervisor")!;
    const projection = projectM51aSecuritySearch(gro);
    expect(projection.visibleResourceIds).toContain(
      "SYNTH-M51A-RESOURCE-ENTERPRISE-GENERAL",
    );
    expect(projection.visibleResourceIds).toContain(
      "SYNTH-M51A-RESOURCE-GRO-CONTROLLED",
    );
    expect(projection.visibleResourceIds).not.toContain(
      "SYNTH-M51A-RESOURCE-BHC-RESTRICTED",
    );
    expect(projection.visibleResourceIds).not.toContain(
      "SYNTH-M51A-RESOURCE-HR365-EXCLUDED",
    );
    expect(projection.visibleResourceIds).not.toContain(
      "SYNTH-M51A-RESOURCE-WITHDRAWN-GUIDANCE",
    );
    expect(projection).toMatchObject({
      deniedResourceIdsDisclosed: false,
      permissionTrimmedBeforeRanking: true,
      duplicateResults: 0,
      staleOrWithdrawnResults: 0,
      excludedResults: 0,
    });
  });

  it("exposes Part 2 repository metadata only to entitled roles", () => {
    const result = runM51aSecurityEvaluation();
    const managingDirector = result.actors.find(
      (candidate) => candidate.role === "managing-director",
    )!;
    const facilities = result.actors.find(
      (candidate) => candidate.role === "facilities-manager",
    )!;
    expect(projectM51aSecuritySearch(managingDirector).metadataOnlyResourceIds).toEqual([
      "SYNTH-M51A-RESOURCE-BHC-RESTRICTED",
      "SYNTH-M51A-RESOURCE-PART2-METADATA-ONLY",
    ]);
    expect(projectM51aSecuritySearch(facilities).metadataOnlyResourceIds).toEqual([]);
  });

  it("records zero unsafe AI, connector-mode, stale, live-write, or permission-leak decisions", () => {
    const result = runM51aSecurityEvaluation();
    expect(result).toMatchObject({
      metadataOnlyViolations: 0,
      excludedModeViolations: 0,
      staleSuppressionViolations: 0,
      unauthorizedAiRetrievalViolations: 0,
      liveWriteViolations: 0,
      permissionLeakViolations: 0,
      dlpDecisionViolations: 0,
      productionRows: 0,
      liveWrites: 0,
      realDataUsed: false,
      accepted: true,
    });
    expect(
      result.decisions
        .filter((decision) => decision.action === "write")
        .every((decision) => !decision.allowed && !decision.liveWritePerformed),
    ).toBe(true);
    expect(
      result.decisions
        .filter(
          (decision) =>
            decision.action === "ai_retrieve" && !decision.allowed,
        )
        .every((decision) => decision.disclosedResourceId === null),
    ).toBe(true);
  });

  it("deduplicates visible search results and reports the computed duplicate count", () => {
    const evaluation = runM51aSecurityEvaluation();
    const managingDirector = evaluation.actors.find(
      (candidate) => candidate.role === "managing-director",
    )!;
    const resources = createM51aSecurityResources();
    const projection = projectM51aSecuritySearch(managingDirector, [
      ...resources,
      resources[0]!,
    ]);
    expect(projection.duplicateResults).toBe(1);
    expect(
      projection.visibleResourceIds.filter(
        (id) => id === resources[0]!.resourceId,
      ),
    ).toHaveLength(1);
  });

  it("records an explicit coherent DLP verdict for every decision", () => {
    const result = runM51aSecurityEvaluation();
    expect(result.dlpDecisionViolations).toBe(0);
    expect(result.decisions.every((decision) => decision.dlpPolicyApplied)).toBe(
      true,
    );
    expect(
      result.decisions.every((decision) =>
        decision.allowed
          ? decision.projection === "metadata_only"
            ? decision.dlpDecision === "metadata_only"
            : decision.dlpDecision === "allow_controlled"
          : decision.dlpDecision === "block",
      ),
    ).toBe(true);
  });

  it("keeps all evidence inside the synthetic no-Microsoft-write boundary", () => {
    const result = runM51aSecurityEvaluation();
    expect(result.boundary).toMatchObject({
      syntheticOnly: true,
      realDataUsed: false,
      realFileContentRead: false,
      productionRows: 0,
      liveWrites: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      liveSiteProvisioning: false,
      liveConnectorMutation: false,
      restrictedRecordMigration: false,
      productionDeployment: false,
      githubPush: false,
    });
    expect(result.auditEvents.length).toBeGreaterThan(0);
    expect(
      result.auditEvents.every(
        (event) => event.immutable && event.evidenceClass.includes("synthetic"),
      ),
    ).toBe(true);
  });
});
