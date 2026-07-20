import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("M19 authenticated medication actor policy", () => {
  it("derives the administering identity from the authenticated server context", () => {
    const router = readFileSync(path.resolve("api/routers/m19.ts"), "utf8");
    expect(router).toContain("const actor = ctx.user.email");
    expect(router).not.toContain("input.administeredBy");
    expect(router).not.toMatch(/administeredBy:\s*z\.string/);
  });

  it("does not submit client-selected actors and renders explicit operational empty states", () => {
    const page = readFileSync(
      path.resolve("src/pages/residential/medication-admin-page.tsx"),
      "utf8",
    );
    const shift = readFileSync(
      path.resolve("src/pages/my-shift-page.tsx"),
      "utf8",
    );
    expect(page).not.toContain("Synthetic Nurse 01");
    expect(shift).not.toMatch(/observedBy:\s*["']/);
    expect(shift).not.toMatch(/fromStaffName:\s*["']/);
    expect(shift).toContain("if (!demonstrationWorkspace)");
    expect(shift).toContain("no demonstration schedule has been injected");
    expect(page).toContain(
      "No medication administration records are available.",
    );
    expect(page).toContain(
      "Operational workspaces never receive injected demonstration",
    );
  });

  it("derives observation and handoff authors from authenticated server context", () => {
    const residential = readFileSync(
      path.resolve("api/routers/m18.ts"),
      "utf8",
    );
    const gro = readFileSync(path.resolve("api/routers/gro.ts"), "utf8");
    expect(residential).not.toMatch(/observedBy:\s*z\.string/);
    expect(residential).not.toMatch(/fromStaffName:\s*z\.string/);
    expect(residential).toMatch(/input\.observationDate,\s+actor/);
    expect(residential).toMatch(/input\.handoffDate,\s+actor,\s+"pending"/);
    expect(gro).not.toMatch(/fromStaffName:\s*z\.string/);
    expect(gro).not.toMatch(/toStaffName:\s*z\.string\(\),\s*generalNotes/);
    expect(gro).toContain("fromStaffName: ctx.user.email");
    expect(gro).toContain("toStaffName: ctx.user.email");
  });
});
