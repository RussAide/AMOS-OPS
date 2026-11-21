import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeReleaseIdentity } from "../release-identity";

const importMatrix = vi.hoisted(() => vi.fn());
vi.mock("../lib/env", () => ({
  env: { isProduction: true, isStaging: false },
}));
vi.mock("./production-launch-matrix", () => ({
  importProductionCypressLaunchMatrix: importMatrix,
}));

import { applyControlledCypressLaunchAtStartup } from "./production-launch-cutover";

const exactSha = "8".repeat(40);
const release: RuntimeReleaseIdentity = {
  verified: true,
  manifestPath: "/tmp/release-manifest.json",
  schemaVersion: 1,
  releaseId: "AMOSOPS-G3-LAUNCH-CANDIDATE",
  commitSha: exactSha,
  treeSha: "a".repeat(40),
  sourceDigest: "b".repeat(64),
  frontendArtifactDigest: "c".repeat(64),
  backendArtifactDigest: "d".repeat(64),
};

function allowedSource(): NodeJS.ProcessEnv {
  const payload = JSON.stringify({
    metadata: { work_item: "ADL-AMOS-OPS-LAUNCH-2026-11" },
    actions: Array.from({ length: 40 }, (_, i) => i),
  });
  return {
    AMOS_CYPRESS_LAUNCH_IMPORT_AUTHORIZED: "true",
    AMOS_PRODUCTION_RELEASE_AUTHORIZED: "true",
    AMOS_CYPRESS_LAUNCH_FINAL_APPROVAL_REFERENCE:
      "EG-AMOSOPS-G3-LAUNCH-APPROVAL-20261121",
    AMOS_CYPRESS_LAUNCH_TARGET_COMMIT_SHA: exactSha,
    AMOS_CYPRESS_LAUNCH_VERIFIED_BACKUP_REFERENCE:
      "AMOSOPS-PROD-BACKUP-VERIFIED-20261121",
    AMOS_CYPRESS_LAUNCH_REGISTRY_JSON: payload,
    AMOS_CYPRESS_LAUNCH_REGISTRY_SHA256:
      createHash("sha256").update(payload).digest("hex"),
  };
}

beforeEach(() => {
  importMatrix.mockReset();
  importMatrix.mockReturnValue({
    actionCount: 40,
    inserted: 40,
    retained: 0,
    source: "production-operational",
    firstAdmissionHold: true,
    registrySha256: "a".repeat(64),
  });
});

describe("G3 + Cypress Production cutover Owner gate", () => {
  it("does not even attempt to import without an explicit final authorization", () => {
    expect(applyControlledCypressLaunchAtStartup(release, {}))
      .toEqual({ status: "NOT_REQUESTED" });
    expect(importMatrix).not.toHaveBeenCalled();
  });
  it("requires the exact release candidate and refuses source substitution", () => {
    const input = allowedSource();
    input.AMOS_CYPRESS_LAUNCH_TARGET_COMMIT_SHA = "a".repeat(40);
    expect(() => applyControlledCypressLaunchAtStartup(release, input))
      .toThrow("CYPRESS_LAUNCH_SOURCE_SHA_MISMATCH");
    expect(importMatrix).not.toHaveBeenCalled();
  });
  it("requires separate named Owner approval and verified backup evidence", () => {
    const input = allowedSource();
    delete input.AMOS_CYPRESS_LAUNCH_FINAL_APPROVAL_REFERENCE;
    expect(() => applyControlledCypressLaunchAtStartup(release, input))
      .toThrow("AMOS_CYPRESS_LAUNCH_FINAL_APPROVAL_REFERENCE_REQUIRED");
    input.AMOS_CYPRESS_LAUNCH_FINAL_APPROVAL_REFERENCE =
      "EG-AMOSOPS-G3-LAUNCH-APPROVAL-20261121";
    delete input.AMOS_CYPRESS_LAUNCH_VERIFIED_BACKUP_REFERENCE;
    expect(() => applyControlledCypressLaunchAtStartup(release, input))
      .toThrow("AMOS_CYPRESS_LAUNCH_VERIFIED_BACKUP_REFERENCE_REQUIRED");
    expect(importMatrix).not.toHaveBeenCalled();
  });
  it("refuses a changed SharePoint registry digest", () => {
    const input = allowedSource();
    input.AMOS_CYPRESS_LAUNCH_REGISTRY_SHA256 = "b".repeat(64);
    expect(() => applyControlledCypressLaunchAtStartup(release, input))
      .toThrow("CYPRESS_LAUNCH_REGISTRY_DIGEST_MISMATCH");
    expect(importMatrix).not.toHaveBeenCalled();
  });
  it("imports only with all production gates supplied and retains admission HOLD", () => {
    const input = allowedSource();
    const result = applyControlledCypressLaunchAtStartup(release, input);
    expect(importMatrix).toHaveBeenCalledOnce();
    expect(importMatrix).toHaveBeenCalledWith(input.AMOS_CYPRESS_LAUNCH_REGISTRY_JSON);
    expect(result).toMatchObject({
      status: "IMPORTED", actionCount: 40, firstAdmissionHold: true,
      inserted: 40, retained: 0,
    });
  });
  it("rejects an unverified runtime release identity", () => {
    const input = allowedSource();
    expect(() => applyControlledCypressLaunchAtStartup({
      verified: false, manifestPath: "/tmp/none", reason: "missing",
    }, input)).toThrow("CYPRESS_LAUNCH_RELEASE_IDENTITY_UNVERIFIED");
  });
});
