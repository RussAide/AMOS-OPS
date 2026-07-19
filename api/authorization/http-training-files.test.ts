import { describe, expect, it } from "vitest";
import type { IdentityUser } from "../security/identity";
import {
  enforceTrainingFileBoundary,
  type HttpAuthorizationResult,
} from "./http";

function allowed(dataScope: "training" | "operational") {
  const user: IdentityUser = {
    id: "synthetic-user",
    email: "synthetic.user@example.invalid",
    firstName: "Synthetic",
    lastName: "User",
    name: "Synthetic User",
    role: "training-coordinator",
    department: "Human Resources",
    mfaEnabled: true,
    accessStatus: dataScope === "training" ? "training" : "cleared",
    identityType: "workforce",
    trainingAccess: true,
    sponsorName: "Synthetic Sponsor",
    accessExpiresAt: "2026-07-31T00:00:00.000Z",
    dataScope,
  };
  return { allowed: true, status: 200, user } satisfies HttpAuthorizationResult;
}

describe("TA.1 Training file boundary", () => {
  it("denies an otherwise authorized Training upload or download before file IO", () => {
    expect(enforceTrainingFileBoundary(allowed("training"))).toEqual({
      allowed: false,
      status: 403,
      code: "FORBIDDEN",
      reason:
        "File upload and download are disabled in the Training workspace.",
    });
  });

  it("preserves the existing authorization result for Operational scope", () => {
    expect(enforceTrainingFileBoundary(allowed("operational"))).toMatchObject({
      allowed: true,
      status: 200,
      user: { dataScope: "operational" },
    });
  });

  it("preserves an earlier authentication or authorization denial", () => {
    const denied: HttpAuthorizationResult = {
      allowed: false,
      status: 401,
      code: "UNAUTHORIZED",
      reason: "A valid session is required.",
    };
    expect(enforceTrainingFileBoundary(denied)).toBe(denied);
  });
});
