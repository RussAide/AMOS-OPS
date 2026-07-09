import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, FileWarning, Search, Plus, CheckCircle, Clock,
  AlertTriangle, XCircle, Filter,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#2563EB", medium: "#D97706", high: "#DC2626", urgent: "#7F1D1D",
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  open: { bg: "#FEE2E2", color: "#DC2626" },
  in_progress: { bg: "#FEF3C7", color: "#D97706" },
  pending_verification: { bg: "#DBEAFE", color: "#2563EB" },
  completed: { bg: "#D1FAE5", color: "#059669" },
  overdue: { bg: "#FCE7F3", color: "#DB2777" },
};

export function CAPTrackerPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const { data: caps, refetch } = trpc.m3.capList.useQuery({ status: statusFilter || undefined, priority: priorityFilter || undefined, search: search || undefined });
  const { data: stats } = trpc.m3.capStats.useQuery();
  const updateCap = trpc.m3.capUpdateStatus.useMutation({ onSuccess: () => refetch() });

  const handleStatusChange = (id: string, newStatus: string) => {
    updateCap.mutate({ id, status: newStatus as any });
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
            <FileWarning size={22} style={{ color: "#7C3AED" }} /> CAP Tracker
          </h1>
        </div>
        <p className="text-[13px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>
          Corrective Action Plans — track, manage, and verify CAPs across all audits and incidents
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: stats?.total ?? 0, color: "#6B7280" },
          { label: "Open", value: stats?.open ?? 0, color: "#D97706" },
          { label: "Overdue", value: stats?.overdue ?? 0, color: "#DC2626" },
          { label: "Pending Verify", value: stats?.pendingVerification ?? 0, color: "#2563EB" },
          { label: "Completed", value: stats?.completed ?? 0, color: "#059669" },
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
            placeholder="Search CAPs..."
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
          <option value="open">Open</option>
          <option value="in_progress">In Progress</option>
          <option value="pending_verification">Pending Verification</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-[13px] outline-none"
          style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
        >
          <option value="">All Priorities</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      {/* CAP List */}
      <div className="space-y-3">
        {(!caps || caps.length === 0) && (
          <p className="text-[13px] py-8 text-center" style={{ color: "var(--topbar-subtitle)" }}>No corrective actions found</p>
        )}
        {caps?.map((cap) => {
          const sc = STATUS_COLORS[cap.status] ?? { bg: "#F3F4F6", color: "#6B7280" };
          const isOverdue = cap.status !== "completed" && cap.dueDate && cap.dueDate < new Date().toISOString();
          return (
            <div key={cap.id} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{cap.actionNumber}</span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: (PRIORITY_COLORS[cap.priority] ?? "#6B7280") + "15", color: PRIORITY_COLORS[cap.priority] ?? "#6B7280" }}>
                    {cap.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: sc.bg, color: sc.color }}>
                    {cap.status}
                  </span>
                  {isOverdue && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>
                      OVERDUE
                    </span>
                  )}
                </div>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  Due: {new Date(cap.dueDate).toLocaleDateString()}
                </span>
              </div>
              <p className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{cap.title}</p>
              <p className="text-[12px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{cap.description}</p>

              {/* Action Bar */}
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: "1px solid var(--card-border)" }}>
                <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Assigned: {cap.assignedTo}</span>
                <div className="flex-1" />
                {cap.status === "open" && (
                  <button onClick={() => handleStatusChange(cap.id, "in_progress")} className="px-3 py-1 rounded text-[11px] font-medium" style={{ backgroundColor: "#FEF3C7", color: "#D97706" }}>
                    Start
                  </button>
                )}
                {cap.status === "in_progress" && (
                  <button onClick={() => handleStatusChange(cap.id, "pending_verification")} className="px-3 py-1 rounded text-[11px] font-medium" style={{ backgroundColor: "#DBEAFE", color: "#2563EB" }}>
                    Submit for Verification
                  </button>
                )}
                {cap.status === "pending_verification" && (
                  <button onClick={() => handleStatusChange(cap.id, "completed")} className="px-3 py-1 rounded text-[11px] font-medium" style={{ backgroundColor: "#D1FAE5", color: "#059669" }}>
                    Verify & Close
                  </button>
                )}
                {cap.completionNotes && (
                  <span className="text-[11px]" style={{ color: "#059669" }}>{cap.completionNotes}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CAPTrackerPage;
