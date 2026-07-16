import { describe, expect, it } from "vitest";
import {
  M22_SCENARIO_IDS,
  runM22RepresentativeScenario,
} from "../services/mhtcm";

describe("M2.2 permission and audit evidence", () => {
  it("enforces full-case and minimum-necessary revenue boundaries", () => {
    const result = runM22RepresentativeScenario();
    expect(result.permissionEvidence).toEqual({
      caseManagerOwnCase: "allowed",
      qaFullCaseReview: "allowed",
      revenueFullCaseAccess: "denied",
      revenueBillingProjection: "allowed",
    });
    expect(result.snapshot.auditEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          action: "access_denied",
          actorRole: "revenue-cycle-manager",
        }),
        expect.objectContaining({
          action: "access_allowed",
          entityType: "mhtcm_billing_projection",
          actorRole: "revenue-cycle-manager",
        }),
      ]),
    );
  });

  it("records immutable reasoned events under one stable case correlation", () => {
    const events = runM22RepresentativeScenario().snapshot.auditEvents;
    expect(events.length).toBeGreaterThanOrEqual(25);
    expect(new Set(events.map((event) => event.id)).size).toBe(events.length);
    expect(new Set(events.map((event) => event.correlationId))).toEqual(
      new Set([`M22-CORR-${M22_SCENARIO_IDS.caseId}`]),
    );
    expect(
      events.every(
        (event) =>
          event.reason.length > 0 && event.evidenceClass === "synthetic_demo",
      ),
    ).toBe(true);
    expect(
      events.some(
        (event) =>
          event.action === "plan_approved" &&
          event.changedFields.includes("status"),
      ),
    ).toBe(true);
    expect(
      events.some((event) => event.action === "claim_handoff_created"),
    ).toBe(true);
  });
});
