import { describe, expect, it } from "vitest";
import { M51B_INTEGRATED_SCENARIO_ID } from "@contracts/m51b/integrated-scenario";
import {
  buildM51BActorFromServerIdentity,
  deriveM51BServerIdentity,
  m51bScenarioInputSchema,
  presentM51BIntegratedResult,
} from "../routers/m51b";
import { runM51BIntegratedScenario } from "../services/m51b";

describe("M5.1B router boundary", () => {
  it("derives canonical identity only from authenticated server context", () => {
    expect(
      deriveM51BServerIdentity({
        id: "session-user-m51b-001",
        role: "administrator",
      }),
    ).toEqual({ actorId: "session-user-m51b-001", role: "administrator" });
    expect(() =>
      deriveM51BServerIdentity({ id: "", role: "administrator" }),
    ).toThrow("M51B_SERVER_ACTOR_ID_REQUIRED");
    expect(() =>
      deriveM51BServerIdentity({
        id: "session-user-m51b-002",
        role: "unregistered-role",
      }),
    ).toThrow("M51B_SERVER_ROLE_NOT_AUTHORIZED");

    const actor = buildM51BActorFromServerIdentity({
      actorId: "session-user-m51b-001",
      role: "administrator",
    });
    expect(actor).toMatchObject({ role: "administrator", tier: "T1" });
    expect(actor.actorId).toMatch(/^SYNTH-M51B-SESSION-[A-F0-9]{16}$/);
    expect(actor.actorId).not.toContain("session-user-m51b-001");
  });

  it("accepts only the registered scenario without caller authority", () => {
    expect(
      m51bScenarioInputSchema.parse({
        scenarioId: M51B_INTEGRATED_SCENARIO_ID,
      }),
    ).toEqual({ scenarioId: M51B_INTEGRATED_SCENARIO_ID });
    expect(() =>
      m51bScenarioInputSchema.parse({
        scenarioId: M51B_INTEGRATED_SCENARIO_ID,
        role: "super-admin",
      }),
    ).toThrow();
    expect(() =>
      m51bScenarioInputSchema.parse({ scenarioId: "SYNTH-M51B-UNKNOWN" }),
    ).toThrow();
  });

  it("presents only the operational proof needed by the experience", async () => {
    const result = presentM51BIntegratedResult(
      await runM51BIntegratedScenario(),
    );
    expect(result).toMatchObject({
      accepted: true,
      channels: {
        teams: { withinThreshold: true, acknowledgementRecorded: true },
        outlook: { exactlyOneIntake: true, duplicatePrevented: true },
        sharepoint: {
          withinThreshold: true,
          governanceGatesPassed: 11,
          governanceGatesTotal: 11,
          governanceGates: {
            registry: true,
            connector_mode: true,
            stable_identity: true,
            permission: true,
            classification: true,
            retention: true,
            lifecycle: true,
            source_of_truth: true,
            intranet_route: true,
            approval: true,
            synthetic_boundary: true,
          },
          reconciliationPassed: true,
        },
      },
      reliability: {
        openDeadLetters: 0,
        recoveredDeadLetters: 1,
        duplicateDeliveries: 0,
        reconciliationAccepted: true,
      },
      boundary: {
        liveGraphCalls: 0,
        liveMicrosoftReads: 0,
        liveMicrosoftWrites: 0,
        productionRows: 0,
      },
    });
    expect("outlook" in result).toBe(false);
  });
});
