import { useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, Line, AreaChart, Area,
} from "recharts";
import {
  TrendingUp, Users, FileCheck, AlertTriangle, Clock,
  Shield, BarChart3, PieChart as PieIcon, Activity,
} from "lucide-react";

const TEAL = "#245C5A";
const TEAL_LIGHT = "#5BA8A5";
const AMBER = "#D97706";
const RED = "#DC2626";
const BLUE = "#2563EB";
const GREEN = "#059669";
const GRAY = "#94A3B8";

export function AnalyticsPage() {
  const { permissions } = useAuth();
  const navigate = useNavigate();
  const { data: overview } = trpc.analytics.workforceOverview.useQuery();
  const { data: completionRates } = trpc.analytics.moduleCompletionRates.useQuery();
  const { data: docCompliance } = trpc.analytics.documentCompliance.useQuery();
  const { data: activity } = trpc.analytics.transitionActivity.useQuery({ days: 30 });
  const { data: timeToClear } = trpc.analytics.timeToClearMetrics.useQuery();
  const { data: alerts } = trpc.analytics.alertSummary.useQuery();

  // Pie data for lanes
  const lanePieData = useMemo(() => {
    if (!overview) return [];
    return [
      { name: "Activation", value: overview.byLane.activation, color: AMBER },
      { name: "Management", value: overview.byLane.management, color: TEAL },
    ];
  }, [overview]);

  // Department bar data
  const deptBarData = useMemo(() => {
    if (!overview) return [];
    return Object.entries(overview.byDepartment)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [overview]);

  // Completion rates bar data
  const completionBarData = useMemo(() => {
    if (!completionRates) return [];
    return completionRates.map((r) => ({
      name: r.moduleName.length > 12 ? r.moduleName.slice(0, 12) + "..." : r.moduleName,
      fullName: r.moduleName,
      completed: r.completed,
      pending: r.pending,
      rate: r.rate,
    }));
  }, [completionRates]);

  // Document compliance data
  const docComplianceData = useMemo(() => {
    if (!docCompliance) return [];
    return docCompliance.map((d) => ({
      name: d.moduleId.length > 10 ? d.moduleId.slice(0, 10) : d.moduleId,
      verified: d.verified,
      uploaded: d.uploaded,
      rejected: d.rejected,
      rate: d.complianceRate,
    }));
  }, [docCompliance]);

  if (!permissions.canViewReports) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Shield size={48} style={{ color: GRAY }} />
        <h2 className="text-lg font-semibold mt-4 text-muted-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">You need report viewing permissions to access analytics.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#F0FDFA" }}>
          <BarChart3 size={20} style={{ color: TEAL }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ color: TEAL }}>Analytics Dashboard</h1>
          <p className="text-[12px] text-muted-foreground">Workforce trends, compliance scoring, and operational metrics</p>
        </div>
      </div>

      {/* ─── KPI Cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard icon={<Users size={16} />} label="Total People" value={overview?.total || 0} color={TEAL} />
        <KPICard icon={<FileCheck size={16} />} label="Employees" value={overview?.employees || 0} color={GREEN} />
        <KPICard icon={<TrendingUp size={16} />} label="Avg Days to Clear" value={timeToClear?.averageDays || 0} color={AMBER} suffix="d" />
        <KPICard icon={<AlertTriangle size={16} />} label="Active Alerts" value={getTotalAlerts(alerts)} color={RED} />
        <KPICard icon={<Clock size={16} />} label="Recent Activity" value={activity?.recent || 0} suffix="/30d" color={BLUE} />
        <KPICard icon={<Activity size={16} />} label="Avg Completion" value={getAvgCompletion(completionRates)} suffix="%" color={TEAL} />
      </div>

      {/* ─── Row 1: Lane Distribution + Department Breakdown ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Lane Pie Chart */}
        <ChartCard title="Workforce by Lane" icon={<PieIcon size={14} />}>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={lanePieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={4}
                dataKey="value"
              >
                {lanePieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number, name: string) => [`${value} people`, name]} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Department Bar Chart */}
        <ChartCard title="People by Department" icon={<BarChart3 size={14} />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={deptBarData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={90} />
              <Tooltip />
              <Bar dataKey="value" fill={TEAL} radius={[0, 4, 4, 0]} name="People" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── Row 2: Module Completion Rates ──────────────────── */}
      <ChartCard title="Module Completion Rates" icon={<TrendingUp size={14} />}>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={completionBarData} margin={{ bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, name: string) => [value, name === "rate" ? "Rate %" : name]}
              labelFormatter={(label: string) => {
                const item = completionBarData.find((d) => d.name === label);
                return item?.fullName || label;
              }}
            />
            <Legend />
            <Bar dataKey="completed" stackId="a" fill={GREEN} name="Completed" radius={[0, 0, 0, 0]} />
            <Bar dataKey="pending" stackId="a" fill={AMBER} name="Pending" radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="rate" stroke={TEAL} strokeWidth={2} dot={{ r: 4 }} name="Rate %" />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* ─── Row 3: Activity Timeline + Document Compliance ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Activity Timeline */}
        <ChartCard title="Status Change Activity (30 Days)" icon={<Activity size={14} />}>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={activity?.byDay || []}>
              <defs>
                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TEAL} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={TEAL} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value: number) => [`${value} changes`, "Activity"]} />
              <Area type="monotone" dataKey="count" stroke={TEAL} fill="url(#activityFill)" name="Status Changes" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Document Compliance */}
        <ChartCard title="Document Compliance by Module" icon={<FileCheck size={14} />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={docComplianceData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={80} />
              <Tooltip />
              <Legend />
              <Bar dataKey="verified" stackId="d" fill={GREEN} name="Verified" />
              <Bar dataKey="uploaded" stackId="d" fill={AMBER} name="Uploaded" />
              <Bar dataKey="rejected" stackId="d" fill={RED} name="Rejected" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── Row 4: Top Modules by Activity + Time to Clear ──── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Modules */}
        <ChartCard title="Most Active Modules (30 Days)" icon={<BarChart3 size={14} />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={activity?.byModule.slice(0, 6) || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="moduleName" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill={BLUE} radius={[4, 4, 0, 0]} name="Transitions" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Time to Clear */}
        <ChartCard title="Time-to-Clear by Lane" icon={<Clock size={14} />}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={timeToClear ? Object.entries(timeToClear.byLane).map(([lane, data]) => ({
                lane: lane.charAt(0).toUpperCase() + lane.slice(1),
                avgDays: data.avgDays,
                count: data.count,
              })) : []}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="lane" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} label={{ value: "Days", angle: -90, position: "insideLeft", style: { fontSize: 11 } }} />
              <Tooltip formatter={(value: number, name: string) => [name === "avgDays" ? `${value} days` : value, name === "avgDays" ? "Average" : "Count"]} />
              <Legend />
              <Bar dataKey="avgDays" fill={TEAL} radius={[4, 4, 0, 0]} name="Avg Days" />
              <Bar dataKey="count" fill={TEAL_LIGHT} radius={[4, 4, 0, 0]} name="People Cleared" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ─── Alert Summary ───────────────────────────────────── */}
      <ChartCard title="Active Alert Summary" icon={<AlertTriangle size={14} />}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {alerts && [
            { label: "Active Without Clearance", value: alerts.activeWithoutClearance, color: RED, module: "clearance" },
            { label: "Expired Credentials", value: alerts.expiredCredentials, color: RED, module: "credentials" },
            { label: "Pending Orientation", value: alerts.pendingOrientation, color: AMBER, module: "orientation" },
            { label: "Incomplete Personnel Files", value: alerts.incompletePersonnelFiles, color: AMBER, module: "personnel-files" },
            { label: "Restricted Clearance", value: alerts.restrictedClearance, color: RED, module: "clearance" },
            { label: "Pending Offers", value: alerts.pendingOffers, color: BLUE, module: "offers" },
            { label: "Pending Reviews", value: alerts.pendingReviews, color: BLUE, module: "performance" },
            { label: "Expiring Soon", value: alerts.expiringSoon, color: AMBER, module: "credentials" },
          ].map((alert) => (
            <button
              key={alert.label}
              onClick={() => navigate(`/hr/${alert.module}`)}
              className="text-left p-3 rounded-lg border transition-all hover:shadow-md"
              style={{ borderColor: `${alert.color}30`, backgroundColor: `${alert.color}08` }}
            >
              <p className="text-[11px] font-medium text-muted-foreground">{alert.label}</p>
              <p className="text-2xl font-bold mt-1" style={{ color: alert.color }}>{alert.value}</p>
            </button>
          ))}
        </div>
      </ChartCard>
    </div>
  );
}

// ─── Helper Components ───────────────────────────────────────

function KPICard({ icon, label, value, color, suffix = "" }: { icon: React.ReactNode; label: string; value: number; color: string; suffix?: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: `${color}30`, backgroundColor: `${color}06` }}>
      <div className="flex items-center gap-2">
        <div style={{ color }}>{icon}</div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold mt-1.5" style={{ color }}>
        {value.toLocaleString()}{suffix}
      </p>
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

function getTotalAlerts(alerts: Record<string, number> | undefined): number {
  if (!alerts) return 0;
  return Object.values(alerts).reduce((sum, v) => sum + v, 0);
}

function getAvgCompletion(rates: Array<{ rate: number }> | undefined): number {
  if (!rates || rates.length === 0) return 0;
  return Math.round(rates.reduce((sum, r) => sum + r.rate, 0) / rates.length);
}
