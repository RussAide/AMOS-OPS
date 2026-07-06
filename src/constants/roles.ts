/**
 * AMOS-OPS Canonical Role Definitions v4.2
 * Source: AMOS-OPS Enterprise Architecture Thesis v4.2
 * Total: 33 roles across 4 Operating Divisions
 * Division Model: Profit Center (GRO, BHC) | Corporate Office (EO, GAD)
 * Last Updated: 2026-07-05
 */

// ═══════════════════════════════════════════════════════════════
// ═── UserRole Union ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export type UserRole =
  // ── Executive Office (EO) ──────────────────────────────
  | "super-admin"
  | "managing-director"
  | "administrator"
  // ── General Administration Division (GAD) ──────────────
  | "hr-director"
  | "hr-compliance-officer"
  | "revenue-cycle-manager"
  | "billing-specialist"
  | "training-coordinator"
  | "facilities-manager"
  // ── GRO Residential Division ───────────────────────────
  | "gro-administrator"
  | "program-director"
  | "shift-supervisor"
  | "rcs-lead"
  | "rcs-day"
  | "rcs-night"
  | "rcs-prn"
  | "youth-care-worker"
  | "behavioral-support"
  | "crisis-intervention-specialist"
  | "recreation-coordinator"
  | "medication-aide"
  | "family-liaison"
  // ── BHC Division ───────────────────────────────────────
  | "bhc-director"
  | "treatment-director"
  | "clinical-director"
  | "ccmg-program-director"
  | "mhtcm-supervisor"
  | "mhrs-supervisor"
  | "clinical-supervisor"
  | "chart-auditor"
  | "qmhp-cs"
  | "case-manager"
  | "therapist"
  | "nurse"
  | "intake-coordinator"
  | "bhc-front-desk";

// ═══════════════════════════════════════════════════════════════
// ═── Division Category ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export type DivisionCategory = "profit-center" | "corporate-office";

export interface DivisionInfo {
  code: string;
  name: string;
  category: DivisionCategory;
  color: string;
  badgeBg: string;
  badgeText: string;
}

export const DIVISIONS: Record<string, DivisionInfo> = {
  gro: {
    code: "GRO",
    name: "General Residential Operations",
    category: "profit-center",
    color: "#245C5A",
    badgeBg: "#245C5A",
    badgeText: "#FFFFFF",
  },
  bhc: {
    code: "BHC",
    name: "Behavioral Health Collaborative",
    category: "profit-center",
    color: "#C45C4A",
    badgeBg: "#C45C4A",
    badgeText: "#FFFFFF",
  },
  eo: {
    code: "EO",
    name: "Executive Office",
    category: "corporate-office",
    color: "#991B1B",
    badgeBg: "#991B1B",
    badgeText: "#FFFFFF",
  },
  gad: {
    code: "GAD",
    name: "General Administration Division",
    category: "corporate-office",
    color: "#D97706",
    badgeBg: "#D97706",
    badgeText: "#FFFFFF",
  },
};

// ═══════════════════════════════════════════════════════════════
// ═── Role List ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export const ALL_ROLES: UserRole[] = [
  // EO
  "super-admin",
  "managing-director",
  "administrator",
  // GAD
  "hr-director",
  "hr-compliance-officer",
  "revenue-cycle-manager",
  "billing-specialist",
  "training-coordinator",
  "facilities-manager",
  // GRO
  "gro-administrator",
  "program-director",
  "shift-supervisor",
  "rcs-lead",
  "rcs-day",
  "rcs-night",
  "rcs-prn",
  "youth-care-worker",
  "behavioral-support",
  "crisis-intervention-specialist",
  "recreation-coordinator",
  "medication-aide",
  "family-liaison",
  // BHC
  "bhc-director",
  "treatment-director",
  "clinical-director",
  "ccmg-program-director",
  "mhtcm-supervisor",
  "mhrs-supervisor",
  "clinical-supervisor",
  "chart-auditor",
  "qmhp-cs",
  "case-manager",
  "therapist",
  "nurse",
  "intake-coordinator",
  "bhc-front-desk",
];

// ═══════════════════════════════════════════════════════════════
// ═── Role Definition Interface ─────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export interface RoleDef {
  id: UserRole;
  label: string;
  badgeColor: string;
  department: string;
  division: string;
  divisionCategory: DivisionCategory;
  description: string;
  clearances: string[];
}

// ═══════════════════════════════════════════════════════════════
// ═── Role Definitions (33 roles) ───────────────────────────────
// ═══════════════════════════════════════════════════════════════

export const ROLE_DEFINITIONS: RoleDef[] = [
  // ───────────────────────────────────────────────────────────
  // EXECUTIVE OFFICE (EO) — Corporate Office
  // ───────────────────────────────────────────────────────────
  {
    id: "super-admin",
    label: "Super Admin",
    badgeColor: "#DC2626",
    department: "Executive Office",
    division: "eo",
    divisionCategory: "corporate-office",
    description: "Full system access. Enterprise command and control. Accepts milestone deliverables.",
    clearances: ["all"],
  },
  {
    id: "managing-director",
    label: "Managing Director",
    badgeColor: "#7F1D1D",
    department: "Executive Office",
    division: "eo",
    divisionCategory: "corporate-office",
    description: "Enterprise governance, strategic oversight, executive decision authority. (E. Russ Aideyan)",
    clearances: ["all"],
  },
  {
    id: "administrator",
    label: "Administrator / LCCA",
    badgeColor: "#991B1B",
    department: "Executive Office",
    division: "eo",
    divisionCategory: "corporate-office",
    description: "Administrative oversight, licensing compliance, operational governance.",
    clearances: ["hr", "compliance", "clinical", "operations", "admin"],
  },

  // ───────────────────────────────────────────────────────────
  // GENERAL ADMINISTRATION DIVISION (GAD) — Corporate Office
  // ───────────────────────────────────────────────────────────
  {
    id: "hr-director",
    label: "HR Director",
    badgeColor: "#245C5A",
    department: "Human Resources",
    division: "gad",
    divisionCategory: "corporate-office",
    description: "HR lifecycle management, clearance decisions, personnel oversight, credential tracking.",
    clearances: ["hr", "compliance", "admin"],
  },
  {
    id: "hr-compliance-officer",
    label: "HR / Compliance Officer",
    badgeColor: "#0F766E",
    department: "Human Resources",
    division: "gad",
    divisionCategory: "corporate-office",
    description: "HR operations, compliance monitoring, audit support, policy enforcement.",
    clearances: ["hr", "compliance"],
  },
  {
    id: "revenue-cycle-manager",
    label: "Revenue Cycle Manager",
    badgeColor: "#D97706",
    department: "Revenue Operations",
    division: "gad",
    divisionCategory: "corporate-office",
    description: "Revenue cycle oversight, claims strategy, payer relations, AR management, MGMA KPI ownership.",
    clearances: ["revenue", "clinical", "compliance"],
  },
  {
    id: "billing-specialist",
    label: "Billing Specialist",
    badgeColor: "#9CA3AF",
    department: "Revenue Operations",
    division: "gad",
    divisionCategory: "corporate-office",
    description: "Claims management, authorization tracking, payment posting, denial management.",
    clearances: ["revenue", "clinical"],
  },
  {
    id: "training-coordinator",
    label: "Training Coordinator",
    badgeColor: "#B45309",
    department: "Workforce Development",
    division: "gad",
    divisionCategory: "corporate-office",
    description: "Staff training program management, compliance training delivery, competency tracking, LMS administration.",
    clearances: ["hr", "compliance"],
  },
  {
    id: "facilities-manager",
    label: "Facilities Manager",
    badgeColor: "#92400E",
    department: "Facilities",
    division: "gad",
    divisionCategory: "corporate-office",
    description: "Facility operations, maintenance oversight, safety inspections, environmental compliance.",
    clearances: ["operations", "compliance"],
  },

  // ───────────────────────────────────────────────────────────
  // GRO RESIDENTIAL DIVISION — Profit Center
  // ───────────────────────────────────────────────────────────
  {
    id: "gro-administrator",
    label: "GRO Administrator",
    badgeColor: "#7C3AED",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "GRO facility oversight, youth care coordination, residential operations management.",
    clearances: ["gro", "clinical", "operations"],
  },
  {
    id: "program-director",
    label: "Program Director",
    badgeColor: "#1F2937",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Program-level oversight, strategic planning, outcomes management.",
    clearances: ["clinical", "hr", "compliance", "operations"],
  },
  {
    id: "shift-supervisor",
    label: "Shift Supervisor",
    badgeColor: "#065F46",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Shift-level supervision, staffing coverage, incident command, handoff coordination.",
    clearances: ["gro", "clinical"],
  },
  {
    id: "rcs-lead",
    label: "RCS - Lead",
    badgeColor: "#047857",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Lead Residential Care Specialist. Shift supervision, incident response, staff coordination.",
    clearances: ["gro", "clinical"],
  },
  {
    id: "rcs-day",
    label: "RCS - Day Shift",
    badgeColor: "#059669",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Residential Care Specialist - Day shift. Youth supervision, daily care documentation.",
    clearances: ["gro"],
  },
  {
    id: "rcs-night",
    label: "RCS - Night Shift",
    badgeColor: "#10B981",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Residential Care Specialist - Night shift. Overnight supervision, safety monitoring.",
    clearances: ["gro"],
  },
  {
    id: "rcs-prn",
    label: "RCS - PRN",
    badgeColor: "#6EE7B7",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Residential Care Specialist - PRN / On-call. Flexible coverage as needed.",
    clearances: ["gro"],
  },
  {
    id: "youth-care-worker",
    label: "Youth Care Worker",
    badgeColor: "#34D399",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Direct youth care, behavioral support, daily living assistance, documentation.",
    clearances: ["gro"],
  },
  {
    id: "behavioral-support",
    label: "Behavioral Support",
    badgeColor: "#D97706",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Behavioral intervention support, crisis de-escalation, treatment plan implementation.",
    clearances: ["gro", "clinical"],
  },
  {
    id: "crisis-intervention-specialist",
    label: "Crisis Intervention Specialist",
    badgeColor: "#B45309",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Crisis response, de-escalation, safety planning, behavioral emergency intervention.",
    clearances: ["gro", "clinical"],
  },
  {
    id: "recreation-coordinator",
    label: "Recreation Coordinator",
    badgeColor: "#F59E0B",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Youth recreation programming, activity planning, developmental enrichment.",
    clearances: ["gro"],
  },
  {
    id: "medication-aide",
    label: "Medication Aide",
    badgeColor: "#8B5CF6",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Medication administration, MAR documentation, medication inventory management.",
    clearances: ["clinical", "gro"],
  },
  {
    id: "family-liaison",
    label: "Family Liaison",
    badgeColor: "#EC4899",
    department: "GRO Residential",
    division: "gro",
    divisionCategory: "profit-center",
    description: "Family communication, visitation coordination, family engagement, discharge planning support.",
    clearances: ["gro", "clinical"],
  },

  // ───────────────────────────────────────────────────────────
  // BHC DIVISION — Profit Center
  // ───────────────────────────────────────────────────────────
  {
    id: "bhc-director",
    label: "BHC Director",
    badgeColor: "#C45C4A",
    department: "Behavioral Health Collaborative",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "BHC division oversight. Manages CCMG, MHTCM, and MHRS departments. Cross-divisional coordination with GRO.",
    clearances: ["clinical", "compliance", "operations", "hr"],
  },
  {
    id: "treatment-director",
    label: "Treatment Director / LPHA",
    badgeColor: "#1E40AF",
    department: "BHC / Clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Clinical governance, treatment planning, LPHA oversight. (Dr. Hall)",
    clearances: ["clinical", "compliance", "hr"],
  },
  {
    id: "clinical-director",
    label: "Clinical Director / PMHNP",
    badgeColor: "#2563EB",
    department: "BHC / Clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "PMHNP-FNP clinical leadership, CCMG oversight, medication management. (Lilian Ike)",
    clearances: ["clinical", "compliance"],
  },
  {
    id: "ccmg-program-director",
    label: "CCMG Program Director",
    badgeColor: "#C2410C",
    department: "CCMG",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Collaborative Care Management Group oversight. Care coordination, cross-departmental integration, quality outcomes.",
    clearances: ["clinical", "compliance", "operations"],
  },
  {
    id: "mhtcm-supervisor",
    label: "MHTCM Supervisor",
    badgeColor: "#9A3412",
    department: "MHTCM",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Mental Health Targeted Case Management supervision. Caseload review, encounter validation, HHSC compliance.",
    clearances: ["clinical", "compliance"],
  },
  {
    id: "mhrs-supervisor",
    label: "MHRS Supervisor",
    badgeColor: "#7C2D12",
    department: "MHRS",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Mental Health Rehabilitative Services supervision. Skills training oversight, H2017 billing compliance.",
    clearances: ["clinical", "compliance"],
  },
  {
    id: "clinical-supervisor",
    label: "Clinical Supervisor",
    badgeColor: "#4B5563",
    department: "BHC / Clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Clinical team supervision, competency sign-offs, quality review, incident oversight.",
    clearances: ["clinical", "hr", "compliance"],
  },
  {
    id: "chart-auditor",
    label: "Chart Auditor",
    badgeColor: "#6B7280",
    department: "BHC / Quality Assurance",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Clinical documentation audit, billing-chart correlation, compliance review, HHSC readiness.",
    clearances: ["clinical", "compliance", "revenue"],
  },
  {
    id: "qmhp-cs",
    label: "QMHP-CS",
    badgeColor: "#0891B2",
    department: "BHC / MHTCM",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Qualified Mental Health Professional - Community Services. Case management, clinical documentation.",
    clearances: ["clinical"],
  },
  {
    id: "case-manager",
    label: "Case Manager / QMHP-CS",
    badgeColor: "#0E7490",
    department: "BHC / MHTCM",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Youth case management, service coordination, family engagement. (Jonthan Guidry)",
    clearances: ["clinical", "hr"],
  },
  {
    id: "therapist",
    label: "Therapist",
    badgeColor: "#06B6D4",
    department: "BHC / MHRS",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Individual and group therapy, treatment planning, clinical documentation.",
    clearances: ["clinical"],
  },
  {
    id: "nurse",
    label: "Nurse",
    badgeColor: "#EC4899",
    department: "BHC / Clinical",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Nursing care, health assessments, medication oversight, medical documentation.",
    clearances: ["clinical", "gro"],
  },
  {
    id: "intake-coordinator",
    label: "Intake Coordinator",
    badgeColor: "#8B5CF6",
    department: "BHC / CCMG",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "Referral intake, admissions processing, eligibility verification, initial documentation.",
    clearances: ["clinical", "operations"],
  },
  {
    id: "bhc-front-desk",
    label: "BHC Front Desk",
    badgeColor: "#A78BFA",
    department: "BHC / CCMG",
    division: "bhc",
    divisionCategory: "profit-center",
    description: "BHC reception, appointment scheduling, client check-in, phone intake.",
    clearances: ["clinical"],
  },
];

// ═══════════════════════════════════════════════════════════════
// ═── Permission Matrix (33 roles × 14 permissions) ─────────────
// ═══════════════════════════════════════════════════════════════

export interface Permissions {
  canViewHR: boolean; canEditHR: boolean;
  canViewCompliance: boolean; canEditCompliance: boolean;
  canViewClinical: boolean; canEditClinical: boolean;
  canViewRevenue: boolean; canEditRevenue: boolean;
  canViewGRO: boolean; canEditGRO: boolean;
  canViewOperations: boolean; canEditOperations: boolean;
  canViewAdmin: boolean; canEditAdmin: boolean;
  canViewExecutive: boolean;
  canSupervise: boolean;
  canClearPersonnel: boolean;
  canViewReports: boolean;
  canViewOnboarding: boolean;
  canManageDocuments: boolean;
}

export const PERMISSION_MATRIX: Record<UserRole, Permissions> = {
  // ── Executive Office ───────────────────────────────────
  "super-admin": {
    canViewHR: true, canEditHR: true,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: true, canEditRevenue: true,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: true, canEditAdmin: true,
    canViewExecutive: true,
    canSupervise: true, canClearPersonnel: true,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "managing-director": {
    canViewHR: true, canEditHR: true,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: true, canEditRevenue: true,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: true, canEditAdmin: true,
    canViewExecutive: true,
    canSupervise: true, canClearPersonnel: true,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "administrator": {
    canViewHR: true, canEditHR: true,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: true, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: true, canEditAdmin: false,
    canViewExecutive: true,
    canSupervise: true, canClearPersonnel: true,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  // ── General Administration ─────────────────────────────
  "hr-director": {
    canViewHR: true, canEditHR: true,
    canViewCompliance: true, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: true, canEditOperations: false,
    canViewAdmin: true, canEditAdmin: false,
    canViewExecutive: true,
    canSupervise: true, canClearPersonnel: true,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "hr-compliance-officer": {
    canViewHR: true, canEditHR: true,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "revenue-cycle-manager": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: true, canEditCompliance: false,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: true, canEditRevenue: true,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: true, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: false,
    canManageDocuments: true,
  },
  "billing-specialist": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: true, canEditRevenue: true,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "training-coordinator": {
    canViewHR: true, canEditHR: false,
    canViewCompliance: true, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: true, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "facilities-manager": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: true, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: false,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: false,
    canManageDocuments: true,
  },
  // ── GRO Residential ────────────────────────────────────
  "gro-administrator": {
    canViewHR: true, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "program-director": {
    canViewHR: true, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: true, canEditRevenue: false,
    canViewGRO: true, canEditGRO: false,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: true, canEditAdmin: false,
    canViewExecutive: true,
    canSupervise: true, canClearPersonnel: true,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "shift-supervisor": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "rcs-lead": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "rcs-day": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: false,
  },
  "rcs-night": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: false,
  },
  "rcs-prn": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: false,
  },
  "youth-care-worker": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: false,
  },
  "behavioral-support": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "crisis-intervention-specialist": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "recreation-coordinator": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: false, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: false,
  },
  "medication-aide": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "family-liaison": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  // ── BHC Division ───────────────────────────────────────
  "bhc-director": {
    canViewHR: true, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: true, canEditRevenue: false,
    canViewGRO: true, canEditGRO: false,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: true,
    canSupervise: true, canClearPersonnel: true,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "treatment-director": {
    canViewHR: true, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: true,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "clinical-director": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "ccmg-program-director": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "mhtcm-supervisor": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "mhrs-supervisor": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "clinical-supervisor": {
    canViewHR: true, canEditHR: false,
    canViewCompliance: true, canEditCompliance: true,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: true, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "chart-auditor": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: true, canEditCompliance: false,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: true, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: true, canViewOnboarding: false,
    canManageDocuments: true,
  },
  "qmhp-cs": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "case-manager": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "therapist": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "nurse": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: true, canEditGRO: true,
    canViewOperations: false, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "intake-coordinator": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: true,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: true, canEditOperations: true,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: true,
  },
  "bhc-front-desk": {
    canViewHR: false, canEditHR: false,
    canViewCompliance: false, canEditCompliance: false,
    canViewClinical: true, canEditClinical: false,
    canViewRevenue: false, canEditRevenue: false,
    canViewGRO: false, canEditGRO: false,
    canViewOperations: true, canEditOperations: false,
    canViewAdmin: false, canEditAdmin: false,
    canViewExecutive: false,
    canSupervise: false, canClearPersonnel: false,
    canViewReports: false, canViewOnboarding: true,
    canManageDocuments: false,
  },
};

// ═══════════════════════════════════════════════════════════════
// ═── Nav Visibility (33 roles × 13 sections) ───────────────────
// ═══════════════════════════════════════════════════════════════

export const ROLE_NAV_VISIBILITY: Record<UserRole, Record<string, boolean>> = {
  // ── Executive Office ───────────────────────────────────
  "super-admin":            { dashboard: true, clinical: true, revenue: true, qa: true, hr: true, gro: true, bhc: true, gad: true, executive: true, nil: true, admin: true, documents: true, knowledge: true, audit: true },
  "managing-director":      { dashboard: true, clinical: true, revenue: true, qa: true, hr: true, gro: true, bhc: true, gad: true, executive: true, nil: true, admin: true, documents: true, knowledge: true, audit: true },
  "administrator":          { dashboard: true, clinical: true, revenue: true, qa: true, hr: true, gro: true, bhc: true, gad: true, executive: true, nil: true, admin: true, documents: true, knowledge: true, audit: true },
  // ── General Administration ─────────────────────────────
  "hr-director":            { dashboard: true, clinical: false, revenue: false, qa: true, hr: true, gro: false, bhc: false, gad: true, executive: true, nil: false, admin: true, documents: true, knowledge: true, audit: true },
  "hr-compliance-officer":  { dashboard: true, clinical: false, revenue: false, qa: true, hr: true, gro: false, bhc: false, gad: true, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "revenue-cycle-manager":  { dashboard: true, clinical: true, revenue: true, qa: true, hr: false, gro: false, bhc: true, gad: true, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "billing-specialist":     { dashboard: true, clinical: true, revenue: true, qa: false, hr: false, gro: false, bhc: false, gad: true, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "training-coordinator":   { dashboard: true, clinical: false, revenue: false, qa: true, hr: true, gro: false, bhc: false, gad: true, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "facilities-manager":     { dashboard: true, clinical: false, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: true, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  // ── GRO Residential ────────────────────────────────────
  "gro-administrator":      { dashboard: true, clinical: true, revenue: false, qa: true, hr: true, gro: true, bhc: false, gad: true, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "program-director":       { dashboard: true, clinical: true, revenue: true, qa: true, hr: true, gro: true, bhc: true, gad: true, executive: true, nil: true, admin: true, documents: true, knowledge: true, audit: true },
  "shift-supervisor":       { dashboard: true, clinical: false, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "rcs-lead":               { dashboard: true, clinical: false, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "rcs-day":                { dashboard: true, clinical: false, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: false, knowledge: true, audit: false },
  "rcs-night":              { dashboard: true, clinical: false, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: false, knowledge: true, audit: false },
  "rcs-prn":                { dashboard: true, clinical: false, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: false, knowledge: true, audit: false },
  "youth-care-worker":      { dashboard: true, clinical: false, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: false, knowledge: true, audit: false },
  "behavioral-support":     { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "crisis-intervention-specialist": { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "recreation-coordinator": { dashboard: true, clinical: false, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: false, knowledge: true, audit: false },
  "medication-aide":        { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "family-liaison":         { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: true, bhc: false, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  // ── BHC Division ───────────────────────────────────────
  "bhc-director":           { dashboard: true, clinical: true, revenue: true, qa: true, hr: true, gro: true, bhc: true, gad: true, executive: true, nil: true, admin: true, documents: true, knowledge: true, audit: true },
  "treatment-director":     { dashboard: true, clinical: true, revenue: false, qa: true, hr: true, gro: true, bhc: true, gad: false, executive: true, nil: true, admin: false, documents: true, knowledge: true, audit: true },
  "clinical-director":      { dashboard: true, clinical: true, revenue: false, qa: true, hr: false, gro: true, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "ccmg-program-director":  { dashboard: true, clinical: true, revenue: false, qa: true, hr: false, gro: false, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "mhtcm-supervisor":       { dashboard: true, clinical: true, revenue: false, qa: true, hr: false, gro: false, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "mhrs-supervisor":        { dashboard: true, clinical: true, revenue: false, qa: true, hr: false, gro: false, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "clinical-supervisor":    { dashboard: true, clinical: true, revenue: false, qa: true, hr: true, gro: true, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "chart-auditor":          { dashboard: true, clinical: true, revenue: true, qa: true, hr: false, gro: false, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: true },
  "qmhp-cs":                { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: false, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "case-manager":           { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: true, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "therapist":              { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: false, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "nurse":                  { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: true, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "intake-coordinator":     { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: false, bhc: true, gad: true, executive: false, nil: false, admin: false, documents: true, knowledge: true, audit: false },
  "bhc-front-desk":         { dashboard: true, clinical: true, revenue: false, qa: false, hr: false, gro: false, bhc: true, gad: false, executive: false, nil: false, admin: false, documents: false, knowledge: true, audit: false },
};

// ═══════════════════════════════════════════════════════════════
// ═── Helper Functions ──────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

export function getRoleDef(role: UserRole): RoleDef {
  return ROLE_DEFINITIONS.find((r) => r.id === role) ?? ROLE_DEFINITIONS[0];
}

export function getPermissions(role: UserRole): Permissions {
  return PERMISSION_MATRIX[role] ?? PERMISSION_MATRIX["rcs-day"];
}

export function getNavVisibility(role: UserRole): Record<string, boolean> {
  return ROLE_NAV_VISIBILITY[role] ?? ROLE_NAV_VISIBILITY["rcs-day"];
}

export function isAdmin(role: UserRole): boolean {
  return role === "super-admin" || role === "administrator" || role === "hr-director" || role === "program-director" || role === "managing-director" || role === "bhc-director";
}

export function canManageUsers(role: UserRole): boolean {
  return ["super-admin", "managing-director", "administrator", "hr-director"].includes(role);
}

export function canViewModule(role: UserRole, module: string): boolean {
  return getNavVisibility(role)[module] ?? false;
}

// ─── Division helpers ────────────────────────────────────

export function getDivision(role: UserRole): string {
  return getRoleDef(role).division;
}

export function getDivisionCategory(role: UserRole): DivisionCategory {
  return getRoleDef(role).divisionCategory;
}

export function isProfitCenter(role: UserRole): boolean {
  return getDivisionCategory(role) === "profit-center";
}

export function isCorporateOffice(role: UserRole): boolean {
  return getDivisionCategory(role) === "corporate-office";
}

export function getRolesByDivision(division: string): RoleDef[] {
  return ROLE_DEFINITIONS.filter((r) => r.division === division);
}

export function getRolesByCategory(category: DivisionCategory): RoleDef[] {
  return ROLE_DEFINITIONS.filter((r) => r.divisionCategory === category);
}

export function getRolesByDepartment(department: string): RoleDef[] {
  return ROLE_DEFINITIONS.filter((r) => r.department === department);
}

// ─── Summary statistics ──────────────────────────────────

export const ROLE_STATS = {
  total: ROLE_DEFINITIONS.length,
  profitCenter: ROLE_DEFINITIONS.filter((r) => r.divisionCategory === "profit-center").length,
  corporateOffice: ROLE_DEFINITIONS.filter((r) => r.divisionCategory === "corporate-office").length,
  byDivision: {
    gro: ROLE_DEFINITIONS.filter((r) => r.division === "gro").length,
    bhc: ROLE_DEFINITIONS.filter((r) => r.division === "bhc").length,
    eo: ROLE_DEFINITIONS.filter((r) => r.division === "eo").length,
    gad: ROLE_DEFINITIONS.filter((r) => r.division === "gad").length,
  },
};
