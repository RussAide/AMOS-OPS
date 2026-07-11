import { useState, useMemo } from "react";
import {
  Workflow, UserPlus, Search, Filter, ArrowRight,
  ArrowUpDown, ArrowUp, ArrowDown, Eye, Calendar,
  CheckCircle2, Clock, AlertTriangle, ClipboardCheck,
  FileText, ShieldCheck, GraduationCap, UserCheck,
  CircleDot, X,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
interface OnboardingCandidate {
  id: string;
  name: string;
  role: string;
  department: string;
  stage: string;
  appliedDate: string;
  startDate: string;
  recruiter: string;
  notes: string;
}

// ─── Pipeline Config ───────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "application",  label: "Application",  icon: FileText,       color: "#2563EB", bg: "#EFF6FF" },
  { key: "screening",    label: "Screening",    icon: ClipboardCheck, color: "#7C3AED", bg: "#F5F3FF" },
  { key: "offer",        label: "Offer",        icon: CircleDot,      color: "#D97706", bg: "#FFFBEB" },
  { key: "clearance",    label: "Clearance",    icon: ShieldCheck,    color: "#0891B2", bg: "#CFFAFE" },
  { key: "orientation",  label: "Orientation",  icon: GraduationCap,  color: "#4F46E5", bg: "#EEF2FF" },
  { key: "active",       label: "Active",       icon: UserCheck,      color: "#059669", bg: "#ECFDF5" },
];

const STAGE_MAP = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.key, s]));

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_CANDIDATES: OnboardingCandidate[] = [
  { id: "1", name: "Alex Rivera", role: "Youth Care Worker", department: "GRO", stage: "application", appliedDate: "2025-06-01", startDate: "2025-07-15", recruiter: "Aisha Patel", notes: "Former teacher, great references" },
  { id: "2", name: "Jordan Blake", role: "Case Manager", department: "BHC", stage: "screening", appliedDate: "2025-05-28", startDate: "2025-07-01", recruiter: "Aisha Patel", notes: "Passed phone screen, scheduling interview" },
  { id: "3", name: "Taylor Kim", role: "Registered Nurse", department: "Clinical", stage: "offer", appliedDate: "2025-05-15", startDate: "2025-06-30", recruiter: "Aisha Patel", notes: "Offer extended, awaiting acceptance" },
  { id: "4", name: "Morgan Lee", role: "Residential Counselor", department: "GRO", stage: "clearance", appliedDate: "2025-05-10", startDate: "2025-06-20", recruiter: "Aisha Patel", notes: "Background check in progress" },
  { id: "5", name: "Casey Martinez", role: "LPHA Therapist", department: "Clinical", stage: "orientation", appliedDate: "2025-04-20", startDate: "2025-06-15", recruiter: "Aisha Patel", notes: "Scheduled for orientation week" },
  { id: "6", name: "Riley Chen", role: "QMHP Specialist", department: "Clinical", stage: "active", appliedDate: "2025-03-15", startDate: "2025-05-01", recruiter: "Aisha Patel", notes: "Onboarded successfully" },
  { id: "7", name: "Sam Thompson", role: "Facilities Tech", department: "GAD", stage: "application", appliedDate: "2025-06-10", startDate: "2025-08-01", recruiter: "Aisha Patel", notes: "Resume review pending" },
  { id: "8", name: "Drew Williams", role: "Billing Specialist", department: "Revenue", stage: "screening", appliedDate: "2025-06-05", startDate: "2025-07-20", recruiter: "Aisha Patel", notes: "Initial phone screen completed" },
  { id: "9", name: "Jamie Foster", role: "Youth Care Worker", department: "GRO", stage: "offer", appliedDate: "2025-05-22", startDate: "2025-07-10", recruiter: "Aisha Patel", notes: "Offer accepted" },
  { id: "10", name: "Quinn Adams", role: "HR Coordinator", department: "HR", stage: "clearance", appliedDate: "2025-05-18", startDate: "2025-06-25", recruiter: "Aisha Patel", notes: "References verified, awaiting fingerprinting" },
];

// ─── Sort ──────────────────────────────────────────────────────
type SortField = "name" | "role" | "stage" | "appliedDate" | "startDate";
type SortDir = "asc" | "desc";

export default function OnboardingFlowPage() {
  const [candidates] = useState<OnboardingCandidate[]>(DEMO_CANDIDATES);
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("appliedDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [selectedCandidate, setSelectedCandidate] = useState<OnboardingCandidate | null>(null);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    let r = [...candidates];
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((x) =>
        x.name.toLowerCase().includes(q) ||
        x.role.toLowerCase().includes(q) ||
        x.recruiter.toLowerCase().includes(q) ||
        x.department.toLowerCase().includes(q)
      );
    }
    if (stageFilter !== "all") r = r.filter((x) => x.stage === stageFilter);
    if (deptFilter !== "all") r = r.filter((x) => x.department === deptFilter);
    r.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "role": cmp = a.role.localeCompare(b.role); break;
        case "stage": cmp = a.stage.localeCompare(b.stage); break;
        case "appliedDate": cmp = new Date(a.appliedDate).getTime() - new Date(b.appliedDate).getTime(); break;
        case "startDate": cmp = new Date(a.startDate).getTime() - new Date(b.startDate).getTime(); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return r;
  }, [candidates, searchQuery, stageFilter, deptFilter, sortField, sortDir]);

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    PIPELINE_STAGES.forEach((s) => { counts[s.key] = candidates.filter((c) => c.stage === s.key).length; });
    return counts;
  }, [candidates]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={12} className="ml-1" style={{ color: "#9CA3AF" }} />;
    return sortDir === "asc"
      ? <ArrowUp size={12} className="ml-1" style={{ color: "#245C5A" }} />
      : <ArrowDown size={12} className="ml-1" style={{ color: "#245C5A" }} />;
  };

  const departments = [...new Set(candidates.map((c) => c.department))];
  const hasFilters = searchQuery || stageFilter !== "all" || deptFilter !== "all";

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <Workflow size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Onboarding Flow</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Track candidates through the hiring pipeline from application to active status
            </p>
          </div>
        </div>
        <div className="sm:ml-auto flex gap-2">
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-all hover:opacity-90" style={{ backgroundColor: "#245C5A" }}>
            <UserPlus size={14} /> Add Candidate
          </button>
        </div>
      </div>

      {/* Pipeline Visual */}
      <div className="rounded-lg border p-4 mb-6" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="flex flex-wrap items-center gap-2">
          {PIPELINE_STAGES.map((stage, idx) => {
            const Icon = stage.icon;
            const count = stageCounts[stage.key] ?? 0;
            return (
              <div key={stage.key} className="flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:shadow-sm"
                  style={{
                    backgroundColor: stageFilter === stage.key ? stage.bg : "var(--card-bg)",
                    borderColor: stageFilter === stage.key ? stage.color : "var(--card-border)",
                  }}
                  onClick={() => setStageFilter(stageFilter === stage.key ? "all" : stage.key)}
                >
                  <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: stage.bg }}>
                    <Icon size={14} style={{ color: stage.color }} />
                  </div>
                  <div>
                    <div className="text-[12px] font-semibold" style={{ color: stageFilter === stage.key ? stage.color : "var(--topbar-title)" }}>{count}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{stage.label}</div>
                  </div>
                </div>
                {idx < PIPELINE_STAGES.length - 1 && (
                  <ArrowRight size={14} style={{ color: "var(--topbar-subtitle)" }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <input
            placeholder="Search candidate, role, recruiter..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[12px] rounded-md border bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
            <option value="all">All Departments</option>
            {departments.map((d) => (<option key={d} value={d}>{d}</option>))}
          </select>
          {hasFilters && (
            <button onClick={() => { setSearchQuery(""); setStageFilter("all"); setDeptFilter("all"); }} className="flex items-center gap-1 text-[11px] px-3 py-2 rounded-md border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>
              <Filter size={12} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Results count */}
      <div className="mb-3">
        <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Showing {filtered.length} of {candidates.length} candidates</span>
      </div>

      {/* Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("name")}>
                  <span className="flex items-center">Candidate <SortIcon field="name" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("role")}>
                  <span className="flex items-center">Role / Dept <SortIcon field="role" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("stage")}>
                  <span className="flex items-center">Stage <SortIcon field="stage" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("appliedDate")}>
                  <span className="flex items-center">Applied <SortIcon field="appliedDate" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold cursor-pointer select-none whitespace-nowrap" style={{ color: "var(--topbar-subtitle)" }} onClick={() => handleSort("startDate")}>
                  <span className="flex items-center">Start Date <SortIcon field="startDate" /></span>
                </th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const stCfg = STAGE_MAP[c.stage] || PIPELINE_STAGES[0];
                const StageIcon = stCfg.icon;
                return (
                  <tr key={c.id} className="border-b hover:bg-black/[0.02] transition-colors" style={{ borderColor: "var(--card-border)" }}>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{c.name}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Recruiter: {c.recruiter}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <p className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{c.role}</p>
                      <p className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{c.department}</p>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: stCfg.bg, color: stCfg.color }}>
                        <StageIcon size={10} /> {stCfg.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {c.appliedDate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>
                        <Calendar size={10} /> {c.startDate}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      <button onClick={() => setSelectedCandidate(c)} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded font-medium cursor-pointer" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                        <Eye size={10} /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <Workflow size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No candidates match your filters</p>
                    <button onClick={() => { setSearchQuery(""); setStageFilter("all"); setDeptFilter("all"); }} className="text-[11px] mt-1 underline cursor-pointer" style={{ color: "#245C5A" }}>Clear all filters</button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCandidate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{selectedCandidate.name}</h3>
                <button onClick={() => setSelectedCandidate(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Role</span>
                  <span className="text-[12px] font-medium">{selectedCandidate.role}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Department</span>
                  <span className="text-[12px]">{selectedCandidate.department}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Stage</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded" style={{ backgroundColor: STAGE_MAP[selectedCandidate.stage]?.bg, color: STAGE_MAP[selectedCandidate.stage]?.color }}>
                    {STAGE_MAP[selectedCandidate.stage]?.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Applied</span>
                  <span className="text-[11px]">{selectedCandidate.appliedDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Target Start</span>
                  <span className="text-[11px]">{selectedCandidate.startDate}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Recruiter</span>
                  <span className="text-[11px]">{selectedCandidate.recruiter}</span>
                </div>
                <div className="p-2.5 rounded" style={{ backgroundColor: "#F9FAFB" }}>
                  <span className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Notes</span>
                  <p className="text-[12px] mt-0.5" style={{ color: "var(--topbar-title)" }}>{selectedCandidate.notes}</p>
                </div>
              </div>
              <button onClick={() => setSelectedCandidate(null)} className="mt-4 w-full px-4 py-2 rounded-lg text-[12px] font-medium border cursor-pointer" style={{ borderColor: "var(--card-border)" }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
