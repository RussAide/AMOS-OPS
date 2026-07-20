import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assembleStage } from "./production-release-stage.mjs";

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "amos-release-source-"));
  const output = mkdtempSync(path.join(os.tmpdir(), "amos-release-output-"));
  for (const directory of ["dist/public", "db", "docs", "accepted-baselines"]) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  for (const [relative, value] of [
    ["package.json", '{"scripts":{"start":"node dist/boot.js"}}'],
    ["package-lock.json", '{"lockfileVersion":3}'],
    ["dist/boot.js", "console.log('server')"],
    ["dist/public/index.html", '<div id="root"></div><script></script>'],
    ["dist/release-manifest.json", '{"schemaVersion":1}'],
    ["dist/public/release-manifest.json", '{"schemaVersion":1}'],
    ["db/schema.sql", "select 1;"],
    ["docs/readme.md", "docs"],
    ["accepted-baselines/baseline.txt", "baseline"],
  ]) {
    writeFileSync(path.join(root, relative), value);
  }
  return { root, output };
}

test("assembles a prebuilt stage without source files or a second app build", () => {
  const { root, output } = fixture();
  assembleStage(root, output);
  const dockerfile = readFileSync(path.join(output, "Dockerfile"), "utf8");
  assert.match(dockerfile, /COPY dist \.\/dist/);
  assert.match(dockerfile, /npm ci --omit=dev/);
  assert.match(dockerfile, /AMOS_RM2_STATUS=paused/);
  assert.doesNotMatch(dockerfile, /npm run build/);
  assert.equal(
    readFileSync(path.join(output, "dist/boot.js"), "utf8"),
    "console.log('server')",
  );
  assert.equal(
    readFileSync(path.join(output, "dist/release-manifest.json"), "utf8"),
    readFileSync(
      path.join(output, "dist/public/release-manifest.json"),
      "utf8",
    ),
  );
});

test("refuses a stage when frontend and backend manifests diverge", () => {
  const { root, output } = fixture();
  writeFileSync(
    path.join(root, "dist/public/release-manifest.json"),
    "different",
  );
  assert.throws(() => assembleStage(root, output), /byte-identical/);
});
