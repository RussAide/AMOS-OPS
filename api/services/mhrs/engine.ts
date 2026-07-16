import {
  evaluateClinicalBillingReadiness,
  type ClinicalBillingEvaluationInput,
  type MhrsCategory,
  type MhrsServiceBasis,
} from "../../../contracts/regulatory/clinical";
import {
  M23_READ_ROLES,
  M23_SPECIALIST_ROLES,
  M23_SUPERVISOR_ROLES,
  assertAllM23Categories,
  isAllowedM23CategoryBasis,
  isAllowedM23PlanTransition,
  isAllowedM23SessionTransition,
  procedureForM23Basis,
} from "../../../contracts/mhrs/policy";
import type {
  M23Actor,
  M23AssessedNeed,
  M23AuditAction,
  M23AuditEvent,
  M23BarrierRecord,
  M23CareBridge,
  M23CaseDetail,
  M23ClaimHandoff,
  M23Dashboard,
  M23Goal,
  M23Intervention,
  M23OutcomeRecord,
  M23PlanState,
  M23PlanStateEvent,
  M23PlanVersion,
  M23ProgramCase,
  M23ProgressRecord,
  M23RepositorySnapshot,
  M23ReviewAlert,
  M23ReviewAlertEvent,
  M23ReviewAlertState,
  M23Role,
  M23Session,
  M23SessionState,
  M23SessionStateEvent,
} from "../../../contracts/mhrs/types";
import { addUtcDays, evaluateDeadline } from "../../../contracts/phase2";
import { M23MemoryRepository, type M23RepositoryPort } from "./repository";

export class M23DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "M23DomainError";
  }
}

export interface RegisterM23CaseInput {
  readonly subjectId: string;
  readonly subjectLabel: string;
  readonly ageYears: number;
  readonly assignedSpecialistId: string;
  readonly assignedSupervisorId: string;
  readonly careBridge: M23CareBridge;
}

export interface RecordM23NeedInput {
  readonly sourceDepartment: "CCMG" | "MHTCM" | "MHRS";
  readonly sourceType: "CANS" | "CCMG" | "MHTCM" | "MHRS";
  readonly sourceRecordId: string;
  readonly sourceVersion: number;
  readonly code: string;
  readonly statement: string;
  readonly baseline: number;
  readonly target: number;
}

export interface CreateM23PlanInput {
  readonly effectiveFrom: string;
  readonly effectiveThrough: string;
  readonly typeAmountDurationStatement: string;
}

export interface CreateM23GoalInput {
  readonly needId: string;
  readonly category: MhrsCategory;
  readonly statement: string;
  readonly measure: string;
  readonly targetValue: number;
}

export interface CreateM23InterventionInput {
  readonly goalId: string;
  readonly category: MhrsCategory;
  readonly serviceBasis: MhrsServiceBasis;
  readonly description: string;
  readonly amount: string;
  readonly duration: string;
  readonly frequency: string;
}

export interface DocumentM23SessionInput {
  readonly planVersionId: string;
  readonly goalId: string;
  readonly interventionId: string;
  readonly billingInput: ClinicalBillingEvaluationInput;
  readonly progressValue: number;
  readonly progressNarrative: string;
  readonly barrier: string;
  readonly barrierResponse: string;
  readonly outcome: string;
  readonly measuredValue: number;
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function isIsoTimestamp(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function currentState<T extends { readonly occurredAt: string }>(
  events: readonly T[],
  pick: (event: T) => M23PlanState | M23SessionState | M23ReviewAlertState,
): ReturnType<typeof pick> | null {
  const ordered = [...events].sort((left, right) => left.occurredAt.localeCompare(right.occurredAt));
  const latest = ordered[ordered.length - 1];
  return latest ? pick(latest) : null;
}

function nonBlank(value: string): boolean {
  return value.trim().length > 0;
}

function hasRole(actor: M23Actor, roles: readonly M23Role[]): boolean {
  return roles.includes(actor.role);
}

/**
 * Deterministic, append-only M2.3 synthetic-prototype domain engine.
 * Callers supply every timestamp; no clock, network, or production data is read.
 */
export class M23ProgramEngine {
  constructor(readonly repository: M23RepositoryPort = new M23MemoryRepository()) {}

  private audit(
    actor: M23Actor,
    action: M23AuditAction,
    caseId: string | null,
    entityType: string,
    entityId: string,
    reason: string,
    occurredAt: string,
    details: Readonly<Record<string, unknown>> = {},
  ): M23AuditEvent {
    const event: M23AuditEvent = {
      id: this.repository.nextId("M23-AUDIT"),
      caseId,
      action,
      entityType,
      entityId,
      actorId: actor.id,
      actorRole: actor.role,
      reason,
      correlationId: caseId ? `M23-CORR-${caseId}` : "M23-CORR-GLOBAL",
      evidenceClass: "synthetic_demo",
      occurredAt,
      details,
    };
    return this.repository.append("auditEvents", event) as M23AuditEvent;
  }

  private deny(actor: M23Actor, caseId: string | null, reason: string, at: string): never {
    this.audit(actor, "permission_denied", caseId, "authorization", caseId ?? "global", reason, at);
    throw new M23DomainError("M23_FORBIDDEN", reason);
  }

  private requireTimestamp(at: string): void {
    if (!isIsoTimestamp(at)) throw new M23DomainError("M23_INVALID_TIMESTAMP", `Invalid timestamp: ${at}`);
  }

  private requireRead(actor: M23Actor, at: string): void {
    if (!hasRole(actor, M23_READ_ROLES)) this.deny(actor, null, "MHRS read access is not granted to this role.", at);
  }

  private requireSpecialist(actor: M23Actor, programCase: M23ProgramCase, at: string): void {
    const isAssigned = hasRole(actor, M23_SPECIALIST_ROLES) && actor.id === programCase.assignedSpecialistId;
    if (!isAssigned && !hasRole(actor, M23_SUPERVISOR_ROLES)) {
      this.deny(actor, programCase.id, "Only the assigned MHRS specialist or an authorized supervisor may write this case.", at);
    }
  }

  private requireSupervisor(actor: M23Actor, caseId: string | null, at: string): void {
    if (!hasRole(actor, M23_SUPERVISOR_ROLES)) {
      this.deny(actor, caseId, "MHRS supervisor authority is required.", at);
    }
  }

  private getCaseOrThrow(caseId: string): M23ProgramCase {
    const programCase = this.repository.all("cases").find((candidate) => candidate.id === caseId);
    if (!programCase) throw new M23DomainError("M23_CASE_NOT_FOUND", `MHRS case ${caseId} was not found.`);
    return programCase;
  }

  private getPlanOrThrow(planVersionId: string): M23PlanVersion {
    const plan = this.repository.all("planVersions").find((candidate) => candidate.id === planVersionId);
    if (!plan) throw new M23DomainError("M23_PLAN_NOT_FOUND", `MHRS plan ${planVersionId} was not found.`);
    return plan;
  }

  private getSessionOrThrow(sessionId: string): M23Session {
    const session = this.repository.all("sessions").find((candidate) => candidate.id === sessionId);
    if (!session) throw new M23DomainError("M23_SESSION_NOT_FOUND", `MHRS session ${sessionId} was not found.`);
    return session;
  }

  planState(planVersionId: string): M23PlanState | null {
    return currentState(
      this.repository.all("planStateEvents").filter((event) => event.planVersionId === planVersionId),
      (event) => event.toState,
    ) as M23PlanState | null;
  }

  sessionState(sessionId: string): M23SessionState | null {
    return currentState(
      this.repository.all("sessionStateEvents").filter((event) => event.sessionId === sessionId),
      (event) => event.toState,
    ) as M23SessionState | null;
  }

  reviewAlertState(alertId: string): M23ReviewAlertState | null {
    return currentState(
      this.repository.all("reviewAlertEvents").filter((event) => event.alertId === alertId),
      (event) => event.toState,
    ) as M23ReviewAlertState | null;
  }

  registerCase(actor: M23Actor, input: RegisterM23CaseInput, at: string): M23ProgramCase {
    this.requireTimestamp(at);
    this.requireSupervisor(actor, null, at);
    if (!Number.isInteger(input.ageYears) || input.ageYears < 0 || input.ageYears > 120) {
      throw new M23DomainError("M23_INVALID_AGE", "Age must be an integer between 0 and 120.");
    }
    if (input.careBridge.ccmg.accessMode !== "read_only" || input.careBridge.cans.accessMode !== "read_only" || input.careBridge.mhtcm.accessMode !== "read_only") {
      throw new M23DomainError("M23_BRIDGE_WRITE_FORBIDDEN", "CCMG, CANS, and MHTCM bridges are read-only in MHRS.");
    }
    const id = this.repository.nextId("M23-CASE");
    const programCase: M23ProgramCase = {
      id,
      subjectId: input.subjectId,
      subjectLabel: input.subjectLabel,
      ageYears: input.ageYears,
      assignedSpecialistId: input.assignedSpecialistId,
      assignedSupervisorId: input.assignedSupervisorId,
      planSeriesId: `M23-PLAN-SERIES-${id}`,
      careBridge: input.careBridge,
      evidenceClass: "synthetic_demo",
      createdAt: at,
    };
    const saved = this.repository.append("cases", programCase) as M23ProgramCase;
    this.audit(actor, "case_registered", id, "program_case", id, "Synthetic MHRS case registered.", at, {
      bridges: ["CCMG:read_only", "CANS:read_only", "MHTCM:read_only"],
    });
    return saved;
  }

  recordNeed(actor: M23Actor, caseId: string, input: RecordM23NeedInput, at: string): M23AssessedNeed {
    this.requireTimestamp(at);
    const programCase = this.getCaseOrThrow(caseId);
    this.requireSpecialist(actor, programCase, at);
    if (!Number.isInteger(input.sourceVersion) || input.sourceVersion < 1) {
      throw new M23DomainError("M23_INVALID_SOURCE_VERSION", "Need source version must be a positive integer.");
    }
    const need: M23AssessedNeed = {
      id: this.repository.nextId("M23-NEED"),
      caseId,
      ...input,
      recordedBy: actor.id,
      recordedAt: at,
    };
    const saved = this.repository.append("needs", need) as M23AssessedNeed;
    this.audit(actor, "need_recorded", caseId, "assessed_need", saved.id, "Assessed need linked to its source record and version.", at, {
      sourceDepartment: input.sourceDepartment,
      sourceRecordId: input.sourceRecordId,
      sourceVersion: input.sourceVersion,
    });
    return saved;
  }

  createPlanVersion(actor: M23Actor, caseId: string, input: CreateM23PlanInput, at: string): M23PlanVersion {
    this.requireTimestamp(at);
    const programCase = this.getCaseOrThrow(caseId);
    this.requireSpecialist(actor, programCase, at);
    if (!isIsoDate(input.effectiveFrom) || !isIsoDate(input.effectiveThrough) || input.effectiveThrough < input.effectiveFrom) {
      throw new M23DomainError("M23_INVALID_PLAN_DATES", "Plan dates must be valid and effectiveThrough cannot precede effectiveFrom.");
    }
    if (!nonBlank(input.typeAmountDurationStatement)) {
      throw new M23DomainError("M23_PLAN_DETAIL_REQUIRED", "The MHRS plan must state service type, amount, and duration.");
    }
    const priorPlans = [...this.repository.all("planVersions")]
      .filter((plan) => plan.caseId === caseId)
      .sort((left, right) => left.version - right.version);
    const prior = priorPlans[priorPlans.length - 1] ?? null;
    const plan: M23PlanVersion = {
      id: this.repository.nextId("M23-PLAN"),
      caseId,
      seriesId: programCase.planSeriesId,
      version: (prior?.version ?? 0) + 1,
      priorVersionId: prior?.id ?? null,
      ...input,
      createdBy: actor.id,
      createdAt: at,
    };
    const saved = this.repository.append("planVersions", plan) as M23PlanVersion;
    const stateEvent: M23PlanStateEvent = {
      id: this.repository.nextId("M23-PLAN-STATE"),
      caseId,
      planVersionId: saved.id,
      fromState: null,
      toState: "draft",
      actorId: actor.id,
      reason: "New immutable plan version created.",
      occurredAt: at,
    };
    this.repository.append("planStateEvents", stateEvent);
    this.audit(actor, "plan_version_created", caseId, "plan_version", saved.id, stateEvent.reason, at, {
      version: saved.version,
      priorVersionId: saved.priorVersionId,
    });
    return saved;
  }

  addGoal(actor: M23Actor, planVersionId: string, input: CreateM23GoalInput, at: string): M23Goal {
    this.requireTimestamp(at);
    const plan = this.getPlanOrThrow(planVersionId);
    const programCase = this.getCaseOrThrow(plan.caseId);
    this.requireSpecialist(actor, programCase, at);
    if (this.planState(planVersionId) !== "draft") throw new M23DomainError("M23_PLAN_LOCKED", "Goals may only be added to a draft plan version.");
    const need = this.repository.all("needs").find((candidate) => candidate.id === input.needId && candidate.caseId === plan.caseId);
    if (!need) throw new M23DomainError("M23_NEED_NOT_FOUND", "Goal must link to a need on the same case.");
    const goal: M23Goal = {
      id: this.repository.nextId("M23-GOAL"),
      caseId: plan.caseId,
      planVersionId,
      ...input,
      createdBy: actor.id,
      createdAt: at,
    };
    const saved = this.repository.append("goals", goal) as M23Goal;
    this.audit(actor, "goal_linked", plan.caseId, "goal", saved.id, "Goal linked to assessed need and plan version.", at, {
      needId: saved.needId,
      category: saved.category,
    });
    return saved;
  }

  addIntervention(actor: M23Actor, planVersionId: string, input: CreateM23InterventionInput, at: string): M23Intervention {
    this.requireTimestamp(at);
    const plan = this.getPlanOrThrow(planVersionId);
    const programCase = this.getCaseOrThrow(plan.caseId);
    this.requireSpecialist(actor, programCase, at);
    if (this.planState(planVersionId) !== "draft") throw new M23DomainError("M23_PLAN_LOCKED", "Interventions may only be added to a draft plan version.");
    const goal = this.repository.all("goals").find((candidate) => candidate.id === input.goalId && candidate.planVersionId === planVersionId);
    if (!goal) throw new M23DomainError("M23_GOAL_NOT_FOUND", "Intervention must link to a goal on the same plan version.");
    if (goal.category !== input.category || !isAllowedM23CategoryBasis(input.category, input.serviceBasis)) {
      throw new M23DomainError("M23_CATEGORY_BASIS_MISMATCH", "Intervention category/basis must match its goal and the controlled MHRS taxonomy.");
    }
    for (const field of [input.description, input.amount, input.duration, input.frequency]) {
      if (!nonBlank(field)) throw new M23DomainError("M23_INTERVENTION_DETAIL_REQUIRED", "Intervention description, amount, duration, and frequency are required.");
    }
    const intervention: M23Intervention = {
      id: this.repository.nextId("M23-INTERVENTION"),
      caseId: plan.caseId,
      planVersionId,
      ...input,
      createdBy: actor.id,
      createdAt: at,
    };
    const saved = this.repository.append("interventions", intervention) as M23Intervention;
    this.audit(actor, "intervention_linked", plan.caseId, "intervention", saved.id, "Intervention linked to a goal and controlled service basis.", at, {
      goalId: saved.goalId,
      procedureCode: procedureForM23Basis(saved.serviceBasis),
    });
    return saved;
  }

  transitionPlan(actor: M23Actor, planVersionId: string, toState: M23PlanState, reason: string, at: string): M23PlanStateEvent {
    this.requireTimestamp(at);
    const plan = this.getPlanOrThrow(planVersionId);
    const programCase = this.getCaseOrThrow(plan.caseId);
    const fromState = this.planState(planVersionId);
    if (!fromState || !isAllowedM23PlanTransition(fromState, toState)) {
      throw new M23DomainError("M23_INVALID_PLAN_TRANSITION", `Plan transition ${fromState ?? "none"} -> ${toState} is not allowed.`);
    }
    if (toState === "under_review") this.requireSpecialist(actor, programCase, at);
    else this.requireSupervisor(actor, plan.caseId, at);
    if (toState === "under_review") {
      const goals = this.repository.all("goals").filter((goal) => goal.planVersionId === planVersionId);
      const interventions = this.repository.all("interventions").filter((item) => item.planVersionId === planVersionId);
      if (goals.length === 0 || interventions.length === 0 || goals.some((goal) => !interventions.some((item) => item.goalId === goal.id))) {
        throw new M23DomainError("M23_PLAN_LINEAGE_INCOMPLETE", "Every submitted plan requires at least one need-linked goal with an intervention.");
      }
    }
    const event: M23PlanStateEvent = {
      id: this.repository.nextId("M23-PLAN-STATE"),
      caseId: plan.caseId,
      planVersionId,
      fromState,
      toState,
      actorId: actor.id,
      reason,
      occurredAt: at,
    };
    const saved = this.repository.append("planStateEvents", event) as M23PlanStateEvent;
    this.audit(actor, "plan_state_changed", plan.caseId, "plan_version", planVersionId, reason, at, { fromState, toState });
    if (toState === "approved") {
      const alert: M23ReviewAlert = {
        id: this.repository.nextId("M23-REVIEW"),
        caseId: plan.caseId,
        planVersionId,
        assignedTo: programCase.assignedSupervisorId,
        dueAt: addUtcDays(`${plan.effectiveFrom}T00:00:00.000Z`, 90),
        createdAt: at,
      };
      this.repository.append("reviewAlerts", alert);
      this.repository.append("reviewAlertEvents", {
        id: this.repository.nextId("M23-REVIEW-STATE"),
        caseId: plan.caseId,
        alertId: alert.id,
        fromState: null,
        toState: "assigned",
        actorId: actor.id,
        reason: "90-day plan review assigned on approval.",
        occurredAt: at,
      } satisfies M23ReviewAlertEvent);
      this.audit(actor, "review_alert_assigned", plan.caseId, "review_alert", alert.id, "90-day plan review assigned on approval.", at, {
        assignedTo: alert.assignedTo,
        dueAt: alert.dueAt,
      });
    }
    return saved;
  }

  documentSession(actor: M23Actor, caseId: string, input: DocumentM23SessionInput, at: string): M23Session {
    this.requireTimestamp(at);
    const programCase = this.getCaseOrThrow(caseId);
    this.requireSpecialist(actor, programCase, at);
    const plan = this.getPlanOrThrow(input.planVersionId);
    const goal = this.repository.all("goals").find((candidate) => candidate.id === input.goalId);
    const intervention = this.repository.all("interventions").find((candidate) => candidate.id === input.interventionId);
    if (plan.caseId !== caseId || !goal || !intervention || goal.caseId !== caseId || intervention.caseId !== caseId || intervention.goalId !== goal.id) {
      throw new M23DomainError("M23_SESSION_LINEAGE_INVALID", "Session must link to one case, plan, goal, and intervention lineage.");
    }
    if (this.planState(plan.id) !== "approved") throw new M23DomainError("M23_PLAN_NOT_APPROVED", "Session documentation requires an approved plan version.");
    const encounter = input.billingInput.encounter;
    const expectedProcedure = procedureForM23Basis(intervention.serviceBasis);
    if (
      encounter.clientId !== programCase.subjectId ||
      encounter.ageYears !== programCase.ageYears ||
      encounter.program !== "MHRS" ||
      encounter.mhrsCategory !== intervention.category ||
      encounter.mhrsServiceBasis !== intervention.serviceBasis ||
      encounter.procedureCode !== expectedProcedure ||
      input.billingInput.provider.providerId !== programCase.assignedSpecialistId
    ) {
      throw new M23DomainError("M23_BILLING_CONTEXT_MISMATCH", "Billing evidence must match the stored case, assigned specialist, category, basis, and governed procedure.");
    }
    const billingEvaluation = evaluateClinicalBillingReadiness(input.billingInput);
    const session: M23Session = {
      id: this.repository.nextId("M23-SESSION"),
      caseId,
      planVersionId: plan.id,
      goalId: goal.id,
      interventionId: intervention.id,
      specialistId: programCase.assignedSpecialistId,
      category: intervention.category,
      serviceBasis: intervention.serviceBasis,
      credential: input.billingInput.provider.credential,
      billingInput: input.billingInput,
      billingEvaluation,
      documentedAt: at,
    };
    const saved = this.repository.append("sessions", session) as M23Session;
    this.repository.append("sessionStateEvents", {
      id: this.repository.nextId("M23-SESSION-STATE"),
      caseId,
      sessionId: saved.id,
      fromState: null,
      toState: "draft",
      actorId: actor.id,
      signature: null,
      reason: "Session note documented; signature is a separate immutable event.",
      occurredAt: at,
    } satisfies M23SessionStateEvent);
    const progress: M23ProgressRecord = {
      id: this.repository.nextId("M23-PROGRESS"),
      caseId,
      sessionId: saved.id,
      goalId: goal.id,
      progressValue: input.progressValue,
      narrative: input.progressNarrative,
      recordedAt: at,
    };
    const barrier: M23BarrierRecord = {
      id: this.repository.nextId("M23-BARRIER"),
      caseId,
      sessionId: saved.id,
      goalId: goal.id,
      barrier: input.barrier,
      response: input.barrierResponse,
      recordedAt: at,
    };
    const outcome: M23OutcomeRecord = {
      id: this.repository.nextId("M23-OUTCOME"),
      caseId,
      sessionId: saved.id,
      goalId: goal.id,
      outcome: input.outcome,
      measuredValue: input.measuredValue,
      recordedAt: at,
    };
    this.repository.append("progress", progress);
    this.repository.append("barriers", barrier);
    this.repository.append("outcomes", outcome);
    this.audit(actor, "session_documented", caseId, "session", saved.id, "Session and progress/barrier/outcome lineage recorded.", at, {
      billingReady: billingEvaluation.billingReady,
      reasonCodes: billingEvaluation.reasonCodes,
      planVersionId: plan.id,
      needId: goal.needId,
      goalId: goal.id,
      interventionId: intervention.id,
    });
    return saved;
  }

  signSession(actor: M23Actor, sessionId: string, signature: string, at: string): M23SessionStateEvent {
    this.requireTimestamp(at);
    const session = this.getSessionOrThrow(sessionId);
    const programCase = this.getCaseOrThrow(session.caseId);
    this.requireSpecialist(actor, programCase, at);
    const fromState = this.sessionState(sessionId);
    if (!fromState || !isAllowedM23SessionTransition(fromState, "signed")) {
      throw new M23DomainError("M23_INVALID_SESSION_TRANSITION", `Session ${sessionId} cannot transition from ${fromState ?? "none"} to signed.`);
    }
    if (!nonBlank(signature)) throw new M23DomainError("M23_SIGNATURE_REQUIRED", "A nonblank provider signature is required.");
    if (!nonBlank(session.billingInput.documentation.providerSignature ?? "")) {
      throw new M23DomainError("M23_NOTE_SIGNATURE_EVIDENCE_MISSING", "The immutable clinical note lacks provider-signature evidence.");
    }
    const event: M23SessionStateEvent = {
      id: this.repository.nextId("M23-SESSION-STATE"),
      caseId: session.caseId,
      sessionId,
      fromState,
      toState: "signed",
      actorId: actor.id,
      signature,
      reason: "Assigned MHRS specialist signed the immutable session note.",
      occurredAt: at,
    };
    const saved = this.repository.append("sessionStateEvents", event) as M23SessionStateEvent;
    this.audit(actor, "session_signed", session.caseId, "session", sessionId, event.reason, at, {
      credential: session.credential,
    });
    return saved;
  }

  evaluateReviewAlerts(actor: M23Actor, asOf: string): readonly M23ReviewAlert[] {
    this.requireTimestamp(asOf);
    this.requireSupervisor(actor, null, asOf);
    const escalated: M23ReviewAlert[] = [];
    for (const alert of this.repository.all("reviewAlerts")) {
      if (this.reviewAlertState(alert.id) === "assigned" && evaluateDeadline(alert.dueAt, asOf) === "overdue") {
        const event: M23ReviewAlertEvent = {
          id: this.repository.nextId("M23-REVIEW-STATE"),
          caseId: alert.caseId,
          alertId: alert.id,
          fromState: "assigned",
          toState: "escalated",
          actorId: actor.id,
          reason: "90-day plan review passed its due time and escalated fail-closed.",
          occurredAt: asOf,
        };
        this.repository.append("reviewAlertEvents", event);
        this.audit(actor, "review_alert_escalated", alert.caseId, "review_alert", alert.id, event.reason, asOf, {
          assignedTo: alert.assignedTo,
          dueAt: alert.dueAt,
        });
        escalated.push(alert);
      }
    }
    return escalated;
  }

  completeReview(actor: M23Actor, alertId: string, input: CreateM23PlanInput, at: string): M23PlanVersion {
    this.requireTimestamp(at);
    this.requireSupervisor(actor, null, at);
    const alert = this.repository.all("reviewAlerts").find((candidate) => candidate.id === alertId);
    if (!alert) throw new M23DomainError("M23_REVIEW_NOT_FOUND", `Review alert ${alertId} was not found.`);
    const alertState = this.reviewAlertState(alertId);
    if (alertState !== "assigned" && alertState !== "escalated") throw new M23DomainError("M23_REVIEW_ALREADY_COMPLETED", "Review alert is already completed.");
    const priorPlan = this.getPlanOrThrow(alert.planVersionId);
    const nextPlan = this.createPlanVersion(actor, priorPlan.caseId, input, at);
    const priorGoals = this.repository.all("goals").filter((goal) => goal.planVersionId === priorPlan.id);
    for (const priorGoal of priorGoals) {
      const nextGoal = this.addGoal(actor, nextPlan.id, {
        needId: priorGoal.needId,
        category: priorGoal.category,
        statement: priorGoal.statement,
        measure: priorGoal.measure,
        targetValue: priorGoal.targetValue,
      }, at);
      for (const priorIntervention of this.repository.all("interventions").filter((item) => item.goalId === priorGoal.id)) {
        this.addIntervention(actor, nextPlan.id, {
          goalId: nextGoal.id,
          category: priorIntervention.category,
          serviceBasis: priorIntervention.serviceBasis,
          description: priorIntervention.description,
          amount: priorIntervention.amount,
          duration: priorIntervention.duration,
          frequency: priorIntervention.frequency,
        }, at);
      }
    }
    this.transitionPlan(actor, nextPlan.id, "under_review", "90-day review version submitted.", at);
    this.transitionPlan(actor, nextPlan.id, "approved", "90-day review version approved by supervisor.", at);
    if (this.planState(priorPlan.id) === "approved") {
      this.transitionPlan(actor, priorPlan.id, "superseded", `Superseded by approved plan ${nextPlan.id}.`, at);
    }
    const event: M23ReviewAlertEvent = {
      id: this.repository.nextId("M23-REVIEW-STATE"),
      caseId: alert.caseId,
      alertId,
      fromState: alertState,
      toState: "completed",
      actorId: actor.id,
      reason: `Completed by immutable plan version ${nextPlan.version}.`,
      occurredAt: at,
    };
    this.repository.append("reviewAlertEvents", event);
    this.audit(actor, "review_completed", alert.caseId, "review_alert", alertId, event.reason, at, {
      priorPlanVersion: priorPlan.version,
      newPlanVersion: nextPlan.version,
      newPlanId: nextPlan.id,
    });
    return nextPlan;
  }

  requestClaimHandoff(actor: M23Actor, sessionId: string, at: string): M23ClaimHandoff {
    this.requireTimestamp(at);
    const session = this.getSessionOrThrow(sessionId);
    const programCase = this.getCaseOrThrow(session.caseId);
    this.requireSpecialist(actor, programCase, at);
    const reasonCodes = [...session.billingEvaluation.reasonCodes] as string[];
    if (this.planState(session.planVersionId) !== "approved") reasonCodes.push("M23_PLAN_NOT_APPROVED");
    if (this.sessionState(sessionId) !== "signed") reasonCodes.push("M23_SIGNATURE_MISSING");
    const uniqueReasons = [...new Set(reasonCodes)].sort();
    const handoff: M23ClaimHandoff = {
      id: this.repository.nextId("M23-CLAIM"),
      caseId: session.caseId,
      sessionId,
      state: uniqueReasons.length === 0 ? "ready_for_revenue" : "rejected",
      reasonCodes: uniqueReasons,
      requestedBy: actor.id,
      requestedAt: at,
      billingEvaluation: session.billingEvaluation,
    };
    const saved = this.repository.append("claimHandoffs", handoff) as M23ClaimHandoff;
    const ready = saved.state === "ready_for_revenue";
    this.audit(
      actor,
      ready ? "claim_handoff_ready" : "claim_handoff_rejected",
      session.caseId,
      "claim_handoff",
      saved.id,
      ready ? "All plan, authorization, credential, note, unit, and signature gates passed." : "Claim handoff rejected fail-closed.",
      at,
      { reasonCodes: saved.reasonCodes, sessionId },
    );
    return saved;
  }

  getCaseDetail(actor: M23Actor, caseId: string, at: string): M23CaseDetail {
    this.requireTimestamp(at);
    this.requireRead(actor, at);
    const programCase = this.getCaseOrThrow(caseId);
    if (actor.role === "therapist" && actor.id !== programCase.assignedSpecialistId) {
      this.deny(actor, caseId, "A therapist may only read their assigned MHRS case.", at);
    }
    this.audit(actor, "accessed", caseId, "program_case", caseId, "MHRS case detail accessed.", at);
    const plans = this.repository.all("planVersions").filter((item) => item.caseId === caseId).map((item) => ({ ...item, state: this.planState(item.id)! }));
    const sessions = this.repository.all("sessions").filter((item) => item.caseId === caseId).map((item) => ({ ...item, state: this.sessionState(item.id)! }));
    const reviewAlerts = this.repository.all("reviewAlerts").filter((item) => item.caseId === caseId).map((item) => ({ ...item, state: this.reviewAlertState(item.id)! }));
    return {
      programCase,
      needs: this.repository.all("needs").filter((item) => item.caseId === caseId),
      plans,
      goals: this.repository.all("goals").filter((item) => item.caseId === caseId),
      interventions: this.repository.all("interventions").filter((item) => item.caseId === caseId),
      sessions,
      progress: this.repository.all("progress").filter((item) => item.caseId === caseId),
      barriers: this.repository.all("barriers").filter((item) => item.caseId === caseId),
      outcomes: this.repository.all("outcomes").filter((item) => item.caseId === caseId),
      reviewAlerts,
      claimHandoffs: this.repository.all("claimHandoffs").filter((item) => item.caseId === caseId),
      auditEvents: this.repository.all("auditEvents").filter((item) => item.caseId === caseId),
    };
  }

  getDashboard(actor: M23Actor, asOf: string): M23Dashboard {
    this.requireTimestamp(asOf);
    this.requireRead(actor, asOf);
    const categoryCounts = Object.fromEntries(
      (["psychosocial_rehabilitation", "skills_training", "supportive_interventions", "community_integration"] as const)
        .map((category) => [category, this.repository.all("sessions").filter((session) => session.category === category).length]),
    ) as Record<MhrsCategory, number>;
    const reviewStates: M23ReviewAlertState[] = this.repository.all("reviewAlerts").map((alert) => this.reviewAlertState(alert.id)!).filter(Boolean);
    const dashboard: M23Dashboard = {
      asOf,
      cases: this.repository.all("cases").length,
      approvedPlans: this.repository.all("planVersions").filter((plan) => this.planState(plan.id) === "approved").length,
      categoryCounts,
      signedSessions: this.repository.all("sessions").filter((session) => this.sessionState(session.id) === "signed").length,
      billingReadySessions: this.repository.all("sessions").filter((session) => session.billingEvaluation.billingReady).length,
      rejectedClaimHandoffs: this.repository.all("claimHandoffs").filter((handoff) => handoff.state === "rejected").length,
      reviewAlerts: {
        assigned: reviewStates.filter((state) => state === "assigned").length,
        escalated: reviewStates.filter((state) => state === "escalated").length,
        completed: reviewStates.filter((state) => state === "completed").length,
      },
      auditEvents: this.repository.all("auditEvents").length,
    };
    this.audit(actor, "accessed", null, "dashboard", "M23-DASHBOARD", "MHRS oversight dashboard accessed.", asOf, {
      allCategoriesRepresented: assertAllM23Categories(Object.entries(categoryCounts).filter(([, count]) => count > 0).map(([category]) => category as MhrsCategory)),
    });
    return dashboard;
  }

  snapshot(): M23RepositorySnapshot {
    return this.repository.snapshot();
  }
}
