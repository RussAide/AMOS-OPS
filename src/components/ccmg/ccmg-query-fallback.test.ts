import { describe, expect, it } from "vitest";
import {
  isBuiltCcmgFixture,
  mayUseCcmgFixtureForError,
} from "./ccmg-query-fallback";
import { CCMG_SYNTHETIC_DASHBOARD } from "./ccmg-synthetic-data";

describe("CCMG evaluation fixture policy", () => {
  it("permits eligible connector failures only in evaluation mode", () => {
    const unavailable = {
      data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 503 },
    };
    expect(
      mayUseCcmgFixtureForError(
        unavailable,
        "m21.getOversightDashboard",
        "api-error",
        true,
      ),
    ).toBe(true);
    expect(
      mayUseCcmgFixtureForError(
        unavailable,
        "m21.getOversightDashboard",
        "api-error",
        false,
      ),
    ).toBe(false);
  });

  it.each([
    ["UNAUTHORIZED", 401],
    ["FORBIDDEN", 403],
    ["NOT_FOUND", 404],
    ["BAD_REQUEST", 400],
  ])("never replaces authoritative %s responses", (code, httpStatus) => {
    expect(
      mayUseCcmgFixtureForError(
        { data: { code, httpStatus } },
        "m21.getReferralDetail",
        "api-error",
        true,
      ),
    ).toBe(false);
  });

  it("identifies only explicitly labeled built fixtures", () => {
    expect(isBuiltCcmgFixture(CCMG_SYNTHETIC_DASHBOARD)).toBe(true);
    expect(
      isBuiltCcmgFixture({
        evidenceClass: "synthetic_demo",
        generatedAt: "2026-07-14T00:00:00.000Z",
      }),
    ).toBe(false);
  });
});
