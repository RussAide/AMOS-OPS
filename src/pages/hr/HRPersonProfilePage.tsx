import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Users, FileCheck, Compass, GraduationCap, ShieldCheck,
  FolderOpen, Award, TrendingUp, ClipboardCheck, CheckCircle,
  XCircle, ChevronRight, Calendar, Briefcase, Mail, Shield, AlertOctagon, Ban,
  Search, Eye
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useHR } from "@/context/HRContext";
import { getHRModule } from "@/data/hrLifecycleData";
import { StatusTransitionLog } from "@/components/hr/StatusTransitionLog";
import { DocumentTracker } from "@/components/hr/DocumentTracker";
import { PerformanceReviewForm } from "@/components/hr/PerformanceReviewForm";
import { SeparationChecklist } from "@/components/hr/SeparationChecklist";
import { PersonEditForm } from "@/components/hr/PersonEditForm";
import { InlineStatusChanger } from "@/components/hr/InlineStatusChanger";
import { FormAssignmentPanel } from "@/components/hr/FormAssignmentPanel";

const MOD_ICONS: Record<string, typeof Users> = {
  recruitment: Users, screening: Search, offers: FileCheck,
  orientation: Compass, onboarding: GraduationCap, clearance: ShieldCheck,
  "personnel-files": FolderOpen, credentials: Award,
  performance: TrendingUp, compliance: ClipboardCheck, separation: Ban,
};

const MOD_ORDER = [
  "recruitment", "screening", "offers", "orientation", "onboarding", "clearance",
  "personnel-files", "credentials", "performance", "compliance", "separation",
];

export function HRPersonProfilePage() {
  const { personId } = useParams<{ personId: string }>();
  const navigate = useNavigate();
  const { permissions } = useAuth();
  const { people, getTransitionsForPerson } = useHR();

  const person = people.find((p) => p.id === personId);

  if (!person) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-[18px] font-bold mb-2" style={{ color: "var(--topbar-title)" }}>
          Person Not Found
        </h2>
        <button
          onClick={() => navigate("/hr")}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white"
          style={{ backgroundColor: "#245C5A" }}
        >
          Back to Command Center
        </button>
      </div>
    );
  }

  const activationModules = MOD_ORDER.slice(0, 6);
  const managementModules = MOD_ORDER.slice(6);

  const completedActivation = activationModules.filter((m) => {
    const s = person.moduleStatuses[m];
    return s && (s.includes("closed") || s.includes("done") || s.includes("signed") || s === "c-cleared");
  }).length;

  const isCleared = person.moduleStatuses.clearance === "c-cleared";
  const isRestricted = person.moduleStatuses.clearance === "c-restricted";
  const activationProgress = Math.round((completedActivation / activationModules.length) * 100);

  return (
    <div className="p-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate("/hr")}
          className="flex items-center gap-1 text-[13px] font-medium hover:underline"
          style={{ color: "#245C5A" }}
        >
          <ArrowLeft size={14} />
          Command Center
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          {person.firstName} {person.lastName}
        </span>
      </div>

      {/* Profile Header */}
      <div className="rounded-lg border p-5 mb-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="flex items-start gap-4">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-[20px] font-bold flex-shrink-0"
            style={{
              backgroundColor: isCleared ? "#059669" : isRestricted ? "#D97706" : "#245C5A",
              border: person.isEmployee ? "none" : "3px dashed #D97706",
            }}
          >
            {person.firstName[0]}{person.lastName[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
                {person.firstName} {person.lastName}
              </h1>
              {permissions.canEditHR && <PersonEditForm personId={person.id} />}
              {!person.isEmployee ? (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#FEF3C7", color: "#92400E" }}>
                  Candidate
                </span>
              ) : (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}>
                  Employee
                </span>
              )}
              {isCleared && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: "#D1FAE5", color: "#065F46" }}>
                  <Shield size={12} /> Cleared for Duty
                </span>
              )}
              {isRestricted && (
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1" style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}>
                  <AlertOctagon size={12} /> Restricted
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
              {person.employeeId && <span className="flex items-center gap-1"><Briefcase size={12} />{person.employeeId}</span>}
              <span className="flex items-center gap-1"><Users size={12} />{person.role}</span>
              <span className="flex items-center gap-1"><Calendar size={12} />{person.hireDate || "Not hired"}</span>
              <span className="flex items-center gap-1"><Mail size={12} />{person.supervisor || "Unassigned"}</span>
            </div>
          </div>
          {/* Activation Progress */}
          <div className="text-right flex-shrink-0">
            <p className="text-[28px] font-bold" style={{ color: isCleared ? "#059669" : "#245C5A" }}>
              {activationProgress}%
            </p>
            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
              Activation Complete
            </p>
            <div className="w-24 h-2 rounded-full bg-gray-100 overflow-hidden mt-1">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${activationProgress}%`,
                  backgroundColor: isCleared ? "#059669" : "#245C5A",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Eligibility Signal (if cleared or restricted) */}
      {(isCleared || isRestricted) && (
        <div
          className="rounded-lg border p-4 mb-5"
          style={{
            borderColor: isCleared ? "#059669" : "#D97706",
            backgroundColor: isCleared ? "#ECFDF5" : "#FFFBEB",
          }}
        >
          <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: isCleared ? "#065F46" : "#92400E" }}>
            <ShieldCheck size={16} />
            Operations Eligibility Signal {isCleared ? "(Cleared)" : "(Restricted)"}
            <span className="text-[10px] font-normal ml-2 px-2 py-0.5 rounded" style={{ backgroundColor: "#fff", color: "#666" }}>
              Read-Only
            </span>
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#666" }}>Employee</p>
              <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{person.firstName} {person.lastName}</p>
              <p className="text-[11px]" style={{ color: "#666" }}>{person.employeeId}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#666" }}>Eligible Role</p>
              <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{person.role}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#666" }}>Clearance Status</p>
              <p className="text-[13px] font-semibold" style={{ color: isCleared ? "#059669" : "#D97706" }}>
                {isCleared ? "Cleared for Duty" : "Restricted Clearance"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider" style={{ color: "#666" }}>Effective Date</p>
              <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{person.hireDate || "Pending"}</p>
            </div>
          </div>
          {isRestricted && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: "#FDE68A" }}>
              <p className="text-[12px] font-semibold" style={{ color: "#92400E" }}>Restrictions:</p>
              <p className="text-[12px]" style={{ color: "#78350F" }}>
                Supervision required. No unsupervised client contact. Review in 30 days.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Activation Journey */}
      <div className="rounded-lg border p-5 mb-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <h2 className="text-[16px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
          <ChevronRight size={18} style={{ color: "#245C5A" }} />
          Workforce Activation Journey
        </h2>
        <div className="flex flex-col gap-2">
          {activationModules.map((modId, index) => {
            const mod = getHRModule(modId);
            if (!mod) return null;
            const Icon = MOD_ICONS[modId] || Users;
            const statusId = person.moduleStatuses[modId];
            const status = mod.statusModel.find((s) => s.id === statusId);
            const isComplete = status?.category === "complete" || statusId?.includes("closed");
            const isTerminal = status?.category === "terminal";

            return (
              <div
                key={modId}
                onClick={() => navigate(`/hr/${modId}`)}
                className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm"
                style={{
                  borderColor: isComplete ? "#059669" : isTerminal ? "#DC2626" : "var(--card-border)",
                  backgroundColor: isComplete ? "#ECFDF5" : isTerminal ? "#FEF2F2" : "var(--card-bg)",
                }}
              >
                <div className="flex items-center gap-2 flex-shrink-0 w-8">
                  {isComplete ? (
                    <CheckCircle size={18} style={{ color: "#059669" }} />
                  ) : isTerminal ? (
                    <XCircle size={18} style={{ color: "#DC2626" }} />
                  ) : (
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                      style={{ backgroundColor: status ? "#245C5A" : "#CBD5E1" }}
                    >
                      {index + 1}
                    </div>
                  )}
                </div>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#F0FDFA" }}>
                  <Icon size={16} style={{ color: "#245C5A" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>
                    {mod.name}
                  </p>
                </div>
                {permissions.canEditHR ? (
                  <InlineStatusChanger
                    personId={person.id}
                    personName={`${person.firstName} ${person.lastName}`}
                    moduleId={modId}
                    currentStatusId={statusId || ""}
                  />
                ) : status ? (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded flex-shrink-0 flex items-center gap-1" style={{ backgroundColor: status.bgColor, color: status.color }}>
                    <Eye size={10} /> {status.label}
                  </span>
                ) : (
                  <span className="text-[11px] px-2 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: "#F3F4F6", color: "#9CA3AF" }}>Not Started</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Status Transition Log */}
      <div className="mt-5 mb-5">
        <StatusTransitionLog transitions={getTransitionsForPerson(person.id)} />
      </div>

      {/* Document Tracker */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <FileCheck size={18} style={{ color: "#245C5A" }} />
            Required Documents
          </h2>
        </div>
        <DocumentTracker personId={person.id} />
      </div>

      {/* Management Status */}
      {person.isEmployee && (
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h2 className="text-[16px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Briefcase size={18} style={{ color: "#245C5A" }} />
            Workforce Management Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {managementModules.map((modId) => {
              const mod = getHRModule(modId);
              if (!mod) return null;
              const Icon = MOD_ICONS[modId] || Users;
              const statusId = person.moduleStatuses[modId];
              const status = mod.statusModel.find((s) => s.id === statusId);
              const hasIssue = status?.category === "terminal" || statusId === "cr-expiring" || statusId === "cr-expired" || statusId === "pf-incomplete";

              return (
                <div
                  key={modId}
                  onClick={() => navigate(`/hr/${modId}`)}
                  className="rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm"
                  style={{
                    borderColor: hasIssue ? "#DC2626" : "var(--card-border)",
                    backgroundColor: hasIssue ? "#FEF2F2" : "var(--card-bg)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} style={{ color: hasIssue ? "#DC2626" : "#245C5A" }} />
                    <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{mod.name}</p>
                  </div>
                  {permissions.canEditHR ? (
                    <InlineStatusChanger
                      personId={person.id}
                      personName={`${person.firstName} ${person.lastName}`}
                      moduleId={modId}
                      currentStatusId={statusId || ""}
                    />
                  ) : status ? (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ backgroundColor: status.bgColor, color: status.color }}>
                      {status.label}
                    </span>
                  ) : (
                    <span className="text-[11px]" style={{ color: "#9CA3AF" }}>--</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Performance Review */}
          <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--card-border)" }}>
            <PerformanceReviewForm
              personId={person.id}
              personName={`${person.firstName} ${person.lastName}`}
            />
          </div>

          {/* Form Assignments */}
          <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--card-border)" }}>
            <FormAssignmentPanel
              personId={person.id}
              personRole={person.role}
            />
          </div>

          {/* Separation / Offboarding Checklist */}
          <div className="mt-5 pt-5 border-t" style={{ borderColor: "var(--card-border)" }}>
            <SeparationChecklist
              personId={person.id}
              personName={`${person.firstName} ${person.lastName}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}
