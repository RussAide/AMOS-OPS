import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { runM51AIntegratedScenario } from "../../m51a/integrated-scenario";

export const M51B_INHERITED_PACKAGE_SHA256 =
  "fcdab3823e6e28d83cf74819caf05379c2fb4df34cec6fcdaccbc7069ef45489" as const;
export const M51B_INHERITED_SOURCE_SNAPSHOT_SHA256 =
  "801a2ce73e76553c05e926186f97eb5575cf045d528d3102b70f71923666ae70" as const;
export const M51B_INHERITED_ACCEPTED_MANIFEST_SHA256 =
  "ee2ed9e4f9589b3c275a62c76646a68efe5b5d960add36406bf6d6adfa8582af" as const;

const M51A_PACKAGE_NAME =
  "AMOS-OPS_M5_1A_Operations_Hub_and_Microsoft_DMS_Connector_Architecture_Package_v1_0.zip";
const M51A_SEAL_NAME =
  "AMOS-OPS_M5_1A_Operations_Hub_and_Microsoft_DMS_Connector_Architecture_Package_v1_0_SEAL_RESULT.json";
const M51A_ACCEPTED_MANIFEST_NAME = path.join(
  "accepted-metadata",
  "M5_1A_PACKAGE_MANIFEST.json",
);
const M51A_BUNDLED_MANIFEST_NAME = path.join(
  "M5.1A",
  "M5_1A_PACKAGE_MANIFEST.json",
);

function hashFile(filePath: string): string {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function verifyAcceptedManifest(acceptedManifestPath: string): void {
  if (
    hashFile(acceptedManifestPath) !==
    M51B_INHERITED_ACCEPTED_MANIFEST_SHA256
  )
    throw new Error(
      "M51B_INHERITED_M51A_ACCEPTED_MANIFEST_HASH_MISMATCH",
    );
  const manifest = JSON.parse(
    fs.readFileSync(acceptedManifestPath, "utf8"),
  ) as {
    milestone?: unknown;
    status?: unknown;
    criteriaPassed?: unknown;
    criteriaExpected?: unknown;
    integratedQa?: unknown;
    exitGate?: unknown;
    productionRows?: unknown;
    liveMicrosoftWrites?: unknown;
    sourceSnapshot?: { sha256?: unknown };
  };
  if (
    manifest.milestone !== "M5.1A" ||
    manifest.status !== "complete" ||
    manifest.criteriaPassed !== 8 ||
    manifest.criteriaExpected !== 8 ||
    manifest.integratedQa !== "passed" ||
    manifest.exitGate !== true ||
    manifest.productionRows !== 0 ||
    manifest.liveMicrosoftWrites !== 0 ||
    manifest.sourceSnapshot?.sha256 !==
      M51B_INHERITED_SOURCE_SNAPSHOT_SHA256
  )
    throw new Error("M51B_INHERITED_M51A_ACCEPTED_MANIFEST_MISMATCH");
}

function verifyLocalAcceptedArtifacts(options?: {
  readonly milestoneWorkRoot?: string;
  readonly acceptedManifestRoot?: string;
}) {
  const milestoneWorkRoot =
    options?.milestoneWorkRoot ?? path.dirname(path.dirname(process.cwd()));
  const acceptedManifestRoot =
    options?.acceptedManifestRoot ??
    (options?.milestoneWorkRoot
      ? null
      : path.join(process.cwd(), "accepted-baselines"));
  const packageRoot = path.join(
    milestoneWorkRoot,
    "M5.1A_Operations_Hub_and_Microsoft_DMS_Connector_Architecture",
    "package",
  );
  const packagePath = path.join(packageRoot, M51A_PACKAGE_NAME);
  const sealPath = path.join(packageRoot, M51A_SEAL_NAME);
  const acceptedManifestPath = path.join(
    packageRoot,
    M51A_ACCEPTED_MANIFEST_NAME,
  );
  const bundledManifestPath = acceptedManifestRoot
    ? path.join(acceptedManifestRoot, M51A_BUNDLED_MANIFEST_NAME)
    : null;
  const packageAvailable = fs.existsSync(packagePath);
  const externalSealAvailable = fs.existsSync(sealPath);
  const acceptedManifestAvailable = fs.existsSync(acceptedManifestPath);
  const bundledManifestAvailable = Boolean(
    bundledManifestPath && fs.existsSync(bundledManifestPath),
  );
  if (!packageAvailable && !bundledManifestAvailable)
    return Object.freeze({
      artifactsAvailable: false,
      packageHashVerified: false,
      sourceSnapshotHashVerified: false,
      acceptedManifestVerified: false,
      verificationBasis: "unavailable" as const,
    });

  if (!packageAvailable && bundledManifestPath) {
    verifyAcceptedManifest(bundledManifestPath);
    return Object.freeze({
      artifactsAvailable: true,
      packageHashVerified: false,
      sourceSnapshotHashVerified: false,
      acceptedManifestVerified: true,
      verificationBasis: "accepted-manifest" as const,
    });
  }

  const packageSha256 = hashFile(packagePath);
  if (packageSha256 !== M51B_INHERITED_PACKAGE_SHA256)
    throw new Error("M51B_INHERITED_M51A_PACKAGE_HASH_MISMATCH");
  if (externalSealAvailable) {
    const seal = JSON.parse(fs.readFileSync(sealPath, "utf8")) as {
      milestone?: unknown;
      status?: unknown;
      sha256?: unknown;
      canonicalSourceSnapshot?: { sha256?: unknown };
    };
    if (
      seal.milestone !== "M5.1A" ||
      seal.status !== "PASS" ||
      seal.sha256 !== packageSha256
    )
      throw new Error("M51B_INHERITED_M51A_SEAL_MISMATCH");
    if (
      seal.canonicalSourceSnapshot?.sha256 !==
      M51B_INHERITED_SOURCE_SNAPSHOT_SHA256
    )
      throw new Error(
        "M51B_INHERITED_M51A_SOURCE_SNAPSHOT_HASH_MISMATCH",
      );
  } else if (acceptedManifestAvailable) verifyAcceptedManifest(acceptedManifestPath);
  else if (bundledManifestPath) verifyAcceptedManifest(bundledManifestPath);
  else throw new Error("M51B_INHERITED_M51A_ACCEPTED_METADATA_MISSING");
  return Object.freeze({
    artifactsAvailable: true,
    packageHashVerified: true,
    sourceSnapshotHashVerified: true,
    acceptedManifestVerified: !externalSealAvailable,
    verificationBasis: externalSealAvailable
      ? ("package-and-external-seal" as const)
      : ("package-and-accepted-manifest" as const),
  });
}

export async function verifyM51BInheritedM51ABaseline(options?: {
  readonly milestoneWorkRoot?: string;
  readonly acceptedManifestRoot?: string;
}) {
  const result = await runM51AIntegratedScenario();
  const artifactVerification = verifyLocalAcceptedArtifacts(options);
  const acceptanceIds = result.acceptanceFlags.map((flag) => flag.criterionId);
  const accepted =
    result.accepted &&
    result.totals.acceptanceCriteria === 8 &&
    result.totals.passedCriteria === 8 &&
    result.acceptanceFlags.every((flag) => flag.passed) &&
    result.inventory.accepted &&
    result.connectorRegistry.modeOperations.modeMismatches === 0 &&
    result.stableIdentity.validationErrors.length === 0 &&
    result.pilot.accepted &&
    result.security.accepted &&
    result.totals.securityViolations === 0 &&
    result.totals.productionRows === 0 &&
    result.totals.liveMicrosoftWrites === 0 &&
    result.boundary.syntheticOnly &&
    result.boundary.realDataUsed === false &&
    (!artifactVerification.artifactsAvailable ||
      (artifactVerification.packageHashVerified &&
        artifactVerification.sourceSnapshotHashVerified) ||
      artifactVerification.acceptedManifestVerified);
  return Object.freeze({
    milestone: "M5.1A" as const,
    packageSha256: M51B_INHERITED_PACKAGE_SHA256,
    sourceSnapshotSha256: M51B_INHERITED_SOURCE_SNAPSHOT_SHA256,
    acceptanceIds: Object.freeze(acceptanceIds),
    criteriaPassed: result.totals.passedCriteria,
    criteriaExpected: result.totals.acceptanceCriteria,
    connectorModeMismatches:
      result.connectorRegistry.modeOperations.modeMismatches,
    stableIdentityIssues: result.stableIdentity.validationErrors.length,
    securityViolations: result.totals.securityViolations,
    productionRows: result.totals.productionRows,
    liveMicrosoftWrites: result.totals.liveMicrosoftWrites,
    artifactVerification,
    accepted,
    synthetic: true as const,
  });
}
