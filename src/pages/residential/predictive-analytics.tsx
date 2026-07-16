import { trpc } from "@/providers/trpc";
import { TrendingUp, AlertTriangle, Calendar, Zap } from "lucide-react";

export function PredictiveAnalytics() {
  const { data: trends } = trpc.m20.getAdmissionTrends.useQuery();
  const { data: forecast } = trpc.m20.getDischargeForecast.useQuery();
  const { data: capacityAlert } = trpc.m20.getCapacityAlert.useQuery();
  const { data: projection } = trpc.m20.get30DayProjection.useQuery();
  const { data: phaseRec } = trpc.m20.getPhaseRecommendation.useQuery();

  // Max for chart scaling
  const maxAdm = trends ? Math.max(...trends.admissions, ...trends.discharges) + 1 : 5;

  return (
    <div className="space-y-6">
      {/* ─── Phase Activation Recommendation ─────────── */}
      {phaseRec && (
        <div
          className="rounded-lg border p-4"
          style={{
            backgroundColor: phaseRec.confidence === "high" ? "#fef2f2" : phaseRec.confidence === "medium" ? "#fffbeb" : "#f0fdf4",
            borderColor: phaseRec.confidence === "high" ? "#fca5a5" : phaseRec.confidence === "medium" ? "#fcd34d" : "#86efac",
          }}
        >
          <div className="flex items-start gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                backgroundColor: phaseRec.confidence === "high" ? "#dc2626" : phaseRec.confidence === "medium" ? "#d97706" : "#059669",
              }}
            >
              <Zap size={18} style={{ color: "#fff" }} />
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                {phaseRec.recommendation}
              </div>
              <div className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
                {phaseRec.reason}
              </div>
              <div className="flex flex-wrap gap-3 mt-2">
                <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "rgba(0,0,0,0.05)" }}>
                  Phase: <strong>{phaseRec.phaseName}</strong>
                </span>
                <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "rgba(0,0,0,0.05)" }}>
                  Beds Added: <strong>+{phaseRec.bedsAdded}</strong>
                </span>
                <span className="text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "rgba(0,0,0,0.05)" }}>
                  Est. Timeline: <strong>{phaseRec.weeksUntilActivation === 0 ? "Immediate" : `${phaseRec.weeksUntilActivation} weeks`}</strong>
                </span>
                <span
                  className="text-[11px] px-2 py-1 rounded-full font-medium"
                  style={{
                    backgroundColor: phaseRec.confidence === "high" ? "#fee2e2" : phaseRec.confidence === "medium" ? "#fef3c7" : "#d1fae5",
                    color: phaseRec.confidence === "high" ? "#dc2626" : phaseRec.confidence === "medium" ? "#d97706" : "#059669",
                  }}
                >
                  {phaseRec.confidence} confidence
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Capacity Alerts ─────────────────────────── */}
      {capacityAlert && (
        <div>
          <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <AlertTriangle size={16} style={{ color: "#D97706" }} />
            Capacity Alerts
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Campus-wide */}
            <div
              className="rounded-lg border p-3"
              style={{
                backgroundColor: capacityAlert.campusLevel === "critical" ? "#fef2f2" : capacityAlert.campusLevel === "warning" ? "#fffbeb" : "#f0fdf4",
                borderColor: capacityAlert.campusLevel === "critical" ? "#fca5a5" : capacityAlert.campusLevel === "warning" ? "#fcd34d" : "#bbf7d0",
              }}
            >
              <div className="text-[11px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Campus-Wide</div>
              <div className="text-[18px] font-bold" style={{ color: capacityAlert.campusLevel === "critical" ? "#dc2626" : capacityAlert.campusLevel === "warning" ? "#d97706" : "#059669" }}>
                {capacityAlert.campusRate}%
              </div>
              <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                {capacityAlert.campusOccupied} of {capacityAlert.campusOperational} beds occupied
              </div>
            </div>
            {/* Per facility */}
            {capacityAlert.facilityAlerts?.map(alert => (
              <div
                key={alert.facilityId}
                className="rounded-lg border p-3"
                style={{
                  backgroundColor: alert.level === "critical" ? "#fef2f2" : alert.level === "warning" ? "#fffbeb" : "#f8fafc",
                  borderColor: alert.level === "critical" ? "#fca5a5" : alert.level === "warning" ? "#fcd34d" : "#e2e8f0",
                }}
              >
                <div className="text-[11px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>{alert.facilityName}</div>
                <div className="text-[18px] font-bold" style={{ color: alert.level === "critical" ? "#dc2626" : alert.level === "warning" ? "#d97706" : "#059669" }}>
                  {alert.rate}%
                </div>
                <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {alert.message}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Admission/Discharge Trends ──────────────── */}
      {trends && (
        <div>
          <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <TrendingUp size={16} style={{ color: "#2563EB" }} />
            12-Week Admission & Discharge Trends
          </h3>
          <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            {/* Chart */}
            <div className="flex items-end gap-1 h-[160px] mb-3">
              {trends.weeks.map((week, i) => {
                const admHeight = (trends.admissions[i] / maxAdm) * 100;
                const disHeight = (trends.discharges[i] / maxAdm) * 100;
                return (
                  <div key={week} className="flex-1 flex flex-col justify-end gap-0.5">
                    <div className="flex gap-0.5 items-end justify-center" style={{ height: `${Math.max(admHeight, disHeight)}%` }}>
                      <div
                        className="w-full rounded-t"
                        style={{ height: `${admHeight}%`, backgroundColor: "#059669", minHeight: 4 }}
                        title={`Week ${week}: ${trends.admissions[i]} admissions`}
                      />
                      <div
                        className="w-full rounded-t"
                        style={{ height: `${disHeight}%`, backgroundColor: "#dc2626", minHeight: 4 }}
                        title={`Week ${week}: ${trends.discharges[i]} discharges`}
                      />
                    </div>
                    <div className="text-[8px] text-center" style={{ color: "var(--topbar-subtitle)" }}>{week}</div>
                  </div>
                );
              })}
            </div>
            {/* Legend */}
            <div className="flex gap-4 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#059669" }} />
                <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Admissions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#dc2626" }} />
                <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Discharges</span>
              </div>
            </div>
            {/* Summary stats */}
            <div className="flex gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--card-border)" }}>
              <div className="text-center flex-1">
                <div className="text-[16px] font-bold" style={{ color: "#059669" }}>
                  {trends.admissions.reduce((a, b) => a + b, 0)}
                </div>
                <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Total Admissions (12 wks)</div>
              </div>
              <div className="text-center flex-1">
                <div className="text-[16px] font-bold" style={{ color: "#dc2626" }}>
                  {trends.discharges.reduce((a, b) => a + b, 0)}
                </div>
                <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Total Discharges (12 wks)</div>
              </div>
              <div className="text-center flex-1">
                <div className="text-[16px] font-bold" style={{ color: "#2563EB" }}>
                  {(trends.admissions.reduce((a, b) => a + b, 0) / 12).toFixed(1)}
                </div>
                <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Avg Admissions/Week</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Discharge Forecast ──────────────────────── */}
      {forecast && (
        <div>
          <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Calendar size={16} style={{ color: "#7C3AED" }} />
            Discharge Forecast
            <span className="text-[11px] font-normal" style={{ color: "var(--topbar-subtitle)" }}>
              (Avg LOS: {forecast.averageLOS} days)
            </span>
          </h3>
          {forecast.forecasts.length > 0 ? (
            <div className="space-y-2">
              {forecast.forecasts.map(f => (
                <div
                  key={f.mrn}
                  className="flex items-center gap-3 p-2.5 rounded-lg border"
                  style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                    style={{
                      backgroundColor: (f.daysRemaining ?? 999) <= 7 ? "#fef2f2" : (f.daysRemaining ?? 999) <= 14 ? "#fffbeb" : "#f0fdf4",
                      color: (f.daysRemaining ?? 999) <= 7 ? "#dc2626" : (f.daysRemaining ?? 999) <= 14 ? "#d97706" : "#059669",
                    }}
                  >
                    {f.daysRemaining ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>
                      {f.youthName}
                    </div>
                    <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {f.mrn} • {f.bedLabel}
                    </div>
                  </div>
                  <div className="text-[10px] flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>
                    Est: {f.expectedDischarge ? new Date(f.expectedDischarge).toLocaleDateString() : "TBD"}
                  </div>
                  {(f.daysRemaining ?? 999) <= 7 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#fee2e2", color: "#dc2626" }}>
                      Soon
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <Calendar size={24} style={{ color: "#cbd5e1" }} className="mx-auto mb-2" />
              <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                No discharge dates set. Set expected discharge dates on youth profiles to see forecasts.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ─── 30-Day Bed Availability Projection ──────── */}
      {projection && (
        <div>
          <h3 className="text-[14px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <TrendingUp size={16} style={{ color: "#0891B2" }} />
            30-Day Bed Availability Projection
          </h3>
          <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="flex items-end gap-[2px] h-[100px] mb-2">
              {projection.availability.map((avail, i) => {
                const height = (avail / projection.operationalCapacity) * 100;
                const isLow = avail <= 3;
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t"
                    style={{
                      height: `${Math.max(height, 5)}%`,
                      backgroundColor: isLow ? "#dc2626" : "#059669",
                      opacity: i % 7 === 0 ? 1 : 0.7,
                    }}
                    title={`${projection.days[i]}: ${avail} beds available`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between text-[8px]" style={{ color: "var(--topbar-subtitle)" }}>
              <span>Today</span>
              <span>Week 2</span>
              <span>Week 3</span>
              <span>Week 4</span>
            </div>
            <div className="flex gap-4 mt-3 pt-3 border-t" style={{ borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#059669" }} />
                <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Adequate ({projection.operationalCapacity}+ beds)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: "#dc2626" }} />
                <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Low availability (≤3 beds)</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PredictiveAnalytics;
