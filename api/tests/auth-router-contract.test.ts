import { describe, expect, it } from "vitest";
import { appRouter } from "../router";

function caller(ipAddress?: string) {
  const headers = new Headers();
  if (ipAddress) headers.set("x-forwarded-for", ipAddress);
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers }),
    resHeaders: new Headers(),
  });
}

describe("mounted identity-control contract", () => {
  it("mounts login, MFA, session, recovery, and access-review procedures", () => {
    expect(Object.keys(appRouter._def.record.auth)).toEqual(
      expect.arrayContaining([
        "policy",
        "evaluationSession",
        "register",
        "login",
        "verifyMfa",
        "me",
        "logout",
        "requestPasswordReset",
        "resetPassword",
        "changePassword",
        "setMfa",
        "listSessions",
        "listUsers",
        "createTrainingAccount",
        "issueAccountRecovery",
        "unlockAccount",
        "updateUser",
        "deleteUser",
        "listAccessReviews",
        "completeAccessReview",
      ]),
    );
  });

  it("publishes policy without exposing secrets", async () => {
    const policy = await caller().auth.policy();
    expect(policy.passwordMinimumLength).toBe(12);
    expect(policy.sessionIdleMinutes).toBeLessThan(
      policy.sessionAbsoluteMinutes,
    );
    expect(policy).not.toHaveProperty("appSecret");
    expect(policy).not.toHaveProperty("jwtSecret");
  });

  it("rejects synthetic evaluation-session issuance outside demo mode", async () => {
    await expect(
      caller().auth.evaluationSession({ role: "administrator" }),
    ).rejects.toThrow("Synthetic evaluation access is not enabled");
  });

  it("uses a neutral response for an unknown recovery identity", async () => {
    await expect(
      caller().auth.requestPasswordReset({
        email: "unknown.evaluator@amos-ops.invalid",
      }),
    ).resolves.toEqual({ accepted: true });
  });

  it("keeps account, session, and access-review administration authenticated", async () => {
    await expect(caller().auth.listSessions()).rejects.toThrow(
      /Invalid or expired session|Unauthorized/,
    );
    await expect(caller().auth.listUsers()).rejects.toThrow(
      /Invalid or expired session|Unauthorized/,
    );
    await expect(
      caller().auth.issueAccountRecovery({
        userId: "TEAM-USER-001",
        rationale: "Verified account recovery request.",
      }),
    ).rejects.toThrow(/Invalid or expired session|Unauthorized/);
    await expect(
      caller().auth.unlockAccount({
        userId: "TEAM-USER-001",
        rationale: "Verified account unlock request.",
      }),
    ).rejects.toThrow(/Invalid or expired session|Unauthorized/);
    await expect(caller().auth.listAccessReviews()).rejects.toThrow(
      /Invalid or expired session|Unauthorized/,
    );
  });

  it("rate limits anonymous recovery attempts by source", async () => {
    const recoveryCaller = caller("198.51.100.42");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(
        recoveryCaller.auth.requestPasswordReset({
          email: `unknown-${attempt}@amos-ops.invalid`,
        }),
      ).resolves.toEqual({ accepted: true });
    }
    await expect(
      recoveryCaller.auth.requestPasswordReset({
        email: "unknown-over-limit@amos-ops.invalid",
      }),
    ).rejects.toThrow("Too many requests");
  });
});
