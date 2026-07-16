import { describe, expect, it } from "vitest";
import path from "node:path";
import {
  M52_INHERITED_PACKAGE_SHA256,
  M52_INHERITED_SOURCE_SNAPSHOT_SHA256,
  verifyM52InheritedM51BBaseline,
} from "../services/m52/inherited-baseline";

describe("M5.2 inherited M5.1B baseline", () => {
  it("re-executes and verifies the accepted Microsoft 365 integration baseline", async () => {
    const result = await verifyM52InheritedM51BBaseline();
    expect(result).toMatchObject({
      milestone: "M5.1B",
      packageSha256: M52_INHERITED_PACKAGE_SHA256,
      sourceSnapshotSha256: M52_INHERITED_SOURCE_SNAPSHOT_SHA256,
      criteriaExpected: 8,
      criteriaPassed: 8,
      assertionCount: 117,
      productionRows: 0,
      liveExternalCalls: 0,
      deployments: 0,
      githubPushes: 0,
      accepted: true,
      synthetic: true,
    });
    expect(result.artifactVerification).toEqual({
      artifactsAvailable: true,
      packageHashVerified: false,
      sourceSnapshotHashVerified: false,
      sealVerified: false,
      acceptedManifestVerified: true,
      verificationBasis: "accepted-manifest",
    });
  });

  it("is deterministic across repeated evaluation", async () => {
    expect(await verifyM52InheritedM51BBaseline()).toEqual(
      await verifyM52InheritedM51BBaseline(),
    );
  });

  it("fails closed when the sealed inherited artifacts are unavailable", async () => {
    const result = await verifyM52InheritedM51BBaseline({
      milestoneWorkRoot: "/tmp/amos-ops-m52-missing-inherited-baseline",
    });
    expect(result.accepted).toBe(false);
    expect(result.artifactVerification).toEqual({
      artifactsAvailable: false,
      packageHashVerified: false,
      sourceSnapshotHashVerified: false,
      sealVerified: false,
      acceptedManifestVerified: false,
      verificationBasis: "unavailable",
    });
  });

  it("uses the hash-pinned accepted manifest in a standalone deployment", async () => {
    const result = await verifyM52InheritedM51BBaseline({
      milestoneWorkRoot: "/tmp/amos-ops-m52-standalone-deployment",
      acceptedManifestRoot: path.resolve(process.cwd(), "accepted-baselines"),
    });
    expect(result.accepted).toBe(true);
    expect(result.artifactVerification).toEqual({
      artifactsAvailable: true,
      packageHashVerified: false,
      sourceSnapshotHashVerified: false,
      sealVerified: false,
      acceptedManifestVerified: true,
      verificationBasis: "accepted-manifest",
    });
  });
});
