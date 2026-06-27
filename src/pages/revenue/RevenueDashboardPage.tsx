import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { trpc } from "@/providers/trpc";
import { DollarSign, FileText, TrendingUp, AlertTriangle, CheckCircle, Clock, Ban, ArrowRight } from "lucide-react";

export function RevenueDashboardPage() {
  const { data: kpis } = trpc.revenue.dashboardKPIs.useQuery();

  const cards = [
    { label: "Total Claims", value: kpis?.totalClaims ?? 0, icon: FileText, color: "#2563EB" },
    { label: "Pending", value: kpis?.pendingClaims ?? 0, icon: Clock, color: "#D97706" },
    { label: "Approved", value: kpis?.approvedClaims ?? 0, icon: CheckCircle, color: "#059669" },
    { label: "Denied", value: kpis?.deniedClaims ?? 0, icon: Ban, color: "#DC2626" },
    { label: "Total Billed", value: `$${(kpis?.totalBilled ?? 0).toLocaleString()}`, icon: DollarSign, color: "#245C5A" },
    { label: "Collected", value: `$${(kpis?.totalCollected ?? 0).toLocaleString()}`, icon: TrendingUp, color: "#7C3AED" },
  ];

  const agingBuckets = [
    { label: "0-30 Days", value: kpis?.aging30 ?? 0, color: "#059669" },
    { label: "31-60 Days", value: kpis?.aging60 ?? 0, color: "#D97706" },
    { label: "61-90 Days", value: kpis?.aging90 ?? 0, color: "#DC2626" },
  ];

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>Revenue Cycle</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Billing, Claims & Collections Management</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          {cards.map((c) => (
            <div key={c.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span>
                <c.icon size={16} style={{ color: c.color }} />
              </div>
              <p className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: "var(--topbar-title)" }}>Claim Aging</h2>
            <div className="space-y-3">
              {agingBuckets.map((bucket) => (
                <div key={bucket.label} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px]" style={{ color: "var(--topbar-title)" }}>{bucket.label}</span>
                    <span className="text-[13px] font-medium" style={{ color: bucket.color }}>${bucket.value.toLocaleString()}</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.min((bucket.value / 100000) * 100, 100)}%`, backgroundColor: bucket.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h2 className="text-[15px] font-semibold mb-4" style={{ color: "var(--topbar-title)" }}>Collection Rate</h2>
            <div className="flex items-center justify-center py-8">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#245C5A" strokeWidth="8" strokeDasharray={`${(kpis?.collectionRate ?? 0) * 2.51} 251`} strokeLinecap="round" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[20px] font-bold" style={{ color: "#245C5A" }}>{kpis?.collectionRate ?? 0}%</span>
                </div>
              </div>
            </div>
            <p className="text-[12px] text-center" style={{ color: "var(--topbar-subtitle)" }}>Target: 95%</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
