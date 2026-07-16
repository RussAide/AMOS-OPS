import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, ClipboardCheck, Search, AlertTriangle,
} from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  planned: { bg: "#FEF3C7", color: "#D97706" },
  in_progress: { bg: "#DBEAFE", color: "#2563EB" },
  pending_review: { bg: "#F3E8FF", color: "#7C3AED" },
  completed: { bg: "#D1FAE5", color: "#059669" },
  closed: { bg: "#D1FAE5", color: "#059669" },
};

const TYPE_LABELS: Record<string, string> = {
  internal: "Internal",
  external: "External",
  regulatory: "Regulatory",
  peer_review: "Peer Review",
  random: "Random",
};

interface AuditFinding {
  finding: string;
  status: string;
}

function parseAuditFindings(value: string): AuditFinding[] | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const findings: AuditFinding[] = [];
    for (const item of parsed) {
      if (
        typeof item === "object" &&
        item !== null &&
        "finding" in item &&
        typeof item.finding === "string" &&
        "status" in item &&
        typeof item.status === "string"
      ) {
        findings.push({ finding: item.finding, status: item.status });
      }
    }
    return findings;
  } catch {
    return null;
  }
}

export function AuditBinderPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "planned" | "in_progress" | "pending_review" | "completed" | "closed">("");
  const [typeFilter, setTypeFilter] = useState<"" | "internal" | "external" | "regulatory" | "peer_review" | "random">("");
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);

  const { data: audits, refetch } = trpc.m3.auditBinderList.useQuery({
    status: statusFilter || undefined,
    type: typeFilter || undefined,
    search: search || undefined,
  });
  const { data: stats } = trpc.m3.auditBinderStats.useQuery();
  const updateAudit = trpc.m3.auditBinderUpdate.useMutation({ onSuccess: () => refetch() });

  const handleStartAudit = (id: string) => {
    updateAudit.mutate({ id, status: "in_progress" });
  };

  const handleCompleteAudit = (id: string) => {
    updateAudit.mutate({ id, status: "completed" });
  };

  return (
    <div className="px-4 md:px-6 pt-4">
      {/* Header */}
      <div className="mb-6">
        <button onClick={() => navigate("/qa")} className="flex items-center gap-1 text-[12px] mb-2 hover:underline" style={{ color: "#245C5A" }}>
          <ArrowLeft size={14} /> Back to QA Dashboard
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <ClipboardCheck size={22} style={{ color: "#D97706" }} /> Audit Binder
          </h1>
        </div>
        <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
          Centralized audit repository — create, track, and manage all internal and external audits
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: stats?.total ?? 0, color: "#6B7280" },
          { label: "Planned", value: stats?.planned ?? 0, color: "#D97706" },
          { label: "In Progress", value: stats?.inProgress ?? 0, color: "#2563EB" },
          { label: "Completed", value: stats?.completed ?? 0, color: "#059669" },
          { label: "Avg Score", value: `${stats?.avgScore ?? 0}%`, color: stats && stats.avgScore >= 90 ? "#059669" : "#D97706" },
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
            placeholder="Search audits..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-[13px] outline-none flex-1"
            style={{ color: "var(--topbar-title)" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
        >
          <option value="">All Statuses</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="pending_review">Pending Review</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
        >
          <option value="">All Types</option>
          <option value="internal">Internal</option>
          <option value="external">External</option>
          <option value="regulatory">Regulatory</option>
          <option value="peer_review">Peer Review</option>
          <option value="random">Random</option>
        </select>
      </div>

      {/* Audit List */}
      <div className="space-y-3">
        {(!audits || audits.length === 0) && (
          <p className="text-[13px] py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No audits found</p>
        )}
        {audits?.map((audit) => {
          const sc = STATUS_COLORS[audit.status] ?? { bg: "#F3F4F6", color: "#6B7280" };
          const isExpanded = expandedAudit === audit.id;
          return (
            <div key={audit.id} className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedAudit(isExpanded ? null : audit.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{audit.auditNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {audit.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px]" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                      {TYPE_LABELS[audit.auditType] ?? audit.auditType}
                    </span>
                  </div>
                  {audit.score !== null && audit.score !== undefined && (
                    <span className="text-[16px] font-bold" style={{ color: audit.score >= 95 ? "#059669" : audit.score >= 85 ? "#D97706" : "#DC2626" }}>
                      {audit.score}%
                    </span>
                  )}
                </div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{audit.title}</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{audit.scope}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Dept: {audit.department ?? "N/A"}</span>
                  {audit.dueDate && (
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Due: {new Date(audit.dueDate).toLocaleDateString()}</span>
                  )}
                  {audit.assignedAuditorId && (
                    <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Auditor: {audit.assignedAuditorId}</span>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--card-border)" }}>
                  <div className="pt-3">
                    {/* Findings */}
                    {audit.findingsJson && audit.findingsJson !== "[]" && (
                      <div className="mb-3">
                        <h4 className="text-[12px] font-semibold mb-2" style={{ color: "var(--topbar-title)" }}>Findings</h4>
                        <div className="space-y-1">
                          {(() => {
                            const findings = parseAuditFindings(audit.findingsJson);
                            if (findings) {
                              return findings.map((f, i) => (
                                <div key={i} className="flex items-center gap-2 text-[12px] px-2 py-1 rounded" style={{ backgroundColor: "#FEF3C720" }}>
                                  <AlertTriangle size={12} style={{ color: "#D97706" }} />
                                  <span style={{ color: "var(--topbar-title)" }}>{f.finding}</span>
                                  <span className="px-1.5 py-0.5 rounded text-[10px]" style={{ backgroundColor: f.status === "resolved" ? "#D1FAE5" : "#FEE2E2", color: f.status === "resolved" ? "#059669" : "#DC2626" }}>
                                    {f.status}
                                  </span>
                                </div>
                              ));
                            }
                            return <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Invalid findings data</span>;
                          })()}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 mt-2">
                      {audit.status === "planned" && (
                        <button onClick={() => handleStartAudit(audit.id)} className="px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: "#DBEAFE", color: "#2563EB" }}>
                          Start Audit
                        </button>
                      )}
                      {audit.status === "in_progress" && (
                        <button onClick={() => handleCompleteAudit(audit.id)} className="px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AuditBinderPage;
