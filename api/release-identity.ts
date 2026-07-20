import fs from "node:fs";
import path from "node:path";

export interface ReleaseIdentity {
  readonly schemaVersion: 1;
  readonly releaseId: string;
  readonly commitSha: string;
  readonly treeSha: string;
  readonly sourceDigest: string;
  readonly frontendArtifactDigest: string;
  readonly backendArtifactDigest: string;
}

export type RuntimeReleaseIdentity =
  | (ReleaseIdentity & {
      readonly verified: true;
      readonly manifestPath: string;
    })
  | {
      readonly verified: false;
      readonly manifestPath: string;
      readonly reason: string;
    };

const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const RELEASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/;

export function parseReleaseIdentity(value: unknown): ReleaseIdentity {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Release manifest must be an object.");
  }
  const source = value as Record<string, unknown>;
  if (source.schemaVersion !== 1) {
    throw new Error("Release manifest schemaVersion must be 1.");
  }
  if (typeof source.releaseId !== "string" || !RELEASE_ID.test(source.releaseId)) {
    throw new Error("Release manifest releaseId is invalid.");
  }
  const commitSha = source.commitSha;
  const treeSha = source.treeSha;
  if (typeof commitSha !== "string" || !SHA1.test(commitSha)) {
    throw new Error("Release manifest commitSha must be a lowercase Git SHA.");
  }
  if (typeof treeSha !== "string" || !SHA1.test(treeSha)) {
    throw new Error("Release manifest treeSha must be a lowercase Git SHA.");
  }
  const sourceDigest = source.sourceDigest;
  const frontendArtifactDigest = source.frontendArtifactDigest;
  const backendArtifactDigest = source.backendArtifactDigest;
  if (typeof sourceDigest !== "string" || !SHA256.test(sourceDigest)) {
    throw new Error("Release manifest sourceDigest must be a lowercase SHA-256 digest.");
  }
  if (
    typeof frontendArtifactDigest !== "string" ||
    !SHA256.test(frontendArtifactDigest)
  ) {
    throw new Error(
      "Release manifest frontendArtifactDigest must be a lowercase SHA-256 digest.",
    );
  }
  if (
    typeof backendArtifactDigest !== "string" ||
    !SHA256.test(backendArtifactDigest)
  ) {
    throw new Error(
      "Release manifest backendArtifactDigest must be a lowercase SHA-256 digest.",
    );
  }
  return Object.freeze({
    schemaVersion: 1,
    releaseId: source.releaseId,
    commitSha,
    treeSha,
    sourceDigest,
    frontendArtifactDigest,
    backendArtifactDigest,
  });
}

export function loadRuntimeReleaseIdentity(
  manifestPath = path.resolve(process.cwd(), "dist", "release-manifest.json"),
): RuntimeReleaseIdentity {
  try {
    const manifest = parseReleaseIdentity(
      JSON.parse(fs.readFileSync(manifestPath, "utf8")) as unknown,
    );
    return Object.freeze({ verified: true, manifestPath, ...manifest });
  } catch (error) {
    return Object.freeze({
      verified: false,
      manifestPath,
      reason: error instanceof Error ? error.message : "Release manifest unavailable.",
    });
  }
}
