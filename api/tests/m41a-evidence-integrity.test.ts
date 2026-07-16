import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  M41A_EVIDENCE_FILES,
  M41A_CONTROL_REFERENCES,
  type M41aEvidenceOptions,
} from "../../scripts/m41a-evidence-common";
import { exportM41aEvidence } from "../../scripts/m41a-export-evidence";
import { verifyM41aEvidence } from "../../scripts/m41a-verify-evidence";
import { runM41aScenario } from "../services/m41a";

describe("M4.1A evidence export integrity", () => {
  let temporaryRoot: string;
  let milestoneRoot: string;
  let options: M41aEvidenceOptions;

  beforeEach(async () => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "amos-m41a-evidence-test-"),
    );
    milestoneRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "amos-m41a-milestone-test-"),
    );
    fs.symlinkSync(process.cwd(), path.join(milestoneRoot, "source"), "dir");
    for (const relativePath of M41A_CONTROL_REFERENCES) {
      const controlPath = path.resolve(milestoneRoot, relativePath);
      fs.mkdirSync(path.dirname(controlPath), { recursive: true });
      fs.writeFileSync(controlPath, `Synthetic fixture for ${relativePath}\n`);
    }
    options = {
      root: milestoneRoot,
      output: temporaryRoot,
    };
    await exportM41aEvidence(options, runM41aScenario());
  });

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
    fs.rmSync(milestoneRoot, { recursive: true, force: true });
  });

  it("exports and verifies the complete deterministic evidence set", () => {
    expect(verifyM41aEvidence(options)).toMatchObject({
      milestone: "M4.1A",
      status: "PASS",
      evidenceClass: "synthetic_demo",
      criteriaVerified: 8,
      dashboardsVerified: 5,
      metricsVerified: 29,
    });
  });

  it("rejects a modified derived evidence file", () => {
    fs.appendFileSync(
      path.join(temporaryRoot, M41A_EVIDENCE_FILES.drilldown),
      "\nTAMPERED",
    );
    expect(() => verifyM41aEvidence(options)).toThrow(
      "M4.1A derived evidence drifted",
    );
  });

  it("rejects a modified checksum record", () => {
    const checksumPath = path.join(
      temporaryRoot,
      M41A_EVIDENCE_FILES.checksums,
    );
    const checksums = fs.readFileSync(checksumPath, "utf8");
    fs.writeFileSync(
      checksumPath,
      `${checksums[0] === "0" ? "1" : "0"}${checksums.slice(1)}`,
    );
    expect(() => verifyM41aEvidence(options)).toThrow(
      "M4.1A checksum mismatch",
    );
  });
});
