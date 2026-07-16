import { describe, expect, it } from "vitest";
import { M33_CRITERIA } from "../../contracts/phase3/m33";
import { runM33SyntheticSuite } from "../services/m33";
import { ROLE_TIER_BY_ROLE } from "../../src/constants/access-control";

describe("M3.3 deterministic workforce acceptance suite", () => {
  it("passes every exact criterion with linked synthetic audit evidence", () => {
    const result = runM33SyntheticSuite();

    expect(result).toMatchObject({
      milestone: "M3.3",
      domain: "WORKFORCE",
      evidenceClass: "synthetic_demo",
      passed: true,
    });
    expect(result.criteria.map((criterion) => criterion.criterionId)).toEqual(
      M33_CRITERIA,
    );
    expect(result.criteria.every((criterion) => criterion.passed)).toBe(true);
    expect(
      result.auditEvents.every(
        (event) =>
          event.id.startsWith("SYNTH-") &&
          event.evidenceClass === "synthetic_demo" &&
          event.domain === "WORKFORCE" &&
          event.correlationId === "SYNTH-M33-CORRELATION-001",
      ),
    ).toBe(true);

    for (const criterion of result.criteria) {
      const auditEventIds = criterion.evidence
        .auditEventIds as readonly string[];
      expect(auditEventIds.length).toBeGreaterThan(0);
      expect(
        auditEventIds.every((id) =>
          result.auditEvents.some((event) => event.id === id),
        ),
      ).toBe(true);
    }
  });

  it("controls T1-T4 organization, employment, supervision, and access assignments", () => {
    const { snapshot } = runM33SyntheticSuite();

    expect(snapshot.workforce.map((record) => record.tier)).toEqual([
      "T1",
      "T2",
      "T3",
      "T4",
    ]);
    expect(
      snapshot.workforce.every(
        (record) =>
          record.positionId.startsWith("SYNTH-") &&
          record.positionTitle.length > 0 &&
          record.role.length > 0 &&
          record.division.length > 0 &&
          record.department.length > 0 &&
          ROLE_TIER_BY_ROLE[record.role] === record.tier &&
          record.accessAssignments.every(
            (assignment) => assignment.role === record.role,
          ) &&
          record.accessAssignments.length > 0,
      ),
    ).toBe(true);
    expect(
      snapshot.workforce.find((record) => record.tier === "T1"),
    ).toMatchObject({
      role: "managing-director",
      division: "EO",
      department: "Executive Office",
      supervisorId: null,
      employmentStatus: "active",
    });
    expect(
      snapshot.workforce.find((record) => record.tier === "T4"),
    ).toMatchObject({
      role: "therapist",
      division: "BHC",
      supervisorId: "SYNTH-M33-WORKFORCE-T3",
      employmentStatus: "separated",
      employmentEndedAt: "2026-07-11T22:00:00.000Z",
    });
  });

  it("enforces the ordered recruitment-to-release gates in 29 days", () => {
    const result = runM33SyntheticSuite();
    const { snapshot } = result;

    expect(snapshot.lifecycleGates.map((gate) => gate.gate)).toEqual([
      "recruitment",
      "conditional_offer",
      "screening",
      "credentialing",
      "onboarding",
      "orientation",
      "role_learning",
      "release_to_duty",
    ]);
    expect(snapshot.lifecycleGates.map((gate) => gate.sequence)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(
      snapshot.lifecycleGates.every(
        (gate) => gate.status === "passed" && gate.evidenceIds.length > 0,
      ),
    ).toBe(true);
    expect(snapshot).toMatchObject({
      credentialingDurationDays: 29,
      releaseToDutyPassed: true,
    });
    expect(snapshot.credentialingCycle).toEqual({
      id: "SYNTH-M33-CREDENTIALING-CYCLE-T4",
      workforceId: "SYNTH-M33-WORKFORCE-T4",
      verifiedCompletePacket: {
        evidenceId: "SYNTH-M33-EVIDENCE-COMPLETE-PACKET-T4",
        status: "verified_complete",
        receivedAt: "2026-06-01T14:00:00.000Z",
        verifiedAt: "2026-06-01T14:00:00.000Z",
        verifiedBy: "SYNTH-M33-HR-CREDENTIALER",
      },
      finalDecision: {
        evidenceId: "SYNTH-M33-EVIDENCE-CREDENTIAL-DECISION-T4",
        decision: "approved",
        decidedAt: "2026-06-30T14:00:00.000Z",
        decidedBy: "SYNTH-M33-HR-DIRECTOR",
        requirementEvidenceIds: [
          "SYNTH-M33-CREDENTIAL-03",
          "SYNTH-M33-CREDENTIAL-04",
          "SYNTH-M33-CREDENTIAL-05",
          "SYNTH-M33-CREDENTIAL-06",
        ],
      },
      durationDays: 29,
      evidenceClass: "synthetic_demo",
    });
    expect(
      snapshot.lifecycleGates.find((gate) => gate.gate === "credentialing")
        ?.evidenceIds,
    ).toContain("SYNTH-M33-EVIDENCE-CREDENTIAL-DECISION-T4");
    expect(
      result.criteria.find((criterion) => criterion.criterionId === "M3.3-02")
        ?.evidence,
    ).toHaveProperty("credentialingCycle");
  });

  it("covers all controlled credential types and exact 90/60/30 renewal controls", () => {
    const { snapshot } = runM33SyntheticSuite();

    expect(
      snapshot.requirements.map((requirement) => requirement.type).sort(),
    ).toEqual([
      "background",
      "certification",
      "ceu",
      "exclusion",
      "health",
      "license",
      "training",
    ]);
    expect(
      snapshot.requirements.every(
        (requirement) =>
          requirement.required &&
          requirement.evidenceRequired &&
          requirement.releaseToDutyImpact === "blocking",
      ),
    ).toBe(true);
    expect(
      snapshot.expirationAlerts.map((alert) => alert.thresholdDays),
    ).toEqual([90, 60, 30]);
    expect(
      snapshot.expirationAlerts.map((alert) => alert.daysRemaining),
    ).toEqual([90, 60, 30]);
    expect(
      snapshot.expirationAlerts.map((alert) => alert.accessImpact),
    ).toEqual(["none", "restrict_at_expiry", "suspend_at_expiry"]);
    expect(
      snapshot.expirationAlerts.every(
        (alert) =>
          alert.ownerId.startsWith("SYNTH-") &&
          alert.escalationRole === "hr-compliance-officer" &&
          alert.evidenceIds.length === 1,
      ),
    ).toBe(true);
  });

  it("completes performance, PIP, separation, and access revocation", () => {
    const { snapshot } = runM33SyntheticSuite();
    const t3Events = snapshot.performanceEvents
      .filter((event) => event.workforceId === "SYNTH-M33-WORKFORCE-T3")
      .map((event) => event.type);
    const t4Events = snapshot.performanceEvents
      .filter((event) => event.workforceId === "SYNTH-M33-WORKFORCE-T4")
      .map((event) => event.type);

    expect(t3Events).toEqual([
      "goal_set",
      "supervision",
      "coaching",
      "review",
      "improvement_plan_opened",
      "improvement_plan_verified",
    ]);
    expect(t4Events).toEqual([
      "separation_initiated",
      "access_revoked",
      "separation_closed",
    ]);
    expect(
      snapshot.workforce.find((record) => record.tier === "T4")
        ?.accessAssignments,
    ).toEqual([
      expect.objectContaining({
        status: "revoked",
        revokedAt: "2026-07-11T22:00:00.000Z",
      }),
    ]);
  });

  it("tracks at least forty annual hours for every representative staff tier", () => {
    const { snapshot } = runM33SyntheticSuite();

    expect(
      snapshot.annualTraining.map((summary) => summary.completedHours),
    ).toEqual([42, 44, 40, 41]);
    expect(
      snapshot.annualTraining.every(
        (summary) =>
          summary.requiredHours === 40 &&
          summary.completedHours >= summary.requiredHours &&
          summary.compliant &&
          summary.sourceEntryIds.length === 3,
      ),
    ).toBe(true);
    const t1 = snapshot.annualTraining.find(
      (summary) => summary.workforceId === "SYNTH-M33-WORKFORCE-T1",
    );
    expect(t1?.sourceEntryIds).toEqual([
      "SYNTH-M33-TRAINING-T1-1",
      "SYNTH-M33-TRAINING-T1-2",
      "SYNTH-M33-TRAINING-T1-3",
    ]);
    expect(t1?.excludedEntries).toEqual([
      expect.objectContaining({
        entryId: "SYNTH-M33-TRAINING-T1-DUPLICATE",
        reason: "duplicate_credit_key",
      }),
      expect.objectContaining({
        entryId: "SYNTH-M33-TRAINING-T1-VOID",
        reason: "void",
      }),
      expect.objectContaining({
        entryId: "SYNTH-M33-TRAINING-T1-FUTURE",
        reason: "future",
      }),
      expect.objectContaining({
        entryId: "SYNTH-M33-TRAINING-T1-OUT-OF-PERIOD",
        reason: "out_of_period",
      }),
      expect.objectContaining({
        entryId: "SYNTH-M33-TRAINING-T1-NON-APPLICABLE",
        reason: "non_applicable",
      }),
      expect.objectContaining({
        entryId: "SYNTH-M33-TRAINING-T1-UNVERIFIED",
        reason: "unverified",
      }),
    ]);
  });

  it("enforces confidential personnel-file access and runs T1-T4 scenarios", () => {
    const { snapshot } = runM33SyntheticSuite();

    expect(
      snapshot.personnelDocuments.every(
        (document) =>
          document.classification === "personnel_confidential" &&
          document.retentionYears === 7 &&
          document.secureLink.startsWith("amos-dms://synthetic/") &&
          document.allowedRoles.includes("hr-director"),
      ),
    ).toBe(true);
    expect(snapshot.accessDecisions).toEqual([
      expect.objectContaining({
        actorRole: "hr-director",
        decision: "allowed",
      }),
      expect.objectContaining({
        actorRole: "facilities-manager",
        decision: "denied",
      }),
    ]);
    expect(
      snapshot.scenarios.map((scenario) => [
        scenario.tier,
        scenario.scenarioType,
        scenario.status,
      ]),
    ).toEqual([
      ["T1", "onboarding", "passed"],
      ["T2", "renewal", "passed"],
      ["T3", "performance", "passed"],
      ["T4", "separation", "passed"],
    ]);
  });
});
