import { Routes, Route, Navigate } from "react-router-dom";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ProtectedRoute } from "@/components/shell/ProtectedRoute";
import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { CredentialTrackingPage } from "@/pages/CredentialTrackingPage";
import { SeparationManagementPage } from "@/pages/SeparationManagementPage";
import { EmailOutreachPage } from "@/pages/EmailOutreachPage";
import { HRCommandCenterPage } from "@/pages/hr/HRCommandCenterPage";
import { OnboardingAcademyPage } from "@/pages/hr/OnboardingAcademyPage";
import { OnboardingTrackPage } from "@/pages/hr/OnboardingTrackPage";
import { HRPersonProfilePage } from "@/pages/hr/HRPersonProfilePage";
import { DocumentStudioPage } from "@/pages/hr/DocumentStudioPage";
import { AuditPage } from "@/pages/AuditPage";
import { KnowledgePage } from "@/pages/KnowledgePage";
import { UniversalOrientationPage } from "@/pages/UniversalOrientationPage";
import { MarketingSiteReviewPage } from "@/pages/MarketingSiteReviewPage";
import { ClinicalDashboardPage } from "@/pages/clinical/ClinicalDashboardPage";
import { PatientProfilePage } from "@/pages/clinical/PatientProfilePage";
import { TreatmentPlanPage } from "@/pages/clinical/TreatmentPlanPage";
import { ClaimSubmissionPage } from "@/pages/revenue/ClaimSubmissionPage";
import { RevenueDashboardPage } from "@/pages/revenue/RevenueDashboardPage";
import { QADashboardPage } from "@/pages/qa/QADashboardPage";
import { GRODashboardPage } from "@/pages/gro/GRODashboardPage";
import { GADDashboardPage } from "@/pages/gad/GADDashboardPage";
import { ExecutiveDashboardPage } from "@/pages/executive/ExecutiveDashboardPage";
import { NILGraphPage } from "@/pages/NILGraphPage";
import { EntraIDPage } from "@/pages/admin/EntraIDPage";
import { WorkflowPage } from "@/pages/admin/WorkflowPage";
import { SettingsPage } from "@/pages/admin/SettingsPage";

function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <TopBar />
      {children}
    </AppShell>
  );
}

export function App() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/marketing/review" element={<MarketingSiteReviewPage />} />

      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<RouteShell><DashboardPage /></RouteShell>} />
        <Route path="/analytics" element={<RouteShell><AnalyticsPage /></RouteShell>} />
        <Route path="/credentials" element={<RouteShell><CredentialTrackingPage /></RouteShell>} />
        <Route path="/separation" element={<RouteShell><SeparationManagementPage /></RouteShell>} />
        <Route path="/email" element={<RouteShell><EmailOutreachPage /></RouteShell>} />
        <Route path="/hr" element={<RouteShell><HRCommandCenterPage /></RouteShell>} />
        <Route path="/hr/person/:personId" element={<RouteShell><HRPersonProfilePage /></RouteShell>} />
        <Route path="/onboarding" element={<RouteShell><OnboardingAcademyPage /></RouteShell>} />
        <Route path="/onboarding/track/:trackId" element={<RouteShell><OnboardingTrackPage /></RouteShell>} />
        <Route path="/documents" element={<RouteShell><DocumentStudioPage /></RouteShell>} />
        <Route path="/audit" element={<RouteShell><AuditPage /></RouteShell>} />
        <Route path="/knowledge" element={<RouteShell><KnowledgePage /></RouteShell>} />
        <Route path="/onboarding/track/universal-orientation" element={<RouteShell><UniversalOrientationPage /></RouteShell>} />

        {/* Clinical (BHC) */}
        <Route path="/clinical" element={<RouteShell><ClinicalDashboardPage /></RouteShell>} />
        <Route path="/clinical/patient/:patientId" element={<RouteShell><PatientProfilePage /></RouteShell>} />
        <Route path="/clinical/plan/:planId" element={<RouteShell><TreatmentPlanPage /></RouteShell>} />

        {/* Revenue */}
        <Route path="/revenue" element={<RouteShell><RevenueDashboardPage /></RouteShell>} />
        <Route path="/revenue/claims" element={<RouteShell><ClaimSubmissionPage /></RouteShell>} />

        {/* QA & Compliance */}
        <Route path="/qa" element={<RouteShell><QADashboardPage /></RouteShell>} />

        {/* Growth & Outreach */}
        <Route path="/gro" element={<RouteShell><GRODashboardPage /></RouteShell>} />

        {/* GAD Operations */}
        <Route path="/gad" element={<RouteShell><GADDashboardPage /></RouteShell>} />

        {/* Executive Intelligence */}
        <Route path="/executive" element={<RouteShell><ExecutiveDashboardPage /></RouteShell>} />

        {/* NIL Knowledge Graph */}
        <Route path="/nil" element={<RouteShell><NILGraphPage /></RouteShell>} />

        {/* Admin: Settings */}
        <Route path="/admin/settings" element={<RouteShell><SettingsPage /></RouteShell>} />

        {/* Admin: Microsoft Entra ID */}
        <Route path="/admin/entra-id" element={<RouteShell><EntraIDPage /></RouteShell>} />

        {/* Admin: Workflow Engine */}
        <Route path="/admin/workflows" element={<RouteShell><WorkflowPage /></RouteShell>} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
