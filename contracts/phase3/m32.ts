import type { Phase3AuditEvent, Phase3ModuleResult } from "./shared";
import type { UserRole } from "@/constants/roles";

export const M32_CRITERIA = [
  "M3.2-01",
  "M3.2-02",
  "M3.2-03",
  "M3.2-04",
  "M3.2-05",
  "M3.2-06",
  "M3.2-07",
  "M3.2-08",
] as const;

export type M32Criterion = (typeof M32_CRITERIA)[number];
export type M32Division = "BHC" | "GRO";
export type M32Program = "MHTCM" | "MHRS";
export type M32ProcedureCode = "T1017" | "H2017";
export type M32Phase2SourceMilestone = "M2.2" | "M2.3";
export type M32ConfigurationKind =
  | "payer"
  | "plan"
  | "provider"
  | "contract"
  | "eligibility"
  | "authorization"
  | "fee"
  | "service_code";

export interface M32SyntheticWriteRequest {
  environment: "evaluation" | "production";
  evidenceClass: "synthetic_demo" | "production";
  entityId: string;
  operation: "create" | "update" | "submit" | "post" | "reconcile" | "close";
}

export interface M32EffectiveConfiguration {
  id: string;
  kind: M32ConfigurationKind;
  naturalKey: string;
  version: number;
  effectiveFrom: string;
  effectiveThrough: string;
  active: boolean;
  values: Readonly<Record<string, string | number | boolean>>;
  evidenceClass: "synthetic_demo";
}

export type M32HandoffRejectionCode =
  | "PHASE2_HANDOFF_NOT_READY"
  | "DUPLICATE_HANDOFF"
  | "ELIGIBILITY_MISSING"
  | "AUTHORIZATION_MISSING"
  | "DOCUMENTATION_INCOMPLETE"
  | "PROVIDER_NOT_CREDENTIALED"
  | "SERVICE_NOT_BILLABLE"
  | "CHARGE_MISMATCH"
  | "CONFIGURATION_NOT_EFFECTIVE";

export interface M32ClaimHandoffInput {
  id: string;
  phase2HandoffId: string;
  phase2EpisodeId: string;
  phase2EncounterId: string;
  correlationId: string;
  division: M32Division;
  program: M32Program;
  procedureCode: M32ProcedureCode;
  serviceDate: string;
  units: number;
  chargeCents: number;
  payerNaturalKey: string;
  planNaturalKey: string;
  memberNaturalKey: string;
  providerNaturalKey: string;
  contractNaturalKey: string;
  authorizationNaturalKey: string;
  feeNaturalKey: string;
  serviceCodeNaturalKey: string;
  phase2Status: "ready_for_revenue" | "blocked" | "returned";
  phase2Lineage: M32VerifiedPhase2Lineage;
  documented: boolean;
  duplicateKey: string;
  evidenceClass: "synthetic_demo";
}

/**
 * Immutable identity copied from the accepted Phase 2 integrated scenario.
 * Phase 3 does not manufacture a substitute handoff or encounter identifier.
 */
export interface M32VerifiedPhase2Lineage {
  sourceMilestone: M32Phase2SourceMilestone;
  sourceScenarioId: string;
  phase2ExitRunId: string;
  phase2ExitStatus: "passed";
  phase2EpisodeId: string;
  phase2CaseId: string;
  phase2HandoffId: string;
  phase2EncounterId: string;
  phase2Status: "ready_for_revenue";
  program: M32Program;
  procedureCode: M32ProcedureCode;
  serviceDate: string;
  units: number;
  sourceCorrelationId: string;
  verifiedFrom: "runPhase2IntegratedScenario";
  evidenceClass: "synthetic_demo";
}

export interface M32HandoffValidation {
  handoffId: string;
  accepted: boolean;
  rejectionCodes: readonly M32HandoffRejectionCode[];
  configurationIds: readonly string[];
  decidedAt: string;
  evidenceClass: "synthetic_demo";
}

export type M32ClaimState =
  | "generated"
  | "edited"
  | "batched"
  | "submitted"
  | "acknowledged"
  | "rejected"
  | "denied"
  | "corrected"
  | "resubmitted"
  | "remitted"
  | "paid"
  | "posted"
  | "reconciled";

export interface M32ClaimLifecycleEvent {
  id: string;
  claimId: string;
  sequence: number;
  state: M32ClaimState;
  actorId: string;
  actorRole: UserRole | "system";
  occurredAt: string;
  reasonCode: string;
  amountCents?: number;
  evidenceClass: "synthetic_demo";
}

export interface M32ClaimScenario {
  id: string;
  claimId: string;
  handoffId: string;
  phase2HandoffId: string;
  phase2EpisodeId: string;
  phase2EncounterId: string;
  phase2Status: "ready_for_revenue";
  phase2Lineage: M32VerifiedPhase2Lineage;
  program: M32Program;
  procedureCode: M32ProcedureCode;
  billedAmountCents: number;
  allowedAmountCents: number;
  paidAmountCents: number;
  paymentVarianceCents: number;
  events: readonly M32ClaimLifecycleEvent[];
  reconciled: true;
  evidenceClass: "synthetic_demo";
}

export interface M32ArNote {
  id: string;
  authorRole: UserRole;
  text: string;
  createdAt: string;
}

export interface M32ArItem {
  id: string;
  claimId: string;
  payerId: string;
  procedureCode: M32ProcedureCode;
  division: M32Division;
  serviceDate: string;
  outstandingBalanceCents: number;
  ownerRole: UserRole;
  queue: "routine_follow_up" | "denial_resolution" | "escalated_variance";
  escalationLevel: "none" | "manager" | "executive";
  notes: readonly M32ArNote[];
  evidenceClass: "synthetic_demo";
}

export interface M32AgingDimension {
  key: string;
  count: number;
  balanceCents: number;
}

export interface M32AgingReport {
  asOf: string;
  buckets: Readonly<Record<"0_30" | "31_60" | "61_90" | "over_90", number>>;
  byPayer: readonly M32AgingDimension[];
  byService: readonly M32AgingDimension[];
  byDivision: readonly M32AgingDimension[];
  workItems: readonly M32ArItem[];
}

export interface M32RevenueMetric {
  id: string;
  name: "clean_claim_rate" | "days_in_ar";
  numerator: number;
  denominator: number;
  value: number;
  operator: ">" | "<";
  target: number;
  passed: boolean;
  periodStart: string;
  periodEnd: string;
  definition: string;
  sourceRecordIds: readonly string[];
  sourceRowCount: number;
  evidenceClass: "synthetic_demo";
}

export interface M32SubmissionRow {
  id: string;
  claimId: string;
  submittedAt: string;
  initialSubmission: boolean;
  acceptedOnInitialSubmission: boolean;
  void: boolean;
  evidenceClass: "synthetic_demo";
}

export interface M32LedgerRow {
  id: string;
  entryType: "gross_charge" | "ending_gross_ar";
  amountCents: number;
  recordedAt: string;
  void: boolean;
  evidenceClass: "synthetic_demo";
}

export interface M32DutyAssignment {
  action: "generate" | "submit" | "post" | "reconcile" | "close";
  actorId: string;
  actorRole: UserRole;
  approvalLimitCents: number | null;
}

export interface M32ApprovalRequest {
  id: string;
  action: M32DutyAssignment["action"];
  actorId: string;
  amountCents: number;
  escalationApproverId?: string;
}

export interface M32ApprovalDecision {
  id: string;
  requestId: string;
  action: M32DutyAssignment["action"];
  amountCents: number;
  requestedBy: string;
  requestedByRole: UserRole | null;
  approvalLimitCents: number | null;
  outcome: "approved_within_limit" | "approved_by_escalation" | "denied";
  approvedBy: string | null;
  approvedByRole: UserRole | null;
  reasonCode:
    | "WITHIN_ASSIGNED_LIMIT"
    | "ESCALATION_APPROVED"
    | "ACTOR_NOT_ASSIGNED"
    | "AMOUNT_EXCEEDS_LIMIT"
    | "INVALID_AMOUNT";
  evidenceClass: "synthetic_demo";
}

export interface M32ExceptionRecord {
  id: string;
  claimId: string;
  type: "submission_rejection" | "payer_denial" | "payment_variance" | "approval_limit";
  ownerRole: UserRole;
  status: "resolved";
  resolution: string;
  resolvedAt: string;
}

export interface M32CloseControl {
  id: string;
  period: string;
  ledgerReconciled: true;
  exceptionsResolved: true;
  locked: true;
  reconciledBy: string;
  approvedBy: string;
  closedBy: string;
  closedAt: string;
}

export interface M32Snapshot extends Readonly<Record<string, unknown>> {
  fixedAsOf: string;
  phase2Lineage: readonly M32VerifiedPhase2Lineage[];
  configurations: readonly M32EffectiveConfiguration[];
  handoffs: readonly M32ClaimHandoffInput[];
  handoffValidations: readonly M32HandoffValidation[];
  claimScenarios: readonly M32ClaimScenario[];
  aging: M32AgingReport;
  metrics: readonly M32RevenueMetric[];
  submissionRows: readonly M32SubmissionRow[];
  ledgerRows: readonly M32LedgerRow[];
  dutyAssignments: readonly M32DutyAssignment[];
  approvalDecisions: readonly M32ApprovalDecision[];
  exceptions: readonly M32ExceptionRecord[];
  closeControl: M32CloseControl;
  productionWritesBlocked: readonly string[];
}

export type M32ModuleResult = Phase3ModuleResult & {
  milestone: "M3.2";
  domain: "REVENUE";
  snapshot: M32Snapshot;
  auditEvents: readonly Phase3AuditEvent[];
};
