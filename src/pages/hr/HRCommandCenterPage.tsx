import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, FileCheck, Compass, GraduationCap, ShieldCheck,
  FolderOpen, Clock, AlertTriangle, Bell, ArrowRight,
  ChevronRight, Activity, CheckCircle
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHR } from "@/context/HRContext";
import type { FilterState } from "@/components/hr/PersonSearchFilter";
import { HRVisualPipeline } from "@/components/hr/HRVisualPipeline";
import { ReportExportPanel } from "@/components/hr/ReportExportPanel";
import { WorkflowStatusPanel } from "@/components/hr/WorkflowStatusPanel";
import { CreatePersonForm } from "@/components/hr/CreatePersonForm";
import { PersonSearchFilter, useFilteredPeople } from "@/components/hr/PersonSearchFilter";
import { CredentialExpiryDashboard } from "@/components/hr/CredentialExpiryDashboard";
import { AuditLogPanel } from "@/components/hr/AuditLogPanel";
import { EmailNotificationPanel } from "@/components/hr/EmailNotificationPanel";
import { HRFormRegistry } from "@/components/hr/HRFormRegistry";
import { FormReviewQueue } from "@/components/hr/FormReviewQueue";
import { MissingFormsPanel } from "@/components/hr/MissingFormsPanel";
import { CSVExportButton } from "@/components/hr/CSVExportButton";
import { CSVImportButton } from "@/components/hr/CSVImportButton";

const ICON_MAP: Record<string, typeof Users> = {
  Users, FileCheck, Compass, GraduationCap, ShieldCheck,
  FolderOpen, Clock, AlertTriangle,
};

const SEVERITY_CONFIG = {
  red: { bg: "#FEE2E2", text: "#991B1B", iconColor: "#DC2626", label: "Critical" },
  amber: { bg: "#FFFBEB", text: "#92400E", iconColor: "#D97706", label: "Warning" },
};

export function HRCommandCenterPage() {
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const { commandCards, getCardMetrics, getActiveAlerts, getPendingActionsCount, getMissingDocumentsGlobally } = useHR();

  const metrics = getCardMetrics();
  const alerts = getActiveAlerts();
  const pendingCount = getPendingActionsCount();
  const missingDocs = getMissingDocumentsGlobally();

  // Search/filter state
  const [filters, setFilters] = useState<FilterState>({
    search: "", lane: "all", department: "all", supervisor: "all", moduleId: "", statusId: "",
  });

  const filteredPeople = useFilteredPeople(filters);

  // Build work queue from filtered people
  const activationPeople = filteredPeople.filter((p) => p.lane === "activation");
  const managementPeople = filteredPeople.filter((p) => p.lane === "management");

  return (
    <>
      <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
            HR Command Center
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Workforce Activation & Management Overview
          </p>
        </div>
        <div className="flex items-center gap-3">
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#FEE2E2" }}>
              <Bell size={16} style={{ color: "#DC2626" }} />
              <span className="text-[12px] font-semibold" style={{ color: "#991B1B" }}>
                {alerts.length} Alert{alerts.length > 1 ? "s" : ""}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: "#F0FDFA" }}>
            <Activity size={16} style={{ color: "#245C5A" }} />
            <span className="text-[12px] font-semibold" style={{ color: "#245C5A" }}>
              {pendingCount} Pending
            </span>
          </div>
          {permissions.canEditHR && <CreatePersonForm />}
        </div>
      </div>

      {/* Search & Filter */}
      <div className="mb-5">
        <PersonSearchFilter onFilterChange={setFilters} />
      </div>

      {/* Export Bar */}
      <div className="flex items-center justify-end gap-2 mb-4">
        {permissions.canEditHR && <CSVImportButton />}
        <CSVExportButton
          data={filteredPeople.map((p) => ({
            "First Name": p.firstName,
            "Last Name": p.lastName,
            "Employee ID": p.employeeId,
            Role: p.role,
            Department: p.department,
            Lane: p.lane,
            Supervisor: p.supervisor,
            "Hire Date": p.hireDate,
            Employee: p.isEmployee ? "Yes" : "No",
            Active: p.isActive ? "Yes" : "No",
          }))}
          filename={`hr-people-${new Date().toISOString().slice(0, 10)}.csv`}
          label={`Export ${filteredPeople.length} People`}
        />
      </div>

      {/* Missing Documents Alert */}
      {missingDocs.length > 0 && (
        <div className="mb-5 rounded-lg border p-3" style={{ borderColor: "#FECACA", backgroundColor: "#FEE2E2" }}>
          <div className="flex items-center gap-2 mb-2">
            <FileCheck size={16} style={{ color: "#DC2626" }} />
            <p className="text-[13px] font-semibold" style={{ color: "#991B1B" }}>
              Missing Required Documents ({missingDocs.length} people)
            </p>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {missingDocs.slice(0, 5).map((md) => (
              <div
                key={`${md.personId}-${md.moduleId}`}
                className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-all"
                onClick={() => navigate(`/hr/person/${md.personId}`)}
              >
                <span className="text-[11px] font-medium" style={{ color: "#991B1B" }}>{md.personName}</span>
                <span className="text-[10px]" style={{ color: "#B91C1C" }}>&bull; {md.moduleName}</span>
                <span className="text-[10px]" style={{ color: "#B91C1C" }}>&bull; {md.missingRecords.length} missing</span>
              </div>
            ))}
            {missingDocs.length > 5 && (
              <p className="text-[10px]" style={{ color: "#991B1B" }}>+{missingDocs.length - 5} more...</p>
            )}
          </div>
        </div>
      )}

      {/* Alert Banner */}
      {alerts.length > 0 && (
        <div className="mb-5 space-y-2">
          {alerts.map(({ rule, people: affected }) => {
            const sev = SEVERITY_CONFIG[rule.severity];
            return (
              <div
                key={rule.id}
                className="rounded-lg border p-3 flex items-center gap-3 cursor-pointer hover:shadow-sm transition-all"
                style={{ borderColor: sev.bg.replace("FF", "E2"), backgroundColor: sev.bg }}
                onClick={() => navigate(`/hr/${rule.moduleId}`)}
              >
                <AlertTriangle size={18} style={{ color: sev.iconColor }} className="flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold" style={{ color: sev.text }}>
                    {rule.title}
                  </p>
                  <p className="text-[11px]" style={{ color: sev.text, opacity: 0.8 }}>
                    {rule.description} &bull; {affected.length} affected
                  </p>
                </div>
                <ChevronRight size={16} style={{ color: sev.iconColor }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Visual Pipeline */}
      <div className="mb-6">
        <HRVisualPipeline />
      </div>

      {/* Reports & Exports */}
      <ReportExportPanel />

      {/* Workflow Engine Rules */}
      <div className="mb-6">
        <WorkflowStatusPanel />
      </div>

      {/* Alert Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        <HRFormRegistry />
        <FormReviewQueue />
        <MissingFormsPanel />
        <CredentialExpiryDashboard />
        <AuditLogPanel />
        <EmailNotificationPanel />
      </div>

      {/* Command Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {commandCards.map((card) => {
          const Icon = ICON_MAP[card.icon] || Users;
          const metricValue = (metrics as Record<string, number>)[card.metric] || 0;
          const isAlert = card.alertThreshold !== undefined && metricValue >= card.alertThreshold;

          return (
            <div
              key={card.id}
              onClick={() => navigate(`/hr/${card.moduleId}`)}
              className="rounded-lg border p-4 cursor-pointer transition-all hover:shadow-md group"
              style={{
                borderColor: isAlert ? (card.alertColor || "#DC2626") : "var(--card-border)",
                backgroundColor: "var(--card-bg)",
              }}
            >
              <div className="flex items-start justify-between mb-3">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ backgroundColor: isAlert ? (card.alertColor + "15") : "#F0FDFA" }}
                >
                  <Icon size={18} style={{ color: isAlert ? card.alertColor : "#245C5A" }} />
                </div>
                {isAlert && (
                  <span
                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ backgroundColor: (card.alertColor || "#DC2626") + "15", color: card.alertColor || "#DC2626" }}
                  >
                    Alert
                  </span>
                )}
              </div>
              <p className="text-[24px] font-bold mb-1" style={{ color: isAlert ? card.alertColor : "var(--topbar-title)" }}>
                {metricValue}
              </p>
              <p className="text-[12px] font-medium mb-2" style={{ color: "var(--topbar-subtitle)" }}>
                {card.title}
              </p>
              <div className="flex items-center gap-1 text-[11px] font-medium opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#245C5A" }}>
                View Module <ArrowRight size={12} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Work Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activation Pipeline */}
        <div className="rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
            <h3 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Users size={16} style={{ color: "#245C5A" }} />
              Activation Pipeline
            </h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
              {activationPeople.length} people
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {activationPeople.length === 0 ? (
              <div className="p-6 text-center">
                <CheckCircle size={24} style={{ color: "#059669" }} className="mx-auto mb-2" />
                <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                  No candidates in activation pipeline
                </p>
              </div>
            ) : (
              activationPeople.map((p) => (
                <div key={p.id} className="p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: "#245C5A" }}>
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {p.role} &bull; Current: {getCurrentStep(p)}
                    </p>
                  </div>
                  <ArrowRight size={14} style={{ color: "#CBD5E1" }} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Management Overview */}
        <div className="rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
            <h3 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <FolderOpen size={16} style={{ color: "#245C5A" }} />
              Management Overview
            </h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
              {managementPeople.length} active
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {managementPeople.slice(0, 6).map((p) => {
              const hasIssue = [
                p.moduleStatuses.credentials === "cr-expiring" || p.moduleStatuses.credentials === "cr-expired",
                p.moduleStatuses.performance !== "pa-closed" && p.moduleStatuses.performance !== "",
                p.moduleStatuses["personnel-files"] === "pf-incomplete",
              ].some(Boolean);
              return (
                <div key={p.id} className="p-3 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-bold flex-shrink-0" style={{ backgroundColor: hasIssue ? "#D97706" : "#245C5A" }}>
                    {p.firstName[0]}{p.lastName[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                      {p.firstName} {p.lastName}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {p.role} &bull; {p.supervisor}
                    </p>
                  </div>
                  {hasIssue && <AlertTriangle size={14} style={{ color: "#D97706" }} />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  </>
  );
}

function getCurrentStep(person: { moduleStatuses: Record<string, string> }): string {
  const moduleOrder = ["recruitment", "screening", "offers", "orientation", "onboarding", "clearance"];
  for (const modId of moduleOrder) {
    const status = person.moduleStatuses[modId];
    if (status && !status.endsWith("closed") && !status.endsWith("done") && !status.endsWith("signed") && status !== "c-cleared") {
      return modId.replace("-", " ");
    }
  }
  return "Complete";
}

export default HRCommandCenterPage;
