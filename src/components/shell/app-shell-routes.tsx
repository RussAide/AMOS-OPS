import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import type React from "react";
import { OnboardingProvider } from "@/context/OnboardingContext";
import { useAuth } from "@/hooks/useAuth";
import { NotificationProvider } from "@/context/NotificationContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AppShell } from "@/components/shell/AppShell";
import { FacilityProvider } from "@/context/FacilityContext";
import { SuspenseFallback } from "@/components/shell/SuspenseFallback";

/* ─── Lazy Pages ─── */
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const OnboardingLayout = lazy(() => import("@/pages/onboarding/OnboardingLayout"));
const OnboardingHomePage = lazy(() => import("@/pages/onboarding/OnboardingHomePage"));
const SupervisorPage = lazy(() => import("@/pages/onboarding/SupervisorPage"));
const ManagementPage = lazy(() => import("@/pages/onboarding/ManagementPage"));
const TrackPage = lazy(() => import("@/pages/onboarding/TrackPage"));
const TrainingPage = lazy(() => import("@/pages/onboarding/TrainingPage"));
const EvidencePage = lazy(() => import("@/pages/onboarding/EvidencePage"));
const ModulePage = lazy(() => import("@/pages/onboarding/ModulePage"));
const EmployeePage = lazy(() => import("@/pages/onboarding/EmployeePage"));
const HRLayout = lazy(() => import("@/pages/hr/HRLayout"));
const HRCommandCenterPage = lazy(() => import("@/pages/hr/HRCommandCenterPage"));
const HRModulePage = lazy(() => import("@/pages/hr/HRModulePage"));
const HRPersonProfilePage = lazy(() => import("@/pages/hr/HRPersonProfilePage"));
const CredentialTrackingPage = lazy(() => import("@/pages/hr/CredentialTrackingPage"));
const SeparationManagementPage = lazy(() => import("@/pages/hr/SeparationManagementPage"));
const TrainingAssignmentPage = lazy(() => import("@/pages/hr/TrainingAssignmentPage"));
const PerformanceReviewPage = lazy(() => import("@/pages/hr/PerformanceReviewPage"));
const OnboardingWorkflowPage = lazy(() => import("@/pages/hr/OnboardingWorkflowPage"));
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage"));
const ClinicalDashboardPage = lazy(() => import("@/pages/clinical/ClinicalDashboardPage"));
const PatientListPage = lazy(() => import("@/pages/clinical/PatientListPage"));
const PatientProfilePage = lazy(() => import("@/pages/clinical/PatientProfilePage"));
const TreatmentPlansPage = lazy(() => import("@/pages/clinical/TreatmentPlansPage"));
const ClinicalSessionsPage = lazy(() => import("@/pages/clinical/ClinicalSessionsPage"));
const OutcomeMeasuresPage = lazy(() => import("@/pages/clinical/OutcomeMeasuresPage"));
const InsurancePlansPage = lazy(() => import("@/pages/clinical/InsurancePlansPage"));
const ReferralIntakePage = lazy(() => import("@/pages/clinical/ReferralIntakePage"));
const CansAssessmentPage = lazy(() => import("@/pages/clinical/CansAssessmentPage"));
const ServiceDeliveryPage = lazy(() => import("@/pages/clinical/ServiceDeliveryPage"));
const RevenueDashboardPage = lazy(() => import("@/pages/revenue/RevenueDashboardPage"));
const ClaimsListPage = lazy(() => import("@/pages/revenue/ClaimsListPage"));
const ClaimSubmissionPage = lazy(() => import("@/pages/revenue/ClaimSubmissionPage"));
const AuthorizationManagementPage = lazy(() => import("@/pages/revenue/AuthorizationManagementPage"));
const PayerPacketBuilderPage = lazy(() => import("@/pages/revenue/PayerPacketBuilderPage"));
const DenialManagementPage = lazy(() => import("@/pages/revenue/DenialManagementPage"));
const AgingQueuePage = lazy(() => import("@/pages/revenue/AgingQueuePage"));
const ProofOfServiceGatePage = lazy(() => import("@/pages/revenue/ProofOfServiceGatePage"));
const QADashboardPage = lazy(() => import("@/pages/qa/QADashboardPage"));
const QAListPage = lazy(() => import("@/pages/qa/QAListPage"));
const GRODashboardPage = lazy(() => import("@/pages/gro/GRODashboardPage"));
const GADDashboardPage = lazy(() => import("@/pages/gad/GADDashboardPage"));
const ExecutiveDashboardPage = lazy(() => import("@/pages/exec/ExecutiveDashboardPage"));
const NILGraphPage = lazy(() => import("@/pages/NILGraphPage"));
const EntraIDPage = lazy(() => import("@/pages/admin/EntraIDPage"));
const WorkflowPage = lazy(() => import("@/pages/admin/WorkflowPage"));
const SettingsPage = lazy(() => import("@/pages/admin/SettingsPage"));
const EnhancementRegisterPage = lazy(() => import("@/pages/admin/EnhancementRegisterPage"));
const DocumentStudioPage = lazy(() => import("@/pages/documents/DocumentStudioPage"));
const DailyObservationsPage = lazy(() => import("@/pages/coordination/DailyObservationsPage"));
const CaseManagementPage = lazy(() => import("@/pages/case/CaseManagementPage"));
const CrisisResponsePage = lazy(() => import("@/pages/case/CrisisResponsePage"));
const ResidentialDashboardV2 = lazy(() => import("@/pages/residential/ResidentialDashboardV2"));
const MedicationAdminPage = lazy(() => import("@/pages/residential/MedicationAdminPage"));
const ShiftHandoffPage = lazy(() => import("@/pages/residential/ShiftHandoffPage"));
const FamilyContactPage = lazy(() => import("@/pages/residential/FamilyContactPage"));
const MobileMARPage = lazy(() => import("@/pages/residential/MobileMARPage"));
const AuthorizationPage = lazy(() => import("@/pages/auth/AuthorizationPage"));
const ToolkitHubPage = lazy(() => import("@/pages/toolkits/ToolkitHubPage"));
const ChartAuditPage = lazy(() => import("@/pages/toolkits/ChartAuditPage"));
const CANSAssessmentPage = lazy(() => import("@/pages/toolkits/CANSAssessmentPage"));
const TrainingTrackerPage = lazy(() => import("@/pages/training/TrainingTrackerPage"));
const NILSearchPage = lazy(() => import("@/pages/nil/NILSearchPage"));
const HHSCExportPage = lazy(() => import("@/pages/compliance/HHSCExportPage"));
const IntakeAssessmentPage = lazy(() => import("@/pages/IntakeAssessmentPage"));
const MeetingsEscalationsPage = lazy(() => import("@/pages/MeetingsEscalationsPage"));
const RecruitmentOnboardingPage = lazy(() => import("@/pages/RecruitmentOnboardingPage"));
const KnowledgePage = lazy(() => import("@/pages/knowledge/KnowledgePage"));
const WorkflowsPage = lazy(() => import("@/pages/workflows/WorkflowsPage"));
const MyWorkTodayPage = lazy(() => import("@/pages/workflows/MyWorkTodayPage"));
const BHCDashboardPage = lazy(() => import("@/pages/bhc/BHCDashboardPage"));
const GROComplianceDashboardPage = lazy(() => import("@/pages/gro/GROComplianceDashboardPage"));
const GROWorkspacePage = lazy(() => import("@/pages/gro/GROWorkspacePage"));
const ShiftLogPage = lazy(() => import("@/pages/gro/ShiftLogPage"));
const SafetyRoundPage = lazy(() => import("@/pages/gro/SafetyRoundPage"));
const YouthCareLogPage = lazy(() => import("@/pages/gro/YouthCareLogPage"));
const IncidentReportPage = lazy(() => import("@/pages/gro/IncidentReportPage"));
const SupervisionNotesPage = lazy(() => import("@/pages/gro/SupervisionNotesPage"));
const ShiftHandoffListPage = lazy(() => import("@/pages/gro/ShiftHandoffListPage"));
const CampusCensusDashboardPage = lazy(() => import("@/pages/campus/CampusCensusDashboardPage"));
const MGMAScorecardPage = lazy(() => import("@/pages/exec/MGMAScorecardPage"));
const StrategicProjectsHubPage = lazy(() => import("@/pages/exec/StrategicProjectsHubPage"));
const MarketingSiteReviewPage = lazy(() => import("@/pages/exec/MarketingSiteReviewPage"));
const Part2DashboardPage = lazy(() => import("@/pages/compliance/Part2DashboardPage"));
const CAPTrackerPage = lazy(() => import("@/pages/qa/CAPTrackerPage"));
const AuditBinderPage = lazy(() => import("@/pages/qa/AuditBinderPage"));
const EvidenceMatrixPage = lazy(() => import("@/pages/qa/EvidenceMatrixPage"));
const ComplianceMemoPage = lazy(() => import("@/pages/qa/ComplianceMemoPage"));
const DeficiencyTrackingPage = lazy(() => import("@/pages/qa/DeficiencyTrackingPage"));

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

function AppShellWrapper() {
  const location = useLocation();
  return (
    <AppShell>
      <Suspense fallback={<SuspenseFallback />}>
        <AnimatePresence mode="wait" initial={false}>
          <Outlet key={location.pathname} />
        </AnimatePresence>
      </Suspense>
    </AppShell>
  );
}

export default function AppShellRoutes() {
  return (
    <NotificationProvider>
    <OnboardingProvider>
    <FacilityProvider>
      <ErrorBoundary>
        <ProtectedRoute>
          <Routes>
            <Route element={<AppShellWrapper />}>
              <Route path="/" element={<DashboardPage />} />
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
              <Route element={<HRLayout />}>
                <Route path="/hr" element={<HRCommandCenterPage />} />
                <Route path="/hr/:moduleId" element={<HRModulePage />} />
                <Route path="/hr/person/:personId" element={<HRPersonProfilePage />} />
                <Route path="/hr/credentials-tracker" element={<CredentialTrackingPage />} />
                <Route path="/hr/separations" element={<SeparationManagementPage />} />
                <Route path="/hr/training-assignments" element={<TrainingAssignmentPage />} />
                <Route path="/hr/performance-reviews" element={<PerformanceReviewPage />} />
                <Route path="/hr/onboarding-workflow" element={<OnboardingWorkflowPage />} />
              </Route>
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/revenue" element={<RevenueDashboardPage />} />
              <Route path="/revenue/claims" element={<ClaimsListPage />} />
              <Route path="/revenue/submission" element={<ClaimSubmissionPage />} />
              <Route path="/revenue/authorizations" element={<AuthorizationManagementPage />} />
              <Route path="/revenue/packets" element={<PayerPacketBuilderPage />} />
              <Route path="/revenue/denials" element={<DenialManagementPage />} />
              <Route path="/revenue/aging" element={<AgingQueuePage />} />
              <Route path="/revenue/pos-gate" element={<ProofOfServiceGatePage />} />
              <Route path="/qa" element={<QADashboardPage />} />
              <Route path="/qa/registry" element={<QAListPage />} />
              <Route path="/qa/cap-tracker" element={<CAPTrackerPage />} />
              <Route path="/qa/audit-binder" element={<AuditBinderPage />} />
              <Route path="/qa/evidence-matrix" element={<EvidenceMatrixPage />} />
              <Route path="/qa/memos" element={<ComplianceMemoPage />} />
              <Route path="/qa/deficiencies" element={<DeficiencyTrackingPage />} />
              <Route path="/gro" element={<GRODashboardPage />} />
              <Route path="/gad" element={<GADDashboardPage />} />
              <Route path="/executive" element={<ExecutiveDashboardPage />} />
              <Route path="/executive/mgma" element={<MGMAScorecardPage />} />
              <Route path="/executive/strategic-projects" element={<StrategicProjectsHubPage />} />
              <Route path="/executive/marketing-review" element={<MarketingSiteReviewPage />} />
              <Route path="/bhc" element={<BHCDashboardPage />} />
              <Route path="/gro" element={<GROWorkspacePage />} />
              <Route path="/gro/compliance" element={<GROComplianceDashboardPage />} />
              <Route path="/gro/workspace" element={<GROWorkspacePage />} />
              <Route path="/gro/shift-logs" element={<ShiftLogPage />} />
              <Route path="/gro/safety-rounds" element={<SafetyRoundPage />} />
              <Route path="/gro/care-logs" element={<YouthCareLogPage />} />
              <Route path="/gro/incidents" element={<IncidentReportPage />} />
              <Route path="/gro/supervision" element={<SupervisionNotesPage />} />
              <Route path="/gro/handoffs" element={<ShiftHandoffListPage />} />
              <Route path="/campus" element={<CampusCensusDashboardPage />} />
              <Route path="/nil" element={<NILGraphPage />} />
              <Route path="/nil/search" element={<NILSearchPage />} />
              <Route path="/admin/entra-id" element={<EntraIDPage />} />
              <Route path="/admin/workflows" element={<WorkflowPage />} />
              <Route path="/admin/settings" element={<SettingsPage />} />
              <Route path="/admin/enhancements" element={<EnhancementRegisterPage />} />
              <Route path="/documents" element={<DocumentStudioPage />} />
              <Route path="/clinical" element={<ClinicalDashboardPage />} />
              <Route path="/clinical/patients" element={<PatientListPage />} />
              <Route path="/clinical/patients/:id" element={<PatientProfilePage />} />
              <Route path="/clinical/treatment-plans" element={<TreatmentPlansPage />} />
              <Route path="/clinical/sessions" element={<ClinicalSessionsPage />} />
              <Route path="/clinical/outcome-measures" element={<OutcomeMeasuresPage />} />
              <Route path="/clinical/insurance-plans" element={<InsurancePlansPage />} />
              <Route path="/clinical/referrals" element={<ReferralIntakePage />} />
              <Route path="/clinical/cans-assessments" element={<CansAssessmentPage />} />
              <Route path="/clinical/service-delivery" element={<ServiceDeliveryPage />} />
              <Route path="/workflows" element={<WorkflowsPage />} />
              <Route path="/workflows/my-work-today" element={<MyWorkTodayPage />} />
              <Route path="/intake" element={<IntakeAssessmentPage />} />
              <Route path="/observations" element={<DailyObservationsPage />} />
              <Route path="/meetings" element={<MeetingsEscalationsPage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              {/* /hr now routes to HRCommandCenterPage within HRLayout above */}
              <Route path="/cases" element={<CaseManagementPage />} />
              <Route path="/crisis" element={<CrisisResponsePage />} />
              <Route path="/residential" element={<ResidentialDashboardV2 />} />
              <Route path="/medications" element={<MedicationAdminPage />} />
              <Route path="/handoffs" element={<ShiftHandoffPage />} />
              <Route path="/family" element={<FamilyContactPage />} />
              <Route path="/mobile-mar" element={<MobileMARPage />} />
              <Route path="/authorizations" element={<AuthorizationPage />} />
              <Route path="/toolkits" element={<ToolkitHubPage />} />
              <Route path="/toolkits/chart-audit" element={<ChartAuditPage />} />
              <Route path="/toolkits/cans" element={<CANSAssessmentPage />} />
              <Route path="/training" element={<TrainingTrackerPage />} />
              <Route path="/compliance/hhsc-export" element={<HHSCExportPage />} />
              <Route path="/compliance/part2" element={<Part2DashboardPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ProtectedRoute>
      </ErrorBoundary>
    </FacilityProvider>
    </OnboardingProvider>
    </NotificationProvider>
  );
}
