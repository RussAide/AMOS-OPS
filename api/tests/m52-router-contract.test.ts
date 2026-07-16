import { describe, expect, it } from "vitest";
import { M52_INTEGRATED_SCENARIO_ID } from "@contracts/m52/integrated-scenario";
import {
  deriveM52ServerIdentity,
  m52ScenarioInputSchema,
} from "../routers/m52";

describe("M5.2 router trust boundary", () => {
  it("derives identity only from an authorized server context", () => {
    expect(
      deriveM52ServerIdentity({
        id: "SYNTH-M52-VIEWER-001",
        role: "administrator",
      }),
    ).toEqual({
      actorId: "SYNTH-M52-VIEWER-001",
      role: "administrator",
    });
    expect(() =>
      deriveM52ServerIdentity({ id: "", role: "administrator" }),
    ).toThrow("M52_SERVER_ACTOR_ID_REQUIRED");
    expect(() =>
      deriveM52ServerIdentity({
        id: "SYNTH-M52-VIEWER-002",
        role: "external-auditor",
      }),
    ).toThrow("M52_SERVER_ROLE_NOT_AUTHORIZED");
  });

  it("accepts only the frozen scenario ID and no client identity fields", () => {
    expect(
      m52ScenarioInputSchema.parse({
        scenarioId: M52_INTEGRATED_SCENARIO_ID,
      }),
    ).toEqual({ scenarioId: M52_INTEGRATED_SCENARIO_ID });
    expect(() =>
      m52ScenarioInputSchema.parse({
        scenarioId: M52_INTEGRATED_SCENARIO_ID,
        actorId: "CLIENT-SPOOFED",
      }),
    ).toThrow();
    expect(() =>
      m52ScenarioInputSchema.parse({ scenarioId: "future-scenario" }),
    ).toThrow();
  });
});
