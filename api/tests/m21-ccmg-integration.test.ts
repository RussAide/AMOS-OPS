import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

type M21Module = typeof import("../routers/m21");
type InitModule = typeof import("../db-init");

const migrationPath = path.resolve("db/migrations/0005_m21_ccmg_oversight.sql");
const moduleDatabasePath = path.join("/tmp", `amos-ops-m21-module-${randomUUID()}.db`);
const originalDatabasePath = process.env.DATABASE_PATH;
const originalNodeEnvironment = process.env.NODE_ENV;

let m21: M21Module;
let dbInit: InitModule;
let db: Database.Database;

function installM21(target: Database.Database): void {
  target.pragma("foreign_keys = ON");
  const statements = fs.readFileSync(migrationPath, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  target.transaction(() => {
    statements.forEach((statement) => target.exec(statement));
  })();
}

function count(target: Database.Database, sql: string): number {
  return (target.prepare(sql).get() as { count: number }).count;
}

function auditActions(target: Database.Database, workItemId?: string): string[] {
  const rows = workItemId
    ? target.prepare("SELECT action FROM m21_ccmg_audit_events WHERE work_item_id = ? ORDER BY occurred_at,id").all(workItemId)
    : target.prepare("SELECT action FROM m21_ccmg_audit_events ORDER BY occurred_at,id").all();
  return (rows as Array<{ action: string }>).map((row) => row.action);
}

beforeAll(async () => {
  process.env.DATABASE_PATH = moduleDatabasePath;
  process.env.NODE_ENV = "test";
  m21 = await import("../routers/m21");
  dbInit = await import("../db-init");
});

beforeEach(() => {
  db = new Database(":memory:");
  installM21(db);
});

afterEach(() => db.close());

afterAll(() => {
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
  if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnvironment;
});

describe("M2.1 CCMG migration and startup posture", () => {
  it("installs four controlled scenarios, executable work, lineage, and no production evidence", () => {
    expect(db.pragma("integrity_check", { simple: true })).toBe("ok");
    expect(db.pragma("foreign_key_check")).toEqual([]);
    expect(count(db, "SELECT COUNT(*) AS count FROM m21_ccmg_referrals")).toBe(4);
    expect(count(db, "SELECT COUNT(*) AS count FROM m21_ccmg_cans_assessments")).toBe(3);
    expect(count(db, "SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage")).toBe(4);
    expect(count(db, "SELECT COUNT(*) AS count FROM m21_ccmg_work_items")).toBe(10);
    expect(count(db, "SELECT COUNT(*) AS count FROM m21_ccmg_handoffs")).toBe(3);
    expect(count(db, "SELECT COUNT(*) AS count FROM m21_ccmg_referrals WHERE evidence_class = 'production'")).toBe(0);
    expect(count(db, "SELECT COUNT(*) AS count FROM m21_ccmg_work_items WHERE id NOT LIKE 'M21-%' OR youth_display_label NOT LIKE 'Synthetic %'")).toBe(0);
  });

  it("creates and idempotently seeds a fresh demo/evaluation database", () => {
    const runtime = new Database(":memory:");
    try {
      runtime.pragma("foreign_keys = ON");
      dbInit.ensureM21CcmgSchema(runtime);
      dbInit.seedM21CcmgSyntheticScenarios(runtime);
      dbInit.seedM21CcmgSyntheticScenarios(runtime);
      expect(count(runtime, "SELECT COUNT(*) AS count FROM m21_ccmg_referrals")).toBe(4);
      expect(count(runtime, "SELECT COUNT(*) AS count FROM m21_ccmg_work_items")).toBe(10);
      expect(count(runtime, "SELECT COUNT(*) AS count FROM m21_ccmg_audit_events")).toBe(5);
      expect(runtime.pragma("foreign_key_check")).toEqual([]);
    } finally {
      runtime.close();
    }
  });

  it("keeps every deterministic runtime-seed column in parity with migration 0005", () => {
    const runtime = new Database(":memory:");
    const tables = [
      "m21_ccmg_referrals",
      "m21_ccmg_cans_assessments",
      "m21_ccmg_plan_lineage",
      "m21_ccmg_work_items",
      "m21_ccmg_handoffs",
      "m21_ccmg_audit_events",
    ] as const;
    const jsonColumns: Readonly<Record<(typeof tables)[number], readonly string[]>> = {
      m21_ccmg_referrals: [],
      m21_ccmg_cans_assessments: ["domain_scores_json", "actionable_items_json"],
      m21_ccmg_plan_lineage: ["mapped_goals_json"],
      m21_ccmg_work_items: [],
      m21_ccmg_handoffs: ["payload_json"],
      m21_ccmg_audit_events: ["before_json", "after_json", "changed_fields_json"],
    };
    const rows = (target: Database.Database, table: (typeof tables)[number]) => (
      target.prepare(`SELECT * FROM ${table} ORDER BY id`).all() as Array<Record<string, unknown>>
    ).map((row) => Object.fromEntries(Object.entries(row).map(([column, value]) => [
      column,
      jsonColumns[table].includes(column) && typeof value === "string" ? JSON.parse(value) : value,
    ])));

    try {
      runtime.pragma("foreign_keys = ON");
      dbInit.ensureM21CcmgSchema(runtime);
      dbInit.seedM21CcmgSyntheticScenarios(runtime);
      tables.forEach((table) => expect(rows(runtime, table), table).toEqual(rows(db, table)));
    } finally {
      runtime.close();
    }
  });

  it("keeps audit evidence immutable", () => {
    expect(() => db.prepare("UPDATE m21_ccmg_audit_events SET reason = 'changed' WHERE id = 'M21-AUDIT-ACCESS-001'").run())
      .toThrow(/M21_AUDIT_IMMUTABLE/);
    expect(() => db.prepare("DELETE FROM m21_ccmg_audit_events WHERE id = 'M21-AUDIT-ACCESS-001'").run())
      .toThrow(/M21_AUDIT_IMMUTABLE/);
  });
});

describe("M2.1 CCMG role-aware reads", () => {
  it("returns canonical queues and minimum-necessary slices", () => {
    const leadership = m21.buildM21OversightDashboard(
      { id: "SYNTH-BHC-DIRECTOR", role: "bhc-director" },
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    );
    expect(leadership.actor.visibleQueueIds).toHaveLength(6);
    expect(leadership.queues).toHaveLength(6);
    expect(leadership.metrics.totalReferrals).toBe(4);
    expect(leadership.metrics).toMatchObject({
      backlogWorkItems: 9,
      qaFindings: 1,
      serviceCoordinationItems: 2,
    });

    const treatment = m21.buildM21OversightDashboard(
      { id: "SYNTH-TREATMENT", role: "treatment-director" },
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    );
    expect(treatment.actor.visibleQueueIds).toEqual(["qa", "cans", "mhtcm"]);
    expect(treatment.metrics).toMatchObject({ backlogWorkItems: 3, qaFindings: 1, serviceCoordinationItems: 1 });

    const revenue = m21.buildM21OversightDashboard(
      { id: "SYNTH-REVENUE", role: "revenue-cycle-manager" },
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    );
    expect(revenue.queues.flatMap((queue) => queue.items).map((item) => item.id)).toEqual(["M21-WORK-URGENT-001"]);

    const gro = m21.buildM21OversightDashboard(
      { id: "SYNTH-GRO", role: "gro-administrator" },
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    );
    expect(gro.queues.flatMap((queue) => queue.items)).toEqual([
      expect.objectContaining({ id: "M21-WORK-CAPACITY-001", youthDisplayLabel: "Synthetic Youth ••••", assignedTo: null }),
    ]);
  });

  it("returns versioned CANS lineage to authorized detail access", () => {
    const detail = m21.buildM21ReferralDetail(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      "M21-REF-EXISTING-001",
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    );
    expect(detail.cansLineage.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(detail.cansLineage.routes).toHaveLength(4);
    expect(detail.audit.accessEventId).toMatch(/^M21-AUDIT-/);
  });

  it("fails closed for dashboard-only, unassigned therapist, and unrelated roles and logs denial", () => {
    expect(() => m21.buildM21ReferralDetail(
      { id: "SYNTH-REVENUE", role: "revenue-cycle-manager" },
      "M21-REF-URGENT-001",
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    )).toThrow(/minimum-necessary dashboard slice/);
    expect(() => m21.buildM21ReferralDetail(
      { id: "SYNTH-UNASSIGNED-THERAPIST", role: "therapist" },
      "M21-REF-EXISTING-001",
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    )).toThrow(/outside the role's CCMG queue scope/);
    const caseManagerDashboard = m21.buildM21OversightDashboard(
      { id: "SYNTH-UNASSIGNED-CASE-MANAGER", role: "case-manager" },
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    );
    expect(caseManagerDashboard.queues.flatMap((queue) => queue.items)).toEqual([]);
    expect(() => m21.buildM21ReferralDetail(
      { id: "SYNTH-UNASSIGNED-CASE-MANAGER", role: "case-manager" },
      "M21-REF-EXISTING-001",
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    )).toThrow(/outside the role's CCMG queue scope/);
    expect(() => m21.buildM21OversightDashboard(
      { id: "SYNTH-HR", role: "hr-director" },
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    )).toThrow(/no CCMG oversight access/);
    expect(auditActions(db)).toEqual(expect.arrayContaining([
      "ccmg_referral_access_denied",
      "ccmg_oversight_access_denied",
    ]));
  });

  it("does not expose another case manager's assigned work through a generic role match", () => {
    db.prepare(`UPDATE m21_ccmg_work_items
      SET assigned_role = 'case-manager', assigned_to = 'SYNTH-OTHER-CM'
      WHERE id = 'M21-WORK-MHTCM-001'`).run();
    const dashboard = m21.buildM21OversightDashboard(
      { id: "SYNTH-CURRENT-CM", role: "case-manager" },
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    );
    expect(dashboard.queues.flatMap((queue) => queue.items)).toEqual([]);
    expect(() => m21.buildM21ReferralDetail(
      { id: "SYNTH-CURRENT-CM", role: "case-manager" },
      "M21-REF-EXISTING-001",
      "synthetic_demo",
      "2026-07-14T12:00:00Z",
      db,
    )).toThrow(/outside the role's CCMG queue scope/);
  });
});

describe("M2.1 CCMG controlled workflow mutations", () => {
  it("executes urgent escalation with optimistic versioning and audit", () => {
    const result = m21.escalateM21Workflow(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      {
        workItemId: "M21-WORK-URGENT-001",
        level: "executive",
        reason: "Critical synthetic authorization remains unresolved.",
        expectedVersion: 2,
      },
      db,
    );
    expect(result.workItem).toMatchObject({ escalationLevel: "executive", version: 3 });
    expect(result.workItem.escalatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(auditActions(db, "M21-WORK-URGENT-001")).toContain("work_item_escalated");
    expect(() => m21.escalateM21Workflow(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      { workItemId: "M21-WORK-URGENT-001", level: "executive", reason: "Stale attempt.", expectedVersion: 2 },
      db,
    )).toThrow(/version conflict/);
  });

  it("opens, resolves, and waives coded exceptions with audit evidence", () => {
    const opened = m21.setM21ExceptionDisposition(
      { id: "SYNTH-INTAKE-COORDINATOR", role: "intake-coordinator" },
      {
        workItemId: "M21-WORK-INTAKE-001",
        disposition: "open",
        exceptionCode: "SYNTH-CONSENT-GAP",
        reason: "Controlled consent evidence requires review.",
        expectedVersion: 1,
      },
      db,
    );
    expect(opened.workItem).toMatchObject({ exceptionStatus: "open", exceptionCode: "SYNTH-CONSENT-GAP", status: "blocked", version: 2 });
    const resolved = m21.setM21ExceptionDisposition(
      { id: "SYNTH-INTAKE-COORDINATOR", role: "intake-coordinator" },
      {
        workItemId: "M21-WORK-INTAKE-001",
        disposition: "resolved",
        reason: "Controlled evidence verified.",
        expectedVersion: 2,
      },
      db,
    );
    expect(resolved.workItem).toMatchObject({ exceptionStatus: "resolved", version: 3 });
    const waived = m21.setM21ExceptionDisposition(
      { id: "SYNTH-INTAKE-COORDINATOR", role: "intake-coordinator" },
      {
        workItemId: "M21-WORK-HELD-001",
        disposition: "waived",
        reason: "Authorized controlled waiver evidence recorded.",
        expectedVersion: 1,
      },
      db,
    );
    expect(waived.workItem.exceptionStatus).toBe("waived");
    expect(auditActions(db)).toEqual(expect.arrayContaining([
      "work_item_exception_open",
      "work_item_exception_resolved",
      "work_item_exception_waived",
    ]));
  });

  it("enforces queue-specific independent approval and persists denied attempts", () => {
    expect(() => m21.approveM21Workflow(
      { id: "SYNTH-BHC-DIRECTOR", role: "bhc-director" },
      { workItemId: "M21-WORK-MED-001", decision: "approved", rationale: "Unauthorized broad oversight attempt.", expectedVersion: 1 },
      db,
    )).toThrow(/not an authorized independent approver/);
    const approved = m21.approveM21Workflow(
      { id: "SYNTH-CLINICAL-DIRECTOR", role: "clinical-director" },
      { workItemId: "M21-WORK-MED-001", decision: "approved", rationale: "Independent medication-management review complete.", expectedVersion: 1 },
      db,
    );
    expect(approved.workItem).toMatchObject({ approvalStatus: "approved", approvedBy: "SYNTH-CLINICAL-DIRECTOR", status: "completed", version: 2 });

    expect(() => m21.approveM21Workflow(
      { id: "SYNTH-TREATMENT-DIRECTOR", role: "treatment-director" },
      { workItemId: "M21-WORK-SELF-APPROVAL-001", decision: "approved", rationale: "Self approval must fail.", expectedVersion: 1 },
      db,
    )).toThrow(/cannot approve their own/);
    const selfRow = db.prepare("SELECT approval_status AS approvalStatus, version FROM m21_ccmg_work_items WHERE id = 'M21-WORK-SELF-APPROVAL-001'").get();
    expect(selfRow).toEqual({ approvalStatus: "pending", version: 1 });
    expect(auditActions(db)).toEqual(expect.arrayContaining(["approval_denied", "work_item_approved"]));
  });

  it("blocks completion while an exception is open", () => {
    db.prepare("UPDATE m21_ccmg_work_items SET exception_code = 'SYNTH-OPEN', exception_reason = 'Controlled open exception.', exception_status = 'open' WHERE id = 'M21-WORK-INTAKE-001'").run();
    expect(() => m21.transitionM21Workflow(
      { id: "SYNTH-INTAKE-COORDINATOR", role: "intake-coordinator" },
      { workItemId: "M21-WORK-INTAKE-001", toStatus: "completed", reason: "Must not complete.", expectedVersion: 1 },
      db,
    )).toThrow(/Open exception must be resolved or waived/);
    expect(auditActions(db, "M21-WORK-INTAKE-001")).toContain("transition_denied");
  });

  it("preserves sender accountability until receiving-owner acceptance and blocks premature completion", () => {
    const initiated = m21.handoffM21Workflow(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      {
        workItemId: "M21-WORK-INTAKE-001",
        toDivision: "BHC",
        toDepartment: "MHTCM",
        dueAt: "2026-07-18T17:00:00Z",
        reason: "Controlled cross-department coordination.",
        expectedVersion: 1,
      },
      db,
    );
    expect(initiated.handoff.status).toBe("initiated");
    expect(initiated.workItem).toMatchObject({
      queueId: "intake",
      assignedDepartment: "CCMG",
      assignedTo: "SYNTH-INTAKE-COORDINATOR",
      version: 2,
    });
    expect(() => m21.transitionM21Workflow(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      { workItemId: "M21-WORK-INTAKE-001", toStatus: "completed", reason: "Premature completion.", expectedVersion: 2 },
      db,
    )).toThrow(/Related handoff must be accepted/);
    expect(() => m21.decideM21Handoff(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      {
        handoffId: initiated.handoff.id,
        decision: "accepted",
        reason: "Wrong receiving role.",
        expectedHandoffVersion: 1,
        expectedWorkItemVersion: 2,
      },
      db,
    )).toThrow(/validated receiving-owner role/);
    const accepted = m21.decideM21Handoff(
      { id: "SYNTH-MHTCM-SUPERVISOR", role: "mhtcm-supervisor" },
      {
        handoffId: initiated.handoff.id,
        decision: "accepted",
        reason: "Receiving owner accepts accountability.",
        expectedHandoffVersion: 1,
        expectedWorkItemVersion: 2,
      },
      db,
    );
    expect(accepted.handoff).toMatchObject({ status: "accepted", acceptedBy: "SYNTH-MHTCM-SUPERVISOR", version: 2 });
    expect(accepted.workItem).toMatchObject({
      queueId: "mhtcm",
      assignedDepartment: "MHTCM",
      assignedRole: "mhtcm-supervisor",
      assignedTo: "SYNTH-MHTCM-SUPERVISOR",
      version: 3,
    });
    const completed = m21.transitionM21Workflow(
      { id: "SYNTH-MHTCM-SUPERVISOR", role: "mhtcm-supervisor" },
      { workItemId: "M21-WORK-INTAKE-001", toStatus: "completed", reason: "Accepted handoff work complete.", expectedVersion: 3 },
      db,
    );
    expect(completed.workItem.status).toBe("completed");
  });

  it.each(["rejected", "returned"] as const)("supports receiving-owner %s disposition with a reason and returns accountability", (decision) => {
    const initiated = m21.handoffM21Workflow(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      {
        workItemId: "M21-WORK-INTAKE-001",
        toDivision: "BHC",
        toDepartment: "MHTCM",
        dueAt: "2026-07-18T17:00:00Z",
        reason: "Controlled handoff decision scenario.",
        expectedVersion: 1,
      },
      db,
    );
    let expectedHandoffVersion = 1;
    let expectedWorkItemVersion = 2;
    if (decision === "returned") {
      const accepted = m21.decideM21Handoff(
        { id: "SYNTH-MHTCM-SUPERVISOR", role: "mhtcm-supervisor" },
        {
          handoffId: initiated.handoff.id,
          decision: "accepted",
          reason: "Accept before controlled return.",
          expectedHandoffVersion,
          expectedWorkItemVersion,
        },
        db,
      );
      expectedHandoffVersion = accepted.handoff.version;
      expectedWorkItemVersion = accepted.workItem.version;
    }
    const result = m21.decideM21Handoff(
      { id: "SYNTH-MHTCM-SUPERVISOR", role: "mhtcm-supervisor" },
      {
        handoffId: initiated.handoff.id,
        decision,
        reason: `Controlled handoff ${decision} reason.`,
        expectedHandoffVersion,
        expectedWorkItemVersion,
      },
      db,
    );
    expect(result.handoff.status).toBe(decision);
    expect(result.handoff.payload).toMatchObject({ decision, decisionReason: `Controlled handoff ${decision} reason.` });
    expect(result.workItem).toMatchObject({
      queueId: "intake",
      assignedDivision: "BHC",
      assignedDepartment: "CCMG",
      assignedRole: "intake-coordinator",
      assignedTo: "SYNTH-INTAKE-COORDINATOR",
      status: "blocked",
      exceptionCode: `HANDOFF_${decision.toUpperCase()}`,
      exceptionStatus: "open",
    });
    const rework = m21.transitionM21Workflow(
      { id: "SYNTH-INTAKE-COORDINATOR", role: "intake-coordinator" },
      {
        workItemId: result.workItem.id,
        toStatus: "in_progress",
        reason: "Begin controlled handoff rework.",
        expectedVersion: result.workItem.version,
      },
      db,
    );
    expect(() => m21.transitionM21Workflow(
      { id: "SYNTH-INTAKE-COORDINATOR", role: "intake-coordinator" },
      {
        workItemId: rework.workItem.id,
        toStatus: "completed",
        reason: "Must remain blocked by handoff exception.",
        expectedVersion: rework.workItem.version,
      },
      db,
    )).toThrow(/Open exception must be resolved or waived/);
  });
});

describe("M2.1 public API contract", () => {
  it("keeps legacy M2.1 procedures and mounts all canonical CCMG procedures", () => {
    expect(Object.keys(m21.m21Router._def.record)).toEqual(expect.arrayContaining([
      "listAudits",
      "listPersonas",
      "getOversightDashboard",
      "getReferralDetail",
      "transitionWorkflow",
      "assignWorkflow",
      "approveWorkflow",
      "handoffWorkflow",
      "escalateWorkflow",
      "setExceptionDisposition",
      "decideHandoff",
      "recordReferralGate",
      "finalizeCansVersion",
      "approveCansTargetRoute",
      "createMedicationOversightAlert",
    ]));
  });

  it("derives mutation actors from authenticated context rather than mutation input", () => {
    const source = fs.readFileSync(path.resolve("api/routers/m21.ts"), "utf8");
    expect(source).toContain("escalateM21Workflow({ id: ctx.user.id, role: ctx.user.role }, input)");
    expect(source).toContain("setM21ExceptionDisposition({ id: ctx.user.id, role: ctx.user.role }, input)");
    expect(source).toContain("decideM21Handoff({ id: ctx.user.id, role: ctx.user.role }, input)");
    expect(source).toContain("recordM21ReferralGate({ id: ctx.user.id, role: ctx.user.role }, input)");
    expect(source).toContain("finalizeM21CansVersion({ id: ctx.user.id, role: ctx.user.role }, input)");
    expect(source).toContain("approveM21CansTargetRoute({ id: ctx.user.id, role: ctx.user.role }, input)");
    expect(source).toContain("createM21MedicationOversightAlert({ id: ctx.user.id, role: ctx.user.role }, input)");
    expect(source).not.toMatch(/actorRole:\s*z\./);
  });
});
