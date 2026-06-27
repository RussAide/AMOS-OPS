import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import type React from "react";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { NotificationProvider } from "@/context/NotificationContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/shell/AppShell";
import { DashboardPage } from "@/pages/DashboardPage";
import { OnboardingLayout } from "@/pages/onboarding/OnboardingLayout";
import { OnboardingHomePage } from "@/pages/onboarding/OnboardingHomePage";
import { SupervisorPage } from "@/pages/onboarding/SupervisorPage";
import { ManagementPage } from "@/pages/onboarding/ManagementPage";
import { TrackPage } from "@/pages/onboarding/TrackPage";
import { TrainingPage } from "@/pages/onboarding/TrainingPage";
import { EvidencePage } from "@/pages/onboarding/EvidencePage";
import { ModulePage } from "@/pages/onboarding/ModulePage";
import { EmployeePage } from "@/pages/onboarding/EmployeePage";
import { HRLayout } from "@/pages/hr/HRLayout";
import { HRCommandCenterPage } from "@/pages/hr/HRCommandCenterPage";
import { HRModulePage } from "@/pages/hr/HRModulePage";
import { HRPersonProfilePage } from "@/pages/hr/HRPersonProfilePage";
import { LoginPage } from "@/pages/LoginPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { ClinicalDashboardPage } from "@/pages/clinical/ClinicalDashboardPage";
import { PatientListPage } from "@/pages/clinical/PatientListPage";
import { PatientProfilePage } from "@/pages/clinical/PatientProfilePage";
import { RevenueDashboardPage } from "@/pages/revenue/RevenueDashboardPage";
import { ClaimsListPage } from "@/pages/revenue/ClaimsListPage";
import { QADashboardPage } from "@/pages/qa/QADashboardPage";
import { QAListPage } from "@/pages/qa/QAListPage";
import { GRODashboardPage } from "@/pages/gro/GRODashboardPage";
import { GADDashboardPage } from "@/pages/gad/GADDashboardPage";
import { ExecutiveDashboardPage } from "@/pages/executive/ExecutiveDashboardPage";
import { NILGraphPage } from "@/pages/NILGraphPage";
import { EntraIDPage } from "@/pages/admin/EntraIDPage";
import { WorkflowPage } from "@/pages/admin/WorkflowPage";

function AppShellWrapper() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)" }}>
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 animate-pulse" style={{ backgroundColor: "rgba(233,196,106,0.15)" }} />
          <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>Loading AMOS-OPS...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
    <NotificationProvider>
    <OnboardingProvider>
      <ErrorBoundary>
        <HashRouter>
          <Routes>
            {/* All authenticated routes wrapped in AppShell + auth guard */}
            <Route element={<ProtectedRoute><AppShellWrapper /></ProtectedRoute>}>
              {/* Dashboard */}
              <Route path="/" element={<DashboardPage />} />

              {/* Onboarding routes (legacy, preserved) */}
              <Route element={<OnboardingLayout />}>
                <Route path="/onboarding" element={<OnboardingHomePage />} />
                <Route path="/onboarding/supervisor" element={<SupervisorPage />} />
                <Route path="/onboarding/management" element={<ManagementPage />} />
                <Route path="/onboarding/track/:trackId" element={<TrackPage />} />
                <Route path="/onboarding/training" element={<TrainingPage />} />
                <Route path="/onboarding/evidence" element={<EvidencePage />} />
                <Route path="/onboarding/module/:moduleId" element={<ModulePage />} />
                <Route path="/onboarding/employee/:id" element={<EmployeePage />} />
              </Route>

              {/* HR Lifecycle routes */}
              <Route element={<HRLayout />}>
                <Route path="/hr" element={<HRCommandCenterPage />} />
                <Route path="/hr/:moduleId" element={<HRModulePage />} />
                <Route path="/hr/person/:personId" element={<HRPersonProfilePage />} />
              </Route>

              {/* Analytics */}
              <Route path="/analytics" element={<AnalyticsPage />} />

              {/* Revenue Cycle */}
              <Route path="/revenue" element={<RevenueDashboardPage />} />
              <Route path="/revenue/claims" element={<ClaimsListPage />} />

              {/* QA & Compliance */}
              <Route path="/qa" element={<QADashboardPage />} />
              <Route path="/qa/registry" element={<QAListPage />} />

              {/* Growth & Outreach */}
              <Route path="/gro" element={<GRODashboardPage />} />

              {/* General Administration */}
              <Route path="/gad" element={<GADDashboardPage />} />

              {/* Executive Intelligence */}
              <Route path="/executive" element={<ExecutiveDashboardPage />} />

              {/* NIL Knowledge Graph */}
              <Route path="/nil" element={<NILGraphPage />} />

              {/* Admin: Microsoft Entra ID */}
              <Route path="/admin/entra-id" element={<EntraIDPage />} />

              {/* Admin: Workflow Engine */}
              <Route path="/admin/workflows" element={<WorkflowPage />} />

              {/* BHC Clinical routes */}
              <Route path="/clinical" element={<ClinicalDashboardPage />} />
              <Route path="/clinical/patients" element={<PatientListPage />} />
              <Route path="/clinical/patients/:id" element={<PatientProfilePage />} />
            </Route>

            {/* Login page (standalone, no AppShell) */}
            <Route path="/login" element={<LoginPage />} />

            {/* Legacy redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </HashRouter>
      </ErrorBoundary>
    </OnboardingProvider>
    </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
