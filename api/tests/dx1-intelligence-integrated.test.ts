import { describe, expect, it } from "vitest";
import {
  DX1_INTELLIGENCE_ASSERTIONS,
  runDx1IntelligencePlatformStream,
} from "../services/dx1/intelligence";

describe("DX.1 intelligence and platform stream", () => {
  it("completes criteria DX.1-03 through DX.1-07 in one deterministic stream", () => {
    const result = runDx1IntelligencePlatformStream();
    expect(result).toMatchObject({
      milestone: "DX.1",
      streamId: "intelligence-platform",
      passed: true,
      assertionCount: 29,
      liveSideEffects: 0,
      synthetic: true,
    });
    expect(result.criteria.map((candidate) => candidate.criterionId)).toEqual([
      "DX.1-03",
      "DX.1-04",
      "DX.1-05",
      "DX.1-06",
      "DX.1-07",
    ]);
    expect(
      result.criteria.every(
        (candidate) =>
          candidate.status === "Complete" &&
          candidate.assertionIds.length > 0 &&
          candidate.evidenceIds.length > 0,
      ),
    ).toBe(true);
    expect(result.boundary).toMatchObject({
      liveExternalCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      productionRows: 0,
      deployments: 0,
      githubPushes: 0,
    });
  });

  it("publishes exactly 29 unique assertion identifiers", () => {
    const assertionIds = Object.values(DX1_INTELLIGENCE_ASSERTIONS).flat();
    expect(assertionIds).toHaveLength(29);
    expect(new Set(assertionIds).size).toBe(29);
  });

  it("is byte-for-byte deterministic across repeated executions", () => {
    const first = runDx1IntelligencePlatformStream();
    const second = runDx1IntelligencePlatformStream();
    expect(second).toEqual(first);
    expect(new Set(first.auditEvents.map((event) => event.eventId)).size).toBe(
      first.auditEvents.length,
    );
  });
});
