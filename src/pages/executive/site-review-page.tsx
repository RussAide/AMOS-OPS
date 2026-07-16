import { useState, useMemo } from "react";
import {
  ClipboardCheck, Calendar, CheckCircle2, AlertTriangle, XCircle,
  Clock, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Eye, User, X, ChevronRight,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface SiteReview {
  id: string;
  reviewDate: string;
  inspector: string;
  category: string;
  finding: string;
  status: "open" | "in_progress" | "resolved" | "overdue";
  severity: "critical" | "high" | "medium" | "low";
  dueDate: string;
  facility: string;
}

// ─── Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  open:        { label: "Open",        color: "#D97706", bg: "#FFFBEB", icon: Clock },
  in_progress: { label: "In Progress", color: "#2563EB", bg: "#EFF6FF", icon: ChevronRight },
  resolved:    { label: "Resolved",    color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  overdue:     { label: "Overdue",     color: "#DC2626", bg: "#FEF2F2", icon: XCircle },
};

const SEVERITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "#DC2626", bg: "#FEF2F2" },
  high:     { label: "High",     color: "#D97706", bg: "#FFFBEB" },
  medium:   { label: "Medium",   color: "#2563EB", bg: "#EFF6FF" },
  low:      { label: "Low",      color: "#059669", bg: "#ECFDF5" },
};

const CATEGORY_CONFIG: Record<string, { color: string; bg: string }> = {
  Safety:       { color: "#DC2626", bg: "#FEF2F2" },
  Documentation:{ color: "#2563EB", bg: "#EFF6FF" },
  "Staffing":   { color: "#7C3AED", bg: "#F5F3FF" },
  "Facilities": { color: "#059669", bg: "#ECFDF5" },
  "Training":   { color: "#D97706", bg: "#FFFBEB" },
  "Compliance": { color: "#0891B2", bg: "#CFFAFE" },
};

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_REVIEWS: SiteReview[] = [
  { id: "SR-001", reviewDate: "2025-05-15", inspector: "State Surveyor Team A", category: "Safety", finding: "Fire extinguisher inspection overdue in Building C", status: "resolved", severity: "high", dueDate: "2025-06-01", facility: "Main Campus" },
  { id: "SR-002", reviewDate: "2025-05-15", inspector: "State Surveyor Team A", category: "Documentation", finding: "Three missing MAR signatures for June 1-3", status: "in_progress", severity: "medium", dueDate: "2025-06-20", facility: "Main Campus" },
  { id: "SR-003", reviewDate: "2025-05-15", inspector: "State Surveyor Team A", category: "Staffing", finding: " Overnight staffing ratio below minimum on 2 shifts", status: "open", severity: "critical", dueDate: "2025-06-15", facility: "North Campus" },
  { id: "SR-004", reviewDate: "2025-05-15", inspector: "State Surveyor Team A", category: "Facilities", finding: "HVAC filter replacement schedule not documented", status: "resolved", severity: "low", dueDate: "2025-06-10", facility: "Main Campus" },
  { id: "SR-005", reviewDate: "2025-04-20", inspector: "Dr. Martinez (External)", category: "Training", finding: "12 staff members with expired CPI certification", status: "overdue", severity: "high", dueDate: "2025-05-30", facility: "All Facilities" },
  { id: "SR-006", reviewDate: "2025-04-20", inspector: "Dr. Martinez (External)", category: "Compliance", finding: "Privacy screens not used consistently in open office areas", status: "in_progress", severity: "medium", dueDate: "2025-06-25", facility: "Admin Building" },
  { id: "SR-007", reviewDate: "2025-03-10", inspector: "Internal QA Team", category: "Safety", finding: "Emergency exit lighting test failed in East Wing", status: "resolved", severity: "critical", dueDate: "2025-03-20", facility: "Main Campus" },
  { id: "SR-008", reviewDate: "2025-03-10", inspector: "Internal QA Team", category: "Documentation", finding: "Treatment plan reviews not completed within 30 days", status: "open", severity: "medium", dueDate: "2025-07-01", facility: "North Campus" },
  { id: "SR-009", reviewDate: "2025-06-01", inspector: "State Surveyor Team B", category: "Staffing", finding: "Background check documentation incomplete for 2 contractors", status: "in_progress", severity: "high", dueDate: "2025-06-20", facility: "South Campus" },
  { id: "SR-010", reviewDate: "2025-06-01", inspector: "State Surveyor Team B", category: "Compliance", finding: "HIPAA signage missing from 3 clinical offices", status: "open", severity: "low", dueDate: "2025-07-10", facility: "Admin Building" },
];

// ─── Sort ──────────────────────────────────────────────────────
type SortField = "reviewDate" | "inspector" | "category" | "finding" | "status" | "dueDate";
type SortDir = "asc" | "desc";

function renderSortIcon(field: SortField, activeField: SortField, direction: SortDir) {
  if (activeField !== field) {
    return <ArrowUpDown size={12} className="ml-1" style={{ color: "#9CA3AF" }} />;
  }
  return direction === "asc"
    ? <ArrowUp size={12} className="ml-1" style={{ color: "#245C5A" }} />
    : <ArrowDown size={12} className="ml-1" style={{ color: "#245C5A" }} />;
}

export default function SiteReviewPage() {
  const [reviews] = useState<SiteReview[]>(DEMO_REVIEWS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("reviewDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedReview, setSelectedReview] = useState<SiteReview | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let r = [...reviews];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((x) =>
        x.finding.toLowerCase().includes(q) ||
        x.inspector.toLowerCase().includes(q) ||
        x.category.toLowerCase().includes(q) ||
        x.id.toLowerCase().includes(q) ||
        x.facility.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (categoryFilter !== "all") r = r.filter((x) => x.category === categoryFilter);
    if (severityFilter !== "all") r = r.filter((x) => x.severity === severityFilter);
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "reviewDate": cmp = new Date(a.reviewDate).getTime() - new Date(b.reviewDate).getTime(); break;
        case "inspector": cmp = a.inspector.localeCompare(b.inspector); break;
        case "category": cmp = a.category.localeCompare(b.category); break;
        case "finding": cmp = a.finding.localeCompare(b.finding); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "dueDate": cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [reviews, searchQuery, statusFilter, categoryFilter, severityFilter, sortField, sortDir]);

  const kpiCounts = useMemo(() => ({
    lastReview: reviews.length > 0 ? reviews[0].reviewDate : "N/A",
    score: Math.round((reviews.filter((r) => r.status === "resolved").length / reviews.length) * 100),
    openItems: reviews.filter((r) => r.status === "open" || r.status === "in_progress").length,
    overdueItems: reviews.filter((r) => r.status === "overdue").length,
  }), [reviews]);

  const categories = [...new Set(reviews.map((r) => r.category))];
  const hasFilters = searchQuery || statusFilter !== "all" || categoryFilter !== "all" || severityFilter !== "all";

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <ClipboardCheck size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Site Review</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Track inspection findings, corrective actions, and compliance status
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Last Review", value: kpiCounts.lastReview, color: "#2563EB", bg: "#EFF6FF", icon: Calendar },
          { label: "Resolution Score", value: `${kpiCounts.score}%`, color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
          { label: "Open Items", value: kpiCounts.openItems, color: "#D97706", bg: "#FFFBEB", icon: AlertTriangle },
          { label: "Overdue", value: kpiCounts.overdueItems, color: "#DC2626", bg: "#FEF2F2", icon: XCircle },
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
              <p className="text-[22px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <input
            placeholder="Search finding, inspector, facility..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[12px] rounded-md border bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Status</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
          </select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Categories</option>
            {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Severity</option>
            {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (<option key={k} value={k}>{v.label}</option>))}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setCategoryFilter("all"); setSeverityFilter("all"); }} className="flex items-center gap-1 text-[11px] px-3 py-2 rounded-md border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>
              <Filter size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-3">
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Showing {filtered.length} of {reviews.length} findings</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("reviewDate")}>
                  <span className="flex items-center">Review Date {renderSortIcon("reviewDate", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("inspector")}>
                  <span className="flex items-center">Inspector {renderSortIcon("inspector", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("category")}>
                  <span className="flex items-center">Category {renderSortIcon("category", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Finding</th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("status")}>
                  <span className="flex items-center">Status {renderSortIcon("status", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("dueDate")}>
                  <span className="flex items-center">Due Date {renderSortIcon("dueDate", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const stCfg = STATUS_CONFIG[r.status];
                const StatusIcon = stCfg.icon;
                const catCfg = CATEGORY_CONFIG[r.category] || { color: "#6B7280", bg: "#F3F4F6" };
                return (
                  <tr key={r.id} className="border-b hover:bg-black/[0.02] transition-colors" style={{ borderColor: "var(--card-border)" }}>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{r.reviewDate}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-medium">{r.inspector}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: catCfg.bg, color: catCfg.color }}>{r.category}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <p className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{r.finding}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{r.facility}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        <StatusIcon size={10} /> {stCfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: r.status === "overdue" ? "#DC2626" : "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {r.dueDate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button onClick={() => setSelectedReview(r)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium cursor-pointer" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                        <Eye size={10} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <ClipboardCheck size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No findings match your filters</p>
                    <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setCategoryFilter("all"); setSeverityFilter("all"); }} className="text-[11px] mt-1 underline cursor-pointer" style={{ color: "#245C5A" }}>Clear all filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{selectedReview.id}</h3>
                <button onClick={() => setSelectedReview(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{selectedReview.finding}</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-2.5 rounded border" style={{ borderColor: "var(--card-border)" }}>
                    <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Category</p>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: (CATEGORY_CONFIG[selectedReview.category]?.bg || "#F3F4F6"), color: (CATEGORY_CONFIG[selectedReview.category]?.color || "#6B7280") }}>{selectedReview.category}</span>
                  </div>
                  <div className="p-2.5 rounded border" style={{ borderColor: "var(--card-border)" }}>
                    <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Severity</p>
                    <span className="text-[11px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: SEVERITY_CONFIG[selectedReview.severity].bg, color: SEVERITY_CONFIG[selectedReview.severity].color }}>{SEVERITY_CONFIG[selectedReview.severity].label}</span>
                  </div>
                  <div className="p-2.5 rounded border" style={{ borderColor: "var(--card-border)" }}>
                    <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Status</p>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ backgroundColor: STATUS_CONFIG[selectedReview.status].bg, color: STATUS_CONFIG[selectedReview.status].color }}>
                      {STATUS_CONFIG[selectedReview.status].label}
                    </span>
                  </div>
                  <div className="p-2.5 rounded border" style={{ borderColor: "var(--card-border)" }}>
                    <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Facility</p>
                    <p className="text-[11px] font-medium">{selectedReview.facility}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Review Date: {selectedReview.reviewDate}</span>
                  <span className="text-[11px] font-mono" style={{ color: selectedReview.status === "overdue" ? "#DC2626" : "var(--topbar-subtitle)" }}>Due: {selectedReview.dueDate}</span>
                </div>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <User size={12} /> Inspector: {selectedReview.inspector}
                </div>
              </div>
              <button onClick={() => setSelectedReview(null)} className="mt-4 w-full px-4 py-2 rounded-lg text-[12px] font-medium border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
