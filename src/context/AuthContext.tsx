import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";

// ─── Role Definitions ─────────────────────────────────────────

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

// ─── Permission Matrix ────────────────────────────────────────

export interface Permissions {
  canViewHR: boolean;
  canEditHR: boolean;
  canViewCompliance: boolean;
  canEditCompliance: boolean;
  canViewClinical: boolean;
  canViewOperations: boolean;
  canViewAdmin: boolean;
  canEditAdmin: boolean;
  canSupervise: boolean;
  canClearPersonnel: boolean;
  canViewReports: boolean;
  canViewOnboarding: boolean;
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

// ─── Nav Visibility by Role ───────────────────────────────────

export const ROLE_NAV_VISIBILITY: Record<UserRole, Record<string, boolean>> = {
  administrator: { dashboard: true, operations: true, compliance: true, hr: true, activation: true, management: true, admin: true },
  "hr-director": { dashboard: true, operations: false, compliance: true, hr: true, activation: true, management: true, admin: true },
  supervisor: { dashboard: true, operations: false, compliance: false, hr: true, activation: false, management: false, admin: false },
  "clinical-director": { dashboard: true, operations: false, compliance: true, hr: true, activation: false, management: true, admin: false },
  "gro-staff": { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "qa-officer": { dashboard: true, operations: false, compliance: true, hr: true, activation: false, management: true, admin: false },
  "training-coordinator": { dashboard: true, operations: false, compliance: false, hr: true, activation: true, management: false, admin: true },
  "operations-manager": { dashboard: true, operations: true, compliance: false, hr: true, activation: false, management: false, admin: false },
};

// ─── Auth Types ───────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  department?: string | null;
}

// ─── Context ──────────────────────────────────────────────────

interface AuthState {
  currentRole: UserRole;
  isAuthenticated: boolean;
  user: AuthUser | null;
  permissions: Permissions;
  navVisibility: Record<string, boolean>;
  setRole: (role: UserRole) => void;
  getRoleDef: () => RoleDef;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoginLoading: boolean;
  loginError: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "amos-role";
const TOKEN_KEY = "amos_token";

function getStoredRole(): UserRole {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && ROLE_DEFINITIONS.some((r) => r.id === stored)) {
    return stored as UserRole;
  }
  return "hr-director";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentRole, setCurrentRole] = useState<UserRole>(getStoredRole);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loginMutation = trpc.auth.login.useMutation();
  const { data: meData, isLoading: meLoading } = trpc.auth.me.useQuery(undefined, {
    enabled: !!token,
    retry: false,
  });

  // Sync user from /api/auth/me when token is present
  useEffect(() => {
    if (meData) {
      const apiUser: AuthUser = {
        id: meData.id,
        email: meData.email,
        firstName: meData.firstName,
        lastName: meData.lastName,
        role: meData.role as UserRole,
        department: meData.department,
      };
      setUser(apiUser);
      setCurrentRole(apiUser.role);
      localStorage.setItem(STORAGE_KEY, apiUser.role);
    }
  }, [meData]);

  // If no token, keep the localStorage role for demo mode
  useEffect(() => {
    if (!token && !meLoading) {
      setUser(null);
      const storedRole = getStoredRole();
      setCurrentRole(storedRole);
    }
  }, [token, meLoading]);

  const setRole = useCallback((role: UserRole) => {
    setCurrentRole(role);
    localStorage.setItem(STORAGE_KEY, role);
  }, []);

  const getRoleDef = useCallback(() => {
    return ROLE_DEFINITIONS.find((r) => r.id === currentRole)!;
  }, [currentRole]);

  const login = useCallback(
    async (email: string, password: string) => {
      setLoginError(null);
      try {
        const result = await loginMutation.mutateAsync({ email, password });
        if (result.token) {
          localStorage.setItem(TOKEN_KEY, result.token);
          setToken(result.token);
          const apiUser: AuthUser = {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            role: result.user.role as UserRole,
          };
          setUser(apiUser);
          setCurrentRole(apiUser.role);
          localStorage.setItem(STORAGE_KEY, apiUser.role);
        }
      } catch (err: any) {
        setLoginError(err.message || "Login failed");
        throw err;
      }
    },
    [loginMutation]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    const storedRole = getStoredRole();
    setCurrentRole(storedRole);
  }, []);

  const permissions = PERMISSION_MATRIX[currentRole];
  const navVisibility = ROLE_NAV_VISIBILITY[currentRole];

  return (
    <AuthContext.Provider
      value={{
        currentRole,
        isAuthenticated: !!user || !!token,
        user,
        permissions,
        navVisibility,
        setRole,
        getRoleDef,
        login,
        logout,
        isLoginLoading: loginMutation.isPending || meLoading,
        loginError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
