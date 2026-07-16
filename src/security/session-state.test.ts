import { describe, expect, it } from "vitest";
import { shouldInvalidateSession } from "./session-state";

describe("client session revalidation", () => {
  it("clears a revoked, expired, or rejected server session", () => {
    expect(
      shouldInvalidateSession({
        hasToken: true,
        evaluationSession: false,
        isFetched: true,
        isError: false,
        hasVerifiedUser: false,
      }),
    ).toBe(true);
  });

  it("fails closed after a completed revalidation error", () => {
    expect(
      shouldInvalidateSession({
        hasToken: true,
        evaluationSession: false,
        isFetched: true,
        isError: true,
        hasVerifiedUser: true,
      }),
    ).toBe(true);
  });

  it("does not invalidate before the first check or during synthetic evaluation", () => {
    expect(
      shouldInvalidateSession({
        hasToken: true,
        evaluationSession: false,
        isFetched: false,
        isError: false,
        hasVerifiedUser: false,
      }),
    ).toBe(false);
    expect(
      shouldInvalidateSession({
        hasToken: true,
        evaluationSession: true,
        isFetched: true,
        isError: false,
        hasVerifiedUser: false,
      }),
    ).toBe(false);
  });
});
