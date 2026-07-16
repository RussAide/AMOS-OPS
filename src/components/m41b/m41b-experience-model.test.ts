import type {
  M41bAuditEvent,
  M41bCadence,
  M41bCompletionEvidence,
  M41bGovernedSource,
  M41bGuidanceResponse,
  M41bGuidanceRequest,
  M41bHumanDecision,
  M41bRecommendation,
  M41bWorkplan,
  M41bWorkplanItem,
} from "@contracts/m41b";
import { describe, expect, it } from "vitest";
import {
  allWorkplanItems,
  buildM41bLineages,
  resolveItemSources,
} from "./m41b-experience-model";

const cadences: readonly M41bCadence[] = [
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
];

function task(cadence: M41bCadence): M41bWorkplanItem {
  return {
    id: `SYNTH-TASK-${cadence.toUpperCase()}`,
    naturalKey: `synthetic:${cadence}`,
    cadence,
    title: `${cadence} synthetic commitment`,
    objective: "Verify contract-bound orchestration.",
    priority: "high",
    ownerId: "SYNTH-ACTOR",
    ownerRole: "administrator",
    division: "eo",
    materialDomain: "operational",
    workflowKey: `synthetic:${cadence}:workflow`,
    dueAt: "2026-10-15T17:00:00.000Z",
    dependencyIds: [],
    sourceIds: ["SYNTH-SOURCE"],
    recommendationId: cadence === "daily" ? "SYNTH-REC" : null,
    status: cadence === "daily" ? "completed" : "pending_approval",
    humanApprovalRequired: true,
    approvalId: cadence === "daily" ? "SYNTH-DECISION" : null,
    evidenceRequirements: ["Synthetic completion record"],
    completionEvidenceIds: cadence === "daily" ? ["SYNTH-EVIDENCE"] : [],
    closedAt: cadence === "daily" ? "2026-10-15T16:00:00.000Z" : null,
    evidenceClass: "synthetic_demo",
  };
}

const workplan: M41bWorkplan = {
  milestone: "M4.1B",
  environmentId: "AMOS-OPS-M4.1B-EVALUATION",
  environmentLabel: "SYNTHETIC PROTOTYPE — NO REAL DATA",
  generatedAt: "2026-10-15T08:00:00.000Z",
  roleContext: {
    userId: "SYNTH-ACTOR",
    role: "administrator",
    tier: "T1",
    division: "eo",
    department: "Synthetic Operations",
    caseloadIds: [],
    delegatedActions: ["request_guidance"],
    supervisorRoles: ["managing-director"],
    evidenceClass: "synthetic_demo",
  },
  briefs: {
    daily: {
      cadence: "daily",
      title: "Daily synthetic brief",
      purpose: "Daily test purpose",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [task("daily")],
      sourceStates: ["current"],
      limitations: [],
    },
    weekly: {
      cadence: "weekly",
      title: "Weekly synthetic brief",
      purpose: "Weekly test purpose",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [task("weekly")],
      sourceStates: ["current"],
      limitations: [],
    },
    monthly: {
      cadence: "monthly",
      title: "Monthly synthetic brief",
      purpose: "Monthly test purpose",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [task("monthly")],
      sourceStates: ["current"],
      limitations: [],
    },
    quarterly: {
      cadence: "quarterly",
      title: "Quarterly synthetic brief",
      purpose: "Quarterly test purpose",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [task("quarterly")],
      sourceStates: ["current"],
      limitations: [],
    },
    annual: {
      cadence: "annual",
      title: "Annual synthetic brief",
      purpose: "Annual test purpose",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [task("annual")],
      sourceStates: ["current"],
      limitations: [],
    },
  },
  productionActionsBlocked: true,
  evidenceClass: "synthetic_demo",
};

const source: M41bGovernedSource = {
  id: "SYNTH-SOURCE",
  title: "Synthetic governed source",
  sourceSystem: "Synthetic Registry",
  sourceType: "policy",
  version: "test-v1",
  ownerRole: "administrator",
  effectiveAt: "2026-10-01T00:00:00.000Z",
  reviewedAt: "2026-10-01T00:00:00.000Z",
  refreshedAt: "2026-10-15T07:00:00.000Z",
  expiresAt: null,
  applicableLimits: ["Test-only guidance"],
  missingEvidence: [],
  state: "current",
  confidence: 0.9,
  uncertainty: null,
  sensitivity: "internal",
  divisions: ["eo"],
  minimumTier: "T4",
  cadences,
  materialDomain: "operational",
  recordIds: ["SYNTH-RECORD"],
  evidenceClass: "synthetic_demo",
};

const guidance: M41bGuidanceResponse = {
  responseId: "SYNTH-RESPONSE",
  requestId: "SYNTH-REQUEST",
  answer: "Synthetic sourced guidance.",
  nextSteps: ["Obtain human disposition"],
  citations: [],
  confidence: 0.9,
  uncertainty: null,
  applicableLimits: ["Test only"],
  missingEvidence: [],
  recommendationId: "SYNTH-REC",
  workflowLaunch: null,
  humanGate: {
    required: true,
    materialDomain: "operational",
    accountableRoles: ["administrator"],
    disposition: "approved",
    decisionId: "SYNTH-DECISION",
  },
  escalation: { required: false, routeTo: [], reason: null },
  refused: false,
  refusalCode: null,
  evidenceClass: "synthetic_demo",
};

const request: M41bGuidanceRequest = {
  requestId: "SYNTH-REQUEST",
  prompt: "Explain the synthetic governed recommendation.",
  intent: "explain_next_step",
  roleContext: workplan.roleContext,
  sourceIds: [source.id],
  workplanItemId: "SYNTH-TASK-DAILY",
  requestedDivision: "eo",
  requestedDomain: "operational",
  createdAt: "2026-10-15T08:09:00.000Z",
};

const recommendation: M41bRecommendation = {
  id: "SYNTH-REC",
  requestId: "SYNTH-REQUEST",
  summary: "Synthetic recommendation",
  sourceIds: ["SYNTH-SOURCE"],
  materialDomain: "operational",
  createdByRole: "administrator",
  createdAt: "2026-10-15T08:10:00.000Z",
  status: "approved",
  humanDecisionId: "SYNTH-DECISION",
  downstreamTaskId: "SYNTH-TASK-DAILY",
  evidenceClass: "synthetic_demo",
};

const decision: M41bHumanDecision = {
  id: "SYNTH-DECISION",
  recommendationId: "SYNTH-REC",
  disposition: "approve",
  rationale: "Synthetic human rationale",
  decidedBy: "SYNTH-ACTOR",
  decidedByRole: "administrator",
  decidedAt: "2026-10-15T08:20:00.000Z",
  overrideReason: null,
  evidenceClass: "synthetic_demo",
};

const evidence: M41bCompletionEvidence = {
  id: "SYNTH-EVIDENCE",
  taskId: "SYNTH-TASK-DAILY",
  evidenceRef: "synthetic://evidence",
  summary: "Synthetic completion evidence",
  recordedBy: "SYNTH-ACTOR",
  recordedAt: "2026-10-15T16:00:00.000Z",
  evidenceClass: "synthetic_demo",
};

const auditEvent: M41bAuditEvent = {
  id: "SYNTH-AUDIT",
  eventType: "task_completed",
  actorId: "SYNTH-ACTOR",
  actorRole: "administrator",
  entityType: "workplan_item",
  entityId: "SYNTH-TASK-DAILY",
  correlationId: "SYNTH-CORRELATION",
  sourceIds: ["SYNTH-SOURCE"],
  before: null,
  after: { status: "completed" },
  occurredAt: "2026-10-15T16:00:00.000Z",
  evidenceClass: "synthetic_demo",
};

describe("M4.1B experience model", () => {
  it("reads workplan items from all five contract cadences", () => {
    expect(allWorkplanItems(workplan).map((item) => item.cadence)).toEqual(
      cadences,
    );
  });

  it("reports unresolved task sources instead of inventing metadata", () => {
    const unresolved = resolveItemSources(
      { ...task("daily"), sourceIds: [source.id, "SYNTH-MISSING"] },
      [source],
    );
    expect(unresolved.resolved).toEqual([source]);
    expect(unresolved.unresolvedIds).toEqual(["SYNTH-MISSING"]);
  });

  it("joins only explicit recommendation, decision, task, evidence, and audit references", () => {
    const [lineage] = buildM41bLineages({
      workplan,
      sources: [source],
      requests: [request],
      guidance: [guidance],
      recommendations: [recommendation],
      decisions: [decision],
      completionEvidence: [evidence],
      auditEvents: [auditEvent],
    });

    expect(lineage.guidance?.responseId).toBe("SYNTH-RESPONSE");
    expect(lineage.request?.prompt).toBe(
      "Explain the synthetic governed recommendation.",
    );
    expect(lineage.decision?.id).toBe("SYNTH-DECISION");
    expect(lineage.task?.id).toBe("SYNTH-TASK-DAILY");
    expect(lineage.evidence.map((entry) => entry.id)).toEqual([
      "SYNTH-EVIDENCE",
    ]);
    expect(lineage.auditEvents.map((event) => event.id)).toEqual([
      "SYNTH-AUDIT",
    ]);
    expect(lineage.integrityNotes).toEqual([]);
  });

  it("surfaces broken lineage references as integrity notes", () => {
    const [lineage] = buildM41bLineages({
      workplan,
      sources: [],
      requests: [request],
      guidance: [],
      recommendations: [
        {
          ...recommendation,
          humanDecisionId: "SYNTH-NOT-FOUND-DECISION",
          downstreamTaskId: "SYNTH-NOT-FOUND-TASK",
        },
      ],
      decisions: [],
      completionEvidence: [],
      auditEvents: [],
    });

    expect(lineage.task).toBe(
      task("daily").id ? workplan.briefs.daily.items[0] : null,
    );
    expect(lineage.integrityNotes.join(" ")).toContain(
      "Referenced human decision SYNTH-NOT-FOUND-DECISION is unavailable.",
    );
    expect(lineage.integrityNotes.join(" ")).toContain(
      "Referenced downstream task SYNTH-NOT-FOUND-TASK is unavailable.",
    );
    expect(lineage.integrityNotes.join(" ")).toContain(
      "recommendation source reference is unavailable",
    );
  });
});
