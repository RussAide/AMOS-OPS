import assert from "node:assert/strict";

const password = process.env.AMOS_REVIEW_SMOKE_PASSWORD;
if (!password) {
  throw new Error("AMOS_REVIEW_SMOKE_PASSWORD is required for this isolated QA script.");
}
if (process.env.AMOS_REVIEW_DEPLOYMENT !== "true") {
  throw new Error("DMS.1 experience smoke requires AMOS_REVIEW_DEPLOYMENT=true.");
}

const { initDatabase } = await import("../api/db-init.ts");
initDatabase();
const { appRouter } = await import("../api/router.ts");

assert.equal("releaseGate" in appRouter._def.record, false);

function caller(token) {
  const headers = new Headers({
    "user-agent": "AMOS-DMS1-operational-experience-smoke",
    "x-forwarded-for": "127.0.0.1",
  });
  if (token) headers.set("authorization", `Bearer ${token}`);
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers }),
    resHeaders: new Headers(),
  });
}

const login = await caller().auth.login({
  email: process.env.AMOS_FINAL_GATE_OWNER_EMAIL,
  password,
});
assert.equal(login.status, "mfa_required");
assert.equal("evaluationCode" in login, false);

const verified = await caller().auth.verifyMfa({
  challengeId: login.challengeId,
  code: process.env.AMOS_REVIEW_OWNER_MFA_CODE,
});
assert.equal(verified.status, "authenticated");
assert.equal(verified.mfaVerified, true);
assert.equal(verified.user.role, "super-admin");
assert.equal(
  verified.user.email.toLowerCase(),
  process.env.AMOS_FINAL_GATE_OWNER_EMAIL.toLowerCase(),
);

const owner = caller(verified.token);
const dashboard = await owner.dashboard.overview();
assert.deepEqual(
  ["bhc", "revenue", "campus", "mgma", "part2", "documents", "nil"].filter(
    (section) => !(section in dashboard),
  ),
  [],
);
await owner.phase3.overview();
await owner.dx1.getAcceptanceStatus();

console.log(
  JSON.stringify(
    {
      status: "passed",
      milestone: "DMS.1",
      experience: "operational-workspace",
      ownerAccessBound: true,
      mfaVerified: true,
      deploymentApprovalSurface: "absent",
      deploymentGovernanceVisibleInProduct: false,
      representativeApplicationReads: 3,
      businessMutationsExercised: 0,
    },
    null,
    2,
  ),
);
