import { describe, expect, it } from "vitest";
import { invitationTokenFromLocation } from "./login-invitation";

describe("invitationTokenFromLocation", () => {
  it("reads an invitation from the query string", () => {
    expect(invitationTokenFromLocation("?invite=query-token", "")).toBe(
      "query-token",
    );
  });

  it("reads an invitation from the URL fragment", () => {
    expect(invitationTokenFromLocation("", "#invite=fragment-token")).toBe(
      "fragment-token",
    );
  });

  it("prefers the query string when both locations contain a token", () => {
    expect(
      invitationTokenFromLocation(
        "?invite=query-token",
        "#invite=fragment-token",
      ),
    ).toBe("query-token");
  });

  it("returns null when no invitation is present", () => {
    expect(invitationTokenFromLocation("?mode=login", "#section")).toBeNull();
  });
});
