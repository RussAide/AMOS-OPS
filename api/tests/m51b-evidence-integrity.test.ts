import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  M51B_BASELINE_CONTROL_FILES,
  M51B_CRITERION_EVIDENCE_FILES,
  M51B_EVIDENCE_FILES,
  exportM51BEvidence,
  hashM51B,
  stableM51BJson,
  type M51BEvidenceOptions,
} from "../../scripts/m51b-export-evidence";
import { verifyM51BEvidence } from "../../scripts/m51b-verify-evidence";

function readJson(filePath: string): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<
    string,
    unknown
  >;
}

function rewriteChecksums(output: string, names: readonly string[]): void {
  const checksumPath = path.join(output, M51B_EVIDENCE_FILES.checksums);
  const replacements = new Set(names);
  const rewritten = fs
    .readFileSync(checksumPath, "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => {
      const match = /^([a-f0-9]{64}) {2}(.+)$/.exec(line);
      if (!match || !replacements.has(match[2])) return line;
      return `${hashM51B(fs.readFileSync(path.join(output, match[2])))}  ${match[2]}`;
    });
  fs.writeFileSync(checksumPath, `${rewritten.join("\n")}\n`);
}

describe("M5.1B evidence integrity", () => {
  let temporaryOutput: string;
  let milestoneRoot: string;
  let options: M51BEvidenceOptions;

  beforeEach(async () => {
    temporaryOutput = fs.mkdtempSync(
      path.join(os.tmpdir(), "amos-m51b-evidence-test-"),
    );
    milestoneRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "amos-m51b-milestone-test-"),
    );
    fs.symlinkSync(process.cwd(), path.join(milestoneRoot, "source"), "dir");
    const controlsRoot = path.join(milestoneRoot, "controls");
    fs.mkdirSync(controlsRoot, { recursive: true });
    for (const name of M51B_BASELINE_CONTROL_FILES) {
      fs.writeFileSync(
        path.join(controlsRoot, name),
        `Synthetic fixture for ${name}\n`,
      );
    }
    options = {
      root: milestoneRoot,
      output: temporaryOutput,
    };
    await exportM51BEvidence(options);
  });

  afterEach(() => {
    fs.rmSync(temporaryOutput, { recursive: true, force: true });
    fs.rmSync(milestoneRoot, { recursive: true, force: true });
  });

  it("verifies checksums, control bytes, and fresh replay binding", async () => {
    await expect(verifyM51BEvidence(options)).resolves.toMatchObject({
      milestone: "M5.1B",
      criteriaVerified: 8,
      passed: true,
      productionRows: 0,
      liveGraphCalls: 0,
      liveMicrosoftWrites: 0,
    });
  });

  it("rejects a forged control hash even when the manifest checksum is updated", async () => {
    const manifestPath = path.join(
      temporaryOutput,
      M51B_EVIDENCE_FILES.manifest,
    );
    const manifest = readJson(manifestPath);
    const references = manifest.controlReferences as Array<
      Record<string, unknown>
    >;
    references[0] = { ...references[0], sha256: "0".repeat(64) };
    fs.writeFileSync(manifestPath, stableM51BJson(manifest));
    rewriteChecksums(temporaryOutput, [M51B_EVIDENCE_FILES.manifest]);

    await expect(verifyM51BEvidence(options)).rejects.toThrow(
      "M5.1B control SHA-256 drifted",
    );
  });

  it("rejects stored criterion payload forgery after all stored hashes are updated", async () => {
    const criterionName = M51B_CRITERION_EVIDENCE_FILES["M5.1B-AC-03"];
    const criterionPath = path.join(temporaryOutput, criterionName);
    const criterion = readJson(criterionPath);
    criterion.artifacts = { forged: true };
    fs.writeFileSync(criterionPath, stableM51BJson(criterion));

    const manifestPath = path.join(
      temporaryOutput,
      M51B_EVIDENCE_FILES.manifest,
    );
    const manifest = readJson(manifestPath);
    const evidenceFiles = manifest.evidenceFiles as Array<
      Record<string, unknown>
    >;
    const index = evidenceFiles.findIndex(
      (record) => record.path === criterionName,
    );
    expect(index).toBeGreaterThanOrEqual(0);
    const bytes = fs.readFileSync(criterionPath);
    evidenceFiles[index] = {
      path: criterionName,
      bytes: bytes.length,
      sha256: hashM51B(bytes),
    };
    fs.writeFileSync(manifestPath, stableM51BJson(manifest));
    rewriteChecksums(temporaryOutput, [
      criterionName,
      M51B_EVIDENCE_FILES.manifest,
    ]);

    await expect(verifyM51BEvidence(options)).rejects.toThrow(
      "M5.1B stored criterion is not bound to fresh replay: M5.1B-AC-03/artifacts",
    );
  });
});
