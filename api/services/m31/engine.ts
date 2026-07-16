import {
  assertPhase3Synthetic,
  changedPhase3Fields,
  type Phase3AuditAction,
  type Phase3AuditEvent,
} from "@contracts/phase3/shared";
import type {
  M31AlertWindow,
  M31AuditCategory,
  M31AuditFinding,
  M31AuditTemplate,
  M31ComplianceAlert,
  M31ComplianceCalendarEvent,
  M31CorrectiveActionPlan,
  M31Division,
  M31FindingRoute,
  M31FindingSeverity,
  M31MockSurvey,
  M31RiskView,
  M31Snapshot,
  M31SyntheticWriteRequest,
} from "@contracts/phase3/m31";
import { ROLE_TIER_BY_ROLE, type RoleTier } from "@/constants/access-control";
import { ALL_ROLES, type UserRole } from "@/constants/roles";

export const M31_FIXED_AS_OF = "2026-10-13T12:00:00.000Z";
export const M31_SCENARIO_CORRELATION_ID = "SYNTH-PHASE3-SUPPORT-001";

const ROUTE_POLICY: Readonly<Record<M31FindingSeverity, { dueDays: number }>> =
  {
    low: { dueDays: 30 },
    moderate: { dueDays: 14 },
    high: { dueDays: 7 },
    critical: { dueDays: 1 },
  };

const RESPONSIBLE_ROLE: Readonly<Record<M31Division, UserRole>> = {
  BHC: "chart-auditor",
  GRO: "shift-supervisor",
  EO: "hr-compliance-officer",
  GAD: "facilities-manager",
};

/** Canonical escalation moves from the operating owner toward division and enterprise authority. */
const ESCALATION_PATH: Readonly<Record<M31Division, readonly UserRole[]>> = {
  BHC: ["clinical-supervisor", "bhc-director", "managing-director"],
  GRO: ["program-director", "managing-director"],
  EO: ["hr-director", "managing-director"],
  GAD: ["administrator"],
};

const CANONICAL_ROLES = new Set<UserRole>(ALL_ROLES);
const TIER_RANK: Readonly<Record<RoleTier, number>> = {
  T1: 1,
  T2: 2,
  T3: 3,
  T4: 4,
};

export function assertM31CanonicalHumanRole(
  role: string,
): asserts role is UserRole {
  if (!CANONICAL_ROLES.has(role as UserRole)) {
    throw new Error(`M31_NONCANONICAL_ROLE:${role}`);
  }
}

function assertM31EscalationSemantics(
  responsibleRole: UserRole,
  escalationPath: readonly UserRole[],
): void {
  let precedingRank = TIER_RANK[ROLE_TIER_BY_ROLE[responsibleRole]];
  for (const role of escalationPath) {
    assertM31CanonicalHumanRole(role);
    const rank = TIER_RANK[ROLE_TIER_BY_ROLE[role]];
    if (rank >= precedingRank) {
      throw new Error("M31_INVALID_ESCALATION_TIER_ORDER");
    }
    precedingRank = rank;
  }
  const terminalRole =
    escalationPath[escalationPath.length - 1] ?? responsibleRole;
  if (ROLE_TIER_BY_ROLE[terminalRole] !== "T1") {
    throw new Error("M31_ESCALATION_MUST_REACH_ENTERPRISE_AUTHORITY");
  }
}

function addUtcDays(value: string, days: number): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("M31_INVALID_TIMESTAMP");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString();
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>))
      deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function assertM31SyntheticWrite(
  request: M31SyntheticWriteRequest,
): void {
  if (
    request.environment !== "evaluation" ||
    request.evidenceClass !== "synthetic_demo" ||
    !request.entityId.startsWith("SYNTH-")
  ) {
    throw new Error("M31_PRODUCTION_WRITE_BLOCKED");
  }
}

export function routeM31Finding(
  division: M31Division,
  severity: M31FindingSeverity,
  routedAt: string,
): M31FindingRoute {
  const policy = ROUTE_POLICY[severity];
  const responsibleRole = RESPONSIBLE_ROLE[division];
  const escalationPath = ESCALATION_PATH[division];
  assertM31CanonicalHumanRole(responsibleRole);
  assertM31EscalationSemantics(responsibleRole, escalationPath);
  return {
    division,
    severity,
    responsibleRole,
    responsibleTier: ROLE_TIER_BY_ROLE[responsibleRole],
    dueAt: addUtcDays(routedAt, policy.dueDays),
    escalationPath,
    escalationTiers: escalationPath.map((role) => ROLE_TIER_BY_ROLE[role]),
  };
}

function buildCalendar(): {
  calendarEvents: readonly M31ComplianceCalendarEvent[];
  alerts: readonly M31ComplianceAlert[];
} {
  const calendarEventId = "SYNTH-M31-CALENDAR-LICENSE-001";
  const alert = (
    windowDays: M31AlertWindow,
    status: M31ComplianceAlert["status"],
    triggeredAt: string,
    details: Partial<M31ComplianceAlert>,
  ): M31ComplianceAlert => ({
    id: `SYNTH-M31-ALERT-${windowDays}-001`,
    calendarEventId,
    windowDays,
    status,
    assignedRole: "hr-compliance-officer",
    assignedTo: "SYNTH-STAFF-COMPLIANCE-001",
    triggeredAt,
    closureEvidenceIds: [],
    evidenceClass: "synthetic_demo",
    ...details,
  });

  const alerts = deepFreeze([
    alert(90, "acknowledged", "2026-07-14T09:00:00.000Z", {
      acknowledgedAt: "2026-07-14T10:00:00.000Z",
    }),
    alert(60, "escalated", "2026-08-13T09:00:00.000Z", {
      acknowledgedAt: "2026-08-14T09:00:00.000Z",
      escalatedAt: "2026-08-15T09:00:00.000Z",
      escalationRole: "managing-director",
    }),
    alert(30, "closed", "2026-09-12T09:00:00.000Z", {
      acknowledgedAt: "2026-09-12T09:30:00.000Z",
      closedAt: "2026-09-30T16:00:00.000Z",
      closureEvidenceIds: ["SYNTH-EVIDENCE-LICENSE-RENEWAL-001"],
    }),
  ] satisfies M31ComplianceAlert[]);

  const calendarEvents = deepFreeze([
    {
      id: calendarEventId,
      title: "Behavioral health facility license renewal",
      division: "BHC",
      controlOwnerRole: "hr-compliance-officer",
      dueAt: "2026-10-12T09:00:00.000Z",
      alertIds: alerts.map((item) => item.id),
      status: "closed",
      closedAt: "2026-09-30T16:00:00.000Z",
      closureEvidenceIds: ["SYNTH-EVIDENCE-LICENSE-RENEWAL-001"],
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M31-CALENDAR-PRIVACY-002",
      title: "Quarterly privacy access review",
      division: "EO",
      controlOwnerRole: "hr-compliance-officer",
      dueAt: "2026-10-01T17:00:00.000Z",
      alertIds: [],
      status: "open",
      closureEvidenceIds: [],
      evidenceClass: "synthetic_demo",
    },
  ] satisfies M31ComplianceCalendarEvent[]);

  return { calendarEvents, alerts };
}

function buildAuditTemplates(): readonly M31AuditTemplate[] {
  const labels: Readonly<Record<M31AuditCategory, string>> = {
    chart: "Clinical chart audit",
    personnel: "Personnel record audit",
    facility: "Facility readiness audit",
    billing: "Billing integrity audit",
    privacy: "Privacy access audit",
    operational: "Operational control audit",
  };
  const owners: Readonly<Record<M31AuditCategory, UserRole>> = {
    chart: "chart-auditor",
    personnel: "hr-compliance-officer",
    facility: "facilities-manager",
    billing: "revenue-cycle-manager",
    privacy: "hr-compliance-officer",
    operational: "administrator",
  };

  return deepFreeze(
    (Object.keys(labels) as M31AuditCategory[]).map((category, index) => ({
      id: `SYNTH-M31-TEMPLATE-${category.toUpperCase()}-001`,
      category,
      name: labels[category],
      version: 1,
      configurable: true,
      controlOwnerRole: owners[category],
      controls: [
        {
          id: `SYNTH-M31-CONTROL-${category.toUpperCase()}-${index + 1}A`,
          prompt: `${labels[category]} required control is satisfied`,
          responseType: "yes_no",
          required: true,
        },
        {
          id: `SYNTH-M31-CONTROL-${category.toUpperCase()}-${index + 1}B`,
          prompt: `${labels[category]} evidence is attached`,
          responseType: "evidence",
          required: true,
        },
      ],
      activeFrom: "2026-07-14",
      evidenceClass: "synthetic_demo",
    })),
  );
}

function buildFindings(): readonly M31AuditFinding[] {
  const routedAt = "2026-07-14T12:00:00.000Z";
  const definitions = [
    {
      id: "SYNTH-M31-FINDING-CHART-001",
      auditId: "SYNTH-M31-AUDIT-CHART-001",
      templateId: "SYNTH-M31-TEMPLATE-CHART-001",
      controlId: "SYNTH-M31-CONTROL-CHART-1A",
      summary:
        "Progress note signature timing exceeded the controlled interval.",
      repeatCount: 2,
      status: "closed" as const,
      capId: "SYNTH-M31-CAP-001",
      ...routeM31Finding("BHC", "high", routedAt),
    },
    {
      id: "SYNTH-M31-FINDING-PRIVACY-002",
      auditId: "SYNTH-M31-AUDIT-PRIVACY-002",
      templateId: "SYNTH-M31-TEMPLATE-PRIVACY-001",
      controlId: "SYNTH-M31-CONTROL-PRIVACY-5A",
      summary: "Quarterly privileged-access review remains incomplete.",
      repeatCount: 3,
      status: "in_remediation" as const,
      capId: "SYNTH-M31-CAP-002",
      ...routeM31Finding("EO", "critical", routedAt),
    },
    {
      id: "SYNTH-M31-FINDING-FACILITY-003",
      auditId: "SYNTH-M31-AUDIT-FACILITY-003",
      templateId: "SYNTH-M31-TEMPLATE-FACILITY-001",
      controlId: "SYNTH-M31-CONTROL-FACILITY-3A",
      summary:
        "One emergency-light inspection record lacked supervisor verification.",
      repeatCount: 1,
      status: "open" as const,
      ...routeM31Finding("GAD", "moderate", routedAt),
    },
  ];
  return deepFreeze(
    definitions.map((finding) => ({
      ...finding,
      evidenceClass: "synthetic_demo" as const,
    })),
  );
}

function buildCaps(): readonly M31CorrectiveActionPlan[] {
  return deepFreeze([
    {
      id: "SYNTH-M31-CAP-001",
      findingId: "SYNTH-M31-FINDING-CHART-001",
      ownerId: "SYNTH-STAFF-BHC-QA-001",
      ownerRole: "clinical-supervisor",
      status: "closed",
      rootCauseMethod: "five_whys",
      rootCause:
        "A legacy note queue omitted the signature-age escalation rule.",
      tasks: [
        {
          id: "SYNTH-M31-CAP-TASK-001",
          title: "Enable signature-age escalation and retrain reviewers",
          assignedRole: "clinical-supervisor",
          dueAt: "2026-07-21T17:00:00.000Z",
          status: "completed",
          completedAt: "2026-07-20T15:00:00.000Z",
          evidenceIds: [
            "SYNTH-EVIDENCE-CAP-CONFIG-001",
            "SYNTH-EVIDENCE-CAP-TRAINING-002",
          ],
        },
      ],
      evidenceIds: [
        "SYNTH-EVIDENCE-CAP-CONFIG-001",
        "SYNTH-EVIDENCE-CAP-TRAINING-002",
      ],
      verification: {
        actorId: "SYNTH-STAFF-CHART-AUDITOR-002",
        actorRole: "chart-auditor",
        outcome: "verified",
        reason:
          "A ten-record resample showed timely signatures and preserved escalation evidence.",
        occurredAt: "2026-08-01T15:00:00.000Z",
      },
      effectivenessReview: {
        actorId: "SYNTH-STAFF-COMPLIANCE-001",
        actorRole: "hr-compliance-officer",
        outcome: "effective",
        reason: "Thirty-day monitoring found no recurrence.",
        occurredAt: "2026-08-31T15:00:00.000Z",
      },
      closureApproval: {
        actorId: "SYNTH-MANAGING-DIRECTOR-001",
        actorRole: "managing-director",
        outcome: "approved",
        reason:
          "Independent verification and effectiveness evidence satisfy closure policy.",
        occurredAt: "2026-09-01T15:00:00.000Z",
      },
      closedAt: "2026-09-01T15:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M31-CAP-002",
      findingId: "SYNTH-M31-FINDING-PRIVACY-002",
      ownerId: "SYNTH-STAFF-PRIVACY-001",
      ownerRole: "hr-compliance-officer",
      status: "tasks_in_progress",
      rootCauseMethod: "fishbone",
      rootCause:
        "Access-review ownership was not synchronized after a role reassignment.",
      tasks: [
        {
          id: "SYNTH-M31-CAP-TASK-002",
          title: "Reconcile privileged-role ownership",
          assignedRole: "hr-compliance-officer",
          dueAt: "2026-10-15T17:00:00.000Z",
          status: "completed",
          completedAt: "2026-10-12T16:00:00.000Z",
          evidenceIds: ["SYNTH-EVIDENCE-ACCESS-RECON-003"],
        },
      ],
      evidenceIds: ["SYNTH-EVIDENCE-ACCESS-RECON-003"],
      evidenceClass: "synthetic_demo",
    },
  ] satisfies M31CorrectiveActionPlan[]);
}

function buildMockSurvey(): readonly M31MockSurvey[] {
  return deepFreeze([
    {
      id: "SYNTH-M31-SURVEY-001",
      division: "BHC",
      authority: "Synthetic behavioral-health readiness protocol v1",
      status: "completed",
      plannedAt: "2026-07-14T13:00:00.000Z",
      startedAt: "2026-09-08T09:00:00.000Z",
      completedAt: "2026-09-10T16:00:00.000Z",
      evidenceRequests: [
        {
          id: "SYNTH-M31-SURVEY-REQUEST-001",
          description: "Provide current policy register and closure evidence.",
          assignedRole: "hr-compliance-officer",
          dueAt: "2026-09-05T17:00:00.000Z",
          status: "fulfilled",
          evidenceIds: ["SYNTH-EVIDENCE-POLICY-REGISTER-004"],
        },
      ],
      interviews: [
        {
          id: "SYNTH-M31-INTERVIEW-001",
          participantRole: "bhc-director",
          scheduledAt: "2026-09-09T10:00:00.000Z",
          completedAt: "2026-09-09T10:45:00.000Z",
          evidenceId: "SYNTH-EVIDENCE-INTERVIEW-005",
        },
      ],
      samples: [
        {
          id: "SYNTH-M31-SAMPLE-001",
          population: "Synthetic BHC clinical charts",
          sampleSize: 3,
          selectedRecordIds: [
            "SYNTH-CHART-001",
            "SYNTH-CHART-004",
            "SYNTH-CHART-007",
          ],
          selectionMethod: "deterministic_stratified",
        },
      ],
      deficiencyFindingIds: ["SYNTH-M31-FINDING-CHART-001"],
      readinessScore: 94,
      readinessBand: "ready",
      reportEvidenceId: "SYNTH-EVIDENCE-SURVEY-REPORT-006",
      evidenceClass: "synthetic_demo",
    },
  ] satisfies M31MockSurvey[]);
}

export function deriveM31RiskViews(
  calendarEvents: readonly M31ComplianceCalendarEvent[],
  findings: readonly M31AuditFinding[],
  caps: readonly M31CorrectiveActionPlan[],
  asOf: string,
): readonly M31RiskView[] {
  const scopes: readonly (M31Division | "enterprise")[] = [
    "enterprise",
    "BHC",
    "GRO",
    "EO",
    "GAD",
  ];
  const priorRiskScore: Readonly<Record<M31Division | "enterprise", number>> = {
    enterprise: 100,
    BHC: 20,
    GRO: 0,
    EO: 60,
    GAD: 0,
  };
  return deepFreeze(
    scopes.map((scope) => {
      const scopedFindings =
        scope === "enterprise"
          ? findings
          : findings.filter((item) => item.division === scope);
      const scopedEventIds = new Set(
        (scope === "enterprise"
          ? calendarEvents
          : calendarEvents.filter((item) => item.division === scope)
        ).map((item) => item.id),
      );
      const scopedFindingIds = new Set(scopedFindings.map((item) => item.id));
      const overdueControls = calendarEvents.filter(
        (item) =>
          scopedEventIds.has(item.id) &&
          item.status === "open" &&
          item.dueAt < asOf,
      ).length;
      const repeatFindings = scopedFindings.filter(
        (item) => item.repeatCount > 1,
      ).length;
      const openCaps = caps.filter(
        (item) =>
          scopedFindingIds.has(item.findingId) && item.status !== "closed",
      ).length;
      const riskScore = Math.min(
        100,
        overdueControls * 30 + repeatFindings * 20 + openCaps * 25,
      );
      const priorScore = priorRiskScore[scope];
      return {
        scope:
          scope === "enterprise"
            ? ("enterprise" as const)
            : ("division" as const),
        ...(scope === "enterprise" ? {} : { division: scope }),
        asOf,
        overdueControls,
        repeatFindings,
        openCaps,
        priorRiskScore: priorScore,
        riskTrend:
          riskScore < priorScore
            ? ("improving" as const)
            : riskScore > priorScore
              ? ("increasing" as const)
              : ("stable" as const),
        riskScore,
        sourceRecordIds: [
          `SYNTH-M31-RISK-BASELINE-${scope.toUpperCase()}`,
          ...calendarEvents
            .filter((item) => scopedEventIds.has(item.id))
            .map((item) => item.id),
          ...scopedFindings.map((item) => item.id),
          ...caps
            .filter((item) => scopedFindingIds.has(item.findingId))
            .map((item) => item.id),
        ],
      };
    }),
  );
}

function assertM31SnapshotRoles(snapshot: M31Snapshot): void {
  const roles: string[] = [
    ...snapshot.calendarEvents.map((item) => item.controlOwnerRole),
    ...snapshot.alerts.flatMap((item) => [
      item.assignedRole,
      ...(item.escalationRole ? [item.escalationRole] : []),
    ]),
    ...snapshot.auditTemplates.map((item) => item.controlOwnerRole),
    ...snapshot.findings.flatMap((item) => [
      item.responsibleRole,
      ...item.escalationPath,
    ]),
    ...snapshot.correctiveActionPlans.flatMap((item) => [
      item.ownerRole,
      ...item.tasks.map((task) => task.assignedRole),
      ...[item.verification, item.effectivenessReview, item.closureApproval]
        .filter((record): record is NonNullable<typeof record> =>
          Boolean(record),
        )
        .map((record) => record.actorRole),
    ]),
    ...snapshot.mockSurveys.flatMap((item) => [
      ...item.evidenceRequests.map((request) => request.assignedRole),
      ...item.interviews.map((interview) => interview.participantRole),
    ]),
  ];
  roles.forEach(assertM31CanonicalHumanRole);
  snapshot.findings.forEach((finding) =>
    assertM31EscalationSemantics(
      finding.responsibleRole,
      finding.escalationPath,
    ),
  );
}

function auditEvent(
  id: string,
  action: Phase3AuditAction,
  entityType: string,
  entityId: string,
  actorId: string,
  actorRole: UserRole | "system",
  reason: string,
  occurredAt: string,
  before?: Readonly<Record<string, unknown>>,
  after?: Readonly<Record<string, unknown>>,
): Phase3AuditEvent {
  return deepFreeze({
    id,
    domain: "COMPLIANCE",
    action,
    entityType,
    entityId,
    actorId,
    actorRole,
    reason,
    correlationId: M31_SCENARIO_CORRELATION_ID,
    before,
    after,
    changedFields: changedPhase3Fields(before, after),
    evidenceClass: "synthetic_demo",
    occurredAt,
  });
}

export function buildM31AuditLedger(): readonly Phase3AuditEvent[] {
  return deepFreeze([
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-ACCESS",
      "access",
      "clinical_chart",
      "SYNTH-CHART-001",
      "SYNTH-STAFF-CHART-AUDITOR-002",
      "chart-auditor",
      "Authorized chart sample access for mock survey.",
      "2026-09-08T09:05:00.000Z",
    ),
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-CHANGE",
      "change",
      "corrective_action_plan",
      "SYNTH-M31-CAP-001",
      "SYNTH-STAFF-BHC-QA-001",
      "clinical-supervisor",
      "Documented root cause and remediation tasks.",
      "2026-07-15T09:00:00.000Z",
      { status: "draft" },
      { status: "tasks_in_progress" },
    ),
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-APPROVAL",
      "approval",
      "corrective_action_plan",
      "SYNTH-M31-CAP-001",
      "SYNTH-MANAGING-DIRECTOR-001",
      "managing-director",
      "Approved CAP closure after independent effectiveness review.",
      "2026-09-01T15:00:00.000Z",
      { status: "effectiveness_review" },
      { status: "closed" },
    ),
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-DISCLOSURE",
      "disclosure",
      "survey_evidence_package",
      "SYNTH-M31-SURVEY-001",
      "SYNTH-STAFF-COMPLIANCE-001",
      "hr-compliance-officer",
      "Released synthetic evidence package to the authorized mock-survey team.",
      "2026-09-08T09:15:00.000Z",
    ),
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-EXPORT",
      "export",
      "readiness_report",
      "SYNTH-EVIDENCE-SURVEY-REPORT-006",
      "SYNTH-STAFF-COMPLIANCE-001",
      "hr-compliance-officer",
      "Exported visibly synthetic readiness report.",
      "2026-09-10T16:05:00.000Z",
    ),
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-ADMIN",
      "administrative_action",
      "audit_template",
      "SYNTH-M31-TEMPLATE-CHART-001",
      "SYNTH-STAFF-COMPLIANCE-001",
      "hr-compliance-officer",
      "Activated controlled chart-audit template version 1.",
      "2026-07-14T13:00:00.000Z",
      { active: false },
      { active: true, version: 1 },
    ),
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-ROUTING",
      "routing",
      "audit_finding",
      "SYNTH-M31-FINDING-PRIVACY-002",
      "SYNTH-SYSTEM-ROUTER",
      "system",
      "Routed critical privacy finding to the controlled escalation path.",
      "2026-07-14T12:00:00.000Z",
    ),
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-GATE",
      "gate_decision",
      "corrective_action_plan",
      "SYNTH-M31-CAP-001",
      "SYNTH-STAFF-COMPLIANCE-001",
      "hr-compliance-officer",
      "Effectiveness gate passed with thirty-day recurrence monitoring.",
      "2026-08-31T15:00:00.000Z",
    ),
    auditEvent(
      "SYNTH-M31-AUDIT-EVENT-SCENARIO",
      "scenario",
      "m31_synthetic_suite",
      "SYNTH-M31-SUITE-001",
      "SYNTH-SYSTEM-SCENARIO",
      "system",
      "Executed deterministic M3.1 acceptance scenario.",
      M31_FIXED_AS_OF,
    ),
  ]);
}

export function buildM31SyntheticSnapshot(): M31Snapshot {
  const { calendarEvents, alerts } = buildCalendar();
  const auditTemplates = buildAuditTemplates();
  const findings = buildFindings();
  const correctiveActionPlans = buildCaps();
  const mockSurveys = buildMockSurvey();
  const riskViews = deriveM31RiskViews(
    calendarEvents,
    findings,
    correctiveActionPlans,
    M31_FIXED_AS_OF,
  );

  for (const item of [
    ...calendarEvents,
    ...alerts,
    ...auditTemplates,
    ...findings,
    ...correctiveActionPlans,
    ...mockSurveys,
  ]) {
    assertPhase3Synthetic(item);
  }
  assertM31SyntheticWrite({
    environment: "evaluation",
    evidenceClass: "synthetic_demo",
    entityId: "SYNTH-M31-SUITE-001",
    operation: "create",
  });

  const snapshot: M31Snapshot = {
    fixedAsOf: M31_FIXED_AS_OF,
    calendarEvents,
    alerts,
    auditTemplates,
    findings,
    correctiveActionPlans,
    mockSurveys,
    riskViews,
    productionWritesBlocked: ["M31_PRODUCTION_WRITE_BLOCKED"],
  };
  assertM31SnapshotRoles(snapshot);
  return deepFreeze(snapshot);
}

export function areM31AuditEventsImmutable(
  events: readonly Phase3AuditEvent[],
): boolean {
  return (
    Object.isFrozen(events) &&
    events.length > 0 &&
    events.every((event) => Object.isFrozen(event))
  );
}
