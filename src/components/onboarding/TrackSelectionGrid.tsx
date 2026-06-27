import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useOnboarding } from "@/context/OnboardingContext";
import { getProgressPercentage, roleLabels } from "@/data/onboardingData";

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "#FEF3C7", text: "#92400E", label: "Pending" },
  "in-progress": { bg: "#DBEAFE", text: "#1E40AF", label: "In Progress" },
  cleared: { bg: "#D1FAE5", text: "#065F46", label: "Cleared" },
  restricted: { bg: "#FEE2E2", text: "#991B1B", label: "Restricted" },
};

export function TrackSelectionGrid() {
  const navigate = useNavigate();
  const { tracks } = useOnboarding();

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {tracks.map((track) => {
        const pct = getProgressPercentage(track.completedModules, track.moduleCount);
        const status = statusColors[track.clearanceStatus];
        const roleLabel = roleLabels[track.role] || track.role;

        return (
          <div
            key={track.id}
            onClick={() => navigate(`/onboarding/track/${track.id}`)}
            className="rounded-lg border p-5 transition-all duration-200 hover:shadow-lg cursor-pointer group relative overflow-hidden"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
          >
            {/* Hover accent line */}
            <div
              className="absolute top-0 left-0 w-full h-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              style={{ backgroundColor: "#245C5A" }}
            />

            {/* Header */}
            <div className="flex items-start justify-between mb-3">
              <div
                className="text-[11px] font-semibold uppercase tracking-[1px] px-2 py-1 rounded flex items-center gap-1"
                style={{ backgroundColor: status.bg, color: status.text }}
              >
                {track.clearanceStatus === "cleared" && <ShieldCheck size={12} />}
                {status.label}
              </div>
              <ArrowRight
                size={18}
                className="opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:translate-x-1"
                style={{ color: "#245C5A" }}
              />
            </div>

            {/* Title & Description */}
            <h3
              className="text-[16px] font-semibold mb-1.5"
              style={{ color: "var(--topbar-title)" }}
            >
              {track.name}
            </h3>
            <p
              className="text-[13px] leading-relaxed mb-3"
              style={{ color: "var(--topbar-subtitle)" }}
            >
              {track.description}
            </p>

            {/* Role Badge */}
            <div
              className="text-[12px] font-medium px-2.5 py-1 rounded inline-flex items-center mb-4"
              style={{ backgroundColor: "#F1F5F9", color: "#475569" }}
            >
              {roleLabel}
            </div>

            {/* Progress */}
            <div className="mt-auto">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[12px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>
                  Progress
                </span>
                <span className="text-[12px] font-semibold" style={{ color: "#245C5A" }}>
                  {track.completedModules}/{track.moduleCount} modules
                </span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: pct === 100 ? "#059669" : "#245C5A",
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {pct}% complete
                </p>
                {pct === 100 && (
                  <span className="text-[11px] font-medium" style={{ color: "#059669" }}>
                    All modules cleared
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
