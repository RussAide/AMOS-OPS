import { useNavigate } from "react-router-dom";
import {
  BookOpen,
  Users,
  CheckCircle,
  ShieldAlert,
  GraduationCap,
  ArrowRight,
  TrendingUp,
  FileCheck,
} from "lucide-react";
import { useOnboarding } from "@/context/onboarding-context";
import { useAuth } from "@/hooks/use-auth";
import { TrackSelectionGrid } from "@/components/onboarding/track-selection-grid";
import { getProgressPercentage } from "@/data/onboardingData";

export function OnboardingHomePage() {
  const navigate = useNavigate();
  const { workspace } = useAuth();
  const { tracks, employees, evidence } = useOnboarding();

  const totalModules = tracks.reduce((acc, t) => acc + t.moduleCount, 0);
  const completedModules = tracks.reduce(
    (acc, t) => acc + t.completedModules,
    0,
  );
  const overallProgress = getProgressPercentage(completedModules, totalModules);
  const clearedTracks = tracks.filter(
    (t) => t.clearanceStatus === "cleared",
  ).length;
  const pendingEvidence = evidence.filter(
    (e) => e.status === "pending" || e.status === "reviewing",
  ).length;
  const inProgressEmployees = employees.filter(
    (e) => e.clearanceStatus === "in-progress",
  ).length;

  const statCards = [
    {
      label: "Overall Progress",
      value: `${overallProgress}%`,
      sublabel: `${completedModules}/${totalModules} modules`,
      icon: TrendingUp,
      color: "#245C5A",
      bgColor: "#F0FDFA",
      onClick: null,
    },
    {
      label: "Cleared Tracks",
      value: `${clearedTracks}/${tracks.length}`,
      sublabel: "Tracks completed",
      icon: CheckCircle,
      color: "#059669",
      bgColor: "#ECFDF5",
      onClick: null,
    },
    {
      label: "Active Staff",
      value: `${inProgressEmployees}`,
      sublabel: "In onboarding",
      icon: Users,
      color: "#2563EB",
      bgColor: "#EFF6FF",
      onClick: () => navigate("/onboarding/supervisor"),
    },
    {
      label: "Pending Evidence",
      value: `${pendingEvidence}`,
      sublabel: "Awaiting review",
      icon: FileCheck,
      color: "#D97706",
      bgColor: "#FFFBEB",
      onClick: () => navigate("/onboarding/evidence"),
    },
  ].filter(
    (stat) =>
      workspace !== "training" ||
      stat.label === "Overall Progress" ||
      stat.label === "Cleared Tracks",
  );

  return (
    <>
      <div>
        {workspace === "training" && (
          <div
            role="status"
            className="mb-5 rounded-lg border border-amber-400 bg-amber-50 p-4 text-amber-950"
          >
            <p className="flex items-center gap-2 text-[14px] font-bold">
              <ShieldAlert size={17} /> Synthetic-only orientation pilot
            </p>
            <p className="mt-1 text-[12px] leading-5">
              Use fictional examples only. Practice progress is local to this
              session and is not an employment clearance, certification, or
              authoritative training record. Evidence uploads and operational
              administration are disabled.
            </p>
          </div>
        )}
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "#245C5A" }}
            >
              <GraduationCap size={20} className="text-white" />
            </div>
            <div>
              <h1
                className="text-[22px] font-bold"
                style={{ color: "var(--topbar-title)" }}
              >
                Onboarding Academy
              </h1>
              <p
                className="text-[13px]"
                style={{ color: "var(--topbar-subtitle)" }}
              >
                Role-based training and clearance management for all staff
              </p>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {statCards.map((stat) => {
            const Icon = stat.icon;
            const clickable = !!stat.onClick;
            return (
              <div
                key={stat.label}
                onClick={stat.onClick || undefined}
                className={`rounded-lg border p-4 transition-all duration-200 ${
                  clickable ? "cursor-pointer hover:shadow-md" : ""
                }`}
                style={{
                  borderColor: "var(--card-border)",
                  backgroundColor: "var(--card-bg)",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: stat.bgColor }}
                  >
                    <Icon size={18} style={{ color: stat.color }} />
                  </div>
                  {clickable && (
                    <ArrowRight size={14} style={{ color: stat.color }} />
                  )}
                </div>
                <p
                  className="text-[22px] font-bold mb-0.5"
                  style={{ color: "var(--topbar-title)" }}
                >
                  {stat.value}
                </p>
                <p
                  className="text-[12px] font-medium"
                  style={{ color: stat.color }}
                >
                  {stat.label}
                </p>
                <p
                  className="text-[11px] mt-1"
                  style={{ color: "var(--topbar-subtitle)" }}
                >
                  {stat.sublabel}
                </p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div
          className="rounded-lg border p-4 mb-6"
          style={{
            borderColor: "var(--card-border)",
            backgroundColor: "var(--card-bg)",
          }}
        >
          <h3
            className="text-[14px] font-semibold mb-3"
            style={{ color: "var(--topbar-title)" }}
          >
            Quick Actions
          </h3>
          <div className="flex flex-wrap gap-2">
            {workspace === "training" ? (
              <button
                onClick={() => navigate("/onboarding/training")}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all hover:shadow-sm"
                style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}
              >
                <BookOpen size={14} />
                Browse practice modules
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate("/onboarding/supervisor")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all hover:shadow-sm"
                  style={{ backgroundColor: "#EFF6FF", color: "#2563EB" }}
                >
                  <Users size={14} />
                  Review Staff
                </button>
                <button
                  onClick={() => navigate("/onboarding/evidence")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all hover:shadow-sm"
                  style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}
                >
                  <FileCheck size={14} />
                  Evidence Review
                </button>
                <button
                  onClick={() => navigate("/onboarding/management")}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium transition-all hover:shadow-sm"
                  style={{ backgroundColor: "#F3E8FF", color: "#7C3AED" }}
                >
                  <ShieldAlert size={14} />
                  Compliance Dashboard
                </button>
              </>
            )}
          </div>
        </div>

        {/* Track Selection */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-[18px] font-semibold flex items-center gap-2"
              style={{ color: "var(--topbar-title)" }}
            >
              <BookOpen size={20} style={{ color: "#245C5A" }} />
              Select Your Track
            </h2>
            <span
              className="text-[12px] font-medium px-2 py-1 rounded"
              style={{ backgroundColor: "#F1F5F9", color: "#475569" }}
            >
              {tracks.length} tracks available
            </span>
          </div>
        </div>

        <TrackSelectionGrid />
      </div>
    </>
  );
}

export default OnboardingHomePage;
