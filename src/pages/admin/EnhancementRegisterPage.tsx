/**
 * D014-02: Enhancement Register Page
 * Admin-only page for tracking feature requests with priority, status,
 * requester info, milestone targets, sort/filter, and add form.
 */
import { useState, useMemo } from "react";
import {
  Lightbulb,
  Plus,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  X,
  CheckCircle2,
  PauseCircle,
  CircleDot,
  Rocket,
  Save,
  AlertTriangle,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";

// ─── Types ─────────────────────────────────────────────────────
type Priority = "P0" | "P1" | "P2" | "P3";
type Status = "proposed" | "approved" | "in-progress" | "done" | "deferred";

interface EnhancementRequest {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  requesterName: string;
  requesterRole: string;
  milestone: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  tags: string[];
}

// ─── Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  proposed:   { label: "Proposed",    color: "#6366F1", bg: "#EEF2FF", icon: CircleDot },
  approved:   { label: "Approved",    color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  "in-progress": { label: "In Progress", color: "#D97706", bg: "#FFFBEB", icon: Rocket },
  done:       { label: "Done",        color: "#245C5A", bg: "#F0FDFA", icon: CheckCircle2 },
  deferred:   { label: "Deferred",    color: "#6B7280", bg: "#F9FAFB", icon: PauseCircle },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; order: number }> = {
  P0: { label: "Critical", color: "#DC2626", bg: "#FEF2F2", order: 0 },
  P1: { label: "High",     color: "#EA580C", bg: "#FFF7ED", order: 1 },
  P2: { label: "Medium",   color: "#D97706", bg: "#FFFBEB", order: 2 },
  P3: { label: "Low",      color: "#059669", bg: "#ECFDF5", order: 3 },
};

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_REQUESTS: EnhancementRequest[] = [
  {
    id: "ER-001", title: "Add bulk export for MAR records",
    description: "Ability to export MAR data in bulk for a date range, filtered by unit or youth. Needed for HHSC audits.",
    priority: "P1", requesterName: "Lilian Ike", requesterRole: "clinical-director",
    milestone: "M15", status: "in-progress", createdAt: "2026-06-15", updatedAt: "2026-07-01", tags: ["MAR","export","compliance"],
  },
  {
    id: "ER-002", title: "CANS auto-scoring improvement",
    description: "Enhance CANS assessment scoring to auto-flag significant changes between assessments and generate narrative summaries.",
    priority: "P0", requesterName: "Dr. Hall", requesterRole: "treatment-director",
    milestone: "M12", status: "approved", createdAt: "2026-06-20", updatedAt: "2026-07-02", tags: ["CANS","clinical","scoring"],
  },
  {
    id: "ER-003", title: "Shift handoff mobile view",
    description: "Optimize the shift handoff interface for mobile devices. RCS staff primarily use tablets during shift changes.",
    priority: "P2", requesterName: "Marcus Chen", requesterRole: "shift-supervisor",
    milestone: "M18", status: "proposed", createdAt: "2026-06-28", updatedAt: "2026-06-28", tags: ["GRO","mobile","UI"],
  },
  {
    id: "ER-004", title: "HR credential expiration dashboard",
    description: "Create a visual dashboard showing upcoming credential expirations by department with color-coded urgency.",
    priority: "P1", requesterName: "E. Russ Aideyan", requesterRole: "administrator",
    milestone: "M9", status: "done", createdAt: "2026-05-10", updatedAt: "2026-06-30", tags: ["HR","credentials","dashboard"],
  },
  {
    id: "ER-005", title: "QA evidence matrix bulk import",
    description: "Allow bulk import of evidence files into the QA Evidence Matrix via CSV manifest upload.",
    priority: "P3", requesterName: "QA Team", requesterRole: "chart-auditor",
    milestone: "M21", status: "deferred", createdAt: "2026-06-01", updatedAt: "2026-06-15", tags: ["QA","import","evidence"],
  },
  {
    id: "ER-006", title: "Revenue denial tracking by payer",
    description: "Add denial tracking breakdown by payer with appeal success rate analytics and trend reporting.",
    priority: "P0", requesterName: "Sarah Kim", requesterRole: "revenue-cycle-manager",
    milestone: "M10", status: "in-progress", createdAt: "2026-06-18", updatedAt: "2026-07-03", tags: ["revenue","denials","analytics"],
  },
  {
    id: "ER-007", title: "NIL Graph natural language queries",
    description: "Enable natural language queries in the NIL Graph for cross-module semantic search across all AMOS data.",
    priority: "P2", requesterName: "E. Russ Aideyan", requesterRole: "administrator",
    milestone: "M20", status: "proposed", createdAt: "2026-07-01", updatedAt: "2026-07-01", tags: ["NIL","AI","search"],
  },
  {
    id: "ER-008", title: "Campus census forecasting",
    description: "Add predictive analytics to campus census with admission/discharge forecasting and bed optimization.",
    priority: "P1", requesterName: "Program Director", requesterRole: "program-director",
    milestone: "M14", status: "approved", createdAt: "2026-06-25", updatedAt: "2026-07-02", tags: ["campus","forecasting","analytics"],
  },
];

// ─── Sort ──────────────────────────────────────────────────────
type SortField = "priority" | "status" | "milestone" | "createdAt" | "requesterName";
type SortDir = "asc" | "desc";

export function EnhancementRegisterPage() {
  const { user, permissions } = useAuth();
  const isAdminUser = permissions.canViewAdmin && permissions.canEditAdmin;

  const [requests, setRequests] = useState<EnhancementRequest[]>(DEMO_REQUESTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", priority: "P2" as Priority, milestone: "", tags: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);

  // ─── Sort handler ────────────────────────────────────────────
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // ─── Filtered & sorted ───────────────────────────────────────
  const filtered = useMemo(() => {
    let r = [...requests];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((x) =>
        x.title.toLowerCase().includes(q) ||
        x.description.toLowerCase().includes(q) ||
        x.id.toLowerCase().includes(q) ||
        x.requesterName.toLowerCase().includes(q) ||
        x.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (priorityFilter !== "all") r = r.filter((x) => x.priority === priorityFilter);
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "priority": cmp = PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order; break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "milestone": cmp = a.milestone.localeCompare(b.milestone); break;
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case "requesterName": cmp = a.requesterName.localeCompare(b.requesterName); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [requests, searchQuery, statusFilter, priorityFilter, sortField, sortDir]);

  // ─── Status counts ───────────────────────────────────────────
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: requests.length };
    (Object.keys(STATUS_CONFIG) as Status[]).forEach((s) => { c[s] = requests.filter((r) => r.status === s).length; });
    return c;
  }, [requests]);

  // ─── Submit ──────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.milestone) return;
    const newReq: EnhancementRequest = {
      id: `ER-${String(requests.length + 1).padStart(3, "0")}`,
      title: formData.title,
      description: formData.description,
      priority: formData.priority,
      requesterName: user?.name ?? "Unknown",
      requesterRole: user?.role ?? "unknown",
      milestone: formData.milestone,
      status: "proposed",
      createdAt: new Date().toISOString().split("T")[0],
      updatedAt: new Date().toISOString().split("T")[0],
      tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    setRequests([newReq, ...requests]);
    setFormSubmitted(true);
    setTimeout(() => {
      setShowAddForm(false);
      setFormSubmitted(false);
      setFormData({ title: "", description: "", priority: "P2", milestone: "", tags: "" });
    }, 2000);
  };

  // ─── Sort icon ───────────────────────────────────────────────
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1" style={{ color: "#9CA3AF" }} />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="ml-1" style={{ color: "#245C5A" }} />
      : <ArrowDown size={12} className="ml-1" style={{ color: "#245C5A" }} />;
  };

  const hasFilters = searchQuery || statusFilter !== "all" || priorityFilter !== "all";

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <Lightbulb size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Enhancement Register</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Track feature requests and manage the AMOS-OPS roadmap
            </p>
          </div>
        </div>
        <div className="sm:ml-auto">
          <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2 text-[12px]" style={{ backgroundColor: "#245C5A" }}>
            <Plus size={14} />
            New Request
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-4">
        {(["all", ...Object.keys(STATUS_CONFIG)] as (Status | "all")[]).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? "all" : s)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all"
            style={{
              borderColor: statusFilter === s ? (STATUS_CONFIG[s as Status]?.color ?? "#245C5A") : "var(--card-border)",
              backgroundColor: statusFilter === s ? (STATUS_CONFIG[s as Status]?.bg ?? "#F0FDFA") : "var(--card-bg)",
              cursor: "pointer",
            }}
          >
            {(() => {
  if (s === "all") return <Lightbulb size={14} style={{ color: "#245C5A" }} />;
  const IconComp = STATUS_CONFIG[s as Status].icon;
  return <IconComp size={14} style={{ color: STATUS_CONFIG[s as Status].color }} />;
})()}
            <div>
              <p className="text-[15px] font-bold leading-tight" style={{ color: statusFilter === s ? (STATUS_CONFIG[s as Status]?.color ?? "#245C5A") : "var(--topbar-title)" }}>
                {counts[s] ?? 0}
              </p>
              <p className="text-[9px] uppercase tracking-wider font-medium" style={{ color: "var(--topbar-subtitle)" }}>
                {s === "all" ? "All" : STATUS_CONFIG[s as Status].label}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <Input placeholder="Search title, ID, requester, tag..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8 text-[12px] h-9" />
        </div>
        <div className="flex gap-2">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as Priority | "all")} className="text-[12px] rounded-md border px-2 h-9 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Priorities</option>
            <option value="P0">P0 — Critical</option>
            <option value="P1">P1 — High</option>
            <option value="P2">P2 — Medium</option>
            <option value="P3">P3 — Low</option>
          </select>
          {hasFilters && (
            <Button variant="outline" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setPriorityFilter("all"); }} className="text-[11px] h-9 px-2">
              <X size={12} className="mr-1" /> Clear
            </Button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-2">
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
          Showing {filtered.length} of {requests.length} requests
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("priority")}>
                  <span className="flex items-center">Priority <SortIcon field="priority" /></span>
                </th>
                <th className="text-left py-2 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>ID / Title</th>
                <th className="text-left py-2 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("requesterName")}>
                  <span className="flex items-center">Requester <SortIcon field="requesterName" /></span>
                </th>
                <th className="text-left py-2 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("milestone")}>
                  <span className="flex items-center">Milestone <SortIcon field="milestone" /></span>
                </th>
                <th className="text-left py-2 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("status")}>
                  <span className="flex items-center">Status <SortIcon field="status" /></span>
                </th>
                <th className="text-left py-2 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("createdAt")}>
                  <span className="flex items-center">Created <SortIcon field="createdAt" /></span>
                </th>
                <th className="text-left py-2 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Tags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const stCfg = STATUS_CONFIG[req.status];
                const prCfg = PRIORITY_CONFIG[req.priority];
                const StatusIcon = stCfg.icon;
                return (
                  <tr key={req.id} className="border-b hover:bg-black/[0.02] transition-colors" style={{ borderColor: "var(--card-border)" }}>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: prCfg.bg, color: prCfg.color }}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{req.title}</p>
                      <p className="text-[10px] line-clamp-1" style={{ color: "var(--topbar-subtitle)" }}>{req.id} — {req.description}</p>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <p className="font-medium" style={{ color: "var(--topbar-title)" }}>{req.requesterName}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{req.requesterRole}</p>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-mono font-medium" style={{ color: "#245C5A" }}>{req.milestone}</span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        <StatusIcon size={10} />
                        {stCfg.label}
                      </span>
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{req.createdAt}</span>
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex flex-wrap gap-1">
                        {req.tags.map((t) => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>{t}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Lightbulb size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No requests match your filters</p>
                    <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setPriorityFilter("all"); }} className="text-[11px] mt-1 underline" style={{ color: "#245C5A", cursor: "pointer" }}>
                      Clear all filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add Request Dialog ────────────────────────────────── */}
      <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Plus size={16} style={{ color: "#245C5A" }} />
              New Enhancement Request
            </DialogTitle>
            <DialogDescription className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
              Submit a feature request for the AMOS-Ops platform. All requests start as "Proposed" and require admin review.
            </DialogDescription>
          </DialogHeader>

          {formSubmitted ? (
            <div className="py-8 text-center">
              <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#059669" }} />
              <p className="text-[14px] font-semibold" style={{ color: "#059669" }}>Request submitted successfully!</p>
              <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Your request has been added to the register.</p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Title *</label>
                <Input placeholder="Short descriptive title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} className="text-[12px] h-8" />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Description *</label>
                <textarea
                  placeholder="Detailed description of the feature request..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full text-[12px] rounded-md border p-2 resize-none"
                  style={{ borderColor: "var(--card-border)", minHeight: 80 }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Priority *</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                    className="w-full text-[12px] rounded-md border px-2 h-8 bg-transparent"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    <option value="P0">P0 — Critical</option>
                    <option value="P1">P1 — High</option>
                    <option value="P2">P2 — Medium</option>
                    <option value="P3">P3 — Low</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Milestone Target *</label>
                  <Input placeholder="e.g. M15" value={formData.milestone} onChange={(e) => setFormData({ ...formData, milestone: e.target.value })} className="text-[12px] h-8" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Tags (comma-separated)</label>
                <Input placeholder="e.g. clinical, UI, export" value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} className="text-[12px] h-8" />
              </div>
              <div className="pt-2 flex gap-2">
                <Button
                  onClick={handleSubmit}
                  disabled={!formData.title || !formData.description || !formData.milestone}
                  className="flex-1 text-[12px] h-9"
                  style={{ backgroundColor: "#245C5A" }}
                >
                  <Save size={13} className="mr-1" />
                  Submit Request
                </Button>
                <Button variant="outline" onClick={() => setShowAddForm(false)} className="text-[12px] h-9">
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default EnhancementRegisterPage;
