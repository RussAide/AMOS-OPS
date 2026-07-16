import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { RecordReferralGateInput } from "../routers/m21";

type M21Module = typeof import("../routers/m21");

const migrationPath = path.resolve("db/migrations/0005_m21_ccmg_oversight.sql");
const moduleDatabasePath = path.join("/tmp", `amos-ops-m21-e2e-${randomUUID()}.db`);
const controlledTestTime = new Date("2026-07-16T12:00:00Z");
const originalDatabasePath = process.env.DATABASE_PATH;
const originalNodeEnvironment = process.env.NODE_ENV;

let m21: M21Module;
let db: Database.Database;

function installM21(target: Database.Database): void {
  target.pragma("foreign_keys = ON");
  const statements = fs.readFileSync(migrationPath, "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
  target.transaction(() => statements.forEach((statement) => target.exec(statement)))();
}

function count(sql: string, ...params: unknown[]): number {
  return (db.prepare(sql).get(...params) as { count: number }).count;
}

function expectStableCorrelation(auditIds: readonly string[], caseId: string): void {
  const correlations = auditIds.map((id) => (
    db.prepare("SELECT correlation_id AS correlationId FROM m21_ccmg_audit_events WHERE id = ?").get(id) as { correlationId: string }
  ).correlationId);
  expect(new Set(correlations)).toEqual(new Set([`M21-CORR-${caseId}`]));
}

const domainScores = {
  behavioral_emotional: 3,
  risk_behaviors: 3,
  life_functioning: 2,
  strengths: 1,
  caregiver_resources: 2,
  cultural_factors: 0,
} as const;

const actionableItems = [
  { itemCode: "RSK-E2E", label: "controlled safety planning", domain: "risk_behaviors", rating: 3, disposition: "need" },
  { itemCode: "LIF-E2E", label: "controlled daily routine", domain: "life_functioning", rating: 2, disposition: "need" },
  { itemCode: "STR-E2E", label: "controlled community connection", domain: "strengths", rating: 1, disposition: "strength" },
] as const;

beforeAll(async () => {
  process.env.DATABASE_PATH = moduleDatabasePath;
  process.env.NODE_ENV = "test";
  m21 = await import("../routers/m21");
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(controlledTestTime);
  db = new Database(":memory:");
  installM21(db);
});

afterEach(() => {
  db.close();
  vi.useRealTimers();
});

afterAll(() => {
  if (originalDatabasePath === undefined) delete process.env.DATABASE_PATH;
  else process.env.DATABASE_PATH = originalDatabasePath;
  if (originalNodeEnvironment === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalNodeEnvironment;
});

describe("M2.1 true end-to-end care-path closure", () => {
  it("completes a new referral through six gates, final CANS, and both independently approved target routes", () => {
    const auditIds: string[] = [];
    let version = 1;
    const gate = (
      actor: { id: string; role: string },
      input: Omit<RecordReferralGateInput, "referralId" | "expectedVersion">,
    ) => {
      const result = m21.recordM21ReferralGate(actor, {
        referralId: "M21-REF-NEW-001",
        expectedVersion: version,
        ...input,
      } as RecordReferralGateInput, db);
      version = result.referral.version;
      auditIds.push(result.auditEventId);
      return result;
    };

    gate(
      { id: "SYNTH-INTAKE-COORDINATOR", role: "intake-coordinator" },
      { gate: "intake", decision: { status: "complete" }, reason: "Controlled intake complete." },
    );
    gate(
      { id: "SYNTH-QMHP-001", role: "qmhp-cs" },
      {
        gate: "eligibility",
        decision: {
          status: "eligible",
          criteria: { ageQualified: true, diagnosisQualified: true, functionalImpairment: true, coverageQualified: true },
          rationale: "All controlled criteria met.",
        },
        reason: "Controlled eligibility approved.",
      },
    );
    gate(
      { id: "SYNTH-REVENUE-001", role: "revenue-cycle-manager" },
      {
        gate: "payer_authorization",
        decision: {
          payerLabel: "Synthetic Payer Alpha",
          verificationStatus: "verified",
          authorizationRequired: true,
          authorizationStatus: "approved",
          authorizationReference: "SYNTH-AUTH-E2E-NEW",
          effectiveAt: "2026-07-14T00:00:00Z",
          expiresAt: "2026-10-14T23:59:59Z",
        },
        reason: "Controlled payer authorization approved.",
      },
    );
    gate(
      { id: "SYNTH-INTAKE-COORDINATOR", role: "intake-coordinator" },
      {
        gate: "consent",
        decision: {
          status: "active",
          consentReference: "SYNTH-CONSENT-E2E-NEW",
          effectiveAt: "2026-07-14T00:00:00Z",
          expiresAt: "2026-12-31T23:59:59Z",
        },
        reason: "Controlled consent activated.",
      },
    );
    gate(
      { id: "SYNTH-QMHP-001", role: "qmhp-cs" },
      {
        gate: "cans_schedule",
        decision: { status: "scheduled", dueAt: "2026-07-16T17:00:00Z", scheduledFor: "2026-07-15T10:00:00Z" },
        reason: "Controlled CANS scheduled.",
      },
    );
    const ready = gate(
      { id: "SYNTH-GRO-DIRECTOR", role: "program-director" },
      {
        gate: "capacity",
        decision: {
          required: true,
          facilityLabel: "Synthetic GRO Capacity Pool",
          status: "reserved",
          availableSlots: 1,
          reservedSlotReference: "SYNTH-SLOT-E2E-NEW",
          checkedAt: "2026-07-14T12:00:00Z",
        },
        reason: "Controlled capacity reserved.",
      },
    );
    expect(ready.referral).toMatchObject({ status: "ready_for_routing", version: 7 });
    expect(ready.readiness.ready).toBe(true);

    const finalized = m21.finalizeM21CansVersion(
      { id: "SYNTH-QMHP-001", role: "qmhp-cs" },
      {
        referralId: ready.referral.id,
        instrumentVersion: "CANS-SYNTHETIC-2026.1",
        domainScores,
        actionableItems,
        totalScore: 35,
        acuity: "high",
        completedAt: "2026-07-15T11:00:00Z",
        reason: "Controlled CANS finalization.",
        expectedReferralVersion: ready.referral.version,
      },
      db,
    );
    auditIds.push(finalized.auditEventId);
    expect(finalized.assessment).toMatchObject({ version: 1, previousAssessmentId: null, status: "final" });
    expect(finalized.referral).toMatchObject({ status: "ready_for_routing", version: 8 });

    const mhtcm = m21.approveM21CansTargetRoute(
      { id: "SYNTH-TREATMENT-DIRECTOR", role: "treatment-director" },
      {
        referralId: finalized.referral.id,
        cansAssessmentId: finalized.assessment.id,
        targetType: "mhtcm_plan",
        targetRecordId: "SYNTH-MHTCM-E2E-NEW",
        targetVersion: 1,
        reason: "Independent MHTCM route approval.",
        expectedReferralVersion: finalized.referral.version,
      },
      db,
    );
    auditIds.push(mhtcm.approvalAuditEventId, mhtcm.handoffAuditEventId);
    expect(mhtcm.referral.status).toBe("ready_for_routing");
    expect(mhtcm.lineage.mappedGoals.length).toBeGreaterThan(0);
    expect(mhtcm.handoff.status).toBe("accepted");

    const mhrs = m21.approveM21CansTargetRoute(
      { id: "SYNTH-MHRS-SUPERVISOR", role: "mhrs-supervisor" },
      {
        referralId: mhtcm.referral.id,
        cansAssessmentId: finalized.assessment.id,
        targetType: "mhrs_skills_goals",
        targetRecordId: "SYNTH-MHRS-E2E-NEW",
        targetVersion: 1,
        reason: "Independent MHRS route approval.",
        expectedReferralVersion: mhtcm.referral.version,
      },
      db,
    );
    auditIds.push(mhrs.approvalAuditEventId, mhrs.handoffAuditEventId);
    expect(mhrs.referral).toMatchObject({ status: "active", version: 10 });
    expect(count("SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE cans_assessment_id = ?", finalized.assessment.id)).toBe(2);
    expect(count("SELECT COUNT(*) AS count FROM m21_ccmg_work_items WHERE source_type = 'cans_lineage' AND source_id = ?", finalized.assessment.id)).toBe(2);
    expect(count("SELECT COUNT(*) AS count FROM m21_ccmg_handoffs WHERE referral_id = ? AND status = 'accepted'", finalized.referral.id)).toBe(2);
    expectStableCorrelation(auditIds, "M21-CASE-NEW-001");
  });

  it("appends an existing youth's next immutable CANS version and routes only the exact new current version", () => {
    const priorRows = db.prepare("SELECT * FROM m21_ccmg_cans_assessments WHERE referral_id = ? ORDER BY version")
      .all("M21-REF-EXISTING-001");
    const finalized = m21.finalizeM21CansVersion(
      { id: "SYNTH-QMHP-EXISTING", role: "qmhp-cs" },
      {
        referralId: "M21-REF-EXISTING-001",
        instrumentVersion: "CANS-SYNTHETIC-2026.1",
        domainScores,
        actionableItems,
        totalScore: 38,
        acuity: "high",
        completedAt: "2026-07-16T10:00:00Z",
        reason: "Controlled reassessment finalized.",
        expectedReferralVersion: 3,
      },
      db,
    );
    expect(finalized.assessment).toMatchObject({ version: 3, previousAssessmentId: "M21-CANS-EXISTING-V2" });
    expect(db.prepare("SELECT * FROM m21_ccmg_cans_assessments WHERE referral_id = ? AND version <= 2 ORDER BY version")
      .all("M21-REF-EXISTING-001")).toEqual(priorRows);
    expect(() => db.prepare("UPDATE m21_ccmg_cans_assessments SET total_score = 1 WHERE id = ?").run(finalized.assessment.id))
      .toThrow(/M21_CANS_IMMUTABLE/);

    const mhtcm = m21.approveM21CansTargetRoute(
      { id: "SYNTH-MHTCM-SUPERVISOR", role: "mhtcm-supervisor" },
      {
        referralId: finalized.referral.id,
        cansAssessmentId: finalized.assessment.id,
        targetType: "mhtcm_plan",
        targetRecordId: "SYNTH-MHTCM-E2E-V3",
        targetVersion: 3,
        reason: "Approve exact CANS v3 MHTCM route.",
        expectedReferralVersion: finalized.referral.version,
      },
      db,
    );
    const mhrs = m21.approveM21CansTargetRoute(
      { id: "SYNTH-MHRS-SUPERVISOR", role: "mhrs-supervisor" },
      {
        referralId: mhtcm.referral.id,
        cansAssessmentId: finalized.assessment.id,
        targetType: "mhrs_skills_goals",
        targetRecordId: "SYNTH-MHRS-E2E-V3",
        targetVersion: 3,
        reason: "Approve exact CANS v3 MHRS route.",
        expectedReferralVersion: mhtcm.referral.version,
      },
      db,
    );
    expect(mhrs.referral.status).toBe("active");
    expect(count("SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE cans_assessment_id = ?", finalized.assessment.id)).toBe(2);
    expectStableCorrelation(
      [finalized.auditEventId, mhtcm.approvalAuditEventId, mhtcm.handoffAuditEventId, mhrs.approvalAuditEventId, mhrs.handoffAuditEventId],
      "M21-CASE-EXISTING-001",
    );
  });

  it("persists held-to-rejected disposition and denies any post-rejection route", () => {
    const rejected = m21.recordM21ReferralGate(
      { id: "SYNTH-QMHP-INDEPENDENT", role: "qmhp-cs" },
      {
        referralId: "M21-REF-HELD-001",
        gate: "eligibility",
        decision: {
          status: "ineligible",
          criteria: { ageQualified: true, diagnosisQualified: false, functionalImpairment: false, coverageQualified: true },
          rationale: "Controlled evidence does not meet eligibility.",
        },
        reason: "Independent rejection disposition.",
        expectedVersion: 1,
      },
      db,
    );
    expect(rejected.referral).toMatchObject({ status: "rejected", rejectionReason: "Independent rejection disposition.", version: 2 });
    expect(() => m21.approveM21CansTargetRoute(
      { id: "SYNTH-TREATMENT-DIRECTOR", role: "treatment-director" },
      {
        referralId: rejected.referral.id,
        cansAssessmentId: "M21-CANS-EXISTING-V2",
        targetType: "mhtcm_plan",
        targetRecordId: "SYNTH-POST-REJECT",
        targetVersion: 1,
        reason: "Post-rejection route must fail.",
        expectedReferralVersion: rejected.referral.version,
      },
      db,
    )).toThrow(/not eligible for CANS target routing/);
    expect(count("SELECT COUNT(*) AS count FROM m21_ccmg_plan_lineage WHERE referral_id = ?", rejected.referral.id)).toBe(0);
    const deniedAudit = db.prepare(`SELECT correlation_id AS correlationId FROM m21_ccmg_audit_events
      WHERE referral_id = ? AND action = 'cans_target_route_denied' ORDER BY occurred_at DESC LIMIT 1`)
      .get(rejected.referral.id) as { correlationId: string };
    expect(deniedAudit.correlationId).toBe("M21-CORR-M21-CASE-HELD-001");
  });

  it("escalates urgent oversight, creates a nurse-owned medication alert, and preserves clinical-director approval", () => {
    const escalated = m21.escalateM21Workflow(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      {
        workItemId: "M21-WORK-URGENT-001",
        level: "executive",
        reason: "Urgent controlled escalation.",
        expectedVersion: 2,
      },
      db,
    );
    const alert = m21.createM21MedicationOversightAlert(
      { id: "SYNTH-NURSE-URGENT", role: "nurse" },
      {
        referralId: "M21-REF-URGENT-001",
        title: "Urgent synthetic medication oversight review",
        priority: "critical",
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString(),
        reason: "Urgent referral requires medication oversight.",
        expectedReferralVersion: 2,
      },
      db,
    );
    expect(alert.workItem).toMatchObject({
      queueId: "medication_management",
      assignedTo: "SYNTH-NURSE-URGENT",
      approvalStatus: "pending",
      status: "awaiting_approval",
    });
    const approved = m21.approveM21Workflow(
      { id: "SYNTH-CLINICAL-DIRECTOR", role: "clinical-director" },
      {
        workItemId: alert.workItem.id,
        decision: "approved",
        rationale: "Independent clinical medication disposition complete.",
        expectedVersion: alert.workItem.version,
      },
      db,
    );
    expect(approved.workItem).toMatchObject({ approvalStatus: "approved", approvedBy: "SYNTH-CLINICAL-DIRECTOR", status: "completed" });
    expectStableCorrelation(
      [escalated.auditEventId, alert.auditEventId, approved.auditEventId],
      "M21-CASE-URGENT-001",
    );
  });
});

describe("M2.1 E2E negative access and handoff controls", () => {
  it("limits every non-supervisory assigned-work role to the authenticated actor's exact records", () => {
    db.prepare("UPDATE m21_ccmg_work_items SET assigned_role = 'case-manager', assigned_to = 'SYNTH-CASE-MANAGER' WHERE id = 'M21-WORK-MHTCM-001'").run();
    db.prepare("UPDATE m21_ccmg_work_items SET assigned_role = 'therapist', assigned_to = 'SYNTH-THERAPIST' WHERE id = 'M21-WORK-MHRS-001'").run();
    const cases = [
      ["intake-coordinator", "SYNTH-INTAKE-COORDINATOR", "M21-WORK-INTAKE-001"],
      ["chart-auditor", "SYNTH-CHART-AUDITOR", "M21-WORK-QA-001"],
      ["nurse", "SYNTH-NURSE-001", "M21-WORK-MED-001"],
      ["qmhp-cs", "SYNTH-QMHP-001", "M21-WORK-CANS-001"],
      ["case-manager", "SYNTH-CASE-MANAGER", "M21-WORK-MHTCM-001"],
      ["therapist", "SYNTH-THERAPIST", "M21-WORK-MHRS-001"],
    ] as const;
    cases.forEach(([role, actorId, expectedId]) => {
      const own = m21.buildM21OversightDashboard({ id: actorId, role }, "synthetic_demo", "2026-07-14T12:00:00Z", db);
      expect(own.queues.flatMap((queue) => queue.items).map((item) => item.id)).toContain(expectedId);
      const other = m21.buildM21OversightDashboard({ id: `OTHER-${role}`, role }, "synthetic_demo", "2026-07-14T12:00:00Z", db);
      expect(other.queues.flatMap((queue) => queue.items)).toEqual([]);
    });
  });

  it("denies and audits a CANS handoff without exact current finalized lineage evidence", () => {
    expect(() => m21.handoffM21Workflow(
      { id: "SYNTH-CCMG-DIRECTOR", role: "ccmg-program-director" },
      {
        workItemId: "M21-WORK-CANS-001",
        toDivision: "BHC",
        toDepartment: "MHTCM",
        dueAt: "2026-07-18T17:00:00Z",
        reason: "CANS handoff bypass must fail.",
        expectedVersion: 1,
      },
      db,
    )).toThrow(/finalized current CANS/);
    const audit = db.prepare(`SELECT action, correlation_id AS correlationId FROM m21_ccmg_audit_events
      WHERE work_item_id = 'M21-WORK-CANS-001' AND action = 'handoff_denied' ORDER BY occurred_at DESC LIMIT 1`).get();
    expect(audit).toEqual({ action: "handoff_denied", correlationId: "M21-CORR-M21-CASE-NEW-001" });
  });
});
