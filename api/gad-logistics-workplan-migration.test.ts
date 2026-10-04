import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function apply(db: Database.Database, name: string) {
  const migration = readFileSync(
    path.join(process.cwd(), "db/migrations", name),
    "utf8",
  );
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) db.exec(sql);
  }
}

describe("GAD Logistics R2 workplan migration", () => {
  it("adds module-owned workplans without altering the request/event contract", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    apply(db, "0011_gad_logistics_r1.sql");
    apply(db, "0012_gad_logistics_r2_workplans.sql");

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'gad_logistics_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    expect(tables.map((row) => row.name)).toEqual([
      "gad_logistics_events",
      "gad_logistics_requests",
      "gad_logistics_workplan_items",
    ]);

    db.prepare(
      `INSERT INTO gad_logistics_requests
        (id, request_number, origin_division, requester_user_id, requester_role,
         service_type, title, requirement, priority, status, verification_status,
         escalation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "req-r2",
      "LOG-2026-R2TEST01",
      "gro",
      "requester-1",
      "program-director",
      "transportation",
      "Transportation coordination",
      "Coordinate approved transport support.",
      "priority",
      "assigned",
      "pending",
      0,
      "2026-10-04T00:00:00.000Z",
      "2026-10-04T00:00:00.000Z",
    );

    db.prepare(
      `INSERT INTO gad_logistics_workplan_items
        (id, request_id, owner_user_id, owner_role, title, action_type,
         priority, status, planned_for, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "plan-r2",
      "req-r2",
      "coordinator-1",
      "logistics-coordinator",
      "Confirm vehicle and pickup window",
      "schedule",
      "priority",
      "planned",
      "2026-10-04",
      "manager-1",
      "2026-10-04T00:00:00.000Z",
      "2026-10-04T00:00:00.000Z",
    );

    const item = db
      .prepare(
        "SELECT request_id, owner_role, action_type, status FROM gad_logistics_workplan_items WHERE id = ?",
      )
      .get("plan-r2") as {
      request_id: string;
      owner_role: string;
      action_type: string;
      status: string;
    };

    expect(item).toEqual({
      request_id: "req-r2",
      owner_role: "logistics-coordinator",
      action_type: "schedule",
      status: "planned",
    });

    expect(() =>
      db
        .prepare("DELETE FROM gad_logistics_requests WHERE id = ?")
        .run("req-r2"),
    ).toThrow();

    db.close();
  });
});
