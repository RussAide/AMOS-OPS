import { describe, expect, it } from "vitest";
import {
  createM51aSecurityResources,
  evaluateM51aSecurityAction,
  runM51aSecurityEvaluation,
} from "../services/m51a/pilot/security-evaluation";

describe("M5.1A T1-T4 and divisional security evaluation", () => {
  it("evaluates all 36 canonical roles across all four tiers and divisions", () => {
    const result = runM51aSecurityEvaluation();
    expect(result.rolesEvaluated).toBe(36);
    expect(result.tiersEvaluated).toEqual(["T1", "T2", "T3", "T4"]);
    expect(result.divisionsEvaluated).toEqual(["bhc", "eo", "gad", "gro"]);
    expect(result.resources).toHaveLength(6);
    expect(result.decisionCount).toBe(36 * 6 * 5);
    expect(result.accepted).toBe(true);
  });

  it("allows enterprise leadership to see authorized active references but never perform a live write", () => {
    const result = runM51aSecurityEvaluation();
    const actor = result.actors.find((candidate) => candidate.role === "managing-director")!;
    const general = result.resources.find((resource) =>
      resource.resourceId.endsWith("ENTERPRISE-GENERAL"),
    )!;
    expect(evaluateM51aSecurityAction(actor, general, "content_read")).toMatchObject({
      allowed: true,
      projection: "full",
      disclosedResourceId: general.resourceId,
    });
    expect(evaluateM51aSecurityAction(actor, general, "write")).toMatchObject({
      allowed: false,
      projection: "none",
      disclosedResourceId: null,
      liveWritePerformed: false,
    });
  });

  it("applies division and handling restrictions before retrieval", () => {
    const result = runM51aSecurityEvaluation();
    const groSupervisor = result.actors.find(
      (candidate) => candidate.role === "shift-supervisor",
    )!;
    const bhcSupervisor = result.actors.find(
      (candidate) => candidate.role === "clinical-supervisor",
    )!;
    const gro = result.resources.find((resource) =>
      resource.resourceId.endsWith("GRO-CONTROLLED"),
    )!;
    expect(evaluateM51aSecurityAction(groSupervisor, gro, "content_read")).toMatchObject({
      allowed: true,
      scopeAuthorized: true,
      permissionTrimmedBeforeRetrieval: true,
    });
    expect(evaluateM51aSecurityAction(bhcSupervisor, gro, "content_read")).toMatchObject({
      allowed: false,
      scopeAuthorized: false,
      disclosedResourceId: null,
      permissionTrimmedBeforeRetrieval: true,
    });
  });

  it("enforces metadata-only and excluded/system-managed connector modes", () => {
    const result = runM51aSecurityEvaluation();
    const actor = result.actors.find((candidate) => candidate.role === "managing-director")!;
    const part2 = result.resources.find((resource) =>
      resource.resourceId.endsWith("PART2-METADATA-ONLY"),
    )!;
    const excluded = result.resources.find((resource) =>
      resource.resourceId.endsWith("HR365-EXCLUDED"),
    )!;
    expect(evaluateM51aSecurityAction(actor, part2, "search")).toMatchObject({
      allowed: true,
      projection: "metadata_only",
    });
    for (const action of ["content_read", "write", "ai_retrieve"] as const)
      expect(evaluateM51aSecurityAction(actor, part2, action)).toMatchObject({
        allowed: false,
        disclosedResourceId: null,
      });
    for (const action of [
      "search",
      "metadata_read",
      "content_read",
      "write",
      "ai_retrieve",
    ] as const)
      expect(evaluateM51aSecurityAction(actor, excluded, action).allowed).toBe(false);
  });

  it("suppresses stale or withdrawn material from search, content, and AI retrieval", () => {
    const result = runM51aSecurityEvaluation();
    const actor = result.actors.find((candidate) => candidate.role === "managing-director")!;
    const withdrawn = createM51aSecurityResources().find((resource) =>
      resource.resourceId.endsWith("WITHDRAWN-GUIDANCE"),
    )!;
    for (const action of ["search", "content_read", "ai_retrieve"] as const)
      expect(evaluateM51aSecurityAction(actor, withdrawn, action)).toMatchObject({
        allowed: false,
        staleOrWithdrawnSuppressed: true,
        disclosedResourceId: null,
      });
    expect(evaluateM51aSecurityAction(actor, withdrawn, "metadata_read").allowed).toBe(true);
  });
});
