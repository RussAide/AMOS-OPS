import { describe, expect, it } from "vitest";
import {
  M22_AFTERCARE_MAXIMUM_DAYS,
  M22_AUTHORIZATION_ALERT_WINDOW_DAYS,
  M22_AUTHORIZATION_RENEWAL_DAYS,
  M22_BILLABLE_FUNCTIONS,
  M22_DISCHARGE_PLAN_MINIMUM_LEAD_DAYS,
  M22_MHTCM_FUNCTIONS,
  isoDate,
  normalizeMhtcmFunction,
} from "@contracts/mhtcm";
import { addUtcDays, daysBetween } from "@contracts/phase2";

describe("M2.2 controlled contract", () => {
  it("retains the exact six MHTCM functions and four separately billable functions", () => {
    expect(M22_MHTCM_FUNCTIONS).toEqual([
      "intake_screening",
      "eligibility",
      "care_coordination",
      "referral_management",
      "discharge_planning",
      "aftercare_follow_up",
    ]);
    expect(M22_BILLABLE_FUNCTIONS).toEqual([
      "care_coordination",
      "referral_management",
      "discharge_planning",
      "aftercare_follow_up",
    ]);
  });

  it("publishes the deterministic 14-, 30-, and 180-day controls", () => {
    expect(M22_DISCHARGE_PLAN_MINIMUM_LEAD_DAYS).toBe(14);
    expect(M22_AFTERCARE_MAXIMUM_DAYS).toBe(30);
    expect(M22_AUTHORIZATION_RENEWAL_DAYS).toBe(180);
    expect(M22_AUTHORIZATION_ALERT_WINDOW_DAYS).toBe(30);
    expect(isoDate(addUtcDays("2026-07-15T00:00:00.000Z", 30))).toBe(
      "2026-08-14",
    );
    expect(
      daysBetween("2026-06-30T00:00:00.000Z", "2026-07-15T00:00:00.000Z"),
    ).toBe(15);
  });

  it("normalizes legacy labels without expanding the controlled taxonomy", () => {
    expect(normalizeMhtcmFunction("coordination")).toBe("care_coordination");
    expect(normalizeMhtcmFunction("transition")).toBe("discharge_planning");
    expect(normalizeMhtcmFunction("monitoring")).toBe("aftercare_follow_up");
    expect(normalizeMhtcmFunction("future-feature")).toBeNull();
  });
});
