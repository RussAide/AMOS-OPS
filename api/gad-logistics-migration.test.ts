import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function applyMigration(db: Database.Database) {
  const migration = readFileSync(
    path.join(process.cwd(), "db/migrations/0011_gad_logistics_r1.sql"),
    "utf8",
  );
  for (const statement of migration.split("--> statement-breakpoint")) {
    const sql = statement.trim();
    if (sql) db.exec(sql);
  }
}

describe("GAD Logistics R1 migration", () => {
  it("creates module-owned request and append-only event storage", () => {
    const db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    applyMigration(db);

    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'gad_logistics_%' ORDER BY name",
      )
      .all() as Array<{ name: string }>;
    expect(tables.map((row) => row.name)).toEqual([
      "gad_logistics_events",
      "gad_logistics_requests",
    ]);

    db.prepare(
      `INSERT INTO gad_logistics_requests
        (id, request_number, origin_division, requester_user_id, requester_role,
         service_type, title, requirement, priority, status, verification_status,
         escalation_level, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "req-1",
      "LOG-2026-TEST0001",
      "gro",
      "user-1",
      "program-director",
      "facilities",
      "Repair request",
      "Restore approved operational readiness.",
      "priority",
      "submitted",
      "pending",
      0,
      "2026-10-03T00:00:00.000Z",
      "2026-10-03T00:00:00.000Z",
    );
    db.prepare(
      `INSERT INTO gad_logistics_events
        (id, request_id, sequence, event_type, actor_user_id, actor_role,
         from_status, to_status, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "evt-1",
      "req-1",
      1,
      "submitted",
      "user-1",
      "program-director",
      null,
      "submitted",
      "2026-10-03T00:00:00.000Z",
    );

    expect(
      (
        db
          .prepare(
            "SELECT COUNT(*) AS count FROM gad_logistics_events WHERE request_id = ?",
          )
          .get("req-1") as { count: number }
      ).count,
    ).toBe(1);
    expect(() =>
      db.prepare("DELETE FROM gad_logistics_requests WHERE id = ?").run("req-1"),
    ).toThrow();

    db.close();
  });
});
