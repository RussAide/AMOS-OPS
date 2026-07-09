import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import superjson from "superjson";
import type { AppRouter } from "../../api/router";
import type { ReactNode } from "react";
import { store, nextId, administerMed, refuseMed, recordPrn, holdMed, createBehavioralObs, createFamilyContact, createIncident, createTask, updateTask, updateShift, respondToApproval, createWorkOrder, updateWorkOrder, getMedSummary, getResidentialSummary, assignBed, vacateBed, createShift as createShiftFn, createMeeting, createEscalation } from "@/data/liveStore";

export const trpc = createTRPCReact<AppRouter>();

const API_URL = import.meta.env.VITE_API_URL || "/api/trpc";

// ─── Demo Data for Static Deployments ──────────────────────

const DEMO_USERS = [
  { id: "u1", email: "admin@adolbi.com", firstName: "E. Russ", lastName: "Aideyan", name: "E. Russ Aideyan", role: "administrator", department: "Executive", isActive: true, createdAt: "2026-06-01" },
  { id: "u2", email: "dr.hall@adolbi.com", firstName: "Dr.", lastName: "Hall", name: "Dr. Hall", role: "treatment-director", department: "Clinical", isActive: true, createdAt: "2026-06-02" },
  { id: "u3", email: "l.ike@adolbi.com", firstName: "Lilian", lastName: "Ike", name: "Lilian Ike", role: "clinical-director", department: "Clinical", isActive: true, createdAt: "2026-06-02" },
  { id: "u4", email: "j.guidry@adolbi.com", firstName: "Jonthan", lastName: "Guidry", name: "Jonthan Guidry", role: "case-manager", department: "Clinical", isActive: true, createdAt: "2026-06-03" },
  { id: "u5", email: "hr@adolbi.com", firstName: "HR", lastName: "Director", name: "HR Director", role: "hr-director", department: "Human Resources", isActive: true, createdAt: "2026-06-03" },
  { id: "u6", email: "gro.admin@adolbi.com", firstName: "GRO", lastName: "Admin", name: "GRO Administrator", role: "gro-administrator", department: "GRO Residential", isActive: true, createdAt: "2026-06-04" },
];

const DEMO_PEOPLE = [
  { id: "h1", firstName: "E. Russ", lastName: "Aideyan", employeeId: "EMP001", role: "super-admin", department: "Executive", lane: "management", isActive: 1, isEmployee: 1, hireDate: "2026-01-01", supervisor: null, createdAt: "2026-01-01" },
  { id: "h2", firstName: "Dr.", lastName: "Hall", employeeId: "EMP002", role: "treatment-director", department: "Clinical", lane: "management", isActive: 1, isEmployee: 1, hireDate: "2026-01-15", supervisor: "E. Russ Aideyan", createdAt: "2026-01-15" },
  { id: "h3", firstName: "Lilian", lastName: "Ike", employeeId: "EMP003", role: "clinical-director", department: "Clinical", lane: "management", isActive: 1, isEmployee: 1, hireDate: "2026-02-01", supervisor: "Dr. Hall", createdAt: "2026-02-01" },
  { id: "h4", firstName: "Jonthan", lastName: "Guidry", employeeId: "EMP004", role: "case-manager", department: "Clinical", lane: "activation", isActive: 1, isEmployee: 1, hireDate: "2026-03-01", supervisor: "Lilian Ike", createdAt: "2026-03-01" },
  { id: "h5", firstName: "RCS", lastName: "Lead", employeeId: "EMP005", role: "rcs-lead", department: "GRO Residential", lane: "activation", isActive: 1, isEmployee: 1, hireDate: "2026-04-01", supervisor: "GRO Administrator", createdAt: "2026-04-01" },
];

const DEMO_PATIENTS = [
  { id: "p1", firstName: "Youth", lastName: "A", dateOfBirth: "2010-03-15", status: "active", gender: "Male", insuranceId: "INS001", assignedClinician: "Dr. Hall" },
  { id: "p2", firstName: "Youth", lastName: "B", dateOfBirth: "2011-07-22", status: "active", gender: "Female", insuranceId: "INS002", assignedClinician: "Lilian Ike" },
  { id: "p3", firstName: "Youth", lastName: "C", dateOfBirth: "2009-11-08", status: "pending", gender: "Male", insuranceId: "INS003", assignedClinician: "Jonthan Guidry" },
];

const DEMO_CLAIMS = { claims: [
  { id: "c1", claimNumber: "CLM-2026-001", patientName: "Youth A", serviceDate: "2026-06-01", status: "submitted", totalAmount: 12500, paidAmount: 0 },
  { id: "c2", claimNumber: "CLM-2026-002", patientName: "Youth B", serviceDate: "2026-06-05", status: "paid", totalAmount: 15000, paidAmount: 15000 },
  { id: "c3", claimNumber: "CLM-2026-003", patientName: "Youth C", serviceDate: "2026-06-10", status: "pending", totalAmount: 8750, paidAmount: 0 },
], total: 3 };

const DEMO_KPIs: Record<string, any> = {
  "bhc.dashboardKPIs": { activePatients: 3, sessionsThisWeek: 12, totalPatients: 3, pendingApprovals: 1, highRiskCount: 0 },
  "revenue.dashboardKPIs": { totalClaims: 3, collectionRate: 33, totalBilled: 36250, totalCollected: 15000, pendingClaims: 2 },
  "qa.dashboardKPIs": { totalAudits: 2, openIncidents: 1, auditScore: 85, compliantItems: 42 },
  "gro.dashboardKPIs": { activeReferrals: 2, conversionRate: 50, newThisMonth: 3 },
  "gad.dashboardKPIs": { openWorkOrders: 2, vendorCount: 5, facilityCount: 1 },
  "hr.dashboardKPIs": { totalPeople: 5, inPipeline: 3, activeAlerts: 1, avgDaysToClear: 14, recentActivity: 8, avgCompletion: 70 },
  "workflow.dashboardKPIs": { totalInstances: 12, pendingInstances: 5, completedInstances: 7, rejectedInstances: 0, pendingApprovals: 3 },
  "nil.getStats": { totalEntities: 45, totalRelationships: 128, entityTypes: [], relationTypes: [], moduleDistribution: [] },
  "msgraph.status": { connected: false, tenant: "Not configured", syncMode: "none", users: { synced: 0, total: 0 }, groups: { synced: 0, total: 0 }, lastSync: null },
  "user.stats": { total: 6, active: 6, inactive: 0, byRole: [
    { role: "administrator", c: 1 }, { role: "clinical-director", c: 1 }, { role: "supervisor", c: 1 },
    { role: "qa-officer", c: 1 }, { role: "hr-director", c: 1 }, { role: "gro-staff", c: 1 }
  ]},
};

function getDemoData(path: string): any {
  const parts = path.replace("/api/trpc/", "").split(",");
  if (parts.length > 1) return parts.map((p) => getSingleDemoData(p.trim()));
  return getSingleDemoData(parts[0]);
}

function getSingleDemoData(procedure: string): any {
  if (procedure === "auth.me") return DEMO_USERS[0];
  if (procedure === "auth.login") return { token: "demo-token", user: DEMO_USERS[0] };
  if (procedure === "auth.register") return { token: "demo-token", user: DEMO_USERS[0] };
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
  if (procedure === "bhc.clinicianWorkload") return { total: 0, byClinician: [] };
  if (procedure === "revenue.listClaims") return DEMO_CLAIMS;
  if (procedure === "revenue.dashboardKPIs") return DEMO_KPIs["revenue.dashboardKPIs"];
  if (procedure === "qa.listAudits") return [];
  if (procedure === "qa.dashboardKPIs") return DEMO_KPIs["qa.dashboardKPIs"];
  if (procedure === "gad.listWorkOrders") return [];
  if (procedure === "gad.dashboardKPIs") return DEMO_KPIs["gad.dashboardKPIs"];
  if (procedure === "gro.listReferrals") return [];
  if (procedure === "gro.dashboardKPIs") return DEMO_KPIs["gro.dashboardKPIs"];
  if (procedure === "nil.getStats") return DEMO_KPIs["nil.getStats"];
  if (procedure === "nil.searchEntities") return [];
  if (procedure === "nil.getEntityNetwork") return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };
  if (procedure === "nil.getRecommendations") return [];
  if (procedure === "nil.findPath") return { found: false, path: [], hops: 0 };
  if (procedure === "workflow.listRules") return [{ id: "hr-status-change", name: "HR Status Change Alert", event: "hr.status-changed", actions: [{ type: "notify", target: "hr-director", priority: "high" }] }];
  if (procedure === "workflow.dashboardKPIs") return DEMO_KPIs["workflow.dashboardKPIs"];
  if (procedure === "workflow.listInstances") return [];
  if (procedure === "workflow.listPendingApprovals") return [];
  if (procedure === "workflow.auditLog") return [];
  if (procedure === "msgraph.status") return DEMO_KPIs["msgraph.status"];
  if (procedure === "msgraph.listUsers") return [];
  if (procedure === "msgraph.listGroups") return [];
  if (procedure === "msgraph.syncHistory") return [];
  // ─── DASHBOARD AGGREGATE ENDPOINTS ───────────────────────
  if (procedure === "dashboard.overview") return {
    revenue: { totalClaims: 8, deniedClaims: 1, totalBilled: 5285000, totalCollected: 3250000, collectionRate: 61 },
    bhc: { activePatients: 5, sessionsThisWeek: 8, highRiskCount: 1, pendingApprovals: 1 },
    campus: { occupiedBeds: 12, totalBeds: 16, occupancyRate: 75, facilityCount: 2 },
    mgma: { domainCount: 7, kpiCount: 42 },
    part2: { activeSUDRecords: 3, validConsents: 3, expiredConsents: 0, recentAudits: 1 },
    gad: { overdueWorkOrders: 1, openWorkOrders: 3 },
    documents: { total: 12, published: 6, draft: 3 },
  };
  if (procedure === "dashboard.operationalKPIs") return {
    censusToday: 12, admissions7d: 2, discharges7d: 1, pendingAdmissions: 1, bedTurnoverRate: 5,
    avgLengthOfStay: 45, medicationErrors7d: 0, incidents7d: 1, restraints7d: 0, safetyRoundsCompleted: 28,
    shiftCoverageRate: 95, trainingComplianceRate: 88,
  };
  if (procedure === "dashboard.complianceKPIs") return {
    overallScore: 94, openCAPs: 3, overdueItems: 1, hipaaScore: 98, stateLicensureScore: 92,
    staffCredentialScore: 88, incidentReportingScore: 100, medicationMgmtScore: 95, youthRightsScore: 97,
    openAudits: 2, completedAuditsThisQuarter: 3,
  };
  if (procedure === "dashboard.clinicalKPIs") return {
    activePatients: 5, sessionsThisWeek: 8, sessionCompletionRate: 92, avgSessionDuration: 55,
    treatmentPlansActive: 4, treatmentPlansOverdue: 1, readmissionRate: 5, authorizationStatus: 80,
    outcomeMeasuresCompleted: 12, highRiskPatients: 1,
  };
  if (procedure === "dashboard.revenueKPIs") return {
    claimsSubmitted30d: 6, approvalRate: 75, denialRate: 15, avgDaysToPayment: 18,
    outstandingAR: 1250000, authorizationExpiry30d: 1, writeOffs30d: 45000, netRevenue30d: 980000,
  };
  if (procedure === "dashboard.workforceKPIs") return {
    totalStaff: 24, openPositions: 3, credentialComplianceRate: 88, trainingCompletionRate: 82,
    turnoverRate12m: 12, pendingSeparations: 1, expiringCredentials: 2, avgTenureMonths: 18,
    overtimeHoursWeek: 16, agencyUsagePercent: 5,
  };
  if (procedure === "dashboard.executiveKPIs") return {
    revenueMTD: 485000, operatingCensus: 75, compliancePosture: 94, criticalRisks: 1,
    staffingLevel: 92, strategicProjectStatus: 68, boardMeetingDays: 14,
  };
  if (procedure === "ccmg.bhcDashboard") return {
    departments: { mhtcm: { activePlans: 4, pendingIntakes: 1, avgCaseLoad: 8 }, mhrs: { activePrograms: 3, groupsThisWeek: 6 } },
    intakeQueue: [{ id: "i1", youthName: "Test Youth", status: "pending", referralDate: "2026-06-28" }],
  };
  if (procedure === "m19.getCampusSummary") return {
    mainUnit: { occupied: 8, capacity: 8, status: "full" },
    ecsUnit: { occupied: 4, capacity: 8, status: "available" },
    cypressUnit: { occupied: 0, capacity: 16, status: "planned" },
    totalOccupied: 12, totalCapacity: 32,
  };
  // ─── M1 ENDPOINTS ────────────────────────────────────────
  if (procedure === "m1.dashboardKPIs") return {
    totalInOnboarding: 5, modulesCompleted: 18, totalModules: 24,
    completionRate: 75, credentialAlerts: 2, pendingTasks: 4,
    evidencePackets: 3, rtdReady: 2,
  };
  if (procedure === "m1.getOnboardingProgress") return [
    { id: "op1", person_id: "h4", track_id: "general", module_id: "mod-001", status: "completed", score: 95, evidence_uploaded: 1, completed_at: "2026-06-20" },
    { id: "op2", person_id: "h4", track_id: "general", module_id: "mod-002", status: "completed", score: 88, evidence_uploaded: 1, completed_at: "2026-06-22" },
    { id: "op3", person_id: "h4", track_id: "general", module_id: "mod-003", status: "in-progress", score: null, evidence_uploaded: 0, completed_at: null },
    { id: "op4", person_id: "h5", track_id: "general", module_id: "mod-001", status: "completed", score: 92, evidence_uploaded: 1, completed_at: "2026-06-18" },
    { id: "op5", person_id: "h5", track_id: "general", module_id: "mod-002", status: "overdue", score: null, evidence_uploaded: 0, completed_at: null },
  ];
  if (procedure === "m1.listCredentialExpiries") return [
    { id: "cr1", person_id: "h4", credential_type: "license", credential_name: "LPC License", expiry_date: "2026-08-15", alert_status: "warning", alert_threshold_days: 30 },
    { id: "cr2", person_id: "h5", credential_type: "certification", credential_name: "CPR Certification", expiry_date: "2026-07-01", alert_status: "warning", alert_threshold_days: 30 },
    { id: "cr3", person_id: "h2", credential_type: "license", credential_name: "Medical License", expiry_date: "2027-03-01", alert_status: "current", alert_threshold_days: 60 },
  ];
  if (procedure === "m1.checkReleaseToDuty") return {
    personId: "h4", isClear: false,
    modules: { total: 3, completed: 2 },
    credentials: { expired: 0 },
    evidence: { total: 3, uploaded: 2 },
    blockers: ["1 modules incomplete", "1 evidence items missing"],
  };
  if (procedure === "m1.generateDocumentId") return { documentId: "ADL-HR-ONB-202606-0001" };
  if (procedure === "m1.listDocumentTemplates") return [
    { id: "dt1", template_name: "Employee Onboarding Checklist", template_code: "ONB-001", category: "HR", description: "Standard onboarding checklist for new hires", is_active: 1 },
    { id: "dt2", template_name: "Credential Verification Form", template_code: "CRED-001", category: "HR", description: "Credential expiry verification template", is_active: 1 },
    { id: "dt3", template_name: "Incident Report", template_code: "INC-001", category: "GRO", description: "Youth incident report template", is_active: 1 },
    { id: "dt4", template_name: "Treatment Plan Review", template_code: "TPR-001", category: "Clinical", description: "Clinical treatment plan review form", is_active: 1 },
    { id: "dt5", template_name: "CAP Corrective Action", template_code: "CAP-001", category: "QA", description: "Corrective action plan template", is_active: 1 },
    { id: "dt6", template_name: "Release-to-Duty Assessment", template_code: "RTD-001", category: "HR", description: "Pre-duty clearance assessment", is_active: 1 },
  ];
  if (procedure === "m1.listEvidencePackets") return [
    { id: "ep1", packet_name: "Jonthan Guidry - Onboarding Packet", packet_type: "onboarding", person_id: "h4", status: "in-progress", document_ids_json: "[]", assembled_by: "HR Director", assembled_at: "2026-06-20" },
    { id: "ep2", packet_name: "RCS Lead - Credential Verification", packet_type: "credential", person_id: "h5", status: "assembled", document_ids_json: "[]", assembled_by: "HR Director", assembled_at: "2026-06-18" },
  ];
  if (procedure === "m1.getWorkQueue") return [
    { id: "wq1", task_title: "Review onboarding progress - J. Guidry", task_type: "review", assigned_to: "hr@adolbi.com", priority: "high", status: "pending", entity_type: "onboarding", entity_id: "h4", evidence_required: 1, due_date: "2026-07-01" },
    { id: "wq2", task_title: "Verify CPR cert expiry - RCS Lead", task_type: "credential-check", assigned_to: "hr@adolbi.com", priority: "urgent", status: "pending", entity_type: "credential", entity_id: "h5", evidence_required: 1, due_date: "2026-06-28" },
    { id: "wq3", task_title: "Complete LPC renewal application", task_type: "renewal", assigned_to: "j.guidry@adolbi.com", priority: "high", status: "in-progress", entity_type: "credential", entity_id: "h4", evidence_required: 1, due_date: "2026-07-15" },
    { id: "wq4", task_title: "Assemble RTD packet - RCS Lead", task_type: "packet-assembly", assigned_to: "hr@adolbi.com", priority: "medium", status: "pending", entity_type: "evidence-packet", entity_id: "h5", evidence_required: 1, due_date: "2026-07-05" },
  ];
  if (procedure === "m1.checkCredentialAlerts") return { checked: 3, expired: 0, warning: 2 };
  if (procedure === "m1.transitionTaskStatus") return { success: true, toStatus: "completed" };
  // ─── M2 ENDPOINTS ────────────────────────────────────────
  if (procedure === "m2.stats") return {
    total: 12, draft: 3, inReview: 2, approved: 2, published: 4, archived: 1, superseded: 0,
    byStatus: { draft: 3, "in-review": 2, approved: 2, published: 4, archived: 1, superseded: 0 },
    byCategory: { "HR Policies": 3, "Clinical Protocols": 2, "GRO Operations": 2, "QA & Compliance": 2, "Training Materials": 2, "Form Templates": 1 },
    byDepartment: { HR: 5, Clinical: 2, GRO: 2, QA: 2, All: 1 },
    recent: [
      { id: "d1", documentId: "ADL-HR-POL-202606-0001", title: "Employee Handbook v2026", status: "published", createdAt: "2026-06-15T10:00:00Z" },
      { id: "d2", documentId: "ADL-CLN-PRO-202606-0002", title: "Crisis Intervention Protocol", status: "approved", createdAt: "2026-06-14T14:30:00Z" },
      { id: "d3", documentId: "ADL-GRO-OPS-202606-0003", title: "Youth Intake Procedures", status: "in-review", createdAt: "2026-06-13T09:15:00Z" },
      { id: "d4", documentId: "ADL-QA-COM-202606-0004", title: "CAPA Procedure Manual", status: "published", createdAt: "2026-06-12T11:00:00Z" },
      { id: "d5", documentId: "ADL-HR-TRN-202606-0005", title: "Orientation Training Guide", status: "draft", createdAt: "2026-06-11T16:45:00Z" },
    ],
  };
  if (procedure === "m2.list") return {
    documents: [
      { id: "d1", documentId: "ADL-HR-POL-202606-0001", title: "Employee Handbook v2026", description: "Comprehensive employee handbook covering policies, benefits, and procedures for all staff.", categoryId: "cat1", category: "HR Policies", department: "HR", status: "published", version: 3, authorId: "u1", authorName: "E. Russ Aideyan", fileName: "employee-handbook-2026.pdf", fileType: "pdf", fileSize: 2450000, tagsJson: '["policy","handbook","all-staff"]', permissionsJson: '["all"]', retentionYears: 7, createdAt: "2026-06-15T10:00:00Z", updatedAt: "2026-06-20T08:30:00Z", publishedAt: "2026-06-20T08:30:00Z", publishedBy: "E. Russ Aideyan" },
      { id: "d2", documentId: "ADL-CLN-PRO-202606-0002", title: "Crisis Intervention Protocol", description: "Step-by-step crisis intervention procedures for clinical staff working with youth.", categoryId: "cat2", category: "Clinical Protocols", department: "Clinical", status: "approved", version: 2, authorId: "u2", authorName: "Dr. Hall", fileName: "crisis-protocol-v2.pdf", fileType: "pdf", fileSize: 1800000, tagsJson: '["clinical","crisis","safety","protocol"]', permissionsJson: '["clinical-director","case-manager","supervisor"]', retentionYears: 10, createdAt: "2026-06-14T14:30:00Z", updatedAt: "2026-06-19T12:00:00Z", approvedAt: "2026-06-19T12:00:00Z", approvedBy: "Dr. Hall" },
      { id: "d3", documentId: "ADL-GRO-OPS-202606-0003", title: "Youth Intake Procedures", description: "Standard operating procedures for admitting new residents to the GRO facility.", categoryId: "cat3", category: "GRO Operations", department: "GRO", status: "in-review", version: 1, authorId: "u6", authorName: "GRO Admin", fileName: "intake-procedures-v1.docx", fileType: "docx", fileSize: 950000, tagsJson: '["gro","intake","residential","sop"]', permissionsJson: '["gro-administrator","rcs-lead","rcs-day"]', retentionYears: 7, createdAt: "2026-06-13T09:15:00Z", updatedAt: "2026-06-18T15:30:00Z" },
      { id: "d4", documentId: "ADL-QA-COM-202606-0004", title: "CAPA Procedure Manual", description: "Corrective and Preventive Action procedures for QA compliance.", categoryId: "cat4", category: "QA & Compliance", department: "QA", status: "published", version: 4, authorId: "u1", authorName: "E. Russ Aideyan", fileName: "capa-manual-v4.pdf", fileType: "pdf", fileSize: 3200000, tagsJson: '["qa","capa","compliance","audit"]', permissionsJson: '["all"]', retentionYears: 10, createdAt: "2026-06-12T11:00:00Z", updatedAt: "2026-06-25T10:00:00Z", publishedAt: "2026-06-25T10:00:00Z", publishedBy: "E. Russ Aideyan" },
      { id: "d5", documentId: "ADL-HR-TRN-202606-0005", title: "Orientation Training Guide", description: "Training guide for new employee orientation covering all required modules.", categoryId: "cat7", category: "Training Materials", department: "HR", status: "draft", version: 1, authorId: "u5", authorName: "HR Director", fileName: "orientation-guide-draft.docx", fileType: "docx", fileSize: 1500000, tagsJson: '["training","orientation","new-hire"]', permissionsJson: '["hr-director","supervisor"]', retentionYears: 5, createdAt: "2026-06-11T16:45:00Z", updatedAt: "2026-06-11T16:45:00Z" },
      { id: "d6", documentId: "ADL-HR-POL-202606-0006", title: "Code of Conduct", description: "Ethical guidelines and code of conduct for all Adolbi Care employees.", categoryId: "cat1", category: "HR Policies", department: "HR", status: "published", version: 2, authorId: "u1", authorName: "E. Russ Aideyan", fileName: "code-of-conduct-v2.pdf", fileType: "pdf", fileSize: 1200000, tagsJson: '["policy","ethics","conduct"]', permissionsJson: '["all"]', retentionYears: 10, createdAt: "2026-06-10T09:00:00Z", updatedAt: "2026-06-22T14:00:00Z", publishedAt: "2026-06-22T14:00:00Z", publishedBy: "E. Russ Aideyan" },
      { id: "d7", documentId: "ADL-CLN-PRO-202606-0007", title: "Medication Administration Protocol", description: "Procedures for administering and documenting medication for residential youth.", categoryId: "cat2", category: "Clinical Protocols", department: "Clinical", status: "published", version: 5, authorId: "u3", authorName: "Lilian Ike", fileName: "med-admin-protocol-v5.pdf", fileType: "pdf", fileSize: 2800000, tagsJson: '["clinical","medication","safety","protocol"]', permissionsJson: '["clinical-director","case-manager","nurse"]', retentionYears: 10, createdAt: "2026-06-09T13:20:00Z", updatedAt: "2026-06-28T09:00:00Z", publishedAt: "2026-06-28T09:00:00Z", publishedBy: "Lilian Ike" },
      { id: "d8", documentId: "ADL-GRO-OPS-202606-0008", title: "Incident Reporting Guide", description: "Guidelines for reporting and documenting incidents involving youth residents.", categoryId: "cat8", category: "Incident Reports", department: "GRO", status: "archived", version: 1, authorId: "u6", authorName: "GRO Admin", fileName: "incident-guide-v1.pdf", fileType: "pdf", fileSize: 890000, tagsJson: '["gro","incident","reporting","safety"]', permissionsJson: '["all"]', retentionYears: 7, archivedAt: "2026-06-25T16:00:00Z", archivedBy: "E. Russ Aideyan", archiveReason: "Superseded by new version", createdAt: "2026-06-08T10:30:00Z", updatedAt: "2026-06-25T16:00:00Z" },
      { id: "d9", documentId: "ADL-HR-POL-202606-0009", title: "Leave Policy 2026", description: "Updated leave and PTO policies effective January 2026.", categoryId: "cat1", category: "HR Policies", department: "HR", status: "draft", version: 1, authorId: "u5", authorName: "HR Director", fileName: "leave-policy-2026-draft.docx", fileType: "docx", fileSize: 680000, tagsJson: '["policy","leave","pto","benefits"]', permissionsJson: '["hr-director","super-admin"]', retentionYears: 7, createdAt: "2026-06-07T11:00:00Z", updatedAt: "2026-06-07T11:00:00Z" },
      { id: "d10", documentId: "ADL-QA-COM-202606-0010", title: "Internal Audit Checklist", description: "Comprehensive checklist for conducting internal quality audits.", categoryId: "cat4", category: "QA & Compliance", department: "QA", status: "in-review", version: 2, authorId: "u1", authorName: "E. Russ Aideyan", fileName: "audit-checklist-v2.xlsx", fileType: "xlsx", fileSize: 450000, tagsJson: '["qa","audit","checklist","compliance"]', permissionsJson: '["qa-officer","supervisor","super-admin"]', retentionYears: 7, createdAt: "2026-06-06T14:00:00Z", updatedAt: "2026-06-27T10:30:00Z" },
      { id: "d11", documentId: "ADL-HR-TRN-202606-0011", title: "CPR Certification Guide", description: "Guide for maintaining CPR certification requirements for all staff.", categoryId: "cat7", category: "Training Materials", department: "HR", status: "approved", version: 3, authorId: "u5", authorName: "HR Director", fileName: "cpr-guide-v3.pdf", fileType: "pdf", fileSize: 2100000, tagsJson: '["training","cpr","certification","safety"]', permissionsJson: '["all"]', retentionYears: 5, createdAt: "2026-06-05T08:45:00Z", updatedAt: "2026-06-26T11:15:00Z", approvedAt: "2026-06-26T11:15:00Z", approvedBy: "HR Director" },
      { id: "d12", documentId: "ADL-ALL-FRM-202606-0012", title: "Youth Admission Form", description: "Standard admission form template for new youth residents.", categoryId: "cat9", category: "Form Templates", department: "All", status: "published", version: 6, authorId: "u6", authorName: "GRO Admin", fileName: "admission-form-template-v6.pdf", fileType: "pdf", fileSize: 750000, tagsJson: '["form","template","admission","youth"]', permissionsJson: '["all"]', retentionYears: 10, createdAt: "2026-06-04T09:30:00Z", updatedAt: "2026-06-29T08:00:00Z", publishedAt: "2026-06-29T08:00:00Z", publishedBy: "GRO Admin" },
    ],
    total: 12, page: 1, pageSize: 20,
  };
  if (procedure === "m2.listCategories") return [
    { id: "cat1", name: "HR Policies", code: "HR-POL", description: "Human resources policies and procedures", department: "HR", isActive: 1, sortOrder: 0 },
    { id: "cat2", name: "Clinical Protocols", code: "CLN-PRO", description: "Clinical treatment protocols and procedures", department: "Clinical", isActive: 1, sortOrder: 1 },
    { id: "cat3", name: "GRO Operations", code: "GRO-OPS", description: "Residential facility operations manuals", department: "GRO", isActive: 1, sortOrder: 2 },
    { id: "cat4", name: "QA & Compliance", code: "QA-COMP", description: "Quality assurance and compliance documentation", department: "QA", isActive: 1, sortOrder: 3 },
    { id: "cat5", name: "Revenue Cycle", code: "REV-CYC", description: "Revenue cycle management documentation", department: "Revenue", isActive: 1, sortOrder: 4 },
    { id: "cat6", name: "GAD Administration", code: "GAD-ADM", description: "General administration documentation", department: "GAD", isActive: 1, sortOrder: 5 },
    { id: "cat7", name: "Training Materials", code: "TRN-MAT", description: "Training and educational materials", department: "HR", isActive: 1, sortOrder: 6 },
    { id: "cat8", name: "Incident Reports", code: "INC-RPT", description: "Incident and event reports", department: "GRO", isActive: 1, sortOrder: 7 },
    { id: "cat9", name: "Form Templates", code: "FRM-TPL", description: "Standard form templates", department: "All", isActive: 1, sortOrder: 8 },
    { id: "cat10", name: "Executive", code: "EXEC", description: "Executive-level documentation", department: "Executive", isActive: 1, sortOrder: 9 },
  ];
  if (procedure === "m2.getById") return {
    id: "d1", documentId: "ADL-HR-POL-202606-0001", title: "Employee Handbook v2026", description: "Comprehensive employee handbook covering policies, benefits, and procedures for all staff.", categoryId: "cat1", category: "HR Policies", department: "HR", status: "published", version: 3, authorId: "u1", authorName: "E. Russ Aideyan", fileName: "employee-handbook-2026.pdf", fileType: "pdf", fileSize: 2450000, tagsJson: '["policy","handbook","all-staff"]', permissionsJson: '["all"]', retentionYears: 7, createdAt: "2026-06-15T10:00:00Z", updatedAt: "2026-06-20T08:30:00Z", publishedAt: "2026-06-20T08:30:00Z", publishedBy: "E. Russ Aideyan",
    versions: [
      { id: "v3", documentId: "ADL-HR-POL-202606-0001", versionNumber: 3, changeSummary: "Updated benefits section and added remote work policy", fileName: "employee-handbook-2026.pdf", fileSize: 2450000, createdBy: "E. Russ Aideyan", createdAt: "2026-06-20T08:30:00Z" },
      { id: "v2", documentId: "ADL-HR-POL-202606-0001", versionNumber: 2, changeSummary: "Revised PTO accrual rates", fileName: "employee-handbook-v2.pdf", fileSize: 2200000, createdBy: "HR Director", createdAt: "2026-03-15T14:00:00Z" },
      { id: "v1", documentId: "ADL-HR-POL-202606-0001", versionNumber: 1, changeSummary: "Initial release", fileName: "employee-handbook-v1.pdf", fileSize: 2000000, createdBy: "E. Russ Aideyan", createdAt: "2026-01-10T09:00:00Z" },
    ],
    audit: [
      { id: "a1", documentId: "ADL-HR-POL-202606-0001", action: "status-changed", actorId: "u1", actorName: "E. Russ Aideyan", fromStatus: "approved", toStatus: "published", details: "Published after final review", createdAt: "2026-06-20T08:30:00Z" },
      { id: "a2", documentId: "ADL-HR-POL-202606-0001", action: "status-changed", actorId: "u1", actorName: "E. Russ Aideyan", fromStatus: "in-review", toStatus: "approved", details: "Approved with minor edits", createdAt: "2026-06-19T16:00:00Z" },
      { id: "a3", documentId: "ADL-HR-POL-202606-0001", action: "created", actorId: "u1", actorName: "E. Russ Aideyan", toStatus: "draft", details: "Document created: Employee Handbook v2026", createdAt: "2026-06-15T10:00:00Z" },
    ],
  };
  if (procedure === "m2.create" || procedure === "m2.update" || procedure === "m2.delete" || procedure === "m2.transitionStatus" || procedure === "m2.createVersion" || procedure === "m2.seedCategories") return { success: true };
  // ─── M3 ENDPOINTS (QA & Compliance) ──────────────────────
  if (procedure === "m3.dashboardKPIs") return {
    totalAudits: 5, openAudits: 2, completedAudits: 3, avgScore: 94,
    totalIncidents: 4, openIncidents: 1, criticalIncidents: 0,
    totalCAPAs: 6, openCAPAs: 3, overdueCAPAs: 1, highPriorityCAPAs: 2,
  };
  if (procedure === "m3.complianceScores") return [
    { area: "HIPAA Privacy", score: 98, status: "compliant", lastAudited: "2026-06-15" },
    { area: "HIPAA Security", score: 96, status: "compliant", lastAudited: "2026-06-10" },
    { area: "42 CFR Part 2", score: 100, status: "compliant", lastAudited: "2026-06-20" },
    { area: "State Licensure", score: 92, status: "warning", lastAudited: "2026-05-28" },
    { area: "Staff Credentials", score: 88, status: "warning", lastAudited: "2026-06-01" },
    { area: "Incident Reporting", score: 100, status: "compliant", lastAudited: "2026-06-25" },
    { area: "Medication Management", score: 95, status: "compliant", lastAudited: "2026-06-18" },
    { area: "Youth Rights", score: 97, status: "compliant", lastAudited: "2026-06-12" },
  ];
  if (procedure === "m3.listAudits") return [
    { id: "a1", auditNumber: "AUD-2026-001", title: "Q2 Internal Audit — Clinical Documentation", auditType: "internal", scope: "Review of clinical session notes, treatment plans, and outcome measures for all active patients.", status: "completed", assignedAuditorId: "u1", department: "Clinical", findingsJson: '[{"finding":"Two session notes missing signatures","severity":"minor","status":"resolved"},{"finding":"One treatment plan overdue for review","severity":"moderate","status":"open"}]', score: 94, startedAt: "2026-06-01T09:00:00Z", completedAt: "2026-06-15T16:00:00Z", dueDate: "2026-06-15", createdAt: "2026-06-01T09:00:00Z", updatedAt: "2026-06-15T16:00:00Z" },
    { id: "a2", auditNumber: "AUD-2026-002", title: "Annual HIPAA Privacy Assessment", auditType: "regulatory", scope: "Comprehensive review of HIPAA privacy practices including access logs, BAAs, and staff training records.", status: "in_progress", assignedAuditorId: "u5", department: "All", findingsJson: "[]", score: null, startedAt: "2026-06-20T08:00:00Z", completedAt: null, dueDate: "2026-07-10", createdAt: "2026-06-20T08:00:00Z", updatedAt: "2026-06-27T14:00:00Z" },
    { id: "a3", auditNumber: "AUD-2026-003", title: "GRO Residential Safety Inspection", auditType: "internal", scope: "Physical safety inspection of GRO facility including fire safety, medication storage, and youth common areas.", status: "completed", assignedAuditorId: "u6", department: "GRO", findingsJson: '[{"finding":"Expired fire extinguisher in wing B","severity":"major","status":"resolved"},{"finding":"Missing safety sign in laundry room","severity":"minor","status":"resolved"}]', score: 97, startedAt: "2026-06-10T10:00:00Z", completedAt: "2026-06-18T12:00:00Z", dueDate: "2026-06-20", createdAt: "2026-06-10T10:00:00Z", updatedAt: "2026-06-18T12:00:00Z" },
    { id: "a4", auditNumber: "AUD-2026-004", title: "Staff Credential Verification", auditType: "regulatory", scope: "Verify all clinical staff credentials are current and properly documented in personnel files.", status: "planned", assignedAuditorId: "u5", department: "HR", findingsJson: "[]", score: null, startedAt: null, completedAt: null, dueDate: "2026-07-15", createdAt: "2026-06-25T09:00:00Z", updatedAt: "2026-06-25T09:00:00Z" },
    { id: "a5", auditNumber: "AUD-2026-005", title: "Revenue Cycle Billing Accuracy", auditType: "peer_review", scope: "Random sample review of submitted claims for coding accuracy and documentation support.", status: "completed", assignedAuditorId: "u1", department: "Revenue", findingsJson: '[{"finding":"3 claims missing required authorization numbers","severity":"moderate","status":"open"}]', score: 91, startedAt: "2026-06-05T11:00:00Z", completedAt: "2026-06-22T15:00:00Z", dueDate: "2026-06-30", createdAt: "2026-06-05T11:00:00Z", updatedAt: "2026-06-22T15:00:00Z" },
  ];
  if (procedure === "m3.listIncidents") return [
    { id: "i1", incidentNumber: "INC-2026-001", title: "Youth eloped from common area", description: "Resident left the common area unsupervised during transition between activities. Found in courtyard within 5 minutes.", incidentType: "behavioral", severity: "high", status: "resolved", patientId: "p1", reportedBy: "rcs-day@adolbi.com", assignedTo: "gro.admin@adolbi.com", occurredAt: "2026-06-15T14:30:00Z", resolvedAt: "2026-06-15T14:35:00Z", resolutionNotes: "Youth returned to unit. Behavioral assessment completed. Increased transition monitoring implemented.", followUpRequired: 1, followUpDate: "2026-07-15", createdAt: "2026-06-15T14:30:00Z", updatedAt: "2026-06-15T16:00:00Z" },
    { id: "i2", incidentNumber: "INC-2026-002", title: "Medication administration delay", description: "Evening medication round delayed by 45 minutes due to pharmacy delivery issue.", incidentType: "medication_error", severity: "moderate", status: "resolved", patientId: "p2", reportedBy: "nurse@adolbi.com", assignedTo: "clinical-director@adolbi.com", occurredAt: "2026-06-18T20:00:00Z", resolvedAt: "2026-06-18T21:15:00Z", resolutionNotes: "Medications administered after pharmacy delivery. No adverse effects noted. Process review scheduled.", followUpRequired: 1, followUpDate: "2026-07-05", createdAt: "2026-06-18T20:00:00Z", updatedAt: "2026-06-18T21:15:00Z" },
    { id: "i3", incidentNumber: "INC-2026-003", title: "Visitor signed in without ID check", description: "A visitor was allowed to sign in without proper photo ID verification during busy intake period.", incidentType: "other", severity: "moderate", status: "under_investigation", patientId: null, reportedBy: "rcs-lead@adolbi.com", assignedTo: "gro.admin@adolbi.com", occurredAt: "2026-06-25T10:15:00Z", resolvedAt: null, resolutionNotes: null, followUpRequired: 1, followUpDate: "2026-07-10", createdAt: "2026-06-25T10:15:00Z", updatedAt: "2026-06-26T09:00:00Z" },
    { id: "i4", incidentNumber: "INC-2026-004", title: "Equipment malfunction — vital signs monitor", description: "Vital signs monitor in the clinic displayed inaccurate readings. Device removed from service.", incidentType: "equipment", severity: "low", status: "resolved", patientId: null, reportedBy: "clinical-director@adolbi.com", assignedTo: "gad.ops@adolbi.com", occurredAt: "2026-06-28T08:00:00Z", resolvedAt: "2026-06-28T14:00:00Z", resolutionNotes: "Device replaced with backup unit. Manufacturer service request submitted for repair.", followUpRequired: 0, followUpDate: null, createdAt: "2026-06-28T08:00:00Z", updatedAt: "2026-06-28T14:00:00Z" },
  ];
  if (procedure === "m3.listCorrectiveActions") return [
    { id: "ca1", actionNumber: "CAPA-2026-001", title: "Implement dual-signature medication check", description: "Require two licensed staff to verify all medication administrations after the June 18 delay incident.", relatedAuditId: null, relatedIncidentId: "i2", priority: "high", status: "in_progress", assignedTo: "clinical-director@adolbi.com", dueDate: "2026-07-20", completedAt: null, completionNotes: null, verifiedBy: null, verifiedAt: null, createdAt: "2026-06-19T09:00:00Z", updatedAt: "2026-06-27T10:00:00Z" },
    { id: "ca2", actionNumber: "CAPA-2026-002", title: "Update visitor sign-in procedures", description: "Revise visitor management SOP to require photo ID for all visitors regardless of familiarity.", relatedAuditId: null, relatedIncidentId: "i3", priority: "urgent", status: "open", assignedTo: "gro.admin@adolbi.com", dueDate: "2026-07-05", completedAt: null, completionNotes: null, verifiedBy: null, verifiedAt: null, createdAt: "2026-06-26T09:00:00Z", updatedAt: "2026-06-26T09:00:00Z" },
    { id: "ca3", actionNumber: "CAPA-2026-003", title: "Transition monitoring enhancement", description: "Add additional RCS staffing during activity transitions. Implement check-in protocol.", relatedAuditId: null, relatedIncidentId: "i1", priority: "high", status: "completed", assignedTo: "rcs-lead@adolbi.com", dueDate: "2026-07-01", completedAt: "2026-06-20T12:00:00Z", completionNotes: "Additional RCS assigned to transition periods. New check-in protocol implemented and staff trained.", verifiedBy: "E. Russ Aideyan", verifiedAt: "2026-06-22T10:00:00Z", createdAt: "2026-06-16T08:00:00Z", updatedAt: "2026-06-22T10:00:00Z" },
    { id: "ca4", actionNumber: "CAPA-2026-004", title: "Fire extinguisher inspection schedule", description: "Establish monthly fire extinguisher inspection schedule with documentation requirements.", relatedAuditId: "a3", relatedIncidentId: null, priority: "medium", status: "completed", assignedTo: "gad.ops@adolbi.com", dueDate: "2026-06-25", completedAt: "2026-06-19T14:00:00Z", completionNotes: "Monthly inspection calendar created. GAD team assigned recurring inspections.", verifiedBy: "E. Russ Aideyan", verifiedAt: "2026-06-20T09:00:00Z", createdAt: "2026-06-18T13:00:00Z", updatedAt: "2026-06-20T09:00:00Z" },
    { id: "ca5", actionNumber: "CAPA-2026-005", title: "Claims authorization verification process", description: "Implement pre-submission authorization verification for all claims before billing submission.", relatedAuditId: "a5", relatedIncidentId: null, priority: "medium", status: "in_progress", assignedTo: "revenue@adolbi.com", dueDate: "2026-07-15", completedAt: null, completionNotes: null, verifiedBy: null, verifiedAt: null, createdAt: "2026-06-23T11:00:00Z", updatedAt: "2026-06-27T15:00:00Z" },
    { id: "ca6", actionNumber: "CAPA-2026-006", title: "Equipment maintenance log digitization", description: "Move all equipment maintenance tracking from paper to AMOS-Ops digital system.", relatedAuditId: null, relatedIncidentId: "i4", priority: "low", status: "open", assignedTo: "gad.ops@adolbi.com", dueDate: "2026-08-01", completedAt: null, completionNotes: null, verifiedBy: null, verifiedAt: null, createdAt: "2026-06-28T15:00:00Z", updatedAt: "2026-06-28T15:00:00Z" },
  ];
  if (procedure === "m3.getAudit" || procedure === "m3.getIncident" || procedure === "m3.getCorrectiveAction") return { id: "a1" };
  // ─── M4 ENDPOINTS (Revenue Cycle) ────────────────────────
  if (procedure === "m4.dashboardKPIs") return {
    totalClaims: 8, totalBilled: 5285000, totalCollected: 3250000, collectionRate: 61,
    pendingClaims: 2, submittedClaims: 1, approvedClaims: 1, deniedClaims: 1, paidClaims: 2, appealedClaims: 1,
    aging30: 1250000, aging60: 875000, aging90: 625000,
  };
  if (procedure === "m4.agingReport") return [
    { label: "0-30 Days", total: 1250000, count: 3 },
    { label: "31-60 Days", total: 875000, count: 2 },
    { label: "61-90 Days", total: 625000, count: 2 },
    { label: "91-120 Days", total: 375000, count: 1 },
    { label: "120+ Days", total: 0, count: 0 },
  ];
  if (procedure === "m4.listPayers") return [
    { id: "py1", name: "Texas Medicaid", payerType: "medicaid", contactPhone: "1-800-555-0100", contactEmail: "provider@txmedicaid.tx.gov", claimsAddress: "PO Box 149021, Austin, TX 78714", isActive: 1, createdAt: "2026-01-01" },
    { id: "py2", name: "Blue Cross Blue Shield TX", payerType: "insurance", contactPhone: "1-800-555-0200", contactEmail: "claims@bcbstx.com", claimsAddress: "PO Box 660044, Dallas, TX 75266", isActive: 1, createdAt: "2026-01-01" },
    { id: "py3", name: "Aetna Better Health", payerType: "insurance", contactPhone: "1-800-555-0300", contactEmail: "claims@aetna.com", claimsAddress: "PO Box 14079, Lexington, KY 40512", isActive: 1, createdAt: "2026-01-01" },
    { id: "py4", name: "UnitedHealthcare", payerType: "insurance", contactPhone: "1-800-555-0400", contactEmail: "claims@uhc.com", claimsAddress: "PO Box 30555, Salt Lake City, UT 84130", isActive: 1, createdAt: "2026-01-01" },
    { id: "py5", name: "Self-Pay", payerType: "self_pay", contactPhone: null, contactEmail: null, claimsAddress: null, isActive: 1, createdAt: "2026-01-01" },
  ];
  if (procedure === "m4.listClaims") return {
    claims: [
      { id: "c1", claimNumber: "CLM-2026-001", patientId: "Youth A", payerId: "py1", payerName: "Texas Medicaid", clinicianId: "u2", serviceDate: "2026-06-01", submissionDate: "2026-06-03", status: "paid", totalAmount: 1250000, paidAmount: 1250000, balance: 0, denialReason: null, denialCode: null, appealStatus: "not_appealed", createdAt: "2026-06-01" },
      { id: "c2", claimNumber: "CLM-2026-002", patientId: "Youth B", payerId: "py2", payerName: "Blue Cross Blue Shield TX", clinicianId: "u3", serviceDate: "2026-06-05", submissionDate: "2026-06-07", status: "paid", totalAmount: 2000000, paidAmount: 2000000, balance: 0, denialReason: null, denialCode: null, appealStatus: "not_appealed", createdAt: "2026-06-05" },
      { id: "c3", claimNumber: "CLM-2026-003", patientId: "Youth C", payerId: "py3", payerName: "Aetna Better Health", clinicianId: "u4", serviceDate: "2026-06-10", submissionDate: "2026-06-12", status: "denied", totalAmount: 875000, paidAmount: 0, balance: 875000, denialReason: "Authorization not on file at time of service", denialCode: "CO-29", appealStatus: "not_appealed", createdAt: "2026-06-10" },
      { id: "c4", claimNumber: "CLM-2026-004", patientId: "Youth D", payerId: "py1", payerName: "Texas Medicaid", clinicianId: "u2", serviceDate: "2026-06-15", submissionDate: null, status: "pending", totalAmount: 560000, paidAmount: 0, balance: 560000, denialReason: null, denialCode: null, appealStatus: "not_appealed", createdAt: "2026-06-15" },
      { id: "c5", claimNumber: "CLM-2026-005", patientId: "Youth E", payerId: "py4", payerName: "UnitedHealthcare", clinicianId: "u3", serviceDate: "2026-06-18", submissionDate: "2026-06-20", status: "submitted", totalAmount: 1500000, paidAmount: 0, balance: 1500000, denialReason: null, denialCode: null, appealStatus: "not_appealed", createdAt: "2026-06-18" },
      { id: "c6", claimNumber: "CLM-2026-006", patientId: "Youth A", payerId: "py2", payerName: "Blue Cross Blue Shield TX", clinicianId: "u4", serviceDate: "2026-06-22", submissionDate: null, status: "draft", totalAmount: 375000, paidAmount: 0, balance: 375000, denialReason: null, denialCode: null, appealStatus: "not_appealed", createdAt: "2026-06-22" },
      { id: "c7", claimNumber: "CLM-2026-007", patientId: "Youth B", payerId: "py3", payerName: "Aetna Better Health", clinicianId: "u2", serviceDate: "2026-06-25", submissionDate: "2026-06-27", status: "appealed", totalAmount: 950000, paidAmount: 0, balance: 950000, denialReason: "Service not medically necessary — documentation insufficient", denialCode: "CO-50", appealStatus: "in_review", createdAt: "2026-06-25" },
      { id: "c8", claimNumber: "CLM-2026-008", patientId: "Youth C", payerId: "py1", payerName: "Texas Medicaid", clinicianId: "u3", serviceDate: "2026-06-28", submissionDate: null, status: "draft", totalAmount: 480000, paidAmount: 0, balance: 480000, denialReason: null, denialCode: null, appealStatus: "not_appealed", createdAt: "2026-06-28" },
    ],
    total: 8, page: 1, pageSize: 25,
  };
  if (procedure === "m4.getClaim") return {
    id: "c1", claimNumber: "CLM-2026-001", patientId: "Youth A", payerId: "py1", payerName: "Texas Medicaid", clinicianId: "u2", serviceDate: "2026-06-01", submissionDate: "2026-06-03", status: "paid", totalAmount: 1250000, allowedAmount: 1250000, paidAmount: 1250000, patientResponsibility: 0, denialReason: null, denialCode: null, appealDate: null, appealStatus: "not_appealed", notes: "Full payment received. Clean claim.", createdAt: "2026-06-01", updatedAt: "2026-06-15",
    balance: 0,
    lineItems: [
      { id: "li1", claimId: "c1", serviceDate: "2026-06-01", procedureCode: "H0031", diagnosisCode: "F32.9", units: 1, unitPrice: 250000, totalPrice: 250000, description: "Mental health assessment by non-physician" },
      { id: "li2", claimId: "c1", serviceDate: "2026-06-01", procedureCode: "H0035", diagnosisCode: "F32.9", units: 10, unitPrice: 100000, totalPrice: 1000000, description: "Residential treatment — per diem" },
    ],
  };
  if (procedure === "m4.createClaim" || procedure === "m4.updateClaim") return { success: true };
  // ─── NEW M4: Revenue Cycle 7-Feature Extension ───────────
  if (procedure === "m4.listSubmittableClaims") return [
    { id: "c6", claimNumber: "CLM-2026-006", patientId: "Youth A", payerId: "py2", payerName: "Blue Cross Blue Shield TX", clinicianId: "u4", serviceDate: "2026-06-22", submissionDate: null, status: "draft", totalAmount: 375000, paidAmount: 0, balance: 375000, denialReason: null, denialCode: null, appealStatus: "not_appealed", createdAt: "2026-06-22" },
    { id: "c8", claimNumber: "CLM-2026-008", patientId: "Youth C", payerId: "py1", payerName: "Texas Medicaid", clinicianId: "u3", serviceDate: "2026-06-28", submissionDate: null, status: "draft", totalAmount: 480000, paidAmount: 0, balance: 480000, denialReason: null, denialCode: null, appealStatus: "not_appealed", createdAt: "2026-06-28" },
  ];
  if (procedure === "m4.submitClaim" || procedure === "m4.batchSubmitClaims") return { success: true, submissionDate: new Date().toISOString() };
  if (procedure === "m4.listAuthorizations") return {
    authorizations: [
      { id: "az1", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-4521", payerName: "Texas Medicaid", policyNumber: "TXM-88765432", stage: "tracking", status: "approved", authorizationNumber: "AUTH-2026-1122", approvedUnits: 30, approvedFromDate: "2026-06-01", approvedToDate: "2026-08-31", approvedLevelOfCare: "Intensive Outpatient", readinessMetAt: "2026-05-28", readinessClinicalDocs: true, readinessAssessmentCurrent: true, readinessLOCSupported: true, readinessTreatmentPlan: true, readinessProgressNotes: true, readinessMedicalNecessity: true, readinessUtilizationReview: true, readinessGuardianConsent: true, readinessUB04Clean: true, readinessExcludedServices: true, submissionDate: "2026-05-28", submittedBy: "billing@adolbi.com", submissionMethod: "portal", submissionReference: null, denialReason: null, appealDate: null, appealStatus: null, reauthDueDate: "2026-08-15", reauthStatus: "upcoming", daysUntilExpiration: 45, createdAt: "2026-05-01", updatedAt: "2026-06-28" },
      { id: "az2", youthId: "youth-002", youthName: "Aaliyah Williams", mrn: "MRN-2026-4522", payerName: "Blue Cross Blue Shield TX", policyNumber: "BCBS-223344", stage: "readiness", status: "in_progress", authorizationNumber: null, approvedUnits: null, approvedFromDate: null, approvedToDate: null, approvedLevelOfCare: null, readinessMetAt: null, readinessClinicalDocs: true, readinessAssessmentCurrent: true, readinessLOCSupported: true, readinessTreatmentPlan: true, readinessProgressNotes: true, readinessMedicalNecessity: false, readinessUtilizationReview: true, readinessGuardianConsent: true, readinessUB04Clean: true, readinessExcludedServices: true, submissionDate: null, submittedBy: null, submissionMethod: null, submissionReference: null, denialReason: null, appealDate: null, appealStatus: null, reauthDueDate: null, reauthStatus: "not_due", daysUntilExpiration: null, createdAt: "2026-06-15", updatedAt: "2026-06-28" },
      { id: "az3", youthId: "youth-003", youthName: "Carlos Martinez", mrn: "MRN-2026-4523", payerName: "Aetna Better Health", policyNumber: "ABH-998877", stage: "submission", status: "submitted", authorizationNumber: null, approvedUnits: null, approvedFromDate: null, approvedToDate: null, approvedLevelOfCare: null, readinessMetAt: "2026-06-20", readinessClinicalDocs: true, readinessAssessmentCurrent: true, readinessLOCSupported: true, readinessTreatmentPlan: true, readinessProgressNotes: true, readinessMedicalNecessity: true, readinessUtilizationReview: true, readinessGuardianConsent: true, readinessUB04Clean: true, readinessExcludedServices: true, submissionDate: "2026-06-25", submittedBy: "billing@adolbi.com", submissionMethod: "fax", submissionReference: "FAX-REF-998877", denialReason: null, appealDate: null, appealStatus: null, reauthDueDate: null, reauthStatus: "not_due", daysUntilExpiration: null, createdAt: "2026-06-10", updatedAt: "2026-06-25" },
      { id: "az4", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-4521", payerName: "Texas Medicaid", policyNumber: "TXM-88765432", stage: "reauthorization", status: "in_progress", authorizationNumber: "AUTH-2026-1123", approvedUnits: 15, approvedFromDate: "2026-03-01", approvedToDate: "2026-05-31", approvedLevelOfCare: "Residential", readinessMetAt: null, readinessClinicalDocs: false, readinessAssessmentCurrent: false, readinessLOCSupported: false, readinessTreatmentPlan: false, readinessProgressNotes: false, readinessMedicalNecessity: false, readinessUtilizationReview: false, readinessGuardianConsent: false, readinessUB04Clean: false, readinessExcludedServices: false, submissionDate: null, submittedBy: null, submissionMethod: null, submissionReference: null, denialReason: null, appealDate: null, appealStatus: null, reauthDueDate: "2026-07-20", reauthStatus: "overdue", daysUntilExpiration: -5, createdAt: "2026-02-01", updatedAt: "2026-06-28" },
    ],
    total: 4, page: 1, pageSize: 25,
  };
  if (procedure === "m4.getAuthorization") return {
    id: "az1", youthId: "youth-001", youthName: "Marcus Johnson", mrn: "MRN-2026-4521", payerName: "Texas Medicaid", policyNumber: "TXM-88765432", stage: "tracking", status: "approved", authorizationNumber: "AUTH-2026-1122", approvedUnits: 30, approvedFromDate: "2026-06-01", approvedToDate: "2026-08-31", approvedLevelOfCare: "Intensive Outpatient", readinessMetAt: "2026-05-28", readinessClinicalDocs: true, readinessAssessmentCurrent: true, readinessLOCSupported: true, readinessTreatmentPlan: true, readinessProgressNotes: true, readinessMedicalNecessity: true, readinessUtilizationReview: true, readinessGuardianConsent: true, readinessUB04Clean: true, readinessExcludedServices: true, submissionDate: "2026-05-28", submittedBy: "billing@adolbi.com", submissionMethod: "portal", submissionReference: null, denialReason: null, appealDate: null, appealStatus: null, reauthDueDate: "2026-08-15", reauthStatus: "upcoming", daysUntilExpiration: 45, retrospectiveReviewDate: null, retrospectiveFindings: null, retrospectiveActions: null, billingExcludedServices: null, exclusionControlsApplied: null, createdAt: "2026-05-01", updatedAt: "2026-06-28", createdBy: "system",
  };
  if (procedure === "m4.createAuthorization" || procedure === "m4.updateAuthorization" || procedure === "m4.deleteAuthorization") return { success: true };
  if (procedure === "m4.getPayerPacketRequirements") return {
    payer: { id: "py1", name: "Texas Medicaid", payerType: "medicaid", contactPhone: "1-800-555-0100", contactEmail: "provider@txmedicaid.tx.gov", claimsAddress: "PO Box 149021, Austin, TX 78714", isActive: 1, createdAt: "2026-01-01" },
    requirements: [
      { document: "UB-04 Claim Form", required: true, category: "billing" },
      { document: "Itemized Statement", required: true, category: "billing" },
      { document: "Treatment Plan", required: true, category: "clinical" },
      { document: "Initial Assessment", required: true, category: "clinical" },
      { document: "Progress Notes (Current)", required: true, category: "clinical" },
      { document: "Medical Necessity Letter", required: true, category: "clinical" },
      { document: "Level of Care Determination", required: true, category: "clinical" },
      { document: "Guardian Consent Form", required: true, category: "legal" },
      { document: "Authorization for Release of Info", required: true, category: "legal" },
      { document: "Utilization Review Summary", required: true, category: "review" },
      { document: "Excluded Services Acknowledgment", required: true, category: "billing" },
      { document: "Proof of Service Documentation", required: true, category: "compliance" },
    ],
  };
  if (procedure === "m4.buildPayerPacket") return { success: true, packetSummary: { included: 8, missing: 4, total: 12 } };
  if (procedure === "m4.listPayerPackets") return [
    { claimId: "c6", claimNumber: "CLM-2026-006", patientId: "Youth A", payerName: "Blue Cross Blue Shield TX", builtAt: "2026-06-25T10:00:00Z", builtBy: "billing@adolbi.com", summary: { included: 10, missing: 2, total: 12 }, packetData: { builtAt: "2026-06-25T10:00:00Z", builtBy: "billing@adolbi.com", documents: [], summary: { included: 10, missing: 2, total: 12 } } },
  ];
  if (procedure === "m4.listDeniedClaims") return [
    { id: "c3", claimNumber: "CLM-2026-003", patientId: "Youth C", payerId: "py3", payerName: "Aetna Better Health", clinicianId: "u4", serviceDate: "2026-06-10", submissionDate: "2026-06-12", status: "denied", totalAmount: 875000, paidAmount: 0, balance: 875000, denialReason: "Authorization not on file at time of service", denialCode: "CO-29", appealDate: null, appealStatus: "not_appealed", createdAt: "2026-06-10" },
    { id: "c7", claimNumber: "CLM-2026-007", patientId: "Youth B", payerId: "py3", payerName: "Aetna Better Health", clinicianId: "u2", serviceDate: "2026-06-25", submissionDate: "2026-06-27", status: "appealed", totalAmount: 950000, paidAmount: 0, balance: 950000, denialReason: "Service not medically necessary — documentation insufficient", denialCode: "CO-50", appealDate: "2026-06-28", appealStatus: "in_review", createdAt: "2026-06-25" },
  ];
  if (procedure === "m4.appealClaim" || procedure === "m4.updateAppealStatus") return { success: true };
  if (procedure === "m4.getDenialAnalytics") return {
    totalDenied: 2, totalDeniedAmount: 1825000, appealedCount: 1,
    byCode: [
      { code: "CO-29", count: 1, totalAmount: 875000, reason: "Authorization not on file at time of service" },
      { code: "CO-50", count: 1, totalAmount: 950000, reason: "Service not medically necessary — documentation insufficient" },
    ],
    byPayer: [
      { count: 2, name: "Aetna Better Health" },
    ],
  };
  if (procedure === "m4.agingQueueByPayer") return [
    { payerName: "Texas Medicaid", payerType: "medicaid", total: 2060000, count: 3, buckets: { "0-30": 1250000, "31-60": 560000, "61-90": 250000, "91-120": 0, "120+": 0 } },
    { payerName: "Blue Cross Blue Shield TX", payerType: "insurance", total: 375000, count: 1, buckets: { "0-30": 0, "31-60": 375000, "61-90": 0, "91-120": 0, "120+": 0 } },
    { payerName: "UnitedHealthcare", payerType: "insurance", total: 1500000, count: 1, buckets: { "0-30": 1500000, "31-60": 0, "61-90": 0, "91-120": 0, "120+": 0 } },
    { payerName: "Aetna Better Health", payerType: "insurance", total: 1825000, count: 2, buckets: { "0-30": 950000, "31-60": 0, "61-90": 875000, "91-120": 0, "120+": 0 } },
  ];
  if (procedure === "m4.getProofOfServiceStatus") return {
    claimId: "c1", claimNumber: "CLM-2026-001",
    status: "cleared",
    checks: [
      { gate: "Service Date Valid", passed: true, required: true, category: "validation" },
      { gate: "Procedure Codes Present", passed: true, required: true, category: "validation" },
      { gate: "Diagnosis Codes Linked", passed: true, required: true, category: "clinical" },
      { gate: "Units Match Duration", passed: true, required: true, category: "validation" },
      { gate: "Clinician Identified", passed: true, required: true, category: "compliance" },
      { gate: "Payer Assigned", passed: true, required: true, category: "billing" },
      { gate: "Line Items Totals Match", passed: true, required: true, category: "validation" },
      { gate: "No Duplicate Procedures", passed: true, required: false, category: "validation" },
      { gate: "UB-04 Data Complete", passed: true, required: true, category: "billing" },
      { gate: "HIPAA Format Check", passed: true, required: true, category: "compliance" },
    ],
    summary: { passed: 10, total: 10, requiredPassed: 8, requiredTotal: 8 },
    clearedAt: new Date().toISOString(),
  };
  // ─── M5 ENDPOINTS (Clinical) ─────────────────────────────
  if (procedure === "bhc.dashboardKPIs") return {
    totalPatients: 5, activePatients: 4, sessionsThisWeek: 8, sessionsToday: 2, highRiskCount: 1, pendingApprovals: 1,
  };
  if (procedure === "bhc.listPatients") return {
    patients: [
      { id: "p1", mrn: "MRN-2026-4521", firstName: "Marcus", lastName: "Johnson", dateOfBirth: "2010-03-15", gender: "male", phone: "(512) 555-0101", email: "guardian.mjohnson@email.com", address: "1423 Cypress Lane, Houston, TX 77001", insuranceId: "TXM-88765432", emergencyName: "Tanya Johnson", emergencyPhone: "(512) 555-0102", referralSource: "HISD School Counselor", status: "active", assignedClinicianId: "u2", intakeDate: "2026-04-01T10:00:00Z", dischargeDate: null, dischargeReason: null, createdAt: "2026-04-01T10:00:00Z", updatedAt: "2026-06-28T14:00:00Z" },
      { id: "p2", mrn: "MRN-2026-4522", firstName: "Aaliyah", lastName: "Williams", dateOfBirth: "2009-07-22", gender: "female", phone: "(713) 555-0201", email: "guardian.awilliams@email.com", address: "2809 Oak Street, Houston, TX 77002", insuranceId: "BCBS-TX-11223344", emergencyName: "Darnell Williams", emergencyPhone: "(713) 555-0202", referralSource: "Pediatrician Dr. Chen", status: "active", assignedClinicianId: "u3", intakeDate: "2026-04-15T09:30:00Z", dischargeDate: null, dischargeReason: null, createdAt: "2026-04-15T09:30:00Z", updatedAt: "2026-06-27T11:00:00Z" },
      { id: "p3", mrn: "MRN-2026-4523", firstName: "Carlos", lastName: "Martinez", dateOfBirth: "2011-01-08", gender: "male", phone: "(281) 555-0301", email: "guardian.cmartinez@email.com", address: "567 Elm Avenue, Houston, TX 77003", insuranceId: "TXM-77654321", emergencyName: "Maria Martinez", emergencyPhone: "(281) 555-0302", referralSource: "DCF Caseworker", status: "active", assignedClinicianId: "u2", intakeDate: "2026-05-01T14:00:00Z", dischargeDate: null, dischargeReason: null, createdAt: "2026-05-01T14:00:00Z", updatedAt: "2026-06-26T16:00:00Z" },
      { id: "p4", mrn: "MRN-2026-4524", firstName: "Jada", lastName: "Thompson", dateOfBirth: "2008-11-30", gender: "female", phone: "(713) 555-0401", email: "guardian.jthompson@email.com", address: "901 Pine Ridge Rd, Houston, TX 77004", insuranceId: "ABH-99887766", emergencyName: "Keisha Thompson", emergencyPhone: "(713) 555-0402", referralSource: "Juvenile Court Probation", status: "hold", assignedClinicianId: "u3", intakeDate: "2026-05-20T11:00:00Z", dischargeDate: null, dischargeReason: null, createdAt: "2026-05-20T11:00:00Z", updatedAt: "2026-06-25T09:00:00Z" },
      { id: "p5", mrn: "MRN-2026-4525", firstName: "Ethan", lastName: "Davis", dateOfBirth: "2010-09-14", gender: "male", phone: "(832) 555-0501", email: "guardian.edavis@email.com", address: "445 Birchwood Dr, Houston, TX 77005", insuranceId: "UHC-55443322", emergencyName: "Angela Davis", emergencyPhone: "(832) 555-0502", referralSource: "Family Self-Referral", status: "discharged", assignedClinicianId: "u2", intakeDate: "2026-01-10T08:00:00Z", dischargeDate: "2026-06-01T12:00:00Z", dischargeReason: "Treatment goals completed. Referred to outpatient services.", createdAt: "2026-01-10T08:00:00Z", updatedAt: "2026-06-01T12:00:00Z" },
    ],
    total: 5,
  };
  if (procedure === "bhc.getPatient") {
    const patientId = input?.json?.id ?? "p1";
    const allPatients = getSingleDemoData("bhc.listPatients").patients;
    const patient = allPatients.find((p: any) => p.id === patientId) ?? allPatients[0];

    const treatmentPlans = [
      { id: "tp1", planNumber: "TP-2026-1001", patientId: "p1", primaryDiagnosis: "F32.9 Major Depressive Disorder, Single Episode, Unspecified", secondaryDiagnosis: "F41.1 Generalized Anxiety Disorder", presentingProblem: "Patient presents with persistent sadness, social withdrawal, declining academic performance, and insomnia lasting 4 months. Reports feeling worthless and occasional passive suicidal ideation without plan or intent.", goalsJson: '[{"description":"Reduce depression symptoms to sub-clinical levels","targetDate":"2026-08-01"},{"description":"Improve sleep hygiene to 7+ hours/night","targetDate":"2026-07-15"},{"description":"Increase social engagement with peers","targetDate":"2026-07-30"}]', interventionsJson: '[{"type":"CBT","description":"Cognitive restructuring for negative self-talk","frequency":"2x weekly"},{"type":"Group Therapy","description":"Social skills and peer support group","frequency":"1x weekly"},{"type":"Family Therapy","description":"Family communication and parenting support","frequency":"2x monthly"}]', estimatedDurationWeeks: 16, startDate: "2026-04-01", reviewDate: "2026-07-01", status: "active", assignedClinicianId: "u2", supervisorId: "u1", approvedBy: "Dr. Hall", approvedAt: "2026-04-03T10:00:00Z", createdAt: "2026-04-01T10:00:00Z", updatedAt: "2026-06-28T14:00:00Z" },
      { id: "tp2", planNumber: "TP-2026-1002", patientId: "p1", primaryDiagnosis: "F91.8 Conduct Disorder, Childhood-Onset Type", secondaryDiagnosis: null, presentingProblem: "Referral for behavioral outbursts, defiance toward authority, and peer aggression. History of school suspensions.", goalsJson: '[{"description":"Develop anger management coping skills","targetDate":"2026-05-01"},{"description":"Reduce aggressive incidents to zero per week","targetDate":"2026-06-01"}]', interventionsJson: '[{"type":"DBT","description":"Dialectical behavior therapy skills training","frequency":"2x weekly"},{"type":"Behavioral Modification","description":"Token economy and positive reinforcement","frequency":"daily"}]', estimatedDurationWeeks: 12, startDate: "2026-01-15", reviewDate: "2026-04-15", status: "completed", assignedClinicianId: "u2", supervisorId: "u1", approvedBy: "Dr. Hall", approvedAt: "2026-01-17T09:00:00Z", createdAt: "2026-01-15T08:00:00Z", updatedAt: "2026-05-01T10:00:00Z" },
    ];

    const recentSessions = [
      { id: "cs1", patientId: "p1", sessionDate: "2026-06-28T14:00:00Z", sessionType: "individual", durationMinutes: 60, chiefComplaint: "Difficulty sleeping, recurring nightmares about past trauma", sessionNotes: "Patient engaged well in session. Discussed trauma narrative processing. Patient identified 3 positive coping strategies used this week. Sleep log shows improvement from 4hrs to 6hrs average. Plan: Continue trauma-focused CBT. Assign sleep hygiene worksheet.", clinicianId: "u2", billingCode: "H0004", riskAssessmentJson: '{"suicideRisk":"low","homocideRisk":"none","elopementRisk":"none"}', nextSessionDate: "2026-06-30T14:00:00Z", nextSessionGoals: "Review sleep hygiene worksheet. Begin cognitive restructuring exercise.", status: "completed", createdAt: "2026-06-28T15:00:00Z" },
      { id: "cs2", patientId: "p1", sessionDate: "2026-06-25T14:00:00Z", sessionType: "individual", durationMinutes: 60, chiefComplaint: "Feeling overwhelmed about upcoming family visit", sessionNotes: "Patient expressed anxiety about family visit scheduled for July 4th. Explored grounding techniques and role-played communication skills. Patient practiced 'I feel' statements. Mood assessed at 5/10 (improved from 3/10 last week).", clinicianId: "u2", billingCode: "H0004", riskAssessmentJson: '{"suicideRisk":"low","homocideRisk":"none","elopementRisk":"none"}', nextSessionDate: "2026-06-28T14:00:00Z", nextSessionGoals: "Process family visit outcome. Introduce trauma narrative work.", status: "completed", createdAt: "2026-06-25T15:00:00Z" },
      { id: "cs3", patientId: "p1", sessionDate: "2026-06-23T10:00:00Z", sessionType: "group", durationMinutes: 90, chiefComplaint: null, sessionNotes: "Group session focused on peer relationships. 4 residents participated. Marcus contributed actively, offering support to newer resident. Demonstrated improved empathy and communication skills. Group cohesion noted as strong.", clinicianId: "u3", billingCode: "H2036", riskAssessmentJson: null, nextSessionDate: null, nextSessionGoals: null, status: "completed", createdAt: "2026-06-23T11:30:00Z" },
      { id: "cs4", patientId: "p1", sessionDate: "2026-06-21T14:00:00Z", sessionType: "individual", durationMinutes: 60, chiefComplaint: "Passive suicidal thoughts after argument with peer", sessionNotes: "Patient reported passive SI ('I wish I wouldn't wake up') following conflict with resident Carlos. No plan, intent, or means. Safety plan reviewed. Patient able to identify 3 reasons for living. Agreed to increased check-ins. Notified RCS and clinical director.", clinicianId: "u2", billingCode: "H0004", riskAssessmentJson: '{"suicideRisk":"moderate","homocideRisk":"none","elopementRisk":"none"}', nextSessionDate: "2026-06-23T14:00:00Z", nextSessionGoals: "Follow up on SI. Process peer conflict using CBT skills.", status: "completed", createdAt: "2026-06-21T15:00:00Z" },
      { id: "cs5", patientId: "p1", sessionDate: "2026-06-18T11:00:00Z", sessionType: "family", durationMinutes: 60, chiefComplaint: null, sessionNotes: "Family session with mother Tanya. Discussed Marcus's progress and transition planning for family visit. Mother reported following recommended parenting strategies at home. Good engagement and rapport.", clinicianId: "u2", billingCode: "H0004", riskAssessmentJson: '{"suicideRisk":"low","homocideRisk":"none","elopementRisk":"none"}', nextSessionDate: "2026-06-21T14:00:00Z", nextSessionGoals: "Individual session. Assess mood following family session.", status: "completed", createdAt: "2026-06-18T12:00:00Z" },
    ];

    const outcomeMeasures = [
      { id: "om1", patientId: "p1", measureType: "PHQ-A (Depression)", score: 12, maxScore: 27, severityLevel: "moderate", administeredBy: "u2", administeredAt: "2026-06-28T14:00:00Z" },
      { id: "om2", patientId: "p1", measureType: "PHQ-A (Depression)", score: 16, maxScore: 27, severityLevel: "moderately_severe", administeredBy: "u2", administeredAt: "2026-06-14T14:00:00Z" },
      { id: "om3", patientId: "p1", measureType: "PHQ-A (Depression)", score: 19, maxScore: 27, severityLevel: "severe", administeredBy: "u2", administeredAt: "2026-05-31T14:00:00Z" },
      { id: "om4", patientId: "p1", measureType: "PHQ-A (Depression)", score: 21, maxScore: 27, severityLevel: "severe", administeredBy: "u2", administeredAt: "2026-05-17T14:00:00Z" },
      { id: "om5", patientId: "p1", measureType: "GAD-7 (Anxiety)", score: 10, maxScore: 21, severityLevel: "moderate", administeredBy: "u2", administeredAt: "2026-06-28T14:00:00Z" },
      { id: "om6", patientId: "p1", measureType: "GAD-7 (Anxiety)", score: 14, maxScore: 21, severityLevel: "severe", administeredBy: "u2", administeredAt: "2026-06-14T14:00:00Z" },
      { id: "om7", patientId: "p1", measureType: "GAD-7 (Anxiety)", score: 16, maxScore: 21, severityLevel: "severe", administeredBy: "u2", administeredAt: "2026-05-31T14:00:00Z" },
      { id: "om8", patientId: "p1", measureType: "PSC-17 (Pediatric Symptom Checklist)", score: 12, maxScore: 34, severityLevel: "moderate", administeredBy: "u2", administeredAt: "2026-06-28T14:00:00Z" },
      { id: "om9", patientId: "p1", measureType: "PSC-17 (Pediatric Symptom Checklist)", score: 18, maxScore: 34, severityLevel: "severe", administeredBy: "u2", administeredAt: "2026-06-14T14:00:00Z" },
    ];

    // Filter for the requested patient
    const patientPlans = treatmentPlans.filter((tp: any) => tp.patientId === patientId);
    const patientSessions = recentSessions.filter((s: any) => s.patientId === patientId);
    const patientOutcomes = outcomeMeasures.filter((o: any) => o.patientId === patientId);

    return { patient, treatmentPlans: patientPlans.length > 0 ? patientPlans : treatmentPlans, recentSessions: patientSessions.length > 0 ? patientSessions : recentSessions, outcomeMeasures: patientOutcomes.length > 0 ? patientOutcomes : outcomeMeasures };
  }
  if (procedure === "bhc.clinicianWorkload") return {
    total: 8, byClinician: [
      { clinicianId: "u2", name: "Dr. Hall", sessionCountThisWeek: 12, patientCount: 3 },
      { clinicianId: "u3", name: "Lilian Ike", sessionCountThisWeek: 8, patientCount: 2 },
    ],
  };
  if (procedure === "bhc.listSessions") return [
    { id: "cs1", patientId: "p1", sessionDate: "2026-06-28T14:00:00Z", sessionType: "individual", durationMinutes: 60, chiefComplaint: "Difficulty sleeping, recurring nightmares about past trauma", sessionNotes: "Patient engaged well. Discussed trauma narrative processing. Identified 3 positive coping strategies.", clinicianId: "u2", billingCode: "H0004", riskAssessmentJson: '{"suicideRisk":"low","homocideRisk":"none","elopementRisk":"none"}', nextSessionDate: "2026-06-30T14:00:00Z", nextSessionGoals: "Review sleep hygiene worksheet.", status: "completed", createdAt: "2026-06-28T15:00:00Z" },
    { id: "cs2", patientId: "p2", sessionDate: "2026-06-28T10:00:00Z", sessionType: "individual", durationMinutes: 60, chiefComplaint: "Anxiety about school reintegration", sessionNotes: "Patient expressed concerns about returning to school. Explored coping strategies and role-played scenarios.", clinicianId: "u3", billingCode: "H0004", riskAssessmentJson: '{"suicideRisk":"none","homocideRisk":"none","elopementRisk":"none"}', nextSessionDate: "2026-06-30T10:00:00Z", nextSessionGoals: "Continue school anxiety work. Practice social scripts.", status: "completed", createdAt: "2026-06-28T11:00:00Z" },
    { id: "cs3", patientId: "p3", sessionDate: "2026-06-27T15:00:00Z", sessionType: "family", durationMinutes: 60, chiefComplaint: null, sessionNotes: "Family session with mother. Discussed behavioral expectations and consistent discipline strategies.", clinicianId: "u2", billingCode: "H0004", riskAssessmentJson: '{"suicideRisk":"none","homocideRisk":"none","elopementRisk":"low"}', nextSessionDate: "2026-06-29T15:00:00Z", nextSessionGoals: "Individual session. Review behavioral contract.", status: "completed", createdAt: "2026-06-27T16:00:00Z" },
    { id: "cs4", patientId: "p4", sessionDate: "2026-06-27T11:00:00Z", sessionType: "group", durationMinutes: 90, chiefComplaint: null, sessionNotes: "Group session on emotional regulation. 3 residents participated. Good engagement.", clinicianId: "u3", billingCode: "H2036", riskAssessmentJson: null, nextSessionDate: null, nextSessionGoals: null, status: "completed", createdAt: "2026-06-27T12:30:00Z" },
    { id: "cs5", patientId: "p1", sessionDate: "2026-06-30T09:00:00Z", sessionType: "intake", durationMinutes: 90, chiefComplaint: "Initial assessment", sessionNotes: "Intake session scheduled for new referral.", clinicianId: "u2", billingCode: "H0031", riskAssessmentJson: null, nextSessionDate: null, nextSessionGoals: null, status: "scheduled", createdAt: "2026-06-28T10:00:00Z" },
  ];
  if (procedure === "bhc.listInsurancePlans") return [
    { id: "plan1", planName: "Texas Medicaid STAR", payerId: "py1", planType: "medicaid", isActive: 1, createdAt: "2026-01-01" },
    { id: "plan2", planName: "BCBS TX Blue Choice", payerId: "py2", planType: "private", isActive: 1, createdAt: "2026-01-01" },
    { id: "plan3", planName: "Aetna Better Health TX", payerId: "py3", planType: "managed_care", isActive: 1, createdAt: "2026-01-01" },
    { id: "plan4", planName: "UnitedHealthcare Community", payerId: "py4", planType: "managed_care", isActive: 1, createdAt: "2026-01-01" },
  ];
  // bhc mutations handled by live store at line ~761
  // ─── M6 ENDPOINTS (GRO — Growth & Outreach) ──────────────
  if (procedure === "gro.dashboardKPIs") return {
    activeReferrals: 5, activePartnerships: 3, conversionRate: 33, newThisMonth: 4, totalReferrals: 8,
    topSources: [
      { source: "HISD School Counselor", count: 2 },
      { source: "Family Self-Referral", count: 1 },
      { source: "Juvenile Court Probation", count: 1 },
      { source: "DCF Caseworker", count: 1 },
      { source: "Community Mental Health Center", count: 1 },
    ],
  };
  if (procedure === "gro.listReferrals") return [
    { id: "r1", referral_number: "REF-2026-001", patient_name: "Kaden Williams", contact_phone: "(713) 555-1001", contact_email: "parent1@email.com", referral_source: "HISD School Counselor", source_detail: "Kashmere High School", referral_type: "adolescent", status: "active", assigned_to: "rcs-lead@adolbi.com", notes: "15-year-old male, depression and anxiety, parents seeking residential care", outcome: null, converted_patient_id: null, created_at: "2026-06-15T10:00:00Z", updated_at: "2026-06-15T10:00:00Z" },
    { id: "r2", referral_number: "REF-2026-002", patient_name: "Mia Rodriguez", contact_phone: "(281) 555-2002", contact_email: "parent2@email.com", referral_source: "Pediatrician", source_detail: "Dr. Elena Vasquez", referral_type: "intake", status: "in_review", assigned_to: "clinical-director@adolbi.com", notes: "14-year-old female, trauma history, self-harm behaviors. Awaiting clinical assessment.", outcome: null, converted_patient_id: null, created_at: "2026-06-18T09:30:00Z", updated_at: "2026-06-20T14:00:00Z" },
    { id: "r3", referral_number: "REF-2026-003", patient_name: "Jaylen Brown", contact_phone: "(832) 555-3003", contact_email: "parent3@email.com", referral_source: "Juvenile Court Probation", source_detail: "Harris County JJP", referral_type: "mandatory", status: "active", assigned_to: "gro.admin@adolbi.com", notes: "Court-ordered residential placement. Aggressive behavior, prior group home disruption.", outcome: null, converted_patient_id: null, created_at: "2026-06-22T11:00:00Z", updated_at: "2026-06-22T11:00:00Z" },
    { id: "r4", referral_number: "REF-2026-004", patient_name: "Sophia Chen", contact_phone: "(713) 555-4004", contact_email: "parent4@email.com", referral_source: "Family Self-Referral", source_detail: "Website inquiry", referral_type: "crisis", status: "new", assigned_to: null, notes: "16-year-old female, suicidal ideation with plan. Parent called crisis line. Needs immediate assessment.", outcome: null, converted_patient_id: null, created_at: "2026-06-27T08:15:00Z", updated_at: "2026-06-27T08:15:00Z" },
    { id: "r5", referral_number: "REF-2026-005", patient_name: "Aiden Thompson", contact_phone: "(281) 555-5005", contact_email: "parent5@email.com", referral_source: "DCF Caseworker", source_detail: "Texas CPS Region 6", referral_type: "adolescent", status: "converted", assigned_to: "rcs-lead@adolbi.com", notes: "Foster care placement disrupted. Maltreatment history. Successfully converted to patient MRN-2026-4521.", outcome: "converted", converted_patient_id: "p1", created_at: "2026-05-20T13:00:00Z", updated_at: "2026-06-01T10:00:00Z" },
    { id: "r6", referral_number: "REF-2026-006", patient_name: "Zara Mitchell", contact_phone: "(832) 555-6006", contact_email: "parent6@email.com", referral_source: "Community Mental Health Center", source_detail: "Legacy Community Health", referral_type: "educational", status: "deferred", assigned_to: "rcs-day@adolbi.com", notes: "Not currently appropriate for residential. Referred to outpatient IOP. Follow up in 90 days.", outcome: "deferred", converted_patient_id: null, created_at: "2026-05-10T15:00:00Z", updated_at: "2026-05-25T09:00:00Z" },
    { id: "r7", referral_number: "REF-2026-007", patient_name: "Darius Jackson", contact_phone: "(713) 555-7007", contact_email: "parent7@email.com", referral_source: "Hospital Discharge Planner", source_detail: "Texas Childrens Hospital", referral_type: "crisis", status: "closed", assigned_to: "clinical-director@adolbi.com", notes: "Crisis stabilization completed. Family opted for outpatient care closer to home.", outcome: "closed", converted_patient_id: null, created_at: "2026-04-05T10:00:00Z", updated_at: "2026-04-12T16:00:00Z" },
    { id: "r8", referral_number: "REF-2026-008", patient_name: "Emma Patel", contact_phone: "(281) 555-8008", contact_email: "parent8@email.com", referral_source: "Community Event", source_detail: "Mental Health Awareness Fair", referral_type: "community", status: "active", assigned_to: "gro.admin@adolbi.com", notes: "Parents attended community fair. 13-year-old female, social anxiety, school refusal.", outcome: null, converted_patient_id: null, created_at: "2026-06-25T14:00:00Z", updated_at: "2026-06-25T14:00:00Z" },
  ];
  if (procedure === "gro.listPartnerships") return [
    { id: "part1", organization_name: "Houston ISD", partnership_type: "school_district", status: "active", contact_name: "Maria Gonzalez", contact_phone: "(713) 555-0100", contact_email: "m.gonzalez@houstonisd.org", address: "4400 West 18th St, Houston, TX", notes: "Primary referral source. Quarterly check-ins with counseling department.", start_date: "2025-09-01", renewal_date: "2026-09-01", referral_count: 12, created_at: "2025-09-01" },
    { id: "part2", organization_name: "Harris County Juvenile Probation", partnership_type: "government", status: "active", contact_name: "Deputy Chief Williams", contact_phone: "(713) 555-0200", contact_email: "d.williams@harriscountyjp.hctx.net", address: "1200 Congress St, Houston, TX", notes: "Court-ordered placements. Monthly reporting required.", start_date: "2026-01-15", renewal_date: "2027-01-15", referral_count: 4, created_at: "2026-01-15" },
    { id: "part3", organization_name: "Legacy Community Health", partnership_type: "healthcare", status: "active", contact_name: "Dr. Sarah Kim", contact_phone: "(832) 555-0300", contact_email: "s.kim@legacycommunityhealth.org", address: "various clinic locations", notes: "Coordinated care referrals. Shared care plans for dual-enrolled patients.", start_date: "2026-03-01", renewal_date: "2027-03-01", referral_count: 6, created_at: "2026-03-01" },
    { id: "part4", organization_name: "Texas Childrens Hospital", partnership_type: "healthcare", status: "pending", contact_name: "James Okafor", contact_phone: "(832) 555-0400", contact_email: "j.okafor@texaschildrens.org", address: "6621 Fannin St, Houston, TX", notes: "Crisis discharge planning partnership. MOU under legal review.", start_date: null, renewal_date: null, referral_count: 2, created_at: "2026-06-10" },
    { id: "part5", organization_name: "Texas CPS Region 6", partnership_type: "government", status: "active", contact_name: "Case Supervisor Torres", contact_phone: "(713) 555-0500", contact_email: "r.torres@dfps.texas.gov", address: "2525 Murworth Dr, Houston, TX", notes: "Foster care placement referrals. 24-hour response requirement.", start_date: "2026-02-01", renewal_date: "2027-02-01", referral_count: 3, created_at: "2026-02-01" },
  ];
  if (procedure === "gro.listCampaigns") return [
    { id: "camp1", campaign_name: "Spring 2026 School Outreach", campaign_type: "school", start_date: "2026-03-01", end_date: "2026-05-31", status: "completed", budget: 5000, leads_generated: 24, conversions: 8, notes: "Visited 12 schools, presented at 8 PTA meetings", created_at: "2026-03-01" },
    { id: "camp2", campaign_name: "Summer Community Health Fairs", campaign_type: "community", start_date: "2026-06-01", end_date: "2026-08-31", status: "active", budget: 3000, leads_generated: 15, conversions: 3, notes: "Booth at 5 community events, distributed materials at 10 locations", created_at: "2026-06-01" },
    { id: "camp3", campaign_name: "Digital Ad Campaign — Houston", campaign_type: "digital", start_date: "2026-04-01", end_date: "2026-06-30", status: "completed", budget: 8000, leads_generated: 42, conversions: 6, notes: "Google Ads + Facebook targeting Harris County parents of teens 12-17", created_at: "2026-04-01" },
    { id: "camp4", campaign_name: "Pediatrician Referral Program", campaign_type: "professional", start_date: "2026-05-01", end_date: "2026-12-31", status: "active", budget: 2000, leads_generated: 8, conversions: 2, notes: "Direct outreach to 50 pediatricians, referral pad distribution, CME event planned", created_at: "2026-05-01" },
  ];
  // gro mutations handled by live store at line ~766
  // ─── M7 ENDPOINTS (GAD — General Administration) ─────────
  if (procedure === "gad.dashboardKPIs") return {
    facilityCount: 2, vendorCount: 7, openWorkOrders: 3, inProgressWorkOrders: 2,
    pendingPartsWorkOrders: 1, completedThisMonth: 2, overdueWorkOrders: 0, urgentHighCount: 3, totalWorkOrders: 8,
  };
  if (procedure === "gad.listWorkOrders") return [
    { id: "wo1", wo_number: "WO-2026-001", title: "HVAC Repair — Wing B", description: "Air conditioning unit in Wing B common area not cooling properly. Temperature reached 82F.", work_type: "hvac", priority: "high", status: "in_progress", facility_id: "f1", vendor_id: "v1", assigned_to: "gad.ops@adolbi.com", estimated_cost: 85000, actual_cost: null, requested_by: "rcs-lead@adolbi.com", approved_by: "E. Russ Aideyan", due_date: "2026-07-02", completed_at: null, created_at: "2026-06-25T10:00:00Z", updated_at: "2026-06-26T14:00:00Z" },
    { id: "wo2", wo_number: "WO-2026-002", title: "Replace fire extinguisher — Wing B", description: "Fire extinguisher expired per safety audit AUD-2026-003. Replace with new 10lb ABC unit.", work_type: "safety", priority: "urgent", status: "completed", facility_id: "f1", vendor_id: "v2", assigned_to: "gad.ops@adolbi.com", estimated_cost: 15000, actual_cost: 12500, requested_by: "gro.admin@adolbi.com", approved_by: "E. Russ Aideyan", due_date: "2026-06-20", completed_at: "2026-06-19T14:00:00Z", created_at: "2026-06-18T09:00:00Z", updated_at: "2026-06-19T14:00:00Z" },
    { id: "wo3", wo_number: "WO-2026-003", title: "Plumbing leak — Kitchen sink", description: "Slow drain and minor leak under kitchen sink. Water damage to cabinet base.", work_type: "plumbing", priority: "medium", status: "open", facility_id: "f1", vendor_id: "v3", assigned_to: "gad.ops@adolbi.com", estimated_cost: 35000, actual_cost: null, requested_by: "rcs-day@adolbi.com", approved_by: null, due_date: "2026-07-05", completed_at: null, created_at: "2026-06-27T08:00:00Z", updated_at: "2026-06-27T08:00:00Z" },
    { id: "wo4", wo_number: "WO-2026-004", title: "Security camera upgrade", description: "Replace 4 analog cameras with IP cameras. Add coverage to courtyard blind spot.", work_type: "security", priority: "medium", status: "pending_parts", facility_id: "f1", vendor_id: "v4", assigned_to: "gad.ops@adolbi.com", estimated_cost: 450000, actual_cost: null, requested_by: "E. Russ Aideyan", approved_by: "E. Russ Aideyan", due_date: "2026-07-15", completed_at: null, created_at: "2026-06-20T11:00:00Z", updated_at: "2026-06-28T09:00:00Z" },
    { id: "wo5", wo_number: "WO-2026-005", title: "Landscaping — Front entrance", description: "Refresh mulch, trim hedges, replace damaged plants at main entrance.", work_type: "grounds", priority: "low", status: "open", facility_id: "f1", vendor_id: "v5", assigned_to: "gad.ops@adolbi.com", estimated_cost: 22000, actual_cost: null, requested_by: "gro.admin@adolbi.com", approved_by: null, due_date: "2026-07-10", completed_at: null, created_at: "2026-06-26T13:00:00Z", updated_at: "2026-06-26T13:00:00Z" },
    { id: "wo6", wo_number: "WO-2026-006", title: "Generator monthly test", description: "Monthly load bank test for backup generator. Log results per fire marshal requirements.", work_type: "electrical", priority: "high", status: "completed", facility_id: "f1", vendor_id: "v6", assigned_to: "gad.ops@adolbi.com", estimated_cost: 8000, actual_cost: 8000, requested_by: "gad.ops@adolbi.com", approved_by: null, due_date: "2026-06-30", completed_at: "2026-06-28T10:00:00Z", created_at: "2026-06-28T08:00:00Z", updated_at: "2026-06-28T10:00:00Z" },
    { id: "wo7", wo_number: "WO-2026-007", title: "Paint — Common room refresh", description: "Repaint youth common room. Repair drywall damage near south wall.", work_type: "maintenance", priority: "low", status: "in_progress", facility_id: "f1", vendor_id: "v7", assigned_to: "gad.ops@adolbi.com", estimated_cost: 180000, actual_cost: null, requested_by: "rcs-lead@adolbi.com", approved_by: "E. Russ Aideyan", due_date: "2026-07-08", completed_at: null, created_at: "2026-06-24T09:00:00Z", updated_at: "2026-06-27T15:00:00Z" },
    { id: "wo8", wo_number: "WO-2026-008", title: "IT Network switch replacement", description: "Replace aging 24-port switch in server closet. Intermittent connectivity issues reported.", work_type: "it", priority: "high", status: "open", facility_id: "f1", vendor_id: null, assigned_to: "gad.ops@adolbi.com", estimated_cost: 65000, actual_cost: null, requested_by: "E. Russ Aideyan", approved_by: "E. Russ Aideyan", due_date: "2026-07-03", completed_at: null, created_at: "2026-06-28T16:00:00Z", updated_at: "2026-06-28T16:00:00Z" },
  ];
  if (procedure === "gad.listFacilities") return [
    { id: "f1", facility_name: "BHC at Cypress — Main Campus", facility_code: "BHC-CYP-01", address: "12457 Cypress Center Blvd, Cypress, TX 77429", facility_type: "residential", total_sqft: 18500, bedrooms: 12, common_areas: 4, status: "active", built_year: 2018, last_inspection_date: "2026-06-18", next_inspection_date: "2026-12-18", manager_id: "u6", created_at: "2026-01-01" },
    { id: "f2", facility_name: "BHC at Cypress — Administrative Annex", facility_code: "BHC-CYP-02", address: "12459 Cypress Center Blvd, Cypress, TX 77429", facility_type: "administrative", total_sqft: 3200, bedrooms: 0, common_areas: 2, status: "active", built_year: 2018, last_inspection_date: "2026-05-15", next_inspection_date: "2026-11-15", manager_id: "u1", created_at: "2026-01-01" },
  ];
  if (procedure === "gad.listVendors") return [
    { id: "v1", vendor_name: "Cypress Mechanical Services", vendor_type: "hvac", contact_person: "Mike Torres", contact_phone: "(281) 555-1100", contact_email: "service@cypressmech.com", address: "890 Industrial Dr, Cypress, TX 77429", tax_id: "12-3456789", payment_terms: "Net 30", status: "active", rating: 5, notes: "Preferred HVAC vendor. 24/7 emergency service.", contract_expiry: "2026-12-31", created_at: "2026-01-01" },
    { id: "v2", vendor_name: "Houston Safety Supply", vendor_type: "safety_equipment", contact_person: "Lisa Park", contact_phone: "(713) 555-2200", contact_email: "orders@houstonsafety.com", address: "2200 Safety Way, Houston, TX 77001", tax_id: "23-4567890", payment_terms: "Net 15", status: "active", rating: 4, notes: "Fire safety equipment and inspections.", contract_expiry: "2027-03-31", created_at: "2026-01-01" },
    { id: "v3", vendor_name: "Cypress Plumbing Co", vendor_type: "plumbing", contact_person: "Jake Rivera", contact_phone: "(281) 555-3300", contact_email: "jobs@cypressplumbing.net", address: "456 Pipe Lane, Cypress, TX 77429", tax_id: "34-5678901", payment_terms: "Net 30", status: "active", rating: 4, notes: "General plumbing. Good response time.", contract_expiry: "2026-09-30", created_at: "2026-01-01" },
    { id: "v4", vendor_name: "SecureView Systems", vendor_type: "security", contact_person: "David Chen", contact_phone: "(832) 555-4400", contact_email: "install@secureview.io", address: "1200 Tech Blvd, Houston, TX 77002", tax_id: "45-6789012", payment_terms: "50% upfront, 50% on completion", status: "active", rating: 5, notes: "IP camera systems and access control.", contract_expiry: "2027-06-30", created_at: "2026-01-01" },
    { id: "v5", vendor_name: "GreenScape Cypress", vendor_type: "landscaping", contact_person: "Maria Green", contact_phone: "(281) 555-5500", contact_email: "service@greenscape.com", address: "77 Garden Rd, Cypress, TX 77429", tax_id: "56-7890123", payment_terms: "Net 30", status: "active", rating: 4, notes: "Monthly landscaping maintenance.", contract_expiry: "2026-12-31", created_at: "2026-01-01" },
    { id: "v6", vendor_name: "PowerGuard Generator Services", vendor_type: "electrical", contact_person: "Robert Watts", contact_phone: "(713) 555-6600", contact_email: "service@powerguard.com", address: "300 Power Ave, Houston, TX 77003", tax_id: "67-8901234", payment_terms: "Net 15", status: "active", rating: 5, notes: "Generator maintenance and load bank testing.", contract_expiry: "2027-01-31", created_at: "2026-01-01" },
    { id: "v7", vendor_name: "Cypress Painting & Drywall", vendor_type: "general_contractor", contact_person: "Ana Lopez", contact_phone: "(281) 555-7700", contact_email: "estimates@cypresspaint.com", address: "55 Brush St, Cypress, TX 77429", tax_id: "78-9012345", payment_terms: "Net 30", status: "active", rating: 4, notes: "Interior painting and minor repairs.", contract_expiry: "2026-08-31", created_at: "2026-01-01" },
  ];
  // gad mutations handled by live store at line ~770
  // ─── M8 ENDPOINTS (Workflow Engine) ──────────────────────
  if (procedure === "workflow.dashboardKPIs") return {
    totalInstances: 10, pendingInstances: 3, completedInstances: 6, rejectedInstances: 1, pendingApprovals: 3,
  };
  if (procedure === "workflow.listRules") return [
    { id: "wr-hr-status", name: "HR Status Change Alert", event: "hr.status-changed", actions: [{ type: "notify", target: "hr-director", priority: "high" }, { type: "log", target: "audit", priority: "low" }], enabled: true },
    { id: "wr-doc-expired", name: "Document Expired Escalation", event: "document.expired", actions: [{ type: "escalate", target: "supervisor", priority: "urgent" }, { type: "notify", target: "qa-officer", priority: "high" }], enabled: true },
    { id: "wr-incident-critical", name: "Critical Incident Response", event: "incident.critical", actions: [{ type: "escalate", target: "executive", priority: "urgent" }, { type: "notify", target: "clinical-director", priority: "urgent" }, { type: "notify", target: "qa-officer", priority: "high" }], enabled: true },
    { id: "wr-credential-expiry", name: "Credential Expiry Warning", event: "credential.expiring-soon", actions: [{ type: "notify", target: "hr-director", priority: "medium" }, { type: "notify", target: "employee", priority: "medium" }], enabled: true },
    { id: "wr-claim-denied", name: "Claim Denied Alert", event: "revenue.claim-denied", actions: [{ type: "notify", target: "revenue-manager", priority: "high" }, { type: "escalate", target: "supervisor", priority: "medium" }], enabled: true },
    { id: "wr-onboarding-complete", name: "Onboarding Complete — RTD Check", event: "onboarding.completed", actions: [{ type: "notify", target: "hr-director", priority: "medium" }, { type: "notify", target: "supervisor", priority: "medium" }], enabled: true },
    { id: "wr-audit-finding", name: "Audit Finding — CAPA Required", event: "audit.finding-created", actions: [{ type: "escalate", target: "qa-officer", priority: "high" }, { type: "notify", target: "department-head", priority: "high" }], enabled: true },
    { id: "wr-referral-new", name: "New Referral Assignment", event: "referral.created", actions: [{ type: "notify", target: "gro-admin", priority: "medium" }, { type: "log", target: "audit", priority: "low" }], enabled: true },
    { id: "wr-equipment-failure", name: "Equipment Failure Response", event: "gad.equipment-failure", actions: [{ type: "escalate", target: "gad-ops", priority: "urgent" }, { type: "notify", target: "facility-manager", priority: "high" }], enabled: false },
    { id: "wr-high-risk-patient", name: "High Risk Patient Alert", event: "clinical.high-risk", actions: [{ type: "escalate", target: "clinical-director", priority: "urgent" }, { type: "notify", target: "assigned-clinician", priority: "urgent" }], enabled: true },
  ];
  if (procedure === "workflow.listInstances") return [
    { id: "wi1", rule_id: "wr-hr-status", rule_name: "HR Status Change Alert", event_type: "hr.status-changed", status: "completed", trigger_data: '{"personId":"h4","from":"applicant","to":"new-hire"}', triggered_by: "hr-director@adolbi.com", started_at: "2026-06-20T10:00:00Z" },
    { id: "wi2", rule_id: "wr-credential-expiry", rule_name: "Credential Expiry Warning", event_type: "credential.expiring-soon", status: "completed", trigger_data: '{"personId":"h4","credential":"LPC License","daysUntilExpiry":45}', triggered_by: "system", started_at: "2026-06-15T08:00:00Z" },
    { id: "wi3", rule_id: "wr-incident-critical", rule_name: "Critical Incident Response", event_type: "incident.critical", status: "completed", trigger_data: '{"incidentId":"i1","type":"elopement","severity":"high"}', triggered_by: "rcs-day@adolbi.com", started_at: "2026-06-15T14:30:00Z" },
    { id: "wi4", rule_id: "wr-claim-denied", rule_name: "Claim Denied Alert", event_type: "revenue.claim-denied", status: "pending", trigger_data: '{"claimId":"c3","denialCode":"CO-29","amount":875000}', triggered_by: "system", started_at: "2026-06-12T09:00:00Z" },
    { id: "wi5", rule_id: "wr-audit-finding", rule_name: "Audit Finding — CAPA Required", event_type: "audit.finding-created", status: "completed", trigger_data: '{"auditId":"a1","finding":"Missing signatures","severity":"minor"}', triggered_by: "system", started_at: "2026-06-15T16:00:00Z" },
    { id: "wi6", rule_id: "wr-referral-new", rule_name: "New Referral Assignment", event_type: "referral.created", status: "completed", trigger_data: '{"referralId":"r4","patientName":"Sophia Chen","type":"crisis"}', triggered_by: "gro.admin@adolbi.com", started_at: "2026-06-27T08:15:00Z" },
    { id: "wi7", rule_id: "wr-high-risk-patient", rule_name: "High Risk Patient Alert", event_type: "clinical.high-risk", status: "completed", trigger_data: '{"patientId":"p1","riskType":"suicide-ideation","level":"moderate"}', triggered_by: "system", started_at: "2026-06-21T14:00:00Z" },
    { id: "wi8", rule_id: "wr-doc-expired", rule_name: "Document Expired Escalation", event_type: "document.expired", status: "rejected", trigger_data: '{"documentId":"d8","title":"Incident Reporting Guide"}', triggered_by: "system", started_at: "2026-06-25T16:00:00Z" },
    { id: "wi9", rule_id: "wr-hr-status", rule_name: "HR Status Change Alert", event_type: "hr.status-changed", status: "pending", trigger_data: '{"personId":"h5","from":"new-hire","to":"active"}', triggered_by: "hr-director@adolbi.com", started_at: "2026-06-28T09:00:00Z" },
    { id: "wi10", rule_id: "wr-equipment-failure", rule_name: "Equipment Failure Response", event_type: "gad.equipment-failure", status: "pending", trigger_data: '{"equipment":"network-switch","location":"server-closet"}', triggered_by: "gad.ops@adolbi.com", started_at: "2026-06-28T16:00:00Z" },
  ];
  if (procedure === "workflow.listPendingApprovals") return [
    { id: "wa1", instance_id: "wi4", rule_name: "Claim Denied Alert", approver_role: "revenue-manager", event_type: "revenue.claim-denied", status: "pending", requested_at: "2026-06-12T09:00:00Z" },
    { id: "wa2", instance_id: "wi9", rule_name: "HR Status Change Alert", approver_role: "hr-director", event_type: "hr.status-changed", status: "pending", requested_at: "2026-06-28T09:00:00Z" },
    { id: "wa3", instance_id: "wi10", rule_name: "Equipment Failure Response", approver_role: "gad-ops", event_type: "gad.equipment-failure", status: "pending", requested_at: "2026-06-28T16:00:00Z" },
  ];
  if (procedure === "workflow.auditLog") return [
    { id: "wl1", action: "instance.triggered", actor: "hr-director@adolbi.com", details: "HR Status Change: h4 applicant → new-hire", created_at: "2026-06-20T10:00:00Z" },
    { id: "wl2", action: "instance.completed", actor: "system", details: "HR Status Change Alert completed (2 actions executed)", created_at: "2026-06-20T10:00:05Z" },
    { id: "wl3", action: "instance.triggered", actor: "system", details: "Credential LPC License expires in 45 days for h4", created_at: "2026-06-15T08:00:00Z" },
    { id: "wl4", action: "instance.triggered", actor: "rcs-day@adolbi.com", details: "Critical incident: Youth eloped (INC-2026-001)", created_at: "2026-06-15T14:30:00Z" },
    { id: "wl5", action: "approval.created", actor: "system", details: "Claim Denied Alert requires revenue-manager approval", created_at: "2026-06-12T09:00:00Z" },
    { id: "wl6", action: "instance.triggered", actor: "system", details: "Audit finding created: Missing signatures (AUD-2026-001)", created_at: "2026-06-15T16:00:00Z" },
    { id: "wl7", action: "instance.triggered", actor: "gro.admin@adolbi.com", details: "New crisis referral: Sophia Chen (REF-2026-004)", created_at: "2026-06-27T08:15:00Z" },
    { id: "wl8", action: "instance.rejected", actor: "E. Russ Aideyan", details: "Document Expired Escalation rejected — document intentionally archived", created_at: "2026-06-26T09:00:00Z" },
    { id: "wl9", action: "approval.created", actor: "system", details: "HR Status Change requires hr-director approval for h5", created_at: "2026-06-28T09:00:00Z" },
    { id: "wl10", action: "instance.triggered", actor: "gad.ops@adolbi.com", details: "Equipment failure: Network switch (server closet)", created_at: "2026-06-28T16:00:00Z" },
  ];
  if (procedure === "workflow.trigger") return { instanceId: `wi-${Date.now()}`, approvalsCreated: 1 };
  // ─── M9 ENDPOINTS (NIL Knowledge Graph) ──────────────────
  if (procedure === "nil.getStats") return {
    totalEntities: 21, totalRelationships: 20,
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
    const q = input?.json?.query?.toLowerCase() ?? "";
    const allEntities = [
      { id: "ne-p1", entityType: "patient", displayName: "Marcus Johnson", module: "clinical", description: "15yo male, depression/anxiety" },
      { id: "ne-p2", entityType: "patient", displayName: "Aaliyah Williams", module: "clinical", description: "16yo female, trauma/self-harm" },
      { id: "ne-p3", entityType: "patient", displayName: "Carlos Martinez", module: "clinical", description: "15yo male, conduct disorder" },
      { id: "ne-p4", entityType: "patient", displayName: "Jada Thompson", module: "clinical", description: "17yo female, on hold" },
      { id: "ne-p5", entityType: "patient", displayName: "Ethan Davis", module: "clinical", description: "15yo male, discharged" },
      { id: "ne-dr-hall", entityType: "person", displayName: "Dr. Hall", module: "clinical", description: "Clinical Director, Psychiatrist" },
      { id: "ne-lilian", entityType: "person", displayName: "Lilian Ike", module: "clinical", description: "Case Manager, RCS Night" },
      { id: "ne-russ", entityType: "person", displayName: "E. Russ Aideyan", module: "executive", description: "CEO/Founder" },
      { id: "ne-h-jg", entityType: "person", displayName: "Jonthan Guidry", module: "hr", description: "LPC, Case Manager" },
      { id: "ne-h-rl", entityType: "person", displayName: "RCS Lead", module: "hr", description: "Residential Care Supervisor" },
      { id: "ne-tp1", entityType: "treatment_plan", displayName: "TP-2026-1001 — MDD/GAD", module: "clinical", description: "Active treatment plan for Marcus Johnson" },
      { id: "ne-tp2", entityType: "treatment_plan", displayName: "TP-2026-1002 — Conduct Disorder", module: "clinical", description: "Completed treatment plan" },
      { id: "ne-cs1", entityType: "session", displayName: "Session 2026-06-28", module: "clinical", description: "Individual therapy — trauma processing" },
      { id: "ne-c1", entityType: "claim", displayName: "CLM-2026-001 — TX Medicaid", module: "revenue", description: "Paid claim, $12,500" },
      { id: "ne-c3", entityType: "claim", displayName: "CLM-2026-003 — Aetna", module: "revenue", description: "Denied claim, $8,750" },
      { id: "ne-a1", entityType: "audit", displayName: "AUD-2026-001 — Q2 Clinical", module: "qa", description: "Completed audit, score 94%" },
      { id: "ne-ca1", entityType: "form", displayName: "CAPA-2026-001", module: "qa", description: "Dual-signature medication check" },
      { id: "ne-wo1", entityType: "work_order", displayName: "WO-2026-001 — HVAC", module: "gad", description: "HVAC repair Wing B" },
      { id: "ne-f1", entityType: "form", displayName: "BHC-CYP-01", module: "gad", description: "Main Campus, 18,500 sqft" },
      { id: "ne-d1", entityType: "form", displayName: "ADL-HR-POL-202606-0001", module: "documents", description: "Employee Handbook v2026" },
      { id: "ne-r1", entityType: "form", displayName: "REF-2026-005 — A. Thompson", module: "gro", description: "Converted referral" },
    ];
    if (!q) return allEntities;
    return allEntities.filter((e) =>
      e.displayName.toLowerCase().includes(q) ||
      e.description.toLowerCase().includes(q) ||
      e.entityType.toLowerCase().includes(q)
    );
  }
  if (procedure === "nil.getEntityNetwork") {
    const entityId = input?.json?.entityId ?? "ne-p1";
    const entityMap: Record<string, any> = {
      "ne-p1": { id: "ne-p1", entityType: "patient", displayName: "Marcus Johnson", module: "clinical", description: "15yo male, depression/anxiety" },
      "ne-p2": { id: "ne-p2", entityType: "patient", displayName: "Aaliyah Williams", module: "clinical", description: "16yo female, trauma/self-harm" },
      "ne-dr-hall": { id: "ne-dr-hall", entityType: "person", displayName: "Dr. Hall", module: "clinical", description: "Clinical Director, Psychiatrist" },
      "ne-lilian": { id: "ne-lilian", entityType: "person", displayName: "Lilian Ike", module: "clinical", description: "Case Manager, RCS Night" },
      "ne-russ": { id: "ne-russ", entityType: "person", displayName: "E. Russ Aideyan", module: "executive", description: "CEO/Founder" },
      "ne-h-jg": { id: "ne-h-jg", entityType: "person", displayName: "Jonthan Guidry", module: "hr", description: "LPC, Case Manager" },
      "ne-tp1": { id: "ne-tp1", entityType: "treatment_plan", displayName: "TP-2026-1001 — MDD/GAD", module: "clinical", description: "Active treatment plan for Marcus Johnson" },
      "ne-tp2": { id: "ne-tp2", entityType: "treatment_plan", displayName: "TP-2026-1002 — Conduct Disorder", module: "clinical", description: "Completed treatment plan for behavioral outbursts" },
      "ne-cs1": { id: "ne-cs1", entityType: "session", displayName: "Session 2026-06-28", module: "clinical", description: "Individual therapy — trauma processing" },
      "ne-c1": { id: "ne-c1", entityType: "claim", displayName: "CLM-2026-001 — TX Medicaid", module: "revenue", description: "Paid claim, $12,500" },
      "ne-c3": { id: "ne-c3", entityType: "claim", displayName: "CLM-2026-003 — Aetna", module: "revenue", description: "Denied claim, $8,750" },
      "ne-a1": { id: "ne-a1", entityType: "audit", displayName: "AUD-2026-001 — Q2 Clinical", module: "qa", description: "Completed audit, score 94%" },
      "ne-ca1": { id: "ne-ca1", entityType: "form", displayName: "CAPA-2026-001", module: "qa", description: "Dual-signature medication check" },
      "ne-wo1": { id: "ne-wo1", entityType: "work_order", displayName: "WO-2026-001 — HVAC", module: "gad", description: "HVAC repair Wing B" },
      "ne-f1": { id: "ne-f1", entityType: "form", displayName: "BHC-CYP-01", module: "gad", description: "Main Campus, 18,500 sqft" },
      "ne-d1": { id: "ne-d1", entityType: "form", displayName: "ADL-HR-POL-202606-0001", module: "documents", description: "Employee Handbook v2026" },
      "ne-r1": { id: "ne-r1", entityType: "form", displayName: "REF-2026-005 — A. Thompson", module: "gro", description: "Converted referral" },
      "ne-h-rl": { id: "ne-h-rl", entityType: "person", displayName: "RCS Lead", module: "hr", description: "Residential Care Supervisor" },
      "ne-hr-ref": { id: "ne-hr-ref", entityType: "form", displayName: "REF-2026-001 — K. Williams", module: "hr", description: "Reference check form" },
      "ne-hr-app": { id: "ne-hr-app", entityType: "form", displayName: "APP-2026-001 — J. Guidry", module: "hr", description: "Application form" },
    };

    const rels: Record<string, { from: string; to: string; type: string; strength: number }[]> = {
      "ne-p1": [{ from: "ne-p1", to: "ne-dr-hall", type: "treated_by", strength: 100 }, { from: "ne-p1", to: "ne-tp1", type: "has_plan", strength: 100 }, { from: "ne-p1", to: "ne-tp2", type: "had_plan", strength: 80 }, { from: "ne-p1", to: "ne-cs1", type: "has_session", strength: 100 }, { from: "ne-p1", to: "ne-c1", type: "has_claim", strength: 100 }, { from: "ne-p1", to: "ne-r1", type: "from_referral", strength: 100 }],
      "ne-dr-hall": [{ from: "ne-dr-hall", to: "ne-p1", type: "treats", strength: 100 }, { from: "ne-dr-hall", to: "ne-p3", type: "treats", strength: 100 }, { from: "ne-dr-hall", to: "ne-cs1", type: "conducted", strength: 100 }, { from: "ne-dr-hall", to: "ne-tp1", type: "authored", strength: 100 }, { from: "ne-dr-hall", to: "ne-a1", type: "audited_by", strength: 90 }, { from: "ne-dr-hall", to: "ne-h-jg", type: "supervises", strength: 90 }],
      "ne-russ": [{ from: "ne-russ", to: "ne-d1", type: "authored", strength: 100 }, { from: "ne-russ", to: "ne-wo1", type: "approved", strength: 90 }, { from: "ne-russ", to: "ne-h-rl", type: "supervises", strength: 90 }],
      "ne-tp1": [{ from: "ne-tp1", to: "ne-p1", type: "for_patient", strength: 100 }, { from: "ne-tp1", to: "ne-dr-hall", type: "authored_by", strength: 100 }],
      "ne-a1": [{ from: "ne-a1", to: "ne-ca1", type: "generated_capa", strength: 100 }, { from: "ne-a1", to: "ne-dr-hall", type: "audited", strength: 90 }],
      "ne-wo1": [{ from: "ne-wo1", to: "ne-f1", type: "for_facility", strength: 100 }, { from: "ne-wo1", to: "ne-russ", type: "approved_by", strength: 90 }],
      "ne-r1": [{ from: "ne-r1", to: "ne-p1", type: "converted_to", strength: 100 }],
    };

    const center = entityMap[entityId];
    if (!center) return { nodes: [], edges: [], totalNodes: 0, totalEdges: 0 };

    const entityRels = rels[entityId] ?? [];
    const connectedNodes = entityRels.map((r) => entityMap[r.to]).filter(Boolean);
    const uniqueConnected = connectedNodes.filter((n, i, a) => a.findIndex((x) => x.id === n.id) === i);

    return {
      nodes: [center, ...uniqueConnected],
      edges: entityRels,
      totalNodes: 1 + uniqueConnected.length,
      totalEdges: entityRels.length,
    };
  }
  if (procedure === "nil.getRecommendations") {
    return [
      { id: "ne-h-jg", entityType: "person", displayName: "Jonthan Guidry", module: "hr", description: "LPC, Case Manager", shared_connections: 2 },
      { id: "ne-ca1", entityType: "form", displayName: "CAPA-2026-001", module: "qa", description: "Dual-signature medication check", shared_connections: 1 },
      { id: "ne-wo1", entityType: "work_order", displayName: "WO-2026-001 — HVAC", module: "gad", description: "HVAC repair Wing B", shared_connections: 1 },
      { id: "ne-d1", entityType: "form", displayName: "ADL-HR-POL-202606-0001", module: "documents", description: "Employee Handbook v2026", shared_connections: 1 },
    ];
  }
  if (procedure === "nil.findPath") return { found: false, path: [], hops: 0 };
  if (procedure === "nil.reindex") return { entities: 21, relationships: 20 };
  // ─── M10 ENDPOINTS (Analytics) ───────────────────────────
  if (procedure === "analytics.workforceOverview") return {
    total: 42, employees: 38, contractors: 4,
    byLane: { activation: 22, management: 20 },
    byDepartment: { Clinical: 8, HR: 5, "QA & Compliance": 3, Revenue: 3, GRO: 6, GAD: 4, Executive: 3, IT: 2, Operations: 8 },
    byStatus: { active: 32, onboarding: 5, "on-leave": 2, terminated: 3 },
  };
  if (procedure === "analytics.moduleCompletionRates") return [
    { moduleId: "mod-hr-policies", moduleName: "HR Policies & Procedures", completed: 35, pending: 7, rate: 83 },
    { moduleId: "mod-hipaa", moduleName: "HIPAA Privacy & Security", completed: 38, pending: 4, rate: 90 },
    { moduleId: "mod-cfr-42", moduleName: "42 CFR Part 2", completed: 36, pending: 6, rate: 86 },
    { moduleId: "mod-crisis", moduleName: "Crisis Intervention", completed: 30, pending: 12, rate: 71 },
    { moduleId: "mod-documentation", moduleName: "Clinical Documentation", completed: 32, pending: 10, rate: 76 },
    { moduleId: "mod-medication", moduleName: "Medication Administration", completed: 28, pending: 14, rate: 67 },
    { moduleId: "mod-youth-rights", moduleName: "Youth Rights & Advocacy", completed: 34, pending: 8, rate: 81 },
    { moduleId: "mod-restraint", moduleName: "Restraint & Seclusion", completed: 29, pending: 13, rate: 69 },
    { moduleId: "mod-billing", moduleName: "Billing & Coding Basics", completed: 25, pending: 17, rate: 60 },
    { moduleId: "mod-safety", moduleName: "Facility Safety & Fire", completed: 40, pending: 2, rate: 95 },
  ];
  if (procedure === "analytics.documentCompliance") return [
    { moduleId: "personnel-file", verified: 35, uploaded: 5, rejected: 2, complianceRate: 83 },
    { moduleId: "credential-verification", verified: 32, uploaded: 8, rejected: 2, complianceRate: 76 },
    { moduleId: "background-check", verified: 38, uploaded: 3, rejected: 1, complianceRate: 90 },
    { moduleId: "tb-screening", verified: 36, uploaded: 5, rejected: 1, complianceRate: 86 },
    { moduleId: "drug-screening", verified: 37, uploaded: 4, rejected: 1, complianceRate: 88 },
    { moduleId: "i-9-verification", verified: 34, uploaded: 6, rejected: 2, complianceRate: 81 },
    { moduleId: "w-4-forms", verified: 38, uploaded: 3, rejected: 1, complianceRate: 90 },
    { moduleId: "emergency-contact", verified: 40, uploaded: 2, rejected: 0, complianceRate: 95 },
  ];
  if (procedure === "analytics.transitionActivity") {
    const byDay = [
      { date: "2026-05-30", count: 2 }, { date: "2026-05-31", count: 1 },
      { date: "2026-06-01", count: 3 }, { date: "2026-06-02", count: 0 },
      { date: "2026-06-03", count: 2 }, { date: "2026-06-04", count: 4 },
      { date: "2026-06-05", count: 1 }, { date: "2026-06-06", count: 0 },
      { date: "2026-06-07", count: 2 }, { date: "2026-06-08", count: 3 },
      { date: "2026-06-09", count: 1 }, { date: "2026-06-10", count: 2 },
      { date: "2026-06-11", count: 4 }, { date: "2026-06-12", count: 2 },
      { date: "2026-06-13", count: 1 }, { date: "2026-06-14", count: 0 },
      { date: "2026-06-15", count: 3 }, { date: "2026-06-16", count: 2 },
      { date: "2026-06-17", count: 1 }, { date: "2026-06-18", count: 3 },
      { date: "2026-06-19", count: 2 }, { date: "2026-06-20", count: 4 },
      { date: "2026-06-21", count: 1 }, { date: "2026-06-22", count: 2 },
      { date: "2026-06-23", count: 3 }, { date: "2026-06-24", count: 1 },
      { date: "2026-06-25", count: 2 }, { date: "2026-06-26", count: 3 },
      { date: "2026-06-27", count: 1 }, { date: "2026-06-28", count: 2 },
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
    return { recent: byDay.reduce((s: number, d: any) => s + d.count, 0), byDay, byModule };
  }
  if (procedure === "analytics.timeToClearMetrics") return {
    averageDays: 14, medianDays: 12,
    byLane: { activation: { avgDays: 18, count: 15 }, management: { avgDays: 10, count: 23 } },
    byDepartment: { Clinical: { avgDays: 16, count: 8 }, HR: { avgDays: 12, count: 5 }, "QA & Compliance": { avgDays: 20, count: 3 }, Revenue: { avgDays: 11, count: 3 }, GRO: { avgDays: 15, count: 6 }, GAD: { avgDays: 13, count: 4 }, Executive: { avgDays: 8, count: 3 }, Operations: { avgDays: 14, count: 8 } },
  };
  if (procedure === "analytics.alertSummary") return {
    activeWithoutClearance: 2, expiredCredentials: 3, pendingOrientation: 5,
    incompletePersonnelFiles: 4, restrictedClearance: 1, pendingOffers: 2,
    pendingReviews: 3, expiringSoon: 6,
  };
  if (procedure === "analytics.clinicalOverview") return {
    totalYouth: 4, activeYouth: 4, admissionsThisMonth: 2, dischargesThisMonth: 0,
    assessmentsPending: 1, sessionsThisWeek: 12, avgCansScore: 18, highRiskCount: 1,
    safetyPlansActive: 2,
    byLevelOfCare: [{ name: "Residential", value: 4 }, { name: "Outpatient", value: 0 }, { name: "Crisis", value: 0 }],
    byRiskLevel: [{ name: "Low", value: 1 }, { name: "Moderate", value: 2 }, { name: "High", value: 1 }, { name: "Critical", value: 0 }],
  };
  if (procedure === "analytics.residentialOverview") return {
    campusCapacity: 48, operationalBeds: 12, occupiedBeds: 7, occupancyRate: 58,
    shiftsThisWeek: 21, observationsThisWeek: 18, familyContactsThisWeek: 6,
    medicationsScheduled: 8, medicationsAdministered: 6, medicationsRefused: 1, medicationsHeld: 1,
    behavioralIncidentsThisWeek: 2, prnAdministrations: 1,
    byFacility: [
      { name: "Main Residence", occupied: 4, capacity: 4, rate: 100 },
      { name: "New Facility", occupied: 3, capacity: 8, rate: 38 },
      { name: "Emergency Care GRO", occupied: 0, capacity: 16, rate: 0 },
      { name: "Purpose-Built", occupied: 0, capacity: 16, rate: 0 },
    ],
  };
  if (procedure === "analytics.revenueOverview") return {
    totalClaims: 24, claimsPending: 6, claimsApproved: 14, claimsDenied: 3, claimsAppealed: 1,
    totalBilled: 1840000, totalCollected: 1420000, collectionRate: 77, avgDaysToPayment: 18,
    authorizationsActive: 4, authorizationsPending: 2, authorizationsExpiring: 1,
    denialsByReason: [
      { name: "Missing Documentation", value: 1 },
      { name: "Authorization Required", value: 1 },
      { name: "Coding Error", value: 1 },
    ],
  };
  if (procedure === "analytics.complianceOverview") return {
    openIncidents: 2, incidentsThisMonth: 4, openAudits: 1, auditsThisQuarter: 2,
    correctiveActionsOpen: 3, correctiveActionsOverdue: 1, chartAuditPassRate: 78,
    chartAuditsThisMonth: 2, hhscReportsDue: 1, hhscReportsOverdue: 0,
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
  if (procedure === "analytics.gadOverview") return {
    openWorkOrders: 3, inProgressWorkOrders: 2, completedThisMonth: 2, overdueWorkOrders: 0,
    urgentHighCount: 3, vendorCount: 7, vendorContractsExpiring: 2, facilities: 2,
    totalEstimatedSpend: 743000, totalActualSpend: 103000,
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
  if (procedure === "analytics.executiveSummary") return {
    timestamp: new Date().toISOString(),
    operationalStatus: "stable", criticalAlerts: 2, modulesOnline: 6, modulesTotal: 13,
    youthServedMTD: 4, revenueMTD: 1420000, expensesMTD: 103000, headcountActive: 38,
    openPositions: 4, incidentsOpen: 2, complianceScore: 78, riskLevel: "moderate",
  };
  if (procedure === "workflow.respondApproval") return { success: true, decision: "approved" };
  // revenue.* aliases (backward compat)
  if (procedure === "revenue.dashboardKPIs") return getSingleDemoData("m4.dashboardKPIs");
  if (procedure === "revenue.listClaims") return getSingleDemoData("m4.listClaims");
  if (procedure === "revenue.getClaim") return getSingleDemoData("m4.getClaim");
  if (procedure === "revenue.agingReport") return getSingleDemoData("m4.agingReport");
  if (procedure === "revenue.listPayers") return getSingleDemoData("m4.listPayers");
  // qa.* aliases (backward compat — qaRouter = m3Router)
  if (procedure === "qa.dashboardKPIs") return getSingleDemoData("m3.dashboardKPIs");
  if (procedure === "qa.listAudits") return getSingleDemoData("m3.listAudits");
  if (procedure === "qa.listIncidents") return getSingleDemoData("m3.listIncidents");
  if (procedure === "qa.listCorrectiveActions") return getSingleDemoData("m3.listCorrectiveActions");
  if (procedure === "qa.complianceScores") return getSingleDemoData("m3.complianceScores");
  // ═══════════════════════════════════════════════════════════════
  // COMPREHENSIVE LIVE STORE MUTATIONS — All CRUD routes here
  // ═══════════════════════════════════════════════════════════════

  // ─── Tasks / Work Items ───
  if (procedure === "m1.listWorkTasks" || procedure === "m1.listTasks" || procedure === "workflow.listTasks") return store.tasks;
  if (procedure === "m1.createWorkTask") return createTask(_input as any);
  if (procedure === "m1.completeWorkTask") return updateTask((_input as any).taskId, { status: "completed" });
  if (procedure === "m1.updateTask") return updateTask((_input as any).taskId || (_input as any).id, _input as any);
  if (procedure === "m1.deleteTask") return deleteTask((_input as any).taskId || (_input as any).id);

  // ─── QA / Audits / Incidents ───
  if (procedure === "m3.createAudit" || procedure === "qa.createAudit") return createAudit(_input as any);
  if (procedure === "m3.updateAudit" || procedure === "qa.updateAudit") return { success: true }; // partial
  if (procedure === "m3.deleteAudit" || procedure === "qa.deleteAudit") return { success: true };
  if (procedure === "m3.createIncident" || procedure === "qa.createIncident") return createIncident(_input as any);
  if (procedure === "m3.updateIncident" || procedure === "qa.updateIncident") return updateIncident((_input as any).id, _input as any);
  if (procedure === "m3.createCorrectiveAction" || procedure === "qa.createCorrectiveAction") return createTask({ title: (_input as any).title || "New CAP", category: "documentation", priority: (_input as any).priority || "medium", notes: (_input as any).description || "" });
  if (procedure === "m3.updateCorrectiveAction" || procedure === "qa.updateCorrectiveAction") return { success: true };

  // ─── Medications ───
  if (procedure === "m19.administer" || procedure === "m19.administerMedication" || procedure === "m20.administerMedication") return administerMed((_input as any).medicationId || (_input as any).id, (_input as any).administeredBy || "RN Martinez", (_input as any).adminTime || new Date().toTimeString().slice(0,5), (_input as any).notes || "");
  if (procedure === "m19.recordRefusal" || procedure === "m19.refuseMedication" || procedure === "m20.refuseMedication") return refuseMed((_input as any).medicationId || (_input as any).id, (_input as any).reason || "Youth refused");
  if (procedure === "m19.holdMedication" || procedure === "m20.holdMedication") return holdMed((_input as any).medicationId || (_input as any).id, (_input as any).reason || "Clinical hold");
  if (procedure === "m19.recordPrn" || procedure === "m20.recordPrn") return recordPrn((_input as any).medicationId || (_input as any).id, (_input as any).administeredBy || "RN Martinez", (_input as any).adminTime || new Date().toTimeString().slice(0,5), (_input as any).prnReason || "", (_input as any).effectiveness || "effective", (_input as any).notes || "");
  if (procedure === "m19.recordControlled" || procedure === "m20.recordControlled") return administerMed((_input as any).medicationId || (_input as any).id, (_input as any).administeredBy || "RN Martinez", (_input as any).adminTime || new Date().toTimeString().slice(0,5), `Controlled: before=${(_input as any).countBefore} after=${(_input as any).countAfter} witness=${(_input as any).witnessName}`);
  if (procedure === "m19.createMedication") return { ..._input, id: nextId("med"), status: "scheduled" };

  // ─── Behavioral Observations ───
  if (procedure === "m15.createObservation" || procedure === "m18.createBehavioralObs" || procedure === "bhc.createObservation") return createBehavioralObs(_input as any);
  if (procedure === "m15.respondToObservation") return { success: true };

  // ─── Family Contacts ───
  if (procedure === "m18.createFamilyContact" || procedure === "bhc.createFamilyContact") return createFamilyContact(_input as any);

  // ─── Incidents (general) ───
  if (procedure === "m18.createIncident" || procedure === "incident.create" || procedure === "m17.createCrisis") return createIncident(_input as any);
  if (procedure === "m17.advanceStep" || procedure === "m17.updateCrisisOutcome" || procedure === "m17.createDebrief" || procedure === "m17.updateDebrief") return { success: true };

  // ─── Shifts / Handoffs ───
  if (procedure === "m18.createHandoff") return updateShift((_input as any).shiftId || "s1", { handoffNote: (_input as any).note || "", handoffAlerts: (_input as any).alerts || [], pendingHandoffs: 0 });
  if (procedure === "m18.createShift") return createShiftFn(_input as any);
  if (procedure === "m18.assignBed") return assignBed((_input as any).bedId || "", (_input as any).youthId || "");
  if (procedure === "m18.vacateBed") return vacateBed((_input as any).bedId || "");

  // ─── Sessions / Plans ───
  if (procedure === "bhc.createSession" || procedure === "bhc.createTreatmentPlan" || procedure === "bhc.createOutcomeMeasure") return createSession(_input as any);
  if (procedure === "bhc.dischargePatient") return { success: true };
  if (procedure === "bhc.createPatient") return { ..._input, id: nextId("y"), status: "active" };

  // ─── GRO Referrals ───
  if (procedure === "gro.createReferral" || procedure === "gro.updateReferral") return createReferral(_input as any);
  if (procedure === "gro.createPartnership") return { success: true };

  // ─── GAD Work Orders ───
  if (procedure === "gad.createWorkOrder") return createWorkOrder(_input as any);
  if (procedure === "gad.updateWorkOrder") return updateWorkOrder((_input as any).id || (_input as any).workOrderId, _input as any);

  // ─── Meetings / Escalations ───
  if (procedure === "m15.createMeeting" || procedure === "m15.updateMeeting") return createMeeting(_input as any);
  if (procedure === "m15.createActionItem" || procedure === "m15.updateActionItem") return { ..._input, id: nextId("m15") };
  if (procedure === "m15.createEscalation" || procedure === "m15.updateEscalation") return createEscalation(_input as any);

  // ─── Workflow / Approvals ───
  if (procedure === "workflow.respondApproval") return respondToApproval((_input as any).approvalId || "", (_input as any).decision || "approved");
  if (procedure === "workflow.trigger") return { success: true };

  // ─── Auth / Settings ───
  if (procedure === "auth.updateUser") return { ..._input, id: (_input as any).id || "u1" };
  if (procedure === "auth.deleteUser") return { success: true };

  // ─── MS Graph ───
  if (procedure === "msgraph.sync") return { success: true, synced: 0 };

  // ─── HR / Onboarding ───
  if (procedure === "m1.addCredential" || procedure === "m1.createEvidencePacket" || procedure === "m1.updateModuleProgress" || procedure === "m1.seedDefaultTemplates") return { success: true };

  // ─── Case Management ───
  if (procedure === "m16.createCase" || procedure === "m16.updateCase") return { ..._input, id: nextId("case") };

  // ─── Intake / Assessment ───
  if (procedure === "m13.createYouth" || procedure === "m13.updateYouth" || procedure === "m13.createIntake" || procedure === "m13.updateStep" || procedure === "m13.createChecklist" || procedure === "m13.updateChecklist") return { ..._input, id: nextId("m13") };
  if (procedure === "m14.createAssessment" || procedure === "m14.updateAssessment" || procedure === "m14.updateDomain" || procedure === "m14.determineLOC") return { ..._input, id: nextId("m14") };

  // ─── Revenue ───
  if (procedure === "m4.createClaim" || procedure === "m4.updateClaim" || procedure === "m20.createAuthorization" || procedure === "m20.updateReadiness" || procedure === "m20.advanceStage") return { ..._input, id: nextId("rev") };

  // ─── Audit / Persona ───
  if (procedure === "m21.createAudit" || procedure === "m21.updateAudit" || procedure === "m21.activatePersona") return { success: true };

  // ─── Document Management ───
  if (procedure === "m2.create" || procedure === "m2.update" || procedure === "m2.delete" || procedure === "m2.transitionStatus" || procedure === "m2.createVersion" || procedure === "m2.seedCategories") return { success: true };
  // ─── M13/M14 ENDPOINTS (Youth Pathway — Sprint 2) ────────
  if (procedure === "m13.listYouth") return store.youth;
  if (procedure === "m13.getYouth") return { id: "y1", mrn: "BHC-2026-001", first_name: "Marcus", last_name: "Johnson", date_of_birth: "2010-03-15", age: 16, gender: "male", race: "Black/African American", ethnicity: "Hispanic", preferred_language: "English", phone: "(512) 555-0101", email: "guardian.mjohnson@email.com", address: "1423 Cypress Lane, Houston, TX 77001", city: "Houston", state: "TX", zip: "77001", guardian1_name: "Tanya Johnson", guardian1_relationship: "Mother", guardian1_phone: "(512) 555-0102", guardian1_email: "tanya.j@email.com", guardian2_name: "Robert Johnson", guardian2_relationship: "Father", guardian2_phone: "(512) 555-0103", emergency_name: "Grandma Johnson", emergency_relationship: "Grandmother", emergency_phone: "(512) 555-0104", referral_source_type: "school", referral_source_name: "HISD School Counselor", referred_by: "Ms. Garcia", referral_date: "2026-03-15", assigned_clinician_id: "u2", assigned_clinician_name: "Dr. Hall", assigned_case_manager_id: "u3", assigned_case_manager_name: "Lilian Ike", status: "active", level_of_care: "residential", bed_assignment: "Room 101-A", primary_payer_name: "Texas Medicaid", policy_number: "TXM-88765432", group_number: "GRP-001", subscriber_name: "Tanya Johnson", subscriber_relationship: "Mother", admission_date: "2026-04-01", projected_discharge_date: "2026-10-01", notes: "Trauma history, responding well to CBT." };
  if (procedure === "m13.listIntakes") return [
    { id: "i1", youth_id: "y3", mrn: "BHC-2026-003", youth_name: "Carlos Martinez", referral_received_date: "2026-06-28", referral_received_by: "gro.admin@adolbi.com", referral_received_completed: 1, screening_completed: 1, screening_result: "pass", consent_completed: 0, payer_completed: 0, disposition_completed: 0, current_step: "consent", overall_status: "in_progress", is_blocked: 0, created_at: "2026-06-28T14:00:00Z" },
    { id: "i2", youth_id: "y5", mrn: "BHC-2026-005", youth_name: "Sophia Chen", referral_received_date: "2026-06-27", referral_received_by: "gro.admin@adolbi.com", referral_received_completed: 1, screening_completed: 1, screening_result: "needs_review", consent_completed: 0, payer_completed: 0, disposition_completed: 0, current_step: "consent", overall_status: "in_progress", is_blocked: 0, created_at: "2026-06-27T08:15:00Z" },
  ];
  if (procedure === "m13.getIntake") return { id: "i1", youth_id: "y3", mrn: "BHC-2026-003", youth_name: "Carlos Martinez", referral_received_date: "2026-06-28T10:00:00Z", referral_received_by: "gro.admin@adolbi.com", referral_received_notes: "Referral from DCF caseworker. Emergency placement needed.", referral_received_completed: 1, referral_elapsed_hours: 2, screening_date: "2026-06-28T14:00:00Z", screening_completed_by: "dr.hall@adolbi.com", screening_result: "pass", screening_notes: "Screening completed. Youth presents with conduct disorder symptoms. No imminent safety concerns.", screening_completed: 1, screening_elapsed_hours: 4, consent_date: null, consent_completed_by: null, guardian_consent_obtained: 0, youth_assent_obtained: 0, hipaa_acknowledgment: 0, rights_acknowledgment: 0, consent_notes: "Awaiting guardian consent. Mother scheduled for 6/29.", consent_completed: 0, consent_elapsed_hours: 18, payer_verification_date: null, payer_verification_completed_by: null, benefits_verified: 0, authorization_required: 1, authorization_submitted: 0, authorization_approved: 0, payer_notes: "", payer_completed: 0, payer_elapsed_hours: 0, disposition_date: null, disposition_completed_by: null, disposition: null, disposition_reason: null, bed_assigned: null, admission_scheduled_date: null, disposition_completed: 0, disposition_elapsed_hours: 0, current_step: "consent", overall_status: "in_progress", is_blocked: 0, block_reason: null, created_at: "2026-06-28T14:00:00Z", updated_at: "2026-06-29T08:00:00Z", created_by: "gro.admin@adolbi.com" };
  if (procedure === "m13.getChecklist") return { id: "cl1", youth_id: "y3", intake_id: "i1", item1_referral_form_received: 1, item2_demographics_complete: 1, item3_insurance_verified: 0, item4_consent_for_release: 0, item5_psychiatric_history: 1, item6_medical_records_requested: 1, item7_educational_records_requested: 0, item8_legal_status_confirmed: 1, item9_guardian_contact_verified: 1, item10_service_activation_date_set: 0, items_completed: 6, items_total: 10, all_items_complete: 0, completed_by: null, completed_at: null };
  if (procedure === "m14.listAssessments") return [
    { id: "a1", youth_id: "y1", mrn: "BHC-2026-001", youth_name: "Marcus Johnson", assessment_type: "intake", assessment_date: "2026-04-03", completed_by: "Dr. Hall", clinician_name: "Dr. Hall", cans_completed: 1, cans_total_score: 18, cans_risk_level: "high", loc_determined: 1, loc_level: "loc_1_high_acuity", loc_clinical_rationale: "High safety risk + moderate clinical complexity requires 24-hour supervision", loc_approved_by: "Dr. Hall", loc_approved_at: "2026-04-03T16:00:00Z", risk_suicide: "low", risk_self_harm: "low", risk_aggression: "moderate", risk_elopement: "moderate", risk_substance_use: "none", risk_vulnerability: "low", overall_risk_level: "moderate", safety_plan_required: 1, safety_plan_completed: 1, status: "completed", reviewed_by: "Dr. Hall", reviewed_at: "2026-04-05T10:00:00Z", approved_by: "Dr. Hall", approved_at: "2026-04-05T14:00:00Z", created_at: "2026-04-03T10:00:00Z" },
    { id: "a2", youth_id: "y3", mrn: "BHC-2026-003", youth_name: "Carlos Martinez", assessment_type: "intake", assessment_date: "2026-06-29", completed_by: "Lilian Ike", clinician_name: "Lilian Ike", cans_completed: 0, cans_total_score: null, cans_risk_level: null, loc_determined: 0, loc_level: "not_determined", risk_suicide: "none", risk_self_harm: "none", risk_aggression: "high", risk_elopement: "moderate", risk_substance_use: "none", risk_vulnerability: "moderate", overall_risk_level: "high", safety_plan_required: 1, safety_plan_completed: 0, status: "in_progress", reviewed_by: null, reviewed_at: null, approved_by: null, approved_at: null, created_at: "2026-06-29T09:00:00Z" },
  ];
  if (procedure === "m14.getAssessment") return { id: "a1", youth_id: "y1", mrn: "BHC-2026-001", youth_name: "Marcus Johnson", assessment_type: "intake", assessment_date: "2026-04-03", completed_by: "Dr. Hall", completed_by_id: "u2", clinician_name: "Dr. Hall", clinician_id: "u2", supervisor_name: "E. Russ Aideyan", supervisor_id: "u1", presenting_problems: "Persistent sadness, social withdrawal, declining academic performance, insomnia lasting 4 months. Reports feeling worthless and occasional passive suicidal ideation without plan or intent.", psychiatric_history: "No prior psychiatric hospitalizations. Outpatient therapy for 6 months in 2025 with limited progress.", substance_use_history: "Denies substance use. Urine screen negative at intake.", trauma_history: "Witnessed domestic violence between ages 8-12. Parents separated when patient was 10.", medical_history: "Generally healthy. Mild asthma, managed with albuterol PRN. Allergies: penicillin.", family_history: "Mother: anxiety disorder (treated). Father: depression (untreated). Maternal uncle: substance use disorder.", educational_history: "9th grade at Kashmere High School. Declining grades over past year (A/B to D/F). School refusal increasing.", cans_completed: 1, cans_total_score: 18, cans_risk_level: "high", loc_determined: 1, loc_level: "loc_1_high_acuity", loc_decision_matrix_json: '{"safetyRisk":"high","clinicalComplexity":"moderate","functionalImpairment":"high","familySupport":"moderate"}', loc_clinical_rationale: "High safety risk (passive SI + trauma history) combined with significant functional impairment (school failure, social withdrawal) and moderate clinical complexity. 24-hour structured environment warranted.", loc_approved_by: "Dr. Hall", loc_approved_at: "2026-04-03T16:00:00Z", risk_suicide: "low", risk_self_harm: "low", risk_aggression: "moderate", risk_elopement: "moderate", risk_substance_use: "none", risk_vulnerability: "low", overall_risk_level: "moderate", safety_plan_required: 1, safety_plan_completed: 1, status: "completed", reviewed_by: "Dr. Hall", reviewed_at: "2026-04-05T10:00:00Z", approved_by: "Dr. Hall", approved_at: "2026-04-05T14:00:00Z", domains: [{ id: "ad1", assessment_id: "a1", domain_number: 1, domain_name: "Behavioral / Emotional Functioning", score: 2, score_label: "moderate", strengths: "Engages well in individual therapy. Shows insight into depression.", needs: "Social withdrawal, persistent sadness, sleep disturbance.", observations: "Patient appeared downcast but cooperative. Made eye contact. Responded well to supportive statements.", clinical_notes: "CBT recommended. Trauma-informed approach essential.", intervention_needed: 1, intervention_description: "Individual CBT 2x weekly, group therapy 1x weekly" }, { id: "ad2", assessment_id: "a1", domain_number: 2, domain_name: "Cognitive / Developmental Functioning", score: 1, score_label: "mild", strengths: "Above-average intelligence. Good problem-solving skills.", needs: "Difficulty concentrating, especially on academic tasks.", observations: "Alert and oriented. Memory intact. Abstract reasoning adequate.", clinical_notes: "ADHD screening recommended but not indicated at this time.", intervention_needed: 0, intervention_description: null }, { id: "ad3", assessment_id: "a1", domain_number: 3, domain_name: "Social / Relational Functioning", score: 2, score_label: "moderate", strengths: "Has one close friend. Shows empathy toward peers.", needs: "Social anxiety, difficulty making new friends, isolates in groups.", observations: "Participated minimally in group activity. Sat at periphery.", clinical_notes: "Social skills group recommended. Gradual exposure to peer activities.", intervention_needed: 1, intervention_description: "Social skills group 1x weekly" }, { id: "ad4", assessment_id: "a1", domain_number: 4, domain_name: "Family / Caregiver Functioning", score: 2, score_label: "moderate", strengths: "Mother is supportive and engaged in treatment.", needs: "Father absent. Co-parenting conflict. Mother's own anxiety affects parenting.", observations: "Mother attended family session. Open to parenting coaching.", clinical_notes: "Family therapy 2x monthly. Parenting skills training for mother.", intervention_needed: 1, intervention_description: "Family therapy 2x monthly" }, { id: "ad5", assessment_id: "a1", domain_number: 5, domain_name: "Safety / Risk Behaviors", score: 2, score_label: "moderate", strengths: "No history of self-harm. No suicide attempts. No aggression toward others.", needs: "Passive suicidal ideation without plan. History of elopement from home.", observations: "Cooperative with safety planning. Identified 3 reasons for living.", clinical_notes: "Safety plan completed. 15-minute checks first 72 hours.", intervention_needed: 1, intervention_description: "Safety plan, 15-minute checks, crisis protocol review" }, { id: "ad6", assessment_id: "a1", domain_number: 6, domain_name: "Physical Health / Medical", score: 1, score_label: "mild", strengths: "Generally healthy. Takes albuterol as needed.", needs: "Mild asthma. Irregular sleep schedule.", observations: "Physical exam within normal limits. Lungs clear.", clinical_notes: "Continue PRN albuterol. Sleep hygiene intervention.", intervention_needed: 0, intervention_description: null }] };
  // (Live store mutations are handled above at lines 717-801)
  // ─── M15 ENDPOINTS (M14 Daily Coordination — Sprint 2) ─────
  if (procedure === "m15.listObservations") return [
    { id: "obs1", youth_id: "y1", youth_name: "Marcus Johnson", mrn: "BHC-2026-001", observation_date: "2026-07-01", shift: "day", observed_by: "Sarah RCS", observed_by_id: "u10", domain1_safety: 1, domain1_safety_notes: "No safety concerns. Compliant with unit rules.", domain1_safety_score: 0, domain2_regulation: 1, domain2_regulation_notes: "Good emotional regulation during group activity.", domain2_regulation_score: 0, domain3_functioning: 1, domain3_functioning_notes: "Completed morning routine independently.", domain3_functioning_score: 0, domain4_medication: 1, domain4_medication_notes: "Took AM meds without issue.", domain4_medication_score: 0, domain5_relationships: 1, domain5_relationships_notes: "Interacted positively with peers at breakfast.", domain5_relationships_score: 0, domain6_participation: 1, domain6_participation_notes: "Engaged in group therapy. Shared appropriately.", domain6_participation_score: 0, clinically_significant: 0, clinical_concerns: null, routed_to_clinician: 0, routed_to_clinician_id: null, routed_to_clinician_name: null, clinician_response: null, created_at: "2026-07-01T14:00:00Z" },
    { id: "obs2", youth_id: "y4", youth_name: "Jada Thompson", mrn: "BHC-2026-004", observation_date: "2026-07-01", shift: "day", observed_by: "Mike RCS", observed_by_id: "u11", domain1_safety: 1, domain1_safety_notes: "Verbal altercation with peer at lunch. Staff intervened. No physical contact.", domain1_safety_score: 2, domain2_regulation: 1, domain2_regulation_notes: "Difficulty regulating after conflict. Took 20 min to de-escalate.", domain2_regulation_score: 2, domain3_functioning: 1, domain3_functioning_notes: "Refused afternoon activity. Remained in room.", domain3_functioning_score: 2, domain4_medication: 1, domain4_medication_notes: "Took PRN as ordered after incident.", domain4_medication_score: 1, domain5_relationships: 1, domain5_relationships_notes: "Isolating from peers after conflict. Refused group dinner.", domain5_relationships_score: 2, domain6_participation: 0, domain6_participation_notes: "Declined all activities after lunch incident.", domain6_participation_score: 3, clinically_significant: 1, clinical_concerns: "Peer conflict + isolation pattern. Monitor for escalation.", routed_to_clinician: 1, routed_to_clinician_id: "u3", routed_to_clinician_name: "Lilian Ike", clinician_response: "I'll check in with Jada during my evening rounds. Planning 1:1 session tomorrow morning.", created_at: "2026-07-01T18:30:00Z" },
    { id: "obs3", youth_id: "y2", youth_name: "Aaliyah Williams", mrn: "BHC-2026-002", observation_date: "2026-07-01", shift: "evening", observed_by: "Tasha RCS", observed_by_id: "u12", domain1_safety: 1, domain1_safety_notes: "Calm and cooperative throughout evening.", domain1_safety_score: 0, domain2_regulation: 1, domain2_regulation_notes: "Used coping skills when frustrated during homework.", domain2_regulation_score: 0, domain3_functioning: 1, domain3_functioning_notes: "Completed homework with minimal prompting.", domain3_functioning_score: 0, domain4_medication: 1, domain4_medication_notes: "Took PM meds. No issues.", domain4_medication_score: 0, domain5_relationships: 1, domain5_relationships_notes: "Helped new peer learn evening routine.", domain5_relationships_score: 0, domain6_participation: 1, domain6_participation_notes: "Active in evening group. Led discussion topic.", domain6_participation_score: 0, clinically_significant: 0, clinical_concerns: null, routed_to_clinician: 0, routed_to_clinician_id: null, routed_to_clinician_name: null, clinician_response: null, created_at: "2026-07-01T22:00:00Z" },
  ];
  if (procedure === "m15.coordinationSummary") return {
    todayObservations: 3,
    pendingClinicalResponses: 0,
    todaysMeetings: 2,
    openActionItems: 4,
    activeEscalations: 1,
    activeCrisisEvents: 0,
  };
  if (procedure === "m15.listMeetings") return [
    { id: "mt1", meeting_type: "daily_huddle", title: "Daily Huddle — July 1", scheduled_date: "2026-07-01", scheduled_time: "07:30", duration_minutes: 15, facilitator_name: "Sarah RCS (Lead)", attendees_json: '[{"name":"Sarah RCS","role":"RCS Lead"},{"name":"Mike RCS","role":"RCS"},{"name":"Tasha RCS","role":"RCS"},{"name":"Lilian Ike","role":"MHTCM"}]', youth_ids_json: '["y1","y2","y4"]', agenda_json: '["Overnight report","Jada incident review","Marcus family visit today","Shift assignments"]', status: "completed", completed_at: "2026-07-01T07:45:00Z", follow_up_required: 1, follow_up_notes: "Jada incident follow-up needed", created_at: "2026-07-01T07:00:00Z" },
    { id: "mt2", meeting_type: "case_staffing", title: "Weekly Case Staffing", scheduled_date: "2026-07-02", scheduled_time: "14:00", duration_minutes: 60, facilitator_name: "Dr. Hall", attendees_json: '[{"name":"Dr. Hall","role":"Clinical Director"},{"name":"Lilian Ike","role":"MHTCM"},{"name":"Sarah RCS","role":"RCS Lead"},{"name":"E. Russ Aideyan","role":"Managing Director"}]', youth_ids_json: '["y1","y2","y3","y4"]', agenda_json: '["Marcus Johnson — progress review","Aaliyah Williams — quarterly assessment","Carlos Martinez — intake status","Jada Thompson — incident review + safety plan"]', status: "scheduled", follow_up_required: 0, created_at: "2026-06-30T10:00:00Z" },
    { id: "mt3", meeting_type: "family_conference", title: "Marcus Johnson — Family Conference", scheduled_date: "2026-07-03", scheduled_time: "16:00", duration_minutes: 45, facilitator_name: "Lilian Ike", attendees_json: '[{"name":"Lilian Ike","role":"MHTCM"},{"name":"Tanya Johnson","role":"Guardian"},{"name":"Robert Johnson","role":"Guardian"}]', youth_ids_json: '["y1"]', agenda_json: '["Treatment progress update","Discharge planning discussion","Family therapy schedule","Home visit assessment"]', status: "scheduled", follow_up_required: 0, created_at: "2026-06-28T14:00:00Z" },
  ];
  if (procedure === "m15.getMeeting") return { id: "mt2", meeting_type: "case_staffing", title: "Weekly Case Staffing", scheduled_date: "2026-07-02", scheduled_time: "14:00", duration_minutes: 60, facilitator_name: "Dr. Hall", attendees_json: '[{"name":"Dr. Hall","role":"Clinical Director"},{"name":"Lilian Ike","role":"MHTCM"},{"name":"Sarah RCS","role":"RCS Lead"},{"name":"E. Russ Aideyan","role":"Managing Director"}]', youth_ids_json: '["y1","y2","y3","y4"]', agenda_json: '["Marcus Johnson — progress review","Aaliyah Williams — quarterly assessment","Carlos Martinez — intake status","Jada Thompson — incident review + safety plan"]', notes: "", status: "scheduled", follow_up_required: 0, created_at: "2026-06-30T10:00:00Z", actionItems: [{ id: "ai1", meeting_id: "mt2", description: "Complete Marcus quarterly assessment documentation", assigned_to_name: "Dr. Hall", priority: "high", due_date: "2026-07-04", status: "open" }, { id: "ai2", meeting_id: "mt2", description: "Schedule Carlos intake assessment with guardian", assigned_to_name: "Lilian Ike", priority: "urgent", due_date: "2026-07-01", status: "overdue" }, { id: "ai3", meeting_id: "mt2", description: "Update Jada safety plan post-incident", assigned_to_name: "Dr. Hall", priority: "high", due_date: "2026-07-02", status: "in_progress" }, { id: "ai4", meeting_id: "mt2", description: "Prepare family conference materials for Marcus", assigned_to_name: "Lilian Ike", priority: "medium", due_date: "2026-07-03", status: "open" }] };
  if (procedure === "m15.listEscalations") return [
    { id: "esc1", youth_id: "y4", youth_name: "Jada Thompson", mrn: "BHC-2026-004", tier: "clinical", previous_tier: "routine", trigger_source: "observation", trigger_description: "Peer conflict + social isolation pattern", trigger_detail: "Verbal altercation at lunch followed by refusal to engage in afternoon activities and group dinner. Historical pattern of escalation after conflicts.", response_actions: '["Staff debrief","1:1 check-in scheduled","PRN administered as ordered","Clinician notified"]', responder_name: "Mike RCS", responder_role: "RCS", responded_at: "2026-07-01T18:45:00Z", resolution_notes: "Jada calmed after PRN and 1:1 with RCS. Declined dinner but accepted evening snack. Will monitor overnight.", resolved_at: "2026-07-01T21:00:00Z", resolved_by: "Tasha RCS", status: "monitoring", requires_post_crisis_review: 0, post_crisis_review_completed: 0, created_at: "2026-07-01T18:30:00Z" },
    { id: "esc2", youth_id: "y1", youth_name: "Marcus Johnson", mrn: "BHC-2026-001", tier: "routine", previous_tier: null, trigger_source: "staff_report", trigger_description: "Missed morning medication", trigger_detail: "Marcus stated he 'forgot' his morning meds. This is the first occurrence. No behavioral changes observed.", response_actions: '["Med re-offered and taken","Documented in MAR","Guardian notification per protocol"]', responder_name: "Sarah RCS", responder_role: "RCS Lead", responded_at: "2026-07-01T08:30:00Z", resolution_notes: "Med taken after reminder. No further action needed. Monitor pattern.", resolved_at: "2026-07-01T08:30:00Z", resolved_by: "Sarah RCS", status: "resolved", requires_post_crisis_review: 0, post_crisis_review_completed: 0, created_at: "2026-07-01T08:15:00Z" },
  ];

  // ─── M16/M17 ENDPOINTS (M15 Case/Crisis — Sprint 2) ──────
  if (procedure === "m16.listCases") return [
    { id: "cm1", youth_id: "y1", youth_name: "Marcus Johnson", mrn: "BHC-2026-001", case_manager_id: "u3", case_manager_name: "Lilian Ike", function1_coordination: 1, function1_coordination_notes: "Coordinated with school counselor re: academic accommodations. Family engaged in weekly family therapy.", function2_referrals: 1, function2_referrals_json: '[{"provider":"Kashmere High School","type":"Educational Accommodations","status":"Active","date":"2026-04-15"},{"provider":"Dr. Patel","type":"Psychiatry","status":"Active","date":"2026-04-10"}]', function3_collaterals: 1, function3_collaterals_json: '[{"contact":"Tanya Johnson","relationship":"Mother","date":"2026-06-28","notes":"Weekly phone check-in. Reports improvement at home."},{"contact":"Ms. Garcia","relationship":"School Counselor","date":"2026-06-25","notes":"Grades improving. Attendance stable."}]', function4_barriers: 1, function4_barriers_json: '[{"barrier":"Father non-participation in family therapy","impact":"Moderate","resolution":"Ongoing outreach to father. Alternative: uncle may participate."},{"barrier":"Transportation for school visits","impact":"Low","resolution":"Staff provides transportation"}]', function5_monitoring: 1, function5_monitoring_notes: "Weekly progress tracking. Depression scores trending downward (PHQ-A: 18→12). Sleep improved. Social engagement increasing.", function6_transition: 0, function6_transition_notes: "Not yet applicable. Target discharge review in August.", status: "active", last_review_date: "2026-06-28", next_review_date: "2026-07-05", created_at: "2026-04-03T10:00:00Z" },
    { id: "cm2", youth_id: "y4", youth_name: "Jada Thompson", mrn: "BHC-2026-004", case_manager_id: "u3", case_manager_name: "Lilian Ike", function1_coordination: 1, function1_coordination_notes: "Multi-system coordination: DCF, guardian, school, court. Weekly team calls.", function2_referrals: 1, function2_referrals_json: '[{"provider":"Houston ISD","type":"Special Education Eval","status":"Pending","date":"2026-06-15"},{"provider":"Juvenile Court","type":"Probation","status":"Active","date":"2026-05-20"}]', function3_collaterals: 1, function3_collaterals_json: '[{"contact":"Keisha Thompson","relationship":"Mother","date":"2026-06-27","notes":"Guardian reports Jada having difficulty at home on weekends."},{"contact":"Officer Davis","relationship":"Probation Officer","date":"2026-06-24","notes":"Compliant with probation terms. Attending all required meetings."}]', function4_barriers: 1, function4_barriers_json: '[{"barrier":"History of running away","impact":"High","resolution":"Safety plan in place. 15-min checks. Elopement precautions active."},{"barrier":"Mother work schedule conflicts with family therapy","impact":"Moderate","resolution":"Evening sessions scheduled"}]', function5_monitoring: 1, function5_monitoring_notes: "Daily behavioral tracking. Aggression episodes: 3 in past week (down from 6). Isolation periods decreasing.", function6_transition: 0, function6_transition_notes: "Not yet applicable. Minimum 90-day stay required.", status: "active", last_review_date: "2026-06-29", next_review_date: "2026-07-02", created_at: "2026-05-20T11:00:00Z" },
    { id: "cm3", youth_id: "y3", youth_name: "Carlos Martinez", mrn: "BHC-2026-003", case_manager_id: "u3", case_manager_name: "Lilian Ike", function1_coordination: 0, function1_coordination_notes: "", function2_referrals: 0, function2_referrals_json: "[]", function3_collaterals: 0, function3_collaterals_json: "[]", function4_barriers: 0, function4_barriers_json: "[]", function5_monitoring: 0, function5_monitoring_notes: "", function6_transition: 0, function6_transition_notes: "", status: "active", last_review_date: null, next_review_date: null, created_at: "2026-06-29T09:00:00Z" },
  ];
  if (procedure === "m16.caseMgmtSummary") return { activeCases: 3, onHoldCases: 0, pendingReview: 0, totalCases: 3, overdueReviews: 0 };
  if (procedure === "m17.listCrises") return [
    { id: "cr1", youth_id: "y4", youth_name: "Jada Thompson", mrn: "BHC-2026-004", crisis_type: "behavioral_escalation", step1_identified: 1, step1_identified_at: "2026-07-01T18:15:00Z", step1_identified_by: "Mike RCS", step2_activated: 1, step2_activated_at: "2026-07-01T18:18:00Z", step2_activated_by: "Mike RCS", step3_responded: 1, step3_responded_at: "2026-07-01T18:20:00Z", step3_responder_name: "Mike RCS + Sarah RCS", step3_response_actions: '["Verbal de-escalation","Removed from dining area","Offered quiet space","PRN offered"]', step4_ensured_safety: 1, step4_safety_measures: "Youth in quiet room with 1:1 staff supervision. Other youth redirected. No injuries.", step4_ensured_at: "2026-07-01T18:25:00Z", step5_notified: 1, step5_notified_parties: '["Lilian Ike (MHTCM)","Dr. Hall (Clinical Director)","Keisha Thompson (Guardian)"]', step5_notified_at: "2026-07-01T18:30:00Z", step6_documented: 1, step6_documented_at: "2026-07-01T19:00:00Z", step6_documentation_ref: "Incident Report #2026-0701-004", step7_reviewed: 0, step7_reviewed_at: null, step7_reviewed_by: null, step7_review_notes: null, current_step: 7, overall_status: "under_review", youth_injured: 0, staff_injured: 0, restrictive_intervention_used: 0, restrictive_intervention_type: "none", created_at: "2026-07-01T18:15:00Z" },
    { id: "cr2", youth_id: "y1", youth_name: "Marcus Johnson", mrn: "BHC-2026-001", crisis_type: "suicide_self_harm", step1_identified: 1, step1_identified_at: "2026-05-10T02:30:00Z", step1_identified_by: "Night RCS", step2_activated: 1, step2_activated_at: "2026-05-10T02:32:00Z", step2_activated_by: "Night RCS", step3_responded: 1, step3_responded_at: "2026-05-10T02:35:00Z", step3_responder_name: "Night RCS + On-call Clinician", step3_response_actions: '["Safety check initiated","1:1 supervision implemented","Crisis assessment completed","Safety plan reviewed"]', step4_ensured_safety: 1, step4_safety_measures: "Continuous 1:1 supervision. All sharps removed from room. Safety plan activated.", step4_ensured_at: "2026-05-10T02:40:00Z", step5_notified: 1, step5_notified_parties: '["Dr. Hall (Clinical Director)","Lilian Ike (MHTCM)","Tanya Johnson (Guardian)"]', step5_notified_at: "2026-05-10T03:00:00Z", step6_documented: 1, step6_documented_at: "2026-05-10T06:00:00Z", step6_documentation_ref: "Incident Report #2026-0510-001", step7_reviewed: 1, step7_reviewed_at: "2026-05-11T10:00:00Z", step7_reviewed_by: "Dr. Hall", step7_review_notes: "Post-incident review completed. Trigger: anniversary of parental separation. Adjusted safety plan. Increased 1:1 therapy sessions.", current_step: 8, overall_status: "resolved", youth_injured: 0, staff_injured: 0, restrictive_intervention_used: 0, restrictive_intervention_type: "none", created_at: "2026-05-10T02:30:00Z" },
  ];
  if (procedure === "m17.getCrisis") return { id: "cr1", youth_id: "y4", youth_name: "Jada Thompson", mrn: "BHC-2026-004", crisis_type: "behavioral_escalation", step1_identified: 1, step1_identified_at: "2026-07-01T18:15:00Z", step1_identified_by: "Mike RCS", step2_activated: 1, step2_activated_at: "2026-07-01T18:18:00Z", step2_activated_by: "Mike RCS", step3_responded: 1, step3_responded_at: "2026-07-01T18:20:00Z", step3_responder_name: "Mike RCS + Sarah RCS", step3_response_actions: '["Verbal de-escalation","Removed from dining area","Offered quiet space","PRN offered"]', step4_ensured_safety: 1, step4_safety_measures: "Youth in quiet room with 1:1 staff supervision. Other youth redirected. No injuries.", step4_ensured_at: "2026-07-01T18:25:00Z", step5_notified: 1, step5_notified_parties: '["Lilian Ike (MHTCM)","Dr. Hall (Clinical Director)","Keisha Thompson (Guardian)"]', step5_notified_at: "2026-07-01T18:30:00Z", step6_documented: 1, step6_documented_at: "2026-07-01T19:00:00Z", step6_documentation_ref: "Incident Report #2026-0701-004", step7_reviewed: 0, step7_reviewed_at: null, step7_reviewed_by: null, step7_review_notes: null, current_step: 7, overall_status: "under_review", youth_injured: 0, staff_injured: 0, restrictive_intervention_used: 0, restrictive_intervention_type: "none", debrief: { id: "db1", crisis_event_id: "cr1", youth_id: "y4", youth_name: "Jada Thompson", field1_event_summary: "During lunch, Jada became verbally aggressive toward a peer who accidentally bumped her tray. She yelled, threw her food, and threatened to 'make them pay.' Staff immediately intervened with verbal de-escalation. Jada was escorted to a quiet space. PRN was offered and accepted.", field2_triggers_identified: "Physical contact (accidental bump), crowded dining environment, sensory overload from noise.", field3_early_warning_signs: "Jada had been isolating since morning (missed breakfast, declined group activity). She was seen pacing in hallway before lunch.", field4_interventions_used: "Verbal de-escalation, physical space removal, PRN medication, 1:1 supervision, quiet room.", field5_what_worked: "Quick staff response prevented physical altercation. Jada responded well to quiet space. PRN helped her calm within 30 minutes.", field6_what_did_not_work: "Jada did not respond to initial verbal redirection. Required physical escort which she initially resisted.", field7_youth_perspective: "Jada stated: 'I just got mad. Everyone is always in my way. I don't want to be here.' She acknowledged she 'overreacted' but felt 'nobody understands.'", field8_staff_perspective: "Mike RCS: Jada's isolation pattern preceded the incident. Recommend earlier intervention when youth shows isolation behaviors. Sarah RCS: Dining room may be too stimulating for Jada during high-stress periods.", field9_plan_adjustments: "1. Modified meal schedule: Jada eats in smaller group or 15 min earlier. 2. Daily check-in with MHTCM before lunch. 3. Sensory coping kit accessible. 4. Review safety plan with Jada.", safety_plan_updated: 1, safety_plan_changes: "Added dining-specific triggers. Modified response: early intervention when isolation observed. Added sensory coping strategies.", follow_up_required: 1, follow_up_actions: "1:1 therapy session 7/2, Guardian notification call, Peer mediation when ready", follow_up_date: "2026-07-02", completed_by: "Dr. Hall", completed_by_id: "u2", completed_at: "2026-07-01T22:00:00Z", reviewed_by: "Dr. Hall", reviewed_at: "2026-07-02T09:00:00Z" }, created_at: "2026-07-01T18:15:00Z" };
  if (procedure === "m17.crisisSummary") return { activeCrises: 1, resolvedToday: 0, underReview: 1, totalThisMonth: 2, byType: [{ crisis_type: "behavioral_escalation", c: 1 }, { crisis_type: "suicide_self_harm", c: 1 }] };
  if (procedure === "m17.getDebrief") return { id: "db1", crisis_event_id: "cr1", youth_id: "y4", youth_name: "Jada Thompson", field1_event_summary: "During lunch, Jada became verbally aggressive toward a peer who accidentally bumped her tray. She yelled, threw her food, and threatened to 'make them pay.' Staff immediately intervened with verbal de-escalation. Jada was escorted to a quiet space. PRN was offered and accepted.", field2_triggers_identified: "Physical contact (accidental bump), crowded dining environment, sensory overload from noise.", field3_early_warning_signs: "Jada had been isolating since morning (missed breakfast, declined group activity). She was seen pacing in hallway before lunch.", field4_interventions_used: "Verbal de-escalation, physical space removal, PRN medication, 1:1 supervision, quiet room.", field5_what_worked: "Quick staff response prevented physical altercation. Jada responded well to quiet space. PRN helped her calm within 30 minutes.", field6_what_did_not_work: "Jada did not respond to initial verbal redirection. Required physical escort which she initially resisted.", field7_youth_perspective: "Jada stated: 'I just got mad. Everyone is always in my way. I don't want to be here.' She acknowledged she 'overreacted' but felt 'nobody understands.'", field8_staff_perspective: "Mike RCS: Jada's isolation pattern preceded the incident. Recommend earlier intervention when youth shows isolation behaviors. Sarah RCS: Dining room may be too stimulating for Jada during high-stress periods.", field9_plan_adjustments: "1. Modified meal schedule: Jada eats in smaller group or 15 min earlier. 2. Daily check-in with MHTCM before lunch. 3. Sensory coping kit accessible. 4. Review safety plan with Jada.", safety_plan_updated: 1, safety_plan_changes: "Added dining-specific triggers. Modified response: early intervention when isolation observed. Added sensory coping strategies.", follow_up_required: 1, follow_up_actions: "1:1 therapy session 7/2, Guardian notification call, Peer mediation when ready", follow_up_date: "2026-07-02", completed_by: "Dr. Hall", completed_by_id: "u2", completed_at: "2026-07-01T22:00:00Z", reviewed_by: "Dr. Hall", reviewed_at: "2026-07-02T09:00:00Z" };

  // ─── M18/M19 ENDPOINTS (M16 Residential/Med — Sprint 2) ──
  if (procedure === "m18.getBedCensus") return store.beds;
  if (procedure === "m18.residentialSummary") return getResidentialSummary();
  if (procedure === "m18.listShifts") return store.shifts;
  if (procedure === "m18.listBehavioralObs") return store.behavioralObs;
  if (procedure === "m18.listFamilyContacts") return store.familyContacts;
  if (procedure === "m19.medSummary") return getMedSummary();
  if (procedure === "m19.listMedications") return store.medications;

  // ─── M20 ENDPOINTS (M17 Authorization — Sprint 2) ────────
  if (procedure === "m19.listFacilities") return [
    { id: "f1", name: "Adolbi Care GRO Campus", type: "residential", address: "1423 Cypress Lane, Houston, TX 77001", bedsTotal: 48, bedsOccupied: 16, managerName: "Sarah Johnson", phone: "(713) 555-2000", status: "active" },
    { id: "f2", name: "Adolbi Care BHC", type: "outpatient", address: "2500 Main Street, Houston, TX 77002", bedsTotal: 0, bedsOccupied: 0, managerName: "Dr. Hall", phone: "(713) 555-2100", status: "active" },
  ];
  if (procedure === "m19.getCampusSummary") return { totalFacilities: 2, totalBeds: 48, occupiedBeds: 16, availableBeds: 32, occupancyRate: 33, youthCount: 16, staffCount: 18, todaysMedications: 34, pendingObservations: 3 };
  if (procedure === "m20.listAuthorizations") return [
    { id: "a1", youth_id: "y1", youth_name: "Marcus Johnson", mrn: "BHC-2026-001", payer_name: "Texas Medicaid", policy_number: "TXM-88765432", stage: "tracking", status: "approved", authorization_number: "AUTH-TXM-2026-00415", approved_units: 180, approved_from_date: "2026-04-01", approved_to_date: "2026-09-28", approved_level_of_care: "Residential", readiness_clinical_docs: 1, readiness_assessment_current: 1, readiness_loc_supported: 1, readiness_treatment_plan: 1, readiness_progress_notes: 1, readiness_medical_necessity: 1, readiness_utilization_review: 1, readiness_guardian_consent: 1, readiness_ub04_clean: 1, readiness_excluded_services: 1, readiness_met_at: "2026-03-28T10:00:00Z", submission_date: "2026-03-28", submitted_by: "Lilian Ike", submission_method: "portal", submission_reference: "REF-2026-0328-001", denial_reason: null, appeal_date: null, appeal_status: null, reauth_due_date: "2026-09-14", reauth_status: "upcoming", days_until_expiration: 74, retrospective_review_date: null, billing_excluded_services: "[]", exclusion_controls_applied: "[]", created_at: "2026-03-15T09:00:00Z" },
    { id: "a2", youth_id: "y2", youth_name: "Aaliyah Williams", mrn: "BHC-2026-002", payer_name: "BCBS TX", policy_number: "BCBS-4455123", stage: "tracking", status: "approved", authorization_number: "AUTH-BCBS-2026-00288", approved_units: 120, approved_from_date: "2026-04-15", approved_to_date: "2026-08-13", approved_level_of_care: "Residential", readiness_clinical_docs: 1, readiness_assessment_current: 1, readiness_loc_supported: 1, readiness_treatment_plan: 1, readiness_progress_notes: 1, readiness_medical_necessity: 1, readiness_utilization_review: 1, readiness_guardian_consent: 1, readiness_ub04_clean: 1, readiness_excluded_services: 1, readiness_met_at: "2026-04-12T14:00:00Z", submission_date: "2026-04-12", submitted_by: "Lilian Ike", submission_method: "fax", submission_reference: "REF-2026-0412-002", denial_reason: null, appeal_date: null, appeal_status: null, reauth_due_date: "2026-07-30", reauth_status: "upcoming", days_until_expiration: 28, retrospective_review_date: null, billing_excluded_services: "[]", exclusion_controls_applied: "[]", created_at: "2026-04-01T10:00:00Z" },
    { id: "a3", youth_id: "y3", youth_name: "Carlos Martinez", mrn: "BHC-2026-003", payer_name: "Texas Medicaid", policy_number: "TXM-99123456", stage: "readiness", status: "pending", readiness_clinical_docs: 1, readiness_assessment_current: 1, readiness_loc_supported: 0, readiness_treatment_plan: 0, readiness_progress_notes: 1, readiness_medical_necessity: 0, readiness_utilization_review: 0, readiness_guardian_consent: 1, readiness_ub04_clean: 0, readiness_excluded_services: 0, readiness_met_at: null, submission_date: null, submitted_by: null, submission_method: null, submission_reference: null, denial_reason: null, appeal_date: null, appeal_status: null, reauth_due_date: null, reauth_status: "not_due", days_until_expiration: null, retrospective_review_date: null, billing_excluded_services: "[]", exclusion_controls_applied: "[]", created_at: "2026-06-29T09:00:00Z" },
    { id: "a4", youth_id: "y4", youth_name: "Jada Thompson", mrn: "BHC-2026-004", payer_name: "Aetna Better Health", policy_number: "ABH-2233445", stage: "tracking", status: "appealed", authorization_number: "AUTH-ABH-2026-00112", approved_units: 90, approved_from_date: "2026-05-20", approved_to_date: "2026-08-18", approved_level_of_care: "Residential", readiness_clinical_docs: 1, readiness_assessment_current: 1, readiness_loc_supported: 1, readiness_treatment_plan: 1, readiness_progress_notes: 1, readiness_medical_necessity: 1, readiness_utilization_review: 1, readiness_guardian_consent: 1, readiness_ub04_clean: 1, readiness_excluded_services: 1, readiness_met_at: "2026-05-15T11:00:00Z", submission_date: "2026-05-15", submitted_by: "Lilian Ike", submission_method: "portal", submission_reference: "REF-2026-0515-003", denial_reason: "Initial denial: insufficient medical necessity documentation for residential level. Peer reviewer recommended day treatment.", appeal_date: "2026-05-22", appeal_status: "under_review", reauth_due_date: null, reauth_status: "not_due", days_until_expiration: 47, retrospective_review_date: null, billing_excluded_services: "[]", exclusion_controls_applied: "[]", created_at: "2026-05-10T08:00:00Z" },
  ];
  if (procedure === "m20.authSummary") return { total: 4, pending: 1, approved: 2, denied: 0, appealed: 1, reauthOverdue: 0, upcomingExpiry: 2 };
  if (procedure === "m20.getFacilityMedications") return store.medications;

  // ─── M21 ENDPOINTS (Persona Activation + Chart Audit) ────
  if (procedure === "m21.listAudits") return [
    { id: "ca1", youth_id: "y1", youth_name: "Marcus Johnson", mrn: "BHC-2026-001", audit_date: "2026-06-15", auditor_name: "Dr. Hall", area1_identifying_info: 1, area1_notes: "Complete", area2_consent_forms: 1, area2_notes: "All signed", area3_assessment_current: 1, area3_notes: "CANS within 30 days", area4_treatment_plan: 1, area4_notes: "Current, signed 6/1", area5_progress_notes: 1, area5_notes: "Weekly notes current", area6_medication_records: 1, area6_notes: "MAR complete, no discrepancies", area7_safety_plans: 1, area7_notes: "Updated post-incident 5/11", area8_incident_reports: 1, area8_notes: "IR #2026-0510-001 complete with debrief", area9_authorization_billing: 1, area9_notes: "Auth TXM-00415 active thru 9/28", areas_passed: 9, areas_total: 9, overall_result: "pass", corrective_actions: null, follow_up_date: null, created_at: "2026-06-15T10:00:00Z" },
    { id: "ca2", youth_id: "y4", youth_name: "Jada Thompson", mrn: "BHC-2026-004", audit_date: "2026-07-01", auditor_name: "Lilian Ike", area1_identifying_info: 1, area1_notes: "Complete", area2_consent_forms: 1, area2_notes: "Guardian consent on file", area3_assessment_current: 1, area3_notes: "Intake assessment 6/29", area4_treatment_plan: 0, area4_notes: "Draft only — awaiting clinician sign-off", area5_progress_notes: 1, area5_notes: "Daily behavioral tracking current", area6_medication_records: 1, area6_notes: "MAR current, PRN documented", area7_safety_plans: 0, area7_notes: "Safety plan outdated — pre-dates 7/1 incident", area8_incident_reports: 1, area8_notes: "IR #2026-0701-004 filed, debrief complete", area9_authorization_billing: 0, area9_notes: "Appeal pending — no auth number yet", areas_passed: 6, areas_total: 9, overall_result: "pass_with_notes", corrective_actions: "1. Complete treatment plan by 7/5\n2. Update safety plan per debrief findings\n3. Follow up on appeal status", follow_up_date: "2026-07-08", created_at: "2026-07-01T16:00:00Z" },
  ];
  if (procedure === "m21.listPersonas") return [
    { id: "amos-prime", name: "AMOS-Prime", code: "AP", description: "Executive orchestration persona. Top-level task routing, cross-system coordination, and strategic synthesis.", status: "inactive", wave: "wave3", category: "Executive", permissions: ["all_read", "routing_write"], outputs: ["memos", "decisions", "alerts"], activatedAt: null, sortOrder: 1 },
    { id: "amos-core", name: "AMOS-Core", code: "AC", description: "Universal operational backbone. Dashboard aggregation, notification routing, cross-module search.", status: "active", wave: "pilot", category: "Core", permissions: ["all_read", "ops_write"], outputs: ["dashboards", "alerts", "search_results"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 2 },
    { id: "amos-nxl", name: "AMOS-NXL", code: "ANXL", description: "Narrative intelligence engine. Generates operational narratives, trend explanations, and executive briefings.", status: "inactive", wave: "wave3", category: "Intelligence", permissions: ["analytics_read", "narrative_write"], outputs: ["briefings", "narratives"], activatedAt: null, sortOrder: 3 },
    { id: "amos-thesis", name: "AMOS-THESIS", code: "AT", description: "Research and evidence synthesis. Academic literature review, regulatory research.", status: "inactive", wave: "wave3", category: "Research", permissions: ["research_read", "synthesis_write"], outputs: ["reports", "literature_reviews"], activatedAt: null, sortOrder: 4 },
    { id: "amos-dms", name: "AMOS-DMS", code: "ADMS", description: "Document management specialist. Document lifecycle, template generation, packet assembly.", status: "inactive", wave: "wave3", category: "Documents", permissions: ["documents_read", "dms_write"], outputs: ["documents", "packets", "templates"], activatedAt: null, sortOrder: 5 },
    { id: "amos-sentinel", name: "AMOS-Sentinel", code: "ASENT", description: "QA and compliance guardian. Audit readiness, CAP tracking, deficiency monitoring.", status: "active", wave: "pilot", category: "Compliance", permissions: ["qa_read", "audit_write"], outputs: ["audits", "cap_plans"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 6 },
    { id: "amos-scribe", name: "AMOS-Scribe", code: "ASCR", description: "Document production engine. Branded DOCX/PDF/Excel generation, template library.", status: "active", wave: "pilot", category: "Documents", permissions: ["documents_read", "studio_write"], outputs: ["documents", "presentations"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 7 },
    { id: "amos-clinical", name: "AMOS-Clinical", code: "ACL", description: "Clinical operations specialist. BHC care delivery, CANS/ANSA assessment support.", status: "active", wave: "pilot", category: "Clinical", permissions: ["clinical_read", "clinical_write"], outputs: ["assessments", "treatment_plans"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 8 },
    { id: "amos-gro", name: "AMOS-GRO", code: "AGRO", description: "Residential operations specialist. GRO shift management, youth care logs, behavioral observations.", status: "active", wave: "pilot", category: "Residential", permissions: ["gro_read", "gro_write"], outputs: ["shift_logs", "observations"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 9 },
    { id: "amos-revenue", name: "AMOS-Revenue", code: "AREV", description: "Revenue cycle specialist. Authorizations, claims management, billing readiness.", status: "active", wave: "pilot", category: "Revenue", permissions: ["revenue_read", "billing_write"], outputs: ["claims", "authorizations"], activatedAt: "2026-01-01T00:00:00Z", sortOrder: 10 },
    { id: "amos-hr", name: "AMOS-HR", code: "AHR", description: "Human resources specialist. Onboarding workflow, credential tracking, training assignments.", status: "inactive", wave: "wave1", category: "HR", permissions: ["hr_read", "hr_write"], outputs: ["onboarding_plans", "credentials_reports"], activatedAt: null, sortOrder: 11 },
    { id: "amos-coach", name: "AMOS-Coach", code: "ACOACH", description: "Training and coaching facilitator. Staff development, competency tracking.", status: "inactive", wave: "wave2", category: "Training", permissions: ["training_read", "coaching_write"], outputs: ["training_plans", "competency_assessments"], activatedAt: null, sortOrder: 12 },
    { id: "amos-strategy", name: "AMOS-Strategy", code: "ASTRAT", description: "Strategic planning analyst. Growth initiatives, market analysis, board reporting.", status: "inactive", wave: "wave2", category: "Strategy", permissions: ["executive_read", "strategy_write"], outputs: ["strategic_plans", "risk_registers"], activatedAt: null, sortOrder: 13 },
  ];
  if (procedure === "m21.getActivationStatus") return { total: 13, active: 6, inactive: 7, byWave: { pilot: { active: 6, inactive: 0 }, wave1: { active: 0, inactive: 1 }, wave2: { active: 0, inactive: 2 }, wave3: { active: 0, inactive: 4 } } };
  // ─── M29: NIL Knowledge Graph ────────────────────────────
  if (procedure === "m29.search") return [
    { id: "y4", type: "youth", title: "Jada Thompson", subtitle: "BHC-2026-004 • Age 17 • Crisis Stabilization", module: "Clinical", status: "hold", lastUpdated: "2026-07-01", tags: ["behavioral", "peer-conflict", "safety-plan"], score: 28 },
    { id: "ir-0701", type: "incident", title: "Peer Conflict — Jada Thompson", subtitle: "2026-07-01 14:30 • Moderate severity • Resolved", module: "Compliance", status: "resolved", lastUpdated: "2026-07-01", tags: ["behavioral", "peer-conflict", "Jada-Thompson"], score: 22 },
    { id: "ca-0701", type: "chart_audit", title: "Chart Audit — Jada Thompson", subtitle: "Auditor: Lilian Ike • 6/9 areas passed • Pass with notes", module: "Compliance", status: "pass_with_notes", lastUpdated: "2026-07-01", tags: ["audit", "Jada-Thompson", "deficiency"], score: 18 },
  ];
  if (procedure === "m29.getRelationships") return [
    { relationship: { from: "y4", to: "ir-0701", type: "involved_in", label: "involved in" }, entity: { id: "ir-0701", type: "incident", title: "Peer Conflict — Jada Thompson", subtitle: "2026-07-01 14:30 • Moderate", module: "Compliance", status: "resolved", lastUpdated: "2026-07-01", tags: ["behavioral"], relevance: 0.85 }, direction: "outgoing" as const },
    { relationship: { from: "y4", to: "ca-0701", type: "audited", label: "subject of" }, entity: { id: "ca-0701", type: "chart_audit", title: "Chart Audit — Jada Thompson", subtitle: "6/9 passed • Pass with notes", module: "Compliance", status: "pass_with_notes", lastUpdated: "2026-07-01", tags: ["audit"], relevance: 0.82 }, direction: "outgoing" as const },
  ];
  if (procedure === "m29.getEntity") return { id: "y4", type: "youth", title: "Jada Thompson", subtitle: "BHC-2026-004 • Age 17 • Crisis Stabilization", module: "Clinical", status: "hold", lastUpdated: "2026-07-01", tags: ["behavioral", "peer-conflict", "safety-plan"], relevance: 1 };
  if (procedure === "m29.getRelated") return [
    { id: "ir-0701", type: "incident", title: "Peer Conflict — Jada Thompson", subtitle: "2026-07-01 14:30 • Moderate", module: "Compliance", status: "resolved", lastUpdated: "2026-07-01", tags: ["behavioral"], relevance: 0.7 },
    { id: "ca-0701", type: "chart_audit", title: "Chart Audit — Jada Thompson", subtitle: "6/9 passed", module: "Compliance", status: "pass_with_notes", lastUpdated: "2026-07-01", tags: ["audit"], relevance: 0.7 },
  ];
  if (procedure === "m29.typeahead") return [
    { id: "y1", title: "Marcus Johnson", type: "youth", module: "Clinical" },
    { id: "y2", title: "Aaliyah Williams", type: "youth", module: "Clinical" },
    { id: "y3", title: "Carlos Martinez", type: "youth", module: "Clinical" },
    { id: "y4", title: "Jada Thompson", type: "youth", module: "Clinical" },
  ];
  if (procedure === "m29.stats") return { totalEntities: 20, totalRelationships: 16, byType: { youth: 4, incident: 3, chart_audit: 1, treatment_plan: 2, medication_order: 2, work_order: 2, authorization: 1, document: 1, sop: 2, cap: 2 }, byModule: { Clinical: 7, Compliance: 5, Residential: 4, GAD: 2, Revenue: 3 } };
  if (procedure === "ping") return { ok: true, ts: Date.now() };

  // ═══════════════════════════════════════════════════════════════
  // AUDIT FIX: Seed data for previously empty endpoints
  // ═══════════════════════════════════════════════════════════════

  // ─── QA & Compliance ───
  if (procedure === "qa.listAudits") return store.audits;
  if (procedure === "qa.listIncidents") return store.incidents;
  if (procedure === "qa.listCorrectiveActions") return store.tasks.filter(t => t.category === "documentation").map(t => ({ id: t.id, title: t.title, assignedTo: t.assignee, dueDate: "2026-07-15", status: t.status, priority: t.priority }));

  // ─── GAD / Facilities ───
  if (procedure === "gad.listWorkOrders") return store.workOrders;

  // ─── Clinical / BHC ───
  if (procedure === "bhc.listPlans") return store.youth.filter(y => y.status === "active").map(y => ({ id: `tp-${y.id}`, youthName: y.first_name + " " + y.last_name, mrn: y.mrn, clinician: y.assigned_clinician_name, createdDate: y.admission_date, reviewDate: "2026-07-15", status: "active", goals: Math.floor(Math.random() * 5) + 2, objectives: Math.floor(Math.random() * 10) + 5 }));
  if (procedure === "bhc.listSessions") return store.sessions;
  if (procedure === "bhc.clinicianWorkload") return { total: store.sessions.length, byClinician: [
    { name: "Dr. Hall", assignedYouth: store.youth.filter(y => y.assigned_clinician_name === "Dr. Hall").length, sessionsThisWeek: store.sessions.filter(s => s.clinician === "Dr. Hall").length, pendingNotes: 3 },
    { name: "Lilian Ike", assignedYouth: store.youth.filter(y => y.assigned_clinician_name === "Lilian Ike").length, sessionsThisWeek: store.sessions.filter(s => s.clinician === "Lilian Ike").length, pendingNotes: 2 },
  ]};

  // ─── GRO / Referrals ───
  if (procedure === "gro.listReferrals") return store.referrals;

  // ─── HR ───
  if (procedure === "hr.getModuleStatuses") return [
    { moduleId: "onboarding", moduleName: "New Hire Onboarding", total: 3, completed: 2, inProgress: 1, notStarted: 0 },
    { moduleId: "training", moduleName: "Annual Training", total: 12, completed: 8, inProgress: 2, notStarted: 2 },
    { moduleId: "credentials", moduleName: "Credential Verification", total: 6, completed: 5, inProgress: 1, notStarted: 0 },
    { moduleId: "compliance", moduleName: "Compliance Acknowledgments", total: 4, completed: 3, inProgress: 1, notStarted: 0 },
  ];
  if (procedure === "hr.listTransitions") return [
    { id: "t1", employeeName: "James Wright", fromRole: "RCS", toRole: "RCS Lead", transitionDate: "2026-07-01", status: "completed", approvedBy: "E. Russ Aideyan" },
    { id: "t2", employeeName: "Amy Wilson", fromRole: "Per Diem", toRole: "Full-Time RCS", transitionDate: "2026-07-05", status: "in_progress", approvedBy: "HR Director" },
    { id: "t3", employeeName: "Kevin Brooks", fromRole: "Nurse Aide", toRole: "RN", transitionDate: "2026-07-15", status: "scheduled", approvedBy: "HR Director" },
    { id: "t4", employeeName: "Tanya Reyes", fromRole: "RCS", toRole: "Night Lead", transitionDate: "2026-07-10", status: "pending_approval", approvedBy: "Pending" },
  ];

  // ─── Workflow ───
  if (procedure === "workflow.listInstances") return store.workflows;
  if (procedure === "workflow.listPendingApprovals") return store.approvals;
  if (procedure === "workflow.auditLog") return [
    { id: "al1", action: "Workflow Started", target: "New Hire Onboarding", actor: "HR Director", timestamp: "2026-06-28T09:00:00Z" },
    { id: "al2", action: "Step Completed", target: "Background Check", actor: "System", timestamp: "2026-06-29T14:00:00Z" },
    { id: "al3", action: "Approval Requested", target: "Night Lead Transition", actor: "Tanya Reyes", timestamp: "2026-07-01T10:00:00Z" },
    { id: "al4", action: "CAP Created", target: "MAR Documentation", actor: "RN Martinez", timestamp: "2026-06-15T11:00:00Z" },
  ];

  // ─── NIL / Knowledge Graph ───
  if (procedure === "nil.searchEntities") return store.youth.slice(0, 5).map(y => ({ id: y.id, label: y.first_name + " " + y.last_name, type: "youth", sourceModule: "Clinical", confidence: 1.0 })).concat(store.medications.slice(0, 3).map(m => ({ id: m.id, label: m.medication_name + " " + m.dosage, type: "medication", sourceModule: "MAR", confidence: 0.95 })));
  if (procedure === "nil.getRecommendations") return [
    { id: "rec1", title: "Update Safety Plan for Jada Thompson", type: "action", priority: "high", source: "Behavioral Pattern Analysis" },
    { id: "rec2", title: "Schedule Family Therapy — Marcus Johnson", type: "appointment", priority: "medium", source: "Treatment Plan Review" },
    { id: "rec3", title: "Review PRN Usage — Jada Thompson", type: "review", priority: "medium", source: "Medication Trend Alert" },
    { id: "rec4", title: "Staff De-escalation Training", type: "training", priority: "low", source: "Incident Pattern Analysis" },
  ];

  // ─── Catch-all for any remaining list/search endpoints ───
  if (procedure.includes("list") || procedure.includes("search")) return [];
  return null;
}

function buildDemoResponse(path: string): Response {
  const data = getDemoData(path);
  if (Array.isArray(data)) {
    const body = data.map((d) => ({ result: { data: { json: d } } }));
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  }
  const body = [{ result: { data: { json: data } } }];
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30000,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: API_URL,
      transformer: superjson,
      headers() {
        const token = localStorage.getItem("amos_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      async fetch(url, init) {
        try {
          const response = await globalThis.fetch(url, { ...(init ?? {}), credentials: "include" });
          const contentType = response.headers.get("content-type");
          if (!contentType || contentType.includes("text/html")) {
            return buildDemoResponse(url.toString());
          }
          return response;
        } catch (err) {
          return buildDemoResponse(url.toString());
        }
      },
    }),
  ],
});

export function TRPCProvider({ children }: { children: ReactNode }) {
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </trpc.Provider>
  );
}
