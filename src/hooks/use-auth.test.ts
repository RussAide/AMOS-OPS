import { describe, expect, it } from "vitest";
import { getPostLoginRedirectPath } from "./use-auth";

describe("post-login routing", () => {
  it("sends every Training account to onboarding before its role workspace", () => {
    expect(
      getPostLoginRedirectPath({
        role: "clinical-director",
        accessStatus: "training",
      }),
    ).toBe("/onboarding");
  });

  it("sends cleared accounts to their canonical role workspace", () => {
    expect(
      getPostLoginRedirectPath({
        role: "clinical-director",
        accessStatus: "cleared",
      }),
    ).toBe("/clinical");
  });
});
