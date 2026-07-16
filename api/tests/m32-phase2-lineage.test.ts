import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runPhase2IntegratedScenario } from "../services/phase2/integrated-scenario";
import { seedPhase2ControlScenario } from "../services/phase2/runtime-schema";
import {
  M32_PHASE2_LINEAGE_LOCK,
  buildM32SyntheticSnapshot,
  deriveM32VerifiedPhase2Lineage,
  runM32SyntheticSuite,
} from "../services/m32";

describe("M3.2 accepted Phase 2 revenue lineage", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = ON");
  });

  afterEach(() => db.close());

  it("derives the locked T1017 and H2017 identities from the accepted Phase 2 exit output", () => {
    const phase2 = runPhase2IntegratedScenario();
    const lineage = deriveM32VerifiedPhase2Lineage();
    const m22 = phase2.milestoneEvidence.m22.claimHandoff;
    const m23Scenario = phase2.milestoneEvidence.m23.scenarios.find(
      (scenario) => scenario.id === "M23-SCENARIO-GROUP",
    );
    const m23Handoff = phase2.milestoneEvidence.m23.snapshot.claimHandoffs.find(
      (handoff) => handoff.sessionId === m23Scenario?.sessionId,
    );

    expect(phase2.exitGate).toBe(true);
    expect(m22).toMatchObject({
      id: M32_PHASE2_LINEAGE_LOCK.T1017.phase2HandoffId,
      encounterId: M32_PHASE2_LINEAGE_LOCK.T1017.phase2EncounterId,
      status: M32_PHASE2_LINEAGE_LOCK.T1017.phase2Status,
      procedureCode: "T1017",
    });
    expect(m23Scenario).toMatchObject({
      id: M32_PHASE2_LINEAGE_LOCK.H2017.sourceScenarioId,
      procedureCode: "H2017",
      claimHandoffState: M32_PHASE2_LINEAGE_LOCK.H2017.phase2Status,
      billingReady: true,
    });
    expect(m23Handoff).toMatchObject({
      id: M32_PHASE2_LINEAGE_LOCK.H2017.phase2HandoffId,
      state: M32_PHASE2_LINEAGE_LOCK.H2017.phase2Status,
      billingEvaluation: {
        encounter: {
          encounterId: M32_PHASE2_LINEAGE_LOCK.H2017.phase2EncounterId,
          procedureCode: "H2017",
        },
      },
    });
    expect(lineage).toEqual([
      expect.objectContaining(M32_PHASE2_LINEAGE_LOCK.T1017),
      expect.objectContaining(M32_PHASE2_LINEAGE_LOCK.H2017),
    ]);
    expect(lineage.every((item) => (
      item.verifiedFrom === "runPhase2IntegratedScenario"
      && item.phase2ExitStatus === "passed"
    ))).toBe(true);
  });

  it("retains verified Phase 2 handoff, encounter, and readiness evidence in snapshots and criteria", () => {
    const snapshot = buildM32SyntheticSnapshot();
    const result = runM32SyntheticSuite();
    const criterion = result.criteria.find((item) => item.criterionId === "M3.2-08");

    expect(snapshot.phase2Lineage.map((item) => ({
      procedureCode: item.procedureCode,
      phase2HandoffId: item.phase2HandoffId,
      phase2EncounterId: item.phase2EncounterId,
      phase2Status: item.phase2Status,
    }))).toEqual([
      {
        procedureCode: "T1017",
        phase2HandoffId: "M22-CLAIM-HANDOFF-0024",
        phase2EncounterId: "SYNTH-M22-ENC-001",
        phase2Status: "ready_for_revenue",
      },
      {
        procedureCode: "H2017",
        phase2HandoffId: "M23-CLAIM-0002",
        phase2EncounterId: "SYNTH-M23-ENC-002",
        phase2Status: "ready_for_revenue",
      },
    ]);
    expect(snapshot.claimScenarios.every((scenario) => (
      scenario.phase2Lineage.phase2HandoffId === scenario.phase2HandoffId
      && scenario.phase2Lineage.phase2EncounterId === scenario.phase2EncounterId
      && scenario.phase2Status === "ready_for_revenue"
    ))).toBe(true);
    expect(criterion?.passed).toBe(true);
    expect(criterion?.evidence).toHaveProperty("scenarios");
  });

  it("persists the same two accepted Phase 2 handoffs idempotently", () => {
    seedPhase2ControlScenario(db);
    seedPhase2ControlScenario(db);
    const rows = db.prepare(`
      SELECT id, program, encounter_id AS encounterId, procedure_code AS procedureCode,
             status, evidence_class AS evidenceClass
      FROM phase2_claim_handoffs
      ORDER BY procedure_code DESC
    `).all();

    expect(rows).toEqual([
      {
        id: "M22-CLAIM-HANDOFF-0024",
        program: "MHTCM",
        encounterId: "SYNTH-M22-ENC-001",
        procedureCode: "T1017",
        status: "ready_for_revenue",
        evidenceClass: "synthetic_demo",
      },
      {
        id: "M23-CLAIM-0002",
        program: "MHRS",
        encounterId: "SYNTH-M23-ENC-002",
        procedureCode: "H2017",
        status: "ready_for_revenue",
        evidenceClass: "synthetic_demo",
      },
    ]);
  });
});
