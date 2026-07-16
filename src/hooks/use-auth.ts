import {
  createContext,
  createElement,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import { EVALUATION_SESSION_TOKEN, runtimeConfig } from "@/config/runtime";
import {
  type UserRole,
  type RoleDef,
  type Permissions,
  ROLE_DEFINITIONS,
  getRoleDef,
  getPermissions,
  getNavVisibility,
} from "@/constants/roles";
import { shouldInvalidateSession } from "@/security/session-state";

export type { UserRole, RoleDef, Permissions } from "@/constants/roles";
export {
  ROLE_DEFINITIONS,
  PERMISSION_MATRIX,
  ROLE_NAV_VISIBILITY,
  getRoleDef,
  getPermissions,
  getNavVisibility,
  isAdmin,
  canManageUsers,
} from "@/constants/roles";

// ─── Unified Auth Types ──────────────────────────────────────

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  role: string;
  department: string | null;
  mfaEnabled: boolean;
  accessStatus: "training" | "cleared" | "suspended" | "deactivated";
  identityType: "workforce" | "external_guest";
  trainingAccess: boolean;
  sponsorName: string | null;
  accessExpiresAt: string | null;
  dataScope: "training" | "operational";
}

export interface MfaPrompt {
  challengeId: string;
  destination: string;
  expiresAt: string;
  evaluationCode?: string;
}

export interface PasswordResetPrompt {
  accepted: true;
  evaluationToken?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<MfaPrompt | null>;
  completeMfa: (challengeId: string, code: string) => Promise<void>;
  register: (data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    department?: string;
  }) => Promise<MfaPrompt | null>;
  requestPasswordReset: (email: string) => Promise<PasswordResetPrompt>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  enterEvaluation: () => Promise<void>;
  logout: () => void;
  // Role/permission system
  currentRole: UserRole;
  permissions: Permissions;
  navVisibility: Record<string, boolean>;
  setRole: (role: UserRole) => void;
  getRoleDef: () => RoleDef;
  loginError: string | null;
  workspace: "training" | "operational";
  canSwitchWorkspace: boolean;
  setWorkspace: (workspace: "training" | "operational") => void;
}

// ─── Role-Based Post-Login Redirect Mapping ──────────────────

function getRoleRedirectPath(role: string): string {
  switch (role) {
    case "treatment-director":
    case "clinical-director":
    case "qmhp-cs":
    case "case-manager":
    case "therapist":
    case "nurse":
    case "clinical-supervisor":
    case "bhc-director":
    case "mhtcm-supervisor":
    case "mhrs-supervisor":
    case "intake-coordinator":
    case "bhc-front-desk":
      return "/clinical";
    case "ccmg-program-director":
      return "/ccmg";
    case "gro-administrator":
    case "program-director":
    case "shift-supervisor":
    case "rcs-lead":
    case "rcs-day":
    case "rcs-night":
    case "rcs-prn":
    case "youth-care-worker":
    case "behavioral-support":
    case "crisis-intervention-specialist":
    case "recreation-coordinator":
    case "medication-aide":
    case "family-liaison":
      return "/gro";
    case "hr-director":
    case "hr-compliance-officer":
      return "/hr";
    case "chart-auditor":
      return "/qa";
    case "super-admin":
    case "administrator":
    case "managing-director":
    default:
      return "/";
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

const EVALUATION_USER: AuthUser = {
  id: "eval-u1",
  email: "evaluator@amos-ops.invalid",
  firstName: "AMOS",
  lastName: "Evaluator",
  name: "AMOS Evaluator",
  role: "rcs-day",
  department: "Evaluation",
  mfaEnabled: false,
  accessStatus: "training",
  identityType: "external_guest",
  trainingAccess: true,
  sponsorName: "AMOS evaluation",
  accessExpiresAt: null,
  dataScope: "training",
};

function isKnownRole(role: string): role is UserRole {
  return ROLE_DEFINITIONS.some((definition) => definition.id === role);
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const trpcUtils = trpc.useUtils();

  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = localStorage.getItem("amos_token");
    if (storedToken === "demo-token") {
      localStorage.removeItem("amos_token");
      localStorage.removeItem("amos-role");
      return null;
    }
    if (
      storedToken === EVALUATION_SESSION_TOKEN &&
      !runtimeConfig.evaluationMode
    ) {
      localStorage.removeItem("amos_token");
      localStorage.removeItem("amos-role");
      return null;
    }
    return storedToken;
  });
  const [loginError, setLoginError] = useState<string | null>(null);
  const [workspace, setWorkspaceState] = useState<"training" | "operational">(
    () =>
      localStorage.getItem("amos-workspace") === "training"
        ? "training"
        : "operational",
  );
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const stored = localStorage.getItem("amos-role");
    return runtimeConfig.evaluationMode && stored && isKnownRole(stored)
      ? stored
      : "rcs-day";
  });

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const evaluationSessionMutation = trpc.auth.evaluationSession.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const verifyMfaMutation = trpc.auth.verifyMfa.useMutation();
  const requestPasswordResetMutation =
    trpc.auth.requestPasswordReset.useMutation();
  const resetPasswordMutation = trpc.auth.resetPassword.useMutation();
  const isEvaluationSession =
    runtimeConfig.evaluationMode && token === EVALUATION_SESSION_TOKEN;

  const clearLocalSession = useCallback(() => {
    localStorage.removeItem("amos_token");
    localStorage.removeItem("amos-role");
    localStorage.removeItem("amos-workspace");
    setToken(null);
    setUser(null);
    setCurrentRole("rcs-day");
  }, []);

  // Check token on mount
  const {
    data: meData,
    isLoading: meLoading,
    isFetched: meFetched,
    isError: meError,
  } = trpc.auth.me.useQuery(undefined, {
    enabled: !!token && !isEvaluationSession,
    retry: false,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const verifiedUser =
    meData && isKnownRole(meData.role) ? (meData as AuthUser) : null;

  useEffect(() => {
    if (
      shouldInvalidateSession({
        hasToken: !!token,
        evaluationSession: isEvaluationSession,
        isFetched: meFetched,
        isError: meError,
        hasVerifiedUser: !!verifiedUser,
      })
    ) {
      const clearTimer = window.setTimeout(clearLocalSession, 0);
      return () => window.clearTimeout(clearTimer);
    }
    return undefined;
  }, [
    clearLocalSession,
    isEvaluationSession,
    meError,
    meFetched,
    token,
    verifiedUser,
  ]);

  const evaluationUser = useMemo<AuthUser>(() => {
    const definition = getRoleDef(currentRole);
    return {
      ...EVALUATION_USER,
      firstName: "Synthetic",
      lastName: definition.label,
      name: `Synthetic ${definition.label}`,
      role: currentRole,
      department: definition.department,
    };
  }, [currentRole]);
  const effectiveUser = isEvaluationSession
    ? evaluationUser
    : (verifiedUser ?? (!meFetched ? user : null));
  const effectiveRole =
    !isEvaluationSession && effectiveUser && isKnownRole(effectiveUser.role)
      ? effectiveUser.role
      : currentRole;
  const isLoading = !!token && !isEvaluationSession && meLoading;
  const canSwitchWorkspace = Boolean(
    effectiveUser?.accessStatus === "cleared" && effectiveUser.trainingAccess,
  );
  const effectiveWorkspace =
    effectiveUser?.accessStatus === "training"
      ? "training"
      : canSwitchWorkspace
        ? workspace
        : "operational";

  useEffect(() => {
    if (!effectiveUser) return;
    localStorage.setItem("amos-workspace", effectiveWorkspace);
  }, [effectiveUser, effectiveWorkspace]);

  const setWorkspace = useCallback(
    (nextWorkspace: "training" | "operational") => {
      if (
        nextWorkspace === "training" &&
        !canSwitchWorkspace &&
        effectiveUser?.accessStatus !== "training"
      )
        return;
      if (
        nextWorkspace === "operational" &&
        effectiveUser?.accessStatus !== "cleared"
      )
        return;
      localStorage.setItem("amos-workspace", nextWorkspace);
      setWorkspaceState(nextWorkspace);
      void trpcUtils.invalidate();
    },
    [canSwitchWorkspace, effectiveUser?.accessStatus, trpcUtils],
  );

  const establishSession = useCallback(
    (result: { token: string; user: AuthUser }) => {
      if (
        result.token === EVALUATION_SESSION_TOKEN &&
        !runtimeConfig.evaluationMode
      ) {
        throw new Error("Evaluation access is not enabled.");
      }
      if (!isKnownRole(result.user.role)) {
        throw new Error("The account has an unrecognized role assignment.");
      }
      localStorage.setItem("amos_token", result.token);
      localStorage.setItem("amos-role", result.user.role);
      const initialWorkspace =
        result.user.accessStatus === "training" ? "training" : "operational";
      localStorage.setItem("amos-workspace", initialWorkspace);
      setToken(result.token);
      setUser(result.user);
      setCurrentRole(result.user.role);
      setWorkspaceState(initialWorkspace);
      navigate(getRoleRedirectPath(result.user.role), { replace: true });
    },
    [navigate],
  );

  const login = useCallback(
    async (email: string, password: string): Promise<MfaPrompt | null> => {
      setLoginError(null);
      try {
        const result = await loginMutation.mutateAsync({ email, password });
        if (result.status === "mfa_required") {
          clearLocalSession();
          return {
            challengeId: result.challengeId,
            destination: result.destination,
            expiresAt: result.expiresAt,
            ...(result.evaluationCode
              ? { evaluationCode: result.evaluationCode }
              : {}),
          };
        }
        if (!result.token || !result.user) {
          throw new Error(
            "The authentication service returned an incomplete response.",
          );
        }
        establishSession({
          token: result.token,
          user: result.user as AuthUser,
        });
        return null;
      } catch (error: unknown) {
        clearLocalSession();
        const message = errorMessage(error, "Login failed.");
        setLoginError(message);
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [clearLocalSession, establishSession, loginMutation],
  );

  const completeMfa = useCallback(
    async (challengeId: string, code: string) => {
      setLoginError(null);
      try {
        const result = await verifyMfaMutation.mutateAsync({
          challengeId,
          code,
        });
        establishSession({
          token: result.token,
          user: result.user as AuthUser,
        });
      } catch (error: unknown) {
        clearLocalSession();
        const message = errorMessage(error, "Verification failed.");
        setLoginError(message);
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [clearLocalSession, establishSession, verifyMfaMutation],
  );

  const register = useCallback(
    async (data: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
      department?: string;
    }): Promise<MfaPrompt | null> => {
      setLoginError(null);
      try {
        const result = await registerMutation.mutateAsync(data);
        if (result.status === "mfa_required") {
          clearLocalSession();
          return {
            challengeId: result.challengeId,
            destination: result.destination,
            expiresAt: result.expiresAt,
            ...(result.evaluationCode
              ? { evaluationCode: result.evaluationCode }
              : {}),
          };
        }
        if (!result.token || !result.user) {
          throw new Error(
            "The registration service returned an incomplete response.",
          );
        }
        establishSession({
          token: result.token,
          user: result.user as AuthUser,
        });
        return null;
      } catch (error: unknown) {
        clearLocalSession();
        const message = errorMessage(error, "Registration failed.");
        setLoginError(message);
        throw error instanceof Error ? error : new Error(message);
      }
    },
    [clearLocalSession, establishSession, registerMutation],
  );

  const enterEvaluation = useCallback(async () => {
    setLoginError(null);
    try {
      const result = await evaluationSessionMutation.mutateAsync({
        role: "administrator",
      });
      establishSession({
        token: result.token,
        user: result.user as AuthUser,
      });
    } catch (error: unknown) {
      clearLocalSession();
      const message = errorMessage(
        error,
        "Synthetic evaluation access is unavailable.",
      );
      setLoginError(message);
      throw error instanceof Error ? error : new Error(message);
    }
  }, [clearLocalSession, establishSession, evaluationSessionMutation]);

  const requestPasswordReset = useCallback(
    async (email: string): Promise<PasswordResetPrompt> => {
      const result = await requestPasswordResetMutation.mutateAsync({ email });
      return {
        accepted: true,
        ...(result.evaluationToken
          ? { evaluationToken: result.evaluationToken }
          : {}),
      };
    },
    [requestPasswordResetMutation],
  );

  const resetPassword = useCallback(
    async (resetToken: string, newPassword: string) => {
      await resetPasswordMutation.mutateAsync({
        token: resetToken,
        newPassword,
      });
      clearLocalSession();
    },
    [clearLocalSession, resetPasswordMutation],
  );

  const logout = useCallback(() => {
    if (token && token !== EVALUATION_SESSION_TOKEN) logoutMutation.mutate();
    clearLocalSession();
  }, [clearLocalSession, token, logoutMutation]);

  const setRole = useCallback((role: UserRole) => {
    if (!runtimeConfig.evaluationMode) return;
    setCurrentRole(role);
    localStorage.setItem("amos-role", role);
  }, []);

  const getRoleDefFn = useCallback(() => {
    return getRoleDef(effectiveRole);
  }, [effectiveRole]);

  const permissions = useMemo(
    () => getPermissions(effectiveRole),
    [effectiveRole],
  );
  const navVisibility = useMemo(
    () => getNavVisibility(effectiveRole),
    [effectiveRole],
  );

  const value: AuthContextValue = {
    user: effectiveUser,
    isLoading,
    isAuthenticated: !!effectiveUser && !!token,
    login,
    completeMfa,
    register,
    requestPasswordReset,
    resetPassword,
    enterEvaluation,
    logout,
    currentRole: effectiveRole,
    permissions,
    navVisibility,
    setRole,
    getRoleDef: getRoleDefFn,
    loginError,
    workspace: effectiveWorkspace,
    canSwitchWorkspace,
    setWorkspace,
  };

  return createElement(AuthContext.Provider, { value }, children);
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
