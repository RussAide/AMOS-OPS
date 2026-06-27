import {
  LayoutDashboard,
  GitBranch,
  Stethoscope,
  Home,
  Wrench,
  ShieldCheck,
  DollarSign,
  Users,
  FileText,
  BookOpen,
  Search,
  Compass,
  GraduationCap,
  FolderOpen,
  Award,
  TrendingUp,
  ClipboardCheck,
  BarChart3,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  agent: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "OPERATIONS",
    items: [
      { label: "Dashboard", agent: "AMOS-Core", href: "/", icon: LayoutDashboard },
      { label: "Workflows", agent: "AMOS-Core", href: "/workflows", icon: GitBranch },
      { label: "BHC Clinical", agent: "AMOS-Clinical", href: "/clinical", icon: Stethoscope },
      { label: "GRO Residential", agent: "AMOS-GRO", href: "/gro", icon: Home },
      { label: "GAD Ops", agent: "AMOS-Core", href: "/gad", icon: Wrench },
    ],
  },
  {
    title: "COMPLIANCE",
    items: [
      { label: "QA & Compliance", agent: "AMOS-Sentinel", href: "/qa", icon: ShieldCheck },
      { label: "Revenue Cycle", agent: "AMOS-Revenue", href: "/revenue", icon: DollarSign },
    ],
  },
  {
    title: "REPORTS",
    items: [
      { label: "Analytics", agent: "AMOS-Core", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "HUMAN RESOURCES",
    items: [
      { label: "HR Command Center", agent: "AMOS-HR", href: "/hr", icon: ShieldCheck },
    ],
  },
  {
    title: "WORKFORCE ACTIVATION",
    items: [
      { label: "Recruitment", agent: "AMOS-HR", href: "/hr/recruitment", icon: Users },
      { label: "Screening", agent: "AMOS-HR", href: "/hr/screening", icon: Search },
      { label: "Offers & Pre-Employment", agent: "AMOS-HR", href: "/hr/offers", icon: FileText },
      { label: "Orientation", agent: "AMOS-HR", href: "/hr/orientation", icon: Compass },
      { label: "Onboarding & Training", agent: "AMOS-HR", href: "/hr/onboarding", icon: GraduationCap },
      { label: "Clearance & Activation", agent: "AMOS-HR", href: "/hr/clearance", icon: ShieldCheck },
    ],
  },
  {
    title: "WORKFORCE MANAGEMENT",
    items: [
      { label: "Personnel Files", agent: "AMOS-HR", href: "/hr/personnel-files", icon: FolderOpen },
      { label: "Credentials & Training", agent: "AMOS-HR", href: "/hr/credentials", icon: Award },
      { label: "Performance & Action", agent: "AMOS-HR", href: "/hr/performance", icon: TrendingUp },
      { label: "Compliance & Audits", agent: "AMOS-HR", href: "/hr/compliance", icon: ClipboardCheck },
      { label: "Separation", agent: "AMOS-HR", href: "/hr/separation", icon: Users },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { label: "NIL Knowledge Graph", agent: "AMOS-Core", href: "/nil", icon: Search },
      { label: "Entra ID Sync", agent: "AMOS-Core", href: "/admin/entra-id", icon: ShieldCheck },
      { label: "Workflow Engine", agent: "AMOS-Core", href: "/admin/workflows", icon: GitBranch },
      { label: "Universal Orientation", agent: "AMOS-Core", href: "/onboarding/track/universal-orientation", icon: ShieldCheck },
      { label: "Onboarding Academy", agent: "AMOS-Core", href: "/onboarding", icon: GraduationCap },
      { label: "Document Studio", agent: "AMOS-Scribe", href: "/documents", icon: FileText },
      { label: "Knowledge & SOP", agent: "AMOS-Core", href: "/knowledge", icon: BookOpen },
    ],
  },
];

export interface HeroConfig {
  category: string;
  title: string;
  subtitle: string;
}

export const heroConfigs: Record<string, HeroConfig> = {
  "/onboarding": {
    category: "ONBOARDING ACADEMY",
    title: "Staff Onboarding Home",
    subtitle: "Begin your orientation journey. Complete required modules, submit evidence, and track your clearance status.",
  },
  "/onboarding/supervisor": {
    category: "REVIEW QUEUE",
    title: "Supervisor Dashboard",
    subtitle: "Review onboarding records pending supervisor action. Approve, restrict, block, or request more information without expanding outside the onboarding scope.",
  },
  "/onboarding/management": {
    category: "ONBOARDING ACADEMY",
    title: "Management Overview",
    subtitle: "Cross-track visibility for active onboarding, blockers, pending reviews, clearances, and restricted releases.",
  },
  "/onboarding/track": {
    category: "TRACK VIEW",
    title: "Track Progress",
    subtitle: "View your assigned role track, module completion status, and upcoming clearance gates.",
  },
  "/onboarding/training": {
    category: "TRAINING CENTER",
    title: "Training Modules",
    subtitle: "Access core training content organized by competency area. Complete all modules to advance through clearance gates.",
  },
  "/onboarding/evidence": {
    category: "EVIDENCE UPLOAD",
    title: "Submit Evidence",
    subtitle: "Upload required documentation to support clearance gate progression. All submissions are audited and require supervisor review.",
  },
  "/onboarding/module": {
    category: "MODULE VIEWER",
    title: "Module Content",
    subtitle: "Interactive training module. Complete all sections and pass knowledge checks to earn module credit.",
  },
  "/onboarding/employee": {
    category: "EMPLOYEE RECORD",
    title: "Employee Profile",
    subtitle: "Complete onboarding record including track assignment, module history, evidence submissions, and clearance status.",
  },
};

export interface BreadcrumbSegment {
  label: string;
  href?: string;
}

export function getBreadcrumbs(path: string): BreadcrumbSegment[] {
  const segments = path.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbSegment[] = [{ label: "Home", href: "/" }];

  if (segments[0] === "onboarding") {
    breadcrumbs.push({ label: "Onboarding", href: "/onboarding" });
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
  }

  return breadcrumbs;
}
