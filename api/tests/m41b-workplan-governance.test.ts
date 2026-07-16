import { describe, expect, it } from "vitest";
import {
  buildM41bRoleContext,
  type M41bRecommendation,
  type M41bWorkplanItem,
} from "@contracts/m41b";
import {
  buildM41bWorkplan,
  convertApprovedM41bRecommendationToWorkplanItem,
  transitionM41bWorkplanItem,
} from "../services/m41b/workplan-engine";

function approvedFinanceRecommendation(
  overrides: Partial<M41bRecommendation> = {},
): M41bRecommendation {
  return {
    id: "SYNTH-M41B-REC-FINANCE-001",
    requestId: "SYNTH-M41B-REQUEST-FINANCE-001",
    summary: "Reconcile the controlled revenue variance",
    sourceIds: ["M41B-SRC-FINANCE-CONFLICT"],
    materialDomain: "financial",
    createdByRole: "revenue-cycle-manager",
    createdAt: "2026-10-15T08:05:00.000Z",
    status: "approved",
    humanDecisionId: "SYNTH-M41B-DECISION-FINANCE-001",
    downstreamTaskId: null,
    evidenceClass: "synthetic_demo",
    ...overrides,
  };
}

describe("M4.1B governed source-to-task lifecycle", () => {
  it("converts a human-approved recommendation into an owned, dated, dependent, evidenced item", () => {
    const context = buildM41bRoleContext("revenue-cycle-manager");
    const recommendation = approvedFinanceRecommendation();
    const item = convertApprovedM41bRecommendationToWorkplanItem(
      recommendation,
      context,
    );

    expect(item.ownerId).toBe(context.userId);
    expect(item.ownerRole).toBe(context.role);
    expect(item.division).toBe("eo");
    expect(item.status).toBe("approved");
    expect(item.approvalId).toBe(recommendation.humanDecisionId);
    expect(item.recommendationId).toBe(recommendation.id);
    expect(item.sourceIds).toEqual(recommendation.sourceIds);
    expect(item.dueAt).toBe("2026-10-15T23:59:59.999Z");
    expect(item.dependencyIds).toHaveLength(1);
    expect(
      item.evidenceRequirements.some((value) =>
        value.includes("Reconciliation"),
      ),
    ).toBe(true);
    expect(item.completionEvidenceIds).toEqual([]);
    expect(item.closedAt).toBeNull();

    const plan = buildM41bWorkplan(context, {
      approvedRecommendations: [recommendation],
    });
    expect(
      plan.briefs.daily.items.some((candidate) => candidate.id === item.id),
    ).toBe(true);
  });

  it("fails closed for proposed, rejected, unapproved, domain-mismatched, or inaccessible recommendations", () => {
    const revenue = buildM41bRoleContext("revenue-cycle-manager");
    expect(() =>
      convertApprovedM41bRecommendationToWorkplanItem(
        approvedFinanceRecommendation({
          status: "proposed",
          humanDecisionId: null,
        }),
        revenue,
      ),
    ).toThrow("M41B_RECOMMENDATION_NOT_APPROVED");
    expect(() =>
      convertApprovedM41bRecommendationToWorkplanItem(
        approvedFinanceRecommendation({ status: "rejected" }),
        revenue,
      ),
    ).toThrow("M41B_RECOMMENDATION_NOT_APPROVED");
    expect(() =>
      convertApprovedM41bRecommendationToWorkplanItem(
        approvedFinanceRecommendation({ humanDecisionId: null }),
        revenue,
      ),
    ).toThrow("M41B_RECOMMENDATION_HUMAN_DECISION_REQUIRED");
    expect(() =>
      convertApprovedM41bRecommendationToWorkplanItem(
        approvedFinanceRecommendation({ materialDomain: "regulatory" }),
        revenue,
      ),
    ).toThrow("M41B_RECOMMENDATION_DOMAIN_MISMATCH");
    expect(() =>
      convertApprovedM41bRecommendationToWorkplanItem(
        approvedFinanceRecommendation({
          sourceIds: ["M41B-SRC-BHC-AUDIT"],
          materialDomain: "clinical",
        }),
        revenue,
      ),
    ).toThrow("M41B_RECOMMENDATION_SOURCE_ACCESS_DENIED");
  });

  it("requires explicit approval before execution and evidence plus timestamp before completion", () => {
    const context = buildM41bRoleContext("facilities-manager");
    const pending = buildM41bWorkplan(context).briefs.daily.items[0];

    expect(() =>
      transitionM41bWorkplanItem(pending, {
        status: "approved",
      }),
    ).toThrow("M41B_MODEL_ONLY_APPROVAL_DENIED");

    const approved = transitionM41bWorkplanItem(pending, {
      status: "approved",
      approvalId: "SYNTH-M41B-DECISION-GAD-001",
    });
    const inProgress = transitionM41bWorkplanItem(approved, {
      status: "in_progress",
    });
    const evidencePending = transitionM41bWorkplanItem(inProgress, {
      status: "evidence_pending",
    });

    expect(() =>
      transitionM41bWorkplanItem(evidencePending, {
        status: "completed",
        closedAt: "2026-10-15T16:00:00.000Z",
      }),
    ).toThrow("M41B_SILENT_CLOSURE_DENIED:EVIDENCE_REQUIRED");
    expect(() =>
      transitionM41bWorkplanItem(evidencePending, {
        status: "completed",
        completionEvidenceIds: ["SYNTH-M41B-EVIDENCE-GAD-001"],
      }),
    ).toThrow("M41B_SILENT_CLOSURE_DENIED:CLOSED_AT_REQUIRED");
    expect(() =>
      transitionM41bWorkplanItem(inProgress, {
        status: "in_progress",
        closedAt: "2026-10-15T16:00:00.000Z",
      }),
    ).toThrow("M41B_SILENT_CLOSURE_DENIED:NON_COMPLETED_CLOSED");

    const completed = transitionM41bWorkplanItem(evidencePending, {
      status: "completed",
      completionEvidenceIds: ["SYNTH-M41B-EVIDENCE-GAD-001"],
      closedAt: "2026-10-15T16:00:00.000Z",
    });
    expect(completed.status).toBe("completed");
    expect(completed.completionEvidenceIds).toEqual([
      "SYNTH-M41B-EVIDENCE-GAD-001",
    ]);
    expect(completed.closedAt).toBe("2026-10-15T16:00:00.000Z");
    expect(() =>
      transitionM41bWorkplanItem(completed, { status: "in_progress" }),
    ).toThrow("M41B_WORKPLAN_TRANSITION_DENIED");
  });

  it("preserves persisted workflow status, due date, dependencies, evidence requirements, and identity", () => {
    const context = buildM41bRoleContext("facilities-manager");
    const original = buildM41bWorkplan(context).briefs.monthly.items[0];
    const persisted: M41bWorkplanItem = {
      ...original,
      id: "SYNTH-M41B-PERSISTED-MONTHLY-GAD-001",
      priority: "low",
      status: "escalated",
      dueAt: "2026-10-01T23:59:59.999Z",
      dependencyIds: ["SYNTH-M41B-DEPENDENCY-EXCEPTION-001"],
      evidenceRequirements: [
        ...original.evidenceRequirements,
        "Supervisor escalation disposition",
      ],
    };

    const rebuilt = buildM41bWorkplan(context, { existingItems: [persisted] });
    const restored = rebuilt.briefs.monthly.items.find(
      (item) => item.naturalKey === original.naturalKey,
    );
    expect(restored?.id).toBe(persisted.id);
    expect(restored?.status).toBe("escalated");
    expect(restored?.dueAt).toBe(persisted.dueAt);
    expect(restored?.dependencyIds).toEqual(persisted.dependencyIds);
    expect(restored?.evidenceRequirements).toContain(
      "Supervisor escalation disposition",
    );
    expect(restored?.priority).toBe("critical");
    expect(restored?.closedAt).toBeNull();
  });

  it("rejects persisted silent closure and cross-owner workflow injection", () => {
    const context = buildM41bRoleContext("facilities-manager");
    const item = buildM41bWorkplan(context).briefs.daily.items[0];

    expect(() =>
      buildM41bWorkplan(context, {
        existingItems: [
          {
            ...item,
            status: "completed",
            approvalId: "SYNTH-M41B-DECISION-GAD-002",
            closedAt: "2026-10-15T17:00:00.000Z",
          },
        ],
      }),
    ).toThrow("M41B_SILENT_CLOSURE_DENIED:EVIDENCE_REQUIRED");

    expect(() =>
      buildM41bWorkplan(context, {
        existingItems: [{ ...item, ownerId: "SYNTH-M41B-DIFFERENT-OWNER" }],
      }),
    ).toThrow("M41B_WORKPLAN_OWNER_MISMATCH");

    expect(() =>
      buildM41bWorkplan(context, {
        existingItems: [{ ...item, humanApprovalRequired: false }],
      }),
    ).toThrow("M41B_HUMAN_APPROVAL_GATE_REQUIRED");
  });
});
