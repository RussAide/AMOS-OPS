import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Award, AlertTriangle, CheckCircle2, Clock, Users,
  BookOpen, ShieldCheck, TrendingUp,
  ChevronDown, ChevronUp, AlertOctagon,
} from "lucide-react";

const TRAINING_MODULES = [
  { id: "tm1", title: "HIPAA Privacy & Security", category: "Compliance", required: true, frequency: "Annual", deadline: "2026-08-15" },
  { id: "tm2", title: "42 CFR Part 2 — Confidentiality", category: "Compliance", required: true, frequency: "Annual", deadline: "2026-09-01" },
  { id: "tm3", title: "Crisis Intervention & De-escalation", category: "Clinical", required: true, frequency: "Annual", deadline: "2026-07-30" },
  { id: "tm4", title: "Medication Administration", category: "Clinical", required: true, frequency: "Annual", deadline: "2026-10-15" },
  { id: "tm5", title: "Restraint & Seclusion Protocol", category: "Clinical", required: true, frequency: "Annual", deadline: "2026-08-30" },
  { id: "tm6", title: "Youth Rights & Advocacy", category: "Compliance", required: true, frequency: "Annual", deadline: "2026-09-15" },
  { id: "tm7", title: "CANS Assessment Administration", category: "Clinical", required: true, frequency: "One-time", deadline: "2026-07-15" },
  { id: "tm8", title: "Trauma-Informed Care", category: "Clinical", required: true, frequency: "Biennial", deadline: "2026-11-01" },
  { id: "tm9", title: "Cultural Competency", category: "Professional", required: true, frequency: "Biennial", deadline: "2026-12-01" },
  { id: "tm10", title: "Facility Safety & Fire Response", category: "Safety", required: true, frequency: "Annual", deadline: "2026-08-01" },
  { id: "tm11", title: "Suicide Risk Assessment (Columbia Scale)", category: "Clinical", required: true, frequency: "Annual", deadline: "2026-09-30" },
  { id: "tm12", title: "Documentation Standards", category: "Professional", required: false, frequency: "One-time", deadline: "2026-07-30" },
  { id: "tm13", title: "Billing & Coding Basics", category: "Revenue", required: false, frequency: "One-time", deadline: "2026-10-01" },
  { id: "tm14", title: "Supervision & Leadership", category: "Professional", required: false, frequency: "Biennial", deadline: "2026-11-15" },
  { id: "tm15", title: "Incident Reporting Procedures", category: "Compliance", required: true, frequency: "Annual", deadline: "2026-08-15" },
];

const STAFF_TRAINING_STATUS = [
  { staffId: "s1", name: "Demo Clinical Director", role: "Clinical Director", modules: [
    { moduleId: "tm1", status: "completed", completedDate: "2026-01-15" },
    { moduleId: "tm2", status: "completed", completedDate: "2026-02-01" },
    { moduleId: "tm3", status: "completed", completedDate: "2026-03-10" },
    { moduleId: "tm4", status: "completed", completedDate: "2026-01-20" },
    { moduleId: "tm5", status: "completed", completedDate: "2026-04-05" },
    { moduleId: "tm6", status: "completed", completedDate: "2026-02-15" },
    { moduleId: "tm7", status: "completed", completedDate: "2026-05-01" },
    { moduleId: "tm8", status: "in_progress", completedDate: null },
    { moduleId: "tm9", status: "completed", completedDate: "2026-03-20" },
    { moduleId: "tm10", status: "completed", completedDate: "2026-01-25" },
    { moduleId: "tm11", status: "completed", completedDate: "2026-04-10" },
    { moduleId: "tm12", status: "completed", completedDate: "2026-02-01" },
    { moduleId: "tm15", status: "completed", completedDate: "2026-03-15" },
  ]},
  { staffId: "s2", name: "Demo Clinical Lead", role: "BHC Lead / Revenue", modules: [
    { moduleId: "tm1", status: "completed", completedDate: "2026-01-20" },
    { moduleId: "tm2", status: "completed", completedDate: "2026-02-10" },
    { moduleId: "tm3", status: "completed", completedDate: "2026-03-15" },
    { moduleId: "tm4", status: "overdue", completedDate: null },
    { moduleId: "tm6", status: "completed", completedDate: "2026-02-20" },
    { moduleId: "tm8", status: "pending", completedDate: null },
    { moduleId: "tm9", status: "completed", completedDate: "2026-04-01" },
    { moduleId: "tm10", status: "completed", completedDate: "2026-01-30" },
    { moduleId: "tm12", status: "completed", completedDate: "2026-02-15" },
    { moduleId: "tm13", status: "in_progress", completedDate: null },
    { moduleId: "tm15", status: "completed", completedDate: "2026-03-20" },
  ]},
  { staffId: "s3", name: "Synthetic Staff 01", role: "Residential Care Staff", modules: [
    { moduleId: "tm1", status: "completed", completedDate: "2026-02-01" },
    { moduleId: "tm2", status: "pending", completedDate: null },
    { moduleId: "tm3", status: "completed", completedDate: "2026-03-01" },
    { moduleId: "tm4", status: "completed", completedDate: "2026-01-15" },
    { moduleId: "tm5", status: "completed", completedDate: "2026-04-01" },
    { moduleId: "tm6", status: "completed", completedDate: "2026-02-10" },
    { moduleId: "tm10", status: "completed", completedDate: "2026-01-20" },
    { moduleId: "tm11", status: "completed", completedDate: "2026-05-01" },
    { moduleId: "tm15", status: "in_progress", completedDate: null },
  ]},
  { staffId: "s4", name: "Synthetic Staff 02", role: "Residential Care Staff", modules: [
    { moduleId: "tm1", status: "completed", completedDate: "2026-02-15" },
    { moduleId: "tm3", status: "completed", completedDate: "2026-03-10" },
    { moduleId: "tm4", status: "completed", completedDate: "2026-02-01" },
    { moduleId: "tm5", status: "pending", completedDate: null },
    { moduleId: "tm6", status: "completed", completedDate: "2026-02-20" },
    { moduleId: "tm10", status: "completed", completedDate: "2026-02-05" },
    { moduleId: "tm11", status: "overdue", completedDate: null },
    { moduleId: "tm15", status: "completed", completedDate: "2026-03-01" },
  ]},
  { staffId: "s5", name: "GRO Admin", role: "GRO Coordinator", modules: [
    { moduleId: "tm1", status: "completed", completedDate: "2026-01-10" },
    { moduleId: "tm2", status: "completed", completedDate: "2026-02-01" },
    { moduleId: "tm3", status: "completed", completedDate: "2026-03-01" },
    { moduleId: "tm6", status: "completed", completedDate: "2026-02-15" },
    { moduleId: "tm7", status: "pending", completedDate: null },
    { moduleId: "tm9", status: "in_progress", completedDate: null },
    { moduleId: "tm10", status: "completed", completedDate: "2026-01-20" },
    { moduleId: "tm12", status: "completed", completedDate: "2026-03-01" },
    { moduleId: "tm15", status: "completed", completedDate: "2026-02-28" },
  ]},
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  completed: { label: "Done", color: "#059669", bg: "#ECFDF5", icon: CheckCircle2 },
  in_progress: { label: "In Progress", color: "#2563EB", bg: "#EFF6FF", icon: Clock },
  pending: { label: "Pending", color: "#D97706", bg: "#FFFBEB", icon: Clock },
  overdue: { label: "Overdue", color: "#DC2626", bg: "#FEF2F2", icon: AlertTriangle },
};

const TABS = [
  { key: "overview", label: "Overview", icon: TrendingUp },
  { key: "modules", label: "Training Modules", icon: BookOpen },
  { key: "staff", label: "Staff Status", icon: Users },
  { key: "credentials", label: "Credentials", icon: ShieldCheck },
];

export function TrainingTrackerPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const { data: credDashboard } = trpc.credentials.dashboard.useQuery();

  // Compute stats
  const allStatuses = STAFF_TRAINING_STATUS.flatMap(s => s.modules);
  const completedCount = allStatuses.filter(m => m.status === "completed").length;
  const overdueCount = allStatuses.filter(m => m.status === "overdue").length;
  const inProgressCount = allStatuses.filter(m => m.status === "in_progress").length;
  const pendingCount = allStatuses.filter(m => m.status === "pending").length;
  const totalAssignments = allStatuses.length;

  // Per-staff completion
  const staffCompletion = STAFF_TRAINING_STATUS.map(s => {
    const completed = s.modules.filter(m => m.status === "completed").length;
    const total = s.modules.length;
    return { ...s, completionPct: Math.round((completed / total) * 100), completed, total };
  });

  // Module compliance
  const moduleStats = TRAINING_MODULES.map(tm => {
    const statuses = STAFF_TRAINING_STATUS.flatMap(s => s.modules.filter(m => m.moduleId === tm.id));
    const completed = statuses.filter(s => s.status === "completed").length;
    const overdue = statuses.filter(s => s.status === "overdue").length;
    const total = statuses.length;
    return { ...tm, completed, overdue, total, compliancePct: total > 0 ? Math.round((completed / total) * 100) : 0 };
  }).filter(m => categoryFilter === "all" || m.category === categoryFilter);

  // Overdue items
  const overdueItems = STAFF_TRAINING_STATUS.flatMap(s =>
    s.modules
      .filter(m => m.status === "overdue")
      .map(m => {
        const mod = TRAINING_MODULES.find(tm => tm.id === m.moduleId);
        return { staffName: s.name, staffRole: s.role, moduleTitle: mod?.title ?? m.moduleId, deadline: mod?.deadline ?? "" };
      })
  );

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <Award size={20} style={{ color: "#245C5A" }} />
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Training & Competency Tracker</h1>
        </div>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Staff training compliance, credential expiry monitoring, competency assessments
        </p>
      </div>

      {/* ─── Tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: "var(--card-border)" }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors flex-shrink-0"
            style={{
              borderColor: activeTab === tab.key ? "#245C5A" : "transparent",
              color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)",
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          OVERVIEW TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Completed", value: completedCount, color: "#059669", bg: "#ECFDF5", total: totalAssignments },
              { label: "In Progress", value: inProgressCount, color: "#2563EB", bg: "#EFF6FF", total: totalAssignments },
              { label: "Pending", value: pendingCount, color: "#D97706", bg: "#FFFBEB", total: totalAssignments },
              { label: "Overdue", value: overdueCount, color: "#DC2626", bg: "#FEF2F2", total: totalAssignments },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ backgroundColor: c.bg, borderColor: c.color + "30" }}>
                <div className="text-[11px] font-medium" style={{ color: c.color }}>{c.label}</div>
                <div className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>of {c.total} assignments</div>
              </div>
            ))}
          </div>

          {/* Staff completion summary */}
          <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
            <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Users size={14} style={{ color: "#245C5A" }} /> Staff Completion Rates
            </h3>
            <div className="space-y-3">
              {staffCompletion.map(s => (
                <div key={s.staffId} className="flex items-center gap-3">
                  <div className="w-28 text-[11px] font-medium truncate flex-shrink-0" style={{ color: "var(--topbar-title)" }}>{s.name}</div>
                  <div className="flex-1 h-3 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                    <div
                      className="h-3 rounded-full transition-all"
                      style={{ width: `${s.completionPct}%`, backgroundColor: s.completionPct >= 90 ? "#059669" : s.completionPct >= 70 ? "#D97706" : "#DC2626" }}
                    />
                  </div>
                  <div className="w-12 text-[11px] font-bold text-right flex-shrink-0" style={{ color: s.completionPct >= 90 ? "#059669" : s.completionPct >= 70 ? "#D97706" : "#DC2626" }}>
                    {s.completionPct}%
                  </div>
                  <div className="text-[9px] flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>{s.completed}/{s.total}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Credential alerts */}
          {credDashboard && (credDashboard.expired > 0 || credDashboard.critical > 0) && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: "#FEF2F2", borderColor: "#fca5a5" }}>
              <h3 className="text-[13px] font-bold mb-2 flex items-center gap-2" style={{ color: "#DC2626" }}>
                <AlertOctagon size={14} /> Credential Alerts
              </h3>
              <div className="flex gap-4">
                {credDashboard.expired > 0 && <span className="text-[12px]"><strong style={{ color: "#DC2626" }}>{credDashboard.expired}</strong> expired</span>}
                {credDashboard.critical > 0 && <span className="text-[12px]"><strong style={{ color: "#D97706" }}>{credDashboard.critical}</strong> expiring</span>}
                {credDashboard.expiringSoon > 0 && <span className="text-[12px]"><strong style={{ color: "#B45309" }}>{credDashboard.expiringSoon}</strong> within 90 days</span>}
              </div>
            </div>
          )}

          {/* Overdue items */}
          {overdueItems.length > 0 && (
            <div className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
              <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <AlertTriangle size={14} style={{ color: "#DC2626" }} /> Overdue Training
              </h3>
              <div className="space-y-2">
                {overdueItems.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded border" style={{ backgroundColor: "#FEF2F2", borderColor: "#fecaca" }}>
                    <div className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#FEF2F2" }}>
                      <AlertTriangle size={12} style={{ color: "#DC2626" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[12px] font-medium truncate" style={{ color: "#DC2626" }}>{item.moduleTitle}</div>
                      <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{item.staffName} • {item.staffRole}</div>
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#fee2e2", color: "#DC2626" }}>
                      Due {new Date(item.deadline).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          TRAINING MODULES TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "modules" && (
        <div>
          {/* Category filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "Compliance", "Clinical", "Safety", "Professional", "Revenue"].map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors capitalize"
                style={{
                  backgroundColor: categoryFilter === cat ? "#245C5A" : "var(--card-bg)",
                  borderColor: categoryFilter === cat ? "#245C5A" : "var(--card-border)",
                  color: categoryFilter === cat ? "#fff" : "var(--topbar-subtitle)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {moduleStats.map(mod => (
              <div key={mod.id} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: mod.required ? "#f0f6f6" : "#f8fafc" }}>
                    <BookOpen size={14} style={{ color: mod.required ? "#245C5A" : "#94a3b8" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold" style={{ color: "var(--topbar-title)" }}>{mod.title}</span>
                      {mod.required && <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>REQUIRED</span>}
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>{mod.category}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <div className="flex-1 h-2 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                        <div className="h-2 rounded-full" style={{ width: `${mod.compliancePct}%`, backgroundColor: mod.compliancePct >= 90 ? "#059669" : mod.compliancePct >= 70 ? "#D97706" : "#DC2626" }} />
                      </div>
                      <span className="text-[10px] font-medium flex-shrink-0" style={{ color: mod.compliancePct >= 90 ? "#059669" : mod.compliancePct >= 70 ? "#D97706" : "#DC2626" }}>
                        {mod.compliancePct}%
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{mod.completed}/{mod.total} done</div>
                    {mod.overdue > 0 && <div className="text-[9px]" style={{ color: "#DC2626" }}>{mod.overdue} overdue</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STAFF STATUS TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "staff" && (
        <div className="space-y-2">
          {STAFF_TRAINING_STATUS.map(staff => {
            const isExpanded = expandedStaff === staff.staffId;
            const completionPct = Math.round((staff.modules.filter(m => m.status === "completed").length / staff.modules.length) * 100);
            const hasOverdue = staff.modules.some(m => m.status === "overdue");

            return (
              <div key={staff.staffId} className="rounded-lg border overflow-hidden" style={{ borderColor: hasOverdue ? "#fca5a5" : "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <button onClick={() => setExpandedStaff(isExpanded ? null : staff.staffId)} className="w-full px-4 py-3 flex items-center gap-3 text-left">
                  <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: hasOverdue ? "#FEF2F2" : "#f0f6f6" }}>
                    <Users size={14} style={{ color: hasOverdue ? "#DC2626" : "#245C5A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{staff.name}</div>
                    <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{staff.role} • {staff.modules.length} modules</div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <div className="text-[12px] font-bold" style={{ color: completionPct >= 90 ? "#059669" : completionPct >= 70 ? "#D97706" : "#DC2626" }}>{completionPct}%</div>
                    </div>
                    {isExpanded ? <ChevronUp size={14} style={{ color: "var(--topbar-subtitle)" }} /> : <ChevronDown size={14} style={{ color: "var(--topbar-subtitle)" }} />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3">
                    <div className="space-y-1">
                      {staff.modules.map(m => {
                        const mod = TRAINING_MODULES.find(tm => tm.id === m.moduleId);
                        const st = STATUS_CONFIG[m.status];
                        const StatusIcon = st.icon;
                        return (
                          <div key={m.moduleId} className="flex items-center gap-3 py-1.5 border-b last:border-b-0" style={{ borderColor: "var(--card-border)" }}>
                            <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: st.bg }}>
                              <StatusIcon size={12} style={{ color: st.color }} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium" style={{ color: "var(--topbar-title)" }}>{mod?.title ?? m.moduleId}</div>
                            </div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                            {m.completedDate && <span className="text-[9px] flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>{new Date(m.completedDate).toLocaleDateString()}</span>}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CREDENTIALS TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "credentials" && (
        <div className="space-y-6">
          {/* Summary */}
          {credDashboard && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Total Credentials", value: credDashboard.total, color: "#245C5A" },
                { label: "Valid", value: credDashboard.valid, color: "#059669" },
                { label: "Expiring Soon", value: credDashboard.expiringSoon, color: "#D97706" },
                { label: "Expired", value: credDashboard.expired, color: "#DC2626" },
              ].map(c => (
                <div key={c.label} className="rounded-lg border p-3 text-center" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                  <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
                  <div className="text-[20px] font-bold mt-1" style={{ color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Credential list */}
          <div>
            <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>All Credentials</h3>
            {credDashboard?.items && credDashboard.items.length > 0 ? (
              <div className="space-y-2">
                {credDashboard.items.map((cred) => {
                  const statusColors: Record<string, { bg: string; color: string }> = {
                    valid: { bg: "#ECFDF5", color: "#059669" },
                    expiring: { bg: "#FFFBEB", color: "#D97706" },
                    expired: { bg: "#FEF2F2", color: "#DC2626" },
                    pending: { bg: "#F3F4F6", color: "#6B7280" },
                  };
                  const sc = statusColors[cred.status] || statusColors.pending;
                  return (
                    <div key={cred.id} className="rounded-lg border p-3 flex items-center gap-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: sc.bg }}>
                        <ShieldCheck size={14} style={{ color: sc.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{cred.credentialType}</div>
                        <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                          {cred.licenseNumber && `License: ${cred.licenseNumber} • `}
                          {cred.issuingBody && `${cred.issuingBody} • `}
                          {cred.expiryDate && `Exp: ${new Date(cred.expiryDate).toLocaleDateString()}`}
                        </div>
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: sc.bg, color: sc.color }}>
                        {cred.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 rounded-lg border" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <ShieldCheck size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No credentials in database yet</p>
                <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Credentials will appear here when added via the API</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default TrainingTrackerPage;
