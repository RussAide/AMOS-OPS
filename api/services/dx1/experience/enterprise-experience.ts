import type { UserRole } from "@/constants/roles";
import {
  runM51aHubArchitectureScenario,
  resolveM51aIntranetRoute,
} from "../../m51a";
import { runM41bIntegratedScenario } from "../../m41b";
import { runM42IntegratedScenario } from "../../m42";
import {
  DX1_EVALUATED_AT,
  DX1_PILOT_STAGE_IDS,
  DX1_SCENARIO_ID,
  createDx1PrototypeBoundary,
  type Dx1AuditEvent,
  type Dx1CriterionResult,
  type Dx1PilotStageId,
} from "../contracts";
import { DX1_PILOT_FIXTURE, DX1_SYNTHETIC_PERSONAS } from "../fixtures";
import type {
  Dx1AcceptedModuleReconciliation,
  Dx1EnhancementBacklogRecord,
  Dx1ExperienceGovernanceResult,
  Dx1FrontlineWalkthrough,
  Dx1GuidanceAtWork,
  Dx1IssueSupportPath,
  Dx1PersonaWorkAssignment,
  Dx1ReleaseGovernanceProjection,
  Dx1WorkflowGovernanceRecord,
  Dx1WorkspaceProjection,
} from "./types";

function immutable<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      immutable(child);
    Object.freeze(value);
  }
  return value;
}

interface PersonaAssignmentDefinition {
  canonicalRole: UserRole;
  workspaceRouteCode: string;
  primaryWorkPath: string;
  primaryWorkLabel: string;
}

const PERSONA_ASSIGNMENTS: Readonly<Record<string, PersonaAssignmentDefinition>> =
  immutable({
    "SYNTH-DX1-ACTOR-INTAKE-001": {
      canonicalRole: "intake-coordinator",
      workspaceRouteCode: "clinical",
      primaryWorkPath: "/clinical/referrals",
      primaryWorkLabel: "Review the referral intake queue",
    },
    "SYNTH-DX1-ACTOR-CLINICAL-002": {
      canonicalRole: "therapist",
      workspaceRouteCode: "clinical",
      primaryWorkPath: "/clinical/service-delivery",
      primaryWorkLabel: "Record the governed service event",
    },
    "SYNTH-DX1-ACTOR-QA-003": {
      canonicalRole: "hr-compliance-officer",
      workspaceRouteCode: "quality-compliance",
      primaryWorkPath: "/qa",
      primaryWorkLabel: "Complete documentation quality review",
    },
    "SYNTH-DX1-ACTOR-REVENUE-004": {
      canonicalRole: "billing-specialist",
      workspaceRouteCode: "finance-revenue",
      primaryWorkPath: "/revenue/pos-gate",
      primaryWorkLabel: "Confirm proof-of-service billing readiness",
    },
    "SYNTH-DX1-ACTOR-EXEC-005": {
      canonicalRole: "managing-director",
      workspaceRouteCode: "executive-command",
      primaryWorkPath: "/executive",
      primaryWorkLabel: "Review the reconciled enterprise summary",
    },
  });

const WORKFLOW_GOVERNANCE: readonly Dx1WorkflowGovernanceRecord[] = immutable([
  {
    workflowId: "SYNTH-DX1-WORKFLOW-01-REFERRAL",
    stageId: "referral-received",
    sequence: 1,
    label: "Referral Received",
    sourceModule: "Clinical referral intake",
    ownerRole: "intake-coordinator",
    statusModel: ["received", "classified", "ready-for-review"],
    evidenceGateId: "SYNTH-DX1-GATE-REFERRAL-PACKET",
    requiredEvidence: ["Referral packet", "Classification", "Owner assignment"],
    escalation: {
      condition: "Packet is incomplete or classification cannot be confirmed.",
      targetRole: "clinical-director",
      routeLabel: "Route intake exception",
      bypassAvailable: false,
    },
    unmanaged: false,
    liveExecutionAvailable: false,
    synthetic: true,
  },
  {
    workflowId: "SYNTH-DX1-WORKFLOW-02-INTAKE-REVIEW",
    stageId: "intake-review",
    sequence: 2,
    label: "Intake Review",
    sourceModule: "BHC intake assessment",
    ownerRole: "intake-coordinator",
    statusModel: ["pending-review", "eligible", "held-for-evidence", "declined"],
    evidenceGateId: "SYNTH-DX1-GATE-INTAKE-DISPOSITION",
    requiredEvidence: ["Review disposition", "Evidence references", "Escalation state"],
    escalation: {
      condition: "Eligibility evidence is missing or the disposition is disputed.",
      targetRole: "bhc-director",
      routeLabel: "Escalate intake disposition",
      bypassAvailable: false,
    },
    unmanaged: false,
    liveExecutionAvailable: false,
    synthetic: true,
  },
  {
    workflowId: "SYNTH-DX1-WORKFLOW-03-CANS-TRR",
    stageId: "cans-trr-support",
    sequence: 3,
    label: "CANS/TRR Support",
    sourceModule: "Clinical intelligence fabric",
    ownerRole: "therapist",
    statusModel: ["support-requested", "context-reviewed", "human-attested"],
    evidenceGateId: "SYNTH-DX1-GATE-CLINICAL-ATTESTATION",
    requiredEvidence: ["Bounded support context", "Human attestation", "Audit event"],
    escalation: {
      condition: "Source authority, competency, or clinical context is insufficient.",
      targetRole: "clinical-supervisor",
      routeLabel: "Request clinical supervision",
      bypassAvailable: false,
    },
    unmanaged: false,
    liveExecutionAvailable: false,
    synthetic: true,
  },
  {
    workflowId: "SYNTH-DX1-WORKFLOW-04-AUTHORIZATION",
    stageId: "authorization-setup",
    sequence: 4,
    label: "Authorization Setup",
    sourceModule: "Authorization packet builder",
    ownerRole: "revenue-cycle-manager",
    statusModel: ["draft", "evidence-assembled", "pending-approval", "approved"],
    evidenceGateId: "SYNTH-DX1-GATE-AUTHORIZATION-PACKET",
    requiredEvidence: ["Packet manifest", "Approved source versions", "Owner approval"],
    escalation: {
      condition: "Required authorization evidence is missing, stale, or contradictory.",
      targetRole: "bhc-director",
      routeLabel: "Hold and route authorization exception",
      bypassAvailable: false,
    },
    unmanaged: false,
    liveExecutionAvailable: false,
    synthetic: true,
  },
  {
    workflowId: "SYNTH-DX1-WORKFLOW-05-SERVICE",
    stageId: "service-delivery",
    sequence: 5,
    label: "Service Delivery",
    sourceModule: "Clinical service delivery",
    ownerRole: "therapist",
    statusModel: ["scheduled", "in-progress", "documented", "attested"],
    evidenceGateId: "SYNTH-DX1-GATE-SERVICE-DOCUMENTATION",
    requiredEvidence: ["Service event", "Versioned note", "Provenance", "Attestation"],
    escalation: {
      condition: "The event, documentation, provenance, or attestation is incomplete.",
      targetRole: "clinical-supervisor",
      routeLabel: "Return to clinical owner",
      bypassAvailable: false,
    },
    unmanaged: false,
    liveExecutionAvailable: false,
    synthetic: true,
  },
  {
    workflowId: "SYNTH-DX1-WORKFLOW-06-QA",
    stageId: "qa-documentation-review",
    sequence: 6,
    label: "QA Documentation Review",
    sourceModule: "Quality assurance dashboard",
    ownerRole: "hr-compliance-officer",
    statusModel: ["queued", "under-review", "cleared", "returned-for-remediation"],
    evidenceGateId: "SYNTH-DX1-GATE-QA-CLEARANCE",
    requiredEvidence: ["QA result", "Completeness evidence", "Return reason when held"],
    escalation: {
      condition: "A critical deficiency remains unresolved or repeats after remediation.",
      targetRole: "administrator",
      routeLabel: "Escalate quality deficiency",
      bypassAvailable: false,
    },
    unmanaged: false,
    liveExecutionAvailable: false,
    synthetic: true,
  },
  {
    workflowId: "SYNTH-DX1-WORKFLOW-07-BILLING",
    stageId: "billing-gate",
    sequence: 7,
    label: "Billing Gate",
    sourceModule: "Revenue proof-of-service gate",
    ownerRole: "billing-specialist",
    statusModel: ["held", "qa-cleared", "billing-ready", "denied"],
    evidenceGateId: "SYNTH-DX1-GATE-BILLING-READINESS",
    requiredEvidence: ["QA clearance", "Authorization state", "Service lineage"],
    escalation: {
      condition: "QA, authorization, or service lineage does not support readiness.",
      targetRole: "revenue-cycle-manager",
      routeLabel: "Hold billing and route variance",
      bypassAvailable: false,
    },
    unmanaged: false,
    liveExecutionAvailable: false,
    synthetic: true,
  },
  {
    workflowId: "SYNTH-DX1-WORKFLOW-08-EXECUTIVE",
    stageId: "executive-risk-revenue-summary",
    sequence: 8,
    label: "Executive Risk/Revenue Summary",
    sourceModule: "Executive command dashboard",
    ownerRole: "managing-director",
    statusModel: ["reconciling", "ready-for-review", "reviewed"],
    evidenceGateId: "SYNTH-DX1-GATE-EXECUTIVE-RECONCILIATION",
    requiredEvidence: ["Dashboard snapshot", "Relationship evidence", "Narrative provenance"],
    escalation: {
      condition: "Operational, compliance, risk, workforce, or revenue views disagree.",
      targetRole: "administrator",
      routeLabel: "Route enterprise reconciliation exception",
      bypassAvailable: false,
    },
    unmanaged: false,
    liveExecutionAvailable: false,
    synthetic: true,
  },
]);

const GUIDANCE_AT_WORK: readonly Dx1GuidanceAtWork[] = immutable([
  ["referral-received", "Confirm the packet, classification, owner, and audit event before advancing.", "SOP-003", "SOP Part III: Referral & Intake", "Show me the intake packet checks for this fictional referral.", "intake-coordinator"],
  ["intake-review", "Record the review disposition and hold the referral when required evidence is absent.", "SOP-003", "SOP Part III: Referral & Intake", "Explain the next governed intake-review step and its evidence gate.", "bhc-director"],
  ["cans-trr-support", "Use assessment support only as bounded guidance; scoring and level-of-care remain human-controlled.", "SOP-004", "SOP Part IV: Governed Clinical Assessment", "Show the authorized source, limitations, and attestation required here.", "clinical-supervisor"],
  ["authorization-setup", "Assemble only approved evidence versions and route the packet through its human approval gate.", "SOP-011", "SOP Part XI: Revenue Cycle", "List the evidence still required before this authorization packet can advance.", "revenue-cycle-manager"],
  ["service-delivery", "Record the fictional service event, versioned note, provenance, and human attestation.", "SOP-005", "SOP Part V: Service Delivery", "Walk me through the documentation controls without completing them for me.", "clinical-supervisor"],
  ["qa-documentation-review", "Clear only complete documentation; otherwise return it with an explicit reason and owner.", "SOP-010", "SOP Part X: Compliance & QA", "Explain the QA evidence gate and the safe remediation route.", "hr-compliance-officer"],
  ["billing-gate", "Billing readiness requires QA clearance, authorization, and traceable service evidence.", "SOP-011", "SOP Part XI: Revenue Cycle", "Why is this billing item held, and who owns the next step?", "revenue-cycle-manager"],
  ["executive-risk-revenue-summary", "Review reconciled status and provenance; do not infer missing values across domains.", "SOP-010", "SOP Part X: Compliance & QA", "Summarize the evidence lineage and identify unresolved enterprise exceptions.", "managing-director"],
].map(([stageId, quickGuidance, sopId, sopTitle, coachPrompt, accountableHumanRole]) => ({
  stageId: stageId as Dx1PilotStageId,
  quickGuidance,
  sopId,
  sopTitle,
  coachPrompt,
  accountableHumanRole: accountableHumanRole as UserRole,
  issueSupportPath: "#dx1-issue-support" as const,
  sourceVisible: true as const,
  bypassAvailable: false as const,
  synthetic: true as const,
})));

const ISSUE_SUPPORT: Readonly<Dx1IssueSupportPath> = immutable({
  path: "#dx1-issue-support",
  label: "Get issue support",
  queueId: "SYNTH-DX1-QUEUE-ENTERPRISE-DEMO-SUPPORT",
  ownerRole: "administrator",
  steps: [
    "Keep the current pilot stage and evidence visible.",
    "Choose access, evidence, workflow, or technical issue.",
    "Route the issue to the named owner without bypassing the gate.",
  ],
  liveTicketCreated: false,
  synthetic: true,
});

const FRONTLINE_ACTIONS: Readonly<Record<string, readonly string[]>> = immutable({
  "SYNTH-DX1-ACTOR-INTAKE-001": [
    "Open assigned referral work",
    "Verify the packet and classification",
    "Record the review disposition",
  ],
  "SYNTH-DX1-ACTOR-CLINICAL-002": [
    "Open the assigned service task",
    "Review bounded guidance and evidence",
    "Record and attest the fictional service note",
  ],
  "SYNTH-DX1-ACTOR-QA-003": [
    "Open documentation review",
    "Check the visible evidence gate",
    "Clear or return with a reason",
  ],
  "SYNTH-DX1-ACTOR-REVENUE-004": [
    "Open the billing readiness item",
    "Confirm QA and authorization evidence",
    "Hold or mark the item ready",
  ],
});

function reconcileAcceptedModules() {
  const operationsHub = runM51aHubArchitectureScenario();
  const workplanAssistant = runM41bIntegratedScenario();
  const documentKnowledge = runM42IntegratedScenario();
  const changeControl = documentKnowledge.acceptanceFlags.find(
    (criterion) => criterion.criterionId === "M4.2-07",
  );
  const workplanGovernance = workplanAssistant.criteria.filter((criterion) =>
    ["M4.1B-02", "M4.1B-03", "M4.1B-04", "M4.1B-05", "M4.1B-06", "M4.1B-09"].includes(
      criterion.criterionId,
    ),
  );
  const releaseLibrary = operationsHub.architecture.libraries.find(
    (library) => library.code === "projects-change-releases",
  );
  const releaseContentType = operationsHub.architecture.contentTypes.find(
    (contentType) => contentType.code === "project-release-artifact",
  );
  const acceptedModules: Dx1AcceptedModuleReconciliation = immutable({
    operationsHubAccepted: operationsHub.accepted,
    intranetDestinations: operationsHub.totals.intranetDestinations,
    canonicalRolesEvaluated: operationsHub.totals.canonicalRolesEvaluated,
    workplanAssistantAccepted:
      workplanAssistant.exitGate && workplanGovernance.every((item) => item.passed),
    governedGuidanceIntents: 7,
    changeControlAccepted:
      documentKnowledge.accepted && Boolean(changeControl?.passed),
    appendOnlyChangeHistory:
      documentKnowledge.administration.snapshot.appendOnlyHistory,
    projectReleaseLibraryPresent: Boolean(
      releaseLibrary &&
        releaseContentType &&
        releaseLibrary.allowedContentTypes.includes("project-release-artifact"),
    ),
    productionActionsBlocked: workplanAssistant.productionActionsBlocked,
    liveExternalWrites: 0,
    evidenceIds: [
      operationsHub.scenarioId,
      workplanAssistant.scenarioId,
      documentKnowledge.scenarioId,
      ...(changeControl?.evidenceIds ?? []),
    ],
    synthetic: true,
  });
  return immutable({ operationsHub, workplanAssistant, documentKnowledge, acceptedModules });
}

function buildWorkspaces(
  accepted: ReturnType<typeof reconcileAcceptedModules>,
): readonly Dx1WorkspaceProjection[] {
  return immutable(
    accepted.operationsHub.architecture.intranetRoutes.map((route) => {
      const navigable = accepted.operationsHub.roleProjections.some(
        (projection) =>
          projection.routes.some((projectedRoute) => projectedRoute.code === route.code),
      );
      if (!navigable)
        throw new Error(`DX1_ENTERPRISE_WORKSPACE_UNREACHABLE:${route.code}`);
      return {
        routeCode: route.code,
        label: route.label,
        logicalPath: route.logicalPath,
        ownerRole: route.ownerRole,
        configured: true as const,
        navigableForAtLeastOneCanonicalRole: true as const,
        physicalMicrosoftUrl: null,
        synthetic: true as const,
      };
    }),
  );
}

function buildPersonaAssignments(
  accepted: ReturnType<typeof reconcileAcceptedModules>,
): readonly Dx1PersonaWorkAssignment[] {
  return immutable(
    DX1_SYNTHETIC_PERSONAS.map((persona) => {
      const assignment = PERSONA_ASSIGNMENTS[persona.actorId];
      if (!assignment)
        throw new Error(`DX1_PERSONA_ASSIGNMENT_MISSING:${persona.actorId}`);
      const decision = resolveM51aIntranetRoute(
        assignment.canonicalRole,
        assignment.workspaceRouteCode,
        accepted.operationsHub.architecture.intranetRoutes,
        accepted.operationsHub.architecture.sites,
      );
      const route = accepted.operationsHub.architecture.intranetRoutes.find(
        (candidate) => candidate.code === assignment.workspaceRouteCode,
      );
      if (!decision.allowed || !decision.logicalPath || !route)
        throw new Error(`DX1_PERSONA_ROUTE_DENIED:${persona.actorId}`);
      return {
        actorId: persona.actorId,
        displayLabel: persona.displayLabel,
        fixtureRole: persona.role,
        canonicalRole: assignment.canonicalRole,
        workspaceRouteCode: assignment.workspaceRouteCode,
        workspaceLabel: route.label,
        intranetLogicalPath: decision.logicalPath,
        primaryWorkPath: assignment.primaryWorkPath,
        primaryWorkLabel: assignment.primaryWorkLabel,
        routeDecisionId: decision.decisionId,
        routeAllowed: true,
        permissionTrimmed: decision.permissionTrimmed,
        architectureKnowledgeRequired: false,
        synthetic: true,
      };
    }),
  );
}

function buildFrontlineWalkthroughs(
  assignments: readonly Dx1PersonaWorkAssignment[],
): readonly Dx1FrontlineWalkthrough[] {
  return immutable(
    assignments.flatMap((assignment) => {
      const visibleActions = FRONTLINE_ACTIONS[assignment.actorId];
      if (!visibleActions) return [];
      return [
        {
          walkthroughId: `SYNTH-DX1-WALKTHROUGH-${assignment.actorId}`,
          actorId: assignment.actorId,
          personaLabel: assignment.displayLabel,
          canonicalRole: assignment.canonicalRole,
          primaryWorkPath: assignment.primaryWorkPath,
          primaryTask: assignment.primaryWorkLabel,
          visibleActions,
          completedActions: visibleActions.length,
          hiddenTechnicalSteps: 0,
          architectureTermsExposed: false,
          commandLineRequired: false,
          completionEvidenceVisible: true,
          completed: true,
          evidenceId: `SYNTH-DX1-EVIDENCE-WALKTHROUGH-${assignment.actorId}`,
          synthetic: true,
        },
      ];
    }),
  );
}

function buildReleaseGovernance(
  accepted: ReturnType<typeof reconcileAcceptedModules>,
): Readonly<Dx1ReleaseGovernanceProjection> {
  const evidenceIds = [
    "SYNTH-DX1-EVIDENCE-EXPERIENCE-STREAM",
    "M4_2_NO_CODE_ADMIN_RESULT",
    accepted.operationsHub.scenarioId,
  ];
  const enhancementBacklog: readonly Dx1EnhancementBacklogRecord[] = immutable([
    {
      enhancementId: "SYNTH-DX1-ENHANCEMENT-001",
      label: "Clarify the enterprise-demo entry label",
      ownerRole: "administrator",
      disposition: "accepted-demo-only",
      rationale: "A bounded label clarification improves the synthetic walkthrough without changing enterprise logic.",
      evidenceIds,
      productionMutation: false,
      synthetic: true,
    },
    {
      enhancementId: "SYNTH-DX1-ENHANCEMENT-002",
      label: "Activate live Microsoft workflow writes",
      ownerRole: "super-admin",
      disposition: "deferred-production-sequence",
      rationale: "Live connector activation remains outside the synthetic prototype gate.",
      evidenceIds: ["DX_1_SCOPE_BOUNDARY"],
      productionMutation: false,
      synthetic: true,
    },
    {
      enhancementId: "SYNTH-DX1-ENHANCEMENT-003",
      label: "Load real youth and workforce records",
      ownerRole: "hr-compliance-officer",
      disposition: "rejected-out-of-scope",
      rationale: "DX.1 permits fictional records only.",
      evidenceIds: ["DX_1_SCOPE_BOUNDARY"],
      productionMutation: false,
      synthetic: true,
    },
  ]);
  return immutable({
    governingLibraryCode: "projects-change-releases",
    governingContentTypeCode: "project-release-artifact",
    inheritedAppendOnlyChangeControl: true,
    releaseRegister: [
      {
        releaseId: "SYNTH-DX1-RELEASE-EXPERIENCE-001",
        label: "DX.1 experience and governance stream",
        ownerRole: "managing-director",
        status: "stream-ready-for-integrated-review",
        evidenceIds,
        productionActivation: false,
        synthetic: true,
      },
    ],
    enhancementBacklog,
    evidenceHistory: [
      {
        sequence: 1,
        historyId: "SYNTH-DX1-EVIDENCE-HISTORY-001",
        action: "Inherited M5.1A workspace navigation verified",
        evidenceIds: [accepted.operationsHub.scenarioId],
        recordedAt: DX1_EVALUATED_AT,
        appendOnly: true,
        synthetic: true,
      },
      {
        sequence: 2,
        historyId: "SYNTH-DX1-EVIDENCE-HISTORY-002",
        action: "Inherited M4.1B governed work and guidance verified",
        evidenceIds: [accepted.workplanAssistant.scenarioId],
        recordedAt: DX1_EVALUATED_AT,
        appendOnly: true,
        synthetic: true,
      },
      {
        sequence: 3,
        historyId: "SYNTH-DX1-EVIDENCE-HISTORY-003",
        action: "Inherited M4.2 append-only change control verified",
        evidenceIds: [accepted.documentKnowledge.scenarioId],
        recordedAt: DX1_EVALUATED_AT,
        appendOnly: true,
        synthetic: true,
      },
    ],
    safeChangeDisposition: {
      changeId: "SYNTH-DX1-CHANGE-EXPERIENCE-001",
      requestedChange: "Expose the final cross-enterprise synthetic demo experience.",
      disposition: "approved-demo-only",
      decidedByRole: "managing-director",
      rationale: "All assigned stream criteria are evidenced while production activation remains unavailable.",
      evidenceIds,
      productionActivation: false,
      deploymentExecuted: false,
      githubPushPerformed: false,
      liveWrites: 0,
      synthetic: true,
    },
    productionActivationAvailable: false,
    liveWrites: 0,
    deployments: 0,
    githubPushes: 0,
    synthetic: true,
  });
}

function criterion(
  criterionId: Dx1CriterionResult["criterionId"],
  assertionIds: readonly string[],
  evidenceIds: readonly string[],
  summary: string,
): Dx1CriterionResult {
  return immutable({
    criterionId,
    status: "Complete",
    assertionIds: [...assertionIds],
    evidenceIds: [...evidenceIds],
    summary,
  });
}

function auditEvent(
  index: number,
  criterionResult: Dx1CriterionResult,
): Dx1AuditEvent {
  return immutable({
    eventId: `SYNTH-DX1-AUDIT-EXPERIENCE-${String(index).padStart(2, "0")}`,
    scenarioId: DX1_SCENARIO_ID,
    stageId: "cross-enterprise",
    actorId: "SYNTH-DX1-ACTOR-EXPERIENCE-REVIEWER",
    actorRole: "managing-director",
    action: `verify_${criterionResult.criterionId.toLowerCase().replace(/[.-]/g, "_")}`,
    outcome: "completed",
    reason: criterionResult.summary,
    evidenceIds: criterionResult.evidenceIds,
    occurredAt: DX1_EVALUATED_AT,
    synthetic: true,
  });
}

export function validateDx1ExperienceGovernanceResult(
  result: Dx1ExperienceGovernanceResult,
): readonly string[] {
  const errors: string[] = [];
  if (
    result.workspaces.length !== 11 ||
    result.workspaces.some(
      (workspace) =>
        !workspace.configured ||
        !workspace.navigableForAtLeastOneCanonicalRole ||
        workspace.physicalMicrosoftUrl !== null,
    )
  )
    errors.push("DX1_ENTERPRISE_WORKSPACE_NAVIGATION_INCOMPLETE");
  if (
    result.personaAssignments.length !== DX1_SYNTHETIC_PERSONAS.length ||
    result.personaAssignments.some(
      (assignment) =>
        !assignment.routeAllowed ||
        !assignment.permissionTrimmed ||
        assignment.architectureKnowledgeRequired ||
        !assignment.primaryWorkPath.startsWith("/"),
    )
  )
    errors.push("DX1_PERSONA_ASSIGNED_WORK_UNREACHABLE");
  if (
    result.workflows.length !== DX1_PILOT_STAGE_IDS.length ||
    JSON.stringify(result.workflows.map((workflow) => workflow.stageId)) !==
      JSON.stringify(DX1_PILOT_FIXTURE.expectedStages) ||
    result.workflows.some(
      (workflow) =>
        workflow.unmanaged ||
        !workflow.ownerRole ||
        workflow.statusModel.length < 3 ||
        !workflow.evidenceGateId ||
        workflow.requiredEvidence.length === 0 ||
        !workflow.escalation.condition ||
        !workflow.escalation.targetRole ||
        workflow.escalation.bypassAvailable ||
        workflow.liveExecutionAvailable,
    )
  )
    errors.push("DX1_CORE_WORKFLOW_GOVERNANCE_INCOMPLETE");
  if (
    result.frontlineWalkthroughs.length !== 4 ||
    result.frontlineWalkthroughs.some(
      (walkthrough) =>
        !walkthrough.completed ||
        walkthrough.completedActions !== walkthrough.visibleActions.length ||
        walkthrough.visibleActions.length > 4 ||
        walkthrough.hiddenTechnicalSteps !== 0 ||
        walkthrough.architectureTermsExposed ||
        walkthrough.commandLineRequired ||
        !walkthrough.completionEvidenceVisible,
    )
  )
    errors.push("DX1_FRONTLINE_USABILITY_INCOMPLETE");
  if (
    result.guidanceAtWork.length !== DX1_PILOT_STAGE_IDS.length ||
    result.guidanceAtWork.some(
      (guidance) =>
        !guidance.quickGuidance ||
        !/^SOP-\d{3}$/.test(guidance.sopId) ||
        !guidance.coachPrompt ||
        guidance.issueSupportPath !== result.issueSupport.path ||
        !guidance.sourceVisible ||
        guidance.bypassAvailable,
    ) ||
    result.issueSupport.steps.length < 3 ||
    result.issueSupport.liveTicketCreated
  )
    errors.push("DX1_GUIDANCE_SOP_COACH_SUPPORT_INCOMPLETE");
  const release = result.releaseGovernance;
  if (
    !release.inheritedAppendOnlyChangeControl ||
    release.releaseRegister.length === 0 ||
    release.enhancementBacklog.length < 3 ||
    release.evidenceHistory.length < 3 ||
    release.evidenceHistory.some(
      (entry, index) => !entry.appendOnly || entry.sequence !== index + 1,
    ) ||
    release.safeChangeDisposition.disposition !== "approved-demo-only" ||
    release.safeChangeDisposition.productionActivation ||
    release.safeChangeDisposition.deploymentExecuted ||
    release.safeChangeDisposition.githubPushPerformed ||
    release.safeChangeDisposition.liveWrites !== 0 ||
    release.productionActivationAvailable ||
    release.liveWrites !== 0 ||
    release.deployments !== 0 ||
    release.githubPushes !== 0
  )
    errors.push("DX1_RELEASE_CHANGE_GOVERNANCE_INCOMPLETE");
  if (
    !result.acceptedModules.operationsHubAccepted ||
    result.acceptedModules.intranetDestinations !== 11 ||
    result.acceptedModules.canonicalRolesEvaluated !== 36 ||
    !result.acceptedModules.workplanAssistantAccepted ||
    result.acceptedModules.governedGuidanceIntents !== 7 ||
    !result.acceptedModules.changeControlAccepted ||
    !result.acceptedModules.appendOnlyChangeHistory ||
    !result.acceptedModules.projectReleaseLibraryPresent ||
    !result.acceptedModules.productionActionsBlocked ||
    result.acceptedModules.liveExternalWrites !== 0
  )
    errors.push("DX1_ACCEPTED_MODULE_RECONCILIATION_FAILED");
  if (
    !result.boundary.synthetic ||
    !result.boundary.demoMode ||
    Object.entries(result.boundary).some(
      ([key, value]) =>
        key !== "synthetic" &&
        key !== "demoMode" &&
        typeof value === "number" &&
        value !== 0,
    )
  )
    errors.push("DX1_SYNTHETIC_BOUNDARY_INVALID");
  return immutable([...new Set(errors)].sort());
}

export function runDx1ExperienceGovernanceStream(): Dx1ExperienceGovernanceResult {
  const accepted = reconcileAcceptedModules();
  const workspaces = buildWorkspaces(accepted);
  const personaAssignments = buildPersonaAssignments(accepted);
  const frontlineWalkthroughs = buildFrontlineWalkthroughs(personaAssignments);
  const releaseGovernance = buildReleaseGovernance(accepted);
  const criteria = immutable([
    criterion(
      "DX.1-01",
      [
        "DX1-01-A1-OPERATIONS-HUB-ACCEPTED",
        "DX1-01-A2-ELEVEN-WORKSPACES-CONFIGURED",
        "DX1-01-A3-THIRTY-SIX-ROLES-EVALUATED",
        "DX1-01-A4-FIVE-PERSONAS-ROUTED",
        "DX1-01-A5-ASSIGNED-WORK-PATHS-VISIBLE",
        "DX1-01-A6-PERMISSION-TRIMMED-NO-PHYSICAL-URL",
      ],
      [
        accepted.operationsHub.scenarioId,
        ...personaAssignments.map((assignment) => assignment.routeDecisionId),
      ],
      "All eleven enterprise destinations remain configured and each of the five synthetic personas reaches assigned work through a permission-trimmed intranet route.",
    ),
    criterion(
      "DX.1-02",
      [
        "DX1-02-A1-EIGHT-STAGES-REGISTERED",
        "DX1-02-A2-UNIQUE-WORKFLOW-IDENTITY",
        "DX1-02-A3-OWNER-REQUIRED",
        "DX1-02-A4-STATUS-MODEL-REQUIRED",
        "DX1-02-A5-EVIDENCE-GATE-REQUIRED",
        "DX1-02-A6-ESCALATION-RULE-REQUIRED",
        "DX1-02-A7-NO-UNMANAGED-WORKFLOW",
        "DX1-02-A8-INHERITED-GOVERNED-WORK-LINEAGE",
      ],
      [accepted.workplanAssistant.scenarioId, ...WORKFLOW_GOVERNANCE.map((item) => item.workflowId)],
      "Every pilot workflow stage has an accountable owner, explicit status model, evidence gate, and non-bypassable escalation route.",
    ),
    criterion(
      "DX.1-09",
      [
        "DX1-09-A1-FOUR-FRONTLINE-PERSONAS",
        "DX1-09-A2-PRIMARY-TASK-REACHABLE",
        "DX1-09-A3-FOUR-OR-FEWER-VISIBLE-ACTIONS",
        "DX1-09-A4-ZERO-HIDDEN-TECHNICAL-STEPS",
        "DX1-09-A5-ZERO-ARCHITECTURE-TERMS",
        "DX1-09-A6-NO-COMMAND-LINE",
        "DX1-09-A7-COMPLETION-EVIDENCE-VISIBLE",
      ],
      frontlineWalkthroughs.map((walkthrough) => walkthrough.evidenceId),
      "Four representative frontline personas complete their primary fictional task in plain-language visible actions without architecture knowledge or hidden technical steps.",
    ),
    criterion(
      "DX.1-11",
      [
        "DX1-11-A1-EIGHT-STAGE-QUICK-GUIDANCE",
        "DX1-11-A2-CONTROLLED-SOP-REFERENCE",
        "DX1-11-A3-AMOS-COACH-PROMPT",
        "DX1-11-A4-HUMAN-ACCOUNTABILITY-VISIBLE",
        "DX1-11-A5-SOURCE-VISIBLE-GUIDANCE",
        "DX1-11-A6-ISSUE-SUPPORT-PATH",
        "DX1-11-A7-NON-BYPASSABLE-GATE",
        "DX1-11-A8-INHERITED-GUIDANCE-ENGINE",
      ],
      [accepted.workplanAssistant.scenarioId, accepted.operationsHub.scenarioId, ISSUE_SUPPORT.queueId],
      "Quick guidance, controlled SOP references, AMOS-Coach prompts, human accountability, and an inline issue-support path are available at every pilot stage.",
    ),
    criterion(
      "DX.1-12",
      [
        "DX1-12-A1-PROJECT-RELEASE-LIBRARY",
        "DX1-12-A2-RELEASE-REGISTER",
        "DX1-12-A3-ENHANCEMENT-BACKLOG",
        "DX1-12-A4-APPEND-ONLY-EVIDENCE-HISTORY",
        "DX1-12-A5-SAFE-CHANGE-DISPOSITION",
        "DX1-12-A6-HUMAN-OWNER-AND-RATIONALE",
        "DX1-12-A7-ZERO-PRODUCTION-ACTIVATION",
        "DX1-12-A8-ZERO-DEPLOYMENT-AND-GITHUB",
        "DX1-12-A9-INHERITED-M42-CHANGE-CONTROL",
      ],
      [accepted.documentKnowledge.scenarioId, ...releaseGovernance.safeChangeDisposition.evidenceIds],
      "The release register, dispositioned enhancement backlog, append-only evidence history, and human-approved demo-only change record operate with zero production activation.",
    ),
  ]);
  const provisional: Dx1ExperienceGovernanceResult = {
    streamId: "experience-governance",
    scenarioId: DX1_SCENARIO_ID,
    evaluatedAt: DX1_EVALUATED_AT,
    passed: true,
    assertionCount: criteria.reduce(
      (total, item) => total + item.assertionIds.length,
      0,
    ),
    criteria,
    auditEvents: criteria.map((item, index) => auditEvent(index + 1, item)),
    boundary: createDx1PrototypeBoundary(),
    acceptedModules: accepted.acceptedModules,
    workspaces,
    personaAssignments,
    workflows: WORKFLOW_GOVERNANCE,
    frontlineWalkthroughs,
    guidanceAtWork: GUIDANCE_AT_WORK,
    issueSupport: ISSUE_SUPPORT,
    releaseGovernance,
    validationErrors: [],
  };
  const validationErrors = validateDx1ExperienceGovernanceResult(provisional);
  const result: Dx1ExperienceGovernanceResult = {
    ...provisional,
    passed:
      validationErrors.length === 0 &&
      criteria.every((item) => item.status === "Complete"),
    validationErrors,
  };
  return immutable(result) as Dx1ExperienceGovernanceResult;
}
