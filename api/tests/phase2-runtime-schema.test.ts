import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ensurePhase2ControlSchema, seedPhase2ControlScenario } from "../services/phase2/runtime-schema";

describe("Phase 2 runtime control schema", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => db.close());

  it("initializes and seeds idempotently with no production rows", () => {
    ensurePhase2ControlSchema(db);
    seedPhase2ControlScenario(db);
    seedPhase2ControlScenario(db);
    expect((db.prepare("SELECT COUNT(*) AS count FROM phase2_care_episodes").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM phase2_work_items").get() as { count: number }).count).toBe(3);
    expect((db.prepare("SELECT COUNT(*) AS count FROM phase2_care_links").get() as { count: number }).count).toBe(3);
    expect((db.prepare("SELECT COUNT(*) AS count FROM phase2_audit_events").get() as { count: number }).count).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS count FROM phase2_care_episodes WHERE evidence_class = 'production'").get() as { count: number }).count).toBe(0);
  });

  it("prevents audit mutation", () => {
    seedPhase2ControlScenario(db);
    expect(() => db.prepare("UPDATE phase2_audit_events SET reason = 'changed'").run()).toThrow("PHASE2_AUDIT_IMMUTABLE");
    expect(() => db.prepare("DELETE FROM phase2_audit_events").run()).toThrow("PHASE2_AUDIT_IMMUTABLE");
  });
});
