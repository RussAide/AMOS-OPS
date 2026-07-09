import { useNavigate } from "react-router-dom";
import {
  Users, Search, FileText, Compass, GraduationCap, ShieldCheck,
  FolderOpen, Award, TrendingUp, ClipboardCheck, LogOut, ArrowRight,
} from "lucide-react";
import { useHR } from "@/context/hr-context";

const ACTIVATION_MODULES = [
  { id: "recruitment", label: "Recruitment", icon: Users },
  { id: "screening", label: "Screening", icon: Search },
  { id: "offers", label: "Offers", icon: FileText },
  { id: "orientation", label: "Orientation", icon: Compass },
  { id: "onboarding", label: "Training", icon: GraduationCap },
  { id: "clearance", label: "Clearance", icon: ShieldCheck },
];

const MANAGEMENT_MODULES = [
  { id: "personnel-files", label: "Personnel", icon: FolderOpen },
  { id: "credentials", label: "Credentials", icon: Award },
  { id: "performance", label: "Performance", icon: TrendingUp },
  { id: "compliance", label: "Compliance", icon: ClipboardCheck },
  { id: "separation", label: "Separation", icon: LogOut },
];

const MODULE_COLORS: Record<string, string> = {
  recruitment: "#245C5A",
  screening: "#7C3AED",
  offers: "#2563EB",
  orientation: "#D97706",
  onboarding: "#059669",
  clearance: "#0D9488",
  "personnel-files": "#4F46E5",
  credentials: "#7C3AED",
  performance: "#DC2626",
  compliance: "#2563EB",
  separation: "#6B7280",
};

function PipelineSegment({
  mod,
  count,
  isLast,
}: {
  mod: (typeof ACTIVATION_MODULES)[0];
  count: number;
  isLast: boolean;
}) {
  const navigate = useNavigate();
  const Icon = mod.icon;
  const color = MODULE_COLORS[mod.id] || "#245C5A";
  return (
    <div className="flex items-center flex-1">
      <div
        className="flex-1 relative cursor-pointer group"
        onClick={() => navigate(`/hr/${mod.id}`)}
      >
        {/* Connector line background */}
        <div className="absolute top-[18px] left-0 right-0 h-[3px] rounded" style={{ backgroundColor: "#E2E8F0" }} />
        {/* Filled connector */}
        <div
          className="absolute top-[18px] left-0 h-[3px] rounded transition-all"
          style={{
            backgroundColor: color,
            width: count > 0 ? "100%" : "0%",
            opacity: count > 0 ? 0.4 : 0,
          }}
        />

        <div className="relative flex flex-col items-center pt-0">
          {/* Node circle */}
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all z-10"
            style={{
              borderColor: count > 0 ? color : "#E2E8F0",
              backgroundColor: count > 0 ? color + "18" : "#F8FAFC",
            }}
          >
            <Icon size={16} style={{ color: count > 0 ? color : "#94A3B8" }} />
          </div>

          {/* Label */}
          <p
            className="text-[10px] font-semibold mt-1.5 text-center leading-tight transition-colors"
            style={{ color: count > 0 ? color : "#94A3B8" }}
          >
            {mod.label}
          </p>

          {/* Count badge */}
          <div
            className="mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all"
            style={{
              backgroundColor: count > 0 ? color + "18" : "transparent",
              color: count > 0 ? color : "#94A3B8",
            }}
          >
            {count}
          </div>
        </div>
      </div>

      {!isLast && (
        <div className="flex-shrink-0 mx-0.5 mt-[-14px]">
          <ArrowRight size={12} style={{ color: "#CBD5E1" }} />
        </div>
      )}
    </div>
  );
}

export function HRVisualPipeline() {
  const { people, getPeopleInModule } = useHR();

  // Count people actively in each activation module (not yet complete)
  const activationCounts = ACTIVATION_MODULES.map((mod) => {
    const inModule = getPeopleInModule(mod.id);
    // Count people whose current "active" status is in this module
    const activeCount = inModule.filter((p) => {
      const status = p.moduleStatuses[mod.id];
      if (!status) return false;
      // Count if status is not a terminal/complete status
      const isDone =
        status.endsWith("-closed") ||
        status.endsWith("-done") ||
        status.endsWith("-signed") ||
        status === "c-cleared" ||
        status === "s-selected" ||
        status === "r-selected" ||
        status === "r-screened" ||
        status === "s-recommended" ||
        status === "s-ref-done" ||
        status === "s-interview-done" ||
        status === "s-phone" ||
        status === "o-signed" ||
        status === "ob-competency" ||
        status === "ob-certified" ||
        status === "pf-complete" ||
        status === "cr-current" ||
        status === "pa-closed" ||
        status === "ca-audit-closed" ||
        status === "sep-closed";
      return !isDone;
    }).length;
    return { ...mod, count: Math.max(activeCount, 0) };
  });

  // Count people in each management module with issues
  const managementCounts = MANAGEMENT_MODULES.map((mod) => {
    const inModule = getPeopleInModule(mod.id);
    const issueCount = inModule.filter((p) => {
      const status = p.moduleStatuses[mod.id];
      if (!status) return false;
      const hasIssue =
        status === "pf-incomplete" ||
        status === "cr-expiring" ||
        status === "cr-expired" ||
        status.startsWith("pa-") && status !== "pa-closed" ||
        status.startsWith("ca-") && status !== "ca-audit-closed";
      return hasIssue;
    }).length;
    return { ...mod, count: issueCount };
  });

  const totalActivePeople = people.filter((p) => p.lane === "activation").length;
  const totalIssuePeople = managementCounts.reduce((sum, m) => sum + m.count, 0);

  return (
    <div className="space-y-5">
      {/* Activation Pipeline */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
              <Users size={14} style={{ color: "#245C5A" }} />
            </div>
            Workforce Activation Pipeline
          </h3>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}>
            {totalActivePeople} total
          </span>
        </div>

        <div className="flex items-center px-1">
          {activationCounts.map((mod, idx) => (
            <PipelineSegment
              key={mod.id}
              mod={mod}
              count={mod.count}
              isLast={idx === activationCounts.length - 1}
            />
          ))}
        </div>
      </div>

      {/* Management Pipeline */}
      <div
        className="rounded-lg border p-4"
        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <div className="w-6 h-6 rounded flex items-center justify-center" style={{ backgroundColor: "#FEF3C7" }}>
              <TrendingUp size={14} style={{ color: "#D97706" }} />
            </div>
            Workforce Management — Issues & Actions
          </h3>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: totalIssuePeople > 0 ? "#FEF3C7" : "#F0FDFA", color: totalIssuePeople > 0 ? "#92400E" : "#245C5A" }}>
            {totalIssuePeople} requiring attention
          </span>
        </div>

        <div className="flex items-center px-1">
          {managementCounts.map((mod, idx) => (
            <PipelineSegment
              key={mod.id}
              mod={mod}
              count={mod.count}
              isLast={idx === managementCounts.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
