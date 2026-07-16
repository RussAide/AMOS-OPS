import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  M41C_BHC_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED,
  bhcRouter,
  buildBhcGovernedOutcomeMeasureReference,
  quarantineBhcUngovernedOutcomeInstrument,
} from "../routers/bhc";
import {
  M41C_M5_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED,
  m5Router,
  quarantineM5UngovernedOutcomeInstrument,
} from "../routers/m5";

function readRouter(name: "bhc" | "m5"): string {
  return readFileSync(
    new URL(`../routers/${name}.ts`, import.meta.url),
    "utf8",
  );
}

function procedureBoundary(
  source: string,
  procedure: string,
  nextProcedureOrComment: string,
): string {
  return source.slice(
    source.indexOf(`${procedure}:`),
    source.indexOf(nextProcedureOrComment, source.indexOf(`${procedure}:`)),
  );
}

describe("M4.1C mounted outcome-measure procedure quarantine", () => {
  it("uses the same deterministic ungoverned-instrument error in BHC and M5", () => {
    expect(() => quarantineBhcUngovernedOutcomeInstrument()).toThrow(
      M41C_BHC_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED,
    );
    expect(() => quarantineM5UngovernedOutcomeInstrument()).toThrow(
      M41C_M5_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED,
    );
    expect(M41C_BHC_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED).toBe(
      M41C_M5_UNGOVERNED_INSTRUMENT_LOGIC_QUARANTINED,
    );
  });

  it("hard-quarantines both create procedures before database access", () => {
    const bhcBoundary = procedureBoundary(
      readRouter("bhc"),
      "createOutcomeMeasure",
      "getOutcomeTrends:",
    );
    const m5Boundary = procedureBoundary(
      readRouter("m5"),
      "createOutcomeMeasure",
      "// ─── Insurance Plans",
    );

    for (const boundary of [bhcBoundary, m5Boundary]) {
      const quarantineIndex = boundary.indexOf("quarantine");
      expect(quarantineIndex).toBeGreaterThan(0);
      expect(boundary).not.toContain("getDb()");
      expect(boundary).not.toContain(".insert(outcomeMeasures)");
      expect(boundary).not.toContain(".select().from(outcomeMeasures)");
    }
  });

  it("prevents BHC list, detail, and longitudinal numeric reads", () => {
    const source = readRouter("bhc");
    const boundaries = [
      procedureBoundary(source, "listOutcomeMeasures", "getOutcomeMeasure:"),
      procedureBoundary(source, "getOutcomeMeasure", "createOutcomeMeasure:"),
      procedureBoundary(
        source,
        "getOutcomeTrends",
        "// 6. CANS / TRR ASSESSMENT TOOLS",
      ),
    ];

    for (const boundary of boundaries) {
      expect(boundary).toContain("quarantineBhcUngovernedOutcomeInstrument");
      expect(boundary).not.toContain("getDb()");
      expect(boundary).not.toContain(".from(outcomeMeasures)");
      expect(boundary).not.toContain(".orderBy(outcomeMeasures");
    }
  });

  it("removes raw numeric rows from both patient detail procedures", () => {
    for (const name of ["bhc", "m5"] as const) {
      const source = readRouter(name);
      const boundary = procedureBoundary(
        source,
        "getPatient",
        "createPatient:",
      );
      expect(boundary).not.toContain(".from(outcomeMeasures)");
      expect(boundary).toContain("outcomeMeasures: []");
      expect(boundary).toMatch(
        /buildBhcGovernedOutcomeMeasureReference|legacy_numeric_rows_quarantined/,
      );
      expect(source).toContain("legacy_numeric_rows_quarantined");
    }

    expect(buildBhcGovernedOutcomeMeasureReference("synthetic-subject")).toMatchObject(
      {
        subjectId: "synthetic-subject",
        disposition: "legacy_numeric_rows_quarantined",
        mode: "metadata_only_evaluation",
        liveWrites: 0,
      },
    );
  });

  it("removes M5 legacy numeric seeds while retaining unrelated clinical workflows", () => {
    const source = readRouter("m5");
    const seedBoundary = source.slice(
      source.indexOf("// ─── Seed Data"),
      source.indexOf("// ─── Dashboard KPIs"),
    );

    expect(seedBoundary).not.toContain("omData");
    expect(seedBoundary).not.toContain(".insert(outcomeMeasures)");
    expect(seedBoundary).not.toContain("severityLevel:");
    expect(seedBoundary).not.toMatch(/\bCANS\b/);
    expect(Object.keys(bhcRouter._def.record)).toEqual(
      expect.arrayContaining([
        "listPatients",
        "createPatient",
        "listSessions",
        "createSession",
      ]),
    );
    expect(Object.keys(m5Router._def.record)).toEqual(
      expect.arrayContaining([
        "listPatients",
        "createPatient",
        "listPlans",
        "createSession",
      ]),
    );
  });
});
