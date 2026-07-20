import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const groPages = [
  "gro-workspace-page.tsx",
  "shift-log-page.tsx",
  "safety-round-page.tsx",
  "youth-care-log-page.tsx",
  "incident-report-page.tsx",
  "supervision-notes-page.tsx",
] as const;

const sources = Object.fromEntries(
  groPages.map((file) => [
    file,
    readFileSync(path.resolve("src/pages/gro", file), "utf8"),
  ]),
) as Record<(typeof groPages)[number], string>;

describe("GRO operational demonstration-data boundary", () => {
  it.each(groPages)(
    "%s derives the demonstration boundary from verified runtime and workspace state",
    (file) => {
      const source = sources[file];
      expect(source).toContain(
        'runtimeConfig.evaluationMode || workspace === "training"',
      );
      expect(source).toContain("{demonstrationWorkspace && (");
    },
  );

  it.each(groPages)(
    "%s exposes seeding only as an explicitly gated user action",
    (file) => {
      const source = sources[file];
      const seedCalls = source.match(/seedData\.mutate\(\)/g) ?? [];
      expect(seedCalls).toHaveLength(1);
      expect(source).toMatch(
        /\{demonstrationWorkspace && \([\s\S]*?onClick=\{\(\) => seedData\.mutate\(\)\}/,
      );
      expect(source).not.toMatch(/useEffect\([\s\S]{0,400}seedData\.mutate/);
    },
  );

  it("renders explicit connected-data failures without offering a demonstration substitute", () => {
    for (const source of Object.values(sources)) {
      expect(source).toMatch(/No demonstration\s+records\s+were substituted\./);
    }
    expect(sources["shift-log-page.tsx"]).not.toContain(
      "Create a new shift or seed demo data",
    );
  });
});
