import type { UserRole } from "@/constants/roles";
import type {
  Dx1PilotStageId,
  Dx1StreamResult,
} from "../contracts";

export interface Dx1AcceptedModuleReconciliation {
  readonly operationsHubAccepted: boolean;
  readonly intranetDestinations: number;
  readonly canonicalRolesEvaluated: number;
  readonly workplanAssistantAccepted: boolean;
  readonly governedGuidanceIntents: number;
  readonly changeControlAccepted: boolean;
  readonly appendOnlyChangeHistory: boolean;
  readonly projectReleaseLibraryPresent: boolean;
  readonly productionActionsBlocked: boolean;
  readonly liveExternalWrites: number;
  readonly evidenceIds: readonly string[];
  readonly synthetic: true;
}

export interface Dx1WorkspaceProjection {
  readonly routeCode: string;
  readonly label: string;
  readonly logicalPath: string;
  readonly ownerRole: UserRole;
  readonly configured: true;
  readonly navigableForAtLeastOneCanonicalRole: true;
  readonly physicalMicrosoftUrl: null;
  readonly synthetic: true;
}

export interface Dx1PersonaWorkAssignment {
  readonly actorId: string;
  readonly displayLabel: string;
  readonly fixtureRole: string;
  readonly canonicalRole: UserRole;
  readonly workspaceRouteCode: string;
  readonly workspaceLabel: string;
  readonly intranetLogicalPath: string;
  readonly primaryWorkPath: string;
  readonly primaryWorkLabel: string;
  readonly routeDecisionId: string;
  readonly routeAllowed: true;
  readonly permissionTrimmed: true;
  readonly architectureKnowledgeRequired: false;
  readonly synthetic: true;
}

export interface Dx1EscalationRule {
  readonly condition: string;
  readonly targetRole: UserRole;
  readonly routeLabel: string;
  readonly bypassAvailable: false;
}

export interface Dx1WorkflowGovernanceRecord {
  readonly workflowId: string;
  readonly stageId: Dx1PilotStageId;
  readonly sequence: number;
  readonly label: string;
  readonly sourceModule: string;
  readonly ownerRole: UserRole;
  readonly statusModel: readonly string[];
  readonly evidenceGateId: string;
  readonly requiredEvidence: readonly string[];
  readonly escalation: Readonly<Dx1EscalationRule>;
  readonly unmanaged: false;
  readonly liveExecutionAvailable: false;
  readonly synthetic: true;
}

export interface Dx1FrontlineWalkthrough {
  readonly walkthroughId: string;
  readonly actorId: string;
  readonly personaLabel: string;
  readonly canonicalRole: UserRole;
  readonly primaryWorkPath: string;
  readonly primaryTask: string;
  readonly visibleActions: readonly string[];
  readonly completedActions: number;
  readonly hiddenTechnicalSteps: 0;
  readonly architectureTermsExposed: false;
  readonly commandLineRequired: false;
  readonly completionEvidenceVisible: true;
  readonly completed: true;
  readonly evidenceId: string;
  readonly synthetic: true;
}

export interface Dx1GuidanceAtWork {
  readonly stageId: Dx1PilotStageId;
  readonly quickGuidance: string;
  readonly sopId: string;
  readonly sopTitle: string;
  readonly coachPrompt: string;
  readonly accountableHumanRole: UserRole;
  readonly issueSupportPath: "#dx1-issue-support";
  readonly sourceVisible: true;
  readonly bypassAvailable: false;
  readonly synthetic: true;
}

export interface Dx1IssueSupportPath {
  readonly path: "#dx1-issue-support";
  readonly label: "Get issue support";
  readonly queueId: string;
  readonly ownerRole: UserRole;
  readonly steps: readonly string[];
  readonly liveTicketCreated: false;
  readonly synthetic: true;
}

export interface Dx1ReleaseRegisterRecord {
  readonly releaseId: string;
  readonly label: string;
  readonly ownerRole: UserRole;
  readonly status: "stream-ready-for-integrated-review";
  readonly evidenceIds: readonly string[];
  readonly productionActivation: false;
  readonly synthetic: true;
}

export interface Dx1EnhancementBacklogRecord {
  readonly enhancementId: string;
  readonly label: string;
  readonly ownerRole: UserRole;
  readonly disposition:
    | "accepted-demo-only"
    | "deferred-production-sequence"
    | "rejected-out-of-scope";
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly productionMutation: false;
  readonly synthetic: true;
}

export interface Dx1ReleaseEvidenceHistoryRecord {
  readonly sequence: number;
  readonly historyId: string;
  readonly action: string;
  readonly evidenceIds: readonly string[];
  readonly recordedAt: string;
  readonly appendOnly: true;
  readonly synthetic: true;
}

export interface Dx1SafeChangeDisposition {
  readonly changeId: string;
  readonly requestedChange: string;
  readonly disposition: "approved-demo-only";
  readonly decidedByRole: UserRole;
  readonly rationale: string;
  readonly evidenceIds: readonly string[];
  readonly productionActivation: false;
  readonly deploymentExecuted: false;
  readonly githubPushPerformed: false;
  readonly liveWrites: 0;
  readonly synthetic: true;
}

export interface Dx1ReleaseGovernanceProjection {
  readonly governingLibraryCode: "projects-change-releases";
  readonly governingContentTypeCode: "project-release-artifact";
  readonly inheritedAppendOnlyChangeControl: true;
  readonly releaseRegister: readonly Dx1ReleaseRegisterRecord[];
  readonly enhancementBacklog: readonly Dx1EnhancementBacklogRecord[];
  readonly evidenceHistory: readonly Dx1ReleaseEvidenceHistoryRecord[];
  readonly safeChangeDisposition: Readonly<Dx1SafeChangeDisposition>;
  readonly productionActivationAvailable: false;
  readonly liveWrites: 0;
  readonly deployments: 0;
  readonly githubPushes: 0;
  readonly synthetic: true;
}

export interface Dx1ExperienceGovernanceResult extends Dx1StreamResult {
  readonly streamId: "experience-governance";
  readonly scenarioId: string;
  readonly evaluatedAt: string;
  readonly acceptedModules: Readonly<Dx1AcceptedModuleReconciliation>;
  readonly workspaces: readonly Dx1WorkspaceProjection[];
  readonly personaAssignments: readonly Dx1PersonaWorkAssignment[];
  readonly workflows: readonly Dx1WorkflowGovernanceRecord[];
  readonly frontlineWalkthroughs: readonly Dx1FrontlineWalkthrough[];
  readonly guidanceAtWork: readonly Dx1GuidanceAtWork[];
  readonly issueSupport: Readonly<Dx1IssueSupportPath>;
  readonly releaseGovernance: Readonly<Dx1ReleaseGovernanceProjection>;
  readonly validationErrors: readonly string[];
}
