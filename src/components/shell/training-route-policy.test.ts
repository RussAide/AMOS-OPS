import { describe, expect, it } from "vitest";
import { isTrainingRouteAllowed } from "./training-route-policy";

describe("Training route policy", () => {
  it.each([
    "/onboarding",
    "/onboarding/training",
    "/onboarding/track/universal-orientation",
    "/onboarding/module/mod-101",
    "/onboarding/module/mod-116",
  ])("allows the pilot orientation route %s", (route) => {
    expect(isTrainingRouteAllowed(route)).toBe(true);
  });

  it.each([
    "/",
    "/admin/settings",
    "/clinical",
    "/onboarding/evidence",
    "/onboarding/supervisor",
    "/onboarding/management",
    "/onboarding/employee/employee-1",
    "/onboarding/unknown",
    "/onboarding/track/clinical-staff",
    "/onboarding/module/mod-001",
    "/onboarding/module/mod-117",
  ])("denies the operational or management route %s", (route) => {
    expect(isTrainingRouteAllowed(route)).toBe(false);
  });
});
