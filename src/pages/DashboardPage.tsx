import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { ContentCard } from "@/components/shell/ContentCard";
import { trpc } from "@/providers/trpc";
import { tracks, employees, getProgressPercentage } from "@/data/onboardingData";
import { SAMPLE_PEOPLE } from "@/data/hrLifecycleData";
import {
  LayoutDashboard, Users, BookOpen, ShieldCheck, ArrowRight, Activity, AlertTriangle, TrendingUp, Briefcase,
  HeartPulse, DollarSign, ClipboardCheck, Wrench, TrendingUp as Trending, Crown, Stethoscope, Home,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export function DashboardPage() {
  const navigate = useNavigate();
  const { data: clinicalKPIs } = trpc.bhc.dashboardKPIs.useQuery();
  const { data: revenueKPIs } = trpc.revenue.dashboardKPIs.useQuery();
  const { data: qaKPIs } = trpc.qa.dashboardKPIs.useQuery();
  const { data: groKPIs } = trpc.gro.dashboardKPIs.useQuery();
  const { data: gadKPIs } = trpc.gad.dashboardKPIs.useQuery();

  const activeTracks = tracks.filter((t) => t.clearanceStatus === "in-progress").length;
  const avgProgress = Math.round(employees.reduce((sum, e) => sum + getProgressPercentage(e.completedModules, e.totalModules), 0) / employees.length);

  const candidatesInPipeline = SAMPLE_PEOPLE.filter((p) => p.lane === "activation").length;
  const pendingActions = SAMPLE_PEOPLE.filter((p) => {
    const s = Object.values(p.moduleStatuses);
    return s.some((st) => ["r-posted","r-review","r-screening","r-interview","s-not-started","s-interview-sched","s-ref-pending","o-sent","o-packet-sent","o-packet-inc","o-file-build","or-assigned","or-in-progress","or-review","ob-in-progress","ob-cert-pending","ob-comp-pending","c-pending-file","c-pending-bg","c-hr-review","c-super-review","pf-incomplete","cr-expiring","cr-expired","pa-open","pa-notified","pa-followup"].includes(st));
  }).length;

  const moduleCards = [
    { label: "Clinical", href: "/clinical", icon: Stethoscope, color: "#059669", kpi: `${clinicalKPIs?.activePatients ?? 0} active patients · ${clinicalKPIs?.sessionsThisWeek ?? 0} sessions this week` },
    { label: "Revenue", href: "/revenue", icon: DollarSign, color: "#2563EB", kpi: `${revenueKPIs?.totalClaims ?? 0} claims · ${revenueKPIs?.collectionRate ?? 0}% collection` },
    { label: "QA & Compliance", href: "/qa", icon: ShieldCheck, color: "#7C3AED", kpi: `${qaKPIs?.totalAudits ?? 0} audits · ${qaKPIs?.openIncidents ?? 0} open incidents` },
    { label: "HR Command Center", href: "/hr", icon: Briefcase, color: "#245C5A", kpi: `${candidatesInPipeline} in pipeline` },
    { label: "Growth & Outreach", href: "/gro", icon: Trending, color: "#D97706", kpi: `${groKPIs?.activeReferrals ?? 0} active referrals · ${groKPIs?.conversionRate ?? 0}% conversion` },
    { label: "GAD Operations", href: "/gad", icon: Home, color: "#6B7280", kpi: `${gadKPIs?.openWorkOrders ?? 0} open WO · ${gadKPIs?.vendorCount ?? 0} vendors` },
  ];

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <h1 className="text-[24px] font-bold mb-1" style={{ color: "var(--topbar-title)" }}>Dashboard</h1>
        <p className="text-[14px] mb-6" style={{ color: "var(--topbar-subtitle)" }}>AMOS-OPS Enterprise Intranet Overview</p>

        {/* Module Quick Access */}
        <h2 className="text-[16px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Modules</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {moduleCards.map((m) => (
            <button
              key={m.label}
              onClick={() => navigate(m.href)}
              className="rounded-lg border p-4 text-left transition-all hover:shadow-md cursor-pointer w-full"
              style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
            >
              <m.icon size={20} style={{ color: m.color }} className="mb-2" />
              <p className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{m.label}</p>
              <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{m.kpi}</p>
            </button>
          ))}
        </div>

        {/* KPI Summary Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active Tracks", value: activeTracks, icon: LayoutDashboard, color: "#245C5A" },
            { label: "Staff Onboarding", value: employees.length, icon: Users, color: "#2563EB" },
            { label: "Pending Actions", value: pendingActions, icon: Activity, color: "#D97706" },
            { label: "Avg. Progress", value: `${avgProgress}%`, icon: BookOpen, color: "#059669" },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-medium uppercase tracking-[0.5px]" style={{ color: "var(--topbar-subtitle)" }}>{card.label}</span>
                <card.icon size={18} style={{ color: card.color }} />
              </div>
              <p className="text-[28px] font-bold" style={{ color: card.color }}>{card.value}</p>
            </div>
          ))}
        </div>

        {/* Executive Summary + Track Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Track Overview</h2>
            <ContentCard className="!mx-0 !border-0">
              <div className="space-y-3">
                {tracks.map((track) => {
                  const pct = getProgressPercentage(track.completedModules, track.moduleCount);
                  return (
                    <div key={track.id} className="flex items-center gap-4">
                      <span className="text-[14px] font-medium w-40 truncate flex-shrink-0" style={{ color: "var(--topbar-title)" }}>{track.name}</span>
                      <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: pct === 100 ? "#059669" : "#245C5A" }} />
                      </div>
                      <span className="text-[12px] w-12 text-right flex-shrink-0" style={{ color: "var(--topbar-subtitle)" }}>{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </ContentCard>
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h2 className="text-[16px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <Crown size={18} style={{ color: "#1a1a2e" }} /> Executive
            </h2>
            <button
              onClick={() => navigate("/executive")}
              className="w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all hover:shadow-sm mb-3"
              style={{ borderColor: "var(--card-border)" }}
            >
              <Trending size={16} style={{ color: "#245C5A" }} />
              <span className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>Cross-Module Intelligence</span>
              <ArrowRight size={14} className="ml-auto" style={{ color: "var(--topbar-subtitle)" }} />
            </button>
            <div className="space-y-2">
              <div className="flex justify-between text-[12px]">
                <span style={{ color: "var(--topbar-subtitle)" }}>Clinical Sessions (Week)</span>
                <span className="font-semibold" style={{ color: "#059669" }}>{clinicalKPIs?.sessionsThisWeek ?? 0}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span style={{ color: "var(--topbar-subtitle)" }}>Total Claims</span>
                <span className="font-semibold" style={{ color: "#2563EB" }}>{revenueKPIs?.totalClaims ?? 0}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span style={{ color: "var(--topbar-subtitle)" }}>High Risk Flags</span>
                <span className="font-semibold" style={{ color: "#DC2626" }}>{clinicalKPIs?.highRiskCount ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
