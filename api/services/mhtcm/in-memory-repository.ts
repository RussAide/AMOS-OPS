import type {
  M22Aftercare,
  M22AuditEvent,
  M22Authorization,
  M22AuthorizationAlert,
  M22BillingDecision,
  M22Case,
  M22ClaimHandoff,
  M22Discharge,
  M22DischargePlan,
  M22Encounter,
  M22PlanVersion,
} from "@contracts/mhtcm";

function clone<T>(value: T): T {
  return structuredClone(value);
}

export interface M22Repository {
  nextSequence(): number;
  getCase(id: string): M22Case | null;
  putCase(value: M22Case): void;
  listCases(): readonly M22Case[];
  appendPlan(value: M22PlanVersion): void;
  listPlans(caseId: string): readonly M22PlanVersion[];
  putDischargePlan(value: M22DischargePlan): void;
  getDischargePlan(caseId: string): M22DischargePlan | null;
  putDischarge(value: M22Discharge): void;
  getDischarge(caseId: string): M22Discharge | null;
  putAftercare(value: M22Aftercare): void;
  getAftercare(caseId: string): M22Aftercare | null;
  putAuthorization(value: M22Authorization): void;
  getAuthorizationByCase(caseId: string): M22Authorization | null;
  putAuthorizationAlert(value: M22AuthorizationAlert): void;
  listAuthorizationAlerts(caseId?: string): readonly M22AuthorizationAlert[];
  putEncounter(value: M22Encounter): void;
  getEncounter(id: string): M22Encounter | null;
  listEncounters(caseId: string): readonly M22Encounter[];
  appendBillingDecision(value: M22BillingDecision): void;
  listBillingDecisions(caseId: string): readonly M22BillingDecision[];
  appendClaimHandoff(value: M22ClaimHandoff): void;
  listClaimHandoffs(caseId: string): readonly M22ClaimHandoff[];
  appendAudit(value: M22AuditEvent): void;
  listAudit(caseId: string): readonly M22AuditEvent[];
}

export class InMemoryM22Repository implements M22Repository {
  private sequence = 0;
  private readonly cases = new Map<string, M22Case>();
  private readonly plans: M22PlanVersion[] = [];
  private readonly dischargePlans = new Map<string, M22DischargePlan>();
  private readonly discharges = new Map<string, M22Discharge>();
  private readonly aftercare = new Map<string, M22Aftercare>();
  private readonly authorizations = new Map<string, M22Authorization>();
  private readonly authorizationAlerts = new Map<
    string,
    M22AuthorizationAlert
  >();
  private readonly encounters = new Map<string, M22Encounter>();
  private readonly billingDecisions: M22BillingDecision[] = [];
  private readonly claimHandoffs: M22ClaimHandoff[] = [];
  private readonly auditEvents: M22AuditEvent[] = [];

  nextSequence(): number {
    this.sequence += 1;
    return this.sequence;
  }

  getCase(id: string): M22Case | null {
    const value = this.cases.get(id);
    return value ? clone(value) : null;
  }

  putCase(value: M22Case): void {
    this.cases.set(value.id, clone(value));
  }

  listCases(): readonly M22Case[] {
    return [...this.cases.values()].map(clone);
  }

  appendPlan(value: M22PlanVersion): void {
    if (
      this.plans.some(
        (item) =>
          item.planId === value.planId && item.version === value.version,
      )
    ) {
      throw new Error(
        `Duplicate immutable plan version ${value.planId} v${value.version}.`,
      );
    }
    this.plans.push(clone(value));
  }

  listPlans(caseId: string): readonly M22PlanVersion[] {
    return this.plans
      .filter((item) => item.caseId === caseId)
      .sort((left, right) => left.version - right.version)
      .map(clone);
  }

  putDischargePlan(value: M22DischargePlan): void {
    this.dischargePlans.set(value.caseId, clone(value));
  }

  getDischargePlan(caseId: string): M22DischargePlan | null {
    const value = this.dischargePlans.get(caseId);
    return value ? clone(value) : null;
  }

  putDischarge(value: M22Discharge): void {
    this.discharges.set(value.caseId, clone(value));
  }

  getDischarge(caseId: string): M22Discharge | null {
    const value = this.discharges.get(caseId);
    return value ? clone(value) : null;
  }

  putAftercare(value: M22Aftercare): void {
    this.aftercare.set(value.caseId, clone(value));
  }

  getAftercare(caseId: string): M22Aftercare | null {
    const value = this.aftercare.get(caseId);
    return value ? clone(value) : null;
  }

  putAuthorization(value: M22Authorization): void {
    this.authorizations.set(value.id, clone(value));
  }

  getAuthorizationByCase(caseId: string): M22Authorization | null {
    const value = [...this.authorizations.values()].find(
      (item) => item.caseId === caseId,
    );
    return value ? clone(value) : null;
  }

  putAuthorizationAlert(value: M22AuthorizationAlert): void {
    this.authorizationAlerts.set(value.id, clone(value));
  }

  listAuthorizationAlerts(caseId?: string): readonly M22AuthorizationAlert[] {
    return [...this.authorizationAlerts.values()]
      .filter((item) => !caseId || item.caseId === caseId)
      .sort((left, right) =>
        left.renewalDueOn.localeCompare(right.renewalDueOn),
      )
      .map(clone);
  }

  putEncounter(value: M22Encounter): void {
    this.encounters.set(value.id, clone(value));
  }

  getEncounter(id: string): M22Encounter | null {
    const value = this.encounters.get(id);
    return value ? clone(value) : null;
  }

  listEncounters(caseId: string): readonly M22Encounter[] {
    return [...this.encounters.values()]
      .filter((item) => item.caseId === caseId)
      .sort((left, right) => left.serviceDate.localeCompare(right.serviceDate))
      .map(clone);
  }

  appendBillingDecision(value: M22BillingDecision): void {
    this.billingDecisions.push(clone(value));
  }

  listBillingDecisions(caseId: string): readonly M22BillingDecision[] {
    return this.billingDecisions
      .filter((item) => item.caseId === caseId)
      .map(clone);
  }

  appendClaimHandoff(value: M22ClaimHandoff): void {
    this.claimHandoffs.push(clone(value));
  }

  listClaimHandoffs(caseId: string): readonly M22ClaimHandoff[] {
    return this.claimHandoffs
      .filter((item) => item.caseId === caseId)
      .map(clone);
  }

  appendAudit(value: M22AuditEvent): void {
    this.auditEvents.push(clone(value));
  }

  listAudit(caseId: string): readonly M22AuditEvent[] {
    return this.auditEvents.filter((item) => item.caseId === caseId).map(clone);
  }
}
