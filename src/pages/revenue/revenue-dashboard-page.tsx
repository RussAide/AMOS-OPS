import { trpc } from "@/providers/trpc";
import { useNavigate } from "react-router-dom";
import { DollarSign, FileText, CheckCircle, Clock, Ban, Shield, Package, AlertTriangle, Calendar, ShieldCheck, Send } from "lucide-react";

export function RevenueDashboardPage() {
  const navigate = useNavigate();
  const { data: kpis } = trpc.revenue.dashboardKPIs.useQuery();

  const cards = [
    { label: "Total Claims", value: kpis?.totalClaims ?? 0, icon: FileText, color: "#2563EB" },
    { label: "Pending", value: kpis?.pendingClaims ?? 0, icon: Clock, color: "#D97706" },
    { label: "Submitted", value: kpis?.submittedClaims ?? 0, icon: Send, color: "#2563EB" },
    { label: "Approved", value: kpis?.approvedClaims ?? 0, icon: CheckCircle, color: "#059669" },
    { label: "Denied", value: kpis?.deniedClaims ?? 0, icon: Ban, color: "#DC2626" },
    { label: "Total Billed", value: `$${((kpis?.totalBilled ?? 0) / 100).toLocaleString()}`, icon: DollarSign, color: "#245C5A" },
  ];

  const agingBuckets = [
    { label: "0-30 Days", value: kpis?.aging30 ?? 0, color: "#059669" },
    { label: "31-60 Days", value: kpis?.aging60 ?? 0, color: "#D97706" },
    { label: "61-90 Days", value: kpis?.aging90 ?? 0, color: "#DC2626" },
  ];

  const modules = [
    { title: "Claims", description: "View and manage all claims", route: "/revenue/claims", icon: FileText, color: "#2563EB", count: kpis?.totalClaims ?? 0 },
    { title: "Claim Submission", description: "Submit draft claims to payers", route: "/revenue/claim-submission", icon: Send, color: "#245C5A", count: 0 },
    { title: "Authorizations", description: "Manage prior authorizations", route: "/authorizations", icon: Shield, color: "#7C3AED", count: 0 },
    { title: "Payer Packets", description: "Build documentation packets", route: "/revenue/payer-packets", icon: Package, color: "#D97706", count: 0 },
    { title: "Denial Mgmt", description: "Track and appeal denials", route: "/revenue/denials", icon: AlertTriangle, color: "#DC2626", count: kpis?.deniedClaims ?? 0 },
    { title: "Aging Queue", description: "Monitor aged receivables", route: "/revenue/aging", icon: Calendar, color: "#059669", count: 0 },
    { title: "POS Gate", description: "Proof-of-Service validation", route: "/revenue/proof-of-service", icon: ShieldCheck, color: "#245C5A", count: 0 },
  ];

  return (
    <div className="px-4 md:px-6 pb-8">
      {/* KPI Cards */}
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Claim Aging */}
        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h2 className="text-[15px] font-semibold mb-4" style={{ color: "var(--topbar-title)" }}>Claim Aging</h2>
          <div className="space-y-3">
            {agingBuckets.map((bucket) => (
              <div key={bucket.label} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[13px]" style={{ color: "var(--topbar-title)" }}>{bucket.label}</span>
                  <span className="text-[13px] font-medium" style={{ color: bucket.color }}>${(bucket.value / 100).toLocaleString()}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.min((bucket.value / 100000) * 100, 100)}%`, backgroundColor: bucket.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Collection Rate */}
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
          <div className="flex items-center justify-center gap-4 mt-3 text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>
            <span>Collected: <span className="font-mono font-medium" style={{ color: "#059669" }}>${((kpis?.totalCollected ?? 0) / 100).toLocaleString()}</span></span>
            <span>Billed: <span className="font-mono font-medium">${((kpis?.totalBilled ?? 0) / 100).toLocaleString()}</span></span>
          </div>
        </div>
      </div>

      {/* Module Navigation Grid */}
      <h2 className="text-[15px] font-semibold mb-4" style={{ color: "var(--topbar-title)" }}>Revenue Cycle Modules</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {modules.map((mod) => (
          <button
            key={mod.route}
            onClick={() => navigate(mod.route)}
            className="rounded-lg border p-4 text-left transition-all hover:shadow-md hover:border-opacity-80 group"
            style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: mod.color + "15" }}>
                <mod.icon size={18} style={{ color: mod.color }} />
              </div>
              {mod.count > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ backgroundColor: mod.color + "15", color: mod.color }}>
                  {mod.count}
                </span>
              )}
            </div>
            <p className="text-[14px] font-semibold mb-1 group-hover:underline" style={{ color: "var(--topbar-title)" }}>{mod.title}</p>
            <p className="text-[12px]" style={{ color: "var(--topbar-subtitle)" }}>{mod.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

export default RevenueDashboardPage;
