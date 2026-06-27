import { useNavigate } from "react-router-dom";
import { Lock, Play, CheckCircle, Clock, ArrowRight, BookOpen } from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { getProgressPercentage, roleLabels } from "@/data/onboardingData";

const statusIcons = {
  locked: Lock,
  available: Play,
  "in-progress": Clock,
  completed: CheckCircle,
};

const statusColors: Record<string, { border: string; icon: string; bg: string }> = {
  locked: { border: "#E2E8F0", icon: "#94A3B8", bg: "#F8FAFB" },
  available: { border: "#245C5A", icon: "#245C5A", bg: "#F0FDFA" },
  "in-progress": { border: "#2563EB", icon: "#2563EB", bg: "#EFF6FF" },
  completed: { border: "#059669", icon: "#059669", bg: "#ECFDF5" },
};

const categoryColors: Record<string, string> = {
  Compliance: "#7C3AED",
  Clinical: "#2563EB",
  Operations: "#D97706",
  Professional: "#059669",
};

interface TrackDetailViewProps {
  trackId: string;
}

export function TrackDetailView({ trackId }: TrackDetailViewProps) {
  const navigate = useNavigate();
  const { tracks, getModulesForTrack } = useOnboarding();
  const track = tracks.find((t) => t.id === trackId);
  const modules = getModulesForTrack(trackId);

  if (!track) {
    return (
      <div className="text-center py-12">
        <p className="text-[14px]" style={{ color: "var(--topbar-subtitle)" }}>
          Track not found.
        </p>
      </div>
    );
  }

  const roleLabel = roleLabels[track.role] || track.role;
  const trackPct = getProgressPercentage(track.completedModules, track.moduleCount);

  return (
    <div>
      {/* Track Header */}
      <div
        className="rounded-lg border p-5 mb-5"
        style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="text-[11px] font-semibold uppercase tracking-[1px] px-2 py-1 rounded"
                style={{
                  backgroundColor: track.clearanceStatus === "cleared" ? "#D1FAE5" : "#DBEAFE",
                  color: track.clearanceStatus === "cleared" ? "#065F46" : "#1E40AF",
                }}
              >
                {track.clearanceStatus === "cleared" ? "Cleared" : "In Progress"}
              </span>
              <span
                className="text-[12px] font-medium px-2 py-1 rounded"
                style={{ backgroundColor: "#F1F5F9", color: "#475569" }}
              >
                {roleLabel}
              </span>
            </div>
            <h2 className="text-[20px] font-bold" style={{ color: "var(--topbar-title)" }}>
              {track.name}
            </h2>
          </div>
          <div className="text-right">
            <span className="text-[24px] font-bold" style={{ color: "#245C5A" }}>
              {trackPct}%
            </span>
          </div>
        </div>
        <p className="text-[13px] mb-4" style={{ color: "var(--topbar-subtitle)" }}>
          {track.description}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${trackPct}%`,
                backgroundColor: trackPct === 100 ? "#059669" : "#245C5A",
              }}
            />
          </div>
          <span className="text-[12px] font-medium flex-shrink-0" style={{ color: "var(--topbar-title)" }}>
            {track.completedModules}/{track.moduleCount} modules
          </span>
        </div>
      </div>

      {/* Modules Grid */}
      <div className="flex items-center justify-between mb-4">
        <h3
          className="text-[16px] font-semibold flex items-center gap-2"
          style={{ color: "var(--topbar-title)" }}
        >
          <BookOpen size={18} style={{ color: "#245C5A" }} />
          Modules ({modules.length})
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {modules.map((mod) => {
          const StatusIcon = statusIcons[mod.status];
          const colors = statusColors[mod.status];
          const pct = getProgressPercentage(mod.completedSteps, mod.stepCount);
          const catColor = categoryColors[mod.category] || "#64748B";
          const isClickable = mod.status !== "locked";

          return (
            <div
              key={mod.id}
              onClick={() => isClickable && navigate(`/onboarding/module/${mod.id}`)}
              className={`rounded-lg border p-4 transition-all duration-200 group ${
                isClickable ? "hover:shadow-md cursor-pointer" : "opacity-70 cursor-not-allowed"
              }`}
              style={{ borderColor: colors.border, backgroundColor: "var(--card-bg)" }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: colors.bg }}
                >
                  <StatusIcon size={20} style={{ color: colors.icon }} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="text-[11px] font-semibold uppercase tracking-[0.5px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: catColor + "15", color: catColor }}
                    >
                      {mod.category}
                    </span>
                    <span
                      className="text-[11px] capitalize font-medium"
                      style={{ color: colors.icon }}
                    >
                      {mod.status.replace("-", " ")}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <h4
                      className="text-[14px] font-semibold mb-1 truncate"
                      style={{ color: "var(--topbar-title)" }}
                    >
                      {mod.title}
                    </h4>
                    {isClickable && (
                      <ArrowRight
                        size={14}
                        className="opacity-0 group-hover:opacity-100 transition-all duration-200 flex-shrink-0 ml-2"
                        style={{ color: "#245C5A" }}
                      />
                    )}
                  </div>
                  <p
                    className="text-[12px] leading-relaxed mb-2 line-clamp-2"
                    style={{ color: "var(--topbar-subtitle)" }}
                  >
                    {mod.description}
                  </p>

                  {mod.status !== "locked" && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: colors.icon,
                          }}
                        />
                      </div>
                      <span className="text-[11px] flex-shrink-0 font-medium" style={{ color: "var(--topbar-subtitle)" }}>
                        {mod.completedSteps}/{mod.stepCount}
                      </span>
                    </div>
                  )}

                  {mod.status === "locked" && (
                    <p className="text-[11px] mt-1" style={{ color: "#94A3B8" }}>
                      Complete previous modules to unlock
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
