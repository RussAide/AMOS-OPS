import { describe, expect, it } from "vitest";

import type { M42SearchActorContext } from "../../contracts/m42/search";
import {
  createFrozenM42NilCorpus,
  createM42NilEvaluationActor,
  searchM42Nil,
} from "../services/m42/nil-evaluation";

describe("M4.2 NIL permission boundary", () => {
  it("removes the restricted all-concept decoy before semantic scoring", () => {
    const corpus = createFrozenM42NilCorpus();
    const actor = createM42NilEvaluationActor();
    const response = searchM42Nil(
      corpus,
      actor,
      "security filtering before ranking permission trimming",
    );
    const serialized = JSON.stringify(response);

    expect(response.results[0]).toMatchObject({
      documentId: "SYN-M42-NIL-007",
      matchedConcepts: ["permission-trimming"],
      citation: {
        sourceOfTruthId: "SOT-SYN-M42-NIL-007",
        sourceVersion: "1.0",
      },
    });
    expect(response.permissionTrimmedBeforeScoring).toBe(true);
    expect(response.permissionTrimmedBeforeCitation).toBe(true);
    expect(serialized).not.toContain("SYN-M42-NIL-RESTRICTED-DECOY");
    expect(serialized).not.toContain("MATTER-NIL-RESTRICTED");
    expect(response.externalModelCalls).toBe(0);
    expect(response.externalWrites).toBe(0);
  });

  it("returns no restricted citation when the actor has no permitted segment", () => {
    const deniedActor: M42SearchActorContext = {
      ...createM42NilEvaluationActor(),
      actorId: "SYN-M42-NIL-DENIED-ACTOR",
      allowedSegmentIds: [],
    };
    const response = searchM42Nil(
      createFrozenM42NilCorpus(),
      deniedActor,
      "legal hold",
    );
    expect(response.results).toEqual([]);
  });
});
