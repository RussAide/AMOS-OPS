import { describe, expect, it } from "vitest";
import { assertPhase3Synthetic, PHASE3_CRITERIA, phase3DaysBetween, stablePhase3Id } from "@contracts/phase3/shared";

describe("Phase 3 shared contract", () => {
  it("contains every controlling checklist criterion exactly once", () => {
    expect(PHASE3_CRITERIA).toHaveLength(31);
    expect(new Set(PHASE3_CRITERIA).size).toBe(31);
    expect(PHASE3_CRITERIA.filter((id) => id.startsWith("M3.1"))).toHaveLength(7);
    expect(PHASE3_CRITERIA.filter((id) => id.startsWith("M3.2"))).toHaveLength(8);
    expect(PHASE3_CRITERIA.filter((id) => id.startsWith("M3.3"))).toHaveLength(8);
    expect(PHASE3_CRITERIA.filter((id) => id.startsWith("M3.4"))).toHaveLength(8);
  });

  it("uses deterministic IDs and strict synthetic boundaries", () => {
    expect(stablePhase3Id("SYNTH-P3", "one", "two")).toBe(stablePhase3Id("SYNTH-P3", "one", "two"));
    expect(() => assertPhase3Synthetic({ id: "SYNTH-P3-OK", evidenceClass: "synthetic_demo" })).not.toThrow();
    expect(() => assertPhase3Synthetic({ id: "P3-NOT-SYNTH", evidenceClass: "synthetic_demo" })).toThrow("PHASE3_SYNTHETIC_BOUNDARY_VIOLATION");
    expect(() => assertPhase3Synthetic({ id: "SYNTH-P3-BAD", evidenceClass: "production" })).toThrow("PHASE3_SYNTHETIC_BOUNDARY_VIOLATION");
  });

  it("calculates fixed whole-day intervals for prototype metrics", () => {
    expect(phase3DaysBetween("2026-01-01T00:00:00.000Z", "2026-01-30T00:00:00.000Z")).toBe(29);
    expect(() => phase3DaysBetween("2026-02-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z")).toThrow("PHASE3_INVALID_DATE_RANGE");
  });
});

