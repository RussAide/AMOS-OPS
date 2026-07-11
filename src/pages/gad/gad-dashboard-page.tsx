import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { trpc } from "@/providers/trpc";
import {
  Wrench, Building2, Truck, Clock, CheckCircle2, AlertTriangle,
  Plus, X, Star, Phone, Mail, MapPin, Shield, Calendar,
  ChevronRight, DollarSign, TrendingUp, Package,
  ClipboardList, ShieldCheck, Eye, XCircle, ShoppingCart,
} from "lucide-react";

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  low: { color: "#2563EB", bg: "#EFF6FF" },
  medium: { color: "#D97706", bg: "#FFFBEB" },
  high: { color: "#DC2626", bg: "#FEF2F2" },
  urgent: { color: "#7F1D1D", bg: "#FEE2E2" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; next: string | null }> = {
  open: { label: "Open", color: "#D97706", bg: "#FFFBEB", next: "in_progress" },
  in_progress: { label: "In Progress", color: "#2563EB", bg: "#EFF6FF", next: "pending_parts" },
  pending_parts: { label: "Pending Parts", color: "#7C3AED", bg: "#F5F3FF", next: "completed" },
  completed: { label: "Completed", color: "#059669", bg: "#ECFDF5", next: null },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6", next: null },
};

const PR_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "#6B7280", bg: "#F3F4F6" },
  submitted: { label: "Submitted", color: "#2563EB", bg: "#EFF6FF" },
  under_review: { label: "Under Review", color: "#D97706", bg: "#FFFBEB" },
  approved: { label: "Approved", color: "#059669", bg: "#ECFDF5" },
  rejected: { label: "Rejected", color: "#DC2626", bg: "#FEF2F2" },
  ordered: { label: "Ordered", color: "#7C3AED", bg: "#F5F3FF" },
  received: { label: "Received", color: "#059669", bg: "#ECFDF5" },
  cancelled: { label: "Cancelled", color: "#6B7280", bg: "#F3F4F6" },
};

const SAFETY_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  passed: { label: "Passed", color: "#059669", bg: "#ECFDF5" },
  passed_with_notes: { label: "Notes", color: "#D97706", bg: "#FFFBEB" },
  failed: { label: "Failed", color: "#DC2626", bg: "#FEF2F2" },
  pending: { label: "Pending", color: "#2563EB", bg: "#EFF6FF" },
  overdue: { label: "Overdue", color: "#7F1D1D", bg: "#FEE2E2" },
};

const WORK_TYPE_ICONS: Record<string, string> = {
  hvac: "HVAC", plumbing: "PLB", electrical: "ELEC", safety: "SFT",
  security: "SEC", grounds: "GND", maintenance: "MNT", it: "IT",
};

export function GADDashboardPage() {
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [woFilter, setWoFilter] = useState<string>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [prFilter, setPrFilter] = useState<string>("all");
  const [safetyFilter, setSafetyFilter] = useState<string>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPRCreateModal, setShowPRCreateModal] = useState(false);
  const [showSafetyCreateModal, setShowSafetyCreateModal] = useState(false);
  const [showVendorCreateModal, setShowVendorCreateModal] = useState(false);
  const [detailView, setDetailView] = useState<{ type: string; id: string } | null>(null);
  const queryClient = useQueryClient();

  const { data: kpis } = trpc.gad.dashboardKPIs.useQuery();
  const { data: workOrders } = trpc.gad.listWorkOrders.useQuery();
  const { data: vendors } = trpc.gad.listVendors.useQuery();
  const { data: facilities } = trpc.gad.listFacilities.useQuery();
  const { data: procurement } = trpc.gad.listProcurement.useQuery();
  const { data: safetyInspections } = trpc.gad.listSafetyInspections.useQuery();
  const { data: safetyKPIs } = trpc.gad.safetyKPIs.useQuery();

  // Detail queries
  const { data: facilityDetail } = trpc.gad.getFacility.useQuery(
    { id: detailView?.id ?? "" },
    { enabled: detailView?.type === "facility" }
  );
  const { data: woDetail } = trpc.gad.getWorkOrder.useQuery(
    { id: detailView?.id ?? "" },
    { enabled: detailView?.type === "workorder" }
  );
  const { data: vendorDetail } = trpc.gad.getVendor.useQuery(
    { id: detailView?.id ?? "" },
    { enabled: detailView?.type === "vendor" }
  );
  const { data: prDetail } = trpc.gad.getProcurementRequest.useQuery(
    { id: detailView?.id ?? "" },
    { enabled: detailView?.type === "procurement" }
  );
  const { data: safetyDetail } = trpc.gad.getSafetyInspection.useQuery(
    { id: detailView?.id ?? "" },
    { enabled: detailView?.type === "safety" }
  );

  const updateWO = trpc.gad.updateWorkOrder.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["gad", "listWorkOrders"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "dashboardKPIs"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "getWorkOrder"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "getFacility"]] });
    },
  });

  const createWO = trpc.gad.createWorkOrder.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["gad", "listWorkOrders"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "dashboardKPIs"]] });
      setShowCreateModal(false);
    },
  });

  const createPR = trpc.gad.createProcurementRequest.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["gad", "listProcurement"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "dashboardKPIs"]] });
      setShowPRCreateModal(false);
    },
  });

  const updatePR = trpc.gad.updateProcurementRequest.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["gad", "listProcurement"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "dashboardKPIs"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "getProcurementRequest"]] });
    },
  });

  const createSafety = trpc.gad.createSafetyInspection.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["gad", "listSafetyInspections"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "dashboardKPIs"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "safetyKPIs"]] });
      setShowSafetyCreateModal(false);
    },
  });

  const updateSafety = trpc.gad.updateSafetyInspection.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["gad", "listSafetyInspections"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "dashboardKPIs"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "safetyKPIs"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "getSafetyInspection"]] });
    },
  });

  const createVendor = trpc.gad.createVendor.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [["gad", "listVendors"]] });
      queryClient.invalidateQueries({ queryKey: [["gad", "dashboardKPIs"]] });
      setShowVendorCreateModal(false);
    },
  });

  // Filter work orders
  const filteredWO = woFilter === "all"
    ? workOrders
    : workOrders?.filter((w: any) => w.status === woFilter);

  // Filter procurement
  const filteredPR = prFilter === "all"
    ? procurement
    : procurement?.filter((p: any) => p.status === prFilter);

  // Filter safety
  const filteredSafety = safetyFilter === "all"
    ? safetyInspections
    : safetyInspections?.filter((s: any) => s.status === safetyFilter);

  // Open work orders for overview
  const openWO = (workOrders ?? []).filter((w: any) => w.status !== "completed" && w.status !== "cancelled");
  const urgentWO = openWO.filter((w: any) => w.priority === "urgent" || w.priority === "high");

  // Vendor contract expiry check
  const now = new Date();
  const vendorContractWarning = (v: any) => {
    if (!v.contract_expiry) return null;
    const expiry = new Date(v.contract_expiry);
    const daysUntil = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysUntil < 0) return { level: "expired", color: "#DC2626", bg: "#FEF2F2" };
    if (daysUntil <= 60) return { level: "soon", color: "#D97706", bg: "#FFFBEB" };
    return null;
  };

  // Spending
  const totalEstimated = (workOrders ?? []).reduce((s: number, w: any) => s + (w.estimated_cost ?? 0), 0);
  const totalActual = (workOrders ?? []).reduce((s: number, w: any) => s + (w.actual_cost ?? 0), 0);

  const tabs = [
    { key: "overview", label: "Overview", icon: TrendingUp },
    { key: "workorders", label: "Work Orders", icon: Wrench },
    { key: "vendors", label: "Vendors", icon: Truck },
    { key: "facilities", label: "Facilities", icon: Building2 },
    { key: "procurement", label: "Procurement", icon: ShoppingCart },
    { key: "safety", label: "Safety", icon: Shield },
  ];

  return (
    <div className="px-4 md:px-6 pt-4 pb-8">
      {/* ─── Header ────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "var(--topbar-title)" }}>
            General Administration
          </h1>
          <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>
            Facilities, vendors, maintenance, procurement & safety operations
          </p>
        </div>
        <div className="flex gap-2">
          {activeTab === "workorders" && (
            <button onClick={() => setShowCreateModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white flex-shrink-0" style={{ backgroundColor: "#245C5A" }}>
              <Plus size={14} /> New Work Order
            </button>
          )}
          {activeTab === "procurement" && (
            <button onClick={() => setShowPRCreateModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white flex-shrink-0" style={{ backgroundColor: "#245C5A" }}>
              <Plus size={14} /> New Request
            </button>
          )}
          {activeTab === "safety" && (
            <button onClick={() => setShowSafetyCreateModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white flex-shrink-0" style={{ backgroundColor: "#245C5A" }}>
              <Plus size={14} /> New Inspection
            </button>
          )}
          {activeTab === "vendors" && (
            <button onClick={() => setShowVendorCreateModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-medium text-white flex-shrink-0" style={{ backgroundColor: "#245C5A" }}>
              <Plus size={14} /> Add Vendor
            </button>
          )}
        </div>
      </div>

      {/* ─── Tabs ──────────────────────────────────────── */}
      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--card-border)" }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => { setActiveTab(tab.key); setDetailView(null); }} className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium border-b-2 transition-colors"
            style={{ borderColor: activeTab === tab.key ? "#245C5A" : "transparent", color: activeTab === tab.key ? "#245C5A" : "var(--topbar-subtitle)" }}>
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════
          DETAIL VIEW (shared)
          ══════════════════════════════════════════════════ */}
      {detailView && (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setDetailView(null)} className="flex items-center gap-1 text-[12px] font-medium" style={{ color: "#245C5A" }}>
              <ChevronRight size={14} className="rotate-180" /> Back
            </button>
          </div>

          {/* Facility Detail */}
          {detailView.type === "facility" && facilityDetail && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#f0f6f6" }}>
                      <Building2 size={18} style={{ color: "#245C5A" }} />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{facilityDetail.facility_name}</h2>
                      <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{facilityDetail.facility_code} • Built {facilityDetail.built_year}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: facilityDetail.status === "active" ? "#ECFDF5" : "#FEF2F2", color: facilityDetail.status === "active" ? "#059669" : "#DC2626" }}>{facilityDetail.status}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: facilityDetail.readinessScore >= 80 ? "#ECFDF5" : facilityDetail.readinessScore >= 60 ? "#FFFBEB" : "#FEF2F2", color: facilityDetail.readinessScore >= 80 ? "#059669" : facilityDetail.readinessScore >= 60 ? "#D97706" : "#DC2626" }}>Readiness: {facilityDetail.readinessScore}%</span>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{(facilityDetail.total_sqft ?? 0).toLocaleString()}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>sq ft</div>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{facilityDetail.bedrooms ?? 0}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>bedrooms</div>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{facilityDetail.common_areas ?? 0}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>common areas</div>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{facilityDetail.openWorkOrderCount ?? 0}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>open WOs</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px] mb-2" style={{ color: "var(--topbar-subtitle)" }}>
                  <MapPin size={10} /> {facilityDetail.address}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>Last: {facilityDetail.last_inspection_date ? new Date(facilityDetail.last_inspection_date).toLocaleDateString() : "N/A"}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: facilityDetail.next_inspection_date && new Date(facilityDetail.next_inspection_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "#FEF2F2" : "#ECFDF5", color: facilityDetail.next_inspection_date && new Date(facilityDetail.next_inspection_date) <= new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) ? "#DC2626" : "#059669" }}>Next: {facilityDetail.next_inspection_date ? new Date(facilityDetail.next_inspection_date).toLocaleDateString() : "N/A"}</span>
                </div>
              </div>

              {/* Inspections by type */}
              {facilityDetail.inspectionsByType && Object.keys(facilityDetail.inspectionsByType).length > 0 && (
                <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                  <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Inspection History by Type</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                    {Object.entries(facilityDetail.inspectionsByType).map(([type, inspections]: [string, any]) => {
                      const latest = inspections[0];
                      const daysUntil = latest?.next_due_date ? Math.ceil((new Date(latest.next_due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                      return (
                        <div key={type} className="p-2.5 rounded border" style={{ borderColor: "var(--card-border)", backgroundColor: "#fff" }}>
                          <div className="text-[10px] font-medium uppercase mb-1" style={{ color: "var(--topbar-subtitle)" }}>{type.replace(/_/g, " ")}</div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: SAFETY_STATUS_CONFIG[latest?.status]?.bg ?? "#f1f5f9", color: SAFETY_STATUS_CONFIG[latest?.status]?.color ?? "#64748b" }}>{SAFETY_STATUS_CONFIG[latest?.status]?.label ?? latest?.status}</span>
                            {daysUntil !== null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: daysUntil <= 14 ? "#FEF2F2" : "#ECFDF5", color: daysUntil <= 14 ? "#DC2626" : "#059669" }}>{daysUntil <= 0 ? "Due" : `${daysUntil}d`}</span>
                            )}
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>Score: {latest?.score ?? "N/A"}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Open work orders for this facility */}
              {facilityDetail.workOrders && facilityDetail.workOrders.filter((w: any) => w.status !== "completed" && w.status !== "cancelled").length > 0 && (
                <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                  <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Open Work Orders</h3>
                  <div className="space-y-2">
                    {facilityDetail.workOrders.filter((w: any) => w.status !== "completed" && w.status !== "cancelled").map((wo: any) => {
                      const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.open;
                      const prio = PRIORITY_CONFIG[wo.priority] || PRIORITY_CONFIG.medium;
                      return (
                        <div key={wo.id} className="flex items-center gap-2 p-2 rounded border" style={{ borderColor: "var(--card-border)", backgroundColor: "#fff" }}>
                          <div className="w-6 h-6 rounded flex items-center justify-center flex-shrink-0 text-[9px] font-bold" style={{ backgroundColor: prio.bg, color: prio.color }}>{wo.priority[0].toUpperCase()}</div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate">{wo.title}</div>
                            <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{wo.wo_number}</div>
                          </div>
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Work Order Detail */}
          {detailView.type === "workorder" && woDetail && (
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: (PRIORITY_CONFIG[woDetail.priority] || PRIORITY_CONFIG.medium).bg, color: (PRIORITY_CONFIG[woDetail.priority] || PRIORITY_CONFIG.medium).color }}>
                  {WORK_TYPE_ICONS[woDetail.work_type] ?? woDetail.work_type?.slice(0, 3).toUpperCase()}
                </div>
                <div>
                  <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{woDetail.title}</h2>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{woDetail.wo_number} • {woDetail.work_type}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                  <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Status</div>
                  <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full inline-block mt-1" style={{ backgroundColor: (STATUS_CONFIG[woDetail.status] || STATUS_CONFIG.open).bg, color: (STATUS_CONFIG[woDetail.status] || STATUS_CONFIG.open).color }}>{(STATUS_CONFIG[woDetail.status] || STATUS_CONFIG.open).label}</span>
                </div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                  <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Priority</div>
                  <div className="text-[12px] font-medium mt-1" style={{ color: (PRIORITY_CONFIG[woDetail.priority] || PRIORITY_CONFIG.medium).color }}>{woDetail.priority}</div>
                </div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                  <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Est. Cost</div>
                  <div className="text-[12px] font-medium mt-1">${((woDetail.estimated_cost ?? 0) / 100).toLocaleString()}</div>
                </div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                  <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Due Date</div>
                  <div className="text-[12px] font-medium mt-1">{woDetail.due_date ? new Date(woDetail.due_date).toLocaleDateString() : "N/A"}</div>
                </div>
              </div>
              <div className="mb-4">
                <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Description</div>
                <p className="text-[12px]" style={{ color: "var(--topbar-title)" }}>{woDetail.description}</p>
              </div>
              {woDetail.completion_notes && (
                <div className="mb-4">
                  <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Completion Notes</div>
                  <p className="text-[12px]" style={{ color: "var(--topbar-title)" }}>{woDetail.completion_notes}</p>
                </div>
              )}
              {woDetail.vendor && (
                <div className="mb-4 p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                  <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Vendor</div>
                  <div className="text-[12px] font-medium">{woDetail.vendor.vendor_name}</div>
                  <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{woDetail.vendor.contact_phone}</div>
                </div>
              )}
              <div className="flex gap-2">
                {STATUS_CONFIG[woDetail.status]?.next && (
                  <button onClick={() => updateWO.mutate({ id: woDetail.id, status: STATUS_CONFIG[woDetail.status].next as any })} className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>
                    <ChevronRight size={12} /> Advance to {STATUS_CONFIG[STATUS_CONFIG[woDetail.status].next!]?.label}
                  </button>
                )}
                {woDetail.status !== "completed" && (
                  <button onClick={() => updateWO.mutate({ id: woDetail.id, status: "completed" })} className="flex items-center gap-1 px-3 py-1.5 rounded text-[11px] font-medium border" style={{ borderColor: "#059669", color: "#059669" }}>
                    <CheckCircle2 size={12} /> Complete
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Vendor Detail */}
          {detailView.type === "vendor" && vendorDetail && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#f0f6f6" }}>
                      <Truck size={18} style={{ color: "#245C5A" }} />
                    </div>
                    <div>
                      <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{vendorDetail.vendor_name}</h2>
                      <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{vendorDetail.vendor_type?.replace(/_/g, " ")} • {vendorDetail.payment_terms}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star key={i} size={12} style={{ color: i < (vendorDetail.rating ?? 0) ? "#D97706" : "#e2e8f0" }} fill={i < (vendorDetail.rating ?? 0) ? "#D97706" : "none"} />
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}><Phone size={10} /> {vendorDetail.contact_phone}</div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}><Mail size={10} /> {vendorDetail.contact_email}</div>
                  <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}><MapPin size={10} /> {vendorDetail.address}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>Tax ID: {vendorDetail.tax_id}</span>
                  {vendorDetail.contract_expiry && (
                    <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: vendorContractWarning(vendorDetail)?.bg ?? "#ECFDF5", color: vendorContractWarning(vendorDetail)?.color ?? "#059669" }}>Contract: {new Date(vendorDetail.contract_expiry).toLocaleDateString()}</span>
                  )}
                </div>
                {vendorDetail.notes && <p className="mt-2 text-[10px] italic" style={{ color: "var(--topbar-subtitle)" }}>{vendorDetail.notes}</p>}
              </div>

              {/* Contracts */}
              {vendorDetail.contracts && vendorDetail.contracts.length > 0 && (
                <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                  <h3 className="text-[13px] font-semibold mb-3" style={{ color: "var(--topbar-title)" }}>Contracts ({vendorDetail.contracts.length})</h3>
                  <div className="space-y-2">
                    {vendorDetail.contracts.map((c: any) => {
                      const endDate = c.end_date ? new Date(c.end_date) : null;
                      const daysUntil = endDate ? Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
                      return (
                        <div key={c.id} className="p-2.5 rounded border" style={{ borderColor: "var(--card-border)", backgroundColor: "#fff" }}>
                          <div className="flex items-center justify-between">
                            <div className="text-[12px] font-medium">{c.contract_number}</div>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: c.status === "active" ? "#ECFDF5" : "#FEF2F2", color: c.status === "active" ? "#059669" : "#DC2626" }}>{c.status}</span>
                          </div>
                          <div className="text-[10px] mt-1" style={{ color: "var(--topbar-subtitle)" }}>{c.contract_type?.replace(/_/g, " ")} • {c.scope_of_work}</div>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>${((c.value ?? 0) / 100).toLocaleString()}</span>
                            {daysUntil !== null && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: daysUntil <= 30 ? "#FEF2F2" : daysUntil <= 90 ? "#FFFBEB" : "#ECFDF5", color: daysUntil <= 30 ? "#DC2626" : daysUntil <= 90 ? "#D97706" : "#059669" }}>{daysUntil < 0 ? "Expired" : `${daysUntil}d left`}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Procurement Detail */}
          {detailView.type === "procurement" && prDetail && (
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{prDetail.title}</h2>
                  <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{prDetail.request_number} • {prDetail.category}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (PR_STATUS_CONFIG[prDetail.status] || PR_STATUS_CONFIG.draft).bg, color: (PR_STATUS_CONFIG[prDetail.status] || PR_STATUS_CONFIG.draft).color }}>{(PR_STATUS_CONFIG[prDetail.status] || PR_STATUS_CONFIG.draft).label}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}><div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Qty</div><div className="text-[12px] font-medium mt-1">{prDetail.quantity}</div></div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}><div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Est. Total</div><div className="text-[12px] font-medium mt-1">${((prDetail.estimated_total_cost ?? 0) / 100).toLocaleString()}</div></div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}><div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Priority</div><div className="text-[12px] font-medium mt-1" style={{ color: (PRIORITY_CONFIG[prDetail.priority] || PRIORITY_CONFIG.medium).color }}>{prDetail.priority}</div></div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}><div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>PO Number</div><div className="text-[12px] font-medium mt-1">{prDetail.po_number ?? "N/A"}</div></div>
              </div>
              {prDetail.description && (
                <div className="mb-3">
                  <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Description</div>
                  <p className="text-[12px]" style={{ color: "var(--topbar-title)" }}>{prDetail.description}</p>
                </div>
              )}
              {prDetail.justification && (
                <div className="mb-3">
                  <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Justification</div>
                  <p className="text-[12px]" style={{ color: "var(--topbar-title)" }}>{prDetail.justification}</p>
                </div>
              )}
              {prDetail.rejection_reason && (
                <div className="mb-3 p-2 rounded" style={{ backgroundColor: "#FEF2F2" }}>
                  <div className="text-[10px] font-medium mb-1" style={{ color: "#DC2626" }}>Rejection Reason</div>
                  <p className="text-[12px]" style={{ color: "#DC2626" }}>{prDetail.rejection_reason}</p>
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                {prDetail.status === "draft" && (
                  <button onClick={() => updatePR.mutate({ id: prDetail.id, status: "submitted" })} className="px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>Submit</button>
                )}
                {(prDetail.status === "submitted" || prDetail.status === "under_review") && (
                  <>
                    <button onClick={() => updatePR.mutate({ id: prDetail.id, approved: true })} className="px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#059669" }}>Approve</button>
                    <button onClick={() => updatePR.mutate({ id: prDetail.id, approved: false, rejectionReason: "Not approved" })} className="px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#DC2626" }}>Reject</button>
                  </>
                )}
                {prDetail.status === "approved" && (
                  <button onClick={() => updatePR.mutate({ id: prDetail.id, status: "ordered" })} className="px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#7C3AED" }}>Mark Ordered</button>
                )}
                {prDetail.status === "ordered" && (
                  <button onClick={() => updatePR.mutate({ id: prDetail.id, status: "received" })} className="px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#059669" }}>Mark Received</button>
                )}
              </div>
            </div>
          )}

          {/* Safety Detail */}
          {detailView.type === "safety" && safetyDetail && (
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: (SAFETY_STATUS_CONFIG[safetyDetail.status] || SAFETY_STATUS_CONFIG.pending).bg }}>
                    <ShieldCheck size={18} style={{ color: (SAFETY_STATUS_CONFIG[safetyDetail.status] || SAFETY_STATUS_CONFIG.pending).color }} />
                  </div>
                  <div>
                    <h2 className="text-[16px] font-bold" style={{ color: "var(--topbar-title)" }}>{safetyDetail.inspection_type?.replace(/_/g, " ")} Inspection</h2>
                    <p className="text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{safetyDetail.inspection_number} • {safetyDetail.facility_name}</p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (SAFETY_STATUS_CONFIG[safetyDetail.status] || SAFETY_STATUS_CONFIG.pending).bg, color: (SAFETY_STATUS_CONFIG[safetyDetail.status] || SAFETY_STATUS_CONFIG.pending).color }}>{(SAFETY_STATUS_CONFIG[safetyDetail.status] || SAFETY_STATUS_CONFIG.pending).label}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}><div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Score</div><div className="text-[14px] font-bold mt-1" style={{ color: (safetyDetail.score ?? 0) >= 80 ? "#059669" : (safetyDetail.score ?? 0) >= 60 ? "#D97706" : "#DC2626" }}>{safetyDetail.score ?? "N/A"}%</div></div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}><div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Date</div><div className="text-[12px] font-medium mt-1">{new Date(safetyDetail.inspection_date).toLocaleDateString()}</div></div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}><div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Next Due</div><div className="text-[12px] font-medium mt-1">{safetyDetail.next_due_date ? new Date(safetyDetail.next_due_date).toLocaleDateString() : "N/A"}</div></div>
                <div className="p-2 rounded" style={{ backgroundColor: "#f8fafc" }}><div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>Inspector</div><div className="text-[12px] font-medium mt-1">{safetyDetail.inspected_by}</div></div>
              </div>
              {safetyDetail.findings && (
                <div className="mb-3">
                  <div className="text-[10px] font-medium mb-1" style={{ color: "var(--topbar-subtitle)" }}>Findings</div>
                  <p className="text-[12px]" style={{ color: "var(--topbar-title)" }}>{safetyDetail.findings}</p>
                </div>
              )}
              {safetyDetail.corrective_actions && (
                <div className="mb-3 p-2 rounded" style={{ backgroundColor: safetyDetail.corrective_actions_completed ? "#ECFDF5" : "#FFFBEB" }}>
                  <div className="text-[10px] font-medium mb-1">Corrective Actions</div>
                  <p className="text-[12px]">{safetyDetail.corrective_actions}</p>
                  {!safetyDetail.corrective_actions_completed && (
                    <button onClick={() => updateSafety.mutate({ id: safetyDetail.id, correctiveActionsCompleted: true })} className="mt-2 px-3 py-1 rounded text-[10px] font-medium text-white" style={{ backgroundColor: "#059669" }}>Mark Complete</button>
                  )}
                  {safetyDetail.corrective_actions_completed && (
                    <span className="text-[10px] font-medium" style={{ color: "#059669" }}>Completed {safetyDetail.corrective_actions_completed_at ? new Date(safetyDetail.corrective_actions_completed_at).toLocaleDateString() : ""}</span>
                  )}
                </div>
              )}
              {/* Checklist */}
              {safetyDetail.checklist_json && (
                <div className="mb-3">
                  <div className="text-[10px] font-medium mb-2" style={{ color: "var(--topbar-subtitle)" }}>Checklist</div>
                  <div className="space-y-1">
                    {Array.isArray(JSON.parse(safetyDetail.checklist_json)) ? (JSON.parse(safetyDetail.checklist_json) as any[]).map((item: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-[11px]">
                        <span className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.pass ? "#ECFDF5" : "#FEF2F2" }}>
                          {item.pass ? <CheckCircle2 size={10} style={{ color: "#059669" }} /> : <XCircle size={10} style={{ color: "#DC2626" }} />}
                        </span>
                        <span style={{ color: item.pass ? "var(--topbar-title)" : "#DC2626" }}>{item.item}</span>
                      </div>
                    )) : null}
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                {safetyDetail.status === "pending" && (
                  <>
                    <button onClick={() => updateSafety.mutate({ id: safetyDetail.id, status: "passed" })} className="px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#059669" }}>Pass</button>
                    <button onClick={() => updateSafety.mutate({ id: safetyDetail.id, status: "passed_with_notes" })} className="px-3 py-1.5 rounded text-[11px] font-medium" style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>Pass with Notes</button>
                    <button onClick={() => updateSafety.mutate({ id: safetyDetail.id, status: "failed" })} className="px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#DC2626" }}>Fail</button>
                  </>
                )}
                {(safetyDetail.status === "passed" || safetyDetail.status === "passed_with_notes" || safetyDetail.status === "failed") && !safetyDetail.reviewed_by && (
                  <button onClick={() => updateSafety.mutate({ id: safetyDetail.id, reviewed: true })} className="px-3 py-1.5 rounded text-[11px] font-medium text-white" style={{ backgroundColor: "#245C5A" }}>Mark Reviewed</button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          OVERVIEW TAB
          ══════════════════════════════════════════════════ */}
      {!detailView && activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Facilities", value: kpis?.facilityCount ?? 0, icon: Building2, color: "#2563EB", sub: "Active sites" },
              { label: "Vendors", value: kpis?.vendorCount ?? 0, icon: Truck, color: "#059669", sub: "Under contract" },
              { label: "Open Work Orders", value: kpis?.openWorkOrders ?? 0, icon: Wrench, color: "#D97706", sub: "Awaiting action" },
              { label: "In Progress", value: kpis?.inProgressWorkOrders ?? 0, icon: Clock, color: "#245C5A", sub: "Active jobs" },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center gap-2 mb-1"><c.icon size={14} style={{ color: c.color }} /><span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span></div>
                <div className="text-[20px] font-bold" style={{ color: c.color }}>{c.value}</div>
                <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{c.sub}</div>
              </div>
            ))}
          </div>

          {/* Second KPI Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Pending Parts", value: kpis?.pendingPartsWorkOrders ?? 0, icon: Package, color: "#7C3AED" },
              { label: "Completed This Month", value: kpis?.completedThisMonth ?? 0, icon: CheckCircle2, color: "#059669" },
              { label: "Urgent/High", value: kpis?.urgentHighCount ?? 0, icon: AlertTriangle, color: "#DC2626" },
              { label: "Total Est. Cost", value: `$${(totalEstimated / 100).toLocaleString()}`, icon: DollarSign, color: "#245C5A" },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center gap-2 mb-1"><c.icon size={14} style={{ color: c.color }} /><span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span></div>
                <div className="text-[20px] font-bold" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {/* Procurement & Safety KPIs Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Pending Procurement", value: kpis?.pendingProcurement ?? 0, icon: ShoppingCart, color: "#7C3AED" },
              { label: "Procurement Value", value: `$${((kpis?.totalProcurementValue ?? 0) / 100).toLocaleString()}`, icon: DollarSign, color: "#059669" },
              { label: "Safety Overdue", value: kpis?.safetyOverdue ?? 0, icon: Shield, color: "#DC2626" },
              { label: "Expiring Contracts", value: kpis?.expiringContracts ?? 0, icon: Calendar, color: "#D97706" },
            ].map(c => (
              <div key={c.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                <div className="flex items-center gap-2 mb-1"><c.icon size={14} style={{ color: c.color }} /><span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{c.label}</span></div>
                <div className="text-[20px] font-bold" style={{ color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Urgent Work Orders */}
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <AlertTriangle size={15} style={{ color: "#DC2626" }} /> Priority Work Orders
              </h3>
              {urgentWO.length === 0 ? (
                <p className="text-[12px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>No urgent or high-priority work orders</p>
              ) : (
                <div className="space-y-2">
                  {urgentWO.map((wo: any) => {
                    const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.open;
                    const prio = PRIORITY_CONFIG[wo.priority] || PRIORITY_CONFIG.medium;
                    return (
                      <div key={wo.id} className="flex items-center gap-3 p-2.5 rounded border cursor-pointer hover:opacity-80" style={{ borderColor: "var(--card-border)", backgroundColor: "#fff" }} onClick={() => setDetailView({ type: "workorder", id: wo.id })}>
                        <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ backgroundColor: prio.bg, color: prio.color }}>{wo.priority[0].toUpperCase()}</div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>{wo.title}</div>
                          <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{wo.wo_number} • Due {wo.due_date ? new Date(wo.due_date).toLocaleDateString() : "TBD"}</div>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</span>
                        <Eye size={12} style={{ color: "var(--topbar-subtitle)" }} />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Vendor Contract Alerts */}
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
              <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
                <Calendar size={15} style={{ color: "#D97706" }} /> Contract Alerts
              </h3>
              {(() => {
                const alerts = (vendors ?? []).map(v => ({ ...v, alert: vendorContractWarning(v) })).filter(v => v.alert);
                if (alerts.length === 0) return <p className="text-[12px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>No contract alerts</p>;
                return (
                  <div className="space-y-2">
                    {alerts.map(v => (
                      <div key={v.id} className="flex items-center gap-3 p-2.5 rounded border cursor-pointer hover:opacity-80" style={{ borderColor: "var(--card-border)", backgroundColor: "#fff" }} onClick={() => setDetailView({ type: "vendor", id: v.id })}>
                        <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ backgroundColor: v.alert!.bg }}>
                          <AlertTriangle size={14} style={{ color: v.alert!.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-medium truncate" style={{ color: "var(--topbar-title)" }}>{v.vendor_name}</div>
                          <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>Expires {new Date(v.contract_expiry).toLocaleDateString()}</div>
                        </div>
                        <span className="text-[9px] px-2 py-0.5 rounded-full flex-shrink-0 font-medium" style={{ backgroundColor: v.alert!.bg, color: v.alert!.color }}>{v.alert!.level === "expired" ? "Expired" : "< 60 days"}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Safety Overview */}
          <div className="rounded-lg border p-4" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
            <h3 className="text-[13px] font-semibold mb-3 flex items-center gap-2" style={{ color: "var(--topbar-title)" }}>
              <ShieldCheck size={15} style={{ color: "#245C5A" }} /> Safety Readiness Overview
            </h3>
            {safetyKPIs ? (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: "Total", value: safetyKPIs.totalInspections, color: "#2563EB" },
                  { label: "Passed", value: safetyKPIs.passed, color: "#059669" },
                  { label: "Failed", value: safetyKPIs.failed, color: "#DC2626" },
                  { label: "Overdue", value: safetyKPIs.overdue, color: "#7F1D1D" },
                  { label: "Pending Actions", value: safetyKPIs.pendingCorrective, color: "#D97706" },
                ].map(item => (
                  <div key={item.label} className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[16px] font-bold" style={{ color: item.color }}>{item.value}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>{item.label}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] py-4 text-center" style={{ color: "var(--topbar-subtitle)" }}>Loading safety data...</p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          WORK ORDERS TAB
          ══════════════════════════════════════════════════ */}
      {!detailView && activeTab === "workorders" && (
        <div>
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "open", "in_progress", "pending_parts", "completed"].map(f => (
              <button key={f} onClick={() => setWoFilter(f)} className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors capitalize"
                style={{ backgroundColor: woFilter === f ? "#245C5A" : "var(--card-bg)", borderColor: woFilter === f ? "#245C5A" : "var(--card-border)", color: woFilter === f ? "#fff" : "var(--topbar-subtitle)" }}>
                {f === "all" ? "All" : (STATUS_CONFIG[f]?.label ?? f)}
              </button>
            ))}
            <div className="ml-auto text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{filteredWO?.length ?? 0} work orders</div>
          </div>

          {/* Work Order List */}
          <div className="space-y-2">
            {filteredWO?.map((wo: any) => {
              const status = STATUS_CONFIG[wo.status] || STATUS_CONFIG.open;
              const prio = PRIORITY_CONFIG[wo.priority] || PRIORITY_CONFIG.medium;
              const isOverdue = wo.due_date && new Date(wo.due_date) < new Date() && wo.status !== "completed" && wo.status !== "cancelled";
              return (
                <div key={wo.id} className="rounded-lg border overflow-hidden cursor-pointer hover:shadow-sm transition-shadow" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }} onClick={() => setDetailView({ type: "workorder", id: wo.id })}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-bold" style={{ backgroundColor: prio.bg, color: prio.color }}>
                      {WORK_TYPE_ICONS[wo.work_type] ?? wo.work_type?.slice(0, 3).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{wo.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: prio.bg, color: prio.color }}>{wo.priority}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</span>
                        {isOverdue && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FEE2E2", color: "#DC2626" }}>Overdue</span>}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>
                        {wo.wo_number} • {wo.assigned_to} • Est: ${((wo.estimated_cost ?? 0) / 100).toLocaleString()}
                        {wo.due_date && ` • Due: ${new Date(wo.due_date).toLocaleDateString()}`}
                      </div>
                    </div>
                    <Eye size={14} style={{ color: "var(--topbar-subtitle)" }} className="flex-shrink-0" />
                  </div>
                </div>
              );
            })}
            {filteredWO?.length === 0 && (
              <div className="text-center py-12">
                <Wrench size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No work orders match this filter</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          VENDORS TAB
          ══════════════════════════════════════════════════ */}
      {!detailView && activeTab === "vendors" && (
        <div>
          {/* Type filter */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "hvac", "plumbing", "electrical", "safety_equipment", "security", "landscaping", "general_contractor"].map(f => (
              <button key={f} onClick={() => setVendorFilter(f)} className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors capitalize"
                style={{ backgroundColor: vendorFilter === f ? "#245C5A" : "var(--card-bg)", borderColor: vendorFilter === f ? "#245C5A" : "var(--card-border)", color: vendorFilter === f ? "#fff" : "var(--topbar-subtitle)" }}>
                {f === "all" ? "All" : f.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(vendors ?? [])
              .filter((v: any) => vendorFilter === "all" || v.vendor_type === vendorFilter)
              .map((v: any) => {
                const alert = vendorContractWarning(v);
                return (
                  <div key={v.id} className="rounded-lg border p-4 cursor-pointer hover:shadow-sm transition-shadow" style={{ borderColor: alert ? alert.color + "40" : "var(--card-border)", backgroundColor: "var(--card-bg)" }} onClick={() => setDetailView({ type: "vendor", id: v.id })}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#f0f6f6" }}>
                          <Truck size={16} style={{ color: "#245C5A" }} />
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold" style={{ color: "var(--topbar-title)" }}>{v.vendor_name}</div>
                          <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{v.vendor_type.replace(/_/g, " ")} • {v.payment_terms}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }, (_, i) => (
                          <Star key={i} size={10} style={{ color: i < (v.rating ?? 0) ? "#D97706" : "#e2e8f0" }} fill={i < (v.rating ?? 0) ? "#D97706" : "none"} />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}><Phone size={10} /> {v.contact_phone}</div>
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}><Mail size={10} /> {v.contact_email}</div>
                      <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}><MapPin size={10} /> {v.address}</div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>Tax ID: {v.tax_id}</span>
                      {v.contract_expiry && (
                        <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: alert ? alert.bg : "#ECFDF5", color: alert ? alert.color : "#059669" }}>Contract: {new Date(v.contract_expiry).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          FACILITIES TAB
          ══════════════════════════════════════════════════ */}
      {!detailView && activeTab === "facilities" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(facilities ?? []).map((f: any) => {
            const nextInspection = f.next_inspection_date ? new Date(f.next_inspection_date) : null;
            const inspectionDays = nextInspection ? Math.ceil((nextInspection.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
            const openWOCount = (workOrders ?? []).filter((w: any) => w.facility_id === f.id && w.status !== "completed" && w.status !== "cancelled").length;

            return (
              <div key={f.id} className="rounded-lg border p-4 cursor-pointer hover:shadow-sm transition-shadow" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }} onClick={() => setDetailView({ type: "facility", id: f.id })}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: "#f0f6f6" }}>
                    <Building2 size={18} style={{ color: "#245C5A" }} />
                  </div>
                  <div>
                    <div className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>{f.facility_name}</div>
                    <div className="text-[10px]" style={{ color: "var(--topbar-subtitle)" }}>{f.facility_code} • Built {f.built_year}</div>
                  </div>
                  <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#ECFDF5", color: "#059669" }}>{f.status}</span>
                </div>
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>{(f.total_sqft ?? 0).toLocaleString()}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>sq ft</div>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>{f.bedrooms ?? 0}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>bedrooms</div>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[14px] font-bold" style={{ color: "var(--topbar-title)" }}>{f.common_areas ?? 0}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>common areas</div>
                  </div>
                  <div className="text-center p-2 rounded" style={{ backgroundColor: "#f8fafc" }}>
                    <div className="text-[14px] font-bold" style={{ color: openWOCount > 0 ? "#DC2626" : "var(--topbar-title)" }}>{openWOCount}</div>
                    <div className="text-[9px]" style={{ color: "var(--topbar-subtitle)" }}>open WOs</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>
                  <MapPin size={10} /> {f.address}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] px-2 py-0.5 rounded" style={{ backgroundColor: "#f1f5f9", color: "#64748b" }}>
                    Last: {f.last_inspection_date ? new Date(f.last_inspection_date).toLocaleDateString() : "N/A"}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ backgroundColor: inspectionDays !== null && inspectionDays <= 30 ? "#FEF2F2" : "#ECFDF5", color: inspectionDays !== null && inspectionDays <= 30 ? "#DC2626" : "#059669" }}>
                    Next: {inspectionDays !== null ? `${inspectionDays} days` : "N/A"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          PROCUREMENT TAB
          ══════════════════════════════════════════════════ */}
      {!detailView && activeTab === "procurement" && (
        <div>
          {/* Filters */}
          <div className="flex gap-2 mb-4 flex-wrap">
            {["all", "draft", "submitted", "under_review", "approved", "ordered", "received", "rejected"].map(f => (
              <button key={f} onClick={() => setPrFilter(f)} className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors capitalize"
                style={{ backgroundColor: prFilter === f ? "#245C5A" : "var(--card-bg)", borderColor: prFilter === f ? "#245C5A" : "var(--card-border)", color: prFilter === f ? "#fff" : "var(--topbar-subtitle)" }}>
                {f === "all" ? "All" : (PR_STATUS_CONFIG[f]?.label ?? f)}
              </button>
            ))}
            <div className="ml-auto text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{filteredPR?.length ?? 0} requests</div>
          </div>

          <div className="space-y-2">
            {filteredPR?.map((pr: any) => {
              const status = PR_STATUS_CONFIG[pr.status] || PR_STATUS_CONFIG.draft;
              const prio = PRIORITY_CONFIG[pr.priority] || PRIORITY_CONFIG.medium;
              return (
                <div key={pr.id} className="rounded-lg border overflow-hidden cursor-pointer hover:shadow-sm transition-shadow" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }} onClick={() => setDetailView({ type: "procurement", id: pr.id })}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: status.bg }}>
                      <ShoppingCart size={16} style={{ color: status.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{pr.title}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: prio.bg, color: prio.color }}>{pr.priority}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</span>
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>
                        {pr.request_number} • {pr.category} • {pr.vendor_name ?? "No vendor"} • ${((pr.estimated_total_cost ?? 0) / 100).toLocaleString()}
                      </div>
                    </div>
                    <Eye size={14} style={{ color: "var(--topbar-subtitle)" }} className="flex-shrink-0" />
                  </div>
                </div>
              );
            })}
            {filteredPR?.length === 0 && (
              <div className="text-center py-12">
                <ShoppingCart size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No procurement requests match this filter</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          SAFETY TAB
          ══════════════════════════════════════════════════ */}
      {!detailView && activeTab === "safety" && (
        <div className="space-y-4">
          {/* Safety KPIs */}
          {safetyKPIs && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label: "Avg Score", value: `${safetyKPIs.avgScore}%`, icon: TrendingUp, color: safetyKPIs.avgScore >= 80 ? "#059669" : "#D97706" },
                { label: "Passed", value: safetyKPIs.passed, icon: CheckCircle2, color: "#059669" },
                { label: "Failed", value: safetyKPIs.failed, icon: XCircle, color: "#DC2626" },
                { label: "Overdue", value: safetyKPIs.overdue, icon: AlertTriangle, color: "#7F1D1D" },
                { label: "Pending Actions", value: safetyKPIs.pendingCorrective, icon: ClipboardList, color: "#D97706" },
              ].map(item => (
                <div key={item.label} className="rounded-lg border p-3" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }}>
                  <div className="flex items-center gap-2 mb-1"><item.icon size={14} style={{ color: item.color }} /><span className="text-[11px] font-medium" style={{ color: "var(--topbar-subtitle)" }}>{item.label}</span></div>
                  <div className="text-[20px] font-bold" style={{ color: item.color }}>{item.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div className="flex gap-2 mb-2 flex-wrap">
            {["all", "passed", "passed_with_notes", "failed", "pending", "overdue"].map(f => (
              <button key={f} onClick={() => setSafetyFilter(f)} className="px-3 py-1.5 rounded text-[11px] font-medium border transition-colors capitalize"
                style={{ backgroundColor: safetyFilter === f ? "#245C5A" : "var(--card-bg)", borderColor: safetyFilter === f ? "#245C5A" : "var(--card-border)", color: safetyFilter === f ? "#fff" : "var(--topbar-subtitle)" }}>
                {f === "all" ? "All" : (SAFETY_STATUS_CONFIG[f]?.label ?? f)}
              </button>
            ))}
            <div className="ml-auto text-[11px]" style={{ color: "var(--topbar-subtitle)" }}>{filteredSafety?.length ?? 0} inspections</div>
          </div>

          {/* Inspection List */}
          <div className="space-y-2">
            {filteredSafety?.map((si: any) => {
              const status = SAFETY_STATUS_CONFIG[si.status] || SAFETY_STATUS_CONFIG.pending;
              const daysUntil = si.next_due_date ? Math.ceil((new Date(si.next_due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
              return (
                <div key={si.id} className="rounded-lg border overflow-hidden cursor-pointer hover:shadow-sm transition-shadow" style={{ borderColor: "var(--card-border)", backgroundColor: "var(--card-bg)" }} onClick={() => setDetailView({ type: "safety", id: si.id })}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: status.bg }}>
                      <ShieldCheck size={16} style={{ color: status.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[12px] font-medium" style={{ color: "var(--topbar-title)" }}>{si.inspection_type?.replace(/_/g, " ")} — {si.facility_name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: status.bg, color: status.color }}>{status.label}</span>
                        {si.corrective_actions && !si.corrective_actions_completed && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: "#FFFBEB", color: "#D97706" }}>Action Required</span>
                        )}
                      </div>
                      <div className="text-[10px] mt-0.5" style={{ color: "var(--topbar-subtitle)" }}>
                        {si.inspection_number} • {si.inspected_by} • Score: {si.score ?? "N/A"}%
                        {daysUntil !== null && ` • Due in ${daysUntil}d`}
                      </div>
                    </div>
                    <Eye size={14} style={{ color: "var(--topbar-subtitle)" }} className="flex-shrink-0" />
                  </div>
                </div>
              );
            })}
            {filteredSafety?.length === 0 && (
              <div className="text-center py-12">
                <Shield size={32} style={{ color: "#cbd5e1" }} className="mx-auto mb-3" />
                <p className="text-[13px]" style={{ color: "var(--topbar-subtitle)" }}>No safety inspections match this filter</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CREATE WORK ORDER MODAL
          ══════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Create Work Order</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-[18px]" style={{ color: "#94A3B8" }}>×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createWO.mutate({ title: fd.get("title") as string, description: fd.get("description") as string, workType: fd.get("workType") as string, priority: fd.get("priority") as any, dueDate: fd.get("dueDate") as string, estimatedCost: fd.get("estimatedCost") ? parseInt(fd.get("estimatedCost") as string) * 100 : undefined, facilityId: fd.get("facilityId") as string }); }} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Title</label>
                <input name="title" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="e.g., HVAC repair — common area" />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Description</label>
                <textarea name="description" required rows={3} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Describe the issue and required work..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Work Type</label>
                  <select name="workType" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                    <option value="hvac">HVAC</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="electrical">Electrical</option>
                    <option value="safety">Safety</option>
                    <option value="security">Security</option>
                    <option value="grounds">Grounds</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="it">IT</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Priority</label>
                  <select name="priority" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Due Date</label>
                  <input name="dueDate" type="date" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Est. Cost ($)</label>
                  <input name="estimatedCost" type="number" min="0" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="0.00" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Facility</label>
                <select name="facilityId" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                  <option value="">Select facility...</option>
                  {(facilities ?? []).map((f: any) => (<option key={f.id} value={f.id}>{f.facility_name ?? f.name}</option>))}
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="flex-1 px-4 py-2 rounded border text-[12px] font-medium" style={{ borderColor: "#E2E8F0", color: "var(--topbar-subtitle)" }}>Cancel</button>
                <button type="submit" disabled={createWO.isPending} className="flex-1 px-4 py-2 rounded text-[12px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>{createWO.isPending ? "Creating..." : "Create Work Order"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CREATE PROCUREMENT REQUEST MODAL
          ══════════════════════════════════════════════════ */}
      {showPRCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Create Procurement Request</h3>
              <button onClick={() => setShowPRCreateModal(false)} className="text-[18px]" style={{ color: "#94A3B8" }}>×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createPR.mutate({ title: fd.get("title") as string, description: fd.get("description") as string, category: fd.get("category") as any, quantity: parseInt(fd.get("quantity") as string) || 1, estimatedUnitCost: fd.get("cost") ? parseInt(fd.get("cost") as string) * 100 : undefined, vendorId: fd.get("vendorId") as string || undefined, facilityId: fd.get("facilityId") as string || undefined, priority: fd.get("priority") as any, justification: fd.get("justification") as string }); }} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Title</label>
                <input name="title" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="e.g., Youth program laptops" />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Description</label>
                <textarea name="description" rows={2} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Describe the items or services needed..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Category</label>
                  <select name="category" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                    <option value="equipment">Equipment</option>
                    <option value="supplies">Supplies</option>
                    <option value="services">Services</option>
                    <option value="furniture">Furniture</option>
                    <option value="technology">Technology</option>
                    <option value="safety">Safety</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Priority</label>
                  <select name="priority" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                    <option value="low">Low</option>
                    <option value="medium" selected>Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Quantity</label>
                  <input name="quantity" type="number" min="1" defaultValue="1" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Est. Unit Cost ($)</label>
                  <input name="cost" type="number" min="0" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="0.00" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Vendor</label>
                  <select name="vendorId" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                    <option value="">Select vendor...</option>
                    {(vendors ?? []).map((v: any) => (<option key={v.id} value={v.id}>{v.vendor_name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Facility</label>
                  <select name="facilityId" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                    <option value="">Select facility...</option>
                    {(facilities ?? []).map((f: any) => (<option key={f.id} value={f.id}>{f.facility_name ?? f.name}</option>))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Justification</label>
                <textarea name="justification" rows={2} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Why is this purchase needed?" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowPRCreateModal(false)} className="flex-1 px-4 py-2 rounded border text-[12px] font-medium" style={{ borderColor: "#E2E8F0", color: "var(--topbar-subtitle)" }}>Cancel</button>
                <button type="submit" disabled={createPR.isPending} className="flex-1 px-4 py-2 rounded text-[12px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>{createPR.isPending ? "Creating..." : "Create Request"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CREATE SAFETY INSPECTION MODAL
          ══════════════════════════════════════════════════ */}
      {showSafetyCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Create Safety Inspection</h3>
              <button onClick={() => setShowSafetyCreateModal(false)} className="text-[18px]" style={{ color: "#94A3B8" }}>×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createSafety.mutate({ facilityId: fd.get("facilityId") as string, inspectionType: fd.get("inspectionType") as any, inspectedBy: fd.get("inspectedBy") as string, inspectionDate: fd.get("inspectionDate") as string, nextDueDate: fd.get("nextDueDate") as string, frequencyDays: parseInt(fd.get("frequencyDays") as string) || 90, score: fd.get("score") ? parseInt(fd.get("score") as string) : undefined, findings: fd.get("findings") as string, correctiveActions: fd.get("correctiveActions") as string }); }} className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Facility</label>
                  <select name="facilityId" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                    <option value="">Select facility...</option>
                    {(facilities ?? []).map((f: any) => (<option key={f.id} value={f.id}>{f.facility_name ?? f.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Inspection Type</label>
                  <select name="inspectionType" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                    <option value="fire_safety">Fire Safety</option>
                    <option value="sprinkler">Sprinkler</option>
                    <option value="emergency_lighting">Emergency Lighting</option>
                    <option value="generator">Generator</option>
                    <option value="extinguisher">Extinguisher</option>
                    <option value="hvac">HVAC</option>
                    <option value="electrical">Electrical</option>
                    <option value="plumbing">Plumbing</option>
                    <option value="security">Security</option>
                    <option value="grounds">Grounds</option>
                    <option value="food_service">Food Service</option>
                    <option value="general">General</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Inspected By</label>
                <input name="inspectedBy" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Inspector name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Inspection Date</label>
                  <input name="inspectionDate" type="date" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Next Due Date</label>
                  <input name="nextDueDate" type="date" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Frequency (days)</label>
                  <input name="frequencyDays" type="number" defaultValue="90" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Score (0-100)</label>
                  <input name="score" type="number" min="0" max="100" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Optional" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Findings</label>
                <textarea name="findings" rows={2} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Inspection findings..." />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Corrective Actions</label>
                <textarea name="correctiveActions" rows={2} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Required corrective actions, if any..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowSafetyCreateModal(false)} className="flex-1 px-4 py-2 rounded border text-[12px] font-medium" style={{ borderColor: "#E2E8F0", color: "var(--topbar-subtitle)" }}>Cancel</button>
                <button type="submit" disabled={createSafety.isPending} className="flex-1 px-4 py-2 rounded text-[12px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>{createSafety.isPending ? "Creating..." : "Create Inspection"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════
          CREATE VENDOR MODAL
          ══════════════════════════════════════════════════ */}
      {showVendorCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg w-full max-w-lg overflow-hidden">
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "#E2E8F0" }}>
              <h3 className="text-[14px] font-semibold" style={{ color: "var(--topbar-title)" }}>Add Vendor</h3>
              <button onClick={() => setShowVendorCreateModal(false)} className="text-[18px]" style={{ color: "#94A3B8" }}>×</button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); createVendor.mutate({ vendorName: fd.get("vendorName") as string, vendorType: fd.get("vendorType") as string, contactPerson: fd.get("contactPerson") as string, contactPhone: fd.get("contactPhone") as string, contactEmail: fd.get("contactEmail") as string, address: fd.get("address") as string, taxId: fd.get("taxId") as string, paymentTerms: fd.get("paymentTerms") as string, rating: fd.get("rating") ? parseInt(fd.get("rating") as string) : undefined, notes: fd.get("notes") as string, contractExpiry: fd.get("contractExpiry") as string }); }} className="p-4 space-y-3">
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Vendor Name</label>
                <input name="vendorName" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Company name" />
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Vendor Type</label>
                <select name="vendorType" required className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }}>
                  <option value="hvac">HVAC</option>
                  <option value="plumbing">Plumbing</option>
                  <option value="electrical">Electrical</option>
                  <option value="safety_equipment">Safety Equipment</option>
                  <option value="security">Security</option>
                  <option value="landscaping">Landscaping</option>
                  <option value="general_contractor">General Contractor</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Contact Person</label>
                  <input name="contactPerson" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Name" />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Phone</label>
                  <input name="contactPhone" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="(555) 555-5555" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Email</label>
                  <input name="contactEmail" type="email" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="email@example.com" />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Rating (1-5)</label>
                  <input name="rating" type="number" min="1" max="5" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="1-5" />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Address</label>
                <input name="address" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Full address" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Tax ID</label>
                  <input name="taxId" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="XX-XXXXXXX" />
                </div>
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Payment Terms</label>
                  <input name="paymentTerms" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="e.g., Net 30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Contract Expiry</label>
                  <input name="contractExpiry" type="date" className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} />
                </div>
              </div>
              <div>
                <label className="text-[11px] font-medium block mb-1" style={{ color: "var(--topbar-subtitle)" }}>Notes</label>
                <textarea name="notes" rows={2} className="w-full px-3 py-2 rounded border text-[13px]" style={{ borderColor: "#E2E8F0" }} placeholder="Additional notes..." />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowVendorCreateModal(false)} className="flex-1 px-4 py-2 rounded border text-[12px] font-medium" style={{ borderColor: "#E2E8F0", color: "var(--topbar-subtitle)" }}>Cancel</button>
                <button type="submit" disabled={createVendor.isPending} className="flex-1 px-4 py-2 rounded text-[12px] font-medium text-white disabled:opacity-50" style={{ backgroundColor: "#245C5A" }}>{createVendor.isPending ? "Adding..." : "Add Vendor"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default GADDashboardPage;
