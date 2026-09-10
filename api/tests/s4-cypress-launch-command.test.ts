import { describe, expect, it } from "vitest";
import {
  buildCypressLaunchCommandPreview,
  getCypressLaunchCommandStatus,
} from "../doctrine/cypress-launch-command";

describe("S4 Cypress Launch Command / Doctrine", () => {
  it("resolves the controlled 10-bed baseline through the bounded S4 capability", () => {
    const result = buildCypressLaunchCommandPreview("controlled_baseline");

    expect(result).toMatchObject({
      environment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      outcome: "READY_FOR_AUTHORIZED_LEVEL",
      requestedLevel: "L5",
      highestVerifiedLevel: "L5",
      licensedCapacity: 10,
      requestedCapacity: 10,
      futureCapacity: 16,
      productionPromotion: "NOT_AUTHORIZED",
      rateDoctrine: {
        floor: 450,
        target: 550,
        enhanced: 650,
        currency: "USD",
      },
    });
    expect(result.exceptions).toHaveLength(0);
    expect(result.doctrine.length).toBeGreaterThan(0);
    expect(result.gates.slice(0, 6).every((gate) => gate.state === "VERIFIED_READY")).toBe(
      true,
    );
    expect(result.gates.slice(6).every((gate) => gate.state === "NOT_AUTHORIZED")).toBe(
      true,
    );
  });

  it("blocks the future 16-bed capacity from superseding the current 10-bed controller", () => {
    const result = buildCypressLaunchCommandPreview("future_capacity_blocked");

    expect(result).toMatchObject({
      outcome: "BLOCKED",
      licensedCapacity: 10,
      requestedCapacity: 16,
      futureCapacity: 16,
      highestVerifiedLevel: "L4",
    });
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({
        code: "CAPACITY_EXPANSION_NOT_AUTHORIZED",
        disposition: "BLOCK",
      }),
    );
    expect(result.trace.find((entry) => entry.step === "Check licensed capacity")?.status).toBe(
      "BLOCKED",
    );
  });

  it("fails closed and withholds doctrine when current authority conflicts", () => {
    const result = buildCypressLaunchCommandPreview("authority_conflict");

    expect(result).toMatchObject({
      outcome: "AUTHORITY_CONFLICT",
      productionPromotion: "NOT_AUTHORIZED",
    });
    expect(result.doctrine).toHaveLength(0);
    expect(result.gates.every((gate) => gate.state === "BLOCKED")).toBe(true);
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({ code: "DOCTRINE_AUTHORITY_CONFLICT" }),
    );
    expect(result.trace[0]).toMatchObject({
      step: "Resolve controlling doctrine",
      status: "BLOCKED",
    });
  });

  it("blocks live production readiness while the SharePoint runtime probe dependency remains open", () => {
    const result = buildCypressLaunchCommandPreview("runtime_dependency");

    expect(result).toMatchObject({
      outcome: "BLOCKED",
      requestedLevel: "L12",
      highestVerifiedLevel: "L5",
      productionPromotion: "NOT_AUTHORIZED",
    });
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({ code: "EXC-S2-01", disposition: "BLOCK" }),
    );
    expect(
      result.trace.find((entry) => entry.step === "Check live-runtime dependency")?.status,
    ).toBe("BLOCKED");
  });

  it("blocks a calendar-based jump to L12 when intervening capabilities are unverified", () => {
    const result = buildCypressLaunchCommandPreview("calendar_bypass_blocked");

    expect(result).toMatchObject({
      outcome: "BLOCKED",
      requestedLevel: "L12",
      highestVerifiedLevel: "L5",
    });
    expect(result.exceptions).toContainEqual(
      expect.objectContaining({ code: "CAPABILITY_GATE_UNMET" }),
    );
    expect(result.gates.find((gate) => gate.level === "L6")?.state).toBe(
      "NOT_AUTHORIZED",
    );
    expect(result.gates.find((gate) => gate.level === "L12")?.state).toBe(
      "NOT_AUTHORIZED",
    );
  });

  it("declares the preview boundary without claiming production authorization", () => {
    expect(getCypressLaunchCommandStatus()).toMatchObject({
      sprint: "Cypress Doctrine Sprint 01",
      stage: "S4",
      previewAvailable: true,
      previewEnvironment: "SYNTHETIC_PREVIEW",
      noPhi: true,
      liveProductionAuthorized: false,
      productionPromotion: "NOT_AUTHORIZED",
    });
  });
});
