import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { PHASE3_CRITERIA } from "@contracts/phase3/shared";
import { Phase3ControlStore } from "../services/phase3/control-store";
import {
  runPhase3IntegratedScenario,
  validatePhase3SupportLinks,
} from "../services/phase3/integrated-scenario";
import {
  resetPhase3ControlScenario,
  seedPhase3ControlScenario,
} from "../services/phase3/runtime-schema";

describe("Phase 3 integrated corporate-operations scenario", () => {
  it("passes exactly 31 checklist criteria across four complete milestones", () => {
    const result = runPhase3IntegratedScenario();
    expect(result.exitGate).toBe(true);
    expect(result.failedCriteria).toEqual([]);
    expect(Object.keys(result.criteria)).toEqual([...PHASE3_CRITERIA]);
    expect(Object.values(result.criteria).every(Boolean)).toBe(true);
    expect(
      Object.values(result.moduleResults).map((module) => [
        module.milestone,
        module.passed,
      ]),
    ).toEqual([
      ["M3.1", true],
      ["M3.2", true],
      ["M3.3", true],
      ["M3.4", true],
    ]);
    expect(result.scenarioRun.assertionsFailed).toBe(0);
    expect(result.scenarioRun.status).toBe("passed");
    expect(result.dx1).toMatchObject({
      controlId: "DX.1-P3",
      passed: true,
      environmentId: "AMOS-OPS-PHASE3-EVALUATION",
      environmentLabel: "DEMO - NOT FOR CARE DELIVERY",
    });
    expect(result.dx1.applicableControls).toHaveLength(12);
    expect(result.dx1.applicableControls.every((control) => control.passed)).toBe(
      true,
    );
    expect(result.dx1.featureScenarios).toHaveLength(31);
  });

  it("preserves strict Phase 3 metric operators and the synthetic-only boundary", () => {
    const result = runPhase3IntegratedScenario();
    expect(result.scenarioRun.evidence.metricOperators).toEqual({
      daysInAr: "<40",
      cleanClaimRate: ">95%",
      credentialingDays: "<30",
      annualTrainingHours: ">=40",
      facilityUptime: ">99%",
    });
    expect(result.productionActionsBlocked).toHaveLength(10);
    expect(result.productionActionsBlocked.join(" ")).toContain(
      "Microsoft 365",
    );
    expect(result.supportCaseId).toMatch(/^SYNTH-/);
    expect(result.sourceEpisodeId).toBe("SYNTH-PHASE2-EPISODE-001");
    expect(
      result.supportLinks.every(
        (link) =>
          link.id.startsWith("SYNTH-") &&
          link.evidenceClass === "synthetic_demo",
      ),
    ).toBe(true);
    expect(
      result.workItems.every(
        (item) =>
          item.status === "completed" &&
          item.evidenceClass === "synthetic_demo",
      ),
    ).toBe(true);
    expect(
      result.auditEvents.every(
        (event) =>
          event.id.startsWith("SYNTH-") &&
          event.evidenceClass === "synthetic_demo",
      ),
    ).toBe(true);
  });

  it("persists one shared support case, four links, four work items, four snapshots, and the exit run", () => {
    const db = new Database(":memory:");
    seedPhase3ControlScenario(db);
    const store = new Phase3ControlStore(db);
    const result = runPhase3IntegratedScenario();
    store.persistIntegratedResult(result);

    const overview = store.overview(result.supportCaseId);
    expect(overview.initialized).toBe(true);
    expect(overview.links).toHaveLength(4);
    expect(overview.workItems).toHaveLength(4);
    expect(
      overview.workItems.every(
        (item) => (item as Record<string, unknown>).status === "completed",
      ),
    ).toBe(true);
    expect(overview.snapshots).toHaveLength(4);
    expect(overview.scenarios).toHaveLength(1);
    expect((overview.scenarios[0] as Record<string, unknown>)?.status).toBe(
      "passed",
    );
    expect(overview.demoControl?.production_writes_blocked).toBe(1);

    expect(() =>
      db.prepare("UPDATE phase3_audit_events SET reason='changed'").run(),
    ).toThrow("PHASE3_AUDIT_IMMUTABLE");
    expect(() =>
      db.prepare("DELETE FROM phase3_module_snapshots").run(),
    ).toThrow("PHASE3_SNAPSHOT_IMMUTABLE");
    db.close();
  });

  it("validates exact accepted source identifiers and real module targets", () => {
    const result = runPhase3IntegratedScenario();
    expect(
      validatePhase3SupportLinks(
        result.supportLinks,
        Object.values(result.moduleResults),
      ),
    ).toBe(true);
    const invalid = result.supportLinks.map((link) =>
      link.domain === "REVENUE"
        ? { ...link, sourceId: "SYNTH-ORPHAN-HANDOFF" }
        : link,
    );
    expect(
      validatePhase3SupportLinks(invalid, Object.values(result.moduleResults)),
    ).toBe(false);
  });

  it("appends immutable snapshot and scenario versions on every run", () => {
    const db = new Database(":memory:");
    seedPhase3ControlScenario(db);
    const store = new Phase3ControlStore(db);
    const result = runPhase3IntegratedScenario();
    store.persistIntegratedResult(result);
    store.persistIntegratedResult(result);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM phase3_module_snapshots")
          .get() as { count: number }
      ).count,
    ).toBe(8);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM phase3_scenario_runs")
          .get() as { count: number }
      ).count,
    ).toBe(2);
    expect(store.overview().snapshots).toHaveLength(4);
    expect(store.overview().scenarios).toHaveLength(1);
    db.close();
  });

  it("fails persistence when a seeded support link drifts from sealed lineage", () => {
    const db = new Database(":memory:");
    seedPhase3ControlScenario(db);
    db.prepare(
      "UPDATE phase3_support_links SET target_id='SYNTH-ORPHAN-TARGET' WHERE id='SYNTH-P3-LINK-REVENUE'",
    ).run();
    const store = new Phase3ControlStore(db);
    expect(() =>
      store.persistIntegratedResult(runPhase3IntegratedScenario()),
    ).toThrow("PHASE3_SUPPORT_LINK_DRIFT:SYNTH-P3-LINK-REVENUE");
    db.close();
  });

  it("resets evaluative progress without deleting immutable evidence", () => {
    const db = new Database(":memory:");
    seedPhase3ControlScenario(db);
    const store = new Phase3ControlStore(db);
    store.persistIntegratedResult(runPhase3IntegratedScenario());
    const auditCount = Number(
      (
        db
          .prepare("SELECT count(*) AS count FROM phase3_audit_events")
          .get() as { count: number }
      ).count,
    );

    resetPhase3ControlScenario(db);
    const overview = store.overview();
    expect(
      overview.workItems.every(
        (item) => (item as Record<string, unknown>).status === "in_progress",
      ),
    ).toBe(true);
    expect(overview.snapshots).toHaveLength(0);
    expect(overview.scenarios).toHaveLength(0);
    expect(
      (
        db
          .prepare("SELECT COUNT(*) AS count FROM phase3_scenario_runs")
          .get() as { count: number }
      ).count,
    ).toBe(1);
    expect(
      Number(
        (
          db
            .prepare("SELECT count(*) AS count FROM phase3_audit_events")
            .get() as { count: number }
        ).count,
      ),
    ).toBe(auditCount + 1);
    db.close();
  });
});
