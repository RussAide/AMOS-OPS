import { describe, expect, it } from "vitest";
import { ALL_ROLES } from "@/constants/roles";
import {
  authorizeAccess,
  authorizeClientRoute,
  procedureAccessResource,
} from "@/constants/access-control";
import { M41C_SYNTHETIC_SCENARIOS } from "../services/m41c/pathway-orchestrator";
import {
  deriveM41cServerIdentity,
  m41cClinicalGuidanceInputSchema,
  m41cSyntheticScenarioInputSchema,
} from "../routers/m41c";
import { appRouter } from "../router";

const guidanceInput = {
  requestId: "SYNTH-M41C-ROUTER-GUIDANCE-001",
  subjectId: "SYNTH-YOUTH-CONTINUUM-001",
  prompt: "Explain the governed synthetic clinical priority.",
  intent: "what_requires_attention" as const,
  sourceIds: ["M41C-SRC-CONTROLLING-DOCTRINE"],
};

describe("M4.1C authenticated application router and access policy", () => {
  it("mounts the four experience procedures under the application router", () => {
    expect(Object.keys(appRouter._def.record.m41c).sort()).toEqual([
      "askClinicalGuidance",
      "getExperienceSnapshot",
      "getMyClinicalWorkplan",
      "runSyntheticScenario",
    ]);
  });

  it("keeps every M4.1C procedure authenticated", async () => {
    const caller = appRouter.createCaller({
      req: new Request("http://localhost/trpc"),
      resHeaders: new Headers(),
    });
    await expect(caller.m41c.getExperienceSnapshot()).rejects.toThrow(
      "Unauthorized",
    );
    await expect(caller.m41c.getMyClinicalWorkplan()).rejects.toThrow(
      "Unauthorized",
    );
    await expect(
      caller.m41c.askClinicalGuidance(guidanceInput),
    ).rejects.toThrow("Unauthorized");
    await expect(
      caller.m41c.runSyntheticScenario({
        scenarioId: M41C_SYNTHETIC_SCENARIOS[0].id,
      }),
    ).rejects.toThrow("Unauthorized");
  });

  it("admits all 36 roles to the synthetic shell and endpoint-level controls", () => {
    const procedures = [
      ["getExperienceSnapshot", "query"],
      ["getMyClinicalWorkplan", "query"],
      ["askClinicalGuidance", "mutation"],
      ["runSyntheticScenario", "mutation"],
    ] as const;
    for (const [procedure, type] of procedures) {
      const resource = procedureAccessResource(`m41c.${procedure}`, type);
      expect(resource, procedure).toMatchObject({ domain: "self-service" });
      for (const role of ALL_ROLES) {
        expect(
          authorizeAccess({ role }, resource!).allowed,
          `${role}:${procedure}`,
        ).toBe(true);
      }
    }
    for (const role of ALL_ROLES) {
      expect(
        authorizeClientRoute(role, "/clinical/intelligence-fabric").allowed,
        role,
      ).toBe(true);
    }
    expect(authorizeClientRoute("rcs-day", "/clinical").allowed).toBe(false);
    expect(
      authorizeClientRoute("rcs-day", "/clinical/intelligence-fabric").allowed,
    ).toBe(true);
  });

  it("derives actor and role only from authenticated server identity", () => {
    expect(
      deriveM41cServerIdentity({
        id: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
        role: "clinical-director",
      }),
    ).toEqual({
      actorId: "SYNTH-HUMAN-CLINICAL-DIRECTOR",
      role: "clinical-director",
    });
    expect(() =>
      deriveM41cServerIdentity({
        id: "SYNTH-HUMAN-UNKNOWN",
        role: "client-supplied-super-admin",
      }),
    ).toThrow("M41C_SERVER_ROLE_NOT_AUTHORIZED");
  });

  it("rejects client-supplied identity fields and non-synthetic identifiers", () => {
    expect(
      m41cClinicalGuidanceInputSchema.safeParse({
        ...guidanceInput,
        role: "super-admin",
      }).success,
    ).toBe(false);
    expect(
      m41cClinicalGuidanceInputSchema.safeParse({
        ...guidanceInput,
        actorId: "SYNTH-CLIENT-SUPPLIED-ACTOR",
      }).success,
    ).toBe(false);
    expect(
      m41cClinicalGuidanceInputSchema.safeParse({
        ...guidanceInput,
        subjectId: "REAL-YOUTH-001",
      }).success,
    ).toBe(false);
    expect(
      m41cSyntheticScenarioInputSchema.safeParse({
        scenarioId: M41C_SYNTHETIC_SCENARIOS[0].id,
        role: "super-admin",
      }).success,
    ).toBe(false);
    expect(
      m41cSyntheticScenarioInputSchema.safeParse({
        scenarioId: "PRODUCTION-SCENARIO-001",
      }).success,
    ).toBe(false);
  });

  it("retains fail-closed behavior for unknown roles and unmapped paths", () => {
    expect(
      authorizeClientRoute(
        "not-a-canonical-role",
        "/clinical/intelligence-fabric",
      ).allowed,
    ).toBe(false);
    expect(
      authorizeClientRoute(
        "clinical-director",
        "/clinical-intelligence-fabric-unmapped",
      ).allowed,
    ).toBe(false);
    expect(
      authorizeClientRoute("administrator", "/m41c-unmapped-production-console")
        .allowed,
    ).toBe(false);
  });
});
