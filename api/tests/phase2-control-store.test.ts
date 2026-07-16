import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Phase2ControlStore } from "../services/phase2/control-store";
import { ensurePhase2ControlSchema } from "../services/phase2/runtime-schema";
import type { Phase2CareEpisode } from "@contracts/phase2";

describe("Phase 2 shared persistence adapter", () => {
  let db: Database.Database;
  let store: Phase2ControlStore;
  const at = "2026-07-14T12:00:00.000Z";
  const episode: Phase2CareEpisode = {
    id: "SYNTH-EPISODE-STORE-001", caseId: "SYNTH-CASE-STORE-001", referralId: "SYNTH-REF-STORE-001",
    youthId: "SYNTH-YOUTH-STORE-001", youthDisplayLabel: "Synthetic Youth Store-01",
    evidenceClass: "synthetic_demo", status: "active", cansAssessmentId: "SYNTH-CANS-STORE-001",
    cansVersion: 2, version: 1, createdAt: at, updatedAt: at,
  };

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
    ensurePhase2ControlSchema(db);
    store = new Phase2ControlStore(db);
  });

  afterEach(() => db.close());

  it("persists one episode and appends its correlated audit history", () => {
    store.saveEpisode(episode, { id: "SYNTH-ACTOR-STORE", role: "managing-director" }, "Initialize shared episode");
    expect(store.getEpisode(episode.id)).toEqual(episode);
    store.saveEpisode({ ...episode, status: "discharging", version: 2, updatedAt: "2026-07-15T12:00:00.000Z" }, { id: "SYNTH-ACTOR-STORE", role: "managing-director" }, "Begin controlled discharge");
    expect(store.getEpisode(episode.id)).toMatchObject({ status: "discharging", version: 2 });
    expect((db.prepare("SELECT COUNT(*) AS count FROM phase2_audit_events").get() as { count: number }).count).toBe(2);
  });

  it("persists shared work, alerts, handoffs, claim gates, snapshots, and scenarios", () => {
    store.saveEpisode(episode, { id: "SYNTH-ACTOR-STORE", role: "managing-director" }, "Initialize shared episode");
    store.createWorkItem({
      id: "SYNTH-WORK-STORE-001", episodeId: episode.id, domain: "MHTCM", title: "Complete aftercare",
      sourceType: "aftercare", sourceId: "SYNTH-AFTERCARE-001", status: "pending", priority: "urgent",
      assignedRole: "case-manager", dueAt: "2026-08-13T12:00:00.000Z", escalationLevel: "none",
      version: 1, createdAt: at, updatedAt: at,
    });
    store.createAlert({
      id: "SYNTH-ALERT-STORE-001", episodeId: episode.id, domain: "MHRS", alertType: "plan_review_90_day",
      sourceType: "service_plan", sourceId: "SYNTH-MHRS-PLAN-001", title: "90-day plan review",
      status: "open", priority: "urgent", dueAt: "2026-10-12T12:00:00.000Z",
      assignedRole: "mhrs-supervisor", escalationLevel: "none", createdAt: at,
    });
    store.createHandoff({
      id: "SYNTH-HANDOFF-STORE-001", episodeId: episode.id, fromDomain: "MHTCM", toDomain: "MHRS",
      status: "initiated", reason: "Coordinate approved service goals", payload: { minimumNecessary: true },
      initiatedBy: "SYNTH-CASE-MANAGER", initiatedAt: at, dueAt: "2026-07-15T12:00:00.000Z", version: 1,
    });
    store.recordClaimHandoff({
      id: "SYNTH-CLAIM-STORE-001", episodeId: episode.id, program: "MHTCM", encounterId: "SYNTH-ENC-STORE-001",
      procedureCode: "T1017", status: "ready", findings: [], evaluatorVersion: "2026.07.14",
      decidedAt: at, correlationId: episode.caseId, evidenceClass: "synthetic_demo",
    });
    store.saveSnapshot({
      id: "SYNTH-SNAPSHOT-STORE-001", episodeId: episode.id, domain: "GRO", aggregateType: "residential_state",
      aggregateId: "SYNTH-GRO-STATE-001", aggregateVersion: 1, payload: { census: 15, capacity: 16 },
      evidenceClass: "synthetic_demo", createdAt: at,
    });
    store.recordScenario({
      id: "SYNTH-SCENARIO-STORE-001", milestone: "PHASE2_EXIT", scenarioType: "continuum",
      status: "passed", episodeId: episode.id, startedAt: at, completedAt: "2026-07-15T12:00:00.000Z",
      assertionsPassed: 24, assertionsFailed: 0, evidence: { syntheticOnly: true },
    });

    for (const table of ["phase2_work_items", "phase2_alerts", "phase2_handoffs", "phase2_claim_handoffs", "phase2_program_snapshots", "phase2_scenario_runs"]) {
      expect((db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count).toBe(1);
    }
  });
});
