import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, AlertOctagon, Search,
} from "lucide-react";

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  open: { bg: "#FEE2E2", color: "#DC2626" },
  poc_pending: { bg: "#FEF3C7", color: "#D97706" },
  poc_approved: { bg: "#DBEAFE", color: "#2563EB" },
  in_progress: { bg: "#FEF3C7", color: "#D97706" },
  corrected: { bg: "#D1FAE5", color: "#059669" },
  verified: { bg: "#ECFDF5", color: "#059669" },
  closed: { bg: "#D1FAE5", color: "#059669" },
};

const SEVERITY_COLORS: Record<string, { bg: string; color: string }> = {
  citation: { bg: "#7F1D1D", color: "#FFFFFF" },
  standard: { bg: "#FEE2E2", color: "#DC2626" },
  element: { bg: "#FEF3C7", color: "#D97706" },
  risk_only: { bg: "#DBEAFE", color: "#2563EB" },
  other: { bg: "#F3F4F6", color: "#6B7280" },
};

const CATEGORY_LABELS: Record<string, string> = {
  clinical_documentation: "Clinical Doc",
  safety: "Safety",
  staffing: "Staffing",
  training: "Training",
  facilities: "Facilities",
  medication: "Medication",
  resident_rights: "Resident Rights",
  infection_control: "Infection Ctrl",
  administrative: "Administrative",
  other: "Other",
};

export function DeficiencyTrackingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "closed" | "open" | "verified" | "in_progress" | "poc_pending" | "poc_approved" | "corrected">("");
  const [categoryFilter, setCategoryFilter] = useState<"" | "training" | "other" | "facilities" | "administrative" | "safety" | "medication" | "clinical_documentation" | "staffing" | "resident_rights" | "infection_control">("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: deficiencies, refetch } = trpc.m3.deficiencyList.useQuery({
    status: statusFilter || undefined,
    category: categoryFilter || undefined,
    search: search || undefined,
  });
  const { data: stats } = trpc.m3.deficiencyStats.useQuery();
  const updateDef = trpc.m3.deficiencyUpdate.useMutation({ onSuccess: () => refetch() });

  const [pocText, setPocText] = useState("");

  const handleStatusAdvance = (id: string, currentStatus: string) => {
    const flow: Record<string, string> = {
      open: "poc_pending",
      poc_pending: "poc_approved",
      poc_approved: "in_progress",
      in_progress: "corrected",
      corrected: "verified",
    };
    const next = flow[currentStatus];
    if (next) {
      const update: Parameters<typeof updateDef.mutate>[0] = {
        id,
        status: next as Parameters<typeof updateDef.mutate>[0]["status"],
      };
      if (next === "poc_pending" && pocText) {
        update.pocDescription = pocText;
      }
      if (next === "corrected") {
        update.correctionCompletedDate = new Date().toISOString();
      }
      updateDef.mutate(update);
      setPocText("");
    }
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
            <AlertOctagon size={22} style={{ color: "#DC2626" }} /> Deficiency Tracking
          </h1>
        </div>
        <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
          Track survey deficiencies from identification through Plan of Correction to verification
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {[
          { label: "Total", value: stats?.total ?? 0, color: "#6B7280" },
          { label: "Open", value: stats?.open ?? 0, color: "#DC2626" },
          { label: "In Progress", value: stats?.inProgress ?? 0, color: "#D97706" },
          { label: "Corrected", value: stats?.corrected ?? 0, color: "#2563EB" },
          { label: "Verified", value: stats?.verified ?? 0, color: "#059669" },
          { label: "Overdue", value: stats?.overdue ?? 0, color: "#DB2777" },
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
            placeholder="Search deficiencies..."
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
          <option value="open">Open</option>
          <option value="poc_pending">POC Pending</option>
          <option value="poc_approved">POC Approved</option>
          <option value="in_progress">In Progress</option>
          <option value="corrected">Corrected</option>
          <option value="verified">Verified</option>
          <option value="closed">Closed</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as typeof categoryFilter)}
          className="rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
        >
          <option value="">All Categories</option>
          <option value="clinical_documentation">Clinical Documentation</option>
          <option value="safety">Safety</option>
          <option value="staffing">Staffing</option>
          <option value="training">Training</option>
          <option value="facilities">Facilities</option>
          <option value="medication">Medication</option>
          <option value="resident_rights">Resident Rights</option>
          <option value="infection_control">Infection Control</option>
          <option value="administrative">Administrative</option>
        </select>
      </div>

      {/* Deficiency List */}
      <div className="space-y-3">
        {(!deficiencies || deficiencies.length === 0) && (
          <p className="text-[13px] py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No deficiencies found</p>
        )}
        {deficiencies?.map((def) => {
          const sc = STATUS_COLORS[def.status] ?? { bg: "#F3F4F6", color: "#6B7280" };
          const sev = SEVERITY_COLORS[def.severity] ?? { bg: "#F3F4F6", color: "#6B7280" };
          const isExpanded = expandedId === def.id;
          const isOverdue = def.status !== "verified" && def.status !== "closed" && def.correctionDueDate && def.correctionDueDate < new Date().toISOString();
          return (
            <div key={def.id} className="rounded-lg border overflow-hidden" style={{ borderColor: isOverdue ? "#FCA5A5" : "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : def.id)}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{def.deficiencyNumber}</span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>
                      {def.status}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: sev.bg, color: sev.color }}>
                      {def.severity}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[11px]" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                      {CATEGORY_LABELS[def.category] ?? def.category}
                    </span>
                    {isOverdue && (
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-bold" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                    Due: {new Date(def.correctionDueDate).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{def.title}</p>
                <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{def.description}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Source: {def.sourceType}</span>
                  {def.regulationCitation && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F3E8FF", color: "#7C3AED" }}>{def.regulationCitation}</span>
                  )}
                  {def.tagNumber && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>Tag: {def.tagNumber}</span>
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="px-4 pb-4" style={{ borderTop: "1px solid var(--card-border)" }}>
                  <div className="pt-3 space-y-3">
                    {/* Plan of Correction */}
                    {def.pocDescription && (
                      <div className="rounded p-3" style={{ backgroundColor: "#F9FAFB" }}>
                        <h4 className="text-[12px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Plan of Correction</h4>
                        <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>{def.pocDescription}</p>
                        {def.pocSubmittedDate && (
                          <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Submitted: {new Date(def.pocSubmittedDate).toLocaleDateString()}</span>
                        )}
                      </div>
                    )}

                    {/* Verification Notes */}
                    {def.verificationNotes && (
                      <div className="rounded p-3" style={{ backgroundColor: "#ECFDF520" }}>
                        <h4 className="text-[12px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>Verification Notes</h4>
                        <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>{def.verificationNotes}</p>
                      </div>
                    )}

                    {/* Action Controls */}
                    <div className="flex flex-col gap-2">
                      {def.status === "open" && (
                        <>
                          <textarea
                            placeholder="Enter Plan of Correction..."
                            value={pocText}
                            onChange={(e) => setPocText(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border px-3 py-2 text-[12px] outline-none"
                            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
                          />
                          <button
                            onClick={() => handleStatusAdvance(def.id, def.status)}
                            className="px-3 py-1.5 rounded text-[11px] font-medium self-start"
                            style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
                          >
                            Submit POC
                          </button>
                        </>
                      )}
                      {def.status === "poc_pending" && (
                        <button
                          onClick={() => handleStatusAdvance(def.id, def.status)}
                          className="px-3 py-1.5 rounded text-[11px] font-medium self-start"
                          style={{ backgroundColor: "#DBEAFE", color: "#2563EB" }}
                        >
                          Approve POC
                        </button>
                      )}
                      {def.status === "poc_approved" && (
                        <button
                          onClick={() => handleStatusAdvance(def.id, def.status)}
                          className="px-3 py-1.5 rounded text-[11px] font-medium self-start"
                          style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}
                        >
                          Mark In Progress
                        </button>
                      )}
                      {def.status === "in_progress" && (
                        <button
                          onClick={() => handleStatusAdvance(def.id, def.status)}
                          className="px-3 py-1.5 rounded text-[11px] font-medium self-start"
                          style={{ backgroundColor: "#D1FAE5", color: "#059669" }}
                        >
                          Mark Corrected
                        </button>
                      )}
                      {def.status === "corrected" && (
                        <button
                          onClick={() => handleStatusAdvance(def.id, def.status)}
                          className="px-3 py-1.5 rounded text-[11px] font-medium self-start"
                          style={{ backgroundColor: "#ECFDF5", color: "#059669" }}
                        >
                          Verify & Close
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

export default DeficiencyTrackingPage;
