import { useState, useMemo } from "react";
import {
  Sparkles,
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
  Eye,
  ThumbsUp,
  Lightbulb,
  Code2,
  FlaskConical,
  Check,
  Calendar,
  User,
  Tag,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
type Priority = "P0" | "P1" | "P2" | "P3";
type Status = "proposed" | "in-progress" | "ready-for-test" | "deployed" | "deferred";
type Category = "Clinical" | "Technical" | "Integration" | "Compliance" | "Analytics" | "Portal";

interface EnhancementRequest {
  id: string;
  title: string;
  description: string;
  category: Category;
  priority: Priority;
  status: Status;
  requestedBy: string;
  requesterRole: string;
  targetDate: string;
  votes: number;
  createdAt: string;
  tags: string[];
}

// ─── Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  proposed:      { label: "Proposed",       color: "#6366F1", bg: "#EEF2FF", icon: CircleDot },
  "in-progress": { label: "In Development", color: "#D97706", bg: "#FFFBEB", icon: Code2 },
  "ready-for-test": { label: "Ready for Test", color: "#0891B2", bg: "#CFFAFE", icon: FlaskConical },
  deployed:      { label: "Deployed",       color: "#245C5A", bg: "#F0FDFA", icon: CheckCircle2 },
  deferred:      { label: "Deferred",       color: "#6B7280", bg: "#F9FAFB", icon: PauseCircle },
};

const PRIORITY_CONFIG: Record<Priority, { label: string; color: string; bg: string; order: number }> = {
  P0: { label: "Critical", color: "#DC2626", bg: "#FEF2F2", order: 0 },
  P1: { label: "High",     color: "#EA580C", bg: "#FFF7ED", order: 1 },
  P2: { label: "Medium",   color: "#D97706", bg: "#FFFBEB", order: 2 },
  P3: { label: "Low",      color: "#059669", bg: "#ECFDF5", order: 3 },
};

const CATEGORY_CONFIG: Record<Category, { color: string; bg: string }> = {
  Clinical:    { color: "#0891B2", bg: "#CFFAFE" },
  Technical:   { color: "#7C3AED", bg: "#F3E8FF" },
  Integration: { color: "#2563EB", bg: "#EFF6FF" },
  Compliance:  { color: "#DC2626", bg: "#FEF2F2" },
  Analytics:   { color: "#059669", bg: "#ECFDF5" },
  Portal:      { color: "#EA580C", bg: "#FFF7ED" },
};

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_REQUESTS: EnhancementRequest[] = [
  {
    id: "ER-001", title: "Mobile Medication MAR",
    description: "Touch-friendly Mobile MAR for medication administration with offline sync capability for nursing staff.",
    category: "Clinical", priority: "P0", status: "in-progress",
    requestedBy: "Lilian Ike", requesterRole: "Nurse Manager",
    targetDate: "2026-08-15", votes: 8, createdAt: "2026-05-20",
    tags: ["MAR", "mobile", "nursing"],
  },
  {
    id: "ER-002", title: "CANS Auto-Scoring",
    description: "Automated CANS assessment scoring with change flagging between assessments and narrative summary generation.",
    category: "Clinical", priority: "P0", status: "ready-for-test",
    requestedBy: "Dr. Sarah Chen", requesterRole: "Clinical Director",
    targetDate: "2026-07-20", votes: 12, createdAt: "2026-04-10",
    tags: ["CANS", "clinical", "assessment"],
  },
  {
    id: "ER-003", title: "Billing Integration",
    description: "Direct integration with billing system for automated claim submission, denial tracking, and revenue reconciliation.",
    category: "Integration", priority: "P1", status: "in-progress",
    requestedBy: "Rachel Kim", requesterRole: "Billing Specialist",
    targetDate: "2026-09-01", votes: 6, createdAt: "2026-06-01",
    tags: ["billing", "revenue", "integration"],
  },
  {
    id: "ER-004", title: "AI Documentation Assistant",
    description: "AI-powered clinical documentation helper that suggests narrative text based on CANS scores and treatment notes.",
    category: "Technical", priority: "P1", status: "proposed",
    requestedBy: "Dr. Sarah Chen", requesterRole: "Clinical Director",
    targetDate: "2026-10-15", votes: 15, createdAt: "2026-07-01",
    tags: ["AI", "documentation", "clinical"],
  },
  {
    id: "ER-005", title: "Family Portal",
    description: "Secure web portal for families to view visit schedules, youth progress updates, and communicate with the treatment team.",
    category: "Portal", priority: "P2", status: "proposed",
    requestedBy: "Marcus Williams", requesterRole: "Program Director",
    targetDate: "2026-11-01", votes: 10, createdAt: "2026-06-15",
    tags: ["family", "portal", "communication"],
  },
  {
    id: "ER-006", title: "Staff Scheduling Optimization",
    description: "AI-driven staff scheduling with shift swap requests, availability management, and overtime alerts.",
    category: "Analytics", priority: "P2", status: "deployed",
    requestedBy: "Aisha Patel", requesterRole: "HR Manager",
    targetDate: "2026-06-01", votes: 7, createdAt: "2026-03-01",
    tags: ["scheduling", "HR", "optimization"],
  },
  {
    id: "ER-007", title: "Compliance Alert System",
    description: "Real-time compliance alerts for credential expirations, training deadlines, and audit findings.",
    category: "Compliance", priority: "P1", status: "deployed",
    requestedBy: "David Thompson", requesterRole: "Compliance Officer",
    targetDate: "2026-05-15", votes: 9, createdAt: "2026-02-15",
    tags: ["compliance", "alerts", "audit"],
  },
  {
    id: "ER-008", title: "NIL Graph Expansion",
    description: "Extend NIL Graph with natural language query support, cross-module semantic search, and relationship visualization.",
    category: "Technical", priority: "P2", status: "in-progress",
    requestedBy: "Michael Foster", requesterRole: "IT Administrator",
    targetDate: "2026-08-30", votes: 5, createdAt: "2026-06-20",
    tags: ["NIL", "graph", "search"],
  },
  {
    id: "ER-009", title: "MGMA KPI Dashboard",
    description: "Executive dashboard with MGMA benchmarking KPIs: cost per case, LOS, readmission rates, and staffing ratios.",
    category: "Analytics", priority: "P1", status: "deployed",
    requestedBy: "Marcus Williams", requesterRole: "Program Director",
    targetDate: "2026-04-01", votes: 4, createdAt: "2026-01-10",
    tags: ["MGMA", "KPI", "dashboard"],
  },
  {
    id: "ER-010", title: "Shift Handoff Mobile View",
    description: "Optimized shift handoff interface for tablet use during shift changes with digital signature support.",
    category: "Technical", priority: "P2", status: "ready-for-test",
    requestedBy: "James Rodriguez", requesterRole: "RC Supervisor",
    targetDate: "2026-07-25", votes: 6, createdAt: "2026-05-15",
    tags: ["GRO", "mobile", "handoff"],
  },
  {
    id: "ER-011", title: "Revenue Denial Analytics",
    description: "Denial tracking breakdown by payer with appeal success rates, root cause analysis, and trend reporting.",
    category: "Analytics", priority: "P0", status: "deployed",
    requestedBy: "Rachel Kim", requesterRole: "Billing Specialist",
    targetDate: "2026-03-01", votes: 7, createdAt: "2026-01-05",
    tags: ["revenue", "denials", "analytics"],
  },
  {
    id: "ER-012", title: "Campus Census Forecasting",
    description: "Predictive analytics for campus census with admission/discharge forecasting and bed utilization optimization.",
    category: "Analytics", priority: "P2", status: "proposed",
    requestedBy: "Marcus Williams", requesterRole: "Program Director",
    targetDate: "2026-12-01", votes: 3, createdAt: "2026-06-25",
    tags: ["campus", "forecasting", "census"],
  },
];

// ─── Sort ──────────────────────────────────────────────────────
type SortField = "priority" | "status" | "targetDate" | "createdAt" | "requestedBy" | "category";
type SortDir = "asc" | "desc";

export default function EnhancementRegisterPage() {
  const [requests, setRequests] = useState<EnhancementRequest[]>(DEMO_REQUESTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Status | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<Category | "all">("all");
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({ title: "", description: "", priority: "P2" as Priority, category: "Technical" as Category, targetDate: "", tags: "" });
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<EnhancementRequest | null>(null);

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
        x.requestedBy.toLowerCase().includes(q) ||
        x.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (priorityFilter !== "all") r = r.filter((x) => x.priority === priorityFilter);
    if (categoryFilter !== "all") r = r.filter((x) => x.category === categoryFilter);
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "priority": cmp = PRIORITY_CONFIG[a.priority].order - PRIORITY_CONFIG[b.priority].order; break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "targetDate": cmp = new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime(); break;
        case "createdAt": cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(); break;
        case "requestedBy": cmp = a.requestedBy.localeCompare(b.requestedBy); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [requests, searchQuery, statusFilter, priorityFilter, categoryFilter, sortField, sortDir]);

  // ─── KPI counts ──────────────────────────────────────────────
  const kpiCounts = useMemo(() => ({
    proposed: requests.filter((r) => r.status === "proposed").length,
    inProgress: requests.filter((r) => r.status === "in-progress").length,
    readyForTest: requests.filter((r) => r.status === "ready-for-test").length,
    deployed: requests.filter((r) => r.status === "deployed").length,
  }), [requests]);

  // ─── Submit ──────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!formData.title || !formData.description || !formData.targetDate) return;
    const newReq: EnhancementRequest = {
      id: `ER-${String(requests.length + 1).padStart(3, "0")}`,
      title: formData.title,
      description: formData.description,
      category: formData.category,
      priority: formData.priority,
      status: "proposed",
      requestedBy: "Current User",
      requesterRole: "Administrator",
      targetDate: formData.targetDate,
      votes: 0,
      createdAt: new Date().toISOString().split("T")[0],
      tags: formData.tags.split(",").map((t) => t.trim()).filter(Boolean),
    };
    setRequests([newReq, ...requests]);
    setFormSubmitted(true);
    setTimeout(() => {
      setShowAddForm(false);
      setFormSubmitted(false);
      setFormData({ title: "", description: "", priority: "P2", category: "Technical", targetDate: "", tags: "" });
    }, 2000);
  };

  // ─── Vote handler ────────────────────────────────────────────
  const handleVote = (id: string) => {
    setRequests(requests.map((r) => (r.id === id ? { ...r, votes: r.votes + 1 } : r)));
  };

  // ─── Sort icon ───────────────────────────────────────────────
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1" style={{ color: "#9CA3AF" }} />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="ml-1" style={{ color: "#245C5A" }} />
      : <ArrowDown size={12} className="ml-1" style={{ color: "#245C5A" }} />;
  };

  const hasFilters = searchQuery || statusFilter !== "all" || priorityFilter !== "all" || categoryFilter !== "all";

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <Sparkles size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Enhancement Register</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Track feature requests, enhancements, and platform roadmap
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-all hover:opacity-90"
            style={{ backgroundColor: "#245C5A" }}
          >
            <Plus size={14} />
            Propose Enhancement
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Proposed", value: kpiCounts.proposed, color: "#6366F1", bg: "#EEF2FF", icon: Lightbulb },
          { label: "In Development", value: kpiCounts.inProgress, color: "#D97706", bg: "#FFFBEB", icon: Code2 },
          { label: "Ready for Test", value: kpiCounts.readyForTest, color: "#0891B2", bg: "#CFFAFE", icon: FlaskConical },
          { label: "Deployed", value: kpiCounts.deployed, color: "#245C5A", bg: "#F0FDFA", icon: CheckCircle2 },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                  <Icon size={16} style={{ color: kpi.color }} />
                </div>
                <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{kpi.label}</span>
              </div>
              <p className="text-[24px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <input
            placeholder="Search title, ID, requester, tag..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[12px] rounded-md border bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | "all")}
            className="text-[12px] rounded-md border px-2 py-2 bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
          </select>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as Priority | "all")}
            className="text-[12px] rounded-md border px-2 py-2 bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          >
            <option value="all">All Priorities</option>
            <option value="P0">P0 - Critical</option>
            <option value="P1">P1 - High</option>
            <option value="P2">P2 - Medium</option>
            <option value="P3">P3 - Low</option>
          </select>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as Category | "all")}
            className="text-[12px] rounded-md border px-2 py-2 bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          >
            <option value="all">All Categories</option>
            {Object.keys(CATEGORY_CONFIG).map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          {hasFilters && (
            <button
              onClick={() => { setSearchQuery(""); setStatusFilter("all"); setPriorityFilter("all"); setCategoryFilter("all"); }}
              className="flex items-center gap-1 text-[11px] px-3 py-2 rounded-md border cursor-pointer"
              style={{ borderColor: "var(--card-border)" }}
            >
              <X size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-3">
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
          Showing {filtered.length} of {requests.length} enhancements
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("priority")}>
                  <span className="flex items-center">Priority <SortIcon field="priority" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>ID / Title</th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("category")}>
                  <span className="flex items-center">Category <SortIcon field="category" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("status")}>
                  <span className="flex items-center">Status <SortIcon field="status" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("requestedBy")}>
                  <span className="flex items-center">Requested By <SortIcon field="requestedBy" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("targetDate")}>
                  <span className="flex items-center">Target Date <SortIcon field="targetDate" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((req) => {
                const stCfg = STATUS_CONFIG[req.status];
                const prCfg = PRIORITY_CONFIG[req.priority];
                const catCfg = CATEGORY_CONFIG[req.category];
                const StatusIcon = stCfg.icon;
                return (
                  <tr key={req.id} className="border-b hover:bg-black/[0.02] transition-colors" style={{ borderColor: "var(--card-border)" }}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: prCfg.bg, color: prCfg.color }}>
                        {req.priority}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{req.title}</p>
                      <p className="text-[10px] line-clamp-1" style={{ color: "var(--topbar-subtitle)" }}>{req.id} — {req.description}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: catCfg.bg, color: catCfg.color }}>
                        {req.category}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        <StatusIcon size={10} />
                        {stCfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <p className="font-medium text-[11px]" style={{ color: "var(--topbar-title)" }}>{req.requestedBy}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{req.requesterRole}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{req.targetDate}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium cursor-pointer"
                          style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
                        >
                          <Eye size={10} /> View
                        </button>
                        <button
                          onClick={() => handleVote(req.id)}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium cursor-pointer"
                          style={{ backgroundColor: "#EEF2FF", color: "#6366F1" }}
                        >
                          <ThumbsUp size={10} /> {req.votes}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <Lightbulb size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No enhancements match your filters</p>
                    <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setPriorityFilter("all"); setCategoryFilter("all"); }} className="text-[11px] mt-1 underline cursor-pointer" style={{ color: "#245C5A" }}>
                      Clear all filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Add Request Modal ────────────────────────────────── */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {formSubmitted ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={32} className="mx-auto mb-2" style={{ color: "#059669" }} />
                <p className="text-[14px] font-semibold" style={{ color: "#059669" }}>Enhancement submitted successfully!</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Your request has been added to the register.</p>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                    <Plus size={16} style={{ color: "#245C5A" }} />
                    Propose Enhancement
                  </h3>
                  <button onClick={() => setShowAddForm(false)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                    <X size={14} />
                  </button>
                </div>
                <p className="text-[12px] mb-4" style={{ color: "var(--topbar-subtitle)" }}>
                  Submit a new enhancement request for the AMOS-OPS platform.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Title *</label>
                    <input
                      placeholder="Short descriptive title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full text-[12px] rounded-md border px-3 py-2"
                      style={{ borderColor: "var(--card-border)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Description *</label>
                    <textarea
                      placeholder="Detailed description of the enhancement..."
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="w-full text-[12px] rounded-md border p-2 resize-none"
                      style={{ borderColor: "var(--card-border)", minHeight: 80 }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Category</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                        className="w-full text-[12px] rounded-md border px-2 py-2 bg-transparent"
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        {Object.keys(CATEGORY_CONFIG).map((c) => (<option key={c} value={c}>{c}</option>))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Priority *</label>
                      <select
                        value={formData.priority}
                        onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                        className="w-full text-[12px] rounded-md border px-2 py-2 bg-transparent"
                        style={{ borderColor: "var(--card-border)" }}
                      >
                        <option value="P0">P0 — Critical</option>
                        <option value="P1">P1 — High</option>
                        <option value="P2">P2 — Medium</option>
                        <option value="P3">P3 — Low</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Target Date *</label>
                    <input
                      type="date"
                      value={formData.targetDate}
                      onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                      className="w-full text-[12px] rounded-md border px-3 py-2"
                      style={{ borderColor: "var(--card-border)" }}
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Tags (comma-separated)</label>
                    <input
                      placeholder="e.g. clinical, mobile, integration"
                      value={formData.tags}
                      onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                      className="w-full text-[12px] rounded-md border px-3 py-2"
                      style={{ borderColor: "var(--card-border)" }}
                    />
                  </div>
                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={handleSubmit}
                      disabled={!formData.title || !formData.description || !formData.targetDate}
                      className="flex-1 flex items-center justify-center gap-1 text-[12px] font-medium py-2.5 rounded-lg text-white cursor-pointer disabled:opacity-50 transition-all hover:opacity-90"
                      style={{ backgroundColor: "#245C5A" }}
                    >
                      <Save size={13} /> Submit Request
                    </button>
                    <button
                      onClick={() => setShowAddForm(false)}
                      className="px-4 py-2.5 rounded-lg text-[12px] font-medium border cursor-pointer"
                      style={{ borderColor: "var(--card-border)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── View Details Modal ───────────────────────────────── */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: PRIORITY_CONFIG[selectedRequest.priority].bg, color: PRIORITY_CONFIG[selectedRequest.priority].color }}>
                    {selectedRequest.priority}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: CATEGORY_CONFIG[selectedRequest.category].bg, color: CATEGORY_CONFIG[selectedRequest.category].color }}>
                    {selectedRequest.category}
                  </span>
                </div>
                <button onClick={() => setSelectedRequest(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <h3 className="text-[16px] font-bold mb-1" style={{ color: "var(--topbar-title)" }}>{selectedRequest.title}</h3>
              <p className="text-[11px] mb-4" style={{ color: "var(--topbar-subtitle)" }}>{selectedRequest.id}</p>
              <p className="text-[12px] mb-4" style={{ color: "var(--topbar-title)" }}>{selectedRequest.description}</p>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Status</p>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: STATUS_CONFIG[selectedRequest.status].bg, color: STATUS_CONFIG[selectedRequest.status].color }}>
                    {(() => { const Icon = STATUS_CONFIG[selectedRequest.status].icon; return <Icon size={10} />; })()}
                    {STATUS_CONFIG[selectedRequest.status].label}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Target Date</p>
                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedRequest.targetDate}</p>
                </div>
                <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Requested By</p>
                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedRequest.requestedBy}</p>
                  <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{selectedRequest.requesterRole}</p>
                </div>
                <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                  <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Votes</p>
                  <p className="text-[12px] font-medium" style={{ color: "#6366F1" }}>{selectedRequest.votes}</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-[10px] mb-1.5" style={{ color: "var(--topbar-subtitle)" }}>Tags</p>
                <div className="flex flex-wrap gap-1">
                  {selectedRequest.tags.map((t) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>{t}</span>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { handleVote(selectedRequest.id); setSelectedRequest({ ...selectedRequest, votes: selectedRequest.votes + 1 }); }}
                  className="flex items-center gap-1 px-4 py-2 rounded-lg text-[12px] font-medium cursor-pointer"
                  style={{ backgroundColor: "#EEF2FF", color: "#6366F1" }}
                >
                  <ThumbsUp size={13} /> Vote ({selectedRequest.votes + 1})
                </button>
                <button
                  onClick={() => setSelectedRequest(null)}
                  className="px-4 py-2 rounded-lg text-[12px] font-medium border cursor-pointer"
                  style={{ borderColor: "var(--card-border)" }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
