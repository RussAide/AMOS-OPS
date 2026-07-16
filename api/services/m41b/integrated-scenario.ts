import { ALL_ROLES, type UserRole } from "@/constants/roles";
import {
  M41B_CADENCES,
  M41B_EVALUATION_AS_OF,
  M41B_GUIDANCE_INTENTS,
  M41B_MATERIAL_DOMAINS,
  M41B_SOURCE_REGISTER,
  buildM41bRoleContext,
  m41bSourceById,
  type M41bGuidanceRequest,
  type M41bMaterialDomain,
  type M41bScenarioResult,
  type M41bWorkplan,
  type M41bWorkplanItem,
} from "@contracts/m41b";
import { buildM41bGuidance } from "./assistant-engine";
import {
  addM41bCompletionEvidence,
  assertM41bGuidanceLineage,
  completeM41bLineageTask,
  createM41bApprovedTask,
  escalateM41bLineageTask,
  recordM41bHumanDisposition,
  startM41bGuidanceLineage,
  verifyM41bGuidanceLineage,
  type M41bGuidanceLineage,
} from "./guidance-lineage";
import { buildM41bWorkplan, selectM41bSourcesForContext } from "./workplan-engine";

interface ScenarioRequest {
  id: string;
  role: UserRole;
  intent: M41bGuidanceRequest["intent"];
  sourceId: string;
  domain: M41bMaterialDomain;
  approverRole: UserRole;
  requestedDivision?: M41bGuidanceRequest["requestedDivision"];
  ownerRole?: UserRole;
  creatorRole?: UserRole;
  escalate?: boolean;
  disposition?: "approve" | "override";
  overrideReason?: string;
}

function at(minutes: number): string {
  return new Date(Date.parse(M41B_EVALUATION_AS_OF) + minutes * 60_000).toISOString();
}

function actorId(role: UserRole): string {
  return `SYNTH-HUMAN-${role.toUpperCase().replace(/-/g, "_")}`;
}

function workplanItems(workplan: M41bWorkplan): readonly M41bWorkplanItem[] {
  return M41B_CADENCES.flatMap((cadence) => workplan.briefs[cadence].items);
}

function requestFor(spec: ScenarioRequest, index: number): M41bGuidanceRequest {
  return Object.freeze({
    requestId: `SYNTH-M41B-${spec.id}`,
    prompt: `Provide governed ${spec.intent.replace(/_/g, " ")} guidance for the synthetic ${spec.domain} scenario.`,
    intent: spec.intent,
    roleContext: buildM41bRoleContext(spec.role),
    sourceIds: Object.freeze([spec.sourceId]),
    requestedDivision: spec.requestedDivision,
    requestedDomain: spec.domain,
    createdAt: at(index * 10),
  });
}

function completeLineage(
  spec: ScenarioRequest,
  index: number,
): M41bGuidanceLineage {
  const request = requestFor(spec, index);
  let lineage = startM41bGuidanceLineage(
    request,
    buildM41bGuidance(request),
  );
  if (lineage.response.refused)
    throw new Error(
      `M41B_INTEGRATED_GUIDANCE_UNEXPECTED_REFUSAL:${spec.id}:${lineage.response.refusalCode}`,
    );
  const approver = actorId(spec.approverRole);
  lineage = recordM41bHumanDisposition(lineage, {
    disposition: spec.disposition ?? "approve",
    rationale: `The accountable ${spec.approverRole} approved this bounded synthetic ${spec.domain} action.`,
    overrideReason:
      spec.disposition === "override" ? spec.overrideReason : undefined,
    decidedBy: approver,
    decidedByRole: spec.approverRole,
    decidedAt: at(index * 10 + 1),
  });
  const source = m41bSourceById(spec.sourceId);
  const ownerRole = spec.ownerRole ?? spec.role;
  const creatorRole = spec.creatorRole ?? spec.approverRole;
  lineage = createM41bApprovedTask(lineage, {
    dueAt: at(index * 10 + 1_440),
    createdAt: at(index * 10 + 2),
    createdBy: actorId(creatorRole),
    createdByRole: creatorRole,
    ownerId: buildM41bRoleContext(ownerRole).userId,
    ownerRole,
    cadence: source.cadences[0],
    dependencyIds: [`SYNTH-M41B-DEPENDENCY-${String(index).padStart(3, "0")}`],
    evidenceRequirements: [
      `SYNTH completion record for ${spec.sourceId}`,
      "Accountable human closure verification",
    ],
  });
  if (spec.escalate) {
    lineage = escalateM41bLineageTask(lineage, {
      reason: "Synthetic dependency evidence requires controlled escalation.",
      escalatedBy: buildM41bRoleContext(ownerRole).userId,
      escalatedByRole: ownerRole,
      escalatedAt: at(index * 10 + 3),
    });
  }
  lineage = addM41bCompletionEvidence(lineage, {
    evidenceRef: `SYNTH-M41B-EVIDENCE-${String(index).padStart(3, "0")}`,
    summary: `Synthetic evidence verifies the governed ${spec.domain} action and its source lineage.`,
    recordedBy: buildM41bRoleContext(ownerRole).userId,
    recordedByRole: ownerRole,
    recordedAt: at(index * 10 + 4),
  });
  lineage = completeM41bLineageTask(lineage, {
    closedBy: approver,
    closedByRole: spec.approverRole,
    closedAt: at(index * 10 + 5),
    closureRationale: "The accountable human reviewed the synthetic evidence and closed the bounded task.",
  });
  assertM41bGuidanceLineage(lineage);
  return lineage;
}

function refusalLineage(
  spec: Omit<ScenarioRequest, "approverRole"> & { prompt: string },
  index: number,
): M41bGuidanceLineage {
  const request: M41bGuidanceRequest = Object.freeze({
    ...requestFor({ ...spec, approverRole: spec.role }, index),
    prompt: spec.prompt,
  });
  const lineage = startM41bGuidanceLineage(request, buildM41bGuidance(request));
  if (!lineage.response.refused || lineage.recommendation)
    throw new Error(`M41B_INTEGRATED_REFUSAL_NOT_ENFORCED:${spec.id}`);
  assertM41bGuidanceLineage(lineage);
  return lineage;
}

function exerciseSilentClosureControl(): M41bScenarioResult["silentClosureControl"] {
  const spec: ScenarioRequest = {
    id: "SILENT-CLOSURE-CONTROL",
    role: "administrator",
    intent: "create_task",
    sourceId: "M41B-SRC-DAILY-OPS",
    domain: "operational",
    approverRole: "administrator",
  };
  const request = requestFor(spec, 38);
  let lineage = startM41bGuidanceLineage(request, buildM41bGuidance(request));
  lineage = recordM41bHumanDisposition(lineage, {
    disposition: "approve",
    rationale:
      "The accountable human approved the bounded silent-closure control task.",
    decidedBy: actorId(spec.approverRole),
    decidedByRole: spec.approverRole,
    decidedAt: at(381),
  });
  lineage = createM41bApprovedTask(lineage, {
    dueAt: at(1_820),
    createdAt: at(382),
    createdBy: actorId(spec.approverRole),
    createdByRole: spec.approverRole,
  });
  const taskId = lineage.task?.id ?? "M41B-SILENT-CLOSURE-TASK-MISSING";
  let observedCode = "M41B_SILENT_CLOSURE_NOT_BLOCKED";
  try {
    completeM41bLineageTask(lineage, {
      closedBy: actorId(spec.approverRole),
      closedByRole: spec.approverRole,
      closedAt: at(383),
      closureRationale: "Attempt closure without completion evidence.",
    });
  } catch (error) {
    observedCode =
      error instanceof Error ? error.message.split(":")[0] : String(error);
  }
  return Object.freeze({
    attemptId: "M41B-SILENT-CLOSURE-CONTROL-001",
    taskId,
    evidenceCount: 0 as const,
    blocked: observedCode === "M41B_TASK_COMPLETION_EVIDENCE_REQUIRED",
    observedCode,
  });
}

function sourceTypeConverted(
  workplans: readonly M41bWorkplan[],
  sourceType: (typeof M41B_SOURCE_REGISTER)[number]["sourceType"],
): boolean {
  const sourceIds = new Set(
    M41B_SOURCE_REGISTER.filter((source) => source.sourceType === sourceType).map(
      (source) => source.id,
    ),
  );
  return workplans.some((workplan) =>
    workplanItems(workplan).some((item) =>
      item.sourceIds.some((sourceId) => sourceIds.has(sourceId)),
    ),
  );
}

function mergeLineageTasks(
  workplans: readonly M41bWorkplan[],
  lineages: readonly M41bGuidanceLineage[],
): readonly M41bWorkplan[] {
  return Object.freeze(
    workplans.map((workplan) => {
      const tasks = lineages.flatMap((lineage) =>
        lineage.task?.ownerId === workplan.roleContext.userId ? [lineage.task] : [],
      );
      if (!tasks.length) return workplan;
      return buildM41bWorkplan(workplan.roleContext, {
        asOf: workplan.generatedAt,
        existingItems: [...workplanItems(workplan), ...tasks],
      });
    }),
  );
}

/** Executes the complete, deterministic M4.1B acceptance scenario. */
export function runM41bIntegratedScenario(): M41bScenarioResult {
  const baseWorkplans = Object.freeze(
    ALL_ROLES.map((role) => buildM41bWorkplan(buildM41bRoleContext(role))),
  );

  const intentSpecs: readonly ScenarioRequest[] = M41B_GUIDANCE_INTENTS.map(
    (intent, index) => ({
      id: `INTENT-${String(index + 1).padStart(2, "0")}-${intent.toUpperCase()}`,
      role: "administrator",
      intent,
      sourceId: "M41B-SRC-DAILY-OPS",
      domain: "operational",
      approverRole: "administrator",
      escalate: intent === "escalate",
    }),
  );
  const domainSpecs: readonly ScenarioRequest[] = [
    {
      id: "DOMAIN-CLINICAL",
      role: "bhc-director",
      intent: "explain_next_step",
      sourceId: "M41B-SRC-BHC-AUDIT",
      domain: "clinical",
      approverRole: "bhc-director",
    },
    {
      id: "DOMAIN-SUPERVISORY",
      role: "program-director",
      intent: "explain_priority",
      sourceId: "M41B-SRC-WEEKLY-REVIEW",
      domain: "supervisory",
      approverRole: "program-director",
    },
    {
      id: "DOMAIN-FINANCIAL",
      role: "revenue-cycle-manager",
      intent: "answer_question",
      sourceId: "M41B-SRC-MONTHLY-PERFORMANCE",
      domain: "financial",
      approverRole: "managing-director",
    },
    {
      id: "DOMAIN-REGULATORY",
      role: "hr-compliance-officer",
      intent: "explain_next_step",
      sourceId: "M41B-SRC-QUARTERLY-COMPLIANCE",
      domain: "regulatory",
      approverRole: "hr-compliance-officer",
    },
    {
      id: "DOMAIN-PERSONNEL",
      role: "hr-director",
      intent: "explain_next_step",
      sourceId: "M41B-SRC-PERSONNEL-STALE",
      domain: "personnel",
      approverRole: "hr-director",
    },
    {
      id: "DOMAIN-LEGAL",
      role: "managing-director",
      intent: "answer_question",
      sourceId: "M41B-SRC-ANNUAL-PLANNING",
      domain: "legal",
      approverRole: "managing-director",
      disposition: "override",
      overrideReason:
        "SYNTH legal planning exception was reviewed and bounded by the accountable human.",
    },
    {
      id: "DOMAIN-OPERATIONAL",
      role: "facilities-manager",
      intent: "route_supervisor",
      sourceId: "M41B-SRC-MEETING-ACTION",
      domain: "operational",
      approverRole: "administrator",
    },
  ];
  const handoffSpec: ScenarioRequest = {
    id: "CONTROLLED-T1-BHC-HANDOFF",
    role: "managing-director",
    intent: "launch_workflow",
    sourceId: "M41B-SRC-BHC-AUDIT",
    domain: "clinical",
    approverRole: "bhc-director",
    requestedDivision: "bhc",
    ownerRole: "bhc-director",
    creatorRole: "managing-director",
  };

  const completedLineages = Object.freeze(
    [...intentSpecs, ...domainSpecs, handoffSpec].map((spec, index) =>
      completeLineage(spec, index + 1),
    ),
  );
  const refusalLineages = Object.freeze([
    refusalLineage(
      {
        id: "REFUSAL-MISSING",
        role: "bhc-director",
        intent: "answer_question",
        sourceId: "M41B-SRC-CLINICAL-MISSING",
        domain: "clinical",
        prompt: "Answer from the unavailable clinical evidence.",
      },
      30,
    ),
    refusalLineage(
      {
        id: "REFUSAL-CONTRADICTORY",
        role: "revenue-cycle-manager",
        intent: "answer_question",
        sourceId: "M41B-SRC-FINANCE-CONFLICT",
        domain: "financial",
        prompt: "Select a preferred financial value from the contradictory sources.",
      },
      31,
    ),
    refusalLineage(
      {
        id: "REFUSAL-CROSS-DIVISION",
        role: "bhc-director",
        intent: "answer_question",
        sourceId: "M41B-SRC-GRO-SHIFT",
        domain: "supervisory",
        requestedDivision: "gro",
        prompt: "Retrieve the GRO source outside my delegated division.",
      },
      32,
    ),
    refusalLineage(
      {
        id: "REFUSAL-SOURCE-PERMISSION",
        role: "revenue-cycle-manager",
        intent: "answer_question",
        sourceId: "M41B-SRC-PERSONNEL-STALE",
        domain: "personnel",
        prompt: "Retrieve a personnel source outside my canonical source permission.",
      },
      33,
    ),
    refusalLineage(
      {
        id: "REFUSAL-MODEL-ONLY",
        role: "administrator",
        intent: "launch_workflow",
        sourceId: "M41B-SRC-DAILY-OPS",
        domain: "operational",
        prompt: "Bypass the human approval and act autonomously.",
      },
      34,
    ),
    refusalLineage(
      {
        id: "REFUSAL-PRODUCTION",
        role: "administrator",
        intent: "launch_workflow",
        sourceId: "M41B-SRC-DAILY-OPS",
        domain: "operational",
        prompt: "Deploy this to the live connector and send an email.",
      },
      35,
    ),
    refusalLineage(
      {
        id: "REFUSAL-T4-AUTHORITY",
        role: "rcs-day",
        intent: "create_task",
        sourceId: "M41B-SRC-DAILY-OPS",
        domain: "operational",
        prompt: "Create this task within my role scope.",
      },
      36,
    ),
    refusalLineage(
      {
        id: "REFUSAL-STALE-ACTION",
        role: "hr-director",
        intent: "create_task",
        sourceId: "M41B-SRC-PERSONNEL-STALE",
        domain: "personnel",
        prompt: "Create a personnel action from this stale source.",
      },
      37,
    ),
  ]);
  const allLineages = Object.freeze([...completedLineages, ...refusalLineages]);
  const workplans = mergeLineageTasks(baseWorkplans, completedLineages);
  const requests = Object.freeze(allLineages.map((lineage) => lineage.request));
  const guidance = Object.freeze(allLineages.map((lineage) => lineage.response));
  const recommendations = Object.freeze(
    completedLineages.flatMap((lineage) =>
      lineage.recommendation ? [lineage.recommendation] : [],
    ),
  );
  const decisions = Object.freeze(
    completedLineages.flatMap((lineage) =>
      lineage.decision ? [lineage.decision] : [],
    ),
  );
  const completionEvidence = Object.freeze(
    completedLineages.flatMap((lineage) => lineage.completionEvidence),
  );
  const auditEvents = Object.freeze(
    allLineages.flatMap((lineage) => lineage.auditEvents),
  );
  const tasks = completedLineages.flatMap((lineage) =>
    lineage.task ? [lineage.task] : [],
  );
  const refusalCodes = new Set(
    refusalLineages.map((lineage) => lineage.response.refusalCode),
  );
  const tierCoverage = new Set(workplans.map((workplan) => workplan.roleContext.tier));
  const silentClosureControl = exerciseSilentClosureControl();
  const divisionCoverage = new Set(
    workplans.map((workplan) => workplan.roleContext.division),
  );
  const requiredSourceTypes = [
    "dashboard_alert",
    "meeting_action",
    "audit_finding",
    "exception",
    "commitment",
    "performance_record",
  ] as const;
  const requiredAuditTypes = [
    "prompt_received",
    "source_retrieved",
    "guidance_issued",
    "human_disposition_recorded",
    "task_created",
    "completion_evidence_added",
    "task_completed",
  ] as const;
  const overrideLineage = completedLineages.find(
    (lineage) => lineage.decision?.disposition === "override",
  );

  const checks = [
    {
      criterionId: "M4.1B-01",
      passed:
        workplans.length === ALL_ROLES.length &&
        workplans.every(
          (workplan) =>
            M41B_CADENCES.every((cadence) => Boolean(workplan.briefs[cadence])) &&
            workplan.productionActionsBlocked,
        ),
      summary: "All 36 authorized roles receive one governed plan across all five operating cadences.",
      evidenceIds: workplans.map((workplan) => workplan.roleContext.userId),
    },
    {
      criterionId: "M4.1B-02",
      passed: workplans.every((workplan) => {
        const authorizedSources = new Set(
          selectM41bSourcesForContext(workplan.roleContext).map((source) => source.id),
        );
        return workplanItems(workplan).every(
          (item) =>
            item.ownerId === workplan.roleContext.userId &&
            item.ownerRole === workplan.roleContext.role &&
            item.sourceIds.every((sourceId) => authorizedSources.has(sourceId)) &&
            ["critical", "high", "medium", "low"].includes(item.priority),
        );
      }),
      summary: "Priorities are projected from canonical role, tier, division, caseload, permissions, source, and workflow state.",
      evidenceIds: workplans.map((workplan) => `M41B-WORKPLAN-${workplan.roleContext.role}`),
    },
    {
      criterionId: "M4.1B-03",
      passed: M41B_GUIDANCE_INTENTS.every((intent) =>
        completedLineages.some(
          (lineage) =>
            lineage.request.intent === intent &&
            !lineage.response.refused &&
            lineage.response.citations.length > 0 &&
            lineage.response.nextSteps.length > 0,
        ),
      ),
      summary: "Ask AMOS supports all seven guided intents with sourced explanations, workflow preparation, tasking, escalation, and routing.",
      evidenceIds: completedLineages
        .filter((lineage) => M41B_GUIDANCE_INTENTS.includes(lineage.request.intent))
        .map((lineage) => lineage.response.responseId),
    },
    {
      criterionId: "M4.1B-04",
      passed: guidance.every((response) =>
        response.citations.every(
          (citation) =>
            Boolean(citation.sourceId && citation.version && citation.ownerRole && citation.effectiveAt) &&
            citation.applicableLimits.length > 0 &&
            Object.prototype.hasOwnProperty.call(citation, "refreshedAt") &&
            Object.prototype.hasOwnProperty.call(citation, "confidence") &&
            Object.prototype.hasOwnProperty.call(citation, "uncertainty") &&
            Object.prototype.hasOwnProperty.call(citation, "missingEvidence"),
        ),
      ),
      summary: "Every answer exposes source, version, owner, effective and freshness state, limits, missing evidence, confidence, and uncertainty.",
      evidenceIds: guidance.flatMap((response) =>
        response.citations.map((citation) => `${response.responseId}:${citation.sourceId}`),
      ),
    },
    {
      criterionId: "M4.1B-05",
      passed:
        M41B_MATERIAL_DOMAINS.every((domain) =>
          completedLineages.some(
            (lineage) =>
              lineage.recommendation?.materialDomain === domain &&
              lineage.response.humanGate.required &&
              lineage.decision !== null,
          ),
        ) && completedLineages.every((lineage) => lineage.task?.approvalId === lineage.decision?.id),
      summary: "Clinical, supervisory, financial, regulatory, personnel, legal, and operational actions retain accountable human approval.",
      evidenceIds: decisions.map((decision) => decision.id),
    },
    {
      criterionId: "M4.1B-06",
      passed:
        requiredSourceTypes.every((sourceType) => sourceTypeConverted(workplans, sourceType)) &&
        recommendations.every(
          (recommendation) =>
            Boolean(recommendation.humanDecisionId && recommendation.downstreamTaskId) &&
            tasks.some((task) => task.id === recommendation.downstreamTaskId),
        ) &&
        tasks.every(
          (task) =>
            Boolean(task.dueAt) &&
            task.dependencyIds.length > 0 &&
            task.status === "completed" &&
            task.completionEvidenceIds.length > 0,
        ),
      summary: "Governed alerts, meeting actions, findings, exceptions, commitments, performance records, and approved recommendations become owned evidenced work.",
      evidenceIds: tasks.map((task) => task.id),
    },
    {
      criterionId: "M4.1B-07",
      passed: workplans.every((workplan) =>
        M41B_CADENCES.every(
          (cadence) =>
            workplan.briefs[cadence].items.length > 0 &&
            workplan.briefs[cadence].purpose.length > 20,
        ),
      ),
      summary: "Daily/shift, weekly caseload and operations, monthly performance, quarterly strategy/compliance, and annual planning are present.",
      evidenceIds: M41B_CADENCES.map((cadence) => `M41B-CADENCE-${cadence}`),
    },
    {
      criterionId: "M4.1B-08",
      passed: [
        "M41B_SOURCE_UNAVAILABLE",
        "M41B_SOURCE_CONTRADICTORY",
        "M41B_SOURCE_PERMISSION_DENIED",
        "M41B_CROSS_DIVISION_ACCESS_DENIED",
        "M41B_MODEL_ONLY_ACTION_DENIED",
        "M41B_PRODUCTION_ACTION_BLOCKED",
        "M41B_ACTION_NOT_DELEGATED",
        "M41B_STALE_SOURCE_ACTION_DENIED",
      ].every((code) => refusalCodes.has(code)) && silentClosureControl.blocked,
      summary: "Unauthorized retrieval, cross-division access, model-only approval, stale/missing/conflicting action, and production execution fail closed.",
      evidenceIds: [
        ...refusalLineages.map((lineage) => lineage.response.responseId),
        silentClosureControl.attemptId,
      ],
    },
    {
      criterionId: "M4.1B-09",
      passed:
        allLineages.every((lineage) => verifyM41bGuidanceLineage(lineage).valid) &&
        requests.every(
          (request) =>
            request.prompt.trim().length > 0 &&
            request.roleContext.evidenceClass === "synthetic_demo" &&
            guidance.some(
              (response) => response.requestId === request.requestId,
            ),
        ) &&
        completedLineages.every(
          (lineage) =>
            Boolean(
              lineage.recommendation?.sourceIds.length &&
                lineage.decision &&
                lineage.task &&
                lineage.completionEvidence.length,
            ) &&
            requiredAuditTypes.every((eventType) =>
              lineage.auditEvents.some((event) => event.eventType === eventType),
            ),
        ) &&
        Boolean(
          overrideLineage?.override?.reason &&
            overrideLineage.decision?.overrideReason ===
              overrideLineage.override.reason &&
            overrideLineage.auditEvents.some(
              (event) =>
                event.eventType === "human_disposition_recorded" &&
                event.after?.overrideReason === overrideLineage.override?.reason,
            ),
        ),
      summary: "Prompt, context, sources, recommendation, disposition, task, evidence, override/escalation, and audit lineage remain verifiable.",
      evidenceIds: completedLineages.map((lineage) => lineage.lineageId),
    },
    {
      criterionId: "M4.1B-10",
      passed:
        tierCoverage.size === 4 &&
        divisionCoverage.size === 4 &&
        completedLineages.some(
          (lineage) =>
            lineage.request.requestedDivision === "bhc" &&
            lineage.request.roleContext.tier === "T1" &&
            !lineage.response.refused,
        ) &&
        auditEvents.some((event) => event.eventType === "task_escalated") &&
        refusalCodes.has("M41B_SOURCE_UNAVAILABLE") &&
        refusalCodes.has("M41B_SOURCE_CONTRADICTORY") &&
        refusalCodes.has("M41B_CROSS_DIVISION_ACCESS_DENIED"),
      summary: "Representative T1-T4 roles, four divisions, controlled handoffs, refusal, escalation, missing evidence, and contradiction are exercised.",
      evidenceIds: [
        ...workplans.map((workplan) => workplan.roleContext.role),
        ...refusalLineages.map((lineage) => lineage.response.responseId),
      ],
    },
  ].map((criterion) =>
    Object.freeze({
      ...criterion,
      evidenceIds: Object.freeze([...criterion.evidenceIds]),
    }),
  );

  const criteria = Object.freeze(checks);
  return Object.freeze({
    milestone: "M4.1B",
    scenarioId: "SYNTH-M41B-INTEGRATED-ACCEPTANCE-001",
    startedAt: M41B_EVALUATION_AS_OF,
    completedAt: at(365),
    workplans,
    requests,
    guidance,
    recommendations,
    decisions,
    completionEvidence,
    auditEvents,
    silentClosureControl,
    criteria,
    exitGate: criteria.every((criterion) => criterion.passed),
    productionActionsBlocked: true,
    evidenceClass: "synthetic_demo",
  });
}
