import { useState, useMemo } from "react";
import { PageLayout } from "@/components/shell/page-layout";
import { trpc } from "@/providers/trpc";
import {
  GitBranch, Play, Pause, Pencil, Trash2, Search,
  Activity, CheckCircle2, AlertCircle, ChevronDown,
  ChevronUp,
  Briefcase, Stethoscope, ShieldAlert, DollarSign, FileCheck,
  Timer,
} from "lucide-react";

/* ─── Types ─── */
type WorkflowStatus = "active" | "paused" | "draft" | "archived";
type WorkflowCategory = "HR Onboarding" | "Clinical Intake" | "Incident Response" | "Compliance Review" | "Revenue Cycle";

interface WorkflowDef {
  id: string;
  name: string;
  description: string;
  category: WorkflowCategory;
  trigger: string;
  status: WorkflowStatus;
  createdBy: string;
  createdAt: string;
  lastRun: string;
  runCount: number;
  avgDuration: string;
  icon: React.ElementType;
}

/* ─── Demo Workflow Data ─── */
const DEMO_WORKFLOWS: WorkflowDef[] = [
  {
    id: "WF-001",
    name: "New Hire Onboarding",
    description: "Automated onboarding sequence for new employees including document collection, training assignments, and credential verification.",
    category: "HR Onboarding",
    trigger: "HR record created",
    status: "active",
    createdBy: "Demo Executive",
    createdAt: "2026-01-15",
    lastRun: "2026-07-08 09:23",
    runCount: 47,
    avgDuration: "12m",
    icon: Briefcase,
  },
  {
    id: "WF-002",
    name: "Youth Clinical Intake",
    description: "Intake workflow for new youth admissions including assessment scheduling, bed assignment, and treatment plan initialization.",
    category: "Clinical Intake",
    trigger: "Admission approved",
    status: "active",
    createdBy: "Demo Clinical Director",
    createdAt: "2026-02-01",
    lastRun: "2026-07-08 08:45",
    runCount: 128,
    avgDuration: "18m",
    icon: Stethoscope,
  },
  {
    id: "WF-003",
    name: "Incident Response Protocol",
    description: "Escalation and documentation workflow for safety incidents including notifications, investigation tasks, and CAPA generation.",
    category: "Incident Response",
    trigger: "Incident report filed",
    status: "active",
    createdBy: "Demo Clinical Lead",
    createdAt: "2026-01-20",
    lastRun: "2026-07-07 16:30",
    runCount: 34,
    avgDuration: "8m",
    icon: ShieldAlert,
  },
  {
    id: "WF-004",
    name: "Compliance Audit Trail",
    description: "Automated compliance monitoring workflow that schedules audits, collects evidence, and generates deficiency reports.",
    category: "Compliance Review",
    trigger: "Scheduled monthly",
    status: "active",
    createdBy: "Demo Executive",
    createdAt: "2026-03-10",
    lastRun: "2026-07-08 06:00",
    runCount: 156,
    avgDuration: "45m",
    icon: FileCheck,
  },
  {
    id: "WF-005",
    name: "Claim Submission Pipeline",
    description: "Revenue cycle workflow for claim preparation, validation, submission, and denial management.",
    category: "Revenue Cycle",
    trigger: "Service note signed",
    status: "paused",
    createdBy: "Demo Case Manager",
    createdAt: "2026-04-05",
    lastRun: "2026-07-06 14:20",
    runCount: 892,
    avgDuration: "6m",
    icon: DollarSign,
  },
  {
    id: "WF-006",
    name: "Credential Expiry Monitor",
    description: "Proactive monitoring of staff credentials with automated alerts 30, 14, and 7 days before expiration.",
    category: "HR Onboarding",
    trigger: "Daily at 6:00 AM",
    status: "active",
    createdBy: "HR Director",
    createdAt: "2026-01-10",
    lastRun: "2026-07-08 06:00",
    runCount: 189,
    avgDuration: "3m",
    icon: FileCheck,
  },
];

/* ─── Status Config ─── */
const STATUS_CONFIG: Record<WorkflowStatus, { bg: string; color: string; label: string; icon: React.ElementType }> = {
  active:   { bg: "#ECFDF5", color: "#059669", label: "Active",   icon: Play },
  paused:   { bg: "#FFFBEB", color: "#D97706", label: "Paused",   icon: Pause },
  draft:    { bg: "#F3F4F6", color: "#6B7280", label: "Draft",    icon: Pencil },
  archived: { bg: "#FEF2F2", color: "#DC2626", label: "Archived", icon: Trash2 },
};

const CATEGORY_COLORS: Record<WorkflowCategory, string> = {
  "HR Onboarding": "#245C5A",
  "Clinical Intake": "#2563EB",
  "Incident Response": "#DC2626",
  "Compliance Review": "#D97706",
  "Revenue Cycle": "#059669",
};

/* ─── Main Component ─── */
export function WorkflowsPage() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "lastRun" | "runCount">("lastRun");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Fetch KPIs from tRPC
  const { data: kpiData } = trpc.workflow.dashboardKPIs.useQuery();
  const { data: pendingApprovalsData } = trpc.workflow.listPendingApprovals.useQuery();
  const { data: instancesData } = trpc.workflow.listInstances.useQuery();

  const activeRuleCount = kpiData && "activeRules" in kpiData && typeof kpiData.activeRules === "number"
    ? kpiData.activeRules
    : DEMO_WORKFLOWS.filter((workflow) => workflow.status === "active").length;
  const averageProcessingTime = kpiData && "avgProcessingTime" in kpiData && typeof kpiData.avgProcessingTime === "number"
    ? kpiData.avgProcessingTime
    : "4.2";
  const pendingApprovals = pendingApprovalsData ?? [];
  const instances = instancesData ?? [];

  const completedToday = instances.filter((i) => i.status === "completed").length;

  // Filter & sort workflows
  const filtered = useMemo(() => {
    let data = [...DEMO_WORKFLOWS];

    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (w) =>
          w.name.toLowerCase().includes(q) ||
          w.description.toLowerCase().includes(q) ||
          w.id.toLowerCase().includes(q) ||
          w.createdBy.toLowerCase().includes(q)
      );
    }

    if (categoryFilter !== "all") {
      data = data.filter((w) => w.category === categoryFilter);
    }

    if (statusFilter !== "all") {
      data = data.filter((w) => w.status === statusFilter);
    }

    data.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "lastRun") cmp = a.lastRun.localeCompare(b.lastRun);
      else if (sortBy === "runCount") cmp = a.runCount - b.runCount;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return data;
  }, [search, categoryFilter, statusFilter, sortBy, sortDir]);

  return (
    <PageLayout>
      <div className="px-4 md:px-6 pb-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <GitBranch size={22} style={{ color: "#245C5A" }} />
            Workflow Engine
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Design, monitor, and manage automated workflows across all operational areas
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Active Workflows", value: activeRuleCount, color: "#245C5A", bg: "#F0FDFA", icon: Activity },
            { label: "Pending Approvals", value: pendingApprovals.length, color: "#D97706", bg: "#FFFBEB", icon: AlertCircle },
            { label: "Completed Today", value: completedToday, color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
            { label: "Avg Processing Time", value: `${averageProcessingTime}m`, color: "#2563EB", bg: "#EFF6FF", icon: Timer },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="rounded-lg border p-4"
                style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: kpi.bg }}>
                    <Icon size={16} style={{ color: kpi.color }} />
                  </div>
                </div>
                <p className="text-[22px] font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                <p className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{kpi.label}</p>
              </div>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: "var(--topbar-subtitle)" }} />
            <input
              placeholder="Search workflows by name, ID, or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-[12px] rounded-md border"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Category filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-[11px] px-2 py-2 rounded-md border"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            >
              <option value="all">All Categories</option>
              {Array.from(new Set(DEMO_WORKFLOWS.map((w) => w.category))).map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-[11px] px-2 py-2 rounded-md border"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
            {/* Sort */}
            <select
              value={`${sortBy}-${sortDir}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split("-") as [typeof sortBy, typeof sortDir];
                setSortBy(field);
                setSortDir(dir);
              }}
              className="text-[11px] px-2 py-2 rounded-md border"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)", color: "var(--topbar-title)" }}
            >
              <option value="lastRun-desc">Latest Run</option>
              <option value="lastRun-asc">Oldest Run</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="runCount-desc">Most Runs</option>
            </select>
          </div>
        </div>

        {/* Workflows Table */}
        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)", width: 30 }}></th>
                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Workflow</th>
                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Category</th>
                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Trigger</th>
                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Last Run</th>
                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Runs</th>
                  <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((wf) => {
                  const stCfg = STATUS_CONFIG[wf.status];
                  const StatusIcon = stCfg.icon;
                  const CatIcon = wf.icon;
                  const isExpanded = expandedRow === wf.id;
                  return (
                    <>
                      <tr
                        key={wf.id}
                        className="border-b hover:bg-black/[0.02] transition-colors cursor-pointer"
                        style={{ borderColor: "var(--card-border)" }}
                        onClick={() => setExpandedRow(isExpanded ? null : wf.id)}
                      >
                        <td className="py-2.5 px-3">
                          {isExpanded ? <ChevronUp size={14} style={{ color: "#6B7280" }} /> : <ChevronDown size={14} style={{ color: "#6B7280" }} />}
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: CATEGORY_COLORS[wf.category] + "15" }}
                            >
                              <CatIcon size={14} style={{ color: CATEGORY_COLORS[wf.category] }} />
                            </div>
                            <div>
                              <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{wf.name}</p>
                              <p className="text-[10px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{wf.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="text-[10px] px-2 py-0.5 rounded font-medium"
                            style={{ backgroundColor: CATEGORY_COLORS[wf.category] + "15", color: CATEGORY_COLORS[wf.category] }}
                          >
                            {wf.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-[11px]" style={{ color: "var(--topbar-title)" }}>{wf.trigger}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-medium capitalize"
                            style={{ backgroundColor: stCfg.bg, color: stCfg.color }}
                          >
                            <StatusIcon size={10} /> {stCfg.label}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{wf.lastRun}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <p className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{wf.runCount.toLocaleString()}</p>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex gap-1">
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="text-[10px] px-2 py-1 rounded font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                              style={{ backgroundColor: "#F0FDFA", color: "#245C5A" }}
                              title="Edit workflow"
                            >
                              <Pencil size={10} className="inline mr-0.5" /> Edit
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); }}
                              className="text-[10px] px-2 py-1 rounded font-medium border-none cursor-pointer transition-opacity hover:opacity-80"
                              style={{ backgroundColor: wf.status === "active" ? "#FEF2F2" : "#ECFDF5", color: wf.status === "active" ? "#DC2626" : "#059669" }}
                              title={wf.status === "active" ? "Pause workflow" : "Activate workflow"}
                            >
                              {wf.status === "active" ? <Pause size={10} className="inline mr-0.5" /> : <Play size={10} className="inline mr-0.5" />}
                              {wf.status === "active" ? "Pause" : "Run"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr style={{ backgroundColor: "rgba(36,92,90,0.02)" }}>
                          <td colSpan={8} className="py-3 px-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              <div className="p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--topbar-subtitle)" }}>Description</p>
                                <p className="text-[11px]" style={{ color: "var(--topbar-title)" }}>{wf.description}</p>
                              </div>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                                  <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Created By</p>
                                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{wf.createdBy}</p>
                                </div>
                                <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                                  <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Created</p>
                                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{wf.createdAt}</p>
                                </div>
                                <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                                  <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Avg Duration</p>
                                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{wf.avgDuration}</p>
                                </div>
                                <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                                  <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Total Runs</p>
                                  <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{wf.runCount.toLocaleString()}</p>
                                </div>
                              </div>
                              <div className="p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                                <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--topbar-subtitle)" }}>Recent Activity</p>
                                <div className="space-y-1.5">
                                  {[
                                    { time: wf.lastRun, action: "Workflow executed successfully" },
                                    { time: "2026-07-07 14:30", action: "Instance completed — 3 tasks processed" },
                                    { time: "2026-07-06 09:15", action: "Scheduled trigger fired" },
                                  ].map((log, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                      <div className="w-1 h-1 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: "#245C5A" }} />
                                      <div>
                                        <p className="text-[10px]" style={{ color: "var(--topbar-title)" }}>{log.action}</p>
                                        <p className="text-[9px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{log.time}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <GitBranch size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                      <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No workflows match your filters</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Category Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(CATEGORY_COLORS).map(([cat, color]) => {
            const count = DEMO_WORKFLOWS.filter((w) => w.category === cat).length;
            return (
              <div key={cat} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                  {cat} ({count})
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </PageLayout>
  );
}

export default WorkflowsPage;
