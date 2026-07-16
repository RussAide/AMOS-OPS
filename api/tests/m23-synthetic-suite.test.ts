import { describe, expect, it } from "vitest";
import { MHRS_CATEGORIES } from "../../contracts/regulatory/clinical";
import { runM23SyntheticSuite } from "../services/mhrs/synthetic-suite";
import { M22_SCENARIO_IDS } from "../services/mhtcm/scenario";

describe("M2.3 deterministic MHRS acceptance suite", () => {
  it("runs one billing-ready workflow for every controlled MHRS category", () => {
    const result = runM23SyntheticSuite();

    expect(result.scenarios).toHaveLength(4);
    expect(result.scenarios.map((scenario) => scenario.category).sort()).toEqual([...MHRS_CATEGORIES].sort());
    expect(result.scenarios.every((scenario) => scenario.billingReady)).toBe(true);
    expect(result.scenarios.every((scenario) => scenario.claimHandoffState === "ready_for_revenue")).toBe(true);
    expect(result.scenarios.filter((scenario) => scenario.procedureCode === "H2017")).toHaveLength(2);

    for (const scenario of result.scenarios) {
      const programCase = result.snapshot.cases.find((candidate) => candidate.id === scenario.caseId)!;
      const session = result.snapshot.sessions.find((candidate) => candidate.id === scenario.sessionId)!;
      if (scenario.procedureCode === "H2017") {
        expect(programCase.ageYears).toBeGreaterThanOrEqual(18);
        expect(programCase.ageYears).toBeLessThanOrEqual(20);
      }
      expect(session.billingEvaluation.policy.version).toBe(session.billingInput.acknowledgedPolicyVersion);
      expect(session.billingEvaluation.reasonCodes).toEqual([]);
    }
  });

  it("retains the complete need-to-outcome lineage and read-only continuum bridges", () => {
    const { scenarios, snapshot } = runM23SyntheticSuite();

    for (const scenario of scenarios) {
      const session = snapshot.sessions.find((candidate) => candidate.id === scenario.sessionId)!;
      const intervention = snapshot.interventions.find((candidate) => candidate.id === session.interventionId)!;
      const goal = snapshot.goals.find((candidate) => candidate.id === intervention.goalId)!;
      const need = snapshot.needs.find((candidate) => candidate.id === goal.needId)!;
      const programCase = snapshot.cases.find((candidate) => candidate.id === session.caseId)!;

      expect(need.caseId).toBe(programCase.id);
      expect(goal.planVersionId).toBe(session.planVersionId);
      expect(intervention.planVersionId).toBe(session.planVersionId);
      expect(snapshot.progress.some((item) => item.sessionId === session.id && item.goalId === goal.id)).toBe(true);
      expect(snapshot.barriers.some((item) => item.sessionId === session.id && item.goalId === goal.id)).toBe(true);
      expect(snapshot.outcomes.some((item) => item.sessionId === session.id && item.goalId === goal.id)).toBe(true);
      expect(programCase.careBridge.ccmg.accessMode).toBe("read_only");
      expect(programCase.careBridge.cans.accessMode).toBe("read_only");
      expect(programCase.careBridge.mhtcm.accessMode).toBe("read_only");
    }
  });

  it("continues the representative M2.2 youth through an MHRS-owned case without collapsing departments", () => {
    const result = runM23SyntheticSuite();
    const firstScenario = result.scenarios.find((scenario) => scenario.id === "M23-SCENARIO-INDIVIDUAL")!;
    const programCase = result.snapshot.cases.find((candidate) => candidate.id === firstScenario.caseId)!;

    expect(programCase.id).toMatch(/^M23-CASE-/);
    expect(programCase.id).not.toBe(M22_SCENARIO_IDS.caseId);
    expect(programCase.subjectId).toBe(M22_SCENARIO_IDS.youthId);
    expect(programCase.careBridge.ccmg).toMatchObject({
      ownerDepartment: "CCMG",
      accessMode: "read_only",
      referralId: M22_SCENARIO_IDS.referralId,
    });
    expect(programCase.careBridge.cans).toMatchObject({
      ownerDepartment: "CCMG",
      accessMode: "read_only",
      assessmentId: M22_SCENARIO_IDS.sourceCansAssessmentId,
      lineageId: M22_SCENARIO_IDS.sourceLineageId,
      targetRecordId: M22_SCENARIO_IDS.planId,
    });
    expect(programCase.careBridge.mhtcm).toMatchObject({
      ownerDepartment: "MHTCM",
      accessMode: "read_only",
      planId: M22_SCENARIO_IDS.planId,
      version: 2,
    });
  });

  it("fails closed for H2014-HO and every required claim-handoff evidence gap", () => {
    const result = runM23SyntheticSuite();
    const reasons = result.missingEvidenceControls.map((handoff) => handoff.reasonCodes);

    expect(result.h2014HoControl.state).toBe("rejected");
    expect(result.h2014HoControl.reasonCodes).toContain("H2014_HO_PRIMARY_AUTHORITY_REQUIRED");
    expect(reasons[0]).toContain("PLAN_OF_CARE_MISSING_OR_INACTIVE");
    expect(reasons[1]).toContain("AUTHORIZATION_MISSING");
    expect(reasons[2]).toContain("PROVIDER_CREDENTIAL_NOT_CURRENT");
    expect(reasons[3]).toContain("DOCUMENTATION_INCOMPLETE");
    expect(reasons[4]).toEqual(expect.arrayContaining(["DOCUMENTATION_INCOMPLETE", "M23_SIGNATURE_MISSING"]));
    expect(result.missingEvidenceControls.every((handoff) => handoff.state === "rejected")).toBe(true);
  });

  it("escalates the 90-day alert and completes it with a new immutable plan version", () => {
    const result = runM23SyntheticSuite();
    const original = result.snapshot.planVersions.find((plan) => plan.version === 1 && plan.id === result.snapshot.reviewAlerts.find((alert) => alert.id === result.review.alertId)!.planVersionId)!;
    const replacement = result.snapshot.planVersions.find((plan) => plan.priorVersionId === original.id)!;
    const originalStates = result.snapshot.planStateEvents.filter((event) => event.planVersionId === original.id).map((event) => event.toState);
    const reviewStates = result.snapshot.reviewAlertEvents.filter((event) => event.alertId === result.review.alertId).map((event) => event.toState);

    expect(result.snapshot.reviewAlerts.find((alert) => alert.id === result.review.alertId)!.dueAt).toBe("2026-09-29T00:00:00.000Z");
    expect(reviewStates).toEqual(["assigned", "escalated", "completed"]);
    expect(originalStates).toEqual(["draft", "under_review", "approved", "superseded"]);
    expect(replacement.version).toBe(2);
    expect(replacement.seriesId).toBe(original.seriesId);
    expect(result.review).toMatchObject({ priorPlanVersion: 1, newPlanVersion: 2, state: "completed" });
  });

  it("produces role-attributed, case-correlated audit evidence for every gate decision", () => {
    const { scenarios, snapshot } = runM23SyntheticSuite();

    for (const scenario of scenarios) {
      const events = snapshot.auditEvents.filter((event) => event.caseId === scenario.caseId);
      expect(events.length).toBeGreaterThan(10);
      expect(events.every((event) => event.correlationId === scenario.correlationId)).toBe(true);
      expect(events.some((event) => event.action === "claim_handoff_ready" && event.actorRole === "therapist")).toBe(true);
      expect(events.some((event) => event.action === "plan_state_changed" && event.actorRole === "mhrs-supervisor")).toBe(true);
    }
  });
});
