import { describe, expect, it } from "vitest";
import {
  ccmgAcceptanceChecks,
  normalizeCcmgDashboard,
  normalizeCcmgReferralDetail,
} from "./ccmg-oversight-model";
import {
  CCMG_SYNTHETIC_DASHBOARD,
  getSyntheticCcmgReferralDetail,
} from "./ccmg-synthetic-data";

describe("CCMG oversight normalization", () => {
  it("maps the stable M2.1 dashboard contract into all six canonical queues", () => {
    const model = normalizeCcmgDashboard(CCMG_SYNTHETIC_DASHBOARD);

    expect(model.evidenceMode).toBe("synthetic_demo");
    expect(model.evidenceLabel.toLowerCase()).toContain("synthetic");
    expect(model.queues.map((queue) => queue.kind)).toEqual([
      "intake",
      "qa",
      "cans",
      "medication",
      "mhtcm",
      "mhrs",
    ]);
    expect(
      model.queues.find((queue) => queue.kind === "medication")?.count,
    ).toBe(2);
    expect(model.metrics.find((metric) => metric.id === "backlog")?.value).toBe(
      7,
    );
    expect(
      model.metrics.find((metric) => metric.id === "qa-findings")?.value,
    ).toBe(1);
    expect(
      model.metrics.find((metric) => metric.id === "coordination")?.value,
    ).toBe(2);
  });

  it("preserves a restricted queue summary without leaking counts or items", () => {
    const raw = structuredClone(CCMG_SYNTHETIC_DASHBOARD);
    const queue = raw.queues.find((entry) => entry.id === "mhrs");
    if (!queue) throw new Error("Synthetic MHRS queue is missing");
    queue.visible = false;

    const model = normalizeCcmgDashboard(raw);
    const restricted = model.queues.find((entry) => entry.kind === "mhrs");
    expect(restricted).toMatchObject({ visible: false, count: 0, items: [] });
  });

  it("uses canonical work metrics without aliasing referral, exception, or handoff counts", () => {
    const model = normalizeCcmgDashboard({
      evidenceClass: "production",
      queues: [],
      metrics: {
        openReferrals: 91,
        openExceptions: 92,
        activeHandoffs: 93,
        backlogWorkItems: 4,
        qaFindings: 2,
        serviceCoordinationItems: 3,
      },
    });

    expect(model.metrics.find((metric) => metric.id === "backlog")?.value).toBe(
      4,
    );
    expect(
      model.metrics.find((metric) => metric.id === "qa-findings")?.value,
    ).toBe(2);
    expect(
      model.metrics.find((metric) => metric.id === "coordination")?.value,
    ).toBe(3);
  });

  it("derives work metrics only from nonterminal visible queue items when canonical metrics are absent", () => {
    const model = normalizeCcmgDashboard({
      evidenceClass: "production",
      metrics: {
        openReferrals: 91,
        openExceptions: 92,
        activeHandoffs: 93,
      },
      queues: [
        "intake",
        "qa",
        "cans",
        "medication_management",
        "mhtcm",
        "mhrs",
      ].map((id) => ({
        id,
        visible: true,
        items: [
          { id: `${id}-OPEN`, referralId: "REF-OPEN", status: "pending" },
          {
            id: `${id}-DONE`,
            referralId: "REF-DONE",
            status: "completed",
          },
        ],
      })),
    });

    expect(model.metrics.find((metric) => metric.id === "backlog")?.value).toBe(
      6,
    );
    expect(
      model.metrics.find((metric) => metric.id === "qa-findings")?.value,
    ).toBe(1);
    expect(
      model.metrics.find((metric) => metric.id === "coordination")?.value,
    ).toBe(2);
  });

  it("marks derived work metrics and missing queues unavailable instead of inventing visible zeroes", () => {
    const model = normalizeCcmgDashboard({
      evidenceClass: "production",
      metrics: {
        openReferrals: 91,
        openExceptions: 92,
        activeHandoffs: 93,
      },
      queues: [
        { id: "qa", visible: false, total: 4, items: [] },
        {
          id: "mhtcm",
          visible: true,
          total: 1,
          items: [{ id: "MHTCM-1", referralId: "REF-1", status: "pending" }],
        },
      ],
    });

    expect(model.metrics.find((metric) => metric.id === "backlog")?.value).toBe(
      null,
    );
    expect(
      model.metrics.find((metric) => metric.id === "qa-findings")?.value,
    ).toBe(null);
    expect(
      model.metrics.find((metric) => metric.id === "coordination")?.value,
    ).toBe(null);
    expect(model.queues.find((queue) => queue.kind === "intake")).toMatchObject(
      { available: false, visible: false, count: 0, items: [] },
    );
  });

  it("does not mark metric evidence coverage complete for structural placeholders", () => {
    const model = normalizeCcmgDashboard({
      evidenceClass: "production",
      queues: [],
      metrics: { openReferrals: 2 },
    });
    const metricCheck = ccmgAcceptanceChecks(model).find(
      (check) => check.id === "role-metrics",
    );

    expect(metricCheck?.passed).toBe(false);
  });

  it("normalizes workflow accountability, readiness gates, CANS lineage, and audit events", () => {
    const raw = getSyntheticCcmgReferralDetail("SYN-REF-ATLAS");
    const detail = normalizeCcmgReferralDetail(raw, "SYN-REF-ATLAS");

    expect(detail.referralId).toBe("SYN-REF-ATLAS");
    expect(detail.referralVersion).toBe(3);
    expect(detail.gates).toHaveLength(6);
    expect(
      detail.gates.find((gate) => gate.id === "authorization")?.status,
    ).toBe("pending");
    expect(detail.workflow.assignedRole).toBe("intake-coordinator");
    expect(detail.workflow.exceptions).toContain("ELIGIBILITY_SOURCE_PENDING");
    expect(detail.cansLineage).toHaveLength(2);
    expect(detail.cansLineage[0].supersedes).toBe("SYN-CANS-ATLAS-V1");
    expect(detail.cansLineage[0]).toMatchObject({
      assessmentVersion: "v2",
      instrumentVersion: "CANS 2.0",
    });
    expect(detail.cansLineage[0].routes).toHaveLength(2);
    expect(
      detail.cansLineage[0].routes.map((route) => route.targetType),
    ).toEqual(["mhtcm_plan", "mhrs_skills_goals"]);
    expect(detail.auditTrail).toHaveLength(4);
  });

  it("selects active work by status precedence and never defaults to a terminal item", () => {
    const detail = normalizeCcmgReferralDetail(
      {
        workflow: {
          assignments: [
            {
              id: "WI-COMPLETED",
              status: "completed",
              version: 8,
              isCurrent: true,
            },
            { id: "WI-PENDING", status: "pending", version: 2 },
            { id: "WI-IN-PROGRESS", status: "in_progress", version: 3 },
            {
              id: "WI-AWAITING",
              status: "awaiting_approval",
              version: 4,
            },
            { id: "WI-BLOCKED", status: "blocked", version: 5 },
          ],
        },
      },
      "REF-PRECEDENCE",
    );
    const terminalOnly = normalizeCcmgReferralDetail(
      {
        workflow: {
          assignments: [
            {
              id: "WI-COMPLETED",
              status: "completed",
              version: 8,
              isCurrent: true,
            },
            {
              id: "WI-CANCELLED",
              status: "cancelled",
              version: 9,
              active: true,
            },
          ],
        },
      },
      "REF-TERMINAL",
    );

    expect(detail.workflow).toMatchObject({
      workItemId: "WI-BLOCKED",
      expectedVersion: 5,
      status: "blocked",
    });
    expect(terminalOnly.workflow.workItemId).toBe(null);
    expect(terminalOnly.workflow.expectedVersion).toBe(null);
  });

  it("maps canonical server detail fields without depending on fixture-only aliases", () => {
    const detail = normalizeCcmgReferralDetail(
      {
        referral: {
          id: "SYN-REF-SERVER",
          caseId: "SYN-CASE-SERVER",
          evidenceClass: "synthetic_demo",
          youthDisplayLabel: "Youth Server (fictional)",
          referralSourceDivision: "bhc",
          urgency: "urgent",
          status: "in_review",
          version: 5,
        },
        gates: {
          intake: {
            status: "completed",
            completedAt: "2026-07-10T10:00:00.000Z",
            completedBy: "synthetic-intake-actor",
          },
          eligibility: {
            status: "eligible",
            rationale: "Synthetic eligibility rationale.",
            determinedAt: "2026-07-10T11:00:00.000Z",
            determinedBy: "synthetic-reviewer",
          },
          payerAuthorization: {
            payerLabel: "Synthetic payer",
            authorizationStatus: "pending",
          },
          consent: { status: "verified", effectiveAt: "2026-07-10" },
          cans: {
            status: "completed",
            dueAt: "2026-08-10",
            currentAssessmentId: "SYN-CANS-SERVER-V2",
          },
          capacity: {
            status: "reserved",
            facilityLabel: "Synthetic capacity",
            checkedAt: "2026-07-10T12:00:00.000Z",
          },
          readiness: { ready: false, status: "blocked" },
        },
        workflow: {
          assignments: [
            {
              id: "SYN-WI-SERVER",
              queueId: "intake",
              title: "Synthetic review",
              status: "in_progress",
              assignedDepartment: "ccmg",
              assignedRole: "intake-coordinator",
              assignedTo: "synthetic-assignee",
              dueAt: "2026-07-15T12:00:00.000Z",
              approvalStatus: "pending",
              exceptionCode: "SYNTHETIC_EXCEPTION",
              exceptionStatus: "open",
              version: 4,
            },
          ],
          approvals: [
            {
              id: "SYN-WI-SERVER",
              approvalStatus: "pending",
            },
          ],
          exceptions: [
            {
              id: "SYN-WI-SERVER",
              exceptionCode: "SYNTHETIC_EXCEPTION",
            },
          ],
          handoffs: [
            {
              id: "SYN-HO-SERVER",
              status: "initiated",
              toDepartment: "mhtcm",
              reason: "Synthetic handoff reason.",
            },
          ],
        },
        cansLineage: {
          versions: [
            {
              id: "SYN-CANS-SERVER-V2",
              version: 2,
              instrumentVersion: "CANS 2.0",
              completedAt: "2026-07-12T12:00:00.000Z",
              completedBy: "synthetic-qmhp",
              totalScore: 26,
              acuity: "high",
              previousAssessmentId: "SYN-CANS-SERVER-V1",
              evidenceClass: "synthetic_demo",
            },
          ],
          routes: [
            {
              cansAssessmentId: "SYN-CANS-SERVER-V2",
              targetType: "treatment_plan",
              targetRecordId: "SYN-PLAN-SERVER",
              targetVersion: 4,
              targetApprovalStatus: "approved",
              mappedGoals: [{ goalCode: "SYN-GOAL-1" }],
            },
            {
              cansAssessmentId: "SYN-CANS-SERVER-V2",
              targetType: "mhrs_skills_goals",
              targetRecordId: "SYN-GOALS-SERVER",
              targetVersion: 7,
              targetApprovalStatus: "approved",
              mappedGoals: [
                { goalCode: "SYN-GOAL-2" },
                { goalCode: "SYN-GOAL-3" },
              ],
            },
          ],
        },
        audit: {
          accessEventId: "SYN-ACCESS-SERVER",
          events: [
            {
              id: "SYN-AUD-SERVER",
              occurredAt: "2026-07-12T13:00:00.000Z",
              actorRole: "ccmg-program-director",
              action: "synthetic_reviewed",
              reason: "Synthetic audit reason.",
              evidenceClass: "synthetic_demo",
            },
          ],
        },
      },
      "SYN-REF-SERVER",
    );

    expect(detail.authorizationStatus).toBe("pending");
    expect(detail.referralVersion).toBe(5);
    expect(detail.workflow).toMatchObject({
      workItemId: "SYN-WI-SERVER",
      expectedVersion: 4,
      status: "in_progress",
      stage: "intake",
      approvalStatus: "pending",
      handoff: "Synthetic handoff reason.",
    });
    expect(detail.workflow.exceptions).toEqual(["SYNTHETIC_EXCEPTION"]);
    expect(detail.cansLineage[0]).toMatchObject({
      assessmentVersion: 2,
      instrumentVersion: "CANS 2.0",
      completedByRole: "synthetic-qmhp",
      supersedes: "SYN-CANS-SERVER-V1",
    });
    expect(detail.cansLineage[0].routes).toHaveLength(2);
    expect(detail.cansLineage[0].routes[0]).toMatchObject({
      targetType: "treatment_plan",
      targetRecordId: "SYN-PLAN-SERVER",
      targetVersion: 4,
      mappedGoalCount: 1,
    });
    expect(detail.cansLineage[0].routes[1]).toMatchObject({
      targetType: "mhrs_skills_goals",
      targetRecordId: "SYN-GOALS-SERVER",
      targetVersion: 7,
      mappedGoalCount: 2,
    });
    expect(detail.auditTrail[0].source).toBe("synthetic_demo");
  });
});
