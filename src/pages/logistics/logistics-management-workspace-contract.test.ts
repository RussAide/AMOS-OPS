import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(process.cwd());

describe("Logistics Management & Coordination R2 workspace contract", () => {
  it("publishes first-class Logistics operating spaces", () => {
    const source = fs.readFileSync(
      path.join(
        root,
        "src",
        "pages",
        "logistics",
        "logistics-management-workspace.tsx",
      ),
      "utf8",
    );

    for (const label of [
      "Logistics Management & Coordination",
      "Logistics Manager Workspace",
      "Logistics Coordinator Workspace",
      "Service Coordination Board",
      "Workplans & Schedule",
      "Verification & Closeout",
      "Manager action queue",
      "My execution queue",
      "My Today / My Week",
      "Requesting operation ↔ Logistics interaction",
      "One accountable operating path",
      "Startup messaging, including WhatsApp",
    ]) {
      expect(source).toContain(label);
    }

    for (const stage of [
      "Intake",
      "Triage",
      "Plan & Assign",
      "Execute",
      "Dependency Follow-up",
      "Verify",
      "Close",
    ]) {
      expect(source).toContain(stage);
    }
  });

  it("promotes Logistics in the sidebar and demotes transportation to a service label", () => {
    const source = fs.readFileSync(
      path.join(root, "src", "data", "sidebar-navigation.ts"),
      "utf8",
    );

    expect(source).toContain('"Logistics Management & Coordination"');
    expect(source).toContain('"Logistics Manager Workspace"');
    expect(source).toContain('"Logistics Coordinator Workspace"');
    expect(source).toContain('"Workplans and Schedule"');
        expect(source).not.toContain('"Transportation and Logistics"');
    expect(source).not.toContain('"Transportation Services"');
  });

  it("binds workplans to Logistics-owned storage rather than the shared core work queue", () => {
    const migration = fs.readFileSync(
      path.join(
        root,
        "db",
        "migrations",
        "0012_gad_logistics_r2_workplans.sql",
      ),
      "utf8",
    );
    const service = fs.readFileSync(
      path.join(root, "api", "services", "gad-logistics.ts"),
      "utf8",
    );

    expect(migration).toContain("gad_logistics_workplan_items");
    expect(migration).toContain("REFERENCES `gad_logistics_requests`");
    expect(migration).not.toContain("work_queue");
    expect(service).toContain("createLogisticsWorkplanItem");
    expect(service).toContain("updateLogisticsWorkplanItem");
  });
});
