import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Target, Plus, Search, ChevronRight, Clock, CheckCircle2, PauseCircle, XCircle, TrendingUp, Users, DollarSign,
  Calendar, Flag, Briefcase,
} from "lucide-react";
import {
  isRecord,
  readBoolean,
  readNumber,
  readString,
  toRecords,
} from "@/components/data/record-utils";

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "#DC2626", bg: "#FEF2F2" },
  high: { label: "High", color: "#D97706", bg: "#FFFBEB" },
  medium: { label: "Medium", color: "#2563EB", bg: "#EFF6FF" },
  low: { label: "Low", color: "#059669", bg: "#ECFDF5" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  planning: { label: "Planning", color: "#7C3AED", bg: "#F5F3FF", icon: Clock },
  active: { label: "Active", color: "#059669", bg: "#ECFDF5", icon: TrendingUp },
  on_hold: { label: "On Hold", color: "#D97706", bg: "#FFFBEB", icon: PauseCircle },
  completed: { label: "Completed", color: "#2563EB", bg: "#EFF6FF", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6", icon: XCircle },
};

const DIVISION_COLORS: Record<string, string> = {
  EO: "#991B1B", GAD: "#D97706", GRO: "#245C5A", BHC: "#C45C4A",
};

const DIVISION_LABELS: Record<string, string> = {
  EO: "Executive Office", GAD: "General Admin", GRO: "GRO Residential", BHC: "Behavioral Health",
};

type ProjectDivision = "EO" | "GAD" | "GRO" | "BHC";
type ProjectPriority = "critical" | "high" | "medium" | "low";

interface ProjectMilestone {
  label: string;
  done: boolean;
}

interface StrategicProject {
  id: string;
  name: string;
  description: string;
  owner: string;
  division: string;
  priority: string;
  status: string;
  startDate: string;
  targetDate: string;
  budget: number;
  progress: number;
  milestones: ProjectMilestone[];
}

function normalizeProject(value: Record<string, unknown>): StrategicProject | null {
  const id = readString(value, "id");
  if (!id) return null;
  const milestones = toRecords(value.milestones).flatMap((milestone) => {
    const label = readString(milestone, "label");
    return label ? [{ label, done: readBoolean(milestone, "done") }] : [];
  });
  return {
    id,
    name: readString(value, "name", "Untitled project"),
    description: readString(value, "description"),
    owner: readString(value, "owner", "Unassigned"),
    division: readString(value, "division", "EO"),
    priority: readString(value, "priority", "medium"),
    status: readString(value, "status", "planning"),
    startDate: readString(value, "startDate", readString(value, "start_date")),
    targetDate: readString(value, "targetDate", readString(value, "target_date")),
    budget: readNumber(value, "budget"),
    progress: readNumber(value, "progress"),
    milestones,
  };
}

export function StrategicProjectsHubPage() {
  const [search, setSearch] = useState("");
  const [divisionFilter, setDivisionFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  const { data: projectsData, refetch } = trpc.analytics.listStrategicProjects.useQuery();
  const { data: rawProjectDetail } = trpc.analytics.getStrategicProject.useQuery(
    { id: selectedProject ?? "" },
    { enabled: !!selectedProject }
  );
  const createMutation = trpc.analytics.createStrategicProject.useMutation({
    onSuccess: () => { setShowCreateForm(false); refetch(); },
  });
  const updateMutation = trpc.analytics.updateProjectProgress.useMutation({
    onSuccess: () => refetch(),
  });

  const allProjects = toRecords(projectsData).flatMap((project) => {
    const normalized = normalizeProject(project);
    return normalized ? [normalized] : [];
  });
  const projectDetail = isRecord(rawProjectDetail)
    ? normalizeProject(rawProjectDetail)
    : null;
  const projects = allProjects.filter((p) => {
    if (search && !p.name?.toLowerCase().includes(search.toLowerCase()) && !p.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (divisionFilter && p.division !== divisionFilter) return false;
    if (statusFilter && p.status !== statusFilter) return false;
    return true;
  });

  const activeProjects = projects.filter((p) => p.status === "active");
  const completedProjects = projects.filter((p) => p.status === "completed");
  const totalBudget = projects.reduce((sum: number, p) => sum + (p.budget ?? 0), 0);

  const [formData, setFormData] = useState({
    name: "", description: "", owner: "", division: "EO" as ProjectDivision,
    priority: "medium" as ProjectPriority,
    status: "planning" as "planning" | "active" | "on_hold" | "completed" | "cancelled",
    startDate: "", targetDate: "", budget: 0,
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Target size={22} style={{ color: "#245C5A" }} /> Strategic Projects Hub
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Initiative tracking, milestone management, and portfolio oversight
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-[13px] font-medium transition-all hover:opacity-90"
          style={{ backgroundColor: "#245C5A" }}
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Projects", value: projects.length, icon: Briefcase, color: "#245C5A" },
          { label: "Active", value: activeProjects.length, icon: TrendingUp, color: "#059669" },
          { label: "Completed", value: completedProjects.length, icon: CheckCircle2, color: "#2563EB" },
          { label: "Total Budget", value: `$${(totalBudget / 1000).toFixed(0)}K`, icon: DollarSign, color: "#D97706" },
        ].map(c => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon size={14} style={{ color: c.color }} />
                <span className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span>
              </div>
              <p className="text-[20px] font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          );
        })}
      </div>

      {/* Division Breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {["EO", "GAD", "GRO", "BHC"].map(div => {
          const divProjects = projects.filter((p) => p.division === div);
          const divActive = divProjects.filter((p) => p.status === "active");
          const divBudget = divProjects.reduce((sum: number, p) => sum + (p.budget ?? 0), 0);
          return (
            <div key={div} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: `${DIVISION_COLORS[div]}33` }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: DIVISION_COLORS[div] }} />
                <span className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{DIVISION_LABELS[div]}</span>
              </div>
              <div className="text-[18px] font-bold" style={{ color: DIVISION_COLORS[div] }}>{divProjects.length}</div>
              <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{divActive.length} active · ${(divBudget / 1000).toFixed(0)}K</div>
            </div>
          );
        })}
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="rounded-lg border p-6 w-full max-w-lg" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <h2 className="text-[16px] font-bold mb-4" style={{ color: "var(--topbar-title)" }}>Create Strategic Project</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Project Name</label>
                <input required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-[12px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} />
              </div>
              <div>
                <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Description</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border text-[12px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Owner</label>
                  <input required value={formData.owner} onChange={e => setFormData({ ...formData, owner: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-[12px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Division</label>
                  <select value={formData.division} onChange={e => setFormData({ ...formData, division: e.target.value as ProjectDivision })} className="w-full px-3 py-2 rounded-lg border text-[12px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}>
                    {["EO", "GAD", "GRO", "BHC"].map(d => <option key={d} value={d}>{DIVISION_LABELS[d]}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Priority</label>
                  <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as ProjectPriority })} className="w-full px-3 py-2 rounded-lg border text-[12px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Budget ($)</label>
                  <input type="number" value={formData.budget} onChange={e => setFormData({ ...formData, budget: Number(e.target.value) })} className="w-full px-3 py-2 rounded-lg border text-[12px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Start Date</label>
                  <input type="date" required value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-[12px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-subtitle)" }}>Target Date</label>
                  <input type="date" required value={formData.targetDate} onChange={e => setFormData({ ...formData, targetDate: e.target.value })} className="w-full px-3 py-2 rounded-lg border text-[12px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={createMutation.isPending} className="flex-1 px-4 py-2 rounded-lg text-white text-[13px] font-medium" style={{ backgroundColor: "#245C5A" }}>
                  {createMutation.isPending ? "Creating..." : "Create Project"}
                </button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="px-4 py-2 rounded-lg border text-[13px]" style={{ borderColor: "var(--card-border)", color: "var(--topbar-subtitle)" }}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
          <input type="text" placeholder="Search projects..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-lg border text-[13px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }} />
        </div>
        <select value={divisionFilter} onChange={e => setDivisionFilter(e.target.value)} className="px-3 py-2.5 rounded-lg border text-[13px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}>
          <option value="">All Divisions</option>
          {["EO", "GAD", "GRO", "BHC"].map(d => <option key={d} value={d}>{DIVISION_LABELS[d]}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="px-3 py-2.5 rounded-lg border text-[13px]" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}>
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => <option key={key} value={key}>{cfg.label}</option>)}
        </select>
      </div>

      {/* Project List + Detail Split */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Project List */}
        <div className="lg:col-span-3 space-y-2">
          {projects.length === 0 ? (
            <div className="rounded-lg border p-8 text-center" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <Briefcase size={32} className="mx-auto mb-2" style={{ color: "var(--topbar-subtitle)" }} />
              <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No projects found</p>
            </div>
          ) : (
            projects.map((project) => {
              const st = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.planning;
              const StatusIcon = st.icon;
              const pr = PRIORITY_CONFIG[project.priority] ?? PRIORITY_CONFIG.medium;
              return (
                <div
                  key={project.id}
                  className="rounded-lg border p-3 cursor-pointer transition-all hover:shadow-sm"
                  style={{
                    borderColor: selectedProject === project.id ? "#245C5A" : "var(--card-border)",
                    backgroundColor: selectedProject === project.id ? "#245C5A08" : "var(--card-bg)",
                  }}
                  onClick={() => setSelectedProject(project.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: st.bg }}>
                      <StatusIcon size={16} style={{ color: st.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-[13px] font-semibold truncate" style={{ color: "var(--topbar-title)" }}>{project.name}</p>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: pr.bg, color: pr.color }}>{pr.label}</span>
                      </div>
                      <p className="text-[11px] truncate mb-1" style={{ color: "var(--topbar-subtitle)" }}>{project.description}</p>
                      <div className="flex items-center gap-3 text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                        <span className="flex items-center gap-1">
                          <Users size={10} /> {project.owner}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar size={10} /> {new Date(project.startDate).toLocaleDateString()} — {new Date(project.targetDate).toLocaleDateString()}
                        </span>
                        {project.budget > 0 && (
                          <span className="flex items-center gap-1">
                            <DollarSign size={10} /> ${(project.budget / 1000).toFixed(0)}K
                          </span>
                        )}
                        <span className="flex items-center gap-1 font-medium" style={{ color: DIVISION_COLORS[project.division] }}>
                          <Flag size={10} /> {project.division}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span className="text-[14px] font-bold" style={{ color: st.color }}>{project.progress}%</span>
                      <ChevronRight size={14} style={{ color: "var(--topbar-subtitle)" }} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-2">
          {!selectedProject || !projectDetail ? (
            <div className="rounded-lg border p-6 text-center sticky top-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <Target size={32} className="mx-auto mb-2" style={{ color: "var(--topbar-subtitle)" }} />
              <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>Select a project</p>
              <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>Click a project to view details and manage milestones.</p>
            </div>
          ) : (
            <div className="rounded-lg border sticky top-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              {/* Detail Header */}
              <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  {(() => {
                    const st = STATUS_CONFIG[projectDetail.status] ?? STATUS_CONFIG.planning;
                    const StatusIcon = st.icon;
                    return (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1" style={{ backgroundColor: st.bg, color: st.color }}>
                        <StatusIcon size={10} /> {st.label}
                      </span>
                    );
                  })()}
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (DIVISION_COLORS[projectDetail.division] ?? "#6B7280") + "15", color: DIVISION_COLORS[projectDetail.division] ?? "#6B7280" }}>
                    {DIVISION_LABELS[projectDetail.division] ?? projectDetail.division}
                  </span>
                </div>
                <h2 className="text-[15px] font-semibold mb-1" style={{ color: "var(--topbar-title)" }}>{projectDetail.name}</h2>
                <p className="text-[12px] mb-2" style={{ color: "var(--topbar-subtitle)" }}>{projectDetail.description}</p>
                <div className="flex flex-wrap gap-3 text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <span><strong>Owner:</strong> {projectDetail.owner}</span>
                  <span><strong>Priority:</strong> {PRIORITY_CONFIG[projectDetail.priority]?.label ?? projectDetail.priority}</span>
                  {projectDetail.budget > 0 && <span><strong>Budget:</strong> ${projectDetail.budget.toLocaleString()}</span>}
                </div>
              </div>

              {/* Progress Bar */}
              <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Progress</span>
                  <span className="text-[13px] font-bold" style={{ color: "#245C5A" }}>{projectDetail.progress}%</span>
                </div>
                <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                  <div className="h-2.5 rounded-full transition-all" style={{ width: `${projectDetail.progress}%`, backgroundColor: projectDetail.progress >= 70 ? "#059669" : projectDetail.progress >= 40 ? "#D97706" : "#DC2626" }} />
                </div>
              </div>

              {/* Progress Control */}
              <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                <label className="text-[11px] font-medium mb-2 block" style={{ color: "var(--topbar-subtitle)" }}>Update Progress</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={projectDetail.progress}
                    onChange={e => updateMutation.mutate({ id: projectDetail.id, progress: Number(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-[12px] font-bold w-10 text-right">{projectDetail.progress}%</span>
                </div>
              </div>

              {/* Milestones */}
              {projectDetail.milestones && projectDetail.milestones.length > 0 && (
                <div className="p-4 border-b" style={{ borderColor: "var(--card-border)" }}>
                  <h3 className="text-[11px] font-semibold uppercase tracking-[1px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>Milestones</h3>
                  <div className="space-y-2">
                    {projectDetail.milestones.map((m, idx: number) => (
                      <div key={idx} className="flex items-center gap-2">
                        {m.done ? (
                          <CheckCircle2 size={14} style={{ color: "#059669" }} />
                        ) : (
                          <Clock size={14} style={{ color: "#94a3b8" }} />
                        )}
                        <span className="text-[12px]" style={{ color: m.done ? "#059669" : "var(--topbar-subtitle)", textDecoration: m.done ? "line-through" : "none" }}>{m.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dates */}
              <div className="p-4">
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <Calendar size={12} />
                  <span>{new Date(projectDetail.startDate).toLocaleDateString()} — {new Date(projectDetail.targetDate).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default StrategicProjectsHubPage;
