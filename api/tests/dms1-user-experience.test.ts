import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (relative: string) =>
  fs.readFileSync(path.join(root, relative), "utf8");

describe("DMS.1 operational review experience", () => {
  it("keeps deployment governance out of navigation and routes", () => {
    const nav = read("src/data/navData.ts");
    const shell = read("src/components/shell/app-shell.tsx");

    expect(nav).not.toContain("Final Gate");
    expect(nav).not.toContain("/admin/final-gate");
    expect(shell).not.toContain("FinalGatePage");
    expect(shell).not.toContain("/admin/final-gate");
    expect(shell).not.toContain("RELEASE CANDIDATE REVIEW");
    expect(shell).not.toContain("Production pathway");
    expect(shell).not.toContain("Candidate:");
  });

  it("does not expose an in-application deployment approval API or schema", () => {
    const router = read("api/router.ts");
    const databaseInit = read("api/db-init.ts");

    expect(router).not.toContain("releaseGate");
    expect(databaseInit).not.toContain("ensureReleaseGateSchema");
    expect(fs.existsSync(path.join(root, "api/routers/release-gate.ts"))).toBe(false);
    expect(fs.existsSync(path.join(root, "api/release-gate.ts"))).toBe(false);
  });

  it("uses a normal operational workspace identity in the isolated review runtime", () => {
    const runtime = read("api/runtime-mode.ts");

    expect(runtime).toContain('"AMOS-OPS Operational Workspace"');
    expect(runtime).not.toContain("APPROVE DMS.1");
    expect(runtime).not.toContain("RELEASE CANDIDATE REVIEW");
  });
});
