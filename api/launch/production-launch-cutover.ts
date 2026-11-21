/**
 * Exact-source Cypress Launch Matrix activation at the existing Production
 * application's normal startup. This path is inert unless explicitly enabled
 * for the approved deployment. No new service, identity, or database.
 *
 * The SharePoint-origin 40-action projection is passed as a controlled Railway
 * runtime variable, not committed to public source control or logged.
 */
import { createHash } from "node:crypto";
import { env } from "../lib/env";
import type { RuntimeReleaseIdentity } from "../release-identity";
import { importProductionCypressLaunchMatrix } from "./production-launch-matrix";

type CutoverResult =
  | { status: "NOT_REQUESTED" }
  | {
      status: "IMPORTED";
      inserted: number;
      retained: number;
      actionCount: number;
      firstAdmissionHold: true;
      registrySha256: string;
      releaseId: string;
    };

function required(
  source: NodeJS.ProcessEnv,
  name: string,
  max = 180,
): string {
  const v = source[name]?.trim();
  if (!v || v.length > max) throw new Error(name + "_REQUIRED");
  return v;
}

export function applyControlledCypressLaunchAtStartup(
  release: RuntimeReleaseIdentity,
  source: NodeJS.ProcessEnv = process.env,
): CutoverResult {
  if (source.AMOS_CYPRESS_LAUNCH_IMPORT_AUTHORIZED !== "true") {
    return { status: "NOT_REQUESTED" };
  }
  if (!env.isProduction || env.isStaging) {
    throw new Error("CYPRESS_LAUNCH_PRODUCTION_ONLY");
  }
  if (!release.verified) {
    throw new Error("CYPRESS_LAUNCH_RELEASE_IDENTITY_UNVERIFIED");
  }
  if (source.AMOS_PRODUCTION_RELEASE_AUTHORIZED !== "true") {
    throw new Error("CYPRESS_LAUNCH_PRODUCTION_OWNER_AUTHORIZATION_REQUIRED");
  }
  const approval = required(source, "AMOS_CYPRESS_LAUNCH_FINAL_APPROVAL_REFERENCE");
  if (!/^EG-AMOSOPS-G3-LAUNCH-[A-Za-z0-9._-]{8,80}$/.test(approval)) {
    throw new Error("CYPRESS_LAUNCH_FINAL_APPROVAL_REFERENCE_INVALID");
  }
  const targetSha = required(source, "AMOS_CYPRESS_LAUNCH_TARGET_COMMIT_SHA", 40);
  if (!/^[0-9a-f]{40}$/.test(targetSha) || release.commitSha !== targetSha) {
    throw new Error("CYPRESS_LAUNCH_SOURCE_SHA_MISMATCH");
  }
  const backup = required(source, "AMOS_CYPRESS_LAUNCH_VERIFIED_BACKUP_REFERENCE", 350);
  if (!/^AMOSOPS-PROD-BACKUP-[A-Za-z0-9._/-]{10,250}$/.test(backup)) {
    throw new Error("CYPRESS_LAUNCH_VERIFIED_BACKUP_REFERENCE_INVALID");
  }
  const registrySha256 = required(source, "AMOS_CYPRESS_LAUNCH_REGISTRY_SHA256", 64);
  if (!/^[a-f0-9]{64}$/.test(registrySha256)) {
    throw new Error("CYPRESS_LAUNCH_REGISTRY_SHA256_INVALID");
  }
  const payload = required(source, "AMOS_CYPRESS_LAUNCH_REGISTRY_JSON", 30000);
  if (createHash("sha256").update(payload).digest("hex") !== registrySha256) {
    throw new Error("CYPRESS_LAUNCH_REGISTRY_DIGEST_MISMATCH");
  }
  // Transactional + idempotent; it preserves all existing M1 task progress
  // and intentionally fails if Q04 has been closed without qualified review.
  const result = importProductionCypressLaunchMatrix(payload);
  if (result.actionCount !== 40 || !result.firstAdmissionHold) {
    throw new Error("CYPRESS_LAUNCH_IMPORT_ACCEPTANCE_FAILED");
  }
  return {
    status: "IMPORTED",
    inserted: result.inserted,
    retained: result.retained,
    actionCount: result.actionCount,
    firstAdmissionHold: true,
    registrySha256: result.registrySha256,
    releaseId: release.releaseId,
  };
}
