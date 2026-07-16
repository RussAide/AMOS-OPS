import { describe, expect, it } from "vitest";
import {
  buildM42ActorFromServerIdentity,
  deriveM42ServerIdentity,
  m42ConfigurationDemoInputSchema,
  m42DocumentActionInputSchema,
  m42NilSearchInputSchema,
  m42ScenarioInputSchema,
  m42SearchInputSchema,
} from "../routers/m42";
import { M42_INTEGRATED_SCENARIO_ID } from "../services/m42";

describe("M4.2 router boundary", () => {
  it("derives canonical identity exclusively from server context", () => {
    expect(
      deriveM42ServerIdentity({ id: "session-user-001", role: "administrator" }),
    ).toEqual({ actorId: "session-user-001", role: "administrator" });
    expect(() =>
      deriveM42ServerIdentity({ id: "session-user-002", role: "unknown" }),
    ).toThrow("M42_SERVER_ROLE_NOT_AUTHORIZED");
    const actor = buildM42ActorFromServerIdentity({
      actorId: "session-user-001",
      role: "administrator",
    });
    expect(actor).toMatchObject({ role: "administrator", tier: "T1" });
    expect(actor.actorId).toMatch(/^SYNTH-M42-SESSION-[A-F0-9]{16}$/);
    expect(actor.actorId).not.toContain("session-user-001");
  });

  it("accepts only the registered integrated scenario and bounded iterations", () => {
    expect(
      m42ScenarioInputSchema.parse({
        scenarioId: M42_INTEGRATED_SCENARIO_ID,
        searchIterations: 2,
      }),
    ).toEqual({
      scenarioId: M42_INTEGRATED_SCENARIO_ID,
      searchIterations: 2,
    });
    expect(() =>
      m42ScenarioInputSchema.parse({
        scenarioId: "SYNTH-M42-UNKNOWN",
        searchIterations: 2,
      }),
    ).toThrow();
    expect(() =>
      m42ScenarioInputSchema.parse({
        scenarioId: M42_INTEGRATED_SCENARIO_ID,
        searchIterations: 99,
      }),
    ).toThrow();
  });

  it("bounds document and NIL search input without accepting actor identity", () => {
    expect(
      m42SearchInputSchema.parse({ text: "retention", limit: 10 }),
    ).toEqual({ text: "retention", limit: 10 });
    expect(
      m42NilSearchInputSchema.parse({ query: "youth continuum", limit: 3 }),
    ).toEqual({ query: "youth continuum", limit: 3 });
    expect(() =>
      m42SearchInputSchema.parse({
        text: "retention",
        limit: 10,
        actorId: "spoofed",
      }),
    ).toThrow();
  });

  it("strictly validates interactive document and configuration demo inputs", () => {
    expect(
      m42DocumentActionInputSchema.parse({
        documentId: "SYNTH-DOCUMENT-ENTERPRISE-DOCTRINE",
        action: "content_read",
      }),
    ).toEqual({
      documentId: "SYNTH-DOCUMENT-ENTERPRISE-DOCTRINE",
      action: "content_read",
    });
    expect(() =>
      m42DocumentActionInputSchema.parse({
        documentId: "real-document-1",
        action: "content_read",
      }),
    ).toThrow();
    expect(m42ConfigurationDemoInputSchema.parse({})).toEqual({});
    expect(() =>
      m42ConfigurationDemoInputSchema.parse({
        configKey: "search.result_limit",
        actorId: "spoofed",
      }),
    ).toThrow();
  });
});
