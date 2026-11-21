import { describe, expect, it, vi } from "vitest";

vi.mock("../queries/connection", () => ({
  sqlite: {},
  currentDataScope: () => "training",
}));
vi.mock("../lib/env", () => ({
  env: { isStaging: true, isProduction: false },
}));

import { parseCypressLaunchMatrix } from "./staging-launch-matrix";

function makeFixture() {
  const ids = ["G", "C", "W", "S", "B", "N", "O", "F", "T", "Q"]
    .flatMap((prefix) => [1, 2, 3, 4].map((num) => prefix + "0" + num));
  return ids.map((id, index) => ({
    id,
    title: "Synthetic test " + id,
    priority: index < 14 ? "P0" : index < 28 ? "P1" : index < 37 ? "P2" : "P3",
    original_due: "Mon 23 Nov 2026",
    lead: "Synthetic Team",
    deps: "G01",
    status: id === "Q04" ? "On hold" : "Planned",
    rank: index + 1,
    immediate_action: "Inspect synthetic task and record source link.",
    approval: "Human reviewer",
  }));
}

describe("Adolbi Staging launch-matrix parser", () => {
  it("accepts exactly 40 unique actions, with 14/14/9/3 priority order", () => {
    const rows = parseCypressLaunchMatrix(JSON.stringify(makeFixture()));
    expect(rows).toHaveLength(40);
    expect(rows[0].rank).toBe(1);
    expect(rows[39].rank).toBe(40);
    expect(rows.filter((row) => row.priority === "P0")).toHaveLength(14);
    expect(rows.filter((row) => row.priority === "P1")).toHaveLength(14);
    expect(rows.filter((row) => row.priority === "P2")).toHaveLength(9);
    expect(rows.filter((row) => row.priority === "P3")).toHaveLength(3);
    expect(rows.find((row) => row.id === "Q04")?.status).toBe("On hold");
  });

  it("rejects duplicate action IDs", () => {
    const rows = makeFixture();
    rows[1].id = rows[0].id;
    expect(() => parseCypressLaunchMatrix(JSON.stringify(rows)))
      .toThrow("CYPRESS_LAUNCH_DUPLICATE_OR_UNKNOWN_ID");
  });

  it("rejects incomplete matrices", () => {
    expect(() => parseCypressLaunchMatrix(JSON.stringify(makeFixture().slice(1))))
      .toThrow("CYPRESS_LAUNCH_REQUIRES_40_ACTIONS");
  });

  it("rejects unsupported statuses", () => {
    const rows = makeFixture();
    rows[0].status = "Verified";
    expect(() => parseCypressLaunchMatrix(JSON.stringify(rows)))
      .toThrow("CYPRESS_LAUNCH_INVALID_SOURCE_STATUS");
  });

  it("rejects changes to the approved priority allocation", () => {
    const rows = makeFixture();
    rows[0].priority = "P1";
    expect(() => parseCypressLaunchMatrix(JSON.stringify(rows)))
      .toThrow("CYPRESS_LAUNCH_UNEXPECTED_PRIORITY_DISTRIBUTION");
  });

  it("rejects duplicate rank positions", () => {
    const rows = makeFixture();
    rows[0].rank = 2;
    expect(() => parseCypressLaunchMatrix(JSON.stringify(rows)))
      .toThrow("CYPRESS_LAUNCH_INVALID_RANK");
  });

  it("rejects unrecognized action IDs", () => {
    const rows = makeFixture();
    rows[0].id = "Z01";
    expect(() => parseCypressLaunchMatrix(JSON.stringify(rows)))
      .toThrow("CYPRESS_LAUNCH_DUPLICATE_OR_UNKNOWN_ID");
  });
});
