import type {
  ClinicalBillingReadinessResult,
  DeliveryMode,
  MhtcmFunction,
  MhtcmLevel,
  ProviderCredential,
  ServiceSetting,
} from "../regulatory/clinical";

export type M22EvidenceClass = "synthetic_demo";

export interface M22Actor {
  id: string;
  role: string;
  displayName?: string;
}

export type M22CaseStatus =
  "open" | "discharge_planning" | "discharged" | "aftercare_complete";

export interface M22EligibilityEvidence {
  medicaidEligible: boolean;
  texasResident: boolean;
  diagnosisCategory:
    | "mental_illness"
    | "serious_emotional_disturbance"
    | "serious_mental_illness"
    | "idd_only"
    | "substance_use_disorder_only";
  diagnosisEstablishedOn: string | null;
  diagnosisLastReviewedOn: string | null;
  diagnosticCriteriaDocumented: boolean;
  functionalEligibilityConfirmed: boolean;
  uniformAssessment: "CANS" | "ANSA" | null;
  uniformAssessmentOn: string | null;
  assessorCertificationExpiresOn: string | null;
  medicalNecessityConfirmedByLpha: boolean;
}

export interface M22LifecycleCompletion {
  function: MhtcmFunction;
  completedAt: string;
  completedBy: string;
  note: string;
}

export interface M22Case {
  id: string;
  referralId: string;
  youthId: string;
  youthDisplayLabel: string;
  ageYears: number;
  evidenceClass: M22EvidenceClass;
  assignedCaseManagerId: string;
  status: M22CaseStatus;
  sourceCansAssessmentId: string;
  sourceCansVersion: number;
  sourceLineageId: string;
  targetPlanId: string;
  targetPlanVersion: number;
  eligibility: M22EligibilityEvidence;
  lifecycle: readonly M22LifecycleCompletion[];
  currentPlanVersion: number | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface M22PlanGoal {
  id: string;
  sourceCansItemCode: string;
  function: MhtcmFunction;
  statement: string;
  measurableOutcome: string;
  status: "active" | "achieved" | "discontinued";
}

export interface M22PlanProvider {
  id: string;
  displayName: string;
  organization: string;
  credential: ProviderCredential;
  credentialCurrent: boolean;
  requiredTrainingCurrent: boolean;
  competencyDocumented: boolean;
  employeeOfBillingProvider: boolean;
  supervisionActive: boolean;
  supervisorCredential: "LPHA" | "QMHP_CS" | null;
  supervisingQmhpHasLphaSupervision: boolean;
}

export interface M22PlanReferral {
  id: string;
  providerId: string;
  service: string;
  status: "planned" | "scheduled" | "connected" | "closed";
  dueOn: string;
}

export interface M22PlanContact {
  id: string;
  contactType: "youth" | "guardian" | "provider" | "school" | "other";
  displayLabel: string;
  purpose: string;
  nextContactOn: string;
}

export interface M22PlanBarrier {
  id: string;
  description: string;
  severity: "low" | "moderate" | "high";
  mitigation: string;
  status: "open" | "monitoring" | "resolved";
}

export interface M22PlanOutcome {
  id: string;
  measure: string;
  baseline: string;
  target: string;
  current: string;
  measuredOn: string;
}

export interface M22PlanComponents {
  goals: readonly M22PlanGoal[];
  providers: readonly M22PlanProvider[];
  referrals: readonly M22PlanReferral[];
  contacts: readonly M22PlanContact[];
  barriers: readonly M22PlanBarrier[];
  outcomes: readonly M22PlanOutcome[];
}

export interface M22SupervisoryReview {
  status: "not_reviewed" | "approved" | "returned";
  reviewedBy: string | null;
  reviewedAt: string | null;
  rationale: string | null;
}

export interface M22PlanVersion {
  planId: string;
  caseId: string;
  version: number;
  previousVersion: number | null;
  evidenceClass: M22EvidenceClass;
  sourceCansAssessmentId: string;
  sourceCansVersion: number;
  sourceLineageId: string;
  status: "draft" | "approved";
  activeFrom: string;
  activeThrough: string;
  serviceIncluded: boolean;
  typeAmountDurationDocumented: boolean;
  telehealthApproved: boolean;
  components: M22PlanComponents;
  preparedBy: string;
  preparedAt: string;
  supervisoryReview: M22SupervisoryReview;
  createdAt: string;
}

export interface M22DischargePlan {
  caseId: string;
  applies: boolean;
  projectedDischargeOn: string;
  completedOn: string;
  completedBy: string;
  leadDays: number;
  disposition: string;
  aftercareNeeds: readonly string[];
}

export interface M22Discharge {
  caseId: string;
  dischargedOn: string;
  dischargedBy: string;
  disposition: string;
}

export interface M22Aftercare {
  caseId: string;
  dueOn: string;
  scheduledFor: string;
  scheduledBy: string;
  completedAt: string | null;
  completedBy: string | null;
  method: "phone" | "video" | "in_person" | null;
  outcome: string | null;
}

export interface M22Authorization {
  id: string;
  caseId: string;
  payerLabel: string;
  status: "authorized" | "mco_waived" | "pending" | "denied" | "expired";
  payerModel: "managed_care" | "fee_for_service";
  waiverDocumentationReference: string | null;
  authorizationReference: string | null;
  procedureCode: "T1017";
  effectiveFrom: string;
  validThrough: string;
  renewalDueOn: string;
  approvedUnits: number;
  usedUnits: number;
  createdAt: string;
}

export interface M22AuthorizationAlert {
  id: string;
  authorizationId: string;
  caseId: string;
  renewalDueOn: string;
  daysUntilRenewal: number;
  priority: "routine" | "urgent" | "critical";
  escalationLevel: "none" | "supervisor" | "director";
  assignedRole: "case-manager" | "mhtcm-supervisor" | "treatment-director";
  status: "open" | "overdue";
  generatedAt: string;
}

export interface M22EncounterDocumentation {
  personName: string | null;
  diagnosisAndNeed: string | null;
  reasonForEncounter: string | null;
  contactParticipants: string | null;
  collateralContacts: string | null;
  planGoal: string | null;
  progress: string | null;
  serviceAccessTimeline: string | null;
  intervention: string | null;
  reevaluationTimeline: string | null;
  agencyName: string | null;
}

export interface M22NoteRevision {
  version: number;
  previousVersion: number | null;
  kind: "original" | "late_entry" | "amendment";
  documentation: M22EncounterDocumentation;
  authoredBy: string;
  authoredAt: string;
  reason: string | null;
  signedBy: string | null;
  signedAt: string | null;
}

export interface M22Encounter {
  id: string;
  caseId: string;
  planId: string;
  planVersion: number;
  providerId: string;
  function: MhtcmFunction;
  level: MhtcmLevel;
  procedureCode: "T1017";
  modifiers: readonly string[];
  serviceDate: string;
  startTime: string;
  endTime: string;
  declaredUnits: number;
  deliveryMode: DeliveryMode;
  setting: ServiceSetting;
  continuousContact: boolean;
  personPresentAwakeParticipating: boolean;
  collateralContact: boolean;
  personOrLarPresentForCollateral: boolean;
  emergentTreatment: boolean;
  duplicatesAnotherServiceOrDischargeActivity: boolean;
  revisions: readonly M22NoteRevision[];
  currentRevision: number;
  createdAt: string;
}

export interface M22BillingDecision {
  id: string;
  caseId: string;
  encounterId: string;
  evaluatedAt: string;
  encounterRevision: number;
  result: ClinicalBillingReadinessResult;
}

export interface M22ClaimHandoff {
  id: string;
  caseId: string;
  encounterId: string;
  encounterRevision: number;
  procedureCode: "T1017";
  serviceDate: string;
  units: number;
  authorizationId: string;
  billingDecisionId: string;
  status: "ready_for_revenue";
  handedOffBy: string;
  handedOffAt: string;
}

export type M22AuditAction =
  | "access_allowed"
  | "access_denied"
  | "case_opened"
  | "lifecycle_function_completed"
  | "plan_version_created"
  | "plan_approved"
  | "discharge_planned"
  | "discharge_recorded"
  | "aftercare_scheduled"
  | "aftercare_completed"
  | "authorization_recorded"
  | "authorization_alert_generated"
  | "encounter_created"
  | "encounter_signed"
  | "encounter_revised"
  | "billing_evaluated"
  | "claim_handoff_created";

export interface M22AuditEvent {
  id: string;
  caseId: string;
  action: M22AuditAction;
  entityType: string;
  entityId: string;
  actorId: string;
  actorRole: string;
  reason: string;
  before: unknown;
  after: unknown;
  changedFields: readonly string[];
  correlationId: string;
  evidenceClass: M22EvidenceClass;
  occurredAt: string;
}

export interface M22CaseSnapshot {
  case: M22Case;
  planVersions: readonly M22PlanVersion[];
  dischargePlan: M22DischargePlan | null;
  discharge: M22Discharge | null;
  aftercare: M22Aftercare | null;
  authorization: M22Authorization | null;
  authorizationAlerts: readonly M22AuthorizationAlert[];
  encounters: readonly M22Encounter[];
  billingDecisions: readonly M22BillingDecision[];
  claimHandoffs: readonly M22ClaimHandoff[];
  auditEvents: readonly M22AuditEvent[];
}

export interface M22PermissionEvidence {
  caseManagerOwnCase: "allowed";
  qaFullCaseReview: "allowed";
  revenueFullCaseAccess: "denied";
  revenueBillingProjection: "allowed";
}

export interface M22ScenarioResult {
  scenarioId: "SCN-M22-001";
  dataMode: M22EvidenceClass;
  criteria: Readonly<
    Record<
      | "M2.2-01"
      | "M2.2-02"
      | "M2.2-03"
      | "M2.2-04"
      | "M2.2-05"
      | "M2.2-06"
      | "M2.2-07"
      | "M2.2-08",
      true
    >
  >;
  acceptanceGate: true;
  permissionEvidence: M22PermissionEvidence;
  snapshot: M22CaseSnapshot;
  billingDecision: M22BillingDecision;
  claimHandoff: M22ClaimHandoff;
}
