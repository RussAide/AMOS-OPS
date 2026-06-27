import { AppShell } from "@/components/shell/AppShell";
import { TopBar } from "@/components/shell/TopBar";
import { trpc } from "@/providers/trpc";
import { Wrench, Building2, Truck, Clock, CheckCircle, AlertTriangle } from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  low: "#2563EB", medium: "#D97706", high: "#DC2626", urgent: "#7F1D1D",
};

const STATUS_COLORS: Record<string, string> = {
  open: "#D97706", in_progress: "#2563EB", pending_parts: "#7C3AED",
  completed: "#059669", cancelled: "#6B7280",
};

export function GADDashboardPage() {
  const { data: kpis } = trpc.gad.dashboardKPIs.useQuery();
  const { data: workOrders } = trpc.gad.listWorkOrders.useQuery();

  const kpiCards = [
    { label: "Facilities", value: kpis?.facilityCount ?? 0, icon: Building2, color: "#2563EB" },
    { label: "Vendors", value: kpis?.vendorCount ?? 0, icon: Truck, color: "#059669" },
    { label: "Open Work Orders", value: kpis?.openWorkOrders ?? 0, icon: Wrench, color: "#D97706" },
    { label: "In Progress", value: kpis?.inProgressWorkOrders ?? 0, icon: Clock, color: "#245C5A" },
  ];

  const openOrders = (workOrders ?? []).filter((wo: any) => wo.status !== "completed" && wo.status !== "cancelled");

  return (
    <AppShell>
      <TopBar />
      <div className="px-6 pt-4">
        <div className="mb-6">
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>General Administration</h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>Facilities, Vendors, Inventory & Operations</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {kpiCards.map((c) => (
            <div key={c.label} className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.5px]" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span>
                <c.icon size={16} style={{ color: c.color }} />
              </div>
              <p className="text-[22px] font-bold" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
          <h2 className="text-[15px] font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
            <Wrench size={18} style={{ color: "#245C5A" }} /> Work Orders
          </h2>
          <div className="space-y-2">
            {openOrders.length === 0 && <p className="text-[13px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>No open work orders</p>}
            {openOrders.map((wo: any) => (
              <div key={wo.id} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: "var(--card-border)" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono" style={{ color: "var(--topbar-subtitle)" }}>{wo.wo_number}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ backgroundColor: (PRIORITY_COLORS[wo.priority] ?? "#6B7280") + "15", color: PRIORITY_COLORS[wo.priority] ?? "#6B7280" }}>{wo.priority}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px]" style={{ backgroundColor: (STATUS_COLORS[wo.status] ?? "#6B7280") + "15", color: STATUS_COLORS[wo.status] ?? "#6B7280" }}>{wo.status}</span>
                  </div>
                  <p className="text-[13px] font-medium" style={{ color: "var(--topbar-title)" }}>{wo.title}</p>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{wo.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                  <span className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{wo.assigned_to ?? "Unassigned"}</span>
                  {wo.due_date && (
                    <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: new Date(wo.due_date) < new Date() ? "#FEE2E2" : "#F0FDFA", color: new Date(wo.due_date) < new Date() ? "#DC2626" : "#059669" }}>
                      {new Date(wo.due_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
