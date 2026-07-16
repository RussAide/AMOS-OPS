import { describe, expect, it } from "vitest";
import type { M23Actor } from "../../contracts/mhrs/types";
import { M23DomainError, M23ProgramEngine } from "../services/mhrs/engine";
import { M23MemoryRepository } from "../services/mhrs/repository";
import { runM23SyntheticSuite } from "../services/mhrs/synthetic-suite";

const auditor: M23Actor = {
  id: "SYNTH-M23-AUDITOR-DENIAL",
  role: "chart-auditor",
  displayName: "Synthetic Auditor",
};

describe("M2.3 append-only and authorization controls", () => {
  it("generates stable sequential identifiers and returns frozen repository records", () => {
    const repository = new M23MemoryRepository();
    expect(repository.nextId("M23-TEST")).toBe("M23-TEST-0001");
    expect(repository.nextId("M23-TEST")).toBe("M23-TEST-0002");

    const engine = new M23ProgramEngine();
    const result = runM23SyntheticSuite(engine);
    const programCase = result.snapshot.cases[0];
    expect(Object.isFrozen(programCase)).toBe(true);
    expect(Object.isFrozen(programCase.careBridge)).toBe(true);
    expect(Object.isFrozen(programCase.careBridge.cans)).toBe(true);
  });

  it("denies write authority to auditors and appends a permission-denied event", () => {
    const engine = new M23ProgramEngine();

    expect(() => engine.registerCase(auditor, {
      subjectId: "SYNTH-M23-DENIED-YOUTH",
      subjectLabel: "Synthetic Denied Youth",
      ageYears: 16,
      assignedSpecialistId: "SYNTH-THERAPIST",
      assignedSupervisorId: "SYNTH-SUPERVISOR",
      careBridge: {
        ccmg: { ownerDepartment: "CCMG", accessMode: "read_only", referralId: "SYNTH-REF", caseId: "SYNTH-CASE", handoffId: "SYNTH-HANDOFF", status: "active" },
        cans: { ownerDepartment: "CCMG", accessMode: "read_only", assessmentId: "SYNTH-CANS", version: 1, lineageId: "SYNTH-LINEAGE", targetRecordId: "SYNTH-TARGET", mappedGoalCodes: ["SYNTH-GOAL"] },
        mhtcm: { ownerDepartment: "MHTCM", accessMode: "read_only", planId: "SYNTH-PLAN", version: 1, status: "approved", coordinationSummary: "Synthetic reference." },
      },
    }, "2026-07-14T12:00:00.000Z")).toThrowError(M23DomainError);

    expect(engine.snapshot().cases).toHaveLength(0);
    expect(engine.snapshot().auditEvents).toEqual([
      expect.objectContaining({ action: "permission_denied", actorId: auditor.id, actorRole: "chart-auditor" }),
    ]);
  });

  it("does not let an unassigned therapist read another specialist's case", () => {
    const engine = new M23ProgramEngine();
    const result = runM23SyntheticSuite(engine);
    const otherTherapist: M23Actor = { id: "SYNTH-M23-OTHER-THERAPIST", role: "therapist", displayName: "Other Therapist" };

    expect(() => engine.getCaseDetail(otherTherapist, result.scenarios[0].caseId, "2026-09-30T11:00:00.000Z"))
      .toThrowError(/assigned MHRS case/);
    expect(engine.snapshot().auditEvents.at(-1)).toMatchObject({
      action: "permission_denied",
      actorId: otherTherapist.id,
      caseId: result.scenarios[0].caseId,
    });
  });

  it("preserves separate session signature and claim-handoff state events", () => {
    const result = runM23SyntheticSuite();
    const scenario = result.scenarios[0];
    const sessionStates = result.snapshot.sessionStateEvents
      .filter((event) => event.sessionId === scenario.sessionId)
      .map((event) => event.toState);
    const handoff = result.snapshot.claimHandoffs.find((candidate) => candidate.sessionId === scenario.sessionId)!;

    expect(sessionStates).toEqual(["draft", "signed"]);
    expect(handoff.state).toBe("ready_for_revenue");
    expect(handoff.reasonCodes).toEqual([]);
  });
});

