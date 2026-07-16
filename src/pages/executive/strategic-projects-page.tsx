import { useState, useMemo } from "react";
import {
  Target, TrendingUp, AlertTriangle, CheckCircle2, Clock, PauseCircle,
  Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Eye, Calendar, X,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface StrategicProject {
  id: string;
  name: string;
  owner: string;
  division: string;
  startDate: string;
  targetDate: string;
  status: "planning" | "active" | "on_hold" | "completed" | "at_risk";
  progress: number;
  priority: "critical" | "high" | "medium" | "low";
  budget: number;
  description: string;
}

// ─── Config ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  planning:  { label: "Planning",  color: "#7C3AED", bg: "#F5F3FF", icon: Clock },
  active:    { label: "Active",    color: "#059669", bg: "#ECFDF5", icon: TrendingUp },
  on_hold:   { label: "On Hold",   color: "#D97706", bg: "#FFFBEB", icon: PauseCircle },
  completed: { label: "Completed", color: "#2563EB", bg: "#EFF6FF", icon: CheckCircle2 },
  at_risk:   { label: "At Risk",   color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "#DC2626", bg: "#FEF2F2" },
  high:     { label: "High",     color: "#D97706", bg: "#FFFBEB" },
  medium:   { label: "Medium",   color: "#2563EB", bg: "#EFF6FF" },
  low:      { label: "Low",      color: "#059669", bg: "#ECFDF5" },
};

const DIVISION_COLORS: Record<string, string> = {
  EO: "#991B1B", GAD: "#D97706", GRO: "#245C5A", BHC: "#C45C4A",
};

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_PROJECTS: StrategicProject[] = [
  { id: "SP-001", name: "EHR Integration v3.0", owner: "Michael Foster", division: "EO", startDate: "2025-01-15", targetDate: "2025-12-31", status: "active", progress: 65, priority: "critical", budget: 450000, description: "Full EHR system integration with clinical workflows" },
  { id: "SP-002", name: "Campus Expansion", owner: "Synthetic-Person-001 Williams", division: "GAD", startDate: "2024-06-01", targetDate: "2026-06-01", status: "active", progress: 40, priority: "high", budget: 2800000, description: "New residential facility with 48 beds" },
  { id: "SP-003", name: "Telehealth Platform", owner: "Dr. Synthetic Youth 035", division: "BHC", startDate: "2025-03-01", targetDate: "2025-09-30", status: "at_risk", progress: 35, priority: "critical", budget: 320000, description: "Remote therapy and psychiatry services" },
  { id: "SP-004", name: "Staff Training Portal", owner: "Aisha Patel", division: "EO", startDate: "2025-02-01", targetDate: "2025-08-15", status: "active", progress: 78, priority: "medium", budget: 85000, description: "Unified training and certification tracking" },
  { id: "SP-005", name: "GRO Safety Audit", owner: "James Rodriguez", division: "GRO", startDate: "2025-05-01", targetDate: "2025-07-31", status: "completed", progress: 100, priority: "high", budget: 45000, description: "Comprehensive safety and compliance review" },
  { id: "SP-006", name: "Revenue Cycle Optimization", owner: "Rachel Kim", division: "EO", startDate: "2025-04-01", targetDate: "2025-10-31", status: "active", progress: 52, priority: "high", budget: 180000, description: "Claims processing and denial management overhaul" },
  { id: "SP-007", name: "AI Documentation Assistant", owner: "Dr. Synthetic Youth 035", division: "BHC", startDate: "2025-06-01", targetDate: "2026-03-31", status: "planning", progress: 10, priority: "medium", budget: 250000, description: "AI-powered clinical documentation helper" },
  { id: "SP-008", name: "Family Portal", owner: "Synthetic-Person-001 Williams", division: "BHC", startDate: "2025-01-01", targetDate: "2025-11-30", status: "on_hold", progress: 30, priority: "low", budget: 120000, description: "Secure family communication and visit scheduling" },
  { id: "SP-009", name: "Compliance Automation", owner: "David Thompson", division: "GAD", startDate: "2025-03-15", targetDate: "2025-09-15", status: "active", progress: 60, priority: "high", budget: 175000, description: "Automated compliance monitoring and alerts" },
  { id: "SP-010", name: "CANS Digital Workflow", owner: "Dr. Synthetic Youth 035", division: "BHC", startDate: "2024-09-01", targetDate: "2025-07-01", status: "completed", progress: 100, priority: "critical", budget: 95000, description: "Digital CANS assessment and auto-scoring" },
];

// ─── Sort ──────────────────────────────────────────────────────
type SortField = "name" | "owner" | "startDate" | "targetDate" | "status" | "progress";
type SortDir = "asc" | "desc";

function renderSortIcon(field: SortField, activeField: SortField, direction: SortDir) {
  if (activeField !== field) {
    return <ArrowUpDown size={12} className="ml-1" style={{ color: "#9CA3AF" }} />;
  }
  return direction === "asc"
    ? <ArrowUp size={12} className="ml-1" style={{ color: "#245C5A" }} />
    : <ArrowDown size={12} className="ml-1" style={{ color: "#245C5A" }} />;
}

export default function StrategicProjectsPage() {
  const [projects] = useState<StrategicProject[]>(DEMO_PROJECTS);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [divisionFilter, setDivisionFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selectedProject, setSelectedProject] = useState<StrategicProject | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let r = [...projects];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        x.owner.toLowerCase().includes(q) ||
        x.description.toLowerCase().includes(q) ||
        x.id.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== "all") r = r.filter((x) => x.status === statusFilter);
    if (divisionFilter !== "all") r = r.filter((x) => x.division === divisionFilter);
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "owner": cmp = a.owner.localeCompare(b.owner); break;
        case "startDate": cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime(); break;
        case "targetDate": cmp = new Date(a.targetDate).getTime() - new Date(b.targetDate).getTime(); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "progress": cmp = a.progress - b.progress; break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [projects, searchQuery, statusFilter, divisionFilter, sortField, sortDir]);

  const kpiCounts = useMemo(() => ({
    active: projects.filter((r) => r.status === "active").length,
    onTrack: projects.filter((r) => r.status === "active" && r.progress >= 50).length,
    atRisk: projects.filter((r) => r.status === "at_risk").length,
    completed: projects.filter((r) => r.status === "completed").length,
  }), [projects]);

  const hasFilters = searchQuery || statusFilter !== "all" || divisionFilter !== "all";

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <Target size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Strategic Projects</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Track and manage strategic initiatives across all divisions
            </p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Projects", value: kpiCounts.active, color: "#2563EB", bg: "#EFF6FF", icon: Target },
          { label: "On Track", value: kpiCounts.onTrack, color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
          { label: "At Risk", value: kpiCounts.atRisk, color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
          { label: "Completed", value: kpiCounts.completed, color: "#7C3AED", bg: "#F5F3FF", icon: CheckCircle2 },
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
            placeholder="Search project, owner, ID..."
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
          <select value={divisionFilter} onChange={(e) => setDivisionFilter(e.target.value)} className="text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Divisions</option>
            <option value="EO">Executive Office</option>
            <option value="GAD">General Admin</option>
            <option value="GRO">GRO Residential</option>
            <option value="BHC">Behavioral Health</option>
          </select>
          {hasFilters && (
            <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDivisionFilter("all"); }} className="flex items-center gap-1 text-[11px] px-3 py-2 rounded-md border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>
              <Filter size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-3">
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Showing {filtered.length} of {projects.length} projects</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("name")}>
                  <span className="flex items-center">Project {renderSortIcon("name", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("owner")}>
                  <span className="flex items-center">Owner {renderSortIcon("owner", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Division</th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("startDate")}>
                  <span className="flex items-center">Start Date {renderSortIcon("startDate", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("targetDate")}>
                  <span className="flex items-center">Target Date {renderSortIcon("targetDate", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("status")}>
                  <span className="flex items-center">Status {renderSortIcon("status", sortField, sortDir)}</span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Progress</th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const stCfg = STATUS_CONFIG[p.status];
                const StatusIcon = stCfg.icon;
                const divColor = DIVISION_COLORS[p.division] || "#6B7280";
                return (
                  <tr key={p.id} className="border-b hover:bg-black/[0.02] transition-colors" style={{ borderColor: "var(--card-border)" }}>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{p.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{p.id}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[11px] font-medium">{p.owner}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: divColor + "15", color: divColor }}>{p.division}</span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {p.startDate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {p.targetDate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        <StatusIcon size={10} /> {stCfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                          <div className="h-full rounded-full" style={{ width: `${p.progress}%`, backgroundColor: p.progress >= 75 ? "#059669" : p.progress >= 40 ? "#D97706" : "#DC2626" }} />
                        </div>
                        <span className="text-[10px] font-medium">{p.progress}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button onClick={() => setSelectedProject(p)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium cursor-pointer" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                        <Eye size={10} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <Target size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No projects match your filters</p>
                    <button onClick={() => { setSearchQuery(""); setStatusFilter("all"); setDivisionFilter("all"); }} className="text-[11px] mt-1 underline cursor-pointer" style={{ color: "#245C5A" }}>Clear all filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{selectedProject.name}</h3>
                <button onClick={() => setSelectedProject(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>ID</span>
                  <span className="text-[11px] font-mono">{selectedProject.id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Owner</span>
                  <span className="text-[12px] font-medium">{selectedProject.owner}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Division</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: (DIVISION_COLORS[selectedProject.division] || "#6B7280") + "15", color: DIVISION_COLORS[selectedProject.division] || "#6B7280" }}>{selectedProject.division}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Status</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: STATUS_CONFIG[selectedProject.status].bg, color: STATUS_CONFIG[selectedProject.status].color }}>
                    {STATUS_CONFIG[selectedProject.status].label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Priority</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: PRIORITY_CONFIG[selectedProject.priority].bg, color: PRIORITY_CONFIG[selectedProject.priority].color }}>
                    {PRIORITY_CONFIG[selectedProject.priority].label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Budget</span>
                  <span className="text-[12px] font-medium">${selectedProject.budget.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Progress</span>
                  <span className="text-[12px] font-bold" style={{ color: selectedProject.progress >= 75 ? "#059669" : selectedProject.progress >= 40 ? "#D97706" : "#DC2626" }}>{selectedProject.progress}%</span>
                </div>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                  <div className="h-full rounded-full" style={{ width: `${selectedProject.progress}%`, backgroundColor: selectedProject.progress >= 75 ? "#059669" : selectedProject.progress >= 40 ? "#D97706" : "#DC2626" }} />
                </div>
                <p className="text-[12px] p-2.5 rounded" style={{ backgroundColor: "#F9FAFB", color: "var(--topbar-title)" }}>{selectedProject.description}</p>
              </div>
              <button onClick={() => setSelectedProject(null)} className="mt-4 w-full px-4 py-2 rounded-lg text-[12px] font-medium border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
