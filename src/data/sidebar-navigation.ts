import {
  Activity,
  Building2,
  Home,
  LayoutDashboard,
  ListTodo,
  Settings,
  Shield,
  Users,
  type LucideIcon,
} from "lucide-react";
import { authorizeClientRoute } from "@/constants/access-control";
import type { DivisionId } from "@/constants/organization";
import { navItems, type NavItem } from "@/data/navData";

export type SidebarRuntimeMode = "demo" | "production";

export interface SidebarNavLink {
  type: "link";
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  agent: string;
  modes?: readonly SidebarRuntimeMode[];
}

export interface SidebarNavGroup {
  type: "group";
  id: string;
  label: string;
  icon: LucideIcon;
  children: readonly SidebarNavNode[];
  division?: DivisionId;
  adminOnly?: boolean;
  modes?: readonly SidebarRuntimeMode[];
}

export type SidebarNavNode = SidebarNavLink | SidebarNavGroup;

const navByHref = new Map(navItems.map((item) => [item.href, item]));

function link(
  id: string,
  label: string,
  href: string,
  sourceHref = href,
  modes?: readonly SidebarRuntimeMode[],
): SidebarNavLink {
  const source: NavItem | undefined = navByHref.get(sourceHref);
  if (!source) {
    throw new Error(`Sidebar navigation source is missing for ${sourceHref}.`);
  }
  return {
    type: "link",
    id,
    label,
    href,
    icon: source.icon,
    agent: source.agent,
    ...(modes ? { modes } : {}),
  };
}

function group(
  id: string,
  label: string,
  icon: LucideIcon,
  children: readonly SidebarNavNode[],
  options: Pick<SidebarNavGroup, "division" | "adminOnly" | "modes"> = {},
): SidebarNavGroup {
  return { type: "group", id, label, icon, children, ...options };
}

/**
 * Canonical sidebar information architecture.
 *
 * The flat navItems registry remains the route inventory used by legacy tests,
 * breadcrumbs, and search. This hierarchy controls only how authorized routes
 * are presented to users, so consolidating a label never removes a route.
 */
export const SIDEBAR_NAVIGATION: readonly SidebarNavNode[] = [
  group("home", "Home", Home, [
    link("home-enterprise-overview", "Enterprise Overview", "/"),
    link("home-alerts", "Alerts and priorities", "/home/alerts", "/"),
    link("home-division-status", "Division status", "/home/divisions", "/"),
    link("home-quick-actions", "Quick actions", "/home/quick-actions", "/"),
  ]),
  group("my-work", "My Work", ListTodo, [
    link(
      "my-work-today",
      "Today’s work",
      "/workflows/my-work-today",
      "/workflows",
    ),
    link(
      "my-work-assigned",
      "Assigned tasks",
      "/workflows/assigned-tasks",
      "/workflows",
    ),
    link(
      "my-work-attention",
      "Items requiring attention",
      "/workflows/attention",
      "/workflows",
    ),
    link(
      "my-work-calendar",
      "Calendar and deadlines",
      "/workflows/calendar",
      "/workflows",
    ),
    link(
      "my-work-recent",
      "Recent activity",
      "/workflows/recent-activity",
      "/workflows",
    ),
  ]),
  group(
    "bhc",
    "Behavioral Health Center",
    Activity,
    [
      link("bhc-dashboard", "BHC Dashboard", "/bhc", "/clinical"),
      group("bhc-ccmg", "CCMG", Users, [
        link("bhc-ccmg-oversight", "Oversight", "/ccmg"),
        link("bhc-ccmg-referrals", "Referrals and Intake", "/clinical/referrals"),
        link("bhc-ccmg-cans", "CANS/TRR Assessments", "/clinical/cans-assessments"),
        link(
          "bhc-ccmg-medication-quality",
          "Medication and quality coordination",
          "/medications",
          "/clinical",
        ),
      ]),
      group("bhc-mhtcm", "MHTCM", ListTodo, [
        link("bhc-mhtcm-case-management", "Case Management", "/mhtcm"),
        link("bhc-mhtcm-care-coordination", "Care Coordination", "/cases", "/clinical"),
        link(
          "bhc-mhtcm-transitions",
          "Referrals, discharge and aftercare",
          "/continuum",
        ),
      ]),
      group("bhc-mhrs", "MHRS", Activity, [
        link("bhc-mhrs-program-operations", "Program Operations", "/mhrs"),
        link("bhc-mhrs-service-delivery", "Service Delivery", "/clinical/service-delivery"),
        link("bhc-mhrs-clinical-sessions", "Clinical Sessions", "/clinical/sessions"),
        link("bhc-mhrs-outcomes", "Outcomes", "/clinical/outcome-measures"),
      ]),
      group("bhc-shared-clinical", "Shared Clinical Services", Activity, [
        link("bhc-treatment-plans", "Treatment Plans", "/clinical/treatment-plans"),
        link("bhc-insurance", "Insurance and Authorization", "/clinical/insurance-plans"),
        link(
          "bhc-clinical-intelligence",
          "Clinical Intelligence",
          "/clinical/intelligence-fabric",
        ),
      ]),
    ],
    { division: "bhc" },
  ),
  group(
    "gro",
    "General Residential Operations",
    Home,
    [
      link("gro-dashboard", "GRO Dashboard", "/gro"),
      group("gro-shift-operations", "Shift Operations", ListTodo, [
        link("gro-shift-logs", "Shift Logs", "/gro/shift-logs"),
        link("gro-care-logs", "Care Logs", "/gro/care-logs"),
        link("gro-handoffs", "Shift Handoffs", "/gro/handoffs"),
      ]),
      group("gro-safety-supervision", "Safety and Supervision", Shield, [
        link("gro-safety-rounds", "Safety Rounds", "/gro/safety-rounds"),
        link("gro-supervision", "Youth Supervision", "/gro/supervision"),
        link("gro-incidents", "Incidents", "/gro/incidents"),
      ]),
    ],
    { division: "gro" },
  ),
  group(
    "gad",
    "General Administration",
    Building2,
    [
      link("gad-dashboard", "GAD Dashboard", "/gad"),
      link(
        "gad-facilities-work-orders",
        "Facilities and Work Orders",
        "/gad/facilities-work-orders",
        "/gad",
      ),
      link(
        "gad-procurement-vendors",
        "Procurement and Vendors",
        "/gad/procurement-vendors",
        "/gad",
      ),
      link(
        "gad-safety-emergency",
        "Safety and Emergency Preparedness",
        "/gad/safety-emergency-preparedness",
        "/gad",
      ),
      link(
        "gad-transportation-logistics",
        "Transportation and Logistics",
        "/gad/transportation-logistics",
        "/gad",
      ),
      link(
        "gad-regulatory-support",
        "Regulatory Support",
        "/gad/regulatory-support",
        "/gad",
      ),
    ],
    { division: "gad" },
  ),
  group(
    "executive-office",
    "Executive Office",
    Building2,
    [
      link("eo-dashboard", "Executive Dashboard", "/executive"),
      link(
        "eo-decision-intelligence",
        "Decision Intelligence",
        "/executive/decision-intelligence",
      ),
      link("eo-strategic-projects", "Strategic Projects", "/executive/strategic-projects"),
      link("eo-mgma", "MGMA Scorecard", "/executive/mgma"),
      link("eo-analytics", "Enterprise Analytics", "/analytics"),
      link(
        "eo-corporate-continuum",
        "Corporate and Continuum Operations",
        "/corporate-operations",
      ),
      group("eo-human-resources", "Human Resources", Users, [
        group("eo-workforce-activation", "Workforce Activation", Users, [
          link("eo-recruitment", "Recruitment", "/hr/recruitment"),
          link("eo-screening", "Screening", "/hr/screening"),
          link("eo-offers", "Offers", "/hr/offers"),
          link("eo-orientation", "Orientation", "/hr/orientation"),
          link("eo-onboarding", "Onboarding", "/hr/onboarding-workflow"),
          link("eo-clearance", "Clearance", "/hr/clearance"),
        ]),
        group("eo-workforce-management", "Workforce Management", Users, [
          link("eo-personnel-files", "Personnel Files", "/hr/personnel-files"),
          link("eo-credentials", "Credentials", "/hr/credentials-tracker"),
          link("eo-performance", "Performance", "/hr/performance-reviews"),
          link("eo-hr-compliance", "Compliance", "/hr/compliance"),
          link("eo-separation", "Separation", "/hr/separations"),
        ]),
      ]),
      link("eo-quality-compliance", "Quality and Compliance", "/qa"),
      link("eo-revenue-cycle", "Revenue Cycle", "/revenue"),
      group("eo-knowledge-documents", "Knowledge and Documents", LayoutDashboard, [
        link("eo-document-studio", "Document Studio", "/documents"),
        link("eo-knowledge", "Knowledge and SOP", "/knowledge"),
        link(
          "eo-document-intelligence",
          "Document Intelligence",
          "/knowledge/document-intelligence",
        ),
      ]),
    ],
    { division: "eo" },
  ),
  group(
    "system-administration",
    "System Administration",
    Settings,
    [
      link("admin-organization", "Organization and Roles", "/admin/organization"),
      link("admin-settings", "System Settings", "/admin/settings"),
      link(
        "admin-microsoft-integration",
        "Microsoft 365 and Entra Integrations",
        "/operations-hub/microsoft-integrations",
      ),
      link("admin-workflows", "Workflow Configuration", "/admin/workflow", "/admin/workflows"),
      link("admin-intelligence", "AMOS Intelligence/NIL", "/nil"),
      link("admin-mobile", "Mobile and Offline Configuration", "/operations-hub/mobile-offline"),
      link("admin-enhancements", "Enhancement Register", "/admin/enhancements"),
      link(
        "admin-demo-tools",
        "Demo Tools",
        "/operations-hub/enterprise-demo",
        "/operations-hub/enterprise-demo",
        ["demo"],
      ),
    ],
    { adminOnly: true },
  ),
];

function modeAllows(
  modes: readonly SidebarRuntimeMode[] | undefined,
  runtimeMode: SidebarRuntimeMode,
): boolean {
  return !modes || modes.includes(runtimeMode);
}

function filterNode(
  node: SidebarNavNode,
  role: string,
  runtimeMode: SidebarRuntimeMode,
): SidebarNavNode | null {
  if (!modeAllows(node.modes, runtimeMode)) return null;

  if (node.type === "link") {
    return authorizeClientRoute(role, node.href).allowed ? node : null;
  }

  if (
    node.adminOnly &&
    !authorizeClientRoute(role, "/admin/settings").allowed
  ) {
    return null;
  }

  const children = node.children
    .map((child) => filterNode(child, role, runtimeMode))
    .filter((child): child is SidebarNavNode => child !== null);

  return children.length > 0 ? { ...node, children } : null;
}

export function getSidebarNavigation(
  role: string,
  runtimeMode: SidebarRuntimeMode,
): readonly SidebarNavNode[] {
  return SIDEBAR_NAVIGATION.map((node) =>
    filterNode(node, role, runtimeMode),
  ).filter((node): node is SidebarNavNode => node !== null);
}

export function flattenSidebarLinks(
  nodes: readonly SidebarNavNode[],
): readonly SidebarNavLink[] {
  return nodes.flatMap((node) =>
    node.type === "link" ? [node] : flattenSidebarLinks(node.children),
  );
}
