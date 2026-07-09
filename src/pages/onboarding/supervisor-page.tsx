import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  CheckCircle,
  Clock,
  ShieldAlert,
  ChevronRight,
  Search,
  Filter,
  ArrowRight,
  GraduationCap,
} from "lucide-react";
import { useOnboarding } from "@/context/onboarding-context";
import { statusColors, getProgressPercentage } from "@/data/onboardingData";

type EmployeeFilter = "all" | "in-progress" | "pending" | "cleared" | "restricted";

export function SupervisorPage() {
  const navigate = useNavigate();
  const { employees, evidence, updateEmployeeClearance } = useOnboarding();
  const [filter, setFilter] = useState<EmployeeFilter>("all");
  const [search, setSearch] = useState("");
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);

  const filteredEmployees = employees
    .filter((e) => (filter === "all" ? true : e.clearanceStatus === filter))
    .filter((e) =>
      search
        ? e.name.toLowerCase().includes(search.toLowerCase()) ||
          e.employeeId.toLowerCase().includes(search.toLowerCase())
        : true
    );

  const pendingEvidence = evidence.filter((e) => e.status === "pending" || e.status === "reviewing");
  const totalEmployees = employees.length;
  const clearedCount = employees.filter((e) => e.clearanceStatus === "cleared").length;

  const handleClearanceUpdate = (employeeId: string, status: "cleared" | "restricted") => {
    updateEmployeeClearance(employeeId, status);
    const emp = employees.find((e) => e.id === employeeId);
    setActionFeedback(`${emp?.name} marked as ${status}`);
    setTimeout(() => setActionFeedback(null), 3000);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#EFF6FF" }}>
            <Users size={20} style={{ color: "#2563EB" }} />
          </div>
          <div>
            <h1 className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
              Supervisor Review
            </h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Monitor staff onboarding progress and manage clearances
            </p>
          </div>
        </div>
      </div>

      {/* Action Feedback */}
      {actionFeedback && (
        <div
          className="mb-4 p-3 rounded-lg flex items-center gap-2"
          style={{ backgroundColor: "#ECFDF5" }}
        >
          <CheckCircle size={16} style={{ color: "#059669" }} />
          <p className="text-[13px] font-medium" style={{ color: "#065F46" }}>
            {actionFeedback}
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center gap-2 mb-2">
            <Users size={16} style={{ color: "#2563EB" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
              Total Staff
            </span>
          </div>
          <p className="text-[24px] font-bold" style={{ color: "var(--topbar-title)" }}>
            {totalEmployees}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle size={16} style={{ color: "#059669" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
              Cleared
            </span>
          </div>
          <p className="text-[24px] font-bold" style={{ color: "#059669" }}>
            {clearedCount}
          </p>
        </div>
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert size={16} style={{ color: "#D97706" }} />
            <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
              Pending Evidence
            </span>
          </div>
          <p className="text-[24px] font-bold" style={{ color: "#D97706" }}>
            {pendingEvidence.length}
          </p>
        </div>
      </div>

      {/* Pending Evidence Quick List */}
      {pendingEvidence.length > 0 && (
        <div
          className="rounded-lg border p-4 mb-5"
          style={{ borderColor: "#FEF3C7", backgroundColor: "#FFFBEB" }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-semibold flex items-center gap-2" style={{ color: "#92400E" }}>
              <Clock size={16} />
              Evidence Awaiting Review ({pendingEvidence.length})
            </h3>
            <button
              onClick={() => navigate("/onboarding/evidence")}
              className="text-[12px] font-medium flex items-center gap-1 hover:underline"
              style={{ color: "#D97706" }}
            >
              View All <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-2">
            {pendingEvidence.slice(0, 3).map((ev) => (
              <div key={ev.id} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: "#FDE68A" }}>
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "#78350F" }}>
                    {ev.title}
                  </p>
                  <p className="text-[11px]" style={{ color: "#92400E" }}>
                    {ev.moduleTitle} • Submitted {ev.submittedAt}
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded capitalize"
                  style={{
                    backgroundColor: ev.status === "reviewing" ? "#DBEAFE" : "#FEF3C7",
                    color: ev.status === "reviewing" ? "#1E40AF" : "#92400E",
                  }}
                >
                  {ev.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or employee ID..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border text-[13px] outline-none focus:ring-2"
            style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto">
          <Filter size={14} className="mr-1 flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }} />
          {(["all", "in-progress", "pending", "cleared", "restricted"] as EmployeeFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-[12px] font-medium capitalize transition-all flex-shrink-0"
              style={{
                backgroundColor: filter === f ? "#245C5A" : "transparent",
                color: filter === f ? "#fff" : "var(--topbar-subtitle)",
              }}
            >
              {f.replace("-", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Employee List */}
      <div className="space-y-2">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-12">
            <Users size={40} className="mx-auto mb-3" style={{ color: "#CBD5E1" }} />
            <p className="text-[14px] font-medium" style={{ color: "var(--topbar-title)" }}>
              No staff found
            </p>
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const pct = getProgressPercentage(emp.completedModules, emp.totalModules);
            const colors = statusColors[emp.clearanceStatus];
            return (
              <div
                key={emp.id}
                className="rounded-lg border p-4 transition-all hover:shadow-sm"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[11px] font-semibold uppercase tracking-[1px] px-2 py-0.5 rounded"
                        style={{ backgroundColor: colors.bg, color: colors.text }}
                      >
                        {colors.label}
                      </span>
                      <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
                        {emp.employeeId}
                      </span>
                    </div>
                    <h4 className="text-[14px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>
                      {emp.name}
                    </h4>
                    <div className="flex items-center gap-3 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                      <span className="flex items-center gap-1">
                        <GraduationCap size={12} />
                        {emp.track}
                      </span>
                      <span>Supervisor: {emp.supervisor}</span>
                    </div>

                    {/* Progress */}
                    <div className="flex items-center gap-3 mt-3">
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: pct === 100 ? "#059669" : "#245C5A",
                          }}
                        />
                      </div>
                      <span className="text-[11px] font-medium flex-shrink-0" style={{ color: "var(--topbar-title)" }}>
                        {emp.completedModules}/{emp.totalModules} ({pct}%)
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/onboarding/employee/${emp.id}`)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-medium border transition-all hover:shadow-sm"
                      style={{ borderColor: "var(--card-border)", color: "var(--topbar-title)" }}
                    >
                      View
                      <ArrowRight size={12} />
                    </button>
                    {emp.clearanceStatus === "in-progress" && (
                      <>
                        <button
                          onClick={() => handleClearanceUpdate(emp.id, "cleared")}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all hover:shadow-sm"
                          style={{ backgroundColor: "#059669" }}
                        >
                          Clear
                        </button>
                        <button
                          onClick={() => handleClearanceUpdate(emp.id, "restricted")}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all hover:shadow-sm"
                          style={{ backgroundColor: "#DC2626" }}
                        >
                          Restrict
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default SupervisorPage;
