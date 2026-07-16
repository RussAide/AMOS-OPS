import type {
  ClinicalBillingEvaluationInput,
  ClinicalBillingReadinessResult,
  MhrsCategory,
  MhrsServiceBasis,
  ProviderCredential,
} from "../regulatory/clinical";
import type { Phase2EvidenceClass } from "../phase2";

export type M23EvidenceClass = Extract<Phase2EvidenceClass, "synthetic_demo">;

export type M23Role =
  | "therapist"
  | "mhrs-supervisor"
  | "clinical-supervisor"
  | "treatment-director"
  | "bhc-director"
  | "chart-auditor"
  | "revenue-cycle-manager"
  | "administrator"
  | "managing-director"
  | "super-admin";

export interface M23Actor {
  readonly id: string;
  readonly role: M23Role;
  readonly displayName: string;
}

export interface M23CcmgBridge {
  readonly ownerDepartment: "CCMG";
  readonly accessMode: "read_only";
  readonly referralId: string;
  readonly caseId: string;
  readonly handoffId: string;
  readonly status: "active";
}

export interface M23CansBridge {
  readonly ownerDepartment: "CCMG";
  readonly accessMode: "read_only";
  readonly assessmentId: string;
  readonly version: number;
  readonly lineageId: string;
  readonly targetRecordId: string;
  readonly mappedGoalCodes: readonly string[];
}

export interface M23MhtcmBridge {
  readonly ownerDepartment: "MHTCM";
  readonly accessMode: "read_only";
  readonly planId: string;
  readonly version: number;
  readonly status: "approved" | "active";
  readonly coordinationSummary: string;
}

export interface M23CareBridge {
  readonly ccmg: M23CcmgBridge;
  readonly cans: M23CansBridge;
  readonly mhtcm: M23MhtcmBridge;
}

export interface M23ProgramCase {
  readonly id: string;
  readonly subjectId: string;
  readonly subjectLabel: string;
  readonly ageYears: number;
  readonly assignedSpecialistId: string;
  readonly assignedSupervisorId: string;
  readonly planSeriesId: string;
  readonly careBridge: M23CareBridge;
  readonly evidenceClass: M23EvidenceClass;
  readonly createdAt: string;
}

export type M23NeedSource = "CANS" | "CCMG" | "MHTCM" | "MHRS";

export interface M23AssessedNeed {
  readonly id: string;
  readonly caseId: string;
  readonly sourceDepartment: "CCMG" | "MHTCM" | "MHRS";
  readonly sourceType: M23NeedSource;
  readonly sourceRecordId: string;
  readonly sourceVersion: number;
  readonly code: string;
  readonly statement: string;
  readonly baseline: number;
  readonly target: number;
  readonly recordedBy: string;
  readonly recordedAt: string;
}

export type M23PlanState = "draft" | "under_review" | "approved" | "superseded";

export interface M23PlanVersion {
  readonly id: string;
  readonly caseId: string;
  readonly seriesId: string;
  readonly version: number;
  readonly priorVersionId: string | null;
  readonly effectiveFrom: string;
  readonly effectiveThrough: string;
  readonly typeAmountDurationStatement: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface M23PlanStateEvent {
  readonly id: string;
  readonly caseId: string;
  readonly planVersionId: string;
  readonly fromState: M23PlanState | null;
  readonly toState: M23PlanState;
  readonly actorId: string;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface M23Goal {
  readonly id: string;
  readonly caseId: string;
  readonly planVersionId: string;
  readonly needId: string;
  readonly category: MhrsCategory;
  readonly statement: string;
  readonly measure: string;
  readonly targetValue: number;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface M23Intervention {
  readonly id: string;
  readonly caseId: string;
  readonly planVersionId: string;
  readonly goalId: string;
  readonly category: MhrsCategory;
  readonly serviceBasis: MhrsServiceBasis;
  readonly description: string;
  readonly amount: string;
  readonly duration: string;
  readonly frequency: string;
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface M23Session {
  readonly id: string;
  readonly caseId: string;
  readonly planVersionId: string;
  readonly goalId: string;
  readonly interventionId: string;
  readonly specialistId: string;
  readonly category: MhrsCategory;
  readonly serviceBasis: MhrsServiceBasis;
  readonly credential: ProviderCredential;
  readonly billingInput: ClinicalBillingEvaluationInput;
  readonly billingEvaluation: ClinicalBillingReadinessResult;
  readonly documentedAt: string;
}

export type M23SessionState = "draft" | "signed";

export interface M23SessionStateEvent {
  readonly id: string;
  readonly caseId: string;
  readonly sessionId: string;
  readonly fromState: M23SessionState | null;
  readonly toState: M23SessionState;
  readonly actorId: string;
  readonly signature: string | null;
  readonly reason: string;
  readonly occurredAt: string;
}

export interface M23ProgressRecord {
  readonly id: string;
  readonly caseId: string;
  readonly sessionId: string;
  readonly goalId: string;
  readonly progressValue: number;
  readonly narrative: string;
  readonly recordedAt: string;
}

export interface M23BarrierRecord {
  readonly id: string;
  readonly caseId: string;
  readonly sessionId: string;
  readonly goalId: string;
  readonly barrier: string;
  readonly response: string;
  readonly recordedAt: string;
}

export interface M23OutcomeRecord {
  readonly id: string;
  readonly caseId: string;
  readonly sessionId: string;
  readonly goalId: string;
  readonly outcome: string;
  readonly measuredValue: number;
  readonly recordedAt: string;
}

export type M23ReviewAlertState = "assigned" | "escalated" | "completed";

export interface M23ReviewAlert {
  readonly id: string;
  readonly caseId: string;
  readonly planVersionId: string;
  readonly assignedTo: string;
  readonly dueAt: string;
  readonly createdAt: string;
}

export interface M23ReviewAlertEvent {
  readonly id: string;
  readonly caseId: string;
  readonly alertId: string;
  readonly fromState: M23ReviewAlertState | null;
  readonly toState: M23ReviewAlertState;
  readonly actorId: string;
  readonly reason: string;
  readonly occurredAt: string;
}

export type M23ClaimHandoffState = "rejected" | "ready_for_revenue";

export interface M23ClaimHandoff {
  readonly id: string;
  readonly caseId: string;
  readonly sessionId: string;
  readonly state: M23ClaimHandoffState;
  readonly reasonCodes: readonly string[];
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly billingEvaluation: ClinicalBillingReadinessResult;
}

export type M23AuditAction =
  | "case_registered"
  | "need_recorded"
  | "plan_version_created"
  | "plan_state_changed"
  | "goal_linked"
  | "intervention_linked"
  | "session_documented"
  | "session_signed"
  | "review_alert_assigned"
  | "review_alert_escalated"
  | "review_completed"
  | "claim_handoff_ready"
  | "claim_handoff_rejected"
  | "accessed"
  | "permission_denied";

export interface M23AuditEvent {
  readonly id: string;
  readonly caseId: string | null;
  readonly action: M23AuditAction;
  readonly entityType: string;
  readonly entityId: string;
  readonly actorId: string;
  readonly actorRole: M23Role;
  readonly reason: string;
  readonly correlationId: string;
  readonly evidenceClass: M23EvidenceClass;
  readonly occurredAt: string;
  readonly details: Readonly<Record<string, unknown>>;
}

export interface M23RepositorySnapshot {
  readonly cases: readonly M23ProgramCase[];
  readonly needs: readonly M23AssessedNeed[];
  readonly planVersions: readonly M23PlanVersion[];
  readonly planStateEvents: readonly M23PlanStateEvent[];
  readonly goals: readonly M23Goal[];
  readonly interventions: readonly M23Intervention[];
  readonly sessions: readonly M23Session[];
  readonly sessionStateEvents: readonly M23SessionStateEvent[];
  readonly progress: readonly M23ProgressRecord[];
  readonly barriers: readonly M23BarrierRecord[];
  readonly outcomes: readonly M23OutcomeRecord[];
  readonly reviewAlerts: readonly M23ReviewAlert[];
  readonly reviewAlertEvents: readonly M23ReviewAlertEvent[];
  readonly claimHandoffs: readonly M23ClaimHandoff[];
  readonly auditEvents: readonly M23AuditEvent[];
}

export interface M23CaseDetail {
  readonly programCase: M23ProgramCase;
  readonly needs: readonly M23AssessedNeed[];
  readonly plans: readonly (M23PlanVersion & { readonly state: M23PlanState })[];
  readonly goals: readonly M23Goal[];
  readonly interventions: readonly M23Intervention[];
  readonly sessions: readonly (M23Session & { readonly state: M23SessionState })[];
  readonly progress: readonly M23ProgressRecord[];
  readonly barriers: readonly M23BarrierRecord[];
  readonly outcomes: readonly M23OutcomeRecord[];
  readonly reviewAlerts: readonly (M23ReviewAlert & { readonly state: M23ReviewAlertState })[];
  readonly claimHandoffs: readonly M23ClaimHandoff[];
  readonly auditEvents: readonly M23AuditEvent[];
}

export interface M23Dashboard {
  readonly asOf: string;
  readonly cases: number;
  readonly approvedPlans: number;
  readonly categoryCounts: Readonly<Record<MhrsCategory, number>>;
  readonly signedSessions: number;
  readonly billingReadySessions: number;
  readonly rejectedClaimHandoffs: number;
  readonly reviewAlerts: Readonly<Record<M23ReviewAlertState, number>>;
  readonly auditEvents: number;
}

export interface M23ScenarioResult {
  readonly id: string;
  readonly name: string;
  readonly category: MhrsCategory;
  readonly procedureCode: "H2014" | "H2017";
  readonly setting: "individual" | "group";
  readonly caseId: string;
  readonly sessionId: string;
  readonly claimHandoffState: M23ClaimHandoffState;
  readonly billingReady: boolean;
  readonly correlationId: string;
}

export interface M23SyntheticSuiteResult {
  readonly scenarios: readonly M23ScenarioResult[];
  readonly h2014HoControl: M23ClaimHandoff;
  readonly missingEvidenceControls: readonly M23ClaimHandoff[];
  readonly review: {
    readonly alertId: string;
    readonly priorPlanVersion: number;
    readonly newPlanVersion: number;
    readonly state: M23ReviewAlertState;
  };
  readonly snapshot: M23RepositorySnapshot;
  readonly dashboard: M23Dashboard;
}
