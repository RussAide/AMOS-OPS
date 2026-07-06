import {
  LayoutDashboard,
  ListTodo,
  Activity,
  Home,
  Building2,
  ShieldCheck,
  DollarSign,
  BarChart3,
  Users,
  UserPlus,
  Search,
  FileCheck2,
  Compass,
  GraduationCap,
  Shield,
  FolderOpen,
  Award,
  TrendingUp,
  ClipboardCheck,
  LogOut,
  Settings,
  Network,
  Lock,
  Cog,
  MapPin,
  FileText,
  BookOpen,
  FileText,
  ClipboardList,
  ArrowRightLeft,
  Package2,
  Clock,
  ShieldAlert,
  Heart,
  AlertTriangle,
  StickyNote,
  ClipboardSignature,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION DATA — D-002 7-Section Hierarchy with Role-Based Visibility
   28 items organized into 7 top-level sections per IA Map
   Role system: 33 roles across 4 tiers
   ═══════════════════════════════════════════════════════════════ */

export interface NavItem {
  label: string;
  agent: string;
  href: string;
  icon: LucideIcon;
  section: string;
  roles: string[]; // which roles can see this item ("all" = every role)
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/* ═══════════════════════════════════════════════════════════════
   ROLE CONSTANTS — 33 roles across 4 tiers
   ═══════════════════════════════════════════════════════════════ */

export const ALL_ROLES = [
  // Tier 1: Executive & Strategic (5)
  "executive-director",
  "managing-director",
  "treatment-director-lpha",
  "gro-administrator",
  "hr-director",
  // Tier 2: Administration & Management (5)
  "administrator-lcca",
  "super-admin",
  "program-director",
  "clinical-director",
  "operations-director",
  // Tier 3: Department Leads & Coordination (10)
  "qa-coordinator",
  "compliance-officer",
  "hr-coordinator",
  "hr-recruiter",
  "hr-compliance-officer",
  "clinical-supervisor",
  "charge-nurse",
  "billing-supervisor",
  "house-supervisor",
  "nurse-manager",
  // Tier 4: Operational Staff (13)
  "registered-nurse",
  "lpn",
  "therapist",
  "counselor",
  "case-manager",
  "mental-health-tech",
  "activity-therapist",
  "intake-coordinator",
  "billers",
  "medical-records",
  "front-desk",
  "maintenance",
  "dietary",
  // Audit-specific roles (2)
  "qa-auditor",
  "chart-auditor",
] as const;

export type UserRole = (typeof ALL_ROLES)[number];

/* ─── Section 1: OPERATIONS — Visible to ALL roles ─── */
const OPERATIONS_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    agent: "AMOS-Core",
    href: "/",
    icon: LayoutDashboard,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Workflows",
    agent: "AMOS-Core",
    href: "/workflows",
    icon: ListTodo,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "BHC Clinical",
    agent: "AMOS-Clinical",
    href: "/clinical",
    icon: Activity,
    section: "OPERATIONS",
    roles: ["all"],
  },
  // ─── BHC Clinical Sub-Pages ───
  {
    label: "Treatment Plans",
    agent: "AMOS-Clinical",
    href: "/clinical/treatment-plans",
    icon: BookOpen,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Clinical Sessions",
    agent: "AMOS-Clinical",
    href: "/clinical/sessions",
    icon: FileText,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Outcome Measures",
    agent: "AMOS-Clinical",
    href: "/clinical/outcome-measures",
    icon: BarChart3,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Insurance Plans",
    agent: "AMOS-Clinical",
    href: "/clinical/insurance-plans",
    icon: ShieldCheck,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Referral Intake",
    agent: "AMOS-Clinical",
    href: "/clinical/referrals",
    icon: ArrowRightLeft,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "CANS Assessments",
    agent: "AMOS-Clinical",
    href: "/clinical/cans-assessments",
    icon: ClipboardList,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Service Delivery",
    agent: "AMOS-Clinical",
    href: "/clinical/service-delivery",
    icon: Package2,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "GRO Residential",
    agent: "AMOS-GRO",
    href: "/gro",
    icon: Home,
    section: "OPERATIONS",
    roles: ["all"],
  },
  // ─── GRO Residential Sub-Pages ───
  {
    label: "Shift Logs",
    agent: "AMOS-GRO",
    href: "/gro/shift-logs",
    icon: Clock,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Safety Rounds",
    agent: "AMOS-GRO",
    href: "/gro/safety-rounds",
    icon: ShieldAlert,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Care Logs",
    agent: "AMOS-GRO",
    href: "/gro/care-logs",
    icon: Heart,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Incidents",
    agent: "AMOS-GRO",
    href: "/gro/incidents",
    icon: AlertTriangle,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Supervision",
    agent: "AMOS-GRO",
    href: "/gro/supervision",
    icon: StickyNote,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "Shift Handoffs",
    agent: "AMOS-GRO",
    href: "/gro/handoffs",
    icon: ClipboardSignature,
    section: "OPERATIONS",
    roles: ["all"],
  },
  {
    label: "GAD Ops",
    agent: "AMOS-Domain",
    href: "/gad",
    icon: Building2,
    section: "OPERATIONS",
    roles: ["all"],
  },
];

/* ─── Section 2: COMPLIANCE ───
   Visible to: qa-coordinator, compliance-officer, administrator-lcca,
   super-admin, qa-auditor, chart-auditor */
const COMPLIANCE_ITEMS: NavItem[] = [
  {
    label: "QA & Compliance",
    agent: "AMOS-Sentinel",
    href: "/qa",
    icon: ShieldCheck,
    section: "COMPLIANCE",
    roles: [
      "qa-coordinator",
      "compliance-officer",
      "administrator-lcca",
      "super-admin",
      "qa-auditor",
      "chart-auditor",
    ],
  },
  {
    label: "Revenue Cycle",
    agent: "AMOS-Revenue",
    href: "/revenue",
    icon: DollarSign,
    section: "COMPLIANCE",
    roles: [
      "qa-coordinator",
      "compliance-officer",
      "administrator-lcca",
      "super-admin",
      "qa-auditor",
      "chart-auditor",
    ],
  },
];

/* ─── Section 3: REPORTS ───
   Visible to: administrator-lcca, super-admin, treatment-director-lpha,
   gro-administrator, hr-director, qa-coordinator, compliance-officer,
   managing-director, executive-director */
const REPORTS_ITEMS: NavItem[] = [
  {
    label: "Analytics",
    agent: "AMOS-Core",
    href: "/analytics",
    icon: BarChart3,
    section: "REPORTS",
    roles: [
      "administrator-lcca",
      "super-admin",
      "treatment-director-lpha",
      "gro-administrator",
      "hr-director",
      "qa-coordinator",
      "compliance-officer",
      "managing-director",
      "executive-director",
    ],
  },
];

/* ─── Section 4: HUMAN RESOURCES ───
   Visible to: hr-director, administrator-lcca, super-admin,
   hr-compliance-officer */
const HUMAN_RESOURCES_ITEMS: NavItem[] = [
  {
    label: "HR Command Center",
    agent: "AMOS-HR",
    href: "/hr",
    icon: Users,
    section: "HUMAN RESOURCES",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
    ],
  },
];

/* ─── Section 5: WORKFORCE ACTIVATION ───
   All routes use /hr/:moduleId dynamic route via HRModulePage
   Visible to: hr-director, administrator-lcca, super-admin,
   hr-compliance-officer, hr-coordinator, hr-recruiter */
const WORKFORCE_ACTIVATION_ITEMS: NavItem[] = [
  {
    label: "Recruitment",
    agent: "AMOS-HR",
    href: "/hr/recruitment",
    icon: UserPlus,
    section: "WORKFORCE ACTIVATION",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
      "hr-recruiter",
    ],
  },
  {
    label: "Screening",
    agent: "AMOS-HR",
    href: "/hr/screening",
    icon: Search,
    section: "WORKFORCE ACTIVATION",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
      "hr-recruiter",
    ],
  },
  {
    label: "Offers",
    agent: "AMOS-HR",
    href: "/hr/offers",
    icon: FileCheck2,
    section: "WORKFORCE ACTIVATION",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
      "hr-recruiter",
    ],
  },
  {
    label: "Orientation",
    agent: "AMOS-HR",
    href: "/hr/orientation",
    icon: Compass,
    section: "WORKFORCE ACTIVATION",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
      "hr-recruiter",
    ],
  },
  {
    label: "Onboarding",
    agent: "AMOS-HR",
    href: "/hr/onboarding",
    icon: GraduationCap,
    section: "WORKFORCE ACTIVATION",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
      "hr-recruiter",
    ],
  },
  {
    label: "Clearance",
    agent: "AMOS-HR",
    href: "/hr/clearance",
    icon: Shield,
    section: "WORKFORCE ACTIVATION",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
      "hr-recruiter",
    ],
  },
];

/* ─── Section 6: WORKFORCE MANAGEMENT ───
   All routes use /hr/:moduleId dynamic route via HRModulePage
   Visible to: hr-director, administrator-lcca, super-admin,
   hr-compliance-officer, hr-coordinator */
const WORKFORCE_MANAGEMENT_ITEMS: NavItem[] = [
  {
    label: "Personnel Files",
    agent: "AMOS-HR",
    href: "/hr/personnel-files",
    icon: FolderOpen,
    section: "WORKFORCE MANAGEMENT",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
  {
    label: "Credentials",
    agent: "AMOS-HR",
    href: "/hr/credentials",
    icon: Award,
    section: "WORKFORCE MANAGEMENT",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
  {
    label: "Performance",
    agent: "AMOS-HR",
    href: "/hr/performance",
    icon: TrendingUp,
    section: "WORKFORCE MANAGEMENT",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
  {
    label: "Compliance & Audits",
    agent: "AMOS-HR",
    href: "/hr/compliance",
    icon: ClipboardCheck,
    section: "WORKFORCE MANAGEMENT",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
  {
    label: "Separation",
    agent: "AMOS-HR",
    href: "/hr/separation",
    icon: LogOut,
    section: "WORKFORCE MANAGEMENT",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
];

/* ─── Section 6B: HR TOOLS ───
   Dedicated feature pages for credential tracking, separation management,
   training assignment, performance reviews, and onboarding workflow.
   Visible to: hr-director, administrator-lcca, super-admin,
   hr-compliance-officer, hr-coordinator */
const HR_TOOLS_ITEMS: NavItem[] = [
  {
    label: "Credential Tracker",
    agent: "AMOS-HR",
    href: "/hr/credentials-tracker",
    icon: Award,
    section: "HR TOOLS",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
  {
    label: "Training Assign",
    agent: "AMOS-HR",
    href: "/hr/training-assignments",
    icon: GraduationCap,
    section: "HR TOOLS",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
  {
    label: "Performance Reviews",
    agent: "AMOS-HR",
    href: "/hr/performance-reviews",
    icon: TrendingUp,
    section: "HR TOOLS",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
  {
    label: "Separations",
    agent: "AMOS-HR",
    href: "/hr/separations",
    icon: LogOut,
    section: "HR TOOLS",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
    ],
  },
  {
    label: "Onboarding Flow",
    agent: "AMOS-HR",
    href: "/hr/onboarding-workflow",
    icon: ShieldCheck,
    section: "HR TOOLS",
    roles: [
      "hr-director",
      "administrator-lcca",
      "super-admin",
      "hr-compliance-officer",
      "hr-coordinator",
      "hr-recruiter",
    ],
  },
];

/* ─── Section 7: ADMIN — Visible to: super-admin only ─── */
const ADMIN_ITEMS: NavItem[] = [
  {
    label: "Settings",
    agent: "AMOS-Core",
    href: "/admin/settings",
    icon: Settings,
    section: "ADMIN",
    roles: ["super-admin"],
  },
  {
    label: "Enhancement Register",
    agent: "AMOS-Core",
    href: "/admin/enhancements",
    icon: Lightbulb,
    section: "ADMIN",
    roles: ["super-admin", "managing-director", "administrator"],
  },
  {
    label: "NIL Graph",
    agent: "AMOS-Core",
    href: "/nil",
    icon: Network,
    section: "ADMIN",
    roles: ["super-admin"],
  },
  {
    label: "Entra ID Sync",
    agent: "AMOS-Core",
    href: "/admin/entra-id",
    icon: Lock,
    section: "ADMIN",
    roles: ["super-admin"],
  },
  {
    label: "Workflow Engine",
    agent: "AMOS-Core",
    href: "/admin/workflows",
    icon: Cog,
    section: "ADMIN",
    roles: ["super-admin"],
  },
  {
    label: "Universal Orientation",
    agent: "AMOS-Core",
    href: "/onboarding/track/universal-orientation",
    icon: MapPin,
    section: "ADMIN",
    roles: ["super-admin"],
  },
  {
    label: "Onboarding Academy",
    agent: "AMOS-Core",
    href: "/onboarding",
    icon: GraduationCap,
    section: "ADMIN",
    roles: ["super-admin"],
  },
  {
    label: "Document Studio",
    agent: "AMOS-Scribe",
    href: "/documents",
    icon: FileText,
    section: "ADMIN",
    roles: ["super-admin"],
  },
  {
    label: "Knowledge & SOP",
    agent: "AMOS-Core",
    href: "/knowledge",
    icon: BookOpen,
    section: "ADMIN",
    roles: ["super-admin"],
  },
  {
    label: "Executive Command",
    agent: "AMOS-Domain",
    href: "/executive",
    icon: Shield,
    section: "ADMIN",
    roles: ["super-admin", "executive-director", "managing-director"],
  },
  {
    label: "MGMA Scorecard",
    agent: "AMOS-Domain",
    href: "/executive/mgma",
    icon: Award,
    section: "ADMIN",
    roles: ["super-admin", "executive-director", "managing-director"],
  },
  {
    label: "Strategic Projects",
    agent: "AMOS-Domain",
    href: "/executive/strategic-projects",
    icon: TrendingUp,
    section: "ADMIN",
    roles: ["super-admin", "executive-director", "managing-director"],
  },
  {
    label: "Site Review",
    agent: "AMOS-Domain",
    href: "/executive/marketing-review",
    icon: Globe,
    section: "ADMIN",
    roles: ["super-admin", "executive-director", "managing-director"],
  },
];

/* ═══════════════════════════════════════════════════════════════
   FLAT NAV ITEMS ARRAY — all 28 items for role-based filtering
   ═══════════════════════════════════════════════════════════════ */

export const navItems: NavItem[] = [
  ...OPERATIONS_ITEMS,
  ...COMPLIANCE_ITEMS,
  ...REPORTS_ITEMS,
  ...HUMAN_RESOURCES_ITEMS,
  ...WORKFORCE_ACTIVATION_ITEMS,
  ...WORKFORCE_MANAGEMENT_ITEMS,
  ...HR_TOOLS_ITEMS,
  ...ADMIN_ITEMS,
];

/* ═══════════════════════════════════════════════════════════════
   NAV SECTIONS EXPORT — 7-section D-002 hierarchy
   ═══════════════════════════════════════════════════════════════ */

export const navSections: NavSection[] = [
  { title: "OPERATIONS", items: OPERATIONS_ITEMS },
  { title: "COMPLIANCE", items: COMPLIANCE_ITEMS },
  { title: "REPORTS", items: REPORTS_ITEMS },
  { title: "HUMAN RESOURCES", items: HUMAN_RESOURCES_ITEMS },
  { title: "WORKFORCE ACTIVATION", items: WORKFORCE_ACTIVATION_ITEMS },
  { title: "WORKFORCE MANAGEMENT", items: WORKFORCE_MANAGEMENT_ITEMS },
  { title: "HR TOOLS", items: HR_TOOLS_ITEMS },
  { title: "ADMIN", items: ADMIN_ITEMS },
];

/* ═══════════════════════════════════════════════════════════════
   ROLE-BASED VISIBILITY HELPER
   ═══════════════════════════════════════════════════════════════ */

/**
 * Returns only the nav items visible to the given user role.
 * Items with roles: ["all"] are visible to everyone.
 * Items with explicit role lists require a matching role.
 */
export function getVisibleNavItems(userRole: string): NavItem[] {
  return navItems.filter(
    (item) => item.roles.includes("all") || item.roles.includes(userRole)
  );
}

/**
 * Returns nav sections filtered by role (sections with zero visible
 * items are excluded).
 */
export function getVisibleNavSections(userRole: string): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.roles.includes("all") || item.roles.includes(userRole)
      ),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * Returns the count of visible nav items for a given role.
 */
export function getVisibleNavItemCount(userRole: string): number {
  return getVisibleNavItems(userRole).length;
}

/**
 * Returns which sections are visible to a given role.
 */
export function getVisibleSectionsForRole(userRole: string): string[] {
  return getVisibleNavSections(userRole).map((section) => section.title);
}

/* ═══════════════════════════════════════════════════════════════
   BOTTOM BAR ITEMS (global tools, not daily navigation)
   Kept minimal — Settings moved to ADMIN section per D-002
   ═══════════════════════════════════════════════════════════════ */

export const bottomNavItems: NavItem[] = [
  /* Personas page exists at /personas but is not part of D-002 IA.
     Reactivate here if it returns to the approved hierarchy. */
];

/* ═══════════════════════════════════════════════════════════════
   HERO CONFIGS (page headers)
   ═══════════════════════════════════════════════════════════════ */

export interface HeroConfig {
  category: string;
  title: string;
  subtitle: string;
}

export const heroConfigs: Record<string, HeroConfig> = {
  "/": {
    category: "OPERATIONS",
    title: "Dashboard",
    subtitle:
      "Your operational command center. Overview of census, workflows, alerts, and quick actions.",
  },
  "/workflows": {
    category: "OPERATIONS",
    title: "My Shift",
    subtitle:
      "Day Shift — July 3, 2026 | 7:00 AM - 3:00 PM. Guided workflow: med passes, observations, family contacts, documentation, handoff.",
  },
  "/clinical": {
    category: "OPERATIONS",
    title: "BHC Clinical Dashboard",
    subtitle:
      "Clinical operations for Behavioral Health Clinic — census, encounters, MAR, and care coordination.",
  },
  "/clinical/treatment-plans": {
    category: "OPERATIONS",
    title: "Treatment Plans",
    subtitle: "Create, review, and manage individualized treatment plans with goals, interventions, and outcomes.",
  },
  "/clinical/sessions": {
    category: "OPERATIONS",
    title: "Clinical Sessions",
    subtitle: "Document clinical encounters including progress notes, risk assessments, and interventions.",
  },
  "/clinical/outcome-measures": {
    category: "OPERATIONS",
    title: "Outcome Measures",
    subtitle: "Track standardized clinical outcomes (PHQ-9, GAD-7, PSS-10, etc.) with trend analysis.",
  },
  "/clinical/insurance-plans": {
    category: "OPERATIONS",
    title: "Insurance Plans",
    subtitle: "Manage payer contracts, plan configurations, and coverage verification.",
  },
  "/clinical/referrals": {
    category: "OPERATIONS",
    title: "Referral Intake",
    subtitle: "Process internal and external referrals across CCMG, MHTCM, MHRS, and GRO departments.",
  },
  "/clinical/cans-assessments": {
    category: "OPERATIONS",
    title: "CANS / TRR Assessments",
    subtitle: "Administer Child and Adolescent Needs and Strengths assessments with domain scoring.",
  },
  "/clinical/service-delivery": {
    category: "OPERATIONS",
    title: "Service Delivery",
    subtitle: "Aggregate view of MHTCM (T1017), MHRS (H2017), and clinical service documentation.",
  },
  "/gro": {
    category: "OPERATIONS",
    title: "GRO Residential Dashboard",
    subtitle:
      "48-bed GRO campus census, shifts, behavioral observations, family contacts. SOP Part VI.",
  },
  "/gro/shift-logs": {
    category: "RESIDENTIAL",
    title: "Shift Logs",
    subtitle: "Digital shift logs with timestamps — clock in/out, entries, and activity tracking.",
  },
  "/gro/safety-rounds": {
    category: "RESIDENTIAL",
    title: "Safety Round Checklists",
    subtitle: "Area-based safety inspection checklists with 8-point verification.",
  },
  "/gro/care-logs": {
    category: "RESIDENTIAL",
    title: "Youth Care Logs",
    subtitle: "Per-resident care entries for daily living, behavioral, medical, and emotional support.",
  },
  "/gro/incidents": {
    category: "RESIDENTIAL",
    title: "Incident Reports",
    subtitle: "Residential incident reporting with severity classification and status workflows.",
  },
  "/gro/supervision": {
    category: "RESIDENTIAL",
    title: "Supervision Documentation",
    subtitle: "Supervision notes and staff development records.",
  },
  "/gro/handoffs": {
    category: "RESIDENTIAL",
    title: "Shift Handoffs",
    subtitle: "End-of-shift summaries and transfers between outgoing and incoming staff.",
  },
  "/gad": {
    category: "OPERATIONS",
    title: "GAD Operations Dashboard",
    subtitle:
      "General Administration Division — HR, finance, compliance, and cross-divisional coordination.",
  },
  "/qa": {
    category: "COMPLIANCE",
    title: "QA & Audits",
    subtitle:
      "CAP tracking, audit binders, evidence matrix, deficiency tracking, and compliance scoring.",
  },
  "/revenue": {
    category: "COMPLIANCE",
    title: "Revenue Cycle",
    subtitle:
      "Claims, denials, authorizations, payer packets, and collection tracking.",
  },
  "/analytics": {
    category: "REPORTS",
    title: "Analytics & Forecasting",
    subtitle:
      "Predictive analytics, capacity alerts, discharge forecasting, and occupancy trends.",
  },
  "/hr": {
    category: "HUMAN RESOURCES",
    title: "HR Command Center",
    subtitle:
      "Workforce Activation & Management Overview — recruitment through separation.",
  },
  "/hr/recruitment": {
    category: "WORKFORCE ACTIVATION",
    title: "Recruitment",
    subtitle:
      "Role requisition, approval, posting, and applicant intake.",
  },
  "/hr/screening": {
    category: "WORKFORCE ACTIVATION",
    title: "Screening & Selection",
    subtitle:
      "Qualification review, interviews, reference verification.",
  },
  "/hr/offers": {
    category: "WORKFORCE ACTIVATION",
    title: "Offers & Pre-Employment",
    subtitle:
      "Offer generation, acceptance, packet collection, file build.",
  },
  "/hr/orientation": {
    category: "WORKFORCE ACTIVATION",
    title: "Orientation",
    subtitle:
      "New employee orientation, policy acknowledgment, supervisor sign-off.",
  },
  "/hr/onboarding": {
    category: "WORKFORCE ACTIVATION",
    title: "Onboarding & Training",
    subtitle:
      "Role-based training, competency verification, clearance readiness.",
  },
  "/hr/clearance": {
    category: "WORKFORCE ACTIVATION",
    title: "Clearance & Activation",
    subtitle:
      "Final eligibility verification and release-to-duty authorization.",
  },
  "/hr/personnel-files": {
    category: "WORKFORCE MANAGEMENT",
    title: "Personnel Files",
    subtitle:
      "Official employee record with 7 file sections.",
  },
  "/hr/credentials": {
    category: "WORKFORCE MANAGEMENT",
    title: "Credentials & Training",
    subtitle:
      "Credential tracking, training assignments, competency assessments, and compliance.",
  },
  "/hr/performance": {
    category: "WORKFORCE MANAGEMENT",
    title: "Performance",
    subtitle:
      "Performance reviews, action documentation, and development plans.",
  },
  "/hr/compliance": {
    category: "WORKFORCE MANAGEMENT",
    title: "Compliance & Audits",
    subtitle:
      "Personnel file audits, deficiency tracking, and correction management.",
  },
  "/hr/separation": {
    category: "WORKFORCE MANAGEMENT",
    title: "Separation & Offboarding",
    subtitle:
      "Employee separation, offboarding, file closure, and archive.",
  },
  "/admin/settings": {
    category: "ADMIN",
    title: "Settings",
    subtitle: "System configuration, user management, and administrative controls.",
  },
  "/nil": {
    category: "ADMIN",
    title: "NIL Graph",
    subtitle:
      "Cross-Module Intelligence — NIL-powered semantic search across all modules.",
  },
  "/admin/entra-id": {
    category: "ADMIN",
    title: "Entra ID Sync",
    subtitle: "Microsoft Entra ID user synchronization and access management.",
  },
  "/admin/workflows": {
    category: "ADMIN",
    title: "Workflow Engine",
    subtitle: "Workflow definition, automation rules, and pipeline orchestration.",
  },
  "/onboarding/track/universal-orientation": {
    category: "ADMIN",
    title: "Universal Orientation",
    subtitle: "Organization-wide orientation tracking and completion verification.",
  },
  "/onboarding": {
    category: "ADMIN",
    title: "Onboarding Academy",
    subtitle:
      "New hire onboarding — supervisor assignments, training modules, evidence collection.",
  },
  "/documents": {
    category: "ADMIN",
    title: "Document Studio",
    subtitle:
      "Branded DOCX/PDF/Excel generation, template library, and controlled publishing.",
  },
  "/knowledge": {
    category: "ADMIN",
    title: "Knowledge & SOP Library",
    subtitle:
      "Policies, SOPs, forms, regulatory references, training materials, and NIL semantic search.",
  },
  /* Legacy hero configs — kept for any hardcoded links that may reference them */
  "/bhc": {
    category: "OPERATIONS",
    title: "BHC Executive Dashboard",
    subtitle:
      "CCMG · MHTCM · MHRS — 3-department unified view with census, encounters, billing, and cross-divisional referrals.",
  },
  "/executive": {
    category: "ADMIN",
    title: "Executive Command",
    subtitle:
      "Risk register, strategic decisions, growth initiatives, board memos, and enterprise KPIs.",
  },
  "/executive/mgma": {
    category: "ADMIN",
    title: "MGMA Executive Scorecard",
    subtitle:
      "7-Domain Practice Management Baseline with 21 KPIs, division scorecards, and MGMA benchmarking.",
  },
  "/executive/strategic-projects": {
    category: "ADMIN",
    title: "Strategic Projects Hub",
    subtitle:
      "Initiative tracking, milestone management, portfolio oversight, and resource allocation.",
  },
  "/executive/marketing-review": {
    category: "ADMIN",
    title: "Marketing Site Review",
    subtitle:
      "Automated quality audit for public-facing website — accessibility, SEO, performance, and content.",
  },
  "/personas": {
    category: "ADMIN",
    title: "Persona Activation",
    subtitle:
      "AMOS persona registry. Activate, deactivate, and monitor agent personas.",
  },
};

/* ═══════════════════════════════════════════════════════════════
   BREADCRUMBS
   ═══════════════════════════════════════════════════════════════ */

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function getBreadcrumbs(path: string): BreadcrumbSegment[] {
  const segments = path.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbSegment[] = [{ label: "Home", href: "/" }];

  if (segments[0] === "hr") {
    breadcrumbs.push({ label: "HR Command Center", href: "/hr" });
    if (segments[1]) {
      const moduleNames: Record<string, string> = {
        recruitment: "Recruitment",
        screening: "Screening",
        offers: "Offers",
        orientation: "Orientation",
        onboarding: "Onboarding",
        clearance: "Clearance",
        "personnel-files": "Personnel Files",
        credentials: "Credentials",
        performance: "Performance",
        compliance: "Compliance & Audits",
        separation: "Separation",
        person: "Person Profile",
      };
      breadcrumbs.push({ label: moduleNames[segments[1]] || segments[1] });
    }
  } else if (segments[0] === "onboarding") {
    breadcrumbs.push({ label: "Onboarding Academy", href: "/onboarding" });
    if (segments[1]) {
      const pageNames: Record<string, string> = {
        supervisor: "Supervisor",
        management: "Management",
        track: "Track",
        training: "Training",
        evidence: "Evidence",
        module: "Module",
        employee: "Employee",
      };
      breadcrumbs.push({ label: pageNames[segments[1]] || segments[1] });
    }
  } else if (segments[0] === "clinical") {
    breadcrumbs.push({ label: "Clinical", href: "/clinical" });
    if (segments[1]) {
      const clinicalNames: Record<string, string> = {
        patients: "Patients",
        "treatment-plans": "Treatment Plans",
        sessions: "Clinical Sessions",
        "outcome-measures": "Outcome Measures",
        "insurance-plans": "Insurance Plans",
        referrals: "Referral Intake",
        "cans-assessments": "CANS Assessments",
        "service-delivery": "Service Delivery",
      };
      breadcrumbs.push({ label: clinicalNames[segments[1]] || segments[1] });
      if (segments[1] === "patients" && segments[2]) {
        breadcrumbs.push({ label: "Patient Profile" });
      }
    }
  } else if (segments[0] === "hr" && segments[1] && ["credentials-tracker", "training-assignments", "performance-reviews", "separations", "onboarding-workflow"].includes(segments[1])) {
    breadcrumbs.push({ label: "HR Command Center", href: "/hr" });
    const toolNames: Record<string, string> = {
      "credentials-tracker": "Credential Tracker",
      "training-assignments": "Training Assignment",
      "performance-reviews": "Performance Reviews",
      "separations": "Separations",
      "onboarding-workflow": "Onboarding Workflow",
    };
    breadcrumbs.push({ label: toolNames[segments[1]] || segments[1] });
  } else if (segments[0] === "admin") {
    breadcrumbs.push({ label: "Admin", href: "/admin/settings" });
    if (segments[1]) {
      const adminNames: Record<string, string> = {
        settings: "Settings",
        "entra-id": "Entra ID Sync",
        workflows: "Workflow Engine",
      };
      breadcrumbs.push({ label: adminNames[segments[1]] || segments[1] });
    }
  }

  return breadcrumbs;
}
