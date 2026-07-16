import { describe, expect, it } from "vitest";
import {
  buildM51AActorFromServerIdentity,
  deriveM51AServerIdentity,
  m51aRouteInputSchema,
  m51aScenarioInputSchema,
} from "../routers/m51a";
import { M51A_INTEGRATED_SCENARIO_ID } from "../services/m51a";

describe("M5.1A router boundary", () => {
  it("derives canonical identity exclusively from server context", () => {
    expect(
      deriveM51AServerIdentity({
        id: "session-user-m51a-001",
        role: "administrator",
      }),
    ).toEqual({ actorId: "session-user-m51a-001", role: "administrator" });
    expect(() =>
      deriveM51AServerIdentity({ id: "session-user-m51a-002", role: "unknown" }),
    ).toThrow("M51A_SERVER_ROLE_NOT_AUTHORIZED");
    const actor = buildM51AActorFromServerIdentity({
      actorId: "session-user-m51a-001",
      role: "administrator",
    });
    expect(actor).toMatchObject({ role: "administrator", tier: "T1" });
    expect(actor.actorId).toMatch(/^SYNTH-M51A-SESSION-[A-F0-9]{16}$/);
    expect(actor.actorId).not.toContain("session-user-m51a-001");
  });

  it("accepts only the registered scenario and no caller-supplied actor", () => {
    expect(
      m51aScenarioInputSchema.parse({
        scenarioId: M51A_INTEGRATED_SCENARIO_ID,
      }),
    ).toEqual({ scenarioId: M51A_INTEGRATED_SCENARIO_ID });
    expect(() =>
      m51aScenarioInputSchema.parse({
        scenarioId: M51A_INTEGRATED_SCENARIO_ID,
        actorId: "spoofed",
      }),
    ).toThrow();
    expect(() =>
      m51aScenarioInputSchema.parse({ scenarioId: "SYNTH-M51A-UNKNOWN" }),
    ).toThrow();
  });

  it("strictly bounds route resolution to the eleven approved destinations", () => {
    expect(
      m51aRouteInputSchema.parse({ routeCode: "enterprise-dms-search" }),
    ).toEqual({ routeCode: "enterprise-dms-search" });
    expect(() =>
      m51aRouteInputSchema.parse({
        routeCode: "restricted-clinical-records",
      }),
    ).toThrow();
    expect(() =>
      m51aRouteInputSchema.parse({
        routeCode: "home-enterprise-operations",
        role: "super-admin",
      }),
    ).toThrow();
  });
});
