import { describe, expect, it } from "vitest";
import { evaluateQuizCompletion } from "./quiz-engine-state";

describe("TA.1 quiz completion", () => {
  it("reports a pass when the final score meets the approved threshold", () => {
    expect(evaluateQuizCompletion(4, 5, 80)).toEqual({
      score: 4,
      passed: true,
    });
  });

  it("does not report a pass below the approved threshold", () => {
    expect(evaluateQuizCompletion(3, 5, 80)).toEqual({
      score: 3,
      passed: false,
    });
  });
});
