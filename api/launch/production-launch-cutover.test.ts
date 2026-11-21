import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeReleaseIdentity } from "../release-identity";

const fixture = vi.hoisted(() => ({
  importMatrix: vi.fn(),
  createBackup: vi.fn(),
  existingCount: 0,
  runtime: {
    isProduction: true, isStaging: false,
    databasePath: "/volume/production/operational.db",
    backupPath: "/volume/production/backups",
  },
}));
vi.mock("../lib/env", () => ({ env: fixture.runtime }));
vi.mock("../data-lifecycle", () => ({
  createDatabaseBackup: fixture.createBackup,
}));
vi.mock("../queries/connection", () => ({
  sqlite: {
    prepare: () => ({ get: () => ({ count: fixture.existingCount }) }),
  },
}));
vi.mock("./production-launch-matrix", () => ({
  importProductionCypressLaunchMatrix: fixture.importMatrix,
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
    AMOS_CYPRESS_LAUNCH_REGISTRY_JSON: payload,
    AMOS_CYPRESS_LAUNCH_REGISTRY_SHA256:
      createHash("sha256").update(payload).digest("hex"),
  };
}

beforeEach(() => {
  fixture.runtime.isProduction = true;
  fixture.runtime.isStaging = false;
  fixture.existingCount = 0;
  fixture.importMatrix.mockReset().mockReturnValue({
    actionCount: 40, inserted: 40, retained: 0,
    source: "production-operational", firstAdmissionHold: true,
    registrySha256: "a".repeat(64),
  });
  fixture.createBackup.mockReset().mockImplementation(async (_db: string, backupPath: string) => backupPath);
});

describe("G3 + Cypress Production cutover Owner and backup gate", () => {
  it("makes no Production backup or changes without final authorization", async () => {
    await expect(applyControlledCypressLaunchAtStartup(release, {}))
      .resolves.toEqual({ status: "NOT_REQUESTED" });
    expect(fixture.importMatrix).not.toHaveBeenCalled();
    expect(fixture.createBackup).not.toHaveBeenCalled();
  });
  it("requires exact source and prevents an unauthorized cutover", async () => {
    const input = allowedSource();
    input.AMOS_CYPRESS_LAUNCH_TARGET_COMMIT_SHA = "a".repeat(40);
    await expect(applyControlledCypressLaunchAtStartup(release, input))
      .rejects.toThrow("CYPRESS_LAUNCH_SOURCE_SHA_MISMATCH");
    input.AMOS_CYPRESS_LAUNCH_TARGET_COMMIT_SHA = exactSha;
    input.AMOS_PRODUCTION_RELEASE_AUTHORIZED = "false";
    await expect(applyControlledCypressLaunchAtStartup(release, input))
      .rejects.toThrow("CYPRESS_LAUNCH_PRODUCTION_OWNER_AUTHORIZATION_REQUIRED");
    expect(fixture.importMatrix).not.toHaveBeenCalled();
  });
  it("requires separately recorded final Owner approval", async () => {
    const input = allowedSource();
    delete input.AMOS_CYPRESS_LAUNCH_FINAL_APPROVAL_REFERENCE;
    await expect(applyControlledCypressLaunchAtStartup(release, input))
      .rejects.toThrow("AMOS_CYPRESS_LAUNCH_FINAL_APPROVAL_REFERENCE_REQUIRED");
    expect(fixture.createBackup).not.toHaveBeenCalled();
  });
  it("rejects invalid SharePoint registry checksum before any writes", async () => {
    const input = allowedSource();
    input.AMOS_CYPRESS_LAUNCH_REGISTRY_SHA256 = "b".repeat(64);
    await expect(applyControlledCypressLaunchAtStartup(release, input))
      .rejects.toThrow("CYPRESS_LAUNCH_REGISTRY_DIGEST_MISMATCH");
    expect(fixture.createBackup).not.toHaveBeenCalled();
  });
  it("creates a verified backup before first import and retains Q04 HOLD", async () => {
    const input = allowedSource();
    const result = await applyControlledCypressLaunchAtStartup(release, input);
    expect(fixture.createBackup).toHaveBeenCalledOnce();
    expect(fixture.createBackup).toHaveBeenCalledWith(
      fixture.runtime.databasePath,
      expect.stringContaining("/volume/production/backups/cypress-launch-g3-"),
    );
    expect(fixture.importMatrix).toHaveBeenCalledOnce();
    expect(fixture.importMatrix).toHaveBeenCalledWith(input.AMOS_CYPRESS_LAUNCH_REGISTRY_JSON);
    expect(result).toMatchObject({
      status: "IMPORTED", actionCount: 40, firstAdmissionHold: true,
      inserted: 40, retained: 0,
      backupArtifact: expect.stringContaining("cypress-launch-g3-"),
    });
  });
  it("does not import if verified backup creation fails", async () => {
    fixture.createBackup.mockRejectedValueOnce(new Error("ENCRYPTED_BACKUP_VERIFICATION_FAILED"));
    await expect(applyControlledCypressLaunchAtStartup(release, allowedSource()))
      .rejects.toThrow("ENCRYPTED_BACKUP_VERIFICATION_FAILED");
    expect(fixture.importMatrix).not.toHaveBeenCalled();
  });
  it("does not create duplicate backups when all 40 actions already exist", async () => {
    fixture.existingCount = 40;
    const result = await applyControlledCypressLaunchAtStartup(release, allowedSource());
    expect(result).toMatchObject({status:"IMPORTED",backupArtifact:null});
    expect(fixture.importMatrix).toHaveBeenCalledOnce();
    expect(fixture.createBackup).not.toHaveBeenCalled();
  });
  it("refuses an unverified release manifest or any Staging import", async () => {
    await expect(applyControlledCypressLaunchAtStartup({
      verified: false, manifestPath: "/tmp/none", reason: "missing",
    }, allowedSource())).rejects.toThrow("CYPRESS_LAUNCH_RELEASE_IDENTITY_UNVERIFIED");
    fixture.runtime.isProduction = false;
    fixture.runtime.isStaging = true;
    await expect(applyControlledCypressLaunchAtStartup(release, allowedSource()))
      .rejects.toThrow("CYPRESS_LAUNCH_PRODUCTION_ONLY");
    expect(fixture.importMatrix).not.toHaveBeenCalled();
  });
});
