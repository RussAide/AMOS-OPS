import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadRuntimeReleaseIdentity,
  parseReleaseIdentity,
} from "./release-identity";

const valid = {
  schemaVersion: 1,
  releaseId: "AMOS-OPS-AUTH-STAB-20260720",
  commitSha: "a".repeat(40),
  treeSha: "b".repeat(40),
  sourceDigest: "c".repeat(64),
  frontendArtifactDigest: "d".repeat(64),
  backendArtifactDigest: "e".repeat(64),
};

describe("release identity", () => {
  it("accepts one immutable backend/frontend release identity", () => {
    expect(parseReleaseIdentity(valid)).toEqual(valid);
  });

  it("rejects malformed or placeholder artifact identities", () => {
    expect(() =>
      parseReleaseIdentity({ ...valid, commitSha: "main" }),
    ).toThrow(/commitSha/);
    expect(() =>
      parseReleaseIdentity({ ...valid, frontendArtifactDigest: "unknown" }),
    ).toThrow(/frontendArtifactDigest/);
  });

  it("fails closed when the runtime manifest is missing or invalid", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "amos-release-"));
    const missing = path.join(directory, "missing.json");
    expect(loadRuntimeReleaseIdentity(missing)).toMatchObject({
      verified: false,
      manifestPath: missing,
    });

    const invalid = path.join(directory, "invalid.json");
    writeFileSync(invalid, JSON.stringify({ ...valid, treeSha: "main" }));
    expect(loadRuntimeReleaseIdentity(invalid)).toMatchObject({
      verified: false,
      manifestPath: invalid,
    });
  });
});
