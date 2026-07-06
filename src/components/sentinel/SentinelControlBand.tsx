import { TrendingUp, Shield } from "lucide-react";

interface SentinelControlBandProps {
  mode: "snapshot" | "trend";
  onModeChange: (mode: "snapshot" | "trend") => void;
  scope: "facility" | "organization" | "system";
  onScopeChange: (scope: "facility" | "organization" | "system") => void;
}

export function SentinelControlBand({ mode, onModeChange, scope, onScopeChange }: SentinelControlBandProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="flex items-center gap-1 rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <button
          onClick={() => onModeChange("snapshot")}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium transition-all"
          style={{
            backgroundColor: mode === "snapshot" ? "#7C3AED" : "transparent",
            color: mode === "snapshot" ? "#fff" : "var(--topbar-subtitle)",
          }}
        >
          <Shield size={12} /> Snapshot
        </button>
        <button
          onClick={() => onModeChange("trend")}
          className="flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium transition-all"
          style={{
            backgroundColor: mode === "trend" ? "#7C3AED" : "transparent",
            color: mode === "trend" ? "#fff" : "var(--topbar-subtitle)",
          }}
        >
          <TrendingUp size={12} /> Trend
        </button>
      </div>

      <div className="flex items-center gap-1 rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        {(["facility", "organization", "system"] as const).map((s) => (
          <button
            key={s}
            onClick={() => onScopeChange(s)}
            className="px-3 py-1.5 text-[11px] font-medium capitalize transition-all"
            style={{
              backgroundColor: scope === s ? "#245C5A" : "transparent",
              color: scope === s ? "#fff" : "var(--topbar-subtitle)",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
