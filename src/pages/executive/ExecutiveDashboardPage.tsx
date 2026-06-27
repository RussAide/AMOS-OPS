import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { trpc } from "@/providers/trpc";
import { Crown, Users, HeartPulse, DollarSign, TrendingUp, ShieldCheck, BarChart3 } from "lucide-react";

export function ExecutiveDashboardPage() {
  const { data: clinicalKPIs } = trpc.bhc.dashboardKPIs.useQuery();
  const { data: revenueKPIs } = trpc.revenue.dashboardKPIs.useQuery();
  const { data: qaKPIs } = trpc.qa.dashboardKPIs.useQuery();

  const modules = [
    {
      title: "Clinical Operations",
      icon: HeartPulse,
      color: "#059669",
      kpis: [
        { label: "Active Patients", value: clinicalKPIs?.activePatients ?? "—" },
        { label: "Sessions This Week", value: clinicalKPIs?.sessionsThisWeek ?? "—" },
        { label: "Pending Approvals", value: clinicalKPIs?.pendingApprovals ?? "—" },
        { label: "High Risk Flags", value: clinicalKPIs?.highRiskCount ?? "—" },
      ],
    },
    {
      title: "Revenue Cycle",
      icon: DollarSign,
      color: "#2563EB",
      kpis: [
        { label: "Total Claims", value: revenueKPIs?.totalClaims ?? "—" },
        { label: "Collection Rate", value: revenueKPIs ? `${revenueKPIs.collectionRate}%` : "—" },
        { label: "Pending", value: revenueKPIs?.pendingClaims ?? "—" },
        { label: "Total Billed", value: revenueKPIs ? `$${(revenueKPIs.totalBilled / 100).toLocaleString()}` : "—" },
      ],
    },
    {
      title: "QA & Compliance",
      icon: ShieldCheck,
      color: "#7C3AED",
      kpis: [
        { label: "Audit Score", value: qaKPIs ? `${qaKPIs.avgAuditScore}%` : "—" },
        { label: "Open Audits", value: qaKPIs?.openAudits ?? "—" },
        { label: "Open Incidents", value: qaKPIs?.openIncidents ?? "—" },
        { label: "Overdue Actions", value: qaKPIs?.overdueActions ?? "—" },
      ],
    },
    {
      title: "Human Resources",
      icon: Users,
      color: "#D97706",
      kpis: [
        { label: "Total Staff", value: 42 },
        { label: "Open Positions", value: 6 },
        { label: "Turnover Rate", value: "8%" },
        { label: "Expiring Creds", value: 3 },
      ],
    },
  ];

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Crown size={22} style={{ color: "#1a1a2e" }} /> Executive Intelligence
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Cross-Module Performance Summary</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modules.map((mod) => (
            <div key={mod.title} className="rounded-lg border p-5" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: mod.color + "15" }}>
                  <mod.icon size={16} style={{ color: mod.color }} />
                </div>
                <h2 className="text-[15px] font-semibold" style={{ color: "var(--topbar-title)" }}>{mod.title}</h2>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {mod.kpis.map((kpi) => (
                  <div key={kpi.label}>
                    <p className="text-[11px] uppercase tracking-wide mb-0.5" style={{ color: "var(--topbar-subtitle)" }}>{kpi.label}</p>
                    <p className="text-[20px] font-bold" style={{ color: mod.color }}>{kpi.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Links */}
        <div className="mt-6 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h2 className="text-[15px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <BarChart3 size={18} style={{ color: "#245C5A" }} /> Module Access
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Clinical", href: "#/clinical", color: "#059669" },
              { label: "Revenue", href: "#/revenue", color: "#2563EB" },
              { label: "QA & Compliance", href: "#/qa", color: "#7C3AED" },
              { label: "HR Command Center", href: "#/hr", color: "#D97706" },
            ].map((link) => (
              <a key={link.label} href={link.href} className="flex items-center justify-center gap-2 p-3 rounded-lg border text-[13px] font-medium transition-all hover:shadow-sm" style={{ borderColor: "var(--card-border)", color: link.color }}>
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
