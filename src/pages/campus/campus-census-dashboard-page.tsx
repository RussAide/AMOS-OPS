import { trpc } from "@/providers/trpc";
import {
  Building2, Users, Bed, AlertTriangle, AlertOctagon,
  TrendingUp, ArrowUpRight,
} from "lucide-react";
import { CAMPUS_STAGES } from "@/constants/organization";

const STAGE_COLORS = [
  { bg: "#FEF2F2", border: "#FECACA", text: "#DC2626", bar: "#EF4444" },
  { bg: "#FFFBEB", border: "#FDE68A", text: "#B45309", bar: "#F59E0B" },
  { bg: "#ECFDF5", border: "#A7F3D0", text: "#059669", bar: "#10B981" },
];

const ALERT_LEVELS = {
  critical: { bg: "#FEF2F2", color: "#DC2626", icon: AlertOctagon, label: "Critical" },
  warning: { bg: "#FFFBEB", color: "#B45309", icon: AlertTriangle, label: "Warning" },
  normal: { bg: "#ECFDF5", color: "#059669", icon: TrendingUp, label: "Normal" },
};

export function CampusCensusDashboardPage() {
  const { data: census } = trpc.m19.getStageCensus.useQuery();
  trpc.m19.listCampusStages.useQuery();
  const { data: alerts } = trpc.m19.listCensusAlerts.useQuery({});

  const summary = census?.summary;
  const stageData = census?.stages ?? [];
  const unacknowledgedAlerts = (alerts ?? []).filter((a) => !a.acknowledgedAt);

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-bold px-1.5 py-[2px] rounded-[2px]"
            style={{ backgroundColor: "#245C5A22", color: "#245C5A", border: "1px solid #245C5A44" }}
          >
            PC
          </span>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
            Campus Census Dashboard
          </h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          CTR-023 campus development capacity and readiness — fictional demonstration reference
        </p>
      </div>

      {/* Overall Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Census", value: summary?.totalCensus ?? 0, icon: Users, color: "#245C5A" },
          { label: "Total Capacity", value: summary?.totalCapacity ?? 0, icon: Building2, color: "#4A7A78" },
          { label: "Vacant Beds", value: summary?.totalVacant ?? 0, icon: Bed, color: "#059669" },
          { label: "Active Alerts", value: summary?.activeAlerts ?? 0, icon: AlertTriangle, color: summary?.activeAlerts ? "#DC2626" : "#059669" },
        ].map((c) => (
          <div key={c.label} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <c.icon size={14} style={{ color: c.color }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span>
            </div>
            <div className="text-[20px] font-bold" style={{ color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Overall Occupancy Bar */}
      <div className="rounded-lg border p-4 mb-6" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>Overall Occupancy</span>
          <span className="text-[14px] font-bold" style={{ color: summary?.overallPercentFull && summary.overallPercentFull > 90 ? "#DC2626" : "#245C5A" }}>
            {summary?.overallPercentFull ?? 0}%
          </span>
        </div>
        <div className="w-full h-3 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
          <div
            className="h-3 rounded-full transition-all"
            style={{
              width: `${Math.min(summary?.overallPercentFull ?? 0, 100)}%`,
              backgroundColor: (summary?.overallPercentFull ?? 0) > 90 ? "#DC2626" : (summary?.overallPercentFull ?? 0) > 75 ? "#F59E0B" : "#10B981",
            }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>0%</span>
          <span className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>75% alert</span>
          <span className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>90% critical</span>
          <span className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>100%</span>
        </div>
      </div>

      {/* Per-Stage Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {stageData.map((stage, idx) => {
          const colors = STAGE_COLORS[Math.min(idx, 2)];
          const alertInfo = ALERT_LEVELS[stage.alertLevel as keyof typeof ALERT_LEVELS] ?? ALERT_LEVELS.normal;
          const AlertIcon = alertInfo.icon;

          return (
            <div key={stage.id} className="rounded-lg border overflow-hidden" style={{ backgroundColor: colors.bg, borderColor: colors.border }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
                <div>
                  <div className="text-[12px] font-bold" style={{ color: colors.text }}>Stage {stage.stageNumber}</div>
                  <div className="text-[10px]" style={{ color: colors.text, opacity: 0.7 }}>{stage.name}</div>
                </div>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ backgroundColor: alertInfo.bg }}>
                  <AlertIcon size={10} style={{ color: alertInfo.color }} />
                  <span className="text-[9px] font-medium" style={{ color: alertInfo.color }}>{alertInfo.label}</span>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-end justify-between mb-3">
                  <div>
                    <div className="text-[28px] font-bold" style={{ color: colors.text }}>{stage.currentCensus}</div>
                    <div className="text-[10px]" style={{ color: colors.text, opacity: 0.7 }}>of {stage.operationalCapacity} operational / {stage.licensedCapacity} licensed</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[18px] font-bold" style={{ color: stage.percentFull > 90 ? "#DC2626" : colors.text }}>{stage.percentFull}%</div>
                    <div className="text-[9px]" style={{ color: colors.text, opacity: 0.7 }}>{stage.vacantBeds} vacant</div>
                  </div>
                </div>

                {/* Capacity bar */}
                <div className="w-full h-2 rounded-full mb-3" style={{ backgroundColor: "#E5E7EB" }}>
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${Math.min(stage.percentFull, 100)}%`, backgroundColor: stage.percentFull > 90 ? "#DC2626" : colors.bar }}
                  />
                </div>

                {/* Staffing ratios */}
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div className="text-center p-1.5 rounded" style={{ backgroundColor: "#FFFFFF44" }}>
                    <div className="text-[10px]" style={{ color: colors.text, opacity: 0.7 }}>Awake Ratio</div>
                    <div className="text-[12px] font-bold" style={{ color: colors.text }}>{stage.awakeStaffRatio}</div>
                  </div>
                  <div className="text-center p-1.5 rounded" style={{ backgroundColor: "#FFFFFF44" }}>
                    <div className="text-[10px]" style={{ color: colors.text, opacity: 0.7 }}>Overnight Ratio</div>
                    <div className="text-[12px] font-bold" style={{ color: colors.text }}>{stage.overnightStaffRatio}</div>
                  </div>
                </div>

                <div className="text-[9px] px-2 py-1 rounded" style={{ backgroundColor: "#FFFFFF66", color: colors.text }}>
                  Prototype readiness: {stage.status.replace(/_/g, " ")}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Alerts */}
      {unacknowledgedAlerts.length > 0 && (
        <div className="rounded-lg border overflow-hidden mb-6" style={{ backgroundColor: "#FEF2F2", borderColor: "#FECACA" }}>
          <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: "#FECACA" }}>
            <AlertOctagon size={14} style={{ color: "#DC2626" }} />
            <span className="text-[13px] font-semibold" style={{ color: "#DC2626" }}>Unacknowledged Census Alerts</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full ml-auto" style={{ backgroundColor: "#DC262618", color: "#DC2626" }}>
              {unacknowledgedAlerts.length}
            </span>
          </div>
          <div className="divide-y" style={{ borderColor: "#FECACA" }}>
            {unacknowledgedAlerts.map((alert) => (
              <div key={alert.id} className="px-4 py-2 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-medium" style={{ color: "#991B1B" }}>{alert.alertType.replace(/_/g, " ").toUpperCase()}</div>
                  <div className="text-[10px]" style={{ color: "#B91C1C" }}>{alert.message}</div>
                </div>
                <span className="text-[9px]" style={{ color: "#991B1B" }}>
                  {alert.triggeredAt ? new Date(alert.triggeredAt).toLocaleTimeString() : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Canonical campus development pathway */}
      <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
          <ArrowUpRight size={14} style={{ color: "#245C5A" }} /> Three-Stage Campus Development Pathway
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CAMPUS_STAGES.map((stage) => (
            <div key={stage.id} className="p-3 rounded border" style={{ borderColor: `${stage.color}33`, backgroundColor: `${stage.color}06` }}>
              <div className="text-[11px] font-semibold" style={{ color: stage.color }}>{stage.name}</div>
              <div className="text-[10px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{stage.controlledCapacity}</div>
              <div className="text-[9px] mt-1 capitalize" style={{ color: stage.color }}>
                Prototype readiness: {stage.readinessStatus.replace(/-/g, " ")}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default CampusCensusDashboardPage;
