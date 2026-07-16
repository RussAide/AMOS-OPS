import { describe, expect, it } from "vitest";
import {
  buildM51AActorContext,
  createM51AExperienceSnapshot,
} from "../../../api/services/m51a";
import {
  m51aAcceptanceCounts,
  type M51AAcceptancePresentation,
} from "./m51a-experience-model";

function eightCriteria(
  passed = true,
): M51AAcceptancePresentation {
  return {
    accepted: passed,
    acceptanceFlags: Array.from({ length: 8 }, (_, index) => ({
      criterionId: `M5.1A-AC-${String(index + 1).padStart(2, "0")}`,
      passed,
      assertionCount: index + 1,
      summary: `Synthetic acceptance criterion ${index + 1}`,
      evidenceIds: [`SYNTH-M51A-EVIDENCE-${index + 1}`],
    })),
  };
}

describe("M5.1A experience model", () => {
  it("defaults to the exact eight-control milestone display before a result exists", () => {
    expect(m51aAcceptanceCounts(null)).toEqual({ passed: 0, total: 8 });
  });

  it("counts only passed controls from the acceptance result supplied by the API", () => {
    const result = eightCriteria();
    expect(m51aAcceptanceCounts(result)).toEqual({ passed: 8, total: 8 });

    const reviewRequired: M51AAcceptancePresentation = {
      ...result,
      accepted: false,
      acceptanceFlags: result.acceptanceFlags.map((criterion, index) => ({
        ...criterion,
        passed: index < 6,
      })),
    };
    expect(m51aAcceptanceCounts(reviewRequired)).toEqual({
      passed: 6,
      total: 8,
    });
  });

  it("preserves server-side role trimming in the API snapshot shape", () => {
    const executive = createM51AExperienceSnapshot(
      buildM51AActorContext("managing-director"),
    );
    const facilities = createM51AExperienceSnapshot(
      buildM51AActorContext("facilities-manager"),
    );

    expect(executive.viewer).toMatchObject({
      role: "managing-director",
      tier: "T1",
      canReviewArchitecture: true,
      canExecutePilot: true,
      canViewRegistry: true,
    });
    expect(executive.connectors.repositoryDetailsTrimmed).toBe(false);
    expect(executive.connectors.repositories).toHaveLength(
      executive.connectors.inventory.repositoryCount,
    );

    expect(facilities.viewer).toMatchObject({
      role: "facilities-manager",
      tier: "T3",
      canReviewArchitecture: false,
      canExecutePilot: false,
      canViewRegistry: false,
    });
    expect(facilities.connectors.repositoryDetailsTrimmed).toBe(true);
    expect(facilities.connectors.repositories).toEqual([]);
    expect(facilities.connectors.inventory.repositoryCount).toBe(
      executive.connectors.inventory.repositoryCount,
    );
    expect(facilities.hub.deniedRouteCount).toBeGreaterThan(0);
  });
});
