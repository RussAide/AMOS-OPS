import { describe, expect, it } from "vitest";
import {
  DX1_CRITERION_IDS,
  DX1_SCENARIO_ID,
  assembleDx1IntegratedScenario,
  createDx1PrototypeBoundary,
  runDx1IntegratedScenario,
  type Dx1CriterionId,
  type Dx1StreamResult,
} from "../services/dx1";

const STREAM_CRITERIA: Readonly<
  Record<Dx1StreamResult["streamId"], readonly Dx1CriterionId[]>
> = {
  "experience-governance": [
    "DX.1-01",
    "DX.1-02",
    "DX.1-09",
    "DX.1-11",
    "DX.1-12",
  ],
  "intelligence-platform": [
    "DX.1-03",
    "DX.1-04",
    "DX.1-05",
    "DX.1-06",
    "DX.1-07",
  ],
  "security-pilot": ["DX.1-08", "DX.1-10"],
};

function stream(streamId: Dx1StreamResult["streamId"]): Dx1StreamResult {
  const criteria = STREAM_CRITERIA[streamId].map((criterionId, index) => ({
    criterionId,
    status: "Complete" as const,
    assertionIds: [`ASSERT-${criterionId}`],
    evidenceIds: [`EVIDENCE-${criterionId}`],
    summary: `${criterionId} complete`,
    index,
  }));
  return {
    streamId,
    passed: true,
    assertionCount: criteria.length,
    criteria,
    auditEvents: [
      {
        eventId: `EVENT-${streamId}`,
        scenarioId: DX1_SCENARIO_ID,
        stageId: "cross-enterprise",
        actorId: `SYNTH-ACTOR-${streamId}`,
        actorRole: "synthetic-reviewer",
        action: "verify-stream",
        outcome: "completed",
        reason: "deterministic synthetic verification",
        evidenceIds: [`EVIDENCE-${streamId}`],
        occurredAt: "2026-07-15T18:00:00.000Z",
        synthetic: true,
      },
    ],
    boundary: createDx1PrototypeBoundary(),
  };
}

describe("DX.1 integrated scenario assembly", () => {
  it("accepts the actual three-stream enterprise evaluation", () => {
    const result = runDx1IntegratedScenario();
    expect(result.acceptance).toBe("ACCEPTED");
    expect(result.assertionCount).toBe(96);
    expect(result.criteria).toHaveLength(12);
    expect(result.criteria.every((criterion) => criterion.status === "Complete")).toBe(
      true,
    );
    expect(new Set(result.auditEvents.map((event) => event.eventId)).size).toBe(
      result.auditEvents.length,
    );
    expect(result.boundary).toEqual(createDx1PrototypeBoundary());
  });

  it("accepts exactly three complete disjoint streams", () => {
    const result = assembleDx1IntegratedScenario({
      experience: stream("experience-governance"),
      intelligence: stream("intelligence-platform"),
      pilot: stream("security-pilot"),
    });
    expect(result.accepted).toBe(true);
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual(
      DX1_CRITERION_IDS,
    );
    expect(result.assertionCount).toBe(20);
    expect(result.auditEvents).toHaveLength(3);
  });

  it("rejects missing or duplicated stream criterion ownership", () => {
    const experience = stream("experience-governance");
    const invalid = {
      ...experience,
      criteria: [...experience.criteria, experience.criteria[0]!],
    };
    expect(() =>
      assembleDx1IntegratedScenario({
        experience: invalid,
        intelligence: stream("intelligence-platform"),
        pilot: stream("security-pilot"),
      }),
    ).toThrow("DX1_STREAM_CRITERIA_MISMATCH");
  });

  it("rejects any nonzero live-system boundary counter", () => {
    const intelligence = stream("intelligence-platform");
    const invalid = {
      ...intelligence,
      boundary: { ...intelligence.boundary, liveMicrosoftWrites: 1 as 0 },
    };
    expect(() =>
      assembleDx1IntegratedScenario({
        experience: stream("experience-governance"),
        intelligence: invalid,
        pilot: stream("security-pilot"),
      }),
    ).toThrow("DX1_ZERO_LIVE_BOUNDARY_VIOLATION:liveMicrosoftWrites");
  });

  it("does not accept a criterion without reproducible evidence", () => {
    const pilot = stream("security-pilot");
    const invalid = {
      ...pilot,
      criteria: pilot.criteria.map((criterion, index) =>
        index === 0 ? { ...criterion, evidenceIds: [] } : criterion,
      ),
    };
    const result = assembleDx1IntegratedScenario({
      experience: stream("experience-governance"),
      intelligence: stream("intelligence-platform"),
      pilot: invalid,
    });
    expect(result.accepted).toBe(false);
    expect(result.acceptance).toBe("NOT_ACCEPTED");
  });
});
