import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "./app-sidebar";
import { TopBar } from "./top-bar";

import DashboardPage from "@/pages/dashboard/DashboardPage";
import WorkQueuePage from "@/pages/work-queue/WorkQueuePage";
import DMSPage from "@/pages/dms/DMSPage";
import WorkflowCatalogPage from "@/pages/workflows/WorkflowCatalogPage";
import WorkflowDetailPage from "@/pages/workflows/WorkflowDetailPage";
import PersonaDirectoryPage from "@/pages/personas/PersonaDirectoryPage";
import PersonaDetailPage from "@/pages/personas/PersonaDetailPage";
import ClinicalSessionsPage from "@/pages/clinical/ClinicalSessionsPage";
import TreatmentPlansPage from "@/pages/clinical/TreatmentPlansPage";
import AssessmentsPage from "@/pages/clinical/AssessmentsPage";
import GROShiftsPage from "@/pages/gro/GROShiftsPage";
import IncidentReportsPage from "@/pages/gro/IncidentReportsPage";
import SeparationManagementPage from "@/pages/gro/SeparationManagementPage";
import MedicationAdminPage from "@/pages/gro/MedicationAdminPage";
import CAPPage from "@/pages/compliance/CAPPage";
import AuditReadinessPage from "@/pages/compliance/AuditReadinessPage";
import BillingGatePage from "@/pages/revenue/BillingGatePage";
import ClaimsTrackingPage from "@/pages/revenue/ClaimsTrackingPage";
import EnhancementRegisterPage from "@/pages/revenue/EnhancementRegisterPage";
import ExecutiveDecisionsPage from "@/pages/executive/ExecutiveDecisionsPage";
import SettingsPage from "@/pages/settings/SettingsPage";
import NotFoundPage from "@/pages/NotFoundPage";

export function AppShell() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPlaceholder />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/work-queue" element={<WorkQueuePage />} />
            <Route path="/dms" element={<DMSPage />} />
            <Route path="/dms/*" element={<DMSPage />} />
            <Route path="/workflows" element={<WorkflowCatalogPage />} />
            <Route path="/workflows/:id" element={<WorkflowDetailPage />} />
            <Route path="/personas" element={<PersonaDirectoryPage />} />
            <Route path="/personas/:id" element={<PersonaDetailPage />} />
            <Route path="/clinical/sessions" element={<ClinicalSessionsPage />} />
            <Route path="/clinical/treatment-plans" element={<TreatmentPlansPage />} />
            <Route path="/clinical/assessments" element={<AssessmentsPage />} />
            <Route path="/gro/shifts" element={<GROShiftsPage />} />
            <Route path="/gro/incidents" element={<IncidentReportsPage />} />
            <Route path="/gro/separations" element={<SeparationManagementPage />} />
            <Route path="/gro/medication" element={<MedicationAdminPage />} />
            <Route path="/compliance/cap" element={<CAPPage />} />
            <Route path="/compliance/audit" element={<AuditReadinessPage />} />
            <Route path="/revenue/billing" element={<BillingGatePage />} />
            <Route path="/revenue/claims" element={<ClaimsTrackingPage />} />
            <Route path="/revenue/enhancements" element={<EnhancementRegisterPage />} />
            <Route path="/executive/decisions" element={<ExecutiveDecisionsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </div>
  );
}

function LoginPlaceholder() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">AMOS-OPS</h1>
        <p className="text-center text-muted-foreground">Sign-in form coming soon.</p>
      </div>
    </div>
  );
}