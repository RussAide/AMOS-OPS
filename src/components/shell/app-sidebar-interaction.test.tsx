// @vitest-environment jsdom

import type { ReactNode } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
  type SidebarNavNode,
} from "@/data/sidebar-navigation";
import { AppSidebar } from "./app-sidebar";

vi.mock("@/hooks/use-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-auth")>();
  const currentRole = "super-admin" as const;
  return {
    ...actual,
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => ({
      user: {
        id: "synthetic-sidebar-reviewer",
        email: "sidebar-reviewer@amos-ops.invalid",
        firstName: "Synthetic",
        lastName: "Sidebar Reviewer",
        name: "Synthetic Sidebar Reviewer",
        role: currentRole,
        department: "Quality Assurance",
        mfaEnabled: true,
        accessStatus: "cleared",
        identityType: "workforce",
        trainingAccess: true,
        sponsorName: null,
        accessExpiresAt: null,
        dataScope: "operational",
      },
      isLoading: false,
      isAuthenticated: true,
      login: async () => null,
      completeMfa: async () => undefined,
      register: async () => null,
      requestPasswordReset: async () => ({ accepted: true as const }),
      resetPassword: async () => null,
      enterEvaluation: async () => undefined,
      logout: () => undefined,
      currentRole,
      permissions: actual.getPermissions(currentRole),
      navVisibility: actual.getNavVisibility(currentRole),
      setRole: () => undefined,
      getRoleDef: () => actual.getRoleDef(currentRole),
      loginError: null,
      workspace: "operational",
      canSwitchWorkspace: true,
      setWorkspace: () => undefined,
    }),
  };
});

afterEach(cleanup);

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="current-path">{location.pathname}</output>;
}

async function expandGroups(
  user: ReturnType<typeof userEvent.setup>,
  nodes: readonly SidebarNavNode[],
): Promise<void> {
  for (const node of nodes) {
    if (node.type !== "group") continue;
    const label = screen.getByText(node.label, { selector: "span" });
    const button = label.closest("button");
    expect(button).not.toBeNull();
    if (button?.getAttribute("aria-expanded") !== "true") {
      await user.click(button!);
    }
    expect(button?.getAttribute("aria-expanded")).toBe("true");
    await expandGroups(user, node.children);
  }
}

describe("production sidebar branch and link interactions", () => {
  it.each([
    { surface: "desktop", mobile: false },
    { surface: "mobile", mobile: true },
  ])(
    "expands every branch and routes every nested link on $surface",
    async ({ mobile }) => {
      const navigation = getSidebarNavigation("super-admin", "production");
      const user = userEvent.setup();
      const navigationEvents: string[] = [];
      render(
        <MemoryRouter initialEntries={["/navigation-integrity-review"]}>
          <AppSidebar
            mobile={mobile}
            onNavigate={() => navigationEvents.push("navigated")}
          />
          <LocationProbe />
        </MemoryRouter>,
      );

      await expandGroups(user, navigation);

      const sidebar = screen.getByRole("complementary");
      for (const link of flattenSidebarLinks(navigation)) {
        const button = within(sidebar).getByRole("button", {
          name: link.label,
        });
        await user.click(button);
        expect(screen.getByTestId("current-path").textContent).toBe(link.href);
        expect(button.getAttribute("aria-current")).toBe("page");
      }
      expect(navigationEvents).toHaveLength(
        flattenSidebarLinks(navigation).length,
      );
    },
    30_000,
  );
});
