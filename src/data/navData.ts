import {
  LayoutDashboard,
  Users,
  FileCheck,
  ShieldCheck,
  Mail,
  BarChart3,
  GitBranch,
  Search,
  Settings,
  GraduationCap,
  FileText,
  BookOpen,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  agent?: string;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "DASHBOARD",
    items: [
      { label: "Dashboard", agent: "AMOS-Core", href: "/", icon: LayoutDashboard },
      { label: "Analytics", agent: "AMOS-Ops", href: "/analytics", icon: BarChart3 },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { label: "HR Command Center", agent: "AMOS-Core", href: "/hr", icon: Users },
      { label: "Credential Tracking", agent: "AMOS-Core", href: "/credentials", icon: FileCheck },
      { label: "Separation Management", agent: "AMOS-Core", href: "/separation", icon: ShieldCheck },
      { label: "Email Outreach", agent: "AMOS-Outreach", href: "/email", icon: Mail },
    ],
  },
  {
    title: "CLINICAL",
    items: [
      { label: "Clinical Dashboard", agent: "AMOS-Clinical", href: "/clinical", icon: ShieldCheck },
    ],
  },
  {
    title: "COMPLIANCE",
    items: [
      { label: "Audit & Reviews", agent: "AMOS-Audit", href: "/audit", icon: FileCheck },
    ],
  },
  {
    title: "ADMIN",
    items: [
      { label: "Settings", agent: "AMOS-Core", href: "/admin/settings", icon: Settings },
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
