import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { AppSidebar } from "./app-sidebar";

// ─── HOME / DASHBOARD ───
import DashboardPage from "@/pages/dashboard-page";

// ─── CLINICAL / BHC ───
import ClinicalDashboardPage from "@/pages/clinical/clinical-dashboard-page";
import ClinicalSessionsPage from "@/pages/clinical/clinical-sessions-page";
import ClinicalWorkspacePage from "@/pages/clinical/clinical-workspace-page";
import TreatmentPlansPage from "@/pages/clinical/treatment-plans-page";
import CansAssessmentPage from "@/pages/clinical/cans-assessment-page";
import OutcomeMeasuresPage from "@/pages/clinical/outcome-measures-page";
import InsurancePlansPage from "@/pages/clinical/insurance-plans-page";
import ReferralIntakePage from "@/pages/clinical/referral-intake-page";
import ServiceDeliveryPage from "@/pages/clinical/service-delivery-page";
import PatientListPage from "@/pages/clinical/patient-list-page";
import PatientProfilePage from "@/pages/clinical/patient-profile-page";

// ─── INTAKE ───
import IntakePipelinePage from "@/pages/intake/intake-pipeline-page";
import IntakeAssessmentPage from "@/pages/intake/assessment-page";

// ─── CRISIS / CASE ───
import CrisisResponsePage from "@/pages/case/crisis-response-page";
import CaseManagementPage from "@/pages/case/case-management-page";

// ─── GRO / RESIDENTIAL ───
import GroDashboardPage from "@/pages/gro/gro-dashboard-page";
import GroWorkspacePage from "@/pages/gro/gro-workspace-page";
import GroComplianceDashboardPage from "@/pages/gro/gro-compliance-dashboard-page";
import IncidentReportPage from "@/pages/gro/incident-report-page";
import ShiftLogPage from "@/pages/gro/shift-log-page";
import ShiftHandoffListPage from "@/pages/gro/shift-handoff-list-page";
import SafetyRoundPage from "@/pages/gro/safety-round-page";
import YouthCareLogPage from "@/pages/gro/youth-care-log-page";
import SupervisionNotesPage from "@/pages/gro/supervision-notes-page";

// ─── RESIDENTIAL (MEDICATION, FAMILY) ───
import ResidentialDashboardV2Page from "@/pages/residential/residential-dashboard-v2";
import MedicationAdminPage from "@/pages/residential/medication-admin-page";
import MobileMarPage from "@/pages/residential/mobile-mar-page";
import MarFacilityViewPage from "@/pages/residential/mar-facility-view";
import FamilyContactPage from "@/pages/residential/family-contact-page";
import ShiftHandoffPage from "@/pages/residential/shift-handoff-page";
import PredictiveAnalyticsPage from "@/pages/residential/predictive-analytics";

// ─── COORDINATION ───
import DailyObservationsPage from "@/pages/coordination/daily-observations-page";
import MeetingCadencePage from "@/pages/coordination/meeting-cadence-page";
import EscalationLadderPage from "@/pages/coordination/escalation-ladder";

// ─── BHC DASHBOARD ───
import BhcDashboardPage from "@/pages/bhc/bhc-dashboard-page";

// ─── CAMPUS ───
import CampusCensusDashboardPage from "@/pages/campus/campus-census-dashboard-page";

// ─── QA / COMPLIANCE ───
import QaDashboardPage from "@/pages/qa/qa-dashboard-page";
import QaListPage from "@/pages/qa/qa-list-page";
import AuditBinderPage from "@/pages/qa/audit-binder-page";
import CapTrackerPage from "@/pages/qa/cap-tracker-page";
import ComplianceMemoPage from "@/pages/qa/compliance-memo-page";
import DeficiencyTrackingPage from "@/pages/qa/deficiency-tracking-page";
import EvidenceMatrixPage from "@/pages/qa/evidence-matrix-page";
import HhscExportPage from "@/pages/compliance/hhsc-export-page";
import Part2DashboardPage from "@/pages/compliance/part2-dashboard-page";

// ─── TOOLKITS ───
import ChartAuditPage from "@/pages/toolkits/chart-audit-page";
import ToolkitHubPage from "@/pages/toolkits/toolkit-hub-page";

// ─── REVENUE ───
import RevenueDashboardPage from "@/pages/revenue/revenue-dashboard-page";
import ClaimsListPage from "@/pages/revenue/claims-list-page";
import ClaimSubmissionPage from "@/pages/revenue/claim-submission-page";
import DenialManagementPage from "@/pages/revenue/denial-management-page";
import AuthorizationManagementPage from "@/pages/revenue/authorization-management-page";
import AgingQueuePage from "@/pages/revenue/aging-queue-page";
import ProofOfServiceGatePage from "@/pages/revenue/proof-of-service-gate-page";
import PayerPacketBuilderPage from "@/pages/revenue/payer-packet-builder-page";

// ─── HR ───
import HrCommandCenterPage from "@/pages/hr/hr-command-center-page";
import HrPersonProfilePage from "@/pages/hr/hr-person-profile-page";
import CredentialTrackingPage from "@/pages/hr/credential-tracking-page";
import PerformanceReviewPage from "@/pages/hr/performance-review-page";
import OnboardingWorkflowPage from "@/pages/hr/onboarding-workflow-page";
import SeparationManagementPage from "@/pages/hr/separation-management-page";
import HrModulePage from "@/pages/hr/hr-module-page";
import HrLayout from "@/pages/hr/hr-layout";
import TrainingAssignmentPage from "@/pages/hr/training-assignment-page";
import RecruitmentOnboardingPage from "@/pages/recruitment-onboarding-page";
import TrainingTrackerPage from "@/pages/training/training-tracker-page";

// ─── EXECUTIVE ───
import ExecutiveDashboardPage from "@/pages/exec/executive-dashboard-page";
import MgmaScorecardPage from "@/pages/exec/mgma-scorecard-page";
import StrategicProjectsHubPage from "@/pages/exec/strategic-projects-hub-page";
import MarketingSiteReviewPage from "@/pages/exec/marketing-site-review-page";

// ─── GAD ───
import GadDashboardPage from "@/pages/gad/gad-dashboard-page";

// ─── ANALYTICS ───
import AnalyticsPage from "@/pages/analytics-page";

// ─── DOCUMENTS / DMS ───
import DocumentStudioPage from "@/pages/documents/document-studio-page";

// ─── KNOWLEDGE ───
import KnowledgePage from "@/pages/knowledge/knowledge-page";

// ─── NIL ───
import NilSearchPage from "@/pages/nil/nil-search-page";
import NilGraphPage from "@/pages/nil-graph-page";

// ─── WORKFLOWS ───
import WorkflowsPage from "@/pages/workflows/workflows-page";
import MyWorkTodayPage from "@/pages/workflows/my-work-today-page";

// ─── ONBOARDING ───
import OnboardingHomePage from "@/pages/onboarding/onboarding-home-page";
import OnboardingLayout from "@/pages/onboarding/onboarding-layout";
import OnboardingTrackPage from "@/pages/onboarding/track-page";
import OnboardingModulePage from "@/pages/onboarding/module-page";
import OnboardingEmployeePage from "@/pages/onboarding/employee-page";
import OnboardingSupervisorPage from "@/pages/onboarding/supervisor-page";
import OnboardingManagementPage from "@/pages/onboarding/management-page";
import OnboardingEvidencePage from "@/pages/onboarding/evidence-page";
import OnboardingTrainingPage from "@/pages/onboarding/training-page";

// ─── ADMIN ───
import SettingsPage from "@/pages/admin/settings-page";
import WorkflowAdminPage from "@/pages/admin/workflow-page";
import EntraIdPage from "@/pages/admin/entra-id-page";
import EnhancementRegisterPage from "@/pages/admin/enhancement-register-page";

// ─── AUTH ───
import LoginPage from "@/pages/login-page";
import AuthorizationPage from "@/pages/auth/authorization-page";

// ─── MY SHIFT / PERSONAL ───
import MyShiftPage from "@/pages/my-shift-page";
import MyWorkTodayAltPage from "@/pages/my-work-today-page";
import MeetingsEscalationsPage from "@/pages/meetings-escalations-page";
import SOPKnowledgePage from "@/pages/sop-knowledge-page";

// ─── INTAKE ASSESSMENT ───
import IntakeAssessmentAltPage from "@/pages/intake-assessment-page";

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
        <Route path="/login" element={<LoginPage />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <AppSidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <Routes>
            {/* ─── HOME ─── */}
            <Route path="/" element={<DashboardPage />} />

            {/* ─── CLINICAL / BHC ─── */}
            <Route path="/clinical" element={<ClinicalDashboardPage />} />
            <Route path="/clinical/sessions" element={<ClinicalSessionsPage />} />
            <Route path="/clinical/treatment-plans" element={<TreatmentPlansPage />} />
            <Route path="/clinical/cans-assessments" element={<CansAssessmentPage />} />
            <Route path="/clinical/outcome-measures" element={<OutcomeMeasuresPage />} />
            <Route path="/clinical/insurance-plans" element={<InsurancePlansPage />} />
            <Route path="/clinical/referrals" element={<ReferralIntakePage />} />
            <Route path="/clinical/service-delivery" element={<ServiceDeliveryPage />} />
            <Route path="/clinical/patients" element={<PatientListPage />} />
            <Route path="/clinical/patient/:id" element={<PatientProfilePage />} />
            <Route path="/clinical/workspace" element={<ClinicalWorkspacePage />} />

            {/* ─── BHC DASHBOARD ─── */}
            <Route path="/bhc" element={<BhcDashboardPage />} />

            {/* ─── INTAKE ─── */}
            <Route path="/intake" element={<IntakePipelinePage />} />
            <Route path="/intake/pipeline" element={<IntakePipelinePage />} />
            <Route path="/intake/assessment" element={<IntakeAssessmentPage />} />

            {/* ─── CRISIS / CASE ─── */}
            <Route path="/crisis" element={<CrisisResponsePage />} />
            <Route path="/cases" element={<CaseManagementPage />} />

            {/* ─── GRO / RESIDENTIAL ─── */}
            <Route path="/gro" element={<GroDashboardPage />} />
            <Route path="/gro/workspace" element={<GroWorkspacePage />} />
            <Route path="/gro/compliance" element={<GroComplianceDashboardPage />} />
            <Route path="/gro/incidents" element={<IncidentReportPage />} />
            <Route path="/gro/shift-logs" element={<ShiftLogPage />} />
            <Route path="/gro/safety-rounds" element={<SafetyRoundPage />} />
            <Route path="/gro/care-logs" element={<YouthCareLogPage />} />
            <Route path="/gro/supervision" element={<SupervisionNotesPage />} />
            <Route path="/gro/handoffs" element={<ShiftHandoffListPage />} />

            {/* ─── RESIDENTIAL ─── */}
            <Route path="/residential" element={<ResidentialDashboardV2Page />} />
            <Route path="/medications" element={<MedicationAdminPage />} />
            <Route path="/mobile-mar" element={<MobileMarPage />} />
            <Route path="/mar-facility" element={<MarFacilityViewPage />} />
            <Route path="/family" element={<FamilyContactPage />} />
            <Route path="/handoffs" element={<ShiftHandoffPage />} />
            <Route path="/residential/analytics" element={<PredictiveAnalyticsPage />} />

            {/* ─── COORDINATION ─── */}
            <Route path="/observations" element={<DailyObservationsPage />} />
            <Route path="/meetings" element={<MeetingCadencePage />} />
            <Route path="/escalation-ladder" element={<EscalationLadderPage />} />

            {/* ─── CAMPUS ─── */}
            <Route path="/campus" element={<CampusCensusDashboardPage />} />

            {/* ─── QA / COMPLIANCE ─── */}
            <Route path="/qa" element={<QaDashboardPage />} />
            <Route path="/qa/list" element={<QaListPage />} />
            <Route path="/qa/audit-binder" element={<AuditBinderPage />} />
            <Route path="/qa/cap-tracker" element={<CapTrackerPage />} />
            <Route path="/qa/compliance-memo" element={<ComplianceMemoPage />} />
            <Route path="/qa/deficiency-tracking" element={<DeficiencyTrackingPage />} />
            <Route path="/qa/evidence-matrix" element={<EvidenceMatrixPage />} />
            <Route path="/compliance/hhsc-export" element={<HhscExportPage />} />
            <Route path="/compliance/part2" element={<Part2DashboardPage />} />

            {/* ─── TOOLKITS ─── */}
            <Route path="/toolkits/chart-audit" element={<ChartAuditPage />} />
            <Route path="/toolkits" element={<ToolkitHubPage />} />

            {/* ─── REVENUE ─── */}
            <Route path="/revenue" element={<RevenueDashboardPage />} />
            <Route path="/revenue/claims" element={<ClaimsListPage />} />
            <Route path="/revenue/claim-submission" element={<ClaimSubmissionPage />} />
            <Route path="/revenue/denials" element={<DenialManagementPage />} />
            <Route path="/authorizations" element={<AuthorizationManagementPage />} />
            <Route path="/revenue/aging" element={<AgingQueuePage />} />
            <Route path="/revenue/proof-of-service" element={<ProofOfServiceGatePage />} />
            <Route path="/revenue/payer-packets" element={<PayerPacketBuilderPage />} />

            {/* ─── HR ─── */}
            <Route path="/hr" element={<HrCommandCenterPage />} />
            <Route path="/hr/personnel-files" element={<HrPersonProfilePage />} />
            <Route path="/hr/credentials" element={<CredentialTrackingPage />} />
            <Route path="/hr/performance" element={<PerformanceReviewPage />} />
            <Route path="/hr/onboarding" element={<OnboardingWorkflowPage />} />
            <Route path="/hr/separation" element={<SeparationManagementPage />} />
            <Route path="/hr/module" element={<HrModulePage />} />
            <Route path="/hr/layout" element={<HrLayout />} />
            <Route path="/hr/training" element={<TrainingAssignmentPage />} />
            <Route path="/hr/recruitment" element={<RecruitmentOnboardingPage />} />
            <Route path="/hr/tracker" element={<TrainingTrackerPage />} />

            {/* ─── EXECUTIVE ─── */}
            <Route path="/executive" element={<ExecutiveDashboardPage />} />
            <Route path="/executive/mgma" element={<MgmaScorecardPage />} />
            <Route path="/executive/strategic-projects" element={<StrategicProjectsHubPage />} />
            <Route path="/executive/marketing-review" element={<MarketingSiteReviewPage />} />

            {/* ─── GAD ─── */}
            <Route path="/gad" element={<GadDashboardPage />} />

            {/* ─── ANALYTICS ─── */}
            <Route path="/analytics" element={<AnalyticsPage />} />

            {/* ─── DOCUMENTS / DMS ─── */}
            <Route path="/documents" element={<DocumentStudioPage />} />
            <Route path="/documents/*" element={<DocumentStudioPage />} />

            {/* ─── KNOWLEDGE ─── */}
            <Route path="/knowledge" element={<KnowledgePage />} />
            <Route path="/sop-knowledge" element={<SOPKnowledgePage />} />

            {/* ─── NIL ─── */}
            <Route path="/nil" element={<NilSearchPage />} />
            <Route path="/nil/graph" element={<NilGraphPage />} />

            {/* ─── WORKFLOWS ─── */}
            <Route path="/workflows" element={<WorkflowsPage />} />
            <Route path="/my-work-today" element={<MyWorkTodayPage />} />

            {/* ─── ONBOARDING ─── */}
            <Route path="/onboarding" element={<OnboardingHomePage />} />
            <Route path="/onboarding/track" element={<OnboardingTrackPage />} />
            <Route path="/onboarding/module" element={<OnboardingModulePage />} />
            <Route path="/onboarding/employee" element={<OnboardingEmployeePage />} />
            <Route path="/onboarding/supervisor" element={<OnboardingSupervisorPage />} />
            <Route path="/onboarding/management" element={<OnboardingManagementPage />} />
            <Route path="/onboarding/evidence" element={<OnboardingEvidencePage />} />
            <Route path="/onboarding/training" element={<OnboardingTrainingPage />} />

            {/* ─── ADMIN ─── */}
            <Route path="/admin/settings" element={<SettingsPage />} />
            <Route path="/admin/workflow" element={<WorkflowAdminPage />} />
            <Route path="/admin/entra-id" element={<EntraIdPage />} />
            <Route path="/admin/enhancement-register" element={<EnhancementRegisterPage />} />

            {/* ─── AUTH ─── */}
            <Route path="/authorization" element={<AuthorizationPage />} />

            {/* ─── MY SHIFT / PERSONAL ─── */}
            <Route path="/my-shift" element={<MyShiftPage />} />
            <Route path="/meetings-escalations" element={<MeetingsEscalationsPage />} />

            {/* ─── FALLBACK ─── */}
            <Route path="*" element={<DashboardPage />} />
          </Routes>
        </main>
      </div>
      <Toaster />
    </div>
  );
}
