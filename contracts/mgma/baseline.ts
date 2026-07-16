/**
 * M1.3 doctrine-controlled management baseline.
 *
 * "MGMA" identifies the seven-domain management framework used by this
 * prototype. It does not imply that the targets below are MGMA percentiles,
 * survey results, licensed benchmarks, or proprietary MGMA content. Every
 * target is an internally controlled prototype target approved for evaluation
 * use with fictional/synthetic evidence only.
 */

export type MgmaDomainId = "D1" | "D2" | "D3" | "D4" | "D5" | "D6" | "D7";
export type ScopeType = "profit_center" | "corporate_office";
export type ScopeId = "BHC" | "GRO" | "EO" | "GAD";
export type DivisionCode = ScopeId;
export type CorporateOfficeDivision = "EO" | "GAD";

export interface ScopeReference {
  scopeType: ScopeType;
  scopeId: ScopeId;
}

export interface AccountableRole {
  roleId: string;
  roleLabel: string;
  division: DivisionCode;
}

export interface DomainSourceData {
  system: string;
  entities: readonly string[];
  keyFields: readonly string[];
}

export interface MgmaDomainMapping {
  id: MgmaDomainId;
  name: string;
  purpose: string;
  modules: readonly string[];
  routes: readonly string[];
  workflows: readonly string[];
  accountableOwner: AccountableRole;
  sourceData: readonly DomainSourceData[];
  responsibleDivision: DivisionCode;
  corporateOfficeSponsor: AccountableRole & {
    division: CorporateOfficeDivision;
  };
  consumingScopes: readonly ScopeReference[];
}

const ALL_SCOPES = [
  { scopeType: "profit_center", scopeId: "BHC" },
  { scopeType: "profit_center", scopeId: "GRO" },
  { scopeType: "corporate_office", scopeId: "EO" },
  { scopeType: "corporate_office", scopeId: "GAD" },
] as const satisfies readonly ScopeReference[];

const CLINICAL_AND_EXECUTIVE_SCOPES = [
  { scopeType: "profit_center", scopeId: "BHC" },
  { scopeType: "profit_center", scopeId: "GRO" },
  { scopeType: "corporate_office", scopeId: "EO" },
] as const satisfies readonly ScopeReference[];

export const MGMA_DOMAIN_MAPPINGS: readonly MgmaDomainMapping[] = [
  {
    id: "D1",
    name: "Operations Management",
    purpose:
      "Facility availability, residential operations, safety, logistics, and controlled workflow execution.",
    modules: [
      "GAD Facilities & Operations",
      "GRO Residential Operations",
      "Enterprise Workflows",
    ],
    routes: ["/gad", "/gro", "/workflows"],
    workflows: [
      "facility-uptime-monitoring",
      "work-order-management",
      "safety-rounds",
      "shift-handoff",
    ],
    accountableOwner: {
      roleId: "facilities-manager",
      roleLabel: "Facilities Manager",
      division: "GAD",
    },
    sourceData: [
      {
        system: "AMOS-OPS Facilities",
        entities: ["facilities", "work_orders", "safety_inspections"],
        keyFields: [
          "facility_id",
          "status",
          "opened_at",
          "completed_at",
          "inspection_date",
        ],
      },
      {
        system: "AMOS-OPS Workflow",
        entities: ["workflow_instances", "workflow_steps"],
        keyFields: ["workflow_id", "status", "started_at", "completed_at"],
      },
    ],
    responsibleDivision: "GAD",
    corporateOfficeSponsor: {
      roleId: "administrator",
      roleLabel: "Administrator / LCCA",
      division: "EO",
    },
    consumingScopes: ALL_SCOPES,
  },
  {
    id: "D2",
    name: "Financial Management",
    purpose:
      "Revenue-cycle performance, claims quality, accounts receivable, payment, and denial management.",
    modules: [
      "Revenue Dashboard",
      "Claims Management",
      "Accounts Receivable Aging",
    ],
    routes: [
      "/revenue",
      "/revenue/claims",
      "/revenue/aging",
      "/revenue/denials",
    ],
    workflows: [
      "claim-submission",
      "clean-claim-validation",
      "payment-posting",
      "denial-management",
    ],
    accountableOwner: {
      roleId: "revenue-cycle-manager",
      roleLabel: "Revenue Cycle Manager",
      division: "EO",
    },
    sourceData: [
      {
        system: "AMOS-OPS Revenue Cycle",
        entities: ["claims", "claim_submissions", "payments", "claim_denials"],
        keyFields: [
          "claim_id",
          "service_date",
          "submitted_at",
          "first_pass_status",
          "outstanding_balance",
          "paid_at",
        ],
      },
    ],
    responsibleDivision: "EO",
    corporateOfficeSponsor: {
      roleId: "managing-director",
      roleLabel: "Managing Director",
      division: "EO",
    },
    consumingScopes: CLINICAL_AND_EXECUTIVE_SCOPES,
  },
  {
    id: "D3",
    name: "Human Resources Management",
    purpose:
      "Workforce lifecycle, retention, credential currency, required training, and performance management.",
    modules: [
      "HR Command Center",
      "Credential Tracker",
      "Training Assignments",
      "Separation Management",
    ],
    routes: [
      "/hr",
      "/hr/credentials-tracker",
      "/hr/training-assignments",
      "/hr/separations",
    ],
    workflows: [
      "recruitment-onboarding",
      "credential-monitoring",
      "training-currency",
      "employee-separation",
    ],
    accountableOwner: {
      roleId: "hr-director",
      roleLabel: "HR Director",
      division: "EO",
    },
    sourceData: [
      {
        system: "AMOS-OPS Human Resources",
        entities: [
          "people",
          "employment_status_history",
          "credentials",
          "training_assignments",
          "separations",
        ],
        keyFields: [
          "person_id",
          "hire_date",
          "separation_date",
          "credential_expires_at",
          "training_due_at",
          "completed_at",
        ],
      },
    ],
    responsibleDivision: "EO",
    corporateOfficeSponsor: {
      roleId: "managing-director",
      roleLabel: "Managing Director",
      division: "EO",
    },
    consumingScopes: ALL_SCOPES,
  },
  {
    id: "D4",
    name: "Compliance & Risk Management",
    purpose:
      "Documentation timeliness, chart audit quality, corrective action, and regulatory-risk oversight.",
    modules: [
      "Quality Assurance",
      "Audit Binder",
      "Regulatory Framework",
      "Encounter Documentation",
    ],
    routes: [
      "/qa",
      "/qa/audit-binder",
      "/compliance/regulatory-framework",
      "/clinical/service-delivery",
    ],
    workflows: [
      "encounter-note-review",
      "chart-audit",
      "deficiency-remediation",
      "corrective-action-plan",
    ],
    accountableOwner: {
      roleId: "hr-compliance-officer",
      roleLabel: "HR / Compliance Officer",
      division: "EO",
    },
    sourceData: [
      {
        system: "AMOS-OPS Quality & Compliance",
        entities: [
          "clinical_encounters",
          "service_notes",
          "chart_audits",
          "audit_findings",
          "corrective_actions",
        ],
        keyFields: [
          "encounter_id",
          "ended_at",
          "note_signed_at",
          "audit_id",
          "audit_result",
          "closed_at",
        ],
      },
    ],
    responsibleDivision: "EO",
    corporateOfficeSponsor: {
      roleId: "administrator",
      roleLabel: "Administrator / LCCA",
      division: "EO",
    },
    consumingScopes: ALL_SCOPES,
  },
  {
    id: "D5",
    name: "Patient Care & Clinical Quality",
    purpose:
      "Care-plan currency, referral access, treatment delivery, and cross-divisional clinical quality.",
    modules: [
      "BHC Clinical Workspace",
      "Treatment Plans",
      "Referral Intake",
      "GRO Care Operations",
    ],
    routes: [
      "/clinical",
      "/clinical/treatment-plans",
      "/clinical/referrals",
      "/gro/care-logs",
    ],
    workflows: [
      "care-plan-review",
      "referral-intake",
      "first-service-linkage",
      "clinical-quality-review",
    ],
    accountableOwner: {
      roleId: "treatment-director",
      roleLabel: "Treatment Director / LPHA",
      division: "BHC",
    },
    sourceData: [
      {
        system: "AMOS-OPS Clinical",
        entities: [
          "treatment_plans",
          "clinical_referrals",
          "clinical_encounters",
          "care_reviews",
        ],
        keyFields: [
          "patient_id",
          "plan_id",
          "review_due_at",
          "reviewed_at",
          "referral_received_at",
          "first_service_at",
        ],
      },
    ],
    responsibleDivision: "BHC",
    corporateOfficeSponsor: {
      roleId: "administrator",
      roleLabel: "Administrator / LCCA",
      division: "EO",
    },
    consumingScopes: CLINICAL_AND_EXECUTIVE_SCOPES,
  },
  {
    id: "D6",
    name: "Information Management",
    purpose:
      "Controlled data refresh, information quality, platform observability, and reliable reporting inputs.",
    modules: [
      "AMOS-OPS Platform",
      "Analytics",
      "NIL Knowledge Graph",
      "Operational Observability",
    ],
    routes: ["/analytics", "/nil", "/nil/search", "/admin/settings"],
    workflows: [
      "scheduled-data-refresh",
      "critical-data-quality-check",
      "source-reconciliation",
      "refresh-failure-escalation",
    ],
    accountableOwner: {
      roleId: "super-admin",
      roleLabel: "Super Admin",
      division: "EO",
    },
    sourceData: [
      {
        system: "AMOS-OPS Data Operations",
        entities: [
          "data_refresh_runs",
          "data_quality_results",
          "operational_audit_events",
          "source_registry",
        ],
        keyFields: [
          "run_id",
          "scheduled_at",
          "completed_at",
          "status",
          "check_id",
          "severity",
          "result",
        ],
      },
    ],
    responsibleDivision: "EO",
    corporateOfficeSponsor: {
      roleId: "managing-director",
      roleLabel: "Managing Director",
      division: "EO",
    },
    consumingScopes: ALL_SCOPES,
  },
  {
    id: "D7",
    name: "Transformation & Strategy",
    purpose:
      "Strategic milestone delivery, organizational transformation, and Corporate Office service performance.",
    modules: [
      "Executive Dashboard",
      "MGMA Scorecard",
      "Strategic Projects",
      "Corporate Office Work Queue",
    ],
    routes: [
      "/executive",
      "/executive/mgma",
      "/executive/strategic-projects",
      "/workflows/my-work-today",
    ],
    workflows: [
      "strategic-milestone-review",
      "portfolio-governance",
      "corporate-office-service-request",
      "executive-escalation",
    ],
    accountableOwner: {
      roleId: "managing-director",
      roleLabel: "Managing Director",
      division: "EO",
    },
    sourceData: [
      {
        system: "AMOS-OPS Executive Operations",
        entities: [
          "strategic_projects",
          "project_milestones",
          "corporate_service_requests",
          "workflow_instances",
        ],
        keyFields: [
          "milestone_id",
          "due_at",
          "completed_at",
          "request_id",
          "sla_due_at",
          "status",
        ],
      },
    ],
    responsibleDivision: "EO",
    corporateOfficeSponsor: {
      roleId: "managing-director",
      roleLabel: "Managing Director",
      division: "EO",
    },
    consumingScopes: ALL_SCOPES,
  },
] as const;

export const CONTROLLED_KPI_IDS = [
  "001",
  "002",
  "003",
  "004",
  "005",
  "006",
  "007",
  "008",
  "009",
  "010",
  "011",
  "012",
  "013",
  "014",
] as const;

export type ControlledKpiId = (typeof CONTROLLED_KPI_IDS)[number];
export type KpiComparison = "lte" | "gte";
export type KpiUnit = "days" | "percent";
export type RefreshCadence = "daily" | "weekly" | "monthly" | "quarterly";
export type CalculationKind = "ratio" | "percentage";

export interface KpiOperandDefinition {
  name: string;
  definition: string;
  unit: "count" | "days" | "currency" | "currency_per_day" | "minutes";
}

export interface KpiThreshold {
  value: number;
  statusWhenCrossed: "off_target";
  interpretation: string;
}

export interface KpiTargetBasis {
  type: "internal_controlled_prototype";
  label: string;
  proprietaryBenchmarkClaim: false;
  statement: string;
}

export interface KpiApprovalMetadata {
  status: "controlled_for_prototype";
  approvedByRole: "managing-director";
  approvedOn: string;
  version: string;
  approvalReference: string;
  changeControlRequired: true;
}

export interface KpiDefinition {
  id: ControlledKpiId;
  name: string;
  domainId: MgmaDomainId;
  description: string;
  formula: string;
  calculationKind: CalculationKind;
  precision: number;
  numerator: KpiOperandDefinition;
  denominator: KpiOperandDefinition;
  sourceSystem: string;
  sourceFields: readonly string[];
  refreshCadence: RefreshCadence;
  owner: AccountableRole;
  comparison: KpiComparison;
  target: number;
  unit: KpiUnit;
  threshold: KpiThreshold;
  drillDownPath: string;
  staleAfterHours: number;
  relevantScopes: readonly ScopeReference[];
  targetBasis: KpiTargetBasis;
  approval: KpiApprovalMetadata;
}

const INTERNAL_TARGET_BASIS: KpiTargetBasis = {
  type: "internal_controlled_prototype",
  label: "AMOS M1.3 internal prototype target",
  proprietaryBenchmarkClaim: false,
  statement:
    "Internal evaluation threshold; neither externally benchmarked nor survey-derived and carrying no third-party authority.",
};

const PROTOTYPE_APPROVAL: KpiApprovalMetadata = {
  status: "controlled_for_prototype",
  approvedByRole: "managing-director",
  approvedOn: "2026-07-14",
  version: "1.0",
  approvalReference: "M1.3 approved checklist workstream A",
  changeControlRequired: true,
};

const REVENUE_OWNER: AccountableRole = {
  roleId: "revenue-cycle-manager",
  roleLabel: "Revenue Cycle Manager",
  division: "EO",
};

const HR_OWNER: AccountableRole = {
  roleId: "hr-director",
  roleLabel: "HR Director",
  division: "EO",
};

const COMPLIANCE_OWNER: AccountableRole = {
  roleId: "hr-compliance-officer",
  roleLabel: "HR / Compliance Officer",
  division: "EO",
};

const FACILITIES_OWNER: AccountableRole = {
  roleId: "facilities-manager",
  roleLabel: "Facilities Manager",
  division: "GAD",
};

const CLINICAL_OWNER: AccountableRole = {
  roleId: "treatment-director",
  roleLabel: "Treatment Director / LPHA",
  division: "BHC",
};

const INFORMATION_OWNER: AccountableRole = {
  roleId: "super-admin",
  roleLabel: "Super Admin",
  division: "EO",
};

const STRATEGY_OWNER: AccountableRole = {
  roleId: "managing-director",
  roleLabel: "Managing Director",
  division: "EO",
};

export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  {
    id: "001",
    name: "Days in AR",
    domainId: "D2",
    description:
      "Estimated days required to convert ending gross accounts receivable into cash at the period's average daily gross-charge rate.",
    formula: "ending gross accounts receivable / average daily gross charges",
    calculationKind: "ratio",
    precision: 1,
    numerator: {
      name: "Ending gross accounts receivable",
      definition: "Unpaid gross claim balance at fixed-period end.",
      unit: "currency",
    },
    denominator: {
      name: "Average daily gross charges",
      definition:
        "Gross charges in the fixed period divided by calendar days in that period.",
      unit: "currency_per_day",
    },
    sourceSystem: "AMOS-OPS Revenue Cycle",
    sourceFields: [
      "claims.outstanding_balance",
      "claims.service_date",
      "claims.gross_charge",
      "payments.posted_at",
    ],
    refreshCadence: "monthly",
    owner: REVENUE_OWNER,
    comparison: "lte",
    target: 40,
    unit: "days",
    threshold: {
      value: 45,
      statusWhenCrossed: "off_target",
      interpretation: "More than 45 days is off target.",
    },
    drillDownPath: "/revenue/aging?kpi=001",
    staleAfterHours: 768,
    relevantScopes: CLINICAL_AND_EXECUTIVE_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "002",
    name: "Clean Claim Rate",
    domainId: "D2",
    description:
      "Share of initial claims accepted without front-end rejection or correction before first adjudication.",
    formula: "clean initial claims / all initial claims submitted * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Clean initial claims",
      definition:
        "Initial submissions accepted without correction or rejection.",
      unit: "count",
    },
    denominator: {
      name: "Initial claims submitted",
      definition: "All non-void initial claim submissions in the fixed period.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Revenue Cycle",
    sourceFields: [
      "claim_submissions.claim_id",
      "claim_submissions.submission_sequence",
      "claim_submissions.accepted_at",
      "claim_submissions.rejection_code",
    ],
    refreshCadence: "weekly",
    owner: REVENUE_OWNER,
    comparison: "gte",
    target: 95,
    unit: "percent",
    threshold: {
      value: 90,
      statusWhenCrossed: "off_target",
      interpretation: "Below 90% is off target.",
    },
    drillDownPath: "/revenue/claims?kpi=002&view=first-pass",
    staleAfterHours: 192,
    relevantScopes: CLINICAL_AND_EXECUTIVE_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "003",
    name: "Encounter Documentation Timeliness",
    domainId: "D4",
    description:
      "Share of encounters whose required service note was signed within 24 hours of encounter end.",
    formula:
      "encounters documented within 24 hours / encounters requiring documentation * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Timely documented encounters",
      definition:
        "Required notes signed no later than 24 hours after encounter end.",
      unit: "count",
    },
    denominator: {
      name: "Encounters requiring documentation",
      definition: "Completed, non-void encounters requiring a service note.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Clinical & Quality",
    sourceFields: [
      "clinical_encounters.encounter_id",
      "clinical_encounters.ended_at",
      "service_notes.signed_at",
      "service_notes.status",
    ],
    refreshCadence: "daily",
    owner: COMPLIANCE_OWNER,
    comparison: "gte",
    target: 95,
    unit: "percent",
    threshold: {
      value: 90,
      statusWhenCrossed: "off_target",
      interpretation: "Below 90% is off target.",
    },
    drillDownPath: "/qa/registry?kpi=003&view=late-notes",
    staleAfterHours: 30,
    relevantScopes: CLINICAL_AND_EXECUTIVE_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "004",
    name: "Staff Turnover Rate",
    domainId: "D3",
    description:
      "Voluntary and involuntary separations during the rolling fixed period as a share of average active headcount.",
    formula: "employee separations / average active headcount * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Employee separations",
      definition: "Non-rescinded employee separations in the fixed period.",
      unit: "count",
    },
    denominator: {
      name: "Average active headcount",
      definition: "Average of opening and closing active employee headcount.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Human Resources",
    sourceFields: [
      "people.person_id",
      "people.employment_status",
      "people.hire_date",
      "separations.effective_date",
      "separations.status",
    ],
    refreshCadence: "monthly",
    owner: HR_OWNER,
    comparison: "lte",
    target: 15,
    unit: "percent",
    threshold: {
      value: 20,
      statusWhenCrossed: "off_target",
      interpretation: "More than 20% is off target.",
    },
    drillDownPath: "/hr/separations?kpi=004",
    staleAfterHours: 768,
    relevantScopes: ALL_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "005",
    name: "Credentialing Currency Rate",
    domainId: "D3",
    description:
      "Share of active staff with every role-required credential verified and unexpired at period end.",
    formula:
      "active staff fully credential-current / active staff requiring credentials * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Fully credential-current staff",
      definition:
        "Active staff whose complete required credential set is verified and current.",
      unit: "count",
    },
    denominator: {
      name: "Staff requiring credentials",
      definition:
        "Active staff assigned one or more role-required credentials.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Human Resources",
    sourceFields: [
      "people.person_id",
      "role_requirements.credential_type",
      "credentials.verified_at",
      "credentials.expires_at",
      "credentials.status",
    ],
    refreshCadence: "daily",
    owner: HR_OWNER,
    comparison: "gte",
    target: 98,
    unit: "percent",
    threshold: {
      value: 95,
      statusWhenCrossed: "off_target",
      interpretation: "Below 95% is off target.",
    },
    drillDownPath: "/hr/credentials-tracker?kpi=005",
    staleAfterHours: 30,
    relevantScopes: ALL_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "006",
    name: "Training Currency Rate",
    domainId: "D3",
    description:
      "Share of required training assignments that are complete and current as of period end.",
    formula:
      "current required training assignments / required training assignments due * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Current required assignments",
      definition:
        "Required assignments completed and not expired at period end.",
      unit: "count",
    },
    denominator: {
      name: "Required assignments due",
      definition:
        "Required assignments applicable to active staff by period end.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Human Resources",
    sourceFields: [
      "training_assignments.assignment_id",
      "training_assignments.required",
      "training_assignments.due_at",
      "training_assignments.completed_at",
      "training_assignments.expires_at",
    ],
    refreshCadence: "daily",
    owner: HR_OWNER,
    comparison: "gte",
    target: 95,
    unit: "percent",
    threshold: {
      value: 90,
      statusWhenCrossed: "off_target",
      interpretation: "Below 90% is off target.",
    },
    drillDownPath: "/hr/training-assignments?kpi=006",
    staleAfterHours: 30,
    relevantScopes: ALL_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "007",
    name: "Chart Audit Pass Rate",
    domainId: "D4",
    description:
      "Share of completed chart audits meeting the controlled pass standard without a critical deficiency.",
    formula: "chart audits passed / chart audits completed * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Passed chart audits",
      definition:
        "Completed audits with pass result and no critical deficiency.",
      unit: "count",
    },
    denominator: {
      name: "Completed chart audits",
      definition: "Finalized, non-void chart audits in the fixed period.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Quality & Compliance",
    sourceFields: [
      "chart_audits.audit_id",
      "chart_audits.completed_at",
      "chart_audits.result",
      "audit_findings.severity",
    ],
    refreshCadence: "weekly",
    owner: COMPLIANCE_OWNER,
    comparison: "gte",
    target: 95,
    unit: "percent",
    threshold: {
      value: 90,
      statusWhenCrossed: "off_target",
      interpretation: "Below 90% is off target.",
    },
    drillDownPath: "/qa/registry?kpi=007&view=chart-audits",
    staleAfterHours: 192,
    relevantScopes: CLINICAL_AND_EXECUTIVE_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "008",
    name: "Facility Uptime",
    domainId: "D1",
    description:
      "Share of scheduled monitored facility minutes during which required facility services were available.",
    formula: "available monitored minutes / scheduled monitored minutes * 100",
    calculationKind: "percentage",
    precision: 2,
    numerator: {
      name: "Available monitored minutes",
      definition: "Scheduled minutes without a qualifying facility outage.",
      unit: "minutes",
    },
    denominator: {
      name: "Scheduled monitored minutes",
      definition:
        "All in-scope facility operating minutes in the fixed period.",
      unit: "minutes",
    },
    sourceSystem: "AMOS-OPS Facilities",
    sourceFields: [
      "facilities.facility_id",
      "facility_monitoring.scheduled_minutes",
      "facility_outages.started_at",
      "facility_outages.restored_at",
      "facility_outages.qualifying",
    ],
    refreshCadence: "daily",
    owner: FACILITIES_OWNER,
    comparison: "gte",
    target: 99,
    unit: "percent",
    threshold: {
      value: 98,
      statusWhenCrossed: "off_target",
      interpretation: "Below 98% is off target.",
    },
    drillDownPath: "/gad?kpi=008&view=facility-uptime",
    staleAfterHours: 30,
    relevantScopes: ALL_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "009",
    name: "Care Plan Review Currency",
    domainId: "D5",
    description:
      "Share of active care plans whose required review was completed by the applicable due date.",
    formula:
      "active plans current for review / active plans due for review * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Review-current plans",
      definition: "Active plans reviewed by their applicable due date.",
      unit: "count",
    },
    denominator: {
      name: "Plans due for review",
      definition:
        "Active plans with a review due on or before fixed-period end.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Clinical",
    sourceFields: [
      "treatment_plans.plan_id",
      "treatment_plans.status",
      "treatment_plans.review_due_at",
      "care_reviews.reviewed_at",
    ],
    refreshCadence: "daily",
    owner: CLINICAL_OWNER,
    comparison: "gte",
    target: 95,
    unit: "percent",
    threshold: {
      value: 90,
      statusWhenCrossed: "off_target",
      interpretation: "Below 90% is off target.",
    },
    drillDownPath: "/clinical/treatment-plans?kpi=009&view=review-due",
    staleAfterHours: 30,
    relevantScopes: CLINICAL_AND_EXECUTIVE_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "010",
    name: "Referral-to-First-Service Days",
    domainId: "D5",
    description:
      "Mean elapsed calendar days from accepted referral to first qualifying delivered service.",
    formula:
      "sum of elapsed referral-to-first-service days / referrals with a qualifying first service",
    calculationKind: "ratio",
    precision: 1,
    numerator: {
      name: "Total elapsed access days",
      definition:
        "Sum of calendar days from accepted referral to first qualifying service.",
      unit: "days",
    },
    denominator: {
      name: "Referrals with first service",
      definition:
        "Accepted referrals receiving a qualifying first service in the fixed cohort.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Clinical",
    sourceFields: [
      "clinical_referrals.referral_id",
      "clinical_referrals.accepted_at",
      "clinical_encounters.service_date",
      "clinical_encounters.status",
    ],
    refreshCadence: "weekly",
    owner: CLINICAL_OWNER,
    comparison: "lte",
    target: 7,
    unit: "days",
    threshold: {
      value: 10,
      statusWhenCrossed: "off_target",
      interpretation: "More than 10 days is off target.",
    },
    drillDownPath: "/clinical/referrals?kpi=010&view=access-lag",
    staleAfterHours: 192,
    relevantScopes: CLINICAL_AND_EXECUTIVE_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "011",
    name: "Data Refresh Success Rate",
    domainId: "D6",
    description:
      "Share of scheduled controlled data-refresh runs completing successfully within their execution window.",
    formula: "successful scheduled refresh runs / scheduled refresh runs * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Successful refresh runs",
      definition:
        "Scheduled runs completed successfully within the controlled window.",
      unit: "count",
    },
    denominator: {
      name: "Scheduled refresh runs",
      definition: "Non-cancelled refresh runs scheduled in the fixed period.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Data Operations",
    sourceFields: [
      "data_refresh_runs.run_id",
      "data_refresh_runs.scheduled_at",
      "data_refresh_runs.completed_at",
      "data_refresh_runs.status",
    ],
    refreshCadence: "daily",
    owner: INFORMATION_OWNER,
    comparison: "gte",
    target: 99,
    unit: "percent",
    threshold: {
      value: 97,
      statusWhenCrossed: "off_target",
      interpretation: "Below 97% is off target.",
    },
    drillDownPath: "/analytics?kpi=011&view=refresh-runs",
    staleAfterHours: 30,
    relevantScopes: ALL_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "012",
    name: "Critical Data Quality Pass Rate",
    domainId: "D6",
    description:
      "Share of executed critical-severity data-quality checks that passed in the fixed period.",
    formula:
      "critical data-quality checks passed / critical data-quality checks executed * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Passed critical checks",
      definition: "Critical-severity checks completed with pass result.",
      unit: "count",
    },
    denominator: {
      name: "Executed critical checks",
      definition: "All completed critical-severity checks in the fixed period.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Data Operations",
    sourceFields: [
      "data_quality_results.check_id",
      "data_quality_results.severity",
      "data_quality_results.executed_at",
      "data_quality_results.result",
    ],
    refreshCadence: "daily",
    owner: INFORMATION_OWNER,
    comparison: "gte",
    target: 98,
    unit: "percent",
    threshold: {
      value: 95,
      statusWhenCrossed: "off_target",
      interpretation: "Below 95% is off target.",
    },
    drillDownPath: "/analytics?kpi=012&view=critical-data-quality",
    staleAfterHours: 30,
    relevantScopes: ALL_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "013",
    name: "Strategic Milestone On-Time Rate",
    domainId: "D7",
    description:
      "Share of strategic milestones due or completed in the fixed period that were completed by their controlled due date.",
    formula:
      "strategic milestones completed on time / strategic milestones due or completed * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "On-time strategic milestones",
      definition: "Controlled milestones completed on or before due date.",
      unit: "count",
    },
    denominator: {
      name: "Strategic milestones due or completed",
      definition:
        "Non-cancelled controlled milestones due or completed in the fixed period.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Executive Operations",
    sourceFields: [
      "project_milestones.milestone_id",
      "project_milestones.due_at",
      "project_milestones.completed_at",
      "project_milestones.status",
    ],
    refreshCadence: "weekly",
    owner: STRATEGY_OWNER,
    comparison: "gte",
    target: 90,
    unit: "percent",
    threshold: {
      value: 80,
      statusWhenCrossed: "off_target",
      interpretation: "Below 80% is off target.",
    },
    drillDownPath: "/executive/strategic-projects?kpi=013&view=milestones",
    staleAfterHours: 192,
    relevantScopes: ALL_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
  {
    id: "014",
    name: "Corporate Office Service-Level Completion Rate",
    domainId: "D7",
    description:
      "Share of eligible Corporate Office service requests completed within the controlled service-level deadline.",
    formula:
      "Corporate Office requests completed within SLA / Corporate Office requests due or completed * 100",
    calculationKind: "percentage",
    precision: 1,
    numerator: {
      name: "Requests completed within SLA",
      definition:
        "Eligible EO/GAD service requests completed on or before the service-level deadline.",
      unit: "count",
    },
    denominator: {
      name: "Requests due or completed",
      definition:
        "Eligible non-cancelled Corporate Office service requests due or completed in the fixed period.",
      unit: "count",
    },
    sourceSystem: "AMOS-OPS Workflow",
    sourceFields: [
      "corporate_service_requests.request_id",
      "corporate_service_requests.owner_division",
      "corporate_service_requests.sla_due_at",
      "corporate_service_requests.completed_at",
      "corporate_service_requests.status",
    ],
    refreshCadence: "weekly",
    owner: STRATEGY_OWNER,
    comparison: "gte",
    target: 95,
    unit: "percent",
    threshold: {
      value: 90,
      statusWhenCrossed: "off_target",
      interpretation: "Below 90% is off target.",
    },
    drillDownPath: "/workflows/my-work-today?kpi=014&view=corporate-sla",
    staleAfterHours: 192,
    relevantScopes: ALL_SCOPES,
    targetBasis: INTERNAL_TARGET_BASIS,
    approval: PROTOTYPE_APPROVAL,
  },
] as const;

export type EvidenceClass = "synthetic_demo" | "production";

export interface KpiMeasurementEvidence {
  measurementId: string;
  kpiId: string;
  evidenceClass: EvidenceClass;
  scopeType: ScopeType;
  scopeId: ScopeId;
  periodType: "fixed";
  periodStart: string;
  periodEnd: string;
  numerator: number;
  denominator: number;
  value: number;
  sourceReferences: readonly string[];
  sourceRecordIds: readonly string[];
  collectedAt: string;
}

export function calculateKpiValue(
  definition: Pick<KpiDefinition, "calculationKind" | "precision">,
  numerator: number,
  denominator: number,
): number | null {
  if (
    !Number.isFinite(numerator) ||
    !Number.isFinite(denominator) ||
    denominator <= 0
  )
    return null;
  const factor = definition.calculationKind === "percentage" ? 100 : 1;
  const raw = (numerator / denominator) * factor;
  const precisionFactor = 10 ** definition.precision;
  return Math.round((raw + Number.EPSILON) * precisionFactor) / precisionFactor;
}

export type KpiTargetStatus = "on_target" | "at_risk" | "off_target";

export function compareKpiValue(
  definition: Pick<KpiDefinition, "comparison" | "target" | "threshold">,
  value: number,
): KpiTargetStatus {
  if (definition.comparison === "gte") {
    if (value >= definition.target) return "on_target";
    return value >= definition.threshold.value ? "at_risk" : "off_target";
  }
  if (value <= definition.target) return "on_target";
  return value <= definition.threshold.value ? "at_risk" : "off_target";
}

export interface ContractValidationFinding {
  code:
    | "DOMAIN_DUPLICATE_ID"
    | "DOMAIN_INCOMPLETE_MAPPING"
    | "DOMAIN_SPONSOR_NOT_CORPORATE_OFFICE"
    | "KPI_DUPLICATE_ID"
    | "KPI_INCOMPLETE_DEFINITION"
    | "KPI_UNKNOWN_DOMAIN"
    | "KPI_INVALID_TARGET_CONTROL"
    | "KPI_PROPRIETARY_BENCHMARK_ATTRIBUTION";
  recordId: string;
  detail: string;
}

export interface ContractValidationResult {
  valid: boolean;
  findings: readonly ContractValidationFinding[];
}

function nonBlank(value: string): boolean {
  return value.trim().length > 0;
}

export function validateDomainMappings(
  mappings: readonly MgmaDomainMapping[],
): ContractValidationResult {
  const findings: ContractValidationFinding[] = [];
  const seen = new Set<string>();
  for (const mapping of mappings) {
    if (seen.has(mapping.id)) {
      findings.push({
        code: "DOMAIN_DUPLICATE_ID",
        recordId: mapping.id,
        detail: `Duplicate domain id ${mapping.id}.`,
      });
    }
    seen.add(mapping.id);
    const complete =
      nonBlank(mapping.name) &&
      nonBlank(mapping.purpose) &&
      mapping.modules.length > 0 &&
      mapping.routes.length > 0 &&
      mapping.workflows.length > 0 &&
      nonBlank(mapping.accountableOwner.roleId) &&
      mapping.sourceData.length > 0 &&
      mapping.sourceData.every(
        (source) =>
          nonBlank(source.system) &&
          source.entities.length > 0 &&
          source.keyFields.length > 0,
      ) &&
      nonBlank(mapping.corporateOfficeSponsor.roleId) &&
      mapping.consumingScopes.length > 0;
    if (!complete) {
      findings.push({
        code: "DOMAIN_INCOMPLETE_MAPPING",
        recordId: mapping.id,
        detail: `${mapping.id} is missing controlled mapping metadata.`,
      });
    }
    if (
      !(["EO", "GAD"] as const).includes(
        mapping.corporateOfficeSponsor.division,
      )
    ) {
      findings.push({
        code: "DOMAIN_SPONSOR_NOT_CORPORATE_OFFICE",
        recordId: mapping.id,
        detail: `${mapping.id} sponsor must be assigned to EO or GAD.`,
      });
    }
  }
  return { valid: findings.length === 0, findings };
}

export function validateKpiDefinitions(
  definitions: readonly KpiDefinition[],
  domains: readonly MgmaDomainMapping[] = MGMA_DOMAIN_MAPPINGS,
): ContractValidationResult {
  const findings: ContractValidationFinding[] = [];
  const seen = new Set<string>();
  const domainIds = new Set(domains.map((domain) => domain.id));
  for (const definition of definitions) {
    if (seen.has(definition.id)) {
      findings.push({
        code: "KPI_DUPLICATE_ID",
        recordId: definition.id,
        detail: `Duplicate KPI id ${definition.id}.`,
      });
    }
    seen.add(definition.id);
    const complete =
      nonBlank(definition.name) &&
      nonBlank(definition.description) &&
      nonBlank(definition.formula) &&
      nonBlank(definition.numerator.name) &&
      nonBlank(definition.numerator.definition) &&
      nonBlank(definition.denominator.name) &&
      nonBlank(definition.denominator.definition) &&
      nonBlank(definition.sourceSystem) &&
      definition.sourceFields.length > 0 &&
      nonBlank(definition.owner.roleId) &&
      Number.isFinite(definition.target) &&
      Number.isFinite(definition.threshold.value) &&
      nonBlank(definition.drillDownPath) &&
      definition.staleAfterHours > 0 &&
      definition.relevantScopes.length > 0 &&
      nonBlank(definition.targetBasis.statement) &&
      nonBlank(definition.approval.approvalReference);
    if (!complete) {
      findings.push({
        code: "KPI_INCOMPLETE_DEFINITION",
        recordId: definition.id,
        detail: `${definition.id} is missing controlled definition metadata.`,
      });
    }
    if (!domainIds.has(definition.domainId)) {
      findings.push({
        code: "KPI_UNKNOWN_DOMAIN",
        recordId: definition.id,
        detail: `${definition.id} references unknown domain ${definition.domainId}.`,
      });
    }
    const thresholdOrdered =
      definition.comparison === "gte"
        ? definition.threshold.value < definition.target
        : definition.threshold.value > definition.target;
    if (
      !thresholdOrdered ||
      definition.targetBasis.type !== "internal_controlled_prototype"
    ) {
      findings.push({
        code: "KPI_INVALID_TARGET_CONTROL",
        recordId: definition.id,
        detail: `${definition.id} target or threshold control is invalid.`,
      });
    }
    if (
      definition.targetBasis.proprietaryBenchmarkClaim !== false ||
      /mgma\s+(percentile|benchmark|survey)/i.test(
        definition.targetBasis.statement,
      )
    ) {
      findings.push({
        code: "KPI_PROPRIETARY_BENCHMARK_ATTRIBUTION",
        recordId: definition.id,
        detail: `${definition.id} improperly attributes an internal target to proprietary authority.`,
      });
    }
  }
  return { valid: findings.length === 0, findings };
}

function syntheticMeasurement(
  kpiId: ControlledKpiId,
  numerator: number,
  denominator: number,
): KpiMeasurementEvidence {
  const definition = KPI_DEFINITIONS.find(
    (candidate) => candidate.id === kpiId,
  );
  if (!definition)
    throw new Error(`Missing controlled KPI definition ${kpiId}.`);
  const value = calculateKpiValue(definition, numerator, denominator);
  if (value === null)
    throw new Error(`Invalid synthetic denominator for KPI ${kpiId}.`);
  return {
    measurementId: `measurement-synthetic-${kpiId}-2026-06-eo`,
    kpiId,
    evidenceClass: "synthetic_demo",
    scopeType: "corporate_office",
    scopeId: "EO",
    periodType: "fixed",
    periodStart: "2026-06-01",
    periodEnd: "2026-06-30",
    numerator,
    denominator,
    value,
    sourceReferences: [`synthetic://amos-ops/m1.3/kpi/${kpiId}/2026-06`],
    sourceRecordIds: [`SYNTHETIC-${kpiId}-A`, `SYNTHETIC-${kpiId}-B`],
    collectedAt: "2026-07-01T06:00:00.000Z",
  };
}

/** Fictional demonstration fixtures only; none may be promoted as production evidence. */
export const SYNTHETIC_KPI_MEASUREMENTS: readonly KpiMeasurementEvidence[] = [
  syntheticMeasurement("001", 38_000, 1_000),
  syntheticMeasurement("002", 97, 100),
  syntheticMeasurement("003", 96, 100),
  syntheticMeasurement("004", 7, 50),
  syntheticMeasurement("005", 99, 100),
  syntheticMeasurement("006", 96, 100),
  syntheticMeasurement("007", 19, 20),
  syntheticMeasurement("008", 42_900, 43_200),
  syntheticMeasurement("009", 48, 50),
  syntheticMeasurement("010", 30, 5),
  syntheticMeasurement("011", 100, 100),
  syntheticMeasurement("012", 99, 100),
  syntheticMeasurement("013", 9, 10),
  syntheticMeasurement("014", 48, 50),
] as const;
