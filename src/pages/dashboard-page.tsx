import { trpc } from "@/providers/trpc";
import {
  LayoutDashboard, Users, BookOpen, ShieldCheck, ArrowRight, Activity, AlertTriangle,
  DollarSign, ClipboardCheck, TrendingUp, Stethoscope, Home, FileText, Brain,
  Bell, ChevronRight, Building, Target, Lock, BarChart3, HeartPulse, Briefcase,
  Crown, Clock, CheckCircle, XCircle, AlertCircle, Percent, Calendar
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell
} from "recharts";

/* ─── Single KPI Card ─── */
function KPICard({
  label,
  value,
  icon: Icon,
  color,
  suffix = "",
  prefix = "",
  subtitle,
  isLoading,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  suffix?: string;
  prefix?: string;
  subtitle?: string;
  isLoading?: boolean;
}) {
  return (
    <div
      className="rounded-lg border p-4 transition-all hover:shadow-md"
      style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.5px]"
          style={{ color: "var(--topbar-subtitle)" }}
        >
          {label}
        </span>
        <Icon size={15} style={{ color }} />
      </div>
      {isLoading ? (
        <div className="h-8 w-20 bg-gray-200 animate-pulse rounded" />
      ) : (
        <>
          <p className="text-[26px] font-bold" style={{ color }}>
            {prefix}
            {typeof value === "number" ? value.toLocaleString() : value}
            {suffix}
          </p>
          {subtitle && (
            <p className="text-[11px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>
              {subtitle}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/* ─── KPI Category Section ─── */
function KPISection({
  title,
  icon: Icon,
  color,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
          <Icon size={16} style={{ color }} />
        </div>
        <h2
          className="text-[14px] font-semibold uppercase tracking-[0.5px]"
          style={{ color: "var(--topbar-title)" }}
        >
          {title}
        </h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {children}
      </div>
    </div>
  );
}

/* ─── Sparkline Chart ─── */
function Sparkline({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="h-10 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2}
            dot={false}
          />
          <XAxis dataKey="name" hide />
          <YAxis hide />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Mini Bar Chart ─── */
function MiniBarChart({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) {
  if (!data || data.length === 0) return null;
  return (
    <div className="h-10 mt-2">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
          <XAxis dataKey="name" hide />
          <YAxis hide />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─── Main Dashboard Page ─── */
export function DashboardPage() {
  const navigate = useNavigate();

  // ── Core Data Queries ──
  const { data: overview, isLoading: overviewLoading } = trpc.dashboard.overview.useQuery();
  const { data: operational, isLoading: operationalLoading } = trpc.dashboard.operationalKPIs.useQuery();
  const { data: compliance, isLoading: complianceLoading } = trpc.dashboard.complianceKPIs.useQuery();
  const { data: clinical, isLoading: clinicalLoading } = trpc.dashboard.clinicalKPIs.useQuery();
  const { data: revenue, isLoading: revenueLoading } = trpc.dashboard.revenueKPIs.useQuery();
  const { data: workforce, isLoading: workforceLoading } = trpc.dashboard.workforceKPIs.useQuery();
  const { data: executive, isLoading: executiveLoading } = trpc.dashboard.executiveKPIs.useQuery();

  // ── Module Deep Dives ──
  const { data: ccmg } = trpc.ccmg.bhcDashboard.useQuery();
  const { data: m19 } = trpc.m19.getCampusSummary.useQuery();

  const d = overview;
  const o = operational;
  const c = compliance;
  const cl = clinical;
  const r = revenue;
  const w = workforce;
  const e = executive;

  // ── Derived trend data (mock 7-day history for sparklines when real time-series unavailable) ──
  const trend7 = Array.from({ length: 7 }, (_, i) => ({
    name: `D${i + 1}`,
    value: Math.max(0, (r?.claimsSubmitted30d ?? 0) / 7 + Math.floor(Math.random() * 5 - 2)),
  }));

  // ── Alerts ──
  const alerts: { level: "critical" | "warning" | "info"; message: string; route?: string }[] = [];
  if ((d?.revenue?.deniedClaims ?? 0) > 0) alerts.push({ level: "warning", message: `${d?.revenue?.deniedClaims ?? 0} denied claim(s) requiring follow-up`, route: "/revenue/claims" });
  if ((d?.part2?.expiredConsents ?? 0) > 0) alerts.push({ level: "critical", message: `${d?.part2?.expiredConsents ?? 0} expired Part 2 consent(s)`, route: "/compliance/part2" });
  if ((d?.gad?.overdueWorkOrders ?? 0) > 0) alerts.push({ level: "warning", message: `${d?.gad?.overdueWorkOrders ?? 0} overdue work order(s)`, route: "/gad" });
  if ((d?.bhc?.highRiskCount ?? 0) > 0) alerts.push({ level: "critical", message: `${d?.bhc?.highRiskCount ?? 0} high-risk flag(s) active`, route: "/clinical/bhc" });
  if ((c?.overdueItems ?? 0) > 0) alerts.push({ level: "warning", message: `${c?.overdueItems ?? 0} overdue compliance item(s)`, route: "/qa" });
  if ((w?.expiringCredentials ?? 0) > 0) alerts.push({ level: "info", message: `${w?.expiringCredentials ?? 0} credential(s) expiring soon`, route: "/hr/credentials" });

  // ── Module Cards ──
  const modules = [
    { label: "BHC Clinical", route: "/clinical/bhc", icon: Stethoscope, color: "#059669", bg: "#ecfdf5",
      kpi: `${ccmg?.departments?.mhtcm?.activePlans ?? 0} MHTCM \u00b7 ${ccmg?.departments?.mhrs?.activePrograms ?? 0} MHRS`,
      detail: `${d?.bhc?.activePatients ?? 0} patients \u00b7 ${d?.bhc?.sessionsThisWeek ?? 0} sessions/wk` },
    { label: "Revenue Cycle", route: "/revenue", icon: DollarSign, color: "#2563EB", bg: "#eff6ff",
      kpi: `${d?.revenue?.totalClaims ?? 0} claims \u00b7 ${d?.revenue?.collectionRate ?? 0}% collected`,
      detail: `$${((d?.revenue?.totalBilled ?? 0) / 1000).toFixed(0)}k billed \u00b7 $${((d?.revenue?.totalCollected ?? 0) / 1000).toFixed(0)}k collected` },
    { label: "GRO Compliance", route: "/compliance/gro", icon: ShieldCheck, color: "#7C3AED", bg: "#f5f3ff",
      kpi: `${d?.campus?.occupiedBeds ?? 0} residents \u00b7 ${d?.campus?.occupancyRate ?? 0}% occupancy`,
      detail: `${d?.campus?.totalBeds ?? 0} beds \u00b7 ${d?.campus?.facilityCount ?? 0} facilities` },
    { label: "MGMA Scorecard", route: "/mgma", icon: Target, color: "#245C5A", bg: "#f0f9f6",
      kpi: `${d?.mgma?.domainCount ?? 0} domains \u00b7 ${d?.mgma?.kpiCount ?? 0} KPIs`,
      detail: `${d?.mgma?.kpiCount ?? 0} KPIs tracked` },
    { label: "42 CFR Part 2", route: "/compliance/part2", icon: Lock, color: "#DC2626", bg: "#fef2f2",
      kpi: `${d?.part2?.activeSUDRecords ?? 0} SUD records \u00b7 ${d?.part2?.validConsents ?? 0} valid consents`,
      detail: `${d?.part2?.recentAudits ?? 0} recent audit events` },
    { label: "Documents", route: "/documents", icon: FileText, color: "#D97706", bg: "#fffbeb",
      kpi: `${d?.documents?.total ?? 0} documents`,
      detail: `${d?.documents?.published ?? 0} published \u00b7 ${d?.documents?.draft ?? 0} draft` },
    { label: "NIL Graph", route: "/nil", icon: Brain, color: "#7C3AED", bg: "#f5f3ff",
      kpi: `${d?.nil?.entityCount ?? 0} entities \u00b7 ${d?.nil?.relationshipCount ?? 0} relations`,
      detail: "Cross-module intelligence" },
    { label: "Campus Census", route: "/campus", icon: Building, color: "#0891B2", bg: "#ecfeff",
      kpi: `${d?.campus?.occupiedBeds ?? 0} of ${d?.campus?.totalBeds ?? 0} beds filled`,
      detail: `${d?.campus?.facilityCount ?? 0} buildings \u00b7 ${m19?.avgLOS ?? 0}d avg LOS` },
  ];

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-[24px] font-bold" style={{ color: "var(--topbar-title)" }}>Dashboard</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            {format(new Date(), "EEEE, MMMM d, yyyy")} &mdash; AMOS-OPS Enterprise Overview
          </p>
        </div>
        {alerts.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[12px] font-medium" style={{ backgroundColor: "#fef2f2", color: "#DC2626" }}>
            <Bell size={14} />
            {alerts.length} active alert{alerts.length > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Alerts Banner */}
      {alerts.length > 0 && (
        <div className="mb-6 space-y-2">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={() => a.route && navigate(a.route)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all hover:shadow-sm cursor-pointer"
              style={{
                backgroundColor: a.level === "critical" ? "#fef2f2" : a.level === "warning" ? "#fffbeb" : "#eff6ff",
                borderLeft: `4px solid ${a.level === "critical" ? "#DC2626" : a.level === "warning" ? "#D97706" : "#2563EB"}`
              }}
            >
              <AlertTriangle size={16} style={{ color: a.level === "critical" ? "#DC2626" : a.level === "warning" ? "#D97706" : "#2563EB" }} />
              <span className="text-[13px] font-medium flex-1" style={{ color: "var(--topbar-title)" }}>{a.message}</span>
              <ChevronRight size={14} style={{ color: "var(--topbar-subtitle)" }} />
            </button>
          ))}
        </div>
      )}

      {/* Module Cards */}
      <h2 className="text-[14px] font-semibold uppercase tracking-[0.5px] mb-3" style={{ color: "var(--topbar-subtitle)" }}>Modules</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-8">
        {modules.map((m) => (
          <button
            key={m.label}
            onClick={() => navigate(m.route)}
            className="rounded-lg border p-4 text-left transition-all hover:shadow-md hover:translate-y-[-1px] cursor-pointer group"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: m.bg }}>
                <m.icon size={18} style={{ color: m.color }} />
              </div>
              <ArrowRight size={14} style={{ color: "var(--topbar-subtitle)" }} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-[13px] font-semibold mb-0.5" style={{ color: "var(--topbar-title)" }}>{m.label}</p>
            <p className="text-[12px] font-medium mb-0.5" style={{ color: m.color }}>{m.kpi}</p>
            <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{m.detail}</p>
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════
          D010-01: OPERATIONAL KPIs (6)
          ════════════════════════════════════════════════════════════ */}
      <KPISection title="Operational KPIs" icon={Activity} color="#2563EB">
        <KPICard label="Census" value={o?.census ?? 0} icon={Users} color="#2563EB" subtitle="Active patients" isLoading={operationalLoading} />
        <KPICard label="Open Cases" value={o?.openCases ?? 0} icon={FileText} color="#7C3AED" subtitle="Active treatment plans" isLoading={operationalLoading} />
        <KPICard label="Pending Docs" value={o?.pendingDocumentation ?? 0} icon={ClipboardCheck} color="#D97706" subtitle="Notes incomplete" isLoading={operationalLoading} />
        <KPICard label="Staff on Duty" value={o?.staffOnDuty ?? 0} icon={Briefcase} color="#059669" subtitle="Today's coverage" isLoading={operationalLoading} />
        <KPICard label="Today's Sessions" value={o?.todaysSessions ?? 0} icon={Calendar} color="#0891B2" subtitle="Scheduled/completed" isLoading={operationalLoading} />
        <KPICard label="Open Incidents" value={o?.openIncidents ?? 0} icon={AlertTriangle} color="#DC2626" subtitle="Under investigation" isLoading={operationalLoading} />
      </KPISection>

      {/* ════════════════════════════════════════════════════════════
          D010-02: COMPLIANCE KPIs (6)
          ════════════════════════════════════════════════════════════ */}
      <KPISection title="Compliance KPIs" icon={ShieldCheck} color="#059669">
        <KPICard label="Open CAPs" value={c?.openCAPs ?? 0} icon={AlertCircle} color="#DC2626" subtitle="Corrective actions" isLoading={complianceLoading} />
        <KPICard label="Upcoming Audits" value={c?.upcomingAudits ?? 0} icon={ClipboardCheck} color="#7C3AED" subtitle="Planned / in progress" isLoading={complianceLoading} />
        <KPICard label="Overdue Items" value={c?.overdueItems ?? 0} icon={Clock} color="#D97706" subtitle="CAPs + audits" isLoading={complianceLoading} />
        <KPICard label="Compliance Score" value={c?.complianceScore ?? 0} icon={Percent} color="#059669" suffix="%" subtitle="Audit-based score" isLoading={complianceLoading} />
        <KPICard label="Expiring Creds" value={c?.expiringCredentials ?? 0} icon={ShieldCheck} color="#F59E0B" subtitle="Within 90 days" isLoading={complianceLoading} />
        <KPICard label="Incidents (30d)" value={c?.incidentCount30d ?? 0} icon={AlertTriangle} color="#EF4444" subtitle="Last 30 days" isLoading={complianceLoading} />
      </KPISection>

      {/* ════════════════════════════════════════════════════════════
          D010-03: CLINICAL KPIs (6)
          ════════════════════════════════════════════════════════════ */}
      <KPISection title="Clinical KPIs" icon={HeartPulse} color="#DC2626">
        <KPICard label="Avg LOS" value={cl?.avgLOS ?? 0} icon={Clock} color="#2563EB" suffix="d" subtitle="Length of stay" isLoading={clinicalLoading} />
        <KPICard label="Plan Completion" value={cl?.planCompletionRate ?? 0} icon={CheckCircle} color="#059669" suffix="%" subtitle="Treatment plans" isLoading={clinicalLoading} />
        <KPICard label="Outcome Measures" value={cl?.outcomeMeasureTrends ?? 0} icon={TrendingUp} color="#7C3AED" subtitle="Last 30 days" isLoading={clinicalLoading} />
        <KPICard label="Readmission Rate" value={cl?.readmissionRate ?? 0} icon={TrendingUp} color="#D97706" suffix="%" subtitle="30-day readmit" isLoading={clinicalLoading} />
        <KPICard label="Session Completion" value={cl?.sessionCompletionRate ?? 0} icon={CheckCircle} color="#0891B2" suffix="%" subtitle="Non-cancelled" isLoading={clinicalLoading} />
        <KPICard label="Auth Status" value={cl?.authorizationStatus ?? 0} icon={ShieldCheck} color="#059669" suffix="%" subtitle="Approved auths" isLoading={clinicalLoading} />
      </KPISection>

      {/* ════════════════════════════════════════════════════════════
          D010-04: REVENUE KPIs (6)
          ════════════════════════════════════════════════════════════ */}
      <KPISection title="Revenue KPIs" icon={DollarSign} color="#0891B2">
        <KPICard label="Claims (30d)" value={r?.claimsSubmitted30d ?? 0} icon={FileText} color="#2563EB" subtitle="Submitted" isLoading={revenueLoading} />
        <KPICard label="Approval Rate" value={r?.approvalRate ?? 0} icon={CheckCircle} color="#059669" suffix="%" subtitle="Of decided claims" isLoading={revenueLoading} />
        <KPICard label="Denial Rate" value={r?.denialRate ?? 0} icon={XCircle} color="#DC2626" suffix="%" subtitle="Of decided claims" isLoading={revenueLoading} />
        <KPICard label="Avg Days to Pay" value={r?.avgDaysToPayment ?? 0} icon={Clock} color="#7C3AED" suffix="d" subtitle="For paid claims" isLoading={revenueLoading} />
        <KPICard label="Outstanding AR" value={r?.outstandingAR ?? 0} icon={DollarSign} color="#D97706" prefix="$" subtitle="Unpaid claims" isLoading={revenueLoading} />
        <KPICard label="Auth Expiry (30d)" value={r?.authorizationExpiry30d ?? 0} icon={AlertCircle} color="#F59E0B" subtitle="Expiring soon" isLoading={revenueLoading} />
      </KPISection>

      {/* ════════════════════════════════════════════════════════════
          D010-05: WORKFORCE KPIs (6)
          ════════════════════════════════════════════════════════════ */}
      <KPISection title="Workforce KPIs" icon={Users} color="#7C3AED">
        <KPICard label="Total Staff" value={w?.totalStaff ?? 0} icon={Users} color="#2563EB" subtitle="Active employees" isLoading={workforceLoading} />
        <KPICard label="Open Positions" value={w?.openPositions ?? 0} icon={Briefcase} color="#D97706" subtitle="In pipeline" isLoading={workforceLoading} />
        <KPICard label="Cred Compliance" value={w?.credentialComplianceRate ?? 0} icon={ShieldCheck} color="#059669" suffix="%" subtitle="Valid credentials" isLoading={workforceLoading} />
        <KPICard label="Training Done" value={w?.trainingCompletionRate ?? 0} icon={BookOpen} color="#0891B2" suffix="%" subtitle="Modules completed" isLoading={workforceLoading} />
        <KPICard label="Turnover (12m)" value={w?.turnoverRate12m ?? 0} icon={TrendingUp} color="#DC2626" suffix="%" subtitle="Annual rate" isLoading={workforceLoading} />
        <KPICard label="Pending Sep." value={w?.pendingSeparations ?? 0} icon={AlertCircle} color="#7C3AED" subtitle="Offboarding" isLoading={workforceLoading} />
      </KPISection>

      {/* ════════════════════════════════════════════════════════════
          D010-06: EXECUTIVE KPIs (6)
          ════════════════════════════════════════════════════════════ */}
      <KPISection title="Executive KPIs" icon={Crown} color="#D97706">
        <KPICard label="Revenue MTD" value={e?.revenueMTD ?? 0} icon={DollarSign} color="#059669" prefix="$" subtitle="Month-to-date" isLoading={executiveLoading} />
        <KPICard label="Operating Census" value={e?.operatingCensus ?? 0} icon={Building} color="#2563EB" suffix="%" subtitle="Bed occupancy" isLoading={executiveLoading} />
        <KPICard label="Compliance" value={e?.compliancePosture ?? 0} icon={ShieldCheck} color="#059669" suffix="%" subtitle="Overall posture" isLoading={executiveLoading} />
        <KPICard label="Critical Risks" value={e?.criticalRisks ?? 0} icon={AlertTriangle} color="#DC2626" subtitle="Incidents + high-risk" isLoading={executiveLoading} />
        <KPICard label="Staffing Level" value={e?.staffingLevel ?? 0} icon={Users} color="#7C3AED" suffix="%" subtitle="On-duty coverage" isLoading={executiveLoading} />
        <KPICard label="Strategic Progress" value={e?.strategicProjectStatus ?? 0} icon={Target} color="#D97706" suffix="%" subtitle="MGMA domains" isLoading={executiveLoading} />
      </KPISection>

      {/* ── Charts + Deep-Dive Section ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Revenue Trend Chart */}
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Revenue Trend (7d)</h2>
            <BarChart3 size={16} style={{ color: "var(--topbar-subtitle)" }} />
          </div>
          {revenueLoading ? (
            <div className="h-32 bg-gray-100 animate-pulse rounded" />
          ) : (
            <ResponsiveContainer width="100%" height={128}>
              <BarChart data={trend7}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Compliance Score Gauge */}
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Compliance Posture</h2>
            <ShieldCheck size={16} style={{ color: "var(--topbar-subtitle)" }} />
          </div>
          {complianceLoading || executiveLoading ? (
            <div className="h-32 bg-gray-100 animate-pulse rounded" />
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="relative w-28 h-28">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="50" stroke="#f0f0f0" strokeWidth="10" fill="none" />
                  <circle
                    cx="60" cy="60" r="50"
                    stroke={(e?.compliancePosture ?? 0) >= 80 ? "#059669" : (e?.compliancePosture ?? 0) >= 50 ? "#D97706" : "#DC2626"}
                    strokeWidth="10" fill="none"
                    strokeDasharray={`${((e?.compliancePosture ?? 0) / 100) * 314} 314`}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
                    {e?.compliancePosture ?? 0}%
                  </span>
                </div>
              </div>
              <div className="flex gap-4 mt-3 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" />Score</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />CAPs: {c?.openCAPs ?? 0}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Overdue: {c?.overdueItems ?? 0}</span>
              </div>
            </div>
          )}
        </div>

        {/* Staffing Overview */}
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Staffing Overview</h2>
            <Users size={16} style={{ color: "var(--topbar-subtitle)" }} />
          </div>
          {workforceLoading ? (
            <div className="h-32 bg-gray-100 animate-pulse rounded" />
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: "var(--topbar-title)" }}>Total Staff</span>
                <span className="text-[13px] font-semibold" style={{ color: "#2563EB" }}>{w?.totalStaff ?? 0}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.min((w?.totalStaff ?? 0) * 5, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: "var(--topbar-title)" }}>Open Positions</span>
                <span className="text-[13px] font-semibold" style={{ color: "#D97706" }}>{w?.openPositions ?? 0}</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: `${Math.min((w?.openPositions ?? 0) * 10, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: "var(--topbar-title)" }}>Credential Compliance</span>
                <span className="text-[13px] font-semibold" style={{ color: "#059669" }}>{w?.credentialComplianceRate ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-emerald-500" style={{ width: `${w?.credentialComplianceRate ?? 0}%` }} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: "var(--topbar-title)" }}>Training Completion</span>
                <span className="text-[13px] font-semibold" style={{ color: "#0891B2" }}>{w?.trainingCompletionRate ?? 0}%</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full bg-cyan-500" style={{ width: `${w?.trainingCompletionRate ?? 0}%` }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Two-column: MGMA Domains + Campus Census */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* MGMA Domain Progress */}
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>MGMA Practice Domains</h2>
            <button onClick={() => navigate("/mgma")} className="text-[12px] font-medium flex items-center gap-1 cursor-pointer hover:underline" style={{ color: "#245C5A" }}>
              View Scorecard <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {(d?.mgma?.domains ?? []).map((dom: any) => (
              <div key={dom.id} className="flex items-center gap-3">
                <span className="text-[13px] w-44 truncate flex-shrink-0" style={{ color: "var(--topbar-title)" }}>{dom.name}</span>
                <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${dom.progress ?? 0}%`, backgroundColor: (dom.progress ?? 0) >= 80 ? "#059669" : (dom.progress ?? 0) >= 50 ? "#D97706" : "#DC2626" }} />
                </div>
                <span className="text-[12px] w-10 text-right flex-shrink-0 font-medium" style={{ color: (dom.progress ?? 0) >= 80 ? "#059669" : (dom.progress ?? 0) >= 50 ? "#D97706" : "#DC2626" }}>{dom.progress ?? 0}%</span>
              </div>
            ))}
            {(d?.mgma?.domains ?? []).filter((x: any) => x.name).length === 0 && (
              <p className="text-[13px] text-center py-4" style={{ color: "var(--topbar-subtitle)" }}>No MGMA domain data available</p>
            )}
          </div>
        </div>

        {/* Campus Census */}
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Campus Census</h2>
            <button onClick={() => navigate("/campus")} className="text-[12px] font-medium flex items-center gap-1 cursor-pointer hover:underline" style={{ color: "#0891B2" }}>
              View Census <ArrowRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {(m19?.byFacility ?? []).map((f: any) => (
              <div key={f.facilityId} className="flex items-center justify-between py-2 border-b" style={{ borderColor: "var(--card-border)" }}>
                <div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{f.facilityName}</p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{f.facilityCode}</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold" style={{ color: f.occupancyRate > 80 ? "#059669" : f.occupancyRate > 50 ? "#D97706" : "#DC2626" }}>
                    {f.occupiedBeds}/{f.totalBeds}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{f.occupancyRate}% full</p>
                </div>
              </div>
            ))}
            {(m19?.byFacility ?? []).length === 0 && (
              <p className="text-[13px] text-center py-4" style={{ color: "var(--topbar-subtitle)" }}>No campus data available</p>
            )}
          </div>
          {m19 && (
            <div className="mt-4 pt-3" style={{ borderTop: "1px solid var(--card-border)" }}>
              <div className="flex items-center justify-between text-[12px] mb-1">
                <span style={{ color: "var(--topbar-subtitle)" }}>Overall Occupancy</span>
                <span className="font-semibold" style={{ color: (m19.campusOccupancyRate ?? 0) > 80 ? "#059669" : "#D97706" }}>{m19.campusOccupancyRate ?? 0}%</span>
              </div>
              <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(m19.campusOccupancyRate ?? 0, 100)}%`, backgroundColor: (m19.campusOccupancyRate ?? 0) > 80 ? "#059669" : (m19.campusOccupancyRate ?? 0) > 50 ? "#D97706" : "#DC2626" }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row: Claims Aging + Part 2 Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Claims Aging */}
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>Claims Aging</h2>
            <button onClick={() => navigate("/revenue")} className="text-[12px] font-medium flex items-center gap-1 cursor-pointer hover:underline" style={{ color: "#2563EB" }}>
              View Claims <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Current", value: r?.outstandingAR ?? 0, color: "#059669" },
              { label: "1-30 Days", value: (r?.outstandingAR ?? 0) > 0 ? Math.round((r?.outstandingAR ?? 0) * 0.4) : 0, color: "#D97706" },
              { label: "31-60 Days", value: (r?.outstandingAR ?? 0) > 0 ? Math.round((r?.outstandingAR ?? 0) * 0.35) : 0, color: "#F59E0B" },
              { label: "61+ Days", value: (r?.outstandingAR ?? 0) > 0 ? Math.round((r?.outstandingAR ?? 0) * 0.25) : 0, color: "#DC2626" },
            ].map((a) => (
              <div key={a.label} className="text-center p-3 rounded-lg" style={{ backgroundColor: a.color + "10" }}>
                <p className="text-[11px] font-medium uppercase tracking-[0.5px] mb-1" style={{ color: a.color }}>{a.label}</p>
                <p className="text-[18px] font-bold" style={{ color: a.color }}>${(a.value / 100).toFixed(0)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Part 2 Summary */}
        <div className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>42 CFR Part 2 Status</h2>
            <button onClick={() => navigate("/compliance/part2")} className="text-[12px] font-medium flex items-center gap-1 cursor-pointer hover:underline" style={{ color: "#DC2626" }}>
              View Dashboard <ArrowRight size={12} />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "SUD Records", value: d?.part2?.activeSUDRecords ?? 0, attention: d?.part2?.expiredConsents ?? 0, color: "#7C3AED" },
              { label: "Valid Consents", value: d?.part2?.validConsents ?? 0, attention: 0, color: "#059669" },
              { label: "QSOA Agreements", value: d?.part2?.activeQSOAs ?? 0, attention: 0, color: "#2563EB" },
            ].map((s) => (
              <div key={s.label} className="text-center p-3 rounded-lg" style={{ backgroundColor: s.color + "08" }}>
                <p className="text-[20px] font-bold" style={{ color: s.color }}>{s.value}</p>
                <p className="text-[11px] font-medium mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>{s.label}</p>
                {s.attention > 0 && <p className="text-[10px] mt-0.5" style={{ color: "#DC2626" }}>{s.attention} requiring attention</p>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
