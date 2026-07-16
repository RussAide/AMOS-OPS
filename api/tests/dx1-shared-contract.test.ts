import { describe, expect, it } from "vitest";
import {
  DX1_CRITERION_IDS,
  DX1_ENTERPRISE_DOMAINS,
  DX1_PILOT_STAGE_IDS,
  DX1_SCENARIO_ID,
  createDx1PrototypeBoundary,
} from "../services/dx1/contracts";
import {
  DX1_PILOT_FIXTURE,
  DX1_SYNTHETIC_PERSONAS,
} from "../services/dx1/fixtures";

describe("DX.1 shared cross-enterprise contract", () => {
  it("freezes all twelve criteria and the exact eight-stage pilot", () => {
    expect(DX1_CRITERION_IDS).toHaveLength(12);
    expect(new Set(DX1_CRITERION_IDS).size).toBe(12);
    expect(DX1_PILOT_STAGE_IDS).toEqual([
      "referral-received",
      "intake-review",
      "cans-trr-support",
      "authorization-setup",
      "service-delivery",
      "qa-documentation-review",
      "billing-gate",
      "executive-risk-revenue-summary",
    ]);
    expect(DX1_PILOT_FIXTURE.scenarioId).toBe(DX1_SCENARIO_ID);
    expect(DX1_PILOT_FIXTURE.expectedStages).toEqual(DX1_PILOT_STAGE_IDS);
  });

  it("uses synthetic personas spanning the enterprise demonstration domains", () => {
    const coveredDomains = new Set(
      DX1_SYNTHETIC_PERSONAS.flatMap((persona) => persona.domains),
    );
    for (const domain of DX1_ENTERPRISE_DOMAINS)
      expect(coveredDomains.has(domain)).toBe(true);
    expect(DX1_SYNTHETIC_PERSONAS.every((persona) => persona.actorId.startsWith("SYNTH-"))).toBe(
      true,
    );
  });

  it("enforces an explicit zero-live prototype boundary", () => {
    expect(createDx1PrototypeBoundary()).toEqual({
      synthetic: true,
      demoMode: true,
      productionRows: 0,
      liveExternalCalls: 0,
      liveMicrosoftReads: 0,
      liveMicrosoftWrites: 0,
      liveClinicalScoringActivations: 0,
      liveLevelOfCareDecisions: 0,
      realNotificationsSent: 0,
      deployments: 0,
      githubPushes: 0,
    });
  });
});

