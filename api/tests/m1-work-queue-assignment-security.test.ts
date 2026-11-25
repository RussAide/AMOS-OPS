import { describe, expect, it } from "vitest";
import {
  assertWorkTaskAccess,
  canOverseeWorkQueue,
  isExplicitlyAssigned,
  requireWorkQueueLeadership,
  scopeWorkQueueSql,
  type WorkQueuePrincipal,
} from "../work-queue/assignment-access";

const restricted: WorkQueuePrincipal = {
  id: "qa-restricted-id",
  email: "qa.restricted@adolbi.test",
  role: "training-coordinator",
};

const supervisor: WorkQueuePrincipal = {
  id: "qa-owner-id",
  email: "qa.owner@adolbi.test",
  role: "managing-director",
};

describe("M1 My Work assignment-level authorization", () => {
  it("limits ordinary users to their own ID or email in the SQL boundary", () => {
    const params: string[] = [];
    const sql = scopeWorkQueueSql("SELECT * FROM work_queue WHERE 1=1", params, restricted);
    expect(sql).toContain("AND (assigned_to = ? OR lower(assigned_to) = lower(?))");
    expect(params).toEqual([restricted.id, restricted.email]);
  });

  it("never trusts a caller-supplied assignee filter to broaden access", () => {
    const params: string[] = [];
    let sql = scopeWorkQueueSql("SELECT * FROM work_queue WHERE 1=1", params, restricted);
    sql += " AND assigned_to = ?";
    params.push("another-person-id");
    expect(sql).toContain("assigned_to = ? OR lower(assigned_to) = lower(?)");
    expect(params).toEqual([restricted.id, restricted.email, "another-person-id"]);
  });

  it("denies unassigned work to restricted identities", () => {
    expect(isExplicitlyAssigned({ assigned_to: null }, restricted)).toBe(false);
    expect(() => assertWorkTaskAccess({ assigned_to: null }, restricted)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("denies another person's ordinary task and controlled launch task alike", () => {
    expect(() => assertWorkTaskAccess({ assigned_to: "other-user-id" }, restricted)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("allows an explicitly delegated task by immutable user ID", () => {
    const task = { assigned_to: restricted.id };
    expect(isExplicitlyAssigned(task, restricted)).toBe(true);
    expect(() => assertWorkTaskAccess(task, restricted)).not.toThrow();
  });

  it("allows an explicitly delegated task by case-insensitive email", () => {
    const task = { assigned_to: "QA.RESTRICTED@ADOLBI.TEST" };
    expect(isExplicitlyAssigned(task, restricted)).toBe(true);
    expect(() => assertWorkTaskAccess(task, restricted)).not.toThrow();
  });

  it("does not mistake role labels or free-form names for assignments", () => {
    expect(() => assertWorkTaskAccess({ assigned_to: "training-coordinator" }, restricted)).toThrowError(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it.each(["super-admin", "managing-director", "administrator"])(
    "preserves enterprise oversight for %s",
    (role) => {
      const leader = { ...supervisor, role };
      const params: string[] = [];
      expect(canOverseeWorkQueue(leader)).toBe(true);
      expect(scopeWorkQueueSql("SELECT * FROM work_queue", params, leader)).toBe(
        "SELECT * FROM work_queue",
      );
      expect(params).toEqual([]);
      expect(() => assertWorkTaskAccess({ assigned_to: "other-user-id" }, leader)).not.toThrow();
      expect(() => requireWorkQueueLeadership(leader)).not.toThrow();
    },
  );

  it.each(["hr-director", "program-director", "training-coordinator", "eo-contractor"])(
    "does not grant cross-team oversight to %s",
    (role) => {
      const user = { ...restricted, role };
      expect(canOverseeWorkQueue(user)).toBe(false);
      expect(() => requireWorkQueueLeadership(user)).toThrowError(
        expect.objectContaining({ code: "FORBIDDEN" }),
      );
      expect(() => assertWorkTaskAccess({ assigned_to: "other-user-id" }, user)).toThrowError(
        expect.objectContaining({ code: "FORBIDDEN" }),
      );
    },
  );
});
