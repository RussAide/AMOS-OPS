import { lazy, Suspense } from "react";
import { Routes, Route, Navigate, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import type React from "react";
import { OnboardingProvider } from "@/context/onboarding-context";
import { useAuth } from "@/hooks/use-auth";
import { NotificationProvider } from "@/context/notification-context";
import { ErrorBoundary } from "@/components/error-boundary";
import { AppShell } from "@/components/shell/app-shell";
import { FacilityProvider } from "@/context/facility-context";
import { SuspenseFallback } from "@/components/shell/suspense-fallback";
import { authorizeClientRoute } from "@/constants/access-control";

/* ─── Lazy Pages ─── */
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const OnboardingLayout = lazy(
  () => import("@/pages/onboarding/onboarding-layout"),
);
const OnboardingHomePage = lazy(
  () => import("@/pages/onboarding/onboarding-home-page"),
);
const SupervisorPage = lazy(() => import("@/pages/onboarding/supervisor-page"));
const ManagementPage = lazy(() => import("@/pages/onboarding/management-page"));
const TrackPage = lazy(() => import("@/pages/onboarding/track-page"));
const TrainingPage = lazy(() => import("@/pages/onboarding/training-page"));
const EvidencePage = lazy(() => import("@/pages/onboarding/evidence-page"));
const ModulePage = lazy(() => import("@/pages/onboarding/module-page"));
const EmployeePage = lazy(() => import("@/pages/onboarding/employee-page"));
const HRLayout = lazy(() => import("@/pages/hr/hr-layout"));
const HRCommandCenterPage = lazy(
  () => import("@/pages/hr/hr-command-center-page"),
);
const HRModulePage = lazy(() => import("@/pages/hr/hr-module-page"));
const HRPersonProfilePage = lazy(
  () => import("@/pages/hr/hr-person-profile-page"),
);
const CredentialTrackingPage = lazy(
  () => import("@/pages/hr/credential-tracking-page"),
);
const SeparationManagementPage = lazy(
  () => import("@/pages/hr/separation-management-page"),
);
const TrainingAssignmentPage = lazy(
  () => import("@/pages/hr/training-assignment-page"),
);
const PerformanceReviewPage = lazy(
  () => import("@/pages/hr/performance-review-page"),
);
const OnboardingWorkflowPage = lazy(
  () => import("@/pages/hr/onboarding-workflow-page"),
);
const AnalyticsPage = lazy(() => import("@/pages/analytics/analytics-page"));
const ClinicalDashboardPage = lazy(
  () => import("@/pages/clinical/clinical-dashboard-page"),
);
const M41cClinicalIntelligencePage = lazy(
  () => import("@/pages/clinical/m41c-clinical-intelligence-page"),
);
const PatientListPage = lazy(
  () => import("@/pages/clinical/patient-list-page"),
);
const PatientProfilePage = lazy(
  () => import("@/pages/clinical/patient-profile-page"),
);
const TreatmentPlansPage = lazy(
  () => import("@/pages/clinical/treatment-plans-page"),
);
const ClinicalSessionsPage = lazy(
  () => import("@/pages/clinical/clinical-sessions-page"),
);
const OutcomeMeasuresPage = lazy(
  () => import("@/pages/clinical/outcome-measures-page"),
);
const InsurancePlansPage = lazy(
  () => import("@/pages/clinical/insurance-plans-page"),
);
const ReferralIntakePage = lazy(
  () => import("@/pages/clinical/referral-intake-page"),
);
const CansAssessmentPage = lazy(
  () => import("@/pages/clinical/cans-assessment-page"),
);
const ServiceDeliveryPage = lazy(
  () => import("@/pages/clinical/service-delivery-page"),
);
const RevenueDashboardPage = lazy(
  () => import("@/pages/revenue/revenue-dashboard-page"),
);
const ClaimsListPage = lazy(() => import("@/pages/revenue/claims-list-page"));
const ClaimSubmissionPage = lazy(
  () => import("@/pages/revenue/claim-submission-page"),
);
const AuthorizationManagementPage = lazy(
  () => import("@/pages/revenue/authorization-management-page"),
);
const PayerPacketBuilderPage = lazy(
  () => import("@/pages/revenue/payer-packet-builder-page"),
);
const DenialManagementPage = lazy(
  () => import("@/pages/revenue/denial-management-page"),
);
const AgingQueuePage = lazy(() => import("@/pages/revenue/aging-queue-page"));
const ProofOfServiceGatePage = lazy(
  () => import("@/pages/revenue/proof-of-service-gate-page"),
);
const QADashboardPage = lazy(() => import("@/pages/qa/qa-dashboard-page"));
const QAListPage = lazy(() => import("@/pages/qa/qa-list-page"));
const GRODashboardPage = lazy(() => import("@/pages/gro/gro-dashboard-page"));
const GADDashboardPage = lazy(() => import("@/pages/gad/gad-dashboard-page"));
const ExecutiveDashboardPage = lazy(
  () => import("@/pages/exec/executive-dashboard-page"),
);
const M41aDecisionIntelligencePage = lazy(
  () => import("@/pages/exec/m41a-decision-intelligence-page"),
);
const NILGraphPage = lazy(() => import("@/pages/nil-graph-page"));
const EntraIDPage = lazy(() => import("@/pages/admin/entra-id-page"));
const WorkflowPage = lazy(() => import("@/pages/admin/workflow-page"));
const SettingsPage = lazy(() => import("@/pages/admin/settings-page"));
const EnhancementRegisterPage = lazy(
  () => import("@/pages/admin/enhancement-register-page"),
);
const DocumentStudioPage = lazy(
  () => import("@/pages/documents/document-studio-page"),
);
const DailyObservationsPage = lazy(
  () => import("@/pages/coordination/daily-observations-page"),
);
const CaseManagementPage = lazy(
  () => import("@/pages/case/case-management-page"),
);
const CrisisResponsePage = lazy(
  () => import("@/pages/case/crisis-response-page"),
);
const ResidentialDashboardV2 = lazy(
  () => import("@/pages/residential/residential-dashboard-v2"),
);
const MedicationAdminPage = lazy(
  () => import("@/pages/residential/medication-admin-page"),
);
const ShiftHandoffPage = lazy(
  () => import("@/pages/residential/shift-handoff-page"),
);
const FamilyContactPage = lazy(
  () => import("@/pages/residential/family-contact-page"),
);
const MobileMARPage = lazy(() => import("@/pages/residential/mobile-mar-page"));
const AuthorizationPage = lazy(() => import("@/pages/auth/authorization-page"));
const ToolkitHubPage = lazy(() => import("@/pages/toolkits/toolkit-hub-page"));
const ChartAuditPage = lazy(() => import("@/pages/toolkits/chart-audit-page"));
const CANSAssessmentPage = lazy(
  () => import("@/pages/toolkits/cans-assessment-page"),
);
const TrainingTrackerPage = lazy(
  () => import("@/pages/training/training-tracker-page"),
);
const NILSearchPage = lazy(() => import("@/pages/nil/nil-search-page"));
const HHSCExportPage = lazy(
  () => import("@/pages/compliance/hhsc-export-page"),
);
const IntakeAssessmentPage = lazy(
  () => import("@/pages/intake/assessment-page"),
);
const MeetingsEscalationsPage = lazy(
  () => import("@/pages/meetings-escalations-page"),
);
const KnowledgePage = lazy(() => import("@/pages/knowledge/knowledge-page"));
const M42DocumentKnowledgePage = lazy(
  () => import("@/pages/knowledge/m42-document-knowledge-page"),
);
const M51AOperationsHubPage = lazy(
  () => import("@/pages/operations-hub/m51a-operations-hub-page"),
);
const M51BMicrosoftIntegrationsPage = lazy(
  () => import("@/pages/operations-hub/m51b-microsoft-integrations-page"),
);
const M52MobileOfflinePage = lazy(
  () => import("@/pages/operations-hub/m52-mobile-offline-page"),
);
const Dx1EnterpriseDemoPage = lazy(
  () => import("@/pages/operations-hub/dx1-enterprise-demo-page"),
);
const WorkflowsPage = lazy(() => import("@/pages/workflows/workflows-page"));
const MyWorkTodayPage = lazy(
  () => import("@/pages/workflows/my-work-today-page"),
);
const M41bIntelligenceAssistantPage = lazy(
  () => import("@/pages/exec/m41b-intelligence-assistant-page"),
);
const BHCDashboardPage = lazy(() => import("@/pages/bhc/bhc-dashboard-page"));
const CcmgOversightPage = lazy(
  () => import("@/pages/ccmg/ccmg-oversight-page"),
);
const CcmgReferralDetailPage = lazy(
  () => import("@/pages/ccmg/ccmg-referral-detail-page"),
);
const Phase2ContinuumPage = lazy(
  () => import("@/pages/phase2/phase2-continuum-page"),
);
const M23WorkspacePage = lazy(() => import("@/pages/mhrs/m23-workspace-page"));
const M22CaseManagementPage = lazy(
  () => import("@/pages/mhtcm/m22-case-management-page"),
);
const M24ResidentialOperationsPage = lazy(
  () => import("@/pages/gro/m24-residential-operations-page"),
);
const GROComplianceDashboardPage = lazy(
  () => import("@/pages/gro/gro-compliance-dashboard-page"),
);
const GROWorkspacePage = lazy(() => import("@/pages/gro/gro-workspace-page"));
const ShiftLogPage = lazy(() => import("@/pages/gro/shift-log-page"));
const SafetyRoundPage = lazy(() => import("@/pages/gro/safety-round-page"));
const YouthCareLogPage = lazy(() => import("@/pages/gro/youth-care-log-page"));
const IncidentReportPage = lazy(
  () => import("@/pages/gro/incident-report-page"),
);
const SupervisionNotesPage = lazy(
  () => import("@/pages/gro/supervision-notes-page"),
);
const ShiftHandoffListPage = lazy(
  () => import("@/pages/gro/shift-handoff-list-page"),
);
const CampusCensusDashboardPage = lazy(
  () => import("@/pages/campus/campus-census-dashboard-page"),
);
const MGMAScorecardPage = lazy(
  () => import("@/pages/exec/mgma-scorecard-page"),
);
const StrategicProjectsHubPage = lazy(
  () => import("@/pages/exec/strategic-projects-hub-page"),
);
const MarketingSiteReviewPage = lazy(
  () => import("@/pages/exec/marketing-site-review-page"),
);
const Part2DashboardPage = lazy(
  () => import("@/pages/compliance/part2-dashboard-page"),
);
const RegulatoryFrameworkPage = lazy(
  () => import("@/pages/compliance/regulatory-framework-page"),
);
const CAPTrackerPage = lazy(() => import("@/pages/qa/cap-tracker-page"));
const AuditBinderPage = lazy(() => import("@/pages/qa/audit-binder-page"));
const EvidenceMatrixPage = lazy(
  () => import("@/pages/qa/evidence-matrix-page"),
);
const ComplianceMemoPage = lazy(
  () => import("@/pages/qa/compliance-memo-page"),
);
const DeficiencyTrackingPage = lazy(
  () => import("@/pages/qa/deficiency-tracking-page"),
);
const OrganizationModelPage = lazy(
  () => import("@/pages/admin/organization-model-page"),
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        }}
      >
        <div className="text-center">
          <div
            className="w-12 h-12 rounded-2xl mx-auto mb-4 animate-pulse"
            style={{ backgroundColor: "rgba(233,196,106,0.15)" }}
          />
          <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.5)" }}>
            Loading AMOS-OPS...
          </p>
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
  const { currentRole } = useAuth();
  const access = authorizeClientRoute(currentRole, location.pathname);

  if (!access.allowed) {
    return (
      <AppShell>
        <main
          className="m-6 rounded-lg border p-6"
          style={{ backgroundColor: "var(--card-bg)", borderColor: "#FCA5A5" }}
        >
          <p
            className="text-[10px] font-semibold uppercase tracking-[1px]"
            style={{ color: "#B91C1C" }}
          >
            Access denied
          </p>
          <h1
            className="text-[20px] font-bold mt-1"
            style={{ color: "var(--topbar-title)" }}
          >
            This route is outside your explicit role scope.
          </h1>
          <p
            className="text-[13px] mt-2"
            style={{ color: "var(--topbar-subtitle)" }}
          >
            {access.reason}
          </p>
        </main>
      </AppShell>
    );
  }
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
                    <Route
                      path="/onboarding"
                      element={<OnboardingHomePage />}
                    />
                    <Route
                      path="/onboarding/supervisor"
                      element={<SupervisorPage />}
                    />
                    <Route
                      path="/onboarding/management"
                      element={<ManagementPage />}
                    />
                    <Route
                      path="/onboarding/track/:trackId"
                      element={<TrackPage />}
                    />
                    <Route
                      path="/onboarding/training"
                      element={<TrainingPage />}
                    />
                    <Route
                      path="/onboarding/evidence"
                      element={<EvidencePage />}
                    />
                    <Route
                      path="/onboarding/module/:moduleId"
                      element={<ModulePage />}
                    />
                    <Route
                      path="/onboarding/employee/:id"
                      element={<EmployeePage />}
                    />
                  </Route>
                  <Route element={<HRLayout />}>
                    <Route path="/hr" element={<HRCommandCenterPage />} />
                    <Route path="/hr/:moduleId" element={<HRModulePage />} />
                    <Route
                      path="/hr/person/:personId"
                      element={<HRPersonProfilePage />}
                    />
                    <Route
                      path="/hr/credentials-tracker"
                      element={<CredentialTrackingPage />}
                    />
                    <Route
                      path="/hr/separations"
                      element={<SeparationManagementPage />}
                    />
                    <Route
                      path="/hr/training-assignments"
                      element={<TrainingAssignmentPage />}
                    />
                    <Route
                      path="/hr/performance-reviews"
                      element={<PerformanceReviewPage />}
                    />
                    <Route
                      path="/hr/onboarding-workflow"
                      element={<OnboardingWorkflowPage />}
                    />
                  </Route>
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/revenue" element={<RevenueDashboardPage />} />
                  <Route path="/revenue/claims" element={<ClaimsListPage />} />
                  <Route
                    path="/revenue/submission"
                    element={<ClaimSubmissionPage />}
                  />
                  <Route
                    path="/revenue/authorizations"
                    element={<AuthorizationManagementPage />}
                  />
                  <Route
                    path="/revenue/packets"
                    element={<PayerPacketBuilderPage />}
                  />
                  <Route
                    path="/revenue/denials"
                    element={<DenialManagementPage />}
                  />
                  <Route path="/revenue/aging" element={<AgingQueuePage />} />
                  <Route
                    path="/revenue/pos-gate"
                    element={<ProofOfServiceGatePage />}
                  />
                  <Route path="/qa" element={<QADashboardPage />} />
                  <Route path="/qa/registry" element={<QAListPage />} />
                  <Route path="/qa/cap-tracker" element={<CAPTrackerPage />} />
                  <Route
                    path="/qa/audit-binder"
                    element={<AuditBinderPage />}
                  />
                  <Route
                    path="/qa/evidence-matrix"
                    element={<EvidenceMatrixPage />}
                  />
                  <Route path="/qa/memos" element={<ComplianceMemoPage />} />
                  <Route
                    path="/qa/deficiencies"
                    element={<DeficiencyTrackingPage />}
                  />
                  <Route path="/gro" element={<GRODashboardPage />} />
                  <Route path="/gad" element={<GADDashboardPage />} />
                  <Route
                    path="/executive"
                    element={<ExecutiveDashboardPage />}
                  />
                  <Route
                    path="/executive/decision-intelligence"
                    element={<M41aDecisionIntelligencePage />}
                  />
                  <Route
                    path="/executive/mgma"
                    element={<MGMAScorecardPage />}
                  />
                  <Route
                    path="/executive/strategic-projects"
                    element={<StrategicProjectsHubPage />}
                  />
                  <Route
                    path="/executive/marketing-review"
                    element={<MarketingSiteReviewPage />}
                  />
                  <Route path="/bhc" element={<BHCDashboardPage />} />
                  <Route path="/ccmg" element={<CcmgOversightPage />} />
                  <Route
                    path="/ccmg/referrals/:referralId"
                    element={<CcmgReferralDetailPage />}
                  />
                  <Route path="/continuum" element={<Phase2ContinuumPage />} />
                  <Route path="/mhrs" element={<M23WorkspacePage />} />
                  <Route path="/mhtcm" element={<M22CaseManagementPage />} />
                  <Route
                    path="/gro/residential-operations"
                    element={<M24ResidentialOperationsPage />}
                  />
                  <Route path="/gro" element={<GROWorkspacePage />} />
                  <Route
                    path="/gro/compliance"
                    element={<GROComplianceDashboardPage />}
                  />
                  <Route path="/gro/workspace" element={<GROWorkspacePage />} />
                  <Route path="/gro/shift-logs" element={<ShiftLogPage />} />
                  <Route
                    path="/gro/safety-rounds"
                    element={<SafetyRoundPage />}
                  />
                  <Route path="/gro/care-logs" element={<YouthCareLogPage />} />
                  <Route
                    path="/gro/incidents"
                    element={<IncidentReportPage />}
                  />
                  <Route
                    path="/gro/supervision"
                    element={<SupervisionNotesPage />}
                  />
                  <Route
                    path="/gro/handoffs"
                    element={<ShiftHandoffListPage />}
                  />
                  <Route
                    path="/campus"
                    element={<CampusCensusDashboardPage />}
                  />
                  <Route path="/nil" element={<NILGraphPage />} />
                  <Route path="/nil/search" element={<NILSearchPage />} />
                  <Route path="/admin/entra-id" element={<EntraIDPage />} />
                  <Route path="/admin/workflows" element={<WorkflowPage />} />
                  <Route path="/admin/settings" element={<SettingsPage />} />
                  <Route
                    path="/admin/organization"
                    element={<OrganizationModelPage />}
                  />
                  <Route
                    path="/admin/enhancements"
                    element={<EnhancementRegisterPage />}
                  />
                  <Route path="/documents" element={<DocumentStudioPage />} />
                  <Route path="/clinical" element={<ClinicalDashboardPage />} />
                  <Route
                    path="/clinical/intelligence-fabric"
                    element={<M41cClinicalIntelligencePage />}
                  />
                  <Route
                    path="/clinical/patients"
                    element={<PatientListPage />}
                  />
                  <Route
                    path="/clinical/patients/:id"
                    element={<PatientProfilePage />}
                  />
                  <Route
                    path="/clinical/treatment-plans"
                    element={<TreatmentPlansPage />}
                  />
                  <Route
                    path="/clinical/sessions"
                    element={<ClinicalSessionsPage />}
                  />
                  <Route
                    path="/clinical/outcome-measures"
                    element={<OutcomeMeasuresPage />}
                  />
                  <Route
                    path="/clinical/insurance-plans"
                    element={<InsurancePlansPage />}
                  />
                  <Route
                    path="/clinical/referrals"
                    element={<ReferralIntakePage />}
                  />
                  <Route
                    path="/clinical/cans-assessments"
                    element={<CansAssessmentPage />}
                  />
                  <Route
                    path="/clinical/service-delivery"
                    element={<ServiceDeliveryPage />}
                  />
                  <Route path="/workflows" element={<WorkflowsPage />} />
                  <Route
                    path="/workflows/intelligence-assistant"
                    element={<M41bIntelligenceAssistantPage />}
                  />
                  <Route
                    path="/workflows/my-work-today"
                    element={<MyWorkTodayPage />}
                  />
                  <Route path="/intake" element={<IntakeAssessmentPage />} />
                  <Route
                    path="/observations"
                    element={<DailyObservationsPage />}
                  />
                  <Route
                    path="/meetings"
                    element={<MeetingsEscalationsPage />}
                  />
                  <Route path="/knowledge" element={<KnowledgePage />} />
                  <Route
                    path="/knowledge/document-intelligence"
                    element={<M42DocumentKnowledgePage />}
                  />
                  <Route
                    path="/operations-hub"
                    element={<M51AOperationsHubPage />}
                  />
                  <Route
                    path="/operations-hub/microsoft-integrations"
                    element={<M51BMicrosoftIntegrationsPage />}
                  />
                  <Route
                    path="/operations-hub/mobile-offline"
                    element={<M52MobileOfflinePage />}
                  />
                  <Route
                    path="/operations-hub/enterprise-demo"
                    element={<Dx1EnterpriseDemoPage />}
                  />
                  {/* /hr now routes to HRCommandCenterPage within HRLayout above */}
                  <Route path="/cases" element={<CaseManagementPage />} />
                  <Route path="/crisis" element={<CrisisResponsePage />} />
                  <Route
                    path="/residential"
                    element={<ResidentialDashboardV2 />}
                  />
                  <Route
                    path="/medications"
                    element={<MedicationAdminPage />}
                  />
                  <Route path="/handoffs" element={<ShiftHandoffPage />} />
                  <Route path="/family" element={<FamilyContactPage />} />
                  <Route path="/mobile-mar" element={<MobileMARPage />} />
                  <Route
                    path="/authorizations"
                    element={<AuthorizationPage />}
                  />
                  <Route path="/toolkits" element={<ToolkitHubPage />} />
                  <Route
                    path="/toolkits/chart-audit"
                    element={<ChartAuditPage />}
                  />
                  <Route
                    path="/toolkits/cans"
                    element={<CANSAssessmentPage />}
                  />
                  <Route path="/training" element={<TrainingTrackerPage />} />
                  <Route
                    path="/compliance/hhsc-export"
                    element={<HHSCExportPage />}
                  />
                  <Route
                    path="/compliance/part2"
                    element={<Part2DashboardPage />}
                  />
                  <Route
                    path="/compliance/regulatory-framework"
                    element={<RegulatoryFrameworkPage />}
                  />
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
