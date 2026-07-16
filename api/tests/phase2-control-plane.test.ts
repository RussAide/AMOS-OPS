import { describe, expect, it } from "vitest";
import {
  addUtcDays,
  addUtcHours,
  assertSyntheticBoundary,
  changedFieldNames,
  claimHandoffAllowed,
  daysBetween,
  evaluateDeadline,
  stablePhase2Id,
  type Phase2ClaimHandoff,
} from "@contracts/phase2";

describe("Phase 2 shared control plane", () => {
  it("calculates all milestone deadlines deterministically", () => {
    const start = "2026-07-14T12:00:00.000Z";
    expect(addUtcDays(start, 14)).toBe("2026-07-28T12:00:00.000Z");
    expect(addUtcDays(start, 30)).toBe("2026-08-13T12:00:00.000Z");
    expect(addUtcDays(start, 90)).toBe("2026-10-12T12:00:00.000Z");
    expect(addUtcDays(start, 180)).toBe("2027-01-10T12:00:00.000Z");
    expect(addUtcHours(start, 1)).toBe("2026-07-14T13:00:00.000Z");
    expect(addUtcHours(start, 24)).toBe("2026-07-15T12:00:00.000Z");
    expect(daysBetween(start, addUtcDays(start, 30))).toBe(30);
  });

  it("returns exact due and overdue states", () => {
    const due = "2026-07-15T12:00:00.000Z";
    expect(evaluateDeadline(due, "2026-07-15T11:59:59.000Z")).toBe("upcoming");
    expect(evaluateDeadline(due, due)).toBe("due");
    expect(evaluateDeadline(due, "2026-07-15T12:00:00.001Z")).toBe("overdue");
    expect(evaluateDeadline(due, "2026-07-16T12:00:00.000Z", due)).toBe("completed");
  });

  it("creates stable IDs and detects material changes", () => {
    expect(stablePhase2Id("SYNTH-WORK", "A", "B")).toBe(stablePhase2Id("SYNTH-WORK", "A", "B"));
    expect(stablePhase2Id("SYNTH-WORK", "A", "B")).not.toBe(stablePhase2Id("SYNTH-WORK", "A", "C"));
    expect(changedFieldNames({ a: 1, b: 2 }, { a: 1, b: 3, c: true })).toEqual(["b", "c"]);
  });

  it("enforces the synthetic-only sprint boundary", () => {
    expect(() => assertSyntheticBoundary({ id: "SYNTH-EPISODE-001", evidenceClass: "synthetic_demo" })).not.toThrow();
    expect(() => assertSyntheticBoundary({ id: "EPISODE-001", evidenceClass: "synthetic_demo" })).toThrow("PHASE2_SYNTHETIC_BOUNDARY_VIOLATION");
    expect(() => assertSyntheticBoundary({ id: "SYNTH-EPISODE-001", evidenceClass: "production" })).toThrow("PHASE2_SYNTHETIC_BOUNDARY_VIOLATION");
  });

  it("keeps claim handoff fail-closed", () => {
    const base: Phase2ClaimHandoff = {
      id: "SYNTH-CLAIM-001", episodeId: "SYNTH-EPISODE-001", program: "MHTCM",
      encounterId: "SYNTH-ENC-001", procedureCode: "T1017", status: "ready", findings: [],
      evaluatorVersion: "2026.07.14", decidedAt: "2026-07-14T12:00:00.000Z",
      correlationId: "SYNTH-CASE-001", evidenceClass: "synthetic_demo",
    };
    expect(claimHandoffAllowed(base)).toBe(true);
    expect(claimHandoffAllowed({ ...base, status: "blocked" })).toBe(false);
    expect(claimHandoffAllowed({ ...base, findings: [{ code: "MISSING_SIGNATURE", message: "Signature required", severity: "error" }] })).toBe(false);
  });
});
