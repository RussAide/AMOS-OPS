import { describe, expect, it } from "vitest";
import { appRouter } from "../router";
import {
  deriveDx1ServerIdentity,
  dx1ScenarioInputSchema,
} from "../routers/dx1";
import { DX1_SCENARIO_ID } from "../services/dx1";

describe("DX.1 router trust boundary", () => {
  it("registers the enterprise demo router on the canonical application router", () => {
    expect(appRouter._def.record.dx1).toBeDefined();
  });

  it("derives identity only from an authorized server context", () => {
    expect(
      deriveDx1ServerIdentity({
        id: "SYNTH-DX1-VIEWER-001",
        role: "administrator",
      }),
    ).toEqual({ actorId: "SYNTH-DX1-VIEWER-001", role: "administrator" });
    expect(() =>
      deriveDx1ServerIdentity({ id: "", role: "administrator" }),
    ).toThrow("DX1_SERVER_ACTOR_ID_REQUIRED");
    expect(() =>
      deriveDx1ServerIdentity({
        id: "SYNTH-DX1-VIEWER-002",
        role: "external-auditor",
      }),
    ).toThrow("DX1_SERVER_ROLE_NOT_AUTHORIZED");
  });

  it("accepts only the frozen scenario and rejects client identity fields", () => {
    expect(dx1ScenarioInputSchema.parse({ scenarioId: DX1_SCENARIO_ID })).toEqual({
      scenarioId: DX1_SCENARIO_ID,
    });
    expect(() =>
      dx1ScenarioInputSchema.parse({
        scenarioId: DX1_SCENARIO_ID,
        actorId: "CLIENT-SPOOFED",
      }),
    ).toThrow();
    expect(() =>
      dx1ScenarioInputSchema.parse({ scenarioId: "future-scenario" }),
    ).toThrow();
  });
});

