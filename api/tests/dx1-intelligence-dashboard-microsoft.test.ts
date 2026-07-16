import { describe, expect, it } from "vitest";
import {
  DX1_DASHBOARD_DOMAINS,
  evaluateDx1MicrosoftSupportRequest,
  runDx1DashboardReconciliation,
  runDx1MicrosoftBoundaryVerification,
  validateDx1DashboardCards,
  type Dx1DashboardCard,
} from "../services/dx1/intelligence";

describe("DX.1 enterprise dashboard and Microsoft support boundary", () => {
  it("reconciles five domains to the same scenario and entity lineage", () => {
    const result = runDx1DashboardReconciliation();
    expect(result.accepted).toBe(true);
    expect(result.cards.map((candidate) => candidate.domain)).toEqual(
      DX1_DASHBOARD_DOMAINS,
    );
    expect(
      new Set(result.cards.map((candidate) => candidate.scenarioId)).size,
    ).toBe(1);
    expect(
      new Set(result.cards.map((candidate) => candidate.referralId)).size,
    ).toBe(1);
    expect(
      new Set(result.cards.map((candidate) => candidate.episodeId)).size,
    ).toBe(1);
    expect(result.validationErrors).toEqual([]);
    expect(result.liveDashboardReads).toBe(0);
    expect(result.liveDashboardWrites).toBe(0);
  });

  it("detects a dashboard scenario drift instead of presenting inconsistency", () => {
    const result = runDx1DashboardReconciliation();
    const drifted = result.cards.map((candidate, index) =>
      index === 0
        ? ({
            ...candidate,
            scenarioId: "SYNTH-DX1-DRIFT",
          } as unknown as Dx1DashboardCard)
        : candidate,
    );
    expect(validateDx1DashboardCards(drifted)).toContain(
      "DX1_DASHBOARD_SCENARIO_DRIFT:operational",
    );
  });

  it("allows only constrained Microsoft support and preserves AMOS authority", () => {
    const result = runDx1MicrosoftBoundaryVerification();
    expect(result.accepted).toBe(true);
    expect(result.supportDecisions).toHaveLength(3);
    expect(
      result.supportDecisions.every(
        (decision) =>
          decision.allowed &&
          decision.decision === "support_only" &&
          decision.amosRetainsAuthority,
      ),
    ).toBe(true);
    expect(result.ownershipDenialDecisions).toHaveLength(4);
    expect(
      result.ownershipDenialDecisions.every(
        (decision) =>
          !decision.allowed && !decision.enterpriseLogicOwnershipTransferred,
      ),
    ).toBe(true);
    expect(result).toMatchObject({
      enterpriseLogicOwnershipTransfers: 0,
      productionRows: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      realNotificationsSent: 0,
    });
  });

  it("denies Microsoft source-of-truth ownership and unknown capabilities", () => {
    expect(
      evaluateDx1MicrosoftSupportRequest({
        channel: "sharepoint",
        requestedCapability: "become_system_of_record",
      }),
    ).toMatchObject({
      allowed: false,
      decision: "denied_enterprise_ownership",
      amosRetainsAuthority: true,
      enterpriseLogicOwnershipTransferred: false,
    });
    expect(() =>
      evaluateDx1MicrosoftSupportRequest({
        channel: "teams",
        requestedCapability: "unregistered_live_action",
      }),
    ).toThrow("DX1_MICROSOFT_CAPABILITY_NOT_REGISTERED");
  });
});
