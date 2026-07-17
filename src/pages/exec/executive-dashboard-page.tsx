import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { runtimeConfig } from "@/config/runtime";
import { mayUseIsolatedFixtures } from "@/context/onboarding-context";
import { useAuth } from "@/hooks/use-auth";
import {
  Crown, Target, TrendingUp, FileText,
  ShieldAlert,
  CheckCircle2, Clock,
  Users, Home, DollarSign, AlertOctagon, Sparkles,
} from "lucide-react";

const RISK_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  critical: { bg: "#FEF2F2", border: "#fca5a5", text: "#DC2626" },
  high: { bg: "#FFF7ED", border: "#fdba74", text: "#C2410C" },
  medium: { bg: "#FFFBEB", border: "#fcd34d", text: "#B45309" },
  low: { bg: "#F0FDF4", border: "#86efac", text: "#059669" },
};

const INITIATIVE_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  on_track: { label: "On Track", color: "#059669", bg: "#ECFDF5" },
  at_risk: { label: "At Risk", color: "#D97706", bg: "#FFFBEB" },
  delayed: { label: "Delayed", color: "#DC2626", bg: "#FEF2F2" },
  completed: { label: "Completed", color: "#2563EB", bg: "#EFF6FF" },
  planning: { label: "Planning", color: "#7C3AED", bg: "#F5F3FF" },
};

const TABS = [
  { key: "overview", label: "Overview", icon: Crown },
  { key: "risk", label: "Risk Register", icon: ShieldAlert },
  { key: "decisions", label: "Strategic Decisions", icon: Target },
  { key: "initiatives", label: "Growth Initiatives", icon: TrendingUp },
  { key: "memos", label: "Board Memos", icon: FileText },
];

interface ExecutiveDashboardPageProps {
  readonly syntheticDataAllowed?: boolean;
}

function ExecutiveDataUnavailable() {
  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-950">
      <section className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <ShieldAlert className="h-8 w-8 text-cyan-700" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-bold">
          Executive operational data unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          No authoritative risk, decision, initiative, or board-memo records
          are available. Production does not substitute demonstration records
          or synthetic personnel.
        </p>
      </section>
    </main>
  );
}

export function ExecutiveDashboardPage(props: ExecutiveDashboardPageProps) {
  if (props.syntheticDataAllowed !== undefined) {
    return props.syntheticDataAllowed ? (
      <SyntheticExecutiveDashboard />
    ) : (
      <ExecutiveDataUnavailable />
    );
  }
  return <AuthenticatedExecutiveDashboard />;
}

function AuthenticatedExecutiveDashboard() {
  const { workspace } = useAuth();
  return mayUseIsolatedFixtures(runtimeConfig.evaluationMode, workspace) ? (
    <SyntheticExecutiveDashboard />
  ) : (
    <ExecutiveDataUnavailable />
  );
}

function SyntheticExecutiveDashboard() {
  const [activeTab, setActiveTab] = useState("overview");

  const { data: execSummary } = trpc.analytics.executiveSummary.useQuery();
  const { data: workforce } = trpc.analytics.workforceOverview.useQuery();
  const { data: revenue } = trpc.analytics.revenueOverview.useQuery();
  const { data: residential } = trpc.analytics.residentialOverview.useQuery();
  const { data: clinical } = trpc.analytics.clinicalOverview.useQuery();

  // Seed data for executive command
  const riskItems = [
    { id: "r1", title: "Facility licensing delay — New Facility Phase 2", category: "Regulatory", level: "high" as const, likelihood: "likely", impact: "high", owner: "Demo Executive", mitigation: "Expedited HHSC application with consultant support. Target: Q3 approval.", status: "open", createdAt: "2026-06-15" },
    { id: "r2", title: "CANS backlog — 1 youth pending assessment > 30 days", category: "Clinical", level: "medium" as const, likelihood: "certain", impact: "medium", owner: "Demo Clinical Director", mitigation: "Dedicated assessment session scheduled. CANS completion by 7/10.", status: "open", createdAt: "2026-06-20" },
    { id: "r3", title: "Revenue collection rate below 80% target", category: "Financial", level: "high" as const, likelihood: "likely", impact: "high", owner: "Demo Clinical Lead", mitigation: "Denial appeal process tightened. Missing documentation tracker deployed.", status: "open", createdAt: "2026-05-01" },
    { id: "r4", title: "Staff vacancy — 4 open clinical positions", category: "Workforce", level: "critical" as const, likelihood: "certain", impact: "high", owner: "HR Lead", mitigation: "Active recruitment across 3 channels. 2 candidates in final interview stage.", status: "open", createdAt: "2026-04-10" },
    { id: "r5", title: "Controlled substance count discrepancy (resolved)", category: "Operational", level: "low" as const, likelihood: "unlikely", impact: "medium", owner: "Synthetic Staff 01", mitigation: "Dual-count protocol reinforced. Witness requirement verified. No recurrence.", status: "closed", createdAt: "2026-06-10" },
    { id: "r6", title: "CBC engagement timeline — contract negotiation", category: "Strategic", level: "medium" as const, likelihood: "possible", impact: "high", owner: "Demo Executive", mitigation: "Legal review scheduled. Partnership framework draft in progress.", status: "open", createdAt: "2026-06-01" },
  ];

  const decisions = [
    { id: "d1", title: "Approve New Facility Phase 2 activation", context: "Campus expansion from 12 to 28 operational beds.", decision: "Approved with conditions", decidedBy: "Demo Executive", decidedAt: "2026-06-28", impact: "High", status: "implemented", relatedRisks: ["r1"] },
    { id: "d2", title: "Implement AMOS-Coach for staff training", context: "Wave 2 persona activation for competency tracking.", decision: "Approved", decidedBy: "Demo Executive", decidedAt: "2026-06-25", impact: "Medium", status: "in_progress", relatedRisks: [] },
    { id: "d3", title: "Engage CBC for faith-based partnership", context: "Community engagement initiative for youth support network.", decision: "Pursue", decidedBy: "Demo Executive", decidedAt: "2026-06-20", impact: "High", status: "in_progress", relatedRisks: ["r6"] },
    { id: "d4", title: "Upgrade GRO to 24/7 nursing coverage", context: "Clinical review recommended full-time nursing for residential.", decision: "Deferred to Q3 budget", decidedBy: "Demo Executive", decidedAt: "2026-06-15", impact: "High", status: "deferred", relatedRisks: ["r4"] },
  ];

  const initiatives = [
    { id: "i1", name: "CBC Faith-Based Partnership", description: "Community engagement with Covenant Bible Church for mentorship, family support, and volunteer programs.", status: "on_track" as const, progress: 65, owner: "Demo Executive", startDate: "2026-04-01", targetDate: "2026-09-30", milestones: [{ label: "Initial contact", done: true }, { label: "MOU draft", done: true }, { label: "Legal review", done: false }, { label: "Board approval", done: false }, { label: "Launch", done: false }] },
    { id: "i2", name: "GRO Residential Launch", description: "48-bed residential treatment campus with phased activation. Current: 12 beds operational.", status: "on_track" as const, progress: 38, owner: "Operations", startDate: "2026-01-01", targetDate: "2026-12-31", milestones: [{ label: "Phase 1 (12 beds)", done: true }, { label: "Phase 2 (16 beds)", done: false }, { label: "Phase 3 (16 beds)", done: false }, { label: "Phase 4 (4 beds)", done: false }, { label: "Full activation", done: false }] },
    { id: "i3", name: "BHC Clinical Expansion", description: "Expand BHC services to include outpatient and crisis stabilization programs.", status: "at_risk" as const, progress: 45, owner: "Demo Clinical Director", startDate: "2026-03-01", targetDate: "2026-10-31", milestones: [{ label: "Outpatient licensure", done: true }, { label: "Crisis protocol draft", done: true }, { label: "Staff hiring (4 roles)", done: false }, { label: "Pilot launch", done: false }] },
    { id: "i4", name: "AMOS-OPS Full Deployment", description: "Enterprise intranet rollout across all 13 personas and 8 workflows.", status: "on_track" as const, progress: 72, owner: "AMOS II / Demo Executive", startDate: "2026-01-01", targetDate: "2026-08-31", milestones: [{ label: "Sprint 1 complete", done: true }, { label: "Sprint 2 complete", done: true }, { label: "Sprint 3 in progress", done: true }, { label: "Pilot activation", done: false }, { label: "Production handoff", done: false }] },
    { id: "i5", name: "Revenue Cycle Optimization", description: "Target 85% collection rate through denial management and documentation improvements.", status: "delayed" as const, progress: 30, owner: "Demo Clinical Lead", startDate: "2026-05-01", targetDate: "2026-09-30", milestones: [{ label: "Denial analysis", done: true }, { label: "Process redesign", done: false }, { label: "Staff training", done: false }, { label: "Target achievement", done: false }] },
  ];

  const memos = [
    { id: "bm1", title: "Q2 2026 Operational Brief", date: "2026-06-30", author: "Demo Executive", classification: "Board", summary: "Campus at 58% occupancy (7/12 beds). Revenue collection at 77%, targeting 85% by Q3. 4 clinical vacancies open. CBC partnership progressing through legal review. AMOS-OPS Sprint 3 on track for August delivery.", status: "published" },
    { id: "bm2", title: "Risk Register Update — July 2026", date: "2026-07-01", author: "AMOS-Sentinel", classification: "Executive", summary: "6 active risks identified. Critical: 4 open clinical positions affecting shift coverage. High: Revenue collection below target, facility licensing timeline tight. Medium: CANS backlog, CBC negotiation. All risks have active mitigation plans.", status: "published" },
    { id: "bm3", title: "Strategic Growth Roadmap", date: "2026-06-15", author: "Demo Executive", classification: "Board", summary: "3 growth initiatives active: CBC partnership (65% complete), GRO residential launch (38% complete), BHC clinical expansion (45% complete, at-risk due to hiring). Recommend prioritizing clinical hiring to prevent service delay.", status: "review" },
    { id: "bm4", title: "Incident Summary — June 2026", date: "2026-06-30", author: "AMOS-Sentinel", classification: "Board", summary: "4 incidents this month: 2 behavioral (resolved), 1 medication error (no harm, protocol reinforced), 1 equipment failure (replaced). All corrective actions on track. No repeat incidents.", status: "published" },
  ];

  const openRisks = riskItems.filter(r => r.status === "open");
  const criticalHighRisks = openRisks.filter(r => r.level === "critical" || r.level === "high");

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="mb-6">
        <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
          <Crown size={22} style={{ color: "#1a1a2e" }} /> Executive Command
        </h1>
        <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
          Risk register, strategic decisions, growth initiatives, and board intelligence
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
            {tab.key === "risk" && openRisks.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: criticalHighRisks.length > 0 ? "#FEF2F2" : "#FFFBEB", color: criticalHighRisks.length > 0 ? "#DC2626" : "#B45309" }}>
                {openRisks.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          OVERVIEW TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Enterprise Status Banner */}
          {execSummary && (
            <div className="rounded-lg border p-4" style={{
              backgroundColor: execSummary.riskLevel === "low" ? "#ECFDF5" : execSummary.riskLevel === "critical" ? "#FEF2F2" : "#FFFBEB",
              borderColor: execSummary.riskLevel === "low" ? "#86efac" : execSummary.riskLevel === "critical" ? "#fca5a5" : "#fcd34d",
            }}>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} style={{ color: execSummary.riskLevel === "low" ? "#059669" : execSummary.riskLevel === "critical" ? "#DC2626" : "#D97706" }} />
                  <span className="text-[13px] font-semibold">Enterprise Status:</span>
                  <span className="text-[13px] font-bold capitalize" style={{ color: execSummary.riskLevel === "low" ? "#059669" : execSummary.riskLevel === "critical" ? "#DC2626" : "#D97706" }}>
                    {execSummary.operationalStatus}
                  </span>
                </div>
                <div className="flex flex-wrap gap-3">
                  <span className="text-[11px]"><strong style={{ color: "#DC2626" }}>{execSummary.criticalAlerts}</strong> critical</span>
                  <span className="text-[11px]"><strong>{execSummary.modulesOnline}/{execSummary.modulesTotal}</strong> modules</span>
                  <span className="text-[11px]"><strong>{execSummary.complianceScore}%</strong> compliance</span>
                  <span className="text-[11px]"><strong>{criticalHighRisks.length}</strong> risks (crit/high)</span>
                </div>
              </div>
            </div>
          )}

          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Youth in Care", value: clinical?.activeYouth ?? 0, icon: Users, color: "#2563EB", sub: "Active" },
              { label: "Campus Occupancy", value: `${residential?.occupancyRate ?? 0}%`, icon: Home, color: "#059669", sub: `${residential?.occupiedBeds ?? 0}/${residential?.operationalBeds ?? 0} beds` },
              { label: "Revenue MTD", value: `$${((revenue?.totalCollected ?? 0) / 1000).toFixed(0)}K`, icon: DollarSign, color: "#245C5A", sub: `${revenue?.collectionRate ?? 0}% collected` },
              { label: "Headcount", value: workforce?.total ?? 0, icon: Users, color: "#7C3AED", sub: `${workforce?.employees ?? 0} employees` },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <div className="flex items-center gap-2 mb-1">
                  <c.icon size={14} style={{ color: c.color }} />
                  <span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span>
                </div>
                <div className="text-[20px] font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Open Risks", value: openRisks.length, color: criticalHighRisks.length > 0 ? "#DC2626" : "var(--topbar-title)" },
              { label: "Active Decisions", value: decisions.filter(d => d.status === "in_progress").length, color: "#2563EB" },
              { label: "Growth Initiatives", value: initiatives.filter(i => i.status === "on_track").length, total: initiatives.length, color: "#059669" },
              { label: "Board Memos", value: memos.filter(m => m.status === "published").length, total: memos.length, color: "#7C3AED" },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-[18px] font-bold" style={{ color: c.color }}>{c.value}</span>
                  {c.total !== undefined && <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>/ {c.total}</span>}
                </div>
              </div>
            ))}
          </div>

          {/* Risk Alert Cards */}
          {criticalHighRisks.length > 0 && (
            <div>
              <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <AlertOctagon size={14} style={{ color: "#DC2626" }} /> Priority Risks Requiring Attention
              </h3>
              <div className="space-y-2">
                {criticalHighRisks.map(r => {
                  const rc = RISK_COLORS[r.level];
                  return (
                    <div key={r.id} className="rounded-lg border p-3" style={{ backgroundColor: rc.bg, borderColor: rc.border }}>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: rc.border, color: rc.text }}>{r.level}</span>
                        <span className="text-[12px] font-semibold" style={{ color: rc.text }}>{r.title}</span>
                      </div>
                      <p className="text-[11px] mt-1" style={{ color: rc.text, opacity: 0.8 }}>{r.mitigation}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          RISK REGISTER TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "risk" && (
        <div className="space-y-3">
          {/* Risk summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {["critical", "high", "medium", "low"].map(level => {
              const count = riskItems.filter(r => r.level === level && r.status === "open").length;
              const rc = RISK_COLORS[level];
              return (
                <div key={level} className="rounded-lg border p-3 text-center" style={{ backgroundColor: rc.bg, borderColor: rc.border }}>
                  <div className="text-[20px] font-bold" style={{ color: rc.text }}>{count}</div>
                  <div className="text-[10px] font-medium uppercase" style={{ color: rc.text }}>{level} Risk{count !== 1 ? "s" : ""}</div>
                </div>
              );
            })}
          </div>

          {/* Risk items */}
          {riskItems.map(r => {
            const rc = RISK_COLORS[r.level];
            const isOpen = r.status === "open";
            return (
              <div
                key={r.id}
                className="rounded-lg border overflow-hidden"
                style={{
                  backgroundColor: isOpen ? "var(--card-bg)" : "#f8fafc",
                  borderColor: isOpen ? rc.border : "#e2e8f0",
                  opacity: isOpen ? 1 : 0.7,
                }}
              >
                <div className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: rc.bg }}>
                      <ShieldAlert size={14} style={{ color: rc.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-semibold" style={{ color: isOpen ? "var(--topbar-title)" : "var(--topbar-subtitle)" }}>{r.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase" style={{ backgroundColor: rc.border, color: rc.text }}>{r.level}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>{r.category}</span>
                        {!isOpen && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>Closed</span>}
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                        <span>Likelihood: <strong>{r.likelihood}</strong></span>
                        <span>Impact: <strong>{r.impact}</strong></span>
                        <span>Owner: <strong>{r.owner}</strong></span>
                      </div>
                      <p className="text-[11px] mt-2" style={{ color: "var(--topbar-subtitle)" }}>
                        <strong>Mitigation:</strong> {r.mitigation}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          STRATEGIC DECISIONS TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "decisions" && (
        <div className="space-y-3">
          {decisions.map(d => {
            const statusColors: Record<string, { bg: string; color: string }> = {
              implemented: { bg: "#ECFDF5", color: "#059669" },
              in_progress: { bg: "#EFF6FF", color: "#2563EB" },
              deferred: { bg: "#F3F4F6", color: "#6B7280" },
            };
            const sc = statusColors[d.status] || statusColors.deferred;
            return (
              <div key={d.id} className="rounded-lg border p-4" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#f0f6f6" }}>
                    <Target size={16} style={{ color: "#245C5A" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{d.title}</span>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.color }}>
                        {d.status.replace("_", " ")}
                      </span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ backgroundColor: d.impact === "High" ? "#FEF2F2" : "#FFFBEB", color: d.impact === "High" ? "#DC2626" : "#B45309" }}>
                        {d.impact} impact
                      </span>
                    </div>
                    <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{d.context}</p>
                    <div className="flex flex-wrap gap-3 mt-2 text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                      <span><strong>Decision:</strong> {d.decision}</span>
                      <span><strong>By:</strong> {d.decidedBy}</span>
                      <span><strong>Date:</strong> {new Date(d.decidedAt).toLocaleDateString()}</span>
                    </div>
                    {d.relatedRisks.length > 0 && (
                      <div className="flex gap-1 mt-2">
                        {d.relatedRisks.map(rid => (
                          <span key={rid} className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: "#FEF2F2", color: "#DC2626" }}>
                            Linked: {rid}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          GROWTH INITIATIVES TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "initiatives" && (
        <div className="space-y-4">
          {initiatives.map(i => {
            const st = INITIATIVE_STATUS[i.status];
            return (
              <div key={i.id} className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                {/* Header */}
                <div className="px-4 py-3 border-b" style={{ borderColor: "var(--card-border)" }}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>{i.name}</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: st.bg, color: st.color }}>{st.label}</span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{i.description}</p>
                  <div className="flex flex-wrap gap-3 mt-2 text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                    <span>Owner: <strong>{i.owner}</strong></span>
                    <span>Start: {new Date(i.startDate).toLocaleDateString()}</span>
                    <span>Target: {new Date(i.targetDate).toLocaleDateString()}</span>
                  </div>
                </div>
                {/* Progress */}
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>Progress</span>
                    <span className="text-[12px] font-bold" style={{ color: st.color }}>{i.progress}%</span>
                  </div>
                  <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                    <div className="h-2.5 rounded-full transition-all" style={{ width: `${i.progress}%`, backgroundColor: st.color }} />
                  </div>
                  {/* Milestones */}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {i.milestones.map((m, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                        style={{
                          backgroundColor: m.done ? "#ECFDF5" : "#f1f5f9",
                          color: m.done ? "#059669" : "#94a3b8",
                        }}
                      >
                        {m.done ? <CheckCircle2 size={8} /> : <Clock size={8} />}
                        {m.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          BOARD MEMOS TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "memos" && (
        <div className="space-y-3">
          {memos.map(m => {
            const classColors: Record<string, { bg: string; color: string }> = {
              Board: { bg: "#F5F3FF", color: "#7C3AED" },
              Executive: { bg: "#f0f6f6", color: "#245C5A" },
            };
            const cc = classColors[m.classification] || { bg: "#f1f5f9", color: "#64748b" };
            const statusColors: Record<string, { bg: string; color: string }> = {
              published: { bg: "#ECFDF5", color: "#059669" },
              review: { bg: "#FFFBEB", color: "#D97706" },
              draft: { bg: "#F3F4F6", color: "#6B7280" },
            };
            const sc = statusColors[m.status] || statusColors.draft;
            return (
              <div key={m.id} className="rounded-lg border overflow-hidden" style={{ backgroundColor: "var(--card-bg)", borderColor: "var(--card-border)" }}>
                <div className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: cc.bg }}>
                      <FileText size={16} style={{ color: cc.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{m.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: cc.bg, color: cc.color }}>{m.classification}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.color }}>{m.status}</span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-1 text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>
                        <span>{new Date(m.date).toLocaleDateString()}</span>
                        <span>By: {m.author}</span>
                      </div>
                      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: "var(--topbar-subtitle)" }}>
                        {m.summary}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ExecutiveDashboardPage;
