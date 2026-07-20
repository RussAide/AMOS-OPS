import { Fragment, useState } from "react";
import {
  GitBranch,
  CheckCircle,
  XCircle,
  Activity,
  Plus,
  Search,
  FileText,
  Zap,
  TrendingUp,
  Timer,
  ChevronDown,
  ChevronUp,
  X,
  Save,
  Eye,
  ShieldAlert,
  UserPlus,
  CalendarClock,
  Bell,
  FileCheck,
  Briefcase,
  ClipboardCheck,
  BarChart3,
  Network,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────
type RuleStatus = "active" | "inactive";
type TriggerType = "manual" | "scheduled" | "event" | "webhook";
type ActionType = "notification" | "assignment" | "create_record" | "alert" | "webhook" | "calculation";

interface WorkflowRule {
  id: string;
  name: string;
  trigger: TriggerType;
  triggerDescription: string;
  action: ActionType;
  actionDescription: string;
  status: RuleStatus;
  lastRun: string;
  lastRunStatus: "success" | "failed" | "pending";
  successRate: number;
  totalExecutions: number;
  category: string;
  icon: React.ElementType;
}

// ─── Demo Data ─────────────────────────────────────────────────
const DEMO_RULES: WorkflowRule[] = [
  {
    id: "WF-001", name: "Auto-Assign Incident",
    trigger: "event", triggerDescription: "New incident report submitted",
    action: "assignment", actionDescription: "Auto-assign to on-call supervisor",
    status: "active", lastRun: "2026-07-08 10:23:14",
    lastRunStatus: "success", successRate: 99, totalExecutions: 342,
    category: "Operations", icon: Zap,
  },
  {
    id: "WF-002", name: "CAP Creation",
    trigger: "event", triggerDescription: "Audit finding marked non-compliant",
    action: "create_record", actionDescription: "Generate CAP with 30-day deadline",
    status: "active", lastRun: "2026-07-08 09:45:33",
    lastRunStatus: "success", successRate: 100, totalExecutions: 56,
    category: "Compliance", icon: ClipboardCheck,
  },
  {
    id: "WF-003", name: "Credential Expiry Alert",
    trigger: "scheduled", triggerDescription: "Daily at 6:00 AM",
    action: "notification", actionDescription: "Email HR + supervisor 30 days before expiry",
    status: "active", lastRun: "2026-07-08 06:00:00",
    lastRunStatus: "success", successRate: 98, totalExecutions: 189,
    category: "HR", icon: CalendarClock,
  },
  {
    id: "WF-004", name: "New Hire Welcome",
    trigger: "event", triggerDescription: "Employee marked as hired in HR",
    action: "notification", actionDescription: "Send welcome email + onboarding checklist",
    status: "active", lastRun: "2026-07-07 14:12:05",
    lastRunStatus: "success", successRate: 100, totalExecutions: 24,
    category: "HR", icon: UserPlus,
  },
  {
    id: "WF-005", name: "Shift Handoff Reminder",
    trigger: "scheduled", triggerDescription: "Every 8 hours at shift change",
    action: "alert", actionDescription: "Notify outgoing staff to complete handoff",
    status: "active", lastRun: "2026-07-08 06:00:00",
    lastRunStatus: "success", successRate: 96, totalExecutions: 876,
    category: "Operations", icon: Bell,
  },
  {
    id: "WF-006", name: "Safety Round Alert",
    trigger: "scheduled", triggerDescription: "Daily at 10:00 AM, 2:00 PM, 6:00 PM",
    action: "notification", actionDescription: "Alert RCS to complete safety round",
    status: "active", lastRun: "2026-07-08 10:00:00",
    lastRunStatus: "success", successRate: 94, totalExecutions: 643,
    category: "Safety", icon: ShieldAlert,
  },
  {
    id: "WF-007", name: "Part 2 Consent Renewal",
    trigger: "scheduled", triggerDescription: "Daily check for expiring consents",
    action: "create_record", actionDescription: "Generate renewal task 7 days before expiry",
    status: "active", lastRun: "2026-07-08 08:00:00",
    lastRunStatus: "success", successRate: 100, totalExecutions: 128,
    category: "Clinical", icon: FileCheck,
  },
  {
    id: "WF-008", name: "Revenue Claim Submit",
    trigger: "event", triggerDescription: "Service note signed by clinician",
    action: "webhook", actionDescription: "Submit claim to billing system via API",
    status: "active", lastRun: "2026-07-08 11:05:42",
    lastRunStatus: "success", successRate: 97, totalExecutions: 1567,
    category: "Revenue", icon: Briefcase,
  },
  {
    id: "WF-009", name: "HR Separation Checklist",
    trigger: "event", triggerDescription: "Employee status changed to terminated",
    action: "create_record", actionDescription: "Generate separation checklist + IT revocation tasks",
    status: "active", lastRun: "2026-07-01 16:30:00",
    lastRunStatus: "success", successRate: 100, totalExecutions: 3,
    category: "HR", icon: UserPlus,
  },
  {
    id: "WF-010", name: "Compliance Audit Trigger",
    trigger: "scheduled", triggerDescription: "1st of every month",
    action: "calculation", actionDescription: "Run compliance score + generate audit packet",
    status: "active", lastRun: "2026-07-01 00:00:00",
    lastRunStatus: "success", successRate: 100, totalExecutions: 7,
    category: "Compliance", icon: ClipboardCheck,
  },
  {
    id: "WF-011", name: "MGMA KPI Calculation",
    trigger: "scheduled", triggerDescription: "Daily at 11:59 PM",
    action: "calculation", actionDescription: "Calculate cost per case, LOS, readmission rates",
    status: "active", lastRun: "2026-07-07 23:59:00",
    lastRunStatus: "success", successRate: 99, totalExecutions: 189,
    category: "Analytics", icon: BarChart3,
  },
  {
    id: "WF-012", name: "NIL Entity Link",
    trigger: "event", triggerDescription: "New record created in any module",
    action: "calculation", actionDescription: "Auto-link to NIL Graph with relationship mapping",
    status: "active", lastRun: "2026-07-08 10:18:55",
    lastRunStatus: "success", successRate: 100, totalExecutions: 2341,
    category: "Technical", icon: Network,
  },
];

// ─── Config ────────────────────────────────────────────────────
const STATUS_STYLES: Record<RuleStatus, { bg: string; color: string }> = {
  active: { bg: "#ECFDF5", color: "#059669" },
  inactive: { bg: "#F3F4F6", color: "#6B7280" },
};

const RUN_STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  success: { bg: "#ECFDF5", color: "#059669" },
  failed: { bg: "#FEF2F2", color: "#DC2626" },
  pending: { bg: "#FFFBEB", color: "#D97706" },
};

const TRIGGER_LABELS: Record<TriggerType, string> = {
  manual: "Manual",
  scheduled: "Scheduled",
  event: "Event",
  webhook: "Webhook",
};

// ─── Main Component ────────────────────────────────────────────
export default function WorkflowEnginePage() {
  const [rules, setRules] = useState<WorkflowRule[]>(DEMO_RULES);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<RuleStatus | "all">("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [viewLogsFor, setViewLogsFor] = useState<string | null>(null);

  // KPIs
  const activeRules = rules.filter((r) => r.status === "active").length;
  const totalExecutionsToday = 47;
  const avgSuccessRate = Math.round(rules.reduce((acc, r) => acc + r.successRate, 0) / rules.length);
  const avgLatency = 120;

  // Filtered rules
  const filtered = rules.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        r.name.toLowerCase().includes(q) ||
        r.id.toLowerCase().includes(q) ||
        r.triggerDescription.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const toggleStatus = (id: string) => {
    setRules(rules.map((r) => (r.id === id ? { ...r, status: r.status === "active" ? "inactive" : "active" } : r)));
  };

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#245C5A" }}>
            <GitBranch size={20} color="white" />
          </div>
          <div>
            <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Workflow Engine</h1>
            <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
              Automate business rules, triggers, and system actions
            </p>
          </div>
        </div>
        <div className="sm:ml-auto">
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white cursor-pointer transition-all hover:opacity-90"
            style={{ backgroundColor: "#245C5A" }}
          >
            <Plus size={14} /> Create Rule
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Active Rules", value: activeRules, color: "#245C5A", bg: "#F0FDFA", icon: Activity },
          { label: "Executions Today", value: totalExecutionsToday, color: "#2563EB", bg: "#EFF6FF", icon: Zap },
          { label: "Success Rate", value: `${avgSuccessRate}%`, color: "#059669", bg: "#ECFDF5", icon: TrendingUp },
          { label: "Avg Latency", value: `${avgLatency}ms`, color: "#D97706", bg: "#FFFBEB", icon: Timer },
        ].map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
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
            placeholder="Search rules by name, ID, trigger, or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-[12px] rounded-md border bg-transparent"
            style={{ borderColor: "var(--card-border)" }}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "active", "inactive"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="text-[11px] px-3 py-2 rounded-md font-medium capitalize cursor-pointer border transition-all"
              style={{
                borderColor: statusFilter === s ? "#245C5A" : "var(--card-border)",
                backgroundColor: statusFilter === s ? "#F0FDFA" : "var(--card-bg)",
                color: statusFilter === s ? "#245C5A" : "var(--topbar-subtitle)",
              }}
            >
              {s === "all" ? "All Rules" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Rules Table */}
      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr style={{ borderBottom: "2px solid var(--card-border)", backgroundColor: "rgba(36,92,90,0.03)" }}>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)", width: 30 }}></th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Rule ID / Name</th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Trigger</th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Action</th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Status</th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Last Run</th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Success</th>
                <th className="text-left py-2.5 px-3 font-semibold" style={{ color: "var(--topbar-subtitle)" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rule) => {
                const stCfg = STATUS_STYLES[rule.status];
                const runCfg = RUN_STATUS_STYLES[rule.lastRunStatus];
                const IconComp = rule.icon;
                const isExpanded = expandedRow === rule.id;
                return (
                  <Fragment key={rule.id}>
                    <tr
                      className="border-b hover:bg-black/[0.02] transition-colors cursor-pointer"
                      style={{ borderColor: "var(--card-border)" }}
                      onClick={() => setExpandedRow(isExpanded ? null : rule.id)}
                    >
                      <td className="py-2.5 px-3">
                        {isExpanded ? <ChevronUp size={14} style={{ color: "#6B7280" }} /> : <ChevronDown size={14} style={{ color: "#6B7280" }} />}
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: rule.status === "active" ? "#F0FDFA" : "#F3F4F6" }}>
                            <IconComp size={14} style={{ color: rule.status === "active" ? "#245C5A" : "#9CA3AF" }} />
                          </div>
                          <div>
                            <p className="font-semibold text-[12px]" style={{ color: "var(--topbar-title)" }}>{rule.name}</p>
                            <p className="text-[10px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{rule.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}>
                          {TRIGGER_LABELS[rule.trigger]}
                        </span>
                        <p className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>{rule.triggerDescription}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <p className="text-[11px]" style={{ color: "var(--topbar-title)" }}>{rule.actionDescription}</p>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className="text-[10px] px-2 py-0.5 rounded font-medium capitalize"
                          style={{ backgroundColor: stCfg.bg, color: stCfg.color }}
                        >
                          {rule.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{rule.lastRun}</p>
                        <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: runCfg.bg, color: runCfg.color }}>
                          {rule.lastRunStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1">
                          <div className="w-12 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: "#E5E7EB" }}>
                            <div className="h-full rounded-full" style={{ width: `${rule.successRate}%`, backgroundColor: rule.successRate >= 95 ? "#059669" : rule.successRate >= 80 ? "#D97706" : "#DC2626" }} />
                          </div>
                          <span className="text-[10px] font-medium" style={{ color: rule.successRate >= 95 ? "#059669" : rule.successRate >= 80 ? "#D97706" : "#DC2626" }}>
                            {rule.successRate}%
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div className="flex gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleStatus(rule.id); }}
                            className="text-[10px] px-2 py-1 rounded font-medium cursor-pointer"
                            style={{ backgroundColor: rule.status === "active" ? "#FEF2F2" : "#ECFDF5", color: rule.status === "active" ? "#DC2626" : "#059669" }}
                          >
                            {rule.status === "active" ? "Disable" : "Enable"}
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewLogsFor(rule.id); }}
                            className="text-[10px] px-2 py-1 rounded font-medium cursor-pointer"
                            style={{ backgroundColor: "#F3F4F6", color: "#6B7280" }}
                          >
                            <Eye size={10} className="inline mr-0.5" /> Logs
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr style={{ backgroundColor: "rgba(36,92,90,0.02)" }}>
                        <td colSpan={8} className="py-3 px-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                              <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Total Executions</p>
                              <p className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>{rule.totalExecutions.toLocaleString()}</p>
                            </div>
                            <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                              <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Category</p>
                              <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{rule.category}</p>
                            </div>
                            <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                              <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Action Type</p>
                              <p className="text-[12px] font-medium capitalize" style={{ color: "var(--topbar-title)" }}>{rule.action.replace("_", " ")}</p>
                            </div>
                            <div className="p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                              <p className="text-[10px] mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>Trigger Type</p>
                              <p className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{TRIGGER_LABELS[rule.trigger]}</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center">
                    <GitBranch size={24} className="mx-auto mb-2" style={{ color: "#D1D5DB" }} />
                    <p className="text-[13px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>No rules match your filters</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Create Rule Modal ────────────────────────────────── */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                  <Plus size={16} style={{ color: "#245C5A" }} /> Create Workflow Rule
                </h3>
                <button onClick={() => setShowCreateForm(false)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <p className="text-[12px] mb-4" style={{ color: "var(--topbar-subtitle)" }}>
                Define a new automated workflow rule with trigger and action.
              </p>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Rule Name</label>
                  <input placeholder="e.g. Auto-Assign Incident" className="w-full text-[12px] rounded-md border px-3 py-2" style={{ borderColor: "var(--card-border)" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Trigger Type</label>
                    <select className="w-full text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
                      <option value="event">Event</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="manual">Manual</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Action Type</label>
                    <select className="w-full text-[12px] rounded-md border px-2 py-2 bg-transparent" style={{ borderColor: "var(--card-border)" }}>
                      <option value="notification">Notification</option>
                      <option value="assignment">Assignment</option>
                      <option value="create_record">Create Record</option>
                      <option value="alert">Alert</option>
                      <option value="webhook">Webhook</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Trigger Description</label>
                  <input placeholder="e.g. When incident report is submitted" className="w-full text-[12px] rounded-md border px-3 py-2" style={{ borderColor: "var(--card-border)" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium mb-1 block" style={{ color: "var(--topbar-title)" }}>Action Description</label>
                  <input placeholder="e.g. Assign to on-call supervisor" className="w-full text-[12px] rounded-md border px-3 py-2" style={{ borderColor: "var(--card-border)" }} />
                </div>
                <div className="pt-2 flex gap-2">
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="flex-1 flex items-center justify-center gap-1 text-[12px] font-medium py-2.5 rounded-lg text-white cursor-pointer transition-all hover:opacity-90"
                    style={{ backgroundColor: "#245C5A" }}
                  >
                    <Save size={13} /> Create Rule
                  </button>
                  <button
                    onClick={() => setShowCreateForm(false)}
                    className="px-4 py-2.5 rounded-lg text-[12px] font-medium border cursor-pointer"
                    style={{ borderColor: "var(--card-border)" }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── View Logs Modal ──────────────────────────────────── */}
      {viewLogsFor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[16px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                  <FileText size={16} style={{ color: "#245C5A" }} />
                  Execution Logs — {rules.find((r) => r.id === viewLogsFor)?.name}
                </h3>
                <button onClick={() => setViewLogsFor(null)} className="p-1 rounded cursor-pointer" style={{ backgroundColor: "#F3F4F6" }}>
                  <X size={14} />
                </button>
              </div>
              <div className="space-y-2">
                {[
                  { time: "2026-07-08 10:23:14", status: "success", message: "Rule executed successfully — assigned to Supervisor Chen" },
                  { time: "2026-07-08 09:45:33", status: "success", message: "Rule executed successfully — CAP-2026-089 created" },
                  { time: "2026-07-08 08:12:01", status: "success", message: "Rule executed successfully — notification sent to HR" },
                  { time: "2026-07-07 23:59:00", status: "success", message: "Scheduled execution — KPIs calculated and saved" },
                  { time: "2026-07-07 18:00:00", status: "success", message: "Shift handoff reminder sent to 4 staff" },
                  { time: "2026-07-07 14:30:22", status: "failed", message: "Execution failed — API timeout (retry in 5min)" },
                  { time: "2026-07-07 10:00:00", status: "success", message: "Safety round alert sent to RCS team" },
                  { time: "2026-07-07 06:00:00", status: "success", message: "Credential check completed — 2 expiring soon" },
                ].map((log, i) => (
                  <div key={i} className="flex items-start gap-3 p-2.5 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                    <div className="mt-0.5">
                      {log.status === "success" ? (
                        <CheckCircle size={12} style={{ color: "#059669" }} />
                      ) : (
                        <XCircle size={12} style={{ color: "#DC2626" }} />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px]" style={{ color: "var(--topbar-title)" }}>{log.message}</p>
                      <p className="text-[10px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{log.time}</p>
                    </div>
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-medium capitalize"
                      style={{ backgroundColor: log.status === "success" ? "#ECFDF5" : "#FEF2F2", color: log.status === "success" ? "#059669" : "#DC2626" }}
                    >
                      {log.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
