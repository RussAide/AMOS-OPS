// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runtimeConfig } from "@/config/runtime";

const authHarness = vi.hoisted(() => ({
  me: {
    data: null as Record<string, unknown> | null,
    isLoading: false,
    isFetched: false,
    isError: false,
  },
  invalidate: vi.fn(),
  login: vi.fn(),
  register: vi.fn(),
  evaluationSession: vi.fn(),
  logout: vi.fn(),
  verifyMfa: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
}));

vi.mock("@/providers/trpc", () => ({
  trpc: {
    useUtils: () => ({ invalidate: authHarness.invalidate }),
    auth: {
      me: { useQuery: () => authHarness.me },
      login: { useMutation: () => ({ mutateAsync: authHarness.login }) },
      register: {
        useMutation: () => ({ mutateAsync: authHarness.register }),
      },
      evaluationSession: {
        useMutation: () => ({ mutateAsync: authHarness.evaluationSession }),
      },
      logout: { useMutation: () => ({ mutate: authHarness.logout }) },
      verifyMfa: {
        useMutation: () => ({ mutateAsync: authHarness.verifyMfa }),
      },
      requestPasswordReset: {
        useMutation: () => ({
          mutateAsync: authHarness.requestPasswordReset,
        }),
      },
      resetPassword: {
        useMutation: () => ({ mutateAsync: authHarness.resetPassword }),
      },
    },
  },
}));

import { AuthProvider, useAuth } from "@/hooks/use-auth";

const syntheticUser = {
  id: "synthetic-session-reviewer",
  email: "session-reviewer@amos-ops.invalid",
  firstName: "Synthetic",
  lastName: "Session Reviewer",
  name: "Synthetic Session Reviewer",
  role: "case-manager",
  department: "MHTCM",
  mfaEnabled: true,
  accessStatus: "cleared" as const,
  identityType: "workforce" as const,
  trainingAccess: true,
  sponsorName: null,
  accessExpiresAt: null,
  dataScope: "operational" as const,
};

function syntheticToken(label: string): string {
  return ["synthetic", "session", label].join("-");
}

function SessionProbe() {
  const auth = useAuth();
  const [actionError, setActionError] = useState("");
  return (
    <section>
      <output data-testid="session-state">
        {auth.isAuthenticated
          ? `authenticated:${auth.currentRole}:${auth.user?.email}`
          : "anonymous"}
      </output>
      <button
        type="button"
        onClick={() => {
          void auth
            .login("session-reviewer@amos-ops.invalid", "synthetic-password")
            .catch((error: unknown) =>
              setActionError(error instanceof Error ? error.message : "error"),
            );
        }}
      >
        Login
      </button>
      <button type="button" onClick={auth.logout}>
        Logout
      </button>
      <output data-testid="action-error">{actionError}</output>
    </section>
  );
}

function renderSessionProbe() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <SessionProbe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("PF-12 hydrated Production session lifecycle", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllMocks();
    Object.assign(authHarness.me, {
      data: null,
      isLoading: false,
      isFetched: false,
      isError: false,
    });
    Object.assign(runtimeConfig, {
      initialized: true,
      mode: "production",
      appEnvironment: "production",
      environmentId: "amos-ops-production-session-matrix",
      evaluationMode: false,
    });
    authHarness.login.mockResolvedValue({
      status: "authenticated",
      token: "synthetic-session-token-b",
      user: syntheticUser,
    });
    authHarness.register.mockResolvedValue({});
    authHarness.evaluationSession.mockRejectedValue(
      new Error("Synthetic evaluation access is unavailable."),
    );
    authHarness.verifyMfa.mockResolvedValue({});
    authHarness.requestPasswordReset.mockResolvedValue({ accepted: true });
    authHarness.resetPassword.mockResolvedValue({ totpSetup: null });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it("rehydrates a verified session after a browser refresh", async () => {
    localStorage.setItem("amos_token", syntheticToken("token-a"));
    localStorage.setItem("amos-role", syntheticUser.role);
    localStorage.setItem("amos-workspace", "operational");
    Object.assign(authHarness.me, {
      data: syntheticUser,
      isFetched: true,
    });

    renderSessionProbe();

    expect((await screen.findByTestId("session-state")).textContent).toBe(
      "authenticated:case-manager:session-reviewer@amos-ops.invalid",
    );
    expect(localStorage.getItem("amos_token")).toBe(
      syntheticToken("token-a"),
    );
  });

  it("logs out locally, then establishes a new login session without recovery", async () => {
    localStorage.setItem("amos_token", syntheticToken("token-a"));
    Object.assign(authHarness.me, {
      data: syntheticUser,
      isFetched: true,
    });
    renderSessionProbe();

    fireEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() =>
      expect(screen.getByTestId("session-state").textContent).toBe("anonymous"),
    );
    expect(authHarness.logout).toHaveBeenCalledOnce();
    expect(localStorage.getItem("amos_token")).toBeNull();

    Object.assign(authHarness.me, { data: null, isFetched: false });
    fireEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() =>
      expect(screen.getByTestId("session-state").textContent).toBe(
        "authenticated:case-manager:session-reviewer@amos-ops.invalid",
      ),
    );
    expect(localStorage.getItem("amos_token")).toBe(
      "synthetic-session-token-b",
    );
    expect(screen.getByTestId("action-error").textContent).toBe("");
  });

  it.each([
    ["expired or revoked", false, true],
    ["revalidation failure", true, true],
  ])("fails closed for a %s session", async (_label, hasUser, isError) => {
    localStorage.setItem("amos_token", syntheticToken("invalid"));
    localStorage.setItem("amos-role", syntheticUser.role);
    localStorage.setItem("amos-workspace", "operational");
    Object.assign(authHarness.me, {
      data: hasUser ? syntheticUser : null,
      isFetched: true,
      isError,
    });

    renderSessionProbe();

    await waitFor(() => expect(localStorage.getItem("amos_token")).toBeNull());
    expect(screen.getByTestId("session-state").textContent).toBe("anonymous");
    expect(localStorage.getItem("amos-role")).toBeNull();
    expect(localStorage.getItem("amos-workspace")).toBeNull();
  });
});
