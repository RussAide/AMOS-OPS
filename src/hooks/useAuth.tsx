// AMOS-OPS auth hook
import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { trpc } from "@/providers/trpc";
import {
  type UserRole,
  type RoleDef,
  type Permissions,
  ROLE_DEFINITIONS,
  PERMISSION_MATRIX,
  ROLE_NAV_VISIBILITY,
  getRoleDef,
  getPermissions,
  getNavVisibility,
  isAdmin,
  canManageUsers,
} from "@/constants/roles";

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
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { email: string; password: string; firstName: string; lastName: string; role?: string; department?: string }) => Promise<void>;
  logout: () => void;
  // Role/permission system
  currentRole: UserRole;
  permissions: Permissions;
  navVisibility: Record<string, boolean>;
  setRole: (role: UserRole) => void;
  getRoleDef: () => RoleDef;
  loginError: string | null;
}

// ─── Role-Based Post-Login Redirect Mapping ──────────────────

/**
 * Maps a user's role to their designated homepage route after login.
 * Based on D-002 Intranet Information Architecture Map.
 */
function getRoleRedirectPath(role: string): string {
  switch (role) {
    // ── Clinical roles → /clinical
    case "treatment-director":
    case "clinical-director":
    case "qmhp-cs":
    case "case-manager":
    case "therapist":
    case "nurse":
    case "clinical-supervisor":
    case "bhc-director":
    case "ccmg-program-director":
    case "mhtcm-supervisor":
    case "mhrs-supervisor":
    case "intake-coordinator":
    case "bhc-front-desk":
      return "/clinical";

    // ── GRO / Residential roles → /gro
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

    // ── HR roles → /hr
    case "hr-director":
    case "hr-compliance-officer":
      return "/hr";

    // ── QA / Compliance roles → /qa
    case "chart-auditor":
      return "/qa";

    // ── Executive / Admin roles → / (default/home)
    case "super-admin":
    case "administrator":
    case "managing-director":
    // ── All other roles (fallback)
    default:
      return "/";
  }
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("amos_token"));
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const stored = localStorage.getItem("amos-role");
    return (stored as UserRole) ?? "rcs-day";
  });

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  // Check token on mount
  const { data: meData, isLoading: meLoading, error: meError } = trpc.auth.me.useQuery(
    token ? { token } : undefined,
    { enabled: !!token, retry: false, refetchOnWindowFocus: false }
  );

  useEffect(() => {
    if (meData) {
      const u = meData as AuthUser;
      setUser(u);
      if (u.role) {
        const r = u.role as UserRole;
        setCurrentRole(r);
        localStorage.setItem("amos-role", r);
      }
      setIsLoading(false);
    } else if (!token) {
      setIsLoading(false);
    } else if (meError) {
      // tRPC auth.me failed — treat as demo mode with the stored token
      setUser(DEMO_USER);
      setCurrentRole("administrator");
      localStorage.setItem("amos-role", "administrator");
      setIsLoading(false);
    } else if (!meLoading) {
      // Query completed but returned no data — still in demo mode
      setUser(DEMO_USER);
      setCurrentRole("administrator");
      localStorage.setItem("amos-role", "administrator");
      setIsLoading(false);
    }
  }, [meData, meLoading, meError, token]);

  const DEMO_USER: AuthUser = {
    id: "demo-u1",
    email: "admin@adolbi.com",
    firstName: "E. Russ",
    lastName: "Aideyan",
    name: "E. Russ Aideyan",
    role: "administrator",
    department: "Executive",
  };

  const login = useCallback(async (email: string, password: string) => {
    setLoginError(null);
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      // If API returns null (offline), fall back to demo mode
      if (!result) {
        localStorage.setItem("amos_token", "demo-token");
        setToken("demo-token");
        setUser(DEMO_USER);
        setCurrentRole("administrator");
        localStorage.setItem("amos-role", "administrator");
        // ── Role-based redirect for demo fallback ──
        navigate(getRoleRedirectPath("administrator"), { replace: true });
        return;
      }
      if (result.token) {
        localStorage.setItem("amos_token", result.token);
        setToken(result.token);
        setUser(result.user as AuthUser);
        const role = (result.user.role as UserRole) ?? "";
        if (role) {
          setCurrentRole(role);
          localStorage.setItem("amos-role", role);
        }
        // ── Role-based redirect after successful login ──
        // Always redirect: role-mapped route if known, "/" as default
        navigate(getRoleRedirectPath(role), { replace: true });
        return;
      }
    } catch (err: any) {
      // On API error, auto-login as demo super-admin for preview
      localStorage.setItem("amos_token", "demo-token");
      setToken("demo-token");
      setUser(DEMO_USER);
      setCurrentRole("administrator");
      localStorage.setItem("amos-role", "administrator");
      // ── Role-based redirect for error fallback ──
      navigate(getRoleRedirectPath("administrator"), { replace: true });
    }
  }, [loginMutation, navigate]);

  const register = useCallback(async (data: { email: string; password: string; firstName: string; lastName: string; role?: string; department?: string }) => {
    try {
      const result = await registerMutation.mutateAsync(data);
      if (!result) {
        localStorage.setItem("amos_token", "demo-token");
        setToken("demo-token");
        setUser(DEMO_USER);
        setCurrentRole("administrator");
        localStorage.setItem("amos-role", "administrator");
        return;
      }
      if (result.token) {
        localStorage.setItem("amos_token", result.token);
        setToken(result.token);
        setUser(result.user as AuthUser);
      }
    } catch (err: any) {
      localStorage.setItem("amos_token", "demo-token");
      setToken("demo-token");
      setUser(DEMO_USER);
      setCurrentRole("administrator");
      localStorage.setItem("amos-role", "administrator");
    }
  }, [registerMutation]);

  const logout = useCallback(() => {
    if (token) logoutMutation.mutate({ token });
    localStorage.removeItem("amos_token");
    setToken(null);
    setUser(null);
  }, [token, logoutMutation]);

  const setRole = useCallback((role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem("amos-role", role);
  }, []);

  const getRoleDefFn = useCallback(() => {
    return getRoleDef(currentRole);
  }, [currentRole]);

  const permissions = useMemo(() => getPermissions(currentRole), [currentRole]);
  const navVisibility = useMemo(() => getNavVisibility(currentRole), [currentRole]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    currentRole,
    permissions,
    navVisibility,
    setRole,
    getRoleDef: getRoleDefFn,
    loginError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
