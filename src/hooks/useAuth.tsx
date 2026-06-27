import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react";
import { trpc } from "@/providers/trpc";

// ─── Adolbi Care Role Definitions — BHC/GRO Launch Staffing Plan ───────────

export type UserRole =
  | "super-admin"
  | "administrator"
  | "gro-administrator"
  | "treatment-director"
  | "psychiatric-np"
  | "qmhp-cs"
  | "clinical-director"
  | "hr-director"
  | "hr-compliance"
  | "program-manager"
  | "rcs-lead"
  | "rcs-day"
  | "rcs-night"
  | "rcs-prn"
  | "behavioral-support"
  | "recreation-coordinator"
  | "medication-aide"
  | "supervisor"
  | "qa-officer"
  | "training-coordinator"
  | "operations-manager"
  | "gro-staff";

export interface RoleDef {
  id: UserRole;
  label: string;
  badgeColor: string;
  department: string;
  description: string;
}

export const ROLE_DEFINITIONS: RoleDef[] = [
  { id: "super-admin", label: "Super Admin", badgeColor: "#000000", department: "Executive", description: "Full platform control. Account owner." },
  { id: "administrator", label: "Administrator / LCCA", badgeColor: "#DC2626", department: "Executive", description: "GRO operations approval, release-to-duty authority." },
  { id: "gro-administrator", label: "GRO Administrator", badgeColor: "#7F1D1D", department: "GRO Operations", description: "GRO facility oversight, residential operations, census management." },
  { id: "treatment-director", label: "GRO Treatment Director / LPHA", badgeColor: "#1E3A5F", department: "Clinical", description: "Treatment governance, clinical supervision." },
  { id: "psychiatric-np", label: "PMHNP-FNP / CCMG Clinical Director", badgeColor: "#0E7490", department: "Clinical", description: "Psychiatric assessment, medication management." },
  { id: "qmhp-cs", label: "QMHP-CS / Case Manager", badgeColor: "#4338CA", department: "Clinical", description: "BHC/GRO bridge, case coordination." },
  { id: "clinical-director", label: "Clinical Director", badgeColor: "#2563EB", department: "Clinical", description: "Clinical oversight, quality review." },
  { id: "hr-director", label: "HR Director", badgeColor: "#245C5A", department: "Human Resources", description: "HR lifecycle, clearance decisions." },
  { id: "hr-compliance", label: "HR / Compliance Officer", badgeColor: "#6D28D9", department: "Compliance", description: "Pipeline, clearance tracking, audit readiness." },
  { id: "training-coordinator", label: "Training Coordinator", badgeColor: "#0891B2", department: "HR / Training", description: "Training, certificates, competency." },
  { id: "program-manager", label: "Program Manager / Shift Supervisor", badgeColor: "#C2410C", department: "Residential Ops", description: "Scheduling, shift control, coverage." },
  { id: "rcs-lead", label: "Lead RCS", badgeColor: "#B45309", department: "Residential", description: "Floor mentor, documentation review." },
  { id: "rcs-day", label: "RCS (Day/Evening)", badgeColor: "#059669", department: "Residential", description: "Day/evening pod coverage." },
  { id: "rcs-night", label: "RCS (Awake Night)", badgeColor: "#047857", department: "Residential", description: "Overnight supervision, visual checks." },
  { id: "rcs-prn", label: "RCS (PRN/Relief)", badgeColor: "#65A30D", department: "Residential", description: "Call-out and emergency coverage." },
  { id: "behavioral-support", label: "Behavioral Support Specialist", badgeColor: "#D97706", department: "Support", description: "De-escalation, behavior tracking." },
  { id: "recreation-coordinator", label: "Recreation / Life Skills", badgeColor: "#EC4899", department: "Support", description: "Activities, life skills, engagement." },
  { id: "medication-aide", label: "Medication Aide", badgeColor: "#14B8A6", department: "Support", description: "Medication observation, health logs." },
  { id: "supervisor", label: "Supervisor", badgeColor: "#D97706", department: "Clinical", description: "Team oversight, competency sign-offs." },
  { id: "qa-officer", label: "QA Officer", badgeColor: "#7C3AED", department: "Compliance", description: "Audit, credential tracking." },
  { id: "operations-manager", label: "Operations Manager", badgeColor: "#EA580C", department: "Operations", description: "Scheduling, logistics." },
  { id: "gro-staff", label: "GRO Staff", badgeColor: "#6B7280", department: "GRO", description: "General access." },
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
  "super-admin":          { canViewHR: true,  canEditHR: true,  canViewCompliance: true,  canEditCompliance: true,  canViewClinical: true,  canViewOperations: true,  canViewAdmin: true,  canEditAdmin: true,  canSupervise: true,  canClearPersonnel: true,  canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "administrator":        { canViewHR: true,  canEditHR: true,  canViewCompliance: true,  canEditCompliance: true,  canViewClinical: true,  canViewOperations: true,  canViewAdmin: true,  canEditAdmin: true,  canSupervise: true,  canClearPersonnel: true,  canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "gro-administrator":    { canViewHR: true,  canEditHR: false, canViewCompliance: true,  canEditCompliance: true,  canViewClinical: true,  canViewOperations: true,  canViewAdmin: true,  canEditAdmin: false, canSupervise: true,  canClearPersonnel: true,  canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "treatment-director":   { canViewHR: true,  canEditHR: false, canViewCompliance: true,  canEditCompliance: true,  canViewClinical: true,  canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: true,  canClearPersonnel: true,  canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "psychiatric-np":       { canViewHR: false, canEditHR: false, canViewCompliance: true,  canEditCompliance: true,  canViewClinical: true,  canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "qmhp-cs":              { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: true,  canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: true },
  "clinical-director":    { canViewHR: true,  canEditHR: false, canViewCompliance: true,  canEditCompliance: true,  canViewClinical: true,  canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: true,  canClearPersonnel: false, canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "hr-director":          { canViewHR: true,  canEditHR: true,  canViewCompliance: true,  canEditCompliance: false, canViewClinical: false, canViewOperations: true,  canViewAdmin: true,  canEditAdmin: false, canSupervise: true,  canClearPersonnel: true,  canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "hr-compliance":        { canViewHR: true,  canEditHR: true,  canViewCompliance: true,  canEditCompliance: true,  canViewClinical: false, canViewOperations: false, canViewAdmin: true,  canEditAdmin: false, canSupervise: false, canClearPersonnel: true,  canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "program-manager":      { canViewHR: true,  canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: true,  canViewAdmin: false, canEditAdmin: false, canSupervise: true,  canClearPersonnel: false, canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "rcs-lead":             { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
  "rcs-day":              { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
  "rcs-night":            { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
  "rcs-prn":              { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
  "behavioral-support":   { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
  "recreation-coordinator": { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
  "medication-aide":      { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
  "supervisor":           { canViewHR: true,  canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: true,  canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: true,  canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
  "qa-officer":           { canViewHR: true,  canEditHR: false, canViewCompliance: true,  canEditCompliance: true,  canViewClinical: true,  canViewOperations: true,  canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "training-coordinator": { canViewHR: true,  canEditHR: true,  canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: true,  canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: true,  canViewOnboarding: true,  canManageDocuments: true },
  "operations-manager":   { canViewHR: true,  canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: true,  canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: true,  canViewOnboarding: false, canManageDocuments: false },
  "gro-staff":            { canViewHR: false, canEditHR: false, canViewCompliance: false, canEditCompliance: false, canViewClinical: false, canViewOperations: false, canViewAdmin: false, canEditAdmin: false, canSupervise: false, canClearPersonnel: false, canViewReports: false, canViewOnboarding: true,  canManageDocuments: false },
};

const ROLE_NAV_VISIBILITY: Record<UserRole, Record<string, boolean>> = {
  "super-admin":            { dashboard: true, operations: true, compliance: true, hr: true, activation: true, management: true, admin: true },
  "administrator":          { dashboard: true, operations: true, compliance: true, hr: true, activation: true, management: true, admin: true },
  "gro-administrator":      { dashboard: true, operations: true, compliance: true, hr: true, activation: true, management: true, admin: true },
  "treatment-director":     { dashboard: true, operations: false, compliance: true, hr: false, activation: false, management: true, admin: false },
  "psychiatric-np":         { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: true, admin: false },
  "qmhp-cs":                { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: false },
  "clinical-director":      { dashboard: true, operations: false, compliance: true, hr: true, activation: false, management: true, admin: false },
  "hr-director":            { dashboard: true, operations: false, compliance: true, hr: true, activation: true, management: true, admin: true },
  "hr-compliance":          { dashboard: true, operations: false, compliance: true, hr: true, activation: true, management: false, admin: true },
  "program-manager":        { dashboard: true, operations: true, compliance: false, hr: true, activation: true, management: false, admin: false },
  "rcs-lead":               { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "rcs-day":                { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "rcs-night":              { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "rcs-prn":                { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "behavioral-support":     { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "recreation-coordinator": { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "medication-aide":        { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
  "supervisor":             { dashboard: true, operations: false, compliance: false, hr: true, activation: false, management: false, admin: false },
  "qa-officer":             { dashboard: true, operations: false, compliance: true, hr: true, activation: false, management: true, admin: false },
  "training-coordinator":   { dashboard: true, operations: false, compliance: false, hr: true, activation: true, management: false, admin: true },
  "operations-manager":     { dashboard: true, operations: true, compliance: false, hr: true, activation: false, management: false, admin: false },
  "gro-staff":              { dashboard: true, operations: false, compliance: false, hr: false, activation: false, management: false, admin: true },
};

// ─── Auth Context ────────────────────────────────────────────

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
    return (stored as UserRole) ?? "administrator";
  });

  const loginMutation = trpc.auth.login.useMutation();
  const registerMutation = trpc.auth.register.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();
  const seedAdminMutation = trpc.auth.seedAdmin.useMutation();

  const { data: meData } = trpc.auth.me.useQuery(
    token ? { token } : undefined,
    { enabled: !!token, retry: false }
  );

  useEffect(() => {
    if (meData) {
      setUser(meData as AuthUser);
      setIsLoading(false);
    } else if (!token) {
      setIsLoading(false);
    }
  }, [meData, token]);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 3000);
    return () => clearTimeout(timer);
  }, []);

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
    user, isLoading, isAuthenticated: !!user, login, register, logout, seedAdmin,
    currentRole, permissions, navVisibility, setRole, getRoleDef, loginError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
