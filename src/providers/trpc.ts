import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import { createElement, type ReactNode } from "react";
import {
  store,
  nextId,
  administerMed,
  refuseMed,
  recordPrn,
  holdMed,
  createBehavioralObs,
  createFamilyContact,
  createIncident,
  updateIncident,
  createAudit,
  createTask,
  updateTask,
  deleteTask,
  updateShift,
  respondToApproval,
  createWorkOrder,
  updateWorkOrder,
  createSession,
  createReferral,
  getMedSummary,
  getResidentialSummary,
  assignBed,
  vacateBed,
  createShift as createShiftFn,
  createMeeting,
  createEscalation,
  type DemoRecord,
} from "@/data/liveStore";
import {
  EVALUATION_SESSION_TOKEN,
  mayUseEvaluationData,
  runtimeConfig,
  type EvaluationFallbackKind,
} from "@/config/runtime";
import { createResilientFetch } from "@/providers/resilient-fetch";
import {
  CCMG_SYNTHETIC_DASHBOARD,
  getSyntheticCcmgReferralDetail,
} from "@/components/ccmg/ccmg-synthetic-data";

export const M41C_EVALUATION_CLINICAL_FIXTURES_SANITIZED =
  "M41C_EVALUATION_CLINICAL_FIXTURES_SANITIZED" as const;
export const M41C_BHC_GET_PATIENT_FALLBACK_OUTCOME_MODE =
  "metadata_only_quarantine" as const;

export const trpc = createTRPCReact<AppRouter>();

function isDemoRecord(value: unknown): value is DemoRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapDemoInput(value: unknown): DemoRecord {
  if (!isDemoRecord(value)) return {};
  return isDemoRecord(value.json) ? value.json : value;
}

function parseDemoInputs(path: string): DemoRecord[] {
  try {
    const url = new URL(
      path,
      globalThis.location?.origin ?? "http://localhost",
    );
    const encodedInput = url.searchParams.get("input");
    if (!encodedInput) return [{}];
    const parsed: unknown = JSON.parse(encodedInput);
    if (!isDemoRecord(parsed)) return [{}];

    const batchEntries = Object.entries(parsed)
      .filter(([key]) => /^\d+$/.test(key))
      .sort(([left], [right]) => Number(left) - Number(right));
    return batchEntries.length > 0
      ? batchEntries.map(([, value]) => unwrapDemoInput(value))
      : [unwrapDemoInput(parsed)];
  } catch {
    return [{}];
  }
}

function readDemoString(input: DemoRecord, key: string, fallback = ""): string {
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

// ─── Demo Data for Static Deployments ──────────────────────

const DEMO_USERS = [
  {
    id: "eval-u1",
    email: "evaluator@amos-ops.invalid",
    firstName: "AMOS",
    lastName: "Evaluator",
    name: "AMOS Evaluator",
    role: "rcs-day",
    department: "Evaluation",
    isActive: true,
    createdAt: "2026-07-01",
  },
  {
    id: "u1",
    email: "admin@amos-ops.invalid",
    firstName: "Demo",
    lastName: "Executive",
    name: "Demo Executive",
    role: "administrator",
    department: "Executive",
    isActive: true,
    createdAt: "2026-06-01",
  },
  {
    id: "u2",
    email: "clinical.director@amos-ops.invalid",
    firstName: "Dr.",
    lastName: "Carter",
    name: "Demo Clinical Director",
    role: "treatment-director",
    department: "Clinical",
    isActive: true,
    createdAt: "2026-06-02",
  },
  {
    id: "u3",
    email: "clinical.lead@amos-ops.invalid",
    firstName: "Synthetic",
    lastName: "Brooks",
    name: "Demo Clinical Lead",
    role: "clinical-director",
    department: "Clinical",
    isActive: true,
    createdAt: "2026-06-02",
  },
  {
    id: "u4",
    email: "case.manager@amos-ops.invalid",
    firstName: "Synthetic-Person-019",
    lastName: "Lee",
    name: "Demo Case Manager",
    role: "case-manager",
    department: "Clinical",
    isActive: true,
    createdAt: "2026-06-03",
  },
  {
    id: "u5",
    email: "hr@amos-ops.invalid",
    firstName: "HR",
    lastName: "Director",
    name: "HR Director",
    role: "hr-director",
    department: "Human Resources",
    isActive: true,
    createdAt: "2026-06-03",
  },
  {
    id: "u6",
    email: "gro.admin@amos-ops.invalid",
    firstName: "GRO",
    lastName: "Admin",
    name: "GRO Administrator",
    role: "gro-administrator",
    department: "GRO Residential",
    isActive: true,
    createdAt: "2026-06-04",
  },
];

const DEMO_PEOPLE = [
  {
    id: "h1",
    firstName: "Demo",
    lastName: "Executive",
    employeeId: "EMP001",
    role: "super-admin",
    department: "Executive",
    lane: "management",
    isActive: 1,
    isEmployee: 1,
    hireDate: "2026-01-01",
    supervisor: null,
    createdAt: "2026-01-01",
  },
  {
    id: "h2",
    firstName: "Dr.",
    lastName: "Carter",
    employeeId: "EMP002",
    role: "treatment-director",
    department: "Clinical",
    lane: "management",
    isActive: 1,
    isEmployee: 1,
    hireDate: "2026-01-15",
    supervisor: "Demo Executive",
    createdAt: "2026-01-15",
  },
  {
    id: "h3",
    firstName: "Synthetic",
    lastName: "Brooks",
    employeeId: "EMP003",
    role: "clinical-director",
    department: "Clinical",
    lane: "management",
    isActive: 1,
    isEmployee: 1,
    hireDate: "2026-02-01",
    supervisor: "Demo Clinical Director",
    createdAt: "2026-02-01",
  },
  {
    id: "h4",
    firstName: "Synthetic-Person-019",
    lastName: "Lee",
    employeeId: "EMP004",
    role: "case-manager",
    department: "Clinical",
    lane: "activation",
    isActive: 1,
    isEmployee: 1,
    hireDate: "2026-03-01",
    supervisor: "Demo Clinical Lead",
    createdAt: "2026-03-01",
  },
  {
    id: "h5",
    firstName: "RCS",
    lastName: "Lead",
    employeeId: "EMP005",
    role: "rcs-lead",
    department: "GRO Residential",
    lane: "activation",
    isActive: 1,
    isEmployee: 1,
    hireDate: "2026-04-01",
    supervisor: "GRO Administrator",
    createdAt: "2026-04-01",
  },
];

const DEMO_PATIENTS = [
  {
    id: "p1",
    firstName: "Youth",
    lastName: "A",
    dateOfBirth: "2010-03-15",
    status: "active",
    gender: "Male",
    insuranceId: "INS001",
    assignedClinician: "Demo Clinical Director",
  },
  {
    id: "p2",
    firstName: "Youth",
    lastName: "B",
    dateOfBirth: "2011-07-22",
    status: "active",
    gender: "Female",
    insuranceId: "INS002",
    assignedClinician: "Demo Clinical Lead",
  },
  {
    id: "p3",
    firstName: "Youth",
    lastName: "C",
    dateOfBirth: "2009-11-08",
    status: "pending",
    gender: "Male",
    insuranceId: "INS003",
    assignedClinician: "Demo Case Manager",
  },
];

const DEMO_CLAIMS = {
  claims: [
    {
      id: "c1",
      claimNumber: "CLM-2026-001",
      patientName: "Youth A",
      serviceDate: "2026-06-01",
      status: "submitted",
      totalAmount: 12500,
      paidAmount: 0,
    },
    {
      id: "c2",
      claimNumber: "CLM-2026-002",
      patientName: "Youth B",
      serviceDate: "2026-06-05",
      status: "paid",
      totalAmount: 15000,
      paidAmount: 15000,
    },
    {
      id: "c3",
      claimNumber: "CLM-2026-003",
      patientName: "Youth C",
      serviceDate: "2026-06-10",
      status: "pending",
      totalAmount: 8750,
      paidAmount: 0,
    },
  ],
  total: 3,
};

const DEMO_KPIs = {
  "bhc.dashboardKPIs": {
    activePatients: 3,
    sessionsThisWeek: 12,
    totalPatients: 3,
    pendingApprovals: 1,
    highRiskCount: 0,
  },
  "revenue.dashboardKPIs": {
    totalClaims: 3,
    collectionRate: 33,
    totalBilled: 36250,
    totalCollected: 15000,
    pendingClaims: 2,
  },
  "qa.dashboardKPIs": {
    totalAudits: 2,
    openIncidents: 1,
    auditScore: 85,
    compliantItems: 42,
  },
  "gro.dashboardKPIs": {
    activeReferrals: 2,
    conversionRate: 50,
    newThisMonth: 3,
  },
  "gad.dashboardKPIs": { openWorkOrders: 2, vendorCount: 5, facilityCount: 1 },
  "hr.dashboardKPIs": {
    totalPeople: 5,
    inPipeline: 3,
    activeAlerts: 1,
    avgDaysToClear: 14,
    recentActivity: 8,
    avgCompletion: 70,
  },
  "workflow.dashboardKPIs": {
    totalInstances: 12,
    pendingInstances: 5,
    completedInstances: 7,
    rejectedInstances: 0,
    pendingApprovals: 3,
  },
  "nil.getStats": {
    totalEntities: 45,
    totalRelationships: 128,
    entityTypes: [],
    relationTypes: [],
    moduleDistribution: [],
  },
  "msgraph.status": {
    connected: false,
    tenant: "Not configured",
    syncMode: "none",
    users: { synced: 0, total: 0 },
    groups: { synced: 0, total: 0 },
    lastSync: null,
  },
  "user.stats": {
    total: 6,
    active: 6,
    inactive: 0,
    byRole: [
      { role: "administrator", c: 1 },
      { role: "clinical-director", c: 1 },
      { role: "shift-supervisor", c: 1 },
      { role: "hr-compliance-officer", c: 1 },
      { role: "hr-director", c: 1 },
      { role: "rcs-day", c: 1 },
    ],
  },
};

const PHASE3_DEMO_MODULES = [
  { milestone: "M3.1", domain: "COMPLIANCE", count: 7 },
  { milestone: "M3.2", domain: "REVENUE", count: 8 },
  { milestone: "M3.3", domain: "WORKFORCE", count: 8 },
  { milestone: "M3.4", domain: "GAD", count: 8 },
] as const;

function buildPhase3DemoOverview() {
  const links = [
    {
      id: "SYNTH-P3-LINK-COMPLIANCE",
      domain: "COMPLIANCE",
      source_division: "BHC",
      source_type: "ccmg_case",
      source_id: "M21-CASE-EXISTING-001",
      target_type: "m31_mock_survey",
      target_id: "SYNTH-M31-SURVEY-001",
      relation: "assures",
    },
    {
      id: "SYNTH-P3-LINK-REVENUE",
      domain: "REVENUE",
      source_division: "BHC",
      source_type: "phase2_claim_handoff",
      source_id: "M22-CLAIM-HANDOFF-0024",
      target_type: "m32_claim_cycle",
      target_id: "SYNTH-M32-CLAIM-T1017-001",
      relation: "funds",
    },
    {
      id: "SYNTH-P3-LINK-WORKFORCE",
      domain: "WORKFORCE",
      source_division: "GRO",
      source_type: "phase2_shift_staffing_evaluation",
      source_id: "SYNTH-M24-SHIFT-00062",
      target_type: "m33_workforce_record",
      target_id: "SYNTH-M33-WORKFORCE-T1",
      relation: "staffs",
    },
    {
      id: "SYNTH-P3-LINK-GAD",
      domain: "GAD",
      source_division: "GRO",
      source_type: "phase2_gro_placement",
      source_id: "SYNTH-M24-PLACEMENT-00001",
      target_type: "m34_facility_stage",
      target_id: "SYNTH-M34-STAGE-1",
      relation: "maintains",
    },
  ];
  const titles: Record<string, string> = {
    COMPLIANCE: "Close routed chart-audit finding",
    REVENUE: "Complete T1017 and H2017 claim cycles",
    WORKFORCE: "Release qualified representative staff to duty",
    GAD: "Verify campus facilities and support services",
  };
  const owners: Record<string, string> = {
    COMPLIANCE: "hr-compliance-officer",
    REVENUE: "revenue-cycle-manager",
    WORKFORCE: "hr-director",
    GAD: "facilities-manager",
  };
  return {
    initialized: true,
    supportCase: {
      id: "SYNTH-PHASE3-SUPPORT-001",
      source_episode_id: "SYNTH-PHASE2-EPISODE-001",
      status: "active",
      evidence_class: "synthetic_demo",
      preview_only: true,
    },
    links,
    workItems: PHASE3_DEMO_MODULES.map((module) => ({
      id: `SYNTH-P3-WORK-${module.milestone.replace(".", "")}`,
      domain: module.domain,
      title: titles[module.domain],
      status: "in_progress",
      assigned_role: owners[module.domain],
      evidenceIds: [],
    })),
    auditEvents: [],
    snapshots: [],
    scenarios: [],
    demoControl: {
      environment_id: "AMOS-OPS-PHASE3-EVALUATION",
      environment_label: "DEMO - NOT FOR CARE DELIVERY",
      data_store_label: "static-non-acceptance-preview",
      production_writes_blocked: 1,
      kill_switch_enabled: 0,
      data_expires_at: "2027-01-14T00:00:00.000Z",
      access_reviewed_at: "2026-07-14T13:00:00.000Z",
      preview_only: true,
    },
  };
}

function getDemoData(path: string): unknown {
  let pathname = path;
  try {
    pathname = new URL(path, globalThis.location?.origin ?? "http://localhost")
      .pathname;
  } catch {
    // Retain the supplied path when URL parsing is unavailable.
  }
  const marker = "/api/trpc/";
  const procedurePath = pathname.includes(marker)
    ? pathname.slice(pathname.indexOf(marker) + marker.length)
    : pathname.replace(/^\/?api\/trpc\/?/, "");
  const parts = procedurePath.split(",");
  const inputs = parseDemoInputs(path);
  if (parts.length > 1) {
    return parts.map((part, index) =>
      getSingleDemoData(part.trim(), inputs[index] ?? {}),
    );
  }
  return getSingleDemoData(parts[0], inputs[0] ?? {});
}

function getSingleDemoData(procedure: string, input: DemoRecord = {}): unknown {
  if (procedure === "m41a.featureCatalog")
    return [
      "Enterprise executive dashboard",
      "BHC and GRO profit-center dashboards",
      "EO and GAD corporate-office dashboards",
      "Governed three-click drilldown",
      "Metric lineage and reconciliation",
      "Threshold-alert decision lifecycle",
      "Role and sensitive-detail suppression",
      "Data-quality exception behavior",
    ].map((capability, index) => ({
      criterionId: `M4.1A-${String(index + 1).padStart(2, "0")}`,
      capability,
      previewOnly: true,
      valuesAvailable: false,
      mutationAvailable: false,
    }));
  if (procedure === "phase3.overview") return buildPhase3DemoOverview();
  if (procedure === "phase3.controlStatus")
    return buildPhase3DemoOverview().demoControl;
  if (procedure === "phase3.featureCatalog") return [];
  if (procedure === "auth.me") return DEMO_USERS[0];
  if (procedure === "auth.login")
    return { token: EVALUATION_SESSION_TOKEN, user: DEMO_USERS[0] };
  if (procedure === "auth.register")
    return { token: EVALUATION_SESSION_TOKEN, user: DEMO_USERS[0] };
  if (procedure === "auth.evaluationSession")
    return {
      status: "authenticated",
      token: EVALUATION_SESSION_TOKEN,
      user: {
        ...DEMO_USERS[1],
        id: "SYNTH-EVALUATOR-ADMINISTRATOR",
        email: "evaluator+administrator@amos-ops.invalid",
        firstName: "Synthetic",
        lastName: "Administrator",
        name: "Synthetic Administrator",
        mfaEnabled: false,
      },
    };
  if (procedure === "user.list") return DEMO_USERS;
  if (procedure === "user.stats") return DEMO_KPIs["user.stats"];
  if (procedure === "hr.list") return DEMO_PEOPLE;
  if (procedure === "hr.listPeople") return DEMO_PEOPLE;
  if (procedure === "hr.getModuleStatuses") return [];
  if (procedure === "hr.listTransitions") return [];
  if (procedure === "hr.dashboardKPIs") return DEMO_KPIs["hr.dashboardKPIs"];
  if (procedure === "bhc.listPatients") return DEMO_PATIENTS;
  if (procedure === "bhc.dashboardKPIs") return DEMO_KPIs["bhc.dashboardKPIs"];
  if (procedure === "bhc.listPlans") return [];
  if (procedure === "bhc.listSessions") return [];
  if (procedure === "bhc.clinicianWorkload")
    return { total: 0, byClinician: [] };
  if (procedure === "revenue.listClaims") return DEMO_CLAIMS;
  if (procedure === "revenue.dashboardKPIs")
    return DEMO_KPIs["revenue.dashboardKPIs"];
  if (procedure === "qa.listAudits") return [];
  if (procedure === "qa.dashboardKPIs") return DEMO_KPIs["qa.dashboardKPIs"];
  if (procedure === "gad.listWorkOrders") return [];
  if (procedure === "gad.dashboardKPIs") return DEMO_KPIs["gad.dashboardKPIs"];
  if (procedure === "gro.listReferrals") return [];
  if (procedure === "gro.dashboardKPIs") return DEMO_KPIs["gro.dashboardKPIs"];
  if (procedure === "nil.getStats") return DEMO_KPIs["nil.getStats"];
  if (procedure === "nil.searchEntities") return [];
  if (procedure === "nil.getEntityNetwork")
    return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };
  if (procedure === "nil.getRecommendations") return [];
  if (procedure === "nil.findPath") return { found: false, path: [], hops: 0 };
  if (procedure === "workflow.listRules")
    return [
      {
        id: "hr-status-change",
        name: "HR Status Change Alert",
        event: "hr.status-changed",
        actions: [{ type: "notify", target: "hr-director", priority: "high" }],
      },
    ];
  if (procedure === "workflow.dashboardKPIs")
    return DEMO_KPIs["workflow.dashboardKPIs"];
  if (procedure === "workflow.listInstances") return [];
  if (procedure === "workflow.listPendingApprovals") return [];
  if (procedure === "workflow.auditLog") return [];
  if (procedure === "msgraph.status") return DEMO_KPIs["msgraph.status"];
  if (procedure === "msgraph.listUsers") return [];
  if (procedure === "msgraph.listGroups") return [];
  if (procedure === "msgraph.syncHistory") return [];
  // ─── DASHBOARD AGGREGATE ENDPOINTS ───────────────────────
  if (procedure === "dashboard.overview")
    return {
      revenue: {
        totalClaims: 8,
        deniedClaims: 1,
        totalBilled: 5285000,
        totalCollected: 3250000,
        collectionRate: 61,
      },
      bhc: {
        activePatients: 5,
        sessionsThisWeek: 8,
        highRiskCount: 1,
        pendingApprovals: 1,
      },
      campus: {
        occupiedBeds: 12,
        totalBeds: 16,
        occupancyRate: 75,
        facilityCount: 2,
      },
      mgma: { domainCount: 7, kpiCount: 42 },
      part2: {
        activeSUDRecords: 3,
        validConsents: 3,
        expiredConsents: 0,
        recentAudits: 1,
      },
      gad: { overdueWorkOrders: 1, openWorkOrders: 3 },
      documents: { total: 12, published: 6, draft: 3 },
    };
  if (procedure === "dashboard.operationalKPIs")
    return {
      censusToday: 12,
      admissions7d: 2,
      discharges7d: 1,
      pendingAdmissions: 1,
      bedTurnoverRate: 5,
      avgLengthOfStay: 45,
      medicationErrors7d: 0,
      incidents7d: 1,
      restraints7d: 0,
      safetyRoundsCompleted: 28,
      shiftCoverageRate: 95,
      trainingComplianceRate: 88,
    };
  if (procedure === "dashboard.complianceKPIs")
    return {
      overallScore: 94,
      openCAPs: 3,
      overdueItems: 1,
      hipaaScore: 98,
      stateLicensureScore: 92,
      staffCredentialScore: 88,
      incidentReportingScore: 100,
      medicationMgmtScore: 95,
      youthRightsScore: 97,
      openAudits: 2,
      completedAuditsThisQuarter: 3,
    };
  if (procedure === "dashboard.clinicalKPIs")
    return {
      activePatients: 5,
      sessionsThisWeek: 8,
      sessionCompletionRate: 92,
      avgSessionDuration: 55,
      treatmentPlansActive: 4,
      treatmentPlansOverdue: 1,
      readmissionRate: 5,
      authorizationStatus: 80,
      outcomeMeasuresCompleted: 12,
      highRiskPatients: 1,
    };
  if (procedure === "dashboard.revenueKPIs")
    return {
      claimsSubmitted30d: 6,
      approvalRate: 75,
      denialRate: 15,
      avgDaysToPayment: 18,
      outstandingAR: 1250000,
      authorizationExpiry30d: 1,
      writeOffs30d: 45000,
      netRevenue30d: 980000,
    };
  if (procedure === "dashboard.workforceKPIs")
    return {
      totalStaff: 24,
      openPositions: 3,
      credentialComplianceRate: 88,
      trainingCompletionRate: 82,
      turnoverRate12m: 12,
      pendingSeparations: 1,
      expiringCredentials: 2,
      avgTenureMonths: 18,
      overtimeHoursWeek: 16,
      agencyUsagePercent: 5,
    };
  if (procedure === "dashboard.executiveKPIs")
    return {
      revenueMTD: 485000,
      operatingCensus: 75,
      compliancePosture: 94,
      criticalRisks: 1,
      staffingLevel: 92,
      strategicProjectStatus: 68,
      boardMeetingDays: 14,
    };
  if (procedure === "ccmg.bhcDashboard")
    return {
      departments: {
        mhtcm: { activePlans: 4, pendingIntakes: 1, avgCaseLoad: 8 },
        mhrs: { activePrograms: 3, groupsThisWeek: 6 },
      },
      intakeQueue: [
        {
          id: "i1",
          youthName: "Test Youth",
          status: "pending",
          referralDate: "2026-06-28",
        },
      ],
    };
  if (procedure === "m19.getCampusSummary")
    return {
      mainUnit: { occupied: 8, capacity: 8, status: "full" },
      ecsUnit: { occupied: 4, capacity: 8, status: "available" },
      cypressUnit: { occupied: 0, capacity: 16, status: "planned" },
      totalOccupied: 12,
      totalCapacity: 32,
    };
  // ─── BHC CLINICAL ENDPOINTS ──────────────────────────────
  if (procedure === "bhc.listPatients")
    return {
      patients: [
        {
          id: "p1",
          firstName: "Synthetic-Person-001",
          lastName: "Johnson",
          age: 15,
          gender: "M",
          status: "active",
          admissionDate: "2026-04-01",
          diagnoses: ["F90.0 ADHD", "F91.1 Conduct Disorder"],
          assignedClinician: "Demo Clinical Director",
        },
        {
          id: "p2",
          firstName: "Synthetic-Person-003",
          lastName: "Williams",
          age: 14,
          gender: "F",
          status: "active",
          admissionDate: "2026-04-15",
          diagnoses: ["F32.9 Major Depression", "F43.10 PTSD"],
          assignedClinician: "Demo Clinical Lead",
        },
        {
          id: "p3",
          firstName: "Synthetic-Person-004",
          lastName: "Ramirez",
          age: 16,
          gender: "M",
          status: "active",
          admissionDate: "2026-05-01",
          diagnoses: ["F31.9 Bipolar II", "F19.10 Substance Use"],
          assignedClinician: "Demo Clinical Director",
        },
        {
          id: "p4",
          firstName: "Synthetic-Person-005",
          lastName: "Peterson",
          age: 13,
          gender: "F",
          status: "active",
          admissionDate: "2026-05-20",
          diagnoses: ["F41.1 Generalized Anxiety", "F84.0 ASD Traits"],
          assignedClinician: "Demo Clinical Lead",
        },
        {
          id: "p5",
          firstName: "Synthetic-Person-006",
          lastName: "Brooks",
          age: 15,
          gender: "M",
          status: "active",
          admissionDate: "2026-06-10",
          diagnoses: ["F43.10 PTSD", "F91.8 Oppositional Defiant"],
          assignedClinician: "Demo Case Manager",
        },
      ],
    };
  if (procedure === "bhc.listSessions")
    return {
      sessions: [
        {
          id: "s1",
          patientId: "p1",
          patientName: "Synthetic Youth 001",
          sessionType: "Individual Therapy",
          scheduledDate: "2026-06-30",
          scheduledTime: "09:00",
          status: "scheduled",
          duration: 60,
          clinician: "Demo Clinical Director",
        },
        {
          id: "s2",
          patientId: "p2",
          patientName: "Synthetic Youth 003",
          sessionType: "Group CBT",
          scheduledDate: "2026-06-30",
          scheduledTime: "10:30",
          status: "scheduled",
          duration: 90,
          clinician: "Demo Clinical Lead",
        },
        {
          id: "s3",
          patientId: "p3",
          patientName: "Synthetic Youth 004",
          sessionType: "Family Session",
          scheduledDate: "2026-06-30",
          scheduledTime: "14:00",
          status: "scheduled",
          duration: 60,
          clinician: "Demo Clinical Director",
        },
        {
          id: "s4",
          patientId: "p4",
          patientName: "Synthetic Youth 008",
          sessionType: "Psychosocial Rehab",
          scheduledDate: "2026-07-01",
          scheduledTime: "11:00",
          status: "scheduled",
          duration: 60,
          clinician: "Demo Clinical Lead",
        },
        {
          id: "s5",
          patientId: "p5",
          patientName: "Synthetic Youth 006",
          sessionType: "Skills Training",
          scheduledDate: "2026-07-01",
          scheduledTime: "15:00",
          status: "scheduled",
          duration: 45,
          clinician: "Demo Case Manager",
        },
        {
          id: "s6",
          patientId: "p1",
          patientName: "Synthetic Youth 001",
          sessionType: "Case Management",
          scheduledDate: "2026-07-02",
          scheduledTime: "10:00",
          status: "scheduled",
          duration: 30,
          clinician: "Demo Case Manager",
        },
      ],
    };
  if (procedure === "bhc.dashboardKPIs")
    return {
      activePatients: 5,
      sessionsToday: 3,
      sessionsThisWeek: 8,
      highRiskCount: 1,
      pendingPlans: 1,
      overdueNotes: 2,
      authorizationExpiring: 1,
      outcomeMeasuresDue: 3,
    };
  if (procedure === "bhc.clinicianWorkload")
    return {
      clinicians: [
        {
          name: "Demo Clinical Director",
          activeCases: 3,
          sessionsToday: 2,
          sessionsThisWeek: 6,
          notesOverdue: 1,
          status: "active",
        },
        {
          name: "Demo Clinical Lead",
          activeCases: 2,
          sessionsToday: 1,
          sessionsThisWeek: 4,
          notesOverdue: 0,
          status: "active",
        },
        {
          name: "Demo Case Manager",
          activeCases: 2,
          sessionsToday: 0,
          sessionsThisWeek: 3,
          notesOverdue: 1,
          status: "active",
        },
        {
          name: "Dr. Sarah Kim",
          activeCases: 1,
          sessionsToday: 0,
          sessionsThisWeek: 2,
          notesOverdue: 0,
          status: "part-time",
        },
      ],
    };
  if (procedure === "bhc.getPatient")
    return {
      id: "p1",
      firstName: "Synthetic-Person-001",
      lastName: "Johnson",
      age: 15,
      gender: "M",
      status: "active",
      admissionDate: "2026-04-01",
      diagnoses: ["F90.0 ADHD", "F91.1 Conduct Disorder"],
      assignedClinician: "Demo Clinical Director",
      insurancePlan: "Superior HealthPlan",
      guardianName: "Synthetic Guardian 01",
      guardianPhone: "(713) 555-0101",
      allergies: ["Penicillin"],
      medications: ["Methylphenidate 10mg"],
      roomNumber: "201A",
    };
  if (procedure === "bhc.listInsurancePlans")
    return {
      plans: [
        {
          id: "ip1",
          name: "Superior HealthPlan",
          type: "Medicaid",
          payer: "Texas Medicaid",
          isActive: true,
        },
        {
          id: "ip2",
          name: "Blue Cross Blue Shield TX",
          type: "Commercial",
          payer: "BCBS",
          isActive: true,
        },
        {
          id: "ip3",
          name: "UnitedHealthcare Community Plan",
          type: "Medicaid Managed Care",
          payer: "UHC",
          isActive: true,
        },
      ],
    };
  if (procedure === "bhc.listTreatmentPlans")
    return {
      plans: [
        {
          id: "tp1",
          patientId: "p1",
          patientName: "Synthetic Youth 001",
          primaryDiagnosis: "F90.0 ADHD",
          goals: 4,
          goalsCompleted: 2,
          status: "active",
          startDate: "2026-04-01",
          reviewDate: "2026-07-01",
          clinician: "Demo Clinical Director",
        },
        {
          id: "tp2",
          patientId: "p2",
          patientName: "Synthetic Youth 003",
          primaryDiagnosis: "F32.9 Major Depression",
          goals: 5,
          goalsCompleted: 2,
          status: "active",
          startDate: "2026-04-15",
          reviewDate: "2026-07-15",
          clinician: "Demo Clinical Lead",
        },
        {
          id: "tp3",
          patientId: "p3",
          patientName: "Synthetic Youth 004",
          primaryDiagnosis: "F31.9 Bipolar II",
          goals: 6,
          goalsCompleted: 1,
          status: "active",
          startDate: "2026-05-01",
          reviewDate: "2026-08-01",
          clinician: "Demo Clinical Director",
        },
        {
          id: "tp4",
          patientId: "p4",
          patientName: "Synthetic Youth 008",
          primaryDiagnosis: "F41.1 Generalized Anxiety",
          goals: 4,
          goalsCompleted: 1,
          status: "active",
          startDate: "2026-05-20",
          reviewDate: "2026-08-20",
          clinician: "Demo Clinical Lead",
        },
      ],
    };
  if (procedure === "bhc.listOutcomeMeasures")
    return {
      measures: [],
      governedAssessmentReference: {
        milestone: "M4.1C",
        disposition: M41C_EVALUATION_CLINICAL_FIXTURES_SANITIZED,
        rawLegacyScoresReturned: false,
        humanReviewRequired: true,
        productionRows: 0,
        liveWrites: 0,
      },
    };
  // ─── CCMG / MHTCM / MHRS ENDPOINTS ───────────────────────
  if (procedure === "ccmg.bhcDashboard")
    return {
      departments: {
        bhc: {
          activePatients: 5,
          sessionsToday: 3,
          sessionsThisWeek: 8,
          highRiskCount: 1,
        },
        mhtcm: { activePlans: 4, pendingIntakes: 1, avgCaseLoad: 8 },
        mhrs: { activePrograms: 3, groupsThisWeek: 6 },
      },
      intakeQueue: [
        {
          id: "iq1",
          youthName: "Synthetic Youth 009",
          age: 14,
          referredBy: "Houston ISD Counselor",
          referralDate: "2026-06-25",
          status: "pending_assessment",
          priority: "high",
        },
        {
          id: "iq2",
          youthName: "Synthetic Youth 011",
          age: 16,
          referredBy: "Texas CPS Region 6",
          referralDate: "2026-06-28",
          status: "scheduled",
          priority: "urgent",
          scheduledDate: "2026-07-01",
        },
      ],
    };
  if (procedure === "mhtcm.mhtcmDashboard")
    return {
      activeCases: 8,
      newReferrals: 2,
      pendingIntakes: 1,
      caseReviewsDue: 3,
      dischargePlanning: 1,
      aftercareFollowups: 2,
    };
  if (procedure === "mhrs.mhrsDashboard")
    return {
      activeGroups: 3,
      sessionsThisWeek: 6,
      participantAttendance: 85,
      groups: [
        {
          id: "g1",
          name: "Adolescent CBT Group",
          facilitator: "Demo Clinical Lead",
          schedule: "Mon/Wed 10:00 AM",
          participants: 4,
          maxParticipants: 8,
          status: "active",
        },
        {
          id: "g2",
          name: "Substance Use Recovery",
          facilitator: "Dr. Sarah Kim",
          schedule: "Tue/Thu 2:00 PM",
          participants: 3,
          maxParticipants: 6,
          status: "active",
        },
        {
          id: "g3",
          name: "Life Skills & Independent Living",
          facilitator: "Demo Case Manager",
          schedule: "Mon/Wed/Fri 3:00 PM",
          participants: 5,
          maxParticipants: 10,
          status: "active",
        },
      ],
    };
  // ─── REVENUE CYCLE ENDPOINTS ─────────────────────────────
  if (procedure === "revenue.listClaims")
    return {
      claims: [
        {
          id: "rc1",
          claimNumber: "CLM-2026-001",
          patientName: "Synthetic Youth 001",
          serviceDate: "2026-06-01",
          amount: 12500,
          status: "approved",
          payer: "Superior HealthPlan",
          agingDays: 0,
        },
        {
          id: "rc2",
          claimNumber: "CLM-2026-002",
          patientName: "Synthetic Youth 003",
          serviceDate: "2026-06-05",
          amount: 18200,
          status: "submitted",
          payer: "Blue Cross Blue Shield TX",
          agingDays: 12,
        },
        {
          id: "rc3",
          claimNumber: "CLM-2026-003",
          patientName: "Synthetic Youth 004",
          serviceDate: "2026-06-08",
          amount: 22400,
          status: "draft",
          payer: "UnitedHealthcare",
          agingDays: 0,
        },
        {
          id: "rc4",
          claimNumber: "CLM-2026-004",
          patientName: "Synthetic Youth 008",
          serviceDate: "2026-06-10",
          amount: 16800,
          status: "approved",
          payer: "Superior HealthPlan",
          agingDays: 5,
        },
        {
          id: "rc5",
          claimNumber: "CLM-2026-005",
          patientName: "Synthetic Youth 006",
          serviceDate: "2026-06-12",
          amount: 19600,
          status: "denied",
          payer: "Blue Cross Blue Shield TX",
          agingDays: 18,
        },
        {
          id: "rc6",
          claimNumber: "CLM-2026-006",
          patientName: "Synthetic Youth 001",
          serviceDate: "2026-06-15",
          amount: 14200,
          status: "submitted",
          payer: "UnitedHealthcare",
          agingDays: 8,
        },
        {
          id: "rc7",
          claimNumber: "CLM-2026-007",
          patientName: "Synthetic Youth 003",
          serviceDate: "2026-06-20",
          amount: 20800,
          status: "draft",
          payer: "Superior HealthPlan",
          agingDays: 0,
        },
        {
          id: "rc8",
          claimNumber: "CLM-2026-008",
          patientName: "Synthetic Youth 004",
          serviceDate: "2026-06-22",
          amount: 25100,
          status: "approved",
          payer: "Blue Cross Blue Shield TX",
          agingDays: 2,
        },
      ],
    };
  if (procedure === "revenue.agingReport")
    return {
      totalOutstanding: 1250000,
      byBucket: [
        { bucket: "0-30", amount: 500000, count: 12 },
        { bucket: "31-60", amount: 375000, count: 8 },
        { bucket: "61-90", amount: 250000, count: 5 },
        { bucket: "90+", amount: 125000, count: 3 },
      ],
    };
  if (procedure === "revenue.agingQueueByPayer")
    return {
      payers: [
        {
          id: "py1",
          name: "Superior HealthPlan",
          totalOutstanding: 450000,
          buckets: {
            "0-30": 200000,
            "31-60": 150000,
            "61-90": 75000,
            "90+": 25000,
          },
          claimCount: 8,
        },
        {
          id: "py2",
          name: "Blue Cross Blue Shield TX",
          totalOutstanding: 380000,
          buckets: {
            "0-30": 150000,
            "31-60": 130000,
            "61-90": 60000,
            "90+": 40000,
          },
          claimCount: 6,
        },
        {
          id: "py3",
          name: "UnitedHealthcare",
          totalOutstanding: 270000,
          buckets: {
            "0-30": 100000,
            "31-60": 60000,
            "61-90": 70000,
            "90+": 40000,
          },
          claimCount: 5,
        },
        {
          id: "py4",
          name: "Aetna Better Health",
          totalOutstanding: 150000,
          buckets: {
            "0-30": 50000,
            "31-60": 35000,
            "61-90": 45000,
            "90+": 20000,
          },
          claimCount: 3,
        },
      ],
    };
  if (procedure === "revenue.listAuthorizations")
    return {
      authorizations: [
        {
          id: "ra1",
          patientName: "Synthetic Youth 001",
          authNumber: "AUTH-TX-88452",
          serviceType: "Residential Treatment",
          approvedUnits: 90,
          usedUnits: 62,
          startDate: "2026-04-01",
          endDate: "2026-09-30",
          status: "approved",
          payer: "Superior HealthPlan",
        },
        {
          id: "ra2",
          patientName: "Synthetic Youth 003",
          authNumber: "AUTH-TX-88471",
          serviceType: "Residential Treatment",
          approvedUnits: 90,
          usedUnits: 48,
          startDate: "2026-04-15",
          endDate: "2026-10-15",
          status: "approved",
          payer: "Blue Cross Blue Shield TX",
        },
        {
          id: "ra3",
          patientName: "Synthetic Youth 004",
          authNumber: "AUTH-TX-88503",
          serviceType: "Intensive Outpatient",
          approvedUnits: 60,
          usedUnits: 25,
          startDate: "2026-05-01",
          endDate: "2026-08-01",
          status: "approved",
          payer: "UnitedHealthcare",
        },
        {
          id: "ra4",
          patientName: "Synthetic Youth 008",
          authNumber: "AUTH-TX-88520",
          serviceType: "Residential Treatment",
          approvedUnits: 0,
          usedUnits: 0,
          startDate: null,
          endDate: null,
          status: "pending",
          payer: "Superior HealthPlan",
        },
        {
          id: "ra5",
          patientName: "Synthetic Youth 006",
          authNumber: "AUTH-TX-88541",
          serviceType: "Residential Treatment",
          approvedUnits: 45,
          usedUnits: 45,
          startDate: "2026-03-01",
          endDate: "2026-06-01",
          status: "expired",
          payer: "Blue Cross Blue Shield TX",
        },
      ],
    };
  if (procedure === "revenue.listSubmittableClaims")
    return {
      claims: [
        {
          id: "rc3",
          claimNumber: "CLM-2026-003",
          patientName: "Synthetic Youth 004",
          serviceDate: "2026-06-08",
          amount: 22400,
          status: "draft",
          payer: "UnitedHealthcare",
          lastModified: "2026-06-28",
        },
        {
          id: "rc7",
          claimNumber: "CLM-2026-007",
          patientName: "Synthetic Youth 003",
          serviceDate: "2026-06-20",
          amount: 20800,
          status: "draft",
          payer: "Superior HealthPlan",
          lastModified: "2026-06-27",
        },
        {
          id: "rc9",
          claimNumber: "CLM-2026-009",
          patientName: "Synthetic Youth 006",
          serviceDate: "2026-06-25",
          amount: 18700,
          status: "draft",
          payer: "Blue Cross Blue Shield TX",
          lastModified: "2026-06-26",
        },
      ],
    };
  if (procedure === "revenue.getClaim")
    return {
      id: "rc1",
      claimNumber: "CLM-2026-001",
      patientName: "Synthetic Youth 001",
      patientId: "p1",
      serviceDate: "2026-06-01",
      amount: 12500,
      status: "approved",
      payer: "Superior HealthPlan",
      agingDays: 0,
      diagnosisCodes: ["F90.0", "F91.1"],
      procedureCodes: ["H0019", "H0031"],
      provider: "Demo Clinical Director",
      submittedDate: "2026-06-03",
      paidDate: "2026-06-10",
      paidAmount: 11875,
      adjustmentAmount: 625,
    };
  if (procedure === "revenue.stats")
    return {
      totalClaims: 24,
      pendingSubmission: 3,
      submitted: 8,
      approved: 6,
      denied: 2,
      totalBilled: 125000,
      totalCollected: 78000,
      collectionRate: 62,
      avgDaysToPayment: 18,
    };
  // ─── DOCUMENT MANAGEMENT (M2) ENDPOINTS ──────────────────
  if (procedure === "m2.stats")
    return {
      total: 24,
      draft: 3,
      inReview: 2,
      approved: 4,
      published: 12,
      archived: 3,
    };
  if (procedure === "m2.listCategories")
    return {
      categories: [
        {
          id: "cat1",
          name: "HR Policies",
          code: "HR-POL",
          description: "Human resources policies and procedures",
          documentCount: 4,
        },
        {
          id: "cat2",
          name: "Clinical Protocols",
          code: "CLN-PRO",
          description: "Clinical treatment protocols and procedures",
          documentCount: 3,
        },
        {
          id: "cat3",
          name: "GRO Operations",
          code: "GRO-OPS",
          description: "Residential facility operations manuals",
          documentCount: 3,
        },
        {
          id: "cat4",
          name: "QA & Compliance",
          code: "QA-COMP",
          description: "Quality assurance and compliance documentation",
          documentCount: 3,
        },
        {
          id: "cat5",
          name: "Revenue Cycle",
          code: "REV-CYC",
          description: "Revenue cycle management documentation",
          documentCount: 2,
        },
        {
          id: "cat6",
          name: "GAD Administration",
          code: "GAD-ADM",
          description: "General administration documentation",
          documentCount: 2,
        },
        {
          id: "cat7",
          name: "Training Materials",
          code: "TRN-MAT",
          description: "Training and educational materials",
          documentCount: 3,
        },
        {
          id: "cat8",
          name: "Incident Reports",
          code: "INC-RPT",
          description: "Incident and event reports",
          documentCount: 2,
        },
        {
          id: "cat9",
          name: "Form Templates",
          code: "FRM-TPL",
          description: "Standard form templates",
          documentCount: 2,
        },
      ],
    };
  if (procedure === "m2.list")
    return {
      documents: [
        {
          id: "d1",
          title: "Employee Handbook 2026",
          category: "HR Policies",
          status: "published",
          version: "3.2",
          author: "Demo Executive",
          createdAt: "2026-01-15",
          updatedAt: "2026-06-20",
        },
        {
          id: "d2",
          title: "Crisis Intervention Protocol",
          category: "Clinical Protocols",
          status: "published",
          version: "2.1",
          author: "Demo Clinical Director",
          createdAt: "2026-02-10",
          updatedAt: "2026-06-18",
        },
        {
          id: "d3",
          title: "Youth Rights & Advocacy Guide",
          category: "GRO Operations",
          status: "published",
          version: "1.5",
          author: "Demo Clinical Lead",
          createdAt: "2026-03-05",
          updatedAt: "2026-06-15",
        },
        {
          id: "d4",
          title: "CAPA Procedure Manual",
          category: "QA & Compliance",
          status: "published",
          version: "4.0",
          author: "Demo Executive",
          createdAt: "2026-01-20",
          updatedAt: "2026-06-22",
        },
        {
          id: "d5",
          title: "Claims Submission Guide",
          category: "Revenue Cycle",
          status: "published",
          version: "2.3",
          author: "Demo Case Manager",
          createdAt: "2026-04-12",
          updatedAt: "2026-06-10",
        },
        {
          id: "d6",
          title: "Facility Maintenance SOP",
          category: "GAD Administration",
          status: "published",
          version: "1.8",
          author: "GRO Admin",
          createdAt: "2026-05-01",
          updatedAt: "2026-06-12",
        },
        {
          id: "d7",
          title: "New Hire Orientation Manual",
          category: "Training Materials",
          status: "published",
          version: "3.0",
          author: "HR Director",
          createdAt: "2026-02-01",
          updatedAt: "2026-06-25",
        },
        {
          id: "d8",
          title: "Restraint & Seclusion Documentation",
          category: "Incident Reports",
          status: "published",
          version: "2.2",
          author: "Demo Clinical Director",
          createdAt: "2026-03-20",
          updatedAt: "2026-06-08",
        },
        {
          id: "d9",
          title: "Youth Assessment Intake Form",
          category: "Form Templates",
          status: "published",
          version: "5.1",
          author: "Demo Clinical Lead",
          createdAt: "2026-01-10",
          updatedAt: "2026-06-28",
        },
        {
          id: "d10",
          title: "Medication Administration Policy",
          category: "Clinical Protocols",
          status: "published",
          version: "3.4",
          author: "Dr. Sarah Kim",
          createdAt: "2026-04-01",
          updatedAt: "2026-06-05",
        },
        {
          id: "d11",
          title: "Safety Inspection Checklist",
          category: "GRO Operations",
          status: "published",
          version: "1.2",
          author: "RCS Lead",
          createdAt: "2026-05-15",
          updatedAt: "2026-06-14",
        },
        {
          id: "d12",
          title: "HIPAA Privacy Policy",
          category: "QA & Compliance",
          status: "published",
          version: "4.2",
          author: "Demo Executive",
          createdAt: "2026-01-05",
          updatedAt: "2026-06-01",
        },
      ],
      total: 12,
      page: 1,
      pageSize: 20,
    };
  if (procedure === "m2.getById")
    return {
      id: "d1",
      title: "Employee Handbook 2026",
      category: "HR Policies",
      status: "published",
      version: "3.2",
      author: "Demo Executive",
      createdAt: "2026-01-15",
      updatedAt: "2026-06-20",
      content:
        "This handbook outlines all policies and procedures for Adolbi Care employees...",
      fileUrl: "/documents/employee-handbook-2026.pdf",
      fileSize: 2450000,
      tags: ["hr", "policy", "onboarding"],
      approver: "Demo Executive",
      approvedAt: "2026-01-20",
      effectiveDate: "2026-01-20",
      expirationDate: "2027-01-20",
    };
  // ─── M29 NIL GRAPH ENDPOINTS ─────────────────────────────
  if (procedure === "m29.stats")
    return {
      totalEntities: 18,
      totalRelations: 24,
      byType: { youth: 5, staff: 8, facility: 2, document: 3, partner: 5 },
    };
  if (procedure === "m29.search")
    return {
      results: [
        {
          id: "e1",
          type: "youth",
          name: "Synthetic Youth 001",
          description: "15yo male, ADHD/Conduct Disorder, admitted 2026-04-01",
        },
        {
          id: "e2",
          type: "staff",
          name: "Demo Clinical Director",
          description: "Clinical Director, board-certified psychiatrist",
        },
        {
          id: "e3",
          type: "facility",
          name: "Main Residential Unit",
          description: "8-bed main residential unit at Cypress campus",
        },
        {
          id: "e4",
          type: "partner",
          name: "Houston ISD",
          description: "School district partnership, primary referral source",
        },
        {
          id: "e5",
          type: "document",
          name: "Employee Handbook 2026",
          description: "Published HR policy document v3.2",
        },
      ],
    };
  if (procedure === "m29.getEntity")
    return {
      id: "e1",
      type: "youth",
      name: "Synthetic Youth 001",
      description: "15yo male, ADHD/Conduct Disorder, admitted 2026-04-01",
      properties: {
        age: 15,
        gender: "M",
        admissionDate: "2026-04-01",
        room: "201A",
        guardian: "Synthetic Guardian 01",
        diagnoses: ["F90.0 ADHD", "F91.1 Conduct Disorder"],
      },
      relationships: [
        { to: "e2", type: "treated_by", name: "Demo Clinical Director" },
        { to: "e3", type: "resides_at", name: "Main Residential Unit" },
        { to: "e4", type: "referred_by", name: "Houston ISD" },
      ],
    };
  if (procedure === "m29.getRelationships")
    return {
      relationships: [
        {
          id: "r1",
          fromEntity: "e1",
          toEntity: "e2",
          type: "treated_by",
          fromName: "Synthetic Youth 001",
          toName: "Demo Clinical Director",
          createdAt: "2026-04-01",
        },
        {
          id: "r2",
          fromEntity: "e1",
          toEntity: "e3",
          type: "resides_at",
          fromName: "Synthetic Youth 001",
          toName: "Main Residential Unit",
          createdAt: "2026-04-01",
        },
        {
          id: "r3",
          fromEntity: "e4",
          toEntity: "e1",
          type: "referred",
          fromName: "Houston ISD",
          toName: "Synthetic Youth 001",
          createdAt: "2026-03-28",
        },
        {
          id: "r4",
          fromEntity: "e2",
          toEntity: "e3",
          type: "works_at",
          fromName: "Demo Clinical Director",
          toName: "Main Residential Unit",
          createdAt: "2026-01-15",
        },
      ],
    };
  // ─── M19 CAMPUS CENSUS ENDPOINTS ─────────────────────────
  if (procedure === "m19.getStageCensus")
    return {
      stages: [
        {
          id: "stage1",
          name: "Main Residential Unit",
          type: "residential",
          occupied: 8,
          capacity: 8,
          status: "full",
          youth: [
            { id: "p1", name: "Synthetic Youth 001", bed: "201A" },
            { id: "p2", name: "Synthetic Youth 003", bed: "202A" },
            { id: "p3", name: "Synthetic Youth 004", bed: "203A" },
            { id: "p4", name: "Synthetic Youth 008", bed: "204A" },
            { id: "p5", name: "Synthetic Youth 006", bed: "205A" },
            { id: "p6", name: "Synthetic Youth 009", bed: "206A" },
            { id: "p7", name: "Synthetic Youth 011", bed: "207A" },
            { id: "p8", name: "Synthetic Youth 012", bed: "208A" },
          ],
        },
        {
          id: "stage2",
          name: "ECS (Emergency Care Shelter)",
          type: "emergency",
          occupied: 4,
          capacity: 8,
          status: "available",
          youth: [
            { id: "p9", name: "Synthetic Youth 034", bed: "ECS-01" },
            { id: "p10", name: "Synthetic Youth 039", bed: "ECS-02" },
            { id: "p11", name: "Synthetic Youth 041", bed: "ECS-03" },
            { id: "p12", name: "Synthetic Youth 036", bed: "ECS-04" },
          ],
        },
        {
          id: "stage3",
          name: "Cypress",
          type: "planned",
          occupied: 0,
          capacity: 16,
          status: "offline",
          youth: [],
        },
      ],
      totals: { occupied: 12, capacity: 32, available: 20 },
    };
  if (procedure === "m19.listCampusStages")
    return {
      stages: [
        {
          id: "stage1",
          name: "Main Residential Unit",
          type: "residential",
          capacity: 8,
          occupied: 8,
          status: "full",
          manager: "RCS Lead",
          phone: "(713) 555-1000",
          youthCount: 8,
          avgAge: 14.5,
          avgLOS: 42,
        },
        {
          id: "stage2",
          name: "ECS (Emergency Care Shelter)",
          type: "emergency",
          capacity: 8,
          occupied: 4,
          status: "available",
          manager: "Demo Clinical Lead",
          phone: "(713) 555-1001",
          youthCount: 4,
          avgAge: 13.8,
          avgLOS: 18,
        },
        {
          id: "stage3",
          name: "Cypress",
          type: "planned",
          capacity: 16,
          occupied: 0,
          status: "offline",
          manager: "TBD",
          phone: "(713) 555-1002",
          youthCount: 0,
          avgAge: 0,
          avgLOS: 0,
        },
      ],
    };
  if (procedure === "m19.listCensusAlerts")
    return {
      alerts: [
        {
          id: "ca1",
          type: "capacity_warning",
          severity: "high",
          message:
            "Main Residential Unit at full capacity (8/8). Consider activating ECS overflow.",
          stage: "Main Residential Unit",
          createdAt: "2026-06-28",
        },
        {
          id: "ca2",
          type: "upcoming_discharge",
          severity: "medium",
          message:
            "Synthetic Youth 004 discharge planned for 2026-07-05. Bed 203A will become available.",
          stage: "Main Residential Unit",
          youthId: "p3",
          createdAt: "2026-06-25",
        },
      ],
    };
  // ─── GRO RESIDENTIAL ENDPOINTS ───────────────────────────
  if (procedure === "gro.dashboardKPIs")
    return {
      census: 12,
      capacity: 16,
      occupancyRate: 75,
      activeReferrals: 3,
      partnerships: 5,
      conversionRate: 25,
      newAdmissions7d: 2,
      discharges7d: 1,
      incidents7d: 0,
      restraints7d: 0,
    };
  if (procedure === "gro.listReferrals")
    return {
      referrals: [
        {
          id: "ref1",
          youthName: "Synthetic Youth 009",
          age: 14,
          gender: "M",
          source: "Houston ISD",
          referringContact: "Maria Gonzalez, School Counselor",
          phone: "(713) 555-0100",
          status: "active",
          dateReceived: "2026-06-25",
          priority: "high",
          notes: "Behavioral issues at school, depression screening positive",
        },
        {
          id: "ref2",
          youthName: "Synthetic Youth 011",
          age: 16,
          gender: "F",
          source: "Harris County Juvenile Probation",
          referringContact: "Deputy Chief Williams",
          phone: "(713) 555-0200",
          status: "active",
          dateReceived: "2026-06-22",
          priority: "urgent",
          notes: "Court-ordered residential placement, trauma history",
        },
        {
          id: "ref3",
          youthName: "Synthetic Youth 036",
          age: 13,
          gender: "M",
          source: "Texas CPS Region 6",
          referringContact: "Case Supervisor Torres",
          phone: "(713) 555-0500",
          status: "active",
          dateReceived: "2026-06-20",
          priority: "high",
          notes: "Foster care disruption, needs stabilization",
        },
      ],
    };
  if (procedure === "gro.listPartnerships")
    return {
      partnerships: [
        {
          id: "part1",
          name: "Houston ISD",
          type: "School District",
          status: "active",
          primaryContact: "Maria Gonzalez",
          email: "m.gonzalez@example.invalid",
          phone: "(713) 555-0100",
          address: "4400 West 18th St, Houston, TX 77092",
          referralCount: 24,
          startDate: "2023-08-01",
          renewalDate: "2026-08-01",
        },
        {
          id: "part2",
          name: "Harris County Juvenile Probation",
          type: "Government",
          status: "active",
          primaryContact: "Deputy Chief Williams",
          email: "d.williams@example.invalid",
          phone: "(713) 555-0200",
          address: "1200 Congress St, Houston, TX 77002",
          referralCount: 12,
          startDate: "2024-01-15",
          renewalDate: "2027-01-15",
        },
        {
          id: "part3",
          name: "Legacy Community Health",
          type: "Healthcare",
          status: "active",
          primaryContact: "Dr. Sarah Kim",
          email: "s.kim@example.invalid",
          phone: "(832) 555-0300",
          address: "Various clinic locations, Houston, TX",
          referralCount: 18,
          startDate: "2024-03-01",
          renewalDate: "2027-03-01",
        },
        {
          id: "part4",
          name: "Texas Childrens Hospital",
          type: "Healthcare",
          status: "active",
          primaryContact: "James Okafor",
          email: "j.okafor@example.invalid",
          phone: "(832) 555-0400",
          address: "6621 Fannin St, Houston, TX 77030",
          referralCount: 8,
          startDate: "2025-01-10",
          renewalDate: "2026-12-31",
        },
        {
          id: "part5",
          name: "Texas CPS Region 6",
          type: "Government",
          status: "active",
          primaryContact: "Case Supervisor Torres",
          email: "r.torres@example.invalid",
          phone: "(713) 555-0500",
          address: "2525 Murworth Dr, Houston, TX 77054",
          referralCount: 15,
          startDate: "2024-06-01",
          renewalDate: "2027-06-01",
        },
      ],
    };
  if (procedure === "gro.listCampaigns")
    return {
      campaigns: [
        {
          id: "camp1",
          name: "Spring 2026 School Outreach",
          type: "community",
          status: "active",
          startDate: "2026-03-01",
          endDate: "2026-06-30",
          budget: 8000,
          leadsGenerated: 32,
          conversions: 8,
          roi: 2.4,
          description:
            "Outreach to Houston ISD and surrounding school districts targeting at-risk youth",
        },
        {
          id: "camp2",
          name: "Pediatrician Partnership Program",
          type: "professional",
          status: "active",
          startDate: "2026-04-01",
          endDate: "2026-09-30",
          budget: 5000,
          leadsGenerated: 18,
          conversions: 5,
          roi: 1.8,
          description:
            "Direct partnership with pediatricians and community health centers for warm handoffs",
        },
      ],
    };
  if (procedure === "groCompliance.groComplianceDashboard")
    return {
      overallScore: 88,
      incidents7d: 0,
      restraints7d: 0,
      overdueDocumentation: 1,
      overdueMedical: 0,
      recordRetentionAlerts: 2,
    };
  if (procedure === "groCompliance.listRestraintIncidents")
    return {
      incidents: [
        {
          id: "ri1",
          youthName: "Synthetic Youth 001",
          date: "2026-05-15",
          type: "Physical Restraint",
          duration: 8,
          reason: "Imminent risk of elopement",
          staffInvolved: ["RCS Lead", "RCS Day Staff"],
          physicianNotified: true,
          parentNotified: true,
          reviewCompleted: true,
          followUpActions:
            "Additional de-escalation training scheduled for youth",
        },
        {
          id: "ri2",
          youthName: "Synthetic Youth 006",
          date: "2026-04-22",
          type: "Physical Restraint",
          duration: 12,
          reason: "Aggression toward peer",
          staffInvolved: ["Demo Clinical Director", "RCS Night Staff"],
          physicianNotified: true,
          parentNotified: true,
          reviewCompleted: true,
          followUpActions: "Anger management sessions increased to 2x weekly",
        },
      ],
    };
  if (procedure === "groCompliance.listRecordRetention")
    return {
      records: [
        {
          id: "rr1",
          recordType: "Youth Clinical Notes",
          youthId: "p2",
          youthName: "Synthetic Youth 003",
          retentionPeriod: "7 years",
          createdDate: "2020-01-15",
          expiryDate: "2027-01-15",
          daysUntilExpiry: 201,
          status: "active",
        },
        {
          id: "rr2",
          recordType: "Incident Report",
          youthId: "p1",
          youthName: "Synthetic Youth 001",
          retentionPeriod: "7 years",
          createdDate: "2019-06-10",
          expiryDate: "2026-06-10",
          daysUntilExpiry: -18,
          status: "expiring_soon",
        },
        {
          id: "rr3",
          recordType: "Treatment Plan",
          youthId: "p5",
          youthName: "Synthetic Youth 006",
          retentionPeriod: "7 years",
          createdDate: "2019-03-01",
          expiryDate: "2026-03-01",
          daysUntilExpiry: -118,
          status: "overdue",
        },
      ],
    };
  // ─── QA & COMPLIANCE (M3) ENDPOINTS ──────────────────────
  if (procedure === "m3.sentinel")
    return {
      score: 91,
      openCAPs: 3,
      overdueCAPs: 1,
      openFindings: 0,
      riskItems: 0,
    };
  if (procedure === "m3.complianceScore")
    return {
      overall: 94,
      hipaaPrivacy: 98,
      hipaaSecurity: 96,
      part2: 100,
      stateLicensure: 92,
      staffCredentials: 88,
      incidentReporting: 100,
      medicationMgmt: 95,
      youthRights: 97,
    };
  if (procedure === "m3.capStats")
    return {
      open: 3,
      overdue: 1,
      pendingVerification: 0,
      completed30d: 2,
      totalClosed: 8,
    };
  if (procedure === "m3.auditBinderStats")
    return { totalAudits: 4, completed: 2, inProgress: 1, scheduled: 1 };
  if (procedure === "m3.evidenceStats")
    return { totalItems: 12, uploaded: 10, verified: 8, pending: 2 };
  if (procedure === "m3.memoStats")
    return { totalIssued: 6, thisMonth: 1, pendingAcknowledgment: 2 };
  if (procedure === "m3.deficiencyStats")
    return {
      openPOCPending: 1,
      inProgress: 2,
      corrected: 3,
      verifiedClosed: 5,
    };
  // ─── WORKFLOW ENGINE ENDPOINTS ───────────────────────────
  if (procedure === "workflow.dashboardKPIs")
    return {
      activeRules: 9,
      triggeredToday: 3,
      pendingApprovals: 2,
      avgProcessingTime: 4.2,
    };
  if (procedure === "workflow.listRules")
    return {
      rules: [
        {
          id: "wr1",
          name: "New Admission Notification",
          trigger: "youth.admitted",
          actions: ["notify_clinical_team", "create_bed_assignment_task"],
          status: "active",
          createdBy: "Demo Executive",
          createdAt: "2026-01-15",
        },
        {
          id: "wr2",
          name: "High Risk Alert Escalation",
          trigger: "clinical.high_risk",
          actions: ["notify_clinical_director", "create_safety_plan_task"],
          status: "active",
          createdBy: "Demo Clinical Director",
          createdAt: "2026-02-01",
        },
        {
          id: "wr3",
          name: "Credential Expiry Warning",
          trigger: "credential.expiring_30d",
          actions: ["notify_hr", "notify_supervisor", "create_renewal_task"],
          status: "active",
          createdBy: "HR Director",
          createdAt: "2026-01-20",
        },
        {
          id: "wr4",
          name: "Incident Report Required",
          trigger: "safety.incident",
          actions: ["notify_qa_officer", "create_incident_report_task"],
          status: "active",
          createdBy: "Demo Executive",
          createdAt: "2026-03-01",
        },
        {
          id: "wr5",
          name: "Claim Denial Follow-up",
          trigger: "revenue.claim_denied",
          actions: ["notify_billing_manager", "create_appeal_task"],
          status: "active",
          createdBy: "Demo Case Manager",
          createdAt: "2026-04-10",
        },
        {
          id: "wr6",
          name: "CAP Overdue Escalation",
          trigger: "qa.cap_overdue",
          actions: ["notify_qa_director", "escalate_to_executive"],
          status: "active",
          createdBy: "Demo Executive",
          createdAt: "2026-01-10",
        },
        {
          id: "wr7",
          name: "Discharge Planning Reminder",
          trigger: "youth.discharge_7d",
          actions: ["notify_case_manager", "create_discharge_plan_task"],
          status: "active",
          createdBy: "Demo Clinical Lead",
          createdAt: "2026-05-01",
        },
        {
          id: "wr8",
          name: "Medication Error Alert",
          trigger: "clinical.med_error",
          actions: [
            "notify_clinical_director",
            "notify_qa_officer",
            "create_review_task",
          ],
          status: "active",
          createdBy: "Demo Clinical Director",
          createdAt: "2026-02-15",
        },
        {
          id: "wr9",
          name: "Restraint Documentation Check",
          trigger: "safety.restraint_used",
          actions: [
            "notify_qa_officer",
            "create_review_task",
            "notify_physician",
          ],
          status: "active",
          createdBy: "Demo Clinical Director",
          createdAt: "2026-03-20",
        },
      ],
    };
  if (procedure === "workflow.listInstances")
    return {
      instances: [
        {
          id: "wi1",
          ruleName: "New Admission Notification",
          trigger: "youth.admitted",
          status: "completed",
          startedAt: "2026-06-28T08:00:00Z",
          completedAt: "2026-06-28T08:05:00Z",
          duration: 5,
          triggeredBy: "RCS Lead",
        },
        {
          id: "wi2",
          ruleName: "High Risk Alert Escalation",
          trigger: "clinical.high_risk",
          status: "completed",
          startedAt: "2026-06-27T14:00:00Z",
          completedAt: "2026-06-27T14:15:00Z",
          duration: 15,
          triggeredBy: "Demo Clinical Director",
        },
        {
          id: "wi3",
          ruleName: "Credential Expiry Warning",
          trigger: "credential.expiring_30d",
          status: "in_progress",
          startedAt: "2026-06-25T09:00:00Z",
          completedAt: null,
          duration: null,
          triggeredBy: "System",
        },
        {
          id: "wi4",
          ruleName: "Incident Report Required",
          trigger: "safety.incident",
          status: "completed",
          startedAt: "2026-06-20T10:30:00Z",
          completedAt: "2026-06-20T10:45:00Z",
          duration: 15,
          triggeredBy: "RCS Day Staff",
        },
        {
          id: "wi5",
          ruleName: "Claim Denial Follow-up",
          trigger: "revenue.claim_denied",
          status: "in_progress",
          startedAt: "2026-06-18T11:00:00Z",
          completedAt: null,
          duration: null,
          triggeredBy: "Billing System",
        },
      ],
    };
  if (procedure === "workflow.listPendingApprovals")
    return {
      approvals: [
        {
          id: "wa1",
          instanceId: "wi3",
          ruleName: "Credential Expiry Warning",
          requester: "System",
          approverRole: "HR Director",
          description:
            "Approve renewal task for LPC License expiring in 30 days",
          requestedAt: "2026-06-25T09:00:00Z",
          priority: "high",
        },
        {
          id: "wa2",
          instanceId: "wi5",
          ruleName: "Claim Denial Follow-up",
          requester: "Billing System",
          approverRole: "Revenue Manager",
          description: "Approve appeal for denied claim CLM-2026-005 ($19,600)",
          requestedAt: "2026-06-18T11:00:00Z",
          priority: "medium",
        },
      ],
    };
  if (procedure === "workflow.auditLog")
    return {
      entries: [
        {
          id: "al1",
          action: "rule_triggered",
          actor: "System",
          target: "New Admission Notification",
          details: "Youth Synthetic Youth 011 admitted to bed 207A",
          timestamp: "2026-06-28T08:00:00Z",
        },
        {
          id: "al2",
          action: "task_completed",
          actor: "RCS Lead",
          target: "Bed Assignment",
          details:
            "Assigned Synthetic Youth 011 to bed 207A in Main Residential Unit",
          timestamp: "2026-06-28T08:05:00Z",
        },
        {
          id: "al3",
          action: "rule_triggered",
          actor: "Demo Clinical Director",
          target: "High Risk Alert Escalation",
          details:
            "Synthetic Youth 004 flagged as high risk due to escalating aggression",
          timestamp: "2026-06-27T14:00:00Z",
        },
        {
          id: "al4",
          action: "approval_requested",
          actor: "System",
          target: "Credential Expiry Warning",
          details:
            "LPC License renewal approval requested for Demo Case Manager",
          timestamp: "2026-06-25T09:00:00Z",
        },
        {
          id: "al5",
          action: "rule_triggered",
          actor: "Billing System",
          target: "Claim Denial Follow-up",
          details: "Claim CLM-2026-005 denied by BCBS TX",
          timestamp: "2026-06-18T11:00:00Z",
        },
        {
          id: "al6",
          action: "rule_modified",
          actor: "Demo Executive",
          target: "CAP Overdue Escalation",
          details: "Changed escalation threshold from 7 days to 5 days overdue",
          timestamp: "2026-06-15T16:00:00Z",
        },
      ],
    };
  // ─── CREDENTIALS ENDPOINTS ───────────────────────────────
  if (procedure === "credentials.dashboard")
    return {
      totalCredentials: 48,
      valid: 42,
      expiring30d: 2,
      expired: 1,
      expiring90d: 3,
      complianceRate: 88,
    };
  // ─── ANALYTICS ENDPOINTS ─────────────────────────────────
  if (procedure === "analytics.workforceOverview")
    return {
      totalStaff: 24,
      byDivision: { gro: 10, bhc: 8, gad: 4, eo: 2 },
      turnoverRate: 12,
      avgTenure: 18,
    };
  if (procedure === "analytics.revenueOverview")
    return {
      ytdRevenue: 2840000,
      ytdClaims: 142,
      avgClaimValue: 20000,
      collectionRate: 62,
      denialRate: 15,
    };
  if (procedure === "analytics.residentialOverview")
    return {
      avgDailyCensus: 12,
      admissionsYTD: 18,
      dischargesYTD: 15,
      avgLOS: 45,
      occupancyRate: 75,
    };
  // ─── CASE MANAGEMENT & YOUTH ENDPOINTS ───────────────────
  if (procedure === "m13.listYouth")
    return {
      youth: [
        {
          id: "p1",
          firstName: "Synthetic-Person-001",
          lastName: "Johnson",
          age: 15,
          gender: "M",
          status: "active",
          admissionDate: "2026-04-01",
          diagnoses: ["F90.0 ADHD", "F91.1 Conduct Disorder"],
          assignedCaseManager: "Demo Case Manager",
          room: "201A",
          guardian: "Synthetic Guardian 01",
        },
        {
          id: "p2",
          firstName: "Synthetic-Person-003",
          lastName: "Williams",
          age: 14,
          gender: "F",
          status: "active",
          admissionDate: "2026-04-15",
          diagnoses: ["F32.9 Major Depression", "F43.10 PTSD"],
          assignedCaseManager: "Demo Clinical Lead",
          room: "202A",
          guardian: "Synthetic Guardian 03",
        },
        {
          id: "p3",
          firstName: "Synthetic-Person-004",
          lastName: "Ramirez",
          age: 16,
          gender: "M",
          status: "active",
          admissionDate: "2026-05-01",
          diagnoses: ["F31.9 Bipolar II", "F19.10 Substance Use"],
          assignedCaseManager: "Demo Clinical Director",
          room: "203A",
          guardian: "Maria Ramirez",
        },
        {
          id: "p4",
          firstName: "Synthetic-Person-005",
          lastName: "Peterson",
          age: 13,
          gender: "F",
          status: "active",
          admissionDate: "2026-05-20",
          diagnoses: ["F41.1 Generalized Anxiety", "F84.0 ASD Traits"],
          assignedCaseManager: "Demo Clinical Lead",
          room: "204A",
          guardian: "Synthetic-Person-011 Peterson",
        },
        {
          id: "p5",
          firstName: "Synthetic-Person-006",
          lastName: "Brooks",
          age: 15,
          gender: "M",
          status: "active",
          admissionDate: "2026-06-10",
          diagnoses: ["F43.10 PTSD", "F91.8 Oppositional Defiant"],
          assignedCaseManager: "Demo Case Manager",
          room: "205A",
          guardian: "Angela Brooks",
        },
      ],
    };
  if (procedure === "m16.listCases")
    return {
      cases: [
        {
          id: "case1",
          youthId: "p1",
          youthName: "Synthetic Youth 001",
          caseManager: "Demo Case Manager",
          status: "active",
          openedDate: "2026-04-01",
          reviewDate: "2026-07-01",
          goals: 4,
          goalsCompleted: 2,
          riskLevel: "moderate",
        },
        {
          id: "case2",
          youthId: "p2",
          youthName: "Synthetic Youth 003",
          caseManager: "Demo Clinical Lead",
          status: "active",
          openedDate: "2026-04-15",
          reviewDate: "2026-07-15",
          goals: 5,
          goalsCompleted: 2,
          riskLevel: "high",
        },
        {
          id: "case3",
          youthId: "p4",
          youthName: "Synthetic Youth 008",
          caseManager: "Demo Clinical Lead",
          status: "active",
          openedDate: "2026-05-20",
          reviewDate: "2026-08-20",
          goals: 4,
          goalsCompleted: 1,
          riskLevel: "moderate",
        },
        {
          id: "case4",
          youthId: "p5",
          youthName: "Synthetic Youth 006",
          caseManager: "Demo Case Manager",
          status: "active",
          openedDate: "2026-06-10",
          reviewDate: "2026-09-10",
          goals: 3,
          goalsCompleted: 0,
          riskLevel: "high",
        },
      ],
    };
  if (procedure === "m16.caseMgmtSummary")
    return {
      activeCases: 4,
      newThisMonth: 1,
      reviewsDue: 2,
      dischargesPlanned: 1,
    };
  if (procedure === "m17.listCrises")
    return {
      crises: [
        {
          id: "cris1",
          youthId: "p3",
          youthName: "Synthetic Youth 004",
          type: "Behavioral Escalation",
          severity: "high",
          description: "Physical altercation with peer in common area",
          response:
            "Physical restraint applied per protocol. Youth de-escalated after 12 minutes. No injuries.",
          respondedBy: "RCS Lead, Demo Clinical Director",
          status: "resolved",
          startedAt: "2026-06-25T16:00:00Z",
          resolvedAt: "2026-06-25T16:30:00Z",
          followUpRequired: true,
        },
        {
          id: "cris2",
          youthId: "p2",
          youthName: "Synthetic Youth 003",
          type: "Suicidal Ideation",
          severity: "critical",
          description:
            "Youth disclosed suicidal thoughts to clinician during session",
          response:
            "1:1 supervision initiated. Safety plan reviewed. Emergency contact notified. Psychiatrist consulted.",
          respondedBy: "Demo Clinical Lead, Demo Clinical Director",
          status: "resolved",
          startedAt: "2026-06-20T14:00:00Z",
          resolvedAt: "2026-06-20T18:00:00Z",
          followUpRequired: true,
        },
        {
          id: "cris3",
          youthId: "p5",
          youthName: "Synthetic Youth 006",
          type: "Behavioral Escalation",
          severity: "moderate",
          description:
            "Refusal to participate in group therapy, verbal aggression toward staff",
          response:
            "De-escalation techniques applied. Youth agreed to individual session alternative.",
          respondedBy: "Demo Case Manager",
          status: "active",
          startedAt: "2026-06-28T10:00:00Z",
          resolvedAt: null,
          followUpRequired: true,
        },
      ],
    };
  if (procedure === "m17.crisisSummary")
    return { totalThisMonth: 3, active: 1, resolved: 2, avgResponseTime: 4.5 };
  if (procedure === "m18.listFamilyContacts")
    return {
      contacts: [
        {
          id: "fc1",
          youthId: "p1",
          youthName: "Synthetic Youth 001",
          guardianName: "Synthetic Guardian 01",
          relationship: "Mother",
          phone: "(713) 555-0101",
          email: "tjohnson@example.invalid",
          lastContact: "2026-06-25",
          contactFrequency: "Weekly",
          notes: "Mother very engaged, attends all family sessions",
        },
        {
          id: "fc2",
          youthId: "p2",
          youthName: "Synthetic Youth 003",
          guardianName: "Synthetic Guardian 03",
          relationship: "Father",
          phone: "(713) 555-0201",
          email: "dwilliams@example.invalid",
          lastContact: "2026-06-22",
          contactFrequency: "Bi-weekly",
          notes: "Father works long hours, prefers evening calls",
        },
        {
          id: "fc3",
          youthId: "p3",
          youthName: "Synthetic Youth 004",
          guardianName: "Maria Ramirez",
          relationship: "Mother",
          phone: "(713) 555-0301",
          email: "mramirez@example.invalid",
          lastContact: "2026-06-28",
          contactFrequency: "Weekly",
          notes: "Spanish-speaking, interpreter provided for sessions",
        },
        {
          id: "fc4",
          youthId: "p4",
          youthName: "Synthetic Youth 008",
          guardianName: "Synthetic-Person-011 Peterson",
          relationship: "Grandmother",
          phone: "(713) 555-0401",
          email: "kpeterson@example.invalid",
          lastContact: "2026-06-20",
          contactFrequency: "Weekly",
          notes: "Legal guardian, very involved in treatment planning",
        },
      ],
    };
  if (procedure === "m20.listAuthorizations")
    return {
      authorizations: [
        {
          id: "az1",
          patientName: "Synthetic Youth 001",
          authNumber: "AUTH-TX-88452",
          serviceType: "Residential Treatment",
          approvedUnits: 90,
          usedUnits: 62,
          startDate: "2026-04-01",
          endDate: "2026-09-30",
          status: "active",
          payer: "Superior HealthPlan",
        },
        {
          id: "az2",
          patientName: "Synthetic Youth 003",
          authNumber: "AUTH-TX-88471",
          serviceType: "Residential Treatment",
          approvedUnits: 90,
          usedUnits: 48,
          startDate: "2026-04-15",
          endDate: "2026-10-15",
          status: "active",
          payer: "Blue Cross Blue Shield TX",
        },
        {
          id: "az3",
          patientName: "Synthetic Youth 004",
          authNumber: "AUTH-TX-88503",
          serviceType: "Intensive Outpatient",
          approvedUnits: 60,
          usedUnits: 25,
          startDate: "2026-05-01",
          endDate: "2026-08-01",
          status: "active",
          payer: "UnitedHealthcare",
        },
        {
          id: "az4",
          patientName: "Synthetic Youth 008",
          authNumber: "AUTH-TX-88520",
          serviceType: "Residential Treatment",
          approvedUnits: 0,
          usedUnits: 0,
          startDate: null,
          endDate: null,
          status: "pending",
          payer: "Superior HealthPlan",
        },
        {
          id: "az5",
          patientName: "Synthetic Youth 006",
          authNumber: "AUTH-TX-88541",
          serviceType: "Residential Treatment",
          approvedUnits: 45,
          usedUnits: 45,
          startDate: "2026-03-01",
          endDate: "2026-06-01",
          status: "expired",
          payer: "Blue Cross Blue Shield TX",
        },
      ],
    };
  if (procedure === "m20.authSummary")
    return { total: 5, active: 3, pending: 1, expired: 1, expiring30d: 1 };
  if (procedure === "m15.listMeetings")
    return {
      meetings: [
        {
          id: "mt1",
          title: "Weekly MDT — Synthetic Youth 001",
          type: "MDT",
          date: "2026-06-25",
          time: "10:00",
          attendees: [
            "Demo Clinical Director",
            "Demo Clinical Lead",
            "Demo Case Manager",
            "RCS Lead",
          ],
          status: "completed",
          notes:
            "Reviewed progress on behavioral goals and routed governed assessment evidence for named human review. Family session scheduled.",
        },
        {
          id: "mt2",
          title: "Weekly MDT — Synthetic Youth 003",
          type: "MDT",
          date: "2026-06-26",
          time: "14:00",
          attendees: [
            "Demo Clinical Director",
            "Demo Clinical Lead",
            "Dr. Sarah Kim",
          ],
          status: "completed",
          notes:
            "Discussed PTSD treatment progress. EMDR therapy showing positive results. Safety plan remains active.",
        },
        {
          id: "mt3",
          title: "Quarterly MDT Review — All Youth",
          type: "Quarterly Review",
          date: "2026-07-05",
          time: "09:00",
          attendees: [
            "Demo Clinical Director",
            "Demo Clinical Lead",
            "Demo Case Manager",
            "Demo Executive",
          ],
          status: "upcoming",
          notes:
            "Quarterly review of all active treatment plans and outcome measures",
        },
      ],
    };
  if (procedure === "m1.getWorkQueue")
    return {
      items: [
        {
          id: "wq1",
          title: "Review governed assessment requirements for Synthetic Youth 006",
          type: "assessment",
          assignedTo: "Demo Case Manager",
          priority: "high",
          dueDate: "2026-06-30",
          status: "pending",
          relatedEntity: "p5",
        },
        {
          id: "wq2",
          title: "Review treatment plan — Synthetic Youth 004",
          type: "review",
          assignedTo: "Demo Clinical Director",
          priority: "high",
          dueDate: "2026-07-01",
          status: "pending",
          relatedEntity: "p3",
        },
        {
          id: "wq3",
          title: "Submit appeal for denied claim CLM-2026-005",
          type: "billing",
          assignedTo: "Demo Case Manager",
          priority: "medium",
          dueDate: "2026-07-03",
          status: "pending",
          relatedEntity: "rc5",
        },
        {
          id: "wq4",
          title: "LPC License renewal — Demo Case Manager",
          type: "credential",
          assignedTo: "HR Director",
          priority: "high",
          dueDate: "2026-07-15",
          status: "in_progress",
          relatedEntity: "h4",
        },
        {
          id: "wq5",
          title: "Quarterly MDT preparation",
          type: "administrative",
          assignedTo: "Demo Clinical Lead",
          priority: "medium",
          dueDate: "2026-07-05",
          status: "pending",
          relatedEntity: "mt3",
        },
      ],
    };
  // ─── MGMA SCORECARD ENDPOINTS ────────────────────────────
  if (procedure === "m23.getDomainScores")
    return {
      domains: [
        {
          id: "dom1",
          name: "Operations",
          score: 78,
          benchmark: 82,
          trend: "improving",
        },
        {
          id: "dom2",
          name: "Financial",
          score: 65,
          benchmark: 75,
          trend: "stable",
        },
        {
          id: "dom3",
          name: "Patient Care",
          score: 88,
          benchmark: 85,
          trend: "improving",
        },
        {
          id: "dom4",
          name: "Staffing",
          score: 72,
          benchmark: 80,
          trend: "declining",
        },
        {
          id: "dom5",
          name: "Technology",
          score: 70,
          benchmark: 78,
          trend: "stable",
        },
        {
          id: "dom6",
          name: "Compliance",
          score: 94,
          benchmark: 90,
          trend: "improving",
        },
        {
          id: "dom7",
          name: "Growth",
          score: 68,
          benchmark: 72,
          trend: "stable",
        },
      ],
    };
  if (procedure === "m23.getKPIDetails")
    return {
      kpis: [
        {
          id: "kpi1",
          domain: "Operations",
          name: "Average Wait Time",
          value: 12,
          benchmark: 15,
          unit: "minutes",
          trend: "improving",
        },
        {
          id: "kpi2",
          domain: "Operations",
          name: "Bed Turnover Rate",
          value: 5.2,
          benchmark: 4.8,
          unit: "per month",
          trend: "stable",
        },
        {
          id: "kpi3",
          domain: "Operations",
          name: "Admission Processing Time",
          value: 2.1,
          benchmark: 2.5,
          unit: "days",
          trend: "improving",
        },
        {
          id: "kpi4",
          domain: "Operations",
          name: "Discharge Processing Time",
          value: 1.5,
          benchmark: 1.5,
          unit: "days",
          trend: "stable",
        },
        {
          id: "kpi5",
          domain: "Operations",
          name: "Staff-to-Youth Ratio",
          value: 2.0,
          benchmark: 2.5,
          unit: "ratio",
          trend: "declining",
        },
        {
          id: "kpi6",
          domain: "Operations",
          name: "Schedule Adherence",
          value: 92,
          benchmark: 90,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi7",
          domain: "Financial",
          name: "Net Revenue per Patient",
          value: 48500,
          benchmark: 52000,
          unit: "dollars",
          trend: "stable",
        },
        {
          id: "kpi8",
          domain: "Financial",
          name: "Days in Accounts Receivable",
          value: 18,
          benchmark: 15,
          unit: "days",
          trend: "declining",
        },
        {
          id: "kpi9",
          domain: "Financial",
          name: "Claim Denial Rate",
          value: 15,
          benchmark: 8,
          unit: "percent",
          trend: "declining",
        },
        {
          id: "kpi10",
          domain: "Financial",
          name: "Cost per Patient Day",
          value: 485,
          benchmark: 450,
          unit: "dollars",
          trend: "stable",
        },
        {
          id: "kpi11",
          domain: "Financial",
          name: "Operating Margin",
          value: 8,
          benchmark: 12,
          unit: "percent",
          trend: "stable",
        },
        {
          id: "kpi12",
          domain: "Financial",
          name: "Bad Debt Ratio",
          value: 4.2,
          benchmark: 3.5,
          unit: "percent",
          trend: "declining",
        },
        {
          id: "kpi13",
          domain: "Patient Care",
          name: "Treatment Plan Completion Rate",
          value: 88,
          benchmark: 85,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi14",
          domain: "Patient Care",
          name: "Patient Satisfaction Score",
          value: 4.2,
          benchmark: 4.0,
          unit: "out of 5",
          trend: "improving",
        },
        {
          id: "kpi15",
          domain: "Patient Care",
          name: "Outcome Measure Improvement",
          value: 75,
          benchmark: 70,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi16",
          domain: "Patient Care",
          name: "Readmission Rate (30-day)",
          value: 5,
          benchmark: 8,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi17",
          domain: "Patient Care",
          name: "Medication Error Rate",
          value: 0.2,
          benchmark: 0.5,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi18",
          domain: "Patient Care",
          name: "Safety Incident Rate",
          value: 1.5,
          benchmark: 2.0,
          unit: "per 1000 patient days",
          trend: "improving",
        },
        {
          id: "kpi19",
          domain: "Staffing",
          name: "Employee Turnover Rate",
          value: 12,
          benchmark: 10,
          unit: "percent",
          trend: "declining",
        },
        {
          id: "kpi20",
          domain: "Staffing",
          name: "Time to Fill Open Positions",
          value: 28,
          benchmark: 21,
          unit: "days",
          trend: "declining",
        },
        {
          id: "kpi21",
          domain: "Staffing",
          name: "Overtime Hours per Employee",
          value: 8.5,
          benchmark: 6.0,
          unit: "hours per month",
          trend: "declining",
        },
        {
          id: "kpi22",
          domain: "Staffing",
          name: "Training Completion Rate",
          value: 88,
          benchmark: 95,
          unit: "percent",
          trend: "stable",
        },
        {
          id: "kpi23",
          domain: "Staffing",
          name: "Employee Satisfaction",
          value: 3.8,
          benchmark: 4.0,
          unit: "out of 5",
          trend: "stable",
        },
        {
          id: "kpi24",
          domain: "Staffing",
          name: "Credential Compliance Rate",
          value: 88,
          benchmark: 95,
          unit: "percent",
          trend: "stable",
        },
        {
          id: "kpi25",
          domain: "Technology",
          name: "EHR Uptime",
          value: 99.5,
          benchmark: 99.9,
          unit: "percent",
          trend: "stable",
        },
        {
          id: "kpi26",
          domain: "Technology",
          name: "System Response Time",
          value: 2.1,
          benchmark: 1.5,
          unit: "seconds",
          trend: "stable",
        },
        {
          id: "kpi27",
          domain: "Technology",
          name: "Digital Documentation Adoption",
          value: 85,
          benchmark: 90,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi28",
          domain: "Technology",
          name: "Telehealth Utilization",
          value: 15,
          benchmark: 20,
          unit: "percent",
          trend: "stable",
        },
        {
          id: "kpi29",
          domain: "Technology",
          name: "Data Backup Success Rate",
          value: 100,
          benchmark: 100,
          unit: "percent",
          trend: "stable",
        },
        {
          id: "kpi30",
          domain: "Technology",
          name: "Cybersecurity Incident Count",
          value: 0,
          benchmark: 0,
          unit: "incidents",
          trend: "stable",
        },
        {
          id: "kpi31",
          domain: "Compliance",
          name: "HIPAA Compliance Score",
          value: 98,
          benchmark: 95,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi32",
          domain: "Compliance",
          name: "State Licensure Score",
          value: 92,
          benchmark: 90,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi33",
          domain: "Compliance",
          name: "CAP Closure Rate",
          value: 85,
          benchmark: 80,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi34",
          domain: "Compliance",
          name: "Audit Pass Rate",
          value: 94,
          benchmark: 90,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi35",
          domain: "Compliance",
          name: "Incident Reporting Timeliness",
          value: 100,
          benchmark: 95,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi36",
          domain: "Compliance",
          name: "Youth Rights Compliance",
          value: 97,
          benchmark: 95,
          unit: "percent",
          trend: "improving",
        },
        {
          id: "kpi37",
          domain: "Growth",
          name: "Occupancy Rate",
          value: 75,
          benchmark: 85,
          unit: "percent",
          trend: "stable",
        },
        {
          id: "kpi38",
          domain: "Growth",
          name: "New Referral Conversion Rate",
          value: 25,
          benchmark: 30,
          unit: "percent",
          trend: "stable",
        },
        {
          id: "kpi39",
          domain: "Growth",
          name: "Average Length of Stay",
          value: 45,
          benchmark: 42,
          unit: "days",
          trend: "stable",
        },
        {
          id: "kpi40",
          domain: "Growth",
          name: "Net Promoter Score",
          value: 32,
          benchmark: 40,
          unit: "score",
          trend: "stable",
        },
        {
          id: "kpi41",
          domain: "Growth",
          name: "Community Partnerships",
          value: 5,
          benchmark: 6,
          unit: "count",
          trend: "stable",
        },
        {
          id: "kpi42",
          domain: "Growth",
          name: "Revenue Growth Rate",
          value: 8,
          benchmark: 12,
          unit: "percent",
          trend: "stable",
        },
      ],
    };
  if (procedure === "m23.getOverallScore")
    return { overallScore: 72, benchmark: 80, trend: "improving" };
  // ─── M1 ENDPOINTS ────────────────────────────────────────
  if (procedure === "m1.dashboardKPIs")
    return {
      totalInOnboarding: 5,
      modulesCompleted: 18,
      totalModules: 24,
      completionRate: 75,
      credentialAlerts: 2,
      pendingTasks: 4,
      evidencePackets: 3,
      rtdReady: 2,
    };
  if (procedure === "m1.getOnboardingProgress")
    return [
      {
        id: "op1",
        person_id: "h4",
        track_id: "general",
        module_id: "mod-001",
        status: "completed",
        score: 95,
        evidence_uploaded: 1,
        completed_at: "2026-06-20",
      },
      {
        id: "op2",
        person_id: "h4",
        track_id: "general",
        module_id: "mod-002",
        status: "completed",
        score: 88,
        evidence_uploaded: 1,
        completed_at: "2026-06-22",
      },
      {
        id: "op3",
        person_id: "h4",
        track_id: "general",
        module_id: "mod-003",
        status: "in-progress",
        score: null,
        evidence_uploaded: 0,
        completed_at: null,
      },
      {
        id: "op4",
        person_id: "h5",
        track_id: "general",
        module_id: "mod-001",
        status: "completed",
        score: 92,
        evidence_uploaded: 1,
        completed_at: "2026-06-18",
      },
      {
        id: "op5",
        person_id: "h5",
        track_id: "general",
        module_id: "mod-002",
        status: "overdue",
        score: null,
        evidence_uploaded: 0,
        completed_at: null,
      },
    ];
  if (procedure === "m1.listCredentialExpiries")
    return [
      {
        id: "cr1",
        person_id: "h4",
        credential_type: "license",
        credential_name: "LPC License",
        expiry_date: "2026-08-15",
        alert_status: "warning",
        alert_threshold_days: 30,
      },
      {
        id: "cr2",
        person_id: "h5",
        credential_type: "certification",
        credential_name: "CPR Certification",
        expiry_date: "2026-07-01",
        alert_status: "warning",
        alert_threshold_days: 30,
      },
      {
        id: "cr3",
        person_id: "h2",
        credential_type: "license",
        credential_name: "Medical License",
        expiry_date: "2027-03-01",
        alert_status: "current",
        alert_threshold_days: 60,
      },
    ];
  if (procedure === "m1.checkReleaseToDuty")
    return {
      personId: "h4",
      isClear: false,
      modules: { total: 3, completed: 2 },
      credentials: { expired: 0 },
      evidence: { total: 3, uploaded: 2 },
      blockers: ["1 modules incomplete", "1 evidence items missing"],
    };
  if (procedure === "m1.generateDocumentId")
    return { documentId: "ADL-HR-ONB-202606-0001" };
  if (procedure === "m1.listDocumentTemplates")
    return [
      {
        id: "dt1",
        template_name: "Employee Onboarding Checklist",
        template_code: "ONB-001",
        category: "HR",
        description: "Standard onboarding checklist for new hires",
        is_active: 1,
      },
      {
        id: "dt2",
        template_name: "Credential Verification Form",
        template_code: "CRED-001",
        category: "HR",
        description: "Credential expiry verification template",
        is_active: 1,
      },
      {
        id: "dt3",
        template_name: "Incident Report",
        template_code: "INC-001",
        category: "GRO",
        description: "Youth incident report template",
        is_active: 1,
      },
      {
        id: "dt4",
        template_name: "Treatment Plan Review",
        template_code: "TPR-001",
        category: "Clinical",
        description: "Clinical treatment plan review form",
        is_active: 1,
      },
      {
        id: "dt5",
        template_name: "CAP Corrective Action",
        template_code: "CAP-001",
        category: "QA",
        description: "Corrective action plan template",
        is_active: 1,
      },
      {
        id: "dt6",
        template_name: "Release-to-Duty Assessment",
        template_code: "RTD-001",
        category: "HR",
        description: "Pre-duty clearance assessment",
        is_active: 1,
      },
    ];
  if (procedure === "m1.listEvidencePackets")
    return [
      {
        id: "ep1",
        packet_name: "Demo Case Manager - Onboarding Packet",
        packet_type: "onboarding",
        person_id: "h4",
        status: "in-progress",
        document_ids_json: "[]",
        assembled_by: "HR Director",
        assembled_at: "2026-06-20",
      },
      {
        id: "ep2",
        packet_name: "RCS Lead - Credential Verification",
        packet_type: "credential",
        person_id: "h5",
        status: "assembled",
        document_ids_json: "[]",
        assembled_by: "HR Director",
        assembled_at: "2026-06-18",
      },
    ];
  if (procedure === "m1.getWorkQueue")
    return [
      {
        id: "wq1",
        task_title: "Review onboarding progress - J. Lee",
        task_type: "review",
        assigned_to: "hr@amos-ops.invalid",
        priority: "high",
        status: "pending",
        entity_type: "onboarding",
        entity_id: "h4",
        evidence_required: 1,
        due_date: "2026-07-01",
      },
      {
        id: "wq2",
        task_title: "Verify CPR cert expiry - RCS Lead",
        task_type: "credential-check",
        assigned_to: "hr@amos-ops.invalid",
        priority: "urgent",
        status: "pending",
        entity_type: "credential",
        entity_id: "h5",
        evidence_required: 1,
        due_date: "2026-06-28",
      },
      {
        id: "wq3",
        task_title: "Complete LPC renewal application",
        task_type: "renewal",
        assigned_to: "case.manager@amos-ops.invalid",
        priority: "high",
        status: "in-progress",
        entity_type: "credential",
        entity_id: "h4",
        evidence_required: 1,
        due_date: "2026-07-15",
      },
      {
        id: "wq4",
        task_title: "Assemble RTD packet - RCS Lead",
        task_type: "packet-assembly",
        assigned_to: "hr@amos-ops.invalid",
        priority: "medium",
        status: "pending",
        entity_type: "evidence-packet",
        entity_id: "h5",
        evidence_required: 1,
        due_date: "2026-07-05",
      },
    ];
  if (procedure === "m1.checkCredentialAlerts")
    return { checked: 3, expired: 0, warning: 2 };
  if (procedure === "m1.transitionTaskStatus")
    return { success: true, toStatus: "completed" };
  // ─── M2 ENDPOINTS ────────────────────────────────────────
  if (procedure === "m2.stats")
    return {
      total: 12,
      draft: 3,
      inReview: 2,
      approved: 2,
      published: 4,
      archived: 1,
      superseded: 0,
      byStatus: {
        draft: 3,
        "in-review": 2,
        approved: 2,
        published: 4,
        archived: 1,
        superseded: 0,
      },
      byCategory: {
        "HR Policies": 3,
        "Clinical Protocols": 2,
        "GRO Operations": 2,
        "QA & Compliance": 2,
        "Training Materials": 2,
        "Form Templates": 1,
      },
      byDepartment: { HR: 5, Clinical: 2, GRO: 2, QA: 2, All: 1 },
      recent: [
        {
          id: "d1",
          documentId: "ADL-HR-POL-202606-0001",
          title: "Employee Handbook v2026",
          status: "published",
          createdAt: "2026-06-15T10:00:00Z",
        },
        {
          id: "d2",
          documentId: "ADL-CLN-PRO-202606-0002",
          title: "Crisis Intervention Protocol",
          status: "approved",
          createdAt: "2026-06-14T14:30:00Z",
        },
        {
          id: "d3",
          documentId: "ADL-GRO-OPS-202606-0003",
          title: "Youth Intake Procedures",
          status: "in-review",
          createdAt: "2026-06-13T09:15:00Z",
        },
        {
          id: "d4",
          documentId: "ADL-QA-COM-202606-0004",
          title: "CAPA Procedure Manual",
          status: "published",
          createdAt: "2026-06-12T11:00:00Z",
        },
        {
          id: "d5",
          documentId: "ADL-HR-TRN-202606-0005",
          title: "Orientation Training Guide",
          status: "draft",
          createdAt: "2026-06-11T16:45:00Z",
        },
      ],
    };
  if (procedure === "m2.list")
    return {
      documents: [
        {
          id: "d1",
          documentId: "ADL-HR-POL-202606-0001",
          title: "Employee Handbook v2026",
          description:
            "Comprehensive employee handbook covering policies, benefits, and procedures for all staff.",
          categoryId: "cat1",
          category: "HR Policies",
          department: "HR",
          status: "published",
          version: 3,
          authorId: "u1",
          authorName: "Demo Executive",
          fileName: "employee-handbook-2026.pdf",
          fileType: "pdf",
          fileSize: 2450000,
          tagsJson: '["policy","handbook","all-staff"]',
          permissionsJson: '["all"]',
          retentionYears: 7,
          createdAt: "2026-06-15T10:00:00Z",
          updatedAt: "2026-06-20T08:30:00Z",
          publishedAt: "2026-06-20T08:30:00Z",
          publishedBy: "Demo Executive",
        },
        {
          id: "d2",
          documentId: "ADL-CLN-PRO-202606-0002",
          title: "Crisis Intervention Protocol",
          description:
            "Step-by-step crisis intervention procedures for clinical staff working with youth.",
          categoryId: "cat2",
          category: "Clinical Protocols",
          department: "Clinical",
          status: "approved",
          version: 2,
          authorId: "u2",
          authorName: "Demo Clinical Director",
          fileName: "crisis-protocol-v2.pdf",
          fileType: "pdf",
          fileSize: 1800000,
          tagsJson: '["clinical","crisis","safety","protocol"]',
          permissionsJson:
            '["clinical-director","case-manager","clinical-supervisor"]',
          retentionYears: 10,
          createdAt: "2026-06-14T14:30:00Z",
          updatedAt: "2026-06-19T12:00:00Z",
          approvedAt: "2026-06-19T12:00:00Z",
          approvedBy: "Demo Clinical Director",
        },
        {
          id: "d3",
          documentId: "ADL-GRO-OPS-202606-0003",
          title: "Youth Intake Procedures",
          description:
            "Standard operating procedures for admitting new residents to the GRO facility.",
          categoryId: "cat3",
          category: "GRO Operations",
          department: "GRO",
          status: "in-review",
          version: 1,
          authorId: "u6",
          authorName: "GRO Admin",
          fileName: "intake-procedures-v1.docx",
          fileType: "docx",
          fileSize: 950000,
          tagsJson: '["gro","intake","residential","sop"]',
          permissionsJson: '["gro-administrator","rcs-lead","rcs-day"]',
          retentionYears: 7,
          createdAt: "2026-06-13T09:15:00Z",
          updatedAt: "2026-06-18T15:30:00Z",
        },
        {
          id: "d4",
          documentId: "ADL-QA-COM-202606-0004",
          title: "CAPA Procedure Manual",
          description:
            "Corrective and Preventive Action procedures for QA compliance.",
          categoryId: "cat4",
          category: "QA & Compliance",
          department: "QA",
          status: "published",
          version: 4,
          authorId: "u1",
          authorName: "Demo Executive",
          fileName: "capa-manual-v4.pdf",
          fileType: "pdf",
          fileSize: 3200000,
          tagsJson: '["qa","capa","compliance","audit"]',
          permissionsJson: '["all"]',
          retentionYears: 10,
          createdAt: "2026-06-12T11:00:00Z",
          updatedAt: "2026-06-25T10:00:00Z",
          publishedAt: "2026-06-25T10:00:00Z",
          publishedBy: "Demo Executive",
        },
        {
          id: "d5",
          documentId: "ADL-HR-TRN-202606-0005",
          title: "Orientation Training Guide",
          description:
            "Training guide for new employee orientation covering all required modules.",
          categoryId: "cat7",
          category: "Training Materials",
          department: "HR",
          status: "draft",
          version: 1,
          authorId: "u5",
          authorName: "HR Director",
          fileName: "orientation-guide-draft.docx",
          fileType: "docx",
          fileSize: 1500000,
          tagsJson: '["training","orientation","new-hire"]',
          permissionsJson: '["hr-director","training-coordinator"]',
          retentionYears: 5,
          createdAt: "2026-06-11T16:45:00Z",
          updatedAt: "2026-06-11T16:45:00Z",
        },
        {
          id: "d6",
          documentId: "ADL-HR-POL-202606-0006",
          title: "Code of Conduct",
          description:
            "Ethical guidelines and code of conduct for all Adolbi Care employees.",
          categoryId: "cat1",
          category: "HR Policies",
          department: "HR",
          status: "published",
          version: 2,
          authorId: "u1",
          authorName: "Demo Executive",
          fileName: "code-of-conduct-v2.pdf",
          fileType: "pdf",
          fileSize: 1200000,
          tagsJson: '["policy","ethics","conduct"]',
          permissionsJson: '["all"]',
          retentionYears: 10,
          createdAt: "2026-06-10T09:00:00Z",
          updatedAt: "2026-06-22T14:00:00Z",
          publishedAt: "2026-06-22T14:00:00Z",
          publishedBy: "Demo Executive",
        },
        {
          id: "d7",
          documentId: "ADL-CLN-PRO-202606-0007",
          title: "Medication Administration Protocol",
          description:
            "Procedures for administering and documenting medication for residential youth.",
          categoryId: "cat2",
          category: "Clinical Protocols",
          department: "Clinical",
          status: "published",
          version: 5,
          authorId: "u3",
          authorName: "Demo Clinical Lead",
          fileName: "med-admin-protocol-v5.pdf",
          fileType: "pdf",
          fileSize: 2800000,
          tagsJson: '["clinical","medication","safety","protocol"]',
          permissionsJson: '["clinical-director","case-manager","nurse"]',
          retentionYears: 10,
          createdAt: "2026-06-09T13:20:00Z",
          updatedAt: "2026-06-28T09:00:00Z",
          publishedAt: "2026-06-28T09:00:00Z",
          publishedBy: "Demo Clinical Lead",
        },
        {
          id: "d8",
          documentId: "ADL-GRO-OPS-202606-0008",
          title: "Incident Reporting Guide",
          description:
            "Guidelines for reporting and documenting incidents involving youth residents.",
          categoryId: "cat8",
          category: "Incident Reports",
          department: "GRO",
          status: "archived",
          version: 1,
          authorId: "u6",
          authorName: "GRO Admin",
          fileName: "incident-guide-v1.pdf",
          fileType: "pdf",
          fileSize: 890000,
          tagsJson: '["gro","incident","reporting","safety"]',
          permissionsJson: '["all"]',
          retentionYears: 7,
          archivedAt: "2026-06-25T16:00:00Z",
          archivedBy: "Demo Executive",
          archiveReason: "Superseded by new version",
          createdAt: "2026-06-08T10:30:00Z",
          updatedAt: "2026-06-25T16:00:00Z",
        },
        {
          id: "d9",
          documentId: "ADL-HR-POL-202606-0009",
          title: "Leave Policy 2026",
          description: "Updated leave and PTO policies effective January 2026.",
          categoryId: "cat1",
          category: "HR Policies",
          department: "HR",
          status: "draft",
          version: 1,
          authorId: "u5",
          authorName: "HR Director",
          fileName: "leave-policy-2026-draft.docx",
          fileType: "docx",
          fileSize: 680000,
          tagsJson: '["policy","leave","pto","benefits"]',
          permissionsJson: '["hr-director","super-admin"]',
          retentionYears: 7,
          createdAt: "2026-06-07T11:00:00Z",
          updatedAt: "2026-06-07T11:00:00Z",
        },
        {
          id: "d10",
          documentId: "ADL-QA-COM-202606-0010",
          title: "Internal Audit Checklist",
          description:
            "Comprehensive checklist for conducting internal quality audits.",
          categoryId: "cat4",
          category: "QA & Compliance",
          department: "QA",
          status: "in-review",
          version: 2,
          authorId: "u1",
          authorName: "Demo Executive",
          fileName: "audit-checklist-v2.xlsx",
          fileType: "xlsx",
          fileSize: 450000,
          tagsJson: '["qa","audit","checklist","compliance"]',
          permissionsJson:
            '["hr-compliance-officer","chart-auditor","super-admin"]',
          retentionYears: 7,
          createdAt: "2026-06-06T14:00:00Z",
          updatedAt: "2026-06-27T10:30:00Z",
        },
        {
          id: "d11",
          documentId: "ADL-HR-TRN-202606-0011",
          title: "CPR Certification Guide",
          description:
            "Guide for maintaining CPR certification requirements for all staff.",
          categoryId: "cat7",
          category: "Training Materials",
          department: "HR",
          status: "approved",
          version: 3,
          authorId: "u5",
          authorName: "HR Director",
          fileName: "cpr-guide-v3.pdf",
          fileType: "pdf",
          fileSize: 2100000,
          tagsJson: '["training","cpr","certification","safety"]',
          permissionsJson: '["all"]',
          retentionYears: 5,
          createdAt: "2026-06-05T08:45:00Z",
          updatedAt: "2026-06-26T11:15:00Z",
          approvedAt: "2026-06-26T11:15:00Z",
          approvedBy: "HR Director",
        },
        {
          id: "d12",
          documentId: "ADL-ALL-FRM-202606-0012",
          title: "Youth Admission Form",
          description:
            "Standard admission form template for new youth residents.",
          categoryId: "cat9",
          category: "Form Templates",
          department: "All",
          status: "published",
          version: 6,
          authorId: "u6",
          authorName: "GRO Admin",
          fileName: "admission-form-template-v6.pdf",
          fileType: "pdf",
          fileSize: 750000,
          tagsJson: '["form","template","admission","youth"]',
          permissionsJson: '["all"]',
          retentionYears: 10,
          createdAt: "2026-06-04T09:30:00Z",
          updatedAt: "2026-06-29T08:00:00Z",
          publishedAt: "2026-06-29T08:00:00Z",
          publishedBy: "GRO Admin",
        },
      ],
      total: 12,
      page: 1,
      pageSize: 20,
    };
  if (procedure === "m2.listCategories")
    return [
      {
        id: "cat1",
        name: "HR Policies",
        code: "HR-POL",
        description: "Human resources policies and procedures",
        department: "HR",
        isActive: 1,
        sortOrder: 0,
      },
      {
        id: "cat2",
        name: "Clinical Protocols",
        code: "CLN-PRO",
        description: "Clinical treatment protocols and procedures",
        department: "Clinical",
        isActive: 1,
        sortOrder: 1,
      },
      {
        id: "cat3",
        name: "GRO Operations",
        code: "GRO-OPS",
        description: "Residential facility operations manuals",
        department: "GRO",
        isActive: 1,
        sortOrder: 2,
      },
      {
        id: "cat4",
        name: "QA & Compliance",
        code: "QA-COMP",
        description: "Quality assurance and compliance documentation",
        department: "QA",
        isActive: 1,
        sortOrder: 3,
      },
      {
        id: "cat5",
        name: "Revenue Cycle",
        code: "REV-CYC",
        description: "Revenue cycle management documentation",
        department: "Revenue",
        isActive: 1,
        sortOrder: 4,
      },
      {
        id: "cat6",
        name: "GAD Administration",
        code: "GAD-ADM",
        description: "General administration documentation",
        department: "GAD",
        isActive: 1,
        sortOrder: 5,
      },
      {
        id: "cat7",
        name: "Training Materials",
        code: "TRN-MAT",
        description: "Training and educational materials",
        department: "HR",
        isActive: 1,
        sortOrder: 6,
      },
      {
        id: "cat8",
        name: "Incident Reports",
        code: "INC-RPT",
        description: "Incident and event reports",
        department: "GRO",
        isActive: 1,
        sortOrder: 7,
      },
      {
        id: "cat9",
        name: "Form Templates",
        code: "FRM-TPL",
        description: "Standard form templates",
        department: "All",
        isActive: 1,
        sortOrder: 8,
      },
      {
        id: "cat10",
        name: "Executive",
        code: "EXEC",
        description: "Executive-level documentation",
        department: "Executive",
        isActive: 1,
        sortOrder: 9,
      },
    ];
  if (procedure === "m2.getById")
    return {
      id: "d1",
      documentId: "ADL-HR-POL-202606-0001",
      title: "Employee Handbook v2026",
      description:
        "Comprehensive employee handbook covering policies, benefits, and procedures for all staff.",
      categoryId: "cat1",
      category: "HR Policies",
      department: "HR",
      status: "published",
      version: 3,
      authorId: "u1",
      authorName: "Demo Executive",
      fileName: "employee-handbook-2026.pdf",
      fileType: "pdf",
      fileSize: 2450000,
      tagsJson: '["policy","handbook","all-staff"]',
      permissionsJson: '["all"]',
      retentionYears: 7,
      createdAt: "2026-06-15T10:00:00Z",
      updatedAt: "2026-06-20T08:30:00Z",
      publishedAt: "2026-06-20T08:30:00Z",
      publishedBy: "Demo Executive",
      versions: [
        {
          id: "v3",
          documentId: "ADL-HR-POL-202606-0001",
          versionNumber: 3,
          changeSummary:
            "Updated benefits section and added remote work policy",
          fileName: "employee-handbook-2026.pdf",
          fileSize: 2450000,
          createdBy: "Demo Executive",
          createdAt: "2026-06-20T08:30:00Z",
        },
        {
          id: "v2",
          documentId: "ADL-HR-POL-202606-0001",
          versionNumber: 2,
          changeSummary: "Revised PTO accrual rates",
          fileName: "employee-handbook-v2.pdf",
          fileSize: 2200000,
          createdBy: "HR Director",
          createdAt: "2026-03-15T14:00:00Z",
        },
        {
          id: "v1",
          documentId: "ADL-HR-POL-202606-0001",
          versionNumber: 1,
          changeSummary: "Initial release",
          fileName: "employee-handbook-v1.pdf",
          fileSize: 2000000,
          createdBy: "Demo Executive",
          createdAt: "2026-01-10T09:00:00Z",
        },
      ],
      audit: [
        {
          id: "a1",
          documentId: "ADL-HR-POL-202606-0001",
          action: "status-changed",
          actorId: "u1",
          actorName: "Demo Executive",
          fromStatus: "approved",
          toStatus: "published",
          details: "Published after final review",
          createdAt: "2026-06-20T08:30:00Z",
        },
        {
          id: "a2",
          documentId: "ADL-HR-POL-202606-0001",
          action: "status-changed",
          actorId: "u1",
          actorName: "Demo Executive",
          fromStatus: "in-review",
          toStatus: "approved",
          details: "Approved with minor edits",
          createdAt: "2026-06-19T16:00:00Z",
        },
        {
          id: "a3",
          documentId: "ADL-HR-POL-202606-0001",
          action: "created",
          actorId: "u1",
          actorName: "Demo Executive",
          toStatus: "draft",
          details: "Document created: Employee Handbook v2026",
          createdAt: "2026-06-15T10:00:00Z",
        },
      ],
    };
  if (
    procedure === "m2.create" ||
    procedure === "m2.update" ||
    procedure === "m2.delete" ||
    procedure === "m2.transitionStatus" ||
    procedure === "m2.createVersion" ||
    procedure === "m2.seedCategories"
  )
    return { success: true };
  // ─── M3 ENDPOINTS (QA & Compliance) ──────────────────────
  if (procedure === "m3.dashboardKPIs")
    return {
      totalAudits: 5,
      openAudits: 2,
      completedAudits: 3,
      avgScore: 94,
      totalIncidents: 4,
      openIncidents: 1,
      criticalIncidents: 0,
      totalCAPAs: 6,
      openCAPAs: 3,
      overdueCAPAs: 1,
      highPriorityCAPAs: 2,
    };
  if (procedure === "m3.complianceScores")
    return [
      {
        area: "HIPAA Privacy",
        score: 98,
        status: "compliant",
        lastAudited: "2026-06-15",
      },
      {
        area: "HIPAA Security",
        score: 96,
        status: "compliant",
        lastAudited: "2026-06-10",
      },
      {
        area: "42 CFR Part 2",
        score: 100,
        status: "compliant",
        lastAudited: "2026-06-20",
      },
      {
        area: "State Licensure",
        score: 92,
        status: "warning",
        lastAudited: "2026-05-28",
      },
      {
        area: "Staff Credentials",
        score: 88,
        status: "warning",
        lastAudited: "2026-06-01",
      },
      {
        area: "Incident Reporting",
        score: 100,
        status: "compliant",
        lastAudited: "2026-06-25",
      },
      {
        area: "Medication Management",
        score: 95,
        status: "compliant",
        lastAudited: "2026-06-18",
      },
      {
        area: "Youth Rights",
        score: 97,
        status: "compliant",
        lastAudited: "2026-06-12",
      },
    ];
  if (procedure === "m3.listAudits")
    return [
      {
        id: "a1",
        auditNumber: "AUD-2026-001",
        title: "Q2 Internal Audit — Clinical Documentation",
        auditType: "internal",
        scope:
          "Review of clinical session notes, treatment plans, and outcome measures for all active patients.",
        status: "completed",
        assignedAuditorId: "u1",
        department: "Clinical",
        findingsJson:
          '[{"finding":"Two session notes missing signatures","severity":"minor","status":"resolved"},{"finding":"One treatment plan overdue for review","severity":"moderate","status":"open"}]',
        score: 94,
        startedAt: "2026-06-01T09:00:00Z",
        completedAt: "2026-06-15T16:00:00Z",
        dueDate: "2026-06-15",
        createdAt: "2026-06-01T09:00:00Z",
        updatedAt: "2026-06-15T16:00:00Z",
      },
      {
        id: "a2",
        auditNumber: "AUD-2026-002",
        title: "Annual HIPAA Privacy Assessment",
        auditType: "regulatory",
        scope:
          "Comprehensive review of HIPAA privacy practices including access logs, BAAs, and staff training records.",
        status: "in_progress",
        assignedAuditorId: "u5",
        department: "All",
        findingsJson: "[]",
        score: null,
        startedAt: "2026-06-20T08:00:00Z",
        completedAt: null,
        dueDate: "2026-07-10",
        createdAt: "2026-06-20T08:00:00Z",
        updatedAt: "2026-06-27T14:00:00Z",
      },
      {
        id: "a3",
        auditNumber: "AUD-2026-003",
        title: "GRO Residential Safety Inspection",
        auditType: "internal",
        scope:
          "Physical safety inspection of GRO facility including fire safety, medication storage, and youth common areas.",
        status: "completed",
        assignedAuditorId: "u6",
        department: "GRO",
        findingsJson:
          '[{"finding":"Expired fire extinguisher in wing B","severity":"major","status":"resolved"},{"finding":"Missing safety sign in laundry room","severity":"minor","status":"resolved"}]',
        score: 97,
        startedAt: "2026-06-10T10:00:00Z",
        completedAt: "2026-06-18T12:00:00Z",
        dueDate: "2026-06-20",
        createdAt: "2026-06-10T10:00:00Z",
        updatedAt: "2026-06-18T12:00:00Z",
      },
      {
        id: "a4",
        auditNumber: "AUD-2026-004",
        title: "Staff Credential Verification",
        auditType: "regulatory",
        scope:
          "Verify all clinical staff credentials are current and properly documented in personnel files.",
        status: "planned",
        assignedAuditorId: "u5",
        department: "HR",
        findingsJson: "[]",
        score: null,
        startedAt: null,
        completedAt: null,
        dueDate: "2026-07-15",
        createdAt: "2026-06-25T09:00:00Z",
        updatedAt: "2026-06-25T09:00:00Z",
      },
      {
        id: "a5",
        auditNumber: "AUD-2026-005",
        title: "Revenue Cycle Billing Accuracy",
        auditType: "peer_review",
        scope:
          "Random sample review of submitted claims for coding accuracy and documentation support.",
        status: "completed",
        assignedAuditorId: "u1",
        department: "Revenue",
        findingsJson:
          '[{"finding":"3 claims missing required authorization numbers","severity":"moderate","status":"open"}]',
        score: 91,
        startedAt: "2026-06-05T11:00:00Z",
        completedAt: "2026-06-22T15:00:00Z",
        dueDate: "2026-06-30",
        createdAt: "2026-06-05T11:00:00Z",
        updatedAt: "2026-06-22T15:00:00Z",
      },
    ];
  if (procedure === "m3.listIncidents")
    return [
      {
        id: "i1",
        incidentNumber: "INC-2026-001",
        title: "Youth eloped from common area",
        description:
          "Resident left the common area unsupervised during transition between activities. Found in courtyard within 5 minutes.",
        incidentType: "behavioral",
        severity: "high",
        status: "resolved",
        patientId: "p1",
        reportedBy: "rcs-day@amos-ops.invalid",
        assignedTo: "gro.admin@amos-ops.invalid",
        occurredAt: "2026-06-15T14:30:00Z",
        resolvedAt: "2026-06-15T14:35:00Z",
        resolutionNotes:
          "Youth returned to unit. Behavioral assessment completed. Increased transition monitoring implemented.",
        followUpRequired: 1,
        followUpDate: "2026-07-15",
        createdAt: "2026-06-15T14:30:00Z",
        updatedAt: "2026-06-15T16:00:00Z",
      },
      {
        id: "i2",
        incidentNumber: "INC-2026-002",
        title: "Medication administration delay",
        description:
          "Evening medication round delayed by 45 minutes due to pharmacy delivery issue.",
        incidentType: "medication_error",
        severity: "moderate",
        status: "resolved",
        patientId: "p2",
        reportedBy: "nurse@amos-ops.invalid",
        assignedTo: "clinical-director@amos-ops.invalid",
        occurredAt: "2026-06-18T20:00:00Z",
        resolvedAt: "2026-06-18T21:15:00Z",
        resolutionNotes:
          "Medications administered after pharmacy delivery. No adverse effects noted. Process review scheduled.",
        followUpRequired: 1,
        followUpDate: "2026-07-05",
        createdAt: "2026-06-18T20:00:00Z",
        updatedAt: "2026-06-18T21:15:00Z",
      },
      {
        id: "i3",
        incidentNumber: "INC-2026-003",
        title: "Visitor signed in without ID check",
        description:
          "A visitor was allowed to sign in without proper photo ID verification during busy intake period.",
        incidentType: "other",
        severity: "moderate",
        status: "under_investigation",
        patientId: null,
        reportedBy: "rcs-lead@amos-ops.invalid",
        assignedTo: "gro.admin@amos-ops.invalid",
        occurredAt: "2026-06-25T10:15:00Z",
        resolvedAt: null,
        resolutionNotes: null,
        followUpRequired: 1,
        followUpDate: "2026-07-10",
        createdAt: "2026-06-25T10:15:00Z",
        updatedAt: "2026-06-26T09:00:00Z",
      },
      {
        id: "i4",
        incidentNumber: "INC-2026-004",
        title: "Equipment malfunction — vital signs monitor",
        description:
          "Vital signs monitor in the clinic displayed inaccurate readings. Device removed from service.",
        incidentType: "equipment",
        severity: "low",
        status: "resolved",
        patientId: null,
        reportedBy: "clinical-director@amos-ops.invalid",
        assignedTo: "gad.ops@amos-ops.invalid",
        occurredAt: "2026-06-28T08:00:00Z",
        resolvedAt: "2026-06-28T14:00:00Z",
        resolutionNotes:
          "Device replaced with backup unit. Manufacturer service request submitted for repair.",
        followUpRequired: 0,
        followUpDate: null,
        createdAt: "2026-06-28T08:00:00Z",
        updatedAt: "2026-06-28T14:00:00Z",
      },
    ];
  if (procedure === "m3.listCorrectiveActions")
    return [
      {
        id: "ca1",
        actionNumber: "CAPA-2026-001",
        title: "Implement dual-signature medication check",
        description:
          "Require two licensed staff to verify all medication administrations after the June 18 delay incident.",
        relatedAuditId: null,
        relatedIncidentId: "i2",
        priority: "high",
        status: "in_progress",
        assignedTo: "clinical-director@amos-ops.invalid",
        dueDate: "2026-07-20",
        completedAt: null,
        completionNotes: null,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: "2026-06-19T09:00:00Z",
        updatedAt: "2026-06-27T10:00:00Z",
      },
      {
        id: "ca2",
        actionNumber: "CAPA-2026-002",
        title: "Update visitor sign-in procedures",
        description:
          "Revise visitor management SOP to require photo ID for all visitors regardless of familiarity.",
        relatedAuditId: null,
        relatedIncidentId: "i3",
        priority: "urgent",
        status: "open",
        assignedTo: "gro.admin@amos-ops.invalid",
        dueDate: "2026-07-05",
        completedAt: null,
        completionNotes: null,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: "2026-06-26T09:00:00Z",
        updatedAt: "2026-06-26T09:00:00Z",
      },
      {
        id: "ca3",
        actionNumber: "CAPA-2026-003",
        title: "Transition monitoring enhancement",
        description:
          "Add additional RCS staffing during activity transitions. Implement check-in protocol.",
        relatedAuditId: null,
        relatedIncidentId: "i1",
        priority: "high",
        status: "completed",
        assignedTo: "rcs-lead@amos-ops.invalid",
        dueDate: "2026-07-01",
        completedAt: "2026-06-20T12:00:00Z",
        completionNotes:
          "Additional RCS assigned to transition periods. New check-in protocol implemented and staff trained.",
        verifiedBy: "Demo Executive",
        verifiedAt: "2026-06-22T10:00:00Z",
        createdAt: "2026-06-16T08:00:00Z",
        updatedAt: "2026-06-22T10:00:00Z",
      },
      {
        id: "ca4",
        actionNumber: "CAPA-2026-004",
        title: "Fire extinguisher inspection schedule",
        description:
          "Establish monthly fire extinguisher inspection schedule with documentation requirements.",
        relatedAuditId: "a3",
        relatedIncidentId: null,
        priority: "medium",
        status: "completed",
        assignedTo: "gad.ops@amos-ops.invalid",
        dueDate: "2026-06-25",
        completedAt: "2026-06-19T14:00:00Z",
        completionNotes:
          "Monthly inspection calendar created. GAD team assigned recurring inspections.",
        verifiedBy: "Demo Executive",
        verifiedAt: "2026-06-20T09:00:00Z",
        createdAt: "2026-06-18T13:00:00Z",
        updatedAt: "2026-06-20T09:00:00Z",
      },
      {
        id: "ca5",
        actionNumber: "CAPA-2026-005",
        title: "Claims authorization verification process",
        description:
          "Implement pre-submission authorization verification for all claims before billing submission.",
        relatedAuditId: "a5",
        relatedIncidentId: null,
        priority: "medium",
        status: "in_progress",
        assignedTo: "revenue@amos-ops.invalid",
        dueDate: "2026-07-15",
        completedAt: null,
        completionNotes: null,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: "2026-06-23T11:00:00Z",
        updatedAt: "2026-06-27T15:00:00Z",
      },
      {
        id: "ca6",
        actionNumber: "CAPA-2026-006",
        title: "Equipment maintenance log digitization",
        description:
          "Move all equipment maintenance tracking from paper to AMOS-Ops digital system.",
        relatedAuditId: null,
        relatedIncidentId: "i4",
        priority: "low",
        status: "open",
        assignedTo: "gad.ops@amos-ops.invalid",
        dueDate: "2026-08-01",
        completedAt: null,
        completionNotes: null,
        verifiedBy: null,
        verifiedAt: null,
        createdAt: "2026-06-28T15:00:00Z",
        updatedAt: "2026-06-28T15:00:00Z",
      },
    ];
  if (
    procedure === "m3.getAudit" ||
    procedure === "m3.getIncident" ||
    procedure === "m3.getCorrectiveAction"
  )
    return { id: "a1" };
  // ─── M4 ENDPOINTS (Revenue Cycle) ────────────────────────
  if (procedure === "m4.dashboardKPIs")
    return {
      totalClaims: 8,
      totalBilled: 5285000,
      totalCollected: 3250000,
      collectionRate: 61,
      pendingClaims: 2,
      submittedClaims: 1,
      approvedClaims: 1,
      deniedClaims: 1,
      paidClaims: 2,
      appealedClaims: 1,
      aging30: 1250000,
      aging60: 875000,
      aging90: 625000,
    };
  if (procedure === "m4.agingReport")
    return [
      { label: "0-30 Days", total: 1250000, count: 3 },
      { label: "31-60 Days", total: 875000, count: 2 },
      { label: "61-90 Days", total: 625000, count: 2 },
      { label: "91-120 Days", total: 375000, count: 1 },
      { label: "120+ Days", total: 0, count: 0 },
    ];
  if (procedure === "m4.listPayers")
    return [
      {
        id: "py1",
        name: "Texas Medicaid",
        payerType: "medicaid",
        contactPhone: "1-800-555-0100",
        contactEmail: "provider@example.invalid",
        claimsAddress: "PO Box 149021, Austin, TX 78714",
        isActive: 1,
        createdAt: "2026-01-01",
      },
      {
        id: "py2",
        name: "Blue Cross Blue Shield TX",
        payerType: "insurance",
        contactPhone: "1-800-555-0200",
        contactEmail: "claims@example.invalid",
        claimsAddress: "PO Box 660044, Dallas, TX 75266",
        isActive: 1,
        createdAt: "2026-01-01",
      },
      {
        id: "py3",
        name: "Aetna Better Health",
        payerType: "insurance",
        contactPhone: "1-800-555-0300",
        contactEmail: "claims@example.invalid",
        claimsAddress: "PO Box 14079, Lexington, KY 40512",
        isActive: 1,
        createdAt: "2026-01-01",
      },
      {
        id: "py4",
        name: "UnitedHealthcare",
        payerType: "insurance",
        contactPhone: "1-800-555-0400",
        contactEmail: "claims@example.invalid",
        claimsAddress: "PO Box 30555, Salt Lake City, UT 84130",
        isActive: 1,
        createdAt: "2026-01-01",
      },
      {
        id: "py5",
        name: "Self-Pay",
        payerType: "self_pay",
        contactPhone: null,
        contactEmail: null,
        claimsAddress: null,
        isActive: 1,
        createdAt: "2026-01-01",
      },
    ];
  if (procedure === "m4.listClaims")
    return {
      claims: [
        {
          id: "c1",
          claimNumber: "CLM-2026-001",
          patientId: "Youth A",
          payerId: "py1",
          payerName: "Texas Medicaid",
          clinicianId: "u2",
          serviceDate: "2026-06-01",
          submissionDate: "2026-06-03",
          status: "paid",
          totalAmount: 1250000,
          paidAmount: 1250000,
          balance: 0,
          denialReason: null,
          denialCode: null,
          appealStatus: "not_appealed",
          createdAt: "2026-06-01",
        },
        {
          id: "c2",
          claimNumber: "CLM-2026-002",
          patientId: "Youth B",
          payerId: "py2",
          payerName: "Blue Cross Blue Shield TX",
          clinicianId: "u3",
          serviceDate: "2026-06-05",
          submissionDate: "2026-06-07",
          status: "paid",
          totalAmount: 2000000,
          paidAmount: 2000000,
          balance: 0,
          denialReason: null,
          denialCode: null,
          appealStatus: "not_appealed",
          createdAt: "2026-06-05",
        },
        {
          id: "c3",
          claimNumber: "CLM-2026-003",
          patientId: "Youth C",
          payerId: "py3",
          payerName: "Aetna Better Health",
          clinicianId: "u4",
          serviceDate: "2026-06-10",
          submissionDate: "2026-06-12",
          status: "denied",
          totalAmount: 875000,
          paidAmount: 0,
          balance: 875000,
          denialReason: "Authorization not on file at time of service",
          denialCode: "CO-29",
          appealStatus: "not_appealed",
          createdAt: "2026-06-10",
        },
        {
          id: "c4",
          claimNumber: "CLM-2026-004",
          patientId: "Youth D",
          payerId: "py1",
          payerName: "Texas Medicaid",
          clinicianId: "u2",
          serviceDate: "2026-06-15",
          submissionDate: null,
          status: "pending",
          totalAmount: 560000,
          paidAmount: 0,
          balance: 560000,
          denialReason: null,
          denialCode: null,
          appealStatus: "not_appealed",
          createdAt: "2026-06-15",
        },
        {
          id: "c5",
          claimNumber: "CLM-2026-005",
          patientId: "Youth E",
          payerId: "py4",
          payerName: "UnitedHealthcare",
          clinicianId: "u3",
          serviceDate: "2026-06-18",
          submissionDate: "2026-06-20",
          status: "submitted",
          totalAmount: 1500000,
          paidAmount: 0,
          balance: 1500000,
          denialReason: null,
          denialCode: null,
          appealStatus: "not_appealed",
          createdAt: "2026-06-18",
        },
        {
          id: "c6",
          claimNumber: "CLM-2026-006",
          patientId: "Youth A",
          payerId: "py2",
          payerName: "Blue Cross Blue Shield TX",
          clinicianId: "u4",
          serviceDate: "2026-06-22",
          submissionDate: null,
          status: "draft",
          totalAmount: 375000,
          paidAmount: 0,
          balance: 375000,
          denialReason: null,
          denialCode: null,
          appealStatus: "not_appealed",
          createdAt: "2026-06-22",
        },
        {
          id: "c7",
          claimNumber: "CLM-2026-007",
          patientId: "Youth B",
          payerId: "py3",
          payerName: "Aetna Better Health",
          clinicianId: "u2",
          serviceDate: "2026-06-25",
          submissionDate: "2026-06-27",
          status: "appealed",
          totalAmount: 950000,
          paidAmount: 0,
          balance: 950000,
          denialReason:
            "Service not medically necessary — documentation insufficient",
          denialCode: "CO-50",
          appealStatus: "in_review",
          createdAt: "2026-06-25",
        },
        {
          id: "c8",
          claimNumber: "CLM-2026-008",
          patientId: "Youth C",
          payerId: "py1",
          payerName: "Texas Medicaid",
          clinicianId: "u3",
          serviceDate: "2026-06-28",
          submissionDate: null,
          status: "draft",
          totalAmount: 480000,
          paidAmount: 0,
          balance: 480000,
          denialReason: null,
          denialCode: null,
          appealStatus: "not_appealed",
          createdAt: "2026-06-28",
        },
      ],
      total: 8,
      page: 1,
      pageSize: 25,
    };
  if (procedure === "m4.getClaim")
    return {
      id: "c1",
      claimNumber: "CLM-2026-001",
      patientId: "Youth A",
      payerId: "py1",
      payerName: "Texas Medicaid",
      clinicianId: "u2",
      serviceDate: "2026-06-01",
      submissionDate: "2026-06-03",
      status: "paid",
      totalAmount: 1250000,
      allowedAmount: 1250000,
      paidAmount: 1250000,
      patientResponsibility: 0,
      denialReason: null,
      denialCode: null,
      appealDate: null,
      appealStatus: "not_appealed",
      notes: "Full payment received. Clean claim.",
      createdAt: "2026-06-01",
      updatedAt: "2026-06-15",
      balance: 0,
      lineItems: [
        {
          id: "li1",
          claimId: "c1",
          serviceDate: "2026-06-01",
          procedureCode: "H0031",
          diagnosisCode: "F32.9",
          units: 1,
          unitPrice: 250000,
          totalPrice: 250000,
          description: "Mental health assessment by non-physician",
        },
        {
          id: "li2",
          claimId: "c1",
          serviceDate: "2026-06-01",
          procedureCode: "H0035",
          diagnosisCode: "F32.9",
          units: 10,
          unitPrice: 100000,
          totalPrice: 1000000,
          description: "Residential treatment — per diem",
        },
      ],
    };
  if (procedure === "m4.createClaim" || procedure === "m4.updateClaim")
    return { success: true };
  // ─── NEW M4: Revenue Cycle 7-Feature Extension ───────────
  if (procedure === "m4.listSubmittableClaims")
    return [
      {
        id: "c6",
        claimNumber: "CLM-2026-006",
        patientId: "Youth A",
        payerId: "py2",
        payerName: "Blue Cross Blue Shield TX",
        clinicianId: "u4",
        serviceDate: "2026-06-22",
        submissionDate: null,
        status: "draft",
        totalAmount: 375000,
        paidAmount: 0,
        balance: 375000,
        denialReason: null,
        denialCode: null,
        appealStatus: "not_appealed",
        createdAt: "2026-06-22",
      },
      {
        id: "c8",
        claimNumber: "CLM-2026-008",
        patientId: "Youth C",
        payerId: "py1",
        payerName: "Texas Medicaid",
        clinicianId: "u3",
        serviceDate: "2026-06-28",
        submissionDate: null,
        status: "draft",
        totalAmount: 480000,
        paidAmount: 0,
        balance: 480000,
        denialReason: null,
        denialCode: null,
        appealStatus: "not_appealed",
        createdAt: "2026-06-28",
      },
    ];
  if (procedure === "m4.submitClaim" || procedure === "m4.batchSubmitClaims")
    return { success: true, submissionDate: new Date().toISOString() };
  if (procedure === "m4.listAuthorizations")
    return {
      authorizations: [
        {
          id: "az1",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-4521",
          payerName: "Texas Medicaid",
          policyNumber: "TXM-88765432",
          stage: "tracking",
          status: "approved",
          authorizationNumber: "AUTH-2026-1122",
          approvedUnits: 30,
          approvedFromDate: "2026-06-01",
          approvedToDate: "2026-08-31",
          approvedLevelOfCare: "Intensive Outpatient",
          readinessMetAt: "2026-05-28",
          readinessClinicalDocs: true,
          readinessAssessmentCurrent: true,
          readinessLOCSupported: true,
          readinessTreatmentPlan: true,
          readinessProgressNotes: true,
          readinessMedicalNecessity: true,
          readinessUtilizationReview: true,
          readinessGuardianConsent: true,
          readinessUB04Clean: true,
          readinessExcludedServices: true,
          submissionDate: "2026-05-28",
          submittedBy: "billing@amos-ops.invalid",
          submissionMethod: "portal",
          submissionReference: null,
          denialReason: null,
          appealDate: null,
          appealStatus: null,
          reauthDueDate: "2026-08-15",
          reauthStatus: "upcoming",
          daysUntilExpiration: 45,
          createdAt: "2026-05-01",
          updatedAt: "2026-06-28",
        },
        {
          id: "az2",
          youthId: "youth-002",
          youthName: "Synthetic Youth 005",
          mrn: "SYNTH-REC-4522",
          payerName: "Blue Cross Blue Shield TX",
          policyNumber: "BCBS-223344",
          stage: "readiness",
          status: "in_progress",
          authorizationNumber: null,
          approvedUnits: null,
          approvedFromDate: null,
          approvedToDate: null,
          approvedLevelOfCare: null,
          readinessMetAt: null,
          readinessClinicalDocs: true,
          readinessAssessmentCurrent: true,
          readinessLOCSupported: true,
          readinessTreatmentPlan: true,
          readinessProgressNotes: true,
          readinessMedicalNecessity: false,
          readinessUtilizationReview: true,
          readinessGuardianConsent: true,
          readinessUB04Clean: true,
          readinessExcludedServices: true,
          submissionDate: null,
          submittedBy: null,
          submissionMethod: null,
          submissionReference: null,
          denialReason: null,
          appealDate: null,
          appealStatus: null,
          reauthDueDate: null,
          reauthStatus: "not_due",
          daysUntilExpiration: null,
          createdAt: "2026-06-15",
          updatedAt: "2026-06-28",
        },
        {
          id: "az3",
          youthId: "youth-003",
          youthName: "Synthetic Youth 007",
          mrn: "SYNTH-REC-4523",
          payerName: "Aetna Better Health",
          policyNumber: "ABH-998877",
          stage: "submission",
          status: "submitted",
          authorizationNumber: null,
          approvedUnits: null,
          approvedFromDate: null,
          approvedToDate: null,
          approvedLevelOfCare: null,
          readinessMetAt: "2026-06-20",
          readinessClinicalDocs: true,
          readinessAssessmentCurrent: true,
          readinessLOCSupported: true,
          readinessTreatmentPlan: true,
          readinessProgressNotes: true,
          readinessMedicalNecessity: true,
          readinessUtilizationReview: true,
          readinessGuardianConsent: true,
          readinessUB04Clean: true,
          readinessExcludedServices: true,
          submissionDate: "2026-06-25",
          submittedBy: "billing@amos-ops.invalid",
          submissionMethod: "fax",
          submissionReference: "FAX-REF-998877",
          denialReason: null,
          appealDate: null,
          appealStatus: null,
          reauthDueDate: null,
          reauthStatus: "not_due",
          daysUntilExpiration: null,
          createdAt: "2026-06-10",
          updatedAt: "2026-06-25",
        },
        {
          id: "az4",
          youthId: "youth-001",
          youthName: "Synthetic Youth 001",
          mrn: "SYNTH-REC-4521",
          payerName: "Texas Medicaid",
          policyNumber: "TXM-88765432",
          stage: "reauthorization",
          status: "in_progress",
          authorizationNumber: "AUTH-2026-1123",
          approvedUnits: 15,
          approvedFromDate: "2026-03-01",
          approvedToDate: "2026-05-31",
          approvedLevelOfCare: "Residential",
          readinessMetAt: null,
          readinessClinicalDocs: false,
          readinessAssessmentCurrent: false,
          readinessLOCSupported: false,
          readinessTreatmentPlan: false,
          readinessProgressNotes: false,
          readinessMedicalNecessity: false,
          readinessUtilizationReview: false,
          readinessGuardianConsent: false,
          readinessUB04Clean: false,
          readinessExcludedServices: false,
          submissionDate: null,
          submittedBy: null,
          submissionMethod: null,
          submissionReference: null,
          denialReason: null,
          appealDate: null,
          appealStatus: null,
          reauthDueDate: "2026-07-20",
          reauthStatus: "overdue",
          daysUntilExpiration: -5,
          createdAt: "2026-02-01",
          updatedAt: "2026-06-28",
        },
      ],
      total: 4,
      page: 1,
      pageSize: 25,
    };
  if (procedure === "m4.getAuthorization")
    return {
      id: "az1",
      youthId: "youth-001",
      youthName: "Synthetic Youth 001",
      mrn: "SYNTH-REC-4521",
      payerName: "Texas Medicaid",
      policyNumber: "TXM-88765432",
      stage: "tracking",
      status: "approved",
      authorizationNumber: "AUTH-2026-1122",
      approvedUnits: 30,
      approvedFromDate: "2026-06-01",
      approvedToDate: "2026-08-31",
      approvedLevelOfCare: "Intensive Outpatient",
      readinessMetAt: "2026-05-28",
      readinessClinicalDocs: true,
      readinessAssessmentCurrent: true,
      readinessLOCSupported: true,
      readinessTreatmentPlan: true,
      readinessProgressNotes: true,
      readinessMedicalNecessity: true,
      readinessUtilizationReview: true,
      readinessGuardianConsent: true,
      readinessUB04Clean: true,
      readinessExcludedServices: true,
      submissionDate: "2026-05-28",
      submittedBy: "billing@amos-ops.invalid",
      submissionMethod: "portal",
      submissionReference: null,
      denialReason: null,
      appealDate: null,
      appealStatus: null,
      reauthDueDate: "2026-08-15",
      reauthStatus: "upcoming",
      daysUntilExpiration: 45,
      retrospectiveReviewDate: null,
      retrospectiveFindings: null,
      retrospectiveActions: null,
      billingExcludedServices: null,
      exclusionControlsApplied: null,
      createdAt: "2026-05-01",
      updatedAt: "2026-06-28",
      createdBy: "system",
    };
  if (
    procedure === "m4.createAuthorization" ||
    procedure === "m4.updateAuthorization" ||
    procedure === "m4.deleteAuthorization"
  )
    return { success: true };
  if (procedure === "m4.getPayerPacketRequirements")
    return {
      payer: {
        id: "py1",
        name: "Texas Medicaid",
        payerType: "medicaid",
        contactPhone: "1-800-555-0100",
        contactEmail: "provider@example.invalid",
        claimsAddress: "PO Box 149021, Austin, TX 78714",
        isActive: 1,
        createdAt: "2026-01-01",
      },
      requirements: [
        { document: "UB-04 Claim Form", required: true, category: "billing" },
        { document: "Itemized Statement", required: true, category: "billing" },
        { document: "Treatment Plan", required: true, category: "clinical" },
        {
          document: "Initial Assessment",
          required: true,
          category: "clinical",
        },
        {
          document: "Progress Notes (Current)",
          required: true,
          category: "clinical",
        },
        {
          document: "Medical Necessity Letter",
          required: true,
          category: "clinical",
        },
        {
          document: "Level of Care Determination",
          required: true,
          category: "clinical",
        },
        {
          document: "Guardian Consent Form",
          required: true,
          category: "legal",
        },
        {
          document: "Authorization for Release of Info",
          required: true,
          category: "legal",
        },
        {
          document: "Utilization Review Summary",
          required: true,
          category: "review",
        },
        {
          document: "Excluded Services Acknowledgment",
          required: true,
          category: "billing",
        },
        {
          document: "Proof of Service Documentation",
          required: true,
          category: "compliance",
        },
      ],
    };
  if (procedure === "m4.buildPayerPacket")
    return {
      success: true,
      packetSummary: { included: 8, missing: 4, total: 12 },
    };
  if (procedure === "m4.listPayerPackets")
    return [
      {
        claimId: "c6",
        claimNumber: "CLM-2026-006",
        patientId: "Youth A",
        payerName: "Blue Cross Blue Shield TX",
        builtAt: "2026-06-25T10:00:00Z",
        builtBy: "billing@amos-ops.invalid",
        summary: { included: 10, missing: 2, total: 12 },
        packetData: {
          builtAt: "2026-06-25T10:00:00Z",
          builtBy: "billing@amos-ops.invalid",
          documents: [],
          summary: { included: 10, missing: 2, total: 12 },
        },
      },
    ];
  if (procedure === "m4.listDeniedClaims")
    return [
      {
        id: "c3",
        claimNumber: "CLM-2026-003",
        patientId: "Youth C",
        payerId: "py3",
        payerName: "Aetna Better Health",
        clinicianId: "u4",
        serviceDate: "2026-06-10",
        submissionDate: "2026-06-12",
        status: "denied",
        totalAmount: 875000,
        paidAmount: 0,
        balance: 875000,
        denialReason: "Authorization not on file at time of service",
        denialCode: "CO-29",
        appealDate: null,
        appealStatus: "not_appealed",
        createdAt: "2026-06-10",
      },
      {
        id: "c7",
        claimNumber: "CLM-2026-007",
        patientId: "Youth B",
        payerId: "py3",
        payerName: "Aetna Better Health",
        clinicianId: "u2",
        serviceDate: "2026-06-25",
        submissionDate: "2026-06-27",
        status: "appealed",
        totalAmount: 950000,
        paidAmount: 0,
        balance: 950000,
        denialReason:
          "Service not medically necessary — documentation insufficient",
        denialCode: "CO-50",
        appealDate: "2026-06-28",
        appealStatus: "in_review",
        createdAt: "2026-06-25",
      },
    ];
  if (procedure === "m4.appealClaim" || procedure === "m4.updateAppealStatus")
    return { success: true };
  if (procedure === "m4.getDenialAnalytics")
    return {
      totalDenied: 2,
      totalDeniedAmount: 1825000,
      appealedCount: 1,
      byCode: [
        {
          code: "CO-29",
          count: 1,
          totalAmount: 875000,
          reason: "Authorization not on file at time of service",
        },
        {
          code: "CO-50",
          count: 1,
          totalAmount: 950000,
          reason:
            "Service not medically necessary — documentation insufficient",
        },
      ],
      byPayer: [{ count: 2, name: "Aetna Better Health" }],
    };
  if (procedure === "m4.agingQueueByPayer")
    return [
      {
        payerName: "Texas Medicaid",
        payerType: "medicaid",
        total: 2060000,
        count: 3,
        buckets: {
          "0-30": 1250000,
          "31-60": 560000,
          "61-90": 250000,
          "91-120": 0,
          "120+": 0,
        },
      },
      {
        payerName: "Blue Cross Blue Shield TX",
        payerType: "insurance",
        total: 375000,
        count: 1,
        buckets: {
          "0-30": 0,
          "31-60": 375000,
          "61-90": 0,
          "91-120": 0,
          "120+": 0,
        },
      },
      {
        payerName: "UnitedHealthcare",
        payerType: "insurance",
        total: 1500000,
        count: 1,
        buckets: {
          "0-30": 1500000,
          "31-60": 0,
          "61-90": 0,
          "91-120": 0,
          "120+": 0,
        },
      },
      {
        payerName: "Aetna Better Health",
        payerType: "insurance",
        total: 1825000,
        count: 2,
        buckets: {
          "0-30": 950000,
          "31-60": 0,
          "61-90": 875000,
          "91-120": 0,
          "120+": 0,
        },
      },
    ];
  if (procedure === "m4.getProofOfServiceStatus")
    return {
      claimId: "c1",
      claimNumber: "CLM-2026-001",
      status: "cleared",
      checks: [
        {
          gate: "Service Date Valid",
          passed: true,
          required: true,
          category: "validation",
        },
        {
          gate: "Procedure Codes Present",
          passed: true,
          required: true,
          category: "validation",
        },
        {
          gate: "Diagnosis Codes Linked",
          passed: true,
          required: true,
          category: "clinical",
        },
        {
          gate: "Units Match Duration",
          passed: true,
          required: true,
          category: "validation",
        },
        {
          gate: "Clinician Identified",
          passed: true,
          required: true,
          category: "compliance",
        },
        {
          gate: "Payer Assigned",
          passed: true,
          required: true,
          category: "billing",
        },
        {
          gate: "Line Items Totals Match",
          passed: true,
          required: true,
          category: "validation",
        },
        {
          gate: "No Duplicate Procedures",
          passed: true,
          required: false,
          category: "validation",
        },
        {
          gate: "UB-04 Data Complete",
          passed: true,
          required: true,
          category: "billing",
        },
        {
          gate: "HIPAA Format Check",
          passed: true,
          required: true,
          category: "compliance",
        },
      ],
      summary: { passed: 10, total: 10, requiredPassed: 8, requiredTotal: 8 },
      clearedAt: new Date().toISOString(),
    };
  // ─── M5 ENDPOINTS (Clinical) ─────────────────────────────
  if (procedure === "bhc.dashboardKPIs")
    return {
      totalPatients: 5,
      activePatients: 4,
      sessionsThisWeek: 8,
      sessionsToday: 2,
      highRiskCount: 1,
      pendingApprovals: 1,
    };
  if (procedure === "bhc.listPatients")
    return {
      patients: [
        {
          id: "p1",
          mrn: "SYNTH-REC-4521",
          firstName: "Synthetic-Person-001",
          lastName: "Johnson",
          dateOfBirth: "2010-03-15",
          gender: "male",
          phone: "(512) 555-0101",
          email: "guardian.mjohnson@example.invalid",
          address: "1423 Cypress Lane, Houston, TX 77001",
          insuranceId: "TXM-88765432",
          emergencyName: "Synthetic Guardian 01",
          emergencyPhone: "(512) 555-0102",
          referralSource: "HISD School Counselor",
          status: "active",
          assignedClinicianId: "u2",
          intakeDate: "2026-04-01T10:00:00Z",
          dischargeDate: null,
          dischargeReason: null,
          createdAt: "2026-04-01T10:00:00Z",
          updatedAt: "2026-06-28T14:00:00Z",
        },
        {
          id: "p2",
          mrn: "SYNTH-REC-4522",
          firstName: "Synthetic-Person-005",
          lastName: "Williams",
          dateOfBirth: "2009-07-22",
          gender: "female",
          phone: "(713) 555-0201",
          email: "guardian.awilliams@example.invalid",
          address: "2809 Oak Street, Houston, TX 77002",
          insuranceId: "BCBS-TX-11223344",
          emergencyName: "Synthetic Guardian 03",
          emergencyPhone: "(713) 555-0202",
          referralSource: "Pediatrician Dr. Chen",
          status: "active",
          assignedClinicianId: "u3",
          intakeDate: "2026-04-15T09:30:00Z",
          dischargeDate: null,
          dischargeReason: null,
          createdAt: "2026-04-15T09:30:00Z",
          updatedAt: "2026-06-27T11:00:00Z",
        },
        {
          id: "p3",
          mrn: "SYNTH-REC-4523",
          firstName: "Synthetic-Person-004",
          lastName: "Martinez",
          dateOfBirth: "2011-01-08",
          gender: "male",
          phone: "(281) 555-0301",
          email: "guardian.cmartinez@example.invalid",
          address: "567 Elm Avenue, Houston, TX 77003",
          insuranceId: "TXM-77654321",
          emergencyName: "Synthetic Guardian 02",
          emergencyPhone: "(281) 555-0302",
          referralSource: "DCF Caseworker",
          status: "active",
          assignedClinicianId: "u2",
          intakeDate: "2026-05-01T14:00:00Z",
          dischargeDate: null,
          dischargeReason: null,
          createdAt: "2026-05-01T14:00:00Z",
          updatedAt: "2026-06-26T16:00:00Z",
        },
        {
          id: "p4",
          mrn: "SYNTH-REC-4524",
          firstName: "Synthetic-Person-002",
          lastName: "Thompson",
          dateOfBirth: "2008-11-30",
          gender: "female",
          phone: "(713) 555-0401",
          email: "guardian.jthompson@example.invalid",
          address: "901 Pine Ridge Rd, Houston, TX 77004",
          insuranceId: "ABH-99887766",
          emergencyName: "Synthetic Youth 011",
          emergencyPhone: "(713) 555-0402",
          referralSource: "Juvenile Court Probation",
          status: "hold",
          assignedClinicianId: "u3",
          intakeDate: "2026-05-20T11:00:00Z",
          dischargeDate: null,
          dischargeReason: null,
          createdAt: "2026-05-20T11:00:00Z",
          updatedAt: "2026-06-25T09:00:00Z",
        },
        {
          id: "p5",
          mrn: "SYNTH-REC-4525",
          firstName: "Synthetic-Person-014",
          lastName: "Davis",
          dateOfBirth: "2010-09-14",
          gender: "male",
          phone: "(832) 555-0501",
          email: "guardian.edavis@example.invalid",
          address: "445 Birchwood Dr, Houston, TX 77005",
          insuranceId: "UHC-55443322",
          emergencyName: "Synthetic Guardian 04",
          emergencyPhone: "(832) 555-0502",
          referralSource: "Family Self-Referral",
          status: "discharged",
          assignedClinicianId: "u2",
          intakeDate: "2026-01-10T08:00:00Z",
          dischargeDate: "2026-06-01T12:00:00Z",
          dischargeReason:
            "Treatment goals completed. Referred to outpatient services.",
          createdAt: "2026-01-10T08:00:00Z",
          updatedAt: "2026-06-01T12:00:00Z",
        },
      ],
      total: 5,
    };
  if (procedure === "bhc.getPatient") {
    const patientId = readDemoString(input, "id", "p1");
    const patientResponse = getSingleDemoData("bhc.listPatients");
    const allPatients =
      isDemoRecord(patientResponse) && Array.isArray(patientResponse.patients)
        ? patientResponse.patients.filter(isDemoRecord)
        : [];
    const patient =
      allPatients.find(
        (candidate) => readDemoString(candidate, "id") === patientId,
      ) ?? allPatients[0];

    const treatmentPlans = [
      {
        id: "tp1",
        planNumber: "TP-2026-1001",
        patientId: "p1",
        primaryDiagnosis:
          "F32.9 Major Depressive Disorder, Single Episode, Unspecified",
        secondaryDiagnosis: "F41.1 Generalized Anxiety Disorder",
        presentingProblem:
          "Patient presents with persistent sadness, social withdrawal, declining academic performance, and insomnia lasting 4 months. Reports feeling worthless and occasional passive suicidal ideation without plan or intent.",
        goalsJson:
          '[{"description":"Reduce depression symptoms to sub-clinical levels","targetDate":"2026-08-01"},{"description":"Improve sleep hygiene to 7+ hours/night","targetDate":"2026-07-15"},{"description":"Increase social engagement with peers","targetDate":"2026-07-30"}]',
        interventionsJson:
          '[{"type":"CBT","description":"Cognitive restructuring for negative self-talk","frequency":"2x weekly"},{"type":"Group Therapy","description":"Social skills and peer support group","frequency":"1x weekly"},{"type":"Family Therapy","description":"Family communication and parenting support","frequency":"2x monthly"}]',
        estimatedDurationWeeks: 16,
        startDate: "2026-04-01",
        reviewDate: "2026-07-01",
        status: "active",
        assignedClinicianId: "u2",
        supervisorId: "u1",
        approvedBy: "Demo Clinical Director",
        approvedAt: "2026-04-03T10:00:00Z",
        createdAt: "2026-04-01T10:00:00Z",
        updatedAt: "2026-06-28T14:00:00Z",
      },
      {
        id: "tp2",
        planNumber: "TP-2026-1002",
        patientId: "p1",
        primaryDiagnosis: "F91.8 Conduct Disorder, Childhood-Onset Type",
        secondaryDiagnosis: null,
        presentingProblem:
          "Referral for behavioral outbursts, defiance toward authority, and peer aggression. History of school suspensions.",
        goalsJson:
          '[{"description":"Develop anger management coping skills","targetDate":"2026-05-01"},{"description":"Reduce aggressive incidents to zero per week","targetDate":"2026-06-01"}]',
        interventionsJson:
          '[{"type":"DBT","description":"Dialectical behavior therapy skills training","frequency":"2x weekly"},{"type":"Behavioral Modification","description":"Token economy and positive reinforcement","frequency":"daily"}]',
        estimatedDurationWeeks: 12,
        startDate: "2026-01-15",
        reviewDate: "2026-04-15",
        status: "completed",
        assignedClinicianId: "u2",
        supervisorId: "u1",
        approvedBy: "Demo Clinical Director",
        approvedAt: "2026-01-17T09:00:00Z",
        createdAt: "2026-01-15T08:00:00Z",
        updatedAt: "2026-05-01T10:00:00Z",
      },
    ];

    const recentSessions = [
      {
        id: "cs1",
        patientId: "p1",
        sessionDate: "2026-06-28T14:00:00Z",
        sessionType: "individual",
        durationMinutes: 60,
        chiefComplaint:
          "Difficulty sleeping, recurring nightmares about past trauma",
        sessionNotes:
          "Patient engaged well in session. Discussed trauma narrative processing. Patient identified 3 positive coping strategies used this week. Sleep log shows improvement from 4hrs to 6hrs average. Plan: Continue trauma-focused CBT. Assign sleep hygiene worksheet.",
        clinicianId: "u2",
        billingCode: "H0004",
        riskAssessmentJson:
          '{"suicideRisk":"low","homocideRisk":"none","elopementRisk":"none"}',
        nextSessionDate: "2026-06-30T14:00:00Z",
        nextSessionGoals:
          "Review sleep hygiene worksheet. Begin cognitive restructuring exercise.",
        status: "completed",
        createdAt: "2026-06-28T15:00:00Z",
      },
      {
        id: "cs2",
        patientId: "p1",
        sessionDate: "2026-06-25T14:00:00Z",
        sessionType: "individual",
        durationMinutes: 60,
        chiefComplaint: "Feeling overwhelmed about upcoming family visit",
        sessionNotes:
          "Patient expressed anxiety about family visit scheduled for July 4th. Explored grounding techniques and role-played communication skills. Patient practiced 'I feel' statements. Mood assessed at 5/10 (improved from 3/10 last week).",
        clinicianId: "u2",
        billingCode: "H0004",
        riskAssessmentJson:
          '{"suicideRisk":"low","homocideRisk":"none","elopementRisk":"none"}',
        nextSessionDate: "2026-06-28T14:00:00Z",
        nextSessionGoals:
          "Process family visit outcome. Introduce trauma narrative work.",
        status: "completed",
        createdAt: "2026-06-25T15:00:00Z",
      },
      {
        id: "cs3",
        patientId: "p1",
        sessionDate: "2026-06-23T10:00:00Z",
        sessionType: "group",
        durationMinutes: 90,
        chiefComplaint: null,
        sessionNotes:
          "Group session focused on peer relationships. 4 residents participated. Synthetic-Person-001 contributed actively, offering support to newer resident. Demonstrated improved empathy and communication skills. Group cohesion noted as strong.",
        clinicianId: "u3",
        billingCode: "H2036",
        riskAssessmentJson: null,
        nextSessionDate: null,
        nextSessionGoals: null,
        status: "completed",
        createdAt: "2026-06-23T11:30:00Z",
      },
      {
        id: "cs4",
        patientId: "p1",
        sessionDate: "2026-06-21T14:00:00Z",
        sessionType: "individual",
        durationMinutes: 60,
        chiefComplaint: "Passive suicidal thoughts after argument with peer",
        sessionNotes:
          "Patient reported passive SI ('I wish I wouldn't wake up') following conflict with resident Synthetic-Person-004. No plan, intent, or means. Safety plan reviewed. Patient able to identify 3 reasons for living. Agreed to increased check-ins. Notified RCS and clinical director.",
        clinicianId: "u2",
        billingCode: "H0004",
        riskAssessmentJson:
          '{"suicideRisk":"moderate","homocideRisk":"none","elopementRisk":"none"}',
        nextSessionDate: "2026-06-23T14:00:00Z",
        nextSessionGoals:
          "Follow up on SI. Process peer conflict using CBT skills.",
        status: "completed",
        createdAt: "2026-06-21T15:00:00Z",
      },
      {
        id: "cs5",
        patientId: "p1",
        sessionDate: "2026-06-18T11:00:00Z",
        sessionType: "family",
        durationMinutes: 60,
        chiefComplaint: null,
        sessionNotes:
          "Family session with mother Tanya. Discussed Synthetic-Person-001's progress and transition planning for family visit. Mother reported following recommended parenting strategies at home. Good engagement and rapport.",
        clinicianId: "u2",
        billingCode: "H0004",
        riskAssessmentJson:
          '{"suicideRisk":"low","homocideRisk":"none","elopementRisk":"none"}',
        nextSessionDate: "2026-06-21T14:00:00Z",
        nextSessionGoals:
          "Individual session. Assess mood following family session.",
        status: "completed",
        createdAt: "2026-06-18T12:00:00Z",
      },
    ];

    // Filter for the requested patient
    const patientPlans = treatmentPlans.filter(
      (plan) => plan.patientId === patientId,
    );
    const patientSessions = recentSessions.filter(
      (session) => session.patientId === patientId,
    );
    return {
      patient,
      treatmentPlans: patientPlans.length > 0 ? patientPlans : treatmentPlans,
      recentSessions:
        patientSessions.length > 0 ? patientSessions : recentSessions,
      outcomeMeasures: [],
      governedOutcomeMeasureReference: {
        milestone: "M4.1C",
        subjectId: patientId,
        disposition: "legacy_numeric_rows_quarantined",
        mode: M41C_BHC_GET_PATIENT_FALLBACK_OUTCOME_MODE,
        sourceOfTruth:
          "M4.1C Clinical Intelligence Fabric governed instrument-profile workflow",
        humanReviewRequired: true,
        liveWrites: 0,
      },
    };
  }
  if (procedure === "bhc.clinicianWorkload")
    return {
      total: 8,
      byClinician: [
        {
          clinicianId: "u2",
          name: "Demo Clinical Director",
          sessionCountThisWeek: 12,
          patientCount: 3,
        },
        {
          clinicianId: "u3",
          name: "Demo Clinical Lead",
          sessionCountThisWeek: 8,
          patientCount: 2,
        },
      ],
    };
  if (procedure === "bhc.listSessions")
    return [
      {
        id: "cs1",
        patientId: "p1",
        sessionDate: "2026-06-28T14:00:00Z",
        sessionType: "individual",
        durationMinutes: 60,
        chiefComplaint:
          "Difficulty sleeping, recurring nightmares about past trauma",
        sessionNotes:
          "Patient engaged well. Discussed trauma narrative processing. Identified 3 positive coping strategies.",
        clinicianId: "u2",
        billingCode: "H0004",
        riskAssessmentJson:
          '{"suicideRisk":"low","homocideRisk":"none","elopementRisk":"none"}',
        nextSessionDate: "2026-06-30T14:00:00Z",
        nextSessionGoals: "Review sleep hygiene worksheet.",
        status: "completed",
        createdAt: "2026-06-28T15:00:00Z",
      },
      {
        id: "cs2",
        patientId: "p2",
        sessionDate: "2026-06-28T10:00:00Z",
        sessionType: "individual",
        durationMinutes: 60,
        chiefComplaint: "Anxiety about school reintegration",
        sessionNotes:
          "Patient expressed concerns about returning to school. Explored coping strategies and role-played scenarios.",
        clinicianId: "u3",
        billingCode: "H0004",
        riskAssessmentJson:
          '{"suicideRisk":"none","homocideRisk":"none","elopementRisk":"none"}',
        nextSessionDate: "2026-06-30T10:00:00Z",
        nextSessionGoals:
          "Continue school anxiety work. Practice social scripts.",
        status: "completed",
        createdAt: "2026-06-28T11:00:00Z",
      },
      {
        id: "cs3",
        patientId: "p3",
        sessionDate: "2026-06-27T15:00:00Z",
        sessionType: "family",
        durationMinutes: 60,
        chiefComplaint: null,
        sessionNotes:
          "Family session with mother. Discussed behavioral expectations and consistent discipline strategies.",
        clinicianId: "u2",
        billingCode: "H0004",
        riskAssessmentJson:
          '{"suicideRisk":"none","homocideRisk":"none","elopementRisk":"low"}',
        nextSessionDate: "2026-06-29T15:00:00Z",
        nextSessionGoals: "Individual session. Review behavioral contract.",
        status: "completed",
        createdAt: "2026-06-27T16:00:00Z",
      },
      {
        id: "cs4",
        patientId: "p4",
        sessionDate: "2026-06-27T11:00:00Z",
        sessionType: "group",
        durationMinutes: 90,
        chiefComplaint: null,
        sessionNotes:
          "Group session on emotional regulation. 3 residents participated. Good engagement.",
        clinicianId: "u3",
        billingCode: "H2036",
        riskAssessmentJson: null,
        nextSessionDate: null,
        nextSessionGoals: null,
        status: "completed",
        createdAt: "2026-06-27T12:30:00Z",
      },
      {
        id: "cs5",
        patientId: "p1",
        sessionDate: "2026-06-30T09:00:00Z",
        sessionType: "intake",
        durationMinutes: 90,
        chiefComplaint: "Initial assessment",
        sessionNotes: "Intake session scheduled for new referral.",
        clinicianId: "u2",
        billingCode: "H0031",
        riskAssessmentJson: null,
        nextSessionDate: null,
        nextSessionGoals: null,
        status: "scheduled",
        createdAt: "2026-06-28T10:00:00Z",
      },
    ];
  if (procedure === "bhc.listInsurancePlans")
    return [
      {
        id: "plan1",
        planName: "Texas Medicaid STAR",
        payerId: "py1",
        planType: "medicaid",
        isActive: 1,
        createdAt: "2026-01-01",
      },
      {
        id: "plan2",
        planName: "BCBS TX Blue Choice",
        payerId: "py2",
        planType: "private",
        isActive: 1,
        createdAt: "2026-01-01",
      },
      {
        id: "plan3",
        planName: "Aetna Better Health TX",
        payerId: "py3",
        planType: "managed_care",
        isActive: 1,
        createdAt: "2026-01-01",
      },
      {
        id: "plan4",
        planName: "UnitedHealthcare Community",
        payerId: "py4",
        planType: "managed_care",
        isActive: 1,
        createdAt: "2026-01-01",
      },
    ];
  // bhc mutations handled by live store at line ~761
  // ─── M6 ENDPOINTS (GRO — Growth & Outreach) ──────────────
  if (procedure === "gro.dashboardKPIs")
    return {
      activeReferrals: 5,
      activePartnerships: 3,
      conversionRate: 33,
      newThisMonth: 4,
      totalReferrals: 8,
      topSources: [
        { source: "HISD School Counselor", count: 2 },
        { source: "Family Self-Referral", count: 1 },
        { source: "Juvenile Court Probation", count: 1 },
        { source: "DCF Caseworker", count: 1 },
        { source: "Community Mental Health Center", count: 1 },
      ],
    };
  if (procedure === "gro.listReferrals")
    return [
      {
        id: "r1",
        referral_number: "REF-2026-001",
        patient_name: "Synthetic Youth 029",
        contact_phone: "(713) 555-1001",
        contact_email: "parent1@example.invalid",
        referral_source: "HISD School Counselor",
        source_detail: "Kashmere High School",
        referral_type: "adolescent",
        status: "active",
        assigned_to: "rcs-lead@amos-ops.invalid",
        notes:
          "15-year-old male, depression and anxiety, parents seeking residential care",
        outcome: null,
        converted_patient_id: null,
        created_at: "2026-06-15T10:00:00Z",
        updated_at: "2026-06-15T10:00:00Z",
      },
      {
        id: "r2",
        referral_number: "REF-2026-002",
        patient_name: "Synthetic Youth 028",
        contact_phone: "(281) 555-2002",
        contact_email: "parent2@example.invalid",
        referral_source: "Pediatrician",
        source_detail: "Dr. Elena Vasquez",
        referral_type: "intake",
        status: "in_review",
        assigned_to: "clinical-director@amos-ops.invalid",
        notes:
          "14-year-old female, trauma history, self-harm behaviors. Awaiting clinical assessment.",
        outcome: null,
        converted_patient_id: null,
        created_at: "2026-06-18T09:30:00Z",
        updated_at: "2026-06-20T14:00:00Z",
      },
      {
        id: "r3",
        referral_number: "REF-2026-003",
        patient_name: "Synthetic Youth 031",
        contact_phone: "(832) 555-3003",
        contact_email: "parent3@example.invalid",
        referral_source: "Juvenile Court Probation",
        source_detail: "Harris County JJP",
        referral_type: "mandatory",
        status: "active",
        assigned_to: "gro.admin@amos-ops.invalid",
        notes:
          "Court-ordered residential placement. Aggressive behavior, prior group home disruption.",
        outcome: null,
        converted_patient_id: null,
        created_at: "2026-06-22T11:00:00Z",
        updated_at: "2026-06-22T11:00:00Z",
      },
      {
        id: "r4",
        referral_number: "REF-2026-004",
        patient_name: "Synthetic Youth 017",
        contact_phone: "(713) 555-4004",
        contact_email: "parent4@example.invalid",
        referral_source: "Family Self-Referral",
        source_detail: "Website inquiry",
        referral_type: "crisis",
        status: "new",
        assigned_to: null,
        notes:
          "16-year-old female, suicidal ideation with plan. Parent called crisis line. Needs immediate assessment.",
        outcome: null,
        converted_patient_id: null,
        created_at: "2026-06-27T08:15:00Z",
        updated_at: "2026-06-27T08:15:00Z",
      },
      {
        id: "r5",
        referral_number: "REF-2026-005",
        patient_name: "Synthetic Youth 033",
        contact_phone: "(281) 555-5005",
        contact_email: "parent5@example.invalid",
        referral_source: "DCF Caseworker",
        source_detail: "Texas CPS Region 6",
        referral_type: "adolescent",
        status: "converted",
        assigned_to: "rcs-lead@amos-ops.invalid",
        notes:
          "Foster care placement disrupted. Maltreatment history. Successfully converted to patient SYNTH-REC-4521.",
        outcome: "converted",
        converted_patient_id: "p1",
        created_at: "2026-05-20T13:00:00Z",
        updated_at: "2026-06-01T10:00:00Z",
      },
      {
        id: "r6",
        referral_number: "REF-2026-006",
        patient_name: "Synthetic Youth 026",
        contact_phone: "(832) 555-6006",
        contact_email: "parent6@example.invalid",
        referral_source: "Community Mental Health Center",
        source_detail: "Legacy Community Health",
        referral_type: "educational",
        status: "deferred",
        assigned_to: "rcs-day@amos-ops.invalid",
        notes:
          "Not currently appropriate for residential. Referred to outpatient IOP. Follow up in 90 days.",
        outcome: "deferred",
        converted_patient_id: null,
        created_at: "2026-05-10T15:00:00Z",
        updated_at: "2026-05-25T09:00:00Z",
      },
      {
        id: "r7",
        referral_number: "REF-2026-007",
        patient_name: "Synthetic Youth 012",
        contact_phone: "(713) 555-7007",
        contact_email: "parent7@example.invalid",
        referral_source: "Hospital Discharge Planner",
        source_detail: "Texas Childrens Hospital",
        referral_type: "crisis",
        status: "closed",
        assigned_to: "clinical-director@amos-ops.invalid",
        notes:
          "Crisis stabilization completed. Family opted for outpatient care closer to home.",
        outcome: "closed",
        converted_patient_id: null,
        created_at: "2026-04-05T10:00:00Z",
        updated_at: "2026-04-12T16:00:00Z",
      },
      {
        id: "r8",
        referral_number: "REF-2026-008",
        patient_name: "Synthetic Youth 032",
        contact_phone: "(281) 555-8008",
        contact_email: "parent8@example.invalid",
        referral_source: "Community Event",
        source_detail: "Mental Health Awareness Fair",
        referral_type: "community",
        status: "active",
        assigned_to: "gro.admin@amos-ops.invalid",
        notes:
          "Parents attended community fair. 13-year-old female, social anxiety, school refusal.",
        outcome: null,
        converted_patient_id: null,
        created_at: "2026-06-25T14:00:00Z",
        updated_at: "2026-06-25T14:00:00Z",
      },
    ];
  if (procedure === "gro.listPartnerships")
    return [
      {
        id: "part1",
        organization_name: "Houston ISD",
        partnership_type: "school_district",
        status: "active",
        contact_name: "Maria Gonzalez",
        contact_phone: "(713) 555-0100",
        contact_email: "m.gonzalez@example.invalid",
        address: "4400 West 18th St, Houston, TX",
        notes:
          "Primary referral source. Quarterly check-ins with counseling department.",
        start_date: "2025-09-01",
        renewal_date: "2026-09-01",
        referral_count: 12,
        created_at: "2025-09-01",
      },
      {
        id: "part2",
        organization_name: "Harris County Juvenile Probation",
        partnership_type: "government",
        status: "active",
        contact_name: "Deputy Chief Williams",
        contact_phone: "(713) 555-0200",
        contact_email: "d.williams@example.invalid",
        address: "1200 Congress St, Houston, TX",
        notes: "Court-ordered placements. Monthly reporting required.",
        start_date: "2026-01-15",
        renewal_date: "2027-01-15",
        referral_count: 4,
        created_at: "2026-01-15",
      },
      {
        id: "part3",
        organization_name: "Legacy Community Health",
        partnership_type: "healthcare",
        status: "active",
        contact_name: "Dr. Sarah Kim",
        contact_phone: "(832) 555-0300",
        contact_email: "s.kim@example.invalid",
        address: "various clinic locations",
        notes:
          "Coordinated care referrals. Shared care plans for dual-enrolled patients.",
        start_date: "2026-03-01",
        renewal_date: "2027-03-01",
        referral_count: 6,
        created_at: "2026-03-01",
      },
      {
        id: "part4",
        organization_name: "Texas Childrens Hospital",
        partnership_type: "healthcare",
        status: "pending",
        contact_name: "James Okafor",
        contact_phone: "(832) 555-0400",
        contact_email: "j.okafor@example.invalid",
        address: "6621 Fannin St, Houston, TX",
        notes: "Crisis discharge planning partnership. MOU under legal review.",
        start_date: null,
        renewal_date: null,
        referral_count: 2,
        created_at: "2026-06-10",
      },
      {
        id: "part5",
        organization_name: "Texas CPS Region 6",
        partnership_type: "government",
        status: "active",
        contact_name: "Case Supervisor Torres",
        contact_phone: "(713) 555-0500",
        contact_email: "r.torres@example.invalid",
        address: "2525 Murworth Dr, Houston, TX",
        notes: "Foster care placement referrals. 24-hour response requirement.",
        start_date: "2026-02-01",
        renewal_date: "2027-02-01",
        referral_count: 3,
        created_at: "2026-02-01",
      },
    ];
  if (procedure === "gro.listCampaigns")
    return [
      {
        id: "camp1",
        campaign_name: "Spring 2026 School Outreach",
        campaign_type: "school",
        start_date: "2026-03-01",
        end_date: "2026-05-31",
        status: "completed",
        budget: 5000,
        leads_generated: 24,
        conversions: 8,
        notes: "Visited 12 schools, presented at 8 PTA meetings",
        created_at: "2026-03-01",
      },
      {
        id: "camp2",
        campaign_name: "Summer Community Health Fairs",
        campaign_type: "community",
        start_date: "2026-06-01",
        end_date: "2026-08-31",
        status: "active",
        budget: 3000,
        leads_generated: 15,
        conversions: 3,
        notes:
          "Booth at 5 community events, distributed materials at 10 locations",
        created_at: "2026-06-01",
      },
      {
        id: "camp3",
        campaign_name: "Digital Ad Campaign — Houston",
        campaign_type: "digital",
        start_date: "2026-04-01",
        end_date: "2026-06-30",
        status: "completed",
        budget: 8000,
        leads_generated: 42,
        conversions: 6,
        notes:
          "Google Ads + Facebook targeting Harris County parents of teens 12-17",
        created_at: "2026-04-01",
      },
      {
        id: "camp4",
        campaign_name: "Pediatrician Referral Program",
        campaign_type: "professional",
        start_date: "2026-05-01",
        end_date: "2026-12-31",
        status: "active",
        budget: 2000,
        leads_generated: 8,
        conversions: 2,
        notes:
          "Direct outreach to 50 pediatricians, referral pad distribution, CME event planned",
        created_at: "2026-05-01",
      },
    ];
  // gro mutations handled by live store at line ~766
  // ─── M7 ENDPOINTS (GAD — General Administration) ─────────
  if (procedure === "gad.dashboardKPIs")
    return {
      facilityCount: 2,
      vendorCount: 7,
      openWorkOrders: 3,
      inProgressWorkOrders: 2,
      pendingPartsWorkOrders: 1,
      completedThisMonth: 2,
      overdueWorkOrders: 0,
      urgentHighCount: 3,
      totalWorkOrders: 8,
    };
  if (procedure === "gad.listWorkOrders")
    return [
      {
        id: "wo1",
        wo_number: "WO-2026-001",
        title: "HVAC Repair — Wing B",
        description:
          "Air conditioning unit in Wing B common area not cooling properly. Temperature reached 82F.",
        work_type: "hvac",
        priority: "high",
        status: "in_progress",
        facility_id: "f1",
        vendor_id: "v1",
        assigned_to: "gad.ops@amos-ops.invalid",
        estimated_cost: 85000,
        actual_cost: null,
        requested_by: "rcs-lead@amos-ops.invalid",
        approved_by: "Demo Executive",
        due_date: "2026-07-02",
        completed_at: null,
        created_at: "2026-06-25T10:00:00Z",
        updated_at: "2026-06-26T14:00:00Z",
      },
      {
        id: "wo2",
        wo_number: "WO-2026-002",
        title: "Replace fire extinguisher — Wing B",
        description:
          "Fire extinguisher expired per safety audit AUD-2026-003. Replace with new 10lb ABC unit.",
        work_type: "safety",
        priority: "urgent",
        status: "completed",
        facility_id: "f1",
        vendor_id: "v2",
        assigned_to: "gad.ops@amos-ops.invalid",
        estimated_cost: 15000,
        actual_cost: 12500,
        requested_by: "gro.admin@amos-ops.invalid",
        approved_by: "Demo Executive",
        due_date: "2026-06-20",
        completed_at: "2026-06-19T14:00:00Z",
        created_at: "2026-06-18T09:00:00Z",
        updated_at: "2026-06-19T14:00:00Z",
      },
      {
        id: "wo3",
        wo_number: "WO-2026-003",
        title: "Plumbing leak — Kitchen sink",
        description:
          "Slow drain and minor leak under kitchen sink. Water damage to cabinet base.",
        work_type: "plumbing",
        priority: "medium",
        status: "open",
        facility_id: "f1",
        vendor_id: "v3",
        assigned_to: "gad.ops@amos-ops.invalid",
        estimated_cost: 35000,
        actual_cost: null,
        requested_by: "rcs-day@amos-ops.invalid",
        approved_by: null,
        due_date: "2026-07-05",
        completed_at: null,
        created_at: "2026-06-27T08:00:00Z",
        updated_at: "2026-06-27T08:00:00Z",
      },
      {
        id: "wo4",
        wo_number: "WO-2026-004",
        title: "Security camera upgrade",
        description:
          "Replace 4 analog cameras with IP cameras. Add coverage to courtyard blind spot.",
        work_type: "security",
        priority: "medium",
        status: "pending_parts",
        facility_id: "f1",
        vendor_id: "v4",
        assigned_to: "gad.ops@amos-ops.invalid",
        estimated_cost: 450000,
        actual_cost: null,
        requested_by: "Demo Executive",
        approved_by: "Demo Executive",
        due_date: "2026-07-15",
        completed_at: null,
        created_at: "2026-06-20T11:00:00Z",
        updated_at: "2026-06-28T09:00:00Z",
      },
      {
        id: "wo5",
        wo_number: "WO-2026-005",
        title: "Landscaping — Front entrance",
        description:
          "Refresh mulch, trim hedges, replace damaged plants at main entrance.",
        work_type: "grounds",
        priority: "low",
        status: "open",
        facility_id: "f1",
        vendor_id: "v5",
        assigned_to: "gad.ops@amos-ops.invalid",
        estimated_cost: 22000,
        actual_cost: null,
        requested_by: "gro.admin@amos-ops.invalid",
        approved_by: null,
        due_date: "2026-07-10",
        completed_at: null,
        created_at: "2026-06-26T13:00:00Z",
        updated_at: "2026-06-26T13:00:00Z",
      },
      {
        id: "wo6",
        wo_number: "WO-2026-006",
        title: "Generator monthly test",
        description:
          "Monthly load bank test for backup generator. Log results per fire marshal requirements.",
        work_type: "electrical",
        priority: "high",
        status: "completed",
        facility_id: "f1",
        vendor_id: "v6",
        assigned_to: "gad.ops@amos-ops.invalid",
        estimated_cost: 8000,
        actual_cost: 8000,
        requested_by: "gad.ops@amos-ops.invalid",
        approved_by: null,
        due_date: "2026-06-30",
        completed_at: "2026-06-28T10:00:00Z",
        created_at: "2026-06-28T08:00:00Z",
        updated_at: "2026-06-28T10:00:00Z",
      },
      {
        id: "wo7",
        wo_number: "WO-2026-007",
        title: "Paint — Common room refresh",
        description:
          "Repaint youth common room. Repair drywall damage near south wall.",
        work_type: "maintenance",
        priority: "low",
        status: "in_progress",
        facility_id: "f1",
        vendor_id: "v7",
        assigned_to: "gad.ops@amos-ops.invalid",
        estimated_cost: 180000,
        actual_cost: null,
        requested_by: "rcs-lead@amos-ops.invalid",
        approved_by: "Demo Executive",
        due_date: "2026-07-08",
        completed_at: null,
        created_at: "2026-06-24T09:00:00Z",
        updated_at: "2026-06-27T15:00:00Z",
      },
      {
        id: "wo8",
        wo_number: "WO-2026-008",
        title: "IT Network switch replacement",
        description:
          "Replace aging 24-port switch in server closet. Intermittent connectivity issues reported.",
        work_type: "it",
        priority: "high",
        status: "open",
        facility_id: "f1",
        vendor_id: null,
        assigned_to: "gad.ops@amos-ops.invalid",
        estimated_cost: 65000,
        actual_cost: null,
        requested_by: "Demo Executive",
        approved_by: "Demo Executive",
        due_date: "2026-07-03",
        completed_at: null,
        created_at: "2026-06-28T16:00:00Z",
        updated_at: "2026-06-28T16:00:00Z",
      },
    ];
  if (procedure === "gad.listFacilities")
    return [
      {
        id: "f1",
        facility_name: "BHC at Cypress — Main Campus",
        facility_code: "BHC-CYP-01",
        address: "12457 Cypress Center Blvd, Cypress, TX 77429",
        facility_type: "residential",
        total_sqft: 18500,
        bedrooms: 12,
        common_areas: 4,
        status: "active",
        built_year: 2018,
        last_inspection_date: "2026-06-18",
        next_inspection_date: "2026-12-18",
        manager_id: "u6",
        created_at: "2026-01-01",
      },
      {
        id: "f2",
        facility_name: "BHC at Cypress — Administrative Annex",
        facility_code: "BHC-CYP-02",
        address: "12459 Cypress Center Blvd, Cypress, TX 77429",
        facility_type: "administrative",
        total_sqft: 3200,
        bedrooms: 0,
        common_areas: 2,
        status: "active",
        built_year: 2018,
        last_inspection_date: "2026-05-15",
        next_inspection_date: "2026-11-15",
        manager_id: "u1",
        created_at: "2026-01-01",
      },
    ];
  if (procedure === "gad.listVendors")
    return [
      {
        id: "v1",
        vendor_name: "Cypress Mechanical Services",
        vendor_type: "hvac",
        contact_person: "Synthetic Staff 02",
        contact_phone: "(281) 555-1100",
        contact_email: "service@example.invalid",
        address: "890 Industrial Dr, Cypress, TX 77429",
        tax_id: "SYNTH-TAX-001",
        payment_terms: "Net 30",
        status: "active",
        rating: 5,
        notes: "Preferred HVAC vendor. 24/7 emergency service.",
        contract_expiry: "2026-12-31",
        created_at: "2026-01-01",
      },
      {
        id: "v2",
        vendor_name: "Houston Safety Supply",
        vendor_type: "safety_equipment",
        contact_person: "Lisa Park",
        contact_phone: "(713) 555-2200",
        contact_email: "orders@example.invalid",
        address: "2200 Safety Way, Houston, TX 77001",
        tax_id: "SYNTH-TAX-002",
        payment_terms: "Net 15",
        status: "active",
        rating: 4,
        notes: "Fire safety equipment and inspections.",
        contract_expiry: "2027-03-31",
        created_at: "2026-01-01",
      },
      {
        id: "v3",
        vendor_name: "Cypress Plumbing Co",
        vendor_type: "plumbing",
        contact_person: "Jake Rivera",
        contact_phone: "(281) 555-3300",
        contact_email: "jobs@example.invalid",
        address: "456 Pipe Lane, Cypress, TX 77429",
        tax_id: "SYNTH-TAX-003",
        payment_terms: "Net 30",
        status: "active",
        rating: 4,
        notes: "General plumbing. Good response time.",
        contract_expiry: "2026-09-30",
        created_at: "2026-01-01",
      },
      {
        id: "v4",
        vendor_name: "SecureView Systems",
        vendor_type: "security",
        contact_person: "David Chen",
        contact_phone: "(832) 555-4400",
        contact_email: "install@example.invalid",
        address: "1200 Tech Blvd, Houston, TX 77002",
        tax_id: "SYNTH-TAX-004",
        payment_terms: "50% upfront, 50% on completion",
        status: "active",
        rating: 5,
        notes: "IP camera systems and access control.",
        contract_expiry: "2027-06-30",
        created_at: "2026-01-01",
      },
      {
        id: "v5",
        vendor_name: "GreenScape Cypress",
        vendor_type: "landscaping",
        contact_person: "Maria Green",
        contact_phone: "(281) 555-5500",
        contact_email: "service@example.invalid",
        address: "77 Garden Rd, Cypress, TX 77429",
        tax_id: "SYNTH-TAX-005",
        payment_terms: "Net 30",
        status: "active",
        rating: 4,
        notes: "Monthly landscaping maintenance.",
        contract_expiry: "2026-12-31",
        created_at: "2026-01-01",
      },
      {
        id: "v6",
        vendor_name: "PowerGuard Generator Services",
        vendor_type: "electrical",
        contact_person: "Robert Watts",
        contact_phone: "(713) 555-6600",
        contact_email: "service@example.invalid",
        address: "300 Power Ave, Houston, TX 77003",
        tax_id: "SYNTH-TAX-006",
        payment_terms: "Net 15",
        status: "active",
        rating: 5,
        notes: "Generator maintenance and load bank testing.",
        contract_expiry: "2027-01-31",
        created_at: "2026-01-01",
      },
      {
        id: "v7",
        vendor_name: "Cypress Painting & Drywall",
        vendor_type: "general_contractor",
        contact_person: "Ana Lopez",
        contact_phone: "(281) 555-7700",
        contact_email: "estimates@example.invalid",
        address: "55 Brush St, Cypress, TX 77429",
        tax_id: "SYNTH-TAX-007",
        payment_terms: "Net 30",
        status: "active",
        rating: 4,
        notes: "Interior painting and minor repairs.",
        contract_expiry: "2026-08-31",
        created_at: "2026-01-01",
      },
    ];
  // gad mutations handled by live store at line ~770
  // ─── M8 ENDPOINTS (Workflow Engine) ──────────────────────
  if (procedure === "workflow.dashboardKPIs")
    return {
      totalInstances: 10,
      pendingInstances: 3,
      completedInstances: 6,
      rejectedInstances: 1,
      pendingApprovals: 3,
    };
  if (procedure === "workflow.listRules")
    return [
      {
        id: "wr-hr-status",
        name: "HR Status Change Alert",
        event: "hr.status-changed",
        actions: [
          { type: "notify", target: "hr-director", priority: "high" },
          { type: "log", target: "audit", priority: "low" },
        ],
        enabled: true,
      },
      {
        id: "wr-doc-expired",
        name: "Document Expired Escalation",
        event: "document.expired",
        actions: [
          {
            type: "escalate",
            target: "hr-compliance-officer",
            priority: "urgent",
          },
          { type: "notify", target: "hr-compliance-officer", priority: "high" },
        ],
        enabled: true,
      },
      {
        id: "wr-incident-critical",
        name: "Critical Incident Response",
        event: "incident.critical",
        actions: [
          { type: "escalate", target: "managing-director", priority: "urgent" },
          { type: "notify", target: "clinical-director", priority: "urgent" },
          { type: "notify", target: "hr-compliance-officer", priority: "high" },
        ],
        enabled: true,
      },
      {
        id: "wr-credential-expiry",
        name: "Credential Expiry Warning",
        event: "credential.expiring-soon",
        actions: [
          { type: "notify", target: "hr-director", priority: "medium" },
          { type: "notify", target: "employee", priority: "medium" },
        ],
        enabled: true,
      },
      {
        id: "wr-claim-denied",
        name: "Claim Denied Alert",
        event: "revenue.claim-denied",
        actions: [
          { type: "notify", target: "revenue-cycle-manager", priority: "high" },
          {
            type: "escalate",
            target: "revenue-cycle-manager",
            priority: "medium",
          },
        ],
        enabled: true,
      },
      {
        id: "wr-onboarding-complete",
        name: "Onboarding Complete — RTD Check",
        event: "onboarding.completed",
        actions: [
          { type: "notify", target: "hr-director", priority: "medium" },
          { type: "notify", target: "shift-supervisor", priority: "medium" },
        ],
        enabled: true,
      },
      {
        id: "wr-audit-finding",
        name: "Audit Finding — CAPA Required",
        event: "audit.finding-created",
        actions: [
          {
            type: "escalate",
            target: "hr-compliance-officer",
            priority: "high",
          },
          { type: "notify", target: "program-director", priority: "high" },
        ],
        enabled: true,
      },
      {
        id: "wr-referral-new",
        name: "New Referral Assignment",
        event: "referral.created",
        actions: [
          { type: "notify", target: "gro-administrator", priority: "medium" },
          { type: "log", target: "audit", priority: "low" },
        ],
        enabled: true,
      },
      {
        id: "wr-equipment-failure",
        name: "Equipment Failure Response",
        event: "gad.equipment-failure",
        actions: [
          {
            type: "escalate",
            target: "facilities-manager",
            priority: "urgent",
          },
          { type: "notify", target: "facilities-manager", priority: "high" },
        ],
        enabled: false,
      },
      {
        id: "wr-high-risk-patient",
        name: "High Risk Patient Alert",
        event: "clinical.high-risk",
        actions: [
          { type: "escalate", target: "clinical-director", priority: "urgent" },
          { type: "notify", target: "assigned-clinician", priority: "urgent" },
        ],
        enabled: true,
      },
    ];
  if (procedure === "workflow.listInstances")
    return [
      {
        id: "wi1",
        rule_id: "wr-hr-status",
        rule_name: "HR Status Change Alert",
        event_type: "hr.status-changed",
        status: "completed",
        trigger_data: '{"personId":"h4","from":"applicant","to":"new-hire"}',
        triggered_by: "hr-director@amos-ops.invalid",
        started_at: "2026-06-20T10:00:00Z",
      },
      {
        id: "wi2",
        rule_id: "wr-credential-expiry",
        rule_name: "Credential Expiry Warning",
        event_type: "credential.expiring-soon",
        status: "completed",
        trigger_data:
          '{"personId":"h4","credential":"LPC License","daysUntilExpiry":45}',
        triggered_by: "system",
        started_at: "2026-06-15T08:00:00Z",
      },
      {
        id: "wi3",
        rule_id: "wr-incident-critical",
        rule_name: "Critical Incident Response",
        event_type: "incident.critical",
        status: "completed",
        trigger_data:
          '{"incidentId":"i1","type":"elopement","severity":"high"}',
        triggered_by: "rcs-day@amos-ops.invalid",
        started_at: "2026-06-15T14:30:00Z",
      },
      {
        id: "wi4",
        rule_id: "wr-claim-denied",
        rule_name: "Claim Denied Alert",
        event_type: "revenue.claim-denied",
        status: "pending",
        trigger_data: '{"claimId":"c3","denialCode":"CO-29","amount":875000}',
        triggered_by: "system",
        started_at: "2026-06-12T09:00:00Z",
      },
      {
        id: "wi5",
        rule_id: "wr-audit-finding",
        rule_name: "Audit Finding — CAPA Required",
        event_type: "audit.finding-created",
        status: "completed",
        trigger_data:
          '{"auditId":"a1","finding":"Missing signatures","severity":"minor"}',
        triggered_by: "system",
        started_at: "2026-06-15T16:00:00Z",
      },
      {
        id: "wi6",
        rule_id: "wr-referral-new",
        rule_name: "New Referral Assignment",
        event_type: "referral.created",
        status: "completed",
        trigger_data:
          '{"referralId":"r4","patientName":"Synthetic Youth 017","type":"crisis"}',
        triggered_by: "gro.admin@amos-ops.invalid",
        started_at: "2026-06-27T08:15:00Z",
      },
      {
        id: "wi7",
        rule_id: "wr-high-risk-patient",
        rule_name: "High Risk Patient Alert",
        event_type: "clinical.high-risk",
        status: "completed",
        trigger_data:
          '{"patientId":"p1","riskType":"suicide-ideation","level":"moderate"}',
        triggered_by: "system",
        started_at: "2026-06-21T14:00:00Z",
      },
      {
        id: "wi8",
        rule_id: "wr-doc-expired",
        rule_name: "Document Expired Escalation",
        event_type: "document.expired",
        status: "rejected",
        trigger_data: '{"documentId":"d8","title":"Incident Reporting Guide"}',
        triggered_by: "system",
        started_at: "2026-06-25T16:00:00Z",
      },
      {
        id: "wi9",
        rule_id: "wr-hr-status",
        rule_name: "HR Status Change Alert",
        event_type: "hr.status-changed",
        status: "pending",
        trigger_data: '{"personId":"h5","from":"new-hire","to":"active"}',
        triggered_by: "hr-director@amos-ops.invalid",
        started_at: "2026-06-28T09:00:00Z",
      },
      {
        id: "wi10",
        rule_id: "wr-equipment-failure",
        rule_name: "Equipment Failure Response",
        event_type: "gad.equipment-failure",
        status: "pending",
        trigger_data:
          '{"equipment":"network-switch","location":"server-closet"}',
        triggered_by: "gad.ops@amos-ops.invalid",
        started_at: "2026-06-28T16:00:00Z",
      },
    ];
  if (procedure === "workflow.listPendingApprovals")
    return [
      {
        id: "wa1",
        instance_id: "wi4",
        rule_name: "Claim Denied Alert",
        approver_role: "revenue-cycle-manager",
        event_type: "revenue.claim-denied",
        status: "pending",
        requested_at: "2026-06-12T09:00:00Z",
      },
      {
        id: "wa2",
        instance_id: "wi9",
        rule_name: "HR Status Change Alert",
        approver_role: "hr-director",
        event_type: "hr.status-changed",
        status: "pending",
        requested_at: "2026-06-28T09:00:00Z",
      },
      {
        id: "wa3",
        instance_id: "wi10",
        rule_name: "Equipment Failure Response",
        approver_role: "facilities-manager",
        event_type: "gad.equipment-failure",
        status: "pending",
        requested_at: "2026-06-28T16:00:00Z",
      },
    ];
  if (procedure === "workflow.auditLog")
    return [
      {
        id: "wl1",
        action: "instance.triggered",
        actor: "hr-director@amos-ops.invalid",
        details: "HR Status Change: h4 applicant → new-hire",
        created_at: "2026-06-20T10:00:00Z",
      },
      {
        id: "wl2",
        action: "instance.completed",
        actor: "system",
        details: "HR Status Change Alert completed (2 actions executed)",
        created_at: "2026-06-20T10:00:05Z",
      },
      {
        id: "wl3",
        action: "instance.triggered",
        actor: "system",
        details: "Credential LPC License expires in 45 days for h4",
        created_at: "2026-06-15T08:00:00Z",
      },
      {
        id: "wl4",
        action: "instance.triggered",
        actor: "rcs-day@amos-ops.invalid",
        details: "Critical incident: Youth eloped (INC-2026-001)",
        created_at: "2026-06-15T14:30:00Z",
      },
      {
        id: "wl5",
        action: "approval.created",
        actor: "system",
        details: "Claim Denied Alert requires revenue-cycle-manager approval",
        created_at: "2026-06-12T09:00:00Z",
      },
      {
        id: "wl6",
        action: "instance.triggered",
        actor: "system",
        details: "Audit finding created: Missing signatures (AUD-2026-001)",
        created_at: "2026-06-15T16:00:00Z",
      },
      {
        id: "wl7",
        action: "instance.triggered",
        actor: "gro.admin@amos-ops.invalid",
        details: "New crisis referral: Synthetic Youth 017 (REF-2026-004)",
        created_at: "2026-06-27T08:15:00Z",
      },
      {
        id: "wl8",
        action: "instance.rejected",
        actor: "Demo Executive",
        details:
          "Document Expired Escalation rejected — document intentionally archived",
        created_at: "2026-06-26T09:00:00Z",
      },
      {
        id: "wl9",
        action: "approval.created",
        actor: "system",
        details: "HR Status Change requires hr-director approval for h5",
        created_at: "2026-06-28T09:00:00Z",
      },
      {
        id: "wl10",
        action: "instance.triggered",
        actor: "gad.ops@amos-ops.invalid",
        details: "Equipment failure: Network switch (server closet)",
        created_at: "2026-06-28T16:00:00Z",
      },
    ];
  if (procedure === "workflow.trigger")
    return { instanceId: `wi-${Date.now()}`, approvalsCreated: 1 };
  // ─── M9 ENDPOINTS (NIL Knowledge Graph) ──────────────────
  if (procedure === "nil.getStats")
    return {
      totalEntities: 21,
      totalRelationships: 20,
      entityTypes: [
        { entity_type: "patient", count: 5 },
        { entity_type: "person", count: 5 },
        { entity_type: "form", count: 7 },
        { entity_type: "claim", count: 2 },
        { entity_type: "treatment_plan", count: 2 },
        { entity_type: "session", count: 1 },
        { entity_type: "audit", count: 1 },
        { entity_type: "work_order", count: 1 },
      ],
    };
  if (procedure === "nil.searchEntities") {
    const q = readDemoString(input, "query").toLowerCase();
    const allEntities = [
      {
        id: "ne-p1",
        entityType: "patient",
        displayName: "Synthetic Youth 001",
        module: "clinical",
        description: "15yo male, depression/anxiety",
      },
      {
        id: "ne-p2",
        entityType: "patient",
        displayName: "Synthetic Youth 005",
        module: "clinical",
        description: "16yo female, trauma/self-harm",
      },
      {
        id: "ne-p3",
        entityType: "patient",
        displayName: "Synthetic Youth 007",
        module: "clinical",
        description: "15yo male, conduct disorder",
      },
      {
        id: "ne-p4",
        entityType: "patient",
        displayName: "Synthetic Youth 002",
        module: "clinical",
        description: "17yo female, on hold",
      },
      {
        id: "ne-p5",
        entityType: "patient",
        displayName: "Synthetic-Person-014 Davis",
        module: "clinical",
        description: "15yo male, discharged",
      },
      {
        id: "ne-clinical-director",
        entityType: "person",
        displayName: "Demo Clinical Director",
        module: "clinical",
        description: "Clinical Director, Psychiatrist",
      },
      {
        id: "ne-clinical-lead",
        entityType: "person",
        displayName: "Demo Clinical Lead",
        module: "clinical",
        description: "Case Manager, RCS Night",
      },
      {
        id: "ne-russ",
        entityType: "person",
        displayName: "Demo Executive",
        module: "executive",
        description: "CEO/Founder",
      },
      {
        id: "ne-demo-case-manager",
        entityType: "person",
        displayName: "Demo Case Manager",
        module: "hr",
        description: "LPC, Case Manager",
      },
      {
        id: "ne-h-rl",
        entityType: "person",
        displayName: "RCS Lead",
        module: "hr",
        description: "Residential Care Supervisor",
      },
      {
        id: "ne-tp1",
        entityType: "treatment_plan",
        displayName: "TP-2026-1001 — MDD/GAD",
        module: "clinical",
        description: "Active treatment plan for Synthetic Youth 001",
      },
      {
        id: "ne-tp2",
        entityType: "treatment_plan",
        displayName: "TP-2026-1002 — Conduct Disorder",
        module: "clinical",
        description: "Completed treatment plan",
      },
      {
        id: "ne-cs1",
        entityType: "session",
        displayName: "Session 2026-06-28",
        module: "clinical",
        description: "Individual therapy — trauma processing",
      },
      {
        id: "ne-c1",
        entityType: "claim",
        displayName: "CLM-2026-001 — TX Medicaid",
        module: "revenue",
        description: "Paid claim, $12,500",
      },
      {
        id: "ne-c3",
        entityType: "claim",
        displayName: "CLM-2026-003 — Aetna",
        module: "revenue",
        description: "Denied claim, $8,750",
      },
      {
        id: "ne-a1",
        entityType: "audit",
        displayName: "AUD-2026-001 — Q2 Clinical",
        module: "qa",
        description: "Completed audit, score 94%",
      },
      {
        id: "ne-ca1",
        entityType: "form",
        displayName: "CAPA-2026-001",
        module: "qa",
        description: "Dual-signature medication check",
      },
      {
        id: "ne-wo1",
        entityType: "work_order",
        displayName: "WO-2026-001 — HVAC",
        module: "gad",
        description: "HVAC repair Wing B",
      },
      {
        id: "ne-f1",
        entityType: "form",
        displayName: "BHC-CYP-01",
        module: "gad",
        description: "Main Campus, 18,500 sqft",
      },
      {
        id: "ne-d1",
        entityType: "form",
        displayName: "ADL-HR-POL-202606-0001",
        module: "documents",
        description: "Employee Handbook v2026",
      },
      {
        id: "ne-r1",
        entityType: "form",
        displayName: "REF-2026-005 — A. Thompson",
        module: "gro",
        description: "Converted referral",
      },
    ];
    if (!q) return allEntities;
    return allEntities.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q),
    );
  }
  if (procedure === "nil.getEntityNetwork") {
    const entityId = readDemoString(input, "entityId", "ne-p1");
    const entityMap: Record<string, DemoRecord> = {
      "ne-p1": {
        id: "ne-p1",
        entityType: "patient",
        displayName: "Synthetic Youth 001",
        module: "clinical",
        description: "15yo male, depression/anxiety",
      },
      "ne-p2": {
        id: "ne-p2",
        entityType: "patient",
        displayName: "Synthetic Youth 005",
        module: "clinical",
        description: "16yo female, trauma/self-harm",
      },
      "ne-clinical-director": {
        id: "ne-clinical-director",
        entityType: "person",
        displayName: "Demo Clinical Director",
        module: "clinical",
        description: "Clinical Director, Psychiatrist",
      },
      "ne-clinical-lead": {
        id: "ne-clinical-lead",
        entityType: "person",
        displayName: "Demo Clinical Lead",
        module: "clinical",
        description: "Case Manager, RCS Night",
      },
      "ne-russ": {
        id: "ne-russ",
        entityType: "person",
        displayName: "Demo Executive",
        module: "executive",
        description: "CEO/Founder",
      },
      "ne-demo-case-manager": {
        id: "ne-demo-case-manager",
        entityType: "person",
        displayName: "Demo Case Manager",
        module: "hr",
        description: "LPC, Case Manager",
      },
      "ne-tp1": {
        id: "ne-tp1",
        entityType: "treatment_plan",
        displayName: "TP-2026-1001 — MDD/GAD",
        module: "clinical",
        description: "Active treatment plan for Synthetic Youth 001",
      },
      "ne-tp2": {
        id: "ne-tp2",
        entityType: "treatment_plan",
        displayName: "TP-2026-1002 — Conduct Disorder",
        module: "clinical",
        description: "Completed treatment plan for behavioral outbursts",
      },
      "ne-cs1": {
        id: "ne-cs1",
        entityType: "session",
        displayName: "Session 2026-06-28",
        module: "clinical",
        description: "Individual therapy — trauma processing",
      },
      "ne-c1": {
        id: "ne-c1",
        entityType: "claim",
        displayName: "CLM-2026-001 — TX Medicaid",
        module: "revenue",
        description: "Paid claim, $12,500",
      },
      "ne-c3": {
        id: "ne-c3",
        entityType: "claim",
        displayName: "CLM-2026-003 — Aetna",
        module: "revenue",
        description: "Denied claim, $8,750",
      },
      "ne-a1": {
        id: "ne-a1",
        entityType: "audit",
        displayName: "AUD-2026-001 — Q2 Clinical",
        module: "qa",
        description: "Completed audit, score 94%",
      },
      "ne-ca1": {
        id: "ne-ca1",
        entityType: "form",
        displayName: "CAPA-2026-001",
        module: "qa",
        description: "Dual-signature medication check",
      },
      "ne-wo1": {
        id: "ne-wo1",
        entityType: "work_order",
        displayName: "WO-2026-001 — HVAC",
        module: "gad",
        description: "HVAC repair Wing B",
      },
      "ne-f1": {
        id: "ne-f1",
        entityType: "form",
        displayName: "BHC-CYP-01",
        module: "gad",
        description: "Main Campus, 18,500 sqft",
      },
      "ne-d1": {
        id: "ne-d1",
        entityType: "form",
        displayName: "ADL-HR-POL-202606-0001",
        module: "documents",
        description: "Employee Handbook v2026",
      },
      "ne-r1": {
        id: "ne-r1",
        entityType: "form",
        displayName: "REF-2026-005 — A. Thompson",
        module: "gro",
        description: "Converted referral",
      },
      "ne-h-rl": {
        id: "ne-h-rl",
        entityType: "person",
        displayName: "RCS Lead",
        module: "hr",
        description: "Residential Care Supervisor",
      },
      "ne-hr-ref": {
        id: "ne-hr-ref",
        entityType: "form",
        displayName: "REF-2026-001 — K. Williams",
        module: "hr",
        description: "Reference check form",
      },
      "ne-hr-app": {
        id: "ne-hr-app",
        entityType: "form",
        displayName: "APP-2026-001 — J. Lee",
        module: "hr",
        description: "Application form",
      },
    };

    const rels: Record<
      string,
      { from: string; to: string; type: string; strength: number }[]
    > = {
      "ne-p1": [
        { from: "ne-p1", to: "ne-clinical-director", type: "treated_by", strength: 100 },
        { from: "ne-p1", to: "ne-tp1", type: "has_plan", strength: 100 },
        { from: "ne-p1", to: "ne-tp2", type: "had_plan", strength: 80 },
        { from: "ne-p1", to: "ne-cs1", type: "has_session", strength: 100 },
        { from: "ne-p1", to: "ne-c1", type: "has_claim", strength: 100 },
        { from: "ne-p1", to: "ne-r1", type: "from_referral", strength: 100 },
      ],
      "ne-clinical-director": [
        { from: "ne-clinical-director", to: "ne-p1", type: "treats", strength: 100 },
        { from: "ne-clinical-director", to: "ne-p3", type: "treats", strength: 100 },
        { from: "ne-clinical-director", to: "ne-cs1", type: "conducted", strength: 100 },
        { from: "ne-clinical-director", to: "ne-tp1", type: "authored", strength: 100 },
        { from: "ne-clinical-director", to: "ne-a1", type: "audited_by", strength: 90 },
        { from: "ne-clinical-director", to: "ne-demo-case-manager", type: "supervises", strength: 90 },
      ],
      "ne-russ": [
        { from: "ne-russ", to: "ne-d1", type: "authored", strength: 100 },
        { from: "ne-russ", to: "ne-wo1", type: "approved", strength: 90 },
        { from: "ne-russ", to: "ne-h-rl", type: "supervises", strength: 90 },
      ],
      "ne-tp1": [
        { from: "ne-tp1", to: "ne-p1", type: "for_patient", strength: 100 },
        {
          from: "ne-tp1",
          to: "ne-clinical-director",
          type: "authored_by",
          strength: 100,
        },
      ],
      "ne-a1": [
        { from: "ne-a1", to: "ne-ca1", type: "generated_capa", strength: 100 },
        { from: "ne-a1", to: "ne-clinical-director", type: "audited", strength: 90 },
      ],
      "ne-wo1": [
        { from: "ne-wo1", to: "ne-f1", type: "for_facility", strength: 100 },
        { from: "ne-wo1", to: "ne-russ", type: "approved_by", strength: 90 },
      ],
      "ne-r1": [
        { from: "ne-r1", to: "ne-p1", type: "converted_to", strength: 100 },
      ],
    };

    const center = entityMap[entityId];
    if (!center) return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };

    const entityRels = rels[entityId] ?? [];
    const connectedNodes = entityRels
      .map((r) => entityMap[r.to])
      .filter(Boolean);
    const uniqueConnected = connectedNodes.filter(
      (n, i, a) => a.findIndex((x) => x.id === n.id) === i,
    );

    return {
      nodes: [center, ...uniqueConnected],
      edges: entityRels,
      totalNodes: 1 + uniqueConnected.length,
      totalEdges: entityRels.length,
    };
  }
  if (procedure === "nil.getRecommendations") {
    return [
      {
        id: "ne-demo-case-manager",
        entityType: "person",
        displayName: "Demo Case Manager",
        module: "hr",
        description: "LPC, Case Manager",
        shared_connections: 2,
      },
      {
        id: "ne-ca1",
        entityType: "form",
        displayName: "CAPA-2026-001",
        module: "qa",
        description: "Dual-signature medication check",
        shared_connections: 1,
      },
      {
        id: "ne-wo1",
        entityType: "work_order",
        displayName: "WO-2026-001 — HVAC",
        module: "gad",
        description: "HVAC repair Wing B",
        shared_connections: 1,
      },
      {
        id: "ne-d1",
        entityType: "form",
        displayName: "ADL-HR-POL-202606-0001",
        module: "documents",
        description: "Employee Handbook v2026",
        shared_connections: 1,
      },
    ];
  }
  if (procedure === "nil.findPath") return { found: false, path: [], hops: 0 };
  if (procedure === "nil.reindex") return { entities: 21, relationships: 20 };
  // ─── M10 ENDPOINTS (Analytics) ───────────────────────────
  if (procedure === "analytics.workforceOverview")
    return {
      total: 42,
      employees: 38,
      contractors: 4,
      byLane: { activation: 22, management: 20 },
      byDepartment: {
        Clinical: 8,
        HR: 5,
        "QA & Compliance": 3,
        Revenue: 3,
        GRO: 6,
        GAD: 4,
        Executive: 3,
        IT: 2,
        Operations: 8,
      },
      byStatus: { active: 32, onboarding: 5, "on-leave": 2, terminated: 3 },
    };
  if (procedure === "analytics.moduleCompletionRates")
    return [
      {
        moduleId: "mod-hr-policies",
        moduleName: "HR Policies & Procedures",
        completed: 35,
        pending: 7,
        rate: 83,
      },
      {
        moduleId: "mod-hipaa",
        moduleName: "HIPAA Privacy & Security",
        completed: 38,
        pending: 4,
        rate: 90,
      },
      {
        moduleId: "mod-cfr-42",
        moduleName: "42 CFR Part 2",
        completed: 36,
        pending: 6,
        rate: 86,
      },
      {
        moduleId: "mod-crisis",
        moduleName: "Crisis Intervention",
        completed: 30,
        pending: 12,
        rate: 71,
      },
      {
        moduleId: "mod-documentation",
        moduleName: "Clinical Documentation",
        completed: 32,
        pending: 10,
        rate: 76,
      },
      {
        moduleId: "mod-medication",
        moduleName: "Medication Administration",
        completed: 28,
        pending: 14,
        rate: 67,
      },
      {
        moduleId: "mod-youth-rights",
        moduleName: "Youth Rights & Advocacy",
        completed: 34,
        pending: 8,
        rate: 81,
      },
      {
        moduleId: "mod-restraint",
        moduleName: "Restraint & Seclusion",
        completed: 29,
        pending: 13,
        rate: 69,
      },
      {
        moduleId: "mod-billing",
        moduleName: "Billing & Coding Basics",
        completed: 25,
        pending: 17,
        rate: 60,
      },
      {
        moduleId: "mod-safety",
        moduleName: "Facility Safety & Fire",
        completed: 40,
        pending: 2,
        rate: 95,
      },
    ];
  if (procedure === "analytics.documentCompliance")
    return [
      {
        moduleId: "personnel-file",
        verified: 35,
        uploaded: 5,
        rejected: 2,
        complianceRate: 83,
      },
      {
        moduleId: "credential-verification",
        verified: 32,
        uploaded: 8,
        rejected: 2,
        complianceRate: 76,
      },
      {
        moduleId: "background-check",
        verified: 38,
        uploaded: 3,
        rejected: 1,
        complianceRate: 90,
      },
      {
        moduleId: "tb-screening",
        verified: 36,
        uploaded: 5,
        rejected: 1,
        complianceRate: 86,
      },
      {
        moduleId: "drug-screening",
        verified: 37,
        uploaded: 4,
        rejected: 1,
        complianceRate: 88,
      },
      {
        moduleId: "i-9-verification",
        verified: 34,
        uploaded: 6,
        rejected: 2,
        complianceRate: 81,
      },
      {
        moduleId: "w-4-forms",
        verified: 38,
        uploaded: 3,
        rejected: 1,
        complianceRate: 90,
      },
      {
        moduleId: "emergency-contact",
        verified: 40,
        uploaded: 2,
        rejected: 0,
        complianceRate: 95,
      },
    ];
  if (procedure === "analytics.transitionActivity") {
    const byDay = [
      { date: "2026-05-30", count: 2 },
      { date: "2026-05-31", count: 1 },
      { date: "2026-06-01", count: 3 },
      { date: "2026-06-02", count: 0 },
      { date: "2026-06-03", count: 2 },
      { date: "2026-06-04", count: 4 },
      { date: "2026-06-05", count: 1 },
      { date: "2026-06-06", count: 0 },
      { date: "2026-06-07", count: 2 },
      { date: "2026-06-08", count: 3 },
      { date: "2026-06-09", count: 1 },
      { date: "2026-06-10", count: 2 },
      { date: "2026-06-11", count: 4 },
      { date: "2026-06-12", count: 2 },
      { date: "2026-06-13", count: 1 },
      { date: "2026-06-14", count: 0 },
      { date: "2026-06-15", count: 3 },
      { date: "2026-06-16", count: 2 },
      { date: "2026-06-17", count: 1 },
      { date: "2026-06-18", count: 3 },
      { date: "2026-06-19", count: 2 },
      { date: "2026-06-20", count: 4 },
      { date: "2026-06-21", count: 1 },
      { date: "2026-06-22", count: 2 },
      { date: "2026-06-23", count: 3 },
      { date: "2026-06-24", count: 1 },
      { date: "2026-06-25", count: 2 },
      { date: "2026-06-26", count: 3 },
      { date: "2026-06-27", count: 1 },
      { date: "2026-06-28", count: 2 },
    ];
    const byModule = [
      { moduleId: "hr", moduleName: "HR Lifecycle", count: 18 },
      { moduleId: "clinical", moduleName: "Clinical", count: 12 },
      { moduleId: "qa", moduleName: "QA & Compliance", count: 8 },
      { moduleId: "revenue", moduleName: "Revenue Cycle", count: 6 },
      { moduleId: "documents", moduleName: "Documents", count: 10 },
      { moduleId: "gad", moduleName: "GAD Operations", count: 7 },
      { moduleId: "gro", moduleName: "Growth & Outreach", count: 5 },
    ];
    return {
      recent: byDay.reduce((sum, day) => sum + day.count, 0),
      byDay,
      byModule,
    };
  }
  if (procedure === "analytics.timeToClearMetrics")
    return {
      averageDays: 14,
      medianDays: 12,
      byLane: {
        activation: { avgDays: 18, count: 15 },
        management: { avgDays: 10, count: 23 },
      },
      byDepartment: {
        Clinical: { avgDays: 16, count: 8 },
        HR: { avgDays: 12, count: 5 },
        "QA & Compliance": { avgDays: 20, count: 3 },
        Revenue: { avgDays: 11, count: 3 },
        GRO: { avgDays: 15, count: 6 },
        GAD: { avgDays: 13, count: 4 },
        Executive: { avgDays: 8, count: 3 },
        Operations: { avgDays: 14, count: 8 },
      },
    };
  if (procedure === "analytics.alertSummary")
    return {
      activeWithoutClearance: 2,
      expiredCredentials: 3,
      pendingOrientation: 5,
      incompletePersonnelFiles: 4,
      restrictedClearance: 1,
      pendingOffers: 2,
      pendingReviews: 3,
      expiringSoon: 6,
    };
  if (procedure === "analytics.clinicalOverview")
    return {
      totalYouth: 4,
      activeYouth: 4,
      admissionsThisMonth: 2,
      dischargesThisMonth: 0,
      assessmentsPending: 1,
      sessionsThisWeek: 12,
      governedReviewsPending: 1,
      humanReviewsCompleted: 3,
      byWorkflowStage: [
        { name: "Intake", value: 1 },
        { name: "Active Care", value: 3 },
        { name: "Aftercare", value: 0 },
      ],
      byReviewStatus: [
        { name: "Current", value: 2 },
        { name: "Due", value: 1 },
        { name: "Escalated", value: 1 },
      ],
    };
  if (procedure === "analytics.residentialOverview")
    return {
      campusCapacity: 48,
      operationalBeds: 12,
      occupiedBeds: 7,
      occupancyRate: 58,
      shiftsThisWeek: 21,
      observationsThisWeek: 18,
      familyContactsThisWeek: 6,
      medicationsScheduled: 8,
      medicationsAdministered: 6,
      medicationsRefused: 1,
      medicationsHeld: 1,
      behavioralIncidentsThisWeek: 2,
      prnAdministrations: 1,
      byFacility: [
        { name: "Main Residence", occupied: 4, capacity: 4, rate: 100 },
        { name: "New Facility", occupied: 3, capacity: 8, rate: 38 },
        { name: "Emergency Care GRO", occupied: 0, capacity: 16, rate: 0 },
        { name: "Purpose-Built", occupied: 0, capacity: 16, rate: 0 },
      ],
    };
  if (procedure === "analytics.revenueOverview")
    return {
      totalClaims: 24,
      claimsPending: 6,
      claimsApproved: 14,
      claimsDenied: 3,
      claimsAppealed: 1,
      totalBilled: 1840000,
      totalCollected: 1420000,
      collectionRate: 77,
      avgDaysToPayment: 18,
      authorizationsActive: 4,
      authorizationsPending: 2,
      authorizationsExpiring: 1,
      denialsByReason: [
        { name: "Missing Documentation", value: 1 },
        { name: "Authorization Required", value: 1 },
        { name: "Coding Error", value: 1 },
      ],
    };
  if (procedure === "analytics.complianceOverview")
    return {
      openIncidents: 2,
      incidentsThisMonth: 4,
      openAudits: 1,
      auditsThisQuarter: 2,
      correctiveActionsOpen: 3,
      correctiveActionsOverdue: 1,
      chartAuditPassRate: 78,
      chartAuditsThisMonth: 2,
      hhscReportsDue: 1,
      hhscReportsOverdue: 0,
      byIncidentType: [
        { name: "Behavioral", value: 2 },
        { name: "Medication Error", value: 1 },
        { name: "Equipment", value: 1 },
      ],
      byAuditResult: [
        { name: "Pass", value: 1 },
        { name: "Pass w/ Notes", value: 1 },
      ],
    };
  if (procedure === "analytics.gadOverview")
    return {
      openWorkOrders: 3,
      inProgressWorkOrders: 2,
      completedThisMonth: 2,
      overdueWorkOrders: 0,
      urgentHighCount: 3,
      vendorCount: 7,
      vendorContractsExpiring: 2,
      facilities: 2,
      totalEstimatedSpend: 743000,
      totalActualSpend: 103000,
      byWorkType: [
        { name: "HVAC", value: 1 },
        { name: "Plumbing", value: 1 },
        { name: "Electrical", value: 1 },
        { name: "Safety", value: 1 },
        { name: "Security", value: 1 },
        { name: "IT", value: 1 },
        { name: "Maintenance", value: 1 },
      ],
    };
  if (procedure === "analytics.executiveSummary")
    return {
      timestamp: new Date().toISOString(),
      operationalStatus: "stable",
      criticalAlerts: 2,
      modulesOnline: 6,
      modulesTotal: 13,
      youthServedMTD: 4,
      revenueMTD: 1420000,
      expensesMTD: 103000,
      headcountActive: 38,
      openPositions: 4,
      incidentsOpen: 2,
      complianceScore: 78,
      riskLevel: "moderate",
    };
  if (procedure === "workflow.respondApproval")
    return { success: true, decision: "approved" };
  // revenue.* aliases (backward compat)
  if (procedure === "revenue.dashboardKPIs")
    return getSingleDemoData("m4.dashboardKPIs");
  if (procedure === "revenue.listClaims")
    return getSingleDemoData("m4.listClaims");
  if (procedure === "revenue.getClaim") return getSingleDemoData("m4.getClaim");
  if (procedure === "revenue.agingReport")
    return getSingleDemoData("m4.agingReport");
  if (procedure === "revenue.listPayers")
    return getSingleDemoData("m4.listPayers");
  // qa.* aliases (backward compat — qaRouter = m3Router)
  if (procedure === "qa.dashboardKPIs")
    return getSingleDemoData("m3.dashboardKPIs");
  if (procedure === "qa.listAudits") return getSingleDemoData("m3.listAudits");
  if (procedure === "qa.listIncidents")
    return getSingleDemoData("m3.listIncidents");
  if (procedure === "qa.listCorrectiveActions")
    return getSingleDemoData("m3.listCorrectiveActions");
  if (procedure === "qa.complianceScores")
    return getSingleDemoData("m3.complianceScores");
  // ═══════════════════════════════════════════════════════════════
  // COMPREHENSIVE LIVE STORE MUTATIONS — All CRUD routes here
  // ═══════════════════════════════════════════════════════════════

  // ─── Tasks / Work Items ───
  if (
    procedure === "m1.listWorkTasks" ||
    procedure === "m1.listTasks" ||
    procedure === "workflow.listTasks"
  )
    return store.tasks;
  if (procedure === "m1.createWorkTask") return createTask(input);
  if (procedure === "m1.completeWorkTask")
    return updateTask(readDemoString(input, "taskId"), { status: "completed" });
  if (procedure === "m1.updateTask")
    return updateTask(
      readDemoString(input, "taskId", readDemoString(input, "id")),
      input,
    );
  if (procedure === "m1.deleteTask")
    return deleteTask(
      readDemoString(input, "taskId", readDemoString(input, "id")),
    );

  // ─── QA / Audits / Incidents ───
  if (procedure === "m3.createAudit" || procedure === "qa.createAudit")
    return createAudit(input);
  if (procedure === "m3.updateAudit" || procedure === "qa.updateAudit")
    return { success: true }; // partial
  if (procedure === "m3.deleteAudit" || procedure === "qa.deleteAudit")
    return { success: true };
  if (procedure === "m3.createIncident" || procedure === "qa.createIncident")
    return createIncident(input);
  if (procedure === "m3.updateIncident" || procedure === "qa.updateIncident")
    return updateIncident(readDemoString(input, "id"), input);
  if (
    procedure === "m3.createCorrectiveAction" ||
    procedure === "qa.createCorrectiveAction"
  )
    return createTask({
      title: readDemoString(input, "title", "New CAP"),
      category: "documentation",
      priority: readDemoString(input, "priority", "medium"),
      notes: readDemoString(input, "description"),
    });
  if (
    procedure === "m3.updateCorrectiveAction" ||
    procedure === "qa.updateCorrectiveAction"
  )
    return { success: true };

  // ─── Medications ───
  if (
    procedure === "m19.administer" ||
    procedure === "m19.administerMedication" ||
    procedure === "m20.administerMedication"
  )
    return administerMed(
      readDemoString(input, "medicationId", readDemoString(input, "id")),
      readDemoString(input, "administeredBy", "Synthetic Nurse 01"),
      readDemoString(input, "adminTime", new Date().toTimeString().slice(0, 5)),
      readDemoString(input, "notes"),
    );
  if (
    procedure === "m19.recordRefusal" ||
    procedure === "m19.refuseMedication" ||
    procedure === "m20.refuseMedication"
  )
    return refuseMed(
      readDemoString(input, "medicationId", readDemoString(input, "id")),
      readDemoString(input, "reason", "Youth refused"),
    );
  if (procedure === "m19.holdMedication" || procedure === "m20.holdMedication")
    return holdMed(
      readDemoString(input, "medicationId", readDemoString(input, "id")),
      readDemoString(input, "reason", "Clinical hold"),
    );
  if (procedure === "m19.recordPrn" || procedure === "m20.recordPrn")
    return recordPrn(
      readDemoString(input, "medicationId", readDemoString(input, "id")),
      readDemoString(input, "administeredBy", "Synthetic Nurse 01"),
      readDemoString(input, "adminTime", new Date().toTimeString().slice(0, 5)),
      readDemoString(input, "prnReason"),
      readDemoString(input, "effectiveness", "effective"),
      readDemoString(input, "notes"),
    );
  if (
    procedure === "m19.recordControlled" ||
    procedure === "m20.recordControlled"
  )
    return administerMed(
      readDemoString(input, "medicationId", readDemoString(input, "id")),
      readDemoString(input, "administeredBy", "Synthetic Nurse 01"),
      readDemoString(input, "adminTime", new Date().toTimeString().slice(0, 5)),
      `Controlled: before=${String(input.countBefore ?? "")} after=${String(input.countAfter ?? "")} witness=${readDemoString(input, "witnessName")}`,
    );
  if (procedure === "m19.createMedication")
    return { ...input, id: nextId("med"), status: "scheduled" };

  // ─── Behavioral Observations ───
  if (
    procedure === "m15.createObservation" ||
    procedure === "m18.createBehavioralObs" ||
    procedure === "bhc.createObservation"
  )
    return createBehavioralObs(input);
  if (procedure === "m15.respondToObservation") return { success: true };

  // ─── Family Contacts ───
  if (
    procedure === "m18.createFamilyContact" ||
    procedure === "bhc.createFamilyContact"
  )
    return createFamilyContact(input);

  // ─── Incidents (general) ───
  if (
    procedure === "m18.createIncident" ||
    procedure === "incident.create" ||
    procedure === "m17.createCrisis"
  )
    return createIncident(input);
  if (
    procedure === "m17.advanceStep" ||
    procedure === "m17.updateCrisisOutcome" ||
    procedure === "m17.createDebrief" ||
    procedure === "m17.updateDebrief"
  )
    return { success: true };

  // ─── Shifts / Handoffs ───
  if (procedure === "m18.createHandoff")
    return updateShift(readDemoString(input, "shiftId", "s1"), {
      handoffNote: readDemoString(input, "note"),
      handoffAlerts: Array.isArray(input.alerts) ? input.alerts : [],
      pendingHandoffs: 0,
    });
  if (procedure === "m18.createShift") return createShiftFn(input);
  if (procedure === "m18.assignBed")
    return assignBed(
      readDemoString(input, "bedId"),
      readDemoString(input, "youthId"),
    );
  if (procedure === "m18.vacateBed")
    return vacateBed(readDemoString(input, "bedId"));

  // ─── Sessions / Plans ───
  if (
    procedure === "bhc.createSession" ||
    procedure === "bhc.createTreatmentPlan" ||
    procedure === "bhc.createOutcomeMeasure"
  )
    return createSession(input);
  if (procedure === "bhc.dischargePatient") return { success: true };
  if (procedure === "bhc.createPatient")
    return { ...input, id: nextId("y"), status: "active" };

  // ─── GRO Referrals ───
  if (procedure === "gro.createReferral" || procedure === "gro.updateReferral")
    return createReferral(input);
  if (procedure === "gro.createPartnership") return { success: true };

  // ─── GAD Work Orders ───
  if (procedure === "gad.createWorkOrder") return createWorkOrder(input);
  if (procedure === "gad.updateWorkOrder")
    return updateWorkOrder(
      readDemoString(input, "id", readDemoString(input, "workOrderId")),
      input,
    );

  // ─── Meetings / Escalations ───
  if (procedure === "m15.createMeeting" || procedure === "m15.updateMeeting")
    return createMeeting(input);
  if (
    procedure === "m15.createActionItem" ||
    procedure === "m15.updateActionItem"
  )
    return { ...input, id: nextId("m15") };
  if (
    procedure === "m15.createEscalation" ||
    procedure === "m15.updateEscalation"
  )
    return createEscalation(input);

  // ─── Workflow / Approvals ───
  if (procedure === "workflow.respondApproval")
    return respondToApproval(
      readDemoString(input, "approvalId"),
      readDemoString(input, "decision", "approved"),
    );
  if (procedure === "workflow.trigger") return { success: true };

  // ─── Auth / Settings ───
  if (procedure === "auth.updateUser")
    return { ...input, id: readDemoString(input, "id", "u1") };
  if (procedure === "auth.deleteUser") return { success: true };

  // ─── MS Graph ───
  if (procedure === "msgraph.sync") return { success: true, synced: 0 };

  // ─── HR / Onboarding ───
  if (
    procedure === "m1.addCredential" ||
    procedure === "m1.createEvidencePacket" ||
    procedure === "m1.updateModuleProgress" ||
    procedure === "m1.seedDefaultTemplates"
  )
    return { success: true };

  // ─── Case Management ───
  if (procedure === "m16.createCase" || procedure === "m16.updateCase")
    return { ...input, id: nextId("case") };

  // ─── Intake / Assessment ───
  if (
    procedure === "m13.createYouth" ||
    procedure === "m13.updateYouth" ||
    procedure === "m13.createIntake" ||
    procedure === "m13.updateStep" ||
    procedure === "m13.createChecklist" ||
    procedure === "m13.updateChecklist"
  )
    return { ...input, id: nextId("m13") };
  if (
    procedure === "m14.createAssessment" ||
    procedure === "m14.updateAssessment" ||
    procedure === "m14.updateDomain" ||
    procedure === "m14.determineLOC"
  )
    return { ...input, id: nextId("m14") };

  // ─── Revenue ───
  if (
    procedure === "m4.createClaim" ||
    procedure === "m4.updateClaim" ||
    procedure === "m20.createAuthorization" ||
    procedure === "m20.updateReadiness" ||
    procedure === "m20.advanceStage"
  )
    return { ...input, id: nextId("rev") };

  // ─── Audit / Persona ───
  if (
    procedure === "m21.createAudit" ||
    procedure === "m21.updateAudit" ||
    procedure === "m21.activatePersona"
  )
    return { success: true };

  // ─── Document Management ───
  if (
    procedure === "m2.create" ||
    procedure === "m2.update" ||
    procedure === "m2.delete" ||
    procedure === "m2.transitionStatus" ||
    procedure === "m2.createVersion" ||
    procedure === "m2.seedCategories"
  )
    return { success: true };
  // ─── M13/M14 ENDPOINTS (Youth Pathway — Sprint 2) ────────
  if (procedure === "m13.listYouth") return store.youth;
  if (procedure === "m13.getYouth")
    return {
      id: "y1",
      mrn: "SYNTH-BHC-001",
      first_name: "Synthetic-Person-001",
      last_name: "Johnson",
      date_of_birth: "2010-03-15",
      age: 16,
      gender: "male",
      race: "Black/African American",
      ethnicity: "Hispanic",
      preferred_language: "English",
      phone: "(512) 555-0101",
      email: "guardian.mjohnson@example.invalid",
      address: "1423 Cypress Lane, Houston, TX 77001",
      city: "Houston",
      state: "TX",
      zip: "77001",
      guardian1_name: "Synthetic Guardian 01",
      guardian1_relationship: "Mother",
      guardian1_phone: "(512) 555-0102",
      guardian1_email: "tanya.j@example.invalid",
      guardian2_name: "Robert Johnson",
      guardian2_relationship: "Father",
      guardian2_phone: "(512) 555-0103",
      emergency_name: "Grandma Johnson",
      emergency_relationship: "Grandmother",
      emergency_phone: "(512) 555-0104",
      referral_source_type: "school",
      referral_source_name: "HISD School Counselor",
      referred_by: "Ms. Garcia",
      referral_date: "2026-03-15",
      assigned_clinician_id: "u2",
      assigned_clinician_name: "Demo Clinical Director",
      assigned_case_manager_id: "u3",
      assigned_case_manager_name: "Demo Clinical Lead",
      status: "active",
      level_of_care: "residential",
      bed_assignment: "Room 101-A",
      primary_payer_name: "Texas Medicaid",
      policy_number: "TXM-88765432",
      group_number: "GRP-001",
      subscriber_name: "Synthetic Guardian 01",
      subscriber_relationship: "Mother",
      admission_date: "2026-04-01",
      projected_discharge_date: "2026-10-01",
      notes: "Trauma history, responding well to CBT.",
    };
  if (procedure === "m13.listIntakes")
    return [
      {
        id: "i1",
        youth_id: "y3",
        mrn: "SYNTH-BHC-003",
        youth_name: "Synthetic Youth 007",
        referral_received_date: "2026-06-28",
        referral_received_by: "gro.admin@amos-ops.invalid",
        referral_received_completed: 1,
        screening_completed: 1,
        screening_result: "pass",
        consent_completed: 0,
        payer_completed: 0,
        disposition_completed: 0,
        current_step: "consent",
        overall_status: "in_progress",
        is_blocked: 0,
        created_at: "2026-06-28T14:00:00Z",
      },
      {
        id: "i2",
        youth_id: "y5",
        mrn: "SYNTH-BHC-005",
        youth_name: "Synthetic Youth 017",
        referral_received_date: "2026-06-27",
        referral_received_by: "gro.admin@amos-ops.invalid",
        referral_received_completed: 1,
        screening_completed: 1,
        screening_result: "needs_review",
        consent_completed: 0,
        payer_completed: 0,
        disposition_completed: 0,
        current_step: "consent",
        overall_status: "in_progress",
        is_blocked: 0,
        created_at: "2026-06-27T08:15:00Z",
      },
    ];
  if (procedure === "m13.getIntake")
    return {
      id: "i1",
      youth_id: "y3",
      mrn: "SYNTH-BHC-003",
      youth_name: "Synthetic Youth 007",
      referral_received_date: "2026-06-28T10:00:00Z",
      referral_received_by: "gro.admin@amos-ops.invalid",
      referral_received_notes:
        "Referral from DCF caseworker. Emergency placement needed.",
      referral_received_completed: 1,
      referral_elapsed_hours: 2,
      screening_date: "2026-06-28T14:00:00Z",
      screening_completed_by: "clinical.director@amos-ops.invalid",
      screening_result: "pass",
      screening_notes:
        "Screening completed. Youth presents with conduct disorder symptoms. No imminent safety concerns.",
      screening_completed: 1,
      screening_elapsed_hours: 4,
      consent_date: null,
      consent_completed_by: null,
      guardian_consent_obtained: 0,
      youth_assent_obtained: 0,
      hipaa_acknowledgment: 0,
      rights_acknowledgment: 0,
      consent_notes: "Awaiting guardian consent. Mother scheduled for 6/29.",
      consent_completed: 0,
      consent_elapsed_hours: 18,
      payer_verification_date: null,
      payer_verification_completed_by: null,
      benefits_verified: 0,
      authorization_required: 1,
      authorization_submitted: 0,
      authorization_approved: 0,
      payer_notes: "",
      payer_completed: 0,
      payer_elapsed_hours: 0,
      disposition_date: null,
      disposition_completed_by: null,
      disposition: null,
      disposition_reason: null,
      bed_assigned: null,
      admission_scheduled_date: null,
      disposition_completed: 0,
      disposition_elapsed_hours: 0,
      current_step: "consent",
      overall_status: "in_progress",
      is_blocked: 0,
      block_reason: null,
      created_at: "2026-06-28T14:00:00Z",
      updated_at: "2026-06-29T08:00:00Z",
      created_by: "gro.admin@amos-ops.invalid",
    };
  if (procedure === "m13.getChecklist")
    return {
      id: "cl1",
      youth_id: "y3",
      intake_id: "i1",
      item1_referral_form_received: 1,
      item2_demographics_complete: 1,
      item3_insurance_verified: 0,
      item4_consent_for_release: 0,
      item5_psychiatric_history: 1,
      item6_medical_records_requested: 1,
      item7_educational_records_requested: 0,
      item8_legal_status_confirmed: 1,
      item9_guardian_contact_verified: 1,
      item10_service_activation_date_set: 0,
      items_completed: 6,
      items_total: 10,
      all_items_complete: 0,
      completed_by: null,
      completed_at: null,
    };
  if (procedure === "m14.listAssessments")
    return [
      {
        id: "a1",
        youth_id: "y1",
        mrn: "SYNTH-BHC-001",
        youth_name: "Synthetic Youth 001",
        assessment_type: "intake",
        assessment_date: "2026-04-03",
        completed_by: "Demo Clinical Director",
        clinician_name: "Demo Clinical Director",
        status: "completed",
        reviewed_by: "Demo Clinical Director",
        reviewed_at: "2026-04-05T10:00:00Z",
        approved_by: "Demo Clinical Director",
        approved_at: "2026-04-05T14:00:00Z",
        created_at: "2026-04-03T10:00:00Z",
      },
      {
        id: "a2",
        youth_id: "y3",
        mrn: "SYNTH-BHC-003",
        youth_name: "Synthetic Youth 007",
        assessment_type: "intake",
        assessment_date: "2026-06-29",
        completed_by: "Demo Clinical Lead",
        clinician_name: "Demo Clinical Lead",
        status: "in_progress",
        reviewed_by: null,
        reviewed_at: null,
        approved_by: null,
        approved_at: null,
        created_at: "2026-06-29T09:00:00Z",
      },
    ];
  if (procedure === "m14.getAssessment")
    return {
      id: "a1",
      youth_id: "y1",
      mrn: "SYNTH-BHC-001",
      youth_name: "Synthetic Youth 001",
      assessment_type: "intake",
      assessment_date: "2026-04-03",
      completed_by: "Demo Clinical Director",
      completed_by_id: "u2",
      clinician_name: "Demo Clinical Director",
      clinician_id: "u2",
      supervisor_name: "Demo Executive",
      supervisor_id: "u1",
      presenting_problems:
        "Persistent sadness, social withdrawal, declining academic performance, insomnia lasting 4 months. Reports feeling worthless and occasional passive suicidal ideation without plan or intent.",
      psychiatric_history:
        "No prior psychiatric hospitalizations. Outpatient therapy for 6 months in 2025 with limited progress.",
      substance_use_history:
        "Denies substance use. Urine screen negative at intake.",
      trauma_history:
        "Witnessed domestic violence between ages 8-12. Parents separated when patient was 10.",
      medical_history:
        "Generally healthy. Mild asthma, managed with albuterol PRN. Allergies: penicillin.",
      family_history:
        "Mother: anxiety disorder (treated). Father: depression (untreated). Maternal uncle: substance use disorder.",
      educational_history:
        "9th grade at Kashmere High School. Declining grades over past year (A/B to D/F). School refusal increasing.",
      status: "completed",
      reviewed_by: "Demo Clinical Director",
      reviewed_at: "2026-04-05T10:00:00Z",
      approved_by: "Demo Clinical Director",
      approved_at: "2026-04-05T14:00:00Z",
      domains: [
        {
          id: "ad1",
          assessment_id: "a1",
          domain_number: 1,
          domain_name: "Behavioral / Emotional Functioning",
          strengths:
            "Engages well in individual therapy. Shows insight into depression.",
          needs: "Social withdrawal, persistent sadness, sleep disturbance.",
          observations:
            "Patient appeared downcast but cooperative. Made eye contact. Responded well to supportive statements.",
          clinical_notes:
            "CBT recommended. Trauma-informed approach essential.",
          intervention_needed: 1,
          intervention_description:
            "Individual CBT 2x weekly, group therapy 1x weekly",
        },
        {
          id: "ad2",
          assessment_id: "a1",
          domain_number: 2,
          domain_name: "Cognitive / Developmental Functioning",
          strengths: "Above-average intelligence. Good problem-solving skills.",
          needs: "Difficulty concentrating, especially on academic tasks.",
          observations:
            "Alert and oriented. Memory intact. Abstract reasoning adequate.",
          clinical_notes:
            "ADHD screening recommended but not indicated at this time.",
          intervention_needed: 0,
          intervention_description: null,
        },
        {
          id: "ad3",
          assessment_id: "a1",
          domain_number: 3,
          domain_name: "Social / Relational Functioning",
          strengths: "Has one close friend. Shows empathy toward peers.",
          needs:
            "Social anxiety, difficulty making new friends, isolates in groups.",
          observations:
            "Participated minimally in group activity. Sat at periphery.",
          clinical_notes:
            "Social skills group recommended. Gradual exposure to peer activities.",
          intervention_needed: 1,
          intervention_description: "Social skills group 1x weekly",
        },
        {
          id: "ad4",
          assessment_id: "a1",
          domain_number: 4,
          domain_name: "Family / Caregiver Functioning",
          strengths: "Mother is supportive and engaged in treatment.",
          needs:
            "Father absent. Co-parenting conflict. Mother's own anxiety affects parenting.",
          observations:
            "Mother attended family session. Open to parenting coaching.",
          clinical_notes:
            "Family therapy 2x monthly. Parenting skills training for mother.",
          intervention_needed: 1,
          intervention_description: "Family therapy 2x monthly",
        },
        {
          id: "ad5",
          assessment_id: "a1",
          domain_number: 5,
          domain_name: "Safety / Risk Behaviors",
          strengths:
            "No history of self-harm. No suicide attempts. No aggression toward others.",
          needs:
            "Passive suicidal ideation without plan. History of elopement from home.",
          observations:
            "Cooperative with safety planning. Identified 3 reasons for living.",
          clinical_notes:
            "Safety plan completed. 15-minute checks first 72 hours.",
          intervention_needed: 1,
          intervention_description:
            "Safety plan, 15-minute checks, crisis protocol review",
        },
        {
          id: "ad6",
          assessment_id: "a1",
          domain_number: 6,
          domain_name: "Physical Health / Medical",
          strengths: "Generally healthy. Takes albuterol as needed.",
          needs: "Mild asthma. Irregular sleep schedule.",
          observations: "Physical exam within normal limits. Lungs clear.",
          clinical_notes: "Continue PRN albuterol. Sleep hygiene intervention.",
          intervention_needed: 0,
          intervention_description: null,
        },
      ],
    };
  // (Live store mutations are handled above at lines 717-801)
  // ─── M15 ENDPOINTS (M14 Daily Coordination — Sprint 2) ─────
  if (procedure === "m15.listObservations")
    return [
      {
        id: "obs1",
        youth_id: "y1",
        youth_name: "Synthetic Youth 001",
        mrn: "SYNTH-BHC-001",
        observation_date: "2026-07-01",
        shift: "day",
        observed_by: "Synthetic Staff 01",
        observed_by_id: "u10",
        domain1_safety: 1,
        domain1_safety_notes: "No safety concerns. Compliant with unit rules.",
        domain2_regulation: 1,
        domain2_regulation_notes:
          "Good emotional regulation during group activity.",
        domain3_functioning: 1,
        domain3_functioning_notes: "Completed morning routine independently.",
        domain4_medication: 1,
        domain4_medication_notes: "Took AM meds without issue.",
        domain5_relationships: 1,
        domain5_relationships_notes:
          "Interacted positively with peers at breakfast.",
        domain6_participation: 1,
        domain6_participation_notes:
          "Engaged in group therapy. Shared appropriately.",
        clinical_concerns: null,
        clinician_response: null,
        created_at: "2026-07-01T14:00:00Z",
      },
      {
        id: "obs2",
        youth_id: "y4",
        youth_name: "Synthetic Youth 002",
        mrn: "SYNTH-BHC-004",
        observation_date: "2026-07-01",
        shift: "day",
        observed_by: "Synthetic Staff 02",
        observed_by_id: "u11",
        domain1_safety: 1,
        domain1_safety_notes:
          "Verbal altercation with peer at lunch. Staff intervened. No physical contact.",
        domain2_regulation: 1,
        domain2_regulation_notes:
          "Difficulty regulating after conflict. Took 20 min to de-escalate.",
        domain3_functioning: 1,
        domain3_functioning_notes:
          "Refused afternoon activity. Remained in room.",
        domain4_medication: 1,
        domain4_medication_notes: "Took PRN as ordered after incident.",
        domain5_relationships: 1,
        domain5_relationships_notes:
          "Isolating from peers after conflict. Refused group dinner.",
        domain6_participation: 0,
        domain6_participation_notes:
          "Declined all activities after lunch incident.",
        clinical_concerns:
          "Peer conflict + isolation pattern. Monitor for escalation.",
        clinician_response:
          "I'll check in with Synthetic-Person-002 during my evening rounds. Planning 1:1 session tomorrow morning.",
        created_at: "2026-07-01T18:30:00Z",
      },
      {
        id: "obs3",
        youth_id: "y2",
        youth_name: "Synthetic Youth 005",
        mrn: "SYNTH-BHC-002",
        observation_date: "2026-07-01",
        shift: "evening",
        observed_by: "Synthetic Staff 06",
        observed_by_id: "u12",
        domain1_safety: 1,
        domain1_safety_notes: "Calm and cooperative throughout evening.",
        domain2_regulation: 1,
        domain2_regulation_notes:
          "Used coping skills when frustrated during homework.",
        domain3_functioning: 1,
        domain3_functioning_notes: "Completed homework with minimal prompting.",
        domain4_medication: 1,
        domain4_medication_notes: "Took PM meds. No issues.",
        domain5_relationships: 1,
        domain5_relationships_notes: "Helped new peer learn evening routine.",
        domain6_participation: 1,
        domain6_participation_notes:
          "Active in evening group. Led discussion topic.",
        clinical_concerns: null,
        clinician_response: null,
        created_at: "2026-07-01T22:00:00Z",
      },
    ];
  if (procedure === "m15.coordinationSummary")
    return {
      todayObservations: 3,
      pendingClinicalResponses: 0,
      todaysMeetings: 2,
      openActionItems: 4,
      activeEscalations: 1,
      activeCrisisEvents: 0,
    };
  if (procedure === "m15.listMeetings")
    return [
      {
        id: "mt1",
        meeting_type: "daily_huddle",
        title: "Daily Huddle — July 1",
        scheduled_date: "2026-07-01",
        scheduled_time: "07:30",
        duration_minutes: 15,
        facilitator_name: "Synthetic Staff 01 (Lead)",
        attendees_json:
          '[{"name":"Synthetic Staff 01","role":"RCS Lead"},{"name":"Synthetic Staff 02","role":"RCS"},{"name":"Synthetic Staff 06","role":"RCS"},{"name":"Demo Clinical Lead","role":"MHTCM"}]',
        youth_ids_json: '["y1","y2","y4"]',
        agenda_json:
          '["Overnight report","Synthetic-Person-002 incident review","Synthetic-Person-001 family visit today","Shift assignments"]',
        status: "completed",
        completed_at: "2026-07-01T07:45:00Z",
        follow_up_required: 1,
        follow_up_notes: "Synthetic-Person-002 incident follow-up needed",
        created_at: "2026-07-01T07:00:00Z",
      },
      {
        id: "mt2",
        meeting_type: "case_staffing",
        title: "Weekly Case Staffing",
        scheduled_date: "2026-07-02",
        scheduled_time: "14:00",
        duration_minutes: 60,
        facilitator_name: "Demo Clinical Director",
        attendees_json:
          '[{"name":"Demo Clinical Director","role":"Clinical Director"},{"name":"Demo Clinical Lead","role":"MHTCM"},{"name":"Synthetic Staff 01","role":"RCS Lead"},{"name":"Demo Executive","role":"Managing Director"}]',
        youth_ids_json: '["y1","y2","y3","y4"]',
        agenda_json:
          '["Synthetic Youth 001 — progress review","Synthetic Youth 005 — quarterly assessment","Synthetic Youth 007 — intake status","Synthetic Youth 002 — incident review + safety plan"]',
        status: "scheduled",
        follow_up_required: 0,
        created_at: "2026-06-30T10:00:00Z",
      },
      {
        id: "mt3",
        meeting_type: "family_conference",
        title: "Synthetic Youth 001 — Family Conference",
        scheduled_date: "2026-07-03",
        scheduled_time: "16:00",
        duration_minutes: 45,
        facilitator_name: "Demo Clinical Lead",
        attendees_json:
          '[{"name":"Demo Clinical Lead","role":"MHTCM"},{"name":"Synthetic Guardian 01","role":"Guardian"},{"name":"Robert Johnson","role":"Guardian"}]',
        youth_ids_json: '["y1"]',
        agenda_json:
          '["Treatment progress update","Discharge planning discussion","Family therapy schedule","Home visit assessment"]',
        status: "scheduled",
        follow_up_required: 0,
        created_at: "2026-06-28T14:00:00Z",
      },
    ];
  if (procedure === "m15.getMeeting")
    return {
      id: "mt2",
      meeting_type: "case_staffing",
      title: "Weekly Case Staffing",
      scheduled_date: "2026-07-02",
      scheduled_time: "14:00",
      duration_minutes: 60,
      facilitator_name: "Demo Clinical Director",
      attendees_json:
        '[{"name":"Demo Clinical Director","role":"Clinical Director"},{"name":"Demo Clinical Lead","role":"MHTCM"},{"name":"Synthetic Staff 01","role":"RCS Lead"},{"name":"Demo Executive","role":"Managing Director"}]',
      youth_ids_json: '["y1","y2","y3","y4"]',
      agenda_json:
        '["Synthetic Youth 001 — progress review","Synthetic Youth 005 — quarterly assessment","Synthetic Youth 007 — intake status","Synthetic Youth 002 — incident review + safety plan"]',
      notes: "",
      status: "scheduled",
      follow_up_required: 0,
      created_at: "2026-06-30T10:00:00Z",
      actionItems: [
        {
          id: "ai1",
          meeting_id: "mt2",
          description: "Complete Synthetic-Person-001 quarterly assessment documentation",
          assigned_to_name: "Demo Clinical Director",
          priority: "high",
          due_date: "2026-07-04",
          status: "open",
        },
        {
          id: "ai2",
          meeting_id: "mt2",
          description: "Schedule Synthetic-Person-004 intake assessment with guardian",
          assigned_to_name: "Demo Clinical Lead",
          priority: "urgent",
          due_date: "2026-07-01",
          status: "overdue",
        },
        {
          id: "ai3",
          meeting_id: "mt2",
          description: "Update Synthetic-Person-002 safety plan post-incident",
          assigned_to_name: "Demo Clinical Director",
          priority: "high",
          due_date: "2026-07-02",
          status: "in_progress",
        },
        {
          id: "ai4",
          meeting_id: "mt2",
          description: "Prepare family conference materials for Synthetic-Person-001",
          assigned_to_name: "Demo Clinical Lead",
          priority: "medium",
          due_date: "2026-07-03",
          status: "open",
        },
      ],
    };
  if (procedure === "m15.listEscalations")
    return [
      {
        id: "esc1",
        youth_id: "y4",
        youth_name: "Synthetic Youth 002",
        mrn: "SYNTH-BHC-004",
        tier: "clinical",
        previous_tier: "routine",
        trigger_source: "observation",
        trigger_description: "Peer conflict + social isolation pattern",
        trigger_detail:
          "Verbal altercation at lunch followed by refusal to engage in afternoon activities and group dinner. Historical pattern of escalation after conflicts.",
        response_actions:
          '["Staff debrief","1:1 check-in scheduled","PRN administered as ordered","Clinician notified"]',
        responder_name: "Synthetic Staff 02",
        responder_role: "RCS",
        responded_at: "2026-07-01T18:45:00Z",
        resolution_notes:
          "Synthetic-Person-002 calmed after PRN and 1:1 with RCS. Declined dinner but accepted evening snack. Will monitor overnight.",
        resolved_at: "2026-07-01T21:00:00Z",
        resolved_by: "Synthetic Staff 06",
        status: "monitoring",
        requires_post_crisis_review: 0,
        post_crisis_review_completed: 0,
        created_at: "2026-07-01T18:30:00Z",
      },
      {
        id: "esc2",
        youth_id: "y1",
        youth_name: "Synthetic Youth 001",
        mrn: "SYNTH-BHC-001",
        tier: "routine",
        previous_tier: null,
        trigger_source: "staff_report",
        trigger_description: "Missed morning medication",
        trigger_detail:
          "Synthetic-Person-001 stated he 'forgot' his morning meds. This is the first occurrence. No behavioral changes observed.",
        response_actions:
          '["Med re-offered and taken","Documented in MAR","Guardian notification per protocol"]',
        responder_name: "Synthetic Staff 01",
        responder_role: "RCS Lead",
        responded_at: "2026-07-01T08:30:00Z",
        resolution_notes:
          "Med taken after reminder. No further action needed. Monitor pattern.",
        resolved_at: "2026-07-01T08:30:00Z",
        resolved_by: "Synthetic Staff 01",
        status: "resolved",
        requires_post_crisis_review: 0,
        post_crisis_review_completed: 0,
        created_at: "2026-07-01T08:15:00Z",
      },
    ];

  // ─── M16/M17 ENDPOINTS (M15 Case/Crisis — Sprint 2) ──────
  if (procedure === "m16.listCases")
    return [
      {
        id: "cm1",
        youth_id: "y1",
        youth_name: "Synthetic Youth 001",
        mrn: "SYNTH-BHC-001",
        case_manager_id: "u3",
        case_manager_name: "Demo Clinical Lead",
        function1_coordination: 1,
        function1_coordination_notes:
          "Coordinated with school counselor re: academic accommodations. Family engaged in weekly family therapy.",
        function2_referrals: 1,
        function2_referrals_json:
          '[{"provider":"Kashmere High School","type":"Educational Accommodations","status":"Active","date":"2026-04-15"},{"provider":"Synthetic Clinician","type":"Psychiatry","status":"Active","date":"2026-04-10"}]',
        function3_collaterals: 1,
        function3_collaterals_json:
          '[{"contact":"Synthetic Guardian 01","relationship":"Mother","date":"2026-06-28","notes":"Weekly phone check-in. Reports improvement at home."},{"contact":"Ms. Garcia","relationship":"School Counselor","date":"2026-06-25","notes":"Grades improving. Attendance stable."}]',
        function4_barriers: 1,
        function4_barriers_json:
          '[{"barrier":"Father non-participation in family therapy","impact":"Moderate","resolution":"Ongoing outreach to father. Alternative: uncle may participate."},{"barrier":"Transportation for school visits","impact":"Low","resolution":"Staff provides transportation"}]',
        function5_monitoring: 1,
        function5_monitoring_notes:
          "Weekly progress tracking. Depression scores trending downward (PHQ-A: 18→12). Sleep improved. Social engagement increasing.",
        function6_transition: 0,
        function6_transition_notes:
          "Not yet applicable. Target discharge review in August.",
        status: "active",
        last_review_date: "2026-06-28",
        next_review_date: "2026-07-05",
        created_at: "2026-04-03T10:00:00Z",
      },
      {
        id: "cm2",
        youth_id: "y4",
        youth_name: "Synthetic Youth 002",
        mrn: "SYNTH-BHC-004",
        case_manager_id: "u3",
        case_manager_name: "Demo Clinical Lead",
        function1_coordination: 1,
        function1_coordination_notes:
          "Multi-system coordination: DCF, guardian, school, court. Weekly team calls.",
        function2_referrals: 1,
        function2_referrals_json:
          '[{"provider":"Houston ISD","type":"Special Education Eval","status":"Pending","date":"2026-06-15"},{"provider":"Juvenile Court","type":"Probation","status":"Active","date":"2026-05-20"}]',
        function3_collaterals: 1,
        function3_collaterals_json:
          '[{"contact":"Synthetic Youth 011","relationship":"Mother","date":"2026-06-27","notes":"Guardian reports Synthetic-Person-002 having difficulty at home on weekends."},{"contact":"Officer Davis","relationship":"Probation Officer","date":"2026-06-24","notes":"Compliant with probation terms. Attending all required meetings."}]',
        function4_barriers: 1,
        function4_barriers_json:
          '[{"barrier":"History of running away","impact":"High","resolution":"Safety plan in place. 15-min checks. Elopement precautions active."},{"barrier":"Mother work schedule conflicts with family therapy","impact":"Moderate","resolution":"Evening sessions scheduled"}]',
        function5_monitoring: 1,
        function5_monitoring_notes:
          "Daily behavioral tracking. Aggression episodes: 3 in past week (down from 6). Isolation periods decreasing.",
        function6_transition: 0,
        function6_transition_notes:
          "Not yet applicable. Minimum 90-day stay required.",
        status: "active",
        last_review_date: "2026-06-29",
        next_review_date: "2026-07-02",
        created_at: "2026-05-20T11:00:00Z",
      },
      {
        id: "cm3",
        youth_id: "y3",
        youth_name: "Synthetic Youth 007",
        mrn: "SYNTH-BHC-003",
        case_manager_id: "u3",
        case_manager_name: "Demo Clinical Lead",
        function1_coordination: 0,
        function1_coordination_notes: "",
        function2_referrals: 0,
        function2_referrals_json: "[]",
        function3_collaterals: 0,
        function3_collaterals_json: "[]",
        function4_barriers: 0,
        function4_barriers_json: "[]",
        function5_monitoring: 0,
        function5_monitoring_notes: "",
        function6_transition: 0,
        function6_transition_notes: "",
        status: "active",
        last_review_date: null,
        next_review_date: null,
        created_at: "2026-06-29T09:00:00Z",
      },
    ];
  if (procedure === "m16.caseMgmtSummary")
    return {
      activeCases: 3,
      onHoldCases: 0,
      pendingReview: 0,
      totalCases: 3,
      overdueReviews: 0,
    };
  if (procedure === "m17.listCrises")
    return [
      {
        id: "cr1",
        youth_id: "y4",
        youth_name: "Synthetic Youth 002",
        mrn: "SYNTH-BHC-004",
        crisis_type: "behavioral_escalation",
        step1_identified: 1,
        step1_identified_at: "2026-07-01T18:15:00Z",
        step1_identified_by: "Synthetic Staff 02",
        step2_activated: 1,
        step2_activated_at: "2026-07-01T18:18:00Z",
        step2_activated_by: "Synthetic Staff 02",
        step3_responded: 1,
        step3_responded_at: "2026-07-01T18:20:00Z",
        step3_responder_name: "Synthetic Staff 02 + Synthetic Staff 01",
        step3_response_actions:
          '["Verbal de-escalation","Removed from dining area","Offered quiet space","PRN offered"]',
        step4_ensured_safety: 1,
        step4_safety_measures:
          "Youth in quiet room with 1:1 staff supervision. Other youth redirected. No injuries.",
        step4_ensured_at: "2026-07-01T18:25:00Z",
        step5_notified: 1,
        step5_notified_parties:
          '["Demo Clinical Lead (MHTCM)","Demo Clinical Director (Clinical Director)","Synthetic Youth 011 (Guardian)"]',
        step5_notified_at: "2026-07-01T18:30:00Z",
        step6_documented: 1,
        step6_documented_at: "2026-07-01T19:00:00Z",
        step6_documentation_ref: "Incident Report #2026-0701-004",
        step7_reviewed: 0,
        step7_reviewed_at: null,
        step7_reviewed_by: null,
        step7_review_notes: null,
        current_step: 7,
        overall_status: "under_review",
        youth_injured: 0,
        staff_injured: 0,
        restrictive_intervention_used: 0,
        restrictive_intervention_type: "none",
        created_at: "2026-07-01T18:15:00Z",
      },
      {
        id: "cr2",
        youth_id: "y1",
        youth_name: "Synthetic Youth 001",
        mrn: "SYNTH-BHC-001",
        crisis_type: "suicide_self_harm",
        step1_identified: 1,
        step1_identified_at: "2026-05-10T02:30:00Z",
        step1_identified_by: "Night RCS",
        step2_activated: 1,
        step2_activated_at: "2026-05-10T02:32:00Z",
        step2_activated_by: "Night RCS",
        step3_responded: 1,
        step3_responded_at: "2026-05-10T02:35:00Z",
        step3_responder_name: "Night RCS + On-call Clinician",
        step3_response_actions:
          '["Safety check initiated","1:1 supervision implemented","Crisis assessment completed","Safety plan reviewed"]',
        step4_ensured_safety: 1,
        step4_safety_measures:
          "Continuous 1:1 supervision. All sharps removed from room. Safety plan activated.",
        step4_ensured_at: "2026-05-10T02:40:00Z",
        step5_notified: 1,
        step5_notified_parties:
          '["Demo Clinical Director (Clinical Director)","Demo Clinical Lead (MHTCM)","Synthetic Guardian 01 (Guardian)"]',
        step5_notified_at: "2026-05-10T03:00:00Z",
        step6_documented: 1,
        step6_documented_at: "2026-05-10T06:00:00Z",
        step6_documentation_ref: "Incident Report #2026-0510-001",
        step7_reviewed: 1,
        step7_reviewed_at: "2026-05-11T10:00:00Z",
        step7_reviewed_by: "Demo Clinical Director",
        step7_review_notes:
          "Post-incident review completed. Trigger: anniversary of parental separation. Adjusted safety plan. Increased 1:1 therapy sessions.",
        current_step: 8,
        overall_status: "resolved",
        youth_injured: 0,
        staff_injured: 0,
        restrictive_intervention_used: 0,
        restrictive_intervention_type: "none",
        created_at: "2026-05-10T02:30:00Z",
      },
    ];
  if (procedure === "m17.getCrisis")
    return {
      id: "cr1",
      youth_id: "y4",
      youth_name: "Synthetic Youth 002",
      mrn: "SYNTH-BHC-004",
      crisis_type: "behavioral_escalation",
      step1_identified: 1,
      step1_identified_at: "2026-07-01T18:15:00Z",
      step1_identified_by: "Synthetic Staff 02",
      step2_activated: 1,
      step2_activated_at: "2026-07-01T18:18:00Z",
      step2_activated_by: "Synthetic Staff 02",
      step3_responded: 1,
      step3_responded_at: "2026-07-01T18:20:00Z",
      step3_responder_name: "Synthetic Staff 02 + Synthetic Staff 01",
      step3_response_actions:
        '["Verbal de-escalation","Removed from dining area","Offered quiet space","PRN offered"]',
      step4_ensured_safety: 1,
      step4_safety_measures:
        "Youth in quiet room with 1:1 staff supervision. Other youth redirected. No injuries.",
      step4_ensured_at: "2026-07-01T18:25:00Z",
      step5_notified: 1,
      step5_notified_parties:
        '["Demo Clinical Lead (MHTCM)","Demo Clinical Director (Clinical Director)","Synthetic Youth 011 (Guardian)"]',
      step5_notified_at: "2026-07-01T18:30:00Z",
      step6_documented: 1,
      step6_documented_at: "2026-07-01T19:00:00Z",
      step6_documentation_ref: "Incident Report #2026-0701-004",
      step7_reviewed: 0,
      step7_reviewed_at: null,
      step7_reviewed_by: null,
      step7_review_notes: null,
      current_step: 7,
      overall_status: "under_review",
      youth_injured: 0,
      staff_injured: 0,
      restrictive_intervention_used: 0,
      restrictive_intervention_type: "none",
      debrief: {
        id: "db1",
        crisis_event_id: "cr1",
        youth_id: "y4",
        youth_name: "Synthetic Youth 002",
        field1_event_summary:
          "During lunch, Synthetic-Person-002 became verbally aggressive toward a peer who accidentally bumped her tray. She yelled, threw her food, and threatened to 'make them pay.' Staff immediately intervened with verbal de-escalation. Synthetic-Person-002 was escorted to a quiet space. PRN was offered and accepted.",
        field2_triggers_identified:
          "Physical contact (accidental bump), crowded dining environment, sensory overload from noise.",
        field3_early_warning_signs:
          "Synthetic-Person-002 had been isolating since morning (missed breakfast, declined group activity). She was seen pacing in hallway before lunch.",
        field4_interventions_used:
          "Verbal de-escalation, physical space removal, PRN medication, 1:1 supervision, quiet room.",
        field5_what_worked:
          "Quick staff response prevented physical altercation. Synthetic-Person-002 responded well to quiet space. PRN helped her calm within 30 minutes.",
        field6_what_did_not_work:
          "Synthetic-Person-002 did not respond to initial verbal redirection. Required physical escort which she initially resisted.",
        field7_youth_perspective:
          "Synthetic-Person-002 stated: 'I just got mad. Everyone is always in my way. I don't want to be here.' She acknowledged she 'overreacted' but felt 'nobody understands.'",
        field8_staff_perspective:
          "Synthetic Staff 02: Synthetic-Person-002's isolation pattern preceded the incident. Recommend earlier intervention when youth shows isolation behaviors. Synthetic Staff 01: Dining room may be too stimulating for Synthetic-Person-002 during high-stress periods.",
        field9_plan_adjustments:
          "1. Modified meal schedule: Synthetic-Person-002 eats in smaller group or 15 min earlier. 2. Daily check-in with MHTCM before lunch. 3. Sensory coping kit accessible. 4. Review safety plan with Synthetic-Person-002.",
        safety_plan_updated: 1,
        safety_plan_changes:
          "Added dining-specific triggers. Modified response: early intervention when isolation observed. Added sensory coping strategies.",
        follow_up_required: 1,
        follow_up_actions:
          "1:1 therapy session 7/2, Guardian notification call, Peer mediation when ready",
        follow_up_date: "2026-07-02",
        completed_by: "Demo Clinical Director",
        completed_by_id: "u2",
        completed_at: "2026-07-01T22:00:00Z",
        reviewed_by: "Demo Clinical Director",
        reviewed_at: "2026-07-02T09:00:00Z",
      },
      created_at: "2026-07-01T18:15:00Z",
    };
  if (procedure === "m17.crisisSummary")
    return {
      activeCrises: 1,
      resolvedToday: 0,
      underReview: 1,
      totalThisMonth: 2,
      byType: [
        { crisis_type: "behavioral_escalation", c: 1 },
        { crisis_type: "suicide_self_harm", c: 1 },
      ],
    };
  if (procedure === "m17.getDebrief")
    return {
      id: "db1",
      crisis_event_id: "cr1",
      youth_id: "y4",
      youth_name: "Synthetic Youth 002",
      field1_event_summary:
        "During lunch, Synthetic-Person-002 became verbally aggressive toward a peer who accidentally bumped her tray. She yelled, threw her food, and threatened to 'make them pay.' Staff immediately intervened with verbal de-escalation. Synthetic-Person-002 was escorted to a quiet space. PRN was offered and accepted.",
      field2_triggers_identified:
        "Physical contact (accidental bump), crowded dining environment, sensory overload from noise.",
      field3_early_warning_signs:
        "Synthetic-Person-002 had been isolating since morning (missed breakfast, declined group activity). She was seen pacing in hallway before lunch.",
      field4_interventions_used:
        "Verbal de-escalation, physical space removal, PRN medication, 1:1 supervision, quiet room.",
      field5_what_worked:
        "Quick staff response prevented physical altercation. Synthetic-Person-002 responded well to quiet space. PRN helped her calm within 30 minutes.",
      field6_what_did_not_work:
        "Synthetic-Person-002 did not respond to initial verbal redirection. Required physical escort which she initially resisted.",
      field7_youth_perspective:
        "Synthetic-Person-002 stated: 'I just got mad. Everyone is always in my way. I don't want to be here.' She acknowledged she 'overreacted' but felt 'nobody understands.'",
      field8_staff_perspective:
        "Synthetic Staff 02: Synthetic-Person-002's isolation pattern preceded the incident. Recommend earlier intervention when youth shows isolation behaviors. Synthetic Staff 01: Dining room may be too stimulating for Synthetic-Person-002 during high-stress periods.",
      field9_plan_adjustments:
        "1. Modified meal schedule: Synthetic-Person-002 eats in smaller group or 15 min earlier. 2. Daily check-in with MHTCM before lunch. 3. Sensory coping kit accessible. 4. Review safety plan with Synthetic-Person-002.",
      safety_plan_updated: 1,
      safety_plan_changes:
        "Added dining-specific triggers. Modified response: early intervention when isolation observed. Added sensory coping strategies.",
      follow_up_required: 1,
      follow_up_actions:
        "1:1 therapy session 7/2, Guardian notification call, Peer mediation when ready",
      follow_up_date: "2026-07-02",
      completed_by: "Demo Clinical Director",
      completed_by_id: "u2",
      completed_at: "2026-07-01T22:00:00Z",
      reviewed_by: "Demo Clinical Director",
      reviewed_at: "2026-07-02T09:00:00Z",
    };

  // ─── M18/M19 ENDPOINTS (M16 Residential/Med — Sprint 2) ──
  if (procedure === "m18.getBedCensus") return store.beds;
  if (procedure === "m18.residentialSummary") return getResidentialSummary();
  if (procedure === "m18.listShifts") return store.shifts;
  if (procedure === "m18.listBehavioralObs") return store.behavioralObs;
  if (procedure === "m18.listFamilyContacts") return store.familyContacts;
  if (procedure === "m19.medSummary") return getMedSummary();
  if (procedure === "m19.listMedications") return store.medications;

  // ─── M20 ENDPOINTS (M17 Authorization — Sprint 2) ────────
  if (procedure === "m19.listFacilities")
    return [
      {
        id: "f1",
        name: "Adolbi Care GRO Campus",
        type: "residential",
        address: "1423 Cypress Lane, Houston, TX 77001",
        bedsTotal: 48,
        bedsOccupied: 16,
        managerName: "Synthetic Staff 01",
        phone: "(713) 555-2000",
        status: "active",
      },
      {
        id: "f2",
        name: "Adolbi Care BHC",
        type: "outpatient",
        address: "2500 Main Street, Houston, TX 77002",
        bedsTotal: 0,
        bedsOccupied: 0,
        managerName: "Demo Clinical Director",
        phone: "(713) 555-2100",
        status: "active",
      },
    ];
  if (procedure === "m19.getCampusSummary")
    return {
      totalFacilities: 2,
      totalBeds: 48,
      occupiedBeds: 16,
      availableBeds: 32,
      occupancyRate: 33,
      youthCount: 16,
      staffCount: 18,
      todaysMedications: 34,
      pendingObservations: 3,
    };
  if (procedure === "m20.listAuthorizations")
    return [
      {
        id: "a1",
        youth_id: "y1",
        youth_name: "Synthetic Youth 001",
        mrn: "SYNTH-BHC-001",
        payer_name: "Texas Medicaid",
        policy_number: "TXM-88765432",
        stage: "tracking",
        status: "approved",
        authorization_number: "AUTH-TXM-2026-00415",
        approved_units: 180,
        approved_from_date: "2026-04-01",
        approved_to_date: "2026-09-28",
        approved_level_of_care: "Residential",
        readiness_clinical_docs: 1,
        readiness_assessment_current: 1,
        readiness_loc_supported: 1,
        readiness_treatment_plan: 1,
        readiness_progress_notes: 1,
        readiness_medical_necessity: 1,
        readiness_utilization_review: 1,
        readiness_guardian_consent: 1,
        readiness_ub04_clean: 1,
        readiness_excluded_services: 1,
        readiness_met_at: "2026-03-28T10:00:00Z",
        submission_date: "2026-03-28",
        submitted_by: "Demo Clinical Lead",
        submission_method: "portal",
        submission_reference: "REF-2026-0328-001",
        denial_reason: null,
        appeal_date: null,
        appeal_status: null,
        reauth_due_date: "2026-09-14",
        reauth_status: "upcoming",
        days_until_expiration: 74,
        retrospective_review_date: null,
        billing_excluded_services: "[]",
        exclusion_controls_applied: "[]",
        created_at: "2026-03-15T09:00:00Z",
      },
      {
        id: "a2",
        youth_id: "y2",
        youth_name: "Synthetic Youth 005",
        mrn: "SYNTH-BHC-002",
        payer_name: "BCBS TX",
        policy_number: "BCBS-4455123",
        stage: "tracking",
        status: "approved",
        authorization_number: "AUTH-BCBS-2026-00288",
        approved_units: 120,
        approved_from_date: "2026-04-15",
        approved_to_date: "2026-08-13",
        approved_level_of_care: "Residential",
        readiness_clinical_docs: 1,
        readiness_assessment_current: 1,
        readiness_loc_supported: 1,
        readiness_treatment_plan: 1,
        readiness_progress_notes: 1,
        readiness_medical_necessity: 1,
        readiness_utilization_review: 1,
        readiness_guardian_consent: 1,
        readiness_ub04_clean: 1,
        readiness_excluded_services: 1,
        readiness_met_at: "2026-04-12T14:00:00Z",
        submission_date: "2026-04-12",
        submitted_by: "Demo Clinical Lead",
        submission_method: "fax",
        submission_reference: "REF-2026-0412-002",
        denial_reason: null,
        appeal_date: null,
        appeal_status: null,
        reauth_due_date: "2026-07-30",
        reauth_status: "upcoming",
        days_until_expiration: 28,
        retrospective_review_date: null,
        billing_excluded_services: "[]",
        exclusion_controls_applied: "[]",
        created_at: "2026-04-01T10:00:00Z",
      },
      {
        id: "a3",
        youth_id: "y3",
        youth_name: "Synthetic Youth 007",
        mrn: "SYNTH-BHC-003",
        payer_name: "Texas Medicaid",
        policy_number: "TXM-99123456",
        stage: "readiness",
        status: "pending",
        readiness_clinical_docs: 1,
        readiness_assessment_current: 1,
        readiness_loc_supported: 0,
        readiness_treatment_plan: 0,
        readiness_progress_notes: 1,
        readiness_medical_necessity: 0,
        readiness_utilization_review: 0,
        readiness_guardian_consent: 1,
        readiness_ub04_clean: 0,
        readiness_excluded_services: 0,
        readiness_met_at: null,
        submission_date: null,
        submitted_by: null,
        submission_method: null,
        submission_reference: null,
        denial_reason: null,
        appeal_date: null,
        appeal_status: null,
        reauth_due_date: null,
        reauth_status: "not_due",
        days_until_expiration: null,
        retrospective_review_date: null,
        billing_excluded_services: "[]",
        exclusion_controls_applied: "[]",
        created_at: "2026-06-29T09:00:00Z",
      },
      {
        id: "a4",
        youth_id: "y4",
        youth_name: "Synthetic Youth 002",
        mrn: "SYNTH-BHC-004",
        payer_name: "Aetna Better Health",
        policy_number: "ABH-2233445",
        stage: "tracking",
        status: "appealed",
        authorization_number: "AUTH-ABH-2026-00112",
        approved_units: 90,
        approved_from_date: "2026-05-20",
        approved_to_date: "2026-08-18",
        approved_level_of_care: "Residential",
        readiness_clinical_docs: 1,
        readiness_assessment_current: 1,
        readiness_loc_supported: 1,
        readiness_treatment_plan: 1,
        readiness_progress_notes: 1,
        readiness_medical_necessity: 1,
        readiness_utilization_review: 1,
        readiness_guardian_consent: 1,
        readiness_ub04_clean: 1,
        readiness_excluded_services: 1,
        readiness_met_at: "2026-05-15T11:00:00Z",
        submission_date: "2026-05-15",
        submitted_by: "Demo Clinical Lead",
        submission_method: "portal",
        submission_reference: "REF-2026-0515-003",
        denial_reason:
          "Initial denial: insufficient medical necessity documentation for residential level. Peer reviewer recommended day treatment.",
        appeal_date: "2026-05-22",
        appeal_status: "under_review",
        reauth_due_date: null,
        reauth_status: "not_due",
        days_until_expiration: 47,
        retrospective_review_date: null,
        billing_excluded_services: "[]",
        exclusion_controls_applied: "[]",
        created_at: "2026-05-10T08:00:00Z",
      },
    ];
  if (procedure === "m20.authSummary")
    return {
      total: 4,
      pending: 1,
      approved: 2,
      denied: 0,
      appealed: 1,
      reauthOverdue: 0,
      upcomingExpiry: 2,
    };
  if (procedure === "m20.getFacilityMedications") return store.medications;

  // ─── M2.1 CCMG oversight (fictional evaluation fallback only) ────
  if (procedure === "m21.getOversightDashboard")
    return CCMG_SYNTHETIC_DASHBOARD;
  if (procedure === "m21.getReferralDetail")
    return getSyntheticCcmgReferralDetail(
      readDemoString(input, "referralId", "SYN-REF-ATLAS"),
    );

  // ─── Legacy M21 endpoints (Persona Activation + Chart Audit) ────
  if (procedure === "m21.listAudits")
    return [
      {
        id: "ca1",
        youth_id: "y1",
        youth_name: "Synthetic Youth 001",
        mrn: "SYNTH-BHC-001",
        audit_date: "2026-06-15",
        auditor_name: "Demo Clinical Director",
        area1_identifying_info: 1,
        area1_notes: "Complete",
        area2_consent_forms: 1,
        area2_notes: "All signed",
        area3_assessment_current: 1,
        area3_notes: "Governed assessment evidence reference reviewed",
        area4_treatment_plan: 1,
        area4_notes: "Current, signed 6/1",
        area5_progress_notes: 1,
        area5_notes: "Weekly notes current",
        area6_medication_records: 1,
        area6_notes: "MAR complete, no discrepancies",
        area7_safety_plans: 1,
        area7_notes: "Updated post-incident 5/11",
        area8_incident_reports: 1,
        area8_notes: "IR #2026-0510-001 complete with debrief",
        area9_authorization_billing: 1,
        area9_notes: "Auth TXM-00415 active thru 9/28",
        areas_passed: 9,
        areas_total: 9,
        overall_result: "pass",
        corrective_actions: null,
        follow_up_date: null,
        created_at: "2026-06-15T10:00:00Z",
      },
      {
        id: "ca2",
        youth_id: "y4",
        youth_name: "Synthetic Youth 002",
        mrn: "SYNTH-BHC-004",
        audit_date: "2026-07-01",
        auditor_name: "Demo Clinical Lead",
        area1_identifying_info: 1,
        area1_notes: "Complete",
        area2_consent_forms: 1,
        area2_notes: "Guardian consent on file",
        area3_assessment_current: 1,
        area3_notes: "Intake assessment 6/29",
        area4_treatment_plan: 0,
        area4_notes: "Draft only — awaiting clinician sign-off",
        area5_progress_notes: 1,
        area5_notes: "Daily behavioral tracking current",
        area6_medication_records: 1,
        area6_notes: "MAR current, PRN documented",
        area7_safety_plans: 0,
        area7_notes: "Safety plan outdated — pre-dates 7/1 incident",
        area8_incident_reports: 1,
        area8_notes: "IR #2026-0701-004 filed, debrief complete",
        area9_authorization_billing: 0,
        area9_notes: "Appeal pending — no auth number yet",
        areas_passed: 6,
        areas_total: 9,
        overall_result: "pass_with_notes",
        corrective_actions:
          "1. Complete treatment plan by 7/5\n2. Update safety plan per debrief findings\n3. Follow up on appeal status",
        follow_up_date: "2026-07-08",
        created_at: "2026-07-01T16:00:00Z",
      },
    ];
  if (procedure === "m21.listPersonas")
    return [
      {
        id: "amos-prime",
        name: "AMOS-Prime",
        code: "AP",
        description:
          "Executive orchestration persona. Top-level task routing, cross-system coordination, and strategic synthesis.",
        status: "inactive",
        wave: "wave3",
        category: "Executive",
        permissions: ["all_read", "routing_write"],
        outputs: ["memos", "decisions", "alerts"],
        activatedAt: null,
        sortOrder: 1,
      },
      {
        id: "amos-core",
        name: "AMOS-Core",
        code: "AC",
        description:
          "Universal operational backbone. Dashboard aggregation, notification routing, cross-module search.",
        status: "active",
        wave: "pilot",
        category: "Core",
        permissions: ["all_read", "ops_write"],
        outputs: ["dashboards", "alerts", "search_results"],
        activatedAt: "2026-01-01T00:00:00Z",
        sortOrder: 2,
      },
      {
        id: "amos-nxl",
        name: "AMOS-NXL",
        code: "ANXL",
        description:
          "Narrative intelligence engine. Generates operational narratives, trend explanations, and executive briefings.",
        status: "inactive",
        wave: "wave3",
        category: "Intelligence",
        permissions: ["analytics_read", "narrative_write"],
        outputs: ["briefings", "narratives"],
        activatedAt: null,
        sortOrder: 3,
      },
      {
        id: "amos-thesis",
        name: "AMOS-THESIS",
        code: "AT",
        description:
          "Research and evidence synthesis. Academic literature review, regulatory research.",
        status: "inactive",
        wave: "wave3",
        category: "Research",
        permissions: ["research_read", "synthesis_write"],
        outputs: ["reports", "literature_reviews"],
        activatedAt: null,
        sortOrder: 4,
      },
      {
        id: "amos-dms",
        name: "AMOS-DMS",
        code: "ADMS",
        description:
          "Document management specialist. Document lifecycle, template generation, packet assembly.",
        status: "inactive",
        wave: "wave3",
        category: "Documents",
        permissions: ["documents_read", "dms_write"],
        outputs: ["documents", "packets", "templates"],
        activatedAt: null,
        sortOrder: 5,
      },
      {
        id: "amos-sentinel",
        name: "AMOS-Sentinel",
        code: "ASENT",
        description:
          "QA and compliance guardian. Audit readiness, CAP tracking, deficiency monitoring.",
        status: "active",
        wave: "pilot",
        category: "Compliance",
        permissions: ["qa_read", "audit_write"],
        outputs: ["audits", "cap_plans"],
        activatedAt: "2026-01-01T00:00:00Z",
        sortOrder: 6,
      },
      {
        id: "amos-scribe",
        name: "AMOS-Scribe",
        code: "ASCR",
        description:
          "Document production engine. Branded DOCX/PDF/Excel generation, template library.",
        status: "active",
        wave: "pilot",
        category: "Documents",
        permissions: ["documents_read", "studio_write"],
        outputs: ["documents", "presentations"],
        activatedAt: "2026-01-01T00:00:00Z",
        sortOrder: 7,
      },
      {
        id: "amos-clinical",
        name: "AMOS-Clinical",
        code: "ACL",
        description:
          "Clinical operations specialist. BHC care delivery and governed assessment workflow support.",
        status: "active",
        wave: "pilot",
        category: "Clinical",
        permissions: ["clinical_read", "clinical_write"],
        outputs: ["assessments", "treatment_plans"],
        activatedAt: "2026-01-01T00:00:00Z",
        sortOrder: 8,
      },
      {
        id: "amos-gro",
        name: "AMOS-GRO",
        code: "AGRO",
        description:
          "Residential operations specialist. GRO shift management, youth care logs, behavioral observations.",
        status: "active",
        wave: "pilot",
        category: "Residential",
        permissions: ["gro_read", "gro_write"],
        outputs: ["shift_logs", "observations"],
        activatedAt: "2026-01-01T00:00:00Z",
        sortOrder: 9,
      },
      {
        id: "amos-revenue",
        name: "AMOS-Revenue",
        code: "AREV",
        description:
          "Revenue cycle specialist. Authorizations, claims management, billing readiness.",
        status: "active",
        wave: "pilot",
        category: "Revenue",
        permissions: ["revenue_read", "billing_write"],
        outputs: ["claims", "authorizations"],
        activatedAt: "2026-01-01T00:00:00Z",
        sortOrder: 10,
      },
      {
        id: "amos-hr",
        name: "AMOS-HR",
        code: "AHR",
        description:
          "Human resources specialist. Onboarding workflow, credential tracking, training assignments.",
        status: "inactive",
        wave: "wave1",
        category: "HR",
        permissions: ["hr_read", "hr_write"],
        outputs: ["onboarding_plans", "credentials_reports"],
        activatedAt: null,
        sortOrder: 11,
      },
      {
        id: "amos-coach",
        name: "AMOS-Coach",
        code: "ACOACH",
        description:
          "Training and coaching facilitator. Staff development, competency tracking.",
        status: "inactive",
        wave: "wave2",
        category: "Training",
        permissions: ["training_read", "coaching_write"],
        outputs: ["training_plans", "competency_assessments"],
        activatedAt: null,
        sortOrder: 12,
      },
      {
        id: "amos-strategy",
        name: "AMOS-Strategy",
        code: "ASTRAT",
        description:
          "Strategic planning analyst. Growth initiatives, market analysis, board reporting.",
        status: "inactive",
        wave: "wave2",
        category: "Strategy",
        permissions: ["executive_read", "strategy_write"],
        outputs: ["strategic_plans", "risk_registers"],
        activatedAt: null,
        sortOrder: 13,
      },
    ];
  if (procedure === "m21.getActivationStatus")
    return {
      total: 13,
      active: 6,
      inactive: 7,
      byWave: {
        pilot: { active: 6, inactive: 0 },
        wave1: { active: 0, inactive: 1 },
        wave2: { active: 0, inactive: 2 },
        wave3: { active: 0, inactive: 4 },
      },
    };
  // ─── M29: NIL Knowledge Graph ────────────────────────────
  if (procedure === "m29.search")
    return [
      {
        id: "y4",
        type: "youth",
        title: "Synthetic Youth 002",
        subtitle: "SYNTH-BHC-004 • Age 17 • Crisis Stabilization",
        module: "Clinical",
        status: "hold",
        lastUpdated: "2026-07-01",
        tags: ["behavioral", "peer-conflict", "safety-plan"],
        score: 28,
      },
      {
        id: "ir-0701",
        type: "incident",
        title: "Peer Conflict — Synthetic Youth 002",
        subtitle: "2026-07-01 14:30 • Moderate severity • Resolved",
        module: "Compliance",
        status: "resolved",
        lastUpdated: "2026-07-01",
        tags: ["behavioral", "peer-conflict", "Synthetic-Person-002-Thompson"],
        score: 22,
      },
      {
        id: "ca-0701",
        type: "chart_audit",
        title: "Chart Audit — Synthetic Youth 002",
        subtitle:
          "Auditor: Demo Clinical Lead • 6/9 areas passed • Pass with notes",
        module: "Compliance",
        status: "pass_with_notes",
        lastUpdated: "2026-07-01",
        tags: ["audit", "Synthetic-Person-002-Thompson", "deficiency"],
        score: 18,
      },
    ];
  if (procedure === "m29.getRelationships")
    return [
      {
        relationship: {
          from: "y4",
          to: "ir-0701",
          type: "involved_in",
          label: "involved in",
        },
        entity: {
          id: "ir-0701",
          type: "incident",
          title: "Peer Conflict — Synthetic Youth 002",
          subtitle: "2026-07-01 14:30 • Moderate",
          module: "Compliance",
          status: "resolved",
          lastUpdated: "2026-07-01",
          tags: ["behavioral"],
          relevance: 0.85,
        },
        direction: "outgoing" as const,
      },
      {
        relationship: {
          from: "y4",
          to: "ca-0701",
          type: "audited",
          label: "subject of",
        },
        entity: {
          id: "ca-0701",
          type: "chart_audit",
          title: "Chart Audit — Synthetic Youth 002",
          subtitle: "6/9 passed • Pass with notes",
          module: "Compliance",
          status: "pass_with_notes",
          lastUpdated: "2026-07-01",
          tags: ["audit"],
          relevance: 0.82,
        },
        direction: "outgoing" as const,
      },
    ];
  if (procedure === "m29.getEntity")
    return {
      id: "y4",
      type: "youth",
      title: "Synthetic Youth 002",
      subtitle: "SYNTH-BHC-004 • Age 17 • Crisis Stabilization",
      module: "Clinical",
      status: "hold",
      lastUpdated: "2026-07-01",
      tags: ["behavioral", "peer-conflict", "safety-plan"],
      relevance: 1,
    };
  if (procedure === "m29.getRelated")
    return [
      {
        id: "ir-0701",
        type: "incident",
        title: "Peer Conflict — Synthetic Youth 002",
        subtitle: "2026-07-01 14:30 • Moderate",
        module: "Compliance",
        status: "resolved",
        lastUpdated: "2026-07-01",
        tags: ["behavioral"],
        relevance: 0.7,
      },
      {
        id: "ca-0701",
        type: "chart_audit",
        title: "Chart Audit — Synthetic Youth 002",
        subtitle: "6/9 passed",
        module: "Compliance",
        status: "pass_with_notes",
        lastUpdated: "2026-07-01",
        tags: ["audit"],
        relevance: 0.7,
      },
    ];
  if (procedure === "m29.typeahead")
    return [
      { id: "y1", title: "Synthetic Youth 001", type: "youth", module: "Clinical" },
      {
        id: "y2",
        title: "Synthetic Youth 005",
        type: "youth",
        module: "Clinical",
      },
      { id: "y3", title: "Synthetic Youth 007", type: "youth", module: "Clinical" },
      { id: "y4", title: "Synthetic Youth 002", type: "youth", module: "Clinical" },
    ];
  if (procedure === "m29.stats")
    return {
      totalEntities: 20,
      totalRelationships: 16,
      byType: {
        youth: 4,
        incident: 3,
        chart_audit: 1,
        treatment_plan: 2,
        medication_order: 2,
        work_order: 2,
        authorization: 1,
        document: 1,
        sop: 2,
        cap: 2,
      },
      byModule: {
        Clinical: 7,
        Compliance: 5,
        Residential: 4,
        GAD: 2,
        Revenue: 3,
      },
    };
  if (procedure === "ping") return { ok: true, ts: Date.now() };

  // ═══════════════════════════════════════════════════════════════
  // AUDIT FIX: Seed data for previously empty endpoints
  // ═══════════════════════════════════════════════════════════════

  // ─── QA & Compliance ───
  if (procedure === "qa.listAudits") return store.audits;
  if (procedure === "qa.listIncidents") return store.incidents;
  if (procedure === "qa.listCorrectiveActions")
    return store.tasks
      .filter((t) => t.category === "documentation")
      .map((t) => ({
        id: t.id,
        title: t.title,
        assignedTo: t.assignee,
        dueDate: "2026-07-15",
        status: t.status,
        priority: t.priority,
      }));

  // ─── GAD / Facilities ───
  if (procedure === "gad.listWorkOrders") return store.workOrders;

  // ─── Clinical / BHC ───
  if (procedure === "bhc.listPlans")
    return store.youth
      .filter((y) => y.status === "active")
      .map((y) => ({
        id: `tp-${y.id}`,
        youthName: y.first_name + " " + y.last_name,
        mrn: y.mrn,
        clinician: y.assigned_clinician_name,
        createdDate: y.admission_date,
        reviewDate: "2026-07-15",
        status: "active",
        goals: Math.floor(Math.random() * 5) + 2,
        objectives: Math.floor(Math.random() * 10) + 5,
      }));
  if (procedure === "bhc.listSessions") return store.sessions;
  if (procedure === "bhc.clinicianWorkload")
    return {
      total: store.sessions.length,
      byClinician: [
        {
          name: "Demo Clinical Director",
          assignedYouth: store.youth.filter(
            (y) => y.assigned_clinician_name === "Demo Clinical Director",
          ).length,
          sessionsThisWeek: store.sessions.filter(
            (s) => s.clinician === "Demo Clinical Director",
          ).length,
          pendingNotes: 3,
        },
        {
          name: "Demo Clinical Lead",
          assignedYouth: store.youth.filter(
            (y) => y.assigned_clinician_name === "Demo Clinical Lead",
          ).length,
          sessionsThisWeek: store.sessions.filter(
            (s) => s.clinician === "Demo Clinical Lead",
          ).length,
          pendingNotes: 2,
        },
      ],
    };

  // ─── GRO / Referrals ───
  if (procedure === "gro.listReferrals") return store.referrals;

  // ─── HR ───
  if (procedure === "hr.getModuleStatuses")
    return [
      {
        moduleId: "onboarding",
        moduleName: "New Hire Onboarding",
        total: 3,
        completed: 2,
        inProgress: 1,
        notStarted: 0,
      },
      {
        moduleId: "training",
        moduleName: "Annual Training",
        total: 12,
        completed: 8,
        inProgress: 2,
        notStarted: 2,
      },
      {
        moduleId: "credentials",
        moduleName: "Credential Verification",
        total: 6,
        completed: 5,
        inProgress: 1,
        notStarted: 0,
      },
      {
        moduleId: "compliance",
        moduleName: "Compliance Acknowledgments",
        total: 4,
        completed: 3,
        inProgress: 1,
        notStarted: 0,
      },
    ];
  if (procedure === "hr.listTransitions")
    return [
      {
        id: "t1",
        employeeName: "James Wright",
        fromRole: "RCS",
        toRole: "RCS Lead",
        transitionDate: "2026-07-01",
        status: "completed",
        approvedBy: "Demo Executive",
      },
      {
        id: "t2",
        employeeName: "Synthetic Staff 05",
        fromRole: "Per Diem",
        toRole: "Full-Time RCS",
        transitionDate: "2026-07-05",
        status: "in_progress",
        approvedBy: "HR Director",
      },
      {
        id: "t3",
        employeeName: "Kevin Brooks",
        fromRole: "Nurse Aide",
        toRole: "RN",
        transitionDate: "2026-07-15",
        status: "scheduled",
        approvedBy: "HR Director",
      },
      {
        id: "t4",
        employeeName: "Tanya Reyes",
        fromRole: "RCS",
        toRole: "Night Lead",
        transitionDate: "2026-07-10",
        status: "pending_approval",
        approvedBy: "Pending",
      },
    ];

  // ─── Workflow ───
  if (procedure === "workflow.listInstances") return store.workflows;
  if (procedure === "workflow.listPendingApprovals") return store.approvals;
  if (procedure === "workflow.auditLog")
    return [
      {
        id: "al1",
        action: "Workflow Started",
        target: "New Hire Onboarding",
        actor: "HR Director",
        timestamp: "2026-06-28T09:00:00Z",
      },
      {
        id: "al2",
        action: "Step Completed",
        target: "Background Check",
        actor: "System",
        timestamp: "2026-06-29T14:00:00Z",
      },
      {
        id: "al3",
        action: "Approval Requested",
        target: "Night Lead Transition",
        actor: "Tanya Reyes",
        timestamp: "2026-07-01T10:00:00Z",
      },
      {
        id: "al4",
        action: "CAP Created",
        target: "MAR Documentation",
        actor: "Synthetic Nurse 01",
        timestamp: "2026-06-15T11:00:00Z",
      },
    ];

  // ─── NIL / Knowledge Graph ───
  if (procedure === "nil.searchEntities")
    return store.youth
      .slice(0, 5)
      .map((y) => ({
        id: y.id,
        label: y.first_name + " " + y.last_name,
        type: "youth",
        sourceModule: "Clinical",
        confidence: 1.0,
      }))
      .concat(
        store.medications.slice(0, 3).map((m) => ({
          id: m.id,
          label: m.medication_name + " " + m.dosage,
          type: "medication",
          sourceModule: "MAR",
          confidence: 0.95,
        })),
      );
  if (procedure === "nil.getRecommendations")
    return [
      {
        id: "rec1",
        title: "Update Safety Plan for Synthetic Youth 002",
        type: "action",
        priority: "high",
        source: "Behavioral Pattern Analysis",
      },
      {
        id: "rec2",
        title: "Schedule Family Therapy — Synthetic Youth 001",
        type: "appointment",
        priority: "medium",
        source: "Treatment Plan Review",
      },
      {
        id: "rec3",
        title: "Review PRN Usage — Synthetic Youth 002",
        type: "review",
        priority: "medium",
        source: "Medication Trend Alert",
      },
      {
        id: "rec4",
        title: "Staff De-escalation Training",
        type: "training",
        priority: "low",
        source: "Incident Pattern Analysis",
      },
    ];

  // ═══════════════════════════════════════════════════════════════
  // COMPREHENSIVE DEMO DATA SEED — All module endpoints
  // ═══════════════════════════════════════════════════════════════

  // ─── TIER 1: BHC Clinical ───
  if (procedure === "bhc.dashboardKPIs")
    return {
      activePatients: 15,
      sessionsThisWeek: 42,
      totalPatients: 28,
      pendingApprovals: 3,
      highRiskCount: 2,
      newReferrals: 5,
      dischargedThisMonth: 3,
    };
  if (procedure === "bhc.patients")
    return {
      patients: [
        {
          id: "p1",
          firstName: "Synthetic-Person-001",
          lastName: "Johnson",
          dateOfBirth: "2010-03-15",
          status: "active",
          gender: "Male",
          insuranceId: "INS001",
          assignedClinician: "Demo Clinical Director",
        },
        {
          id: "p2",
          firstName: "Synthetic-Person-003",
          lastName: "Williams",
          dateOfBirth: "2011-07-22",
          status: "active",
          gender: "Female",
          insuranceId: "INS002",
          assignedClinician: "Demo Clinical Lead",
        },
        {
          id: "p3",
          firstName: "Synthetic-Person-004",
          lastName: "Ramirez",
          dateOfBirth: "2009-11-08",
          status: "active",
          gender: "Male",
          insuranceId: "INS003",
          assignedClinician: "Demo Clinical Director",
        },
        {
          id: "p4",
          firstName: "Synthetic-Person-005",
          lastName: "Peterson",
          dateOfBirth: "2008-05-20",
          status: "active",
          gender: "Female",
          insuranceId: "INS004",
          assignedClinician: "Demo Clinical Lead",
        },
        {
          id: "p5",
          firstName: "Synthetic-Person-006",
          lastName: "Brooks",
          dateOfBirth: "2010-09-14",
          status: "hold",
          gender: "Male",
          insuranceId: "INS005",
          assignedClinician: "Demo Case Manager",
        },
        {
          id: "p6",
          firstName: "Synthetic-Person-009",
          lastName: "Miller",
          dateOfBirth: "2011-02-28",
          status: "active",
          gender: "Male",
          insuranceId: "INS006",
          assignedClinician: "Demo Clinical Director",
        },
        {
          id: "p7",
          firstName: "Synthetic-Person-011",
          lastName: "Thompson",
          dateOfBirth: "2009-08-10",
          status: "active",
          gender: "Female",
          insuranceId: "INS007",
          assignedClinician: "Demo Clinical Lead",
        },
        {
          id: "p8",
          firstName: "Synthetic-Person-012",
          lastName: "Jackson",
          dateOfBirth: "2010-12-03",
          status: "pending",
          gender: "Male",
          insuranceId: "INS008",
          assignedClinician: "Demo Case Manager",
        },
      ],
    };
  if (procedure === "bhc.treatmentPlans")
    return {
      plans: [
        {
          id: "tp1",
          patientName: "Synthetic Youth 001",
          status: "active",
          startDate: "2026-04-01",
          goals: "4",
          completionPct: 65,
        },
        {
          id: "tp2",
          patientName: "Synthetic Youth 003",
          status: "active",
          startDate: "2026-04-15",
          goals: "5",
          completionPct: 45,
        },
        {
          id: "tp3",
          patientName: "Synthetic Youth 004",
          status: "active",
          startDate: "2026-05-01",
          goals: "6",
          completionPct: 30,
        },
        {
          id: "tp4",
          patientName: "Synthetic Youth 008",
          status: "active",
          startDate: "2026-05-20",
          goals: "4",
          completionPct: 55,
        },
        {
          id: "tp5",
          patientName: "Synthetic Youth 006",
          status: "pending_review",
          startDate: "2026-06-10",
          goals: "3",
          completionPct: 10,
        },
        {
          id: "tp6",
          patientName: "Synthetic Youth 009",
          status: "active",
          startDate: "2026-06-15",
          goals: "5",
          completionPct: 20,
        },
        {
          id: "tp7",
          patientName: "Synthetic Youth 011",
          status: "active",
          startDate: "2026-06-01",
          goals: "4",
          completionPct: 40,
        },
        {
          id: "tp8",
          patientName: "Synthetic Youth 012",
          status: "draft",
          startDate: "2026-06-25",
          goals: "3",
          completionPct: 0,
        },
      ],
    };
  if (procedure === "bhc.sessions")
    return {
      sessions: [
        {
          id: "s1",
          patientName: "Synthetic Youth 001",
          date: "2026-06-30",
          type: "Individual Therapy",
          status: "scheduled",
          duration: 60,
          notes: "CBT session focusing on trauma processing",
        },
        {
          id: "s2",
          patientName: "Synthetic Youth 003",
          date: "2026-06-30",
          type: "Group Therapy",
          status: "completed",
          duration: 90,
          notes: "DBT skills group - emotion regulation",
        },
        {
          id: "s3",
          patientName: "Synthetic Youth 004",
          date: "2026-06-29",
          type: "Family Session",
          status: "completed",
          duration: 60,
          notes: "Family engagement with mother",
        },
        {
          id: "s4",
          patientName: "Synthetic Youth 008",
          date: "2026-06-29",
          type: "Individual Therapy",
          status: "completed",
          duration: 60,
          notes: "Anxiety management techniques",
        },
        {
          id: "s5",
          patientName: "Synthetic Youth 006",
          date: "2026-06-28",
          type: "Psychosocial Rehab",
          status: "completed",
          duration: 45,
          notes: "Life skills training",
        },
        {
          id: "s6",
          patientName: "Synthetic Youth 009",
          date: "2026-06-30",
          type: "Intake Assessment",
          status: "scheduled",
          duration: 90,
          notes: "Initial clinical intake",
        },
        {
          id: "s7",
          patientName: "Synthetic Youth 011",
          date: "2026-06-28",
          type: "Individual Therapy",
          status: "completed",
          duration: 60,
          notes: "Mood monitoring and coping skills",
        },
        {
          id: "s8",
          patientName: "Synthetic Youth 001",
          date: "2026-06-28",
          type: "Case Management",
          status: "completed",
          duration: 30,
          notes: "Care coordination with school",
        },
        {
          id: "s9",
          patientName: "Synthetic Youth 012",
          date: "2026-07-01",
          type: "Initial Evaluation",
          status: "scheduled",
          duration: 60,
          notes: "First clinical contact",
        },
        {
          id: "s10",
          patientName: "Synthetic Youth 008",
          date: "2026-07-01",
          type: "Group Therapy",
          status: "scheduled",
          duration: 90,
          notes: "Social skills group",
        },
      ],
    };
  if (procedure === "bhc.outcomeMeasures")
    return {
      measures: [],
      governedAssessmentReference: {
        milestone: "M4.1C",
        disposition: M41C_EVALUATION_CLINICAL_FIXTURES_SANITIZED,
        rawLegacyScoresReturned: false,
        humanReviewRequired: true,
        productionRows: 0,
        liveWrites: 0,
      },
    };
  if (procedure === "bhc.insurancePlans")
    return {
      plans: [
        {
          id: "ip1",
          payerName: "Superior HealthPlan",
          planType: "Medicaid Managed Care",
          memberCount: 12,
          authRequired: true,
        },
        {
          id: "ip2",
          payerName: "Blue Cross Blue Shield TX",
          planType: "Commercial",
          memberCount: 8,
          authRequired: true,
        },
        {
          id: "ip3",
          payerName: "UnitedHealthcare Community",
          planType: "Medicaid Managed Care",
          memberCount: 5,
          authRequired: true,
        },
        {
          id: "ip4",
          payerName: "Aetna Better Health",
          planType: "Medicaid Managed Care",
          memberCount: 3,
          authRequired: true,
        },
      ],
    };
  if (procedure === "bhc.referrals")
    return {
      referrals: [
        {
          id: "ref1",
          youthName: "Synthetic Youth 009",
          referralDate: "2026-06-25",
          source: "Houston ISD",
          status: "active",
          assignedTo: "Demo Case Manager",
        },
        {
          id: "ref2",
          youthName: "Synthetic Youth 011",
          referralDate: "2026-06-22",
          source: "Texas CPS",
          status: "active",
          assignedTo: "Demo Clinical Lead",
        },
        {
          id: "ref3",
          youthName: "Synthetic Youth 012",
          referralDate: "2026-06-20",
          source: "Harris County JP",
          status: "pending",
          assignedTo: "Demo Clinical Director",
        },
        {
          id: "ref4",
          youthName: "Synthetic Youth 034",
          referralDate: "2026-06-18",
          source: "Family Self-Referral",
          status: "active",
          assignedTo: "Demo Case Manager",
        },
        {
          id: "ref5",
          youthName: "Synthetic Youth 039",
          referralDate: "2026-06-15",
          source: "Community Health Center",
          status: "converted",
          assignedTo: "Demo Clinical Lead",
        },
      ],
    };
  if (procedure === "bhc.cansAssessments")
    throw new Error(
      "M41C_LEGACY_CANS_LOGIC_QUARANTINED: use the governed Clinical Intelligence Fabric.",
    );
  if (procedure === "bhc.services")
    return {
      services: [
        {
          id: "sv1",
          serviceName: "Individual Therapy",
          patientName: "Synthetic Youth 001",
          date: "2026-06-30",
          units: 4,
          status: "authorized",
        },
        {
          id: "sv2",
          serviceName: "Group Therapy",
          patientName: "Synthetic Youth 003",
          date: "2026-06-29",
          units: 6,
          status: "authorized",
        },
        {
          id: "sv3",
          serviceName: "Family Session",
          patientName: "Synthetic Youth 004",
          date: "2026-06-29",
          units: 2,
          status: "authorized",
        },
        {
          id: "sv4",
          serviceName: "Case Management",
          patientName: "Synthetic Youth 001",
          date: "2026-06-28",
          units: 2,
          status: "billed",
        },
        {
          id: "sv5",
          serviceName: "Psychosocial Rehab",
          patientName: "Synthetic Youth 006",
          date: "2026-06-28",
          units: 3,
          status: "authorized",
        },
        {
          id: "sv6",
          serviceName: "Governed Assessment Review",
          patientName: "Synthetic Youth 009",
          date: "2026-06-25",
          units: 1,
          status: "completed",
        },
      ],
    };

  // ─── TIER 2: GRO Residential ───
  if (procedure === "gro.dashboardKPIs")
    return {
      activeResidents: 8,
      bedOccupancy: 85,
      totalBeds: 12,
      facilities: 1,
      incidentsThisMonth: 2,
      staffOnDuty: 6,
    };
  if (procedure === "gro.shiftLogs")
    return {
      logs: [
        {
          id: "sl1",
          shiftDate: "2026-06-30",
          shiftType: "Day",
          staffName: "Synthetic Staff 01",
          youthCount: 8,
          notes: "Normal operations. All meds administered on time.",
          status: "completed",
        },
        {
          id: "sl2",
          shiftDate: "2026-06-30",
          shiftType: "Evening",
          staffName: "Synthetic Staff 07",
          youthCount: 8,
          notes: "Quiet evening. Group activity completed.",
          status: "in_progress",
        },
        {
          id: "sl3",
          shiftDate: "2026-06-29",
          shiftType: "Night",
          staffName: "Tasha Williams",
          youthCount: 8,
          notes: "Uneventful night. Routine checks completed.",
          status: "completed",
        },
        {
          id: "sl4",
          shiftDate: "2026-06-29",
          shiftType: "Day",
          staffName: "Synthetic Staff 01",
          youthCount: 8,
          notes: "Behavioral incident at lunch resolved with de-escalation.",
          status: "completed",
        },
        {
          id: "sl5",
          shiftDate: "2026-06-28",
          shiftType: "Evening",
          staffName: "Robert Kim",
          youthCount: 8,
          notes: "Family visits scheduled. All youth accounted for.",
          status: "completed",
        },
      ],
    };
  if (procedure === "gro.safetyRounds")
    return {
      rounds: [
        {
          id: "sr1",
          roundDate: "2026-06-30",
          conductedBy: "Synthetic Staff 01",
          findings: "All clear. Fire extinguishers inspected. No hazards.",
          status: "completed",
          followUp: null,
        },
        {
          id: "sr2",
          roundDate: "2026-06-29",
          conductedBy: "Synthetic Staff 07",
          findings:
            "Minor issue: loose handrail on stair B. Maintenance notified.",
          status: "completed",
          followUp: "Repair scheduled 7/1",
        },
        {
          id: "sr3",
          roundDate: "2026-06-28",
          conductedBy: "Tasha Williams",
          findings:
            "Medication room secure. All logs current. Youth rooms clean.",
          status: "completed",
          followUp: null,
        },
      ],
    };
  if (procedure === "gro.careLogs")
    return {
      logs: [
        {
          id: "cl1",
          date: "2026-06-30",
          youthName: "Synthetic Youth 001",
          activity: "Morning hygiene",
          staffName: "Synthetic Staff 01",
          notes: "Completed independently. Good mood.",
        },
        {
          id: "cl2",
          date: "2026-06-30",
          youthName: "Synthetic Youth 003",
          activity: "Breakfast",
          staffName: "Synthetic Staff 01",
          notes: "Ate full meal. Engaged in conversation.",
        },
        {
          id: "cl3",
          date: "2026-06-30",
          youthName: "Synthetic Youth 004",
          activity: "School work",
          staffName: "Synthetic Staff 07",
          notes: "Completed math assignment with assistance.",
        },
        {
          id: "cl4",
          date: "2026-06-29",
          youthName: "Synthetic Youth 008",
          activity: "Recreation",
          staffName: "Tasha Williams",
          notes: "Participated in group art activity.",
        },
        {
          id: "cl5",
          date: "2026-06-29",
          youthName: "Synthetic Youth 006",
          activity: "Evening routine",
          staffName: "Synthetic Staff 07",
          notes: "Needed prompting for bedtime hygiene.",
        },
        {
          id: "cl6",
          date: "2026-06-29",
          youthName: "Synthetic Youth 009",
          activity: "Intake orientation",
          staffName: "Synthetic Staff 01",
          notes: "Reviewed house rules. Asked questions.",
        },
        {
          id: "cl7",
          date: "2026-06-28",
          youthName: "Synthetic Youth 011",
          activity: "Group activity",
          staffName: "Robert Kim",
          notes: "Led group discussion. Positive peer interaction.",
        },
        {
          id: "cl8",
          date: "2026-06-28",
          youthName: "Synthetic Youth 012",
          activity: "Meal prep",
          staffName: "Tasha Williams",
          notes: "Helped prepare dinner. Good teamwork.",
        },
      ],
    };
  if (procedure === "gro.incidents")
    return {
      incidents: [
        {
          id: "gi1",
          date: "2026-06-25",
          youthName: "Synthetic Youth 006",
          type: "Peer Conflict",
          severity: "moderate",
          status: "resolved",
          reportedBy: "Synthetic Staff 01",
        },
        {
          id: "gi2",
          date: "2026-06-28",
          youthName: "Synthetic Youth 004",
          type: "Property Damage",
          severity: "minor",
          status: "under_review",
          reportedBy: "Synthetic Staff 07",
        },
      ],
    };
  if (procedure === "gro.supervision")
    return {
      sessions: [
        {
          id: "gs1",
          date: "2026-06-30",
          supervisor: "Demo Clinical Director",
          supervisee: "Demo Case Manager",
          type: "Clinical Supervision",
          status: "scheduled",
        },
        {
          id: "gs2",
          date: "2026-06-28",
          supervisor: "Demo Clinical Lead",
          supervisee: "Synthetic Staff 01",
          type: "Administrative Supervision",
          status: "completed",
        },
        {
          id: "gs3",
          date: "2026-06-25",
          supervisor: "Demo Executive",
          supervisee: "Synthetic Staff 07",
          type: "Performance Review",
          status: "completed",
        },
      ],
    };
  if (procedure === "gro.handoffs")
    return {
      handoffs: [
        {
          id: "gh1",
          date: "2026-06-30",
          fromShift: "Day",
          toShift: "Evening",
          outgoingStaff: "Synthetic Staff 01",
          incomingStaff: "Synthetic Staff 07",
          status: "completed",
        },
        {
          id: "gh2",
          date: "2026-06-30",
          fromShift: "Evening",
          toShift: "Night",
          outgoingStaff: "Synthetic Staff 07",
          incomingStaff: "Tasha Williams",
          status: "pending",
        },
        {
          id: "gh3",
          date: "2026-06-29",
          fromShift: "Night",
          toShift: "Day",
          outgoingStaff: "Tasha Williams",
          incomingStaff: "Synthetic Staff 01",
          status: "completed",
        },
        {
          id: "gh4",
          date: "2026-06-29",
          fromShift: "Day",
          toShift: "Evening",
          outgoingStaff: "Synthetic Staff 01",
          incomingStaff: "Robert Kim",
          status: "completed",
        },
      ],
    };
  if (procedure === "gro.residents")
    return {
      residents: [
        {
          id: "r1",
          firstName: "Synthetic-Person-001",
          lastName: "Johnson",
          age: 16,
          admissionDate: "2026-04-01",
          status: "active",
          assignedBed: "101A",
        },
        {
          id: "r2",
          firstName: "Synthetic-Person-003",
          lastName: "Williams",
          age: 14,
          admissionDate: "2026-04-15",
          status: "active",
          assignedBed: "102A",
        },
        {
          id: "r3",
          firstName: "Synthetic-Person-004",
          lastName: "Ramirez",
          age: 16,
          admissionDate: "2026-05-01",
          status: "active",
          assignedBed: "103A",
        },
        {
          id: "r4",
          firstName: "Synthetic-Person-005",
          lastName: "Peterson",
          age: 13,
          admissionDate: "2026-05-20",
          status: "active",
          assignedBed: "104A",
        },
        {
          id: "r5",
          firstName: "Synthetic-Person-006",
          lastName: "Brooks",
          age: 15,
          admissionDate: "2026-06-10",
          status: "active",
          assignedBed: "105A",
        },
        {
          id: "r6",
          firstName: "Synthetic-Person-009",
          lastName: "Miller",
          age: 14,
          admissionDate: "2026-06-15",
          status: "active",
          assignedBed: "106A",
        },
        {
          id: "r7",
          firstName: "Synthetic-Person-011",
          lastName: "Thompson",
          age: 16,
          admissionDate: "2026-06-01",
          status: "active",
          assignedBed: "107A",
        },
        {
          id: "r8",
          firstName: "Synthetic-Person-012",
          lastName: "Jackson",
          age: 15,
          admissionDate: "2026-06-20",
          status: "active",
          assignedBed: "108A",
        },
      ],
    };

  // ─── TIER 3: QA, GAD, Revenue, Documents ───
  if (procedure === "qa.dashboardKPIs")
    return {
      totalAudits: 5,
      openCAPs: 3,
      auditScore: 87,
      compliantItems: 45,
      openIncidents: 2,
      upcomingAudits: 2,
    };
  if (procedure === "qa.audits")
    return {
      audits: [
        {
          id: "qa1",
          auditDate: "2026-06-15",
          auditor: "Demo Clinical Director",
          department: "Clinical",
          findings: "2 minor documentation gaps",
          status: "completed",
          score: 94,
        },
        {
          id: "qa2",
          auditDate: "2026-06-20",
          auditor: "Demo Clinical Lead",
          department: "GRO Residential",
          findings: "Fire extinguisher expired in Wing B",
          status: "completed",
          score: 97,
        },
        {
          id: "qa3",
          auditDate: "2026-06-25",
          auditor: "Demo Executive",
          department: "Revenue Cycle",
          findings: "3 claims missing authorization numbers",
          status: "in_progress",
          score: 91,
        },
        {
          id: "qa4",
          auditDate: "2026-07-01",
          auditor: "HR Director",
          department: "Human Resources",
          findings: "Pending verification",
          status: "scheduled",
          score: null,
        },
        {
          id: "qa5",
          auditDate: "2026-06-10",
          auditor: "Demo Case Manager",
          department: "Clinical",
          findings: "Treatment plan review overdue for 1 patient",
          status: "completed",
          score: 88,
        },
      ],
    };
  if (procedure === "qa.caps")
    return {
      caps: [
        {
          id: "cap1",
          capNumber: "CAP-2026-001",
          issueDate: "2026-06-18",
          department: "Clinical",
          description: "Implement dual-signature medication check",
          status: "in_progress",
          dueDate: "2026-07-20",
        },
        {
          id: "cap2",
          capNumber: "CAP-2026-002",
          issueDate: "2026-06-26",
          department: "GRO",
          description: "Update visitor sign-in procedures to require photo ID",
          status: "open",
          dueDate: "2026-07-05",
        },
        {
          id: "cap3",
          capNumber: "CAP-2026-003",
          issueDate: "2026-06-23",
          department: "Revenue",
          description:
            "Implement pre-submission authorization verification for all claims",
          status: "in_progress",
          dueDate: "2026-07-15",
        },
      ],
    };
  if (procedure === "gad.dashboardKPIs")
    return {
      openWorkOrders: 4,
      vendorCount: 8,
      facilityCount: 1,
      pendingApprovals: 2,
      maintenanceScore: 92,
    };
  if (procedure === "gad.workOrders")
    return {
      orders: [
        {
          id: "wo1",
          orderNumber: "WO-2026-001",
          description: "HVAC Repair - Wing B",
          vendor: "Cypress Mechanical",
          status: "in_progress",
          priority: "high",
          createdDate: "2026-06-25",
        },
        {
          id: "wo2",
          orderNumber: "WO-2026-002",
          description: "Replace fire extinguisher",
          vendor: "Houston Safety Supply",
          status: "completed",
          priority: "urgent",
          createdDate: "2026-06-18",
        },
        {
          id: "wo3",
          orderNumber: "WO-2026-003",
          description: "Kitchen sink plumbing leak",
          vendor: "Cypress Plumbing",
          status: "open",
          priority: "medium",
          createdDate: "2026-06-27",
        },
        {
          id: "wo4",
          orderNumber: "WO-2026-004",
          description: "Security camera upgrade",
          vendor: "SecureView Systems",
          status: "pending_parts",
          priority: "medium",
          createdDate: "2026-06-20",
        },
      ],
    };
  if (procedure === "revenue.stats")
    return {
      totalClaims: 15,
      collectionRate: 78,
      totalBilled: 250000,
      totalCollected: 195000,
      pendingClaims: 8,
      deniedClaims: 2,
    };
  if (procedure === "revenue.claims")
    return {
      claims: [
        {
          id: "rc1",
          claimNumber: "CLM-2026-001",
          patientName: "Synthetic Youth 001",
          serviceDate: "2026-06-01",
          status: "paid",
          billedAmount: 12500,
          paidAmount: 11875,
          payer: "Superior HealthPlan",
        },
        {
          id: "rc2",
          claimNumber: "CLM-2026-002",
          patientName: "Synthetic Youth 003",
          serviceDate: "2026-06-05",
          status: "submitted",
          billedAmount: 18200,
          paidAmount: 0,
          payer: "BCBS TX",
        },
        {
          id: "rc3",
          claimNumber: "CLM-2026-003",
          patientName: "Synthetic Youth 004",
          serviceDate: "2026-06-08",
          status: "draft",
          billedAmount: 22400,
          paidAmount: 0,
          payer: "UnitedHealthcare",
        },
        {
          id: "rc4",
          claimNumber: "CLM-2026-004",
          patientName: "Synthetic Youth 008",
          serviceDate: "2026-06-10",
          status: "paid",
          billedAmount: 16800,
          paidAmount: 16200,
          payer: "Superior HealthPlan",
        },
        {
          id: "rc5",
          claimNumber: "CLM-2026-005",
          patientName: "Synthetic Youth 006",
          serviceDate: "2026-06-12",
          status: "denied",
          billedAmount: 19600,
          paidAmount: 0,
          payer: "BCBS TX",
        },
        {
          id: "rc6",
          claimNumber: "CLM-2026-006",
          patientName: "Synthetic Youth 009",
          serviceDate: "2026-06-15",
          status: "submitted",
          billedAmount: 14200,
          paidAmount: 0,
          payer: "UnitedHealthcare",
        },
        {
          id: "rc7",
          claimNumber: "CLM-2026-007",
          patientName: "Synthetic Youth 011",
          serviceDate: "2026-06-18",
          status: "approved",
          billedAmount: 20800,
          paidAmount: 0,
          payer: "Superior HealthPlan",
        },
        {
          id: "rc8",
          claimNumber: "CLM-2026-008",
          patientName: "Synthetic Youth 012",
          serviceDate: "2026-06-20",
          status: "draft",
          billedAmount: 17500,
          paidAmount: 0,
          payer: "Aetna Better Health",
        },
        {
          id: "rc9",
          claimNumber: "CLM-2026-009",
          patientName: "Synthetic Youth 001",
          serviceDate: "2026-06-22",
          status: "submitted",
          billedAmount: 13100,
          paidAmount: 0,
          payer: "BCBS TX",
        },
        {
          id: "rc10",
          claimNumber: "CLM-2026-010",
          patientName: "Synthetic Youth 003",
          serviceDate: "2026-06-25",
          status: "appealed",
          billedAmount: 18900,
          paidAmount: 0,
          payer: "Aetna Better Health",
        },
      ],
    };
  if (procedure === "documents.list")
    return {
      documents: [
        {
          id: "doc1",
          title: "Employee Handbook 2026",
          category: "HR Policies",
          status: "published",
          author: "Demo Executive",
          createdDate: "2026-01-15",
          version: "3.2",
        },
        {
          id: "doc2",
          title: "Crisis Intervention Protocol",
          category: "Clinical Protocols",
          status: "published",
          author: "Demo Clinical Director",
          createdDate: "2026-02-10",
          version: "2.1",
        },
        {
          id: "doc3",
          title: "Youth Rights & Advocacy Guide",
          category: "GRO Operations",
          status: "published",
          author: "Demo Clinical Lead",
          createdDate: "2026-03-05",
          version: "1.5",
        },
        {
          id: "doc4",
          title: "CAPA Procedure Manual",
          category: "QA & Compliance",
          status: "published",
          author: "Demo Executive",
          createdDate: "2026-01-20",
          version: "4.0",
        },
        {
          id: "doc5",
          title: "Claims Submission Guide",
          category: "Revenue Cycle",
          status: "published",
          author: "Demo Case Manager",
          createdDate: "2026-04-12",
          version: "2.3",
        },
        {
          id: "doc6",
          title: "Facility Maintenance SOP",
          category: "GAD Administration",
          status: "published",
          author: "GRO Admin",
          createdDate: "2026-05-01",
          version: "1.8",
        },
        {
          id: "doc7",
          title: "Medication Administration Policy",
          category: "Clinical Protocols",
          status: "published",
          author: "Dr. Sarah Kim",
          createdDate: "2026-04-01",
          version: "3.4",
        },
        {
          id: "doc8",
          title: "Safety Inspection Checklist",
          category: "GRO Operations",
          status: "published",
          author: "RCS Lead",
          createdDate: "2026-05-15",
          version: "1.2",
        },
      ],
    };

  // ─── TIER 4: MGMA, 42 CFR, Campus, NIL ───
  if (procedure === "mgma.domains")
    return {
      domains: [
        {
          id: "dom1",
          name: "Operations",
          score: 78,
          kpis: [
            { name: "Avg Wait Time", value: "12 min" },
            { name: "Bed Turnover", value: "5.2/mo" },
            { name: "Staff-Youth Ratio", value: "1:4" },
          ],
          trend: "improving",
        },
        {
          id: "dom2",
          name: "Financial",
          score: 65,
          kpis: [
            { name: "Net Rev/Patient", value: "$48,500" },
            { name: "Days in AR", value: "18" },
            { name: "Denial Rate", value: "15%" },
          ],
          trend: "stable",
        },
        {
          id: "dom3",
          name: "HR",
          score: 72,
          kpis: [
            { name: "Turnover Rate", value: "12%" },
            { name: "Time to Fill", value: "28 days" },
            { name: "Training Completion", value: "88%" },
          ],
          trend: "declining",
        },
        {
          id: "dom4",
          name: "Compliance",
          score: 94,
          kpis: [
            { name: "HIPAA Score", value: "98%" },
            { name: "State Licensure", value: "92%" },
            { name: "CAP Closure", value: "85%" },
          ],
          trend: "improving",
        },
        {
          id: "dom5",
          name: "Clinical",
          score: 88,
          kpis: [
            { name: "Plan Completion", value: "88%" },
            { name: "Patient Satisfaction", value: "4.2/5" },
            { name: "Readmission Rate", value: "5%" },
          ],
          trend: "improving",
        },
        {
          id: "dom6",
          name: "Technology",
          score: 70,
          kpis: [
            { name: "EHR Uptime", value: "99.5%" },
            { name: "Response Time", value: "2.1s" },
            { name: "Digital Adoption", value: "85%" },
          ],
          trend: "stable",
        },
        {
          id: "dom7",
          name: "Governance",
          score: 68,
          kpis: [
            { name: "Occupancy Rate", value: "75%" },
            { name: "Conversion Rate", value: "25%" },
            { name: "NPS Score", value: "32" },
          ],
          trend: "stable",
        },
      ],
    };
  if (procedure === "cfr42.records")
    return {
      records: [
        {
          id: "sud1",
          patientName: "Synthetic Youth 001",
          consentDate: "2026-04-01",
          consentType: "SUD Treatment Consent",
          status: "active",
        },
        {
          id: "sud2",
          patientName: "Synthetic Youth 003",
          consentDate: "2026-04-15",
          consentType: "SUD Treatment Consent",
          status: "active",
        },
        {
          id: "sud3",
          patientName: "Synthetic Youth 004",
          consentDate: "2026-05-01",
          consentType: "SUD Treatment Consent",
          status: "active",
        },
      ],
      consents: [
        {
          id: "con1",
          patientName: "Synthetic Youth 001",
          consentType: "General Treatment",
          dateSigned: "2026-04-01",
          status: "valid",
        },
        {
          id: "con2",
          patientName: "Synthetic Youth 001",
          consentType: "Medication",
          dateSigned: "2026-04-01",
          status: "valid",
        },
        {
          id: "con3",
          patientName: "Synthetic Youth 003",
          consentType: "General Treatment",
          dateSigned: "2026-04-15",
          status: "valid",
        },
        {
          id: "con4",
          patientName: "Synthetic Youth 004",
          consentType: "General Treatment",
          dateSigned: "2026-05-01",
          status: "valid",
        },
        {
          id: "con5",
          patientName: "Synthetic Youth 008",
          consentType: "General Treatment",
          dateSigned: "2026-05-20",
          status: "valid",
        },
      ],
      agreements: [
        {
          id: "qsoa1",
          partnerName: "Legacy Community Health",
          agreementType: "QSOA",
          status: "active",
          signedDate: "2026-03-01",
        },
        {
          id: "qsoa2",
          partnerName: "Texas Childrens Hospital",
          agreementType: "QSOA",
          status: "pending",
          signedDate: null,
        },
      ],
    };
  if (procedure === "campus.census")
    return {
      totalBeds: 12,
      occupiedBeds: 10,
      buildings: 1,
      avgLOS: 45,
      occupancyRate: 83,
    };
  if (procedure === "nil.entities")
    return {
      entities: [
        {
          id: "ne1",
          name: "Synthetic Youth 001",
          type: "patient",
          module: "clinical",
        },
        {
          id: "ne2",
          name: "Demo Clinical Director",
          type: "clinician",
          module: "clinical",
        },
        {
          id: "ne3",
          name: "Demo Clinical Lead",
          type: "clinician",
          module: "clinical",
        },
        {
          id: "ne4",
          name: "Demo Case Manager",
          type: "clinician",
          module: "clinical",
        },
        {
          id: "ne5",
          name: "Demo Executive",
          type: "administrator",
          module: "executive",
        },
        {
          id: "ne6",
          name: "Main Residential Unit",
          type: "facility",
          module: "gro",
        },
        {
          id: "ne7",
          name: "Superior HealthPlan",
          type: "payer",
          module: "revenue",
        },
        { id: "ne8", name: "Houston ISD", type: "partner", module: "gro" },
        {
          id: "ne9",
          name: "Employee Handbook 2026",
          type: "document",
          module: "documents",
        },
        { id: "ne10", name: "CAP-2026-001", type: "cap", module: "qa" },
      ],
      relations: [
        { id: "rel1", sourceId: "ne1", targetId: "ne2", type: "treated_by" },
        { id: "rel2", sourceId: "ne1", targetId: "ne6", type: "resides_at" },
        { id: "rel3", sourceId: "ne1", targetId: "ne7", type: "covered_by" },
        { id: "rel4", sourceId: "ne1", targetId: "ne8", type: "referred_by" },
        { id: "rel5", sourceId: "ne2", targetId: "ne5", type: "reports_to" },
        { id: "rel6", sourceId: "ne3", targetId: "ne1", type: "manages_case" },
        { id: "rel7", sourceId: "ne4", targetId: "ne1", type: "manages_case" },
        { id: "rel8", sourceId: "ne6", targetId: "ne5", type: "managed_by" },
        { id: "rel9", sourceId: "ne9", targetId: "ne5", type: "authored_by" },
        { id: "rel10", sourceId: "ne10", targetId: "ne4", type: "assigned_to" },
        { id: "rel11", sourceId: "ne2", targetId: "ne3", type: "supervises" },
        { id: "rel12", sourceId: "ne7", targetId: "ne1", type: "covers" },
        { id: "rel13", sourceId: "ne8", targetId: "ne1", type: "referred" },
        { id: "rel14", sourceId: "ne10", targetId: "ne5", type: "reviewed_by" },
        { id: "rel15", sourceId: "ne3", targetId: "ne2", type: "reports_to" },
      ],
    };

  // ─── TIER 5: HR ───
  if (procedure === "hr.performanceReviews")
    return {
      reviews: [
        {
          id: "pr1",
          employeeName: "Demo Clinical Director",
          reviewType: "Annual",
          reviewDate: "2026-06-15",
          status: "completed",
          rating: 4.5,
          goals: "5",
        },
        {
          id: "pr2",
          employeeName: "Demo Clinical Lead",
          reviewType: "Annual",
          reviewDate: "2026-06-10",
          status: "completed",
          rating: 4.2,
          goals: "5",
        },
        {
          id: "pr3",
          employeeName: "Demo Case Manager",
          reviewType: "Quarterly",
          reviewDate: "2026-06-20",
          status: "in_progress",
          rating: null,
          goals: "3",
        },
        {
          id: "pr4",
          employeeName: "Synthetic Staff 01",
          reviewType: "Annual",
          reviewDate: "2026-05-28",
          status: "completed",
          rating: 4.0,
          goals: "4",
        },
        {
          id: "pr5",
          employeeName: "Synthetic Staff 07",
          reviewType: "Probation",
          reviewDate: "2026-07-01",
          status: "scheduled",
          rating: null,
          goals: "3",
        },
        {
          id: "pr6",
          employeeName: "Tasha Williams",
          reviewType: "Annual",
          reviewDate: "2026-06-05",
          status: "completed",
          rating: 4.3,
          goals: "4",
        },
      ],
    };
  if (procedure === "hr.trainingModules")
    return {
      modules: [
        {
          id: "tm1",
          title: "HIPAA Privacy & Security",
          category: "Compliance",
          required: true,
          duration: 120,
          completionRate: 90,
        },
        {
          id: "tm2",
          title: "Crisis Intervention",
          category: "Clinical",
          required: true,
          duration: 240,
          completionRate: 85,
        },
        {
          id: "tm3",
          title: "Youth Rights & Advocacy",
          category: "Clinical",
          required: true,
          duration: 90,
          completionRate: 88,
        },
        {
          id: "tm4",
          title: "Medication Administration",
          category: "Clinical",
          required: true,
          duration: 180,
          completionRate: 92,
        },
        {
          id: "tm5",
          title: "Restraint & Seclusion",
          category: "Safety",
          required: true,
          duration: 120,
          completionRate: 78,
        },
        {
          id: "tm6",
          title: "Diversity, Equity & Inclusion",
          category: "HR",
          required: true,
          duration: 60,
          completionRate: 95,
        },
      ],
    };
  if (procedure === "hr.credentials")
    return {
      credentials: [
        {
          id: "cred1",
          employeeName: "Demo Clinical Director",
          credentialType: "Medical License",
          issueDate: "2015-03-01",
          expiryDate: "2027-03-01",
          status: "valid",
        },
        {
          id: "cred2",
          employeeName: "Demo Clinical Lead",
          credentialType: "LCSW License",
          issueDate: "2018-06-15",
          expiryDate: "2026-09-15",
          status: "expiring_soon",
        },
        {
          id: "cred3",
          employeeName: "Demo Case Manager",
          credentialType: "LPC License",
          issueDate: "2020-01-10",
          expiryDate: "2026-08-15",
          status: "expiring_soon",
        },
        {
          id: "cred4",
          employeeName: "Synthetic Staff 01",
          credentialType: "CPR Certification",
          issueDate: "2026-01-05",
          expiryDate: "2027-01-05",
          status: "valid",
        },
        {
          id: "cred5",
          employeeName: "Synthetic Staff 07",
          credentialType: "CPI Certification",
          issueDate: "2025-08-20",
          expiryDate: "2026-08-20",
          status: "expiring_soon",
        },
        {
          id: "cred6",
          employeeName: "Tasha Williams",
          credentialType: "RN License",
          issueDate: "2019-04-12",
          expiryDate: "2027-04-12",
          status: "valid",
        },
        {
          id: "cred7",
          employeeName: "Robert Kim",
          credentialType: "CPR Certification",
          issueDate: "2026-02-10",
          expiryDate: "2027-02-10",
          status: "valid",
        },
        {
          id: "cred8",
          employeeName: "Dr. Sarah Kim",
          credentialType: "Psychiatric Board Cert",
          issueDate: "2016-07-01",
          expiryDate: "2028-07-01",
          status: "valid",
        },
      ],
    };
  if (procedure === "hr.personnel")
    return {
      people: [
        {
          id: "h1",
          firstName: "Demo",
          lastName: "Executive",
          employeeId: "EMP001",
          role: "CEO",
          department: "Executive",
          status: "active",
          hireDate: "2026-01-01",
        },
        {
          id: "h2",
          firstName: "Dr.",
          lastName: "Carter",
          employeeId: "EMP002",
          role: "Clinical Director",
          department: "Clinical",
          status: "active",
          hireDate: "2026-01-15",
        },
        {
          id: "h3",
          firstName: "Synthetic",
          lastName: "Brooks",
          employeeId: "EMP003",
          role: "Case Manager",
          department: "Clinical",
          status: "active",
          hireDate: "2026-02-01",
        },
        {
          id: "h4",
          firstName: "Synthetic-Person-019",
          lastName: "Lee",
          employeeId: "EMP004",
          role: "Case Manager",
          department: "Clinical",
          status: "active",
          hireDate: "2026-03-01",
        },
        {
          id: "h5",
          firstName: "Sarah",
          lastName: "Johnson",
          employeeId: "EMP005",
          role: "RCS Lead",
          department: "GRO",
          status: "active",
          hireDate: "2026-02-15",
        },
        {
          id: "h6",
          firstName: "Mike",
          lastName: "Chen",
          employeeId: "EMP006",
          role: "RCS Staff",
          department: "GRO",
          status: "active",
          hireDate: "2026-04-01",
        },
        {
          id: "h7",
          firstName: "Tasha",
          lastName: "Williams",
          employeeId: "EMP007",
          role: "Night RCS",
          department: "GRO",
          status: "active",
          hireDate: "2026-03-15",
        },
        {
          id: "h8",
          firstName: "Robert",
          lastName: "Kim",
          employeeId: "EMP008",
          role: "RCS Staff",
          department: "GRO",
          status: "active",
          hireDate: "2026-05-01",
        },
        {
          id: "h9",
          firstName: "Dr. Sarah",
          lastName: "Kim",
          employeeId: "EMP009",
          role: "Psychiatrist",
          department: "Clinical",
          status: "active",
          hireDate: "2026-01-20",
        },
        {
          id: "h10",
          firstName: "HR",
          lastName: "Director",
          employeeId: "EMP010",
          role: "HR Director",
          department: "HR",
          status: "active",
          hireDate: "2026-01-10",
        },
      ],
    };
  // ─── hr.separations (verify existing) ───
  if (procedure === "hr.separations")
    return [
      {
        id: "sep1",
        employeeName: "Jessica Adams",
        separationDate: "2026-05-15",
        reason: "Voluntary resignation",
        status: "completed",
        exitInterview: true,
      },
      {
        id: "sep2",
        employeeName: "Synthetic Staff 04",
        separationDate: "2026-06-01",
        reason: "Relocation",
        status: "in_progress",
        exitInterview: false,
      },
      {
        id: "sep3",
        employeeName: "Nicole Brown",
        separationDate: "2026-06-30",
        reason: "End of contract",
        status: "scheduled",
        exitInterview: false,
      },
    ];

  // ─── Catch-all for any remaining list/search endpoints ───
  if (procedure.includes("list") || procedure.includes("search")) return [];
  return null;
}

function buildDemoResponse(path: string): Response {
  const data = getDemoData(path);
  if (Array.isArray(data)) {
    const body = data.map((d) => ({ result: { data: { json: d } } }));
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }
  const body = [{ result: { data: { json: data } } }];
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

const PHASE3_CONTROLLED_MUTATIONS = [
  "phase3.runDemo",
  "phase3.evaluateComponent",
  "phase3.resetDemo",
  "phase3.setKillSwitch",
  "phase3.recordAccessReview",
] as const;

export function isAuthoritativeM41aRequest(path: string): boolean {
  return path.includes("m41a.") && !path.includes("m41a.featureCatalog");
}

export function isAuthoritativeM41bRequest(path: string): boolean {
  return path.includes("m41b.");
}

export function mayUseAmosEvaluationFallback(
  path: string,
  kind: EvaluationFallbackKind,
): boolean {
  if (isAuthoritativeM41aRequest(path) || isAuthoritativeM41bRequest(path))
    return false;
  if (PHASE3_CONTROLLED_MUTATIONS.some((procedure) => path.includes(procedure)))
    return false;
  const trainingWorkspace =
    typeof localStorage !== "undefined" &&
    localStorage.getItem("amos-workspace") === "training";
  return mayUseEvaluationData(
    path,
    kind,
    runtimeConfig.evaluationMode || trainingWorkspace,
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

function createRuntimeTrpcClient() {
  if (!runtimeConfig.initialized) {
    throw new Error(
      "AMOS runtime configuration must be verified before API startup.",
    );
  }
  return trpc.createClient({
    links: [
      httpBatchLink({
        url: runtimeConfig.apiUrl,
        transformer: superjson,
        headers() {
          const token = localStorage.getItem("amos_token");
          if (!token) return {};
          const role = localStorage.getItem("amos-role") ?? "rcs-day";
          const workspace =
            localStorage.getItem("amos-workspace") === "training"
              ? "training"
              : "operational";
          return {
            Authorization: `Bearer ${token}`,
            "X-AMOS-Workspace": workspace,
            ...(token === EVALUATION_SESSION_TOKEN &&
            runtimeConfig.evaluationMode
              ? { "X-AMOS-Evaluation-Role": role }
              : {}),
          };
        },
        fetch: createResilientFetch({
          timeoutMs: 15_000,
          mayFallback: mayUseAmosEvaluationFallback,
          buildFallback: buildDemoResponse,
        }),
      }),
    ],
  });
}

let trpcClient: ReturnType<typeof createRuntimeTrpcClient> | undefined;

function getRuntimeTrpcClient() {
  trpcClient ??= createRuntimeTrpcClient();
  return trpcClient;
}

export function TRPCProvider({ children }: { children: ReactNode }) {
  const queryProvider = createElement(QueryClientProvider, {
    client: queryClient,
    children,
  });

  return createElement(trpc.Provider, {
    client: getRuntimeTrpcClient(),
    queryClient,
    children: queryProvider,
  });
}
