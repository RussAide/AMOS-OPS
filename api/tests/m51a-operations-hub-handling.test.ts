import { describe, expect, it } from "vitest";
import { M51A_HANDLING_CLASS_CODES } from "@contracts/m51a/operations-hub";
import {
  createSyntheticM51aHandlingClasses,
  evaluateM51aHandlingAction,
  validateM51aHandlingClasses,
} from "../services/m51a/operations-hub/handling-policy";

describe("M5.1A Hub A03 sensitivity and handling containment", () => {
  it("defines all six handling classes with synthetic label and DLP references", () => {
    const classes = createSyntheticM51aHandlingClasses();
    expect(classes).toHaveLength(6);
    expect(classes.map((item) => item.code)).toEqual(
      M51A_HANDLING_CLASS_CODES,
    );
    for (const item of classes) {
      expect(item.syntheticPurviewLabelRef).toMatch(/^SYNTH-PURVIEW-/);
      expect(item.dlpPolicyRef).toMatch(/^SYNTH-DLP-/);
      expect(item.auditRequired).toBe(true);
      expect(item.permissionTrimmed).toBe(true);
      expect(item.livePurviewActivation).toBe(false);
    }
    expect(validateM51aHandlingClasses(classes)).toEqual([]);
  });

  it("allows audited internal guidance while retaining permission trimming", () => {
    for (const handlingClass of [
      "internal-general",
      "internal-controlled",
    ] as const) {
      const decision = evaluateM51aHandlingAction({
        role: "rcs-day",
        handlingClass,
        action: "general_rollup",
      });
      expect(decision).toMatchObject({
        allowed: true,
        metadataOnly: false,
        permissionTrimmed: true,
        livePolicyMutation: false,
      });
    }
  });

  it("blocks every restricted class from general navigation, roll-up, and download", () => {
    for (const handlingClass of [
      "restricted-clinical",
      "restricted-sud-part2",
      "restricted-workforce-financial",
    ] as const) {
      const navigation = evaluateM51aHandlingAction({
        role: "managing-director",
        handlingClass,
        action: "general_navigation",
      });
      const rollup = evaluateM51aHandlingAction({
        role: "managing-director",
        handlingClass,
        action: "general_rollup",
      });
      const download = evaluateM51aHandlingAction({
        role: "managing-director",
        handlingClass,
        action: "download",
      });
      expect(navigation.allowed).toBe(false);
      expect(rollup.allowed).toBe(false);
      expect(download.allowed).toBe(false);
      expect(navigation.reasonCodes).toContain("GENERAL_HUB_EXPOSURE_DENIED");
      expect(download.reasonCodes).toContain(
        "DOWNLOAD_BLOCKED_BY_HANDLING_CLASS",
      );
    }
  });

  it("provides only metadata-trimmed Part 2 discovery to an eligible clinical role", () => {
    const metadata = evaluateM51aHandlingAction({
      role: "therapist",
      handlingClass: "restricted-sud-part2",
      action: "metadata_read",
    });
    const content = evaluateM51aHandlingAction({
      role: "therapist",
      handlingClass: "restricted-sud-part2",
      action: "content_read",
    });
    expect(metadata).toMatchObject({ allowed: true, metadataOnly: true });
    expect(content).toMatchObject({ allowed: false, metadataOnly: true });
    expect(content.reasonCodes).toContain("METADATA_ONLY_IN_HUB_CONTEXT");
  });

  it("denies restricted clinical metadata to a residential role", () => {
    const decision = evaluateM51aHandlingAction({
      role: "rcs-day",
      handlingClass: "restricted-clinical",
      action: "metadata_read",
    });
    expect(decision.allowed).toBe(false);
    expect(decision.metadataOnly).toBe(true);
    expect(decision.reasonCodes).toContain("RESTRICTED_DOMAIN_PERMISSION_DENIED");
  });

  it("allows workforce/financial metadata only through canonical HR or revenue permission", () => {
    expect(
      evaluateM51aHandlingAction({
        role: "hr-director",
        handlingClass: "restricted-workforce-financial",
        action: "metadata_read",
      }),
    ).toMatchObject({ allowed: true, metadataOnly: true });
    expect(
      evaluateM51aHandlingAction({
        role: "youth-care-worker",
        handlingClass: "restricted-workforce-financial",
        action: "metadata_read",
      }).allowed,
    ).toBe(false);
  });

  it("fails closed for unknown roles, unknown classes, and insufficient tiers", () => {
    expect(
      evaluateM51aHandlingAction({
        role: "unknown-role",
        handlingClass: "internal-general",
        action: "index",
      }),
    ).toMatchObject({ allowed: false, handlingClass: "internal-general" });
    expect(
      evaluateM51aHandlingAction({
        role: "managing-director",
        handlingClass: "unknown-class",
        action: "index",
      }),
    ).toMatchObject({ allowed: false, handlingClass: "unknown" });
    expect(
      evaluateM51aHandlingAction({
        role: "billing-specialist",
        handlingClass: "confidential",
        action: "metadata_read",
      }).reasonCodes,
    ).toContain("MINIMUM_TIER_REQUIRED:T3");
  });

  it("detects a restricted class that permits roll-up or download", () => {
    const classes = createSyntheticM51aHandlingClasses();
    const corrupted = classes.map((item) =>
      item.code === "restricted-clinical"
        ? {
            ...item,
            generalHubRollupAllowed: true,
            downloadBehavior: "allowed_audited" as const,
          }
        : item,
    );
    expect(validateM51aHandlingClasses(corrupted)).toContain(
      "RESTRICTED_HANDLING_EXPOSURE:restricted-clinical",
    );
  });
});
