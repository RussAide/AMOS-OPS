import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  releaseIdentityMatches,
  waitForRelease,
} from "./main-paired-release.mjs";

const expected = Object.freeze({
  schemaVersion: 1,
  releaseId: "RAILWAY-GITHUB-" + "a".repeat(40),
  commitSha: "a".repeat(40),
  treeSha: "b".repeat(40),
  sourceDigest: "c".repeat(64),
  frontendArtifactDigest: "d".repeat(64),
  backendArtifactDigest: "e".repeat(64),
});

function response(body, ok = true) {
  return { ok, json: async () => body };
}

test("requires every immutable release-identity field to match", () => {
  assert.equal(releaseIdentityMatches(expected, expected), true);
  assert.equal(
    releaseIdentityMatches(
      { ...expected, backendArtifactDigest: "f".repeat(64) },
      expected,
    ),
    false,
  );
});

test("waits through a transient mismatch and accepts the exact healthy pair", async () => {
  let manifestCalls = 0;
  const sleeps = [];
  const result = await waitForRelease({
    origin: "https://amos-ops-production.up.railway.app",
    expectedManifest: expected,
    healthPaths: ["/api/health/live", "/api/health/ready"],
    attempts: 3,
    delayMs: 5,
    sleep: async (duration) => sleeps.push(duration),
    fetcher: async (url) => {
      if (!url.endsWith("release-manifest.json")) return response({});
      manifestCalls += 1;
      return response(
        manifestCalls === 1
          ? { ...expected, commitSha: "f".repeat(40) }
          : expected,
      );
    },
  });
  assert.equal(result.attempts, 2);
  assert.deepEqual(sleeps, [5]);
});

test("fails closed when a host never exposes the expected identity", async () => {
  await assert.rejects(
    waitForRelease({
      origin: "https://amos-ops.com",
      expectedManifest: expected,
      attempts: 2,
      delayMs: 1,
      sleep: async () => {},
      fetcher: async () => response({}, false),
    }),
    /did not become healthy/,
  );
});

test("uses the backend identity contract for Railway verification", async () => {
  const requests = [];
  await waitForRelease({
    origin: "https://amos-ops-production.up.railway.app",
    expectedManifest: expected,
    manifestPath: "/api/release-identity",
    attempts: 1,
    fetcher: async (url) => {
      requests.push(url);
      return response(expected);
    },
  });
  assert.deepEqual(requests, [
    "https://amos-ops-production.up.railway.app/api/release-identity",
  ]);
});

test("the Railway Docker build reconstructs the exact Git tree without Git metadata", () => {
  const dockerfile = readFileSync(
    new URL("../Dockerfile", import.meta.url),
    "utf8",
  );
  const dockerignore = readFileSync(
    new URL("../.dockerignore", import.meta.url),
    "utf8",
  );
  assert.match(dockerfile, /ARG RAILWAY_GIT_COMMIT_SHA/);
  assert.match(
    dockerfile,
    /ARG VITE_AMOS_API_ORIGIN=https:\/\/amos-ops-production\.up\.railway\.app/,
  );
  assert.match(
    dockerfile,
    /test "\$VITE_AMOS_API_ORIGIN" = "https:\/\/amos-ops-production\.up\.railway\.app"/,
  );
  assert.match(dockerfile, /production-release-manifest\.mjs/);
  assert.match(dockerfile, /--release-sha "\$RAILWAY_GIT_COMMIT_SHA"/);
  assert.match(dockerfile, /--source-mode filesystem/);
  assert.match(dockerignore, /^\.git\/?$/m);
  assert.doesNotMatch(dockerignore, /^\.github\/?$/m);
  assert.match(dockerignore, /^!\.env\.production\.example$/m);
  assert.match(dockerfile, /COPY --from=builder \/app\/dist \.\/dist/);
  assert.doesNotMatch(
    dockerfile.slice(dockerfile.indexOf(" AS production")),
    /COPY .*\.git/,
  );
});

test("main CI waits for the exact Railway identity before publishing Netlify", () => {
  const workflow = readFileSync(
    new URL("../.github/workflows/ci.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /production:\n[\s\S]*needs: verify/);
  assert.match(workflow, /environment: amos-production/);
  assert.match(workflow, /statuses: write/);
  assert.match(
    workflow,
    /group: amos-ops-production-main-pair\n\s+cancel-in-progress: true/,
  );
  assert.match(workflow, /github\.event_name == 'push'/);
  const wait = workflow.indexOf(
    "Wait for Railway's connected-main deployment to match",
  );
  const builtRuntime = workflow.indexOf(
    "Verify the built runtime and all sidebar deep links",
  );
  const seal = workflow.indexOf(
    "Seal the CI-approved GitHub identity into both artifacts",
  );
  const publish = workflow.indexOf(
    "Publish the byte-matched frontend to the existing Netlify site",
  );
  const verify = workflow.indexOf(
    "Verify the Netlify Production deployment record",
  );
  assert.ok(
    builtRuntime > -1 &&
      builtRuntime < seal &&
      seal < wait &&
      wait < publish &&
      publish < verify,
  );
  assert.match(workflow, /amos-production-pair\/railway-ready/);
  assert.match(workflow, /amos-production-pair\/complete/);
  assert.match(workflow, /amos-production-pair\/failed/);
  assert.match(workflow, /id: netlify/);
  assert.match(workflow, /deploy_ssl_url \?\? deploy\.deploy_url/);
  assert.match(workflow, /deploy_id=\$\{deployId\}/);
  assert.match(
    workflow,
    /https:\/\/api\.netlify\.com\/api\/v1\/deploys\/\$\{NETLIFY_DEPLOY_ID\}/,
  );
  assert.match(workflow, /deploy\.title === expectedTitle/);
  assert.match(workflow, /deploy\.required\.length === 0/);
  const helper = readFileSync(
    new URL("./main-paired-release.mjs", import.meta.url),
    "utf8",
  );
  assert.match(helper, /manifestPath: "\/api\/release-identity"/);
  assert.doesNotMatch(workflow, /railway (?:up|redeploy|rollback|restart)/i);
});
