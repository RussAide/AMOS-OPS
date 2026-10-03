import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());

describe("GAD Logistics Production release control", () => {
  it("builds and stages the governed migration helper before normal startup", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(root, "package.json"), "utf8"),
    ) as { scripts: Record<string, string> };
    const stage = fs.readFileSync(
      path.join(root, "scripts", "production-release-stage.mjs"),
      "utf8",
    );
    const control = fs.readFileSync(
      path.join(
        root,
        "api",
        "release-controls",
        "gad-logistics-production-migrate.ts",
      ),
      "utf8",
    );

    expect(packageJson.scripts["build:server"]).toContain(
      "api/release-controls/gad-logistics-production-migrate.ts",
    );
    expect(packageJson.scripts["start:production-release"]).toBe(
      "node dist/gad-logistics-production-migrate.js && npm run start",
    );
    expect(stage).toContain(
      'startCommand = "npm run start:production-release"',
    );
    expect(stage).toContain('"dist/gad-logistics-production-migrate.js"');

    expect(control).toContain('"0011_gad_logistics_r1.sql"');
    expect(control).toContain(
      '"65a4f1b76dfa105cc8b9b451b7bc66cd5a1850ccf820bf78f0414eccc0615764"',
    );
    expect(control).toContain(
      '"AMOS-OPS-GAD-LOGISTICS-R1-RC3-20261003"',
    );
    expect(control).toContain("createDatabaseBackup");
    expect(control).toContain("applyPendingMigrations");
    expect(control).toContain("validateDatabaseIntegrity");
  });
});
