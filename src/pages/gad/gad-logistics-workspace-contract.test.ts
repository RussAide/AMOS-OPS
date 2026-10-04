import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());

describe("GAD Logistics management workspace enhancement", () => {
  it("renders the defined management and coordination cockpit", () => {
    const source = fs.readFileSync(
      path.join(root, "src", "pages", "gad", "gad-logistics-page.tsx"),
      "utf8",
    );

    expect(source).toContain("Management & coordination workflow");
    expect(source).toContain("Service coordination board");
    expect(source).toContain("Planning, dependencies & handoffs");
    expect(source).toContain("Logistics Manager");
    expect(source).toContain("Logistics Coordinator");
    expect(source).toContain("One accountable operating path");
    expect(source).toContain("AMOS-OPS is");
    expect(source).toContain("startup WhatsApp bridge");
  });

  it("does not render the production release banner in the application shell", () => {
    const shell = fs.readFileSync(
      path.join(root, "src", "components", "shell", "app-shell.tsx"),
      "utf8",
    );

    expect(shell).not.toContain("Authorized live operations");
    expect(shell).not.toContain("Release: {runtimeConfig.productionReleaseId}");
  });
});
