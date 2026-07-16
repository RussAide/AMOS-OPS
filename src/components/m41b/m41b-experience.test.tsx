import {
  M41B_CADENCES,
  M41B_ENVIRONMENT_LABEL,
  M41B_GUIDANCE_INTENTS,
  M41B_SOURCE_REGISTER,
  buildM41bRoleContext,
  type M41bAuditEvent,
  type M41bCadence,
  type M41bCompletionEvidence,
  type M41bGuidanceResponse,
  type M41bGuidanceRequest,
  type M41bHumanDecision,
  type M41bRecommendation,
  type M41bWorkplan,
  type M41bWorkplanItem,
} from "@contracts/m41b";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { M41bAskAmosPanel } from "./m41b-ask-amos-panel";
import { M41bIntelligenceAssistantView } from "./m41b-intelligence-assistant-view";

function item(cadence: M41bCadence, index: number): M41bWorkplanItem {
  const source = M41B_SOURCE_REGISTER[index];
  return {
    id: `SYNTH-UI-TASK-${cadence.toUpperCase()}`,
    naturalKey: `synthetic:ui:${cadence}`,
    cadence,
    title: `${cadence[0].toUpperCase()}${cadence.slice(1)} governed commitment`,
    objective: `Exercise the ${cadence} synthetic workflow.`,
    priority: index === 0 ? "critical" : "high",
    ownerId: "SYNTH-M41B-ADMINISTRATOR",
    ownerRole: "administrator",
    division: "eo",
    materialDomain: source.materialDomain,
    workflowKey: `synthetic:ui:${cadence}`,
    dueAt: "2026-10-15T17:00:00.000Z",
    dependencyIds: index === 0 ? [] : [`SYNTH-UI-DEPENDENCY-${index}`],
    sourceIds: [source.id],
    recommendationId: index === 0 ? "SYNTH-UI-REC" : null,
    status: index === 0 ? "completed" : "pending_approval",
    humanApprovalRequired: true,
    approvalId: index === 0 ? "SYNTH-UI-DECISION" : null,
    evidenceRequirements: ["Synthetic completion artifact"],
    completionEvidenceIds: index === 0 ? ["SYNTH-UI-EVIDENCE"] : [],
    closedAt: index === 0 ? "2026-10-15T16:00:00.000Z" : null,
    evidenceClass: "synthetic_demo",
  };
}

const workplanItems = M41B_CADENCES.map(item);

const workplan: M41bWorkplan = {
  milestone: "M4.1B",
  environmentId: "AMOS-OPS-M4.1B-EVALUATION",
  environmentLabel: M41B_ENVIRONMENT_LABEL,
  generatedAt: "2026-10-15T08:00:00.000Z",
  roleContext: buildM41bRoleContext("administrator"),
  briefs: {
    daily: {
      cadence: "daily",
      title: "Daily / shift brief",
      purpose: "Control today's governed priorities.",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [workplanItems[0]],
      sourceStates: ["current"],
      limitations: ["Synthetic guidance only"],
    },
    weekly: {
      cadence: "weekly",
      title: "Weekly review brief",
      purpose: "Review weekly commitments.",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [workplanItems[1]],
      sourceStates: ["current"],
      limitations: [],
    },
    monthly: {
      cadence: "monthly",
      title: "Monthly performance brief",
      purpose: "Review monthly performance.",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [workplanItems[2]],
      sourceStates: ["current"],
      limitations: [],
    },
    quarterly: {
      cadence: "quarterly",
      title: "Quarterly strategy brief",
      purpose: "Review quarterly strategy.",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [workplanItems[3]],
      sourceStates: ["current"],
      limitations: [],
    },
    annual: {
      cadence: "annual",
      title: "Annual planning brief",
      purpose: "Review annual planning.",
      generatedAt: "2026-10-15T08:00:00.000Z",
      items: [workplanItems[4]],
      sourceStates: ["current"],
      limitations: [],
    },
  },
  productionActionsBlocked: true,
  evidenceClass: "synthetic_demo",
};

const citationSource = M41B_SOURCE_REGISTER[0];
const guidanceRequest: M41bGuidanceRequest = {
  requestId: "SYNTH-UI-REQUEST",
  prompt: "Explain the governed synthetic daily control and its next step.",
  intent: "explain_next_step",
  roleContext: workplan.roleContext,
  sourceIds: [citationSource.id],
  workplanItemId: "SYNTH-UI-TASK-DAILY",
  requestedDivision: "eo",
  requestedDomain: "operational",
  createdAt: "2026-10-15T08:10:00.000Z",
};
const guidance: M41bGuidanceResponse = {
  responseId: "SYNTH-UI-RESPONSE",
  requestId: "SYNTH-UI-REQUEST",
  answer: "Use the cited synthetic control and obtain human approval.",
  nextSteps: ["Review cited source", "Record accountable human disposition"],
  citations: [
    {
      sourceId: citationSource.id,
      title: citationSource.title,
      version: citationSource.version,
      ownerRole: citationSource.ownerRole,
      effectiveAt: citationSource.effectiveAt,
      refreshedAt: citationSource.refreshedAt,
      state: citationSource.state,
      applicableLimits: citationSource.applicableLimits,
      missingEvidence: citationSource.missingEvidence,
      confidence: citationSource.confidence,
      uncertainty: citationSource.uncertainty,
      recordIds: citationSource.recordIds,
    },
  ],
  confidence: 0.96,
  uncertainty: "Synthetic UI test uncertainty.",
  applicableLimits: ["Human approval remains controlling"],
  missingEvidence: ["Synthetic confirmation"],
  recommendationId: "SYNTH-UI-REC",
  workflowLaunch: {
    workflowKey: "synthetic:ui:daily",
    blockedPendingApproval: true,
  },
  humanGate: {
    required: true,
    materialDomain: "operational",
    accountableRoles: ["administrator"],
    disposition: "approved",
    decisionId: "SYNTH-UI-DECISION",
  },
  escalation: {
    required: true,
    routeTo: ["managing-director"],
    reason: "Synthetic delegated-authority limit.",
  },
  refused: false,
  refusalCode: null,
  evidenceClass: "synthetic_demo",
};

const recommendation: M41bRecommendation = {
  id: "SYNTH-UI-REC",
  requestId: "SYNTH-UI-REQUEST",
  summary: "Complete the synthetic daily control.",
  sourceIds: [citationSource.id],
  materialDomain: "operational",
  createdByRole: "administrator",
  createdAt: "2026-10-15T08:10:00.000Z",
  status: "approved",
  humanDecisionId: "SYNTH-UI-DECISION",
  downstreamTaskId: "SYNTH-UI-TASK-DAILY",
  evidenceClass: "synthetic_demo",
};

const decision: M41bHumanDecision = {
  id: "SYNTH-UI-DECISION",
  recommendationId: "SYNTH-UI-REC",
  disposition: "approve",
  rationale: "Synthetic accountable human rationale.",
  decidedBy: "SYNTH-M41B-ADMINISTRATOR",
  decidedByRole: "administrator",
  decidedAt: "2026-10-15T08:20:00.000Z",
  overrideReason: null,
  evidenceClass: "synthetic_demo",
};

const evidence: M41bCompletionEvidence = {
  id: "SYNTH-UI-EVIDENCE",
  taskId: "SYNTH-UI-TASK-DAILY",
  evidenceRef: "synthetic://ui-evidence",
  summary: "Synthetic completion evidence",
  recordedBy: "SYNTH-M41B-ADMINISTRATOR",
  recordedAt: "2026-10-15T16:00:00.000Z",
  evidenceClass: "synthetic_demo",
};

const auditEvent: M41bAuditEvent = {
  id: "SYNTH-UI-AUDIT",
  eventType: "task_completed",
  actorId: "SYNTH-M41B-ADMINISTRATOR",
  actorRole: "administrator",
  entityType: "workplan_item",
  entityId: "SYNTH-UI-TASK-DAILY",
  correlationId: "SYNTH-UI-CORRELATION",
  sourceIds: [citationSource.id],
  before: null,
  after: { status: "completed" },
  occurredAt: "2026-10-15T16:00:00.000Z",
  evidenceClass: "synthetic_demo",
};

describe("M4.1B governed experience", () => {
  it("renders the persistent synthetic boundary, role context, every cadence, every task, and source transparency", () => {
    const markup = renderToStaticMarkup(
      <M41bIntelligenceAssistantView
        activeGuidance={guidance}
        auditEvents={[auditEvent]}
        completionEvidence={[evidence]}
        decisions={[decision]}
        guidanceHistory={[guidance]}
        isRefreshing={false}
        isSubmittingDisposition={false}
        isSubmittingGuidance={false}
        onAsk={() => undefined}
        onDisposition={() => undefined}
        onRefresh={() => undefined}
        recommendations={[recommendation]}
        requests={[guidanceRequest]}
        sources={M41B_SOURCE_REGISTER}
        state="ready"
        workplan={workplan}
      />,
    );

    expect(markup).toContain(M41B_ENVIRONMENT_LABEL);
    expect(markup).toContain("Server-authorized role context");
    expect(markup).toContain("Supervisor routing");
    for (const cadence of M41B_CADENCES) {
      expect(markup).toContain(
        `${cadence[0].toUpperCase()}${cadence.slice(1)} governed commitment`,
      );
    }
    expect(markup).toContain("Freshness / refreshed");
    expect(markup).toContain("Applicable limits");
    expect(markup).toContain("Missing evidence");
    expect(markup).toContain("Confidence");
    expect(markup).toContain("Uncertainty");
    expect(markup).toContain("Human approval required");
    expect(markup).toContain("Production actions blocked");
  });

  it("renders every contract guidance intent and the complete lineage stages", () => {
    const markup = renderToStaticMarkup(
      <M41bIntelligenceAssistantView
        activeGuidance={guidance}
        auditEvents={[auditEvent]}
        completionEvidence={[evidence]}
        decisions={[decision]}
        guidanceHistory={[guidance]}
        isRefreshing={false}
        isSubmittingDisposition={false}
        isSubmittingGuidance={false}
        onAsk={() => undefined}
        onRefresh={() => undefined}
        recommendations={[recommendation]}
        requests={[guidanceRequest]}
        sources={M41B_SOURCE_REGISTER}
        state="ready"
        workplan={workplan}
      />,
    );

    for (const intent of M41B_GUIDANCE_INTENTS) {
      const label = intent
        .replace(/_/g, " ")
        .replace(/\b\w/g, (character) => character.toUpperCase());
      expect(markup).toContain(label);
    }
    expect(markup).toContain("Prompt");
    expect(markup).toContain("Sources");
    expect(markup).toContain("Recommendation");
    expect(markup).toContain("Human disposition");
    expect(markup).toContain("Owned task");
    expect(markup).toContain("Completion evidence");
    expect(markup).toContain("Prompt-to-evidence audit events");
    expect(markup).toContain(
      "Supplied lineage references are internally consistent",
    );
  });

  it("makes refusal, uncertainty, escalation reason, and supervisor route visible", () => {
    const refusal: M41bGuidanceResponse = {
      ...guidance,
      responseId: "SYNTH-UI-REFUSAL",
      answer: "The requested cross-division retrieval is not authorized.",
      citations: [],
      confidence: null,
      uncertainty: "No authorized source set is available.",
      recommendationId: null,
      humanGate: {
        ...guidance.humanGate,
        disposition: "pending",
        decisionId: null,
      },
      escalation: {
        required: true,
        routeTo: ["managing-director"],
        reason: "Cross-division authority is required.",
      },
      refused: true,
      refusalCode: "M41B_CROSS_DIVISION_ACCESS_DENIED",
    };
    const markup = renderToStaticMarkup(
      <M41bAskAmosPanel
        isSubmittingDisposition={false}
        isSubmittingGuidance={false}
        onAsk={() => undefined}
        onRouteSupervisor={() => undefined}
        response={refusal}
        selectedItem={workplanItems[0]}
      />,
    );

    expect(markup).toContain("Governed refusal");
    expect(markup).toContain("M41B_CROSS_DIVISION_ACCESS_DENIED");
    expect(markup).toContain("No authorized source set is available.");
    expect(markup).toContain("Cross-division authority is required.");
    expect(markup).toContain("Managing Director");
    expect(markup).toContain("No citation snapshots returned");
  });
});
