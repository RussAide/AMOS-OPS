import { describe, expect, it } from "vitest";
import { authorizeClientRoute } from "@/constants/access-control";
import { ALL_ROLES } from "@/constants/roles";
import { navItems } from "@/data/navData";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
  type SidebarNavNode,
} from "@/data/sidebar-navigation";

function groupLabels(nodes: readonly SidebarNavNode[]): string[] {
  return nodes.flatMap((node) =>
    node.type === "group"
      ? [node.label, ...groupLabels(node.children)]
      : [],
  );
}

type NavigationShape = string | { label: string; children: NavigationShape[] };

function navigationShape(nodes: readonly SidebarNavNode[]): NavigationShape[] {
  return nodes.map((node) =>
    node.type === "link"
      ? node.label
      : { label: node.label, children: navigationShape(node.children) },
  );
}

describe("department-grouped sidebar navigation", () => {
  it("presents the approved top-level workspace structure", () => {
    const navigation = getSidebarNavigation("super-admin", "production");

    expect(navigation.map((node) => node.label)).toEqual([
      "Home",
      "My Work",
      "Behavioral Health Center",
      "General Residential Operations",
      "General Administration",
      "Executive Office",
      "System Administration",
    ]);
  });

  it("implements the complete approved production hierarchy", () => {
    expect(
      navigationShape(getSidebarNavigation("super-admin", "production")),
    ).toEqual([
      {
        label: "Home",
        children: [
          "Enterprise Overview",
          "Alerts and priorities",
          "Division status",
          "Quick actions",
        ],
      },
      {
        label: "My Work",
        children: [
          "Today’s work",
          "Assigned tasks",
          "Items requiring attention",
          "Calendar and deadlines",
          "Recent activity",
        ],
      },
      {
        label: "Behavioral Health Center",
        children: [
          "BHC Dashboard",
          {
            label: "CCMG",
            children: [
              "Oversight",
              "Referrals and Intake",
              "CANS/TRR Assessments",
              "Medication and quality coordination",
            ],
          },
          {
            label: "MHTCM",
            children: [
              "Case Management",
              "Care Coordination",
              "Referrals, discharge and aftercare",
            ],
          },
          {
            label: "MHRS",
            children: [
              "Program Operations",
              "Service Delivery",
              "Clinical Sessions",
              "Outcomes",
            ],
          },
          {
            label: "Shared Clinical Services",
            children: [
              "Treatment Plans",
              "Insurance and Authorization",
              "Clinical Intelligence",
            ],
          },
        ],
      },
      {
        label: "General Residential Operations",
        children: [
          "GRO Dashboard",
          {
            label: "Shift Operations",
            children: ["Shift Logs", "Care Logs", "Shift Handoffs"],
          },
          {
            label: "Safety and Supervision",
            children: ["Safety Rounds", "Youth Supervision", "Incidents"],
          },
        ],
      },
      {
        label: "General Administration",
        children: [
          "GAD Dashboard",
          "Facilities and Work Orders",
          "Procurement and Vendors",
          "Safety and Emergency Preparedness",
          "Transportation and Logistics",
          "Regulatory Support",
        ],
      },
      {
        label: "Executive Office",
        children: [
          "Executive Dashboard",
          "Decision Intelligence",
          "Strategic Projects",
          "MGMA Scorecard",
          "Enterprise Analytics",
          "Corporate and Continuum Operations",
          {
            label: "Human Resources",
            children: [
              {
                label: "Workforce Activation",
                children: [
                  "Recruitment",
                  "Screening",
                  "Offers",
                  "Orientation",
                  "Onboarding",
                  "Clearance",
                ],
              },
              {
                label: "Workforce Management",
                children: [
                  "Personnel Files",
                  "Credentials",
                  "Performance",
                  "Compliance",
                  "Separation",
                ],
              },
            ],
          },
          "Quality and Compliance",
          "Revenue Cycle",
          {
            label: "Knowledge and Documents",
            children: [
              "Document Studio",
              "Knowledge and SOP",
              "Document Intelligence",
            ],
          },
        ],
      },
      {
        label: "System Administration",
        children: [
          "Organization and Roles",
          "System Settings",
          "Microsoft 365 and Entra Integrations",
          "Workflow Configuration",
          "AMOS Intelligence/NIL",
          "Mobile and Offline Configuration",
          "Enhancement Register",
        ],
      },
    ]);
  });

  it("consolidates repeated HR and workflow destinations without deleting routes", () => {
    const productionLinks = flattenSidebarLinks(
      getSidebarNavigation("super-admin", "production"),
    );
    const productionHrefs = productionLinks.map((link) => link.href);
    const routeInventory = navItems.map((item) => item.href);

    expect(productionHrefs).toContain("/workflows/my-work-today");
    expect(productionHrefs).toContain("/hr/credentials-tracker");
    expect(productionHrefs).toContain("/hr/performance-reviews");
    expect(productionHrefs).toContain("/hr/separations");
    expect(productionHrefs).not.toContain("/hr/credentials");
    expect(productionHrefs).not.toContain("/hr/performance");
    expect(productionHrefs).not.toContain("/hr/separation");

    expect(routeInventory).toContain("/hr/credentials");
    expect(routeInventory).toContain("/hr/performance");
    expect(routeInventory).toContain("/hr/separation");
  });

  it("shows demo tools only in demo mode", () => {
    const production = getSidebarNavigation("super-admin", "production");
    const demo = getSidebarNavigation("super-admin", "demo");

    expect(groupLabels(production)).not.toContain("Demo Tools");
    expect(
      flattenSidebarLinks(production).map((link) => link.href),
    ).not.toContain("/operations-hub/enterprise-demo");
    expect(flattenSidebarLinks(demo).map((link) => link.label)).toContain(
      "Demo Tools",
    );
    expect(flattenSidebarLinks(demo).map((link) => link.href)).toContain(
      "/operations-hub/enterprise-demo",
    );
  });

  it("keeps system administration out of frontline navigation", () => {
    const navigation = getSidebarNavigation("rcs-day", "production");
    expect(navigation.map((node) => node.label)).not.toContain(
      "System Administration",
    );
  });

  it("returns only explicitly authorized links for every canonical role", () => {
    for (const role of ALL_ROLES) {
      const links = flattenSidebarLinks(
        getSidebarNavigation(role, "production"),
      );
      for (const link of links) {
        expect(
          authorizeClientRoute(role, link.href).allowed,
          `${role} should be authorized for ${link.href}`,
        ).toBe(true);
      }
    }
  });

  it("uses unique link identifiers and destinations", () => {
    const links = flattenSidebarLinks(
      getSidebarNavigation("super-admin", "demo"),
    );
    expect(new Set(links.map((link) => link.id)).size).toBe(links.length);
    expect(new Set(links.map((link) => link.href)).size).toBe(links.length);
  });
});
