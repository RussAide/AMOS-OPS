import { describe, expect, it } from "vitest";
import { M41B_CADENCES } from "@contracts/m41b";
import { runM41bIntegratedScenario } from "../services/m41b";

describe("M4.1B integrated operational acceptance", () => {
  it("passes all ten controlling criteria with complete synthetic evidence", () => {
    const result = runM41bIntegratedScenario();
    expect(result.exitGate).toBe(true);
    expect(result.criteria).toHaveLength(10);
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(result.workplans).toHaveLength(36);
    expect(result.productionActionsBlocked).toBe(true);
    expect(result.evidenceClass).toBe("synthetic_demo");
    expect(result.requests).toHaveLength(result.guidance.length);
    expect(
      result.requests.every(
        (request) =>
          request.prompt.length > 0 &&
          request.roleContext.evidenceClass === "synthetic_demo",
      ),
    ).toBe(true);
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual(
      Array.from({ length: 10 }, (_, index) =>
        `M4.1B-${String(index + 1).padStart(2, "0")}`,
      ),
    );
  });

  it("keeps every role on all five cadences and every recommendation fully traceable", () => {
    const result = runM41bIntegratedScenario();
    for (const workplan of result.workplans) {
      expect(Object.keys(workplan.briefs)).toEqual([...M41B_CADENCES]);
      expect(
        M41B_CADENCES.every(
          (cadence) => workplan.briefs[cadence].items.length > 0,
        ),
      ).toBe(true);
    }
    const tasks = result.workplans.flatMap((workplan) =>
      M41B_CADENCES.flatMap((cadence) => workplan.briefs[cadence].items),
    );
    for (const recommendation of result.recommendations) {
      expect(recommendation.humanDecisionId).not.toBeNull();
      expect(recommendation.downstreamTaskId).not.toBeNull();
      const task = tasks.find(
        (candidate) => candidate.id === recommendation.downstreamTaskId,
      );
      expect(task).toMatchObject({
        recommendationId: recommendation.id,
        status: "completed",
      });
      expect(task?.completionEvidenceIds.length).toBeGreaterThan(0);
    }
  });

  it("records required refusals and an accountable escalation without leaking production action", () => {
    const result = runM41bIntegratedScenario();
    const refusalCodes = new Set(
      result.guidance.flatMap((response) =>
        response.refusalCode ? [response.refusalCode] : [],
      ),
    );
    expect(refusalCodes).toEqual(
      expect.objectContaining(
        new Set([
          "M41B_SOURCE_UNAVAILABLE",
          "M41B_SOURCE_CONTRADICTORY",
          "M41B_SOURCE_PERMISSION_DENIED",
          "M41B_CROSS_DIVISION_ACCESS_DENIED",
          "M41B_MODEL_ONLY_ACTION_DENIED",
          "M41B_PRODUCTION_ACTION_BLOCKED",
          "M41B_ACTION_NOT_DELEGATED",
          "M41B_STALE_SOURCE_ACTION_DENIED",
        ]),
      ),
    );
    expect(
      result.auditEvents.some((event) => event.eventType === "task_escalated"),
    ).toBe(true);
    expect(result.guidance.every((response) => response.evidenceClass === "synthetic_demo")).toBe(true);
    expect(result.silentClosureControl).toMatchObject({
      evidenceCount: 0,
      blocked: true,
      observedCode: "M41B_TASK_COMPLETION_EVIDENCE_REQUIRED",
    });
    expect(
      result.criteria
        .find((criterion) => criterion.criterionId === "M4.1B-08")
        ?.evidenceIds,
    ).toContain(result.silentClosureControl.attemptId);
  });

  it("carries an accountable override reason through decision and immutable audit evidence", () => {
    const result = runM41bIntegratedScenario();
    const override = result.decisions.find(
      (decision) => decision.disposition === "override",
    );
    expect(override?.overrideReason).toContain("SYNTH legal planning exception");
    expect(
      result.auditEvents.some(
        (event) =>
          event.eventType === "human_disposition_recorded" &&
          event.entityId === override?.id &&
          event.after?.overrideReason === override?.overrideReason,
      ),
    ).toBe(true);
    expect(
      result.criteria.find((criterion) => criterion.criterionId === "M4.1B-09")
        ?.passed,
    ).toBe(true);
  });
});
