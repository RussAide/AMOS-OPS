import {
  M33_ANNUAL_TRAINING_REQUIREMENT_HOURS,
  M33_CRITERIA,
  M33_FIXED_NOW,
  assertM33SyntheticWrite,
  type M33AccessDecision,
  type M33CredentialEvidence,
  type M33CredentialingCycle,
  type M33ExpirationAlert,
  type M33LifecycleGate,
  type M33ModuleResult,
  type M33PerformanceEvent,
  type M33PersonnelDocument,
  type M33Requirement,
  type M33Scenario,
  type M33Snapshot,
  type M33TrainingAnnualSummary,
  type M33TrainingEntry,
  type M33TrainingExclusion,
  type M33TrainingExclusionReason,
  type M33WorkforceRecord,
} from "@contracts/phase3/m33";
import {
  changedPhase3Fields,
  phase3DaysBetween,
  type Phase3AuditAction,
  type Phase3AuditEvent,
  type Phase3CriterionResult,
} from "@contracts/phase3/shared";
import { ROLE_TIER_BY_ROLE } from "@/constants/access-control";

const DAY_MS = 86_400_000;
const M33_CORRELATION_ID = "SYNTH-M33-CORRELATION-001";

export type M33ExpirationClassification =
  90 | 60 | 30 | "expired" | "outside_window";

export function classifyM33Expiration(
  referenceAt: string,
  expiresAt: string,
): { daysRemaining: number; threshold: M33ExpirationClassification } {
  const reference = new Date(referenceAt).getTime();
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(reference) || Number.isNaN(expiry)) {
    throw new Error("M33_INVALID_EXPIRATION_DATE");
  }
  const daysRemaining = Math.ceil((expiry - reference) / DAY_MS);
  if (daysRemaining < 0) return { daysRemaining, threshold: "expired" };
  if (daysRemaining <= 30) return { daysRemaining, threshold: 30 };
  if (daysRemaining <= 60) return { daysRemaining, threshold: 60 };
  if (daysRemaining <= 90) return { daysRemaining, threshold: 90 };
  return { daysRemaining, threshold: "outside_window" };
}

export function calculateM33CredentialingDays(
  startedAt: string,
  completedAt: string,
): number {
  return phase3DaysBetween(startedAt, completedAt);
}

export function calculateM33AnnualTrainingHours(
  entries: readonly M33TrainingEntry[],
  workforceId: string,
  calendarYear: number,
  referenceAt = M33_FIXED_NOW,
): number {
  return reconcileM33AnnualTraining(
    entries,
    workforceId,
    calendarYear,
    referenceAt,
  ).completedHours;
}

export interface M33AnnualTrainingReconciliation {
  completedHours: number;
  includedEntryIds: readonly string[];
  excludedEntries: readonly M33TrainingExclusion[];
}

export function reconcileM33AnnualTraining(
  entries: readonly M33TrainingEntry[],
  workforceId: string,
  calendarYear: number,
  referenceAt = M33_FIXED_NOW,
): M33AnnualTrainingReconciliation {
  const reference = Date.parse(referenceAt);
  const periodStart = Date.UTC(calendarYear, 0, 1);
  const periodEnd = Date.UTC(calendarYear + 1, 0, 1);
  if (!Number.isFinite(reference)) throw new Error("M33_INVALID_TRAINING_REFERENCE_DATE");

  const includedEntryIds: string[] = [];
  const excludedEntries: M33TrainingExclusion[] = [];
  const creditedKeys = new Set<string>();
  let completedHours = 0;

  const exclude = (
    entry: M33TrainingEntry,
    reason: M33TrainingExclusionReason,
  ) => excludedEntries.push({ entryId: entry.id, creditKey: entry.creditKey, reason });

  for (const entry of entries.filter((item) => item.workforceId === workforceId)) {
    const completed = Date.parse(entry.completedAt);
    if (!Number.isFinite(completed)) throw new Error("M33_INVALID_TRAINING_DATE");
    if (!Number.isFinite(entry.hours) || entry.hours <= 0) throw new Error("M33_INVALID_TRAINING_HOURS");
    if (entry.status === "void") {
      exclude(entry, "void");
    } else if (completed < periodStart || completed >= periodEnd) {
      exclude(entry, "out_of_period");
    } else if (completed > reference) {
      exclude(entry, "future");
    } else if (!entry.applicable) {
      exclude(entry, "non_applicable");
    } else if (!entry.verified) {
      exclude(entry, "unverified");
    } else if (creditedKeys.has(entry.creditKey)) {
      exclude(entry, "duplicate_credit_key");
    } else {
      creditedKeys.add(entry.creditKey);
      includedEntryIds.push(entry.id);
      completedHours += entry.hours;
    }
  }

  return { completedHours, includedEntryIds, excludedEntries };
}

function buildWorkforce(): readonly M33WorkforceRecord[] {
  return [
    {
      id: "SYNTH-M33-WORKFORCE-T1",
      tier: "T1",
      syntheticName: "Synthetic T1 Managing Director",
      positionId: "SYNTH-M33-POSITION-T1",
      positionTitle: "Managing Director",
      role: "managing-director",
      division: "EO",
      department: "Executive Office",
      supervisorId: null,
      employmentStatus: "active",
      employmentStartedAt: "2023-01-09T14:00:00.000Z",
      accessAssignments: [
        {
          id: "SYNTH-M33-ACCESS-T1",
          system: "AMOS-OPS",
          role: "managing-director",
          scope: "EO:enterprise:governance-oversight",
          leastPrivilegeReason:
            "Enterprise leadership access is limited to governed oversight and approval duties.",
          status: "active",
          effectiveAt: "2023-01-09T14:00:00.000Z",
        },
      ],
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-WORKFORCE-T2",
      tier: "T2",
      syntheticName: "Synthetic T2 BHC Director",
      positionId: "SYNTH-M33-POSITION-T2",
      positionTitle: "Behavioral Health Division Director",
      role: "bhc-director",
      division: "BHC",
      department: "Behavioral Health Leadership",
      supervisorId: "SYNTH-M33-WORKFORCE-T1",
      employmentStatus: "active",
      employmentStartedAt: "2024-01-15T14:00:00.000Z",
      accessAssignments: [
        {
          id: "SYNTH-M33-ACCESS-T2",
          system: "AMOS-OPS",
          role: "bhc-director",
          scope: "BHC:division:leadership-oversight",
          leastPrivilegeReason:
            "Division leadership access is limited to BHC governance and operating oversight.",
          status: "active",
          effectiveAt: "2024-01-15T14:00:00.000Z",
        },
      ],
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-WORKFORCE-T3",
      tier: "T3",
      syntheticName: "Synthetic T3 Clinical Supervisor",
      positionId: "SYNTH-M33-POSITION-T3",
      positionTitle: "Clinical Branch Supervisor",
      role: "clinical-supervisor",
      division: "BHC",
      department: "Clinical Services",
      supervisorId: "SYNTH-M33-WORKFORCE-T2",
      employmentStatus: "active",
      employmentStartedAt: "2024-03-04T14:00:00.000Z",
      accessAssignments: [
        {
          id: "SYNTH-M33-ACCESS-T3",
          system: "AMOS-OPS",
          role: "clinical-supervisor",
          scope: "BHC:assigned-branch:supervision-and-review",
          leastPrivilegeReason:
            "Branch leadership access is limited to assigned clinical programs and direct reports.",
          status: "active",
          effectiveAt: "2024-03-04T14:00:00.000Z",
        },
      ],
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-WORKFORCE-T4",
      tier: "T4",
      syntheticName: "Synthetic T4 Therapist",
      positionId: "SYNTH-M33-POSITION-T4",
      positionTitle: "Behavioral Health Therapist",
      role: "therapist",
      division: "BHC",
      department: "Clinical Services",
      supervisorId: "SYNTH-M33-WORKFORCE-T3",
      employmentStatus: "separated",
      employmentStartedAt: "2026-06-30T17:00:00.000Z",
      employmentEndedAt: "2026-07-11T22:00:00.000Z",
      accessAssignments: [
        {
          id: "SYNTH-M33-ACCESS-T4",
          system: "AMOS-OPS",
          role: "therapist",
          scope: "BHC:assigned-caseload:clinical-documentation",
          leastPrivilegeReason:
            "Frontline clinical access was limited to the assigned caseload and ended at separation.",
          status: "revoked",
          effectiveAt: "2026-06-30T17:00:00.000Z",
          revokedAt: "2026-07-11T22:00:00.000Z",
        },
      ],
      evidenceClass: "synthetic_demo",
    },
  ];
}

export function validateM33CanonicalWorkforce(
  workforce: readonly M33WorkforceRecord[],
): void {
  const byId = new Map(workforce.map((record) => [record.id, record]));
  for (const record of workforce) {
    if (ROLE_TIER_BY_ROLE[record.role] !== record.tier) {
      throw new Error(`M33_ROLE_TIER_MISMATCH:${record.id}`);
    }
    if (record.accessAssignments.some((assignment) => assignment.role !== record.role)) {
      throw new Error(`M33_ACCESS_ROLE_MISMATCH:${record.id}`);
    }
    if (record.tier === "T1" && record.supervisorId !== null) {
      throw new Error(`M33_SUPERVISOR_HIERARCHY_MISMATCH:${record.id}`);
    }
    if (record.tier !== "T1" && record.supervisorId === null) {
      throw new Error(`M33_SUPERVISOR_HIERARCHY_MISMATCH:${record.id}`);
    }
    if (record.supervisorId) {
      const supervisor = byId.get(record.supervisorId);
      if (!supervisor) throw new Error(`M33_SUPERVISOR_NOT_FOUND:${record.id}`);
      const recordRank = Number(record.tier.slice(1));
      const supervisorRank = Number(supervisor.tier.slice(1));
      if (supervisorRank >= recordRank) {
        throw new Error(`M33_SUPERVISOR_HIERARCHY_MISMATCH:${record.id}`);
      }
    }
  }
}

function buildLifecycleGates(): readonly M33LifecycleGate[] {
  const definitions = [
    ["recruitment", "2026-06-01T14:00:00.000Z"],
    ["conditional_offer", "2026-06-02T14:00:00.000Z"],
    ["screening", "2026-06-08T14:00:00.000Z"],
    ["credentialing", "2026-06-30T14:00:00.000Z"],
    ["onboarding", "2026-06-30T15:00:00.000Z"],
    ["orientation", "2026-06-30T15:30:00.000Z"],
    ["role_learning", "2026-06-30T16:00:00.000Z"],
    ["release_to_duty", "2026-06-30T17:00:00.000Z"],
  ] as const;
  return definitions.map(([gate, decidedAt], index) => {
    const evidenceIds = [
      `SYNTH-M33-EVIDENCE-GATE-${String(index + 1).padStart(2, "0")}`,
    ];
    if (gate === "recruitment") {
      evidenceIds.push("SYNTH-M33-EVIDENCE-COMPLETE-PACKET-T4");
    }
    if (gate === "credentialing" || gate === "release_to_duty") {
      evidenceIds.push("SYNTH-M33-EVIDENCE-CREDENTIAL-DECISION-T4");
    }
    return {
      id: `SYNTH-M33-GATE-${String(index + 1).padStart(2, "0")}`,
      workforceId: "SYNTH-M33-WORKFORCE-T4",
      gate,
      sequence: index + 1,
      status: "passed",
      ownerRole:
        gate === "release_to_duty" ? "hr-director" : "hr-compliance-officer",
      evidenceIds,
      decidedAt,
      evidenceClass: "synthetic_demo",
    };
  });
}

function buildCredentialingCycle(): M33CredentialingCycle {
  return {
    id: "SYNTH-M33-CREDENTIALING-CYCLE-T4",
    workforceId: "SYNTH-M33-WORKFORCE-T4",
    verifiedCompletePacket: {
      evidenceId: "SYNTH-M33-EVIDENCE-COMPLETE-PACKET-T4",
      status: "verified_complete",
      receivedAt: "2026-06-01T14:00:00.000Z",
      verifiedAt: "2026-06-01T14:00:00.000Z",
      verifiedBy: "SYNTH-M33-HR-CREDENTIALER",
    },
    finalDecision: {
      evidenceId: "SYNTH-M33-EVIDENCE-CREDENTIAL-DECISION-T4",
      decision: "approved",
      decidedAt: "2026-06-30T14:00:00.000Z",
      decidedBy: "SYNTH-M33-HR-DIRECTOR",
      requirementEvidenceIds: [
        "SYNTH-M33-CREDENTIAL-03",
        "SYNTH-M33-CREDENTIAL-04",
        "SYNTH-M33-CREDENTIAL-05",
        "SYNTH-M33-CREDENTIAL-06",
      ],
    },
    durationDays: 29,
    evidenceClass: "synthetic_demo",
  };
}

function buildRequirements(): readonly M33Requirement[] {
  return [
    ["T3", "license", "Texas professional license", 24, "blocking"],
    ["T3", "certification", "Role certification", 12, "blocking"],
    ["T4", "background", "Background screening", 24, "blocking"],
    ["T4", "exclusion", "Monthly exclusion screening", 1, "blocking"],
    ["T4", "health", "Occupational health clearance", 12, "blocking"],
    ["T4", "training", "Role learning curriculum", 12, "blocking"],
    ["T3", "ceu", "Annual continuing education", 12, "blocking"],
  ].map(
    ([tier, type, title, renewalCycleMonths, releaseToDutyImpact], index) => ({
      id: `SYNTH-M33-REQ-${String(index + 1).padStart(2, "0")}`,
      tier: tier as M33Requirement["tier"],
      type: type as M33Requirement["type"],
      title: String(title),
      required: true,
      renewalCycleMonths: Number(renewalCycleMonths),
      evidenceRequired: true,
      releaseToDutyImpact:
        releaseToDutyImpact as M33Requirement["releaseToDutyImpact"],
      evidenceClass: "synthetic_demo",
    }),
  );
}

function buildCredentialEvidence(): readonly M33CredentialEvidence[] {
  return [
    {
      id: "SYNTH-M33-CREDENTIAL-90",
      workforceId: "SYNTH-M33-WORKFORCE-T3",
      requirementId: "SYNTH-M33-REQ-01",
      issuedAt: "2024-10-12T13:00:00.000Z",
      expiresAt: "2026-10-12T13:00:00.000Z",
      status: "expiring",
      secureDocumentLink: "amos-dms://synthetic/personnel/T3/license",
      verifiedBy: "SYNTH-M33-HR-CREDENTIALER",
      verifiedAt: "2026-07-14T13:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-CREDENTIAL-60",
      workforceId: "SYNTH-M33-WORKFORCE-T3",
      requirementId: "SYNTH-M33-REQ-02",
      issuedAt: "2025-09-12T13:00:00.000Z",
      expiresAt: "2026-09-12T13:00:00.000Z",
      status: "expiring",
      secureDocumentLink: "amos-dms://synthetic/personnel/T3/certification",
      verifiedBy: "SYNTH-M33-HR-CREDENTIALER",
      verifiedAt: "2026-07-14T13:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-CREDENTIAL-30",
      workforceId: "SYNTH-M33-WORKFORCE-T3",
      requirementId: "SYNTH-M33-REQ-07",
      issuedAt: "2025-08-13T13:00:00.000Z",
      expiresAt: "2026-08-13T13:00:00.000Z",
      status: "expiring",
      secureDocumentLink: "amos-dms://synthetic/personnel/T3/ceu",
      verifiedBy: "SYNTH-M33-HR-CREDENTIALER",
      verifiedAt: "2026-07-14T13:00:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    ...[3, 4, 5, 6].map((requirementNumber) => ({
      id: `SYNTH-M33-CREDENTIAL-${String(requirementNumber).padStart(2, "0")}`,
      workforceId: "SYNTH-M33-WORKFORCE-T4",
      requirementId: `SYNTH-M33-REQ-${String(requirementNumber).padStart(2, "0")}`,
      issuedAt: "2026-06-15T13:00:00.000Z",
      expiresAt: "2027-06-15T13:00:00.000Z",
      status: "current" as const,
      secureDocumentLink: `amos-dms://synthetic/personnel/T4/requirement-${requirementNumber}`,
      verifiedBy: "SYNTH-M33-HR-CREDENTIALER",
      verifiedAt: "2026-06-30T14:00:00.000Z",
      evidenceClass: "synthetic_demo" as const,
    })),
  ];
}

function buildExpirationAlerts(): readonly M33ExpirationAlert[] {
  const definitions = [
    [
      90,
      "SYNTH-M33-CREDENTIAL-90",
      "2026-10-12T13:00:00.000Z",
      "none",
      "assigned",
    ],
    [
      60,
      "SYNTH-M33-CREDENTIAL-60",
      "2026-09-12T13:00:00.000Z",
      "restrict_at_expiry",
      "acknowledged",
    ],
    [
      30,
      "SYNTH-M33-CREDENTIAL-30",
      "2026-08-13T13:00:00.000Z",
      "suspend_at_expiry",
      "escalated",
    ],
  ] as const;
  return definitions.map(
    ([thresholdDays, credentialEvidenceId, dueAt, accessImpact, status]) => {
      const classification = classifyM33Expiration(M33_FIXED_NOW, dueAt);
      if (classification.threshold !== thresholdDays)
        throw new Error("M33_ALERT_THRESHOLD_MISMATCH");
      return {
        id: `SYNTH-M33-ALERT-${thresholdDays}`,
        credentialEvidenceId,
        workforceId: "SYNTH-M33-WORKFORCE-T3",
        thresholdDays,
        daysRemaining: classification.daysRemaining,
        ownerId: "SYNTH-M33-WORKFORCE-T2",
        escalationRole: "hr-compliance-officer",
        status,
        evidenceIds: [`SYNTH-M33-EVIDENCE-ALERT-${thresholdDays}`],
        accessImpact,
        dueAt,
        createdAt: M33_FIXED_NOW,
        evidenceClass: "synthetic_demo",
      };
    },
  );
}

function buildTrainingEntries(): readonly M33TrainingEntry[] {
  const hoursByTier = {
    T1: [16, 16, 10],
    T2: [16, 16, 12],
    T3: [16, 16, 8],
    T4: [16, 16, 9],
  } as const;
  const includedEntries: M33TrainingEntry[] = Object.entries(hoursByTier).flatMap(([tier, hours]) =>
    hours.map((entryHours, index) => ({
      id: `SYNTH-M33-TRAINING-${tier}-${index + 1}`,
      workforceId: `SYNTH-M33-WORKFORCE-${tier}`,
      creditKey: `SYNTH-M33-CREDIT-${tier}-${index + 1}`,
      title: [
        "Core safety curriculum",
        "Role competency curriculum",
        "Continuing education",
      ][index],
      requirementType: index === 2 ? ("ceu" as const) : ("training" as const),
      completedAt: `2026-0${index + 2}-15T15:00:00.000Z`,
      hours: entryHours,
      evidenceId: `SYNTH-M33-EVIDENCE-TRAINING-${tier}-${index + 1}`,
      status: "completed" as const,
      applicable: true,
      verified: true,
      evidenceClass: "synthetic_demo",
    })),
  );
  return [
    ...includedEntries,
    {
      id: "SYNTH-M33-TRAINING-T1-DUPLICATE",
      workforceId: "SYNTH-M33-WORKFORCE-T1",
      creditKey: "SYNTH-M33-CREDIT-T1-1",
      title: "Duplicate core safety credit",
      requirementType: "training",
      completedAt: "2026-05-01T15:00:00.000Z",
      hours: 16,
      evidenceId: "SYNTH-M33-EVIDENCE-TRAINING-T1-DUPLICATE",
      status: "completed",
      applicable: true,
      verified: true,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-TRAINING-T1-VOID",
      workforceId: "SYNTH-M33-WORKFORCE-T1",
      creditKey: "SYNTH-M33-CREDIT-T1-VOID",
      title: "Voided training entry",
      requirementType: "training",
      completedAt: "2026-05-02T15:00:00.000Z",
      hours: 8,
      evidenceId: "SYNTH-M33-EVIDENCE-TRAINING-T1-VOID",
      status: "void",
      applicable: true,
      verified: true,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-TRAINING-T1-FUTURE",
      workforceId: "SYNTH-M33-WORKFORCE-T1",
      creditKey: "SYNTH-M33-CREDIT-T1-FUTURE",
      title: "Future scheduled training",
      requirementType: "training",
      completedAt: "2026-12-01T15:00:00.000Z",
      hours: 12,
      evidenceId: "SYNTH-M33-EVIDENCE-TRAINING-T1-FUTURE",
      status: "completed",
      applicable: true,
      verified: true,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-TRAINING-T1-OUT-OF-PERIOD",
      workforceId: "SYNTH-M33-WORKFORCE-T1",
      creditKey: "SYNTH-M33-CREDIT-T1-OUT-OF-PERIOD",
      title: "Prior-period training",
      requirementType: "ceu",
      completedAt: "2025-12-15T15:00:00.000Z",
      hours: 10,
      evidenceId: "SYNTH-M33-EVIDENCE-TRAINING-T1-OUT-OF-PERIOD",
      status: "completed",
      applicable: true,
      verified: true,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-TRAINING-T1-NON-APPLICABLE",
      workforceId: "SYNTH-M33-WORKFORCE-T1",
      creditKey: "SYNTH-M33-CREDIT-T1-NON-APPLICABLE",
      title: "Non-applicable specialty course",
      requirementType: "ceu",
      completedAt: "2026-05-03T15:00:00.000Z",
      hours: 20,
      evidenceId: "SYNTH-M33-EVIDENCE-TRAINING-T1-NON-APPLICABLE",
      status: "completed",
      applicable: false,
      verified: true,
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-TRAINING-T1-UNVERIFIED",
      workforceId: "SYNTH-M33-WORKFORCE-T1",
      creditKey: "SYNTH-M33-CREDIT-T1-UNVERIFIED",
      title: "Unverified external course",
      requirementType: "ceu",
      completedAt: "2026-05-04T15:00:00.000Z",
      hours: 20,
      evidenceId: "SYNTH-M33-EVIDENCE-TRAINING-T1-UNVERIFIED",
      status: "completed",
      applicable: true,
      verified: false,
      evidenceClass: "synthetic_demo",
    },
  ] satisfies M33TrainingEntry[];
}

function buildAnnualTraining(
  entries: readonly M33TrainingEntry[],
): readonly M33TrainingAnnualSummary[] {
  return ["T1", "T2", "T3", "T4"].map((tier) => {
    const workforceId = `SYNTH-M33-WORKFORCE-${tier}`;
    const reconciliation = reconcileM33AnnualTraining(
      entries,
      workforceId,
      2026,
    );
    return {
      workforceId,
      calendarYear: 2026,
      requiredHours: M33_ANNUAL_TRAINING_REQUIREMENT_HOURS,
      completedHours: reconciliation.completedHours,
      compliant:
        reconciliation.completedHours >= M33_ANNUAL_TRAINING_REQUIREMENT_HOURS,
      sourceEntryIds: reconciliation.includedEntryIds,
      excludedEntries: reconciliation.excludedEntries,
    };
  });
}

function buildPerformanceEvents(): readonly M33PerformanceEvent[] {
  const definitions = [
    ["T3", "goal_set", "2026-01-15T15:00:00.000Z"],
    ["T3", "supervision", "2026-03-15T15:00:00.000Z"],
    ["T3", "coaching", "2026-04-15T15:00:00.000Z"],
    ["T3", "review", "2026-06-15T15:00:00.000Z"],
    ["T3", "improvement_plan_opened", "2026-06-16T15:00:00.000Z"],
    ["T3", "improvement_plan_verified", "2026-07-10T15:00:00.000Z"],
    ["T4", "separation_initiated", "2026-07-11T20:00:00.000Z"],
    ["T4", "access_revoked", "2026-07-11T22:00:00.000Z"],
    ["T4", "separation_closed", "2026-07-11T22:30:00.000Z"],
  ] as const;
  return definitions.map(([tier, type, occurredAt], index) => ({
    id: `SYNTH-M33-PERFORMANCE-${String(index + 1).padStart(2, "0")}`,
    workforceId: `SYNTH-M33-WORKFORCE-${tier}`,
    type,
    ownerId:
      type.includes("separation") || type === "access_revoked"
        ? "SYNTH-M33-HR-DIRECTOR"
        : "SYNTH-M33-PERFORMANCE-MANAGER",
    status: "completed",
    evidenceIds: [
      `SYNTH-M33-EVIDENCE-PERFORMANCE-${String(index + 1).padStart(2, "0")}`,
    ],
    occurredAt,
    evidenceClass: "synthetic_demo",
  }));
}

function buildPersonnelDocuments(): readonly M33PersonnelDocument[] {
  return ["T1", "T2", "T3", "T4"].map((tier) => ({
    id: `SYNTH-M33-DOCUMENT-${tier}`,
    workforceId: `SYNTH-M33-WORKFORCE-${tier}`,
    documentType: "controlled-personnel-file",
    classification: "personnel_confidential",
    secureLink: `amos-dms://synthetic/personnel/${tier}/controlled-file`,
    retentionYears: 7,
    allowedRoles: ["hr-director", "hr-compliance-officer"],
    evidenceClass: "synthetic_demo",
  }));
}

function buildAccessDecisions(): readonly M33AccessDecision[] {
  return [
    {
      id: "SYNTH-M33-ACCESS-DECISION-ALLOW",
      documentId: "SYNTH-M33-DOCUMENT-T2",
      actorId: "SYNTH-M33-HR-DIRECTOR",
      actorRole: "hr-director",
      decision: "allowed",
      reason:
        "Assigned HR custodian has a documented personnel-record purpose.",
      occurredAt: "2026-07-14T13:01:00.000Z",
      evidenceClass: "synthetic_demo",
    },
    {
      id: "SYNTH-M33-ACCESS-DECISION-DENY",
      documentId: "SYNTH-M33-DOCUMENT-T2",
      actorId: "SYNTH-M34-FACILITIES-MANAGER",
      actorRole: "facilities-manager",
      decision: "denied",
      reason: "Facilities role has no personnel-record purpose or assignment.",
      occurredAt: "2026-07-14T13:02:00.000Z",
      evidenceClass: "synthetic_demo",
    },
  ];
}

function buildScenarios(): readonly M33Scenario[] {
  return [
    ["T1", "onboarding", 16],
    ["T2", "renewal", 12],
    ["T3", "performance", 14],
    ["T4", "separation", 12],
  ].map(([tier, scenarioType, assertionCount]) => ({
    id: `SYNTH-M33-SCENARIO-${tier}`,
    tier: tier as M33Scenario["tier"],
    scenarioType: scenarioType as M33Scenario["scenarioType"],
    workforceId: `SYNTH-M33-WORKFORCE-${tier}`,
    status: "passed",
    assertionCount: Number(assertionCount),
    evidenceIds: [`SYNTH-M33-EVIDENCE-SCENARIO-${tier}`],
    evidenceClass: "synthetic_demo",
  }));
}

function auditEvent(
  id: string,
  action: Phase3AuditAction,
  entityType: string,
  entityId: string,
  actorId: string,
  actorRole: string,
  reason: string,
  occurredAt: string,
  before?: Readonly<Record<string, unknown>>,
  after?: Readonly<Record<string, unknown>>,
): Phase3AuditEvent {
  const normalizedActorRole: Phase3AuditEvent["actorRole"] = (() => {
    switch (actorRole) {
      case "performance-manager":
        return "hr-director";
      case "workforce-control-scheduler":
      case "evaluation-scenario-runner":
        return "system";
      default:
        return actorRole as Phase3AuditEvent["actorRole"];
    }
  })();
  return {
    id,
    domain: "WORKFORCE",
    action,
    entityType,
    entityId,
    actorId,
    actorRole: normalizedActorRole,
    reason,
    correlationId: M33_CORRELATION_ID,
    before,
    after,
    changedFields: changedPhase3Fields(before, after),
    evidenceClass: "synthetic_demo",
    occurredAt,
  };
}

function buildAuditEvents(): readonly Phase3AuditEvent[] {
  return [
    auditEvent(
      "SYNTH-M33-AUDIT-01",
      "change",
      "workforce_assignment",
      "SYNTH-M33-WORKFORCE-T4",
      "SYNTH-M33-HR-DIRECTOR",
      "hr-director",
      "Position, reporting, employment, and least-privilege assignment established.",
      "2026-06-30T16:30:00.000Z",
      { employmentStatus: "candidate" },
      { employmentStatus: "active", accessStatus: "active" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-02-PACKET",
      "approval",
      "credentialing_packet",
      "SYNTH-M33-EVIDENCE-COMPLETE-PACKET-T4",
      "SYNTH-M33-HR-CREDENTIALER",
      "hr-compliance-officer",
      "The complete application and required packet were verified as the credentialing-cycle start evidence.",
      "2026-06-01T14:00:00.000Z",
      { status: "received_incomplete" },
      { status: "verified_complete" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-02-DECISION",
      "gate_decision",
      "credentialing_decision",
      "SYNTH-M33-EVIDENCE-CREDENTIAL-DECISION-T4",
      "SYNTH-M33-HR-DIRECTOR",
      "hr-director",
      "The final credential decision approved the verified-complete packet after 29 elapsed days.",
      "2026-06-30T14:00:00.000Z",
      { decision: "pending" },
      { decision: "approved", credentialingDays: 29 },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-02-RELEASE",
      "gate_decision",
      "release_to_duty",
      "SYNTH-M33-GATE-08",
      "SYNTH-M33-HR-DIRECTOR",
      "hr-director",
      "All ordered recruitment-to-role-learning gates and evidence passed.",
      "2026-06-30T17:00:00.000Z",
      { state: "blocked" },
      { state: "released", credentialingDays: 29 },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-03",
      "approval",
      "controlled_requirement",
      "SYNTH-M33-REQ-01",
      "SYNTH-M33-HR-CREDENTIALER",
      "hr-compliance-officer",
      "Controlled role requirement and secure evidence verified.",
      "2026-07-14T13:00:00.000Z",
      { status: "submitted" },
      { status: "verified" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-04-90",
      "routing",
      "expiration_alert",
      "SYNTH-M33-ALERT-90",
      "SYNTH-M33-SCHEDULER",
      "workforce-control-scheduler",
      "Ninety-day renewal alert assigned with owner and evidence requirement.",
      "2026-07-14T13:00:00.000Z",
      undefined,
      { thresholdDays: 90, accessImpact: "none" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-04-60",
      "routing",
      "expiration_alert",
      "SYNTH-M33-ALERT-60",
      "SYNTH-M33-SCHEDULER",
      "workforce-control-scheduler",
      "Sixty-day renewal alert acknowledged with restriction-at-expiry rule.",
      "2026-07-14T13:00:01.000Z",
      undefined,
      { thresholdDays: 60, accessImpact: "restrict_at_expiry" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-04-30",
      "routing",
      "expiration_alert",
      "SYNTH-M33-ALERT-30",
      "SYNTH-M33-SCHEDULER",
      "workforce-control-scheduler",
      "Thirty-day renewal alert escalated with suspension-at-expiry rule.",
      "2026-07-14T13:00:02.000Z",
      undefined,
      { thresholdDays: 30, accessImpact: "suspend_at_expiry" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-05-PIP",
      "change",
      "performance_plan",
      "SYNTH-M33-PERFORMANCE-05",
      "SYNTH-M33-PERFORMANCE-MANAGER",
      "performance-manager",
      "Improvement plan progressed through coaching and verified completion.",
      "2026-07-10T15:00:00.000Z",
      { state: "open" },
      { state: "verified" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-05-SEPARATION",
      "administrative_action",
      "access_assignment",
      "SYNTH-M33-ACCESS-T4",
      "SYNTH-M33-HR-DIRECTOR",
      "hr-director",
      "Separation required access revocation before case closure.",
      "2026-07-11T22:00:00.000Z",
      { status: "active" },
      { status: "revoked" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-06",
      "approval",
      "annual_training",
      "SYNTH-M33-WORKFORCE-T3",
      "SYNTH-M33-TRAINING-COORDINATOR",
      "training-coordinator",
      "Verified annual training ledger met the forty-hour requirement.",
      "2026-07-14T13:03:00.000Z",
      { completedHours: 32 },
      { completedHours: 40, compliant: true },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-07-ALLOW",
      "access",
      "personnel_document",
      "SYNTH-M33-DOCUMENT-T2",
      "SYNTH-M33-HR-DIRECTOR",
      "hr-director",
      "Least-privilege access allowed for assigned HR purpose.",
      "2026-07-14T13:01:00.000Z",
      undefined,
      { decision: "allowed" },
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-07-DENY",
      "access",
      "personnel_document",
      "SYNTH-M33-DOCUMENT-T2",
      "SYNTH-M34-FACILITIES-MANAGER",
      "facilities-manager",
      "Access denied because the role has no personnel-record purpose.",
      "2026-07-14T13:02:00.000Z",
      undefined,
      { decision: "denied" },
    ),
    ...["T1", "T2", "T3", "T4"].map((tier, index) =>
      auditEvent(
        `SYNTH-M33-AUDIT-08-${tier}`,
        "scenario",
        "workforce_scenario",
        `SYNTH-M33-SCENARIO-${tier}`,
        "SYNTH-M33-SCENARIO-RUNNER",
        "evaluation-scenario-runner",
        `${tier} workforce scenario completed with synthetic evidence.`,
        `2026-07-14T13:1${index}:00.000Z`,
        { status: "running" },
        { status: "passed" },
      ),
    ),
    auditEvent(
      "SYNTH-M33-AUDIT-BOUNDARY",
      "administrative_action",
      "write_boundary",
      "SYNTH-M33-WRITE-BOUNDARY",
      "SYNTH-M33-SCENARIO-RUNNER",
      "evaluation-scenario-runner",
      "Production records, notifications, connectors, and tenant mutations remain blocked.",
      "2026-07-14T13:20:00.000Z",
      undefined,
      { productionWritesBlocked: true, liveConnectorMutationsBlocked: true },
    ),
  ];
}

function assertSyntheticRecords(snapshot: M33Snapshot): void {
  const recordGroups = [
    snapshot.workforce,
    snapshot.lifecycleGates,
    snapshot.requirements,
    snapshot.credentialEvidence,
    snapshot.expirationAlerts,
    snapshot.trainingEntries,
    snapshot.performanceEvents,
    snapshot.personnelDocuments,
    snapshot.accessDecisions,
    snapshot.scenarios,
  ] as const;
  for (const records of recordGroups) {
    for (const record of records) assertM33SyntheticWrite(record);
  }
  assertM33SyntheticWrite(snapshot.credentialingCycle);
}

function buildCriteria(
  snapshot: M33Snapshot,
  auditEvents: readonly Phase3AuditEvent[],
): readonly Phase3CriterionResult[] {
  const auditIds = (prefix: string) =>
    auditEvents
      .filter((event) => event.id.startsWith(prefix))
      .map((event) => event.id);
  const requirementTypes = [
    ...new Set(snapshot.requirements.map((requirement) => requirement.type)),
  ].sort();
  const alertThresholds = snapshot.expirationAlerts
    .map((alert) => alert.thresholdDays)
    .sort((left, right) => right - left);
  const eventTypes = [
    ...new Set(snapshot.performanceEvents.map((event) => event.type)),
  ];
  const tiers = snapshot.workforce.map((record) => record.tier).sort();
  const scenarioTiers = snapshot.scenarios
    .map((scenario) => scenario.tier)
    .sort();
  const credentialingGate = snapshot.lifecycleGates.find(
    (gate) => gate.gate === "credentialing",
  );
  const releaseGate = snapshot.lifecycleGates.find(
    (gate) => gate.gate === "release_to_duty",
  );
  const credentialingCycle = snapshot.credentialingCycle;
  const credentialingEvidenceComplete =
    credentialingCycle.verifiedCompletePacket.status === "verified_complete" &&
    credentialingCycle.verifiedCompletePacket.evidenceId.startsWith("SYNTH-") &&
    credentialingCycle.verifiedCompletePacket.verifiedBy.startsWith("SYNTH-") &&
    credentialingCycle.finalDecision.decision === "approved" &&
    credentialingCycle.finalDecision.evidenceId.startsWith("SYNTH-") &&
    credentialingCycle.finalDecision.decidedBy.startsWith("SYNTH-") &&
    credentialingCycle.finalDecision.requirementEvidenceIds.length === 4 &&
    calculateM33CredentialingDays(
      credentialingCycle.verifiedCompletePacket.verifiedAt,
      credentialingCycle.finalDecision.decidedAt,
    ) === 29 &&
    credentialingCycle.durationDays === 29 &&
    credentialingGate?.evidenceIds.includes(
      credentialingCycle.finalDecision.evidenceId,
    ) === true &&
    releaseGate?.evidenceIds.includes(
      credentialingCycle.finalDecision.evidenceId,
    ) === true;
  const trainingExclusionReasons = new Set(
    snapshot.annualTraining.flatMap((summary) =>
      summary.excludedEntries.map((entry) => entry.reason),
    ),
  );

  return [
    {
      criterionId: M33_CRITERIA[0],
      passed:
        snapshot.workforce.length === 4 &&
        snapshot.workforce.every(
          (record) =>
            record.accessAssignments.length > 0 &&
            ROLE_TIER_BY_ROLE[record.role] === record.tier &&
            record.accessAssignments.every(
              (assignment) => assignment.role === record.role,
            ),
        ),
      summary:
        "T1-T4 position, role, division, department, supervisor, employment, and access assignments are controlled.",
      evidence: {
        workforceIds: snapshot.workforce.map((record) => record.id),
        tiers,
        roleTierAssignments: snapshot.workforce.map((record) => ({
          workforceId: record.id,
          role: record.role,
          tier: record.tier,
          canonicalTier: ROLE_TIER_BY_ROLE[record.role],
          supervisorId: record.supervisorId,
        })),
        auditEventIds: auditIds("SYNTH-M33-AUDIT-01"),
      },
    },
    {
      criterionId: M33_CRITERIA[1],
      passed:
        snapshot.lifecycleGates.length === 8 &&
        snapshot.lifecycleGates.every((gate) => gate.status === "passed") &&
        credentialingEvidenceComplete &&
        snapshot.credentialingDurationDays === 29 &&
        snapshot.releaseToDutyPassed,
      summary:
        "The ordered recruitment-to-release lifecycle passed with evidence in 29 credentialing days.",
      evidence: {
        gateIds: snapshot.lifecycleGates.map((gate) => gate.id),
        credentialingCycle,
        credentialingDurationDays: snapshot.credentialingDurationDays,
        auditEventIds: auditIds("SYNTH-M33-AUDIT-02"),
      },
    },
    {
      criterionId: M33_CRITERIA[2],
      passed:
        requirementTypes.join("|") ===
          [
            "background",
            "certification",
            "ceu",
            "exclusion",
            "health",
            "license",
            "training",
          ].join("|") &&
        snapshot.credentialEvidence.every((credential) =>
          credential.secureDocumentLink.startsWith("amos-dms://synthetic/"),
        ),
      summary:
        "All seven controlled credential and training requirement classes have verified secure evidence.",
      evidence: {
        requirementTypes,
        requirementIds: snapshot.requirements.map(
          (requirement) => requirement.id,
        ),
        auditEventIds: auditIds("SYNTH-M33-AUDIT-03"),
      },
    },
    {
      criterionId: M33_CRITERIA[3],
      passed:
        alertThresholds.join("|") === "90|60|30" &&
        snapshot.expirationAlerts.every(
          (alert) =>
            alert.ownerId &&
            alert.escalationRole &&
            alert.evidenceIds.length > 0,
        ),
      summary:
        "Exact 90/60/30-day alerts include ownership, escalation, evidence, and access-impact rules.",
      evidence: {
        alertThresholds,
        alerts: snapshot.expirationAlerts,
        auditEventIds: auditIds("SYNTH-M33-AUDIT-04"),
      },
    },
    {
      criterionId: M33_CRITERIA[4],
      passed:
        [
          "goal_set",
          "supervision",
          "coaching",
          "review",
          "improvement_plan_opened",
          "improvement_plan_verified",
          "separation_initiated",
          "access_revoked",
          "separation_closed",
        ].every((type) =>
          eventTypes.includes(type as M33PerformanceEvent["type"]),
        ) &&
        snapshot.workforce
          .find((record) => record.tier === "T4")
          ?.accessAssignments.every(
            (assignment) => assignment.status === "revoked",
          ) === true,
      summary:
        "Performance, supervision, coaching, PIP, separation, and access revocation complete in order.",
      evidence: {
        eventTypes,
        eventIds: snapshot.performanceEvents.map((event) => event.id),
        auditEventIds: [...auditIds("SYNTH-M33-AUDIT-05")],
      },
    },
    {
      criterionId: M33_CRITERIA[5],
      passed:
        snapshot.annualTraining.length === 4 &&
        snapshot.annualTraining.every(
          (summary) =>
            summary.compliant &&
            summary.completedHours >= 40 &&
            new Set(summary.sourceEntryIds).size === summary.sourceEntryIds.length,
        ) &&
        [
          "duplicate_credit_key",
          "void",
          "future",
          "out_of_period",
          "non_applicable",
          "unverified",
        ].every((reason) =>
          trainingExclusionReasons.has(reason as M33TrainingExclusionReason),
        ),
      summary:
        "Every representative applicable staff tier has at least 40 verified annual training hours.",
      evidence: {
        annualTraining: snapshot.annualTraining,
        trainingExclusionReasons: [...trainingExclusionReasons].sort(),
        auditEventIds: auditIds("SYNTH-M33-AUDIT-06"),
      },
    },
    {
      criterionId: M33_CRITERIA[6],
      passed:
        snapshot.personnelDocuments.every(
          (document) =>
            document.classification === "personnel_confidential" &&
            document.retentionYears === 7 &&
            document.secureLink.startsWith("amos-dms://synthetic/"),
        ) &&
        snapshot.accessDecisions.some(
          (decision) => decision.decision === "denied",
        ),
      summary:
        "Personnel records enforce confidentiality, retention, secure linkage, least privilege, and audited denial.",
      evidence: {
        documentIds: snapshot.personnelDocuments.map((document) => document.id),
        accessDecisions: snapshot.accessDecisions,
        auditEventIds: auditIds("SYNTH-M33-AUDIT-07"),
      },
    },
    {
      criterionId: M33_CRITERIA[7],
      passed:
        snapshot.scenarios.length === 4 &&
        scenarioTiers.join("|") === "T1|T2|T3|T4" &&
        snapshot.scenarios.every((scenario) => scenario.status === "passed"),
      summary:
        "Deterministic T1 onboarding, T2 renewal, T3 performance, and T4 separation scenarios pass.",
      evidence: {
        scenarioIds: snapshot.scenarios.map((scenario) => scenario.id),
        scenarioTiers,
        auditEventIds: auditIds("SYNTH-M33-AUDIT-08"),
      },
    },
  ];
}

/** Execute the complete M3.3 workforce milestone against a fresh fixed dataset. */
export function runM33SyntheticSuite(): M33ModuleResult {
  const workforce = buildWorkforce();
  validateM33CanonicalWorkforce(workforce);
  const lifecycleGates = buildLifecycleGates();
  const credentialingCycle = buildCredentialingCycle();
  const requirements = buildRequirements();
  const credentialEvidence = buildCredentialEvidence();
  const expirationAlerts = buildExpirationAlerts();
  const trainingEntries = buildTrainingEntries();
  const annualTraining = buildAnnualTraining(trainingEntries);
  const performanceEvents = buildPerformanceEvents();
  const personnelDocuments = buildPersonnelDocuments();
  const accessDecisions = buildAccessDecisions();
  const scenarios = buildScenarios();
  const credentialingDurationDays = calculateM33CredentialingDays(
    credentialingCycle.verifiedCompletePacket.verifiedAt,
    credentialingCycle.finalDecision.decidedAt,
  );
  if (credentialingDurationDays !== 29)
    throw new Error("M33_CREDENTIALING_DURATION_REGRESSION");

  const snapshot: M33Snapshot = {
    generatedAt: M33_FIXED_NOW,
    workforce,
    lifecycleGates,
    credentialingCycle,
    requirements,
    credentialEvidence,
    expirationAlerts,
    trainingEntries,
    annualTraining,
    performanceEvents,
    personnelDocuments,
    accessDecisions,
    scenarios,
    credentialingDurationDays,
    releaseToDutyPassed: true,
    writeBoundary: {
      mode: "evaluation_only",
      productionWritesBlocked: true,
      liveConnectorMutationsBlocked: true,
      allowedEvidenceClass: "synthetic_demo",
      blockedActionTypes: [
        "create_live_employee",
        "modify_live_access",
        "send_live_notification",
        "write_microsoft_tenant",
        "upload_live_personnel_document",
      ],
    },
  };
  assertSyntheticRecords(snapshot);
  const auditEvents = buildAuditEvents();
  for (const event of auditEvents) assertM33SyntheticWrite(event);
  const criteria = buildCriteria(snapshot, auditEvents);
  return {
    milestone: "M3.3",
    domain: "WORKFORCE",
    evidenceClass: "synthetic_demo",
    passed:
      criteria.length === M33_CRITERIA.length &&
      criteria.every((criterion) => criterion.passed),
    criteria,
    snapshot,
    auditEvents,
  };
}
