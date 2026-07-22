import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createReleaseManifest } from "./production-release-manifest.mjs";

function git(root, ...args) {
  return execFileSync("git", ["-C", root, ...args], {
    encoding: "utf8",
  }).trim();
}

function releaseFixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "amos-release-manifest-"));
  git(root, "init", "--quiet");
  git(root, "config", "user.email", "release-test@amos-ops.invalid");
  git(root, "config", "user.name", "AMOS Release Test");
  writeFileSync(path.join(root, ".gitignore"), "dist/\n");
  writeFileSync(path.join(root, "source.txt"), "immutable source\n");
  git(root, "add", ".");
  git(root, "commit", "--quiet", "-m", "fixture");
  mkdirSync(path.join(root, "dist/public/assets"), { recursive: true });
  writeFileSync(path.join(root, "dist/boot.js"), "console.log('backend')\n");
  writeFileSync(
    path.join(root, "dist/public/index.html"),
    "<div id='root'></div>",
  );
  writeFileSync(
    path.join(root, "dist/public/assets/app.js"),
    "console.log('frontend')",
  );
  return root;
}

test("seals one numeric-schema, lowercase-digest manifest into both artifacts", () => {
  const root = releaseFixture();
  const releaseSha = git(root, "rev-parse", "HEAD");
  const manifest = createReleaseManifest({
    root,
    releaseId: "AMOS-OPS-PRODUCTION-TEST",
    releaseSha,
  });
  assert.equal(manifest.schemaVersion, 1);
  assert.equal(manifest.commitSha, releaseSha);
  for (const field of [
    "sourceDigest",
    "frontendArtifactDigest",
    "backendArtifactDigest",
  ]) {
    assert.match(manifest[field], /^[a-f0-9]{64}$/);
  }
  assert.equal(
    readFileSync(path.join(root, "dist/release-manifest.json"), "utf8"),
    readFileSync(path.join(root, "dist/public/release-manifest.json"), "utf8"),
  );
});

test("reconstructs the exact Git tree when Railway omits Git metadata", () => {
  const root = releaseFixture();
  const releaseSha = git(root, "rev-parse", "HEAD");
  const expected = createReleaseManifest({
    root,
    releaseId: "AMOS-OPS-PRODUCTION-TEST",
    releaseSha,
  });
  const detachedGit = `${root}-git-metadata`;
  renameSync(path.join(root, ".git"), detachedGit);
  const reconstructed = createReleaseManifest({
    root,
    releaseId: "AMOS-OPS-PRODUCTION-TEST",
    releaseSha,
    sourceMode: "filesystem",
  });
  assert.equal(reconstructed.treeSha, expected.treeSha);
  assert.equal(reconstructed.sourceDigest, expected.sourceDigest);
});

test("refuses to seal a build from a dirty or different source tree", () => {
  const root = releaseFixture();
  const releaseSha = git(root, "rev-parse", "HEAD");
  writeFileSync(path.join(root, "source.txt"), "changed after checkout\n");
  assert.throws(
    () =>
      createReleaseManifest({
        root,
        releaseId: "AMOS-OPS-PRODUCTION-TEST",
        releaseSha,
      }),
    /worktree changed after checkout/,
  );
  assert.throws(
    () =>
      createReleaseManifest({
        root,
        releaseId: "AMOS-OPS-PRODUCTION-TEST",
        releaseSha: "b".repeat(40),
      }),
    /does not equal release SHA/,
  );
});
