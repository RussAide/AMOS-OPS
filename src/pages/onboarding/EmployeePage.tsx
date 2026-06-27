import { useParams, useNavigate } from "react-router-dom";
import { Users, ArrowLeft, CheckCircle, BookOpen } from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { getEmployeeById, getProgressPercentage, statusColors } from "@/data/onboardingData";

export function EmployeePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { modules } = useOnboarding();
  const employee = id ? getEmployeeById(id) : undefined;

  if (!employee) {
    return (
      <div className="text-center py-16">
        <Users size={48} className="mx-auto mb-4" style={{ color: "#CBD5E1" }} />
        <h2 className="text-[18px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>
          Employee Not Found
        </h2>
        <button
          onClick={() => navigate("/onboarding/supervisor")}
          className="px-4 py-2 rounded-lg text-[13px] font-medium text-white"
          style={{ backgroundColor: "#245C5A" }}
        >
          Back to Supervisor Review
        </button>
      </div>
    );
  }

  const pct = getProgressPercentage(employee.completedModules, employee.totalModules);
  const colors = statusColors[employee.clearanceStatus];
  const employeeModules = modules.slice(0, employee.totalModules);

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => navigate("/onboarding/supervisor")}
          className="flex items-center gap-1 text-[13px] font-medium hover:underline"
          style={{ color: "#245C5A" }}
        >
          <ArrowLeft size={14} />
          Supervisor Review
        </button>
        <span style={{ color: "var(--topbar-subtitle)" }}>/</span>
        <span className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          {employee.name}
        </span>
      </div>

      {/* Employee Header Card */}
      <div
        className="rounded-lg border p-5 mb-5"
        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-[20px] font-bold"
              style={{ backgroundColor: "#245C5A" }}
            >
              {employee.name.split(" ").map((n) => n[0]).join("")}
            </div>
            <div>
              <h2 className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
                {employee.name}
              </h2>
              <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
                {employee.employeeId} • {employee.track}
              </p>
            </div>
          </div>
          <span
            className="text-[11px] font-semibold uppercase tracking-[1px] px-3 py-1.5 rounded"
            style={{ backgroundColor: colors.bg, color: colors.text }}
          >
            {colors.label}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFB" }}>
            <p className="text-[11px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Supervisor</p>
            <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
              {employee.supervisor}
            </p>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFB" }}>
            <p className="text-[11px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Start Date</p>
            <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
              {employee.startDate}
            </p>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFB" }}>
            <p className="text-[11px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Modules</p>
            <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
              {employee.completedModules}/{employee.totalModules}
            </p>
          </div>
          <div className="p-3 rounded-lg" style={{ backgroundColor: "#F8FAFB" }}>
            <p className="text-[11px] mb-1" style={{ color: "var(--topbar-subtitle)" }}>Progress</p>
            <p className="text-[13px] font-bold" style={{ color: pct === 100 ? "#059669" : "#245C5A" }}>
              {pct}%
            </p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                backgroundColor: pct === 100 ? "#059669" : "#245C5A",
              }}
            />
          </div>
          <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
            {pct}%
          </span>
        </div>
      </div>

      {/* Module Progress */}
      <div
        className="rounded-lg border"
        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      >
        <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[15px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <BookOpen size={16} style={{ color: "#245C5A" }} />
            Assigned Modules
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--card-border)" }}>
          {employeeModules.map((mod, index) => {
            const isCompleted = index < employee.completedModules;
            return (
              <div key={mod.id} className="p-4 flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: isCompleted ? "#ECFDF5" : "#F1F5F9",
                  }}
                >
                  {isCompleted ? (
                    <CheckCircle size={16} style={{ color: "#059669" }} />
                  ) : (
                    <span className="text-[12px] font-medium" style={{ color: "#64748B" }}>
                      {index + 1}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-[13px] font-medium truncate"
                    style={{
                      color: isCompleted ? "#059669" : "var(--topbar-title)",
                      textDecoration: isCompleted ? "line-through" : "none",
                    }}
                  >
                    {mod.title}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    {mod.category} • {mod.stepCount} steps
                  </p>
                </div>
                <span
                  className="text-[11px] font-medium px-2 py-0.5 rounded flex-shrink-0"
                  style={{
                    backgroundColor: isCompleted ? "#ECFDF5" : "#FEF3C7",
                    color: isCompleted ? "#065F46" : "#92400E",
                  }}
                >
                  {isCompleted ? "Completed" : "Pending"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
