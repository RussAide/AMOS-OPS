import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const workflow = readFileSync(
  new URL(
    "../.github/workflows/production-end-to-end-activation-20260718.yml",
    import.meta.url,
  ),
  "utf8",
);

test("Production release is manual and environment-protected", () => {
  assert.match(workflow, /on:\n  workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s{2}(push|pull_request|schedule):/m);
  assert.match(workflow, /environment: amos-production/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /release_sha:/);
  assert.match(workflow, /release_id:/);
});

test("checkout and host tools are pinned", () => {
  assert.match(workflow, /actions\/checkout@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/setup-node@[a-f0-9]{40}/);
  assert.match(workflow, /actions\/upload-artifact@[a-f0-9]{40}/);
  assert.match(workflow, /@railway\/cli@5\.27\.0/);
  assert.match(workflow, /netlify-cli@23\.11\.1/);
  assert.match(workflow, /ref: \$\{\{ inputs\.release_sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /RAILWAY_CREDENTIAL: \$\{\{ secrets\.RAILWAY_TOKEN \}\}/);
  assert.match(workflow, /RAILWAY_API_TOKEN: \$\{\{ vars\.RAILWAY_TOKEN_TYPE == 'account'/);
});

test("verification precedes the single build and every mutation", () => {
  const boundary = workflow.indexOf("npm run verify:release-identity-boundary");
  const build = workflow.indexOf("run: npm run build");
  const mutation = workflow.indexOf(
    "Mark the start of the controlled mutation window",
  );
  const railwayDeploy = workflow.indexOf("@railway/cli@5.27.0 up");
  assert.ok(boundary > 0 && boundary < build);
  assert.ok(build < mutation && mutation < railwayDeploy);
  assert.equal(workflow.match(/run: npm run build\n/g)?.length, 1);
  assert.match(workflow, /production-release-stage\.mjs/);
  assert.match(workflow, /--path-as-root/);
});

test("Netlify Git publishing is decoupled before protected release mutation", () => {
  const stopBuilds = workflow.indexOf("enforce-netlify-release-path");
  const preflight = workflow.indexOf(
    "production-release-control.mjs preflight",
  );
  const build = workflow.indexOf("run: npm run build");
  assert.ok(stopBuilds > 0 && stopBuilds < preflight && preflight < build);
});

test("the linked Netlify Git build is canceled before it can race the paired release", () => {
  const configuration = readFileSync(
    new URL("../netlify.toml", import.meta.url),
    "utf8",
  );
  const policy = readFileSync(
    new URL("./netlify-git-build-policy.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    configuration,
    /ignore = "node \.\/scripts\/netlify-git-build-policy\.mjs"/,
  );
  assert.match(policy, /process\.exitCode = 0/);
});

test("the mutation window always has a paired rollback and proof gate", () => {
  const deploy = workflow.indexOf(
    "Deploy the prebuilt backend artifact to Railway",
  );
  const verify = workflow.indexOf(
    "Prove Railway and Netlify expose the same release identity",
  );
  const rollback = workflow.indexOf(
    "Roll back both hosts after any mutation-window failure",
  );
  assert.ok(deploy > 0 && deploy < verify && verify < rollback);
  assert.match(
    workflow,
    /if: failure\(\) && steps\.mutation\.outputs\.started == 'true'/,
  );
  assert.match(workflow, /production-release-control\.mjs rollback/);
  assert.match(workflow, /production-release-control\.mjs verify-live/);
});

test("Production target identifiers and origins are explicit", () => {
  assert.match(
    workflow,
    /RAILWAY_PROJECT_ID: f9357da4-00c4-4f25-a52d-5c53f6ce07dc/,
  );
  assert.match(
    workflow,
    /RAILWAY_SERVICE_ID: 8fdf6d7e-c7ba-412d-95f0-8b980ba612ba/,
  );
  assert.match(
    workflow,
    /RAILWAY_ENVIRONMENT_ID: 7c22d214-abac-478f-983b-1418a7cbac77/,
  );
  assert.match(
    workflow,
    /RAILWAY_PUBLIC_ORIGIN: https:\/\/amos-ops-production\.up\.railway\.app/,
  );
  assert.match(workflow, /NETLIFY_PUBLIC_ORIGIN: https:\/\/amos-ops\.com/);
});

test("legacy standalone host workflows are staging-only", () => {
  for (const name of ["deploy-railway.yml", "deploy-netlify.yml"]) {
    const legacy = readFileSync(
      new URL(`../.github/workflows/${name}`, import.meta.url),
      "utf8",
    );
    assert.match(legacy, /Staging only/);
    assert.match(legacy, /environment: amos-staging/);
    assert.doesNotMatch(legacy, /environment: amos-production/);
    assert.doesNotMatch(legacy, /options: \[staging, production\]/);
  }
});
