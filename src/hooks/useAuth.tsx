import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";

// ─── Role Definitions (from old AuthContext) ─────────────────

export type UserRole =
  | "administrator"
  | "hr-director"
  | "supervisor"
  | "clinical-director"
  | "gro-staff"
  | "qa-officer"
  | "training-coordinator"
  | "operations-manager";

export interface RoleDef {
  id: UserRole;
  label: string;
  badgeColor: string;
  department: string;
  description: string;
}

export const ROLE_DEFINITIONS: RoleDef[] = [
  { id: "administrator", label: "Administrator", badgeColor: "#DC2626", department: "Executive", description: "Full system access. Program director oversight." },
  { id: "hr-director", label: "HR Director", badgeColor: "#245C5A", department: "Human Resources", description: "HR lifecycle management, clearance decisions, personnel oversight." },
  { id: "supervisor", label: "Supervisor", badgeColor: "#D97706", department: "Clinical / Residential", description: "Team oversight, competency sign-offs, incident review." },
  { id: "clinical-director", label: "Clinical Director", badgeColor: "#2563EB", department: "Clinical", description: "Clinical governance, treatment oversight, quality review." },
  { id: "gro-staff", label: "GRO Direct Care", badgeColor: "#059669", department: "GRO Residential", description: "Youth care, supervision, documentation. Limited access." },
  { id: "qa-officer", label: "QA Officer", badgeColor: "#7C3AED", department: "Compliance", description: "Audit, credential tracking, compliance oversight." },
  { id: "training-coordinator", label: "Training Coordinator", badgeColor: "#0891B2", department: "HR / Training", description: "Training assignment, certificate verification, LMS admin." },
  { id: "operations-manager", label: "Operations Manager", badgeColor: "#EA580C", department: "Operations", description: "Scheduling, deployment, logistics. Read-only HR signals." },
];

export interface Permissions {
  canViewHR: boolean; canEditHR: boolean;
  canViewCompliance: boolean; canEditCompliance: boolean;
  canViewClinical: boolean; canViewOperations: boolean;
  canViewAdmin: boolean; canEditAdmin: boolean;
  canSupervise: boolean; canClearPersonnel: boolean;
  canViewReports: boolean; canViewOnboarding: boolean;
  canManageDocuments: boolean;
}

const PERMISSION_MATRIX: Record<UserRole, Permissions> = {
  administrator: { canViewHR: true, canEditHR: true, canViewCompliance: true, canEditCompliance: true, canViewClinical: true, canViewOperations: true, canViewAdmin: true, canEditAdmin: true, canSupervise: true, canClearPersonnel: true, canViewReports: true, canViewOnboarding: true, canManageDocuments: true },
  "hr-director": { canViewHR: true, canEditHR: true, canViewCompliance: true, canEditCompliance: false, canViewClinical: false, canViewOperations: true, canViewAdmin: true, canEditAdmin: false, canSupervise: true, canClearPersonnel: true, canViewReports: true, canViewOnboarding: true, canManageDocuments: true },
  supervisor: { canViewHR: true, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: true, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: true, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true, canManageDocuments: false },
  "clinical-director": { canViewHR: true, canEditHR: false, canViewCompliance: true, canEditCompliance: true, canViewClinical: true, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: true, canClearPersonnel: false, canViewReports: true, canViewOnboarding: true, canManageDocuments: true },
  "gro-staff": { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true, canManageDocuments: false },
  "qa-officer": { canViewHR: true, canEditHR: false, canViewCompliance: true, canEditCompliance: true, canViewClinical: true, canViewOperations: true, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: true, canViewOnboarding: true, canManageDocuments: true },
  "training-coordinator": { canViewHR: true, canEditHR: true, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: true, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: true, canViewOnboarding: true, canManageDocuments: true },
  "operations-manager": { canViewHR: true, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: true, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: true, canViewOnboarding: false, canManageDocuments: false },
};

const ROLE_NAV_VISIBILITY: Record<UserRole, Record<string, boolean>> = {
  administrator: { dashboard: true, operations: true, compliance: true, hr: true, activation: true, management: true, admin: true },
  "hr-director": { dashboard: true, operations: false, compliance: true, hr: true, activation: true, management: true, admin: true },
  supervisor: { dashboard: true, operations: false, compliance: false, hr: true, activation: false, management: false, admin: false },
  "clinical-director": { dashboard: true, operations: false, compliance: true, hr: true, activation: false, management: true, admin: false },
  "gro-staff": { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "qa-officer": { dashboard: true, operations: false, compliance: true, hr: true, activation: false, management: true, admin: false },
  "training-coordinator": { dashboard: true, operations: false, compliance: false, hr: true, activation: true, management: false, admin: true },
  "operations-manager": { dashboard: true, operations: true, compliance: false, hr: true, activation: false, management: false, admin: false },
};

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
  seedAdmin: () => Promise<{ created: boolean; email?: string; password?: string; message?: string }>;
  // Backward compat: role/permission system
  currentRole: UserRole;
  permissions: Permissions;
  navVisibility: Record<string, boolean>;
  setRole: (role: UserRole) => void;
  getRoleDef: () => RoleDef;
  loginError: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("amos_token"));
  const [loginError, setLoginError] = useState<string | null>(null);
  const [currentRole, setCurrentRole] = useState<UserRole>(() => {
    const stored = localStorage.getItem("amos-role");
    return (stored as UserRole) ?? "hr-director";
  });

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const seedAdminMutation = trpc.auth.seedAdmin.useMutation();

  // Check token on mount
  const { data: meData } = trpc.auth.me.useQuery(
    token ? { token } : undefined,
    { enabled: !!token, retry: false }
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
    }
  }, [meData, token]);

  const login = useCallback(async (email: string, password: string) => {
    setLoginError(null);
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      if (result.token) {
        localStorage.setItem("amos_token", result.token);
        setToken(result.token);
        setUser(result.user as AuthUser);
        if (result.user.role) {
          const r = result.user.role as UserRole;
          setCurrentRole(r);
          localStorage.setItem("amos-role", r);
        }
      }
    } catch (err: any) {
      setLoginError(err.message || "Login failed");
      throw err;
    }
  }, [loginMutation]);

  const register = useCallback(async (data: { email: string; password: string; firstName: string; lastName: string; role?: string; department?: string }) => {
    const result = await registerMutation.mutateAsync(data);
    if (result.token) {
      localStorage.setItem("amos_token", result.token);
      setToken(result.token);
      setUser(result.user as AuthUser);
    }
  }, [registerMutation]);

  const logout = useCallback(() => {
    if (token) logoutMutation.mutate({ token });
    localStorage.removeItem("amos_token");
    setToken(null);
    setUser(null);
  }, [token, logoutMutation]);

  const seedAdmin = useCallback(async () => {
    return await seedAdminMutation.mutateAsync();
  }, [seedAdminMutation]);

  const setRole = useCallback((role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem("amos-role", role);
  }, []);

  const getRoleDef = useCallback(() => {
    return ROLE_DEFINITIONS.find((r) => r.id === currentRole) ?? ROLE_DEFINITIONS[0];
  }, [currentRole]);

  const permissions = useMemo(() => PERMISSION_MATRIX[currentRole] ?? PERMISSION_MATRIX["gro-staff"], [currentRole]);
  const navVisibility = useMemo(() => ROLE_NAV_VISIBILITY[currentRole] ?? ROLE_NAV_VISIBILITY["gro-staff"], [currentRole]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    seedAdmin,
    currentRole,
    permissions,
    navVisibility,
    setRole,
    getRoleDef,
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
