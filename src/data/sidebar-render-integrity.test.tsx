import { renderToStaticMarkup } from "react-dom/server";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeAll, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { runtimeConfig } from "@/config/runtime";
import {
  flattenSidebarLinks,
  getSidebarNavigation,
} from "@/data/sidebar-navigation";
import { TRPCProvider } from "@/providers/trpc";

vi.mock("@/hooks/use-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/use-auth")>();
  const currentRole = "super-admin" as const;
  const user = {
    id: "synthetic-navigation-reviewer",
    email: "navigation-reviewer@amos-ops.invalid",
    firstName: "Synthetic",
    lastName: "Navigation Reviewer",
    name: "Synthetic Navigation Reviewer",
    role: currentRole,
    department: "Quality Assurance",
    mfaEnabled: true,
    accessStatus: "cleared" as const,
    identityType: "workforce" as const,
    trainingAccess: true,
    sponsorName: null,
    accessExpiresAt: null,
    dataScope: "operational" as const,
  };

  return {
    ...actual,
    AuthProvider: ({ children }: { children: ReactNode }) => children,
    useAuth: () => ({
      user,
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
      workspace: "operational" as const,
      canSwitchWorkspace: true,
      setWorkspace: () => undefined,
    }),
  };
});

beforeAll(() => {
  Object.assign(runtimeConfig, {
    initialized: true,
    mode: "production",
    appEnvironment: "production",
    environmentId: "amos-ops-production-navigation-test",
    apiUrl: "http://127.0.0.1:9/api/trpc",
    evaluationMode: false,
    productionReleaseAuthorized: true,
    productionReleaseId: "AMOS-OPS-NAVIGATION-INTEGRITY-TEST",
    deploymentPosture: "live",
    reviewDeployment: false,
    candidateId: null,
    buildId: "synthetic-navigation-integrity-build",
    banner: "AMOS-OPS Operational Workspace",
    safeguards: {
      syntheticDataOnly: false,
      evaluationFallbacksAllowed: false,
      productionDataAllowed: true,
      externalWritesAllowed: true,
    },
  });
});

const sidebarLinks = flattenSidebarLinks(
  getSidebarNavigation("super-admin", "production"),
);

describe("production sidebar render integrity", () => {
  it.each(sidebarLinks)(
    "renders $label at $href through the canonical application shell",
    (link) => {
      const markup = renderToStaticMarkup(
        <TRPCProvider>
          <MemoryRouter initialEntries={[link.href]}>
            <App />
          </MemoryRouter>
        </TRPCProvider>,
      );

      expect(markup).toContain(`>${link.label}</span>`);
      expect(markup).toContain('aria-current="page"');
      expect(markup).not.toContain("Page not found");
      expect(markup).not.toContain("Access denied");
    },
  );
});
