import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runM51BIntegratedScenario } from "../m51b";

export const M52_INHERITED_PACKAGE_SHA256 =
  "77be4ff4ab28f60f64136caf2d922fa126cc2199fea183c60a60542dd1bfb2dd" as const;
export const M52_INHERITED_SOURCE_SNAPSHOT_SHA256 =
  "06ddf16bddae0c95fb478517e455bcb0f9f1552263204a9223cddc9628705cf2" as const;
export const M52_INHERITED_ACCEPTED_MANIFEST_SHA256 =
  "0827f3f3e51702c2b934308e400752ad55db331dcf9a690261ddbf4d001f3934" as const;

const M51B_PACKAGE_NAME =
  "AMOS-OPS_M5_1B_Microsoft_365_Integration_Package_v1_0.zip";
const M51B_SOURCE_SNAPSHOT_NAME =
  "AMOS-OPS_M5_1B_Canonical_Source_Snapshot_v1_0.zip";
const M51B_SEAL_NAME = "M5_1B_PACKAGE_SEAL_RESULT.json";
const M51B_ACCEPTED_MANIFEST_NAME = path.join(
  "accepted-metadata",
  "M5_1B_PACKAGE_MANIFEST.json",
);
const M51B_BUNDLED_MANIFEST_NAME = path.join(
  "M5.1B",
  "M5_1B_PACKAGE_MANIFEST.json",
);

function hashFile(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function verifyAcceptedManifest(
  acceptedManifestPath: string,
  sourceSnapshotSha256 = M52_INHERITED_SOURCE_SNAPSHOT_SHA256,
): void {
  if (
    hashFile(acceptedManifestPath) !==
    M52_INHERITED_ACCEPTED_MANIFEST_SHA256
  )
    throw new Error(
      "M52_INHERITED_M51B_ACCEPTED_MANIFEST_HASH_MISMATCH",
    );
  const manifest = JSON.parse(
    fs.readFileSync(acceptedManifestPath, "utf8"),
  ) as {
    milestone?: unknown;
    disposition?: unknown;
    acceptanceCriteriaPassed?: unknown;
    assertionCount?: unknown;
    qaStepsPassed?: unknown;
    sourceSnapshotSha256?: unknown;
    productionRows?: unknown;
    liveGraphCalls?: unknown;
    liveMicrosoftReads?: unknown;
    liveMicrosoftWrites?: unknown;
    realNotificationsSent?: unknown;
    productionDeployment?: unknown;
    githubPush?: unknown;
    synthetic?: unknown;
  };
  if (
    manifest.milestone !== "M5.1B" ||
    manifest.disposition !== "ACCEPTED" ||
    manifest.acceptanceCriteriaPassed !== 8 ||
    manifest.assertionCount !== 117 ||
    manifest.qaStepsPassed !== 10 ||
    manifest.sourceSnapshotSha256 !== sourceSnapshotSha256 ||
    manifest.productionRows !== 0 ||
    manifest.liveGraphCalls !== 0 ||
    manifest.liveMicrosoftReads !== 0 ||
    manifest.liveMicrosoftWrites !== 0 ||
    manifest.realNotificationsSent !== 0 ||
    manifest.productionDeployment !== false ||
    manifest.githubPush !== false ||
    manifest.synthetic !== true
  )
    throw new Error("M52_INHERITED_M51B_ACCEPTED_MANIFEST_MISMATCH");
}

function verifyLocalAcceptedArtifacts(
  milestoneWorkRoot: string,
  acceptedManifestRoot: string | null,
) {
  const packageRoot = path.join(
    milestoneWorkRoot,
    "M5.1B_Microsoft_365_Integration",
    "package",
  );
  const packagePath = path.join(packageRoot, M51B_PACKAGE_NAME);
  const sourceSnapshotPath = path.join(
    packageRoot,
    M51B_SOURCE_SNAPSHOT_NAME,
  );
  const sealPath = path.join(packageRoot, M51B_SEAL_NAME);
  const acceptedManifestPath = path.join(
    packageRoot,
    M51B_ACCEPTED_MANIFEST_NAME,
  );
  const bundledManifestPath = acceptedManifestRoot
    ? path.join(acceptedManifestRoot, M51B_BUNDLED_MANIFEST_NAME)
    : null;
  const packageAvailable = fs.existsSync(packagePath);
  const sourceSnapshotAvailable = fs.existsSync(sourceSnapshotPath);
  const externalSealAvailable = fs.existsSync(sealPath);
  const acceptedManifestAvailable = fs.existsSync(acceptedManifestPath);
  const bundledManifestAvailable = Boolean(
    bundledManifestPath && fs.existsSync(bundledManifestPath),
  );
  const anyLocalPackageArtifact =
    packageAvailable ||
    sourceSnapshotAvailable ||
    externalSealAvailable ||
    acceptedManifestAvailable;
  if (!anyLocalPackageArtifact && bundledManifestPath && bundledManifestAvailable) {
    verifyAcceptedManifest(bundledManifestPath);
    return Object.freeze({
      artifactsAvailable: true,
      packageHashVerified: false,
      sourceSnapshotHashVerified: false,
      sealVerified: false,
      acceptedManifestVerified: true,
      verificationBasis: "accepted-manifest" as const,
    });
  }
  if (!anyLocalPackageArtifact) {
    return Object.freeze({
      artifactsAvailable: false,
      packageHashVerified: false,
      sourceSnapshotHashVerified: false,
      sealVerified: false,
      acceptedManifestVerified: false,
      verificationBasis: "unavailable" as const,
    });
  }
  if (!packageAvailable || !sourceSnapshotAvailable)
    throw new Error("M52_INHERITED_M51B_PACKAGE_SET_INCOMPLETE");

  const packageSha256 = hashFile(packagePath);
  const sourceSnapshotSha256 = hashFile(sourceSnapshotPath);
  if (packageSha256 !== M52_INHERITED_PACKAGE_SHA256)
    throw new Error("M52_INHERITED_M51B_PACKAGE_HASH_MISMATCH");
  if (sourceSnapshotSha256 !== M52_INHERITED_SOURCE_SNAPSHOT_SHA256)
    throw new Error("M52_INHERITED_M51B_SOURCE_SNAPSHOT_HASH_MISMATCH");
  if (externalSealAvailable) {
    const seal = JSON.parse(fs.readFileSync(sealPath, "utf8")) as {
      milestone?: unknown;
      status?: unknown;
      disposition?: unknown;
      sha256?: unknown;
      criteriaPassed?: unknown;
      criteriaExpected?: unknown;
      canonicalSourceSnapshot?: { sha256?: unknown };
    };
    if (
      seal.milestone !== "M5.1B" ||
      seal.status !== "PASS" ||
      seal.disposition !== "ACCEPTED" ||
      seal.criteriaPassed !== 8 ||
      seal.criteriaExpected !== 8 ||
      seal.sha256 !== packageSha256 ||
      seal.canonicalSourceSnapshot?.sha256 !== sourceSnapshotSha256
    )
      throw new Error("M52_INHERITED_M51B_SEAL_MISMATCH");
  } else if (acceptedManifestAvailable)
    verifyAcceptedManifest(acceptedManifestPath, sourceSnapshotSha256);
  else if (bundledManifestPath && bundledManifestAvailable)
    verifyAcceptedManifest(bundledManifestPath, sourceSnapshotSha256);
  else throw new Error("M52_INHERITED_M51B_ACCEPTED_METADATA_MISSING");

  return Object.freeze({
    artifactsAvailable: true,
    packageHashVerified: true,
    sourceSnapshotHashVerified: true,
    sealVerified: externalSealAvailable,
    acceptedManifestVerified: !externalSealAvailable,
    verificationBasis: externalSealAvailable
      ? ("package-and-external-seal" as const)
      : ("package-and-accepted-manifest" as const),
  });
}

export async function verifyM52InheritedM51BBaseline(options?: {
  readonly milestoneWorkRoot?: string;
  readonly acceptedManifestRoot?: string;
}) {
  const result = await runM51BIntegratedScenario();
  const milestoneWorkRoot =
    options?.milestoneWorkRoot ?? path.dirname(path.dirname(process.cwd()));
  const acceptedManifestRoot =
    options?.acceptedManifestRoot ??
    (options?.milestoneWorkRoot
      ? null
      : path.join(process.cwd(), "accepted-baselines"));
  const artifactVerification = verifyLocalAcceptedArtifacts(
    milestoneWorkRoot,
    acceptedManifestRoot,
  );
  const accepted =
    result.accepted &&
    result.totals.acceptanceCriteria === 8 &&
    result.totals.passedCriteria === 8 &&
    result.totals.assertionCount === 117 &&
    result.acceptanceFlags.every((flag) => flag.passed) &&
    result.totals.productionRows === 0 &&
    result.totals.liveGraphCalls === 0 &&
    result.totals.liveMicrosoftReads === 0 &&
    result.totals.liveMicrosoftWrites === 0 &&
    result.totals.realNotificationsSent === 0 &&
    result.boundary.realDataUsed === false &&
    result.boundary.productionDeployment === false &&
    result.boundary.githubPush === false &&
    artifactVerification.artifactsAvailable &&
    ((artifactVerification.packageHashVerified &&
      artifactVerification.sourceSnapshotHashVerified &&
      (artifactVerification.sealVerified ||
        artifactVerification.acceptedManifestVerified)) ||
      artifactVerification.acceptedManifestVerified);

  return Object.freeze({
    milestone: "M5.1B" as const,
    packageSha256: M52_INHERITED_PACKAGE_SHA256,
    sourceSnapshotSha256: M52_INHERITED_SOURCE_SNAPSHOT_SHA256,
    criteriaExpected: 8 as const,
    criteriaPassed: result.totals.passedCriteria,
    assertionCount: result.totals.assertionCount,
    artifactVerification,
    productionRows: 0 as const,
    liveExternalCalls: 0 as const,
    deployments: 0 as const,
    githubPushes: 0 as const,
    accepted,
    synthetic: true as const,
  });
}
