import { describe, expect, it } from "vitest";
import { evaluateCorsOrigin, withRailwayStagingOrigin } from "../cors-policy";

describe("M1.1 authenticated CORS boundary", () => {
  const requestUrl = "https://api.amos.invalid/api/trpc/auth.login";

  it("allows server-to-server requests without an Origin header", () => {
    expect(evaluateCorsOrigin(undefined, requestUrl, [])).toEqual({
      allowed: true,
      reason: "no-origin",
    });
  });

  it("reflects the exact same origin and an exact configured origin", () => {
    expect(evaluateCorsOrigin("https://api.amos.invalid", requestUrl, [])).toMatchObject({
      allowed: true,
      responseOrigin: "https://api.amos.invalid",
      reason: "same-origin",
    });
    expect(
      evaluateCorsOrigin("https://intranet.amos.invalid", requestUrl, [
        "https://intranet.amos.invalid",
      ]),
    ).toMatchObject({
      allowed: true,
      responseOrigin: "https://intranet.amos.invalid",
      reason: "allowlist",
    });
  });

  it("adds only the exact Railway public origin for staging", () => {
    expect(
      withRailwayStagingOrigin(
        ["https://intranet.amos.invalid"],
        "staging",
        "amos-ops-staging.up.railway.app",
      ),
    ).toEqual([
      "https://intranet.amos.invalid",
      "https://amos-ops-staging.up.railway.app",
    ]);

    expect(
      withRailwayStagingOrigin(
        ["https://intranet.amos.invalid"],
        "production",
        "amos-ops.up.railway.app",
      ),
    ).toEqual(["https://intranet.amos.invalid"]);

    expect(
      withRailwayStagingOrigin(
        ["https://intranet.amos.invalid"],
        "staging",
        "amos-ops-staging.up.railway.app/path",
      ),
    ).toEqual(["https://intranet.amos.invalid"]);
  });

  it("denies wildcard, lookalike, malformed, and unknown origins", () => {
    for (const [origin, allowed] of [
      ["https://evil.invalid", ["*"]],
      ["https://intranet.amos.invalid.evil.invalid", ["https://intranet.amos.invalid"]],
      ["null", ["https://intranet.amos.invalid"]],
      ["https://unknown.amos.invalid", ["https://intranet.amos.invalid"]],
      ["https://intranet.amos.invalid", ["https://intranet.amos.invalid/path"]],
    ] as const) {
      expect(evaluateCorsOrigin(origin, requestUrl, allowed)).toEqual({
        allowed: false,
        reason: "denied",
      });
    }
  });
});
