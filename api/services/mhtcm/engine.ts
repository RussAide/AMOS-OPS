import {
  CLINICAL_POLICY_METADATA,
  evaluateClinicalBillingReadiness,
  type ClinicalBillingEvaluationInput,
  type MhtcmFunction,
} from "@contracts/regulatory/clinical";
import {
  M22_AFTERCARE_MAXIMUM_DAYS,
  M22_AUTHORIZATION_ALERT_WINDOW_DAYS,
  M22_AUTHORIZATION_RENEWAL_DAYS,
  M22_DISCHARGE_PLAN_MINIMUM_LEAD_DAYS,
  M22_MHTCM_FUNCTIONS,
  M22DomainError,
  isoDate,
  type M22Actor,
  type M22Aftercare,
  type M22AuditAction,
  type M22AuditEvent,
  type M22Authorization,
  type M22AuthorizationAlert,
  type M22BillingDecision,
  type M22Case,
  type M22CaseSnapshot,
  type M22ClaimHandoff,
  type M22Discharge,
  type M22DischargePlan,
  type M22Encounter,
  type M22EncounterDocumentation,
  type M22NoteRevision,
  type M22PlanComponents,
  type M22PlanVersion,
} from "@contracts/mhtcm";
import { addUtcDays, daysBetween } from "@contracts/phase2";
import {
  InMemoryM22Repository,
  type M22Repository,
} from "./in-memory-repository";

const SUPERVISOR_ROLES = new Set([
  "mhtcm-supervisor",
  "treatment-director",
  "clinical-director",
  "bhc-director",
  "super-admin",
  "managing-director",
]);
const CASE_MANAGER_ROLES = new Set(["case-manager", "qmhp-cs"]);
const QA_ROLES = new Set([
  "chart-auditor",
  "clinical-supervisor",
  "hr-compliance-officer",
  "compliance-officer",
]);
const REVENUE_ROLES = new Set([
  "revenue-cycle-manager",
  "billing-specialist",
  "revenue-cycle-specialist",
]);

type CaseAction =
  | "view_full"
  | "manage"
  | "approve"
  | "quality_review"
  | "authorization"
  | "claim_handoff"
  | "billing_projection";

export interface OpenM22CaseInput {
  id: string;
  referralId: string;
  youthId: string;
  youthDisplayLabel: string;
  ageYears: number;
  assignedCaseManagerId: string;
  sourceCansAssessmentId: string;
  sourceCansVersion: number;
  sourceLineageId: string;
  targetPlanId: string;
  targetPlanVersion: number;
  eligibility: M22Case["eligibility"];
  openedAt: string;
}

export interface CreateM22PlanInput {
  caseId: string;
  planId: string;
  expectedCurrentVersion: number | null;
  activeFrom: string;
  activeThrough: string;
  serviceIncluded: boolean;
  typeAmountDurationDocumented: boolean;
  telehealthApproved: boolean;
  components: M22PlanComponents;
  preparedAt: string;
  reason: string;
}

export interface PlanM22DischargeInput {
  caseId: string;
  applies: boolean;
  projectedDischargeOn: string;
  completedOn: string;
  disposition: string;
  aftercareNeeds: readonly string[];
  reason: string;
}

export interface CreateM22EncounterInput {
  id: string;
  caseId: string;
  providerId: string;
  function: MhtcmFunction;
  level: "routine" | "intensive";
  modifiers: readonly string[];
  serviceDate: string;
  startTime: string;
  endTime: string;
  declaredUnits: number;
  deliveryMode:
    "in_person" | "synchronous_audiovisual" | "synchronous_audio_only";
  setting: "individual" | "group";
  continuousContact: boolean;
  personPresentAwakeParticipating: boolean;
  collateralContact: boolean;
  personOrLarPresentForCollateral: boolean;
  emergentTreatment: boolean;
  duplicatesAnotherServiceOrDischargeActivity: boolean;
  documentation: M22EncounterDocumentation;
  authoredAt: string;
  reason: string;
}

export interface ReviseM22EncounterInput {
  encounterId: string;
  expectedRevision: number;
  kind: "late_entry" | "amendment";
  documentationPatch: Partial<M22EncounterDocumentation>;
  authoredAt: string;
  reason: string;
}

export interface RecordM22AuthorizationInput {
  id: string;
  caseId: string;
  payerLabel: string;
  status: M22Authorization["status"];
  payerModel: M22Authorization["payerModel"];
  waiverDocumentationReference: string | null;
  authorizationReference: string | null;
  effectiveFrom: string;
  validThrough: string;
  approvedUnits: number;
  createdAt: string;
  reason: string;
}

function changedFields(before: unknown, after: unknown): readonly string[] {
  if (
    !before ||
    !after ||
    typeof before !== "object" ||
    typeof after !== "object"
  )
    return [];
  const beforeRecord = before as Record<string, unknown>;
  const afterRecord = after as Record<string, unknown>;
  return [
    ...new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]),
  ].filter(
    (key) =>
      JSON.stringify(beforeRecord[key]) !== JSON.stringify(afterRecord[key]),
  );
}

function lastItem<T>(items: readonly T[]): T | undefined {
  return items[items.length - 1];
}

function assertNonBlank(value: string, field: string): void {
  if (!value.trim())
    throw new M22DomainError("INVALID_INPUT", `${field} is required.`);
}

function assertTimestamp(value: string, field: string): void {
  if (!Number.isFinite(Date.parse(value))) {
    throw new M22DomainError(
      "INVALID_INPUT",
      `${field} must be a valid timestamp.`,
    );
  }
}

function assertPlanComponents(components: M22PlanComponents): void {
  const required: ReadonlyArray<[keyof M22PlanComponents, readonly unknown[]]> =
    [
      ["goals", components.goals],
      ["providers", components.providers],
      ["referrals", components.referrals],
      ["contacts", components.contacts],
      ["barriers", components.barriers],
      ["outcomes", components.outcomes],
    ];
  const missing = required
    .filter(([, values]) => values.length === 0)
    .map(([key]) => key);
  if (missing.length > 0) {
    throw new M22DomainError(
      "PLAN_COMPONENTS_INCOMPLETE",
      `Versioned plan must contain ${missing.join(", ")}.`,
    );
  }
}

export class M22MhtcmEngine {
  readonly repository: M22Repository;

  constructor(repository: M22Repository = new InMemoryM22Repository()) {
    this.repository = repository;
  }

  private audit(
    actor: M22Actor,
    caseId: string,
    action: M22AuditAction,
    entityType: string,
    entityId: string,
    reason: string,
    before: unknown,
    after: unknown,
    occurredAt: string,
  ): M22AuditEvent {
    assertTimestamp(occurredAt, "occurredAt");
    const event: M22AuditEvent = {
      id: `M22-AUDIT-${String(this.repository.nextSequence()).padStart(4, "0")}`,
      caseId,
      action,
      entityType,
      entityId,
      actorId: actor.id,
      actorRole: actor.role,
      reason,
      before: structuredClone(before),
      after: structuredClone(after),
      changedFields: changedFields(before, after),
      correlationId: `M22-CORR-${caseId}`,
      evidenceClass: "synthetic_demo",
      occurredAt,
    };
    this.repository.appendAudit(event);
    return event;
  }

  private requireCase(caseId: string): M22Case {
    const value = this.repository.getCase(caseId);
    if (!value)
      throw new M22DomainError(
        "CASE_NOT_FOUND",
        `MHTCM case ${caseId} was not found.`,
      );
    return value;
  }

  private isAllowed(
    actor: M22Actor,
    item: M22Case,
    action: CaseAction,
  ): boolean {
    const isSupervisor = SUPERVISOR_ROLES.has(actor.role);
    const isOwnCaseManager =
      CASE_MANAGER_ROLES.has(actor.role) &&
      item.assignedCaseManagerId === actor.id;
    if (action === "view_full")
      return isSupervisor || isOwnCaseManager || QA_ROLES.has(actor.role);
    if (action === "manage") return isSupervisor || isOwnCaseManager;
    if (action === "approve") return isSupervisor;
    if (action === "quality_review")
      return isSupervisor || QA_ROLES.has(actor.role);
    if (action === "authorization")
      return isSupervisor || REVENUE_ROLES.has(actor.role);
    if (action === "claim_handoff") return isSupervisor || isOwnCaseManager;
    if (action === "billing_projection")
      return isSupervisor || REVENUE_ROLES.has(actor.role);
    return false;
  }

  private authorize(
    actor: M22Actor,
    item: M22Case,
    action: CaseAction,
    at: string,
  ): void {
    if (this.isAllowed(actor, item, action)) return;
    this.audit(
      actor,
      item.id,
      "access_denied",
      "mhtcm_case",
      item.id,
      `Role ${actor.role} is not authorized for ${action}.`,
      null,
      { action, outcome: "denied" },
      at,
    );
    throw new M22DomainError(
      "PERMISSION_DENIED",
      `Role ${actor.role} is not authorized for ${action}.`,
    );
  }

  openCase(actor: M22Actor, input: OpenM22CaseInput): M22Case {
    if (!SUPERVISOR_ROLES.has(actor.role)) {
      throw new M22DomainError(
        "PERMISSION_DENIED",
        "MHTCM case opening requires supervisory authority.",
      );
    }
    for (const [field, value] of [
      ["id", input.id],
      ["referralId", input.referralId],
      ["youthId", input.youthId],
      ["youthDisplayLabel", input.youthDisplayLabel],
      ["assignedCaseManagerId", input.assignedCaseManagerId],
      ["sourceCansAssessmentId", input.sourceCansAssessmentId],
      ["sourceLineageId", input.sourceLineageId],
      ["targetPlanId", input.targetPlanId],
    ] as const)
      assertNonBlank(value, field);
    assertTimestamp(input.openedAt, "openedAt");
    if (
      !Number.isInteger(input.sourceCansVersion) ||
      input.sourceCansVersion < 1
    ) {
      throw new M22DomainError(
        "INVALID_INPUT",
        "sourceCansVersion must be positive.",
      );
    }
    if (
      !Number.isInteger(input.targetPlanVersion) ||
      input.targetPlanVersion < 1
    ) {
      throw new M22DomainError(
        "INVALID_INPUT",
        "targetPlanVersion must be positive.",
      );
    }
    const item: M22Case = {
      id: input.id,
      referralId: input.referralId,
      youthId: input.youthId,
      youthDisplayLabel: input.youthDisplayLabel,
      ageYears: input.ageYears,
      evidenceClass: "synthetic_demo",
      assignedCaseManagerId: input.assignedCaseManagerId,
      status: "open",
      sourceCansAssessmentId: input.sourceCansAssessmentId,
      sourceCansVersion: input.sourceCansVersion,
      sourceLineageId: input.sourceLineageId,
      targetPlanId: input.targetPlanId,
      targetPlanVersion: input.targetPlanVersion,
      eligibility: structuredClone(input.eligibility),
      lifecycle: [],
      currentPlanVersion: null,
      createdAt: input.openedAt,
      updatedAt: input.openedAt,
      version: 1,
    };
    this.repository.putCase(item);
    this.audit(
      actor,
      item.id,
      "case_opened",
      "mhtcm_case",
      item.id,
      "Accepted exact CCMG/CANS MHTCM handoff.",
      null,
      item,
      input.openedAt,
    );
    return structuredClone(item);
  }

  getCase(actor: M22Actor, caseId: string, accessedAt: string): M22Case {
    const item = this.requireCase(caseId);
    this.authorize(actor, item, "view_full", accessedAt);
    this.audit(
      actor,
      caseId,
      "access_allowed",
      "mhtcm_case",
      caseId,
      "Authorized full-case access.",
      null,
      { outcome: "allowed" },
      accessedAt,
    );
    return item;
  }

  completeLifecycleFunction(
    actor: M22Actor,
    caseId: string,
    lifecycleFunction: MhtcmFunction,
    completedAt: string,
    note: string,
  ): M22Case {
    const item = this.requireCase(caseId);
    this.authorize(actor, item, "manage", completedAt);
    assertNonBlank(note, "note");
    const expected = M22_MHTCM_FUNCTIONS[item.lifecycle.length];
    if (lifecycleFunction !== expected) {
      throw new M22DomainError(
        "LIFECYCLE_OUT_OF_ORDER",
        `Expected ${expected ?? "no additional function"}; received ${lifecycleFunction}.`,
      );
    }
    if (
      lifecycleFunction === "discharge_planning" &&
      !this.repository.getDischargePlan(caseId)
    ) {
      throw new M22DomainError(
        "LIFECYCLE_OUT_OF_ORDER",
        "A compliant discharge plan must be recorded first.",
      );
    }
    const aftercare = this.repository.getAftercare(caseId);
    if (
      lifecycleFunction === "aftercare_follow_up" &&
      !aftercare?.completedAt
    ) {
      throw new M22DomainError(
        "LIFECYCLE_OUT_OF_ORDER",
        "The aftercare contact must be completed first.",
      );
    }
    const before = item;
    const next: M22Case = {
      ...item,
      lifecycle: [
        ...item.lifecycle,
        {
          function: lifecycleFunction,
          completedAt,
          completedBy: actor.id,
          note,
        },
      ],
      status:
        lifecycleFunction === "discharge_planning"
          ? "discharge_planning"
          : lifecycleFunction === "aftercare_follow_up"
            ? "aftercare_complete"
            : item.status,
      updatedAt: completedAt,
      version: item.version + 1,
    };
    this.repository.putCase(next);
    this.audit(
      actor,
      caseId,
      "lifecycle_function_completed",
      "mhtcm_case",
      caseId,
      note,
      before,
      next,
      completedAt,
    );
    return next;
  }

  createPlanVersion(
    actor: M22Actor,
    input: CreateM22PlanInput,
  ): M22PlanVersion {
    const item = this.requireCase(input.caseId);
    this.authorize(actor, item, "manage", input.preparedAt);
    assertNonBlank(input.reason, "reason");
    assertPlanComponents(input.components);
    if (input.planId !== item.targetPlanId) {
      throw new M22DomainError(
        "PLAN_VERSION_CONFLICT",
        "Plan ID must match the exact approved M2.1 target record.",
      );
    }
    const history = this.repository.listPlans(item.id);
    const currentVersion = lastItem(history)?.version ?? null;
    if (input.expectedCurrentVersion !== currentVersion) {
      throw new M22DomainError(
        "PLAN_VERSION_CONFLICT",
        `Expected plan version ${currentVersion}; received ${input.expectedCurrentVersion}.`,
      );
    }
    const version = (currentVersion ?? 0) + 1;
    const plan: M22PlanVersion = {
      planId: input.planId,
      caseId: item.id,
      version,
      previousVersion: currentVersion,
      evidenceClass: "synthetic_demo",
      sourceCansAssessmentId: item.sourceCansAssessmentId,
      sourceCansVersion: item.sourceCansVersion,
      sourceLineageId: item.sourceLineageId,
      status: "draft",
      activeFrom: isoDate(input.activeFrom),
      activeThrough: isoDate(input.activeThrough),
      serviceIncluded: input.serviceIncluded,
      typeAmountDurationDocumented: input.typeAmountDurationDocumented,
      telehealthApproved: input.telehealthApproved,
      components: structuredClone(input.components),
      preparedBy: actor.id,
      preparedAt: input.preparedAt,
      supervisoryReview: {
        status: "not_reviewed",
        reviewedBy: null,
        reviewedAt: null,
        rationale: null,
      },
      createdAt: input.preparedAt,
    };
    this.repository.appendPlan(plan);
    const nextCase = {
      ...item,
      currentPlanVersion: version,
      updatedAt: input.preparedAt,
      version: item.version + 1,
    };
    this.repository.putCase(nextCase);
    this.audit(
      actor,
      item.id,
      "plan_version_created",
      "mhtcm_plan",
      plan.planId,
      input.reason,
      lastItem(history) ?? null,
      plan,
      input.preparedAt,
    );
    return plan;
  }

  approveCurrentPlan(
    actor: M22Actor,
    caseId: string,
    expectedVersion: number,
    reviewedAt: string,
    rationale: string,
  ): M22PlanVersion {
    const item = this.requireCase(caseId);
    this.authorize(actor, item, "approve", reviewedAt);
    assertNonBlank(rationale, "rationale");
    const history = this.repository.listPlans(caseId);
    const current = lastItem(history);
    if (!current)
      throw new M22DomainError(
        "PLAN_NOT_FOUND",
        "No plan is available for review.",
      );
    if (
      current.version !== expectedVersion ||
      item.currentPlanVersion !== expectedVersion
    ) {
      throw new M22DomainError(
        "PLAN_VERSION_CONFLICT",
        "Plan version changed before supervisory review.",
      );
    }
    if (current.preparedBy === actor.id) {
      throw new M22DomainError(
        "INDEPENDENT_REVIEW_REQUIRED",
        "Plan preparer cannot independently approve the plan.",
      );
    }
    const approved: M22PlanVersion = {
      ...structuredClone(current),
      version: current.version + 1,
      previousVersion: current.version,
      status: "approved",
      supervisoryReview: {
        status: "approved",
        reviewedBy: actor.id,
        reviewedAt,
        rationale,
      },
      createdAt: reviewedAt,
    };
    if (approved.version !== item.targetPlanVersion) {
      throw new M22DomainError(
        "PLAN_VERSION_CONFLICT",
        `Approved version ${approved.version} does not match M2.1 target version ${item.targetPlanVersion}.`,
      );
    }
    this.repository.appendPlan(approved);
    this.repository.putCase({
      ...item,
      currentPlanVersion: approved.version,
      updatedAt: reviewedAt,
      version: item.version + 1,
    });
    this.audit(
      actor,
      caseId,
      "plan_approved",
      "mhtcm_plan",
      approved.planId,
      rationale,
      current,
      approved,
      reviewedAt,
    );
    return approved;
  }

  planDischarge(
    actor: M22Actor,
    input: PlanM22DischargeInput,
  ): M22DischargePlan {
    const item = this.requireCase(input.caseId);
    this.authorize(actor, item, "manage", `${input.completedOn}T12:00:00.000Z`);
    const leadDays = daysBetween(
      `${isoDate(input.completedOn)}T00:00:00.000Z`,
      `${isoDate(input.projectedDischargeOn)}T00:00:00.000Z`,
    );
    if (input.applies && leadDays < M22_DISCHARGE_PLAN_MINIMUM_LEAD_DAYS) {
      throw new M22DomainError(
        "DISCHARGE_PLAN_LEAD_TIME",
        `Applicable discharge planning requires at least ${M22_DISCHARGE_PLAN_MINIMUM_LEAD_DAYS} days; received ${leadDays}.`,
      );
    }
    if (input.applies && input.aftercareNeeds.length === 0) {
      throw new M22DomainError(
        "INVALID_INPUT",
        "Applicable discharge planning requires aftercare needs.",
      );
    }
    const plan: M22DischargePlan = {
      caseId: input.caseId,
      applies: input.applies,
      projectedDischargeOn: isoDate(input.projectedDischargeOn),
      completedOn: isoDate(input.completedOn),
      completedBy: actor.id,
      leadDays,
      disposition: input.disposition,
      aftercareNeeds: [...input.aftercareNeeds],
    };
    const before = this.repository.getDischargePlan(item.id);
    this.repository.putDischargePlan(plan);
    this.audit(
      actor,
      item.id,
      "discharge_planned",
      "mhtcm_discharge_plan",
      item.id,
      input.reason,
      before,
      plan,
      `${input.completedOn}T12:00:00.000Z`,
    );
    return plan;
  }

  recordDischarge(
    actor: M22Actor,
    caseId: string,
    dischargedOn: string,
    disposition: string,
    recordedAt: string,
  ): M22Discharge {
    const item = this.requireCase(caseId);
    this.authorize(actor, item, "manage", recordedAt);
    const plan = this.repository.getDischargePlan(caseId);
    if (!plan)
      throw new M22DomainError(
        "DISCHARGE_NOT_RECORDED",
        "A discharge plan is required before discharge.",
      );
    if (
      !item.lifecycle.some((entry) => entry.function === "discharge_planning")
    ) {
      throw new M22DomainError(
        "LIFECYCLE_OUT_OF_ORDER",
        "Discharge-planning function must be completed before discharge.",
      );
    }
    const discharge: M22Discharge = {
      caseId,
      dischargedOn: isoDate(dischargedOn),
      dischargedBy: actor.id,
      disposition,
    };
    const before = this.repository.getDischarge(caseId);
    this.repository.putDischarge(discharge);
    this.repository.putCase({
      ...item,
      status: "discharged",
      updatedAt: recordedAt,
      version: item.version + 1,
    });
    this.audit(
      actor,
      caseId,
      "discharge_recorded",
      "mhtcm_discharge",
      caseId,
      "Controlled discharge recorded.",
      before,
      discharge,
      recordedAt,
    );
    return discharge;
  }

  scheduleAftercare(
    actor: M22Actor,
    caseId: string,
    scheduledFor: string,
    scheduledAt: string,
  ): M22Aftercare {
    const item = this.requireCase(caseId);
    this.authorize(actor, item, "manage", scheduledAt);
    const discharge = this.repository.getDischarge(caseId);
    if (!discharge)
      throw new M22DomainError(
        "DISCHARGE_NOT_RECORDED",
        "Discharge is required before aftercare scheduling.",
      );
    const dueOn = isoDate(
      addUtcDays(
        `${discharge.dischargedOn}T00:00:00.000Z`,
        M22_AFTERCARE_MAXIMUM_DAYS,
      ),
    );
    const scheduledDate = isoDate(scheduledFor);
    if (scheduledDate < discharge.dischargedOn || scheduledDate > dueOn) {
      throw new M22DomainError(
        "AFTERCARE_WINDOW",
        `Aftercare must be scheduled by ${dueOn}.`,
      );
    }
    const aftercare: M22Aftercare = {
      caseId,
      dueOn,
      scheduledFor: scheduledDate,
      scheduledBy: actor.id,
      completedAt: null,
      completedBy: null,
      method: null,
      outcome: null,
    };
    const before = this.repository.getAftercare(caseId);
    this.repository.putAftercare(aftercare);
    this.audit(
      actor,
      caseId,
      "aftercare_scheduled",
      "mhtcm_aftercare",
      caseId,
      "Aftercare scheduled within 30 days.",
      before,
      aftercare,
      scheduledAt,
    );
    return aftercare;
  }

  completeAftercare(
    actor: M22Actor,
    caseId: string,
    completedAt: string,
    method: NonNullable<M22Aftercare["method"]>,
    outcome: string,
  ): M22Aftercare {
    const item = this.requireCase(caseId);
    this.authorize(actor, item, "manage", completedAt);
    const existing = this.repository.getAftercare(caseId);
    if (!existing)
      throw new M22DomainError(
        "AFTERCARE_WINDOW",
        "Aftercare must be scheduled before completion.",
      );
    if (isoDate(completedAt) > existing.dueOn) {
      throw new M22DomainError(
        "AFTERCARE_WINDOW",
        `Aftercare contact was due by ${existing.dueOn}.`,
      );
    }
    assertNonBlank(outcome, "outcome");
    const completed: M22Aftercare = {
      ...existing,
      completedAt,
      completedBy: actor.id,
      method,
      outcome,
    };
    this.repository.putAftercare(completed);
    this.audit(
      actor,
      caseId,
      "aftercare_completed",
      "mhtcm_aftercare",
      caseId,
      "Aftercare contact documented within 30 days.",
      existing,
      completed,
      completedAt,
    );
    return completed;
  }

  recordAuthorization(
    actor: M22Actor,
    input: RecordM22AuthorizationInput,
  ): M22Authorization {
    const item = this.requireCase(input.caseId);
    this.authorize(actor, item, "authorization", input.createdAt);
    if (!Number.isInteger(input.approvedUnits) || input.approvedUnits < 0) {
      throw new M22DomainError(
        "INVALID_INPUT",
        "approvedUnits must be a non-negative integer.",
      );
    }
    const authorization: M22Authorization = {
      id: input.id,
      caseId: item.id,
      payerLabel: input.payerLabel,
      status: input.status,
      payerModel: input.payerModel,
      waiverDocumentationReference: input.waiverDocumentationReference,
      authorizationReference: input.authorizationReference,
      procedureCode: "T1017",
      effectiveFrom: isoDate(input.effectiveFrom),
      validThrough: isoDate(input.validThrough),
      renewalDueOn: isoDate(
        addUtcDays(
          `${isoDate(input.effectiveFrom)}T00:00:00.000Z`,
          M22_AUTHORIZATION_RENEWAL_DAYS,
        ),
      ),
      approvedUnits: input.approvedUnits,
      usedUnits: 0,
      createdAt: input.createdAt,
    };
    const before = this.repository.getAuthorizationByCase(item.id);
    this.repository.putAuthorization(authorization);
    this.audit(
      actor,
      item.id,
      "authorization_recorded",
      "mhtcm_authorization",
      authorization.id,
      input.reason,
      before,
      authorization,
      input.createdAt,
    );
    return authorization;
  }

  generateAuthorizationAlerts(
    actor: M22Actor,
    asOf: string,
  ): readonly M22AuthorizationAlert[] {
    const asOfDate = isoDate(asOf);
    const generatedAt = `${asOfDate}T08:00:00.000Z`;
    const generated: M22AuthorizationAlert[] = [];
    for (const item of this.repository.listCases()) {
      const authorization = this.repository.getAuthorizationByCase(item.id);
      if (!authorization) continue;
      this.authorize(actor, item, "authorization", generatedAt);
      const daysUntilRenewal = daysBetween(
        `${asOfDate}T00:00:00.000Z`,
        `${authorization.renewalDueOn}T00:00:00.000Z`,
      );
      if (daysUntilRenewal > M22_AUTHORIZATION_ALERT_WINDOW_DAYS) continue;
      const overdue = daysUntilRenewal < 0;
      const critical = overdue;
      const urgent = !critical && daysUntilRenewal <= 14;
      const alert: M22AuthorizationAlert = {
        id: `M22-AUTH-ALERT-${authorization.id}-${authorization.renewalDueOn}`,
        authorizationId: authorization.id,
        caseId: item.id,
        renewalDueOn: authorization.renewalDueOn,
        daysUntilRenewal,
        priority: critical ? "critical" : urgent ? "urgent" : "routine",
        escalationLevel: critical ? "director" : urgent ? "supervisor" : "none",
        assignedRole: critical
          ? "treatment-director"
          : urgent
            ? "mhtcm-supervisor"
            : "case-manager",
        status: overdue ? "overdue" : "open",
        generatedAt,
      };
      this.repository.putAuthorizationAlert(alert);
      this.audit(
        actor,
        item.id,
        "authorization_alert_generated",
        "mhtcm_authorization_alert",
        alert.id,
        "Deterministic 180-day renewal alert generated.",
        null,
        alert,
        generatedAt,
      );
      generated.push(alert);
    }
    return generated;
  }

  createEncounter(
    actor: M22Actor,
    input: CreateM22EncounterInput,
  ): M22Encounter {
    const item = this.requireCase(input.caseId);
    this.authorize(actor, item, "manage", input.authoredAt);
    const plan = lastItem(this.repository.listPlans(item.id));
    if (
      !plan ||
      plan.status !== "approved" ||
      plan.version !== item.currentPlanVersion
    ) {
      throw new M22DomainError(
        "PLAN_NOT_FOUND",
        "An exact approved current plan is required.",
      );
    }
    if (
      !plan.components.providers.some(
        (provider) => provider.id === input.providerId,
      )
    ) {
      throw new M22DomainError(
        "INVALID_INPUT",
        "Encounter provider must be assigned on the current plan.",
      );
    }
    const revision: M22NoteRevision = {
      version: 1,
      previousVersion: null,
      kind: "original",
      documentation: structuredClone(input.documentation),
      authoredBy: actor.id,
      authoredAt: input.authoredAt,
      reason: null,
      signedBy: null,
      signedAt: null,
    };
    const encounter: M22Encounter = {
      id: input.id,
      caseId: item.id,
      planId: plan.planId,
      planVersion: plan.version,
      providerId: input.providerId,
      function: input.function,
      level: input.level,
      procedureCode: "T1017",
      modifiers: [...input.modifiers],
      serviceDate: isoDate(input.serviceDate),
      startTime: input.startTime,
      endTime: input.endTime,
      declaredUnits: input.declaredUnits,
      deliveryMode: input.deliveryMode,
      setting: input.setting,
      continuousContact: input.continuousContact,
      personPresentAwakeParticipating: input.personPresentAwakeParticipating,
      collateralContact: input.collateralContact,
      personOrLarPresentForCollateral: input.personOrLarPresentForCollateral,
      emergentTreatment: input.emergentTreatment,
      duplicatesAnotherServiceOrDischargeActivity:
        input.duplicatesAnotherServiceOrDischargeActivity,
      revisions: [revision],
      currentRevision: 1,
      createdAt: input.authoredAt,
    };
    this.repository.putEncounter(encounter);
    this.audit(
      actor,
      item.id,
      "encounter_created",
      "mhtcm_encounter",
      encounter.id,
      input.reason,
      null,
      encounter,
      input.authoredAt,
    );
    return encounter;
  }

  signEncounter(
    actor: M22Actor,
    encounterId: string,
    expectedRevision: number,
    signedAt: string,
    reason: string,
  ): M22Encounter {
    const encounter = this.repository.getEncounter(encounterId);
    if (!encounter)
      throw new M22DomainError(
        "ENCOUNTER_NOT_FOUND",
        `Encounter ${encounterId} was not found.`,
      );
    const item = this.requireCase(encounter.caseId);
    this.authorize(actor, item, "manage", signedAt);
    if (
      actor.id !== encounter.providerId &&
      !SUPERVISOR_ROLES.has(actor.role)
    ) {
      throw new M22DomainError(
        "PERMISSION_DENIED",
        "Only the rendering provider or a supervisor can sign the encounter.",
      );
    }
    const current = lastItem(encounter.revisions);
    if (!current || current.version !== expectedRevision || current.signedAt) {
      throw new M22DomainError(
        "NOTE_REVISION_CONFLICT",
        "Encounter revision changed or is already signed.",
      );
    }
    const signed: M22NoteRevision = {
      ...structuredClone(current),
      version: current.version + 1,
      previousVersion: current.version,
      signedBy: actor.id,
      signedAt,
    };
    const updated: M22Encounter = {
      ...encounter,
      revisions: [...encounter.revisions, signed],
      currentRevision: signed.version,
    };
    this.repository.putEncounter(updated);
    this.audit(
      actor,
      item.id,
      "encounter_signed",
      "mhtcm_encounter",
      encounter.id,
      reason,
      current,
      signed,
      signedAt,
    );
    return updated;
  }

  reviseEncounter(
    actor: M22Actor,
    input: ReviseM22EncounterInput,
  ): M22Encounter {
    const encounter = this.repository.getEncounter(input.encounterId);
    if (!encounter)
      throw new M22DomainError(
        "ENCOUNTER_NOT_FOUND",
        `Encounter ${input.encounterId} was not found.`,
      );
    const item = this.requireCase(encounter.caseId);
    this.authorize(actor, item, "manage", input.authoredAt);
    assertNonBlank(input.reason, "reason");
    const current = lastItem(encounter.revisions);
    if (
      !current ||
      current.version !== input.expectedRevision ||
      !current.signedAt
    ) {
      throw new M22DomainError(
        "NOTE_REVISION_CONFLICT",
        "Only the exact current signed revision can be amended.",
      );
    }
    const revised: M22NoteRevision = {
      version: current.version + 1,
      previousVersion: current.version,
      kind: input.kind,
      documentation: {
        ...structuredClone(current.documentation),
        ...structuredClone(input.documentationPatch),
      },
      authoredBy: actor.id,
      authoredAt: input.authoredAt,
      reason: input.reason,
      signedBy: null,
      signedAt: null,
    };
    const updated: M22Encounter = {
      ...encounter,
      revisions: [...encounter.revisions, revised],
      currentRevision: revised.version,
    };
    this.repository.putEncounter(updated);
    this.audit(
      actor,
      item.id,
      "encounter_revised",
      "mhtcm_encounter",
      encounter.id,
      input.reason,
      current,
      revised,
      input.authoredAt,
    );
    return updated;
  }

  private billingInput(
    encounter: M22Encounter,
    evaluatedAt: string,
  ): ClinicalBillingEvaluationInput {
    const item = this.requireCase(encounter.caseId);
    const plan = this.repository
      .listPlans(item.id)
      .find((candidate) => candidate.version === encounter.planVersion);
    if (!plan)
      throw new M22DomainError(
        "PLAN_NOT_FOUND",
        "Encounter plan version was not found.",
      );
    const provider = plan.components.providers.find(
      (candidate) => candidate.id === encounter.providerId,
    );
    if (!provider)
      throw new M22DomainError(
        "INVALID_INPUT",
        "Encounter provider is not present on its immutable plan version.",
      );
    const authorization = this.repository.getAuthorizationByCase(item.id);
    const note = lastItem(encounter.revisions);
    if (!note)
      throw new M22DomainError(
        "NOTE_REVISION_CONFLICT",
        "Encounter has no documentation revision.",
      );
    const priorEncounters = this.repository
      .listEncounters(item.id)
      .filter((candidate) => candidate.id !== encounter.id)
      .map((candidate) => ({
        encounterId: candidate.id,
        clientId: item.youthId,
        serviceDate: candidate.serviceDate,
        startTime: candidate.startTime,
        endTime: candidate.endTime,
        procedureCode: candidate.procedureCode,
        modifiers: candidate.modifiers,
        status: lastItem(candidate.revisions)?.signedAt
          ? ("documented" as const)
          : ("voided" as const),
      }));
    const authorizationStatus: ClinicalBillingEvaluationInput["authorization"]["status"] =
      authorization?.status === "authorized"
        ? ("authorized" as const)
        : authorization?.status === "mco_waived"
          ? ("mco_waived" as const)
          : authorization?.status === "pending" ||
              authorization?.status === "denied"
            ? authorization.status
            : authorization?.status === "expired"
              ? "denied"
              : "missing";
    return {
      evaluatedOn: isoDate(evaluatedAt),
      acknowledgedPolicyVersion: CLINICAL_POLICY_METADATA.version,
      encounter: {
        encounterId: encounter.id,
        clientId: item.youthId,
        program: "MHTCM",
        procedureCode: encounter.procedureCode,
        modifiers: encounter.modifiers,
        serviceDate: encounter.serviceDate,
        startTime: encounter.startTime,
        endTime: encounter.endTime,
        declaredUnits: encounter.declaredUnits,
        ageYears: item.ageYears,
        deliveryMode: encounter.deliveryMode,
        setting: encounter.setting,
        fundingSource: "standard",
        continuousContact: encounter.continuousContact,
        personPresentAwakeParticipating:
          encounter.personPresentAwakeParticipating,
        collateralContact: encounter.collateralContact,
        personOrLarPresentForCollateral:
          encounter.personOrLarPresentForCollateral,
        mhtcmFunction: encounter.function,
        mhtcmLevel: encounter.level,
        emergentTreatment: encounter.emergentTreatment,
        duplicatesAnotherServiceOrDischargeActivity:
          encounter.duplicatesAnotherServiceOrDischargeActivity,
      },
      eligibility: structuredClone(item.eligibility),
      provider: {
        providerId: provider.id,
        credential: provider.credential,
        credentialCurrent: provider.credentialCurrent,
        requiredTrainingCurrent: provider.requiredTrainingCurrent,
        competencyDocumented: provider.competencyDocumented,
        employeeOfBillingProvider: provider.employeeOfBillingProvider,
        supervisionActive: provider.supervisionActive,
        supervisorCredential: provider.supervisorCredential,
        supervisingQmhpHasLphaSupervision:
          provider.supervisingQmhpHasLphaSupervision,
        peerMonthlyMeetingDocumented: false,
        peerMonthlyObservationDocumented: false,
        familyPartnerCertified: false,
      },
      authorization: {
        status: authorizationStatus,
        authorizationId: authorization?.authorizationReference ?? null,
        payerModel: authorization?.payerModel ?? "fee_for_service",
        waiverDocumentationReference:
          authorization?.waiverDocumentationReference ?? null,
        validFrom: authorization?.effectiveFrom ?? null,
        validThrough: authorization?.validThrough ?? null,
        procedureCode: authorization?.procedureCode ?? null,
        remainingUnits: authorization
          ? authorization.approvedUnits - authorization.usedUnits
          : null,
      },
      plan: {
        exists: plan.status === "approved",
        activeFrom: plan.activeFrom,
        activeThrough: plan.activeThrough,
        serviceIncluded: plan.serviceIncluded,
        goalReference: note.documentation.planGoal,
        typeAmountDurationDocumented: plan.typeAmountDurationDocumented,
        telehealthApproved: plan.telehealthApproved,
      },
      telehealth: {
        consentDocumented: false,
        clinicallyAppropriateAndSafe: false,
        audioOnlyReason: null,
        priorInPersonOrAudiovisualServiceOn: null,
        rollingTwelveMonthInPersonOrAudiovisualServiceOn: null,
        rollingTwelveMonthWaiverDocumented: false,
      },
      documentation: {
        ...structuredClone(note.documentation),
        serviceType: null,
        modalityAndMethod: null,
        location: null,
        pertinentEventsOrBehavior: null,
        outcomeOrProgress: null,
        serviceDate: encounter.serviceDate,
        startTime: encounter.startTime,
        endTime: encounter.endTime,
        deliveryMode: encounter.deliveryMode,
        providerSignature: note.signedBy,
        providerCredential: provider.credential,
      },
      priorEncounters,
    };
  }

  evaluateEncounter(
    actor: M22Actor,
    encounterId: string,
    evaluatedAt: string,
  ): M22BillingDecision {
    const encounter = this.repository.getEncounter(encounterId);
    if (!encounter)
      throw new M22DomainError(
        "ENCOUNTER_NOT_FOUND",
        `Encounter ${encounterId} was not found.`,
      );
    const item = this.requireCase(encounter.caseId);
    if (
      !this.isAllowed(actor, item, "manage") &&
      !this.isAllowed(actor, item, "quality_review")
    ) {
      this.authorize(actor, item, "quality_review", evaluatedAt);
    }
    const result = evaluateClinicalBillingReadiness(
      this.billingInput(encounter, evaluatedAt),
    );
    const decision: M22BillingDecision = {
      id: `M22-BILLING-${String(this.repository.nextSequence()).padStart(4, "0")}`,
      caseId: item.id,
      encounterId,
      evaluatedAt,
      encounterRevision: encounter.currentRevision,
      result,
    };
    this.repository.appendBillingDecision(decision);
    this.audit(
      actor,
      item.id,
      "billing_evaluated",
      "mhtcm_billing_decision",
      decision.id,
      `T1017 decision ${result.decision}.`,
      null,
      decision,
      evaluatedAt,
    );
    return decision;
  }

  createClaimHandoff(
    actor: M22Actor,
    encounterId: string,
    handedOffAt: string,
  ): M22ClaimHandoff {
    const encounter = this.repository.getEncounter(encounterId);
    if (!encounter)
      throw new M22DomainError(
        "ENCOUNTER_NOT_FOUND",
        `Encounter ${encounterId} was not found.`,
      );
    const item = this.requireCase(encounter.caseId);
    this.authorize(actor, item, "claim_handoff", handedOffAt);
    const decision = this.evaluateEncounter(actor, encounterId, handedOffAt);
    if (!decision.result.billingReady) {
      throw new M22DomainError(
        "BILLING_GATE_FAILED",
        `Claim handoff denied: ${decision.result.reasonCodes.join(", ") || "billing evidence failed"}.`,
      );
    }
    const authorization = this.repository.getAuthorizationByCase(item.id);
    if (!authorization)
      throw new M22DomainError(
        "AUTHORIZATION_NOT_FOUND",
        "T1017 authorization was not found.",
      );
    const handoff: M22ClaimHandoff = {
      id: `M22-CLAIM-HANDOFF-${String(this.repository.nextSequence()).padStart(4, "0")}`,
      caseId: item.id,
      encounterId,
      encounterRevision: encounter.currentRevision,
      procedureCode: "T1017",
      serviceDate: encounter.serviceDate,
      units: encounter.declaredUnits,
      authorizationId: authorization.id,
      billingDecisionId: decision.id,
      status: "ready_for_revenue",
      handedOffBy: actor.id,
      handedOffAt,
    };
    this.repository.appendClaimHandoff(handoff);
    this.repository.putAuthorization({
      ...authorization,
      usedUnits: authorization.usedUnits + encounter.declaredUnits,
    });
    this.audit(
      actor,
      item.id,
      "claim_handoff_created",
      "mhtcm_claim_handoff",
      handoff.id,
      "Fail-closed T1017 gate passed.",
      null,
      handoff,
      handedOffAt,
    );
    return handoff;
  }

  getBillingProjection(
    actor: M22Actor,
    caseId: string,
    accessedAt: string,
  ): Readonly<{
    caseId: string;
    authorizationStatus: M22Authorization["status"] | "missing";
    renewalDueOn: string | null;
    claimHandoffs: readonly M22ClaimHandoff[];
  }> {
    const item = this.requireCase(caseId);
    this.authorize(actor, item, "billing_projection", accessedAt);
    const authorization = this.repository.getAuthorizationByCase(caseId);
    const projection = {
      caseId,
      authorizationStatus: authorization?.status ?? ("missing" as const),
      renewalDueOn: authorization?.renewalDueOn ?? null,
      claimHandoffs: this.repository.listClaimHandoffs(caseId),
    };
    this.audit(
      actor,
      caseId,
      "access_allowed",
      "mhtcm_billing_projection",
      caseId,
      "Minimum-necessary revenue projection accessed.",
      null,
      projection,
      accessedAt,
    );
    return projection;
  }

  getSnapshot(
    actor: M22Actor,
    caseId: string,
    accessedAt: string,
  ): M22CaseSnapshot {
    const item = this.getCase(actor, caseId, accessedAt);
    return {
      case: item,
      planVersions: this.repository.listPlans(caseId),
      dischargePlan: this.repository.getDischargePlan(caseId),
      discharge: this.repository.getDischarge(caseId),
      aftercare: this.repository.getAftercare(caseId),
      authorization: this.repository.getAuthorizationByCase(caseId),
      authorizationAlerts: this.repository.listAuthorizationAlerts(caseId),
      encounters: this.repository.listEncounters(caseId),
      billingDecisions: this.repository.listBillingDecisions(caseId),
      claimHandoffs: this.repository.listClaimHandoffs(caseId),
      auditEvents: this.repository.listAudit(caseId),
    };
  }
}
