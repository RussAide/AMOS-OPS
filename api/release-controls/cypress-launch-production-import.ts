/**
 * Explicit, release-controlled import of the SharePoint Cypress Launch Matrix.
 * Never called by startup, never changes accounts or user permissions.
 *
 * A release operator first mounts the approved exact registry snapshot at
 * AMOS_CYPRESS_LAUNCH_REGISTRY_PATH and pins its SHA-256. Invocation without
 * --apply only validates the source. The apply path additionally requires
 * release identity, Owner promotion approval, backup verification, and an
 * explicit import confirmation. Production's operational DB is opened through
 * the existing encrypted volume controls.
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { env } from "../lib/env";
import { loadRuntimeReleaseIdentity } from "../release-identity";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(name + "_REQUIRED");
  return value;
}

async function main(): Promise<void> {
  if (!env.isProduction || env.runtimeMode !== "production") {
    throw new Error("CYPRESS_LAUNCH_PRODUCTION_ENVIRONMENT_REQUIRED");
  }
  const argv = process.argv.slice(2);
  if (argv.length !== 1 || !["--dry-run", "--apply"].includes(argv[0])) {
    throw new Error("Usage: cypress-launch-production-import [--dry-run|--apply]");
  }
  const expectedDigest = required("AMOS_CYPRESS_LAUNCH_REGISTRY_SHA256");
  if (!/^[a-f0-9]{64}$/.test(expectedDigest)) {
    throw new Error("CYPRESS_LAUNCH_REGISTRY_CHECKSUM_INVALID");
  }
  const configuredPath = required("AMOS_CYPRESS_LAUNCH_REGISTRY_PATH");
  if (!path.isAbsolute(configuredPath)) {
    throw new Error("CYPRESS_LAUNCH_REGISTRY_ABSOLUTE_PATH_REQUIRED");
  }
  const sourcePath = path.resolve(configuredPath);
  const persistentRoot = path.resolve(env.persistentRoot);
  if (!sourcePath.startsWith(persistentRoot + path.sep)) {
    throw new Error("CYPRESS_LAUNCH_REGISTRY_OUTSIDE_PROTECTED_ROOT");
  }
  const fileStats = fs.lstatSync(sourcePath);
  if (!fileStats.isFile() || fileStats.isSymbolicLink() || fileStats.size > 200000) {
    throw new Error("CYPRESS_LAUNCH_REGISTRY_FILE_INVALID");
  }
  const payload = fs.readFileSync(sourcePath, "utf8");
  const digest = createHash("sha256").update(payload).digest("hex");
  if (digest !== expectedDigest) {
    throw new Error("CYPRESS_LAUNCH_REGISTRY_SOURCE_DIGEST_MISMATCH");
  }

  const { parseAuthoritativeCypressRegistry } = await import(
    "../launch/production-launch-matrix"
  );
  const actions = parseAuthoritativeCypressRegistry(payload);
  if (argv[0] === "--dry-run") {
    process.stdout.write(JSON.stringify({
      status: "VALIDATED_NO_WRITES",
      actions: actions.length, sha256: digest,
      firstAdmissionHold: actions.find((a) => a.id === "Q04")?.status === "On hold",
    }) + "\n");
    return;
  }

  // --apply is forbidden without all three distinct release-control facts.
  if (process.env.AMOS_PRODUCTION_RELEASE_AUTHORIZED !== "true") {
    throw new Error("CYPRESS_LAUNCH_OWNER_PRODUCTION_AUTHORIZATION_REQUIRED");
  }
  if (process.env.AMOS_CYPRESS_LAUNCH_IMPORT_AUTHORIZED !== "true") {
    throw new Error("CYPRESS_LAUNCH_EXPLICIT_IMPORT_CONFIRMATION_REQUIRED");
  }
  const backupReference = required("AMOS_CYPRESS_LAUNCH_VERIFIED_BACKUP_REFERENCE");
  if (backupReference.length < 12) {
    throw new Error("CYPRESS_LAUNCH_BACKUP_REFERENCE_INVALID");
  }
  const release = loadRuntimeReleaseIdentity();
  if (!release.verified ||
      release.releaseId !== required("AMOS_PRODUCTION_RELEASE_ID")) {
    throw new Error("CYPRESS_LAUNCH_RELEASE_MANIFEST_IDENTITY_MISMATCH");
  }
  const { importProductionCypressLaunchMatrix } = await import(
    "../launch/production-launch-matrix"
  );
  const result = importProductionCypressLaunchMatrix(payload);
  process.stdout.write(JSON.stringify({
    status:"IMPORTED",
    releaseId:release.releaseId, backupReference,
    sourceSha:release.commitSha, ...result,
  }) + "\n");
}

main().catch((error: unknown) => {
  process.stderr.write(
    (error instanceof Error ? error.message : "CYPRESS_LAUNCH_IMPORT_FAILED") + "\n"
  );
  process.exitCode = 1;
});
