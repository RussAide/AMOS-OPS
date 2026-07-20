import {
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "@/hooks/use-auth";
import { trpc } from "@/providers/trpc";
import { runtimeConfig } from "@/config/runtime";
import { authorizeClientRoute } from "@/constants/access-control";
import {
  APP_SHELL_BOUNDARY_PATHS,
  appRoutePath,
} from "@/data/app-route-registry";
import ErrorBoundary from "@/components/error-boundary";
import { AppSidebar } from "./app-sidebar";
import { AccessDeniedPage } from "./access-denied-page";
import { NotFoundPage } from "./not-found-page";
import {
  Menu,
  X,
  Search,
  Moon,
  Sun,
  Keyboard,
  LogOut,
  Command,
  ChevronRight,
  Users,
  FileText,
  DollarSign,
  Stethoscope,
} from "lucide-react";
import {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  type ReactNode,
} from "react";

// ─── HOME / DASHBOARD ───
import DashboardPage from "@/pages/dashboard-page";

// ─── CLINICAL / BHC ───
import ClinicalDashboardPage from "@/pages/clinical/clinical-dashboard-page";
import M41cClinicalIntelligencePage from "@/pages/clinical/m41c-clinical-intelligence-page";
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
import CcmgOversightPage from "@/pages/ccmg/ccmg-oversight-page";
import CcmgReferralDetailPage from "@/pages/ccmg/ccmg-referral-detail-page";
import M22CaseManagementPage from "@/pages/mhtcm/m22-case-management-page";
import M23Workspace from "@/components/mhrs/m23-workspace";
import M24ResidentialOperationsPage from "@/pages/gro/m24-residential-operations-page";

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
import RegulatoryFrameworkPage from "@/pages/compliance/regulatory-framework-page";

// ─── TOOLKITS ───
import ChartAuditPage from "@/pages/toolkits/chart-audit-page";
import ToolkitHubPage from "@/pages/toolkits/toolkit-hub-page";
import CANSAssessmentPage from "@/pages/toolkits/cans-assessment-page";

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
import TrainingAssignmentPage from "@/pages/hr/training-assignment-page";
import TrainingTrackerPage from "@/pages/training/training-tracker-page";

// ─── HR WORKFORCE ACTIVATION (new) ───
import RecruitmentPage from "@/pages/hr/recruitment-page";
import ScreeningPage from "@/pages/hr/screening-page";
import OffersPage from "@/pages/hr/offers-page";
import OrientationPage from "@/pages/hr/orientation-page";
import HrOnboardingPage from "@/pages/hr/onboarding-hr-page";

// ─── HR WORKFORCE MANAGEMENT (new) ───
import ClearancePage from "@/pages/hr/clearance-page";
import HrCompliancePage from "@/pages/hr/hr-compliance-page";
import SeparationsPage from "@/pages/hr/separations-page";

// ─── HR TOOLS (new) ───
import CredentialsTrackerPage from "@/pages/hr/credentials-tracker-page";
import TrainingAssignmentsPage from "@/pages/hr/training-assignments-page";
import PerformanceReviewsPage from "@/pages/hr/performance-reviews-page";

// ─── NEW PAGE COMPONENTS ───
import PersonnelFilesPage from "@/pages/hr/personnel-files-page";
import CredentialTrackerPage from "@/pages/hr/credential-tracker-page";
import OnboardingFlowPage from "@/pages/hr/onboarding-flow-page";
import AdminNilGraphPage from "@/pages/admin/nil-graph-page";
import EntraSyncPage from "@/pages/admin/entra-sync-page";
import StrategicProjectsPage from "@/pages/executive/strategic-projects-page";
import SiteReviewPage from "@/pages/executive/site-review-page";

// ─── ADMIN (new) ───
import AccountRecoveryPage from "@/pages/admin/account-recovery-page";
import AdminSettingsPage from "@/pages/admin/settings-page";
import EnhancementRegisterPage from "@/pages/admin/enhancement-register-page";
import WorkflowEnginePage from "@/pages/admin/workflow-engine-page";
import OrganizationModelPage from "@/pages/admin/organization-model-page";

// ─── ONBOARDING ACADEMY (new) ───
import OnboardingAcademyPage from "@/pages/onboarding/onboarding-academy-page";
import UniversalOrientationPage from "@/pages/onboarding/universal-orientation-page";

// ─── EXECUTIVE ───
import ExecutiveDashboardPage from "@/pages/exec/executive-dashboard-page";
import M41aDecisionIntelligencePage from "@/pages/exec/m41a-decision-intelligence-page";
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
import M42DocumentKnowledgePage from "@/pages/knowledge/m42-document-knowledge-page";
import M51AOperationsHubPage from "@/pages/operations-hub/m51a-operations-hub-page";
import M51BMicrosoftIntegrationsPage from "@/pages/operations-hub/m51b-microsoft-integrations-page";
import M52MobileOfflinePage from "@/pages/operations-hub/m52-mobile-offline-page";
import Dx1EnterpriseDemoPage from "@/pages/operations-hub/dx1-enterprise-demo-page";

// ─── NIL ───
import NilSearchPage from "@/pages/nil/nil-search-page";
import NilGraphPage from "@/pages/nil-graph-page";

// ─── WORKFLOWS ───
import WorkflowsPage from "@/pages/workflows/workflows-page";
import MyWorkTodayPage from "@/pages/workflows/my-work-today-page";
import M41bIntelligenceAssistantPage from "@/pages/exec/m41b-intelligence-assistant-page";

// ─── ONBOARDING ───
import OnboardingTrackPage from "@/pages/onboarding/track-page";
import OnboardingModulePage from "@/pages/onboarding/module-page";
import OnboardingEmployeePage from "@/pages/onboarding/employee-page";
import OnboardingSupervisorPage from "@/pages/onboarding/supervisor-page";
import OnboardingManagementPage from "@/pages/onboarding/management-page";
import OnboardingEvidencePage from "@/pages/onboarding/evidence-page";
import OnboardingTrainingPage from "@/pages/onboarding/training-page";

// ─── AUTH ───
import LoginPage from "@/pages/login-page";
import AuthorizationPage from "@/pages/auth/authorization-page";

// ─── MY SHIFT / PERSONAL ───
import MyShiftPage from "@/pages/my-shift-page";
import MeetingsEscalationsPage from "@/pages/meetings-escalations-page";
import SOPKnowledgePage from "@/pages/sop-knowledge-page";
import Phase2ContinuumPage from "@/pages/phase2/phase2-continuum-page";
import Phase3CorporateOperationsPage from "@/pages/phase3/phase3-corporate-operations-page";

// ─── INTAKE ASSESSMENT ───

/* ═══════════════════════════════════════════════════════════════
   Search Result Types
   ═══════════════════════════════════════════════════════════════ */
interface SearchResult {
  id: string;
  label: string;
  sublabel: string;
  category: "Patients" | "Staff" | "Documents" | "Claims";
  icon: React.ElementType;
  path: string;
  color: string;
}

const SHORTCUTS = [
  { keys: ["?"], description: "Show keyboard shortcuts help" },
  { keys: ["/"], description: "Focus global search" },
  { keys: ["g", "d"], description: "Go to Dashboard" },
  { keys: ["g", "h"], description: "Go to HR" },
  { keys: ["g", "c"], description: "Go to Clinical" },
  { keys: ["Escape"], description: "Close modal / clear search" },
];

function ClientRouteGuard() {
  const location = useLocation();
  const { currentRole } = useAuth();
  const access = authorizeClientRoute(currentRole, location.pathname);

  return access.allowed ? <Outlet /> : <AccessDeniedPage reason={access.reason} />;
}

/* ═══════════════════════════════════════════════════════════════
   AppShell Component
   ═══════════════════════════════════════════════════════════════ */

interface AppShellProps {
  children?: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
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
        <Route path={APP_SHELL_BOUNDARY_PATHS.login} element={<LoginPage />} />
        <Route path={APP_SHELL_BOUNDARY_PATHS.fallback} element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return <AppShellAuthenticated>{children}</AppShellAuthenticated>;
}

function AppShellAuthenticated({ children }: AppShellProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // ─── Dark Mode ───
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("amos-dark-mode") === "true";
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add("dark");
      root.style.setProperty("--topbar-bg", "#0a0e1a");
      root.style.setProperty("--card-bg", "#111827");
      root.style.setProperty("--topbar-title", "#e5e7eb");
      root.style.setProperty("--topbar-subtitle", "#9ca3af");
      root.style.setProperty("--card-border", "#1f2937");
      root.style.setProperty("--background", "#0a0e1a");
    } else {
      root.classList.remove("dark");
      root.style.setProperty("--topbar-bg", "#ffffff");
      root.style.setProperty("--card-bg", "#ffffff");
      root.style.setProperty("--topbar-title", "#1a1a2e");
      root.style.setProperty("--topbar-subtitle", "#6b7280");
      root.style.setProperty("--card-border", "#e5e7eb");
      root.style.setProperty("--background", "#f8fafc");
    }
    localStorage.setItem("amos-dark-mode", String(isDarkMode));
  }, [isDarkMode]);

  // ─── Search State ───
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // ─── Keyboard Shortcuts Modal ───
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [keySequence, setKeySequence] = useState<string[]>([]);

  // ─── User Dropdown ───
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);

  // ─── tRPC Data Queries ───
  const { data: patientsData } = trpc.bhc.listPatients.useQuery(undefined, {
    enabled: showResults,
  });
  const { data: staffData } = trpc.hr.listPeople.useQuery(undefined, {
    enabled: showResults,
  });
  const { data: documentsData } = trpc.m2.list.useQuery(undefined, {
    enabled: showResults,
  });
  const { data: claimsData } = trpc.revenue.listClaims.useQuery(undefined, {
    enabled: showResults,
  });

  // ─── Build Search Results ───
  const results: SearchResult[] = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const q = searchQuery.toLowerCase();
    const matches: SearchResult[] = [];

    // Patients
    const patients = patientsData?.patients ?? [];
    patients.forEach((p) => {
      const name = `${p.firstName} ${p.lastName}`;
      const searchablePatient = [
        name,
        p.mrn,
        p.status,
        p.referralSource,
        p.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchablePatient.includes(q)) {
        const birthDate = new Date(`${p.dateOfBirth}T00:00:00`);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const birthdayHasPassed =
          today.getMonth() > birthDate.getMonth() ||
          (today.getMonth() === birthDate.getMonth() &&
            today.getDate() >= birthDate.getDate());
        if (!birthdayHasPassed) age -= 1;

        const ageLabel = Number.isNaN(birthDate.getTime())
          ? "Age unavailable"
          : `${age}yo`;
        const genderLabel =
          p.gender?.replace(/_/g, " ") ?? "Gender unavailable";

        matches.push({
          id: `pat-${p.id}`,
          label: name,
          sublabel: `${ageLabel} ${genderLabel} · ${p.mrn} · ${p.status}`,
          category: "Patients",
          icon: Stethoscope,
          path: `/clinical/patient/${p.id}`,
          color: "#245C5A",
        });
      }
    });

    // Staff
    const staff = Array.isArray(staffData) ? staffData : [];
    staff.forEach((s) => {
      const name = `${s.firstName} ${s.lastName}`;
      if (
        name.toLowerCase().includes(q) ||
        (s.role ?? "").toLowerCase().includes(q) ||
        (s.department ?? "").toLowerCase().includes(q)
      ) {
        matches.push({
          id: `stf-${s.id}`,
          label: name,
          sublabel: `${s.role} · ${s.department}`,
          category: "Staff",
          icon: Users,
          path: `/hr/personnel-files`,
          color: "#2563EB",
        });
      }
    });

    // Documents
    const documents = documentsData?.documents ?? [];
    documents.forEach((d) => {
      if (
        (d.title ?? "").toLowerCase().includes(q) ||
        (d.category ?? "").toLowerCase().includes(q)
      ) {
        matches.push({
          id: `doc-${d.id}`,
          label: d.title,
          sublabel: `${d.category} · v${d.version}`,
          category: "Documents",
          icon: FileText,
          path: `/documents`,
          color: "#D97706",
        });
      }
    });

    // Claims
    const claims = claimsData?.claims ?? [];
    claims.forEach((c) => {
      const searchableClaim = [
        c.claimNumber,
        c.patientId,
        c.payerName,
        c.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (searchableClaim.includes(q)) {
        const totalAmount = (c.totalAmount ?? 0) / 100;
        matches.push({
          id: `clm-${c.id}`,
          label: c.claimNumber ?? c.id,
          sublabel: `${c.patientId} · ${c.payerName} · $${totalAmount.toLocaleString(
            undefined,
            {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            },
          )} · ${c.status}`,
          category: "Claims",
          icon: DollarSign,
          path: `/revenue/claims`,
          color: "#059669",
        });
      }
    });

    return matches.slice(0, 12);
  }, [searchQuery, patientsData, staffData, documentsData, claimsData]);

  // ─── Keyboard Shortcuts Handler ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      // Escape - close modals / clear search
      if (e.key === "Escape") {
        setShowShortcuts(false);
        setShowResults(false);
        setSearchQuery("");
        setKeySequence([]);
        if (document.activeElement === searchRef.current) {
          (searchRef.current as HTMLInputElement)?.blur();
        }
        return;
      }

      // ? - Show shortcuts (not in inputs)
      if (e.key === "?" && !isInput) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
        return;
      }

      // / - Focus search (not in inputs)
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchRef.current?.focus();
        setShowResults(true);
        return;
      }

      // g + {key} navigation sequence
      if (!isInput && e.key === "g" && keySequence.length === 0) {
        e.preventDefault();
        setKeySequence(["g"]);
        // Reset sequence after 1.5s
        setTimeout(() => setKeySequence([]), 1500);
        return;
      }

      if (keySequence[0] === "g" && !isInput) {
        if (e.key === "d") {
          navigate("/");
          setKeySequence([]);
        } else if (e.key === "h") {
          navigate("/hr");
          setKeySequence([]);
        } else if (e.key === "c") {
          navigate("/clinical");
          setKeySequence([]);
        } else if (e.key === "w") {
          navigate("/workflows");
          setKeySequence([]);
        } else if (e.key === "k") {
          navigate("/knowledge");
          setKeySequence([]);
        } else {
          setKeySequence([]);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, keySequence]);

  // ─── Navigation on result click ───
  const handleResultClick = useCallback(
    (path: string) => {
      navigate(path);
      setShowResults(false);
      setSearchQuery("");
      setSelectedIndex(0);
    },
    [navigate],
  );

  // ─── Arrow key navigation in search results ───
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!showResults || results.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % results.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (prev) => (prev - 1 + results.length) % results.length,
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = results[selectedIndex];
        if (selected) handleResultClick(selected.path);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showResults, results, selectedIndex, handleResultClick]);

  // ─── Click outside to close search results ───
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(e.target as Node) &&
        searchRef.current &&
        !searchRef.current.contains(e.target as Node)
      ) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ─── Group results by category ───
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchResult[]> = {};
    results.forEach((r) => {
      if (!groups[r.category]) groups[r.category] = [];
      groups[r.category].push(r);
    });
    return groups;
  }, [results]);

  return (
    <div
      className="flex h-screen w-screen overflow-hidden relative"
      style={{ backgroundColor: "var(--background, #f8fafc)" }}
    >
      {/* Mobile sidebar overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile unless toggled */}
      <div
        className={`${mobileMenuOpen ? "fixed left-0 top-0 z-50 h-screen" : "hidden lg:flex"} flex-shrink-0`}
      >
        <AppSidebar
          mobile={mobileMenuOpen}
          onNavigate={() => setMobileMenuOpen(false)}
        />
      </div>

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* ═══════ TOP HEADER BAR ═══════ */}
        <header
          className="flex items-center gap-3 px-4 py-2 border-b flex-shrink-0 z-30"
          style={{
            backgroundColor: "var(--topbar-bg, #fff)",
            borderColor: "var(--card-border, #E2E8F0)",
          }}
        >
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex items-center justify-center w-10 h-10 rounded-lg border lg:hidden"
            style={{ borderColor: "var(--role-badge-border, #E2E8F0)" }}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          {/* Brand (desktop only, hidden when sidebar visible) */}
          <span
            className="text-[16px] font-semibold hidden lg:block"
            style={{ color: "var(--topbar-title, #1a1a2e)" }}
          >
            AMOS Intranet
          </span>

          {/* ─── Global Search Bar ─── */}
          <div className="relative flex-1 max-w-lg mx-auto">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "var(--topbar-subtitle)" }}
              />
              <input
                ref={searchRef}
                type="text"
                placeholder="Search patients, staff, documents, claims... (press / to focus)"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                  setShowResults(e.target.value.length >= 2);
                }}
                onFocus={() => {
                  if (searchQuery.length >= 2) setShowResults(true);
                }}
                className="w-full pl-8 pr-8 py-1.5 text-[12px] rounded-md border transition-all"
                style={{
                  borderColor: showResults ? "#245C5A" : "var(--card-border)",
                  backgroundColor: isDarkMode ? "#1f2937" : "#f8fafc",
                  color: "var(--topbar-title)",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSelectedIndex(0);
                    setShowResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2"
                >
                  <X size={12} style={{ color: "var(--topbar-subtitle)" }} />
                </button>
              )}
              {!searchQuery && (
                <span
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1 py-0.5 rounded hidden sm:block"
                  style={{
                    backgroundColor: isDarkMode ? "#1f2937" : "#e2e8f0",
                    color: "var(--topbar-subtitle)",
                  }}
                >
                  /
                </span>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && (
              <div
                ref={resultsRef}
                className="absolute left-0 right-0 mt-1.5 rounded-lg border shadow-lg overflow-hidden z-50"
                style={{
                  backgroundColor: isDarkMode ? "#111827" : "#ffffff",
                  borderColor: "var(--card-border)",
                }}
              >
                {results.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <Search
                      size={20}
                      className="mx-auto mb-1"
                      style={{ color: "var(--topbar-subtitle)" }}
                    />
                    <p
                      className="text-[11px]"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      No results for "{searchQuery}"
                    </p>
                  </div>
                ) : (
                  <div className="max-h-[360px] overflow-y-auto py-1">
                    {Object.entries(groupedResults).map(([category, items]) => (
                      <div key={category}>
                        <div
                          className="px-3 py-1 text-[9px] font-semibold uppercase tracking-wider"
                          style={{
                            color: "var(--topbar-subtitle)",
                            backgroundColor: isDarkMode ? "#0a0e1a" : "#f8fafc",
                          }}
                        >
                          {category} ({items.length})
                        </div>
                        {items.map((item) => {
                          const globalIdx = results.indexOf(item);
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              onClick={() => handleResultClick(item.path)}
                              onMouseEnter={() => setSelectedIndex(globalIdx)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors border-none"
                              style={{
                                backgroundColor:
                                  globalIdx === selectedIndex
                                    ? isDarkMode
                                      ? "#1f2937"
                                      : "#f0fdfa"
                                    : "transparent",
                              }}
                            >
                              <div
                                className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                                style={{ backgroundColor: item.color + "15" }}
                              >
                                <Icon size={14} style={{ color: item.color }} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-[11px] font-medium truncate"
                                  style={{ color: "var(--topbar-title)" }}
                                >
                                  {item.label}
                                </p>
                                <p
                                  className="text-[10px] truncate"
                                  style={{ color: "var(--topbar-subtitle)" }}
                                >
                                  {item.sublabel}
                                </p>
                              </div>
                              <ChevronRight
                                size={12}
                                style={{ color: "var(--topbar-subtitle)" }}
                              />
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ─── Right Side: Keyboard Hint + User Dropdown ─── */}
          <div className="flex items-center gap-2">
            {/* Keyboard shortcut hint */}
            <button
              onClick={() => setShowShortcuts(true)}
              className="hidden md:flex items-center gap-1 text-[10px] px-2 py-1 rounded-md transition-colors"
              style={{
                backgroundColor: isDarkMode ? "#1f2937" : "#f1f5f9",
                color: "var(--topbar-subtitle)",
              }}
              title="Keyboard shortcuts"
            >
              <Command size={10} />
              <span>?</span>
            </button>

            {/* Dark Mode Toggle */}
            <button
              onClick={() => setIsDarkMode((prev) => !prev)}
              className="flex items-center justify-center w-8 h-8 rounded-md transition-colors"
              style={{
                backgroundColor: isDarkMode ? "#f59e0b15" : "#f1f5f9",
                color: isDarkMode ? "#f59e0b" : "#6b7280",
              }}
              title={
                isDarkMode ? "Switch to light mode" : "Switch to dark mode"
              }
            >
              {isDarkMode ? <Sun size={15} /> : <Moon size={15} />}
            </button>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserDropdownOpen((prev) => !prev)}
                onBlur={() => setTimeout(() => setUserDropdownOpen(false), 200)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-md border-none transition-colors"
                style={{ backgroundColor: isDarkMode ? "#1f2937" : "#f1f5f9" }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                  style={{ backgroundColor: "#245C5A" }}
                >
                  {user?.firstName?.[0]}
                  {user?.lastName?.[0]}
                </div>
                <span
                  className="text-[11px] font-medium hidden sm:block max-w-[80px] truncate"
                  style={{ color: "var(--topbar-title)" }}
                >
                  {user?.name ?? user?.email}
                </span>
                <ChevronRight
                  size={10}
                  style={{
                    color: "var(--topbar-subtitle)",
                    transform: userDropdownOpen ? "rotate(90deg)" : "none",
                    transition: "transform 0.15s",
                  }}
                />
              </button>

              {userDropdownOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 rounded-lg py-1 z-50 min-w-[200px]"
                  style={{
                    backgroundColor: isDarkMode ? "#111827" : "#ffffff",
                    border: `1px solid ${isDarkMode ? "#1f2937" : "#e5e7eb"}`,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                  }}
                >
                  <div
                    className="px-3 py-2 border-b"
                    style={{ borderColor: isDarkMode ? "#1f2937" : "#e5e7eb" }}
                  >
                    <p
                      className="text-[12px] font-medium"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      {user?.name}
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--topbar-subtitle)" }}
                    >
                      {user?.email}
                    </p>
                    <p
                      className="text-[9px] mt-0.5 px-1.5 py-0.5 rounded-full inline-block"
                      style={{ backgroundColor: "#245C5A18", color: "#245C5A" }}
                    >
                      {user?.role}
                    </p>
                  </div>

                  <button
                    onClick={() => setIsDarkMode((prev) => !prev)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left border-none transition-colors"
                    style={{
                      backgroundColor: "transparent",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode
                        ? "#1f2937"
                        : "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    {isDarkMode ? (
                      <Sun size={13} style={{ color: "#f59e0b" }} />
                    ) : (
                      <Moon size={13} style={{ color: "#6b7280" }} />
                    )}
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      {isDarkMode ? "Light Mode" : "Dark Mode"}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowShortcuts(true);
                      setUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left border-none transition-colors"
                    style={{
                      backgroundColor: "transparent",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = isDarkMode
                        ? "#1f2937"
                        : "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Keyboard size={13} style={{ color: "#6b7280" }} />
                    <span
                      className="text-[11px]"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      Keyboard Shortcuts
                    </span>
                  </button>

                  <div
                    className="border-t mt-1 pt-1"
                    style={{ borderColor: isDarkMode ? "#1f2937" : "#e5e7eb" }}
                  >
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left border-none transition-colors"
                      style={{
                        backgroundColor: "transparent",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode
                          ? "#1f2937"
                          : "#f8fafc";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <LogOut size={13} style={{ color: "#DC2626" }} />
                      <span
                        className="text-[11px]"
                        style={{ color: "#DC2626" }}
                      >
                        Logout
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {runtimeConfig.evaluationMode && (
          <div
            role="status"
            data-amos-environment={runtimeConfig.environmentId}
            data-amos-runtime-mode="demo"
            data-amos-control-plane="AMOS-OPS-PHASE3-EVALUATION"
            className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-amber-500 bg-amber-300 px-3 py-1.5 text-center text-[11px] font-bold tracking-wide text-slate-950 print:flex"
          >
            <span>DEMO - NOT FOR CARE DELIVERY</span>
            <span aria-hidden="true">•</span>
            <span>Environment: {runtimeConfig.environmentId}</span>
            <span aria-hidden="true">•</span>
            <span>Control plane: AMOS-OPS-PHASE3-EVALUATION</span>
            <span aria-hidden="true">•</span>
            <span>
              Synthetic data only · Production and Microsoft writes blocked
            </span>
          </div>
        )}
        {runtimeConfig.mode === "production" &&
          runtimeConfig.productionReleaseAuthorized && (
            <div
              role="status"
              data-amos-environment={runtimeConfig.environmentId}
              data-amos-runtime-mode="production"
              className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 border-b border-emerald-800 bg-emerald-950 px-3 py-1.5 text-center text-[11px] font-bold tracking-wide text-emerald-50 print:flex"
            >
              <span>PRODUCTION</span>
              <span aria-hidden="true">•</span>
              <span>Authorized live operations</span>
              <span aria-hidden="true">•</span>
              <span>Release: {runtimeConfig.productionReleaseId}</span>
            </div>
          )}

        {/* ─── Main Content ─── */}
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <ErrorBoundary>
            {children ?? (
              <Routes>
                <Route element={<ClientRouteGuard />}>
                  {/* ─── HOME ─── */}
                  <Route path={appRoutePath("home")} element={<DashboardPage />} />
                <Route path={appRoutePath("home-alerts")} element={<DashboardPage focus="alerts" />} />
                <Route path={appRoutePath("home-divisions")} element={<DashboardPage focus="divisions" />} />
                <Route path={appRoutePath("home-quick-actions")} element={<DashboardPage focus="actions" />} />
                <Route path={appRoutePath("continuum")} element={<Phase2ContinuumPage />} />
                <Route
                  path={appRoutePath("corporate-operations")}
                  element={<Phase3CorporateOperationsPage />}
                />

                {/* ─── CLINICAL / BHC ─── */}
                <Route path={appRoutePath("clinical")} element={<ClinicalDashboardPage />} />
                <Route
                  path={appRoutePath("clinical-intelligence-fabric")}
                  element={<M41cClinicalIntelligencePage />}
                />
                <Route
                  path={appRoutePath("clinical-sessions")}
                  element={<ClinicalSessionsPage />}
                />
                <Route
                  path={appRoutePath("clinical-treatment-plans")}
                  element={<TreatmentPlansPage />}
                />
                <Route
                  path={appRoutePath("clinical-cans-assessments")}
                  element={<CansAssessmentPage />}
                />
                <Route
                  path={appRoutePath("clinical-outcome-measures")}
                  element={<OutcomeMeasuresPage />}
                />
                <Route
                  path={appRoutePath("clinical-insurance-plans")}
                  element={<InsurancePlansPage />}
                />
                <Route
                  path={appRoutePath("clinical-referrals")}
                  element={<ReferralIntakePage />}
                />
                <Route
                  path={appRoutePath("clinical-service-delivery")}
                  element={<ServiceDeliveryPage />}
                />
                <Route
                  path={appRoutePath("clinical-patients")}
                  element={<PatientListPage />}
                />
                <Route
                  path={appRoutePath("clinical-patient-id")}
                  element={<PatientProfilePage />}
                />
                <Route
                  path={appRoutePath("clinical-patients-id")}
                  element={<PatientProfilePage />}
                />
                <Route
                  path={appRoutePath("clinical-workspace")}
                  element={<ClinicalWorkspacePage />}
                />

                {/* ─── BHC DASHBOARD ─── */}
                <Route path={appRoutePath("bhc")} element={<BhcDashboardPage />} />
                <Route path={appRoutePath("ccmg")} element={<CcmgOversightPage />} />
                <Route
                  path={appRoutePath("ccmg-referrals-referralId")}
                  element={<CcmgReferralDetailPage />}
                />
                <Route path={appRoutePath("mhtcm")} element={<M22CaseManagementPage />} />
                <Route path={appRoutePath("mhrs")} element={<M23Workspace />} />

                {/* ─── INTAKE ─── */}
                <Route path={appRoutePath("intake")} element={<IntakePipelinePage />} />
                <Route
                  path={appRoutePath("intake-pipeline")}
                  element={<IntakePipelinePage />}
                />
                <Route
                  path={appRoutePath("intake-assessment")}
                  element={<IntakeAssessmentPage />}
                />

                {/* ─── CRISIS / CASE ─── */}
                <Route path={appRoutePath("crisis")} element={<CrisisResponsePage />} />
                <Route path={appRoutePath("cases")} element={<CaseManagementPage />} />

                {/* ─── GRO / RESIDENTIAL ─── */}
                <Route path={appRoutePath("gro")} element={<GroDashboardPage />} />
                <Route path={appRoutePath("gro-workspace")} element={<GroWorkspacePage />} />
                <Route
                  path={appRoutePath("gro-compliance")}
                  element={<GroComplianceDashboardPage />}
                />
                <Route path={appRoutePath("gro-incidents")} element={<IncidentReportPage />} />
                <Route path={appRoutePath("gro-shift-logs")} element={<ShiftLogPage />} />
                <Route
                  path={appRoutePath("gro-safety-rounds")}
                  element={<SafetyRoundPage />}
                />
                <Route path={appRoutePath("gro-care-logs")} element={<YouthCareLogPage />} />
                <Route
                  path={appRoutePath("gro-supervision")}
                  element={<SupervisionNotesPage />}
                />
                <Route
                  path={appRoutePath("gro-handoffs")}
                  element={<ShiftHandoffListPage />}
                />
                <Route
                  path={appRoutePath("gro-residential-operations")}
                  element={<M24ResidentialOperationsPage />}
                />

                {/* ─── RESIDENTIAL ─── */}
                <Route
                  path={appRoutePath("residential")}
                  element={<ResidentialDashboardV2Page />}
                />
                <Route path={appRoutePath("medications")} element={<MedicationAdminPage />} />
                <Route path={appRoutePath("mobile-mar")} element={<MobileMarPage />} />
                <Route
                  path={appRoutePath("mar-facility")}
                  element={<MarFacilityViewPage facilityId="fac-001" />}
                />
                <Route path={appRoutePath("family")} element={<FamilyContactPage />} />
                <Route path={appRoutePath("handoffs")} element={<ShiftHandoffPage />} />
                <Route
                  path={appRoutePath("residential-analytics")}
                  element={<PredictiveAnalyticsPage />}
                />

                {/* ─── COORDINATION ─── */}
                <Route
                  path={appRoutePath("observations")}
                  element={<DailyObservationsPage />}
                />
                <Route path={appRoutePath("meetings")} element={<MeetingCadencePage />} />
                <Route
                  path={appRoutePath("escalation-ladder")}
                  element={<EscalationLadderPage />}
                />

                {/* ─── CAMPUS ─── */}
                <Route path={appRoutePath("campus")} element={<CampusCensusDashboardPage />} />

                {/* ─── QA / COMPLIANCE ─── */}
                <Route path={appRoutePath("qa")} element={<QaDashboardPage />} />
                <Route path={appRoutePath("qa-list")} element={<QaListPage />} />
                <Route path={appRoutePath("qa-audit-binder")} element={<AuditBinderPage />} />
                <Route path={appRoutePath("qa-cap-tracker")} element={<CapTrackerPage />} />
                <Route
                  path={appRoutePath("qa-compliance-memo")}
                  element={<ComplianceMemoPage />}
                />
                <Route
                  path={appRoutePath("qa-deficiency-tracking")}
                  element={<DeficiencyTrackingPage />}
                />
                <Route
                  path={appRoutePath("qa-evidence-matrix")}
                  element={<EvidenceMatrixPage />}
                />
                <Route
                  path={appRoutePath("compliance-hhsc-export")}
                  element={<HhscExportPage />}
                />
                <Route
                  path={appRoutePath("compliance-part2")}
                  element={<Part2DashboardPage />}
                />
                <Route
                  path={appRoutePath("compliance-regulatory-framework")}
                  element={<RegulatoryFrameworkPage />}
                />

                {/* ─── TOOLKITS ─── */}
                <Route
                  path={appRoutePath("toolkits-chart-audit")}
                  element={<ChartAuditPage />}
                />
                <Route
                  path={appRoutePath("toolkits-cans")}
                  element={<CANSAssessmentPage />}
                />
                <Route path={appRoutePath("toolkits")} element={<ToolkitHubPage />} />

                {/* ─── REVENUE ─── */}
                <Route path={appRoutePath("revenue")} element={<RevenueDashboardPage />} />
                <Route path={appRoutePath("revenue-claims")} element={<ClaimsListPage />} />
                <Route
                  path={appRoutePath("revenue-claim-submission")}
                  element={<ClaimSubmissionPage />}
                />
                <Route
                  path={appRoutePath("revenue-denials")}
                  element={<DenialManagementPage />}
                />
                <Route
                  path={appRoutePath("authorizations")}
                  element={<AuthorizationManagementPage />}
                />
                <Route path={appRoutePath("revenue-aging")} element={<AgingQueuePage />} />
                <Route
                  path={appRoutePath("revenue-proof-of-service")}
                  element={<ProofOfServiceGatePage />}
                />
                <Route
                  path={appRoutePath("revenue-payer-packets")}
                  element={<PayerPacketBuilderPage />}
                />

                {/* ─── HR ─── */}
                <Route path={appRoutePath("hr")} element={<HrCommandCenterPage />} />
                <Route
                  path={appRoutePath("hr-credentials")}
                  element={<CredentialTrackingPage />}
                />
                <Route
                  path={appRoutePath("hr-performance")}
                  element={<PerformanceReviewPage />}
                />
                <Route path={appRoutePath("hr-onboarding")} element={<HrOnboardingPage />} />
                <Route
                  path={appRoutePath("hr-separation")}
                  element={<SeparationManagementPage />}
                />
                <Route
                  path={appRoutePath("hr-module")}
                  element={<Navigate to="/hr" replace />}
                />
                <Route
                  path={appRoutePath("hr-layout")}
                  element={<Navigate to="/hr" replace />}
                />
                <Route
                  path={appRoutePath("hr-training")}
                  element={<TrainingAssignmentPage />}
                />
                <Route path={appRoutePath("hr-recruitment")} element={<RecruitmentPage />} />
                <Route path={appRoutePath("hr-tracker")} element={<TrainingTrackerPage />} />

                {/* ─── HR WORKFORCE ACTIVATION (new) ─── */}
                <Route path={appRoutePath("hr-screening")} element={<ScreeningPage />} />
                <Route path={appRoutePath("hr-offers")} element={<OffersPage />} />
                <Route path={appRoutePath("hr-orientation")} element={<OrientationPage />} />

                {/* ─── HR WORKFORCE MANAGEMENT (new) ─── */}
                <Route path={appRoutePath("hr-clearance")} element={<ClearancePage />} />
                <Route path={appRoutePath("hr-compliance")} element={<HrCompliancePage />} />
                <Route path={appRoutePath("hr-separations")} element={<SeparationsPage />} />

                {/* ─── HR TOOLS (new) ─── */}
                <Route
                  path={appRoutePath("hr-credentials-tracker")}
                  element={<CredentialsTrackerPage />}
                />
                <Route
                  path={appRoutePath("hr-training-assignments")}
                  element={<TrainingAssignmentsPage />}
                />
                <Route
                  path={appRoutePath("hr-performance-reviews")}
                  element={<PerformanceReviewsPage />}
                />
                <Route
                  path={appRoutePath("hr-onboarding-workflow")}
                  element={<OnboardingWorkflowPage />}
                />

                {/* ─── NEW HR ROUTES ─── */}
                <Route path={appRoutePath("hr-personnel")} element={<PersonnelFilesPage />} />
                <Route
                  path={appRoutePath("hr-credential-tracker")}
                  element={<CredentialTrackerPage />}
                />
                <Route
                  path={appRoutePath("hr-onboarding-flow")}
                  element={<OnboardingFlowPage />}
                />
                <Route
                  path={appRoutePath("hr-person-personId")}
                  element={<HrPersonProfilePage />}
                />
                <Route path={appRoutePath("hr-moduleId")} element={<HrModulePage />} />

                {/* ─── EXECUTIVE ─── */}
                <Route path={appRoutePath("executive")} element={<ExecutiveDashboardPage />} />
                <Route
                  path={appRoutePath("executive-decision-intelligence")}
                  element={<M41aDecisionIntelligencePage />}
                />
                <Route path={appRoutePath("executive-mgma")} element={<MgmaScorecardPage />} />
                <Route
                  path={appRoutePath("executive-strategic-projects")}
                  element={<StrategicProjectsHubPage />}
                />
                <Route
                  path={appRoutePath("executive-marketing-review")}
                  element={<MarketingSiteReviewPage />}
                />

                {/* ─── GAD ─── */}
                <Route path={appRoutePath("gad")} element={<GadDashboardPage />} />
                <Route
                  path={appRoutePath("gad-facilities-work-orders")}
                  element={<GadDashboardPage initialTab="workorders" />}
                />
                <Route
                  path={appRoutePath("gad-procurement-vendors")}
                  element={<GadDashboardPage initialTab="procurement" />}
                />
                <Route
                  path={appRoutePath("gad-safety-emergency-preparedness")}
                  element={<GadDashboardPage initialTab="safety" />}
                />
                <Route
                  path={appRoutePath("gad-transportation-logistics")}
                  element={<GadDashboardPage initialTab="transportation" />}
                />
                <Route
                  path={appRoutePath("gad-regulatory-support")}
                  element={<GadDashboardPage initialTab="regulatory" />}
                />

                {/* ─── NEW EXECUTIVE ROUTES ─── */}
                <Route path={appRoutePath("mgma")} element={<MgmaScorecardPage />} />
                <Route
                  path={appRoutePath("strategic-projects")}
                  element={<StrategicProjectsPage />}
                />
                <Route path={appRoutePath("site-review")} element={<SiteReviewPage />} />

                {/* ─── ANALYTICS ─── */}
                <Route path={appRoutePath("analytics")} element={<AnalyticsPage />} />

                {/* ─── DOCUMENTS / DMS ─── */}
                <Route path={appRoutePath("documents")} element={<DocumentStudioPage />} />
                <Route path={appRoutePath("documents-wildcard")} element={<DocumentStudioPage />} />

                {/* ─── KNOWLEDGE ─── */}
                <Route path={appRoutePath("knowledge")} element={<KnowledgePage />} />
                <Route
                  path={appRoutePath("knowledge-document-intelligence")}
                  element={<M42DocumentKnowledgePage />}
                />
                <Route
                  path={appRoutePath("operations-hub")}
                  element={<M51AOperationsHubPage />}
                />
                <Route
                  path={appRoutePath("operations-hub-microsoft-integrations")}
                  element={<M51BMicrosoftIntegrationsPage />}
                />
                <Route
                  path={appRoutePath("operations-hub-mobile-offline")}
                  element={<M52MobileOfflinePage />}
                />
                <Route
                  path={appRoutePath("operations-hub-enterprise-demo")}
                  element={<Dx1EnterpriseDemoPage />}
                />
                <Route path={appRoutePath("sop-knowledge")} element={<SOPKnowledgePage />} />

                {/* ─── NIL ─── */}
                <Route path={appRoutePath("nil")} element={<NilSearchPage />} />
                <Route path={appRoutePath("nil-graph")} element={<NilGraphPage />} />

                {/* ─── WORKFLOWS ─── */}
                <Route path={appRoutePath("workflows")} element={<WorkflowsPage />} />
                <Route
                  path={appRoutePath("workflows-intelligence-assistant")}
                  element={<M41bIntelligenceAssistantPage />}
                />
                <Route
                  path={appRoutePath("workflows-my-work-today")}
                  element={<MyWorkTodayPage view="today" />}
                />
                <Route
                  path={appRoutePath("workflows-assigned-tasks")}
                  element={<MyWorkTodayPage view="assigned" />}
                />
                <Route
                  path={appRoutePath("workflows-attention")}
                  element={<MyWorkTodayPage view="attention" />}
                />
                <Route
                  path={appRoutePath("workflows-calendar")}
                  element={<MyWorkTodayPage view="calendar" />}
                />
                <Route
                  path={appRoutePath("workflows-recent-activity")}
                  element={<MyWorkTodayPage view="recent" />}
                />
                <Route path={appRoutePath("my-work-today")} element={<MyWorkTodayPage />} />

                {/* ─── ONBOARDING ─── */}
                <Route path={appRoutePath("onboarding")} element={<OnboardingAcademyPage />} />
                <Route
                  path={appRoutePath("onboarding-track")}
                  element={<Navigate to="/onboarding" replace />}
                />
                <Route
                  path={appRoutePath("onboarding-track-universal-orientation")}
                  element={<UniversalOrientationPage />}
                />
                <Route
                  path={appRoutePath("onboarding-track-trackId")}
                  element={<OnboardingTrackPage />}
                />
                <Route
                  path={appRoutePath("onboarding-module")}
                  element={<Navigate to="/onboarding/training" replace />}
                />
                <Route
                  path={appRoutePath("onboarding-module-moduleId")}
                  element={<OnboardingModulePage />}
                />
                <Route
                  path={appRoutePath("onboarding-employee")}
                  element={<Navigate to="/onboarding/supervisor" replace />}
                />
                <Route
                  path={appRoutePath("onboarding-employee-id")}
                  element={<OnboardingEmployeePage />}
                />
                <Route
                  path={appRoutePath("onboarding-supervisor")}
                  element={<OnboardingSupervisorPage />}
                />
                <Route
                  path={appRoutePath("onboarding-management")}
                  element={<OnboardingManagementPage />}
                />
                <Route
                  path={appRoutePath("onboarding-evidence")}
                  element={<OnboardingEvidencePage />}
                />
                <Route
                  path={appRoutePath("onboarding-training")}
                  element={<OnboardingTrainingPage />}
                />

                {/* ─── ADMIN ─── */}
                <Route
                  path={appRoutePath("admin-organization")}
                  element={<OrganizationModelPage />}
                />
                <Route
                  path={appRoutePath("admin-access-recovery")}
                  element={<AccountRecoveryPage />}
                />
                <Route path={appRoutePath("admin-settings")} element={<AdminSettingsPage />} />
                <Route
                  path={appRoutePath("admin-workflow")}
                  element={<WorkflowEnginePage />}
                />
                <Route
                  path={appRoutePath("admin-workflows")}
                  element={<Navigate to="/workflows" replace />}
                />
                <Route path={appRoutePath("admin-entra-id")} element={<EntraSyncPage />} />
                <Route
                  path={appRoutePath("admin-enhancement-register")}
                  element={<EnhancementRegisterPage />}
                />
                <Route
                  path={appRoutePath("admin-enhancements")}
                  element={<EnhancementRegisterPage />}
                />
                <Route
                  path={appRoutePath("admin-enhancement")}
                  element={<EnhancementRegisterPage />}
                />
                <Route
                  path={appRoutePath("admin-nil-graph")}
                  element={<AdminNilGraphPage />}
                />
                <Route path={appRoutePath("admin-entra-sync")} element={<EntraSyncPage />} />

                {/* ─── AUTH ─── */}
                <Route path={appRoutePath("authorization")} element={<AuthorizationPage />} />

                {/* ─── MY SHIFT / PERSONAL ─── */}
                <Route path={appRoutePath("my-shift")} element={<MyShiftPage />} />
                <Route
                  path={appRoutePath("meetings-escalations")}
                  element={<MeetingsEscalationsPage />}
                />
                </Route>

                {/* ─── FALLBACK ─── */}
                <Route path={APP_SHELL_BOUNDARY_PATHS.login} element={<Navigate to="/" replace />} />
                <Route path={APP_SHELL_BOUNDARY_PATHS.fallback} element={<NotFoundPage />} />
              </Routes>
            )}
          </ErrorBoundary>
        </main>
      </div>
      <Toaster />

      {/* ═══════ KEYBOARD SHORTCUTS MODAL ═══════ */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="rounded-lg shadow-xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: isDarkMode ? "#111827" : "#ffffff",
              border: `1px solid ${isDarkMode ? "#1f2937" : "#e5e7eb"}`,
            }}
          >
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: isDarkMode ? "#1f2937" : "#e5e7eb" }}
            >
              <h3
                className="text-[14px] font-bold flex items-center gap-2"
                style={{ color: "var(--topbar-title)" }}
              >
                <Keyboard size={16} style={{ color: "#245C5A" }} />
                Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 rounded cursor-pointer border-none"
                style={{ backgroundColor: isDarkMode ? "#1f2937" : "#f3f4f6" }}
              >
                <X size={14} />
              </button>
            </div>
            <div className="p-4">
              <div className="space-y-1">
                {SHORTCUTS.map((shortcut, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 px-3 rounded"
                    style={{
                      backgroundColor:
                        i % 2 === 0
                          ? isDarkMode
                            ? "#0a0e1a"
                            : "#f8fafc"
                          : "transparent",
                    }}
                  >
                    <span
                      className="text-[12px]"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, ki) => (
                        <span key={ki}>
                          <kbd
                            className="text-[10px] px-1.5 py-0.5 rounded font-mono font-medium"
                            style={{
                              backgroundColor: isDarkMode
                                ? "#1f2937"
                                : "#f1f5f9",
                              color: "var(--topbar-subtitle)",
                              border: `1px solid ${isDarkMode ? "#374151" : "#d1d5db"}`,
                            }}
                          >
                            {key}
                          </kbd>
                          {ki < shortcut.keys.length - 1 && (
                            <span
                              className="text-[10px] mx-0.5"
                              style={{ color: "var(--topbar-subtitle)" }}
                            >
                              +
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mt-3 pt-3 border-t"
                style={{ borderColor: isDarkMode ? "#1f2937" : "#e5e7eb" }}
              >
                <p
                  className="text-[10px] text-center"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  Press{" "}
                  <kbd
                    className="px-1 py-0.5 rounded text-[9px]"
                    style={{
                      backgroundColor: isDarkMode ? "#1f2937" : "#f1f5f9",
                    }}
                  >
                    Escape
                  </kbd>{" "}
                  to close this dialog
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
