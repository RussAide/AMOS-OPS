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
  ClipboardList,
  ArrowRightLeft,
  TabletSmartphone,
  Package2,
  Clock,
  ShieldAlert,
  Heart,
  HeartHandshake,
  AlertTriangle,
  StickyNote,
  ClipboardSignature,
  Lightbulb,
  Globe2,
  type LucideIcon,
} from "lucide-react";
import { authorizeClientRoute } from "@/constants/access-control";

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION DATA — D-002 hierarchy with canonical authorization
   Visibility is derived from the 36-role Enterprise Role Registry.
   ═══════════════════════════════════════════════════════════════ */

export interface NavItem {
  label: string;
  agent: string;
  href: string;
  icon: LucideIcon;
  section: string;
  audience: string[]; // descriptive legacy audience metadata; never authorization
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

/* ─── Section 1: OPERATIONS — Visible to ALL roles ─── */
const OPERATIONS_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    agent: "AMOS-Core",
    href: "/",
    icon: LayoutDashboard,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Workflows",
    agent: "AMOS-Core",
    href: "/workflows",
    icon: ListTodo,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Intelligence Workplan",
    agent: "AMOS-Enterprise",
    href: "/workflows/intelligence-assistant",
    icon: Lightbulb,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "BHC Clinical",
    agent: "AMOS-Clinical",
    href: "/clinical",
    icon: Activity,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Clinical Intelligence Fabric",
    agent: "AMOS-Clinical",
    href: "/clinical/intelligence-fabric",
    icon: Lightbulb,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "CCMG Oversight",
    agent: "AMOS-Clinical",
    href: "/ccmg",
    icon: HeartHandshake,
    section: "OPERATIONS",
    audience: ["ccmg-oversight"],
  },
  {
    label: "Continuum Operations",
    agent: "AMOS-Core",
    href: "/continuum",
    icon: HeartHandshake,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Corporate Operations",
    agent: "AMOS-Enterprise",
    href: "/corporate-operations",
    icon: Compass,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "MHRS Program",
    agent: "AMOS-Clinical",
    href: "/mhrs",
    icon: Activity,
    section: "OPERATIONS",
    audience: ["mhrs-supervisor", "therapist", "clinical-supervisor"],
  },
  {
    label: "MHTCM Case Management",
    agent: "AMOS-Clinical",
    href: "/mhtcm",
    icon: ClipboardList,
    section: "OPERATIONS",
    audience: ["mhtcm-supervisor", "case-manager", "qmhp-cs"],
  },
  // ─── BHC Clinical Sub-Pages ───
  {
    label: "Treatment Plans",
    agent: "AMOS-Clinical",
    href: "/clinical/treatment-plans",
    icon: BookOpen,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Clinical Sessions",
    agent: "AMOS-Clinical",
    href: "/clinical/sessions",
    icon: FileText,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Outcome Measure Governance",
    agent: "AMOS-Clinical",
    href: "/clinical/outcome-measures",
    icon: BarChart3,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Insurance Plans",
    agent: "AMOS-Clinical",
    href: "/clinical/insurance-plans",
    icon: ShieldCheck,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Referral Intake",
    agent: "AMOS-Clinical",
    href: "/clinical/referrals",
    icon: ArrowRightLeft,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "CANS Assessments",
    agent: "AMOS-Clinical",
    href: "/clinical/cans-assessments",
    icon: ClipboardList,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Service Delivery",
    agent: "AMOS-Clinical",
    href: "/clinical/service-delivery",
    icon: Package2,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "GRO Residential",
    agent: "AMOS-GRO",
    href: "/gro",
    icon: Home,
    section: "OPERATIONS",
    audience: ["all"],
  },
  // ─── GRO Residential Sub-Pages ───
  {
    label: "Shift Logs",
    agent: "AMOS-GRO",
    href: "/gro/shift-logs",
    icon: Clock,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Safety Rounds",
    agent: "AMOS-GRO",
    href: "/gro/safety-rounds",
    icon: ShieldAlert,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Care Logs",
    agent: "AMOS-GRO",
    href: "/gro/care-logs",
    icon: Heart,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Incidents",
    agent: "AMOS-GRO",
    href: "/gro/incidents",
    icon: AlertTriangle,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Supervision",
    agent: "AMOS-GRO",
    href: "/gro/supervision",
    icon: StickyNote,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "Shift Handoffs",
    agent: "AMOS-GRO",
    href: "/gro/handoffs",
    icon: ClipboardSignature,
    section: "OPERATIONS",
    audience: ["all"],
  },
  {
    label: "GAD Ops",
    agent: "AMOS-Domain",
    href: "/gad",
    icon: Building2,
    section: "OPERATIONS",
    audience: ["all"],
  },
];

/* ─── Section 2: COMPLIANCE ───
   Visible to: qa-coordinator, compliance-officer, administrator-lcca,
   super-admin, qa-auditor, chart-auditor */
const COMPLIANCE_ITEMS: NavItem[] = [
  {
    label: "Regulatory Framework",
    agent: "AMOS-Sentinel",
    href: "/compliance/regulatory-framework",
    icon: Shield,
    section: "COMPLIANCE",
    audience: [
      "qa-coordinator",
      "compliance-officer",
      "administrator-lcca",
      "super-admin",
      "qa-auditor",
      "chart-auditor",
    ],
  },
  {
    label: "QA & Compliance",
    agent: "AMOS-Sentinel",
    href: "/qa",
    icon: ShieldCheck,
    section: "COMPLIANCE",
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    audience: [
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
    label: "Organization Model",
    agent: "AMOS-Core",
    href: "/admin/organization",
    icon: Building2,
    section: "ADMIN",
    audience: ["enterprise-administration"],
  },
  {
    label: "Settings",
    agent: "AMOS-Core",
    href: "/admin/settings",
    icon: Settings,
    section: "ADMIN",
    audience: ["super-admin"],
  },
  {
    label: "Enhancement Register",
    agent: "AMOS-Core",
    href: "/admin/enhancements",
    icon: Lightbulb,
    section: "ADMIN",
    audience: ["super-admin", "managing-director", "administrator"],
  },
  {
    label: "NIL Graph",
    agent: "AMOS-Core",
    href: "/nil",
    icon: Network,
    section: "ADMIN",
    audience: ["super-admin"],
  },
  {
    label: "Entra ID Sync",
    agent: "AMOS-Core",
    href: "/admin/entra-id",
    icon: Lock,
    section: "ADMIN",
    audience: ["super-admin"],
  },
  {
    label: "Workflow Engine",
    agent: "AMOS-Core",
    href: "/admin/workflows",
    icon: Cog,
    section: "ADMIN",
    audience: ["super-admin"],
  },
  {
    label: "Universal Orientation",
    agent: "AMOS-Core",
    href: "/onboarding/track/universal-orientation",
    icon: MapPin,
    section: "ADMIN",
    audience: ["super-admin"],
  },
  {
    label: "Onboarding Academy",
    agent: "AMOS-Core",
    href: "/onboarding",
    icon: GraduationCap,
    section: "ADMIN",
    audience: ["super-admin"],
  },
  {
    label: "Document Studio",
    agent: "AMOS-Scribe",
    href: "/documents",
    icon: FileText,
    section: "ADMIN",
    audience: ["super-admin"],
  },
  {
    label: "Knowledge & SOP",
    agent: "AMOS-Core",
    href: "/knowledge",
    icon: BookOpen,
    section: "ADMIN",
    audience: ["super-admin"],
  },
  {
    label: "Document Intelligence",
    agent: "AMOS-Scribe",
    href: "/knowledge/document-intelligence",
    icon: Network,
    section: "ADMIN",
    audience: ["all"],
  },
  {
    label: "Operations Hub",
    agent: "AMOS-DMS",
    href: "/operations-hub",
    icon: Globe2,
    section: "ADMIN",
    audience: ["all"],
  },
  {
    label: "Microsoft 365 Integration",
    agent: "AMOS-DMS",
    href: "/operations-hub/microsoft-integrations",
    icon: ArrowRightLeft,
    section: "ADMIN",
    audience: ["all"],
  },
  {
    label: "Mobile & Offline",
    agent: "AMOS-Core",
    href: "/operations-hub/mobile-offline",
    icon: TabletSmartphone,
    section: "ADMIN",
    audience: ["all"],
  },
  {
    label: "Enterprise Demo Verification",
    agent: "AMOS-Enterprise",
    href: "/operations-hub/enterprise-demo",
    icon: ClipboardCheck,
    section: "ADMIN",
    audience: ["all"],
  },
  {
    label: "Executive Command",
    agent: "AMOS-Domain",
    href: "/executive",
    icon: Shield,
    section: "ADMIN",
    audience: ["super-admin", "executive-director", "managing-director"],
  },
  {
    label: "Decision Intelligence",
    agent: "AMOS-Enterprise",
    href: "/executive/decision-intelligence",
    icon: BarChart3,
    section: "ADMIN",
    audience: [
      "super-admin",
      "managing-director",
      "administrator",
      "bhc-director",
      "treatment-director",
      "clinical-director",
      "gro-administrator",
      "program-director",
      "hr-director",
      "hr-compliance-officer",
      "revenue-cycle-manager",
      "facilities-manager",
    ],
  },
  {
    label: "MGMA Scorecard",
    agent: "AMOS-Domain",
    href: "/executive/mgma",
    icon: Award,
    section: "ADMIN",
    audience: ["super-admin", "executive-director", "managing-director"],
  },
  {
    label: "Strategic Projects",
    agent: "AMOS-Domain",
    href: "/executive/strategic-projects",
    icon: TrendingUp,
    section: "ADMIN",
    audience: ["super-admin", "executive-director", "managing-director"],
  },
  {
    label: "Site Review",
    agent: "AMOS-Domain",
    href: "/executive/marketing-review",
    icon: Globe2,
    section: "ADMIN",
    audience: ["super-admin", "executive-director", "managing-director"],
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
 * The access-control registry is the only visibility authority.
 */
export function getVisibleNavItems(userRole: string): NavItem[] {
  return navItems.filter((item) => authorizeClientRoute(userRole, item.href).allowed);
}

/**
 * Returns nav sections filtered by role (sections with zero visible
 * items are excluded).
 */
export function getVisibleNavSections(userRole: string): NavSection[] {
  return navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => authorizeClientRoute(userRole, item.href).allowed),
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
  "/compliance/regulatory-framework": {
    category: "COMPLIANCE",
    title: "Regulatory Framework",
    subtitle: "Controlled MHTCM, MHRS, billing, GRO Chapter 748, and 42 CFR Part 2 rules with end-to-end evidence mapping.",
  },
  "/workflows": {
    category: "OPERATIONS",
    title: "My Shift",
    subtitle:
      "Day Shift — July 3, 2026 | 7:00 AM - 3:00 PM. Guided workflow: med passes, observations, family contacts, documentation, handoff.",
  },
  "/workflows/intelligence-assistant": {
    category: "OPERATIONS",
    title: "My Intelligence Workplan",
    subtitle:
      "Permission-aware daily, weekly, monthly, quarterly, and annual priorities with sourced Ask AMOS guidance and accountable human controls.",
  },
  "/clinical": {
    category: "OPERATIONS",
    title: "BHC Clinical Dashboard",
    subtitle:
      "Clinical operations for Behavioral Health Clinic — census, encounters, MAR, and care coordination.",
  },
  "/clinical/intelligence-fabric": {
    category: "CLINICAL INTELLIGENCE",
    title: "Clinical Intelligence Fabric",
    subtitle:
      "Governed synthetic pathway, source, instrument, workplan, and scenario evaluation with named human controls and zero live writes.",
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
    category: "CLINICAL INTELLIGENCE",
    title: "Outcome Measure Governance",
    subtitle:
      "Metadata-only evaluation boundary for governed sources, instrument profiles, competency controls, and named human review.",
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
  "/admin/organization": {
    category: "ADMIN",
    title: "Organization & Campus Model",
    subtitle: "Controlled four-division, BHC department, PC/CO, and three-stage campus development reference.",
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
  "/knowledge/document-intelligence": {
    category: "ADMIN",
    title: "Document & Knowledge Intelligence",
    subtitle:
      "Governed records, permission-trimmed search, cited NIL retrieval, T2+ report building, and no-code administration.",
  },
  "/operations-hub": {
    category: "ENTERPRISE OPERATIONS",
    title: "Adolbi Care Operations Hub",
    subtitle:
      "Governed content architecture, Microsoft repository controls, stable AMOS identities, permission-trimmed intranet routing, and integrated migration and security evaluation.",
  },
  "/operations-hub/microsoft-integrations": {
    category: "ENTERPRISE OPERATIONS",
    title: "Microsoft 365 Integration Control Center",
    subtitle:
      "Synthetic Teams notification, Outlook referral intake, and governed SharePoint synchronization evaluation with measurable service thresholds, recovery controls, and zero live Microsoft activity.",
  },
  "/operations-hub/mobile-offline": {
    category: "ENTERPRISE OPERATIONS",
    title: "Mobile & Offline Operations Center",
    subtitle:
      "Synthetic tablet medication pass, encrypted device cache, offline queue, reconnect reconciliation, and field-usability evaluation with zero live device or production activity.",
  },
  "/operations-hub/enterprise-demo": {
    category: "ENTERPRISE OPERATIONS",
    title: "Final Cross-Enterprise Demo Verification",
    subtitle:
      "One governed Operations Hub experience spanning all twelve enterprise criteria, the eight-stage referral-to-executive pilot, contextual assistance, evidence lineage, and zero-live boundary verification.",
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
  "/executive/decision-intelligence": {
    category: "ADMIN",
    title: "Executive Decision Intelligence",
    subtitle:
      "Governed enterprise and division dashboards with source lineage, three-click detail, data-quality state, and human decision controls.",
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
        "credentials-tracker": "Credential Tracker",
        "training-assignments": "Training Assignment",
        "performance-reviews": "Performance Reviews",
        separations: "Separations",
        "onboarding-workflow": "Onboarding Workflow",
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
        "outcome-measures": "Outcome Measure Governance",
        "insurance-plans": "Insurance Plans",
        referrals: "Referral Intake",
        "cans-assessments": "CANS Assessments",
        "service-delivery": "Service Delivery",
        "intelligence-fabric": "Clinical Intelligence Fabric",
      };
      breadcrumbs.push({ label: clinicalNames[segments[1]] || segments[1] });
      if (segments[1] === "patients" && segments[2]) {
        breadcrumbs.push({ label: "Patient Profile" });
      }
    }
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
  } else if (segments[0] === "operations-hub") {
    breadcrumbs.push({ label: "Operations Hub", href: "/operations-hub" });
    if (segments[1] === "microsoft-integrations")
      breadcrumbs.push({ label: "Microsoft 365 Integration" });
    if (segments[1] === "mobile-offline")
      breadcrumbs.push({ label: "Mobile & Offline" });
    if (segments[1] === "enterprise-demo")
      breadcrumbs.push({ label: "Enterprise Demo Verification" });
  }

  return breadcrumbs;
}
