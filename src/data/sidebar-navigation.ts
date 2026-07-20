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
import { appDeepLinkPath, appRoutePath } from "@/data/app-route-registry";
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
    link(
      "home-enterprise-overview",
      "Enterprise Overview",
      appRoutePath("home"),
    ),
    link(
      "home-alerts",
      "Alerts and priorities",
      appRoutePath("home-alerts"),
      appRoutePath("home"),
    ),
    link(
      "home-division-status",
      "Division status",
      appRoutePath("home-divisions"),
      appRoutePath("home"),
    ),
    link(
      "home-quick-actions",
      "Quick actions",
      appRoutePath("home-quick-actions"),
      appRoutePath("home"),
    ),
  ]),
  group("my-work", "My Work", ListTodo, [
    link(
      "my-work-today",
      "Today’s work",
      appRoutePath("workflows-my-work-today"),
      appRoutePath("workflows"),
    ),
    link(
      "my-work-assigned",
      "Assigned tasks",
      appRoutePath("workflows-assigned-tasks"),
      appRoutePath("workflows"),
    ),
    link(
      "my-work-attention",
      "Items requiring attention",
      appRoutePath("workflows-attention"),
      appRoutePath("workflows"),
    ),
    link(
      "my-work-calendar",
      "Calendar and deadlines",
      appRoutePath("workflows-calendar"),
      appRoutePath("workflows"),
    ),
    link(
      "my-work-recent",
      "Recent activity",
      appRoutePath("workflows-recent-activity"),
      appRoutePath("workflows"),
    ),
  ]),
  group(
    "bhc",
    "Behavioral Health Center",
    Activity,
    [
      link(
        "bhc-dashboard",
        "BHC Dashboard",
        appRoutePath("bhc"),
        appRoutePath("clinical"),
      ),
      group("bhc-ccmg", "CCMG", Users, [
        link("bhc-ccmg-oversight", "Oversight", appRoutePath("ccmg")),
        link(
          "bhc-ccmg-referrals",
          "Referrals and Intake",
          appRoutePath("clinical-referrals"),
        ),
        link(
          "bhc-ccmg-cans",
          "Governed CANS profiles",
          appRoutePath("clinical-cans-assessments"),
        ),
        link(
          "bhc-ccmg-medication-quality",
          "Medication and quality coordination",
          appRoutePath("medications"),
          appRoutePath("clinical"),
        ),
      ]),
      group("bhc-mhtcm", "MHTCM", ListTodo, [
        link(
          "bhc-mhtcm-case-management",
          "Case Management",
          appRoutePath("mhtcm"),
        ),
        link(
          "bhc-mhtcm-care-coordination",
          "Care Coordination",
          appRoutePath("cases"),
          appRoutePath("clinical"),
        ),
        link(
          "bhc-mhtcm-transitions",
          "Referrals, discharge and aftercare",
          appRoutePath("continuum"),
        ),
      ]),
      group("bhc-mhrs", "MHRS", Activity, [
        link(
          "bhc-mhrs-program-operations",
          "Program Operations",
          appRoutePath("mhrs"),
        ),
        link(
          "bhc-mhrs-service-delivery",
          "Service Delivery",
          appRoutePath("clinical-service-delivery"),
        ),
        link(
          "bhc-mhrs-clinical-sessions",
          "Clinical Sessions",
          appRoutePath("clinical-sessions"),
        ),
        link(
          "bhc-mhrs-outcomes",
          "Outcomes",
          appRoutePath("clinical-outcome-measures"),
        ),
      ]),
      group("bhc-shared-clinical", "Shared Clinical Services", Activity, [
        link(
          "bhc-treatment-plans",
          "Treatment Plans",
          appRoutePath("clinical-treatment-plans"),
        ),
        link(
          "bhc-insurance",
          "Insurance and Authorization",
          appRoutePath("clinical-insurance-plans"),
        ),
        link(
          "bhc-clinical-intelligence",
          "Clinical Intelligence",
          appRoutePath("clinical-intelligence-fabric"),
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
      link("gro-dashboard", "GRO Dashboard", appRoutePath("gro")),
      group("gro-shift-operations", "Shift Operations", ListTodo, [
        link("gro-shift-logs", "Shift Logs", appRoutePath("gro-shift-logs")),
        link("gro-care-logs", "Care Logs", appRoutePath("gro-care-logs")),
        link("gro-handoffs", "Shift Handoffs", appRoutePath("gro-handoffs")),
      ]),
      group("gro-safety-supervision", "Safety and Supervision", Shield, [
        link(
          "gro-safety-rounds",
          "Safety Rounds",
          appRoutePath("gro-safety-rounds"),
        ),
        link(
          "gro-supervision",
          "Youth Supervision",
          appRoutePath("gro-supervision"),
        ),
        link("gro-incidents", "Incidents", appRoutePath("gro-incidents")),
      ]),
    ],
    { division: "gro" },
  ),
  group(
    "gad",
    "General Administration",
    Building2,
    [
      link("gad-dashboard", "GAD Dashboard", appRoutePath("gad")),
      link(
        "gad-facilities-work-orders",
        "Facilities and Work Orders",
        appRoutePath("gad-facilities-work-orders"),
        appRoutePath("gad"),
      ),
      link(
        "gad-procurement-vendors",
        "Procurement and Vendors",
        appRoutePath("gad-procurement-vendors"),
        appRoutePath("gad"),
      ),
      link(
        "gad-safety-emergency",
        "Safety and Emergency Preparedness",
        appRoutePath("gad-safety-emergency-preparedness"),
        appRoutePath("gad"),
      ),
      link(
        "gad-transportation-logistics",
        "Transportation and Logistics",
        appRoutePath("gad-transportation-logistics"),
        appRoutePath("gad"),
      ),
      link(
        "gad-regulatory-support",
        "Regulatory Support",
        appRoutePath("gad-regulatory-support"),
        appRoutePath("gad"),
      ),
    ],
    { division: "gad" },
  ),
  group(
    "executive-office",
    "Executive Office",
    Building2,
    [
      link("eo-dashboard", "Executive Dashboard", appRoutePath("executive")),
      link(
        "eo-decision-intelligence",
        "Decision Intelligence",
        appRoutePath("executive-decision-intelligence"),
      ),
      link(
        "eo-strategic-projects",
        "Strategic Projects",
        appRoutePath("executive-strategic-projects"),
      ),
      link("eo-mgma", "MGMA Scorecard", appRoutePath("executive-mgma")),
      link("eo-analytics", "Enterprise Analytics", appRoutePath("analytics")),
      link(
        "eo-corporate-continuum",
        "Corporate and Continuum Operations",
        appRoutePath("corporate-operations"),
      ),
      group("eo-human-resources", "Human Resources", Users, [
        group("eo-workforce-activation", "Workforce Activation", Users, [
          link("eo-recruitment", "Recruitment", appRoutePath("hr-recruitment")),
          link("eo-screening", "Screening", appRoutePath("hr-screening")),
          link("eo-offers", "Offers", appRoutePath("hr-offers")),
          link("eo-orientation", "Orientation", appRoutePath("hr-orientation")),
          link(
            "eo-onboarding",
            "Onboarding",
            appRoutePath("hr-onboarding-workflow"),
          ),
          link("eo-clearance", "Clearance", appRoutePath("hr-clearance")),
        ]),
        group("eo-workforce-management", "Workforce Management", Users, [
          link(
            "eo-personnel-files",
            "Personnel Files",
            appDeepLinkPath("hr-personnel-files"),
          ),
          link(
            "eo-credentials",
            "Credentials",
            appRoutePath("hr-credentials-tracker"),
          ),
          link(
            "eo-performance",
            "Performance",
            appRoutePath("hr-performance-reviews"),
          ),
          link("eo-hr-compliance", "Compliance", appRoutePath("hr-compliance")),
          link("eo-separation", "Separation", appRoutePath("hr-separations")),
        ]),
      ]),
      link(
        "eo-quality-compliance",
        "Quality and Compliance",
        appRoutePath("qa"),
      ),
      link("eo-revenue-cycle", "Revenue Cycle", appRoutePath("revenue")),
      group(
        "eo-knowledge-documents",
        "Knowledge and Documents",
        LayoutDashboard,
        [
          link(
            "eo-document-studio",
            "Document Studio",
            appRoutePath("documents"),
          ),
          link("eo-knowledge", "Knowledge and SOP", appRoutePath("knowledge")),
          link(
            "eo-document-intelligence",
            "Document Intelligence",
            appRoutePath("knowledge-document-intelligence"),
          ),
        ],
      ),
    ],
    { division: "eo" },
  ),
  group(
    "system-administration",
    "System Administration",
    Settings,
    [
      link(
        "admin-organization",
        "Organization and Roles",
        appRoutePath("admin-organization"),
      ),
      link(
        "admin-access-recovery",
        "Account Recovery",
        appRoutePath("admin-access-recovery"),
      ),
      link("admin-settings", "System Settings", appRoutePath("admin-settings")),
      link(
        "admin-microsoft-integration",
        "Microsoft 365 and Entra Integrations",
        appRoutePath("operations-hub-microsoft-integrations"),
      ),
      link(
        "admin-workflows",
        "Workflow Configuration",
        appRoutePath("admin-workflow"),
        appRoutePath("admin-workflows"),
      ),
      link("admin-intelligence", "AMOS Intelligence/NIL", appRoutePath("nil")),
      link(
        "admin-mobile",
        "Mobile and Offline Configuration",
        appRoutePath("operations-hub-mobile-offline"),
      ),
      link(
        "admin-enhancements",
        "Enhancement Register",
        appRoutePath("admin-enhancements"),
      ),
      link(
        "admin-demo-tools",
        "Demo Tools",
        appRoutePath("operations-hub-enterprise-demo"),
        appRoutePath("operations-hub-enterprise-demo"),
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
    !authorizeClientRoute(role, appRoutePath("admin-settings")).allowed
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
