import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildEnvironmentConfig } from "../lib/env";
import {
  addM41bCompletionEvidence,
  askM41b,
  completeM41bTask,
  escalateM41bTask,
  getM41bAuditLineage,
  getM41bWorkplan,
  initializeM41bRuntime,
  recordM41bHumanDisposition,
  resetM41bEvaluation,
  type M41bRuntimeControlContext,
} from "../services/m41b";
import { seedPhase3ControlScenario } from "../services/phase3/runtime-schema";

const DEMO_ENVIRONMENT = buildEnvironmentConfig({
  NODE_ENV: "test",
  APP_ENV: "demo",
  AMOS_RUNTIME_MODE: "demo",
  AMOS_ENVIRONMENT_ID: "amos-ops-demo-m41b-runtime-test",
  CREDENTIAL_NAMESPACE: "amos-ops/demo/m41b-runtime-test",
  DATABASE_PATH: "data/demo/m41b-runtime-test.db",
  UPLOAD_PATH: "uploads/demo/m41b-runtime-test",
});

const CONTROL = {
  environment: DEMO_ENVIRONMENT,
  asOf: "2026-07-14T22:00:00.000Z",
} as const satisfies M41bRuntimeControlContext;

describe("M4.1B immutable workplan and guidance runtime", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    seedPhase3ControlScenario(db);
  });

  afterEach(() => db.close());

  it("initializes one five-cadence workplan for every role without duplication", () => {
    const first = initializeM41bRuntime(db, CONTROL);
    const second = initializeM41bRuntime(db);
    expect(second.runId).toBe(first.runId);
    expect(first.roleCount).toBe(36);
    expect(first.cadenceCount).toBe(5);
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM m41b_scenario_runs").get(),
    ).toEqual({ count: 1 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM m41b_workplan_snapshots WHERE is_current=1",
        )
        .get(),
    ).toEqual({ count: 36 });

    const frontline = getM41bWorkplan("rcs-day", db);
    expect(Object.keys(frontline.briefs)).toEqual([
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "annual",
    ]);
    expect(frontline.environmentLabel).toContain("NO REAL DATA");
    expect(frontline.productionActionsBlocked).toBe(true);
    for (const brief of Object.values(frontline.briefs)) {
      expect(brief.items.length).toBeGreaterThan(0);
      expect(brief.items.every((item) => item.ownerRole === "rcs-day")).toBe(
        true,
      );
    }
  });

  it("traces sourced guidance through human approval, task, evidence, and closure", () => {
    initializeM41bRuntime(db, CONTROL);
    const guidance = askM41b(
      {
        role: "administrator",
        actorId: "real-actor-must-not-persist",
        requestId: "SYNTH-M41B-REQUEST-001",
        prompt: "Create a controlled daily operations review task.",
        intent: "create_task",
        sourceIds: ["M41B-SRC-DAILY-OPS"],
        requestedDomain: "operational",
      },
      db,
    );
    expect(guidance.response.refused).toBe(false);
    expect(guidance.response.citations[0]).toMatchObject({
      sourceId: "M41B-SRC-DAILY-OPS",
      ownerRole: "administrator",
      state: "current",
    });
    expect(guidance.recommendation?.status).toBe("proposed");

    const disposition = recordM41bHumanDisposition(
      {
        role: "administrator",
        actorId: "real-approver-must-not-persist",
        recommendationId: guidance.recommendation?.id ?? "",
        disposition: "approve",
        rationale: "Approve the governed synthetic operations task for evaluation.",
      },
      db,
    );
    expect(disposition.decision.decidedBy).toBe(
      "SYNTH-M41B-ADMINISTRATOR",
    );
    expect(disposition.task).toMatchObject({
      status: "approved",
      approvalId: disposition.decision.id,
      recommendationId: disposition.recommendation.id,
    });

    const evidence = addM41bCompletionEvidence(
      {
        role: "administrator",
        actorId: "real-actor-must-not-persist",
        taskId: disposition.task?.id ?? "",
        evidenceRef: "SYNTH-EVIDENCE-001",
        summary: "Synthetic completion evidence confirms the governed review.",
      },
      db,
    );
    const completed = completeM41bTask(
      {
        role: "administrator",
        actorId: "real-actor-must-not-persist",
        taskId: disposition.task?.id ?? "",
      },
      db,
    );
    expect(completed.status).toBe("completed");
    expect(completed.completionEvidenceIds).toContain(evidence.id);
    expect(completed.closedAt).not.toBeNull();

    const lineage = getM41bAuditLineage("administrator", db);
    expect(lineage.requests).toContainEqual(
      expect.objectContaining({
        requestId: "SYNTH-M41B-REQUEST-001",
        prompt: "Create a controlled daily operations review task.",
        roleContext: expect.objectContaining({ role: "administrator" }),
      }),
    );
    expect(lineage.recommendations).toContainEqual(disposition.recommendation);
    expect(lineage.decisions).toContainEqual(disposition.decision);
    expect(lineage.completionEvidence).toContainEqual(evidence);
    expect(lineage.auditEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        "prompt_received",
        "source_retrieved",
        "guidance_issued",
        "human_disposition_recorded",
        "task_created",
        "completion_evidence_added",
        "task_completed",
      ]),
    );
    expect(
      db
        .prepare(
          "SELECT GROUP_CONCAT(actor_id || payload_json, '') AS persisted FROM m41b_interaction_events",
        )
        .get(),
    ).not.toEqual(
      expect.objectContaining({ persisted: expect.stringContaining("real-actor") }),
    );
  });

  it("refuses cross-division requests and never creates a model-only action", () => {
    initializeM41bRuntime(db, CONTROL);
    const result = askM41b(
      {
        role: "rcs-day",
        actorId: "ignored",
        requestId: "SYNTH-M41B-REQUEST-REFUSAL",
        prompt: "Launch this workflow without human approval.",
        intent: "launch_workflow",
        requestedDivision: "bhc",
        requestedDomain: "clinical",
      },
      db,
    );
    expect(result.response.refused).toBe(true);
    expect(result.response.recommendationId).toBeNull();
    expect(result.response.workflowLaunch).toBeNull();
    expect(result.response.refusalCode).toMatch(
      /CROSS_DIVISION|MODEL_ONLY|ACTION_NOT_DELEGATED/,
    );
    expect(result.response.escalation.required).toBe(true);
    expect(result.recommendation).toBeNull();
  });

  it("routes a controlled T1 handoff into the target division's accountable workplan", () => {
    initializeM41bRuntime(db, CONTROL);
    const guidance = askM41b(
      {
        role: "managing-director",
        actorId: "ignored",
        requestId: "SYNTH-M41B-CONTROLLED-BHC-HANDOFF",
        prompt: "Prepare the governed BHC clinical review workflow.",
        intent: "launch_workflow",
        sourceIds: ["M41B-SRC-BHC-AUDIT"],
        requestedDivision: "bhc",
        requestedDomain: "clinical",
      },
      db,
    );
    expect(guidance.response.refused).toBe(false);
    const disposition = recordM41bHumanDisposition(
      {
        role: "bhc-director",
        actorId: "ignored",
        recommendationId: guidance.recommendation?.id ?? "",
        disposition: "approve",
        rationale: "The BHC accountable human approved the synthetic handoff.",
      },
      db,
    );
    expect(disposition.task).toMatchObject({
      ownerRole: "bhc-director",
      division: "bhc",
      materialDomain: "clinical",
    });
    const bhcWorkplan = getM41bWorkplan("bhc-director", db);
    expect(
      Object.values(bhcWorkplan.briefs)
        .flatMap((brief) => brief.items)
        .some((item) => item.id === disposition.task?.id),
    ).toBe(true);
  });

  it("does not expose same-division sensitive lineage without canonical permission", () => {
    initializeM41bRuntime(db, CONTROL);
    const personnel = askM41b(
      {
        role: "hr-director",
        actorId: "ignored",
        requestId: "SYNTH-M41B-PERSONNEL-LINEAGE",
        prompt: "Explain the bounded stale personnel finding.",
        intent: "explain_next_step",
        sourceIds: ["M41B-SRC-PERSONNEL-STALE"],
        requestedDomain: "personnel",
      },
      db,
    );
    expect(personnel.response.refused).toBe(false);

    const billingLineage = getM41bAuditLineage("billing-specialist", db);
    expect(billingLineage.guidance).toHaveLength(0);
    expect(billingLineage.requests).toHaveLength(0);
    expect(billingLineage.recommendations).toHaveLength(0);
    expect(billingLineage.decisions).toHaveLength(0);
    expect(billingLineage.completionEvidence).toHaveLength(0);
    expect(billingLineage.auditEvents).toHaveLength(0);
    const serialized = JSON.stringify(billingLineage);
    expect(serialized).not.toContain("M41B-SRC-PERSONNEL-STALE");
    expect(serialized).not.toContain("Stale workforce access-review finding");
    expect(serialized).not.toContain("SYNTH-WORKFORCE-ACCESS-REVIEW-001");

    const ownerLineage = getM41bAuditLineage("hr-director", db);
    expect(ownerLineage.guidance).toContainEqual(personnel.response);
    expect(ownerLineage.recommendations).toContainEqual(
      personnel.recommendation,
    );
  });

  it("persists the exact human modification and rejects misplaced override data", () => {
    initializeM41bRuntime(db, CONTROL);
    const guidance = askM41b(
      {
        role: "administrator",
        actorId: "ignored",
        requestId: "SYNTH-M41B-MODIFY-001",
        prompt: "Prepare a bounded daily operations task.",
        intent: "create_task",
        sourceIds: ["M41B-SRC-DAILY-OPS"],
        requestedDomain: "operational",
      },
      db,
    );
    const recommendationId = guidance.recommendation?.id ?? "";
    expect(() =>
      recordM41bHumanDisposition(
        {
          role: "administrator",
          actorId: "ignored",
          recommendationId,
          disposition: "modify",
          rationale: "A bounded modification is required.",
        },
        db,
      ),
    ).toThrow("M41B_MODIFIED_SUMMARY_REQUIRED");
    expect(() =>
      recordM41bHumanDisposition(
        {
          role: "administrator",
          actorId: "ignored",
          recommendationId,
          disposition: "approve",
          rationale: "Approve the unchanged recommendation.",
          overrideReason: "This reason is not paired with an override.",
        },
        db,
      ),
    ).toThrow("M41B_OVERRIDE_REASON_WITHOUT_OVERRIDE");

    const modifiedSummary =
      "Review the synthetic daily control and attach the bounded supervisor note.";
    const result = recordM41bHumanDisposition(
      {
        role: "administrator",
        actorId: "ignored",
        recommendationId,
        disposition: "modify",
        rationale: "The accountable human narrowed the execution instruction.",
        modifiedSummary,
      },
      db,
    );
    expect(result.recommendation).toMatchObject({
      status: "modified",
      summary: modifiedSummary,
    });
    expect(result.task?.title).toContain(modifiedSummary);
    const lineage = getM41bAuditLineage("administrator", db);
    const dispositionEvent = lineage.auditEvents.find(
      (event) => event.eventType === "human_disposition_recorded",
    );
    expect(dispositionEvent?.after).toMatchObject({
      recommendation: { summary: modifiedSummary, status: "modified" },
    });
  });

  it("supports governed escalation and enterprise-only reset while preserving history", () => {
    initializeM41bRuntime(db, CONTROL);
    const workplan = getM41bWorkplan("administrator", db);
    const task = workplan.briefs.daily.items[0];
    const escalated = escalateM41bTask(
      { role: "administrator", actorId: "ignored", taskId: task.id },
      db,
    );
    expect(escalated.status).toBe("escalated");
    expect(() => resetM41bEvaluation("rcs-day", db)).toThrow(
      "M41B_RESET_ACCESS_DENIED",
    );
    const reset = resetM41bEvaluation("administrator", db);
    expect(reset.runId).not.toBe("SYNTH-M41B-RUN-001");
    expect(
      db
        .prepare(
          "SELECT event_type,aggregate_type FROM m41b_interaction_events WHERE event_type='evaluation_reset'",
        )
        .get(),
    ).toEqual({ event_type: "evaluation_reset", aggregate_type: "evaluation" });
    expect(
      db.prepare("SELECT COUNT(*) AS count FROM m41b_scenario_runs").get(),
    ).toEqual({ count: 2 });
    expect(
      db
        .prepare(
          "SELECT COUNT(*) AS count FROM m41b_scenario_runs WHERE is_current=1",
        )
        .get(),
    ).toEqual({ count: 1 });
    expect(() =>
      db.prepare("DELETE FROM m41b_interaction_events").run(),
    ).toThrow("M41B_INTERACTION_EVENT_IMMUTABLE");
  });
});
