import {
  M41B_CADENCES,
  M41B_GUIDANCE_INTENTS,
  type M41bAuditEvent,
  type M41bCompletionEvidence,
  type M41bGovernedSource,
  type M41bGuidanceIntent,
  type M41bGuidanceRequest,
  type M41bGuidanceResponse,
  type M41bHumanDecision,
  type M41bRecommendation,
  type M41bWorkplan,
  type M41bWorkplanItem,
} from "@contracts/m41b";

export type M41bQueryState = "loading" | "error" | "ready";

export interface M41bGuidanceSubmission {
  prompt: string;
  intent: M41bGuidanceIntent;
  sourceIds?: readonly string[];
  workplanItemId?: string;
  requestedDivision?: M41bWorkplanItem["division"];
  requestedDomain?: M41bWorkplanItem["materialDomain"];
}

export interface M41bDispositionSubmission {
  recommendationId: string;
  disposition: M41bHumanDecision["disposition"];
  rationale: string;
  overrideReason: string | null;
  modifiedSummary: string | null;
}

export interface M41bLineage {
  recommendation: M41bRecommendation;
  request: M41bGuidanceRequest | null;
  guidance: M41bGuidanceResponse | null;
  sources: readonly M41bGovernedSource[];
  unresolvedSourceIds: readonly string[];
  decision: M41bHumanDecision | null;
  task: M41bWorkplanItem | null;
  evidence: readonly M41bCompletionEvidence[];
  auditEvents: readonly M41bAuditEvent[];
  integrityNotes: readonly string[];
}

export interface M41bLineageInput {
  workplan: M41bWorkplan;
  sources: readonly M41bGovernedSource[];
  requests: readonly M41bGuidanceRequest[];
  guidance: readonly M41bGuidanceResponse[];
  recommendations: readonly M41bRecommendation[];
  decisions: readonly M41bHumanDecision[];
  completionEvidence: readonly M41bCompletionEvidence[];
  auditEvents: readonly M41bAuditEvent[];
}

export const M41B_GUIDANCE_INTENT_PRESENTATION = Object.freeze(
  M41B_GUIDANCE_INTENTS.map((intent) => ({
    intent,
    label: prettyToken(intent),
    description: intentDescription(intent),
  })),
);

function intentDescription(intent: M41bGuidanceIntent): string {
  switch (intent) {
    case "explain_priority":
      return "Explain why a governed workplan item is prioritized.";
    case "answer_question":
      return "Answer from authorized, cited source records.";
    case "explain_next_step":
      return "Clarify the next controlled step and its prerequisites.";
    case "launch_workflow":
      return "Prepare a governed workflow launch for human review.";
    case "create_task":
      return "Prepare an owned task with dates and evidence requirements.";
    case "escalate":
      return "Route an exception when authority or evidence is insufficient.";
    case "route_supervisor":
      return "Identify and route to an authorized supervisor role.";
  }
}

export function prettyToken(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function formatTimestamp(value: string | null): string {
  if (!value) return "Not recorded";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

export function formatConfidence(value: number | null): string {
  if (value === null) return "Not established";
  return `${Math.round(value * 100)}%`;
}

export function allWorkplanItems(
  workplan: M41bWorkplan,
): readonly M41bWorkplanItem[] {
  return M41B_CADENCES.flatMap((cadence) => workplan.briefs[cadence].items);
}

export function resolveItemSources(
  item: M41bWorkplanItem,
  sources: readonly M41bGovernedSource[],
): {
  resolved: readonly M41bGovernedSource[];
  unresolvedIds: readonly string[];
} {
  const sourceById = new Map(sources.map((source) => [source.id, source]));
  return {
    resolved: item.sourceIds.flatMap((id) => {
      const source = sourceById.get(id);
      return source ? [source] : [];
    }),
    unresolvedIds: item.sourceIds.filter((id) => !sourceById.has(id)),
  };
}

export function buildM41bLineages(
  input: M41bLineageInput,
): readonly M41bLineage[] {
  const items = allWorkplanItems(input.workplan);
  const sourceById = new Map(
    input.sources.map((source) => [source.id, source]),
  );

  return input.recommendations.map((recommendation) => {
    const integrityNotes: string[] = [];
    const request =
      input.requests.find(
        (candidate) => candidate.requestId === recommendation.requestId,
      ) ?? null;
    if (!request) {
      integrityNotes.push(
        `Referenced guidance request ${recommendation.requestId} is unavailable.`,
      );
    }
    const sources = recommendation.sourceIds.flatMap((id) => {
      const source = sourceById.get(id);
      return source ? [source] : [];
    });
    const unresolvedSourceIds = recommendation.sourceIds.filter(
      (id) => !sourceById.has(id),
    );
    if (unresolvedSourceIds.length > 0) {
      integrityNotes.push(
        `${unresolvedSourceIds.length} recommendation source reference${unresolvedSourceIds.length === 1 ? " is" : "s are"} unavailable.`,
      );
    }

    const guidance =
      input.guidance.find(
        (response) => response.requestId === recommendation.requestId,
      ) ?? null;

    const decisionsByReference = input.decisions.filter(
      (decision) => decision.recommendationId === recommendation.id,
    );
    const decisionById = recommendation.humanDecisionId
      ? (input.decisions.find(
          (decision) => decision.id === recommendation.humanDecisionId,
        ) ?? null)
      : null;
    const decision = decisionById ?? decisionsByReference[0] ?? null;

    if (recommendation.humanDecisionId && !decisionById) {
      integrityNotes.push(
        `Referenced human decision ${recommendation.humanDecisionId} is unavailable.`,
      );
    }
    if (decisionsByReference.length > 1) {
      integrityNotes.push(
        "Multiple human dispositions reference this recommendation; review the audit record.",
      );
    }
    if (decisionById && decisionById.recommendationId !== recommendation.id) {
      integrityNotes.push(
        "The recommendation and human-decision references do not agree.",
      );
    }

    const taskById = recommendation.downstreamTaskId
      ? (items.find((item) => item.id === recommendation.downstreamTaskId) ??
        null)
      : null;
    const tasksByReference = items.filter(
      (item) => item.recommendationId === recommendation.id,
    );
    const task = taskById ?? tasksByReference[0] ?? null;

    if (recommendation.downstreamTaskId && !taskById) {
      integrityNotes.push(
        `Referenced downstream task ${recommendation.downstreamTaskId} is unavailable.`,
      );
    }
    if (tasksByReference.length > 1) {
      integrityNotes.push(
        "Multiple workplan items reference this recommendation; review task lineage.",
      );
    }
    if (taskById && taskById.recommendationId !== recommendation.id) {
      integrityNotes.push(
        "The recommendation and downstream-task references do not agree.",
      );
    }

    const evidence = task
      ? input.completionEvidence.filter((entry) => entry.taskId === task.id)
      : [];
    if (task) {
      const availableEvidenceIds = new Set(evidence.map((entry) => entry.id));
      const unresolvedEvidenceIds = task.completionEvidenceIds.filter(
        (id) => !availableEvidenceIds.has(id),
      );
      if (unresolvedEvidenceIds.length > 0) {
        integrityNotes.push(
          `${unresolvedEvidenceIds.length} task evidence reference${unresolvedEvidenceIds.length === 1 ? " is" : "s are"} unavailable.`,
        );
      }
    }

    const entityIds = new Set([
      recommendation.id,
      recommendation.requestId,
      ...(guidance ? [guidance.responseId] : []),
      ...(decision ? [decision.id] : []),
      ...(task ? [task.id] : []),
      ...evidence.map((entry) => entry.id),
    ]);
    const directEvents = input.auditEvents.filter((event) =>
      entityIds.has(event.entityId),
    );
    const correlationIds = new Set(
      directEvents.map((event) => event.correlationId),
    );
    const auditEvents = input.auditEvents.filter(
      (event) =>
        entityIds.has(event.entityId) ||
        correlationIds.has(event.correlationId),
    );

    return {
      recommendation,
      request,
      guidance,
      sources,
      unresolvedSourceIds,
      decision,
      task,
      evidence,
      auditEvents,
      integrityNotes,
    };
  });
}

export function firstWorkplanItemId(workplan: M41bWorkplan): string | null {
  return allWorkplanItems(workplan)[0]?.id ?? null;
}
