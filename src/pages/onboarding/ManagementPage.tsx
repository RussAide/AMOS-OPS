import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  TrendingUp,
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  GraduationCap,
  BookOpen,
  FileCheck,
} from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { getProgressPercentage, roleLabels } from "@/data/onboardingData";

export function ManagementPage() {
  const navigate = useNavigate();
  const { tracks, employees, evidence, steps } = useOnboarding();

  const totalModules = tracks.reduce((acc, t) => acc + t.moduleCount, 0);
  const completedModules = tracks.reduce((acc, t) => acc + t.completedModules, 0);
  const overallProgress = getProgressPercentage(completedModules, totalModules);
  const clearedTracks = tracks.filter((t) => t.clearanceStatus === "cleared").length;
  const inProgressTracks = tracks.filter((t) => t.clearanceStatus === "in-progress").length;

  const clearedEmployees = employees.filter((e) => e.clearanceStatus === "cleared").length;
  const restrictedEmployees = employees.filter((e) => e.clearanceStatus === "restricted").length;
  const avgProgress = employees.length > 0
    ? Math.round(employees.reduce((acc, e) => acc + getProgressPercentage(e.completedModules, e.totalModules), 0) / employees.length)
    : 0;

  const approvedEvidence = evidence.filter((e) => e.status === "approved").length;
  const pendingEvidence = evidence.filter((e) => e.status === "pending").length;

  const completedSteps = steps.filter((s) => s.completed).length;
  const completionRate = steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;

  // Track analytics
  const trackAnalytics = tracks.map((t) => {
    const pct = getProgressPercentage(t.completedModules, t.moduleCount);
    return { ...t, pct, roleLabel: roleLabels[t.role] || t.role };
  }).sort((a, b) => b.pct - a.pct);

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F3E8FF" }}>
            <ShieldAlert size={20} style={{ color: "#7C3AED" }} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
              Management Dashboard
            </h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Compliance overview and onboarding analytics
            </p>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} style={{ color: "#245C5A" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Overall Progress</span>
          </div>
          <p className="text-[28px] font-bold" style={{ color: "#245C5A" }}>{overallProgress}%</p>
          <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{completedModules}/{totalModules} modules</p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} style={{ color: "#2563EB" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Staff Onboarding</span>
          </div>
          <p className="text-[28px] font-bold" style={{ color: "#2563EB" }}>{avgProgress}%</p>
          <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Avg. per employee</p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} style={{ color: "#059669" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Tracks Cleared</span>
          </div>
          <p className="text-[28px] font-bold" style={{ color: "#059669" }}>{clearedTracks}/{tracks.length}</p>
          <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{inProgressTracks} in progress</p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center gap-2 mb-2">
            <FileCheck size={16} style={{ color: "#D97706" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Evidence</span>
          </div>
          <p className="text-[28px] font-bold" style={{ color: "#D97706" }}>{approvedEvidence}</p>
          <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{pendingEvidence} pending review</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Track Progress Table */}
        <div className="rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
            <h3 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <BookOpen size={16} style={{ color: "#245C5A" }} />
              Track Progress
            </h3>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {trackAnalytics.map((t) => (
              <div key={t.id} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                      {t.name}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {t.roleLabel}
                    </p>
                  </div>
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: t.pct === 100 ? "#059669" : "#245C5A" }}
                  >
                    {t.pct}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${t.pct}%`,
                      backgroundColor: t.pct === 100 ? "#059669" : "#245C5A",
                    }}
                  />
                </div>
                <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
                  {t.completedModules}/{t.moduleCount} modules
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Staff Overview */}
        <div className="rounded-lg border" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
            <h3 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Users size={16} style={{ color: "#2563EB" }} />
              Staff Overview
            </h3>
            <button
              onClick={() => navigate("/onboarding/supervisor")}
              className="text-[12px] font-medium flex items-center gap-1 hover:underline"
              style={{ color: "#245C5A" }}
            >
              View All <ArrowRight size={12} />
            </button>
          </div>
          <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
            {employees.map((emp) => {
              const pct = getProgressPercentage(emp.completedModules, emp.totalModules);
              const statusColor =
                emp.clearanceStatus === "cleared"
                  ? "#059669"
                  : emp.clearanceStatus === "restricted"
                  ? "#DC2626"
                  : "#245C5A";
              return (
                <div key={emp.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                        {emp.name}
                      </p>
                      <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                        {emp.employeeId} • {emp.track}
                      </p>
                    </div>
                    <span className="text-[12px] font-bold" style={{ color: statusColor }}>
                      {pct}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, backgroundColor: statusColor }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Compliance Summary */}
      <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <h3 className="text-[14px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
          <ShieldAlert size={16} style={{ color: "#7C3AED" }} />
          Compliance Summary
        </h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "#ECFDF5" }}>
            <CheckCircle size={20} style={{ color: "#059669" }} className="mx-auto mb-1" />
            <p className="text-[18px] font-bold" style={{ color: "#059669" }}>{clearedEmployees}</p>
            <p className="text-[11px]" style={{ color: "#065F46" }}>Cleared Staff</p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "#FEE2E2" }}>
            <AlertTriangle size={20} style={{ color: "#DC2626" }} className="mx-auto mb-1" />
            <p className="text-[18px] font-bold" style={{ color: "#DC2626" }}>{restrictedEmployees}</p>
            <p className="text-[11px]" style={{ color: "#991B1B" }}>Restricted</p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "#FFFBEB" }}>
            <Clock size={20} style={{ color: "#D97706" }} className="mx-auto mb-1" />
            <p className="text-[18px] font-bold" style={{ color: "#D97706" }}>{pendingEvidence}</p>
            <p className="text-[11px]" style={{ color: "#92400E" }}>Pending Evidence</p>
          </div>
          <div className="text-center p-3 rounded-lg" style={{ backgroundColor: "#EFF6FF" }}>
            <GraduationCap size={20} style={{ color: "#2563EB" }} className="mx-auto mb-1" />
            <p className="text-[18px] font-bold" style={{ color: "#2563EB" }}>{completionRate}%</p>
            <p className="text-[11px]" style={{ color: "#1E40AF" }}>Step Completion</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ManagementPage;
