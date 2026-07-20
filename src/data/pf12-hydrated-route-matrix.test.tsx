// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { runtimeConfig } from "@/config/runtime";
import { authorizeClientRoute } from "@/constants/access-control";
import {
  getNavVisibility,
  getPermissions,
  getRoleDef,
  type UserRole,
} from "@/constants/roles";

const routeHarness = vi.hoisted(() => ({
  role: "super-admin" as string,
}));

vi.mock("@/hooks/use-auth", () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => {
    const role = routeHarness.role as UserRole;
    const definition = getRoleDef(role);
    return {
      user: {
        id: `synthetic-${role}`,
        email: `${role}@amos-ops.invalid`,
        firstName: "Synthetic",
        lastName: definition.label,
        name: `Synthetic ${definition.label}`,
        role,
        department: definition.department,
        mfaEnabled: true,
        accessStatus: "cleared" as const,
        identityType: "workforce" as const,
        trainingAccess: false,
        sponsorName: null,
        accessExpiresAt: null,
        dataScope: "operational" as const,
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
      currentRole: role,
      permissions: getPermissions(role),
      navVisibility: getNavVisibility(role),
      setRole: () => undefined,
      getRoleDef: () => definition,
      loginError: null,
      workspace: "operational" as const,
      canSwitchWorkspace: false,
      setWorkspace: () => undefined,
    };
  },
}));

const failedQuery = Object.freeze({
  data: undefined,
  error: new Error("PF12_CONTROLLED_QUERY_FAILURE"),
  isError: true,
  isLoading: false,
  isPending: false,
  isFetching: false,
  refetch: vi.fn(),
});
const mutation = Object.freeze({
  data: undefined,
  error: null,
  isError: false,
  isPending: false,
  mutate: vi.fn(),
  mutateAsync: vi.fn(),
  reset: vi.fn(),
});

function trpcBranch(): unknown {
  return new Proxy(() => undefined, {
    get: (_target, property) => {
      if (property === "useQuery") return () => failedQuery;
      if (property === "useMutation") return () => mutation;
      return trpcBranch();
    },
  });
}

const utilsBranch = new Proxy(
  {},
  {
    get: () => new Proxy({}, { get: () => vi.fn() }),
  },
);

vi.mock("@/providers/trpc", () => ({
  trpc: new Proxy(
    {},
    {
      get: (_target, property) =>
        property === "useUtils" ? () => utilsBranch : trpcBranch(),
    },
  ),
  TRPCProvider: ({ children }: { children: ReactNode }) => children,
}));

function installBrowserPrimitives() {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined,
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      observe() {
        return undefined;
      }
      unobserve() {
        return undefined;
      }
      disconnect() {
        return undefined;
      }
    },
  });
}

function renderRoute(role: UserRole, path: string) {
  routeHarness.role = role;
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("PF-12 hydrated Production role and route matrix", () => {
  beforeAll(() => {
    installBrowserPrimitives();
    Object.assign(runtimeConfig, {
      initialized: true,
      mode: "production",
      appEnvironment: "production",
      environmentId: "amos-ops-production-route-matrix",
      evaluationMode: false,
      productionReleaseAuthorized: true,
      productionReleaseId: "PF12-SYNTHETIC-ROUTE-MATRIX",
      deploymentPosture: "live",
      reviewDeployment: false,
      safeguards: {
        syntheticDataOnly: false,
        evaluationFallbacksAllowed: false,
        productionDataAllowed: true,
        externalWritesAllowed: false,
      },
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it.each([
    ["super-admin", "/admin/settings", true],
    ["rcs-day", "/admin/settings", false],
    ["hr-director", "/hr/personnel-files", true],
    ["shift-supervisor", "/hr/personnel-files", false],
    ["case-manager", "/mhtcm", true],
    ["therapist", "/mhtcm", false],
    ["mhrs-supervisor", "/mhrs", true],
    ["billing-specialist", "/mhrs", false],
    ["shift-supervisor", "/gro/residential-operations", true],
    ["bhc-front-desk", "/gro/residential-operations", false],
  ] as const)(
    "%s receives the expected decision for %s",
    (role, path, allowed) => {
      expect(authorizeClientRoute(role, path).allowed).toBe(allowed);
    },
  );

  it("hydrates an allowed MHTCM deep link without synthetic substitution", () => {
    const view = renderRoute("case-manager", "/mhtcm");
    expect(view.container.querySelector("main")).not.toBeNull();
    expect(screen.queryByText("Access denied")).toBeNull();
    expect(
      screen.getByText("MHTCM operational data could not be loaded"),
    ).not.toBeNull();
    expect(view.container.textContent).toContain(
      "No cached or demonstration records were substituted",
    );
    expect(view.container.textContent).not.toContain("Synthetic Youth");
  });

  it("hydrates an allowed MHRS deep link without synthetic substitution", () => {
    const view = renderRoute("mhrs-supervisor", "/mhrs");
    expect(view.container.querySelector("main")).not.toBeNull();
    expect(screen.queryByText("Access denied")).toBeNull();
    expect(
      screen.getByText("MHRS operational data could not be loaded"),
    ).not.toBeNull();
    expect(view.container.textContent).toContain(
      "No cached or demonstration records were substituted",
    );
    expect(view.container.textContent).not.toContain("Synthetic Youth");
  });

  it("keeps a denied deep link denied after a browser-style refresh", () => {
    const first = renderRoute("rcs-day", "/admin/settings");
    expect(screen.getByText("Access denied")).not.toBeNull();
    expect(first.container.textContent).not.toContain(
      "Identity Administration",
    );
    first.unmount();

    const refreshed = renderRoute("rcs-day", "/admin/settings");
    expect(screen.getByText("Access denied")).not.toBeNull();
    expect(refreshed.container.textContent).not.toContain(
      "Identity Administration",
    );
  });

  it("rehydrates the same nonblank operational deep link after refresh", () => {
    const first = renderRoute("mhrs-supervisor", "/mhrs");
    const firstText = first.container.querySelector("main")?.textContent;
    expect(firstText?.trim().length ?? 0).toBeGreaterThan(0);
    first.unmount();

    const refreshed = renderRoute("mhrs-supervisor", "/mhrs");
    const refreshedText =
      refreshed.container.querySelector("main")?.textContent;
    expect(refreshedText?.trim().length ?? 0).toBeGreaterThan(0);
    expect(refreshedText).toContain(
      "MHRS operational data could not be loaded",
    );
  });
});
