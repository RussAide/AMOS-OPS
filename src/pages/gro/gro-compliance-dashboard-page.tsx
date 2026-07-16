import { trpc } from "@/providers/trpc";
import {
  Shield, AlertTriangle, CheckCircle, Clock,
  Users, Archive, AlertOctagon,
} from "lucide-react";

export function GROComplianceDashboardPage() {
  const { data: dashboard } = trpc.groCompliance.groComplianceDashboard.useQuery();
  const { data: overdueDoc } = trpc.groCompliance.listRestraintIncidents.useQuery({ overdueDocumentation: true });
  const { data: overdueMedical } = trpc.groCompliance.listRestraintIncidents.useQuery({ overdueMedical: true });
  const { data: expiringRecords } = trpc.groCompliance.listRecordRetention.useQuery({ expiringSoon: true });

  const d = dashboard;

  const summaryCards = [
    { label: "Youth Rights Fully Acked", value: d?.youthRights?.fullyAcknowledged ?? 0, total: d?.youthRights?.total ?? 0, icon: CheckCircle, color: "#059669" },
    { label: "Open Incidents", value: d?.restraintIncidents?.open ?? 0, icon: AlertOctagon, color: "#DC2626" },
    { label: "Overdue Documentation", value: d?.restraintIncidents?.overdueDocumentation ?? 0, icon: Clock, color: "#D97706" },
    { label: "Records Expiring Soon", value: d?.recordRetention?.expiringSoon ?? 0, icon: Archive, color: "#B45309" },
  ];

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
            GRO Compliance Center
          </h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Title 26 TAC Chapter 748 — Minimum Standards Compliance
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {summaryCards.map((c) => (
          <div key={c.label} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <div className="flex items-center gap-2 mb-1">
              <c.icon size={14} style={{ color: c.color }} />
              <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span>
            </div>
            <div className="text-[20px] font-bold" style={{ color: c.color }}>{c.value}</div>
            {c.total !== undefined && (
              <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>of {c.total} total</div>
            )}
          </div>
        ))}
      </div>

      {/* Youth Rights Section */}
      <div className="rounded-lg border mb-4 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Users size={14} style={{ color: "#245C5A" }} /> Youth Rights Acknowledgments
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#245C5A18", color: "#245C5A" }}>
            T-748.3521
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { label: "Fully Acknowledged", value: d?.youthRights?.fullyAcknowledged ?? 0, color: "#059669" },
              { label: "Partial", value: d?.youthRights?.partial ?? 0, color: "#D97706" },
              { label: "Pending", value: d?.youthRights?.pending ?? 0, color: "#DC2626" },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ backgroundColor: `${s.color}08`, border: `1px solid ${s.color}22` }}>
                <div className="text-[18px] font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: s.color }}>{s.label}</div>
              </div>
            ))}
          </div>
          {(d?.youthRights?.pending ?? 0) > 0 && (
            <div className="flex items-center gap-2 text-[11px] px-3 py-2 rounded" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
              <AlertTriangle size={12} /> {d?.youthRights?.pending} youth pending full rights acknowledgment — guardian visit required
            </div>
          )}
        </div>
      </div>

      {/* Restraint Incidents Section */}
      <div className="rounded-lg border mb-4 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Shield size={14} style={{ color: "#DC2626" }} /> Restraint / Seclusion Incidents
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#DC262618", color: "#DC2626" }}>
            T-748.5521
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: "Total", value: d?.restraintIncidents?.total ?? 0 },
              { label: "Open", value: d?.restraintIncidents?.open ?? 0, alert: true },
              { label: "Last 24h", value: d?.restraintIncidents?.last24Hours ?? 0 },
              { label: "Overdue Medical", value: d?.restraintIncidents?.overdueMedical ?? 0, alert: true },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ backgroundColor: s.alert ? "#FEF2F208" : "var(--card-bg)", border: `1px solid ${s.alert ? "#FECACA" : "var(--card-border)"}` }}>
                <div className="text-[18px] font-bold" style={{ color: s.alert ? "#DC2626" : "var(--topbar-title)" }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Deadline requirements */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
            <div className="p-3 rounded border" style={{ backgroundColor: "#FFFBEB10", borderColor: "#FDE68A" }}>
              <div className="flex items-center gap-2 mb-1">
                <Clock size={12} style={{ color: "#B45309" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#B45309" }}>1-Hour Documentation Deadline</span>
              </div>
              <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                Initial incident documentation must be completed within 1 hour. {(overdueDoc ?? []).length} incident(s) currently overdue.
              </p>
            </div>
            <div className="p-3 rounded border" style={{ backgroundColor: "#FEF2F210", borderColor: "#FECACA" }}>
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={12} style={{ color: "#DC2626" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#DC2626" }}>24-Hour Medical Evaluation</span>
              </div>
              <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                Medical evaluation required within 24 hours for any youth injury. {(overdueMedical ?? []).length} evaluation(s) overdue.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Record Retention Section */}
      <div className="rounded-lg border mb-4 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Archive size={14} style={{ color: "#6B7280" }} /> Record Retention
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#6B728018", color: "#6B7280" }}>
            T-748.3057
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {[
              { label: "Total Records", value: d?.recordRetention?.total ?? 0 },
              { label: "Expiring Soon (< 90 days)", value: d?.recordRetention?.expiringSoon ?? 0, alert: (d?.recordRetention?.expiringSoon ?? 0) > 0 },
              { label: "Expired", value: d?.recordRetention?.expired ?? 0, alert: (d?.recordRetention?.expired ?? 0) > 0 },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ backgroundColor: s.alert ? "#FEF2F208" : "var(--card-bg)", border: `1px solid ${s.alert ? "#FECACA" : "var(--card-border)"}` }}>
                <div className="text-[18px] font-bold" style={{ color: s.alert ? "#DC2626" : "var(--topbar-title)" }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{s.label}</div>
              </div>
            ))}
          </div>
          {(expiringRecords ?? []).length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Records Expiring Soon</div>
              {(expiringRecords ?? []).slice(0, 5).map((r) => (
                <div key={r.id} className="flex items-center justify-between text-[11px] px-2 py-1 rounded" style={{ backgroundColor: "#FFFBEB08" }}>
                  <span style={{ color: "var(--topbar-title)" }}>{r.youthName} — {r.recordType.replace(/_/g, " ")}</span>
                  <span style={{ color: "#B45309" }}>Expires {new Date(r.expirationDate).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compliance Status Footer */}
      <div className="flex items-center gap-4 text-[10px] px-4 py-2 rounded-lg" style={{ backgroundColor: "#F0FDF410", border: "1px solid #A7F3D0" }}>
        <CheckCircle size={12} style={{ color: "#059669" }} />
        <span style={{ color: "#059669" }}>GRO Minimum Standards monitoring active</span>
        <span style={{ color: "var(--topbar-subtitle)" }}>Staffing ratios enforced per campus stage configuration</span>
        <span style={{ color: "var(--topbar-subtitle)" }}>1:8 awake · 1:16 overnight</span>
      </div>
    </div>
  );
}

export default GROComplianceDashboardPage;
