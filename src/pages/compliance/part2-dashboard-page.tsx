import { trpc } from "@/providers/trpc";
import {
  Lock, FileKey, ShieldAlert, Eye, Users, CheckCircle,
  XCircle, AlertTriangle, HelpCircle, Clock, Building2,
  FileText, AlertOctagon, ChevronRight, Ban,
} from "lucide-react";

const STATUS_CONFIG = {
  on_target: { icon: CheckCircle, color: "#059669", bg: "#ECFDF5", label: "On Target" },
  at_risk: { icon: AlertTriangle, color: "#B45309", bg: "#FFFBEB", label: "At Risk" },
  off_target: { icon: XCircle, color: "#DC2626", bg: "#FEF2F2", label: "Off Target" },
  not_measured: { icon: HelpCircle, color: "#6B7280", bg: "#F3F4F6", label: "Not Measured" },
};

const CONSENT_STATUS = {
  active: { color: "#059669", bg: "#ECFDF5", label: "Active" },
  expired: { color: "#6B7280", bg: "#F3F4F6", label: "Expired" },
  revoked: { color: "#DC2626", bg: "#FEF2F2", label: "Revoked" },
  pending: { color: "#B45309", bg: "#FFFBEB", label: "Pending" },
  superseded: { color: "#6B7280", bg: "#F3F4F6", label: "Superseded" },
};

const QSOA_STATUS = {
  active: { color: "#059669", label: "Active" },
  draft: { color: "#B45309", label: "Draft" },
  expiring_soon: { color: "#DC2626", label: "Expiring" },
  expired: { color: "#6B7280", label: "Expired" },
  terminated: { color: "#DC2626", label: "Terminated" },
};

export function Part2DashboardPage() {
  const { data: dashboard } = trpc.part2.part2Dashboard.useQuery();
  const { data: sudRecords } = trpc.part2.listSudRecords.useQuery({});
  const { data: consents } = trpc.part2.listConsents.useQuery({});
  const { data: qsoaList } = trpc.part2.listQsoaAgreements.useQuery({});
  const { data: auditLog } = trpc.part2.listAuditLog.useQuery({});
  const { data: breaches } = trpc.part2.listBreachNotifications.useQuery({});

  const d = dashboard;

  // Summary cards
  const summaryCards = [
    { label: "Part 2 Protected Records", value: d?.sudRecords?.part2Protected ?? 0, icon: Lock, color: "#DC2626" },
    { label: "Active Consents", value: d?.consents?.active ?? 0, icon: FileKey, color: "#059669" },
    { label: "Active QSOAs", value: d?.qsoa?.active ?? 0, icon: Building2, color: "#0891B2" },
    { label: "Open Breaches", value: d?.breaches?.open ?? 0, icon: AlertOctagon, color: "#DC2626" },
  ];

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-bold px-1.5 py-[2px] rounded-[2px]"
            style={{ backgroundColor: "#991B1B22", color: "#991B1B", border: "1px solid #991B1B44" }}
          >
            CO
          </span>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
            42 CFR Part 2 SUD Protection
          </h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Substance Use Disorder confidentiality compliance — consent management, QSOA, audit, breach
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
          </div>
        ))}
      </div>

      {/* SUD Records */}
      <div className="rounded-lg border mb-4 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Lock size={14} style={{ color: "#DC2626" }} /> SUD Records
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#DC262618", color: "#DC2626" }}>
            42 CFR § 2.13
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: "Total Records", value: d?.sudRecords?.total ?? 0 },
              { label: "Active", value: d?.sudRecords?.active ?? 0, color: "#DC2626" },
              { label: "Part 2 Protected", value: d?.sudRecords?.part2Protected ?? 0, color: "#DC2626" },
              { label: "Associated Consents", value: d?.consents?.total ?? 0 },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ backgroundColor: "var(--card-bg)", border: `1px solid var(--card-border)` }}>
                <div className="text-[18px] font-bold" style={{ color: s.color ?? "var(--topbar-title)" }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* SUD Records Table */}
          {(sudRecords ?? []).length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Protected Records</div>
              {(sudRecords ?? []).map((record) => (
                <div key={record.id} className="flex items-center justify-between py-2 px-3 rounded border" style={{ backgroundColor: "#FEF2F208", borderColor: "#FECACA44" }}>
                  <div className="flex items-center gap-2">
                    <Lock size={11} style={{ color: "#DC2626" }} />
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{record.youthName}</div>
                      <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{record.substanceType} · {record.diagnosisCode} · {record.severity}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: record.isPart2Protected ? "#FEF2F2" : "#ECFDF5", color: record.isPart2Protected ? "#DC2626" : "#059669" }}>
                      {record.isPart2Protected ? "Part 2" : "Unrestricted"}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                      {record.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consent Management */}
      <div className="rounded-lg border mb-4 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <FileKey size={14} style={{ color: "#059669" }} /> Consent Management
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#05966918", color: "#059669" }}>
            42 CFR § 2.31
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: "Active", value: d?.consents?.active ?? 0, color: "#059669" },
              { label: "Expired", value: d?.consents?.expired ?? 0, color: "#6B7280" },
              { label: "Revoked", value: d?.consents?.revoked ?? 0, color: "#DC2626" },
              { label: "Total", value: d?.consents?.total ?? 0 },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ backgroundColor: s.color ? `${s.color}08` : "var(--card-bg)", border: `1px solid ${s.color ? `${s.color}22` : "var(--card-border)"}` }}>
                <div className="text-[18px] font-bold" style={{ color: s.color ?? "var(--topbar-title)" }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: s.color ?? "var(--topbar-subtitle)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Active Consents List */}
          {(consents ?? []).filter((c) => c.status === "active").length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Active Consents</div>
              {(consents ?? []).filter((c) => c.status === "active").map((c) => {
                const cs = CONSENT_STATUS[c.status as keyof typeof CONSENT_STATUS] ?? CONSENT_STATUS.pending;
                return (
                  <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded border" style={{ backgroundColor: "#ECFDF508", borderColor: "#A7F3D044" }}>
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{c.recipientName} {c.recipientOrganization && `(${c.recipientOrganization})`}</div>
                      <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>
                        {c.youthName} · {c.purpose} · {c.informationScope}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: cs.bg, color: cs.color }}>{cs.label}</span>
                      {c.expirationDate && (
                        <span className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Exp: {new Date(c.expirationDate).toLocaleDateString()}</span>
                      )}
                      {c.isQsoa && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#0891B218", color: "#0891B2" }}>QSOA</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* QSOA Agreements */}
      <div className="rounded-lg border mb-4 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Building2 size={14} style={{ color: "#0891B2" }} /> QSOA Agreements
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#0891B218", color: "#0891B2" }}>
            42 CFR § 2.12
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: "Active", value: d?.qsoa?.active ?? 0, color: "#059669" },
              { label: "Expiring Soon", value: d?.qsoa?.expiringSoon ?? 0, color: "#DC2626" },
              { label: "Needing Training", value: d?.qsoa?.needingStaffTraining ?? 0, color: "#B45309" },
              { label: "Total", value: (qsoaList ?? []).length },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ backgroundColor: s.color ? `${s.color}08` : "var(--card-bg)", border: `1px solid ${s.color ? `${s.color}22` : "var(--card-border)"}` }}>
                <div className="text-[18px] font-bold" style={{ color: s.color ?? "var(--topbar-title)" }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: s.color ?? "var(--topbar-subtitle)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* QSOA List */}
          {(qsoaList ?? []).length > 0 && (
            <div className="mt-3 space-y-2">
              {(qsoaList ?? []).map((q) => {
                const qs = QSOA_STATUS[q.status as keyof typeof QSOA_STATUS] ?? QSOA_STATUS.draft;
                return (
                  <div key={q.id} className="flex items-center justify-between py-2 px-3 rounded border" style={{ borderColor: "var(--card-border)" }}>
                    <div>
                      <div className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{q.organizationName}</div>
                      <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{q.servicesProvided} · {q.dataAccessScope} access</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ color: qs.color }}>{qs.label}</span>
                      {!q.staffTrained && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>Training needed</span>}
                      {q.baaExecuted && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>BAA</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Access Audit Log */}
      <div className="rounded-lg border mb-4 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Eye size={14} style={{ color: "#7C3AED" }} /> Access Audit Log
          </h3>
          <div className="flex items-center gap-2">
            {d?.audit?.unauthorizedFlags ? (
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                {d.audit.unauthorizedFlags} unauthorized
              </span>
            ) : (
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                No unauthorized access
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#7C3AED18", color: "#7C3AED" }}>
              42 CFR § 2.13(c)
            </span>
          </div>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {[
              { label: "Total Access Events", value: d?.audit?.totalAccessEvents ?? 0 },
              { label: "Disclosures This Month", value: d?.audit?.disclosuresThisMonth ?? 0, color: "#0891B2" },
              { label: "Unauthorized Flags", value: d?.audit?.unauthorizedFlags ?? 0, color: d?.audit?.unauthorizedFlags ? "#DC2626" : "#059669" },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ backgroundColor: s.color ? `${s.color}08` : "var(--card-bg)", border: `1px solid ${s.color ? `${s.color}22` : "var(--card-border)"}` }}>
                <div className="text-[18px] font-bold" style={{ color: s.color ?? "var(--topbar-title)" }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: s.color ?? "var(--topbar-subtitle)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Recent audit entries */}
          {(auditLog ?? []).length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] font-medium mb-2" style={{ color: "var(--topbar-subtitle)" }}>Recent Access Events</div>
              <div className="space-y-1">
                {(auditLog ?? []).slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-1.5 px-2 rounded text-[10px]" style={{ backgroundColor: entry.unauthorizedFlag ? "#FEF2F210" : "var(--card-bg)", border: `1px solid ${entry.unauthorizedFlag ? "#FECACA" : "var(--card-border)"}` }}>
                    <div className="flex items-center gap-2">
                      {entry.unauthorizedFlag ? <Ban size={10} style={{ color: "#DC2626" }} /> : <Eye size={10} style={{ color: "#7C3AED" }} />}
                      <span style={{ color: "var(--topbar-title)" }}>{entry.accessType}</span>
                      <span style={{ color: "var(--topbar-subtitle)" }}>by {entry.accessedBy}</span>
                      <span style={{ color: "var(--topbar-subtitle)" }}>· {entry.accessContext}</span>
                    </div>
                    <span style={{ color: entry.unauthorizedFlag ? "#DC2626" : "var(--topbar-subtitle)" }}>
                      {new Date(entry.accessTimestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Breach Notifications */}
      <div className="rounded-lg border mb-4 overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--card-border)" }}>
          <h3 className="text-[13px] font-semibold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <AlertOctagon size={14} style={{ color: "#DC2626" }} /> Breach Notifications
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ backgroundColor: "#DC262618", color: "#DC2626" }}>
            42 CFR § 2.13(c)(8)
          </span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            {[
              { label: "Total Breaches", value: d?.breaches?.total ?? 0 },
              { label: "Open", value: d?.breaches?.open ?? 0, color: "#DC2626" },
              { label: "Status", value: (d?.breaches?.open ?? 0) === 0 ? "Clean" : "Action needed", color: (d?.breaches?.open ?? 0) === 0 ? "#059669" : "#DC2626" },
            ].map((s) => (
              <div key={s.label} className="text-center p-2 rounded" style={{ backgroundColor: s.color ? `${s.color}08` : "var(--card-bg)", border: `1px solid ${s.color ? `${s.color}22` : "var(--card-border)"}` }}>
                <div className="text-[18px] font-bold" style={{ color: s.color ?? "var(--topbar-title)" }}>{s.value}</div>
                <div className="text-[10px]" style={{ color: s.color ?? "var(--topbar-subtitle)" }}>{s.label}</div>
              </div>
            ))}
          </div>

          {(breaches ?? []).length > 0 && (
            <div className="mt-3 space-y-2">
              {(breaches ?? []).map((b) => (
                <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded border" style={{ backgroundColor: "#FEF2F208", borderColor: "#FECACA44" }}>
                  <div>
                    <div className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{b.breachNumber} · {b.breachType.replace(/_/g, " ")}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{b.affectedYouthCount} youth · {b.affectedRecordCount} records · Discovered {new Date(b.discoveredDate).toLocaleDateString()}</div>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: b.status === "closed" ? "#ECFDF5" : "#FEF2F2", color: b.status === "closed" ? "#059669" : "#DC2626" }}>
                    {b.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Compliance Footer */}
      <div className="flex items-center gap-4 text-[10px] px-4 py-2 rounded-lg" style={{ backgroundColor: "#FEF2F210", border: "1px solid #FECACA" }}>
        <Lock size={12} style={{ color: "#DC2626" }} />
        <span style={{ color: "#DC2626", fontWeight: 600 }}>42 CFR Part 2 compliance monitoring active</span>
        <span style={{ color: "var(--topbar-subtitle)" }}>All SUD information is federally protected</span>
        <span style={{ color: "var(--topbar-subtitle)" }}>Consent required for any disclosure</span>
        <span style={{ color: "var(--topbar-subtitle)" }}>Audit trail: {d?.audit?.totalAccessEvents ?? 0} events logged</span>
      </div>
    </div>
  );
}

export default Part2DashboardPage;
