import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Database, Search, FileText, CheckCircle, Clock,
  AlertTriangle, Archive,
} from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  active: { bg: "#D1FAE5", color: "#059669" },
  under_review: { bg: "#FEF3C7", color: "#D97706" },
  expired: { bg: "#FEE2E2", color: "#DC2626" },
  superseded: { bg: "#F3F4F6", color: "#6B7280" },
  archived: { bg: "#F3E8FF", color: "#7C3AED" },
};

const CATEGORY_LABELS: Record<string, string> = {
  policy: "Policy",
  procedure: "Procedure",
  training_record: "Training Record",
  audit_report: "Audit Report",
  incident_report: "Incident Report",
  credential: "Credential",
  risk_assessment: "Risk Assessment",
  other: "Other",
};

const AREA_LABELS: Record<string, string> = {
  hipaa_privacy: "HIPAA Privacy",
  hipaa_security: "HIPAA Security",
  cfr42_part2: "42 CFR Part 2",
  state_licensure: "State Licensure",
  staff_credentials: "Staff Credentials",
  incident_reporting: "Incident Reporting",
  medication_management: "Medication Mgmt",
  youth_rights: "Youth Rights",
  other: "Other",
};

export function EvidenceMatrixPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const { data: items, refetch } = trpc.m3.evidenceList.useQuery({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    search: search || undefined,
  });
  const { data: stats } = trpc.m3.evidenceStats.useQuery();
  const updateEvidence = trpc.m3.evidenceUpdate.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate("/qa")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Back to QA Dashboard
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Database size={22} style={{ color: "#0891B2" }} /> Evidence Matrix
          </h1>
        </div>
        <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
          Organized repository of compliance evidence across all regulatory domains
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: stats?.total ?? 0, color: "#6B7280" },
          { label: "Active", value: stats?.active ?? 0, color: "#059669" },
          { label: "Under Review", value: stats?.underReview ?? 0, color: "#D97706" },
          { label: "Expired", value: stats?.expired ?? 0, color: "#DC2626" },
          { label: "Archived", value: stats?.archived ?? 0, color: "#7C3AED" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <div className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 flex-1 min-w-[200px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <Search size={14} style={{ color: "var(--topbar-subtitle)" }} />
          <input
            type="text"
            placeholder="Search evidence..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-[13px] outline-none flex-1"
            style={{ color: "var(--topbar-title)" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="under_review">Under Review</option>
          <option value="expired">Expired</option>
          <option value="superseded">Superseded</option>
          <option value="archived">Archived</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
        >
          <option value="">All Categories</option>
          <option value="policy">Policy</option>
          <option value="procedure">Procedure</option>
          <option value="training_record">Training Record</option>
          <option value="audit_report">Audit Report</option>
          <option value="incident_report">Incident Report</option>
          <option value="credential">Credential</option>
          <option value="risk_assessment">Risk Assessment</option>
        </select>
      </div>

      {/* Evidence Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--card-border)" }}>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>Number</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>Title</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>Category</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>Compliance Area</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>Date</th>
                <th className="text-left text-[11px] font-semibold uppercase tracking-wider px-4 py-3" style={{ color: "var(--topbar-subtitle)" }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {(!items || items.length === 0) && (
                <tr>
                  <td colSpan={7} className="text-center text-[13px] py-8" style={{ color: "var(--topbar-subtitle)" }}>No evidence found</td>
                </tr>
              )}
              {items?.map((item) => {
                const sc = STATUS_COLORS[item.status] ?? { bg: "#F3F4F6", color: "#6B7280" };
                return (
                  <tr key={item.id} className="hover:opacity-80 transition-opacity" style={{ borderBottom: "1px solid var(--card-border)" }}>
                    <td className="px-4 py-3 text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{item.evidenceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{item.title}</p>
                      {item.description && <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{item.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>
                        {AREA_LABELS[item.complianceArea] ?? item.complianceArea}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {new Date(item.evidenceDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                      {item.sourceType}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default EvidenceMatrixPage;
