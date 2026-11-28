import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@db/schema";
import { applyPendingMigrations, createDatabaseBackup, restoreDatabaseBackup } from "../data-lifecycle";

const fixture = vi.hoisted(() => ({ db: null as Database.Database | null }));

vi.mock("../queries/connection", () => ({
  getDb: () => drizzle(requireDatabase(), { schema }),
  sqlite: new Proxy({}, {
    get(_target, key) {
      const db = requireDatabase();
      const value: unknown = Reflect.get(db, key);
      return typeof value === "function" ? value.bind(db) : value;
    },
  }),
  currentDataScope: () => "training",
  runWithDataScope: (_scope: string, run: () => unknown) => run(),
}));

vi.mock("../security/identity", () => ({
  resolveIdentityUser(request: Request) {
    const role = request.headers.get("x-synthetic-role");
    return role ? { id: role, role, email: `${role}@example.invalid` } : null;
  },
  resolveRequestedDataScope: () => "training",
}));

function requireDatabase() {
  if (!fixture.db) throw new Error("Set up the synthetic database before calling the router.");
  return fixture.db;
}

const migration = fs.readFileSync("db/migrations/0013_hr_requisitions.sql", "utf8");
const originalSchema = fs.readFileSync("db/migrations/0000_concerned_kronos.sql", "utf8");
const auditSchema = originalSchema.match(/CREATE TABLE `audit_logs` \([\s\S]*?\n\);/)?.[0] ?? "";
const reference = "CYP-QA-REQ-01";
const fields = {
  position: "QA Youth Care Worker",
  department: "GRO",
  supervisor: "QA Supervisor",
  hiringOwner: "QA Hiring Owner",
  approvedHeadcount: 2,
};

async function caller(role = "hr-director") {
  const { appRouter } = await import("../router");
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", { headers: { "x-synthetic-role": role } }),
    resHeaders: new Headers(),
  }).hr;
}

describe("Cypress requisition workflow", () => {
  beforeEach(() => {
    fixture.db = new Database(":memory:");
    fixture.db.exec(auditSchema + migration);
  });

  afterEach(() => {
    fixture.db?.close();
    fixture.db = null;
  });

  it("saves and reopens six fields across callers and keeps audit revisions", async () => {
    const created = await (await caller()).createRequisition({ reference, fields });
    expect(created).toEqual({ reference, ...fields, revision: 1 });
    const freshCaller = await caller();
    expect(await freshCaller.listRequisitions()).toEqual([created]);
    const updated = await freshCaller.updateRequisition({
      reference, revision: created.revision, fields: { ...fields, approvedHeadcount: 3 },
    });
    expect(await freshCaller.listRequisitions()).toEqual([updated]);
    expect(updated).toEqual({ reference, ...fields, approvedHeadcount: 3, revision: 2 });
    expect(requireDatabase().prepare(
      "SELECT entity_id, action, performed_by FROM audit_logs ORDER BY rowid",
    ).all()).toEqual([
      { entity_id: reference, action: "create", performed_by: "hr-director" },
      { entity_id: reference, action: "update", performed_by: "hr-director" },
    ]);
  });

  it("rejects duplicate references and stale edits without changing the saved row", async () => {
    const hr = await caller();
    await hr.createRequisition({ reference, fields });
    await expect(hr.createRequisition({ reference: reference.toLowerCase(), fields }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    await hr.updateRequisition({ reference, revision: 1, fields: { ...fields, approvedHeadcount: 4 } });
    await expect(hr.updateRequisition({ reference, revision: 1, fields }))
      .rejects.toMatchObject({ code: "CONFLICT" });
    expect(await hr.listRequisitions()).toEqual([{ reference, ...fields, approvedHeadcount: 4, revision: 2 }]);
  });

  it("rejects incomplete fields, invalid headcount, and a role without HR access", async () => {
    const hr = await caller();
    await expect(hr.createRequisition({ reference, fields: { ...fields, supervisor: "  " } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(hr.createRequisition({ reference, fields: { ...fields, approvedHeadcount: 1.5 } }))
      .rejects.toMatchObject({ code: "BAD_REQUEST" });
    const excluded = await caller("youth-care-worker");
    await expect(excluded.listRequisitions()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(excluded.createRequisition({ reference, fields })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await hr.listRequisitions()).toEqual([]);
  });

  it("rolls back requisition writes when the audit write fails", async () => {
    const hr = await caller();
    const db = requireDatabase();
    await hr.createRequisition({ reference, fields });
    db.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON audit_logs BEGIN SELECT RAISE(ABORT, 'QA audit failure'); END");
    await expect(hr.createRequisition({ reference: "CYP-QA-REQ-02", fields })).rejects.toThrow();
    await expect(hr.updateRequisition({
      reference, revision: 1, fields: { ...fields, approvedHeadcount: 5 },
    })).rejects.toThrow();
    expect(await hr.listRequisitions()).toEqual([{ reference, ...fields, revision: 1 }]);
  });

  it("applies the migration once and restores the pre-migration data to a separate database", async () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "amos-requisition-"));
    const source = path.join(directory, "before.db");
    const backup = path.join(directory, "checkpoint.db");
    const restored = path.join(directory, "restored.db");
    const migrationDir = path.join(directory, "migrations");
    fs.mkdirSync(migrationDir);
    fs.writeFileSync(path.join(migrationDir, "0013_hr_requisitions.sql"), migration);
    try {
      const db = new Database(source);
      try {
        db.exec(auditSchema);
        db.exec("INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by) VALUES ('existing-audit', 'qa', 'fixture', 'seed', 'QA')");
        await createDatabaseBackup(source, backup);
        expect(applyPendingMigrations(db, migrationDir)).toHaveLength(1);
        expect(applyPendingMigrations(db, migrationDir)).toEqual([]);
        expect(db.prepare("SELECT COUNT(*) AS count FROM hr_requisitions").get()).toEqual({ count: 0 });
        expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
      } finally {
        db.close();
      }
      restoreDatabaseBackup(backup, restored);
      const restoredDb = new Database(restored, { readonly: true });
      try {
        expect(restoredDb.pragma("integrity_check", { simple: true })).toBe("ok");
        expect(restoredDb.prepare("SELECT id FROM audit_logs").get()).toEqual({ id: "existing-audit" });
        expect(restoredDb.prepare("SELECT name FROM sqlite_master WHERE name = 'hr_requisitions'").get()).toBeUndefined();
      } finally {
        restoredDb.close();
      }
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
