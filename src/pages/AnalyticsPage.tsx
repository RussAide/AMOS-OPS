import { useState, useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Line, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, Users, FileCheck, AlertTriangle, Clock,
  Shield, BarChart3, PieChart as PieIcon, Activity,
  Stethoscope, Home, DollarSign, ShieldCheck, Wrench,
  Zap, ChevronRight, Crown, Pill, CheckCircle2,
} from "lucide-react";

const TEAL = "#245C5A";
const TEAL_L = "#5BA8A5";
const AMBER = "#D97706";
const RED = "#DC2626";
const BLUE = "#2563EB";
const GREEN = "#059669";
const PURPLE = "#7C3AED";
const GRAY = "#94A3B8";

const MODULE_TABS = [
  { key: "overview", label: "Executive Overview", icon: Crown },
  { key: "workforce", label: "Workforce", icon: Users },
  { key: "clinical", label: "Clinical", icon: Stethoscope },
  { key: "residential", label: "Residential", icon: Home },
  { key: "revenue", label: "Revenue", icon: DollarSign },
  { key: "compliance", label: "Compliance", icon: ShieldCheck },
  { key: "gad", label: "GAD Operations", icon: Wrench },
];

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const { permissions } = useAuth();

  // Workforce
  const { data: overview } = trpc.analytics.workforceOverview.useQuery();
  const { data: completionRates } = trpc.analytics.moduleCompletionRates.useQuery();
  const { data: docCompliance } = trpc.analytics.documentCompliance.useQuery();
  const { data: activity } = trpc.analytics.transitionActivity.useQuery({ days: 30 });
  const { data: timeToClear } = trpc.analytics.timeToClearMetrics.useQuery();
  const { data: alerts } = trpc.analytics.alertSummary.useQuery();

  // Cross-module
  const { data: clinical } = trpc.analytics.clinicalOverview.useQuery();
  const { data: residential } = trpc.analytics.residentialOverview.useQuery();
  const { data: revenue } = trpc.analytics.revenueOverview.useQuery();
  const { data: compliance } = trpc.analytics.complianceOverview.useQuery();
  const { data: gad } = trpc.analytics.gadOverview.useQuery();
  const { data: execSummary } = trpc.analytics.executiveSummary.useQuery();

  const lanePieData = useMemo(() => overview ? [
    { name: "Activation", value: overview.byLane.activation, color: AMBER },
    { name: "Management", value: overview.byLane.management, color: TEAL },
  ] : [], [overview]);

  const deptBarData = useMemo(() => overview ? Object.entries(overview.byDepartment).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value) : [], [overview]);

  if (!permissions.canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Shield size={48} style={{ color: GRAY }} />
        <h2 className="text-lg font-semibold mt-4" style={{ color: "var(--topbar-subtitle)" }}>Access Restricted</h2>
        <p className="text-sm mt-1" style={{ color: "var(--topbar-subtitle)" }}>You need report viewing permissions to access analytics.</p>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
          <BarChart3 size={20} style={{ color: TEAL }} />
        </div>
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Analytics Dashboard</h1>
          <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>Cross-module KPIs, trends, and operational intelligence</p>
        </div>
      </div>

      {/* ─── Module Tabs ───────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b overflow-x-auto" style={{ borderColor: "var(--card-border)" }}>
        {MODULE_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium border-b-2 transition-colors flex-shrink-0"
            style={{
              borderColor: activeTab === tab.key ? TEAL : "transparent",
              color: activeTab === tab.key ? TEAL : "var(--topbar-subtitle)",
            }}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          EXECUTIVE OVERVIEW TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Status Banner */}
          {execSummary && (
            <div className="rounded-lg border p-4 flex flex-wrap items-center gap-4" style={{
              backgroundColor: execSummary.riskLevel === "low" ? "#ECFDF5" : execSummary.riskLevel === "critical" ? "#FEF2F2" : "#FFFBEB",
              borderColor: execSummary.riskLevel === "low" ? "#bbf7d0" : execSummary.riskLevel === "critical" ? "#fca5a5" : "#fcd34d",
            }}>
              <div className="flex items-center gap-2">
                <Zap size={16} style={{ color: execSummary.riskLevel === "low" ? GREEN : execSummary.riskLevel === "critical" ? RED : AMBER }} />
                <span className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>
                  Enterprise Status: <span style={{ color: execSummary.riskLevel === "low" ? GREEN : execSummary.riskLevel === "critical" ? RED : AMBER }}>{execSummary.operationalStatus}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-4">
                <span className="text-[11px]"><strong style={{ color: RED }}>{execSummary.criticalAlerts}</strong> critical alerts</span>
                <span className="text-[11px]"><strong>{execSummary.modulesOnline}/{execSummary.modulesTotal}</strong> modules online</span>
                <span className="text-[11px]"><strong>{execSummary.complianceScore}%</strong> compliance score</span>
              </div>
            </div>
          )}

          {/* 6 KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard icon={<Users size={15} />} label="Youth Served" value={execSummary?.youthServedMTD ?? 0} color={BLUE} suffix=" MTD" />
            <KPICard icon={<DollarSign size={15} />} label="Revenue MTD" value={execSummary?.revenueMTD ? `$${(execSummary.revenueMTD / 10000).toFixed(0)}K` : "$0"} color={GREEN} />
            <KPICard icon={<Users size={15} />} label="Headcount" value={execSummary?.headcountActive ?? 0} color={TEAL} />
            <KPICard icon={<AlertTriangle size={15} />} label="Open Incidents" value={execSummary?.incidentsOpen ?? 0} color={RED} />
            <KPICard icon={<Home size={15} />} label="Campus Occupancy" value={residential?.occupancyRate ?? 0} color={PURPLE} suffix="%" />
            <KPICard icon={<TrendingUp size={15} />} label="Collection Rate" value={revenue?.collectionRate ?? 0} color={AMBER} suffix="%" />
          </div>

          {/* Two charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Revenue vs Expenses (MTD)" icon={<DollarSign size={14} />}>
              <div className="space-y-3">
                {[
                  { label: "Total Billed", value: revenue?.totalBilled ?? 0, color: GREEN },
                  { label: "Total Collected", value: revenue?.totalCollected ?? 0, color: TEAL },
                  { label: "GAD Spend", value: gad?.totalActualSpend ?? 0, color: AMBER },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span style={{ color: "var(--topbar-subtitle)" }}>{item.label}</span>
                      <span className="font-bold" style={{ color: item.color }}>${item.value.toLocaleString()}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: "#f1f5f9" }}>
                      <div className="h-2.5 rounded-full" style={{ width: `${Math.min((item.value / (revenue?.totalBilled ?? 1)) * 100, 100)}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </ChartCard>

            <ChartCard title="Facility Occupancy" icon={<Home size={14} />}>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={residential?.byFacility ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="occupied" fill={TEAL} name="Occupied" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="capacity" fill="#e2e8f0" name="Capacity" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          {/* Module status grid */}
          <ChartCard title="Module Health Summary" icon={<Activity size={14} />}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Clinical", kpi: `${clinical?.activeYouth ?? 0} youth`, status: "active", color: GREEN },
                { label: "Residential", kpi: `${residential?.occupiedBeds ?? 0}/${residential?.operationalBeds ?? 0} beds`, status: "active", color: TEAL },
                { label: "Revenue", kpi: `${revenue?.claimsPending ?? 0} pending claims`, status: "active", color: BLUE },
                { label: "Compliance", kpi: `${compliance?.openIncidents ?? 0} open incidents`, status: compliance?.openIncidents ? "warning" : "active", color: compliance?.openIncidents ? RED : GREEN },
                { label: "GAD", kpi: `${gad?.openWorkOrders ?? 0} open WO`, status: "active", color: AMBER },
                { label: "Workforce", kpi: `${overview?.total ?? 0} people`, status: "active", color: PURPLE },
                { label: "Personas", kpi: "6/13 active", status: "active", color: TEAL },
                { label: "Documents", kpi: `${(docCompliance ?? []).reduce((s, d) => s + d.verified, 0)} verified`, status: "active", color: GREEN },
              ].map(m => (
                <div key={m.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                  <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{m.label}</div>
                  <div className="text-[14px] font-bold mt-1" style={{ color: m.color }}>{m.kpi}</div>
                  <div className="flex items-center gap-1 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.status === "active" ? GREEN : RED }} />
                    <span className="text-[9px] capitalize" style={{ color: "var(--topbar-subtitle)" }}>{m.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          WORKFORCE TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "workforce" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <KPICard icon={<Users size={15} />} label="Total People" value={overview?.total ?? 0} color={TEAL} />
            <KPICard icon={<FileCheck size={15} />} label="Employees" value={overview?.employees ?? 0} color={GREEN} />
            <KPICard icon={<TrendingUp size={15} />} label="Avg Days to Clear" value={timeToClear?.averageDays ?? 0} color={AMBER} suffix="d" />
            <KPICard icon={<AlertTriangle size={15} />} label="Active Alerts" value={alerts ? Object.values(alerts).reduce((s, v) => s + v, 0) : 0} color={RED} />
            <KPICard icon={<Clock size={15} />} label="Recent Activity" value={activity?.recent ?? 0} suffix=" /30d" color={BLUE} />
            <KPICard icon={<Activity size={15} />} label="Avg Completion" value={completionRates && completionRates.length > 0 ? Math.round(completionRates.reduce((s, r) => s + r.rate, 0) / completionRates.length) : 0} suffix="%" color={TEAL} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Workforce by Lane" icon={<PieIcon size={14} />}>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={lanePieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {lanePieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [`${v} people`, n]} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="People by Department" icon={<BarChart3 size={14} />}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={deptBarData} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={90} />
                  <Tooltip />
                  <Bar dataKey="value" fill={TEAL} radius={[0, 4, 4, 0]} name="People" />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <ChartCard title="Module Completion Rates" icon={<TrendingUp size={14} />}>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={(completionRates ?? []).map(r => ({ name: r.moduleName.length > 12 ? r.moduleName.slice(0, 12) + "..." : r.moduleName, fullName: r.moduleName, completed: r.completed, pending: r.pending, rate: r.rate }))} margin={{ bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip labelFormatter={(l: string, p: any) => p?.[0]?.payload?.fullName ?? l} />
                <Legend />
                <Bar dataKey="completed" stackId="a" fill={GREEN} name="Completed" />
                <Bar dataKey="pending" stackId="a" fill={AMBER} name="Pending" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CLINICAL TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "clinical" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<Users size={15} />} label="Total Youth" value={clinical?.totalYouth ?? 0} color={BLUE} />
            <KPICard icon={<Activity size={15} />} label="Sessions/Week" value={clinical?.sessionsThisWeek ?? 0} color={TEAL} />
            <KPICard icon={<AlertTriangle size={15} />} label="High Risk" value={clinical?.highRiskCount ?? 0} color={RED} />
            <KPICard icon={<Shield size={15} />} label="Safety Plans" value={clinical?.safetyPlansActive ?? 0} color={AMBER} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Youth by Risk Level" icon={<AlertTriangle size={14} />}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={clinical?.byRiskLevel ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={RED} name="Youth" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Level of Care Distribution" icon={<PieIcon size={14} />}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={(clinical?.byLevelOfCare ?? []).map((d: any, i: number) => ({ ...d, fill: [TEAL, BLUE, RED][i] ?? GRAY }))} cx="50%" cy="50%" outerRadius={70} dataKey="value" nameKey="name">
                    {(clinical?.byLevelOfCare ?? []).map((_: any, i: number) => <Cell key={i} fill={[TEAL, BLUE, RED][i] ?? GRAY} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Admissions (MTD)", value: clinical?.admissionsThisMonth ?? 0, color: GREEN },
              { label: "Discharges (MTD)", value: clinical?.dischargesThisMonth ?? 0, color: GRAY },
              { label: "Assessments Pending", value: clinical?.assessmentsPending ?? 0, color: AMBER },
              { label: "Avg CANS Score", value: clinical?.avgCansScore ?? 0, color: BLUE },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
                <div className="text-[20px] font-bold mt-1" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          RESIDENTIAL TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "residential" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<Home size={15} />} label="Campus Capacity" value={residential?.campusCapacity ?? 0} color={TEAL} />
            <KPICard icon={<Users size={15} />} label="Occupied" value={residential?.occupiedBeds ?? 0} color={GREEN} />
            <KPICard icon={<TrendingUp size={15} />} label="Occupancy Rate" value={residential?.occupancyRate ?? 0} color={BLUE} suffix="%" />
            <KPICard icon={<Pill size={15} />} label="Med Admin Rate" value={residential?.medicationsScheduled ? Math.round((residential.medicationsAdministered / residential.medicationsScheduled) * 100) : 0} color={PURPLE} suffix="%" />
          </div>

          <ChartCard title="Bed Occupancy by Facility" icon={<Home size={14} />}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={residential?.byFacility ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-15} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="occupied" fill={TEAL} name="Occupied" stackId="a" />
                <Bar dataKey="capacity" fill="#e2e8f0" name="Capacity" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Shifts/Week", value: residential?.shiftsThisWeek ?? 0, color: TEAL },
              { label: "Observations/Week", value: residential?.observationsThisWeek ?? 0, color: BLUE },
              { label: "Family Contacts/Week", value: residential?.familyContactsThisWeek ?? 0, color: GREEN },
              { label: "PRN This Week", value: residential?.prnAdministrations ?? 0, color: AMBER },
              { label: "Meds Scheduled", value: residential?.medicationsScheduled ?? 0, color: PURPLE },
              { label: "Meds Administered", value: residential?.medicationsAdministered ?? 0, color: GREEN },
              { label: "Meds Refused", value: residential?.medicationsRefused ?? 0, color: RED },
              { label: "Meds Held", value: residential?.medicationsHeld ?? 0, color: AMBER },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
                <div className="text-[18px] font-bold mt-1" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          REVENUE TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "revenue" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<DollarSign size={15} />} label="Total Billed" value={`$${((revenue?.totalBilled ?? 0) / 1000).toFixed(0)}K`} color={GREEN} />
            <KPICard icon={<DollarSign size={15} />} label="Total Collected" value={`$${((revenue?.totalCollected ?? 0) / 1000).toFixed(0)}K`} color={TEAL} />
            <KPICard icon={<TrendingUp size={15} />} label="Collection Rate" value={revenue?.collectionRate ?? 0} color={BLUE} suffix="%" />
            <KPICard icon={<Clock size={15} />} label="Avg Days to Pay" value={revenue?.avgDaysToPayment ?? 0} color={AMBER} suffix="d" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Claims Status" icon={<FileCheck size={14} />}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={[
                    { name: "Approved", value: revenue?.claimsApproved ?? 0, color: GREEN },
                    { name: "Pending", value: revenue?.claimsPending ?? 0, color: AMBER },
                    { name: "Denied", value: revenue?.claimsDenied ?? 0, color: RED },
                    { name: "Appealed", value: revenue?.claimsAppealed ?? 0, color: BLUE },
                  ]} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                    {[
                      { color: GREEN }, { color: AMBER }, { color: RED }, { color: BLUE },
                    ].map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Denials by Reason" icon={<AlertTriangle size={14} />}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenue?.denialsByReason ?? []} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="value" fill={RED} name="Denials" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Total Claims", value: revenue?.totalClaims ?? 0, color: TEAL },
              { label: "Active Auths", value: revenue?.authorizationsActive ?? 0, color: GREEN },
              { label: "Pending Auths", value: revenue?.authorizationsPending ?? 0, color: AMBER },
              { label: "Expiring Auths", value: revenue?.authorizationsExpiring ?? 0, color: RED },
              { label: "Claims Approved", value: revenue?.claimsApproved ?? 0, color: GREEN },
              { label: "Claims Denied", value: revenue?.claimsDenied ?? 0, color: RED },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
                <div className="text-[18px] font-bold mt-1" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          COMPLIANCE TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "compliance" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<AlertTriangle size={15} />} label="Open Incidents" value={compliance?.openIncidents ?? 0} color={RED} />
            <KPICard icon={<FileCheck size={15} />} label="Chart Audit Pass" value={compliance?.chartAuditPassRate ?? 0} color={GREEN} suffix="%" />
            <KPICard icon={<Shield size={15} />} label="Open Corrective" value={compliance?.correctiveActionsOpen ?? 0} color={AMBER} />
            <KPICard icon={<Clock size={15} />} label="HHSC Due" value={compliance?.hhscReportsDue ?? 0} color={BLUE} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Incidents by Type" icon={<AlertTriangle size={14} />}>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={compliance?.byIncidentType ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill={RED} name="Count" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Audit Results" icon={<FileCheck size={14} />}>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={(compliance?.byAuditResult ?? []).map((d: any, i: number) => ({ ...d, fill: [GREEN, AMBER][i] ?? GRAY }))} cx="50%" cy="50%" outerRadius={70} dataKey="value">
                    {(compliance?.byAuditResult ?? []).map((_: any, i: number) => <Cell key={i} fill={[GREEN, AMBER][i] ?? GRAY} />)}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Incidents This Month", value: compliance?.incidentsThisMonth ?? 0, color: RED },
              { label: "Open Audits", value: compliance?.openAudits ?? 0, color: AMBER },
              { label: "Audits This Qtr", value: compliance?.auditsThisQuarter ?? 0, color: TEAL },
              { label: "CA Overdue", value: compliance?.correctiveActionsOverdue ?? 0, color: RED },
              { label: "Chart Audits/Month", value: compliance?.chartAuditsThisMonth ?? 0, color: BLUE },
              { label: "HHSC Overdue", value: compliance?.hhscReportsOverdue ?? 0, color: compliance?.hhscReportsOverdue ? RED : GREEN },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
                <div className="text-[18px] font-bold mt-1" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          GAD TAB
          ══════════════════════════════════════════════════ */}
      {activeTab === "gad" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <KPICard icon={<Wrench size={15} />} label="Open WO" value={gad?.openWorkOrders ?? 0} color={AMBER} />
            <KPICard icon={<Activity size={15} />} label="In Progress" value={gad?.inProgressWorkOrders ?? 0} color={BLUE} />
            <KPICard icon={<CheckCircle2 size={15} />} label="Completed/Month" value={gad?.completedThisMonth ?? 0} color={GREEN} />
            <KPICard icon={<AlertTriangle size={15} />} label="Urgent/High" value={gad?.urgentHighCount ?? 0} color={RED} />
          </div>

          <ChartCard title="Work Orders by Type" icon={<Wrench size={14} />}>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={gad?.byWorkType ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="value" fill={AMBER} name="Work Orders" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Vendors", value: gad?.vendorCount ?? 0, color: TEAL },
              { label: "Contracts Expiring", value: gad?.vendorContractsExpiring ?? 0, color: RED },
              { label: "Facilities", value: gad?.facilities ?? 0, color: BLUE },
              { label: "Overdue WO", value: gad?.overdueWorkOrders ?? 0, color: gad?.overdueWorkOrders ? RED : GREEN },
              { label: "Est. Spend", value: `$${((gad?.totalEstimatedSpend ?? 0) / 1000).toFixed(0)}K`, color: AMBER },
              { label: "Actual Spend", value: `$${((gad?.totalActualSpend ?? 0) / 1000).toFixed(0)}K`, color: GREEN },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</div>
                <div className="text-[18px] font-bold mt-1" style={{ color: typeof c.value === "string" ? (c.value.startsWith("$") ? GREEN : TEAL) : (c.value as any) > 0 ? RED : GREEN }}
                  style-color={typeof c.value === "string" ? undefined : undefined}>
                  {typeof c.value === "number" ? c.value.toLocaleString() : c.value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────

function KPICard({ icon, label, value, color, suffix = "" }: { icon: React.ReactNode; label: string; value: string | number; color: string; suffix?: string }) {
  const display = typeof value === "number" ? `${value.toLocaleString()}${suffix}` : `${value}${suffix}`;
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: `${color}30`, backgroundColor: `${color}06` }}>
      <div className="flex items-center gap-2">
        <div style={{ color }}>{icon}</div>
        <span className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--topbar-subtitle)" }}>{label}</span>
      </div>
      <p className="text-[20px] font-bold mt-1.5" style={{ color }}>{display}</p>
    </div>
  );
}

function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border, #E2E8F0)", backgroundColor: "var(--card-bg, #FFFFFF)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: TEAL }}>{icon}</span>
        <h3 className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{title}</h3>
      </div>
      {children}
    </div>
  );
}

export default AnalyticsPage;
