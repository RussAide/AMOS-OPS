import { describe, expect, it } from "vitest";

import { M42_NIL_ACCEPTANCE_ACCURACY } from "../../contracts/m42/search";
import {
  M42_APPROVED_NIL_CORPUS_SHA256,
  M42_APPROVED_NIL_EVALUATION_SET_SHA256,
  createFrozenM42NilCorpus,
  createFrozenM42NilEvaluationSet,
  evaluateFrozenM42NilSemanticAccuracy,
} from "../services/m42/nil-evaluation";

describe("M4.2 frozen Networked Intelligence Library evaluation", () => {
  it("uses a frozen fictional corpus and labeled top-1 evaluation set", () => {
    const corpus = createFrozenM42NilCorpus();
    const evaluationSet = createFrozenM42NilEvaluationSet();
    const result = evaluateFrozenM42NilSemanticAccuracy();

    expect(corpus).toHaveLength(16);
    expect(evaluationSet).toHaveLength(30);
    expect(new Set(evaluationSet.map(({ id }) => id)).size).toBe(30);
    expect(corpus.every(({ synthetic }) => synthetic)).toBe(true);
    expect(result).toMatchObject({
      frozen: true,
      articleCount: 16,
      labeledQueryCount: 30,
      correctTop1Count: 28,
      accuracy: 28 / 30,
      threshold: M42_NIL_ACCEPTANCE_ACCURACY,
      corpusSha256: M42_APPROVED_NIL_CORPUS_SHA256,
      corpusHashVerified: true,
      evaluationSetSha256: M42_APPROVED_NIL_EVALUATION_SET_SHA256,
      evaluationSetHashVerified: true,
      permissionTrimmedBeforeScoring: true,
      permissionTrimmedBeforeCitation: true,
      externalModelCalls: 0,
      externalWrites: 0,
      accepted: true,
    });
    expect(result.accuracy).toBeGreaterThanOrEqual(M42_NIL_ACCEPTANCE_ACCURACY);
  });

  it("reproduces the same labels and top-1 decisions", () => {
    const first = evaluateFrozenM42NilSemanticAccuracy();
    const second = evaluateFrozenM42NilSemanticAccuracy();
    const decisionProjection = (
      result: ReturnType<typeof evaluateFrozenM42NilSemanticAccuracy>,
    ) =>
      result.cases.map(
        ({ caseId, expectedDocumentId, actualTopDocumentId, correct }) => ({
          caseId,
          expectedDocumentId,
          actualTopDocumentId,
          correct,
        }),
      );

    expect(decisionProjection(second)).toEqual(decisionProjection(first));
    expect(second.corpusSha256).toBe(first.corpusSha256);
    expect(second.evaluationSetSha256).toBe(first.evaluationSetSha256);
  });
});
